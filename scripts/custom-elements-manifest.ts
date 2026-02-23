/** @file Build/check helpers for shipping a Custom Elements Manifest. */

const MANIFEST_FILENAME = "custom-elements.json";
const COMPONENTS_DIR = "app/components";
const ICONS_DIR = "app/icons";

export interface CustomElementsDeclaration {
  tagName?: string;
  [key: string]: unknown;
}

export interface CustomElementsModule {
  declarations?: CustomElementsDeclaration[];
  [key: string]: unknown;
}

export interface CustomElementsManifestDocument {
  schemaVersion?: string;
  modules?: CustomElementsModule[];
  [key: string]: unknown;
}

export interface GenerateManifestOptions {
  projectRoot?: string;
  outDir?: string;
  shipToBuild?: boolean;
}

export interface GenerateManifestResult {
  manifestPath: string;
  shippedManifestPath: string | null;
  manifest: CustomElementsManifestDocument;
  tagNames: string[];
}

export interface ManifestCheckResult {
  sourceManifestPath: string;
  generatedManifestPath: string;
  isUpToDate: boolean;
  tagNames: string[];
}

// Upstream type declarations currently omit runtime `create`/`ts` exports.
const analyzerModule = await import(
  "npm:@custom-elements-manifest/analyzer/index.js"
) as unknown as {
  create: (options: { modules: unknown[] }) => CustomElementsManifestDocument;
  ts: {
    ScriptTarget: { ES2022: number };
    createSourceFile: (
      fileName: string,
      sourceText: string,
      languageVersion: number,
      setParentNodes?: boolean,
    ) => unknown;
  };
};

const createManifest = analyzerModule.create;
const tsCompiler = analyzerModule.ts;

function joinPath(basePath: string, segment: string): string {
  const base = basePath.replace(/\/+$/g, "");
  const child = segment.replace(/^\/+/g, "");
  return `${base}/${child}`;
}

function toPosixPath(path: string): string {
  return path.replaceAll("\\", "/");
}

function toRelativePath(projectRoot: string, absolutePath: string): string {
  const root = toPosixPath(projectRoot).replace(/\/+$/g, "");
  const normalizedPath = toPosixPath(absolutePath);
  return normalizedPath.startsWith(`${root}/`)
    ? normalizedPath.slice(root.length + 1)
    : normalizedPath;
}

async function walkFilesRecursive(directory: string): Promise<string[]> {
  const files: string[] = [];
  for await (const entry of Deno.readDir(directory)) {
    const entryPath = joinPath(directory, entry.name);
    if (entry.isDirectory) {
      files.push(...await walkFilesRecursive(entryPath));
    } else if (entry.isFile) {
      files.push(entryPath);
    }
  }
  return files;
}

function isManifestSourceFile(relativePath: string): boolean {
  if (relativePath.endsWith(".test.ts")) {
    return false;
  }

  if (
    relativePath.startsWith(`${COMPONENTS_DIR}/`) &&
    relativePath.endsWith("-custom-element.ts")
  ) {
    return true;
  }

  if (relativePath.startsWith(`${ICONS_DIR}/`) && relativePath.endsWith("/index.ts")) {
    return true;
  }

  return false;
}

async function listManifestSourceFiles(projectRoot: string): Promise<string[]> {
  const sourceDirectories = [
    joinPath(projectRoot, COMPONENTS_DIR),
    joinPath(projectRoot, ICONS_DIR),
  ];

  const files = new Set<string>();

  for (const directory of sourceDirectories) {
    try {
      const found = await walkFilesRecursive(directory);
      for (const absolutePath of found) {
        const relativePath = toRelativePath(projectRoot, absolutePath);
        if (isManifestSourceFile(relativePath)) {
          files.add(relativePath);
        }
      }
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }
  }

  return [...files].sort();
}

function normalizeManifestJson(text: string): string {
  return JSON.stringify(JSON.parse(text), null, 2);
}

function buildManifestDocument(
  sourceFiles: unknown[],
): CustomElementsManifestDocument {
  return createManifest({ modules: sourceFiles });
}

export function collectTagNames(
  manifest: CustomElementsManifestDocument,
): string[] {
  const tagNames = new Set<string>();
  for (const moduleEntry of manifest.modules ?? []) {
    for (const declaration of moduleEntry.declarations ?? []) {
      if (declaration.tagName) {
        tagNames.add(declaration.tagName);
      }
    }
  }
  return [...tagNames].sort();
}

export async function generateCustomElementsManifest(
  options: GenerateManifestOptions = {},
): Promise<GenerateManifestResult> {
  const projectRoot = options.projectRoot ?? Deno.cwd();
  const outDir = options.outDir ?? projectRoot;
  const shipToBuild = options.shipToBuild ?? false;

  const sourceFilePaths = await listManifestSourceFiles(projectRoot);
  if (sourceFilePaths.length === 0) {
    throw new Error("No custom-element source files were found for manifest generation.");
  }

  const sourceFiles = await Promise.all(
    sourceFilePaths.map(async (relativePath) => {
      const absolutePath = joinPath(projectRoot, relativePath);
      const sourceText = await Deno.readTextFile(absolutePath);
      return tsCompiler.createSourceFile(
        relativePath,
        sourceText,
        tsCompiler.ScriptTarget.ES2022,
        true,
      );
    }),
  );

  const manifest = buildManifestDocument(sourceFiles);
  const tagNames = collectTagNames(manifest);

  await Deno.mkdir(outDir, { recursive: true });
  const manifestPath = joinPath(outDir, MANIFEST_FILENAME);
  await Deno.writeTextFile(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  let shippedManifestPath: string | null = null;
  if (shipToBuild) {
    const buildDir = joinPath(projectRoot, "build");
    await Deno.mkdir(buildDir, { recursive: true });
    shippedManifestPath = joinPath(buildDir, MANIFEST_FILENAME);
    await Deno.copyFile(manifestPath, shippedManifestPath);
  }

  return {
    manifestPath,
    shippedManifestPath,
    manifest,
    tagNames,
  };
}

export async function checkCustomElementsManifest(
  projectRoot = Deno.cwd(),
): Promise<ManifestCheckResult> {
  const sourceManifestPath = joinPath(projectRoot, MANIFEST_FILENAME);
  const tempDir = await Deno.makeTempDir({
    prefix: "custom-elements-manifest-check-",
  });

  try {
    const generated = await generateCustomElementsManifest({
      projectRoot,
      outDir: tempDir,
      shipToBuild: false,
    });
    const generatedText = await Deno.readTextFile(generated.manifestPath);

    let sourceText: string | null = null;
    try {
      sourceText = await Deno.readTextFile(sourceManifestPath);
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }

    const isUpToDate = sourceText !== null &&
      normalizeManifestJson(sourceText) === normalizeManifestJson(generatedText);

    return {
      sourceManifestPath,
      generatedManifestPath: generated.manifestPath,
      isUpToDate,
      tagNames: generated.tagNames,
    };
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
}

if (import.meta.main) {
  const wantsCheck = Deno.args.includes("--check");
  const wantsShip = Deno.args.includes("--ship");

  if (wantsCheck) {
    const checkResult = await checkCustomElementsManifest();
    if (!checkResult.isUpToDate) {
      console.error(
        `Custom Elements Manifest is out of date. Run "deno task build:manifest" to refresh ${MANIFEST_FILENAME}.`,
      );
      Deno.exit(1);
    }
    console.log(
      `${MANIFEST_FILENAME} is up to date (${checkResult.tagNames.length} custom element tags).`,
    );
    Deno.exit(0);
  }

  const generated = await generateCustomElementsManifest({
    shipToBuild: wantsShip,
  });
  console.log(
    `Generated ${MANIFEST_FILENAME} (${generated.tagNames.length} custom element tags).`,
  );

  if (generated.shippedManifestPath) {
    console.log(`Copied manifest to ${generated.shippedManifestPath}.`);
  }
}

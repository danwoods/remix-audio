/** @file Conventional commit based semantic release helpers. */

export type ReleaseBump = "none" | "patch" | "minor" | "major";

const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;
const SEMVER_TAG_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)$/;
const CONVENTIONAL_COMMIT_HEADER_PATTERN = /^([a-z]+)(?:\([^)]+\))?(!)?:\s+/;
const PATCH_RELEASE_TYPES = new Set(["fix", "perf", "revert"]);

const BUMP_PRIORITY: Record<ReleaseBump, number> = {
  none: 0,
  patch: 1,
  minor: 2,
  major: 3,
};

interface DenoConfig {
  version?: string;
  [key: string]: unknown;
}

export interface ReleaseResult {
  currentVersion: string;
  nextVersion: string;
  bump: Exclude<ReleaseBump, "none">;
  previousTag: string | null;
}

function getCommitHeader(message: string): string {
  return message.split("\n", 1)[0]?.trim() ?? "";
}

function hasBreakingChange(message: string): boolean {
  return /(^|\n)BREAKING[\s-]CHANGE:\s+/m.test(message);
}

function isReleaseCommitHeader(header: string): boolean {
  return /^chore\(release\):\s*v?\d+\.\d+\.\d+/i.test(header);
}

export function getCommitBump(message: string): ReleaseBump {
  const header = getCommitHeader(message);

  if (!header || isReleaseCommitHeader(header)) {
    return "none";
  }

  const conventionalMatch = header.match(CONVENTIONAL_COMMIT_HEADER_PATTERN);
  if (!conventionalMatch) {
    return hasBreakingChange(message) ? "major" : "none";
  }

  const [, type, isBreaking] = conventionalMatch;
  if (isBreaking || hasBreakingChange(message)) {
    return "major";
  }

  if (type === "feat") {
    return "minor";
  }

  if (PATCH_RELEASE_TYPES.has(type)) {
    return "patch";
  }

  return "none";
}

export function determineVersionBump(commitMessages: string[]): ReleaseBump {
  let highestBump: ReleaseBump = "none";

  for (const message of commitMessages) {
    const bump = getCommitBump(message);
    if (BUMP_PRIORITY[bump] > BUMP_PRIORITY[highestBump]) {
      highestBump = bump;
    }
    if (highestBump === "major") {
      return highestBump;
    }
  }

  return highestBump;
}

export function incrementSemver(
  currentVersion: string,
  bump: Exclude<ReleaseBump, "none">,
): string {
  const match = currentVersion.match(SEMVER_PATTERN);
  if (!match) {
    throw new Error(
      `Invalid semantic version "${currentVersion}". Expected <major>.<minor>.<patch>.`,
    );
  }

  const [, majorRaw, minorRaw, patchRaw] = match;
  let major = Number(majorRaw);
  let minor = Number(minorRaw);
  let patch = Number(patchRaw);

  switch (bump) {
    case "major":
      major += 1;
      minor = 0;
      patch = 0;
      break;
    case "minor":
      minor += 1;
      patch = 0;
      break;
    case "patch":
      patch += 1;
      break;
  }

  return `${major}.${minor}.${patch}`;
}

export function parseGitLogMessages(gitLogOutput: string): string[] {
  return gitLogOutput
    .split("\x1e")
    .map((message) => message.trim())
    .filter(Boolean);
}

function isSemverTag(tag: string): boolean {
  return SEMVER_TAG_PATTERN.test(tag.trim());
}

async function runGit(args: string[], cwd: string): Promise<string> {
  const output = await new Deno.Command("git", {
    args,
    cwd,
    stdout: "piped",
    stderr: "piped",
  }).output();

  if (!output.success) {
    const stderr = new TextDecoder().decode(output.stderr).trim();
    throw new Error(
      `git ${args.join(" ")} failed with code ${output.code}: ${stderr}`,
    );
  }

  return new TextDecoder().decode(output.stdout);
}

async function getLatestSemverTag(cwd: string): Promise<string | null> {
  const output = await runGit(
    ["tag", "--merged", "HEAD", "--sort=-v:refname"],
    cwd,
  );
  const tag = output
    .split("\n")
    .map((line) => line.trim())
    .find((line) => isSemverTag(line));

  return tag ?? null;
}

async function getCommitMessagesSinceTag(
  latestTag: string | null,
  cwd: string,
): Promise<string[]> {
  const revisionRange = latestTag ? `${latestTag}..HEAD` : "HEAD";
  const output = await runGit(["log", "--format=%B%x1e", revisionRange], cwd);

  return parseGitLogMessages(output);
}

export async function readDenoVersion(configPath: string): Promise<string> {
  const text = await Deno.readTextFile(configPath);
  const config = JSON.parse(text) as DenoConfig;

  if (!config.version || typeof config.version !== "string") {
    throw new Error(`Missing "version" field in ${configPath}.`);
  }

  if (!SEMVER_PATTERN.test(config.version)) {
    throw new Error(
      `Invalid "version" field in ${configPath}: "${config.version}".`,
    );
  }

  return config.version;
}

export async function writeDenoVersion(
  configPath: string,
  nextVersion: string,
): Promise<void> {
  const text = await Deno.readTextFile(configPath);
  const config = JSON.parse(text) as DenoConfig;
  config.version = nextVersion;

  await Deno.writeTextFile(
    `${configPath}`,
    `${JSON.stringify(config, null, 2)}\n`,
  );
}

export async function computeRelease(
  repositoryPath = Deno.cwd(),
  denoConfigPath = `${Deno.cwd()}/deno.json`,
): Promise<ReleaseResult | null> {
  const currentVersion = await readDenoVersion(denoConfigPath);
  const previousTag = await getLatestSemverTag(repositoryPath);
  const commitMessages = await getCommitMessagesSinceTag(
    previousTag,
    repositoryPath,
  );
  const bump = determineVersionBump(commitMessages);

  if (bump === "none") {
    return null;
  }

  const nextVersion = incrementSemver(currentVersion, bump);
  return {
    bump,
    currentVersion,
    nextVersion,
    previousTag,
  };
}

if (import.meta.main) {
  const dryRun = Deno.args.includes("--dry-run");
  const release = await computeRelease();

  if (!release) {
    Deno.exit(0);
  }

  if (!dryRun) {
    await writeDenoVersion(`${Deno.cwd()}/deno.json`, release.nextVersion);
  }

  console.log(release.nextVersion);
}

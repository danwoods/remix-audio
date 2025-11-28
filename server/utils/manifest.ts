/** @file Utility to read Vite build manifest and get asset filenames */

/**
 * Get the actual filename for a built asset
 * Since Vite adds hashes to filenames, we need to find the actual file
 */
export async function getAssetFilename(
  baseName: string,
  extension: string,
): Promise<string> {
  const assetsDir = "./build/client/assets";

  try {
    // Try to read directory and find matching file
    const files = [];
    for await (const entry of Deno.readDir(assetsDir)) {
      if (
        entry.isFile &&
        entry.name.startsWith(baseName) &&
        entry.name.endsWith(extension)
      ) {
        files.push(entry.name);
      }
    }

    if (files.length > 0) {
      // Return the first match (should only be one)
      return `/build/client/assets/${files[0]}`;
    }
  } catch (error) {
    console.warn(`Could not read assets directory: ${error}`);
  }

  // Fallback to non-hashed filename
  return `/build/client/assets/${baseName}${extension}`;
}

/**
 * Get both JS and CSS filenames for the client bundle
 */
export async function getClientAssets(): Promise<{ js: string; css: string }> {
  const assetsDir = "./build/client/assets";
  let jsFile = "/build/client/assets/main.js"; // fallback
  let cssFile = "/build/client/assets/app.css"; // fallback

  try {
    // Find JS and CSS files
    for await (const entry of Deno.readDir(assetsDir)) {
      if (entry.isFile) {
        if (entry.name.startsWith("main") && entry.name.endsWith(".js")) {
          jsFile = `/build/client/assets/${entry.name}`;
        } else if (
          entry.name.startsWith("main") &&
          entry.name.endsWith(".css")
        ) {
          cssFile = `/build/client/assets/${entry.name}`;
        }
      }
    }
  } catch (error) {
    console.warn(`Could not read assets directory: ${error}`);
  }

  return { js: jsFile, css: cssFile };
}

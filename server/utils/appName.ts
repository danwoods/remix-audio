/** @file Utility to get app name from deno.json */

let cachedAppName: string | null = null;

/**
 * Get the app name from deno.json
 * Caches the result after first read
 */
export async function getAppName(): Promise<string> {
  if (cachedAppName) {
    return cachedAppName;
  }

  try {
    const denoJsonText = await Deno.readTextFile("deno.json");
    const denoJson = JSON.parse(denoJsonText);
    cachedAppName = denoJson.name || "Remix Audio"; // fallback
    return cachedAppName;
  } catch (error) {
    console.warn("Failed to read app name from deno.json:", error);
    return "Remix Audio"; // fallback
  }
}

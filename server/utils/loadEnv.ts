/** @file Load environment variables from .env file */

/**
 * Load environment variables from .env file
 * This is a simple implementation - for production, consider using a library
 */
export async function loadEnv(): Promise<void> {
  try {
    const envFile = await Deno.readTextFile(".env");
    const lines = envFile.split("\n");

    for (const line of lines) {
      // Skip empty lines and comments
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      // Parse KEY=VALUE format
      const equalIndex = trimmed.indexOf("=");
      if (equalIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, equalIndex).trim();
      let value = trimmed.slice(equalIndex + 1).trim();

      // Remove quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      // Only set if not already set (environment variables take precedence)
      if (!Deno.env.get(key)) {
        Deno.env.set(key, value);
      }
    }
  } catch (error) {
    // .env file is optional - if it doesn't exist, that's okay
    if ((error as Deno.errors.NotFound)?.name !== "NotFound") {
      console.warn("Failed to load .env file:", error);
    }
  }
}


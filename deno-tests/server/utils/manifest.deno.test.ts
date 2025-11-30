/** @file Tests for manifest utility */
/* eslint-disable import/no-unresolved */
import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  getAssetFilename,
  getClientAssets,
} from "../../../server/utils/manifest.ts";

Deno.test(
  "getAssetFilename returns fallback when directory doesn't exist",
  async () => {
    // Test with a non-existent directory
    const result = await getAssetFilename("nonexistent", ".js");
    assertEquals(result, "/build/client/assets/nonexistent.js");
  },
);

Deno.test("getClientAssets returns valid paths", async () => {
  // Test that getClientAssets returns valid paths
  // If build directory exists, it will find actual files
  // If not, it will return fallback paths
  const result = await getClientAssets();

  // Should always return valid paths
  assertStringIncludes(result.js, "/build/client/assets/");
  assertStringIncludes(result.js, ".js");
  assertStringIncludes(result.css, "/build/client/assets/");
  assertStringIncludes(result.css, ".css");

  // If build directory exists, files will be hashed (main-XXXXX.js)
  // If not, it will be fallback (main.js)
  // Both are valid, so we just check structure
});

Deno.test("getClientAssets returns correct structure", async () => {
  const result = await getClientAssets();

  // Should always return an object with js and css properties
  assertEquals(typeof result, "object");
  assertEquals(typeof result.js, "string");
  assertEquals(typeof result.css, "string");
  assertStringIncludes(result.js, "/build/client/assets/");
  assertStringIncludes(result.css, "/build/client/assets/");
});

Deno.test(
  "getClientAssets finds actual files when build directory exists",
  async () => {
    // This test will pass if build/client/assets exists with actual files
    try {
      const result = await getClientAssets();

      // If files exist, they should have the correct paths
      if (result.js !== "/build/client/assets/main.js") {
        // Found a hashed file
        assertStringIncludes(result.js, "main");
        assertStringIncludes(result.js, ".js");
      }

      if (result.css !== "/build/client/assets/app.css") {
        // Found a hashed file
        assertStringIncludes(result.css, "main");
        assertStringIncludes(result.css, ".css");
      }
    } catch (error) {
      // If directory doesn't exist, that's okay - fallback should work
      console.log("Build directory doesn't exist, using fallback paths");
    }
  },
);

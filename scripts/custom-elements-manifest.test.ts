/** @file Integration test for Custom Elements Manifest automation. */

import { assert, assertEquals } from "@std/assert";
import { checkCustomElementsManifest } from "./custom-elements-manifest.ts";

Deno.test("custom-elements manifest is current and includes key tags", async () => {
  const result = await checkCustomElementsManifest();

  assertEquals(
    result.isUpToDate,
    true,
    `Expected ${result.sourceManifestPath} to match a fresh analyzer output.`,
  );
  assert(
    result.tagNames.includes("nav-link"),
    "Expected the manifest to include the nav-link custom element tag.",
  );
  assert(
    result.tagNames.includes("album-image-custom-element"),
    "Expected the manifest to include the album-image-custom-element tag.",
  );
});

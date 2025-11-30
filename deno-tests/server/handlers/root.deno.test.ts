/** @file Tests for root route handler */
/* eslint-disable import/no-unresolved */
import { assertEquals, assertStringIncludes } from "@std/assert";
import { handleRoot } from "../../../server/handlers/root.ts";
import { loadEnv } from "../../../server/utils/loadEnv.ts";
import { getAppName } from "../../../server/utils/appName.ts";

Deno.test("Root handler returns HTML", async () => {
  // Load environment variables
  await loadEnv();

  const req = new Request("http://localhost:8000/");
  const response = await handleRoot(req);

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Content-Type"), "text/html");

  const html = await response.text();
  assertStringIncludes(html, "<html", "Should contain HTML structure");
  const appName = await getAppName();
  assertStringIncludes(
    html,
    appName,
    "Should contain app title from deno.json",
  );
});

Deno.test(
  "Root handler includes preconnect link when env vars are set",
  async () => {
    // Load environment variables
    await loadEnv();

    const req = new Request("http://localhost:8000/");
    const response = await handleRoot(req);
    const html = await response.text();

    const storageBucket = Deno.env.get("STORAGE_BUCKET");
    const storageRegion = Deno.env.get("STORAGE_REGION");

    if (storageBucket && storageRegion) {
      assertStringIncludes(
        html,
        `https://${storageBucket}.s3.${storageRegion}.amazonaws.com`,
        "Should include preconnect link when env vars are set",
      );
    } else {
      // If env vars not set, that's okay - just verify it doesn't crash
      assertStringIncludes(html, "<html", "Should still render HTML");
    }
  },
);

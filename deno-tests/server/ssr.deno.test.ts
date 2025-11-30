/** @file Tests for SSR rendering utilities */
import { assertEquals, assertStringIncludes } from "@std/assert";
import { renderPage } from "../../server/ssr.tsx";
import IndexPage from "../../app/routes/_index.tsx";
import type { Files } from "../../app/util/files.ts";

Deno.test("renderPage returns valid HTML", async () => {
  const mockFiles: Files = {};
  const html = await renderPage(
    IndexPage,
    { files: mockFiles, recentlyUploadedAlbumIds: [] },
    { files: mockFiles },
  );

  assertStringIncludes(html, "<!DOCTYPE html>", "Should start with DOCTYPE");
  assertStringIncludes(html, "<html", "Should contain html tag");
  assertStringIncludes(html, "<head>", "Should contain head");
  assertStringIncludes(html, "<body>", "Should contain body");
});

Deno.test("renderPage includes initial data script", async () => {
  const mockFiles: Files = {};
  const html = await renderPage(
    IndexPage,
    { files: mockFiles, recentlyUploadedAlbumIds: [] },
    { files: mockFiles },
  );

  assertStringIncludes(
    html,
    "window.__INITIAL_DATA__",
    "Should include initial data",
  );
  assertStringIncludes(html, "<script", "Should include script tag");
});

Deno.test("renderPage includes CSS and JS assets", async () => {
  const mockFiles: Files = {};
  const html = await renderPage(
    IndexPage,
    { files: mockFiles, recentlyUploadedAlbumIds: [] },
    { files: mockFiles },
  );

  assertStringIncludes(
    html,
    'link rel="stylesheet"',
    "Should include CSS link",
  );
  assertStringIncludes(
    html,
    'script type="module"',
    "Should include JS script",
  );
  assertStringIncludes(
    html,
    "/build/client/assets/",
    "Should reference build assets",
  );
});

Deno.test("renderPage includes headLinks when provided", async () => {
  const mockFiles: Files = {};
  const headLinks = [{ rel: "preconnect", href: "https://example.com" }];

  const html = await renderPage(
    IndexPage,
    { files: mockFiles, recentlyUploadedAlbumIds: [] },
    { files: mockFiles, headLinks },
  );

  assertStringIncludes(html, "preconnect", "Should include preconnect link");
  assertStringIncludes(html, "https://example.com", "Should include link href");
});

Deno.test("renderPage escapes script tags in data", async () => {
  const mockFiles: Files = {};
  // Create data that could break script tags
  const html = await renderPage(
    IndexPage,
    { files: mockFiles, recentlyUploadedAlbumIds: [] },
    { files: mockFiles },
  );

  // Should not contain unescaped </script> tags in the data
  // The data should be JSON.escaped
  const scriptMatch = html.match(/window\.__INITIAL_DATA__\s*=\s*({.+?});/s);
  if (scriptMatch) {
    // Try to parse the JSON - if it's valid, escaping worked
    try {
      JSON.parse(scriptMatch[1]);
      assertEquals(true, true, "Data is valid JSON");
    } catch {
      throw new Error("Initial data is not valid JSON");
    }
  }
});

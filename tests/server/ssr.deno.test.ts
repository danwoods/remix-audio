/** @file Tests for SSR rendering utilities */
import { assertEquals, assertStringIncludes } from "@std/assert";
import { isFragmentRequest, renderPage } from "../../server/ssr.ts";

Deno.test("isFragmentRequest returns true when X-Requested-With is fetch", () => {
  const req = new Request("http://localhost:8000/", {
    headers: { "X-Requested-With": "fetch" },
  });
  assertEquals(isFragmentRequest(req), true);
});

Deno.test("isFragmentRequest returns false when header is absent", () => {
  const req = new Request("http://localhost:8000/");
  assertEquals(isFragmentRequest(req), false);
});

Deno.test("isFragmentRequest returns false when header has other value", () => {
  const req = new Request("http://localhost:8000/", {
    headers: { "X-Requested-With": "xmlhttprequest" },
  });
  assertEquals(isFragmentRequest(req), false);
});

Deno.test("renderPage returns valid HTML", () => {
  const html = renderPage(
    {
      appName: "Test App",
      headLinks: [],
      pathname: "/",
      isAdmin: false,
    },
    ["<div>content</div>"],
  );

  assertStringIncludes(html, "<!DOCTYPE html>", "Should start with DOCTYPE");
  assertStringIncludes(html, "<html", "Should contain html tag");
  assertStringIncludes(html, "<head>", "Should contain head");
  assertStringIncludes(html, "<body>", "Should contain body");
});

Deno.test("renderPage includes CSS and JS assets", () => {
  const html = renderPage(
    {
      appName: "Test App",
      headLinks: [],
      pathname: "/",
      isAdmin: false,
    },
    [],
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
  assertStringIncludes(html, "/app.css", "Should reference app CSS");
  assertStringIncludes(
    html,
    "/build/main.js",
    "Should reference main JS bundle",
  );
  assertStringIncludes(html, 'rel="preload"', "Should preload main script");
  assertStringIncludes(html, 'as="script"', "Should preload as script");
});

Deno.test("renderPage includes headLinks when provided", () => {
  const headLinks = [{ rel: "preconnect", href: "https://example.com" }];

  const html = renderPage(
    {
      appName: "Test App",
      headLinks,
      pathname: "/",
      isAdmin: false,
    },
    [],
  );

  assertStringIncludes(html, "preconnect", "Should include preconnect link");
  assertStringIncludes(html, "https://example.com", "Should include link href");
});

Deno.test("renderPage includes children in main", () => {
  const content = '<div class="album-row">Album content</div>';
  const html = renderPage(
    {
      appName: "Test App",
      headLinks: [],
      pathname: "/",
      isAdmin: false,
    },
    [content],
  );

  assertStringIncludes(html, content, "Should include children in main");
  assertStringIncludes(html, "<main", "Should contain main element");
});

Deno.test("renderPage includes AppBar in layout", () => {
  /**
   * Every page uses the shared layout from ssr.ts, which includes the AppBar.
   * The AppBar renders the app name in a nav-link with class "text-xl font-bold".
   */
  const html = renderPage(
    {
      appName: "Test App",
      headLinks: [],
      pathname: "/",
      isAdmin: false,
    },
    [],
  );

  assertStringIncludes(
    html,
    "text-xl font-bold",
    "Should include AppBar app name link",
  );
  assertStringIncludes(html, "Test App", "Should include app name from AppBar");
});

Deno.test("renderPage includes upload dialog for admin requests", () => {
  /**
   * When isAdmin is true, the page must include the upload-dialog-custom-element
   * element so the upload button is visible to admins.
   */
  const html = renderPage(
    {
      appName: "Test App",
      headLinks: [],
      pathname: "/",
      isAdmin: true,
    },
    ["<div>content</div>"],
  );

  assertStringIncludes(html, "upload-dialog-custom-element");
});

Deno.test("renderPage includes playbar-custom-element", () => {
  const html = renderPage(
    {
      appName: "Test App",
      headLinks: [],
      pathname: "/",
      isAdmin: false,
    },
    [],
  );

  assertStringIncludes(html, "playbar-custom-element");
});

Deno.test("renderPage includes track-click script", () => {
  const html = renderPage(
    {
      appName: "Test App",
      headLinks: [],
      pathname: "/",
      isAdmin: false,
    },
    [],
  );

  assertStringIncludes(html, 'document.addEventListener("track-click"');
});

Deno.test("renderPage includes data-album-url on PlayBar when playbarAlbumUrl provided", () => {
  const albumUrl = "https://bucket.s3.region.amazonaws.com/artist/album";
  const html = renderPage(
    {
      appName: "Test App",
      headLinks: [],
      pathname: "/artists/artist/albums/album",
      isAdmin: false,
      playbarAlbumUrl: albumUrl,
    },
    [],
  );

  assertStringIncludes(html, 'data-album-url="');
  assertStringIncludes(html, albumUrl);
});

Deno.test("renderPage includes headExtra in head when provided", () => {
  const headExtra =
    '<meta property="og:image" content="https://example.com/cover.jpg" />';
  const html = renderPage(
    {
      appName: "Test App",
      headLinks: [],
      pathname: "/",
      isAdmin: false,
      headExtra,
    },
    [],
  );

  assertStringIncludes(html, "og:image");
  assertStringIncludes(html, "https://example.com/cover.jpg");
});

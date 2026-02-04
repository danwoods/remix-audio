/** @file Tests for SSR rendering utilities */
import { assertStringIncludes } from "@std/assert";
import { renderPage } from "../../server/ssr-plain.ts";

Deno.test("renderPage returns valid HTML", () => {
  const html = renderPage(
    {
      appName: "Test App",
      headLinks: [],
      assets: { css: "", js: "" },
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
      assets: { css: "", js: "" },
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
});

Deno.test("renderPage includes headLinks when provided", () => {
  const headLinks = [{ rel: "preconnect", href: "https://example.com" }];

  const html = renderPage(
    {
      appName: "Test App",
      headLinks,
      assets: { css: "", js: "" },
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
      assets: { css: "", js: "" },
      pathname: "/",
      isAdmin: false,
    },
    [content],
  );

  assertStringIncludes(html, content, "Should include children in main");
  assertStringIncludes(html, "<main", "Should contain main element");
});

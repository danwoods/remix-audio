/** @file Tests for plain SSR rendering utilities */
import { assertStringIncludes } from "@std/assert";
import { renderPage } from "../../server/ssr-plain.ts";

Deno.test("renderPage includes upload form for admin requests", () => {
  const html = renderPage(
    {
      appName: "Test App",
      headLinks: [],
      assets: { css: "", js: "" },
      pathname: "/",
      isAdmin: true,
    },
    ["<div>content</div>"],
  );

  assertStringIncludes(html, 'data-is-admin="true"');
  assertStringIncludes(html, 'enctype="multipart/form-data"');
  assertStringIncludes(html, 'name="files"');
});

/** @file Tests for plain SSR rendering utilities */
import { assertStringIncludes } from "@std/assert";
import { renderPage } from "../../server/ssr-plain.ts";

Deno.test("renderPage includes upload dialog for admin requests", () => {
  /**
   * When isAdmin is true, the page must include the upload-dialog-custom-element
   * element so the upload button is visible to admins.
   */
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

  assertStringIncludes(html, "upload-dialog-custom-element");
});

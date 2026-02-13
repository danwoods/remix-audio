/** @file Tests for app bar HTML function.
 *
 * Verifies that the upload button (upload-dialog-custom-element) is only present when the
 * user is logged in as admin (isAdmin: true).
 *
 * Uses linkedom to parse the returned HTML and assert on DOM structure.
 */

import { assertEquals, assertExists } from "@std/assert";
import { parseHTML } from "linkedom";
import appBarHtml from "./app-bar-html.ts";

// ============================================================================
// TEST HELPERS
// ============================================================================

/** Parses an HTML string into a document for DOM-based assertions. */
function parseHtmlFragment(html: string): Document {
  const { document } = parseHTML(
    `<!DOCTYPE html><html><head></head><body>${html}</body></html>`,
    "http://localhost:8000/",
  );
  return document;
}

// ============================================================================
// TESTS
// ============================================================================

Deno.test(
  "appBarHtml does not include upload button when isAdmin is false",
  () => {
    const html = appBarHtml({
      appName: "Remix Audio",
      pathname: "/",
      isAdmin: false,
    });

    const document = parseHtmlFragment(html);
    const uploadDialog = document.querySelector("upload-dialog-custom-element");

    assertEquals(
      uploadDialog,
      null,
      "Expected app bar HTML to omit upload-dialog-custom-element when isAdmin is false",
    );
  },
);

Deno.test(
  "appBarHtml includes upload button when isAdmin is true",
  () => {
    const html = appBarHtml({
      appName: "Remix Audio",
      pathname: "/",
      isAdmin: true,
    });

    const document = parseHtmlFragment(html);
    const uploadDialog = document.querySelector("upload-dialog-custom-element");

    assertExists(
      uploadDialog,
      "Expected app bar HTML to include upload-dialog-custom-element when isAdmin is true",
    );
  },
);

Deno.test(
  "appBarHtml uses nav-link for home with href and app name",
  () => {
    const html = appBarHtml({
      appName: "Remix Audio",
      pathname: "/",
      isAdmin: false,
    });

    const document = parseHtmlFragment(html);
    const navLink = document.querySelector('nav-link[href="/"]');

    assertExists(navLink, "Home link should be nav-link with href");
    assertEquals(
      navLink?.textContent?.trim(),
      "Remix Audio",
      "App name should be in link content",
    );
  },
);

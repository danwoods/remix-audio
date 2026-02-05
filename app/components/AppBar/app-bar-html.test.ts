/** @file Tests for app bar HTML function.
 *
 * Verifies that the upload button (upload-dialog-custom-element) is only present when the
 * user is logged in as admin (isAdmin: true).
 */
import { assert } from "@std/assert";
import appBarHtml from "./app-bar-html.ts";

Deno.test("appBarHtml does not include upload button when isAdmin is false", () => {
  /**
   * When the user is not logged in (isAdmin: false), the app bar must not
   * contain the upload-dialog-custom-element so the upload button is not visible.
   */
  const html = appBarHtml({
    appName: "Remix Audio",
    pathname: "/",
    isAdmin: false,
  });

  assert(
    !html.includes("upload-dialog-custom-element"),
    "Expected app bar HTML to omit upload-dialog-custom-element when isAdmin is false, but it was present",
  );
});

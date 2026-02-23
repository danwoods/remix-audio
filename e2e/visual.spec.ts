/** @file Visual regression tests.
 *
 * Uses Playwright's toHaveScreenshot() to compare against baseline images.
 * Run with `--update-snapshots` to update baselines when layout intentionally
 * changes.
 */
import { expect, test } from "@playwright/test";

test("index page visual baseline", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main")).toHaveScreenshot("index-main.png", {
    timeout: 10_000,
  });
});

test("album page visual baseline", async ({ page }) => {
  await page.goto("/artists/Test%20Artist/albums/Test%20Album");
  await expect(page.locator("main")).toHaveScreenshot("album-main.png", {
    timeout: 10_000,
  });
});

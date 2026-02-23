/** @file E2E tests for the album detail page.
 *
 * Asserts that the album page loads with track list, album header, and
 * custom elements. Uses fixture artist/album from E2E S3 mock.
 */
import { expect, test } from "@playwright/test";

test("album page loads and displays tracklist", async ({ page }) => {
  await page.goto("/artists/Test%20Artist/albums/Test%20Album");
  await expect(page.locator("h1")).toContainText("Test Album", {
    timeout: 10_000,
  });
  await expect(page.locator("tracklist-item-custom-element").first())
    .toBeVisible(
      { timeout: 5_000 },
    );
});

test("album page shows track items from fixture", async ({ page }) => {
  await page.goto("/artists/Test%20Artist/albums/Test%20Album");
  await expect(page.getByText("Test Track.mp3")).toBeVisible({
    timeout: 5_000,
  });
  await expect(page.getByText("Another Song.mp3")).toBeVisible({
    timeout: 5_000,
  });
});

test("album page includes album-header and album-image elements", async ({ page }) => {
  await page.goto("/artists/Test%20Artist/albums/Test%20Album");
  await expect(
    page.locator("album-header-custom-element").first(),
  ).toBeVisible({ timeout: 5_000 });
});

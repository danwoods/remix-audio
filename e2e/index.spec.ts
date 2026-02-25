/** @file E2E tests for the index (home) page.
 *
 * Asserts that the home page loads and displays the "Latest" album row with
 * fixture data (Test Artist / Test Album).
 */
import { expect, test } from "@playwright/test";

test("index page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Latest")).toBeVisible({ timeout: 10_000 });
});

test("index page shows Latest section with fixture album", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Latest")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Test Album")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText("Test Artist")).toBeVisible({ timeout: 5_000 });
});

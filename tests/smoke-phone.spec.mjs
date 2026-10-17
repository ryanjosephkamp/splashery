// Task 101: independent smoke checks, with original fixtures and assertions.
import { test, expect } from "@playwright/test";

import { watchConsole, loadApp, waitForToy } from "./smoke-helpers.mjs";

test.describe("Splashery on a phone", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
  });

  test("a panel opened while a toy from the grid is still loading stays open", async ({ page }) => {
    const problems = watchConsole(page);
    await loadApp(page);
    await waitForToy(page, "Cactus");
    // A slow download, like a scan on a phone.
    await page.route("**/assets/toys/horse-statue/**", async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.continue();
    });
    await page.tap("#sheet-handle");
    await expect(page.locator("body")).toHaveClass(/shelf-grid/);
    await page.tap('#shelf .toy-card[data-toy="horse-statue"]');
    await expect(page.locator("body")).not.toHaveClass(/shelf-grid/);
    // More, while the horse is still loading.
    await page.tap("#sheet-toggle");
    await expect(page.locator("#panel-body")).toBeVisible();
    await waitForToy(page, "Horse");
    await page.waitForTimeout(500);
    await expect(page.locator("#panel-body")).toBeVisible();
    await page.tap("#tab-look");
    await expect(page.locator("#tab-look")).toHaveAttribute("aria-selected", "true");
    expect(problems).toEqual([]);
  });

  test("has no horizontal overflow at 360px", async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 360, height: 740 },
      hasTouch: true,
      isMobile: true,
      reducedMotion: "reduce",
      colorScheme: "dark",
    });
    const page = await ctx.newPage();
    await loadApp(page);
    await waitForToy(page, "Cactus");
    const m = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      inner: window.innerWidth,
    }));
    expect(m.doc).toBeLessThanOrEqual(m.inner);
    await page.tap("#sheet-toggle");
    const m2 = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(m2).toBeLessThanOrEqual(360);
    // The shelf grid fits too.
    await page.tap("#sheet-toggle");
    await page.tap("#sheet-handle");
    await expect(page.locator("body")).toHaveClass(/shelf-grid/);
    const m3 = await page.evaluate(() => {
      const el = document.getElementById("shelf");
      return {
        doc: document.documentElement.scrollWidth,
        shelf: el.scrollWidth - el.clientWidth,
        cols: getComputedStyle(el).gridTemplateColumns.split(" ").length,
      };
    });
    expect(m3.doc).toBeLessThanOrEqual(360);
    expect(m3.shelf).toBeLessThanOrEqual(0);
    expect(m3.cols).toBeGreaterThanOrEqual(3);
    await ctx.close();
  });
});

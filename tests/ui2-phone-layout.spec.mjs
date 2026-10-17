// Task 101: independent UI cases retain their original viewports, renderer, and screenshots.
import { test, expect } from "@playwright/test";

import { PHONE, SHOTS, open, watchErrors, touchDrag, centerOf, stop } from "./ui2-helpers.mjs";

test.describe("phone", () => {
  test.use(PHONE);
  test("focus mode hides the sheet and the top bar; the corner button and a swipe up bring them back", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await open(page);
    await expect(page.locator("#focus-toggle")).toBeVisible();
    await page.screenshot({ path: new URL("ui2-row-390x844.png", SHOTS).pathname });
    await page.click("#focus-toggle");
    await expect(page.locator("body")).toHaveClass(/\bfocus\b/);
    for (const sel of ["#panel", ".brand", "#sound-toggle", "#view-reset", "#focus-toggle"])
      await expect(page.locator(sel)).toBeHidden();
    await expect(page.locator("#focus-exit")).toBeVisible();
    await page.waitForTimeout(500);
    const box = await page.locator("#stage").boundingBox();
    expect(box.height).toBeGreaterThan(830);
    await page.screenshot({ path: new URL("ui2-focus-390x844.png", SHOTS).pathname });
    // A swipe up from the bottom edge.
    await touchDrag(page, [
      [
        [195, 838],
        [195, 700],
      ],
    ]);
    await expect(page.locator("body")).not.toHaveClass(/\bfocus\b/);
    await expect(page.locator("#panel")).toBeVisible();
    // The corner button.
    await page.click("#focus-toggle");
    await page.click("#focus-exit");
    await expect(page.locator("#panel")).toBeVisible();
    await expect(page.locator(".brand")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("the sheet has five stops: hidden, row, grid, panel and full", async ({ page }) => {
    const errors = watchErrors(page);
    await open(page);
    expect(await stop(page)).toBe("row");
    const [hx, hy] = await centerOf(page, "#sheet-handle");
    // Swipe the handle down: hidden, and only the handle stays.
    await touchDrag(page, [
      [
        [hx, hy],
        [hx, hy + 80],
      ],
    ]);
    expect(await stop(page)).toBe("hidden");
    await expect(page.locator("#shelf")).toBeHidden();
    await expect(page.locator("#sheet-handle")).toBeVisible();
    const hiddenH = (await page.locator("#panel").boundingBox()).height;
    expect(hiddenH).toBeLessThan(60);
    await page.waitForTimeout(300);
    await page.screenshot({ path: new URL("ui2-hidden-390x844.png", SHOTS).pathname });
    // Swipe it up: the row again.
    const [h2x, h2y] = await centerOf(page, "#sheet-handle");
    await touchDrag(page, [
      [
        [h2x, h2y],
        [h2x, h2y - 80],
      ],
    ]);
    expect(await stop(page)).toBe("row");
    await expect(page.locator("#shelf")).toBeVisible();
    // Up again: the grid; the maximize button fills the screen with it.
    const [h3x, h3y] = await centerOf(page, "#sheet-handle");
    await touchDrag(page, [
      [
        [h3x, h3y],
        [h3x, h3y - 80],
      ],
    ]);
    expect(await stop(page)).toBe("grid");
    await page.click("#sheet-max");
    expect(await stop(page)).toBe("full");
    await expect(page.locator("body")).toHaveClass(/shelf-grid/);
    await page.waitForTimeout(300);
    const top = (await page.locator("#panel").boundingBox()).y;
    expect(top).toBeGreaterThan(140); // a strip of the toy still shows
    expect(top).toBeLessThan(200);
    await page.screenshot({ path: new URL("ui2-gallery-full-390x844.png", SHOTS).pathname });
    // More: the settings; the maximize button fills the screen with them.
    await page.click("#sheet-toggle");
    expect(await stop(page)).toBe("panel");
    await page.click("#sheet-max");
    expect(await stop(page)).toBe("full");
    await expect(page.locator("body")).toHaveClass(/sheet-open/);
    await expect(page.locator("#shelf")).toBeHidden();
    await expect(page.locator("#panes")).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({ path: new URL("ui2-settings-full-390x844.png", SHOTS).pathname });
    // Escape goes back to the row.
    await page.keyboard.press("Escape");
    expect(await stop(page)).toBe("row");
    expect(errors).toEqual([]);
  });
});

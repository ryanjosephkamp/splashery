// Task 101: independent UI cases retain their original viewports, renderer, and screenshots.
import { test, expect } from "@playwright/test";

import { DESK, SHOTS, open, pick, watchErrors, centerOf } from "./ui2-helpers.mjs";

test.describe("computer", () => {
  test.use(DESK);
  test("focus mode hides the panel and top bar, and Escape restores them", async ({ page }) => {
    const errors = watchErrors(page);
    await open(page);
    await page.keyboard.press("f");
    await expect(page.locator("#panel")).toBeHidden();
    await expect(page.locator(".brand")).toBeHidden();
    await expect(page.locator("#focus-exit")).toBeVisible();
    await page.waitForTimeout(400);
    expect((await page.locator("#stage").boundingBox()).width).toBe(1440);
    await page.screenshot({ path: new URL("ui2-focus-1440x900.png", SHOTS).pathname });
    await page.keyboard.press("Escape");
    await expect(page.locator("#panel")).toBeVisible();
    await expect(page.locator(".brand")).toBeVisible();
    await expect(page.locator("#focus-exit")).toBeHidden();
    // The button does the same.
    await page.click("#focus-toggle");
    await expect(page.locator("#panel")).toBeHidden();
    await page.click("#focus-exit");
    await expect(page.locator("#panel")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("the panel folds to an edge and comes back, and the gallery opens as a page", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await open(page);
    await page.screenshot({ path: new URL("ui2-desktop-1440x900.png", SHOTS).pathname });
    await page.keyboard.press("[");
    await expect(page.locator("#panel")).toBeHidden();
    await page.waitForTimeout(400);
    expect((await page.locator("#stage").boundingBox()).width).toBeGreaterThan(1400);
    await expect(page.locator("#panel-fold")).toBeVisible();
    await page.screenshot({ path: new URL("ui2-folded-1440x900.png", SHOTS).pathname });
    // Remembered after a reload.
    await page.reload();
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await expect(page.locator("#panel")).toBeHidden();
    await page.click("#panel-fold");
    await expect(page.locator("#panel")).toBeVisible();
    // The panel's edge still sets its width.
    const grip = page.locator(".grip-panel");
    const g = await grip.boundingBox();
    await page.mouse.move(g.x + 4, g.y + g.height / 2);
    await page.mouse.down();
    await page.mouse.move(g.x - 150, g.y + g.height / 2, { steps: 5 });
    await page.mouse.up();
    expect((await page.locator("#panel").boundingBox()).width).toBeGreaterThan(470);
    // The gallery page covers the stage; Escape closes it; a pick closes it.
    await page.click("#gallery-open");
    await expect(page.locator("body")).toHaveClass(/gallery-page/);
    const pb = await page.locator("#panel").boundingBox();
    expect(pb.x).toBeLessThan(20);
    expect(pb.width).toBeGreaterThan(1380);
    await page.waitForTimeout(300);
    await page.screenshot({ path: new URL("ui2-gallery-1440x900.png", SHOTS).pathname });
    await page.keyboard.press("Escape");
    await expect(page.locator("body")).not.toHaveClass(/gallery-page/);
    await page.click("#gallery-open");
    await page.click(".toy-card[data-toy='donut']");
    await expect(page.locator("body")).not.toHaveClass(/gallery-page/);
    await page.waitForFunction(() => window.__splashery.app.player.scene.toy.id === "donut");
    expect(errors).toEqual([]);
  });

  test("Shift-drag moves the toy within reach, Reset centers it, and a link keeps the move", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await open(page);
    await pick(page, "donut");
    const cam = () => page.evaluate(() => window.__splashery.app.player.camera.getState());
    const [x, y] = await centerOf(page, "#stage");
    const start = await cam();
    await page.keyboard.down("Shift");
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 120, y + 40, { steps: 8 });
    await page.mouse.up();
    await page.keyboard.up("Shift");
    const moved = await cam();
    expect(moved.pan).toBeDefined();
    expect(Math.abs(moved.yaw - start.yaw)).toBeLessThan(0.02); // it moved, it didn't turn
    await page.waitForTimeout(400);
    await page.screenshot({ path: new URL("ui2-pan-1440x900.png", SHOTS).pathname });
    // A long drag stays within reach of the toy.
    await page.keyboard.down("Alt");
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 3000, y - 3000, { steps: 10 });
    await page.mouse.up();
    await page.keyboard.up("Alt");
    const far = await cam();
    expect(Math.max(...far.pan.map(Math.abs))).toBeLessThanOrEqual(1);
    // A link keeps the move.
    const link = await page.evaluate(() => window.__splashery.app.copyLink());
    const scene = await page.evaluate(() => window.__splashery.exportScene());
    expect(scene.camera.pan).toEqual(far.pan);
    const page2 = await page.context().newPage();
    await open(page2, "", new URL(link).hash);
    await page2.waitForFunction(() => window.__splashery.app.player.scene.toy.id === "donut");
    expect((await page2.evaluate(() => window.__splashery.app.player.camera.getState())).pan).toEqual(far.pan); // prettier-ignore
    // R puts it back in the middle.
    await page2.close();
    await page.bringToFront();
    await page.locator("#stage").focus();
    await page.keyboard.press("r");
    expect((await cam()).pan).toBeUndefined();
    // The view eases back to the toy's center.
    await page.waitForFunction(() => {
      const c = window.__splashery.app.player.camera;
      return c.target.every((v, i) => Math.abs(v - c.center[i]) < 1e-3);
    });
    expect(errors).toEqual([]);
  });
});

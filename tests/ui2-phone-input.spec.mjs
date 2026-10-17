// Task 101: independent UI cases retain their original viewports, renderer, and screenshots.
import { test, expect } from "@playwright/test";

import {
  PHONE,
  SHOTS,
  open,
  pick,
  watchErrors,
  touchDrag,
  stop,
  drawOnPad,
  padCells,
  cnnReads,
} from "./ui2-helpers.mjs";

test.describe("phone", () => {
  test.use(PHONE);
  test("the CNN opens its settings at the full stop, the pad fits whole, and it reads a drawn 3 and 7", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await open(page);
    await pick(page, "cnn");
    await page.click("#sheet-toggle");
    expect(await stop(page)).toBe("full");
    await expect(page.locator("#toy-input-pad-fine")).toHaveAttribute("aria-pressed", "true");
    // The pad and its buttons fit on the screen once scrolled to.
    await page.locator("#toy-input-pad-go").scrollIntoViewIfNeeded();
    const pad = await page.locator("#toy-input-pad").boundingBox();
    const go = await page.locator("#toy-input-pad-go").boundingBox();
    expect(go.y + go.height - pad.y).toBeLessThan(844 - 190);
    expect(pad.y).toBeGreaterThan(150);
    const DIGITS = {
      3: [[[0.22, 0.14], [0.6, 0.12], [0.76, 0.24], [0.66, 0.42], [0.42, 0.48], [0.66, 0.54], [0.78, 0.7], [0.66, 0.86], [0.24, 0.88]]], // prettier-ignore
      7: [
        [
          [0.18, 0.14],
          [0.82, 0.14],
          [0.62, 0.45],
          [0.46, 0.9],
        ],
      ],
    };
    for (const [digit, strokes] of Object.entries(DIGITS)) {
      await page.click("#toy-input-pad-clear");
      await drawOnPad(page, strokes);
      const cells = await padCells(page);
      // The fine pen leaves a thin line, not a blob.
      expect(cells.filter((v) => v > 0).length).toBeLessThan(40);
      expect(cnnReads(`pad:${cells.join(",")}`), `a drawn ${digit}`).toBe(Number(digit));
      if (digit === "3")
        await page.screenshot({ path: new URL("ui2-cnn-pad-390x844.png", SHOTS).pathname });
    }
    // A real downward stroke on the pad draws; it doesn't close the sheet.
    const box = await page.locator("#toy-input-pad").boundingBox();
    await touchDrag(page, [
      [
        [box.x + box.width * 0.5, box.y + box.height * 0.05],
        [box.x + box.width * 0.5, box.y + box.height * 0.95],
      ],
    ]);
    expect(await stop(page)).toBe("full");
    expect(errors).toEqual([]);
  });

  test("two fingers moving together move the toy; a pinch still zooms; Reset centers it", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await open(page);
    await pick(page, "donut");
    const before = await page.evaluate(() => window.__splashery.app.player.camera.getState());
    expect(before.pan).toBeUndefined();
    await touchDrag(page, [
      [
        [150, 300],
        [230, 360],
      ],
      [
        [230, 300],
        [310, 360],
      ],
    ]);
    const after = await page.evaluate(() => window.__splashery.app.player.camera.getState());
    expect(after.pan).toBeDefined();
    expect(Math.hypot(...after.pan)).toBeGreaterThan(0.1);
    // Turning is still one finger's: the yaw did not change with the move.
    expect(Math.abs(after.yaw - before.yaw)).toBeLessThan(0.05);
    await page.click("#view-reset");
    await page.waitForTimeout(600);
    const reset = await page.evaluate(() => window.__splashery.app.player.camera.getState());
    expect(reset.pan).toBeUndefined();
    expect(errors).toEqual([]);
  });
});

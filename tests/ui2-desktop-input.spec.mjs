// Task 101: independent UI cases retain their original viewports, renderer, and screenshots.
import { test, expect } from "@playwright/test";

import { encodeSceneHash } from "../src/codec.js";

import { DESK, open, pick, watchErrors, drawOnPad, padCells } from "./ui2-helpers.mjs";

test.describe("computer", () => {
  test.use(DESK);
  test("the pad inks by distance, not by events, and the eraser clears", async ({ page }) => {
    const errors = watchErrors(page);
    await open(page);
    await pick(page, "cnn");
    await expect(page.locator("#toy-input-pad-medium")).toHaveAttribute("aria-pressed", "true");
    const line = [
      [
        [0.15, 0.45],
        [0.85, 0.55],
      ],
    ];
    const sum = (c) => c.reduce((a, b) => a + b, 0);
    await page.click("#toy-input-pad-clear");
    await drawOnPad(page, line, 60); // slow: many small moves
    const slow = await padCells(page);
    await page.click("#toy-input-pad-clear");
    await drawOnPad(page, line, 4); // fast: a few long moves
    const fast = await padCells(page);
    expect(sum(slow)).toBeGreaterThan(40);
    expect(Math.abs(sum(slow) - sum(fast)) / sum(slow)).toBeLessThan(0.15);
    expect(Math.abs(slow.filter((v) => v > 0).length - fast.filter((v) => v > 0).length)).toBeLessThanOrEqual(2); // prettier-ignore
    // The fine pen draws thinner than the bold one.
    await page.click("#toy-input-pad-clear");
    await page.click("#toy-input-pad-fine");
    await drawOnPad(page, line);
    const fine = await padCells(page);
    await page.click("#toy-input-pad-clear");
    await page.click("#toy-input-pad-bold");
    await drawOnPad(page, line);
    const bold = await padCells(page);
    expect(fine.filter((v) => v > 0).length).toBeLessThan(bold.filter((v) => v > 0).length);
    // The eraser, run over the line, takes the ink away.
    await page.click("#toy-input-pad-erase");
    await expect(page.locator("#toy-input-pad-erase")).toHaveAttribute("aria-pressed", "true");
    await drawOnPad(page, line);
    await drawOnPad(page, line);
    // An empty pad can't be read (the toy asks for a digit), so count the
    // lit cells on the pad itself.
    const raw = await page.evaluate(() => {
      const c = document.querySelector("#toy-input-pad");
      const g = c.getContext("2d");
      const w = c.width / 8;
      let lit = 0;
      for (let j = 0; j < 8; j++)
        for (let i = 0; i < 8; i++) {
          const d = g.getImageData(i * w + w / 2, j * w + w / 2, 1, 1).data;
          if (d[0] > 40) lit++;
        }
      return lit;
    });
    expect(raw).toBe(0);
    expect(errors).toEqual([]);
  });

  test("an old version 2 link with a camera loads exactly as before, centered", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    const hash = await encodeSceneHash({
      app: "splashery",
      version: 2,
      seed: 12,
      toy: { kind: "builtin", id: "donut" },
      camera: { yaw: 1.2, pitch: 0.4, roll: 0, distance: 4 },
      effects: { twist: { on: true, amount: 0.4, wobble: 0, axis: "y" } },
      autoplay: { turntable: false, effect: "none" },
    });
    await open(page, "", `#s=${hash}`);
    await page.waitForFunction(() => window.__splashery.app.player.scene.toy.id === "donut");
    const s = await page.evaluate(() => window.__splashery.exportScene());
    expect(s.version).toBe(3);
    expect(s.camera).toEqual({ yaw: 1.2, pitch: 0.4, roll: 0, distance: 4 });
    expect(s.effects.twist).toMatchObject({ on: true, amount: 0.4 });
    const off = await page.evaluate(() => {
      const c = window.__splashery.app.player.camera;
      return c.aim.map((v, i) => Math.abs(v - c.center[i]));
    });
    expect(Math.max(...off)).toBe(0);
    expect(errors).toEqual([]);
  });

  test("the laptop still takes F as typing", async ({ page }) => {
    const errors = watchErrors(page);
    await open(page);
    await page.click(".toy-card[data-toy='laptop']");
    await page.waitForFunction(
      () => window.__splashery.player.toyInfo?.id === "laptop" && !!window.__splashery.player.toyInfo.recipe?.typeKey, // prettier-ignore
      null,
      { timeout: 120_000 },
    );
    await page.locator("#stage").focus();
    await page.keyboard.press("f");
    await page.waitForTimeout(300);
    await expect(page.locator("body")).not.toHaveClass(/\bfocus\b/);
    await expect(page.locator("#panel")).toBeVisible();
    expect(errors).toEqual([]);
  });
});

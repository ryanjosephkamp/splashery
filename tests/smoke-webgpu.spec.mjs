// Task 101: independent smoke checks, with original fixtures and assertions.
import { test, expect } from "@playwright/test";

import {
  NO_WEBGPU,
  watchConsole,
  loadApp,
  waitForToy,
  countDifferentPixels,
} from "./smoke-helpers.mjs";

test.describe("Splashery on WebGPU", () => {
  test.use({ viewport: { width: 1000, height: 700 }, reducedMotion: "reduce" });

  test("auto picks WebGPU when an adapter exists and effects render", async ({ page }) => {
    // navigator.gpu only exists in a secure context, so probe from the site.
    await page.goto("/LICENSES.md");
    const hasAdapter = await page.evaluate(async () => {
      if (!navigator.gpu) return false;
      try {
        return !!(await navigator.gpu.requestAdapter());
      } catch {
        return false;
      }
    });
    test.skip(!hasAdapter, NO_WEBGPU);
    const problems = watchConsole(page);
    const renderer = await loadApp(page, "/?profile=weak&labs=1&first-toy=cactus");
    expect(renderer).toBe("webgpu");
    await page.click(".toy-card[data-toy='blob']");
    await waitForToy(page, "Jelly blob");
    await page.evaluate(() => window.__splashery.app.setEffectParam("twist", "wobble", 0));
    const canvas = page.locator("#stage");
    const before = await canvas.screenshot({ type: "png" });
    await page.click("#tab-tools");
    await page.click("#fx-twist");
    await page.waitForTimeout(2500);
    const after = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, before, after)).toBeGreaterThan(3000);
    // The kit shader variant (parts, behaviors) and the pattern layer on WebGPU.
    await page.click(".toy-card[data-toy='chest']");
    await waitForToy(page, "Treasure chest");
    const closed = await canvas.screenshot({ type: "png" });
    await page.click("#tab-play");
    await page.click("#toy-action");
    await page.evaluate(() => window.__splashery.app.setPattern({ id: "flag", flag: "br" }));
    await page.waitForTimeout(2000);
    const open = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, closed, open)).toBeGreaterThan(3000);
    expect(problems).toEqual([]);
  });
});

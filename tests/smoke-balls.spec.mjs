// Task 101: independent smoke checks, with original fixtures and assertions.
import { test, expect } from "@playwright/test";

import { TOYS } from "../src/toys.js";

import { watchConsole, loadApp, waitForToy, countDifferentPixels } from "./smoke-helpers.mjs";

test.describe("Sports balls (WebGL2)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  async function darkPixels(page) {
    const shot = await page.locator("#stage").screenshot({ type: "png" });
    return page.evaluate(async (b64) => {
      const res = await fetch(`data:image/png;base64,${b64}`);
      const bmp = await createImageBitmap(await res.blob());
      const c = document.createElement("canvas");
      c.width = bmp.width;
      c.height = bmp.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(bmp, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] < 60 && d[i + 1] < 60 && d[i + 2] < 60) n++;
      return n;
    }, shot.toString("base64"));
  }

  test("a ball in a country's colours keeps its seams", async ({ page }) => {
    const problems = watchConsole(page);
    await loadApp(page);
    await page.click(".chip[data-category='balls']");
    await expect(page.locator("#shelf .toy-card")).toHaveCount(
      TOYS.filter((t) => t.category === "balls").length,
    );
    await page.click(".toy-card[data-toy='basketball']");
    await waitForToy(page, "Basketball");
    const seams = await darkPixels(page);
    expect(seams).toBeGreaterThan(800);
    const canvas = page.locator("#stage");
    const before = await canvas.screenshot({ type: "png" });
    await page.waitForFunction(() => document.querySelectorAll("#toy-flag option").length > 150);
    await page.selectOption("#toy-flag", "us");
    await expect(page.locator("#toy-status")).toContainText("in the colors of the United States");
    await page.waitForTimeout(1200);
    const after = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, before, after)).toBeGreaterThan(8000);
    // The seams stay dark under the flag.
    expect(await darkPixels(page)).toBeGreaterThan(seams * 0.6);
    const scene = await page.evaluate(() => window.__splashery.exportScene());
    expect(scene.pattern).toMatchObject({ id: "flag", flag: "us" });
    expect(problems).toEqual([]);
  });
});

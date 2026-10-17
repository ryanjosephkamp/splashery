// Task 101: independent smoke groups can run on separate suite shards.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { makePly, makeSplat, makeSpz } from "./fixtures.mjs";
import { TOYS, CATEGORIES, searchToys } from "../src/toys.js";
import { encodeSceneHash } from "../src/codec.js";

import {
  SHOTS,
  ORIGIN,
  WEBGL,
  NO_WEBGPU,
  watchConsole,
  loadApp,
  waitForToy,
  cameraStill,
  countDifferentPixels,
  inkPixels,
} from "./smoke-helpers.mjs";

test.describe("Sports balls (WebGL2)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // Near-black pixels in the stage (the basketball's seams).
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

  test("ball screenshots at 1440x900 and 390x844", async ({ browser }) => {
    fs.mkdirSync(SHOTS, { recursive: true });
    const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await desk.newPage();
    await loadApp(page);
    await page.click(".chip[data-category='balls']");
    await page.click(".toy-card[data-toy='soccer-ball']");
    await waitForToy(page, "Soccer ball");
    await page.evaluate(() => window.__splashery.app.setPattern({ id: "flag", flag: "br" }));
    await expect(page.locator("#toy-status")).toContainText("Brazil");
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SHOTS, "balls-1440x900.png") });
    await desk.close();
    const phone = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const p2 = await phone.newPage();
    await loadApp(p2);
    await p2.tap(".chip[data-category='balls']");
    await p2.tap(".toy-card[data-toy='basketball']");
    await waitForToy(p2, "Basketball");
    await p2.evaluate(() => window.__splashery.app.setPattern({ id: "flag", flag: "us" }));
    await expect(p2.locator("#toy-status")).toContainText("United States");
    await p2.waitForTimeout(1500);
    await p2.screenshot({ path: path.join(SHOTS, "balls-390x844.png") });
    await phone.close();
  });
});

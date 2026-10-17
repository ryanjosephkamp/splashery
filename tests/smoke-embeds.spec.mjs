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

test.describe("Sharpness and embeds (WebGL2)", () => {
  test.use({ reducedMotion: "reduce" });

  // Canvas backing pixels = CSS pixels x min(device pixel ratio, tier cap).
  // The mid and high caps are 3 since September 29, 2026; ?sharp=0 puts back 2.
  for (const [scale, tier, ratio, query] of [
    [2, "high", 2, ""],
    [3, "mid", 3, ""],
    [3, "mid", 2, "&sharp=0"],
    [3, "max", 3, ""],
    [3, "low", 1.5, ""],
  ]) {
    const how = query ? " with ?sharp=0" : "";
    test(`the canvas renders at ${ratio}x on a ${scale}x screen at the ${tier} tier${how}`, async ({
      browser,
    }) => {
      const ctx = await browser.newContext({
        viewport: { width: 400, height: 300 },
        deviceScaleFactor: scale,
        reducedMotion: "reduce",
      });
      const page = await ctx.newPage();
      await page.goto(`/embed/?toy=blob&renderer=webgl2&profile=${tier}${query}`);
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      const size = () =>
        page.evaluate(() => {
          const c = window.__splashery.player.stage.canvas;
          return [c.width, c.height, c.clientWidth, c.clientHeight];
        });
      await expect
        .poll(async () => {
          const [w, h, cw, ch] = await size();
          return Math.abs(w - cw * ratio) <= 1 && Math.abs(h - ch * ratio) <= 1;
        })
        .toBe(true);
      if (tier === "mid") {
        // Slow frames during a drag drop the ratio; the still view gets it back.
        const reduced = await page.evaluate(() => {
          const s = window.__splashery.player.stage;
          s.skipFrames = 0;
          s.setBusy(true, true);
          for (let i = 0; i < 12; i++) s.timeFrame(40);
          return s.canvas.width / s.canvas.clientWidth;
        });
        expect(reduced).toBeLessThan(ratio);
        expect(reduced).toBeGreaterThanOrEqual(1);
        await expect
          .poll(async () => {
            const [w, , cw] = await size();
            return Math.abs(w - cw * ratio) <= 1;
          })
          .toBe(true);
      }
      await ctx.close();
    });
  }

  test("Detail: High raises the tier, stays in this browser and stays out of links", async ({
    page,
  }) => {
    await loadApp(page, "/?renderer=webgl2&adapt=off&first-toy=cactus");
    await waitForToy(page, "Cactus");
    // Detail is on the Toy tab (shown first).
    await page.click("#tab-play");
    await page.click("#look-detail button[data-detail='high']");
    await expect.poll(() => page.evaluate(() => window.__splashery.player.profile)).toBe("high");
    await expect(page.locator("#look-detail button[data-detail='high']")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await page.evaluate(() => localStorage.getItem("splashery.detail"))).toBe("high");
    const scene = JSON.stringify(await page.evaluate(() => window.__splashery.exportScene()));
    expect(scene).not.toMatch(/profile|"detail":"|"high"/);
    await page.reload();
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    expect(await page.evaluate(() => window.__splashery.player.profile)).toBe("high");
    await page.click("#look-detail button[data-detail='auto']");
    expect(await page.evaluate(() => localStorage.getItem("splashery.detail"))).toBe(null);
  });

  test("a transparent embed stays transparent on a dark-mode page", async ({ browser }) => {
    // A host that supports dark mode itself, with today's snippet, and a
    // plain host with the older snippet's color-scheme:normal.
    for (const [meta, scheme] of [
      ['<meta name="color-scheme" content="light dark">', "light"],
      ["", "normal"],
    ]) {
      const ctx = await browser.newContext({
        viewport: { width: 480, height: 360 },
        colorScheme: "dark",
        reducedMotion: "reduce",
      });
      const page = await ctx.newPage();
      await page.setContent(
        `<!doctype html>${meta}<body style="margin:0;background:#dd2222">` +
          `<iframe src="${ORIGIN}/embed/?bg=transparent&toy=blob&renderer=webgl2" ` +
          `style="width:400px;height:300px;border:0;color-scheme:${scheme}"></iframe></body>`,
      );
      const frame = page.frameLocator("iframe");
      await expect(frame.locator("body[data-ready='true']")).toHaveCount(1, { timeout: 180_000 });
      await page.waitForTimeout(1500);
      const png = PNG.sync.read(await page.screenshot());
      // The empty left edge of the iframe: the host's red shows through.
      for (const [x, y] of [
        [12, 150],
        [12, 40],
      ]) {
        const i = (y * png.width + x) * 4;
        const [r, g, b] = png.data.subarray(i, i + 3);
        expect({ scheme, x, y, red: r > 190 && g < 70 && b < 70 }).toEqual({
          scheme,
          x,
          y,
          red: true,
        });
      }
      await ctx.close();
    }
  });

  test("embeds frame the toy closer, take ?zoom= and zoom with buttons and the wheel", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 400, height: 300 });
    const open = async (query) => {
      await page.goto(`/embed/?toy=blob&renderer=webgl2&profile=low${query}`);
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    };
    const distance = () =>
      page.evaluate(() => window.__splashery.player.camera.getState().distance);
    await open("&zoom=2");
    expect(await distance()).toBeCloseTo(1.9, 3);
    await open("&zoom=99&controls=0");
    expect(await distance()).toBeCloseTo(1.9, 3);
    await expect(page.locator("#zoom-buttons")).toBeHidden();
    await open("");
    const start = await distance();
    expect(start).toBeCloseTo(3.8, 3);

    // The page scrolls under a plain wheel until the toy is clicked.
    const box = await page.locator("#stage").boundingBox();
    await page.mouse.move(box.x + 30, box.y + box.height / 2);
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(200);
    expect(await distance()).toBe(start);
    await expect(page.locator("#embed-status")).toHaveText("Pinch or Ctrl+scroll to zoom");
    await page.mouse.click(box.x + 30, box.y + box.height / 2);
    await page.mouse.wheel(0, -300);
    await expect.poll(distance).toBeLessThan(start);
    // Leaving the toy gives the wheel back to the page.
    await page.evaluate(() =>
      document.getElementById("stage").dispatchEvent(new PointerEvent("pointerleave")),
    );
    const after = await distance();
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(200);
    expect(await distance()).toBe(after);

    await page.click("#zoom-buttons button[data-zoom='-1']");
    await expect.poll(distance).toBeGreaterThan(after);

    // The canvas follows the frame when it is resized.
    await page.setViewportSize({ width: 320, height: 240 });
    await expect.poll(() => page.evaluate(() => document.getElementById("stage").width)).toBe(320);
  });

  test("the embed snippet is responsive and has a size picker", async ({ page }) => {
    await loadApp(page);
    await waitForToy(page, "Cactus");
    await page.click("#tab-share");
    const snippet = page.locator("#embed-snippet");
    await expect(snippet).toHaveValue(
      /^<iframe src="[^"]+" title="Splashery toy" loading="lazy" style="width:100%;max-width:600px;aspect-ratio:4\/3;border:0;border-radius:12px"><\/iframe>$/,
    );
    expect(await snippet.inputValue()).not.toMatch(/ (width|height)="/);
    await expect(page.locator("#element-snippet")).toHaveValue(/max-width:600px;aspect-ratio:4\/3/);
    await page.selectOption("#embed-size", "full");
    await expect(snippet).toHaveValue(/style="width:100%;aspect-ratio:4\/3;border:0/);
    await page.selectOption("#embed-size", "small");
    await page.check("#embed-transparent");
    await expect(snippet).toHaveValue(/\/embed\/\?bg=transparent#s=/);
    await expect(snippet).toHaveValue(/max-width:360px;.*;color-scheme:light"/);
  });

  test("a shelf thumbnail that fails is fetched once more, then shows a plain tile", async ({
    page,
  }) => {
    await loadApp(page);
    const [first, second] = await page.evaluate(() =>
      [...document.querySelectorAll(".toy-card")].slice(0, 2).map((b) => b.dataset.toy),
    );
    await page.route("**/assets/toys/*/thumb.webp*", (route) => {
      const url = route.request().url();
      if (url.includes(`/${second}/`)) return route.abort();
      if (url.includes(`/${first}/`) && !url.includes("retry=")) return route.abort();
      return route.continue();
    });
    await page.reload();
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    const img = page.locator(`.toy-card[data-toy='${first}'] img`);
    await expect(img).toHaveAttribute("src", /retry=/);
    await expect.poll(() => img.evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);
    await expect(page.locator(`.toy-card[data-toy='${second}'] span.thumb`)).toHaveCount(1);
  });
});

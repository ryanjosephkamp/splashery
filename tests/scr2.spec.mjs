// Lane Screens r2 (docs/handoff/ScreensR2.md): the Screen switches off for
// real. While it is off (or the curtains are closed) nothing of the picture
// shows, a GIF holds its frame and a video pauses; a tap on the set's switch
// switches it off, a tap on the picture plays and pauses; every style builds
// within its tier's budget; and the lane's screenshots.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { PNG } from "pngjs";
import { buildRecipe } from "../src/kit.js";
import { applyClay, PROFILES } from "../src/generators.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";

async function openScreen(page, options, size = { width: 390, height: 844 }) {
  await page.setViewportSize(size);
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(async (options) => {
    const { app } = window.__splashery;
    await app.chooseToy("screen");
    await app.setToyOptions(options);
  }, options);
  // The picture is built even while hidden (the set starts switched off).
  await page.waitForFunction(
    () => {
      const p = window.__splashery.player.pictures;
      window.__splashery.player.stage.requestRender();
      return !!p?.media && p.api.ready("screen");
    },
    null,
    { timeout: 120_000 },
  );
}

// Waits until `s` seconds of the player's clock have passed since the last
// tap (the switching runs on that clock).
async function settle(page, s) {
  await page.waitForFunction(
    (s) => {
      const pl = window.__splashery.player;
      pl.stage.requestRender();
      return pl.time - (pl.motion.tap?.time ?? 0) > s;
    },
    s,
    { timeout: 120_000 },
  );
}

// A tap on the toy at a point in the recipe's coordinates, as a real
// pointer tap on the canvas.
async function tapAt(page, point) {
  const [x, y] = await page.evaluate((p) => window.__splashery.player.screenPoint(p), point);
  await page.evaluate(() => (window.__splashery.player.pickDirty = true));
  const n = await page.evaluate(() => window.__splashery.player.motion.tap?.n ?? 0);
  await page.mouse.click(x, y);
  await page.waitForFunction((n) => (window.__splashery.player.motion.tap?.n ?? 0) > n, n);
}

// The screen area's pixels (a box round the whole picture sheet), after a
// few quiet frames.
async function screenPixels(page) {
  const box = await page.evaluate(() => {
    const { player } = window.__splashery;
    const pics = player.pictures;
    const sh = pics.sheets[0];
    const { c, hw, hh } = pics.rect(sh, 0);
    const pts = [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ].map(([a, b]) =>
      player.stage.toScreen([0, 1, 2].map((i) => c[i] + sh.x[i] * a * hw + sh.y[i] * b * hh)),
    );
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    // Only the stage: not under the side panel (at the desktop size).
    const panel = document.getElementById("panel").getBoundingClientRect();
    const right = panel.top < 100 && panel.left > 300 ? panel.left - 4 : window.innerWidth;
    return {
      x: Math.max(0, Math.min(...xs)),
      y: Math.max(0, Math.min(...ys)),
      x1: Math.min(right, Math.max(...xs)),
      y1: Math.min(window.innerHeight, Math.max(...ys)),
    };
  });
  await page.waitForTimeout(400);
  // (The splat count under the stage counts the picture's splats too.)
  await page.evaluate(() => (document.getElementById("toy-status").style.visibility = "hidden"));
  const shot = await page.screenshot({
    clip: { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.x1 - box.x), height: Math.round(box.y1 - box.y) }, // prettier-ignore
  });
  return PNG.sync.read(shot);
}

function difference(a, b) {
  expect([a.width, a.height]).toEqual([b.width, b.height]);
  let worst = 0;
  let count = 0;
  const box = [1e9, 1e9, -1, -1];
  for (let i = 0; i < a.data.length; i += 4)
    for (let k = 0; k < 3; k++) {
      const d = Math.abs(a.data[i + k] - b.data[i + k]);
      worst = Math.max(worst, d);
      if (d > 3) {
        count++;
        const x = (i / 4) % a.width;
        const y = Math.floor(i / 4 / a.width);
        box[0] = Math.min(box[0], x);
        box[1] = Math.min(box[1], y);
        box[2] = Math.max(box[2], x);
        box[3] = Math.max(box[3], y);
      }
    }
  return { worst, count, pixels: a.width * a.height, size: [a.width, a.height], box };
}

const ON_TIME = { tv: 1.5, flat: 1.4, cinema: 1.9, hologram: 1.5 };
const OFF_TIME = { tv: 1.6, flat: 1.0, cinema: 1.9, hologram: 1.0 };

test("switched off (or the curtains closed), the screen looks the same whichever sample it holds", async ({
  page,
}) => {
  test.setTimeout(900_000);
  for (const style of (process.env.SCR2_STYLES || "tv,flat,cinema").split(",")) {
    const shots = {};
    for (const sample of ["gif", "video"]) {
      // At the desktop size, zoomed in close (the owner's view).
      await openScreen(page, { style, sample }, { width: 1440, height: 900 });
      await page.evaluate(() => {
        const cam = window.__splashery.player.camera;
        const st = cam.getState();
        cam.setState({ ...st, distance: st.distance * 0.6 }, { snap: true });
      });
      // On and playing, then off with the Toy tab's button.
      await page.evaluate(() => window.__splashery.player.act());
      await settle(page, ON_TIME[style] + 0.3);
      await page.evaluate(() => window.__splashery.player.act());
      await settle(page, OFF_TIME[style] + 0.3);
      const hidden = await page.evaluate(() => {
        const sh = window.__splashery.player.pictures.sheets[0];
        return { enabled: !!sh.slot?.entity?.enabled, hidden: sh.hidden };
      });
      expect(hidden, `${style} ${sample}`).toEqual({ enabled: false, hidden: true });
      shots[sample] = await screenPixels(page);
      if (process.env.SCR2_DEBUG)
        fs.writeFileSync(
          `${process.env.SCR2_DEBUG}/scr2-${style}-${sample}.png`,
          PNG.sync.write(shots[sample]),
        );
    }
    const d = difference(shots.gif, shots.video);
    expect(d.count, `${style}: ${JSON.stringify(d)}`).toBe(0);
  }
});

test("a GIF holds its frame while the set is off, and plays on when it comes back on", async ({
  page,
}) => {
  await openScreen(page, { style: "flat", sample: "gif" });
  // The frames shown over `sec` seconds of the player's clock (the GIF's
  // clock), however slow the renderer is.
  const frames = (sec) =>
    page.evaluate(async (sec) => {
      const pl = window.__splashery.player;
      const seen = new Set();
      const t0 = pl.time;
      const w0 = performance.now();
      while (pl.time - t0 < sec && performance.now() - w0 < 60_000) {
        pl.stage.requestRender();
        await new Promise((r) => setTimeout(r, 30));
        seen.add(pl.pictures.gifFrame);
      }
      return [...seen];
    }, sec);
  // Off from the start: held.
  expect((await frames(1.5)).length).toBe(1);
  await page.evaluate(() => window.__splashery.player.act());
  await settle(page, ON_TIME.flat + 0.2);
  expect((await frames(2)).length).toBeGreaterThan(2);
  // Off again: it stops on the frame it showed.
  await page.evaluate(() => window.__splashery.player.act());
  await settle(page, 0.3);
  const held = await frames(2);
  expect(held.length).toBe(1);
  expect(await page.evaluate(() => window.__splashery.player.pictures.api.held)).toBe(true);
});

test("a tap on the old TV's power knob switches it off; a tap on the picture plays and pauses", async ({
  page,
}) => {
  await openScreen(page, { style: "tv", sample: "video" });
  const playing = () => page.evaluate(() => window.__splashery.player.pictures.info().playing);
  // Off: a tap anywhere switches it on (here, the picture).
  await tapAt(page, [-0.32, 0.12, 0.3]);
  await page.waitForFunction(() => window.__splashery.player.pictures.info().playing);
  await settle(page, ON_TIME.tv + 0.2);
  // On: a tap on the picture pauses, and again plays.
  await tapAt(page, [-0.32, 0.12, 0.3]);
  await page.waitForFunction(() => !window.__splashery.player.pictures.info().playing);
  await tapAt(page, [-0.1, 0.3, 0.3]);
  await page.waitForFunction(() => window.__splashery.player.pictures.info().playing);
  // The power knob switches it off: the video pauses and the picture hides.
  await tapAt(page, [0.72, 0.42, 0.26]);
  await page.waitForFunction(() => !window.__splashery.player.pictures.info().playing);
  await settle(page, OFF_TIME.tv + 0.2);
  expect(await page.evaluate(() => window.__splashery.player.motion.out.sheets.screen.visible)).toBe(0); // prettier-ignore
  // Paused where it was (the sample loops, so compare with itself).
  const offAt = await page.evaluate(() => window.__splashery.player.pictures.api.time);
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => window.__splashery.player.pictures.api.time)).toBe(offAt);
  // And on again, playing on from there.
  await tapAt(page, [0.72, 0.42, 0.26]);
  await page.waitForFunction(() => window.__splashery.player.pictures.info().playing);
  expect(await playing()).toBe(true);
});

test("the flat TV's button, the cinema's curtains and the hologram's base switch them off", async ({
  page,
}) => {
  const cases = [
    ["flat", [0.07, -0.453, 0.05]],
    ["cinema", [-1.5, 0.6, -0.4]],
    ["hologram", [0, -0.8, 0.5]],
  ];
  for (const [style, point] of cases) {
    await openScreen(page, { style, sample: "gif" });
    // The Toy tab's button names what it does.
    const label = await page.evaluate(() => window.__splashery.player.toyInfo.recipe.action.label);
    expect(label).toBe(style === "cinema" ? "Open or close the curtains" : "Switch on or off");
    await page.evaluate(() => window.__splashery.player.act());
    await settle(page, ON_TIME[style] + 0.2);
    expect(await page.evaluate(() => window.__splashery.player.motion.out.sheets.screen.visible)).toBe(1); // prettier-ignore
    await tapAt(page, point);
    expect(await page.evaluate(() => window.__splashery.player.motion.tap.pick), style).toBe(1);
    await settle(page, OFF_TIME[style] + 0.2);
    expect(await page.evaluate(() => window.__splashery.player.motion.out.sheets.screen.visible), style).toBe(0); // prettier-ignore
  }
});

test("every style builds within its tier's budget, at full density, quickly", async () => {
  const { RECIPES } = await import("../src/packs/screens.js");
  const r = RECIPES.screen;
  for (const style of ["tv", "flat", "cinema", "hologram"])
    for (const [tier, prof] of Object.entries(PROFILES)) {
      const count = Math.round(Math.min(prof.maxCount, prof.defaultCount * r.density));
      const t0 = Date.now();
      const it = buildRecipe(r, { seed: 5, count, options: { style } }, applyClay);
      let b = it.next();
      while (!b.done) b = it.next();
      const ctx = b.value;
      const what = `${style} at ${tier}`;
      expect(ctx.buf.count, what).toBeLessThanOrEqual(prof.maxCount);
      // Holes (the picture's opening, cut-outs) drop a few of the budget's
      // splats; the rest is used.
      expect(ctx.buf.count, what).toBeGreaterThan(count * 0.75);
      expect(ctx.parts.length, what).toBeLessThanOrEqual(16);
      expect(Date.now() - t0, what).toBeLessThan(4000);
      const pos = ctx.buf.pos.subarray(0, ctx.buf.count * 3);
      expect(pos.every(Number.isFinite), what).toBe(true);
    }
});

test("lane Screens r2 screenshots at 390x844 and 1440x900", async ({ page }) => {
  test.setTimeout(600_000);
  for (const size of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    const tag = `${size.width}x${size.height}`;
    for (const style of ["tv", "flat", "cinema", "hologram"]) {
      await openScreen(page, { style, sample: "gif" }, size);
      await page.evaluate(() => window.__splashery.player.act());
      await settle(page, ON_TIME[style] + 0.4);
      await page.screenshot({ path: `tests/screenshots/scr2-${style}-${tag}.png` });
    }
    // The hologram switched off again.
    await page.evaluate(() => window.__splashery.player.act());
    await settle(page, OFF_TIME.hologram + 0.4);
    await page.screenshot({ path: `tests/screenshots/scr2-hologram-off-${tag}.png` });
  }
});

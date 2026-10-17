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
  const [x, y] = await page.evaluate((p) => {
    const { player } = window.__splashery;
    const [x, y] = player.screenPoint(p);
    const box = player.stage.canvas.getBoundingClientRect();
    return [box.left + x, box.top + y];
  }, point);
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

export { openScreen, settle, tapAt, screenPixels, difference, ON_TIME, OFF_TIME };

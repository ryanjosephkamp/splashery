#!/usr/bin/env node
// Lane Night sky: renders the Night sky's review clips at phone shape (a tall GIF), with a place,
// a time, a speed and a view for each, which tools/effect-clip.mjs can't set. The toy's clock is
// stepped by hand, so the sky moves at the speed named whatever the renderer's speed.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/sky-clip.mjs <out-dir> [name ...]
//
// Names: turn, tap, sunrise, moon (all by default). A clip's `speed` is one of the toy's own
// speeds (src/packs/night-sky.js, SPEEDS); `rate` is any sky seconds a second. Writes <out-dir>/sky-<name>.gif.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const [outDir, ...names] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!outDir)
  throw new Error("Usage: node tools/sky-clip.mjs <out-dir> [turn|tap|sunrise|moon ...]");
const W = 300;
const H = 650;
const FPS = 15;

// Each clip: a place and start time, the sky's speed (sky seconds a second), its length, and the
// view (yaw and pitch in radians, zoom as a share of the home field of view) or a body to follow.
const CLIPS = {
  // New York, October 5, 2026, from 7:30 PM EDT: six hours of the sky turning, looking east.
  turn: { city: "new-york", time: "2026-10-05T23:30:00Z", rate: 3600, secs: 6, view: { yaw: Math.PI / 2, pitch: 0.42, zoom: 1 } }, // prettier-ignore
  // The same night at 9 PM, looking up to the west-southwest: taps on Vega, then Altair, two
  // corners of the Summer Triangle; each ring closes in on its target.
  tap: { city: "new-york", time: "2026-10-06T01:00:00Z", rate: 0, secs: 5, view: { yaw: -1.134, pitch: 1.0, zoom: 1 }, taps: [[0.3, "Vega"], [2.6, "Altair"]] }, // prettier-ignore
  // London, June 21, 2026: from the end of the night to sunrise at 10 minutes a second, looking
  // northeast: the glow grows below the Sun, the faint stars go first, then the Sun comes up.
  sunrise: { city: "london", time: "2026-06-21T02:10:00Z", rate: 600, secs: 10, view: { yaw: 2.35, pitch: 0.2, zoom: 1 } }, // prettier-ignore
  // New York, at 7:30 PM each evening from October 14 to 25, 2026, on the toy's "same time
  // each day: a day every 2 seconds" speed (the owner's "slow it down"), following the Moon: it
  // walks east night by night and waxes from a crescent to full.
  moon: { city: "new-york", time: "2026-10-14T23:30:00Z", speed: "day2", secs: 22, follow: "moon", zoom: 0.3 }, // prettier-ignore
};

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?renderer=webgl2&profile=high&adapt=off&labs=1`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
await page.evaluate(() => window.__splashery.app.chooseToy("night-sky"));
await page.waitForTimeout(1500);

for (const name of names.length ? names : Object.keys(CLIPS)) {
  const clip = CLIPS[name];
  const bytes = await page.evaluate(
    async ({ clip, W, H, FPS }) => {
      const { player } = window.__splashery;
      const sky = window.__splashery.sky;
      const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
      player.opts.idleDelay = 1e9;
      player.idle.weight = 0;
      sky.pick(null);
      sky.set({ city: clip.city, time: clip.time, ...(clip.speed ? { speed: clip.speed } : { rate: clip.rate }) }); // prettier-ignore
      const stage = player.stage;
      const handlers = stage.updateHandlers.slice();
      let pending = 0;
      stage.updateHandlers.length = 0;
      stage.updateHandlers.push(() => {
        const d = pending;
        pending = 0;
        for (const h of handlers) h(d);
      });
      stage.setFixedSize([W, H]);
      const cam = player.camera;
      const aim = () => {
        if (clip.follow) sky.look(clip.follow, clip.zoom);
        else {
          const v = clip.view;
          const pose = { yaw: v.yaw, pitch: v.pitch, roll: 0, distance: 5 * v.zoom * cam.radius };
          cam.cur = { ...pose };
          cam.tgt = { ...pose };
        }
      };
      const step = 1 / FPS;
      const gif = GIFEncoder();
      const frame = async () => {
        pending = step;
        aim();
        await stage.captureFrame();
        pending = 0;
        aim();
        const c = await stage.captureFrame();
        const rgba = c.getContext("2d").getImageData(0, 0, W, H).data;
        const palette = quantize(rgba, 256, { format: "rgb565" });
        gif.writeFrame(applyPalette(rgba, palette, "rgb565"), W, H, { palette, delay: Math.round(1000 / FPS), repeat: 0 }); // prettier-ignore
      };
      // Settle at the start time (two frames, so nothing of the last clip is left).
      for (let i = 0; i < 2; i++) {
        pending = 0.01;
        aim();
        await stage.captureFrame();
      }
      sky.set({ time: clip.time, ...(clip.speed ? { speed: clip.speed } : { rate: clip.rate }) });
      pending = 0;
      aim();
      await stage.captureFrame();
      const taps = (clip.taps || []).slice();
      for (let t = 0; t < clip.secs - 1e-6; t += step) {
        while (taps.length && taps[0][0] <= t + 1e-6) {
          const [, target] = taps.shift();
          const d = sky.dirOf(target);
          const tf = player.motion.ctx?.transform;
          // A point toward it, in world units, as a tap there would find.
          player.act(d.map((v) => v * 0.9 * (tf?.scale ?? 1)));
        }
        await frame();
      }
      gif.finish();
      stage.setFixedSize(null);
      stage.updateHandlers.length = 0;
      stage.updateHandlers.push(...handlers);
      return Array.from(gif.bytes());
    },
    { clip, W, H, FPS },
  );
  const out = path.join(outDir, `sky-${name}.gif`);
  fs.writeFileSync(out, Buffer.from(bytes));
  console.log(`${name}: ${out} (${(bytes.length / 1024).toFixed(0)} KB)`);
}
await browser.close();

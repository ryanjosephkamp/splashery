#!/usr/bin/env node
// Records a phone-size clip of the one-link page (lane Pitch): site/about/splashery/, scrolled
// top to bottom at a reading pace, with one touch on each live toy (peel the grape, play the
// piano, lift the photo, cut the walnut). Meant for a computer with a real graphics chip (the
// owner's Mac): in the cloud the software renderer draws too slowly for a fair clip.
//
//   python3 -m http.server 4173 --bind 127.0.0.1     # in one terminal
//   node tools/pit-clip.mjs                           # writes .cache/pit-clip/pit-390x844.webm
//   node tools/pit-clip.mjs --desktop                 # 1440×900 instead
//
// It uses the installed Google Chrome (SPLASHERY_CHROMIUM picks another browser), headed, so
// WebGPU and the graphics chip are the real ones.

import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173";
const desktop = process.argv.includes("--desktop");
const size = desktop ? { width: 1440, height: 900 } : { width: 390, height: 844 };
const out = path.join(root, ".cache/pit-clip");
fs.mkdirSync(out, { recursive: true });

// SPLASHERY_CLIP_TRIAL=1: headless on SwiftShader, only to check the script runs (the cloud).
const trial = process.env.SPLASHERY_CLIP_TRIAL === "1";
const browser = await chromium.launch({
  headless: trial,
  ...(trial ? { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] } : {}), // prettier-ignore
  ...(process.env.SPLASHERY_CHROMIUM ? { executablePath: process.env.SPLASHERY_CHROMIUM } : { channel: "chrome" }), // prettier-ignore
});
const context = await browser.newContext({
  viewport: size,
  deviceScaleFactor: desktop ? 1 : 3,
  isMobile: !desktop,
  hasTouch: !desktop,
  recordVideo: { dir: out, size },
});
const page = await context.newPage();
await page.goto(`${base}/site/about/splashery/`);
const pause = (ms) => page.waitForTimeout(ms);

// Scrolls smoothly so a stage sits in the middle of the screen, and waits for its toy.
async function visit(id) {
  await page.evaluate(async (id) => {
    const el = document.querySelector(`[data-pit-demo="${id}"]`) || document.querySelector(id);
    const r = el.getBoundingClientRect();
    const to = scrollY + r.top + r.height / 2 - innerHeight / 2;
    const from = scrollY;
    const t0 = performance.now();
    const ms = Math.min(2600, Math.abs(to - from) * 2.2);
    await new Promise((done) => {
      const step = (t) => {
        const k = Math.min(1, (t - t0) / ms);
        scrollTo(0, from + (to - from) * (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2));
        k < 1 ? requestAnimationFrame(step) : done();
      };
      requestAnimationFrame(step);
    });
  }, id);
  if (!id.startsWith(".") && !id.startsWith("[")) {
    await page.waitForSelector(`[data-pit-demo="${id}"][data-state]:not([data-state="loading"])`, { timeout: 120_000 }); // prettier-ignore
  }
}
const box = async (id) => page.locator(`[data-pit-demo="${id}"]`).boundingBox();
const tap = async (x, y) => (desktop ? page.mouse.click(x, y) : page.touchscreen.tap(x, y));
async function drag(x0, y0, x1, y1, steps = 24) {
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x1, y1, { steps });
  await page.mouse.up();
}

await page.waitForSelector('[data-pit-demo="grape"][data-state="ready"]', { timeout: 120_000 });
await pause(1800);
let b = await box("grape");
await tap(b.x + b.width / 2, b.y + b.height / 2); // peel
await pause(3500);

await visit("[data-pit-one]");
await pause(800);
for (const [k, v] of [
  ["sx", "0.4"],
  ["rot", "120"],
  ["a", "0.5"],
]) {
  await page.locator(`[data-k="${k}"]`).fill(v);
  await pause(700);
}

await visit("toy-piano");
await pause(1200);
b = await box("toy-piano");
// A few notes along the keys (a drag on the case would turn the piano instead).
for (const k of [0.36, 0.42, 0.48, 0.54, 0.6, 0.54, 0.48]) {
  await tap(b.x + b.width * k, b.y + b.height * 0.72);
  await pause(320);
}
await pause(2500);

await visit("photo-3d");
await pause(1500);
b = await box("photo-3d");
await tap(b.x + b.width / 2, b.y + b.height / 2); // lift the depth
await pause(2000);
await drag(b.x + b.width * 0.4, b.y + b.height / 2, b.x + b.width * 0.5, b.y + b.height * 0.47); // turn it a little
await pause(2500);

await visit("walnut-ct");
await pause(1200);
b = await box("walnut-ct");
await drag(b.x + b.width / 2, b.y + b.height * 0.25, b.x + b.width / 2, b.y + b.height * 0.7, 40); // cut
await pause(3000);

await visit("qr-code");
await pause(3000);
await visit(".pit-claims");
await pause(4000);

const video = page.video();
await context.close();
await browser.close();
const file = path.join(out, `pit-${size.width}x${size.height}.webm`);
fs.renameSync(await video.path(), file);
console.log(`wrote ${path.relative(root, file)}`);

#!/usr/bin/env node
// Renders the Worlds character on its own (no island) from a few angles, in
// a pose, for checking the sculpt and the gait quickly (lane Character).
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/chr-view.mjs out.png [--size=390x844] [--views=front,side,back,face] [--speed=0] [--phase=0] [--time=0] [--count=70000] [--old]
//
// Writes one PNG with the views side by side. --old renders the character
// module from origin/main (checked out into .cache/chr-old/) for the
// before-and-after card.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import { PNG } from "pngjs";
import { PAGE } from "./chr-page.mjs";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("Usage: node tools/chr-view.mjs out.png [--views=front,side]");
const [W, H] = opt("size", "390x844").split("x").map(Number);
const views = opt("views", "front,side,back,face").split(",");
const state = { speed: Number(opt("speed", 0)), phase: Number(opt("phase", 0)) };
const time = Number(opt("time", 0));
const count = Number(opt("count", 70000));
const module = args.includes("--old") ? "/.cache/chr-old/character.js" : "/src/worlds/character.js";
const look = JSON.parse(opt("look", "{}"));

// Camera for each view: [yaw degrees around the figure, distance, height, target height].
const CAMS = {
  front: [0, 2.0, 1.0, 0.88],
  side: [90, 2.0, 1.0, 0.88],
  back: [180, 2.0, 1.0, 0.88],
  three: [35, 2.0, 1.1, 0.88],
  face: [20, 0.5, 1.63, 1.6],
  facefront: [0, 0.42, 1.62, 1.615],
  eye: [10, 0.16, 1.62, 1.615],
  faceside: [90, 0.42, 1.62, 1.615],
  head: [150, 0.6, 1.66, 1.6],
  upper: [25, 1.0, 1.35, 1.3],
  hem: [15, 0.35, 1.0, 0.97],
  collar: [15, 0.3, 1.5, 1.46],
  hands: [60, 0.8, 1.0, 0.85],
  feet: [40, 0.8, 0.35, 0.1],
  shoe: [60, 0.3, 0.2, 0.05],
  far: [25, 6, 2.6, 1.0],
};

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("page error:", e.message));
page.on("console", (m) => m.type() === "error" && console.error(m.text()));
await page.goto(`${base}chr-preview-404`);
await page.setContent(PAGE(module));
await page.waitForFunction(() => document.body.dataset.ready === "true", null, {
  timeout: 120_000,
});
const n = await page.evaluate(([look, count]) => window.__chr.build(look, count), [look, count]);
console.log(`${n} splats`);
await page.evaluate(([s, t]) => window.__chr.pose(s, t), [state, time]);
const shots = [];
// --strip=N: N poses through one gait cycle (or N seconds of standing),
// all in the first view.
const stripN = Number(opt("strip", 0));
const poses = stripN
  ? Array.from({ length: stripN }, (_, i) =>
      state.speed > 0
        ? [{ speed: state.speed, phase: (i / stripN) * Math.PI * 2 }, time]
        : [state, time + i],
    )
  : [[state, time]];
for (const v of stripN ? Array(stripN).fill(views[0]) : views) {
  if (stripN) {
    const [s, t] = poses[shots.length];
    await page.evaluate(([s, t]) => window.__chr.pose(s, t), [s, t]);
  }
  const [yaw, d, h, th] = CAMS[v];
  const a = (yaw * Math.PI) / 180;
  await page.evaluate(
    ([p, t]) => window.__chr.cam(p, t),
    [
      [Math.sin(a) * d, h, Math.cos(a) * d],
      [0, th, 0],
    ],
  );
  for (let f = 0; f < 3; f++) await page.evaluate(() => window.__chr.frame());
  shots.push(PNG.sync.read(await page.screenshot()));
}
const png = new PNG({ width: W * shots.length, height: H });
shots.forEach((s, i) => {
  for (let y = 0; y < H; y++) s.data.copy(png.data, (y * W * shots.length + i * W) * 4, y * W * 4, (y + 1) * W * 4); // prettier-ignore
});
fs.writeFileSync(out, PNG.sync.write(png));
console.log(out);
await browser.close();

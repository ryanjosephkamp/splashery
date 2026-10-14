#!/usr/bin/env node
// Real elements (lane Elements): looks at a lifted sample from every side. The sample turns a
// whole turn in 5-degree steps (its own turn, so the board always stays behind it), seen from
// three heights (from below, level, from above), close up and from further off, at phone and
// desktop size; each view is drawn with and without the sample (the page's panels hidden) and
// src/elements-real/see-through.js finds background showing through its silhouette. Writes a
// contact sheet per element and size and prints the worst views.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/rel-sweep.mjs [out-dir] [El ...]
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { settle } from "./rel-settle.mjs";
import { seeThrough, spinFor } from "../src/elements-real/see-through.js";

const args = process.argv.slice(2);
const outDir = args[0] && !/^[A-Z]/.test(args[0]) ? args.shift() : ".cache/rel/sweep";
const els = args.length ? args : ["Cu", "Rn"];
fs.mkdirSync(outDir, { recursive: true });
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const STEP = Number(process.env.STEP || 5);
const PITCHES = [-0.6, 0, 0.6];
const DISTANCES = [1.1, 2.2];
const PAN = [0.4, 0.03, 0.35]; // the lifted sample, in toy radii from the middle

const b = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
let worst = 0;
const sizes = (process.env.SIZES || "390x844:low,1440x900:high").split(",").map((s) => {
  const [wh, profile] = s.split(":");
  const [w, h] = wh.split("x").map(Number);
  return [w, h, profile];
});
for (const [vw, vh, profile] of sizes) {
  const page = await b.newPage({ viewport: { width: vw, height: vh } });
  await page.goto(`${base}?labs=1&renderer=webgl2&profile=${profile}&adapt=off`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("real-elements"));
  await page.waitForFunction(() => window.__splashery.player.motion?.ctx?.kit?.data, null, { timeout: 120_000 }); // prettier-ignore
  // Only the drawing: the panels and buttons would sit over the sample and read as holes.
  await page.addStyleTag({ content: "* { visibility: hidden !important; } canvas { visibility: visible !important; }" }); // prettier-ignore
  for (const el of els) {
    await page.evaluate(async (el) => {
      const { app, player } = window.__splashery;
      await app.setToyOption("element", el);
      player.motion.setControl("up", 1, { snap: true });
    }, el);
    await page.waitForFunction((el) => window.__splashery.player.motion?.ctx?.kit?.data?.element === el, el, { timeout: 120_000 }); // prettier-ignore
    await page.waitForTimeout(1500);
    const tiles = [];
    const bad = [];
    for (const distance of DISTANCES)
      for (const pitch of PITCHES)
        for (let deg = 0; deg < 360; deg += STEP) {
          const cam = { yaw: 0, pitch, distance, pan: PAN };
          const spin = spinFor(deg);
          const shot = async (hide) => {
            await page.evaluate(
              ({ cam, hide, spin }) => {
                globalThis.__relHideLift = hide;
                const { player } = window.__splashery;
                player.motion.setControl("spin", spin, { snap: true });
                player.camera.setState(cam);
              },
              { cam, hide, spin },
            );
            await settle(page);
            return PNG.sync.read(await page.screenshot());
          };
          const withS = await shot(false);
          const without = await shot(true);
          const r = seeThrough(withS, without);
          worst = Math.max(worst, r.ratio);
          const name = `d${distance} p${pitch} ${deg}°`;
          if (r.ratio >= 0.005) bad.push(`${name}: ${(r.ratio * 100).toFixed(2)}% (${r.holes} px)`);
          tiles.push({ name, ratio: r.ratio, still: r.still });
        }
    await page.evaluate(() => (globalThis.__relHideLift = false));
    const file = path.join(outDir, `rel-sweep-${el}-${vw}x${vh}.png`);
    fs.writeFileSync(file, PNG.sync.write(sheet(tiles, 72)));
    console.log(`${el} ${vw}x${vh}: ${tiles.length} views, worst ${(Math.max(...tiles.map((t) => t.ratio)) * 100).toFixed(2)}% -> ${file}`); // prettier-ignore
    for (const x of bad) console.log("  " + x);
  }
  await page.close();
}
await b.close();
console.log(`worst see-through: ${(worst * 100).toFixed(2)}%`);

// A contact sheet: each view's still (see-through pixels in magenta) fitted in a square cell, a
// red frame round any view at or over half a percent.
function sheet(tiles, cell) {
  const cols = 360 / STEP;
  const rows = Math.ceil(tiles.length / cols);
  const out = new PNG({ width: cols * cell, height: rows * cell });
  out.data.fill(17);
  for (let i = 3; i < out.data.length; i += 4) out.data[i] = 255;
  tiles.forEach((t, k) => {
    const ox = (k % cols) * cell;
    const oy = Math.floor(k / cols) * cell;
    const s = t.still;
    const f = Math.max(s.width, s.height) / (cell - 4);
    for (let y = 0; y < cell - 4; y++)
      for (let x = 0; x < cell - 4; x++) {
        const sx = Math.floor(x * f);
        const sy = Math.floor(y * f);
        if (sx >= s.width || sy >= s.height) continue;
        const i = (sy * s.width + sx) * 4;
        const o = ((oy + 2 + y) * out.width + ox + 2 + x) * 4;
        out.data[o] = s.data[i];
        out.data[o + 1] = s.data[i + 1];
        out.data[o + 2] = s.data[i + 2];
      }
    if (t.ratio >= 0.005)
      for (let j = 0; j < cell; j++)
        for (const [x, y] of [
          [j, 0],
          [j, cell - 1],
          [0, j],
          [cell - 1, j],
        ]) {
          // prettier-ignore
          const o = ((oy + y) * out.width + ox + x) * 4;
          out.data[o] = 255;
          out.data[o + 1] = 0;
          out.data[o + 2] = 0;
        }
  });
  return out;
}

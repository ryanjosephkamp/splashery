#!/usr/bin/env node
// Lane Fluids: measures the fluid solver per device tier (docs/FLUIDS.md).
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/fl-measure.mjs [--out=file.json] [--secs=4]
//
// For each tier and each Fluid lab scene it builds the toy's fluids in a
// page (no drawing: the software renderer's frame times say nothing about a
// phone's GPU, docs/lab/FIELDS.md), runs `secs` seconds of a tap at 30
// frames a second and reports the solver's time per frame: the median and
// the 90th percentile, the particles alive and the splat slots drawn. Each
// tier runs with Chromium's CPU throttling set to its stand-in phone
// (low 6x, mid 4x, high 2x, max 1x), so the numbers read as "on a phone of
// that tier". A frame at 30 fps has 33 ms; the solver runs in a worker, so
// it can use most of that without slowing the drawing.

import { chromium } from "@playwright/test";
import fs from "node:fs";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const secs = Number(opt("secs", 4));
const out = opt("out", "");
const THROTTLE = { low: 6, mid: 4, high: 2, max: 1 };
const SCENES = [
  ["glass", "water"],
  ["glass", "soda"],
  ["glass", "honey"],
  ["splash", "water"],
  ["candle", "water"],
  ["cup", "water"],
];

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?renderer=none`);
await page.waitForLoadState("load");
const cdp = await page.context().newCDPSession(page);
const rows = [];
for (const tier of Object.keys(THROTTLE)) {
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE[tier] });
  for (const [scene, liquid] of SCENES) {
    const r = await page.evaluate(
      async ({ tier, scene, liquid, secs }) => {
        const { RECIPES } = await import("/src/packs/fluid-lab.js");
        const { Kit } = await import("/src/kit.js");
        const { FluidWorld } = await import("/src/fluids/world.js");
        const recipe = RECIPES["fluid-lab"];
        const k = new Kit(1, { count: 20000 });
        recipe.build(k, { scene, liquid });
        const world = new FluidWorld(k.fluids, { profile: tier, seed: 1 });
        const n = world.slots * 4;
        const bufs = [0, 1, 2, 3].map(() => new Float32Array(n));
        const times = [];
        let peak = 0;
        const frames = Math.round(secs * 30);
        for (let f = 0; f < frames + 30; f++) {
          // One second to settle, then a tap.
          const tapAt = 30;
          const e = f >= tapAt ? (f - tapAt) / 30 : 99;
          const out = { parts: {}, cues: [], fluid: null };
          const c = { go: e < 5 ? 1 - e / 5 : 0 };
          recipe.drive(f / 30, c, out, { data: k.data, tap: f >= tapAt ? { n: 1 } : { n: 0 } });
          const t0 = performance.now();
          world.command(out.fluid);
          world.step(1 / 30);
          world.pack(...bufs);
          const ms = performance.now() - t0;
          if (f >= tapAt) times.push(ms);
          peak = Math.max(peak, world.count());
        }
        times.sort((a, b) => a - b);
        return {
          median: times[Math.floor(times.length / 2)],
          p90: times[Math.floor(times.length * 0.9)],
          particles: peak,
          slots: world.slots,
        };
      },
      { tier, scene, liquid, secs },
    );
    const row = { tier, throttle: THROTTLE[tier], scene, liquid, ...r };
    rows.push(row);
    console.log(
      `${tier.padEnd(4)} ${`${scene}/${liquid}`.padEnd(14)} ${r.median.toFixed(1).padStart(6)} ms  p90 ${r.p90.toFixed(1).padStart(6)} ms  ${String(r.particles).padStart(5)} particles  ${r.slots} slots`,
    );
  }
}
await browser.close();
if (out) fs.writeFileSync(out, JSON.stringify(rows, null, 2));

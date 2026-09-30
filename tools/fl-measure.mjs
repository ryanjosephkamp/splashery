#!/usr/bin/env node
// Lane Fluids: measures the fluid solver per device tier (docs/FLUIDS.md).
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/fl-measure.mjs [--out=file.json] [--secs=4] [--card=fl-phone.png]
//
// --card also draws the table as a phone-sized card (390x844 at a device
// pixel ratio of 3) for the Effect review page.
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
import { TIER_SCALE } from "../src/fluids/world.js";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const secs = Number(opt("secs", 4));
const out = opt("out", "");
const card = opt("card", "");
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
if (out) fs.writeFileSync(out, JSON.stringify(rows, null, 2));
if (card) {
  const cardPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 }); // prettier-ignore
  const label = (r) => `${r.scene === "glass" ? `Pour ${r.liquid}` : r.scene === "cup" ? "Hot cup" : r.scene[0].toUpperCase() + r.scene.slice(1)}`; // prettier-ignore
  const cell = (ms) =>
    `<td class="${ms <= 33 ? "ok" : ms <= 45 ? "warn" : "bad"}">${ms.toFixed(0)}</td>`;
  const tiers = Object.keys(THROTTLE);
  const scenes = SCENES.map(([s, l]) => rows.find((r) => r.scene === s && r.liquid === l));
  const body = scenes
    .map(
      (sc) =>
        `<tr><th>${label(sc)}</th>${tiers.map((t) => cell(rows.find((r) => r.tier === t && r.scene === sc.scene && r.liquid === sc.liquid).median)).join("")}</tr>`,
    ) // prettier-ignore
    .join("");
  await cardPage.setContent(`<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#15171a;color:#e8eaed;font:14px/1.4 system-ui,sans-serif;padding:22px 18px}
    h1{font-size:21px;margin:0 0 4px} p{margin:6px 0;color:#b8bcc2;font-size:13px}
    table{border-collapse:collapse;width:100%;margin:14px 0}
    th,td{padding:7px 6px;text-align:right;border-bottom:1px solid #2a2e33;font-variant-numeric:tabular-nums}
    th:first-child{text-align:left} thead th{color:#9aa0a6;font-weight:600;font-size:12px}
    .ok{color:#7ddc8c}.warn{color:#f2c46b}.bad{color:#f28b82}
    .tag{position:fixed;left:10px;bottom:10px;font:600 12px system-ui;background:rgba(255,255,255,.1);padding:4px 8px;border-radius:6px}
  </style>
  <h1>Fluid lab on each tier</h1>
  <p>The solver's time per frame (ms, median over ${secs} s after a tap), in a Web Worker, with Chromium's CPU slowed down to stand in for each tier's phone or computer (low 6×, mid 4×, high 2×, max 1×). A 30 fps frame is 33 ms.</p>
  <table><thead><tr><th>Scene</th>${tiers.map((t) => `<th>${t}<br>${THROTTLE[t]}×</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>
  <p>Liquid particles at most (the glass's pour, the splash): ${tiers.map((t) => `${t} ${Math.round(1200 * TIER_SCALE[t])}, ${Math.round(1300 * TIER_SCALE[t])}`).join("; ")}. Fewer particles are larger, so the same volume pours.</p>
  <p>Green fits a 30 fps frame; yellow runs the pour a little slower than real time while the drawing keeps its rate (the solver is off the page); red would be slow motion. Drawing is on the phone's GPU: a few thousand extra splats on top of the toy's own.</p>
  <div class="tag">Fluid lab · built by Opus 5.5</div>`);
  await cardPage.screenshot({ path: card });
}
await browser.close();

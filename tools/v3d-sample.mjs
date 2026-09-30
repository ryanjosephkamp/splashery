#!/usr/bin/env node
// Video to 3D (lane Video 3D): runs the toy's whole pipeline on a video in the real page, the way
// someone opening the video in the Toy tab would, and writes the result and its measurements.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/v3d-sample.mjs <video> <out-dir>/<id> \
//     [--start=0] [--length=10] [--rate=3] [--iters=800] [--splats=40000] [--seed=20000] [--train=400] \
//     [--frames=24] [--side=640] [--profile=high] [--viewport=390x844] [--every=4]
//
// Writes <id>.ply (the trained splats), <id>.json ({ cams, stats, timings }: the camera path the
// Replay flight flies, and the numbers for docs/lab/VIDEO3D.md) and <id>-log.txt (Splat.js's own
// log). --every=4 also records the page every 4 seconds while it works, as <id>-progress.gif
// (the progress card, at the --viewport size). With no GPU, Chromium's WebGPU runs on SwiftShader: slowly, but the same code.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import gifenc from "gifenc";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [video, outBase] = args.filter((a) => !a.startsWith("--"));
if (!video || !outBase) throw new Error("Usage: node tools/v3d-sample.mjs <video> <out-dir>/<id>");
fs.mkdirSync(path.dirname(outBase), { recursive: true });

const settings = {};
if (opt("iters")) settings.iters = Number(opt("iters"));
if (opt("splats")) settings.splats = Number(opt("splats"));
if (opt("seed")) settings.seed = Number(opt("seed"));
if (opt("train")) settings.trainSide = Number(opt("train"));
if (opt("frames")) settings.maxFrames = Number(opt("frames"));
if (opt("side")) settings.frameSide = settings.featSide = Number(opt("side"));

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
    "--enable-unsafe-webgpu",
    "--enable-features=Vulkan,WebGPU",
    "--use-webgpu-adapter=swiftshader",
    "--use-vulkan=swiftshader",
  ],
});
const [vw, vh] = opt("viewport", "1000x700").split("x").map(Number);
const page = await browser.newPage({ viewport: { width: vw, height: vh } });
page.on("pageerror", (e) => console.error("page error:", e.message));
const t0 = Date.now();
let lastLine = "";
page.on("console", (m) => {
  const t = m.text();
  if (t.startsWith("[v3d]") && t !== lastLine) {
    lastLine = t;
    console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s ${t}`);
  }
});
await page.goto(`${base}?labs=1&renderer=webgl2&profile=${opt("profile", "high")}&adapt=off`);
await page.waitForFunction(() => window.__splashery?.ready, null, { timeout: 120000 });
await page.evaluate((s) => {
  window.__v3dSettings = s;
}, settings);
await page.evaluate(() => window.__splashery.app.chooseToy("video-3d"));
await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.video, null, {
  timeout: 120000,
});
await page.evaluate((o) => window.__splashery.app.setToyOptions(o), {
  start: Number(opt("start", 0)),
  length: opt("length", "10"),
  rate: opt("rate", "3"),
});
// Progress, from the card, into this console.
await page.evaluate(() => {
  setInterval(() => {
    const c = document.getElementById("v3d-card");
    if (!c) return;
    const on = c.querySelector("li.on");
    const note = c.querySelector(".v3d-note")?.textContent || "";
    if (on) console.log(`[v3d] ${on.textContent} ${note}`);
  }, 5000);
});
await page.click("#tab-toy").catch(() => {});
await page.setInputFiles("#toy-input-file", video);
await page.evaluate(async () => {
  window.__v3d = await import("./src/packs/video3d.js");
});
const every = Number(opt("every", 0));
const shots = [];
const finished = () =>
  page.evaluate(() => !!window.__v3d.video3dResult() || !!window.__v3d.video3dState().error);
for (;;) {
  if (every) shots.push(await page.screenshot());
  if (await finished()) break;
  await page.waitForTimeout(every ? every * 1000 : 5000);
}
if (every) {
  // The toy with its result, and the card's readout, as the last frames.
  await page.waitForTimeout(4000);
  for (let i = 0; i < 3; i++) shots.push(await page.screenshot());
  const { GIFEncoder, quantize, applyPalette } = gifenc;
  const gif = GIFEncoder();
  for (const [i, b] of shots.entries()) {
    const png = PNG.sync.read(b);
    const palette = quantize(png.data, 256, { format: "rgb565" });
    const delay = i >= shots.length - 3 ? 1500 : 700;
    gif.writeFrame(applyPalette(png.data, palette, "rgb565"), png.width, png.height, { palette, delay, repeat: 0 }); // prettier-ignore
  }
  gif.finish();
  fs.writeFileSync(`${outBase}-progress.gif`, Buffer.from(gif.bytes()));
}
const out = await page.evaluate(async () => {
  const m = await import("./src/packs/video3d.js");
  const r = m.video3dResult();
  if (!r) return { error: m.video3dState().error };
  let bin = "";
  for (let i = 0; i < r.ply.length; i += 0x8000)
    bin += String.fromCharCode(...r.ply.subarray(i, i + 0x8000));
  return { ply: btoa(bin), cams: r.cams, stats: r.stats, timings: r.timings, log: r.log };
});
if (out.error) {
  console.error("failed:", out.error);
  fs.writeFileSync(`${outBase}-error.txt`, out.error + "\n");
} else {
  fs.writeFileSync(`${outBase}.ply`, Buffer.from(out.ply, "base64"));
  const round = (a) => a.map((v) => Math.round(v * 1e6) / 1e6);
  const cams = out.cams.map((c) => ({ time: c.time, R: round(c.R), t: round(c.t), f: c.f, w: c.w, h: c.h })); // prettier-ignore
  fs.writeFileSync(`${outBase}.json`, JSON.stringify({ cams, stats: out.stats, timings: out.timings }, null, 1) + "\n"); // prettier-ignore
  fs.writeFileSync(`${outBase}-log.txt`, out.log.join("\n") + "\n");
  console.log(JSON.stringify({ stats: out.stats, timings: out.timings }));
}
await browser.close();

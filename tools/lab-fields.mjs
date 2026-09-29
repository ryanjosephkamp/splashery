#!/usr/bin/env node
// Lane Lab: measures the splat field toy (src/packs/lab.js, docs/lab/FIELDS.md).
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/lab-fields.mjs [--renderer=webgl2] [--profile=high]
//
// For each field: its splat count, the mean frame time over 30 frames with
// the field moving (the GPU computes every splat), and what the CPU would
// spend each frame to move the same splats in JavaScript instead (the field
// evaluated for every splat; the upload to the GPU is not counted). Frame
// times come from Chromium's software renderer: relative only.

import { chromium } from "@playwright/test";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const renderer = opt("renderer", "webgl2");
const profile = opt("profile", "high");
// --labs=0 opens the toy with labs off: the same splats, frozen at t = 0 (no field).
const labs = opt("labs", "1");

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
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?renderer=${renderer}&profile=${profile}&adapt=off&labs=${labs}`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });

const rows = await page.evaluate(async () => {
  const { app, player } = window.__splashery;
  const { FIELDS } = await import("/src/packs/lab.js");
  const out = [];
  for (const program of ["galaxy", "ocean", "knot"]) {
    await app.chooseToy("splat-field");
    await app.setToyOption("program", program);
    player.camera.setTurntable(false);
    const stage = player.stage;
    for (let i = 0; i < 5; i++) await stage.captureFrame();
    let ms = 0;
    for (let i = 0; i < 30; i++) {
      const t0 = performance.now();
      await stage.captureFrame();
      ms += performance.now() - t0;
    }
    const n = player.toyInfo.splats;
    const anim = player.proc.ctx.buf.anim;
    const t1 = performance.now();
    let sink = 0;
    for (let i = 0; i < n; i++) sink += FIELDS[program](anim[i * 4 + 2], anim[i * 4 + 3], 1.5)[0];
    const cpu = performance.now() - t1;
    out.push({ program, splats: n, frameMs: +(ms / 30).toFixed(1), cpuMsPerFrame: +cpu.toFixed(1), dev: stage.deviceType, sink: Number.isFinite(sink) }); // prettier-ignore
  }
  return out;
});
for (const r of rows) console.log(JSON.stringify(r));
await browser.close();

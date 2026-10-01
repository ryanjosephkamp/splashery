#!/usr/bin/env node
// Records clips of the character lab (worlds/lab/; docs/WORLDS.md, "The
// character lab") as looping GIFs, chart and all: the person on the
// treadmill with its joint angles drawn over measured human gait. The lab's
// clock is stepped by hand (?clock=manual), so a clip moves at real speed
// however slow the renderer is. tools/wd-webm.mjs turns a GIF into WebM.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/wd-lab-clip.mjs <out-dir> [--size=390x844] [--fps=10] [--dpr=1.5] [--level=low] [--suffix=-r4] stand walk run controls
//
// Writes <out-dir>/wd-lab-<name><suffix>.gif. Each scene is a list of
// steps: a gait, a view, a slow-motion factor and how long to hold them.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import gifenc from "gifenc";

const { GIFEncoder, quantize, applyPalette } = gifenc;
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [outDir, ...names] = args.filter((a) => !a.startsWith("--"));
if (!outDir || !names.length)
  throw new Error("Usage: node tools/wd-lab-clip.mjs <out-dir> stand|walk|run ...");
const [W, H] = opt("size", "390x844").split("x").map(Number);
const fps = Number(opt("fps", 10));
const dpr = Number(opt("dpr", 1.5));
const level = opt("level", "low");
const suffix = opt("suffix", "");

// Each step: { gait, view, slow, s } (s: seconds of the clip); the
// "controls" scene also opens the tuning panel (open), moves a slider to a
// value over the step (slide: [input id, value]) and resets (reset).
const SCENES = {
  stand: [
    { gait: "stand", view: "front", slow: 1, s: 2 },
    { view: "three", s: 2 },
    { view: "side", s: 2 },
  ],
  walk: [
    { gait: "walk", view: "side", slow: 1, s: 3 },
    { slow: 0.25, s: 3 },
    { view: "front", slow: 1, s: 2 },
    { view: "three", s: 2 },
  ],
  controls: [
    { gait: "walk", view: "side", slow: 1, s: 1.5 },
    { open: true, s: 1 },
    { slide: ["t-walk-knee-scale", 1.4], s: 2 },
    { slide: ["t-walk-hip-scale", 1.3], s: 2 },
    { slide: ["t-walk-shoulder-swing", 40], s: 2 },
    { slide: ["t-walk-lean", 14], s: 2 },
    { s: 1.5 },
    { reset: true, s: 2 },
  ],
  run: [
    { gait: "run", view: "side", slow: 1, s: 3 },
    { slow: 0.25, s: 3 },
    { view: "front", slow: 1, s: 2 },
    { view: "three", s: 2 },
  ],
};

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
fs.mkdirSync(outDir, { recursive: true });

for (const name of names) {
  const scene = SCENES[name];
  if (!scene) throw new Error(`No scene "${name}" (${Object.keys(SCENES).join(", ")}).`);
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: dpr,
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(
    `${base}worlds/lab/?labs=1&renderer=webgl2&level=${level}&clock=manual&tuning=default&gait=${scene[0].gait}`,
  );
  await page.waitForFunction(() => document.body.dataset.ready === "true", null, {
    timeout: 240_000,
  });
  // One cycle first, so the chart's red curve is whole from the first frame.
  for (let i = 0; i < 70; i++) await page.evaluate(() => window.__lab.tick(1 / 60));
  const frames = [];
  for (const st of scene) {
    await page.evaluate(
      (st) => window.__lab.set({ gait: st.gait, view: st.view, slow: st.slow }),
      st,
    );
    if (st.open) await page.click("#tune-toggle");
    if (st.reset) await page.click("#tune-reset");
    const from = st.slide ? Number(await page.locator(`#${st.slide[0]}`).inputValue()) : 0;
    if (st.slide) await page.locator(`#${st.slide[0]}`).scrollIntoViewIfNeeded();
    const n = st.s * fps;
    for (let i = 0; i < n; i++) {
      // The slider moves over the first two thirds of the step.
      if (st.slide) {
        const k = Math.min(1, (i + 1) / Math.max(1, Math.round(n * 0.66)));
        const step = Number(await page.locator(`#${st.slide[0]}`).getAttribute("step"));
        const v = Math.round((from + (st.slide[1] - from) * k) / step) * step;
        await page.locator(`#${st.slide[0]}`).fill(String(Number(v.toFixed(2))));
      }
      await page.evaluate((dt) => window.__lab.tick(dt), 1 / fps);
      const png = PNG.sync.read(await page.screenshot({ timeout: 180_000 }));
      const w = Math.round(png.width / dpr);
      const h = Math.round(png.height / dpr);
      frames.push({ rgba: shrink(png, w, h), w, h });
      if (frames.length % fps === 0) console.log(`  ${name}: ${frames.length / fps} s recorded`);
    }
  }
  await ctx.close();
  const gif = GIFEncoder();
  const delay = Math.round(1000 / fps);
  for (const f of frames) {
    const palette = quantize(f.rgba, 256, { format: "rgb565" });
    gif.writeFrame(applyPalette(f.rgba, palette, "rgb565"), f.w, f.h, { palette, delay, repeat: 0 }); // prettier-ignore
  }
  gif.finish();
  const file = path.join(outDir, `wd-lab-${name}${suffix}.gif`);
  fs.writeFileSync(file, gif.bytes());
  console.log(`${file}: ${frames.length} frames, ${(fs.statSync(file).size / 1e6).toFixed(1)} MB`);
}
await browser.close();

// Box-filters an RGBA PNG down to w x h.
function shrink(png, w, h) {
  const out = new Uint8ClampedArray(w * h * 4);
  const sx = png.width / w;
  const sy = png.height / h;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const acc = [0, 0, 0, 0];
      let n = 0;
      for (let yy = Math.floor(y * sy); yy < Math.floor((y + 1) * sy); yy++)
        for (let xx = Math.floor(x * sx); xx < Math.floor((x + 1) * sx); xx++) {
          const i = (yy * png.width + xx) * 4;
          for (let k = 0; k < 4; k++) acc[k] += png.data[i + k];
          n++;
        }
      const o = (y * w + x) * 4;
      for (let k = 0; k < 4; k++) out[o + k] = acc[k] / Math.max(1, n);
    }
  return out;
}

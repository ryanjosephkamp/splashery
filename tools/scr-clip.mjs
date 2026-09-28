#!/usr/bin/env node
// Clips of lane Screens' toys for the Effect review page: the Screen (each
// style switching on and playing its sample) and the Gaussian splatting
// toy (each view's tap), at phone size (390x844) with the app round them.
// The clock is stepped by hand, and a video is stepped by seeking it to
// the clip's own time, so a clip plays at its real speed however slow the
// renderer is.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/scr-clip.mjs <out-dir> [--width=360] [--fps=12] [--dpr=1] [scene ...]
//
// Scenes: screen-tv, screen-flat, screen-cinema, screen-hologram,
// screen-gif (the old TV with the GIF sample), splat-training, splat-one,
// splat-many, splat-sorting. Writes <out-dir>/scr-<scene>.gif and a strip
// of six frames, <out-dir>/scr-<scene>-strip.png.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { GIFEncoder, quantize, applyPalette } from "../vendor/gifenc/gifenc.esm.js";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [outDir, ...scenes] = args.filter((a) => !a.startsWith("--"));
if (!outDir) throw new Error("Usage: node tools/scr-clip.mjs <out-dir> [scene ...]");
const width = Number(opt("width", 360));
const fps = Number(opt("fps", 12));

// Each scene: the toy, its options, seconds before the tap and after it,
// and extra taps ([seconds after the first, ...]).
const SCENES = {
  "screen-tv": { toy: "screen", options: { style: "tv" }, before: 0.6, after: 4.5 },
  "screen-flat": { toy: "screen", options: { style: "flat" }, before: 0.6, after: 4.5 },
  "screen-cinema": { toy: "screen", options: { style: "cinema" }, before: 0.6, after: 5 },
  "screen-hologram": { toy: "screen", options: { style: "hologram" }, before: 0.6, after: 4.5 },
  "screen-gif": { toy: "screen", options: { style: "tv", sample: "gif" }, before: 0.6, after: 4 },
  "splat-training": { toy: "gaussian-splatting", options: { view: "training" }, before: 0.8, after: 8 }, // prettier-ignore
  "splat-one": { toy: "gaussian-splatting", options: { view: "one" }, before: 0.6, after: 3 },
  "splat-many": { toy: "gaussian-splatting", options: { view: "many" }, before: 0.6, after: 4 },
  "splat-sorting": { toy: "gaussian-splatting", options: { view: "sorting" }, before: 0.6, after: 6 }, // prettier-ignore
};
const list = scenes.length ? scenes : Object.keys(SCENES);
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"], // prettier-ignore
});

// Scales an RGBA image down by box filtering to `w` wide.
function shrink(png, w) {
  const f = png.width / w;
  const h = Math.round(png.height / f);
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const acc = [0, 0, 0];
      let n = 0;
      for (let yy = Math.floor(y * f); yy < Math.min(png.height, Math.floor((y + 1) * f)); yy++)
        for (let xx = Math.floor(x * f); xx < Math.min(png.width, Math.floor((x + 1) * f)); xx++) {
          const o = (yy * png.width + xx) * 4;
          acc[0] += png.data[o];
          acc[1] += png.data[o + 1];
          acc[2] += png.data[o + 2];
          n++;
        }
      const o = (y * w + x) * 4;
      out[o] = acc[0] / n;
      out[o + 1] = acc[1] / n;
      out[o + 2] = acc[2] / n;
      out[o + 3] = 255;
    }
  return { data: out, w, h };
}

async function record(name) {
  const sc = SCENES[name];
  if (!sc) throw new Error(`Unknown scene ${name}`);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: Number(opt("dpr", 1)) }); // prettier-ignore
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(`${base}?renderer=webgl2&adapt=off&profile=mid&labs=1`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(
    async ({ toy, options }) => {
      const { app, player } = window.__splashery;
      await app.chooseToy(toy);
      await app.setToyOptions(options);
      player.opts.idleDelay = 1e9;
      player.idle.weight = 0;
    },
    { toy: sc.toy, options: sc.options },
  );
  // Wait for the picture sheets (if any) to be built and shown.
  await page.waitForFunction(
    () => {
      const p = window.__splashery.player.pictures;
      window.__splashery.player.stage.requestRender();
      return !p || (p.media && p.sheets.every((s) => !s.want || s.shown?.key === s.want.key));
    },
    null,
    { timeout: 120_000 },
  );
  await page.waitForTimeout(1200);
  // Take over the clock: each frame advances exactly one step.
  await page.evaluate(() => {
    const { player } = window.__splashery;
    const stage = player.stage;
    const handlers = stage.updateHandlers.slice();
    window.__clip = { pending: 0, videoT: null };
    stage.updateHandlers.length = 0;
    stage.updateHandlers.push(() => {
      const d = window.__clip.pending;
      window.__clip.pending = 0;
      for (const h of handlers) h(d);
    });
  });
  const step = 1 / fps;
  const frames = [];
  const shot = async () => {
    const url = await page.evaluate(async (step) => {
      const { player } = window.__splashery;
      const stage = player.stage;
      const pics = player.pictures;
      const clip = window.__clip;
      const m = pics?.media;
      // A video that the toy started is stepped by hand from then on.
      if (m?.kind === "video") {
        if (m.playing && clip.videoT === null) clip.videoT = m.video.currentTime;
        if (m.playing) m.video.pause();
        if (clip.videoT !== null) {
          clip.videoT = (clip.videoT + step) % Math.max(0.1, m.duration);
          await new Promise((r) => {
            m.video.addEventListener("seeked", r, { once: true });
            setTimeout(r, 1500);
            m.seek(clip.videoT);
          });
          pics.frameDirty = true;
        }
      }
      clip.pending = 0;
      await stage.captureFrame();
      for (let i = 0; i < 40 && pics?.uploading; i++) await new Promise((r) => setTimeout(r, 25));
      clip.pending = step;
      await stage.captureFrame();
      clip.pending = 0;
      const c = await stage.captureFrame();
      // The page's own background under the splats (the canvas is clear).
      const out = document.createElement("canvas");
      out.width = c.width;
      out.height = c.height;
      const g = out.getContext("2d");
      g.fillStyle = getComputedStyle(document.body).backgroundColor || "#fff";
      g.fillRect(0, 0, out.width, out.height);
      g.drawImage(c, 0, 0);
      return out.toDataURL("image/png");
    }, step);
    const png = PNG.sync.read(Buffer.from(url.split(",")[1], "base64"));
    frames.push(shrink(png, width));
    if (process.env.SCR_DEBUG)
      console.log(name, frames.length, new Date().toISOString().slice(11, 19));
  };
  for (let t = 0; t < sc.before - 1e-6; t += step) await shot();
  await page.evaluate(() => window.__splashery.player.act());
  for (let t = 0; t < sc.after - 1e-6; t += step) await shot();
  await page.close();
  // One palette for the whole clip (from frames across it).
  const every = Math.max(1, Math.floor(frames.length / 12));
  const sample = frames.filter((f, i) => i % every === 0).map((f) => f.data);
  const all = new Uint8Array(sample.reduce((n, d) => n + d.length, 0));
  sample.reduce((o, d) => (all.set(d, o), o + d.length), 0);
  const palette = quantize(all, 256, { format: "rgb565" });
  const gif = GIFEncoder();
  const delay = Math.round(1000 / fps);
  frames.forEach((f, i) => {
    const hold = i === frames.length - 1 ? 1200 : delay;
    gif.writeFrame(applyPalette(f.data, palette, "rgb565"), f.w, f.h, { palette, delay: hold, repeat: 0 }); // prettier-ignore
  });
  gif.finish();
  const file = path.join(outDir, `scr-${name}.gif`);
  fs.writeFileSync(file, gif.bytes());
  const pick = [0, 1, 2, 3, 4, 5].map((k) => frames[Math.round((k * (frames.length - 1)) / 5)]);
  const sw = pick[0].w;
  const sh = pick[0].h;
  const strip = new PNG({ width: sw * 6, height: sh });
  pick.forEach((im, k) => {
    for (let y = 0; y < sh; y++) strip.data.set(im.data.subarray(y * sw * 4, (y + 1) * sw * 4), (y * sw * 6 + k * sw) * 4); // prettier-ignore
  });
  fs.writeFileSync(path.join(outDir, `scr-${name}-strip.png`), PNG.sync.write(strip));
  console.log(`${file}: ${frames.length} frames, ${Math.round(gif.bytes().length / 1024)} KB`);
}

for (const s of list) await record(s);
await browser.close();

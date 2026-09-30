#!/usr/bin/env node
// Clips of lane Screens r2's Screen for the Effect review page, at phone
// size (390x844) with the GIF sample: switching off, the power knob and
// button, the curtains, a slow turn of each set (before and after, side by
// side) and a still of each style. The clock is stepped by hand, so a clip
// plays at its real speed however slow the renderer is (the GIF follows
// the same clock).
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/scr2-clip.mjs <out-dir> [--fps=12] [--width=360] [--before=<url>] [scene ...]
//
// Scenes: off, power, curtains, sets (needs --before, the site as it was:
// main before this lane), stills. Writes <out-dir>/scr2-<scene>.gif (the
// stills: scr2-stills.png) and a strip of six frames for each clip.

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
if (!outDir) throw new Error("Usage: node tools/scr2-clip.mjs <out-dir> [scene ...]");
const width = Number(opt("width", 360));
const fps = Number(opt("fps", 12));
const before = opt("before", "");
const step = 1 / fps;
fs.mkdirSync(outDir, { recursive: true });

// Where each style's switch is, and a point on its picture (recipe
// coordinates, src/packs/screens.js).
const SWITCH = {
  tv: [0.72, 0.42, 0.26],
  flat: [0.07, -0.453, 0.05],
  cinema: [-1.5, 0.6, -0.4],
  hologram: [0, -0.8, 0.5],
};
const ON_TIME = { tv: 1.5, flat: 1.4, cinema: 1.9, hologram: 1.5 };
// The band of the page each style stands in (top, height in CSS pixels).
const CROP = [40, 470];

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
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

// Opens the Screen in a style, with the clock under our control.
async function open(style, { url = base, dpr = 1 } = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr }); // prettier-ignore
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(`${url}?renderer=webgl2&adapt=off&profile=mid&labs=1`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(async (style) => {
    const { app, player } = window.__splashery;
    await app.chooseToy("screen");
    await app.setToyOptions({ style, sample: "gif" });
    player.opts.idleDelay = 1e9;
    player.idle.weight = 0;
  }, style);
  await page.waitForFunction(
    () => {
      const p = window.__splashery.player.pictures;
      window.__splashery.player.stage.requestRender();
      return p?.media && p.sheets.every((s) => !s.want || s.shown?.key === s.want.key);
    },
    null,
    { timeout: 120_000 },
  );
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const { player } = window.__splashery;
    const stage = player.stage;
    const handlers = stage.updateHandlers.slice();
    window.__clip = { pending: 0, cam: player.camera.getState() };
    stage.updateHandlers.length = 0;
    stage.updateHandlers.push(() => {
      const d = window.__clip.pending;
      window.__clip.pending = 0;
      for (const h of handlers) h(d);
    });
  });
  return page;
}

// Advances the clock one step (with the camera at zoom z and turned by yaw
// radians from where it started); returns the frame if `keep`.
async function frame(page, { zoom = 1, yaw = 0, keep = true } = {}) {
  const url = await page.evaluate(
    async ([step, zoom, yaw, keep, crop]) => {
      const { player } = window.__splashery;
      const stage = player.stage;
      const pics = player.pictures;
      const clip = window.__clip;
      const c0 = clip.cam;
      player.camera.setState({ ...c0, distance: c0.distance * zoom, yaw: c0.yaw + yaw }, { snap: true }); // prettier-ignore
      clip.pending = 0;
      await stage.captureFrame();
      for (let i = 0; i < 40 && pics?.uploading; i++) await new Promise((r) => setTimeout(r, 25));
      clip.pending = step;
      await stage.captureFrame();
      clip.pending = 0;
      const c = await stage.captureFrame();
      if (!keep) return null;
      const k = c.width / window.innerWidth;
      const top = Math.round(crop[0] * k);
      const out = document.createElement("canvas");
      out.width = c.width;
      out.height = Math.min(c.height - top, Math.round(crop[1] * k));
      const g = out.getContext("2d");
      g.fillStyle = getComputedStyle(document.body).backgroundColor || "#fff";
      g.fillRect(0, 0, out.width, out.height);
      g.drawImage(c, 0, -top);
      return out.toDataURL("image/png");
    },
    [step, zoom, yaw, keep, CROP],
  );
  return url ? PNG.sync.read(Buffer.from(url.split(",")[1], "base64")) : null;
}

// A tap: on a recipe point (as a tap on the toy there), or the Toy tab's
// button (null).
async function tap(page, point) {
  await page.evaluate((point) => {
    const { player } = window.__splashery;
    player.act(point ? player.fromRecipe(point) : null);
  }, point);
}

// Runs `seconds` of the clip, keeping frames; `cam(t)` gives the camera.
async function run(page, frames, seconds, cam = () => ({})) {
  for (let t = 0; t < seconds - 1e-6; t += step) {
    const png = await frame(page, cam(t));
    frames.push(shrink(png, width));
  }
}

// Switches the set on and lets it settle, without recording.
async function switchOn(page, style) {
  await tap(page, null);
  for (let t = 0; t < ON_TIME[style] + 0.5; t += step) await frame(page, { keep: false });
}

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

function writeGif(name, frames) {
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
  const file = path.join(outDir, `scr2-${name}.gif`);
  fs.writeFileSync(file, gif.bytes());
  const pick = [0, 1, 2, 3, 4, 5].map((k) => frames[Math.round((k * (frames.length - 1)) / 5)]);
  const sw = pick[0].w;
  const sh = pick[0].h;
  const strip = new PNG({ width: sw * 6, height: sh });
  pick.forEach((im, k) => {
    for (let y = 0; y < sh; y++) strip.data.set(im.data.subarray(y * sw * 4, (y + 1) * sw * 4), (y * sw * 6 + k * sw) * 4); // prettier-ignore
  });
  fs.writeFileSync(path.join(outDir, `scr2-${name}-strip.png`), PNG.sync.write(strip));
  console.log(`${file}: ${frames.length} frames, ${Math.round(gif.bytes().length / 1024)} KB`);
}

// Two frames side by side, with a thin gap.
function beside(a, b) {
  const gap = 6;
  const w = a.w + gap + b.w;
  const h = Math.max(a.h, b.h);
  const data = new Uint8Array(w * h * 4).fill(255);
  for (let y = 0; y < h; y++) {
    if (y < a.h) data.set(a.data.subarray(y * a.w * 4, (y + 1) * a.w * 4), y * w * 4);
    if (y < b.h) data.set(b.data.subarray(y * b.w * 4, (y + 1) * b.w * 4), (y * w + a.w + gap) * 4); // prettier-ignore
  }
  return { data, w, h };
}

const SCENES = {
  // Each of the three styles, playing the GIF, switched off by its switch,
  // then zoomed in close and held for two seconds.
  async off() {
    const frames = [];
    for (const style of ["tv", "flat", "cinema"]) {
      const page = await open(style);
      await switchOn(page, style);
      await run(page, frames, 1);
      await tap(page, SWITCH[style]);
      await run(page, frames, 2.2);
      await run(page, frames, 2.8, (t) => ({ zoom: 1 - 0.5 * smooth(t / 0.8) }));
      await page.close();
    }
    writeGif("off", frames);
  },
  // The old TV's knob and the flat TV's button: off, then on again.
  async power() {
    const frames = [];
    for (const style of ["tv", "flat"]) {
      const page = await open(style);
      await switchOn(page, style);
      await run(page, frames, 0.8);
      await tap(page, SWITCH[style]);
      await run(page, frames, 2.4);
      await tap(page, SWITCH[style]);
      await run(page, frames, 2.4);
      await page.close();
    }
    writeGif("power", frames);
  },
  // The cinema's curtains, tapped closed and open again.
  async curtains() {
    const frames = [];
    const page = await open("cinema");
    await switchOn(page, "cinema");
    await run(page, frames, 0.8);
    await tap(page, SWITCH.cinema);
    await run(page, frames, 3);
    await tap(page, [0, 0.6, -0.4]);
    await run(page, frames, 3);
    await page.close();
    writeGif("curtains", frames);
  },
  // A slow turn of each style, switched on: before (left) and after
  // (right).
  async sets() {
    if (!before) throw new Error("sets needs --before=<url of the site before this lane>");
    const turn = (t) => ({ yaw: 0.55 * Math.sin((t / 5) * 2 * Math.PI) });
    const frames = [];
    for (const style of ["tv", "flat", "cinema", "hologram"]) {
      const pair = [];
      for (const url of [before, base]) {
        const page = await open(style, { url });
        await switchOn(page, style);
        const f = [];
        await run(page, f, 5, turn);
        pair.push(f);
        await page.close();
      }
      for (let i = 0; i < pair[0].length; i++) frames.push(beside(pair[0][i], pair[1][i]));
    }
    writeGif("sets", frames);
  },
  // A sharp still of each style, switched on, at twice the resolution.
  async stills() {
    const shots = [];
    for (const style of ["tv", "flat", "cinema", "hologram"]) {
      const page = await open(style, { dpr: 2 });
      await switchOn(page, style);
      shots.push(await frame(page));
      await page.close();
    }
    const [w, h] = [shots[0].width, shots[0].height];
    const out = new PNG({ width: w * 2, height: h * 2 });
    shots.forEach((s, i) => {
      const ox = (i % 2) * w;
      const oy = Math.floor(i / 2) * h;
      for (let y = 0; y < h; y++) s.data.copy(out.data, ((oy + y) * w * 2 + ox) * 4, y * w * 4, (y + 1) * w * 4); // prettier-ignore
    });
    const file = path.join(outDir, "scr2-stills.png");
    fs.writeFileSync(file, PNG.sync.write(out));
    console.log(file);
  },
};

for (const s of scenes.length ? scenes : Object.keys(SCENES)) {
  if (!SCENES[s]) throw new Error(`Unknown scene ${s}`);
  await SCENES[s]();
}
await browser.close();

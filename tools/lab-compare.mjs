#!/usr/bin/env node
// Lane Lab r2: a before-and-after clip of one toy across several option sets,
// the "before" from another checkout (main, served on another port) and the
// "after" from this one, side by side at 390×844, turning slowly.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &          (this branch)
//   (cd <main checkout> && python3 -m http.server 4174 --bind 127.0.0.1 &)
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/lab-compare.mjs <out.gif> <toy id> "preset=sphere" "preset=torus" … [--before=http://127.0.0.1:4174/] [--after=http://127.0.0.1:4173/] [--secs=2] [--fps=10] [--turn=24] [--strip=<out.png>]
//
// Each option set plays --secs, turning out and back by --turn degrees; the
// toy's clock is stepped by hand. --strip writes one still per option set,
// the pairs stacked.

import { chromium } from "@playwright/test";
import { GIFEncoder, quantize, applyPalette } from "../vendor/gifenc/gifenc.esm.js";
import fs from "node:fs";
import { PNG } from "pngjs";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [out, id, ...sets] = args.filter((a) => !a.startsWith("--"));
if (!out || !id || !sets.length) throw new Error("Usage: node tools/lab-compare.mjs <out.gif> <toy id> key=value[,key=value] …"); // prettier-ignore
const before = opt("before", "http://127.0.0.1:4174/");
const after = opt("after", "http://127.0.0.1:4173/");
const secs = Number(opt("secs", 2));
const fps = Number(opt("fps", 10));
const turn = Number(opt("turn", 24));
const strip = opt("strip", "");
const W = 390;
const H = 844;

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});

// Frames (RGBA arrays) of every option set, from one checkout.
async function render(base) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(`${base}?renderer=webgl2&profile=high&adapt=off&labs=1`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  const all = [];
  for (const set of sets) {
    const frames = await page.evaluate(
      async ({ id, set, W, H, n, turn }) => {
        const { app, player } = window.__splashery;
        await app.chooseToy(id);
        for (const kv of set.split(",")) {
          const [k, v] = kv.split("=");
          await app.setToyOption(k, v);
        }
        const { findToy } = await import("/src/toys.js");
        const def = findToy(id)?.camera;
        if (def) player.camera.setState(def, { asHome: true, snap: true });
        app.setLook({ background: "#ffffff" });
        player.opts.idleDelay = 1e9;
        player.idle.weight = 0;
        player.camera.setTurntable(false);
        const stage = player.stage;
        stage.setFixedSize([W, H]);
        const cam = player.camera;
        const view = { ...cam.home };
        const put = (v) => {
          cam.cur = { ...v };
          cam.tgt = { ...v };
        };
        const handlers = stage.updateHandlers.slice();
        let pending = 0;
        stage.updateHandlers.length = 0;
        stage.updateHandlers.push(() => {
          const d = pending;
          pending = 0;
          for (const h of handlers) h(d);
        });
        put(view);
        for (let i = 0; i < 4; i++) await stage.captureFrame();
        const out = [];
        for (let k = 0; k < n; k++) {
          pending = 0.1;
          const f = Math.sin((Math.PI * 2 * k) / n);
          put({ ...view, yaw: view.yaw + (f * turn * Math.PI) / 360 });
          await stage.captureFrame();
          const c = await stage.captureFrame();
          out.push(c.toDataURL("image/png"));
        }
        stage.setFixedSize(null);
        stage.updateHandlers.length = 0;
        stage.updateHandlers.push(...handlers);
        return out;
      },
      { id, set, W, H, n: Math.round(secs * fps), turn },
    );
    all.push(frames.map((url) => PNG.sync.read(Buffer.from(url.split(",")[1], "base64")).data));
    console.log(base, set, frames.length, "frames");
  }
  await page.close();
  return all;
}

const A = await render(before);
const B = await render(after);
await browser.close();

// Side by side, with a gray gap; one GIF through every option set.
const gap = 6;
const cw = W * 2 + gap;
const enc = GIFEncoder();
const stills = [];
for (let s = 0; s < sets.length; s++)
  for (let k = 0; k < A[s].length; k++) {
    const rgba = new Uint8ClampedArray(cw * H * 4).fill(136);
    for (const [side, frames] of [
      [0, A[s]],
      [1, B[s]],
    ]) {
      const src = frames[k];
      for (let y = 0; y < H; y++) {
        const o = (y * cw + side * (W + gap)) * 4;
        for (let x = 0; x < W * 4; x++) rgba[o + x] = src[y * W * 4 + x];
      }
    }
    const palette = quantize(rgba, 256, { format: "rgb565" });
    enc.writeFrame(applyPalette(rgba, palette, "rgb565"), cw, H, { palette, delay: Math.round(1000 / fps), repeat: 0 }); // prettier-ignore
    if (k === 0) stills.push(rgba);
  }
enc.finish();
fs.writeFileSync(out, Buffer.from(enc.bytes()));
console.log(out, (enc.bytes().length / 1024).toFixed(0), "KB");
if (strip) {
  const png = new PNG({ width: cw, height: H * stills.length });
  stills.forEach((rgba, i) => png.data.set(rgba, i * cw * H * 4));
  fs.writeFileSync(strip, PNG.sync.write(png));
}

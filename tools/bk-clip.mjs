#!/usr/bin/env node
// Clips of lane Books' toys for the Effect review page: Your book, the
// photo album and the picture frame at 390x844. The app runs with its clock
// stepped by hand (12 steps a second); pages are built in real time, and
// each step waits until the pages it shows are built, so turns play at
// their own speed however slow the renderer.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/bk-clip.mjs <out-dir> [scene ...]
//
// Scenes: book (opening, turning, one style change), book-styles (the five
// styles), book-long (paging through a 300-page PDF), album, frame (the
// swing), frame-digital. Writes <out-dir>/bk-<scene>.gif and a strip of six
// frames, bk-<scene>-strip.png. Uses the fixtures in tests/fixtures/bk/
// (tools/bk-samples.mjs).

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
if (!outDir) throw new Error("Usage: node tools/bk-clip.mjs <out-dir> [scene ...]");
const ALL = ["book", "book-styles", "book-long", "album", "frame", "frame-digital"];
const list = scenes.length ? scenes : ALL;
fs.mkdirSync(outDir, { recursive: true });
const FIX = `${base}tests/fixtures/bk/`;
const STEP = 1 / 12;

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

async function record(scene) {
  const width = Number(opt("width", 360));
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); // prettier-ignore
  await page.goto(`${base}?renderer=webgl2&adapt=off&profile=mid&labs=1`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  const frames = [];
  const run = (fn, arg) => page.evaluate(fn, arg);
  const settle = () =>
    page.waitForFunction(
      () => {
        const p = window.__splashery.player.pictures;
        window.__splashery.player.stage.requestRender();
        return p?.media && p.sheets.every((s) => !s.want || s.shown?.key === s.want.key) && p.splats() > 0; // prettier-ignore
      },
      null,
      { timeout: 120_000 },
    );
  // A couple of real frames, so the stage draws the stepped moment.
  const draw = async () => {
    for (let i = 0; i < 3; i++)
      await run(() => new Promise((r) => {
        window.__splashery.player.stage.requestRender();
        requestAnimationFrame(() => requestAnimationFrame(r));
      })); // prettier-ignore
  };
  const shot = async (holdMs) => {
    const png = PNG.sync.read(await page.screenshot({ timeout: 180_000 }));
    frames.push({ img: shrink(png, width), delay: holdMs });
  };
  // Steps the clock `seconds` on, a frame each 1/12 s.
  const play = async (seconds) => {
    for (let t = 0; t < seconds - 1e-6; t += STEP) {
      await run((dt) => {
        const pl = window.__splashery.player;
        pl.time += dt;
        pl.stage.requestRender();
      }, STEP);
      await draw();
      await settle();
      await draw();
      await shot(Math.round(STEP * 1000));
    }
  };
  const hold = async (ms) => {
    await settle();
    await draw();
    await shot(ms);
  };
  // Opens a toy (options, a file), then freezes the clock.
  const open = async (id, options = {}, url = null) => {
    await run(() => (window.__splashery.player.frozen = false));
    await run(
      async ([id, options, url]) => {
        const app = window.__splashery.app;
        if (window.__splashery.player.scene.toy.id !== id) await app.chooseToy(id);
        for (const [k, v] of Object.entries(options)) await app.setToyOption(k, v);
        if (url) await app.openMedia(url);
      },
      [id, options, url],
    );
    await settle();
    await page.waitForTimeout(400);
    await run(() => (window.__splashery.player.frozen = true));
    await draw();
  };
  const tap = () => run(() => window.__splashery.player.act());

  if (scene === "book") {
    await open("your-book", {}, `${FIX}booklet.pdf`);
    await hold(1400);
    for (let i = 0; i < 4; i++) {
      await tap();
      await play(1.25);
      await hold(i === 0 ? 900 : 700);
    }
    // One style change: the paperback, opened and a page turned.
    await open("your-book", { style: "paperback" });
    await hold(1200);
    for (let i = 0; i < 2; i++) {
      await tap();
      await play(1.25);
      await hold(800);
    }
  } else if (scene === "book-styles") {
    for (const style of ["hardcover", "paperback", "magazine", "stapled", "spiral"]) {
      await open("your-book", { style }, style === "hardcover" ? `${FIX}booklet.pdf` : null);
      await hold(1000);
      for (let i = 0; i < 2; i++) {
        await tap();
        await play(style === "stapled" ? 1.1 : 1.25);
      }
      await hold(900);
    }
  } else if (scene === "book-long") {
    await open("your-book", {}, `${FIX}pages300.pdf`);
    await hold(900);
    for (let i = 0; i < 3; i++) {
      await tap();
      await play(1.2);
    }
    await hold(700);
    for (const p of [99, 199, 298]) {
      await run((p) => window.__splashery.player.pictures.go(p), p);
      await play(0.25);
      await hold(1100);
    }
    // Next in the Toy tab turns a spread from there.
    await run(() => window.__splashery.app.pictureStep(1));
    await play(1.2);
    await hold(1000);
  } else if (scene === "album") {
    await open("photo-album");
    await hold(1200);
    for (let i = 0; i < 4; i++) {
      await tap();
      await play(1.3);
      await hold(900);
    }
    await open("photo-album", { cover: "scrapbook" });
    await hold(900);
    await tap();
    await play(1.3);
    await hold(1200);
  } else if (scene === "frame") {
    await open("picture-frame");
    await hold(900);
    await tap();
    await play(3.2);
    await hold(800);
    await open("picture-frame", { frame: "gold" });
    await hold(700);
    await tap();
    await play(3.2);
    await hold(800);
  } else if (scene === "frame-digital") {
    await open("picture-frame", { frame: "digital" });
    await play(15);
    await tap();
    await play(3.2);
  }
  await page.close();
  // One palette for the whole clip, from a sample of its frames.
  const step = Math.max(1, Math.floor(frames.length / 12));
  const sample = frames.filter((f, i) => i % step === 0).map((f) => f.img.data);
  const all = new Uint8Array(sample.reduce((n, d) => n + d.length, 0));
  sample.reduce((o, d) => (all.set(d, o), o + d.length), 0);
  const palette = quantize(all, 256, { format: "rgb565" });
  const gif = GIFEncoder();
  for (const f of frames)
    gif.writeFrame(applyPalette(f.img.data, palette, "rgb565"), f.img.w, f.img.h, { palette, delay: f.delay, repeat: 0 }); // prettier-ignore
  gif.finish();
  const file = path.join(outDir, `bk-${scene}.gif`);
  fs.writeFileSync(file, gif.bytes());
  const pick = [0, 1, 2, 3, 4, 5].map((k) => frames[Math.round((k * (frames.length - 1)) / 5)].img);
  const sw = pick[0].w;
  const sh = pick[0].h;
  const strip = new PNG({ width: sw * 6, height: sh });
  pick.forEach((im, k) => {
    for (let y = 0; y < sh; y++) strip.data.set(im.data.subarray(y * sw * 4, (y + 1) * sw * 4), (y * sw * 6 + k * sw) * 4); // prettier-ignore
  });
  fs.writeFileSync(path.join(outDir, `bk-${scene}-strip.png`), PNG.sync.write(strip));
  console.log(`${file}: ${frames.length} frames, ${Math.round(gif.bytes().length / 1024)} KB`);
}

for (const s of list) await record(s);
await browser.close();

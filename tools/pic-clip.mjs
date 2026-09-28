#!/usr/bin/env node
// Clips of the Picture lab for the Effect review page (lane Pictures): the
// app is recorded as it runs (pages are built in real time, so the clock
// is not stepped as in effect-clip.mjs), frame by frame from screenshots,
// into a looping GIF.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/pic-clip.mjs <out-dir> [--width=360] [scene ...]
//
// Scenes: pdf-phone (the sample article whole, then zoomed, at 390x844),
// pages (a 200-page PDF paged through), photo (the photo sample), gif,
// video (a WebM playing), desktop (the article at 1440x900). Writes
// <out-dir>/pic-<scene>.gif. Uses the test fixtures in tests/fixtures/pic/.

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
if (!outDir) throw new Error("Usage: node tools/pic-clip.mjs <out-dir> [scene ...]");
const ALL = ["pdf-phone", "pages", "photo", "gif", "video", "desktop"];
const list = scenes.length ? scenes : ALL;
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

async function record(scene) {
  const desktop = scene === "desktop";
  const vw = desktop ? 1440 : 390;
  const vh = desktop ? 900 : 844;
  const width = Number(opt("width", desktop ? 720 : 360));
  const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: desktop ? 1 : 2 }); // prettier-ignore
  await page.goto(`${base}?renderer=webgl2&adapt=off&profile=mid&labs=1`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  const fix = `${base}tests/fixtures/pic/`;
  await page.evaluate(async (scene) => {
    const app = window.__splashery.app;
    if (scene === "photo")
      await app.chooseToy("picture-lab").then(() => app.setToyOption("sample", "photo")); // prettier-ignore
    else await app.chooseToy("picture-lab");
  }, scene);
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
  await settle();
  if (scene === "pages") await page.evaluate((u) => window.__splashery.app.openMedia(u), `${fix}pages200.pdf`); // prettier-ignore
  if (scene === "gif") await page.evaluate((u) => window.__splashery.app.openMedia(u), `${fix}anim.gif`); // prettier-ignore
  if (scene === "video") await page.evaluate((u) => window.__splashery.app.openMedia(u), `${fix}clip.webm`); // prettier-ignore
  await settle();
  await page.waitForTimeout(800);
  const frames = [];
  let last = Date.now();
  const shot = async (holdMs = 0) => {
    const png = PNG.sync.read(await page.screenshot());
    const now = Date.now();
    frames.push({ img: shrink(png, width), delay: Math.max(60, holdMs || now - last) });
    last = Date.now();
  };
  const run = (fn, arg) => page.evaluate(fn, arg);
  if (scene === "pdf-phone" || scene === "desktop") {
    await shot(1500);
    // Zoom in on the page, in steps, and let it sharpen.
    for (let i = 0; i < 10; i++) {
      await run(() => {
        window.__splashery.player.camera.zoomBy(0.84);
        window.__splashery.player.stage.requestRender();
      });
      await page.waitForTimeout(120);
      await shot(160);
    }
    await settle();
    await page.waitForTimeout(600);
    await shot(2200);
    // Move up to the title, as a finger would, then down the page.
    for (const [dx, dy, n] of [
      [0, 45, 8],
      [30, -40, 10],
    ]) {
      for (let i = 0; i < n; i++) {
        await run(([dx, dy]) => window.__splashery.player.panBy(dx, dy), [dx, dy]);
        await page.waitForTimeout(80);
        await shot(140);
      }
      await settle();
      await page.waitForTimeout(400);
      await shot(2200);
    }
    // And back out.
    await run(() => window.__splashery.player.resetCamera());
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(150);
      await shot(160);
    }
    await settle();
    await shot(1200);
  } else if (scene === "pages") {
    await shot(1000);
    for (let i = 0; i < 8; i++) {
      await run(() => window.__splashery.player.act());
      await settle();
      await shot(500);
    }
    for (const p of [49, 99, 149, 199]) {
      await run((p) => window.__splashery.player.pictures.go(p), p);
      await settle();
      await shot(700);
    }
  } else if (scene === "photo") {
    await shot(1500);
    for (let i = 0; i < 6; i++) {
      await run(() => {
        window.__splashery.player.camera.zoomBy(0.8);
        window.__splashery.player.stage.requestRender();
      });
      await page.waitForTimeout(120);
      await shot(160);
    }
    await settle();
    await page.waitForTimeout(600);
    await shot(2400);
  } else if (scene === "gif") {
    // The clock is stepped by hand: 12 steps a second, for four seconds.
    await run(() => (window.__splashery.player.frozen = true));
    for (let i = 0; i < 48; i++) {
      await run((t) => {
        const pl = window.__splashery.player;
        pl.time = t;
        pl.stage.requestRender();
      }, i / 12);
      await page.waitForTimeout(250);
      await shot(83);
    }
  } else {
    // The video is stepped through by seeking, 10 frames a second.
    await run(() => window.__splashery.player.pictures.media.pause());
    for (let i = 0; i < 20; i++) {
      await run(async (t) => {
        const m = window.__splashery.player.pictures.media;
        await new Promise((r) => {
          m.video.addEventListener("seeked", r, { once: true });
          m.seek(t);
        });
        window.__splashery.player.stage.requestRender();
      }, i / 10);
      await page.waitForTimeout(400);
      await shot(100);
    }
  }
  await page.close();
  // One palette for the whole clip (from every frame's pixels, sampled):
  // a palette per frame spreads a flat background over several close
  // colors that change from frame to frame, which shows as blocks.
  const step = Math.max(1, Math.floor(frames.length / 12));
  const sample = frames.filter((f, i) => i % step === 0).map((f) => f.img.data);
  const all = new Uint8Array(sample.reduce((n, d) => n + d.length, 0));
  sample.reduce((o, d) => (all.set(d, o), o + d.length), 0);
  const palette = quantize(all, 256, { format: "rgb565" });
  const gif = GIFEncoder();
  for (const f of frames) {
    gif.writeFrame(applyPalette(f.img.data, palette, "rgb565"), f.img.w, f.img.h, { palette, delay: f.delay, repeat: 0 }); // prettier-ignore
  }
  gif.finish();
  const file = path.join(outDir, `pic-${scene}.gif`);
  fs.writeFileSync(file, gif.bytes());
  // A strip of six frames, for checking a clip without playing it.
  const pick = [0, 1, 2, 3, 4, 5].map((k) => frames[Math.round((k * (frames.length - 1)) / 5)].img);
  const sw = pick[0].w;
  const sh = pick[0].h;
  const strip = new PNG({ width: sw * 6, height: sh });
  pick.forEach((im, k) => {
    for (let y = 0; y < sh; y++) strip.data.set(im.data.subarray(y * sw * 4, (y + 1) * sw * 4), (y * sw * 6 + k * sw) * 4); // prettier-ignore
  });
  fs.writeFileSync(path.join(outDir, `pic-${scene}-strip.png`), PNG.sync.write(strip));
  console.log(`${file}: ${frames.length} frames, ${Math.round(gif.bytes().length / 1024)} KB`);
}

for (const s of list) await record(s);
await browser.close();

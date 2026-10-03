#!/usr/bin/env node
// Clips of lane Books r5 for the Effect review page: links in a PDF and
// figures that pop out, in Your book and the photo album, at 390x844. The
// clock is stepped by hand (12 steps a second) as in tools/bk-clip.mjs
// (lane Books), whose recorder this copies; pages are built in real time.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/bk5-clip.mjs <out-dir> [scene ...]
//
// Scenes: links (a web link's confirm, a page link's jump), pdf-pop (a
// figure of the sample manual rising and lying back), box (a box drawn round
// a table, rising), photo-pop (a PDF photo rising with its depth), album-pop
// (an album photo rising with its depth, then the other photo of the page).
// Writes <out-dir>/bk5-<scene>.gif and a strip of six frames. The test PDF
// is made by tests/fixtures/bk5/make-pdf.mjs.

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
if (!outDir) throw new Error("Usage: node tools/bk5-clip.mjs <out-dir> [scene ...]");
const ALL = ["links", "pdf-pop", "box", "photo-pop", "album-pop"];
const list = scenes.length ? scenes : ALL;
fs.mkdirSync(outDir, { recursive: true });
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
  const intro = opt("intro", "");
  if (intro)
    frames.push({ img: shrink(PNG.sync.read(fs.readFileSync(intro)), width), delay: Number(opt("hold", 3000)) }); // prettier-ignore
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
        pl.camera.update(dt); // (the view's glide, page focus)
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
  // A tap where it lands (a point in the toy's own units).
  const tapAt = (p) => run((p) => window.__splashery.player.act(window.__splashery.player.fromRecipe(p)), p); // prettier-ignore
  // A double-tap where it lands (page focus; null: off the toy).
  const focusAt = (p) => run((p) => { const pl = window.__splashery.player; pl.focusAt(p && pl.fromRecipe(p)); }, p); // prettier-ignore
  // A pull by hand: the toy's own drag, a frame each step (steps of 1/12 s).
  const pull = async (id, from, to, steps, hold = 0) => {
    await run(async ([id, from]) => {
      const { RECIPES } = await import("/src/packs/pictures.js");
      const d = RECIPES[id].drag;
      if (d.at(from)) d.start(from, window.__splashery.player.time);
    }, [id, from]); // prettier-ignore
    for (let i = 1; i <= steps + hold; i++) {
      const f = Math.min(1, i / steps);
      const p = from.map((v, k) => v + (to[k] - v) * f);
      await run(async ([id, p, dt]) => {
        const { RECIPES } = await import("/src/packs/pictures.js");
        const pl = window.__splashery.player;
        pl.time += dt;
        RECIPES[id].drag.move(p, pl.time);
        pl.stage.requestRender();
      }, [id, p, STEP]); // prettier-ignore
      await draw();
      await settle();
      await draw();
      await shot(Math.round(STEP * 1000));
    }
    await run(async (id) => {
      const { RECIPES } = await import("/src/packs/pictures.js");
      RECIPES[id].drag.end(window.__splashery.player.time);
    }, id);
  };

  // Lane Books r5's helpers: the test PDF, a place on a page, the pop-out.
  const openLinkPDF = async () => {
    await run(() => (window.__splashery.player.frozen = false));
    await run(async () => {
      const { linkPDF } = await import("/tests/fixtures/bk5/make-pdf.mjs");
      await window.__splashery.app.openMedia(new File([linkPDF()], "links.pdf", { type: "application/pdf" })); // prettier-ignore
    });
    await settle();
    await page.waitForTimeout(400);
    await run(() => (window.__splashery.player.frozen = true));
  };
  const at = (n, f) => run(async ([n, f]) => (await import("/src/packs/pictures.js")).BOOKS_R5.point(n, f), [n, f]); // prettier-ignore
  const control = (key, v) => run(([key, v]) => window.__splashery.app.setControl(key, v), [key, v]); // prettier-ignore
  const popState = () => run(async () => { const { POP } = (await import("/src/packs/pictures.js")).BOOKS_R5; return { phase: POP.phase, relief: POP.relief?.key || "" }; }); // prettier-ignore
  // Waits in real time (the clock held) until the figure is ready to rise:
  // its pictures built and, for a photo, its depth worked out.
  const ready = async (depth) => {
    for (let i = 0; i < 600; i++) {
      await draw();
      const s = await popState();
      if ((s.phase === "rise" || s.phase === "up") && (!depth || s.relief.startsWith("d"))) return;
      await page.waitForTimeout(200);
    }
    throw new Error("The figure never got ready.");
  };
  // Loads the depth model ahead (it is fetched once, then kept).
  const warm = () => run(async () => { const { loadDepthModel } = await import("/src/packs/photo-3d-depth.js"); await loadDepthModel(); }); // prettier-ignore
  const mid = (b) => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  const B = await run(async () => (await import("/tests/fixtures/bk5/make-pdf.mjs")).BOXES);

  if (scene === "links") {
    await open("your-book", { reading: "one" });
    await openLinkPDF();
    await run(() => window.__splashery.app.pictureStep(1));
    await play(2);
    await hold(1500);
    // The web link: the address shows, and nothing opens unless asked.
    await tapAt(await at(1, mid(B.web)));
    await play(0.5);
    await hold(2600);
    await run(() => document.getElementById("link-confirm-cancel").click());
    await hold(700);
    // The page link: the book turns to page 4.
    await tapAt(await at(1, mid(B.page4)));
    await play(2.6);
    await hold(1600);
  } else if (scene === "pdf-pop") {
    await open("your-book", { reading: "one" });
    await run(() => window.__splashery.app.pictureStep(1));
    await play(2);
    await hold(1200);
    await control("pop", 1);
    await ready(false);
    await play(4);
    await hold(1200);
    await control("pop", 0);
    await play(1.4);
    await hold(1200);
  } else if (scene === "box") {
    await open("your-book", { reading: "one" });
    await run(() => window.__splashery.app.pictureStep(1));
    await play(2);
    await hold(900);
    await control("box", 1);
    await pull("your-book", await at(1, [0.06, 0.6]), await at(1, [0.97, 0.86]), 14, 4);
    await ready(false);
    await play(4);
    await hold(1200);
    await control("pop", 0);
    await tapAt(await at(1, [0.5, 0.2]));
    await play(1.4);
    await hold(1000);
  } else if (scene === "photo-pop") {
    await warm();
    await open("your-book", { reading: "one" });
    await openLinkPDF();
    await run(() => window.__splashery.app.pictureStep(1));
    await play(2);
    await hold(1200);
    await control("pop", 1);
    await ready(true);
    await play(4);
    await hold(1200);
    await control("pop", 0);
    await play(1.4);
    await hold(1200);
  } else if (scene === "album-pop") {
    await warm();
    await open("photo-album", { reading: "both" });
    await run(() => window.__splashery.app.pictureStep(1));
    await play(2);
    await hold(1200);
    await control("pop", 1);
    await ready(true);
    await play(4);
    await hold(1000);
    // The other photo of the page.
    await tapAt(await at(1, [0.5, 0.5]));
    await play(1.2);
    await ready(true);
    await play(4);
    await hold(1000);
    await control("pop", 0);
    await play(1.4);
    await hold(1200);
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
  const file = path.join(outDir, `bk5-${scene}.gif`);
  fs.writeFileSync(file, gif.bytes());
  const pick = [0, 1, 2, 3, 4, 5].map((k) => frames[Math.round((k * (frames.length - 1)) / 5)].img);
  const sw = pick[0].w;
  const sh = pick[0].h;
  const strip = new PNG({ width: sw * 6, height: sh });
  pick.forEach((im, k) => {
    for (let y = 0; y < sh; y++) strip.data.set(im.data.subarray(y * sw * 4, (y + 1) * sw * 4), (y * sw * 6 + k * sw) * 4); // prettier-ignore
  });
  fs.writeFileSync(path.join(outDir, `bk5-${scene}-strip.png`), PNG.sync.write(strip));
  console.log(`${file}: ${frames.length} frames, ${Math.round(gif.bytes().length / 1024)} KB`);
}

for (const s of list) await record(s);
await browser.close();

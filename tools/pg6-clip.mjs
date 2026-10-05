#!/usr/bin/env node
// Clips of lane Pages r6 for the Effect review page: Pop out for every page
// toy, at 390x844. A copy of tools/bk5-clip.mjs (lane Books r5), whose
// recorder this keeps; the clock is stepped by hand (12 steps a second) and
// pages are built in real time.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/pg6-clip.mjs <out-dir> [scene ...]
//
// Scenes: two-up (two figures rising in turn, one laid back), turn (a page
// turn laying them back), tilt (the book tilted with figures up), lab (the
// Picture lab raising a PDF figure and a drawn box), terrain (a top-down
// photo raised in the Picture lab, then deeper with the Depth slider; the
// photo is a file given with --photo=<path>, never part of the site),
// layers (P1: an album photo raised as pop-up layers, then tilted).
// --dpr=1 renders at one device pixel per CSS pixel (default 2). Writes
// <out-dir>/pg6-<scene>.gif and a strip of six frames. The test PDF is made
// by tests/fixtures/pg6/make-pdf.mjs.

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
if (!outDir) throw new Error("Usage: node tools/pg6-clip.mjs <out-dir> [scene ...]");
const ALL = ["two-up", "turn", "tilt", "lab", "terrain", "layers"];
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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: Number(opt("dpr", 2)) }); // prettier-ignore
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

  // Lane Pages r6's helpers: the test PDF, a place on a page, the figures.
  const openTwo = async () => {
    await run(() => (window.__splashery.player.frozen = false));
    await run(async () => {
      const { twoFigurePDF } = await import("/tests/fixtures/pg6/make-pdf.mjs");
      await window.__splashery.app.openMedia(new File([twoFigurePDF()], "two.pdf", { type: "application/pdf" })); // prettier-ignore
    });
    await settle();
    await page.waitForTimeout(400);
    await run(() => (window.__splashery.player.frozen = true));
  };
  const openPhoto = async (file) => {
    const b64 = fs.readFileSync(file).toString("base64");
    await run(() => (window.__splashery.player.frozen = false));
    await run(async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      await window.__splashery.app.openMedia(new File([bytes], "terrain.jpg", { type: "image/jpeg" })); // prettier-ignore
    }, b64);
    await settle();
    await page.waitForTimeout(400);
    await run(() => (window.__splashery.player.frozen = true));
  };
  const at = (n, f) => run(async ([n, f]) => (await import("/src/packs/pictures.js")).BOOKS_R5.point(n, f), [n, f]); // prettier-ignore
  // A Toy tab switch. (It eases on the real frame clock, which a frozen
  // player doesn't have, so its state is set as well.)
  const control = async (key, v) => {
    await run(([key, v]) => {
      window.__splashery.app.setControl(key, v);
      window.__splashery.player.motion.state[key] = v;
    }, [key, v]); // prettier-ignore
    await play(0.25);
  };
  const popOn = () => run(() => { const app = window.__splashery.app; if (!app.popOut) app.togglePopOut(); }); // prettier-ignore
  const pops = () => run(async () => (await import("/src/packs/pictures.js")).BOOKS_R5.PG.pops.map((F) => ({ phase: F.phase, relief: F.relief?.key || "", kind: F.kind, at: F.at, id: F.id }))); // prettier-ignore
  // Steps the clock (unrecorded) until the figure raised last starts to
  // rise: while it waits it lies exactly where it was. For a photo, waits in
  // real time at rest until its depth is worked out, so it rises with it.
  const ready = async () => {
    for (let i = 0; i < 3000; i++) {
      const s = (await pops()).at(-1);
      if (!s || s.phase === "rise" || s.phase === "up") return;
      if (s.kind === "photo" && s.phase === "rest" && !s.relief.startsWith("d")) {
        await draw();
        await page.waitForTimeout(250);
        continue;
      }
      await run((dt) => {
        const pl = window.__splashery.player;
        pl.time += dt;
        pl.stage.requestRender();
      }, STEP);
      await draw();
    }
    throw new Error("The figure never got ready.");
  };
  // Loads the depth model ahead (it is fetched once, then kept).
  const warm = () => run(async () => { const { loadDepthModel } = await import("/src/packs/photo-3d-depth.js"); await loadDepthModel(); }); // prettier-ignore
  const mid = (b) => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  const figs = (n) => run(async (n) => (await import("/src/packs/pictures.js")).BOOKS_R5.BK5.figs.get(n)?.map((f) => f.box) || [], n); // prettier-ignore
  // Turns the view (a drag would): yaw and pitch eased to these over `s` seconds.
  const turn = async (yaw, pitch, s) => {
    const from = await run(() => { const c = window.__splashery.player.camera; return [c.tgt.yaw, c.tgt.pitch]; }); // prettier-ignore
    for (let t = STEP; t <= s + 1e-6; t += STEP) {
      const w = 0.5 - 0.5 * Math.cos((Math.PI * t) / s);
      await run(([y, p]) => { const c = window.__splashery.player.camera; c.tgt.yaw = y; c.tgt.pitch = p; c.interact(); }, [from[0] + (yaw - from[0]) * w, from[1] + (pitch - from[1]) * w]); // prettier-ignore
      await play(STEP);
    }
  };
  // The book open on page 2 of the test PDF (one page at a time, as on a phone), Pop out on.
  const bookTwo = async () => {
    await warm();
    await open("your-book", { reading: "one" });
    await openTwo();
    await run(() => window.__splashery.app.pictureStep(1));
    await play(2);
    await popOn();
    await play(0.5);
    for (let i = 0; i < 60 && (await figs(1)).length < 2; i++) await play(STEP);
    return figs(1);
  };
  const raise = async (n, box) => {
    await tapAt(await at(n, mid(box)));
    await play(STEP);
    await ready();
    await play(2.2);
  };

  if (scene === "two-up") {
    const [a, b] = await bookTwo();
    await hold(1000);
    await raise(1, a);
    await raise(1, b);
    await hold(1000);
    // A tap on the first lays it back; the second stays.
    await tapAt(await at(1, mid(a)));
    await play(1.4);
    await hold(1400);
  } else if (scene === "turn") {
    const [a, b] = await bookTwo();
    await raise(1, a);
    await raise(1, b);
    await hold(900);
    // A tap off the figures, on the right of the page: they lie back, then the page turns.
    await tapAt(await at(1, [0.9, 0.96]));
    await play(2.6);
    await hold(1400);
  } else if (scene === "tilt") {
    const [a, b] = await bookTwo();
    await raise(1, a);
    await raise(1, b);
    // Turned back and forth, forward and backward, to see them stand off the page.
    await turn(0.55, 0.15, 1.5);
    await turn(-0.55, -0.1, 2.2);
    await turn(0, 0.75, 1.6);
    await turn(0, -0.6, 2);
    await turn(0, 0, 1.2);
    await hold(1000);
  } else if (scene === "lab") {
    await warm();
    await open("picture-lab", {});
    await openTwo();
    await run(() => window.__splashery.app.pictureStep(1));
    await play(1.5);
    await popOn();
    await play(0.5);
    for (let i = 0; i < 60 && (await figs(1)).length < 2; i++) await play(STEP);
    const [, b] = await figs(1);
    await hold(900);
    await raise(1, b);
    await control("box", 1);
    await pull("picture-lab", await at(1, [0.08, 0.7]), await at(1, [0.62, 0.8]), 12, 3);
    await ready();
    await play(2.4);
    await turn(0.4, 0.45, 1.6);
    await turn(0, 0, 1.2);
    await hold(1200);
  } else if (scene === "layers") {
    await warm();
    await open("photo-album", { reading: "one" });
    await run(() => window.__splashery.app.pictureStep(Number(opt("step", 1))));
    await play(2);
    await popOn();
    await control("layers", 1);
    await hold(900);
    const n = await run(() => window.__splashery.player.pictures.page);
    await raise(n, [0, 0, 1, 1]);
    await turn(0.6, 0.2, 1.6);
    await turn(-0.6, 0.35, 2.4);
    await turn(0, 0.7, 1.6);
    await turn(0, 0, 1.2);
    await hold(1200);
  } else if (scene === "terrain") {
    const file = opt("photo", "");
    if (!file) throw new Error("terrain needs --photo=<path>");
    await warm();
    await open("picture-lab", { sample: "photo" });
    await openPhoto(file);
    await play(1);
    await popOn();
    await raise(0, [0, 0, 1, 1]);
    await turn(0, 0.7, 1.6);
    await hold(1000);
    // Deeper: the Depth slider to five times.
    await run(() => {
      const el = document.getElementById("toy-slider-input");
      el.value = "1000";
      el.dispatchEvent(new Event("input"));
    });
    await play(0.5);
    await hold(1000);
    await turn(0.5, 0.75, 1.8);
    await turn(-0.5, 0.75, 2.6);
    await turn(0, 0.2, 1.4);
    await hold(1400);
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
  const file = path.join(outDir, `pg6-${scene}.gif`);
  fs.writeFileSync(file, gif.bytes());
  const pick = [0, 1, 2, 3, 4, 5].map((k) => frames[Math.round((k * (frames.length - 1)) / 5)].img);
  const sw = pick[0].w;
  const sh = pick[0].h;
  const strip = new PNG({ width: sw * 6, height: sh });
  pick.forEach((im, k) => {
    for (let y = 0; y < sh; y++) strip.data.set(im.data.subarray(y * sw * 4, (y + 1) * sw * 4), (y * sw * 6 + k * sw) * 4); // prettier-ignore
  });
  fs.writeFileSync(path.join(outDir, `pg6-${scene}-strip.png`), PNG.sync.write(strip));
  console.log(`${file}: ${frames.length} frames, ${Math.round(gif.bytes().length / 1024)} KB`);
}

for (const s of list) await record(s);
await browser.close();

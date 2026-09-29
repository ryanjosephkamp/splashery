#!/usr/bin/env node
// Lane Fluids: clips of the Fluid lab for the Effect review page, as a phone
// shows them: 390x844 at a device pixel ratio of 3, the mid tier (phones),
// labs on. The toy's clock is stepped by hand (15 steps a second), so the
// fluids move at their real speed however slow the software renderer is.
// Each frame is a screenshot of the page (the app as it looks), shrunk to
// --width (360), with a small "built by Opus 5.5" label.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/fl-clip.mjs <out-dir> [pour splash soda smoke flame]
//
// Writes <out-dir>/fl-<clip>.gif and fl-<clip>-strip.png (six frames).

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
const [outDir, ...clips] = args.filter((a) => !a.startsWith("--"));
if (!outDir) throw new Error("Usage: node tools/fl-clip.mjs <out-dir> [clip ...]");
const ALL = ["pour", "splash", "soda", "smoke", "flame"];
const list = clips.length ? clips : ALL;
const STEP = 1 / 15;
const WIDTH = Number(opt("width", 360));
const PROFILE = opt("profile", "mid");
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

// Box-filter shrink of a PNG to `w` pixels wide.
function shrink(png, w) {
  const k = png.width / w;
  const h = Math.round(png.height / k);
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const acc = [0, 0, 0];
      let n = 0;
      for (let yy = Math.floor(y * k); yy < Math.min(png.height, Math.floor((y + 1) * k)); yy++)
        for (let xx = Math.floor(x * k); xx < Math.min(png.width, Math.floor((x + 1) * k)); xx++) {
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

async function record(clip) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 }); // prettier-ignore
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(`${base}?renderer=webgl2&adapt=off&profile=${PROFILE}&labs=1`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  const frames = [];
  const run = (fn, arg) => page.evaluate(fn, arg);
  // The stage's update handlers run only with the time this script gives.
  await run(() => {
    const { player } = window.__splashery;
    const stage = player.stage;
    const handlers = stage.updateHandlers.slice();
    window.__flPending = 0;
    stage.updateHandlers.length = 0;
    stage.updateHandlers.push(() => {
      const d = window.__flPending;
      window.__flPending = 0;
      for (const h of handlers) h(d);
    });
    player.opts.idleDelay = 1e9;
    player.idle.weight = 0;
    const tag = document.createElement("div");
    tag.textContent = "Fluid lab · built by Opus 5.5";
    tag.style.cssText =
      "position:fixed;left:10px;bottom:10px;z-index:99;font:600 12px system-ui;color:#fff;background:rgba(0,0,0,.55);padding:4px 8px;border-radius:6px;pointer-events:none"; // prettier-ignore
    document.body.appendChild(tag);
  });
  const step = async (dt) => {
    await run(async (dt) => {
      const { player } = window.__splashery;
      window.__flPending = dt;
      await player.stage.captureFrame();
      await player.stage.captureFrame();
    }, dt);
  };
  const shot = async (delay) => {
    const png = PNG.sync.read(await page.screenshot({ timeout: 180_000 }));
    frames.push({ img: shrink(png, WIDTH), delay });
  };
  const play = async (secs) => {
    for (let t = 0; t < secs - 1e-6; t += STEP) {
      await step(STEP);
      await shot(Math.round(STEP * 1000));
    }
  };
  const open = async (options, view = null) => {
    await run(
      async ([options, view]) => {
        const { app, player } = window.__splashery;
        if (player.scene.toy.id !== "fluid-lab") await app.chooseToy("fluid-lab");
        for (const [k, v] of Object.entries(options)) await app.setToyOption(k, v);
        app.setLook({ background: "#15171a" });
        const cam = player.camera;
        if (view) {
          const tf = player.motion.ctx.transform;
          cam.target = view.at.map((v, i) => (v - tf.center[i]) * tf.scale);
          cam.home = { ...cam.home, distance: cam.home.distance * view.zoom };
        }
        cam.cur = { ...cam.home };
        cam.tgt = { ...cam.home };
        await new Promise((r) => setTimeout(r, 300));
      },
      [options, view],
    );
    // Wait for the fluid, then let it settle a moment.
    await page.waitForFunction(() => window.__splashery.player.fluids?.stats?.particles > 0, null, { timeout: 60_000 }); // prettier-ignore
    for (let i = 0; i < 8; i++) await step(STEP);
  };
  const tap = () => run(() => window.__splashery.player.act(null));

  if (clip === "pour") {
    await open({ scene: "glass", liquid: "water" });
    await play(0.6);
    await tap();
    await play(4.2);
    await open({ liquid: "honey" });
    await play(0.6);
    await tap();
    await play(5.4);
  } else if (clip === "splash") {
    await open({ scene: "splash", liquid: "water" });
    await play(0.5);
    await tap();
    await play(3.2);
    await tap();
    await play(3.2);
  } else if (clip === "soda") {
    await open({ scene: "glass", liquid: "soda" });
    await play(1.0);
    await tap();
    await play(6.0);
  } else if (clip === "smoke") {
    await open({ scene: "candle" });
    await play(1.5);
    await tap();
    await play(4.2);
    await open({ scene: "cup" });
    await play(1.5);
    await tap();
    await play(3.5);
  } else if (clip === "flame") {
    await open({ scene: "candle" }, { at: [0, 1.08, 0], zoom: 0.4 });
    await play(4.0);
  }
  await page.close();
  return frames;
}

for (const clip of list) {
  const frames = await record(clip);
  const gif = GIFEncoder();
  for (const f of frames) {
    const palette = quantize(f.img.data, 256, { format: "rgb565" });
    gif.writeFrame(applyPalette(f.img.data, palette, "rgb565"), f.img.w, f.img.h, { palette, delay: f.delay, repeat: 0 }); // prettier-ignore
  }
  gif.finish();
  const out = path.join(outDir, `fl-${clip}.gif`);
  fs.writeFileSync(out, Buffer.from(gif.bytes()));
  // A strip of six frames.
  const pick = [0, 1, 2, 3, 4, 5].map((i) => frames[Math.round((i / 5) * (frames.length - 1))]);
  const { w, h } = pick[0].img;
  const strip = new PNG({ width: w * 6, height: h });
  pick.forEach((f, i) => {
    for (let y = 0; y < h; y++) {
      const src = f.img.data.subarray(y * w * 4, (y + 1) * w * 4);
      strip.data.set(src, (y * w * 6 + i * w) * 4);
    }
  });
  fs.writeFileSync(path.join(outDir, `fl-${clip}-strip.png`), PNG.sync.write(strip));
  console.log(
    `${clip}: ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB, ${frames.length} frames)`,
  );
}
await browser.close();

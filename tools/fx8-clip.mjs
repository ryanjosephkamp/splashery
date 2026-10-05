#!/usr/bin/env node
// Lane Fix8: a clip of the real alarm clock telling the time, then ringing.
// tools/effect-clip.mjs steps the toy's clock by hand while the page's Date
// runs on at the wall's speed, so a slow render would make the second hand
// jump. Here the page's Date is a virtual clock that starts at this
// computer's time and moves on with each frame, so the hands move at their
// real speed in the clip.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/fx8-clip.mjs <out-dir> [--size=320] [--before=4] [--secs=4] [--fps=15] [--zone=America/New_York] [--roll=0]
//
// Writes <out-dir>/alarm-clock-time.gif and a strip of 8 frames.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [outDir] = args.filter((a) => !a.startsWith("--"));
if (!outDir) throw new Error("Usage: node tools/fx8-clip.mjs <out-dir>");
const size = Number(opt("size", 320));
const before = Number(opt("before", 4));
const secs = Number(opt("secs", 4));
const fps = Number(opt("fps", 15));
const zone = opt("zone", "America/New_York");
const roll = Number(opt("roll", 0));
const name = opt("name", "alarm-clock-time");

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 }, timezoneId: zone });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("page error:", e.message));
// The virtual clock: Date reads start + the frames' seconds.
await page.addInitScript(() => {
  const Real = Date;
  const start = Real.now();
  let virtual = null;
  window.__fx8Clock = {
    begin() {
      virtual = Real.now() - start;
    },
    advance(dt) {
      virtual += dt * 1000;
    },
  };
  const now = () => (virtual === null ? Real.now() : start + virtual);
  globalThis.Date = class extends Real {
    constructor(...a) {
      super(...(a.length ? a : [now()]));
    }
    static now() {
      return now();
    }
  };
});
await page.goto(`${base}?renderer=webgl2&profile=high&adapt=off`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
const { bytes, strip, shown } = await page.evaluate(
  async ({ size, before, secs, fps, roll }) => {
    const { app, player } = window.__splashery;
    const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
    await app.chooseToy("alarm-clock");
    app.setLook({ background: "#111111" });
    player.opts.idleDelay = 1e9;
    player.idle.weight = 0;
    player.camera.tiltLock = false;
    await new Promise((r) => setTimeout(r, 1500));
    const stage = player.stage;
    const handlers = stage.updateHandlers.slice();
    let pending = 0;
    stage.updateHandlers.length = 0;
    stage.updateHandlers.push(() => {
      const d = pending;
      pending = 0;
      for (const h of handlers) h(d);
    });
    stage.setFixedSize([size, size]);
    // A little closer than home and face on, so the hands read at phone size.
    const pose = { ...player.camera.home, yaw: 0.25, pitch: 0.12, roll, distance: player.camera.home.distance * 0.8 }; // prettier-ignore
    const home = () => {
      player.camera.cur = { ...pose };
      player.camera.tgt = { ...pose };
    };
    const step = 1 / fps;
    const gif = GIFEncoder();
    const delay = Math.round(1000 / fps);
    const total = Math.round((before + secs) / step);
    const pickAt = new Set([0, Math.round(before / step) - 1]);
    for (let i = 1; i < 7; i++) pickAt.add(Math.round(before / step + ((i - 0.5) / 6) * (total - before / step))); // prettier-ignore
    const shots = [];
    let n = 0;
    window.__fx8Clock.begin();
    const frame = async () => {
      pending = step;
      window.__fx8Clock.advance(step);
      home();
      await stage.captureFrame();
      pending = 0;
      const c = await stage.captureFrame();
      if (pickAt.has(n)) shots.push({ bmp: await createImageBitmap(c), t: n * step - before });
      n++;
      const rgba = c.getContext("2d").getImageData(0, 0, size, size).data;
      const palette = quantize(rgba, 256, { format: "rgb565" });
      gif.writeFrame(applyPalette(rgba, palette, "rgb565"), size, size, { palette, delay, repeat: 0 }); // prettier-ignore
    };
    pending = 0.5;
    await stage.captureFrame();
    const d0 = new Date();
    for (let t = 0; t < before - 1e-6; t += step) await frame();
    player.act(null);
    for (let t = 0; t < secs - 1e-6; t += step) await frame();
    gif.finish();
    stage.setFixedSize(null);
    stage.updateHandlers.length = 0;
    stage.updateHandlers.push(...handlers);
    const out = document.createElement("canvas");
    out.width = size * shots.length;
    out.height = size + 18;
    const g = out.getContext("2d");
    g.fillStyle = "#111";
    g.fillRect(0, 0, out.width, out.height);
    g.font = "12px sans-serif";
    g.fillStyle = "#bbb";
    shots.forEach((s, i) => {
      g.drawImage(s.bmp, i * size, 0, size, size);
      g.fillText(
        s.t < 0 ? `${s.t.toFixed(1)}s` : `tap +${s.t.toFixed(1)}s`,
        i * size + 6,
        size + 13,
      );
    });
    return {
      bytes: Array.from(gif.bytes()),
      strip: out.toDataURL("image/png"),
      shown: d0.toTimeString(),
    };
  },
  { size, before, secs, fps, roll },
);
fs.writeFileSync(path.join(outDir, `${name}.gif`), Buffer.from(bytes));
fs.writeFileSync(path.join(outDir, `${name}-strip.png`), Buffer.from(strip.split(",")[1], "base64")); // prettier-ignore
console.log(`${name}: starts at ${shown} (${(bytes.length / 1024).toFixed(0)} KB)`);
await browser.close();

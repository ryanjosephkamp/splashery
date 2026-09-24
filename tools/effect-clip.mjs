#!/usr/bin/env node
// Renders a toy's tap effect as a looping GIF clip, for judging an effect as
// motion at phone size (filmstrips hide bending, smear and speckle).
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/effect-clip.mjs <out-dir> [--size=320] [--secs=3.5] [--fps=15] [--before=0.4] [--taps=1] [--gap=0.25] [--at=x,y,z] [--seq=x,y,z;x,y,z] [--keys=HELLO] [--bg=#111111] [--opt=key=value] id ...
//
// Writes <out-dir>/<id>.gif. The clock is stepped by hand, so a clip shows
// the effect at its real speed however slow the renderer is. It starts
// --before seconds ahead of the tap and runs --secs after it. --seq taps a
// list of points (recipe coordinates) --gap seconds apart; --keys types
// letters on a toy that takes typing (the laptop) --gap seconds apart.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [outDir, ...ids] = args.filter((a) => !a.startsWith("--"));
if (!outDir || !ids.length) throw new Error("Usage: node tools/effect-clip.mjs <out-dir> id ...");
const size = Number(opt("size", 320));
const secs = Number(opt("secs", 3.5));
const fps = Number(opt("fps", 15));
const before = Number(opt("before", 0.4));
const bg = opt("bg", "#111111");
const taps = Number(opt("taps", 1));
const gap = Number(opt("gap", 0.25));
const toyOpt = opt("opt", "");
const at = opt("at", "") ? opt("at", "").split(",").map(Number) : null;
const seq = opt("seq", "")
  ? opt("seq", "")
      .split(";")
      .map((p) => p.split(",").map(Number))
  : null;
const keys = opt("keys", "");

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
  ],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?renderer=webgl2&profile=high&adapt=off`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
for (const id of ids) {
  const bytes = await page.evaluate(
    async ({ id, size, secs, fps, before, bg, taps, gap, toyOpt, at, seq, keys }) => {
      const { app, player } = window.__splashery;
      const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
      await app.chooseToy(id);
      if (toyOpt) {
        const [key, value] = toyOpt.split("=");
        await app.setToyOption(key, value);
      }
      app.setLook({ background: bg });
      player.opts.idleDelay = 1e9;
      player.idle.weight = 0;
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
      const home = () => {
        player.camera.cur = { ...player.camera.home };
        player.camera.tgt = { ...player.camera.home };
      };
      const step = 1 / fps;
      const gif = GIFEncoder();
      const delay = Math.round(1000 / fps);
      const frame = async () => {
        pending = step;
        home();
        await stage.captureFrame();
        pending = 0;
        const c = await stage.captureFrame();
        const rgba = c.getContext("2d").getImageData(0, 0, size, size).data;
        const palette = quantize(rgba, 256, { format: "rgb565" });
        gif.writeFrame(applyPalette(rgba, palette, "rgb565"), size, size, { palette, delay, repeat: 0 }); // prettier-ignore
      };
      const tf = player.motion.ctx?.transform;
      const toWorld = (p) => (tf ? p.map((v, i) => (v - tf.center[i]) * tf.scale) : p);
      // Settle, then the lead-in frames.
      pending = 0.5;
      await stage.captureFrame();
      for (let t = 0; t < before; t += step) await frame();
      // The taps (or key presses), each followed by frames until the next.
      const events = [];
      if (keys) for (const ch of keys) events.push(() => player.typeKey?.(ch));
      else if (seq) for (const p of seq) events.push(() => player.act(toWorld(p)));
      else for (let i = 0; i < taps; i++) events.push(() => player.act(at ? toWorld(at) : null));
      for (let i = 0; i < events.length; i++) {
        events[i]();
        if (i < events.length - 1) for (let t = 0; t < gap - 1e-6; t += step) await frame();
      }
      for (let t = 0; t < secs - 1e-6; t += step) await frame();
      gif.finish();
      stage.setFixedSize(null);
      stage.updateHandlers.length = 0;
      stage.updateHandlers.push(...handlers);
      return Array.from(gif.bytes());
    },
    { id, size, secs, fps, before, bg, taps, gap, toyOpt, at, seq, keys },
  );
  const out = path.join(outDir, `${id}.gif`);
  fs.writeFileSync(out, Buffer.from(bytes));
  console.log(`${id}: ${out} (${(bytes.length / 1024).toFixed(0)} KB)`);
}
await browser.close();

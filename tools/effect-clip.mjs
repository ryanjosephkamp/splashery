#!/usr/bin/env node
// Renders a toy's tap effect as a looping GIF clip, for judging an effect as
// motion at phone size (filmstrips hide bending, smear and speckle).
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/effect-clip.mjs <out-dir> [--size=320] [--secs=3.5] [--fps=15] [--before=0.4] [--taps=1] [--gap=0.25] [--at=x,y,z] [--seq=x,y,z;x,y,z] [--keys=HELLO] [--bg=#111111] [--opt=key=value] [--pgn=game.pgn] [--strip=8] id[:secs] ...
//
// Writes <out-dir>/<id>.gif. The clock is stepped by hand, so a clip shows
// the effect at its real speed however slow the renderer is. It starts
// --before seconds ahead of the tap and runs --secs after it. --seq taps a
// list of points (recipe coordinates) --gap seconds apart; --keys types
// letters on a toy that takes typing (the laptop) --gap seconds apart;
// --pgn loads a game into a game toy (the chess set) before the tap.
// "star:8.5" gives that toy its own length. --strip=8 also writes
// <out-dir>/<id>-strip.png: 8 frames from the clip side by side (the first
// before the tap), for checking a clip without playing it.

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
const secsAll = Number(opt("secs", 3.5));
const fps = Number(opt("fps", 15));
const before = Number(opt("before", 0.4));
const bg = opt("bg", "#111111");
const taps = Number(opt("taps", 1));
const gap = Number(opt("gap", 0.25));
const toyOpt = opt("opt", "");
const pgn = opt("pgn", "") ? fs.readFileSync(opt("pgn", ""), "utf8") : "";
const at = opt("at", "") ? opt("at", "").split(",").map(Number) : null;
const seq = opt("seq", "")
  ? opt("seq", "")
      .split(";")
      .map((p) => p.split(",").map(Number))
  : null;
const keys = opt("keys", "");
const stripN = Number(opt("strip", 0));

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
for (const spec of ids) {
  const [id, own] = spec.split(":");
  const secs = own ? Number(own) : secsAll;
  const { bytes, strip } = await page.evaluate(
    async ({ id, size, secs, fps, before, bg, taps, gap, toyOpt, at, seq, keys, pgn, stripN }) => {
      const { app, player } = window.__splashery;
      const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
      await app.chooseToy(id);
      if (toyOpt) {
        const [key, value] = toyOpt.split("=");
        await app.setToyOption(key, value);
      }
      // A game toy (the chess set) can load a PGN game first.
      if (pgn) await player.toyInfo.recipe.game.load(pgn);
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
      // Frames for the strip: one before the tap, then evenly spread after.
      const shots = [];
      const total = Math.round((before + secs) / step);
      const pickAt = new Set();
      if (stripN > 1) {
        pickAt.add(Math.max(0, Math.round(before / step) - 1));
        for (let i = 1; i < stripN; i++)
          pickAt.add(
            Math.round(before / step + ((i - 0.5) / (stripN - 1)) * (total - before / step)),
          );
      }
      let n = 0;
      const frame = async () => {
        pending = step;
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
      let strip = null;
      if (shots.length) {
        const out = document.createElement("canvas");
        out.width = size * shots.length;
        out.height = size + 18;
        const ctx = out.getContext("2d");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.font = "12px sans-serif";
        ctx.fillStyle = "#bbb";
        shots.forEach((s, i) => {
          ctx.drawImage(s.bmp, i * size, 0, size, size);
          ctx.fillText(s.t < 0 ? "before" : `${s.t.toFixed(1)}s`, i * size + 6, size + 13);
        });
        strip = out.toDataURL("image/png");
      }
      return { bytes: Array.from(gif.bytes()), strip };
    },
    { id, size, secs, fps, before, bg, taps, gap, toyOpt, at, seq, keys, pgn, stripN },
  );
  const out = path.join(outDir, `${id}.gif`);
  fs.writeFileSync(out, Buffer.from(bytes));
  if (strip) fs.writeFileSync(path.join(outDir, `${id}-strip.png`), Buffer.from(strip.split(",")[1], "base64")); // prettier-ignore
  console.log(`${id}: ${out} (${(bytes.length / 1024).toFixed(0)} KB)`);
}
await browser.close();

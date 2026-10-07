#!/usr/bin/env node
// Lane Space r4: tools/sp2-clip.mjs for the solar system on real orbits,
// with three more things: --speed=0.8 sets the Speed slider, --date=2026-10-07
// sets the date first, and each frame carries the date the toy shows (its
// legend's title) in its corner, since the page's own text is not in the
// canvas. Labs is on; the camera is put home only before the first tap.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/sp4-clip.mjs <out-dir> [--speed=0.8] [--date=2026-10-07] [--size=320] [--secs=3.5] [--fps=15] [--before=0.4] [--taps=1] [--gap=0.25] [--at=x,y,z] [--seq=x,y,z;x,y,z] [--keys=HELLO] [--bg=#111111] [--opt=key=value] [--pgn=game.pgn] [--strip=8] id[:secs] ...
//
// Writes <out-dir>/<id>.gif. The clock is stepped by hand, so a clip shows
// the effect at its real speed however slow the renderer is. It starts
// --before seconds ahead of the tap and runs --secs after it. --seq taps a
// list of points (recipe coordinates) --gap seconds apart; --keys types
// letters on a toy that takes typing (the laptop) --gap seconds apart;
// --pgn loads a game into a game toy (the chess set) before the tap.
// "star:8.5" gives that toy its own length. --strip=8 also writes
// <out-dir>/<id>-strip.png: 8 frames from the clip side by side (the first
// before the tap), for checking a clip without playing it. --mp4 writes
// <out-dir>/<id>.mp4 instead, straight from the rendered frames (H.264 through
// ffmpeg), so the clip keeps every color a GIF's 256 would band.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [outDir, ...ids] = args.filter((a) => !a.startsWith("--"));
if (!outDir || !ids.length) throw new Error("Usage: node tools/effect-clip.mjs <out-dir> id ...");
const size = Number(opt("size", 320));
// --h: a taller clip (a phone's shape), size wide and h high.
const high = Number(opt("h", 0)) || size;
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
const sun = opt("sun", "");
const speed = opt("speed", "");
const date = opt("date", "");
const mp4 = args.includes("--mp4");

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
// (A portrait clip is made in a phone's page, so the view fits a phone.)
const page = await browser.newPage({ viewport: high > size ? { width: 390, height: 844 } : { width: 1000, height: 700 } }); // prettier-ignore
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?renderer=webgl2&profile=high&adapt=off&labs=1`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
// --mp4: each frame comes back as a PNG, numbered, for ffmpeg.
let frameDir = null;
await page.exposeFunction("__sp2Frame", (n, url) => {
  fs.writeFileSync(path.join(frameDir, `${String(n).padStart(5, "0")}.png`), Buffer.from(url.split(",")[1], "base64")); // prettier-ignore
});
for (const spec of ids) {
  const [id, own] = spec.split(":");
  const secs = own ? Number(own) : secsAll;
  if (mp4) {
    frameDir = path.join(outDir, `${id}-frames`);
    fs.rmSync(frameDir, { recursive: true, force: true });
    fs.mkdirSync(frameDir, { recursive: true });
  }
  const { bytes, strip } = await page.evaluate(
    async ({
      id,
      size,
      secs,
      fps,
      before,
      bg,
      taps,
      gap,
      toyOpt,
      at,
      seq,
      keys,
      pgn,
      stripN,
      sun,
      speed,
      date,
      mp4,
      high,
    }) => {
      const { app, player } = window.__splashery;
      const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
      await app.chooseToy(id);
      if (toyOpt) {
        const [key, value] = toyOpt.split("=");
        await app.setToyOption(key, value);
      }
      // A game toy (the chess set) can load a PGN game first.
      if (pgn) await player.toyInfo.recipe.game.load(pgn);
      if (sun !== "") app.setControl("sun", Number(sun));
      if (speed !== "") app.setControl("speed", Number(speed));
      if (date) {
        await new Promise((r) => setTimeout(r, 300));
        const lo = Date.UTC(1800, 0, 1);
        const hi = Date.UTC(2050, 11, 31);
        player.sliderInput(player.motion.out.slider.id, (Date.parse(`${date}T00:00:00Z`) - lo) / (hi - lo)); // prettier-ignore
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
      stage.setFixedSize([size, high]);
      // (A toy that sets its own view, out.view, keeps it.)
      const home = () => {
        if (player.toyInfo?.recipe?.focus) return;
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
      let tapped = false;
      const frame = async () => {
        pending = step;
        if (!tapped) home();
        await stage.captureFrame();
        pending = 0;
        const c0 = await stage.captureFrame();
        // The date in the corner (the legend's title).
        const c = document.createElement("canvas");
        c.width = c0.width;
        c.height = c0.height;
        const g2 = c.getContext("2d");
        g2.drawImage(c0, 0, 0);
        const title = player.motion.out?.legend?.title || "";
        const sub = player.motion.out?.legend?.items?.find((x) => x.on)?.text || "";
        g2.font = `${Math.round(size / 22)}px sans-serif`;
        g2.fillStyle = "#e8eef8";
        g2.fillText(title, 8, Math.round(size / 15));
        if (sub) g2.fillText(sub, 8, Math.round(size / 15) * 2);
        if (pickAt.has(n)) shots.push({ bmp: await createImageBitmap(c), t: n * step - before });
        if (mp4) {
          await window.__sp2Frame(n++, c.toDataURL("image/png"));
          return;
        }
        n++;
        const rgba = c.getContext("2d").getImageData(0, 0, size, high).data;
        const palette = quantize(rgba, 256, { format: "rgb565" });
        gif.writeFrame(applyPalette(rgba, palette, "rgb565"), size, high, { palette, delay, repeat: 0 }); // prettier-ignore
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
        tapped = true;
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
        out.height = high + 18;
        const ctx = out.getContext("2d");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.font = "12px sans-serif";
        ctx.fillStyle = "#bbb";
        shots.forEach((s, i) => {
          ctx.drawImage(s.bmp, i * size, 0, size, high);
          ctx.fillText(s.t < 0 ? "before" : `${s.t.toFixed(1)}s`, i * size + 6, high + 13);
        });
        strip = out.toDataURL("image/png");
      }
      return { bytes: Array.from(gif.bytes()), strip };
    },
    {
      id,
      size,
      secs,
      fps,
      before,
      bg,
      taps,
      gap,
      toyOpt,
      at,
      seq,
      keys,
      pgn,
      stripN,
      sun,
      speed,
      date,
      mp4,
      high,
    },
  );
  const name = opt("name", id);
  let out = path.join(outDir, `${name}.gif`);
  if (mp4) {
    out = path.join(outDir, `${name}.mp4`);
    const ff = spawnSync(process.env.FFMPEG || "ffmpeg", ["-v", "error", "-y", "-framerate", String(fps), "-i", path.join(frameDir, "%05d.png"), "-c:v", "libx264", "-crf", "18", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]); // prettier-ignore
    if (ff.status !== 0) throw new Error(`ffmpeg: ${ff.stderr}`);
    fs.rmSync(frameDir, { recursive: true, force: true });
  } else fs.writeFileSync(out, Buffer.from(bytes));
  if (strip) fs.writeFileSync(path.join(outDir, `${id}-strip.png`), Buffer.from(strip.split(",")[1], "base64")); // prettier-ignore
  console.log(`${id}: ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
}
await browser.close();

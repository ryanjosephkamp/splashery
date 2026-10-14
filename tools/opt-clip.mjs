#!/usr/bin/env node
// Lane Optics: clips of the optics toys with labs on, as MP4s, for the Effect
// review page. Like tools/effect-clip.mjs (the clock is stepped by hand, so a
// clip runs at the toy's real speed however slow the renderer is), plus a
// script of taps, control changes and drags (in recipe coordinates).
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/opt-clip.mjs <out.mp4> <id> [--size=360x540] [--secs=6] [--fps=15] [--opt=key=value,…] [--script='[…]'] [--strip=out.png]
//
// The script is a JSON list of events, each at `t` seconds from the start:
//   { "t": 1, "tap": [x, y, z] }            a tap on the toy there (null: the button)
//   { "t": 2, "control": "freq", "value": 0.9 }  a control set
//   { "t": 3, "to": 5, "drag": [[x, y, z], [x, y, z]] }  a drag from t to `to`, through the points
//   { "t": 0, "options": { "setup": "single" } }  options set (the toy is rebuilt)
// The camera stays at the toy's home view.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [out, id] = args.filter((a) => !a.startsWith("--"));
if (!out || !id) throw new Error("Usage: node tools/opt-clip.mjs <out.mp4> <id>");
const [w, h] = opt("size", "360x540").split("x").map(Number);
const secs = Number(opt("secs", 6));
const fps = Number(opt("fps", 15));
const script = JSON.parse(opt("script", "[]"));
const options = Object.fromEntries(
  opt("opt", "")
    .split(",")
    .filter(Boolean)
    .map((kv) => kv.split("="))
    .map(([k, v]) => [k, isNaN(+v) ? v : +v]),
);
const ffmpeg = execFileSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).toString().trim(); // prettier-ignore

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--enable-webgl"],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?renderer=webgl2&profile=high&adapt=off&labs=1`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
await page.evaluate(
  async ({ id, options }) => {
    const { app, player } = window.__splashery;
    await app.chooseToy(id);
    if (Object.keys(options).length) await app.setToyOptions(options);
    app.setLook({ background: "#111111" });
    player.opts.idleDelay = 1e9;
    player.idle.weight = 0;
    const stage = player.stage;
    const handlers = stage.updateHandlers.slice();
    window.__optClip = { pending: 0 };
    stage.updateHandlers.length = 0;
    stage.updateHandlers.push(() => {
      const d = window.__optClip.pending;
      window.__optClip.pending = 0;
      for (const h of handlers) h(d);
    });
  },
  { id, options },
);
await page.waitForTimeout(1500);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "opt-clip-"));
const total = Math.round(secs * fps);
const shots = [];
for (let n = 0; n < total; n++) {
  const t = n / fps;
  const png = await page.evaluate(
    async ({ t, step, script: fresh, w, h }) => {
      const { app, player } = window.__splashery;
      const script = (window.__optClip.script ||= fresh);
      const recipe = player.toyInfo.recipe;
      const tf = player.motion.ctx?.transform;
      const toWorld = (p) => (tf ? p.map((v, i) => (v - tf.center[i]) * tf.scale) : p);
      for (const e of script) {
        if (e.options && t >= e.t && !e.done) {
          e.done = true;
          await app.setToyOptions(e.options);
        }
        if (e.tap !== undefined && t >= e.t && !e.done) {
          e.done = true;
          player.act(e.tap ? toWorld(e.tap) : null);
        }
        if (e.control && t >= e.t && !e.done) {
          e.done = true;
          player.setControl(e.control, e.value);
        }
        if (e.drag && t >= e.t && !e.ended) {
          const s = Math.min(1, (t - e.t) / Math.max(1e-6, e.to - e.t));
          const pts = e.drag;
          const x = s * (pts.length - 1);
          const i = Math.min(pts.length - 2, Math.floor(x));
          const p = pts[i].map((v, k) => v + (pts[i + 1][k] - v) * (x - i));
          if (!e.started) {
            e.started = true;
            recipe.drag.start?.(pts[0], player.time);
          }
          recipe.drag.move?.(p, player.time);
          if (s >= 1) {
            e.ended = true;
            recipe.drag.end?.(player.time);
          }
        }
      }
      const stage = player.stage;
      stage.setFixedSize([w, h]);
      player.camera.cur = { ...player.camera.home };
      player.camera.tgt = { ...player.camera.home };
      window.__optClip.pending = step;
      await stage.captureFrame();
      window.__optClip.pending = 0;
      const c = await stage.captureFrame();
      return c.toDataURL("image/png");
    },
    { t, step: 1 / fps, script, w, h },
  );
  const file = path.join(dir, `f${String(n).padStart(4, "0")}.png`);
  fs.writeFileSync(file, Buffer.from(png.split(",")[1], "base64"));
  shots.push(file);
}
await browser.close();
execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(dir, "f%04d.png"), "-movflags", "+faststart", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-crf", "23", out]); // prettier-ignore
const strip = opt("strip", "");
if (strip) {
  const pick = [0.1, 0.3, 0.5, 0.7, 0.9].map((f) => shots[Math.min(shots.length - 1, Math.round(f * shots.length))]); // prettier-ignore
  execFileSync(ffmpeg, ["-y", "-loglevel", "error", ...pick.flatMap((f) => ["-i", f]), "-filter_complex", `hstack=inputs=${pick.length}`, strip]); // prettier-ignore
}
fs.rmSync(dir, { recursive: true, force: true });
console.log(`${id}: ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);

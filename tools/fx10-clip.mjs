#!/usr/bin/env node
// Lane Fix10: renders a toy's touch play as a phone-sized MP4 (390x844 by default), like
// tools/drag-clip.mjs but with the camera left free (so the toy's own view glides show) and a
// few more steps. The clock is stepped by hand, so the clip runs at the toy's real speed.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/fx10-clip.mjs <out-dir> <name> <toy id> <script.json> [--w=390] [--h=844] [--fps=15] [--bg=#111111] [--opt=key=value,key=value] [--strip=8]
//
// The script is a JSON list of steps (points in recipe coordinates):
//   { "wait": 1.2 }                              frames with nothing done
//   { "tap": [x, y, z] }                         a tap on the toy there
//   { "act": true }                              the toy's action (Play)
//   { "drag": [[x, y, z], ...], "secs": 0.6, "hold": 0.2 }   a drag on the toy (its grab path)
//   { "look": [[x, y], [x, y]], "secs": 0.8 }   a drag on the view, in screen fractions
//   { "slider": ["name", value], "secs": 1 }    moves the slider over the stage (out.slider) to value
//   { "control": ["key", value] }                sets a control
// Writes <out-dir>/<name>.mp4 and, with --strip, <name>-strip.png.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [outDir, name, id, scriptFile] = args.filter((a) => !a.startsWith("--"));
if (!scriptFile) throw new Error("Usage: node tools/fx10-clip.mjs <out-dir> <name> <toy id> <script.json>"); // prettier-ignore
const script = JSON.parse(fs.readFileSync(scriptFile, "utf8"));
const W = Number(opt("w", 390));
const H = Number(opt("h", 844));
const fps = Number(opt("fps", 15));
const bg = opt("bg", "#111111");
const stripN = Number(opt("strip", 0));
const toyOpts = opt("opt", "")
  ? opt("opt", "")
      .split(",")
      .map((s) => s.split("="))
  : [];
const ffmpeg = execFileSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).toString().trim(); // prettier-ignore

fs.mkdirSync(outDir, { recursive: true });
const tmp = fs.mkdtempSync(path.join(outDir, `.${name}-`));
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.exposeFunction(
  "__fx10Frame",
  (i, url) =>
  fs.writeFileSync(path.join(tmp, `f${String(i).padStart(5, "0")}.png`), Buffer.from(url.split(",")[1], "base64")), // prettier-ignore
);
await page.goto(`${base}?renderer=webgl2&profile=high&adapt=off&labs=1`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
const { count, strip } = await page.evaluate(
  async ({ id, W, H, fps, bg, script, stripN, toyOpts }) => {
    const { app, player } = window.__splashery;
    await app.chooseToy(id);
    for (const [k, v] of toyOpts) await app.setToyOption(k, isNaN(+v) ? v : +v);
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
    stage.setFixedSize([W, H]);
    player.camera.cur = { ...player.camera.home };
    player.camera.tgt = { ...player.camera.home };
    const step = 1 / fps;
    const frames = [];
    let n = 0;
    let finger = null;
    const frame = async () => {
      pending = step;
      await stage.captureFrame();
      pending = 0;
      const c = await stage.captureFrame();
      const out = document.createElement("canvas");
      out.width = W;
      out.height = H;
      const ctx = out.getContext("2d");
      ctx.drawImage(c, 0, 0, W, H);
      if (finger) {
        const r = stage.canvas.getBoundingClientRect();
        ctx.beginPath();
        ctx.arc((finger[0] / r.width) * W, (finger[1] / r.height) * H, W * 0.035, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();
      }
      if (stripN > 1) frames.push(await createImageBitmap(out));
      await window.__fx10Frame(n++, out.toDataURL("image/png"));
    };
    pending = 0.5;
    await stage.captureFrame();
    for (const s of script) {
      if (s.wait) for (let t = 0; t < s.wait - 1e-6; t += step) await frame();
      else if (s.tap) {
        finger = player.screenPoint(s.tap);
        player.act(player.fromRecipe(s.tap));
        for (let i = 0; i < 5; i++) await frame();
        finger = null;
      } else if (s.act) player.act();
      else if (s.control) player.motion.setControl(...s.control);
      else if (s.slider) {
        // The slider over the stage (a drive's out.slider), moved to `to` (0 to 1).
        const [, to] = s.slider;
        const from = player.motion.out?.slider?.value ?? 0;
        const k = Math.max(1, Math.round((s.secs ?? 1) / step));
        for (let i = 1; i <= k; i++) {
          player.sliderInput(player.motion.out?.slider?.id ?? "", from + ((to - from) * i) / k);
          await frame();
        }
      } else if (s.drag) {
        const pts = s.drag;
        const at = (u) => {
          const f = Math.min(pts.length - 1, u * (pts.length - 1));
          const i = Math.min(pts.length - 2, Math.floor(f));
          const k = f - i;
          return pts[i].map((v, j) => v + (pts[i + 1][j] - v) * k);
        };
        finger = player.screenPoint(pts[0]);
        player.grabStart(player.fromRecipe(pts[0]), ...finger);
        await frame();
        const k = Math.max(1, Math.round((s.secs ?? 0.6) / step));
        for (let i = 1; i <= k; i++) {
          finger = player.screenPoint(at(i / k));
          player.grabAt(...finger);
          await frame();
        }
        for (let t = 0; t < (s.hold ?? 0) - 1e-6; t += step) await frame();
        player.grabEnd();
        finger = null;
      } else if (s.look) {
        // A drag on the view: the camera's own drag, in CSS pixels.
        const r = stage.canvas.getBoundingClientRect();
        const [a, b] = s.look.map(([x, y]) => [x * r.width, y * r.height]);
        const cam = player.camera;
        const k = Math.max(1, Math.round((s.secs ?? 0.8) / step));
        let last = a;
        finger = a;
        cam.begin();
        for (let i = 1; i <= k; i++) {
          const p = [a[0] + ((b[0] - a[0]) * i) / k, a[1] + ((b[1] - a[1]) * i) / k];
          cam.rotateBy(p[0] - last[0], p[1] - last[1], step);
          last = p;
          finger = p;
          await frame();
        }
        cam.end();
        finger = null;
      }
    }
    stage.setFixedSize(null);
    stage.updateHandlers.length = 0;
    stage.updateHandlers.push(...handlers);
    let strip = null;
    if (stripN > 1 && frames.length) {
      const pick = Array.from({ length: stripN }, (_, i) => frames[Math.round((i / (stripN - 1)) * (frames.length - 1))]); // prettier-ignore
      const w = Math.round(W / 2);
      const h = Math.round(H / 2);
      const out = document.createElement("canvas");
      out.width = w * pick.length;
      out.height = h;
      const ctx = out.getContext("2d");
      pick.forEach((b, i) => ctx.drawImage(b, i * w, 0, w, h));
      strip = out.toDataURL("image/png");
    }
    return { count: n, strip };
  },
  { id, W, H, fps, bg, script, stripN, toyOpts },
);
await browser.close();
const mp4 = path.join(outDir, `${name}.mp4`);
execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(tmp, "f%05d.png"), "-movflags", "+faststart", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-crf", "23", mp4]); // prettier-ignore
fs.rmSync(tmp, { recursive: true, force: true });
if (strip) fs.writeFileSync(path.join(outDir, `${name}-strip.png`), Buffer.from(strip.split(",")[1], "base64")); // prettier-ignore
console.log(`${name}: ${mp4} (${count} frames, ${(fs.statSync(mp4).size / 1024).toFixed(0)} KB)`);

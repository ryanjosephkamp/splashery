#!/usr/bin/env node
// Lane Physics: renders a phone-size clip (390×844, the whole page with its
// buttons) of Hands-on play, with a dot where the finger is, as an MP4.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   pip install imageio-ffmpeg
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/phy-clip.mjs <out-dir> <name> <toy id> <script.json> [--fps=20] [--zoom=1] [--cam=yaw,pitch]
//
// The clock is stepped by hand, so the clip plays at real speed however
// slow the renderer is. The script is a JSON list of steps:
//   { "wait": 1.2 }                         frames with nothing done
//   { "button": "hands-toggle" }            presses a button (the dot shows on it)
//   { "drag": [[dx, dy], ...], "secs": 0.6, "hold": 0.2, "from": [x, y] }
//        a finger drag in CSS pixels from the toy's middle on screen (or
//        from a recipe point `from3` = [x, y, z]): press, move along the
//        points over secs, hold, let go (the app's own pointer path)
//   { "tap": [dx, dy] }                     a tap there
// Writes <out-dir>/<name>.mp4 and <name>-strip.png (8 frames).

import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [outDir, name, id, scriptFile] = args.filter((a) => !a.startsWith("--"));
if (!scriptFile) throw new Error("Usage: node tools/phy-clip.mjs <out-dir> <name> <toy id> <script.json>"); // prettier-ignore
const script = JSON.parse(fs.readFileSync(scriptFile, "utf8"));
const fps = Number(opt("fps", 20));
const zoom = Number(opt("zoom", 1));
const cam = opt("cam", "") ? opt("cam", "").split(",").map(Number) : null;
const W = 390;
const H = 844;

fs.mkdirSync(outDir, { recursive: true });
const tmp = fs.mkdtempSync(path.join(outDir, `.${name}-`));
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: true, hasTouch: true }); // prettier-ignore
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?renderer=webgl2&profile=mid&adapt=off`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
await page.evaluate(
  async ({ id, fps, cam, zoom }) => {
    const { app, player } = window.__splashery;
    await app.chooseToy(id);
    player.opts.idleDelay = 1e9;
    player.idle.weight = 0;
    player.scene.autoplay.turntable = false;
    player.camera.turntable = false;
    await new Promise((r) => setTimeout(r, 1500));
    const stage = player.stage;
    const handlers = stage.updateHandlers.slice();
    const S = (window.__clip = { pending: 0, step: 1 / fps, finger: null });
    stage.updateHandlers.length = 0;
    stage.updateHandlers.push(() => {
      const d = S.pending;
      S.pending = 0;
      for (const h of handlers) h(d);
    });
    if (cam || zoom !== 1) {
      const home = { ...player.camera.home };
      if (cam) Object.assign(home, { yaw: home.yaw + cam[0], pitch: home.pitch + cam[1] });
      home.distance *= zoom;
      player.camera.cur = { ...home };
      player.camera.tgt = { ...home };
    }
    // An overlay canvas over the stage: the frame and the finger's dot.
    const over = document.createElement("canvas");
    const r = stage.canvas.getBoundingClientRect();
    over.width = r.width;
    over.height = r.height;
    Object.assign(over.style, { position: "fixed", left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, zIndex: 3, pointerEvents: "none" }); // prettier-ignore
    stage.canvas.after(over);
    S.over = over;
    S.dot = document.createElement("div");
    Object.assign(S.dot.style, { position: "fixed", width: "26px", height: "26px", margin: "-13px 0 0 -13px", borderRadius: "50%", background: "rgba(255,255,255,0.6)", border: "2px solid rgba(0,0,0,0.55)", zIndex: 50, pointerEvents: "none", display: "none" }); // prettier-ignore
    document.body.append(S.dot);
    S.frame = async () => {
      S.pending = S.step;
      const c = await stage.captureFrame();
      const ctx = over.getContext("2d");
      ctx.clearRect(0, 0, over.width, over.height);
      ctx.drawImage(c, 0, 0, over.width, over.height);
      if (S.finger) {
        S.dot.style.display = "block";
        S.dot.style.left = `${S.finger[0]}px`;
        S.dot.style.top = `${S.finger[1]}px`;
      } else S.dot.style.display = "none";
    };
    // The toy's middle on screen (page pixels).
    S.middle = () => {
      const rr = stage.canvas.getBoundingClientRect();
      const p = stage.toScreen(player.toyInfo.center);
      return [rr.left + p[0], rr.top + p[1]];
    };
    S.screenOf = (p3) => {
      const rr = stage.canvas.getBoundingClientRect();
      const p = player.screenPoint(p3);
      return [rr.left + p[0], rr.top + p[1]];
    };
    // The app's pointer path, with synthetic pointer events on the canvas
    // (which can't be captured).
    stage.canvas.setPointerCapture = () => {};
    S.pointer = (type, x, y) => {
      stage.canvas.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 7, pointerType: "touch", isPrimary: true, bubbles: true, button: 0, buttons: type === "pointerup" ? 0 : 1 })); // prettier-ignore
    };
  },
  { id, fps, cam, zoom },
);

let n = 0;
const shoot = async () => {
  await page.evaluate(() => window.__clip.frame());
  await page.screenshot({ path: path.join(tmp, `f${String(n++).padStart(5, "0")}.png`) });
};
const step = 1 / fps;
await shoot();
for (const s of script) {
  if (s.wait) for (let t = 0; t < s.wait - 1e-6; t += step) await shoot();
  else if (s.button) {
    const box = await page.locator(`#${s.button}`).boundingBox();
    const at = [box.x + box.width / 2, box.y + box.height / 2];
    await page.evaluate((at) => (window.__clip.finger = at), at);
    for (let i = 0; i < 3; i++) await shoot();
    await page.evaluate((b) => document.getElementById(b).click(), s.button);
    for (let i = 0; i < 3; i++) await shoot();
    await page.evaluate(() => (window.__clip.finger = null));
  } else if (s.tap) {
    const at = await page.evaluate((d) => {
      const m = window.__clip.middle();
      return [m[0] + d[0], m[1] + d[1]];
    }, s.tap);
    await page.evaluate((at) => {
      const S = window.__clip;
      S.finger = at;
      S.pointer("pointerdown", ...at);
      S.pointer("pointerup", ...at);
    }, at);
    for (let i = 0; i < 4; i++) await shoot();
    await page.evaluate(() => (window.__clip.finger = null));
  } else if (s.drag) {
    const o = await page.evaluate((f) => (f ? window.__clip.screenOf(f) : window.__clip.middle()), s.from3 || null); // prettier-ignore
    const from = s.from ? [o[0] + s.from[0], o[1] + s.from[1]] : o;
    const pts = [[0, 0], ...s.drag].map((d) => [from[0] + d[0], from[1] + d[1]]);
    const at = (u) => {
      const f = Math.min(pts.length - 1, u * (pts.length - 1));
      const i = Math.min(pts.length - 2, Math.floor(f));
      const k = f - i;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k]; // prettier-ignore
    };
    await page.evaluate((p) => {
      const S = window.__clip;
      S.finger = p;
      S.pointer("pointerdown", ...p);
    }, pts[0]);
    // Let the press's pick finish (it is async).
    await page.waitForTimeout(300);
    await shoot();
    const frames = Math.max(1, Math.round((s.secs ?? 0.6) / step));
    for (let i = 1; i <= frames; i++) {
      const p = at(i / frames);
      await page.evaluate((p) => {
        const S = window.__clip;
        S.finger = p;
        S.pointer("pointermove", ...p);
      }, p);
      await shoot();
    }
    for (let t = 0; t < (s.hold ?? 0) - 1e-6; t += step) await shoot();
    await page.evaluate(
      (p) => {
        const S = window.__clip;
        S.pointer("pointerup", ...p);
        S.finger = null;
      },
      pts[pts.length - 1],
    );
  }
}
await browser.close();

const ffmpeg = execFileSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).toString().trim(); // prettier-ignore
const mp4 = path.join(outDir, `${name}.mp4`);
execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(tmp, "f%05d.png"), "-movflags", "+faststart", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-crf", "24", mp4]); // prettier-ignore
// A strip of 8 frames for a quick look.
const files = fs.readdirSync(tmp).sort();
const pick = Array.from({ length: 8 }, (_, i) => files[Math.round((i / 7) * (files.length - 1))]);
execFileSync(ffmpeg, ["-y", "-loglevel", "error", ...pick.flatMap((f) => ["-i", path.join(tmp, f)]), "-filter_complex", `${pick.map((_, i) => `[${i}:v]scale=195:422[v${i}]`).join(";")};${pick.map((_, i) => `[v${i}]`).join("")}hstack=inputs=8`, path.join(outDir, `${name}-strip.png`)]); // prettier-ignore
fs.rmSync(tmp, { recursive: true, force: true });
console.log(
  `${name}: ${mp4} (${(fs.statSync(mp4).size / 1024).toFixed(0)} KB, ${files.length} frames)`,
);

#!/usr/bin/env node
// Lane Photo fidelity (prefix phf): clips of Photo to 3D and Moving photo to 3D at phone size, the
// page as a phone shows it (390 by 844 at device scale 3), with a photo or video of your own opened
// in the toy. The page's clock is stepped by hand, so the clip plays at the toy's real speed however
// slow the renderer is; a video's playing copy is kept on that clock (each frame waits for its seek).
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/phf-clip.mjs <out.mp4>
//     --toy=photo-3d|moving-photo-3d [--file=<photo or video>] [--secs=6] [--fps=10] [--scale=3]
//     [--profile=mid] [--opt=key=value …] [--zoom=fit] [--rise=<s>] [--pause=<s>] [--start=<s>]
//     [--still=<s>:<out.png> …] [--label=<text>] [--crf=24]
//
// --zoom=fit: closer, until the picture fills the width (as a pinch would), to read its text.
// --rise: Photo to 3D's tap at that time (the depth rises and the view sways). --pause: Moving
// photo's tap at that time (it pauses). --start: where in the clip it begins. --still: a PNG of
// the page at that time. SPLASHERY_URL picks the server (another port serves main for "before").

import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const all = (name) => args.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3)); // prettier-ignore
const [out] = args.filter((a) => !a.startsWith("--"));
const toy = opt("toy", "photo-3d");
if (!out) throw new Error("Usage: node tools/phf-clip.mjs <out.mp4> --toy=… [--file=…]");
const file = opt("file", "");
const secs = Number(opt("secs", 6));
const fps = Number(opt("fps", 10));
const scale = Number(opt("scale", 3));
const rise = opt("rise", "") === "" ? null : Number(opt("rise", ""));
const pause = opt("pause", "") === "" ? null : Number(opt("pause", ""));
const start = Number(opt("start", 0));
const stills = all("still").map((s) => {
  const i = s.indexOf(":");
  return { t: Number(s.slice(0, i)), file: s.slice(i + 1), done: false };
});
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const options = Object.fromEntries(all("opt").map((a) => a.split("=")));

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl", "--autoplay-policy=user-gesture-required"], // prettier-ignore
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: scale, reducedMotion: "reduce" }); // prettier-ignore
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?renderer=webgl2&profile=${opt("profile", "mid")}&adapt=off&labs=1`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
await page.evaluate(async (toy) => {
  const { app, player } = window.__splashery;
  await app.chooseToy(toy);
  player.opts.idleDelay = 1e9;
  player.idle.weight = 0;
}, toy);
await page.waitForFunction(() => document.getElementById("progress").hidden, null, { timeout: 180_000 }); // prettier-ignore
if (Object.keys(options).length) await page.evaluate((o) => window.__splashery.app.setToyOptions(o), options); // prettier-ignore
if (file) {
  const name = path.basename(file).replace(/\.[^.]+$/, "");
  await page.setInputFiles("#toy-input-file", file);
  const check =
    toy === "photo-3d"
      ? async (n) => (await import("/src/packs/photo-3d.js")).photoState()?.name === n
      : async (n) => (await import("/src/packs/moving-photo.js")).MOVING.clip?.name === n;
  for (let k = 0; !(await page.evaluate(check, name)); k++) {
    if (k > 2400) throw new Error(`${file} was never read`);
    await page.waitForTimeout(500);
  }
}
await page.waitForFunction(() => window.__splashery.player.motion.recipe && document.getElementById("progress").hidden, null, { timeout: 180_000 }); // prettier-ignore
// Take the clock, go to the start, and frame the picture.
await page.evaluate(
  async ({ toy, zoom, label, start }) => {
    const { app, player } = window.__splashery;
    window.__clipT = 0;
    if (label) {
      const b = document.createElement("div");
      b.textContent = label;
      b.style.cssText = "position:fixed;left:8px;top:68px;z-index:99;font:600 11px system-ui;background:#000b;color:#fff;padding:3px 8px;border-radius:9px;pointer-events:none"; // prettier-ignore
      document.body.append(b);
    }
    let corners;
    if (toy === "photo-3d") {
      const s = (await import("/src/packs/photo-3d.js")).photoState();
      const a = s.grid ? s.grid[0] / s.grid[1] : 1;
      corners = [[-a / 2, 0, 0], [a / 2, 0, 0]]; // prettier-ignore
    } else {
      const m = await import("/src/packs/moving-photo.js");
      app.setControl("play", 1);
      m.movingTransport.seek(start);
      corners = [[-1, 0, 0], [1, 0, 0]]; // prettier-ignore
    }
    if (zoom === "fit")
      for (let k = 0; k < 3; k++) {
        await player.stage.captureFrame();
        const l = player.screenPoint(corners[0]);
        const r = player.screenPoint(corners[1]);
        const c = player.camera;
        c.cur = { ...c.cur, distance: Math.max(c.minDistance, (c.cur.distance * Math.abs(r[0] - l[0])) / (0.96 * player.stage.canvas.getBoundingClientRect().width)) }; // prettier-ignore
        c.tgt = { ...c.cur };
      }
  },
  { toy, zoom: opt("zoom", ""), label: opt("label", ""), start },
);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "phf-clip-"));
const step = 1 / fps;
const n = Math.round(secs * fps);
for (let i = 0; i < n + 3; i++) {
  const t = (i - 3) * step; // three frames to settle first
  if (rise !== null && t >= rise && t - step < rise)
    await page.evaluate(() => window.__splashery.player.motion.setControl("flat", 0));
  if (pause !== null && t >= pause && t - step < pause)
    await page.evaluate(() => window.__splashery.app.setControl("play", 0));
  await page.evaluate(
    async ({ t, step, toy }) => {
      window.__clipT = t;
      window.__pending = step;
      const { player } = window.__splashery;
      await player.stage.captureFrame();
      if (toy !== "photo-3d") {
        // A video's copy waits for its seek to the clip's time, then the frame is drawn again.
        const { MOVING } = await import("/src/packs/moving-photo.js");
        const v = MOVING.clip?.video;
        if (v) {
          v.pause();
          if (Math.abs(v.currentTime - MOVING.t) > 0.02) {
            v.currentTime = MOVING.t;
            await new Promise((r) => v.addEventListener("seeked", r, { once: true }));
          }
          window.__pending = 0;
          await player.stage.captureFrame();
        }
      }
    },
    { t, step, toy },
  );
  if (t < 0) continue;
  const png = await page.screenshot({ timeout: 180_000 });
  fs.writeFileSync(path.join(dir, `f-${String(i - 3).padStart(4, "0")}.png`), png);
  for (const s of stills)
    if (!s.done && t >= s.t) {
      s.done = true;
      fs.writeFileSync(s.file, png);
      console.log(s.file);
    }
  if (i % 10 === 0) process.stdout.write(`frame ${i - 3} of ${n}\r`);
}
await browser.close();
const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(dir, "f-%04d.png"), "-movflags", "+faststart", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-crf", opt("crf", "24"), out]); // prettier-ignore
if (r.status) throw new Error(String(r.stderr));
fs.rmSync(dir, { recursive: true, force: true });
console.log(`\n${out}: ${n} frames`);

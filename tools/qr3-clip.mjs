#!/usr/bin/env node
// Lane QR r3: phone-size clips of the QR toy's motions and Alive patterns,
// for the Effect review page. Like tools/effect-clip.mjs (a stepped clock,
// frame by frame), but with labs on and the toy's own frame hook
// (window.__splashery.qr.frame): a motion is filmed from a little above and
// to the side, then the camera glides into Scan view and holds the code
// still for 2.5 s, so the last frame can be scanned from the screen. An
// Alive clip stays in Scan view and runs two loops of the pattern.
//
//   node tools/qr3-clip.mjs <out dir> motion:<style>:<motion> … alive:<style>:<pattern>[:<speed>] …
//     [--theme=<id>] [--size=480] [--fps=25]
//
// Writes <out>/<name>.mp4 (and checks its last frame reads with jsQR).
// Needs the local server, SPLASHERY_CHROMIUM, and ffmpeg from imageio-ffmpeg
// (pip install imageio-ffmpeg).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import jsQR from "jsqr";

const args = process.argv.slice(2);
const opt = (n, d) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const [outDir, ...jobs] = args.filter((a) => !a.startsWith("--"));
const SIZE = Number(opt("size", 480));
const FPS = Number(opt("fps", 25));
const THEME = opt("theme", "");
const BASE = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const ffmpeg = execFileSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).toString().trim(); // prettier-ignore
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${BASE}?renderer=webgl2&adapt=off&profile=mid&labs=1`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
await page.evaluate(() => window.__splashery.app.chooseToy("qr-code"));
await page.waitForFunction(() => window.__splashery.qr?.info().size, null, { timeout: 60_000 });
await page.evaluate(() => (window.__splashery.qr.autoCheck = false));
const SECS = await page.evaluate(async () => (await import("/src/qr/field.js")).MOTION_SECS);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

for (const job of jobs) {
  const [kind, style, what, speedArg] = job.split(":");
  const name = `qr3-${style}-${what}${THEME ? `-${THEME}` : ""}${speedArg ? `-x${speedArg}` : ""}`;
  const tmp = fs.mkdtempSync(path.join(outDir, ".frames-"));
  await page.evaluate(
    async ({ style, theme, pattern }) => {
      const qr = window.__splashery.qr;
      await qr.set({ style, ...(pattern ? { alivePattern: pattern } : {}) });
      if (theme) await qr.theme(theme);
    },
    { style, theme: THEME, pattern: kind === "alive" ? what : null },
  );
  const frames = [];
  if (kind === "motion") {
    // Seen from a little above and to the side while it moves.
    const n = Math.round(SECS[what] * FPS);
    const side = { yaw: 24, pitch: -18, margin: 6 };
    // A tap's knock lands up and to the left of the middle.
    for (let i = 0; i <= n; i++) frames.push({ motion: what, q: i / n, ...side, knock: [-5, 4] });
    const glide = Math.round(1.0 * FPS);
    for (let i = 1; i <= glide; i++) {
      const t = ease(i / glide);
      frames.push({ yaw: side.yaw * (1 - t), pitch: side.pitch * (1 - t), margin: side.margin + (1 - side.margin) * t }); // prettier-ignore
    }
    for (let i = 0; i < 2.5 * FPS; i++) frames.push({ margin: 1 });
  } else {
    // Two loops of the pattern at the chosen speed (1 = normal), in Scan view.
    const speed = Number(speedArg || 1);
    const loop = (2 * Math.PI) / (1.8 * speed);
    const n = Math.round(Math.min(2 * loop, 9) * FPS);
    for (let i = 0; i < n; i++) frames.push({ alive: 1, phase: (2 * Math.PI * i) / (loop * FPS), margin: 1 }); // prettier-ignore
  }
  for (let i = 0; i < frames.length; i++) {
    const url = await page.evaluate((o) => window.__splashery.qr.frame(o), { size: SIZE, settle: 2, ...frames[i] }); // prettier-ignore
    fs.writeFileSync(path.join(tmp, `f${String(i).padStart(4, "0")}.png`), Buffer.from(url.split(",")[1], "base64")); // prettier-ignore
  }
  const last = PNG.sync.read(fs.readFileSync(path.join(tmp, `f${String(frames.length - 1).padStart(4, "0")}.png`))); // prettier-ignore
  const read = jsQR(new Uint8ClampedArray(last.data), last.width, last.height)?.data ?? null;
  const mp4 = path.join(outDir, `${name}.mp4`);
  execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(tmp, "f%04d.png"), "-movflags", "+faststart", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-crf", "20", mp4]); // prettier-ignore
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`${mp4}: ${frames.length} frames, last frame reads: ${read ? "yes" : "NO"}`);
}
await browser.close();

#!/usr/bin/env node
// Lane QR craft: phone-size clips of the lane's toys for the Effect review
// page. Like tools/effect-clip.mjs (the clock stepped by hand, frame by
// frame, so the clip runs at the effect's real speed), with labs on, a tall
// phone-shaped frame (360 × 480 at 2×, 720 × 960), the toy's options, and an
// optional glide to front on at the end (--front) so the last frame can be
// scanned from the screen; its last frame is read with jsQR (QR toys) or
// reported.
//
//   node tools/qrc-clip.mjs <out dir> <name>=<toy>[:<secs>] … [--opts='{"material":"marbles"}']
//     [--before=0.5] [--front=1] [--hold=1.6] [--fps=25] [--w=720] [--h=960] [--pitch=0.45]
//     [--at=x,y] (the tap point, recipe units) [--dist=0.8] (times the toy's home distance)
//
// Writes <out>/<name>.mp4 and <name>-strip.png (8 frames). Needs the local
// server, SPLASHERY_CHROMIUM, and ffmpeg from imageio-ffmpeg.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import jsQR from "jsqr";

const args = process.argv.slice(2);
const opt = (n, d) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const [outDir, ...jobs] = args.filter((a) => !a.startsWith("--"));
const W = Number(opt("w", 720));
const H = Number(opt("h", 960));
const FPS = Number(opt("fps", 25));
const BEFORE = Number(opt("before", 0.5));
const FRONT = Number(opt("front", 0));
const HOLD = Number(opt("hold", 1.6));
const OPTS = JSON.parse(opt("opts", "{}"));
const PITCH = opt("pitch", "");
const DIST = Number(opt("dist", 1));
const AT = opt("at", "") ? opt("at", "").split(",").map(Number) : null;
const BASE = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const ffmpeg = execFileSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).toString().trim(); // prettier-ignore
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const page = await browser.newPage({ viewport: { width: 900, height: 1000 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${BASE}?renderer=webgl2&adapt=off&profile=mid&labs=1`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });

for (const job of jobs) {
  const [name, rest] = job.split("=");
  const [toy, secsS] = rest.split(":");
  const secs = Number(secsS || 4);
  const frames = path.join(outDir, `${name}-frames`);
  fs.rmSync(frames, { recursive: true, force: true });
  fs.mkdirSync(frames);
  await page.evaluate(
    async ({ toy, OPTS }) => {
      const { app, player } = window.__splashery;
      await app.chooseToy(toy);
      if (Object.keys(OPTS).length) await player.switchTo({ options: OPTS });
      for (let i = 0; i < 400 && app.busy; i++) await new Promise((r) => setTimeout(r, 50));
      if (window.__splashery.qrCraft) window.__splashery.qrCraft.autoCheck = false;
      app.setLook({ background: "#ffffff" });
      player.opts.idleDelay = 1e9;
      player.idle.weight = 0;
      await new Promise((r) => setTimeout(r, 1200));
    },
    { toy, OPTS },
  );
  await page.evaluate(
    ({ W, H, PITCH, DIST }) => {
      const { player } = window.__splashery;
      const stage = player.stage;
      const handlers = stage.updateHandlers.slice();
      window.__clip = { handlers, pending: 0 };
      stage.updateHandlers.length = 0;
      stage.updateHandlers.push(() => {
        const d = window.__clip.pending;
        window.__clip.pending = 0;
        for (const h of handlers) h(d);
      });
      stage.setFixedSize([W, H]);
      const home = { ...player.camera.home };
      if (PITCH !== "") home.pitch = Number(PITCH);
      home.distance *= DIST;
      window.__clip.home = home;
    },
    { W, H, PITCH, DIST },
  );
  // One frame: step the clock, place the camera (home, or on the way to front
  // on), render twice (the sort runs a frame behind), save.
  let n = 0;
  const shoot = async (front = 0) => {
    const b64 = await page.evaluate(
      async ({ step, front }) => {
        const { player } = window.__splashery;
        const h = window.__clip.home;
        const e = front * front * (3 - 2 * front);
        const cam = { ...h, yaw: h.yaw * (1 - e), pitch: h.pitch * (1 - e), roll: 0 };
        window.__clip.pending = step;
        player.camera.cur = { ...cam };
        player.camera.tgt = { ...cam };
        await player.stage.captureFrame();
        window.__clip.pending = 0;
        player.camera.cur = { ...cam };
        player.camera.tgt = { ...cam };
        const c = await player.stage.captureFrame();
        return c.toDataURL("image/png").slice(22);
      },
      { step: 1 / FPS, front },
    );
    fs.writeFileSync(path.join(frames, `f${String(n++).padStart(4, "0")}.png`), Buffer.from(b64, "base64")); // prettier-ignore
  };
  await page.evaluate(() => (window.__clip.pending = 0.5));
  for (let t = 0; t < BEFORE; t += 1 / FPS) await shoot();
  await page.evaluate((AT) => {
    const { player } = window.__splashery;
    const tf = player.motion.ctx?.transform;
    const p = AT && tf ? [AT[0], AT[1], 0].map((v, i) => (v - tf.center[i]) * tf.scale) : null;
    player.act(p);
  }, AT);
  for (let t = 0; t < secs - 1e-6; t += 1 / FPS) await shoot();
  if (FRONT) {
    for (let t = 0; t < FRONT - 1e-6; t += 1 / FPS) await shoot(Math.min(1, (t + 1 / FPS) / FRONT));
    for (let t = 0; t < HOLD - 1e-6; t += 1 / FPS) await shoot(1);
  } else for (let t = 0; t < HOLD - 1e-6; t += 1 / FPS) await shoot();
  await page.evaluate(() => {
    const { player } = window.__splashery;
    player.stage.setFixedSize(null);
    player.stage.updateHandlers.length = 0;
    player.stage.updateHandlers.push(...window.__clip.handlers);
  });
  const mp4 = path.join(outDir, `${name}.mp4`);
  execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(frames, "f%04d.png"), "-movflags", "+faststart", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-crf", "22", mp4]); // prettier-ignore
  // A strip of 8 frames, and the last frame read with jsQR.
  const files = fs.readdirSync(frames).sort();
  const pick = Array.from({ length: 8 }, (_, i) => files[Math.round((i / 7) * (files.length - 1))]);
  execFileSync(ffmpeg, ["-y", "-loglevel", "error", ...pick.flatMap((f) => ["-i", path.join(frames, f)]), "-filter_complex", `${pick.map((_, i) => `[${i}:v]scale=180:-1[s${i}]`).join(";")};${pick.map((_, i) => `[s${i}]`).join("")}hstack=inputs=8`, path.join(outDir, `${name}-strip.png`)]); // prettier-ignore
  const last = PNG.sync.read(fs.readFileSync(path.join(frames, files.at(-1))));
  const r = jsQR(new Uint8ClampedArray(last.data), last.width, last.height);
  console.log(`${name}: ${files.length} frames, ${(fs.statSync(mp4).size / 1024).toFixed(0)} KB, last frame jsQR: ${r ? JSON.stringify(r.data) : "none"}`); // prettier-ignore
  fs.rmSync(frames, { recursive: true, force: true });
}
await browser.close();

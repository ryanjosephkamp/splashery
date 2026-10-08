#!/usr/bin/env node
// Lane Photoreal r3: a toy's tap effect as a phone-size clip (the stage at 390×844 points, labs
// on), saved as JPEG frames and an MP4, for judging an effect as motion at phone size.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   pip install imageio-ffmpeg
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/pr3-clip.mjs <out-dir> [--scale=2] [--fps=15] [--before=0.4] [--crop=0.18,0.78] [--strip=6] id[:secs] ...
//
// Writes <out-dir>/<id>.mp4 (and <id>-strip.png with --strip). The clock is stepped by hand, so a
// clip runs at real speed however slow the renderer is. --crop keeps that band of the frame's
// height (the toy; the phone's sheet and bar are not drawn). For a toy on its side or upside down,
// use tools/pose-sweep.mjs --only=<ids>.

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
const [outDir, ...ids] = args.filter((a) => !a.startsWith("--"));
const scale = Number(opt("scale", 2));
const fps = Number(opt("fps", 15));
const before = Number(opt("before", 0.4));
const crop = opt("crop", "0.18,0.78").split(",").map(Number);
const stripN = Number(opt("strip", 0));
const W = Math.round(390 * scale);
const H = Math.round(844 * scale);
const ffmpeg = execFileSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"], { encoding: "utf8" }).trim(); // prettier-ignore

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?labs=1&renderer=webgl2&profile=high&adapt=off`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
for (const spec of ids) {
  const [id, own] = spec.split(":");
  const secs = own ? Number(own) : 3.2;
  const frames = path.join(outDir, `${id}-frames`);
  fs.rmSync(frames, { recursive: true, force: true });
  fs.mkdirSync(frames, { recursive: true });
  await page.evaluate(
    async ({ id, W, H }) => {
      const { app, player } = window.__splashery;
      await app.chooseToy(id);
      for (let t = 0; player.loading && t < 240; t++) await new Promise((r) => setTimeout(r, 250));
      player.opts.idleDelay = 1e9;
      player.idle.weight = 0;
      await new Promise((r) => setTimeout(r, 1200));
      const stage = player.stage;
      window.__pr3 = { handlers: stage.updateHandlers.slice(), pending: 0 };
      stage.updateHandlers.length = 0;
      stage.updateHandlers.push(() => {
        const d = window.__pr3.pending;
        window.__pr3.pending = 0;
        for (const h of window.__pr3.handlers) h(d);
      });
      stage.setFixedSize([W, H]);
      window.__pr3.pending = 0.5;
      await stage.captureFrame();
    },
    { id, W, H },
  );
  const step = 1 / fps;
  const total = Math.round((before + secs) / step);
  for (let n = 0; n < total; n++) {
    const jpeg = await page.evaluate(
      async ({ step, tap, crop, W, H }) => {
        const { player } = window.__splashery;
        if (tap) player.act(null);
        window.__pr3.pending = step;
        player.camera.cur = { ...player.camera.home };
        player.camera.tgt = { ...player.camera.home };
        await player.stage.captureFrame();
        window.__pr3.pending = 0;
        const c = await player.stage.captureFrame();
        const y0 = Math.round(H * crop[0]);
        const h = Math.round((H * (crop[1] - crop[0])) / 2) * 2;
        const out = document.createElement("canvas");
        out.width = W;
        out.height = h;
        out.getContext("2d").drawImage(c, 0, y0, W, h, 0, 0, W, h);
        return out.toDataURL("image/jpeg", 0.9);
      },
      { step, tap: n === Math.round(before / step), crop, W, H },
    );
    fs.writeFileSync(path.join(frames, `${String(n).padStart(4, "0")}.jpg`), Buffer.from(jpeg.split(",")[1], "base64")); // prettier-ignore
  }
  await page.evaluate(() => {
    const stage = window.__splashery.player.stage;
    stage.setFixedSize(null);
    stage.updateHandlers.length = 0;
    stage.updateHandlers.push(...window.__pr3.handlers);
  });
  const mp4 = path.join(outDir, `${id}.mp4`);
  execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(frames, "%04d.jpg"), "-movflags", "+faststart", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-crf", "23", mp4]); // prettier-ignore
  if (stripN > 1) {
    const picks = Array.from({ length: stripN }, (_, i) =>
      Math.round((i * (total - 1)) / (stripN - 1)),
    );
    const inputs = picks.flatMap((p) => [
      "-i",
      path.join(frames, `${String(p).padStart(4, "0")}.jpg`),
    ]);
    execFileSync(ffmpeg, ["-y", "-loglevel", "error", ...inputs, "-filter_complex", `${picks.map((_, i) => `[${i}:v]scale=iw/2:-1[v${i}]`).join(";")};${picks.map((_, i) => `[v${i}]`).join("")}hstack=inputs=${stripN}`, path.join(outDir, `${id}-strip.png`)]); // prettier-ignore
  }
  console.log(`${id}: ${mp4} (${(fs.statSync(mp4).size / 1024).toFixed(0)} KB)`);
}
await browser.close();

#!/usr/bin/env node
// Lane Showcase: records the reel (showcase/index.html) to an MP4 for sharing,
// at a phone's 390×844 and a computer's 1440×900. The clock is stepped by
// hand (the page's ?record=1 mode), so every scene plays at its real speed
// however slow the renderer is; the page's own captions are in the picture.
// Building a toy takes no time in the video. Videos stay out of the repo.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   pip install imageio-ffmpeg
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/shw-video.mjs <out-dir> [--size=phone|desktop|both] [--fps=20] [--scenes=grapes,orange] [--title=2.5]
//
// Writes <out-dir>/showcase-390x844.mp4 and/or showcase-1440x900.mp4. The
// phone video is drawn at twice the pixels (780×1688), as a phone shows it.
// --scenes records only those scenes (by playlist id), for a short clip;
// --chapter=<id> records one chapter; --name=<file> names the output.

import { chromium } from "@playwright/test";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const outDir = args.find((a) => !a.startsWith("--"));
if (!outDir) throw new Error("Usage: node tools/shw-video.mjs <out-dir> [--size=both]");
const fps = Number(opt("fps", 20));
let only = opt("scenes", "") ? opt("scenes", "").split(",") : null;
const chapter = opt("chapter", "");
if (chapter) {
  const pl = JSON.parse(fs.readFileSync("src/showcase/playlist.json", "utf8"));
  const ch = pl.chapters.find((c) => c.id === chapter);
  if (!ch) throw new Error(`No chapter ${chapter}`);
  only = ch.scenes.map((s) => s.id);
}
const titleSecs = Number(opt("title", 2.5));
const which = opt("size", "both");
const SIZES = {
  phone: { width: 390, height: 844, scale: 2, name: "showcase-390x844.mp4" },
  desktop: { width: 1440, height: 900, scale: 1, name: "showcase-1440x900.mp4" },
};
const ffmpeg = execFileSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"], { encoding: "utf8" }).trim(); // prettier-ignore

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});

for (const key of which === "both" ? ["phone", "desktop"] : [which]) {
  const size = SIZES[key];
  const file = path.join(outDir, opt("name", "") || size.name);
  const enc = spawn(ffmpeg, [
    "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-",
    "-movflags", "+faststart", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
    "-c:v", "libx264", "-crf", "24", "-preset", "medium", file,
  ]); // prettier-ignore
  enc.stderr.on("data", (d) => process.stderr.write(d));
  const done = new Promise((r) => enc.on("close", r));
  const write = (buf) =>
    new Promise((r) => (enc.stdin.write(buf) ? r() : enc.stdin.once("drain", r)));

  const page = await browser.newPage({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: size.scale,
  });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(`${base}showcase/?record=1&renderer=webgl2&adapt=off`);
  await page.waitForFunction(() => window.__reel?.state().loaded, null, { timeout: 180_000 });
  const ids = await page.evaluate(() => window.__reel.scenes);
  const shot = () => page.screenshot({ type: "jpeg", quality: 88 });
  const hold = async (secs) => {
    const img = await shot();
    for (let i = 0; i < Math.round(secs * fps); i++) await write(img);
  };

  // The title card.
  if (titleSecs > 0) {
    await page.evaluate(() => {
      document.getElementById("shw-intro").hidden = false;
      document.getElementById("shw-start").hidden = true;
    });
    await hold(titleSecs);
    await page.evaluate(() => (document.getElementById("shw-intro").hidden = true));
  }

  let frames = 0;
  for (let i = 0; i < ids.length; i++) {
    if (only && !only.includes(ids[i])) continue;
    await page.evaluate((i) => window.__reel.go(i), i);
    await page.waitForFunction(
      (i) => window.__reel.state().index === i && window.__reel.state().loaded,
      i,
      { timeout: 180_000 },
    );
    // Let the canvas fade in (a CSS transition, in real time).
    await page.waitForTimeout(400);
    const t0 = Date.now();
    // Step until the reel moves on to the next scene (or ends).
    for (;;) {
      await page.evaluate((dt) => window.__reel.frame(dt), 1 / fps);
      await write(await shot());
      frames++;
      const s = await page.evaluate(() => window.__reel.state());
      if (s.index !== i || s.ended) break;
    }
    console.log(`${key} ${ids[i]}: ${((Date.now() - t0) / 1000).toFixed(0)} s to record`);
  }
  // The end card, when the whole reel was recorded.
  if (!only) await hold(3);
  await page.close();
  enc.stdin.end();
  await done;
  const mb = fs.statSync(file).size / 1e6;
  console.log(`${file}: ${(frames / fps).toFixed(0)} s of scenes, ${mb.toFixed(1)} MB`);
}
await browser.close();

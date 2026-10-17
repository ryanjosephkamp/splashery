#!/usr/bin/env node
// Capture the actual local PlayCanvas splat toy, including its rigid tap motion.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";
import { startPreview } from "./preview.mjs";
import { runCommand } from "./process.mjs";
const [resultDir, output, ...args] = process.argv.slice(2);
if (!resultDir || !output)
  throw new Error(
    "Usage: node tools/refblend/clip.mjs <result> <clip.mp4> [--size=1080] [--fps=30] [--seconds=2] [--tier=phone]",
  );
const opt = (key, fallback) =>
  args.find((s) => s.startsWith(`--${key}=`))?.split("=")[1] || fallback;
const size = Number(opt("size", 1080)),
  fps = Number(opt("fps", 30)),
  seconds = Number(opt("seconds", 2));
if (
  ![size, fps, seconds].every((n) => Number.isFinite(n) && n > 0) ||
  size % 2 ||
  !Number.isInteger(fps)
)
  throw new Error("Use a positive even size, integer fps, and positive seconds");
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "refblend-clip-"));
const { server, url } = await startPreview(path.resolve(resultDir));
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url + `?tier=${encodeURIComponent(opt("tier", "phone"))}`);
  await page.waitForSelector('body[data-ready="true"]', { timeout: 90000 });
  if (await page.locator("#tap").isEnabled()) await page.click("#tap");
  await page.evaluate((size) => {
    document.querySelector("header").style.display = "none";
    document.querySelector("footer").style.display = "none";
    document.querySelector("main").style.gridTemplateRows = "1fr";
    window.refblend.app.resizeCanvas(size, size);
  }, size);
  await page.waitForFunction(
    (size) => window.refblend.canvas.width === size && window.refblend.canvas.height === size,
    size,
  );
  // The real tap above starts the same motion sampled at fixed times below.
  const rigid = await page.evaluate(async () => {
    const { Vec3 } = await import("/src/pc.js");
    const api = window.refblend;
    const measure = (t) => {
      api.setProgress(t);
      return api.parts.map(({ entity }) => {
        const m = entity.getWorldTransform();
        const a = m.transformPoint(new Vec3(0.1, 0.2, 0.3));
        const b = m.transformPoint(new Vec3(-0.2, 0.1, -0.4));
        return a.distance(b);
      });
    };
    const a = measure(0),
      b = measure(0.5);
    return {
      parts: a.length,
      maxDistanceChange: Math.max(0, ...a.map((v, k) => Math.abs(v - b[k]))),
    };
  });
  if (rigid.maxDistanceChange > 1e-5)
    throw new Error("A moving part changed its internal distances");
  const frames = Math.ceil(seconds * fps);
  for (let i = 0; i < frames; i++) {
    const png = await page.evaluate((t) => window.refblend.capture(t), Math.min(1, i / fps / 1.4));
    const frame = Buffer.from(png.split(",")[1], "base64");
    if (frame.readUInt32BE(16) !== size || frame.readUInt32BE(20) !== size)
      throw new Error("Captured frame dimensions differ from --size");
    await fs.writeFile(path.join(temp, `frame-${String(i).padStart(5, "0")}.png`), frame);
  }
  if (errors.length) throw new Error(errors.join("\n"));
  await fs.mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-framerate",
      String(fps),
      "-i",
      path.join(temp, "frame-%05d.png"),
      "-frames:v",
      String(frames),
      "-c:v",
      "libx264",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      path.resolve(output),
    ],
    { deadline: Date.now() + 120000, log: path.join(temp, "ffmpeg.log") },
  );
  const provenance = await page.evaluate(() => window.refblend.result.provenance);
  const proof = {
    size,
    width: size,
    height: size,
    fps,
    seconds,
    frames,
    tier: opt("tier", "phone"),
    rigid,
    browserErrors: errors,
    provenance,
  };
  await fs.writeFile(path.resolve(output) + ".json", JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify(proof));
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
  await fs.rm(temp, { recursive: true, force: true });
}

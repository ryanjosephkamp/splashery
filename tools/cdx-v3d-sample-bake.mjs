#!/usr/bin/env node
// Bake a real clip through the browser's videoTo3D pipeline without the toy's display renderer.
// Usage: SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/cdx-v3d-sample-bake.mjs
// <video> <out-base> [--start=0] [--length=20] [--rate=3] [--frames=40]
// [--side=800] [--train=640] [--iters=3000] [--splats=120000] [--seed=40000]
// Source provenance belongs in the sample's metadata and asset record, never inferred here.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const [video, outBase] = args.filter((a) => !a.startsWith("--"));
if (!video || !outBase) throw new Error("Usage: cdx-v3d-sample-bake.mjs <video> <out-base>");
if (fs.statSync(video).size > 40e6)
  throw new Error("Trim the selected shot first; the batch tool makes a small cut before baking a long film."); // prettier-ignore
const number = (key, fallback) => Number(args.find((a) => a.startsWith(`--${key}=`))?.split("=")[1] ?? fallback); // prettier-ignore
const base = (process.env.SPLASHERY_URL || "http://127.0.0.1:4173/").replace(/\/$/, "");
fs.mkdirSync(path.dirname(outBase), { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: [
    "--no-sandbox",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-unsafe-webgpu",
    "--enable-features=Vulkan,WebGPU",
    "--use-webgpu-adapter=swiftshader",
    "--use-vulkan=swiftshader",
  ],
});
const page = await browser.newPage();
// A build operator can finish the current genuine model with SIGUSR2; SIGTERM stays fatal.
process.on("SIGUSR2", () => page.evaluate(() => window.__v3dBakeStop?.()).catch(() => {}));
const started = Date.now();
page.on("console", (m) => console.log(`${Math.round((Date.now() - started) / 1000)}s ${m.text()}`)); // prettier-ignore
page.on("pageerror", (e) => console.error(e));
await page.route(`${base}/__v3d-bake.html`, (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Offline sample bake</title>" })); // prettier-ignore
await page.route(`${base}/__v3d-bake-input`, (route) => route.fulfill({ contentType: video.endsWith(".webm") ? "video/webm" : "video/mp4", path: path.resolve(video) })); // prettier-ignore
try {
  await page.goto(`${base}/__v3d-bake.html`);
  const out = await page.evaluate(
    async (opts) => {
      const { videoTo3D } = await import("/src/video3d/run.js");
      const blob = await (await fetch("/__v3d-bake-input")).blob();
      const file = new File([blob], "capture.webm", { type: blob.type });
      const controller = new AbortController();
      window.__v3dBakeStop = () => controller.abort();
      if (opts.maxSeconds) setTimeout(() => controller.abort(), opts.maxSeconds * 1000);
      let last = "";
      const result = await videoTo3D(file, {
        ...opts,
        signal: controller.signal,
        onProgress: ({ stage, done, total, note }) => {
          const line = `${stage}: ${done}/${total} ${note || ""}`;
          if (line !== last) console.log(line);
          last = line;
        },
      });
      let binary = "";
      for (let i = 0; i < result.ply.length; i += 0x8000)
        binary += String.fromCharCode(...result.ply.subarray(i, i + 0x8000));
      return {
        ...result,
        // The shipped original is the selected cut, starting at zero. Preserve exact picked
        // frame times, relative to that cut, so Replay flight and Show the original stay aligned.
        cams: result.cams.map((c) => ({ ...c, time: Math.max(0, c.time - opts.start) })),
        bake: {
          settings: opts.settings,
          exportTrainSide: result.stats.trainSide,
          exportCam0: result.exportCam0,
          exportCameras: result.exportCameras,
          start: opts.start,
          length: opts.length,
          rate: opts.rate,
          sourceTimeOffset: opts.start,
          maxSeconds: opts.maxSeconds,
        },
        ply: btoa(binary),
      };
    },
    {
      tier: "offline",
      maxSeconds: number("max-seconds", 0),
      start: number("start", 0),
      length: number("length", 20),
      rate: number("rate", 3),
      settings: {
        maxFrames: number("frames", 40),
        frameSide: number("side", 800),
        featSide: number("side", 800),
        trainSide: number("train", 640),
        iters: number("iters", 3000),
        splats: number("splats", 120000),
        seed: number("seed", 40000),
      },
    },
  );
  const { ply, log, ...metadata } = out;
  metadata.bake.inputSha256 = createHash("sha256").update(fs.readFileSync(video)).digest("hex");
  fs.writeFileSync(`${outBase}.ply`, Buffer.from(ply, "base64"));
  fs.writeFileSync(`${outBase}.json`, JSON.stringify(metadata, null, 2) + "\n");
  fs.writeFileSync(`${outBase}-log.txt`, log.join("\n") + "\n");
  console.log(JSON.stringify({ stats: metadata.stats, timings: metadata.timings }));
} finally {
  await browser.close();
}

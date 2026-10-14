#!/usr/bin/env node
// Records a short walk-through of the preview site at phone size (lane Site):
// the home page and its live toy, the menu, the Toys page, a search, and a toy
// opened from the results. Writes .cache/site/site-walkthrough.webm (and an MP4
// beside it when imageio-ffmpeg is installed: pip install imageio-ffmpeg).
// Needs the local server (python3 -m http.server 4173 --bind 127.0.0.1).
//
//   node tools/site-clip.mjs

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173";
const dir = path.join(root, ".cache/site");
fs.mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/opt/pw-browsers/chromium",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const size = { width: 390, height: 844 };
const ctx = await browser.newContext({
  viewport: size,
  hasTouch: true,
  colorScheme: "light",
  recordVideo: { dir, size },
});
const page = await ctx.newPage();
const pause = (ms) => page.waitForTimeout(ms);

await page.goto(`${base}/site/?renderer=webgl2`);
await page
  .frameLocator(".hero-toy iframe")
  .locator("body[data-ready='true']")
  .waitFor({ timeout: 180_000 });
await pause(3500);
await page.locator(".menu-button").tap();
await pause(1500);
await page.locator(".site-header nav a", { hasText: "Toys" }).tap();
await pause(1500);
await page.mouse.wheel(0, 700);
await pause(1500);
await page.locator(".menu-button").tap();
await pause(600);
await page.locator("#site-search").fill("piano");
await pause(600);
await page.locator("#site-search").press("Enter");
await page.locator(".result-name").first().waitFor();
await pause(2500);
const href = await page.locator(".result a").first().getAttribute("href");
const url = new URL(href, page.url());
await page.goto(`${base}/?renderer=webgl2${url.hash}`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
await pause(3000);

const video = page.video();
await ctx.close();
await browser.close();
const out = path.join(dir, "site-walkthrough.webm");
fs.renameSync(await video.path(), out);
console.log(`wrote ${path.relative(root, out)}`);

try {
  const ffmpeg = execFileSync(
    "python3",
    ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"],
    { encoding: "utf8" },
  ).trim();
  const mp4 = out.replace(/\.webm$/, ".mp4");
  execFileSync(ffmpeg, ["-y", "-i", out, "-movflags", "+faststart", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-crf", "23", mp4], { stdio: "ignore" }); // prettier-ignore
  console.log(`wrote ${path.relative(root, mp4)}`);
} catch {
  console.log("no MP4: pip install imageio-ffmpeg for one");
}

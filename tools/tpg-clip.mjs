#!/usr/bin/env node
// The toy pages' walk-through clip (lane Toy pages), at phone size: the Toys
// page, a tap on a card, the toy's page with its live toy (tapped), then down
// the page to its credits, the embed snippets and related toys. Records a
// WebM with Playwright, then writes an MP4 next to it with the ffmpeg from
// imageio-ffmpeg (pip install imageio-ffmpeg). The server must be running.
//
//   node tools/tpg-clip.mjs [out.mp4]

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";

const out = path.resolve(process.argv[2] || "tpg-walkthrough.mp4");
const dir = fs.mkdtempSync(path.join(path.dirname(out), "tpg-clip-"));
const port = Number(process.env.SPLASHERY_PORT) || 4173;
const base = `http://127.0.0.1:${port}`;

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const size = { width: 390, height: 844 };
const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1, hasTouch: true, isMobile: true, colorScheme: "light", recordVideo: { dir, size } }); // prettier-ignore
const page = await ctx.newPage();
const pause = (ms) => page.waitForTimeout(ms);
const scrollTo = async (sel, ms = 1600) => {
  await page.evaluate((s) => window.scrollTo({ top: document.querySelector(s).getBoundingClientRect().top + window.scrollY - 70, behavior: "smooth" }), sel); // prettier-ignore
  await pause(ms);
};

await page.goto(`${base}/site/toys/?labs=0`);
await pause(1500);
await scrollTo("#shelf-scans", 1800);
const card = page.locator('.toy-card a[href$="toys/grape/"]').first();
await card.scrollIntoViewIfNeeded();
await pause(800);
await card.tap();
await page.waitForURL(/\/site\/toys\/grape\/$/);
const frame = page.frameLocator(".toy-stage iframe");
await frame.locator("body[data-ready='true']").waitFor({ timeout: 180_000 });
await page.locator(".toy-stage .stage.ready").waitFor();
await pause(3000);
// Tap the grape: it peels.
await frame.locator("#stage").tap();
await pause(8000);
await scrollTo("#h-about", 2200);
await scrollTo("#h-credits", 2200);
await scrollTo("#h-share", 1500);
await page.locator(".copy").nth(1).tap({ noWaitAfter: true });
await pause(1800);
await scrollTo("#h-related", 2500);
await ctx.close();
await browser.close();

const webm = fs.readdirSync(dir).find((f) => f.endsWith(".webm"));
const ffmpeg = execFileSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"], { encoding: "utf8" }).trim(); // prettier-ignore
execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", path.join(dir, webm), "-movflags", "+faststart", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-crf", "26", out]); // prettier-ignore
fs.rmSync(dir, { recursive: true });
console.log(`${out}: ${(fs.statSync(out).size / 1e6).toFixed(1)} MB`);

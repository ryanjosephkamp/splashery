#!/usr/bin/env node
// Records a short phone-size walk-through of the Site pages hubs (lane Site pages):
// Tools, Science, Learn, the splat explainer, the credits, What's new and the embed
// guide. Writes .cache/spg/spg-walkthrough.webm. Needs the local server
// (python3 -m http.server 4173 --bind 127.0.0.1).

import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173";
const dir = path.join(root, ".cache/spg");
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.SPLASHERY_CHROMIUM || "/opt/pw-browsers/chromium" }); // prettier-ignore
const size = { width: 390, height: 844 };
const ctx = await browser.newContext({
  viewport: size,
  hasTouch: true,
  recordVideo: { dir, size },
});
const page = await ctx.newPage();
await page.addInitScript(() => localStorage.setItem("splashery.labs", "1"));
for (const [url, scroll] of [
  ["tools/", 2600],
  ["science/", 900],
  ["learn/", 500],
  ["learn/splats/", 2400],
  ["about/credits/", 700],
  ["new/", 900],
  ["share/", 1400],
]) {
  // prettier-ignore
  await page.goto(`${base}/site/${url}`);
  await page.waitForTimeout(900);
  for (let y = 0; y <= scroll; y += 60) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(500);
}
const video = page.video();
await ctx.close();
fs.renameSync(await video.path(), path.join(dir, "spg-walkthrough.webm"));
await browser.close();
console.log("wrote .cache/spg/spg-walkthrough.webm");

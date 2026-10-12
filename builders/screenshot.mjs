#!/usr/bin/env node
// Screenshots of one toy at the two sizes a handback needs: 390×844 (a phone) and 1440×900 (a
// desktop). Run it from the repo root with the local server up (builders/SETUP.md, step 4).
//
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node builders/screenshot.mjs <out-dir> <toy id> [--labs]
//
// Writes <out-dir>/<toy id>-390x844.png and <out-dir>/<toy id>-1440x900.png. Add --labs for a toy
// that is behind the labs switch. Motion is left on; the shot is taken after the toy has settled.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const labs = args.includes("--labs");
const [outDir, id] = args.filter((a) => !a.startsWith("--"));
if (!outDir || !id)
  throw new Error("Usage: node builders/screenshot.mjs <out-dir> <toy id> [--labs]");

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
  ],
});
for (const [w, h] of [
  [390, 844],
  [1440, 900],
]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(`${base}?renderer=webgl2&profile=high&adapt=off${labs ? "&labs=1" : ""}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate((toy) => window.__splashery.app.chooseToy(toy), id);
  await page.waitForTimeout(4000);
  const file = path.join(outDir, `${id}-${w}x${h}.png`);
  await page.screenshot({ path: file });
  console.log(file);
  await page.close();
}
await browser.close();

#!/usr/bin/env node
// Real elements (lane Elements): measures how sharp the table and a lifted sample draw, on the
// same frames each time (the owner's "could just be a little bit sharper overall", October 6,
// 2026). For phone and desktop size it shoots the table and the lifted copper (the page's panels
// hidden), and prints the mean gradient energy (Sobel) over the toy: higher is sharper.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/rel-sharp.mjs [out-dir]
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { settle } from "./rel-settle.mjs";

const outDir = process.argv[2] || ".cache/rel/sharp";
fs.mkdirSync(outDir, { recursive: true });
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";

// Mean squared Sobel gradient of the luma over the pixels that differ from the page's background.
export function sharpness(png) {
  const { width: w, height: h, data } = png;
  const L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]; // prettier-ignore
  const bg = L[0];
  let sum = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (Math.abs(L[i] - bg) < 2) continue;
      const gx =
        L[i - w + 1] + 2 * L[i + 1] + L[i + w + 1] - L[i - w - 1] - 2 * L[i - 1] - L[i + w - 1];
      const gy =
        L[i + w - 1] + 2 * L[i + w] + L[i + w + 1] - L[i - w - 1] - 2 * L[i - w] - L[i - w + 1];
      sum += gx * gx + gy * gy;
      n++;
    }
  return n ? sum / n : 0;
}

const b = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
// (A phone draws at three device pixels to the point.)
for (const [vw, vh, profile, dpr] of [
  [390, 844, "low", 3],
  [1440, 900, "high", 1],
]) {
  const page = await b.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr });
  await page.goto(`${base}?labs=1&renderer=webgl2&profile=${profile}&adapt=off`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("real-elements"));
  await page.waitForFunction(() => window.__splashery.player.motion?.ctx?.kit?.data, null, { timeout: 120_000 }); // prettier-ignore
  await page.addStyleTag({ content: "* { visibility: hidden !important; } canvas { visibility: visible !important; }" }); // prettier-ignore
  const count = await page.evaluate(() => window.__splashery.player.proc?.ctx?.buf?.count);
  for (const [name, up] of [
    ["table", 0],
    ["lifted", 1],
  ]) {
    await page.evaluate((up) => window.__splashery.player.motion.setControl("up", up, { snap: true }), up); // prettier-ignore
    await page.waitForTimeout(800);
    await settle(page);
    const png = PNG.sync.read(await page.screenshot());
    const file = path.join(outDir, `rel-sharp-${name}-${vw}x${vh}.png`);
    fs.writeFileSync(file, PNG.sync.write(png));
    console.log(`${name} ${vw}x${vh} (${count} splats): sharpness ${sharpness(png).toFixed(0)} -> ${file}`); // prettier-ignore
  }
  await page.close();
}
await b.close();

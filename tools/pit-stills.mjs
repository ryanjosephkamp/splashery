#!/usr/bin/env node
// Renders the one-link page's stills (lane Pitch): site/assets/pitch/<toy>.webp, one per live toy
// on site/about/splashery/, framed exactly as the live toy starts (the same player address,
// 4:3), on a see-through background so one picture serves the light and the dark theme. A still
// shows until its toy is drawn, and stays where 3D can't start.
// Needs the local server (python3 -m http.server 4173 --bind 127.0.0.1).
//
//   node tools/pit-stills.mjs [toy …]

import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { PITCH_DEMOS } from "./site-pitch.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173";
const only = process.argv.slice(2);
const outDir = path.join(root, "site/assets/pitch");
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/opt/pw-browsers/chromium",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
for (const d of PITCH_DEMOS) {
  if (only.length && !only.includes(d.id)) continue;
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const q = d.q.includes("turntable=off") ? d.q : `${d.q}&turntable=off`;
  await page.goto(`${base}/site/play/?toy=${d.id}${q}&controls=0&bg=transparent&renderer=webgl2&profile=strong`); // prettier-ignore
  await page.waitForSelector("body[data-ready='true']", { timeout: 300_000 });
  await page.addStyleTag({ content: ".open-link,.embed-sound,.embed-status{display:none!important}" }); // prettier-ignore
  await page.waitForTimeout(4000);
  const png = (await page.screenshot({ type: "png", omitBackground: true })).toString("base64");
  // WebP through the browser's own encoder (keeps the alpha), at 640×480.
  const webp = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 480;
    c.getContext("2d").drawImage(img, 0, 0, 640, 480);
    return c.toDataURL("image/webp", 0.82).split(",")[1];
  }, png);
  const file = path.join(outDir, `${d.id}.webp`);
  fs.writeFileSync(file, Buffer.from(webp, "base64"));
  console.log(`wrote ${path.relative(root, file)} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`); // prettier-ignore
  await page.close();
}
await browser.close();

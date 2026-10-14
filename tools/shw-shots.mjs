#!/usr/bin/env node
// Lane Showcase: stills of every reel scene (showcase/index.html), for
// checking the reel without recording it. For each scene it builds the toy,
// steps the clock and saves the page at a few moments, and reports how long
// the build took, whether the caption fits and the caption's numbers line.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium OUT=<dir> node tools/shw-shots.mjs [width] [height] [scene,scene]
//
// Writes <dir>/<scene>-<seconds>.png (390×844 by default).

import { chromium } from "@playwright/test";
import fs from "node:fs";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const [w, h, only] = [
  Number(process.argv[2] || 390),
  Number(process.argv[3] || 844),
  process.argv[4],
];
const out = process.env.OUT || ".cache/shw-shots";
const AT = (process.env.AT || "1.2,2.6,4.2").split(",").map(Number);
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const p = await b.newPage({ viewport: { width: w, height: h } });
p.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await p.goto(`${base}showcase/?record=1&renderer=webgl2&adapt=off`);
await p.waitForFunction(() => window.__reel && window.__reel.state().loaded, null, { timeout: 180000 }); // prettier-ignore
const ids = await p.evaluate(() => window.__reel.scenes);
for (let i = 0; i < ids.length; i++) {
  if (only && !only.split(",").includes(ids[i])) continue;
  const t0 = Date.now();
  await p.evaluate((i) => window.__reel.go(i), i);
  await p.waitForFunction((i) => { const s = window.__reel.state(); return s.index === i && s.loaded; }, i, { timeout: 180000 }); // prettier-ignore
  const load = Date.now() - t0;
  const fact = await p.textContent("#shw-fact");
  let t = 0;
  for (const at of AT) {
    while (t < at - 1e-6) {
      await p.evaluate(() => window.__reel.frame(1 / 10));
      t += 0.1;
    }
    await p.screenshot({ path: `${out}/${ids[i]}-${at}.png` });
  }
  const fit = await p.evaluate(() => {
    const c = document.querySelector("#shw-caption");
    return c.scrollHeight <= c.clientHeight + 1;
  });
  console.log(ids[i], `load ${load} ms`, fit ? "fits" : "OVERFLOW", "|", fact);
}
await b.close();

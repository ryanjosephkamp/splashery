#!/usr/bin/env node
// Renders site/assets/pitch-og.png (lane Pitch): the 1200×630 link preview of the one-link page
// (site/about/splashery/), three toys' own pictures beside the page's headline.
// Needs the local server (python3 -m http.server 4173 --bind 127.0.0.1).
//
//   node tools/pit-og.mjs

import path from "node:path";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173";
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/opt/pw-browsers/chromium",
});
const card = await browser.newPage({ viewport: { width: 1200, height: 630 } });
const pic = (id, x, y, s) =>
  `<img src="${base}/assets/toys/${id}/thumb.webp" style="position:absolute;left:${x}px;top:${y}px;width:${s}px;height:${s}px" />`; // prettier-ignore
await card.setContent(`<!doctype html><html><body style="margin:0;width:1200px;height:630px;position:relative;overflow:hidden;background:#101010;font-family:ui-sans-serif,-apple-system,'Segoe UI',sans-serif;color:#f2f2f2">
<div style="position:absolute;left:72px;top:96px;width:560px">
<div style="font:600 22px ui-monospace,Menlo,monospace;letter-spacing:3px;color:#c4c4c4">SPLASHERY</div>
<div style="font-size:62px;font-weight:760;line-height:1.06;letter-spacing:-1.5px;margin-top:20px">A 3D Gaussian splat engine and studio, in a browser tab.</div>
<div style="font-size:26px;color:#c4c4c4;margin-top:28px">Nothing to install. Nothing uploaded.</div>
</div>
${pic("grape", 690, 70, 260)}${pic("toy-piano", 900, 190, 270)}${pic("qr-code", 700, 340, 230)}
</body></html>`);
await card.waitForLoadState("networkidle");
await card.screenshot({ path: path.join(root, "site/assets/pitch-og.png") });
await browser.close();
console.log("wrote site/assets/pitch-og.png");

#!/usr/bin/env node
// Renders site/assets/og.png (lane Site): the 1200×630 picture link previews
// show for the site's pages, the home page's strawberry beside the name.
// Needs the local server (python3 -m http.server 4173 --bind 127.0.0.1).
//
//   node tools/site-og.mjs

import path from "node:path";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173";
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/opt/pw-browsers/chromium",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

// The toy alone, on a light page, still.
const toyPage = await browser.newPage({ viewport: { width: 640, height: 630 } });
await toyPage.goto(
  `${base}/site/play/?toy=strawberry&turntable=off&zoom=0.8&controls=0&theme=light&renderer=webgl2&profile=strong`,
);
await toyPage.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
await toyPage.addStyleTag({ content: ".open-link{display:none!important}" });
await toyPage.waitForTimeout(3000);
const toy = (await toyPage.screenshot({ type: "png" })).toString("base64");

// The card.
const card = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await card.setContent(`<!doctype html><html><body style="margin:0;width:1200px;height:630px;display:flex;align-items:center;background:#fff;font-family:ui-sans-serif,-apple-system,'Segoe UI',sans-serif;color:#111">
<div style="flex:1;padding:0 0 0 80px">
<svg viewBox="0 0 64 64" width="96" height="96"><g opacity=".92"><ellipse cx="24" cy="26" rx="14" ry="11" fill="#ff5fa2"/><ellipse cx="40" cy="24" rx="12" ry="13" fill="#7bdff2"/><ellipse cx="33" cy="41" rx="15" ry="11" fill="#ffd166"/></g></svg>
<div style="font-size:88px;font-weight:700;letter-spacing:-2px;margin:8px 0 4px">Splashery</div>
<div style="font-size:38px;color:#3f3f3f">splats you can play with</div>
</div>
<img src="data:image/png;base64,${toy}" width="640" height="630" style="display:block" />
</body></html>`);
await card.screenshot({ path: path.join(root, "site/assets/og.png") });
await browser.close();
console.log("wrote site/assets/og.png");

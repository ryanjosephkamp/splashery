#!/usr/bin/env node
// Lane QR r3: renders the QR toy's scan view to a PNG (what Save a PNG, Full
// screen and the check draw), for looking at a build change up close.
//
//   node tools/qr3-render.mjs <out.png> [--px=390] [--style=classic]
//     [--set='{"fg":"#123456"}'] [--tune='{"crisp":false}'] [--url-extra=&cull=off]
//
// Needs the local server (python3 -m http.server 4173 --bind 127.0.0.1) and
// SPLASHERY_CHROMIUM.
import fs from "node:fs";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const opt = (n, d) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const out = args.find((a) => !a.startsWith("--"));
const BASE = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${BASE}?renderer=webgl2&adapt=off&profile=mid&labs=1${opt("url-extra", "")}`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
await page.evaluate(
  async (t) => {
    const b = await import("/src/qr/build.js");
    Object.assign(b.TUNE, t);
  },
  JSON.parse(opt("tune", "{}")),
);
await page.evaluate(() => window.__splashery.app.chooseToy("qr-code"));
await page.waitForFunction(() => window.__splashery.qr?.info().size, null, { timeout: 60_000 });
await page.evaluate((o) => window.__splashery.qr.set(o), {
  style: opt("style", "classic"),
  ...JSON.parse(opt("set", "{}")),
});
const b64 = await page.evaluate(
  async (px) => {
    const blob = await window.__splashery.qr.png(px);
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = "";
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000)); // prettier-ignore
    return btoa(s);
  },
  Number(opt("px", 390)),
);
fs.writeFileSync(out, Buffer.from(b64, "base64"));
await browser.close();

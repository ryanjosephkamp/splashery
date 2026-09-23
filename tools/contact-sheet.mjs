#!/usr/bin/env node
// Renders a contact sheet of shelf thumbnails to a PNG, for checking a pack
// at a glance (run tools/make-thumbs.mjs first).
//
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/contact-sheet.mjs out.png space
//   ... node tools/contact-sheet.mjs out.png heart campfire chest
//
// Arguments after the output file are pack names or toy ids. The site must
// be served (SPLASHERY_URL, default http://127.0.0.1:4173/).

import { chromium } from "@playwright/test";
import { TOYS } from "../src/toys.js";

const [out, ...want] = process.argv.slice(2);
if (!out) throw new Error("Usage: node tools/contact-sheet.mjs out.png <pack|id>...");
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const toys = TOYS.filter((t) => !want.length || want.includes(t.id) || want.includes(t.pack));
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
});
const page = await browser.newPage({ viewport: { width: 1236, height: 800 } });
const cells = toys
  .map(
    (t) =>
      `<figure><img src="${base}assets/toys/${t.id}/thumb.webp?${Date.now()}" width="200" height="200"><figcaption>${t.label}<br><small>${t.id}</small></figcaption></figure>`,
  )
  .join("");
await page.setContent(
  `<style>body{margin:0;font:12px sans-serif}main{display:grid;grid-template-columns:repeat(6,200px);gap:6px;padding:6px}figure{margin:0;text-align:center}img{background:#eee;display:block}small{color:#777}</style><main>${cells}</main>`,
);
await page.waitForTimeout(1000);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(`${toys.length} toys -> ${out}`);

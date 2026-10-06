#!/usr/bin/env node
// Lane PDF lab: a clip of a PDF's flip book playing in PDF.js (pdfjs-dist,
// the engine inside Firefox's PDF viewer) with its scripting on, at phone
// size, plus screenshots of its pages. For the Effect review page; it shows
// the PDF's own script at work, not the toy.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/pdf-clip.mjs <file.pdf> <out-prefix> [--w=390] [--h=844] [--secs=6] [--shots]
//
// Writes <out-prefix>.gif (page 2: play pressed, then the frames as they
// play) and with --shots <out-prefix>-p1.png and -p2.png at that size.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import { GIFEncoder, quantize, applyPalette } from "../vendor/gifenc/gifenc.esm.js";
import { PNG } from "pngjs";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [file, out] = args.filter((a) => !a.startsWith("--"));
if (!file || !out) throw new Error("Usage: node tools/pdf-clip.mjs <file.pdf> <out-prefix>");
const W = Number(opt("w", 390));
const H = Number(opt("h", 844));
const secs = Number(opt("secs", 6));

const VIEWER = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width">
<link rel=stylesheet href="/node_modules/pdfjs-dist/legacy/web/pdf_viewer.css">
<style>body{margin:0;background:#525659}#c{position:absolute;inset:0;overflow:auto}</style>
<div id=c><div id=viewer class=pdfViewer></div></div>
<script type=module>
const D = "/node_modules/pdfjs-dist/";
const lib = await import(D + "legacy/build/pdf.mjs");
globalThis.pdfjsLib = lib;
lib.GlobalWorkerOptions.workerSrc = D + "legacy/build/pdf.worker.mjs";
const V = await import(D + "legacy/web/pdf_viewer.mjs");
const eventBus = new V.EventBus();
const linkService = new V.PDFLinkService({ eventBus });
const scripting = new V.PDFScriptingManager({ eventBus, sandboxBundleSrc: D + "legacy/build/pdf.sandbox.mjs", wasmUrl: D + "wasm/" });
const viewer = new V.PDFViewer({ container: document.getElementById("c"), eventBus, linkService, scriptingManager: scripting });
linkService.setViewer(viewer); scripting.setViewer(viewer);
eventBus.on("sandboxcreated", () => { window.sandboxReady = true; });
eventBus.on("pagesinit", () => { viewer.currentScaleValue = "page-width"; window.pagesReady = true; });
window.openPdf = async (b64) => {
  const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const doc = await lib.getDocument({ data, enableScripting: true, wasmUrl: D + "wasm/" }).promise;
  viewer.setDocument(doc); linkService.setDocument(doc); await scripting.setDocument(doc);
  window.viewer = viewer;
};
window.loaded = true;
</script>`;

const browser = await chromium.launch({ executablePath: process.env.SPLASHERY_CHROMIUM || undefined }); // prettier-ignore
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.route("**/__pdf-viewer.html", (r) => r.fulfill({ contentType: "text/html", body: VIEWER })); // prettier-ignore
await page.goto(`${base}__pdf-viewer.html`);
await page.waitForFunction(() => window.loaded);
await page.evaluate((b64) => window.openPdf(b64), fs.readFileSync(file).toString("base64"));
await page.waitForFunction(() => window.pagesReady && window.sandboxReady);
await page.waitForTimeout(2500);
if (args.includes("--shots")) {
  for (const n of [1, 2]) {
    await page.evaluate((n) => window.viewer.scrollPageIntoView({ pageNumber: n }), n);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}-p${n}.png` });
  }
}
// Page 2, scrolled so the picture and its buttons fill the screen.
const ids = await page.evaluate(async () => {
  const a = await (await window.viewer.pdfDocument.getPage(2)).getAnnotations();
  return Object.fromEntries(a.filter((x) => x.fieldName).map((x) => [x.fieldName, x.id]));
});
// Zoomed so the picture (396 points wide) about fills the screen's width.
await page.evaluate((w) => (window.viewer.currentScale = Math.min(1.6, (w - 16) / 396)), W);
await page.waitForTimeout(1200);
await page.evaluate((id) => document.querySelector(`[data-annotation-id="${id}"]`).scrollIntoView({ block: "center", inline: "center" }), ids.spf0); // prettier-ignore
await page.waitForTimeout(1000);
const gif = GIFEncoder();
const add = async (delay) => {
  const png = PNG.sync.read(await page.screenshot());
  const palette = quantize(png.data, 256, { format: "rgb565" });
  gif.writeFrame(applyPalette(png.data, palette, "rgb565"), png.width, png.height, { palette, delay, repeat: 0 }); // prettier-ignore
};
await add(800);
const box = await page.locator(`[data-annotation-id="${ids.spplay}"]`).boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.up();
// Real time: a screenshot about every 125 ms while it plays.
const t0 = Date.now();
let last = t0;
while (Date.now() - t0 < secs * 1000) {
  await page.waitForTimeout(Math.max(0, 125 - (Date.now() - last)));
  const now = Date.now();
  await add(Math.max(40, now - last));
  last = now;
}
gif.finish();
fs.writeFileSync(`${out}.gif`, gif.bytes());
console.log(`${out}.gif (${(gif.bytes().length / 1024).toFixed(0)} KB)`);
await browser.close();

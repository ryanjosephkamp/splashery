#!/usr/bin/env node
// Lane Fluids: evidence cards for the Effect review page. Puts a clip of the
// Fluid lab (from tools/fl-clip.mjs) beside real reference photos, with the
// measured checks against published physics (from tools/fl-physics.mjs)
// underneath, and draws the physics and phone-budget summary cards.
//
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/fl-evidence.mjs <cards.json> <out-dir>
//
// cards.json is a list of cards:
//   { "id": "fl-pour-r3", "title": "...", "clip": "fl-pour.gif", "crop": [60, 530],
//     "every": 1, "refs": [{ "file": "water.jpg", "label": "...", "credit": "..." }],
//     "checks": [{ "ok": "yes" | "partly" | "no", "text": "..." }], "note": "..." }
// or a static page: { "id": "fl-physics-r1", "html": "<section>...</section>" }.
// A reference can also be a video (r4): { "video": "candle.webm", "start": 2,
// "label", "credit" }, played in step with the clip, frame by frame.
// Reference photos are never committed: each card credits its photos (author,
// license, Commons page), which must be CC0, CC BY or public domain.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { GifReader } from "../vendor/omggif/omggif.js";
import { GIFEncoder, quantize, applyPalette } from "../vendor/gifenc/gifenc.esm.js";

const [cardsFile, outDir] = process.argv.slice(2);
if (!cardsFile || !outDir)
  throw new Error("Usage: node tools/fl-evidence.mjs <cards.json> <out-dir>");
const cards = JSON.parse(fs.readFileSync(cardsFile, "utf8"));
const root = path.dirname(path.resolve(cardsFile));
fs.mkdirSync(outDir, { recursive: true });
const W = 740;
const PANEL = 360;

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
});
const page = await browser.newPage({ viewport: { width: W, height: 400 }, deviceScaleFactor: 1 });

const dataUrl = (file) => {
  const ext = path.extname(file).slice(1).toLowerCase().replace("jpg", "jpeg");
  const kind = ext === "webm" || ext === "mp4" ? "video" : "image";
  return `data:${kind}/${ext};base64,${fs.readFileSync(path.resolve(root, file)).toString("base64")}`;
};
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const MARK = { yes: ["✓", "#5fd08a"], partly: ["≈", "#f0c05a"], no: ["✗", "#ff7a6b"] };

const CSS = `
  * { box-sizing: border-box; margin: 0; }
  body { width: ${W}px; background: #15171a; color: #e9ecef; font: 15px/1.35 system-ui, sans-serif; padding: 14px 10px 12px; }
  h1 { font-size: 19px; font-weight: 650; margin: 0 0 10px 2px; }
  h1 small { font-weight: 400; color: #9aa3ab; font-size: 13px; margin-left: 6px; }
  .row { display: flex; gap: 0 20px; }
  .col { width: ${PANEL}px; }
  .lab { font-size: 13px; color: #9aa3ab; margin: 0 0 4px 2px; text-transform: uppercase; letter-spacing: .04em; }
  .pane { width: ${PANEL}px; border-radius: 10px; overflow: hidden; background: #0d0e10; }
  .pane img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .refs { display: flex; flex-direction: column; gap: 6px; }
  .refs figure { position: relative; }
  .refs figcaption { position: absolute; left: 6px; bottom: 6px; font-size: 12px; background: #000a; padding: 2px 6px; border-radius: 6px; }
  .checks { margin: 12px 2px 0; }
  .check { display: flex; gap: 8px; margin: 0 0 7px; }
  .check b { font-size: 18px; line-height: 1.1; width: 16px; flex: none; text-align: center; }
  .note { color: #b8c0c7; font-size: 13px; margin: 4px 2px 0; }
  .credit { color: #8a939b; font-size: 11.5px; margin: 10px 2px 0; }
  .tag { position: absolute; right: 8px; top: 6px; font: 600 12px system-ui; background: #000b; padding: 2px 7px; border-radius: 6px; }
  table { border-collapse: collapse; width: 100%; font-size: 14px; }
  td, th { padding: 4px 6px; border-bottom: 1px solid #2a2e33; text-align: left; vertical-align: top; }
  th { color: #9aa3ab; font-weight: 500; font-size: 13px; }
  h2 { font-size: 16px; margin: 14px 2px 6px; }
  p { margin: 0 2px 8px; }
`;

function sideBySide(card, h) {
  const refH = Math.floor((h - (card.refs.length - 1) * 6) / card.refs.length);
  const refs = card.refs
    .map((r, i) =>
      r.video
        ? `<figure class="pane" style="height:${refH}px"><video id="ref${i}" muted playsinline preload="auto" src="${dataUrl(r.video)}" style="display:block;width:100%;height:100%;object-fit:cover;object-position:${r.pos || "50% 50%"}"></video><figcaption>${esc(r.label)}</figcaption></figure>`
        : `<figure class="pane" style="height:${refH}px"><img src="${dataUrl(r.file)}" style="object-position:${r.pos || "50% 50%"}"><figcaption>${esc(r.label)}</figcaption></figure>`,
    )
    .join("");
  const videos = card.refs.some((r) => r.video);
  const checks = (card.checks || [])
    .map(
      (c) =>
        `<div class="check"><b style="color:${MARK[c.ok][1]}">${MARK[c.ok][0]}</b><span>${c.text}</span></div>`,
    )
    .join("");
  const credits = card.refs.map((r) => esc(r.credit)).join(" · ");
  return `<h1>${esc(card.title)}<small>built by Opus 5.5</small></h1>
    <div class="row">
      <div class="col"><div class="lab">Splashery (simulated, phone tier)</div>
        <div class="pane" style="height:${h}px;position:relative"><img id="ours" style="object-fit:cover"><span class="tag" id="clock"></span></div></div>
      <div class="col"><div class="lab">Real (reference ${videos ? "video" : card.refs.length > 1 ? "photos" : "photo"})</div><div class="refs">${refs}</div></div>
    </div>
    <div class="checks">${checks}</div>
    ${card.note ? `<p class="note">${card.note}</p>` : ""}
    <p class="credit">Reference ${videos ? "video" : card.refs.length > 1 ? "photos" : "photo"} from Wikimedia Commons: ${credits}. ${card.sources ? esc(card.sources) : ""}</p>`;
}

// The frames of a GIF, fully composited, as RGBA buffers.
function gifFrames(file) {
  const buf = fs.readFileSync(path.resolve(root, file));
  const r = new GifReader(new Uint8Array(buf));
  const frames = [];
  const rgba = new Uint8Array(r.width * r.height * 4);
  for (let i = 0; i < r.numFrames(); i++) {
    r.decodeAndBlitFrameRGBA(i, rgba);
    frames.push({ data: rgba.slice(), delay: r.frameInfo(i).delay * 10 });
  }
  return { w: r.width, h: r.height, frames };
}

function cropPng(frame, w, [y0, y1]) {
  const png = new PNG({ width: w, height: y1 - y0 });
  png.data = Buffer.from(frame.data.subarray(y0 * w * 4, y1 * w * 4));
  return `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`;
}

for (const card of cards) {
  const out = path.join(outDir, `${card.id}.${card.clip ? "gif" : "png"}`);
  if (!card.clip) {
    await page.setContent(`<style>${CSS}</style><body>${card.html}</body>`);
    await page.setViewportSize({ width: W, height: 200 });
    const h = await page.evaluate(() => document.body.scrollHeight);
    await page.setViewportSize({ width: W, height: h });
    fs.writeFileSync(out, await page.screenshot({ fullPage: true }));
    console.log(`${card.id}: ${out}`);
    continue;
  }
  const gif = gifFrames(card.clip);
  const crop = card.crop || [0, gif.h];
  const h = crop[1] - crop[0];
  await page.setContent(`<style>${CSS}</style><body>${sideBySide(card, h)}</body>`);
  await page.setViewportSize({ width: W, height: 200 });
  const H = await page.evaluate(() => document.body.scrollHeight);
  await page.setViewportSize({ width: W, height: H });
  const enc = GIFEncoder();
  let t = 0;
  const every = card.every || 1;
  const pick = gif.frames.filter((_, i) => i % every === 0);
  for (const f of pick) {
    await page.evaluate(
      ([src, clock]) =>
        new Promise((res) => {
          const img = document.getElementById("ours");
          img.onload = () => res();
          img.src = src;
          document.getElementById("clock").textContent = clock;
        }),
      [cropPng(f, gif.w, crop), `${t.toFixed(1)} s`],
    );
    // Reference videos: the same moment (from each one's start, looping).
    await page.evaluate(
      async ([t, starts]) => {
        for (const [i, start] of starts) {
          const v = document.getElementById(`ref${i}`);
          if (!v) continue;
          if (v.readyState < 1) await new Promise((r) => (v.onloadedmetadata = r));
          const at = (start + t) % Math.max(0.1, v.duration - 0.05);
          await new Promise((r) => {
            v.onseeked = () => r();
            v.currentTime = at;
          });
        }
      },
      [t, card.refs.map((r, i) => [i, r.start || 0]).filter(([i]) => card.refs[i].video)],
    );
    t += (f.delay * every) / 1000;
    const png = PNG.sync.read(await page.screenshot());
    const palette = quantize(png.data, 256, { format: "rgb565" });
    enc.writeFrame(applyPalette(png.data, palette, "rgb565"), png.width, png.height, {
      palette,
      delay: f.delay * every,
      repeat: 0,
    });
  }
  enc.finish();
  fs.writeFileSync(out, enc.bytes());
  console.log(
    `${card.id}: ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB, ${pick.length} frames)`,
  );
}
await browser.close();

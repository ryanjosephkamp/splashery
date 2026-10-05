#!/usr/bin/env node
// Lane QR lab r2: the phone test sheet for the study of splat QR codes
// (docs/research/qr-splat-study-2026-10.md). A page of codes from the
// study's edge cases, each with an id, what it is and what the study
// predicts, for the owner to scan with a real phone:
//   - for each chosen variable, the code just on the readable side of its
//     threshold and the one just past it (level M, the link), from the
//     study's own cells (zxing-cpp on the "phone" captures);
//   - the shapes, Micro QR and rMQR, and the three-codes-in-one-square code.
// Every code on the sheet is rendered as the study renders it (front on,
// trial 0).
//
//   node tools/qrs-sheet.mjs [--data=DIR] [--out=DIR] [--no-png]
//
// DIR defaults to docs/research/qr-splat-study-2026-10 (it needs the full
// run's cells.csv, shapes.csv, micro.csv and rgb.csv there). Writes
// phone-sheet.html (self-contained, images inline), phone-sheet.png (a
// screenshot of it in Chromium; needs SPLASHERY_CHROMIUM or Playwright's
// own browser) and phone-sheet.json (the ids and predictions).
import fs from "node:fs";
import path from "node:path";
import { variables } from "./qrs-study/variables.mjs";
import { screenShot, stepsFor, TEXTS } from "./qrs-study/core.mjs";
import { SHAPES } from "./qrs-study/shapes.mjs";
import { SETS } from "./qrs-study/rgb.mjs";
import { encodeRGB } from "../src/qr-lab/rgb.js";
import { toPNG, render, screenCamera } from "./qrs-study/raster.mjs";
import { codeSplats } from "../src/qr-lab/splats.js";
import bwipjs from "bwip-js";

const args = process.argv.slice(2);
const opt = (n, d) => args.find((a) => a.startsWith(`--${n}=`))?.split("=")[1] ?? (args.includes(`--${n}`) ? true : d); // prettier-ignore
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const data = path.resolve(opt("data", path.join(root, "docs/research/qr-splat-study-2026-10")));
const out = path.resolve(opt("out", data));

function csv(file) {
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, "utf8").trim().split("\n");
  const split = (l) => {
    const o = [];
    let cur = "";
    let q = false;
    for (const ch of l) {
      if (ch === '"') q = !q;
      else if (ch === "," && !q) {
        o.push(cur);
        cur = "";
      } else cur += ch;
    }
    o.push(cur);
    return o;
  };
  const head = split(lines.shift());
  return lines.map((l) => Object.fromEntries(split(l).map((v, i) => [head[i], v])));
}
const cells = csv(path.join(data, "cells.csv"));
const VARS = variables();
const pct = (x) => `${Math.round(Number(x) * 100)}%`;
const dataURL = (img) => `data:image/png;base64,${toPNG(img).toString("base64")}`;

// The variables on the sheet (each gives two codes).
const PICK = ["soft", "sparse", "per", "gap", "opacity", "contrast", "gradient", "dots", "yaw", "dmg-scratch-all", "dmg-sticker-center", "dmg-tear-corner", "dmg-smudge-center", "dmg-jitter-all", "dmg-fade-all", "dmg-color-all", "dmg-curve-all"]; // prettier-ignore

const cards = [];
let n = 0;
const nextId = (p) => `${p}${String(++n).padStart(2, "0")}`;
const rateOf = (vid, value, reader) => cells.find((c) => c.variable === vid && Number(c.value) === value && c.level === "M" && c.cond === "phone" && c.reader === reader); // prettier-ignore
const predictLine = (vid, value) =>
  ["zxingcpp", "jsqr", "zxing"]
    .map((r) => {
      const c = rateOf(vid, value, r);
      return c ? `${{ zxingcpp: "zxing-cpp", jsqr: "jsQR", zxing: "zxing-js" }[r]} ${pct(c.rate)}` : null; // prettier-ignore
    })
    .filter(Boolean)
    .join(", ");

for (const vid of PICK) {
  const v = VARS.find((x) => x.id === vid);
  if (!v) continue;
  const pts = v.values.map((value) => ({ value, c: rateOf(vid, value, "zxingcpp") })).filter((p) => p.c); // prettier-ignore
  if (!pts.length) continue;
  // Just on the readable side: the last value at 90% or more before the
  // first one below it. Just past: the first value at 50% or less after it.
  let i = pts.findIndex((p) => Number(p.c.rate) < 0.9);
  const picks = [];
  if (i < 0) picks.push({ p: pts[pts.length - 1], side: "the far end of the sweep; still reads" });
  else {
    if (i > 0) picks.push({ p: pts[i - 1], side: "just on the readable side" });
    const j = pts.findIndex((p, k) => k >= i && Number(p.c.rate) <= 0.5);
    picks.push({ p: pts[j >= 0 ? j : i], side: "just past the threshold" });
  }
  for (const { p, side } of picks) {
    const steps = stepsFor(TEXTS.url, "M");
    const { img } = screenShot(steps, { frontOn: v.frontOn, ...v.spec(p.value) }, 0);
    const rate = Number(p.c.rate);
    cards.push({
      id: nextId("S"),
      what: `${v.label}: ${v.axis} = ${v.x(p.value)} (${side})`,
      predict: rate >= 0.9 ? "should scan" : rate <= 0.5 ? "should not scan" : "may scan",
      detail: `phone-like captures, level M: ${predictLine(vid, p.value)}`,
      img: dataURL(img),
      text: TEXTS.url,
    });
  }
}

// Shapes.
const shapes = csv(path.join(data, "shapes.csv"));
for (const sh of SHAPES) {
  const row = shapes.find((r) => r.shape === sh.id && r.level === "M" && r.cond === "phone");
  const steps = stepsFor(TEXTS.url, "M");
  const { img } = screenShot(steps, sh.spec(), 0);
  const k = row ? Number(row.zxingcpp) / Number(row.n) : null;
  cards.push({
    id: nextId("S"),
    what: `Shape: ${sh.label}`,
    predict: k == null ? "not measured" : k >= 0.9 ? "should scan" : k <= 0.5 ? "should not scan" : "may scan", // prettier-ignore
    detail: row ? `phone-like captures, level M: zxing-cpp ${row.zxingcpp}/${row.n}, jsQR ${row.jsqr}/${row.n}, zxing-js ${row.zxing}/${row.n}` : "", // prettier-ignore
    img: dataURL(img),
    text: TEXTS.url,
  });
}

// Micro QR and rMQR, as splats (the study's "splats" rows).
const micro = csv(path.join(data, "micro.csv"));
for (const [cid, bcid, text, o] of [
  ["micro-alnum", "microqrcode", "HELLO 123", ""],
  ["rmqr-short", "rectangularmicroqrcode", "Splats make a code!", "version=R9x59 eclevel=M"],
]) {
  const r = bwipjs.raw(bcid, text, o)[0];
  const m = { w: r.pixx, h: r.pixy, dark: r.pixs };
  const N = Math.max(m.w, m.h);
  const mods = new Uint8Array(N * N);
  const oy = Math.floor((N - m.h) / 2);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) mods[(y + oy) * N + x] = m.dark[y * m.w + x]; // prettier-ignore
  const sy = N / 2 - (oy + m.h / 2);
  const sp = codeSplats(mods, N, { quiet: 2 })
    .map((s) => ({ ...s, p: [s.p[0], s.p[1] - sy, s.p[2]] }))
    .filter((s) => s.mod >= 0 || (Math.abs(s.p[0]) <= m.w / 2 + 2 && Math.abs(s.p[1]) <= m.h / 2 + 2)); // prettier-ignore
  const tall = Math.round((m.h + 4) * 1.2);
  const img = render(
    sp,
    screenCamera(tall, { ppm: 8, aspect: Math.round((m.w + 4) * 1.2) / tall }),
  );
  const rows = micro.filter((x) => x.case === cid && x.how === "splats" && x.writer === "bwip-js" && x.cond === "front"); // prettier-ignore
  const ok = rows.length ? `front on: zxing-cpp ${rows[0].zxingcpp}/${rows[0].n}, jsQR ${rows[0].jsqr}/${rows[0].n}, zxing-js ${rows[0].zxing}/${rows[0].n}` : ""; // prettier-ignore
  cards.push({
    id: nextId("S"),
    what: cid.startsWith("micro") ? `Micro QR (M${(m.w - 9) / 2}), as splats` : `rMQR (R${m.h}x${m.w}, a rectangular code), as splats`, // prettier-ignore
    predict: "most phone camera apps: unknown (only zxing-cpp of our three readers reads it)",
    detail: ok,
    img: dataURL(img),
    text,
  });
}

// Three codes in one square.
{
  const texts = SETS.url;
  const enc = encodeRGB(texts, "M");
  const fake = { size: enc.size, modules: new Uint8Array(enc.size * enc.size).fill(1) };
  const { img } = screenShot(fake, { opts: { lightTiles: true, key: (i) => enc.colors[i * 3] * 4 + enc.colors[i * 3 + 1] * 2 + enc.colors[i * 3 + 2] }, transform: (sp) => { for (const s of sp) if (s.mod >= 0) s.color = [enc.colors[s.mod * 3], enc.colors[s.mod * 3 + 1], enc.colors[s.mod * 3 + 2]]; return sp; } }, 0); // prettier-ignore
  cards.push({
    id: nextId("S"),
    what: "Three codes in one square (red, green and blue channels)",
    predict:
      "an ordinary scanner reads the green code (…#grn) or nothing; Splashery's splitting reader reads all three",
    detail: texts.join("  ·  "),
    img: dataURL(img),
    text: texts[1],
  });
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Splat QR phone sheet</title>
<style>
:root { --bg: #ffffff; --ink: #14161c; --ink2: #52514e; --line: #d9d8d3; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 1100px; margin: 0 auto; padding: 16px; }
h1 { font-size: 20px; margin: 0 0 4px; }
p.lead { color: var(--ink2); margin: 0 0 16px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
.card { border: 1px solid var(--line); border-radius: 8px; padding: 10px; break-inside: avoid; page-break-inside: avoid; }
.card img { display: block; width: 100%; max-width: 220px; height: auto; margin: 0 auto 8px; }
.id { font-weight: 700; font-size: 18px; }
.what { margin: 2px 0; }
.pred { font-weight: 600; }
.detail { color: var(--ink2); font-size: 12px; overflow-wrap: anywhere; }
@media print { main { max-width: none; } .grid { grid-template-columns: repeat(3, 1fr); } }
</style>
</head>
<body>
<main>
<h1>Splat QR codes: phone test sheet</h1>
<p class="lead">From the study of splat QR codes (October 2026). Scan each code with your phone's camera app, from about 30 cm, straight on, and write down whether it opened the right link or text. Each card says what the study predicts. Codes S01 onward that hold the link should open https://ryanjosephkamp.github.io/splashery/.</p>
<div class="grid">
${cards.map((c) => `<div class="card"><img src="${c.img}" alt="Code ${c.id}"><div class="id">${c.id}</div><div class="what">${esc(c.what)}</div><div class="pred">Predicted: ${esc(c.predict)}</div><div class="detail">${esc(c.detail)}</div></div>`).join("\n")}
</div>
</main>
</body>
</html>
`;
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "phone-sheet.html"), html);
fs.writeFileSync(path.join(out, "phone-sheet.json"), JSON.stringify(cards.map(({ img, ...c }) => c), null, 1) + "\n"); // prettier-ignore
console.log(`${cards.length} codes → ${path.relative(root, path.join(out, "phone-sheet.html"))}`);
for (const c of cards) console.log(`${c.id}  ${c.what}  →  ${c.predict}`);

if (!opt("no-png")) {
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch({
    executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  await page.goto("file://" + path.join(out, "phone-sheet.html"));
  await page.screenshot({ path: path.join(out, "phone-sheet.png"), fullPage: true });
  await browser.close();
}

#!/usr/bin/env node
// The catalog PDF (lane Toy pages): every public toy, one per page, with its
// picture, name, shelf, how-to line, a link and a QR code to its page on the
// site, and its credits. Printed by Chromium (Playwright, a pinned
// devDependency) from one HTML document; the QR codes come from Project
// Nayuki's generator (vendor/qrcodegen, MIT). No server needed.
//
//   node tools/tpg-catalog.mjs            # writes site/splashery-catalog.pdf
//   node tools/tpg-catalog.mjs --only 12  # the first 12 toys (a quick look)
//
// Run it again after toys change (it follows the toy list, like the toy pages).

import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import qrcodegen from "../vendor/qrcodegen/qrcodegen.js";
import { TOYS, CATEGORIES } from "../src/toys.js";
import { TOY_HELP } from "../src/toy-help.js";
import { toyCredits, toyPath, licenseNotices, recipeFor } from "./site-toy-pages.mjs";
import { SITE } from "./site-pages.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(root, "site/splashery-catalog.pdf");
const onlyArg = process.argv.indexOf("--only");
const ONLY = onlyArg > 0 ? Number(process.argv[onlyArg + 1]) : Infinity;

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const shelfName = (id) => ({ maths: "Math" })[id] || CATEGORIES.find((c) => c.id === id)?.label || id; // prettier-ignore

// A QR code as an SVG path (one square per dark module, with a 4-module quiet zone).
function qrSVG(text) {
  const qr = qrcodegen.QrCode.encodeText(text, qrcodegen.QrCode.Ecc.MEDIUM);
  const n = qr.size;
  let d = "";
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.getModule(x, y)) d += `M${x + 4} ${y + 4}h1v1h-1z`; // prettier-ignore
  return `<svg class="qr" viewBox="0 0 ${n + 8} ${n + 8}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#111"/></svg>`; // prettier-ignore
}

// The how-to line: the toy's own, or a plain one (the site's pages build the
// rest from recipes; a catalog line needs only the gist).
const howTo = (t) => TOY_HELP[t.id]?.howTo || "Tap it to play; drag to turn it.";

const thumb = (t) => {
  const f = path.join(root, `assets/toys/${t.id}/thumb.webp`);
  return fs.existsSync(f) ? `data:image/webp;base64,${fs.readFileSync(f).toString("base64")}` : "";
};

const toys = CATEGORIES.flatMap((c) => TOYS.filter((t) => t.category === c.id && !t.labs)).slice(0, ONLY); // prettier-ignore

const pages = [];
for (const [i, t] of toys.entries()) {
  const url = `${SITE.origin}${SITE.base}${toyPath(t)}`;
  const credits = await toyCredits(t, await recipeFor(t));
  const creditLines = credits.length
    ? credits
        .map((c) => {
          const notes = licenseNotices(c.license).join(" ");
          return `<li><b>${esc(c.label)}:</b> <a href="${esc(c.source)}">${esc(c.title || t.label)}</a>${c.author ? ` by ${esc(c.author)}` : ""}, ${esc(c.license)}.${notes ? ` ${esc(notes)}` : ""}</li>`; // prettier-ignore
        })
        .join("")
    : "<li>Built from a recipe in the browser; no outside files.</li>";
  const img = thumb(t);
  pages.push(`<section class="toy">
<p class="shelf">${esc(shelfName(t.category))}<span>${i + 1} of ${toys.length}</span></p>
<div class="pic">${img ? `<img src="${img}" alt="">` : ""}</div>
<h2>${esc(t.label)}</h2>
<p class="how">${esc(howTo(t))}</p>
<div class="go">${qrSVG(url)}<p>Play with it on its page:<br><a href="${esc(url)}">${esc(url.replace(/^https:\/\//, ""))}</a></p></div>
<div class="credits"><h3>Credits</h3><ul>${creditLines}</ul></div>
</section>`);
}

const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); // prettier-ignore
const cover = `<section class="cover">
<svg viewBox="0 0 64 64" width="120" height="120"><g opacity=".92"><ellipse cx="24" cy="26" rx="14" ry="11" fill="#ff5fa2"/><ellipse cx="40" cy="24" rx="12" ry="13" fill="#7bdff2"/><ellipse cx="33" cy="41" rx="15" ry="11" fill="#ffd166"/></g></svg>
<h1>Splashery</h1>
<p class="sub">The catalog: ${toys.length} toys made of 3D Gaussian splats</p>
<p>Every toy runs in your browser, free, with nothing to install. Scan a toy's code, or follow its link, to play with it.</p>
<div class="go">${qrSVG(`${SITE.origin}${SITE.base}`)}<p><a href="${SITE.origin}${SITE.base}">${(SITE.origin + SITE.base).replace(/^https:\/\//, "")}</a></p></div>
<p class="fine">${esc(date)}. Splashery's code is under the MIT license; each toy's assets keep their own licenses, credited on its page.</p>
</section>`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Splashery: the catalog</title><style>
@page { size: letter; margin: 0.6in; }
* { box-sizing: border-box; }
body { margin: 0; font: 11pt/1.45 "Helvetica Neue", Helvetica, Arial, sans-serif; color: #111; }
a { color: #0b4f9c; text-decoration: none; }
section { break-after: page; height: 9.75in; display: flex; flex-direction: column; }
section:last-child { break-after: auto; }
.cover { justify-content: center; align-items: center; text-align: center; gap: 6px; }
.cover h1 { font-size: 48pt; margin: 8px 0 0; letter-spacing: -0.03em; }
.cover .sub { font-size: 16pt; color: #474747; margin: 0 0 18px; }
.cover p { max-width: 5in; }
.cover .go { justify-content: center; }
.fine { margin-top: auto; font-size: 8.5pt; color: #474747; }
.shelf { display: flex; justify-content: space-between; margin: 0; font-size: 9pt; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #474747; border-bottom: 1px solid #e4e4e4; padding-bottom: 6px; }
.shelf span { font-weight: 400; letter-spacing: 0; text-transform: none; }
.pic { display: flex; justify-content: center; align-items: center; height: 4.2in; margin: 0.15in 0; background: #f6f6f4; border-radius: 16px; }
.pic img { width: 3.8in; height: 3.8in; object-fit: contain; }
h2 { font-size: 30pt; margin: 0 0 4px; letter-spacing: -0.02em; line-height: 1.1; }
.how { font-size: 14pt; color: #333; margin: 0 0 14px; }
.go { display: flex; align-items: center; gap: 16px; }
.go .qr { width: 1.15in; height: 1.15in; flex: none; }
.go p { margin: 0; font-size: 10pt; }
.credits { margin-top: auto; font-size: 8.5pt; color: #333; }
.credits h3 { font-size: 9pt; margin: 0 0 2px; text-transform: uppercase; letter-spacing: 0.08em; color: #474747; }
.credits ul { margin: 0; padding-left: 1.1em; }
</style></head><body>${cover}${pages.join("\n")}</body></html>`;

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
});
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "load" });
// The stills as JPEG on the panel's color: Chromium keeps a JPEG as it is,
// where it would store a WebP's pixels losslessly (several times larger).
await page.evaluate(async () => {
  for (const img of document.querySelectorAll(".pic img")) {
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext("2d");
    g.fillStyle = "#f6f6f4";
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0);
    img.src = c.toDataURL("image/jpeg", 0.86);
    await img.decode();
  }
});
await page.pdf({ path: OUT, format: "Letter", printBackground: true, preferCSSPageSize: true });
await browser.close();
const mb = fs.statSync(OUT).size / 1e6;
console.log(`${path.relative(root, OUT)}: ${toys.length + 1} pages, ${mb.toFixed(1)} MB`);

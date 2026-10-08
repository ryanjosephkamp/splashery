#!/usr/bin/env node
// The catalog PDF (lane Toy pages; round 2 in lane Toy pages r2): every public toy on its own
// page, with its picture, name, how-to line, About text, how to play, its views and settings
// (read from the toy's options and controls), a QR code and link to its page on the site, its
// Learn more link and its credits. A cover, a table of contents whose entries link to their
// pages, and PDF bookmarks (shelf, then toy). Printed by Chromium (Playwright, a pinned
// devDependency) from one HTML document; the QR codes come from Project Nayuki's generator
// (vendor/qrcodegen, MIT). No server needed.
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
import {
  toyCredits,
  toyPath,
  licenseNotices,
  recipeFor,
  readEvidence,
  TOY_LINKS,
  PLAN,
  firstSentence,
  soundLine,
} from "./site-toy-pages.mjs";
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

// The how-to line: the toy's own, or a plain one.
const howTo = (t) => TOY_HELP[t.id]?.howTo || "Tap it to play; drag to turn it.";

const thumb = (t) => {
  const f = path.join(root, `assets/toys/${t.id}/thumb.webp`);
  return fs.existsSync(f) ? `data:image/webp;base64,${fs.readFileSync(f).toString("base64")}` : "";
};

// ---- Views and settings: read from a recipe's options and controls ---------------------

const VIEWISH = /\b(view|views|camera|angle|section|layer|layers|mode|display|show|style|scale|zoom)\b/i; // prettier-ignore
const choiceList = (o) => (o.choices || []).map((c) => c.label || c.id || c).filter(Boolean);

// One setting as { label, detail }, or null for one that isn't a visible setting.
function settingOf(def, kind) {
  if (!def || def.hidden || !def.label) return null;
  const type = def.type || "slider";
  let detail = "";
  if (type === "select") {
    const names = choiceList(def);
    detail = names.length > 8 ? `${names.slice(0, 8).join(", ")} and ${names.length - 8} more` : names.join(", "); // prettier-ignore
  } else if (type === "slider") detail = "slider";
  else if (type === "toggle") detail = "on or off";
  else if (type === "color") detail = "pick a color";
  else if (type === "pulse") detail = "button";
  else if (type === "text") detail = "type your own";
  else detail = type;
  return { label: def.label, detail, kind, viewish: VIEWISH.test(def.label) && type === "select" };
}

// { views: [...], settings: [...] } for a toy.
export function viewsAndSettings(recipe) {
  const list = [];
  const options = Array.isArray(recipe?.options) ? recipe.options : [];
  for (const o of options) list.push(settingOf(o, "option"));
  for (const c of recipe?.controls || []) {
    // The tap's own control (the toy's action) is the tap, not a setting.
    if (c.key && recipe.action?.key === c.key) continue;
    list.push(settingOf(c, "control"));
  }
  const all = list.filter(Boolean);
  return { views: all.filter((s) => s.viewish), settings: all.filter((s) => !s.viewish) };
}

const settingItems = (arr) =>
  arr.map((s) => `<li><b>${esc(s.label)}</b>${s.detail ? `: ${esc(s.detail)}` : ""}</li>`).join("");

// ---- The toys -------------------------------------------------------------------------

const toys = CATEGORIES.flatMap((c) => TOYS.filter((t) => t.category === c.id && !t.labs)).slice(0, ONLY); // prettier-ignore
const siteURL = `${SITE.origin}${SITE.base}`;

// Page numbers: the cover is page 1, the contents follow, then one page per toy.
const TOC_COLUMNS = 3;
const TOC_LINES_PER_COLUMN = 50;

// Contents lines: a shelf heading, then its toys. Whole columns, a heading never last in one.
const tocLines = [];
{
  let shelf = null;
  for (const [i, t] of toys.entries()) {
    if (t.category !== shelf) {
      shelf = t.category;
      tocLines.push({ shelf: shelfName(shelf), id: shelf });
    }
    tocLines.push({ toy: t, i });
  }
}
const tocColumns = [];
{
  let col = [];
  for (const line of tocLines) {
    // A heading needs room for itself and at least two toys under it.
    const room = TOC_LINES_PER_COLUMN - col.length;
    if (line.shelf && room < 3) {
      tocColumns.push(col);
      col = [];
    } else if (col.length >= TOC_LINES_PER_COLUMN) {
      tocColumns.push(col);
      col = [];
    }
    col.push(line);
  }
  if (col.length) tocColumns.push(col);
}
const TOC_PAGES = Math.ceil(tocColumns.length / TOC_COLUMNS);
const pageOf = (i) => 2 + TOC_PAGES + i;

const pages = [];
let lastShelf = null;
for (const [i, t] of toys.entries()) {
  const url = `${siteURL}${toyPath(t)}`;
  const recipe = await recipeFor(t);
  const credits = await toyCredits(t, recipe);
  const creditLines = credits.length
    ? credits
        .map((c) => {
          const notes = licenseNotices(c.license).join(" ");
          return `<li><b>${esc(c.label)}:</b> <a href="${esc(c.source)}">${esc(c.title || t.label)}</a>${c.author ? ` by ${esc(c.author)}` : ""}, ${esc(c.license)}.${notes ? ` ${esc(notes)}` : ""}</li>`; // prettier-ignore
        })
        .join("")
    : "<li>Built from a recipe in the browser; no outside files.</li>";
  const img = thumb(t);

  const about = String(TOY_HELP[t.id]?.about || "")
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join("");

  // How to play: the tap and its sound, a drag where the toy has its own, and the views.
  const plan = PLAN[t.id] || {};
  const play = [];
  play.push(`<li><b>Tap:</b> ${esc(plan.effect ? firstSentence(plan.effect) : recipe?.action?.label ? recipe.action.label : "It hops.")}</li>`); // prettier-ignore
  const sound = soundLine(plan.sound);
  if (sound) play.push(`<li><b>Sound:</b> ${esc(sound)}</li>`);
  if (recipe?.drag)
    play.push("<li><b>Drag:</b> plays with the toy itself; a drag beside it turns the view.</li>"); // prettier-ignore
  else if (recipe?.grab)
    play.push("<li><b>Drag:</b> stretches it; let go and it springs back.</li>"); // prettier-ignore
  else play.push("<li><b>Drag:</b> turns it.</li>");
  play.push("<li><b>Pinch or scroll</b> to zoom; <b>double-tap</b> to reset the view.</li>");

  const { views, settings } = viewsAndSettings(recipe);
  const viewHTML = views.length ? `<p class="h4">Views</p><ul>${settingItems(views)}</ul>` : "";
  const settingHTML = settings.length
    ? `<p class="h4">Settings</p><ul>${settingItems(settings)}</ul><p class="fine">In the Toy tab of the app.</p>`
    : views.length
      ? ""
      : `<p class="h4">Settings</p><p class="none">None: tap it, turn it, share it.</p>`;

  const link = TOY_LINKS[t.id];
  const learn = link && !readEvidence(t.id)
    ? `<p class="learn">Learn more: <a href="${esc(link.url)}">${esc(link.label)}</a></p>`
    : ""; // prettier-ignore

  // The first toy of a shelf carries the shelf's heading, so the bookmarks nest.
  const first = t.category !== lastShelf;
  lastShelf = t.category;
  const shelfEl = first
    ? `<h2 class="shelf" id="shelf-${esc(t.category)}">${esc(shelfName(t.category))}</h2>`
    : `<p class="shelf">${esc(shelfName(t.category))}</p>`;
  pages.push(`<section class="toy" id="t-${esc(t.id)}">
<div class="top">${shelfEl}<span class="num">${i + 1} of ${toys.length} · page ${pageOf(i)}</span></div>
<div class="head">
<div class="pic">${img ? `<img src="${img}" alt="">` : ""}</div>
<div class="title"><h3>${esc(t.label)}</h3><p class="how">${esc(howTo(t))}</p>
<div class="go">${qrSVG(url)}<div class="gotext"><p>Scan to play with it.</p>${learn}</div></div></div>
</div>
<div class="about">${about}</div>
<div class="cols"><div><p class="h4">How to play</p><ul>${play.join("")}</ul></div><div>${viewHTML}${settingHTML}</div></div>
<p class="url">Play with it on its page: <a href="${esc(url)}">${esc(url.replace(/^https:\/\//, ""))}</a></p>
<div class="credits"><p class="h4">Credits</p><ul>${creditLines}</ul></div>
</section>`);
}

const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); // prettier-ignore
const cover = `<section class="cover">
<svg viewBox="0 0 64 64" width="120" height="120"><g opacity=".92"><ellipse cx="24" cy="26" rx="14" ry="11" fill="#ff5fa2"/><ellipse cx="40" cy="24" rx="12" ry="13" fill="#7bdff2"/><ellipse cx="33" cy="41" rx="15" ry="11" fill="#ffd166"/></g></svg>
<h1>Splashery</h1>
<p class="sub">The catalog: ${toys.length} toys made of 3D Gaussian splats</p>
<p>Every toy runs in your browser, free, with nothing to install. Each has a page here with what it is, how to play with it, what you can change, and where it comes from. Scan a toy's code, or follow its link, to play with it. The contents on the next page link to every toy, and your PDF reader's bookmarks list them by shelf.</p>
<div class="go">${qrSVG(siteURL)}<p><a href="${siteURL}">${siteURL.replace(/^https:\/\//, "")}</a></p></div>
<p class="fine">${esc(date)}. Splashery's code is under the MIT license; each toy's assets keep their own licenses, credited on its page.</p>
</section>`;

const tocPages = [];
for (let p = 0; p < TOC_PAGES; p++) {
  const cols = tocColumns
    .slice(p * TOC_COLUMNS, (p + 1) * TOC_COLUMNS)
    .map(
      (col) =>
        `<div class="tcol">${col
          .map((l) =>
            l.shelf
              ? `<p class="tshelf"><a href="#shelf-${esc(l.id)}">${esc(l.shelf)}</a></p>`
              : `<p class="tline"><a href="#t-${esc(l.toy.id)}"><span>${esc(l.toy.label)}</span><i></i><span class="pg">${pageOf(l.i)}</span></a></p>`,
          )
          .join("")}</div>`,
    )
    .join("");
  tocPages.push(`<section class="tocpage">${p === 0 ? "<h2>Contents</h2>" : '<p class="more">Contents, continued</p>'}<div class="tcols">${cols}</div></section>`); // prettier-ignore
}

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Splashery: the catalog</title><style>
@page { size: letter; margin: 0.5in; }
* { box-sizing: border-box; }
body { margin: 0; font: 10pt/1.4 "Helvetica Neue", Helvetica, Arial, sans-serif; color: #111; }
a { color: #0b4f9c; text-decoration: none; }
section { break-after: page; height: 10in; overflow: hidden; display: flex; flex-direction: column; }
section:last-child { break-after: auto; }
.cover { justify-content: center; align-items: center; text-align: center; gap: 6px; }
.cover h1 { font-size: 48pt; margin: 8px 0 0; letter-spacing: -0.03em; }
.cover .sub { font-size: 16pt; color: #474747; margin: 0 0 18px; }
.cover p { max-width: 5.2in; font-size: 11pt; }
.cover .go { justify-content: center; }
.fine { font-size: 8.5pt; color: #474747; }
.cover .fine { margin-top: auto; }
.tocpage h2 { font-size: 26pt; margin: 0 0 10px; letter-spacing: -0.02em; }
.tocpage .more { margin: 0 0 10px; font-size: 11pt; font-weight: 700; color: #474747; }
.tcols { display: flex; gap: 0.25in; }
.tcol { flex: 1; min-width: 0; font-size: 8.6pt; line-height: 1.45; }
.tshelf { margin: 0; padding-top: 3px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; font-size: 7.8pt; color: #474747; }
.tline { margin: 0; }
.tline a { display: flex; align-items: baseline; gap: 3px; color: #111; }
.tline i { flex: 1; border-bottom: 1px dotted #aaa; transform: translateY(-2px); min-width: 6px; }
.tline .pg { color: #474747; }
/* A toy page: every size is in em, so one --s scales the whole page to fit. */
.toy > * { flex: none; }
.toy { --s: 10; font-size: calc(var(--s) * 1pt); }
.top { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #e4e4e4; padding-bottom: 0.4em; }
.shelf { margin: 0; font-size: 0.95em; font-weight: 700; letter-spacing: 0.04em; color: #474747; }
.num { font-size: 0.85em; color: #474747; }
.head { display: flex; gap: 1.4em; margin: 0.9em 0 0.7em; align-items: stretch; }
.pic { flex: none; width: 24em; height: 24em; display: flex; justify-content: center; align-items: center; background: #f6f6f4; border-radius: 1.4em; }
.pic img { width: 22em; height: 22em; object-fit: contain; }
.title { display: flex; flex-direction: column; min-width: 0; }
h3 { font-size: 2.6em; margin: 0 0 0.15em; letter-spacing: -0.02em; line-height: 1.1; }
.how { font-size: 1.35em; color: #333; margin: 0 0 0.7em; line-height: 1.3; }
.go { display: flex; align-items: center; gap: 0.9em; margin-top: auto; }
.go .qr { width: 7.4em; height: 7.4em; flex: none; }
.go p { margin: 0; font-size: 0.95em; }
.url { margin: 0.4em 0 0.6em; font-size: 0.95em; }
.gotext { min-width: 0; overflow-wrap: anywhere; }
.learn { margin-top: 0.5em !important; font-weight: 700; }
.about p { margin: 0 0 0.55em; font-size: 1.02em; line-height: 1.42; }
.cols { display: flex; gap: 1.6em; margin-top: 0.3em; }
.cols > div { flex: 1; min-width: 0; }
.h4 { margin: 0 0 0.25em; font-size: 0.85em; text-transform: uppercase; letter-spacing: 0.08em; color: #474747; }
.cols ul { margin: 0 0 0.5em; padding-left: 1.1em; }
.cols li { margin-bottom: 0.15em; }
.none { margin: 0; color: #333; }
.credits { margin-top: auto; font-size: 0.85em; color: #333; border-top: 1px solid #e4e4e4; padding-top: 0.5em; }
.credits .h4 { font-size: 0.95em; }
.credits ul { margin: 0; padding-left: 1.1em; }
</style></head><body>${cover}${tocPages.join("\n")}${pages.join("\n")}</body></html>`;

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
});
// Laid out at the printed width (7.5 in of text, 96 px to the inch) so the fit below measures what prints.
const page = await browser.newPage({ viewport: { width: 720, height: 960 } });
await page.emulateMedia({ media: "print" });
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
// Every toy on one page: a page that runs over shrinks until it fits (down to 6.5 pt), and
// the toys that needed it are listed.
const shrunk = await page.evaluate(() => {
  const out = [];
  for (const s of document.querySelectorAll("section.toy")) {
    let size = 10;
    const set = (v) => s.style.setProperty("--s", String((size = Math.round(v * 100) / 100)));
    const over = () => s.scrollHeight > s.clientHeight + 1;
    // Fill the page when there is room (up to 12.5 pt), shrink when there is not.
    while (!over() && size < 12.5) set(size + 0.25);
    while (over() && size > 6.5) set(size - 0.25);
    if (size < 10) out.push([s.id, size, over()]);
  }
  return out;
});
const cut = shrunk.filter((x) => x[2]);
if (shrunk.length)
  console.log(`${shrunk.length} pages shrank to fit (smallest ${Math.min(...shrunk.map((x) => x[1]))} pt).`); // prettier-ignore
if (cut.length) console.log(`STILL TOO LONG at 6.5 pt: ${cut.map((x) => x[0]).join(", ")}`);
await page.pdf({
  path: OUT,
  format: "Letter",
  printBackground: true,
  preferCSSPageSize: true,
  outline: true,
  tagged: true,
});
await browser.close();
const mb = fs.statSync(OUT).size / 1e6;
console.log(`${path.relative(root, OUT)}: ${toys.length + 1 + TOC_PAGES} pages (${TOC_PAGES} of contents), ${mb.toFixed(1)} MB`); // prettier-ignore
if (mb > 20) console.log("WARNING: over 20 MB");
process.exitCode = cut.length ? 1 : 0;

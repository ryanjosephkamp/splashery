#!/usr/bin/env node
// Prints the Tinkerer's Manual (manual/all.html, the whole manual on one page, built from the
// chapter pages by manual/build-pages.mjs) to a PDF with Chromium:
// letter pages, page numbers in the footer, pictures kept whole (the
// manual's print styles). Lane Manual.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/manual-pdf.mjs [out.pdf]
//
// Writes manual/tinkerers-manual.pdf by default. With --pages=out-%d.png it
// also saves the first two pages as pictures (for review); --which=1,20,24
// picks other pages (the file name's %d is the page number) and --scale=0.64
// sets their size (1.5 by default).
//
// Reproducible: the same input and the same Chromium give the same bytes. Chromium's major version
// is pinned below (PINNED_MAJOR), because a different one changes fonts, line breaks, and page
// breaks (the October 11, 2026 audit found that a rebuild with Chromium 151 moved a heading by a
// page and lost the arrow in "p ↦ Ap + b"). Pass --allow-other-browser to print anyway. The only
// bytes that vary from run to run are the creation and modification dates Chromium writes; they
// are set to the manual's own "Updated" date, and the numbers it gives the structure elements are
// renumbered in order. The links and the bookmarks are made robust after printing (Manual r9, the
// owner's report that the contents were not clickable): every link to a place in the manual gets an
// explicit destination (a page and a position) in place of Chromium's old-style named destination,
// the named destinations are also written as a name tree, and the bookmarks are rebuilt as a flat
// list (cover, then one entry per chapter, closed, with its sections under it) with clean titles
// (Chromium prints some headings' text twice). Links to files in the manual (the example recipe, the
// PDF) are made absolute, so a PDF read away from a local server still reaches the public copies.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import {
  PDFDocument,
  PDFName,
  PDFArray,
  PDFDict,
  PDFRef,
  PDFNumber,
  PDFString,
  PDFHexString,
} from "../vendor/pdf-lib/pdf-lib.esm.min.js";

// Links and bookmarks that work in every viewer. Chromium writes a link to a place as `/Dest /name`
// (a name object looked up in the catalog's /Dests dictionary, the PDF 1.1 way), which some viewers
// (phones, Brave's, Chrome's on some builds) do not follow. Each such link gets the destination
// itself, `[page /XYZ x y 0]`; /Dests stays, and a name tree (/Names /Dests, with the same
// destinations) is added for viewers that look for that. Bookmarks: Chromium builds one root entry
// holding everything and prints some headings' text twice ("GlossaryGlossary"). The root becomes
// the first entry ("Cover and contents"), the chapters follow it at the top level (closed), and
// each title is made from the heading as written. The same input gives the same bytes.
async function fixLinksAndBookmarks(bytes, headings) {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const ctx = doc.context;
  const catalog = doc.catalog;
  const N = (n) => PDFName.of(n);
  const dests = catalog.lookup(N("Dests"), PDFDict);
  const destOf = new Map();
  for (const [key, value] of dests.entries()) {
    const arr = value instanceof PDFRef ? ctx.lookup(value) : value;
    if (arr instanceof PDFArray) destOf.set(key.decodeText(), arr);
    else if (arr instanceof PDFDict && arr.get(N("D")) instanceof PDFArray) destOf.set(key.decodeText(), arr.get(N("D"))); // prettier-ignore
  }
  let links = 0;
  let broken = 0;
  for (const page of doc.getPages()) {
    const annots = page.node.lookupMaybe(N("Annots"), PDFArray);
    if (!annots) continue;
    for (let i = 0; i < annots.size(); i++) {
      const a = annots.lookup(i, PDFDict);
      const d = a.get(N("Dest"));
      if (!(d instanceof PDFName || d instanceof PDFString || d instanceof PDFHexString)) continue;
      const name = d instanceof PDFName ? d.decodeText() : d.decodeText();
      const target = destOf.get(name);
      if (!target) {
        broken++;
        continue;
      }
      a.set(N("Dest"), ctx.obj([...target.asArray()]));
      links++;
    }
  }
  if (broken) throw new Error(`${broken} links in the PDF point at a place that is not there.`);
  // The name tree, sorted as the format asks.
  const names = [...destOf.keys()].sort();
  const flat = [];
  for (const k of names) flat.push(PDFString.of(k), ctx.obj([...destOf.get(k).asArray()]));
  const tree = ctx.obj({ Names: flat });
  const existing = catalog.lookupMaybe(N("Names"), PDFDict);
  if (existing) existing.set(N("Dests"), ctx.register(tree));
  else catalog.set(N("Names"), ctx.obj({ Dests: ctx.register(tree) }));
  catalog.set(N("PageMode"), N("UseOutlines"));
  // The bookmarks.
  const outlinesRef = catalog.get(N("Outlines"));
  const outlines = catalog.lookup(N("Outlines"), PDFDict);
  const root = outlines.lookup(N("First"), PDFDict);
  const rootRef = outlines.get(N("First"));
  let marks = 0;
  if (root.get(N("First"))) {
    // The headings' keys: all spaces out, lower case.
    const key = (t) => t.replace(/\s+/g, "").toLowerCase();
    const clean = new Map(headings.map((h) => [key(h), h]));
    const undouble = (t) => {
      for (let n = Math.floor(t.length / 2); n >= 3; n--)
        if (t.slice(0, n) === t.slice(n, 2 * n)) return t.slice(0, n) + t.slice(2 * n);
      return t;
    };
    const retitle = (item) => {
      const raw = item.lookup(N("Title")).decodeText();
      const text = clean.get(key(raw)) ?? clean.get(key(undouble(raw))) ?? undouble(raw).replace(/^CHAPTER (\d+)/, "Chapter $1: "); // prettier-ignore
      item.set(N("Title"), PDFHexString.fromText(text));
    };
    const first = root.get(N("First"));
    const last = root.get(N("Last"));
    let ref = first;
    let top = 0;
    while (ref) {
      const item = ctx.lookup(ref, PDFDict);
      item.set(N("Parent"), outlinesRef);
      retitle(item);
      // Sections stay under their chapter, closed, with clean titles too.
      const sub = (r) => {
        for (let c = r; c; ) {
          const it = ctx.lookup(c, PDFDict);
          retitle(it);
          marks++;
          if (it.get(N("First"))) sub(it.get(N("First")));
          c = it.get(N("Next"));
        }
      };
      if (item.get(N("First"))) {
        sub(item.get(N("First")));
        const n = item.lookup(N("Count"), PDFNumber).asNumber();
        item.set(N("Count"), PDFNumber.of(-Math.abs(n)));
      }
      marks++;
      top++;
      ref = item.get(N("Next"));
    }
    // The old root is the first entry, with nothing under it; the chapters come after it.
    root.set(N("Title"), PDFHexString.fromText("Cover and contents"));
    root.delete(N("First"));
    root.delete(N("Last"));
    root.delete(N("Count"));
    root.set(N("Parent"), outlinesRef);
    root.set(N("Next"), first);
    ctx.lookup(first, PDFDict).set(N("Prev"), rootRef);
    root.delete(N("Prev"));
    outlines.set(N("Last"), last);
    outlines.set(N("Count"), PDFNumber.of(top + 1));
  }
  console.log(`${links} links to places in the manual now carry their own destination; ${marks} bookmarks retitled`); // prettier-ignore
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--")) || "manual/tinkerers-manual.pdf";
const pagesArg = args.find((a) => a.startsWith("--pages="))?.slice(8);
const scale = Number(args.find((a) => a.startsWith("--scale="))?.slice(8)) || 1.5;
const which = (args.find((a) => a.startsWith("--which="))?.slice(8) || "1,2").split(",").map(Number); // prettier-ignore

const PINNED_MAJOR = 141;
// The font families the PDF embeds (checked after printing; see below).
const PINNED_FONTS = ["DejaVuSans", "DejaVuSansMono", "Inter", "LiberationSans", "LiberationSerif", "NotoColorEmoji"]; // prettier-ignore
const PUBLIC = "https://ryanjosephkamp.github.io/splashery/";

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
});
const major = Number(browser.version().split(".")[0]);
console.log(`Chromium ${browser.version()}`);
if (major !== PINNED_MAJOR && !args.includes("--allow-other-browser")) {
  console.error(`This PDF is printed with Chromium ${PINNED_MAJOR}; this is ${major}. Use a ${PINNED_MAJOR} build (SPLASHERY_CHROMIUM), or pass --allow-other-browser.`); // prettier-ignore
  await browser.close();
  process.exit(1);
}
const page = await browser.newPage();
const problems = [];
page.on("pageerror", (e) => problems.push(e.message));
page.on("requestfailed", (r) => problems.push(`${r.url()} failed`));
await page.goto(`${base}manual/all.html`, { waitUntil: "networkidle" });
await page.emulateMedia({ media: "print", colorScheme: "light" });
// Every picture loaded before printing.
await page.evaluate(
  () =>
  Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r))))), // prettier-ignore
);
// Chromium prints a PNG or WebP picture as a lossless Flate image, which made the PDF 12 MB (Manual
// r7c). Each one is swapped for a JPEG at quality 0.92 (the pictures are renders and photos; the web
// page keeps its own files). A picture with transparency is flattened onto the flat color behind it
// first, so its edges look the same; one with no flat color behind it stays as it is. The same
// Chromium encodes the same JPEG, so the build stays reproducible.
const jpegged = await page.evaluate(async () => {
  const flat = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== "none") return null;
      const m = cs.backgroundColor.match(/^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/);
      if (m && (m[4] === undefined || Number(m[4]) === 1)) return cs.backgroundColor;
      if (m && Number(m[4]) > 0) return null;
    }
    return "#fff";
  };
  let n = 0;
  for (const img of document.images) {
    if (!/\.(png|webp)(\?|$)/i.test(img.currentSrc || img.src)) continue;
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const a = g.getImageData(0, 0, c.width, c.height).data;
    let opaque = true;
    for (let i = 3; i < a.length; i += 4) if (a[i] !== 255) { opaque = false; break; } // prettier-ignore
    if (!opaque) {
      const bg = flat(img);
      if (!bg) continue;
      g.globalCompositeOperation = "destination-over";
      g.fillStyle = bg;
      g.fillRect(0, 0, c.width, c.height);
    }
    img.removeAttribute("srcset");
    await new Promise((r) => {
      img.onload = img.onerror = r;
      img.src = c.toDataURL("image/jpeg", 0.92);
    });
    n++;
  }
  return n;
});
console.log(`${jpegged} PNG/WebP pictures printed as JPEG`);
// A link to a file in the manual points at the public copy, not at the local server that printed it.
// (A link to a place in the page stays a link inside the PDF.)
await page.evaluate(
  ({ base, pub }) => {
    for (const a of document.querySelectorAll("a[href]")) {
      const h = a.getAttribute("href");
      if (h.startsWith("#") || /^(https?:|mailto:)/.test(h)) continue;
      a.href = new URL(a.href.replace(base, pub)).href;
    }
  },
  { base, pub: PUBLIC },
);
// The PDF prints every fold open (the web version starts them closed).
await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
// The headings as written, for the bookmarks' titles (see fixLinksAndBookmarks below).
const headings = await page.evaluate(() =>
  [...document.querySelectorAll("h1, h2, h3, h4, h5")].map((h) => {
    const lv = h.querySelector(".level");
    const text = (el) => el.textContent.replace(/\s+/g, " ").trim();
    return lv ? `${text(lv)}: ${text(h).slice(text(lv).length).trim()}` : text(h);
  }),
);
const footer = `<div style="width:100%;font:9px sans-serif;color:#666;padding:0 0.75in;display:flex;justify-content:space-between"><span>The Tinkerer's Manual</span><span><span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`; // prettier-ignore
const updated = await page.evaluate(() => /Updated ([A-Z][a-z]+) (\d+), (\d{4})/.exec(document.body.textContent)); // prettier-ignore
let pdf = await page.pdf({
  format: "Letter",
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate: footer,
  outline: true,
  tagged: true,
});
pdf = await fixLinksAndBookmarks(pdf, headings);
// The fonts the PDF embeds are whatever the machine has for the manual's font stacks (ui-sans-serif,
// the browser's serif, monospace, and an emoji font), so the same Chromium on a machine with other
// fonts prints different lines and glyphs. The family names the shipped PDF uses are listed here; a
// build that embeds a different set stops, so a rebuild on another machine says so instead of
// quietly changing the pages. (Install these families, or pass --allow-other-fonts.)
{
  const families = new Set(
    [...pdf.toString("latin1").matchAll(/\/FontName\s*\/[A-Z]{6}\+([A-Za-z0-9]+)/g)].map((m) =>
      m[1].replace(/(Regular|Bold|SemiBold|Italic|Oblique|Book)+$/, ""),
    ),
  );
  const got = [...families].sort();
  console.log(`Fonts in the PDF: ${got.join(", ")}`);
  if (got.join() !== PINNED_FONTS.join() && !args.includes("--allow-other-fonts")) {
    console.error(`The PDF embeds ${got.join(", ")}; the shipped one embeds ${PINNED_FONTS.join(", ")}. Print on a machine with those fonts, or pass --allow-other-fonts.`); // prettier-ignore
    await browser.close();
    process.exit(1);
  }
}
// Fix the two dates Chromium writes (same length, so every offset in the file stays right).
if (updated) {
  const month = ["January","February","March","April","May","June","July","August","September","October","November","December"].indexOf(updated[1]) + 1; // prettier-ignore
  const stamp = `D:${updated[3]}${String(month).padStart(2, "0")}${updated[2].padStart(2, "0")}000000+00'00'`;
  let text = pdf.toString("latin1");
  text = text.replace(/\/(CreationDate|ModDate) \(D:[^)]*\)/g, (_, k) => `/${k} (${stamp})`);
  pdf = Buffer.from(text, "latin1");
}
// Chromium also numbers each structure element "node00000356" from a counter that is not the same
// on every run. Renumber them by rank (same length, same order, so the name tree stays sorted and
// every reference still matches), so the same input prints the same bytes.
{
  const text = pdf.toString("latin1");
  const ids = [...new Set(text.match(/node\d{8}/g) || [])].sort();
  const rank = new Map(ids.map((id, i) => [id, `node${String(i + 1).padStart(8, "0")}`]));
  pdf = Buffer.from(
    text.replace(/node\d{8}/g, (id) => rank.get(id)),
    "latin1",
  );
}
fs.writeFileSync(out, pdf);
console.log(`${out}: ${(pdf.length / 1024).toFixed(0)} KB`);

// The first two pages as pictures: render the PDF with the site's own
// PDF.js, in the same browser.
if (pagesArg) {
  const view = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  await view.goto(`${base}manual/`);
  const shots = await view.evaluate(
    async ({ b64, base, which, scale }) => {
      const pdfjs = await import(`${base}vendor/pdfjs/pdf.min.mjs`);
      pdfjs.GlobalWorkerOptions.workerSrc = `${base}vendor/pdfjs/pdf.worker.min.mjs`;
      const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const doc = await pdfjs.getDocument({ data }).promise;
      const urls = [];
      const pages = [doc.numPages];
      for (const n of which) {
        if (n > doc.numPages) continue;
        const p = await doc.getPage(n);
        const vp = p.getViewport({ scale });
        const c = document.createElement("canvas");
        c.width = vp.width;
        c.height = vp.height;
        await p.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
        urls.push(c.toDataURL("image/png"));
      }
      return { urls, pages: pages[0], which: which.filter((n) => n <= doc.numPages) };
    },
    { b64: pdf.toString("base64"), base, which, scale },
  );
  console.log(`${shots.pages} pages`);
  shots.urls.forEach((u, i) => {
    const file = pagesArg.replace("%d", String(shots.which[i]));
    fs.writeFileSync(file, Buffer.from(u.split(",")[1], "base64"));
    console.log(file);
  });
}
await browser.close();
if (problems.length) {
  console.error(problems.join("\n"));
  process.exitCode = 1;
}

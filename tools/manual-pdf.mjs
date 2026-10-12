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
// renumbered in order. Links to files in the manual (the example recipe, the
// PDF) are made absolute, so a PDF read away from a local server still reaches the public copies.

import { chromium } from "@playwright/test";
import fs from "node:fs";

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

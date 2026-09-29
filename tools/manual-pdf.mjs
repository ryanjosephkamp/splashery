#!/usr/bin/env node
// Prints the Tinkerer's Manual (manual/index.html) to a PDF with Chromium:
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

import { chromium } from "@playwright/test";
import fs from "node:fs";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--")) || "manual/tinkerers-manual.pdf";
const pagesArg = args.find((a) => a.startsWith("--pages="))?.slice(8);
const scale = Number(args.find((a) => a.startsWith("--scale="))?.slice(8)) || 1.5;
const which = (args.find((a) => a.startsWith("--which="))?.slice(8) || "1,2").split(",").map(Number); // prettier-ignore

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
});
const page = await browser.newPage();
const problems = [];
page.on("pageerror", (e) => problems.push(e.message));
page.on("requestfailed", (r) => problems.push(`${r.url()} failed`));
await page.goto(`${base}manual/`, { waitUntil: "networkidle" });
await page.emulateMedia({ media: "print", colorScheme: "light" });
// Every picture loaded before printing.
await page.evaluate(
  () =>
  Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r))))), // prettier-ignore
);
const footer = `<div style="width:100%;font:9px sans-serif;color:#666;padding:0 0.75in;display:flex;justify-content:space-between"><span>The Tinkerer's Manual</span><span><span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`; // prettier-ignore
const pdf = await page.pdf({
  format: "Letter",
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate: footer,
  outline: true,
  tagged: true,
});
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

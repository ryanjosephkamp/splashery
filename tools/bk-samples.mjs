#!/usr/bin/env node
// Lane Books: the test fixtures for Your book, printed with Chromium from
// our own text (docs/handoff/Books.md).
//
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/bk-samples.mjs
//
// Writes tests/fixtures/bk/:
//   pages3.pdf     3 numbered A5 pages
//   pages300.pdf   300 numbered A5 pages (a long book stays light)
//   slides.pdf     4 wide 16:9 slides (the page shape follows the PDF)
//   booklet.pdf    a 12-page Letter booklet with headings and figures (clips)

import { chromium } from "@playwright/test";
import fs from "node:fs";

const out = (p) => new URL(`../${p}`, import.meta.url);
fs.mkdirSync(out("tests/fixtures/bk"), { recursive: true });

const numbered = (n) => {
  let body = "";
  for (let i = 1; i <= n; i++)
    body += `<section><h1>Page ${i}</h1><p>This is page ${i} of ${n}. ${i % 2 ? "An odd page." : "An even page."}</p>${n < 50 ? `<div style="width:${40 + (i % 9) * 40}px"></div>` : ""}</section>`; // prettier-ignore
  return `<!doctype html><html><head><style>@page{size:A5;margin:0.6in}section{break-after:page}h1{font:bold 36pt serif;margin:0 0 12pt}p{font:12pt serif}div{height:18pt;background:#1f5fa8}</style></head><body>${body}</body></html>`; // prettier-ignore
};

const slides = () => {
  const colors = ["#1f5fa8", "#c2410c", "#15803d", "#7e22ce"];
  let body = "";
  for (let i = 1; i <= 4; i++)
    body += `<section><h1>Slide ${i}</h1><p>A wide page, sixteen by nine.</p><div style="background:${colors[i - 1]}"></div></section>`; // prettier-ignore
  return `<!doctype html><html><head><style>@page{size:10in 5.625in;margin:0.5in}section{break-after:page}h1{font:bold 40pt sans-serif;margin:0 0 10pt}p{font:18pt sans-serif}div{height:1.4in;width:6in;margin-top:14pt;border-radius:10pt}</style></head><body>${body}</body></html>`; // prettier-ignore
};

// A booklet about paper books, in our own words.
const CHAPTERS = [
  ["A Short Book About Books", "The Books lane, Splashery, September 2026", null],
  ["1. Leaves and pages", "A leaf is one sheet of paper in a book. Each leaf has two sides, and each side is a page: the front, on the right when the book lies open, and the back, which shows on the left once the leaf has turned. So a book of one hundred leaves has two hundred pages. Printers number the pages, not the leaves.", 1], // prettier-ignore
  ["2. Folding a sheet", "Books are printed on big sheets that are folded and cut. Fold a sheet once and it makes two leaves, four pages; fold it again and it makes eight pages; once more, sixteen. A group of folded sheets is called a signature, and the signatures are stacked and sewn together along the fold.", 2], // prettier-ignore
  ["3. The spine", "The sewn edge of the stacked signatures is the spine. In a hardcover book the spine is glued into a cover made of stiff boards wrapped in cloth or paper. Small striped bands at the top and bottom of the spine, the head and tail bands, once held the sewing tight and now are mostly for looks.", 3], // prettier-ignore
  ["4. Paperbacks", "A paperback has a soft cover of thick paper glued straight onto the spine. It bends as you open it, which is why a paperback lies open less willingly than a hardcover. Paperbacks became common in the 1930s, when printers found they could sell good books cheaply in soft covers.", 1], // prettier-ignore
  ["5. Magazines", "A thin magazine is often saddle stitched: a few big sheets are folded once, nested one inside another, and stapled through the fold. The staples sit in the middle of the center pages. Glossy paper, coated with clay, lets photos print sharply and makes the pages shine.", 2], // prettier-ignore
  ["6. Spirals and staples", "A spiral notebook is held by a wire coil threaded through a row of holes, so each page can turn all the way around to lie behind the others. A report of loose sheets is often held with a single staple in the top left corner, and its pages flip up over the top.", 3], // prettier-ignore
  ["7. Turning a page", "A turning page does not stay flat. It lifts from the spine, bends into a curve as it goes over, and flattens again as it lands on the other side. The edge you hold leads the way, and the paper near the spine follows. Stiffer paper bends less; thin paper curls a lot.", 1], // prettier-ignore
  ["8. Pages as splats", "In this toy every page is made of Gaussian splats: small, flat, colored discs. The paper is a smooth sheet of large pale discs, and each dot of ink becomes one small dark disc just in front of it. As the page turns, every disc turns with the curve of the paper, so the page stays one solid sheet.", 2], // prettier-ignore
  ["9. Only the pages you reach", "A long book would be far too heavy if every page were made of splats at once. So only the open pages, the page that is turning and the next ones are made, from the file, when they are reached, and pages left behind are let go. A book of three hundred pages is as light as a book of three.", 3], // prettier-ignore
  ["10. Near and far", "When you zoom in on a page, it is made again with more and smaller splats, so the words stay sharp; when you zoom out, it is made with fewer, bigger ones, so nothing vanishes into dust. The page you look at always has about one splat for every pixel of your screen.", 1], // prettier-ignore
  ["The end", "Thank you for reading. Tap once more to close the book.", null],
];

const booklet = () => {
  const fig = (k) => {
    const bars = [
      [30, 55, 80, 65, 90],
      [70, 40, 60, 85, 50],
      [20, 45, 70, 95, 75],
    ][k - 1];
    const colors = ["#1f5fa8", "#c2410c", "#15803d"];
    return `<div class="fig">${bars.map((h) => `<span style="height:${h}px;background:${colors[k - 1]}"></span>`).join("")}</div><p class="cap">Figure ${k}. A small chart, for the eye.</p>`; // prettier-ignore
  };
  let body = "";
  CHAPTERS.forEach(([h, p, f], i) => {
    const title = i === 0;
    body += `<section class="${title ? "title" : ""}"><h1>${h}</h1><p>${p}</p>${f ? fig(f) : ""}${i && i < CHAPTERS.length - 1 ? `<p class="n">${i + 1}</p>` : ""}</section>`; // prettier-ignore
  });
  return `<!doctype html><html><head><style>@page{size:Letter;margin:0.9in}section{break-after:page;position:relative;height:9.1in}h1{font:bold 30pt Georgia,serif;margin:0 0 18pt}p{font:17pt/1.5 Georgia,serif;text-align:justify}.title{display:flex;flex-direction:column;justify-content:center;text-align:center}.title h1{font-size:40pt}.title p{text-align:center;font-style:italic}.fig{display:flex;align-items:flex-end;gap:14px;height:110px;margin:28pt auto 6pt;width:max-content}.fig span{width:40px;display:block}.cap{font-size:12pt;text-align:center;font-style:italic}.n{position:absolute;bottom:0;width:100%;text-align:center;font-size:12pt}</style></head><body>${body}</body></html>`; // prettier-ignore
};

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/opt/pw-browsers/chromium",
});
const page = await browser.newPage();
const write = async (name, html) => {
  await page.setContent(html);
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  fs.writeFileSync(out(`tests/fixtures/bk/${name}`), pdf);
  console.log(name, pdf.length, "bytes");
};
await write("pages3.pdf", numbered(3));
await write("pages300.pdf", numbered(300));
await write("slides.pdf", slides());
await write("booklet.pdf", booklet());
await browser.close();

// Task 73: edition URLs and navigation in the real shipped manual PDF.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { MANUAL_PDF } from "../manual/pdf-edition.js";
import { PAGES, label } from "../manual/pages.mjs";
import { checkNavigation, contentsEntries, editionName } from "../tools/manual-pdf-check.mjs";
import { PDFDocument, PDFName, PDFArray, PDFDict } from "../vendor/pdf-lib/pdf-lib.esm.min.js"; // prettier-ignore

const bytes = () => fs.readFileSync(`manual/${MANUAL_PDF}`);
const N = (s) => PDFName.of(s);

test("the edition name follows its bytes, and old addresses still return the same PDF", async ({
  request,
}) => {
  expect(MANUAL_PDF).toBe(editionName(bytes()));
  expect(editionName(Buffer.concat([bytes(), Buffer.from("\n")]))).not.toBe(MANUAL_PDF);
  for (const file of [MANUAL_PDF, "tinkerers-manual.pdf"]) {
    const response = await request.get(`/manual/${file}`);
    expect(response.ok()).toBe(true);
    expect((await response.body()).equals(bytes())).toBe(true);
  }
});

test("every contents number, internal link, and bookmark is checked in the shipped PDF", async () => {
  const report = await checkNavigation(bytes());
  expect(report.pages).toBeGreaterThan(140);
  expect(report.internalLinks).toBeGreaterThan(100);
  expect(report.bookmarks.length).toBeGreaterThan(100);
  const toc = fs
    .readFileSync("manual/all.html", "utf8")
    .match(/<nav class="toc"[\s\S]*?<\/nav>/)[0];
  expect(report.contents).toHaveLength(toc.match(/<a\b/g).length);
  for (const chapter of PAGES.slice(1)) {
    const entry = report.contents.find((e) => e.id === chapter.ids[0]);
    expect(entry, label(chapter)).toBeTruthy();
    expect(report.bookmarks).toContainEqual({ title: label(chapter), page: entry.page });
  }
});

test("the checker rejects an internal link to a nonexistent page", async () => {
  const doc = await PDFDocument.load(bytes(), { updateMetadata: false });
  const link = doc
    .getPages()
    .flatMap((p) => p.node.lookupMaybe(N("Annots"), PDFArray)?.asArray() || [])
    .map((ref) => doc.context.lookup(ref, PDFDict))
    .find((a) => a.has(N("Dest")));
  link.set(N("Dest"), doc.context.obj([99999, N("XYZ"), 0, 792, 0]));
  await expect(checkNavigation(await doc.save())).rejects.toThrow(/not a real page/);
});

test("the checker rejects contents punctuation that differs from the web title", async () => {
  const entries = contentsEntries();
  expect(entries[0].title).toContain(":");
  entries[0].title = entries[0].title.replace(":", ";");
  await expect(checkNavigation(bytes(), entries)).rejects.toThrow(
    /PDF title .* does not match web title/,
  );
});

test("the checker rejects a bookmark on a real page away from its heading", async () => {
  const doc = await PDFDocument.load(bytes(), { updateMetadata: false });
  const first = doc.catalog.lookup(N("Outlines"), PDFDict).lookup(N("First"), PDFDict);
  const chapter = first.lookup(N("Next"), PDFDict);
  const dest = chapter.lookup(N("Dest"), PDFArray);
  chapter.set(N("Dest"), doc.context.obj([dest.get(0), N("XYZ"), 0, 100, 0]));
  await expect(checkNavigation(await doc.save())).rejects.toThrow(/misses its heading/);
});

test("the checker rejects contents numbers that disagree with a real destination", async () => {
  const doc = await PDFDocument.load(bytes(), { updateMetadata: false });
  // Move the named chapter destination while preserving its printed number and explicit links.
  const target = doc.context.obj([doc.getPages().at(-1).ref, N("XYZ"), 0, 792, 0]);
  doc.catalog.lookup(N("Dests"), PDFDict).set(N("splat"), target);
  const tree = doc.catalog
    .lookup(N("Names"), PDFDict)
    .lookup(N("Dests"), PDFDict)
    .lookup(N("Names"), PDFArray);
  for (let i = 0; i < tree.size(); i += 2)
    if (tree.lookup(i).decodeText() === "splat") tree.set(i + 1, target);
  await expect(checkNavigation(await doc.save())).rejects.toThrow(
    /missing or incorrect printed page/,
  );
});

for (const [width, height] of [
  [390, 844],
  [1440, 900],
]) {
  test(`the manual, Learn, and book sample use the edition URL at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    for (const url of ["/manual/", "/manual/all.html", "/site/learn/"]) {
      await page.goto(url);
      const link = page.locator('a[href$=".pdf"]', { hasText: /Download/ });
      await expect(link).toHaveCount(1);
      expect((await link.getAttribute("href")).endsWith(MANUAL_PDF)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
      if (url === "/manual/") {
        await link.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `tests/screenshots/cdx-manual-pdf-${width}x${height}.png` });
      }
    }
    const sample = await page.evaluate(async () =>
      (await import("/src/packs/pictures.js")).RECIPES["your-book"].pictures.sample(),
    );
    expect(sample).toBe(`manual/${MANUAL_PDF}`);
    for (const url of ["/site/about/credits/", "/site/learn/notebook/books/"]) {
      await page.goto(url);
      const link = page.locator('a[href*="/manual/tinkerers-manual"]');
      await expect(link).toHaveCount(1);
      expect((await link.getAttribute("href")).endsWith(`/manual/${MANUAL_PDF}`)).toBe(true);
      expect(
        (await page.request.get(new URL(await link.getAttribute("href"), page.url()).href)).ok(),
      ).toBe(true);
      await expect(page.locator("main")).not.toContainText("manual/tinkerers-manual.pdf");
    }
  });

  test(`PDF.js follows contents links, bookmarks, and printed page numbers at ${width}x${height}`, async ({
    page,
  }) => {
    // Editions can paginate differently. Use the numbers checked against the printed contents,
    // then independently verify that the viewer reaches the named heading by each route.
    const { contents } = await checkNavigation(bytes());
    const printedPage = (id) => {
      const entry = contents.find((e) => e.id === id);
      expect(entry, `printed contents entry #${id}`).toBeTruthy();
      return entry.page;
    };
    const chapterPage = printedPage("splat");
    const glossaryPage = printedPage("glossary");
    const referencePage = printedPage("card");
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height });
    const viewer = `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="/node_modules/pdfjs-dist/legacy/web/pdf_viewer.css">
<style>body{margin:0}#c{position:absolute;inset:40px 0 0;overflow:auto}</style>
<form id="jump"><input id="page-number" type="number" aria-label="Page number"><button>Go</button></form>
<div id="c"><div class="pdfViewer"></div></div>
<script type="module">
const D = "/node_modules/pdfjs-dist/";
const lib = await import(D + "legacy/build/pdf.mjs");
globalThis.pdfjsLib = lib;
lib.GlobalWorkerOptions.workerSrc = D + "legacy/build/pdf.worker.mjs";
const V = await import(D + "legacy/web/pdf_viewer.mjs");
const { MANUAL_PDF } = await import("/manual/pdf-edition.js");
const eventBus = new V.EventBus();
const links = new V.PDFLinkService({ eventBus });
const viewer = new V.PDFViewer({ container: document.getElementById("c"), eventBus, linkService: links });
links.setViewer(viewer);
eventBus.on("pagesinit", () => { viewer.currentScaleValue = "page-width"; });
const pdf = await lib.getDocument({ url: "/manual/" + MANUAL_PDF }).promise;
links.setDocument(pdf); viewer.setDocument(pdf);
document.getElementById("jump").onsubmit = (e) => { e.preventDefault(); viewer.currentPageNumber = document.getElementById("page-number").valueAsNumber; };
window.review = { pdf, links, viewer };
</script>`;
    await page.route("**/__manual-pdf-viewer.html", (r) =>
      r.fulfill({ contentType: "text/html", body: viewer }),
    );
    await page.goto("/__manual-pdf-viewer.html");
    const firstLink = page.locator('.page[data-page-number="1"] [data-internal-link] a').first();
    await expect(firstLink).toHaveAttribute("title", "Chapter 1: What a splat is");
    await firstLink.click();
    await page.waitForFunction((n) => window.review.viewer.currentPageNumber === n, chapterPage);
    await expect(page.locator(`.page[data-page-number="${chapterPage}"] .textLayer`)).toContainText(
      "What a splat is",
    );
    await page.evaluate(async () => {
      const { pdf, links } = window.review;
      const mark = (await pdf.getOutline()).find((m) => m.title === "Glossary");
      await links.goToDestination(mark.dest);
    });
    await page.waitForFunction((n) => window.review.viewer.currentPageNumber === n, glossaryPage);
    await expect(
      page.locator(`.page[data-page-number="${glossaryPage}"] .textLayer`),
    ).toContainText("Glossary");
    // Type the printed contents number as a reader can do when their viewer ignores links.
    await page.fill("#page-number", String(referencePage));
    await page.locator("#jump button").click();
    await page.waitForFunction((n) => window.review.viewer.currentPageNumber === n, referencePage);
    await expect(
      page.locator(`.page[data-page-number="${referencePage}"] .textLayer`),
    ).toContainText("Quick reference");
    await page.screenshot({
      path: `tests/screenshots/cdx-manual-pdf-viewer-${width}x${height}.png`,
    });
    expect(errors).toEqual([]);
  });
}

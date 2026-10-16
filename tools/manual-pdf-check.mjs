#!/usr/bin/env node
// Checks the finished PDF with the site's pinned PDF.js, including printed contents numbers.
// node tools/manual-pdf-check.mjs [file.pdf] [--json=report.json]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import * as pdfjs from "../vendor/pdfjs/pdf.min.mjs";
import { MANUAL_PDF } from "../manual/pdf-edition.js";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "../vendor/pdfjs/pdf.worker.min.mjs",
  import.meta.url,
).href;

const manual = new URL("../manual/", import.meta.url);
const plain = (s) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim(); // prettier-ignore
const key = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const whitespace = (s) => s.replace(/\s+/g, " ").trim();
export const editionName = (bytes) =>
  `tinkerers-manual-${createHash("sha256").update(bytes).digest("hex").slice(0, 16)}.pdf`;

export function contentsEntries() {
  const html = fs.readFileSync(new URL("all.html", manual), "utf8");
  const toc = html.match(/<nav class="toc"[\s\S]*?<\/nav>/)?.[0];
  if (!toc) throw new Error("The manual has no contents.");
  return [...toc.matchAll(/<a\s+href="#([^"]+)"[^>]*>([\s\S]*?)<\/a\s*>/g)].map((m) => ({
    id: m[1],
    title: plain(m[2]),
  }));
}

async function open(bytes, fn) {
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), disableFontFace: true });
  try {
    return await fn(await task.promise);
  } finally {
    await task.destroy();
  }
}

// Used between print passes. Page numbers come from the PDF, never from DOM heights.
export async function contentsPages(bytes, entries = contentsEntries()) {
  return open(bytes, async (doc) => {
    const out = {};
    for (const entry of entries) {
      const dest = await doc.getDestination(entry.id);
      if (!dest) throw new Error(`No PDF destination for contents entry #${entry.id}.`);
      out[entry.id] = (await doc.getPageIndex(dest[0])) + 1;
    }
    return out;
  });
}

export async function checkNavigation(bytes, entries = contentsEntries()) {
  return open(bytes, async (doc) => {
    const resolve = async (dest, where) => {
      const d = typeof dest === "string" ? await doc.getDestination(dest) : dest;
      if (!Array.isArray(d) || !d.length) throw new Error(`${where}: missing destination.`);
      const index = Number.isInteger(d[0]) ? d[0] : await doc.getPageIndex(d[0]);
      if (!Number.isInteger(index) || index < 0 || index >= doc.numPages)
        throw new Error(`${where}: destination is not a real page.`);
      return { page: index + 1, dest: d };
    };
    const text = new Map();
    const items = async (n) => {
      if (!text.has(n)) text.set(n, (await (await doc.getPage(n)).getTextContent()).items);
      return text.get(n);
    };
    const annotations = new Map();
    let links = 0;
    for (let n = 1; n <= doc.numPages; n++) {
      const a = await (await doc.getPage(n)).getAnnotations();
      annotations.set(n, a);
      for (const link of a) {
        if (link.dest != null) {
          await resolve(link.dest, `Link on page ${n}`);
          links++;
        } else if (link.subtype === "Link" && !link.url && !link.unsafeUrl && !link.action) {
          throw new Error(`Link on page ${n} has no usable destination.`);
        }
        if (link.url && /localhost|127\.0\.0\.1/.test(link.url))
          throw new Error(`Link on page ${n} points at the build server.`);
      }
    }
    if (!links) throw new Error("The PDF has no internal links.");
    const outline = await doc.getOutline();
    if (!outline?.length) throw new Error("The PDF has no bookmarks.");
    const bookmarks = [];
    const walk = async (marks) => {
      for (const mark of marks) {
        const target = await resolve(mark.dest, `Bookmark ${mark.title}`);
        const top = target.dest[3];
        if (target.dest[1]?.name !== "XYZ" || !Number.isFinite(top))
          throw new Error(`Bookmark ${mark.title} has no heading position.`);
        const title = mark.title === "Cover and contents" ? "The Tinkerer's Manual" : mark.title;
        // A heading can wrap and have a chapter label above it. Check the text immediately below
        // its destination, rather than finding the same words somewhere else on the page.
        const nearby = (await items(target.page))
          .filter((i) => i.str && i.transform[5] <= top + 3 && i.transform[5] >= top - 72)
          .map((i) => i.str)
          .join(" ");
        if (!key(nearby).includes(key(title)))
          throw new Error(`Bookmark ${mark.title} on page ${target.page} misses its heading.`);
        bookmarks.push({ title: mark.title, page: target.page });
        await walk(mark.items || []);
      }
    };
    await walk(outline);
    const firstChapter = await resolve(await doc.getDestination(entries[0].id), "First chapter");
    const titles = new Map();
    const titlesOn = async (n) => {
      if (titles.has(n)) return titles.get(n);
      const page = await doc.getPage(n);
      const tagged = await page.getTextContent({
        includeMarkedContent: true,
        disableNormalization: true,
      });
      const runs = new Map();
      const stack = [];
      for (const item of tagged.items) {
        if (item.type === "beginMarkedContent" || item.type === "beginMarkedContentProps")
          stack.push(item.id);
        else if (item.type === "endMarkedContent") stack.pop();
        else if (typeof item.str === "string")
          for (const id of new Set(stack.filter(Boolean)))
            runs.set(id, (runs.get(id) || "") + item.str + (item.hasEOL ? "\n" : ""));
      }
      const pageTitles = new Map();
      // A wrapped link can have several annotations and font runs. Its tagged content gives
      // the complete visible title without the adjacent printed page number or alternate text.
      const walk = (node) => {
        if (node.role === "Link") {
          const content = [];
          const ids = [];
          const collect = (child) => {
            if (child.type === "content") content.push(child.id);
            if (child.type === "annotation") ids.push(child.id);
            for (const c of child.children || []) collect(c);
          };
          collect(node);
          const title = whitespace([...new Set(content)].map((id) => runs.get(id) || "").join(""));
          for (const id of ids) pageTitles.set(id, title);
        }
        for (const child of node.children || []) walk(child);
      };
      const tree = await page.getStructTree();
      if (!tree) throw new Error(`Contents page ${n} has no tagged text.`);
      walk(tree);
      titles.set(n, pageTitles);
      return pageTitles;
    };
    const contents = [];
    for (const entry of entries) {
      const target = await resolve(await doc.getDestination(entry.id), `Contents #${entry.id}`);
      let found = false;
      for (let n = 1; n < firstChapter.page && !found; n++) {
        for (const link of annotations.get(n)) {
          if (!link.dest) continue;
          const to = await resolve(link.dest, `Contents link on page ${n}`);
          if (to.page !== target.page || to.dest[3] !== target.dest[3]) continue;
          const number = (await items(n))
            .filter(
              (i) =>
                i.str &&
                i.transform[4] >= link.rect[2] &&
                i.transform[5] >= link.rect[1] - 3 &&
                i.transform[5] <= link.rect[3] + 3,
            )
            .map((i) => i.str)
            .join(" ");
          if (new RegExp(`^p\\.\\s*${target.page}$`).test(number.trim())) {
            const title = (await titlesOn(n)).get(`pdfjs_internal_id_${link.id}`);
            if (title !== whitespace(entry.title))
              throw new Error(
                `Contents #${entry.id}: PDF title ${JSON.stringify(title)} does not match web title ${JSON.stringify(entry.title)}.`,
              );
            found = true;
          }
        }
      }
      if (!found)
        throw new Error(
          `Contents ${entry.title}: missing or incorrect printed page ${target.page}.`,
        );
      contents.push({ ...entry, page: target.page });
    }
    const privateUse = { count: 0, pages: [] };
    let colons = 0;
    for (let n = 1; n <= doc.numPages; n++) {
      const glyphs = new Map();
      let count = 0;
      const pageItems = await items(n);
      for (const [index, item] of pageItems.entries()) {
        colons += (item.str?.match(/:/g) || []).length;
        for (const char of item.str?.match(/\p{Co}/gu) || []) {
          count++;
          const codePoint = `U+${char.codePointAt(0).toString(16).toUpperCase()}`;
          if (!glyphs.has(codePoint)) glyphs.set(codePoint, { codePoint, count: 0, examples: [] });
          const glyph = glyphs.get(codePoint);
          glyph.count++;
          if (glyph.examples.length < 3 && !glyph.examples.some((e) => e.text === item.str))
            glyph.examples.push({
              text: item.str,
              font: item.fontName,
              context: whitespace(
                pageItems
                  .slice(Math.max(0, index - 5), index + 6)
                  .map((i) => i.str)
                  .join(""),
              ),
            });
        }
      }
      if (count) privateUse.pages.push({ page: n, count, glyphs: [...glyphs.values()] });
      privateUse.count += count;
    }
    return { pages: doc.numPages, internalLinks: links, bookmarks, contents, privateUse, colons };
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const bytes = fs.readFileSync(file || new URL(MANUAL_PDF, manual));
  if (!file) {
    if (MANUAL_PDF !== editionName(bytes))
      throw new Error("The edition URL does not match its PDF hash.");
    if (!bytes.equals(fs.readFileSync(new URL("tinkerers-manual.pdf", manual))))
      throw new Error("The legacy PDF is not a copy of the current edition.");
  }
  const report = await checkNavigation(bytes);
  const json = args.find((a) => a.startsWith("--json="))?.slice(7);
  if (json) fs.writeFileSync(json, JSON.stringify(report, null, 2) + "\n");
  console.log(
    `${report.pages} pages; ${report.internalLinks} internal links; ${report.bookmarks.length} bookmarks on their headings; ${report.contents.length} exact contents titles and printed numbers checked; ${report.privateUse.count} private-use characters; ${report.colons} colons.`,
  );
}

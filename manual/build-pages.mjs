// Builds the parts of the Tinkerer's Manual that follow from its list of pages (manual/pages.mjs).
// The chapters are hand-written HTML files; this tool never touches their text. It writes:
//
//   - each page's head (title, description, scripts) and, at the top and the bottom of its <main>,
//     the contents button, the Previous and Next buttons and the fold buttons (between the NAV
//     markers);
//   - the full table of contents on the cover (between the TOC markers);
//   - an id on every heading that has none, and the page prefix on every link to a heading that is
//     on another page (`href="#x"` becomes `href="toy.html#x"`), so a link always lands;
//   - manual/all.html, the whole manual on one page in reading order (the PDF is printed from it);
//   - manual/redirect.js, which sends an old `manual/#anchor` address to the page that has it;
//   - manual/glossary-data.js, the glossary's entries, which the pop-ups on every other page read.
//
// Run it after changing a page, the list of pages, or a heading:
//
//   node manual/build-pages.mjs
//
// `--check` writes nothing and fails if anything is out of date.

import fs from "node:fs";
import * as prettier from "prettier";
import { PAGES, COMING, label } from "./pages.mjs";

const dir = new URL("./", import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, dir), "utf8");
const check = process.argv.includes("--check");
const stale = [];
async function write(file, text) {
  const out = await prettier.format(text, { filepath: file, printWidth: 100 });
  if (!fs.existsSync(new URL(file, dir)) || read(file) !== out) {
    stale.push(file);
    if (!check) fs.writeFileSync(new URL(file, dir), out);
  }
}
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); // prettier-ignore
const plain = (html) => html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim(); // prettier-ignore

// ---- Read the pages ----------------------------------------------------------------------------
const MARK = {
  top: ["<!-- NAV:TOP:START", "<!-- NAV:TOP:END -->"],
  bottom: ["<!-- NAV:BOTTOM:START", "<!-- NAV:BOTTOM:END -->"],
};
function split(html, file) {
  const t0 = html.indexOf(MARK.top[0]);
  const t1 = html.indexOf(MARK.top[1]);
  const b0 = html.indexOf(MARK.bottom[0]);
  const b1 = html.indexOf(MARK.bottom[1]);
  if ([t0, t1, b0, b1].some((i) => i < 0)) throw new Error(`${file} has no NAV markers`);
  return {
    before: html.slice(0, t0),
    content: html.slice(t1 + MARK.top[1].length, b0),
    after: html.slice(b1 + MARK.bottom[1].length),
  };
}
const pages = PAGES.map((p) => ({ ...p, ...split(read(p.file), p.file) }));

// An id on every heading that has none: the text, lower case, with dashes.
const slug = (s) => plain(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48); // prettier-ignore
const taken = new Set();
for (const p of pages) for (const m of p.content.matchAll(/\sid="([^"]+)"/g)) taken.add(m[1]);
for (const p of pages)
  p.content = p.content.replace(/<(h[23])([^>]*)>([\s\S]*?)<\/\1>/g, (all, tag, attrs, inner) => {
    if (/\sid=/.test(attrs)) return all;
    let id = slug(inner) || "section";
    let n = 2;
    const base = id;
    while (taken.has(id)) id = `${base}-${n++}`;
    taken.add(id);
    return `<${tag}${attrs} id="${id}">${inner}</${tag}>`;
  });

// Which page has each id.
const pageOf = new Map();
for (const p of pages)
  for (const m of p.content.matchAll(/\sid="([^"]+)"/g)) pageOf.set(m[1], p.file);

// Links to a heading on another page carry that page's name.
for (const p of pages)
  p.content = p.content.replace(/href="#([^"]+)"/g, (all, id) => {
    const home = pageOf.get(id);
    return home && home !== p.file ? `href="${home}#${id}"` : all;
  });

// ---- The pieces of chrome ---------------------------------------------------------------------
const hasFolds = (p) => /<details[^>]*class="[^"]*\bfold\b/.test(p.content);
const demoScripts = (p) => {
  const ids = [...p.content.matchAll(/data-demo="([^"]+)"/g)].map((m) => m[1]);
  return ids.length ? ["demos.js", "demos2.js"] : [];
};
const headings = (p) =>
  [...p.content.matchAll(/<h3([^>]*)\sid="([^"]+)"([^>]*)>([\s\S]*?)<\/h3>/g)].map((m) => ({ id: m[2], text: plain(m[4]) })); // prettier-ignore

function head(p) {
  const desc = p.file === "index.html"
    ? "How to program Gaussian splats in Splashery: the math of one splat, how a toy is built, the splat equation language, and pictures, screens and your own input."
    : `${plain(label(p))}. The Tinkerer's Manual: how to program Gaussian splats in Splashery.`; // prettier-ignore
  const title = p.file === "index.html" ? p.title : `${label(p)} · The Tinkerer's Manual`;
  const scripts = ["fold.js", "nav.js", ...demoScripts(p)];
  return `<!-- HEAD:START (written by manual/build-pages.mjs; do not edit by hand) -->
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}" />
    <link rel="stylesheet" href="manual.css" />
    <link rel="stylesheet" href="../site/assets/outline.css" />
    ${p.file === "index.html" ? '<script src="redirect.js"></script>' : ""}
    ${scripts.map((s) => `<script type="module" src="${s}"></script>`).join("\n    ")}
    <!-- HEAD:END -->`;
}

function contentsButton(p) {
  const items = PAGES.map((q) => {
    const here = q.file === p.file;
    const sub = here ? headings(pages.find((x) => x.file === q.file)) : [];
    return `<li><a href="${q.file}"${here ? ' aria-current="page"' : ""}>${esc(plain(q.file === "index.html" ? "Contents" : label(q)))}</a>${
      sub.length
        ? `<ol class="outline-sub" aria-label="In this chapter">${sub.map((s) => `<li><a href="#${s.id}">${esc(s.text)}</a></li>`).join("")}</ol>`
        : ""
    }</li>`;
  }).join("");
  return `<div class="outline no-print manual-nav">
        <button type="button" class="outline-toggle" aria-expanded="false" aria-controls="manual-contents"><span class="outline-label">Contents</span><span class="outline-now">${esc(p.file === "index.html" ? "The Tinkerer's Manual" : plain(label(p)))}</span><svg class="outline-chevron" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="m3.5 6 4.5 4.5L12.5 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <nav class="outline-panel" id="manual-contents" aria-label="The manual's chapters" hidden><ol>${items}</ol></nav>
      </div>`;
}

function pager(p, where) {
  const i = PAGES.findIndex((q) => q.file === p.file);
  const prev = PAGES[i - 1];
  const next = PAGES[i + 1];
  const side = (q, rel, word) =>
    q
      ? `<a class="pager-${rel}" rel="${rel}" href="${q.file}"><span class="pager-word">${word}</span><span class="pager-title">${esc(plain(q.file === "index.html" ? "Contents" : label(q)))}</span></a>`
      : "<span></span>";
  return `<nav class="pager no-print" aria-label="Previous and next chapter, ${where}">${side(prev, "prev", "← Previous")}${side(next, "next", "Next →")}</nav>`;
}

const foldButtons = `<p class="no-print fold-all">
        <button type="button" data-fold-all="open">Open all the folds</button>
        <button type="button" data-fold-all="close">Close all the folds</button>
        <span class="muted">Definitions, derivations, notes, and long tables start folded.</span>
      </p>`;

const footer = `<footer>
        <p>
          The Tinkerer's Manual, first published September 28, 2026 and updated October 11, 2026.
          Part of
          <a href="https://ryanjosephkamp.github.io/splashery/" target="_blank" rel="noopener">Splashery</a>, a toy box of 3D Gaussian splats that runs in your browser. Every picture here was made with Splashery itself.
        </p>
      </footer>`;

const topChrome = (p) =>
  `${MARK.top[0]} (written by manual/build-pages.mjs; do not edit by hand) -->
      ${contentsButton(p)}
      ${pager(p, "top")}
      ${p.file !== "index.html" && hasFolds(p) ? foldButtons : ""}
      ${MARK.top[1]}`;
const bottomChrome = (p) =>
  `${MARK.bottom[0]} (written by manual/build-pages.mjs; do not edit by hand) -->
      ${pager(p, "bottom")}
      ${footer}
      ${MARK.bottom[1]}`;

// ---- The cover's full table of contents -------------------------------------------------------
function toc() {
  const li = (p) => {
    const sub = headings(p);
    const name = plain(label(p));
    return `<li><a href="${p.file}">${esc(name)}</a>${
      sub.length
        ? `<ol class="toc-sections">${sub.map((s) => `<li><a href="${p.file}#${s.id}">${esc(s.text)}</a></li>`).join("")}</ol>`
        : ""
    }</li>`;
  };
  const coming = PAGES.find((q) => q.file === "coming.html");
  const out = [];
  for (const p of pages.slice(1)) {
    if (p.file === "coming.html") {
      out.push(
        `<li><a href="coming.html">${esc(plain(p.title))}</a><ol class="toc-sections">${COMING.map((c) => `<li><a href="coming.html#${c.id}">Chapter ${c.chapter}: ${esc(c.title)} (coming)</a></li>`).join("")}</ol></li>`, // prettier-ignore
      );
    } else out.push(li(p));
  }
  void coming;
  return `<!-- TOC:START (written by manual/build-pages.mjs; do not edit by hand) -->
        <nav class="toc" aria-label="Contents">
          <strong>Contents</strong>
          <ol>${out.join("")}</ol>
        </nav>
        <!-- TOC:END -->`;
}

// ---- Write the pages --------------------------------------------------------------------------
function assemble(p) {
  let before = p.before.replace(/<!-- HEAD:START[\s\S]*?<!-- HEAD:END -->/, head(p));
  let content = p.content;
  if (p.file === "index.html")
    content = content.replace(/<!-- TOC:START[\s\S]*?<!-- TOC:END -->/, toc());
  return `${before}${topChrome(p)}${content}${bottomChrome(p)}${p.after}`;
}
for (const p of pages) await write(p.file, assemble(p));

// ---- The whole manual on one page --------------------------------------------------------------
// The cover and every chapter in order, links back to plain anchors, and the scripts the demos
// need. The PDF is printed from this page (tools/manual-pdf.mjs).
const firstId = new Map(PAGES.map((q) => [q.file, q.ids[0]]));
const onePage = (html) =>
  html.replace(/href="([a-z]+\.html)(#[^"]*)?"/g, (all, file, hash) =>
    hash ? `href="${hash}"` : firstId.get(file) ? `href="#${firstId.get(file)}"` : all,
  );
{
  const first = pages[0];
  const body = pages
    .map((p) => {
      const c = p.file === "index.html" ? p.content.replace(/<!-- TOC:START[\s\S]*?<!-- TOC:END -->/, toc()) : p.content; // prettier-ignore
      return onePage(c);
    })
    .join("\n")
    // The whole-manual page does not link to itself, and has the fold buttons once, after the contents.
    .replace(/\s*·\s*<a href="#[^"]*">Read it all on one page<\/a>/, "")
    .replace(/(<!-- TOC:END -->)/, `$1\n      ${foldButtons}`);
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>The Tinkerer's Manual, on one page</title>
    <link rel="stylesheet" href="manual.css" />
    <script type="module" src="fold.js"></script>
    <script type="module" src="demos.js"></script>
    <script type="module" src="demos2.js"></script>
  </head>
  <body>
    <main class="one-page">
      <!-- The whole manual on one page, written by manual/build-pages.mjs; do not edit by hand. -->
      ${body}
      ${footer}
    </main>
  </body>
</html>
`;
  void first;
  await write("all.html", html);
}

// ---- Old addresses ---------------------------------------------------------------------------
// manual/#anchor goes to the page that has the anchor.
{
  const map = {};
  for (const [id, file] of pageOf) if (file !== "index.html") map[id] = file;
  const js = `// Sends an old manual/#anchor address to the page that has it (written by manual/build-pages.mjs).
(function () {
  var pages = ${JSON.stringify(map)};
  var id = decodeURIComponent(location.hash.slice(1));
  if (id && Object.prototype.hasOwnProperty.call(pages, id)) location.replace(pages[id] + "#" + id);
})();
`;
  await write("redirect.js", js);
}

// ---- The glossary, for the pop-ups on the other pages --------------------------------------
{
  const g = pages.find((p) => p.file === "glossary.html");
  const entries = {};
  for (const m of g.content.matchAll(/<dt id="([^"]+)">([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g))
    entries[m[1]] = { title: m[2].trim(), body: m[3].trim() };
  const js = `// The glossary's entries, for the pop-ups on pages that do not hold the glossary (written by
// manual/build-pages.mjs from glossary.html).
export default ${JSON.stringify(entries, null, 1)};
`;
  await write("glossary-data.js", js);
}

if (check && stale.length) {
  console.error(`Out of date: ${stale.join(", ")}. Run node manual/build-pages.mjs.`);
  process.exit(1);
}
console.log(
  check
    ? "The manual's pages are current."
    : `Wrote ${stale.length} changed file(s): ${stale.join(", ") || "none"}.`,
);

#!/usr/bin/env node
// Builds the preview site under site/ (lane Site): every page with the one
// header, menu and footer, the search index, the sitemap, the web app manifest,
// the toy player page and the service worker. Pages come from tools/site-pages.mjs
// and from the data the repo already has (src/toys.js, src/toy-help.js, the git
// history), so a new kind of page is a new entry in PAGE_TYPES, not new machinery.
//
//   node tools/site-build.mjs            # writes site/ (then commit what changed)
//   node tools/site-build.mjs --check    # exits 1 if site/ is out of date, apart from
//                                        # the files built from the toy list and the
//                                        # git history (they follow main: the
//                                        # Operator's upkeep rebuilds them)
//
// Hand-written files live in site/assets/ (site.css, site.js, search.js,
// offline.js) and are copied by nobody: pages link to them. site/assets/og.png
// is rendered by tools/site-og.mjs. Everything else under site/ is generated:
// never edit it by hand, and on a merge conflict take either side and rebuild.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import * as prettier from "prettier";
import { TOYS, CATEGORIES, holdsStill } from "../src/toys.js";
import { TOY_HELP, defaultHowTo } from "../src/toy-help.js";
import { RIGS } from "../src/rigs.js";
import { SITE, FRONT_DOOR, MENU, PAGES, NOT_FOUND, HOME_TOY, DOC_PAGES, appLink, newTabLinks, mirrorDocLinks } from "./site-pages.mjs"; // prettier-ignore
import { hubTypes } from "./site-hubs.mjs";
import { toyPage, toyPath, toyPageDirs, TOY_DATES, dateText } from "./site-toy-pages.mjs";
import { swapLayout, liftHtml, KEEP_ASSETS } from "./site-front-door.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(root, "site");
const CHECK = process.argv.includes("--check");
// The swapped layout (lane Site r4): staged in .cache/front-door/ with --front-door, or written
// into the repo itself when FRONT_DOOR is on (docs/handoff/SiteR4.md, "The swap, step by step").
const SWAPPED = FRONT_DOOR || process.argv.includes("--front-door");
const outArg = process.argv.indexOf("--out");
const STAGE = outArg > 0 ? path.resolve(process.argv[outArg + 1]) : path.join(root, ".cache/front-door"); // prettier-ignore
const SWAP_OUT = FRONT_DOOR && outArg < 0 ? root : STAGE;
if (SWAPPED) SITE.preview = false;

// ---- Helpers --------------------------------------------------------------------------

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
// Visible text from an HTML fragment written in site-pages.mjs (for meta tags and search).
const plain = (html) =>
  String(html ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
const fold = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// The relative prefix from a page's folder back to site/ ("" for the home page).
const upTo = (pagePath) => "../".repeat(pagePath.split("/").filter(Boolean).length);

const categoryLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label || id;
// American English on the site's own pages; the app's shelf keeps its label.
const shelfName = (id) => ({ maths: "Math" })[id] || categoryLabel(id);

// A link that opens a shelf toy in the Playground: a version 3 scene in the plain
// JSON form (#s=j.…), which every Splashery since v2 reads, with the toy's own
// camera and, for a toy that holds still, the turntable off. Relative to site/.
function galleryHash(t) {
  const scene = { app: "splashery", version: 3, toy: { kind: "builtin", id: t.id } };
  if (t.camera) scene.camera = { ...t.camera };
  if (holdsStill(t)) scene.autoplay = { turntable: false, effect: "none" };
  return "j." + Buffer.from(JSON.stringify(scene)).toString("base64url");
}
const galleryHref = (t) => `../#s=${galleryHash(t)}`;
const thumbHref = (t) =>
  fs.existsSync(path.join(root, `assets/toys/${t.id}/thumb.webp`))
    ? `../assets/toys/${t.id}/thumb.webp`
    : "";

// A toy's how-to line, as the app shows it (its own, or the one built from its recipe).
const packs = {};
async function howTo(t) {
  if (TOY_HELP[t.id]?.howTo) return TOY_HELP[t.id].howTo;
  let recipe = RIGS[t.id] || null;
  if (t.kind === "kit" && t.pack) {
    try {
      packs[t.pack] ??= (await import(`../src/packs/${t.pack}.js`)).RECIPES || {};
      recipe = packs[t.pack][t.id] || null;
    } catch {
      recipe = null;
    }
  }
  return defaultHowTo({ id: t.id, kind: t.kind, label: t.label, recipe });
}

// ---- The shell: head, header with the one menu, footer -------------------------------

const LOGO = `<svg class="logo" viewBox="0 0 64 64" width="28" height="28" aria-hidden="true"><g opacity=".92"><ellipse cx="24" cy="26" rx="14" ry="11" fill="#ff5fa2"/><ellipse cx="40" cy="24" rx="12" ry="13" fill="#7bdff2"/><ellipse cx="33" cy="41" rx="15" ry="11" fill="#ffd166"/></g></svg>`; // prettier-ignore
const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cg opacity='.92'%3E%3Cellipse cx='24' cy='26' rx='14' ry='11' fill='%23ff5fa2'/%3E%3Cellipse cx='40' cy='24' rx='12' ry='13' fill='%237bdff2'/%3E%3Cellipse cx='33' cy='41' rx='15' ry='11' fill='%23ffd166'/%3E%3C/g%3E%3C/svg%3E";

// Sets the saved theme and the labs switch before the first paint.
const EARLY = `(function(){var d=document.documentElement;d.classList.add("js");try{var t=localStorage.getItem("splashery.site.theme");if(t==="light"||t==="dark")d.dataset.theme=t;var q=new URLSearchParams(location.search).get("labs");if(q==="1")localStorage.setItem("splashery.labs","1");else if(q==="0")localStorage.removeItem("splashery.labs");if(localStorage.getItem("splashery.labs")==="1")d.classList.add("labs")}catch(e){}})();`; // prettier-ignore

// A page's link preview picture: its own (a toy's thumbnail, relative to site/), or the site's.
function ogImage(page) {
  const img = page.image
    ? { src: new URL(page.image, SITE.origin + SITE.base).href, w: page.imageSize, h: page.imageSize, alt: page.imageAlt, card: "summary" } // prettier-ignore
    : { src: `${SITE.origin + SITE.base}assets/og.png`, w: 1200, h: 630, alt: "A strawberry made of soft 3D splats, beside the word Splashery", card: "summary_large_image" }; // prettier-ignore
  return `<meta property="og:image" content="${esc(img.src)}" />
<meta property="og:image:width" content="${img.w}" />
<meta property="og:image:height" content="${img.h}" />
<meta property="og:image:alt" content="${esc(img.alt)}" />
<meta name="twitter:card" content="${img.card}" />`;
}

// The root 404 page is served at any depth, so its links resolve from the project's root: on
// GitHub Pages the first path segment is the project ("/splashery/"); anywhere else the root is "/".
// The base, the styles and the scripts are written by that one script (document.write), so the
// browser's early look-ahead doesn't fetch them from the wrong folder first.
const rootBase = (css, js) =>
  `(function(){var p=location.pathname.split("/"),b=/\\.github\\.io$/.test(location.hostname)&&p[1]?"/"+p[1]+"/":"/";document.write('<base href="'+b+'">'${css.map((f) => `+'<link rel="stylesheet" href="'+b+'${f}">'`).join("")}${js.map((f) => `+'<script type="module" src="'+b+'${f}"><\\/script>'`).join("")})})();`; // prettier-ignore

function shell(page, main, opts) {
  return newTabLinks(mirrorDocLinks(shellHtml(page, main, opts), opts.up), opts.up);
}

function shellHtml(page, main, { up, url, fixedBase = false, htmlData = "" }) {
  const title = page.title.includes("Splashery") ? page.title : `${page.title} · Splashery`;
  const desc = plain(page.description);
  const nav = MENU.map((m) => {
    const current = m.id === page.nav ? ' aria-current="page"' : "";
    return `<li><a href="${up}${m.href}"${current}>${esc(m.label)}</a></li>`;
  }).join("");
  // The 404 page can be served at any depth, so its links resolve from site/ itself.
  const styles = ["assets/site.css", ...(page.styles || []).map((f) => `assets/${f}`)];
  const scripts = ["assets/site.js", ...(page.scripts || []).map((f) => `assets/${f}`)];
  const base =
    fixedBase === "root"
      ? `<script>${rootBase(styles, scripts)}</script>`
      : fixedBase
        ? `<script>(function(){var p=location.pathname,i=p.indexOf("/site/");var b=document.createElement("base");b.href=i<0?"/":p.slice(0,i+6);document.head.appendChild(b)})();</script>` // prettier-ignore
        : "";
  return `<!doctype html>
<html lang="en" data-root="${up || "./"}"${htmlData}>
<head>
<meta charset="utf-8" />${base ? `\n${base}` : ""}
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
${SITE.preview ? '<meta name="robots" content="noindex" />' : ""}
<link rel="canonical" href="${esc(url)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Splashery" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${esc(url)}" />
${ogImage(page)}
<meta name="color-scheme" content="light dark" />
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#101010" />
${fixedBase === "root" ? "" : `<link rel="manifest" href="${up}manifest.webmanifest" />\n`}<link rel="icon" href="${FAVICON}" />
${fixedBase === "root" ? "" : `<link rel="apple-touch-icon" href="${up}../assets/app/icon-180.png" />\n`}<script>${EARLY}</script>
${
  fixedBase === "root"
    ? ""
    : `<link rel="stylesheet" href="${up}assets/site.css" />
${[...(page.styles || []), ...(page.outline ? ["outline.css"] : [])].map((f) => `<link rel="stylesheet" href="${up}assets/${f}" />`).join("\n")}
<script type="module" src="${up}assets/site.js"></script>
${[...(page.scripts || []), ...(page.outline ? ["outline.js"] : [])].map((f) => `<script type="module" src="${up}assets/${f}"></script>`).join("\n")}`
}
</head>
<body>
<a class="skip-link" href="#main">Skip to the page</a>
<header class="site-header">
<div class="bar">
<a class="brand" href="${up}" aria-label="Splashery home">${LOGO}<span>Splashery</span></a>
<a class="search-link" href="${up}search/" aria-label="Search"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="m15.5 15.5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></a>
<button type="button" class="menu-button" aria-expanded="false" aria-controls="site-menu"><span class="menu-icon" aria-hidden="true"></span><span class="menu-label">Menu</span></button>
<div class="menu" id="site-menu">
<nav aria-label="Site"><ul>${nav}</ul></nav>
<form class="search-form" role="search" action="${up}search/" method="get">
<label class="visually-hidden" for="site-search">Search toys and pages</label>
<input id="site-search" type="search" name="q" placeholder="Search toys" autocomplete="off" enterkeyhint="search" />
<button type="submit">Search</button>
</form>
<button type="button" class="theme-button" aria-label="Color theme: follows your device">
<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18V3z" fill="currentColor"/><circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
<span class="theme-label">Auto</span>
</button>
</div>
</div>
</header>
<main id="main" tabindex="-1"${page.outline ? " data-outline" : ""}>
${main}
</main>
<footer class="site-footer">
<div class="footer-grid">
<div class="footer-brand"><a class="brand" href="${up}">${LOGO}<span>Splashery</span></a><p>${esc(SITE.tagline)}. Free, in your browser, with nothing to install; files you open stay on your device.</p></div>
<nav aria-label="Explore"><h2>Explore</h2><ul>${MENU.map((m) => `<li><a href="${up}${m.href}">${esc(m.label)}</a></li>`).join("")}</ul></nav>
<nav aria-label="More"><h2>More</h2><ul><li><a href="${up}../">The Playground</a></li><li><a href="${up}search/">Search</a></li><li><a href="${up}../manual/">The Tinkerer's Manual</a></li><li><a href="${SITE.github}">Source on GitHub</a></li><li><a href="${up}share/">Embed and share</a></li><li><a href="${up}about/credits/">Credits</a></li><li><a href="${up}about/contact/">Contact</a></li><li><a href="${up}about/privacy/">Privacy</a></li><li><a href="${up}about/terms/">Terms</a></li></ul></nav>
</div>
<p class="fine">Made by <a href="${up}about/contact/">${esc(SITE.maker)}</a>. Code under the MIT license; each toy's assets keep their own licenses. Built on the PlayCanvas engine.${SITE.preview ? ` This is a preview of Splashery's new site; the toys live in <a href="${up}../">the Playground</a>.` : ""}</p>
</footer>
</body>
</html>
`;
}

// ---- Page types -----------------------------------------------------------------------
// Each takes (page, ctx) and returns the HTML inside <main>. ctx.up is the
// prefix back to site/. To add a type: write a function here, give pages
// `type: "<its key>"` in tools/site-pages.mjs, and (if it should be found)
// add its words in searchEntries().

const publicToys = TOYS.filter((t) => t.category);

function toyCard(t, up) {
  const thumb = thumbHref(t);
  const labs = t.labs ? " data-labs" : "";
  return `<li class="toy-card"${labs}><a href="${up}${toyPath(t)}">${thumb ? `<img src="${up}${thumb}" alt="" width="96" height="96" loading="lazy" decoding="async" />` : `<span class="no-thumb" aria-hidden="true"></span>`}<span class="toy-name">${esc(t.label)}${t.labs ? ' <span class="badge">labs</span>' : ""}</span></a></li>`; // prettier-ignore
}

function shelfSections(ids, up, headingLevel = 2) {
  const cats = ids === "all" ? CATEGORIES.map((c) => c.id) : ids;
  const h = `h${headingLevel}`;
  const byShelf = cats
    .map((id) => {
      const toys = publicToys.filter((t) => t.category === id);
      if (!toys.length) return "";
      const allLabs = toys.every((t) => t.labs) ? " data-labs" : "";
      const count = toys.filter((t) => !t.labs).length;
      return `<section class="shelf" id="shelf-${id}"${allLabs} aria-labelledby="h-shelf-${id}">
<${h} id="h-shelf-${id}">${esc(shelfName(id))} <span class="count">${count ? `${count} toy${count === 1 ? "" : "s"}` : "labs"}</span></${h}>
<ul class="toy-grid">${toys.map((t) => toyCard(t, up)).join("")}</ul>
</section>`;
    })
    .join("\n");
  return `<div class="shelf-views" data-view="shelf">
<div class="order-bar" role="group" aria-label="Order" hidden><span class="order-label">Order:</span><button type="button" class="order-button" data-order="shelf" aria-pressed="true">By shelf</button><button type="button" class="order-button" data-order="date" aria-pressed="false">Newest first</button></div>
<div class="by-shelf">
${byShelf}
</div>
${newestSections(cats, up, headingLevel)}
</div>`;
}

// The same toys, newest first: one heading per day the toys arrived (tools/toy-dates.mjs).
function newestSections(cats, up, headingLevel) {
  const toys = publicToys.filter((t) => cats.includes(t.category) && TOY_DATES[t.id]);
  const days = new Map();
  for (const t of toys) days.set(TOY_DATES[t.id], [...(days.get(TOY_DATES[t.id]) || []), t]);
  const h = `h${headingLevel}`;
  const body = [...days]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, list]) => {
      const labs = list.every((t) => t.labs) ? " data-labs" : "";
      const n = list.filter((t) => !t.labs).length;
      return `<section class="day"${labs} aria-labelledby="h-day-${date}">
<${h} id="h-day-${date}"><time datetime="${date}">${dateText(date)}</time> <span class="count">${n ? `${n} toy${n === 1 ? "" : "s"}` : "labs"}</span></${h}>
<ul class="toy-grid">${list.map((t) => toyCard(t, up)).join("")}</ul>
</section>`;
    })
    .join("\n");
  return `<div class="by-date" aria-label="Newest first">
${body}
</div>`;
}

// `extra` adds chips for other sections of the page: [[id, label], …] linking to #h-<id>.
function shelfIndex(ids, extra = []) {
  const cats = (ids === "all" ? CATEGORIES.map((c) => c.id) : ids).filter((id) =>
    publicToys.some((t) => t.category === id),
  );
  if (cats.length < 4) return "";
  const more = extra.map(([id, label]) => `<li><a href="#h-${id}">${esc(label)}</a></li>`).join("");
  return `<nav class="shelf-index" aria-label="Shelves"><ul>${cats
    .map((id) => {
      const labs = publicToys.filter((t) => t.category === id).every((t) => t.labs);
      return `<li${labs ? " data-labs" : ""}><a href="#shelf-${id}">${esc(shelfName(id))}</a></li>`;
    })
    .join("")}${more}</ul></nav>`;
}

const intro = (page, extra = "", eyebrow = "") =>
  `<div class="page-intro">${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ""}<h1>${esc(page.title)}</h1>${page.lead ? `<p class="lead">${page.lead}</p>` : ""}${extra}</div>`; // prettier-ignore
const countToys = (ids) =>
  publicToys.filter((t) => !t.labs && (ids === "all" || ids.includes(t.category))).length;

// Small line drawings for the home page's reasons (currentColor, so they follow the theme).
const ICONS = {
  capture: `<svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M8 16v-4a4 4 0 0 1 4-4h4M32 8h4a4 4 0 0 1 4 4v4M40 32v4a4 4 0 0 1-4 4h-4M16 40h-4a4 4 0 0 1-4-4v-4"/></g><g opacity=".9"><ellipse cx="20" cy="22" rx="7" ry="5.5" fill="#ff5fa2"/><ellipse cx="28" cy="21" rx="6" ry="6.5" fill="#7bdff2"/><ellipse cx="24" cy="29" rx="7.5" ry="5.5" fill="#ffd166"/></g></svg>`, // prettier-ignore
  move: `<svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true"><g opacity=".9"><ellipse cx="17" cy="25" rx="7" ry="5.5" fill="#ff5fa2"/><ellipse cx="31" cy="17" rx="5" ry="5.5" fill="#7bdff2"/><ellipse cx="33" cy="33" rx="6" ry="4.5" fill="#ffd166"/></g><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M24 21l3-2M25 29l3 1.5"/><path d="M38 10l3-3M41 38l3 2"/></g></svg>`, // prettier-ignore
  recipe: `<svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 14 7 24l9 10M32 14l9 10-9 10"/></g><g opacity=".9"><ellipse cx="22" cy="24" rx="3.5" ry="3" fill="#ff5fa2"/><ellipse cx="27" cy="21" rx="3" ry="3.2" fill="#7bdff2"/><ellipse cx="26" cy="27.5" rx="3.5" ry="2.8" fill="#ffd166"/></g></svg>`, // prettier-ignore
};
// The tools' small drawings, and the Playground's keys for the first five.
const TOOL_ICONS = {
  orbit: '<path d="M12 4a8 8 0 1 1-7.4 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M3 5v4.5h4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/>', // prettier-ignore
  poke: '<path d="M9 13V5.5a1.5 1.5 0 0 1 3 0V11l4.6.9a2 2 0 0 1 1.6 2.3l-.8 4.3a2 2 0 0 1-2 1.5H11a2 2 0 0 1-1.6-.8L6 14.8a1.4 1.4 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>', // prettier-ignore
  paint: '<path d="M14.5 4.5l5 5-8 8-5-5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M6.5 12.5 4 20l7.5-2.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>', // prettier-ignore
  magnet: '<path d="M6 4v8a6 6 0 0 0 12 0V4h-4v8a2 2 0 0 1-4 0V4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M6 8h4M14 8h4" stroke="currentColor" stroke-width="1.8"/>', // prettier-ignore
  clay: '<path d="M5 16c0-4 3-9 7-9s7 5 7 9c0 2-3 3-7 3s-7-1-7-3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 11c1 1 3 1 4 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>', // prettier-ignore
  tap: '<circle cx="12" cy="12" r="3" fill="currentColor"/><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.8" opacity=".6"/><circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".3"/>', // prettier-ignore
  make: '<path d="M12 4v16M4 12h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/>', // prettier-ignore
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>', // prettier-ignore
  embed: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>', // prettier-ignore
  "gif-and-video": '<rect x="3.5" y="6" width="17" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m10.5 9.5 4 2.5-4 2.5z" fill="currentColor"/>', // prettier-ignore
};
const TOOL_KEYS = { orbit: "1", poke: "2", paint: "3", magnet: "4", clay: "5" };
const slug = (name) => fold(name).replace(/\W+/g, "-");

const arrow = `<svg class="arrow" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 8h9M8.5 4 12.5 8l-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`; // prettier-ignore

const PAGE_TYPES = {
  home(page, { up }) {
    const toy = TOYS.find((t) => t.id === HOME_TOY.id);
    const play = `${up}play/?toy=${toy.id}&autoplay=${HOME_TOY.autoplay}`;
    const shelves = new Set(publicToys.filter((t) => !t.labs).map((t) => t.category)).size;
    const art = (ids) =>
      ids
        .map((id) => TOYS.find((t) => t.id === id))
        .filter((t) => t && thumbHref(t))
        .map(
          (t) =>
            `<img src="${up}${thumbHref(t)}" alt="" width="72" height="72" loading="lazy" decoding="async" />`,
        ) // prettier-ignore
        .join("");
    const doors = page.doors
      .map((d) => {
        const m = MENU.find((x) => x.id === d.nav);
        const href = d.href ?? m.href;
        const label = d.label ?? m.label;
        const id = d.id ?? d.nav;
        const pics = art(d.art || []);
        return `<li class="door door-${id}"${d.labs ? " data-labs" : ""}><a href="${up}${href}">${pics ? `<span class="door-art">${pics}</span>` : `<span class="door-art door-art-mark">${LOGO}</span>`}<span class="door-title">${esc(label)}${d.labs ? ' <span class="badge">labs</span>' : ""}${arrow}</span><span class="door-text">${esc(d.text)}</span></a></li>`; // prettier-ignore
      })
      .join("");
    const featured = page.featured
      .map((id) => TOYS.find((t) => t.id === id))
      .filter((t) => t && !t.labs)
      .map(
        (t) =>
          `<li><a href="${up}${toyPath(t)}"><img src="${up}${thumbHref(t)}" alt="" width="120" height="120" loading="lazy" decoding="async" /><span class="feat-name">${esc(t.label)}</span><span class="feat-shelf">${esc(shelfName(t.category))}</span></a></li>`,
      ) // prettier-ignore
      .join("");
    return `<section class="hero" aria-labelledby="h-home">
<div class="hero-text">
<p class="eyebrow">Free · runs in your browser</p>
<h1 id="h-home">${esc(page.headline)}</h1>
<p class="lead">${page.lead}</p>
<p class="actions"><a class="button primary" href="${up}../">Open the Playground${arrow}</a><a class="button" href="${up}${galleryHref(toy)}">Play with the ${esc(toy.label.toLowerCase())}</a></p>
<p class="stats"><span><b>${countToys("all")}</b> toys</span><span><b>${shelves}</b> shelves</span><span><b>0</b> uploads</span></p>
</div>
<figure class="hero-toy">
<div class="stage">
<span class="poster" aria-hidden="true" style="background-image: url('${up}${thumbHref(toy)}')"></span>
<iframe src="${play}" title="A live ${esc(toy.label.toLowerCase())} made of splats: drag to turn it" loading="eager" allow="fullscreen"></iframe>
</div>
<figcaption>A real ${esc(toy.label.toLowerCase())}, captured from photos and drawn with soft splats. Drag to turn it.</figcaption>
</figure>
</section>
<section class="band featured" aria-labelledby="h-featured">
<div class="band-head"><h2 id="h-featured">From the shelves</h2><a href="${up}toys/">Every toy${arrow}</a></div>
<ul class="feat-row">${featured}</ul>
</section>
<section class="band" aria-labelledby="h-why">
<h2 id="h-why">Why splats</h2>
<ul class="features">${page.features.map((f) => `<li>${ICONS[f.icon]}<h3>${esc(f.title)}</h3><p>${esc(f.text)}</p></li>`).join("")}</ul>
</section>
<section class="band" aria-labelledby="h-doors">
<h2 id="h-doors">Where to go</h2>
<ul class="doors">${doors}</ul>
</section>
<section class="cta" aria-labelledby="h-cta">
<h2 id="h-cta">Pick a toy and poke it.</h2>
<p>Every toy can be shared as a link, put on your own page, or saved as a GIF or a video.</p>
<p class="actions"><a class="button primary" href="${up}../">Open the Playground${arrow}</a></p>
</section>`;
  },

  shelves(page, { up }) {
    const n = countToys(page.shelves);
    // The catalog PDF (lane Toy pages: tools/tpg-catalog.mjs), labs only for now.
    const catalog = page.catalog ? `<a class="button" data-labs href="${up}${page.catalog.file}" download>Download the catalog <span class="note">(PDF, ${(fs.statSync(path.join(OUT, page.catalog.file)).size / 1e6).toFixed(1)} MB)</span></a>` : ""; // prettier-ignore
    return `${intro(page, `<p class="actions"><a class="button primary" href="${up}../">Open the Playground${arrow}</a>${catalog}</p>`, `${n} toys`)}
${shelfIndex(page.shelves)}
${shelfSections(page.shelves, up)}`;
  },

  links(page, { up }) {
    const href = (h) => (/^https?:/.test(h) ? h : up + h);
    return `${intro(page)}
<ul class="link-list">${page.links.map((l) => `<li><a href="${esc(href(l.href))}">${esc(l.label)}</a><p>${esc(l.text)}</p></li>`).join("")}</ul>`; // prettier-ignore
  },

  ...hubTypes({
    esc,
    plain,
    fold,
    intro,
    arrow,
    galleryHref,
    thumbHref,
    shelfSections,
    shelfIndex,
    countToys,
    publicToys,
    TOYS,
    shelfName,
    SITE,
    root,
    TOY_DATES,
    dateText,
    toyPath,
    longDate,
    LOGO,
    TOOL_KEYS,
    TOOL_ICONS,
    appLink,
    toyPath,
    DOC_PAGES, // prettier-ignore
  }),

  search(page) {
    return `<div class="page-intro"><h1>Search</h1></div>
<form class="search-page-form" role="search" action="./" method="get">
<label for="q">Search toys, tools and pages</label>
<input id="q" type="search" name="q" autocomplete="off" enterkeyhint="search" placeholder="A toy, a shelf or what it does" />
</form>
<div class="suggest" id="search-suggest"><p>Try</p><ul>${page.suggest.map((w) => `<li><a href="./?q=${encodeURIComponent(w)}">${esc(w)}</a></li>`).join("")}</ul></div>
<p class="search-status" id="search-status" role="status" aria-live="polite"></p>
<ul class="search-results" id="search-results"></ul>
<script type="module" src="../assets/search.js"></script>`;
  },

  // A page for every toy (lane Toy pages): tools/site-toy-pages.mjs.
  toy: (page, ctx) => toyPage(page, { ...ctx, esc, toyCard, galleryHref, thumbHref, shelfName, howTo, arrow }), // prettier-ignore

  notFound() {
    return `<div class="page-intro"><h1>This page isn't here</h1>
<p class="lead">It may have moved. Try a search, or start from the home page.</p></div>
<form class="search-page-form" role="search" action="search/" method="get">
<label for="q404">Search toys, tools and pages</label>
<input id="q404" type="search" name="q" autocomplete="off" enterkeyhint="search" />
</form>
<p class="actions"><a class="button primary" href="./">Home</a><a class="button" href="../">Open the Playground</a></p>`; // prettier-ignore
  },
};

function longDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]; // prettier-ignore
  return `${months[m - 1]} ${d}, ${y}`;
}

// ---- Search index -----------------------------------------------------------------------
// One entry per toy, tool and page: { t: title, u: link from site/, k: kind,
// s: shelf, d: a line to show (searched too), w: more folded search words, i: thumbnail, l: labs }.

async function searchEntries() {
  const out = [];
  for (const t of publicToys) {
    const how = await howTo(t);
    out.push({
      t: t.label,
      u: toyPath(t),
      k: "toy",
      s: shelfName(t.category),
      d: how,
      w: fold(`${t.label} ${shelfName(t.category)} ${categoryLabel(t.category)} ${t.tags || ""} ${t.id}`), // prettier-ignore
      ...(thumbHref(t) ? { i: thumbHref(t) } : {}),
      ...(t.labs ? { l: 1 } : {}),
    });
  }
  for (const p of PAGES) {
    if (p.type === "search" || p.type === "toy" || p.search === false) continue;
    out.push({
      t: p.path ? p.title : "Home",
      u: p.path,
      k: "page",
      d: plain(p.description),
      w: fold(`${p.title} ${plain(p.description)} ${plain(p.lead)}`),
    });
    for (const g of p.groups || []) {
      for (const [name, text] of g.items) {
        out.push({
          t: name,
          u: `${p.path}#tool-${fold(name).replace(/\W+/g, "-")}`,
          k: "tool",
          d: text,
          w: fold(`${name} ${text} tool ${g.title}`),
        });
      }
    }
    for (const c of p.cards || []) {
      out.push({ t: c.title, u: c.href, k: "page", d: plain(c.text), w: fold(`${c.title} ${plain(c.text)} learn`) }); // prettier-ignore
    }
    for (const l of p.links || []) {
      out.push({ t: l.label, u: l.href, k: "page", d: l.text, w: fold(`${l.label} ${l.text} learn`) }); // prettier-ignore
    }
  }
  return out;
}

// ---- The toy player page, inside the service worker's scope ---------------------------------
// embed/index.html, one folder deeper, plus a line that points "Open in
// Splashery" at the toy itself. Living under site/, the service worker sees
// every file it loads, so a toy played once keeps working offline.

function playPage() {
  const src = fs.readFileSync(path.join(root, "embed/index.html"), "utf8");
  const desc =
    "A Splashery toy on its own, made of 3D Gaussian splats: drag to turn it, tap to play.";
  return src
    .replace(/(href|src)="\.\.\//g, '$1="../../')
    .replace(
      "</head>",
      `<meta name="description" content="${desc}" />\n<meta property="og:description" content="${desc}" />\n</head>`,
    ) // prettier-ignore
    .replace(
      "</body>",
      `<script type="module" src="../assets/play.js"></script>
</body>`,
    );
}

// ---- Manifest, sitemap, service worker ---------------------------------------------------

function manifest() {
  return JSON.stringify(
    {
      name: "Splashery",
      short_name: "Splashery",
      description: "Toys made of 3D Gaussian splats that you can poke, paint, drop and share.",
      id: "./",
      start_url: "./",
      scope: "./",
      display: "standalone",
      orientation: "any",
      background_color: "#ffffff",
      theme_color: "#ffffff",
      icons: [
        { src: "../assets/app/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "../assets/app/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "../assets/app/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }, // prettier-ignore
      ],
    },
    null,
    2,
  );
}

function sitemap() {
  const urls = PAGES.filter((p) => p.sitemap !== false).map((p) => `${SITE.origin}${SITE.base}${p.path}`); // prettier-ignore
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join("\n")}
</urlset>
`;
}

function serviceWorker(version, precache) {
  return fs
    .readFileSync(path.join(root, "tools/site-sw.template.js"), "utf8")
    .replace('"@@VERSION@@"', JSON.stringify(version))
    .replace('["@@PRECACHE@@"]', JSON.stringify(precache));
}

// ---- The root 404 page ----------------------------------------------------------------------
// GitHub Pages serves 404.html for every missing path under the project, at any depth. Two forms:
// before the swap ("preview") a small page in the site's look that only helps people find a toy in
// the Playground, so the public never sees the preview's pages; after it ("live") the full shell.
// Both send a "#s=" link on to the Playground before anything paints and read the path's words
// (assets/not-found.js).

const FORWARD_404 = `(function(){var h=location.hash;if(/(^#|&)s=/.test(h)){document.documentElement.style.visibility="hidden";location.replace(new URL(document.documentElement.dataset.gallery,document.baseURI).href+location.search+h)}})();`; // prettier-ignore

function notFoundMain(live) {
  return `<div class="page-intro"><h1>This page isn't here</h1>
<p class="lead">${live ? "It may have moved. Try a search, or start from the home page." : "It may have moved. Try a search, or open Splashery."}</p></div>
<form class="search-page-form" id="nf-form" role="search" action="${live ? "search/" : "./"}" method="get">
<label for="q404">Search ${live ? "toys, tools and pages" : "toys"}</label>
<input id="q404" type="search" name="q" autocomplete="off" enterkeyhint="search" />
</form>
<p class="search-status" id="nf-status" role="status" aria-live="polite"></p>
<ul class="search-results" id="nf-results"></ul>
<p class="actions">${live ? '<a class="button primary" href="./">Home</a><a class="button" href="../">Open the Playground</a>' : '<a class="button primary" href="./">Open Splashery</a>'}</p>`; // prettier-ignore
}

function notFoundPreview() {
  return `<!doctype html>
<html lang="en" data-mode="preview" data-gallery="" data-index="site/search-index.json">
<head>
<meta charset="utf-8" />
<script>${rootBase(["site/assets/site.css"], ["site/assets/not-found.js"])}</script>
<script>${FORWARD_404}</script>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Page not found · Splashery</title>
<meta name="description" content="This page isn't here." />
<meta name="robots" content="noindex" />
<meta name="color-scheme" content="light dark" />
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#101010" />
<link rel="icon" href="${FAVICON}" />
<script>${EARLY}</script>
</head>
<body>
<a class="skip-link" href="#main">Skip to the page</a>
<header class="site-header">
<div class="bar">
<a class="brand" href="./" aria-label="Splashery home">${LOGO}<span>Splashery</span></a>
</div>
</header>
<main id="main" tabindex="-1">
${notFoundMain(false)}
</main>
<footer class="site-footer">
<p class="fine">${esc(SITE.tagline)}. Free, in your browser, with nothing to install; files you open stay on your device.</p>
</footer>
</body>
</html>
`;
}

const HOME_BASE = SITE.base.replace(/site\/$/, "");
function notFoundLive() {
  const page = { ...NOT_FOUND, scripts: ["not-found.js"] };
  const html = shell(page, notFoundMain(true), {
    up: "",
    url: `${SITE.origin}${HOME_BASE}404.html`,
    fixedBase: "root",
    htmlData: ' data-mode="live" data-gallery="playground/" data-index="search-index.json"',
  });
  // The forwarding script runs right after the base is set.
  const baseScript = `<script>${rootBase(["assets/site.css"], ["assets/site.js", "assets/not-found.js"])}</script>`; // prettier-ignore
  const withForward = html.replace(baseScript, `${baseScript}\n<script>${FORWARD_404}</script>`);
  if (withForward === html) throw new Error("The live 404 page has no base script to follow.");
  return liftHtml(withForward, 0).replaceAll(`${SITE.origin}${SITE.base}`, `${SITE.origin}${HOME_BASE}`); // prettier-ignore
}

// ---- Build ----------------------------------------------------------------------------------

const prettierConfig = (await prettier.resolveConfig(path.join(root, "site/index.html"))) || {};
async function pretty(file, text) {
  const parser = file.endsWith(".html")
    ? "html"
    : file.endsWith(".json") || file.endsWith(".webmanifest")
      ? "json"
      : file.endsWith(".js")
        ? "babel"
        : null;
  return parser ? prettier.format(text, { ...prettierConfig, parser }) : text;
}

const files = new Map(); // path under site/ -> contents
for (const page of PAGES) {
  const up = upTo(page.path);
  const url = `${SITE.origin}${SITE.base}${page.path}`;
  const main = await PAGE_TYPES[page.type](page, { up, url });
  files.set(`${page.path}index.html`, shell(page, main, { up, url }));
}
files.set(
  NOT_FOUND.file,
  shell(NOT_FOUND, PAGE_TYPES[NOT_FOUND.type](NOT_FOUND, { up: "" }), {
    up: "",
    url: `${SITE.origin}${SITE.base}${NOT_FOUND.file}`,
    fixedBase: true,
  }),
);
files.set("play/index.html", playPage());
const index = await searchEntries();
files.set("search-index.json", JSON.stringify(index));
// Every suggested search must find something on the public shelf.
for (const w of PAGES.find((p) => p.type === "search").suggest) {
  const hits = index.filter((e) => !e.l && `${e.w} ${fold(e.d)}`.includes(fold(w)));
  if (!hits.length) throw new Error(`The suggested search "${w}" finds nothing.`);
}
files.set("manifest.webmanifest", manifest());
files.set("sitemap.xml", sitemap());

// What the pages and the worker need from the hand-written files (assets/*.css, *.js).
const handWritten = fs
  .readdirSync(path.join(OUT, "assets"))
  .filter((f) => /\.(css|js)$/.test(f))
  .map((f) => `assets/${f}`);

// ---- The preview: site/ and the root 404 page -------------------------------------------------

async function buildPreview() {
  for (const [f, text] of files) files.set(f, await pretty(f, text));

  // The shell the service worker keeps from the first visit: every page, the
  // hand-written assets, the index and the icons. Its version changes whenever
  // any of them does, so a new build replaces the old shell.
  const precache = [
    "./",
    ...PAGES.filter((p) => p.path && p.precache !== false).map((p) => p.path),
    NOT_FOUND.file,
    "play/",
    "search-index.json",
    "manifest.webmanifest",
    ...handWritten,
    "../assets/app/icon-192.png",
    "../assets/app/icon-512.png",
  ];
  const hash = crypto.createHash("sha256");
  for (const f of [...files.keys()].sort()) hash.update(f).update(files.get(f));
  for (const f of handWritten) hash.update(f).update(fs.readFileSync(path.join(OUT, f)));
  hash.update(fs.readFileSync(path.join(root, "tools/site-sw.template.js")));
  const version = hash.digest("hex").slice(0, 12);
  files.set("sw.js", await pretty("sw.js", serviceWorker(version, precache)));

  // The files built from the toy list or the git history follow main: a lane that
  // adds a toy (or any merge) changes them, and the Operator's upkeep
  // (tools/upkeep.mjs) rebuilds them after each merge. --check reports them but
  // fails only on the rest: the shell, the hand-written pages and everything else
  // the build makes. A new page type that reads toys belongs in TOY_TYPES.
  const TOY_TYPES = new Set(["home", "shelves", "tools", "science", "learn", "about", "terms", "news", "markdown", "article", "embed", "toy"]); // prettier-ignore
  const followsMain = new Set([
    ...PAGES.filter((p) => TOY_TYPES.has(p.type)).map((p) => `${p.path}index.html`),
    "search-index.json",
    "sw.js",
  ]);
  let stale = 0;
  let staleShell = 0;
  // The root 404 page lives outside site/ (GitHub Pages serves only the root one).
  const rootFiles = new Map([["404.html", await pretty("404.html", notFoundPreview())]]);
  for (const [f, text] of rootFiles) {
    const old = fs.existsSync(path.join(root, f))
      ? fs.readFileSync(path.join(root, f), "utf8")
      : null;
    if (old === text) continue;
    stale++;
    if (CHECK) {
      staleShell++;
      console.log(`out of date: ${f}`);
    } else fs.writeFileSync(path.join(root, f), text);
  }
  for (const [f, text] of files) {
    const file = path.join(OUT, f);
    const old = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    if (old === text) continue;
    stale++;
    if (CHECK) {
      if (followsMain.has(f)) console.log(`follows main (rebuilt by the upkeep): site/${f}`);
      else {
        staleShell++;
        console.log(`out of date: site/${f}`);
      }
      continue;
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  }
  // A toy that leaves the list takes its page with it.
  for (const dir of fs.existsSync(path.join(OUT, "toys"))
    ? fs.readdirSync(path.join(OUT, "toys"))
    : []) {
    if (!fs.statSync(path.join(OUT, "toys", dir)).isDirectory() || toyPageDirs().has(dir)) continue;
    stale++;
    if (CHECK) console.log(`follows main (rebuilt by the upkeep): site/toys/${dir}/`);
    else fs.rmSync(path.join(OUT, "toys", dir), { recursive: true });
  }
  if (CHECK && staleShell) {
    console.log("Run: node tools/site-build.mjs");
    process.exit(1);
  }
  if (CHECK) {
    console.log(`site/ is current${stale ? ` apart from ${stale} file(s) that follow main` : ""}.`);
    process.exit(0);
  }
  console.log(
    `site/: ${files.size} files (${stale} changed), ${PAGES.length} pages, version ${version}`,
  );
}

// ---- The swapped layout (lane Site r4) -------------------------------------------------------
// The same pages with the site's home at the root and the Playground at playground/. Staged into
// .cache/front-door/ (the app's own files are linked, not copied) unless FRONT_DOOR is on, which
// writes it into the repo. See tools/site-front-door.mjs and docs/handoff/SiteR4.md.

// Top-level entries the staged tree doesn't need (or builds itself).
const NOT_STAGED = new Set([".git", ".cache", ".claude", ".grooph", "node_modules", "tests", "tools", "docs", "test-results", "playwright-report", "site", "assets", "index.html", "404.html", "sw.js", "sitemap.xml", "search-index.json", "manifest.webmanifest", "playground"]); // prettier-ignore

async function buildSwapped() {
  const writeInPlace = SWAP_OUT === root;
  const gallerySrc = fs.existsSync(path.join(root, "playground/index.html"))
    ? "playground/index.html"
    : "index.html";
  const assets = new Map();
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(dir, e.name), `${rel}/${e.name}`);
      else assets.set(`${rel}/${e.name}`, path.join(dir, e.name));
    }
  };
  walk(path.join(OUT, "assets"), "assets");

  const swSource = fs.readFileSync(path.join(root, "tools/site-sw-root.template.js"), "utf8");
  const retireSource = fs.readFileSync(path.join(root, "tools/site-sw-retire.template.js"), "utf8");
  const manifestSource = fs.existsSync(path.join(root, "manifest.webmanifest"))
    ? fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8")
    : files.get("manifest.webmanifest");
  const gallerySource = fs.readFileSync(path.join(root, gallerySrc), "utf8");

  // A first pass without the worker, to know the version (a hash of everything it caches).
  const precache = [
    "./",
    ...PAGES.filter((p) => p.path && p.precache !== false).map((p) => p.path),
    "404.html",
    "play/",
    "playground/",
    "search-index.json",
    "manifest.webmanifest",
    ...handWritten,
    "assets/app/icon-192.png",
    "assets/app/icon-512.png",
  ];
  const ctx = {
    origin: SITE.origin,
    siteBase: SITE.base,
    notFoundLive: notFoundLive(),
    gallerySource,
    rootManifestText: manifestSource,
    swSource,
    retireSource,
    version: "",
    precache,
  };
  const first = swapLayout({ files, assets, ctx });
  const hash = crypto.createHash("sha256");
  for (const f of [...first.text.keys()].filter((k) => !k.startsWith("site/") && k !== "sw.js").sort()) hash.update(f).update(first.text.get(f)); // prettier-ignore
  for (const f of handWritten) hash.update(f).update(fs.readFileSync(path.join(OUT, f)));
  hash.update(swSource);
  ctx.version = hash.digest("hex").slice(0, 12);
  const layout = swapLayout({ files, assets, ctx });

  if (writeInPlace) for (const [f, t] of layout.text) layout.text.set(f, await pretty(f, t));

  if (CHECK) {
    let n = 0;
    for (const [f, t] of layout.text) {
      const old = fs.existsSync(path.join(SWAP_OUT, f)) ? fs.readFileSync(path.join(SWAP_OUT, f), "utf8") : null; // prettier-ignore
      if (old !== t) {
        n++;
        console.log(`out of date: ${f}`);
      }
    }
    console.log(n ? `${n} file(s) out of date. Run: node tools/site-build.mjs` : "The swapped layout is current."); // prettier-ignore
    process.exit(n ? 1 : 0);
  }

  if (!writeInPlace) {
    fs.rmSync(SWAP_OUT, { recursive: true, force: true });
    fs.mkdirSync(path.join(SWAP_OUT, "assets"), { recursive: true });
    for (const e of fs.readdirSync(root)) {
      if (NOT_STAGED.has(e)) continue;
      fs.symlinkSync(path.join(root, e), path.join(SWAP_OUT, e));
    }
    for (const e of fs.readdirSync(path.join(root, "assets"))) {
      fs.symlinkSync(path.join(root, "assets", e), path.join(SWAP_OUT, "assets", e));
    }
    // The few files other pages still point at under site/.
    for (const f of ["splashery-catalog.pdf"]) {
      if (fs.existsSync(path.join(OUT, f))) {
        fs.mkdirSync(path.join(SWAP_OUT, "site"), { recursive: true });
        fs.symlinkSync(path.join(OUT, f), path.join(SWAP_OUT, "site", f));
      }
    }
  }
  for (const [f, t] of layout.text) {
    const file = path.join(SWAP_OUT, f);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.rmSync(file, { force: true });
    fs.writeFileSync(file, t);
  }
  for (const [f, src] of layout.copy) {
    const file = path.join(SWAP_OUT, f);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.rmSync(file, { force: true });
    if (writeInPlace) fs.copyFileSync(src, file);
    else fs.symlinkSync(src, file);
  }
  if (writeInPlace) {
    // The preview's own files leave site/ (git sees them as moved): everything that isn't a
    // redirect, the stand-in worker or a file other pages still use.
    const keep = new Set([...layout.text.keys(), ...layout.copy.keys(), ...KEEP_ASSETS.map((f) => `site/assets/${f}`), "site/splashery-catalog.pdf"]); // prettier-ignore
    const prune = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, e.name);
        const rel = path.relative(root, abs).split(path.sep).join("/");
        if (e.isDirectory()) {
          prune(abs);
          if (!fs.readdirSync(abs).length) fs.rmdirSync(abs);
        } else if (!keep.has(rel)) fs.rmSync(abs);
      }
    };
    prune(path.join(root, "site"));
  }
  console.log(
    `${writeInPlace ? "the repo" : path.relative(root, SWAP_OUT)}: swapped layout, ${layout.text.size} generated files, version ${ctx.version}`, // prettier-ignore
  );
}

if (SWAPPED) await buildSwapped();
else await buildPreview();

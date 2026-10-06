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
import { execSync } from "node:child_process";
import * as prettier from "prettier";
import { TOYS, CATEGORIES, holdsStill } from "../src/toys.js";
import { TOY_HELP, defaultHowTo } from "../src/toy-help.js";
import { RIGS } from "../src/rigs.js";
import { SITE, MENU, PAGES, NOT_FOUND, HOME_TOY } from "./site-pages.mjs";
import { toyPage, toyPath, toyPageDirs } from "./site-toy-pages.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(root, "site");
const CHECK = process.argv.includes("--check");

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

// A link that opens a shelf toy in the gallery: a version 3 scene in the plain
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

function shell(page, main, { up, url, fixedBase = false }) {
  const title = page.title.includes("Splashery") ? page.title : `${page.title} · Splashery`;
  const desc = plain(page.description);
  const nav = MENU.map((m) => {
    const current = m.id === page.nav ? ' aria-current="page"' : "";
    return `<li><a href="${up}${m.href}"${current}>${esc(m.label)}</a></li>`;
  }).join("");
  // The 404 page can be served at any depth, so its links resolve from site/ itself.
  const base = fixedBase
    ? `<script>(function(){var p=location.pathname,i=p.indexOf("/site/");var b=document.createElement("base");b.href=i<0?"/":p.slice(0,i+6);document.head.appendChild(b)})();</script>` // prettier-ignore
    : "";
  return `<!doctype html>
<html lang="en" data-root="${up || "./"}">
<head>
${base}
<meta charset="utf-8" />
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
<link rel="manifest" href="${up}manifest.webmanifest" />
<link rel="icon" href="${FAVICON}" />
<link rel="apple-touch-icon" href="${up}../assets/app/icon-180.png" />
<script>${EARLY}</script>
<link rel="stylesheet" href="${up}assets/site.css" />
<script type="module" src="${up}assets/site.js"></script>
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
<main id="main" tabindex="-1">
${main}
</main>
<footer class="site-footer">
<div class="footer-grid">
<div class="footer-brand"><a class="brand" href="${up}">${LOGO}<span>Splashery</span></a><p>${esc(SITE.tagline)}. Free, in your browser, with nothing to install; files you open stay on your device.</p></div>
<nav aria-label="Explore"><h2>Explore</h2><ul>${MENU.map((m) => `<li><a href="${up}${m.href}">${esc(m.label)}</a></li>`).join("")}</ul></nav>
<nav aria-label="More"><h2>More</h2><ul><li><a href="${up}../">The gallery</a></li><li><a href="${up}search/">Search</a></li><li><a href="${up}../manual/">The Tinkerer's Manual</a></li><li><a href="${SITE.github}">Source on GitHub</a></li><li><a href="${SITE.github}/blob/main/CREDITS.md">Credits</a></li></ul></nav>
</div>
<p class="fine">Code under the MIT license; each toy's assets keep their own licenses. Built on the PlayCanvas engine.${SITE.preview ? ` This is a preview of Splashery's new site; the toys live in <a href="${up}../">the gallery</a>.` : ""}</p>
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
  return cats
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
}

function shelfIndex(ids) {
  const cats = (ids === "all" ? CATEGORIES.map((c) => c.id) : ids).filter((id) =>
    publicToys.some((t) => t.category === id),
  );
  if (cats.length < 4) return "";
  return `<nav class="shelf-index" aria-label="Shelves"><ul>${cats
    .map((id) => {
      const labs = publicToys.filter((t) => t.category === id).every((t) => t.labs);
      return `<li${labs ? " data-labs" : ""}><a href="#shelf-${id}">${esc(shelfName(id))}</a></li>`;
    })
    .join("")}</ul></nav>`;
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
// The tools' small drawings, and the gallery's keys for the first five.
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
<p class="actions"><a class="button primary" href="${up}../">Open the gallery${arrow}</a><a class="button" href="${up}${galleryHref(toy)}">Play with the ${esc(toy.label.toLowerCase())}</a></p>
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
<p class="actions"><a class="button primary" href="${up}../">Open the gallery${arrow}</a></p>
</section>`;
  },

  shelves(page, { up }) {
    const n = countToys(page.shelves);
    // The catalog PDF (lane Toy pages: tools/tpg-catalog.mjs), labs only for now.
    const catalog = page.catalog ? `<a class="button" data-labs href="${up}${page.catalog.file}" download>Download the catalog <span class="note">(PDF, ${(fs.statSync(path.join(OUT, page.catalog.file)).size / 1e6).toFixed(1)} MB)</span></a>` : ""; // prettier-ignore
    return `${intro(page, `<p class="actions"><a class="button primary" href="${up}../">Open the gallery${arrow}</a>${catalog}</p>`, `${n} toys`)}
${shelfIndex(page.shelves)}
${shelfSections(page.shelves, up)}`;
  },

  tools(page, { up }) {
    const groups = page.groups
      .map(
        (g) => `<section class="tool-group" aria-labelledby="h-${fold(g.title).replace(/\W+/g, "-")}">
<h2 id="h-${fold(g.title).replace(/\W+/g, "-")}">${esc(g.title)}</h2>
<dl class="tool-list" style="--cols: ${g.items.length % 3 === 0 ? 3 : 4}">${g.items.map(([name, text]) => { const k = slug(name); const icon = TOOL_ICONS[k] ? `<svg class="tool-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">${TOOL_ICONS[k]}</svg>` : ""; const key = TOOL_KEYS[k] ? ` <kbd title="Key ${TOOL_KEYS[k]} in the gallery">${TOOL_KEYS[k]}</kbd>` : ""; return `<div id="tool-${k}">${icon}<dt>${esc(name)}${key}</dt><dd>${esc(text)}</dd></div>`; }).join("")}</dl>
</section>`, // prettier-ignore
      )
      .join("\n");
    return `${intro(page)}
${groups}
<section aria-labelledby="h-own"${page.shelves.every((id) => publicToys.filter((t) => t.category === id).every((t) => t.labs)) ? " data-labs" : ""}><h2 id="h-own">${esc(page.shelvesTitle)}</h2>
${shelfSections(page.shelves, up, 3)}
</section>`;
  },

  links(page, { up }) {
    const href = (h) => (/^https?:/.test(h) ? h : up + h);
    return `${intro(page)}
<ul class="link-list">${page.links.map((l) => `<li><a href="${esc(href(l.href))}">${esc(l.label)}</a><p>${esc(l.text)}</p></li>`).join("")}</ul>`; // prettier-ignore
  },

  changelog(page) {
    const items = changelog(page.count);
    if (!items.length) return `${intro(page)}<p>Nothing to show yet.</p>`;
    const byDate = new Map();
    for (const it of items) byDate.set(it.date, [...(byDate.get(it.date) || []), it]);
    const dates = [...byDate]
      .map(
        ([date, list]) => `<section class="day"><h2><time datetime="${date}">${esc(longDate(date))}</time></h2>
<ul>${list.map((it) => `<li><a href="${SITE.github}/pull/${it.pr}">${esc(it.title)}</a></li>`).join("")}</ul></section>`, // prettier-ignore
      )
      .join("\n");
    return `${intro(page)}
${dates}
<p class="note">The full history is on <a href="${SITE.github}/pulls?q=is%3Apr+is%3Amerged">GitHub</a>.</p>`;
  },

  about(page) {
    const credited = publicToys.filter((t) => t.credit && !t.labs);
    const rows = credited
      .map((t) => {
        const c = t.credit;
        const work = c.source ? `<a href="${esc(c.source)}">${esc(c.title || t.label)}</a>` : esc(c.title || t.label); // prettier-ignore
        const lic = c.licenseUrl ? `<a href="${esc(c.licenseUrl)}">${esc(c.license)}</a>` : esc(c.license || ""); // prettier-ignore
        return `<li><b>${esc(t.label)}</b>: ${work}, by ${esc(c.author || "unknown")} (${lic})</li>`;
      })
      .join("");
    return `${intro(page)}
<section aria-labelledby="h-what"><h2 id="h-what">What it is</h2>
<p>Every toy is drawn with 3D Gaussian splats: soft, colored blobs that together make a scan of a real thing or a shape built from a recipe. You can poke, paint, blow on, drop and dissolve them, then share a toy as a link, an embed, a GIF or a video.</p>
<p>Splashery is made by Ryan Kamp, with Claude as the builder. It is plain web pages and code: nothing to install, no account, no ads.</p>
</section>
<section aria-labelledby="h-privacy"><h2 id="h-privacy">Privacy</h2>
<p>Files you open stay on your device; nothing is uploaded to us or anyone else. Splashery has no accounts, no tracking and no cookies. A toy asks for the microphone, the camera or your location only when you tap to start it, and records or stores nothing unless you save a file yourself.</p>
</section>
<section aria-labelledby="h-terms"><h2 id="h-terms">Terms of use</h2>
<ul>
<li>Splashery is free and runs in your browser. Files you open stay on your device; nothing is uploaded to us or anyone else.</li>
<li>You are responsible for what you open, show, link to or share with Splashery. Only use files and web addresses you have the right to use. Splashery doesn't inspect, filter or censor what you open, and isn't responsible for how people use it.</li>
<li>A link you share carries your settings and, if you choose, the web address of media hosted elsewhere; whoever hosts that media is responsible for it.</li>
<li>Splashery's code is MIT licensed; each toy's assets keep their own licenses (see the credits). It is provided as is, without warranty.</li>
</ul>
</section>
<section aria-labelledby="h-credits"><h2 id="h-credits">Credits</h2>
<p>Every asset is public domain or under a Creative Commons license that allows it here. The captured toys on the shelf:</p>
<ul class="credits">${rows}</ul>
<p>Every other asset, sound and library is credited in <a href="${SITE.github}/blob/main/CREDITS.md">CREDITS.md</a> and <a href="${SITE.github}/blob/main/LICENSES.md">LICENSES.md</a>, and each toy's credit shows in the gallery's About tab.</p>
</section>`;
  },

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
<p class="actions"><a class="button primary" href="./">Home</a><a class="button" href="../">Open the gallery</a></p>`; // prettier-ignore
  },
};

// ---- What's new: merged pull requests from the git history -------------------------------

function changelog(count) {
  let raw = "";
  try {
    raw = execSync('git log --merges --format="%cs%x1f%s%x1f%b%x1e" -n 600 HEAD', {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return [];
  }
  const seen = new Set();
  const out = [];
  for (const rec of raw.split("\x1e")) {
    const [date, subject, body] = rec.trim().split("\x1f");
    const m = /^Merge pull request #(\d+) from /.exec(subject || "");
    if (!m || seen.has(m[1])) continue;
    const title = (body || "").split("\n").map((l) => l.trim()).find(Boolean) || ""; // prettier-ignore
    // The Operator's own housekeeping isn't news.
    if (!title || /^Ops:/.test(title)) continue;
    seen.add(m[1]);
    out.push({ date, pr: Number(m[1]), title: title.replace(/^Phase [^:]+:\s*/, "") });
  }
  out.sort((a, b) => b.date.localeCompare(a.date) || b.pr - a.pr);
  return out.slice(0, count).map((it) => ({ ...it, title: it.title[0].toUpperCase() + it.title.slice(1) })); // prettier-ignore
}

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
    if (p.type === "search" || p.type === "toy") continue;
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
  return src.replace(/(href|src)="\.\.\//g, '$1="../../').replace(
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

for (const [f, text] of files) files.set(f, await pretty(f, text));

// The shell the service worker keeps from the first visit: every page, the
// hand-written assets, the index and the icons. Its version changes whenever
// any of them does, so a new build replaces the old shell.
const handWritten = fs
  .readdirSync(path.join(OUT, "assets"))
  .filter((f) => /\.(css|js)$/.test(f))
  .map((f) => `assets/${f}`);
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
const TOY_TYPES = new Set(["home", "shelves", "tools", "about", "changelog", "toy"]);
const followsMain = new Set([
  ...PAGES.filter((p) => TOY_TYPES.has(p.type)).map((p) => `${p.path}index.html`),
  "search-index.json",
  "sw.js",
]);
let stale = 0;
let staleShell = 0;
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

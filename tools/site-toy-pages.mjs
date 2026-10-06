// A page for every toy (lane Toy pages): the page entries (one per toy, at
// site/toys/<id>/) and the "toy" page type that tools/site-build.mjs renders
// them with. Each page has the live toy (the site's player, site/play/), its
// how-to line and About text (src/toy-help.js), its tap and sound
// (tools/toy-plan.json), its sources, credits and license notices (src/toys.js,
// a kit recipe's own credits, tools/assets.json, tools/models.json), "Is it
// right?" from docs/evidence/<id>.json when there is one, related toys, and
// share and embed snippets. Labs toys get a page too, shown only with the labs
// switch on, as the gallery does.
//
// Everything here reads the toy list, so the pages follow main: the Operator's
// upkeep rebuilds them after each merge ("toy" is in TOY_TYPES).

import fs from "node:fs";
import path from "node:path";
import { TOYS, holdsStill } from "../src/toys.js";
import { TOY_HELP, toyAbilities } from "../src/toy-help.js";
import { RIGS } from "../src/rigs.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const readJSON = (f) => JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));
const PLAN = readJSON("tools/toy-plan.json").toys;
const ASSETS = readJSON("tools/assets.json");
const MODELS = readJSON("tools/models.json").models;
const EVIDENCE_DIR = path.join(root, "docs/evidence");

// Where the live app is, for the embed snippets people paste into their own pages.
const APP = "https://ryanjosephkamp.github.io/splashery/";

export const toyPath = (t) => `toys/${t.id}/`;

// ---- The page entries (pushed onto PAGES in tools/site-pages.mjs) -----------------------

export function toyPageEntries() {
  return TOYS.filter((t) => t.category).map((t) => ({
    path: toyPath(t),
    type: "toy",
    nav: "toys",
    toy: t.id,
    title: t.label,
    description: `${t.label}, a Splashery toy made of 3D Gaussian splats: ${firstSentence(TOY_HELP[t.id]?.howTo || "tap it, turn it, share it.")}`, // prettier-ignore
    image: `../assets/toys/${t.id}/thumb.webp`,
    imageSize: 256,
    imageAlt: `${t.label}, made of soft 3D splats`,
    // 390 pages: the service worker keeps each one when it is visited, not on install.
    precache: false,
    // Labs toys stay out of the sitemap, as they stay off the public shelf.
    sitemap: !t.labs,
  }));
}

// Up to the first full stop that ends a sentence (not the one in "3.45 s" or "move.mp3").
const firstSentence = (s) => (/^[\s\S]*?[.!?](?=\s+[A-Z"“(]|\s*$)/.exec(s)?.[0] || s).trim();

// ---- Words: tap, sound, credits ---------------------------------------------------------

// The plan's sound line, without the lane notes it sometimes carries
// ("(Sound C, October 2, 2026)", "E1:").
function soundLine(s) {
  if (!s) return "";
  const clean = s
    .replace(/\s*\([^()]*\b(19|20)\d\d\b[^()]*\)/g, "")
    .replace(/\s*\((?:lane|Sound [A-Z]|[A-Z]\d)[^()]*\)/g, "")
    .replace(/^[A-Z]\d[a-z]?:\s*/, "")
    .trim();
  return firstSentence(clean);
}

const LICENSE_URLS = [
  [/^CC0/i, "https://creativecommons.org/publicdomain/zero/1.0/"],
  [/public domain/i, "https://creativecommons.org/publicdomain/mark/1.0/"],
];
function licenseUrl(license) {
  for (const [re, url] of LICENSE_URLS) if (re.test(license)) return url;
  const m = /^CC (BY(?:-[A-Z]{2})*) (\d\.\d)/i.exec(license || "");
  return m ? `https://creativecommons.org/licenses/${m[1].toLowerCase()}/${m[2]}/` : "";
}

// Every credit for one toy: its scan, its 3D model, its recipe's data files,
// its samples and its recorded sounds. { label, title, author, source, license,
// licenseUrl, changes }, one per source page.
export async function toyCredits(t, recipe) {
  const out = [];
  const add = (c) => {
    if (!c || !c.source || out.some((o) => o.source === c.source)) return;
    out.push({ ...c, licenseUrl: c.licenseUrl || licenseUrl(c.license) });
  };
  if (t.credit) add({ label: "Scan", ...t.credit });
  const model = MODELS.find((m) => m.id === t.id);
  if (model) add({ label: "3D model", title: model.name, author: model.author, source: model.page, license: model.license }); // prettier-ignore
  for (const c of recipe?.credits || []) add({ ...c, label: c.label || "Data" });
  for (const key of Object.keys(ASSETS)) {
    if (!/Samples$/.test(key) || key === "soundSamples") continue;
    for (const s of ASSETS[key]) {
      if (s.toy === t.id) add({ label: "Sample", title: s.name, author: s.author, source: s.page, license: s.license }); // prettier-ignore
    }
  }
  for (const s of ASSETS.soundSamples || []) {
    if ((s.toys || []).includes(t.id)) add({ label: "Sound", title: s.name, author: s.author, source: s.page, license: s.license }); // prettier-ignore
  }
  return out;
}

// What a license asks of whoever reuses the work, shown beside it (CLAUDE.md, "Ground rules").
export function licenseNotices(license) {
  const l = String(license || "");
  const out = [];
  if (/\bNC\b|-NC/.test(l))
    out.push("NonCommercial: it may be shared and adapted, but not for money.");
  if (/\bSA\b|-SA/.test(l))
    out.push("ShareAlike: anything made from it, including this toy's splats, keeps the same license."); // prettier-ignore
  if (/\bND\b|-ND/.test(l)) out.push("NoDerivatives."); // never allowed; the check flags it
  return out;
}

// ---- Evidence ----------------------------------------------------------------------------

export function readEvidence(id, dir = EVIDENCE_DIR) {
  const file = path.join(dir, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const VERDICTS = {
  correct: "Correct",
  close: "Close",
  simplified: "Simplified",
  wrong: "Being fixed",
  unverified: "Not yet checked",
};

export function evidenceSection(ev, esc) {
  if (!ev) return "";
  const when = ev.checked ? ` <span class="note">Checked ${esc(longDate(ev.checked))}.</span>` : "";
  const claims = (ev.claims || [])
    .map((c) => {
      const v = VERDICTS[c.verdict] ? c.verdict : "unverified";
      const sources = (c.sources || [])
        .map(
          (s) =>
            `<li><a href="${esc(s.url)}">${esc(s.title)}</a>${s.publisher ? `, ${esc(s.publisher)}` : ""}${s.says ? `: <q>${esc(s.says)}</q>` : ""}</li>`,
        )
        .join(""); // prettier-ignore
      return `<li class="claim"><p class="claim-head"><span class="verdict verdict-${v}">${VERDICTS[v]}</span> ${esc(c.claim)}</p>${c.how ? `<p>${esc(c.how)}</p>` : ""}${c.note ? `<p class="note">${esc(c.note)}</p>` : ""}${sources ? `<ul class="sources">${sources}</ul>` : ""}</li>`; // prettier-ignore
    })
    .join("");
  const simplified = (ev.simplified || []).length
    ? `<h3>Where it simplifies</h3><ul>${ev.simplified.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`
    : "";
  const fixes = (ev.fixes || []).length
    ? `<h3>What is being fixed</h3><ul>${ev.fixes.map((f) => `<li>${esc(f.what)}${f.status ? ` <span class="note">(${esc(f.status)})</span>` : ""}</li>`).join("")}</ul>` // prettier-ignore
    : "";
  return `<section class="toy-section evidence" aria-labelledby="h-right"><h2 id="h-right">Is it right?</h2>
<p>${esc(ev.summary || "")}${when}</p>
${claims ? `<ol class="claims">${claims}</ol>` : ""}
${simplified}${fixes}
</section>`;
}

function longDate(iso) {
  const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(iso || "");
  if (!m) return iso;
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]; // prettier-ignore
  return `${months[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

// ---- Related toys: the same shelf first, then shared tags --------------------------------

const words = (t) => new Set(String(t.tags || "").toLowerCase().split(/\s+/).filter((w) => w.length > 2)); // prettier-ignore
const COMMON = new Set(["captured", "photo", "real", "photoreal", "scan", "toy", "kit"]);

export function relatedToys(t, n = 8) {
  const mine = words(t);
  return TOYS.filter((o) => o.category && o.id !== t.id)
    .map((o) => {
      let score = o.category === t.category ? 3 : 0;
      for (const w of words(o)) if (mine.has(w) && !COMMON.has(w)) score += 1;
      // A public toy's page points at public toys first.
      if (!t.labs && o.labs) score -= 2;
      return { o, score };
    })
    .filter((x) => x.score > 1)
    .sort((a, b) => b.score - a.score || a.o.label.localeCompare(b.o.label))
    .slice(0, n)
    .map((x) => x.o);
}

// ---- The page type ---------------------------------------------------------------------------

const packs = {};
export async function recipeFor(t) {
  if (RIGS[t.id]) return RIGS[t.id];
  if (t.kind !== "kit" || !t.pack) return null;
  try {
    packs[t.pack] ??= (await import(`../src/packs/${t.pack}.js`)).RECIPES || {};
    return packs[t.pack][t.id] || null;
  } catch {
    return null;
  }
}

const COPY = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="8.5" y="8.5" width="11" height="11" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M15.5 5.5v-.5a1.5 1.5 0 0 0-1.5-1.5H6A2.5 2.5 0 0 0 3.5 6v8A1.5 1.5 0 0 0 5 15.5h.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`; // prettier-ignore

// (page, ctx) => the HTML inside <main>. ctx carries the build's helpers.
export async function toyPage(page, ctx) {
  const { up, esc, toyCard, galleryHref, thumbHref, shelfName, howTo, arrow, url } = ctx;
  const t = TOYS.find((x) => x.id === page.toy);
  const recipe = await recipeFor(t);
  const help = TOY_HELP[t.id] || {};
  const how = await howTo(t);
  const plan = PLAN[t.id] || {};
  const still = holdsStill(t);
  const thumb = thumbHref(t);
  const shelf = shelfName(t.category);

  // The live toy, from the site's player (inside the service worker's scope).
  const q = `toy=${encodeURIComponent(t.id)}${still ? "&turntable=off" : ""}`;
  const play = `${up}play/?${q}`;
  // A labs toy's player starts only once the labs switch is on (toy-page.js).
  const frame = t.labs
    ? `<iframe data-src="${play}" title="${esc(t.label)}, live: drag to turn it" allow="fullscreen"></iframe>`
    : `<iframe src="${play}" title="${esc(t.label)}, live: drag to turn it" loading="eager" allow="fullscreen"></iframe>`; // prettier-ignore

  // What it does: the tap and its sound, in a sentence each.
  const tap = plan.effect ? firstSentence(plan.effect) : toyAbilities({ id: t.id, kind: t.kind, label: t.label, recipe })[0]?.[1] || "It hops."; // prettier-ignore
  const sound = soundLine(plan.sound);
  const does = `<dl class="does"><div><dt>Tap</dt><dd>${esc(tap)}</dd></div>${sound ? `<div><dt>Sound</dt><dd>${esc(sound)}</dd></div>` : ""}</dl>`; // prettier-ignore

  const about = String(help.about || "")
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join("");

  // Sources, credits and license notices.
  const credits = await toyCredits(t, recipe);
  const creditItems = credits
    .map((c) => {
      const lic = c.licenseUrl ? `<a href="${esc(c.licenseUrl)}">${esc(c.license)}</a>` : esc(c.license || ""); // prettier-ignore
      const notices = licenseNotices(c.license).map((n) => `<span class="license-notice">${esc(n)}</span>`).join(""); // prettier-ignore
      return `<li><b>${esc(c.label)}</b>: <a href="${esc(c.source)}">${esc(c.title || t.label)}</a>${c.author ? ` by ${esc(c.author)}` : ""}, ${lic}.${c.changes ? ` ${esc(c.changes)}` : ""}${notices}</li>`; // prettier-ignore
    })
    .join("");
  const recipeFile = t.kind === "kit" && t.pack ? `src/packs/${t.pack}.js` : RIGS[t.id] ? "src/rigs.js" : t.kind === "procedural" ? "src/generators.js" : ""; // prettier-ignore
  const made = t.kind === "captured"
    ? "A real object, captured from photos and drawn with 3D Gaussian splats."
    : credits.length
      ? "Built in your browser from a recipe, with the files credited below."
      : "Built in your browser from a recipe and a seed: nothing in it comes from outside files."; // prettier-ignore
  const recipeLink = recipeFile ? ` Its recipe is in <a href="https://github.com/ryanjosephkamp/splashery/blob/main/${recipeFile}"><code>${recipeFile}</code></a>.` : ""; // prettier-ignore
  const creditsSection = `<section class="toy-section" aria-labelledby="h-credits"><h2 id="h-credits">Sources and credits</h2>
<p>${made}${recipeLink}</p>
${creditItems ? `<ul class="toy-credits">${creditItems}</ul>` : ""}
<p class="note">Splashery's code is under the MIT license; each asset above keeps its own license. Every credit is also in <a href="https://github.com/ryanjosephkamp/splashery/blob/main/CREDITS.md">CREDITS.md</a>.</p>
</section>`;

  // Share and embed.
  const embedSrc = `${APP}embed/?${q}`;
  const iframe = `<iframe src="${embedSrc}" title="Splashery: ${esc(t.label)}" loading="lazy" style="width:100%;max-width:600px;aspect-ratio:4/3;border:0;border-radius:12px"></iframe>`; // prettier-ignore
  const element = `<script type="module" src="${APP}src/element.js"></script>\n<splashery-toy toy="${esc(t.id)}"${still ? ' turntable="off"' : ""}></splashery-toy>`; // prettier-ignore
  const snippet = (id, label, text) =>
    `<div class="snippet"><label for="${id}">${label}</label><textarea id="${id}" readonly rows="${Math.min(6, Math.max(text.split("\n").length, Math.ceil(text.length / 64)))}" spellcheck="false">${esc(text)}</textarea><button type="button" class="copy" data-copy="${id}">${COPY}<span>Copy</span></button></div>`; // prettier-ignore
  const share = `<section class="toy-section" aria-labelledby="h-share"><h2 id="h-share">Share and embed</h2>
${snippet("snip-link", "A link to this page", url)}
${snippet("snip-iframe", "Put it on your page (an iframe, works anywhere)", iframe)}
${snippet("snip-element", "Or with one script tag (the &lt;splashery-toy&gt; element)", element)}
<p class="note">Embeds are silent and turn slowly when idle. Every option is in the <a href="https://github.com/ryanjosephkamp/splashery#embedding">embed guide</a>.</p>
</section>`;

  const related = relatedToys(t);
  const relatedSection = related.length
    ? `<section class="toy-section" aria-labelledby="h-related"><div class="band-head"><h2 id="h-related">Related toys</h2><a href="${up}toys/#shelf-${t.category}">The ${esc(shelf)} shelf${arrow}</a></div>
<ul class="toy-grid">${related.map((o) => toyCard(o, up)).join("")}</ul></section>`
    : "";

  const labsNote = t.labs
    ? `<div class="labs-off" data-labs-off><p class="eyebrow">In the labs</p><h1>${esc(t.label)}</h1><p class="lead">This toy is still in the labs, so it shows only with the labs switch on.</p><p class="actions"><a class="button primary" href="./?labs=1">Turn the labs on</a><a class="button" href="${up}toys/">Every toy</a></p></div>`
    : ""; // prettier-ignore

  return `<link rel="stylesheet" href="${up}assets/toy-page.css" />
${labsNote}
<article class="toy-page"${t.labs ? " data-labs" : ""}>
<nav class="crumbs" aria-label="Breadcrumb"><a href="${up}toys/">Toys</a> <span aria-hidden="true">›</span> <a href="${up}toys/#shelf-${t.category}">${esc(shelf)}</a></nav>
<div class="toy-hero">
<div class="toy-head">
<h1>${esc(t.label)}${t.labs ? ' <span class="badge">labs</span>' : ""}</h1>
<p class="lead how-to">${esc(how)}</p>
${does}
<p class="actions"><a class="button primary" href="${up}${galleryHref(t)}">Open in the gallery${arrow}</a><a class="button" href="#h-share">Share or embed</a></p>
</div>
<figure class="hero-toy toy-stage">
<div class="stage">
${thumb ? `<span class="poster" aria-hidden="true" style="background-image: url('${up}${thumb}')"></span>` : ""}
${frame}
</div>
<figcaption>${still ? "Drag to look around it; tap to play." : "Drag to turn it; tap to play."}</figcaption>
</figure>
</div>
${about ? `<section class="toy-section" aria-labelledby="h-about"><h2 id="h-about">About this toy</h2>${about}</section>` : ""}
${evidenceSection(readEvidence(t.id), esc)}
${creditsSection}
${share}
${relatedSection}
</article>
<script type="module" src="${up}assets/toy-page.js"></script>`;
}

// The folders under site/toys/ that the build writes (to remove a removed toy's page).
export const toyPageDirs = () => new Set(TOYS.filter((t) => t.category).map((t) => t.id));

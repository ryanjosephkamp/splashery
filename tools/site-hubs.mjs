// The preview site's hubs and long pages (lane Site pages): Tools, Science, Learn,
// About, Credits, Terms, Privacy, What's new, the notebook and the embed guide.
// tools/site-build.mjs registers them with `...hubTypes(helpers)`; each is a
// function (page, { up }) => the HTML inside <main>. Words and data for the pages
// are in tools/site-pages.mjs; the curated news is tools/site-news.json.

import fs from "node:fs";
import path from "node:path";
import { mdToHtml, mdSlug } from "./site-md.mjs";

const read = (root, file) => fs.readFileSync(path.join(root, file), "utf8");

// Small line drawings (24 by 24, currentColor) for the hubs' headings.
const HUB_ICONS = {
  make: '<path d="M12 4v16M4 12h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/>', // prettier-ignore
  files: '<path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 3.5V8h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>', // prettier-ignore
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M4 12h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>', // prettier-ignore
  qr: '<rect x="4" y="4" width="6" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="14" y="4" width="6" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="4" y="14" width="6" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M14 14h2.5v2.5H14zM18 18h2v2h-2zM17.5 14H20" stroke="currentColor" stroke-width="1.8"/>', // prettier-ignore
  sound: '<path d="M4 10v4h3.5L12 18V6L7.5 10z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>', // prettier-ignore
  book: '<path d="M5 4.5h6.5a1 1 0 0 1 1 1V20a2 2 0 0 0-2-2H5zM19 4.5h-6.5v15.5a2 2 0 0 1 2-2H19z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>', // prettier-ignore
  splat: '<ellipse cx="12" cy="12" rx="8" ry="5.5" transform="rotate(-25 12 12)" fill="none" stroke="currentColor" stroke-width="1.8"/><ellipse cx="12" cy="12" rx="4" ry="2.7" transform="rotate(-25 12 12)" fill="currentColor" opacity=".45"/>', // prettier-ignore
  notebook: '<rect x="5" y="3.5" width="14" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 8h6M9 12h6M9 16h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>', // prettier-ignore
  made: '<path d="M14.5 5.5a4 4 0 0 0-5 5L4 16l4 4 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>', // prettier-ignore
  share: '<circle cx="6" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="18" cy="6" r="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="18" cy="18" r="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6" stroke="currentColor" stroke-width="1.8"/>', // prettier-ignore
  data: '<ellipse cx="12" cy="6.5" rx="7" ry="2.8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 6.5v11c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-11M5 12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8" fill="none" stroke="currentColor" stroke-width="1.8"/>', // prettier-ignore
};
const hubIcon = (id, size = 28) =>
  `<svg class="hub-icon" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${HUB_ICONS[id] || HUB_ICONS.splat}</svg>`;

// ---- The three drawings in "How 3D Gaussian splats work" -----------------------------------

let figureNo = 0;
// A deterministic pseudo-random sequence, so the build gives the same drawing every time.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function figureSplat() {
  const id = `g${++figureNo}`;
  return `<svg viewBox="0 0 440 220" role="img" aria-labelledby="${id}-t" class="figure-svg">
<title id="${id}-t">One splat: a soft, colored, see-through ellipsoid with a center, a size in each direction and a tilt</title>
<defs><radialGradient id="${id}-g"><stop offset="0" stop-color="#ff5fa2" stop-opacity="0.95"/><stop offset="0.55" stop-color="#ff5fa2" stop-opacity="0.55"/><stop offset="1" stop-color="#ff5fa2" stop-opacity="0"/></radialGradient></defs>
<g transform="translate(150 110) rotate(-24)"><ellipse rx="100" ry="52" fill="url(#${id}-g)"/><path d="M-100 0H100M0 -52V52" stroke="currentColor" stroke-width="1.2" stroke-dasharray="4 4" opacity=".55"/><circle r="3.5" fill="currentColor"/></g>
<g class="fig-note" fill="currentColor" font-size="12.5"><path d="M153 110 250 60" stroke="currentColor" stroke-width="1.2" fill="none"/><text x="252" y="58">center: where it sits</text><path d="M222 140 252 160" stroke="currentColor" stroke-width="1.2" fill="none"/><text x="204" y="176">long one way, short the other</text><path d="M62 82 40 44" stroke="currentColor" stroke-width="1.2" fill="none"/><text x="10" y="34">tilt, color, see-through</text></g>
</svg>`; // prettier-ignore
}

function figureCrowd() {
  const id = `g${++figureNo}`;
  const r = rng(7);
  const blobs = [];
  for (let i = 0; i < 150; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r());
    // A heart-ish berry: wider at the top, a point at the bottom.
    const x = Math.cos(a) * d * 62;
    const y = Math.sin(a) * d * 72 + (Math.sin(a) > 0 ? d * 14 : 0) * 0 + 4;
    const shrink = 1 - Math.max(0, y - 20) / 110;
    const cx = 130 + x * shrink;
    const cy = 112 + y;
    const rx = 8 + r() * 8;
    const ry = 5 + r() * 6;
    const rot = Math.round(r() * 180);
    const mix = r();
    const col = mix > 0.9 ? "#ffd166" : mix > 0.45 ? "#e63b52" : "#ff5f78";
    blobs.push(`<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" transform="rotate(${rot} ${cx.toFixed(1)} ${cy.toFixed(1)})" fill="${col}" opacity=".55"/>`); // prettier-ignore
  }
  const few = [];
  const r2 = rng(11);
  for (let i = 0; i < 9; i++) {
    const cx = 292 + (r2() - 0.5) * 56;
    const cy = 112 + (r2() - 0.5) * 56;
    few.push(`<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(14 + r2() * 8).toFixed(1)}" ry="${(8 + r2() * 6).toFixed(1)}" transform="rotate(${Math.round(r2() * 180)} ${cx.toFixed(1)} ${cy.toFixed(1)})" fill="#e63b52" opacity=".5"/>`); // prettier-ignore
  }
  return `<svg viewBox="0 0 380 224" role="img" aria-labelledby="${id}-t" class="figure-svg">
<title id="${id}-t">A berry drawn with many overlapping splats, and a zoom into a handful of them</title>
<g>${blobs.join("")}</g>
<circle cx="292" cy="112" r="44" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="4 4"/>
<g>${few.join("")}</g>
<path d="M170 100 250 90" stroke="currentColor" stroke-width="1.2" fill="none" stroke-dasharray="3 3"/>
<text class="fig-note" x="244" y="176" font-size="12.5" fill="currentColor">zoom in: just soft blobs</text>
</svg>`; // prettier-ignore
}

function figureBlend() {
  const id = `g${++figureNo}`;
  const blob = (cx, cy, col, label, n) =>
    `<g><ellipse cx="${cx}" cy="${cy}" rx="46" ry="30" transform="rotate(-18 ${cx} ${cy})" fill="${col}" opacity=".62"/><text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="15" font-weight="700" fill="#111">${n}</text><text x="${cx}" y="${cy + 54}" text-anchor="middle" font-size="12.5" fill="currentColor" class="fig-note">${label}</text></g>`;
  return `<svg viewBox="0 0 400 190" role="img" aria-labelledby="${id}-t" class="figure-svg">
<title id="${id}-t">Three splats drawn from farthest to nearest; where they overlap their colors blend</title>
${blob(70, 78, "#7bdff2", "farthest, first", 1)}${blob(120, 90, "#ffd166", "next", 2)}${blob(170, 78, "#ff5fa2", "nearest, last", 3)}
<path d="M236 82h40" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="m270 76 8 6-8 6" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>
<g transform="translate(335 82)"><ellipse rx="46" ry="30" transform="rotate(-18)" fill="#7bdff2" opacity=".62" cx="-26" cy="-2"/><ellipse rx="46" ry="30" transform="rotate(-18)" fill="#ffd166" opacity=".62" cx="0" cy="8"/><ellipse rx="46" ry="30" transform="rotate(-18)" fill="#ff5fa2" opacity=".62" cx="26" cy="-2"/></g>
<text class="fig-note" x="335" y="150" text-anchor="middle" font-size="12.5" fill="currentColor">one blended picture</text>
</svg>`; // prettier-ignore
}

// ---- What's new: curated days ---------------------------------------------------------------

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]; // prettier-ignore
function dayRange(from, until) {
  const [y, m, d] = from.split("-").map(Number);
  if (!until) return `${MONTHS[m - 1]} ${d}, ${y}`;
  const [, m2, d2] = until.split("-").map(Number);
  return m === m2
    ? `${MONTHS[m - 1]} ${d} to ${d2}, ${y}`
    : `${MONTHS[m - 1]} ${d} to ${MONTHS[m2 - 1]} ${d2}, ${y}`;
}

export function hubTypes(h) {
  const { esc, plain, fold, intro, arrow, galleryHref, thumbHref, shelfSections, shelfIndex } = h;
  const { countToys, publicToys, TOYS, shelfName, SITE, root, changelog, LOGO } = h;
  const toyById = (id) => {
    const t = TOYS.find((x) => x.id === id);
    if (!t) throw new Error(`site-pages.mjs names a toy that doesn't exist: ${id}`);
    return t;
  };
  const evidenceFile = (id) => fs.existsSync(path.join(root, `docs/evidence/${id}.json`));
  const evidenceHref = (id) => `${SITE.github}/blob/main/docs/evidence/${id}.json`;
  const ext = (href) => (/^https?:/.test(href) ? href : null);
  const label = (o) => (o.url ? `<a href="${esc(o.url)}">${esc(o.label)}</a>` : esc(o.label));
  const sectionHead = (id, title, text = "") =>
    `<h2 id="${id}">${esc(title)}</h2>${text ? `<p class="section-lead">${text}</p>` : ""}`;
  const allLabs = (ids) => ids.length > 0 && ids.every((id) => toyById(id).labs);
  const docLinks = (up) => `<ul class="inline-links"><li><a href="${up}about/credits/">Credits and licenses</a></li><li><a href="${up}about/privacy/">Privacy</a></li><li><a href="${up}about/terms/">Terms of use</a></li></ul>`; // prettier-ignore

  // ---- Tools -------------------------------------------------------------------------------

  function tools(page, { up }) {
    const hub = page.hub
      .map((g) => {
        const ids = g.items.filter((it) => it.toy).map((it) => it.toy);
        const cards = g.items
          .map((it) => {
            const t = it.toy ? toyById(it.toy) : null;
            const href = t ? `${up}${galleryHref(t)}` : `${up}${it.href ?? "../"}`;
            const thumb = t && thumbHref(t) ? `<img src="${up}${thumbHref(t)}" alt="" width="88" height="88" loading="lazy" decoding="async" />` : hubIcon(it.icon || g.icon, 40); // prettier-ignore
            const labs = t?.labs ? " data-labs" : "";
            return `<li class="tool-card"${labs}><a href="${href}"><span class="tool-art">${thumb}</span><span class="tool-body"><span class="tool-name">${esc(it.name || t.label)}${t?.labs ? ' <span class="badge">labs</span>' : ""}</span><span class="tool-text">${esc(it.text)}</span><span class="tool-open">${esc(it.open || "Open it")}${arrow}</span></span></a></li>`; // prettier-ignore
          })
          .join("");
        const hide = ids.length === g.items.length && allLabs(ids) ? " data-labs" : "";
        return `<section class="tool-hub" id="${g.id}"${hide} aria-labelledby="h-${g.id}"><div class="hub-head">${hubIcon(g.icon)}<div><h2 id="h-${g.id}">${esc(g.title)}</h2><p>${g.text}</p></div></div><ul class="tool-cards">${cards}</ul></section>`; // prettier-ignore
      })
      .join("\n");
    const everyToy = page.groups
      .map((g) => {
        const gid = `h-${fold(g.title).replace(/\W+/g, "-")}`;
        const items = g.items
          .map(([name, text]) => {
            const k = fold(name).replace(/\W+/g, "-");
            const key = h.TOOL_KEYS[k] ? ` <kbd title="Key ${h.TOOL_KEYS[k]} in the gallery">${h.TOOL_KEYS[k]}</kbd>` : ""; // prettier-ignore
            const icon = h.TOOL_ICONS[k] ? `<svg class="tool-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">${h.TOOL_ICONS[k]}</svg>` : ""; // prettier-ignore
            return `<div id="tool-${k}">${icon}<dt>${esc(name)}${key}</dt><dd>${esc(text)}</dd></div>`;
          })
          .join("");
        return `<section class="tool-group" aria-labelledby="${gid}"><h2 id="${gid}">${esc(g.title)}</h2><dl class="tool-list" style="--cols: ${g.items.length % 3 === 0 ? 3 : 4}">${items}</dl></section>`; // prettier-ignore
      })
      .join("\n");
    const jump = page.hub
      .map((g) => {
        const ids = g.items.filter((it) => it.toy).map((it) => it.toy);
        const hide = ids.length === g.items.length && allLabs(ids) ? " data-labs" : "";
        return `<li${hide}><a href="#h-${g.id}">${esc(g.title)}</a></li>`;
      })
      .join("");
    return `${intro(page, `<nav class="shelf-index" aria-label="Tool groups"><ul>${jump}<li><a href="#h-play">In every toy</a></li></ul></nav>`)}
${hub}
<div id="h-play">${everyToy}</div>`;
  }

  // ---- Science -----------------------------------------------------------------------------

  function science(page, { up }) {
    const rows = page.datasets
      .map((d) => {
        const first = toyById(d.toys[0]);
        const name = `<a href="${up}${galleryHref(first)}">${esc(d.name)}</a>${d.toys.slice(1).map((id) => `, <a href="${up}${galleryHref(toyById(id))}">${esc(toyById(id).label)}</a>`).join("")}`; // prettier-ignore
        const ev = d.toys.find(evidenceFile);
        const evidence = ev ? `<a href="${evidenceHref(ev)}">Evidence</a>` : '<span class="muted">not written yet</span>'; // prettier-ignore
        const hide = d.toys.every((id) => toyById(id).labs) ? " data-labs" : "";
        return `<tr${hide}><th scope="row">${name}</th><td>${d.shows}</td><td>${d.sources.map(label).join("<br />")}</td><td>${d.licenses.map(label).join("<br />")}</td><td>${evidence}</td></tr>`; // prettier-ignore
      })
      .join("");
    const n = countToys(page.shelves);
    const ev = TOYS.filter((t) => evidenceFile(t.id));
    return `${intro(page, `<p><a class="button primary" href="${up}../">Open the gallery${arrow}</a></p>`, `${n} toys`)}
<section aria-labelledby="h-data">
${sectionHead("h-data", "The data behind the toys", page.dataLead)}
<div class="table-wrap" tabindex="0" role="region" aria-label="Datasets, scrolls sideways"><table class="datasets"><thead><tr><th scope="col">Toy</th><th scope="col">What it shows</th><th scope="col">Source</th><th scope="col">License</th><th scope="col">Evidence</th></tr></thead><tbody>${rows}</tbody></table></div>
<p class="note">${page.dataNote} Every credit and license, in full, is on the <a href="${up}about/credits/">credits page</a>.${ev.length ? ` Evidence is written for ${ev.length} toy${ev.length === 1 ? "" : "s"} so far.` : ""}</p>
</section>
<section aria-labelledby="h-evidence">
${sectionHead("h-evidence", "Is it right?", page.evidenceLead.replace("@@", `<a href="${SITE.github}/blob/main/docs/evidence/README.md">docs/evidence/</a>`))}
</section>
${shelfIndex(page.shelves)}
${shelfSections(page.shelves, up)}`;
  }

  // ---- Learn -------------------------------------------------------------------------------

  function learn(page, { up }) {
    const href = (u) => (/^https?:/.test(u) ? u : up + u);
    const cards = page.cards
      .map(
        (c) =>
          `<li class="learn-card${c.main ? " main" : ""}"><a href="${esc(href(c.href))}">${hubIcon(c.icon, 34)}<span class="learn-title">${esc(c.title)}${arrow}</span><span class="learn-text">${c.text}</span></a>${(c.also || []).map((a) => `<a class="learn-also" href="${esc(href(a.href))}">${esc(a.label)}</a>`).join("")}</li>`, // prettier-ignore
      )
      .join("");
    return `${intro(page)}
<ul class="learn-cards">${cards}</ul>
<section aria-labelledby="h-more">
${sectionHead("h-more", "More to read")}
<ul class="link-list">${page.links.map((l) => `<li><a href="${esc(href(l.href))}">${esc(l.label)}</a><p>${esc(l.text)}</p></li>`).join("")}</ul>
</section>`;
  }

  // ---- Articles: how splats work, how Splashery is made -----------------------------------

  const ARTICLES = {
    splats(page, { up }) {
      const strawberry = toyById("strawberry");
      const bee = TOYS.find((t) => t.id === "honeybee");
      return `${intro(page)}
<article class="prose">
<section aria-labelledby="h-one">
<h2 id="h-one">One splat is a soft, colored blob</h2>
<p>A <strong>3D Gaussian splat</strong> is the smallest piece of every toy here. Think of a tiny ball of colored fog. It has a <strong>center</strong> (where it sits in space), a <strong>size in each direction</strong> (so it can be a ball, a disc or a long grain of rice) with a <strong>tilt</strong>, a <strong>color</strong> and an <strong>opacity</strong>. Its edge isn't sharp: it fades out smoothly, the way a drop of ink fades into wet paper. Mathematicians call that fade a <em>Gaussian</em>, which is where the name comes from.</p>
<figure class="figure">${figureSplat()}<figcaption>One splat, drawn flat: a center, a stretch in two directions, a tilt, a color and a soft edge. In 3D it has three sizes, not two.</figcaption></figure>
</section>
<section aria-labelledby="h-many">
<h2 id="h-many">Hundreds of thousands of them make a picture</h2>
<p>One splat is hardly anything. But a scan of a strawberry is made of about 450,000 of them, each a little different: some small and dark where the seeds sit, some wide and red on the smooth skin. Packed together they overlap, and your eye can't see where one stops and the next begins. What you see is the berry.</p>
<figure class="figure">${figureCrowd()}<figcaption>A berry drawn with a hundred and fifty big splats, and a zoom into a handful of them. Real toys use far more, and far smaller, ones.</figcaption></figure>
<p>Try it: <a href="${up}${galleryHref(strawberry)}">open the strawberry</a>${bee ? ` or <a href="${up}${galleryHref(bee)}">the honeybee</a>` : ""} and pinch in close. The fruit turns into a cloud of soft blobs, and zooming back out makes it solid again.</p>
</section>
<section aria-labelledby="h-sorted">
<h2 id="h-sorted">Sorted, then blended</h2>
<p>To draw a frame, the computer does two things with all those splats. First it <strong>sorts</strong> them by distance from you, farthest first. Then it <strong>paints</strong> them one after another, and each one is see-through, so it only tints what is already there. A near splat covers a far one, and where they overlap their colors mix. Do that sixty times a second and the picture can move.</p>
<figure class="figure">${figureBlend()}<figcaption>Three splats, painted from the farthest to the nearest. The overlaps blend.</figcaption></figure>
<p>That is the whole trick, and it is why splats look so soft and real: no hard polygons, no textures, just blended color. It also means every splat is free to move on its own, which is what makes toys that peel, ripple, shatter and come back together possible.</p>
</section>
<section aria-labelledby="h-recipe">
<h2 id="h-recipe">Where the splats come from</h2>
<p>There are two kinds of toys on Splashery.</p>
<ul>
<li><strong>Captured toys</strong> are scans. Someone walked around a real strawberry or cactus with a camera, a program worked out the splats that would reproduce those photos, and Splashery shows the result. Each scan's author and license are in the <a href="${up}about/credits/">credits</a>.</li>
<li><strong>Recipe toys</strong> are made from a short description. A <strong>recipe</strong> says what a toy is built from (a cone for the tower, a box for each sail), what color each part is, and what moves and how. Your browser reads the recipe and makes the splats when you pick the toy, so a toy costs a few thousand characters instead of megabytes.</li>
</ul>
<figure class="figure recipe-figure"><pre class="code"><code>// A little windmill, from its recipe
build(k) {
  k.add(k.cone(0.5, 0.3, 1.6), { color: "#8b8f97" });   // the tower
  const sails = k.part("sails", { pivot: [0, 0.6, 0.42] });
  k.add(k.box(0.16, 0.9, 0.02), { part: sails });        // a sail
}
drive(t, c, out) {
  out.parts.sails = { angle: t * 1.5 };                  // the sails turn
}</code></pre><figcaption>Real recipes are a little longer, but they read like this: shapes, colors, and what moves.</figcaption></figure>
<p>Because a recipe is plain text, anyone can write one. The <a href="${up}../manual/">Tinkerer's Manual</a> teaches it from the math of one splat up to your own toys, and <a href="${SITE.github}/blob/main/docs/PACKS.md">Writing toy recipes</a> is the reference.</p>
</section>
<section aria-labelledby="h-why">
<h2 id="h-why">Why make toys from splats?</h2>
<p>Splats are usually something you watch: a scan you orbit and then close. Here they are something you play with. Because each splat is separate, a toy can peel like a grape, pour like water or ring like a piano, and the same recipes run atoms, planets and games. And since the whole thing is plain web code, it works on a phone with nothing to install.</p>
<p class="actions"><a class="button primary" href="${up}../">Open the gallery${arrow}</a><a class="button" href="${up}learn/">Back to Learn</a></p>
</section>
</article>`;
    },

    made(page, { up }) {
      const toys = countToys("all");
      return `${intro(page)}
<article class="prose">
<section aria-labelledby="h-people">
<h2 id="h-people">One person with ideas, and Claude as the builder</h2>
<p>Splashery is made by Ryan Kamp. Ryan decides what it should be, looks at the results and says what is good and what isn't. The code is written by Claude, Anthropic's AI model, working in many sessions at once. Nothing is hidden about that: it is the experiment.</p>
</section>
<section aria-labelledby="h-lanes">
<h2 id="h-lanes">Lanes: one session, one job</h2>
<p>A big idea gets split into small jobs, and each job is a <strong>lane</strong>: one Claude session with one task (a new shelf of toys, a fix for something that looked grainy, the tools for opening a PDF). Each lane works on its own copy of the project and owns its own files, so lanes can run side by side without stepping on each other. When a lane finishes it writes down what it did, what it left undone and what it learned, in a handoff file, and opens a <em>draft pull request</em>: a proposal that someone else must look at before it joins the real thing.</p>
</section>
<section aria-labelledby="h-operator">
<h2 id="h-operator">The Operator keeps order</h2>
<p>One long-running session, the <strong>Operator</strong>, doesn't build toys. It plans the lanes, writes each lane's brief, checks the work, merges finished pieces in the right order and keeps the plan and the rules up to date. Ryan talks to the Operator, so the lanes never need managing by hand. Different lanes use different models: the larger Opus model for the engine and the toys, the lighter Sonnet model for documents, converters and content, and each one is recorded.</p>
</section>
<section aria-labelledby="h-review">
<h2 id="h-review">Every effect is judged as a short film</h2>
<p>A still picture can't tell you whether a toy moves well, so every new or changed effect is recorded as a short clip at phone size and posted on a private review page. Ryan watches each one and marks it <em>good</em> or <em>fix</em>, with a note. The rules he has set from those reviews are written down: parts move as solid pieces, never a bent picture; separate things move separately; instruments are really played; materials look like what they are. A "fix" goes back to the lane that made it, and the new clip is judged again.</p>
</section>
<section aria-labelledby="h-checks">
<h2 id="h-checks">Checked in a real browser, with rules about what goes in</h2>
<p>Every change is tested by driving a real browser through the toys, the links and the page layout, and a test checks that an embed stays under 30 MB. The site is plain files, with nothing to deploy but the files. Beyond the tests there are rules the toys must follow: every picture, scan and sound is public domain or under a Creative Commons license that allows it here, and each is credited; nothing you open is uploaded; and files and links from older versions keep working.</p>
</section>
<section aria-labelledby="h-notes">
<h2 id="h-notes">The notes are public</h2>
<p>The project keeps a <a href="${up}learn/notebook/">lab notebook</a>: for each lane, what it built, which model built it, and what the team learned. The plan, the rules and every lane's handoff are in the open on <a href="${SITE.github}">GitHub</a>, and <a href="${up}new/">What's new</a> says what changed and when. As of this build there are ${toys} toys on the public shelves.</p>
<p class="actions"><a class="button primary" href="${up}learn/notebook/">Read the lab notebook${arrow}</a><a class="button" href="${up}learn/">Back to Learn</a></p>
</section>
</article>`;
    },
  };

  function article(page, ctx) {
    return ARTICLES[page.article](page, ctx);
  }

  // ---- Markdown pages: credits, notebook ----------------------------------------------------

  function markdown(page, { up }) {
    const ids = new Set();
    const parts = page.files.map((f, n) => {
      const text = read(root, f.file);
      const baseDir = path.posix.dirname(f.file) === "." ? "" : path.posix.dirname(f.file);
      const { html, headings } = mdToHtml(text, {
        github: SITE.github,
        baseDir,
        demote: f.demote ? 1 : 0,
        ids,
      });
      const wrapId = `file-${mdSlug(f.title)}`;
      return { f, html, headings, wrapId, n };
    });
    const toc = parts
      .map((p) => {
        const top = p.headings.filter((x) => x.level === (p.f.demote ? 3 : 2));
        return `<li>${p.f.title ? `<a href="#${p.wrapId}">${esc(p.f.title)}</a>` : ""}<ul>${top.map((x) => `<li><a href="#${x.id}">${esc(x.text)}</a></li>`).join("")}</ul></li>`; // prettier-ignore
      })
      .join("");
    const body = parts
      .map((p) => {
        const wrap = p.f.title ? `<h2 id="${p.wrapId}" class="file-title">${esc(p.f.title)}</h2>${p.f.note ? `<p class="section-lead">${p.f.note}</p>` : ""}` : ""; // prettier-ignore
        return `<section class="md-file" aria-label="${esc(p.f.title || page.title)}">${wrap}<div class="prose">${p.html}</div></section>`;
      })
      .join("\n");
    const source = page.files.map((f) => `<a href="${SITE.github}/blob/main/${f.file}">${esc(f.file)}</a>`).join(" and "); // prettier-ignore
    return `${intro(page)}
<nav class="toc" aria-label="On this page"><h2>On this page</h2><ul>${toc}</ul></nav>
${body}
<p class="note">This page is built from ${source} each time the site is built, so it always matches them.</p>`;
  }

  // ---- About, Terms, Privacy -----------------------------------------------------------------

  function about(page, { up }) {
    const toys = countToys("all");
    const shelves = new Set(publicToys.filter((t) => !t.labs).map((t) => t.category)).size;
    return `${intro(page)}
<article class="prose">
<section aria-labelledby="h-who">
<h2 id="h-who">Who made it, and why</h2>
<p>Splashery is made by <strong>Ryan Kamp</strong>, with Claude, Anthropic's AI model, as the builder. 3D Gaussian splats make stunning scans of real things, but they are usually something you only watch. Splashery asks what happens if you can <em>play</em> with them. Poke a strawberry, peel a grape, blow the seeds off a dandelion, drop a toy and watch it break into pieces that come back together.</p>
<p>It has grown from there: ${toys} toys on ${shelves} shelves today, from photoreal scans to atoms, planets, math and games, plus tools to turn your own photos, pages and sounds into splats. <a href="${up}learn/made/">How Splashery is made</a> tells the story of the lanes, the reviews and the rules.</p>
</section>
<section aria-labelledby="h-what">
<h2 id="h-what">What it is</h2>
<p>Every toy is drawn with 3D Gaussian splats: soft, colored blobs that together make a scan of a real thing, or a shape built from a recipe. You can poke, paint, blow on, drop and dissolve them, then share a toy as a link, an <a href="${up}share/">embed</a>, a GIF or a video. <a href="${up}learn/splats/">How 3D Gaussian splats work</a> explains the idea with pictures.</p>
<p>It is plain web pages and code: no app to install, no account, no ads. It runs in your browser, using WebGPU where there is one and WebGL 2 where there isn't, on a phone or a computer. The 3D drawing is done by the open-source <a href="https://github.com/playcanvas/engine">PlayCanvas</a> engine.</p>
</section>
<section aria-labelledby="h-rules">
<h2 id="h-rules">What it promises</h2>
<ul>
<li><strong>Nothing you open leaves your device.</strong> Files, photos, pages and songs are turned into splats right in your browser. <a href="${up}about/privacy/">The privacy page</a> has the details.</li>
<li><strong>Everything is open licensed and credited.</strong> Every scan, picture, sound and dataset is public domain or under a Creative Commons license that allows it here, and each is credited beside the toy and on the <a href="${up}about/credits/">credits page</a>.</li>
<li><strong>No tracking, no cookies, no ads.</strong></li>
<li><strong>Old links keep working.</strong> A toy you shared last month still opens.</li>
</ul>
</section>
<section aria-labelledby="h-more">
<h2 id="h-more">The small print, and where to find us</h2>
${docLinks(up)}
<p>The code is on <a href="${SITE.github}">GitHub</a> under the MIT license; each toy's assets keep their own licenses. To report a problem or suggest a toy, open an <a href="${SITE.github}/issues">issue on GitHub</a>.</p>
</section>
</article>`;
  }

  // The terms are the ones in the gallery's About tab, read from index.html at build time.
  function terms(page, { up }) {
    const html = read(root, "index.html");
    const m = /<ul class="terms">([\s\S]*?)<\/ul>/.exec(html);
    if (!m) throw new Error("The gallery's terms of use are not in index.html any more.");
    const items = [...m[1].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((x) =>
      x[1].replace(/\s+/g, " ").trim(),
    );
    return `${intro(page)}
<article class="prose">
<section aria-labelledby="h-terms">
<h2 id="h-terms">Terms of use</h2>
<ul>${items.map((t) => `<li>${t.replace(/\(see Credits\)/, `(see the <a href="${up}about/credits/">credits</a>)`)}</li>`).join("")}</ul>
<p class="note">These are the same terms the gallery shows in its About tab. See also the <a href="${up}about/privacy/">privacy page</a> and the <a href="${up}about/credits/">credits and licenses</a>.</p>
</section>
</article>`;
  }

  function privacy(page, { up }) {
    return `${intro(page)}
<article class="prose">
<section aria-labelledby="h-short">
<h2 id="h-short">The short version</h2>
<p><strong>Nothing you open leaves your device. Splashery has no accounts, no tracking, no cookies and no ads.</strong> It is a set of plain files; the people who run it don't receive your files, your pictures, your microphone or camera, or a record of what you do.</p>
</section>
<section aria-labelledby="h-files">
<h2 id="h-files">Files you open</h2>
<p>When you open a splat file, a photo, a PDF, a GIF, a video, a song, a 3D model or a data file, your browser reads it and turns it into splats on your device. It isn't uploaded to us or to anyone else. A link you share carries the toy and your settings, and for your own files only the settings (and a web address, if you chose one). The picture or file itself stays with you.</p>
</section>
<section aria-labelledby="h-live">
<h2 id="h-live">The microphone, the camera, the screen and your location</h2>
<p>A toy asks for the microphone, the camera or screen capture only when you tap its button to start it. Nothing is requested before that, and nothing is recorded, stored or sent anywhere. The one exception is a recorder (the Sound lab's, for example): it records only when you tap Record, keeps the recording on your device, and saves it only to a file you choose. The Night sky can ask where you are only when you tap for it, and never stores or sends the answer.</p>
</section>
<section aria-labelledby="h-reads">
<h2 id="h-reads">The few times a toy reads something from the internet</h2>
<p>Almost everything runs from files that ship with the site. A few toys can read open data, and only when you ask:</p>
<ul>
<li><strong>Earthquakes.</strong> The earthquakes toy reads the public earthquake feed of the U.S. Geological Survey when you open the toy or tap to refresh. A dated snapshot ships with the site for when the feed can't be reached.</li>
<li><strong>Other open geographic feeds</strong> (animal tracking, migration) work the same way, and only when their terms allow reuse.</li>
<li><strong>Protein structures.</strong> The molecule viewer can fetch a structure from the Protein Data Bank (CC0) by its code when you ask for it.</li>
<li><strong>Wikipedia.</strong> The Wikipedia book fetches an article from Wikipedia when you ask for it. The text is never stored or shipped with the site, and its credit and license show beside it.</li>
</ul>
<p>These use keyless public endpoints, show the source and the time of the data beside it, and store and send nothing about you. Your browser does ask those servers for the data, so they can see the request the way any website can; they don't learn anything else.</p>
</section>
<section aria-labelledby="h-store">
<h2 id="h-store">What stays in your browser</h2>
<p>A few settings are kept in your browser's own storage, on your device only: the color theme, the Detail setting, the labs switch and, if you install Splashery, the files its offline copy keeps so toys you played work again without a connection. It is never sent anywhere, and clearing your site data removes it.</p>
</section>
<section aria-labelledby="h-host">
<h2 id="h-host">Where the site is hosted</h2>
<p>Splashery's pages are served by GitHub Pages, the way any website is served. GitHub, like any host, can see ordinary web requests (an address and a time). Splashery adds no analytics or advertising of its own, and a toy loads nothing from third-party servers when you open it.</p>
</section>
<section aria-labelledby="h-q">
<h2 id="h-q">Questions</h2>
<p>Ask on <a href="${SITE.github}/issues">GitHub</a>. See also the <a href="${up}about/terms/">terms of use</a> and the <a href="${up}about/credits/">credits</a>.</p>
</section>
</article>`;
  }

  // ---- What's new --------------------------------------------------------------------------------

  function news(page, { up }) {
    const curated = JSON.parse(read(root, "tools/site-news.json")).days;
    const items = changelog(page.count);
    const byDate = new Map();
    for (const it of items) byDate.set(it.date, [...(byDate.get(it.date) || []), it]);
    const days = curated
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((d) => {
        const prs = byDate.get(d.date) || [];
        const list = d.items.map((t) => `<li>${t}</li>`).join("");
        const raw = prs.length
          ? `<details class="pr-list"><summary>All ${prs.length} merged change${prs.length === 1 ? "" : "s"} that day</summary><ul>${prs.map((it) => `<li><a href="${SITE.github}/pull/${it.pr}">${esc(it.title)}</a></li>`).join("")}</ul></details>` // prettier-ignore
          : "";
        const when = dayRange(d.date, d.until);
        return `<section class="news-day" aria-labelledby="d-${d.date}"><h2 id="d-${d.date}"><time datetime="${d.date}">${esc(when)}</time></h2><p class="news-title">${esc(d.title)}</p><ul class="news-items">${list}</ul>${raw}</section>`; // prettier-ignore
      })
      .join("\n");
    // Merged days the curated file hasn't covered yet still get their list.
    const covered = new Set(curated.map((d) => d.date));
    const rest = [...byDate]
      .filter(([date]) => !covered.has(date))
      .map(
        ([date, list]) => `<section class="news-day"><h2><time datetime="${date}">${esc(h.longDate(date))}</time></h2><ul class="pr-plain">${list.map((it) => `<li><a href="${SITE.github}/pull/${it.pr}">${esc(it.title)}</a></li>`).join("")}</ul></section>`, // prettier-ignore
      )
      .join("\n");
    return `${intro(page)}
${rest}
${days}
<p class="note">Each day's list of merged changes comes from the project's history on <a href="${SITE.github}/pulls?q=is%3Apr+is%3Amerged">GitHub</a>.</p>`;
  }

  // ---- The embed and share guide -------------------------------------------------------------

  function embed(page, { up }) {
    const origin = `${SITE.origin}/splashery/`;
    const rows = page.options
      .map(
        ([query, attr, what]) =>
          `<tr><th scope="row"><code>${esc(query)}</code></th><td>${attr ? `<code>${esc(attr)}</code>` : '<span class="muted">same as the iframe</span>'}</td><td>${what}</td></tr>`,
      ) // prettier-ignore
      .join("");
    const toys = publicToys.filter((t) => !t.labs && thumbHref(t)).map((t) => t.id);
    return `${intro(page)}
<article class="prose guide">
<section aria-labelledby="h-try">
<h2 id="h-try">Try it: pick a toy and its options</h2>
<p>Choose below. The toy updates, and the two snippets underneath are what you paste into your own page.</p>
<div class="embed-lab" id="embed-lab" data-origin="${esc(origin)}" data-home="${esc(toys.includes("strawberry") ? "strawberry" : toys[0])}">
<form class="embed-form" id="embed-form" aria-label="Embed options">
<label>Toy<select name="toy" id="eo-toy"><option value="strawberry">Strawberry</option></select></label>
<label>Theme<select name="theme"><option value="">Follow the page</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
<label>Background<select name="bg"><option value="">Normal</option><option value="transparent">Transparent</option></select></label>
<label>On its own<select name="autoplay"><option value="">Turn slowly</option><option value="breeze">A breeze</option><option value="pokes">Little pokes</option><option value="twist">A slow twist</option><option value="dissolve">Dissolve and rebuild</option></select></label>
<label>Zoom <output id="eo-zoom-out">1</output><input type="range" name="zoom" min="0.5" max="2" step="0.1" value="1" /></label>
<label class="check"><input type="checkbox" name="turntable" /> Hold still (no turntable)</label>
<label class="check"><input type="checkbox" name="controls" /> Hide the + and − buttons</label>
<label>Width<select name="width"><option value="360px">Small (360 px)</option><option value="600px" selected>Medium (600 px)</option><option value="900px">Large (900 px)</option><option value="">Full width</option></select></label>
</form>
<figure class="embed-stage" id="embed-stage"><div class="embed-frame" id="embed-frame"></div><noscript><p>The live example needs JavaScript. The snippets below work without it.</p></noscript></figure>
<h3 id="h-iframe">The iframe</h3>
<p>Works on any page.</p>
<div class="snippet"><pre><code id="snip-iframe">${esc(`<iframe
  src="${origin}embed/?toy=strawberry"
  title="Splashery toy"
  loading="lazy"
  style="width:100%;max-width:600px;aspect-ratio:4/3;border:0;border-radius:12px"
></iframe>`)}</code></pre><button type="button" class="button copy" data-copy="snip-iframe">Copy</button></div>
<h3 id="h-element">The <code>&lt;splashery-toy&gt;</code> element</h3>
<p>One script tag, no iframe. It starts when it scrolls into view and pauses when it scrolls away. <button type="button" class="button" id="show-element">Show it live</button></p>
<div class="snippet"><pre><code id="snip-element">${esc(`<script type="module" src="${origin}src/element.js"></script>
<splashery-toy toy="strawberry"></splashery-toy>`)}</code></pre><button type="button" class="button copy" data-copy="snip-element">Copy</button></div>
<div id="element-stage" class="embed-frame element-frame" hidden></div>
</div>
</section>
<section aria-labelledby="h-options">
<h2 id="h-options">Every option</h2>
<p>The iframe takes options as a query string after <code>embed/</code>. The element takes the same options as attributes.</p>
<div class="table-wrap" tabindex="0" role="region" aria-label="Embed options, scrolls sideways"><table><thead><tr><th scope="col">In the iframe's address</th><th scope="col">On the element</th><th scope="col">What it does</th></tr></thead><tbody>${rows}</tbody></table></div>
</section>
<section aria-labelledby="h-details">
<h2 id="h-details">Good to know</h2>
<ul>
<li><strong>Size.</strong> The iframe is 4:3 and fills its column, up to the width you set. A built-in toy loads well under 30 MB in all; even the heaviest scan is about 8 MB (the engine plus one file).</li>
<li><strong>Transparent embeds.</strong> Add <code>color-scheme: light</code> to the iframe's style, as the snippet does, so browsers keep it see-through when a visitor's system is in dark mode.</li>
<li><strong>Switching the theme from your page.</strong> Send the iframe a message: <code>iframe.contentWindow.postMessage({ type: "splashery:theme", theme: "dark" }, "*")</code>. The element follows the page by itself, including a <code>paper-theme-change</code> event on <code>document</code> and <code>data-resolved-theme</code> on <code>&lt;html&gt;</code>.</li>
<li><strong>Scrolling and zooming.</strong> The mouse wheel scrolls your page until a visitor clicks or taps the toy; after that it zooms until the pointer leaves. Ctrl or ⌘ with the wheel, a pinch, and the + and − buttons always zoom.</li>
<li><strong>Privacy.</strong> An embed loads nothing from third parties, shows no ads, and sets no cookies. Embeds are always silent.</li>
<li><strong>The element's attributes</strong> also include <code>scene</code> (a share payload, see below) and <code>label</code> (the accessible name).</li>
</ul>
</section>
<section aria-labelledby="h-links">
<h2 id="h-links">How scene links work</h2>
<p>Every toy can be shared as a link. Open the gallery's <strong>Share</strong> tab and tap <strong>Copy link</strong>. The link looks like this:</p>
<pre class="code"><code>${esc(origin)}#s=<span class="muted-code">PAYLOAD</span></code></pre>
<p>The part after <code>#s=</code> is the <strong>scene</strong>: a small JSON document that says which toy it is, the camera, the look (background, theme, accent color, splat size and exposure), every effect's settings, any paint, and the pattern and motion. The JSON is compressed and written in a URL-safe form, so the payload starts with <code>d.</code> (compressed) or <code>j.</code> (plain JSON, for old browsers). It all lives after the <code>#</code>, so it goes to nobody: your browser keeps the part after a hash to itself.</p>
<ul>
<li><strong>Your own files.</strong> A link for a toy you opened yourself carries the settings only, and says so. Splashery doesn't put your file in a link. A link can carry a web address instead, so a picture hosted on your own site opens for whoever follows it.</li>
<li><strong>Long scenes.</strong> If a scene is too long for a link (about 12 KB), the paint and then the clay edits are left out, and the app says so.</li>
<li><strong>Old links keep working.</strong> Version 2 and 3 scenes, from any time, still load.</li>
<li><strong>In an embed.</strong> The same payload works in the embed player: <code>embed/#s=PAYLOAD</code>, or the element's <code>scene</code> attribute. That is how an embed can show a toy with its exact look and camera.</li>
<li><strong>As a file.</strong> <strong>Save JSON</strong> in the Share tab saves the same scene as a file, and <strong>Load JSON</strong> (or dropping the file on the page) opens it. The format is written down in <a href="${SITE.github}/blob/main/docs/SCENE-SCHEMA.md">the scene format</a>.</li>
</ul>
<h3 id="h-make-link">Make a link to any toy</h3>
<p>Pick a toy to get its link, and the same toy as an embed address:</p>
<div class="embed-lab" id="link-lab">
<label class="wide">Toy<select id="lk-toy"></select></label>
<div class="snippet"><pre><code id="snip-link"></code></pre><button type="button" class="button copy" data-copy="snip-link">Copy</button></div>
<div class="snippet"><pre><code id="snip-embed-link"></code></pre><button type="button" class="button copy" data-copy="snip-embed-link">Copy</button></div>
</div>
</section>
<section aria-labelledby="h-more">
<h2 id="h-more">More</h2>
<ul>
<li><a href="${SITE.github}/blob/main/embed/demo.html">The demo page</a> shows the iframe and the element side by side.</li>
<li><a href="${up}../">Open the gallery</a> to make your own scene, then share it.</li>
</ul>
</section>
</article>`;
  }

  return { tools, science, learn, article, markdown, about, terms, privacy, news, embed };
}

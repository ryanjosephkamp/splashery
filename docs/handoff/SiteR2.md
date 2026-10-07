# Lane Site r2: the owner's walkthrough fixes for the site (prefix `st2`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: Site r2 (id `SiteR2`, prefix `st2`).
Branch: `claude/lane-site-r2` (and `claude/lane-site-r2-engine` for any change to the app outside
your own files, as an "Engine: …" PR merged first). PR title: "Phase Site r2: the owner's
walkthrough fixes for the site". Handoff file: docs/handoff/SiteR2.md (create it; start it with this
brief, word for word, under "## Brief", then keep "## State

WORKING (October 7, 2026). Model: Sonnet 5.5 (default effort). Draft PR #367. No engine PR: nothing
outside my files changed (`tools/site-toy-pages.mjs` untouched).

Done (items of triage.md, "Site r2"):

1. **Footer and Contact**: every page's footer starts its small line with "Made by Ryan Kamp" (links
   to `about/contact/`); "Contact" is in the footer's More list and the About page's small-print
   links; the Credits page has a note linking to it. The Contact page (`about/contact/`) lists the
   seven links from the brief, no email. No "made with AI" line.
2. **About**: his name links to https://ryanjosephkamp.github.io/ (new tab).
3. **New tabs**: `appLink()` in `tools/site-pages.mjs` for "open in the app" links, and
   `newTabLinks()`, which the shell runs over every finished page: any web address, and any path
   that leaves `site/` for the gallery or the app (`../`, `../#…`, `../?…`, `../worlds/`), gets
   `target="_blank" rel="noopener"`. It covers the toy pages' own links without editing their file.
   The manual and the pictures stay in the same tab. The Manual's "Open it in the toy" links and its
   gallery link are new-tab too.
4. **Toy names**: the Tools cards go to `toys/<id>/` and each has its own "Open in Splashery" link
   (new tab); the Science table's toy names go to the toy pages, and its "Evidence" link to the toy
   page's "Is it right?" section.
5. **Science**: the toy gallery first; the data table and "Is it right?" below it, with two chips
   for them at the end of the shelf row.
6. **Menu after Back**: `site.js` closes the menu on `pageshow`, on `pagehide` and when a menu link
   is tapped. Tested with a real Back and with a synthetic persisted `pageshow`.
7. **Guides as pages**: `learn/recipes/` (docs/PACKS.md), `learn/scene-format/`, `learn/evidence/`,
   `learn/fluids/`, `learn/operating/` and one page per lane file the lab notebook links
   (`learn/notebook/<name>/`, 36). Built from the Markdown at site-build time (`tools/site-md.mjs`
   now maps links to a mirrored document to its page: `DOC_PAGES`); each page links to its GitHub
   source (`data-source`). `mirrorDocLinks()` also rewrites the toy pages' links to CREDITS.md and
   to the README's embedding section to the site's pages. The lane pages are not searched, not in
   the sitemap and not precached.
8. **Outline**: `site/assets/outline.js` and `outline.css`, one shared script. A page opts in with
   `outline: true` (the build adds `data-outline`, the script and the style); the Manual does it by
   hand. A thin bar after the page's contents list names the section you are in and opens a list of
   the sections; Escape or a tap outside closes it; it sits in the page flow, so nothing moves until
   used; jumps keep the heading clear of the header and the bar (scroll-padding). On: the guides,
   "How Splashery is made", the notebook, the credits, the Manual.
9. **Manual**: the colophon's "Splashery" link is the one link at the bottom (the separate "Back to
   Splashery" is gone); the PDF keeps the colophon sentence.
10. **Loop graph**: draft page `learn/made/loop/`, linked from nowhere (not the menu, not How
    Splashery is made, no search, no sitemap). `node tools/site-loop.mjs` draws
    `docs/lane-loop.grooph.json` with the GROOPH command line (MIT, by the owner;
    `npx grooph@0.4.0`) into `site/assets/lane-loop.svg` (inline in the page; it follows the site's
    light and dark) and writes the link that opens the same graph in the GROOPH app (interactive,
    3D) into `lane-loop-link.txt`. Nothing of GROOPH ships, so nothing is vendored.

Tests: `tests/st2.spec.mjs` (20), plus `tests/site.spec.mjs`, `tests/spg.spec.mjs`,
`tests/tpg.spec.mjs` (touched pages).

## Notes

- `node tools/site-build.mjs`, `npx prettier --write site`, `node tools/site-build.mjs --check`. The
  build pass order in `shell()`: build the HTML, `mirrorDocLinks`, `newTabLinks`.
- To add a mirrored document: add a `guide(...)` entry in `tools/site-pages.mjs`; links to it from
  the other Markdown pages and from the toy pages follow by themselves.
- GROOPH is a build tool (list it in LICENSES.md, "build tools"); the SVG it wrote is the only part
  committed.

## Known issues

- No new-tab hint for screen readers on the new-tab links (adding text to every link would change
  the pages the owner praised); say if wanted.
- The remaining GitHub links to `.md` files are inside the lane pages (other lane files,
  docs/reviews, docs/lab, HANDOFF.md): they stay on GitHub.
- The Manual's two PACKS.md links stay on GitHub: the public Manual shouldn't link the unlisted
  preview. Point them at `learn/recipes/` at the swap.
- The loop graph is a still picture plus a link to the GROOPH app; an embedded 3D view would mean
  vendoring the 1.7 MB GROOPH app.
- The owner's contact list is still the one on his personal site; replace `contact` in
  `tools/site-pages.mjs` when he confirms.

## For the Operator

- Merge order: no engine PR. Files: `tools/site-build.mjs`, `site-pages.mjs`, `site-hubs.mjs`,
  `site-md.mjs`, `site-loop.mjs` (new), `site/` (regenerated),
  `site/assets/{outline.css,outline.js,loop.js,hubs.css,site.js,lane-loop.svg,lane-loop-link.txt}`,
  `manual/index.html`, `tests/st2.spec.mjs`, this file.
- LICENSES.md: add GROOPH 0.4.0 (MIT, the owner's own) as a build tool (not shipped).
- The upkeep's site build keeps the guide pages current (they follow main).
- Cards for the owner: `st2-*` on Effect review page 2 (before and after, 390×844).

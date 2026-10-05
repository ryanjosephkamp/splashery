# Lane Site pages: the hubs, About, credits, privacy, What's new and the embed guide (prefix `spg`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: Site pages (id `SitePages`, prefix `spg`).
Branch: `claude/lane-site-pages`. PR title: "Phase Site pages: the hubs, About, credits, privacy,
What's new and the embed guide". Handoff file: docs/handoff/SitePages.md (create it; start it with
this brief, word for word, under "## Brief", then keep "## State", "## Notes", "## Known issues" and
"## For the Operator" current). Model: Sonnet 5.5.

### Brief (written by the Operator on October 5, 2026, from the owner's Push Plan picks)

Push Plan W4 to W8 and W10 (yes), after lane Site's shell (merged October 5, 2026, #266). Read
docs/handoff/Site.md first, above all "How the site is built" and "How to add a page type". Lane
Site wrote first drafts of the hubs; you make them complete and good.

1. **Tools hub** (W4): every tool on one page, grouped (make and convert, open your own files, scan
   and measure, QR codes, sound and light), each with a drawing, one line on what it does, and a
   link that opens it.
2. **Science hub** (W5): every science toy and dataset, with its source, its license and what it
   shows, and a link to its evidence page when docs/evidence/ has one.
3. **Learn hub** (W6): the Tinkerer's Manual (link to it as it is), a plain "How 3D Gaussian splats
   work" explainer with small drawings (a splat is a soft colored ellipsoid; millions of them,
   sorted and blended, make a picture; what a recipe is), the lab notebook, and "How Splashery is
   made" (the lanes, the Operator, the reviews), in plain words for a curious reader.
4. **About, credits and privacy** (W7): who made it and why (draft it from README.md and the docs;
   the owner edits it later), a credits and licenses page built from CREDITS.md and LICENSES.md by
   the build (so it never goes stale), the terms (from the gallery's About tab), and a plain privacy
   page: nothing you open leaves your device; what the live feeds and the PDB fetch read and when;
   no tracking.
5. **What's new** (W8): keep the list built from merged PRs, and add a short curated summary per day
   in plain words (a data file you write, `tools/site-news.json`, read by the build), so lane jargon
   doesn't reach the page.
6. **Embed and share guide** (W10): how to put a toy on your own page (the iframe and the
   `<splashery-toy>` element, every option the embed takes, with a live example), and how scene
   links work.

Everything in American English, in the site's own look. Tests in `tests/spg*.spec.mjs` (each page
loads, its menu item lights, the credits page lists every entry in CREDITS.md); screenshots of the
hubs at both sizes; a short walk-through clip at phone size on Effect review page 2 (lane record
`SitePages`).

You own: the hub, About, credits, privacy, What's new and embed-guide page types and words (in
`tools/site-pages.mjs` and a new `tools/site-hubs.mjs` for their code, registered in
`tools/site-build.mjs` with a few lines), `tools/site-news.json`, `site/assets/` additions for them,
`tests/spg*.spec.mjs`, and your handoff file. Lane Toy pages adds a page per toy in the same build
at the same time: keep your changes to the shared build files small, and on a conflict in `site/`,
take either side and rebuild.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
replace the prefix and lane record with yours). The site is a preview under `site/` (linked from
nowhere public), so the Operator merges after a full test run; the owner decides when it becomes the
front door. Finish every working turn with "READY:", "WORKING:" or "BLOCKED:"; Splashery has no CI
to wait for; for a long job, schedule a check-in with send_later instead of going idle. Before
READY, merge origin/main into your branch (a merge commit) and rebuild `site/`.

## State

WORKING (October 5, 2026). Model: Sonnet 5.5. No engine PR.

Built, all under `site/` (preview, `noindex`):

- **Tools** (`site/tools/`): five groups (make and convert, open your own files, scan and measure,
  QR codes, sound and light) of cards, each with the toy's own picture, one line and a link that
  opens the toy in the gallery; then "In every toy" (the toolbar's tools, Make and share). A group
  whose toys are all labs hides without the labs switch.
- **Science** (`site/science/`): a table of the data behind the toys (what it shows, source,
  license, an Evidence link when `docs/evidence/<toy id>.json` exists), then every science, imaging,
  atoms, space, tiny world, body, math, computing and lab toy by shelf.
- **Learn** (`site/learn/`): cards for the Manual (and its PDF), "How 3D Gaussian splats work"
  (`learn/splats/`, three drawings and a recipe), the lab notebook (`learn/notebook/`, built from
  docs/NOTEBOOK.md), "How Splashery is made" (`learn/made/`) and the embed guide.
- **About** (`site/about/`: who and why, what it promises), **credits and licenses**
  (`about/credits/`, built from CREDITS.md and LICENSES.md), **terms** (`about/terms/`, read from
  the gallery's About tab in index.html) and **privacy** (`about/privacy/`).
- **What's new** (`site/new/`): a plain summary per day from `tools/site-news.json`, with that day's
  merged changes (from git) in a closed list under it. Days not yet in the file still show their
  list.
- **Embed and share** (`site/share/`, in the menu under Tools): a live example (pick a toy and every
  option; the frame is the site's own player), the iframe and `<splashery-toy>` snippets with Copy
  buttons (and the element live on a button), a table of every option, and how scene links work with
  a "make a link to any toy" picker.
- Tests: `tests/spg.spec.mjs`. Screenshots:
  `tests/screenshots/spg-{tools,science,learn,share}-*.png`.

Still to do: the walk-through clip on Effect review page 2, and a final merge of main.

## Notes

### How the new pages are built

- Page types are in `tools/site-hubs.mjs` (`hubTypes(helpers)`, registered in `PAGE_TYPES` of
  `tools/site-build.mjs` with one spread). Words and data are in `tools/site-pages.mjs`.
  `tools/site-md.mjs` is a small Markdown converter (escapes everything; headings, lists, tables,
  code, links) used for the credits and notebook pages, so they follow the files.
- A page can list `styles: ["hubs.css"]` and `scripts: ["hubs.js"]`; the shell links them after
  `site.css`. My CSS and script are separate files so the Toy pages lane can edit `site.css` without
  conflicts.
- A hub item names a toy id; the build stops with an error on an unknown id. To add a tool, add
  `{ toy: "<id>", text: "…" }` to a group in `tools/site-pages.mjs` (`hub`). To add a dataset row,
  add to `datasets` on the science page.
- `tools/site-news.json`: add an entry for a day when something visitors notice merged (plain
  sentences, no lane names).
- The credits page's entries are checked by `tests/spg.spec.mjs` against every table row and heading
  of CREDITS.md and LICENSES.md.
- Evidence links go to the JSON file on GitHub for now. When lane Toy pages builds per-toy evidence
  pages, point `evidenceHref` in `site-hubs.mjs` at them.

## Known issues

- The About page's "who and why" is a draft from README.md and the docs, for the owner to edit.
- The privacy page states the rules of CLAUDE.md for the live feeds (earthquakes, other open feeds,
  PDB fetch, the Wikipedia book, the Night sky's location tap). Some of those toys are still being
  built; check the page matches each when it lands.
- The Science table's rows are curated by hand from CREDITS.md; datasets from lanes still working
  (cryo-EM, more microscopy, earthquakes, point clouds) are not there until those merge.
- Tools lists only toys that exist today; the sound and light lab and measuring tools join when they
  land.
- What's new's per-day summaries stop at the days I wrote; the list under each day is automatic.
- Thumbnails below the fold load lazily, so full-page screenshots can show blank boxes.

## For the Operator

- Files: `tools/site-hubs.mjs`, `tools/site-md.mjs`, `tools/site-news.json`, `tools/site-pages.mjs`,
  small edits in `tools/site-build.mjs` (import and spread, per-page styles and scripts, footer
  links, `cards` in search, `TOY_TYPES`), `site/assets/hubs.css`, `site/assets/hubs.js`,
  `tests/spg.spec.mjs`, screenshots, this file.
- The credits and notebook pages follow main (they read CREDITS.md and NOTEBOOK.md), so the upkeep's
  site build keeps them current; `--check` lists them as "follows main".
- README line: "`tools/site-hubs.mjs`, `tools/site-md.mjs`: the site's hubs, credits and guide
  pages."

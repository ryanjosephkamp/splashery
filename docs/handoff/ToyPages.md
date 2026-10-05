# Lane Toy pages: a page for every toy, and the catalog PDF (prefix `tpg`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: Toy pages and the catalog (id `ToyPages`,
prefix `tpg`). Branch: `claude/lane-toy-pages` (and `claude/lane-toy-pages-engine` for the one
engine fix below). PR title: "Phase Toy pages: a page for every toy, and the catalog PDF". Handoff
file: docs/handoff/ToyPages.md (create it; start it with this brief, word for word, under "##
Brief", then keep "## State", "## Notes", "## Known issues" and "## For the Operator" current).
Model: Opus 5.5.

### Brief (written by the Operator on October 5, 2026, from the owner's Push Plan picks)

Push Plan W3 (yes): "a page for every toy", the next step after lane Site's shell (merged October 5,
2026, #266). Read docs/handoff/Site.md first, above all "How the site is built" and "How to add a
page type": you add a page type, not new machinery.

1. **A page for every toy** (about 390, labs toys included but shown only with the labs switch, as
   the gallery does): the live toy embedded the way the home page does it (`site/play/?toy=<id>`,
   inside the service worker's scope), its how-to line and About text (`src/toy-help.js`), its tap
   effect and sound in a sentence, sources, credits and license notices (CREDITS.md,
   `tools/assets.json`, `tools/models.json`; BY-SA and NC notices shown as the rules require), "Is
   it right?" from `docs/evidence/<toy id>.json` when one exists (docs/evidence/README.md; nothing
   when none), related toys (same shelf and tags), "Open in the gallery", and share and embed (the
   iframe and `<splashery-toy>` snippets, copyable). Each page gets a link preview with the toy's
   own thumbnail. The page type reads the toy list, so it goes in `TOY_TYPES` and follows main
   through the upkeep. Toy cards and search results across the site now link to the toy's page.
2. **The catalog PDF**: one toy per page (its still, name, how-to line, a link and a QR code to its
   page, credits), built by a tool (`tools/tpg-catalog.mjs`) and saved under `site/` for download,
   with a size you state. Lane PDF lab (#299, #301, not merged yet) is writing an exporter that
   makes one page per toy; reuse it once it merges, or build on the same library and say so. A
   labs-only "Download the catalog" link on the Toys page.
3. **The engine fix** (lane Site's note): `src/embed.js` passes a `splashery:theme` message straight
   to `viewer.setTheme`, which throws if it arrives before the player has started. Guard it, in a
   tiny "Engine: …" PR with its test, merged first.
4. **Test time**: the full suite already takes about four and a half hours. Don't load all 390 pages
   in a browser: check every page's HTML statically (it exists, its links lead somewhere, its
   preview tags are set) in Node, and load a sample of about 15 pages (every shelf, a labs toy, a
   toy with evidence, a BY-SA toy) in the browser.

Tests in `tests/tpg*.spec.mjs`; screenshots of two toy pages at both sizes; a short walk-through
clip at phone size on Effect review page 2 (lane record `ToyPages`).

You own: the toy page type and its code (put it in `tools/site-toy-pages.mjs`, registered in
`tools/site-build.mjs` and `tools/site-pages.mjs` with a few lines), the generated toy pages under
`site/toys/`, `tools/tpg-*.mjs`, `tests/tpg*.spec.mjs`, the embed fix through its engine PR, and
your handoff file. Lane Site pages works on the hub pages in the same build at the same time: keep
your changes to the shared build files small, and on a conflict in `site/`, take either side and
rebuild.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
replace the prefix and lane record with yours). The site is a preview under `site/` (linked from
nowhere public), so the Operator merges after a full test run; the owner decides when it becomes the
front door. Finish every working turn with "READY:", "WORKING:" or "BLOCKED:"; Splashery has no CI
to wait for; for a long job, schedule a check-in with send_later instead of going idle. Before
READY, merge origin/main into your branch (a merge commit) and rebuild `site/`.

## State

October 5, 2026. Model: Opus 5.5.

- **Engine PR #305** (`claude/lane-toy-pages-engine`): `Viewer.setTheme` keeps a theme that arrives
  before the player has started (`Player.init` applies it), instead of throwing. The guard is in
  `src/viewer.js` rather than `src/embed.js`, so `<splashery-toy>` is covered too. Test
  `tests/tpg-engine.spec.mjs` (fails without the fix). Merge it first.
- **A page for every toy**: 382 pages at `site/toys/<id>/` (63 of them labs). Each has the live toy
  (`play/?toy=<id>`, with `&turntable=off` for a toy that holds still), the how-to line, "Tap" and
  "Sound" lines (the plan's effect and sound, `tools/toy-plan.json`), About this toy, "Is it right?"
  (only when `docs/evidence/<id>.json` exists; none do on main yet), Sources and credits (the scan,
  the 3D model, a recipe's data files, samples and recorded sounds, each with its license, and the
  NonCommercial and ShareAlike notices), Share and embed (the page link, the iframe and the
  `<splashery-toy>` snippets, each with a Copy button), related toys (same shelf, then shared tags)
  and "Open in the gallery". Link preview: the toy's own 256 px thumbnail (`summary` card). Labs
  toys' pages show a "turn the labs on" note until the switch is on, and their player starts only
  then.
- Toy cards (Toys, Science, Studio, Tools, the home page's row) and toy search results now open the
  toy's page.
- **The catalog PDF**: `site/splashery-catalog.pdf`, 320 Letter pages (a cover and the 319 public
  toys, by shelf), 5.6 MB, built by `node tools/tpg-catalog.mjs`. Labs-only "Download the catalog
  (PDF, 5.6 MB)" button on the Toys page (the size is read from the file at build time).

## Notes

- **The code**: `tools/site-toy-pages.mjs` (page entries, the `toy` page type, credits, related
  toys, evidence), `site/assets/toy-page.css` and `toy-page.js` (Copy buttons; a labs toy's player),
  loaded only by toy pages. In `tools/site-build.mjs`: the `toy` entry in `PAGE_TYPES`, `"toy"` in
  `TOY_TYPES`, a per-page link preview picture (`page.image`), `precache: false` and
  `sitemap: false` honored, cards and search linking to `toys/<id>/`, and a removed toy's folder
  deleted. In `tools/site-pages.mjs`: `PAGES.push(...toyPageEntries())` and the Toys page's
  `catalog`.
- The toy pages stay out of the service worker's install (382 pages); each is kept once visited.
  Labs toys stay out of the sitemap.
- **The catalog** is printed by Chromium (Playwright's `page.pdf`, already a pinned devDependency)
  from one HTML document, with QR codes from the vendored Nayuki generator. Not pdf-lib (lane PDF
  lab's library), because #299 and #301 aren't merged; Chromium also lays out text in real fonts and
  reads the WebP stills. The stills go in as JPEG (a WebP would be stored losslessly: 15.4 MB).
  Re-run the tool after toys change; it stamps the date on the cover.
- `tests/site.spec.mjs` (lane Site's) now skips the toy pages in its page-by-page loops (they are in
  `tests/tpg.spec.mjs`), and its search test follows the result to the toy's page, then the gallery.
- Tests: `tests/tpg.spec.mjs`: in Node, every page (exists, title, description, canonical, og tags,
  the thumbnail, noindex, sitemap, its parts, every link and anchor resolves, gallery links open
  that toy, labs pages hidden, credits and notices, cards and search link to pages, the evidence
  section from a fixture, the catalog's page count and size); in the browser, 25 pages (one public
  toy from every shelf, the NC and NC-SA labs scans, a toy that holds still), the labs switch, the
  live grape with Copy and the gallery link, and screenshots.

## Known issues

- The "Tap" line is the plan's effect (`tools/toy-plan.json`), which is sometimes older than the toy
  (the sorting machine now has eight algorithms; the line names three). The About text is current. A
  pass over `effect` in the plan would fix every page at once.
- No toy has an evidence file on main yet, so "Is it right?" is tested with a fixture
  (`tests/fixtures/tpg/sorting-machine.json`) and shows on no page today.
- No asset on main is CC BY-SA alone; the one ShareAlike asset is the cherry blossom scan (CC
  BY-NC-SA, labs), whose page shows both notices.
- The catalog lists public toys only; labs toys get a page but no catalog page.

## For the Operator

- Merge #305 (engine) first.
- Files outside my own: `tools/site-build.mjs` and `tools/site-pages.mjs` (a few lines each, as
  above), `tests/site.spec.mjs` (the toy pages out of its loops; the search test).
- README line: "`site/toys/<id>/`: a page per toy (`tools/site-toy-pages.mjs`), and
  `site/splashery-catalog.pdf` (`node tools/tpg-catalog.mjs`); see docs/handoff/ToyPages.md."

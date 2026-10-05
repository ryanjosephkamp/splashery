# Lane Site: Splashery as a real site (prefix `site`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Site (id `Site`, prefix `site`). Branch: `claude/lane-site`
(and `claude/lane-site-engine` for any change to the app itself). PR title: "Phase Site: a home
page, one menu, search and offline". Handoff file: docs/handoff/Site.md. Model: Opus 5.5.

### Brief (written by the Operator on October 4, 2026, from the owner's push notes that evening)

The owner: "I want more than just the gallery here. We will have a proper site, not just one
webpage." On the Push Plan he said yes to W1 (a real home page), W2 (one menu everywhere and a
search), W11 (install it and use it offline; later maybe native apps) and W12 (the finishing pass),
and yes to the pages that come after yours (W3 a page for every toy, W4 to W8 the hubs, About,
credits, privacy and What's new, W10 the embed guide). Read his notes,
docs/reviews/2026-10-04-push-alignment/notes.md, "All right, next up we have the website stuff".

Splashery stays static files on GitHub Pages, ES modules, no bundler, no CDN, no server, no keys.
The gallery (`index.html`) is the site's home today, and **the home page is the owner's decision**:
build everything under a preview path, `site/` (served at
https://ryanjosephkamp.github.io/splashery/site/), linked from nowhere public, so he can try it and
say when it replaces the front door.

1. **The shell**: one header, menu and footer for every page (Home, Toys, Tools, Science, Studio,
   Learn, What's new, About), phone first, light and dark, in the site's own look (the gallery's
   fonts and colors). Pages are generated at build time (`tools/site-build.mjs`) from the data the
   repo already has (`src/toys.js`, `src/toy-help.js`, CREDITS.md, LICENSES.md, the docs), so the
   later lanes (toy pages, hubs) add page types, not new machinery. Write down how to add a page
   type in your handoff file.
2. **The home page** (W1): what Splashery is in one screen: a live toy (embedded the way the embed
   guide says), a sentence or two on why splats and recipes make it different, and doors to Toys
   (the gallery), Tools, Science, Studio, Worlds and Learn.
3. **Search** (W2): a small index built at build time over toys (name, shelf, tags, how-to), tools
   and pages, searched on the device; results link to the toy in the gallery (and later to its
   page).
4. **Install and offline** (W11): a web app manifest and a service worker for `site/` only during
   the preview (its scope must not reach the gallery or the app until the owner swaps the front
   door): the shell and the pages work offline after the first visit, and a toy opened once keeps
   working. Write in your handoff file what the app-wide version needs at the swap, and a short note
   on native apps later (wrapping the site for macOS, iOS and Android: the options and what each
   costs).
5. **The finishing pass** (W12): a sitemap, a 404 page for `site/`, fast first loads (measure them),
   link previews (title, description, an image) and an accessibility pass (keyboard, labels,
   contrast, reduced motion). Propose a root 404 for the swap rather than adding one now.

#### Deliverables

- Tests in `tests/site*.spec.mjs`: every page builds and loads, the menu works on a phone, search
  finds a toy by its tag, the service worker's scope stays under `site/` and the page works offline
  after one visit, no page breaks the gallery, and the "embed transfer ≤ 30 MB" test stays green.
- Screenshots of the home page and a search at both sizes; a short walk-through clip.

#### You own

`site/` (new), `tools/site-build.mjs` and `tools/site-*.mjs`, `tests/site*.spec.mjs`, and this file.
Changes to the gallery or the app (`index.html`, `src/`) only through the engine PR, small and
additive.

#### How this lane runs

- The Operator session runs the lanes. The owner, Ryan, talks only to the Operator. Don't ask him
  anything or wait for him. Put questions and blockers in your final message ("READY:", "WORKING:"
  or "BLOCKED:"), and the Operator answers or relays them. Messages that arrive "From the Operator"
  come from the coordinator on the owner's behalf.
- Model: Opus 5.5 only, at the default effort. Any helper you start uses the same model. At most one
  helper at a time.
- This is the October push (October 5 to 7, 2026): about ten lanes build at once. Edit only the
  files you own and your own toys' lines in the shared lists (`src/toys.js`, `src/toy-sounds.js`,
  `src/toy-help.js`, `tools/toy-plan.json`, `tools/assets.json`, `CREDITS.md`). Merge main into your
  branch whenever it moves (never rebase a pushed branch). Regenerate docs/TOY-PLAN.md with
  `node tools/toy-plan.mjs`; never merge it by hand.
- Engine changes: small, additive and tested, on `<your branch>-engine` with a draft PR titled
  "Engine: …", merged first. Toys that don't use them behave exactly as before.
- Merging: The preview pages are linked from nowhere public, so the Operator merges them after a
  full test run; making them the front door is the owner's call. Never merge anything yourself.
- Everything new is behind the labs switch (`labs: true`) unless this brief says otherwise. Old
  `#s=` links and saved scenes (schema v2 and v3) keep loading.
- Licenses (CLAUDE.md, "Ground rules"): read each asset's or dataset's license on its live source
  page; record it in CREDITS.md, `tools/assets.json` (or `tools/models.json`) and the toy's in-app
  credit; `"nc": true` on NC assets; never ND, unlicensed, personal-use or paid. A new open-source
  library is fine when it's needed (the owner's rule of October 4, 2026): vendor it in `vendor/`,
  load it only when its toy opens, list it in LICENSES.md, and name it in your PR; a copyleft
  license (GPL, AGPL), a library that calls a server, or one over 2 MB goes to the Operator first.
- Effects follow CLAUDE.md, "Effect quality rules": real motion of solid pieces, judged as clips at
  phone size.
- Tests: `tests/site*.spec.mjs`; never edit `tests/taps.spec.mjs`. Before each push run your own
  specs and the specs of the files you touch (say which in the PR); the Integrators run the full
  suite before a merge. Prettier, `node tools/us-english.mjs --diff`, and for toys
  `node tools/check-packs.mjs <pack>`, a contact sheet and thumbnails (CLAUDE.md, "Before every
  push"). Screenshots `site-<name>-390x844.png` and `…-1440x900.png`, then
  `node tools/upkeep.mjs --restore-shots`.
- Clips: post every new or changed effect on Effect review page 2
  (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as docs/OPERATING.md, "Steps for a lane", says
  (lane record `Site`), after watching each one. After posting, check the owner's marks about once
  an hour with a scheduled check-in (send_later); stop once your PR is merged or closed.
- Language: American English for every new text (color, center, gray, license, toward, -ize endings,
  dates like "October 5, 2026").
- Your handoff file: start it with this brief, word for word, under "## Brief", then keep "##
  State", "## Notes", "## Known issues" and "## For the Operator" current.
- PR: one draft PR against main (five sections: Summary, Verification, Deviations, Known issues,
  What was cut), opened early and pushed after each finished item. Finish every working turn with a
  final message that starts "READY:", "WORKING:" or "BLOCKED:".

## State

READY for review (October 5, 2026), PR #266. Model: Opus 5.5. No engine PR: nothing in the app or
the gallery changed.

Done, all under `site/` (https://ryanjosephkamp.github.io/splashery/site/ once merged, linked from
nowhere public, `noindex` while it is a preview):

- **The shell**: one header, menu (Home, Toys, Tools, Science, Studio, Learn, What's new, About),
  search box, theme button (Auto, Light, Dark) and footer on every page; phone first (the menu folds
  behind a Menu button under 1000 px), the gallery's fonts and colors, light and dark.
- **The pages**: Home, Toys (every shelf, thumbnails, each toy opens in the gallery), Tools,
  Science, Studio, Learn, What's new (from the merged PRs in the git history, minus "Ops:"), About
  (what it is, privacy, the terms of use from the gallery's About tab, the captured toys' credits),
  Search and a 404 page. The hubs are first drafts for the Site pages lane (W4 to W8) to grow.
- **The home page**: the name, a live strawberry (the embed player), two sentences on why splats and
  recipes, and doors to Toys (the gallery), Tools, Science, Studio, Worlds (labs only) and Learn.
- **Search**: `site/search-index.json` (every toy, tool and page; 180 KB, 32 KB gzipped, loaded only
  when someone searches), searched on the device like the gallery's own search (every word must
  match; names first). Toy results open the toy in the gallery; labs toys show only with the labs
  switch on (the same `splashery.labs` switch as the gallery).
- **Install and offline**: `site/manifest.webmanifest` (scope `./`) and `site/sw.js`, whose scope is
  `site/` only. The shell is cached on install; pages and code come from the network first; pictures
  and splat files from the cache first. On the first visit the page tells the worker which files it
  already loaded, so the home page's toy works offline from the second visit on. A page under
  `site/` that isn't there gets `site/404.html` (status 404), online or offline.
- **The finishing pass**: `site/sitemap.xml`, the 404 page, link previews (title, description, a
  1200×630 picture, `site/assets/og.png`, rendered by `tools/site-og.mjs`), skip link, labels, 44 px
  targets, AA contrast in both themes, reduced motion respected (the toy holds still).
- **Measured** (local server, headless Chromium): the home page's shell is 26 KB and first paint is
  about 110 ms; with the live toy the page transfers 8.9 MB (the engine and the strawberry's lighter
  or full splat file).

- **Design pass r2** (the owner's note on the walk-through, October 5, 2026: "make sure that this
  site feels premium"): a headline hero with the live toy on a soft glow of the logo's three splat
  colors, real counts (toys, shelves, zero uploads), a "From the shelves" row, three short reasons
  with small drawings, door cards with toy thumbnails, a closing call to the gallery, a frosted
  sticky header (a search button on phones), sticky shelf chips that scroll sideways on a phone, and
  a fuller footer. Still no web fonts and no images beyond the toys' own thumbnails: the home page's
  own files are 57 KB (about 11 KB gzipped on GitHub Pages).

## Notes

### How the site is built

- `node tools/site-build.mjs` writes everything under `site/` except `site/assets/` (hand-written:
  `site.css`, `site.js`, `search.js`, `offline.js`, `play.js`; `og.png` from
  `node tools/site-og.mjs`, which needs the local server). Commit what it writes. Never edit a
  generated file by hand; on a merge conflict in `site/`, take either side and rebuild.
- `node tools/site-build.mjs --check` lists files that are out of date. `site/new/index.html` and
  `site/sw.js` change whenever main gains a merged PR (What's new reads the git history), so rebuild
  after merging main; the test allows those two to lag.
- The menu, the pages and their words are in `tools/site-pages.mjs`; every link there is written
  relative to `site/`, and the build adds the way back up for each page's depth.
- `site/play/` is the embed player (`embed/index.html`, rebuilt one folder deeper). The home page
  embeds the toy from there, inside the worker's scope, so the worker sees every file the toy loads.
  Later toy pages should embed toys the same way (`play/?toy=<id>`, any embed option).
- Toy links to the gallery are `../#s=j.<base64url of a version 3 scene>` with the toy's camera (and
  the turntable off for a toy that holds still): no gallery change was needed.

### How to add a page type

1. In `tools/site-build.mjs`, add a function to `PAGE_TYPES`: `(page, { up }) => html` returns what
   goes inside `<main>`; `up` is the prefix back to `site/` (`""`, `"../"`, …). Reuse `intro(page)`,
   `shelfSections(ids, up)`, `toyCard(t, up)` and `galleryHref(t)`.
2. In `tools/site-pages.mjs`, add pages with `type: "<your key>"`, a `path` ending in `/`, a `nav`
   (the menu item it lights up, or `null`), a `title`, a `description` and the type's own fields.
   Many pages of one type (a page per toy) can be pushed onto `PAGES` in a loop there.
3. If it should be found, add its words in `searchEntries()`. Sitemap, service worker precache and
   link previews pick new pages up by themselves.
4. Run the build, and add the page's checks to a `tests/site*.spec.mjs` file; "every page loads" and
   "the links lead somewhere" in `tests/site.spec.mjs` already cover every entry in `PAGES`.

### At the swap (when the owner makes the site the front door)

- **Where the pages go**: either move `site/*` to the root (the gallery moves to, say, `play/` or
  `toys/`), or keep the gallery at the root and make only the home page new. Either way `#s=` links
  must keep opening in the gallery: the root page has to send any URL with `#s=` (and the old query
  options) to the gallery before it paints, so old shared links keep working.
- **The service worker**: one worker at the root (`/splashery/sw.js`, scope `/splashery/`) replaces
  the site's. It must then also cover the gallery and the app: network first for `index.html`,
  `src/` and `vendor/` code (never mix old and new modules), cache first for `assets/toys/`, and a
  version bump on every deploy. The site's worker at `site/sw.js` must be removed with an
  unregistering worker left in its place for one release, so old visitors don't keep a stale shell.
  The root `manifest.webmanifest` already exists and would gain `id`.
- **Offline for every toy**: a toy works offline once played; an "Offline" switch could fetch the
  whole shelf (about 500 MB for every toy's files today, about 140 MB of the scans are their light
  copies), so it should be opt-in and say the size.
- **A root 404** (proposed, not added): `404.html` at the root with the site's shell, which also
  sends `…/#s=` links and old toy addresses to the gallery, and suggests a search for the path's
  words. GitHub Pages serves it for every missing path.
- Set `preview: false` in `tools/site-pages.mjs` (drops `noindex`), and add a `robots.txt` at the
  root pointing at the sitemap.

### Native apps later (macOS, iOS, Android)

Splashery is static pages, so every route wraps the same files; the choice is about stores and
device features (saving files, the camera, offline).

- **Installed web app (now)**: free; Chrome, Edge and Android install it from the browser; Safari on
  macOS ("Add to Dock") and iOS ("Add to Home Screen") too. Works offline with the service worker.
  No store, no review, updates with the site. iOS limits storage for web apps and may clear it after
  weeks unused.
- **Android store (TWA)**: wraps the installed web app for Google Play (Bubblewrap or PWABuilder).
  About a day's work, a one-time $25 developer fee, and a Digital Asset Links file on the site. The
  app is the site, so it updates with it.
- **Capacitor (iOS and Android)**: the files ship inside a native shell with plugins for files,
  sharing and the camera; truly offline from install. A few days to set up, then a store release for
  each update; Apple's developer program is $99 a year, and App Review wants it to feel like an app,
  not a website.
- **macOS desktop**: Tauri (small, uses the system's WebKit; WebGPU support depends on the Safari
  version) or Electron (bundles Chromium, about 150 MB, the same engine as Chrome). Signing and
  notarizing need the Apple developer account. Tauri also builds for Windows and Linux.
- Suggested order: installed web app (done with the swap), then a TWA for Android, then Capacitor
  for iOS if the owner wants the App Store.

## Known issues

- Toy results and cards open the toy in the gallery (the toy pages come with W3).
- The hubs' words are first drafts; the Site pages lane owns them next.
- What's new lists PR titles as they were written (some older ones are lane jargon); W7 can add a
  curated summary per release.
- The service worker only controls `site/`, so the gallery itself is not yet offline (by design
  during the preview).

## For the Operator

- No engine PR, no shared lists touched. Files: `site/`, `tools/site-build.mjs`,
  `tools/site-pages.mjs`, `tools/site-og.mjs`, `tools/site-sw.template.js`, `tests/site.spec.mjs`,
  screenshots `tests/screenshots/site-*.png`.
- README line (for the Operator): "`site/`: the preview site (home page, one menu, search, offline),
  built by `node tools/site-build.mjs`; see docs/handoff/Site.md."
- After each merge to main that adds PRs, What's new is stale until someone runs the build; the
  upkeep (`tools/upkeep.mjs`) could run `node tools/site-build.mjs` too.

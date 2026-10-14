# Lane Site r4: ready for the front door (prefix `st4`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session,
session_01GX3jNDDvRMLYjDGmHuDmNN). Repo: ryanjosephkamp/splashery. Your lane: Site r4 (id `SiteR4`,
prefix `st4`). Branch: `claude/lane-site-r4` (and `claude/lane-site-r4-engine` for any change to the
app outside your own files, as an "Engine: …" PR merged first). PR title: "Phase Site r4: ready for
the front door". Handoff file: docs/handoff/SiteR4.md (create it; start it with this brief, word for
word, under "## Brief", then keep "## State", "## Notes", "## Known issues" and "## For the
Operator" current). Model: Sonnet 5.5, at high effort.

Read CLAUDE.md, docs/HANDOFF.md ("Now"), docs/OPERATING.md, docs/handoff/ScienceR3.md ("How this
lane runs", with your prefix and lane record), then docs/handoff/Site.md (especially "At the swap"),
docs/handoff/SitePages.md, docs/handoff/SiteR2.md and docs/handoff/SiteR3.md.

### Brief (written by the Operator on October 11, 2026; the owner said yes to front-door prep before the weekly reset)

The site under `site/` is still a preview (`noindex`), and the app at the root is the front door.
The owner will decide when the site becomes the front door, after his own walkthrough (his notes
come later, as a separate round). Your job: build everything Site.md's "At the swap" lists, so that
the swap itself becomes one small, reviewed change. Nothing the public sees may change today except
the 404 page (item 2).

1. **One switch.** Add a single setting (for example `FRONT_DOOR` in tools/site-pages.mjs, default
   off) and a build mode that writes the swapped layout into a staging folder outside site/ (say
   `.cache/front-door/`), never into the live files, so it can be served and tested locally. With
   the switch on, the build must: put the site's home page at the root and move the gallery app to
   its own path (the option Site.md prefers, or argue for the other in your PR); keep every `#s=`
   link and the old query options opening in the gallery before anything paints; drop `noindex`
   (`preview: false`); keep every existing URL working (old `/splashery/site/...` pages redirect to
   their new homes, and the old root `index.html?...` and `#s=` forms still open the app).
2. **A root 404 page** (this one may ship now): `404.html` at the repo root with the site's look,
   which sends `#s=` links and old toy addresses to the right place and suggests a search for the
   path's words. Check it doesn't break `site/404.html` or the app.
3. **One service worker, staged.** Write the root worker Site.md describes (network first for
   index.html, src/ and vendor/; cache first for assets/toys/; a version bump per deploy), plus the
   unregistering stand-in for `site/sw.js`, but wire them only in the staged build. Test offline and
   upgrade in the staged build with Playwright (a stale old worker must not leave visitors on old
   code).
4. **Offline per toy:** document the opt-in "save the whole shelf offline" design with real sizes
   (measure them); don't build the switch.
5. Skip robots.txt: crawlers only read it at the host root (ryanjosephkamp.github.io/robots.txt, the
   owner's personal site's repo). Say so in the handoff.

You own: tools/site-build.mjs, tools/site-pages.mjs (except the "What Splashery can do" page, which
Manual r6 is fixing right now: don't edit that page's entry), tools/site-hubs.mjs,
tools/site-md.mjs, site/ (regenerate with `node tools/site-build.mjs`, `npx prettier --write site`,
`node tools/site-build.mjs --check`), the new root 404.html, the staged worker files, and
tests/st4\*.spec.mjs. Root index.html, src/ or the app's own service worker only through the engine
branch, and only if the staging can't work without it.

Cards on Effect review page 2 (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK), ids st4-…, naming
Sonnet 5.5, as docs/OPERATING.md, "Steps for a lane", says (no republish): the 404 page at 390×844
(a missing path, and an old toy address), and the staged front door's home page and gallery at
390×844 and 1440×900, labeled "staged, not live".

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (replace the
prefix and lane record with yours). The 404 page is public, so the Operator merges after your tests
and the owner's "good" marks. Finish every working turn with "READY:", "WORKING:" or "BLOCKED:";
Splashery has no CI to wait for; for a long job, schedule a check-in with send_later instead of
going idle. Before READY, run CLAUDE.md's "Before every push" steps (site, spg, tpg, st2, st3,
smoke, help, unit and your own specs). When main moves, merge it into your branch (never rebase).
Usage is tight until the weekly reset (Wednesday, October 14, 2026, 4 p.m. ET): no helpers unless
you must; aim for a first READY within about five hours.

## State

READY for review (October 11, 2026), model Sonnet 5.5. Draft PR (lane) and #537 ("Engine: share,
embed and element links name the project's root", merge it first; the swap needs it, today's 404
does not).

- Item 1 (one switch, staged layout): done and tested, including a real in-place swap on a scratch
  worktree (second build "current", `prettier --check .` clean, home, Playground, `#s=`, old `site/`
  addresses and the live 404 all worked in a browser).
- Item 2 (root 404): done; the only public change. Tested for status 404, search, `#s=` and
  old-toy-address forwarding, and the `*.github.io/<project>/` base.
- Item 3 (worker): both workers written and staged only; offline and upgrade tested (see Notes).
- Item 4 (offline sizes): measured and documented; `tools/site-offline-sizes.mjs`.
- Item 5 (robots.txt): skipped, reasons in Notes.
- Cards st4-… (six, naming Sonnet 5.5) are on Effect review page 2; marks not read yet.

Tests: `tests/st4.spec.mjs` (22 tests) and `tests/st4-server.mjs`; engine:
`tests/st4-engine.spec.mjs`.

## Notes

### What ships today, and what doesn't

Today's public change is one file: `404.html` at the repo root (and the small script it loads,
`site/assets/not-found.js`). Everything else is staged or tooling: `site/` itself rebuilds byte for
byte as before, apart from `site/sw.js` (it now also lists `not-found.js`) and `site/404.html` (the
same page; its `<meta charset>` now comes before the base script).

### The one switch, and the swapped layout

`FRONT_DOOR` in `tools/site-pages.mjs` (default `false`). The swapped layout is built by
`tools/site-front-door.mjs` from the same page generators; `tools/site-build.mjs` builds every page
once, the way the preview has it (links relative to `site/`, the Playground one folder up), and
`swapLayout()` moves that into the final layout.

- `node tools/site-build.mjs --front-door` stages it in `.cache/front-door/` (git-ignored). The
  app's own folders and files (`src/`, `vendor/`, `assets/*`, `embed/`, `worlds/`, `manual/`,
  `styles.css`, …) are symbolic links, so the folder can be served as it is:
  `python3 -m http.server 4173 --directory .cache/front-door` (or the `tests/st4-server.mjs` server,
  which also answers a missing path with `404.html` and status 404, like GitHub Pages).
  `--out <dir>` stages somewhere else.
- With `FRONT_DOOR = true` the same build (no flag) writes the layout into the repo itself (the
  swap).

```
/                      the site's home page (old "#s=" links and query options go on to playground/
                       before anything paints; "?labs" and tracking parameters stay on the home page)
/playground/           the Playground, the app that was /index.html
/toys/ /tools/ /science/ /studio/ /learn/ /new/ /about/ /search/ /share/ /play/    the site's pages
/assets/…              the site's own styles and scripts join the app's assets/ (no names collide)
/sw.js                 the one service worker, scope: the whole project
/404.html              the root 404 page, live form (full menu)
/sitemap.xml /search-index.json /manifest.webmanifest (now with "id")
/site/…                a redirect for every old page, the stand-in worker, and the few files other
                       things still point at (assets/outline.{css,js}, assets/og.png,
                       splashery-catalog.pdf)
```

**Why `playground/` and everything else at the root** (Site.md's preferred option): the home page
has to be at `/` for the front door to be the site; the other option (the gallery stays at `/` and
only the home is new) would leave the site's home at `/home/` and the app as the front door.
`playground/` is also what the app's button is called since Site r3. Old links keep working because
the home page forwards them, so the cost of moving is one extra hop for old links, not a broken
link.

**How a link is moved.** Preview pages write the way up as `../`×(depth+1): `../` is the Playground,
`../assets/…` and `../manual/` are the app's files. `lift()` takes one `../` off any
`href`/`src`/`action`/`data-src`/`url(…)` that climbs above `site/`, and sends a bare `../`, `../#…`
or `../?…` to `playground/`. The build then fails if any link on any page still climbs above the
root. The three hand-written scripts that know where things are (`hubs.js`, `play.js`) get exact
string replacements that throw if the text isn't found, so a change to those lines can't silently
skip the swap. Absolute URLs (canonical, `og:`, sitemap) are rewritten from `…/splashery/site/` to
`…/splashery/`, and the preview's footer sentence and `noindex` line are simply not generated (the
swapped build sets `SITE.preview = false`).

**Old addresses.** Every old page gets `site/<path>/index.html`: a meta refresh plus a script that
keeps `?query` and `#hash` (`site/search/?q=duck` lands on `search/?q=duck`). `site/404.html` goes
to the home page. `site/manifest.webmanifest` stays (an installed preview opens the new home).
`site/sitemap.xml`, `site/search-index.json` and the old `site/assets/*` (except the four files
above) are removed: a sitemap can only name URLs under its own folder, and nothing links to the
others.

**The Playground's file** is the old `index.html` one folder deeper: every page-relative `href`,
`src` and importmap path gets a `../`, `google-site-verification` carries over to both pages, and a
small script registers the root worker and, eight seconds after load, hands it the list of files the
page loaded (so a toy played once is kept on a first visit, which the worker couldn't see). After
the swap `playground/index.html` is the source; the build reads it from there (and leaves it alone).

### The root 404 page

`404.html` at the repo root, built by `node tools/site-build.mjs` (it is checked by `--check`). Two
forms, one script (`site/assets/not-found.js`):

- **Preview form (today).** A small page in the site's look (header with the logo, the site's
  styles, the search results markup) that links to nothing in the preview. A missing path gets
  status 404 and `noindex`. It reads the path's words ("/toys/rubber-duckk" → "toys rubber duckk";
  plumbing such as `site`, `html`, `index` and numbers is dropped), searches the toys in
  `site/search-index.json` on the device (every word must match; if nothing matches, the longest
  word alone), and lists up to eight toys that open in the Playground (`/#s=j.…`). A path that
  contains a toy's id (`/x/grape.html`, `/toys/grape`) goes straight to that toy. A `#s=…` link on
  any missing path is sent to `/` with its query and hash before the page paints. The search box
  searches again.
- **Live form (staged).** The same page inside the full shell (menu, search, footer), searching
  toys, tools and pages in `search-index.json`; toy results go to the toys' own pages, an old toy
  address to `toys/<id>/`, a `#s=` link to `playground/#s=…`.

Both write their own `<base>`, styles and scripts in one `document.write` in the head, because the
page is served at any depth and the browser's early look-ahead would otherwise fetch the styles from
the wrong folder first (a 404 in the console). The base is `/<project>/` on `*.github.io` and `/`
anywhere else. `site/404.html` is untouched in kind: GitHub Pages only serves the root one, so
`site/404.html` still only serves the preview's service worker.

### The one service worker (staged)

`tools/site-sw-root.template.js` becomes `/sw.js`; `tools/site-sw-retire.template.js` becomes
`site/sw.js`. Neither is wired into the live site: `site/sw.js` is still the preview's worker, scope
`site/`.

- **Code is never stale.** `index.html`, every page, `src/`, `vendor/` and every
  `.html .js .mjs .css .json .webmanifest .txt .xml .wasm .onnx` file come from the network first;
  the cache answers only when the network fails or takes more than five seconds. `assets/toys/**`
  and the other media come from the cache first and refresh in the background. A page that isn't
  there gets the cached `404.html` with status 404, online or offline.
- **A version per deploy.** The cache `splashery-shell-<version>` holds the precached shell (every
  page, the site's styles and scripts, `playground/`, the search index, the icons); `<version>` is a
  hash of everything in it, so any change to the shell makes a new worker, which activates at once
  (`skipWaiting`, `clients.claim`) and deletes the old shell. It also deletes the preview worker's
  `splashery-site-*` caches.
- **The stand-in** deletes the `splashery-site-*` caches, unregisters itself and reloads the open
  pages (they get the redirects). It has no fetch handler. Keep it for at least one release.
- **Tests** (`tests/st4.spec.mjs`, "the staged service worker"): scope is the root; the home page, a
  hub and the search page work offline; an unknown page answers with the 404 page offline; a
  Playground opened once opens again offline with its toy (grape); deploy B (another home page,
  another `site.js`, another worker version) replaces deploy A's shell at once, serves B's code even
  though A's was cached, and offline afterwards shows B; and a visitor whose browser still holds the
  preview worker (scope `site/`) is cleaned up (registration and caches gone) and lands on the new
  pages.

### Offline for a whole shelf (design, not built)

An opt-in button on each shelf ("Save this shelf offline, 362 MB"), never automatic. Measured with
`node tools/site-offline-sizes.mjs` (on-disk bytes under `assets/toys/<id>/`, October 11, 2026):

| Shelf (toys)                             | All its files       | A full device saves | A weak device saves (light copies) |
| ---------------------------------------- | ------------------- | ------------------- | ---------------------------------- |
| Photoreal (72)                           | 511 MB              | 362 MB              | 180 MB                             |
| Space (40)                               | 87 MB               | 87 MB               | 87 MB                              |
| Studio (22)                              | 79 MB               | 79 MB               | 79 MB                              |
| Science (9)                              | 37 MB               | 37 MB               | 37 MB                              |
| Clothing (4)                             | 16 MB               | 16 MB               | 16 MB                              |
| Open me (14)                             | 11 MB               | 11 MB               | 11 MB                              |
| Earth and maps (9)                       | 11 MB               | 11 MB               | 11 MB                              |
| Atoms (10)                               | 7 MB                | 7 MB                | 7 MB                               |
| Toys (16)                                | 3 MB                | 2 MB                | 1 MB                               |
| every other shelf (15 shelves, 280 toys) | under 3 MB together |                     |                                    |
| **Every toy**                            | **786 MB**          | **621 MB**          | **438 MB**                         |

The 786 MB includes 150 MB of light copies (`*-lite.sog`) and 4.7 MB of thumbnails. Fixed parts a
visitor needs once: the app's code 11.9 MB (3.6 MB gzipped), the site's pages 3 MB plus the toy
pages 11 MB, sounds 1.1 MB, other assets 18 MB (flags, proteins, worlds, icons). So: everything
except Photoreal is about 260 MB; Photoreal is the one shelf worth a size warning. (Site.md said
"about 500 MB"; the light copies make it 438 to 621 MB depending on the device.)

How it would work:

1. **The list.** `tools/site-offline-sizes.mjs` already walks each toy's files; a build step would
   write `offline/<shelf>.json` (the URLs, the size, and which are light copies) next to the pages,
   so the page can show the real size and the worker needs no guessing.
2. **The button.** On the Toys page and in the Playground's shelf header: size, free space
   (`navigator.storage.estimate()`), and "Save" / "Pause" / "Remove". The page posts
   `{ type: "splashery:save", shelf, urls }` to the worker.
3. **The download.** The worker fetches three files at a time into `splashery-offline-<shelf>` (a
   cache of its own, so "Remove" is one `caches.delete` and the runtime cache is untouched), reports
   progress by `BroadcastChannel`, resumes after a closed tab (the list of what's left lives in
   IndexedDB), and stops on a full disk. A weak device (the app's `profile=weak` test) takes the
   light copies instead of the full ones.
4. **Lookups.** `cacheFirst` already checks every cache (`caches.match`), so saved files are served
   with no change to the fetch rules.
5. **Storage.** Ask for `navigator.storage.persist()` on the tap. Safari may drop a site's script-
   written storage after seven days without a visit unless the site is on the Home Screen; the
   button says so ("Add Splashery to your Home Screen to keep these").
6. **Cost.** About a day and a half: the manifest step, the worker's queue, the button and its
   states, and tests with a small fake shelf.

### robots.txt: skipped

Crawlers read `robots.txt` only at the host's root, and `ryanjosephkamp.github.io/robots.txt`
belongs to the owner's personal site repo (`ryanjosephkamp.github.io`), not to this project; a file
here would never be read. What the swap does instead: drops `noindex`, ships `sitemap.xml` at the
project root (`https://ryanjosephkamp.github.io/splashery/sitemap.xml`, which may name any URL under
`/splashery/`), and keeps `google-site-verification` on the home page and the Playground. If the
owner wants crawlers pointed at it without Search Console, one line in his personal repo's
`robots.txt` does it: `Sitemap: https://ryanjosephkamp.github.io/splashery/sitemap.xml`. His call.

### The swap, step by step

1. Merge the engine PR first (`src/exports.js`: the app's share, embed and element links name the
   project's root, not the page's folder; without it the Playground's embed snippet would point at
   `playground/embed/`).
2. Branch from main. In `tools/site-pages.mjs` set `FRONT_DOOR = true`.
3. `node tools/site-build.mjs`. This writes the layout into the repo: `playground/index.html`, the
   home page as `index.html`, the site's pages at the root, `sw.js`, `404.html` (live form),
   `sitemap.xml`, `search-index.json`, the root `manifest.webmanifest` (plus `id`), the site's
   scripts and styles into `assets/`, and turns `site/` into redirects, the stand-in worker and the
   four kept files. Git shows the moves. `node tools/site-build.mjs --check` should then say "The
   swapped layout is current."
4. `npx prettier --check .`; run the full suite. Expect changes in the specs that read `site/` or
   open `/site/…` (man4, opm, site, spg, st2, st3, st4, tp2, tpg): they point at the root now. Every
   other spec opens `/` with options (`/?renderer=webgl2&profile=weak`) and still works through the
   home page's forwarding script, one hop later; a spec that checks the URL or `location` after
   opening `/` sees `/playground/…`.
5. Check by hand on the preview deployment of the branch, if there is one: `/`, an old shared `#s=`
   link, `/?renderer=webgl2`, `/site/`, `/site/toys/grape/`, a missing path, the Manual, and
   (online, then offline) a toy.
6. README and docs: "The Playground is at `/playground/`"; `docs/OPERATING.md` and
   `tools/upkeep.mjs` run `node tools/site-build.mjs` as before (it now writes the swapped layout).
7. Leave `site/sw.js` (the stand-in) and the redirects for at least one release.

What the swap does **not** touch and that still says "back to the Playground" with `../`:
`embed/index.html`, `worlds/index.html`, `manual/*.html` (and `manual/build-pages.mjs`). After the
swap `../` is the home page, one tap from the Playground; changing those links is a small follow-up
for their owners (or for the Operator's upkeep), not part of the swap.

## Known issues

- Staged only: until `FRONT_DOOR` is flipped, nothing reads `.cache/front-door/`; `site/sw.js` is
  still the preview worker.
- At the swap the specs that read `site/` (man4, opm, site, spg, st2, st3, st4, tp2, tpg) need a
  base change (see "The swap, step by step", step 4). Not done here: they are other lanes' files.
- `embed/`, `worlds/` and `manual/` still link back with `../`; after the swap that is the home
  page.
- The hub `tools/index.html` lands in the repo's own `tools/` folder next to the build scripts
  (GitHub Pages serves both; no clash). Argue for another path (`toolbox/`) if that bothers anyone.
- The preview 404 reads `site/search-index.json`; if that file is missing the page still shows, with
  "Search isn't available right now."
- Safari's seven-day storage rule and a first visit's files: see the offline design.

## For the Operator

- Merge order: engine PR #537, then this one. Merging this PR changes the public site only by the
  new root `404.html` (and `site/assets/not-found.js`, which only it loads); `site/` pages are the
  same bytes (`site/404.html` has its charset line first; `site/sw.js` also lists `not-found.js`).
- Needs the owner's "good" on the two 404 cards. The four "staged, not live" cards are for his
  walkthrough; flipping `FRONT_DOOR` is the swap (Notes, "The swap, step by step").
- After the swap, `tools/upkeep.mjs` (which runs the site build) writes the swapped layout.
- Suggestion: after the swap, point `embed/`, `worlds/` and `manual/` back-links at `playground/`.

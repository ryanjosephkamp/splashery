# Codex task 91: The Playground before the release: the shelf grid, the overlaps, Featured, and the shelf order

**Branch:** `codex/playground-release-ui`, cut from `main`. One draft PR against `main`. Read
`AGENTS.md`, `builders/RULES.md`, and CLAUDE.md.

## Why

The owner's walkthrough of October 15, 2026, and an outside playtest the same day found the toy
shelf broken on a phone and on desktop, and two controls overlapping. The owner also wants the
shelves in a new order, a curated **Featured** shelf, and a better first toy than the cactus. All of
this is public, so the owner sees screenshots before the merge.

## Part 1: the regressions (do these first)

The cause of the first two is one rule from Codex task 52 (merged October 15):
`body.app button { min-height: 44px }` in `styles.css` (about line 3470).

1. **The shelf grid collapses.** In the "All" shelf (and any long shelf), every row is held to 44
   px, so thumbnails overlap and the toy names are hidden behind them. It shows on desktop
   (1280×742) and in the phone grid (390×844, the drawer dragged up). Short shelves look fine. Fix
   the grid (for example `grid-auto-rows: max-content` on `.shelf`) without losing task 52's 44 px
   tap targets anywhere else.
2. **▶ Play overlaps the zoom "−" button** by about 20 px at 1280×742 and in phone landscape
   (`#hands-play` and `#stage-zoom-out`). Lay them out so they never touch, at every size below.
3. **Small screens:** at 320×568 the toolbar wraps over the toy and the caption overlaps it; at
   844×390 the tool pills are cut off and the tagline is covered; at 390×844 with the panel expanded
   the toolbar icons cover the top of the toy. Fix each so nothing overlaps and nothing is cut off.
4. **Search in normal mode:** searching for a labs-only toy ("QR") shows an empty shelf with no
   message, because hidden labs cards still count as results. Build the list from the toys that are
   on the shelf, and show the "no toys match" message when none are.

## Part 2: Featured, and the shelf order

1. **A Featured chip** right after "All". It is a virtual chip like "All" (not a new entry in
   `CATEGORIES`: tests and site tools iterate that list). Its toys come from one small data list
   (for example `src/featured.js`), in the order below; in normal mode it shows only the public
   ones, with labs on it shows all. The owner picks this list; change nothing in it on your own.
   Ids: `photo-3d`, `moving-photo-3d`, `video-3d`, `powers-of-ten`, `laptop`, `electronic-keyboard`,
   `electron-microscope`, `ripple-tank`, `cryoem-map`, `galaxy-box`, `smlm-microscope`,
   `thermal-ellipsoids`, `longtail`, `volume-viewer`, `qr-picture`, `qr-damage`, `qr-code`,
   `model-splats`, `chladni-cell`, `chladni-plate`, `song-landscape`, `photo-album`, `your-book`,
   `enigma-machine`, `turing-machine`, `word-vectors`, `gaussian-splatting`, `gradient-descent`,
   `cnn`, `splat-equation`, `hypercube`, `lorenz`, `chess-set`, `puzzle-cube`, `newtons-cradle`,
   `lava-lamp`, `real-elements`, `molecule-viewer`, `orbital-atlas`, `unit-cells`,
   `crystal-lattice`, `protein`, `molecule`, `atom`, `dna-to-protein`, `solar-orbits`,
   `real-galaxies`, `star-systems`, `nearby-stars`, `real-mercury`, `real-venus`, `real-earth`,
   `real-mars`, `basketball`, `knot`, `blob`, `torus`, `knight-horse`, `bmx-bike`, `cave-lioness`,
   `grape`, `blueberry`, `bee`, `strawberry`. (If task 97 later folds the 4D shapes or the
   attractors into one toy, that toy takes the place of `hypercube` or `lorenz`.)
2. **The shelf order**, left to right: search, Surprise me, All, Featured, then Studio, Pictures and
   pages, AI and computing, Science, Space, Math, Atoms, Photoreal, Lab, Shapes, Arcade, Toys,
   Balls, Imaging, Earth and maps, Music, Open me, Nature, Weather & fire, Food, Gems, Body, Tiny
   world, Clothing, Medieval, Animals, Holidays, Vehicles, Landmarks. Every shelf stays; none is
   removed or renamed. "All" follows the same order. Labs-only chips keep hiding when labs is off.
3. **The first toy on a fresh visit** (no link, no saved scene) is a random toy from Featured (a
   public one in normal mode), not the cactus. Links (`#s=`), saved scenes, `/embed/`, and
   `<splashery-toy>` without a toy keep exactly what they do today. Give tests a documented way to
   pin the first toy (a URL parameter is fine), and update the smoke tests that assume the cactus
   (about 13 checks in `tests/smoke.spec.mjs`) to pin it, keeping each check as strict as before.
   Add a test that a fresh visit opens a Featured toy. Never edit `tests/taps.spec.mjs`.
4. Regenerate `site/` with `node tools/site-build.mjs` if the order or the chips show there.

## Evidence

Before and after screenshots of the shelf grid ("All" and Featured), the Play and zoom buttons, and
the toolbar, at 390×844, 1440×900, 320×568, and 844×390, in the PR (each image at most 1 MB). Say
which smoke tests changed and why.

## Rules

The app UI files only (`styles.css`, `index.html`, `src/ui.js`, `src/app.js`, `src/toys.js` for the
order, the new featured list, and the tests named above). No toy's look or behavior changes.
American English and the serial comma. Before you push: `npx prettier --check .` and
`node tools/us-english.mjs --diff` are clean. The full suite runs on the Operator's merge PR (or on
yours when the Operator adds the `full-suite` label). PR body with Summary, Verification,
Deviations, Known issues, and What was cut.

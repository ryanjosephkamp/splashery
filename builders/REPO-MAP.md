# Repo map

Where everything lives in `github.com/ryanjosephkamp/splashery`, what is engine and what is a pack,
and what you may touch. Paths are from the repo root. The folder lists below were generated from the
tree on October 12, 2026; when they drift, the tree wins (`ls` it).

## Engine and pack: the one distinction that matters

- **Engine** is everything in `src/` outside `src/packs/` (and the shared lists below), plus
  `vendor/`, `index.html`, `styles.css`, and `embed/`. It runs every toy: the camera, the renderer,
  the Kit, the motion system, the sound system, saving and loading. **A task never changes the
  engine inside a toy's pull request.** If a task truly needs an engine change, make it a separate,
  small, additive pull request titled "Engine: …", with a test, and say that the toy PR needs it.
  Toys that don't use the change must behave exactly as before.
- **A pack** is `src/packs/<pack>.js`: a file of recipes (`export const RECIPES = { <toy id>: … }`).
  A recipe describes one toy with the Kit. New toys go in a pack. A pack file belongs to the task or
  lane that made it; don't edit another pack unless your task says to.

## Top-level folders and files

| Path                                        | What it is                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------ |
| `index.html`, `styles.css`                  | The Playground: the app at the root of the site (the shelf, the stage, the panel).   |
| `src/`                                      | The code: the engine at its top level, and the packs and feature folders below it.   |
| `vendor/`                                   | Third-party libraries, vendored. Listed in `LICENSES.md`. Never loaded from a CDN.   |
| `assets/`                                   | Files toys load: `toys/<id>/` (scans, thumbnails), `sounds/`, `flags/`, `proteins/`. |
| `tools/`                                    | Build tools and checkers (Node scripts, a few Python and shell). Never shipped.      |
| `tests/`                                    | Playwright specs (`*.spec.mjs`), fixtures, and `screenshots/`.                       |
| `docs/`                                     | The project's notes: toy writing, scene format, plans, handoffs, audits, reviews.    |
| `manual/`                                   | The Tinkerer's Manual (HTML chapters and a PDF).                                     |
| `site/`                                     | The Splashery site: the front door, toy pages, Learn pages, search. Generated.       |
| `embed/`                                    | The embed player (`embed/index.html`) and its demo page.                             |
| `worlds/`                                   | Splashery Worlds, a walkable small world made of splats (labs).                      |
| `showcase/`                                 | The showcase reel page.                                                              |
| `pdf-lab/`                                  | The PDF lab page and its samples.                                                    |
| `builders/`                                 | This folder: the rules and guides for outside builders.                              |
| `CLAUDE.md`, `AGENTS.md`                    | Notes for Claude sessions and for Codex tasks. They agree with `builders/RULES.md`.  |
| `README.md`                                 | Features, how to run it, the code layout.                                            |
| `CREDITS.md`, `LICENSES.md`, `LICENSE`      | Asset credits, library notices, and Splashery's MIT license.                         |
| `package.json`, `playwright.config.mjs`     | Dev dependencies (build tools, tests) and the Playwright setup.                      |
| `404.html`, `manifest.webmanifest`          | The root page's not-found page and web app manifest.                                 |
| `ascii-lab.html`, `ascii-capture-host.html` | The ASCII capture lab's pages.                                                       |
| `SPEC.md`                                   | The original product spec (history).                                                 |

## `src/`: the engine

The engine files at the top of `src/`:

| File                                                             | What it does                                                                   |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `pc.js`                                                          | The only place that imports PlayCanvas (vendored 2.22.3). Import it from here. |
| `app.js`, `ui.js`                                                | The app's wiring, the shelf, the panel, tabs, dialogs.                         |
| `player.js`                                                      | The runtime shared by the app and embeds: clock, camera, effects, toys, tiers. |
| `stage.js`                                                       | The PlayCanvas side: device, the one toy entity, picking, capture.             |
| `kit.js`                                                         | The toy kit: shapes and parts that recipes combine. Pure functions.            |
| `generators.js`                                                  | The splat buffer, the detail tiers (`PROFILES`), procedural toys, clay.        |
| `motion.js`, `patterns.js`                                       | Whole-toy motion, parts and controls; the pattern layer (designs on toys).     |
| `effects.js`                                                     | The per-splat effect shader (GLSL and WGSL).                                   |
| `loaders.js`                                                     | Loading SOG, PLY, SPLAT, SPZ files.                                            |
| `state.js`, `codec.js`                                           | The scene document (schema v3, loads v2) and the `#s=` link codec.             |
| `toys.js`                                                        | The shelf catalogue: every toy's metadata, and `labsOn()`.                     |
| `toy-sounds.js`, `voices.js`, `sound.js`                         | Each toy's tap sound, the synthesized voice library, and the output.           |
| `toy-help.js`                                                    | Each toy's how-to line and About text.                                         |
| `rig.js`, `rigs.js`, `rig-fx.js`                                 | Rigs: moving parts for scans and shapes.                                       |
| `camera.js`, `exports.js`, `viewer.js`, `embed.js`, `element.js` | The orbit camera, PNG/GIF/WebM exports, the embed viewer, `<splashery-toy>`.   |

Feature folders in `src/` (each belongs to one area; open one only when your task is in that area):
`arcade/`, `ascii-capture/`, `chem/`, `datavis/`, `elements-real/`, `export/`, `fluids/`, `geo/`,
`labs/`, `lattice/`, `live/`, `molview/`, `optics/`, `pdf-export/`, `physics/`, `powers/`, `qr/`,
`qr-craft/`, `qr-lab/`, `science/`, `showcase/`, `sky/`, `space/`, `tiny/`, `video3d/`, `viewers/`,
`volume/`, `worlds/`.

## `src/packs/`: the recipes

99 pack files. A pack file is named for its shelf or feature. Find a toy's pack by searching
`src/toys.js` for the toy's `id`: its `pack:` field names the file.

`anatomy`, `anatomy-atlas`, `animals`, `arcade`, `arcade-crisp`, `arcade-dash`, `arcade-grains`,
`arcade-lander`, `arcade-listen`, `arcade-longtail`, `arcade-pages`, `arcade-pinball`,
`arcade-rally`, `arcade-rocks`, `arcade-shadows`, `arcade-shardball`, `arcade-song`,
`arcade-strata`, `atoms`, `balls`, `chemistry`, `chladni-3d`, `chladni-colors`, `chladni-sand`,
`computing`, `computing-cnn`, `computing-history`, `data-climate`, `dog-plush-fill`, `dot-samples`,
`elements`, `even`, `fidelity`, `fluid-lab`, `food`, `games`, `gems`, `geo`, `glissando`,
`holidays`, `imaging`, `lab`, `landmarks`, `lattices`, `light-lab`, `live`, `maths`, `medieval`,
`molecule-viewer`, `moving-photo`, `music`, `nature`, `night-sky`, `objects`, `optics`, `photo-3d`,
`photo-3d-core`, `photo-3d-depth`, `photo-sharp`, `photoreal-r2`, `photoreal-r3`,
`photoreal-r3-bases`, `photoreal-r3-rigs`, `pianos`, `pictures`, `playthings`, `powers-of-ten`,
`qr`, `qr-craft`, `qr-lab`, `real-elements`, `real-objects`, `science`, `screens`, `shapes-torus`,
`song-analysis`, `song-looks`, `song-mp3`, `song-record`, `song-stream`, `song-worker`, `sound-lab`,
`space`, `space-r2`, `space-r4`, `splat-equation`, `splat-fit`, `splat-fit-worker`, `splatting`,
`studio`, `studio-audio`, `studio-models`, `studio-models-core`, `tiny`, `tiny-r2`, `vehicles`,
`video3d`, `viewers`, `volume-viewer`.

Good packs to read first: `shapes-torus` (one toy, well commented), `gems` (many small recipes), and
`real-objects` (recipes backed by baked assets).

## The shared lists: add only your own entries

These files list every toy. Many people edit them, so **edit only your own toys' entries, in place:
don't reorder, reflow, or reformat anyone else's lines.** Git then merges them line by line.

| File                                     | What goes there                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/toys.js`                            | The catalogue. A new toy adds one entry (`id`, `label`, `category`, `kind`, `pack`…). |
| `src/toy-sounds.js`                      | The toy's tap sound, as a spec for the voice library.                                 |
| `src/toy-help.js`                        | The toy's `howTo` line and `about` text, in its shelf's section.                      |
| `tools/toy-plan.json`                    | The toy's planned tap effect and sound; `"v": "keep"` when finished.                  |
| `src/rigs.js`                            | A scan's rig (only for captured toys).                                                |
| `tools/assets.json`, `tools/models.json` | Where an asset came from (see [CREDITS-GUIDE.md](CREDITS-GUIDE.md)).                  |
| `CREDITS.md`, `LICENSES.md`              | Credits for assets; notices for libraries and build tools.                            |

`docs/TOY-PLAN.md` is generated from `tools/toy-plan.json` by `node tools/toy-plan.mjs`. Never edit
or merge it by hand. The Operator keeps `CLAUDE.md`, `docs/OPERATING.md`, `docs/WORKSTREAMS.md`,
`docs/HANDOFF.md`, `README.md`, `docs/PACKS.md`, `tests/taps.spec.mjs`, `package.json`, and
`package-lock.json`. Never edit `tests/taps.spec.mjs` (it finds every kit toy's tap by itself); put
a task's extra tests in a new `tests/<prefix>.spec.mjs`.

## `tools/`

About 270 scripts; most are one lane's clip or sample maker (`<prefix>-clip.mjs`). The ones every
builder meets:

| Tool                                                                                | Use                                                                               |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `check-packs.mjs`                                                                   | Builds kit toys in Node and reports splat counts, build time, bad values.         |
| `contact-sheet.mjs`, `make-thumbs.mjs`                                              | A contact sheet of a pack's toys; the thumbnails (`assets/toys/<id>/thumb.webp`). |
| `effect-clip.mjs`, `effect-strip.mjs`, `drag-clip.mjs`                              | A toy's tap effect as a looping clip, as a filmstrip, or a drag.                  |
| `toy-shots.mjs`                                                                     | Toys at their home camera, as PNG files.                                          |
| `suite.mjs`                                                                         | The full test run, file by file, resumable.                                       |
| `us-english.mjs`                                                                    | Lists British spellings in the lines your branch adds.                            |
| `toy-plan.mjs`                                                                      | Checks `tools/toy-plan.json` and writes `docs/TOY-PLAN.md`.                       |
| `prepare-assets.mjs`, `mesh-to-splats.mjs`, `model-to-splats.mjs`, `ro-bake.mjs`    | Turn scans and models into the files toys load.                                   |
| `nc-assets.mjs`                                                                     | Lists every non-commercial (NC) asset.                                            |
| `upkeep.mjs`, `op-merge.mjs`, `site-build.mjs`, `sound-board.mjs`, `help-board.mjs` | The Operator's upkeep and page builders. Don't run them in a task.                |
| `builders-pack.mjs`                                                                 | Builds the ZIP of this folder.                                                    |

## `tests/`

About 245 spec files, one set per lane (`<prefix>.spec.mjs`). The ones to know:

- `smoke.spec.mjs`: the app loads with no console errors, the shelf shows its toys, and the "embed
  transfer ≤ 30 MB" test (keep it green).
- `kit.spec.mjs`: the Kit and every kit toy.
- `taps.spec.mjs`: every kit toy's tap. Never edit it.
- `unit.spec.mjs`: pure-logic checks, including the rule that every shelf toy has its own sound.
- `screenshots/`: the standard screenshots. Don't commit new ones into this folder unless your task
  says to; put your task's shots next to the record (see [HANDBACK.md](HANDBACK.md)).

## `docs/`

| Path                                                          | What it is                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `PACKS.md`                                                    | How to write toys: recipes, shapes, parts, controls, behaviors, quality. |
| `SCENE-SCHEMA.md`                                             | The scene file format (schema v3; v2 still loads).                       |
| `TOY-PLAN.md`                                                 | Every toy's planned tap effect and sound (generated).                    |
| `OPERATING.md`, `WORKSTREAMS.md`, `HANDOFF.md`, `OPERATOR.md` | How the Claude lanes work and where they are (read-only for you).        |
| `handoff/`                                                    | Each lane's notes. Read the ones for the area you work in.               |
| `audits/`                                                     | Reports: the format for T10 audit tasks.                                 |
| `codex/`                                                      | Earlier Codex task briefs.                                               |
| `evidence/`, `research/`, `reviews/`, `lab/`                  | Data behind toys, research notes, triaged reviews, lab measurements.     |
| `ROADMAP.md`, `BACKLOG.md`                                    | The plan, and what is not being built now.                               |

## `manual/`, `site/`, `vendor/`, `assets/`

- `manual/`: the Tinkerer's Manual. Chapter 2 (`toy.html`) is "How a toy is built" and Chapter 3
  (`language.html`) is the splat equation language. `tinkerers-manual.pdf` is the printed copy. The
  pages are built by `manual/build-pages.mjs`; read the header of a page before editing it.
- `site/`: generated by `tools/site-build.mjs` from the repo's own data (`src/toys.js`,
  `src/toy-help.js`, git history). Never edit it by hand. Hand-written files are only in
  `site/assets/`.
- `vendor/`: `playcanvas/` (2.22.3), `gifenc/`, `omggif/`, `pdfjs/`, `pdf-lib/`, `onnxruntime-web/`,
  `depth-anything-v2-small/`, `splatjs/`, `qrcodegen/`, `jsqr/`, `zxing-js/`, `laz-perf/`,
  `dicom-parser/`, `basic-pitch/`, `webp/`. Each is loaded only when its toy opens. A new library
  needs a `LICENSES.md` entry (Rules B3).
- `assets/`: `toys/<id>/` holds a toy's files (a `thumb.webp` for every toy, and `<id>.sog` for
  scans), `sounds/` the recorded tap sounds (credits in `src/sound-credits.js`), `flags/` public
  domain flag SVGs, `proteins/` Protein Data Bank entries, `gallery/` pictures for the manual's
  gallery, and `worlds/` the Worlds' ground and character files.

## The site map

| Where           | What                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `/` (repo root) | **The Playground:** the toy shelf and the stage. Live at `ryanjosephkamp.github.io/splashery/`.                                |
| `site/`         | **The Splashery site:** a front door with toy pages, Learn pages, search, and About. Built behind one switch into this folder. |
| `manual/`       | **The Tinkerer's Manual:** how toys are built, with live demos.                                                                |
| `worlds/`       | **Splashery Worlds** (labs).                                                                                                   |
| `embed/`        | The embed player, and `<splashery-toy>` for other sites.                                                                       |
| `workshop/`     | **The Workshop** (the owner's experimental area; not built yet, see [WORKSHOP.md](WORKSHOP.md)).                               |

**Labs** are a switch, not a folder: `?labs=1` on any Splashery URL turns it on for that browser
(`?labs=0` turns it off), and `labsOn()` in `src/toys.js` reads it. New toys and new areas open
behind it (Rules D5). The owner decides what leaves labs.

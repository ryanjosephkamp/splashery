# Lane Powers of ten

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: Powers of ten (id `Powers`, prefix `pot`).
Branch: `claude/lane-powers-of-ten` (and `claude/lane-powers-of-ten-engine` for any change to the
app outside your own files, as an "Engine: …" PR merged first). PR title: "Phase Powers of ten: one
zoom through real scales". Handoff file: docs/handoff/Powers.md (create it; start it with this
brief, word for word, under "## Brief", then keep "## State

Model: Opus 5.5 (claude-opus-5-5), default effort. Engine PR #351 ("Engine: chunks a kit toy loads
when it asks, the zoom gesture for a toy, a scale bar"; merge it first). Lane PR #353 (draft).

- October 7, 2026, done: #351 and #353 merged into main through Ops #385 (main 9bb2e68f), at engine
  ecf984a0 and lane 5363be5e, after Integrator 6's clean run N32. The owner marked `pot-zoom-out`,
  `pot-zoom-out-r2` and `pot-zoom-in-r3` good. The lane stood down; nothing is open.

- October 6, 2026, first READY: the toy works end to end with 17 stops from the Milky Way to a
  ribosome, each a chunk loaded as the zoom nears it, with its label, source and scale bar; Play,
  the slider, pinch, wheel and drag zoom. Evidence file and tests pass (`tests/pot.spec.mjs`, 9;
  `tests/pot-engine.spec.mjs`, 3). Clips on Effect review page 2, lane "Powers": `pot-zoom-out-r2`
  (garden to galaxy; its first version `pot-zoom-out` was marked good) and `pot-zoom-in` (garden to
  ribosome). Screenshots `pot-garden-*` and `pot-earth-*`.
- The owner's marks: `pot-zoom-out` and `pot-zoom-out-r2` good. `pot-zoom-in` fix ("the leaf is a
  different color from those on the tree ... moving from one image into another flat image"): the
  zoom now stays on the same golden full-moon maple (its leaves from above, then one leaf), each new
  picture comes in as a round soft patch over the one before, which stays behind softly until the
  new one fills the view; posted as `pot-zoom-in-r2`.
- `pot-zoom-in-r2` fix ("the zoom sort of just jumps from microscope view to a molecule"): the
  ribosome now comes in as one of the chloroplast micrograph's dark stromal grains, beside a
  thylakoid, in the micrograph's own olive gray (the same map, flat, as an electron micrograph shows
  it); the micrograph stays until the grain fills a good part of the view, fades to black round it,
  and the grain then turns into the colored map over about a second (a `solid: n` fade sets each
  splat's opacity so the grain's overlapping splats fade evenly). (Chloroplast ribosomes are 70S
  like the E. coli map's.) Main 37f9eefd merged into both branches; posted as `pot-zoom-in-r3` (40
  s; its last 10 s rendered with `pot-clip.mjs --start=30` and joined to the first 30 s). Marked
  good (October 7, 2026), as are `pot-zoom-out` and `pot-zoom-out-r2`.
- Integrator 4's run N25 found four failures, fixed: the how-to line is 94 characters (help and hta
  limits); the toy's first build carries its black backdrop (about 5,400 splats, `fit: false`; kit
  spec's "enough"), framed on its reaches by the engine's new `frameReaches` (#351), so the camera
  and every scene keep their size; and the drive copes without a chunk loader (the taps test plays
  it alone). Main 50af44bd merged into both branches.

The stops (log10 of the view's height in meters): the Milky Way 21 (M83, ESO, at the Milky Way's
size and real tilt), stars within 1,600 light-years 19.4 (HYG v4.4), within 65 light-years 18
(Gaia), the Sun alone 16, the planets' orbits 13.3 and 11.9 (JPL elements), the Earth and Moon 9,
the Earth 7.1 (Blue Marble), the Chesapeake 6, Washington 4.6, the Mall 3.3, the Haupt Garden 2
(D.C.'s 8 cm aerial), the garden bed 0.6 (3D capture), the golden full-moon maple's leaves −0.5 and
one leaf −1.3 (Flickr, CC BY-SA 2.0 and CC BY 2.0), plant cells −4 and a chloroplast −5.6 (Wellcome,
CC BY), the ribosome −7.4 (EMD-48329). New files: 5.5 MB, loaded a few at a time (under 8 MB at open
on a high tier, the garden capture's lite file included).

## Notes", "## Known issues" and "##

For the Operator" current). Model: Opus 5.5, at the default effort.

### Brief (written by the Operator on October 6, 2026, from the owner's Push Plan picks)

The owner's science pick S12: "One continuous zoom from a virus to a galaxy through existing toys,
with real scale labels at each step." He called it "one of the best ideas", "but very importantly, I
don't want it to look like a cartoon": photoreal, or as close as we can make it (a fully kit-built
version would be acceptable only as a clearly separate style). See
docs/reviews/2026-10-04-push-alignment/notes.md, around line 630.

1. **The steps.** About 12 to 16 stops from roughly 10⁻⁸ m to 10²¹ m and beyond, each a real splat
   built from real data or real captures, preferring what the site already has: cryo-EM maps
   (Science r3's cryo-EM toy), the microscope and electron-microscope pictures (Science r3,
   Imaging), photoreal captures for human scale, the Earth and maps (Geo, Space r2's real Earth),
   the Moon and planets, the nearby stars and the real galaxies (Space r2). Import their data and
   loaders; don't edit their packs (a small additive "Engine: …" PR if you need an export). Fill
   gaps with new assets under the allowed licenses (CLAUDE.md, "Ground rules"; NASA imagery and NASA
   3D Resources are fine, without insignia). Never AI-made pictures: this is a science toy.
2. **One continuous zoom.** Scroll, pinch or drag to zoom, or press play for the whole journey; each
   stop blends into the next (the smaller scene sits inside the larger one, then fades in as it
   fills the view), never a cut to a black screen. A scale bar and a label at every stop ("10⁻⁷ m: a
   virus, about 100 nm across"), with the real size and its source.
3. **Looks real.** Sharp at phone size, the sharp kernel, no blur or speckle; judge it as motion,
   not stills.
4. **Weight.** Lazy-load each stop as the zoom nears it so the toy opens fast on a phone; keep the
   "embed transfer ≤ 30 MB" test green; say the total size.
5. **Evidence.** docs/evidence/<toy id>.json: every stop's real size and its source, with a test
   that checks the labels against it.

A new labs toy on the Space shelf (or Science, if it reads better). Tests in `tests/pot*.spec.mjs`;
how-to and About texts; clips at phone size on Effect review page 2 (the full zoom, and a few stops
up close).

You own: `src/packs/powers-of-ten.js` (new), `src/powers/` (new helpers), `tools/pot-*.mjs`, the new
assets, `tests/pot*.spec.mjs`, your toy's evidence file, its lines in the shared lists, and your
handoff file.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
replace the prefix and lane record with yours). Labs: the Operator merges after a full test run (the
Integrators run it); the owner decides when anything goes public. Finish every working turn with
"READY:", "WORKING:" or "BLOCKED:"; Splashery has no CI to wait for; for a long job, schedule a
check-in with send_later instead of going idle. Clips at phone size go on Effect review page 2
(https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as docs/OPERATING.md, "Steps for a lane", says
(no republish). Before READY, re-read CLAUDE.md's "Effect quality rules" and check each clip against
them at phone size. The push ends Wednesday, October 7, 2026, 4 p.m. ET (20:00 UTC): aim for a first
READY within about six hours, then polish rounds on the owner's marks.

## State

Model: Opus 5.5 (claude-opus-5-5), default effort. Engine PR #351 ("Engine: chunks a kit toy loads
when it asks, the zoom gesture for a toy, a scale bar"; merge it first).

- October 6, 2026: the engine part is done and pushed (chunks, the zoom gesture and drag, the
  ruler). The toy is being built: the zoom, the labels and scale bar, and the first stops (the
  Earth, ten aerial pictures from 1,000 km to 30 m, the garden bed capture).

## Notes

- The zoom's target: a small tree in the Enid A. Haupt Garden beside the Smithsonian Castle,
  Washington, D.C. (D.C.'s 2023 aerial photo is 8 cm per pixel, CC BY 4.0, so the zoom stays real
  down to the garden; Sentinel-2 cloudless 2016, CC BY 4.0, from 1,000 km to 10 km; the USGS NAIP
  mosaic, public domain, at 3 km. The USGS mosaic has holes over the Chesapeake at 30 to 300 km, and
  EOX's 2017 and later cloudless years are NC: not used.)
- Every scene but the black backdrop (the toy's own splats) is a chunk (src/chunks.js), its own
  splat entity, scaled each frame; finer layers sit a hair nearer the camera, so each draws over the
  one it sits in. The camera never moves: the pinch, the wheel and a drag go to the toy
  (`zoom: true`).

## Known issues

- Between 8 mm and 0.2 mm the leaf photo runs past its detail before the cells come (no leaf-surface
  picture with a stated scale was found).

- A single chunk over about 360,000 splats draws nothing (somewhere between 360k and 410k in this
  PlayCanvas build); every scene is capped at 600 by 600 pixels or 360k splats.
- Far scenes need splats under a pixel: the recipe lowers the engine's pixel cull (`render.cull`
  0.5, labs only), as the picture toys do.
- The Moon and the planets are placed for one moment (16:54 UTC, October 7, 2026) by short formulas,
  good to about a degree.

## For the Operator

- Both PRs are merged (Ops #385); nothing is waiting on the Operator.
- Wikimedia answered 429 (too many requests) to this container on October 6 (a helper searched it
  too hard); the leaf came from Flickr instead.
- The owner asked for "a virus to a galaxy": the smallest stop is a ribosome (it nests in the
  chloroplast). Science r3's AAV2 capsid map could be added as a virus stop if he wants one.

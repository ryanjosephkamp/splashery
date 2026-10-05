# Lane Science r3: more data that already are Gaussians (prefix `sci3`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Science r3 (id `ScienceR3`, prefix `sci3`). Branch:
`claude/lane-science-r3` (and `claude/lane-science-r3-engine` if needed). PR title: "Phase Science
r3: more crystals, microscopes and galaxies". Handoff file: docs/handoff/ScienceR3.md. Model: Opus
5.5.

### Brief (written by the Operator on October 4, 2026, from the owner's push notes that evening)

On the Push Plan the owner marked S17 "100%. ... This could be a primary or a major focus of our
push" (docs/reviews/2026-10-04-push-alignment/notes.md, from "So for this one, I'm going to go
through these"). The Science shelf shows data whose natural form is already a set of Gaussians.
Today it has two thermal-ellipsoid structures (aspirin form II, COD 2104857; crambin, PDB 1EJG), two
super-resolution microscopy sets (ShareLoc.XYZ on Zenodo, CC BY 4.0) and one galaxy (FIRE-2 m12i,
300,000 gas particles, CC BY 4.0); see `src/packs/science.js` 79-100, 420-444 and 783, and
docs/handoff/Science.md. Also read docs/audits/new-sources-2026-10.md (the Dot's sources report).

1. **Many more thermal-ellipsoid structures** (he: "maybe we can add more structures by default ...
   we could maybe add quite a number"). Fifteen to twenty-five, grouped in the picker (everyday
   molecules, medicines, minerals and gems, ice and salts, proteins at atomic resolution, DNA). Each
   must carry real anisotropic displacement parameters: CIFs with `_atom_site_aniso_U` from the
   Crystallography Open Database (public domain) and PDB entries with ANISOU records at atomic
   resolution (CC0). Keep the person's own file upload as it is.
2. **More microscopy.** Three to six more single-molecule localization sets from ShareLoc.XYZ or
   other CC BY or CC0 sources (nuclear pores, actin, mitochondria, DNA origami, 3D sets), and a new
   **cryo-EM** toy: a density map from EMDB (CC0) turned into Gaussians (a ribosome, apoferritin, a
   virus capsid), with its fitted atomic model from the PDB as an option. If another kind of
   microscopy fits (electron tomography from EMPIAR, CC0), add it.
3. **Galaxies, and a telescope.** More galaxies in Galaxy in a box: other FIRE-2 halos on FlatHub
   (check each license), and if the licenses allow, a merger, a dwarf and an elliptical from other
   open simulations (read their terms; "free with citation" is a question for the Operator). A
   telescope view (he: "a telescope type of effect"): the galaxy seen as through a telescope, with
   its point spread, filters and exposure building up, told plainly as a simulation.
4. **More "in a box"** (he likes the concept: "terrain ... fire, like a wildfire ... wind in a
   box"). Propose three, with the data each needs and its license; build one if time allows (the
   Operator may give the rest to a later lane).

Every dataset: only CC0, CC BY, CC BY-SA, CC BY-NC (with `"nc": true`), CC BY-NC-SA or public
domain, read on its live page, and credited beside the toy. Scientific claims are shown with their
source; nothing invented. Data become splats at build time (`tools/sci3-*.mjs`), sizes inside the
phone budgets, and big files load only when chosen.

#### Deliverables

- Tests in `tests/sci3*.spec.mjs`: every new structure loads with its ellipsoids (and a check that
  the ellipsoid axes match the file's U values for a few atoms); each microscopy set and galaxy
  loads; the cryo-EM map's isosurface level matches EMDB's recommended contour.
- Clips at phone size of the new structures, the cryo-EM toy, a new galaxy and the telescope view.
- Credits for everything; how-to and About texts.

#### You own

`src/packs/science.js` and any new `src/science/` files, `tools/sci3-*.mjs`, the new assets under
`assets/toys/` for these toys, `tests/sci3*.spec.mjs`, your toys' lines in the shared lists, and
this file.

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
- Merging: The engine PR merges after a full test run; the toys are labs, so the Operator merges
  them after the full run too, and the owner decides when they go public. Never merge anything
  yourself.
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
- Tests: `tests/sci3*.spec.mjs`; never edit `tests/taps.spec.mjs`. Before each push run your own
  specs and the specs of the files you touch (say which in the PR); the Integrators run the full
  suite before a merge. Prettier, `node tools/us-english.mjs --diff`, and for toys
  `node tools/check-packs.mjs <pack>`, a contact sheet and thumbnails (CLAUDE.md, "Before every
  push"). Screenshots `sci3-<name>-390x844.png` and `…-1440x900.png`, then
  `node tools/upkeep.mjs --restore-shots`.
- Clips: post every new or changed effect on Effect review page 2
  (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as docs/OPERATING.md, "Steps for a lane", says
  (lane record `ScienceR3`), after watching each one. After posting, check the owner's marks about
  once an hour with a scheduled check-in (send_later); stop once your PR is merged or closed.
- Language: American English for every new text (color, center, gray, license, toward, -ize endings,
  dates like "October 5, 2026").
- Your handoff file: start it with this brief, word for word, under "## Brief", then keep "##
  State", "## Notes", "## Known issues" and "## For the Operator" current.
- PR: one draft PR against main (five sections: Summary, Verification, Deviations, Known issues,
  What was cut), opened early and pushed after each finished item. Finish every working turn with a
  final message that starts "READY:", "WORKING:" or "BLOCKED:".

## State

Model: Opus 5.5 (claude-opus-5-5), default effort. Draft PR #270 (lane) and #272 ("Engine: grouped
choices in a toy's select options", needed by the structure picker; merge it first).

- October 5, 2026: items 1 to 3 done and pushed; item 4's three proposals written (below) and its
  first box built: **Terrain in a box** and the **Contour lab** before it (USGS 3DEP, public domain;
  `tools/sci3-terrain.mjs`, `src/science/terrain.js`; the water and the layers are kit parts).
  1. **Structures**: 25 in six groups, COD or PDB (CC0) with real anisotropic U; Show fills the unit
     cell (`src/science/symmetry.js`); split molecules are completed; the B-DNA duplex comes from
     its biological assembly.
  2. **Microscopy**: four ShareLoc.XYZ sets, NeNA precision where a record has none. **Cryo-EM map**
     (new toy): apoferritin, a ribosome with an antibiotic, an AAV2 capsid (EMDB, with the fitted
     PDB models); the isosurface at EMDB's recommended level; the tap cuts it open.
  3. **Galaxies**: m12i at z = 2 and the dwarf m11h; a telescope view (simulated).
- Clips: all 15 cards are on Effect review page 2 (lane record `ScienceR3`, five groups: structures,
  cryo-EM, microscope, galaxy, terrain), each built by Opus 5.5, waiting for the owner's marks.
  Screenshots `tests/screenshots/sci3-*-390x844.png` and `…-1440x900.png`.

- October 5, 2026, 04:10 UTC, the owner's first marks: `sci3-molecules` good. `sci3-cryoem-*` (all
  three): "outstanding ... cool as hell", "make it sharper, and keep iterating"; `sci3-minerals`:
  "keep enhancing this and making it sharper"; `sci3-dna`: "virtually perfect ... could you add even
  more molecules?". Done in r2 (commit 81523da7): the cryo-EM map draws more, smaller, flatter
  splats with ambient occlusion (Tenengrad 172 → 216, 179 → 232), and 13 more structures (38 in
  seven groups, with Molecules of life and DNA and RNA). The r2 clips render at 2× (780 × 1688), as
  r2 of lane Science found sharper on the phone. Posted October 5, 05:30 UTC: `sci3-cryoem-*-r2`,
  `sci3-minerals-r2`, `sci3-dna-r2` (replacing their cards) and `sci3-life` (new).

- October 5, 2026, 05:28 UTC, more marks: good: `sci3-contour-lab`, `sci3-galaxies`,
  `sci3-microscope-pores`, `sci3-microscope-sets`, `sci3-terrain`, `sci3-terrain-helens`; "good, but
  please try to make it sharper": `sci3-cryoem-model` and `sci3-telescope`. Done: finer backbone
  beads; more stars in the telescope (a 0.1″ default was tried and reverted: each star particle
  shrank to a pixel and the arms were lost); both clips at 2×, posted as `sci3-cryoem-model-r2` and
  `sci3-telescope-r2` (05:55 UTC). Waiting for marks on the r2 cards, `sci3-life` and
  `sci3-telescope-filters`.

- October 5, 2026, 06:57 UTC, more marks: good: `sci3-cryoem-apoferritin-r2`, `-ribosome-r2`,
  `sci3-dna-r2`, `sci3-minerals-r2`, `sci3-life`; fix: `sci3-cryoem-capsid-r2` ("keep making it
  sharper if possible") and `sci3-telescope-filters` ("Please make sharper"). Done: the map draws
  one splat per voxel the surface crosses (its crossings averaged; `isoPointsPerVoxel`) at density 2
  (capsid Tenengrad 208 → 238); the telescope's galaxy moved from 100 to 50 Mpc, so the seeing blurs
  half as much, and thinned dust no longer widens into soft blobs. Cards `sci3-cryoem-capsid-r3` and
  `sci3-telescope-filters-r2` at 2×, posted 07:35 UTC with `replacedBy` on the old cards. Still
  waiting: `sci3-cryoem-model-r2`, `sci3-telescope-r2`.

## Proposals: more "in a box" (item 4)

The owner marked "In a box" yes on October 5, 2026 (wildfire, tornado and terrain, each after a
small lab that teaches what it needs). Each license below was read on the live source on October
5, 2026. All three are honest models or measurements, labeled as such; none forecasts anything.

1. **Terrain in a box** (build first). Lab before it: a **contour lab**, a hill sliced into contour
   layers that slide apart and back, so a contour map reads as a 3D shape. The box: a real 10 km
   square of land as a surface of flat splats, one per elevation sample, colored by height with the
   sun's shading, in a box whose walls show the land's cross-section; options for the place (the
   Grand Canyon, Mount St. Helens's crater, a river delta), vertical exaggeration (true, 2×, 5×) and
   contour lines. The tap fills it with water to a level, rising and draining (a level, not a flood
   model). Data: the USGS 3D Elevation Program's 1/3″ (about 10 m) tiles, GeoTIFF on The National
   Map's S3 bucket; the tile's metadata says "All 3DEP products are public domain." Color, if
   wanted: Landsat (USGS, public domain). Build tool: `geotiff` (MIT) as a pinned devDependency to
   read the tile; a 256 × 256 crop (about 40 m samples) is about 130 kB.
2. **Wildfire in a box.** Lab before it: a **fire-spread lab**, a grid of fuel that burns cell to
   cell, faster uphill and downwind (the rate of spread grows with slope and wind, as in Rothermel's
   1972 model), so the person sees why fires run up slopes. The box: real terrain (3DEP, above) and
   real fuels (LANDFIRE's 40 Scott and Burgan fuel models, 30 m; a US federal product, its
   public-domain status still to be confirmed on landfire.gov, whose pages didn't say it in this
   check), a fire started where you tap, spreading as a glowing front with embers and a smoke plume,
   and, for one real fire, its mapped perimeter from the National Interagency Fire Center's open
   data (public domain) to compare. Told plainly: a teaching model of spread, not a prediction.
3. **Tornado in a box.** Lab before it: a **wind lab**, the classic vortex models (a Rankine and a
   Burgers–Rott vortex) as streamlines of splats, with the inflow, the updraft and why the wind is
   fastest at the core's edge. The box: a real radar scan of a tornadic supercell, the May 20, 2013
   Moore, Oklahoma storm from the KTLX radar (NEXRAD Level II on NOAA's open data on AWS: "open to
   the public and can be used as desired", attribution requested, and no claim of NOAA's
   endorsement): the reflectivity volume as splats (its hook echo and the debris ball), the Doppler
   velocity couplet in red and green, and a model funnel with debris particles, labeled as a model.
   Each volume scan is about 10 MB compressed; a build tool would grid one scan.

Why terrain first: its data are public domain and ready (a GeoTIFF tile, checked), it needs no new
physics, and both other boxes stand on terrain (the fire burns across it; the storm's radar sits
over it), so it is the base the later lane builds on.

## Notes

## Known issues

## For the Operator

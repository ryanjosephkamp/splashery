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

Model: Opus 5.5 (claude-opus-5-5), default effort.

- October 5, 2026: started. Sources reachable from the container: COD, RCSB, EMDB, EMPIAR, Zenodo,
  FlatHub. Order of work: (1) structures, (2) microscopy and the cryo-EM toy, (3) galaxies and the
  telescope, (4) the three "in a box" proposals (the owner marked "In a box" yes on October 5:
  wildfire, tornado and terrain, each after a small lab), building one if time allows.

## Notes

## Known issues

## For the Operator

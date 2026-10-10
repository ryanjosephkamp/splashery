# Lane Kit lab (prefix `klab`)

## Brief

Written by the Operator on October 10, 2026:

> The owner read the Operator's answers to his questions about the Tinkerer's Manual
> (https://claude.ai/artifact/NkXJM1QmtRyTYVLyCTi1LE; read it with the Artifact tool, action "read",
> sections "The budgets", "Time t, the 12 moments" and "Experiments"). Many of the kit's numbers are
> our own choices, not forced by the format. He wants them tested rather than assumed. One rule over
> everything: Splashery works, and nothing replaces what's there.
>
> - Every experiment sits behind the labs switch (`?labs=1`) or on a private comparison page.
> - Today's behavior stays the default.
> - Old `#s=` links and saved scenes keep loading exactly as before.
> - He compares before anything changes.
>
> Start small, get the experiment workflow right, then go bigger. His notes are private: don't quote
> him anywhere.
>
> Experiments, in this order:
>
> 0. **A bigger splat-budget sweep (data only, no code change to toys).**
>    - docs/lab/SHARPNESS.md (September 29, 2026) compared only 140,000 against 200,000 splats, on
>      14 toys, at pixel ratio 2. More splats made no toy sharper and several shimmer more.
>    - Rerun it with tools/shp-measure.mjs (extend it if needed) at today's defaults (pixel ratio 3
>      on mid and high):
>      - budgets of 60k, 140k, 200k, 280k and 400k;
>      - about 20 toys, including thin and holey ones (the bicycle, a lattice, a knot, the Klein
>        bottle, a tree, the chess set) and the original 14;
>      - the same edge, speckle and shimmer measures, plus a shape measure where more splats should
>        help (gaps in thin parts, coverage of holes);
>      - frame time, relative only.
>    - Write docs/lab/BUDGETS.md: the table, what it shows and doesn't (software renderer, one phone
>      size), and a recommendation: keep the tiers, or change a number. Don't change any tier in
>      this lane.
>    - The Manual lane will quote it.
> 1. **A Detail slider (labs only).**
>    - A slider from Low to Max that sets the splat count directly, beside the existing buttons and
>      "Auto", which stay.
>    - The tier name still switches its other settings (lighter scan files on Low, canvas sharpness,
>      fluid and picture budgets). The slider keeps those tied to the nearest tier.
>    - It isn't saved in links unless the owner later asks.
>    - Card: the same toy at 4 to 5 slider stops, side by side.
> 2. **View-dependent color on a few kit toys (a private comparison).**
>    - Kit splats store one color. Captured splats keep a first band of spherical harmonics.
>    - Give 2 or 3 kit toys a gloss that moves with the view, a marble and a chess piece for
>      example. Use our own data and shader, with no engine edit if you can (an "Engine:" PR if you
>      can't).
>    - Show before and after on a private page or as cards.
>    - Report the cost in memory and frame time, and whether it reads at phone size.
> 3. **More moments of t in the splat equation toy (labs only).**
>    - Today it's 12 copies, one part each (`KNOTS` in src/packs/splat-equation.js).
>    - Add a labs-only choice of 12, 13, 14 or 15 moments. 15 is the parts limit.
>    - Measure:
>      - the dip of a turning shape (about 3.4% at 12, 2.2% at 15);
>      - build time and memory on the weakest tier (the count is shared between copies, so check
>        what each copy gets).
>    - Card: a turning shape at 12 and at 15.
>    - Past 15 needs the parts change: describe it (a keyframe texture blended in the shader, or
>      formulas compiled to a shader), don't build it.
> 4. **240-character fields in the splat equation toy (approved by the owner; a real change, not
>    only an experiment).**
>    - Raise the toy's field limit from 120 to 240 characters. Check who else shares `MAX_LENGTH` in
>      src/equation.js (the math plotters). Change only what the equation toy needs, or raise it for
>      all, with a reason.
>    - Keep the other guards: nesting depth and the piece count. Report whether they become the real
>      limit.
>    - Old links with 120-character fields load the same. Check the length of a link with all 12
>      fields at 240, before and after compression.
>    - This one changes a public toy's limit, so it waits for the owner's "good" mark like the rest.
>
> Ownership for this round:
>
> - `src/packs/splat-equation.js` (the Manual lane keeps the manual itself, and is wiring Codex's
>   program gallery into the manual; don't touch `manual/`);
> - `tools/shp-measure.mjs`;
> - docs/lab/BUDGETS.md and any new docs/lab/\*.md of yours;
> - `tests/klab*.spec.mjs`;
> - your entries in the shared lists.
>
> The Detail slider's control and the shader for view-dependent color are engine. Put them on the
> engine branch, small and additive, and read docs/PACKS.md and src/sharpness.js first.
>
> How this lane runs:
>
> - Finish every working turn with "READY:", "WORKING:" or "BLOCKED:". For a long job, schedule a
>   check-in with send_later instead of going idle.
> - Clips and stills at phone size (390x844; device scale 2 is fine on SwiftShader) go on Effect
>   review page 2 (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK), as docs/OPERATING.md, "Steps
>   for a lane", says (no republish). Card ids are klab-…, and each names Opus 5.5.
> - Before READY, re-read CLAUDE.md's "Effect quality rules" and run its "Before every push" steps.
> - Aim for a first READY within about five hours, with experiment 0's table and experiment 1.

## State

Model: Opus 5.5 (claude-opus-5-5), high effort. Branches: `claude/lane-kit-lab` (lane) and
`claude/lane-kit-lab-engine` ("Engine: …", merge first).

**Merged, October 10, 2026:** engine PR #484 and lane PR #486 went in with batch 6 (#500, main at
32fc9692). This round is done; the lane is idle until the owner's in-depth review.

What's left:

- **Timing on a real phone.** The clean software-renderer timing pass is done (BUDGETS.md and
  GLOSS.md); it can't tell what more splats or the gloss cost a phone's GPU. The Detail slider
  (labs) is the tool for it: does a weak phone keep its frame rate at 90,000 to 100,000 splats?
- **The owner's in-depth review.** His marks on the five cards are provisional. Anything his review
  asks for (a gloss default on the marble and the pool ball, a Low budget change, more moments)
  starts a new round.

- October 10, 2026: all five experiments built and measured (see "Notes").
  - 0: the budget sweep (24 views × 5 budgets) is in docs/lab/BUDGETS.md.
  - 1: the Detail slider (engine, labs only).
  - 2: the gloss (engine: a separate shader variant, labs only; docs/lab/GLOSS.md).
  - 3: the Moments choice, 12 to 15 (docs/lab/MOMENTS.md).
  - 4: 240-character fields in the splat equation toy (docs/lab/EQUATION-FIELDS.md); the plotters
    keep 120.

- October 10, 2026, 03:49 UTC: the owner marked all five cards good (klab-detail-slider, the three
  gloss cards, klab-moments). The Operator says these are provisional: he wants a more in-depth
  review once all the tests are done. Each experiment now has a write-up with a recommendation
  (docs/lab/BUDGETS.md, DETAIL-SLIDER.md, GLOSS.md, MOMENTS.md, EQUATION-FIELDS.md).
- Specs (smoke, shp, man, math, klab, klab-engine): 90 passed. Two smoke tests failed: one from CPU
  load, which passes when rerun alone, and the shelf-grid test, which also fails on main.

## Notes

- Engine PR contents: the Detail slider (src/player.js `setSplats`, `splatBudget`, `nearestTier`;
  src/app.js `setSplats`; src/ui.js and index.html, a labs-only row under Detail);
  `compile(text, allowed, { maxLength })` in src/equation.js (additive; the default stays 120); the
  gloss variant (`MODIFIER_KIT_GLOSS` in src/effects.js, `gloss` in `Stage.setToy`, `pickGloss` in
  src/player.js). Toys without a gloss and pages without labs run exactly the program and the counts
  they ran before.
- The lane PR: tools/shp-measure.mjs (budget configs b60 to b400, gloss configs g0 and g1, and the
  gaps, area, and xor measures), the Moments option and the 240-character fields in
  src/packs/splat-equation.js, tests/klab.spec.mjs, the docs/lab files. One line of
  tests/man.spec.mjs (lane Manual's) changes with the field limit: 121 characters now pass, so it
  checks 241.

## Known issues

- The sweep is SwiftShader on one phone size (390 × 844 at ratio 3); frame times are relative only.

## For the Operator

- Both PRs are merged. Nothing is waiting on this lane.

# Incompressible Shuffle

October 8, 2026. Native dot pilot, powered by OpenAI. Built directly in an isolated cloud checkout;
no Work/Codex handoff, model API, engine change, external visual asset, or dependency change.

## Status

Reviewable experimental source, behind labs. Mathematical and CPU-native integration checks pass.
Browser/visual acceptance is **outstanding**: Chromium cannot create its startup Unix socket in the
execution environment, including an approved escalated launch. No screenshot, thumbnail, motion
clip, GPU readback, touch-screen hit-test, audio audition, or phone frame-rate claim is made. No
remote write, merge, or deployment was made by this implementation task.

Branch: `dot/incompressible-shuffle-20261008-0525`. Pinned base:
`b8055faba39c913c9fff624b2f91f8c65ff3f87c`. Main advanced concurrently; this patch was not rebased
or merged while editing. Shared-list edits add only this toy. The generated plan was regenerated,
then formatted; surrounding list wrapping changes are generated, not removed content.

## What is implemented

- Two native material sheets; four moving corner tokens per sheet, quantized skin4 weights.
- Exact seven-stage path: lift, four partial shears, translate, lower. Stretch 0.5, 1, or 2.
- Twelve-second one-shot playback, native sequence scrub, Pause, reset on either edge of the Reset
  switch, and Swap/replay that reconstructs the original labels. Swap while Pause is enabled remains
  paused and explicitly says to turn Pause off.
- Sheet taps use the inverse current affine map and select an actual quantized material sample.
  Eight path nodes and seven native skin segments show the **complete path**, including future
  positions. A coordinate-free pin event picks a deterministic existing sample. Non-action pulse
  controls are not separate buttons in the current host UI.
- Two exact material patch outlines, each with area 0.04; preserved orientation and area do not mean
  preserved pixel area or bounding-box area.
- Twenty-five tokens, no custom rigid parts, at most 34,812 splats at normal high-tier budgets. CPU
  resort is requested only when time or the pinned sample changes, including the final pose.
- Native About text and pinned source/license links; a quiet air-sweep gesture cue, not fluid audio.

## Construction and coordinates

Source:
[OpenAI, Finite Instructions and Solenoidal Shear Flows, §3, pp. 5–9](https://github.com/openai/math/blob/adc7f1241b42e322a6451854ab7e4b4c146bf78a/preprints/Finite-Instructions-and-Solenoidal-Shear-Flows-September-27-2026/manuscript.pdf).

Construction coordinates have z vertical. Recipe coordinates are `(x,z,y)` because the kit uses Y
up. Each source square has half-width 0.4, centers are `(−1.25,0)` and `(1.25,0)`, targets exchange
centers, and private heights are 1.25 and 2.5. This compact admissible revision improves geometric
frame occupancy; it is not evidence of actual phone legibility.

With h=1, take L=16, charts x,y in (−7,7), z in (−1,6), and K=[−1.25,1.25]×[−0.25,0.25]. K+[−2,2]²
stays strictly inside the planar chart. Source gap is 1.7; worst target gap is 0.9. Source/target
supports enlarged by 0.2 retain gaps 1.3 and 0.5. Height supports of half-width 0.5 leave a 0.25
gap; plateaus may have half-width 0.25. These describe possible supporting cutoffs, not implemented
or rendered fields. Horizontal affine excursions are at most 1.2 relative to each source center
during shears; exact scene x extrema are ±2.25.

The four chronological shears are Y(−λ), X(1/λ−1), Y(1), X(λ−1). Their product is `diag(λ,1/λ)`.
Stage j runs on `[(2j−1)/16, 2j/16]`, using the exponential flat-step function S. All seven
labels/time slots are retained, including the two zero X shears for λ=1.

Original material labels use the same u,v multiples of 1/1023 that `kit.js` encodes. Therefore the
native bilinear blend of corner displacements equals the affine path rather than moving a slightly
different unquantized point. Rendering fit is applied by the existing engine. Gaussian shape,
opacity, and radius are drawing support; this is not transported Gaussian density.

## Verification

TDD checkpoints were observed before implementation expansion:

1. Five core tests failed on missing core functions, then passed before recipe work began.
2. Three native integration tests failed on the missing recipe, then passed.
3. Native UI-contract regressions caught long-action auto-pause, an inaccessible pulse reset, stale
   slider IDs, missing reset state, idle sorting, missing exact patch outlines, absent license URL,
   and a coordinate-free pin event. Each was exercised red before its correction.
4. Compact absolute fixtures failed against the previous scene before changing centers/heights.

Final passing commands:

- `node tools/check-packs.mjs incompressible-shuffle`: 34,812 splats, 69 ms in the final run
  (earlier builds 55–73 ms). This is a Node build observation, not frame-rate evidence.
- `SPLASHERY_PORT=4179 npx playwright test tests/shuffle-core.spec.mjs tests/shuffle.spec.mjs tests/unit.spec.mjs --grep-invert 'browser controls'`:
  **34 passed**, 26.4 s.
- `SPLASHERY_PORT=4179 npx playwright test tests/help.spec.mjs tests/taps.spec.mjs -g 'toy help: the list|every incompressible-shuffle|every finished kit toy|every exception'`:
  **6 passed**, 3.5 s.
- Eight additional browser-independent regression files (`lv7-engine`, `tw2-dna`, `e4f`,
  `cmp2-sort`, `rel-engine`, `hec-engine`, `heb-engine`, `e6b`): **51 passed**, 12.0 s.
- `git diff --check`: clean.
- `npx prettier --check .`: passed; final owned-file formatting check also passed.

Independent compact-scene comparison also checked 84,042 reference positions (maximum error
8.89e−16), 72,864 actual MotionDriver/skin4 decoded centers (maximum error 2.15e−7 construction
units), 198 picks, and 198 float32 patch-outline areas (maximum error 1.57e−8). This checks CPU
buffers and packed uniforms, not GPU output. The declared encoded-center tolerance is 2e−5. The
final pin-fallback change does not change these path or encoding formulas.

### Incomplete or blocked checks

The requested browser command was attempted with `/usr/bin/chromium`, port 4179, and a writable
`/tmp` HOME/cache. Chromium aborted before page load:
`process_singleton_posix.cc:297: socket() failed: Operation not permitted (1)`. An escalated attempt
produced the same restriction. No security bypass was attempted. A mixed targeted run had 34 passes
and five browser-startup failures (the help line's automated browser, first-paint, reduced-motion,
and two viewport tests); those are not application failures. The standalone pilot browser test also
could not start.

The aggregate suite was attempted with `--max-failures=1`; collection was blocked by sparse checkout
omissions: `vendor/omggif/omggif.js` (asc, asc2, qr), `assets/proteins/1ubq.pdb`,
`manual/example-pictures.js`, `vendor/zxing-js/zxing.min.js`,
`assets/toys/photo-3d/wildflowers.jpg`, `assets/sounds`, and `worlds/test-island/world.json`. It was
not a green full-suite run. Broader asset-dependent node runs were interrupted after 42 and 43
passes while entering Imaging/Photo-to-3D checks; those checks have no completion result. The final
eight-file asset-independent rerun completed with 51 passes.

The sound lint requires a browser; it was not completed. No browser was installed. Only the existing
pinned npm dependencies were installed, without running installation scripts or changing manifests.
Read-only sparse expansion restored existing QR and GIF encoder dependencies.

American English diff checker flags only the existing category identifier `maths` and the generated
existing heading `Maths (18)`. Those are retained to preserve the established category; no new
British public prose is introduced.

## Remaining acceptance work

Run the real browser test, inspect the exact native image and screen-pointer picking at 390×844 and
1440×900, render and inspect a motion clip/contact sheet, generate the native thumbnail, verify GPU
centers if supported, audition the quiet sound, and complete the aggregate suite in a fully
populated checkout. Assess real phone performance separately. Do not remove labs or claim visual
approval until that work is complete.

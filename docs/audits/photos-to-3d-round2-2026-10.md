# Photos to 3D: second implementation round

Codex (GPT-6) is implementing the Operator's second-round request on `codex/photos-to-3d`. This
report records the photo-specific module and the measurements from that module. The
[first-round report](photos-to-3d-2026-10.md) remains a separate core diagnostic.

The code is a labs API in `src/photos3d/`, without a shelf entry. It imports the unchanged Splat.js
SIFT, geometric primitives, bundle adjustment, and trainer, and Video to 3D's budgets, refinement
schedule, and surface seeder. All input photographs stay outside git.

## Measurement protocol

The module canonicalizes photo identities before seeded numeric work and proposes every unordered
pair: 276 at 24 photos and 1,770 at 60. Every accepted pair needs at least 25 essential-matrix
inliers and 40% consensus, with no capture-order neighbor exceptions. A bounded worker pool uses the
existing CPU matcher on software adapters; hardware adapters can use the existing WebGPU matcher.
Graph receipts retain components, features, support, accepted pairs, and per-photo reasons.

Features use the existing upsampled SIFT octave at a 960-pixel phone side and a 1,280- or
1,600-pixel desktop side. The training dimensions, seed budget, and splat ceiling come from Video to
3D. Photo inputs have their own 8–60 range, beyond Video to 3D's 16-frame phone input cap.

Every photo's EXIF is inspected. The API supports one camera/lens group within a 10% focal range; it
reports incompatible or incomplete metadata explicitly. Each accepted 35 mm-equivalent focal
calibrates that photo independently. Physical focal lengths can identify a lens group but cannot
calibrate pixels without sensor dimensions. Uncalibrated sets need an explicit, recorded single-lens
assumption and use a shared-focal search. Bundle adjustment uses normalized per-photo observations
on a common virtual sensor. Distortion is not estimated in this module.

Geometry may use all input grayscale, including the held-out view, under the task's solved-camera
protocol. For each appearance fold, sparse colors are rebuilt from at least two training
observations, and held-out RGB, masks, and cameras are physically absent from surface seeding,
trainer inputs, loss, hull filtering, and environment fitting. Each fold starts a fresh trainer.
Camera poses remain fixed during appearance training.

Evaluation masks are approximate manual silhouettes traced from input photos alone, without camera
solutions, renders, or optimizer feedback. A uniform two-pixel erosion at the 320-pixel annotation
scale removes uncertain boundaries, with supports and visible background openings excluded. These
are not ground-truth masks. SSIM uses the existing metric tool's local 7×7 luma windows entirely
inside the mask; PSNR uses RGB squared error over all masked pixels. Input-photo hashes and mask
source identities are checked before evaluation. The latest probe also checks and records the exact
loaded annotation bytes against the frozen asset hash before browser work; older receipts recorded
the annotation hash only at completion. The interrupted batch lacks that final runtime hash, so its
recovered folds retain an explicit provenance caveat. Failed or unregistered views remain in
coverage denominators.

This container has software WebGPU and no attached physical phone. Phone profiles and 390×844
viewports do not establish phone latency, thermal behavior, or peak memory.

## Dataset provenance

Four frozen selections represent three independent captures, not six. The 24- and 60-photo Buddha
selections overlap and count once. `tools/assets.json` preserves both `portfolioSpecimens` and
`photos3dBenchmarks`, with the original filenames, pinned URLs, authors, licenses, sizes, and
hashes.

- Buddha: Simone Gasparini, Fabien Castan, and Yann Lanthony, CC BY 4.0;
  [pinned source README](https://github.com/alicevision/dataset_buddha/blob/9067f679eb5a772c3e818b7a12dc35882c071858/README.md)
  and
  [license](https://github.com/alicevision/dataset_buddha/blob/9067f679eb5a772c3e818b7a12dc35882c071858/LICENSE.md).
- Textured die:
  ["Photogrammetry Test Set: Dice - Turntable - Strong Lights - Heavily Textured w Watercolors"](https://gitlab.com/photogrammetry-test-sets/dice-turntable-strong-lights-heavily-textured-w-watercolors),
  by [alansartlog](https://alansartlog.com), CC BY 4.0;
  [pinned license/attribution README](https://gitlab.com/photogrammetry-test-sets/dice-turntable-strong-lights-heavily-textured-w-watercolors/-/blob/78e0a887ba5263da66910fb4f4da0d9763e9177a/README.md).
- Skull:
  ["Photogrammetry Test Set: Skull - Cameramoves - Flash - No Background"](https://gitlab.com/photogrammetry-test-sets/skull-cameramoves-flash-no-background),
  by [alansartlog](https://alansartlog.com), CC BY 4.0;
  [pinned license/attribution README](https://gitlab.com/photogrammetry-test-sets/skull-cameramoves-flash-no-background/-/blob/0f31c229ac289a615b3ae981a5f584856bb24c47/README.md).

Live source and license pages were opened on October 17, 2026. The two additional selections each
contain 24 unmodified JPG originals. No identifiable people or readable logos were observed. The
skull source does not establish manufacturing provenance; it is described only as a nonidentifiable
anatomical specimen on a stand. Individual-image attribution appends its image number, as the source
requests. The Creative Commons deed returned HTTP 403; the pinned source READMEs explicitly state CC
BY 4.0 and the attribution above.

## Rendered camera tests

Task 105's [Blender branch](https://github.com/ryanjosephkamp/splashery/pull/701) was available
during this round, so the benchmark includes three actual rendered sets, rather than substituting
numeric correspondences. The renderer is pinned to `f7710637570ce34aa544e53175f5dc7b03b6c11c`, with
Blender 4.5.3. Each set has 24 960×720 orbit views, exact camera matrices, and the model's
bounding-box diagonal as scene size. The inputs are the burger-double, cake-birthday, and
donut-sprinkles models from [Kenney Food Kit](https://kenney.nl/assets/food-kit), whose live source
page states CC0. The archive, source models, embedded-texture models, renderer, and rendered inputs
have recorded hashes. Embedding preserves the models' texture-transform extension. Original beauty
inputs remain outside git.

All three sets returned zero accepted cameras. Burger and cake produced some verified pairs but
failed the minimum of three cameras and eight triangulated points; donut produced no verified pair.
All 24 missing cameras remain in each denominator. Rotation and position medians are undefined, and
all three camera gates fail. These smooth, sparsely textured objects and eight-sample CPU renders
are a limited stress test, not evidence that every synthetic object is unsolvable.

Separate exact-correspondence controls pass for uniform intrinsics at 24 and 60 views and mixed
per-photo intrinsics at 24 views. Those controls isolate the normalized camera adapter and scorer;
they bypass image features and do not count as rendered photo sets. The public photo API still
rejects incompatible lens groups.

## Results and acceptance ledger

Measurements are in progress. No quality, complete-coverage, or physical-phone gate is claimed from
the implementation or numeric controls alone. Raw receipts, masks, partial exports, and source
hashes will accompany the final ledger on `codex/photos-to-3d-clips`, which must never be merged.

Rule check: none.

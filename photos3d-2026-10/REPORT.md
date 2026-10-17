# Photos to 3D: task 104 negative result

The investigated reuse path does not meet task 104's acceptance criteria. No Photos to 3D shelf
entry ships from this investigation. The deliverables are a repeatable camera/trainer diagnostic,
exact-correspondence geometry controls, a pinned licensed capture, tests, and this report. Codex
(GPT-6) built them on `codex/photos-to-3d` from main `ceb51de7a` on October 17, 2026.

The result concerns the existing Video to 3D core and its settings. It establishes neither a general
impossibility of browser photogrammetry nor the quality achievable after substantial solver work.

The primary replay uses the exact probe files preserved in public source snapshot
`1e7071d291b66eb6c05b5113aa0ec52dcc5e569b`. Its phone previews arrived at 29.66 seconds (shuffled)
and 34.95 seconds (sorted), again with only four placed cameras. The earlier exploratory previews
below were faster. Replays overlapped regression/formatting work; these wall times are not a
controlled device-speed comparison. Each receipt preserves its exact source hashes, camera list, and
settings.

## Evidence and protocol

The real input is **one capture**, AliceVision's
[Buddha dataset](https://github.com/alicevision/dataset_buddha/blob/9067f679eb5a772c3e818b7a12dc35882c071858/README.md),
by Simone Gasparini, Fabien Castan, and Yann Lanthony, under
[CC BY 4.0](https://github.com/alicevision/dataset_buddha/blob/9067f679eb5a772c3e818b7a12dc35882c071858/LICENSE.md).
Both live pages were opened on October 17, 2026. Twenty-four of its 67 original PNGs were selected
at evenly spaced filename indices, before solving. They total 105,183,167 bytes. Original files
remain outside git. `tools/assets.json` records the pinned source commit, authors, license,
selection, size, and SHA-256 of every file. No retouching, masking, or synthetic views were added.
The capture includes repeated surface details, camera rolls, and substantial changes in view.

`tools/photos3d-probe.mjs` supplies the files through a real browser file input and calls the
existing Splat.js `Session.load`, `solve`, `seed`, view, and export APIs. It imports the existing
Video to 3D settings, refinement schedule, and surface seeder. No existing product or vendor module
is modified. Input order and source identity are retained in every returned camera and omission.

The phone-setting probe keeps all 24 photos. This exceeds Video to 3D's 16-frame phone cap; it uses
the existing 480-pixel feature side, 320-pixel training side, 15,000-seed budget, and 30,000-splat
ceiling. Desktop uses the existing `high` feature/training settings. The diagnostic uses cooperative
CPU matching on software WebGPU, as Video to 3D does. A preview is timed only after its GPU queue
finishes. The export smoke probe requests two optimizer iterations; bounded batches can finish more.
It does not run the full 1,200-iteration phone training schedule.

This Linux container has a four-core CPU-time quota, a 16 GiB memory limit, no `/dev/dri` device,
and Chromium's software WebGPU adapter. Viewport size is 390 × 844. These are software-adapter
diagnostics, with occasional concurrent diagnostic work, not physical-phone timing or thermal tests.
Peak process/GPU memory was not measured. A successful export proves that the partial result can be
saved; it does not prove that it reconstructs the object.

Raw camera solutions, logs, provenance hashes, and export receipts belong on
[`codex/photos-to-3d-clips`](https://github.com/ryanjosephkamp/splashery/tree/codex/photos-to-3d-clips/photos3d-2026-10),
which must never be merged. Each measurement records its source hashes and invocation. No failed or
partial solve is assigned SSIM zero or silently omitted from a success denominator.

## Top three blockers and what removes them

### 1. Photo coverage fails before training

The 24-photo phone-setting probes placed **4/24 cameras** with sorted filenames and **4/24** with
shuffle seed 104. Twenty photos in each run received no guessed pose. A preview arrived in about 21
seconds, but it showed only a small registered component. That cannot establish the 24-photo
first-view goal. Low reprojection error on four retained cameras does not establish object coverage.

The strict shuffled match pass retained only 17 of 276 candidate pairs. Its diagnostics show
isolated and weakly connected photos, with hundreds of detected features rather than the requested
maximum of 3,000. Raising a feature-count ceiling alone cannot supply missing discriminative detail.
The existing retry is also insufficient in this capture.

The shuffled desktop cross-check raises the feature side to 960 pixels. It places **11/24 cameras**
and 759 sparse points, with 0.50-pixel bundle-adjustment RMS, after 372.5 seconds on this software
adapter. Its strict pass retains 28/276 pairs. The retry places 10 cameras, so the solver correctly
keeps the better first pass. Higher resolution improves coverage but still leaves most of the input
unplaced; no desktop training score is claimed. The earlier exploratory desktop solve placed the
same 11 cameras in 261.9 seconds; the difference is not evidence of a solver speed change.

Pair scheduling remains order dependent above 30 inputs: the actual 60-camera control schedules
1,370 pairs out of 1,770 possible pairs. The `dense` schedule still uses filename-index windows and
strides. Its fallback additionally grants weaker thresholds to index neighbors. This observation
identifies an assumption to replace; it does not prove that exhaustive matching alone fixes the
capture.

**Removal:** Add a photo-specific, order-independent pair proposal and verified match graph; expose
connected components, per-image support, and registration rejection reasons; validate descriptor
scale/rotation robustness at phone resolutions; then measure complete object coverage across six
independent captures. Compare retrieval-selected pairs with exhaustive matching for 8–60 inputs. Do
not loosen geometric thresholds until the camera-error and held-out-image checks support it.

### 2. Shared intrinsics can register geometrically wrong cameras

`sfm.js` gives every photo the same focal multiplier relative to its longest side, centered
principal point, shared radial distortion, and shared aspect refinement. `Session.solve` uses an
EXIF focal prior only when at least 60% of frames agree within a 1.1 focal ratio; varying EXIF
focals fall back to shared focal search. It does not calibrate each photo independently.

An exact-correspondence 24-camera control isolates this from feature detection: 140 unique 3D point
identities, a full orbit, zero pixel noise, and one fixed global similarity alignment for all
returned cameras. Scene size is the diagonal of the points' 1.6 × 1.6 × 1.6 bounding cube. With
uniform 420-pixel focal length, all 24 cameras recover with effectively zero rotation error and
median center error below 0.000002% of scene size. This verifies the scoring convention and a
favorable numeric path.

Alternating 315- and 567-pixel lenses still registers **24/24 cameras**, but the median center error
is **33.36%** when forced to a shared 420-pixel focal length, and **30.06%** with the solver's free
shared-focal search and bundle adjustment. Median rotation remains below 2°; the position gate fails
badly. Registration count and reprojection RMS cannot certify correct cameras.

These are analytic correspondence controls, **not rendered synthetic photo sets**. They bypass image
feature detection, occlusion, and texture. They do not count toward the task's synthetic gate.

**Removal:** Support per-image calibrated intrinsics or explicit camera/lens groups through
matching, PnP, triangulation, and bundle adjustment. Alternatively, constrain the first tool to a
verified single-lens capture and reject incompatible photos with a clear reason. Validate on three
rendered sets with exact cameras, including shuffled order, rolled/portrait images, and lens
changes.

### 3. The acceptance benchmark needs an independent appearance split and device measurements

`Session.seed` initializes from the sparse point colors collected by SfM; the Video surface seeder
also samples frame RGB. The loss exclusions in `_applyTrainingSplit` are applied after these seed
colors are chosen. Merely setting `evalFrames` or `holdout` therefore does not establish that a
photo's appearance was excluded from the reconstruction's initialization.

In the uniform correspondence control, changing only image 0's color callback from red to blue
leaves the solved geometry unchanged, while the mean sparse seed color changes from
`(2/3, 1/3, 1/3)` to `(1/3, 1/3, 2/3)`. The selected image contributes one third of the sampled
color in this control. This probes the sparse-color path, not a quantified SSIM bias in real photos.

Only one independently licensed real capture was evaluated; six leave-one-out masked sets were not
completed. No task-105 Blender dataset or branch was available when checked, and the earlier truth
release exposes no downloadable assets. No physical phone is attached. Neither this corpus nor this
environment can establish the requested quality, complete phone training, or peak-memory claims.

**Removal:** Keep each held-out photo's RGB and mask out of sparse/surface seed appearance,
training, and environment fitting. A held-out camera may be solved geometrically as the brief
permits; freeze that protocol explicitly. Add a sentinel test showing that changing held-out
appearance cannot change the trained model. Freeze six licensed object captures with independent
object masks, then run every leave-one-out fold and report failures alongside masked SSIM/PSNR and
coverage. Finally measure the same 24-photo path on a named physical phone, including first preview,
peak memory, completion, cancellation, and save-after-stop.

## Acceptance ledger

| Gate                                             | Evidence                                                                        | Outcome                           |
| ------------------------------------------------ | ------------------------------------------------------------------------------- | --------------------------------- |
| Six real sets, median held-out masked SSIM ≥0.80 | One real capture; partial cameras; no independent held-out appearance benchmark | Not established                   |
| Phone profile finishes every set                 | Two short partial-scene export probes; no complete corpus training              | Not established                   |
| Synthetic rotation <2° and position <2%          | Analytic controls only; mixed-focal position errors >30%                        | Rendered-set gate not established |
| 24-photo first view ≤180 seconds                 | Fast preview of only 4 registered photos on software WebGPU                     | Not established                   |
| Peak memory within phone limits                  | Not measured; 24 inputs exceed the existing phone input cap                     | Not established                   |
| Ten paired phone review clips                    | No accepted full reconstruction to present                                      | Not produced                      |
| Existing specs pass                              | See verification below                                                          | No whole-suite claim              |

## Reproduction and verification

```sh
node tools/photos3d-fetch.mjs
SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/photos3d-probe.mjs \
  --input=.cache/photos3d/buddha --profile=phone --shuffle=104 --steps=2 \
  --out=.cache/photos3d/replay-phone.json
node tools/photos3d-probe.mjs --control=uniform --out=.cache/photos3d/uniform.json
node tools/photos3d-probe.mjs --control=mixed --calibration=free \
  --out=.cache/photos3d/mixed.json
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test tests/cdx-photos3d.spec.mjs
```

The six diagnostic specs passed. They check one global camera-gauge alignment, relative rotation
errors, missing/invalid camera identities, deterministic permutations, the real numeric solver on 24
known cameras, and a real browser rejection of eight blank photos without invented poses. The
browser case runs existing decoding and matching, including deadline disposal; the host watchdog is
also tested against work that never settles. The exact-correspondence cases do not test image
features or rendered quality. The downloader verified all 24 pinned original file hashes.

The nine primary receipts passed an independent file audit: every recorded source hash matches its
recorded Git commit, all 24 input hashes match the frozen record, and returned/missing camera
identities account for every photo. The red/blue camera arrays match exactly. Both stopped PLY
exports match their recorded hashes and parse into finite positions; the existing exporter removes
dead splats, leaving 12,607 and 14,360 exported splats from 14,979 and 14,992 trainer rows.

Verification completed with `/usr/bin/chromium`:

- `tests/cdx-photos3d.spec.mjs`: **6 passed**.
- `tests/v3d.spec.mjs` and the existing CPU-match, tier-limit, surface-seed, seed-bound, and SSIM
  specs: **40 passed**.
- After `git fetch origin main && git merge origin/main` (already current at `ceb51de7a`),
  `node tools/preflight.mjs`: **all checks passed, including 270 shelf-wide tests**. This includes
  repository-wide Prettier, American English, generated-site freshness, shared-list parsing, and
  file-size checks. Generated screenshots were restored. No existing spec was edited or waived; the
  full suite beyond these selections was not run.

The production tool, six-set SSIM experiment, full phone training benchmark, and ten paired clips
were cut under the brief's negative-result exit. Existing Video to 3D source and tests remain
unchanged. Rule check: none.

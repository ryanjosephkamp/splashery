# Studio ground truth, October 2026

Codex (GPT-6) reconstructed this implementation from task 56's repository brief. All evidence in
this report comes from this implementation's Linux cloud runs. The baseline is unmodified `main` at
`58f3d8ede13714bf4b3d1f99fbf3b29d7f60e492`; no product source or vendor files are changed.

This checkpoint contains 12 validated still fixtures, the seeded Blender generator, independent
camera checks, the browser scorer, and the fixture validator. All twelve full scene sequences are
freshly generated. Supplemental held-out truth and all-scene baseline measurements are still in
progress. This is not a completed baseline.

![The 12 original procedural scenes](../../tests/fixtures/truth/contact-sheet.jpg)

| Scene                      | Construction and stress case                                              |
| -------------------------- | ------------------------------------------------------------------------- |
| Glass and metal still life | Spheres, cylinders, and a wooden table; transmission and reflection masks |
| Room interior              | Walls, furniture, and shelves; corners and overlapping depth planes       |
| Forest path                | Seeded trunks and polygonal crowns; repetition and distant occlusion      |
| Stairs and railings        | Ten steps and thin rails; repeated edges and narrow parts                 |
| Cliff and sea              | Scaled rock spheres and reflective water; rough geometry and invalid sky  |
| Cluttered desk             | Overlapping blocks and narrow rods; small objects and gaps                |
| Fur on a sphere            | 650 cylinder fibers; fine geometry and silhouettes                        |
| Night street and lamps     | Lamps, emission, and dark walls; low contrast and non-diffuse appearance  |
| Lattice and colored blocks | Thin bars and separated blocks; disocclusion and subpixel geometry        |
| Arch corridor              | Nested arches and pillars; depth range and repetition                     |
| Leaves and pots            | Flattened ellipsoids and cylinders; thin leaves and foreground cuts       |
| Depth edge blocks          | Alternating boxes and a foreground rod; abrupt planar depth steps         |

Each scene has a fixed seed (5600–5611), original materials, and no external assets. Contact-sheet
review found an occluded water plane in the initial build; it was corrected before these fixtures
were rebuilt. The compact set is about 20.14 MB, below the 40 MB Git limit. File hashes are in
`tests/fixtures/truth/assets.json`. All twelve full-run still depth and mask files match the compact
fixtures exactly, and pose values match. Eleven decoded still images also match pixel for pixel;
night differs (RGB MAE 2.0414/255, maximum channel difference 130). JPEG byte identity also fails
because of metadata. This observed beauty-build variation is preserved and reported; original
compact Photo measurements and full-run held-out measurements retain their own input hashes.

The [fixture guide](../../tests/fixtures/truth/README.md) defines units, intrinsics, extrinsics,
invalid pixels, and appearance masks. Glass and reflections have first-hit geometry depth, which is
not universal appearance truth. The stills are 1280×720; the four-second and ten-second videos are
640×360 at 30 fps. The videos' lower resolution is an explicit deviation from a full-resolution
video dataset.

Fresh checkpoint verification:

- `python3 tests/studio-truth-camera.py`: 3 passed.
- `python3 tests/studio-truth-validation.py`: 3 passed; missing still/handheld depth or unpaired
  masks are rejected.
- `node --test --test-concurrency=1 tests/studio-truth*.test.mjs`: 16 passed, including lossless
  prediction transport, camera-gauge alignment, and median-plane projection checks.
- `blender -b --factory-startup --threads 4 --python-exit-code 1 --python tests/studio-truth-blender.py`:
  7 passed against real BVH geometry, including axial near/far clipping and camera-helper resume
  identity checks. The clipping regressions first recorded 4 passes and 2 failures, then passed
  unchanged after the generator fix.
- Sandboxed Chromium 151.0.7922.173 launches with no graphics overrides; its initial probe offers
  WebGL2 but no WebGPU. The real toy probe measured Photo to 3D depth and captured an actual flat
  front-view image. All-scene baseline scoring is in progress.
- Pip exposes no compatible `bpy` wheel for Python 3.12 in this environment; the generator uses the
  installed native Linux Blender 4.3.2 instead.

Full clip data and archives belong in the ignored `.cache/studio-truth/` directory. The clean run is
`.cache/studio-truth/full-v1`; all twelve scenes have completed 120-frame handheld and 300-frame
walk sequences. The complete local archive is `.cache/studio-truth/studio-truth-2026-10.tar.gz`:
1,399,053,452 bytes, SHA-256 `521594f3af3aa43c50fdb980fe32c63e3b8579dacb3d149c9a8d71237cef0070`.
Full validation checks 5,052 RGB frames/poses and 1,896 depth/mask pairs, including 444 held-out
walk views; valid recorded depth spans 2.1313–27.9809 meters. Checksums cover 8,934 files plus the
checksum inventory. The local fetch/extraction command verified SHA-256, extracted safely, and
passed full validation. The full upload also returned HTTP 401; the existing draft release still has
no assets.

The archive retains its exact original driver, camera helper, and supplemental builder in `source/`.
The driver SHA-256 is `57f8a7645c467c2a75448fa2317f8c2ab78a100d3c76c0f78f70af07243f6cf6`; helper
SHA-256 is `c6484004609f177b1d2ac077b60d5470b143f32b85c956db8dfbaef65f1b215b`. Generator updates
after this build corrected general near/far clipping and added helper/runtime identity to resume
checks. The current fixtures sit inside the clip planes; the retained sources identify their
original build. Use a new output folder for the updated generator. Do not silently resume this
historical dataset with revised source.

Rule check: none. Procedural assets are CC0, made by Ryan with Codex (GPT-6). There is no phone
hardware evidence. Desktop browser viewports are not phone testing.

## Fresh Photo baseline

The [complete measurements and capture references](studio-truth-2026-10/main-photo.json) contain
twelve real Photo inference runs and twelve actual flat front-view captures. All depth-hole and
front-view alpha-hole counts are zero on valid diffuse truth pixels. Flat SSIM and sharpness measure
source preservation, not novel-view quality. Sharpness greater than one can indicate oversharpening
or resampling. The edge-band error is RGB MAE in a depth-edge band (0–255), a halo proxy rather than
a pure halo detector. Video capability probes are blocked for all twelve inputs: no graphics
adapter. Moving depth and temporal scoring has completed all twelve scenes. All rows retain partial
render coverage.

| Scene      | Depth AbsRel | Depth RMSE (m) | Flat edge-band MAE | Flat SSIM | Flat sharpness ratio |
| ---------- | -----------: | -------------: | -----------------: | --------: | -------------------: |
| still-life |       0.0192 |         0.3366 |              3.009 |    0.9879 |                1.186 |
| room       |       0.0236 |         0.2497 |              3.414 |    0.9831 |                1.034 |
| forest     |       0.0451 |         0.9778 |              2.200 |    0.9843 |                1.146 |
| stairs     |       0.0684 |         1.0228 |              3.266 |    0.9809 |                1.231 |
| coast      |       0.0321 |         0.6223 |              3.026 |    0.9766 |                1.752 |
| desk       |       0.0236 |         0.2730 |              3.204 |    0.9800 |                1.150 |
| fur        |       0.0640 |         1.1291 |              5.301 |    0.9857 |                0.930 |
| night      |       0.0702 |         1.3709 |              2.345 |    0.9656 |                0.792 |
| lattice    |       0.1318 |         1.4699 |              6.899 |    0.9108 |                1.352 |
| arches     |       0.1178 |         1.3540 |              2.450 |    0.9848 |                1.028 |
| leaves     |       0.0509 |         1.1358 |              3.903 |    0.9647 |                1.500 |
| steps      |       0.0261 |         0.6230 |              3.904 |    0.9805 |                1.242 |

## Fresh Moving depth baseline

The completed rows are recorded in [the first scene](studio-truth-2026-10/main-moving-first.json),
[the next nine scenes](studio-truth-2026-10/main-moving-rest.json), and
[the final two scenes](studio-truth-2026-10/main-moving-final.json). All 720 extracted frames have
observed decoded timestamps and depth scores; 708 adjacent comparisons remove camera motion and
reject occlusion. Each scene keeps the first frame calibration. Values below weight depth errors by
scored pixels and temporal mean error change by valid point observations. No Moving color,
render-hole, edge-band, or held-out score is claimed. Each batch exits 1 because its render coverage
remains partial.

| Scene      | Depth AbsRel | Depth RMSE (m) | Calibrated depth hole pixels | Temporal mean error change (m) |
| ---------- | -----------: | -------------: | ---------------------------: | -----------------------------: |
| still-life |       0.0541 |         0.9557 |                            0 |                         0.0690 |
| room       |       0.1598 |         1.3572 |                            0 |                         0.0954 |
| forest     |       0.2373 |         3.1698 |                            0 |                         0.1144 |
| stairs     |       0.1826 |         2.8617 |                            0 |                         0.4126 |
| coast      |       0.2194 |         1.8337 |                            0 |                         0.0812 |
| desk       |       0.0722 |         0.9385 |                            0 |                         0.0683 |
| fur        |       0.1724 |         2.4735 |                            0 |                         0.0854 |
| night      |       0.2146 |         2.7248 |                            0 |                         0.2235 |
| lattice    |       0.2155 |         2.5876 |                            0 |                         0.0631 |
| arches     |       0.1884 |         1.7636 |                            0 |                         0.1600 |
| leaves     |       0.1915 |         2.6591 |                            0 |                         0.1156 |
| steps      |       0.1172 |         1.8136 |                            0 |                         0.0543 |

## Measurement contract and limits

The scorer imports real product entry points in sandboxed Chromium, blocks outside-origin requests,
and opens one page at a time. It verifies that `src/` and `vendor/` match the baseline. Model output
is relative inverse depth. A positive affine inverse-depth calibration is fitted to a fixed
one-eighth of valid diffuse pixels; the other seven-eighths are scored. This is a calibrated
geometric benchmark, not a claim of metric-depth inference. Nonpositive or nonfinite calibrated
inverse depths are counted separately as missing depth.

Temporal jitter follows the same world point through camera poses and rejects occlusion. It measures
changes in signed depth error, not movement of a fixed screen pixel. The first frame's calibration
is kept for later frames. Color references are area-averaged to avoid comparing antialiased renders
with aliased source noise. SSIM uses valid 7×7 windows; sharpness is the ratio of Laplacian
variances.

Flat front-view diagnostics use Photo's actual projected source rectangle and its flat control.
Alpha holes and source color error in a depth-edge band are measured in this view. These do not
establish turned-view holes, disocclusion, or held-out sharpness. Moving color metrics are withheld.
Held-out results have not run at this checkpoint. Video to 3D's capability probe reports no WebGPU
graphics adapter. Training and held-out rendering are unavailable; a solved-camera alignment and a
training-frame exclusion adapter are also still needed.

An early Moving probe registered 28 of 60 extracted frames and measured 27 adjacent depth-error
changes. The other 32 frames have null metrics and break temporal adjacency. Its earlier color
captures are excluded from baseline evidence: review found that the separate Sharp renderer video
seeks asynchronously, so a fixed capture delay cannot establish its decoded color timestamp. Moving
color and held-out scores are withheld until this registration is available. The scorer does not
guess a decoded timestamp from a seek target.

The [latest complete first-scene depth row](studio-truth-2026-10/main-moving-first.json) registered
all 60 extracted frames and measured 59 adjacent depth comparisons. Overall coverage remains partial
because color/render metrics are unavailable. Unrelated stage animation is paused through the player
API during inference. The earlier unpaused batch reached its 600-second bound with 22 depth frames
scored; that failure is preserved. Lossless byte transport avoids serializing large decimal arrays
without changing any prediction values or scoring formulas.

The supplemental builder reserves 37 walk frames for evaluation, adds their exact depth and masks,
and encodes a separate training video from the other 262 raw frames. Photo held-out camera
diagnostics use a declared source median-depth plane calibration; they have not run at this
checkpoint. The code's similarity calibration is tested against a known transform, but the Video
solved-camera/render adapter is still incomplete and has no GPU evidence.

The beauty references contain Monte Carlo noise: walk frames use two Cycles samples at 640×360,
whereas the source still uses eight samples at 1280×720. This resolution/sample difference confounds
held-out SSIM and Laplacian sharpness ratios. Low ratios cannot be attributed entirely to the toy's
blur. These are transparent low-sample diagnostics, not a noise-free appearance benchmark.

The first three complete scene sets were archived locally (329,879,486 bytes; SHA-256
`08f23a76ffd7dbad21025e95bf34153b195cb29d399c57e4673519cb454b98e1`). This subset is not the full
dataset. The existing draft release `studio-truth-2026-10` has no uploaded assets: GitHub's upload
endpoint returned HTTP 401 while repository API and Git operations continued to work. No
authentication or account privacy settings were changed. The default download command is therefore
blocked until hosting succeeds.

## Preserved failures

The initial camera check encountered its not-yet-created module. Six metric checks failed for
missing functionality before implementation. A full-frame jitter regression failed with a stack
overflow (8 passed, 1 failed); the reduction was fixed, and the regression passed unchanged. The
area-sampling check also failed before implementation. Early compact validation rejected an
incomplete manifest; clean 12-scene validation passed after generation finished. Logs stay in
`.cache/studio-truth/`.

The first browser probe timed out on Photo to 3D after 180 seconds and reported Video to 3D blocked
by the missing adapter. A 600-second probe completed Photo to 3D inference and captured a real
front-view image. The failed probe is preserved separately.

No product assertions or thresholds were changed. The repository's default Playwright launcher uses
unsafe graphics flags and bypasses the GPU blocklist; it is not used. The added safe config replaces
those options with sandboxed Chromium defaults. A safe regression attempt and the required
formatting and English checks will be reported at handback.

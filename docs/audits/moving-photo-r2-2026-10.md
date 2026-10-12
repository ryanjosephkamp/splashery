# Moving photo to 3D, round 2

October 12, 2026. Codex (GPT-6) built task 38. This branch carries task 32’s stabilizer and replaces
draft PR #479.

## Results and limits

Sample switching paints the selected clip’s own pixels in the first Sharp update, including
MP3-backed films and loading or seeking video. Paused pictures stay in Sharp view while the camera
or decoder updates. Speaker changes reach playing and paused tracks, including a track first opened
while sound was off. Uploads open after four model answers, then refine all retained depth frames
and use larger answers on stronger tiers. The video picture retains its native resolution and
playback rate; geometry is still sampled at the existing 12/15/24 fps device budget.

The upload gap is substantially smaller, but it is not uniformly closed: the machine still has more
measured height jitter than its prepared sample, and the Tears of Steel upload exposes more backing.
The numerical data below and phone clips make that remaining gap reviewable. These are
relative-depth and renderer measurements, not depth ground truth or phone hardware performance
benchmarks.

## Before and after

Measured baseline: local `c7560ad6`, task 32 plus the main branch fetched at the start. Public
`5e5671b0` has the identical tree and can reproduce that baseline. Low tier, actual local Chromium,
actual vendored model for uploads. The same input file, extraction budget, and dimensions are used
on both sides of each comparison. Source bunny video and horse GIF are original repository files.
The other three short films are lossless VP9 reconstructions of the shipped JPEG frame sheets, not
the unavailable original downloads. The 60 fps clip is a two-second procedural fixture.

Still-color jitter and edge flips use task 32’s definitions: RGB RMS change at most eight byte
levels; a flip is a normalized height jump greater than 0.15. The surface-cut share counts triangles
with a depth span over 0.05; it is a geometry proxy for regions that need backing, not unfilled
background pixels. Opening time is one local construction, including video reading and the first
preview; the final time includes background refinement. CPU resources were shared with other
verification processes, so these timings support no phone speed claim.

| Clip    | Path   | Height jitter before → after | Flips/1,000 before → after | Surface cuts % before → after | Open ms before → after | Final ms |
| ------- | ------ | ---------------------------- | -------------------------- | ----------------------------- | ---------------------- | -------- |
| sample  | sample | 0.005159 → 0.005159          | 5.04 → 5.04                | 1.731 → 1.731                 | 1905 → 2161            | 2656     |
| sample  | upload | 0.005792 → 0.003243          | 4.75 → 0.94                | 1.819 → 1.711                 | 20862 → 14844          | 34375    |
| horse   | sample | 0.092114 → 0.092114          | 188.59 → 188.59            | 0.040 → 0.040                 | 149 → 212              | 260      |
| horse   | upload | 0.145056 → 0.009273          | 280.53 → 0.01              | 0.351 → 0.127                 | 5135 → 2582            | 7430     |
| dragon  | sample | 0.011705 → 0.011705          | 6.11 → 6.11                | 0.169 → 0.169                 | 1415 → 1542            | 1820     |
| dragon  | upload | 0.017237 → 0.012178          | 4.23 → 0.04                | 0.344 → 0.323                 | 16310 → 14205          | 31198    |
| bridge  | sample | 0.014792 → 0.014792          | 3.11 → 3.11                | 3.556 → 3.556                 | 1057 → 1307            | 1632     |
| bridge  | upload | 0.013396 → 0.012457          | 2.96 → 3.21                | 6.456 → 8.525                 | 16253 → 14530          | 28197    |
| machine | sample | 0.012685 → 0.012685          | 16.33 → 16.33              | 0.000 → 0.000                 | 1378 → 1854            | 2202     |
| machine | upload | 0.030624 → 0.017809          | 75.40 → 0.91               | 0.061 → 0.878                 | 17208 → 15805          | 34069    |
| fast60  | upload | 0.010586 → 0.006401          | 0.97 → 0.00                | 0.085 → 0.047                 | 6718 → 6203            | 12569    |

Samples retain 96 frames at 480 pixels wide (16 fps), except the 300 × 200 horse (15 frames at 10
fps). Low-tier uploads retain 72 bunny frames at 327 × 184, 15 horse frames at 300 × 200, 71 dragon
frames at 376 × 160, 71 bridge frames at 379 × 159, 71 machine frames at 327 × 184, and 24
fast-fixture frames at 320 × 180. Sample-versus-upload metrics are therefore not a same-grid or
same-cadence depth error. Before-versus-after measurements within a path are comparable.

### Rendered holes and backing

The actual ReliefMesh shader was rendered at 390 × 844, with a fixed camera (yaw 0.18, pitch 0.08,
relative distance 4.5), a 0.54 lift, and the inner 70% of the projected picture sampled at 5%, 50%,
and 90% of source time. Transparent alpha counts unfilled background; paired backing tint counts
exposed backing without counting magenta already in the source. This is a controlled renderer check,
not a recording of live playback, and it excludes outer silhouettes and unsampled times.

| Clip    | Path   | Background holes % before → after | Exposed backing % before → after |
| ------- | ------ | --------------------------------- | -------------------------------- |
| sample  | sample | 0.000 → 0.000                     | 9.692 → 9.692                    |
| sample  | upload | 0.000 → 0.000                     | 10.804 → 11.503                  |
| horse   | sample | 0.000 → 0.000                     | 0.001 → 0.001                    |
| horse   | upload | 0.000 → 0.000                     | 0.017 → 0.366                    |
| dragon  | sample | 0.000 → 0.000                     | 0.643 → 0.643                    |
| dragon  | upload | 0.000 → 0.000                     | 0.555 → 0.000                    |
| bridge  | sample | 0.000 → 0.000                     | 8.939 → 8.939                    |
| bridge  | upload | 0.000 → 0.000                     | 10.226 → 14.285                  |
| machine | sample | 0.000 → 0.000                     | 0.000 → 0.000                    |
| machine | upload | 0.000 → 0.000                     | 0.000 → 0.000                    |
| fast60  | upload | 0.000 → 0.000                     | 0.134 → 0.000                    |

Zero unfilled background in these central snapshots does not mean there are no visual gaps: backing
can show the wrong side of an occlusion, and fine model contours still tear at oblique views. The
bridge upload’s backing exposure increases from 10.23% to 14.28%; the horse’s from 0.017% to 0.366%.
These are known limitations, not reported as improvements.

## What changed

- Sharp uses decoded clip frames immediately, never an MP3 as a video. It reuses an opened video’s
  own copy, checks readiness and clock alignment, and handles paused seeks with a decoded canvas
  snapshot. A clip version invalidates depth after refinement.
- Track observes its Sound instance once. Its toggle synchronously updates each element and its
  per-track gain, creating routing on first enabling even while paused. Closing the last track
  restores the original toggle and releases the subscription.
- A short upload uses one worker and one model session: four first answers, the existing sparse
  budget, every retained frame, and then 294-pixel answers on mid/high/max. Larger and denser passes
  keep the initial global range and resting mean; robust per-frame endpoint matching fits each new
  answer to the preceding pass at the same source time.
- Sparse interpolation uses actual frame delays, bounded cubic tangents, and a coarse/fine color
  search within four model cells. Still colors keep the cubic answer; moving colors can follow a
  surface instead of blending different surfaces at one coordinate.
- The refined temporal filter spans about half a second on either side and rejects changed colors;
  still-color depth outliers are smoothed instead of excluded. Playback has no causal filter delay
  because future answers are available before a pass is presented.
- Short and long depth replacements ease over 500 ms. No camera motion is added; the toy keeps its
  turntable off. A new file cancels the previous refinement before allocating another model worker.
- Long uploads refine temporal gaps after their first whole-clip pass, as the cache budget permits.
  Both caches count toward the budget during replacement; an hour-long clip already at its budget
  may retain its coarse pass. Longer sample films use color-guided enlargement of baked depth; a
  second edge snap is avoided because it invented cuts inside smooth surfaces.

## Longer films

Each film is opt-in; the default six-second bunny and its loading behavior remain unchanged. Each
native playback frame has a model estimate in the offline cache. No model loads when a prepared film
is watched. Byte counts and individual SHA-256 hashes are in tools/assets.json.

| Film         | Seconds | Frames | Distinct depth frames | Video bytes | Depth bytes | Combined MB |
| ------------ | ------- | ------ | --------------------- | ----------- | ----------- | ----------- |
| sample-long  | 30      | 720    | 720                   | 1411629     | 15805452    | 17.217      |
| dragon-long  | 30      | 720    | 691                   | 975594      | 11854092    | 12.830      |
| machine-long | 30      | 720    | 720                   | 1951701     | 15805452    | 17.757      |
| bridge-long  | 27      | 648    | 648                   | 2176133     | 10668684    | 12.845      |

No file exceeds 20 MB. Native encoded pictures are modest-resolution archive copies; no upscale is
presented as recovered detail. The Tears of Steel film is a 27-second montage, rather than an
uninterrupted 30-second extension: selected city and robot shots exclude identifiable live-action
faces and modern firearms. Its exact source intervals are in the asset record and in-app credits.

Live source license records opened on October 12, 2026:
[Big Buck Bunny](https://archive.org/details/BigBuckBunny_328) (CC BY 3.0 US),
[Sintel](https://archive.org/details/Sintel) (CC BY 3.0),
[Elephants Dream](https://archive.org/details/ElephantsDream) (CC BY 3.0 US), and
[Tears of Steel](https://archive.org/details/Tears-of-Steel) (CC BY 3.0). The original Blender
project pages returned HTTP 403, so their original notices could not be rechecked. The original
source-copy declaration and the inherited short-sample licenses are not silently treated as the same
version.

## What did not help

- Fitting dense answers successively compounded affine errors. Fitting every answer to the first
  scene was worse across cuts: machine upload jitter reached 0.144 in an exploratory run. Matching
  robust ranges to the preceding pass at the same time avoids those unrelated scene units.
- Rejecting large still-color depth changes in the dense filter preserved model outliers. Keeping
  those colors in the symmetric smoothing window reduced flips.
- A video element is not a picture source for MP3 samples; keeping the previous texture while it
  loads was the direct switching defect.
- The initial offline bake was invalid: Python’s static server supplied no byte ranges, Chromium
  reported seekable.end() as zero, and all model calls saw the first picture. Those files were
  discarded. The range-capable local server, seek-position guard, distinct-picture check, and
  depth-frame diversity regression prevent that false result. All shipped caches were rebuilt from
  real source times.

## Reproduce

```sh
node tools/cdx-mp2-server.mjs 4388
# In another shell:
export SPLASHERY_CHROMIUM=/usr/bin/chromium
export SPLASHERY_URL=http://127.0.0.1:4388/
node tools/cdx-mp2-measure.mjs --baseline=5e5671b0 --out=.cache/cdx-mp2/before.json
node tools/cdx-mp2-measure.mjs --out=.cache/cdx-mp2/after.json
node tools/cdx-mp2-holes.mjs --baseline=5e5671b0 --out=.cache/cdx-mp2/holes-before.json
node tools/cdx-mp2-holes.mjs --out=.cache/cdx-mp2/holes-after.json
node tools/cdx-mp2-samples.mjs
# Requires the source downloads at the .cache/smd paths in LONG_SAMPLES.
node tools/cdx-mp2-review.mjs .cache/cdx-mp2/review
```

Raw measurements remain in the ignored cache. The tables above preserve the recorded results. The
review renderer follows the live-clip capture pipeline with explicit decoded-video seeks and
per-frame clock records; its clock is stepped and the toy drive is held while each picture is
presented. Model inference, decoding, textures, depth, and the renderer are real. Review GIFs are
silent; native sound and playback timing are verified separately.

## Verification

Real Chromium (software WebGL2), at 390 × 844 and 1440 × 900 where the named screenshot specs
request them. Browser plugin was unavailable; regular Playwright was used.

- The required suite covered `smd-moving`, `live3`, `live3-engine`, `live5`, `live6`, `lv7-long`,
  `psv`, `psv2`, `psv3`, `phf`, `phf2`, `phf-engine`, `smd-compare`, and `cdx-stability`: 99 passed
  and four failed in the initial overlapping run. Overlapping Playwright invocations shared the
  default artifact directory, deleting a trace; concurrent CPU work also disturbed tight timing
  checks. The affected `phf2` and `smd-moving` files passed an isolated rerun, 23/23.
- `cdx-mp2` initially passed eight browser tests; the added frame-diversity check makes nine. The
  final run also verifies that paused pictures stay Sharp through repeated stage updates.
- `smoke` plus the eight then-current new tests passed 58/58, including embed transfer ≤ 30 MB and
  the WebGPU availability check. The full unrelated repository suite was not run.
- After media changes, the Moving photo subset of `psv3` plus the eight new tests passed 16/17 under
  simultaneous review rendering; one wrap was first observed at 0.622 seconds against a 0.5-second
  bound. That precise real-browser sound-loop test passed in isolation. `lv7-long` and
  `cdx-stability` passed again, 12/12.
- `node tools/check-packs.mjs moving-photo-3d`, `node tools/nc-assets.mjs --check`, the contact
  sheet, Prettier, American English, and diff whitespace checks were run. Existing screenshots were
  restored after the runs. No depth worker, model implementation, relief-mesh code, other photo
  path, library, or dependency changed.

The new speaker and upload tests use real media, Sound, Track, and the on-device model. The
moving-edge oracle uses synthetic depths to check interpolation. Some existing live-input tests mock
camera/microphone signals; they are regressions, not new measurements. Physical phone frame rate,
perceptual audio quality, every-frame background coverage, and ground-truth depth error remain
unmeasured.

Phone motion evidence is stored on the separate review branch and linked from the draft PR, with
per-frame media clocks. Screenshots and GIFs expose remaining contour gaps instead of hiding them.
The legacy bridge review GIF is excluded under A2; its model and renderer numbers are included
above.

## Rule check and cuts

Rule check: A1 and A2 shaped the Tears of Steel selection; no violation is included in the new
sample files. The legacy six-second bridge review GIF is withheld because it depicts an identifiable
live-action actor (A2: “No real person’s likeness”). Review the new city montage instead, or select
another permitted source. The old sample itself is unchanged. No owner notes or attachments were
committed.

The full upload gap is not claimed closed for every clip, native 60 fps depth inference is not
promised within the existing geometry budget, original short-source downloads were not available for
three comparisons, and real phone hardware/audio audition were not measured.

# Splat mirror r2

October 12, 2026. Codex (GPT-6), `codex/splat-mirror-r2`. Code is offered under Splashery's MIT
license; original generated test input is CC0. No dependencies or production assets were added.

The
[Operator's review](https://github.com/ryanjosephkamp/splashery/pull/559#issuecomment-6118906161)
requested evidence for the moving-clip and sharpness numbers, final-source clips and tests, low and
high measurements, and stricter regression bounds. The
[follow-up](https://github.com/ryanjosephkamp/splashery/pull/559#issuecomment-6130226585) confirms
that the eight owner-approved GIFs may stay in this PR.

## Matched-pose method

The first report's moving-clip columns mixed real movement with noise: the fake camera continued
advancing between screenshots, and the single sharpness reference was taken after the screenshot
sequence. Those numbers do not establish a same-pose regression. The original 12-level sharpening
cap did reduce edge contrast; that was a real regression and is corrected below.

[`tools/cdx-mir-paired.mjs`](../../tools/cdx-mir-paired.mjs) makes held versions of the original
procedural inputs. Geometry stays at an exact phase while twelve seeded sensor-noise frames vary.
Still and low light use phase 0; turn uses 0, 0.25, 0.5, and 0.75; wave uses 0, 0.125, 0.25, and
0.375. The input is 320×240, with the same seed, brightness, and noise as the original clips.

The unchanged shipped depth worker computes each reply in a real browser after the fake-camera tap.
Replies are cached by model, worker, input, and resolution. Both versions receive identical RGBA
frames and real depth replies; the transport is replayed. Every captured model input is checked byte
for byte against the input that produced its recorded reply. The renderer, picture grid, crop,
camera angle, virtual draw times, and noise-frame sequence match. Only the relief module changes:
the tables compare baseline `ec4aaa37` with the final module captured once at the start of the run.
The helper can also replay initial PR `ab4cd7c1`; that optional variant is not part of these tables.
Other files come from the same merged checkout.

Each held pose starts with empty filters, warms for eight answers, and samples the next four. Each
answer has seven draws at 1/30 second. The texture is then held while actual GPU screenshots are
taken face-on and at yaw +0.35; the camera reference uses that same noise frame. Height, color, and
shown changes therefore measure unwanted changes at one pose. They do not measure response to
movement between poses.

Raw sharpness retains Live r7's whole-image gradient ratio, including sensor noise. Real edge
contrast uses a clean, zero-noise version of the exact pose, rendered through the same splat grid in
the existing flat-depth mode. It measures the output gradient along the clean edge direction at
clean gradients of at least three levels. Random perpendicular noise cannot count as sharper detail.
A ratio of 1 is the clean input's edge contrast. Flat noise is the absolute luminance difference in
clean regions whose gradient is below 0.5. This separates detail preservation from noise reduction.

Draw time is the median of five twelve-draw batches, after 24 warm-up draws and draining software
GPU work. It measures CPU filtering with recorded replies and held input. Actual live-camera timing
is measured separately. All measurement runs use a 390×844 viewport at 2× pixel density, adaptation
off, Chromium 151, Playwright 1.56.1, Node 24.19.0, and Mesa llvmpipe on a virtual display. No real
camera or physical phone was used.

## Before and after, by profile

Every cell is **before → final after**. Tables aggregate each clip's held poses by their median.
Height is a fraction of the relief; color and shown changes are RGB levels out of 255. Grain is Live
r7's excess fine-detail estimate. Each pair has the same picture and model-input resolution. The
per-pose checks below cover every pose, not only the aggregate.

### Low (277×208 picture, 140×112 model input)

| Input     | Height                | Color         | Shown         | Turned        |
| --------- | --------------------- | ------------- | ------------- | ------------- |
| still     | 0.0009720 → 0.0000110 | 0.566 → 0.439 | 0.644 → 0.511 | 0.684 → 0.508 |
| turn      | 0.0023504 → 0.0000015 | 0.576 → 0.452 | 0.654 → 0.503 | 1.089 → 0.513 |
| wave      | 0.0011897 → 0.0000013 | 0.570 → 0.456 | 0.603 → 0.507 | 0.668 → 0.520 |
| low-light | 0.2620753 → 0.0048715 | 1.678 → 0.962 | 2.226 → 0.969 | 5.208 → 1.560 |

| Input     | Raw sharpness | Real edge contrast | Flat noise    | Grain         | Draw, ms    |
| --------- | ------------- | ------------------ | ------------- | ------------- | ----------- |
| still     | 0.695 → 0.703 | 1.113 → 1.126      | 1.019 → 1.167 | 0.000 → 0.000 | 7.80 → 7.26 |
| turn      | 0.681 → 0.693 | 1.126 → 1.138      | 1.048 → 1.202 | 0.000 → 0.000 | 7.17 → 7.25 |
| wave      | 0.551 → 0.562 | 1.127 → 1.149      | 0.819 → 0.945 | 0.000 → 0.000 | 7.06 → 7.35 |
| low-light | 0.351 → 0.362 | 1.116 → 1.125      | 1.576 → 1.311 | 0.000 → 0.000 | 8.19 → 8.34 |

Across the ten low-profile poses, height and turned shown changes are at most 1.9% and 82.5% of the
baseline, respectively. The largest draw-time increase is 15.3%; the smallest real edge-contrast
gain is 0.8%.

### Mid (423×317 picture, 252×196 model input)

| Input     | Height                | Color         | Shown         | Turned        |
| --------- | --------------------- | ------------- | ------------- | ------------- |
| still     | 0.0009551 → 0.0000006 | 0.553 → 0.451 | 0.725 → 0.613 | 0.758 → 0.594 |
| turn      | 0.0012671 → 0.0000001 | 0.549 → 0.453 | 0.748 → 0.614 | 0.982 → 0.604 |
| wave      | 0.0006482 → 0.0000028 | 0.569 → 0.461 | 0.697 → 0.620 | 0.788 → 0.620 |
| low-light | 0.0142489 → 0.0014085 | 1.684 → 0.937 | 1.754 → 1.139 | 1.886 → 1.181 |

| Input     | Raw sharpness | Real edge contrast | Flat noise    | Grain         | Draw, ms      |
| --------- | ------------- | ------------------ | ------------- | ------------- | ------------- |
| still     | 0.823 → 0.832 | 1.097 → 1.111      | 1.125 → 1.266 | 0.000 → 0.000 | 15.89 → 15.95 |
| turn      | 0.816 → 0.829 | 1.112 → 1.122      | 1.089 → 1.138 | 0.000 → 0.000 | 16.54 → 16.18 |
| wave      | 0.697 → 0.711 | 1.069 → 1.081      | 0.995 → 1.052 | 0.000 → 0.000 | 15.97 → 15.66 |
| low-light | 0.495 → 0.477 | 1.100 → 1.135      | 1.887 → 1.657 | 0.000 → 0.000 | 17.48 → 17.28 |

Across the ten mid-profile poses, height and turned shown changes are at most 9.9% and 91.5% of the
baseline, respectively. The largest draw-time increase is 0.9%; the smallest real edge-contrast gain
is 0.8%.

### High (432×324 picture, 252×196 model input)

| Input     | Height                | Color         | Shown         | Turned        |
| --------- | --------------------- | ------------- | ------------- | ------------- |
| still     | 0.0008204 → 0.0000006 | 0.553 → 0.458 | 0.693 → 0.613 | 0.760 → 0.592 |
| turn      | 0.0011325 → 0.0000000 | 0.548 → 0.457 | 0.742 → 0.600 | 0.948 → 0.602 |
| wave      | 0.0005907 → 0.0000001 | 0.564 → 0.462 | 0.686 → 0.611 | 0.771 → 0.615 |
| low-light | 0.0124856 → 0.0010366 | 1.683 → 0.939 | 1.747 → 1.124 | 1.849 → 1.154 |

| Input     | Raw sharpness | Real edge contrast | Flat noise    | Grain         | Draw, ms      |
| --------- | ------------- | ------------------ | ------------- | ------------- | ------------- |
| still     | 0.822 → 0.832 | 1.093 → 1.103      | 1.193 → 1.269 | 0.000 → 0.000 | 16.38 → 16.20 |
| turn      | 0.814 → 0.828 | 1.107 → 1.117      | 1.063 → 1.136 | 0.000 → 0.000 | 15.92 → 16.21 |
| wave      | 0.696 → 0.711 | 1.066 → 1.079      | 1.008 → 1.056 | 0.000 → 0.000 | 16.17 → 16.70 |
| low-light | 0.490 → 0.472 | 1.087 → 1.123      | 1.907 → 1.619 | 0.000 → 0.000 | 17.22 → 18.17 |

Across the ten high-profile poses, height and turned shown changes are at most 8.3% and 89.1% of the
baseline, respectively. The largest draw-time increase is 6.6%; the smallest real edge-contrast gain
is 0.8%.

## Actual live timing

These separate eight-second measurements use the actual free-running fake camera, actual inference,
and the final draw path on the still clip. Frame-to-relief is the median from sampling a frame to
the first canvas draw using its answer. It includes inference, delivery, filtering, and scheduling;
it excludes camera exposure and physical display presentation. CPU replay timings above cannot
establish this latency.

| Profile | Frame-to-relief, ms | Live draw, ms | Answer work, ms |
| ------- | ------------------- | ------------- | --------------- |
| low     | 504 → 358           | 116 → 104     | 48 → 23         |
| mid     | 1234 → 843          | 257 → 186     | 80 → 51         |
| high    | 987 → 866           | 202 → 191     | 66 → 57         |

An additional actual mid-profile low-light run reduced frame-to-relief time from 897.5 to 831.1 ms
and the original isolated twenty-draw mean from 28.70 to 26.00 ms. Its live draw median increased
from 182.9 to 193.1 ms, and frame interval increased from 199.4 to 208.8 ms. This does not establish
a gain in every timing measure; software rendering and inference compete for the same CPU.

## Regression bounds

Three independent free-running camera runs and subsequent verification runs calibrated the new
absolute limits. An initial still-height limit of 0.00004 passed twice and failed once at 0.0003501.
The full suite then caught a low-light value of 0.0110578 above the proposed 0.0105 bound. The
initial sample did not cover the variation across later sampled answers. The final bounds cover the
observed range, with 57% headroom for still height and 22% for low-light height. The deterministic
paired test adds much tighter limits at an exact pose, so the live camera's sampling variation does
not conceal a regression. The relief source did not change during this calibration.

| Free-running check     | Measured range        | Old bound | Final bound |
| ---------------------- | --------------------- | --------- | ----------- |
| still height           | 0.00000264–0.00035014 | 0.0015    | 0.00055     |
| still shown change     | 0.713–0.854           | 1.3       | 0.95        |
| low-light height       | 0.00580–0.01106       | 0.016     | 0.0135      |
| low-light shown change | 1.549–1.831           | 3.0       | 2.2         |

The mid-profile paired test requires still height below 0.00001 and low-light height below 0.002, at
least an 80% height reduction from the baseline, at least a 15% reduction in turned shown change, at
least 99% of the baseline's real edge contrast, and draw time below 110% of the baseline. It also
checks identical input and model hashes, picture grids, edge-pixel counts, and no browser errors.
The whole-camera tests still call the real worker without transport replay.

The former absolute 90 ms draw ceiling would have allowed the original 31.8→38.8 ms regression. It
also failed on unchanged final source when the free-running low-light measurement reached 97.18 ms,
with passing height and shown changes. Final-source measurements using that live protocol ranged
from 26.00 to 97.18 ms. Performance is now guarded by the matched-input 110% check, which would
reject a 22% regression. Live timings remain reported separately and are not treated as a portable
wall-clock budget.

## What changed

- Align positive depth scale and shift on color-stable cells, reject large residuals, retain stable
  references, and keep the normalization range until a whole-scene cut. The scene-cut decision uses
  the answer's own colors, even if the camera has stopped moving before that answer arrives.
- Hold quiet depth exactly; require three consecutive same-side votes for a large color-quiet edge
  flip. Moving colors release the hold. Suppress noise before smoothing and edge detection, then
  preserve held cells after cleanup.
- Guide changed pixels with the current image and the request's own color/depth pairs. Interpolate
  inside one surface at discontinuities. Preserve previously observed wall detail and cap every
  background splat across its entire footprint.
- Restore the original 28-level sharpening cap. After color noise has averaged out, a two-level
  coring threshold and amount 1.35 preserve weak eye and mouth edges. Other callers keep the
  original settings. The faster packed RGB implementation has identical default output pixels.
- Compute the capped color weight once per draw, reuse color and height buffers, and cache the fixed
  fine-to-coarse mapping. A separable minimum covers the same 3×3 background footprint with two
  three-cell passes. Encode each background cell once before expanding it to the texture. Depth caps
  are still recomputed every frame.
- Reject mismatched, old, malformed, resized, cropped, or closed-session replies. Keep one inference
  in flight, skip duplicate presented video frames, apply an answer before capturing the next frame,
  and clear the request, reference, color, and height-image buffers on close.

## What did not help

The 12-level sharpening cap weakened detail and was removed. Treating isolated sensor noise as
instant motion raised shown jitter in the earlier trial; spatial coherence is required. Starting the
next inference inside the answer handler delayed the current answer's first draw; capture stays
after drawing.

The initial controlled draw experiment mixed GPU work and cold filtering with the CPU measurement.
Identical source produced widely different times. The final protocol drains rendering, warms the
filter, and reports repeated batches. Measurements run without tests, formatting, or GIF encoding
beside them. The low/high warm-up and clip recorder now explicitly await twelve accepted answers
before measuring or recording.

## Final-source verification

- The final relief source has SHA-256
  `2115a20815fd31979db1f53453cb477521c7dd5fd690f8204bb217bb7bd870e1`. All three after-matrix
  variants and all four after-clip recordings match it.
- All 91 existing checks in `live`, `live-engine`, `live3`, `live5`, `lv7`, `lv7-engine`,
  `lv8-dial`, `hh3-level1`, and `man4` passed on that source. The combined 101-test run finished in
  26.4 minutes with 100 passes and the low-light height-bound failure described above.
- All ten task checks passed across the subsequent final-source runs. The twelve-check rerun passed
  nine task checks, including the strict paired assertions, and both existing background-layer and
  embed-transfer checks. Its only failure was the old absolute draw ceiling; the affected low-light
  test then passed with the final performance guard. The report preserves both failures and their
  measured values. No production source changed between these runs.
- The strict paired rerun reproduced the image and depth scores exactly: still height 0.000000583,
  low-light height 0.00140849; edge contrast 1.11149/1.13535. Its filtering medians were 18.17→18.09
  ms for still and 22.17→19.54 ms for low light. Seven task tests use synthetic maps or a mocked
  worker; two use actual inference with a free-running fake camera; the paired test records actual
  inference and replays only its transport.
- The final free-running low-light test measured height 0.00580242 and shown change 1.83016, under
  0.0135 and 2.2, respectively. Final-source still samples ranged from 0.00000264 to 0.00035014,
  under 0.00055.
- The existing background-layer and embed-transfer checks passed; the embedded Bee transferred 9.1
  MB against a 30 MB limit.
- `node tools/check-packs.mjs live`: Splat mirror passed with 172,499 finite splats in 301 ms. The
  unchanged Moving photo to 3D recipe took 3,656 ms against 1,500 ms, so the full pack command still
  fails for the [existing build-time issue](../handoff/LiveR7.md#known-issues).
- `npx prettier --check .`, `node tools/us-english.mjs --diff`, and the staged whitespace check
  passed. Test-written standard screenshots were restored.

## Review clips and reproduction

All eight 390×844 GIFs were rerendered after the final source change, at 1× pixel density for the
exact exported dimensions. The helper snapshots the relief module and records its SHA-256; it waits
for twelve real depth answers, captures real-time face-on and turned footage, and preserves
screencast timestamps. The existing FFmpeg build tool compacts the palette and repeated page chrome
and removes the first two seconds of cached startup frames. The remaining footage keeps its
dimensions and timing. The still input also has a 1440×900 workspace capture.

| Input     | Before                                                      | Final after                                                |
| --------- | ----------------------------------------------------------- | ---------------------------------------------------------- |
| still     | [GIF](splat-mirror-r2-2026-10/before-still-390x844.gif)     | [GIF](splat-mirror-r2-2026-10/after-still-390x844.gif)     |
| turn      | [GIF](splat-mirror-r2-2026-10/before-turn-390x844.gif)      | [GIF](splat-mirror-r2-2026-10/after-turn-390x844.gif)      |
| wave      | [GIF](splat-mirror-r2-2026-10/before-wave-390x844.gif)      | [GIF](splat-mirror-r2-2026-10/after-wave-390x844.gif)      |
| low-light | [GIF](splat-mirror-r2-2026-10/before-low-light-390x844.gif) | [GIF](splat-mirror-r2-2026-10/after-low-light-390x844.gif) |

```sh
python3 -m http.server 4173 --bind 127.0.0.1
# Another terminal; DISPLAY and llvmpipe need an existing virtual display.
export DISPLAY=:99 SPLASHERY_GL=llvmpipe SPLASHERY_CHROMIUM=/usr/bin/chromium
node tools/cdx-mir-paired.mjs .cache/cdx-mir-review-matrix --no-review
node tools/cdx-mir-clips.mjs .cache/cdx-mir before ec4aaa37
node tools/cdx-mir-clips.mjs .cache/cdx-mir after
node tools/cdx-mir-optimize.mjs .cache/cdx-mir
```

`--resume` reuses only variants whose source, model, and input-pose hashes still match. Cached
replies contain generated input only. The replay comparison does not mock model values or establish
real motion latency.

## Remaining limits

Every one of the 30 held poses has less height and turned shown jitter, and at least 0.8% more real
edge contrast. Filtering is not uniformly faster: the largest per-pose increases are 15.3% at low
resolution and 6.6% at high resolution. Mid-profile low-light filtering falls from 17.48 to 17.28
ms, while high-profile low-light filtering rises from 17.22 to 18.17 ms. These residual costs are
retained in the tables.

The stronger weak-edge sharpening raises normal-light flat noise by about 0.05–0.15 luminance
levels. Low-light flat noise falls by about 0.23–0.29 levels at mid and high resolution. Its raw
sharpness score falls because that score also counts noise; its clean-edge contrast increases. The
tests guard real feature contrast separately.

Fast motion beyond the local color-guided neighborhood, or foreground colors matching the wall,
still needs a fresh depth answer. Fixed normalization can clip newly encountered depths until a
scene cut resets the range. A single view cannot reconstruct unseen geometry. Noise remains in low
light. Phone hardware, real sensors, exposure changes, and physical presentation latency remain
unmeasured.

Rule check: none. Production camera input still starts only after a tap and stays in volatile memory
on the device. The worker, camera permission, stream, and recorder files are unchanged; review
recordings use original generated input only.

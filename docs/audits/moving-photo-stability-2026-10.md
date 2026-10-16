# Moving photo to 3D stability

October 10, 2026 (measurements began October 9). Codex (GPT-6) built this change for
[task 32](../codex/32-moving-photo-stability.md), following the owner's
[walkthrough triage](../reviews/2026-10-09-walkthrough/triage.md). Baseline: commit `8a53aa5c`.

## Measurements

The browser loads the actual sample sheets, packed model depths, and sound through `loadSample`.
These measurements describe the depth supplied to the renderer, rather than screenshots of the Sharp
view. They include every consecutive pair, excluding the end-to-start loop. A still pixel has an RGB
root mean square change of at most eight byte levels. Height jitter is the mean absolute normalized
height change over those pixels. Edge flips are jumps greater than 0.15 of the relief per 1,000
still pixels; this is a measurable jump proxy, not a count of internal hysteresis decisions. The
global share is the fraction of squared depth-change energy removed by a least-squares scale and
shift fit over the whole picture, summed across frame pairs.

Before and after use the same color frames, masks, resolutions, frame counts, durations, and
quantization. The mid tier has 480-pixel-wide video samples and the horse's own 300 by 200 pixels.
Videos retain 96 frames at 16 frames per second; the horse retains 15 at 10 frames per second.
Opening time is the median of three uncached clip constructions in one browser, including sheet
decoding, processing, and sound setup. The first run warms HTTP and decoding paths; these are local
Chromium CPU measurements, not phone benchmarks or total application startup time.

| Sample                   | Height jitter before → after | Reduction | Flips/1,000 before → after | Reduction | Global share before → after | Open ms before → after |
| ------------------------ | ---------------------------- | --------- | -------------------------- | --------- | --------------------------- | ---------------------- |
| Big Buck Bunny           | 0.010713 → 0.005159          | 51.8%     | 13.70 → 5.04               | 63.2%     | 16.3% → 1.6%                | 1984 → 1751            |
| Galloping horse          | 0.299101 → 0.092114          | 69.2%     | 562.49 → 188.59            | 66.5%     | 90.1% → 70.0%               | 126 → 113              |
| Sintel and the dragon    | 0.112702 → 0.011705          | 89.6%     | 217.81 → 6.11              | 97.2%     | 80.0% → 78.1%               | 1313 → 1211            |
| The bridge and the robot | 0.045394 → 0.014792          | 67.4%     | 19.45 → 3.11               | 84.0%     | 64.8% → 9.8%                | 1382 → 1326            |
| Inside the machine       | 0.062825 → 0.012685          | 79.8%     | 85.89 → 16.33              | 81.0%     | 57.6% → 81.7%               | 1796 → 1732            |

Every sample exceeds the goal of halving jitter and flips. In the final idle benchmark, all five
mid-tier opening times decrease (by 3.5–11.8%), within the 15% limit. The global share can rise
while jitter falls: it is a fraction of the remaining energy, and has moving pixels in its
denominator. It is not a separate success threshold. In particular, the machine's remaining change
is more globally correlated even though its still-pixel jitter falls about 80%.

The bunny's first three packed raw maps confirm the brief's maximum values: 3.616852, 3.093996, and
2.623651. The 42–71% breathing example was a preliminary observation, not this metric. The measured
global shares span 16–90% before processing changes. Code inspection confirms that normalization
previously averaged independently sorted frame ranges over only five frames, applied `reliefScale`
independently for opened clips, linearly interpolated sparse answers, and snapped each frame
independently. Long videos eased ranges by 0.3 and also interpolated linearly.

### Maximum resolution

The same comparison at max uses the original 640-pixel-wide sheets (and the unchanged horse). These
runs shared the container with browser regression tests, so their opening times are not used for the
performance conclusion.

| Sample                   | Height jitter before → after | Reduction | Flips/1,000 before → after | Reduction |
| ------------------------ | ---------------------------- | --------- | -------------------------- | --------- |
| Big Buck Bunny           | 0.010672 → 0.005216          | 51.1%     | 13.49 → 4.98               | 63.1%     |
| Galloping horse          | 0.299101 → 0.092114          | 69.2%     | 562.49 → 188.59            | 66.5%     |
| Sintel and the dragon    | 0.112763 → 0.011657          | 89.7%     | 217.98 → 6.04              | 97.2%     |
| The bridge and the robot | 0.045128 → 0.014598          | 67.7%     | 18.96 → 2.80               | 85.2%     |
| Inside the machine       | 0.062844 → 0.012776          | 79.7%     | 85.99 → 16.50              | 80.8%     |

Reproduce with the repository HTTP server running:

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/cdx-stability-measure.mjs --baseline=8a53aa5c --out=.cache/cdx/before.json
SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/cdx-stability-measure.mjs --out=.cache/cdx/after.json
# Add --profile=max to both commands for the maximum-resolution comparison.
```

`--baseline` serves the old moving-photo module through a browser route, without changing the
checkout. The helper and measurement script need no model download for samples. Inputs and results
remain on the device.

## Changes and reasoning

- Align each raw depth map to the previous aligned map with least squares on still-color pixels.
  Reject fits with too few still pixels, negative or poor correlation, or only one uniform region;
  bound the fitted scale to 0.25–4. Two uniform regions use only their mean shift. This removes
  affine model drift while allowing scene cuts and clearly moving regions to change.
- Normalize the whole aligned clip with one sampled 2nd–98th percentile range and one relief scale.
  A deterministic sample of about 2,048 values per frame avoids sorting every full model map. Opened
  clips keep their existing flat-picture relief policy.
- Filter over three frames in each direction on the model grid, weighted by color similarity,
  temporal distance, and depth continuity. This uses future frames at opening time, rejects moving
  surfaces, and avoids causal playback delay. It does not change the output grid or model input
  size.
- Align sparse model answers before four-answer cubic interpolation. Tangents use actual frame
  times, including unequal answer gaps and GIF delays; equal gaps give Catmull-Rom weights. Bound
  overshoot to the interval's endpoints. Guide opened frames with their own extracted colors through
  the existing `guidedDepth`, applying the same spatial filter to worked-out and interpolated
  frames.
- Snap edges after filtering, selecting near or far by color when it distinguishes the sides. A
  still edge needs three consecutive contrary proposals to change side; a changed color responds
  immediately. Two separable extrema passes replace the old 25-cell neighborhood scan, paying for
  the added temporal work. Reuse extrema scratch arrays, and use native numeric sorting for the
  pooled range.
- Long videos align each answer with the previous answer, seed their range and relief scale from the
  first four answers, then widen the range by only 1% of an outward change per answer. Still-pixel
  noise blends by 0.12, while movement or large changes respond immediately. Edge hysteresis runs in
  answer order. The splat path uses four-answer cubic interpolation on a reusable model-grid buffer
  before resizing.

All tier constants, extraction frame rates, sample frame rates, image sizes, model-answer budgets,
and playback clocks remain unchanged. Short-clip playback gains no per-draw filtering. Long-video
state keeps only the previous aligned map, filtered map, colors, edge sides, counters, and
interpolation scratch beyond the existing depth-byte cache; it does not grow with duration. The
existing byte-cache budget remains unchanged, with a small fixed working-memory overhead on the
depth grid.

## Experiments that did not help

The first implementation filtered at full output resolution. It reduced bunny jitter from 0.010713
to 0.004987 but increased opening time from about 1.85 seconds to 3.01 seconds; other samples also
exceeded the time limit. Moving the same symmetric filter to the model grid kept the full output
resolution and met the measured time target.

A synthetic sparse-answer test caught a second problem: guiding only interpolated frames while
bilinearly enlarging worked-out frames made a perfectly still affine clip jitter by 0.0174. Using
the same guided enlargement on both kinds of opened frames fixed that alternating spatial response.
Sample maps explicitly retain their fast bilinear enlargement; passing colors to the public
normalization helper still enables guided enlargement by default.

## Verification and limits

The new stability spec covers random affine drift and noise, preserved relief contrast, scene cuts,
uniform-map safety, motion response, time-reversal symmetry, consecutive edge holds, cubic endpoints
and tangents with unequal answer gaps, constant-speed ramps with unequal GIF delays, sparse-answer
budget and guidance, one clip-wide relief scale, input immutability, bounded streaming state, and
the browser bunny's measured thresholds.

The requested browser regression command passed all 85 collected cases in 29.6 minutes:

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test tests/cdx-stability.spec.mjs tests/smd-moving.spec.mjs tests/live3.spec.mjs tests/lv7-long.spec.mjs tests/psv*.spec.mjs tests/phf*.spec.mjs
```

That run included the first seven new stability cases and 78 existing cases. After adding three more
synthetic cases and the final timing and allocation fixes, the final stability and long-video specs
were rerun. Across these runs, all 88 distinct requested cases passed. The whole repository's 202
spec files were not rerun; this draft's validation is the task's named regression set.

`npx prettier --check .`, `node tools/us-english.mjs --diff`, and `git diff --check` passed. The
generic `node tools/check-packs.mjs moving-photo-3d` check reports finite splats but fails its
1.5-second construction cap on both the baseline (4,543 ms) and this branch (5,347 ms), each with
208,806 splats; it is not a passing check. This Node-only check has a different build path from the
measured browser sample opening.

A three-second phone-size review GIF and a six-frame contact strip were generated and inspected
locally under `.cache/cdx/`, labeled Codex (GPT-6). They are not added to the repository because the
task permits exactly five files. No assets, thumbnails, or protected Sharp-lane files changed.

## Remaining Sharp view work

The Sharp view consumes the stabilized short-clip depth bytes, so it benefits from alignment,
filtering, and edge holds. Its exact depth-to-video-frame timing and shader interpolation remain the
Photo depth lane's work. A full-resolution video texture may show a frame between the extracted
depth frames; this change does not make the depth inference match that exact texture timestamp.

Long-video answers are color-guided at inference time, and the splat path gets cubic depth
interpolation. There is no new full-picture color readback or per-draw guided filter in the Fine
view; those would add rendering work. The Sharp lane has its own long-depth sampling path in
`photo-sharp.js`, so its interpolation must be updated there by that lane. Neither `photo-sharp.js`
nor `relief-mesh.js` was edited.

The still-color mask can mistake a surface moving with nearly identical colors for a still region.
Alignment uses the previous aligned frame and can accumulate error over very long clips. The 50%
sample goal is verified on precomputed short clips; it is not a quantitative guarantee for arbitrary
uploads or hour-long videos. Real devices, rendered-frame throughput, and subjective side-view
quality still need owner review.

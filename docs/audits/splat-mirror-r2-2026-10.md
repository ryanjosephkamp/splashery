# Splat mirror r2

October 12, 2026. Codex (GPT-6) built this on `codex/splat-mirror-r2`, from `ec4aaa37`. Code is
offered under Splashery's MIT license. No production assets or dependencies were added.

## Method

The four inputs are procedural, unidentifiable mannequins derived from
[`tools/lv7-mannequin.mjs`](../../tools/lv7-mannequin.mjs): a still pose, a slow head turn, a solid
dummy hand crossing the face, and the still pose at 22% brightness with more sensor noise. They use
a deterministic seed of 12345, 320×240 pixels, 15 frames per second, and 120 frames. Nothing came
from a real camera. Generated test images are CC0.

[`tools/cdx-mir-camera.mjs`](../../tools/cdx-mir-camera.mjs) makes the clips;
[`tools/cdx-mir-measure.mjs`](../../tools/cdx-mir-measure.mjs) uses Chromium's fake-camera device,
the actual page, and the unchanged shipped depth worker. It reuses Live r7's measuring functions.
Each run warms up for 12 accepted depth answers, measures eight seconds of frame work, and then
samples six answers face-on and turned. The viewport is 390×844 at 2× pixel density, with the mid
profile and adaptation off. Both runs use Mesa through ANGLE in a virtual display. The earlier
SwiftShader pilot is excluded from these tables. A final wave run that overlapped the CPU-heavy
formatting check is also excluded; the wave was measured again by itself.

Environment: managed Linux container, Chromium 151.0.7922.173, Node 24.19.0, and Playwright 1.56.1.
These are software-rendered browser measurements, not measurements on a physical phone. The camera,
model input, and drawn picture keep their resolutions. The picture is 423×317 in every run. The
internal filter grid now matches the model's detail instead of oversampling it.

## Before and after

Each cell is **before → after**. Height is a fraction of the relief. Color and shown changes are
mean RGB levels out of 255. Sharpness is Live r7's ratio to the camera image; grain is its excess
fine-detail estimate. Draw is the 20-frame isolated canvas-work average in milliseconds.

| Clip      | Face height change | Color change  | Shown change  | Turned change | Sharpness     | Grain       | Draw, ms    |
| --------- | ------------------ | ------------- | ------------- | ------------- | ------------- | ----------- | ----------- |
| still     | 0.00453 → 0.00029  | 1.05 → 0.94   | 1.20 → 0.87   | 1.58 → 0.85   | 0.813 → 0.783 | 0.00 → 0.00 | 42.6 → 30.8 |
| turn      | 0.02669 → 0.03100  | 35.95 → 32.35 | 40.51 → 25.46 | 27.92 → 34.61 | 0.803 → 0.755 | 0.00 → 0.00 | 39.6 → 40.1 |
| wave      | 0.09535 → 0.08209  | 13.45 → 14.63 | 21.11 → 13.78 | 14.19 → 28.41 | 1.415 → 0.789 | 0.96 → 0.00 | 37.0 → 35.5 |
| low-light | 0.02850 → 0.01152  | 2.76 → 2.17   | 2.46 → 1.78   | 2.53 → 1.87   | 0.458 → 0.403 | 0.00 → 0.00 | 31.8 → 38.8 |

For moving clips, those columns include real movement and are **not stillness scores**. The camera
keeps running during screenshots; their poses are not matched between runs. In particular, a faster
hand response can increase the face's change. The sharpness and grain comparisons on moving clips
also depend on which pose the camera has when its reference image is taken.

| Clip      | Frame-to-relief, ms | Answer work, ms | Live draw, ms | Frame interval, ms | Height/frame in unchanged colors |
| --------- | ------------------- | --------------- | ------------- | ------------------ | -------------------------------- |
| still     | 2278 → 1003         | 214 → 64        | 423 → 211     | 512 → 239          | 0.0003086 → 0.0000007            |
| turn      | 1320 → 966          | 85 → 57         | 284 → 213     | 315 → 252          | 0.0007214 → 0.0004177            |
| wave      | 1508 → 892          | 116 → 112       | 363 → 204     | 400 → 229          | 0.0204856 → 0.0127838            |
| low-light | 1365 → 934          | 150 → 61        | 331 → 196     | 422 → 232          | 0.0017306 → 0.0000571            |

Frame-to-relief is the median from the main thread sampling a camera frame to the first canvas draw
using its depth. It includes inference, message delivery, filtering, and waiting for a draw. It does
not include camera exposure or certify when a physical display presents the GPU frame. Answer and
live-draw times include readback and browser scheduling; the isolated Draw column above measures a
different workload. Unchanged colors means a summed RGB difference below 12 between consecutive
drawn frames. A same-colored moving surface can still fall in that mask.

## What changed

- Fit each depth answer's positive scale and shift on unchanged colors, reject large residuals,
  retain the aligned reference in still regions, and keep one normalization range. A scene cut
  without reliable correspondence can start a new range.
- Hold still depths exactly rather than easing a little noise into them forever. Coherent local
  color changes release the hold immediately. A large color-quiet edge change needs three
  consecutive answers on the same side; alternating guesses never accumulate votes. Apply the hold
  before smoothing, and preserve its cleaned result afterward.
- Use each request's own crop and colors for depth filtering and wall learning. During drawing,
  guide changed pixels with the newest picture and the remembered color/depth pairs. Interpolate
  within a chosen surface, preserve a sharp depth discontinuity, and limit sharpening halos.
- Keep previously seen wall detail through occlusion. Clamp a background splat to the lowest visible
  depth across its footprint, so a remembered wall cannot poke through a lower current wall.
  Never-seen wall detail still comes from the existing surrounding-wall fill.
- Track request IDs, dimensions, crop, and age; reject old, malformed, or closed-session answers.
  Keep one inference in flight, skip duplicate presented video frames, reuse the capture canvas, and
  capture the newest frame after drawing. A delivery older than the greater of 1.5 seconds or three
  inference durations is discarded. The worker, camera permissions, streams, and recorder files are
  unchanged. The request, reference, and color buffers are cleared, and the frame callback is
  canceled when the view closes.

## What did not help, and limitations

The first fast path treated isolated sensor noise as movement. It raised the still face's shown
change to 1.45 levels; requiring coherent spatial change brought that down. Starting the next
inference inside the answer handler also did not help: camera readback delayed displaying the
answer, and the still-run median latency rose to 2.93 seconds. The final code draws first.

Exact holds are verified on synthetic still maps through scale, shift, and noise. A noisy fake
camera still has residual color changes and persistent edge guesses, especially in low light; the
whole camera picture is not claimed to be perfectly motionless. Fast motion farther than the local
color-guided neighborhood, or foreground colors matching the wall, still needs a fresh model answer.
The fixed range can clip newly encountered depths until a scene cut resets it. The single camera
cannot recover unseen geometry. Physical-phone latency, real camera sensors, and exposure changes
are unmeasured.

## Review clips and reproduction

[`tools/cdx-mir-clips.mjs`](../../tools/cdx-mir-clips.mjs) captures real-time 390×844 GIFs with the
fake camera, first face-on, then turned. It preserves screencast timestamps rather than stepping the
toy faster than the browser. It also captures the still clip at 1440×900. Baseline clips load the
relief module from the immutable starting commit; all other files use the same checkout.
[`tools/cdx-mir-optimize.mjs`](../../tools/cdx-mir-optimize.mjs) uses the existing FFmpeg build tool
(7.1.5 here) to compact the GIF palette and repeated page chrome. It removes the first two seconds,
which can contain Chromium's cached opening-page frame; the remaining frames retain their dimensions
and timing. Each GIF is 390×844 and lasts 6.4 to 7.0 seconds.

The owner approved adding these eight test recordings using CC0 input beside this report. A badge
names the input, baseline or revised code, and Codex GPT-6.

| Input     | Before                                                      | After                                                      |
| --------- | ----------------------------------------------------------- | ---------------------------------------------------------- |
| still     | [GIF](splat-mirror-r2-2026-10/before-still-390x844.gif)     | [GIF](splat-mirror-r2-2026-10/after-still-390x844.gif)     |
| turn      | [GIF](splat-mirror-r2-2026-10/before-turn-390x844.gif)      | [GIF](splat-mirror-r2-2026-10/after-turn-390x844.gif)      |
| wave      | [GIF](splat-mirror-r2-2026-10/before-wave-390x844.gif)      | [GIF](splat-mirror-r2-2026-10/after-wave-390x844.gif)      |
| low-light | [GIF](splat-mirror-r2-2026-10/before-low-light-390x844.gif) | [GIF](splat-mirror-r2-2026-10/after-low-light-390x844.gif) |

```sh
python3 -m http.server 4173 --bind 127.0.0.1
# In another terminal; omit DISPLAY and SPLASHERY_GL for headless SwiftShader.
export DISPLAY=:99 SPLASHERY_GL=llvmpipe SPLASHERY_CHROMIUM=/usr/bin/chromium
node tools/cdx-mir-camera.mjs .cache/cdx-mir
node tools/cdx-mir-measure.mjs .cache/cdx-mir before ec4aaa37
node tools/cdx-mir-measure.mjs .cache/cdx-mir after
node tools/cdx-mir-clips.mjs .cache/cdx-mir before ec4aaa37
node tools/cdx-mir-clips.mjs .cache/cdx-mir after
node tools/cdx-mir-optimize.mjs .cache/cdx-mir
```

Outputs use `.cache/cdx-mir/{before,after}-{still,turn,wave,low-light}-390x844.gif`, with PNGs and
measurement JSON alongside them. The committed GIFs are review artifacts; the page never records
production camera input. The measurement tool can load a baseline revision without changing the
checkout, and snapshots the module once for every clip in a run.

## Verification

The required nine test files plus `tests/cdx-mir.spec.mjs` passed: **99 tests in 25.1 minutes**. The
full run covers live input, the live engine, camera permission and shutdown, recording, depth
controls, the relief renderer, existing mirror drift limits, and the manual. The eight new tests
cover scale/shift alignment, exact still holds, same-side edge votes, guided upsampling, wall
occlusion, stale requests, and two actual-worker fake-camera measurements. Six use synthetic maps or
a mocked worker; the still and low-light browser tests use the shipped depth model with shorter,
20-frame copies of the generated inputs.

Self-review added a scene-cut regression: a completely changed camera frame that stops moving before
inference returns must reset its range. It failed with the old range and passed after the reset used
the request's own colors. The final eight new tests and three existing camera paths passed again:
**11 tests in 4.6 minutes**. The final actual-worker runs measured still height change at 0.00000474
and low-light height change at 0.00806, within the new thresholds of 0.0015 and 0.016. The full
99-test run and GIF captures preceded this final scene-cut correction; its camera paths and wave
measurement were rechecked rather than rerunning the entire manual and audio suite. The scene-cut
condition does not change the other inputs, whose picture changes stay below its majority threshold.

Two additional checks passed: the back plate stays behind and beside the foreground, and the
embedded Bee transfers **9.1 MB**, below the 30 MB limit. Splat mirror's high-tier pack build
passed: 172,499 finite splats, 323 ms in the full live-pack check. That full check reports the
unrelated Moving photo to 3D build at 3,950 ms, above its 1,500 ms threshold. Its recipe is
unchanged; this failure is also documented in
[Live r7's handoff](../handoff/LiveR7.md#known-issues).

```sh
DISPLAY=:99 SPLASHERY_GL=llvmpipe SPLASHERY_CHROMIUM=/usr/bin/chromium \
  npx playwright test tests/cdx-mir.spec.mjs tests/live.spec.mjs \
  tests/live-engine.spec.mjs tests/live3.spec.mjs tests/live5.spec.mjs \
  tests/lv7.spec.mjs tests/lv7-engine.spec.mjs tests/lv8-dial.spec.mjs \
  tests/hh3-level1.spec.mjs tests/man4.spec.mjs
```

Phone and desktop captures and the phone GIF sequences were reviewed. All four inputs drew at the
same 423×317 picture grid, with no browser page errors in the before-and-after measurements.
`npx prettier --check .`, `node tools/us-english.mjs --diff`, and the staged whitespace check
passed.

Rule check: none. The production camera still starts only on a tap, and its frames remain in
volatile memory on the device. Test recordings use generated input only.

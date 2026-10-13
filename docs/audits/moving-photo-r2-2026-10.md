# Moving photo to 3D, round 2

October 12, 2026. Codex (GPT-6) built task 38. This branch carries task 32’s stabilizer and replaces
draft PR #479.

## Results and limits

Sample switching paints the selected clip’s own pixels in the first Sharp update, including
MP3-backed films and loading or seeking video. Paused pictures stay in Sharp view while the camera
or decoder updates. Speaker changes reach playing and paused tracks, including a track first opened
while sound was off. After review, Track follows UI gestures and a bounded check without changing
Sound methods. Uploads open after one first-picture depth answer; the rest of the video is read in
the background, followed by refinement of all retained depth frames and larger answers on stronger
tiers. The video picture retains its native resolution and playback rate; geometry is still sampled
at the existing 12/15/24 fps device budget.

The latest machine upload has less measured height jitter than its prepared sample. The upload gap
is still not uniformly closed: the machine has more surface cuts, and the Tears of Steel upload
exposes more backing. The numerical data below and phone clips make that remaining gap reviewable.
These are relative-depth and renderer measurements, not depth ground truth or phone hardware
performance benchmarks.

## Review follow-up

The
[Operator’s follow-up](https://github.com/ryanjosephkamp/splashery/pull/560#issuecomment-6130226869)
confirms retaining the existing bridge sample and the four longer films. The evidence branch stays
unmerged and is not loaded by the site.

The flow under test is: Moving photo → open a clip → see the first Sharp relief → continue playback,
refinement, and audio loops. Separate real-song flows exercise Chladni 3D and the Studio song.

A first-picture estimate is useful immediately, without reading the whole movie first. The old
picture is held while that estimate loads, leaving CPU time for the worker. The new relief is drawn
on the current Sharp stage before the regular hidden-splat rebuild; its first completed render has a
recorded timestamp. Video extraction and all later inference run after this preview. Background
extraction seeks to exact retained source times. Reading can take longer on a phone with a long
key-frame interval, but no longer delays the preview or changes native playback. The time-zero
picture remains paired with its cached depth answer. The auxiliary sample video also pauses while
opening a replacement, preventing its frame callbacks from keeping rendering busy.

Refinement compares two calibrations of the same real model answers: the range fitted to the
preceding coarse pass, and the range estimated from the complete pass. It chooses one for the entire
pass using still-region jitter plus a penalty for surface cuts, then eases the replacement. The
score samples every fourth pixel; the reported metrics use all pixels. This is a deliberate
stability heuristic, not an independent depth-accuracy benchmark. Backing counts and phone renders
provide additional checks. No constant substitute is a candidate; both preserve estimated model
structure. The range stays fixed during each pass’s playback, and the first resting mean stays
fixed.

Using only the complete-pass calibration helped the machine and bridge but regressed horse and
Sintel: horse jitter reached 0.040365 and Sintel 0.025830. The two-calibration policy avoids those
larger regressions while keeping the machine and bridge gains. Refinement takes longer because both
candidates are evaluated. Alignment, interpolation, normalization, packing, and scoring yield
between batches and check cancellation.

The remaining cut and backing gaps cannot be solved by temporal alignment alone. Sharp cuts depth
steps at the shared mesh's existing 0.05 threshold and fills exposed regions from colors already in
the frame. The clip has no observed RGB for a surface hidden behind an object. The upload's
color-guided model enlargement can also sharpen a noisy contour. Reducing all depth contrast would
reduce the cut count while removing the requested relief. Better model estimates or occlusion
completion are outside this task's owned files; the depth implementation and common mesh belong to
tasks 37 and 39. The current heuristic reduces temporal errors, but does not establish correct
geometry at every edge.

Prepared samples and uploads also retain different grid sizes and temporal sampling budgets. The
three reconstructed inputs have already undergone JPEG and video color conversion. Their metrics are
useful regressions on these fixed inputs, not interchangeable ground-truth geometry. Exact
source-time extraction in the follow-up changes the retained pictures from the initial PR's
playback-callback sampling. The new values measure that extraction change together with refinement.

The previous 0.622-second loop observation had two relevant code paths: an ended audio element
entered the silent fallback at the previous tail time, and refinement could occupy the page thread
for many frames at once. The old-code probe recorded a 1,360 ms rendered-frame gap during
refinement, though that isolated run did not reproduce the exact 0.622-second wrap. A deterministic
late-ended-audio spec reproduces the tail case and now requires frame zero immediately. The real
`psv3` suite exercises both speeds and native media; final results are recorded below.

A separate `live5` trace showed synchronized picture and audio clocks, but its nominal 1.5-second
wait occupied 2.7 seconds and crossed the three-second clip's loop. That test computes differences
without accounting for wrapping. It also failed alone with trace recording enabled and passed alone
with recording disabled. The final complete run uses one worker and `--trace=off`; assertions and
test files are unchanged. Measurements and review renders run separately from that suite.

The full browser run measured the first desktop Sharp presentation at 1,417 ms. The separate loop
probe, using the existing three-flag software renderer, measured 6,573 ms (7,475 ms to complete its
regular build), versus 27,338 ms to complete the old code's opening. This cold software setup still
misses the 3–4-second aim. A one-answer model preview removes most of the old read/inference wait,
but the renderer and build still determine when it can be painted; no real desktop GPU or phone
hardware was benchmarked.

With the same loop-probe setup, the largest rendered gap fell from 1,360 to 379 ms. The final probe
recorded 26 wraps, each observed at frame zero while refinement continued, with no refinement error.
Its largest page task was 2,743 ms, versus 2,793 ms before: the first build can still monopolize the
page, even though refinement no longer has the old full-pass rendering stall. These observations are
separate from the clean `psv3` regression result.

The pre-integration metric CLI uses the regression suite's complete Chromium launch configuration.
Native input varies with the browser graphics setup: a separate Sintel extraction probe found that
69 of 71 retained RGB frame hashes differed between plain headless Chromium and that configuration.
Plain-headless upload jitter was 0.021923, compared with 0.014680 in the regression setup; machine
jitter was 0.009842 in plain headless and 0.009238 in the regression setup. These are observations
of input and metric sensitivity, not a claim that one decoding path supplies ground-truth depth. The
hole, loop, and GIF tools retain their original three-flag SwiftShader setup for comparison with the
earlier renders. Their geometry and calibration choice can therefore differ from the metric table.
Each sample/upload comparison uses the same setup on both paths.

The original upload GIF capture did not reliably await the selected upload: an asynchronous
Playwright predicate could complete before its condition was true. The revised wrapper stores the
module first, uses a synchronous readiness predicate requiring the upload’s refinement, and records
clip identity and refinement state with every frame. The Bunny upload is replaced and a machine
upload is added to the separate gallery. Both new captures contain 48 frames with the actual custom
clip's identity, completed refinement, and zero media-element clock error. The Bunny's ear and
silhouette tears remain visible; a zero background-hole count in the central sample area does not
cover those silhouettes.

## Review measurements before task 37 integration

Low tier, one isolated browser measurement per row, using the same Chromium configuration as the
regression suite. "Open" is the model/clip return time in the isolated tool, not a completed app
render. The actual desktop presentation timings are 1,417 ms in the regression setup and 6,573 ms in
the cold three-flag renderer probe. "Final" includes the background passes. All uploaded clips
finished every retained depth frame at a 196-pixel model side; the separate mid-tier spec verifies
294-pixel refinement. No refinement errors occurred.

| Clip    | Path   | Grid / frames  | Height jitter | Flips/1,000 | Surface cuts % | Open ms | Final ms |
| ------- | ------ | -------------- | ------------- | ----------- | -------------- | ------- | -------- |
| sample  | sample | 480 × 270 / 96 | 0.005176      | 5.04        | 1.731          | 2976    | 3256     |
| sample  | upload | 327 × 184 / 72 | 0.003377      | 0.89        | 1.645          | 1092    | 39673    |
| horse   | sample | 300 × 200 / 15 | 0.092114      | 188.59      | 0.040          | 113     | 133      |
| horse   | upload | 300 × 200 / 15 | 0.009273      | 0.01        | 0.127          | 1008    | 8596     |
| dragon  | sample | 480 × 204 / 96 | 0.011707      | 6.11        | 0.169          | 1279    | 1470     |
| dragon  | upload | 376 × 160 / 71 | 0.014680      | 0.72        | 0.528          | 948     | 42342    |
| bridge  | sample | 480 × 200 / 96 | 0.014792      | 3.11        | 3.556          | 1522    | 1734     |
| bridge  | upload | 379 × 159 / 71 | 0.009060      | 1.35        | 4.582          | 1262    | 51144    |
| machine | sample | 480 × 270 / 96 | 0.012682      | 16.31       | 0.000          | 1631    | 1921     |
| machine | upload | 327 × 184 / 71 | 0.009238      | 1.65        | 0.809          | 1103    | 55042    |
| fast60  | upload | 320 × 180 / 24 | 0.007948      | 0.00        | 0.092          | 856     | 12949    |

Relative to the original PR, machine jitter falls from 0.017809 to 0.009238, below the prepared
sample's approximately 0.01268. Its surface cuts fall only from 0.878% to 0.809%; the original task
32 upload had 0.061%, so that regression remains. Bridge cuts fall from 8.525% to 4.582%. Horse's
improvement is retained. Sintel jitter and cuts are worse than the initial PR's 0.012178 and 0.323%,
though still-region jitter remains below the task 32 baseline's 0.017237 in this configuration. The
gap is not uniformly closed. The first picture's repeated depth is excluded from these final quality
claims; zero initial jitter would describe a placeholder, not a refined movie.

The controlled render protocol and original three-flag graphics setup are unchanged. All counted
central background holes remain zero. The table below compares the original PR with the review
follow-up; the historical task 32 baseline remains in the later table.

| Clip    | Path   | Background holes % | Exposed backing % original PR → review |
| ------- | ------ | ------------------ | -------------------------------------- |
| sample  | sample | 0.000              | 9.692 → 9.692                          |
| sample  | upload | 0.000              | 11.503 → 10.470                        |
| horse   | sample | 0.000              | 0.001 → 0.001                          |
| horse   | upload | 0.000              | 0.366 → 0.366                          |
| dragon  | sample | 0.000              | 0.643 → 0.643                          |
| dragon  | upload | 0.000              | 0.000 → 0.293                          |
| bridge  | sample | 0.000              | 8.939 → 8.939                          |
| bridge  | upload | 0.000              | 14.285 → 11.351                        |
| machine | sample | 0.000              | 0.000 → 0.000                          |
| machine | upload | 0.000              | 0.000 → 0.000                          |
| fast60  | upload | 0.000              | 0.000 → 0.000                          |

Bridge backing improves from 14.285% to 11.351%, but remains above the task 32 baseline's 10.226%
and prepared sample's 8.939%. Bunny backing also improves, while horse remains at 0.366%. Sintel
backing is 0.293%, up from zero in the original PR. The camera, central sampling area, and three
source times exclude silhouettes and other times; the Bunny review strip visibly retains tears
around its ears. These limits prevent a claim of full coverage or depth accuracy.

## Original task 38 measurements

Measured baseline: local `c7560ad6`, task 32 plus the main branch fetched at the start. Public
`5e5671b0` has the identical tree and can reproduce that baseline. Low tier, actual local Chromium,
actual vendored model for uploads. These tables preserve the initial PR measurements; the review
follow-up measurements supersede the original “after” values. The same input file, extraction
budget, and dimensions are used on both sides of each comparison. Source bunny video and horse GIF
are original repository files. The other three short films are lossless VP9 reconstructions of the
shipped JPEG frame sheets, not the unavailable original downloads. The 60 fps clip is a two-second
procedural fixture.

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

These are the original PR's rendered measurements. Zero unfilled background in these central
snapshots does not mean there are no visual gaps: backing can show the wrong side of an occlusion,
and fine model contours still tear at oblique views. The bridge upload’s backing exposure increases
from 10.23% to 14.28%; the horse’s from 0.017% to 0.366%. These are known limitations, not reported
as improvements.

## What changed

- Sharp uses decoded clip frames immediately, never an MP3 as a video. It reuses an opened video’s
  own copy, checks readiness and clock alignment, and handles paused seeks with a decoded canvas
  snapshot. A clip version invalidates depth after refinement.
- Track checks its speaker after UI click/key gestures and every 50 ms while routed, including while
  paused. Playing and routing also check immediately. It never replaces a Sound method. Closing a
  track removes its own listeners and timer. A standalone browser spec drives Track without the app,
  and real-song smoke specs cover Chladni 3D and the Studio song.
- A short upload uses one worker and one model session: one first-picture answer, video extraction
  in the background, the existing sparse budget, every retained frame, and then 294-pixel answers on
  mid/high/max. The previous picture is held during model startup to leave CPU time for inference.
  Sharp presents the new relief before the hidden splats rebuild. Each complete pass has one
  whole-clip normalization range, held fixed during playback; its replacement eases over 500 ms. The
  resting mean stays fixed. Each complete pass compares the coarse-fit and whole-clip calibrations;
  its selection is held for all frames. Alignment, interpolation, filtering, byte packing, and
  scoring yield between batches.
- Sparse interpolation uses actual frame delays, bounded cubic tangents, and a coarse/fine color
  search within four model cells. Still colors keep the cubic answer; moving colors can follow a
  surface instead of blending different surfaces at one coordinate.
- The refined temporal filter spans about half a second on either side and rejects changed colors;
  still-color depth outliers are smoothed instead of excluded. Playback has no causal filter delay
  because future answers are available before a pass is presented.
- An audio element that ended between rendered frames restarts at zero immediately. It no longer
  enters the silent fallback at the previous tail position before reaching the next loop.
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
[Elephants Dream](https://orange.blender.org/blog/creative-commons-license-2/) (CC BY 2.5), and
[Tears of Steel](https://archive.org/details/Tears-of-Steel) (CC BY 3.0). The original Blender
project pages initially returned HTTP 403. On review, Elephants Dream’s own page was reachable: its
film notice links CC BY 2.5 and specifies © 2006 Blender Foundation / Netherlands Media Art
Institute / www.elephantsdream.org for excerpts. Both short and long records and in-app credits now
use that attribution and license. The 3.0 US archive descriptor is superseded by the film’s notice.
The additional standalone soundtrack downloads mentioned there are not used; sound comes from the
film itself. The fast-60 fixture’s source URL is pinned to immutable commit `ad8727c0`, rather than
a branch that might disappear.

## What did not help

- Early experiments with successive fits and matching every answer to the first scene compounded
  errors; machine jitter reached 0.144. The original task 38 pass matched endpoint ranges to the
  sparse pass at the same time. Review showed that retaining those interpolated ranges and the
  four-answer normalization still distorted some dense answers. Using only a complete-pass range
  then regressed other clips. The follow-up compares both bounded calibrations per pass, reducing
  machine jitter and cuts while avoiding the larger horse and Sintel regressions.
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
node tools/cdx-mp2-loop.mjs --baseline=5effd552 --out=.cache/cdx-mp2/loop-before.json
node tools/cdx-mp2-loop.mjs --out=.cache/cdx-mp2/loop-after.json
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

After merging main through `d5039103` (task 37's new worker and Manual r8), the complete required
list plus all 14 new specs passed **117/117** in one isolated invocation at `47359f83`. No failures,
skips, or retries. The command below was repeated without `tests/smoke.spec.mjs`, with output in
`.cache/cdx-mp2/integration-results`. All 16 `psv3` cases passed again. The 50 smoke tests had
already passed before this merge; they were not repeated afterward.

Post-merge first desktop Sharp presentation was **1,758 ms**, with refinement still active. The new
worker preserves the legacy raw-frame protocol. The real-model machine, bridge, horse, and Sintel
specs reproduced their pre-merge jitter and surface-cut values exactly, and the Bunny and larger 60
fps refinement checks also passed. The historical tables and upload GIFs below are explicitly
labeled as pre-integration captures; their core numerical upload results were rechecked on the
merged worker. Standard screenshots were restored again after this run.

The pre-integration review run passed **167/167** in one invocation at `9ad9a3a9` (before the
subsequent task 37 worker merge): 103 required regressions, 14 task 38 specs, and 50 smoke tests. No
failures, skips, or retries. Real Chromium, software WebGL2, one worker, `--trace=off`; WebGPU
checks also passed. Browser plugin was unavailable; regular Playwright was used. Existing screenshot
specs exercised 390 × 844 and 1440 × 900, and their standard files were restored afterward. The
embed transfer check measured 9.1 MB against its 30 MB limit.

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium SPLASHERY_PORT=4388 npx playwright test \
  tests/smd-moving.spec.mjs tests/live3*.spec.mjs tests/live5.spec.mjs \
  tests/live6.spec.mjs tests/lv7-long.spec.mjs tests/psv*.spec.mjs \
  tests/phf*.spec.mjs tests/smd-compare.spec.mjs tests/cdx-stability.spec.mjs \
  tests/cdx-mp2.spec.mjs tests/smoke.spec.mjs --trace=off --workers=1 \
  --output=.cache/cdx-mp2/review-complete-results --reporter=line
```

The new coverage includes a Track used without the app and checks that Sound methods never change,
playing and paused UI toggles, real songs in Chladni 3D and the Studio song, actual desktop Sharp
presentation before refinement, real-model upload comparisons for all five samples, native 60 fps
pictures with larger background estimates, paused decoded seeks, and changing baked depth frames.
The deterministic late-ended-audio test checks the old tail fallback directly. All 16 `psv3` tests
passed in the complete run, including both sound-loop speeds and simulated 30 fps drawing.

Earlier verification is retained here for context: the initial PR's overlapping required run passed
99/103; the affected files passed separate reruns. A later sound-loop check observed 0.622 seconds
against a 0.5-second bound under concurrent rendering. Review runs with trace recording also exposed
a wrap-crossing `live5` measurement and 4.4–4.8-second instrumented desktop previews. Those failures
led to the startup, sampling, yielding, and ended-audio changes described above. That complete run
had no overlapping browser jobs and disabled recording overhead without changing required
assertions. Its first completed desktop Sharp picture was **1,417 ms**, with background refinement
still active.

`node tools/check-packs.mjs moving-photo-3d` produced 208,806 finite splats in 3,071 ms and still
fails its 1.5-second construction cap. The recorded baseline was 3,079 ms with the same count; this
inherited limit remains unresolved. `node tools/nc-assets.mjs --check` passed. The contact sheet and
new phone strips were reviewed; standard screenshots were restored. Prettier, American English, and
whitespace checks are run immediately before the push. No depth worker, model implementation, common
relief-mesh code, other photo path, library, or dependency changed.

The new speaker and upload tests use real media, Sound, Track, and the on-device model. The
moving-edge oracle uses synthetic depths to check interpolation. Some existing live-input tests mock
camera/microphone signals; they are regressions, not new measurements. Physical phone frame rate,
perceptual audio quality, every-frame background coverage, and ground-truth depth error remain
unmeasured.

Phone motion evidence is stored on the separate review branch and linked from the draft PR, with
per-frame media clocks. Screenshots and GIFs expose remaining contour gaps instead of hiding them.
The legacy bridge review GIF is included following the Operator's confirmation to keep that existing
sample; its source credit and clock records accompany the render.

## Rule check and cuts

Rule check: A2 applies to the legacy bridge. It is retained per the Operator's confirmation, and
rendered under the original task's request to review each sample. This uses the existing footage; no
new live-action source is introduced. A1/A2 shaped the new city montage, which excludes identifiable
faces and modern firearms. The Operator also confirmed retaining the longer films. No owner notes or
attachments were committed.

The full upload gap is not claimed closed for every clip, native 60 fps depth inference is not
promised within the existing geometry budget, original short-source downloads were not available for
three comparisons, and real phone hardware/audio audition were not measured.

## Round 3

Codex task 48 started on October 12, 2026, at 23:05 UTC, with a 12-hour cutoff of October 13 at
11:05 UTC. Work stays on `codex/moving-photo-r2-public`, with latest main merged at `a9069bfe`. The
immutable comparison is #560's prior head, `93077cf6`. The requested Goal Mode switch is not
available in this session; the same goal and stopping rule were followed through normal execution.

Before captures route the four task-owned modules from that immutable head into the current merged
app. The only source file changed by the main merge is `src/live/relief.js`, for CameraDepth and
Splat mirror; Moving photo's common mesh and depth worker are identical to the prior head. This
compares the owned clip implementation while keeping the current app and renderer consistent.

### Measurement and source correspondence

`tools/cdx-mp2-measure.mjs --goal` now measures the entire projected picture on every decoded source
frame. The camera is explicitly applied to the stage at yaw 0.18 and pitch 0.08. The reference uses
the same compiled surface shader, with its cut threshold disabled by a uniform; changing shader code
for the mask had produced false one-pixel differences at the outline. No central crop or rim
exclusion is used. Prepared JPEG-sheet samples retain their existing 16 fps pictures; the native
Bunny, long films, original-source uploads, and fast clip use their actual decoded timestamps. The
source-clock enumeration includes the final decoded frame. Each stepped frame calls the actual
screen draw, Sharp sync, camera update, and engine capture. Unrelated paused update callbacks are
suspended after preparation; the real decoder, shader draws, and engine frame-end captures remain
active. Eight paired source-frame PNGs, across the before and after versions, were byte-for-byte
identical with those callbacks enabled and suspended. Startup and continuous playback are measured
separately. Reusing the discovered brightness candidates avoids a duplicate image scan: 792 offline
synthetic checks matched the original scan exactly, with unchanged thresholds.

Holes are transparent pixels inside that complete reference. Their mask and denominator stay
independent of the brightness scan. That scan also includes actual picture walls projecting beyond
the reference outline. An independent geometry-role pass excludes the dark frame while retaining its
depth occlusion. Bright candidates use a 12 CSS-pixel rim, a 5 × 5 screen-neighborhood median,
luminance at least 160, and the unchanged 60-level brightness difference. An opaque candidate is
introduced only if it is also more than 60 levels above the maximum of a 5 × 5 neighborhood in the
exact displayed source frame, at independently mapped physical source coordinates. Legacy backing
geometry uses its physical `uv`, before its borrowed color coordinate `cuv`; reconstructed walls use
their declared owning depth cell. The source pass packs the exact native pixel index into opaque
RGB24, without UV quantization or alpha premultiplication. Transparent tears cannot be excused by
bright source content. The optional old screen-reference outlier counts remain diagnostics, and an
unwitnessed opaque candidate remains a failure. Final sweeps skip that separate diagnostic scan; the
independent geometry-role mask and its complete brightness scan still run on every frame.

This corrects a demonstrated measurement error: Bunny at 0.42708375 seconds had two reported specks
at screen pixels (212, 585) and (212, 586). Their mapped native pixels (203, 325) and (203, 326) are
bright finger fur, with luminance 232.89 and 228.11; the rendered first point was 239.18. The
stretched uncut triangle instead showed grass there. These are existing source details, within the
same 60-level comparison, rather than newly introduced brightness. The source witness checks local
source correspondence; it does not establish ground-truth depth or the physical correctness of
unseen surfaces.

The phone browser is 390 × 844 at device scale factor 3. The app's low-profile stage caps its actual
canvas ratio at 1.5; that ratio is recorded rather than described as a 3× canvas. Desktop is 1440
× 900. Chromium is `/usr/bin/chromium`; the documented `/opt/pw-browsers/chromium` is absent. WebGL2
uses ANGLE with Mesa llvmpipe on Xvfb, and WebGPU regression checks use the real SwiftShader
adapter. Physical phone performance is not measured. CPU-rate-4 timing uses CDP page throttling and
does not throttle the model worker or emulate a physical phone.

After the first two cases per version, subsequent sweeps and final isolated regressions limit
llvmpipe with `LP_NUM_THREADS=2` to fit the environment's four-CPU quota. The first cases used the
driver default. Sixteen independently repeated before/after frames had identical plain and reference
PNGs, source/depth hashes, and every metric with two threads and the default. This establishes pixel
equivalence for that check, rather than an isolated performance comparison. Each later case records
its graphics-thread setting.

### Fix log

- The inset coarse backing and its borrowed far-side colors left real gaps and introduced bright
  colors beside moving foreground edges. Clip-only observed pixel patches now have solid sides,
  raster depth, and native texture sampling. Intact triangles retain their normal source rendering;
  extra pixel geometry is selected around potential cuts, with a neighboring margin.
- The frame now shares the actual surface's border vertices. Cutting the already softened border
  from unsmoothed depth had discarded continuous border triangles. Clip cuts now use the existing
  six-cell softened band's geometry, with the original interior cut threshold and full depth lift.
- Side-wall UV gradients collapse along their normal. They now represent one observed depth cell's
  finite source footprint along that direction and bound the real tangent gradient to the owning
  patch. Native top filtering stays unchanged; no color blur or image mask is added.
- Clip shaders specialize the roles already fixed by the clip path. The existing border stencil and
  conservative vertex-edge magnitude use a small CPU field for the first preview. Regular playback
  evaluates the vertex stencil on the GPU, with shared border anchors for the frame. The
  measurement's large cut uniform still disables all reference cuts. The first full regression run
  exposed four playback-clock failures with the CPU interior stencil. Moving that stencil back to
  the GPU made all 16 unchanged `smd-moving` tests pass, including their original 3% clock bounds. A
  later complete 188-test run passed 187 tests but missed Machine's slow playback bound: 3.19
  seconds of the clip in 3.51 seconds. No other browser job ran during that suite.
- Potential-cut selection now bounds adjacent horizontal and vertical depth changes separately,
  including linear-sampler support and floating-point coordinate padding. The previous broad
  neighborhood range could select intact ramps unnecessarily. Raising its threshold directly was
  rejected: an 8/255 local range can still produce a 0.06172 summed triangle slope, above the
  unchanged 0.05 fragment cut. Offline adversarial checks covered 30,800 triangle points and 831,600
  vertex/stencil samples without omitting an actual cut. A second check covered 48 real grid
  configurations and 3,110,400 sampler-support checks. A synthetic two-axis ramp's selected cells
  fell from 51,276 to 18,824; this is a geometry-work diagnostic, not a hardware benchmark. The
  directional filter runs after the original conservative selection and compacts its IDs, so it
  never adds work on small noisy checkers. Another isolated suite passed 43 of 44 tests, with Horse
  at 3.98 seconds of source in 4.14 seconds of wall time.
- Regular clip texture and geometry preparation now runs after the player's media-clock drive,
  during the same stage update and before rendering. Opening, paused or frozen manual captures,
  builds, and Sharp-to-Splats handoffs retain immediate synchronization. The independent render test
  recorded 21 depth uploads outside the drive and exact selected-depth bytes on all 25 rendered
  frames. The unchanged Bridge and Machine slow-clock tests then measured 3.64/3.64 and 3.82/3.82
  seconds, respectively. The final aggregate regression results are recorded below.
- A zero-depth floor initially closed the junctions, but also added colored thickness to a flat
  picture: the independent oblique flat-depth regression found 6,525 opaque pixels more than one
  raster pixel beyond its projected plane. Shared lower corners now come from the minimum of the
  four incident observed patches. Lower caps close their junctions, and flat patches collapse to one
  surface. This geometry check is independent of the source-brightness witness.
- A real first estimate uses a small opening geometry with the full available picture, before the
  complete clip is prepared. Original full-resolution normalization, mean, refinement, playback
  frame rate, and model inputs remain in use for the regular clip. Worker initialization overlaps
  decoding. A long preview uses answer one while its original four-answer opening finishes.
- Failed openings release video, audio, object URLs, and workers. Changing clips or toys releases
  the paused player, closes an owned pending preview, and prevents a late custom-clip commit.
  Cancellation is latched and tied to the selected toy object, including a switch away and back
  before answer one exists.
- Short-video extraction waits for a fresh compositor presentation after seeking, with two paint
  cycles as a bounded fallback for paused videos that present while seeking and never issue another
  callback. Cancellation, decode errors, and a 10-second timeout release callbacks and listeners.
  The callback-only experiment timed out in a real browser and was rejected. This changes background
  extraction; the first preview still comes before that read.

The first native-role-v4 candidate completed 14 phone cases (3,846 frames): all holes were zero and
all paired stability values were no worse. Machine long alone reported one introduced rim pixel at
source time 22.42725, frame 538, screen (445, 594). Its shown RGB was (182, 195, 197), with
luminance 192.38 versus native 5 × 5 maximum 67.67 at physical source pixel (522, 342). The source
was the actual 640 × 360 long machine film, verified byte-for-byte. A diagnostic shader reported an
X-positive wall and an extrapolated tangential footprint exceeding 32 native pixels. Bounding that
derivative to the finite owner patch was tested separately: the pixel remained in WebGL but
disappeared in WebGPU. That failed WebGL experiment is retained; its result does not establish that
the sampling diagnosis was causal. A follow-up captured the actual compiled GLSL, uniforms, and draw
calls: the bounds were active, while the native sampler used trilinear mipmaps and anisotropy 16.
Replacing only the wall color read with zero-level native sampling produced RGB (52, 68, 68) and
zero specks; a wall-only magenta read changed that exact pixel to magenta. These separate diagnostic
variants retained the same source RGBA hash and zero holes. A final candidate must bound the actual
mip footprint to the observed patch, rather than assume the anisotropic gradient path obeys those
finite bounds. A separate visibility check retained the original shaders: primary only gave RGB (51,
67, 68), cells only gave (182, 195, 197), and the frame was transparent at the target. The actual
wall contributes the bright pixel; this is not a primary pixel misidentified by a different witness
vertex shader. The final wall read computes an explicit mip level from the finite owner footprint;
the primary surface keeps its existing filter. At native frames 537, 538, and 539 the prototype had
zero holes, introduced specks, and unwitnessed specks in WebGL, with each complete source RGBA hash
unchanged from its control. Frame 538 also passed on the actual WebGPU adapter. The corrected pixel
was RGB (52, 68, 68) in WebGL and (51, 67, 68) in WebGPU. Production now uses the four-module hash
`94a18adf3efac9ec6f84154b01ef2783701e28f96ecc278568a12a499a181413`; the final sweeps and 197-case
regression invocation restarted on that immutable snapshot. The prior 14-case films were archived
and will not be presented as the final version.

Decoder input variability is recorded independently of depth quality. Two repeated old-code Bunny
reads initially had identical retained colors, resized model inputs, raw model answers, and final
depth bytes. In a later pair, the second old-code read changed retained RGB frame 30 and model
input/output 45, with changed final depths from frame 24 onward. Its retained-grid jitter rose from
0.00343899 to 0.00347205. Both new-reader runs matched the first old-code run exactly at every one
of those hash checks, including all 72 final depth arrays. These retained-grid diagnostics are
separate from the final native-frame quality tables. They establish sensitivity to decoder input;
they do not justify replacing a worse before/after table entry with a better run. The earlier pinned
candidate repeated this comparison without the optional video observer, which registers its own
compositor callbacks. Both completed runs matched every old-code color, model input, raw answer, and
final-depth hash. The final reader always completes two paint cycles after seeking, including when a
compositor callback arrives earlier. The pre-mip-fix four-module code hash was
`12c9f8e6f3a09c09932c9f24525e060c60b4a673f42fd03d6bb1db49ebb70710`.

An independent paused-video check found a measurement freshness defect in the old-code sweep:
Bunny's native frames 142 and 143 still displayed the preceding canvas picture, while the later
source witness had advanced. Their texture/source comparisons differed in 302,707 and 99,270 RGBA
bytes. The quarter-frame seek removes timestamp-boundary ambiguity but does not guarantee that the
decoder's picture is ready for canvas. Waiting two paint cycles before drawing made both versions
match at all 12 checked source times, all 72 texture snapshots, and all 72 direct native snapshots.
The new `native-role-v4` harness checks the displayed native color canvas against the video before
the plain capture, uses those exact copied pixels for source support, and checks that the native
video remains byte-identical after the witness capture. Every measured frame records that check. The
check establishes exact displayed/source RGBA correspondence at each requested source timestamp; it
does not independently observe a compositor decoder-frame index. The enumeration comes from FFprobe
timestamps, and seeks target a quarter frame beyond each boundary. The harness also waits for the
selected scene's full build before freezing preparation, so an opening-preview clone cannot be
mistaken for the final native source. Paused legacy long clips may not yet have received the screen
draw that supplies their depth bytes; the capture setup explicitly performs that real draw and
rebinds the full Sharp source before freezing. This corrects the old-code long-film capture
timeouts. Earlier `native-role-v3` ledgers and review PNGs are archived; both complete sweeps
restart with this stronger check. No thresholds, source crops, frame rates, or camera poses change.

The cached-long regression exposed a separate canvas conversion difference: the 426 × 240 VP9
picture at five seconds differed in 895 RGBA bytes, each by exactly one level, between Chromium's
default canvas and read-frequent canvas paths. The unchanged production snapshot and an experimental
extra paused repaint produced the same differences; that repaint was removed. The harness now
independently draws the video through both canvas paths and requires the displayed full RGBA array
to match one exactly, both before and after the witness capture. There is no per-pixel tolerance.
The matching independent read supplies the source neighborhood, and each new frame records its
canvas path. The first two cases per version already satisfied the read-frequent path's exact check.
The cached-long regression then passed. Hole and speck thresholds remain unchanged.

A later old-code Sintel-long upload capture rejected a frame after more than 600 valid frames
because the native video changed between the picture and witness reads. That incomplete case is
excluded and recaptured. Goal capture now permits at most three attempts only for that exact
stale/changed-source failure. Every accepted attempt still passes the same complete byte-for-byte
pre/post native check. Rejected attempts are logged, and accepted frames/cases record their retry
counts; quality results, thresholds, source clocks, and still-region comparisons are never retried
or loosened. A rejected source attempt occurs before the previous-frame stability state is updated.
A retry also reinitializes the normal Sharp source identity without an intermediate render, so it
refreshes both the paused native picture and the depth/patch cache. Before accepting a retry, the
uploaded primary R8 bytes must exactly match its freshly computed depth field. Ordinary captures
keep the app's established depth frame-rate cache; their stability values use the sampled depth
field, as in the earlier tables. A retry's real source rebind can refresh geometry between ordinary
12 Hz cache updates; its per-frame `nativeCaptureRetries` and `depthPixelsVerified` flags identify
that distinction. Aggregate retry counts cover accepted measurement frames; evidence and exhausted
attempts are retained in the capture log. Opening preparation is also bounded by the 11:05 UTC
deadline; a timed-out opening closes its page and records that cutoff. Tests retain zero configured
retries.

Original short uploads are now derived from the original downloads, rather than JPEG sheets.
`tools/cdx-mp2-originals.mjs` records source hashes and retains their native frame rates. Sintel
uses the existing active-picture crop; Tears of Steel's downloaded picture is natively 1280 × 534.
The machine cut starts at the native frame matching the prepared sample, PTS 329.666139; a rounded
329.7-second seek had advanced to the next frame. No source downloads or private attachments are
committed.

### Results and verification

The every-frame tables, timing tables, spec counts, and review links are recorded below. All 16
existing required spec files are byte-identical to immutable #560 head `93077cf6`; the main merge's
separate `cdx-mir` changes are outside this unchanged 167-case set. The final suite began alongside
two capture jobs. Its early desktop startup cases missed their original 5,000 and 4,000 ms bounds at
5,491.8 and 4,738.6 ms. Those failures are retained. Captures pause at case boundaries for isolated
reruns and final startup measurements. The contended video/sound test also crossed its six-second
loop and reported a clock ratio of −84.5523 against its unchanged 0.6–1.4 bounds; its unchanged
assertion is included in that isolated rerun. All five short sample/upload pairs then completed
(1,038 final frames), with zero holes, zero introduced rim specks, and no larger paired stability
values. No claim that the complete Goal holds is made before those runs finish.

Before the final mip fix, the isolated full run passed all **167 original cases**, unchanged, and 28
of 29 new cases. The one new cached-long failure was the canvas conversion check described above.
After correcting the harness, all 15 Round 3 cases passed in one isolated rerun, including that
cached-long test. Together, all **196 cases** passed on the pre-mip-fix production snapshot; no
assertion changed, no case was skipped, and neither invocation used retries. The complete invocation
took 41.3 minutes. The embed measured 9.1 MB against its unchanged 30 MB limit. Counts below
distinguish the original task 38 file from the three new Round 3 files. The final mip fix adds one
further real-frame regression, so its fresh full invocation has 197 cases. The table records the
final aggregate counts, including the isolated reruns described below.

| Spec file                 | Passed |
| ------------------------- | -----: |
| `cdx-mp2-decode.spec.mjs` |      7 |
| `cdx-mp2-pixels.spec.mjs` |      7 |
| `cdx-mp2-r3.spec.mjs`     |     16 |
| `cdx-mp2.spec.mjs`        |     14 |
| `cdx-stability.spec.mjs`  |     10 |
| `live3-engine.spec.mjs`   |      4 |
| `live3.spec.mjs`          |     11 |
| `live5.spec.mjs`          |      5 |
| `live6.spec.mjs`          |      3 |
| `lv7-long.spec.mjs`       |      2 |
| `phf-engine.spec.mjs`     |      5 |
| `phf.spec.mjs`            |      7 |
| `phf2.spec.mjs`           |      7 |
| `psv.spec.mjs`            |      8 |
| `psv2.spec.mjs`           |      6 |
| `psv3.spec.mjs`           |     16 |
| `smd-compare.spec.mjs`    |      3 |
| `smd-moving.spec.mjs`     |     16 |
| `smoke.spec.mjs`          |     50 |

The final mip-fix full invocation completed in 68.1 minutes with **194/197 passed**, zero skipped
cases, and zero configured retries. All 30 new cases passed. Its three earlier failures are the
startup and wrapped sound-clock values described above; isolated reruns are recorded separately. The
three isolated reruns then passed in 1.9 minutes, with the desktop first-Sharp check at 3,705 ms
against its unchanged 5,000 ms ceiling. Together, all **197 cases** pass on final pin `94a18adf`,
including all **167 original cases**, unchanged, and all **30 new cases**. Neither invocation
configured retries or skipped a case. The 194/197 shared-device run and all its three failed values
remain in the report; this is an aggregate of two invocations. All 16 `smd-moving` cases and all 16
`psv3` cases passed unchanged. Bridge and Machine slow clocks were 3.59/3.59 and 3.79/3.79 seconds,
and the embed again measured 9.1 MB against 30 MB.

<!-- mp3-final-results -->

**Final status: the measurement window ended on October 13, 2026, at 11:05 UTC, after 12 hours.**

The complete Goal **does not hold** at the 12-hour cutoff.

- **Holes and edge specks:** the worst observed hole share is 0.000000% and the maximum introduced
  rim-speck count is 0, across 5,456 measured candidate frames. 23/38 cases are complete; incomplete
  or unmeasured paths are not certified. Both paths are complete in 9 sample/upload comparisons. The
  detailed tables retain any failed hole, speck, or upload comparisons.
- **Steady:** Raw stability is worse in these complete pairs: phone/bridge-long/sample,
  desktop/sample/upload, phone/sample-long/upload. There are 23 complete before/after pairs; partial
  pairs are not certified. These are sampled-depth still-region jitter and edge-flip measures,
  rather than a full perceptual measure of rendered geometry.
- **Startup:** **fails**. 13/19 isolated desktop cases present the first actual 3D frame within two
  seconds; the slowest is 3.0666 seconds. Slow-phone CDP page CPU-rate-4 timings range from 0.3804
  to 7.7937 seconds, with the worker unthrottled.
- **Existing tests:** pass unchanged in aggregate, with all 167 required original cases plus 30
  added cases. The shared-device full invocation was 194/197; its three unchanged failures passed in
  the isolated rerun. The failures and timings remain in the audit.

Measured 5,456 candidate frames in 23/38 complete cases, and 7,932 before frames in 30/38 complete
cases. 23 cases have complete before/after pairs.

**Phone**

| Clip/path             |     Frames | Worst holes, before → after (% @ seconds)              | Specks, before → after | Height jitter, before → after |   Flips/1,000, before → after |
| --------------------- | ---------: | ------------------------------------------------------ | ---------------------: | ----------------------------: | ----------------------------: |
| Bunny sample          |        144 | 0.322350 @ 0.343750 (f8) → 0.000000 @ 0.010417 (f0)    |                 42 → 0 |     0.003323712 → 0.003323712 |     3.236679709 → 3.236679709 |
| Bunny upload          |        144 | 0.307561 @ 1.177084 (f28) → 0.000000 @ 0.010417 (f0)   |                 58 → 0 |     0.001611490 → 0.001611490 |     0.435223464 → 0.435223464 |
| Horse sample          |         15 | 0.274529 @ 0.025000 (f0) → 0.000000 @ 0.025000 (f0)    |                 23 → 0 |     0.092114497 → 0.092114497 | 188.586643998 → 188.586643998 |
| Horse upload          |         15 | 0.020708 @ 0.625000 (f6) → 0.000000 @ 0.025000 (f0)    |                 10 → 0 |     0.009273013 → 0.009273013 |     0.010079502 → 0.010079502 |
| Sintel sample         |         96 | 0.041761 @ 3.390625 (f54) → 0.000000 @ 0.015625 (f0)   |                 17 → 0 |     0.011706760 → 0.011706760 |     6.110735788 → 6.110735788 |
| Sintel upload         |        144 | 0.983508 @ 0.593250 (f14) → 0.000000 @ 0.010250 (f0)   |                234 → 0 |     0.005720029 → 0.005720029 |     1.286823102 → 1.286823102 |
| Bridge sample         |         96 | 4.079132 @ 0.640625 (f10) → 0.000000 @ 0.015625 (f0)   |                236 → 0 |     0.014792007 → 0.014792007 |     3.109923304 → 3.109923304 |
| Bridge upload         |        144 | 6.198708 @ 0.677250 (f16) → 0.000000 @ 0.010250 (f0)   |                418 → 0 |     0.004186182 → 0.004186182 |     1.139781985 → 1.139781985 |
| Machine sample        |         96 | 0.032019 @ 5.703125 (f91) → 0.000000 @ 0.015625 (f0)   |                 23 → 0 |     0.012681900 → 0.012681900 |   16.311772724 → 16.311772724 |
| Machine upload        |        144 | 2.377422 @ 3.260250 (f78) → 0.000000 @ 0.010250 (f0)   |                447 → 0 |     0.003829699 → 0.003829699 |     0.683532055 → 0.683532055 |
| Bunny long sample     |        720 | 1.220795 @ 13.802250 (f331) → 0.000000 @ 0.010250 (f0) |                 56 → 0 |     0.004027254 → 0.004027254 |     1.735584974 → 1.735584974 |
| Bunny long upload \*  |        720 | 1.355032 @ 12.593250 (f302) → 0.000000 @ 0.010250 (f0) |                 80 → 0 |     0.012248085 → 0.012176927 |     7.598676151 → 7.694871578 |
| Sintel long sample    |        720 | 0.023094 @ 20.927250 (f502) → 0.000000 @ 0.010250 (f0) |                 13 → 0 |     0.004724679 → 0.004724679 |     4.394370858 → 4.394370858 |
| Sintel long upload    | Unmeasured | 0.054228 @ 23.010250 (f552) → Unmeasured               |        15 → Unmeasured |      0.005351683 → Unmeasured |      2.517036828 → Unmeasured |
| Machine long sample   |        720 | 0.780600 @ 3.843250 (f92) → 0.000000 @ 0.010250 (f0)   |                138 → 0 |     0.024425558 → 0.024425558 |   44.239005456 → 44.239005456 |
| Machine long upload   | Unmeasured | 1.166959 @ 0.177250 (f4) → Unmeasured                  |       279 → Unmeasured |      0.026532305 → Unmeasured |     31.206012837 → Unmeasured |
| Bridge long sample \* |        648 | 0.740603 @ 25.218250 (f605) → 0.000000 @ 0.010250 (f0) |                137 → 0 |     0.009810271 → 0.009810691 |   12.459788177 → 12.460314004 |
| Bridge long upload    | Unmeasured | 0.114788 @ 15.343250 (f368) → Unmeasured               |        37 → Unmeasured |      0.004800130 → Unmeasured |      0.000156189 → Unmeasured |
| Fast 60 fps upload    |        120 | 0.083399 @ 0.587000 (f35) → 0.000000 @ 0.004000 (f0)   |                 25 → 0 |     0.000611163 → 0.000611163 |     0.000000000 → 0.000000000 |

**Desktop**

| Clip/path           |          Frames | Worst holes, before → after (% @ seconds)             | Specks, before → after | Height jitter, before → after |   Flips/1,000, before → after |
| ------------------- | --------------: | ----------------------------------------------------- | ---------------------: | ----------------------------: | ----------------------------: |
| Bunny sample        |             144 | 0.301592 @ 0.510417 (f12) → 0.000000 @ 0.010417 (f0)  |                 25 → 0 |     0.003323712 → 0.003323712 |     3.236679709 → 3.236679709 |
| Bunny upload \*     |             144 | 0.270289 @ 0.343750 (f8) → 0.000000 @ 0.010417 (f0)   |                 46 → 0 |     0.000935115 → 0.000943718 |     0.546645249 → 0.546592645 |
| Horse sample        |              15 | 0.275195 @ 0.025000 (f0) → 0.000000 @ 0.025000 (f0)   |                 15 → 0 |     0.092114497 → 0.092114497 | 188.586643998 → 188.586643998 |
| Horse upload        |              15 | 0.000000 @ 0.025000 (f0) → 0.000000 @ 0.025000 (f0)   |                  0 → 0 |     0.008425683 → 0.008425683 |     0.047877635 → 0.047877635 |
| Sintel sample       |              96 | 0.041620 @ 3.328125 (f53) → 0.000000 @ 0.015625 (f0)  |                 18 → 0 |     0.011706760 → 0.011706760 |     6.110735788 → 6.110735788 |
| Sintel upload       |             144 | 0.351972 @ 1.760250 (f42) → 0.000000 @ 0.010250 (f0)  |                122 → 0 |     0.005665365 → 0.005665365 |     0.092582492 → 0.092582492 |
| Bridge sample       | 92 / 96 partial | 3.921771 @ 0.578125 (f9) → 0.000000 @ 0.015625 (f0)   |                181 → 0 |     0.014792007 → 0.014950683 |     3.109923304 → 3.245678128 |
| Bridge upload       |      Unmeasured | 5.421081 @ 0.302250 (f7) → Unmeasured                 |       468 → Unmeasured |      0.003171682 → Unmeasured |      1.280384164 → Unmeasured |
| Machine sample      |      Unmeasured | 0.010030 @ 5.703125 (f91) → Unmeasured                |         9 → Unmeasured |      0.012681900 → Unmeasured |     16.311772724 → Unmeasured |
| Machine upload      |      Unmeasured | 0.646841 @ 0.302250 (f7) → Unmeasured                 |       292 → Unmeasured |      0.002598764 → Unmeasured |      0.027568017 → Unmeasured |
| Bunny long sample   |      Unmeasured | Unmeasured                                            |             Unmeasured |                    Unmeasured |                    Unmeasured |
| Bunny long upload   |      Unmeasured | Unmeasured                                            |             Unmeasured |                    Unmeasured |                    Unmeasured |
| Sintel long sample  |      Unmeasured | Unmeasured                                            |             Unmeasured |                    Unmeasured |                    Unmeasured |
| Sintel long upload  |      Unmeasured | Unmeasured                                            |             Unmeasured |                    Unmeasured |                    Unmeasured |
| Machine long sample |      Unmeasured | Unmeasured                                            |             Unmeasured |                    Unmeasured |                    Unmeasured |
| Machine long upload |      Unmeasured | Unmeasured                                            |             Unmeasured |                    Unmeasured |                    Unmeasured |
| Bridge long sample  |      Unmeasured | Unmeasured                                            |             Unmeasured |                    Unmeasured |                    Unmeasured |
| Bridge long upload  |      Unmeasured | Unmeasured                                            |             Unmeasured |                    Unmeasured |                    Unmeasured |
| Fast 60 fps upload  |             120 | 0.044479 @ 1.804000 (f108) → 0.000000 @ 0.004000 (f0) |                 12 → 0 |     0.000515692 → 0.000515692 |     0.000000000 → 0.000000000 |

An asterisk marks a raw stability value above its complete paired before measurement. Values for a
partial candidate row describe only its measured prefix; its complete before values remain visible,
but that prefix is not a strict stability comparison. Missing sides are labeled separately. Source
decoding variability is reported separately; these entries are retained.

The frame number in each worst-hole cell identifies the measured source-clock frame (zero based).
Partial rows describe only their measured prefix. The final scheduled captures retain their deadline
flags and opening/capture errors in the raw ledgers. A second, independent capture job used the same
production pin, oracle, source hashes, and profile to cover additional phone uploads while the main
job measured desktop cases; its rows were combined only after both jobs stopped. Duplicate cases, if
any, are excluded without comparing quality values. No quality result is retried.

Final media:
[all 11 before/after phone films](https://github.com/ryanjosephkamp/splashery/tree/codex/moving-photo-r3-clips/docs/reviews/moving-photo-r3),
on the fresh branch that must never be merged. All nine samples and the original Bridge and Machine
uploads retain every measured playback frame: 3,543 frames per side, 780×844 comparison pixels, 24
fps for videos, 10 fps for the horse GIF, and the existing 16 fps for prepared short sample frames.
Each encoded film is fully decoded to verify its count, rate, and dimensions; each movie's checksum
and exact source-clock hashes are in the manifest. Frames at 25% and 75% of every movie were
inspected together. The movies contain no audio.

The media branch also contains the final
[before ledger](https://github.com/ryanjosephkamp/splashery/blob/codex/moving-photo-r3-clips/docs/reviews/moving-photo-r3/quality-before.json),
[after ledger](https://github.com/ryanjosephkamp/splashery/blob/codex/moving-photo-r3-clips/docs/reviews/moving-photo-r3/quality-after.json),
desktop and slow-phone startup ledgers, and aggregate test counts. These preserve exact per-frame
results and cutoff flags. The remaining work is to resolve the retained strict stability increases,
meet the first-result deadline, and complete all 38 profile/path cases without weakening the oracle,
test thresholds, lift, motion, or model budget.

<!-- mp3-end-final-results -->

<!-- mp3-startup-table -->

Actual first presented Sharp frame, timed from UI selection. These pre-mip-fix cases use code hash
`12c9f8e6f3a09c09932c9f24525e060c60b4a673f42fd03d6bb1db49ebb70710`. Each upload uses a cold model
worker; each profile runs serially without competing browser jobs. Local HTTP, software graphics,
and driver caches remain part of the environment. Both desktop settings passed **11/19** cases under
two seconds, with zero browser errors. The startup Goal **does not hold**. The slow phone profile
uses CDP page CPU-rate-4 throttling, without worker throttling; its range is 306.9–4,574.9 ms,
rather than a physical-phone benchmark. The earlier 19/19 pass belonged to an older geometry
iteration and is superseded by these complete pre-mip-fix measurements. Final mip-fix timing is
recorded separately below.

| Clip         | Path   | Desktop, default driver (ms) | Desktop, two graphics threads (ms) | Slow phone, default driver (ms) |
| ------------ | ------ | ---------------------------: | ---------------------------------: | ------------------------------: |
| Bunny        | Sample |                       3662.8 |                             2805.9 |                          1081.1 |
| Bunny        | Upload |                       1936.1 |                             2141.2 |                          1514.6 |
| Horse        | Sample |                        367.9 |                              259.9 |                           603.8 |
| Horse        | Upload |                       3235.2 |                             2186.0 |                          3286.9 |
| Sintel       | Sample |                        296.5 |                              247.9 |                           897.1 |
| Sintel       | Upload |                       2033.5 |                             2566.1 |                          4574.9 |
| Bridge       | Sample |                        291.4 |                              125.9 |                           627.6 |
| Bridge       | Upload |                       1786.3 |                             2527.7 |                          1740.0 |
| Machine      | Sample |                        273.9 |                              482.9 |                           306.9 |
| Machine      | Upload |                       2914.9 |                             2512.4 |                          2488.8 |
| Bunny long   | Sample |                        598.1 |                              358.0 |                          1290.8 |
| Bunny long   | Upload |                       2376.8 |                             2712.4 |                          3721.3 |
| Sintel long  | Sample |                        590.7 |                              566.7 |                          1432.3 |
| Sintel long  | Upload |                       1553.5 |                             1702.3 |                          4441.8 |
| Machine long | Sample |                       1014.8 |                              553.8 |                          1239.0 |
| Machine long | Upload |                       4491.8 |                             1884.6 |                          2698.0 |
| Bridge long  | Sample |                       1041.6 |                             1008.6 |                          1333.9 |
| Bridge long  | Upload |                       2289.8 |                             2569.3 |                          2522.0 |
| Fast 60 fps  | Upload |                       2199.6 |                             1770.9 |                          3022.6 |

<!-- mp3-end-startup-table -->

<!-- mp3-final-startup -->

Final pin `94a18adf`: isolated serial measurements, driver default, 13/19 desktop cases below two
seconds. Browser errors: 0 desktop, 0 slow phone. **The startup Goal does not hold.**

Desktop range: 92.5–3,066.6 ms. Slow phone (CDP page CPU-rate-4, worker unthrottled): 380.4–7,793.7
ms.

| Clip         | Path   | Desktop (ms) | Slow phone (ms) |
| ------------ | ------ | -----------: | --------------: |
| Bunny        | Sample |      3,066.6 |           718.3 |
| Bunny        | Upload |      2,688.5 |         2,652.7 |
| Horse        | Sample |         92.5 |           380.4 |
| Horse        | Upload |      2,573.1 |         4,456.7 |
| Sintel       | Sample |        265.3 |         1,180.0 |
| Sintel       | Upload |      1,616.0 |         4,258.2 |
| Bridge       | Sample |        205.6 |           576.6 |
| Bridge       | Upload |      1,746.7 |         7,793.7 |
| Machine      | Sample |        436.3 |         1,288.6 |
| Machine      | Upload |      1,689.5 |         5,308.1 |
| Bunny long   | Sample |      1,255.8 |         1,228.7 |
| Bunny long   | Upload |      2,178.0 |         3,392.9 |
| Sintel long  | Sample |        504.5 |         1,896.0 |
| Sintel long  | Upload |      2,654.2 |         5,234.4 |
| Machine long | Sample |        854.3 |         1,420.5 |
| Machine long | Upload |      1,642.7 |         5,072.3 |
| Bridge long  | Sample |        450.7 |         2,329.0 |
| Bridge long  | Upload |      2,575.6 |         3,635.4 |
| Fast 60 fps  | Upload |      1,721.7 |         4,456.9 |

<!-- mp3-end-final-startup -->

### Rule check and remaining work

The existing Tears of Steel footage, including its identifiable people, is retained under the
[Operator's explicit confirmation](https://github.com/ryanjosephkamp/splashery/pull/560#issuecomment-6130226869).
That confirmation also permits retaining the existing 61 MB of longer films. No additional
live-action source is introduced. New before/after films belong only on the fresh, never-merged
`codex/moving-photo-r3-clips` branch; the older review branch remains unmerged.

Ground-truth reconstruction, physical phone frame rate, and perceptual audio quality are not claimed
measured. Cold upload timing remains part of the Goal and will be stated explicitly even when it
exceeds two seconds.

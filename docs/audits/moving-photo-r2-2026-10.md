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

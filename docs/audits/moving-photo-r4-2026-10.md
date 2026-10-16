# Moving photo to 3D, round 4

Codex built this round on October 16, 2026. It replaces
[PR #560](https://github.com/ryanjosephkamp/splashery/pull/560), carrying its solid relief cuts,
native pictures, softened frame, and upload refinement forward. The task is
[92](../codex/92-moving-photo-r4.md); the performance review is
[the Operator's last comment](https://github.com/ryanjosephkamp/splashery/pull/560#issuecomment-6182624749).

This audit is being completed during the authorized twelve-hour run, October 16, 2026, 01:26–13:26
UTC. Quality, isolated cadence, and startup are complete. The final test status is recorded below;
an incomplete target is not a pass. The complete Goal is not met.

## Goal status

| Target                                                                           | Result                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sharp shows the chosen sample and local file                                     | All 81 ordered pairs of nine samples, five local formats, and Sharp/Splats transitions passed on the emulated phone.                                                                                                                                        |
| Phone cadence at least main; Operator median ≤50 ms and worst ≤250 ms            | First clean pass: all fourteen update medians are no worse than main; twelve meet the stricter 50 ms / 250 ms ceiling. Bound-picture clocks remain slower on Bridge and long Bunny. Closest-input repeats and startup are measured separately.              |
| Sharper and steadier on all nine samples and five original inputs, both profiles | Complete 28-case sweep: 7,102 original source frames, zero holes, edge specks, depth mismatches, or browser errors. Universal sharpness and stability gains are not established; one long-film jitter result and six long-film edge-flip results are worse. |
| First 3D frame no slower than main on phone                                      | All fourteen medians are faster across three fresh-context repeats per input and version (84 launches), with zero observer errors. The first usable front-surface draw completes a WebGL finish fence.                                                      |
| Photo checkpoint and every existing test                                         | Full suite running; 51 Photo scan tests passed. Initial failures and whole-file reruns are preserved in the ledger.                                                                                                                                         |
| Phone comparisons                                                                | Fourteen main/R4 pairs, two R3/R4 pairs, four actual live recordings, and two live pairs are complete. The separate clips branch is never merged.                                                                                                           |

## Baselines and scope

The branch starts from round 3, merges main at `5a55f5ccc25ebfa155e5db2391236558feb551ec`, and
preserves the merge at `49dd8b47`. A second merge brings in main at `cc297c89`, including its
generator initialization fix and three new test files. Round 4 itself changes no preexisting spec;
its two new files contain the new regressions. The upstream comparison-engine allowance is retained
exactly as merged. Generated screenshots are restored before handback.

The four clip modules pinned for main's comparisons are byte-identical between those two main
revisions. The later merge does not change the baseline clip implementation.

GitHub rejected the first push with GH007 email-privacy protection. The original local
`codex/moving-photo-r4` history is preserved. The public draft is
[PR #677](https://github.com/ryanjosephkamp/splashery/pull/677), on the fresh
`codex/moving-photo-r4-public` branch from the same round 3 base. New public commits use GitHub's
noreply identity. The initial public tree is byte-identical to the checked local tip. No original
branch is rebased, amended, reset, or force-pushed. Validation source hashes and the publication
record map the internal run revisions to the identical public files. The clips branch keeps its
requested name.

The shared `Track` change is isolated in **Engine: let clip sound reuse its decoded video element**
(`df6f69bd` on the public branch; originally `d28286c8` locally). A supplied, already loaded video
can be the track's media element; ordinary audio tracks retain their existing path. No shared relief
or depth-engine file is changed in round 4. Changes in `photo-sharp.js` are guarded clip paths and
helpers.

Main has five short samples and no long-sample shelf. For the four long comparisons, main opens the
identical film through its real local-file path. The baseline receives the exact selected native
picture in the quality harness so its broken MP3 picture and paused compositor do not distort a
geometry comparison. Main's geometry and shaders remain its own. This is a disclosed source
correction, not a claim that unmodified main shows those samples correctly.

The phone is real Chromium with a mobile user agent, 390 × 844 viewport, device scale factor 3, the
low profile, and CDP page CPU slowdown 4 for speed and startup. The desktop quality profile is 1440
× 900 at scale factor 1 and the mid profile. Mesa llvmpipe uses two graphics threads. Workers are
not CPU-throttled by CDP. This is software-rendered emulation, not a physical Android or Brave test.

## What changed

- A selected clip owns its picture. MP3 samples use their retained RGB frames. Video files share one
  playing element with sound, and cached inactive samples release their decoder resources until
  revisited. A long upload still needs a separate temporary seek decoder while its model job runs.
- Exact solid geometry moves into bounded workers. Short clips predict a preparation deadline from
  observed worker round trips, within the existing 24 MiB cache target. Two long-video workers pair
  a frozen native picture with its own depth and geometry. Obsolete packets close their picture
  resources; a cache miss never draws mismatched geometry.
- The original cell construction has an original, freestanding C/WASM implementation, with the
  scalar JavaScript path retained. SIMD and cached sample maps remove repeated numeric work without
  changing field values. The WASM has no runtime imports.
- Existing grid triangles are classified on the CPU. Exactly coplanar fans retain every boundary
  vertex. Only internal walls, exact duplicate caps, zero-area faces, and faces without a raster
  sample are omitted. Supporting native cells extend four cells beyond cuts. Camera changes
  immediately use conservative retained geometry. A full-film candidate sweep exposed a single Bunny
  hole at 14.88525 seconds with two supporting cells. Disabling raster culling or cap indexing left
  that hole; retaining all candidate cells closed it. Four supporting cells close the join, with a
  regression at both profiles. The full sweep is repeated after that change.
- Indexed lower caps share native corners. Upper caps are indexed only when their Float32 depths are
  unambiguous across the original arithmetic associations. Native color coordinates, the two
  original triangles, depth ties, and both sides of each solid are preserved.
- A video whose coded pixels have a non-square display aspect uses its native display canvas.
  Pausing after a native-video upload allocates the correct canvas texture size. Other sources
  retain their direct native path.
- Video workers close transferred frames before posting their result or retiring. Shutdown drains
  busy workers with a bounded final timeout, and a closed stream cannot schedule another frame
  callback.
- Baked long caches use their actual `i / fps` key times. Inferred upload answers retain their
  `(i + 0.5) / rate` timing. This removes the baked samples' half-frame depth delay without changing
  their source pictures.
- Frozen video frames retain their own native presentation timestamp. A delayed frame callback
  cannot label a newer picture with its older metadata clock. A shared picture-clock helper also
  keeps both live drive and pause from subtracting an audio-output delay from that video clock.
- Paused long clips include the exact subframe time in their depth-upload key, including when two
  times fall inside one retained frame.
- Node recipe builders use the actual baked long-sample depth without requiring a DOM decoder. The
  unchanged kit suite exposed this previously unhandled long-sample path.

The inherited-dispatch fix retains upload observers installed after a clip mesh is created. The
per-mesh revision counter had captured an old prototype function, hiding actual uploads from a late
observer. The complete quality sweep is repeated against this quality-capture source pin. A later
whole-file rerun exposed a second paused-capture race: the right picture can upload before the
explicit capture request starts. Explicit captures now refresh the active clip picture even at the
same paused clock, including when no ordinary clip update is due. The unchanged focused regression
passes. This capture-only fix changes neither construction nor ordinary playback scheduling.

An additional real-browser check found that raw `VideoFrame.copyTo()` pixels ignore display rotation
and flips. A square rotated frame passes a size-only shortcut, so the old native worker returned the
wrong picture on seven of eight rotation/flip combinations. Both native shortcuts now require
explicit zero rotation and no flip; transformed or unspecified frames use the existing native
display canvas. The new semantic regression sends all eight real transformed frames through the
actual worker, compares every returned bitmap byte with the browser's transform-aware canvas, and
checks resource closure and the source clock. It passes all eight. A separately routed before/after
check reproduces the old mismatches and the fixed zero-difference results without altering an
existing threshold. A real MP4 remuxed with a 180-degree display matrix also retains its encoded
video packet hash, matches the paused native Sharp texture, and returns zero changed worker bitmap
channels with the transferred frame closed. Its moving snapshot was taken under contention and
differs from the advancing media element; that snapshot is not accepted as a live-correspondence or
cadence proof.

The complete quality sweep is pinned to public `bf58e8c4` (application hash
`2b23383b800065b10385c77c0da6245053c5bbd60a5ba35c105fba87f54347e4`). The measured runtime adds those
two transform guards, their comment, the corrected public generator credit URL, and a Splats-only
guard retaining bundled short samples' tier-sized textures. The unchanged fidelity test exposed the
shared-video path selecting the native size in Splats; its sample, GIF, and short-video assertions
pass after the guard. Native Sharp pictures remain unchanged. The retained-picture request/eviction
scheduling change is described below; construction outside the cache function is byte-identical. All
nine native video inputs in the fourteen-case corpus explicitly report zero rotation and no flip;
the other inputs use retained GIF or sheet pictures. Their existing pixel paths are unchanged.
Reversing only these small changes reproduces all ten captured application files byte for byte. The
exact proof, input hashes, and before/after worker results accompany the ledgers. Cadence, startup,
and live recordings use the measured runtime hash
`79ff139b207d8ca57abdddfbd8a59f9c1908cdc81e24737bb36d64cdc18e2109`. The published application hash
is `0fad1dd6e97fd0486ea876115f80607925b61509c6a9c6caf965cc7cd99ebfb7` (public `0e15561da`): its sole
difference from the measured runtime is the explicit-capture refresh above. Nine of the ten
application files are byte-identical, and the exact final Sharp diff is retained in
`r4-source-validation-map.json`. No capture request occurs in the clean cadence, startup-observer,
or CDP live windows; their raw measurements keep their original hash.

The candidate long-film caches were rebuilt from verified interior source times, using the existing
upload refinement's symmetric, color-gated half-second window, one clip-wide depth range, and the
same model. Original video bytes and runtime depth resolution are unchanged. Whole-film validation
and visual comparisons decide whether each candidate remains. Bunny's first complete phone run
reduced height jitter from the earlier round 4 run's 0.004027 to 0.002325 and flips from 1.7356 to
0.3510 per 1,000 still pixels; it also exposed the support-cell defect above, so that run is not
accepted as the final coverage proof.

A still-camera recording exposed a separate scheduling defect. With rendering no longer slowing its
update clock, a busy short-clip worker repeatedly started work on a frame that had already passed by
completion. Preparing the measured round trip ahead avoids that starvation; drawing still accepts
only the exact current depth-array identity. Ready Sharp pictures explicitly request a render, while
the existing signature suppresses duplicates and the stage retains its rendering holds and WebGPU
queue gate.

Long clips also need a usable deadline when processing itself exceeds 250 ms. The latest matching
bitmap and depth can now use their measured round trip plus two source-frame intervals, bounded at
one second; ordinary short trips retain the 250 ms limit. This trades bounded presentation delay for
continued motion under heavy load. It does not pair a fresh picture with old geometry, add a
decoder, reduce source resolution, or change reconstruction arithmetic. The current regression adds
a controlled 160 ms numeric-worker delay, disables camera idle motion, ignores initial draws, and
requires continued real front-surface draws for a short video, an MP3 sample, and a long film.

The first complete clean timing pass exposed a retained-picture cache defect on Bridge: its update
callbacks were fast, but its bound picture clock advanced about 9 times per second, against
main's 15. FIFO eviction discarded nearer geometry while filling farther lookahead. The
retained-picture path now keeps nearer display deadlines, prioritizes the next picture, and defers
rejected far packets until the playhead or cache capacity changes. Native video retains its previous
freshness policy. One numeric worker and the 24 MiB target remain. The new controlled-transport
regression overfills that target and requires the nearer packets to remain available without
repeatedly rebuilding the rejected far packet.

## Picture protocol

The quality sweep visits every original source frame, including the original GIF timeline, with the
same source hashes, camera, and source clocks. JPEG-sheet samples use their actual retained sample
frames. A native source witness rejects stale pictures; round 4 must also show the exact current R8
input on every accepted frame.

Hole share and isolated bright edge specks use round 3's independent coverage and source-witness
measures. The worst frame and maximum speck count are reported, not only a mean. The complete
original surface indices remain available as the coverage oracle independently of the optimized
grid.

Height jitter is the average normalized depth change where RGB changes by at most 8 levels per
channel in squared mean. Edge flips count changes above 0.15 per 1,000 such still pixels. These are
depth-stability heuristics, not ground-truth reconstruction or an independent acuity score. Main's
long-video depth estimates are sparse (one per second on low, two on mid), interpolated and
displayed on its retained clock. Round 4's bundled long caches contain 24 estimates per second. A
zero baseline flip count can be matched but cannot be strictly improved.

For temporal comparison, both versions measure the R8 field actually displayed. Main can hold its
prior uploaded R8 between retained-frame changes; those holds are recorded rather than silently
replaced with a fresher field. Round 4 additionally requires exact input correspondence. Older
retained-field tables are not substituted for these results.

The complete final sweep covers **28/28 cases and 7,102 original source frames**. Every case has
zero detected holes, edge specks, and depth-input mismatches, with no browser errors. Its
application hash is `2b23383b800065b10385c77c0da6245053c5bbd60a5ba35c105fba87f54347e4`; the runtime
equivalence and Splats-only change are documented above. Against main, both coverage proxies improve
in all 28 cases. Average depth jitter improves in 27 cases and worsens in one; large edge flips
improve in 22 cases and worsen in six. This is not a universal temporal-stability win. The detailed
[measurement tables](moving-photo-r4-measurements-2026-10.md) retain every case and source pin.

## Playback and startup protocol

The clean speed run uses one browser with no competing tests, model-baking jobs, quality sweeps, or
encoders. A rejected first attempt exposed an unavailable kernel child-process file: two existing
test files were still finishing when its first timing browser launched. The entire partial attempt
is retained separately and excluded. The corrected process-parent graph drains the test children and
explicitly requires zero active Chromium processes before launching the first timing browser. It
keeps round 3's two-second warmup, twelve-second short windows, and thirty-second long windows. A
full clean pass covers all fourteen inputs, with one additional Bunny/Horse pass to assess the
closest comparison with main. It reports frameend update intervals, actual postrender intervals, and
bound-picture-clock submission intervals separately. A fast update callback alone does not establish
fast visible playback; a 10 fps source also cannot supply 20 distinct pictures per second. Native
bitmap clocks are their frozen presentation timestamps; a directly bound video uses its
media-element clock, and a retained source uses its frame index. Clock changes are not an
independent pixel-uniqueness measurement. Browser decoder counters and live presentation recordings
are reported separately.

Instrumented runs add inclusive JavaScript costs for the clip pipeline, buffer and texture uploads,
mip work, sorting, and draw submission. Parallel worker phases are reported separately and cannot be
added to inclusive page costs. Worker phase samples are the bounded most recent 120 completed
frames. Native media tracing retains available browser events; overlapping wall durations are not
invented decoder CPU costs. These instrumented runs are separate from the clean cadence table.

Startup uses a fresh page and worker per case and records the first actual postrender whose mesh
owns the requested clip and a usable picture. Its device-draw observer also requires a valid shader
and a nonempty submitted front-surface index buffer belonging to that mesh. A single WebGL finish
fence waits for that first draw to complete; submission time and the additional completion wait are
retained separately. That wait is not an elapsed GPU profiling measurement. It does not wait for all
background refinement to finish. Opening the default toy starts the clock before observer module
preparation, including that overhead in both versions; other clips start with the default toy
already open. Startup repeats each input three times; the median and range, plus errors, are
reported. Startup observer validation passed on a sample and a local MP4, but its concurrent timings
support no speed claim.

The final clean pass improves all fourteen update medians against main. Twelve meet both the
Operator's 50 ms median and 250 ms worst ceilings; Bunny's 54.3 ms and Bridge's 60.0 ms medians miss
the first ceiling. Bridge's bound-picture clock advances at 13.92/s against main's 15.08/s, and long
Bunny at 9.93/s against 10.60/s. Fast callbacks therefore do not establish universal playback
parity. One additional paired Bunny/Horse run is retained without replacing the first-pass results.

All fourteen startup medians improve over three fresh contexts per version, with 84 launches and
zero observer errors. Default Bunny falls from 9,726 ms to 1,060 ms; the five original local files
fall from 7.3–15.3 seconds to 1.6–1.9 seconds. These are first usable completed front surfaces, not
completion of every background refinement step.

The fresh instrumented traces show Bunny's inclusive page geometry at 150.41 ms/update in round 3
and 1.28 ms/update here. Long Elephants Dream spends 146.82 ms/update in round 3's `longFrame`,
including 104.70 ms in canvas drawing, and another overlapping 92.48 ms in geometry construction.
Here its page geometry costs 0.93 ms/update; posting worker requests still costs 20.62 ms/update.
The most recent 120 long-worker packets average 77.04 ms each, separately from page costs. Their
accepted matching pictures have a median media-clock age of 200.65 ms and a worst of 382.64 ms.
Those ages are not physical speaker-to-screen latency. Inclusive rows overlap and must not be
summed.

The matched long trace exposes 1,548 native VP9 decode calls in round 3 and 765 here, with total
function wall durations of 1,618.77 and 1,388.33 ms. These overlapping wall durations are not
additive decoder CPU costs. H.264 function durations are not exposed. GPU elapsed queries are
unavailable; no zero GPU cost is inferred. Unvalidated raw PlayCanvas timing fields are excluded.

[Complete quality, cadence, startup, page, worker, and native-media tables](moving-photo-r4-measurements-2026-10.md)
accompany the raw ledgers and compressed native traces on the clips branch.

## Verification

The full suite runs unchanged through `tools/suite.mjs --jobs=2 --gl=llvmpipe`. Its existing
timing-sensitive files run alone at the end, and its existing graphics-backend exceptions remain
unchanged. Initial failures are preserved; isolated reruns are separately labeled rather than
erased.

The initial full run uses Node 24.19.0. Two unchanged QR hash assertions fail there but pass under
CI's Node 22 major version (verified official Node 22.14.0 archive). The drained scheduler resumes
its remaining files under Node 22.14.0, and final whole-file rechecks use that version. All original
reports remain. Six existing Node test files outside Playwright's spec pattern also run unchanged
under Node 22: sixteen tests pass, with zero failures or skips. Their file hashes match main, and
their original TAP and runtime record are retained.

Focused checks already completed:

- Six initial round 4 tests: five local formats on the phone, all 81 sample pairs, scalar/WASM pixel
  parity, current drawn depth/geometry, missing native frame notifications, and long bitmap/depth
  pairing: **6/6 passed**.
- Original round 3 regression file: **16/16 passed**, including WebGPU, thin foreground, oblique
  cuts, preview cancellation, cached sample selection, and same-frame R8 upload checks.
- Indexed-cap and raster proof: **3/3 passed**. On both profiles, three sample inputs, three camera
  yaws, and two times, optimized, full-raster, both-cap, and original-cap renders were
  pixel-identical with zero holes or specks. C and JavaScript raster bounds also agreed on 640,000
  generated faces.
- Native display-aspect regression: **1/1 passed**.
- Transferred-frame retirement regression: **1/1 passed**.
- Final timing correction, live pairing, pause, and retirement: **4/4 passed**.
- Current scheduling, drawn-depth correspondence, native aspect after pause, and delayed frame
  callbacks: **4/4 passed** after the still-camera fix. The still-camera test includes controlled
  worker delay, not a clean playback benchmark.
- The unchanged complete kit file: **10/10 passed** after the DOM-free long-sample preparation fix.
  The three newly merged test files and the comparison-engine file also passed.

The original new round 4 files passed **18/18**. The added eight-transform regression and controlled
cache-deadline regression also passed; the expanded seven-test raster file passes its complete final
rerun at the measured runtime hash. Together with the thirteen-test moving-photo file, the final two
new files contain twenty regressions. The unchanged decode, mobile, actual-texture, and round 3
files also passed **7/7**, **2/2**, **7/7**, and **16/16**, respectively. The legacy Moving photo
file initially passed 13/14; its late-observer and explicit-capture regressions are fixed without
changing the test. Its complete rerun passes **14/14** at the first explicit-capture pin
`b931bb7b456e8bd45cfa02ab389a54b8564b11ac6de973845855f298331138f1`. The later active-view guard
passes the same unchanged paused-seek assertion at the published pin; it excludes hidden clip meshes
from other toys' captures. The final thirteen-test selection-file rerun is recorded in the ledger.

All short samples and all five original uploads improve both reported temporal measures on both
profiles. The unresolved jitter result is long Elephants Dream on phone. The six worse edge-flip
results are all four long films on phone, plus Sintel and Elephants Dream on desktop. These
exceptions remain explicit in the per-case table.

The full run supersedes focused results where source pins differ. The final test ledger lists each
file's counts and all reruns.

The unchanged PDF file initially failed because the local range server served `manifest.webmanifest`
as an octet stream. Its standard `application/manifest+json` MIME type fixes that navigation, and
the complete unchanged file then passed **9/9**. This is a test-server fix, not a change to the PDF
product path.

### Photo to 3D

Eleven core Photo functions in the shared Sharp module are byte-identical to current main, and
Photo/depth/relief files are unchanged by round 4. The full run includes `psv*`, `p3d*`,
`cdx-p3d2-*`, `phf*`, `pdp*`, `cdx-pics*`, and main's newer Photo regression families. The 51-test
Photo scan file passed. Complete family counts are pending.

Main already differs from the October 14 Photo checkpoint in ten Photo/depth files. This branch
carries those upstream changes; it does not claim the whole current Photo implementation is
byte-identical to that older checkpoint. Neither checkpoint branch is modified.

## Trials that did not ship

- Removing camera-facing caps or walls opened 1–22 hole pixels. Both sides remain.
- A one-cell support margin left a Bridge hole pixel. Two cells later left a Bunny pinhole; the
  final margin is four cells.
- A depth prepass, texture-based vertex depth, matrix pose rewriting, and CPU occlusion work failed
  to produce a useful speed gain in their probes.
- Bilateral fallback regularization and guiding from the depth estimate's own source colors did not
  solve long-video stability. They are excluded.
- Motion-compensated five- and nine-frame depth filters reduced large changes in the first 96 Bunny
  frames, but did not match main and could change layer geometry substantially. They are excluded.
  Their limited two-picture coverage checks do not establish whole-film quality.
- Holding baked native depth without interpolation increased large flips in that probe. The normal
  interpolation remains, with corrected baked key times.

The retained cache rebuild uses each original source-frame interior rather than an ambiguous
frame-boundary seek, the browser's high-quality model-size resize, one clip-wide range, and the
existing upload refinement's radius-12 color-gated window. The first complete Bunny phone pass
reduced jitter to 0.002325 and large flips to 0.3510 per 1,000 still pixels, with zero holes and
specks after the support-cell fix. Its large-flip count remains above main's zero. Full final
per-case results decide which caches remain.

A general deadline policy worsened Bunny's update median to 78.5 ms; a two-worker trial was also
slower. Both are cut. The retained-picture pilot measured Bunny at 63.7 ms and Bridge at 64.3 ms,
with Bridge's source-clock submissions rising to 12.9 per second. That pilot still falls short of
main's Bridge clock rate, and is not substituted for the final fourteen-input pass. All three exact
trial patches reproduce their recorded application hashes. Only cache request and retention behavior
changed; the geometry module before and after the cache function is byte-identical to the
quality-capture pin. Full pixel regressions are rerun on the final runtime hash.

An isolated single-texture-lookup wall-shader trial showed no reliable speed gain and was discarded.
No production shader change from that trial remains.

## Evidence, licenses, and limits

The five new inputs are original two-second procedural clips: MP4 with an original tone, WebM, MOV,
GIF, and 60 fps WebM. Their generator is `tools/cdx-mp2-r4-inputs.mjs`. They contain no people,
external images, models, or music. Original assets are CC0 1.0; code is MIT, credited as made by
Ryan with Codex (GPT-6). Records, hashes, and attribution are in `tools/assets.json`, `CREDITS.md`,
and the app.

Existing film and license pages were rechecked. The existing Tears of Steel people and
long-file-size exceptions are already approved in
[the Operator's comment](https://github.com/ryanjosephkamp/splashery/pull/560#issuecomment-6130226869).
No new exception is requested.

The review films are silent phone-size exports of verified source frames. They preserve source times
to within one millisecond; they demonstrate picture quality, not live frame rate. Separate live
timing ledgers measure speed. Every film keeps its source author, license, source page, input hash,
and transformation record. Author, license, and source links are also embedded in the MP4 metadata;
a short export pilot verified those tags without changing frame counts, timestamps, or holds.
Individual PR images stay below 1 MB. The final fourteen comparison posters were reviewed as two
contact sheets: all show the intended subjects, and the solid borders retain the source picture.
Contact-frame review and timestamp validation do not amount to watching every film continuously.

All 94 measured input-hash records match accessible public commits, including bundled depth assets.
Main lacks the four long-film shelf inputs and the five original local files; those unchanged native
inputs are identified from the public runtime commit instead. The input verification ledger records
each exact revision and SHA-256.

The separate
[clips branch](https://github.com/ryanjosephkamp/splashery/tree/codex/moving-photo-r4-clips)
contains the phone films, responsive gallery, original per-frame JSON ledgers, source and input
hashes, compressed native traces, and original compressed Playwright reports. Each compressed report
records both compressed and original SHA-256. Earlier failures and rejected trials remain available.
The primary branch has no gallery movies or test-report bulk.

Rule check: none.

# Phone speed, October 2026

Task: [103, faster toys on phones](../codex/103-phone-speed.md). Codex built the measurement tools,
local phone page, and shared rendering optimization.

All 15 frozen targets pass five-pair timing and appearance checks: idle-median improvements range
from **29.6% to 55.3%**, with a **48.5% median**. Thirteen targets are RGB-identical at rest and
mid-tap. Minimum SSIM is **0.995246** at phone width and **0.994008** at native width. All466
current toys have before/after first-view, idle/tap frame-time, heap, and transfer measurements. Two
confirmed tap-p95 regressions are corrected with narrow recipe opt-outs, each checked with ten fresh
pairs and exact RGB comparisons. Most declared catalog follow-ups remain incomplete, so **the
complete goal is not met**. The following checkpoints retain their original dates; the PR and raw
branch record the latest follow-up counts and CI status.

The initial survey and early pairs were retired after finding that Chromium implements WebGL
`finish()` as a flush rather than a wait. Only the corrected synchronous-readback measurements are
final timing evidence. The corrected ranking and 30-toy phone list were frozen at 06:17 UTC on
October 17, 2026.

## Run on a phone

From this checkout, serve the repository on your local network:

```sh
SPLASHERY_HOST=0.0.0.0 node tools/cdx-mp2-server.mjs 4173
```

On a phone on the same network, open
`http://<your-computer's-LAN-address>:4173/tools/pages/phone-speed.html`. Tap **Start run**, keep
the tab visible, and let the phone cool between runs. **Copy table** copies tab-separated values;
**Save JSON** downloads the full measurements locally. **Stop** retains completed rows. Switching
away from the tab stops the run. Nothing is uploaded or saved automatically. No physical-phone
measurement has been inferred from the software renderer.

For an original-runtime phone check, keep the same benchmark page and frozen list while serving that
runtime in a separate checkout. From the candidate checkout:

```sh
git worktree add --detach ../splashery-phone-before ceb51de7a015377d7f350119c27a792fc1a8a66d
mkdir -p ../splashery-phone-before/tools/pages
cp tools/pages/phone-speed* ../splashery-phone-before/tools/pages/
cp tools/cdx-mp2-server.mjs ../splashery-phone-before/tools/
cd ../splashery-phone-before
SPLASHERY_HOST=0.0.0.0 node tools/cdx-mp2-server.mjs 4174
```

Open the same phone-page path on port 4174 for before and 4173 for after. Keep both local servers
running, use the same browser, and save each result before starting the other run. The app runtime
in the original checkout remains unchanged; only the measurement page and server are copied.

## Source provenance

GitHub rejected the initial publication because the checkout's commit email was private. The
original local branches and commits remain intact. This public branch adds new commits to public
main using GitHub's noreply address; no existing commit or branch history was rewritten, and no
force push was used.

The raw measurements retain their original local source IDs. Original runtime
`36f5df601963f418f71b98ee460783ea6191b0bc` has the same app bytes as public main
`ceb51de7a015377d7f350119c27a792fc1a8a66d`. The raw branch's `measured-runtime-072.patch`
reconstructs the original measured candidate from that public base, without commit metadata.
`runtime-manifest.json` records every runtime file's SHA-256. The target recipe bytes match the
measured candidate. A subsequent Engine compatibility fix makes cache invalidation optional for
direct uniform uploads from minimal Stage adapters; normally constructed Stages invoke the same
cache method. All nine unchanged bounds tests and all 16 speed tests pass with that fix. The first
full-suite failure is retained. Incoming main's Neuron specimen passes a separate ten-pair
source-pinned comparison, including every timing metric and matched hardware. These mappings
reproduce the measured code without exposing private commit metadata or relabeling observations as
new runs.

## Earlier work

Task 06's [audit](perf-2026-10.md) measured 342 toys at phone and desktop sizes using the Mac GPU.
Its frameend cadence includes update-only loops, so those intervals are not comparable with this
task's completed draws. Task 51's
[reviewed PR](https://github.com/ryanjosephkamp/splashery/pull/588), opened on October 17, 2026,
reports lossless loading work, a partial top 20 measurement, and unmet strict loading targets. Its
audit is absent from this checkout; the PR's actual verification and limitations were read directly.
This task collects a fresh complete baseline and keeps existing loading paths.

## Method

The runner uses the normal app opening path for every catalog toy, including labs. Each toy gets a
fresh Chromium context, a 390×844 CSS viewport, device scale 3, WebGL2 on SwiftShader,
`profile=weak` (the low tier), and `adapt=off`. The low tier applies its existing 1.5 canvas
pixel-ratio cap unless a recipe overrides it. Video to 3D requests native DPR, producing a 1170×1401
drawing buffer in the original survey. The candidate low-tier Liberty recipe caps this explicit
fixed-resolution view at DPR 2.4 (936×1120). Photo album caps its low-tier view at DPR 1.3, changing
585×700 to 507×607. Both exceptions require native-width evidence; all other surveyed buffers remain
equal. No browser CPU or network throttling is requested. The host enforces a four-core quota. Runs
use local HTTP, whose transfer size is not the compressed public site's transfer size. HTTP caches
are fresh per context; the screening browser's GPU and shader caches can be shared across contexts.

First view is measured from navigation to the app's first loaded-toy draw signal, followed by a
synchronous 1px RGBA readback from the default framebuffer. The previous read binding is restored.
The two photo toys default to a sharp relief mesh with splats disabled, so their splat-only app
signal never fires. A benchmark-only probe instead requires their loaded toy, visible default relief
mesh, submitted mesh draw, and the same synchronous readback at frame end. It never switches views.
This is a completed WebGL draw, not a compositor presentation timestamp.

A toy warms for 1.2 seconds. Idle and tap windows each last at least 2.5 seconds and contain at
least eight completed-draw intervals. Only postrender callbacks with submitted GL draw calls
qualify; each waits for synchronous readback. Rendering is forced during those windows. The photo
benchmark also overrides its duplicate clip-picture draw veto only during sampling and removes the
override afterward. Native playback time remains active. Synchronization overhead is included. The
median is completion spacing; sustained throughput can differ when intervals are bursty. Raw
intervals, elapsed time, and p95 remain available. A real tap action starts the second window.
Audio, automatic camera rotation, and idle pokes are off; recipe motion remains active.

The initial use of `gl.finish()` was incorrect:
[Chromium's implementation, opened October 17, 2026](https://chromium.googlesource.com/chromium/src/+/151.0.7922.173/third_party/blink/renderer/modules/webgl/webgl_rendering_context_base.cc?format=TEXT),
explicitly calls `Flush()` instead of waiting. That entire survey and all early pairs remain in the
raw evidence but are retired. The completed corrected survey used the same predeclared idle-median
ranking rule and froze the final IDs again. Every final timing row must identify synchronous
readback and a readback first view; old rows cannot satisfy the gates. Repeating the survey exceeds
the initial three-hour screening allocation.

Heap is live JavaScript heap, excluding GPU memory and other process memory. Chromium also gets a
CDP heap breakdown. The phone page shows **Unavailable** when its browser exposes no heap API; its
heap can include the parent results page. Resource Timing supplies transferred bytes, encoded body
bytes, request counts, and cache hits. A physical-phone run uses browser-managed caches.

The 15 targets are the largest **idle median draw intervals** in the complete original survey. That
selection metric was declared while 67 of 465 rows had been collected, before target IDs were
frozen. Opening, idle p95, and tap median/p95 remain separate measurements and regression checks.
The phone list includes all 15 targets and fills 30 places from the worst remaining opening and tap
cases. Software GL supplies relative evidence, not a phone frame-rate prediction.

Repeated target comparisons alternate original/candidate and candidate/original order, with a fresh
browser per sample. Both sources run sequentially on the same machine; no other GPU jobs run beside
timing. Per-toy medians are computed from all repetitions, retaining failed samples. The target
gates require at least 25% lower idle median for every target and at least 30% median improvement
across the 15.

The gate requires each expected pair index exactly once in both phases, validates every sample's
timings, and rejects changed point counts, profiles, or viewports. Canvas sizes must match except
for the exact, predeclared Video to 3D and Photo album resolution changes. Both exceptions also
require rest and mid-tap SSIM at 1170px width, in addition to the 390px comparison. Undeclared
canvas changes fail. Five target pairs are required; unrelated screening rows use one run. Follow-up
counts are declared explicitly in the comparison's repetition plan. Resuming paired work checks the
served sources, URLs, browser version, duration, runner hash, shared measurement-module hash, and
hybrid-helper hash.

After the original ranking survey, a matched one-pair survey opens every toy on both sources in
fresh browsers, alternating source order by toy ID. This reduces drift between the full catalog's
original and candidate measurements. Five target pairs are collected first; pair zero is then reused
in the complete matched survey. The matched survey screens for unrelated regressions. Every
unrelated toy flagged by any timing metric gets five new alternating pairs of the same protocol.
Both original and candidate samples are retained, and their repeated medians replace that toy's
screening estimates for the final regression gate. Samples are never selected by fastest result. A
toy still over 5% after five pairs gets five further pairs; its final result uses all ten. Any
remaining regression is reported, investigated, and fixed or left as a failed gate.

The phone page gives each toy temporary, empty preferences, preserving the owner's saved settings.
Chromium's resize-delivery notifications without an exception are retained separately in JSON;
actual exceptions still mark the row as an error, even with the same message. A regression verifies
both paths and a real thrown exception. The first 30-toy QA attempt mislabeled these notifications;
its full measurements and logs are retained, and QA repeats after the reporting fix. Its metadata
records the device's color scheme and reduced-motion preference. The original survey's first 67
setup samples were conservatively archived and repeated after a stopped browser's orphan GPU process
was eliminated; the possible overlap interval could not be bounded precisely. Their replacements
determine the final ranking. Later test-run intervals were checked against the timing records, and
GPU jobs run only after a measurement boundary.

## CPU quota and comparison groups

The host exposes five CPUs with a four-core quota. Active observation recorded throttling in2800
of4133 quota periods (67.75%). At08:58:03 UTC, at a complete-pair boundary with no browser open,
future benchmark parents were restricted to CPUs0–3. The subsequent observation records32 of2048
throttled periods (1.56%). Existing complete groups retain their original CPUs0–4 configuration. New
samples record observed parent affinity, with direct browser observations where available.

Each toy's before and after repetition group must use a single matching configuration; the final
report rejects mixed or missing post-transition hardware records. The CSV identifies CPU affinity.
The original ranking survey and completed target pairs retain their original configuration. No
samples or thresholds are discarded. Compare each toy's paired values; the raw original survey
retains a uniform setting for ranking across toys.

## Rendering change

PlayCanvas marks a splat placement dirty on every `setParameter`, even when the value is unchanged.
Previously, the player reassigned all work-buffer parameters and requested an unconditional work
buffer update. Large, unchanged scans therefore reran their surface shader on every forced draw. The
candidate snapshots numeric uniform arrays and compares their contents, including reused, mutable
typed arrays. A settled surface uses PlayCanvas's automatic update policy. Changing its look, pose,
parts, or camera-dependent parameters invalidates the cache.

Active effects, clock-driven splat behaviors, painted surfaces, primary live textures, custom
modifiers, and spherical-harmonic resources retain the existing update path. Picture toys can reuse
their unchanged primary body; their separate media sheets and sharp faces retain unconditional
updates. Rig stream writes explicitly invalidate the work buffer. The pinned renderer still performs
its normal view sorting and drawing. The cache preserves splat counts, geometry, resolution,
shaders, recipe motion, and tap actions.

Video to 3D is fill limited in the explicit `?adapt=off` benchmark path, which bypasses the normal
low-tier cap and lets its native-DPR recipe draw at 3. Its low-tier default Liberty sample now caps
that path at 2.4. Ordinary weak-profile viewing already caps at 1.5, so this change does not
establish a speed gain for that ordinary path. Normal/high tiers and other sources retain native
DPR; URL DPR settings still win. The trained splats, opacity cutoff, camera path, and Replay stay
unchanged. Conservative shader bounds, alternate polygons, constant-color interpolation, exponential
approximations, and lookup textures did not provide enough speed and are excluded. Higher opacity
cutoffs were rejected after faint sky changes were observed. The resolution change is checked at
both 390px and 1170px width; it is not described as pixel-identical rendering.

Photo album entered the corrected final ranking. Its static book body previously shared the
conservative exclusion for all picture media, although those textures live on separate sheets.
Allowing primary-body reuse, with all sheet updates preserved, improved the three-pair pilot median
by 16.6%, short of the target. The remaining overlapping page fill motivates a low-tier DPR 1.3
recipe cap; higher tiers keep the existing settings. Geometry, photos, page turns, and point counts
remain unchanged. The final five pairs improve its idle median by 29.6%; minimum rest/mid-turn SSIM
is 0.999022 at 390px and 0.998640 at 1170px.

Focused regressions verify both parameter invalidation and actual primary-surface work draws:
unchanged draws skip the work pass, while a look change or tap runs it. Separate regressions cover
imported spherical-harmonic color updates, post-load rig tagging, mutable arrays, and unknown shader
behaviors.

## The frozen 15

Each row uses the median of all five original samples and all five candidate samples. The original
ranking is unchanged. “SSIM” is the minimum of rest and mid-tap at 390px; both native-width poses
also pass. These software-renderer intervals include synchronization overhead.

| Toy                    | Primary splats | Original idle ms | Candidate idle ms | Improvement | Minimum SSIM |
| ---------------------- | -------------: | ---------------: | ----------------: | ----------: | -----------: |
| `crochet-earth`        |        300,000 |           836.30 |            464.75 |      44.43% |     1.000000 |
| `sunflower-photo`      |        300,000 |           806.30 |            500.25 |      37.96% |     1.000000 |
| `toy-trex`             |        300,000 |           759.25 |            431.55 |      43.16% |     1.000000 |
| `monkey-doll`          |        300,000 |           767.05 |            393.90 |      48.65% |     1.000000 |
| `cherry-blossom-photo` |        300,000 |           704.10 |            345.10 |      50.99% |     1.000000 |
| `dog-plush`            |        300,000 |           715.40 |            420.05 |      41.28% |     1.000000 |
| `cone-shell`           |        300,000 |           607.25 |            271.15 |      55.35% |     1.000000 |
| `desk-globe`           |        293,009 |           741.90 |            389.20 |      47.54% |     1.000000 |
| `bmx-bike`             |        300,000 |           766.70 |            363.50 |      52.59% |     1.000000 |
| `mushroom-photo`       |        300,000 |           714.70 |            367.90 |      48.52% |     1.000000 |
| `cave-lioness`         |        300,000 |           708.75 |            360.45 |      49.14% |     1.000000 |
| `murex-shell`          |        300,000 |           615.05 |            288.25 |      53.13% |     1.000000 |
| `video-3d`             |         59,682 |           761.90 |            494.25 |      35.13% |     0.995246 |
| `maple-tree`           |        300,000 |           732.35 |            332.95 |      54.54% |     1.000000 |
| `photo-album`          |         55,308 |           659.55 |            464.35 |      29.60% |     0.999022 |

The 13 captured targets retain 293,009–300,000 primary splats, above the general low-tier procedural
budget of 120,000. Their addon layers retain 0–60,003 splats. The existing lite capture files are
3.54–3.80 MiB; no point data or opening assets were changed. CPU update medians in the three-draw
rest diagnosis are 0.3–2.2 ms before and 0.3–0.8 ms after, far below the hundreds of milliseconds
per completed frame. Each target's unchanged primary work pass goes from **3/3 to 0/3 actual
draws**. View sorting and effect updates remain active. The evidence supports redundant surface work
as the shared idle bottleneck; worker startup, moving-part sorting, and opening transfers were not
removed.

Video to 3D retains 59,682 splats and Photo album 55,308. They also need the two declared low-tier
resolution caps described above. Their minimum native SSIM values are 0.994008 and 0.998640. Their
controlled rest and action stills were inspected at both sizes, with no apparent visible change;
their action poses differ from rest. No claim of exact pixels is made for these two toys.

The five-pair table does not claim every metric improves for selected targets. Sunflower photo's tap
median/p95 increase 5.15%/6.84%, Monkey doll's tap median increases 6.26%, and Desk globe's tap
median/p95 increase 5.84%/6.76%. Their active taps retain the original conservative work path. These
results remain in the raw evidence and are disclosed independently of their passing idle target. The
unrelated-toy gate checks every timing metric for the remaining 450 toys.

## Evidence and checks

Visuals use scene seed 103, a fixed calendar time, reset motion clocks, 60 fixed CPU steps per
simulation second, and three completed draws before each still. Animation timers and
`performance.now()` remain native. The harness rebuilds the recipe after its diagnostic orbit, then
compares the same rest pose and half-action pose on both sources. It compares the canvas at 390 CSS
pixels wide, retaining full device-scale phone screenshots and 1170px-wide canvas comparisons
separately. Reference runtime errors, protocol differences, and mismatched controlled clocks
invalidate the comparison. RGB equality, PSNR, and 11×11 Gaussian luminance SSIM are recorded, with
8× absolute RGB difference images.

Two-toy calibration after the review fixes produced exact RGB matches and SSIM 1.0 at both poses for
`torus` and `toy-trex`. These are harness checks, not the final 15-toy gate results.

Completed: all 15 five-pair comparisons and both poses at both visual widths. The complete30-toy
phone-page run passes with zero application errors and no upload requests. Copy, local JSON
download, clipboard fallback, Stop retaining completed results, and desktop layout all pass. The
four390×844/1440×900 screenshots were inspected; the phone table scrolls horizontally within the
page. Thirty no-exception browser resize notifications remain in the JSON. The matched catalog is
complete; unrelated follow-ups and a successful full existing suite remain unresolved. Full
preflight passes all271 checks, and embed transfer is9.2MiB. All finish-only rows and prior freezes
remain preserved as retired evidence. Raw runs and stills belong on `codex/phone-speed-clips`, which
is never merged.

## Four-hour progress

October 17, 2026, 06:08 UTC: the corrected original survey has 404/465 toys and no errors. The phone
page and candidate changes are implemented. All 14 focused specs passed with the readback
correction; the subsequently strengthened visual-gate tests also pass. Final target gains, SSIM,
complete-catalog regression results, the full existing suite, and preflight remain pending. The
survey repeat exceeds the original three-hour screening allocation; no retired timing is final gate
evidence.

## Eight-hour progress

October 17, 2026, 10:08 UTC, eight-hour progress note: the corrected original survey covers all 465
frozen toys, and 210 have matched candidate pairs. All15 targets pass five-pair speed and appearance
checks: minimum29.6%, median48.5%, minimum native SSIM0.994008. The complete30 phone-page QA passes,
including copy, local export, Stop, and both viewport sizes. Incoming main adds one Neuron specimen;
all ten pairs pass every timing and matching-hardware gate. The first full suite found four existing
bounds-test failures caused by direct uploads on minimal Stage adapters. The compatibility guard
passes all nine unchanged bounds tests and all16 speed tests. Current main is merged. Full preflight
had269 passes and two fixture-origin failures because these unchanged PDF tests hard-code port4173;
the candidate is now served on4173 for a complete rerun. The first failed run is retained. A
workspace disconnect preserved completed data; interrupted metadata is archived, and timing will
resume with the same four-CPU affinity. The complete catalog, prescribed five/ten- pair follow-ups,
full existing suite, and final preflight remain pending. The complete goal is not yet claimed, and
the original twelve-hour task clock continues.

## Validation checkpoint

October 17, 2026, 10:18 UTC: full preflight passes all271 checks after current main is merged. Its
first run on4177 had269 passes and two PDF fixture-origin errors; the unchanged tests hard-code
4173, and the complete rerun on4173 passes. Both runs and first-run failure artifacts are retained.
The existing embed transfer test passes at9.2MiB. All nine unchanged bounds tests and all16 speed
tests pass with the Stage adapter fix. The generated showcase facts were refreshed after the
pictures recipe grew by0.1KB raw and compressed; its unchanged test passes. The full existing suite
is requested at
[run39024250162](https://github.com/ryanjosephkamp/splashery/actions/runs/39024250162) on
commit3a0b972d721606d8947187816c8aa003f0a8d83c. No passing full-suite result is claimed yet. Catalog
timing has resumed from210 complete pairs, with the original runtime hashes verified and all new
parents on CPUs0–3. The complete no-other-toy-slower gate remains pending.

## Catalog and regression checkpoint

October 17, 2026, 12:21 UTC: all465 original matched comparisons are complete, with positive heap
and transfer values, valid completed-draw timing, and matching hardware. Together with Neuron's
ten-pair supplemental comparison, the table covers all466 current toys. The initial one-pair screen
flags307 unrelated toys on at least one timing metric. This is a screening result, not307 confirmed
regressions. Fifteen flagged toys have complete five-pair follow-ups; three have complete ten-pair
follow-ups. Cactus passes using all ten. Cookie and Torus retain tap-p95 increases of7.58% and7.95%
using all ten, although their idle medians improve43.36% and29.39%. Their cause is unresolved; no
unsupported correction or passing no-regression claim is made. The other declared follow-ups
continue under the original protocol, with all samples retained.

The first five pairs for Cookie and Torus were preserved byte for byte before collecting five more
pairs early, while the bulk run was paused at a complete pair with no browser open. The additional
pairs were copied back for reuse in the declared ten-pair phase. Only their scheduling changed.

The current full-suite run has15 completed shards:373 files,3199 passed tests, one failed test, and
one skipped test. The remaining shard is still running. The failure is the unchanged30ms first-tap
audio-start assertion in `sndc-engine:122`; it passed the workflow's isolated retry but continues to
count as failed. A whole-shard retry must wait until the run finishes. The initial failure and retry
logs are retained.

Git and direct GitHub API connections from this workspace return HTTP503, while the repository
connector still reads Actions results. The implementation is already published through3a0b972d7;
newer documentation and raw follow-ups remain local until publication recovers. An attempted
connector commit did not verify the owner's public noreply identity, so no ref was moved. No
private-history commit was pushed, and no history was rewritten.

## Full-suite retry

October 17, 2026, 12:28 UTC: all399 spec files reported:3409 passed tests, two failed tests, and one
skipped test. Besides `sndc-engine:122`, the unchanged `shp:131` cross-page pixel comparison failed;
both passed the workflow's isolated retry. Both failures still count. The repository's documented
**Re-run failed jobs** action was requested successfully for the two whole shards and the summary,
on the exact same3a0b972d7 source. The complete original shard logs and totals are retained. No
assertion, timeout, retry rule, or workflow was changed.

The connector's raw Git-data GET endpoint subsequently exposed the actual author and committer
metadata. A prepared documentation commit has a verified public noreply identity and an exactly
reconstructed Git object. This provides a publication path despite the workspace's HTTP503 failures;
no branch ref has yet moved for that prepared commit.

## Recipe opt-out validation

October 17, 2026, 12:53 UTC: Cookie and Torus now retain the original unconditional work-buffer
updates between taps. A recipe-level `workBufferReuse: false` option selects that existing path; all
other recipes keep their prior eligibility. The ten-pair experiment includes20 fresh
original/candidate samples per toy, with the same browser, viewport, duration, source order, and
four-CPU configuration. Cookie's tap-p95 increase falls from7.58% in the cached variant to1.14%;
Torus's tap p95 is7.34% faster than its fresh original comparison. Every timing metric for both toys
is within the5% gate. Rest and mid-tap are RGB-identical at both390px and1170px widths, with
SSIM1.0. Both phone views and native tap stills were inspected. The experiment supports retaining
the original path for these recipes; no hardware-cache mechanism is asserted as proven.

The new regression fails without the opt-out hook and passes with it. All17 speed tests and nine
unchanged bounds tests pass together:26 checks. The updated full preflight is running after
confirming main still equals the already merged69cd6c993. The earlier candidate's271-check preflight
and9.2MiB embed-transfer pass remain recorded separately. Full existing-suite validation for this
updated source is required and tracked in the PR; the two earlier failed shards are also rerunning
on their original3a0b972d7 source. No test, timeout, or workflow was loosened.

The measured opt-out source is0aa72a99f4021de67c0eb461915ede1067aa193e. Its runtime bytes match the
prepared implementation exactly. `cache-optout-source.patch` reconstructs it from public3a0b972d7,
and its own runtime manifest and source proof remain with the raw data. The original cached-variant
regressions, all ten fresh opt-out pairs, and every earlier source pin are retained. The combined
current CSV identifies which measured candidate supplies each row. No original observation is
relabeled as a new commit.

The original twelve-hour cap remains in effect. Catalog collection will stop at a complete pair with
time reserved for packaging and the final report. Any remaining declared follow-up or CI gap will
keep the corresponding gate incomplete. The final PR body and the raw branch's README and
`current-catalog-gates.json` supply those completion counts.

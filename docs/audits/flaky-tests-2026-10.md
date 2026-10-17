## Summary

**Current status, 09:58 UTC:** Nine families have current-repair Actions receipts at 30/30 per
variant (420 cases). FL filled-buffer and IMG delayed-native-sort controls also passed 30/30. The
retained moving-fit control failed 1/41 before and passed 41/41 after, with fresh projection in both
phases. Mirror remains unresolved: the published combined candidate completed Actions still 27/30
and low light 30/30, with three height failures. A new candidate reduces screenshot observer cost
and batches native sampling in the browser. All 48 paired native PNG captures matched the original
dimensions and every RGBA byte, and all 211 repeated identical native model inputs produced
identical raw depth outputs. Its four original CDX/LV7 validation cases passed in 4.1 minutes;
formal 30/30 remains pending. Main `69cd6c993` is merged. Raw evidence is published through
`7680a07ef`. Full preflight and two clean full Actions runs remain pending.

**WORKING (four-hour checkpoint, 06:06 UTC):** Seven families have current-code Actions stress
receipts at 30/30 per variant; the earlier split WebGPU comparisons also passed 30/30 per toy, with
current-helper WebGPU still running. The native close-focus repair is red/green proved locally, all
13 Share tests and the existing focus-preservation test pass, and all 16 target variants pass one
complete cross-family validation run. The new mirror wait passes both unchanged clips once; formal
30/30 is still required. Source publication follows the audit formatting gate. Remaining work:
mirror and Share stress proof, retained controlled repetitions, final synchronization/preflight, and
two clean full Actions runs. The 05:28–05:50 workspace outage returned a fresh checkout; externally
backed-up proof and prepared controls were restored.

Implementation head: `cf10f12f6fd15913059124a40391f3b2df8db5c4`, including main `aedbe4433`.
Whole-repository Prettier and American English passed before publication. The new mirror helper
requires consumed native draw time and the actual current-view sort, then holds only the rendered
canvas while its PNG is copied; live video, the native worker, and player updates continue. All six
original samples and all assertions remain unchanged. Its four existing mirror validation cases
passed in 315 seconds with two workers and no burners. The earlier Share repair and all 16 target
variants were validated on `b87f6132c`; its Share stress campaign subsequently passed 30/30 per
size. The native-time-only mirror side of that earlier campaign remains diagnostic.
[Campaign 3](https://github.com/ryanjosephkamp/splashery/actions/runs/39004136389) retains
current-repair receipts for the other eight families.

Codex built this task 100 repair and stress harness. **WORKING:** started October 17, 2026, about
02:06 UTC; deadline 14:06 UTC. This remains a draft. Completion requires every variant to pass 30/30
under recorded load and two clean full Actions runs.

Published repairs observe native audio output and actual motion-tap storage, wait for the fitted
camera and its rendered projection, observe complete fluid requests, split shader comparisons by toy
at the original 240-second deadline, transport every RGBA byte losslessly, and repair two collision
races in separate Engine commits. The native-sort readiness repair reproduced and corrected the
historical image failure in a controlled probe. All current-helper WebGL image and WebGPU comparison
toys now pass 30/30 each (180 cases total).

Task 50 [#581](https://github.com/ryanjosephkamp/splashery/pull/581) supplied turntable shutdown and
camera-fit readiness. An actual completed frame is also needed to refresh the cached projection. Its
unrelated runner and test changes were not copied.

## Verification

Baseline: immutable main `ceb51de7a015377d7f350119c27a792fc1a8a66d`.
[All ten baseline families completed](https://github.com/ryanjosephkamp/splashery/actions/runs/38997782641):
10 repetitions, four fully parallel workers, two constant CPU burners, Node 22.23.3, Chromium 141.
Mesa llvmpipe was used except SwiftShader for PHY and sample audio.
[Preserved raw evidence](https://github.com/ryanjosephkamp/splashery/tree/codex/flaky-tests-clips/docs/audits/flaky-tests-raw)
is on the separate clips branch, currently `7680a07ef`; never merge it.

| Original case   |                                                                                    Before failures / completed |                                                                                              After passes / completed | Cause and status                                                                                                                                                                                                                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------: | --------------------------------------------------------------------------------------------------------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| cdx-mir:294     |                                                       Original-wait Actions: still 3/30, low light 1/30 failed |                                          Latest combined Actions: still 27/30, low light 30/30; new transport pending | Wall time misses consumed draw time; current-view sorts and held screenshots are necessary but insufficient. Protocol screenshot preparation adds uncontrolled live evolution. Exact native PNG transport and browser task batching passed four validation cases and still require formal stress.                                             |
| fl:137          |                                                            0/10 CPU stress; retained filled-buffer failure 1/1 |                                                                             30/30 Actions; filled-buffer repair 30/30 | Bounded Resource Timing loses late module entries. Complete request observation retains the original checks. The current filled-buffer repair passed 30/30 under the original controlled pressure.                                                                                                                                            |
| hh1-toys:258    |                              0/10 CPU stress; controlled camera failures observed before workspace replacement |                                                                                                         30/30 Actions | Unfinished fit and stale projection alter the unchanged gesture. Retained moving-fit control: before 40/41 passed, after 41/41 passed; fresh projection in both phases. Factor 1.02 failed the original settled limit (0.1500 > 0.08).                                                                                                        |
| shr:202         | Phone and desktop 0/10 plus 0/30 each; native close boundary 1/1 failed; new real-source regression 1/1 failed | Phone 30/30 and desktop 30/30 Actions on b87; native close repair 1/1; all 13 Share tests and focus preservation pass | The native dialog leaves Save focused inside the closed preview until a later frame, reproducing the historical false/false/false focus predicate. Explicitly blur only that closed-preview focus when Record is unavailable; visible Record and external focus are preserved. The earlier hidden-pill hypothesis was unproved and discarded. |
| hh5-gems:154    |                              Target 0/100 local; 94/100 runs had unintended intact-neighbor unpins, 224 events |                                                                                  Target 30/30; zero unintended unpins | Queued impacts can undo reseating; generic impacts can free an intact joint without breaking it. Natural target failure was not reproduced. Native collision regressions reproduce both invalid transitions directly.                                                                                                                         |
| fx4-engine:79   |                                                                                                10/10 timed out |                                                                                   All three WebGPU toys 30/30 Actions | Three old/new/new comparisons shared one deadline. Each toy now retains the original 240-second deadline and all comparisons. Current-helper campaign 3 also passed all 90 cases at source 23664b6dc4e289b50ea3035346f4a8846379ff13 (artifact 12092323603).                                                                                   |
| img-engine:85   |                                              8/10 timed out; controlled native-sort pressure 1/1 pixel failure |                                             All three toys 30/30 Actions with current helper; controlled repair 30/30 | After the camera moves, the applied worker sort can still belong to the previous view. Exact failure: 1,081 changed pixels against 220; native trace confirms the stale view. The current helper also passed 30/30 with the original delayed native-sort control.                                                                             |
| sndc-engine:122 |                 0/10 Actions; earlier local busy-runner failures, raw lost; tighter prior observer 1/30 failed |                                                                          Final observer 30/30 local and 30/30 Actions | Require decoded sample and native clock progress. Actual tap storage timestamps acceptance. Native start precedes metadata inspection; causal controls show the old observer delayed real playback, and production delays still fail.                                                                                                         |
| live2:207       |                                                                                                   4/10 Actions |                                                                                                         30/30 Actions | Wall-origin matching loses/misidentifies clicks as native audio progresses differently. Observe actual sample clicks and draws on native output time.                                                                                                                                                                                         |
| phy:64          |                                                             10/10: seven camera-fit timeouts, three low stacks |                                                                                                         30/30 Actions | Turntable prevents fit settlement; stale projection sends drag rays to the wrong coordinates.                                                                                                                                                                                                                                                 |

[Actions campaign 1](https://github.com/ryanjosephkamp/splashery/actions/runs/38999164406) has
completed teddy, song, and physics 30/30, plus the earlier sample marker 30/30.
[Campaign 2](https://github.com/ryanjosephkamp/splashery/actions/runs/39000195618) measures the
request, split-loop, byte-transport, and final collision repairs. FL and quartz passed 30/30; each
of the three WebGL image toys passed 30/30. Each of the three WebGPU toys also passed 30/30
([receipt](https://github.com/ryanjosephkamp/splashery/pull/703#issuecomment-6230157845)). Those
older receipts predate the native-sort helper. The newer
[campaign 3 image receipt](https://github.com/ryanjosephkamp/splashery/actions/runs/39004136389)
confirms all three WebGL toys and all three WebGPU toys 30/30 with the current helper (180 cases).
Every split toy, mirror clip, and preview size requires its own 30/30.

The original fixed-wait test also reproduced naturally in the complete
[30-per-clip Actions campaign on 23664b6](https://github.com/ryanjosephkamp/splashery/actions/runs/39004136389):
still 27/30 and low light 29/30 passed (artifact 12093646468). It used the same
four-worker/two-burner recipe and unchanged mirror implementation, with all failures retained. This
is before the native-draw and held-frame repairs, despite the campaign’s generic `after` artifact
label for the other families.

The retained clean mirror baseline is the initial eight-case cohort, completed before 05:09 UTC:
still 2/4 failed (0.0005963 and 0.0005669 against 0.00055), and low light 4/4 passed. Later
observations are qualified: a recovery archive briefly added about 30% of one CPU around
05:10–05:11, and the final full report was lost with the subsequent workspace replacement. Those
later observations are not a retained 20-case rate. Camera fit and native toy/world readiness were
observed. The 400 ms wall wait often consumed only 0.1–0.2 seconds of native draws.

The completed native-time-only
[Actions campaign on b87f613](https://github.com/ryanjosephkamp/splashery/actions/runs/39008834947)
independently failed still 2/30 (28 passed), while low light passed 30/30. One still failure was
height 0.000649774326682762 against 0.00055; the other was shown drift 0.9698412698412698 against
0.95. All 60 cases completed, with zero retries, skips, or interruptions. Artifact 12094168751
retains both failure traces, the complete report, log, and recipe. This is the earlier
native-time-only candidate, not the newer held-frame source.

The published 0.4-native-second wait is incomplete: a stopped local campaign retained still 10/12
and low light 12/12 passes, with two still pixel failures; four interrupted and 32 unstarted cases
are separate. A completed 12-case sort/color diagnostic then failed twice despite fresh current-view
sorts throughout every face screenshot. Initial native color history was already 4.7–5.8 seconds
old, so the extra age wait was a no-op. Neither readiness wait is accepted as a complete fix.

The next paired diagnostic completed all 12 cases under the same four-worker/two-burner load:
control 5/6 passed, held canvas 6/6 passed. The control failure was height 0.000642325 against
0.00055. Its screenshots rendered 6–10 further frames while the PNG was copied. Across all controls
the interval was 4–12 renders; all 72 held screenshots had zero. Every PNG retained spatial detail
(standard deviation about 49–50), and actual face/turned PNGs are retained. Holding alone left the
first observed sort unknown, so the implementation also requires the actual current-view sort before
holding. All six samples and original thresholds remain unchanged. This diagnostic is not 30-run
acceptance.

The completed native-cell diagnostic on the combined candidate retained still 8/10 and low light
10/10 passes, with zero skips, retries, or interruptions. Its still failures were height
0.0006097322875247882 and 0.0005698294370426788; shown drift passed both times. In one failure, four
neighboring cells repeatedly changed near/far targets by about 0.675 while native still ages rose
from 7.6 to 29.9 seconds and current motion masks stayed zero. Measured samples spanned 9–12
accepted answers.
[Raw reports, both traces, and all five pairs from each failure](https://github.com/ryanjosephkamp/splashery/tree/codex/flaky-tests-clips/docs/audits/flaky-tests-raw/cdx-native-cell-diagnostic-0740)
are retained. The completed paired fixture-period diagnostic is rejected as a repair: original still
3/4 and low light 4/4 passed; longer still 0/4 and low light 4/4 passed. All16 cases completed with
zero skips, retries, or interruptions. Its longer sequence preserves every byte of the original
20-frame prefix for both clips, verified before load. It does not change pose, noise, or seed. The
short fixture did repeat identical native inputs three times in succession, while the longer fixture
supplied nearly all unique inputs. The longer fixture still failed, so repetition does not explain
the full instability. The original fixture remains unchanged.

The later native-origin run completed 8 cases: still 6/8 passed, with no skips, retries, or
interruptions. The final vote-history run completed 4 cases: still 3/4 passed. It captured 66 large
fine changes; 65 complete chains all began with actual coarse changes of 0.648–0.711 (one initial
chain was unobserved). At each chain’s last answer, its coarse neighbors were held unchanged because
the fine three-answer vote was finishing. There were zero draw mutations of a target during pending
votes. This rejects the apparent color-only held-geometry race: a blanket hold would not address the
observed chains. No proposed depth guard is adopted. The completed capture probe found 48/48 exact
RGBA and dimension matches (90 × 112), in both capture orders. Median native capture cost fell from
2,191 to 1,211 ms. Across 288 real WASM outputs and 77 unique inputs, 211 byte-identical repeated
inputs produced exactly identical raw depth. The first device-scale probe failed its strict
dimension guard (45 × 56 versus 90 × 112); those setup failures are retained. Explicit native
device-pixel scaling corrected it. The new helper keeps the original six samples, twelve PNGs, all
camera turns/restores, consumed native draw waits, and actual sorted-frame readiness. It batches
operations in browser tasks and prepares fonts/carets once; no production depth algorithm or fixture
changes are adopted.

The Share focus diagnosis now has a native red/green control. A real recorded clip is saved and
closed through the real controls; a microtask queued by actual `HTMLDialogElement.close()` observes
the original complete focus predicate after the close handler finishes, before the next render.
Original code leaves `rec-save` focused inside the closed dialog: shown/focused/body are all false.
The one-line close-path repair blurs only a remaining closed-preview descendant when Record is
unavailable, making body true in the same task. Both original Task 52 preservation controls pass. A
new actual `tests/shr.spec.mjs` regression failed against original source in 8.841 seconds, then the
repaired full Share file passed 13/13, and the original focus-preservation test passed 1/1. Existing
Share expect lines remain unchanged. The cross-family validation then passed all 16 target variants:
four workers and no extra burners for Mesa cases, two workers and no extra burners for physics and
sample audio on SwiftShader. Mirror still height jitter was 0.00000822 against 0.00055; all original
measurements and thresholds remained intact. This is validation, not 30-run stress acceptance. The
first proposed ready-pill blur did not reproduce the cause and is not in tracked source.

The final local quartz comparison used the same four workers and two continuous burner threads
across both phases: original 100/100 target assertions passed, but 224 invalid neighbor frees
occurred in 94 runs; repaired 30/30 passed with zero invalid frees. There were no retries, skips, or
interruptions. The raw-backup interval was outside observation. Keep the target pass rate distinct
from the measured engine-invariant failure rate.

All 17 native Hands engine B checks and all five browser gem checks passed. Related native checks
passed 52/53 under competing load; the unrelated SoftParts-only 1 ms benchmark measured 1.086 ms.
The unchanged isolated benchmark then passed at 0.410 ms. Actual projectile, socket, ordinary-piece,
and configured parent-break controls retain intended behavior.

The tighter audio observer timestamps actual MotionDriver tap assignment. A real 80 ms stall after
acceptance was masked by the earlier return-time marker (5.9 ms), then failed the unchanged <30 ms
check with the actual-tap observer (86.3 ms). An 80 ms Sound.play delay also failed (103.5 ms); the
normal control passed (6.2 ms). Actual sample-presence checks passed before both expected timing
failures. The committed test contains no injected delay and preserves the original complete
wall-plus-native-lead formula. That observer passed 29/30 in a local stress run, with one retained
31.1 ms failure. Its exact interval could not be partitioned retrospectively. A subsequent native
boundary diagnostic found up to 3.9 ms spent inside the start observer before its timestamp.

The observer now timestamps entry, reads the native clock, calls real native `start()`, and only
then reads buffer metadata once. An 80 ms real buffer-getter inspection made the old observer fail
at 82.6 ms; the repair passed at 5.7 ms. A native AudioWorklet observed the actual sample edge
during the repaired observer's metadata stall, proving playback was already running. Genuine 80 ms
Motion and Sound.play delays still failed at 86.2 and 87.3 ms. All 31 original expect lines and the
complete latency formula remain byte-identical. The repaired actual spec, with no diagnostic worklet
or injected delays, passed 30/30 in 200.830 seconds with four fully parallel workers and two
continuous burners, pinned Node 22 and Chromium 141, and SwiftShader. Delays ranged from 0.8 to 10.5
ms. This corrects a demonstrated observer defect; it does not retrospectively attribute the prior
31.1 ms miss to one measured operation.

Earlier local song 30/30 receipts and some cause probes were lost in workspace replacements; those
observations are disclosed but do not count as final retained acceptance. Prettier and American
English currently pass. Final main merge, preflight, all retained 30/30 gates, and two clean full
Actions runs remain pending. `phy:64` is removed from the known list after its retained Actions
30/30 and the full PHY file passed 6/6 locally; `tests/taps.spec.mjs` is untouched.

Every changed existing expect line at source `23664b6`: `tests/fl.spec.mjs` lines 139, 142, and 145
(original lines 141, 144, and 147) change `expect(await fluidFiles(page)).toEqual([])` to
`expect(fluidFiles()).toEqual([])`. The collector now retains complete request events instead of
querying the bounded Resource Timing buffer; the matcher and expected empty list are identical.
`tests/fx4-engine.spec.mjs` line 98 (original 96) and `tests/img-engine.spec.mjs` line 104
(original 100) change only indentation of `expect(errors).toEqual([])` when the comparisons move
into per-toy tests. No other existing expect line differs. New Engine assertions in
`tests/heb-engine.spec.mjs` are strict regressions and preservation controls. This inventory will be
checked again after the remaining repairs.

## Deviations

The workspace disconnected and returned as a fresh checkout twice, about 03:25 and 03:43 UTC. It
disconnected again about 05:28 UTC while a quiet four-case Share focus control was starting.
Published source and Actions evidence survived. Lost acceptance receipts are repeated; completed
reports and prepared controls are also backed up outside the workspace. The Share control cannot
count until its complete result is recovered. The environment entered starting around 05:42 and
reconnected at 05:50 as a fresh checkout; local probe folders were lost. External backups were
restored and checksum-verified. The initial Share control was repeated; its interrupted run does not
count.

Early native Git transport and email-privacy failures required publishing identical verified file
bytes through the official GitHub API, with separate logical commits, checked expected heads, and no
force update. Native Git returned persistent HTTP 503 responses from 04:20 through 04:51 UTC, then
recovered at 04:52. The official API published verified trees with expected-head checks during the
outage; native refs were subsequently aligned with the exact published commit objects. The
command-line Actions credential also expired, so an explicit PR label can trigger the same immutable
stress matrix. No published history was replaced.

The audio boundary follow-up `c8ae05ed1` was pushed before repeating the required whole-repository
formatting gate. The full Prettier and American English checks were then run and passed, before
further implementation publication. This was a publication-order deviation.

## Known issues

The exact published combined mirror campaign
[39013302972](https://github.com/ryanjosephkamp/splashery/actions/runs/39013302972) completed all 60
cases: still 27/30 and low light 30/30, zero skips or retries. Failed heights were 0.0006253624,
0.0005780563, and 0.0005951548 against the unchanged 0.00055 limit. Artifact 12095759769 is
retained. A new transport/batching candidate is being proved; four passing validation cases are not
acceptance.

The supplemental native quartz projectile comparison was inconclusive: both phases failed the added
collision-qualification check, observing no required unheld-piece-to-intact-pinned-piece contact.
Neither reached the original final assertion. It is retained separately and does not replace the
qualified natural 100/100 target-pass baseline or the native engine collision regressions.

The combined held-frame mirror candidate remains incomplete. Its stopped local campaign completed 16
cases: still 7/8 passed, low light 8/8 passed, four cases were interrupted, and 40 were unstarted.
The failed still clip had height drift 0.0010682912006437242 > 0.00055, while shown drift
0.9390542328042328 < 0.95. This rejects the combined timing/sort/PNG repair as sufficient. The next
diagnostic records real per-cell target, still age, motion, accepted native answer, and capture
metadata without changing any sample or threshold.

| Case        | Cause and evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Work still needed                                                                                                                                                                                                                                                                                                                                                                       |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| cdx-mir:294 | Wall time does not track consumed easing time, but the native-time candidate still fails: still 2/12 pixel failures in the stopped campaign; two further failures in the completed 12-case diagnostic, including height 0.000582448 with both readiness waits. All six face-screenshot intervals used fresh current-view sorts in both failed diagnostic cases. Color history was already 5.1–5.5 native seconds old, so the added age wait was a no-op. Screenshots continued rendering up to 1.2 native seconds beyond the earlier capture. | The combined candidate still fails height drift: local still 7/8, followed by native-cell diagnostic still 8/10. Resolve the actual native depth-edge transitions while preserving motion and all limits, then prove 30/30 per clip. The longer noise sequence is rejected. A native capture transport optimization must first prove exact pixel equivalence and reduced observer cost. |

Remaining: repair and prove mirror drift 30/30, complete retained controlled repetitions, pass final
preflight, and complete two clean full Actions runs. Current-helper WebGPU passed all 90 cases, and
the native close-focus Share repair passed 30/30 per size on Actions. The source branch has moved
since the baseline; latest main `aedbe4433` has now been merged at `0ed4b84d2`, published in
`b87f6132c`; final synchronization and preflight remain required. The historical quartz target
failure itself was not reproduced; its invalid intact-but-unpinned state is reproduced by native
collisions and observed naturally on neighboring quartz pieces.

## What was cut

Nothing. No tolerance, count, gesture, comparison, sample, or deadline was weakened. No target was
skipped, removed, quarantined, or retried. Existing adapter guards remain; acceptance requires the
selected renderer to be available. Raw evidence belongs only on `codex/flaky-tests-clips`, which
must never be merged.

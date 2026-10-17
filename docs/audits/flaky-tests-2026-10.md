# Codex task 100: flaky-test audit

Draft PR: https://github.com/ryanjosephkamp/splashery/pull/703

## Summary

**Current status, 07:13 UTC:** Nine families have current-repair Actions stress receipts at 30/30
per variant (420 cases). Mirror remains pending. The screenshot-transfer probe completed: control
5/6 passed, held canvas 6/6 passed; all 72 held screenshots had zero intervening renders versus 4–12
per control screenshot. The working tree now combines native draw progress, current-view sort
readiness, and a render hold only while the PNG is copied. Both clips and legacy mirror checks need
validation, followed by a fresh 30 repetitions per clip. No mirror acceptance is claimed.

**WORKING (four-hour checkpoint, 06:06 UTC):** Seven families have current-code Actions stress
receipts at 30/30 per variant; the earlier split WebGPU comparisons also passed 30/30 per toy, with
current-helper WebGPU still running. The native close-focus repair is red/green proved locally, all
13 Share tests and the existing focus-preservation test pass, and all 16 target variants pass one
complete cross-family validation run. The new mirror wait passes both unchanged clips once; formal
30/30 is still required. Source publication follows the audit formatting gate. Remaining work:
mirror and Share stress proof, retained controlled repetitions, final synchronization/preflight, and
two clean full Actions runs. The 05:28–05:50 workspace outage returned a fresh checkout; externally
backed-up proof and prepared controls were restored.

Last published implementation head: `b87f6132c9764cf616fe2afa41c77d73799975ab`, including latest
main `aedbe4433`. Whole-repository Prettier and American English passed before publication. The
close-focus Engine repair, unchanged Share assertions, and native-draw mirror wait passed all 13
Share tests, the existing focus-preservation test, and all 16 target variants once.
[The targeted mirror/Share after campaign](https://github.com/ryanjosephkamp/splashery/actions/runs/39008834947)
is running: 30 repetitions per clip/size, four workers, two burners, zero retries. A local paired
mirror campaign also started at 06:10 UTC on this head, with the diagnostic wrappers from the
retained before recipe. The local campaign stopped after 24 completed cases: still 10/12 passed
(pixel failures 0.969279 and 0.964550 against 0.95), low light 12/12 passed; four interrupted and 32
unstarted cases are separate. Height drift remained healthy (0.00001522 and 0.00000411 < 0.00055);
the native-draw wait is not accepted as a complete mirror repair. Render-sort freshness is under
investigation. The Share side completed 30/30 per size (60 cases, zero skips/failures); mirror
remains unaccepted.
[Campaign 3](https://github.com/ryanjosephkamp/splashery/actions/runs/39004136389) retains
current-code 30/30 receipts for eight other families, including all three current-helper WebGPU toys
(90/90; artifact 12092323603).

Codex built this task 100 repair and stress harness. **WORKING:** started October 17, 2026, about
02:06 UTC; deadline 14:06 UTC. This stays a draft until every variant passes 30/30 under recorded
load and two full Actions runs are clean.

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
is on the separate clips branch, currently `4362ca829`; never merge it.

| Original case   |                                                                                    Before failures / completed |                                                                                              After passes / completed | Cause and status                                                                                                                                                                                                                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------: | --------------------------------------------------------------------------------------------------------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| cdx-mir:294     |                             Still 2/4 failures; low-light 0/4 in clean initial local cohort; Actions 0/10 each |                                                         Pending; native-time candidate has at least one pixel failure | The fixed 400 ms wait can consume only 100–200 ms of native mirror draw time. Published native-time wait keeps observed height drift below its original limit, but a still shot exceeds the unchanged 0.95 pixel limit (0.969279). Native sort freshness remains under investigation; no mirror acceptance claimed.                           |
| fl:137          |                                                            0/10 CPU stress; retained filled-buffer failure 1/1 |                                                                               30/30 Actions; filled-buffer repair 1/1 | Bounded Resource Timing loses late module entries. Complete request observation retains the original checks; repeating the controlled overflow receipt.                                                                                                                                                                                       |
| hh1-toys:258    |                              0/10 CPU stress; controlled camera failures observed before workspace replacement |                                                                                                         30/30 Actions | Unfinished fit and stale projection alter the unchanged gesture. The controlled camera-range receipt is being repeated.                                                                                                                                                                                                                       |
| shr:202         | Phone and desktop 0/10 plus 0/30 each; native close boundary 1/1 failed; new real-source regression 1/1 failed | Phone 30/30 and desktop 30/30 Actions on b87; native close repair 1/1; all 13 Share tests and focus preservation pass | The native dialog leaves Save focused inside the closed preview until a later frame, reproducing the historical false/false/false focus predicate. Explicitly blur only that closed-preview focus when Record is unavailable; visible Record and external focus are preserved. The earlier hidden-pill hypothesis was unproved and discarded. |
| hh5-gems:154    |                              Target 0/100 local; 94/100 runs had unintended intact-neighbor unpins, 224 events |                                                                                  Target 30/30; zero unintended unpins | Queued impacts can undo reseating; generic impacts can free an intact joint without breaking it. Natural target failure was not reproduced. Native collision regressions reproduce both invalid transitions directly.                                                                                                                         |
| fx4-engine:79   |                                                                                                10/10 timed out |                                                                                   All three WebGPU toys 30/30 Actions | Three old/new/new comparisons shared one deadline. Each toy now retains the original 240-second deadline and all comparisons. Current-helper campaign 3 also passed all 90 cases at source 23664b6dc4e289b50ea3035346f4a8846379ff13 (artifact 12092323603).                                                                                   |
| img-engine:85   |                                              8/10 timed out; controlled native-sort pressure 1/1 pixel failure |                                               All three toys 30/30 Actions with current helper; controlled repair 1/1 | After the camera moves, the applied worker sort can still belong to the previous view. Exact failure: 1,081 changed pixels against 220; native trace confirms the stale view. Current-helper controlled repetitions remain pending.                                                                                                           |
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

The retained clean mirror baseline is the initial eight-case cohort, completed before 05:09 UTC:
still 2/4 failed (0.0005963 and 0.0005669 against 0.00055), and low light 4/4 passed. Later
observations are qualified: a recovery archive briefly added about 30% of one CPU around
05:10–05:11, and the final full report was lost with the subsequent workspace replacement. Those
later observations are not a retained 20-case rate. Camera fit and native toy/world readiness were
observed. The 400 ms wall wait often consumed only 0.1–0.2 seconds of native draws.

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

| Case        | Cause and evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Work still needed                                                                                                                                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| cdx-mir:294 | Wall time does not track consumed easing time, but the native-time candidate still fails: still 2/12 pixel failures in the stopped campaign; two further failures in the completed 12-case diagnostic, including height 0.000582448 with both readiness waits. All six face-screenshot intervals used fresh current-view sorts in both failed diagnostic cases. Color history was already 5.1–5.5 native seconds old, so the added age wait was a no-op. Screenshots continued rendering up to 1.2 native seconds beyond the earlier capture. | Validate the combined current-view sort and screenshot hold, then run 30 per clip under the retained stress recipe. The hold-only diagnostic passed 6/6 against a 5/6 control, but full acceptance remains pending. |

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

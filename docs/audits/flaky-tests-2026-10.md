# Flaky tests — October 17, 2026

Checkpoint, 04:49 UTC. Acceptance remains incomplete.

## Summary

Codex built this task 100 repair and stress harness. **WORKING:** started October 17, 2026, about
02:06 UTC; deadline 14:06 UTC. This stays a draft until every variant passes 30/30 under recorded
load and two full Actions runs are clean.

Published repairs observe native audio output and actual motion-tap storage, wait for the fitted
camera and its rendered projection, observe complete fluid requests, split shader comparisons by toy
at the original 240-second deadline, transport every RGBA byte losslessly, and repair two collision
races in separate Engine commits. A native-sort readiness repair has reproduced and corrected the
historical image failure in a controlled probe; it is published, and its final stress proof is next.

Task 50 [#581](https://github.com/ryanjosephkamp/splashery/pull/581) supplied turntable shutdown and
camera-fit readiness. An actual completed frame is also needed to refresh the cached projection. Its
unrelated runner and test changes were not copied.

## Verification

Baseline: immutable main `ceb51de7a015377d7f350119c27a792fc1a8a66d`.
[All ten baseline families completed](https://github.com/ryanjosephkamp/splashery/actions/runs/38997782641):
10 repetitions, four fully parallel workers, two constant CPU burners, Node 22.23.3, Chromium 141.
Mesa llvmpipe was used except SwiftShader for PHY and sample audio.
[Preserved raw evidence](https://github.com/ryanjosephkamp/splashery/tree/codex/flaky-tests-clips/docs/audits/flaky-tests-raw)
is on the separate clips branch, currently `b4a41c691`; never merge it.

| Original case   |                                                       Before failures / completed |                                  After passes / completed | Cause and status                                                                                                                                                                                                                          |
| --------------- | --------------------------------------------------------------------------------: | --------------------------------------------------------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| cdx-mir:294     |                                                        Still 0/10; low-light 0/10 |                                                   Pending | Historical still drift 0.981 against 0.95. Native render/sampling diagnosis continues.                                                                                                                                                    |
| fl:137          |                               0/10 CPU stress; retained filled-buffer failure 1/1 |                   30/30 Actions; filled-buffer repair 1/1 | Bounded Resource Timing loses late module entries. Complete request observation retains the original checks; repeating the controlled overflow receipt.                                                                                   |
| hh1-toys:258    | 0/10 CPU stress; controlled camera failures observed before workspace replacement |                                             30/30 Actions | Unfinished fit and stale projection alter the unchanged gesture. The controlled camera-range receipt is being repeated.                                                                                                                   |
| shr:202         |                                                          Phone 0/10; desktop 0/10 |                                                   Pending | Two recovered Actions artifacts fail the final phone focus check after keyboard close. Native recorder observer passed 10/10 at each size; focus lifecycle diagnosis continues.                                                           |
| hh5-gems:154    | Target 0/100 local; 94/100 runs had unintended intact-neighbor unpins, 224 events |                      Target 30/30; zero unintended unpins | Queued impacts can undo reseating; generic impacts can free an intact joint without breaking it. Natural target failure was not reproduced. Native collision regressions reproduce both invalid transitions directly.                     |
| fx4-engine:79   |                                                                   10/10 timed out |                            Actions WebGPU per-toy running | Three old/new/new comparisons shared one deadline. Each toy now retains the original 240-second deadline and all comparisons.                                                                                                             |
| img-engine:85   |                 8/10 timed out; controlled native-sort pressure 1/1 pixel failure | All three WebGL toys 30/30 Actions; controlled repair 1/1 | After the camera moves, the applied worker sort can still belong to the previous view. Exact failure: 1,081 changed pixels against 220; native trace confirms the stale view.                                                             |
| sndc-engine:122 |                        0/10 Actions; earlier local busy-runner failures, raw lost |   Native-entry observer 30/30 local; prior observer 29/30 | Require decoded sample and native clock progress. Actual tap storage timestamps acceptance. Native start now precedes metadata inspection; causal controls show the old observer delayed real playback, and production delays still fail. |
| live2:207       |                                                                      4/10 Actions |                                             30/30 Actions | Wall-origin matching loses/misidentifies clicks as native audio progresses differently. Observe actual sample clicks and draws on native output time.                                                                                     |
| phy:64          |                                10/10: seven camera-fit timeouts, three low stacks |                                             30/30 Actions | Turntable prevents fit settlement; stale projection sends drag rays to the wrong coordinates.                                                                                                                                             |

[Actions campaign 1](https://github.com/ryanjosephkamp/splashery/actions/runs/38999164406) has
completed teddy, song, and physics 30/30, plus the earlier sample marker 30/30.
[Campaign 2](https://github.com/ryanjosephkamp/splashery/actions/runs/39000195618) measures the
request, split-loop, byte-transport, and final collision repairs. FL and quartz passed 30/30; each
of the three WebGL image toys passed 30/30. WebGPU is still running. The image receipt predates the
newly published native-sort helper; that helper still needs separate final proof. Every split toy,
mirror clip, and preview size requires its own 30/30.

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

Changed existing expect expressions: `tests/fl.spec.mjs`'s three empty-list checks call the complete
request collector instead of the bounded Resource Timing query. The matcher and expected empty list
are identical. Shader expect lines moved with the split; all expressions remain unchanged. Audio,
camera, and quartz expect expressions remain byte-identical. New Engine assertions are strict
regressions and preservation controls. Final line-number inventory will be recorded after the
remaining repairs.

## Deviations

The workspace disconnected and returned as a fresh checkout twice, about 03:25 and 03:43 UTC.
Published source and Actions evidence survived. Lost acceptance receipts are being repeated;
completed reports are also backed up outside the workspace.

Early native Git transport and email-privacy failures required publishing identical verified file
bytes through the official GitHub API, with separate logical commits, checked expected heads, and no
force update. Native Git worked briefly, then returned persistent HTTP 503 responses after 04:20
UTC. The official API still publishes verified trees with expected-head checks. The command-line
Actions credential also expired, so an explicit PR label can trigger the same immutable stress
matrix. No published history was replaced.

The audio boundary follow-up `c8ae05ed1` was pushed before repeating the required whole-repository
formatting gate. The full Prettier and American English checks were then run and passed, before
further implementation publication. This was a publication-order deviation.

## Known issues

Remaining: establish the mirror cause and Share focus lifecycle; complete retained paired stress and
30/30 proofs for every variant, including the current image helper; merge latest main, pass
preflight, and complete two clean full Actions runs. The source branch has moved since the baseline;
its final merge remains required. The historical quartz target failure itself was not reproduced;
its invalid intact-but-unpinned state is reproduced by native collisions and observed naturally on
neighboring quartz pieces.

## What was cut

Nothing. No tolerance, count, gesture, comparison, sample, or deadline was weakened. No target was
skipped, removed, quarantined, or retried. Existing adapter guards remain; acceptance requires the
selected renderer to be available. Raw evidence belongs only on `codex/flaky-tests-clips`, which
must never be merged.

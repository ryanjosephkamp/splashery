# Flaky tests — October 17, 2026

Checkpoint, 04:16 UTC. Acceptance remains incomplete.

## Summary

Codex built this task 100 repair and stress harness. **WORKING:** started October 17, 2026, about
02:06 UTC; deadline 14:06 UTC. This stays a draft until every variant passes 30/30 under recorded
load and two full Actions runs are clean.

Published repairs observe native audio output and actual motion-tap storage, wait for the fitted
camera and its rendered projection, observe complete fluid requests, split shader comparisons by toy
at the original 240-second deadline, transport every RGBA byte losslessly, and repair two collision
races in separate Engine commits. A native-sort readiness repair has reproduced and corrected the
historical image failure in a controlled probe; its stress proof and publication are next.

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

| Original case   |                                                       Before failures / completed |                                               After passes / completed | Cause and status                                                                                                                                                                                                      |
| --------------- | --------------------------------------------------------------------------------: | ---------------------------------------------------------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| cdx-mir:294     |                                                        Still 0/10; low-light 0/10 |                                                                Pending | Historical still drift 0.981 against 0.95. Native render/sampling diagnosis continues.                                                                                                                                |
| fl:137          |              0/10 CPU stress; earlier 1/1 filled-buffer failure, raw receipt lost |                                                    Retained 30 pending | Bounded Resource Timing loses late module entries. Complete request observation retains the original checks; repeating the controlled overflow receipt.                                                               |
| hh1-toys:258    | 0/10 CPU stress; controlled camera failures observed before workspace replacement |                                                          30/30 Actions | Unfinished fit and stale projection alter the unchanged gesture. The controlled camera-range receipt is being repeated.                                                                                               |
| shr:202         |                                                          Phone 0/10; desktop 0/10 |                                                                Pending | Historical preview missing after Stop; native recorder and dialog lifecycle diagnosis pending.                                                                                                                        |
| hh5-gems:154    | Target 0/100 local; 94/100 runs had unintended intact-neighbor unpins, 224 events |                                   Target 30/30; zero unintended unpins | Queued impacts can undo reseating; generic impacts can free an intact joint without breaking it. Natural target failure was not reproduced. Native collision regressions reproduce both invalid transitions directly. |
| fx4-engine:79   |                                                                   10/10 timed out |                                                        Pending per toy | Three old/new/new comparisons shared one deadline. Each toy now retains the original 240-second deadline and all comparisons.                                                                                         |
| img-engine:85   |                 8/10 timed out; controlled native-sort pressure 1/1 pixel failure |                                      Controlled repair 1/1; 30 pending | After the camera moves, the applied worker sort can still belong to the previous view. Exact failure: 1,081 changed pixels against 220; native trace confirms the stale view.                                         |
| sndc-engine:122 |                        0/10 Actions; earlier local busy-runner failures, raw lost | Earlier marker 30/30 Actions; strict marker 29/30, one 31.1 ms failure | A running context can still have a stationary native clock. Require the decoded sample and clock progress; measure from actual tap storage through audio dispatch.                                                    |
| live2:207       |                                                                      4/10 Actions |                                                    Retained 30 running | Wall-origin matching loses/misidentifies clicks as native audio progresses differently. Observe actual sample clicks and draws on native output time.                                                                 |
| phy:64          |                                10/10: seven camera-fit timeouts, three low stacks |                                                    Retained 30 running | Turntable prevents fit settlement; stale projection sends drag rays to the wrong coordinates.                                                                                                                         |

[Actions campaign 1](https://github.com/ryanjosephkamp/splashery/actions/runs/38999164406) has
completed teddy 30/30 and the earlier sample marker 30/30; song and physics are running.
[Campaign 2](https://github.com/ryanjosephkamp/splashery/actions/runs/39000195618) measures the
request, split-loop, byte-transport, and final collision repairs. Every split toy, mirror clip, and
preview size requires its own 30/30.

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
wall-plus-native-lead formula. Its final local 30-case stress run passed 29/30, with one genuine
31.1 ms failure; that failure is retained and the remaining interval is being diagnosed before
another acceptance run.

Earlier local song 30/30 receipts and some cause probes were lost in workspace replacements; those
observations are disclosed but do not count as final retained acceptance. Prettier and American
English currently pass. Final main merge, preflight, all retained 30/30 gates, and two clean full
Actions runs remain pending. `phy:64` remains known; `tests/taps.spec.mjs` is untouched.

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
force update. Native push now works. No published history was replaced.

The audio boundary follow-up `c8ae05ed1` was pushed before repeating the required whole-repository
formatting gate. The full Prettier and American English checks were then run and passed, before
further implementation publication. This was a publication-order deviation.

## Known issues

Remaining: establish the mirror and recording causes; complete retained paired stress and 30/30
proofs for every variant; publish the proven image readiness repair; run the full PHY file before
removing its known entry; merge latest main, pass preflight, and complete two clean full Actions
runs. The historical quartz target failure itself was not reproduced; its invalid
intact-but-unpinned state is reproduced by native collisions and observed naturally on neighboring
quartz pieces.

## What was cut

Nothing. No tolerance, count, gesture, comparison, sample, or deadline was weakened. No target was
skipped, removed, quarantined, or retried. Existing adapter guards remain; acceptance requires the
selected renderer to be available. Raw evidence belongs only on `codex/flaky-tests-clips`, which
must never be merged.

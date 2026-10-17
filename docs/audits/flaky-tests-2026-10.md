## Summary

Codex built this task 100 repair on `codex/flaky-tests`. Draft PR only; the raw evidence branch
`codex/flaky-tests-clips` must never merge.

**Current status, 13:19 UTC:** All ten families have complete 30/30 stress receipts per variant (480
cases). Final local mirror stress on immutable `9a16ae2ae7e49b1b792d01985fba3ea61aea2f78` passed
still 30/30 and low light 30/30, zero failures, skips, retries, or interruptions, under four workers
and two constant CPU burners. Full preflight passed 271/271. Both full Actions runs completed with
no target failure; both are globally red solely because of non-target `pages-r2:495`, independently
failed on current main. Matching Actions mirror stress is still running and must be inspected.
Deadline: 14:06 UTC.

Test changes observe completed native state and preserve the original assertions. Separate Engine
commits repair collision ordering, intact-joint preservation, and focus after closing a recording
preview. No toy behavior is redesigned.

Task 50 [#581](https://github.com/ryanjosephkamp/splashery/pull/581) supplied turntable shutdown and
camera-fit readiness; an actual completed render is also necessary to refresh projection. Its
unrelated runner and test changes were not copied.

**WORKING (four-hour checkpoint, 06:06 UTC):** Seven families have current-code Actions stress
receipts at 30/30 per variant; the earlier split WebGPU comparisons also passed 30/30 per toy, with
current-helper WebGPU still running. The native close-focus repair is red/green proved locally, all
13 Share tests and the existing focus-preservation test pass, and all 16 target variants pass one
complete cross-family validation run. The new mirror wait passes both unchanged clips once; formal
30/30 is still required. Source publication follows the audit formatting gate. Remaining work:
mirror and Share stress proof, retained controlled repetitions, final synchronization/preflight, and
two clean full Actions runs. The 05:28–05:50 workspace outage returned a fresh checkout; externally
backed-up proof and prepared controls were restored.

**WORKING (eight-hour checkpoint, 10:06 UTC):** Nine families have current-repair Actions stress
receipts at 30/30 per variant (420 cases). Retained FL overflow and IMG delayed-native-sort controls
passed 30/30; Teddy moving fit passed 40/41 before and 41/41 after. Mirror is still unresolved: the
prior combined candidate completed still 27/30 and low light 30/30 on Actions. The new native-PNG
and browser-task candidate passed all four existing CDX/LV7 validation cases and has now passed
11/60 formal local stress cases, with zero failures so far. Strict PNG equivalence passed 48/48
pairs; 211 repeated identical native model inputs produced identical raw outputs. No depth guard,
changed fixture, tolerance, count, or retry was adopted. Two fresh full Actions runs and independent
mirror stress are queued on immutable `18ea9fbe8`. Full preflight will run after local stress, with
no competing burners. Remaining time: four hours, deadline 14:06 UTC. Earlier full runs on the
superseded source were canceled and do not count.

## Verification

The common recipe is 30 repetitions per variant, four fully parallel workers, two continuous CPU
burners, and zero retries. Retained recipes include the exact commit, every source hash, browser
version, renderer, CPU quota, command, report, and log. The container used Node 22.20.0, Chromium
141.0.7390.37 (Playwright revision 1194), Xvfb, and Mesa llvmpipe for WebGL2; WebGPU, PHY, and
sample-audio stress retain SwiftShader, as the checked-in workflow selects. No competing local
browser work ran during the final cohort.

```sh
SPLASHERY_CHROMIUM=<Chromium-141> SPLASHERY_GL=llvmpipe DISPLAY=:91 \
  node tools/flaky-tests.mjs --repeat=30 --workers=4 --burners=2 \
  --only=cdx-mir --out=<new-evidence-directory>
```

| Original case   |                                                                                    Before failures / completed |                                                                                              After passes / completed | Cause and status                                                                                                                                                                                                                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------: | --------------------------------------------------------------------------------------------------------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| cdx-mir:294     |                                                       Original-wait Actions: still 3/30, low light 1/30 failed |                                             Final local: still 30/30 and low light 30/30; independent Actions pending | Native-time and current-view render readiness repair observer races. Independent cell sampling removes image-copy cadence from height measurement. Only low light increases from six to twenty observations at unchanged limits to measure actual noisy-model variation.                                                                      |
| fl:137          |                                                            0/10 CPU stress; retained filled-buffer failure 1/1 |                                                                             30/30 Actions; filled-buffer repair 30/30 | Bounded Resource Timing loses late module entries. Complete request observation retains the original checks. The current filled-buffer repair passed 30/30 under the original controlled pressure.                                                                                                                                            |
| hh1-toys:258    |                              0/10 CPU stress; controlled camera failures observed before workspace replacement |                                                                                                         30/30 Actions | Unfinished fit and stale projection alter the unchanged gesture. Retained moving-fit control: before 40/41 passed, after 41/41 passed; fresh projection in both phases. Factor 1.02 failed the original settled limit (0.1500 > 0.08).                                                                                                        |
| shr:202         | Phone and desktop 0/10 plus 0/30 each; native close boundary 1/1 failed; new real-source regression 1/1 failed | Phone 30/30 and desktop 30/30 Actions on b87; native close repair 1/1; all 13 Share tests and focus preservation pass | The native dialog leaves Save focused inside the closed preview until a later frame, reproducing the historical false/false/false focus predicate. Explicitly blur only that closed-preview focus when Record is unavailable; visible Record and external focus are preserved. The earlier hidden-pill hypothesis was unproved and discarded. |
| hh5-gems:154    |                              Target 0/100 local; 94/100 runs had unintended intact-neighbor unpins, 224 events |                                                                                  Target 30/30; zero unintended unpins | Queued impacts can undo reseating; generic impacts can free an intact joint without breaking it. Natural target failure was not reproduced. Native collision regressions reproduce both invalid transitions directly.                                                                                                                         |
| fx4-engine:79   |                                                                                                10/10 timed out |                                                                                   All three WebGPU toys 30/30 Actions | Three old/new/new comparisons shared one deadline. Each toy now retains the original 240-second deadline and all comparisons. Current-helper campaign 3 also passed all 90 cases at source 23664b6dc4e289b50ea3035346f4a8846379ff13 (artifact 12092323603).                                                                                   |
| img-engine:85   |                                              8/10 timed out; controlled native-sort pressure 1/1 pixel failure |                                             All three toys 30/30 Actions with current helper; controlled repair 30/30 | After the camera moves, the applied worker sort can still belong to the previous view. Exact failure: 1,081 changed pixels against 220; native trace confirms the stale view. The current helper also passed 30/30 with the original delayed native-sort control.                                                                             |
| sndc-engine:122 |                 0/10 Actions; earlier local busy-runner failures, raw lost; tighter prior observer 1/30 failed |                                                                          Final observer 30/30 local and 30/30 Actions | Require decoded sample and native clock progress. Actual tap storage timestamps acceptance. Native start precedes metadata inspection; causal controls show the old observer delayed real playback, and production delays still fail.                                                                                                         |
| live2:207       |                                                                                                   4/10 Actions |                                                                                                         30/30 Actions | Wall-origin matching loses/misidentifies clicks as native audio progresses differently. Observe actual sample clicks and draws on native output time.                                                                                                                                                                                         |
| phy:64          |                                                             10/10: seven camera-fit timeouts, three low stacks |                                                                                                         30/30 Actions | Turntable prevents fit settlement; stale projection sends drag rays to the wrong coordinates.                                                                                                                                                                                                                                                 |

The original ten-repeat Actions baseline is
[38997782641](https://github.com/ryanjosephkamp/splashery/actions/runs/38997782641). An initial zero
failure rate is reported as zero; controlled causes are distinguished from natural target failures.
The original fixed-wait mirror independently failed still 3/30 and low light 1/30 in
[39004136389](https://github.com/ryanjosephkamp/splashery/actions/runs/39004136389). Nine repaired
families retain 420 passing cases:
[campaign 1](https://github.com/ryanjosephkamp/splashery/actions/runs/38999164406),
[campaign 2](https://github.com/ryanjosephkamp/splashery/actions/runs/39000195618),
[current image/sort and audio campaign 3](https://github.com/ryanjosephkamp/splashery/actions/runs/39004136389),
and [final Share stress](https://github.com/ryanjosephkamp/splashery/actions/runs/39008834947). The
relevant paths and native-sort helper are unchanged by the subsequent mirror-only repairs. Each of
the three split toys and both Share sizes has its own 30/30 receipt.

The final clean-source local cohort completed 60/60 in 52.43 minutes, zero skips, retries, failures,
or interruptions. Maximum height was still 0.0002954859 and low light 0.0038058014; maximum shown
drift was 0.7366402 and 1.7447751. Maximum individual runtimes were 157.54 and 283.364 seconds,
below the unchanged 600-second timeout. The independent
[matching Actions stress](https://github.com/ryanjosephkamp/splashery/actions/runs/39031197941) is
still running; its first-pass outcome will also be retained.

Two independent full Actions runs on functional head `9a16ae2ae`, attempt 1, completed all 398/398
files with **3407 passed, one failed, and one existing skip each**:
[run 1](https://github.com/ryanjosephkamp/splashery/actions/runs/39031193271),
[run 2](https://github.com/ryanjosephkamp/splashery/actions/runs/39031195607). **Neither has a
failure from the ten-test list. Neither is globally clean.** Both fail only `pages-r2:495`, which
also fails alone. The existing skip is `cdx-v3d-calibration:217`, whose private counterexample
fixture is absent; it is outside this task and unchanged.

Main `69cd6c99326e63873bb0facf82ef75d9d75d18c0` was fetched and merged at 11:58 UTC (already up to
date), then fetched again before final preflight. **Full preflight passed on functional head
`9a16ae2ae7e49b1b792d01985fba3ea61aea2f78`: 271/271 browser cases and all six static gates.** No
quick mode was used:
`SPLASHERY_CHROMIUM=<Chromium-141> SPLASHERY_GL=llvmpipe DISPLAY=:91 node tools/preflight.mjs`, on
standard port 4173. Subsequent audit-only commits leave every tested runtime and test byte
unchanged. `tests/taps.spec.mjs` is untouched. PHY was removed from the known list only after its
30/30 stress receipt and full six-case local file passed.

Causal and preservation evidence:

- FL: filling the native Resource Timing buffer reproduced the old failure 1/1. Complete
  request-event observation passed 30/30 with the same pressure and retains the positive
  runtime-loaded assertion.
- Teddy: a moving-fit control, with fresh projection in both phases, passed 40/41 before and 41/41
  after. A 1.02 fit factor produced settled error 0.1500259 against the unchanged 0.08 limit.
- Share: native dialog close leaves Save focused inside the closed preview until the next frame. The
  original complete focus predicate failed at that actual boundary; the new real-source regression
  failed before and passed after. All 13 Share cases and the separate existing focus-preservation
  control pass. Visible Record and external focus are preserved.
- Quartz: native engine regressions reproduce impact draining after rather than before constraint
  stepping, and an intact pinned neighbor being freed by a generic impact. Repaired stress has zero
  invalid frees. All 17 native Hands engine B regressions and all five browser gem cases pass.
  Ordinary impacts, projectile contacts, socket behavior, and configured parent breaks remain
  covered.
- FX/IMG: each old/new/new comparison retains the 240-second timeout. Every one of 1,316,640 RGBA
  bytes survives lossless transport; the original comparison hash matched. A real delayed native
  sort caused 1,081 changed pixels against the original 220 limit; current-view native sort
  readiness passed 30/30 under that same pressure. No worker result is mocked.
- Sample audio: wait for decoded-buffer identity and native clock progression, then timestamp actual
  Motion tap storage. Timestamp actual native buffer start before inspecting metadata once after
  successful playback. An 80 ms metadata getter stalled the old observer into an 82.6 ms failure;
  the corrected observer measured 5.7 ms and a real AudioWorklet edge confirmed playback during the
  stall. Real production Motion and Sound delays still fail at 86.2 and 87.3 ms. All 31 original
  expect lines and the wall-plus-native-lead formula remain.
- Live song: match real AudioWorklet click edges/currentFrame and native output time to the actual
  visual draw. All 12 clicks, the minimum ten rows, and the original absolute 50 ms limit remain.
- Mirror: replace the 400 ms wall wait with 0.4 consumed native draw seconds after a fresh depth
  answer. Capture immutable native rendered frames after the actual current-view sort. Strict
  equivalence matched every RGBA byte and 90 × 112 dimensions in 48/48 pairs against ordinary
  screenshots, in both capture orders. Source-cell reads remain sequential; an ordered image queue
  runs concurrently and is fully joined before return, preventing image-copy latency from changing
  source-camera sampling cadence.

The mirror still clip keeps six observations and twelve PNGs; only low light increases to twenty
observations and forty PNGs. All observations enter the unchanged median calculation. Height limits
remain 0.00055/0.0135, shown-drift limits 0.95/2.2, timeout 600000 ms, and the original 20-frame
noise fixture and camera motions remain. A twenty-observation real-motion control measured height
0.0354118 and shown drift 25.3967, exceeding both original clips' limits. Four low-light controls
completed in 246–264 seconds under the same load; none of their six-observation windows reproduced
the rare failure, and one complete median increased, so these controls are runtime/fault-detection
evidence, not causal reproduction or acceptance.

Every changed existing expect line: `tests/fl.spec.mjs` 139, 142, and 145 (original 141, 144,
and 147) replace `expect(await fluidFiles(page)).toEqual([])` with
`expect(fluidFiles()).toEqual([])`; the collector is complete request events instead of bounded
Resource Timing, and the empty-list matcher is identical. `tests/fx4-engine.spec.mjs` 98
(original 96) and `tests/img-engine.spec.mjs` 104 (original 100) change only indentation of
`expect(errors).toEqual([])` after splitting per toy. No other existing expect line changes. The
low-light observation count increases rather than decreases. Added Engine and Share expect lines are
strict regressions and preservation controls.

[Published raw evidence](https://github.com/ryanjosephkamp/splashery/tree/12ae6af6d4255cfc6eef70038953eec0c87c1d3f/docs/audits/flaky-tests-raw)
is pinned at `12ae6af6d4255cfc6eef70038953eec0c87c1d3f`. Final local mirror is in
`cdx-final-low20-1225`; both full runs and the current-main PDF excerpts are in
`actions-final-full-9a16`; both preflight logs and the 25 generated PNGs with hashes are retained in
their named preflight directories. This evidence branch must never merge.

## Deviations

The first final preflight used my nonstandard port 4217. Two existing viewer tests hardcode PDF
fixtures on 4173, where no server was listening: 269 passed and both fixture fetches failed.
Restoring the standard port without any source or assertion change made the complete preflight pass
271/271. The original log and setup are retained; screenshots/traces were removed by Playwright's
next-run cleanup and are not claimed. The passing run generated 25 tracked documentation PNGs; their
exact bytes and hashes were retained, then the tracked outputs were restored before the clean stress
subject started.

Earlier mirror candidates and their full/stress dispatches were superseded after observed failures.
Their failures remain evidence; canceled or partial full runs do not count. One stress dispatch used
an abbreviated SHA and failed checkout before any test; it is a setup failure, not a completed
repetition. Manual full-suite dispatches now have independent concurrency groups, preserving
automatic PR cancellation behavior and allowing the two requested measurements to finish
independently. Existing CI rechecks still run, but first-pass failures remain failures in this
report; no failed-job rerun or target retry is used.

The workspace returned as a fresh checkout three times, around 03:25, 03:43, and 05:28–05:50 UTC.
Published source and Actions artifacts survived. Lost receipts do not count; completed evidence and
controls were restored from verified external backups. Temporary Git transport and email-privacy
failures required official GitHub API publication of identical verified trees with expected-head
checks. Native refs were then aligned to those exact published commits; no force update or rewritten
history occurred.

One early audio follow-up `c8ae05ed1` was published before repeating the required whole-repository
formatting gate. Both whole-repository Prettier and American English checks then passed before
further publication. The raw branch's complete immutable diff exceeded the English checker's 64 MB
subprocess buffer; the identical checker and full diff passed with a temporary preload raising only
that buffer to 256 MB. No rule or input line was excluded, and the preload is not shipped.

## Known issues

| Case                                       | Cause and evidence                                                                                                                                                                                                                                                                                                                                                              | Remaining work                                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Independent CDX check                      | Local final stress passed both clips 30/30. Matching Actions stress on the same head remains running.                                                                                                                                                                                                                                                                           | Inspect the complete independent first-pass result before final handback.                                                |
| Full suite: pages-r2:495 (outside the ten) | Both final full runs fail the unchanged <0.5 opaque-paper pixel comparison; means are 19.6524749445 and 19.6751678993. It also failed alone and in current-main [run 39021491077](https://github.com/ryanjosephkamp/splashery/actions/runs/39021491077), including alone. PDF and picture-renderer sources are unchanged by this branch. Its internal cause is not established. | Report the separate main failure; no assertion or quarantine change is proposed. This prevents globally green full runs. |

Related native checks passed 52/53 under competing load. The unrelated SoftParts 1 ms benchmark
measured 1.086 ms; its unchanged isolated check then measured 0.410 ms. That first failure remains
recorded and does not substitute for any target receipt.

Quartz's historical final-target failure was not reproduced: original target 100/100 passed. The
same native run recorded 224 invalid intact-neighbor frees in 94/100 cases; repaired target 30/30
had zero such events. Native regressions reproduce both invalid transitions directly. A supplemental
projectile fixture failed its added contact qualification in both phases and never reached the
original final assertion; it is inconclusive and does not count as reproduction.

All failed mirror candidates remain retained: original-wait Actions still 27/30 and low 29/30;
native-time-only Actions still 28/30 and low 30/30; combined held-frame Actions still 27/30 and low
30/30; direct protocol/batching local still 16/18 and low 18/18 with three interrupted and 21
unstarted; native-canvas sequential local still 7/8 and low 8/8 with four interrupted and 40
unstarted; independent-cadence six-observation cohort completed still 30/30 and low 29/30, zero
skips/retries/interruptions, with low height 0.0162116086 > 0.0135. These are failed candidates,
never replacement green receipts.

Native pipeline tracing found actual input-noise sensitivity, not nondeterministic output or a
pending-vote race: 211 repeated byte-identical inputs produced identical raw outputs; ten coarse
changes all had a still mask of 1 and a completed three-answer vote. RGB changed about 4.3 levels on
average (maximum 27–30), raw depth by up to 0.95–1.16, and native history was already 6–13 seconds
old. Sixty-five complete large fine-change chains began with actual coarse transitions; zero
pending-vote target mutations were observed. A longer noise fixture failed all four still cases and
was rejected.

## What was cut

No wider tolerance, smaller count, skipped step, quarantined test, increased timeout, retry,
production depth guard, stronger smoothing, changed noise fixture, or toy redesign was adopted. No
test was removed. The rejected longer fixture, speculative current-mask/color-only guards, and extra
CDP session are excluded. All source-camera data and rendered PNG comparisons remain measured.

Rule check: none.

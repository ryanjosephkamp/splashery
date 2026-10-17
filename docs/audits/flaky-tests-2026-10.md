## Summary

Codex built this task 100 repair on `codex/flaky-tests`. Draft PR only; the raw evidence branch
`codex/flaky-tests-clips` must never merge.

The original campaign completed all ten target families at 30/30 per variant (480 Actions cases),
including both final mirror clips at 30/30 locally and independently on Actions. Final full run 1
passed with zero failures; run 2 had four failures outside the target list, all passing alone. **Two
globally clean full runs were not achieved.** Both runs used functional head
`499501064b0b42e27545d61df8f5fdb660dfab71`, before the follow-up behavior revert.

The Operator’s
[review](https://github.com/ryanjosephkamp/splashery/pull/703#issuecomment-6235292612) requests
three changes. The stress job and all dispatch inputs now live in `.github/workflows/stress.yml`;
`tests.yml` is restored byte for byte from main. A separate revert commit removes `bbace1372`’s
`knockable()` restriction and its associated tests. The hit-ordering fix `03334bbaa` and `ui.js`
close-focus fix remain. Final full-run results are recorded below. The new workflow is documented in
`docs/CI.md`. Follow-up Quartz stress passed 30/30 after the revert; all 41 source-specific cases
and full preflight pass.

Task 50 [#581](https://github.com/ryanjosephkamp/splashery/pull/581) supplied turntable shutdown and
camera-fit readiness; an actual completed render is also necessary to refresh projection. Its
unrelated runner and test changes were not copied.

## Verification

The common stress recipe is 30 repetitions per variant, four fully parallel workers, two continuous
CPU burners, and zero retries. Retained recipes include the exact commit, source hashes, browser,
renderer, CPU quota, command, report, and log. Local runs use Node 22.20.0 and Chromium
141.0.7390.37, with Xvfb and Mesa llvmpipe; WebGPU, Pebbles, and sample-audio stress use
SwiftShader. Actions uses Node 22.23.3 and the same Chromium. No competing local browser work runs
during formal stress cohorts.

```sh
SPLASHERY_CHROMIUM=<Chromium-141> SPLASHERY_GL=llvmpipe DISPLAY=:91 \
  node tools/flaky-tests.mjs --repeat=30 --workers=4 --burners=2 \
  --only=cdx-mir --out=<new-evidence-directory>
```

| Original case   |                                                                                    Before failures / completed |                                                                                              After passes / completed | Cause and status                                                                                                                                                                                                                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------: | --------------------------------------------------------------------------------------------------------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| cdx-mir:294     |                                                       Original-wait Actions: still 3/30, low light 1/30 failed |                                                  Final local and independent Actions: still 30/30 and low light 30/30 | Native-time and current-view render readiness repair observer races. Independent cell sampling removes image-copy cadence from height measurement. Only low light increases from six to twenty observations at unchanged limits to measure actual noisy-model variation.                                                                      |
| fl:137          |                                                            0/10 CPU stress; retained filled-buffer failure 1/1 |                                                                             30/30 Actions; filled-buffer repair 30/30 | Bounded Resource Timing loses late module entries. Complete request observation retains the original checks. The current filled-buffer repair passed 30/30 under the original controlled pressure.                                                                                                                                            |
| hh1-toys:258    |                              0/10 CPU stress; controlled camera failures observed before workspace replacement |                                                                                                         30/30 Actions | Unfinished fit and stale projection alter the unchanged gesture. Retained moving-fit control: before 40/41 passed, after 41/41 passed; fresh projection in both phases. Factor 1.02 failed the original settled limit (0.1500 > 0.08).                                                                                                        |
| shr:202         | Phone and desktop 0/10 plus 0/30 each; native close boundary 1/1 failed; new real-source regression 1/1 failed | Phone 30/30 and desktop 30/30 Actions on b87; native close repair 1/1; all 13 Share tests and focus preservation pass | The native dialog leaves Save focused inside the closed preview until a later frame, reproducing the historical false/false/false focus predicate. Explicitly blur only that closed-preview focus when Record is unavailable; visible Record and external focus are preserved. The earlier hidden-pill hypothesis was unproved and discarded. |
| hh5-gems:154    |                              Original target 0/100 failures; hit-ordering race reproduced by native regression |                                                          Earlier Actions 30/30; follow-up after behavior revert 30/30 | Queued impacts can undo reseating. Keep the per-substep hit-ordering fix. Revert the separate generic-impact behavior change at the Operator’s request. The historical target failure was not reproduced: original target 100/100 passed.                                                                                                     |
| fx4-engine:79   |                                                                                                10/10 timed out |                                                                                   All three WebGPU toys 30/30 Actions | Three old/new/new comparisons shared one deadline. Each toy now retains the original 240-second deadline and all comparisons. Current-helper campaign 3 also passed all 90 cases at source 23664b6dc4e289b50ea3035346f4a8846379ff13 (artifact 12092323603).                                                                                   |
| img-engine:85   |                                              8/10 timed out; controlled native-sort pressure 1/1 pixel failure |                                             All three toys 30/30 Actions with current helper; controlled repair 30/30 | After the camera moves, the applied worker sort can still belong to the previous view. Exact failure: 1,081 changed pixels against 220; native trace confirms the stale view. The current helper also passed 30/30 with the original delayed native-sort control.                                                                             |
| sndc-engine:122 |                 0/10 Actions; earlier local busy-runner failures, raw lost; tighter prior observer 1/30 failed |                                                                          Final observer 30/30 local and 30/30 Actions | Require decoded sample and native clock progress. Actual tap storage timestamps acceptance. Native start precedes metadata inspection; causal controls show the old observer delayed real playback, and production delays still fail.                                                                                                         |
| live2:207       |                                                                                                   4/10 Actions |                                                                                                         30/30 Actions | Wall-origin matching loses/misidentifies clicks as native audio progresses differently. Observe actual sample clicks and draws on native output time.                                                                                                                                                                                         |
| phy:64          |                                                             10/10: seven camera-fit timeouts, three low stacks |                                                                                                         30/30 Actions | Turntable prevents fit settlement; stale projection sends drag rays to the wrong coordinates.                                                                                                                                                                                                                                                 |

The ten-repeat baseline is
[38997782641](https://github.com/ryanjosephkamp/splashery/actions/runs/38997782641). Nine families’
Actions receipts are in
[campaign 1](https://github.com/ryanjosephkamp/splashery/actions/runs/38999164406),
[campaign 2](https://github.com/ryanjosephkamp/splashery/actions/runs/39000195618),
[current image/sort and audio campaign 3](https://github.com/ryanjosephkamp/splashery/actions/runs/39004136389),
and [final Share stress](https://github.com/ryanjosephkamp/splashery/actions/runs/39008834947). The
final [mirror Actions run](https://github.com/ryanjosephkamp/splashery/actions/runs/39031197941)
completed 60/60: still 30/30 and low light 30/30, zero failures, retries, skips, or interruptions.
The matching local cohort also completed 60/60. These mirror receipts use source `9a16ae2ae`.

Final full-suite first-pass results on `499501064`, both attempt 1:

| Run                                                                                 |   Files | Passed | Failed | Existing skip | Result                                    |
| ----------------------------------------------------------------------------------- | ------: | -----: | -----: | ------------: | ----------------------------------------- |
| [39036877114](https://github.com/ryanjosephkamp/splashery/actions/runs/39036877114) | 398/398 |   3408 |      0 |             1 | Checks, all 16 shards, and Summary passed |
| [39036878610](https://github.com/ryanjosephkamp/splashery/actions/runs/39036878610) | 398/398 |   3404 |      4 |             1 | Four first-pass failures; Summary failed  |

Run 2 failed `cdx-a11y:196`, `chs-engine:11`, `hh5-animals:182`, and `lv7:393`. Each passed alone;
all four failures still count. The final report includes `chs-engine:11` in addition to the three
named in the Operator’s comment. Neither full run failed a test from the ten-family target list. The
one existing skip is `cdx-v3d-calibration:217`, whose private counterexample fixture is absent; it
is unchanged and outside the target list. No failed-job rerun is counted as a clean run.

Earlier full runs
[39031193271](https://github.com/ryanjosephkamp/splashery/actions/runs/39031193271) and
[39031195607](https://github.com/ryanjosephkamp/splashery/actions/runs/39031195607) each completed
398/398 files with 3407 passed, one failed, and one existing skip. Both failed `pages-r2:495`, also
alone and on then-current main. Native traces showed a real PDF raster upgrade between comparison
captures. A strict wait for the desired raster level, preserving every capture, assertion, and
timeout, passed the full 11-case file and 30/30 stressed WebGL2 repetitions. Neither earlier full
run is globally clean.

Full preflight on `499501064`, after merging main `69cd6c993`, passed 271/271 browser cases and all
six static gates. Follow-up main `c36c4dcd9` is merged with a new merge commit; the new full
preflight on `a9a1bca4f` passed 271/271 browser cases and all six static gates, without quick mode.
Source-specific validation passed 41/41 across `heb-engine`, `hh5-gems`, `shr`, and `rec1`, zero
failures, retries, or skips. The unchanged runtime/test source is `c7f553ac8`;
workflow/documentation follow-up is `a9a1bca4f`. Stress YAML parses, all five dispatch inputs are
retained, `tests.yml` matches main byte for byte, and receipt generation without a PR number
succeeds. The new workflow has not yet run on Actions. `tests/taps.spec.mjs` is untouched.

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
- Quartz: the retained native regression reproduces an earlier queued collision unpinning a joint
  after reseating. Impacts now drain before constraint stepping within each fixed substep. The
  generic-impact `knockable()` restriction and its tests are reverted in a separate commit; public
  impact behavior is restored. Historical intact-neighbor observations are not evidence that this
  reverted behavior belongs in the flake repair.
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
observations and forty PNGs. All observations enter the unchanged median. Height limits remain
0.00055/0.0135, shown-drift limits 0.95/2.2, and timeout 600000 ms. The original 20-frame noise
fixture and camera motions remain. Strict native-canvas/screenshot equivalence passed all RGBA bytes
and dimensions in 48/48 pairs. A twenty-observation real-motion control measured height 0.0354118
and shown drift 25.3967, exceeding both original clips’ limits. Four runtime controls passed without
reproducing the rare failure; these are not causal red/green proof.

Every changed existing expect line: `tests/fl.spec.mjs` 139, 142, and 145 (original 141, 144,
and 147) replace `expect(await fluidFiles(page)).toEqual([])` with
`expect(fluidFiles()).toEqual([])`; the collector is complete request events instead of bounded
Resource Timing, and the empty-list matcher is identical. `tests/fx4-engine.spec.mjs` 98
(original 96) and `tests/img-engine.spec.mjs` 104 (original 100) change only indentation of
`expect(errors).toEqual([])` after splitting per toy. No other existing expect line changes. The
low-light observation count increases rather than decreases. Added Engine and Share expect lines are
strict regressions and preservation controls.

Raw evidence is retained on
[`codex/flaky-tests-clips`](https://github.com/ryanjosephkamp/splashery/tree/d631648f0544f5c0503ab2dd9dfca228cfb1fc9f/docs/audits/flaky-tests-raw).
It includes failed candidates, complete reports, recipes, native controls, traces, preflight logs,
and generated screenshots with hashes. The final mirror Actions artifact, final full summaries, and
all four failed-shard artifacts are retained during this follow-up, with original ZIP hashes
verified against GitHub’s digests. This branch must never merge.

## Deviations

The original 12-hour campaign stopped at 14:06 UTC while the full runs were incomplete. This
follow-up implements the Operator’s review and records their completed first-pass results; it does
not restart an open-ended effort to fix unrelated failures. The extra PDF readiness repair is a
test-only change supported by original/current-main failures and native raster state.

Historical four-hour checkpoint (06:06 UTC): seven current-code families had complete stress
receipts, the native close-focus repair had local red/green proof, and mirror/Share stress and
full-run proof remained. Historical eight-hour checkpoint (10:06 UTC): nine families had complete
receipts; mirror remained unresolved after the combined candidate failed still 3/30. These
checkpoints are historical, not current status.

The first final preflight used port 4217, while two existing viewer cases hardcode fixtures on 4173.
It passed 269 and failed both fetches. Restoring standard port 4173, without source or assertion
changes, passed all 271. Its original log is retained; traces lost to Playwright cleanup are not
claimed. Three workspace resets lost some earlier receipts; lost evidence never counts. One early
audio commit preceded the whole-repository formatting gate; both checks passed before further
publication. Raw diff size required a temporary English-check preload raising only the subprocess
buffer to 256 MB; no lines were excluded and that preload is not shipped.

## Known issues

- Two globally clean full runs are not proved. Run 1 is clean apart from the pre-existing skip; run
  2 has the four unrelated failures listed above. Passing-alone rechecks do not erase them.
- Quartz’s historical final-target failure was not reproduced: the original passed 100/100. The
  `knockable()` behavior change is reverted at the Operator’s request. Earlier 30/30 Actions proof
  predates this revert; follow-up local stress on the restored behavior passed 30/30, zero failures,
  retries, skips, or interruptions.
- All failed mirror candidates remain retained, including the complete six-observation cohort (still
  30/30, low light 29/30; low height 0.0162116086 > 0.0135). Native tracing found input-noise
  sensitivity: 211 identical inputs gave identical raw outputs, ten coarse changes all completed
  their three-answer vote, and 65 fine-change chains began with actual coarse transitions. No
  pending-vote target mutation was observed. A longer noise fixture failed and was rejected.
- A related native check previously passed 52/53 under competing load: an unrelated 1 ms SoftParts
  benchmark measured 1.086 ms, then 0.410 ms alone. Its first failure remains recorded.

## What was cut

The public-toy generic-impact restriction from `bbace1372` and its associated added tests are
removed by an explicit new revert commit. Any future proposal to change that behavior belongs in a
separate owner-reviewed Engine PR with clips. The hit-ordering regression remains.

No target assertion is loosened, no target count is lowered, and no target test is removed,
quarantined, skipped, or retried. No production depth guard, stronger smoothing, changed noise
fixture, extra CDP session, or increased timeout is adopted.

Rule check: none.

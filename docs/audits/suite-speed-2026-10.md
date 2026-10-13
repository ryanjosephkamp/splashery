# Suite speed and load-dependent failures — October 13, 2026

**Status: incomplete; draft for the protected-file exception.** The full-suite 2× speed target is
not demonstrated, and several named flakes still lack a reproduced cause and 20 consecutive passes.
The timing inventory below explicitly marks missing measurements. Do not use the exploratory runs as
a before/after benchmark or remove the whole flaky list on the strength of this change.

## Checkout and machine

- Initial flake baseline: `main` at `49c809b4`; implementation branch: `codex/suite-speed`.
- Main advanced during the investigation. The branch merged `a31f69df` and the later docs-only
  `6bcebac2` and `555e8f5c` updates. Neither changed test or engine sources.
- A matching immutable benchmark baseline is prepared at `a31f69df` in
  `/tmp/splashery-suite-before-current`; its 255 files match current main's test inventory.
- Four-CPU quota (`cpu.max`: `400000 100000`), 17 GiB memory; commands used affinity
  `taskset -c 0-3`.
- Chromium `151.0.7922.173` at `/usr/bin/chromium`; pinned Playwright `1.56.1`.
- Default renderer: SwiftShader. Some focused checks used the existing `--gl=llvmpipe` option and
  Xvfb. These renderer modes are not interchangeable benchmark samples.
- The baseline was a detached checkout in `/tmp/splashery-suite-before`, with the same installed
  dependencies. No browser download or dependency change was made.
- The original baseline has 254 spec files. Updated main adds `man9`; this patch adds two
  infrastructure specs, for 257 current files.

The earlier [test-health audit](test-health-2026-10.md) concerns a different checkout and browser.
Its full-suite times, and the task's approximate 4.5-hour figure, are context, not measurements of
this branch. Task 29's completed root-cause report was not present in this checkout; its task brief
is not proof that those fixes were completed.

## Protected-file exception

[Task 50](../codex/50-suite-speed-flakes.md) says: “Toys and tests the open PRs change (#560, #562,
#566, #570, #576). Ask in the PR if a fix needs them.” Changed-file lists and current PR status were
read from GitHub. PRs #560, #562, #566, and #570 remain open. PR #576 merged during the
investigation and is included in the main merge above.

The actual `smoke:734` case is
`rigs pick splats by colour, run effects and show add-ons; shelf shapes have rigs`. Its untouched
test failed 8 of 10 repetitions with two Playwright workers and SwiftShader. All eight failures were
the strawberry return-to-rest comparison: about 82,000 pixels remained different, above the original
`moved / 4` limits. The assertion detecting the initial pop passed. No threshold, effect duration,
or protected source/test was changed. Read-only copies reproduced four more failures. At the failed
comparison, the camera was settled, pixel ratio stayed 1, and pulse state was still about 0.10–0.17.
PlayCanvas caps each update at 0.1 seconds of toy time, so the pulse can remain active beyond the
wall-clock comparison deadline. Waiting another 15 seconds for exact idle also failed under this
diagnostic load. Advancing the actual player through the existing pulse and waiting for a rendered
frame reduced the returned image difference to 4–5 pixels. Those copies then exposed the same
fixed-delay issue in the lantern return comparison (1,774 and 1,821 pixels against the unchanged 400
limit). The full candidate controls the real effect phases rather than the wall sleeps. Its ignored
copy passed both complete pilot repetitions with two SwiftShader workers under concurrent renderer
load (all original assertions and samples). The llvmpipe copy passed 20/20 complete repetitions with
two workers, zero skips/retries, 1188.333 seconds Playwright duration (1191.590 seconds process
wall), under concurrent renderer load. This is a proven candidate, not an applied protected-file
fix. The protected test remains unchanged. The PR must request
[the concrete patch](suite-speed-2026-10-smoke.patch) before it is applied. Its zero-context form
passes `git apply --check --unidiff-zero`; approval is required before actual application.

The formerly protected `man5` sharing-demo assertion expected port 4173. Before #576 merged, its
isolated-port run failed in 9.015 seconds at port 45093. After syncing updated main, the expected
origin now uses `new URL("../", page.url()).href`; QR decoding, equality, scene, and both viewport
cases are unchanged. Its focused test passed at both sizes. The equivalent editable PDF-fixture
origin in `tests/vw.spec.mjs` honors `SPLASHERY_PORT`; its three PDF checks also passed.

The clean four-mode benchmark matrix has not been completed. An initial baseline run was stopped
before it completed a file because concurrent diagnostic browsers contaminated its timing; it is
explicitly excluded. Protected smoke acceptance remains unresolved.

## Runner and measurement changes

Each concurrent suite lane binds its own Python server to port zero and retains it across files.
Binding reserves the port atomically. Explicit `SPLASHERY_PORT` assigns a lane range and rejects
occupied ports rather than silently sharing another checkout's server. Playwright runs through the
pinned Node entry point, without one `npx` wrapper per file.

Each report records the process wall time, exit code, port, and renderer. `run.json` records
startup, the requested file schedule, start/end times, browser path, and arguments. Missing reports,
top-level Playwright errors, abnormal exits, and empty reports cannot be reported as success. Signal
cancellation owns resources before startup finishes, blocks further lane work, and waits for
termination with bounded escalation. Existing solo-file and renderer lists were not extended.

`tools/suite-profile.mjs` parses actual JavaScript call sites and reads suite JSON receipts. It
distinguishes test-result durations from residual process/hook time; residual is not a measured
server-startup duration. It refuses aggregate speedup claims without complete, single-attempt,
matching original coverage, passing final outcomes, and one complete run's timestamps. Complete
baseline test failures are retained and explicitly labeled; their timeouts are part of the measured
cost, so that comparison is not described as two passing suites. Resumed reports, repetition proofs,
CDP-throttled proofs, changed skip coverage, and added infrastructure tests cannot silently inflate
a speedup claim. Whole-run comparisons require matching renderer/browser metadata. Both matched-job
comparisons and before jobs=1 to after jobs=2 are reported when complete.

Across the original 254 files, before merging the upstream manual additions, the static inventory
changed as follows:

| Call sites                        | Before |  After |
| --------------------------------- | -----: | -----: |
| Literal fixed waits               |    423 |    415 |
| Sum of literal wait arguments, ms | 461246 | 454846 |
| Dynamic fixed waits               |     10 |     10 |
| `goto`                            |    536 |    536 |
| `chooseToy`                       |    331 |    331 |
| `screenshot`                      |    266 |    266 |
| Clip/record calls                 |     11 |     11 |

These are source counts, not elapsed-time estimates. Loop counts, helper reuse, branches, and
dynamic arguments can multiply them. No screenshot, clip, toy sample, assertion threshold, retry
policy, or test selection was removed. Generated tracked screenshots are restored before the commit.
`tests/taps.spec.mjs` and `docs/OPERATOR.md` are unchanged.

## Reducing Worlds render cost

The tier-budget and planted-foot measurements now use 640×360 while retaining the default landscape
aspect. The full world, assets, forced tiers, locations, camera branch, warmup steps, and sample
steps remain unchanged. The separate screenshot cases still cover 390×844 and 1440×900. Every
original assertion and numerical threshold remains.

A 320×180 candidate clipped the start-screen button and was discarded; it is not a known-flake
reproduction. The retained size fits that screen. Its eight tier/location totals and all four
near-ground counts exactly matched the original-size pilot. Walk/run speed, slide, lift, and
animation-state measurements also matched exactly. The
[compact receipts](suite-speed-2026-10-results.json) include this comparison. These checks ran with
competing browsers and do not establish a speedup; only a clean before/after matrix can do that.

## Readiness and load controls

The readiness helper waits for camera easing, completed loading, a completed engine frame, the
current world state, and an applied splat sort. Stationary scenes can accept a sort already uploaded
when no sort is outstanding. Animated kit scenes can keep queuing sorts; the helper accepts an
applied result for the current world without requiring global queue drainage. Sharp photo view
deliberately disables splats, so its uploaded visible relief mesh has a separate completed-frame
condition.

Regression checks cover an already settled scene, rejection of a stale sort result, and a real
basketball camera move followed by a GPU pick. They passed. The stationary-scene regression failed
before its repair. Four browser-free cancellation regressions, two server/report regressions, and
two timing-report regressions passed (8/8 in the latest run). Three cancellation regressions failed
before repair. The complete-failed-baseline comparison and rejection of repeated proof data also
failed before their reporting repairs; the guards retain unchanged capability skips and reject newly
skipped coverage, interrupted attempts, retries, and failing final outcomes.

`SPLASHERY_CPU_RATE` provides opt-in CDP CPU throttling for fixture-created browser pages in the
named editable specs. At the default rate it exports the exact original Playwright test object, with
no added fixture hooks or CDP sessions. The requested-load annotation does not claim that a
separately launched browser, such as the microphone case, is throttled. A real-browser probe
verified that context/page factories await the CDP command. CPU throttling and competing renderers
are load proofs, never benchmark samples.

## Named flake ledger

References in Task 50 refer to source lines. Playwright's reported registration locations can
differ; titles identify the actual cases. “Not reproduced” does not mean fixed.

| Task reference     | Observed cause and change                                                                                                                                                                                                                                                                                                                                                                                                                     | Consecutive load proof                                                                                                                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `smoke:734`        | Protected smoke test and app/player paths (#570); untouched. Reproduced 8/10 failures at strawberry return-to-rest, about 82,000 differing pixels. Diagnostics identify clamped toy time. The unapplied phase-control candidate passed 20/20 complete copies under concurrent load; the protected test remains untouched.                                                                                                                     | Candidate copy: 20/20 passed, no skips/retries. Not applied to the protected test.                                                                                                                                               |
| `tpg:204`          | A service worker takes control after the first page and bypasses the mocked embed route. Three original attempts timed out at 240 seconds; seven remaining repetitions were interrupted, not completed. Block service workers in the two contexts that explicitly mock iframe content. Real embed tests remain real.                                                                                                                          | 20/20 passed, zero skips/retries, 811.514 seconds, under concurrent renderer load.                                                                                                                                               |
| `hl1:75`           | Two animation-frame callbacks do not fence asynchronous sort upload before a GPU pick. Replace them with actual rendered-world readiness. Root cause is supported by engine order and readiness regressions, not a completed original/fixed 20-run comparison.                                                                                                                                                                                | Latest full 40-toy sample: 2/2 tests passed, 244.991 seconds process wall. No 20-run proof.                                                                                                                                      |
| `stm:366`          | A model context appears before loading and input-panel replacement finish; an old visible warning can satisfy the next malformed-file check. Wait for loading completion, the named input panel, and this malformed file's warning. A loaded run also exceeded the lift-settle wall deadline because toy time is capped per rendered frame; advance the real player clock through the unchanged 3.2-second pulse. Original thresholds remain. | 20/20 passed, zero skips/retries, 1089.400 seconds Playwright duration (1091.486 seconds process wall), llvmpipe with CDP 2×.                                                                                                    |
| `fl7:49`, `fl7:95` | No new reproduced cause. Main already waits for the gas grid in the phone-envelope case. Only opt-in load instrumentation was added.                                                                                                                                                                                                                                                                                                          | Not obtained.                                                                                                                                                                                                                    |
| `qrs-toys:132`     | No historical healing failure was reproduced. Opt-in load instrumentation was added; no speculative assertion or toy change was made. The earlier ten three-code passes are a different case and are not healing proof.                                                                                                                                                                                                                       | Final code: 20/20 healing passes, zero skips/retries, 1083.568 seconds Playwright duration (1087.406 seconds process wall), llvmpipe with CDP 2×; frozen source hashes match.                                                    |
| `live4:149`        | Pause's fixed delay does not guarantee a frame clearing the remaining drive. Wait for stopped playback and stationary sand, retaining the one-second stability observation. CDP 4× reproduced Start over at position 0.606888 after a second browser round trip, above the unchanged 0.3-second limit; click and snapshot are now atomic. Extreme SwiftShader contention also missed the first tune's settlement; that failure is unresolved. | 20/20 passed, zero skips/retries, 515.710 seconds Playwright duration (516.873 seconds process wall), llvmpipe with CDP 4× and no other browser jobs. Extreme competing-renderer failures remain unresolved.                     |
| `phy:64`           | Screen projections used during camera easing/turntable motion can select the wrong stone. Disable automatic turntable motion in this manual-clock test and wait for the real camera/frame. Six whole-file checks passed under load; no changed physics threshold.                                                                                                                                                                             | 20/20 passed in the 80-test concurrent-renderer run. Final deadline preservation occurred during the run; a frozen final-code 20-run proof is still due.                                                                         |
| `ui4:42`           | Original desktop drag fired only `[38,39,40]`, failing the unchanged `>5` crossing assertion. The 1500 ms delay did not settle the easing camera before projecting finger points. Wait for camera and rendered-world readiness. Both sizes and all four whole-file checks passed under load.                                                                                                                                                  | 20/20 passed at each size in the 80-test concurrent-renderer run; see checkpoint qualification below.                                                                                                                            |
| `wd:187`, `wd:210` | No new reproduced cause for tier budgets or screenshots. Opt-in load instrumentation and a smaller logic-test viewport were added; all tier/location counts matched exactly. Screenshot sizes stay unchanged.                                                                                                                                                                                                                                 | Not obtained.                                                                                                                                                                                                                    |
| `wdr3:133`         | No new reproduced cause for planted-foot measurements. Opt-in load instrumentation and a smaller logic-test viewport were added; every walk/run metric matched exactly.                                                                                                                                                                                                                                                                       | Final code: 20/20 passed, zero skips/retries, 3391.101 seconds Playwright duration (3393.668 seconds process wall), llvmpipe with CDP 2×; all 20 walk/run metric tuples match the original-size pilot, and frozen sources match. |
| `smd-moving:101`   | No new reproduced cause for sample builds. The moving-photo source is protected by #560; no speculative source change was made.                                                                                                                                                                                                                                                                                                               | Not obtained.                                                                                                                                                                                                                    |
| `hh5-gems:119`     | The crystal-ball test read rendered mist and its live body in separate browser tasks, allowing a physics step between snapshots. Read both atomically and retain the original `1e-6` offset assertion. Camera/screenshot delays now use readiness. All five whole-file checks passed under load.                                                                                                                                              | 20/20 passed in the 80-test concurrent-renderer run; see checkpoint qualification below.                                                                                                                                         |
| `p3d`              | A custom-photo context is assigned before its new input panel is connected; a following invalid file can target the retiring panel. Wait for completed loading and the named replacement panel. Replace sample/screenshot sleeps with real readiness, including Sharp relief view. Latest full file: 10/10 passed under competing renderer load, 413.048 seconds process wall.                                                                | No 20-run full-file proof.                                                                                                                                                                                                       |

The 80-test proof took 2287.230 seconds, with zero failures, skips, or retries. Each of its four
case titles had 20 passes. It began before the stationary-scene fallback was added to the shared
readiness helper and before the physics camera deadline was restored to its original 30 seconds.
These are checkpoint receipts; the final helpers have separate regressions, but a fresh frozen-code
proof is still required before removing these entries from the flaky list.

## Exploratory timing receipts

These runs overlapped diagnostic/proof browsers. They are measurements of that workload, not the
clean before/after matrix. The seven-file run used earlier helper versions for some files;
subsequent focused checks verify the later repairs. Do not aggregate them into a full-suite speedup.

| File       | Suite jobs=2 process wall, s | Passed / failed / skipped |
| ---------- | ---------------------------: | ------------------------- |
| `stm`      |                          267 | 19 / 1 / 0                |
| `tpg`      |                          294 | 11 / 0 / 0                |
| `hh5-gems` |                          440 | 5 / 0 / 0                 |
| `p3d`      |                          412 | 8 / 2 / 0                 |
| `phy`      |                          549 | 6 / 0 / 0                 |
| `ui4`      |                          330 | 4 / 0 / 0                 |
| `live4`    |                          197 | 0 / 2 / 0                 |

The fresh WD proof failed with 3 passes, 1 timeout, and 36 unrun cases after the first failure. Its
trace showed both world loads completing (48.761 and 64.467 seconds), all manual steps finishing,
and both screenshots returning (13.122 and 30.951 seconds). The original 240-second test deadline
expired around final close/teardown. This is aggregate cost under stacked jobs, not evidence of a
stale-state assertion. The deadline remains unchanged. A controlled CDP 2× rerun is still required.

Two further HL1 repetitions completed before its concurrent-load queue was interrupted during the
third. These are checkpoint attempts, not a 20-run proof. The full 2,229-test Playwright check was
stopped after test 57 started, to remove extra contention. It produced no complete JSON report and
is not reported as green. Its raw-log checksum and interruption details are retained in the compact
results.

Latest focused STM check passed after the player-clock repair. Latest P3D full-file check passed
after Sharp-view readiness. The original isolated-port manual test failed; its allowed repair passed
after #576 merged. Raw local logs and JSON receipts are under `.cache/suite-speed/`;
[compact results](suite-speed-2026-10-results.json) and checksums are retained with this audit so
these conclusions do not require temporary logs.

## Required checks and publication

The task requires a draft PR, not a merge. The full suite is not green and the four-mode benchmark
is incomplete. The published draft passed `npx prettier --check .`,
`node tools/us-english.mjs --diff`, and `git diff --check`. These checks must pass again before the
next push. The protected-path intersection and generated screenshot diff are empty.

## Remaining acceptance work

1. Approve and apply the concrete protected smoke repair requested in the draft PR.
2. Reproduce the remaining named flakes and obtain 20 consecutive load passes for each final patch,
   including the protected smoke case and the unresolved audio contention case.
3. Freeze the code, stop all load generators, and complete four fresh whole-suite runs on the same
   four-CPU machine and renderer: before jobs=1/jobs=2, after jobs=1/jobs=2.
4. Generate the comparison using the original spec inventory. If the measured ratio is below 2×,
   continue optimization without removing coverage. The current patch is not evidence that this
   acceptance target has been met.

Reproduce the profile once the four directories contain complete reports:

```sh
node tools/suite-profile.mjs \
  --original-specs-dir=/tmp/splashery-suite-before-current/tests \
  --before-jobs1=.cache/suite-speed/clean-before-jobs1 \
  --before-jobs2=.cache/suite-speed/clean-before-jobs2 \
  --after-jobs1=.cache/suite-speed/clean-after-jobs1 \
  --after-jobs2=.cache/suite-speed/clean-after-jobs2
```

## Per-file cost inventory and benchmark coverage

All four clean timing modes remain unmeasured. The following table lists every original spec,
updated main’s `man9`, and the two added infrastructure specs, so missing files are visible. Counts
are static current-source call sites with the limitations described above.

| File                    | Literal waits | Literal ms | goto | chooseToy | Screenshots | Clip/record calls | Before jobs=1 (w/t/r) | Before jobs=2 (w/t/r) | After jobs=1 (w/t/r) | After jobs=2 (w/t/r) |
| ----------------------- | ------------: | ---------: | ---: | --------: | ----------: | ----------------: | --------------------- | --------------------- | -------------------- | -------------------- |
| abb                     |             2 |       2200 |    1 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| ai                      |             1 |       1500 |    1 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| ai-engine               |             0 |          0 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| an                      |             1 |        800 |    2 |         2 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| an-engine               |             0 |          0 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| arc                     |             0 |          0 |    2 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| arc-engine              |             3 |        900 |    1 |         2 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| arc2                    |             0 |          0 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| arc2-engine             |             0 |          0 |    1 |         2 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| arc3                    |             0 |          0 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| asc                     |             4 |       5900 |    1 |         0 |           2 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| asc-core                |             0 |          0 |    1 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| asc-engine              |             0 |          0 |    1 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| asc-repeat              |             2 |        600 |    1 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| asc-unit                |             0 |          0 |    1 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| asc2                    |             0 |          0 |    3 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| bk                      |             3 |        640 |    1 |         7 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| bk5                     |             0 |          0 |    3 |         3 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| bk5-engine              |             0 |          0 |    1 |         4 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| bkd                     |             2 |       1100 |    1 |         1 |           4 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| bkd-format              |             0 |          0 |    0 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| bld                     |             0 |          0 |    0 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| cdx-depth               |             0 |          0 |    5 |         0 |           0 |                 1 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| cdx-depth-ui            |             0 |          0 |    1 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| cdx-gallery             |             0 |          0 |    1 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| cdx-mir                 |             0 |          0 |    3 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| chem                    |             0 |          0 |    0 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| chr                     |             0 |          0 |    1 |         0 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| chs                     |             2 |       4000 |    1 |         1 |           2 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| chs-engine              |             0 |          0 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| cmp2-engine             |             0 |          0 |    1 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| cmp2-enigma             |             0 |          0 |    0 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| cmp2-shots              |             1 |       1500 |    1 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| cmp2-sort               |             0 |          0 |    0 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| dcl                     |             1 |       2500 |    2 |         3 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| dsm-samples             |             0 |          0 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| e4f                     |             0 |          0 |    0 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| e5                      |             1 |       1500 |    1 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| e6a                     |             1 |       1500 |    1 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| e6b                     |             0 |          0 |    0 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| evidence-computing      |             0 |          0 |    1 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| f                       |            10 |       7800 |    1 |         2 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| fb                      |             1 |       2000 |    1 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| fid                     |             0 |          0 |    1 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| fix3                    |             1 |       1500 |    1 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| fl                      |             2 |       2000 |    3 |         8 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| fl7                     |             2 |       2300 |    3 |         5 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| fx10                    |             0 |          0 |    0 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| fx4                     |             1 |       1500 |    2 |         2 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| fx4-engine              |             1 |       1500 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| fx5                     |             1 |       1500 |    1 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| fx6                     |             1 |        800 |    4 |         2 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| fx6-2                   |             8 |      10500 |    1 |         1 |           3 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| fx6-engine              |             3 |       1500 |    4 |         4 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| fx7                     |             8 |       7050 |    1 |         1 |           8 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| fx8                     |             1 |       1500 |    2 |         0 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| fx9                     |             2 |       3300 |    2 |         2 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| fx9-engine              |             1 |        800 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| g                       |             1 |       1500 |    3 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| geo                     |             1 |       1500 |    2 |         2 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hea                     |             1 |        300 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hea-engine              |             1 |        300 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| heb                     |             1 |        800 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| heb-engine              |             0 |          0 |    0 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hec                     |             1 |        400 |    1 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hec-engine              |             0 |          0 |    0 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| help                    |             4 |       6400 |    2 |         1 |           3 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hh1-balls               |             0 |          0 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hh1-clothing            |             0 |          0 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hh1-engine              |             0 |          0 |    2 |         3 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hh1-shapes              |             0 |          0 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hh1-toys                |             0 |          0 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hh2-engine              |             1 |        800 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hh2-food                |             1 |        800 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hh2-nature              |             1 |        800 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hh3-crossbow            |             1 |        800 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hh3-engine              |             3 |       1800 |    3 |         3 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hh3-engine2             |             1 |        800 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hh3-holidays            |             1 |        800 |    2 |         2 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hh3-level1              |             0 |          0 |    2 |         2 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hh3-level1-engine       |             1 |        600 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hh3-medieval            |             1 |        800 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hh3-music               |             1 |        800 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hh3-open-me             |             1 |        800 |    2 |         2 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hh3-pictures            |             2 |       2300 |    2 |         2 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hh3-sort                |             2 |       1400 |    1 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hh3-storybook           |             0 |          0 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hh4-engine              |             0 |          0 |    4 |         4 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hh4-landmarks           |             1 |        500 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hh4-space               |             1 |        500 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hh4-tiny                |             1 |        500 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hh4-vehicles            |             1 |        500 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hh4-weather             |             1 |        500 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hh5-ai                  |             2 |       1400 |    1 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hh5-animals             |             2 |       1400 |    1 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hh5-atoms               |             2 |       1400 |    1 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hh5-body                |             2 |       1400 |    1 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hh5-engine              |             0 |          0 |    0 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hh5-gems                |             0 |          0 |    1 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hh5-math                |             2 |       1400 |    1 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hl1                     |             0 |          0 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| hta                     |             0 |          0 |    1 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| img                     |             0 |          0 |    0 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| img-engine              |             2 |       1900 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| kit                     |             0 |          0 |    0 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| klab                    |             0 |          0 |    0 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| klab-engine             |             0 |          0 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| lab                     |             0 |          0 |    2 |         2 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| lab-engine              |             0 |          0 |    3 |         4 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| lat                     |             2 |       3000 |    1 |         1 |           2 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| live                    |             5 |      15750 |    2 |         2 |           7 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| live-engine             |             1 |        600 |    1 |         4 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| live2                   |             6 |       5900 |    1 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| live2-engine            |             2 |       3000 |    2 |         2 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| live3                   |             7 |       8650 |    1 |         1 |           0 |                 3 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| live3-engine            |             0 |          0 |    3 |         3 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| live4                   |             4 |       4250 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| live5                   |             4 |       2750 |    2 |         3 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| live6                   |             9 |       8650 |    1 |         1 |           0 |                 1 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| ln                      |             0 |          0 |    2 |         0 |           2 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| lv10                    |             4 |       6350 |    4 |         4 |           3 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| lv7                     |            15 |      22050 |    5 |         5 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| lv7-engine              |             0 |          0 |    0 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| lv7-long                |             4 |       6250 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| lv8                     |             0 |          0 |    1 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| lv8-dial                |             0 |          0 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| lv9                     |            11 |       5800 |    3 |         3 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| lv9-2                   |             4 |        900 |    2 |         2 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| man                     |             3 |       4600 |    6 |         2 |           2 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| man2                    |             0 |          0 |    1 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| man3                    |             0 |          0 |    5 |         0 |           2 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| man3-2                  |             0 |          0 |   16 |         0 |           5 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| man4                    |             2 |       1500 |   16 |         0 |           6 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| man4-pages              |             1 |        300 |   13 |         0 |           4 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| man5                    |             0 |          0 |    6 |         0 |           2 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| man6                    |             0 |          0 |    7 |         0 |           6 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| man7a                   |             3 |       3800 |   10 |         0 |           3 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| man7b                   |             0 |          0 |    1 |         0 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| man9 (added)            |             3 |       1700 |   14 |         0 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| math                    |             1 |       1500 |    7 |         3 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| mca                     |             1 |       1500 |    1 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| mol                     |             0 |          0 |    2 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| mol-engine              |             0 |          0 |    2 |         2 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| mt2                     |             1 |       1500 |    1 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| opm                     |             0 |          0 |    0 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| ops-media               |             0 |          0 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| ops-text                |             1 |       3000 |    1 |         4 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| opt                     |             3 |       1300 |    3 |         2 |           4 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| p3d                     |             0 |          0 |    2 |         2 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| pdf                     |             6 |       7200 |    5 |         4 |           0 |                 1 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| pdf-engine              |             0 |          0 |    1 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| pdp                     |             1 |        700 |    2 |         2 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| pdp-engine              |             1 |        200 |    2 |         3 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| pg6                     |             0 |          0 |    3 |         5 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| pg6-engine              |             0 |          0 |    1 |         2 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| phf                     |             2 |       1750 |    2 |         4 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| phf-engine              |             0 |          0 |    1 |         3 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| phf2                    |             1 |       1500 |    1 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| phy                     |             1 |       1500 |    1 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| phy-engine              |             2 |        820 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| pic                     |             1 |        500 |    9 |         3 |           2 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| pno                     |             0 |          0 |    1 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| pno-engine              |             0 |          0 |    1 |         6 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| pose                    |             1 |        600 |    3 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| pose-engine             |             0 |          0 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| pot                     |             0 |          0 |    2 |         2 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| pot-engine              |             0 |          0 |    2 |         5 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| pr2                     |             0 |          0 |    0 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| psv                     |             4 |       4600 |    1 |         2 |           3 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| psv2                    |             3 |       1400 |    1 |         3 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| psv3                    |             0 |          0 |    1 |         3 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| qr                      |             2 |        800 |    3 |         2 |           3 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| qr3                     |             0 |          0 |    2 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| qr4-2                   |             0 |          0 |    3 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| qr4-2-engine            |             0 |          0 |    1 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| qr4-craft               |             0 |          0 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| qr4-flash               |             3 |       7500 |    2 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| qr4-scan                |             0 |          0 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| qr5                     |             4 |      10500 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| qrc-barcodes            |             1 |        500 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| qrc-build               |             1 |        500 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| qrc-picture             |             1 |       4500 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| qrl                     |             0 |          0 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| qrs-heal                |             0 |          0 |    0 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| qrs-steps               |             0 |          0 |    0 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| qrs-study               |             0 |          0 |    0 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| qrs-toys                |             8 |      16300 |    1 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| rel                     |             4 |       6150 |    1 |         1 |           3 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| rel-engine              |             0 |          0 |    0 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| ro                      |             2 |       1100 |    1 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| sci                     |             1 |       1500 |    2 |         4 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| sci-engine              |             0 |          0 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| sci3                    |             0 |          0 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| sci3-engine             |             0 |          0 |    1 |         2 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| scr                     |             1 |        800 |    1 |         1 |           2 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| scr-engine              |             0 |          0 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| scr2                    |             2 |       1600 |    1 |         1 |           3 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| scr2-engine             |             0 |          0 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| sha                     |             1 |       2000 |    1 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| sha-book                |             1 |       2000 |    1 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| shb                     |             1 |       2500 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| shb-engine              |             0 |          0 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| shp                     |             0 |          0 |    2 |         7 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| shv                     |             2 |       1900 |    5 |         2 |           2 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| shw                     |             1 |        600 |    5 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| site                    |             4 |       8400 |   23 |         0 |           2 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| sky                     |             3 |       4100 |    5 |         2 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| sky-engine              |             0 |          0 |    1 |         2 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| sll                     |             6 |       5750 |    1 |         1 |           6 |                 3 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| smd-compare             |             1 |        300 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| smd-models              |             0 |          0 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| smd-moving              |             0 |          0 |    2 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| smd-photo               |             0 |          0 |    0 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| smoke                   |            44 |      55120 |   12 |         0 |          58 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| snda                    |             2 |       2000 |    3 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| snda-engine             |             2 |        800 |    3 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| sndb                    |             1 |        800 |    4 |         3 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| sndc                    |             7 |       3600 |    1 |         2 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| sndc-engine             |             6 |       3700 |    2 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| sndd                    |             0 |          0 |    0 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| sng                     |             3 |       4200 |    2 |         2 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| sp2                     |             1 |       2000 |    2 |         2 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| sp3                     |             1 |       1500 |    1 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| sp4                     |             1 |        800 |    1 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| spg                     |             0 |          0 |   12 |         0 |           7 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| st2                     |             5 |       1600 |   22 |         0 |           2 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| st3                     |             0 |          0 |    2 |         0 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| st4                     |             4 |       8100 |   30 |         0 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| st4-engine              |             0 |          0 |    2 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| st5                     |             0 |          0 |    2 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| stm                     |             0 |          0 |    2 |         2 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| stm-engine              |             0 |          0 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| sts                     |             5 |       5600 |    2 |         2 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| sts-engine              |             0 |          0 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| suite-readiness (added) |             0 |          0 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| suite-runner (added)    |             0 |          0 |    0 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| taps                    |             0 |          0 |    0 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| tp2                     |             2 |       3000 |    2 |         0 |           2 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| tp2-engine              |             4 |       4000 |    1 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| tpg                     |             1 |       1500 |    8 |         0 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| tpg-engine              |             0 |          0 |    1 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| tw2-cells               |             1 |       1500 |    1 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| tw2-dna                 |             0 |          0 |    0 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| ui2                     |            13 |       4366 |    2 |         1 |          11 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| ui3                     |             7 |       6800 |    1 |         1 |           3 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| ui4                     |             3 |       2600 |    1 |         1 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| ui4-engine              |             5 |       4700 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| ui5                     |             4 |       4700 |    1 |         1 |           4 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| ui5-engine              |             3 |       1600 |    1 |         1 |           7 |                 2 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| unit                    |             0 |          0 |    0 |         0 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| v3d                     |             3 |       3100 |    2 |         3 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| vol                     |             0 |          0 |    1 |         1 |           0 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| vw                      |             1 |        300 |    1 |         9 |           2 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| vwr                     |             5 |       6100 |    3 |         4 |           2 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| wd                      |             0 |          0 |    4 |         0 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| wdh                     |             1 |        500 |    1 |         0 |           2 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |
| wdr3                    |             2 |       1200 |    2 |         0 |           1 |                 0 | unmeasured            | unmeasured            | unmeasured           | unmeasured           |

Current source totals: 418 literal waits, 456546 literal ms, 10 dynamic wait call sites.

Added files excluded from comparisons: `man9`, `suite-readiness`, `suite-runner`. Removed original
files: none.

## Measurement coverage

### before-jobs1

Directory: not supplied. 0/254 original files reported; 0 comparable.

Measured-file sums: unmeasured wall seconds, unmeasured test seconds, unmeasured residual seconds, 0
registered tests, 0 attempts, 0 failures, 0 skipped.

Whole-run elapsed: unmeasured seconds. Recorded server/display startup: unmeasured seconds.
Whole-run wall cannot be reconstructed by adding concurrent file walls.

Missing: `abb`, `ai`, `ai-engine`, `an`, `an-engine`, `arc`, `arc-engine`, `arc2`, `arc2-engine`,
`arc3`, `asc`, `asc-core`, `asc-engine`, `asc-repeat`, `asc-unit`, `asc2`, `bk`, `bk5`,
`bk5-engine`, `bkd`, `bkd-format`, `bld`, `cdx-depth`, `cdx-depth-ui`, `cdx-gallery`, `cdx-mir`,
`chem`, `chr`, `chs`, `chs-engine`, `cmp2-engine`, `cmp2-enigma`, `cmp2-shots`, `cmp2-sort`, `dcl`,
`dsm-samples`, `e4f`, `e5`, `e6a`, `e6b`, `evidence-computing`, `f`, `fb`, `fid`, `fix3`, `fl`,
`fl7`, `fx10`, `fx4`, `fx4-engine`, `fx5`, `fx6`, `fx6-2`, `fx6-engine`, `fx7`, `fx8`, `fx9`,
`fx9-engine`, `g`, `geo`, `hea`, `hea-engine`, `heb`, `heb-engine`, `hec`, `hec-engine`, `help`,
`hh1-balls`, `hh1-clothing`, `hh1-engine`, `hh1-shapes`, `hh1-toys`, `hh2-engine`, `hh2-food`,
`hh2-nature`, `hh3-crossbow`, `hh3-engine`, `hh3-engine2`, `hh3-holidays`, `hh3-level1`,
`hh3-level1-engine`, `hh3-medieval`, `hh3-music`, `hh3-open-me`, `hh3-pictures`, `hh3-sort`,
`hh3-storybook`, `hh4-engine`, `hh4-landmarks`, `hh4-space`, `hh4-tiny`, `hh4-vehicles`,
`hh4-weather`, `hh5-ai`, `hh5-animals`, `hh5-atoms`, `hh5-body`, `hh5-engine`, `hh5-gems`,
`hh5-math`, `hl1`, `hta`, `img`, `img-engine`, `kit`, `klab`, `klab-engine`, `lab`, `lab-engine`,
`lat`, `live`, `live-engine`, `live2`, `live2-engine`, `live3`, `live3-engine`, `live4`, `live5`,
`live6`, `ln`, `lv10`, `lv7`, `lv7-engine`, `lv7-long`, `lv8`, `lv8-dial`, `lv9`, `lv9-2`, `man`,
`man2`, `man3`, `man3-2`, `man4`, `man4-pages`, `man5`, `man6`, `man7a`, `man7b`, `math`, `mca`,
`mol`, `mol-engine`, `mt2`, `opm`, `ops-media`, `ops-text`, `opt`, `p3d`, `pdf`, `pdf-engine`,
`pdp`, `pdp-engine`, `pg6`, `pg6-engine`, `phf`, `phf-engine`, `phf2`, `phy`, `phy-engine`, `pic`,
`pno`, `pno-engine`, `pose`, `pose-engine`, `pot`, `pot-engine`, `pr2`, `psv`, `psv2`, `psv3`, `qr`,
`qr3`, `qr4-2`, `qr4-2-engine`, `qr4-craft`, `qr4-flash`, `qr4-scan`, `qr5`, `qrc-barcodes`,
`qrc-build`, `qrc-picture`, `qrl`, `qrs-heal`, `qrs-steps`, `qrs-study`, `qrs-toys`, `rel`,
`rel-engine`, `ro`, `sci`, `sci-engine`, `sci3`, `sci3-engine`, `scr`, `scr-engine`, `scr2`,
`scr2-engine`, `sha`, `sha-book`, `shb`, `shb-engine`, `shp`, `shv`, `shw`, `site`, `sky`,
`sky-engine`, `sll`, `smd-compare`, `smd-models`, `smd-moving`, `smd-photo`, `smoke`, `snda`,
`snda-engine`, `sndb`, `sndc`, `sndc-engine`, `sndd`, `sng`, `sp2`, `sp3`, `sp4`, `spg`, `st2`,
`st3`, `st4`, `st4-engine`, `st5`, `stm`, `stm-engine`, `sts`, `sts-engine`, `taps`, `tp2`,
`tp2-engine`, `tpg`, `tpg-engine`, `tw2-cells`, `tw2-dna`, `ui2`, `ui3`, `ui4`, `ui4-engine`, `ui5`,
`ui5-engine`, `unit`, `v3d`, `vol`, `vw`, `vwr`, `wd`, `wdh`, `wdr3`.

Excluded or incomplete: none. Reports outside original inventory: none.

### before-jobs2

Directory: not supplied. 0/254 original files reported; 0 comparable.

Measured-file sums: unmeasured wall seconds, unmeasured test seconds, unmeasured residual seconds, 0
registered tests, 0 attempts, 0 failures, 0 skipped.

Whole-run elapsed: unmeasured seconds. Recorded server/display startup: unmeasured seconds.
Whole-run wall cannot be reconstructed by adding concurrent file walls.

Missing: `abb`, `ai`, `ai-engine`, `an`, `an-engine`, `arc`, `arc-engine`, `arc2`, `arc2-engine`,
`arc3`, `asc`, `asc-core`, `asc-engine`, `asc-repeat`, `asc-unit`, `asc2`, `bk`, `bk5`,
`bk5-engine`, `bkd`, `bkd-format`, `bld`, `cdx-depth`, `cdx-depth-ui`, `cdx-gallery`, `cdx-mir`,
`chem`, `chr`, `chs`, `chs-engine`, `cmp2-engine`, `cmp2-enigma`, `cmp2-shots`, `cmp2-sort`, `dcl`,
`dsm-samples`, `e4f`, `e5`, `e6a`, `e6b`, `evidence-computing`, `f`, `fb`, `fid`, `fix3`, `fl`,
`fl7`, `fx10`, `fx4`, `fx4-engine`, `fx5`, `fx6`, `fx6-2`, `fx6-engine`, `fx7`, `fx8`, `fx9`,
`fx9-engine`, `g`, `geo`, `hea`, `hea-engine`, `heb`, `heb-engine`, `hec`, `hec-engine`, `help`,
`hh1-balls`, `hh1-clothing`, `hh1-engine`, `hh1-shapes`, `hh1-toys`, `hh2-engine`, `hh2-food`,
`hh2-nature`, `hh3-crossbow`, `hh3-engine`, `hh3-engine2`, `hh3-holidays`, `hh3-level1`,
`hh3-level1-engine`, `hh3-medieval`, `hh3-music`, `hh3-open-me`, `hh3-pictures`, `hh3-sort`,
`hh3-storybook`, `hh4-engine`, `hh4-landmarks`, `hh4-space`, `hh4-tiny`, `hh4-vehicles`,
`hh4-weather`, `hh5-ai`, `hh5-animals`, `hh5-atoms`, `hh5-body`, `hh5-engine`, `hh5-gems`,
`hh5-math`, `hl1`, `hta`, `img`, `img-engine`, `kit`, `klab`, `klab-engine`, `lab`, `lab-engine`,
`lat`, `live`, `live-engine`, `live2`, `live2-engine`, `live3`, `live3-engine`, `live4`, `live5`,
`live6`, `ln`, `lv10`, `lv7`, `lv7-engine`, `lv7-long`, `lv8`, `lv8-dial`, `lv9`, `lv9-2`, `man`,
`man2`, `man3`, `man3-2`, `man4`, `man4-pages`, `man5`, `man6`, `man7a`, `man7b`, `math`, `mca`,
`mol`, `mol-engine`, `mt2`, `opm`, `ops-media`, `ops-text`, `opt`, `p3d`, `pdf`, `pdf-engine`,
`pdp`, `pdp-engine`, `pg6`, `pg6-engine`, `phf`, `phf-engine`, `phf2`, `phy`, `phy-engine`, `pic`,
`pno`, `pno-engine`, `pose`, `pose-engine`, `pot`, `pot-engine`, `pr2`, `psv`, `psv2`, `psv3`, `qr`,
`qr3`, `qr4-2`, `qr4-2-engine`, `qr4-craft`, `qr4-flash`, `qr4-scan`, `qr5`, `qrc-barcodes`,
`qrc-build`, `qrc-picture`, `qrl`, `qrs-heal`, `qrs-steps`, `qrs-study`, `qrs-toys`, `rel`,
`rel-engine`, `ro`, `sci`, `sci-engine`, `sci3`, `sci3-engine`, `scr`, `scr-engine`, `scr2`,
`scr2-engine`, `sha`, `sha-book`, `shb`, `shb-engine`, `shp`, `shv`, `shw`, `site`, `sky`,
`sky-engine`, `sll`, `smd-compare`, `smd-models`, `smd-moving`, `smd-photo`, `smoke`, `snda`,
`snda-engine`, `sndb`, `sndc`, `sndc-engine`, `sndd`, `sng`, `sp2`, `sp3`, `sp4`, `spg`, `st2`,
`st3`, `st4`, `st4-engine`, `st5`, `stm`, `stm-engine`, `sts`, `sts-engine`, `taps`, `tp2`,
`tp2-engine`, `tpg`, `tpg-engine`, `tw2-cells`, `tw2-dna`, `ui2`, `ui3`, `ui4`, `ui4-engine`, `ui5`,
`ui5-engine`, `unit`, `v3d`, `vol`, `vw`, `vwr`, `wd`, `wdh`, `wdr3`.

Excluded or incomplete: none. Reports outside original inventory: none.

### after-jobs1

Directory: not supplied. 0/254 original files reported; 0 comparable.

Measured-file sums: unmeasured wall seconds, unmeasured test seconds, unmeasured residual seconds, 0
registered tests, 0 attempts, 0 failures, 0 skipped.

Whole-run elapsed: unmeasured seconds. Recorded server/display startup: unmeasured seconds.
Whole-run wall cannot be reconstructed by adding concurrent file walls.

Missing: `abb`, `ai`, `ai-engine`, `an`, `an-engine`, `arc`, `arc-engine`, `arc2`, `arc2-engine`,
`arc3`, `asc`, `asc-core`, `asc-engine`, `asc-repeat`, `asc-unit`, `asc2`, `bk`, `bk5`,
`bk5-engine`, `bkd`, `bkd-format`, `bld`, `cdx-depth`, `cdx-depth-ui`, `cdx-gallery`, `cdx-mir`,
`chem`, `chr`, `chs`, `chs-engine`, `cmp2-engine`, `cmp2-enigma`, `cmp2-shots`, `cmp2-sort`, `dcl`,
`dsm-samples`, `e4f`, `e5`, `e6a`, `e6b`, `evidence-computing`, `f`, `fb`, `fid`, `fix3`, `fl`,
`fl7`, `fx10`, `fx4`, `fx4-engine`, `fx5`, `fx6`, `fx6-2`, `fx6-engine`, `fx7`, `fx8`, `fx9`,
`fx9-engine`, `g`, `geo`, `hea`, `hea-engine`, `heb`, `heb-engine`, `hec`, `hec-engine`, `help`,
`hh1-balls`, `hh1-clothing`, `hh1-engine`, `hh1-shapes`, `hh1-toys`, `hh2-engine`, `hh2-food`,
`hh2-nature`, `hh3-crossbow`, `hh3-engine`, `hh3-engine2`, `hh3-holidays`, `hh3-level1`,
`hh3-level1-engine`, `hh3-medieval`, `hh3-music`, `hh3-open-me`, `hh3-pictures`, `hh3-sort`,
`hh3-storybook`, `hh4-engine`, `hh4-landmarks`, `hh4-space`, `hh4-tiny`, `hh4-vehicles`,
`hh4-weather`, `hh5-ai`, `hh5-animals`, `hh5-atoms`, `hh5-body`, `hh5-engine`, `hh5-gems`,
`hh5-math`, `hl1`, `hta`, `img`, `img-engine`, `kit`, `klab`, `klab-engine`, `lab`, `lab-engine`,
`lat`, `live`, `live-engine`, `live2`, `live2-engine`, `live3`, `live3-engine`, `live4`, `live5`,
`live6`, `ln`, `lv10`, `lv7`, `lv7-engine`, `lv7-long`, `lv8`, `lv8-dial`, `lv9`, `lv9-2`, `man`,
`man2`, `man3`, `man3-2`, `man4`, `man4-pages`, `man5`, `man6`, `man7a`, `man7b`, `math`, `mca`,
`mol`, `mol-engine`, `mt2`, `opm`, `ops-media`, `ops-text`, `opt`, `p3d`, `pdf`, `pdf-engine`,
`pdp`, `pdp-engine`, `pg6`, `pg6-engine`, `phf`, `phf-engine`, `phf2`, `phy`, `phy-engine`, `pic`,
`pno`, `pno-engine`, `pose`, `pose-engine`, `pot`, `pot-engine`, `pr2`, `psv`, `psv2`, `psv3`, `qr`,
`qr3`, `qr4-2`, `qr4-2-engine`, `qr4-craft`, `qr4-flash`, `qr4-scan`, `qr5`, `qrc-barcodes`,
`qrc-build`, `qrc-picture`, `qrl`, `qrs-heal`, `qrs-steps`, `qrs-study`, `qrs-toys`, `rel`,
`rel-engine`, `ro`, `sci`, `sci-engine`, `sci3`, `sci3-engine`, `scr`, `scr-engine`, `scr2`,
`scr2-engine`, `sha`, `sha-book`, `shb`, `shb-engine`, `shp`, `shv`, `shw`, `site`, `sky`,
`sky-engine`, `sll`, `smd-compare`, `smd-models`, `smd-moving`, `smd-photo`, `smoke`, `snda`,
`snda-engine`, `sndb`, `sndc`, `sndc-engine`, `sndd`, `sng`, `sp2`, `sp3`, `sp4`, `spg`, `st2`,
`st3`, `st4`, `st4-engine`, `st5`, `stm`, `stm-engine`, `sts`, `sts-engine`, `taps`, `tp2`,
`tp2-engine`, `tpg`, `tpg-engine`, `tw2-cells`, `tw2-dna`, `ui2`, `ui3`, `ui4`, `ui4-engine`, `ui5`,
`ui5-engine`, `unit`, `v3d`, `vol`, `vw`, `vwr`, `wd`, `wdh`, `wdr3`.

Excluded or incomplete: none. Reports outside original inventory: none.

### after-jobs2

Directory: not supplied. 0/254 original files reported; 0 comparable.

Measured-file sums: unmeasured wall seconds, unmeasured test seconds, unmeasured residual seconds, 0
registered tests, 0 attempts, 0 failures, 0 skipped.

Whole-run elapsed: unmeasured seconds. Recorded server/display startup: unmeasured seconds.
Whole-run wall cannot be reconstructed by adding concurrent file walls.

Missing: `abb`, `ai`, `ai-engine`, `an`, `an-engine`, `arc`, `arc-engine`, `arc2`, `arc2-engine`,
`arc3`, `asc`, `asc-core`, `asc-engine`, `asc-repeat`, `asc-unit`, `asc2`, `bk`, `bk5`,
`bk5-engine`, `bkd`, `bkd-format`, `bld`, `cdx-depth`, `cdx-depth-ui`, `cdx-gallery`, `cdx-mir`,
`chem`, `chr`, `chs`, `chs-engine`, `cmp2-engine`, `cmp2-enigma`, `cmp2-shots`, `cmp2-sort`, `dcl`,
`dsm-samples`, `e4f`, `e5`, `e6a`, `e6b`, `evidence-computing`, `f`, `fb`, `fid`, `fix3`, `fl`,
`fl7`, `fx10`, `fx4`, `fx4-engine`, `fx5`, `fx6`, `fx6-2`, `fx6-engine`, `fx7`, `fx8`, `fx9`,
`fx9-engine`, `g`, `geo`, `hea`, `hea-engine`, `heb`, `heb-engine`, `hec`, `hec-engine`, `help`,
`hh1-balls`, `hh1-clothing`, `hh1-engine`, `hh1-shapes`, `hh1-toys`, `hh2-engine`, `hh2-food`,
`hh2-nature`, `hh3-crossbow`, `hh3-engine`, `hh3-engine2`, `hh3-holidays`, `hh3-level1`,
`hh3-level1-engine`, `hh3-medieval`, `hh3-music`, `hh3-open-me`, `hh3-pictures`, `hh3-sort`,
`hh3-storybook`, `hh4-engine`, `hh4-landmarks`, `hh4-space`, `hh4-tiny`, `hh4-vehicles`,
`hh4-weather`, `hh5-ai`, `hh5-animals`, `hh5-atoms`, `hh5-body`, `hh5-engine`, `hh5-gems`,
`hh5-math`, `hl1`, `hta`, `img`, `img-engine`, `kit`, `klab`, `klab-engine`, `lab`, `lab-engine`,
`lat`, `live`, `live-engine`, `live2`, `live2-engine`, `live3`, `live3-engine`, `live4`, `live5`,
`live6`, `ln`, `lv10`, `lv7`, `lv7-engine`, `lv7-long`, `lv8`, `lv8-dial`, `lv9`, `lv9-2`, `man`,
`man2`, `man3`, `man3-2`, `man4`, `man4-pages`, `man5`, `man6`, `man7a`, `man7b`, `math`, `mca`,
`mol`, `mol-engine`, `mt2`, `opm`, `ops-media`, `ops-text`, `opt`, `p3d`, `pdf`, `pdf-engine`,
`pdp`, `pdp-engine`, `pg6`, `pg6-engine`, `phf`, `phf-engine`, `phf2`, `phy`, `phy-engine`, `pic`,
`pno`, `pno-engine`, `pose`, `pose-engine`, `pot`, `pot-engine`, `pr2`, `psv`, `psv2`, `psv3`, `qr`,
`qr3`, `qr4-2`, `qr4-2-engine`, `qr4-craft`, `qr4-flash`, `qr4-scan`, `qr5`, `qrc-barcodes`,
`qrc-build`, `qrc-picture`, `qrl`, `qrs-heal`, `qrs-steps`, `qrs-study`, `qrs-toys`, `rel`,
`rel-engine`, `ro`, `sci`, `sci-engine`, `sci3`, `sci3-engine`, `scr`, `scr-engine`, `scr2`,
`scr2-engine`, `sha`, `sha-book`, `shb`, `shb-engine`, `shp`, `shv`, `shw`, `site`, `sky`,
`sky-engine`, `sll`, `smd-compare`, `smd-models`, `smd-moving`, `smd-photo`, `smoke`, `snda`,
`snda-engine`, `sndb`, `sndc`, `sndc-engine`, `sndd`, `sng`, `sp2`, `sp3`, `sp4`, `spg`, `st2`,
`st3`, `st4`, `st4-engine`, `st5`, `stm`, `stm-engine`, `sts`, `sts-engine`, `taps`, `tp2`,
`tp2-engine`, `tpg`, `tpg-engine`, `tw2-cells`, `tw2-dna`, `ui2`, `ui3`, `ui4`, `ui4-engine`, `ui5`,
`ui5-engine`, `unit`, `v3d`, `vol`, `vw`, `vwr`, `wd`, `wdh`, `wdr3`.

Excluded or incomplete: none. Reports outside original inventory: none.

## Comparable original coverage

Jobs=1: no complete-coverage speedup claim. Missing pairs: 254; excluded pairs: 0; changed
test/project/outcome coverage: 0; removed original files: 0.

Jobs=2: no complete-coverage speedup claim. Missing pairs: 254; excluded pairs: 0; changed
test/project/outcome coverage: 0; removed original files: 0.

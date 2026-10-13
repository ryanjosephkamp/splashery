# Suite speed and load-dependent failures — October 13, 2026

**Status: incomplete; draft for the protected-file exception.** The full-suite 2× speed target is
not demonstrated, and several named flakes still lack a reproduced cause and 20 consecutive passes.
The timing inventory below explicitly marks missing measurements. Do not use the exploratory runs as
a before/after benchmark or remove the whole flaky list on the strength of this change.

## Checkout and machine

- Baseline: `main` at `49c809b4`; implementation branch: `codex/suite-speed`.
- Four-CPU quota (`cpu.max`: `400000 100000`), 17 GiB memory; commands used affinity
  `taskset -c 0-3`.
- Chromium `151.0.7922.173` at `/usr/bin/chromium`; pinned Playwright `1.56.1`.
- Default renderer: SwiftShader. Some focused checks used the existing `--gl=llvmpipe` option and
  Xvfb. These renderer modes are not interchangeable benchmark samples.
- The baseline was a detached checkout in `/tmp/splashery-suite-before`, with the same installed
  dependencies. No browser download or dependency change was made.
- The baseline has 254 spec files; this branch adds two infrastructure specs.

The earlier [test-health audit](test-health-2026-10.md) concerns a different checkout and browser.
Its full-suite times, and the task's approximate 4.5-hour figure, are context, not measurements of
this branch. Task 29's completed root-cause report was not present in this checkout; its task brief
is not proof that those fixes were completed.

## Protected-file exception

[Task 50](../codex/50-suite-speed-flakes.md) says: “Toys and tests the open PRs change (#560, #562, #566, #570, #576). Ask in the PR if a
fix needs them.” The changed-file lists were read from GitHub. `tests/man5.spec.mjs` is protected by
#576 and was left unchanged.

Its sharing-demo assertion at source line 386 expects port 4173. The demo correctly encodes the
current page's origin. Running that test on the isolated server at port 45093 produced the correct
QR URL with that port, then failed its literal comparison. The targeted run took 9.015 seconds
including the Playwright process, with one failure and zero skips. This is a deterministic
compatibility failure caused by port isolation, not a newly discovered product defect.

The concrete requested exception is to replace the expected URL expression:

```js
new URL("../", `http://127.0.0.1:4173/manual/share.html`).href + `#s=${hash}`;
```

with:

```js
new URL("../", page.url()).href + `#s=${hash}`;
```

The assertion, QR decoding, scene, and both viewport cases remain the same. There is no port-4173
fallback, skipped test, quarantine, or change to the production sharing URL. The equivalent editable
PDF-fixture origin in `tests/vw.spec.mjs` now honors `SPLASHERY_PORT`; its three PDF checks passed
on an isolated port.

Full acceptance remains blocked on this exception. The clean four-mode benchmark matrix has not been
completed. An initial baseline run was stopped before it completed a file because concurrent
diagnostic browsers contaminated its timing; it is explicitly excluded.

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
server-startup duration. It refuses aggregate speedup claims without complete, successful,
single-attempt, matching original coverage and one complete run's timestamps. Resumed reports and
added infrastructure tests cannot silently inflate a speedup claim.

Across the original 254 files, the static inventory changed as follows:

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

## Readiness and load controls

The readiness helper waits for camera easing, completed loading, a completed engine frame, the
current world state, and an applied splat sort. Stationary scenes can accept a sort already uploaded
when no sort is outstanding. Animated kit scenes can keep queuing sorts; the helper accepts an
applied result for the current world without requiring global queue drainage. Sharp photo view
deliberately disables splats, so its uploaded visible relief mesh has a separate completed-frame
condition.

Regression checks cover an already settled scene, rejection of a stale sort result, and a real
basketball camera move followed by a GPU pick. They passed. The stationary-scene regression failed
before its repair. Four browser-free cancellation regressions plus two server/report regressions
passed; three cancellation regressions failed before repair.

`SPLASHERY_CPU_RATE` provides opt-in CDP CPU throttling for fixture-created browser pages in the
named editable specs. At the default rate it exports the exact original Playwright test object, with
no added fixture hooks or CDP sessions. The requested-load annotation does not claim that a
separately launched browser, such as the microphone case, is throttled. A real-browser probe
verified that context/page factories await the CDP command. CPU throttling and competing renderers
are load proofs, never benchmark samples.

## Named flake ledger

References in Task 50 refer to source lines. Playwright's reported registration locations can
differ; titles identify the actual cases. “Not reproduced” does not mean fixed.

| Task reference     | Observed cause and change                                                                                                                                                                                                                                                                                                                                                                                                                     | Consecutive load proof                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `smoke:734`        | Protected smoke test and app/player paths (#570); untouched.                                                                                                                                                                                                                                                                                                                                                                                  | Not obtained.                                                                      |
| `tpg:204`          | A service worker takes control after the first page and bypasses the mocked embed route. Three original attempts timed out at 240 seconds; seven remaining repetitions were interrupted, not completed. Block service workers in the two contexts that explicitly mock iframe content. Real embed tests remain real.                                                                                                                          | 20/20 passed, zero skips/retries, 811.514 seconds, under concurrent renderer load. |
| `hl1:75`           | Two animation-frame callbacks do not fence asynchronous sort upload before a GPU pick. Replace them with actual rendered-world readiness. Root cause is supported by engine order and readiness regressions, not a completed original/fixed 20-run comparison.                                                                                                                                                                                | Latest full 40-toy sample: 2/2 tests passed, 244.991 seconds process wall. No 20-run proof. |
| `stm:366`          | A model context appears before loading and input-panel replacement finish; an old visible warning can satisfy the next malformed-file check. Wait for loading completion, the named input panel, and this malformed file's warning. A loaded run also exceeded the lift-settle wall deadline because toy time is capped per rendered frame; advance the real player clock through the unchanged 3.2-second pulse. Original thresholds remain. | 20/20 passed, zero skips/retries, 1089.400 seconds Playwright duration (1091.486 seconds process wall), llvmpipe with CDP 2×. |
| `fl7:49`, `fl7:95` | No new reproduced cause. Main already waits for the gas grid in the phone-envelope case. Only opt-in load instrumentation was added.                                                                                                                                                                                                                                                                                                          | Not obtained.                                                                      |
| `qrs-toys:132`     | No reproduced cause for the healing assertion. One healing run passed at CDP 4×. Ten original three-code runs passed under concurrent load, but those are a different case and do not prove healing.                                                                                                                                                                                                                                          | No 20-run proof for healing.                                                       |
| `live4:149`        | Pause's fixed delay does not guarantee a frame clearing the remaining drive. Wait for stopped playback and stationary sand, retaining the one-second stability observation. CDP 4× reproduced Start over at position 0.606888 after a second browser round trip, above the unchanged 0.3-second limit; click and snapshot are now atomic. Extreme SwiftShader contention also missed the first tune's settlement; that failure is unresolved. |20/20 passed, zero skips/retries, 515.710 seconds Playwright duration (516.873 seconds process wall), llvmpipe with CDP 4× and no other browser jobs. Extreme competing-renderer failures remain unresolved. |
| `phy:64`           | Screen projections used during camera easing/turntable motion can select the wrong stone. Disable automatic turntable motion in this manual-clock test and wait for the real camera/frame. Six whole-file checks passed under load; no changed physics threshold.                                                                                                                                                                             | 20/20 passed in the 80-test concurrent-renderer run. Final deadline preservation occurred during the run; a frozen final-code 20-run proof is still due. |
| `ui4:42`           | Original desktop drag fired only `[38,39,40]`, failing the unchanged `>5` crossing assertion. The 1500 ms delay did not settle the easing camera before projecting finger points. Wait for camera and rendered-world readiness. Both sizes and all four whole-file checks passed under load.                                                                                                                                                  | 20/20 passed at each size in the 80-test concurrent-renderer run; see checkpoint qualification below. |
| `wd:187`, `wd:210` | No new reproduced cause for tier budgets or screenshots. Only opt-in load instrumentation was added.                                                                                                                                                                                                                                                                                                                                          | Not obtained.                                                                      |
| `wdr3:133`         | No new reproduced cause for planted-foot measurements. Only opt-in load instrumentation was added.                                                                                                                                                                                                                                                                                                                                            | Not obtained.                                                                      |
| `smd-moving:101`   | No new reproduced cause for sample builds. The moving-photo source is protected by #560; no speculative source change was made.                                                                                                                                                                                                                                                                                                               | Not obtained.                                                                      |
| `hh5-gems:119`     | The crystal-ball test read rendered mist and its live body in separate browser tasks, allowing a physics step between snapshots. Read both atomically and retain the original `1e-6` offset assertion. Camera/screenshot delays now use readiness. All five whole-file checks passed under load.                                                                                                                                              | 20/20 passed in the 80-test concurrent-renderer run; see checkpoint qualification below. |
| `p3d`              | A custom-photo context is assigned before its new input panel is connected; a following invalid file can target the retiring panel. Wait for completed loading and the named replacement panel. Replace sample/screenshot sleeps with real readiness, including Sharp relief view. Latest full file: 10/10 passed under competing renderer load, 413.048 seconds process wall.                                                                | No 20-run full-file proof.                                                         |

The 80-test proof took 2287.230 seconds, with zero failures, skips, or retries. Each of its four case titles had 20 passes. It began before the stationary-scene fallback was added to the shared readiness helper and before the physics camera deadline was restored to its original 30 seconds. These are checkpoint receipts; the final helpers have separate regressions, but a fresh frozen-code proof is still required before removing these entries from the flaky list.

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

Latest focused STM check passed after the player-clock repair. Latest P3D full-file check passed
after Sharp-view readiness. The isolated-port manual test failed as documented. Raw local logs and
JSON receipts are under `.cache/suite-speed/`; [compact results](suite-speed-2026-10-results.json) and checksums are retained with this
audit so these conclusions do not require temporary logs.

## Required checks and publication

The task requires a draft PR, not a merge. The full suite is not green and the four-mode benchmark is incomplete. Required `npx prettier --check .`, `node tools/us-english.mjs --diff`, and `git diff --check` must pass on the final staged changes before publication. The protected-path intersection and generated screenshot diff are empty.

## Remaining acceptance work

1. Approve and apply the protected `man5` expected-origin repair.
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
  --original-specs-dir=/tmp/splashery-suite-before/tests \
  --before-jobs1=.cache/suite-speed/clean-before-jobs1 \
  --before-jobs2=.cache/suite-speed/clean-before-jobs2 \
  --after-jobs1=.cache/suite-speed/clean-after-jobs1 \
  --after-jobs2=.cache/suite-speed/clean-after-jobs2
```

## Per-file cost inventory and benchmark coverage

All four clean timing modes remain unmeasured. The following table lists every original spec plus
the two added infrastructure specs, so missing files are visible. Counts are static current-source
call sites with the limitations described above.

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

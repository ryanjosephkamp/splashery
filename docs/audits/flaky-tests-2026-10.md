# Busy-runner flaky tests — October 17, 2026

Task 100, built by Codex (GPT-6). **Work in progress.** No 30-run proof or clean full-suite run is
claimed yet. The run started at about 2:06 a.m. UTC, with a 12-hour limit.

The immutable baseline is main at `ceb51de7a015377d7f350119c27a792fc1a8a66d`. Baseline tests run
from a separate checkout, so candidate changes cannot affect their results.

## Reproduction

The container has a four-CPU quota (`cpu.max`: `400000 100000`). Node 22.20.0 and Chromium
141.0.7390.37 (Playwright build 1194) are pinned. The renderer is SwiftShader, with the checked-in
Playwright configuration, original deadlines, and no retries. The initial Node 24 exploratory run
was interrupted and is excluded from the rates: its ESM source locations did not match the files.

`tools/flaky-tests.mjs` runs all ten families with four workers and `--fully-parallel`. The initial
before run planned ten repetitions and was stopped after three complete repetitions of every
variant; interrupted repetitions are excluded. Acceptance uses 30. Each variant must pass all 30:
both mirror clips, both preview sizes, and every toy in each split shader test. Reports retain the
actual title, renderer, result, duration, error, and failure trace. Exploratory diagnostic runs are
identified separately and do not count as acceptance proofs.

```sh
SPLASHERY_CHROMIUM=/path/to/chromium \
  /path/to/node22 tools/flaky-tests.mjs \
  --root=/path/to/baseline --repeat=10 --workers=4 --out=/path/to/before
SPLASHERY_CHROMIUM=/path/to/chromium \
  /path/to/node22 tools/flaky-tests.mjs \
  --repeat=30 --workers=4 --out=/path/to/after
```

The runner records its command, source commit and diff, runtime, renderer, CPU quota, and exit
status. Raw reports and stress evidence belong on `codex/flaky-tests-clips`, which must never be
merged. Counts below will be filled from completed JSON reports, not estimated from running jobs.

| Original case     | Before failures / completed                                           | After passes / completed | Cause and status                                                                                                                                                                                                                                                                                               |
| ----------------- | --------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cdx-mir:294`     | Still 0/3; low-light 0/3                                              | Pending                  | Renderer-specific drift cause not established.                                                                                                                                                                                                                                                                 |
| `fl:137`          | 0/3 natural                                                           | Pending                  | Resource Timing overflow: the recovered Actions trace has 286 earlier resources, a successful runtime.js response, and an empty timing query. Controlled reproduction of buffer saturation is pending.                                                                                                         |
| `hh1-toys:258`    | 0/3 natural; 2/41 controlled camera poses                             | Pending                  | An unfinished camera fit and stale rendered projection change the throw. The test now waits for the camera and an actual rendered frame before its unchanged gesture and settling window. Controlled candidate proof is pending.                                                                               |
| `shr:202`         | Phone 1/3; desktop 0/3                                                | Pending                  | Third take: preview remained hidden after Stop. Native recorder and dialog lifecycle diagnosis is pending.                                                                                                                                                                                                     |
| `hh5-gems:154`    | 0/3 natural                                                           | Pending                  | Recovered Actions state: broken=false, pinned=false, distance from home 0.39477 against 0.01. State-transition instrumentation is prepared; the cause is not yet established.                                                                                                                                  |
| `fx4-engine:79`   | 3/3 timed out at 240 seconds                                          | Pilot: 1/1 per toy       | Three toy comparisons shared one deadline. Split by toy; all old/new/new shader loads and pixel assertions remain.                                                                                                                                                                                             |
| `img-engine:85`   | 3/3 timed out at 240 seconds                                          | Pilot: 1/1 per toy       | The same loop deadline issue reproduced. The reported bouncy-ball pixel failure still needs investigation.                                                                                                                                                                                                     |
| `sndc-engine:122` | Original mix 0/30; repaired-song mix 1/30, with unchanged sample test | Pending                  | Reproduced 32.2 ms against the unchanged 30 ms limit. Native-clock, source-buffer, and startup instrumentation is next.                                                                                                                                                                                        |
| `live2:207`       | 30/30 in stable baseline                                              | 30/30                    | Wall-origin matching lost clicks as the native audio clock advanced more slowly than wall time. The observer now stamps actual samples and actual draws against native output time. All 12 clicks were observed in every candidate run; a deliberate 120 ms clock error still fails the unchanged 50 ms limit. |
| `phy:64`          | 3/3                                                                   | Pilot: 1/1               | Stale rendered projection: screenPoint and the inverse drag ray used different camera matrices. A completed frame corrected the first target from x/z 0.311/-0.531 to the intended 0.500/-0.300 and produced the required stack. Turntable-only and longer hold probes did not fix it.                         |

The initial broad baseline used four workers on SwiftShader. Later exploratory browser probes added
varying competing load; the raw recipe and reports preserve that distinction. The stable audio
comparison uses a separate fixed-load recipe. Pilot results are exploratory, not 30-run acceptance.

## Recovered Actions evidence

The official GitHub connector retrieved the raw artifacts after direct log downloads failed. These
historical failures identify symptoms; they are not an unbiased failure-rate sample.

- [Run 38993103887](https://github.com/ryanjosephkamp/splashery/actions/runs/38993103887), shard 14:
  still mirror shown jitter 0.98115079 against 0.95; isolated recheck 0.72513228.
- [Run 38948731903](https://github.com/ryanjosephkamp/splashery/actions/runs/38948731903), shard 15:
  the fluid runtime returned HTTP 200 after resource 286 of the final navigation, while the query
  used by the test returned no fluid resources. That same run measured mirror jitter 0.98167989.
- [Run 38963703459](https://github.com/ryanjosephkamp/splashery/actions/runs/38963703459), shard 12:
  quartz was unbroken but unpinned, 0.39477135 from home; its isolated recheck passed.

The dispatch-only stress mode in the existing Tests workflow can compare any immutable revision with
four workers and two steady CPU burners. Normal pull-request and full-suite dispatch behavior is
retained. Every selected variant keeps its original timeout and zero retries. Receipts include
complete assertion errors; raw artifacts retain the source recipe, hashes, logs, JSON, and traces.

## Task 50

Reviewed [PR 581](https://github.com/ryanjosephkamp/splashery/pull/581), its audit, runner, load
fixture, and render-readiness helper. The camera repairs reuse its explicit turntable shutdown and
camera-fit readiness check. A completed frame additionally refreshes PlayCanvas’ cached projection
before projecting a gesture. Its broader suite-runner changes and unrelated test repairs are not
copied into this task. Any additional reuse will be named here.

## Coverage and verification gates

No tolerance, count, sample, screenshot size, or deadline has been lowered or widened. The shader
loops retain every toy and each old/new/new comparison, now under a separate original deadline per
toy. Existing adapter guards are unchanged. `tests/taps.spec.mjs` is untouched, and `phy:64` stays
on the known list until its proof passes. Changed assertion lines will be inventoried in the PR.

Still required: finish reproduction, establish the remaining causes, pass each variant 30/30 under
its recorded stress recipe, run two clean full Actions suites, merge current main, and pass
preflight. There is no completed-task claim at this checkpoint.

Rule check: none.

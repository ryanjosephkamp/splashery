# Renderer diagnostics: task 71

Reconstructed by Codex from `docs/codex/71-renderer-diagnostics.md` on October 14, 2026. Made by
Ryan with Codex (GPT-6), under Splashery's MIT license. This implementation and its verification are
new; earlier sessions' test reports are not evidence for this code.

## Review follow-up

The task branch incorporates main `6c3764ff9a1aa3fbba202af12d6764ac23ed2d6e`, including the renderer
resolution-cap changes from PR #589. The new Engine commit
`040feaec965dfb5496cef3100a976d7bf4d407fc` preserves the exact factory return value and promise when
no diagnostics are registered, including an absent device and a synchronous error. Its new browser
test starts a real Worlds view and a real toy Stage through `pc.js`, checks the actual vendored
factory's canvas, options, and returned device, and checks that browser methods stay unchanged and
no report appears. No device is mocked in those two starts.

The separate fallback commit `d36a656819cbde9b470f4a164ea23a0473cd24c7` moves the app and embed UI
into `src/renderer-fallback.js`. The Engine module now contains observations, state tracking, and
report serialization. Published checkpoints remain in history; splitting those original commits
would require rewriting history, prohibited by builders Rule E1. The two follow-up commits separate
the new Engine and fallback work without doing that.

The browser calls need temporary observation because `pc.js` sees only the final factory result: the
vendored engine can reject a WebGPU device and then successfully choose WebGL2. Observing the
existing `requestAdapter`, `requestDevice`, and `getContext` calls records those intermediate
outcomes and errors without an extra capability probe, a different device order, or an edit to
protected `stage.js` or `vendor/`. Shared WebGPU observations and locked APIs remain explicitly
qualified in the report.

Details styles stay inline in the fallback module because the task protects `styles.css`, owned by
PR #591, even though that PR has since merged. The text uses American English and the serial comma.
The expanded diagnostic suite passed **18 tests in 34.322 seconds**, with five unit cases, ten
deliberately forced browser cases, the real Worlds/toy Stage boundary case, and two real toy-frame
bitmap cases.

## Current verification

The later main update `4907a003a43be0be97ce25403d94f6f1e9208600` is also incorporated. It changes
documentation, depth lab image inputs, and generators; production source and the task test files are
unchanged. Source hashes still match the tested checkpoint.

All **50 smoke cases** now have completed outcomes. This includes the **43 previously unrun cases**
and the previously interrupted clay/JSON case. The source checkpoint is
`d36a656819cbde9b470f4a164ea23a0473cd24c7`; all recorded source hashes still match. No existing
test, assertion, warning filter, or rendering threshold was changed.

| Spec                            | Passed | Failed | Skipped | Unrun |
| ------------------------------- | -----: | -----: | ------: | ----: |
| Diagnostics                     |     18 |      0 |       0 |     0 |
| Unit                            |     20 |      0 |       0 |     0 |
| Taps                            |     62 |      0 |       0 |     0 |
| Help                            |      9 |      5 |       0 |     0 |
| Smoke, including embed transfer |     18 |     31 |       1 |     0 |
| Total                           |    127 |     36 |       1 |     0 |

Diagnostics passed in **34.322 seconds**. Fresh unit/tap checks passed in **61.161 seconds**. The
unchanged captured-honeybee transfer check passed again at **9.2 MiB**. The native WebGPU case
skipped for lack of an adapter. Narrow-view and simulated-DPR checks used desktop Chromium; they are
not physical phone tests.

The first smoke/help attempt ended without a final reporter summary after **13 passes and 29
failures**, leaving 22 cases incomplete. Per-case list output and failure traces preserve those 42
completed outcomes. Two sequential continuation batches completed the remaining cases: **7 passed /
4 failed** in **418.095 seconds**, and **7 passed / 3 failed / 1 skipped** in **497.920 seconds**.
One selector setup invocation matched no cases; using leaf titles corrected the selection without
changing any assertion. Its output is preserved too. No total wall time is claimed for the attempt
that lost its final summary.

The complete smoke/help pass through the files had **31 console-warning failures**, two help-line
visibility timeouts, two zero-pixel motion failures, and one stale reset-status failure. Clay
addition, erasure, and JSON replay reached and passed their semantic assertions, then failed at the
final empty-console assertion on automatic software-WebGL/readback warnings.

### Plain-main comparisons

Production files were unchanged in both detached main worktrees. The smoke and help specs match the
task branch byte for byte. Both used the same safe Chromium configuration, one worker, zero retries,
and unchanged assertions.

| Main snapshot                              | Selected cases | Passed | Failed | Skipped | Seconds |
| ------------------------------------------ | -------------: | -----: | -----: | ------: | ------: |
| `6c3764ff9a1aa3fbba202af12d6764ac23ed2d6e` |             10 |      1 |      8 |       1 | 463.241 |
| `58f3d8ede13714bf4b3d1f99fbf3b29d7f60e492` |              2 |      0 |      2 |       0 |  50.343 |

On current main, the ten cases were the refreshed/linked help line, both help-clearance viewports,
startup without console problems, clay/JSON replay, forced fallback, cat-head motion, rig effects,
Reset everything, and WebGPU selection. The earlier main snapshot ran only the two help-clearance
viewports. The machine-readable record lists every exact case and result; this was a selected
comparison, not a full main-suite run.

Current main reproduced the startup/clay console warnings and both zero-pixel failures: cat-head
motion returned **0** against **>1,500**, and rig effects returned **0** against **>3,000**. The
forced fallback passed, and WebGPU skipped. The refreshed help case reached its console assertion.
Both clearance cases failed on null help-line bounds: reading `y` at 390×844 and `x` at 1440×900.
The earlier main snapshot reproduced both null-box failures as well.

The desktop capture failure also appears in
[PR #197](https://github.com/ryanjosephkamp/splashery/pull/197), whose complete 100-file list
contains no production changes. This confirms the desktop capture failure independently of this
implementation. It does **not** establish the five-pixel help-line/status overlap as preexisting:
that overlap was not reproduced in the task's 390×844 clearance checks, and the main controls
stopped before completing their clearance measurements. Its origin and physical phone behavior
remain unresolved.

Reset failed at different steps. The task branch completed reset but retained “in the colors of
France” in the status. Current main stopped earlier because “Tap again to reset” reverted to “Reset
everything.” That control does not confirm the later stale-status assertion.

An isolated rerun of the three differing help cases took **79.978 seconds** and had **3 failures**:
the refreshed link failed on console warnings, and both clearance cases failed on null bounds,
matching the current-main signatures. The earlier visibility timeouts remain preserved; the failure
step varies between runs. No claim about their timing cause is made.

Commands used the task configuration throughout:

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test \
  -c tests/cdx-renderer-diag.config.mjs tests/cdx-renderer-diag.spec.mjs --workers=1
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test \
  -c tests/cdx-renderer-diag.config.mjs tests/smoke.spec.mjs tests/help.spec.mjs \
  --workers=1 --max-failures=0 --reporter=list,json
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test \
  -c tests/cdx-renderer-diag.config.mjs tests/unit.spec.mjs tests/taps.spec.mjs \
  --workers=1 --max-failures=0 --reporter=list,json
```

Continuation and comparison commands additionally selected the exact leaf titles with `--grep`. The
main worktrees used a copy of that configuration with only the test directory, server working
directory, and artifact directory adjusted. All failure traces, logs, partial-run records, and 13
generated standard screenshots remain outside Git in the ignored workspace cache. Those standard
screenshots were restored after preservation.

## Behavior

The app and embed retain `body[data-ready="true"]` as page settlement, including the fallback. They
also expose `data-page-settled`, `data-renderer-ready`, and `data-first-toy-frame`. The latter two
also appear on the player's canvas. Custom elements mark their canvas without marking the containing
page. The player emits `renderer-ready` and `first-toy-frame`.

Renderer readiness follows successful player initialization. First-toy-frame requires a completed
render with a loaded toy, a positive renderer splat count, submitted draw calls, and no lost
context. An update tick or a finished data download cannot set it. The diagnostic smoke checks also
read a direct canvas bitmap after rendering and require more than 2,000 opaque nonwhite pixels. HTML
controls, the fallback poster, and transparent blank pixels cannot satisfy that check.

The `pc.js` boundary retains the graphics-device error object before `stage.js` wraps it. The
wrapper's cause points to that original exception, retaining any nested cause. Temporary observers
record existing adapter requests, device requests, WebGL2 context results, and context-creation
errors. They restore the original methods after startup and issue no extra probes. A non-GPU
initialization failure remains distinct from a created device. Locked APIs are reported as
observation limits. A cached adapter probe can leave the current player's outcome as not requested;
that does not mean an adapter is available. WebGPU calls can be shared by overlapping players, which
the report identifies; they cannot invent a WebGPU attempt for a WebGL2-only player.

The fallback's Details control opens a read-only local report with a Copy report button and manual
selection if clipboard access fails. Diagnostics stay in memory and are never written to storage or
sent over the network. The report does not collect browser identity, page URLs, or GPU vendor
identifiers. Guidance says a recent browser and hardware acceleration may help and acknowledges that
managed or cloud browsers may have no graphics device.

## Ownership and validation setup

`stage.js`, the existing smoke and taps specs, `index.html`, `styles.css`, and `vendor/` are
unchanged by this task relative to its current main base. A complete paginated check found no
overlap with the changed files of PRs #560, #562, #581, #582, #588, #589, and #591. The stricter
smoke coverage lives in the new diagnostic spec because the existing smoke spec belongs to another
open PR. The normal device selection, device options, rendering path, saved scenes, and old ready
flag retain their behavior.

Validation uses `tests/cdx-renderer-diag.config.mjs`, with one worker, normal graphics capability
detection, no graphics override arguments, and `chromiumSandbox: true`. It also removes Playwright's
implicit security overrides and its default feature-disabling list, including HTTPS upgrades and
storage partitioning. The repository's default graphics configuration was not used. No browser was
installed. Linux x86_64 cloud execution uses `/usr/bin/chromium`, version 151.0.7922.173. Viewport
captures at 390×844 are desktop Chromium captures, not phone-device tests.

## Initial reconstruction evidence

The initial reconstruction, before the review follow-up and main update, had a final diagnostic run
of **16 tests in 25.2 seconds**. Four use unit fakes, ten use a real browser with deliberately
forced errors or clipboard behavior, and two use the actual initialized WebGL2 backend and its
rendered canvas pixels. One forced WebGPU device rejection uses a mocked adapter followed by real
WebGL2 success; it is not native WebGPU render evidence.

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test \
  -c tests/cdx-renderer-diag.config.mjs tests/cdx-renderer-diag.spec.mjs --workers=1
```

The unit, taps, and exact transfer checks passed **83 tests in 1.3 minutes**: 20 unit tests, 62 taps
tests, and one transfer test. The captured honeybee embed at the strong profile transferred **9.2
MiB**, below the existing 30 MiB assertion. The original transfer assertion was unchanged.

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test \
  -c tests/cdx-renderer-diag.config.mjs \
  tests/unit.spec.mjs tests/taps.spec.mjs tests/smoke.spec.mjs \
  --grep 'unit\.spec\.mjs|taps\.spec\.mjs|an embedded captured toy stays under 30 MB of transfer' \
  --workers=1
```

The broad regression run used the implementation checkpoint
`33e6164678c588442a13a9e3d57046fad0606e62`, before the final shared-WebGPU attribution guard and
report wording. It was stopped at ten failures: **22 passed, 10 failed, 1 interrupted, and 126 did
not run (13.8 minutes)**. The independent follow-up completed 83 of those previously unrun cases.
The final guard and bitmap checks passed the complete 16-case diagnostic run; no normal rendering
behavior changed.

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test \
  -c tests/cdx-renderer-diag.config.mjs \
  tests/smoke.spec.mjs tests/taps.spec.mjs tests/help.spec.mjs \
  tests/unit.spec.mjs tests/kit.spec.mjs tests/hta.spec.mjs --workers=1
```

Distinct test coverage across this reconstruction, without counting reruns twice:

| Spec                            | Passed | Failed | Interrupted | Unrun |
| ------------------------------- | -----: | -----: | ----------: | ----: |
| Diagnostic                      |     16 |      0 |           0 |     0 |
| Unit                            |     20 |      0 |           0 |     0 |
| Taps                            |     62 |      0 |           0 |     0 |
| Kit                             |     10 |      0 |           0 |     0 |
| Help text (`hta`)               |      3 |      0 |           0 |     0 |
| Help                            |      9 |      5 |           0 |     0 |
| Smoke, including embed transfer |      1 |      5 |           1 |    43 |
| Total                           |    121 |     10 |           1 |    43 |

Nine failures asserted an empty console but received Chromium's automatic software-WebGL fallback
warning, sometimes accompanied by readback performance warnings. These were four help cases and five
smoke cases. The separate desktop help-clearance capture at 1440×900 failed with a null bounding box
inside `inkUnderLine`. The clay/JSON smoke case was interrupted when the ten-failure bound was
reached. No existing assertion was loosened, no warning was filtered, and no unsafe flag was enabled
to get green results. The 390×844 clearance case passed its geometric and pixel assertions before
failing on console warnings; it did not reproduce the five-pixel overlap here. That does not
establish the overlap's origin or resolve phone behavior.

Earlier runs are also preserved: the initial diagnostics had 13 passes and one test-hook timing
failure (15.3 seconds), corrected to 14 passes (19.5 seconds). After removing Playwright's implicit
security overrides, the same 14 cases passed in 16.0 seconds. An intervening regression was stopped
for that configuration correction with 3 passes, 2 failures, 1 interruption, and 153 unrun cases.
The expanded 16-case diagnostic run passed in 24.8 seconds before the final bitmap strengthening.
All failure logs, traces, screenshots, and generated regression captures remain in the ignored cloud
workspace cache. Generated screenshots outside this task were preserved there and restored in the
working tree. An interim record line incorrectly grouped pending regression checks with passed
formatting checks; it was corrected in the next checkpoint without rewriting history.

Fallback screenshots with the report open:

- [390×844](../../tests/screenshots/cdx-renderer-diag-390x844.png)
- [1440×900](../../tests/screenshots/cdx-renderer-diag-1440x900.png)

[Machine-readable results and verified source hashes](renderer-diagnostics-2026-10-results.json)
record the exact counts, failed cases, unrun cases, and source files. Repository formatting,
American English, scoped secret-pattern and private-material review, and whitespace checks passed
before the final push.

## Remaining limits

All task smoke cases are complete; the full repository suite is unrun. Native WebGPU rendering,
phone hardware, mobile browsers, other managed environments, performance, memory, and frame rate are
unverified or unmeasured. The five-pixel help-line/status overlap remains unresolved; its origin has
not been established. The desktop help-capture failure was reproduced on both plain-main snapshots
and is also reported on the production-unchanged PR #197. The later stale reset-status assertion was
not reached by the main control. No visual effect, asset, license, or scene-schema change is part of
this task.

Rule check: none. No PR merge or deployment is part of this handback.

# Renderer diagnostics: task 71

Reconstructed by Codex from `docs/codex/71-renderer-diagnostics.md` on October 14, 2026. Made by
Ryan with Codex (GPT-6), under Splashery's MIT license. This implementation and its verification are
new; earlier sessions' test reports are not evidence for this code.

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
unchanged. A complete paginated check found no overlap with the changed files of PRs #560, #562,
#581, #582, #588, #589, and #591. The stricter smoke coverage lives in the new diagnostic spec
because the existing smoke spec belongs to another open PR. The normal device selection, device
options, rendering path, saved scenes, and old ready flag retain their behavior.

Validation uses `tests/cdx-renderer-diag.config.mjs`, with one worker, normal graphics capability
detection, no graphics override arguments, and `chromiumSandbox: true`. It also removes Playwright's
implicit security overrides and its default feature-disabling list, including HTTPS upgrades and
storage partitioning. The repository's default graphics configuration was not used. No browser was
installed. Linux x86_64 cloud execution uses `/usr/bin/chromium`, version 151.0.7922.173. Viewport
captures at 390×844 are desktop Chromium captures, not phone-device tests.

## Executed evidence

The final diagnostic run passed **16 tests in 25.2 seconds**. Four use unit fakes, ten use a real
browser with deliberately forced errors or clipboard behavior, and two use the actual initialized
WebGL2 backend and its rendered canvas pixels. One forced WebGPU device rejection uses a mocked
adapter followed by real WebGL2 success; it is not native WebGPU render evidence.

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

Forty-three smoke cases and the full repository suite are unrun. One smoke case was interrupted.
Native WebGPU rendering, phone hardware, mobile browsers, other managed environments, performance,
memory, and frame rate are unverified or unmeasured. The five-pixel help-line/status overlap remains
unresolved; its origin has not been established. The desktop help-capture failure is also
unresolved. No visual effect, asset, license, or scene-schema change is part of this task.

Rule check: none. No merge or deployment is part of this handback.

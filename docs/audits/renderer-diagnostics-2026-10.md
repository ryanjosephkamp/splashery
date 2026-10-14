# Renderer diagnostics: task 71

Reconstructed by Codex from `docs/codex/71-renderer-diagnostics.md` on October 14, 2026. Made by
Ryan with Codex (GPT-6), under Splashery's MIT license. This implementation and its verification are
new; earlier test reports are not evidence for this code.

## Behavior

The app and embed keep `body[data-ready="true"]` as page settlement, including the fallback. They
also expose `data-page-settled`, `data-renderer-ready`, and `data-first-toy-frame`. The latter two
are also on the player's canvas. Custom elements mark their canvas without marking the containing
page. The player emits `renderer-ready` and `first-toy-frame`.

Renderer readiness follows successful player initialization. First-toy-frame requires a completed
render with a loaded toy, a positive renderer splat count, and submitted draw calls; an update tick
or a finished data download cannot set it. Pixel assertions in the diagnostic smoke checks
independently verify that the app and embed actually draw the toy.

The `pc.js` boundary retains the graphics-device error object before `stage.js` wraps it. The
wrapper's cause points to that original exception, retaining any nested cause. Temporary observers
record existing adapter requests, device requests, WebGL2 context results, and context-creation
errors. They restore the original methods after startup and issue no extra probes. Locked APIs are
reported as observation limits; a cached adapter probe can leave the current player's adapter
outcome as not requested. Overlapping players can observe shared adapter calls, which the report
explicitly identifies.

The fallback's Details control opens a read-only local report with a Copy report button and manual
selection if clipboard access fails. Diagnostics are held in memory and never written to storage or
sent over the network. The report excludes browser identity, page URLs, and GPU vendor identifiers.
Guidance says a recent browser and hardware acceleration may help and acknowledges that managed or
cloud browsers may have no graphics device.

## Ownership and validation setup

`stage.js`, the existing smoke and taps specs, `index.html`, `styles.css`, and `vendor/` are
unchanged. Existing protected PR files are unchanged. The stricter smoke coverage lives in
`tests/cdx-renderer-diag.spec.mjs`, since the existing smoke spec belongs to another open PR.

Validation uses `tests/cdx-renderer-diag.config.mjs`, with one worker, normal capability detection,
no graphics override arguments, and `chromiumSandbox: true`. The repository's default browser
configuration is not used because it enables unsafe graphics overrides. No browser was installed.
The task configuration also removes Playwright's implicit security override flags and its default
feature-disabling list, including HTTPS upgrades and storage partitioning. Linux x86_64 cloud
execution uses `/usr/bin/chromium`, version 151.0.7922.173. The checks at 390×844 use a desktop
browser viewport, not a phone device.

## Executed evidence

Initial diagnostic run: **13 passed, 1 failed (15.3 seconds)**. The new embed test accessed its
console hook before that hook was published. The failure trace and screenshot are retained in the
ignored cloud workspace cache. The backend assertion was moved after page settlement; the test still
independently requires renderer readiness before the delayed asset is released, then a completed toy
frame and nonblank canvas pixels.

Corrected diagnostic run: **14 passed (19.5 seconds)**, using:

```sh
npx playwright test -c tests/cdx-renderer-diag.config.mjs \
  tests/cdx-renderer-diag.spec.mjs --workers=1
```

After removing Playwright's implicit security overrides: **14 passed (16.0 seconds)**. This is the
current diagnostic result. An earlier regression run was stopped to make that configuration
correction: **3 passed, 2 failed, 1 interrupted, and 153 did not run**. Its two help failures
asserted an empty console but received Chromium's automatic software-WebGL fallback and readback
performance warnings. The interrupted run and artifacts are retained. No unsafe flag was enabled to
suppress those warnings, and no assertion was loosened.

Four tests use unit fakes for observer behavior and frame-event gating. Eight use a real browser
with deliberately forced startup failure or clipboard behavior. Two use the actual initialized
WebGL2 backend and verify rendered pixels, with no mocked graphics capabilities.

Fallback screenshots with the report open:

- [390×844](../../tests/screenshots/cdx-renderer-diag-390x844.png)
- [1440×900](../../tests/screenshots/cdx-renderer-diag-1440x900.png)

Regression checks (`smoke`, `taps`, `help`, `unit`, `kit`, and `hta`) and repository formatting
checks passed; the regression run will resume with the corrected configuration. Embed coverage and
the transfer budget live in `smoke.spec.mjs`; there is no separate `embed.spec.mjs`.

## Remaining limits

WebGPU rendering has not yet been verified. Phone hardware, mobile browsers, performance, memory,
frame rate, and managed browsers other than this selected cloud environment are unmeasured. No
visual effect, asset, license, or scene-schema change is part of this task. The five-pixel
help-line/status overlap remains unresolved; its origin has not been established.

Rule check: none. No merge or deployment is part of this handback.

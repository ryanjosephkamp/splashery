# Three QR codes in one: token bounds and white lines

October 14, 2026. Task 72. Made by Ryan with Codex (GPT-6). New code is offered under Splashery's
MIT license.

## Result

Stage now imports `updateTokenBounds` and updates the resource and placement bounds before uploading
token uniforms for standard kit toys on WebGPU. The reported white bands were reproduced in native
Mac WebGPU and removed in the same controlled setup. **Actual Android verification remains
outstanding.**

The Stage hook is a direct runtime integration, not a test response override. WebGL2, assets, and
custom GPU fields retain their existing runtime path. Custom fields can reuse the token uniform for
non-transform data, so Stage records that distinction and excludes them from the kit-bounds hook.
The recipe, geometry, module colors, cameras, engine shaders, and vendor files were not edited.

The original recovery backup and its unapplied patch bytes remain preserved. Main was reconciled
after PRs #589 and #595 merged; the runtime hook is now committed in this task branch. The final
reconciliation is main `4907a003a43be0be97ce25403d94f6f1e9208600`. Open PR #622 has separate
render-loop changes in Stage; this task's additions are confined to its toy metadata and uniform
upload hook.

## Cause and implementation

The
[pinned PlayCanvas distance-range code](https://github.com/playcanvas/engine/blob/v2.22.3/src/scene/gsplat-unified/gsplat-hybrid-renderer.js)
measures the range from placement bounding-box corners. The
[pinned GPU projector](https://github.com/playcanvas/engine/blob/v2.22.3/src/scene/shader-lib/wgsl/chunks/gsplat/compute-gsplat-projector.js)
clamps depths to that range when assigning sort bins. Both pages were opened on October 14, 2026,
and checked against the installed 2.22.3 source.

The QR cards move well outside their rest bounds. The controlled result supports the inference that
clamped depths let white card splats tie with colored module splats. Growing the model-space
envelope to contain the packed token poses removes the bands. The helper also updates the
component's placement bounds and resource version. It retains the envelope until the geometry is
replaced and avoids repeated resource updates for already-covered poses. This is evidence for the
tested Mac path, not proof of the Android cause.

## Matched before and after

Before: `dbac377826434d5704b6c47aafa1434de7662273`, current main reconciled without the hook. After
code: `f27862f4b17483f969590684e3ef9bb7defd7636`. The final reconciliation preserves the runtime
hook and helper. A later test-only change strengthens the no-adapter simulation; both revisions'
source and test hashes are recorded in [the manifest](three-codes-lines-2026-10/manifest.json).

Both captures use installed Chromium 143.0.7499.4 on an Apple M3 Pro, native WebGPU, the same 391 ×
843 viewport, requested DPR 2.625, default QR texts and recipe, front camera, manual clock,
2.1-second apart state, and 1026 × 1690 stage buffer. No unsafe graphics flag, sandbox disabling,
GPU blocklist bypass, or browser security bypass was used. The before and after assertions use the
same 180/255 brightness threshold and 2,454 shared dark-module edge samples.

| State    | Before: bright samples / maximum | After: bright samples / maximum |
| -------- | -------------------------------- | ------------------------------- |
| Together | 0 / 14                           | 0 / 14                          |
| Apart    | 197 / 255                        | 0 / 32                          |
| Returned | 0 / 14                           | 0 / 14                          |

| Before                                                                                          | After direct integration                                                                               |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| ![White bands before](three-codes-lines-2026-10/before/webgpu-highp-391x843-dpr2.625-apart.png) | ![Codes after the bounds fix](three-codes-lines-2026-10/after/webgpu-highp-391x843-dpr2.625-apart.png) |

These are stage captures, not physical-phone screenshots. They were visually inspected. Exact
full-image pixel parity is not claimed: edge and overdraw values vary, and the targeted sorting
behavior changes. Geometry, recipe, colors, and camera inputs are unchanged. The before and after
JSONs retain every measured animation state.

## Fresh validation

The final native WebGPU matrix passed all three animation states at all four sizes. Every sampled
moved bounding-box corner was inside the resource envelope; the apart placement shared that
envelope. No page or console errors were recorded.

| Viewport / requested DPR | Actual stage buffer | Apart bright samples | Apart maximum |
| ------------------------ | ------------------- | -------------------- | ------------- |
| 1440 × 900 / 1           | 1072 × 900          | 0 / 2454             | 34            |
| 390 × 844 / 1            | 390 × 645           | 0 / 2454             | 82            |
| 391 × 843 / 2.625        | 1026 × 1690         | 0 / 2454             | 32            |
| 393 × 845 / 3.5          | 1179 × 1938         | 0 / 2454             | 32            |

DPR 3.5 is capped at 3 by the existing renderer. The rendering check independently transforms each
original box corner using the token shader's quaternion formula; it does not reuse the helper's Mat4
calculation.

A forced no-WebGPU run made `requestAdapter()` return null before app startup and obtained native
Metal WebGL2. It passed with no skip: the test exercises the same helper using the real resource and
packed motion tokens, checks its envelope, and renders all three states. This is explicitly labeled
`webgl2-helper-and-render`, not WebGPU sorting proof. In a normal no-adapter environment the same
fallback occurs without the test-only switch.

The two task specs inherit the suite's launch settings. Neither forces a sandbox setting or backend,
and neither imports Playwright internals. Default configuration discovery includes both specs, and
its nine bounds/Stage cases run without a browser. The optional local-only config retains sandboxing
and audits actual launch arguments; its helper no longer reads
`lib/server/chromium/chromiumSwitches.js`. The repository-wide cloud launch configuration is
unchanged.

Fresh selected regressions passed **109/109**, with no skips: nine bounds/Stage checks, six existing
Stage-resolution checks, nine bounded kit checks, three QR r5 checks (including the pulled-apart
color/decoder check), 62 tap checks, and 20 units. These ran at the guarded code commit above, using
Node 24.19.0 and Playwright 1.56.1. Historical 85-pass and 109/118 reports are not counted.

An earlier 109-case selection was stopped at its 100-second invocation limit during
`every kit toy has a recipe that builds deterministically and fits the unit ball`; its first 16
cases passed. The completed selection explicitly excludes that long case and the two long browser
cases `Picture QR: the ripple keeps every module's picture colors` and
`the Damage lab: tapped damage lands where the tap says`. Their assertions were not edited. The
complete suite and an actual Linux root/SwiftShader run remain for the Operator; default-config
inheritance and the safe native fallback were checked locally.

Final focused checks passed all ten task cases on the committed head, followed by the forced
no-adapter rendering case. The default repository configuration also passed all nine CPU-only
bounds/Stage cases without launching a browser.

## Commands and resource limits

Local proof used the existing test runner with `--config tests/cdx-three.config.mjs --workers=1`, an
isolated localhost server, and an already-installed browser. `QR72_MATRIX=1` selects the four sizes;
`QR72_NO_WEBGPU=1` exercises no-adapter fallback. `QR72_EVIDENCE` writes captures and metrics. The
obsolete `QR72_INTEGRATION` option is rejected because Stage now imports the helper directly.

The Operator can use the normal repository command without the optional local config:

```sh
SPLASHERY_CHROMIUM=/path/to/existing/chromium npx --no-install playwright test tests/cdx-three-bounds.spec.mjs tests/cdx-three-lines.spec.mjs
```

One worker and one test browser ran at a time. The watchdog stopped task processes above 4 GiB RSS,
below 10% system memory free, or after 100 seconds per invocation. Across this pass the highest
sampled task RSS was 2556.9 MiB and lowest sampled system memory free was 29%. The one stop was the
time limit in the long kit check; no memory threshold fired. These are process-RSS samples, not
exact GPU or total unified-memory measurements. No dependencies, browsers, or build tools were
installed.

## Remaining limits

Actual Android rendering and camera scanning were not performed; no existing adb installation was
available at the checked paths. No USB, browser, or system security settings were changed. The full
suite, physical Android, broader toy acceptance, motion clips, and frame-rate benchmarking are not
claimed. No pull request was merged, and nothing was deployed. Raw launch arguments, process IDs,
and local paths remain in private receipts; published evidence contains only default procedural toy
captures and bounded measurements.

Repository formatting, American English diff, and whitespace checks are recorded in the PR
verification. Rule check: none.

# Saved Studio startup — October 14, 2026

Codex (GPT-6) built a separate additive Engine fix for the task-65 compatibility failures. It
changes only shared startup code, adds a regression spec with unchanged copies of three frozen
inputs, and leaves the protected Photo to 3D, Moving photo to 3D, and Video to 3D files untouched.

An embed now publishes its player before the first toy build. The existing photo-view hook can read
`view: "splats"` from the restored scene at the time it builds the relief. When applying a saved
camera, the player marks the existing flight state as visitor-owned. The idle opening pose therefore
leaves that camera alone. New video selections and Reset keep the native opening behavior;
explicitly starting Replay still flies the path. No schema, asset, renderer setting, or threshold
changes.

## Introducing commits

The video driver began replacing an idle restored pose in
`54035cffbd3191263688438e35afa8f585252bda`. An isolated historical component probe confirms that its
parent, `82bbd809f84389a37161ac747ed64683b6aa1f2b`, preserves the same pose and that the introducing
commit changes it. The probe uses a synthetic path and the current orbit camera; it does not claim a
historical-page browser bisect.

The saved photo-view feature first appeared in `e2ab4b352a7d529b5362c440ddf9a0af2cae7577`. Its
build-time hook reads `window.__splashery.player`, but the embed published that player after
`viewer.start()`. Historical component probes select Splats with early binding and Sharp picture
with late binding. This identifies the startup omission in that feature, rather than claiming an
earlier working saved-view contract.

## Verification

Selected Linux cloud environment, Debian Chromium 151.0.7922.173, WebGL2, desktop 400×300 viewport,
reduced motion, one worker, one active context, and zero retries. Chromium sandbox and graphics
safety checks enabled; no unsafe graphics flags, GPU blocklist bypass, warning filtering, or browser
installation. Frozen expectations were not changed.

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test \
  --config tests/fixtures/cdx-saved-startup/playwright.config.mjs \
  tests/cdx-saved-startup.spec.mjs --workers=1
```

Before the fix, all seven new tests ran on main `6c3764ff9a1aa3fbba202af12d6764ac23ed2d6e`: **1
passed, 6 failed, 0 skipped, 0 retries, 33.341 seconds**. Both schema versions of both photo toys
selected Sharp picture in embeds, and both video versions changed the saved yaw from `0.8` to
`0.3292`. The native opening/Replay check passed. Failure screenshots and traces are retained
outside Git in `/tmp/splashery-startup-evidence/baseline/`.

After-fix browser validation: **7 passed, 0 failed, 0 skipped, 0 retries, 222.162 seconds**. It
checks the real embed view, app Save JSON download, fresh-context import, and second Save JSON
download for all three Studio toys in v2 and v3. Camera checks use the original pose and pan, not
the first saved document. The separate native opening and Replay case checks that the compatibility
fix preserves those behaviors. Historical source probes: **5 assertions passed**. The complete
revised task-65 corpus and existing source units are now running against this Engine branch; those
results are not yet claimed.

## Remaining limits

PR #197 contains the broader corpus and depends on this Engine change. No PR merge or deployment. No
physical phone, other browser, WebGPU, private Studio-input, or converted-media persistence claim.
The unrelated smoke/help container failures are outside this Engine startup fix. Rule check: none.

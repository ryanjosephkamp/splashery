# Task 54 review verification: October 13, 2026

Made by Ryan with Codex (GPT-6). Main `574a68d3`, then the task-document-only update `a2189958`, was
merged without rebasing. Linux, Node 24.19.0, Chromium 151.0.7922.173, SwiftShader WebGL2, pinned
Playwright, and one worker per command. Application files, assets, renderer, production encoder, and
vendored jsQR are real. Encoder, unit, kit, and taps checks execute in Node; they are not browser
frame measurements. No dependency was added.

## Completed runs

| Run                                    | Passed | Failed | Skipped |
| -------------------------------------- | -----: | -----: | ------: |
| QR/Photo/smoke/help/hta                |    146 |      1 |       0 |
| unit/taps/kit                          |     92 |      0 |       0 |
| Task 54                                |     51 |      0 |       0 |
| Final Studio and QR sample regressions |     17 |      2 |       0 |
| Isolated QR animation retry            |      1 |      0 |       0 |

The final sample run repeats qrc-picture and qr4-craft after the replacement selection; repeated
cases are counted once below. The larger regression began with the earlier QR list. The task spec
and final sample regressions use the shipping 24. A final-sample animation failure prompted an
isolated retry, with its result listed separately rather than hiding the first attempt.

| Spec                    | Distinct passing cases |
| ----------------------- | ---------------------: |
| `cdx-pics.spec.mjs`     |                     51 |
| `dsm-samples.spec.mjs`  |                      6 |
| `help.spec.mjs`         |                     14 |
| `hta.spec.mjs`          |                      3 |
| `kit.spec.mjs`          |                     10 |
| `p3d.spec.mjs`          |                     10 |
| `qr.spec.mjs`           |                     12 |
| `qr3.spec.mjs`          |                      8 |
| `qr4-2-engine.spec.mjs` |                      2 |
| `qr4-2.spec.mjs`        |                      3 |
| `qr4-craft.spec.mjs`    |                      7 |
| `qr4-flash.spec.mjs`    |                      2 |
| `qr4-scan.spec.mjs`     |                      2 |
| `qr5.spec.mjs`          |                      5 |
| `qrc-barcodes.spec.mjs` |                      5 |
| `qrc-build.spec.mjs`    |                      2 |
| `qrc-picture.spec.mjs`  |                      5 |
| `qrl.spec.mjs`          |                      1 |
| `qrs-heal.spec.mjs`     |                      3 |
| `qrs-steps.spec.mjs`    |                      5 |
| `qrs-study.spec.mjs`    |                      3 |
| `qrs-toys.spec.mjs`     |                      4 |
| `smoke.spec.mjs`        |                     50 |
| `taps.spec.mjs`         |                     62 |
| `unit.spec.mjs`         |                     20 |

**295 distinct cases passed; the existing QR hash assertion failed. All 51 task-specific cases
passed.** The after-turn QR scan also failed in the final-sample run, then passed its isolated
retry. The Photo to 3D invalid-file warning passed this branch run but failed 3/8 valid repetitions
on clean main.

Commands from the repository root (shell logs kept in ignored local cache):

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test '(^|/)(qr.*|p3d.*|smoke|help|hta)\.spec\.mjs$' --output=.cache/cdx-pics/round2/regression-results
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test tests/unit.spec.mjs tests/taps.spec.mjs tests/kit.spec.mjs --output=.cache/cdx-pics/round2/node-results
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test tests/cdx-pics.spec.mjs --output=.cache/cdx-pics/round2/new-split-results
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test tests/dsm-samples.spec.mjs tests/qrc-picture.spec.mjs tests/qr4-craft.spec.mjs --output=.cache/cdx-pics/round2/final-sample-results
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test tests/qrc-picture.spec.mjs --grep 'Picture QR in the browser' --output=.cache/cdx-pics/round2/animation-retry-results
node tools/check-packs.mjs photo-3d
node tools/nc-assets.mjs --check
npx prettier --check .
node tools/us-english.mjs --diff
git diff --check
```

The new metadata assertion failed with the old carrier list before replacement, then passed with the
new records. Two earlier task-only batches were interrupted: first to split the browser checks into
individually named cases, then to avoid repeating the expensive raw-PNG diagnostic already recorded
for every candidate/link. No qualifying scan assertion was removed. Their partial results are
excluded from the counts. One baseline setup attempt used two Playwright module paths and failed
before test execution; it is excluded from the eight valid warning repetitions.

## Five-link picture checks

Every shipping background passes both standard production layout sizes for five distinct URLs,
20–130 characters, at default H. Its named browser case loads the selected JPEG, checks actual
in-app credit and default production stage scanning, and confirms unpicked new assets stay unloaded.
It then builds and captures all five links in the actual renderer and tests each at 330 pixels, 4/8
pixels per module, and 900 pixels with 0.2-module Gaussian focus blur. It calls actual
`savePNG(900)` again with the longest link. That blur is a camera simulation, not a physical
print/camera observation. Capture-protocol equality is independently recorded in
[review-protocol-check.json](review-protocol-check.json).

The qualifying rendered rate is **5/5 links per background, 20/20 checks per background**.
Unfiltered raw 900-pixel PNG results are **3/5 or 4/5**, recorded separately for every candidate in
[qr-review-browser.json](qr-review-browser.json). Extra fixed-pixel CPU simulations also have
failures and are retained. No raw-export, universal-URL, real-camera, or printed-paper guarantee is
claimed. The strengthened regression tests the documented phone/focus protocol; it does not alter or
weaken any existing assertion.

All 20 accepted Studio samples load and produce distinct raised versus flat frames with their baked
depth maps. They do not fetch ONNX. The existing Studio sample spec loads the entire AI-made sample
list. The four task screenshots show 390×844 and 1440×900; final QR subjects are also reviewed on
[the 330-pixel contact sheet](qr-final-phone.jpg).

## Failures on clean main

A detached worktree at `574a68d3125c6ef8f0f5951b53a7da7b6124a341` was clean for both tracked and
untracked files before execution. It used the same pinned dependency files, Chromium, and an
independent server on port 4174. The later `a2189958` merge changes only task documents, so the
relevant production and test code is identical.

- [`tests/qr4-craft.spec.mjs:153`](../../../tests/qr4-craft.spec.mjs): failed 3/3 fresh executions.
  Expected `b3918a78fddc50518d2fef2cecb12cee1cf3b16b05a450e61a166fb39b482144`; received
  `d98ad9f651252c2f37ce6d6530dc7aa8c45fca762319a496421846fec9788eb6`.
  [Clean-main output and diff](main-hash-failure.txt).
- [`tests/p3d.spec.mjs:194`](../../../tests/p3d.spec.mjs): `.warning:visible` was absent within 60
  seconds in 3/8 valid repeated executions (5/8 passed).
  [Clean-main error output](main-warning-failure.txt) and
  [actual failure screenshot](main-warning-failure.jpg). The panel-refresh race was observed
  previously in [input-warning-observation.json](input-warning-observation.json).

Commands from that clean worktree:

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium SPLASHERY_PORT=4174 node node_modules/playwright/cli.js test tests/qr4-craft.spec.mjs --grep 'builds the very same splats' --repeat-each=3 --output=../round2/main-hash-results
SPLASHERY_CHROMIUM=/usr/bin/chromium SPLASHERY_PORT=4174 node node_modules/playwright/cli.js test tests/p3d.spec.mjs --grep 'nothing loads the depth model' --repeat-each=8 --output=../round2/main-warning-results
```

Neither assertion nor its production code was edited. `tests/taps.spec.mjs` is unchanged.

The existing after-turn browser assertion, `tests/qrc-picture.spec.mjs:158`, failed in the final
sample run: the 8-pixel/module text decoded, while the 4-pixel/module result was null. It uses the
unchanged Wildflowers picture. The isolated retry, after all concurrent test browsers finished,
passed; the broad regression also passed this case. The first failure remains in the run table and
[animation observation](qr-animation-observation.txt). No assertion or production code was changed.
The retry does not establish general animation timing reliability.

## Checks, sizes, and scope

The package check builds Photo to 3D: 196,935 splats in 1,399 ms in Node, not a device frame rate.
The smoke embed test measured 9.1 MB under the 30 MB cap. The license check finds four existing NC
assets, all tagged, and no ND license. Prettier, American English, and whitespace checks pass. All
main asset records and credit text, plus the accepted Studio records/files, are preserved. The
refreshed [registry-additions.patch](registry-additions.patch) adds the final records to main
without deleting any pre-existing line. No other protected open-PR file or manual page changed. Old
regression screenshots were restored; only the four task screenshots are retained.

The new QR JPEGs total 2,389,307 bytes. Audit evidence before this verification text: 6,179,712
bytes. The audit folder is below 8 MB. Native and rejected full-size candidates remain in ignored
local cache. Neither toy's default picture changed. Real-phone performance, physical camera/paper
trials, large-angle renderer fixes, and the repository-wide suite are unmeasured or out of scope.
This is one draft PR, not merged. Rule check: none.

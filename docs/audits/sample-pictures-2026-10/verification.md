# Task 54 verification: October 13, 2026

Made by Ryan with Codex (GPT-6). Linux container, Chromium 151.0.7922.173 at `/usr/bin/chromium`,
SwiftShader, Node 24.19.0, pinned Playwright, one worker. Browser tests use the actual application,
renderer, vendor decoders, and asset files. Pure encoder, kit, taps, and unit cases run JavaScript
in Node through Playwright; they are not browser frame measurements. No mock image or encoder
substitutes were used.

## Completed runs

| Files                               | Passed | Failed | Skipped |
| ----------------------------------- | -----: | -----: | ------: |
| qr*, p3d*, smoke, help, hta         |    145 |      2 |       0 |
| unit                                |     20 |      0 |       0 |
| taps                                |     62 |      0 |       0 |
| kit                                 |     10 |      0 |       0 |
| cdx-pics                            |     28 |      0 |       0 |
| dsm-samples, qrc-picture, qr4-craft |     18 |      1 |       0 |

The final sample run repeats the two QR specs after the final selection; repeated cases are counted
once below. The larger regression began with an earlier candidate list. Neither default sample
changed. The final task spec calls the actual `savePNG(900)` for all 24 selected backgrounds and
verifies no new asset is fetched before selection. It also loads and raises all 20 new Studio
pictures. The existing Studio spec loads all 50 AI-made pictures.

| Spec                    | Passed |
| ----------------------- | -----: |
| `cdx-pics.spec.mjs`     |     28 |
| `dsm-samples.spec.mjs`  |      6 |
| `help.spec.mjs`         |     14 |
| `hta.spec.mjs`          |      3 |
| `kit.spec.mjs`          |     10 |
| `p3d.spec.mjs`          |      9 |
| `qr.spec.mjs`           |     12 |
| `qr3.spec.mjs`          |      8 |
| `qr4-2-engine.spec.mjs` |      2 |
| `qr4-2.spec.mjs`        |      3 |
| `qr4-craft.spec.mjs`    |      7 |
| `qr4-flash.spec.mjs`    |      2 |
| `qr4-scan.spec.mjs`     |      2 |
| `qr5.spec.mjs`          |      5 |
| `qrc-barcodes.spec.mjs` |      5 |
| `qrc-build.spec.mjs`    |      2 |
| `qrc-picture.spec.mjs`  |      5 |
| `qrl.spec.mjs`          |      1 |
| `qrs-heal.spec.mjs`     |      3 |
| `qrs-steps.spec.mjs`    |      5 |
| `qrs-study.spec.mjs`    |      3 |
| `qrs-toys.spec.mjs`     |      4 |
| `smoke.spec.mjs`        |     50 |
| `taps.spec.mjs`         |     62 |
| `unit.spec.mjs`         |     20 |

**271 distinct test cases passed; two existing assertions failed as detailed below. All
task-specific cases passed.**

Commands, run from the repository root:

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test '(^|/)(qr.*|p3d.*|smoke|help|hta)\.spec\.mjs$' --output=.cache/cdx-pics/regression-results
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test tests/unit.spec.mjs
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test tests/taps.spec.mjs
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test tests/kit.spec.mjs
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test tests/cdx-pics.spec.mjs --output=.cache/cdx-pics/new-results
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test tests/dsm-samples.spec.mjs tests/qrc-picture.spec.mjs tests/qr4-craft.spec.mjs --output=.cache/cdx-pics/final-sample-results
node tools/check-packs.mjs photo-3d
node tools/nc-assets.mjs --check
npx prettier --check .
node tools/us-english.mjs --diff
```

The package check builds Photo to 3D: 196,935 splats, 1,110 ms in Node. This is a build measurement,
not a device frame rate. The smoke embed transfer check measured 9.1 MB for the bee at the strong
profile, below its 30 MB cap. License check: four existing NC assets, all tagged; no ND license.
Formatting and American English checks are clean. `git diff --check` is clean. Full repository
suite, physical printing, camera scans, real-phone performance, and new effects are unmeasured or
outside this task.

## Baseline failures

Both failures were reproduced without task changes (the warning case passed initially, then failed
on repetition), in a detached worktree at main commit `555e8f5c`, with the same Chromium/Node and a
separate server on port 4174:

- `p3d.spec.mjs`, line 194: after an invalid JPEG upload, `.warning:visible` was not found within 60
  seconds. The sample-building, lazy-model, and tap assertions preceding that assertion completed.
- `qr4-craft.spec.mjs`, line 153: unchanged QR builder hash expected
  `b3918a78fddc50518d2fef2cecb12cee1cf3b16b05a450e61a166fb39b482144`, but got
  `d98ad9f651252c2f37ce6d6530dc7aa8c45fca762319a496421846fec9788eb6`.

Baseline command:

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium SPLASHERY_PORT=4174 npx playwright test tests/p3d.spec.mjs tests/qr4-craft.spec.mjs --grep 'nothing loads the depth model|builds the very same splats'
```

The warning trace shows the error visible immediately after the second upload and hidden after a
subsequent panel refresh; [input-warning-observation.json](input-warning-observation.json) retains
the timing and source observation. The warning case also failed an isolated task-branch retry. The
unchanged-main repetition used `--repeat-each=3`: one pass and two failures, both at the same
warning assertion. The initial baseline pair had one pass (warning) and one failure (hash). Both are
outside the sample-data changes. Their existing assertions and production code were preserved. The
draft PR reports them as known issues rather than claiming a clean full regression.

## Evidence and sizes

Screenshots were reviewed at both required sizes:

- [Photo to 3D, 390×844](../../../tests/screenshots/cdx-pics-photo-390x844.png)
- [Photo to 3D, 1440×900](../../../tests/screenshots/cdx-pics-photo-1440x900.png)
- [Picture QR, 390×844](../../../tests/screenshots/cdx-pics-qr-390x844.png)
- [Picture QR, 1440×900](../../../tests/screenshots/cdx-pics-qr-1440x900.png)

The contact sheets show every candidate, kept 3D poses, CPU QR simulations, and real-browser QR
renders. Raw scores keep all eight photo poses and all QR trials, including failures. Forty photos
were measured at 199,498–199,500 splats; these are scoring settings, not every device tier. No new
effect was introduced, so no effect clip was required.

New retained Studio JPEGs: 4,155,643 bytes; depth maps: 7,194,224 bytes. New QR JPEGs: 2,841,742
bytes. Each image is below 500,000 bytes. New assets are fetched only when picked. Report assets
totaled 5,771,751 bytes before this verification text, below 8 MB. Full-size rejected candidates
remain in ignored local cache.

## Scope and rules

The branch was cut from main at `555e8f5c`; main was fetched again before handback. The owner
explicitly permitted additive records in `CREDITS.md` and `tools/assets.json`. Their patch adds 905
lines and deletes none. All other files in open PRs #560, #562, #566, and #570, `manual/`, and
`tests/taps.spec.mjs` are unchanged. Generated changes to old screenshots were restored; only four
task screenshots are retained. The encoder, renderer, depth model, and all existing test assertions
are unchanged.

Rule check: none. The only protected-file exception is the owner-authorized additive registry work.
One draft PR; no merge, push to main, force-push, or history rewrite.

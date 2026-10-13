# Task 54 final review: October 13, 2026

Made by Ryan with Codex (GPT-6). Main `4b0127da` (#585's hard-case samples and #586's site rebuild)
was merged without rebasing. The subsequent task-document-only main update `c66a49e9` was also
merged. Application, test, and asset code are unchanged by that update. Merge commit `8fdc6793`
preserves both sides' complete credit blocks and all 56 main plus 20 task photo records. The
accepted 20 Photo to 3D images, depth maps, labels, and records remain unchanged.

The three final replacements are Green watering can (49.477), Wooden stacking rings (48.887), and
Wooden spinning top (48.677), chosen from ten new AI subjects. The 21 accepted AI backgrounds are
retained; the three procedural pictures are retired. All 24 shipping QR pictures are now AI-made,
with the owner's exact credit/license wording and picker labels. Every candidate and failed trial
remains in the scored report. The new metadata assertion failed with the old procedural list before
replacement, then passed with the final all-AI list.

## Completed runs

| Run                                    | Passed | Failed | Skipped | Not run |
| -------------------------------------- | -----: | -----: | ------: | ------: |
| QR/Photo/smoke/help/hta                |    140 |      3 |       0 |       4 |
| unit/taps/kit                          |     92 |      0 |       0 |       0 |
| Task 54 and merged hard cases          |     54 |      0 |       0 |       0 |
| Final Studio and QR sample regressions |     18 |      1 |       0 |       0 |
| Isolated QR tap retry                  |      1 |      0 |       0 |       0 |

| Spec                           | Distinct passing cases |
| ------------------------------ | ---------------------: |
| `cdx-pics-hard-cases.spec.mjs` |                      3 |
| `cdx-pics.spec.mjs`            |                     51 |
| `dsm-samples.spec.mjs`         |                      6 |
| `help.spec.mjs`                |                     14 |
| `hta.spec.mjs`                 |                      3 |
| `kit.spec.mjs`                 |                     10 |
| `p3d.spec.mjs`                 |                     10 |
| `qr.spec.mjs`                  |                     12 |
| `qr3.spec.mjs`                 |                      8 |
| `qr4-2-engine.spec.mjs`        |                      2 |
| `qr4-2.spec.mjs`               |                      3 |
| `qr4-craft.spec.mjs`           |                      7 |
| `qr4-flash.spec.mjs`           |                      2 |
| `qr4-scan.spec.mjs`            |                      2 |
| `qr5.spec.mjs`                 |                      5 |
| `qrc-barcodes.spec.mjs`        |                      5 |
| `qrc-build.spec.mjs`           |                      2 |
| `qrc-picture.spec.mjs`         |                      5 |
| `qrl.spec.mjs`                 |                      1 |
| `qrs-heal.spec.mjs`            |                      3 |
| `qrs-steps.spec.mjs`           |                      5 |
| `qrs-study.spec.mjs`           |                      3 |
| `qrs-toys.spec.mjs`            |                      4 |
| `smoke.spec.mjs`               |                     50 |
| `taps.spec.mjs`                |                     62 |
| `unit.spec.mjs`                |                     20 |

**298 distinct cases passed. All 51 task-specific cases and all three merged hard-case integration
cases passed.** The existing QR hash assertion remains the only case without a passing current run;
earlier failures and retries are retained below.

The broad regression started before replacement selection. The final standalone QR specs use the
fixed shipping list. Repeated cases are counted once in the distinct totals; every failed attempt
and incomplete case remains visible in the run table. The required scope is QR, Photo to 3D, smoke,
help, unit, and taps, plus hta, kit, Studio sample records/loading, and main's three hard-case
integration cases. No existing assertion was weakened.

## Actual browser and scan checks

Chromium 151.0.7922.173, SwiftShader WebGL2, Node 24.19.0, pinned Playwright, and one worker per
command were used. Browser cases load the actual application and JPEGs, use actual renderer pixels,
check credits and lazy loading, and call production scanning and PNG export. Encoder, unit, taps,
and kit cases run JavaScript in Node; they are not device frame measurements. No renderer, decoder,
image, or encoder result was mocked, and no dependency was added.

All 24 backgrounds pass both production layout sizes for five different URLs, 20–130 characters, at
default H. Every link passes four rendered qualifying checks: raw 330-pixel phone reduction, 4/8
pixels per module, and 900 pixels with 0.2-module Gaussian focus blur. Each background's browser
case also calls the actual production stage checker with the default URL and actual `savePNG(900)`
with the longest URL. That focus blur is a mathematical camera simulation, not a physical camera or
print observation. Qualifying rates are 5/5 links and 20/20 checks per picture; unfiltered raw
900-pixel rates are separately recorded as 3/5 or 4/5. Physical, raw-export, and universal-URL
guarantees are not claimed.

The ten final-round subjects were generated individually, with full prompts and native originals
preserved. All ten passed the layout checks; four failed actual rendered trials and were cut. The
six scan-qualified subjects were visually reviewed at 330 pixels. The three highest worst-link
detail scores were selected. [Replacement phone renders](qr-replacement-phone.jpg) and
[the final 24](qr-final-phone.jpg) show the actual pixels and scores.

Commands from the repository root:

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test '(^|/)(qr.*|p3d.*|smoke|help|hta)\.spec\.mjs$' --output=.cache/cdx-pics/round3/regression-results
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test tests/unit.spec.mjs tests/taps.spec.mjs tests/kit.spec.mjs --output=.cache/cdx-pics/round3/node-results
SPLASHERY_CHROMIUM=/usr/bin/chromium SPLASHERY_PORT=4174 npx playwright test tests/cdx-pics.spec.mjs tests/cdx-pics-hard-cases.spec.mjs --output=.cache/cdx-pics/round3/new-results
SPLASHERY_CHROMIUM=/usr/bin/chromium SPLASHERY_PORT=4174 npx playwright test tests/dsm-samples.spec.mjs tests/qrc-picture.spec.mjs tests/qr4-craft.spec.mjs --output=.cache/cdx-pics/round3/final-sample-results
SPLASHERY_CHROMIUM=/usr/bin/chromium SPLASHERY_PORT=4174 npx playwright test tests/qr3.spec.mjs --grep 'a tap knocks' --output=.cache/cdx-pics/round3/tap-retry-results
npx prettier --check .
node tools/us-english.mjs --diff
node tools/nc-assets.mjs --check
node tools/check-packs.mjs photo-3d
git diff --check
```

## Failures and follow-up

The unchanged QR builder hash assertion still fails at tests/qr4-craft.spec.mjs:153. The broad run
also failed the existing tap assertion at tests/qr3.spec.mjs:228 (knock was zero), then that case
passed an isolated retry after the concurrent test browsers finished. The Picture QR module load in
the broad run failed with ENOENT for a retired procedural JPEG: the worker retained the earlier
sample module while the shipping files changed. Four subsequent cases in that spec did not run in
that attempt. The standalone final sample run starts with the fixed all-AI list and passes all five
Picture QR cases, all six Studio cases, and seven of eight QR craft cases; only the known hash
fails. These attempts are reported separately. No existing assertion or production code was changed
to obtain a pass.

[Fresh failure and follow-up output](final-review-failures.txt).

The previous clean-main proof is retained at main `574a68d3`: the QR builder hash failed 3/3 runs at
`tests/qr4-craft.spec.mjs:153`, and the invalid-photo warning failed 3/8 valid repetitions at
`tests/p3d.spec.mjs:194`. See [hash output](main-hash-failure.txt),
[warning output](main-warning-failure.txt), and [warning screenshot](main-warning-failure.jpg).
Those are historical clean-main observations, not a claim that the new main tree is identical. The
warning passed this merged-branch run. None of the existing test or production assertions was
changed. `tests/taps.spec.mjs` is untouched.

## Checks and scope

The merged JSON parses and every main record is preserved verbatim as an object. The complete main
credit text remains a prefix, followed by this task's block. The final QR file hashes match their 24
records, and all accepted Studio bytes remain unchanged. The registry diff against main is additive;
[registry-additions.patch](registry-additions.patch) records it.

Whole-repository Prettier was run immediately after merge and again before pushing. American
English, whitespace, and license checks pass. Four existing NC assets remain tagged; no ND license
was found. The Photo to 3D pack check builds 196,935 splats in 1,349 ms in Node, not a real-phone
frame rate. Final QR JPEGs total 2,557,724 bytes. Audit evidence before this text: 6,929,746 bytes,
below 8 MB. The smoke embed test remains below its 30 MB cap.

Unrelated regression screenshots, including main's hard-case screenshots, were restored; only the
four task screenshots are retained. No other protected open-PR file or manual page changed relative
to main. Full repository tests, physical print/camera trials, and real-phone performance are
unmeasured or outside scope. Code is MIT; shipping pictures are AI-made by the owner under A3. One
draft PR, not merged. Rule check: none.

# Advisor route follow-up

A person opening a scene made with a sender's local photo or clip now gets a persistent, nonmodal
notice. It names the saved file, explains that it stays on the sender's device, and offers **Open
the file** or **Keep the sample**. The existing local picker reads the chosen file without uploading
it. A bad selection reports an accessible error in the notice. A different file already open in the
page cannot silently replace the named file.

Codex (GPT-6) built this follow-up to the
[Operator's request](https://github.com/ryanjosephkamp/splashery/pull/650#issuecomment-6194345842).
Rule check: none.

## Earlier recipient route

Recorded October 15, 2026 at 10:56:35 AM EDT, source build
`7805082258dafdf0acd3e84b5f5c0170e2ce71af`, Chromium 151.0.7922.173. This is **one run**, not
three-run evidence: 56 passed, 0 failed, 2 inconclusive, 4 blocked at capture time. The two
share-export checks then used geometry assistance; they are superseded by the unassisted 50-case
study below. The accepted recipient checks and notice code are unchanged. The source includes main
through `cb8a8315`. All 62 records and their original image evidence are pinned to
[evidence-only commit 4ef87103](https://github.com/ryanjosephkamp/splashery/blob/4ef871030269556932115961bf44ad7433b09c57/docs/audits/advisor-route-followup-2026-10/README.md)
on `codex/advisor-route-evidence-clips`; **never merge that branch**.
[Full step report](https://github.com/ryanjosephkamp/splashery/blob/4ef871030269556932115961bf44ad7433b09c57/docs/audits/advisor-route-followup-2026-10/route-report.md)
and [summary index](summary.json).

| Toy             | Results in this run                            |
| --------------- | ---------------------------------------------- |
| photo-3d        | 17 passed, 0 failed, 0 inconclusive, 0 blocked |
| moving-photo-3d | 13 passed, 0 failed, 0 inconclusive, 0 blocked |
| qr-code         | 6 passed, 0 failed, 1 inconclusive, 1 blocked  |
| qr-picture      | 7 passed, 0 failed, 0 inconclusive, 1 blocked  |
| qr-three        | 6 passed, 0 failed, 1 inconclusive, 1 blocked  |
| share-qr        | 7 passed, 0 failed, 0 inconclusive, 1 blocked  |

| Required recipient step | Result          | Name from link metadata | Evidence                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------- | --------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| photo-3d, step 13       | **passed, 1/1** | scene                   | [Record](https://github.com/ryanjosephkamp/splashery/blob/4ef871030269556932115961bf44ad7433b09c57/docs/audits/advisor-route-followup-2026-10/run-1-photo-3d-13.json) · [Recipient screenshot](https://github.com/ryanjosephkamp/splashery/blob/4ef871030269556932115961bf44ad7433b09c57/docs/audits/advisor-route-followup-2026-10/run-1-photo-3d-13-recipient.png)              |
| moving-photo-3d, step 9 | **passed, 1/1** | silent                  | [Record](https://github.com/ryanjosephkamp/splashery/blob/4ef871030269556932115961bf44ad7433b09c57/docs/audits/advisor-route-followup-2026-10/run-1-moving-photo-3d-09.json) · [Recipient screenshot](https://github.com/ryanjosephkamp/splashery/blob/4ef871030269556932115961bf44ad7433b09c57/docs/audits/advisor-route-followup-2026-10/run-1-moving-photo-3d-9-recipient.png) |

Both fixtures are synthetic repository inputs. Sender routes force `profile=mid&adapt=off`, labs on,
and software WebGL2; recipients open the actual shared URL with fresh storage and their resolved
defaults. Their URLs, settings, renderer, and visible message are retained in the records. The
shared links use the loopback server and carry settings and file names, never file bytes. Depth is
estimated, not measured geometry.

## Owner screenshots and accessibility

[Open the four-image gallery](https://github.com/ryanjosephkamp/splashery/blob/4ef871030269556932115961bf44ad7433b09c57/docs/audits/advisor-route-followup-2026-10/README.md#owner-review).
These are fresh recipients of the actual route links. Every screenshot has capture metadata and an
accessibility tree; the notice and depth slider do not overlap.

| Toy             | Viewport   | Evidence                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| photo-3d        | 390 × 844  | [Screenshot](https://github.com/ryanjosephkamp/splashery/blob/4ef871030269556932115961bf44ad7433b09c57/docs/audits/advisor-route-followup-2026-10/photo-3d-notice-390x844.png) · [Accessibility tree](https://github.com/ryanjosephkamp/splashery/blob/4ef871030269556932115961bf44ad7433b09c57/docs/audits/advisor-route-followup-2026-10/photo-3d-notice-390x844-aria.txt)                 |
| photo-3d        | 1440 × 900 | [Screenshot](https://github.com/ryanjosephkamp/splashery/blob/4ef871030269556932115961bf44ad7433b09c57/docs/audits/advisor-route-followup-2026-10/photo-3d-notice-1440x900.png) · [Accessibility tree](https://github.com/ryanjosephkamp/splashery/blob/4ef871030269556932115961bf44ad7433b09c57/docs/audits/advisor-route-followup-2026-10/photo-3d-notice-1440x900-aria.txt)               |
| moving-photo-3d | 390 × 844  | [Screenshot](https://github.com/ryanjosephkamp/splashery/blob/4ef871030269556932115961bf44ad7433b09c57/docs/audits/advisor-route-followup-2026-10/moving-photo-3d-notice-390x844.png) · [Accessibility tree](https://github.com/ryanjosephkamp/splashery/blob/4ef871030269556932115961bf44ad7433b09c57/docs/audits/advisor-route-followup-2026-10/moving-photo-3d-notice-390x844-aria.txt)   |
| moving-photo-3d | 1440 × 900 | [Screenshot](https://github.com/ryanjosephkamp/splashery/blob/4ef871030269556932115961bf44ad7433b09c57/docs/audits/advisor-route-followup-2026-10/moving-photo-3d-notice-1440x900.png) · [Accessibility tree](https://github.com/ryanjosephkamp/splashery/blob/4ef871030269556932115961bf44ad7433b09c57/docs/audits/advisor-route-followup-2026-10/moving-photo-3d-notice-1440x900-aria.txt) |

The browser tests exercise Enter to open the picker, cancellation, Tab to Keep the sample,
dismissal, focus returning to the stage, actual photo/clip selection and inference, visible
invalid-file feedback, matching and different cached names, old `#s=` links, and scene JSON v2/v3.
Native screen-reader speech was not tested; the region, live status, alert, and named controls were
checked through Chromium's accessibility tree. The Browser plugin was unavailable, so the
repository's Playwright workflow was used.

## Share PNG exports

The original assertion is restored: both readers must independently find and decode the exported
code at exactly 390 pixels, without geometry hints. The route also requires an unassisted
native-size read. Geometry-assisted sampling remains a separate diagnostic and cannot make either
check pass.

Save PNG now tests the encoder's preferred mask and then the remaining masks, downloading the first
candidate that both vendored readers independently locate and decode exactly at 390 pixels and
native size (1130 pixels in this study). The payload, version, correction level, quiet border, and
dimensions remain unchanged. The export checker and ZXing load only when saving; jsQR already checks
the dialog's displayed code. A failed scan check offers Save JSON, and a reader-load failure offers
JSON or retry.

[Complete paired study and all 200 PNGs](https://github.com/ryanjosephkamp/splashery/blob/6a8981fc245c3ee3b000ab30792c6629f37897ad/docs/audits/advisor-route-followup-2026-10/share-mask-study/README.md),
corrected source `f567e0be91dff6a11397cf62a9539a6f46858a99`. The same 50 real app-export scene
inputs are replayed before and after; they differ only in their creation timestamps.

| Reader | 390 pixels before | 390 pixels after | 1130 pixels before | 1130 pixels after |
| ------ | ----------------- | ---------------- | ------------------ | ----------------- |
| jsQR   | 50/50             | 50/50            | 50/50              | 50/50             |
| ZXing  | 45/50             | 50/50            | 33/50              | 50/50             |

Independent validation re-read all 200 images with both unassisted vendored readers: all 400 results
match the browser records. Eighteen exports needed a different mask, and one needed all eight
candidates. The study retains exact URLs, decoded strings, hashes, dimensions, and attempted masks.
The baseline used the original exporter's cached modules loaded before editing; its dirty-checkout
and source provenance are documented in the study. Every native baseline raster also matches the
original automatic mask pixel for pixel.

The earlier
[saved counterexample](https://github.com/ryanjosephkamp/splashery/blob/4ef871030269556932115961bf44ad7433b09c57/docs/audits/advisor-route-followup-2026-10/qr-case-0-phone.png)
still fails ZXing's general finder unchanged. It now passes through the real corrected Save PNG path
with both independent readers. The initial geometry-assisted change reduced the assertion's
coverage; it was not an export fix. That limitation is corrected here. No wait was increased.

These rates describe one version-22 scene with 50 timestamps, not every possible link or a physical
phone scan. The dialog's on-screen code retains the encoder's original choice before saving.
Hardware export latency, on-screen camera detection, and real-device performance remain unmeasured.
The loopback links cannot be reached by another phone.

## Verification and limits

- [Current regression log](qr-mask-regression.txt): **16 targeted tests passed** with two workers,
  followed by **10 notice tests passed** with one worker. The targeted run covers the original
  unassisted export assertions, saved finder counterexample, reader-load failure and retry, separate
  geometry diagnostics, existing camera-view Share test, and oversized-scene fallback.
- The earlier [21-test log](regression.txt) remains historical evidence from the first
  implementation; its geometry-assisted Share assertion is superseded.
- All study PNGs and dialog screenshots stay on the evidence-only clips branch. Its manifest records
  artifact sizes and SHA-256 hashes.
- Independent code review found no actionable issues. The original notice files and four
  owner-review images are unchanged in this revision. The owner still needs to review those images.
- **Full-suite Actions proof is pending the Operator's full-suite label.** No label or workflow
  dispatch was added here.
- Second-phone scans stay blocked, needs the owner. Hardware smoothness, real-device load times, GPU
  presentation, and hardware WebGPU remain unmeasured.

To rerun the paired study, follow its linked instructions and use `tools/adv-share-masks.mjs`. The
long route remains outside the default regression suite.

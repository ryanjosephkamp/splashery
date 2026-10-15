# Advisor route follow-up

A person opening a scene made with a sender's local photo or clip now gets a persistent, nonmodal
notice. It names the saved file, explains that it stays on the sender's device, and offers **Open
the file** or **Keep the sample**. The existing local picker reads the chosen file without uploading
it. A bad selection reports an accessible error in the notice. A different file already open in the
page cannot silently replace the named file.

Codex (GPT-6) built this follow-up to the
[Operator's request](https://github.com/ryanjosephkamp/splashery/pull/650#issuecomment-6194345842).
Rule check: none.

## Fresh route

Recorded October 15, 2026 at 10:56:35 AM EDT, source build
`7805082258dafdf0acd3e84b5f5c0170e2ce71af`, Chromium 151.0.7922.173. This is **one run**, not
three-run evidence: 56 passed, 0 failed, 2 inconclusive, 4 blocked. The source includes main through
`cb8a8315`. All 62 records and their original image evidence are pinned to
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

## Share PNG decoding

The local reproduction uses a real, already-complete share export. Eight captured URLs differ only
in their scene creation timestamps; five native images and one unchanged 390-pixel copy fail ZXing's
generic location step while jsQR reads every payload exactly. The retained
[native PNG](https://github.com/ryanjosephkamp/splashery/blob/4ef871030269556932115961bf44ad7433b09c57/docs/audits/advisor-route-followup-2026-10/qr-case-0-native.png),
[390-pixel PNG](https://github.com/ryanjosephkamp/splashery/blob/4ef871030269556932115961bf44ad7433b09c57/docs/audits/advisor-route-followup-2026-10/qr-case-0-phone.png),
and
[payload/results](https://github.com/ryanjosephkamp/splashery/blob/4ef871030269556932115961bf44ad7433b09c57/docs/audits/advisor-route-followup-2026-10/qr-case-0.json)
reproduce the same exact assertion used by the original test.
[Twenty reads of identical pixels](https://github.com/ryanjosephkamp/splashery/blob/4ef871030269556932115961bf44ad7433b09c57/docs/audits/advisor-route-followup-2026-10/qr-same-bytes-idle-loaded.json),
ten idle and ten with four CPU workers, fail ZXing location identically.
[Timestamp comparison](https://github.com/ryanjosephkamp/splashery/blob/4ef871030269556932115961bf44ad7433b09c57/docs/audits/advisor-route-followup-2026-10/qr-timestamp-only.json).
The original Actions PNGs were unavailable here, so this is a deterministic local reproduction
rather than a byte-for-byte diagnosis of those artifacts.

The finder mistakes data for a corner and samples a 73-module phone grid instead of 105. The export
is drawn synchronously from an immutable matrix, so another wait cannot fix those saved pixels. The
helper now uses the share sheet's declared version for the bounded export's sampling grid. It
validates square dimensions, legal module count, the quiet border, finder shapes, and timing lines,
then lets the unchanged vendored ZXing decoder read and error-correct the actual sampled pixels.
jsQR still reads the original full raster. No expected payload or regenerated matrix supplies the
decoder's data. Original PNG bytes, the exact 390-pixel resize, both readers' exact equality checks,
and the general screenshot finder remain unchanged. Wrong geometry, blank pixels, a dirty border,
and data corruption are rejected by the new regressions.

Generic finder outcomes remain in each share export record as `generalDecoded`, beside strict
`decoded` and explicit `decodeOptions`. They are compatibility diagnostics; this change makes no
general phone-camera detection claim.

| Fresh share check           | Strict result | Generic jsQR | Generic ZXing    | Evidence                                                                                                                                                              |
| --------------------------- | ------------- | ------------ | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Export and decode PNG       | passed        | exact        | exact            | [Record](https://github.com/ryanjosephkamp/splashery/blob/4ef871030269556932115961bf44ad7433b09c57/docs/audits/advisor-route-followup-2026-10/run-1-share-qr-02.json) |
| Native-size exported decode | passed        | exact        | null / different | [Record](https://github.com/ryanjosephkamp/splashery/blob/4ef871030269556932115961bf44ad7433b09c57/docs/audits/advisor-route-followup-2026-10/run-1-share-qr-03.json) |

## Verification and limits

- [Combined advisor specs](regression.txt): **21 passed** with two workers (9 original checks, 10
  recipient checks, and 2 QR regressions). The log names the exact spec blobs in the captured source
  tree.
- Actual share export and the counterexample: **6/6 passed**, repeated three times with two browser
  workers; the separate log is retained with the regression output.
- Review found one hidden picker-error issue; it was fixed and covered by a failing-then-passing
  regression. No actionable review findings remain.
- PNGs are at most 950,101 bytes each; the manifest records every published artifact's size and
  SHA-256 hash.
- **Full-suite Actions proof is pending the Operator's `full-suite` label.** No full-suite label or
  workflow dispatch was added here.
- Second-phone scans stay blocked, needs the owner. Hardware smoothness, real-device load times, GPU
  presentation, and hardware WebGPU are unmeasured by this software-rendered run.

To rerun: start `npm run serve`, then
`SPLASHERY_CHROMIUM=/path/to/chromium ADV_RUNS=1 ADV_OUT=.cache/advisor-route-followup node tools/adv-route.mjs`.
The long route remains outside the default regression suite.

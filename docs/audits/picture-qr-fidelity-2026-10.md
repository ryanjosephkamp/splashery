# Picture QR fidelity: review pass (October 15–16, 2026)

The full goal is **not yet established**. The fixed corpus now contains 100 pictures, with 2,000
codes per mode and 96,000 independent reader attempts per mode. Full qualification is pending.
Standard remains the default, and old links retain Standard. Most detail remains optional.

Codex (GPT-6) started this review pass at 14:17:55 UTC on October 15, with a hard stop at 02:17:55
UTC on October 16. The comparison freezes merged main `cb8a8315`. PR #641 must land first; it is
still open and unmerged at the last check. It has not been merged into this branch independently.

The [first-pass report](picture-qr-fidelity-first-pass-2026-10.md) preserves the original
52-picture, 1,040-code results and their source controls. That historical evidence is not a fresh
qualification of this revision. It improved every picture/shape mean SSIM and passed all 49,920
reader attempts, but retained individual fidelity and speed regressions.

## Review fixes and validation

The canonical shared-builder golden is restored to `b3918a78…`. The original altered `d98ad9f6…`
expectation came from Node 24 and was incorrect for CI. Pinned Node 22.23.3 reproduced the failure
before restoration and passed the restored check. The original 191/191 claim is historical local
output, not evidence of a passing Node 22 CI run on that old head.

Main is merged, including all six theme packs. The original 32 samples, 48 theme pictures, and the
same 20 museum fixtures make the fixed 100-picture corpus. Source pages, asset credits, and the two
signature-removing crops remain in [CREDITS](../../CREDITS.md),
[the asset registry](../../tools/assets.json), and the original
[fixture manifest](../../tools/picture-qr-fidelity/corpus.json). No new picture assets were added in
this review pass. The
[frozen corpus](../../tools/picture-qr-fidelity/results/review-pass/corpus.json) and
[ten payloads](../../tools/picture-qr-fidelity/results/review-pass/payloads.json) identify every
input. All 100 browser-decoded 640-pixel source images are frozen independently.

Most detail now has a 20-second preparation and repair budget. Versions above 13 return immediately
to Standard with a plain notice; every study payload remains eligible. Both modes have a 30-second
cover watchdog. Cancellation terminates pending workers and propagates an abort rather than
restarting the work locally. If Standard cannot build a large Circle on the device, the stage clears
and explains the failure instead of showing an old payload as the new one. Tests cover stalled
workers, replacement by another toy, returning to Most detail, and 170/270-character links in Square
and Circle. Standard still cannot fit those long Circle cases at the Low geometry budget.

Most detail's PNG button and export API now wait for the completed layout, stage, and two-reader
stress checks. Export also rejects a replaced build. A browser regression withheld the real worker
results, reproduced the enabled export button, and now verifies that no PNG is returned until the
checks finish. The resulting PNG decodes with both independent readers.

Identical photo-uniform redraw skipping is explicit opt-in, used only by Most detail. Ordinary photo
recipes retain main's redraw behavior. Seven focused engine tests passed under Node 22, including
real WebGL2/WebGPU captures with Gaussian and Sharp kernels. The Picture QR About entry now
describes Most detail, and its help check passed. The seven frozen source archives are removed from
the feature tree and copied with matching hashes to the clips branch. Their
[manifest](../../tools/picture-qr-fidelity/results/revision-sources/manifest.json) supplies the new
URLs. Existing public Git history is retained.

The required QR/help suite and the isolated budget suite are running on the locked source. Their
fresh results will replace this pending statement before publication.

## Method and retained candidate

Each picture uses the same ten payloads in Square and Circle, H correction, Small center, 50%
contrast, Color style, and Bigger size. Every final capture is checked with jsQR and zxing-cpp at 8
and 4 pixels per module, blur of 0.2 and 0.3 modules, and six conditions: front, 10° yaw, 10° pitch,
a 30% brightness gradient, 15% brighter, and yaw with the gradient. Matching requires the exact
payload. [The independent capture protocol](../../tools/picture-qr-fidelity/captures.mjs) and
[readers](../../tools/qrs-study/readers.mjs) retain their thresholds and options.

The measure remains equal-channel RGB SSIM and RGB RMSE on the actual 720-pixel stage capture.
Source and capture are area-sampled to 128 × 128 and receive the same one-display-pixel blur at
390-pixel phone and 900-pixel print viewing sizes. All function patterns count. Circle's encoded
square uses the same central crop as the toy; its complete photo band is a separate secondary
measure. The independent metric does not use the candidate ranker's score. Each picture/shape mean
includes all ten payloads, with individual losses retained in the raw results.

The retained recipe begins with a weighted color fit and a bounded 40% share of each H block's
symbol-correction capacity for picture agreement. The larger checked fits remain fallbacks. The
original payload, terminator, alignment, function patterns, and correction-level bookkeeping are
preserved. This builds on the existing free-padding fit and the independently checked block map. The
RGB projection retains its 0.16 starting margin and the original three-module finder guard.

An opposite orientation is tried earlier after the first failed forecast. Perspective failures try
spatial repair before a lower correction budget; layout failures can restore more correction reserve
first. An actual failure of a larger-budget family restores the 40% preference before another
finder-tone attempt. These changes alter candidate order, not acceptance. All four original layout
checks and both original stage checks remain. Nine cheap predicted views now include both
stronger-blur pitch cases. Both readers still run all 24 conditions on the actual capture before the
cover disappears. Retries also run the complete predicted matrix.

The phone comparison uses Node 22, Low profile, SwiftShader, four reported cores under the same
four-core CPU quota, a 390 × 844 viewport, reduced motion, and adaptation off. Source decoding is
outside the clock; generation, camera checks, and cover removal are inside it. Main modules are
verified against their frozen Git blobs. Mode order is balanced, and actual draws on the inactive
page must stay zero. Final timing runs have no concurrent study or test workers.

## Ideas tested during review

These pilot results establish local tradeoffs, not full-corpus qualification. Their raw bytes,
arguments, and source hashes are retained in the
[diagnostic manifest](../../tools/picture-qr-fidelity/results/review-pass/diagnostic-manifest.json).

| Trial                                   | Evidence                                                                                                                                                                                                                                                                                                     | Decision                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Midtone gamma                           | Real opaque tiles reproduce 64, 128, and 192 exactly.                                                                                                                                                                                                                                                        | Gamma does not explain the color error.                                                                       |
| Equal-channel blends                    | On 20 controls, blend strengths 0.25, 0.5, and 1 change mean phone SSIM by −0.0551, −0.1038, and −0.1761; RGB RMSE rises by 0.00086, 0.00399, and 0.02449. Every control loses both measures.                                                                                                                | Reject; keep weighted projection.                                                                             |
| Eight remembered prediction failures    | On 17 distinct slow controls, profiled total time rises from 160.0 to 168.8 seconds. All primary scores and reader booleans match; one archived control PNG also matches byte for byte.                                                                                                                      | Revert; redundant predictions cost more than they save.                                                       |
| Narrower finder guard                   | Reducing three modules to two or one improves predicted mean phone SSIM by 0.0067 or 0.0075 and lowers RMSE by 0.0036 or 0.0040 on 20 controls, all passing the predicted matrix. In 36 actual cases, Pinecone payload 5 times out at 20 seconds and falls back to Standard, which fails 21 reader attempts. | Reject as default; retain the original guard.                                                                 |
| Correction-first 40% and early rotation | All 36 actual codes pass 1,728 attempts. Mean appearance is 2.235 versus main's 3.131 seconds; four codes are slower. This pilot precedes the added pitch predictions.                                                                                                                                       | Retain the 40% start and early spatial repair, then qualify the expanded corpus.                              |
| Correction-first 50%                    | All 36 codes pass 1,728 attempts. Mean is 2.234 versus 3.081 seconds; seven codes are slower. Mean phone SSIM is 0.0062 above the 40% pilot.                                                                                                                                                                 | Do not use as the start; extra retries remain.                                                                |
| Correction-first 60%                    | All 36 codes pass 1,728 attempts. Mean is 2.249 versus 3.148 seconds; five codes are slower. Mean phone SSIM is 0.0125 above the 40% pilot.                                                                                                                                                                  | Keep available as a checked fallback; the start causes an extra actual rejection on Cactus.                   |
| Texture sampler                         | Locked-reference CPU median falls from 85.81 to 65.68 ms across four 720-pixel fixtures. All 72 geometry cases and clamping/rounding controls retain identical bytes.                                                                                                                                        | Retain exact per-axis coordinate reuse and byte conversion. This is a CPU diagnostic, not a phone-time claim. |

The 50%/60% pilots include the added pitch predictions. The 50% pilot also includes the byte-exact
sampler optimization, so their timing differences cannot be attributed to the fraction alone.
Earlier tail diagnostics enabled CPU profiling; final timing does not. Mask-zero and alternate
orientation source probes are preserved too: mask zero did not rescue all four difficult version-12
Square controls, while the opposite orientation did. These are model observations.

Three final difficult-code smoke captures pass all 144 independent attempts after the export,
spatial-order, and sampler changes. Full 100-picture results are still required. No scan threshold
was lowered, no reader or condition was removed, and `tests/taps.spec.mjs` was not edited.

## Full captured results

Pending the locked-source run. The final table will include all 200 picture/shape means, every
individual loss, each reader and condition, all main regressions, and every slower timing case.

## Recommendation and remaining limits

Keep Standard as the default. The pilots show a useful optional improvement, but strict no-slowdown
is not established. The final report must retain slower codes, cold starts, failures, and all
color-error regressions. The selected recipe trades some of the 60% pilot's fidelity for less
correction damage and fewer expensive repairs.

PR #641 remains a merge-order dependency. Once it lands on main, merge main again and either support
its nondefault border, crop, and eye settings or return those settings to Standard with an
explanation. Re-measure the changed paths. No other branch is pushed or merged by this task.

Rule check: none.

# Picture QR fidelity: review pass (October 15–16, 2026)

The full goal is **not yet established**. The fixed corpus now contains 100 pictures, with 2,000
codes per mode and 96,000 independent reader attempts per mode. Full qualification is pending.
Standard remains the default, and old links retain Standard. Most detail remains optional.

Codex (GPT-6) started this review pass at 14:17:55 UTC on October 15, with a hard stop at 02:17:55
UTC on October 16. The comparison freezes merged main `cb8a8315`. PR #641 landed first. This branch
then merged main `d4df5998`, including its fitting controls and the WebGPU frame limit. It did not
merge the other feature branch independently.

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

Most detail has a 20-second preparation and repair budget. Versions above 13 return immediately to a
black-and-white Standard code with an explicit notice. This saved fallback uses an opaque module
tile for every bit, a checked grid of at least version 18, H correction when requested, and all four
original source checks. It tries another mask if those checks fail. The ordinary Standard look and
options remain available; choosing Color restores the picture and requested code size. The fixed ten
study payloads remain at versions 7–13 and never enter this fallback.

Real browser tests cover 170-, 270-, and 299-character links in both shapes. The two 299-character
cases also decode their actual PNGs independently with both readers at 8 and 4 pixels per module,
with no blur and blur of 0.2 and 0.3 modules: 24 reader attempts across both codes. Earlier failed
fallback geometries remain in the diagnostics. A forced 1,000-splat budget still verifies that an
impossible build clears the prior payload and releases its cover. Cancellation tests cover stalled
workers, replacement by another toy, and returning to Most detail.

After merging #641, Most detail accepts only Original crop, centered position, unit zoom, Original
border, and Original eyes. A nondefault request returns to Standard with a plain explanation and
preserves its settings. A separate button lets the owner explicitly choose the Original settings and
Most detail. Four real browser cases verify preservation and successful reset; Square ignores stored
Circle-only border and eye choices. Standard keeps #641's crop, border, eye, display, and export
checks.

Most detail's PNG button and export API now wait for the completed layout, stage, and two-reader
stress checks. Export also rejects a replaced build. A browser regression withheld the real worker
results, reproduced the enabled export button, and now verifies that no PNG is returned until the
checks finish. The resulting PNG decodes with both independent readers.

Identical photo-uniform redraw skipping is explicit opt-in, used only by Most detail and its
explicit code-only fallback. Ordinary photo recipes retain main's redraw behavior. Seven focused
engine tests passed under Node 22, including real WebGL2/WebGPU captures with Gaussian and Sharp
kernels. The Picture QR About entry now describes Most detail, and its help check passed. The seven
frozen source archives are removed from the feature tree and copied with matching hashes to the
clips branch. Their
[manifest](../../tools/picture-qr-fidelity/results/revision-sources/manifest.json) supplies the new
URLs. Existing public Git history is retained.

The pre-repair Node 22 run passes **276/276 tests across 31 files, with no skips or failures**. All
named QR prefixes, kit, smoke, and help pass in the 30-file llvmpipe suite; all seven wall-clock
budget tests pass alone on SwiftShader. WebGPU cases use real SwiftShader adapters. The
[check manifest](../../tools/picture-qr-fidelity/results/review-pass/node22-checks.json) links the
complete compressed Playwright reports, exact commands, runtime, and tested source revision. That
run precedes the Circle finder-edge repair below and is retained as historical verification. Four
refreshed 390-pixel motion clips compare `cb8a8315` and this recipe; both Most detail clips pass the
full pre-motion reader gate. Review media is published only on the clips branch.

The final required broad run completed with **303 passes, one unexpected failure, and no skips**
across 33 files. The failure was the general phone-sheet gesture in `smoke`; its exact isolated
rerun passed. The latest isolated SwiftShader budget suite passed all **11 tests**, and the `qr`
file, which started before the last Color-return fix, was repeated afterward with **12/12 passes**.
Together these cover all 33 named task-prefix files plus help. The
[final verification record](../../tools/picture-qr-fidelity/results/review-pass/final-checks.json)
retains the first failure, recovery, commands, source epochs, and complete reports. Repeated tests
are not counted as additional distinct cases.

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

Four Sun Circle payloads exhausted the 20-second budget during the expanded run. Their Standard
fallbacks passed only 41, 40, 40, and 39 of 48 independent reader attempts. All failures were jsQR
under the small, stronger-blur perspective conditions; zxing-cpp passed every condition. These
failed rows remain in the original raw run. The repair tries finder-edge values 0.4 and 0.42 after
the initial and opposite Circle forecasts fail. It preserves the correction fraction, center, guard,
margin, layout checks, predicted views, and complete captured-pixel checks. Square is unchanged.

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
verified against their frozen Git blobs. Actual draws on the inactive page must stay zero. Timing
runs have no concurrent study or test workers.

The final corpus is a segmented series, not one fresh balanced trial. The original partial run
contains 669 main and 668 detail captures. After the Circle repair, 644 unaffected detail captures
were retained, all 24 possibly changed Circle paths were captured again, and the first continuation
plan selected 1,332 remaining pairs with alternating mode order. That continuation stopped after 196
detail captures for the second repair described below. The original main observation takes priority
for the single overlapping key, independent of its measured time; the continuation observation is
retained as a replicate. The
[continuation plan](../../tools/picture-qr-fidelity/results/review-pass/continuation-plan.json) was
frozen before the continuation. [The assembler](../../tools/picture-qr-fidelity/assemble-review.mjs)
verifies the complete key sets, unchanged protocol and input hashes, and a byte-for-byte source
proof outside the Circle insertion. Only Circle captures accepted within their first two candidates
with capture validation are retained; all other completed Circle paths are rechecked. Cold starts,
an execution-session interruption, the intentional repair pause, failed original attempts, and the
duplicate baseline measurement remain part of the evidence.

Each primary timing is one observation per code and mode. The report retains small positive
differences as measured slower cases; it does not treat them as statistically established changes or
replace them with a faster repeat.

## Ideas tested during review

The [historical idea table](picture-qr-fidelity-first-pass-2026-10.md#ideas-tried) retains the
smaller and adaptive centers, color and chroma trials, free-padding fit, deliberate correction
damage, larger versions, diffusion changes, and module-shape experiments. Those initial source
prototypes are explicitly labeled as exploratory; their historical source and metric revisions were
not fully archived. The captured review trials below provide separate, recorded evidence.

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

The Sun repair diagnostics also retain unsuccessful trials. Guard 4/5/6/8 constructor probes, zero
correction damage, increased contrast, quarter turns, and all eight original-edge masks did not
solve the failures. The run named `theme-guard-four` actually used the existing maximum guard of
three, so it is a repeated control, not evidence about a four-module guard. Edge 0.4 alone rescued
three of the four actual codes but left payload 8 failing. Edges 0.4 and 0.42 together passed all
192 actual reader attempts in 3.36–5.25 seconds. The subsequent conservative 24-code changed-path
recheck passed all 1,152 attempts. The focused unit and two actual Sun browser regressions passed;
the final corpus and full named checks remain necessary.

Three final difficult-code smoke captures pass all 144 independent attempts after the export,
spatial-order, and sampler changes. Full 100-picture results are still required. No scan threshold
was lowered, no reader or condition was removed, and `tests/taps.spec.mjs` was not edited.

## Second repair and merge qualification

The expanded run paused again after 864 detail captures. One Scallop shell (soft) Circle, payload 5,
exhausted the detail budget; its Standard fallback passed 34 of 48 reader attempts. It lost no read
that passed in the matching baseline. A 40-control source probe found that mask 6 failed, while
masks 0–5 and 7 passed the existing checks at finder edges 0.4 and 0.42. The repair tries alternate
masks only after the original four Circle forecasts fail. The original correction level, reserve,
margin, guard, and acceptance checks remain. The actual Ocean regression passed all 48 independent
reads after the merge.

Winter fir (soft), Square, lost 0.0026 mean print SSIM despite a small phone gain. The longest
baseline render is a strip of QR code over an otherwise blank image; that blank area scores well
under SSIM, even while its RGB error is worse and it fails the readers. The metric is unchanged. A
60% correction-share pilot on all ten Winter fir Square payloads passed 480 reader attempts and
raised mean phone and print SSIM over main by 0.0201 and 0.0136. Both gains are about 0.0162 above
the prior 40% recipe.

The resulting policy gives a 60% starting share to Square pictures whose three RGB population
standard deviations are each at most 0.1; other pictures and all Circles start at 40%. A study
proposal recorded this cutoff before classifying all 100 decoded source images. It selects 46 theme
pictures. Independent source records and the production Float32 calculation agree on every
classification. This is a policy chosen using the fixed study corpus, not a held-out generalization
result. Failed captured candidates retain the existing return to the 40% share.

The [second repair plan](../../tools/picture-qr-fidelity/results/review-pass/repair-plan.json)
freezes 128 completed cases for fresh qualification: every affected Square, every prior fallback and
model-validated result, every Circle accepted after its fourth candidate, and six pixel controls. It
retains 736 other detail captures and adds 1,136 uncaptured pairs. The six controls must match their
earlier captured RGBA exactly before the continuation starts. The
[second assembler](../../tools/picture-qr-fidelity/assemble-repair.mjs) enforces the exhaustive key
selection, source and input provenance, fixed payload versions, mask-insertion byte proof, pixel
controls, and retained observation labels. Earlier failed attempts and duplicate baseline
observations remain in the evidence.

## Third repair: very flat Squares

The next continuation paused after 319 detail captures. Crescent moon, Square, passed all reads but
lost 0.000899 mean print SSIM at the 60% share. Reordering the existing 0.32 finder tone passed 480
reads but left a 0.000851 loss, so it was dropped. The first requested 65% trial was still clamped
to 60% in the fitter: all ten capture hashes matched the control. That run is labeled a clamped
control. A corrected actual 65% trial passed all 480 reads and gained 0.013337 mean phone SSIM and
0.005899 print SSIM over main. Its browser module overrides, exact hashes, source files, and loader
are recorded separately from the underlying production-tree provenance.

The final policy uses 65% only for Square pictures whose three RGB population standard deviations
are each at most 0.05. It selects 11 pictures. Other low-contrast Squares remain at 60%, and other
Squares and all Circles remain at 40%. The fitter's ordinary API still caps at 60%; the larger share
requires an explicit opt-in, and the constructor permits it only in this source domain. All margins,
guards, readers, conditions, and pre-display checks remain. This cutoff was chosen after inspecting
the fixed corpus, not before classification or on held-out pictures.

The [third plan](../../tools/picture-qr-fidelity/results/review-pass/third-plan.json) quarantines 12
completed affected Squares and three controls, then captures 818 keys with either mode missing. One
fresh detail replicate has predeclared recheck priority. The
[assembler](../../tools/picture-qr-fidelity/assemble-third.mjs) verifies every source
classification, unchanged inputs and assessment code, formatted source equivalence outside the
explicit budget changes, source epochs, and control pixels. Earlier failed means, trials, and
observations remain. The focused policy and two-reader budget regression pass, as do all 11
wall-clock fallback tests; the complete named QR suite is being repeated on this runtime. The
repeated suite caught an oversized request selecting 65% on flat input. The existing regression was
left unchanged, and the constructor was corrected to require the exact 65% opt-in; oversized
requests still cap at 60%. The failed attempt and focused guard/policy rerun are retained.

Independent post-capture assessment now partitions the original 24 conditions across four local Node
workers. The worker jobs finish before another appearance measurement starts. This changes study
throughput, not the application, the appearance-clock boundary, image arithmetic, readers,
conditions, or thresholds. On 12 actual captures, including incomplete baseline codes and both
shapes, every score, capture hash, and all 576 reader outcomes match the original serial assessment
exactly. The
[equivalence record](../../tools/picture-qr-fidelity/results/review-pass/qualification-equivalence.json)
and formatted source proof preserve that comparison. Retained timings remain earlier observations.

## Full captured results

Pending the locked-source run. The final table will include all 200 picture/shape means, every
individual loss, each reader and condition, all main regressions, and every slower timing case.

## Recommendation and remaining limits

Keep Standard as the default. The pilots show a useful optional improvement, but strict no-slowdown
is not established. The final report must retain slower codes, cold starts, failures, and all
color-error regressions. The recipe retains the 40% start for higher-contrast Squares and all
Circles, while low-contrast Squares start at 60%, and the very flat subset starts at 65%. The report
separates structural fidelity from RGB error and scan margin.

PR #641 is merged. The remaining qualification uses explicit Original settings so the fixed source
crops and encoded-square measure match the earlier observations. The final evidence labels retained
observations and fresh affected-path captures separately; retained timings are not fresh
measurements of the merged UI. All required qrc/qrs and QR-prefix checks have been rerun after the
merge. The initial concurrent run's phone-sheet gesture failure and its successful isolated rerun
are both retained.

Rule check: none.

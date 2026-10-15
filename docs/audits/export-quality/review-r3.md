# Phone High duration follow-up — October 15, 2026

Built by Codex (GPT-6). This responds to the
[Operator's re-review of c14ddf38](https://github.com/ryanjosephkamp/splashery/pull/654#issuecomment-6198123496).
The PR remains a draft for the owner's look. Rule check: none.

Phone Standard and High now budget at least three minutes. High keeps the native stage pixels; its
target bitrate is lowered to fit 180 seconds of video and the 128-kb/s audio allowance in 80% of its
encoded-output budget. The remaining 20% is a policy margin for variable-bitrate output and
container overhead. The existing byte guard still applies. The Record note and recording clock use
the same plan. The computer policy is unchanged.

| Phone CSS stage, DPR 3 | Level    | Saved pixels | Video bits/second | Limit | Encoded-output budget |
| ---------------------- | -------- | ------------ | ----------------: | ----- | --------------------: |
| 390 × 600              | Standard | 586 × 900    |         3,151,107 | 3:00  |      92,224,896 bytes |
| 390 × 600              | High     | 1170 × 1800  |         2,253,059 | 3:00  |      66,967,296 bytes |
| 390 × 664              | High     | 1170 × 1992  |         2,125,264 | 3:00  |      63,373,056 bytes |
| 430 × 900              | High     | 1290 × 2700  |         1,469,699 | 3:00  |      44,935,296 bytes |

These are policy budgets, not measurements of available phone memory. Compressed chunks stay in RAM
until Stop, then become a Blob. Nothing is split, uploaded, or written to disk automatically. The
96/384-MiB phone/computer ceilings still reserve render surfaces and a second output copy.

## Full-length phone takes

All four real takes reached the 180-second time limit, including both High takes. None stopped at
the byte guard or failed. Each replayed the toy action about every four seconds with sound.
[The refreshed record-rates-r2.json](record-rates-r2.json) includes retained compressed bytes,
samples about every five seconds, the largest chunk, and JS heap samples. The earlier short
phone/computer measurements remain in
[record-rates-r2-original.json](record-rates-r2-original.json).

| Toy         | Level    | File bytes | Encoded seconds | Video frames | Bytes/second | MB/min | Bytes below encoded cap |
| ----------- | -------- | ---------: | --------------: | -----------: | -----------: | -----: | ----------------------: |
| Photo to 3D | Standard |  4,213,835 |         180.662 |          399 |       23,324 |  1.399 |              88,011,061 |
| Photo to 3D | High     |  2,418,752 |         179.747 |          229 |       13,456 |  0.807 |              64,548,544 |
| Donut       | Standard |  3,424,492 |         179.975 |          347 |       19,028 |  1.142 |              88,800,404 |
| Donut       | High     |  2,937,614 |         179.662 |          264 |       16,351 |  0.981 |              64,029,682 |

MB means 1,000,000 bytes. Duration is the span of actual audio/video packet timestamps; UI time is
clamped at 180 seconds. These sparse SwiftShader recordings establish elapsed duration and retained
output for this emulation, not sustained hardware 30-fps throughput. Local regression tests ran
concurrently. Actual-rate measurements therefore do not replace the conservative bitrate budget used
to calculate the limit.
[Every video frame was independently decoded](record-rates-frame-checks-r3.json); none was dark or
near uniform.

The byte samples count the compressed chunks the recorder retains, without retaining extra Blob
copies in the observer. JS heap samples include the app and garbage-collection churn; they exclude
native codec, canvas, GPU, and Blob backing allocations, and are not total device memory. The 20%
reserve is a bitrate policy margin, not a measured free-RAM margin. Physical phone capacity remains
unmeasured.

## Picture comparison

Fresh captures use main's fix that waits for an actual draw. Phone emulation is 390 × 844, DPR 3,
with a 390 × 600 stage. The fixed Photo to 3D scene uses `renderAt(0, cameraState)`. Both saved
levels are compared at 1170 × 1800 against the same High live-canvas reference. Standard is enlarged
with Lanczos; High stays at its native size. The picture-only crop excludes the white surround and
is the bounding box of non-white pixels in the reference. No registration is applied.

For the first three decoded frames, picture SSIM is **0.469571 Standard / 0.562608 High**. Luma
Laplacian variance is **154.2 / 826.4** at this common display size. The centered, unscaled
comparison crop shows more leaf and path detail in High, along with compression artifacts. Sharpness
alone is not a fidelity score. Neither level matches the live reference. Per-level saved/live
compression scores are retained separately; their different reference resolutions cannot establish
which saved picture has more detail.

Reproduce the fixed captures with `node tools/export-quality.mjs <directory> --records-only`, then
run `python3 tools/export-quality-score.py <directory> --compare-phone`. Review clips, reference
PNGs, and the comparison crop go only on `codex/export-quality-clips`.

## Integration and failure investigation

Merged main at `d4df5998`, including `c13a9d3f` and #663's `captureFrame` draw wait. No engine file
is changed relative to main. The duration regression failed at 60 seconds before the policy fix and
passes at 180 seconds for both reviewed phone sizes afterward.

The [previous full GitHub run](https://github.com/ryanjosephkamp/splashery/actions/runs/38777190217)
reported 2,748 passed, seven failed, and one skipped across 314 files. Every failure follows, with
its automatic isolated rerun result. Passing alone did not erase a failure.

| Previous failure                     | Passed alone?                        | Investigation / correction                                                                                                                                                 |
| ------------------------------------ | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `man5:201`, reproducible shipped PDF | No; marked known on main in that run | Imported a fresh immutable edition from the pinned Chromium 141 workflow after adding the library rows. All 29 manual and PDF checks passed, including reproducible bytes. |
| `man5:252`, complete vendor table    | No                                   | Reproduced. Added both MIT muxers, their pinned versions, jobs, and lazy loading point to the manual; rebuilt its combined page. Passed afterward.                         |
| `man7a:67`, animated grid figure     | Yes                                  | Retained as a reported timing failure; no assertion changed.                                                                                                               |
| `math:368`, typed surface            | Yes                                  | The intermediate run exposed an input-panel rebuild race; the added readiness assertion is described below.                                                                |
| `shr:135`, desktop Share layout      | No                                   | CI trace identified `gif-frames` clipping at “144 frames.” The Frames field now contains just the number; no layout or assertion changed.                                  |
| `spg:46`, complete site credits      | No                                   | Reproduced. Rebuilt the generated credits page from CREDITS.md and LICENSES.md; passed afterward.                                                                          |
| `ui3:76`, pause/resume               | Yes                                  | Retained as a reported timing failure; no assertion changed.                                                                                                               |

## Superseded intermediate run

The
[intermediate run at cd8ffb7c](https://github.com/ryanjosephkamp/splashery/actions/runs/38812613741)
was superseded when the checked PDF and full-length evidence landed. It was canceled, so its partial
results are not a full-suite result. Completed reports exposed these five failures:

| Failure                              | Automatic isolated rerun                                                    | Finding                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------ | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `math:368`, typed surface            | Failed with the same wrong empty-input message                              | Scene options update before the rebuilt input panel is installed. The test typed the next equation into the old panel. Added an assertion that the applied equation appears before typing again, matching the curve test. All original options/error checks remain.                                                                            |
| `fx4-engine:79`, non-rim WebGL2 toys | Failed with connection refused after the server stopped during cancellation | Initial difference was 348 bouncy-ball pixels versus a 220-pixel threshold. The canceled-run retry did not reproduce that comparison. A fresh SwiftShader rerun timed out at 240 seconds before finishing the three-context comparison. A longer CLI time budget is being checked; all pixel assertions and repository timeouts are unchanged. |
| `man5:201`, shipped PDF              | Failed with the same stale-PDF message                                      | Corrected by the checked new immutable edition; all 29 manual/PDF checks passed in the pinned workflow.                                                                                                                                                                                                                                        |
| `hh5-math:104`, Menger sponge pull   | Passed                                                                      | Reported as a failure in that run; no assertion changed.                                                                                                                                                                                                                                                                                       |
| `smoke:1054`, resizing panel/shelf   | Passed                                                                      | Reported as a failure in that run; no assertion changed.                                                                                                                                                                                                                                                                                       |

The surface test passed three consecutive reruns after the caption check was added. Its exact error
and option assertions and its timeout are unchanged.

## Validation checkpoint

The merged-tree export spec passed all 21 cases. The duration regression failed at 60 seconds before
the fix and passes at 180 afterward. The pinned
[manual-PDF workflow](https://github.com/ryanjosephkamp/splashery/actions/runs/38812628385) passed
all 29 manual/PDF cases. Its immutable edition is `tinkerers-manual-e50e5205f56d0c83.pdf`; the
downloaded artifact's source commit and PDF content hash were checked before import.

The broader local run uses Node 24 and SwiftShader. Its moving-PDF case timed out under concurrent
capture load, then passed individually in 3.7 minutes with the original 240-second timeout and every
assertion unchanged. The initial timeout still counts. Both exact QR builder hashes fail under Node
24, including on extracted immutable main `d4df5998`; both pass individually under Node 22.23.3,
matching CI's runtime. Builder source files are identical to main. Assertions are unchanged. See
[the runtime comparison](runtime-hashes-r3.json) and [the PDF build record](manual-pdf-r3.json).

Final merged-tree local results and full GitHub results, including every failure and its isolated
rerun, are maintained in [PR #654](https://github.com/ryanjosephkamp/splashery/pull/654) and the
clips branch's `r3/verification.json`. The Operator's `full-suite` label is retained. This
checkpoint does not claim a green full suite.

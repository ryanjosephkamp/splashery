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

Reproduce the fixed captures with `tools/export-quality.mjs --records-only`, then run
`python3 tools/export-quality-score.py <directory> --compare-phone`. Review clips, reference PNGs,
and the comparison crop go only on `codex/export-quality-clips`.

## Integration and failure investigation

Merged main at `d4df5998`, including `c13a9d3f` and #663's `captureFrame` draw wait. No engine file
is changed relative to main. The duration regression failed at 60 seconds before the policy fix and
passes at 180 seconds for both reviewed phone sizes afterward.

The [previous full GitHub run](https://github.com/ryanjosephkamp/splashery/actions/runs/38777190217)
reported 2,748 passed, seven failed, and one skipped across 314 files. Every failure follows, with
its automatic isolated rerun result. Passing alone did not erase a failure.

| Previous failure                     | Passed alone?                        | Investigation / correction                                                                                                                         |
| ------------------------------------ | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `man5:201`, reproducible shipped PDF | No; marked known on main in that run | Main brought a refreshed immutable PDF. Adding the two missing library rows requires another print in the pinned CI environment.                   |
| `man5:252`, complete vendor table    | No                                   | Reproduced. Added both MIT muxers, their pinned versions, jobs, and lazy loading point to the manual; rebuilt its combined page. Passed afterward. |
| `man7a:67`, animated grid figure     | Yes                                  | Retained as a reported timing failure; no assertion changed.                                                                                       |
| `math:368`, typed surface            | Yes                                  | Retained as a reported timing failure; no assertion changed.                                                                                       |
| `shr:135`, desktop Share layout      | No                                   | CI trace identified `gif-frames` clipping at “144 frames.” The Frames field now contains just the number; no layout or assertion changed.          |
| `spg:46`, complete site credits      | No                                   | Reproduced. Rebuilt the generated credits page from CREDITS.md and LICENSES.md; passed afterward.                                                  |
| `ui3:76`, pause/resume               | Yes                                  | Retained as a reported timing failure; no assertion changed.                                                                                       |

Full-length take measurements, requested merged-tree specs, and the next full GitHub run are in
progress. Final results will be recorded here before hand-back.

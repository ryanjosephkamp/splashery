# Video to 3D R5: Operator follow-up, October 16, 2026

Codex (GPT-6) addressed the
[Operator's four requests](https://github.com/ryanjosephkamp/splashery/pull/673#issuecomment-6219196127).
The original twelve-hour Goal remains incomplete. These follow-up checks do not turn the older,
incomplete native cohort into a complete acceptance pass. Rule check: none.

## Memory: measured cause and retained tradeoff

Across the fourteen completed phone pairs, aggregate browser-process peak RSS has a median of
1,344.791 MiB on initial main and 1,668.701 MiB on measured R5. Worst observed peaks are 1,446.652
and 1,692.945 MiB. The median paired increase is 321.439 MiB. This is sampled, summed process RSS
under SwiftShader; shared pages can be counted twice. It is not physical-phone RAM or GPU-memory
evidence, and the no-worse-memory condition is not claimed.

The [complete scalar receipt](video-3d-r5-memory-2026-10.json) and
[reproduction tool](../../tools/v3d-memory.mjs) isolate allocations using the licensed, exact-SHA
outdoor-cat cut already in the corpus. Each fresh browser runs actual Phone-safe frame extraction,
camera solving, and seeding. Probes stop before training, hold the original phone settings, and
change one setting at a time. Both repetitions are shown; allocation totals sum buffer-creation
requests through setup, including buffers already released. They do not measure live GPU RAM,
full-bake speed, or quality. No failed solve is assigned a seed checkpoint or a quality score. Run
the tool against a separately served checkout with an explicit server URL, for example
`node tools/v3d-memory.mjs <corpus>/cat-plays.mp4 <new-output>.json --url=http://127.0.0.1:4173/`.

| Setup variant | Repeat | Allocated buffers (MiB) | Seed-checkpoint RSS (MiB) | Seed splats | Surface rows |
| ------------- | -----: | ----------------------: | ------------------------: | ----------: | -----------: |
| unchanged     |      1 |                 419.632 |                  1128.152 |      15,000 |       11,963 |
| tile16        |      1 |                 111.171 |                   843.957 |      15,000 |       11,963 |
| no-background |      1 |                 419.632 |                  1136.605 |      15,000 |       11,963 |
| no-surface    |      1 |                 419.632 |                  1127.793 |      14,718 |            0 |
| unchanged     |      2 |                 419.632 |                  1137.469 |      15,000 |       11,963 |
| tile16        |      2 |                 111.171 |                   837.988 |      15,000 |       11,963 |
| no-background |      2 |                 419.632 |                  1157.660 |      15,000 |       11,963 |
| no-surface    |      2 |                 419.632 |                  1137.703 |      14,718 |            0 |

The software-only eight-pixel renderer reserves 52,428,800 padded depth/id entries: exactly 400 MiB.
Changing only tile size to 16 restores 12,000,000 entries, or 91.553 MiB. The entry buffer alone
explains 308.447 MiB; the complete buffer-allocation difference is 308.461 MiB. The increase is
already present before any background fitting or optimizer step. Disabling the background-fit option
changes target-buffer usage, not its size. Removing the surface rows keeps the same 30,000-splat
capacity and buffer sizes. Neither explains the roughly 300 MiB increase.

The render target is smaller than main's: this phone setup reserves 320 by 320 pixels, with a 1.563
MiB output buffer, versus the old 2,560 by 1,440 default's 56.250 MiB. A background fit maps one
camera at a time: at most 1.953 MiB for a 320-by-320 camera, then releases it.

**Retained tradeoff:** keep the larger tile list on software adapters that can fit its complete
worst-case bound. It avoids dropping contributions while using the smaller, faster raster tiles. The
original fourteen native phone pairs retain their measured first-view and bake-time gains; these
setup probes establish the memory cost, not another timing or quality pass. Cutting the entry bound
alone would make tile coverage incomplete. Reverting software tile size would need fresh full-bake
measurements before replacing the existing speed evidence.

Hardware adapters never opt into this eight-pixel path: they keep tile 16. The existing engine also
falls back to tile 16 when the complete tile-eight bound cannot fit the device's binding and buffer
limits. Actual-phone memory remains unmeasured; no hardware-phone memory pass is inferred from this
software-only explanation. The Operator explicitly allowed a measured justification.

A first post-format probe ended with the normal, actionable camera-parallax explanation before
seeding. The receipt retains that failure, followed by one fresh complete eight-probe series. An
earlier successful series found the same exact allocation difference; it is not substituted for the
final source-bound receipt.

## Desktop limits

The low, mid, high, and max settings again have no training wall-time cap and no added hard pipeline
decode, camera-solve, seed, finish, or export deadline. Iteration and splat budgets remain in place.
Phone-safe keeps its eight-minute training cap and original hard stage deadlines. Adapter discovery
remains bounded, as does the optional background fit, which falls back to the trained model without
discarding it. Existing video-open and per-frame seek limits remain unchanged.

New pipeline tests simulate successful work beyond each former desktop limit, all four desktop tiers
training beyond fifteen minutes, and Stop waiting for a slow finish before export. They also
exercise every phone stage limit, its training timer, and cancellation of uncapped work. These are
clock-controlled session fixtures, not six new native sample bakes. Keeping main's non-phone
behavior is the review's first permitted option. A read-only control runs the same new desktop
assertion against the pre-review `6eaa9db4` pipeline and fails at its added decode cap.

A new test exposed a phone finish race: the session emitted completion before its finish promise
settled, so that event could bypass the finish deadline. The pipeline now waits for the checked
finish promise while stopping; the same assertion failed before the fix.

## Older browsers

New browser tests remove VideoFrame, requestVideoFrameCallback, and both APIs. Each configuration
loads all six real shipped source cuts, preserves the suitability verdict and advice, and extracts
nonblank training JPEGs without page errors. A separate test exercises the visible toy's file input
with both APIs absent. Requested-time-only fallback frames retain null presentation evidence; they
do not acquire invented source timestamps.

A repeated compatibility run exposed an early seek completion: initial loaded data or an eager
readyState check could finish a changed seek before its seeked event. Changed targets now wait for
seeked; an unchanged target can still use its already available picture. The new event-order
regression fails before this fix and passes after it. The quick survey also waits through a
completed paint using two animation callbacks, with cancellation and its original 4.5-second budget.
Neither path requires the newer frame APIs. The cancellation check releases a stalled paint wait.
The final uninstrumented three-repeat run passes all 15 cases. A separate instrumented check covers
54 clip/configuration comparisons: all 12 observed source timestamps and the advice match in each
comparison, with no requested time outside its captured source interval. That diagnostic does not
score trained models. One and two animation callbacks alone failed the repeated compatibility check;
no calibration threshold, verdict comparison, or frame check was loosened to make them pass.

The memory probes preceded the later main merge and the final seek and quick-survey refinements.
Their receipt lists the later source differences. The run.js pipeline, all vendored engine and
allocator files, and the reproduction tool remain byte-identical. These setup measurements do not
establish fresh full-bake quality or timing acceptance.

## Main merge and verification

Merged current main `6c38b4f690e6cd9e8cdff7e85f14176e08aebf40` with an ordinary two-parent merge,
`d9703a5241e9098cf58a54547eddaecaee7910b1`. The earlier main merge `6d2b0da8` is retained. No
rebase, force-push, or main-branch push. The PR remains a draft. Existing specs, thresholds, and
skips are unchanged by this follow-up.

Local `SPLASHERY_CHROMIUM=/usr/bin/chromium SPLASHERY_PORT=4186` Playwright run: **325 passed in 7.5
minutes, zero failed, and zero skipped**, covering all 53 Video to 3D specs. The existing
private-counterexample manifest was enabled, so all 12 calibration cases ran without redistributing
private media. All 362 existing spec files remain byte-identical to the merged-main checkpoint. The
tested browser runtime fingerprint is
`959eede1d73392517145c005782b76e3fdb0524c5763cece46ecc45473cfa8ad` (388 files); every file hash was
rechecked after the run. This follow-up adds four specs and nineteen tests. The earlier failed
calibration and compatibility runs are retained; no assertion, threshold, existing test timeout, or
skip was weakened.

The fresh hosted full suite runs when the merged source is pushed; its actual outcome is recorded in
the PR. The separate pack, whole-repository formatting, and American English checks run before
pushing. No hosted suite pass is inferred from the local subset.

The earlier normal full-suite run on `6eaa9db4` ended at 3,058 passed, one failed, and one existing
conditional skip. The remaining failure was the Pebbles test `phy:64`; passing alone did not waive
it. A fresh full-suite run on the merged source is required. Its final status belongs in the PR, not
an invented pass here. The owner's real-GPU desktop decision remains deferred, as requested.

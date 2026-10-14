# Playback and Photo checkpoint follow-up

Made by Ryan with Codex (GPT-6), October 14, 2026. Review evidence only; this branch must never be
merged.

### October 14 playback and Photo to 3D checkpoint follow-up

The
[Operator’s re-review](https://github.com/ryanjosephkamp/splashery/pull/560#issuecomment-6163399187)
asks for per-sample phone playback timing, explicit remaining Goal failures, and Photo to 3D
checkpoint verification. Current main `6c3764ff` merged cleanly into this branch as `7f7449c0`. Both
Photo checkpoint branches remain untouched. The review-media branch remains unmerged.

**Playback smoothness remains unaddressed.** These measurements provide a comparison for the
Operator’s merge tests, not an Android smoothness certification. In the matched Bunny and Horse
cases, this branch’s measured render cadence is slower than main. Sintel, Bridge, and Machine on
main had no Sharp picture in this sequential run, so their fast intervals are not valid performance
comparisons of the corrected picture path.

| Sample       | Main median / worst (ms) | PR median / worst (ms) |
| ------------ | -----------------------: | ---------------------: |
| Bunny        |             82.9 / 303.1 |          209.3 / 597.2 |
| Horse        |             66.2 / 165.2 |          203.4 / 638.6 |
| Sintel       |          16.9 / 272.4 \* |          156.5 / 399.6 |
| Bridge       |          17.4 / 202.1 \* |          216.5 / 852.7 |
| Machine      |          18.6 / 392.6 \* |          208.9 / 555.1 |
| Bunny long   |              Not on main |          339.5 / 700.2 |
| Sintel long  |              Not on main |          303.8 / 877.1 |
| Machine long |              Not on main |          352.2 / 944.4 |
| Bridge long  |              Not on main |          342.5 / 806.4 |

One browser ran at a time, with no concurrent browser tests. Actual Chromium 151 used headed
ANGLE/Mesa llvmpipe, two graphics threads, a 390×844 mobile viewport, DSF3, an Android Chrome user
agent, and CDP page CPU slowdown 4. The low-tier canvas cap remains DPR1.5; workers are not
throttled. Each clip warmed up for two seconds, then ran for 12 wall-clock seconds for a short
sample or 30 for a long sample. The median and worst are observed `performance.now()` intervals
between actual PlayCanvas `frameend` events, excluding the incomplete intervals at the window edges.
They are render cadence, not compositor presentation times or decoded-video drop counts. Every
branch row had Sharp active on every measured frame. Asterisks mark main’s missing Sharp pictures.
The four long samples do not exist on main. Raw timestamps, source clocks, sample IDs, and counts
are retained in the
[playback ledgers](https://github.com/ryanjosephkamp/splashery/tree/codex/moving-photo-r3-clips/docs/reviews/moving-photo-r3/checkpoint-follow-up).
`tools/cdx-mp2-playback.mjs` reproduces the protocol.

**Recorded Goal failures:** all three worse steadiness pairs are complete:
`phone/bridge-long/sample`, `desktop/sample/upload`, and `phone/sample-long/upload`. The recorded
desktop startup run missed the two-second target on **6 of 19** cases (13 passed; maximum 3,066.6
ms). These are the original Round 3 measurements at pin `94a18adf`, not a fresh quality/startup
sweep after this merge. The owner decides whether those remaining limits are acceptable. The
complete Goal remains unmet; physical Android Chrome/Brave smoothness is not verified here.

**Photo checkpoint:** compared with `claude/checkpoint-photo-3d-2026-10-14` at `58f3d8ed`, all Photo
toy, build, depth, and relief modules are byte-identical. The 18 requested spec files are also
byte-identical. The only source difference among the checkpoint’s Photo modules is in
`photo-sharp.js`: clip entry points and helpers, clip-only freshness, recreation when moving between
clip and photo meshes, and the clip branch of shape/frame handling. The photo preparation, fill, and
shape paths retain the checkpoint implementation. The clip-specific mesh recreation prevents
modified clip shaders/callbacks from being reused for a photo.

All **97/97 requested cases pass** in one complete invocation (20.16 minutes), with zero failures,
skips, or configured retries. All 18 spec files remain byte-identical to the checkpoint.
`tests/psv*.spec.mjs`, `tests/p3d*.spec.mjs`, and `tests/cdx-p3d2-*.spec.mjs` all ran on this merged
branch. No test or threshold was changed.

| Requested spec file                        | Passed |
| ------------------------------------------ | -----: |
| `cdx-p3d2-core.spec.mjs`                   |      4 |
| `cdx-p3d2-input.spec.mjs`                  |      1 |
| `cdx-p3d2-r3-anchored.spec.mjs`            |      6 |
| `cdx-p3d2-r3-background-interior.spec.mjs` |      4 |
| `cdx-p3d2-r3-background.spec.mjs`          |      1 |
| `cdx-p3d2-r3-compact.spec.mjs`             |      4 |
| `cdx-p3d2-r3-depth.spec.mjs`               |      7 |
| `cdx-p3d2-r3-edges.spec.mjs`               |      3 |
| `cdx-p3d2-r3-footprint.spec.mjs`           |      2 |
| `cdx-p3d2-r3-input-race.spec.mjs`          |      1 |
| `cdx-p3d2-r3-metrics.spec.mjs`             |      2 |
| `cdx-p3d2-r3-surface.spec.mjs`             |      4 |
| `cdx-p3d2-render.spec.mjs`                 |     16 |
| `cdx-p3d2-text.spec.mjs`                   |      2 |
| `p3d.spec.mjs`                             |     10 |
| `psv.spec.mjs`                             |      8 |
| `psv2.spec.mjs`                            |      6 |
| `psv3.spec.mjs`                            |     16 |

The earlier combined 266-case invocation hit 11 connection refusals before Photo rendering because
some helpers defaulted to port 4173 while the branch server was on 4388. Starting 4173 corrected
that environment. A workspace restart then killed the invocation during case 222, before its final
report. That invocation is incomplete. The full 97-case rerun sets both `SPLASHERY_PORT=4173` and
`SPLASHERY_URL=http://127.0.0.1:4173/`; every former connection-failure case passes unchanged. The
separate smoke invocation passes **50/50 cases** (14.30 minutes), with zero failures, skips, or
configured retries. The unchanged embed-transfer test measured 9.2 MB against its 30 MB limit.
Generated tracked screenshots were restored.

Current merged production pin: `ef0e056b84eb2f37f8dcfc3b7f3fcb240df8b6a7b57bbb4bc212d7ca62565a63`.
Earlier Round 3 ledgers and films retain their historical source hashes and are not relabeled as
measurements of this merge. No existing test, threshold, or shared relief module was edited by this
follow-up.

Rule check: existing public sample footage only; no visitor file or new image asset is introduced.
The existing Tears of Steel permission remains recorded above. Checkpoint branches were read only,
and review media stay on `codex/moving-photo-r3-clips`, which must never be merged.

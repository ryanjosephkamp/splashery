# Closing R12 evidence

Captured 2026-10-15T16:15:23.849Z under the original twelve-hour bound. **The full acceptance goal is not established.**

[All forty native outcomes](native-outcomes.md) · [Recorded causes and advice](failures-causes.md) · [Offline dashboard](index.html) · [Original full report](report.md) · [Unchanged machine gates](gates.json) · [Original snapshot instructions](README.md).

Main has 40/40 captured rows. The strict paired master has 18/40. All 40 raw attempts are preserved separately: 40 recorded rows, 22 unpaired recorded rows, and 0 pending or interrupted reservations. Raw results never enter strict gates merely because a model exists.

| Profile | Strict scored pairs | Partial-pair sharpness ratio | Partial-pair SSIM median change | Quality gate | Timing gate |
|---|---:|---:|---:|---|---|
| phone | 11 | 4.75773 | 0.103364 | false | false |
| desktop | 0 | — | — | false | false |

Partial-pair medians are diagnostic. Missing coverage, failed reference guards, or dropped baseline successes prevent a corpus pass. Incomplete timing remains censored. RSS is sampled aggregate browser memory, not GPU RAM or an acceptance gate.

Frozen native source: `64ec9ad5b7a90b590b289f6a02f0bbd50138db08`, served-source SHA-256 `6d362ff52101541719cc6b639d48b394630113fa61b3467ddbecb78dbe8742b8`. The separate merged-app sample replay does not relabel this cohort.

| Sample cohort | Cases | Views | Actual verification |
|---|---:|---:|---|
| R12-frozen64ec | 12 | 74 | completed-and-independently-pixel-verified |
| postmerge-2773 | 12 | 74 | completed-and-independently-pixel-verified |

[Post-merge sample proof](../postmerge-samples-r9/README.md) · [Latest full CI](../ci-db81-r9/README.md) · [Closing controls](../r12-closing-controls-r9/README.md) · [Actual paired review record](../../reviews/candidate-r12-unranked-r9/README.md).

The latest complete CI retains 341 original shard spec files: 2,914 passes, five failures, and one existing skip. Failed assertions remain counted. No original project assertion, threshold, or skip was weakened by this report.

The host provides a four-core CPU quota and SwiftShader software graphics. Phone and desktop are viewport profiles under overlapping host work. These observations do not establish physical-device or isolated timing gains.

Verify copied and losslessly restored bytes with `node inputs/report-code/verify.mjs .`. Every copied source byte was checked before and after publication. The original snapshot freeze and restoration maps remain usable; new presentation receipts have distinct names and do not overwrite original proof. Raw logs, telemetry, and oversized images retain exact bytes through lossless archives. Source licenses and attribution remain in the captured manifest and credits.

Rule check: none.

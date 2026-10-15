# Captured results

Exact training-picture/source-time proof only; shared-load extraction timings. No bakes, held-out metrics, physical-device or acceptance claim.

| Source / profile | Frames | Sequential status | Seek status | Verified sequential s | Verified seek s |
|---|---:|---|---|---:|---:|
| chameleon-flowers / phone | 16 | diagnostic-error-no-complete-result | verified | — | 49.722 |
| cat-plays / phone | 16 | verified | verified | 10.173 | 29.181 |
| fremantle-orbit / phone | 16 | verified | verified | 16.509 | 46.468 |
| chameleon-flowers / desktop | 30 | diagnostic-error-no-complete-result | verified | — | 89.258 |
| cat-plays / desktop | 24 | diagnostic-error-no-complete-result | verified | — | 38.847 |
| fremantle-orbit / desktop | 36 | diagnostic-error-no-complete-result | verified | — | 83.933 |

Successful verified sequential cases: 2/6. Successful faster exact cases: 2/6. Entire-three-source/both-profile gate: NOT MET. Extension gate: disabled.

Every one of 32 accepted sequential JPEGs matched the independent source decoder and repeated JPEG exactly, with recorded/source PTS within1microsecond. Total verified selected JPEGs across both methods: 170. Failed/aborted cases remain raw evidence and have no verified timing.

Proof times and every raw failure/control outcome are in summary.json/results.json. Proof is separate from extraction wall time. Neither a partial median nor a completed-corpus result is inferred.

Native control cancel-after-first-actual-trial: research-abort-no-complete-result; 0 complete photos; cleanup {"pausedBeforeClose":true,"readyStateBeforeClose":4,"srcRemoved":true}.

Rule check: none.

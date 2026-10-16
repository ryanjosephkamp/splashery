# Complete review corpus findings

This is a segmented comparison against frozen main cb8a8315. Retained observations and timings
precede the fitting merge; they are not fresh final-head measurements. Every result identifies its
actual measurement run. The complete raw observations, including superseded failures and baseline
replicates, remain in the evidence manifest.

There are 2000 codes per mode, 100 pictures, ten payloads, and two shapes. Both readers assess 24
conditions per code. Most detail has 0 independently failing codes, 0 failed runtime gates, 0
fallbacks, and 0 codes that lose a previously passing baseline read.

| Region                       | Shape  | Phone main SSIM | Phone detail SSIM |    Gain | Print main SSIM | Print detail SSIM |    Gain |
| ---------------------------- | ------ | --------------: | ----------------: | ------: | --------------: | ----------------: | ------: |
| Encoded square               | square |          0.2258 |            0.3350 | +0.1092 |          0.2193 |            0.3260 | +0.1066 |
| Encoded square               | circle |          0.1795 |            0.3744 | +0.1949 |          0.1145 |            0.3286 | +0.2141 |
| Complete sticker (secondary) | circle |          0.2680 |            0.5377 | +0.2697 |          0.2650 |            0.5338 | +0.2688 |

| Scale | Mean SSIM gain | Smallest picture/shape mean gain | Means gaining less than 0.01 | Nonimproving means | Individual codes without a gain |
| ----- | -------------: | -------------------------------: | ---------------------------: | -----------------: | ------------------------------: |
| phone |        +0.1520 |                          +0.0133 |                        0/200 |              0/200 |                        289/2000 |
| print |        +0.1604 |                          +0.0059 |                        1/200 |              0/200 |                        291/2000 |

The [200 picture/shape means and 24 reader conditions](tables.md) retain each before/after value.
The [per-code CSV](per-code.csv) retains every individual SSIM loss, RGB error, and reader count.
SSIM and RGB error describe different properties; neither substitutes for decoding.

| Shape  | Scale | Mean main RGB RMSE | Mean detail RGB RMSE | Codes with worse RGB RMSE |
| ------ | ----- | -----------------: | -------------------: | ------------------------: |
| square | phone |             0.3065 |               0.2142 |                   48/1000 |
| square | print |             0.3145 |               0.2220 |                   35/1000 |
| circle | phone |             0.1859 |               0.1805 |                  269/1000 |
| circle | print |             0.2319 |               0.2148 |                  134/1000 |

| Shape  | Mean main (s) | Mean detail (s) | P95 main (s) | P95 detail (s) | Slower codes | Main over 5 s | Detail over 5 s |
| ------ | ------------: | --------------: | -----------: | -------------: | -----------: | ------------: | --------------: |
| all    |         4.204 |           2.414 |        9.121 |          3.912 |     350/2000 |           503 |              27 |
| square |         5.491 |           2.056 |        9.302 |          2.907 |      29/1000 |           500 |              16 |
| circle |         2.918 |           2.772 |        3.590 |          4.034 |     321/1000 |             3 |              11 |

Of the 350 slower observations, 287 exceed 100 ms, 179 exceed 500 ms, and 67 exceed one second.
These are nested counts; every positive difference remains in the strict slower-case total.

The [timing CSV](timing.csv) contains all 2,000 paired keys, their source runs, and recorded
preparation and reader-matrix costs. Those costs overlap and describe the last accepted preparation;
its candidate counter is not a total retry count. Any positive appearance-time difference counts as
a slower observation; a single observation does not establish statistical significance. Cold starts
are included. CPU profiling is disabled during this final timing series.

## The Operator's four slower pilot cases

These were the four slower observations in the 36-code correction-first pilot. The final corpus
measurements below remain primary even when the result is slower. The diagnostic costs are
overlapping subsets of total appearance time, not an additive accounting of all work.

| Key                        | Pilot main → detail (s) | Final main → detail (s) | Final difference (s) |
| -------------------------- | ----------------------: | ----------------------: | -------------------: |
| ai-farm/0/square           |           2.478 → 2.492 |           1.971 → 2.638 |               +0.667 |
| cdx-qr-ai-rainbow/9/circle |           3.118 → 3.441 |           3.162 → 2.996 |               -0.166 |
| cdx-qr-ai-lotus/1/square   |           2.747 → 3.806 |           2.369 → 2.120 |               -0.249 |
| met-459968/8/circle        |           3.483 → 6.426 |           3.226 → 3.449 |               +0.223 |

**ai-farm/0/square:** This was the pilot's first detail selection, including lazy kernel and reader
loading. Its initial candidate passed: preparation took 667 ms and the final captured reader matrix
took 295 ms. The 13 ms total excess is retained; that single sample does not isolate the cold-load
contribution.

**cdx-qr-ai-rainbow/9/circle:** The version-13 Circle passed its first candidate. Preparation took
840 ms and the final two-reader matrix took 713 ms. Standard does not run that added matrix. Its
pilot excess was 323 ms; the later full-corpus observation is reported independently.

**cdx-qr-ai-lotus/1/square:** The initial edge-0.24 candidate was rejected on the actual capture.
The accepted edge-0.32 repair then ran the full predicted matrix (198 ms) and actual matrix (235
ms). Earlier opposite-orientation repair now avoids that actual rejection on the retained
full-corpus capture; its accepted rotation is 180 degrees.

**met-459968/8/circle:** The initial edge-0.24 candidate was rejected on the actual capture. The
accepted version-12 edge-0.32 repair used 1,167 ms of preparation, including a 717 ms predicted
matrix, and a further 687 ms actual matrix. This records two accepted-repair reader passes plus the
earlier failed capture; it does not infer retry counts from stale rejection lists.

In the final comparison, 2 of these four cases remain slower than Standard. These primary
observations are retained independently of the earlier pilot and include their recorded cold starts.

The final corpus observations have their own recorded costs below. Preparation includes any
predicted matrix it ran; these values overlap and must not be added as a complete accounting. A dash
means that diagnostic was not recorded. The candidate counter belongs to the last preparation, not
the complete retry history.

| Key                        | Final last preparation (ms) | Candidates in that preparation | Final accepted predicted matrix (ms) | Final captured matrix (ms) |
| -------------------------- | --------------------------: | -----------------------------: | -----------------------------------: | -------------------------: |
| ai-farm/0/square           |                       625.2 |                              1 |                                    — |                      266.7 |
| cdx-qr-ai-rainbow/9/circle |                       854.7 |                              1 |                                    — |                      661.1 |
| cdx-qr-ai-lotus/1/square   |                       679.4 |                              2 |                                    — |                      212.0 |
| met-459968/8/circle        |                      1596.4 |                              2 |                                    — |                      469.5 |

These observations explain measured costs; they do not prove that strict speed parity is impossible.
Reusing a failed capture, omitting the second reader or stronger-blur views, or revealing the code
before checks finish would reduce work but would violate the scan gate. Those changes were not made.
The remaining slower cases therefore keep goal item 4 open, and Standard remains the default.

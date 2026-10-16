# Round 4 measurement tables

Generated 2026-10-16T12:21:32.757Z. Missing cases are pending, never passes.

## Picture coverage and stability

Every original source frame, including native video and GIF timestamps. Main receives the disclosed
correct source picture in the geometry comparison. Height jitter and large edge flips are
depth-stability proxies, not an independent acuity measure.

### phone

| Input        | Frames  | Main jitter | R4 jitter | Main flips/1,000 | R4 flips/1,000 | R4 worst hole share | R4 max specks |
| ------------ | ------- | ----------- | --------- | ---------------- | -------------- | ------------------- | ------------- |
| sample       | 144/144 | 0.006880    | 0.003324  | 8.8010           | 3.2367         | 0.00000000          | 0             |
| horse        | 15/15   | 0.299101    | 0.092114  | 562.4897         | 188.5866       | 0.00000000          | 0             |
| dragon       | 96/96   | 0.112707    | 0.011707  | 217.8316         | 6.1107         | 0.00000000          | 0             |
| bridge       | 96/96   | 0.045394    | 0.014792  | 19.4499          | 3.1099         | 0.00000000          | 0             |
| machine      | 96/96   | 0.062827    | 0.012682  | 85.9072          | 16.3118        | 0.00000000          | 0             |
| sample-long  | 720/720 | 0.006010    | 0.002325  | 0.0000           | 0.3510         | 0.00000000          | 0             |
| dragon-long  | 720/720 | 0.005734    | 0.003411  | 0.0000           | 1.0841         | 0.00000000          | 0             |
| machine-long | 720/720 | 0.007952    | 0.009076  | 0.0000           | 2.2910         | 0.00000000          | 0             |
| bridge-long  | 648/648 | 0.006947    | 0.004647  | 0.0000           | 0.2398         | 0.00000000          | 0             |
| r4-blocks    | 48/48   | 0.054835    | 0.001361  | 135.8288         | 0.0099         | 0.00000000          | 0             |
| r4-gate      | 48/48   | 0.044179    | 0.001813  | 114.9622         | 0.0000         | 0.00000000          | 0             |
| r4-wheel     | 48/48   | 0.071590    | 0.001775  | 178.4997         | 0.0000         | 0.00000000          | 0             |
| r4-orbit     | 32/32   | 0.138918    | 0.002907  | 403.3210         | 0.0675         | 0.00000000          | 0             |
| r4-fast      | 120/120 | 0.026273    | 0.000890  | 82.4656          | 0.0165         | 0.00000000          | 0             |

### desktop

| Input        | Frames  | Main jitter | R4 jitter | Main flips/1,000 | R4 flips/1,000 | R4 worst hole share | R4 max specks |
| ------------ | ------- | ----------- | --------- | ---------------- | -------------- | ------------------- | ------------- |
| sample       | 144/144 | 0.006880    | 0.003324  | 8.8010           | 3.2367         | 0.00000000          | 0             |
| horse        | 15/15   | 0.299101    | 0.092114  | 562.4897         | 188.5866       | 0.00000000          | 0             |
| dragon       | 96/96   | 0.112707    | 0.011707  | 217.8316         | 6.1107         | 0.00000000          | 0             |
| bridge       | 96/96   | 0.045394    | 0.014792  | 19.4499          | 3.1099         | 0.00000000          | 0             |
| machine      | 96/96   | 0.062827    | 0.012682  | 85.9072          | 16.3118        | 0.00000000          | 0             |
| sample-long  | 720/720 | 0.008275    | 0.002317  | 2.2673           | 0.3509         | 0.00000000          | 0             |
| dragon-long  | 720/720 | 0.009280    | 0.003416  | 0.0000           | 1.0984         | 0.00000000          | 0             |
| machine-long | 720/720 | 0.012549    | 0.009056  | 0.1915           | 2.2934         | 0.00000000          | 0             |
| bridge-long  | 648/648 | 0.012958    | 0.004620  | 0.8845           | 0.2353         | 0.00000000          | 0             |
| r4-blocks    | 48/48   | 0.070842    | 0.003561  | 165.8017         | 0.0331         | 0.00000000          | 0             |
| r4-gate      | 48/48   | 0.057718    | 0.001322  | 149.8680         | 0.0082         | 0.00000000          | 0             |
| r4-wheel     | 48/48   | 0.081788    | 0.001850  | 252.6319         | 0.0024         | 0.00000000          | 0             |
| r4-orbit     | 32/32   | 0.206622    | 0.001970  | 571.8880         | 0.0827         | 0.00000000          | 0             |
| r4-fast      | 120/120 | 0.033341    | 0.000420  | 111.3391         | 0.0000         | 0.00000000          | 0             |

Main code hash: `ec1886c50d2cc9181df52cd7965ec63f5ed8f0dcfe8cca4475fa3a863c28fc03`. Round 4:
`2b23383b800065b10385c77c0da6245053c5bbd60a5ba35c105fba87f54347e4`. Complete: main true; round 4
true.

## Isolated phone cadence

Frameend median / worst in milliseconds, using the Operator's protocol. These are update intervals.
The next table separately reports actual postrender and changed bound-source-clock submissions. CPU
slowdown is 4; workers are not throttled. One browser, no competing workloads.

| Input        | Main         | Round 3       | Round 4      | R4 ≤50 / ≤250 ms |
| ------------ | ------------ | ------------- | ------------ | ---------------- |
| sample       | 70.5 / 326.7 | 172.3 / 249.4 | 54.3 / 201.2 | false            |
| horse        | 59.2 / 143.7 | 112.4 / 187.2 | 14.9 / 121.2 | true             |
| dragon       | 59.1 / 100.6 | 135.2 / 173.7 | 18.3 / 99.9  | true             |
| bridge       | 63.0 / 90.7  | 151.6 / 275.2 | 60.0 / 135.3 | false            |
| machine      | 63.6 / 109.3 | 171.8 / 219.4 | 32.2 / 112.8 | true             |
| sample-long  | 74.4 / 145.5 | 245.8 / 312.3 | 34.1 / 186.5 | true             |
| dragon-long  | 72.5 / 168.3 | 223.8 / 277.1 | 31.0 / 124.6 | true             |
| machine-long | 87.9 / 135.8 | 248.1 / 356.3 | 45.8 / 177.4 | true             |
| bridge-long  | 80.0 / 261.4 | 233.6 / 350.7 | 26.9 / 119.1 | true             |
| r4-blocks    | 53.2 / 92.3  | not measured  | 39.4 / 98.8  | true             |
| r4-gate      | 54.3 / 235.9 | not measured  | 38.0 / 71.1  | true             |
| r4-wheel     | 52.6 / 85.3  | not measured  | 39.4 / 80.7  | true             |
| r4-orbit     | 47.7 / 92.3  | not measured  | 14.8 / 80.6  | true             |
| r4-fast      | 56.4 / 93.1  | not measured  | 41.0 / 166.5 | true             |

Changed bound-source-clock counts are proxies, not pixel-uniqueness or decoder fps. A 10 fps input
cannot supply 20 distinct source pictures per second.

| Input        | Main draw ms | R4 draw ms    | Main source clocks/s | R4 source clocks/s | Main / R4 media drops     |
| ------------ | ------------ | ------------- | -------------------- | ------------------ | ------------------------- |
| sample       | 70.4 / 326.7 | 66.6 / 315.9  | 10.42                | 11.17              | 149 / 118                 |
| horse        | 59.1 / 143.7 | 100.1 / 154.6 | 9.92                 | 10.00              | unavailable / unavailable |
| dragon       | 59.4 / 100.6 | 65.6 / 127.6  | 14.83                | 15.58              | unavailable / unavailable |
| bridge       | 62.9 / 89.8  | 72.1 / 218.0  | 15.08                | 13.92              | unavailable / unavailable |
| machine      | 63.6 / 109.2 | 62.6 / 137.3  | 15.25                | 15.75              | unavailable / unavailable |
| sample-long  | 74.2 / 145.4 | 86.3 / 339.3  | 10.60                | 9.93               | 289 / 377                 |
| dragon-long  | 72.7 / 168.3 | 65.0 / 207.3  | 10.83                | 13.70              | 275 / 272                 |
| machine-long | 87.9 / 135.8 | 92.2 / 322.1  | 8.97                 | 9.77               | 351 / 376                 |
| bridge-long  | 80.0 / 261.4 | 87.8 / 313.4  | 9.87                 | 10.37              | 311 / 368                 |
| r4-blocks    | 53.2 / 92.3  | 39.7 / 98.8   | 15.00                | 23.67              | 0 / 45                    |
| r4-gate      | 54.3 / 235.9 | 38.4 / 82.7   | 13.75                | 25.42              | 0 / 34                    |
| r4-wheel     | 52.6 / 85.2  | 39.7 / 83.8   | 14.50                | 24.33              | 0 / 32                    |
| r4-orbit     | 47.6 / 92.3  | 74.1 / 129.7  | 11.92                | 12.00              | unavailable / unavailable |
| r4-fast      | 56.4 / 93.1  | 41.0 / 166.5  | 16.67                | 23.17              | 0 / 425                   |

## Repeated clean cadence

A full paired pass covers all fourteen inputs; Bunny and Horse receive one additional pass to check
the closest comparison with main. The first-pass table above keeps the Operator's original
per-window protocol; this table retains each pass's median and the worst observed interval across
passes. Missing repeats stay explicit. Source-clock rates are proxies, as described above.

| Input        | Main median ms, each pass | R4 median ms, each pass | Worst ms, main / R4 | Mean source clocks/s, main / R4 | Runs, main / R4 |
| ------------ | ------------------------- | ----------------------- | ------------------- | ------------------------------- | --------------- |
| sample       | 70.5, 73.4                | 54.3, 64.5              | 326.7 / 201.2       | 9.96 / 11.38                    | 2 / 2           |
| horse        | 59.2, 65.0                | 14.9, 15.0              | 218.9 / 121.2       | 9.92 / 10.00                    | 2 / 2           |
| dragon       | 59.1                      | 18.3                    | 100.6 / 99.9        | 14.83 / 15.58                   | 1 / 1           |
| bridge       | 63.0                      | 60.0                    | 90.7 / 135.3        | 15.08 / 13.92                   | 1 / 1           |
| machine      | 63.6                      | 32.2                    | 109.3 / 112.8       | 15.25 / 15.75                   | 1 / 1           |
| sample-long  | 74.4                      | 34.1                    | 145.5 / 186.5       | 10.60 / 9.93                    | 1 / 1           |
| dragon-long  | 72.5                      | 31.0                    | 168.3 / 124.6       | 10.83 / 13.70                   | 1 / 1           |
| machine-long | 87.9                      | 45.8                    | 135.8 / 177.4       | 8.97 / 9.77                     | 1 / 1           |
| bridge-long  | 80.0                      | 26.9                    | 261.4 / 119.1       | 9.87 / 10.37                    | 1 / 1           |
| r4-blocks    | 53.2                      | 39.4                    | 92.3 / 98.8         | 15.00 / 23.67                   | 1 / 1           |
| r4-gate      | 54.3                      | 38.0                    | 235.9 / 71.1        | 13.75 / 25.42                   | 1 / 1           |
| r4-wheel     | 52.6                      | 39.4                    | 85.3 / 80.7         | 14.50 / 24.33                   | 1 / 1           |
| r4-orbit     | 47.7                      | 14.8                    | 92.3 / 80.6         | 11.92 / 12.00                   | 1 / 1           |
| r4-fast      | 56.4                      | 41.0                    | 93.1 / 166.5        | 16.67 / 23.17                   | 1 / 1           |

## Isolated phone startup

Fresh context per repeat, selection to the first actual completed front-surface draw with usable
picture and estimated depth. A single WebGL finish fence follows submission; its additional
completion wait is separate from GPU elapsed profiling. Opening the default toy includes observer
module preparation in both versions; other clips start from the already open default toy. Background
refinement need not finish. Milliseconds; median [minimum–maximum], repeat count.

| Input        | Main                           | Round 4                     | R4 median ≤ main |
| ------------ | ------------------------------ | --------------------------- | ---------------- |
| sample       | 9725.9 [8228.7–10393.0], n=3   | 1059.5 [952.4–1128.4], n=3  | true             |
| horse        | 1126.8 [1067.3–1187.0], n=3    | 249.8 [225.0–316.6], n=3    | true             |
| dragon       | 5850.1 [5776.0–5998.5], n=3    | 341.8 [319.8–548.8], n=3    | true             |
| bridge       | 6327.2 [6098.6–6628.4], n=3    | 405.1 [350.1–413.9], n=3    | true             |
| machine      | 6952.3 [6943.2–7252.8], n=3    | 489.2 [401.2–530.8], n=3    | true             |
| sample-long  | 3838.9 [3811.5–3845.5], n=3    | 1043.9 [1017.7–1125.2], n=3 | true             |
| dragon-long  | 3971.0 [3896.8–4416.6], n=3    | 991.8 [953.0–1016.9], n=3   | true             |
| machine-long | 4056.9 [4042.7–4450.1], n=3    | 1216.7 [1023.1–1339.4], n=3 | true             |
| bridge-long  | 3787.7 [3729.1–3793.3], n=3    | 856.4 [724.5–891.3], n=3    | true             |
| r4-blocks    | 15149.3 [15097.0–15361.4], n=3 | 1649.0 [1548.0–1683.7], n=3 | true             |
| r4-gate      | 15316.6 [15254.1–15567.3], n=3 | 1704.7 [1650.6–1733.0], n=3 | true             |
| r4-wheel     | 15247.2 [15155.0–15445.4], n=3 | 1655.6 [1487.1–1909.6], n=3 | true             |
| r4-orbit     | 7306.3 [7186.4–7383.1], n=3    | 1883.0 [1736.1–2142.1], n=3 | true             |
| r4-fast      | 11339.8 [11330.6–11689.1], n=3 | 1725.5 [1670.6–1776.7], n=3 | true             |

## Instrumented pipeline costs

Inclusive mean milliseconds per frameend update. Rows overlap and must not be summed. Instrumented
runs are separate from the clean cadence table. Native media tracing includes the two-second warmup;
its function durations are overlapping wall time, not additive decoder CPU. GPU elapsed queries may
be unavailable.

### sample

| Inclusive page operation | Round 3 ms/update | Round 4 ms/update |
| ------------------------ | ----------------- | ----------------- |
| longFrame                | not observed      | not observed      |
| canvasDraw               | not observed      | not observed      |
| canvasRead               | not observed      | not observed      |
| freezeVideoFrame         | not observed      | not observed      |
| workerPost               | not observed      | 0.387             |
| videoFrameCallback       | 0.147             | 0.323             |
| clipCellDepth            | 150.406           | 1.281             |
| fillClip                 | 154.504           | 4.226             |
| texImage2D               | 3.028             | 2.134             |
| texSubImage2D            | 3.131             | 0.262             |
| generateMipmap           | 0.015             | 0.007             |
| bufferData               | 0.097             | 0.105             |
| bufferSubData            | 0.334             | 0.888             |
| sortVisible              | 0.063             | 0.065             |
| drawElements             | 0.001             | 0.044             |
| drawElementsInstanced    | 0.003             | 0.007             |

GPU timers: round 3 unavailable; round 4 unavailable.

| Native VP9 function wall time | Calls       | Total ms    | Worst ms    |
| ----------------------------- | ----------- | ----------- | ----------- |
| Round 3                       | unavailable | unavailable | unavailable |
| Round 4                       | unavailable | unavailable | unavailable |

### machine-long

| Inclusive page operation | Round 3 ms/update | Round 4 ms/update |
| ------------------------ | ----------------- | ----------------- |
| longFrame                | 146.822           | not observed      |
| canvasDraw               | 104.701           | not observed      |
| canvasRead               | 0.729             | not observed      |
| freezeVideoFrame         | not observed      | 0.141             |
| workerPost               | not observed      | 20.619            |
| videoFrameCallback       | 0.136             | 20.640            |
| clipCellDepth            | 92.483            | 0.929             |
| fillClip                 | 94.969            | 2.609             |
| texImage2D               | 3.774             | not observed      |
| texSubImage2D            | 2.013             | 0.771             |
| generateMipmap           | 0.052             | 0.005             |
| bufferData               | 0.110             | 0.091             |
| bufferSubData            | 0.286             | 2.913             |
| sortVisible              | 0.068             | 0.047             |
| drawElements             | 0.027             | 0.012             |
| drawElementsInstanced    | 0.004             | 0.005             |

GPU timers: round 3 unavailable; round 4 unavailable.

Parallel worker phases, mean ms/completed packet over the recent 120 frames; may include warmup. Do
not add to inclusive page costs.

| Worker phase     | Round 4 ms/packet |
| ---------------- | ----------------- |
| nativePicture    | 25.868            |
| interpolateDepth | 0.647             |
| guidePixels      | 1.552             |
| colorGuidance    | 9.426             |
| nativeBitmap     | 0.792             |
| geometry         | 21.932            |
| drawSelection    | 11.842            |
| rasterBounds     | 4.967             |

Accepted frozen-picture age, recent 120 packets: median 200.7 ms; worst 382.6 ms. This is
media-clock age at acceptance, not physical audio-to-display latency.

| Native VP9 function wall time | Calls | Total ms | Worst ms |
| ----------------------------- | ----- | -------- | -------- |
| Round 3                       | 1548  | 1618.771 | 7.813    |
| Round 4                       | 765   | 1388.329 | 34.385   |

## Test ledger

223/331 complete whole-file reports. Latest totals:
{"passed":2243,"failed":15,"skipped":1,"flaky":0,"expectedFailures":0}. Every earlier failure
remains in the ledger. Individual run revisions were not recorded by Playwright; the full suite
spans implementation and upstream merges, with affected files rerun.

Latest failed files: cdx-mir.spec.mjs, fx4-engine.spec.mjs, hh3-holidays.spec.mjs,
hh5-animals.spec.mjs, live-engine.spec.mjs, live2.spec.mjs, man4.spec.mjs, phf.spec.mjs,
qr4-craft.spec.mjs, qrl.spec.mjs, smoke.spec.mjs, tp2.spec.mjs.

Six unchanged Node test files outside the Playwright pattern: 16 passed, 0 failed, 0 skipped; see
original TAP and runtime ledger. These are separate from Playwright totals.

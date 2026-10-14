# Load-time audit — October 14, 2026

Codex (GPT-6) built the lossless changes and this audit on `codex/load-time`. This revision
addresses
[the Operator's newest review](https://github.com/ryanjosephkamp/splashery/pull/588#issuecomment-6163399711).

## Current opening results

Baseline main: `226644fb2b4e70dbd02136caec8e0f57c9f7f662`. Candidate:
`2b5eaae37a07961de240a4b426a90c6a91060787`. This is the only current timing table. Each group has
five fresh-browser before/after pairs, adjacent and alternating in order, collected with no other
rendering or heavy validation job running. Sunglasses uses five new pairs from one session; none of
the old five or extended 15 observations are mixed in.

The original top-20 phone set averages 187,499,319 → 172,087,022 bytes combined (8.2% saving); 2/20
individually reach 25%. 9/20 have a higher measured first-frame median.

The combined 25% local opening-body target is not met. The no-slower screen is not met across all 28
groups (12 higher medians). Public per-toy wire saving was not measured.

| Toy                 | Setting | Samples per phase |    Bytes before → after | Requests before → after | First-frame median before → after (ms) | Change | Before range (ms) | After range (ms) |
| ------------------- | ------- | ----------------: | ----------------------: | ----------------------: | -------------------------------------: | -----: | ----------------: | ---------------: |
| your-book           | phone   |                 5 | 15,072,943 → 12,816,407 |               106 → 106 |                        6596.9 → 5498.2 | -16.7% |     3406.7–8045.6 |   3707.9–17326.5 |
| video-3d            | phone   |                 5 |   6,647,111 → 6,200,356 |               121 → 112 |                        4777.9 → 5116.5 |   7.1% |     3862.8–6126.0 |   4339.6–10011.8 |
| splat-toolkit       | phone   |                 5 | 11,561,533 → 11,306,184 |               110 → 116 |                      14872.1 → 14198.6 |  -4.5% |    7704.9–45634.4 |  10315.3–33083.7 |
| living-city         | phone   |                 5 | 10,579,375 → 10,257,285 |                99 → 100 |                        5014.2 → 6230.0 |  24.2% |    3171.0–22859.8 |   3944.4–10947.8 |
| powers-of-ten       | phone   |                 5 |   7,061,334 → 5,945,562 |               103 → 104 |                        5043.8 → 3883.1 | -23.0% |    2612.6–19373.5 |    2838.9–7764.6 |
| point-clouds        | phone   |                 5 |   9,151,914 → 8,829,824 |               110 → 111 |                       12878.1 → 8690.5 | -32.5% |    4684.0–17205.5 |   5424.5–17280.4 |
| celestial-globe     | phone   |                 5 |   9,258,711 → 6,581,300 |                101 → 99 |                        4318.6 → 5096.7 |  18.0% |    2722.6–12500.3 |    2559.5–6816.7 |
| stannern-meteorites | phone   |                 5 |   9,169,749 → 7,041,036 |                96 → 104 |                        4321.1 → 4269.6 |  -1.2% |     3042.7–5694.9 |    2738.9–6490.1 |
| crochet-earth       | phone   |                 5 |   9,163,097 → 8,841,007 |                 96 → 97 |                        4130.2 → 4680.0 |  13.3% |     3380.5–6166.3 |    3486.0–7024.4 |
| seeded-loaf         | phone   |                 5 |   9,182,038 → 8,802,746 |                 94 → 92 |                        3567.9 → 4025.6 |  12.8% |     2818.7–5985.5 |    2439.7–7420.5 |
| dog-plush           | phone   |                 5 |   9,121,395 → 8,799,305 |                 96 → 97 |                        3878.4 → 3811.3 |  -1.7% |     3729.0–6119.0 |    3390.4–4723.8 |
| alum-crystal        | phone   |                 5 |   9,097,791 → 8,775,701 |                 96 → 97 |                        5178.0 → 4794.9 |  -7.4% |     3087.0–8942.0 |    3674.5–5304.0 |
| mushroom-photo      | phone   |                 5 |   9,137,127 → 8,815,037 |               100 → 101 |                        4090.6 → 3872.1 |  -5.3% |     3051.6–4996.5 |    2997.1–9205.2 |
| moving-photo-3d     | phone   |                 5 |   9,033,471 → 8,711,381 |               128 → 129 |                      13242.5 → 13616.2 |   2.8% |    9843.9–19243.6 |   9726.4–15723.8 |
| turtle-souvenir     | phone   |                 5 |   9,071,454 → 8,778,981 |                96 → 100 |                        3533.7 → 4170.9 |  18.0% |     2858.2–4573.5 |   2650.5–21116.9 |
| armillary-sphere    | phone   |                 5 |   9,059,075 → 6,697,741 |                 96 → 99 |                        4103.7 → 3902.2 |  -4.9% |     3271.8–5656.1 |    2450.7–4805.7 |
| murex-shell         | phone   |                 5 |   9,050,643 → 8,728,553 |                 96 → 97 |                        3794.7 → 3362.2 | -11.4% |     2929.9–8421.2 |    3105.4–6896.2 |
| maple-tree          | phone   |                 5 |   9,034,584 → 8,756,822 |                96 → 102 |                        3920.5 → 4080.7 |   4.1% |    3896.1–13216.1 |    3602.6–4895.7 |
| cave-lioness        | phone   |                 5 |   9,026,924 → 8,704,834 |                 96 → 97 |                        3924.4 → 4540.0 |  15.7% |     3079.7–5525.9 |    3230.1–6688.4 |
| toy-trex            | phone   |                 5 |   9,019,050 → 8,696,960 |                 96 → 97 |                        4470.4 → 4075.4 |  -8.8% |     3326.6–9118.9 |   2820.2–18167.0 |
| pyrite-cubes        | phone   |                 5 |   8,578,799 → 6,725,925 |                 96 → 99 |                        3928.7 → 3160.3 | -19.6% |     2768.5–4154.1 |    2708.4–6176.0 |
| soda-can            | phone   |                 5 |   8,882,577 → 5,673,043 |                 96 → 99 |                        3030.0 → 4172.2 |  37.7% |     2438.5–3611.9 |    2424.5–6916.9 |
| sunglasses          | phone   |                 5 |   8,902,661 → 5,795,159 |                 96 → 99 |                        2726.5 → 3593.6 |  31.8% |     2120.3–4163.9 |    1933.1–3908.0 |
| fountain-pen        | phone   |                 5 |   8,886,507 → 5,741,247 |                 96 → 99 |                        4457.7 → 2685.3 | -39.8% |     2391.8–5167.9 |    2428.6–3930.9 |
| pyrite-cubes        | desktop |                 5 |   9,347,411 → 9,118,767 |               175 → 178 |                        5378.0 → 5999.7 |  11.6% |     4000.8–6904.4 |    5058.6–9988.2 |
| soda-can            | desktop |                 5 |  10,218,207 → 9,989,563 |               239 → 242 |                        5527.8 → 4730.3 | -14.4% |     4607.9–8096.0 |    3802.3–6659.5 |
| sunglasses          | desktop |                 5 |   9,982,749 → 9,754,105 |               239 → 242 |                        4993.3 → 4497.5 |  -9.9% |     3387.5–7243.8 |    3338.5–6250.2 |
| fountain-pen        | desktop |                 5 |   9,992,027 → 9,763,383 |               239 → 242 |                        4616.3 → 4458.9 |  -3.4% |     3763.2–6712.6 |    4156.7–5678.8 |

All observations and device/profile metadata are in
[current-results.json](load-time-2026-10/current-results.json). Higher medians remain visible; a
smaller payload does not establish a faster opening.

## Causes and changes

The custom engine bootstrap added a full-body gzip decode, a Blob module, and an import-map gate
before native evaluation. Its first revision also serialized app dependency discovery behind engine
transfer. Restoring the original HTTP engine URL, module preload, and native app/embed entry removes
that extra path for every toy. A held-engine browser test verifies app and player requests start
before the engine response is released; the engine is requested once.

GitHub Pages already gzips the
[native engine](https://ryanjosephkamp.github.io/splashery/vendor/playcanvas/playcanvas.min.mjs): an
actual public GET transferred 640,711 bytes, versus 634,277 bytes for our custom gzip (6,434 bytes
difference). The decoded response exactly matches the vendored source. The earlier 26% combined
saving used an uncompressed localhost server and is superseded; it was not a comparable public-wire
saving. Native loading preserves the browser's ordinary module streaming, source URL, and cache
behavior.

The eight higher phone medians in round 2 were your-book, video-3d, splat-toolkit, powers-of-ten,
dog-plush, moving-photo-3d, maple-tree, and cave-lioness. All used this custom engine startup. The
final change retains the old native engine entry globally, including every named toy. This removes
the shared extra loading path; it does not prove that each earlier multi-second difference had that
single cause. No per-toy cause is inferred from a five-sample timing difference alone. The final
table keeps any remaining higher medians visible.

A separate native opening-pack module starts selected scan helper discovery alongside the app graph.
A held-ui response test first failed when this module could start only through the app; starting it
independently in HTML removes that serialization. App and embed await its shared promise before GPU
initialization. GIF export keeps its import map. No compressed-engine mapping or source-preload
promotion remains.

In the final phone observations, Sunglasses and Soda can still have higher first-frame medians
despite earlier median scan-response completion.
[startup-stages.json](load-time-2026-10/startup-stages.json) records the completed-response stages.
A response finishing before GPU setup leaves that setup in the later interval; these traces do not
time module evaluation or GPU work and do not establish the remaining cause. No further timing fix
is claimed.

The latest main also changed the default manual to a content-addressed filename. The previous
compressed loader matched only the legacy filename. The current and legacy documents now use exact
gzip copies, overlapping PDF.js transfer and retaining every page, filename, notice, and original
URL.

Museum helpers and scan transfers overlap. Selected scan helpers finish before GPU setup in app and
embed. App shared-scene openings also start scan preparation before WebGL initialization; embed scan
preparation retains its normal order after GPU setup. The native engine retains its module preload.
Five Real Objects prefixes and the globe, armillary, Stannern, and Pyrite prefixes retain exact
records, original population counts, and exact full-scan Float64 means where needed. Higher budgets
still use full scans. No rendered count, camera, texture, color precision, or engine version was
reduced.

| Lossless source                              | Original bytes | Gzip bytes | Saving |
| -------------------------------------------- | -------------: | ---------: | -----: |
| src/toy-help.js                              |        344,750 |    115,853 |  66.4% |
| manual/tinkerers-manual.pdf                  |      7,792,711 |  5,858,411 |  24.8% |
| manual/tinkerers-manual-85d32b96193ea275.pdf |      7,792,711 |  5,858,411 |  24.8% |

Exact hashes and unchanged-byte checks:
[compressed-opening.json](load-time-2026-10/compressed-opening.json). Scan hashes and inherited
license records: [museum-prefixes.json](load-time-2026-10/museum-prefixes.json). Armillary and
Stannern's live pages were opened on October 13, 2026. Pyrite's page returned 503 on October 14; its
[live model API](https://api.sketchfab.com/v3/models/0b7c6e8e32144b72806ed31cb49b4145) confirmed CC0
and Digital Atlas of Ancient Life. NC tags and in-app notices remain.

## Visual and regression evidence

50 existing GPU-finished comparisons remain in
[image-diffs.json](load-time-2026-10/image-diffs.json): 49 are pixel-identical; the desktop book
differs at eight pixels by at most one RGB level and is visually identical. All 23 recorded tap
poses moved. These captures use the previous frozen sources recorded in each row; restoring native
engine discovery does not change their scene buffers. The updated manual's decoded bytes are checked
separately.

All openings now use the original HTTP engine. This is not a demonstrated strawberry fix: prior
raw-path runs both passed and failed. An observer around the unchanged original protected test found
latest main and candidate still running the effect when its wall-time predicate expired. Candidate
had advanced 1.8667 of 2.2 simulation seconds, and main 1.9332 seconds; their pop controls remained
0.1515 and 0.1213. Both observed executions used the original HTTP engine. The unchanged update
clamps large frame deltas at 0.1 seconds; slow software frames can leave this simulation-time effect
unfinished at the wall-time deadline. See
[strawberry-timing.json](load-time-2026-10/strawberry-timing.json). The protected predicate,
production clocks, and animation remain unchanged; current full-suite outcomes are recorded below.

Current full-suite strawberry return-to-rest result: **passed** in the unchanged protected rig case
on `d52fa21f0120e532f1e1a14beae48ea97df90db7`. Earlier native-path runs both passed and failed. This
current outcome is reported separately from the preceding diagnostic failures; a pass does not
establish a causal fix.

The strawberry probe leaves production clocks, controls, and cameras running. It records control
decay, simulation time, wall time, and paired rest/pop/settled images. Its raw captures stay outside
Git. The current verification receipt states the original smoke results and main comparison; the
protected smoke test was not edited.

Current validation on d52fa21f0120e532f1e1a14beae48ea97df90db7 (runtime byte-identical to measured
2b5eaae37a07961de240a4b426a90c6a91060787): 183 passed, 1 failed, 0 skipped. Smoke (three sequential
shards), kit, Real Objects, catalog, manual, scan-prefix, and smoothing browser checks repeat after
the latest merge and global native-entry restoration. Taps, unit, and the pure Node load-time checks
also repeat on this source; the final 17-case startup/compression run precedes the
documentation-only merge and has byte-identical runtime and test files. The latest main 41b21e74 kit
run has 9 passes and 1 failure; no deadline overrun was recorded in that run. The earlier main 6c
kit run had 9 passes and one unchanged 600,000 ms catalog timeout; the protected QR recipe error
reproduces on both sources. The native entry removes the custom engine path globally; the current
original strawberry case passed, and no causal timing fix is claimed. Both latest main and the
candidate failed the observed original test before the effect completed; prior original-test passes
and failures remain source-pinned. Exact current failures are retained in the verification receipt.

Measured main `226644fb2b4e70dbd02136caec8e0f57c9f7f662` is merged into the candidate, including its
video-loading updates. Latest main `41b21e74e04ccca178b95ac02b4e5dc0e51b4b45` was then merged before
validation; its only additional change is docs/STATUS.md. The repeated validation uses
`d52fa21f0120e532f1e1a14beae48ea97df90db7`, with zero runtime/test/tool/asset differences from
measured candidate `2b5eaae37a07961de240a4b426a90c6a91060787`. Earlier comparisons retain their
actual source pins in the verification receipt.

Details, commands, source pins, initial failures, and comparison results are retained in
[verification.json](load-time-2026-10/verification.json).

Final check receipts: Prettier, American English, whitespace, and the audit-budget test all exit 0.
All 388 fully paginated protected paths have zero committed and working-tree intersections. Commands
and results are in verification.json; the strict final audit size remains below 3,000,000 bytes.

## Method and reproduction

Phone: 390×844, DPR 3, touch/mobile, weak/low. Desktop: 1440×900, DPR 1, high. WebGL2, sound and
adaptation off, seed 424242, preset camera, localhost, disabled HTTP cache, and blocked service
workers. Raw method files record Chromium, renderer, process priority, thread count, and display.
This Linux software-renderer session is not a physical-phone or task 06 Mac/Metal measurement. First
frame means submitted postrender readiness; captures separately finish the GPU.

Bytes and requests are means; timings are medians and full ranges. Opening bytes count completed
bodies after a real 1.5-second delay, excluding headers, blob/data URLs, and incomplete responses.
This local plain-server byte metric is not public transfer size. Actual public per-file headers and
byte comparisons are retained in
[production-transport.json](load-time-2026-10/production-transport.json). Pages already compresses
[help](https://ryanjosephkamp.github.io/splashery/src/toy-help.js) to 118,347 bytes, so its local
custom gzip is only 2,494 bytes smaller than the public encoded body; the
[current PDF](https://ryanjosephkamp.github.io/splashery/manual/tinkerers-manual-85d32b96193ea275.pdf)
is served uncompressed at 7,792,711 bytes, and its local 5,858,411-byte exact gzip is 1,934,300
bytes smaller. The candidate gzip files have not been deployed, so their public transfer size is not
measured. A public per-toy opening was not measured. The full catalog was not rescreened after the
latest main merge; this current screen covers the original top-20 phone set and four reviewed toys
at both settings. Frame cadence and a heap census were not repeated.

Serve archived baseline main on port 4174 and the frozen candidate on 4173.
`tools/load-time-paired.mjs --only=ID,ID --device=phone --samples=5 --out=DIR --frozen-main=COMMIT --candidate-source=COMMIT`
runs the adjacent alternating pairs. Raw runs default outside the repository.
`tools/load-time-report.mjs --timing=DIR --payload=DIR` validates complete groups and writes this
single current table. `tools/load-time-compress.mjs`, `tools/load-time-prefixes.mjs`, and
`tools/load-time-smoothing.mjs` regenerate the lossless files.

## Superseded results and remaining limits

All earlier catalog, paired, top-20, and mixed-session Sunglasses observations are **superseded**.
Their compact records are archived under [superseded/](load-time-2026-10/superseded/); they are not
current results and no historical numeric table is reproduced here. Earlier verification receipts
remain labeled by source and date.

Unused PLY-column removal remains deferred because PR #562's protected manifest pins the original
file and its loading path. Already compressed SOG captures keep their drawn points and precision.
Both combined and individual 25% targets are reported above. Restoring the native engine gives up
the misleading local-only gzip win; the target is not claimed met when measured savings fall short.
The audit stays below 3,000,000 bytes; raw request traces and bulk captures remain outside Git, and
no added -diff attributes remain.

Lossy point-budget options were not shipped. Their paired stills and diffs remain in
[lossy-options.json](load-time-2026-10/lossy-options.json) for the owner.

Rule check: the prior unpublished email metadata history rewrite conflicts with E1. Subsequent
review changes are additive.

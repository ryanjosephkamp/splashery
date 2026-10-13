# Load-time audit — October 13, 2026

Codex built the lossless changes and this audit on `codex/load-time`. This revision addresses
[the Operator's review](https://github.com/ryanjosephkamp/splashery/pull/588#issuecomment-6153708959).

## Changes and exactness

- Museum scans fetch alongside their deferred helpers. A browser test holds the helper response and
  verifies that the scan transfer has already started.
- The engine's complete, unchanged 2.22.3 source loads through a native import-map alias and
  `src/pc.js`. All 1,318 exports, including the live `app` binding, are checked in a browser.
  Unsupported decompression or import-map additions retain the original URL. Custom elements retain
  their original module path.
- Help and the manual use exact gzip copies. The full help text, PDF pages, and notices are
  retained. The manual transfers while PDF.js loads.
- Five Real objects recipes retain exact low/mid scan records and original population counts. The
  globe, armillary, and Stannern low-tier files also retain exact Float64 means computed over every
  original record. Larger budgets retain full scans. No rendered count, camera, texture, or color
  precision was reduced.

| Exact gzip source                    | Original bytes | Compressed bytes | Saving |
| ------------------------------------ | -------------: | ---------------: | -----: |
| vendor/playcanvas/playcanvas.min.mjs |      2,465,494 |          634,277 |  74.3% |
| src/toy-help.js                      |        344,736 |          115,832 |  66.4% |
| manual/tinkerers-manual.pdf          |      7,968,242 |        6,004,462 |  24.6% |

| Additional scan     | Original bytes | Opening bytes | License      |
| ------------------- | -------------: | ------------: | ------------ |
| armillary-sphere    |      4,009,378 |     1,887,314 | CC BY 4.0    |
| stannern-meteorites |      4,140,082 |     2,179,245 | CC BY-NC 4.0 |

Hashes and unchanged-byte checks are in
[compressed-opening.json](load-time-2026-10/compressed-opening.json). Museum hashes,
transformations, and inherited credits are in
[museum-prefixes.json](load-time-2026-10/museum-prefixes.json). The live pages were opened on
October 13, 2026; Stannern retains its NC tag and in-app notice.

## Reviewed timing increases

Final paired measurements are pending. Earlier five-run observations are retained in compact
summaries under `paired/`.

The initial Pyrite path serialized helper loading before scan fetching; this dependency is removed.
The earlier larger increases also contained delays before the helper request and after the scan
completed. Unchanged controls slowed after GPU/display/execution-service interruptions. Those
observations do not isolate a per-toy code cause. New immediate pairs and fresh browsers avoid
shared-browser code-cache and phase drift; final measured increases, if any, must remain explicit.

## The 20 heaviest phone openings

Final top-20 observations are pending. The initial revision saved 2.1% combined; it did not meet the
target.

The 1.33 MiB unused-normal PLY opportunity from [task 06](perf-2026-10.md) is deferred: PR #562's
protected manifest pins the original `liberty.ply` checksum. Its default loading path is also
protected. Changing that input would invalidate the manifest. Existing SOG captures already compress
the fields they draw; reducing their rendered points or texture precision would alter the look.
These limits are separate from lossless code/manual compression.

## Image evidence

The original 40 comparisons had zero changed RGBA pixels, with 19 moved tap poses. Full PNGs, diffs,
and request traces are outside Git; SHA-256 values and comparison results are retained in
[image-diffs.json](load-time-2026-10/image-diffs.json). Identical before/after PNG bytes share a
single retained representative file.

| Toy             | Setting   | Pose | Changed pixels | Representative                                                                    |
| --------------- | --------- | ---- | -------------: | --------------------------------------------------------------------------------- |
| cactus          | phone     | rest |              0 | [Identical still](load-time-2026-10/images/cactus-phone-before-rest.png)          |
| pyrite-cubes    | phone     | rest |              0 | [Identical still](load-time-2026-10/images/pyrite-cubes-phone-before-rest.png)    |
| pyrite-cubes    | phone     | tap  |              0 | Regenerate from script                                                            |
| water-bottle    | phone     | rest |              0 | [Identical still](load-time-2026-10/images/water-bottle-phone-before-rest.png)    |
| water-bottle    | phone     | tap  |              0 | Regenerate from script                                                            |
| sunglasses      | phone     | rest |              0 | [Identical still](load-time-2026-10/images/sunglasses-phone-before-rest.png)      |
| sunglasses      | phone     | tap  |              0 | Regenerate from script                                                            |
| baseball-cap    | phone     | rest |              0 | [Identical still](load-time-2026-10/images/baseball-cap-phone-before-rest.png)    |
| fountain-pen    | phone     | rest |              0 | [Identical still](load-time-2026-10/images/fountain-pen-phone-before-rest.png)    |
| fountain-pen    | phone     | tap  |              0 | Regenerate from script                                                            |
| soda-can        | phone     | rest |              0 | [Identical still](load-time-2026-10/images/soda-can-phone-before-rest.png)        |
| soda-can        | phone     | tap  |              0 | Regenerate from script                                                            |
| cactus          | desktop   | rest |              0 | Regenerate from script                                                            |
| baseball-cap    | phone     | tap  |              0 | Regenerate from script                                                            |
| pyrite-cubes    | desktop   | rest |              0 | Regenerate from script                                                            |
| pyrite-cubes    | desktop   | tap  |              0 | Regenerate from script                                                            |
| water-bottle    | desktop   | rest |              0 | Regenerate from script                                                            |
| water-bottle    | desktop   | tap  |              0 | Regenerate from script                                                            |
| sunglasses      | desktop   | rest |              0 | Regenerate from script                                                            |
| sunglasses      | desktop   | tap  |              0 | Regenerate from script                                                            |
| baseball-cap    | desktop   | rest |              0 | Regenerate from script                                                            |
| baseball-cap    | desktop   | tap  |              0 | Regenerate from script                                                            |
| fountain-pen    | desktop   | rest |              0 | Regenerate from script                                                            |
| fountain-pen    | desktop   | tap  |              0 | Regenerate from script                                                            |
| soda-can        | desktop   | rest |              0 | Regenerate from script                                                            |
| soda-can        | desktop   | tap  |              0 | Regenerate from script                                                            |
| water-bottle    | phone-mid | rest |              0 | Regenerate from script                                                            |
| water-bottle    | phone-mid | tap  |              0 | Regenerate from script                                                            |
| sunglasses      | phone-mid | rest |              0 | Regenerate from script                                                            |
| sunglasses      | phone-mid | tap  |              0 | Regenerate from script                                                            |
| baseball-cap    | phone-mid | rest |              0 | Regenerate from script                                                            |
| baseball-cap    | phone-mid | tap  |              0 | Regenerate from script                                                            |
| fountain-pen    | phone-mid | rest |              0 | Regenerate from script                                                            |
| fountain-pen    | phone-mid | tap  |              0 | Regenerate from script                                                            |
| soda-can        | phone-mid | rest |              0 | Regenerate from script                                                            |
| soda-can        | phone-mid | tap  |              0 | Regenerate from script                                                            |
| celestial-globe | phone     | rest |              0 | [Identical still](load-time-2026-10/images/celestial-globe-phone-before-rest.png) |
| celestial-globe | phone     | tap  |              0 | Regenerate from script                                                            |
| celestial-globe | desktop   | rest |              0 | Regenerate from script                                                            |
| celestial-globe | desktop   | tap  |              0 | Regenerate from script                                                            |

Captures use seed 424242, preset cameras, frozen production clocks, the actual one-second tap decay,
explicit center resets/resorting, at least 12 frame-end events, and a settling delay. The revised
capture waits for WebGL completion with `gl.finish()` before saving. This is separate from opening
timing: the task-06 first-frame metric remains a ready submitted `postrender`, not a GPU-completion
timing.

## Lossy options — not shipped

These remain owner decision examples. A 45,000 recipe budget replaces 90,000 in the capture tool
only; the current asset transfer is unchanged. Smaller data files would be needed for wire savings.

| Toy          | Before                                                               | After                                                                            | Changed pixels |
| ------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------: |
| fountain-pen | [90,000](load-time-2026-10/images/fountain-pen-phone-after-rest.png) | [45,000](load-time-2026-10/images/fountain-pen-phone-lossy-half-budget-rest.png) |         29,272 |
| sunglasses   | [90,000](load-time-2026-10/images/sunglasses-phone-after-rest.png)   | [45,000](load-time-2026-10/images/sunglasses-phone-lossy-half-budget-rest.png)   |         27,216 |

## Method, limits, and reproduction

Phone: 390×844, DPR 3, touch/mobile, weak/low. Desktop: 1440×900, DPR 1, high. WebGL2, adaptation
and sound off, seed 424242, preset camera, unthrottled localhost, disabled HTTP cache, and blocked
service workers. Linux Chromium 151/Mesa llvmpipe differs from task 06's Mac/Metal and is not a
physical-phone measurement. Only one rendering page runs at a time; no unrelated CPU-heavy work
should run during the final timing collection.

Opening bytes count completed HTTP bodies at a snapshot after a real 1.5-second delay. They exclude
headers, blob/data URLs, and incomplete bodies. Worker timing is approximate. The local server does
not apply HTTP compression; live Pages wire totals can differ. Idle/tap cadence and a heap census
were not repeated.

Serve archived baseline main on port 4174 and the frozen candidate on 4173.
`tools/load-time-audit.mjs` and `tools/load-time-paired.mjs` accept `--only=ID,ID`,
`--device=phone`, `--samples=5`, `--out=DIR`, `--frozen-main=COMMIT`, and
`--candidate-source=COMMIT`. Their defaults save raw runs beside the repository, not under
`docs/audits/`. Run with
`DISPLAY=:91 LP_NUM_THREADS=2 SPLASHERY_GL=llvmpipe SPLASHERY_CHROMIUM=/usr/bin/chromium nice -n 10`.
The paired script creates a fresh browser per opening and alternates each adjacent pair.

`tools/load-time-visuals.mjs --out=DIR` writes full captures outside Git.
`tools/load-time-prefixes.mjs`, `tools/load-time-smoothing.mjs`, and `tools/load-time-compress.mjs`
regenerate production files. `tools/load-time-report.mjs --timing=DIR --payload=DIR` publishes
compact summaries and tables. No raw request JSON or bulk captures belong in this task's audit tree.

## Verification and scope

[verification.json](load-time-2026-10/verification.json) preserves the original 160-test run,
separate recovery checks, image hashes, and method limits. The initial broad run's strawberry image
threshold failure is retained; isolated baseline/candidate runs and the later 160-test run passed.
Final review validation is recorded separately when complete.

Protected paths are PRs #560, #562, #566, #581, and #582. Their union was refreshed before the
review changes. No renderer version, production budget, original scan, protected PLY, or protected
code file is changed. The exact compressed helper derives from the protected original without
editing it.

<details>
<summary>Initial complete catalog matrix (historical)</summary>

This screen compares frozen main `49c809b4` with the initial measured runtime `2c229dbd`
(tree-identical published `b9c081a6`). It is not the revised runtime. The 924 observations per phase
remain in compact [before](load-time-2026-10/before-summary.json) and
[after](load-time-2026-10/after-summary.json) summaries; their raw request records are regenerated
by the collector, not committed.

| Toy                   | Setting |    Bytes before → after |  Requests | Submitted first frame ms |
| --------------------- | ------- | ----------------------: | --------: | -----------------------: |
| cactus                | phone   |   6,451,875 → 6,430,596 |   72 → 78 |          1927.8 → 2887.2 |
| strawberry            | phone   |   6,433,531 → 6,335,206 |   72 → 70 |          1753.5 → 4206.4 |
| cookie                | phone   |   6,454,193 → 6,355,868 |   72 → 70 |          1637.8 → 2447.1 |
| bee                   | phone   |   6,451,162 → 6,352,837 |   72 → 70 |          1648.3 → 6685.3 |
| torus                 | phone   |   4,969,001 → 4,870,676 |   95 → 93 |          1819.1 → 2785.7 |
| blob                  | phone   |   4,955,732 → 4,857,407 |   94 → 92 |          8469.1 → 2737.9 |
| knot                  | phone   |   4,957,166 → 4,858,841 |   94 → 92 |          2121.6 → 2609.4 |
| cluster-fly           | phone   |   6,144,772 → 6,046,447 |   72 → 70 |          1703.4 → 2687.9 |
| may-beetle            | phone   |   6,221,600 → 6,123,275 |   77 → 75 |          2474.6 → 4057.3 |
| millipede             | phone   |   6,256,687 → 6,158,362 |   78 → 76 |          2888.9 → 3353.9 |
| bumblebee             | phone   |   6,250,435 → 6,152,110 |   79 → 77 |          2116.9 → 2050.8 |
| raspberry             | phone   |   6,214,487 → 6,116,162 |   80 → 78 |          2028.3 → 1769.0 |
| blackberry            | phone   |   6,236,424 → 6,138,099 |   81 → 79 |          1690.5 → 2041.0 |
| blueberry             | phone   |   6,160,027 → 6,061,702 |   82 → 80 |          1619.8 → 2392.5 |
| grape                 | phone   |   6,214,411 → 6,116,086 |   83 → 81 |          1704.7 → 2199.2 |
| star-cookie           | phone   |   6,282,246 → 6,183,921 |   84 → 82 |          1710.6 → 3052.7 |
| tomatoes              | phone   |   6,284,763 → 6,186,438 |   85 → 83 |          1951.0 → 3882.7 |
| mandeltorus           | phone   |   6,317,856 → 6,219,531 |   86 → 84 |          1683.2 → 6422.9 |
| basket                | phone   |   6,290,587 → 6,192,262 |   87 → 85 |          2713.4 → 5908.5 |
| heart-donut           | phone   |   7,155,287 → 7,056,962 |   88 → 86 |          1835.1 → 4997.2 |
| sushi-boat            | phone   |   7,279,749 → 7,234,553 |   88 → 87 |          1901.7 → 3645.4 |
| seeded-loaf           | phone   |   9,105,749 → 9,007,424 |   90 → 88 |          1800.0 → 5475.1 |
| steak                 | phone   |   6,646,343 → 6,548,018 |   91 → 89 |          3100.6 → 3076.9 |
| stollen               | phone   |   8,820,442 → 8,722,117 |   92 → 90 |          2168.9 → 3012.1 |
| orange-photo          | phone   |   6,144,781 → 6,046,456 |   93 → 91 |          1939.2 → 5709.8 |
| physalis              | phone   |   8,891,705 → 8,793,380 |   94 → 92 |          1583.3 → 2902.3 |
| crystal-gem           | phone   |   6,049,531 → 5,951,206 |   95 → 93 |          1907.1 → 1937.7 |
| alum-crystal          | phone   |   9,078,704 → 8,980,379 |   95 → 93 |          2077.8 → 3041.6 |
| puffin                | phone   |   7,932,190 → 7,833,865 |   95 → 93 |          2350.3 → 2694.9 |
| toy-trex              | phone   |   8,999,963 → 8,901,638 |   95 → 93 |          2191.1 → 5304.9 |
| monkey-doll           | phone   |   8,969,773 → 8,871,448 |   95 → 93 |          1702.3 → 5575.6 |
| elephant-souvenir     | phone   |   5,596,036 → 5,497,711 |   95 → 93 |          1457.6 → 3373.9 |
| turtle-souvenir       | phone   |   9,052,367 → 8,954,042 |   95 → 93 |          2114.8 → 2493.3 |
| cave-lioness          | phone   |   9,007,837 → 8,909,512 |   95 → 93 |          1977.1 → 4374.5 |
| dog-plush             | phone   |   9,102,308 → 9,003,983 |   95 → 93 |          2135.1 → 4476.7 |
| bmx-bike              | phone   |   8,897,950 → 8,799,625 |   95 → 93 |          1808.2 → 3017.0 |
| murex-shell           | phone   |   9,031,556 → 8,933,231 |   95 → 93 |          1385.3 → 2700.9 |
| sunflower-photo       | phone   |   8,949,736 → 8,904,540 |   94 → 93 |          1847.3 → 2642.9 |
| white-roses           | phone   |   5,362,484 → 5,264,159 |   95 → 93 |          7619.4 → 1953.4 |
| bonsai-photo          | phone   |   8,259,750 → 8,161,425 |   95 → 93 |          3281.5 → 6692.3 |
| mushroom-photo        | phone   |   9,077,537 → 8,979,212 |   95 → 93 |          3373.3 → 5487.3 |
| cactus-real           | phone   |   8,441,678 → 8,343,353 |   95 → 93 |          2094.1 → 3505.2 |
| crochet-earth         | phone   |   9,144,010 → 9,045,685 |   95 → 93 |          2093.0 → 4728.4 |
| desk-globe            | phone   |   8,967,086 → 8,868,761 |   95 → 93 |          2050.6 → 2541.4 |
| cherry-blossom-photo  | phone   |   8,920,766 → 8,822,441 |   95 → 93 |          1655.4 → 3082.3 |
| maple-tree            | phone   |   9,015,497 → 8,917,172 |   95 → 93 |          2240.4 → 5122.1 |
| peony                 | phone   |   8,997,466 → 8,899,141 |   95 → 93 |          1772.6 → 3726.9 |
| money-tree            | phone   |   7,176,763 → 7,078,438 |   95 → 93 |          1774.4 → 3084.8 |
| knight-horse          | phone   |   8,152,846 → 8,054,521 |   95 → 93 |          1669.1 → 3323.7 |
| triceratops-skull     | phone   |   8,836,751 → 8,791,555 |   94 → 93 |          1715.8 → 2270.3 |
| cone-shell            | phone   |   8,851,009 → 8,752,684 |   95 → 93 |          1773.9 → 2271.2 |
| celestial-globe       | phone   |   9,184,544 → 6,785,978 |   95 → 95 |          1652.7 → 2767.4 |
| armillary-sphere      | phone   |   9,039,988 → 9,035,109 |   95 → 95 |          1678.1 → 3042.3 |
| stannern-meteorites   | phone   |   9,150,662 → 9,145,783 |   95 → 95 |         1551.0 → 11517.5 |
| fluorite-crystal      | phone   |   8,589,762 → 8,584,883 |   95 → 95 |         10542.2 → 4268.8 |
| ammonite-agate        | phone   |   8,570,884 → 8,566,005 |   95 → 95 |          8201.5 → 3318.4 |
| morasko-meteorite     | phone   |   8,289,424 → 8,284,545 |   95 → 95 |          4922.5 → 3227.1 |
| pyrite-cubes          | phone   |   8,559,712 → 8,554,833 |   95 → 95 |          2335.8 → 3401.4 |
| megalodon-tooth       | phone   |   8,552,420 → 8,547,541 |   95 → 95 |          2094.2 → 2270.7 |
| rubber-duck-real      | phone   |   5,814,459 → 5,716,134 |   88 → 86 |          2772.1 → 2846.1 |
| garden-gnome          | phone   |   5,879,754 → 5,781,429 |   89 → 87 |          2270.0 → 2224.3 |
| wooden-elephant       | phone   |   5,887,261 → 5,788,936 |   90 → 88 |          2213.2 → 2823.8 |
| marble-bust           | phone   |   5,917,917 → 5,819,592 |   91 → 89 |          1487.1 → 2247.6 |
| ukulele               | phone   |   5,832,827 → 5,734,502 |   92 → 90 |          1711.3 → 2063.6 |
| alarm-clock           | phone   |   5,854,874 → 5,756,549 |   93 → 91 |          1598.5 → 2353.8 |
| vintage-camera        | phone   |   5,875,744 → 5,777,419 |   94 → 92 |          1595.0 → 5057.5 |
| boombox               | phone   |   5,750,357 → 5,652,032 |   95 → 93 |          1426.1 → 3574.5 |
| croissant-real        | phone   |   5,920,056 → 5,821,731 |   95 → 93 |          1890.7 → 2743.8 |
| carrot-cake           | phone   |   5,907,871 → 5,809,546 |   95 → 93 |          2091.5 → 3112.0 |
| pomegranate           | phone   |   5,925,900 → 5,827,575 |   95 → 93 |          2536.7 → 2845.5 |
| lantern               | phone   |   5,920,350 → 5,822,025 |   95 → 93 |          1719.7 → 2937.4 |
| cat-statue            | phone   |   5,917,149 → 5,818,824 |   95 → 93 |          1743.6 → 2509.0 |
| horse-statue          | phone   |   5,842,047 → 5,743,722 |   95 → 93 |          1848.7 → 2351.4 |
| pencil-real           | phone   |   5,890,744 → 5,792,419 |   95 → 93 |          1858.0 → 2053.4 |
| tin-can-real          | phone   |   6,877,449 → 6,779,124 |   95 → 93 |          1700.5 → 3045.5 |
| basketball            | phone   |   5,064,618 → 4,966,293 |   95 → 93 |          1654.8 → 3219.6 |
| soccer-ball           | phone   |   5,060,120 → 4,961,795 |   95 → 93 |          1800.4 → 2581.8 |
| american-football     | phone   |   5,058,288 → 4,959,963 |   95 → 93 |          1923.4 → 3807.9 |
| tennis-ball           | phone   |   5,055,912 → 4,957,587 |   95 → 93 |          2158.0 → 2500.2 |
| baseball              | phone   |   5,057,826 → 4,959,501 |   95 → 93 |          2194.2 → 3610.4 |
| softball              | phone   |   5,057,138 → 4,958,813 |   95 → 93 |          2107.0 → 4998.2 |
| beach-ball            | phone   |   5,052,896 → 4,954,571 |   95 → 93 |          1762.1 → 2878.6 |
| golf-ball             | phone   |   5,059,898 → 4,961,573 |   95 → 93 |          2011.1 → 2325.3 |
| rugby-ball            | phone   |   5,065,580 → 4,967,255 |   95 → 93 |          1806.2 → 2752.0 |
| volleyball            | phone   |   5,061,102 → 4,962,777 |   95 → 93 |          1794.8 → 2320.0 |
| water-polo-ball       | phone   |   5,057,492 → 4,959,167 |   95 → 93 |          2349.7 → 2673.5 |
| ping-pong-ball        | phone   |   5,055,114 → 4,956,789 |   95 → 93 |          1750.2 → 2404.0 |
| cricket-ball          | phone   |   5,065,010 → 4,966,685 |   95 → 93 |          2068.6 → 2594.0 |
| bowling-ball          | phone   |   5,072,766 → 4,974,441 |   95 → 93 |          1746.1 → 3317.8 |
| pool-ball             | phone   |   5,075,974 → 4,977,649 |   95 → 93 |          1933.2 → 4841.0 |
| pickleball            | phone   |   5,080,654 → 4,982,329 |   95 → 93 |          1705.8 → 8982.2 |
| dodgeball             | phone   |   5,089,390 → 4,991,065 |   95 → 93 |          1485.8 → 2796.8 |
| medicine-ball         | phone   |   5,092,088 → 4,993,763 |   95 → 93 |          1715.5 → 3647.1 |
| lacrosse-ball         | phone   |   5,098,414 → 5,000,089 |   95 → 93 |          1484.0 → 2361.4 |
| squash-ball           | phone   |   5,099,952 → 5,001,627 |   95 → 93 |          1560.8 → 2319.6 |
| bouncy-ball           | phone   |   5,104,046 → 5,005,721 |   95 → 93 |          1924.1 → 2309.3 |
| marble                | phone   |   5,114,984 → 5,016,659 |   95 → 93 |          1702.9 → 3881.2 |
| hockey-puck           | phone   |   5,119,214 → 5,020,889 |   95 → 93 |          1995.0 → 2306.1 |
| shuttlecock           | phone   |   5,123,018 → 5,024,693 |   95 → 93 |          1959.2 → 2224.9 |
| flying-disc           | phone   |   5,132,062 → 5,033,737 |   95 → 93 |          1900.4 → 2500.7 |
| heart                 | phone   |   5,062,412 → 4,964,087 |   95 → 93 |          1856.2 → 2485.9 |
| campfire              | phone   |   5,206,665 → 5,108,340 |   95 → 93 |          2389.5 → 2970.1 |
| chest                 | phone   |   5,102,232 → 5,003,907 |   95 → 93 |          4339.4 → 2624.7 |
| sun                   | phone   |   5,264,868 → 5,166,543 |   96 → 94 |          2486.2 → 2040.9 |
| solar-system          | phone   |   5,271,404 → 5,173,079 |   96 → 94 |          2076.6 → 1994.4 |
| mercury               | phone   |   5,281,910 → 5,183,585 |   96 → 94 |          2009.5 → 2673.9 |
| venus                 | phone   |   5,289,082 → 5,190,757 |   96 → 94 |          2264.6 → 2443.4 |
| earth                 | phone   |   5,289,282 → 5,190,957 |   96 → 94 |          1845.8 → 2641.8 |
| moon                  | phone   |   5,288,005 → 5,189,680 |   97 → 95 |          2002.3 → 3150.9 |
| mars                  | phone   |   5,299,516 → 5,201,191 |   96 → 94 |          3056.2 → 2516.2 |
| jupiter               | phone   |   5,312,192 → 5,213,867 |   96 → 94 |          1634.4 → 2734.6 |
| saturn                | phone   |   5,325,666 → 5,227,341 |   96 → 94 |          1411.2 → 2516.1 |
| uranus                | phone   |   5,344,682 → 5,246,357 |   96 → 94 |          1522.3 → 2397.2 |
| neptune               | phone   |   5,354,748 → 5,256,423 |   96 → 94 |          1707.7 → 2678.6 |
| planet                | phone   |   5,112,438 → 5,014,113 |   94 → 92 |          1565.7 → 4872.0 |
| aurora-planet         | phone   |   5,347,668 → 5,249,343 |   96 → 94 |          1575.8 → 7683.5 |
| asteroid              | phone   |   5,343,826 → 5,245,501 |   96 → 94 |          2170.3 → 3172.1 |
| comet                 | phone   |   5,335,254 → 5,236,929 |   96 → 94 |          1540.4 → 2732.3 |
| meteor                | phone   |   5,334,062 → 5,235,737 |   96 → 94 |          1454.2 → 2470.2 |
| star                  | phone   |   5,330,842 → 5,232,517 |   96 → 94 |          4205.6 → 4150.4 |
| pulsar                | phone   |   5,336,308 → 5,237,983 |   96 → 94 |          3885.2 → 2951.3 |
| black-hole            | phone   |   5,332,080 → 5,233,755 |   96 → 94 |          2485.1 → 2594.1 |
| star-cluster          | phone   |   5,329,382 → 5,231,057 |   96 → 94 |          2992.3 → 2039.7 |
| planetary-nebula      | phone   |   5,273,395 → 5,175,070 |   95 → 93 |          1695.7 → 2231.9 |
| nebula                | phone   |   5,323,648 → 5,225,323 |   96 → 94 |          1872.2 → 2901.1 |
| supernova             | phone   |   5,315,050 → 5,216,725 |   96 → 94 |          1458.7 → 2971.3 |
| spiral-galaxy         | phone   |   5,318,262 → 5,219,937 |   96 → 94 |          1526.1 → 1949.9 |
| real-moon             | phone   |   6,443,154 → 6,344,829 | 106 → 104 |          1735.6 → 2895.6 |
| real-mars             | phone   |   6,244,271 → 6,145,946 | 106 → 104 |          2074.0 → 2905.2 |
| real-earth            | phone   |   8,041,211 → 7,942,886 | 108 → 106 |          2350.4 → 4007.9 |
| real-mercury          | phone   |   6,518,273 → 6,419,948 | 106 → 104 |         2021.0 → 14347.1 |
| real-venus            | phone   |   6,525,083 → 6,426,758 | 106 → 104 |          1871.6 → 6593.6 |
| real-moons            | phone   |   5,699,634 → 5,601,309 | 105 → 103 |          1559.4 → 4249.9 |
| real-small-worlds     | phone   |   5,936,490 → 5,838,165 | 106 → 104 |          1827.2 → 4539.7 |
| nearby-stars          | phone   |   5,524,316 → 5,425,991 | 104 → 102 |          1350.9 → 4299.7 |
| star-systems          | phone   |   5,434,867 → 5,336,542 | 104 → 102 |          2887.5 → 1916.1 |
| real-galaxies         | phone   |   5,547,507 → 5,449,182 | 104 → 102 |          7919.1 → 3331.5 |
| powers-of-ten         | phone   |   9,372,146 → 9,273,821 | 102 → 100 |          4111.3 → 2668.1 |
| saturn-v              | phone   |   6,322,687 → 6,224,362 | 104 → 102 |          3874.0 → 4196.0 |
| sls                   | phone   |   7,647,543 → 7,549,218 | 104 → 102 |          3763.0 → 4628.2 |
| space-shuttle         | phone   |   6,699,579 → 6,601,254 | 104 → 102 |          3405.0 → 4096.7 |
| solar-orbits          | phone   |   5,500,292 → 5,401,967 | 110 → 108 |          2431.2 → 3334.1 |
| virus                 | phone   |   5,211,285 → 5,112,960 |   95 → 93 |          2134.0 → 2696.7 |
| bacteriophage         | phone   |   5,198,347 → 5,100,022 |   95 → 93 |          2540.2 → 2735.2 |
| bacterium             | phone   |   5,192,901 → 5,094,576 |   95 → 93 |          1769.6 → 2992.7 |
| red-blood-cell        | phone   |   5,197,259 → 5,098,934 |   95 → 93 |          1645.4 → 2809.9 |
| neuron                | phone   |   5,198,351 → 5,100,026 |   95 → 93 |          1736.0 → 2782.0 |
| astrocyte             | phone   |   5,188,071 → 5,089,746 |   95 → 93 |          2239.2 → 3512.3 |
| animal-cell           | phone   |   5,180,549 → 5,082,224 |   95 → 93 |          1716.3 → 4693.1 |
| dna                   | phone   |   5,167,647 → 5,069,322 |   95 → 93 |          1433.7 → 5174.3 |
| white-blood-cell      | phone   |   5,151,803 → 5,053,478 |   95 → 93 |          1912.7 → 4113.1 |
| microglia             | phone   |   5,145,599 → 5,047,274 |   95 → 93 |          1775.9 → 3873.7 |
| diatom                | phone   |   5,152,055 → 5,053,730 |   95 → 93 |          4559.0 → 3576.4 |
| tardigrade            | phone   |   5,150,755 → 5,052,430 |   95 → 93 |          5101.5 → 3022.7 |
| pollen                | phone   |   5,149,943 → 5,051,618 |   95 → 93 |          1696.3 → 3077.7 |
| snowflake             | phone   |   5,149,929 → 5,051,604 |   95 → 93 |          1914.9 → 2455.7 |
| chromosome            | phone   |   5,150,791 → 5,052,466 |   95 → 93 |          2210.1 → 2677.0 |
| mitochondrion         | phone   |   5,147,505 → 5,049,180 |   95 → 93 |          1856.6 → 8907.1 |
| paramecium            | phone   |   5,139,205 → 5,040,880 |   95 → 93 |          1900.5 → 6938.8 |
| amoeba                | phone   |   5,139,203 → 5,040,878 |   95 → 93 |         2143.3 → 11228.1 |
| dna-to-protein        | phone   |   5,218,950 → 5,120,625 |   99 → 97 |         2570.6 → 11793.8 |
| mitosis               | phone   |   5,216,786 → 5,118,461 |   99 → 97 |          2017.6 → 8697.7 |
| apoptosis             | phone   |   5,212,754 → 5,114,429 |   99 → 97 |          2291.1 → 5823.6 |
| phagocytosis          | phone   |   5,213,296 → 5,114,971 |   99 → 97 |          2343.8 → 3608.1 |
| orbital               | phone   |   5,279,436 → 5,181,111 | 105 → 103 |          2109.5 → 2738.3 |
| atom                  | phone   |   5,277,828 → 5,179,503 | 105 → 103 |          1754.3 → 2385.1 |
| molecule              | phone   |   5,275,792 → 5,177,467 | 105 → 103 |          1721.4 → 2622.8 |
| protein               | phone   |   5,354,492 → 5,256,167 | 106 → 104 |          1756.7 → 2861.0 |
| crystal-lattice       | phone   |   5,271,858 → 5,173,533 | 105 → 103 |          1631.9 → 2200.7 |
| unit-cells            | phone   |   5,131,287 → 5,032,962 |   97 → 95 |          2134.8 → 2403.5 |
| orbital-atlas         | phone   |   5,130,193 → 5,031,868 |   97 → 95 |          2325.4 → 2723.7 |
| molecule-viewer       | phone   |   5,400,672 → 5,302,347 | 120 → 118 |          2100.1 → 2409.3 |
| periodic-table        | phone   |   5,042,867 → 4,944,542 |   97 → 95 |          2156.1 → 2786.0 |
| real-elements         | phone   |   5,507,952 → 5,409,627 | 103 → 101 |          2589.9 → 4137.6 |
| diamond               | phone   |   5,054,278 → 4,955,953 |   95 → 93 |          2149.6 → 2168.8 |
| ruby                  | phone   |   5,060,396 → 4,962,071 |   95 → 93 |          1737.6 → 2302.2 |
| emerald               | phone   |   5,055,164 → 4,956,839 |   95 → 93 |          1753.4 → 1941.8 |
| amethyst-geode        | phone   |   5,056,280 → 4,957,955 |   95 → 93 |          1977.5 → 2827.9 |
| sapphire              | phone   |   5,058,724 → 4,960,399 |   95 → 93 |          1879.7 → 2097.4 |
| quartz-cluster        | phone   |   5,071,870 → 4,973,545 |   95 → 93 |          1729.4 → 1995.4 |
| opal                  | phone   |   5,076,496 → 4,978,171 |   95 → 93 |          1708.1 → 2176.9 |
| pearl                 | phone   |   5,083,692 → 4,985,367 |   95 → 93 |          1667.7 → 2262.6 |
| brain                 | phone   |   5,053,658 → 4,955,333 |   95 → 93 |          1653.6 → 2412.1 |
| eye                   | phone   |   5,060,322 → 4,961,997 |   95 → 93 |          1764.4 → 2393.4 |
| lungs                 | phone   |   5,063,938 → 4,965,613 |   95 → 93 |          1931.0 → 2413.3 |
| tooth                 | phone   |   5,074,948 → 4,976,623 |   95 → 93 |          1678.1 → 2133.5 |
| kidney                | phone   |   5,078,774 → 4,980,449 |   95 → 93 |          1570.7 → 1923.3 |
| anatomy-atlas         | phone   |   5,142,007 → 5,043,682 |   96 → 94 |          3109.9 → 3623.8 |
| oak                   | phone   |   5,253,466 → 5,155,141 |   95 → 93 |          1830.3 → 2358.8 |
| pine                  | phone   |   5,259,316 → 5,160,991 |   95 → 93 |          1740.7 → 2351.2 |
| palm                  | phone   |   5,263,550 → 5,165,225 |   95 → 93 |          1541.5 → 2173.4 |
| cherry-blossom        | phone   |   5,277,642 → 5,179,317 |   95 → 93 |          1770.7 → 3293.7 |
| maple                 | phone   |   5,280,362 → 5,182,037 |   95 → 93 |          1891.8 → 2228.8 |
| bonsai                | phone   |   5,280,600 → 5,182,275 |   95 → 93 |          1622.0 → 2698.9 |
| willow                | phone   |   5,284,326 → 5,186,001 |   95 → 93 |          1915.0 → 2122.6 |
| sunflower             | phone   |   5,290,402 → 5,192,077 |   95 → 93 |          1693.6 → 2224.0 |
| rose                  | phone   |   5,296,300 → 5,197,975 |   95 → 93 |          1539.2 → 2643.8 |
| dandelion             | phone   |   5,304,246 → 5,205,921 |   95 → 93 |          1689.0 → 2448.2 |
| tulip                 | phone   |   5,306,366 → 5,208,041 |   95 → 93 |          1787.7 → 2509.5 |
| daisy                 | phone   |   5,322,130 → 5,223,805 |   95 → 93 |          1705.4 → 3071.4 |
| lotus                 | phone   |   5,317,770 → 5,219,445 |   95 → 93 |          1663.2 → 2786.6 |
| mushroom              | phone   |   5,317,642 → 5,219,317 |   95 → 93 |          1902.2 → 2499.2 |
| fern                  | phone   |   5,309,670 → 5,211,345 |   95 → 93 |          2026.8 → 2240.8 |
| saguaro               | phone   |   5,309,462 → 5,211,137 |   95 → 93 |          1661.5 → 3254.9 |
| coral                 | phone   |   5,303,330 → 5,205,005 |   95 → 93 |          1948.1 → 4432.4 |
| pinecone              | phone   |   5,302,948 → 5,204,623 |   95 → 93 |          1591.1 → 3195.1 |
| acorn                 | phone   |   5,307,162 → 5,208,837 |   95 → 93 |          1780.3 → 2273.2 |
| succulent             | phone   |   5,303,016 → 5,204,691 |   95 → 93 |          1495.3 → 2713.9 |
| bamboo                | phone   |   5,301,508 → 5,203,183 |   95 → 93 |          1852.6 → 2380.1 |
| rocks                 | phone   |   5,296,362 → 5,198,037 |   95 → 93 |          1606.5 → 2934.8 |
| kelp                  | phone   |   5,298,686 → 5,200,361 |   95 → 93 |          1592.7 → 6912.6 |
| storm-cloud           | phone   |   5,202,427 → 5,104,102 |   95 → 93 |          1688.2 → 6541.6 |
| lava-lamp             | phone   |   5,200,721 → 5,102,396 |   95 → 93 |          1887.6 → 2691.3 |
| snow-globe            | phone   |   5,192,481 → 5,094,156 |   95 → 93 |          1643.9 → 2494.5 |
| volcano               | phone   |   5,195,853 → 5,097,528 |   95 → 93 |          1685.2 → 2741.5 |
| ice-statue            | phone   |   5,196,385 → 5,098,060 |   95 → 93 |          1745.1 → 2601.4 |
| candle                | phone   |   5,193,627 → 5,095,302 |   95 → 93 |          7863.9 → 3315.0 |
| tornado               | phone   |   5,192,339 → 5,094,014 |   95 → 93 |          1929.0 → 2359.3 |
| rainbow               | phone   |   5,191,521 → 5,093,196 |   95 → 93 |          1928.4 → 2217.3 |
| iceberg               | phone   |   5,187,977 → 5,089,652 |   95 → 93 |          2259.8 → 2379.6 |
| waterfall             | phone   |   5,180,871 → 5,082,546 |   95 → 93 |          1878.6 → 2307.1 |
| ocean-wave            | phone   |   5,168,233 → 5,069,908 |   95 → 93 |          1993.4 → 2153.0 |
| geyser                | phone   |   5,170,023 → 5,071,698 |   95 → 93 |          2188.5 → 2106.0 |
| ice-cream             | phone   |   5,293,092 → 5,194,767 |   95 → 93 |          2150.9 → 2892.0 |
| watermelon            | phone   |   5,288,514 → 5,190,189 |   95 → 93 |          2345.9 → 3839.7 |
| birthday-cake         | phone   |   5,287,820 → 5,189,495 |   95 → 93 |          2428.4 → 5329.6 |
| popcorn               | phone   |   5,288,092 → 5,189,767 |   95 → 93 |          1928.8 → 9665.3 |
| jelly                 | phone   |   5,284,760 → 5,186,435 |   95 → 93 |          1760.3 → 4556.4 |
| pancakes              | phone   |   5,282,832 → 5,184,507 |   95 → 93 |          2303.2 → 3335.6 |
| cupcake               | phone   |   5,285,610 → 5,187,285 |   95 → 93 |          2261.2 → 2776.9 |
| lollipop              | phone   |   5,283,690 → 5,185,365 |   95 → 93 |          2280.7 → 2841.0 |
| candy-cane            | phone   |   5,279,128 → 5,180,803 |   95 → 93 |          2528.2 → 2736.7 |
| macarons              | phone   |   5,273,252 → 5,174,927 |   95 → 93 |          1847.3 → 2780.2 |
| donut                 | phone   |   5,003,958 → 4,905,633 |   94 → 92 |          2146.1 → 2237.0 |
| gummy-bear            | phone   |   5,273,522 → 5,175,197 |   95 → 93 |          2067.5 → 2584.5 |
| pretzel               | phone   |   5,269,728 → 5,171,403 |   95 → 93 |          2169.6 → 2890.8 |
| croissant             | phone   |   5,265,524 → 5,167,199 |   95 → 93 |          2688.4 → 4880.3 |
| pizza                 | phone   |   5,260,306 → 5,161,981 |   95 → 93 |          2924.3 → 6024.0 |
| burger                | phone   |   5,260,380 → 5,162,055 |   95 → 93 |          5767.9 → 3241.4 |
| sushi                 | phone   |   5,260,374 → 5,162,049 |   95 → 93 |          4040.7 → 3450.3 |
| taco                  | phone   |   5,261,616 → 5,163,291 |   95 → 93 |          2181.3 → 3126.2 |
| egg                   | phone   |   5,258,154 → 5,159,829 |   95 → 93 |          2606.9 → 3055.1 |
| coffee                | phone   |   5,258,856 → 5,160,531 |   95 → 93 |          2171.9 → 2823.4 |
| apple                 | phone   |   5,257,928 → 5,159,603 |   95 → 93 |          1941.7 → 4163.0 |
| banana                | phone   |   5,255,220 → 5,156,895 |   95 → 93 |          3274.8 → 3198.7 |
| orange                | phone   |   5,255,506 → 5,157,181 |   95 → 93 |          2432.6 → 2638.0 |
| kiwi                  | phone   |   5,258,162 → 5,159,837 |   95 → 93 |          2653.7 → 5255.5 |
| pineapple             | phone   |   5,256,686 → 5,158,361 |   95 → 93 |         2602.9 → 13028.5 |
| cherries              | phone   |   5,252,498 → 5,154,173 |   95 → 93 |          2147.1 → 3111.1 |
| grapes                | phone   |   5,249,388 → 5,151,063 |   95 → 93 |          2504.9 → 3024.2 |
| avocado               | phone   |   5,247,466 → 5,149,141 |   95 → 93 |          2560.0 → 3077.9 |
| bricks                | phone   |   5,103,303 → 5,004,978 |   95 → 93 |          2257.8 → 2966.5 |
| rubber-duck           | phone   |   5,098,951 → 5,000,626 |   95 → 93 |          2067.4 → 2982.6 |
| spinning-top          | phone   |   5,106,035 → 5,007,710 |   95 → 93 |          2093.5 → 3384.3 |
| dice                  | phone   |   5,105,723 → 5,007,398 |   95 → 93 |          1966.4 → 2671.3 |
| newtons-cradle        | phone   |   5,104,285 → 5,005,960 |   95 → 93 |          1967.5 → 3050.8 |
| teddy-bear            | phone   |   5,110,603 → 5,012,278 |   95 → 93 |          1774.1 → 2911.0 |
| yo-yo                 | phone   |   5,110,823 → 5,012,498 |   95 → 93 |          1748.0 → 3048.9 |
| puzzle-cube           | phone   |   5,114,695 → 5,016,370 |   95 → 93 |          1882.5 → 3024.1 |
| spring-toy            | phone   |   5,114,149 → 5,015,824 |   95 → 93 |          1352.2 → 2459.9 |
| kite                  | phone   |   5,113,109 → 5,014,784 |   95 → 93 |          1697.2 → 2654.5 |
| paper-plane           | phone   |   5,118,987 → 5,020,662 |   95 → 93 |          1936.2 → 2520.1 |
| origami-crane         | phone   |   5,125,797 → 5,027,472 |   95 → 93 |          1967.8 → 5412.8 |
| balloon-dog           | phone   |   5,121,521 → 5,023,196 |   95 → 93 |          2283.5 → 4731.5 |
| soap-bubbles          | phone   |   5,122,151 → 5,023,826 |   95 → 93 |          2382.3 → 2565.0 |
| robot                 | phone   |   5,120,539 → 5,022,214 |   95 → 93 |          2100.9 → 2596.6 |
| chess-set             | phone   |   5,041,226 → 4,942,901 |   96 → 94 |          2201.8 → 3263.1 |
| lorenz                | phone   |   5,274,104 → 5,175,779 |   96 → 94 |          1876.8 → 3182.1 |
| mobius                | phone   |   5,282,500 → 5,184,175 |   96 → 94 |          2238.7 → 3938.9 |
| klein-bottle          | phone   |   5,287,884 → 5,189,559 |   96 → 94 |          1912.6 → 2382.5 |
| menger-sponge         | phone   |   5,291,342 → 5,193,017 |   96 → 94 |          1787.0 → 2867.1 |
| hypercube             | phone   |   5,293,504 → 5,195,179 |   96 → 94 |          8445.0 → 5204.8 |
| torus-knot            | phone   |   5,298,164 → 5,199,839 |   96 → 94 |          3828.4 → 2934.4 |
| gyroid                | phone   |   5,295,032 → 5,196,707 |   96 → 94 |          2938.1 → 3019.5 |
| mandelbulb            | phone   |   5,298,760 → 5,200,435 |   96 → 94 |          2263.2 → 2359.6 |
| sierpinski            | phone   |   5,302,956 → 5,204,631 |   96 → 94 |          1999.1 → 2470.9 |
| platonic              | phone   |   5,305,706 → 5,207,381 |   96 → 94 |          1980.9 → 8831.1 |
| seashell-spiral       | phone   |   5,316,048 → 5,217,723 |   96 → 94 |          2745.7 → 4876.5 |
| graph-plotter         | phone   |   5,316,488 → 5,218,163 |   96 → 94 |          2727.9 → 3045.6 |
| surface-plotter       | phone   |   5,316,272 → 5,217,947 |   96 → 94 |          6336.0 → 3645.4 |
| unit-circle           | phone   |   5,318,674 → 5,220,349 |   96 → 94 |          2226.7 → 2582.3 |
| fourier-circles       | phone   |   5,318,008 → 5,219,683 |   96 → 94 |          2964.9 → 1932.3 |
| pythagoras-proof      | phone   |   5,320,360 → 5,222,035 |   96 → 94 |          2345.5 → 2614.4 |
| rossler-attractor     | phone   |   5,316,516 → 5,218,191 |   96 → 94 |          2924.0 → 3177.2 |
| thomas-attractor      | phone   |   5,308,640 → 5,210,315 |   96 → 94 |          2060.1 → 2885.4 |
| aizawa-attractor      | phone   |   5,318,268 → 5,219,943 |   96 → 94 |          2734.8 → 2221.0 |
| five-cell             | phone   |   5,322,866 → 5,224,541 |   96 → 94 |          2098.3 → 2813.8 |
| sixteen-cell          | phone   |   5,340,254 → 5,241,929 |   96 → 94 |          2253.1 → 2493.6 |
| twenty-four-cell      | phone   |   5,335,788 → 5,237,463 |   96 → 94 |          2561.9 → 3265.9 |
| duoprism              | phone   |   5,335,934 → 5,237,609 |   96 → 94 |          2494.8 → 3417.0 |
| splat-equation        | phone   |   5,131,943 → 5,033,618 |   96 → 94 |          3939.3 → 3440.8 |
| book                  | phone   |   7,072,584 → 6,974,259 |  100 → 98 |          3482.6 → 4443.6 |
| laptop                | phone   |   5,102,162 → 5,003,837 |   95 → 93 |          3247.6 → 2403.7 |
| music-box             | phone   |   5,101,340 → 5,003,015 |   95 → 93 |          2376.2 → 2920.3 |
| clock                 | phone   |   5,101,766 → 5,003,441 |   95 → 93 |          2116.8 → 3876.8 |
| gift-box              | phone   |   5,106,724 → 5,008,399 |   95 → 93 |          1790.4 → 2553.1 |
| umbrella              | phone   |   5,108,666 → 5,010,341 |   95 → 93 |          2423.2 → 3726.7 |
| desk-fan              | phone   |   5,107,328 → 5,009,003 |   95 → 93 |          2496.3 → 2460.4 |
| lamp                  | phone   |   5,107,800 → 5,009,475 |   95 → 93 |          4505.1 → 4580.5 |
| potion-bottle         | phone   |   5,104,340 → 5,006,015 |   95 → 93 |          2326.7 → 4846.7 |
| telescope             | phone   |   5,106,440 → 5,008,115 |   95 → 93 |          2205.1 → 3534.7 |
| fountain-pen          | phone   |   8,867,420 → 5,945,925 |   95 → 95 |          2157.7 → 2969.4 |
| water-bottle          | phone   |   8,613,520 → 5,997,575 |   95 → 95 |          3130.3 → 3314.4 |
| soda-can              | phone   |   8,863,490 → 5,877,721 |   95 → 95 |          7345.8 → 2021.8 |
| running-shoe          | phone   |   8,873,600 → 8,868,721 |   95 → 95 |          2604.7 → 3478.9 |
| hoodie                | phone   |   8,874,084 → 8,869,205 |   95 → 95 |          2892.5 → 6613.7 |
| sunglasses            | phone   |   8,883,574 → 5,999,837 |   95 → 95 |          2043.0 → 3218.3 |
| baseball-cap          | phone   |   8,895,638 → 6,011,663 |   95 → 95 |          2318.9 → 2204.3 |
| sword-in-stone        | phone   |   5,124,607 → 5,026,282 |   95 → 93 |         14543.0 → 2332.3 |
| shield                | phone   |   5,118,627 → 5,020,302 |   95 → 93 |          4019.5 → 2475.3 |
| bow-and-target        | phone   |   5,110,895 → 5,012,570 |   95 → 93 |          2492.8 → 2036.8 |
| trebuchet             | phone   |   5,109,883 → 5,011,558 |   95 → 93 |          1943.3 → 2941.3 |
| crossbow              | phone   |   5,110,625 → 5,012,300 |   95 → 93 |          1703.7 → 2904.0 |
| knights-helmet        | phone   |   5,109,681 → 5,011,356 |   95 → 93 |          1859.1 → 2495.8 |
| crown                 | phone   |   5,115,035 → 5,016,710 |   95 → 93 |          1993.0 → 2657.6 |
| dragon-egg            | phone   |   5,117,513 → 5,019,188 |   95 → 93 |          1904.5 → 3032.7 |
| wizards-orb           | phone   |   5,108,351 → 5,010,026 |   95 → 93 |          2557.3 → 2089.5 |
| crystal-ball          | phone   |   5,089,610 → 4,991,285 |   95 → 93 |          1767.1 → 2490.3 |
| jellyfish             | phone   |   5,130,305 → 5,031,980 |   95 → 93 |          1928.0 → 2013.2 |
| fish-school           | phone   |   5,134,459 → 5,036,134 |   95 → 93 |          1603.6 → 1927.6 |
| butterfly             | phone   |   5,135,823 → 5,037,498 |   95 → 93 |          1722.0 → 2174.1 |
| pufferfish            | phone   |   5,140,239 → 5,041,914 |   95 → 93 |          1977.0 → 2123.5 |
| nautilus              | phone   |   5,144,431 → 5,046,106 |   95 → 93 |          2005.2 → 3393.7 |
| ladybug               | phone   |   5,147,223 → 5,048,898 |   95 → 93 |          1948.9 → 1990.8 |
| snail                 | phone   |   5,146,865 → 5,048,540 |   95 → 93 |          1865.5 → 2219.6 |
| octopus               | phone   |   5,156,761 → 5,058,436 |   95 → 93 |          1954.4 → 2399.1 |
| starfish              | phone   |   5,152,739 → 5,054,414 |   95 → 93 |          1782.9 → 2118.4 |
| sea-urchin            | phone   |   5,140,809 → 5,042,484 |   95 → 93 |          1790.6 → 1775.0 |
| frog                  | phone   |   5,139,713 → 5,041,388 |   95 → 93 |          3620.5 → 2172.2 |
| penguin               | phone   |   5,136,787 → 5,038,462 |   95 → 93 |          1801.0 → 2289.6 |
| owl                   | phone   |   5,132,229 → 5,033,904 |   95 → 93 |          1891.5 → 2206.6 |
| jack-o-lantern        | phone   |   5,141,373 → 5,043,048 |   95 → 93 |         17994.4 → 2257.3 |
| snowman               | phone   |   5,130,759 → 5,032,434 |   95 → 93 |          1908.1 → 2729.6 |
| fireworks             | phone   |   5,128,083 → 5,029,758 |   95 → 93 |          2080.3 → 2377.6 |
| decorated-tree        | phone   |   5,125,249 → 5,026,924 |   95 → 93 |          4168.5 → 2550.2 |
| patterned-egg         | phone   |   5,118,099 → 5,019,774 |   95 → 93 |          1965.7 → 2150.6 |
| paper-lantern         | phone   |   5,114,373 → 5,016,048 |   95 → 93 |          2132.8 → 2053.1 |
| diya                  | phone   |   5,114,271 → 5,015,946 |   95 → 93 |          2279.1 → 3039.9 |
| menorah               | phone   |   5,114,139 → 5,015,814 |   95 → 93 |          1889.5 → 3388.8 |
| guitar                | phone   |   5,085,336 → 4,987,011 |   96 → 94 |          5028.2 → 3654.8 |
| drum                  | phone   |   5,078,294 → 4,979,969 |   96 → 94 |          2219.3 → 2399.4 |
| xylophone             | phone   |   5,079,486 → 4,981,161 |   96 → 94 |          2072.5 → 2409.5 |
| toy-piano             | phone   |   5,076,480 → 4,978,155 |   96 → 94 |          1811.8 → 2462.5 |
| grand-piano           | phone   |   5,126,748 → 5,028,423 |   97 → 95 |         2546.4 → 17961.3 |
| upright-piano         | phone   |   5,133,332 → 5,035,007 |   97 → 95 |          2238.4 → 3071.5 |
| harpsichord           | phone   |   5,137,218 → 5,038,893 |   97 → 95 |          2234.8 → 2844.2 |
| electronic-keyboard   | phone   |   5,146,768 → 5,048,443 |   97 → 95 |          1997.1 → 2408.0 |
| rocket                | phone   |   5,154,159 → 5,055,834 |   95 → 93 |          1886.5 → 2152.7 |
| helicopter            | phone   |   5,150,739 → 5,052,414 |   95 → 93 |          3673.1 → 2098.2 |
| hot-air-balloon       | phone   |   5,151,947 → 5,053,622 |   95 → 93 |          2061.2 → 2245.6 |
| steam-train           | phone   |   5,153,527 → 5,055,202 |   95 → 93 |          1860.7 → 2040.3 |
| ocean-liner           | phone   |   5,154,159 → 5,055,834 |   95 → 93 |          2188.6 → 2163.9 |
| sports-car            | phone   |   5,152,985 → 5,054,660 |   95 → 93 |          2369.2 → 2181.4 |
| bus                   | phone   |   5,155,623 → 5,057,298 |   95 → 93 |          2874.2 → 2102.9 |
| propeller-plane       | phone   |   5,155,497 → 5,057,172 |   95 → 93 |          2205.8 → 1795.9 |
| jet                   | phone   |   5,153,861 → 5,055,536 |   95 → 93 |          2227.3 → 1991.3 |
| sailboat              | phone   |   5,156,595 → 5,058,270 |   95 → 93 |          1986.4 → 1826.3 |
| submarine             | phone   |   5,156,353 → 5,058,028 |   95 → 93 |          1595.5 → 2412.2 |
| bicycle               | phone   |   5,157,373 → 5,059,048 |   95 → 93 |          1894.4 → 2315.2 |
| tractor               | phone   |   5,157,135 → 5,058,810 |   95 → 93 |          2555.5 → 2419.5 |
| ufo                   | phone   |   5,153,361 → 5,055,036 |   95 → 93 |          2002.5 → 1990.4 |
| eiffel-tower          | phone   |   5,198,566 → 5,100,241 |   95 → 93 |          1509.1 → 2036.4 |
| washington-monument   | phone   |   5,197,194 → 5,098,869 |   95 → 93 |          1989.4 → 2106.2 |
| pyramids              | phone   |   5,145,437 → 5,100,241 |   94 → 93 |          1637.3 → 1951.5 |
| supertall             | phone   |   5,192,552 → 5,041,098 |   94 → 91 |          1990.6 → 1872.4 |
| lighthouse            | phone   |   5,188,402 → 5,090,077 |   93 → 91 |          1834.4 → 2778.8 |
| statue-of-liberty     | phone   |   5,179,828 → 5,081,503 |   92 → 90 |         1974.2 → 35400.0 |
| white-house           | phone   |   5,165,460 → 5,067,135 |   91 → 89 |          1931.3 → 2075.9 |
| leaning-tower         | phone   |   5,155,168 → 5,056,843 |   90 → 88 |          1976.8 → 2048.1 |
| colosseum             | phone   |   5,141,496 → 5,043,171 |   89 → 87 |          5248.1 → 2051.3 |
| parthenon             | phone   |   5,127,580 → 5,029,255 |   88 → 86 |          3839.1 → 1863.0 |
| stonehenge            | phone   |   5,122,398 → 5,024,073 |   87 → 85 |          2232.7 → 1581.0 |
| big-ben               | phone   |   5,115,672 → 5,017,347 |   86 → 84 |          3988.5 → 6671.7 |
| taj-mahal             | phone   |   5,115,672 → 5,017,347 |   86 → 84 |         1914.4 → 10073.4 |
| castle                | phone   |   5,115,672 → 5,017,347 |   86 → 84 |          2038.0 → 2066.7 |
| pagoda                | phone   |   5,115,672 → 5,017,347 |   86 → 84 |          1685.6 → 1958.8 |
| windmill              | phone   |   5,115,672 → 5,017,347 |   86 → 84 |          2207.4 → 2269.1 |
| perceptron            | phone   |   5,273,825 → 5,175,500 |   96 → 94 |          3780.3 → 1955.7 |
| multilayer-perceptron | phone   |   5,275,829 → 5,177,504 |   96 → 94 |          3264.5 → 2070.3 |
| neural-network        | phone   |   5,281,123 → 5,182,798 |   96 → 94 |          2108.6 → 2076.6 |
| cnn                   | phone   |   5,281,247 → 5,182,922 |   96 → 94 |          1830.3 → 1679.1 |
| rnn                   | phone   |   5,281,475 → 5,183,150 |   96 → 94 |          1765.9 → 1740.7 |
| transformer           | phone   |   5,293,693 → 5,195,368 |   96 → 94 |          1985.6 → 2243.1 |
| looped-transformer    | phone   |   5,288,783 → 5,190,458 |   96 → 94 |          1637.2 → 1714.9 |
| diffusion-model       | phone   |   5,283,575 → 5,185,250 |   96 → 94 |          1680.9 → 1673.0 |
| gradient-descent      | phone   |   5,271,653 → 5,173,328 |   96 → 94 |          1646.1 → 1881.3 |
| gaussian-splatting    | phone   |   5,232,230 → 5,133,905 |  101 → 99 |          5391.7 → 5186.5 |
| word-vectors          | phone   |   7,055,158 → 6,956,833 |   97 → 95 |          1923.9 → 1600.5 |
| sorting-machine       | phone   |   5,272,345 → 5,174,020 |   96 → 94 |          1846.3 → 1385.6 |
| half-adder            | phone   |   5,269,803 → 5,171,478 |   96 → 94 |          1823.9 → 1874.5 |
| turing-machine        | phone   |   5,199,596 → 5,101,271 |   96 → 94 |          1857.4 → 2625.0 |
| difference-engine     | phone   |   5,198,352 → 5,100,027 |   96 → 94 |          2125.1 → 1888.2 |
| enigma-machine        | phone   |   5,199,296 → 5,100,971 |   96 → 94 |          2569.5 → 1808.1 |
| bombe                 | phone   |   5,198,532 → 5,100,207 |   96 → 94 |          1897.0 → 1743.6 |
| picture-lab           | phone   |   7,170,354 → 7,072,029 |  100 → 98 |          1993.1 → 2035.8 |
| your-book             | phone   | 14,364,458 → 14,266,133 |   99 → 97 |          2162.4 → 2001.6 |
| photo-album           | phone   |   5,894,926 → 5,796,601 | 103 → 101 |          1932.8 → 1642.3 |
| picture-frame         | phone   |   5,463,837 → 5,365,512 |   98 → 96 |          1801.6 → 1372.2 |
| song-landscape        | phone   |   6,426,976 → 6,328,651 | 110 → 108 |          1807.5 → 1554.8 |
| chladni-plate         | phone   |   5,538,789 → 5,440,464 | 106 → 104 |          2789.6 → 1453.6 |
| chladni-cell          | phone   |   5,558,627 → 5,460,302 | 106 → 104 |          1841.1 → 1493.0 |
| room-echo             | phone   |   5,520,066 → 5,421,741 | 104 → 102 |          1943.6 → 1558.7 |
| splat-mirror          | phone   |   6,397,173 → 6,298,848 | 106 → 104 |          2175.3 → 1431.4 |
| model-splats          | phone   |   5,368,658 → 5,270,333 |   97 → 95 |          2368.1 → 2155.2 |
| qr-code               | phone   |   5,451,346 → 5,353,021 | 103 → 101 |          4989.6 → 2237.1 |
| qr-anatomy            | phone   |   5,403,888 → 5,305,563 | 102 → 100 |          1548.5 → 1419.6 |
| qr-damage             | phone   |   5,663,553 → 5,565,228 | 103 → 101 |          1769.9 → 1651.4 |
| qr-three              | phone   |   5,422,030 → 5,323,705 | 102 → 100 |          2173.9 → 1910.3 |
| qr-picture            | phone   |   5,952,376 → 5,854,051 | 106 → 104 |          5503.7 → 4851.8 |
| qr-build              | phone   |   5,697,933 → 5,599,608 | 105 → 103 |          1628.8 → 2120.3 |
| barcodes              | phone   |   5,758,542 → 5,660,217 | 105 → 103 |          1731.3 → 1571.7 |
| photo-3d              | phone   |   6,321,764 → 6,223,439 | 103 → 101 |          2664.0 → 2198.8 |
| moving-photo-3d       | phone   |   9,056,706 → 8,958,381 | 119 → 117 |          7136.7 → 6610.6 |
| video-3d              | phone   | 13,221,299 → 13,122,974 | 102 → 100 |          1925.5 → 2153.1 |
| sound-lab             | phone   |   5,341,679 → 5,243,354 |   99 → 97 |          2406.5 → 6614.7 |
| sound-recorder        | phone   |   5,339,281 → 5,240,956 |   99 → 97 |          1939.0 → 2240.2 |
| splat-toolkit         | phone   | 11,636,644 → 11,538,319 | 109 → 107 |          6443.9 → 7514.0 |
| point-clouds          | phone   |   9,223,395 → 9,125,070 | 109 → 107 |          4859.5 → 4120.5 |
| volume-viewer         | phone   |   5,766,561 → 5,668,236 |   98 → 96 |          6423.9 → 3960.1 |
| splat-field           | phone   |   5,183,097 → 5,084,772 |   95 → 93 |          1679.2 → 3861.1 |
| light-lab             | phone   |   5,238,884 → 5,140,559 |   98 → 96 |          3112.9 → 2344.2 |
| baked-chest           | phone   |   5,604,277 → 5,505,952 |   98 → 96 |          1376.0 → 1791.3 |
| thermal-ellipsoids    | phone   |   5,551,100 → 5,452,775 | 109 → 107 |          1922.9 → 1820.8 |
| smlm-microscope       | phone   |   7,909,627 → 7,811,302 | 109 → 107 |          2290.9 → 1836.3 |
| galaxy-box            | phone   |   8,551,582 → 8,453,257 | 109 → 107 |          1560.4 → 1814.7 |
| cryoem-map            | phone   |   6,464,168 → 6,365,843 | 110 → 108 |          2496.4 → 2895.7 |
| contour-lab           | phone   |   5,663,140 → 5,564,815 | 109 → 107 |          1537.6 → 3826.5 |
| terrain-box           | phone   |   5,665,836 → 5,567,511 | 109 → 107 |          1712.3 → 1857.5 |
| ripple-tank           | phone   |   5,312,263 → 5,213,938 |   98 → 96 |          2011.3 → 2088.5 |
| light-bench           | phone   |   5,309,199 → 5,210,874 |   98 → 96 |          1710.7 → 1637.5 |
| fluid-lab             | phone   |   5,289,042 → 5,190,717 |  101 → 99 |          1527.1 → 1849.4 |
| grand-canyon          | phone   |   6,241,220 → 6,142,895 |   99 → 97 |          2536.0 → 2764.6 |
| st-helens             | phone   |   6,474,345 → 6,376,020 |   99 → 97 |          2217.4 → 2510.9 |
| sea-floor             | phone   |   5,639,104 → 5,540,779 |   98 → 96 |          2637.2 → 2394.3 |
| tide-harbor           | phone   |   5,851,444 → 5,753,119 |   99 → 97 |          3035.1 → 2709.6 |
| hurricane             | phone   |   5,534,178 → 5,435,853 |   99 → 97 |          3543.0 → 2281.3 |
| relief-map            | phone   |   5,482,783 → 5,384,458 |   98 → 96 |          2650.4 → 5724.7 |
| living-city           | phone   | 10,560,288 → 10,461,963 |   98 → 96 |          2264.5 → 5922.0 |
| stork-migration       | phone   |   5,736,893 → 5,638,568 |   99 → 97 |          2017.2 → 2288.6 |
| earthquakes           | phone   |   5,761,980 → 5,663,655 |  100 → 98 |          2197.8 → 6149.9 |
| airport-xray          | phone   |   5,302,958 → 5,204,633 |   95 → 93 |          2327.4 → 2902.4 |
| how-ct                | phone   |   5,304,554 → 5,206,229 |   95 → 93 |          2125.4 → 2154.1 |
| walnut-ct             | phone   |   5,771,607 → 5,673,282 |   96 → 94 |          1755.8 → 1962.7 |
| fruit-mri             | phone   |   5,253,202 → 5,154,877 |   95 → 93 |          1639.9 → 3000.3 |
| electron-microscope   | phone   |   5,261,236 → 5,162,911 |   95 → 93 |          1699.4 → 2286.1 |
| thermal-camera        | phone   |   5,253,676 → 5,155,351 |   95 → 93 |          2553.3 → 2118.3 |
| screen                | phone   |   5,658,172 → 5,937,816 |   99 → 97 |          3370.0 → 3158.5 |
| shardball             | phone   |   5,283,227 → 5,238,031 |  100 → 99 |          2010.1 → 2835.6 |
| longtail              | phone   |   5,349,797 → 5,251,472 |  101 → 99 |          1578.3 → 2412.0 |
| grain-garden          | phone   |   5,336,688 → 5,238,363 |  101 → 99 |          1578.6 → 1943.7 |
| page-breaker          | phone   |   7,261,118 → 7,162,793 | 105 → 103 |          1829.7 → 1715.0 |
| strata                | phone   |   5,333,475 → 5,235,150 |  101 → 99 |          1740.8 → 3246.6 |
| volley-table          | phone   |   5,332,193 → 5,233,868 |  101 → 99 |          1951.3 → 2197.6 |
| stone-belt            | phone   |   5,746,112 → 5,647,787 | 102 → 100 |          1737.9 → 9077.1 |
| soft-landing          | phone   |   5,827,957 → 5,729,632 | 102 → 100 |          3354.5 → 1690.5 |
| night-owl-pinball     | phone   |   5,341,244 → 5,242,919 |  101 → 99 |          2149.1 → 1675.3 |
| cast-a-shadow         | phone   |   5,336,534 → 5,238,209 |  101 → 99 |          1376.9 → 1627.6 |
| photo-dash            | phone   |   5,937,379 → 5,839,054 | 103 → 101 |          1728.5 → 2382.6 |
| note-rider            | phone   |   5,366,325 → 5,268,000 | 102 → 100 |          1608.8 → 2579.3 |
| night-sky             | phone   |   5,506,865 → 5,408,540 |   98 → 96 |          2340.3 → 9184.2 |
| data-in-3d            | phone   |   5,276,882 → 5,178,557 | 103 → 101 |          1884.5 → 4651.5 |
| climate-records       | phone   |   5,319,227 → 5,220,902 | 103 → 101 |          1937.7 → 2812.8 |
| cactus                | desktop | 11,021,766 → 10,923,441 | 122 → 120 |          4831.1 → 4386.9 |
| strawberry            | desktop | 11,030,997 → 10,932,672 | 122 → 120 |          7831.0 → 5520.9 |
| cookie                | desktop | 10,402,010 → 10,303,685 | 122 → 120 |          2800.5 → 6639.7 |
| bee                   | desktop | 11,020,010 → 10,921,685 | 122 → 120 |          4992.0 → 3135.4 |
| torus                 | desktop |   5,494,075 → 5,395,750 | 154 → 152 |          2779.1 → 3761.5 |
| blob                  | desktop |   5,482,572 → 5,384,247 | 153 → 151 |          3772.2 → 3007.5 |
| knot                  | desktop |   5,482,572 → 5,384,247 | 153 → 151 |         21180.1 → 7688.5 |
| cluster-fly           | desktop |   8,962,038 → 8,863,713 | 122 → 120 |          5092.4 → 6753.3 |
| may-beetle            | desktop |   9,027,208 → 8,928,883 | 122 → 120 |          7180.3 → 5881.1 |
| millipede             | desktop |   6,712,339 → 6,614,014 | 122 → 120 |          3939.7 → 3917.2 |
| bumblebee             | desktop |   9,067,539 → 8,969,214 | 122 → 120 |          7306.7 → 4134.1 |
| raspberry             | desktop |   9,015,267 → 8,916,942 | 130 → 128 |          3533.5 → 4025.4 |
| blackberry            | desktop |   9,117,513 → 9,019,188 | 130 → 128 |          5658.9 → 3849.8 |
| blueberry             | desktop |   8,714,810 → 8,616,485 | 130 → 128 |          2571.8 → 3136.5 |
| grape                 | desktop |   8,844,895 → 8,746,570 | 130 → 128 |          6616.5 → 4235.6 |
| star-cookie           | desktop |   9,159,073 → 9,060,748 | 134 → 132 |          3128.7 → 3431.8 |
| tomatoes              | desktop |   8,118,420 → 8,020,095 | 134 → 132 |          4679.5 → 4410.4 |
| mandeltorus           | desktop |   9,282,957 → 9,184,632 | 134 → 132 |         4725.2 → 15272.0 |
| basket                | desktop |   9,231,264 → 9,132,939 | 134 → 132 |          3608.7 → 5296.7 |
| heart-donut           | desktop |   8,433,818 → 8,335,493 | 138 → 136 |          2343.7 → 4126.3 |
| sushi-boat            | desktop |   8,600,651 → 8,502,326 | 138 → 136 |          2982.2 → 3680.1 |
| seeded-loaf           | desktop | 12,610,129 → 12,511,804 | 138 → 136 |          3408.0 → 8401.2 |
| steak                 | desktop |   7,736,070 → 7,637,745 | 138 → 136 |          2838.5 → 6641.1 |
| stollen               | desktop | 10,331,786 → 10,233,461 | 142 → 140 |          2330.8 → 5155.7 |
| orange-photo          | desktop |   7,213,362 → 7,115,037 | 142 → 140 |          3082.5 → 2891.8 |
| physalis              | desktop | 12,611,275 → 12,512,950 | 142 → 140 |          3997.3 → 4248.3 |
| crystal-gem           | desktop |   6,974,396 → 6,876,071 | 142 → 140 |          2408.0 → 3240.8 |
| alum-crystal          | desktop | 11,358,160 → 11,259,835 | 146 → 144 |          3049.6 → 4632.2 |
| puffin                | desktop |   9,010,041 → 8,911,716 | 146 → 144 |          2361.8 → 3491.3 |
| toy-trex              | desktop | 15,563,892 → 15,465,567 | 146 → 144 |          3676.1 → 5130.7 |
| monkey-doll           | desktop | 10,831,572 → 10,733,247 | 146 → 144 |          3428.8 → 3714.0 |
| elephant-souvenir     | desktop |   6,138,491 → 6,040,166 | 150 → 148 |          2139.0 → 3168.8 |
| turtle-souvenir       | desktop | 18,165,984 → 18,067,659 | 150 → 148 |          5838.2 → 5293.3 |
| cave-lioness          | desktop | 20,502,265 → 20,403,940 | 150 → 148 |          4965.0 → 5796.0 |
| dog-plush             | desktop | 13,118,874 → 13,020,549 | 150 → 148 |          3617.0 → 4578.9 |
| bmx-bike              | desktop | 12,851,520 → 12,753,195 | 154 → 152 |          3519.4 → 4337.8 |
| murex-shell           | desktop | 20,342,136 → 20,243,811 | 154 → 152 |          4123.6 → 4547.5 |
| sunflower-photo       | desktop | 15,554,705 → 15,456,380 | 154 → 152 |          3240.7 → 4217.0 |
| white-roses           | desktop |   5,820,484 → 5,722,159 | 154 → 152 |          2771.4 → 3811.7 |
| bonsai-photo          | desktop |   9,560,149 → 9,461,824 | 158 → 156 |          3544.0 → 3286.4 |
| mushroom-photo        | desktop | 15,028,977 → 14,930,652 | 158 → 156 |          3525.3 → 6031.9 |
| cactus-real           | desktop |   9,736,042 → 9,637,717 | 158 → 156 |          3168.1 → 7578.9 |
| crochet-earth         | desktop | 12,825,485 → 12,727,160 | 158 → 156 |          2856.8 → 8304.1 |
| desk-globe            | desktop | 10,428,001 → 10,329,676 | 162 → 160 |          8818.5 → 4394.7 |
| cherry-blossom-photo  | desktop | 20,390,670 → 20,292,345 | 162 → 160 |          7452.8 → 5113.0 |
| maple-tree            | desktop | 20,517,598 → 20,419,273 | 162 → 160 |          4797.5 → 5117.1 |
| peony                 | desktop | 20,542,309 → 20,443,984 | 162 → 160 |          6143.7 → 4826.0 |
| money-tree            | desktop |   8,479,641 → 8,381,316 | 166 → 164 |          2905.8 → 3286.5 |
| knight-horse          | desktop |   9,566,041 → 9,467,716 | 166 → 164 |          2823.5 → 3151.4 |
| triceratops-skull     | desktop | 13,580,943 → 13,482,618 | 166 → 164 |          3450.3 → 4093.2 |
| cone-shell            | desktop | 12,072,262 → 11,973,937 | 166 → 164 |          3357.9 → 3234.9 |
| celestial-globe       | desktop |   9,835,436 → 9,830,557 | 170 → 170 |          3615.9 → 3458.1 |
| armillary-sphere      | desktop |   9,707,000 → 9,702,121 | 170 → 170 |          3542.7 → 3717.7 |
| stannern-meteorites   | desktop |   9,837,704 → 9,832,825 | 170 → 170 |          3401.5 → 3618.1 |
| fluorite-crystal      | desktop |   9,284,564 → 9,279,685 | 170 → 170 |         10475.5 → 3766.6 |
| ammonite-agate        | desktop |   9,327,498 → 9,322,619 | 174 → 174 |         11751.7 → 3457.1 |
| morasko-meteorite     | desktop |   9,051,390 → 9,046,511 | 174 → 174 |          6140.8 → 3686.1 |
| pyrite-cubes          | desktop |   9,328,324 → 9,323,445 | 174 → 174 |          4001.8 → 4860.3 |
| megalodon-tooth       | desktop |   9,327,848 → 9,322,969 | 174 → 174 |          3992.9 → 4571.0 |
| rubber-duck-real      | desktop |   7,367,845 → 7,269,520 | 138 → 136 |          2521.8 → 2905.4 |
| garden-gnome          | desktop |   7,515,895 → 7,417,570 | 138 → 136 |          2829.8 → 2830.1 |
| wooden-elephant       | desktop |   7,511,921 → 7,413,596 | 138 → 136 |          2874.8 → 2911.4 |
| marble-bust           | desktop |   7,588,293 → 7,489,968 | 138 → 136 |         13790.5 → 4127.8 |
| ukulele               | desktop |   7,457,165 → 7,358,840 | 142 → 140 |          8153.7 → 3997.1 |
| alarm-clock           | desktop |   7,472,033 → 7,373,708 | 142 → 140 |          6923.0 → 3704.8 |
| vintage-camera        | desktop |   7,500,406 → 7,402,081 | 142 → 140 |          2218.4 → 3052.5 |
| boombox               | desktop |   7,178,736 → 7,080,411 | 142 → 140 |          2460.9 → 3234.8 |
| croissant-real        | desktop |   7,681,208 → 7,582,883 | 146 → 144 |          2291.0 → 2187.9 |
| carrot-cake           | desktop |   7,719,084 → 7,620,759 | 146 → 144 |          8420.1 → 3121.9 |
| pomegranate           | desktop |   7,736,018 → 7,637,693 | 146 → 144 |          4068.0 → 3298.2 |
| lantern               | desktop |   7,739,402 → 7,641,077 | 146 → 144 |          2922.2 → 2582.7 |
| cat-statue            | desktop |   7,748,361 → 7,650,036 | 150 → 148 |          2549.7 → 3232.2 |
| horse-statue          | desktop |   7,564,655 → 7,466,330 | 150 → 148 |          2328.7 → 2556.2 |
| pencil-real           | desktop |   6,459,412 → 6,361,087 | 150 → 148 |          2671.8 → 2638.4 |
| tin-can-real          | desktop |   7,823,768 → 7,725,443 | 150 → 148 |          4370.7 → 2222.5 |
| basketball            | desktop |   5,587,464 → 5,489,139 | 154 → 152 |          3672.3 → 3532.1 |
| soccer-ball           | desktop |   5,615,866 → 5,517,541 | 158 → 156 |          2981.2 → 3122.9 |
| american-football     | desktop |   5,615,866 → 5,517,541 | 158 → 156 |          2906.8 → 4237.4 |
| tennis-ball           | desktop |   5,615,866 → 5,517,541 | 158 → 156 |          3205.3 → 4087.6 |
| baseball              | desktop |   5,615,866 → 5,517,541 | 158 → 156 |          4441.1 → 9381.1 |
| softball              | desktop |   5,654,532 → 5,556,207 | 162 → 160 |          3661.1 → 3661.7 |
| beach-ball            | desktop |   5,654,532 → 5,556,207 | 162 → 160 |          2705.5 → 3544.0 |
| golf-ball             | desktop |   5,654,532 → 5,556,207 | 162 → 160 |          3505.1 → 3879.7 |
| rugby-ball            | desktop |   5,654,532 → 5,556,207 | 162 → 160 |          3286.8 → 3720.9 |
| volleyball            | desktop |   5,697,342 → 5,599,017 | 166 → 164 |          2927.0 → 2751.1 |
| water-polo-ball       | desktop |   5,697,342 → 5,599,017 | 166 → 164 |          3626.9 → 2927.6 |
| ping-pong-ball        | desktop |   5,697,342 → 5,599,017 | 166 → 164 |          3800.2 → 2645.6 |
| cricket-ball          | desktop |   5,697,342 → 5,599,017 | 166 → 164 |          3282.0 → 3230.4 |
| bowling-ball          | desktop |   5,716,332 → 5,618,007 | 170 → 168 |          3034.9 → 3188.2 |
| pool-ball             | desktop |   5,716,332 → 5,618,007 | 170 → 168 |          4378.7 → 3425.3 |
| pickleball            | desktop |   5,716,332 → 5,618,007 | 170 → 168 |          3947.2 → 3035.5 |
| dodgeball             | desktop |   5,716,332 → 5,618,007 | 170 → 168 |          2070.5 → 2746.5 |
| medicine-ball         | desktop |   5,734,114 → 5,635,789 | 174 → 172 |          3029.4 → 2700.0 |
| lacrosse-ball         | desktop |   5,734,114 → 5,635,789 | 174 → 172 |          2726.8 → 3119.7 |
| squash-ball           | desktop |   5,734,114 → 5,635,789 | 174 → 172 |          4459.6 → 3203.2 |
| bouncy-ball           | desktop |   5,734,114 → 5,635,789 | 174 → 172 |          3532.9 → 3167.4 |
| marble                | desktop |   5,752,852 → 5,654,527 | 178 → 176 |          4610.8 → 3065.2 |
| hockey-puck           | desktop |   5,752,852 → 5,654,527 | 178 → 176 |          3516.9 → 6300.5 |
| shuttlecock           | desktop |   5,752,852 → 5,654,527 | 178 → 176 |          3589.4 → 4659.8 |
| flying-disc           | desktop |   5,752,852 → 5,654,527 | 178 → 176 |          3839.4 → 3568.5 |
| heart                 | desktop |   6,248,270 → 6,149,945 | 238 → 236 |          3585.3 → 3415.7 |
| campfire              | desktop |   6,204,387 → 5,949,616 | 238 → 236 |          2839.4 → 3329.5 |
| chest                 | desktop |   6,176,482 → 6,078,157 | 238 → 236 |          3392.1 → 3710.9 |
| sun                   | desktop |   5,906,678 → 5,808,353 | 183 → 181 |          3679.5 → 3389.0 |
| solar-system          | desktop |   5,906,678 → 5,808,353 | 183 → 181 |          3526.4 → 2640.8 |
| mercury               | desktop |   5,906,678 → 5,808,353 | 183 → 181 |          3780.6 → 3858.3 |
| venus                 | desktop |   5,906,678 → 5,808,353 | 183 → 181 |          3410.5 → 3050.0 |
| earth                 | desktop |   5,961,536 → 5,863,211 | 187 → 185 |          3512.7 → 2839.4 |
| moon                  | desktop |   5,962,359 → 5,864,034 | 188 → 186 |          4101.4 → 3586.5 |
| mars                  | desktop |   5,961,536 → 5,863,211 | 187 → 185 |          3264.8 → 2997.8 |
| jupiter               | desktop |   5,961,536 → 5,863,211 | 187 → 185 |          3722.3 → 2955.1 |
| saturn                | desktop |   6,001,402 → 5,903,077 | 191 → 189 |          3526.1 → 2661.2 |
| uranus                | desktop |   6,001,402 → 5,903,077 | 191 → 189 |          2934.2 → 2064.7 |
| neptune               | desktop |   6,001,402 → 5,903,077 | 191 → 189 |          3902.8 → 7866.3 |
| planet                | desktop |   5,763,900 → 5,665,575 | 189 → 187 |          3042.3 → 7660.6 |
| aurora-planet         | desktop |   6,045,360 → 5,947,035 | 195 → 193 |          3291.6 → 5726.3 |
| asteroid              | desktop |   6,045,360 → 5,947,035 | 195 → 193 |         3914.5 → 34791.3 |
| comet                 | desktop |   6,045,360 → 6,355,543 | 195 → 241 |          3153.3 → 9500.5 |
| meteor                | desktop |   6,045,360 → 6,355,543 | 195 → 241 |         2358.3 → 31441.5 |
| star                  | desktop |   6,090,482 → 5,992,157 | 199 → 197 |          2693.6 → 9615.8 |
| pulsar                | desktop |   6,090,482 → 5,992,157 | 199 → 197 |         2643.6 → 16042.9 |
| black-hole            | desktop |   6,090,482 → 5,992,157 | 199 → 197 |         3275.5 → 45348.1 |
| star-cluster          | desktop |   6,090,482 → 6,379,171 | 199 → 245 |         2435.2 → 13047.4 |
| planetary-nebula      | desktop |   6,123,468 → 6,025,143 | 203 → 201 |         2253.2 → 24894.8 |
| nebula                | desktop |   6,123,468 → 6,025,143 | 203 → 201 |         3511.8 → 21439.6 |
| supernova             | desktop |   6,123,468 → 5,626,347 | 203 → 201 |         2946.5 → 21876.6 |
| spiral-galaxy         | desktop |   6,123,468 → 6,025,143 | 203 → 201 |         2742.2 → 17219.8 |
| real-moon             | desktop |   7,723,232 → 7,624,907 | 249 → 247 |          4872.8 → 6707.0 |
| real-mars             | desktop |   7,524,017 → 7,425,692 | 249 → 247 |          3630.0 → 6096.1 |
| real-earth            | desktop |   9,316,931 → 9,218,606 | 251 → 249 |         4065.0 → 10298.7 |
| real-mercury          | desktop |   7,790,599 → 7,692,274 | 249 → 247 |         5015.0 → 15814.4 |
| real-venus            | desktop |   7,827,371 → 6,670,718 | 249 → 247 |         4355.9 → 48675.7 |
| real-moons            | desktop |   7,019,616 → 6,921,291 | 248 → 246 |        12507.7 → 28175.6 |
| real-small-worlds     | desktop |   7,267,332 → 7,169,007 | 249 → 247 |         6967.9 → 17155.0 |
| nearby-stars          | desktop |   6,867,508 → 6,371,261 | 247 → 245 |         2556.0 → 32295.9 |
| star-systems          | desktop |   6,812,099 → 6,713,774 | 247 → 245 |         2384.3 → 12934.2 |
| real-galaxies         | desktop |   6,935,917 → 7,360,856 | 247 → 309 |          4214.4 → 9450.4 |
| powers-of-ten         | desktop |   6,892,405 → 7,317,344 | 245 → 306 |          2129.4 → 4525.3 |
| saturn-v              | desktop |   7,735,971 → 7,637,646 | 247 → 245 |          4687.3 → 7192.5 |
| sls                   | desktop |   9,096,459 → 8,998,134 | 247 → 245 |         5488.5 → 20314.9 |
| space-shuttle         | desktop |   8,161,807 → 8,063,482 | 247 → 245 |         5551.6 → 40495.6 |
| solar-orbits          | desktop |   6,974,756 → 6,277,969 | 253 → 251 |         3178.5 → 18062.3 |
| virus                 | desktop |   6,064,353 → 5,966,028 | 206 → 204 |         3913.1 → 11802.1 |
| bacteriophage         | desktop |   6,064,353 → 5,966,028 | 206 → 204 |          3423.4 → 9858.9 |
| bacterium             | desktop |   6,064,353 → 5,966,028 | 206 → 204 |         3626.9 → 10950.7 |
| red-blood-cell        | desktop |   6,064,353 → 5,966,028 | 206 → 204 |          3156.7 → 8855.5 |
| neuron                | desktop |   6,108,067 → 6,009,742 | 210 → 208 |         3180.3 → 26385.5 |
| astrocyte             | desktop |   6,108,067 → 6,009,742 | 210 → 208 |         3751.7 → 37882.3 |
| animal-cell           | desktop |   6,108,067 → 6,009,742 | 210 → 208 |         3264.4 → 48426.2 |
| dna                   | desktop |   6,108,067 → 6,009,742 | 210 → 208 |         4785.7 → 24878.9 |
| white-blood-cell      | desktop |   6,141,811 → 6,043,486 | 214 → 212 |         4173.4 → 21029.3 |
| microglia             | desktop |   6,141,811 → 6,043,486 | 214 → 212 |         3604.4 → 12391.9 |
| diatom                | desktop |   6,141,811 → 6,043,486 | 214 → 212 |         3626.3 → 12507.7 |
| tardigrade            | desktop |   6,141,811 → 6,370,206 | 214 → 260 |         3438.2 → 32901.5 |
| pollen                | desktop |   6,174,833 → 6,401,526 | 218 → 264 |         3090.8 → 33726.8 |
| snowflake             | desktop |   6,174,833 → 6,076,508 | 218 → 216 |         4201.1 → 28017.6 |
| chromosome            | desktop |   6,174,833 → 5,629,824 | 218 → 216 |         3223.6 → 72658.5 |
| mitochondrion         | desktop |   6,174,833 → 6,401,526 | 218 → 264 |         3291.2 → 15049.5 |
| paramecium            | desktop |   6,211,413 → 6,436,346 | 222 → 268 |         3692.9 → 25476.9 |
| amoeba                | desktop |   6,211,413 → 6,436,346 | 222 → 268 |          4408.5 → 8372.9 |
| dna-to-protein        | desktop |   6,787,692 → 6,689,367 | 242 → 240 |         3999.9 → 11967.1 |
| mitosis               | desktop |   6,787,692 → 6,689,367 | 242 → 240 |         3615.0 → 18082.6 |
| apoptosis             | desktop |   6,786,084 → 6,687,759 | 242 → 240 |         3523.6 → 37710.9 |
| phagocytosis          | desktop |   6,786,084 → 6,687,759 | 242 → 240 |         4013.9 → 20649.8 |
| orbital               | desktop |   6,357,532 → 6,259,207 | 232 → 230 |         3990.8 → 79221.1 |
| atom                  | desktop |   6,274,352 → 6,259,207 | 232 → 230 |         8704.8 → 26428.2 |
| molecule              | desktop |   6,385,816 → 6,287,491 | 236 → 234 |         7179.8 → 35755.1 |
| protein               | desktop |   6,464,386 → 6,366,061 | 237 → 235 |         4807.2 → 78754.5 |
| crystal-lattice       | desktop |   6,385,816 → 6,287,491 | 236 → 234 |         4200.7 → 25705.5 |
| unit-cells            | desktop |   6,713,017 → 6,614,692 | 240 → 238 |         3365.0 → 26014.9 |
| orbital-atlas         | desktop |   6,697,687 → 6,340,478 | 240 → 238 |         3903.5 → 29038.1 |
| molecule-viewer       | desktop |   6,997,466 → 6,483,985 | 263 → 261 |         3140.3 → 15760.9 |
| periodic-table        | desktop |   6,165,733 → 6,067,408 | 228 → 226 |         3864.2 → 32688.1 |
| real-elements         | desktop |   7,140,996 → 6,559,027 | 246 → 244 |         7409.4 → 58043.5 |
| diamond               | desktop |   6,204,408 → 6,106,083 | 230 → 228 |         3492.4 → 54175.4 |
| ruby                  | desktop |   6,204,408 → 5,573,713 | 230 → 228 |         3398.1 → 23272.6 |
| emerald               | desktop |   6,204,408 → 6,106,083 | 230 → 228 |         3113.7 → 30899.5 |
| amethyst-geode        | desktop |   6,204,408 → 6,106,083 | 230 → 228 |         3962.5 → 23514.3 |
| sapphire              | desktop |   6,233,672 → 5,579,343 | 234 → 232 |         3573.9 → 75317.1 |
| quartz-cluster        | desktop |   6,233,672 → 5,571,349 | 234 → 232 |         4370.0 → 58281.2 |
| opal                  | desktop |   6,233,672 → 6,135,347 | 234 → 232 |         3216.7 → 41559.5 |
| pearl                 | desktop |   6,233,672 → 4,830,809 | 234 → 232 |         3664.9 → 70761.3 |
| brain                 | desktop |   6,248,270 → 6,149,945 | 238 → 236 |         3894.7 → 38372.7 |
| eye                   | desktop |   6,248,270 → 6,149,945 | 238 → 236 |         3111.8 → 14162.4 |
| lungs                 | desktop |   6,248,270 → 6,149,945 | 238 → 236 |         2939.5 → 56535.4 |
| tooth                 | desktop |   6,233,940 → 5,857,139 | 238 → 236 |        2730.6 → 112091.7 |
| kidney                | desktop |   6,233,940 → 5,168,905 | 238 → 236 |         3956.0 → 69714.8 |
| anatomy-atlas         | desktop |   6,560,089 → 6,442,556 | 239 → 237 |         4856.3 → 48808.0 |
| oak                   | desktop |   6,402,228 → 6,303,903 | 238 → 236 |         3922.5 → 49030.6 |
| pine                  | desktop |   6,402,228 → 5,595,409 | 238 → 236 |         3109.4 → 73721.3 |
| palm                  | desktop |   6,382,326 → 6,715,799 | 238 → 292 |         3180.0 → 40167.8 |
| cherry-blossom        | desktop |   6,382,326 → 6,430,813 | 238 → 292 |         9203.8 → 64989.9 |
| maple                 | desktop |   6,382,326 → 6,284,001 | 238 → 236 |         3998.5 → 47592.3 |
| bonsai                | desktop |   6,382,326 → 6,139,331 | 238 → 236 |         4287.3 → 55204.5 |
| willow                | desktop |   6,365,510 → 6,267,185 | 238 → 236 |         3231.6 → 28070.2 |
| sunflower             | desktop |   6,365,510 → 6,267,185 | 238 → 236 |         3782.8 → 44649.1 |
| rose                  | desktop |   6,365,510 → 6,045,777 | 238 → 236 |         4276.1 → 23716.8 |
| dandelion             | desktop |   6,365,510 → 6,267,185 | 238 → 236 |         3870.5 → 44101.2 |
| tulip                 | desktop |   6,346,032 → 6,247,707 | 238 → 236 |         3763.4 → 12933.0 |
| daisy                 | desktop |   6,346,032 → 6,247,707 | 238 → 236 |         2921.8 → 22222.1 |
| lotus                 | desktop |   6,346,032 → 6,039,351 | 238 → 236 |         2923.1 → 15278.5 |
| mushroom              | desktop |   6,346,032 → 6,247,707 | 238 → 236 |         3502.3 → 11365.7 |
| fern                  | desktop |   6,287,278 → 6,188,953 | 238 → 236 |         3443.7 → 16661.6 |
| saguaro               | desktop |   6,287,278 → 6,188,953 | 238 → 236 |         4405.2 → 15306.6 |
| coral                 | desktop |   6,287,278 → 6,188,953 | 238 → 236 |         4671.5 → 24096.2 |
| pinecone              | desktop |   6,287,278 → 6,188,953 | 238 → 236 |          3004.8 → 8047.0 |
| acorn                 | desktop |   6,290,432 → 6,192,107 | 238 → 236 |          3561.5 → 8456.3 |
| succulent             | desktop |   6,290,432 → 6,192,107 | 238 → 236 |         3555.2 → 10301.6 |
| bamboo                | desktop |   6,290,432 → 6,192,107 | 238 → 236 |         3372.4 → 12458.4 |
| rocks                 | desktop |   6,290,432 → 6,192,107 | 238 → 236 |          3631.4 → 7446.9 |
| kelp                  | desktop |   6,291,414 → 6,193,089 | 238 → 236 |         3726.6 → 18199.4 |
| storm-cloud           | desktop |   6,204,387 → 5,240,210 | 238 → 236 |         3280.3 → 19482.3 |
| lava-lamp             | desktop |   6,204,387 → 6,106,062 | 238 → 236 |         3536.7 → 22618.1 |
| snow-globe            | desktop |   6,210,507 → 5,577,320 | 238 → 236 |         7810.1 → 23556.8 |
| volcano               | desktop |   6,210,507 → 6,112,182 | 238 → 236 |         3171.5 → 11852.9 |
| ice-statue            | desktop |   6,210,507 → 6,112,182 | 238 → 236 |         4469.9 → 18105.8 |
| candle                | desktop |   6,210,507 → 6,112,182 | 238 → 236 |         3894.8 → 35440.4 |
| tornado               | desktop |   6,202,887 → 6,104,562 | 238 → 236 |         3584.7 → 11461.4 |
| rainbow               | desktop |   6,202,887 → 6,104,562 | 238 → 236 |         3130.3 → 16281.0 |
| iceberg               | desktop |   6,202,887 → 6,104,562 | 238 → 236 |         3139.2 → 13031.9 |
| waterfall             | desktop |   6,202,887 → 6,104,562 | 238 → 236 |         4317.3 → 30447.2 |
| ocean-wave            | desktop |   6,189,831 → 6,091,506 | 238 → 236 |         3711.9 → 20952.5 |
| geyser                | desktop |   6,189,831 → 5,609,974 | 238 → 236 |         4987.8 → 99140.9 |
| ice-cream             | desktop |   6,322,810 → 5,567,953 | 238 → 236 |         3859.9 → 19336.4 |
| watermelon            | desktop |   6,322,810 → 6,224,485 | 238 → 236 |         3461.6 → 15824.3 |
| birthday-cake         | desktop |   6,281,320 → 6,206,811 | 238 → 236 |        14741.1 → 18748.5 |
| popcorn               | desktop |   6,305,136 → 6,206,811 | 238 → 236 |        12903.6 → 10164.2 |
| jelly                 | desktop |   6,305,136 → 6,206,811 | 238 → 236 |         6268.7 → 15514.6 |
| pancakes              | desktop |   6,305,136 → 6,206,811 | 238 → 236 |        16729.0 → 15277.0 |
| cupcake               | desktop |   6,331,764 → 6,233,439 | 238 → 236 |         4211.6 → 16040.2 |
| lollipop              | desktop |   6,331,764 → 6,233,439 | 238 → 236 |         3634.3 → 14833.3 |
| candy-cane            | desktop |   6,331,764 → 6,027,995 | 238 → 236 |         4780.6 → 28072.9 |
| macarons              | desktop |   6,331,764 → 6,157,983 | 238 → 236 |         4538.6 → 24334.6 |
| donut                 | desktop |   6,093,646 → 5,995,321 | 237 → 235 |         3193.3 → 14326.0 |
| gummy-bear            | desktop |   6,361,702 → 6,263,377 | 238 → 236 |         3859.5 → 27257.1 |
| pretzel               | desktop |   6,361,702 → 6,263,377 | 238 → 236 |         3301.1 → 18205.6 |
| croissant             | desktop |   6,361,702 → 6,263,377 | 238 → 236 |         3570.8 → 12639.3 |
| pizza                 | desktop |   6,364,526 → 6,266,201 | 238 → 236 |         4026.5 → 18294.6 |
| burger                | desktop |   6,364,526 → 6,266,201 | 238 → 236 |         3851.3 → 11013.0 |
| sushi                 | desktop |   6,364,526 → 6,266,201 | 238 → 236 |          6416.3 → 6519.5 |
| taco                  | desktop |   6,364,526 → 6,266,201 | 238 → 236 |          6531.2 → 5765.4 |
| egg                   | desktop |   6,369,562 → 6,271,237 | 238 → 236 |          3343.9 → 6320.6 |
| coffee                | desktop |   6,369,562 → 6,271,237 | 238 → 236 |          3649.1 → 8759.3 |
| apple                 | desktop |   6,369,562 → 6,092,239 | 238 → 236 |         8334.5 → 26289.0 |
| banana                | desktop |   6,369,562 → 6,271,237 | 238 → 236 |         6191.4 → 14061.0 |
| orange                | desktop |   6,348,540 → 6,250,215 | 238 → 236 |          8951.9 → 7515.9 |
| kiwi                  | desktop |   6,348,540 → 6,250,215 | 238 → 236 |         7986.1 → 19866.1 |
| pineapple             | desktop |   6,348,540 → 6,250,215 | 238 → 236 |         8148.2 → 11006.2 |
| cherries              | desktop |   6,348,540 → 6,250,215 | 238 → 236 |         8356.3 → 16284.3 |
| grapes                | desktop |   6,344,760 → 6,246,435 | 238 → 236 |         4294.3 → 11346.2 |
| avocado               | desktop |   6,344,760 → 6,246,435 | 238 → 236 |          5900.0 → 7622.4 |
| bricks                | desktop |   6,203,321 → 6,104,996 | 238 → 236 |          8677.5 → 7505.3 |
| rubber-duck           | desktop |   6,203,321 → 6,104,996 | 238 → 236 |         19282.0 → 7060.5 |
| spinning-top          | desktop |   6,197,131 → 6,098,806 | 238 → 236 |          5327.3 → 7077.5 |
| dice                  | desktop |   6,197,131 → 6,098,806 | 238 → 236 |          4760.3 → 5310.9 |
| newtons-cradle        | desktop |   6,197,131 → 6,098,806 | 238 → 236 |          3676.6 → 7735.6 |
| teddy-bear            | desktop |   6,197,131 → 6,098,806 | 238 → 236 |         4333.4 → 26587.7 |
| yo-yo                 | desktop |   6,206,789 → 6,108,464 | 238 → 236 |         3280.5 → 32342.2 |
| puzzle-cube           | desktop |   6,206,789 → 6,108,464 | 238 → 236 |          3705.4 → 7092.2 |
| spring-toy            | desktop |   6,206,789 → 6,108,464 | 238 → 236 |          3573.2 → 8493.4 |
| kite                  | desktop |   6,206,789 → 6,108,464 | 238 → 236 |          3637.8 → 6310.9 |
| paper-plane           | desktop |   6,208,833 → 6,110,508 | 238 → 236 |          4368.1 → 7587.9 |
| origami-crane         | desktop |   6,208,833 → 5,860,352 | 238 → 236 |         3680.7 → 12756.4 |
| balloon-dog           | desktop |   6,208,833 → 6,110,508 | 238 → 236 |         3660.9 → 24708.3 |
| soap-bubbles          | desktop |   6,208,833 → 6,110,508 | 238 → 236 |         7003.6 → 28743.6 |
| robot                 | desktop |   6,194,111 → 6,095,786 | 238 → 236 |         4561.0 → 14644.7 |
| chess-set             | desktop |   6,115,354 → 6,017,029 | 239 → 237 |          4960.2 → 9466.0 |
| lorenz                | desktop |   6,384,306 → 6,110,465 | 239 → 237 |         4705.0 → 31851.6 |
| mobius                | desktop |   6,384,306 → 6,285,981 | 239 → 237 |        15831.5 → 14491.8 |
| klein-bottle          | desktop |   6,384,306 → 6,285,981 | 239 → 237 |         5039.3 → 16491.3 |
| menger-sponge         | desktop |   6,386,604 → 6,288,279 | 239 → 237 |         9064.7 → 13190.5 |
| hypercube             | desktop |   6,386,604 → 6,288,279 | 239 → 237 |         6443.4 → 12164.8 |
| torus-knot            | desktop |   6,386,604 → 6,288,279 | 239 → 237 |          4470.6 → 9030.8 |
| gyroid                | desktop |   6,386,604 → 6,288,279 | 239 → 237 |          5196.7 → 9961.8 |
| mandelbulb            | desktop |   6,393,238 → 6,294,913 | 239 → 237 |         3325.3 → 18198.2 |
| sierpinski            | desktop |   6,393,238 → 6,294,913 | 239 → 237 |         2987.2 → 17812.8 |
| platonic              | desktop |   6,393,238 → 6,294,913 | 239 → 237 |         4999.2 → 11946.0 |
| seashell-spiral       | desktop |   6,393,238 → 6,294,913 | 239 → 237 |         4036.7 → 12029.7 |
| graph-plotter         | desktop |   6,399,572 → 6,301,247 | 239 → 237 |         5651.1 → 11134.8 |
| surface-plotter       | desktop |   6,399,572 → 6,301,247 | 239 → 237 |         7352.6 → 28141.8 |
| unit-circle           | desktop |   6,399,572 → 6,301,247 | 239 → 237 |         4122.6 → 13182.0 |
| fourier-circles       | desktop |   6,399,572 → 6,301,247 | 239 → 237 |          3240.3 → 8816.4 |
| pythagoras-proof      | desktop |   6,398,758 → 6,300,433 | 238 → 236 |         12487.7 → 9806.3 |
| rossler-attractor     | desktop |   6,966,416 → 6,868,091 | 239 → 237 |         12733.8 → 6924.4 |
| thomas-attractor      | desktop |   6,966,416 → 6,868,091 | 239 → 237 |        11215.1 → 10716.1 |
| aizawa-attractor      | desktop |   6,966,416 → 6,868,091 | 239 → 237 |         9681.0 → 19303.1 |
| five-cell             | desktop |   6,966,416 → 6,868,091 | 239 → 237 |         4778.7 → 16073.0 |
| sixteen-cell          | desktop |   6,987,548 → 6,889,223 | 239 → 237 |          4898.9 → 8340.9 |
| twenty-four-cell      | desktop |   6,987,548 → 6,889,223 | 239 → 237 |         7440.6 → 14703.9 |
| duoprism              | desktop |   6,987,548 → 6,889,223 | 239 → 237 |         6980.1 → 10934.3 |
| splat-equation        | desktop |   6,672,525 → 6,688,478 | 239 → 237 |          4762.6 → 7391.8 |
| book                  | desktop |   7,628,495 → 8,042,855 | 241 → 241 |          4397.2 → 6915.5 |
| laptop                | desktop |   6,183,766 → 6,085,441 | 238 → 236 |          7605.3 → 7349.3 |
| music-box             | desktop |   6,183,766 → 6,085,441 | 238 → 236 |          5570.7 → 7115.8 |
| clock                 | desktop |   6,183,766 → 6,085,441 | 238 → 236 |          3659.3 → 5736.7 |
| gift-box              | desktop |   6,183,766 → 6,085,441 | 238 → 236 |          2904.5 → 7590.6 |
| umbrella              | desktop |   6,200,096 → 6,101,771 | 238 → 236 |         3612.1 → 12269.2 |
| desk-fan              | desktop |   6,200,096 → 6,101,771 | 238 → 236 |          2960.1 → 6700.5 |
| lamp                  | desktop |   6,200,096 → 6,101,771 | 238 → 236 |          4848.1 → 4844.6 |
| potion-bottle         | desktop |   6,200,096 → 6,101,771 | 238 → 236 |          5405.6 → 6441.0 |
| telescope             | desktop |   6,220,264 → 6,121,939 | 238 → 236 |          3913.3 → 4268.4 |
| fountain-pen          | desktop |   9,972,940 → 9,968,061 | 238 → 238 |          4485.3 → 5269.7 |
| water-bottle          | desktop |   9,933,206 → 9,928,327 | 238 → 238 |          3529.3 → 7082.6 |
| soda-can              | desktop | 10,199,120 → 10,194,241 | 238 → 238 |         11580.5 → 5252.9 |
| running-shoe          | desktop |   9,973,136 → 9,968,257 | 238 → 238 |         9829.0 → 14176.3 |
| hoodie                | desktop |   9,972,730 → 9,967,851 | 238 → 238 |          4428.1 → 6089.6 |
| sunglasses            | desktop |   9,963,662 → 9,958,783 | 238 → 238 |          3918.2 → 9032.1 |
| baseball-cap          | desktop |   9,963,900 → 9,959,021 | 238 → 238 |         3883.2 → 17283.1 |
| sword-in-stone        | desktop |   6,192,211 → 6,093,886 | 238 → 236 |         4017.1 → 10568.4 |
| shield                | desktop |   6,192,211 → 6,093,886 | 238 → 236 |         4223.1 → 11724.6 |
| bow-and-target        | desktop |   6,187,655 → 6,089,330 | 238 → 236 |         3242.1 → 13541.8 |
| trebuchet             | desktop |   6,187,655 → 6,089,330 | 238 → 236 |          5099.0 → 6039.7 |
| crossbow              | desktop |   6,187,655 → 6,089,330 | 238 → 236 |          8585.3 → 6861.6 |
| knights-helmet        | desktop |   6,187,655 → 6,089,330 | 238 → 236 |          7683.9 → 7469.8 |
| crown                 | desktop |   6,196,973 → 6,098,648 | 238 → 236 |          4708.9 → 6999.2 |
| dragon-egg            | desktop |   6,196,973 → 6,098,648 | 238 → 236 |          3627.5 → 8865.4 |
| wizards-orb           | desktop |   6,196,973 → 5,616,332 | 238 → 236 |         8688.6 → 10432.8 |
| crystal-ball          | desktop |   6,174,462 → 6,076,137 | 238 → 236 |         6882.7 → 17959.8 |
| jellyfish             | desktop |   6,206,949 → 6,108,624 | 238 → 236 |          8193.3 → 6043.0 |
| fish-school           | desktop |   6,206,949 → 6,108,624 | 238 → 236 |          3930.0 → 5382.7 |
| butterfly             | desktop |   6,206,949 → 6,108,624 | 238 → 236 |         3712.2 → 10729.1 |
| pufferfish            | desktop |   6,206,949 → 6,108,624 | 238 → 236 |         4193.8 → 18826.2 |
| nautilus              | desktop |   6,218,327 → 6,120,002 | 238 → 236 |          4417.8 → 8338.6 |
| ladybug               | desktop |   6,218,327 → 6,120,002 | 238 → 236 |          3889.0 → 9582.5 |
| snail                 | desktop |   6,218,327 → 6,120,002 | 238 → 236 |          3941.2 → 6035.3 |
| octopus               | desktop |   6,218,327 → 6,120,002 | 238 → 236 |          3688.5 → 6887.2 |
| starfish              | desktop |   6,229,521 → 6,131,196 | 238 → 236 |         3932.8 → 10394.8 |
| sea-urchin            | desktop |   6,229,521 → 6,131,196 | 238 → 236 |         3407.4 → 15446.9 |
| frog                  | desktop |   6,229,521 → 6,131,196 | 238 → 236 |          6260.7 → 7720.4 |
| penguin               | desktop |   6,229,521 → 6,131,196 | 238 → 236 |          4909.5 → 7411.6 |
| owl                   | desktop |   6,248,955 → 6,150,630 | 238 → 236 |         5259.3 → 16372.4 |
| jack-o-lantern        | desktop |   6,115,407 → 6,017,082 | 221 → 219 |          5774.5 → 9915.8 |
| snowman               | desktop |   6,115,407 → 6,017,082 | 221 → 219 |          4939.5 → 6857.1 |
| fireworks             | desktop |   6,115,407 → 6,017,082 | 221 → 219 |         4398.6 → 11676.0 |
| decorated-tree        | desktop |   6,090,271 → 5,991,946 | 217 → 215 |          4564.1 → 8176.0 |
| patterned-egg         | desktop |   6,090,271 → 5,991,946 | 217 → 215 |         4520.2 → 12085.2 |
| paper-lantern         | desktop |   6,090,271 → 5,991,946 | 217 → 215 |          4183.4 → 7634.6 |
| diya                  | desktop |   6,090,271 → 5,991,946 | 217 → 215 |        11489.2 → 12991.7 |
| menorah               | desktop |   6,044,653 → 5,946,328 | 213 → 211 |         5728.5 → 11968.1 |
| guitar                | desktop |   6,024,942 → 5,926,617 | 214 → 212 |         7832.7 → 11646.4 |
| drum                  | desktop |   6,024,942 → 5,926,617 | 214 → 212 |         7052.5 → 12869.4 |
| xylophone             | desktop |   6,024,942 → 5,926,617 | 214 → 212 |         5655.5 → 14965.7 |
| toy-piano             | desktop |   5,977,222 → 5,878,897 | 210 → 208 |         4836.2 → 10510.0 |
| grand-piano           | desktop |   6,045,562 → 5,947,237 | 211 → 209 |         5342.4 → 10733.4 |
| upright-piano         | desktop |   6,045,562 → 5,947,237 | 211 → 209 |         6325.5 → 10180.3 |
| harpsichord           | desktop |   6,045,562 → 5,947,237 | 211 → 209 |         9555.3 → 12630.0 |
| electronic-keyboard   | desktop |   6,024,000 → 5,925,675 | 207 → 205 |         7145.5 → 15312.4 |
| rocket                | desktop |   6,026,423 → 5,928,098 | 205 → 203 |          7096.1 → 8036.6 |
| helicopter            | desktop |   6,026,423 → 5,928,098 | 205 → 203 |          6804.6 → 7357.5 |
| hot-air-balloon       | desktop |   6,026,423 → 5,928,098 | 205 → 203 |          4192.9 → 6319.4 |
| steam-train           | desktop |   6,000,171 → 5,901,846 | 201 → 199 |          5884.4 → 7022.0 |
| ocean-liner           | desktop |   6,000,171 → 5,901,846 | 201 → 199 |          6337.9 → 6792.0 |
| sports-car            | desktop |   6,000,171 → 5,901,846 | 201 → 199 |          5084.9 → 6534.5 |
| bus                   | desktop |   6,000,171 → 5,901,846 | 201 → 199 |          6120.3 → 7541.6 |
| propeller-plane       | desktop |   5,966,335 → 5,868,010 | 197 → 195 |          4608.0 → 5698.1 |
| jet                   | desktop |   5,966,335 → 5,868,010 | 197 → 195 |          3792.5 → 6578.8 |
| sailboat              | desktop |   5,966,335 → 5,868,010 | 197 → 195 |         14944.3 → 8410.6 |
| submarine             | desktop |   5,966,335 → 5,868,010 | 197 → 195 |         12307.4 → 7408.6 |
| bicycle               | desktop |   5,930,249 → 5,831,924 | 193 → 191 |          4982.1 → 5768.5 |
| tractor               | desktop |   5,930,249 → 5,831,924 | 193 → 191 |         5640.2 → 26120.3 |
| ufo                   | desktop |   5,930,249 → 5,831,924 | 193 → 191 |          3440.2 → 5043.2 |
| eiffel-tower          | desktop |   5,978,640 → 5,880,315 | 193 → 191 |          4809.0 → 4881.1 |
| washington-monument   | desktop |   5,940,872 → 5,842,547 | 189 → 187 |          8556.8 → 5690.3 |
| pyramids              | desktop |   5,940,872 → 5,842,547 | 189 → 187 |          8530.2 → 5454.4 |
| supertall             | desktop |   5,940,872 → 5,842,547 | 189 → 187 |          4857.2 → 6030.4 |
| lighthouse            | desktop |   5,940,872 → 5,842,547 | 189 → 187 |          5371.3 → 7340.3 |
| statue-of-liberty     | desktop |   5,886,092 → 5,787,767 | 185 → 183 |          5103.4 → 7484.2 |
| white-house           | desktop |   5,886,092 → 5,787,767 | 185 → 183 |          4894.2 → 7674.2 |
| leaning-tower         | desktop |   5,886,092 → 5,787,767 | 185 → 183 |          5516.3 → 5888.1 |
| colosseum             | desktop |   5,886,092 → 5,787,767 | 185 → 183 |          3717.1 → 5418.3 |
| parthenon             | desktop |   5,851,062 → 5,752,737 | 181 → 179 |          5702.4 → 6242.6 |
| stonehenge            | desktop |   5,851,062 → 5,752,737 | 181 → 179 |         5492.9 → 44666.3 |
| big-ben               | desktop |   5,851,062 → 5,752,737 | 181 → 179 |          4586.7 → 6528.6 |
| taj-mahal             | desktop |   5,851,062 → 5,752,737 | 181 → 179 |          3708.4 → 4495.5 |
| castle                | desktop |   5,851,062 → 5,752,737 | 181 → 179 |          4775.3 → 5261.6 |
| pagoda                | desktop |   5,851,062 → 5,752,737 | 181 → 179 |          4210.6 → 4697.2 |
| windmill              | desktop |   5,851,062 → 5,752,737 | 181 → 179 |          6812.0 → 4732.0 |
| perceptron            | desktop |   6,348,357 → 6,250,032 | 238 → 236 |         5387.9 → 14282.6 |
| multilayer-perceptron | desktop |   6,348,357 → 6,250,032 | 238 → 236 |         5069.1 → 37055.5 |
| neural-network        | desktop |   6,348,357 → 6,250,032 | 238 → 236 |          4725.4 → 6707.6 |
| cnn                   | desktop |   6,317,037 → 6,218,712 | 234 → 232 |          4582.1 → 5700.2 |
| rnn                   | desktop |   6,317,037 → 6,218,712 | 234 → 232 |          4321.6 → 4956.6 |
| transformer           | desktop |   6,317,037 → 6,218,712 | 234 → 232 |          5303.1 → 5602.5 |
| looped-transformer    | desktop |   6,317,037 → 6,218,712 | 234 → 232 |         4155.8 → 15232.8 |
| diffusion-model       | desktop |   6,282,217 → 6,183,892 | 230 → 228 |         4187.7 → 20569.6 |
| gradient-descent      | desktop |   6,282,217 → 6,183,892 | 230 → 228 |          4886.5 → 4948.5 |
| gaussian-splatting    | desktop |   7,002,556 → 6,904,231 | 244 → 242 |          8353.5 → 7932.2 |
| word-vectors          | desktop |   8,065,670 → 7,967,345 | 231 → 229 |          4498.0 → 4284.5 |
| sorting-machine       | desktop |   6,282,217 → 6,183,892 | 230 → 228 |          3849.3 → 3960.9 |
| half-adder            | desktop |   6,261,435 → 6,163,110 | 226 → 224 |          3957.4 → 4492.2 |
| turing-machine        | desktop |   6,196,996 → 6,098,671 | 226 → 224 |          4339.6 → 5190.8 |
| difference-engine     | desktop |   6,196,996 → 6,098,671 | 226 → 224 |          4531.2 → 6137.2 |
| enigma-machine        | desktop |   6,196,996 → 6,098,671 | 226 → 224 |         4893.9 → 13510.5 |
| bombe                 | desktop |   6,171,386 → 6,073,061 | 222 → 220 |         5071.7 → 22958.7 |
| picture-lab           | desktop |   8,973,239 → 8,874,914 | 241 → 239 |          4965.2 → 4147.1 |
| your-book             | desktop | 16,157,052 → 16,058,727 | 242 → 240 |         10070.5 → 6192.8 |
| photo-album           | desktop |   7,640,372 → 7,542,047 | 246 → 244 |          4504.1 → 4903.2 |
| picture-frame         | desktop |   7,171,037 → 7,072,712 | 241 → 239 |          3135.8 → 2977.6 |
| song-landscape        | desktop |   8,129,786 → 8,031,461 | 253 → 251 |          3983.6 → 3539.6 |
| chladni-plate         | desktop |   7,243,809 → 7,145,484 | 249 → 247 |          3357.5 → 3919.4 |
| chladni-cell          | desktop |   7,270,851 → 7,172,526 | 249 → 247 |          4344.3 → 3102.6 |
| room-echo             | desktop |   7,241,022 → 7,142,697 | 247 → 245 |          4156.6 → 4867.4 |
| splat-mirror          | desktop |   8,124,957 → 8,026,632 | 249 → 247 |          4933.0 → 3130.5 |
| model-splats          | desktop |   7,101,632 → 7,003,307 | 240 → 238 |          5393.5 → 8210.6 |
| qr-code               | desktop |   7,165,624 → 7,067,299 | 246 → 244 |          3699.5 → 4124.9 |
| qr-anatomy            | desktop |   7,115,856 → 7,017,531 | 245 → 243 |          3084.3 → 2932.8 |
| qr-damage             | desktop |   7,372,741 → 7,274,416 | 246 → 244 |          3613.7 → 4575.5 |
| qr-three              | desktop |   7,115,856 → 7,017,531 | 245 → 243 |          4653.8 → 4467.3 |
| qr-picture            | desktop |   7,637,756 → 7,539,431 | 249 → 247 |         14663.3 → 7545.0 |
| qr-build              | desktop |   7,393,479 → 7,295,154 | 248 → 246 |          3780.0 → 3718.5 |
| barcodes              | desktop |   7,472,602 → 7,374,277 | 248 → 246 |          4946.1 → 3558.8 |
| photo-3d              | desktop |   8,031,576 → 7,933,251 | 246 → 244 |         5223.6 → 10477.5 |
| moving-photo-3d       | desktop | 10,745,196 → 10,646,871 | 262 → 260 |        11700.9 → 13535.7 |
| video-3d              | desktop | 14,903,543 → 14,805,218 | 245 → 243 |          4030.9 → 5313.0 |
| sound-lab             | desktop |   7,027,033 → 6,928,708 | 242 → 240 |         4557.5 → 24922.3 |
| sound-recorder        | desktop |   7,027,033 → 6,928,708 | 242 → 240 |          7429.0 → 5338.0 |
| splat-toolkit         | desktop | 13,323,124 → 13,224,799 | 252 → 250 |        10830.4 → 11307.9 |
| point-clouds          | desktop | 10,913,903 → 10,815,578 | 252 → 250 |        10797.0 → 14200.1 |
| volume-viewer         | desktop |   7,517,849 → 7,419,524 | 241 → 239 |          5145.7 → 6650.0 |
| splat-field           | desktop |   6,948,053 → 6,849,728 | 238 → 236 |          3446.4 → 4220.4 |
| light-lab             | desktop |   6,999,254 → 6,900,929 | 241 → 239 |          2605.3 → 4439.2 |
| baked-chest           | desktop |   8,348,973 → 8,250,648 | 242 → 240 |          3119.4 → 7096.5 |
| thermal-ellipsoids    | desktop |   7,228,052 → 7,129,727 | 252 → 250 |          4495.5 → 6945.0 |
| smlm-microscope       | desktop |   9,582,113 → 9,483,788 | 252 → 250 |          3633.4 → 6343.4 |
| galaxy-box            | desktop | 10,219,266 → 10,120,941 | 252 → 250 |          6692.6 → 5470.3 |
| cryoem-map            | desktop |   8,137,058 → 8,038,733 | 253 → 251 |          4650.4 → 6456.9 |
| contour-lab           | desktop |   7,316,572 → 7,218,247 | 252 → 250 |          6870.0 → 4551.5 |
| terrain-box           | desktop |   7,316,572 → 7,218,247 | 252 → 250 |          5382.9 → 6048.3 |
| ripple-tank           | desktop |   6,963,909 → 6,865,584 | 241 → 239 |         3087.1 → 19072.1 |
| light-bench           | desktop |   6,963,909 → 6,865,584 | 241 → 239 |          2273.6 → 5583.4 |
| fluid-lab             | desktop |   7,077,978 → 6,979,653 | 244 → 242 |          2614.9 → 4951.1 |
| grand-canyon          | desktop |   7,872,748 → 7,774,423 | 236 → 234 |          3821.8 → 9822.1 |
| st-helens             | desktop |   8,082,241 → 7,983,916 | 232 → 230 |          3757.2 → 7127.3 |
| sea-floor             | desktop |   7,244,844 → 7,146,519 | 231 → 229 |          3856.2 → 7692.6 |
| tide-harbor           | desktop |   7,473,504 → 7,375,179 | 232 → 230 |          3766.8 → 7425.2 |
| hurricane             | desktop |   7,159,892 → 7,061,567 | 232 → 230 |          3329.4 → 5269.9 |
| relief-map            | desktop |   7,059,655 → 6,961,330 | 227 → 225 |        15122.2 → 18710.4 |
| living-city           | desktop | 12,139,426 → 12,041,101 | 227 → 225 |          6143.9 → 9876.7 |
| stork-migration       | desktop |   7,317,709 → 7,219,384 | 228 → 226 |          5002.4 → 5715.1 |
| earthquakes           | desktop |   7,390,732 → 7,292,407 | 229 → 227 |         3647.5 → 12783.7 |
| airport-xray          | desktop |   6,926,844 → 6,828,519 | 236 → 234 |         3835.4 → 10372.6 |
| how-ct                | desktop |   6,926,844 → 6,828,519 | 236 → 234 |          3567.3 → 8100.4 |
| walnut-ct             | desktop |   7,428,477 → 7,330,152 | 237 → 235 |          3639.4 → 8372.7 |
| fruit-mri             | desktop |   6,881,358 → 6,783,033 | 232 → 230 |          3266.5 → 6527.1 |
| electron-microscope   | desktop |   6,881,358 → 6,783,033 | 232 → 230 |          5992.3 → 5508.0 |
| thermal-camera        | desktop |   6,881,358 → 6,783,033 | 232 → 230 |          8775.2 → 9544.7 |
| screen                | desktop |   7,750,307 → 7,274,013 | 242 → 240 |          4243.2 → 8322.0 |
| shardball             | desktop |   7,087,436 → 6,989,111 | 244 → 242 |          2998.5 → 3304.0 |
| longtail              | desktop |   7,031,558 → 6,933,233 | 244 → 241 |          2360.2 → 2963.0 |
| grain-garden          | desktop |   7,068,212 → 6,969,887 | 244 → 242 |          3715.8 → 3050.0 |
| page-breaker          | desktop |   7,685,582 → 8,904,291 | 248 → 246 |          4010.7 → 2600.1 |
| strata                | desktop |   7,073,921 → 6,975,596 | 244 → 242 |          2769.0 → 3265.6 |
| volley-table          | desktop |   7,038,484 → 6,962,946 | 242 → 242 |          7551.1 → 2718.7 |
| stone-belt            | desktop |   7,490,398 → 7,392,073 | 245 → 243 |          4266.6 → 2967.0 |
| soft-landing          | desktop |   7,556,013 → 7,457,688 | 245 → 243 |          4172.6 → 4566.0 |
| night-owl-pinball     | desktop |   7,065,832 → 6,967,507 | 244 → 242 |          2500.3 → 3371.3 |
| cast-a-shadow         | desktop |   7,065,296 → 6,966,971 | 244 → 242 |          2237.0 → 4341.8 |
| photo-dash            | desktop |   7,643,345 → 7,545,020 | 246 → 244 |         1997.3 → 28866.5 |
| note-rider            | desktop |   7,102,973 → 7,004,648 | 245 → 243 |          2321.5 → 4269.3 |
| night-sky             | desktop |   6,990,751 → 6,892,426 | 241 → 239 |          3540.0 → 4720.7 |
| data-in-3d            | desktop |   7,064,728 → 6,539,827 | 246 → 244 |          2281.3 → 7513.5 |
| climate-records       | desktop |   6,950,291 → 6,851,966 | 244 → 242 |          4070.4 → 7860.5 |

</details>

Rule check: prior unpublished email-metadata history rewrite conflicts with E1; the review changes
use additive commits and do not rewrite published history.

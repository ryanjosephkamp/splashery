# Load-time audit — October 13, 2026

Codex built these changes and this audit on `codex/load-time`.

- Frozen main: `49c809b4ee798f9011ad3f223ecb2e6021caec65`.
- Measured runtime source: `2c229dbd95774b00c2ee7f6e182d4a4c3371dea0`; later commits add audit
  evidence and tests and integrate newer main.
- Coverage: 319 public and 143 labs toys, at both task 06 settings.
- Five recipes transfer only the exact scan records their low or mid budget uses; their original
  population count and rendered buffers are preserved.
- Unrelated toys defer Real objects helpers; GIF encoding loads only for a GIF export.
- The celestial globe transfers exact used records and exact full-scan smoothing means in a gzip
  file on the low tier, avoiding the unused neighbors' transfer and repeated averaging.
- All 40 before/after image pairs have zero changed RGBA pixels; every tap capture also differs from
  its rest pose.
- The 25% target for the 20 heaviest phone openings: 1/20 meet it. Not met.
- Combined opening bytes for that same top 20: 195,425,658 → 191,345,809 (2.1% saving).
- Single-run timing screening flags 627 cells above a 10% plus 100 ms increase; it does not
  establish the no-slower-first-frame target.
- 0 cells have readiness or console errors; details remain in the raw matrix.

## What changed and why it stays identical

The opening files copy each used 14-byte ROS1 record without quantization, reordering, recoloring,
or changing the recipe budget. ROP1 retains the original population count for the same `sqrt(n / m)`
size adjustment and stores a separate loaded capacity. The full scans remain available for larger
budgets, saved scenes, and existing tools. Running shoe needs its complete scan for color smoothing;
hoodie uses its tail to close holes, so both keep full files.

Low budgets use up to 90,000 recipe splats; mid budgets use up to 210,000. Each file retains only
the recipe's used share. Unknown or larger budgets use the full scan. The cache retains the largest
completed capacity so concurrent players and later detail increases remain safe.

The decoder, complete render-buffer equality at both budgets, low-to-high reloads, real browser
requests, and a scheduled concurrent-read regression are covered by `tests/load-time*.spec.mjs`.
`prefixes.json` records original and derived hashes, inherited source credits, and exact
decoded-array equality. The two deferred imports change loading order, with the same functions and
data at use time.

The celestial globe's low-tier file is 1,744,127 bytes instead of 4,137,814. ROP2 retains the
original records and population, plus the full scan's per-cell mean colors as Float64 values. The
same smoothing expression consumes those exact doubles.
[smoothing-prefix.json](load-time-2026-10/smoothing-prefix.json) records the hashes and source
credit. Native gzip decompression handles the file; a body already decoded by HTTP is accepted, and
browsers without the API use the original full scan. Mid and higher tiers keep the full scan.

| Toy          | Recipe budget | Full bytes | Opening bytes | Saving | Original population | Loaded records |
| ------------ | ------------: | ---------: | ------------: | -----: | ------------------: | -------------: |
| water-bottle |        90,000 |  3,619,114 |     1,008,048 |  72.1% |             258,505 |         72,000 |
| water-bottle |       210,000 |  3,619,114 |     2,352,048 |  35.0% |             258,505 |        168,000 |
| sunglasses   |        90,000 |  3,861,706 |       982,848 |  74.5% |             275,833 |         70,200 |
| sunglasses   |       210,000 |  3,861,706 |     2,293,248 |  40.6% |             275,833 |        163,800 |
| baseball-cap |        90,000 |  3,861,944 |       982,848 |  74.6% |             275,850 |         70,200 |
| baseball-cap |       210,000 |  3,861,944 |     2,293,248 |  40.6% |             275,850 |        163,800 |
| fountain-pen |        90,000 |  3,861,664 |       945,048 |  75.5% |             275,830 |         67,500 |
| fountain-pen |       210,000 |  3,861,664 |     2,205,048 |  42.9% |             275,830 |        157,500 |
| soda-can     |        90,000 |  3,862,924 |       882,034 |  77.2% |             275,920 |         62,999 |
| soda-can     |       210,000 |  3,862,924 |     2,058,048 |  46.7% |             275,920 |        147,000 |

The files preserve each full scan's source, author, and license, as recorded in
`tools/ro-sources.mjs`, `CREDITS.md`, and its recipe. The new hashes and transformation are in
[prefixes.json](load-time-2026-10/prefixes.json). No original asset, scene schema, PlayCanvas
version, or protected PR file was changed. The existing authors and license links were checked again
on their live source pages on October 13, 2026;
[source-pages.json](load-time-2026-10/source-pages.json) records those checks. The globe retains its
CC0 record from `tools/models.json`.

## The 20 heaviest phone openings

Ranked by the frozen main's measured opening body bytes. Exact opening data helps six recipes. Many
other captures use the existing SOG compression, and shared loading changes overlap protected PR
files. The target is not claimed as complete.

| Toy                 | Before bytes | After bytes | Saving | Before requests | After requests | Before first frame ms | After first frame ms |
| ------------------- | -----------: | ----------: | -----: | --------------: | -------------: | --------------------: | -------------------: |
| your-book           |   14,364,458 |  14,266,133 |   0.7% |              99 |             97 |                2162.4 |               2001.6 |
| video-3d            |   13,221,299 |  13,122,974 |   0.7% |             102 |            100 |                1925.5 |               2153.1 |
| splat-toolkit       |   11,636,644 |  11,538,319 |   0.8% |             109 |            107 |                6443.9 |               7514.0 |
| living-city         |   10,560,288 |  10,461,963 |   0.9% |              98 |             96 |                2264.5 |               5922.0 |
| powers-of-ten       |    9,372,146 |   9,273,821 |   1.0% |             102 |            100 |                4111.3 |               2668.1 |
| point-clouds        |    9,223,395 |   9,125,070 |   1.1% |             109 |            107 |                4859.5 |               4120.5 |
| celestial-globe     |    9,184,544 |   6,785,978 |  26.1% |              95 |             95 |                1652.7 |               2767.4 |
| stannern-meteorites |    9,150,662 |   9,145,783 |   0.1% |              95 |             95 |                1551.0 |              11517.5 |
| crochet-earth       |    9,144,010 |   9,045,685 |   1.1% |              95 |             93 |                2093.0 |               4728.4 |
| seeded-loaf         |    9,105,749 |   9,007,424 |   1.1% |              90 |             88 |                1800.0 |               5475.1 |
| dog-plush           |    9,102,308 |   9,003,983 |   1.1% |              95 |             93 |                2135.1 |               4476.7 |
| alum-crystal        |    9,078,704 |   8,980,379 |   1.1% |              95 |             93 |                2077.8 |               3041.6 |
| mushroom-photo      |    9,077,537 |   8,979,212 |   1.1% |              95 |             93 |                3373.3 |               5487.3 |
| moving-photo-3d     |    9,056,706 |   8,958,381 |   1.1% |             119 |            117 |                7136.7 |               6610.6 |
| turtle-souvenir     |    9,052,367 |   8,954,042 |   1.1% |              95 |             93 |                2114.8 |               2493.3 |
| armillary-sphere    |    9,039,988 |   9,035,109 |   0.1% |              95 |             95 |                1678.1 |               3042.3 |
| murex-shell         |    9,031,556 |   8,933,231 |   1.1% |              95 |             93 |                1385.3 |               2700.9 |
| maple-tree          |    9,015,497 |   8,917,172 |   1.1% |              95 |             93 |                2240.4 |               5122.1 |
| cave-lioness        |    9,007,837 |   8,909,512 |   1.1% |              95 |             93 |                1977.1 |               4374.5 |
| toy-trex            |    8,999,963 |   8,901,638 |   1.1% |              95 |             93 |                2191.1 |               5304.9 |

Phone size guidance (D4), using decimal MB: 0 candidate openings exceed 15 MB; 0 observed response
bodies exceed 20 MB. These are existing-size observations, not new file limits.

## Focused timing reruns

Fresh contexts and disabled HTTP cache, with before/after phase order alternating on each pass. This
covers changed scan paths, the deferred museum helpers, a capture control, and selected screening
increases. Median and observed range are milliseconds. 5 complete observations per setting reduce
single-run noise; this subset still does not establish a no-slower result for every toy.

| Toy             | Setting | Samples before / after |   Before median (range) |     After median (range) | Median change |
| --------------- | ------- | ---------------------: | ----------------------: | -----------------------: | ------------: |
| cactus          | phone   |                  5 / 5 |  3566.2 (3188.4–4796.2) |   3057.3 (2625.7–3403.7) |        -14.3% |
| tomatoes        | phone   |                  5 / 5 |  3274.1 (2906.9–4552.9) |   3162.1 (2631.9–6534.2) |         -3.4% |
| mandeltorus     | phone   |                  5 / 5 |  2626.8 (2531.7–2738.9) |   2420.9 (2279.9–5415.9) |         -7.8% |
| basket          | phone   |                  5 / 5 |  3012.8 (2802.6–3643.6) |   2551.7 (2303.9–3347.6) |        -15.3% |
| heart-donut     | phone   |                  5 / 5 |  3177.5 (2739.7–3299.8) |   2583.1 (2127.2–4100.8) |        -18.7% |
| sushi-boat      | phone   |                  5 / 5 |  3040.1 (2803.5–5771.8) |   2788.3 (2468.8–3392.9) |         -8.3% |
| seeded-loaf     | phone   |                  5 / 5 |  3408.3 (2421.4–8063.5) |   2631.7 (2527.6–3313.7) |        -22.8% |
| dog-plush       | phone   |                  5 / 5 | 4145.7 (2811.7–15302.1) |  2738.2 (2421.6–10307.7) |        -34.0% |
| celestial-globe | phone   |                  5 / 5 | 3519.0 (2270.1–21404.7) |   2860.0 (2475.4–9013.0) |        -18.7% |
| pyrite-cubes    | phone   |                  5 / 5 |  3623.4 (2978.0–4792.0) |  8304.9 (2239.7–12532.4) |        129.2% |
| asteroid        | phone   |                  5 / 5 |  3699.2 (3196.7–4379.3) |   3634.6 (2063.0–7344.7) |         -1.7% |
| black-hole      | phone   |                  5 / 5 |  2529.4 (2210.1–9163.5) |   2828.6 (2299.2–5121.6) |         11.8% |
| fountain-pen    | phone   |                  5 / 5 |  2411.2 (1796.9–5365.4) |   2410.6 (1834.3–3184.1) |         -0.0% |
| water-bottle    | phone   |                  5 / 5 |  2999.0 (2406.4–3109.4) |   2753.8 (2422.8–5218.9) |         -8.2% |
| soda-can        | phone   |                  5 / 5 |  2605.1 (2129.0–3190.1) |   3638.4 (2150.2–6416.8) |         39.7% |
| sunglasses      | phone   |                  5 / 5 |  2333.4 (2094.7–3735.6) |   4112.0 (1898.1–6159.6) |         76.2% |
| baseball-cap    | phone   |                  5 / 5 | 2822.7 (2054.0–17803.5) |   2919.2 (2092.9–3048.2) |          3.4% |
| cactus          | desktop |                  5 / 5 |  5485.6 (3704.1–8238.2) |  5372.3 (4315.7–10696.4) |         -2.1% |
| tomatoes        | desktop |                  5 / 5 | 5158.3 (4687.3–19132.2) |   4224.7 (3596.2–7873.1) |        -18.1% |
| mandeltorus     | desktop |                  5 / 5 |  3694.4 (3519.6–9525.9) |   3671.2 (2906.6–6786.7) |         -0.6% |
| basket          | desktop |                  5 / 5 | 5512.3 (3202.8–17536.3) |  4089.2 (3036.7–13471.7) |        -25.8% |
| heart-donut     | desktop |                  5 / 5 | 4056.0 (3111.5–12905.6) |  9749.9 (2925.9–18235.9) |        140.4% |
| sushi-boat      | desktop |                  5 / 5 | 4526.2 (2846.6–10047.5) |  7236.3 (3097.0–12468.6) |         59.9% |
| seeded-loaf     | desktop |                  5 / 5 | 4436.8 (3395.3–10923.1) | 14150.7 (3680.1–37357.7) |        218.9% |
| dog-plush       | desktop |                  5 / 5 | 6903.6 (3808.0–40432.6) |  9016.7 (4024.5–13552.9) |         30.6% |
| celestial-globe | desktop |                  5 / 5 | 4588.2 (3910.9–11868.2) |   4489.2 (3868.8–5537.2) |         -2.2% |
| pyrite-cubes    | desktop |                  5 / 5 |  5440.4 (3799.2–6792.9) |   5361.0 (4114.2–8333.3) |         -1.5% |
| asteroid        | desktop |                  5 / 5 |  5416.8 (4023.8–6234.5) |   5518.8 (4133.6–6638.1) |          1.9% |
| black-hole      | desktop |                  5 / 5 |  4031.4 (3108.2–4863.3) |   4806.9 (3499.4–6580.4) |         19.2% |
| fountain-pen    | desktop |                  5 / 5 |  4270.7 (3048.3–5509.0) |  6125.4 (2979.1–21815.0) |         43.4% |
| water-bottle    | desktop |                  5 / 5 |  4087.3 (3967.7–4967.4) |   4131.3 (3807.7–5085.1) |          1.1% |
| soda-can        | desktop |                  5 / 5 |  3719.8 (2929.8–5807.9) |   4657.9 (3903.3–5060.5) |         25.2% |
| sunglasses      | desktop |                  5 / 5 |  3727.5 (3238.9–5981.5) |  4469.6 (3598.1–18489.2) |         19.9% |
| baseball-cap    | desktop |                  5 / 5 |  4353.0 (2988.1–5619.3) |   3712.8 (3136.1–4538.8) |        -14.7% |

Observed increases remain a review risk: phone Pyrite 3623.4 → 8304.9 ms (+129.2%), Soda can 2605.1
→ 3638.4 ms (+39.7%), and Sunglasses 2333.4 → 4112.0 ms (+76.2%); desktop Fountain pen 4270.7 →
6125.4 ms (+43.4%), Soda can 3719.8 → 4657.9 ms (+25.2%), and Sunglasses 3727.5 → 4469.6 ms
(+19.9%). The no-slower-first-frame target is not established. These repeated increases should not
be dismissed as noise; attribution remains unresolved.

The deferred museum import creates a serialized dependency before scan fetching. In the five
candidate phone Pyrite observations, helper-request start to scan-request start ranges from 30 to
426 ms, with a 254 ms median, including scheduling delays. That interval does not isolate import
overhead or explain the full first-frame increase. In sample 3, unchanged PlayCanvas takes 902–4,520
ms to transfer and the helper request starts at 10,675 ms. Candidate sample 4 is faster than
baseline, desktop Pyrite improves slightly, and the unrelated desktop Seeded loaf median also
increases by 219%. A stable environment and an isolated import comparison are needed before making a
causal timing claim. Overlapping museum scan fetching with helper loading is a possible follow-up,
requiring its own validation and measurements.

## Every public toy

Bytes and requests are opening observations; time is navigation to the first ready submitted render.
Values show before → after.

| Toy / ID                                        | Setting |              Body bytes |  Requests |    First frame ms |
| ----------------------------------------------- | ------- | ----------------------: | --------: | ----------------: |
| Baseball cap (`baseball-cap`)                   | phone   |   8,895,638 → 6,011,663 |   95 → 95 |   2318.9 → 2204.3 |
| Baseball cap (`baseball-cap`)                   | desktop |   9,963,900 → 9,959,021 | 238 → 238 |  3883.2 → 17283.1 |
| Sunglasses (`sunglasses`)                       | phone   |   8,883,574 → 5,999,837 |   95 → 95 |   2043.0 → 3218.3 |
| Sunglasses (`sunglasses`)                       | desktop |   9,963,662 → 9,958,783 | 238 → 238 |   3918.2 → 9032.1 |
| Hoodie (`hoodie`)                               | phone   |   8,874,084 → 8,869,205 |   95 → 95 |   2892.5 → 6613.7 |
| Hoodie (`hoodie`)                               | desktop |   9,972,730 → 9,967,851 | 238 → 238 |   4428.1 → 6089.6 |
| Running shoe (`running-shoe`)                   | phone   |   8,873,600 → 8,868,721 |   95 → 95 |   2604.7 → 3478.9 |
| Running shoe (`running-shoe`)                   | desktop |   9,973,136 → 9,968,257 | 238 → 238 |  9829.0 → 14176.3 |
| Fountain pen (`fountain-pen`)                   | phone   |   8,867,420 → 5,945,925 |   95 → 95 |   2157.7 → 2969.4 |
| Fountain pen (`fountain-pen`)                   | desktop |   9,972,940 → 9,968,061 | 238 → 238 |   4485.3 → 5269.7 |
| Storybook (`book`)                              | phone   |   7,072,584 → 6,974,259 |  100 → 98 |   3482.6 → 4443.6 |
| Storybook (`book`)                              | desktop |   7,628,495 → 8,042,855 | 241 → 241 |   4397.2 → 6915.5 |
| Word vectors (`word-vectors`)                   | phone   |   7,055,158 → 6,956,833 |   97 → 95 |   1923.9 → 1600.5 |
| Word vectors (`word-vectors`)                   | desktop |   8,065,670 → 7,967,345 | 231 → 229 |   4498.0 → 4284.5 |
| Real tin can (`tin-can-real`)                   | phone   |   6,877,449 → 6,779,124 |   95 → 93 |   1700.5 → 3045.5 |
| Real tin can (`tin-can-real`)                   | desktop |   7,823,768 → 7,725,443 | 150 → 148 |   4370.7 → 2222.5 |
| Heart cookie (`cookie`)                         | phone   |   6,454,193 → 6,355,868 |   72 → 70 |   1637.8 → 2447.1 |
| Heart cookie (`cookie`)                         | desktop | 10,402,010 → 10,303,685 | 122 → 120 |   2800.5 → 6639.7 |
| Cactus (`cactus`)                               | phone   |   6,451,875 → 6,430,596 |   72 → 78 |   1927.8 → 2887.2 |
| Cactus (`cactus`)                               | desktop | 11,021,766 → 10,923,441 | 122 → 120 |   4831.1 → 4386.9 |
| Honeybee (`bee`)                                | phone   |   6,451,162 → 6,352,837 |   72 → 70 |   1648.3 → 6685.3 |
| Honeybee (`bee`)                                | desktop | 11,020,010 → 10,921,685 | 122 → 120 |   4992.0 → 3135.4 |
| Strawberry (`strawberry`)                       | phone   |   6,433,531 → 6,335,206 |   72 → 70 |   1753.5 → 4206.4 |
| Strawberry (`strawberry`)                       | desktop | 11,030,997 → 10,932,672 | 122 → 120 |   7831.0 → 5520.9 |
| Mandeltorus (`mandeltorus`)                     | phone   |   6,317,856 → 6,219,531 |   86 → 84 |   1683.2 → 6422.9 |
| Mandeltorus (`mandeltorus`)                     | desktop |   9,282,957 → 9,184,632 | 134 → 132 |  4725.2 → 15272.0 |
| Basket (`basket`)                               | phone   |   6,290,587 → 6,192,262 |   87 → 85 |   2713.4 → 5908.5 |
| Basket (`basket`)                               | desktop |   9,231,264 → 9,132,939 | 134 → 132 |   3608.7 → 5296.7 |
| Tomatoes (`tomatoes`)                           | phone   |   6,284,763 → 6,186,438 |   85 → 83 |   1951.0 → 3882.7 |
| Tomatoes (`tomatoes`)                           | desktop |   8,118,420 → 8,020,095 | 134 → 132 |   4679.5 → 4410.4 |
| Cinnamon star cookie (`star-cookie`)            | phone   |   6,282,246 → 6,183,921 |   84 → 82 |   1710.6 → 3052.7 |
| Cinnamon star cookie (`star-cookie`)            | desktop |   9,159,073 → 9,060,748 | 134 → 132 |   3128.7 → 3431.8 |
| Millipede (`millipede`)                         | phone   |   6,256,687 → 6,158,362 |   78 → 76 |   2888.9 → 3353.9 |
| Millipede (`millipede`)                         | desktop |   6,712,339 → 6,614,014 | 122 → 120 |   3939.7 → 3917.2 |
| Carder bumblebee (`bumblebee`)                  | phone   |   6,250,435 → 6,152,110 |   79 → 77 |   2116.9 → 2050.8 |
| Carder bumblebee (`bumblebee`)                  | desktop |   9,067,539 → 8,969,214 | 122 → 120 |   7306.7 → 4134.1 |
| Blackberry (`blackberry`)                       | phone   |   6,236,424 → 6,138,099 |   81 → 79 |   1690.5 → 2041.0 |
| Blackberry (`blackberry`)                       | desktop |   9,117,513 → 9,019,188 | 130 → 128 |   5658.9 → 3849.8 |
| May beetle (`may-beetle`)                       | phone   |   6,221,600 → 6,123,275 |   77 → 75 |   2474.6 → 4057.3 |
| May beetle (`may-beetle`)                       | desktop |   9,027,208 → 8,928,883 | 122 → 120 |   7180.3 → 5881.1 |
| Raspberry (`raspberry`)                         | phone   |   6,214,487 → 6,116,162 |   80 → 78 |   2028.3 → 1769.0 |
| Raspberry (`raspberry`)                         | desktop |   9,015,267 → 8,916,942 | 130 → 128 |   3533.5 → 4025.4 |
| Grape (`grape`)                                 | phone   |   6,214,411 → 6,116,086 |   83 → 81 |   1704.7 → 2199.2 |
| Grape (`grape`)                                 | desktop |   8,844,895 → 8,746,570 | 130 → 128 |   6616.5 → 4235.6 |
| Blueberry (`blueberry`)                         | phone   |   6,160,027 → 6,061,702 |   82 → 80 |   1619.8 → 2392.5 |
| Blueberry (`blueberry`)                         | desktop |   8,714,810 → 8,616,485 | 130 → 128 |   2571.8 → 3136.5 |
| Cluster fly (`cluster-fly`)                     | phone   |   6,144,772 → 6,046,447 |   72 → 70 |   1703.4 → 2687.9 |
| Cluster fly (`cluster-fly`)                     | desktop |   8,962,038 → 8,863,713 | 122 → 120 |   5092.4 → 6753.3 |
| Pomegranate (`pomegranate`)                     | phone   |   5,925,900 → 5,827,575 |   95 → 93 |   2536.7 → 2845.5 |
| Pomegranate (`pomegranate`)                     | desktop |   7,736,018 → 7,637,693 | 146 → 144 |   4068.0 → 3298.2 |
| Lantern (`lantern`)                             | phone   |   5,920,350 → 5,822,025 |   95 → 93 |   1719.7 → 2937.4 |
| Lantern (`lantern`)                             | desktop |   7,739,402 → 7,641,077 | 146 → 144 |   2922.2 → 2582.7 |
| Real croissant (`croissant-real`)               | phone   |   5,920,056 → 5,821,731 |   95 → 93 |   1890.7 → 2743.8 |
| Real croissant (`croissant-real`)               | desktop |   7,681,208 → 7,582,883 | 146 → 144 |   2291.0 → 2187.9 |
| Marble bust (`marble-bust`)                     | phone   |   5,917,917 → 5,819,592 |   91 → 89 |   1487.1 → 2247.6 |
| Marble bust (`marble-bust`)                     | desktop |   7,588,293 → 7,489,968 | 138 → 136 |  13790.5 → 4127.8 |
| Cat statue (`cat-statue`)                       | phone   |   5,917,149 → 5,818,824 |   95 → 93 |   1743.6 → 2509.0 |
| Cat statue (`cat-statue`)                       | desktop |   7,748,361 → 7,650,036 | 150 → 148 |   2549.7 → 3232.2 |
| Carrot cake (`carrot-cake`)                     | phone   |   5,907,871 → 5,809,546 |   95 → 93 |   2091.5 → 3112.0 |
| Carrot cake (`carrot-cake`)                     | desktop |   7,719,084 → 7,620,759 | 146 → 144 |   8420.1 → 3121.9 |
| Real pencil (`pencil-real`)                     | phone   |   5,890,744 → 5,792,419 |   95 → 93 |   1858.0 → 2053.4 |
| Real pencil (`pencil-real`)                     | desktop |   6,459,412 → 6,361,087 | 150 → 148 |   2671.8 → 2638.4 |
| Wooden elephant (`wooden-elephant`)             | phone   |   5,887,261 → 5,788,936 |   90 → 88 |   2213.2 → 2823.8 |
| Wooden elephant (`wooden-elephant`)             | desktop |   7,511,921 → 7,413,596 | 138 → 136 |   2874.8 → 2911.4 |
| Garden gnome (`garden-gnome`)                   | phone   |   5,879,754 → 5,781,429 |   89 → 87 |   2270.0 → 2224.3 |
| Garden gnome (`garden-gnome`)                   | desktop |   7,515,895 → 7,417,570 | 138 → 136 |   2829.8 → 2830.1 |
| Vintage camera (`vintage-camera`)               | phone   |   5,875,744 → 5,777,419 |   94 → 92 |   1595.0 → 5057.5 |
| Vintage camera (`vintage-camera`)               | desktop |   7,500,406 → 7,402,081 | 142 → 140 |   2218.4 → 3052.5 |
| Real alarm clock (`alarm-clock`)                | phone   |   5,854,874 → 5,756,549 |   93 → 91 |   1598.5 → 2353.8 |
| Real alarm clock (`alarm-clock`)                | desktop |   7,472,033 → 7,373,708 | 142 → 140 |   6923.0 → 3704.8 |
| Horse statue (`horse-statue`)                   | phone   |   5,842,047 → 5,743,722 |   95 → 93 |   1848.7 → 2351.4 |
| Horse statue (`horse-statue`)                   | desktop |   7,564,655 → 7,466,330 | 150 → 148 |   2328.7 → 2556.2 |
| Ukulele (`ukulele`)                             | phone   |   5,832,827 → 5,734,502 |   92 → 90 |   1711.3 → 2063.6 |
| Ukulele (`ukulele`)                             | desktop |   7,457,165 → 7,358,840 | 142 → 140 |   8153.7 → 3997.1 |
| Real rubber duck (`rubber-duck-real`)           | phone   |   5,814,459 → 5,716,134 |   88 → 86 |   2772.1 → 2846.1 |
| Real rubber duck (`rubber-duck-real`)           | desktop |   7,367,845 → 7,269,520 | 138 → 136 |   2521.8 → 2905.4 |
| Boombox (`boombox`)                             | phone   |   5,750,357 → 5,652,032 |   95 → 93 |   1426.1 → 3574.5 |
| Boombox (`boombox`)                             | desktop |   7,178,736 → 7,080,411 | 142 → 140 |   2460.9 → 3234.8 |
| Neptune (`neptune`)                             | phone   |   5,354,748 → 5,256,423 |   96 → 94 |   1707.7 → 2678.6 |
| Neptune (`neptune`)                             | desktop |   6,001,402 → 5,903,077 | 191 → 189 |   3902.8 → 7866.3 |
| Protein (`protein`)                             | phone   |   5,354,492 → 5,256,167 | 106 → 104 |   1756.7 → 2861.0 |
| Protein (`protein`)                             | desktop |   6,464,386 → 6,366,061 | 237 → 235 |  4807.2 → 78754.5 |
| Aurora world (`aurora-planet`)                  | phone   |   5,347,668 → 5,249,343 |   96 → 94 |   1575.8 → 7683.5 |
| Aurora world (`aurora-planet`)                  | desktop |   6,045,360 → 5,947,035 | 195 → 193 |   3291.6 → 5726.3 |
| Uranus (`uranus`)                               | phone   |   5,344,682 → 5,246,357 |   96 → 94 |   1522.3 → 2397.2 |
| Uranus (`uranus`)                               | desktop |   6,001,402 → 5,903,077 | 191 → 189 |   2934.2 → 2064.7 |
| Asteroid (`asteroid`)                           | phone   |   5,343,826 → 5,245,501 |   96 → 94 |   2170.3 → 3172.1 |
| Asteroid (`asteroid`)                           | desktop |   6,045,360 → 5,947,035 | 195 → 193 |  3914.5 → 34791.3 |
| Pulsar (`pulsar`)                               | phone   |   5,336,308 → 5,237,983 |   96 → 94 |   3885.2 → 2951.3 |
| Pulsar (`pulsar`)                               | desktop |   6,090,482 → 5,992,157 | 199 → 197 |  2643.6 → 16042.9 |
| Comet (`comet`)                                 | phone   |   5,335,254 → 5,236,929 |   96 → 94 |   1540.4 → 2732.3 |
| Comet (`comet`)                                 | desktop |   6,045,360 → 6,355,543 | 195 → 241 |   3153.3 → 9500.5 |
| Meteor (`meteor`)                               | phone   |   5,334,062 → 5,235,737 |   96 → 94 |   1454.2 → 2470.2 |
| Meteor (`meteor`)                               | desktop |   6,045,360 → 6,355,543 | 195 → 241 |  2358.3 → 31441.5 |
| Black hole (`black-hole`)                       | phone   |   5,332,080 → 5,233,755 |   96 → 94 |   2485.1 → 2594.1 |
| Black hole (`black-hole`)                       | desktop |   6,090,482 → 5,992,157 | 199 → 197 |  3275.5 → 45348.1 |
| Star (`star`)                                   | phone   |   5,330,842 → 5,232,517 |   96 → 94 |   4205.6 → 4150.4 |
| Star (`star`)                                   | desktop |   6,090,482 → 5,992,157 | 199 → 197 |   2693.6 → 9615.8 |
| Star cluster (`star-cluster`)                   | phone   |   5,329,382 → 5,231,057 |   96 → 94 |   2992.3 → 2039.7 |
| Star cluster (`star-cluster`)                   | desktop |   6,090,482 → 6,379,171 | 199 → 245 |  2435.2 → 13047.4 |
| Saturn (`saturn`)                               | phone   |   5,325,666 → 5,227,341 |   96 → 94 |   1411.2 → 2516.1 |
| Saturn (`saturn`)                               | desktop |   6,001,402 → 5,903,077 | 191 → 189 |   3526.1 → 2661.2 |
| Nebula (`nebula`)                               | phone   |   5,323,648 → 5,225,323 |   96 → 94 |   1872.2 → 2901.1 |
| Nebula (`nebula`)                               | desktop |   6,123,468 → 6,025,143 | 203 → 201 |  3511.8 → 21439.6 |
| Daisies (`daisy`)                               | phone   |   5,322,130 → 5,223,805 |   95 → 93 |   1705.4 → 3071.4 |
| Daisies (`daisy`)                               | desktop |   6,346,032 → 6,247,707 | 238 → 236 |  2921.8 → 22222.1 |
| Pythagoras proof (`pythagoras-proof`)           | phone   |   5,320,360 → 5,222,035 |   96 → 94 |   2345.5 → 2614.4 |
| Pythagoras proof (`pythagoras-proof`)           | desktop |   6,398,758 → 6,300,433 | 238 → 236 |  12487.7 → 9806.3 |
| Circle and waves (`unit-circle`)                | phone   |   5,318,674 → 5,220,349 |   96 → 94 |   2226.7 → 2582.3 |
| Circle and waves (`unit-circle`)                | desktop |   6,399,572 → 6,301,247 | 239 → 237 |  4122.6 → 13182.0 |
| Spiral galaxy (`spiral-galaxy`)                 | phone   |   5,318,262 → 5,219,937 |   96 → 94 |   1526.1 → 1949.9 |
| Spiral galaxy (`spiral-galaxy`)                 | desktop |   6,123,468 → 6,025,143 | 203 → 201 |  2742.2 → 17219.8 |
| Fourier circles (`fourier-circles`)             | phone   |   5,318,008 → 5,219,683 |   96 → 94 |   2964.9 → 1932.3 |
| Fourier circles (`fourier-circles`)             | desktop |   6,399,572 → 6,301,247 | 239 → 237 |   3240.3 → 8816.4 |
| Lotus (`lotus`)                                 | phone   |   5,317,770 → 5,219,445 |   95 → 93 |   1663.2 → 2786.6 |
| Lotus (`lotus`)                                 | desktop |   6,346,032 → 6,039,351 | 238 → 236 |  2923.1 → 15278.5 |
| Toadstool (`mushroom`)                          | phone   |   5,317,642 → 5,219,317 |   95 → 93 |   1902.2 → 2499.2 |
| Toadstool (`mushroom`)                          | desktop |   6,346,032 → 6,247,707 | 238 → 236 |  3502.3 → 11365.7 |
| Graph plotter (`graph-plotter`)                 | phone   |   5,316,488 → 5,218,163 |   96 → 94 |   2727.9 → 3045.6 |
| Graph plotter (`graph-plotter`)                 | desktop |   6,399,572 → 6,301,247 | 239 → 237 |  5651.1 → 11134.8 |
| Surface plotter (`surface-plotter`)             | phone   |   5,316,272 → 5,217,947 |   96 → 94 |   6336.0 → 3645.4 |
| Surface plotter (`surface-plotter`)             | desktop |   6,399,572 → 6,301,247 | 239 → 237 |  7352.6 → 28141.8 |
| Seashell spiral (`seashell-spiral`)             | phone   |   5,316,048 → 5,217,723 |   96 → 94 |   2745.7 → 4876.5 |
| Seashell spiral (`seashell-spiral`)             | desktop |   6,393,238 → 6,294,913 | 239 → 237 |  4036.7 → 12029.7 |
| Supernova (`supernova`)                         | phone   |   5,315,050 → 5,216,725 |   96 → 94 |   1458.7 → 2971.3 |
| Supernova (`supernova`)                         | desktop |   6,123,468 → 5,626,347 | 203 → 201 |  2946.5 → 21876.6 |
| Jupiter (`jupiter`)                             | phone   |   5,312,192 → 5,213,867 |   96 → 94 |   1634.4 → 2734.6 |
| Jupiter (`jupiter`)                             | desktop |   5,961,536 → 5,863,211 | 187 → 185 |   3722.3 → 2955.1 |
| Fern (`fern`)                                   | phone   |   5,309,670 → 5,211,345 |   95 → 93 |   2026.8 → 2240.8 |
| Fern (`fern`)                                   | desktop |   6,287,278 → 6,188,953 | 238 → 236 |  3443.7 → 16661.6 |
| Saguaro cactus (`saguaro`)                      | phone   |   5,309,462 → 5,211,137 |   95 → 93 |   1661.5 → 3254.9 |
| Saguaro cactus (`saguaro`)                      | desktop |   6,287,278 → 6,188,953 | 238 → 236 |  4405.2 → 15306.6 |
| Acorns (`acorn`)                                | phone   |   5,307,162 → 5,208,837 |   95 → 93 |   1780.3 → 2273.2 |
| Acorns (`acorn`)                                | desktop |   6,290,432 → 6,192,107 | 238 → 236 |   3561.5 → 8456.3 |
| Tulips (`tulip`)                                | phone   |   5,306,366 → 5,208,041 |   95 → 93 |   1787.7 → 2509.5 |
| Tulips (`tulip`)                                | desktop |   6,346,032 → 6,247,707 | 238 → 236 |  3763.4 → 12933.0 |
| Platonic solids (`platonic`)                    | phone   |   5,305,706 → 5,207,381 |   96 → 94 |   1980.9 → 8831.1 |
| Platonic solids (`platonic`)                    | desktop |   6,393,238 → 6,294,913 | 239 → 237 |  4999.2 → 11946.0 |
| Dandelion (`dandelion`)                         | phone   |   5,304,246 → 5,205,921 |   95 → 93 |   1689.0 → 2448.2 |
| Dandelion (`dandelion`)                         | desktop |   6,365,510 → 6,267,185 | 238 → 236 |  3870.5 → 44101.2 |
| Coral reef (`coral`)                            | phone   |   5,303,330 → 5,205,005 |   95 → 93 |   1948.1 → 4432.4 |
| Coral reef (`coral`)                            | desktop |   6,287,278 → 6,188,953 | 238 → 236 |  4671.5 → 24096.2 |
| Succulent (`succulent`)                         | phone   |   5,303,016 → 5,204,691 |   95 → 93 |   1495.3 → 2713.9 |
| Succulent (`succulent`)                         | desktop |   6,290,432 → 6,192,107 | 238 → 236 |  3555.2 → 10301.6 |
| Sierpinski tetrahedron (`sierpinski`)           | phone   |   5,302,956 → 5,204,631 |   96 → 94 |   1999.1 → 2470.9 |
| Sierpinski tetrahedron (`sierpinski`)           | desktop |   6,393,238 → 6,294,913 | 239 → 237 |  2987.2 → 17812.8 |
| Pinecone (`pinecone`)                           | phone   |   5,302,948 → 5,204,623 |   95 → 93 |   1591.1 → 3195.1 |
| Pinecone (`pinecone`)                           | desktop |   6,287,278 → 6,188,953 | 238 → 236 |   3004.8 → 8047.0 |
| Bamboo (`bamboo`)                               | phone   |   5,301,508 → 5,203,183 |   95 → 93 |   1852.6 → 2380.1 |
| Bamboo (`bamboo`)                               | desktop |   6,290,432 → 6,192,107 | 238 → 236 |  3372.4 → 12458.4 |
| Mars (`mars`)                                   | phone   |   5,299,516 → 5,201,191 |   96 → 94 |   3056.2 → 2516.2 |
| Mars (`mars`)                                   | desktop |   5,961,536 → 5,863,211 | 187 → 185 |   3264.8 → 2997.8 |
| Mandelbulb (`mandelbulb`)                       | phone   |   5,298,760 → 5,200,435 |   96 → 94 |   2263.2 → 2359.6 |
| Mandelbulb (`mandelbulb`)                       | desktop |   6,393,238 → 6,294,913 | 239 → 237 |  3325.3 → 18198.2 |
| Kelp (`kelp`)                                   | phone   |   5,298,686 → 5,200,361 |   95 → 93 |   1592.7 → 6912.6 |
| Kelp (`kelp`)                                   | desktop |   6,291,414 → 6,193,089 | 238 → 236 |  3726.6 → 18199.4 |
| Torus knot (`torus-knot`)                       | phone   |   5,298,164 → 5,199,839 |   96 → 94 |   3828.4 → 2934.4 |
| Torus knot (`torus-knot`)                       | desktop |   6,386,604 → 6,288,279 | 239 → 237 |   4470.6 → 9030.8 |
| Pebbles (`rocks`)                               | phone   |   5,296,362 → 5,198,037 |   95 → 93 |   1606.5 → 2934.8 |
| Pebbles (`rocks`)                               | desktop |   6,290,432 → 6,192,107 | 238 → 236 |   3631.4 → 7446.9 |
| Rose (`rose`)                                   | phone   |   5,296,300 → 5,197,975 |   95 → 93 |   1539.2 → 2643.8 |
| Rose (`rose`)                                   | desktop |   6,365,510 → 6,045,777 | 238 → 236 |  4276.1 → 23716.8 |
| Gyroid (`gyroid`)                               | phone   |   5,295,032 → 5,196,707 |   96 → 94 |   2938.1 → 3019.5 |
| Gyroid (`gyroid`)                               | desktop |   6,386,604 → 6,288,279 | 239 → 237 |   5196.7 → 9961.8 |
| Transformer (`transformer`)                     | phone   |   5,293,693 → 5,195,368 |   96 → 94 |   1985.6 → 2243.1 |
| Transformer (`transformer`)                     | desktop |   6,317,037 → 6,218,712 | 234 → 232 |   5303.1 → 5602.5 |
| Hypercube (`hypercube`)                         | phone   |   5,293,504 → 5,195,179 |   96 → 94 |   8445.0 → 5204.8 |
| Hypercube (`hypercube`)                         | desktop |   6,386,604 → 6,288,279 | 239 → 237 |  6443.4 → 12164.8 |
| Ice cream (`ice-cream`)                         | phone   |   5,293,092 → 5,194,767 |   95 → 93 |   2150.9 → 2892.0 |
| Ice cream (`ice-cream`)                         | desktop |   6,322,810 → 5,567,953 | 238 → 236 |  3859.9 → 19336.4 |
| Menger sponge (`menger-sponge`)                 | phone   |   5,291,342 → 5,193,017 |   96 → 94 |   1787.0 → 2867.1 |
| Menger sponge (`menger-sponge`)                 | desktop |   6,386,604 → 6,288,279 | 239 → 237 |  9064.7 → 13190.5 |
| Sunflower (`sunflower`)                         | phone   |   5,290,402 → 5,192,077 |   95 → 93 |   1693.6 → 2224.0 |
| Sunflower (`sunflower`)                         | desktop |   6,365,510 → 6,267,185 | 238 → 236 |  3782.8 → 44649.1 |
| Earth (`earth`)                                 | phone   |   5,289,282 → 5,190,957 |   96 → 94 |   1845.8 → 2641.8 |
| Earth (`earth`)                                 | desktop |   5,961,536 → 5,863,211 | 187 → 185 |   3512.7 → 2839.4 |
| Venus (`venus`)                                 | phone   |   5,289,082 → 5,190,757 |   96 → 94 |   2264.6 → 2443.4 |
| Venus (`venus`)                                 | desktop |   5,906,678 → 5,808,353 | 183 → 181 |   3410.5 → 3050.0 |
| Looped transformer (`looped-transformer`)       | phone   |   5,288,783 → 5,190,458 |   96 → 94 |   1637.2 → 1714.9 |
| Looped transformer (`looped-transformer`)       | desktop |   6,317,037 → 6,218,712 | 234 → 232 |  4155.8 → 15232.8 |
| Watermelon (`watermelon`)                       | phone   |   5,288,514 → 5,190,189 |   95 → 93 |   2345.9 → 3839.7 |
| Watermelon (`watermelon`)                       | desktop |   6,322,810 → 6,224,485 | 238 → 236 |  3461.6 → 15824.3 |
| Popcorn (`popcorn`)                             | phone   |   5,288,092 → 5,189,767 |   95 → 93 |   1928.8 → 9665.3 |
| Popcorn (`popcorn`)                             | desktop |   6,305,136 → 6,206,811 | 238 → 236 | 12903.6 → 10164.2 |
| Moon (`moon`)                                   | phone   |   5,288,005 → 5,189,680 |   97 → 95 |   2002.3 → 3150.9 |
| Moon (`moon`)                                   | desktop |   5,962,359 → 5,864,034 | 188 → 186 |   4101.4 → 3586.5 |
| Klein bottle (`klein-bottle`)                   | phone   |   5,287,884 → 5,189,559 |   96 → 94 |   1912.6 → 2382.5 |
| Klein bottle (`klein-bottle`)                   | desktop |   6,384,306 → 6,285,981 | 239 → 237 |  5039.3 → 16491.3 |
| Birthday cake (`birthday-cake`)                 | phone   |   5,287,820 → 5,189,495 |   95 → 93 |   2428.4 → 5329.6 |
| Birthday cake (`birthday-cake`)                 | desktop |   6,281,320 → 6,206,811 | 238 → 236 | 14741.1 → 18748.5 |
| Cupcake (`cupcake`)                             | phone   |   5,285,610 → 5,187,285 |   95 → 93 |   2261.2 → 2776.9 |
| Cupcake (`cupcake`)                             | desktop |   6,331,764 → 6,233,439 | 238 → 236 |  4211.6 → 16040.2 |
| Jelly (`jelly`)                                 | phone   |   5,284,760 → 5,186,435 |   95 → 93 |   1760.3 → 4556.4 |
| Jelly (`jelly`)                                 | desktop |   6,305,136 → 6,206,811 | 238 → 236 |  6268.7 → 15514.6 |
| Weeping willow (`willow`)                       | phone   |   5,284,326 → 5,186,001 |   95 → 93 |   1915.0 → 2122.6 |
| Weeping willow (`willow`)                       | desktop |   6,365,510 → 6,267,185 | 238 → 236 |  3231.6 → 28070.2 |
| Lollipop (`lollipop`)                           | phone   |   5,283,690 → 5,185,365 |   95 → 93 |   2280.7 → 2841.0 |
| Lollipop (`lollipop`)                           | desktop |   6,331,764 → 6,233,439 | 238 → 236 |  3634.3 → 14833.3 |
| Diffusion model (`diffusion-model`)             | phone   |   5,283,575 → 5,185,250 |   96 → 94 |   1680.9 → 1673.0 |
| Diffusion model (`diffusion-model`)             | desktop |   6,282,217 → 6,183,892 | 230 → 228 |  4187.7 → 20569.6 |
| Pancakes (`pancakes`)                           | phone   |   5,282,832 → 5,184,507 |   95 → 93 |   2303.2 → 3335.6 |
| Pancakes (`pancakes`)                           | desktop |   6,305,136 → 6,206,811 | 238 → 236 | 16729.0 → 15277.0 |
| Möbius strip (`mobius`)                         | phone   |   5,282,500 → 5,184,175 |   96 → 94 |   2238.7 → 3938.9 |
| Möbius strip (`mobius`)                         | desktop |   6,384,306 → 6,285,981 | 239 → 237 | 15831.5 → 14491.8 |
| Mercury (`mercury`)                             | phone   |   5,281,910 → 5,183,585 |   96 → 94 |   2009.5 → 2673.9 |
| Mercury (`mercury`)                             | desktop |   5,906,678 → 5,808,353 | 183 → 181 |   3780.6 → 3858.3 |
| Recurrent network (`rnn`)                       | phone   |   5,281,475 → 5,183,150 |   96 → 94 |   1765.9 → 1740.7 |
| Recurrent network (`rnn`)                       | desktop |   6,317,037 → 6,218,712 | 234 → 232 |   4321.6 → 4956.6 |
| Convolutional network (`cnn`)                   | phone   |   5,281,247 → 5,182,922 |   96 → 94 |   1830.3 → 1679.1 |
| Convolutional network (`cnn`)                   | desktop |   6,317,037 → 6,218,712 | 234 → 232 |   4582.1 → 5700.2 |
| Neural network (`neural-network`)               | phone   |   5,281,123 → 5,182,798 |   96 → 94 |   2108.6 → 2076.6 |
| Neural network (`neural-network`)               | desktop |   6,348,357 → 6,250,032 | 238 → 236 |   4725.4 → 6707.6 |
| Bonsai (`bonsai`)                               | phone   |   5,280,600 → 5,182,275 |   95 → 93 |   1622.0 → 2698.9 |
| Bonsai (`bonsai`)                               | desktop |   6,382,326 → 6,139,331 | 238 → 236 |  4287.3 → 55204.5 |
| Maple tree (`maple`)                            | phone   |   5,280,362 → 5,182,037 |   95 → 93 |   1891.8 → 2228.8 |
| Maple tree (`maple`)                            | desktop |   6,382,326 → 6,284,001 | 238 → 236 |  3998.5 → 47592.3 |
| Electron orbital (`orbital`)                    | phone   |   5,279,436 → 5,181,111 | 105 → 103 |   2109.5 → 2738.3 |
| Electron orbital (`orbital`)                    | desktop |   6,357,532 → 6,259,207 | 232 → 230 |  3990.8 → 79221.1 |
| Candy cane (`candy-cane`)                       | phone   |   5,279,128 → 5,180,803 |   95 → 93 |   2528.2 → 2736.7 |
| Candy cane (`candy-cane`)                       | desktop |   6,331,764 → 6,027,995 | 238 → 236 |  4780.6 → 28072.9 |
| Atom (`atom`)                                   | phone   |   5,277,828 → 5,179,503 | 105 → 103 |   1754.3 → 2385.1 |
| Atom (`atom`)                                   | desktop |   6,274,352 → 6,259,207 | 232 → 230 |  8704.8 → 26428.2 |
| Cherry blossom (`cherry-blossom`)               | phone   |   5,277,642 → 5,179,317 |   95 → 93 |   1770.7 → 3293.7 |
| Cherry blossom (`cherry-blossom`)               | desktop |   6,382,326 → 6,430,813 | 238 → 292 |  9203.8 → 64989.9 |
| Multilayer perceptron (`multilayer-perceptron`) | phone   |   5,275,829 → 5,177,504 |   96 → 94 |   3264.5 → 2070.3 |
| Multilayer perceptron (`multilayer-perceptron`) | desktop |   6,348,357 → 6,250,032 | 238 → 236 |  5069.1 → 37055.5 |
| Molecule (`molecule`)                           | phone   |   5,275,792 → 5,177,467 | 105 → 103 |   1721.4 → 2622.8 |
| Molecule (`molecule`)                           | desktop |   6,385,816 → 6,287,491 | 236 → 234 |  7179.8 → 35755.1 |
| Lorenz attractor (`lorenz`)                     | phone   |   5,274,104 → 5,175,779 |   96 → 94 |   1876.8 → 3182.1 |
| Lorenz attractor (`lorenz`)                     | desktop |   6,384,306 → 6,110,465 | 239 → 237 |  4705.0 → 31851.6 |
| Perceptron (`perceptron`)                       | phone   |   5,273,825 → 5,175,500 |   96 → 94 |   3780.3 → 1955.7 |
| Perceptron (`perceptron`)                       | desktop |   6,348,357 → 6,250,032 | 238 → 236 |  5387.9 → 14282.6 |
| Gummy bear (`gummy-bear`)                       | phone   |   5,273,522 → 5,175,197 |   95 → 93 |   2067.5 → 2584.5 |
| Gummy bear (`gummy-bear`)                       | desktop |   6,361,702 → 6,263,377 | 238 → 236 |  3859.5 → 27257.1 |
| Ring nebula (`planetary-nebula`)                | phone   |   5,273,395 → 5,175,070 |   95 → 93 |   1695.7 → 2231.9 |
| Ring nebula (`planetary-nebula`)                | desktop |   6,123,468 → 6,025,143 | 203 → 201 |  2253.2 → 24894.8 |
| Macarons (`macarons`)                           | phone   |   5,273,252 → 5,174,927 |   95 → 93 |   1847.3 → 2780.2 |
| Macarons (`macarons`)                           | desktop |   6,331,764 → 6,157,983 | 238 → 236 |  4538.6 → 24334.6 |
| Sorting machine (`sorting-machine`)             | phone   |   5,272,345 → 5,174,020 |   96 → 94 |   1846.3 → 1385.6 |
| Sorting machine (`sorting-machine`)             | desktop |   6,282,217 → 6,183,892 | 230 → 228 |   3849.3 → 3960.9 |
| Crystal lattice (`crystal-lattice`)             | phone   |   5,271,858 → 5,173,533 | 105 → 103 |   1631.9 → 2200.7 |
| Crystal lattice (`crystal-lattice`)             | desktop |   6,385,816 → 6,287,491 | 236 → 234 |  4200.7 → 25705.5 |
| Gradient descent (`gradient-descent`)           | phone   |   5,271,653 → 5,173,328 |   96 → 94 |   1646.1 → 1881.3 |
| Gradient descent (`gradient-descent`)           | desktop |   6,282,217 → 6,183,892 | 230 → 228 |   4886.5 → 4948.5 |
| Solar system (`solar-system`)                   | phone   |   5,271,404 → 5,173,079 |   96 → 94 |   2076.6 → 1994.4 |
| Solar system (`solar-system`)                   | desktop |   5,906,678 → 5,808,353 | 183 → 181 |   3526.4 → 2640.8 |
| Half adder (`half-adder`)                       | phone   |   5,269,803 → 5,171,478 |   96 → 94 |   1823.9 → 1874.5 |
| Half adder (`half-adder`)                       | desktop |   6,261,435 → 6,163,110 | 226 → 224 |   3957.4 → 4492.2 |
| Pretzel (`pretzel`)                             | phone   |   5,269,728 → 5,171,403 |   95 → 93 |   2169.6 → 2890.8 |
| Pretzel (`pretzel`)                             | desktop |   6,361,702 → 6,263,377 | 238 → 236 |  3301.1 → 18205.6 |
| Croissant (`croissant`)                         | phone   |   5,265,524 → 5,167,199 |   95 → 93 |   2688.4 → 4880.3 |
| Croissant (`croissant`)                         | desktop |   6,361,702 → 6,263,377 | 238 → 236 |  3570.8 → 12639.3 |
| Sun (`sun`)                                     | phone   |   5,264,868 → 5,166,543 |   96 → 94 |   2486.2 → 2040.9 |
| Sun (`sun`)                                     | desktop |   5,906,678 → 5,808,353 | 183 → 181 |   3679.5 → 3389.0 |
| Palm tree (`palm`)                              | phone   |   5,263,550 → 5,165,225 |   95 → 93 |   1541.5 → 2173.4 |
| Palm tree (`palm`)                              | desktop |   6,382,326 → 6,715,799 | 238 → 292 |  3180.0 → 40167.8 |
| Taco (`taco`)                                   | phone   |   5,261,616 → 5,163,291 |   95 → 93 |   2181.3 → 3126.2 |
| Taco (`taco`)                                   | desktop |   6,364,526 → 6,266,201 | 238 → 236 |   6531.2 → 5765.4 |
| Burger (`burger`)                               | phone   |   5,260,380 → 5,162,055 |   95 → 93 |   5767.9 → 3241.4 |
| Burger (`burger`)                               | desktop |   6,364,526 → 6,266,201 | 238 → 236 |  3851.3 → 11013.0 |
| Sushi (`sushi`)                                 | phone   |   5,260,374 → 5,162,049 |   95 → 93 |   4040.7 → 3450.3 |
| Sushi (`sushi`)                                 | desktop |   6,364,526 → 6,266,201 | 238 → 236 |   6416.3 → 6519.5 |
| Pizza (`pizza`)                                 | phone   |   5,260,306 → 5,161,981 |   95 → 93 |   2924.3 → 6024.0 |
| Pizza (`pizza`)                                 | desktop |   6,364,526 → 6,266,201 | 238 → 236 |  4026.5 → 18294.6 |
| Pine tree (`pine`)                              | phone   |   5,259,316 → 5,160,991 |   95 → 93 |   1740.7 → 2351.2 |
| Pine tree (`pine`)                              | desktop |   6,402,228 → 5,595,409 | 238 → 236 |  3109.4 → 73721.3 |
| Coffee (`coffee`)                               | phone   |   5,258,856 → 5,160,531 |   95 → 93 |   2171.9 → 2823.4 |
| Coffee (`coffee`)                               | desktop |   6,369,562 → 6,271,237 | 238 → 236 |   3649.1 → 8759.3 |
| Kiwi (`kiwi`)                                   | phone   |   5,258,162 → 5,159,837 |   95 → 93 |   2653.7 → 5255.5 |
| Kiwi (`kiwi`)                                   | desktop |   6,348,540 → 6,250,215 | 238 → 236 |  7986.1 → 19866.1 |
| Boiled egg (`egg`)                              | phone   |   5,258,154 → 5,159,829 |   95 → 93 |   2606.9 → 3055.1 |
| Boiled egg (`egg`)                              | desktop |   6,369,562 → 6,271,237 | 238 → 236 |   3343.9 → 6320.6 |
| Apple (`apple`)                                 | phone   |   5,257,928 → 5,159,603 |   95 → 93 |   1941.7 → 4163.0 |
| Apple (`apple`)                                 | desktop |   6,369,562 → 6,092,239 | 238 → 236 |  8334.5 → 26289.0 |
| Pineapple (`pineapple`)                         | phone   |   5,256,686 → 5,158,361 |   95 → 93 |  2602.9 → 13028.5 |
| Pineapple (`pineapple`)                         | desktop |   6,348,540 → 6,250,215 | 238 → 236 |  8148.2 → 11006.2 |
| Orange (`orange`)                               | phone   |   5,255,506 → 5,157,181 |   95 → 93 |   2432.6 → 2638.0 |
| Orange (`orange`)                               | desktop |   6,348,540 → 6,250,215 | 238 → 236 |   8951.9 → 7515.9 |
| Bananas (`banana`)                              | phone   |   5,255,220 → 5,156,895 |   95 → 93 |   3274.8 → 3198.7 |
| Bananas (`banana`)                              | desktop |   6,369,562 → 6,271,237 | 238 → 236 |  6191.4 → 14061.0 |
| Oak tree (`oak`)                                | phone   |   5,253,466 → 5,155,141 |   95 → 93 |   1830.3 → 2358.8 |
| Oak tree (`oak`)                                | desktop |   6,402,228 → 6,303,903 | 238 → 236 |  3922.5 → 49030.6 |
| Cherries (`cherries`)                           | phone   |   5,252,498 → 5,154,173 |   95 → 93 |   2147.1 → 3111.1 |
| Cherries (`cherries`)                           | desktop |   6,348,540 → 6,250,215 | 238 → 236 |  8356.3 → 16284.3 |
| Grapes (`grapes`)                               | phone   |   5,249,388 → 5,151,063 |   95 → 93 |   2504.9 → 3024.2 |
| Grapes (`grapes`)                               | desktop |   6,344,760 → 6,246,435 | 238 → 236 |  4294.3 → 11346.2 |
| Avocado (`avocado`)                             | phone   |   5,247,466 → 5,149,141 |   95 → 93 |   2560.0 → 3077.9 |
| Avocado (`avocado`)                             | desktop |   6,344,760 → 6,246,435 | 238 → 236 |   5900.0 → 7622.4 |
| Virus (`virus`)                                 | phone   |   5,211,285 → 5,112,960 |   95 → 93 |   2134.0 → 2696.7 |
| Virus (`virus`)                                 | desktop |   6,064,353 → 5,966,028 | 206 → 204 |  3913.1 → 11802.1 |
| Campfire (`campfire`)                           | phone   |   5,206,665 → 5,108,340 |   95 → 93 |   2389.5 → 2970.1 |
| Campfire (`campfire`)                           | desktop |   6,204,387 → 5,949,616 | 238 → 236 |   2839.4 → 3329.5 |
| Storm cloud (`storm-cloud`)                     | phone   |   5,202,427 → 5,104,102 |   95 → 93 |   1688.2 → 6541.6 |
| Storm cloud (`storm-cloud`)                     | desktop |   6,204,387 → 5,240,210 | 238 → 236 |  3280.3 → 19482.3 |
| Lava lamp (`lava-lamp`)                         | phone   |   5,200,721 → 5,102,396 |   95 → 93 |   1887.6 → 2691.3 |
| Lava lamp (`lava-lamp`)                         | desktop |   6,204,387 → 6,106,062 | 238 → 236 |  3536.7 → 22618.1 |
| Turing machine (`turing-machine`)               | phone   |   5,199,596 → 5,101,271 |   96 → 94 |   1857.4 → 2625.0 |
| Turing machine (`turing-machine`)               | desktop |   6,196,996 → 6,098,671 | 226 → 224 |   4339.6 → 5190.8 |
| Enigma machine (`enigma-machine`)               | phone   |   5,199,296 → 5,100,971 |   96 → 94 |   2569.5 → 1808.1 |
| Enigma machine (`enigma-machine`)               | desktop |   6,196,996 → 6,098,671 | 226 → 224 |  4893.9 → 13510.5 |
| Eiffel Tower (`eiffel-tower`)                   | phone   |   5,198,566 → 5,100,241 |   95 → 93 |   1509.1 → 2036.4 |
| Eiffel Tower (`eiffel-tower`)                   | desktop |   5,978,640 → 5,880,315 | 193 → 191 |   4809.0 → 4881.1 |
| Bombe (`bombe`)                                 | phone   |   5,198,532 → 5,100,207 |   96 → 94 |   1897.0 → 1743.6 |
| Bombe (`bombe`)                                 | desktop |   6,171,386 → 6,073,061 | 222 → 220 |  5071.7 → 22958.7 |
| Difference engine (`difference-engine`)         | phone   |   5,198,352 → 5,100,027 |   96 → 94 |   2125.1 → 1888.2 |
| Difference engine (`difference-engine`)         | desktop |   6,196,996 → 6,098,671 | 226 → 224 |   4531.2 → 6137.2 |
| Neuron (`neuron`)                               | phone   |   5,198,351 → 5,100,026 |   95 → 93 |   1736.0 → 2782.0 |
| Neuron (`neuron`)                               | desktop |   6,108,067 → 6,009,742 | 210 → 208 |  3180.3 → 26385.5 |
| Bacteriophage (`bacteriophage`)                 | phone   |   5,198,347 → 5,100,022 |   95 → 93 |   2540.2 → 2735.2 |
| Bacteriophage (`bacteriophage`)                 | desktop |   6,064,353 → 5,966,028 | 206 → 204 |   3423.4 → 9858.9 |
| Red blood cell (`red-blood-cell`)               | phone   |   5,197,259 → 5,098,934 |   95 → 93 |   1645.4 → 2809.9 |
| Red blood cell (`red-blood-cell`)               | desktop |   6,064,353 → 5,966,028 | 206 → 204 |   3156.7 → 8855.5 |
| Washington Monument (`washington-monument`)     | phone   |   5,197,194 → 5,098,869 |   95 → 93 |   1989.4 → 2106.2 |
| Washington Monument (`washington-monument`)     | desktop |   5,940,872 → 5,842,547 | 189 → 187 |   8556.8 → 5690.3 |
| Ice swan (`ice-statue`)                         | phone   |   5,196,385 → 5,098,060 |   95 → 93 |   1745.1 → 2601.4 |
| Ice swan (`ice-statue`)                         | desktop |   6,210,507 → 6,112,182 | 238 → 236 |  4469.9 → 18105.8 |
| Volcano (`volcano`)                             | phone   |   5,195,853 → 5,097,528 |   95 → 93 |   1685.2 → 2741.5 |
| Volcano (`volcano`)                             | desktop |   6,210,507 → 6,112,182 | 238 → 236 |  3171.5 → 11852.9 |
| Candle (`candle`)                               | phone   |   5,193,627 → 5,095,302 |   95 → 93 |   7863.9 → 3315.0 |
| Candle (`candle`)                               | desktop |   6,210,507 → 6,112,182 | 238 → 236 |  3894.8 → 35440.4 |
| Bacterium (`bacterium`)                         | phone   |   5,192,901 → 5,094,576 |   95 → 93 |   1769.6 → 2992.7 |
| Bacterium (`bacterium`)                         | desktop |   6,064,353 → 5,966,028 | 206 → 204 |  3626.9 → 10950.7 |
| Twisting supertall (`supertall`)                | phone   |   5,192,552 → 5,041,098 |   94 → 91 |   1990.6 → 1872.4 |
| Twisting supertall (`supertall`)                | desktop |   5,940,872 → 5,842,547 | 189 → 187 |   4857.2 → 6030.4 |
| Snow globe (`snow-globe`)                       | phone   |   5,192,481 → 5,094,156 |   95 → 93 |   1643.9 → 2494.5 |
| Snow globe (`snow-globe`)                       | desktop |   6,210,507 → 5,577,320 | 238 → 236 |  7810.1 → 23556.8 |
| Tornado (`tornado`)                             | phone   |   5,192,339 → 5,094,014 |   95 → 93 |   1929.0 → 2359.3 |
| Tornado (`tornado`)                             | desktop |   6,202,887 → 6,104,562 | 238 → 236 |  3584.7 → 11461.4 |
| Rainbow (`rainbow`)                             | phone   |   5,191,521 → 5,093,196 |   95 → 93 |   1928.4 → 2217.3 |
| Rainbow (`rainbow`)                             | desktop |   6,202,887 → 6,104,562 | 238 → 236 |  3130.3 → 16281.0 |
| Lighthouse (`lighthouse`)                       | phone   |   5,188,402 → 5,090,077 |   93 → 91 |   1834.4 → 2778.8 |
| Lighthouse (`lighthouse`)                       | desktop |   5,940,872 → 5,842,547 | 189 → 187 |   5371.3 → 7340.3 |
| Astrocyte (`astrocyte`)                         | phone   |   5,188,071 → 5,089,746 |   95 → 93 |   2239.2 → 3512.3 |
| Astrocyte (`astrocyte`)                         | desktop |   6,108,067 → 6,009,742 | 210 → 208 |  3751.7 → 37882.3 |
| Iceberg (`iceberg`)                             | phone   |   5,187,977 → 5,089,652 |   95 → 93 |   2259.8 → 2379.6 |
| Iceberg (`iceberg`)                             | desktop |   6,202,887 → 6,104,562 | 238 → 236 |  3139.2 → 13031.9 |
| Waterfall (`waterfall`)                         | phone   |   5,180,871 → 5,082,546 |   95 → 93 |   1878.6 → 2307.1 |
| Waterfall (`waterfall`)                         | desktop |   6,202,887 → 6,104,562 | 238 → 236 |  4317.3 → 30447.2 |
| Animal cell (`animal-cell`)                     | phone   |   5,180,549 → 5,082,224 |   95 → 93 |   1716.3 → 4693.1 |
| Animal cell (`animal-cell`)                     | desktop |   6,108,067 → 6,009,742 | 210 → 208 |  3264.4 → 48426.2 |
| Statue of Liberty (`statue-of-liberty`)         | phone   |   5,179,828 → 5,081,503 |   92 → 90 |  1974.2 → 35400.0 |
| Statue of Liberty (`statue-of-liberty`)         | desktop |   5,886,092 → 5,787,767 | 185 → 183 |   5103.4 → 7484.2 |
| Geyser (`geyser`)                               | phone   |   5,170,023 → 5,071,698 |   95 → 93 |   2188.5 → 2106.0 |
| Geyser (`geyser`)                               | desktop |   6,189,831 → 5,609,974 | 238 → 236 |  4987.8 → 99140.9 |
| Ocean wave (`ocean-wave`)                       | phone   |   5,168,233 → 5,069,908 |   95 → 93 |   1993.4 → 2153.0 |
| Ocean wave (`ocean-wave`)                       | desktop |   6,189,831 → 6,091,506 | 238 → 236 |  3711.9 → 20952.5 |
| DNA (`dna`)                                     | phone   |   5,167,647 → 5,069,322 |   95 → 93 |   1433.7 → 5174.3 |
| DNA (`dna`)                                     | desktop |   6,108,067 → 6,009,742 | 210 → 208 |  4785.7 → 24878.9 |
| White House (`white-house`)                     | phone   |   5,165,460 → 5,067,135 |   91 → 89 |   1931.3 → 2075.9 |
| White House (`white-house`)                     | desktop |   5,886,092 → 5,787,767 | 185 → 183 |   4894.2 → 7674.2 |
| Bicycle (`bicycle`)                             | phone   |   5,157,373 → 5,059,048 |   95 → 93 |   1894.4 → 2315.2 |
| Bicycle (`bicycle`)                             | desktop |   5,930,249 → 5,831,924 | 193 → 191 |   4982.1 → 5768.5 |
| Tractor (`tractor`)                             | phone   |   5,157,135 → 5,058,810 |   95 → 93 |   2555.5 → 2419.5 |
| Tractor (`tractor`)                             | desktop |   5,930,249 → 5,831,924 | 193 → 191 |  5640.2 → 26120.3 |
| Octopus (`octopus`)                             | phone   |   5,156,761 → 5,058,436 |   95 → 93 |   1954.4 → 2399.1 |
| Octopus (`octopus`)                             | desktop |   6,218,327 → 6,120,002 | 238 → 236 |   3688.5 → 6887.2 |
| Sailboat (`sailboat`)                           | phone   |   5,156,595 → 5,058,270 |   95 → 93 |   1986.4 → 1826.3 |
| Sailboat (`sailboat`)                           | desktop |   5,966,335 → 5,868,010 | 197 → 195 |  14944.3 → 8410.6 |
| Submarine (`submarine`)                         | phone   |   5,156,353 → 5,058,028 |   95 → 93 |   1595.5 → 2412.2 |
| Submarine (`submarine`)                         | desktop |   5,966,335 → 5,868,010 | 197 → 195 |  12307.4 → 7408.6 |
| Bus (`bus`)                                     | phone   |   5,155,623 → 5,057,298 |   95 → 93 |   2874.2 → 2102.9 |
| Bus (`bus`)                                     | desktop |   6,000,171 → 5,901,846 | 201 → 199 |   6120.3 → 7541.6 |
| Propeller plane (`propeller-plane`)             | phone   |   5,155,497 → 5,057,172 |   95 → 93 |   2205.8 → 1795.9 |
| Propeller plane (`propeller-plane`)             | desktop |   5,966,335 → 5,868,010 | 197 → 195 |   4608.0 → 5698.1 |
| Leaning Tower of Pisa (`leaning-tower`)         | phone   |   5,155,168 → 5,056,843 |   90 → 88 |   1976.8 → 2048.1 |
| Leaning Tower of Pisa (`leaning-tower`)         | desktop |   5,886,092 → 5,787,767 | 185 → 183 |   5516.3 → 5888.1 |
| Rocket (`rocket`)                               | phone   |   5,154,159 → 5,055,834 |   95 → 93 |   1886.5 → 2152.7 |
| Rocket (`rocket`)                               | desktop |   6,026,423 → 5,928,098 | 205 → 203 |   7096.1 → 8036.6 |
| Ocean liner (`ocean-liner`)                     | phone   |   5,154,159 → 5,055,834 |   95 → 93 |   2188.6 → 2163.9 |
| Ocean liner (`ocean-liner`)                     | desktop |   6,000,171 → 5,901,846 | 201 → 199 |   6337.9 → 6792.0 |
| Jet airliner (`jet`)                            | phone   |   5,153,861 → 5,055,536 |   95 → 93 |   2227.3 → 1991.3 |
| Jet airliner (`jet`)                            | desktop |   5,966,335 → 5,868,010 | 197 → 195 |   3792.5 → 6578.8 |
| Steam train (`steam-train`)                     | phone   |   5,153,527 → 5,055,202 |   95 → 93 |   1860.7 → 2040.3 |
| Steam train (`steam-train`)                     | desktop |   6,000,171 → 5,901,846 | 201 → 199 |   5884.4 → 7022.0 |
| Flying saucer (`ufo`)                           | phone   |   5,153,361 → 5,055,036 |   95 → 93 |   2002.5 → 1990.4 |
| Flying saucer (`ufo`)                           | desktop |   5,930,249 → 5,831,924 | 193 → 191 |   3440.2 → 5043.2 |
| Sports car (`sports-car`)                       | phone   |   5,152,985 → 5,054,660 |   95 → 93 |   2369.2 → 2181.4 |
| Sports car (`sports-car`)                       | desktop |   6,000,171 → 5,901,846 | 201 → 199 |   5084.9 → 6534.5 |
| Starfish (`starfish`)                           | phone   |   5,152,739 → 5,054,414 |   95 → 93 |   1782.9 → 2118.4 |
| Starfish (`starfish`)                           | desktop |   6,229,521 → 6,131,196 | 238 → 236 |  3932.8 → 10394.8 |
| Diatom (`diatom`)                               | phone   |   5,152,055 → 5,053,730 |   95 → 93 |   4559.0 → 3576.4 |
| Diatom (`diatom`)                               | desktop |   6,141,811 → 6,043,486 | 214 → 212 |  3626.3 → 12507.7 |
| Hot-air balloon (`hot-air-balloon`)             | phone   |   5,151,947 → 5,053,622 |   95 → 93 |   2061.2 → 2245.6 |
| Hot-air balloon (`hot-air-balloon`)             | desktop |   6,026,423 → 5,928,098 | 205 → 203 |   4192.9 → 6319.4 |
| White blood cell (`white-blood-cell`)           | phone   |   5,151,803 → 5,053,478 |   95 → 93 |   1912.7 → 4113.1 |
| White blood cell (`white-blood-cell`)           | desktop |   6,141,811 → 6,043,486 | 214 → 212 |  4173.4 → 21029.3 |
| Chromosome (`chromosome`)                       | phone   |   5,150,791 → 5,052,466 |   95 → 93 |   2210.1 → 2677.0 |
| Chromosome (`chromosome`)                       | desktop |   6,174,833 → 5,629,824 | 218 → 216 |  3223.6 → 72658.5 |
| Tardigrade (`tardigrade`)                       | phone   |   5,150,755 → 5,052,430 |   95 → 93 |   5101.5 → 3022.7 |
| Tardigrade (`tardigrade`)                       | desktop |   6,141,811 → 6,370,206 | 214 → 260 |  3438.2 → 32901.5 |
| Helicopter (`helicopter`)                       | phone   |   5,150,739 → 5,052,414 |   95 → 93 |   3673.1 → 2098.2 |
| Helicopter (`helicopter`)                       | desktop |   6,026,423 → 5,928,098 | 205 → 203 |   6804.6 → 7357.5 |
| Pollen grain (`pollen`)                         | phone   |   5,149,943 → 5,051,618 |   95 → 93 |   1696.3 → 3077.7 |
| Pollen grain (`pollen`)                         | desktop |   6,174,833 → 6,401,526 | 218 → 264 |  3090.8 → 33726.8 |
| Snowflake (`snowflake`)                         | phone   |   5,149,929 → 5,051,604 |   95 → 93 |   1914.9 → 2455.7 |
| Snowflake (`snowflake`)                         | desktop |   6,174,833 → 6,076,508 | 218 → 216 |  4201.1 → 28017.6 |
| Mitochondrion (`mitochondrion`)                 | phone   |   5,147,505 → 5,049,180 |   95 → 93 |   1856.6 → 8907.1 |
| Mitochondrion (`mitochondrion`)                 | desktop |   6,174,833 → 6,401,526 | 218 → 264 |  3291.2 → 15049.5 |
| Ladybug (`ladybug`)                             | phone   |   5,147,223 → 5,048,898 |   95 → 93 |   1948.9 → 1990.8 |
| Ladybug (`ladybug`)                             | desktop |   6,218,327 → 6,120,002 | 238 → 236 |   3889.0 → 9582.5 |
| Snail (`snail`)                                 | phone   |   5,146,865 → 5,048,540 |   95 → 93 |   1865.5 → 2219.6 |
| Snail (`snail`)                                 | desktop |   6,218,327 → 6,120,002 | 238 → 236 |   3941.2 → 6035.3 |
| Electronic keyboard (`electronic-keyboard`)     | phone   |   5,146,768 → 5,048,443 |   97 → 95 |   1997.1 → 2408.0 |
| Electronic keyboard (`electronic-keyboard`)     | desktop |   6,024,000 → 5,925,675 | 207 → 205 |  7145.5 → 15312.4 |
| Microglia (`microglia`)                         | phone   |   5,145,599 → 5,047,274 |   95 → 93 |   1775.9 → 3873.7 |
| Microglia (`microglia`)                         | desktop |   6,141,811 → 6,043,486 | 214 → 212 |  3604.4 → 12391.9 |
| Pyramids of Giza (`pyramids`)                   | phone   |   5,145,437 → 5,100,241 |   94 → 93 |   1637.3 → 1951.5 |
| Pyramids of Giza (`pyramids`)                   | desktop |   5,940,872 → 5,842,547 | 189 → 187 |   8530.2 → 5454.4 |
| Nautilus (`nautilus`)                           | phone   |   5,144,431 → 5,046,106 |   95 → 93 |   2005.2 → 3393.7 |
| Nautilus (`nautilus`)                           | desktop |   6,218,327 → 6,120,002 | 238 → 236 |   4417.8 → 8338.6 |
| Colosseum (`colosseum`)                         | phone   |   5,141,496 → 5,043,171 |   89 → 87 |   5248.1 → 2051.3 |
| Colosseum (`colosseum`)                         | desktop |   5,886,092 → 5,787,767 | 185 → 183 |   3717.1 → 5418.3 |
| Jack-o'-lantern (`jack-o-lantern`)              | phone   |   5,141,373 → 5,043,048 |   95 → 93 |  17994.4 → 2257.3 |
| Jack-o'-lantern (`jack-o-lantern`)              | desktop |   6,115,407 → 6,017,082 | 221 → 219 |   5774.5 → 9915.8 |
| Sea urchin (`sea-urchin`)                       | phone   |   5,140,809 → 5,042,484 |   95 → 93 |   1790.6 → 1775.0 |
| Sea urchin (`sea-urchin`)                       | desktop |   6,229,521 → 6,131,196 | 238 → 236 |  3407.4 → 15446.9 |
| Pufferfish (`pufferfish`)                       | phone   |   5,140,239 → 5,041,914 |   95 → 93 |   1977.0 → 2123.5 |
| Pufferfish (`pufferfish`)                       | desktop |   6,206,949 → 6,108,624 | 238 → 236 |  4193.8 → 18826.2 |
| Frog (`frog`)                                   | phone   |   5,139,713 → 5,041,388 |   95 → 93 |   3620.5 → 2172.2 |
| Frog (`frog`)                                   | desktop |   6,229,521 → 6,131,196 | 238 → 236 |   6260.7 → 7720.4 |
| Paramecium (`paramecium`)                       | phone   |   5,139,205 → 5,040,880 |   95 → 93 |   1900.5 → 6938.8 |
| Paramecium (`paramecium`)                       | desktop |   6,211,413 → 6,436,346 | 222 → 268 |  3692.9 → 25476.9 |
| Amoeba (`amoeba`)                               | phone   |   5,139,203 → 5,040,878 |   95 → 93 |  2143.3 → 11228.1 |
| Amoeba (`amoeba`)                               | desktop |   6,211,413 → 6,436,346 | 222 → 268 |   4408.5 → 8372.9 |
| Harpsichord (`harpsichord`)                     | phone   |   5,137,218 → 5,038,893 |   97 → 95 |   2234.8 → 2844.2 |
| Harpsichord (`harpsichord`)                     | desktop |   6,045,562 → 5,947,237 | 211 → 209 |  9555.3 → 12630.0 |
| Penguin (`penguin`)                             | phone   |   5,136,787 → 5,038,462 |   95 → 93 |   1801.0 → 2289.6 |
| Penguin (`penguin`)                             | desktop |   6,229,521 → 6,131,196 | 238 → 236 |   4909.5 → 7411.6 |
| Butterfly (`butterfly`)                         | phone   |   5,135,823 → 5,037,498 |   95 → 93 |   1722.0 → 2174.1 |
| Butterfly (`butterfly`)                         | desktop |   6,206,949 → 6,108,624 | 238 → 236 |  3712.2 → 10729.1 |
| School of fish (`fish-school`)                  | phone   |   5,134,459 → 5,036,134 |   95 → 93 |   1603.6 → 1927.6 |
| School of fish (`fish-school`)                  | desktop |   6,206,949 → 6,108,624 | 238 → 236 |   3930.0 → 5382.7 |
| Upright piano (`upright-piano`)                 | phone   |   5,133,332 → 5,035,007 |   97 → 95 |   2238.4 → 3071.5 |
| Upright piano (`upright-piano`)                 | desktop |   6,045,562 → 5,947,237 | 211 → 209 |  6325.5 → 10180.3 |
| Owl (`owl`)                                     | phone   |   5,132,229 → 5,033,904 |   95 → 93 |   1891.5 → 2206.6 |
| Owl (`owl`)                                     | desktop |   6,248,955 → 6,150,630 | 238 → 236 |  5259.3 → 16372.4 |
| Flying disc (`flying-disc`)                     | phone   |   5,132,062 → 5,033,737 |   95 → 93 |   1900.4 → 2500.7 |
| Flying disc (`flying-disc`)                     | desktop |   5,752,852 → 5,654,527 | 178 → 176 |   3839.4 → 3568.5 |
| Snowman (`snowman`)                             | phone   |   5,130,759 → 5,032,434 |   95 → 93 |   1908.1 → 2729.6 |
| Snowman (`snowman`)                             | desktop |   6,115,407 → 6,017,082 | 221 → 219 |   4939.5 → 6857.1 |
| Jellyfish (`jellyfish`)                         | phone   |   5,130,305 → 5,031,980 |   95 → 93 |   1928.0 → 2013.2 |
| Jellyfish (`jellyfish`)                         | desktop |   6,206,949 → 6,108,624 | 238 → 236 |   8193.3 → 6043.0 |
| Fireworks (`fireworks`)                         | phone   |   5,128,083 → 5,029,758 |   95 → 93 |   2080.3 → 2377.6 |
| Fireworks (`fireworks`)                         | desktop |   6,115,407 → 6,017,082 | 221 → 219 |  4398.6 → 11676.0 |
| Parthenon (`parthenon`)                         | phone   |   5,127,580 → 5,029,255 |   88 → 86 |   3839.1 → 1863.0 |
| Parthenon (`parthenon`)                         | desktop |   5,851,062 → 5,752,737 | 181 → 179 |   5702.4 → 6242.6 |
| Grand piano (`grand-piano`)                     | phone   |   5,126,748 → 5,028,423 |   97 → 95 |  2546.4 → 17961.3 |
| Grand piano (`grand-piano`)                     | desktop |   6,045,562 → 5,947,237 | 211 → 209 |  5342.4 → 10733.4 |
| Origami crane (`origami-crane`)                 | phone   |   5,125,797 → 5,027,472 |   95 → 93 |   1967.8 → 5412.8 |
| Origami crane (`origami-crane`)                 | desktop |   6,208,833 → 5,860,352 | 238 → 236 |  3680.7 → 12756.4 |
| Decorated tree (`decorated-tree`)               | phone   |   5,125,249 → 5,026,924 |   95 → 93 |   4168.5 → 2550.2 |
| Decorated tree (`decorated-tree`)               | desktop |   6,090,271 → 5,991,946 | 217 → 215 |   4564.1 → 8176.0 |
| Sword in the stone (`sword-in-stone`)           | phone   |   5,124,607 → 5,026,282 |   95 → 93 |  14543.0 → 2332.3 |
| Sword in the stone (`sword-in-stone`)           | desktop |   6,192,211 → 6,093,886 | 238 → 236 |  4017.1 → 10568.4 |
| Shuttlecock (`shuttlecock`)                     | phone   |   5,123,018 → 5,024,693 |   95 → 93 |   1959.2 → 2224.9 |
| Shuttlecock (`shuttlecock`)                     | desktop |   5,752,852 → 5,654,527 | 178 → 176 |   3589.4 → 4659.8 |
| Stonehenge (`stonehenge`)                       | phone   |   5,122,398 → 5,024,073 |   87 → 85 |   2232.7 → 1581.0 |
| Stonehenge (`stonehenge`)                       | desktop |   5,851,062 → 5,752,737 | 181 → 179 |  5492.9 → 44666.3 |
| Soap bubbles (`soap-bubbles`)                   | phone   |   5,122,151 → 5,023,826 |   95 → 93 |   2382.3 → 2565.0 |
| Soap bubbles (`soap-bubbles`)                   | desktop |   6,208,833 → 6,110,508 | 238 → 236 |  7003.6 → 28743.6 |
| Balloon dog (`balloon-dog`)                     | phone   |   5,121,521 → 5,023,196 |   95 → 93 |   2283.5 → 4731.5 |
| Balloon dog (`balloon-dog`)                     | desktop |   6,208,833 → 6,110,508 | 238 → 236 |  3660.9 → 24708.3 |
| Wind-up robot (`robot`)                         | phone   |   5,120,539 → 5,022,214 |   95 → 93 |   2100.9 → 2596.6 |
| Wind-up robot (`robot`)                         | desktop |   6,194,111 → 6,095,786 | 238 → 236 |  4561.0 → 14644.7 |
| Hockey puck (`hockey-puck`)                     | phone   |   5,119,214 → 5,020,889 |   95 → 93 |   1995.0 → 2306.1 |
| Hockey puck (`hockey-puck`)                     | desktop |   5,752,852 → 5,654,527 | 178 → 176 |   3516.9 → 6300.5 |
| Paper plane (`paper-plane`)                     | phone   |   5,118,987 → 5,020,662 |   95 → 93 |   1936.2 → 2520.1 |
| Paper plane (`paper-plane`)                     | desktop |   6,208,833 → 6,110,508 | 238 → 236 |   4368.1 → 7587.9 |
| Heraldic shield (`shield`)                      | phone   |   5,118,627 → 5,020,302 |   95 → 93 |   4019.5 → 2475.3 |
| Heraldic shield (`shield`)                      | desktop |   6,192,211 → 6,093,886 | 238 → 236 |  4223.1 → 11724.6 |
| Patterned egg (`patterned-egg`)                 | phone   |   5,118,099 → 5,019,774 |   95 → 93 |   1965.7 → 2150.6 |
| Patterned egg (`patterned-egg`)                 | desktop |   6,090,271 → 5,991,946 | 217 → 215 |  4520.2 → 12085.2 |
| Dragon egg (`dragon-egg`)                       | phone   |   5,117,513 → 5,019,188 |   95 → 93 |   1904.5 → 3032.7 |
| Dragon egg (`dragon-egg`)                       | desktop |   6,196,973 → 6,098,648 | 238 → 236 |   3627.5 → 8865.4 |
| Big Ben (`big-ben`)                             | phone   |   5,115,672 → 5,017,347 |   86 → 84 |   3988.5 → 6671.7 |
| Big Ben (`big-ben`)                             | desktop |   5,851,062 → 5,752,737 | 181 → 179 |   4586.7 → 6528.6 |
| Taj Mahal (`taj-mahal`)                         | phone   |   5,115,672 → 5,017,347 |   86 → 84 |  1914.4 → 10073.4 |
| Taj Mahal (`taj-mahal`)                         | desktop |   5,851,062 → 5,752,737 | 181 → 179 |   3708.4 → 4495.5 |
| Castle (`castle`)                               | phone   |   5,115,672 → 5,017,347 |   86 → 84 |   2038.0 → 2066.7 |
| Castle (`castle`)                               | desktop |   5,851,062 → 5,752,737 | 181 → 179 |   4775.3 → 5261.6 |
| Pagoda (`pagoda`)                               | phone   |   5,115,672 → 5,017,347 |   86 → 84 |   1685.6 → 1958.8 |
| Pagoda (`pagoda`)                               | desktop |   5,851,062 → 5,752,737 | 181 → 179 |   4210.6 → 4697.2 |
| Windmill (`windmill`)                           | phone   |   5,115,672 → 5,017,347 |   86 → 84 |   2207.4 → 2269.1 |
| Windmill (`windmill`)                           | desktop |   5,851,062 → 5,752,737 | 181 → 179 |   6812.0 → 4732.0 |
| Crown (`crown`)                                 | phone   |   5,115,035 → 5,016,710 |   95 → 93 |   1993.0 → 2657.6 |
| Crown (`crown`)                                 | desktop |   6,196,973 → 6,098,648 | 238 → 236 |   4708.9 → 6999.2 |
| Marble (`marble`)                               | phone   |   5,114,984 → 5,016,659 |   95 → 93 |   1702.9 → 3881.2 |
| Marble (`marble`)                               | desktop |   5,752,852 → 5,654,527 | 178 → 176 |   4610.8 → 3065.2 |
| Puzzle cube (`puzzle-cube`)                     | phone   |   5,114,695 → 5,016,370 |   95 → 93 |   1882.5 → 3024.1 |
| Puzzle cube (`puzzle-cube`)                     | desktop |   6,206,789 → 6,108,464 | 238 → 236 |   3705.4 → 7092.2 |
| Paper lantern (`paper-lantern`)                 | phone   |   5,114,373 → 5,016,048 |   95 → 93 |   2132.8 → 2053.1 |
| Paper lantern (`paper-lantern`)                 | desktop |   6,090,271 → 5,991,946 | 217 → 215 |   4183.4 → 7634.6 |
| Diya (`diya`)                                   | phone   |   5,114,271 → 5,015,946 |   95 → 93 |   2279.1 → 3039.9 |
| Diya (`diya`)                                   | desktop |   6,090,271 → 5,991,946 | 217 → 215 | 11489.2 → 12991.7 |
| Spring toy (`spring-toy`)                       | phone   |   5,114,149 → 5,015,824 |   95 → 93 |   1352.2 → 2459.9 |
| Spring toy (`spring-toy`)                       | desktop |   6,206,789 → 6,108,464 | 238 → 236 |   3573.2 → 8493.4 |
| Menorah (`menorah`)                             | phone   |   5,114,139 → 5,015,814 |   95 → 93 |   1889.5 → 3388.8 |
| Menorah (`menorah`)                             | desktop |   6,044,653 → 5,946,328 | 213 → 211 |  5728.5 → 11968.1 |
| Kite (`kite`)                                   | phone   |   5,113,109 → 5,014,784 |   95 → 93 |   1697.2 → 2654.5 |
| Kite (`kite`)                                   | desktop |   6,206,789 → 6,108,464 | 238 → 236 |   3637.8 → 6310.9 |
| Tiny planet (`planet`)                          | phone   |   5,112,438 → 5,014,113 |   94 → 92 |   1565.7 → 4872.0 |
| Tiny planet (`planet`)                          | desktop |   5,763,900 → 5,665,575 | 189 → 187 |   3042.3 → 7660.6 |
| Bow and target (`bow-and-target`)               | phone   |   5,110,895 → 5,012,570 |   95 → 93 |   2492.8 → 2036.8 |
| Bow and target (`bow-and-target`)               | desktop |   6,187,655 → 6,089,330 | 238 → 236 |  3242.1 → 13541.8 |
| Yo-yo (`yo-yo`)                                 | phone   |   5,110,823 → 5,012,498 |   95 → 93 |   1748.0 → 3048.9 |
| Yo-yo (`yo-yo`)                                 | desktop |   6,206,789 → 6,108,464 | 238 → 236 |  3280.5 → 32342.2 |
| Crossbow (`crossbow`)                           | phone   |   5,110,625 → 5,012,300 |   95 → 93 |   1703.7 → 2904.0 |
| Crossbow (`crossbow`)                           | desktop |   6,187,655 → 6,089,330 | 238 → 236 |   8585.3 → 6861.6 |
| Teddy bear (`teddy-bear`)                       | phone   |   5,110,603 → 5,012,278 |   95 → 93 |   1774.1 → 2911.0 |
| Teddy bear (`teddy-bear`)                       | desktop |   6,197,131 → 6,098,806 | 238 → 236 |  4333.4 → 26587.7 |
| Trebuchet (`trebuchet`)                         | phone   |   5,109,883 → 5,011,558 |   95 → 93 |   1943.3 → 2941.3 |
| Trebuchet (`trebuchet`)                         | desktop |   6,187,655 → 6,089,330 | 238 → 236 |   5099.0 → 6039.7 |
| Knight's helmet (`knights-helmet`)              | phone   |   5,109,681 → 5,011,356 |   95 → 93 |   1859.1 → 2495.8 |
| Knight's helmet (`knights-helmet`)              | desktop |   6,187,655 → 6,089,330 | 238 → 236 |   7683.9 → 7469.8 |
| Umbrella (`umbrella`)                           | phone   |   5,108,666 → 5,010,341 |   95 → 93 |   2423.2 → 3726.7 |
| Umbrella (`umbrella`)                           | desktop |   6,200,096 → 6,101,771 | 238 → 236 |  3612.1 → 12269.2 |
| Wizard's orb (`wizards-orb`)                    | phone   |   5,108,351 → 5,010,026 |   95 → 93 |   2557.3 → 2089.5 |
| Wizard's orb (`wizards-orb`)                    | desktop |   6,196,973 → 5,616,332 | 238 → 236 |  8688.6 → 10432.8 |
| Desk lamp (`lamp`)                              | phone   |   5,107,800 → 5,009,475 |   95 → 93 |   4505.1 → 4580.5 |
| Desk lamp (`lamp`)                              | desktop |   6,200,096 → 6,101,771 | 238 → 236 |   4848.1 → 4844.6 |
| Desk fan (`desk-fan`)                           | phone   |   5,107,328 → 5,009,003 |   95 → 93 |   2496.3 → 2460.4 |
| Desk fan (`desk-fan`)                           | desktop |   6,200,096 → 6,101,771 | 238 → 236 |   2960.1 → 6700.5 |
| Gift box (`gift-box`)                           | phone   |   5,106,724 → 5,008,399 |   95 → 93 |   1790.4 → 2553.1 |
| Gift box (`gift-box`)                           | desktop |   6,183,766 → 6,085,441 | 238 → 236 |   2904.5 → 7590.6 |
| Telescope (`telescope`)                         | phone   |   5,106,440 → 5,008,115 |   95 → 93 |   2205.1 → 3534.7 |
| Telescope (`telescope`)                         | desktop |   6,220,264 → 6,121,939 | 238 → 236 |   3913.3 → 4268.4 |
| Spinning top (`spinning-top`)                   | phone   |   5,106,035 → 5,007,710 |   95 → 93 |   2093.5 → 3384.3 |
| Spinning top (`spinning-top`)                   | desktop |   6,197,131 → 6,098,806 | 238 → 236 |   5327.3 → 7077.5 |
| Dice (`dice`)                                   | phone   |   5,105,723 → 5,007,398 |   95 → 93 |   1966.4 → 2671.3 |
| Dice (`dice`)                                   | desktop |   6,197,131 → 6,098,806 | 238 → 236 |   4760.3 → 5310.9 |
| Potion bottle (`potion-bottle`)                 | phone   |   5,104,340 → 5,006,015 |   95 → 93 |   2326.7 → 4846.7 |
| Potion bottle (`potion-bottle`)                 | desktop |   6,200,096 → 6,101,771 | 238 → 236 |   5405.6 → 6441.0 |
| Newton's cradle (`newtons-cradle`)              | phone   |   5,104,285 → 5,005,960 |   95 → 93 |   1967.5 → 3050.8 |
| Newton's cradle (`newtons-cradle`)              | desktop |   6,197,131 → 6,098,806 | 238 → 236 |   3676.6 → 7735.6 |
| Bouncy ball (`bouncy-ball`)                     | phone   |   5,104,046 → 5,005,721 |   95 → 93 |   1924.1 → 2309.3 |
| Bouncy ball (`bouncy-ball`)                     | desktop |   5,734,114 → 5,635,789 | 174 → 172 |   3532.9 → 3167.4 |
| Building bricks (`bricks`)                      | phone   |   5,103,303 → 5,004,978 |   95 → 93 |   2257.8 → 2966.5 |
| Building bricks (`bricks`)                      | desktop |   6,203,321 → 6,104,996 | 238 → 236 |   8677.5 → 7505.3 |
| Treasure chest (`chest`)                        | phone   |   5,102,232 → 5,003,907 |   95 → 93 |   4339.4 → 2624.7 |
| Treasure chest (`chest`)                        | desktop |   6,176,482 → 6,078,157 | 238 → 236 |   3392.1 → 3710.9 |
| Laptop (`laptop`)                               | phone   |   5,102,162 → 5,003,837 |   95 → 93 |   3247.6 → 2403.7 |
| Laptop (`laptop`)                               | desktop |   6,183,766 → 6,085,441 | 238 → 236 |   7605.3 → 7349.3 |
| Alarm clock (`clock`)                           | phone   |   5,101,766 → 5,003,441 |   95 → 93 |   2116.8 → 3876.8 |
| Alarm clock (`clock`)                           | desktop |   6,183,766 → 6,085,441 | 238 → 236 |   3659.3 → 5736.7 |
| Music box (`music-box`)                         | phone   |   5,101,340 → 5,003,015 |   95 → 93 |   2376.2 → 2920.3 |
| Music box (`music-box`)                         | desktop |   6,183,766 → 6,085,441 | 238 → 236 |   5570.7 → 7115.8 |
| Squash ball (`squash-ball`)                     | phone   |   5,099,952 → 5,001,627 |   95 → 93 |   1560.8 → 2319.6 |
| Squash ball (`squash-ball`)                     | desktop |   5,734,114 → 5,635,789 | 174 → 172 |   4459.6 → 3203.2 |
| Rubber duck (`rubber-duck`)                     | phone   |   5,098,951 → 5,000,626 |   95 → 93 |   2067.4 → 2982.6 |
| Rubber duck (`rubber-duck`)                     | desktop |   6,203,321 → 6,104,996 | 238 → 236 |  19282.0 → 7060.5 |
| Lacrosse ball (`lacrosse-ball`)                 | phone   |   5,098,414 → 5,000,089 |   95 → 93 |   1484.0 → 2361.4 |
| Lacrosse ball (`lacrosse-ball`)                 | desktop |   5,734,114 → 5,635,789 | 174 → 172 |   2726.8 → 3119.7 |
| Medicine ball (`medicine-ball`)                 | phone   |   5,092,088 → 4,993,763 |   95 → 93 |   1715.5 → 3647.1 |
| Medicine ball (`medicine-ball`)                 | desktop |   5,734,114 → 5,635,789 | 174 → 172 |   3029.4 → 2700.0 |
| Crystal ball (`crystal-ball`)                   | phone   |   5,089,610 → 4,991,285 |   95 → 93 |   1767.1 → 2490.3 |
| Crystal ball (`crystal-ball`)                   | desktop |   6,174,462 → 6,076,137 | 238 → 236 |  6882.7 → 17959.8 |
| Dodgeball (`dodgeball`)                         | phone   |   5,089,390 → 4,991,065 |   95 → 93 |   1485.8 → 2796.8 |
| Dodgeball (`dodgeball`)                         | desktop |   5,716,332 → 5,618,007 | 170 → 168 |   2070.5 → 2746.5 |
| Acoustic guitar (`guitar`)                      | phone   |   5,085,336 → 4,987,011 |   96 → 94 |   5028.2 → 3654.8 |
| Acoustic guitar (`guitar`)                      | desktop |   6,024,942 → 5,926,617 | 214 → 212 |  7832.7 → 11646.4 |
| Pearl (`pearl`)                                 | phone   |   5,083,692 → 4,985,367 |   95 → 93 |   1667.7 → 2262.6 |
| Pearl (`pearl`)                                 | desktop |   6,233,672 → 4,830,809 | 234 → 232 |  3664.9 → 70761.3 |
| Pickleball (`pickleball`)                       | phone   |   5,080,654 → 4,982,329 |   95 → 93 |   1705.8 → 8982.2 |
| Pickleball (`pickleball`)                       | desktop |   5,716,332 → 5,618,007 | 170 → 168 |   3947.2 → 3035.5 |
| Xylophone (`xylophone`)                         | phone   |   5,079,486 → 4,981,161 |   96 → 94 |   2072.5 → 2409.5 |
| Xylophone (`xylophone`)                         | desktop |   6,024,942 → 5,926,617 | 214 → 212 |  5655.5 → 14965.7 |
| Kidney (`kidney`)                               | phone   |   5,078,774 → 4,980,449 |   95 → 93 |   1570.7 → 1923.3 |
| Kidney (`kidney`)                               | desktop |   6,233,940 → 5,168,905 | 238 → 236 |  3956.0 → 69714.8 |
| Snare drum (`drum`)                             | phone   |   5,078,294 → 4,979,969 |   96 → 94 |   2219.3 → 2399.4 |
| Snare drum (`drum`)                             | desktop |   6,024,942 → 5,926,617 | 214 → 212 |  7052.5 → 12869.4 |
| Opal (`opal`)                                   | phone   |   5,076,496 → 4,978,171 |   95 → 93 |   1708.1 → 2176.9 |
| Opal (`opal`)                                   | desktop |   6,233,672 → 6,135,347 | 234 → 232 |  3216.7 → 41559.5 |
| Toy piano (`toy-piano`)                         | phone   |   5,076,480 → 4,978,155 |   96 → 94 |   1811.8 → 2462.5 |
| Toy piano (`toy-piano`)                         | desktop |   5,977,222 → 5,878,897 | 210 → 208 |  4836.2 → 10510.0 |
| Pool ball (`pool-ball`)                         | phone   |   5,075,974 → 4,977,649 |   95 → 93 |   1933.2 → 4841.0 |
| Pool ball (`pool-ball`)                         | desktop |   5,716,332 → 5,618,007 | 170 → 168 |   4378.7 → 3425.3 |
| Tooth (`tooth`)                                 | phone   |   5,074,948 → 4,976,623 |   95 → 93 |   1678.1 → 2133.5 |
| Tooth (`tooth`)                                 | desktop |   6,233,940 → 5,857,139 | 238 → 236 | 2730.6 → 112091.7 |
| Bowling ball (`bowling-ball`)                   | phone   |   5,072,766 → 4,974,441 |   95 → 93 |   1746.1 → 3317.8 |
| Bowling ball (`bowling-ball`)                   | desktop |   5,716,332 → 5,618,007 | 170 → 168 |   3034.9 → 3188.2 |
| Quartz cluster (`quartz-cluster`)               | phone   |   5,071,870 → 4,973,545 |   95 → 93 |   1729.4 → 1995.4 |
| Quartz cluster (`quartz-cluster`)               | desktop |   6,233,672 → 5,571,349 | 234 → 232 |  4370.0 → 58281.2 |
| Rugby ball (`rugby-ball`)                       | phone   |   5,065,580 → 4,967,255 |   95 → 93 |   1806.2 → 2752.0 |
| Rugby ball (`rugby-ball`)                       | desktop |   5,654,532 → 5,556,207 | 162 → 160 |   3286.8 → 3720.9 |
| Cricket ball (`cricket-ball`)                   | phone   |   5,065,010 → 4,966,685 |   95 → 93 |   2068.6 → 2594.0 |
| Cricket ball (`cricket-ball`)                   | desktop |   5,697,342 → 5,599,017 | 166 → 164 |   3282.0 → 3230.4 |
| Basketball (`basketball`)                       | phone   |   5,064,618 → 4,966,293 |   95 → 93 |   1654.8 → 3219.6 |
| Basketball (`basketball`)                       | desktop |   5,587,464 → 5,489,139 | 154 → 152 |   3672.3 → 3532.1 |
| Lungs (`lungs`)                                 | phone   |   5,063,938 → 4,965,613 |   95 → 93 |   1931.0 → 2413.3 |
| Lungs (`lungs`)                                 | desktop |   6,248,270 → 6,149,945 | 238 → 236 |  2939.5 → 56535.4 |
| Beating heart (`heart`)                         | phone   |   5,062,412 → 4,964,087 |   95 → 93 |   1856.2 → 2485.9 |
| Beating heart (`heart`)                         | desktop |   6,248,270 → 6,149,945 | 238 → 236 |   3585.3 → 3415.7 |
| Volleyball (`volleyball`)                       | phone   |   5,061,102 → 4,962,777 |   95 → 93 |   1794.8 → 2320.0 |
| Volleyball (`volleyball`)                       | desktop |   5,697,342 → 5,599,017 | 166 → 164 |   2927.0 → 2751.1 |
| Ruby (`ruby`)                                   | phone   |   5,060,396 → 4,962,071 |   95 → 93 |   1737.6 → 2302.2 |
| Ruby (`ruby`)                                   | desktop |   6,204,408 → 5,573,713 | 230 → 228 |  3398.1 → 23272.6 |
| Eye (`eye`)                                     | phone   |   5,060,322 → 4,961,997 |   95 → 93 |   1764.4 → 2393.4 |
| Eye (`eye`)                                     | desktop |   6,248,270 → 6,149,945 | 238 → 236 |  3111.8 → 14162.4 |
| Soccer ball (`soccer-ball`)                     | phone   |   5,060,120 → 4,961,795 |   95 → 93 |   1800.4 → 2581.8 |
| Soccer ball (`soccer-ball`)                     | desktop |   5,615,866 → 5,517,541 | 158 → 156 |   2981.2 → 3122.9 |
| Golf ball (`golf-ball`)                         | phone   |   5,059,898 → 4,961,573 |   95 → 93 |   2011.1 → 2325.3 |
| Golf ball (`golf-ball`)                         | desktop |   5,654,532 → 5,556,207 | 162 → 160 |   3505.1 → 3879.7 |
| Sapphire (`sapphire`)                           | phone   |   5,058,724 → 4,960,399 |   95 → 93 |   1879.7 → 2097.4 |
| Sapphire (`sapphire`)                           | desktop |   6,233,672 → 5,579,343 | 234 → 232 |  3573.9 → 75317.1 |
| American football (`american-football`)         | phone   |   5,058,288 → 4,959,963 |   95 → 93 |   1923.4 → 3807.9 |
| American football (`american-football`)         | desktop |   5,615,866 → 5,517,541 | 158 → 156 |   2906.8 → 4237.4 |
| Baseball (`baseball`)                           | phone   |   5,057,826 → 4,959,501 |   95 → 93 |   2194.2 → 3610.4 |
| Baseball (`baseball`)                           | desktop |   5,615,866 → 5,517,541 | 158 → 156 |   4441.1 → 9381.1 |
| Water polo ball (`water-polo-ball`)             | phone   |   5,057,492 → 4,959,167 |   95 → 93 |   2349.7 → 2673.5 |
| Water polo ball (`water-polo-ball`)             | desktop |   5,697,342 → 5,599,017 | 166 → 164 |   3626.9 → 2927.6 |
| Softball (`softball`)                           | phone   |   5,057,138 → 4,958,813 |   95 → 93 |   2107.0 → 4998.2 |
| Softball (`softball`)                           | desktop |   5,654,532 → 5,556,207 | 162 → 160 |   3661.1 → 3661.7 |
| Amethyst geode (`amethyst-geode`)               | phone   |   5,056,280 → 4,957,955 |   95 → 93 |   1977.5 → 2827.9 |
| Amethyst geode (`amethyst-geode`)               | desktop |   6,204,408 → 6,106,083 | 230 → 228 |  3962.5 → 23514.3 |
| Tennis ball (`tennis-ball`)                     | phone   |   5,055,912 → 4,957,587 |   95 → 93 |   2158.0 → 2500.2 |
| Tennis ball (`tennis-ball`)                     | desktop |   5,615,866 → 5,517,541 | 158 → 156 |   3205.3 → 4087.6 |
| Emerald (`emerald`)                             | phone   |   5,055,164 → 4,956,839 |   95 → 93 |   1753.4 → 1941.8 |
| Emerald (`emerald`)                             | desktop |   6,204,408 → 6,106,083 | 230 → 228 |  3113.7 → 30899.5 |
| Ping-pong ball (`ping-pong-ball`)               | phone   |   5,055,114 → 4,956,789 |   95 → 93 |   1750.2 → 2404.0 |
| Ping-pong ball (`ping-pong-ball`)               | desktop |   5,697,342 → 5,599,017 | 166 → 164 |   3800.2 → 2645.6 |
| Diamond (`diamond`)                             | phone   |   5,054,278 → 4,955,953 |   95 → 93 |   2149.6 → 2168.8 |
| Diamond (`diamond`)                             | desktop |   6,204,408 → 6,106,083 | 230 → 228 |  3492.4 → 54175.4 |
| Brain (`brain`)                                 | phone   |   5,053,658 → 4,955,333 |   95 → 93 |   1653.6 → 2412.1 |
| Brain (`brain`)                                 | desktop |   6,248,270 → 6,149,945 | 238 → 236 |  3894.7 → 38372.7 |
| Beach ball (`beach-ball`)                       | phone   |   5,052,896 → 4,954,571 |   95 → 93 |   1762.1 → 2878.6 |
| Beach ball (`beach-ball`)                       | desktop |   5,654,532 → 5,556,207 | 162 → 160 |   2705.5 → 3544.0 |
| Periodic table (`periodic-table`)               | phone   |   5,042,867 → 4,944,542 |   97 → 95 |   2156.1 → 2786.0 |
| Periodic table (`periodic-table`)               | desktop |   6,165,733 → 6,067,408 | 228 → 226 |  3864.2 → 32688.1 |
| Chess set (`chess-set`)                         | phone   |   5,041,226 → 4,942,901 |   96 → 94 |   2201.8 → 3263.1 |
| Chess set (`chess-set`)                         | desktop |   6,115,354 → 6,017,029 | 239 → 237 |   4960.2 → 9466.0 |
| Donut (`donut`)                                 | phone   |   5,003,958 → 4,905,633 |   94 → 92 |   2146.1 → 2237.0 |
| Donut (`donut`)                                 | desktop |   6,093,646 → 5,995,321 | 237 → 235 |  3193.3 → 14326.0 |
| Torus (`torus`)                                 | phone   |   4,969,001 → 4,870,676 |   95 → 93 |   1819.1 → 2785.7 |
| Torus (`torus`)                                 | desktop |   5,494,075 → 5,395,750 | 154 → 152 |   2779.1 → 3761.5 |
| Neon knot (`knot`)                              | phone   |   4,957,166 → 4,858,841 |   94 → 92 |   2121.6 → 2609.4 |
| Neon knot (`knot`)                              | desktop |   5,482,572 → 5,384,247 | 153 → 151 |  21180.1 → 7688.5 |
| Jelly blob (`blob`)                             | phone   |   4,955,732 → 4,857,407 |   94 → 92 |   8469.1 → 2737.9 |
| Jelly blob (`blob`)                             | desktop |   5,482,572 → 5,384,247 | 153 → 151 |   3772.2 → 3007.5 |

## Every labs toy

Bytes and requests are opening observations; time is navigation to the first ready submitted render.
Values show before → after.

| Toy / ID                                         | Setting |              Body bytes |  Requests |    First frame ms |
| ------------------------------------------------ | ------- | ----------------------: | --------: | ----------------: |
| Your book (`your-book`)                          | phone   | 14,364,458 → 14,266,133 |   99 → 97 |   2162.4 → 2001.6 |
| Your book (`your-book`)                          | desktop | 16,157,052 → 16,058,727 | 242 → 240 |  10070.5 → 6192.8 |
| Video to 3D (`video-3d`)                         | phone   | 13,221,299 → 13,122,974 | 102 → 100 |   1925.5 → 2153.1 |
| Video to 3D (`video-3d`)                         | desktop | 14,903,543 → 14,805,218 | 245 → 243 |   4030.9 → 5313.0 |
| Splat toolkit (`splat-toolkit`)                  | phone   | 11,636,644 → 11,538,319 | 109 → 107 |   6443.9 → 7514.0 |
| Splat toolkit (`splat-toolkit`)                  | desktop | 13,323,124 → 13,224,799 | 252 → 250 | 10830.4 → 11307.9 |
| Living city (`living-city`)                      | phone   | 10,560,288 → 10,461,963 |   98 → 96 |   2264.5 → 5922.0 |
| Living city (`living-city`)                      | desktop | 12,139,426 → 12,041,101 | 227 → 225 |   6143.9 → 9876.7 |
| Powers of ten (`powers-of-ten`)                  | phone   |   9,372,146 → 9,273,821 | 102 → 100 |   4111.3 → 2668.1 |
| Powers of ten (`powers-of-ten`)                  | desktop |   6,892,405 → 7,317,344 | 245 → 306 |   2129.4 → 4525.3 |
| Point clouds (`point-clouds`)                    | phone   |   9,223,395 → 9,125,070 | 109 → 107 |   4859.5 → 4120.5 |
| Point clouds (`point-clouds`)                    | desktop | 10,913,903 → 10,815,578 | 252 → 250 | 10797.0 → 14200.1 |
| Celestial globe (`celestial-globe`)              | phone   |   9,184,544 → 6,785,978 |   95 → 95 |   1652.7 → 2767.4 |
| Celestial globe (`celestial-globe`)              | desktop |   9,835,436 → 9,830,557 | 170 → 170 |   3615.9 → 3458.1 |
| Stannern meteorite (`stannern-meteorites`)       | phone   |   9,150,662 → 9,145,783 |   95 → 95 |  1551.0 → 11517.5 |
| Stannern meteorite (`stannern-meteorites`)       | desktop |   9,837,704 → 9,832,825 | 170 → 170 |   3401.5 → 3618.1 |
| Crochet Earth (`crochet-earth`)                  | phone   |   9,144,010 → 9,045,685 |   95 → 93 |   2093.0 → 4728.4 |
| Crochet Earth (`crochet-earth`)                  | desktop | 12,825,485 → 12,727,160 | 158 → 156 |   2856.8 → 8304.1 |
| Seeded bread loaf (`seeded-loaf`)                | phone   |   9,105,749 → 9,007,424 |   90 → 88 |   1800.0 → 5475.1 |
| Seeded bread loaf (`seeded-loaf`)                | desktop | 12,610,129 → 12,511,804 | 138 → 136 |   3408.0 → 8401.2 |
| Dog plush (`dog-plush`)                          | phone   |   9,102,308 → 9,003,983 |   95 → 93 |   2135.1 → 4476.7 |
| Dog plush (`dog-plush`)                          | desktop | 13,118,874 → 13,020,549 | 150 → 148 |   3617.0 → 4578.9 |
| Alum crystal (`alum-crystal`)                    | phone   |   9,078,704 → 8,980,379 |   95 → 93 |   2077.8 → 3041.6 |
| Alum crystal (`alum-crystal`)                    | desktop | 11,358,160 → 11,259,835 | 146 → 144 |   3049.6 → 4632.2 |
| Mushroom (photo) (`mushroom-photo`)              | phone   |   9,077,537 → 8,979,212 |   95 → 93 |   3373.3 → 5487.3 |
| Mushroom (photo) (`mushroom-photo`)              | desktop | 15,028,977 → 14,930,652 | 158 → 156 |   3525.3 → 6031.9 |
| Moving photo to 3D (`moving-photo-3d`)           | phone   |   9,056,706 → 8,958,381 | 119 → 117 |   7136.7 → 6610.6 |
| Moving photo to 3D (`moving-photo-3d`)           | desktop | 10,745,196 → 10,646,871 | 262 → 260 | 11700.9 → 13535.7 |
| Souvenir turtle (`turtle-souvenir`)              | phone   |   9,052,367 → 8,954,042 |   95 → 93 |   2114.8 → 2493.3 |
| Souvenir turtle (`turtle-souvenir`)              | desktop | 18,165,984 → 18,067,659 | 150 → 148 |   5838.2 → 5293.3 |
| Armillary sphere (`armillary-sphere`)            | phone   |   9,039,988 → 9,035,109 |   95 → 95 |   1678.1 → 3042.3 |
| Armillary sphere (`armillary-sphere`)            | desktop |   9,707,000 → 9,702,121 | 170 → 170 |   3542.7 → 3717.7 |
| Murex shell (`murex-shell`)                      | phone   |   9,031,556 → 8,933,231 |   95 → 93 |   1385.3 → 2700.9 |
| Murex shell (`murex-shell`)                      | desktop | 20,342,136 → 20,243,811 | 154 → 152 |   4123.6 → 4547.5 |
| Golden maple (`maple-tree`)                      | phone   |   9,015,497 → 8,917,172 |   95 → 93 |   2240.4 → 5122.1 |
| Golden maple (`maple-tree`)                      | desktop | 20,517,598 → 20,419,273 | 162 → 160 |   4797.5 → 5117.1 |
| Cave lioness (`cave-lioness`)                    | phone   |   9,007,837 → 8,909,512 |   95 → 93 |   1977.1 → 4374.5 |
| Cave lioness (`cave-lioness`)                    | desktop | 20,502,265 → 20,403,940 | 150 → 148 |   4965.0 → 5796.0 |
| Toy T. rex (`toy-trex`)                          | phone   |   8,999,963 → 8,901,638 |   95 → 93 |   2191.1 → 5304.9 |
| Toy T. rex (`toy-trex`)                          | desktop | 15,563,892 → 15,465,567 | 146 → 144 |   3676.1 → 5130.7 |
| Peonies in a vase (`peony`)                      | phone   |   8,997,466 → 8,899,141 |   95 → 93 |   1772.6 → 3726.9 |
| Peonies in a vase (`peony`)                      | desktop | 20,542,309 → 20,443,984 | 162 → 160 |   6143.7 → 4826.0 |
| Monkey doll (`monkey-doll`)                      | phone   |   8,969,773 → 8,871,448 |   95 → 93 |   1702.3 → 5575.6 |
| Monkey doll (`monkey-doll`)                      | desktop | 10,831,572 → 10,733,247 | 146 → 144 |   3428.8 → 3714.0 |
| Desk globe (`desk-globe`)                        | phone   |   8,967,086 → 8,868,761 |   95 → 93 |   2050.6 → 2541.4 |
| Desk globe (`desk-globe`)                        | desktop | 10,428,001 → 10,329,676 | 162 → 160 |   8818.5 → 4394.7 |
| Sunflower (photo) (`sunflower-photo`)            | phone   |   8,949,736 → 8,904,540 |   94 → 93 |   1847.3 → 2642.9 |
| Sunflower (photo) (`sunflower-photo`)            | desktop | 15,554,705 → 15,456,380 | 154 → 152 |   3240.7 → 4217.0 |
| Cherry blossom (photo) (`cherry-blossom-photo`)  | phone   |   8,920,766 → 8,822,441 |   95 → 93 |   1655.4 → 3082.3 |
| Cherry blossom (photo) (`cherry-blossom-photo`)  | desktop | 20,390,670 → 20,292,345 | 162 → 160 |   7452.8 → 5113.0 |
| BMX bicycle (`bmx-bike`)                         | phone   |   8,897,950 → 8,799,625 |   95 → 93 |   1808.2 → 3017.0 |
| BMX bicycle (`bmx-bike`)                         | desktop | 12,851,520 → 12,753,195 | 154 → 152 |   3519.4 → 4337.8 |
| Physalis (`physalis`)                            | phone   |   8,891,705 → 8,793,380 |   94 → 92 |   1583.3 → 2902.3 |
| Physalis (`physalis`)                            | desktop | 12,611,275 → 12,512,950 | 142 → 140 |   3997.3 → 4248.3 |
| Soda can (`soda-can`)                            | phone   |   8,863,490 → 5,877,721 |   95 → 95 |   7345.8 → 2021.8 |
| Soda can (`soda-can`)                            | desktop | 10,199,120 → 10,194,241 | 238 → 238 |  11580.5 → 5252.9 |
| Cone shell (`cone-shell`)                        | phone   |   8,851,009 → 8,752,684 |   95 → 93 |   1773.9 → 2271.2 |
| Cone shell (`cone-shell`)                        | desktop | 12,072,262 → 11,973,937 | 166 → 164 |   3357.9 → 3234.9 |
| Triceratops skull (`triceratops-skull`)          | phone   |   8,836,751 → 8,791,555 |   94 → 93 |   1715.8 → 2270.3 |
| Triceratops skull (`triceratops-skull`)          | desktop | 13,580,943 → 13,482,618 | 166 → 164 |   3450.3 → 4093.2 |
| Stollen (`stollen`)                              | phone   |   8,820,442 → 8,722,117 |   92 → 90 |   2168.9 → 3012.1 |
| Stollen (`stollen`)                              | desktop | 10,331,786 → 10,233,461 | 142 → 140 |   2330.8 → 5155.7 |
| Water bottle (`water-bottle`)                    | phone   |   8,613,520 → 5,997,575 |   95 → 95 |   3130.3 → 3314.4 |
| Water bottle (`water-bottle`)                    | desktop |   9,933,206 → 9,928,327 | 238 → 238 |   3529.3 → 7082.6 |
| Fluorite (`fluorite-crystal`)                    | phone   |   8,589,762 → 8,584,883 |   95 → 95 |  10542.2 → 4268.8 |
| Fluorite (`fluorite-crystal`)                    | desktop |   9,284,564 → 9,279,685 | 170 → 170 |  10475.5 → 3766.6 |
| Ammonite (`ammonite-agate`)                      | phone   |   8,570,884 → 8,566,005 |   95 → 95 |   8201.5 → 3318.4 |
| Ammonite (`ammonite-agate`)                      | desktop |   9,327,498 → 9,322,619 | 174 → 174 |  11751.7 → 3457.1 |
| Pyrite (`pyrite-cubes`)                          | phone   |   8,559,712 → 8,554,833 |   95 → 95 |   2335.8 → 3401.4 |
| Pyrite (`pyrite-cubes`)                          | desktop |   9,328,324 → 9,323,445 | 174 → 174 |   4001.8 → 4860.3 |
| Megalodon tooth (`megalodon-tooth`)              | phone   |   8,552,420 → 8,547,541 |   95 → 95 |   2094.2 → 2270.7 |
| Megalodon tooth (`megalodon-tooth`)              | desktop |   9,327,848 → 9,322,969 | 174 → 174 |   3992.9 → 4571.0 |
| Galaxy in a box (`galaxy-box`)                   | phone   |   8,551,582 → 8,453,257 | 109 → 107 |   1560.4 → 1814.7 |
| Galaxy in a box (`galaxy-box`)                   | desktop | 10,219,266 → 10,120,941 | 252 → 250 |   6692.6 → 5470.3 |
| Cactus (photo 2) (`cactus-real`)                 | phone   |   8,441,678 → 8,343,353 |   95 → 93 |   2094.1 → 3505.2 |
| Cactus (photo 2) (`cactus-real`)                 | desktop |   9,736,042 → 9,637,717 | 158 → 156 |   3168.1 → 7578.9 |
| Morasko meteorite (`morasko-meteorite`)          | phone   |   8,289,424 → 8,284,545 |   95 → 95 |   4922.5 → 3227.1 |
| Morasko meteorite (`morasko-meteorite`)          | desktop |   9,051,390 → 9,046,511 | 174 → 174 |   6140.8 → 3686.1 |
| Bonsai tree (photo) (`bonsai-photo`)             | phone   |   8,259,750 → 8,161,425 |   95 → 93 |   3281.5 → 6692.3 |
| Bonsai tree (photo) (`bonsai-photo`)             | desktop |   9,560,149 → 9,461,824 | 158 → 156 |   3544.0 → 3286.4 |
| Knight on a horse (`knight-horse`)               | phone   |   8,152,846 → 8,054,521 |   95 → 93 |   1669.1 → 3323.7 |
| Knight on a horse (`knight-horse`)               | desktop |   9,566,041 → 9,467,716 | 166 → 164 |   2823.5 → 3151.4 |
| The real Earth (`real-earth`)                    | phone   |   8,041,211 → 7,942,886 | 108 → 106 |   2350.4 → 4007.9 |
| The real Earth (`real-earth`)                    | desktop |   9,316,931 → 9,218,606 | 251 → 249 |  4065.0 → 10298.7 |
| Puffin (`puffin`)                                | phone   |   7,932,190 → 7,833,865 |   95 → 93 |   2350.3 → 2694.9 |
| Puffin (`puffin`)                                | desktop |   9,010,041 → 8,911,716 | 146 → 144 |   2361.8 → 3491.3 |
| Super-resolution microscope (`smlm-microscope`)  | phone   |   7,909,627 → 7,811,302 | 109 → 107 |   2290.9 → 1836.3 |
| Super-resolution microscope (`smlm-microscope`)  | desktop |   9,582,113 → 9,483,788 | 252 → 250 |   3633.4 → 6343.4 |
| Space Launch System (`sls`)                      | phone   |   7,647,543 → 7,549,218 | 104 → 102 |   3763.0 → 4628.2 |
| Space Launch System (`sls`)                      | desktop |   9,096,459 → 8,998,134 | 247 → 245 |  5488.5 → 20314.9 |
| Sushi boat (`sushi-boat`)                        | phone   |   7,279,749 → 7,234,553 |   88 → 87 |   1901.7 → 3645.4 |
| Sushi boat (`sushi-boat`)                        | desktop |   8,600,651 → 8,502,326 | 138 → 136 |   2982.2 → 3680.1 |
| Page Breaker (`page-breaker`)                    | phone   |   7,261,118 → 7,162,793 | 105 → 103 |   1829.7 → 1715.0 |
| Page Breaker (`page-breaker`)                    | desktop |   7,685,582 → 8,904,291 | 248 → 246 |   4010.7 → 2600.1 |
| Money tree (`money-tree`)                        | phone   |   7,176,763 → 7,078,438 |   95 → 93 |   1774.4 → 3084.8 |
| Money tree (`money-tree`)                        | desktop |   8,479,641 → 8,381,316 | 166 → 164 |   2905.8 → 3286.5 |
| Picture lab (`picture-lab`)                      | phone   |   7,170,354 → 7,072,029 |  100 → 98 |   1993.1 → 2035.8 |
| Picture lab (`picture-lab`)                      | desktop |   8,973,239 → 8,874,914 | 241 → 239 |   4965.2 → 4147.1 |
| Heart donut (`heart-donut`)                      | phone   |   7,155,287 → 7,056,962 |   88 → 86 |   1835.1 → 4997.2 |
| Heart donut (`heart-donut`)                      | desktop |   8,433,818 → 8,335,493 | 138 → 136 |   2343.7 → 4126.3 |
| Space Shuttle (`space-shuttle`)                  | phone   |   6,699,579 → 6,601,254 | 104 → 102 |   3405.0 → 4096.7 |
| Space Shuttle (`space-shuttle`)                  | desktop |   8,161,807 → 8,063,482 | 247 → 245 |  5551.6 → 40495.6 |
| Cowboy steak (`steak`)                           | phone   |   6,646,343 → 6,548,018 |   91 → 89 |   3100.6 → 3076.9 |
| Cowboy steak (`steak`)                           | desktop |   7,736,070 → 7,637,745 | 138 → 136 |   2838.5 → 6641.1 |
| The real Venus (`real-venus`)                    | phone   |   6,525,083 → 6,426,758 | 106 → 104 |   1871.6 → 6593.6 |
| The real Venus (`real-venus`)                    | desktop |   7,827,371 → 6,670,718 | 249 → 247 |  4355.9 → 48675.7 |
| The real Mercury (`real-mercury`)                | phone   |   6,518,273 → 6,419,948 | 106 → 104 |  2021.0 → 14347.1 |
| The real Mercury (`real-mercury`)                | desktop |   7,790,599 → 7,692,274 | 249 → 247 |  5015.0 → 15814.4 |
| Mount St. Helens (`st-helens`)                   | phone   |   6,474,345 → 6,376,020 |   99 → 97 |   2217.4 → 2510.9 |
| Mount St. Helens (`st-helens`)                   | desktop |   8,082,241 → 7,983,916 | 232 → 230 |   3757.2 → 7127.3 |
| Cryo-EM map (`cryoem-map`)                       | phone   |   6,464,168 → 6,365,843 | 110 → 108 |   2496.4 → 2895.7 |
| Cryo-EM map (`cryoem-map`)                       | desktop |   8,137,058 → 8,038,733 | 253 → 251 |   4650.4 → 6456.9 |
| The real Moon (`real-moon`)                      | phone   |   6,443,154 → 6,344,829 | 106 → 104 |   1735.6 → 2895.6 |
| The real Moon (`real-moon`)                      | desktop |   7,723,232 → 7,624,907 | 249 → 247 |   4872.8 → 6707.0 |
| Song landscape (`song-landscape`)                | phone   |   6,426,976 → 6,328,651 | 110 → 108 |   1807.5 → 1554.8 |
| Song landscape (`song-landscape`)                | desktop |   8,129,786 → 8,031,461 | 253 → 251 |   3983.6 → 3539.6 |
| Splat mirror (`splat-mirror`)                    | phone   |   6,397,173 → 6,298,848 | 106 → 104 |   2175.3 → 1431.4 |
| Splat mirror (`splat-mirror`)                    | desktop |   8,124,957 → 8,026,632 | 249 → 247 |   4933.0 → 3130.5 |
| Saturn V (`saturn-v`)                            | phone   |   6,322,687 → 6,224,362 | 104 → 102 |   3874.0 → 4196.0 |
| Saturn V (`saturn-v`)                            | desktop |   7,735,971 → 7,637,646 | 247 → 245 |   4687.3 → 7192.5 |
| Photo to 3D (`photo-3d`)                         | phone   |   6,321,764 → 6,223,439 | 103 → 101 |   2664.0 → 2198.8 |
| Photo to 3D (`photo-3d`)                         | desktop |   8,031,576 → 7,933,251 | 246 → 244 |  5223.6 → 10477.5 |
| The real Mars (`real-mars`)                      | phone   |   6,244,271 → 6,145,946 | 106 → 104 |   2074.0 → 2905.2 |
| The real Mars (`real-mars`)                      | desktop |   7,524,017 → 7,425,692 | 249 → 247 |   3630.0 → 6096.1 |
| Grand Canyon (`grand-canyon`)                    | phone   |   6,241,220 → 6,142,895 |   99 → 97 |   2536.0 → 2764.6 |
| Grand Canyon (`grand-canyon`)                    | desktop |   7,872,748 → 7,774,423 | 236 → 234 |   3821.8 → 9822.1 |
| Orange (photo) (`orange-photo`)                  | phone   |   6,144,781 → 6,046,456 |   93 → 91 |   1939.2 → 5709.8 |
| Orange (photo) (`orange-photo`)                  | desktop |   7,213,362 → 7,115,037 | 142 → 140 |   3082.5 → 2891.8 |
| Crystal (`crystal-gem`)                          | phone   |   6,049,531 → 5,951,206 |   95 → 93 |   1907.1 → 1937.7 |
| Crystal (`crystal-gem`)                          | desktop |   6,974,396 → 6,876,071 | 142 → 140 |   2408.0 → 3240.8 |
| Picture QR (`qr-picture`)                        | phone   |   5,952,376 → 5,854,051 | 106 → 104 |   5503.7 → 4851.8 |
| Picture QR (`qr-picture`)                        | desktop |   7,637,756 → 7,539,431 | 249 → 247 |  14663.3 → 7545.0 |
| Photo Dash (`photo-dash`)                        | phone   |   5,937,379 → 5,839,054 | 103 → 101 |   1728.5 → 2382.6 |
| Photo Dash (`photo-dash`)                        | desktop |   7,643,345 → 7,545,020 | 246 → 244 |  1997.3 → 28866.5 |
| Pluto, Ceres and Vesta (`real-small-worlds`)     | phone   |   5,936,490 → 5,838,165 | 106 → 104 |   1827.2 → 4539.7 |
| Pluto, Ceres and Vesta (`real-small-worlds`)     | desktop |   7,267,332 → 7,169,007 | 249 → 247 |  6967.9 → 17155.0 |
| Photo album (`photo-album`)                      | phone   |   5,894,926 → 5,796,601 | 103 → 101 |   1932.8 → 1642.3 |
| Photo album (`photo-album`)                      | desktop |   7,640,372 → 7,542,047 | 246 → 244 |   4504.1 → 4903.2 |
| Tides at Bar Harbor (`tide-harbor`)              | phone   |   5,851,444 → 5,753,119 |   99 → 97 |   3035.1 → 2709.6 |
| Tides at Bar Harbor (`tide-harbor`)              | desktop |   7,473,504 → 7,375,179 | 232 → 230 |   3766.8 → 7425.2 |
| Soft Landing (`soft-landing`)                    | phone   |   5,827,957 → 5,729,632 | 102 → 100 |   3354.5 → 1690.5 |
| Soft Landing (`soft-landing`)                    | desktop |   7,556,013 → 7,457,688 | 245 → 243 |   4172.6 → 4566.0 |
| Walnut CT scan (`walnut-ct`)                     | phone   |   5,771,607 → 5,673,282 |   96 → 94 |   1755.8 → 1962.7 |
| Walnut CT scan (`walnut-ct`)                     | desktop |   7,428,477 → 7,330,152 | 237 → 235 |   3639.4 → 8372.7 |
| Volume viewer (`volume-viewer`)                  | phone   |   5,766,561 → 5,668,236 |   98 → 96 |   6423.9 → 3960.1 |
| Volume viewer (`volume-viewer`)                  | desktop |   7,517,849 → 7,419,524 | 241 → 239 |   5145.7 → 6650.0 |
| Earthquakes (`earthquakes`)                      | phone   |   5,761,980 → 5,663,655 |  100 → 98 |   2197.8 → 6149.9 |
| Earthquakes (`earthquakes`)                      | desktop |   7,390,732 → 7,292,407 | 229 → 227 |  3647.5 → 12783.7 |
| Other barcodes (`barcodes`)                      | phone   |   5,758,542 → 5,660,217 | 105 → 103 |   1731.3 → 1571.7 |
| Other barcodes (`barcodes`)                      | desktop |   7,472,602 → 7,374,277 | 248 → 246 |   4946.1 → 3558.8 |
| Stone Belt (`stone-belt`)                        | phone   |   5,746,112 → 5,647,787 | 102 → 100 |   1737.9 → 9077.1 |
| Stone Belt (`stone-belt`)                        | desktop |   7,490,398 → 7,392,073 | 245 → 243 |   4266.6 → 2967.0 |
| Stork migration (`stork-migration`)              | phone   |   5,736,893 → 5,638,568 |   99 → 97 |   2017.2 → 2288.6 |
| Stork migration (`stork-migration`)              | desktop |   7,317,709 → 7,219,384 | 228 → 226 |   5002.4 → 5715.1 |
| Real moons (`real-moons`)                        | phone   |   5,699,634 → 5,601,309 | 105 → 103 |   1559.4 → 4249.9 |
| Real moons (`real-moons`)                        | desktop |   7,019,616 → 6,921,291 | 248 → 246 | 12507.7 → 28175.6 |
| QR from real things (`qr-build`)                 | phone   |   5,697,933 → 5,599,608 | 105 → 103 |   1628.8 → 2120.3 |
| QR from real things (`qr-build`)                 | desktop |   7,393,479 → 7,295,154 | 248 → 246 |   3780.0 → 3718.5 |
| Terrain in a box (`terrain-box`)                 | phone   |   5,665,836 → 5,567,511 | 109 → 107 |   1712.3 → 1857.5 |
| Terrain in a box (`terrain-box`)                 | desktop |   7,316,572 → 7,218,247 | 252 → 250 |   5382.9 → 6048.3 |
| QR damage lab (`qr-damage`)                      | phone   |   5,663,553 → 5,565,228 | 103 → 101 |   1769.9 → 1651.4 |
| QR damage lab (`qr-damage`)                      | desktop |   7,372,741 → 7,274,416 | 246 → 244 |   3613.7 → 4575.5 |
| Contour lab (`contour-lab`)                      | phone   |   5,663,140 → 5,564,815 | 109 → 107 |   1537.6 → 3826.5 |
| Contour lab (`contour-lab`)                      | desktop |   7,316,572 → 7,218,247 | 252 → 250 |   6870.0 → 4551.5 |
| Screen (`screen`)                                | phone   |   5,658,172 → 5,937,816 |   99 → 97 |   3370.0 → 3158.5 |
| Screen (`screen`)                                | desktop |   7,750,307 → 7,274,013 | 242 → 240 |   4243.2 → 8322.0 |
| The sea floor (`sea-floor`)                      | phone   |   5,639,104 → 5,540,779 |   98 → 96 |   2637.2 → 2394.3 |
| The sea floor (`sea-floor`)                      | desktop |   7,244,844 → 7,146,519 | 231 → 229 |   3856.2 → 7692.6 |
| Baked chest (`baked-chest`)                      | phone   |   5,604,277 → 5,505,952 |   98 → 96 |   1376.0 → 1791.3 |
| Baked chest (`baked-chest`)                      | desktop |   8,348,973 → 8,250,648 | 242 → 240 |   3119.4 → 7096.5 |
| Souvenir elephant (`elephant-souvenir`)          | phone   |   5,596,036 → 5,497,711 |   95 → 93 |   1457.6 → 3373.9 |
| Souvenir elephant (`elephant-souvenir`)          | desktop |   6,138,491 → 6,040,166 | 150 → 148 |   2139.0 → 3168.8 |
| Sound in a box (`chladni-cell`)                  | phone   |   5,558,627 → 5,460,302 | 106 → 104 |   1841.1 → 1493.0 |
| Sound in a box (`chladni-cell`)                  | desktop |   7,270,851 → 7,172,526 | 249 → 247 |   4344.3 → 3102.6 |
| Thermal ellipsoids (`thermal-ellipsoids`)        | phone   |   5,551,100 → 5,452,775 | 109 → 107 |   1922.9 → 1820.8 |
| Thermal ellipsoids (`thermal-ellipsoids`)        | desktop |   7,228,052 → 7,129,727 | 252 → 250 |   4495.5 → 6945.0 |
| Real galaxies (`real-galaxies`)                  | phone   |   5,547,507 → 5,449,182 | 104 → 102 |   7919.1 → 3331.5 |
| Real galaxies (`real-galaxies`)                  | desktop |   6,935,917 → 7,360,856 | 247 → 309 |   4214.4 → 9450.4 |
| Chladni plate (`chladni-plate`)                  | phone   |   5,538,789 → 5,440,464 | 106 → 104 |   2789.6 → 1453.6 |
| Chladni plate (`chladni-plate`)                  | desktop |   7,243,809 → 7,145,484 | 249 → 247 |   3357.5 → 3919.4 |
| Hurricane (`hurricane`)                          | phone   |   5,534,178 → 5,435,853 |   99 → 97 |   3543.0 → 2281.3 |
| Hurricane (`hurricane`)                          | desktop |   7,159,892 → 7,061,567 | 232 → 230 |   3329.4 → 5269.9 |
| Stars near the Sun (`nearby-stars`)              | phone   |   5,524,316 → 5,425,991 | 104 → 102 |   1350.9 → 4299.7 |
| Stars near the Sun (`nearby-stars`)              | desktop |   6,867,508 → 6,371,261 | 247 → 245 |  2556.0 → 32295.9 |
| Room echo meter (`room-echo`)                    | phone   |   5,520,066 → 5,421,741 | 104 → 102 |   1943.6 → 1558.7 |
| Room echo meter (`room-echo`)                    | desktop |   7,241,022 → 7,142,697 | 247 → 245 |   4156.6 → 4867.4 |
| Real elements (`real-elements`)                  | phone   |   5,507,952 → 5,409,627 | 103 → 101 |   2589.9 → 4137.6 |
| Real elements (`real-elements`)                  | desktop |   7,140,996 → 6,559,027 | 246 → 244 |  7409.4 → 58043.5 |
| Night sky (`night-sky`)                          | phone   |   5,506,865 → 5,408,540 |   98 → 96 |   2340.3 → 9184.2 |
| Night sky (`night-sky`)                          | desktop |   6,990,751 → 6,892,426 | 241 → 239 |   3540.0 → 4720.7 |
| The solar system on real orbits (`solar-orbits`) | phone   |   5,500,292 → 5,401,967 | 110 → 108 |   2431.2 → 3334.1 |
| The solar system on real orbits (`solar-orbits`) | desktop |   6,974,756 → 6,277,969 | 253 → 251 |  3178.5 → 18062.3 |
| Relief map (`relief-map`)                        | phone   |   5,482,783 → 5,384,458 |   98 → 96 |   2650.4 → 5724.7 |
| Relief map (`relief-map`)                        | desktop |   7,059,655 → 6,961,330 | 227 → 225 | 15122.2 → 18710.4 |
| Picture frame (`picture-frame`)                  | phone   |   5,463,837 → 5,365,512 |   98 → 96 |   1801.6 → 1372.2 |
| Picture frame (`picture-frame`)                  | desktop |   7,171,037 → 7,072,712 | 241 → 239 |   3135.8 → 2977.6 |
| QR code (`qr-code`)                              | phone   |   5,451,346 → 5,353,021 | 103 → 101 |   4989.6 → 2237.1 |
| QR code (`qr-code`)                              | desktop |   7,165,624 → 7,067,299 | 246 → 244 |   3699.5 → 4124.9 |
| Real star systems (`star-systems`)               | phone   |   5,434,867 → 5,336,542 | 104 → 102 |   2887.5 → 1916.1 |
| Real star systems (`star-systems`)               | desktop |   6,812,099 → 6,713,774 | 247 → 245 |  2384.3 → 12934.2 |
| Three QR codes in one (`qr-three`)               | phone   |   5,422,030 → 5,323,705 | 102 → 100 |   2173.9 → 1910.3 |
| Three QR codes in one (`qr-three`)               | desktop |   7,115,856 → 7,017,531 | 245 → 243 |   4653.8 → 4467.3 |
| How a QR code works (`qr-anatomy`)               | phone   |   5,403,888 → 5,305,563 | 102 → 100 |   1548.5 → 1419.6 |
| How a QR code works (`qr-anatomy`)               | desktop |   7,115,856 → 7,017,531 | 245 → 243 |   3084.3 → 2932.8 |
| Molecule viewer (`molecule-viewer`)              | phone   |   5,400,672 → 5,302,347 | 120 → 118 |   2100.1 → 2409.3 |
| Molecule viewer (`molecule-viewer`)              | desktop |   6,997,466 → 6,483,985 | 263 → 261 |  3140.3 → 15760.9 |
| Model to splats (`model-splats`)                 | phone   |   5,368,658 → 5,270,333 |   97 → 95 |   2368.1 → 2155.2 |
| Model to splats (`model-splats`)                 | desktop |   7,101,632 → 7,003,307 | 240 → 238 |   5393.5 → 8210.6 |
| Note Rider (`note-rider`)                        | phone   |   5,366,325 → 5,268,000 | 102 → 100 |   1608.8 → 2579.3 |
| Note Rider (`note-rider`)                        | desktop |   7,102,973 → 7,004,648 | 245 → 243 |   2321.5 → 4269.3 |
| White roses (`white-roses`)                      | phone   |   5,362,484 → 5,264,159 |   95 → 93 |   7619.4 → 1953.4 |
| White roses (`white-roses`)                      | desktop |   5,820,484 → 5,722,159 | 154 → 152 |   2771.4 → 3811.7 |
| Longtail (`longtail`)                            | phone   |   5,349,797 → 5,251,472 |  101 → 99 |   1578.3 → 2412.0 |
| Longtail (`longtail`)                            | desktop |   7,031,558 → 6,933,233 | 244 → 241 |   2360.2 → 2963.0 |
| Sound lab (`sound-lab`)                          | phone   |   5,341,679 → 5,243,354 |   99 → 97 |   2406.5 → 6614.7 |
| Sound lab (`sound-lab`)                          | desktop |   7,027,033 → 6,928,708 | 242 → 240 |  4557.5 → 24922.3 |
| Night Owl Pinball (`night-owl-pinball`)          | phone   |   5,341,244 → 5,242,919 |  101 → 99 |   2149.1 → 1675.3 |
| Night Owl Pinball (`night-owl-pinball`)          | desktop |   7,065,832 → 6,967,507 | 244 → 242 |   2500.3 → 3371.3 |
| 16-cell (`sixteen-cell`)                         | phone   |   5,340,254 → 5,241,929 |   96 → 94 |   2253.1 → 2493.6 |
| 16-cell (`sixteen-cell`)                         | desktop |   6,987,548 → 6,889,223 | 239 → 237 |   4898.9 → 8340.9 |
| Sound recorder (`sound-recorder`)                | phone   |   5,339,281 → 5,240,956 |   99 → 97 |   1939.0 → 2240.2 |
| Sound recorder (`sound-recorder`)                | desktop |   7,027,033 → 6,928,708 | 242 → 240 |   7429.0 → 5338.0 |
| Grain Garden (`grain-garden`)                    | phone   |   5,336,688 → 5,238,363 |  101 → 99 |   1578.6 → 1943.7 |
| Grain Garden (`grain-garden`)                    | desktop |   7,068,212 → 6,969,887 | 244 → 242 |   3715.8 → 3050.0 |
| Cast a Shadow (`cast-a-shadow`)                  | phone   |   5,336,534 → 5,238,209 |  101 → 99 |   1376.9 → 1627.6 |
| Cast a Shadow (`cast-a-shadow`)                  | desktop |   7,065,296 → 6,966,971 | 244 → 242 |   2237.0 → 4341.8 |
| Duoprism (`duoprism`)                            | phone   |   5,335,934 → 5,237,609 |   96 → 94 |   2494.8 → 3417.0 |
| Duoprism (`duoprism`)                            | desktop |   6,987,548 → 6,889,223 | 239 → 237 |  6980.1 → 10934.3 |
| 24-cell (`twenty-four-cell`)                     | phone   |   5,335,788 → 5,237,463 |   96 → 94 |   2561.9 → 3265.9 |
| 24-cell (`twenty-four-cell`)                     | desktop |   6,987,548 → 6,889,223 | 239 → 237 |  7440.6 → 14703.9 |
| Strata (`strata`)                                | phone   |   5,333,475 → 5,235,150 |  101 → 99 |   1740.8 → 3246.6 |
| Strata (`strata`)                                | desktop |   7,073,921 → 6,975,596 | 244 → 242 |   2769.0 → 3265.6 |
| Volley Table (`volley-table`)                    | phone   |   5,332,193 → 5,233,868 |  101 → 99 |   1951.3 → 2197.6 |
| Volley Table (`volley-table`)                    | desktop |   7,038,484 → 6,962,946 | 242 → 242 |   7551.1 → 2718.7 |
| 5-cell (`five-cell`)                             | phone   |   5,322,866 → 5,224,541 |   96 → 94 |   2098.3 → 2813.8 |
| 5-cell (`five-cell`)                             | desktop |   6,966,416 → 6,868,091 | 239 → 237 |  4778.7 → 16073.0 |
| Climate records (`climate-records`)              | phone   |   5,319,227 → 5,220,902 | 103 → 101 |   1937.7 → 2812.8 |
| Climate records (`climate-records`)              | desktop |   6,950,291 → 6,851,966 | 244 → 242 |   4070.4 → 7860.5 |
| Aizawa attractor (`aizawa-attractor`)            | phone   |   5,318,268 → 5,219,943 |   96 → 94 |   2734.8 → 2221.0 |
| Aizawa attractor (`aizawa-attractor`)            | desktop |   6,966,416 → 6,868,091 | 239 → 237 |  9681.0 → 19303.1 |
| Rössler attractor (`rossler-attractor`)          | phone   |   5,316,516 → 5,218,191 |   96 → 94 |   2924.0 → 3177.2 |
| Rössler attractor (`rossler-attractor`)          | desktop |   6,966,416 → 6,868,091 | 239 → 237 |  12733.8 → 6924.4 |
| Ripple tank (`ripple-tank`)                      | phone   |   5,312,263 → 5,213,938 |   98 → 96 |   2011.3 → 2088.5 |
| Ripple tank (`ripple-tank`)                      | desktop |   6,963,909 → 6,865,584 | 241 → 239 |  3087.1 → 19072.1 |
| Light bench (`light-bench`)                      | phone   |   5,309,199 → 5,210,874 |   98 → 96 |   1710.7 → 1637.5 |
| Light bench (`light-bench`)                      | desktop |   6,963,909 → 6,865,584 | 241 → 239 |   2273.6 → 5583.4 |
| Thomas attractor (`thomas-attractor`)            | phone   |   5,308,640 → 5,210,315 |   96 → 94 |   2060.1 → 2885.4 |
| Thomas attractor (`thomas-attractor`)            | desktop |   6,966,416 → 6,868,091 | 239 → 237 | 11215.1 → 10716.1 |
| How CT works (`how-ct`)                          | phone   |   5,304,554 → 5,206,229 |   95 → 93 |   2125.4 → 2154.1 |
| How CT works (`how-ct`)                          | desktop |   6,926,844 → 6,828,519 | 236 → 234 |   3567.3 → 8100.4 |
| Airport X-ray scanner (`airport-xray`)           | phone   |   5,302,958 → 5,204,633 |   95 → 93 |   2327.4 → 2902.4 |
| Airport X-ray scanner (`airport-xray`)           | desktop |   6,926,844 → 6,828,519 | 236 → 234 |  3835.4 → 10372.6 |
| Fluid lab (`fluid-lab`)                          | phone   |   5,289,042 → 5,190,717 |  101 → 99 |   1527.1 → 1849.4 |
| Fluid lab (`fluid-lab`)                          | desktop |   7,077,978 → 6,979,653 | 244 → 242 |   2614.9 → 4951.1 |
| Shardball (`shardball`)                          | phone   |   5,283,227 → 5,238,031 |  100 → 99 |   2010.1 → 2835.6 |
| Shardball (`shardball`)                          | desktop |   7,087,436 → 6,989,111 | 244 → 242 |   2998.5 → 3304.0 |
| Data in 3D (`data-in-3d`)                        | phone   |   5,276,882 → 5,178,557 | 103 → 101 |   1884.5 → 4651.5 |
| Data in 3D (`data-in-3d`)                        | desktop |   7,064,728 → 6,539,827 | 246 → 244 |   2281.3 → 7513.5 |
| Electron microscope (`electron-microscope`)      | phone   |   5,261,236 → 5,162,911 |   95 → 93 |   1699.4 → 2286.1 |
| Electron microscope (`electron-microscope`)      | desktop |   6,881,358 → 6,783,033 | 232 → 230 |   5992.3 → 5508.0 |
| Thermal camera (`thermal-camera`)                | phone   |   5,253,676 → 5,155,351 |   95 → 93 |   2553.3 → 2118.3 |
| Thermal camera (`thermal-camera`)                | desktop |   6,881,358 → 6,783,033 | 232 → 230 |   8775.2 → 9544.7 |
| MRI of a fruit (`fruit-mri`)                     | phone   |   5,253,202 → 5,154,877 |   95 → 93 |   1639.9 → 3000.3 |
| MRI of a fruit (`fruit-mri`)                     | desktop |   6,881,358 → 6,783,033 | 232 → 230 |   3266.5 → 6527.1 |
| Light lab (`light-lab`)                          | phone   |   5,238,884 → 5,140,559 |   98 → 96 |   3112.9 → 2344.2 |
| Light lab (`light-lab`)                          | desktop |   6,999,254 → 6,900,929 | 241 → 239 |   2605.3 → 4439.2 |
| Gaussian splatting (`gaussian-splatting`)        | phone   |   5,232,230 → 5,133,905 |  101 → 99 |   5391.7 → 5186.5 |
| Gaussian splatting (`gaussian-splatting`)        | desktop |   7,002,556 → 6,904,231 | 244 → 242 |   8353.5 → 7932.2 |
| DNA to protein (`dna-to-protein`)                | phone   |   5,218,950 → 5,120,625 |   99 → 97 |  2570.6 → 11793.8 |
| DNA to protein (`dna-to-protein`)                | desktop |   6,787,692 → 6,689,367 | 242 → 240 |  3999.9 → 11967.1 |
| Cell division (`mitosis`)                        | phone   |   5,216,786 → 5,118,461 |   99 → 97 |   2017.6 → 8697.7 |
| Cell division (`mitosis`)                        | desktop |   6,787,692 → 6,689,367 | 242 → 240 |  3615.0 → 18082.6 |
| Phagocytosis (`phagocytosis`)                    | phone   |   5,213,296 → 5,114,971 |   99 → 97 |   2343.8 → 3608.1 |
| Phagocytosis (`phagocytosis`)                    | desktop |   6,786,084 → 6,687,759 | 242 → 240 |  4013.9 → 20649.8 |
| Apoptosis (`apoptosis`)                          | phone   |   5,212,754 → 5,114,429 |   99 → 97 |   2291.1 → 5823.6 |
| Apoptosis (`apoptosis`)                          | desktop |   6,786,084 → 6,687,759 | 242 → 240 |  3523.6 → 37710.9 |
| Splat field (`splat-field`)                      | phone   |   5,183,097 → 5,084,772 |   95 → 93 |   1679.2 → 3861.1 |
| Splat field (`splat-field`)                      | desktop |   6,948,053 → 6,849,728 | 238 → 236 |   3446.4 → 4220.4 |
| Anatomy atlas (`anatomy-atlas`)                  | phone   |   5,142,007 → 5,043,682 |   96 → 94 |   3109.9 → 3623.8 |
| Anatomy atlas (`anatomy-atlas`)                  | desktop |   6,560,089 → 6,442,556 | 239 → 237 |  4856.3 → 48808.0 |
| Splat equation (`splat-equation`)                | phone   |   5,131,943 → 5,033,618 |   96 → 94 |   3939.3 → 3440.8 |
| Splat equation (`splat-equation`)                | desktop |   6,672,525 → 6,688,478 | 239 → 237 |   4762.6 → 7391.8 |
| Unit cells (`unit-cells`)                        | phone   |   5,131,287 → 5,032,962 |   97 → 95 |   2134.8 → 2403.5 |
| Unit cells (`unit-cells`)                        | desktop |   6,713,017 → 6,614,692 | 240 → 238 |  3365.0 → 26014.9 |
| Orbital atlas (`orbital-atlas`)                  | phone   |   5,130,193 → 5,031,868 |   97 → 95 |   2325.4 → 2723.7 |
| Orbital atlas (`orbital-atlas`)                  | desktop |   6,697,687 → 6,340,478 | 240 → 238 |  3903.5 → 29038.1 |

## Image proof

Fixed seed 424242, preset camera, frozen clocks, default look, and matching viewports. Tap pulses
use their production decay formula at one second; the tap-versus-rest check confirms a moved pose.
Low, high, and mid comparisons cover the five prefix recipes. Cactus covers the shared startup
changes; pyrite covers the deferred museum helpers. The Node buffer checks also cover the complete
geometry and shading inputs.

Preflight moving-pose captures differed in three pairs, including a desktop full/full control with
unchanged scan bytes. The capture was updated to reset centers and explicitly resort the fixed pose,
then wait at least 12 frame-end events plus 1.5 seconds. All final pairs match. This does not
establish the cause of the preflight differences. Frame-end is not a sorter or GPU fence, and these
samples do not test every possible animation frame.

| Toy             | Setting   | Pose | Changed pixels | Before                                                                    | After                                                                    | Difference ×8                                                          |
| --------------- | --------- | ---- | -------------: | ------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| cactus          | phone     | rest |              0 | [Still](load-time-2026-10/images/cactus-phone-before-rest.png)            | [Still](load-time-2026-10/images/cactus-phone-after-rest.png)            | [Diff](load-time-2026-10/images/cactus-phone-diff-rest.png)            |
| pyrite-cubes    | phone     | rest |              0 | [Still](load-time-2026-10/images/pyrite-cubes-phone-before-rest.png)      | [Still](load-time-2026-10/images/pyrite-cubes-phone-after-rest.png)      | [Diff](load-time-2026-10/images/pyrite-cubes-phone-diff-rest.png)      |
| pyrite-cubes    | phone     | tap  |              0 | [Still](load-time-2026-10/images/pyrite-cubes-phone-before-tap.png)       | [Still](load-time-2026-10/images/pyrite-cubes-phone-after-tap.png)       | [Diff](load-time-2026-10/images/pyrite-cubes-phone-diff-tap.png)       |
| water-bottle    | phone     | rest |              0 | [Still](load-time-2026-10/images/water-bottle-phone-before-rest.png)      | [Still](load-time-2026-10/images/water-bottle-phone-after-rest.png)      | [Diff](load-time-2026-10/images/water-bottle-phone-diff-rest.png)      |
| water-bottle    | phone     | tap  |              0 | [Still](load-time-2026-10/images/water-bottle-phone-before-tap.png)       | [Still](load-time-2026-10/images/water-bottle-phone-after-tap.png)       | [Diff](load-time-2026-10/images/water-bottle-phone-diff-tap.png)       |
| sunglasses      | phone     | rest |              0 | [Still](load-time-2026-10/images/sunglasses-phone-before-rest.png)        | [Still](load-time-2026-10/images/sunglasses-phone-after-rest.png)        | [Diff](load-time-2026-10/images/sunglasses-phone-diff-rest.png)        |
| sunglasses      | phone     | tap  |              0 | [Still](load-time-2026-10/images/sunglasses-phone-before-tap.png)         | [Still](load-time-2026-10/images/sunglasses-phone-after-tap.png)         | [Diff](load-time-2026-10/images/sunglasses-phone-diff-tap.png)         |
| baseball-cap    | phone     | rest |              0 | [Still](load-time-2026-10/images/baseball-cap-phone-before-rest.png)      | [Still](load-time-2026-10/images/baseball-cap-phone-after-rest.png)      | [Diff](load-time-2026-10/images/baseball-cap-phone-diff-rest.png)      |
| fountain-pen    | phone     | rest |              0 | [Still](load-time-2026-10/images/fountain-pen-phone-before-rest.png)      | [Still](load-time-2026-10/images/fountain-pen-phone-after-rest.png)      | [Diff](load-time-2026-10/images/fountain-pen-phone-diff-rest.png)      |
| fountain-pen    | phone     | tap  |              0 | [Still](load-time-2026-10/images/fountain-pen-phone-before-tap.png)       | [Still](load-time-2026-10/images/fountain-pen-phone-after-tap.png)       | [Diff](load-time-2026-10/images/fountain-pen-phone-diff-tap.png)       |
| soda-can        | phone     | rest |              0 | [Still](load-time-2026-10/images/soda-can-phone-before-rest.png)          | [Still](load-time-2026-10/images/soda-can-phone-after-rest.png)          | [Diff](load-time-2026-10/images/soda-can-phone-diff-rest.png)          |
| soda-can        | phone     | tap  |              0 | [Still](load-time-2026-10/images/soda-can-phone-before-tap.png)           | [Still](load-time-2026-10/images/soda-can-phone-after-tap.png)           | [Diff](load-time-2026-10/images/soda-can-phone-diff-tap.png)           |
| cactus          | desktop   | rest |              0 | [Still](load-time-2026-10/images/cactus-desktop-before-rest.png)          | [Still](load-time-2026-10/images/cactus-desktop-after-rest.png)          | [Diff](load-time-2026-10/images/cactus-desktop-diff-rest.png)          |
| baseball-cap    | phone     | tap  |              0 | [Still](load-time-2026-10/images/baseball-cap-phone-before-tap.png)       | [Still](load-time-2026-10/images/baseball-cap-phone-after-tap.png)       | [Diff](load-time-2026-10/images/baseball-cap-phone-diff-tap.png)       |
| pyrite-cubes    | desktop   | rest |              0 | [Still](load-time-2026-10/images/pyrite-cubes-desktop-before-rest.png)    | [Still](load-time-2026-10/images/pyrite-cubes-desktop-after-rest.png)    | [Diff](load-time-2026-10/images/pyrite-cubes-desktop-diff-rest.png)    |
| pyrite-cubes    | desktop   | tap  |              0 | [Still](load-time-2026-10/images/pyrite-cubes-desktop-before-tap.png)     | [Still](load-time-2026-10/images/pyrite-cubes-desktop-after-tap.png)     | [Diff](load-time-2026-10/images/pyrite-cubes-desktop-diff-tap.png)     |
| water-bottle    | desktop   | rest |              0 | [Still](load-time-2026-10/images/water-bottle-desktop-before-rest.png)    | [Still](load-time-2026-10/images/water-bottle-desktop-after-rest.png)    | [Diff](load-time-2026-10/images/water-bottle-desktop-diff-rest.png)    |
| water-bottle    | desktop   | tap  |              0 | [Still](load-time-2026-10/images/water-bottle-desktop-before-tap.png)     | [Still](load-time-2026-10/images/water-bottle-desktop-after-tap.png)     | [Diff](load-time-2026-10/images/water-bottle-desktop-diff-tap.png)     |
| sunglasses      | desktop   | rest |              0 | [Still](load-time-2026-10/images/sunglasses-desktop-before-rest.png)      | [Still](load-time-2026-10/images/sunglasses-desktop-after-rest.png)      | [Diff](load-time-2026-10/images/sunglasses-desktop-diff-rest.png)      |
| sunglasses      | desktop   | tap  |              0 | [Still](load-time-2026-10/images/sunglasses-desktop-before-tap.png)       | [Still](load-time-2026-10/images/sunglasses-desktop-after-tap.png)       | [Diff](load-time-2026-10/images/sunglasses-desktop-diff-tap.png)       |
| baseball-cap    | desktop   | rest |              0 | [Still](load-time-2026-10/images/baseball-cap-desktop-before-rest.png)    | [Still](load-time-2026-10/images/baseball-cap-desktop-after-rest.png)    | [Diff](load-time-2026-10/images/baseball-cap-desktop-diff-rest.png)    |
| baseball-cap    | desktop   | tap  |              0 | [Still](load-time-2026-10/images/baseball-cap-desktop-before-tap.png)     | [Still](load-time-2026-10/images/baseball-cap-desktop-after-tap.png)     | [Diff](load-time-2026-10/images/baseball-cap-desktop-diff-tap.png)     |
| fountain-pen    | desktop   | rest |              0 | [Still](load-time-2026-10/images/fountain-pen-desktop-before-rest.png)    | [Still](load-time-2026-10/images/fountain-pen-desktop-after-rest.png)    | [Diff](load-time-2026-10/images/fountain-pen-desktop-diff-rest.png)    |
| fountain-pen    | desktop   | tap  |              0 | [Still](load-time-2026-10/images/fountain-pen-desktop-before-tap.png)     | [Still](load-time-2026-10/images/fountain-pen-desktop-after-tap.png)     | [Diff](load-time-2026-10/images/fountain-pen-desktop-diff-tap.png)     |
| soda-can        | desktop   | rest |              0 | [Still](load-time-2026-10/images/soda-can-desktop-before-rest.png)        | [Still](load-time-2026-10/images/soda-can-desktop-after-rest.png)        | [Diff](load-time-2026-10/images/soda-can-desktop-diff-rest.png)        |
| soda-can        | desktop   | tap  |              0 | [Still](load-time-2026-10/images/soda-can-desktop-before-tap.png)         | [Still](load-time-2026-10/images/soda-can-desktop-after-tap.png)         | [Diff](load-time-2026-10/images/soda-can-desktop-diff-tap.png)         |
| water-bottle    | phone-mid | rest |              0 | [Still](load-time-2026-10/images/water-bottle-phone-mid-before-rest.png)  | [Still](load-time-2026-10/images/water-bottle-phone-mid-after-rest.png)  | [Diff](load-time-2026-10/images/water-bottle-phone-mid-diff-rest.png)  |
| water-bottle    | phone-mid | tap  |              0 | [Still](load-time-2026-10/images/water-bottle-phone-mid-before-tap.png)   | [Still](load-time-2026-10/images/water-bottle-phone-mid-after-tap.png)   | [Diff](load-time-2026-10/images/water-bottle-phone-mid-diff-tap.png)   |
| sunglasses      | phone-mid | rest |              0 | [Still](load-time-2026-10/images/sunglasses-phone-mid-before-rest.png)    | [Still](load-time-2026-10/images/sunglasses-phone-mid-after-rest.png)    | [Diff](load-time-2026-10/images/sunglasses-phone-mid-diff-rest.png)    |
| sunglasses      | phone-mid | tap  |              0 | [Still](load-time-2026-10/images/sunglasses-phone-mid-before-tap.png)     | [Still](load-time-2026-10/images/sunglasses-phone-mid-after-tap.png)     | [Diff](load-time-2026-10/images/sunglasses-phone-mid-diff-tap.png)     |
| baseball-cap    | phone-mid | rest |              0 | [Still](load-time-2026-10/images/baseball-cap-phone-mid-before-rest.png)  | [Still](load-time-2026-10/images/baseball-cap-phone-mid-after-rest.png)  | [Diff](load-time-2026-10/images/baseball-cap-phone-mid-diff-rest.png)  |
| baseball-cap    | phone-mid | tap  |              0 | [Still](load-time-2026-10/images/baseball-cap-phone-mid-before-tap.png)   | [Still](load-time-2026-10/images/baseball-cap-phone-mid-after-tap.png)   | [Diff](load-time-2026-10/images/baseball-cap-phone-mid-diff-tap.png)   |
| fountain-pen    | phone-mid | rest |              0 | [Still](load-time-2026-10/images/fountain-pen-phone-mid-before-rest.png)  | [Still](load-time-2026-10/images/fountain-pen-phone-mid-after-rest.png)  | [Diff](load-time-2026-10/images/fountain-pen-phone-mid-diff-rest.png)  |
| fountain-pen    | phone-mid | tap  |              0 | [Still](load-time-2026-10/images/fountain-pen-phone-mid-before-tap.png)   | [Still](load-time-2026-10/images/fountain-pen-phone-mid-after-tap.png)   | [Diff](load-time-2026-10/images/fountain-pen-phone-mid-diff-tap.png)   |
| soda-can        | phone-mid | rest |              0 | [Still](load-time-2026-10/images/soda-can-phone-mid-before-rest.png)      | [Still](load-time-2026-10/images/soda-can-phone-mid-after-rest.png)      | [Diff](load-time-2026-10/images/soda-can-phone-mid-diff-rest.png)      |
| soda-can        | phone-mid | tap  |              0 | [Still](load-time-2026-10/images/soda-can-phone-mid-before-tap.png)       | [Still](load-time-2026-10/images/soda-can-phone-mid-after-tap.png)       | [Diff](load-time-2026-10/images/soda-can-phone-mid-diff-tap.png)       |
| celestial-globe | phone     | rest |              0 | [Still](load-time-2026-10/images/celestial-globe-phone-before-rest.png)   | [Still](load-time-2026-10/images/celestial-globe-phone-after-rest.png)   | [Diff](load-time-2026-10/images/celestial-globe-phone-diff-rest.png)   |
| celestial-globe | phone     | tap  |              0 | [Still](load-time-2026-10/images/celestial-globe-phone-before-tap.png)    | [Still](load-time-2026-10/images/celestial-globe-phone-after-tap.png)    | [Diff](load-time-2026-10/images/celestial-globe-phone-diff-tap.png)    |
| celestial-globe | desktop   | rest |              0 | [Still](load-time-2026-10/images/celestial-globe-desktop-before-rest.png) | [Still](load-time-2026-10/images/celestial-globe-desktop-after-rest.png) | [Diff](load-time-2026-10/images/celestial-globe-desktop-diff-rest.png) |
| celestial-globe | desktop   | tap  |              0 | [Still](load-time-2026-10/images/celestial-globe-desktop-before-tap.png)  | [Still](load-time-2026-10/images/celestial-globe-desktop-after-tap.png)  | [Diff](load-time-2026-10/images/celestial-globe-desktop-diff-tap.png)  |

## Lossy options for the owner — not shipped

These are visual decision examples, confined to the audit tool. They halve the recipe's phone budget
from 90,000 to 45,000. The prototype still transfers the shipped opening asset; an additional
smaller prefix would be needed for a corresponding transfer saving. No production budget or texture
was changed.

| Option                    | Before rendered splats | After rendered splats | Changed pixels | Before                                                              | After                                                                           | Diff                                                               |
| ------------------------- | ---------------------: | --------------------: | -------------: | ------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| fountain-pen: half budget |                 90,273 |                46,130 |         29,272 | [Still](load-time-2026-10/images/fountain-pen-phone-after-rest.png) | [Still](load-time-2026-10/images/fountain-pen-phone-lossy-half-budget-rest.png) | [Diff](load-time-2026-10/images/fountain-pen-phone-lossy-diff.png) |
| sunglasses: half budget   |                 88,274 |                44,174 |         27,216 | [Still](load-time-2026-10/images/sunglasses-phone-after-rest.png)   | [Still](load-time-2026-10/images/sunglasses-phone-lossy-half-budget-rest.png)   | [Diff](load-time-2026-10/images/sunglasses-phone-lossy-diff.png)   |

## Method, limits, and reproduction

Raw observations: [before](load-time-2026-10/before.json), [after](load-time-2026-10/after.json),
and [timing screening](load-time-2026-10/screening.json). The
[before method](load-time-2026-10/before-method.json) and
[after method](load-time-2026-10/after-method.json) record browser flags, settings, and source
commits. Focused reruns retain their own before/after rows under `load-time-2026-10/paired/`.

The four large request matrices retain their full JSON contents and formatting checks.
`.gitattributes` disables their line diffs so Git and the required American English checker do not
collect millions of irrelevant JSON lines. The first English-check attempt exceeded that checker's
64 MiB diff buffer; its source is protected and was not edited. JSON is outside that checker's
public-text scope.

[Task 06's opening method](perf-2026-10.md) is retained: phone 390×844, device scale 3,
touch/mobile, weak/low; desktop 1440×900, device scale 1, high. WebGL2, adaptation off, sound off,
no reduced motion, seed 424242, preset camera, default options, still-toy turntable choice,
unthrottled localhost, fresh context per cell, CDP cache disabled, and service workers blocked. Only
one rendering page runs at a time.

The browser is Chromium 151.0.7922.173 on Linux with Mesa llvmpipe, two Mesa threads, and an Xvfb
display. Task 06 used Mac Chrome with Metal. These are matched settings on this environment, not
physical-phone results or timings directly comparable to the Mac audit.

The first-frame hook is the first `postrender` after the requested toy is ready. It is a submitted
render, not a GPU fence or confirmation that streamed pictures have finished. Opening bytes include
HTTP bodies completed by the snapshot after a real 1.5-second settling delay. CDP completion
timestamps are checked against the cutoff; initial worker scripts use parent Resource Timing when
necessary, and worker imports count independently. Headers, blob/data URLs, and aborted or
incomplete bodies are excluded. Worker timing is approximate, as in task 06. The local server does
not compress HTTP responses; these are body payloads, not live Pages wire totals.

This task records opening metrics. Task 06's separate five-second idle/tap frame-cadence windows and
heap census were not repeated. A single cold run per cell is a screening measurement; CPU load,
shader caches, and OS caches can move the first-frame result. Timing increases need paired reruns
before declaring a regression or claiming the no-slower target.

Reproduction: serve archives of the recorded frozen main on port 4174 and measured candidate on 4173
with `python3 -m http.server PORT --bind 127.0.0.1`. Run
`node tools/load-time-audit.mjs --phase=before` and then
`node tools/load-time-audit.mjs --phase=after --base=http://127.0.0.1:4173`, adding
`--frozen-main=49c809b4 --candidate-source=2c229dbd --out=NEW_DIR` to both commands, with
`SPLASHERY_CHROMIUM`, `DISPLAY`, `SPLASHERY_GL=llvmpipe`, and `LP_NUM_THREADS=2`. Use a new output
directory for fresh measurements; each run resumes completed version-2 cells. The explicit commit
options keep method receipts accurate when the collector repository has advanced beyond the served
archives. `--only=ID,ID`, `--device=phone`, `--samples=N`, and `--out=DIR` support focused reruns.
`node tools/load-time-paired.mjs --only=ID,ID --samples=5` accepts the same commit options and
alternates before/after phase order while adding one sample per pass. Recovery runs used
`nice -n 10` and `--navigation-timeout=180000 --readiness-timeout=300000`; focused recovery
additionally used `--cell-timeout=180000`. Run `tools/load-time-visuals.mjs` for stills,
`tools/load-time-prefixes.mjs` and `tools/load-time-smoothing.mjs` to regenerate exact opening
assets, and `tools/load-time-report.mjs` for this report.

## Verification and remaining work

The protected-file list was obtained from PRs #560, #562, #566, #570, and #576 before edits;
[protected-files.json](load-time-2026-10/protected-files.json) preserves it. The changed-file
intersection is checked again before push. Static files, direct ES modules, the existing PlayCanvas
2.22.3 bridge, and old share/scene formats are preserved.

Main advanced to `c66a49e963f1d9f9adf79949d51db1ec9cf71d74` during collection and is integrated
before handoff. It includes the American English sweep, manual updates, and new Photo to 3D samples.
The frozen opening matrices and 160-test receipt remain observations of their recorded earlier
source commits; they do not measure the merged main changes. A separate integration check is
recorded in the verification receipt. The final protected-file refresh covers 428 paths with no
intersection with this PR's changes.

Test and formatting receipts are recorded in
[verification.json](load-time-2026-10/verification.json). On the measured runtime, the required
suite passed all 160 tests without skips or retries: smoke, taps, kit, unit, the Real objects spec,
and the new load-time specs. Three additional audit-store recovery tests passed separately. After
integrating main, all 37 unit and load-time checks passed; the full required suite was not repeated
after that merge. An actual browser probe forced the collector's watchdog to exit with status 2,
then successfully resumed the same output with a normal timeout. The embed test observed 9.1 MiB,
below its 30 MiB limit. All 15 touched-pack recipes passed their Node checks. Photoreal r3 has no
dedicated existing pack spec; its browser deferred-load/tap test and all eight recipes' Node pack
checks cover that pack. Lossy samples, all raw request observations, and the timing screening flags
are retained for review.

An earlier broad suite had one strawberry return-to-rest image-threshold failure; isolated checks on
frozen main and the candidate, and the final broad suite, passed. During the candidate matrix the
audit browser's GPU process exited after 578 completed cells and the collector stopped advancing.
Those completed rows were retained, and a fresh browser resumed the remaining cells. Neither event
is presented as proof of a production defect or a clean first attempt.

Timings after that interruption became much slower even on unchanged code. After a fresh graphics
display, a frozen-main desktop Cactus control took 55.4 seconds to its first frame, versus 4.8
seconds in the earlier matrix; its body payload stayed exactly 11,021,766 bytes. The candidate
control took 69.5 seconds and retained the same 98,325-byte saving as its earlier opening. The
[recovery control before](load-time-2026-10/recovery-control/before.json) and
[after](load-time-2026-10/recovery-control/after.json) are separate from the five-sample focused
reruns. This environment change prevents treating the later matrix's timing differences as isolated
effects of the patch. The raw observations and focused ranges are retained, and the no-slower timing
target is not claimed.

The execution service subsequently disconnected after 615 completed candidate cells and stopped the
local servers and display. The services were restored, and the remaining cells and focused repeats
used process priority 10 (`nice -n 10`) so rendering would yield to the execution service. Earlier
measurements used normal priority. The final method files record that priority; source commits,
scene settings, and rendering flags are unchanged. These recovery differences are another limit on
comparing the full timing matrix.

An alternate SwiftShader desktop Cactus control also showed the slowdown:
[frozen main](load-time-2026-10/swiftshader-control/before.json) took 71.3 seconds, and
[the candidate](load-time-2026-10/swiftshader-control/after.json) took 37.9 seconds, with the same
body sizes as the llvmpipe controls. The main matrix retains llvmpipe. Anatomy atlas and Oak
subsequently hit the original collection timeouts without console errors;
[opening-retries.json](load-time-2026-10/opening-retries.json) preserves those attempts. Recovery
collection allows 180 seconds for navigation and 300 seconds for readiness. These limits affect how
long collection waits; recorded first-frame timings retain their actual elapsed values. Further
timeout attempts, if any, remain in the collector's error logs beside the raw matrices.

The graphics process exited again after 25 completed observations in the first focused candidate
pass. Those observations were retained. Focused recovery uses a 180-second total per-cell watchdog
and automatically restarts a failed collector pass up to twice from saved observations. The watchdog
checkpoints completed rows and terminates only the collector's own child processes. These recovery
limits are recorded in each focused method file.

What was cut: unused PLY-column changes in the protected Video to 3D work; changes to the protected
manual PDF loaded by Your book; edits to the protected shared UI, player, catalog, help, and sound
files; reduced texture resolution; reduced production splat budgets; renderer upgrades; a bundler or
CDN; and hosting header changes. The 20-heaviest target and a statistically supported
no-slower-first-frame result remain open.

Rule check: none.

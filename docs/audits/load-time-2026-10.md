# Load-time audit — October 15, 2026

Codex (GPT-6) built these lossless changes and this audit on `codex/load-time`. This revision
addresses
[the Operator's October 15 review](https://github.com/ryanjosephkamp/splashery/pull/588#issuecomment-6198837043).

## Current opening results

Baseline main: `c13a9d3fab17c8a928299bdf115003502a7823d4`. Final candidate:
`30ed36e55974a012d2d6042a6a97d4fa5fe04007`. The three phone full-scan fallbacks were measured on
that revision; the other 25 groups retain their actual `b222e93aad709e03dd7b3814d456612ebaf6c900`
source pins. A guarded diff confirms that the only later runtime change removes these three
prefix-selector entries; every other data selection and loader/build function is unchanged. Each
group has five adjacent, alternating before/after pairs on the same Linux software-rendering device.
Every opening uses a fresh browser and context, disabled cache, and the same renderer, viewport,
profile, count, seed, and camera. No repeated-test or other rendering job ran alongside these
measurements. Superseded experiments and the replaced prefix samples are not pooled into this table.

The original top-20 phone set averages 187,676,516 → 180,003,320 local HTTP-body bytes combined
(4.1% saving); 1/20 individually reach 25%. The combined 25% target is not met. Public per-toy wire
savings were not measured.

The strict median screen has 10/28 higher medians. It is not claimed met; each measured increase
remains visible below.

| Toy                 | Setting | Measured candidate | Samples per phase |    Bytes before → after | Requests before → after | First-frame median before → after (ms) | Change | Before range (ms) | After range (ms) |
| ------------------- | ------- | ------------------ | ----------------: | ----------------------: | ----------------------: | -------------------------------------: | -----: | ----------------: | ---------------: |
| your-book           | phone   | b222e93a           |                 5 | 15,002,450 → 13,064,878 |                 97 → 96 |                        3702.2 → 3101.4 | -16.2% |     2182.7–5009.0 |    2358.4–5116.9 |
| video-3d            | phone   | b222e93a           |                 5 |   6,495,007 → 6,545,887 |               107 → 110 |                        3005.3 → 4258.8 |  41.7% |     2743.8–4109.4 |    3066.7–7563.6 |
| splat-toolkit       | phone   | b222e93a           |                 5 | 11,541,043 → 11,537,771 |               106 → 105 |                        9173.9 → 9508.9 |   3.7% |    7881.3–19557.2 |   7666.5–15093.9 |
| living-city         | phone   | b222e93a           |                 5 | 10,579,904 → 10,576,632 |                 95 → 94 |                        4274.6 → 3165.9 | -25.9% |     2718.3–6534.8 |    3025.7–8656.0 |
| powers-of-ten       | phone   | b222e93a           |                 5 |   7,836,208 → 8,609,569 |                 99 → 98 |                        3812.5 → 2195.5 | -42.4% |    1929.1–16410.5 |    1500.2–2909.4 |
| point-clouds        | phone   | b222e93a           |                 5 |   9,113,842 → 9,110,570 |               106 → 105 |                        7335.5 → 4999.0 | -31.9% |    3692.1–13448.7 |   3484.0–10802.8 |
| celestial-globe     | phone   | b222e93a           |                 5 |   9,196,086 → 6,799,127 |                 92 → 91 |                        2232.6 → 2059.7 |  -7.7% |     2180.5–4250.3 |    1742.2–6391.6 |
| stannern-meteorites | phone   | b222e93a           |                 5 |   9,174,970 → 7,210,861 |                 92 → 91 |                        2753.7 → 2673.4 |  -2.9% |     2005.2–8036.1 |   1964.4–15931.7 |
| crochet-earth       | phone   | b222e93a           |                 5 |   9,157,088 → 9,153,816 |                 92 → 91 |                        3020.0 → 2501.5 | -17.2% |     2684.5–9289.4 |    2414.9–4522.3 |
| seeded-loaf         | phone   | b222e93a           |                 5 |   9,134,851 → 9,131,579 |                 90 → 89 |                        4102.9 → 3024.4 | -26.3% |     2010.1–5324.2 |    2306.8–5558.9 |
| dog-plush           | phone   | b222e93a           |                 5 |   9,110,272 → 9,107,000 |                 92 → 91 |                        4027.7 → 5057.3 |  25.6% |    3042.7–14157.1 |   4221.3–15515.9 |
| alum-crystal        | phone   | b222e93a           |                 5 |   9,048,542 → 9,045,270 |                 92 → 91 |                        4330.8 → 3307.9 | -23.6% |     2147.7–4902.5 |   2310.0–18602.9 |
| mushroom-photo      | phone   | b222e93a           |                 5 |   9,102,439 → 9,099,167 |                 92 → 91 |                        3046.4 → 2863.4 |  -6.0% |     2065.6–6587.6 |    2611.2–4535.4 |
| moving-photo-3d     | phone   | b222e93a           |                 5 |   9,023,626 → 9,020,354 |               125 → 124 |                       8996.7 → 12190.1 |  35.5% |    8860.1–17548.4 |   7157.2–25126.0 |
| turtle-souvenir     | phone   | b222e93a           |                 5 |   9,052,117 → 9,048,845 |                 92 → 91 |                        3748.3 → 3299.6 | -12.0% |     2250.7–7135.8 |    2322.4–6999.9 |
| armillary-sphere    | phone   | b222e93a           |                 5 |   9,047,458 → 6,922,122 |                 92 → 91 |                        4176.8 → 3549.3 | -15.0% |    3921.2–11968.5 |    1959.5–5360.8 |
| murex-shell         | phone   | b222e93a           |                 5 |   9,029,146 → 9,025,874 |                 92 → 91 |                        5932.0 → 4046.7 | -31.8% |     3441.6–6942.4 |    2469.4–5083.6 |
| maple-tree          | phone   | b222e93a           |                 5 |   9,041,111 → 9,037,839 |                 92 → 91 |                        3603.0 → 5632.9 |  56.3% |    2425.9–15817.9 |    2440.9–7772.3 |
| cave-lioness        | phone   | b222e93a           |                 5 |   8,995,571 → 8,964,646 |                 92 → 91 |                        4439.4 → 3917.6 | -11.8% |     2401.4–7540.6 |   2462.6–24569.3 |
| toy-trex            | phone   | b222e93a           |                 5 |   8,994,785 → 8,991,513 |                 92 → 91 |                        3119.8 → 3476.7 |  11.4% |     2316.2–8667.3 |   3129.8–15320.2 |
| pyrite-cubes        | phone   | b222e93a           |                 5 |   8,576,038 → 6,948,536 |                 92 → 91 |                        2823.8 → 2396.9 | -15.1% |     2203.4–4201.8 |    1987.2–2461.9 |
| soda-can            | phone   | 30ed36e5           |                 5 |   8,878,102 → 8,918,262 |                 92 → 95 |                        2061.2 → 2157.2 |   4.7% |    1980.8–10299.2 |    2015.3–6782.0 |
| sunglasses          | phone   | 30ed36e5           |                 5 |   8,895,766 → 8,892,431 |                 92 → 91 |                        2142.5 → 1995.4 |  -6.9% |     1499.6–6738.9 |    1802.7–3726.7 |
| fountain-pen        | phone   | 30ed36e5           |                 5 |   8,879,504 → 8,876,169 |                 92 → 91 |                        2387.5 → 1870.3 | -21.7% |     1647.6–8794.9 |    1526.0–2845.8 |
| pyrite-cubes        | desktop | b222e93a           |                 5 |   9,343,416 → 9,340,144 |               172 → 171 |                        4233.9 → 4558.0 |   7.7% |     3332.1–8306.5 |    2968.2–5774.9 |
| soda-can            | desktop | b222e93a           |                 5 | 10,106,382 → 10,103,110 |               220 → 219 |                        4094.4 → 4406.1 |   7.6% |     2326.9–5274.3 |   2433.1–18560.7 |
| sunglasses          | desktop | b222e93a           |                 5 |   9,866,324 → 9,863,052 |               220 → 219 |                        4108.6 → 4328.5 |   5.4% |     2588.5–4595.6 |   2746.5–13438.3 |
| fountain-pen        | desktop | b222e93a           |                 5 |   9,844,492 → 9,841,220 |               220 → 219 |                        5231.2 → 4415.9 | -15.6% |    3779.5–18242.0 |    3022.8–5608.7 |

All observations and settings are in [current-results.json](load-time-2026-10/current-results.json).
Bytes and request counts are means; first-frame times are medians with full ranges. A smaller
payload alone does not prove a faster opening.

A separate fixed five-pair control opened the identical frozen main on the same HTTP origin in both
phases for all 12 previously slower groups. It produced 8/12 higher medians, with group median
changes from -24.7% to 62.6%. [same-main-control.json](load-time-2026-10/same-main-control.json)
records all settings and ranges. This quantifies repeatability on this device; it is not pooled with
candidate results and does not establish that any particular candidate increase is noise.

## Eager fallback for every previously slower group

The preceding implementation still awaited an opening-pack promise before renderer creation, decoded
shared scenes again inside Player.init, started scan preparation before GPU initialization, loaded
scan helpers dynamically, and inflated a Blob help module. The current change removes those paths
globally. The app, Player, UI, and embed JavaScript entry files match the frozen main byte for byte;
the original HTML engine preload and native app entry remain. The original eager museum-helper
import is restored, and the scan decoder is back in its original module so it adds no runtime module
request.

A new browser regression test holds compressed shared-scene decoding. Before the fix, renderer
creation never starts within the unchanged test window; after the fix, it starts before the scene is
released and the same shared toy then loads. Two further tests hold the unused PDF decompressor and
edition metadata responses and verify that an ordinary opening can finish. Both PDF-only module
dependencies are removed from ordinary startup. Red and green receipts, source hashes, the
parser-based eager import comparison, and exact fallback coverage are recorded in
[eager-fallback.json](load-time-2026-10/eager-fallback.json). These tests establish the removed
startup dependencies; they do not assign each historical median difference to one cause.

The fallback covers all 12 groups named in the review:

- phone / video-3d: restored main's eager startup order and native help loading.
- phone / living-city: restored main's eager startup order and native help loading.
- phone / celestial-globe: restored main's eager startup order and native help loading.
- phone / crochet-earth: restored main's eager startup order and native help loading.
- phone / seeded-loaf: restored main's eager startup order and native help loading.
- phone / moving-photo-3d: restored main's eager startup order and native help loading.
- phone / turtle-souvenir: restored main's eager startup order and native help loading.
- phone / maple-tree: restored main's eager startup order and native help loading.
- phone / cave-lioness: restored main's eager startup order and native help loading.
- phone / soda-can: restored main's eager startup order and native help loading.
- phone / sunglasses: restored main's eager startup order and native help loading.
- desktop / pyrite-cubes: restored main's eager startup order and native help loading.

Sunglasses, Soda can, and Fountain pen now use their unchanged original full scan files at every
detail setting. The new full-file selection tests failed before this fallback and pass after. Their
three phone groups use five fresh pairs on the final revision; none of the earlier prefix
measurements is pooled into them. The disabled prefix files remain as generated artifacts with their
original byte proofs; they are not requested at runtime. Water bottle and Baseball cap retain
exact-record prefixes with original population counts; four museum scans also retain the exact
full-scan Float64 smoothing means. Higher detail uses the original full scan. Geometry, rendered
splat counts, precision, textures, controls, clocks, and cameras are unchanged. PDF gzip retains
every decoded byte; GIF encoding code remains deferred until export.

## Strawberry repeated comparison

The original protected test from 613213cf was run ten times per source on the eager-startup revision
b222e93a and frozen main, in alternating adjacent order, without changed controls, clocks,
thresholds, waits, retries, or fixture observers. Main: 8/10 passed, 2/10 failed. Candidate: 9/10
passed, 1/10 failed. Complete per-run statuses, failure messages, dates, source pins, and the
original test hash are in [strawberry-repeat.json](load-time-2026-10/strawberry-repeat.json). Pilot
or interrupted batches are excluded.

In the separate current-test batch with the upstream readiness fix, the strawberry section passed
10/10 on main and 10/10 on the candidate. Strawberry-section failures: 0 main, 0 candidate;
unclassified outcomes: 0 main, 0 candidate. The full composite test, which continues through Lantern
and Jelly blob, passed 8/10 on main (2 failures) and 10/10 on the candidate (0 failures). Every
later failure and its source location remains recorded. Section completion is inferred only from a
passed full test or a failure after that section. Distinct test hashes and complete ten-run receipts
are retained; the two versions are not pooled, and differing observed rates are not proof of equal
underlying rates.

The retained failure traces show why this is sensitive to wall time: one original main return-frame
screenshot took 26,841 ms, longer than the entire 15,000 ms poll. In the branch failure, the two
return-frame screenshots took 4,029 and 6,027 ms. These are timings from the existing Playwright
traces, with no added observer. The fixed test waits for camera and pulse readiness before entering
that image poll; the animation clock and pixel thresholds are unchanged.

Current main independently changed this smoke test to wait for its camera to settle and for its
animation pulse to finish before comparing return frames. Those upstream changes arrived through an
ordinary merge; this PR does not edit the protected test. The ten-per-source comparison deliberately
uses the earlier, unchanged test, so the result does not come from relaxing that predicate.
[Earlier observed failures](load-time-2026-10/superseded/round3-strawberry-timing.json) on both
sources expired with the pulse still running (1.8667 and 1.9332 of its 2.2 simulation seconds). That
observation explains why a 15-second wall-time poll can miss the end on a slow software renderer; it
is historical evidence with its own source pins, not a new rate measurement.

## Visual and regression evidence

50 prior GPU-finished comparisons remain in [image-diffs.json](load-time-2026-10/image-diffs.json):
49 are pixel-identical; the desktop book differs at eight pixels by at most one RGB level. Every
recorded tap pose moved. Their original capture source pins remain intact. The eager fallback
changes discovery order; the final three scan fallbacks restore the original data files. The 13
shared renderer, rig, camera, entry, and help files are unchanged from the repeated-test source and
frozen main. The exact-buffer and decoded-byte tests verify the retained lossless data. Lossy
point-budget alternatives remain unshipped in
[lossy-options.json](load-time-2026-10/lossy-options.json).

Required regression results: 190 passed, 0 failed, and 0 skipped. 0 spec processes returned a
nonzero exit code.

Latest validation, all red tests by name, commands, source pins, and protected-file checks are in
[verification.json](load-time-2026-10/verification.json). Required smoke, taps, kit, unit, Real
Objects, and all load-time specs run on the final runtime source. The repeated Strawberry runs
retain their actual earlier source pins; the only subsequent runtime change is the three scan
selectors, and no rig, camera, renderer, or clock code changed. Historical validation is labeled by
its actual source and is not counted as this run.

| Lossless PDF source                          | Original bytes | Gzip bytes | Saving |
| -------------------------------------------- | -------------: | ---------: | -----: |
| manual/tinkerers-manual.pdf                  |      7,792,711 |  5,858,411 |  24.8% |
| manual/tinkerers-manual-85d32b96193ea275.pdf |      7,792,711 |  5,858,411 |  24.8% |

Hashes and unchanged-byte proofs are in
[compressed-opening.json](load-time-2026-10/compressed-opening.json),
[prefixes.json](load-time-2026-10/prefixes.json), and
[museum-prefixes.json](load-time-2026-10/museum-prefixes.json). Asset licenses, notices, and NC tags
remain unchanged. No new asset source was introduced by this review change.

## Method and limits

Phone: 390×844, DPR 3, touch/mobile, weak/low. Desktop: 1440×900, DPR 1, high. Chromium 151, WebGL2
through Linux llvmpipe, three Mesa threads, four CPU quota, nice 10, display :99. Sound and
adaptation are off; seed is 424242. This is one software-rendering device using phone and desktop
settings, not a physical phone or the earlier Mac/Metal device. First frame is navigation through
the first submitted postrender after the requested toy becomes ready.

Payload counts completed HTTP bodies at a 1.5-second settling cutoff and excludes headers,
unfinished responses, and blob/data URLs. Local plain-server bodies are not public transfer sizes.
Historical public per-file GETs in
[production-transport.json](load-time-2026-10/production-transport.json) showed that Pages already
compresses native JavaScript; custom engine and help gzip loading have both been removed. The
candidate data files have not been deployed, and their public transfer savings are unmeasured.

Serve frozen main on 4174 and candidate on 4173. Run
`node tools/load-time-paired.mjs --only=ID,ID --device=phone --samples=5 --out=DIR --frozen-main=COMMIT --candidate-source=COMMIT`.
Run the four reviewed toys at both settings in a separate directory.
`node tools/load-time-report.mjs --timing=DIR --payload=DIR --fallback=DIR` validates complete
groups and source pins, then writes this single current table. Raw request traces, repeated-test
JSON, and browser artifacts stay outside Git; the compact audit remains strictly below 3,000,000
bytes.

Older numeric screens and verification receipts are superseded, with their source metadata retained.
The original heavy set is retained for comparison; the full catalog has not been rescreened on
current main. No frame-cadence or heap claim is made. Protected PLY assets remain unchanged, so the
unused-column option is still deferred.

Rule check: the prior unpublished email metadata history rewrite conflicts with E1. All subsequent
review changes, including the current main merge, are additive.

# R2 result: exact-ceil HTML playback is not reliable enough for integration

All20 declared phone cases completed once, in manifest order, 2026-10-15T11:21:20.060Z to 2026-10-15T11:26:34.906Z. No retries, tuning, source-specific presets or reduced trial budgets. One Chromium 151.0.7922.173 browser used the unchanged native SwiftShader arguments and exact benchmark mobile context settings on an empty local fixture page. Videos remained local and muted. This was extraction research under concurrent native load, not an end-to-end bake or physical phone benchmark.

Four of17 table-supported clips produced a full verified set. Thirteen skipped a mandatory source frame and returned no completed photos. Three complex-edit captures were immediate explicit table fallbacks. `Fallback` denotes no usable complete R2 result; this experiment did not subsequently run legacy extraction. Costs below therefore exclude any later legacy fallback cost.

| Source | R2 outcome | Exact trials before finish/failure | Capture / attempted seconds | Independent proof seconds | Total seconds |
|---|---|---:|---:|---:|---:|
| cat-track | verified | 48 | 16.247 | 9.107 | 28.015 |
| cat-plays | verified | 48 | 11.995 | 9.301 | 22.901 |
| buddha | skipped ceil frame | 40 | 41.924 | — | 43.587 |
| chameleon-flowers | skipped ceil frame | 22 | 9.967 | — | 11.364 |
| dianthus | unsupported edit list | 0 | — | — | 0.079 |
| pisac | skipped ceil frame | 45 | 13.471 | — | 14.905 |
| sleeping-dog | skipped ceil frame | 3 | 3.716 | — | 5.480 |
| palace-statue | skipped ceil frame | 10 | 4.977 | — | 5.762 |
| oa-street | verified | 48 | 16.006 | 11.424 | 28.900 |
| ullard | verified | 48 | 17.620 | 14.911 | 33.880 |
| snaefell | skipped ceil frame | 6 | 4.588 | — | 5.548 |
| fremantle-orbit | skipped ceil frame | 14 | 6.473 | — | 7.667 |
| ihasalu-orbit | skipped ceil frame | 2 | 2.918 | — | 4.898 |
| fresnel-lens | skipped ceil frame | 12 | 5.437 | — | 6.835 |
| saint-denis | skipped ceil frame | 0 | 1.676 | — | 2.945 |
| horse-statue | unsupported edit list | 0 | — | — | 0.090 |
| royal-sovereign | unsupported edit list | 0 | — | — | 0.022 |
| viljandi-ruins | skipped ceil frame | 6 | 4.656 | — | 5.556 |
| kakerdi-bog | skipped ceil frame | 13 | 6.965 | — | 7.986 |
| fjoloy | skipped ceil frame | 21 | 9.545 | — | 10.816 |

All13 skipped observations were exactly one source frame after the required ceil PTS (+41.666–41.667ms), independently checked against the next table sample. Examples: Buddha6.791667s rather than6.75s, plant4.75s rather than4.708333s, Pisac9.541667s rather than9.5s. Buddha had completed40/48 exact trials and13 full windows; plant22/48 and7 windows; Pisac45/48 and15 windows. Those prefixes remain telemetry only; no partial photos were returned. Total failed-capture cost across13 skipped cases was116.312s (range1.676–41.924s). No timing win is claimed for these failures.

For the four completed cases, every one of192 trials matched the mandatory ceil source PTS at rounded-microsecond precision; every one of64 selected JPEGs matched an independently presented source frame and its repeated deterministic JPEG encoding byte for byte. Independently matched sourceTime equaled recorded actual RVFC.mediaTime within1µs, and source time was never relabeled from a requested target. No held-out images were read. The unchanged receipt helper generic text mentions held-out disjointness, but that is explicitly inapplicable here because times/views are empty.

All supported cases used16 native windows except palace15; all used3 original sharpness trials/window,480longside, original crop/fit/gray/sharpness/JPEG.92. Warm startup was one uniform actual seek plus at most one actual rewind, followed by1× playback, pause/copy at an exact desired callback, and resume. The algorithm was not changed during collection.

The native abort control stopped after its first actual plant trial with AbortError, no completed/partial returned photo set, paused video, removed source, and closed context. Every case context closed; every opened source was paused and removed. Browser and local server closed normally. No case watchdog/collection deadline or runner error fired. CPU controls15/15 passed. The post-run independent integrity check verified all20 input bytes/order, served research code hashes, actual mobile context declaration, native plans, every target, all387 exact successful trial telemetry rows including discarded prefixes and abort, next-source-frame miss classification, and cleanup. Final saved-photo integrity checks passed.

R1 has historical seek controls for cat/plant/Fremantle; R2 cat-plays captured in11.995s versus R1 seek29.181s, but R1 used1440×900 rather than the actual mobile context, at another time/load. This is a historical comparison only. R2 plant and Fremantle failed despite R1 phone positives, confirming the need to keep the strict guard and negatives. No full corpus speed/quality or integration acceptance is established. Desktop was never tested with R2.

Recommendation: retain this as negative reliability evidence; do not enable this complete-set1× playback algorithm based on four supported successes. The frozen R10 product/runtime/protocol/controller and all native jobs were untouched. Root may separately evaluate a future prefix-preserving hybrid, but no such path was implemented or tested here.

Evidence: declaration.json; results.json; summary.json; integrity.json; integrity-check.log; integrity.log; cpu-tests.log; all per-case result.json and64JPEGs; FFprobe tables; corpus-manifest.json source/author/license credits; environment.json binary/source hashes. All images are under1MB. The freeze receipt binds every file. Own original research code is MIT; original footage licenses remain as attributed in the manifest.

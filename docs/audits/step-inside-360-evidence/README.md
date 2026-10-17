# Step inside a 360° photo: final evidence

Made by Ryan with Codex (GPT-6), October 17, 2026.
[Draft PR #700](https://github.com/ryanjosephkamp/splashery/pull/700). **Never merge this evidence
branch. The measured depth and seam targets pass. The full-suite gate is not met. Physical-phone
performance is unmeasured.**

The final method uses six overlapping 294-pixel perspective tiles, four 294-pixel panorama yaw
views, robust inverse-depth alignment with local RGB calibration confidence, and a fixed 0.375 cube
blend. It uses only the model already shipped by Splashery. Floor calibration, larger priors, and
eight-yaw variants were cut.

| Gate                             | Final result                                                                                                                                                                                                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Depth: at least 20% lower AbsRel | **Pass (mean):** 25.63% lower pooled mean across all twenty-four scenes (0.145011 versus 0.194976). Three scenes regress; every case is retained.                                                                                                                                           |
| Median seam below 2%             | All twenty-three measured scene medians pass; coast has zero valid seam pairs and is unmeasured. No stitching line observed in inspected turn frames; full recordings below. Stretching after translation remains visible and warned.                                                       |
| First look within 25 s           | 1.423–2.359 s in desktop phone emulation, including the interactive radius preview.                                                                                                                                                                                                         |
| Phone memory proxy               | Quiet matched 2048-pixel inputs: panorama 1001–1009 MiB PSS versus Classic 1,177–1,235 MiB. Same viewport, normal product pixel caps; not physical-phone qualification.                                                                                                                     |
| Eight clips                      | All eight complete native recordings below; no page errors, warning reached, lean and step completed, and return to center.                                                                                                                                                                 |
| Classic                          | All 77 golden tests passed, including both budgets for all 76 frozen samples; frozen source and old tests unchanged.                                                                                                                                                                        |
| Regressions                      | **Full-suite gate not met.** All 401 files reported: 3,412 tests passed, three failed, and one existing private-fixture skip. Panorama 19/19, Classic golden 77/77, merged-head related run 111/111, and post-merge preflight 272/272 pass. Full failure and recheck receipts are retained. |

## Eight complete recordings

390×844 Chromium, DSF 3, low profile, normal 585×700 stage cap, Mesa llvmpipe. The final recordings
were made after the bulk model and regression jobs finished. They preserve startup, the full turn,
ceiling, floor, lean, step, warning, and return. Camera look poses are automated through the real
camera; lean, step, and home use the real controls. Each pose draws before recording continues.
Nothing in the product renderer or inference is mocked. Videos are the complete native Playwright
recordings; no trimming, transcoding, or frame interpolation.

The clock starts after app readiness, immediately before selecting the tool. It excludes initial
navigation and mobile bandwidth. First look includes an interactive radius preview; depth-ready is
separate. Custom runs include the default sample and automated file selection. These are desktop
measurements, not physical-phone speed, sensors, RAM, or GPU-memory measurements.

| Input / full native video                                                            | First look, s | Depth ready, s | Peak PSS, MiB |
| ------------------------------------------------------------------------------------ | ------------: | -------------: | ------------: |
| [room](clips/room.webm) · [frames](clips/room-frames.jpg)                            |         1.719 |          1.757 |         782.4 |
| [room2](clips/room2.webm) · [frames](clips/room2-frames.jpg)                         |         1.811 |          1.823 |         818.1 |
| [truth-room](clips/truth-room.webm) · [frames](clips/truth-room-frames.jpg)          |         1.721 |          9.697 |         976.5 |
| [truth-desk](clips/truth-desk.webm) · [frames](clips/truth-desk-frames.jpg)          |         2.359 |         10.428 |         965.7 |
| [truth-stairs](clips/truth-stairs.webm) · [frames](clips/truth-stairs-frames.jpg)    |         2.179 |         10.716 |         964.0 |
| [truth-arches](clips/truth-arches.webm) · [frames](clips/truth-arches-frames.jpg)    |         2.149 |         10.271 |         978.5 |
| [truth-steps](clips/truth-steps.webm) · [frames](clips/truth-steps-frames.jpg)       |         2.286 |         10.655 |         957.7 |
| [truth-lattice](clips/truth-lattice.webm) · [frames](clips/truth-lattice-frames.jpg) |         1.423 |          9.560 |         966.1 |

[Step frames](clips/step-contact-sheet.jpg) ·
[Time-sampled look filmstrips](clips/look-contact-sheet.jpg) ·
[Raw phone measurements and source hashes](measurements/phone-profile.json). The linked per-clip
filmstrips sample the complete native videos at about half-second intervals. Empty cells after a
short video ends are contact-sheet padding, not missing product frames.

## Depth, delta1, and seams

Each method receives one whole-sphere median scale calibration. Error uses every opaque, unambiguous
truth pixel with spherical-area weights; no prediction removes scoring pixels. The primary naive run
uses one 294-pixel equirectangular inference. An additional 392-pixel naive control is retained in
raw scores, including zero-output failures; it is not substituted to make the gate pass. The final
method uses ten inferences, so this is not a matched-compute comparison. Benchmark inference
milliseconds include both naive runs; separate phone timings above measure actual product behavior.

| Group               | Final mean AbsRel | Naive mean AbsRel | Improvement |
| ------------------- | ----------------: | ----------------: | ----------: |
| Development         |          0.088125 |          0.120686 |      26.98% |
| Additional families |          0.124178 |          0.162985 |      23.81% |
| Closed interiors    |          0.141093 |          0.176685 |      20.14% |
| Fresh room layouts  |          0.226650 |          0.319546 |      29.07% |

| Scene         | Final AbsRel | Naive AbsRel | Final delta1 | Naive delta1 |          Seam median |
| ------------- | -----------: | -----------: | -----------: | -----------: | -------------------: |
| room          |      0.09321 |      0.13698 |       0.8604 |       0.7536 |               1.048% |
| desk          |      0.11975 |      0.13554 |       0.8926 |       0.8461 |               1.043% |
| stairs        |      0.08281 |      0.13161 |       0.9170 |       0.7587 |               1.016% |
| arches        |      0.11018 |      0.09543 |       0.8532 |       0.9327 |               1.704% |
| steps         |      0.06039 |      0.10206 |       0.9863 |       0.8403 |               1.332% |
| lattice       |      0.06240 |      0.12250 |       0.9606 |       0.7958 |               1.244% |
| still-life    |      0.10782 |      0.09213 |       0.8912 |       0.9877 |               1.173% |
| forest        |      0.07359 |      0.12566 |       0.9208 |       0.7662 |               1.373% |
| coast         |      0.12885 |      0.16495 |       0.6747 |       0.5660 | unmeasured (0 pairs) |
| fur           |      0.07298 |      0.13746 |       0.9781 |       0.7598 |               1.106% |
| night         |      0.28013 |      0.33126 |       0.4827 |       0.4400 |               0.262% |
| leaves        |      0.08170 |      0.12645 |       0.9763 |       0.7780 |               1.190% |
| interior-01   |      0.12965 |      0.13864 |       0.8126 |       0.7975 |               0.565% |
| interior-02   |      0.17163 |      0.17534 |       0.7137 |       0.7022 |               0.381% |
| interior-03   |      0.11930 |      0.14823 |       0.8812 |       0.8110 |               0.570% |
| interior-04   |      0.13476 |      0.26056 |       0.9070 |       0.5451 |               0.731% |
| interior-05   |      0.16371 |      0.20838 |       0.7172 |       0.6053 |               0.534% |
| interior-06   |      0.12750 |      0.12896 |       0.8692 |       0.8420 |               0.749% |
| fresh-room-01 |      0.27055 |      0.41867 |       0.6352 |       0.5674 |               0.508% |
| fresh-room-02 |      0.20491 |      0.25096 |       0.6343 |       0.7294 |               0.740% |
| fresh-room-03 |      0.33636 |      0.31313 |       0.4848 |       0.5079 |               0.457% |
| fresh-room-04 |      0.15889 |      0.30983 |       0.7938 |       0.4123 |               0.866% |
| fresh-room-05 |      0.24573 |      0.35008 |       0.5464 |       0.4197 |               0.515% |
| fresh-room-06 |      0.14346 |      0.27461 |       0.7809 |       0.4983 |               0.564% |

Exact outputs and calibration are under measurements/. Additional groups are
measurements/validation/, measurements/interior/, and measurements/fresh-room/. Raw JSON is
compressed; none of the final predictions was fitted to true depth. Seam pairs cross dominant cube
boundaries or longitude wrap. Raw tile-overlap residuals remain larger and are reported separately.
Feathering can hide a seam without fixing geometry.

Task 105 had not landed at task start, so Blender 4.3.2 imports the existing
studio-truth-generate.py builder. truth/ contains the original six development scenes;
truth-validation/ contains six additional families; truth-interior/ contains six closed-enclosure,
shifted-camera variants sharing the original furniture families. These variants are not six new
independent scene families. truth-fresh-room/ adds six independent furniture and room layouts, also
using the existing builder helpers. Exact radial BVH depth, masks, source panoramas, and held-out
images are included. The earlier quarter-cube method missed the goal. Calibration-only RGB
confidence was then tested with four fixed weights on the original six. A 0.375 blend minimized
development mean but failed a conservative 5% per-scene preference. A separate aggregate-accuracy
plan assessed this fixed candidate on the other twelve and six fresh room geometries before
adoption. The fresh generator, layouts, and poses were frozen before assessment. Three regressions
and the amended criterion are explicit. No weight was tuned on the fresh six. These are correlated
synthetic scenes and are not untouched future benchmarks. No failing group is omitted. The three
regressions are arches (15.46%), still-life (17.03%), and fresh-room-03 (7.42%).

## Actual product held-out views

Real low-profile Kit/WebGL2, exact 256×256 buffers, snapped 72-degree camera, and lateral 0.3 m or
0.8 m displacement. Masks are fixed from true source visibility and retain missing predicted pixels.
The shared 16-bit depth cache clips all methods at 200 m to preserve precision. Local luminance SSIM
uses 8×8 windows, stride 4, and at least 48 fixed valid pixels. Columns list **final / naive /
true-depth reprojection control**. The control exposes sampling, occlusion, blur, and noisy
references; it is not a mathematical upper bound.

| Scene         |               0.3 m SSIM |               0.8 m SSIM |
| ------------- | -----------------------: | -----------------------: |
| room          | 0.4535 / 0.4331 / 0.4549 | 0.4221 / 0.3982 / 0.4482 |
| desk          | 0.6190 / 0.6233 / 0.6702 | 0.5713 / 0.5783 / 0.6663 |
| stairs        | 0.5386 / 0.5359 / 0.5460 | 0.4936 / 0.4930 / 0.5090 |
| arches        | 0.4020 / 0.3747 / 0.4410 | 0.3372 / 0.3018 / 0.4270 |
| steps         | 0.7205 / 0.7128 / 0.7197 | 0.6779 / 0.6389 / 0.7025 |
| lattice       | 0.4247 / 0.4239 / 0.4136 | 0.3954 / 0.3929 / 0.4007 |
| still-life    | 0.7944 / 0.8034 / 0.8091 | 0.7691 / 0.7852 / 0.8086 |
| forest        | 0.4539 / 0.3973 / 0.4759 | 0.3802 / 0.3064 / 0.4654 |
| coast         | 0.5952 / 0.5918 / 0.6162 | 0.5069 / 0.4669 / 0.6147 |
| fur           | 0.6282 / 0.6284 / 0.6393 | 0.6049 / 0.6016 / 0.6203 |
| night         | 0.1186 / 0.1211 / 0.1310 | 0.1155 / 0.1088 / 0.1318 |
| leaves        | 0.6182 / 0.6367 / 0.6499 | 0.6023 / 0.6017 / 0.6427 |
| interior-01   | 0.1335 / 0.1356 / 0.1342 | 0.1342 / 0.1340 / 0.1333 |
| interior-02   | 0.1917 / 0.1888 / 0.1940 | 0.1870 / 0.1798 / 0.1900 |
| interior-03   | 0.1854 / 0.1874 / 0.1862 | 0.1846 / 0.1857 / 0.1888 |
| interior-04   | 0.1509 / 0.1505 / 0.1718 | 0.1445 / 0.1410 / 0.1732 |
| interior-05   | 0.1817 / 0.1755 / 0.1828 | 0.1713 / 0.1630 / 0.1787 |
| interior-06   | 0.1850 / 0.1824 / 0.1840 | 0.1805 / 0.1826 / 0.1805 |
| fresh-room-01 | 0.4069 / 0.4046 / 0.4128 | 0.3941 / 0.3859 / 0.4111 |
| fresh-room-02 | 0.6667 / 0.6778 / 0.6859 | 0.6433 / 0.6646 / 0.6893 |
| fresh-room-03 | 0.5617 / 0.5724 / 0.5754 | 0.4992 / 0.5254 / 0.5334 |
| fresh-room-04 | 0.1839 / 0.1839 / 0.1835 | 0.1740 / 0.1714 / 0.1717 |
| fresh-room-05 | 0.0694 / 0.0681 / 0.0707 | 0.0568 / 0.0625 / 0.0707 |
| fresh-room-06 | 0.1156 / 0.1141 / 0.1151 | 0.1148 / 0.1182 / 0.1180 |

GPU scores and exact source hashes accompany each group's measurements. Reference images, fixed
masks, and GPU/software diagnostic images are under views/ and the truth folders. Software
point-splat SSIM is labeled separately in scores.json. Earlier unsnapped-camera measurements are
rejected; see gpu-frame-review-findings.md and the original review archive.

## Memory, tests, and source identity

verification/classic-final-quiet.json and panorama-final-quiet-memory.json preserve three cold
conversions of the same 2048-pixel CC0 input. Both use 390×844 and DSF 3. Classic's normal stage
buffer is 585×1266; panorama controls leave 585×700. Classic uses the existing read-only worker
probe, whose exact method is included. PSS is sampled at 200 ms for Classic and 100 ms for panorama.
Sampling may miss short transients; RSS double-counts shared pages. Observed peaks are not a
universal ceiling. Concurrent-load results are retained separately from the quiet comparison.

The yaw loop now reuses one scratch buffer, avoiding two full-size RGBA allocations. The historical
eighteen-input reuse experiment preserved all tensor values, final depth, and sample caches before
the later confidence method. Its equivalence records are retained. The adopted confidence method
intentionally changes geometry. The later unsupported-tile guards preserve both new sample caches
exactly; strict analytic regressions cover exact, affine, and constant front fields without moving
supported calibration. No image detail or inference resolution was reduced.

The final main merge includes the approved Neuron r2 sharpness update (ea9a9d193). Every recorded
phone/model/cache/runtime source hash is unchanged. The fresh merged-head run passed all 111 tests:
19 panorama, 77 Classic golden, and 15 related Neuron tests. Post-merge preflight passed all 272
checks. All 111 related tests also passed in the complete hosted matrix.

**The full-suite gate is not met.** The final matrix on f94345f3f covered all 401 spec files and
3,416 tests: 3,412 passed, three failed, and one pre-existing test was skipped. The exact current
summary, original ZIP, per-file times, source identity, raw failure logs, traces, screenshots, and
isolated rechecks are under verification/final-ci/ and verification/. CI's synthetic checkout has
exactly the published code tree. The failed cases are:

- pages-r2:495: opaque tilted PDF coverage, mean difference 19.4846 versus <0.5. The isolated CI
  recheck also failed. The same case passed locally on untouched main ea9a9d193 and this branch
  under the same setup. Test and shared-renderer blobs match main; the CI cause remains unresolved.
- phy:64: Pebbles stacking, height 0.173363 versus >0.219398. The isolated recheck passed. The same
  assertion also failed in the earlier untouched-main local reproduction.
- shp:131: sharpness-off renderer comparison, mean difference 0.570544 versus <0.5. The isolated
  recheck passed. The original failure still counts.

The sole skipped case is cdx-v3d-calibration:215, whose counterexample clips are held privately
outside the repository. No new panorama test was skipped. No tolerance, assertion, old test,
existing pack, or shared renderer was changed by this task to hide a failure. The PR remains a
draft. Physical-phone performance remains unmeasured.

The preceding full matrix on 652fe9449 covered all 401 files and 3,416 tests. Initially, 3,412
passed, three failed, and one was skipped. WebGPU comparison (fx4-engine:79), Hands-on (hl1:92), and
Pebbles (phy:64) all passed isolated rechecks. A single full-shard rerun passed WebGPU and Hands-on
but ended with 3,413 passes, two failures, and one skip. Pebbles failed again; quartz snap-back
(hh5-gems:154) failed after passing in the first matrix. Both passed isolated rechecks. These remain
failures, and no further retry followed. Both complete summaries, raw logs, relevant JSON,
screenshots, traces, original artifact hashes, and rechecks are retained in
verification/pre-neuron-r2-ci/ and verification/. The skipped Video to 3D counterexample test
requires privately held clips outside the repository; no new panorama test was skipped.

The redundant local full run was interrupted by an exec-server transport disconnect after 17 files
and 255 passing tests, with no failures or skips. Its complete partial reports and logs are
retained; it is not a full-suite pass. Files survived, and hosted CI continued independently.

All 1,646 frozen-file Git blobs match merged main. The unchanged Pebbles stacking assertion also
failed in a detached checkout of untouched main at ceb51de7a; its engine and test bytes remain
identical in the newer main merges. No old assertion, pack, player, stage, or shared renderer was
changed by this task. Initial CI also caught stale generated Showcase counts, now regenerated, and a
PDF rendering assertion that passed its isolated recheck. Historical verification logs remain under
rejected/initial-verification/.

Original offline confidence scores used jpeg-js pixels; final product scores use Chromium decoding.
Different decoders produce different confidence masks, so those scores are kept distinct. With
identical browser pixels and raw tensors, all twenty-four final reconstructions exactly match the
reviewed fixed candidate. All six fresh browser-prototype fields match exactly. Review source
snapshots, hashes, scripts, and all 144 per-face support flags are retained.

source-identity.json identifies the final code revision and runtime bytes. artifact-hashes.json
covers every evidence file except itself. Actual high-profile desktop and WebGPU compatibility
checks are under ui/ and verification/; their timing is not a phone claim.

## Research, licenses, and reproduction

The initial cube-only result (mean 0.2120 versus naive 0.1207) is retained under
rejected/six-view-only/. The superseded quarter-cube method (14.6% lower mean AbsRel) remains under
rejected/quarter-cube-no-confidence/. Other rejected captures retain their metadata and
explanations; only the final eight native videos are presented as current.

research/ contains verified archives of calibration/gauge/convergence, FOV 100/130, 518-pixel,
dense-tile, uncertainty, local-RGB, floor, 392-pixel prior, and eight-yaw studies. Floor variants
improved selected development scores but failed closed interiors. Four 392-pixel priors passed 20%
on development but regressed four of six closed interiors; eight 294-pixel yaw views slightly
worsened development error. No failed alternative was silently promoted. Truth-assisted affine fits
are labeled oracle diagnostics, never production results. A corrected 95 MiB indoor metric pilot
retains the unnormalized range and still fails; no alternative weights are included.

Large research archives are split into 2 MiB parts for reliable transport. Each .parts/ directory
has a manifest with member and whole-archive SHA256 values. Concatenate part-\* in filename order,
verify the complete hash, and extract with tar -xzf. The original review-evidence.tar.gz,
projection-studies archive, and final confidence-review/research supplements remain separate. No
model weights or private uploads are published.

The exact shipped samples are sources/room.jpg and sources/room2.jpg. Their live
[room 1](https://polyhaven.com/a/small_empty_room_1),
[room 2](https://polyhaven.com/a/small_empty_room_2), and [license](https://polyhaven.com/license)
pages were checked on October 17, 2026, and identify Sergej Majboroda and CC0. Compressed page
snapshots are included. tools/assets.json records original and shipped hashes, the 8192×4096 to
2048×1024 reduction, and final bake provenance. Original large downloads are not duplicated here.
Synthetic assets are original CC0; code is MIT.

Use the code PR checkout and its existing dependencies. Copy the four truth folders to
.cache/pano3d/; place each group's compressed raw inference and scores under its corresponding cache
output folder, then decompress inference JSON. The committed tools accept SPLASHERY_PANO_TRUTH,
SPLASHERY_PANO_EVIDENCE, and SPLASHERY_PANO_PORT for additional groups. Run tools/pano-evaluate.mjs,
tools/pano-gpu-views.mjs, and tools/pano-clips.mjs with Chromium. Blender is only needed to
regenerate truth. SPLASHERY_GL=llvmpipe and DISPLAY select Mesa; otherwise the capture tool uses
SwiftShader. Research plans and archived sources state their original cache dependencies and
selection chronology.

The PR remains a draft, and this evidence branch remains unmerged.

Rule check: none.

# Task 88: Video to 3D real-clip evidence

This branch is review evidence only and must never be merged. The accepted corpus was frozen before
candidate quality measurements. The product branch is `codex/video-3d-r4`. The audit records results
and limitations; the goal is still being measured.

## Revision 11 in progress

The new frozen source is `636a7605fd15f3aa1e41d43cc6b5ff35432750b6`, with served-source SHA-256
`065978f64c7d586b46591356192df441e669243e8478e8e84a46b0eda4cc600b` across 378 paths. Fresh native
corpus and six-sample checks are running. All older measurements retain their original source
identity and failures. The deadline remains October 15, 2026, at 16:32:25 UTC.

The [new main snapshot](measurements/main-master-r1-snapshot-0032/run.json) has 32 recorded
outcomes. The
[final revision-10 snapshot](measurements/candidate-r10-paired-master-v1-snapshot-0015/run.json) has
15 paired rows, including seven completed phone quality measurements and a horse-statue
independent-JPEG verification failure. All 26 raw attempts, including eleven unpaired attempts,
remain under [the shard snapshots](measurements/candidate-r10-v1-shards/).
[Final reconciliation](evidence/r10-final-reconciliation-r1/result.json) checks that the original
state, raw rows, and artifacts stayed unchanged. No completed desktop quality baseline exists in
this capture, and the corpus gates remain unproved. The earlier interactive dashboard below is a
point-in-time view and does not contain this newer snapshot.

[Bounded raster preparation](evidence/tile-size-integration-preparation-r5/) records 22 CPU controls
and six real GPU fixtures. Complete optimizer state matches after four steps in each fixture,
including dense overlap, supersampling, and capacity fallback. Integrated checks passed 24 cases.
The smaller tiles require enough space for every possible padded contribution; the full square phone
entry allocation can grow from 96 MiB to 400 MiB. Native time and sampled memory must be measured
before claiming an end-to-end benefit. Earlier preparation failures are retained beside the final
proof. The [cached-input probes](evidence/tile-size-probe-r2/) are diagnostics only. Their additive
attribution correction supersedes a mistyped source URL in the original assessment: the correct
source is Ventrovert's
[Chameleon on ixora flowers](https://commons.wikimedia.org/wiki/File:Chameleon_on_ixora_flowers.webm),
under CC BY 4.0.

[Optional-fit recovery](evidence/background-fit-recovery-evidence-r1/) preserves a trained model
when finishing color fitting fails, while device loss, training failure, and export failure remain
fatal. The reproduced failure and eight passing controlled browser cases are retained.
[The original-spec byte audit](evidence/original-spec-byte-audit-r2/receipt.json) confirms 285
original specs were untouched by this task; four differences came only from normally merged main.
This is a byte audit, not a passing-suite claim.

[The latest full CI](evidence/ci-d2a90/full-suite-summary.json) tested GitHub merge `acdc31904`: 332
spec files, 2,834 passes, 13 failures, and one existing skip. All sixteen original shard logs remain
intact; alone rechecks never waive a failure. The
[broader local run](evidence/ca841-regressions-r1/) had 281 passes, two calibration decode-deadline
failures, and one existing skip. The
[separate calibration run](evidence/r11-calibration-isolated-r1/) had seven passes, four failures,
and the same existing skip under overlapping workload. These failures remain open; no assertion or
deadline was weakened.

The [decoder research archive](evidence/decoder-research-r1/) preserves the rejected direct and
bridge decoding paths. Later [strict playback](evidence/html-playback-extraction-research-r2/)
verified four supported cases and retained thirteen timestamp misses. The
[playback/seek hybrid](evidence/html-playback-extraction-research-r3/) verified sixteen cases and
255 selected JPEGs, but retained four nonresults, including matching JPEGs without matching
independent presentation time. The entire hybrid remains rejected. The production extractor keeps
its seek and presentation checks.

## Revision 10 capture

The [static interactive review](evidence/review-dashboard-public-r1/snapshot-0001/index.html) keeps
all 40 declared cases visible. It includes 26 captured main outcomes, ten strict revision-9 rows,
five strict revision-10 rows, and 27 original raw attempts listed separately. Missing outcomes and
failures cannot establish acceptance. Its links resolve to the immutable publication copies beside
it. The four-core SwiftShader and overlapping-load limitations remain visible in the page.

[Revision-10 samples](samples/candidate-r10-r1/samples.json) preserve all 74 held-out views across
six samples and both profiles on frozen source `1cbccf108294437a2b6ae8b07dead9c56d3f3609`. This
checks existing bakes and viewer behavior; it does not retrain the samples.

The native plant phone bake reached SSIM 0.688856 versus main's 0.668773 and 4.971 times main's
sharpness. Its bake was shorter, but its first 3D view was slower. The completed Dianthus shard also
has a quality gain and slower first view; its learned environment failed internal validation and was
correctly rejected. No partial subset establishes the corpus or phone timing goals.

[All 16 full-suite logs](evidence/ci-d12824/full-suite-summary.json) on `d1282403` record 327 spec
files and 2,812 tests: 2,799 passed, 12 failed, and one existing test was skipped. Rechecks do not
waive failures. This precedes the learned-environment commits.

[R10 launch and sample receipts](evidence/r10-launch-and-sample-receipts-r1/) bind the source,
protocol, handoff, and successful sample recheck.
[R9 final reconciliation](evidence/r9-final-reconciliation-r1/) retains ten paired and five unpaired
outcomes, including its two harness errors. The raw rows and artifacts keep their original bytes and
source licenses. The added reconciliation script is an MIT reproduction aid outside the original raw
control inventory.

## Reuse and attribution

Each source clip, derived model, screenshot, and comparison retains the corresponding source license
below. Trims have their audio removed, are scaled to 480 pixels high, and use 24 fps H.264; no
stabilization, artificial camera movement, lighting change, or sharpening was added. Source spans
and both source/output checksums are in `corpus-manifest.json`. The manifest's original bytes and
all named receipts are retained.

[Corpus coverage and limitations](CORPUS-NOTES.md) · [Verification](corpus-verification.json) ·
[Overview](corpus-overview.jpg)

| Clip                                              | Author                              | License                                                         | Source                                                                                                                                              |
| ------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| [cat-track](corpus/cat-track.mp4)                 | Clément Bucco-Lechat                | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0)  | [Source page](https://commons.wikimedia.org/wiki/File:Cat_playing_with_a_round_track_toy.webm)                                                      |
| [cat-plays](corpus/cat-plays.mp4)                 | Riverarvi                           | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0)  | [Source page](https://commons.wikimedia.org/wiki/File:Cat_Plays.webm)                                                                               |
| [buddha](corpus/buddha.mp4)                       | https://www.youtube.com/user/Editor | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0)        | [Source page](https://commons.wikimedia.org/wiki/File:Statue_of_Buddha.webm)                                                                        |
| [chameleon-flowers](corpus/chameleon-flowers.mp4) | Ventrovert                          | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0)        | [Source page](https://commons.wikimedia.org/wiki/File:Chameleon_on_ixora_flowers.webm)                                                              |
| [dianthus](corpus/dianthus.mp4)                   | Tanvir Rahat                        | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0)  | [Source page](https://commons.wikimedia.org/wiki/File:Dianthus_plants_and_flowers_,_Rajshahi_,_Bangladesh.webm)                                     |
| [pisac](corpus/pisac.mp4)                         | MorePix                             | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | [Source page](https://commons.wikimedia.org/wiki/File:Panorama_of_P%C3%ADsac_Ruins,_Peru_2024.webm)                                                 |
| [sleeping-dog](corpus/sleeping-dog.mp4)           | Amada44                             | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0)  | [Source page](https://commons.wikimedia.org/wiki/File:REM_-_Rapid_eye_movement_sleep_of_a_dog.webm)                                                 |
| [palace-statue](corpus/palace-statue.mp4)         | Sayvhior                            | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0)  | [Source page](https://commons.wikimedia.org/wiki/File:A_moulded_statue_at_the_entrance_to_the_palace_of_the_Obi_of_Issele_Uku.webm)                 |
| [oa-street](corpus/oa-street.mp4)                 | Sillerkiil                          | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | [Source page](https://commons.wikimedia.org/wiki/File:Aerial_view_of_Oa_street_in_Supilinn,_Tartu,_Estonia._July_2021.webm)                         |
| [ullard](corpus/ullard.mp4)                       | A.-K. D.                            | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0)  | [Source page](https://commons.wikimedia.org/wiki/File:Ullard_handball_alley.webm)                                                                   |
| [snaefell](corpus/snaefell.mp4)                   | Tiny Toast                          | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0)        | [Source page](https://commons.wikimedia.org/wiki/File:Panorama_on_Snaefell.webm)                                                                    |
| [fremantle-orbit](corpus/fremantle-orbit.mp4)     | JamesBromberger                     | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | [Source page](https://commons.wikimedia.org/wiki/File:Orbit_around_Fremantle_South_Mole_Lighthouse_at_sunset.webm)                                  |
| [ihasalu-orbit](corpus/ihasalu-orbit.mp4)         | Sillerkiil                          | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0)  | [Source page](<https://commons.wikimedia.org/wiki/File:Drone_video_of_abandoned_Ihasalu_lighthouse_near_Neeme_village_in_Estonia_(July_2022).webm>) |
| [fresnel-lens](corpus/fresnel-lens.mp4)           | Myotus                              | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0)  | [Source page](https://commons.wikimedia.org/wiki/File:Fresnel_lenses_rotating_at_Split_Rock_Lighthouse.webm)                                        |
| [saint-denis](corpus/saint-denis.mp4)             | Quahadi                             | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0)  | [Source page](https://commons.wikimedia.org/wiki/File:Interior_of_Basilique_Saint-Denis_134306.webm)                                                |
| [horse-statue](corpus/horse-statue.mp4)           | Angelarene88                        | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0)  | [Source page](https://commons.wikimedia.org/wiki/File:Traveler_horse_statue.webm)                                                                   |
| [royal-sovereign](corpus/royal-sovereign.mp4)     | Alexis Markwick                     | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | [Source page](https://commons.wikimedia.org/wiki/File:Royal_Sovereign_Lighthouse_drone_visit.webm)                                                  |
| [viljandi-ruins](corpus/viljandi-ruins.mp4)       | Sillerkiil                          | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | [Source page](https://commons.wikimedia.org/wiki/File:Viljandi_ordulinnus_2021,_droonivideo.webm)                                                   |
| [kakerdi-bog](corpus/kakerdi-bog.mp4)             | Sillerkiil                          | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | [Source page](https://commons.wikimedia.org/wiki/File:Drone_video_of_Kakerdi_lake_and_Kakerdaja_bog_in_Estonia,_september_2021.webm)                |
| [fjoloy](corpus/fjoloy.mp4)                       | Rik Knops                           | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0)        | [Source page](https://commons.wikimedia.org/wiki/File:Aerial_views_of_Fj%C3%B8l%C3%B8y_Lighthouse,_Rennes%C3%B8y,_Rogaland_county,_Norway.webm)     |

## Measurements and review clips

Fresh outputs retain source/tool/browser fingerprints, exact held-out frame evidence, all outcomes,
models, PNGs, and per-row reference bindings. Earlier exploratory outputs are labeled diagnostics. A
timeout or missing paired model cannot count as a goal pass. Review replay must reproduce its saved
held-out renders before a comparison is accepted. The camera path uses synchronized original video
times in each reconstruction’s own coordinate frame. This workspace has software graphics; its phone
profile is emulation, not a physical-phone test.

### Preserved negative results

[Main snapshot](measurements/main-snapshot-0007/run.json) contains seven of 40 declared outcomes,
including one desktop watchdog timeout. [Candidate r3](measurements/candidate-r3/run.json) missed
both cat quality thresholds. [Candidate r4](measurements/candidate-r4/run.json) improved cat
sharpness to 3.346 times main's but increased SSIM only 0.00442 and delayed its first preview. These
partial results do not establish any corpus acceptance goal.

[Verified r3 comparison](reviews/candidate-r3-cat-diagnostic/index.html) shows the same five source
seconds at 1× motion, using 11 actual captures at 2 fps, plus a half-second final hold. Both models
remain visibly blurred. Its eight saved held-out PNGs reproduced exactly before capture; the movie
is an unranked diagnostic, not one of ten completed best/worst comparisons.

[CPU geometry diagnostic](evidence/seed-geometry-r1/seed-geometry-diagnostic-r1.md) supports
correcting foreshortened Gaussian footprints. It does not support adding a local depth sweep. The
compressed training cache decompresses to the original hash-bound bytes. No held-out image was used
for this diagnostic, and covariance correctness does not establish rendered quality.

### Later results and preserved samples

[Revision 5](measurements/candidate-r5-snapshot-0004/run.json), its
[unpaired desktop attempts](measurements/candidate-r5-desktop-unpaired-snapshot-0002/run.json), and
[revision 6](measurements/candidate-r6-snapshot-0002/run.json) retain all recorded outcomes. The
revision-6 footprint correction regressed the cat and plant quality scores and is excluded from the
product default. One revision-5 Buddha attempt was interrupted when retiring its scheduler; its
retained harness error is not a native product conclusion.

[Revision 7 phone snapshot](measurements/candidate-r7-phone-snapshot-0003/run.json) still misses the
cat SSIM target and delays the first preview. Missing cases stay pending. Exact experimental source
overlays and served-byte receipts are [retained here](evidence/runtime-overlays/README.md).

[Main samples](samples/samples-main-r1/samples.json) and
[candidate samples](samples/samples-candidate-r5/samples.json) include all 74 held-out PNGs across
six samples and both profiles. Every candidate view preserved exact pixels, without browser errors.
This checks existing bakes and the production viewer; it does not retrain the samples.

[Supplemental Pisac evaluation](evidence/supplement-main-r1-pisac-phone-r1/derived/report.json)
reproduced all training/source JPEG receipts and scored the saved timeout model. Its original
harness error and censored timing remain unchanged; these diagnostic scores are excluded from strict
acceptance.

[Depth-prior probe](evidence/depth-prior-probe-r1/assessment.md) stopped all four anchors at its
fixed minimum-depth-spread gate and proposed no points.
[Gradient-path probe](evidence/tilegrad-probe-r1/receipt.json) found exact math parity but no useful
speed difference. [Serial-sort prototype](evidence/serial-sort-prototype/) verified exact entry,
gradient, pixel, and loss parity on fixed small inputs, including a large padded tile. Its sort
timing is a narrow software-GPU diagnostic, not an end-to-end or physical-phone speed claim. Each
diagnostic retains its original byte-bound reports, scripts, and raw outputs.

### Revision 8 and the background diagnosis

The [later main snapshot](measurements/main-master-r1-snapshot-0017/run.json) preserves 17 recorded
outcomes. [Revision 8 phone](measurements/candidate-r8-phone-snapshot-0008/run.json),
[paired desktop](measurements/candidate-r8-desktop-snapshot-0001/run.json), and
[unpaired desktop](measurements/candidate-r8-desktop-unpaired-snapshot-0003/run.json) preserve all
listed successes and failures. These are partial collections, not acceptance results. The phone cat
reached 1.524 times main's sharpness but lost 0.00134 SSIM and showed its first view later. The
plant and Dianthus also missed quality thresholds.

[Background diagnosis](evidence/background-probe-r1/receipt.json) reproduced every original white
Dianthus held-out PNG before changing only the clear color to training's black. Mean SSIM rose from
0.112766 to 0.472900; sharpness became 4.3756 times main's on this clip. The
[production metadata check](evidence/background-product-probe-r1/receipt.json) reproduced all four
black controls byte for byte and restored white when leaving the toy. These saved-model diagnostics
do not replace native rows. [Color-path review](evidence/color-conventions-review-r1/README.md)
found no substantial double-gamma defect.

[Robust seed-bound analysis](evidence/plane-seed-diagnostic-r1/) retains the distant-point
diagnosis, legacy-byte checks, and rejected plane proposal.
[Structural-loss probe](evidence/ssim-loss-probe-r2/receipt.json) completed without GPU errors and
improved a cached input's two-view mean SSIM by 0.00730, while batch time increased about 40%. It
remains off by default. The [earlier invalid probe](evidence/ssim-loss-probe-r1/assessment.json) is
retained, including its GPU validation failures. Exact full-parameter gradient probes in
[one order](evidence/profile-native-seed-r3/receipt.json) and
[reverse order](evidence/profile-native-seed-r4/receipt.json) support the software direct-gradient
path; neither establishes native bake or physical-phone speed.

[Earlier full CI](evidence/ci-c0c924-summary/summary.md) recorded 2,525 passes, 12 failures, and one
existing skip. Failures that passed alone still count. The
[revision-9 freeze and controller handoff](evidence/r9-freeze-and-handoff/) records the complete
product source fingerprint and unchanged five-file benchmark protocol. Current native bakes were
allowed to finish when scheduling moved to revision 9. Its fresh native results are still pending.

### Revision 9 measurements and preserved failures

The [new main snapshot](measurements/main-master-r1-snapshot-0021/run.json) contains 21 outcomes.
The [revision-8 phone update](measurements/candidate-r8-phone-snapshot-0009/run.json) retains its
ninth case. The
[revision-9 strict snapshot](measurements/candidate-r9-paired-master-v1-snapshot-0005/run.json) and
[individual completed shards](measurements/candidate-r9-v1-shards/) preserve every captured success,
explanation, and harness failure. These are incomplete cohorts.

The native Dianthus phone bake raised SSIM from main's 0.270086 to 0.472708, while the plant bake
fell from 0.668773 to 0.504333 despite a large sharpness increase. The plant's first view was also
slower. The [saved-model clear-color diagnostic](evidence/r9-plant-clear-probe-r1/receipt.json)
reproduced the original renders exactly before testing white and a training-cache-derived brown.
This isolates uncovered regions; the brown estimate remains rejected by its unchanged confidence
rule, as documented in the
[training-only prior report](evidence/training-background-prior-r1/README.md). No diagnostic
replaces a native measurement.

The [complete revision-9 sample check](samples/candidate-r9-r1/samples.json) preserves all 74 views
across all six samples and both profiles. This checks existing bakes and their viewer behavior. The
[full CI summary](evidence/ci-b7099b/summary/summary.md) records 2,781 passes, seven failures, and
one existing skip across 2,789 tests. Every failure still counts.

[Matcher cancellation and parity evidence](evidence/matcher-lifecycle-evidence-r1/) includes eight
CPU checks and a real-GPU raw-distance and match comparison. The
[decoder race investigation](evidence/ci-b709-bench-review-r1/) retains the original CI artifact,
failed CPU reproduction, repaired ordering controls, and real independently matched JPEGs. The
unchanged quick suitability assertion still failed in that targeted run. The
[cat solve diagnostic](evidence/sfm-cat-diagnostic-r1/) does not establish the native failure's
cause.

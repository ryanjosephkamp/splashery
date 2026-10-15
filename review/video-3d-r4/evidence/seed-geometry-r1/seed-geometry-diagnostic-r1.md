# Bounded cached-seed diagnostic (CPU only)

The evidence favors correcting the projected footprint before adding a depth-search runtime. It does not establish a rendered quality improvement or prove that all cached triangle normals are correct. No benchmark-held-out image was read; no runtime file was edited by this diagnostic.

Inputs: `/workspace/v3d-r4-media/seed-probe.json` (SHA-256 `a58563911299803f7b9203214ac7a67a19817d6709dc4d1797d30bfa562d910f`), 614 sparse points, 16 calibrated training cameras, 2,636 cached supported surface seeds. Exactly 256 evenly spaced cached seeds were selected before inspecting agreement results. RGB frames are already undistorted at 320×180. Intrinsics were scaled from reconstruction dimensions by `tw/fw`; poses are row-major world-to-camera `R,t`, and cached quaternions are `w,x,y,z`.

## Foreshortening and the analytic footprint

The cached initializer has equal world tangent sigmas and normal thickness 0.15× the tangent sigma. Raw projected covariance excludes the rasterizer's filtering/minimum-footprint inflation. In the seed's original source camera:

| Measurement | Cached triangle normals | Camera-facing normals at same points/scales |
| --- | ---: | ---: |
| Median projected major/minor ratio | 3.513 | 1.004 |
| 90th-percentile ratio | 6.420 | 1.013 |
| Ratio above 3 | 144/256 | 0/256 |
| Median major sigma | 2.804 px | 2.812 px |
| Median minor sigma | 0.798 px | 2.800 px |

92/256 normals have absolute normal/view-ray cosine below 0.15; 128/256 are below 0.25, and 181/256 below 0.5. With cached step=4 and footprint coefficient=0.7, the projected minor sigma/step has 10th percentile 0.109, median 0.199, and 90th percentile 0.518; 128/256 are below 0.2. At the R4 coefficient 0.35, those normalized values halve for these same normals; R4's actual admitted sample is different, so this is a footprint counterfactual, not an R4 model measurement.

Your exported `surfaceFootprint` was tested at sigma=1.05 source pixels on the same 256 points. Helper source SHA-256: `2c649c225af246edb7f4d4248143b5d1ff228530da1c45600f8f068d69ba9054`. The plane-intersection Jacobian's world tangent inflation relative to `depth/f * sigmaPixels` is median 4.09×, p90 24.30×, maximum 107.04×. Rejecting stretch above 8× retains 179/256 (69.9%), including all 164 with absolute normal/view-ray cosine at least 0.15. Among accepted points, inflation is median 2.42×, p90 6.36×, maximum 7.88×.

Projecting the helper's tangent covariance back into the source image gives `sigmaPixels² * I`, with maximum matrix-entry error 1.78e−14 across accepted points. With its actual normal thickness, projected minor sigma stays 1.05 px and major sigma spans 1.0503–1.0619 px. This verifies coordinate/quaternion/covariance consistency independently of image quality. An 8× ceiling is a defensible geometric guard here: it rejects extreme grazing support without discarding most supported points. It is not a tuned quality optimum, and support in other cameras remains a separate visibility/occlusion concern.

## Local inverse-depth sweep and an independent training camera

The preregistered bounded sweep keeps each cached normal fixed, tests 14 depth ratios (baseline plus 13 inverse-depth samples spanning 0.85–1.15× baseline depth), and compares raw RGB 3×3 plane-intersection patches in two nearby training cameras. Camera selection uses geometry only, 0.15–12° parallax and sparse foreground guards. A third nearby training camera is withheld from depth selection and confidence. Its image is sampled only after both decisions are fixed.

38 points were rejected for low source texture, 92 for grazing normals, 4 for insufficient geometric neighbors, 1 for baseline fit visibility, and 1 for invalid patch sampling. This leaves 120 fitted points; 115 have both baseline and chosen-depth third-camera measurements. Confidence uses only the two fit images: selected fit RMSE≤0.08, gain≥0.003 and 10%, a separated-hypothesis margin≥0.002, and no endpoint winner. It accepts 37 points, of which 36 are independently visible.

| Cohort | Median fit RMSE before→after | Median third-camera RMSE before→after | Paired third-camera improvement median | Improved / worsened |
| --- | ---: | ---: | ---: | ---: |
| All 120 (115 validated) | .02259→.01959 | .02515→.02582 | 0 | 49 / 43 |
| Confident 37 (36 validated) | .03240→.02013 | .03228→.02830 | +.000879 | 20 / 16 |

The confident paired gain is below one 8-bit level. A descriptive fixed-point bootstrap interval for its median is −.00762 to +.00827; spatial correlation means this is not a capture-level confidence interval. Per-source-camera paired medians are zero or negative. Replacing the normal with a camera-facing normal at unchanged center depth has a near-zero independent paired median gain (+.0000108; 61 improved/55 worsened). That ablation tests planar patch agreement, not a Gaussian rendering, so it does not establish a useful replacement normal.

The selected fit cost improves by construction; the independent evidence is too weak and heterogeneous to justify integrating a local depth-sweep runtime. This does not rule out depth errors, motion, calibration errors, visibility errors, or wrong normals. The third training image is independent of this new sweep, but the original initializer had already used training views for admission of the cached seed, so it is not independent of original admission.

## Cost and evidence paths

One Node/V8 run spent 188 ms testing the selected 256 points (120 reached the sweep), with 51,556 bilinear RGB samples and 32,849 projected patch points. Loading the 52 MB JSON cost 379 ms, and geometric preparation cost 8 ms. Straight-line arithmetic extrapolation is 1.94 s for 2,636 points or 7.35 s for 10,000 points, assuming the same rejection ratio. These are host-CPU observations during concurrent software rendering, not physical-phone timings; no phone budget or actual render improvement is inferred. The analytic helper check took 72 ms for 256 points including unbounded and bounded calls plus covariance reconstruction.

Full unchanged measurements and scripts:

- `/workspace/v3d-r4-media/seed-depth-probe.mjs`
- `/workspace/v3d-r4-media/seed-depth-probe-r1.json`
- `/workspace/v3d-r4-media/seed-depth-probe-r1.log`
- `/workspace/v3d-r4-media/seed-footprint-probe.mjs`
- `/workspace/v3d-r4-media/seed-footprint-probe-r1.json`
- `/workspace/v3d-r4-media/seed-footprint-probe-r1.log`

No retraining, rendering comparison, new camera fit, source-specific threshold adjustment, or benchmark-held-out validation was performed by this diagnostic.

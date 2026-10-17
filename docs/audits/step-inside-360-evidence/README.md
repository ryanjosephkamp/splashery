# Step inside a 360° photo: evidence

Made by Ryan with Codex (GPT-6), October 17, 2026.
[Draft PR #700](https://github.com/ryanjosephkamp/splashery/pull/700).

**Never merge this branch. The depth improvement gate fails.** This is evidence for a labs
prototype, not release qualification.

## Gates

| Gate                                  | Outcome                                                                                                                                                                                                                    |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Median seam jump below 2%             | All six valid-pixel medians pass numerically; see the complete recordings for visual judgment. Raw overlap disagreement remains larger.                                                                                    |
| AbsRel at least 20% better than naive | **Fails on all six scenes.** Mean 0.2120 versus 0.1207 naive.                                                                                                                                                              |
| First look within 25 s                | 2.066–3.690 s in desktop phone emulation, including the interactive radius preview.                                                                                                                                        |
| Phone memory                          | Maximum sampled PSS about 905 MiB. Three cold Classic runs on the shipped room image peak at 897–991 MiB. Limited desktop comparison; no physical-phone qualification.                                                     |
| Eight clips                           | All eight complete recordings below; every run reports the warning, no page errors, a 585×700 drawing buffer, and completed lean and step.                                                                                 |
| Classic and regression checks         | Classic golden 77/77 and panorama tests 12/12 passed. Post-merge preflight passed 271/271 and every check. The full 397-file suite is running locally and requested in CI; its actual outcome is recorded in verification. |

## Eight complete recordings

These are 390×844 Chromium recordings, device scale factor 3, low profile, normal phone pixel cap,
and Mesa llvmpipe. They preserve the full native recording, including startup, a full turn, ceiling,
floor, lean, 0.8 m step, warning, and return. The recorder waits for each posed camera view to draw.
Distances use the tool’s estimated scale. This does not validate physical-phone GPU, RAM, tilt
sensors, or network speed. Concurrent local checks were running.

| Input / full video                        | First look, s | Depth ready, s | Peak PSS, MiB |
| ----------------------------------------- | ------------: | -------------: | ------------: |
| [room](clips/room.webm)                   |         2.066 |          2.274 |         699.4 |
| [room2](clips/room2.webm)                 |         2.655 |          2.683 |         706.5 |
| [truth-room](clips/truth-room.webm)       |         2.764 |         10.698 |         905.1 |
| [truth-desk](clips/truth-desk.webm)       |         2.887 |         10.848 |         901.9 |
| [truth-stairs](clips/truth-stairs.webm)   |         2.830 |         13.155 |         876.7 |
| [truth-arches](clips/truth-arches.webm)   |         2.768 |         13.257 |         891.5 |
| [truth-steps](clips/truth-steps.webm)     |         3.330 |         16.723 |         841.9 |
| [truth-lattice](clips/truth-lattice.webm) |         3.690 |         13.285 |         889.1 |

[Step contact sheet](clips/step-contact-sheet.jpg) ·
[Look-around filmstrips](clips/look-contact-sheet.jpg) ·
[Raw phone measurements and source hashes](measurements/phone-profile.json)

The filmstrip samples every three seconds. Black cells after a short recording ends are empty
contact-sheet cells, not black frames in the tool. Earlier mixed-revision, native-DPR,
last-ten-second captures are rejected; only their profile and explanation remain in rejected/.

## Depth and seam yardstick

Six original CC0 scenes rendered in Blender 4.3.2 through the existing
tools/studio-truth-generate.py builder; task 105 had not landed at task start. Each prediction is
calibrated by one median scale across all unambiguous opaque sphere pixels. AbsRel and delta1 are
spherical-area weighted. Seam jumps use adjacent valid pixels at dominant-face boundaries and
longitude wrap; they are not raw per-tile calibration residuals.

| Scene   | Spherical AbsRel | Naive AbsRel | Spherical delta1 | Naive delta1 | Seam median | Raw overlap disagreement |
| ------- | ---------------: | -----------: | ---------------: | -----------: | ----------: | -----------------------: |
| room    |           0.3655 |       0.1370 |           0.6571 |       0.7536 |      0.845% |                    9.64% |
| desk    |           0.1817 |       0.1355 |           0.7659 |       0.8461 |      0.839% |                   14.45% |
| stairs  |           0.1475 |       0.1316 |           0.8538 |       0.7587 |      0.914% |                    5.26% |
| arches  |           0.2167 |       0.0954 |           0.7102 |       0.9327 |      1.222% |                    7.46% |
| steps   |           0.1979 |       0.1021 |           0.6783 |       0.8403 |      1.103% |                    6.33% |
| lattice |           0.1629 |       0.1225 |           0.7512 |       0.7958 |      0.921% |                    7.70% |

[Exact scores](measurements/scores.json). The model is the existing quantized Depth Anything V2
Small, WASM, one thread, 294-pixel side for both perspectives and the naive equirectangular input.
Six-view compute exceeds the naive run; this is not a matched-compute comparison. Feathering a depth
field can pass a seam metric while geometry is wrong.

## Actual product held-out views

Masked local luminance SSIM uses 8×8 windows, stride 4, and at least 48 fixed valid pixels per
window. The mask is determined from true source visibility, shared by all methods, and retains
missing predicted pixels. The actual Kit/WebGL2 stage uses low-profile splats, an exact 256×256
export buffer, 72-degree FOV, and lateral camera displacement of 0.3 m or 0.8 m. Scale is the same
whole-sphere calibration used above. All methods clip radial distance to 200 m before the shared
16-bit sample cache encoding, avoiding huge inverse sky values destroying precision.

| Scene   | 0.3 m spherical / naive / true-depth control | 0.8 m spherical / naive / true-depth control |
| ------- | -------------------------------------------: | -------------------------------------------: |
| room    |                     0.4156 / 0.4331 / 0.4549 |                     0.3776 / 0.3982 / 0.4482 |
| desk    |                     0.6368 / 0.6233 / 0.6702 |                     0.5839 / 0.5783 / 0.6663 |
| stairs  |                     0.5340 / 0.5359 / 0.5460 |                     0.4751 / 0.4930 / 0.5090 |
| arches  |                     0.3761 / 0.3747 / 0.4410 |                     0.3213 / 0.3018 / 0.4270 |
| steps   |                     0.6700 / 0.7128 / 0.7197 |                     0.6055 / 0.6389 / 0.7025 |
| lattice |                     0.4212 / 0.4239 / 0.4136 |                     0.3812 / 0.3929 / 0.4007 |

[GPU scores and source hashes](measurements/gpu-scores.json). Reference views, fixed masks, GPU
images, and software diagnostic images are under views/ and truth/. The software point-splat SSIM
remains in scores.json and is explicitly labeled separately. A true-depth control is a diagnostic,
not a mathematical SSIM upper bound: blur and noisy references affect ranking.

Initial GPU scores used an easing camera distance and are **rejected** in
measurements/rejected-gpu-scores-unsnapped-camera.json. Independent review measured FOV drift and
verified snapped-camera offsets, units, orientation, and identical consecutive frames. See
[the review finding](gpu-frame-review-findings.md) and review-evidence.tar.gz.

## Sources, experiments, and reproduction

The exact shipped CC0 panorama inputs are sources/room.jpg and sources/room2.jpg. Live
[room 1](https://polyhaven.com/a/small_empty_room_1),
[room 2](https://polyhaven.com/a/small_empty_room_2), and [license](https://polyhaven.com/license)
pages were checked on October 17, 2026; compressed page snapshots are included. Author: Sergej
Majboroda. tools/assets.json on the code branch records source download URLs and original hashes,
the 8192×4096 to 2048×1024 reduction, shipped hashes, and baked depth hashes. Original large
downloads are not duplicated here. Synthetic fixtures are original CC0 assets.

[Calibration experiments](calibration-research-findings.md) preserve relative residuals, anchors,
priors, upright-floor heuristics, and solver-duration comparisons. Truth-assisted affine fits are
**oracle diagnostics**, never production measurements. The archive contains frozen math, scripts,
hashes, results, and browser lifecycle/orientation checks.

The 518-pixel shipped-model study is research/resolution518-scores.json; it also fails the depth
gate. Its reproducible script is research/resolution518-study.mjs and stays offline. The separate 95
MiB indoor metric-model pilot failed its first room comparison. Its sources, license references, and
results are preserved; no alternative weights are included or shipped.

Use a checkout of the code PR, with the repository’s existing dependencies, Chromium, Blender,
Pillow, and ffmpeg. Set SPLASHERY_CHROMIUM to the browser path. Copy this evidence folder outside
that checkout, then restore the cached inputs:

```sh
mkdir -p .cache/pano3d/evidence
cp -R /path/to/step-inside-360-evidence/truth .cache/pano3d/
cp /path/to/step-inside-360-evidence/measurements/scores.json .cache/pano3d/evidence/
for f in /path/to/step-inside-360-evidence/measurements/*-inference.json.gz; do
  gzip -dc "$f" > ".cache/pano3d/evidence/$(basename "$f" .gz)"
done
tar -xzf /path/to/step-inside-360-evidence/review-evidence.tar.gz -C .cache/pano3d/
node tools/pano-evaluate.mjs
node tools/pano-gpu-views.mjs
node tools/pano-clips.mjs
```

To render fresh truth, run node tools/pano-truth.mjs first. GPU clips use SPLASHERY_GL=llvmpipe and
DISPLAY when available; otherwise the tool uses SwiftShader. Re-running changes timings with
hardware, load, cold caches, and graphics driver. PSS sampling is every 100 ms and may miss short
peaks; summed RSS double-counts shared pages. Classic baseline uses the existing
tools/cdx-p3d4-memory.mjs with three cold runs and the shipped room input.

The source-identity.json and measurements identify the runtime bytes;
verification/classic-and-engine-blob-identities.txt and the golden run cover frozen Classic. The PR
remains a draft and this branch remains unmerged. No rule exceptions were used.

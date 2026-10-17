# Blender picture builds: public evidence

Made by Ryan with Codex (GPT-6), October 17, 2026. Generated reconstruction geometry and splats are CC0. Tools and the measured audit live on `codex/build-from-pictures-blender`, in [draft PR #725](https://github.com/ryanjosephkamp/splashery/pull/725). This branch holds public assets outside that PR.

The three blind packs are lantern, alarm-clock, and rubber-duck-real. Their good median is 90.46% silhouette IoU and 77.76% volume IoU. The lantern individually misses both targets. Chess-set is auxiliary: setup exposed source dimensions before modeling. Modeling-kit-showcase is an original cabinet and chair, with references from the same script, and is not a reconstruction benchmark.

The reconstructions remain coarse in some details: the clock omits dial hands and numerals, and chess knights use generic turned profiles. Silhouette and volume scores do not validate those details. The focused suite passed 15 tests with Blender, and 11 tests with four Blender-only skips without it. Quick preflight and the full 271-test preflight passed; the code PR's audit records the commands and earlier resolved failures.

- `packs/`: public CC0 reference pictures, masks, known cameras, and motion requests. Only these inputs go to the builder.
- `truth/`: separate scorer-only truth GLBs and source credit. Do not expose these to an agent doing a blind build.
- `results/<id>/{draft,good,best}/`: model snapshots, 256-pixel renders, silhouette reports, voxel volume scores, camera timings, and manifests. Every good folder includes the complete GLB and phone/desktop PLY artifacts. Other budgets are measurement snapshots; their PLYs and native `.blend` files remain outside git.
- `results/modeling-kit-showcase/good/`: the complete original demonstration with a sliding drawer, hinged door, and spinning cushioned chair seat/back.
- `repeat/`: second good runs' scores, timings, scripts, and manifests. `summary.json` records per-view differences and emitted counts.
- `clips/`: actual PlayCanvas splat toys, 1080 × 1080, 30 fps, 60 frames. Each adjacent JSON records browser errors, provenance, and rigid internal-distance checks.
- `screenshots/`: actual 390 × 844 and 1440 × 900 browser views, plus tap frames and resize/tap proofs.
- `atlas-geometry-proof.json`: exact oriented-triangle hashes and unchanged silhouette scores after correcting overlapping primitive UVs. Volume measurements were retained only after this geometric equality check.

From a full checkout of the code branch, copy or download a good result folder outside the repository, then run:

```sh
node tools/refblend/preview.mjs /absolute/path/to/results/rubber-duck-real/good
```

Open the printed local URL. Drag to orbit, scroll to zoom, and tap the toy or button to move each part as a solid piece. For task 113 integration, load only the selected tier's static and part PLYs, apply pivots/motions from `result.json` in normalized Y-up coordinates, and preserve the credit. The assembled PLY is an alternative static view, not an additional layer.

Volume scores are independent 128-cell voxel estimates, with object unions and three oriented ray-winding tests. There is no alignment fitting. The silhouette score uses explicit masks and known cameras; full task 113 color/boundary/edge/Chamfer metrics and unknown-camera fitting are not demonstrated. The existing splat converter preserves baked base color and adds soft lighting; it cannot represent glass transmission, specular reflections, or fabric bump/sheens.

Source models are the existing CC0 entries in `tools/models.json`: [lantern](https://polyhaven.com/a/Lantern_01), Rajil Jose Macatangay; [alarm clock](https://polyhaven.com/a/alarm_clock_01), Yann Kervran and James Ray Cock; [rubber duck](https://polyhaven.com/a/rubber_duck_toy), Plat251; [chess set](https://polyhaven.com/a/chess_set), Riley Queen. The pages and [CC0 license](https://polyhaven.com/license) were opened on October 17, 2026. `source-lock.json` preserves authors, source links, changes, and original file hashes. Truth meshes were normalized to a one-meter largest dimension and rendered as product-photo views. The reconstructions are newly scripted geometry; no store pictures or brand marks were used.

Rule check: none.

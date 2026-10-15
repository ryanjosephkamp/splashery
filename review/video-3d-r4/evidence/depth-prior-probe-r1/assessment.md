# Bounded optional-depth-prior diagnostic: no admitted points

October 15, 2026. The four actual local WASM inferences completed, but every anchor failed the
fixed minimum SfM inverse-depth spread check. The diagnostic stopped before robust fitting,
new-point construction, photometric admission, or third-training-camera validation. Therefore no
independent quality gain was measured, and no runtime integration is recommended.

The configuration and both collector/evaluator code hashes were saved before inference. They were
not changed after the outputs were read. This is one cached chameleon capture, not a corpus result.
No benchmark-held-out image was read, no camera was solved/refit, and no bake was run. The original
20-clip inventory remains unchanged.

## Actual API and request timing

The existing `createDepthClient()` from the original server at127.0.0.1:4173 ran in an empty fixture
page, with a dedicated worker, `provider=wasm`, one thread, and the already approved int8 Depth
Anything V2 Small model. Chromium151.0.7922.173 launched with `--disable-gpu`. Each of the four
cached undistorted320×180 TRAINING RGB images was copied to byte RGBA and requested once with
`side=294`. Raw relative inverse-depth arrays are294×168 Float32; larger values mean nearer.
They were not normalized, converted to relief, backed with a plane, or used as a photo card.

| Request | Wall time | `s.run()` time |
| --- | ---: | ---: |
| Cold worker/model initialization | 5,782ms | not separately reported |
| Anchor0, first photo/shape | 3,852ms | 3,750ms |
| Anchor5, warmed session | 2,779ms | 2,717ms |
| Anchor10, warmed session | 1,362ms | 1,235ms |
| Anchor15, warmed session | 1,871ms | 1,814ms |

Cold initialization plus the first photo was9,634ms; the four requests plus initialization totaled
15,647ms. These are client-request wall times, excluding browser launch, the fixture navigation,
client module import, preflight hashes, and later CPU evaluation. Model/runtime bytes were served
locally; the server's files had also been read for preflight hashes. These are observations on the
contended task-88 host, not physical-phone timing or an Internet cold-download measurement. CPU
geometry/calibration checking then took177ms, with no point generation after the gate failures.

The model, WASM, both runtime JS files, and the transitive application JS imports were hashed from
actual served bytes before and after inference and matched local bytes exactly. Browser executable,
input-cache, RGBA-input, validity-mask, raw-output, configuration, and code hashes are recorded.

## Fixed calibration gate

For each anchor, two fit cameras and one separate validation TRAINING camera were chosen by camera
center distance, median-scene parallax, and image bounds before reading their RGB. Cached SfM
points have no accepted-observation membership. The attempted support set consequently used
projected RGB consistency in the two fit cameras and sparse foreground guards. This visibility is
explicitly **uncertified**, and could not establish a runtime-quality recommendation even if later
patch scores had improved. No new SfM solve was performed to recover observations.

| Anchor | Fit cameras | Unused third camera | Color-consistent projected points | SfM inverse-depth IQR/median | Model raw IQR/median |
| --- | --- | ---: | ---: | ---: | ---: |
| 0 | 1,2 | 3 | 545 | 1.64% | 27.39% |
| 5 | 4,6 | 7 | 463 | 2.40% | 21.45% |
| 10 | 14,9 | 11 | 242 | 3.32% | 31.41% |
| 15 | 8,7 | 9 | 298 | 3.03% | 26.57% |

The preregistered minimum SfM inverse-depth IQR/median was8%. These sets had adequate count and
spatial tile coverage, but failed that spread gate. This is a conservative diagnostic requirement,
not proof that fitting any affine relation is mathematically impossible. The procedure correctly
declined to force `1/z=aD+b` from such limited measured depth variation. Thresholds were not tuned
to obtain more points. All third-camera score fields are null, with zero evaluated or admitted
points; the absence of a measured gain must not be reported as a measured score regression.

The planned point bound was256 per anchor, maximum1,024 across four anchors. It was never reached:
zero points were proposed. The raw depth maps remain available for later properly scoped research,
with the same visibility and calibration limitations. They do not resolve moving-object motion or
an insufficient camera baseline.

## Source credit and artifacts

The source is the frozen `chameleon-flowers` capture; full source-page, author, license, checked-date,
preparation, and video hashes appear in `inference-receipt.json` under `clip`. Derived maps retain
that recorded source license. The source-cache SHA-256 is
`a58563911299803f7b9203214ac7a67a19817d6709dc4d1797d30bfa562d910f`.

- `preregistered-config.json`: fixed parameters before inference.
- `pre-inference-binding.json`: initial dependency, input, code, and credit bindings.
- `inference-receipt.json`: actual cold/warm wall times, requests, dependencies, browser, and maps.
- `anchor-0.f32`, `anchor-5.f32`, `anchor-10.f32`, `anchor-15.f32`: raw294×168 little-endian Float32
  output,197,568bytes per file. No normalization or geometry is stored in these arrays.
- `geometry-report.json`: full projected calibration correspondences, fixed rejections, and limitations.
- `scripts/`: the exact preregistered collector/evaluator source.
- `freeze.json`: hashes of the final diagnostic artifacts and logs.

Rule check: none.

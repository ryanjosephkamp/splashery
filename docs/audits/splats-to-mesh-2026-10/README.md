# Splats to mesh review evidence

Task 106, measured October 17, 2026. This branch is evidence only and must never be merged.
Implementation and reproduction instructions are on `codex/splats-to-mesh`, in
`docs/audits/splats-to-mesh-benchmark.md` and `tools/mesh-export-benchmark.mjs`. The reconstructed
examples use implementation snapshot `65e2a6bf6`; the photo examples select `flat: 0` for depth
relief, and kit examples bake their default poses and visibility.

The [Operator review verification](operator-review/) records the later `e442b74e0` desktop-default
and copyright changes, first-use browser downloads, inspected screenshots, and PDF rollback.

- [Primary scores](scores.json): fourteen existing Poly Haven SOGs reconstructed with the fixed Fine
  preset (160, level 1, 100,000 triangles, smoothing 3, and 100 mm). Median Chamfer 1.4235%, median
  absolute normal consistency 0.9003, and independent watertight/manifold checks 14/14.
- [Examples](examples.json): six kit toys and three Photo to 3D samples, exported in all three
  formats. Their actual GLB geometry and vertex colors are shown in [stills](stills/).
- [Meshes](meshes/): direct colored GLB files, per-mesh reports, and validator records. Each
  example's `obj-mtl-stl.zip` contains its matching OBJ, MTL, and binary STL without changing the
  exported bytes. The ZIPs reduce review-branch storage.
- [GLB validation](validation-summary.json): Khronos glTF Validator 2.0.0-dev.3.10, Apache-2.0; 25
  final files with zero errors and zero warnings.
- [Desktop worker timing](browser-runtime-desktop.json) and
  [phone-profile worker timing](browser-runtime-phone.json): the genuine 450,000-splat Cactus, 3.652
  s and 1.312 s through GLB, respectively. The phone run is an emulated budget and viewport; worker
  CPU throttling is unsupported, and physical-phone timing remains unmeasured.

Seven 100 mm primary meshes fail the sampled 1 mm wall check: marble bust, ukulele, alarm clock,
vintage camera, boombox, lantern, and chess set. The tool marks them **not ready to print**, even
though all fourteen are closed and manifold. Sampling does not certify every surface point, and the
topology checks do not detect self-intersections or evaluate supports or material strength.

Every reconstruction inherits its source's license and attribution in its GLB metadata and OBJ/MTL
comments. Original kit geometry and the three selected photo samples are CC0; source provenance
records and the implementation branch's existing credits identify their authors and live source
pages. The Cactus capture is CC0. Original tool UI and example-ring code was made by Ryan with Codex
(GPT-6), under MIT, with CC0 original geometry. The original source meshes stay outside git and are
used only as ground truth for scoring.

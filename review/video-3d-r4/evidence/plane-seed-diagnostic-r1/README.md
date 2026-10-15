# Real-plane support and seed-bounds diagnostic

Made by Ryan with Codex (GPT-6), October 15, 2026. Code is MIT. This is CPU-only diagnostic evidence, with no rendering, optimizer, end-to-end performance, physical-phone timing, or quality acceptance claim. No product flag was enabled by this helper. No held-out images were read. Watcher V3 and frozen runtimes/protocols were untouched.

## Fixed input and declared method

The exact cache is `/workspace/v3d-r4-media/seed-probe.json`, SHA-256 `a58563911299803f7b9203214ac7a67a19817d6709dc4d1797d30bfa562d910f`: 614 real SfM points and 16 undistorted RGB training images at 320 × 180. Source association is **chameleon-flowers**, Ventrovert, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0), [Commons source](https://commons.wikimedia.org/wiki/File:Chameleon_on_ixora_flowers.webm). The previously verified source record, capture/input hashes, and license receipts are preserved verbatim in `source-credit.json`. Derived RGB seed rows retain that source attribution.

`preregistered-config.json` was written at 08:38:06 UTC before fitting; SHA-256 `c250870247aeaa5240f49b836dfe6582c7577894cb4b4ff03b80ad4a94b34d53`. Parameters were not changed after seeing the outcome: 256 deterministic RANSAC triples, up to three disjoint planes, distance threshold 0.5% of P90 distance about the coordinate-wise median, three least-squares refit/reclassification passes, and support at least max(40, 20% of the original cloud) = **123 points**. The normal is unit length; world units are arbitrary SfM scale, not meters.

Had geometry passed, proposals would have been limited to measured inlier convex hull/depth bounds and nearby observed inliers. Source camera 0, fit cameras 5 and 10, and separately unused validation camera 15 were declared before RGB scores. Both fit cameras would have had to pass center and 3 × 3 patch RMSE ≤ 0.08 without photometric normalization. The third camera would have remained separate for evaluation. True accepted track visibility is absent from this cache, so projected visibility could never have certified surface visibility.

## Plane result: stop before dense proposals

The radius used for the declared plane threshold was **0.453272419**, measured about the coordinate-median center `[-0.0133531, -0.00927936, 2.93871295]` using NumPy's linear P90 quantile. The fixed distance threshold was **0.00226636209**.

The best of 256 triples supported 37 points initially; three least-squares passes gave 40, 42, and **43 points (7.003%)**, below 123. Its fitted normal was `[-0.103095, 0.294689, 0.950016]`, offset −2.763148. Inlier median/RMS/P95 perpendicular residuals were **0.000850477 / 0.001124461 / 0.001893688**. Observed plane-basis spans were 0.420247 × 0.742988 world units, P05–P95 spans 0.347216 × 0.591533, convex-hull area 0.176318 units², and camera-0 depth range 3.395292–3.489129. These are measurements of a **rejected** candidate, not evidence that its entire hull is a real surface.

**Zero planes accepted; zero new plane rows exported.** Dense intersections, three-camera patch comparisons, and a relative photometric improvement score were not run because doing so would bypass the declared physical-support gate. The complete rejected hypothesis inventory, selected triples, inlier indices, hull, and refit history remain in `plane-fit-report.json`. The bounded search does not prove that no plane exists: random triples can miss a supported plane, and noisy true inliers need not yield its exact normal. It establishes no usable plane under this fixed diagnostic.

## Existing initializer context at the same 15,000-row ceiling

The unchanged frozen-R8 `surfaceSeed` source SHA-256 was `331d39131bc210adb71c24c976cb50c6eb537e950ab51a4f269cffa3d44e247c`.

| Baseline input | Triangle candidates | Retained supported rows | Sparse/clone rows after reserve | Total rows |
| --- | ---: | ---: | ---: | ---: |
| All 16 training cameras, maxPoints 13,800 | 8,276 | 3,543 | 11,457 | 15,000 |
| Only cameras 0, 5, and 10; camera 15 withheld from admission | 6,349 | 2,880 | 12,120 | 15,000 |
| Rejected plane proposal without a replacement | — | 0 | 14,736 | 14,736 |

Projected occupancy of 4-pixel bins in cameras 0/5/10/15 was 26.17%/43.61%/35.72%/35.33% for the full baseline, and 19.03%/42.61%/34.50%/34.19% for the restricted baseline. These are geometric projection counts, **not visible-surface coverage, reconstruction accuracy, or quality scores**. The full baseline already used camera 15 for its best-single-view admission and cannot supply independent validation there. Raw float rows and hashes are retained. Since no plane comparator passed the geometric gate, no cross-camera residual improvement is claimed.

## Separate finding: one extreme depth point inflates mean-centered bounds

Native `initGaussians` centers bounds on the arithmetic mean. On the same cache:

| Center convention | Center | P50 distance | Linear P90 distance | P95 distance | Native P90 order statistic |
| --- | --- | ---: | ---: | ---: | ---: |
| Arithmetic mean | [0.161250, 0.0851185, 5.320021] | 2.395761 | 2.481806 | 2.636221 | 2.481922 |
| Coordinate median | [−0.0133531, −0.00927936, 2.938713] | 0.207622 | 0.453272 | 0.604568 | 0.454388 |

Point **264**, `[91.782256, 39.117646, 1446.225503]`, is 1446.732 units from the coordinate median. Removing only this point in a read-only arithmetic counterfactual shifts the mean by 2.356188 units and yields native mean-centered P90 radius 0.431096. The next most distant point is only 5.194 units from the median. Point 264 has positive depth and projects inside **all 16** RGB images; FOV and cheirality checks do not reject it. Actual accepted track visibility is unknown, so this investigation does not classify or delete that point. Full coordinate quantiles, top-20 outlier projections, and top-1/2/5/10/20 leverage counterfactuals are in `radius-audit.json`.

The plane gate remains unchanged. The difference between the plane radius 0.453272 and opt-in native radius 0.454388 is solely linear-quantile versus the initializer's existing discrete P90 index.

## Authorized additive implementation and CPU evidence

Public `vendor/splatjs/src/gs/init.js` now accepts **`conv.robustBounds === true`**: coordinate-wise median center, with the existing P90 order statistic, radius floor, hash-grid rule, scale laws, cloning, and input points retained. The original mean loop and numeric order remain the default. `Session` passes the convention to both seed initialization paths only for **`opts.robustSeedBounds === true`**, preserving v2 SH/random-rotation conventions. This helper did not edit or enable `src/video3d/run.js`.

Before editing, the unchanged initializer generated and saved hardcoded 75-row Float32 hashes: sigmoid `18e98b546375feb1524be3cefda0b1ae7155b42b9a72316994691efae97251d0`; v2 `e513a58f4c5719b3061f9b6f2152b7f408c3eac4458908d725860201416eafb0`. Both hashes remain exact for omitted, false, and non-boolean flags. The new `tests/cdx-v3d-seed-bounds.spec.mjs` additionally covers the retained extreme point, normal-point scale bounds, odd/even median semantics and point-order invariance, and both Session capacity paths with sigmoid/v2 conventions. Before implementation: 2 failed, 5 passed. After: **7 passed in 5.1 seconds**. Pinned Node 22.15/Chrome 141 configuration, DISPLAY :99, llvmpipe configuration, unique port 4186; the tests do not request a browser and throw at the mocked GPU-creation boundary. New-test Prettier and scoped `git diff --check` pass. Original tests were not edited.

For the 614 original rows (clones = 0), robust native radius changes **2.481922 → 0.454388**, a factor 0.183079. Median sigma stays 0.01473975; P90 sigma changes **0.05008187 → 0.02271939**. Excluding point 264, 225 scales decrease by more than 1%, 21 increase by more than 1% (largest ratio 1.48916), and 361 remain within 1e−6 of their old ratio. Scale increases can occur because the radius also changes hash-grid neighborhoods/fallbacks; this is not uniformly narrower initialization.

An exact CPU execution of `Session.seed` at the 15,000-row ceiling reserves the same 3,543 byte-identical surface rows and retains 11,457 sparse/clone rows. Both versions retain all 614 sparse originals, including point 264. Full-seed median sigma stays 0.008867945; P90 changes **0.02866280 → 0.01817551**, and maximum changes 0.12409613 → 0.02271939. Merged seed SHA-256: legacy `d07da3d9832fdad4e5186f9bd8e024a8e3a59ab4bfc558c1b5a483505c6a44a3`, robust `4449eab9d8f239e2cddfadc96f274101a2a0b7ccf73634fd4b030bdd572dcef8`. No GPU is created.

Algebraically, default v1 base position LR changes **0.0007445767 → 0.0001363164**; v2 changes **0.00004963845 → 0.000009087757**, before other option multipliers/schedules. Camera-translation LR and some refinement scale floors also depend on radius. These figures do not show that slower movement improves convergence.

## Recommendation and limits

Do not integrate dominant-plane densification based on this cache: no plane passed the declared real-support requirement, and there is no independent photometric gain evidence. The separate opt-in bounds fix addresses a concrete arithmetic sensitivity without discarding any geometry, but requires native training evidence before any performance or quality claim. Coordinate medians depend on the world axes (they are not rotation-equivariant), P90 can still reflect a large or multi-part scene, narrower hash cells can change nearest-neighbor fallback, and reduced position LR can delay useful motion. Retaining the extreme point can still leave an unnecessary Gaussian and clones; no filtering policy was invented here.

This evidence uses one cached plant/animal scene; moving foliage/chameleon, occlusion, imperfect SfM, and absent accepted-track inventory limit conclusions. All failure evidence remains available. No thresholds were relaxed, no held-out feedback was used, and no new physical surfaces or view-aligned cards were generated.

Rule check: none.

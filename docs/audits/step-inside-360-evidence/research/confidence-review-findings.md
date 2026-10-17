# Confidence candidate independent review

Reviewed read-only on October17,2026. The reviewer wrote only ignored evidence files and
evidence-only prototype sources, not shared runtime, existing tests, models, or weights. The parent
ported the reviewed correction and owns final model runs, full product regression, sample cache
rebakes, recordings, report updates, and publication.

## Implementation and resolved blocker

The confidence helper averages local per-channel RGB variance over nine samples at offsets −2,0,2
and uses the fixed1e−6 threshold. It agrees exactly with the frozen candidate helper on independent
flat, equal-channel-sum colored texture, random, and gentle-gradient cases. The confidence mask
affects positive tile medians and four-neighbor overlap validity. Fusion keeps flat pixels within
otherwise reliable tiles; a wholly constant-color tile still has the preexisting reliability0
treatment. This is an input texture heuristic, not a calibrated probability of neural depth
accuracy. The two original new tests exercise distinct properties: per-channel texture
discrimination and invariance of supported calibration when unsupported model values are corrupted.
Their passing output-preservation check is coarse; source review also confirms fusion does not apply
the per-pixel confidence mask.

The radial alignment equation `(a*q+b)*cosine` and the fixed0.375 inverse-radial blend are
consistent with the existing relative inverse-Z interpretation. True geometry and validity masks do
not enter calibration, confidence, or fusion. The production module and browser prototype differ
only in the intended fixed weight/helper extraction and the safety correction.

One important blocker was found and corrected. With an entirely unsupported front tile, its empty
median became1e−6 and set the global inverse-depth unit. Fusion's absolute positive threshold then
discarded the other five valid fields. The exact analytic fixture produced an all30m sphere. A
supported-tile global unit fixed that collapse, but retained reliability1 front pixels still had a
disconnected scale. A raw-positive front median alone did not solve it: supported-region
error0.00750 exceeded the unchanged0.003 regression requirement.

The final correction fits a wholly unsupported positive-model reliability1 tile one way to the
already-calibrated supported overlaps. Its raw median is used only for that private two-parameter
normalization. It cannot set the shared unit or move supported transforms. It uses the existing five
IRLS passes,0.04 normalized Huber residual,0.0001 weak priors, positive scale bounds0.05..20, and300
coordinate sweeps. With no valid overlap, it retains a normalized-unit prior. Reliability0 and
zero-model tiles are skipped. Ridge priors make a constant raw field's corrected combination
identifiable without needing separate scale/shift identifiability. Controlled exact and affine-front
errors are about0.000134; the physically constant front wall is about0.00118. All supported
transforms remain byte-identical.

Reproductions and the small source diff are `confidence-anchor-review.mjs`,
`confidence-one-way-review.mjs`, `confidence-one-way-core.mjs`, and `confidence-one-way.patch`. The
parent added strict regressions and ported the correction; no threshold was relaxed.

## Fidelity and independent metric replay

`confidence-source-fidelity-review.mjs` first compared the unit-fix sourcepoint with the frozen
browser prototype, using identical real cached neural tensors and Chromium-decoded pixels. All24
fields matched byte-for-byte; all six new-room fields also matched the actual cached prototype.
jpeg-js decoding was measured separately and can change RGB/confidence/local depth substantially,
even when cohort AbsRel shifts only slightly. Original18 offline jpeg-js scores must not be called
byte-equivalent to product scores. Exact seven-file source snapshots for this older point are
preserved under `confidence-fidelity-sources/`.

`confidence-final-fidelity-review.mjs` then used every actual unit-fix neural output under
`pre-one-way/`, the current production pipeline, the one-way evidence snapshot, and the older
unit-fix snapshot with the same Chromium pixels. It records144 per-face support records. Every
production field equals the reviewed one-way field and actual pipeline output exactly. No benchmark
face is eligible for one-way registration: unsupported sky tiles have reliability0. Thus the
correction changes zero of the24 benchmark fields or their supported transforms. All six new-room
fields still equal the frozen browser prototype. Final five-file snapshots and hashes are under
`confidence-final-fidelity-sources/` and the result JSON.

Reviewed production hashes:

- `core.js`: `a2a4efa5e2f238041934bd3f07468b5affedb87df4441af6246f81ae4459fafa`
- `prior.js`: `c87ff9f15f246b7b7d15a660373582a3ef21638b8966e2c3d887d80122959aa0`
- `pipeline.js`: `8a23939079b8cf4fdbfdbd3edda335cf46f37ac0391b19428a7920522a3faf44`

This replay injects real saved tensors; it does not claim newly executed inference under the final
source. The parent's final production neural runs still identify that source independently.

`confidence-metrics-review.mjs` independently recomputes all24 unit-fix actual-model scores from raw
fields, exact geometry, and fixed masks. It matches every reported AbsRel, delta1, seam median and
seam-pair count within1e−12. Each method gets the documented pixel-median global scale;
errors/delta1 use spherical area weights. Zero/near-zero naive inverse depth retains the declared
floor. All scenes remain in the means.

| Cohort                   | Actual meanAbsRel | Naive294 meanAbsRel | Improvement |
| ------------------------ | ----------------: | ------------------: | ----------: |
| Original development6    |          0.088125 |            0.120686 |     26.980% |
| Diagnostic families6     |          0.124178 |            0.162985 |     23.810% |
| Diagnostic interiors6    |          0.141093 |            0.176685 |     20.145% |
| Development/diagnostic18 |          0.117799 |            0.153452 |     23.234% |
| Fresh room layouts6      |          0.226650 |            0.319546 |     29.071% |
| All24                    |          0.145011 |            0.194976 |     25.626% |

Regressions versus naive294 are arches15.462%, still-life17.035%, and fresh-room-037.418%. All23
measured seam medians are below2%. Coast has no valid seam pairs and a null median; it is
unassessed, not a passing zero. All six fresh-room seam measurements are valid and pass.

## Selection reporting

The initial confidence blend plan used original-six mean plus a conservative5% worst-scene
regression preference. The recorded eligible choice was0.25. The0.375 candidate had the best
original-six mean but failed that preference. An amended aggregate-only criterion chose0.375 before
its additional12-scene assessment and before generating/scoring the six fresh room layouts. The
original0.25 assessment file contains only that weight; the amended0.375 file contains only0.375.
The fresh generator hash matches its recorded frozen plan.

This is an amended criterion after development results were known, not a pass under the first
criterion. Retain both plans, the initial choice, the rejection/preference failure, all scene
regressions, and all prior research outcomes. The previous18 scenes are development/diagnostic; the
new six use fresh room/layout geometries but share materials/helpers and indoor rendering, so they
are correlated synthetic cases rather than six independent scene families or real phone photos. The
fresh frozen assessment supports the amended aggregate criterion.

No remaining important implementation blocker was found at the reviewed final sourcepoint. Before
publication, the audit/PR, baked caches, measurements, and clips must identify the final 0.375
confidence candidate and its actual-source verification rather than the superseded quarter-cube14.6%
method. Product regression and recording completion remain the parent's work.

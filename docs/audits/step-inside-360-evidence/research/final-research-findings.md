# Final numerical review findings

All research was kept in ignored evidence files. No production or existing test file was edited by
this reviewer. The final recommendation is the fixed294-side four-yaw panorama prior,
original294-side six-face cube, fixed inverse-radial cube weight0.25, and no floor offset
correction. The research does not establish the requested20% real-depth gate.

The six-scene development set contains room, desk, stairs, arches, steps, and lattice. The six
original assessment families became diagnostic after previous294/floor outcomes were examined. The
reviewer opened fresh-interior inputs only after explicit authorization to evaluate the frozen392
configuration; no threshold or coefficient was adjusted from its results. Parent-generated floor
assessment scores are not independently recomputed here.

| Fixed392 study group          | Ensemble392 | Ensemble294 | Naive294 |   Naive392 |
| ----------------------------- | ----------: | ----------: | -------: | ---------: |
| Original development6         |    0.095603 |    0.108821 | 0.120686 |   0.120975 |
| Original assessment families6 |    0.127707 |    0.140699 | 0.162985 | 159.117749 |
| Closed interiors6             |    0.196146 |    0.143888 | 0.176685 |   0.276517 |

These are unweighted scene means of area-weighted, valid-mask AbsRel with the same separate median
scale calibration per method. Within each method, inverse depth is interpolated before inversion.
The392 change improves the original development mean20.78% versusnaive294 and20.97% versusnaive392,
but worsens the closed-interior mean11.01% versusnaive294. Interior 01,03,05,06 regress
versusnaive294. The leaves family also regresses. The392 naive night prediction contains
zero/near-zero inverse depth on supported geometry and yieldsAbsRel954.11; that baseline makes its
family mean unstable and must not be used alone to claim qualification.

The frozen392 plan was recorded before inference or scoring, and only resolution changed. All72
actual392 model inferences completed without an exception or arena failure. Raw model outputs,
model/source hashes, inference dimensions/times, plans, exact generated assessment sources,
per-scene fits/scales/scores, and logs are archived. No further parameter search was performed on
these assessments.

Earlier generally motivated alternatives did not qualify:

- The overlap residual/gauge/prior/convergence studies did not repair the actual six-tile
  calibration. An affine per-tile oracle supports the inverse-Z/radial conversion but is diagnostic
  only, with truth used during fitting.
- RGB/rotation disagreement and cube-overlap uncertainty weighting, global cube affine fits, and
  per-tile calibration against the panorama prior did not improve the fixed quarter blend.
- Eight equatorial perspective headings plus up/down actually inferred four new diagonal views per
  development scene. MeanAbsRel0.188958 remained worse than naive0.120686; blending its field with
  the rotation prior also underperformed the original cube blend.
- Replacing the front-scale gauge with a mean normalized-slope gauge solved controlled affine
  fixtures accurately but strongly degraded real outputs. This is model/calibration mismatch, not
  simply insufficient solver convergence or fewer overlap equations.
- Per-rotation plane-offset correction before scale alignment was worse than post-ensemble
  correction on development/diagnostic12 and was rejected. The parent subsequently rejected the
  post-ensemble plane candidate on the frozen closed-interior assessment as well.
- A floor guard numerical issue was reported and preserved: second-moment cancellation can accept
  constant depth as a physical plane. Floor correction is removed from the recommended runtime
  entirely; repairing only that numerical guard would not establish transfer.

The implementation review also verified quaternion normal orientation, delayed file-read
cancellation, restart after inference cancellation, stale sensor permission handling, GPano heading
subtraction and malformed metadata rejection, and displacement/pulse warning sampling. The GPU
first-capture review found the packed offset reaches the GPU immediately; the low truth-control
score came from an unsettled camera FOV. Snapping the complete camera produced identical consecutive
captures and substantially improved truth-control SSIM. Limits and mocked components of each
reproduction are stated in the individual review files.

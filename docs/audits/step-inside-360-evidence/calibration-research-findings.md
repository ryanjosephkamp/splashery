# Additional calibration research

October 17, 2026. Evidence only; no production files or tests changed.

No generally motivated calibration change recovered the depth gate from the cached six-face
predictions. The six-scene mean naive AbsRel is approximately 0.1207, so a 20% improvement would
require approximately 0.0965. The production snapshot at research start has mean AbsRel 0.2120.

## Residuals, priors, anchors, and convergence

`calibration-research.mjs` freezes production geometry and validity handling in
`calibration-start-core.mjs`. It changes only the fitting objective or solver settings. It computes
confidence from perspective RGB inputs, uses cached actual-model predictions, and accesses true
depth only after fitting and fusion. Its cached fusion matches the production implementation exactly
on all six baseline outputs: maximum absolute difference is zero.

| Fixed method across all six scenes                | Mean AbsRel | Interpretation                                                                                  |
| ------------------------------------------------- | ----------: | ----------------------------------------------------------------------------------------------- |
| Current snapshot                                  |      0.2120 | Reference                                                                                       |
| Anchor face 1 instead of face 0                   |      0.2018 | Small aggregate gain; regresses steps and has no general reason to favor that compass direction |
| Scale prior 10, weak shift prior                  |      0.2050 | Improves room and arches; regresses desk, stairs, steps, and lattice                            |
| 3,000 coordinate sweeps                           |      0.2121 | Matches the 300-sweep baseline closely                                                          |
| 20 IRLS iterations                                |      0.2437 | More objective optimization does not improve geometry                                           |
| Fixed relative residual, Huber 0.2                |      0.2311 | Worse than current                                                                              |
| Dynamic relative residual, Huber 0.04             |      0.2475 | Worse than current                                                                              |
| Strongest tested common scale and shift prior, 10 |      0.4680 | Removes useful calibration freedom                                                              |

The full predeclared sweep covers fixed and dynamic relative normalization at Huber thresholds 0.04,
0.1, and 0.2; scale priors 0.01, 0.1, 1, 10, and 100; joint scale/shift priors 0.01, 0.1, 1, and 10;
fixed gauge anchors 1, 2, 3, and 5; and the longer solver settings above. There is no per-scene
method selection in these summaries.

Relative rows divide residuals by the mean magnitude of the two corrected radial inverse-depth
observations, with a fixed 0.01 denominator floor. Fixed weights use the initial identity fit;
dynamic weights use the current iterate. These are IRLS approximations, not a guarantee of a global
optimum for a nonlinear log-depth objective. They do not resolve calibration here.

Absolute fitting can shrink an individual face's useful response: for example, the steps
downward-face scale reaches the lower bound. That observation alone does not establish an incorrect
solution, because a planar floor should have nearly constant perspective Z in the downward face.
Preventing shrinkage through stronger priors fails to improve all scenes. The near-radius clamp
affects zero supported rays in every current baseline output, so the current remaining depth error
is not caused by the 0.6-meter clamp.

The stable coordinate-sweep results, worsening longer IRLS results, and failure of simple relative
objectives point toward model/overlap calibration mismatch rather than an obvious unit conversion or
insufficient coordinate-solver convergence. The earlier oracle fit shows that inverse perspective Z,
multiplied by the ray cosine, is the appropriate radial inverse parameterization. Its favorable
scores are diagnostic and use true depth; they are not a deployable calibration method.

## Upright-floor heuristic

`floor-prior-research.mjs` adds a soft inverse-radial plane constraint for the central 30-degree
cone of the downward tile. It assumes an upright panorama with a flat floor under the capture. A
free positive inverse floor height preserves the existing front-scale gauge. The prior uses no true
depth, and identical fixed weights apply to all scenes.

| Prior weight relative to total overlap weight | Mean AbsRel |
| --------------------------------------------- | ----------: |
| 0.01                                          |      0.2138 |
| 0.1                                           |      0.2266 |
| 1                                             |      0.2974 |
| 10                                            |      0.3160 |
| 1, combined with scale prior 10               |      0.2060 |

The combined result is essentially the scale prior alone. A seated capture, nonlevel panorama,
nearby object, stair, or view without a floor can violate the heuristic. These results do not
support introducing it into production.

## Recommendation

Keep these experiments on the evidence branch. Do not select an anchor, prior, or threshold after
looking at an individual scene's truth. None of the tested variants establishes the 20% depth gate.
Further useful work likely needs better inference observations or calibration confidence, rather
than another scalar prior adjustment to these same cached tiles; this review did not test new
inference layouts or models.

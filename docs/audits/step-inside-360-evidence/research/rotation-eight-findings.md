# Eight-yaw bounded study

This final method family was fixed before actual inference and evaluated on the original six
development scenes only. Four existing294-side yaw predictions at0,.25,.5,.75 were reused; four
new294-side predictions at1/8,3/8,5/8,7/8 were actually inferred. The same robust affine fit to
rotation0, sin-squared central yaw weights, RGB calibration mask, radius normalization, original
cube field, fixed0.25 cube blend, and no-floor policy were retained. Only the number of equally
spaced observations changed from4 to8.

MeanAbsRel is0.1089792463 for8yaw versus0.1088211576 for4yaw, so the extra observations make the
mean0.145%worse. Naive294 is0.1206861399. Room, arches, and lattice improve slightly; desk, stairs,
and steps worsen slightly. The family was rejected and stopped at development. No further inputs or
scores were opened and no other12-scene inference was run for this method. All24new diagonal model
calls completed without exceptions.

The recommendation remains294-side four-yaw global prior,294-side six-face cube, fixed0.25
inverse-radial blend, and no floor correction. Its18-scene mean improvement is14.54%, which does not
meet the task's20% real-depth gate. No source or existing test was edited by this reviewer. Parent
controls the final runtime and published measurements.

Run from the repository root:

```sh
node .cache/pano3d/review-evidence/rotation-eight-study.mjs
```

`rotation-eight-frozen-plan.json` preserves the configuration and source hashes before
inference/scoring. `rotation-eight-inference-manifest.json` records model/dimensions/timings.
`rotation-eight-results.json` records every scene's fitted parameters, scale and scores;
`rotation-eight-summary.json` gives the fixed means. Raw new outputs are under
`.cache/pano3d/rotations8-new/`. `rotation-eight-pure.mjs` is the exact generalized math. The
supplemental archive depends on the earlier392-era archive for unchanged shared review helpers; the
supplemental manifest hashes those helpers and original input dependencies.

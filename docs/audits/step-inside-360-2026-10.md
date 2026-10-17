# Step inside a 360° photo: implementation and qualification

Codex (GPT-6), October 17, 2026. Task 107. Branch: codex/step-inside-360.
[Draft PR #700](https://github.com/ryanjosephkamp/splashery/pull/700).

**The depth improvement gate is unmet. This is an experimental draft, not a qualified release.** The
tool is available only in the labs Studio shelf. Classic Photo to 3D's implementation, model,
renderer hooks, and existing tests were not edited.

## Implementation

The independent pipeline lives in src/pano3d/. The input reader accepts complete 2:1 equirectangular
images, reads GPano dimensions, projection, pose, and initial heading, and rejects partial panoramas
and cylindrical projections. Initial heading is relative to the panorama pose. Files stay in the
page; inference uses the existing same-origin WASM depth engine in a dedicated worker. A saved link
cannot retain a private local file and asks the person to reopen it.

An interactive constant-radius splat preview appears before custom inference finishes. Six
overlapping 110-degree perspective views run the shipped relative-depth model at 294 pixels. The
pure pipeline jointly fits scales and offsets in inverse radial depth, applies the perspective
cosine correction, and feathers overlapping observations. Unsupported, constant-color views do not
determine the calibration or the normalization median. Unsupported rays receive a distant shell,
rather than fabricated measured geometry.

Latitude rings close the polar caps. Extra samples favor the initial heading within the normal phone
and desktop budgets. Explicit inward quaternions orient the anisotropic discs; Kit's explicit-scale
path does not consume normals. The normal renderer's phone pixel cap applies. Drag uses the existing
inside camera; tilt starts only after a tap and permission. Lean and step offsets stay within one
estimated meter. The warning follows the direction of displacement, rather than the direction the
person looks. Distances are relative estimates, not a metric measurement of the room.

Worker termination, source generations, decode versions, sensor teardown, and retry state handle
exit, replacement, a delayed file decode, and a delayed sensor permission. No Engine commit or
change to existing packs, player, app, stage, UI, effects, loaders, or stylesheet was needed. The
new catalog entry uses the existing relative pack import path to load the independent module.

## Assets and licenses

The live pages for [Small Empty Room 1](https://polyhaven.com/a/small_empty_room_1) and
[Small Empty Room 2](https://polyhaven.com/a/small_empty_room_2), and
[Poly Haven's license page](https://polyhaven.com/license), were opened and checked on October
17, 2026. They identify Sergej Majboroda and CC0. The original tonemapped JPEGs were reduced from
8192×4096 to 2048×1024 with Pillow, quality 88. Provenance, source and shipped hashes, and
transformations are recorded in tools/assets.json. The baked depth files use the existing Photo to
3D cache format and the new pipeline. A candidate lounge panorama with visible signage was
discarded.

No new third-party runtime, model, or weights ship. Existing Blender, Pillow, ffmpeg, and Playwright
tools produce the local evidence.

## Reproducible yardstick

Task 105's panorama truth tool had not landed on main when this task started. The local
tools/pano-truth.mjs imports the existing tools/studio-truth-generate.py scene builder in Blender
4.3.2. Six original CC0 scenes cover room, desk, stairs, arches, steps, and lattice. It renders
equirectangular inputs, exact BVH radial depth and ambiguity masks, and independent held-out views
at 0.3 m and 0.8 m.

tools/pano-evaluate.mjs runs the actual shipped WASM model on the six perspective views and a naive
one-tile equirectangular input at the same 294-pixel side. Each method receives one whole-sphere
median scale calibration. AbsRel and delta1 use opaque, unambiguous truth pixels and spherical area
weights. Seam jumps use adjacent valid pixels crossing dominant cube boundaries and the longitude
wrap. Raw overlap disagreement is reported separately: feathering can hide a discontinuity without
making depth accurate.

Held-out masked SSIM includes both a declared software point-splat diagnostic and the actual
product's low-profile Kit/WebGL2 renderer, through tools/pano-gpu-views.mjs. Both use fixed
source-visible masks from true geometry. Missing predicted pixels stay in the score. The GPU
comparison uses exact 256×256 export buffers, a snapped 72-degree camera, and globally calibrated
radial depths; all methods clip the cache's far distance to 200 m to preserve 16-bit precision. A
true-depth reprojection control measures source sampling, occlusion, blur, and reference noise.
Review caught the initial comparison camera easing its zoom; those scores are labeled rejected, and
the fixed-camera run supersedes them.

tools/pano-clips.mjs records the real tool at 390×844, device scale factor 3, with the low profile
and normal phone pixel cap. Eight recordings cover both CC0 samples and all six truth scenes. First
look includes the interactive preview; depth-ready time is reported separately. Linux process-tree
PSS and RSS are sampled every 100 ms. RSS double-counts shared pages and sampling can miss short
peaks. Desktop software graphics, concurrent test load, and emulation do not establish
physical-phone latency, memory, or sensor behavior.

Panoramas, raw inference, measurements, review diagnostics, and recordings belong on the
[separate evidence branch](https://github.com/ryanjosephkamp/splashery/tree/codex/step-inside-360-clips),
which must never be merged. Its README records the exact source hashes, commands, gate outcomes, and
eight video links. Earlier captures from changing runtime revisions are labeled rejected.

## Experiments and limits

The six-scene 294-pixel run measures mean AbsRel 0.2120, versus 0.1207 for the naive input. Every
scene misses the 20% improvement gate. Valid-pixel seam medians range from 0.839% to 1.222%; raw
overlap disagreement remains materially larger and is separately reported. Eight complete
phone-profile recordings show first look in 2.066–3.690 seconds, custom depth ready in 10.698–16.723
seconds, and maximum sampled PSS of about 905 MiB. Three cold Classic conversions of the same
shipped room image peak at 897–991 MiB in this environment. This is a limited desktop comparison,
not a physical-phone qualification or a guaranteed memory ceiling.

Controlled tests exposed real implementation errors in affine offsets, unsupported normalization,
disc orientation, metadata, and asynchronous lifecycle. Fixing those errors did not establish the
requested 20% real-model improvement. Ground-truth-assisted affine fits are archived only as oracle
diagnostics; they are not production results. Fixed validity cutoffs, featureless-view thresholds,
and global one-tile priors also failed to establish the gate. A six-scene, same-model 518-pixel
comparison also failed and increased inference cost, so it does not replace the smaller runtime
setting.

An offline indoor metric-model pilot was also evaluated, without adding it to the product:
[model card](https://huggingface.co/77ukhtar/depth-anything-v2-metric-onnx/blob/a4259a3c45137b6eb32c84fcd95b86cd54c255b9/README.md),
[upstream metric model documentation](https://github.com/DepthAnything/Depth-Anything-V2/blob/main/metric_depth/README.md),
and
[upstream Apache-2.0 license](https://github.com/DepthAnything/Depth-Anything-V2/blob/main/LICENSE).
Its pinned 95 MiB export failed the first room pilot and was cut. It is neither a shipped weight nor
a panorama-native comparison, and its result is not phone performance evidence.

## Verification status

The Classic golden run passed 77 tests, including both budgets for its 76 frozen samples. New tests
cover spherical coordinates, coverage, joint affine calibration, sky support, cancellation, GPano
validation, inward discs, movement limits, real browser input races, source replacement, and
switching back to Classic. Final panorama tests passed 12/12 and the post-merge preflight passed all
271 shelf-wide specs, formatting, English, generated-site, list, and size checks. The complete
existing suite is running locally and requested in sharded CI; the PR and evidence README record its
actual outcome.

Thumbnail, phone, and desktop captures are inspected separately from numerical depth scores. No
merge or release qualification is claimed while the depth gate and physical-phone evidence remain
unresolved.

Rule check: no rule exceptions were used.

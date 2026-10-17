# Step inside a 360° photo: implementation and qualification

Codex (GPT-6), October 17, 2026. Task 107.
[Draft PR #700](https://github.com/ryanjosephkamp/splashery/pull/700).
[Eight clips, raw measurements, and reproducible research](https://github.com/ryanjosephkamp/splashery/tree/codex/step-inside-360-clips/docs/audits/step-inside-360-evidence).
The evidence branch must never be merged.

**The measured depth and seam targets pass.** The final method gives 25.63% lower mean AbsRel across
all twenty-four synthetic panoramas. Three cases regress, and every outcome is retained. This
remains a labs draft: physical-phone qualification and the complete regression outcome are separate.
Classic Photo to 3D remains byte-identical under its golden test. No existing test was loosened or
skipped.

## Implementation

All new runtime code lives in src/pano3d/. Input accepts complete 2:1 equirectangular images and
reads GPano dimensions, projection, pose heading, and initial heading. It rejects partial panoramas
and cylindrical projections. The initial view uses the heading relative to the panorama pose.
Private files stay in memory on the device; a shared custom-source link asks the visitor to reopen
the file.

An interactive constant-radius preview appears before custom inference finishes. Six overlapping
110-degree perspective tiles run the shipped WASM depth model at a 294-pixel side. Joint robust
affine alignment in inverse radial depth applies the perspective cosine correction. Four complete
panorama yaw views, also at 294 pixels, supply global context. Their relative inverse-depth fields
are robustly aligned, periodically feathered, and combined with a fixed 0.375 fraction of the
locally aligned cube field in inverse depth. Both cube overlaps and the whole-panorama prior use
local RGB confidence during calibration and normalization. Flat predictions cannot move the
supported views. If the front is unsupported, another supported tile supplies the arbitrary global
unit; a wholly unsupported tile with positive model output is registered one way to
already-calibrated neighbors, preserving the full photo. Constant predictions retain an identifiable
correction through the same weak priors. It abstains for a completely featureless input. No true
depth or validity mask enters production inference. Sequential yaw inputs reuse one scratch buffer,
saving two full-size RGBA allocations. That earlier memory change was verified on all eighteen
then-current inputs with byte-identical predictions and sample caches. The later confidence method
intentionally changes the geometry; its final model results and caches are measured separately. No
new model, weights, runtime dependency, or network service ships.

Latitude rings close both poles. Extra samples favor the initial heading within the normal phone and
desktop budgets. Explicit inward quaternions orient the anisotropic discs. The normal renderer's
phone pixel cap applies. Drag uses the existing inside camera; tilt starts only after a tap and
permission. Lean and step remain within one estimated meter. The stretch warning samples the
direction of displacement. Distances are relative estimates; a single image cannot supply hidden
surfaces.

Worker termination, source generations, decode versions, sensor teardown, and retry state cover
replacement, exit, delayed file decoding, and delayed sensor permission. Existing packs, player,
app, stage, UI, effects, loaders, and stylesheet are unchanged. No Engine hook was needed. Shared
changes are the new tool's entries, generated pages, and the two generated Showcase shelf counts
that increase by one for this tool.

## Assets

The live [Small Empty Room 1](https://polyhaven.com/a/small_empty_room_1),
[Small Empty Room 2](https://polyhaven.com/a/small_empty_room_2), and
[Poly Haven license](https://polyhaven.com/license) pages were opened on October 17, 2026. They
identify Sergej Majboroda and CC0. Original 8192×4096 tonemapped JPEGs were reduced to 2048×1024
with Pillow, JPEG quality 88. Source and shipped hashes, licenses, author, transformations, baked
depth hashes, and the reconstruction hash are in tools/assets.json. Source pixels are not
synthesized. A lounge candidate containing signage was discarded and is not published.

The samples' depth caches use the existing Photo to 3D cache format and the final panorama pipeline.
Blender, Pillow, Playwright, and ffmpeg are local production and measurement tools, not new runtime
dependencies. Original synthetic fixtures are CC0; the new code is MIT.

## Yardstick and selection chronology

Task 105's spherical truth tool had not landed at task start. tools/pano-truth.mjs therefore imports
the existing tools/studio-truth-generate.py scene builder in Blender 4.3.2. Six development scenes
are room, desk, stairs, arches, steps, and lattice. A second group uses six previously unscored
families: still-life, forest, coast, fur, night, and leaves. A third group adds six closed-enclosure
and shifted-camera variants of the first group; these share base furniture families and are not six
new independent scene families. A fourth group adds six fresh room geometries, furniture layouts,
textures, and camera poses fixed before their assessment. These remain correlated synthetic indoor
cases, not physical-photo validation. Generators, exact radial BVH depth, opaque/ambiguous masks,
input panoramas, and held-out 0.3 m and 0.8 m views are on the evidence branch.

The earlier four-yaw, quarter-cube method improved the eighteen-scene mean by 14.6% and missed the
target. Local RGB confidence made cube calibration useful enough to test stronger fixed blends. Four
weights were assessed on the original six. A conservative research preference allowed at most 5%
per-scene regression; 0.375 failed that preference despite the best aggregate mean. A separate plan
then assessed this fixed aggregate-accuracy candidate, against the aggregate accuracy yardstick,
without hiding its per-scene regressions. It improved the original eighteen by about 23.2% and the
fresh six by about 29.1% before the generic unsupported-tile bug fixes. No blend parameter was tuned
on the fresh results. Exact source snapshots, plans, choices, failed criteria, and all assessments
are retained.

The earlier additional groups also rejected floor and larger-resolution alternatives. These groups
are no longer untouched future benchmarks. Browser/Chromium RGB decoding differs from jpeg-js, so
the original offline confidence scores are separate from final actual-browser model scores; byte
equivalence is claimed only where identical pixels and tensors were compared. Reviewer reproductions
cover the unsupported-anchor unit, one-way affine registration, constant-field identifiability, and
supported-transform invariance. tools/pano-evaluate.mjs runs the actual shipped model and compares
the final ten-inference pipeline with a naive one-tile equirectangular run at the same 294-pixel
side. Benchmark inference times include both baseline inferences; phone timings are measured
separately. Each method receives one whole-sphere median scale calibration. AbsRel and delta1 use
opaque, unambiguous true-depth pixels with spherical area weights. This is a comparison of accuracy,
not matched compute. An additional 392-pixel naive control is reported, including its unstable zero
predictions; it is not substituted for the primary baseline to claim success.

The final twenty-four-scene mean AbsRel is 0.145011 versus 0.194976 naive, a 25.63% reduction. Group
mean improvements are development 26.98%, additional families 23.81%, closed interiors 20.14%, fresh
rooms 29.07%. Regressions are arches 15.46%, still-life 17.03%, fresh-room-03 7.42%. All 23
measurable seam medians are below 2% (0.262–1.704%); coast has zero valid pairs and is unmeasured.
Exact final model results, delta1, scales, source hashes, inference times, seam pairs, and raw
outputs are in the evidence measurements. All twenty-four cases are included. The comparison still
uses the same 294-pixel naive baseline; it does not substitute the unstable 392-pixel control.

Seam jumps use adjacent valid pixels crossing dominant cube boundaries or longitude wrap. A group
with no valid seam pairs has a null median, not a passing zero. Raw per-tile overlap disagreement is
reported separately. A small feathered seam does not establish accurate geometry. The complete phone
recordings are supplied for visual judgment.

Held-out masked SSIM includes both a labeled software point-splat diagnostic and the real Kit/WebGL2
product renderer. Masks are fixed from true source visibility and retain missing predicted pixels.
GPU measurements use a snapped 72-degree camera, exact 256×256 export buffers, and the same global
depth calibration. Every method clips radial cache distance to 200 m before 16-bit encoding.
True-depth reprojection controls expose sampling, occlusion, blur, and noisy references; they are
not mathematical SSIM upper bounds. Initial easing-camera measurements are preserved as rejected and
superseded by the snapped-camera runs.

## Clips and phone limits

Eight complete native recordings show the two CC0 samples and six original synthetic inputs at
390×844, device scale factor 3, low profile, normal phone pixel cap, and Mesa llvmpipe. They include
a full turn, ceiling, floor, 0.3 m lean, 0.8 m step, warning, and return to center. Each posed view
is allowed to draw. The recordings are not shortened to their final seconds.

First-look timing includes the interactive preview; depth-ready timing is separate. The clock starts
after the application is ready, immediately before selecting the tool, and excludes initial
navigation and mobile bandwidth. Custom runs include the default sample and automated file
selection. Source hashes and exact times accompany every clip.

The memory comparison uses three quiet cold conversions of the same 2048-pixel CC0 input, with exact
final source hashes and the existing read-only Classic probe. Final first-look, depth-ready, and
sampled PSS values accompany the native clips and verification records on the evidence branch. Both
tools use the same 390×844, DSF 3 viewport and their normal pixel caps; Classic has a 585×1266 stage
buffer and the panorama controls leave a 585×700 buffer. These are observations, not a universal
memory ceiling.

Memory uses Linux browser-process-tree PSS sampled every 100 ms for panorama and 200 ms for Classic.
RSS double-counts shared pages, and sampling can miss short peaks. The evidence includes cold
Classic conversions and panorama conversions of the same 2048-pixel CC0 input, as well as the eight
clips. Desktop Chromium with software graphics and concurrent checks does not qualify physical-phone
latency, RAM, GPU memory, or tilt sensors. This limitation is explicit even when the emulated
first-look gate passes.

## Rejected alternatives

The initial six-view-only prototype had mean AbsRel 0.2120 against 0.1207 naive. Its original
measurements remain in rejected evidence. Joint calibration, relative-residual, gauge, convergence,
projection-FOV, 518-pixel, dense equatorial-tile, uncertainty-weighting, and rejected RGB-confidence
studies are archived. The adopted calibration-only confidence path and its selection chronology are
recorded separately. Ground-truth-assisted affine fits are oracle diagnostics only.

A floor-plane offset improved development scores but failed the frozen closed-interior assessment,
including a large regression. Both level and tilted-plane variants, per-rotation correction, and a
numerical cancellation issue are preserved. No floor calibration remains in runtime code.

Four 392-pixel yaw priors cleared 20% on the first six but regressed four of six closed interiors;
the pooled eighteen-scene gain was only about 8.9%. Eight 294-pixel yaw views slightly worsened the
six-scene development mean. Both alternatives were cut without further tuning on their assessments.

An offline 95 MiB indoor metric-model pilot also failed. Its
[pinned export card](https://huggingface.co/77ukhtar/depth-anything-v2-metric-onnx/blob/a4259a3c45137b6eb32c84fcd95b86cd54c255b9/README.md),
[upstream documentation](https://github.com/DepthAnything/Depth-Anything-V2/blob/main/metric_depth/README.md),
and [Apache-2.0 license](https://github.com/DepthAnything/Depth-Anything-V2/blob/main/LICENSE) were
opened. A corrected comparison retains the unnormalized radial range before scoring; it still fails
the room pilot. No alternative weights are published or shipped.

## Verification

New tests cover spherical wrap and coverage, affine calibration, sky normalization, GPano input,
worker replacement, cancellation, delayed decode, inward discs, movement bounds, yaw shifts,
featureless-prior fallback, periodic fusion, and switching back to Classic. Classic's golden test
checks all 76 samples at both budgets. Final test counts and logs, post-merge preflight, the
complete sharded suite outcome, renderer checks, and frozen-file identities are recorded in the PR
and the evidence verification directory. Classic passed all 77 golden tests, and the final panorama
run passed all 19 tests, including flat-confidence calibration, unsupported-front fallback, affine
and constant front fields, and preservation of supported geometry. Existing tests are unchanged.

The existing Pebbles stacking assertion also fails on untouched main (ceb51de7a, with identical
physics and test bytes in the later documentation-only main merge) and on this branch, with
identical test and shared engine blobs. The reproduction and logs are in the evidence verification
directory. No physics code or existing test was changed to hide this blocker.

The PR remains a draft. Missing physical-phone qualification and the existing main physics failure
prevent an unqualified release claim.

Rule check: none.

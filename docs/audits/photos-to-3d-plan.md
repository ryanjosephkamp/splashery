# Photos to 3D investigation plan

**Goal:** Establish task 104's on-device unordered-photo pipeline, or return its explicitly allowed
negative result with three actionable blockers. The task brief is the approved specification:
[104-photos-to-3d.md](../codex/104-photos-to-3d.md).

**Architecture:** First exercise the existing Splat.js decoder, incremental camera solver, and
trainer without changing them. Keep diagnostic code under `tools/photos3d-*`, tests under
`tests/cdx-photos3d*.spec.mjs`, and findings here. A production tool is contingent on evidence that
this core can meet the brief; an unfinished pipeline will not become a shelf entry.

**Constraints:** Static ES modules, local user files, vendored permissively licensed dependencies,
8–60 photos, a 24-photo phone probe, honest rejection of unplaced photos, and unchanged Video to 3D
behavior. The acceptance thresholds remain six CC0/CC BY sets at median masked held-out SSIM ≥0.80;
exact-camera median rotation <2° and position <2% of scene size; first view ≤180 seconds; and the
existing phone resource limits. Raw evidence stays on `codex/photos-to-3d-clips`.

## Investigation tasks

1. Trace existing decoding, EXIF, pair scheduling, camera calibration, seed colors, training splits,
   preview, and disposal. Identify any dependency on capture order.
2. Build exact-correspondence controls for the camera solver. Test gauge alignment against known
   transformed poses and reject missing cameras instead of assigning guessed poses. These controls
   isolate geometry; they do not count as rendered synthetic photo sets.
3. Freeze a licensed real capture and its file hashes before probing sorted and shuffled orders.
   Record partial registrations and failures. Exercise the phone settings without dropping photos.
4. If the prerequisites hold, extend the independent core and its browser flow; otherwise write the
   clean negative report. State every unmeasured acceptance gate and the work that would remove each
   of the three principal blockers.
5. Run the diagnostic specs and required repository checks, merge current main, and open one draft
   PR. Keep photos, raw measurements, and screenshots out of the mergeable branch.

## Review focus

- Shuffled filenames must preserve source identity in every returned camera.
- A subset reconstruction cannot imply all input photos registered.
- Shared intrinsics must not silently stand in for different focal lengths.
- A held-out optimizer target alone does not prove exclusion from seed colors or image fitting.
- Software WebGPU, process RSS, and phone emulation cannot establish physical-phone performance.

## Round two: the Operator's October 17 review

The [review](https://github.com/ryanjosephkamp/splashery/pull/699#issuecomment-6232478489) correctly
distinguishes a core diagnostic from an attempted photo-specific implementation. The second round
therefore starts `src/photos3d/` and exercises it before drawing a task-level conclusion:

1. Merge current main, preserving both asset catalogs.
2. Add exhaustive unordered pairs, a verified graph, track conflict rejection, per-photo support,
   registration reasons, 960-pixel phone features, and 1,280–1,600-pixel desktop features. Import
   the existing SIFT and numeric primitives without changing Video to 3D or Splat.js.
3. Inspect each photo's EXIF, support one explicit lens group, and reject incompatible inputs.
   Normalize per-photo intrinsics for bundle adjustment; search the focal only under a recorded
   single-lens assumption when calibration is unavailable.
4. Remove held-out photos before sparse/surface appearance seeding and trainer setup. Verify the
   boundary with changed RGB and masks, including actual GPU parameter comparisons.
5. Freeze two additional independently licensed captures. Annotate evaluation masks from input
   photos without using a reconstruction or render. Run Buddha at 24 and 60 photos in both orders
   and profiles, then run a fresh appearance model for every registered leave-one-out camera.
6. Publish actual coverage, failures, fixed-step masked metrics, and the remaining six-set/device
   gates. Keep original photos out of git and all raw measurements on the evidence branch.

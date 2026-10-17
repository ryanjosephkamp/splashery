# Step inside a 360° photo: implementation plan

Codex (GPT-6), October 17, 2026. Implements `docs/codex/107-step-inside-360.md`.

The approved brief is a private, labs-only Studio panorama converter, independent of frozen Photo to
3D. All pipeline and recipe code lives in `src/pano3d/`; the catalog's pack path can already resolve
that folder without changing the player. Use the existing inside camera and rigid shell translation,
with the ordinary splat renderer.

- [ ] Test spherical projection, wrapped sampling, GPano crops, affine alignment, pole coverage,
      splat budgets, cancellation, and movement limits before implementing those interfaces.
- [ ] Implement six overlapping 110° perspective tiles. Estimate sequentially in a dedicated worker
      with the existing vendored engine; jointly fit inverse-depth scale and shift over overlaps,
      correct perspective depth to radial distance, and feather onto a periodic sphere.
- [ ] Build bounded spherical splats, with extra density toward the initial heading. Display an
      interactive constant-radius preview during inference. Read GPano metadata and reject partial
      captures rather than invent their missing pixels. Provide drag, opt-in tilt, lean, step,
      reset, estimated scale, stretch warnings, and worker cleanup on replacement or exit.
- [ ] Check two CC0 panorama sources on their live pages, record hashes and provenance, and prepare
      their depth with the same pipeline. Keep full evaluation inputs and outputs on the unmerged
      clips branch, never in the code branch.
- [ ] Generate truth locally using the existing Blender scene builder (task 105 is not on main).
      Compare actual model inference with one equirectangular run, evaluate scale-aligned AbsRel,
      δ1, overlap seams, and masked SSIM at 0.3 m and 0.8 m. Keep algorithm-only fixtures distinct.
- [ ] Record eight 390×844 browser clips and phone-profile latency and process-memory observations;
      distinguish emulation from physical-phone measurements. Do not assert an unmeasured gate.
- [ ] Run Classic golden tests, targeted browser tests, existing specs, formatting, American
      English, and preflight after merging current main. Open one draft PR with the five required
      sections.

Review focus: malformed/partial GPano; poles and longitude wrap; featureless or inconsistent depth;
an old worker finishing after replacement; moving through nearby geometry. Single-image depth has no
metric scale or unseen surfaces: show both limitations in the tool and report.

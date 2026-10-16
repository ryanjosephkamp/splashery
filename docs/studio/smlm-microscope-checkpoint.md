# Super-resolution microscope checkpoint, October 14, 2026

This preserves `smlm-microscope`, the labs-only Science viewer of individual localization events.
Later work must compare against this version, including its uncertainty widths and slice behavior,
using the preservation rule in [Photo to 3D](photo-3d-checkpoint.md).

## Where the checkpoint lives

| What                                                    | Where                                                                                                                                                                                     |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Whole repository                                        | `claude/checkpoint-toys-2026-10-14`                                                                                                                                                       |
| Immutable commit                                        | `41b21e74e04ccca178b95ac02b4e5dc0e51b4b45`                                                                                                                                                |
| Evidence commit                                         | `a7092650d344b2eb66b15f747acf37712ae7cf05` on `codex/toy-checkpoints-e-clips`                                                                                                             |
| Phone review clip                                       | [390×844 nucleus slice and restore](https://github.com/ryanjosephkamp/splashery/blob/a7092650d344b2eb66b15f747acf37712ae7cf05/docs/audits/toy-checkpoints-e/smlm-microscope-390x844.webm) |
| Method, raw measurements, inventory, and capture script | [Clips-branch evidence](https://github.com/ryanjosephkamp/splashery/tree/a7092650d344b2eb66b15f747acf37712ae7cf05/docs/audits/toy-checkpoints-e)                                          |

Never push to, rebase, or delete the checkpoint branch. Never merge the clips branch. The clip uses
the nucleus sample; the measurements below use the default microtubules-and-clathrin sample.

## How it works

`MICROSCOPE` in `src/packs/science.js` supplies the recipe. It opens one of six committed `.smlm`
samples or a visitor's `.smlm`, ZIP, CSV, or text localization table. It does not operate a real
microscope, fit camera images, or request a camera or microphone. Visitor files remain in memory on
the device; a shared scene cannot contain their bytes, so reopening the file is necessary.

1. `MICROSCOPE.prepare` loads a selected sample with `readAsset` and `readSmlm`, caching its parsed
   table by sample ID. `input.read` calls `readLocalizations` for a visitor file.
2. `src/science/smlm.js` reads a ZIP manifest and binary tables, or a ThunderSTORM-style CSV with
   `x` and `y` in nanometers. It handles optional `z`, lateral and axial precision, frame,
   intensity, and channel columns. It rejects declared coordinate units other than nanometers and
   caps a table at 8,000,000 localizations.
3. The reader's `finish` supplies missing lateral uncertainty as 20 nm and missing axial uncertainty
   as twice lateral uncertainty for a 3D table (equal for 2D). It reports missing information in
   notes. A missing `z` places the events in one plane.
4. `build` filters on lateral uncertainty, then uses deterministic `pickIndices` to fit the device
   budget. Coordinates are centered using sampled 1st/99th percentiles, converted from nanometers to
   micrometers, and optionally stretched along depth.
5. Each retained localization becomes one Gaussian and a dark plate provides the backdrop. Widths
   are `sqrt(2) * sigma`, matching the renderer's `exp(-r²/s²)` convention. Packed `SCI_TYPE.loc`
   parameters store true lateral and axial widths. `sciModifier` in `src/science/field.js` replaces
   the stored fallback width with those values on the GPU.
6. Color comes from depth (`turbo`), frame (`timeColor`), or channel. Opacity is clamped to
   `[0.05, 0.9]` around `base * (median_sigma / sigma) ** 2`, where base is 0.55 for 3D and 0.35 for
   2D. This approximates equal light per localization but is not exact after clamping, overlap, and
   the display-size floor.
7. `focusPoint` buckets drawn events into 250 nm XY cells, collects nearby depths, and chooses the
   most populated 100 nm depth bin. A tap narrows the GPU slice to approximately 100 nm on either
   side of that depth; another tap restores the full volume. The fade has a soft edge.

`gpuField` establishes the fitted coordinate transform; `MIC.unit` and `MIC.toy` convert between
recipe coordinates and rendered coordinates. `drive` sends the slice and minimum apparent size
through `out.glow` and `out.morph`. The shared camera can approach to `0.02` field radii, with near
clipping and close-up panning handled by the player/stage. The display floor is proportional to
camera distance (`0.0008`); the fallback buffer alone uses at least 30 nm wide spots, so a
non-labs/static fallback is not identical to the science modifier.

### Every recipe setting

| Key (default)                 | What it changes                                                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data` (`sample`)             | Six samples, or `custom` after opening a file. Parsed samples are reused in memory.                                                                                       |
| `color` (`depth`)             | Depth rainbow, frame/time ramp, or four repeating channel colors. A 2D file gets one warm color in depth mode.                                                            |
| `stretch` (`1`)               | True depth, or 4× depth. Both Z positions and axial widths stretch; lateral measurements do not.                                                                          |
| `precision` (`all`)           | All events, or lateral uncertainty strictly below 5 or 3 nm. An empty result raises a clear error. This is not a new reconstruction.                                      |
| `slice` control               | Tap toggles full depth versus a roughly 200 nm slice at the selected structure's depth; easing is 0.6 seconds.                                                            |
| Hidden `fileName`             | Records a display name, not localization bytes.                                                                                                                           |
| Shared Detail, zoom, and look | Detail changes how many events fit; pinch/scroll changes camera distance. Shared splat scale/exposure and the apparent-size floor affect displayed widths and brightness. |

The recipe is not continuously animated (`alive: false`). Motion comes from the camera and the slice
transition; individual fluorescent events are not animated molecules.

### Samples and scientific sources

Counts and dimensions here are from the shipped files and `MICROSCOPE_SAMPLES`. All six source
records' titles and CC BY 4.0 licenses were verified through Zenodo's API on October 14, 2026 (the
DOI landing pages returned HTTP 403).

| Sample ID        | Shipped events | File bytes | Source record opened                                                              |
| ---------------- | -------------: | ---------: | --------------------------------------------------------------------------------- |
| `sample`         |        170,401 |  2,363,699 | [Microtubules and clathrin in a Cos cell](https://zenodo.org/api/records/5507427) |
| `nucleus`        |        149,633 |  3,552,791 | [Zola-3D NUP full nucleus](https://zenodo.org/api/records/7233696)                |
| `pores`          |        126,566 |  1,045,769 | [Nuclear pore complex, WGA-ATTO520](https://zenodo.org/api/records/7182237)       |
| `actin`          |        174,903 |  1,542,829 | [Actin with PhalloidinAF647 in COS7](https://zenodo.org/api/records/5510661)      |
| `mitochondria`   |        219,846 |  1,866,314 | [TOM22 in COS7 cells](https://zenodo.org/api/records/5512636)                     |
| `microtubules3d` |        159,785 |  3,298,040 | [ZOLA-3D microtubules](https://zenodo.org/api/records/6861446)                    |

The default, nucleus, and `microtubules3d` files have Z columns; the other three are planar. The
samples are cropped or sampled subsets, not the full source records. The nucleus retains half the
source events. `tools/sci3-samples.mjs` assigns the planar pores, actin, and mitochondria sets
estimated dataset-wide lateral precisions of 11.5, 9.9, and 12.4 nm, respectively; these are not
event-by-event fitted uncertainties.

That estimation follows the nearest-neighbor idea described by
[Endesfelder et al., 2014](https://doi.org/10.1007/s00418-014-1192-3), whose abstract was opened:
the preparation tool fits distances between events in consecutive frames using
`p(d) = d / (2 sigma²) * exp(-d² / (4 sigma²))` plus unrelated-neighbor background.
[ThunderSTORM's project documentation](https://zitmen.github.io/thunderstorm/) was also opened and
identifies the localization analysis software. The viewer consumes localization results; it does not
rerun that analysis. Localization precision, event density, and final image resolution are different
quantities, and repeated blinks need not represent different molecules.

## The files that make it up

| Role                                      | Files                                                                                                                                                                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recipe and samples table                  | `src/packs/science.js` (`MICROSCOPE`, `microscopeState`, `MICROSCOPE_SAMPLES`)                                                                                                                                                                          |
| Reader and GPU modifier                   | `src/science/smlm.js`, `src/science/field.js`                                                                                                                                                                                                           |
| Other imports required by the shared pack | `src/packs/even.js`, `src/science/crystal.js`, `src/science/structures.js`, `src/science/symmetry.js`, `src/science/density.js`, `src/science/terrain.js`, `src/chem/elements.js`, `src/chem/molfile.js`                                                |
| Data and preparation                      | `assets/toys/smlm-microscope/`, `tools/sci-samples.mjs`, `tools/sci3-samples.mjs`                                                                                                                                                                       |
| Behavior tests                            | `tests/sci.spec.mjs` (readers, widths, filtering, budgets, lazy loading, and slice/zoom contract), `tests/sci3.spec.mjs` (new samples and NeNA), `tests/sci-engine.spec.mjs` (close-up camera/clip/pan), `tests/sci3-engine.spec.mjs` (sample selector) |

The common engine includes the shell (`src/app.js`, `src/ui.js`, `src/state.js`, and
`src/camera.js`) and `src/kit.js`, `src/generators.js`, `src/player.js`, `src/motion.js`,
`src/stage.js`, `src/effects.js`, `src/kernels.js`, `src/pc.js`, and vendored PlayCanvas 2.22.3. The
toy's registration, help, sound, metadata, and credits are entries in `src/toys.js`,
`src/toy-help.js`, `src/toy-sounds.js`, `src/site-toy-pages.js`, `tools/toy-plan.json`,
`tools/toy-dates.json`, `tools/assets.json`, and `CREDITS.md`. Keep those entries when restoring; do
not replace global lists wholesale.

## How to restore it

First fetch and verify the reference. An exact runnable baseline is a new worktree at the SHA:

```sh
git fetch origin claude/checkpoint-toys-2026-10-14:refs/remotes/origin/claude/checkpoint-toys-2026-10-14
git rev-parse origin/claude/checkpoint-toys-2026-10-14
# Must print 41b21e74e04ccca178b95ac02b4e5dc0e51b4b45.
git worktree add -b restore-smlm ../restore-smlm 41b21e74e04ccca178b95ac02b4e5dc0e51b4b45
```

A targeted restore on current `main`, after that check:

```sh
git fetch origin main
git switch -c restore-smlm-current origin/main
git checkout origin/claude/checkpoint-toys-2026-10-14 -- src/packs/science.js src/science src/packs/even.js src/chem/elements.js src/chem/molfile.js assets/toys/smlm-microscope tests/sci.spec.mjs tests/sci3.spec.mjs tests/sci-engine.spec.mjs tests/sci3-engine.spec.mjs tools/sci-samples.mjs tools/sci3-samples.mjs
```

The whole science pack is shared: this also restores implementation for Thermal ellipsoids, Galaxy
in a box, Cryo-EM map, Terrain in a box, and Contour lab. Check all six toys and their current asset
compatibility. `density.js` is also used by Powers of ten; the chemistry modules serve molecule
toys, and `even.js` serves many packs. Run the listed science specs and `pot` specs after this
restore, with `smoke`, `kit`, `unit`, scene compatibility, and embed checks if the common engine
must also be restored. A targeted checkout assumes compatible shared runtime files; use the exact
worktree if that cannot be established. Submit a draft restore PR.

## What it does best, measured limits, and later rounds

Measured on October 14, 2026, in Chromium 151.0.7922.173 with SwiftShader WebGL2, a 390×844
mobile/touch viewport, DPR 1, and `profile=low&adapt=off`. The stage canvas was 390×645 inside the
app UI. Each toy used a fresh context after app boot. Load time ends after `chooseToy`, any initial
chunk loading, and one captured frame. Rendering was measured over five seconds of requested frames
(camera turning except for the tilt-locked Powers of ten). These are single local-server,
software-renderer observations, not physical-phone FPS or internet load benchmarks. Video recording
was off during measurement.

| Load after selection | Observed asset bytes | Rendered FPS | Median / 95th-percentile frame interval |
| -------------------: | -------------------: | -----------: | --------------------------------------: |
|               1.04 s |            2,363,699 |          9.8 |                         96.8 / 139.3 ms |

The default retained all 170,401 events before display sampling and drew 82,740 localization splats
within an 84,000-splat kit including the plate. The 2,363,699 asset bytes are its default `.smlm`
file; the nucleus review clip uses a different dataset. No page errors or failed network requests
were recorded in this default-view run.

Its strength is letting the visitor zoom into real localization data while retaining per-event
uncertainty, channel/time views, and depth slicing. The actual low-tier recipe budget is 84,000
splats before its plate and safety allowance; the mid, high, and max targets are 196,000, 280,000,
and 392,000, subject to profile caps. `build` reserves 1.5% before sampling localizations. This
deliberately drops events on smaller budgets and must not be described as a complete count of
molecules on screen.

Limits: rendering floors, opacity clamps, and alpha blending change the visible Gaussian; missing
uncertainty is substituted; three samples use dataset-wide estimates; the slice's depth comes from a
capped local bucket, not an exact ray query; and 3/5 nm filtering empties many datasets. There is no
clustering, calibration, drift correction, or quantitative reconstruction. The code's `conserve`
display adjustment applies to the four newer samples, not all samples.

Later rounds should compare all six samples at both true and stretched depth, close zoom, slice/full
transitions, and missing-column files. Useful improvements are explicit uncertainty provenance in
the panel, a physical scale bar, and memory profiling for large local files. Keep the default's
structure and avoid presenting display sharpness as improved scientific resolution.

Keep a later change only if it is at least as good on every established measure, with the same
samples, settings, and device profile. Compare clips and rerun the behavior tests; a sharper still
alone does not establish an improvement.

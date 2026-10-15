# Galaxy in a box checkpoint, October 14, 2026

This preserves `galaxy-box`, the labs-only Science toy showing gas and simulated telescope views of
FIRE-2 snapshot subsets. Later work must compare against this baseline, following
[Photo to 3D's preservation rule](photo-3d-checkpoint.md).

## Where the checkpoint lives

| What                                               | Where                                                                                                                                                                                          |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Whole repository                                   | `claude/checkpoint-toys-2026-10-14`                                                                                                                                                            |
| Immutable commit                                   | `41b21e74e04ccca178b95ac02b4e5dc0e51b4b45`                                                                                                                                                     |
| Evidence commit                                    | `a7092650d344b2eb66b15f747acf37712ae7cf05` on `codex/toy-checkpoints-e-clips`                                                                                                                  |
| Phone review clip                                  | [390×844 hot-gas peel and telescope exposure](https://github.com/ryanjosephkamp/splashery/blob/a7092650d344b2eb66b15f747acf37712ae7cf05/docs/audits/toy-checkpoints-e/galaxy-box-390x844.webm) |
| Method, raw results, inventory, and capture script | [Clips-branch evidence](https://github.com/ryanjosephkamp/splashery/tree/a7092650d344b2eb66b15f747acf37712ae7cf05/docs/audits/toy-checkpoints-e)                                               |

Never push to, rebase, or delete the checkpoint branch. Never merge the clips branch. This is a
visualization of saved simulation data; it neither observes the sky nor evolves a galaxy in the
browser. It has no file input, camera, microphone, or live feed.

## How it works

`GALAXY` in `src/packs/science.js` supplies two views. `prepare` loads gas through `readGalaxy` and
loads stars through `readStars` only when the telescope view is chosen. Parsed data is cached by
galaxy ID. Both formats have a JSON header followed by quantized binary arrays: positions are signed
16-bit coordinates relative to the box, gas smoothing radii and logarithmic temperatures are
unsigned 16-bit values, and star ages and masses are logarithmically encoded.

The saved files contain these subsets; sizes below are the code/file headers' adopted boxes:

| Choice (`galaxy`) | Snapshot        | Box X/Z width | Gas particles | Star particles |     Gas / stars bytes |
| ----------------- | --------------- | ------------: | ------------: | -------------: | --------------------: |
| `m12i` (default)  | 600, redshift 0 |        40 kpc |       300,000 |        250,000 | 3,000,852 / 2,500,712 |
| `m12i-z2`         | 172, redshift 2 |        24 kpc |       300,000 |        250,000 | 3,000,792 / 2,500,752 |
| `m11h`            | 600, redshift 0 |        16 kpc |       300,000 |        250,000 | 3,000,768 / 2,500,728 |

The first box has a vertical half-extent of 6 kpc; the other two use their horizontal half-extent
vertically too. `tools/sci-galaxy.mjs` and `tools/sci3-galaxy.mjs` prepare these files from the
public release, center the boxes, align the disk, and retain dense gas plus a share of diffuse gas.
Source counts and preparation factors are preserved in each file's header. The current `m12i` header
counts 2,373,980 gas particles inside its box before the shipped subset; older help/credit text
rounds that differently.

### Gas view

`GALAXY.build` reserves approximately 3% of the kit budget for decoration. When a subset exceeds the
budget, it retains dense and diffuse groups separately, assigning about 35% of that budget to
diffuse gas where possible. `pickIndices` samples deterministically; each group's smoothing radius
widens by the cube root of its thinning ratio. The diffuse group also uses the file's `widenRest`
factor. This preserves visual coverage, not a new physical simulation.

Each gas particle's Gaussian has `sigma = KERNEL_SIGMA * h`, with `KERNEL_SIGMA = 0.274` and `h` the
support radius. The renderer receives `sqrt(2) * sigma`. Color follows a temperature ramp, or a
density proxy derived from `h`; brightness emphasizes dense gas. Opacity uses
`min(0.8, 0.8 * (0.07 / h)² * hot_factor)`, so broad diffuse particles are faint. Gas outside the
round disk of radius `0.96 * half` is omitted after budget selection. `galaxyState().drawn`
therefore counts selected particles, while `emitted` counts those actually emitted.

The box is a dark floor and twelve edges of splats. `drive` and `sciModifier` in
`src/science/field.js` fade hotter particles when the `peel` control increases: the transition uses
`smoothstep(4.1, 4.6, logT)`, so it is a soft temperature filter rather than a hard cut. The minimum
apparent splat scale is `0.0006` times camera distance. No gas positions move.

### Telescope view

`buildTelescope` draws star particles as simple stellar populations through a selected filter.
`starLight` adopts blue luminosity proportional to `mass * age^-1.0`, red to `mass * age^-0.6`, and
green to their geometric mean, with age floored at 0.003 Gyr. An `asinh` stretch about the sampled
median and 99.5th percentile maps brightness into display opacity; it is not a calibrated luminosity
model.

`TELESCOPE` places the view at an assumed 50 Mpc (`0.2425` kpc per arcsecond). The selected seeing
FWHM becomes `sigma = FWHM / 2.3548`, combined in quadrature with a small particle width. The build
gives approximately 78% of its budget to stars and 19% to dust. Dust is gas with `logT < 4.3` and
`h < 0.3` kpc, rendered as faint dark splats with stronger attenuation in blue than red. This is an
approximate opacity treatment, not radiative transfer.

`drive` starts a six-second exposure when the view opens and after each exposure-control toggle. The
GPU star opacity grows with exposure and applies a deterministic hash-based noise term whose
relative amplitude falls as `1 / sqrt(expected_photons)`. Its noise is a bounded approximation; it
does not sample a Poisson distribution or simulate a sensor. The hash seed is tied to each particle,
so a new exposure restarts the buildup rather than drawing an independent random image.

### Every setting and action

| Key (default)             | Effect                                                                                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `galaxy` (`m12i`)         | Present-day Milky Way-mass box, its younger snapshot, or the dwarf. Selecting another snapshot replaces the scene; no interpolation between times. |
| `view` (`gas`)            | Gas particles, or the explicitly simulated telescope view. Star data loads only for the latter.                                                    |
| `filter` (`color`)        | Color, blue-light grayscale, or red-light grayscale in telescope mode.                                                                             |
| `seeing` (`ground`)       | `space`: 0.1″, `ground`: 1″, or `poor`: 2.5″ FWHM. Affects telescope widths, not the gas view.                                                     |
| `color` (`temperature`)   | Temperature or smoothing-length density proxy in gas mode. Does not recolor telescope stars.                                                       |
| `box` (`true`)            | Gas-view floor and edges. The telescope has its own backdrop regardless of this switch.                                                            |
| Tap/Play                  | Gas mode toggles `peel` with 1.6-second easing; telescope mode starts another `expose` cycle.                                                      |
| Shared camera/Detail/look | Pinch/scroll can approach to `0.05` box radii. Detail changes particle budgets; shared splat scale and exposure affect appearance.                 |

The recipe is alive only while a telescope exposure is incomplete. Once settled, it renders on
demand; apparent motion in the clip comes from the filters and exposure, not galaxy dynamics.

### Scientific sources

[The FIRE data portal](https://flathub.flatironinstitute.org/fire) and
[Hopkins et al.'s FIRE-2 paper](https://arxiv.org/abs/1702.06148) were opened on October 14, 2026.
The paper identifies GIZMO and the simulation's physics; this toy is a visualization of their
outputs, not an implementation of that solver. `GALAXY_SAMPLES` and file headers preserve the
public-release attribution and CC BY 4.0 record.

[Bruzual and Charlot, 2003](https://arxiv.org/abs/astro-ph/0309134), also opened, describes stellar
population synthesis. It motivates the idea of age-dependent light; the two power laws above are
this toy's rough approximation, not the paper's fitted spectra. The Gaussian kernel matching,
thinning factors, color ramp, dust opacity, and noise approximation are code choices and should not
be presented as measured observational accuracy.

## The files that make it up

| Role                                          | Files                                                                                                                                                                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Recipe, readers, and population approximation | `src/packs/science.js` (`GALAXY`, `buildTelescope`, `readGalaxy`, `readStars`, `starLight`, `TELESCOPE`, and `galaxyState`)                                                                                        |
| GPU gas filtering and exposure                | `src/science/field.js` (`sciModifier`, gas/star types, GLSL, and WGSL)                                                                                                                                             |
| Other static imports of the science pack      | `src/science/`, `src/packs/even.js`, `src/chem/elements.js`, `src/chem/molfile.js`                                                                                                                                 |
| Shipped gas/star files and thumbnail          | `assets/toys/galaxy-box/`                                                                                                                                                                                          |
| Preparation/clip tools                        | `tools/sci-galaxy.mjs`, `tools/sci3-galaxy.mjs`, `tools/sci-clip.mjs`, `tools/sci3-clip.mjs`                                                                                                                       |
| Behavior tests                                | `tests/sci.spec.mjs` (kernel width, budgets, zoom/peel, and lazy loading), `tests/sci3.spec.mjs` (three galaxies, age/color relationship, PSF/filter/dust/exposure), `tests/sci-engine.spec.mjs` (close-up camera) |

Common engine files include the shell (`src/app.js`, `src/ui.js`, `src/state.js`, and
`src/camera.js`) and `src/kit.js`, `src/generators.js`, `src/player.js`, `src/motion.js`,
`src/stage.js`, `src/effects.js`, `src/kernels.js`, `src/pc.js`, and vendored PlayCanvas 2.22.3.
Global registration, help, sound, metadata, and credit records are in `src/toys.js`,
`src/toy-help.js`, `src/toy-sounds.js`, `src/site-toy-pages.js`, `tools/toy-plan.json`,
`tools/toy-dates.json`, `tools/assets.json`, and `CREDITS.md`. Preserve the toy's own entries
selectively rather than restoring every toy's metadata.

## How to restore it

An exact baseline is a separate worktree at the saved commit:

```sh
git fetch origin claude/checkpoint-toys-2026-10-14:refs/remotes/origin/claude/checkpoint-toys-2026-10-14
git rev-parse origin/claude/checkpoint-toys-2026-10-14
# Must print 41b21e74e04ccca178b95ac02b4e5dc0e51b4b45.
git worktree add -b restore-galaxy-box ../restore-galaxy-box 41b21e74e04ccca178b95ac02b4e5dc0e51b4b45
```

A targeted checkout after the same SHA check:

```sh
git fetch origin main
git switch -c restore-galaxy-box-current origin/main
git checkout origin/claude/checkpoint-toys-2026-10-14 -- src/packs/science.js src/science src/packs/even.js src/chem/elements.js src/chem/molfile.js assets/toys/galaxy-box tests/sci.spec.mjs tests/sci3.spec.mjs tests/sci-engine.spec.mjs tests/sci3-engine.spec.mjs tools/sci-galaxy.mjs tools/sci3-galaxy.mjs tools/sci-clip.mjs tools/sci3-clip.mjs
```

Restoring the whole science pack changes the microscope, Thermal ellipsoids, Cryo-EM map, Terrain in
a box, and Contour lab too. Check each against its current data and run the science specs; Powers of
ten also uses `src/science/density.js`, and the chemistry/even helpers have wider users. The
targeted command assumes compatible common-engine files. If those changed, compare them with the
checkpoint, test affected toys and embeds, and use the full worktree when exactness is needed.
Submit a draft PR; do not merge a restore directly.

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
|               0.95 s |            3,053,981 |         13.2 |                         78.3 / 141.2 ms |

The default gas build selected 58,200 particles and emitted 56,707 after its disk crop, in a
58,507-splat kit including the box. Observed asset responses totaled 3,053,981 bytes: the
3,000,852-byte gas file and a 53,129-byte background flags metadata request from the app. No star
file was loaded for this measurement; the telescope portion of the clip loads it separately. No page
errors or failed network requests were recorded in this default-view run.

The strongest features are the distinction between hot diffuse gas and dense structure, the visible
temperature peel, and the telescope's changing seeing, filters, and exposure. Low-tier gas rendering
starts from a 60,000-splat kit budget, whereas the file holds 300,000 gas particles. Counts,
widening, and the disk crop must remain explicit when comparing detail.

Limits: positions are quantized; datasets are already subsets; rendering thins them again; Gaussian
kernels replace compact simulation kernels; brightness/opacity are illustrative; the telescope has
no spectra, metallicity fit, cosmological dimming, or calibrated detector; and the exposure's noise
is repeatable. Overlapping transparent gas is expensive to render.

Later rounds should compare all three gas scenes, peel on/off, all three filters, all seeing
choices, and the full six-second exposure at the same profile. Improvements could add independent
noise realizations, a clearer legend for physical versus display quantities, and measured memory and
overdraw costs. Preserve the explicit simulation labels and the existing sharp dense structure.

Keep a later change only if it is at least as good on every established measure, with the same
samples, settings, and device profile. Compare clips and rerun the behavior tests; a sharper still
alone does not establish an improvement.

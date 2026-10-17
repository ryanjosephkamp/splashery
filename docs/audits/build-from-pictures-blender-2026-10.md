# Build from pictures with Blender

Codex (GPT-6), October 17, 2026. Rule check: none.

Codex built the opt-in Blender installer, agent modeling kit, budgeted render/score loop, GLB and
splat exports, rigid moving parts, local tap viewer, and motion capture tool. The code PR contains
new tools, documentation, and tests. The site, engine, shared lists, and existing toys are
unchanged. Original generated geometry and splats are CC0, made by Ryan with Codex (GPT-6); original
code is MIT.

The three blind packs are the lantern, alarm clock, and rubber duck. The chess set is an auxiliary
example: a setup probe printed its source object names and dimensions before modeling. It is
excluded from the gate. A separate original cabinet-and-chair showcase demonstrates wood, fabric, a
sliding drawer, an edge-hinged door, and a swivel seat. Its reference comes from the same script, so
it is explicitly excluded from reconstruction measurements.

## Results and evidence

The
[evidence branch](https://github.com/ryanjosephkamp/splashery/tree/codex/build-from-pictures-blender-clips/docs/evidence/refblend-2026-10)
contains packs, source/hash/credit records, scorer truth meshes in a separate folder, model scripts,
all budget scores and renders, the good GLB/PLY results, phone and desktop parts, screenshots, and
1080-pixel clips. Native `.blend` files and intermediate runs remain outside git.

Use `results/<id>/good` for task 113's toy integration. Copy its `result.json`, the selected tier's
static PLY and part PLY files, and the credit. Load static plus moving parts; do not also load the
assembled PLY. Bind each part's pivot and motion in the same normalized Y-up coordinates. The
[playbook](../studio/build-from-pictures-blender.md) documents the commands and complete interfaces.

The [lantern](https://polyhaven.com/a/Lantern_01) is by Rajil Jose Macatangay; the
[alarm clock](https://polyhaven.com/a/alarm_clock_01) is by Yann Kervran and James Ray Cock; the
[rubber duck](https://polyhaven.com/a/rubber_duck_toy) is by Plat251; the
[chess set](https://polyhaven.com/a/chess_set) is by Riley Queen. All four are existing CC0 entries
in `tools/models.json`. Their live source pages and the
[CC0 license page](https://polyhaven.com/license) were opened on October 17, 2026. Each pack has
four calibrated product-photo views and explicit foreground masks. Public dimensions normalize the
largest dimension to one meter. No store pictures were used or published.

## Measurement

Every budget uses a 256-pixel score grid. Draft, good, and best use 4, 16, and 64 Cycles samples;
base-color bakes use 64, 256, and 512 pixels. Benchmark caps are 5, 30, and 120 minutes. The
measured command time includes modeling-script execution, rendering, baking, conversion at both
budgets, and 2D scoring. Independent truth scoring and clip capture are verification outside that
command. Approximate authoring windows, including interleaved work, were 5 minutes for the lantern,
22 minutes for the clock, and 4 minutes for the duck; there was no per-edit timer.

Silhouette values below are the mean of the pack's four IoUs, reported as a percentage. Volume
values use a 128-cell grid over the joint bounds, with no fitting, rescaling, or registration. The
volume scorer unions objects and uses three oriented ray-winding tests. Tests cover identical and
shifted cubes, overlapping solids within a joined mesh, and a hollow cavity. These are voxel
estimates: open surfaces, inconsistent winding, and thin walls limit the measure.

| Pack                  | Budget | Silhouette IoU (%) | Volume IoU | Command (s) | Mean render (s) |
| --------------------- | ------ | -----------------: | ---------: | ----------: | --------------: |
| lantern               | draft  |              83.13 |     0.6032 |        4.96 |           0.057 |
| lantern               | good   |              86.50 |     0.6362 |        6.46 |           0.180 |
| lantern               | best   |              86.58 |     0.6362 |       16.39 |           1.172 |
| alarm-clock           | draft  |              89.79 |     0.7977 |        7.46 |           0.158 |
| alarm-clock           | good   |              90.46 |     0.7776 |        6.84 |           0.256 |
| alarm-clock           | best   |              90.48 |     0.7775 |       11.44 |           0.892 |
| rubber-duck-real      | draft  |              94.71 |     0.9126 |        5.49 |           0.101 |
| rubber-duck-real      | good   |              94.77 |     0.9104 |        7.06 |           0.398 |
| rubber-duck-real      | best   |              94.22 |     0.9035 |       18.84 |           1.301 |
| chess-set (auxiliary) | draft  |              91.83 |     0.9434 |       17.21 |           0.164 |
| chess-set (auxiliary) | good   |              92.40 |     0.9434 |       47.86 |           0.740 |
| chess-set (auxiliary) | best   |              92.31 |     0.9434 |       59.90 |           1.285 |

The three blind packs' good median is **90.46% silhouette IoU** and **77.76% volume IoU**. Draft
medians are 89.79% and 79.77%; best medians are 90.48% and 77.75%. The good medians exceed 90% and
70%; the lantern individually misses both.

The good gate is evaluated on the median of the three blind packs. The lantern remains below both
individual thresholds, so the median must not be read as a claim that every reconstruction passes.
The full color, boundary, edge, and Chamfer scores await task 113's scorer. Cameras here are known;
this does not demonstrate fitting cameras for unknown product photos.

The same final good script was run twice per pack. The repeatability file records every per-view
score delta and the maximum; the required tolerance is 0.5 points. More rendering samples or more
geometry do not guarantee a better silhouette: the duck's best attempt adds wing volumes that
slightly overshoot the reference contour.

## What required visual judgment

- Lantern: the carry-handle curve, cage bends, chimney profile, glass wall thickness, and roughness.
  Replacing a filled globe and chimney with hollow profiles improved the volume estimate. Sparse
  views do not reveal the wall thickness; the glass is an opaque surface in the splat toy.
- Clock: the body depth, bell size and tilt, feet, rear plate, and hinge location. The side view and
  volume feedback exposed an overdeep case; moving the rim and rear details instead preserved the
  silhouette while improving the volume overlap. The reconstruction omits dial hands and numerals;
  silhouette and volume scores do not validate those missing surface details.
- Duck: a broad flat base, head depth, bill position, tapered tail, eye placement, and sampled color
  patches. The side silhouette exposed the first body's excessive rounding near the base.
- Chess set, auxiliary: piece profiles, rank spacing, and the board. Knights remain generic turned
  shapes. Its setup-probe exposure prevents a claim of blind reconstruction.

Colors can be sampled from the pictures and converted from sRGB to linear material values. The kit
provides procedural wood, fabric, metal, plastic, glass, and stone. Base color is baked through
emission, so metallic and transmissive materials do not become black during a diffuse-only bake. GLB
preserves roughness and metallic factors. Clip review caught overlapping primitive UVs inside joined
parts: a duck head became black and a chair lost its fabric color. A separate bake atlas fixes both;
a regression samples the actual red and blue splats from two joined pieces. All presets and clips
were regenerated. Exact oriented-triangle and silhouette comparisons confirm that this UV correction
leaves the geometry measurements unchanged. Splats retain baked base color and the existing
converter's soft light; they do not preserve transmission, specular reflections, sheen, or bump.

## Cloud cost

[Blender 4.5.3 LTS](https://download.blender.org/release/Blender4.5/blender-4.5.3.sha256) was
installed in 25 seconds, including download, SHA-256 verification, and extraction. Its unpacked
directory used 1,157,576 KiB (about 1.10 GiB); the retained archive used 368,556 KiB (about 0.35
GiB). The official checksum list was opened and compared to the embedded pin. Blender's
[GPL license](https://www.blender.org/about/license/) was checked; the existing Blender 4.5 LTS
entry in `LICENSES.md` covers the build tool. It is never shipped.

The CPU renderer uses four threads, seed 1, fixed samples, and no denoising or adaptive sampling.
`cameras.json` records seconds for every frame. Timings in the table are observed cloud costs, with
other verification running concurrently, rather than an isolated hardware benchmark. Export,
base-color baking, and surface sampling often cost more than the four small renders.

EEVEE did not finish a 64-pixel probe within 60 seconds and logged `EGL_BAD_MATCH`. The supervisor
terminated it. No benchmark or deliverable depends on EEVEE; all use Cycles on CPU.

The phone budget is 90,000 splats and desktop is 300,000, from the existing converter's tier
constants. Actual emitted counts and file sizes are in the result manifests and evidence summary.
The animated viewer loads only static plus parts. Raw desktop PLYs are about 20 MB; these are build
artifacts, and task 113 can use the existing asset packing workflow before shipping them.

## Verification and limits

Focused tests cover schema 1 packs/results, unsafe paths and symlinks, explicit installation,
checksum failure, rigid motion, shared-coordinate splats, extra registered geometry, script
provenance during edits, photo-color gamma, closed curved/cushion geometry, shared truth meshes,
caller-supplied license-check dates, and termination of a looping model within its hard budget.
Blender-specific tests say so in their names; other tests run without Blender.

Clips capture the actual local PlayCanvas renderer, at 1080 by 1080 pixels, 30 fps, and 60 frames.
The viewer uses one entity transform per moving piece, with no soft regions or per-point bending.
Clip JSON records browser errors, dimensions, and an internal-distance check. Screenshots cover 390
by 844 and 1440 by 900 pixels. The showcase has three separate rigid groups and an actual cabinet
interior.

The independent review found and corrected omitted extra registered geometry, a provenance hash that
could follow a later source edit, coerced IDs, logical-path cache checks, sampled-color gamma,
shared truth mesh mutation, and capture controls hidden before a click. Regression checks exercise
the corrected cases.

The final focused suite passed with Blender (15 tests) and without Blender (11 tests, with four
Blender-only skips), including the joined-color regression. After fetching and merging main,
`SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/preflight.mjs --quick` passed all six checks, and
`SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/preflight.mjs` passed all checks and **271 tests in
11.9 minutes**. Formatting, American English, generated-site consistency, shared-list parsing, and
file sizes all passed.

An earlier full run, concurrent with evidence work, failed formatting during an active test edit and
two existing UI checks: the About text at 1440 by 900 (`tests/hta.spec.mjs`) and the surface-plotter
slider (`tests/shb.spec.mjs`). Formatting was corrected; both UI checks passed individually and in
the final full run. No site code, test expectations, or test baselines were changed. Generated
screenshots were restored after verification. Independent review found no important remaining issue
in the final bake-atlas and viewport-resize changes.

The remaining practical limits are the missing task 113 full scorer and camera fitting, uncertain
thin-wall geometry in the lantern, and material effects that opaque splats cannot represent. No site
toy was registered because task 113 owns that integration. No engine hook, shared-list edit, private
picture publication, extra runtime dependency, or model-weight download was introduced.

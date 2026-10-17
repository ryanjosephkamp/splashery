# Build from pictures: kit builder result

October 17, 2026. Made by Ryan with Codex (GPT-6).

**Outcome: a clean negative result against task 113's quality gates.** The context-pack tools,
real-renderer scorer, kit builder, five CC0 truth packs, playbook, and labs toy are implemented. The
good run's median silhouette IoU is **0.834**, below 0.85. Croissant and lantern volume IoU are
**0.582** and **0.259**, below 0.6. The labs toy exposes these actual approximations; this report
does not claim that they meet the visual quality bar.

## Measured results

[Machine-readable measurements](../../tools/refpack-samples/benchmark.json) include every view, all
three budgets, repeatability, and explicit failed gates. Good result folders retain their first
score; the independent repeat is recorded separately. Inputs and true cameras are beside each pack,
while the builder receives a separate copy containing only pack.json, pictures, and masks. Its
internal real-renderer refinement disables truth access.

| Object      | Quality and budget | Actual build minutes | Score / 100 | Silhouette IoU | Volume IoU |
| ----------- | ------------------ | -------------------: | ----------: | -------------: | ---------: |
| Duck        | draft (2 min cap)  |                 0.10 |       63.77 |          0.794 |      0.745 |
| Croissant   | draft (2 min cap)  |                 0.08 |       67.36 |          0.810 |      0.602 |
| Pomegranate | draft (2 min cap)  |                 0.10 |       81.81 |          0.921 |      0.873 |
| Cake        | draft (2 min cap)  |                 0.10 |       72.92 |          0.889 |      0.760 |
| Lantern     | draft (2 min cap)  |                 0.14 |       36.69 |          0.554 |      0.243 |
| Duck        | good (30 min cap)  |                 0.92 |       67.51 |          0.834 |      0.684 |
| Croissant   | good (30 min cap)  |                 0.36 |       67.03 |          0.811 |      0.582 |
| Pomegranate | good (30 min cap)  |                 0.38 |       89.70 |          0.951 |      0.833 |
| Cake        | good (30 min cap)  |                 0.37 |       73.42 |          0.896 |      0.743 |
| Lantern     | good (30 min cap)  |                 0.65 |       46.35 |          0.652 |      0.259 |
| Duck        | best (120 min cap) |                 3.32 |       76.77 |          0.891 |      0.558 |
| Croissant   | best (120 min cap) |                 1.83 |       75.60 |          0.883 |      0.617 |
| Pomegranate | best (120 min cap) |                 1.07 |       91.86 |          0.960 |      0.929 |
| Cake        | best (120 min cap) |                 1.33 |       79.61 |          0.937 |      0.739 |
| Lantern     | best (120 min cap) |                 2.08 |       63.69 |          0.799 |      0.252 |

| Quality | Median silhouette IoU | Median volume IoU | Lowest volume IoU |
| ------- | --------------------: | ----------------: | ----------------: |
| draft   |                 0.810 |             0.745 |             0.243 |
| good    |                 0.834 |             0.684 |             0.259 |
| best    |                 0.891 |             0.617 |             0.252 |

Caps are 2, 30, and 120 minutes, not the time consumed. Runs stop at convergence or their configured
search limits: 60/400/1,800 proxy evaluations and 2/8/20 real-render checks. They took roughly
0.1–3.3 minutes each, with browser and other checks sharing this four-core environment. This tests
the implemented automatic loop within those caps; it does not establish that 30 minutes of manual
part modeling cannot pass. Increasing the search budget improved picture fits without consistently
improving the 3D shape.

The five source models already appear in tools/models.json, which lists no CC0 furniture. These are
simplified, opaque, per-triangle-color derivatives of the duck, croissant, pomegranate, carrot cake,
and lantern, not unmodified photoreal assets. Each has five plain-background views, one busy
background, and supplied masks. These synthetic tests isolate fitting from difficult segmentation;
they do not establish performance on real store photographs. All committed packs are below 3 MB, and
every generated splat file is below 1 MB.

## The three blockers actually encountered

1. **Automatic part discovery and shape fitting are still too coarse.** A single lathe cannot
   express the lantern's openings. Intersecting public masks and expressing the volume as kit
   extrusions helped, but the good lantern is still 0.652 silhouette / 0.259 volume, and best is
   0.799 / 0.252. Row strips retain openings visible from the front, but cannot infer hidden
   cavities, fine handles, or semantic articulations reliably. Multiple moving parts require a
   hand-authored initial model. Flat median part colors also lose details and make a symmetric
   spinning object harder to read. Better decomposition and material reconstruction remain needed.
2. **Silhouette camera fitting leaves depth and scale ambiguous.** The duck improves from 0.834
   silhouette / 0.684 volume at good to 0.891 / 0.558 at best. That is a measured case where more
   successful picture fitting produces a worse 3D match. Cameras are re-estimated from every
   candidate, not taken from truth. Dimensions initialize proportions; the fit can drift within that
   shared frame. Stronger geometric priors, dimension constraints, and agent edits of the worst view
   are needed before the automatic loop can be trusted as a reconstruction method.
3. **Some compact truth meshes do not define a clean solid volume.** After welding positions at 1e-5
   model units, the lantern has 184 boundary edges and 542 edges with more than two incident
   triangles. The pomegranate and cake also have boundary/nonmanifold edges; the duck and croissant
   are closed by this diagnostic. The scorer uses three-axis ray parity on a 40³ grid, so volume on
   those open meshes is approximate. It retains the low scores and the warning; it does not treat
   uncertainty as a passed gate. Watertight truth solids or independently validated occupancy are
   needed for a stronger volume benchmark.

## Scorer checks

The known open-legged chair scores **89.52/100**; a deliberately wrong solid box scores
**50.64/100**, a 47-point gap. The chair's repeated score differs by **0.000 points**. The larger
pomegranate result repeats from **89.704** to **90.109**, a **0.405-point** delta, inside the
0.5-point gate. CIEDE2000 matched all 34 published reference pairs within 0.00005 ΔE in a separate
numerical check; the committed regression includes representative pairs and checks grayscale/hue
edge cases.

Measurements use Chromium, the real Splashery Stage, vendored PlayCanvas 2.22.3, WebGL2, and
SwiftShader. Scores use six 192-pixel views, camera fitting from view hints, one scalar exposure
match across all overlaps in linear light, silhouette IoU, two-pixel boundary F1, CIEDE2000, and
Sobel edge recall. Chamfer is a deterministic sampled symmetric mean Euclidean distance; no ICP or
truth-camera alignment is applied. A PLY-only result reports unavailable volume.

## Verification and motion evidence

- The final new browser suite passed all **16 tests**, including the known pair, pack validation,
  rigid part transforms, CC0 hashes and size limits, and opening, selecting, tapping, and opening
  About with all 30 reference pictures at 390×844 and 1440×900.
- Commands: `SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test tests/cdx-refpack*.spec.mjs`
  (the persistent test server used port 4180), `node tools/check-packs.mjs built-from-pictures`,
  `node tools/us-english.mjs --diff`, and the required full preflight after merging origin/main.
- **Preflight passed: all 272 shelf-wide tests (5.1 minutes)**, plus the format, American English,
  site, shared-list, and file-size checks, after merging origin/main at cad2c4479. No test was
  loosened or skipped.
- All five effects were captured with
  `node tools/effect-clip.mjs <dir> --mp4 --size=1080 --fps=30 --opt=object=<id> built-from-pictures:2.4`.
  FFprobe verifies 1080×1080, 30 fps, and 85 frames per clip (2.833 seconds including the pre-roll).
  Captures use the repository's Mesa llvmpipe path on Xvfb. Full-resolution frames at the start,
  middle, and end were inspected; tests verify that each surface belongs to a rigid part and that
  every pulse returns to rest. The clips show the remaining coarse outlines and flat materials,
  rather than hiding them in small previews.
- [Motion clips, comparison reports, and review stills](https://github.com/ryanjosephkamp/splashery/tree/codex/build-from-pictures-clips)
  stay on the separate clips branch. The code PR contains the required reference inputs, the
  measured good builds, and the shipped shelf thumbnail, with no private pictures or raw reports.

The only engine hook is the small **Engine: add optional local reference galleries to toy About
text** commit, with tests/cdx-refpack-about.spec.mjs. No existing pack, kit, player, app, stage, or
effects code changed. The catalog, help, sounds, plan, and date changes belong only to this toy. The
build-time tools reuse existing dependencies; no segmenter weights or remote inference ship.

## What remains

The [playbook](../studio/build-from-pictures.md) describes the public schema-1 pack/result/score
contracts, private-input handling, manual part naming, report inspection, and the iterative loop.
The toolkit is ready for task 114 to use with its independent Blender builder. The kit's failed
quality gates, flat materials, and approximate open-mesh volume scores remain explicit. Automatic
semantic articulation, texture reconstruction, and a stronger solid-volume truth set were cut. The
toy remains behind labs, and the PR remains a draft.

Rule check: none.

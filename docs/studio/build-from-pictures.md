# Build a toy from pictures

This is the schema-1 interface shared by the kit builder and the Blender builder. The tools run at
build time; the finished toy remains a static, local-browser kit recipe. Made by Ryan with Codex
(GPT-6), October 17, 2026. Code is MIT; original procedural assets are CC0. Private source pictures
and their derived results remain private.

## Run the loop

1. **Read the pictures yourself.** Identify the front, the silhouette, the materials, the holes, and
   the separate solid parts. Ask for another view only if an important hidden surface cannot be
   inferred. A single photograph does not establish the back or the depth. Treat dimensions as
   evidence only when their source is known.
2. **Make a private context pack.** Run
   `node tools/refpack.mjs new photo-front.jpg photo-side.png --out=.cache/refpacks/my-object`. This
   asks nothing, converts pictures to PNG, sets unknown view hints, and defaults to private. Edit
   `pack.json`: give it a useful name, mark views, add dimensions and notes, name the moving parts,
   and set the budget. Run `node tools/refpack.mjs check .cache/refpacks/my-object`.
3. **Inspect the masks.** `node tools/refpack.mjs mask .cache/refpacks/my-object` makes missing
   masks. The tool uses alpha when available, otherwise border-color segmentation with conservative
   edge cleanup of isolated color noise. It uses no downloaded model, segmenter, or weights. It
   prints REVIEW REQUIRED for an unreliable border or implausible coverage. Look at every mask;
   correct a busy background, reflections, shadows, and foreground colors that match the background
   by hand. White is foreground; black is background. Supplied masks must have the same dimensions
   as their pictures. Scoring can also make temporary masks without changing the pack; its report
   displays them and flags review needs.
4. **Build.** Run
   `SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/refbuild-kit.mjs .cache/refpacks/my-object --minutes=30`.
   The default output is `.cache/refbuild/<id>/<quality>/`. Choose a fresh `--out=folder` for each
   iteration. The builder considers all seven shape families, reads a front-facing outline for
   lathes and extrusions, and can intersect multiple masks into a visual hull made of extruded kit
   outlines. It optimizes geometry, re-estimates cameras, samples part colors, and then refines
   dimensions with the real GSplat scorer. That internal scorer has truth access disabled.
5. **Score.** Run
   `SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/refpack-score.mjs .cache/refpacks/my-object .cache/refbuild/my-object/good`.
   No running site server is needed: the scorer starts a temporary loopback renderer. Open the
   result's `report.html` locally. Each row shows the reference, the mask, a render from the fitted
   camera, and the difference. Pink means missing geometry; blue means extra geometry; red means
   color error in the overlap. `score.json` contains the measurements and the estimated cameras.
6. **Fix the worst picture.** Find the lowest per-picture silhouette IoU, then inspect that row. Fix
   a wrong mask before changing geometry. Correct a view hint when the object is facing the wrong
   way. Split a solid into separate parts when a single outline fills a real opening. Use a
   data-only initial model when the automatic approximation cannot express the object. Rebuild with
   `--init=<model.json>`, score again, and compare the worst view as well as the average.
7. **Stop at the gate or the budget.** Draft uses up to 60 proxy evaluations and two real-render
   checks; good uses 400 and eight; best uses 1,800 and 20. Convergence can stop a run sooner. These
   are search limits, not promises that every minute will be consumed. The smaller of `--minutes`
   and `budget.minutes` is the cap. The CLI has a wall-clock watchdog (exit 124), keeps a checkpoint
   before real-render refinement, and reserves time for final output. A checkpoint is not a
   completed build. Check `status`, `withinBudget`, and the measured `minutes` in result.json. Use
   the remaining project budget for inspection and targeted edits. For best runs lasting hours,
   explicitly increase the pack's minutes cap first. Never advertise a failed gate as a success.
8. **Review the animation and package.** Import the generated `RECIPES` into an authorized pack,
   preserving its helper at `src/refbuild/shapes.js`. For private work, keep the recipe and its
   pictures outside the public catalog. Open it at phone and desktop sizes, select every option, and
   tap. Capture each effect with
   `node tools/effect-clip.mjs .cache/refbuild-clips --mp4 --size=1080 --fps=30 <toy>:2.4`. Each
   named part must move rigidly and return to rest. Keep clips, rendered reports, and raw evidence
   outside git or on the task's clips branch. Add only approved, license-clean assets.

## Context-pack contract

The folder contains `pack.json` and its referenced files. This is the schema-1 format; do not rename
fields to match a particular builder:

```json
{
  "schema": 1,
  "id": "oak-side-chair",
  "name": "Oak side chair",
  "images": [
    { "file": "images/01.jpg", "view": "front" },
    { "file": "images/02.jpg", "view": "three-quarter", "mask": "images/02-mask.png" }
  ],
  "size": { "width": 0.45, "depth": 0.52, "height": 0.82, "units": "m", "source": "listing" },
  "notes": "Solid oak, four straight legs, a slatted back, and a woven seat.",
  "parts": [{ "name": "seat", "material": "woven rush" }],
  "moves": [{ "part": "seat", "how": "spin", "axis": "y", "amount": 360 }],
  "budget": { "minutes": 30, "quality": "good" },
  "license": { "images": "private", "source": "https://example.com/reference" }
}
```

`size`, `notes`, `parts`, and `moves` are optional. Views are front, back, left, right, top,
three-quarter, detail, or unknown. Units are m, cm, mm, in, or ft; dimensions supply proportions.
Paths must be relative and stay inside the pack, including symlink resolution. Supported images are
PNG and JPEG. Part names are nonempty, file-safe strings; readable names such as "Seat cushion" and
slugs both work. There are at most 15 moving parts. Motions are slide, hinge, spin, bounce, or
wobble, with an x, y, or z axis. Angular amounts are degrees; translation amounts are in the
builder's normalized coordinates (AABB diagonal 2). A full spin should use a multiple of 360 degrees
so the pulse ends at rest.

Private means the entire pack, its derived results, its masks, and reports stay out of git and the
site. A store's public URL does not grant redistribution rights. Committable pictures must be CC0,
the owner's own, or renders from CC0 models, with checked source records. `refpack new` always
defaults to private. The toy publisher is deliberately limited to the five named CC0 fixtures.

## Give the builder a useful starting model

An agent names articulated parts by reading the pictures. The tool does not infer a hinge's
mechanical construction or reliably separate every material automatically. For multiple moving
parts, provide `--init=model.json`. This is JSON, never executable code. All shape positions and
sizes share Y-up, +Z-front coordinates centered on the object; normalize the whole object's AABB
diagonal to 2. A minimal example is:

```json
{
  "schema": 1,
  "shapes": [
    {
      "type": "box",
      "size": [1, 0.15, 0.8],
      "pos": [0, 0, 0],
      "rot": [0, 0, 0],
      "color": [0.55, 0.32, 0.14],
      "part": "seat"
    }
  ],
  "moves": [{ "part": "seat", "pivot": [0, 0, 0] }]
}
```

Types are box, rounded-box, cylinder, cone, sphere, lathe, and extrusion. Sphere sizes are full
ellipsoid diameters. Cylinder and cone sizes allow elliptical cross sections; cones accept bottom
and top radii relative to those sizes. Lathe `profile` is an array of `[radius, y]` points, normally
within `[0, 0.5] × [-0.5, 0.5]`. Extrusion `outline` is a bottom-to-top array of `[left, right, y]`
rows in normalized local coordinates. Multiple extrusions preserve openings. `rot` is X/Y/Z Euler
degrees; `color` is sRGB from 0 to 1. A shape's `part` assigns the entire surface to that rigid
piece. The pack's requested motions override motion settings in the initial model; initial pivots
are retained. Unseen colors and depth remain estimates.

## Result and score contracts

A result contains `result.json` with `schema: 1`, `pack: <id>`, `builder: "kit"`, and measured
`minutes`, plus `result.ply` and/or `result.glb`. The kit builder writes both, a data-only
`model.json`, and an importable `recipe.mjs` with `RECIPES`. Animated results additionally contain
`parts/<name>.ply`; result.json's `parts` array records each name, file, pivot, and
`motion: { how, axis, amount }`. All part files retain the complete model's coordinate frame. Other
builders may add their own metadata while retaining these common fields.

The scorer accepts a PLY-only or a GLB-only result as well as both. A GLB-only result is converted
to splats with the existing model converter's sampling, preserving its coordinates. Orient and
normalize Blender output to the same frame as the kit. When both files exist, the PLY is rendered
and the GLB supplies the 3D surface; they must represent the same geometry. The kit's smooth lathe
and rounded surfaces have a tessellated companion mesh, so a small discretization error remains.

`score.json` has schema, pack, builder, renderer, size, exposure, weights, pictures, overall, and
warnings. Picture entries retain file, view, fitted camera, mask provenance, and metrics. `score`
and `colorScore` are 0–100; raw silhouette IoU, boundary F1, and edge recall are 0–1. Mean ΔE00
remains in color-difference units. Overall metrics are equal-weight means across pictures.

The combined score is 50% silhouette IoU, 20% boundary F1, 20% color, and 10% edge recall. Color and
edge credit are multiplied by overlap IoU. Boundary tolerance is two pixels at the chosen score
resolution. Color is CIEDE2000 after **one scalar exposure fit across the entire pack in linear
light**, clamped to 0.25–4; color credit is `exp(-meanDeltaE / 20)`. Edges are Sobel magnitudes of
at least 100 on 8-bit grayscale, matched within two pixels. Use the same score size for comparisons.
Renderer, seed, and search order are fixed; test repeatability on the same machine.

Cameras include yaw and pitch in radians, fov in degrees, distance in model units, and a target
point. The mesh proxy searches from the view hint, including both three-quarter directions, then the
actual GSplat renderer refines the pose. Every new model is refit; truth cameras never seed this
process. Roll and camera intrinsics beyond a centered pinhole camera are not inferred.

Only the scorer opens `truth/truth.json`, after fixing all 2D cameras and scores. That manifest
names `model.glb` and stores true cameras and asset provenance. Geometry scores are symmetric mean
Euclidean sampled Chamfer distance and a 40³ voxel volume IoU, with no ICP or truth-based alignment.
Normalized Chamfer divides by the joint bounds' diagonal. Volume uses three-axis ray parity with
majority voting; an open or nonmanifold source has an approximate volume. PLY-only results report
null volume, not a fabricated solid. A low volume score is a failed gate even if the picture fits.

## Reproduce the public benchmark

The five packs in `tools/refpack-samples/` come from CC0 Poly Haven models already listed in
`tools/models.json`: a rubber duck, a croissant, a pomegranate, a carrot cake, and a lantern. No
furniture is listed there. Each has five plain-background views and one busy-background view,
supplied masks, a compact truth GLB, true cameras, source hashes, and the measured good build. The
sources were simplified when needed and their base colors averaged per triangle and their materials
made opaque; these are synthetic tests, not evidence of performance on real store photographs.

`tools/refpack-benchmark.mjs` physically copies only pack.json, pictures, and masks into private
input folders, then runs draft, good, and best caps of 2, 30, and 120 minutes. It scores against the
original truth packs afterward. It keeps draft/best output and rendered reports in `.cache/`, and
writes the compact, public `tools/refpack-samples/benchmark.json`. Remove an old generated result or
choose a clean checkout for a fresh run. The CLI exits 2 when the quality gates fail; the summary
keeps the measurements and explicit pass/fail fields. `node tools/refpack-toy.mjs` regenerates the
labs toy's data only from those five measured good builds. The toy is **Built from pictures**,
behind labs.

For source regeneration, first download the glTF, its buffer, and its base-color texture into
`.cache/refpack-sources/<Poly-Haven-id>/`, save the live source page as `page.html`, and save the
live license page as `license.html`.
`SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/refpack-samples.mjs` then regenerates the compact
truth models, cameras, pictures, and masks. Review the pictures and the license record before
committing anything. This intentionally does not download arbitrary URLs.

The release gate is median silhouette IoU ≥ 0.85 at good, and volume IoU ≥ 0.6 against each truth
model. Report every object and all three budgets, the repeat-run delta, and the wrong-model check.
See the task's audit for the actual result and remaining blockers; the labs entry exposes the
approximations for inspection and does not promise a photoreal reconstruction.

Sources opened October 17, 2026: [Poly Haven's CC0 license](https://polyhaven.com/license),
[duck](https://polyhaven.com/a/rubber_duck_toy), [croissant](https://polyhaven.com/a/croissant),
[pomegranate](https://polyhaven.com/a/food_pomegranate_01),
[cake](https://polyhaven.com/a/carrot_cake), [lantern](https://polyhaven.com/a/Lantern_01), and
[CIEDE2000 implementation notes and reference data](https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/ciede2000noteCRNA.pdf).

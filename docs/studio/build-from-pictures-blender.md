# Blender builder

Codex (GPT-6), October 17, 2026. Build-time tools only; the site and engine are unchanged. This is
the Blender section to join to task 113's playbook when that file reaches main.

## Install once, only when requested

```sh
tools/refblend/setup.sh --blender
export BLENDER_BIN=/path/printed/by/setup/blender
```

The separate installer pins Linux x86_64 Blender **4.5.3 LTS**, checks the archive against a SHA-256
embedded in the script, and unpacks it outside the repository. Calling it without `--blender` does
nothing and exits with usage. `REFBLEND_CACHE` selects an external cache. An existing archive is
checked again on every invocation. A mismatch stops installation. The
[official checksum list](https://download.blender.org/release/Blender4.5/blender-4.5.3.sha256) was
opened and checked on October 17, 2026. Blender is a
[GPL build tool](https://www.blender.org/about/license/), already listed under Blender 4.5 LTS in
`LICENSES.md`; no executable, Blender library, or Python runtime is shipped.

## From pictures to a model and a tap toy

1. Read the pack's pictures, notes, dimensions, license, and requested moves. Keep private pictures,
   results, reports, and clips outside git. Use task 113's `refpack.mjs check` when available. This
   wrapper independently validates the schema 1 contract, files, budgets, and moving names.
2. Name the physical parts. Choose a foreground patch for each material, identify symmetry, and
   judge thicknesses and pivots by eye. Write a self-contained Python model script with the kit. The
   runner supplies `PACK`, `PACK_DIR` (a copy of only the public inputs), `QUALITY`, and `SEED`. It
   initializes Python and NumPy randomness. A model script is trusted executable Python; copying the
   public inputs is a separation of evidence, not an operating-system sandbox.
3. Run one iteration into a fresh output folder:

   ```sh
   node tools/refbuild-blender.mjs /outside/repo/pack model.py \
     --quality=good --minutes=30 --out=/outside/repo/chair-01
   ```

4. Open `report.html`. Inspect every reference, model render, and silhouette difference. Fix the
   worst view in the model script. Rerun with a fresh `--out` and the **remaining** agent budget.
   The command executes one model revision; the agent supplies the modeling and revision loop. It
   does not autonomously edit Python. Stop at the gate or the remaining budget.
5. Open the actual splat toy locally, then tap its part and orbit it:

   ```sh
   node tools/refblend/preview.mjs /outside/repo/chair-01
   ```

   Open the printed localhost URL. The default is the phone tier; `?tier=desktop` selects desktop.
   The server serves this result, the preview, and the existing local renderer. It uploads nothing.

6. Capture motion for review:

   ```sh
   SPLASHERY_CHROMIUM=/path/to/chromium node tools/refblend/clip.mjs \
     /outside/repo/chair-01 /outside/repo/chair.mp4 --size=1080 --fps=30
   ```

   This captures the real PlayCanvas splat entities and their tap transforms, with FFmpeg encoding.
   The JSON beside the clip records frame count, dimensions, browser errors, and a rigid-distance
   check. FFmpeg and Chromium are existing build/test tools listed in `LICENSES.md`.

A supervisor enforces `--minutes` across Python, rendering, baking, conversion, and scoring,
including synchronous work in the build worker. On failure or timeout, it leaves diagnostic logs and
an incomplete staging folder. It publishes `--out` only after a complete, validated run. Existing
output folders are refused so a bad revision cannot replace a good one. The hard cap covers this
invocation, not the time an agent spends thinking and editing between invocations.

## Model script API

Blender coordinates are **meters, Z up, front toward -Y**. Dimensions are `(X, Y, Z)`. Materials use
linear RGB. Use the pack's physical dimensions; do not independently normalize individual pieces.

```python
from refblend import *

wood = material('Warm oak', 'wood', (.32, .16, .06), roughness=.55)
fabric = material('Woven seat', 'fabric', (.35, .24, .12), roughness=.85)
box('Carcass', (.6, .4, .7), (0, 0, .35), bevel=.01, material=wood)
drawer = box('Drawer', (.53, .34, .12), (0, -.02, .5), bevel=.006, material=wood)
moving_part('drawer', [drawer], (0, 0, .5))
cushion('Seat', (.55, .38, .09), (0, 0, .75), material=fabric)
```

The pack must request the matching move, for example
`{"part":"drawer","how":"slide","axis":"z","amount":0.25}`. Motion axes use the exported **Y-up**
frame, so this example moves along Blender -Y. Translation amounts are meters; rotation amounts are
degrees. Supported motions are slide, hinge, spin, bounce, and wobble.

| Helper                                                       | Purpose                                                                                                                                                              |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `box(name, size, at, bevel, material)`                       | Closed box with physical bevels and weighted normals.                                                                                                                |
| `lathe(name, profile, at, segments, material, closed=False)` | Ordered `(radius, height)` points traced by an agent from a mask; capped solid by default. `closed=True` revolves a closed cross-section for a hollow shell or ring. |
| `extrude(name, outline, depth, at, bevel, material)`         | A closed XY outline, including concave outlines, extruded along Z. Cap seams are welded.                                                                             |
| `tube(name, points, radius, material)`                       | Smooth, capped tube along XYZ points, with welded cap seams.                                                                                                         |
| `slats(name, count, size, start, step, material, bevel)`     | Repeated beveled slats. Rotate returned objects to curve a back or splay an array.                                                                                   |
| `legs(name, positions, profile, material, segments)`         | An array of turned legs with the same profile.                                                                                                                       |
| `cushion(name, size, at, material, softness, subdivisions)`  | Beveled, subdivided closed cushion with edge creases.                                                                                                                |
| `sample_color(file, uv, radius)`                             | Average an agent-chosen image patch, ignoring transparent pixels. Use `PACK_DIR` to locate the picture.                                                              |
| `material(name, kind, color, roughness, grain)`              | Procedural wood, fabric, metal, plastic, glass, or stone.                                                                                                            |
| `moving_part(name, objects, pivot)`                          | Join a group into one rigid object and place its origin at the model's pivot. Required for every requested move.                                                     |
| `render_pack(pack, output, size, samples, engine)`           | Render every camera; the wrapper calls this automatically.                                                                                                           |
| `export_glb(file, objects=None)`                             | Export selected geometry with glTF's Y-up conversion; the wrapper calls this automatically.                                                                          |

See `tools/refblend/examples/` for four picture-led models and an original kit showcase. No example
imports truth geometry. The agent must judge hidden surfaces, grain direction, roughness, wall
thickness, and the grouping of moving pieces. Glass retains transmission in GLB, but splats are
opaque surfaces. They do not reproduce transmission, specular reflections, fabric sheen, or bump
shading. Procedural **base colors** are baked through emission to packed textures, including metal
and glass; a diffuse-only bake would turn them black. Each object gets a fresh nonoverlapping bake
atlas, so joined pieces retain different colors while source texture UVs remain available. GLB also
retains the Principled material's metallic and roughness factors.

## Cameras, scores, and quality

The task 113 pack/result schema stays at `schema: 1`. This builder accepts the optional additive
`images[].camera` object: `yaw`, `pitch`, and `fov` in degrees, `distance` in meters, a Y-up
`target`, and optionally `orthoScale` in meters. Yaw zero looks from +Z in Y-up coordinates (Blender
-Y). This is public camera calibration, not a truth mesh or a hidden fitting signal.

Without calibration, the view hint initializes an **unfitted** camera around the model bounds.
`cameras.json` records every actual camera, render size, sample count, engine, and elapsed seconds.
The fallback does not estimate cameras; unknown-camera product photos still need task 113's camera
fitting or manual calibration. Do not describe their provisional scores as a calibrated gate.

If `tools/refpack-score.mjs` exists on main, the wrapper calls it and propagates its failure.
Otherwise it uses `tools/refblend/score-lite.mjs`: silhouette IoU only, reported from 0 to 100. A
supplied black/white mask is preferred. Without one, the fallback compares colors to the four
corners with an RGB distance threshold of 35; clutter, shadows, and edge-touching objects need an
explicit mask. The report labels this method and its missing boundary, color, edge, and 3D metrics.
It embeds pictures locally, so a private report is private too.

The scorer size defaults to 256 pixels for every quality. Quality controls mesh choices in the model
script, Cycles samples (4, 16, or 64), and base-color bake size (64, 256, or 512). Use the same
`--size=256` for comparative scoring. `--samples`, `--size`, and `--bake-size` override those
defaults. Cycles uses CPU with four threads. EEVEE is explicit opt-in with
`--engine=BLENDER_EEVEE_NEXT`; only use it after a successful headless probe on that machine.
Increasing render samples cannot repair a wrong part or missing geometry.

## Result folders and integration with task 113

`result.json` starts with the contracted `schema`, `pack`, `builder: "blender"`, and actual
`minutes`, and adds these fields:

- `mesh: "result.glb"` is the assembled mesh in Y-up meters. `result.blend` is editable evidence.
- `splat: "result.ply"` is the assembled desktop splat. PLY positions, normals, quaternions, and
  scales use normalized Y-up coordinates. `normalization` records the whole model's center and
  radius in meters; subtract that center and divide by that radius to place pivots.
- `parts[]` has `name`, `file: "parts/<name>.ply"`, normalized `pivot`, `pivotMeters`, `motion`, and
  the meter-space `mesh`. Every requested move must be declared in the model script.
- `static: "static.ply"` excludes every moving group. For taps, load **static plus parts**. Loading
  the assembled splat alongside parts would duplicate the moving geometry.
- `tiers.phone` budgets 90,000 splats; `tiers.desktop` budgets 300,000, imported from the existing
  model converter's tier definitions. Each includes its assembled file, static file, and part files.
  `splats` is the budget, `emittedSplats` is the actual assembled count, and `components` records
  actual static/part counts. Rejected surface samples can make actual counts lower than budgets.
- `provenance` records Blender's version and SHA-256 hashes of the script, public inputs, GLB, and
  assembled PLY. `license` keeps the pack's source and author; `credit` reads `Codex (GPT-6)`.

The wrapper **imports** the existing `tools/model-to-splats.mjs` CLI in an isolated worker with an
explicit argv. No conversion implementation is copied. Its per-file normalization is undone and
reapplied using the whole model's center and radius, including splat scales. Thus a door and its
body share coordinates. The preview puts each splat under one entity at its recorded pivot and moves
that entity; no per-point soft deformation or region weighting is involved.

To add results to task 113's labs toy, take each evidence folder's `good` result, preserve its
`result.json`, and load the selected tier's static and parts. Keep the credit, source, and license
beside the toy. Use each part's pivot and motion with the same normalized frame. These tools do not
register a toy or edit the engine or shared lists.

## Repeatable truth measurements

`tools/refblend/truth.py` is a **scorer-only** factory. Its job JSON supplies `id` (a CC0 entry in
`tools/models.json`), `source` (an acquired glTF), `pack`, `truth` (a separate output directory),
`licenseChecked` (the date of the caller's live license check, `YYYY-MM-DD`), and optional `moves`
and `size`. It renders four product-photo views, explicit masks, calibrated public cameras, a
normalized truth mesh, and a source/hash/credit record. Source acquisition and live license checking
are separate. Retain every glTF buffer and texture, plus their hashes.

```sh
"$BLENDER_BIN" -b --python-exit-code 1 --python tools/refblend/truth.py -- truth-job.json
"$BLENDER_BIN" -b --python-exit-code 1 --python tools/refblend/truth-score.py -- \
  result.glb /separate/scorer/truth.glb volume.json 128
```

The standalone volume scorer uses a fixed world-space voxel grid, unions meshes, and takes the
majority of three nonzero oriented ray-winding tests. Overlapping outward-facing solids form a
union, while reverse-oriented cavity walls keep their hollow interior. It does not align or rescale
the result to help it fit. Open surfaces and voxel resolution limit that measure. Check thin
assemblies at more than one resolution; a 48-cell grid can misjudge a thin board at a voxel
boundary. The factory and scorer are separate commands and are never imported by the builder.

Verification:

```sh
npx playwright test tests/cdx-refblend.spec.mjs
BLENDER_BIN=/path/to/blender npx playwright test tests/cdx-refblend.spec.mjs
node tools/preflight.mjs --quick
```

Only tests whose names say they need Blender skip when `BLENDER_BIN` is absent. The other tests
exercise pack validation, the result contract, path confinement, the scorer, normalization, the
installer's checksum failure, and deadline handling without Blender.

## Original modeling-kit showcase

This demonstration makes a wooden cabinet with a drawer and door, plus a turned-leg chair with a
fabric cushion and slatted swivel back. It is original procedural work, explicitly excluded from
reconstruction scores; its reference render comes from the same script.

```sh
"$BLENDER_BIN" -b --python-exit-code 1 --python tools/refblend/showcase.py -- /outside/repo/showcase-pack
node tools/refbuild-blender.mjs /outside/repo/showcase-pack tools/refblend/examples/modeling-kit.py \
  --quality=good --minutes=30 --out=/outside/repo/showcase-result
node tools/refblend/preview.mjs /outside/repo/showcase-result
```

The result's three rigid groups demonstrate a sliding drawer, a door hinged on its edge, and a
swivel seat and back. The carcass has an interior, so the opening parts reveal solid surfaces.

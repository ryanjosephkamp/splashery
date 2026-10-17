# Codex task 106: Splats to mesh, export for 3D printing and other apps (a Goal run, up to 10 hours)

**Branch:** `codex/splats-to-mesh`, cut from `main`. One draft PR against `main`. Meshes, stills,
and scores go on `codex/splats-to-mesh-clips`, never merged. Read `AGENTS.md`, `builders/RULES.md`,
and `docs/PACKS.md` first.

## Why

People make things in Splashery (a photo turned to 3D, a scan, a toy) that they can't take anywhere
else. A mesh export makes them printable on a 3D printer and usable in Blender, game engines, and AR
viewers. It's the first non-splat output, which the owner allows when it's documented. The
conversion is a measurable algorithm, which suits this task.

## The work

A module, `src/mesh-export/`, with no engine dependency (it may use `src/splat-parsers.js` once that
lands; until then, take splat arrays as input). Then a labs Studio tool, "Splats to mesh", that
opens a `.sog`, `.ply`, `.splat`, or `.spz` file, or a built-in toy by id, and saves a file.

1. **Density field:** sample the splats' Gaussian density (and color) onto a sparse grid at a chosen
   resolution, with a level the person can set.
2. **Surface:** marching cubes or dual contouring; remove floaters (small disconnected pieces);
   smooth and decimate to a triangle budget.
3. **Color:** per-vertex color, or a baked texture for GLB.
4. **Formats:** GLB (with color), OBJ with MTL, and STL. "Ready to print" makes it watertight, solid
   at least 1 mm thick at a chosen print size, and says when it can't.
5. **Runs in a worker.** Show progress, allow canceling, and stay in phone memory at the phone
   budget.

## Yardstick

Fourteen Photoreal toys were converted from CC0 Poly Haven meshes (`tools/models.json`), so their
source meshes are ground truth. Fetch them in the setup step, outside git, and score each export
against its source:

- Chamfer distance and normal consistency;
- for "Ready to print", whether the mesh is watertight and manifold.

Also export six kit toys and three Photo to 3D samples, and judge them by stills.

## Gates

1. On the Poly Haven toys: median Chamfer distance at most 1.5% of the bounding diagonal, and median
   normal consistency at least 0.85.
2. "Ready to print" gives a watertight, manifold mesh on at least 13 of the 14, and each failure is
   named.
3. Desktop: a 450,000-splat scan exports in 20 seconds or less. Phone profile: under 60 seconds at
   its budget, within memory.
4. The files open in Blender's importer (task 105, if it has landed) or validate with an open-source
   GLB validator. Name the validator and its license.
5. Every existing spec passes. Document the exception (a non-splat output) in the Tinkerer's Manual
   and the tool's About.

## Stay out of the way of open work

Other PRs are open while you run, so keep this task independent:

- Put new code in new files: `src/<this task's folder>/`, `tools/<prefix>-*.mjs`, and
  `tests/cdx-<prefix>*.spec.mjs`. Touch the shared lists (`src/toys.js`, `src/toy-help.js`,
  `src/toy-sounds.js`, `tools/toy-plan.json`, credits) only for this task's own entries.
- Don't edit `src/player.js`, `src/ui.js`, `src/app.js`, `src/stage.js`, `src/effects.js`,
  `src/loaders.js`, `styles.css`, `index.html`, or any existing pack. If you need a hook, make it
  one small, additive "Engine: …" commit with its own test, and name it in the PR.
- Import existing modules rather than copying them.

## Rules

Open licenses only (Apache-2.0, MIT, BSD) for any vendored code, listed in `LICENSES.md`, loaded
only when the tool opens. An exported mesh keeps its source's license: show the source's license
notice beside the save button, and write it into the file's metadata where the format allows.
American English and the serial comma. Last, merge `main` and run `node tools/preflight.mjs`. PR
body: Summary, Verification, Deviations, Known issues, and What was cut.

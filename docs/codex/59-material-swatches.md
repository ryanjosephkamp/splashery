# Codex task 59: real-looking material swatches for kit toys (made by code, CC0)

**Branch:** `codex/material-swatches`, cut from `main`. One draft PR against `main`.

Read `AGENTS.md`, `builders/RULES.md` (B4), `builders/KIT-GUIDE.md`, `docs/PACKS.md` and CLAUDE.md's
"Effect quality rules" ("Materials look like the real material: no see-through solids, no blur, no
speckle").

## Why

Many kit toys build their surfaces from flat colors. A library of real-looking materials, made by
code and free to use anywhere, would lift every toy that uses it.

## Goal

1. **Twenty materials, made by code** (procedural shaders or Blender node setups, rendered and
   sampled into splat colors, normals and roughness): oak, walnut, birch plywood, brushed steel,
   cast iron, copper with patina, brass, marble, granite, slate, terracotta, glazed ceramic,
   porcelain, leather, denim, felt, rubber, glass (frosted and clear), ice, and gold leaf. Original
   and CC0, credited "made by Ryan with Codex".
2. **A helper for recipes**, `src/materials/swatches.js` (new file, additive): give it a material
   name and a splat's position and normal, and it returns a color and a size jitter that read as
   that material at phone size, with no speckle and no see-through solids. A short guide in
   `docs/PACKS.md`'s style (a new `docs/MATERIALS.md`).
3. **A labs toy, "Material swatches"**: a rack of 20 spheres and blocks, each tappable to turn and
   show its name, with a how-to line, About text, a sound, a thumbnail, and its row with the labs
   flag (edit only your own lines in the shared lists).
4. **Proof:** contact sheets at 390×844 of each material next to a real reference photo whose
   license allows it (or a plain description if none), and a clip of the rack.

## Don't touch

The files of the open PRs (#560, #562, #566, #581 and #582), existing toys' recipes (propose which
toys should adopt which materials in the report; don't change them), and `vendor/`.

## Report

`docs/audits/material-swatches-2026-10.md`. Tests: `tests/cdx-materials.spec.mjs`, plus `taps`,
`help`, `hta`, `unit`, `kit` and `smoke` (never edit `tests/taps.spec.mjs`). Before you push:
`npx prettier --check .` and `node tools/us-english.mjs --diff` are clean.

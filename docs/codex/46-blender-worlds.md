# Codex task 46: Blender-built worlds, baked to splats

**Branch:** `codex/blender-worlds`, cut from `main`. **Start only once the Baked engine (PR #549:
`src/baked.js`, `tools/port-convert.mjs`, `tools/port-check.mjs`) is on `main`;** if it isn't, stop
and say so.

**You may change:** new files under `tools/blender/` (Blender Python scripts and their notes), new
world folders under `worlds/` with their assets, `src/worlds/` (additions only; the test island
keeps working exactly as now), new `tools/cdx-bw-*.mjs`, new `tests/cdx-bw*.spec.mjs`, `LICENSES.md`
(the tools you use), `tools/assets.json` and `CREDITS.md` (your assets), and a report at
`docs/audits/blender-worlds-2026-10.md`.

## Why

The owner wants to see how far Blender can take Splashery's Worlds (`docs/WORLDS.md`, labs only,
`worlds/?labs=1`; paused since October 2, 2026). The Baked engine gives a way in: a compact splat
format (BKD1, 18 bytes a splat, tiers chosen by the device's budget, parts that move as solid
pieces) that the Kit loads like any other splats.

## Steps

1. **A bake pipeline.** Blender Python scripts (Blender runs headless; list its version in
   `LICENSES.md` as a build tool, never shipped) that turn a scene of meshes into splats: sample
   each surface densely, take color from the material, orient and size each splat to the surface,
   keep a part id per object that should move, and write a 3DGS PLY. `tools/port-convert.mjs` turns
   it into BKD1 tiers. If Blender can't run in your environment, say so and do the same with a Node
   or Python sampler from glTF.
2. **One world, done well.** Build one small place to walk through, for example a forest clearing
   with a stream and a wooden bridge, or a village square with a fountain. Use CC0 assets (Poly
   Haven, ambientCG and similar, each checked on its live page and recorded, B1 and B2) and your own
   procedural models (CC0, credited "made by Ryan with Codex", B4). Things that move (water, a door,
   a windmill) move as solid parts.
3. **It plays on a phone.** Walk with one thumb and look with the other; the default tier fits D4 in
   `builders/RULES.md` and holds a steady frame rate at the phone tier (measure it at 4x throttle).
4. **Check it.** Run `tools/port-check.mjs` on your world's package; its output goes in the report.
5. **Tests.** `tests/cdx-bw*.spec.mjs`: the world loads at each tier, walking moves the camera and
   stays in bounds, and the moving parts move. Keep green: `wd`, `wdh`, `wdr3` and the `bkd` tests.
6. **Report.** `docs/audits/blender-worlds-2026-10.md`: the pipeline step by step (so the owner's
   other agents can use it), sizes and frame times per tier, what worked and what didn't, and a
   walk-through clip at 390x844 in the PR.

Before you push, run `npx prettier --check .` and `node tools/us-english.mjs --diff`. Open a draft
PR titled "Codex task 46: Blender-built worlds, baked to splats" with the five sections from
CLAUDE.md and a "Rule check" line (`builders/RULES.md`).

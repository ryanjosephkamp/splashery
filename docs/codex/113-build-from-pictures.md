# Codex task 113: Build from pictures, part 1: the context pack, the scorer, and the kit builder (a Goal run, up to 8 hours)

**Where:** Codex's cloud. **Branch:** `codex/build-from-pictures`, cut from `main`. One draft PR
against `main`. Renders, packs made from private pictures, and raw evidence go on
`codex/build-from-pictures-clips` or stay outside git, never in the PR. Read `AGENTS.md`,
`builders/RULES.md`, CLAUDE.md's "Effect quality rules", `docs/PACKS.md`, `src/kit.js`,
`tools/model-to-splats.mjs`, and `tools/splat-views.mjs` first.

## Why

The owner wants to point at a real thing (a chair on a furniture site, a lamp, a toy on his desk),
attach a few pictures of it, and say "build this". An agent (Codex, a Claude lane, the Operator, or
later the Shop) then builds the closest 3D toy it can, within a time or quality budget, optionally
animated, and checks it against the pictures before anyone sees it.

This task builds the toolkit for that loop: one way to package the pictures (the context pack), one
way to score a result against them, and the first builder, made of Splashery's kit shapes. Task 114
builds a second builder in Blender against the same pack and scorer, at the same time. Write the
pack and score formats exactly as below so the two fit.

## The context pack (the contract with task 114)

A folder, `<pack>/`, with `pack.json` and its pictures:

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
  "notes": "Solid oak, four straight legs, a slatted back, a woven seat.",
  "parts": [{ "name": "seat", "material": "woven rush" }],
  "moves": [{ "part": "seat", "how": "spin", "axis": "y", "amount": 360 }],
  "budget": { "minutes": 30, "quality": "good" },
  "license": { "images": "private", "source": "https://…" }
}
```

- `view` is a hint: `front`, `back`, `left`, `right`, `top`, `three-quarter`, `detail`, or
  `unknown`. `mask` is optional; make one when it is missing (below).
- `size`, `notes`, `parts`, and `moves` are optional. `moves` asks for animation: `slide`, `hinge`,
  `spin`, `bounce`, or `wobble`, on a named part.
- `budget.quality` is `draft` (minutes), `good`, or `best` (hours). `minutes` is a hard cap.
- `license.images: "private"` means the pack never enters git or the site. Only packs whose pictures
  are CC0, the owner's own, or rendered from CC0 models may be committed.
- `tools/refpack.mjs check <pack>` validates a pack, and `tools/refpack.mjs new <images…>` makes one
  from loose pictures (it asks nothing; it guesses views as `unknown` and leaves the rest out).

A result is a folder, `<result>/`, with `result.json`
(`{ "schema": 1, "pack": "<id>", "builder": "kit" | "blender" | …, "minutes": 12.5 }`), a splat file
(`result.ply`) or a mesh (`result.glb`) or both, and, for animated results, one file per moving part
(`parts/<name>.ply`) with its pivot and motion in `result.json`.

## The work

1. **Masks and cameras.** For each picture, a foreground mask (an open, license-clean segmenter run
   at build time, or a color and edge method; say which) and an estimated camera: yaw, pitch, field
   of view, and distance, found by searching for the pose where the result's silhouette matches the
   mask best, starting from the `view` hint. Cameras are re-estimated as the result improves.
2. **The scorer,** `tools/refpack-score.mjs <pack> <result>`: render the result from each picture's
   camera (in Chromium with the real renderer, like `tools/splat-views.mjs`), then score every
   picture:
   - silhouette IoU and boundary F1 against the mask;
   - color difference (CIEDE2000) inside the overlap, after one global exposure match;
   - an edge score (how many of the picture's strong edges the render has).

   It writes `score.json` (per picture and overall, 0 to 100) and `report.html`: each picture beside
   the render from its camera, with the difference shown. When the pack has a truth model (below),
   it adds 3D scores: Chamfer distance and volume IoU against the truth.

3. **The kit builder,** `tools/refbuild-kit.mjs <pack> --minutes=N`: fit the kit's shapes (boxes,
   rounded boxes, cylinders, cones, spheres, lathed profiles, and extruded outlines) to the masks.
   Read the outline of a lathed or extruded part from the best-facing mask. Optimize sizes and
   positions against the scorer within the budget, and color each part from the pictures. Write a
   pack recipe in the style of `docs/PACKS.md` (so it builds in the browser like any kit toy) and a
   `result.ply`. Animate the parts in `moves` as solid pieces with a tap effect.
4. **Truth packs to measure against.** Make five packs by rendering CC0 models from
   `tools/models.json` (Poly Haven furniture and objects if there are any; otherwise the nearest)
   from 3 to 6 product-photo views with a plain background, plus one with a busy background. Keep
   each truth model and its true cameras beside the pack, hidden from the builders and used only by
   the scorer. Commit these packs (they are CC0) to `tools/refpack-samples/`, each under 3 MB.
5. **The playbook,** `docs/studio/build-from-pictures.md`: the steps an agent follows to go from a
   pack to a toy (check, mask, build, score, look at the report, fix the worst picture, repeat until
   the budget or the gate), written so the Operator or the Shop can run it later from "build this"
   with pictures attached. Say what an agent should do by hand (reading the pictures, naming the
   parts) and what the tools do.
6. **A labs toy,** "Built from pictures" (`labs: true`): the five truth builds on one shelf entry
   with a picker, each with its score and its pictures in the About text, and its tap animation.

## Gates

- On the five truth packs, at the `good` budget (30 minutes each): a median silhouette IoU of at
  least 0.85 against the masks, and a volume IoU of at least 0.6 against the truth models. Report
  `draft` and `best` too.
- The scorer is stable: the same result scores within 0.5 points on two runs, and a deliberately
  wrong result (a box for a chair) scores far lower.
- The animated parts move as solid pieces (CLAUDE.md, "Effect quality rules"): a clip of each, made
  with `node tools/effect-clip.mjs <dir> --mp4 --size=1080 --fps=30 <toy>:<secs>`.
- `node tools/preflight.mjs`, and new tests in `tests/cdx-refpack*.spec.mjs` (the scorer on a known
  pair, the pack checker, and the toy opening and tapping).

## Stay out of the way of open work

- New code only: `tools/refpack*.mjs`, `tools/refbuild-kit*.mjs`, `tools/refpack-samples/`,
  `src/refbuild/` for the toy, `docs/studio/build-from-pictures.md`, and the tests. Task 114 owns
  `tools/refblend/` and `tools/refbuild-blender*`: don't edit them.
- Don't edit `src/kit.js`, `src/player.js`, `src/ui.js`, `src/app.js`, `src/stage.js`,
  `src/effects.js`, or any existing pack. If you need a hook, make it one small, additive "Engine:
  …" commit with its own test, and name it in the PR.
- The shared lists (`src/toys.js`, `src/toy-help.js`, `src/toy-sounds.js`, `tools/toy-plan.json`,
  credits) only for this toy's own entries.

## Rules

- A segmenter or any other model used at build time: Apache-2.0, MIT, or BSD for code and weights,
  checked on its live page, listed in `LICENSES.md` as a build tool, never shipped.
- No product photo from a store ever enters git or the site. A toy built from one stays private. No
  logos or brand names on any shipped toy.
- American English and the serial comma. PR body: Summary, Verification, Deviations, Known issues,
  and What was cut. Credit lines read "Codex (GPT-6)". Post a progress note on the PR at 4 hours.

**Done** means the toolkit, the playbook, the five truth builds with their scores, and the labs toy
merged, or a clean negative result naming the top three blockers you actually hit.

# Codex task 114: Build from pictures, part 2: the Blender builder, with animation (a Goal run, up to 8 hours)

**Where:** Codex's cloud. **Branch:** `codex/build-from-pictures-blender`, cut from `main`. One
draft PR against `main` with tools, docs, and tests only. Renders, `.blend` files, and raw evidence
go on `codex/build-from-pictures-blender-clips` or stay outside git, never in the PR. Read
`AGENTS.md`, `builders/RULES.md`, CLAUDE.md's "Effect quality rules",
`docs/codex/113-build-from-pictures.md` (the context pack and result formats are a contract: follow
them exactly), `docs/codex/105-blender-cloud.md`, and `tools/model-to-splats.mjs` first.

## Why

Task 113 builds the context pack, the scorer, and a builder made of Splashery's kit shapes, at the
same time as this task. Kit shapes reach "clearly that chair". Blender reaches "that chair": bevels,
curved slats, cushions, turned legs, real wood and fabric. This task gives an agent a Blender
toolkit for the same loop (look at the pictures, model, render from the pictures' cameras, score,
fix), headless in Codex's cloud, with optional animation, and turns the result into a Splashery toy.

## Blender in the cloud

Use task 105's opt-in `--blender` setup step if PR #701 has merged by the time you start. If it
hasn't, add the same thing in your own file, `tools/refblend/setup.sh`: a pinned Blender LTS for
Linux, downloaded at setup time, its SHA-256 checked, unpacked outside the repo, only when asked.
Don't edit `tools/codex-setup.sh`. Blender is a build tool (GPL), listed in `LICENSES.md`, never
shipped.

## The work

1. **A modeling kit for agents,** `tools/refblend/` (Python for Blender, plus a small Node wrapper,
   `tools/refbuild-blender.mjs`): short, well-named helpers an agent calls from a model script:
   - shapes with real edges: beveled boxes, turned profiles (lathe from an outline traced from a
     mask), extruded outlines, tubes along a curve, slat and leg arrays, and soft cushions
     (subdivision with creases);
   - materials from the pictures: sample the colors, then pick a procedural wood, fabric, metal,
     plastic, glass, or stone and match its color and roughness;
   - one call to render the model from every camera in a pack (Cycles on CPU; EEVEE only if it runs
     without a GPU) at the scorer's size, and one to export `result.glb`.
2. **The loop.** `node tools/refbuild-blender.mjs <pack> <model.py> --minutes=N` runs the agent's
   model script, renders, scores (task 113's `tools/refpack-score.mjs` once it is on `main`; until
   then, silhouette IoU in your own `tools/refblend/score-lite.mjs`, and switch when it lands), and
   writes the side-by-side report. An agent edits `model.py` and runs it again until the budget or
   the gate.
3. **Splats.** Turn `result.glb` into `result.ply` with `tools/model-to-splats.mjs` (import it;
   don't copy it), at the phone and desktop budgets.
4. **Animation.** Each part in the pack's `moves` is its own object with a pivot set from the model
   (a hinge on the door's edge, a slide along the drawer's runners). Export each as
   `parts/<name>.ply` and record its pivot and motion in `result.json`, so a toy's tap moves it as a
   solid piece.
5. **Truth packs.** Until task 113's five truth packs are on `main`, make three of your own the same
   way: render CC0 models from `tools/models.json` from 3 to 6 product-photo views with known
   cameras, and keep each truth model hidden from the builder and used only by the scorer.
6. **Builds.** Build each truth pack at `draft`, `good`, and `best`, writing a model script per pack
   by looking at the pictures (that is the point: an agent with Blender as its hands). Record the
   time, the score at each budget, and what the agent had to judge by eye.
7. **The playbook.** A "Blender builder" section for `docs/studio/build-from-pictures.md` (task 113
   writes the file; if it isn't on `main` yet, write `docs/studio/build-from-pictures-blender.md`
   instead, and the Operator joins them).

## Gates

- On the truth packs, at `good` (30 minutes each): a median silhouette IoU of at least 0.9, and a
  volume IoU of at least 0.7 against the truth models. Report `draft` and `best` too, and the kit
  builder's scores beside yours when task 113's are available.
- Every run repeats: the same model script gives the same scores within 0.5 points.
- Animated parts move as solid pieces: a clip of each, at 1080 px and 30 fps.
- Report what Blender costs in the cloud: install time, disk, and seconds per render at the scorer's
  size.
- `node tools/preflight.mjs --quick`, and tests in `tests/cdx-refblend*.spec.mjs` for the Node
  wrapper and the result format (they must pass without Blender installed: skip only the steps that
  need Blender, and say so in the test's name).

## Stay out of the way of open work

- New files only: `tools/refblend/`, `tools/refbuild-blender*.mjs`, the docs above, and the tests.
  Task 113 owns `tools/refpack*.mjs`, `tools/refbuild-kit*.mjs`, `tools/refpack-samples/`, and
  `src/refbuild/`: don't edit them. Task 113 also makes the labs toy; give it your results' folders
  and say in the PR how to add them.
- No change to the site, any toy, or the engine.

## Rules

- Models used as truth come from `tools/models.json` (CC0) and keep their credit. A pack made from
  store pictures stays private: never in git, never on the site. No logos or brand names on anything
  shipped.
- American English and the serial comma. PR body: Summary, Verification, Deviations, Known issues,
  and What was cut. Credit lines read "Codex (GPT-6)". Post a progress note on the PR at 4 hours.

**Done** means the Blender toolkit, the loop, three or more truth builds with their scores and
clips, and the playbook section merged, or a clean negative result naming the top three blockers you
actually hit.

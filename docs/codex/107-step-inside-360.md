# Codex task 107: Step inside a 360° photo (a Goal run, up to 12 hours)

**Branch:** `codex/step-inside-360`, cut from `main`. One draft PR against `main`. Panoramas, clips,
and scores go on `codex/step-inside-360-clips`, never merged. Read `AGENTS.md`, `builders/RULES.md`,
`docs/studio/photo-3d-checkpoint.md`, and `src/photo3d/` first. Classic Photo to 3D is frozen
(`tests/p3d-golden.spec.mjs`): import from it, never change it.

## Why

Phones take 360° panoramas, and they open as flat, stretched pictures. Turned into splats with
depth, a panorama becomes a room you stand in: look around, lean, and take a step. Few tools do this
in a browser, and none as light as Splashery's toys. It builds on the depth model Splashery already
ships.

## The work

A labs Studio tool, "Step inside a 360° photo" (`labs: true`), in `src/pano3d/`:

1. **Open it:** an equirectangular photo (2:1). Read the GPano metadata when present. Nothing leaves
   the device.
2. **Depth all around:** run the shipped depth model on overlapping cube faces or perspective tiles,
   and blend their scales and seams into one consistent spherical depth. You may compare a
   panorama-native depth model offline. Ship one only under Apache-2.0, MIT, or BSD, licensed for
   code and weights, under 2 MB or approved by the owner, and loaded only when the tool opens.
3. **Splats:** a spherical shell of splats at that depth, denser where the person looks first, at
   the phone and desktop budgets. Leave no seams or holes at the poles.
4. **Moving:** look around (drag or tilt), lean, and step about a meter inside. Show a stretch
   warning where you've moved too far for the photo to hold.
5. **Samples:** two CC0 panoramas, licenses checked on their live pages and recorded in
   `tools/assets.json`. The owner may add his own later.

## Yardstick

Use synthetic panoramas with true depth: from task 105's Blender tool if it has landed, otherwise
render them with `tools/studio-truth-generate.py` locally and say so. Measure:

- scale-consistent depth error (AbsRel, δ1);
- the depth jump across tile seams;
- held-out novel views at 0.3 m and 0.8 m from the center (masked SSIM).

## Gates

1. Seams: the median depth jump across tile seams is under 2%, and no visible line shows in the
   phone clips.
2. Depth: AbsRel at least 20% better than a naive one-tile run on the same panoramas.
3. Phone profile: the first look-around within 25 seconds, and peak memory within Photo to 3D's
   phone limits.
4. Eight phone clips (look around, lean, take a step) go on the clips branch for the owner.
5. Classic Photo to 3D is byte-identical (the golden test), and every existing spec passes.

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

American English and the serial comma. A Claude lane may design the final toy around your core, so
keep the pipeline a clean module. Last, merge `main` and run `node tools/preflight.mjs`. Progress
notes at 4 and 8 hours. PR body: Summary, Verification, Deviations, Known issues, and What was cut.

# Codex task 105: Blender in Codex's cloud, a ground-truth factory (up to 6 hours)

**Branch:** `codex/blender-cloud`, cut from `main`. One draft PR against `main` with the tools and
the report only. Renders go on `codex/blender-cloud-clips` or stay outside git, never in the PR.

## Why

Splashery's truth scenes (task 56, `tools/studio-truth-generate.py`) and the fidelity work need
Blender, which so far runs only on the owner's Mac. If Blender runs headless in Codex's cloud, every
Studio method (Photo to 3D, Video to 3D, Photos to 3D in task 104, Step inside a 360° photo in
task 107) can be measured against exact ground truth, any time, without the owner's machine. Blender
is a build tool here and is never shipped (CLAUDE.md, "Build tools").

## The work

1. **Install it.** Add an opt-in `--blender` step to `tools/codex-setup.sh` that downloads a pinned
   Blender LTS for Linux at setup time, checks its SHA-256, and unpacks it outside the repo. Add the
   matching steps to `docs/codex/SETUP.md`. If the setup step can't reach the download, say so, and
   stop there with the evidence.
2. **Prove it renders.** Run `tools/studio-truth-generate.py` headless (Cycles on CPU, and EEVEE if
   it works without a GPU). Measure seconds per frame at 512 and 1024 px.
3. **A dataset tool:** `tools/blender-views.mjs`, which wraps a Python script. It takes a CC0 model
   (the Poly Haven models in `tools/models.json`) or a truth scene and renders:
   - N calibrated views on a sphere or orbit, with exact camera matrices;
   - depth, normals, and object masks;
   - an equirectangular 360° panorama with depth, for task 107.

   It writes a manifest with hashes, so runs repeat byte for byte with a fixed seed.

4. **Six datasets:** three objects at 24 views and three panoramas, made in the cloud. Record their
   size, render time, and hashes in the report. The files stay out of git.

## Gates

- The datasets come out identical on two runs (same hashes).
- The report gives install time, disk used, seconds per view, and what fails without a GPU.
- `npm test`-level checks and `node tools/preflight.mjs --quick` pass. No change to the site or any
  toy.

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

The PR changes only `tools/`, `docs/codex/SETUP.md`, `LICENSES.md` (Blender as a build tool, GPL,
not shipped), and a report under `docs/audits/` (300 lines at most). American English and the serial
comma. PR body: Summary, Verification, Deviations, Known issues, and What was cut.

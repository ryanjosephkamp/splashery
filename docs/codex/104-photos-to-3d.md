# Codex task 104: Photos to 3D, many photos of one thing into one 3D scene (a Goal run, up to 12 hours)

**Branch:** `codex/photos-to-3d`, cut from `main`. One draft PR against `main`. Datasets, clips, and
raw scores go on `codex/photos-to-3d-clips`, never merged. Read `AGENTS.md`, `builders/RULES.md`,
`docs/PACKS.md`, and the Video to 3D code in `src/video3d/` first.

## Why

Photo to 3D guesses depth from one picture, and Video to 3D trains splats from a clip's frames.
People also have something in between: 10 to 60 photos taken around an object. Turning those into
one 3D scene, in the browser, on the person's own device, is what photogrammetry apps do on a
server. Video to 3D already matches frames, solves cameras, and trains splats. This task extends
that to **unordered** photos.

## The work

A labs Studio tool, "Photos to 3D" (`labs: true`), in `src/photos3d/`:

1. **Pick photos:** 8 to 60 images from the device (JPEG, PNG, HEIC where the browser decodes it),
   with EXIF orientation and focal length when present. Nothing leaves the device.
2. **Match unordered images:** features and matches between image pairs, a match graph, and a choice
   of which pairs to trust.
3. **Solve cameras:** incremental structure from motion (seed pair, register, triangulate, bundle
   adjust), reusing Video to 3D's solver where it fits.
4. **Train splats:** Video to 3D's trainer, on WebGPU with its software fallback, within the phone
   and desktop budgets. Show progress as it trains, and keep the result if the person stops early.
5. **Report honestly:** which photos joined the scene and which didn't, and why. A photo that can't
   be placed is reported, never guessed.

## Yardstick

Use leave-one-out held-out views: train without one photo, render from that photo's solved camera,
and compare (SSIM and PSNR inside the object's mask). Use at least six photo sets under CC0 or CC
BY. Check each license on its live page and record it in `tools/assets.json`. Add three synthetic
sets with exact cameras if task 105's Blender renders exist by then. Keep the photos out of git.

## Gates

1. On the real sets, median held-out SSIM is at least 0.80 on desktop, and the phone profile
   finishes every set.
2. On synthetic sets with known cameras, median camera rotation error is under 2° and position error
   under 2% of the scene size.
3. Phone profile: the first 3D view arrives within 3 minutes for 24 photos, and peak memory stays
   within the Video to 3D phone limits.
4. Ten paired phone clips (the photo strip, then an orbit of the result) go on the clips branch for
   the owner.
5. Every existing spec passes. Video to 3D and its tests are unchanged, or better and said so.

**Done** means the labs tool merged with its report, or a clean negative result naming the top three
blockers and what would remove them.

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

New vendored code only under an open license (Apache-2.0, MIT, BSD), listed in `LICENSES.md` and
loaded only when the tool opens. A copyleft or server-calling library goes to the owner first. A
Claude lane may later design the final toy around your core, so keep the pipeline a clean module
with its own API. American English and the serial comma. Last, merge `main` and run
`node tools/preflight.mjs`. Progress notes at 4 and 8 hours. PR body: Summary, Verification,
Deviations, Known issues, and What was cut.

# Codex task 109: Screen in 3D, a shared window seen live as a relief of splats (a Goal run, up to 10 hours)

**Branch:** `codex/screen-in-3d`, cut from `main`. One draft PR against `main`. Clips and timing
records go on `codex/screen-in-3d-clips`, never merged. Read `AGENTS.md`, `builders/RULES.md`,
CLAUDE.md's "Live input" rule, `src/live/live.js`, and the Splat mirror in `src/packs/live.js`
first.

## Why

The Splat mirror turns a live camera into a moving relief of splats, with depth from the shipped
depth model many times a second. The owner wants the same for **a shared window**. Play a desktop
game, or watch a video, in another window, and see it live in 3D through the toy, at a frame rate
that feels playable. Screen capture is already a live source in `src/live/live.js` (desktop browsers
only; its button hides on phones), but no toy uses it for depth yet.

## The work

A new labs toy, "Screen in 3D" (`labs: true`), in `src/screen3d/`. It reuses the mirror's pipeline
by import: the frame grab, the depth worker, and the relief. The public Splat mirror stays
unchanged.

1. **Start:** a "Share a window" button through `live.start("screen")`, only on the person's tap
   (CLAUDE.md, "Live input"). Nothing is recorded or sent. The Live pill and Stop work as for the
   camera.
2. **Fast enough to play:**
   - downscale the frames before depth, with a quality-for-speed dial;
   - run depth on WebGPU when it's there;
   - reuse the last depth between depth frames, and keep color at the screen's full frame rate;
   - drop stale frames rather than queue them.
3. **Look:** a relief you can tilt and lean into. A depth slider runs from flat to deep. A "hold
   depth" toggle keeps the last depth while the picture keeps moving.
4. **Honest about limits:** show the measured frames per second and the delay. Say plainly that the
   person controls the game in its own window, and the toy only shows it.

## Gates

1. On a desktop with a WebGPU adapter, using a 1280×720 shared window:
   - color at 30 fps or more, and depth refreshed 10 times a second or more;
   - a median delay from the window to the screen of 150 ms or less.

   Report the CI software-GL numbers as relative only. A page the owner can open on his computer
   records one real run.

2. An hour of screen sharing (simulated) leaks no memory: the heap is flat within 10%.
3. Nothing starts before the tap, and Stop ends every track (tested with a fake `getDisplayMedia`).
4. Six desktop clips go on the clips branch for the owner: a game, a video, and a web page.
5. The Splat mirror and every existing spec are unchanged.

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

American English and the serial comma. A Claude lane may design the final toy around your core.
Last, merge `main` and run `node tools/preflight.mjs`. Progress notes at 4 and 8 hours. PR body:
Summary, Verification, Deviations, Known issues, and What was cut.

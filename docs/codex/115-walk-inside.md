# Codex task 115: Walk inside a splat place (a Goal run, up to 8 hours)

**Where:** Codex's cloud. **Branch:** `codex/walk-inside`, cut from `main`. One draft PR against
`main`. Clips, captures, and raw evidence go on `codex/walk-inside-clips`, never merged. Read
`AGENTS.md`, `builders/RULES.md`, CLAUDE.md's "Effect quality rules", and `src/worlds/` (its
controls, character, camera, and physics) first.

## Why

Splashery shows splats as things you turn in your hand. A splat scene of a place (a room, a street,
a landmark, or what a person made with Photos to 3D or Step inside a 360° photo) is better walked
through. Splashery Worlds already walks a character over kit-built ground; this task walks a person
through splat places, on a phone and on a desktop, without falling through the floor or walking
through walls.

## The work

A labs Studio tool, "Walk inside" (`labs: true`), with its code in `src/walk/`:

1. **Open a place:** a splat file the person opens (PLY, SOG, SPZ, or KSPLAT, through the loaders
   Splashery already has; nothing leaves the device), the shipped photoreal captures that are places
   rather than objects (list them from `tools/assets.json`), and two kit-built rooms you make as
   test places.
2. **Find the floor and the walls:**
   - estimate the up direction and the floor (a robust plane fit on dense, opaque splats; let the
     person flip or level it by hand);
   - build a coarse collision grid from the splats, weighted by opacity and size (about 10 cm cells,
     built in a worker in under 2 seconds for a million splats on the phone profile);
   - ignore floaters (small, faint clusters), so a stray splat doesn't stop the walk.
3. **Walk:**
   - a capsule body with gravity, steps up to 25 cm, slopes up to 35 degrees, and sliding along
     walls;
   - first person by default, with Worlds' character as a third-person option (import it from
     `src/worlds/`; don't copy it);
   - phone: a thumb stick on the left, drag to look on the right, and tap the floor to walk there;
   - desktop: WASD and mouse look with pointer lock, and click the floor to walk there;
   - comfort: no head bob, a gentle speed, a vignette while turning fast, and
     `prefers-reduced-motion` honored.
4. **Speed:** keep the phone profile at 30 fps or better in the test rooms. Cull what is behind the
   person, and use the engine's levels of detail if it has them. Say what a 2-million-splat place
   costs.
5. **Where you can't go:** a soft edge at the capture's limits, so a person sees where the place
   ends instead of walking into the void.

## Yardstick

- Ten scripted walks per test place (a fixed path of key presses): no fall through the floor, no
  pass through a wall, and the end point within 10 cm on every run.
- Frame time on the phone and desktop profiles, while walking and while standing.
- A 20-second clip of each place at 1080 px and 30 fps (`node tools/effect-clip.mjs` or your own
  scripted capture), for the owner.

## Gates

- The yardstick above, in `tests/cdx-walk*.spec.mjs`.
- Opening "Walk inside" loads nothing until the tool opens, and old links and saved scenes open
  exactly as before.
- `node tools/preflight.mjs`. Screenshots at 390×844 and 1440×900 as `cdx-walk-*.png`.

## Stay out of the way of open work

- New code in `src/walk/` and `tools/walk-*.mjs`. Import `src/worlds/` modules; don't edit them.
- Don't edit `src/player.js`, `src/ui.js`, `src/app.js`, `src/stage.js`, `src/effects.js`,
  `src/loaders.js`, `styles.css`, `index.html`, or any existing pack. If you need a hook, make it
  one small, additive "Engine: …" commit with its own test, and name it in the PR.
- The shared lists only for this tool's own entries. Don't touch Photo to 3D, Moving photo to 3D,
  Video to 3D, or Step inside a 360° photo (other work is open there): open their results only
  through the file formats they already save.

## Rules

Places that ship must be license-clean (CLAUDE.md, "Ground rules"), checked on their live pages and
recorded in `tools/assets.json` and `CREDITS.md`. American English and the serial comma. PR body:
Summary, Verification, Deviations, Known issues, and What was cut. Credit lines read "Codex
(GPT-6)". Post a progress note on the PR at 4 hours.

**Done** means "Walk inside" merged behind labs with its clips, or a clean negative result naming
the top three blockers you actually hit.

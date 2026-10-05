# Lane Waves and optics (Optics, prefix `opt`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: Waves and optics (id `Optics`, prefix
`opt`). Branch: `claude/lane-optics` (and `claude/lane-optics-engine` for any change to the app
outside your own files, as an "Engine: …" PR merged first). PR title: "Phase Waves and optics: a
ripple tank and a light bench". Handoff file: docs/handoff/Optics.md (create it; start it with this
brief, word for word, under "## Brief", then keep "## State

WORKING (October 5, 2026): both toys built (ripple tank, light bench), tests in
`tests/opt.spec.mjs`, evidence files written (`node tools/opt-evidence.mjs`), clips being rendered
for Effect review page 2.

## Notes

- No engine change is needed. Both toys draw live data with the kit's own `relief` kind (kind 24,
  lane Live input): the recipe's `screen` canvas holds each splat's color (left half) and lift
  (right half), redrawn when `screen.version()` changes. It runs in the kit's own program, so it
  works on WebGL2 and WebGPU, with labs on or off.
- **Ripple tank** (`src/optics/ripple.js`, the recipe in `src/packs/optics.js`): the wave equation
  on a 216 × 216 grid (36 × 36 cm, 1/6 cm cells), Courant number 0.5, absorbing beaches 5 cm wide
  (damping rising as the square of the depth). One relief splat per cell (one per 2 × 2 cells on a
  small budget), lifted by the height and lit on the CPU from the slope and curvature. Shown 4 times
  slower than real. Setups: double slit (default), single slit, two dippers, one dipper, plane wave,
  still water. The dotted guides are the cells whose path difference to the two slits (or dippers)
  is a whole number of wavelengths. The back wall's bars graph the time-averaged strength along the
  far side.
- **Light bench** (`src/optics/rays.js` tracing, `src/optics/bench.js` the setups and numbers): rays
  in 2D through segments and circular arcs with Snell's law in vector form, total internal
  reflection, mirrors and stops. Glass: Schott N-BK7 and N-SF11 (Sellmeier, checked against the data
  sheets). Parts are kit tokens (moved and turned by drive); rays are relief splats on a lattice of
  0.06-unit (6 mm) cells, 14 splats a cell, each able to move 1.5 cells, so a ray sample takes a
  free splat near it and moves exactly there. White light is nine wavelengths; where neighboring
  colors lie within a ray's width they are drawn as one sample of their mixed color.
- Tools: `tools/opt-shot.mjs` (a screenshot with labs on), `tools/opt-clip.mjs` (MP4 clips with a
  script of taps, drags and control changes), `tools/opt-evidence.mjs` (writes the evidence files
  with their line numbers looked up).

## Known issues

- The bench's dragged positions are not saved in a scene or link (a link opens the setup at home).
- The light bench is wide; on a phone in portrait it fills the width but not the height.

## For the Operator

- For PACKS.md (a lesson): live per-splat data without an engine change. The relief kind's 3D mode
  plus a lattice of splats lets a recipe draw lines that move anywhere (the bench's rays): put K
  splats in each cell of a lattice, give each a lift of 1.5 cells, and let each sample take a free
  splat in its own or a neighboring cell; its 8-bit offset is then exact to about 1/85 of a cell.

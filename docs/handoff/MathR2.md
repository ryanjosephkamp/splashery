# Lane Math r2: more attractors, 4D shapes and Fourier text

Prefix `mt2`. Branch `claude/lane-math-r2`. Model: Opus 5.5, at the default effort. Owns the new
Math r2 toys in `src/packs/maths.js` (and the changes it makes there to the Lorenz attractor's
neighbors, the hypercube, the Möbius strip, the Mandelbulb and Fourier circles), their entries in
the shared lists, `tests/mt2*.spec.mjs`, its `mt2-*` screenshots, its `docs/evidence/` files and
this file. How lanes work: [OPERATING.md](../OPERATING.md). The first Math lane's notes:
[Math.md](Math.md).

## Brief

Written by the Operator on October 7, 2026.

The owner's Math notes, BACKLOG.md ("Math r2" row), are the list. Read docs/handoff/Math.md first
(its "For the Operator" has lessons you need) and the Math toys in src/packs/. Build in this order,
each as real math with a short About line and its source: 1. **More dynamical systems** beside the
Lorenz attractor: Rössler, Thomas and Aizawa, integrated properly (RK4 or better, frame-rate
independent), each with its own colors and a tap that drops a new tracer. 2. **4D shapes**: the
5-cell, 16-cell and 24-cell and a duoprism beside the hypercube, rotating in 4D with correct
projection, plus color themes for the hypercube. 3. **Möbius riders**: let a few toys ride the
Möbius strip, each with a rider color and its own sound. 4. **Mandelbulb variants** (power and a
Julia-style variant) at a smooth phone tier. 5. **Fourier circles**: longer text (no six-letter
limit) and lighter circles behind 2D text. Keep the existing Math toys working and their links
loading.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
replace the prefix and lane record with yours). New toys go behind the labs switch (`labs: true`);
the Operator merges labs work after a full test run (the Integrators run it). Finish every working
turn with "READY:", "WORKING:" or "BLOCKED:"; Splashery has no CI to wait for; for a long job,
schedule a check-in with send_later instead of going idle. Clips at phone size go on Effect review
page 2 (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as docs/OPERATING.md, "Steps for a lane",
says (no republish), ids mt2-…. New sounds go in tools/sound-review.json as "ready" (the owner hears
them on the Sound Board), not as cards. Evidence that the science or math is right goes in
docs/evidence/ (see the existing files). Before READY, re-read CLAUDE.md's "Effect quality rules"
and check each clip against them at phone size. Aim for a first READY within about six hours, then
polish rounds on the owner's marks. The push pace ends at the weekly reset (20:00 UTC today); after
it about six workers run, so keep going at an even pace. Your Operator is
session_012GmKRUMZLir2nb27Bo8Cu2.

## State

Started October 7, 2026. Branch `claude/lane-math-r2`; draft PR #392, "Phase Math r2: more
attractors, 4D shapes and Fourier text". All five items are built; clips go on Effect review page 2
(lane `MathR2`, cards `mt2-*`).

1. **Attractors** (labs): `rossler-attractor`, `thomas-attractor`, `aizawa-attractor`. The path is
   one long RK4 solution; a tap drops a live tracer (fixed RK4 steps, frame-rate independent) at the
   tapped point (Play: on the path), each with a trail; four at once, a fifth replaces the oldest;
   one runs from the start.
2. **4D shapes** (labs): `five-cell`, `sixteen-cell`, `twenty-four-cell`, `duoprism` (p and q 3 to
   6). Corners are tokens turned in the xw and yw planes and projected from 4D; a tap rolls a whole
   turn through w (5 s). Seven color themes, also on the **hypercube** (default unchanged).
3. **Möbius riders** (public toy): a toy train, a ladybug and a skateboard, each with its own ride
   sound, and a Rider color option for every rider ("Its own" keeps the old colors).
4. **Mandelbulb** (public toy): Power (5 to 12; the slices turn 1/(n − 1) of a turn) and a Julia
   bulb (four points c off the axis; it has no turning symmetry, so the whole bulb turns a quarter
   turn and back). Default (power 8, Mandelbulb) builds exactly as before.
5. **Fourier circles** (public toy): words up to 40 letters, laid out in lines of up to 10, drawn
   five letters at a time (the groups share the tokens and take turns, 2.6 s each); lighter, thinner
   circles behind words in 2D. Up to six letters behave as before.

Tests: `tests/mt2.spec.mjs` (12 Node-side checks plus 7 screenshot tests). Evidence:
`docs/evidence/{rossler,thomas,aizawa}-attractor.json`, `five-cell`, `sixteen-cell`,
`twenty-four-cell`, `duoprism`.

## Notes

- **Live tracers with tokens and skin.** Each tracer is 12 tokens: the head and 11 points behind it,
  read from a ring buffer of past states; the trail is round splats skinned between neighboring
  tokens, all built at the middle. Each tracer is also a part, so an unused one hides (part
  visibility hides token and skin splats too). `out.resort` every 0.3 s keeps them sorted where they
  are.
- **State kept between frames** is keyed on `info.data` (a fresh object per build), so a rebuild
  starts clean; the first frame's tap count is taken as already seen.
- **Turning symmetry of the Mandelbulb**: power n gives n − 1-fold symmetry about the axis. A Julia
  point on the axis keeps it, but then (r, θ) evolve without φ and the set is a plain solid of
  revolution, so the Julia points are off the axis.
- **A control's ease can change per build**: motion.js reads `def.ease` each frame, so the Fourier
  build sets the spin's length for long text.
- `tools/effect-clip.mjs --opt` takes one option; for clips with two I patched it locally
  (`key=value;key=value`) and did not commit that.

## Known issues

- The 4D shapes and the hypercube sort their edges again only while they roll; at rest they rock
  gently in their built order, as the hypercube always has.
- Long Fourier text is wide (10 letters a line), so on a phone the letters are small.
- The Fourier tap sound is 5 s long; long text spins longer than its sound.
- The Möbius riders' new ride sounds are cues from the recipe, heard in the toy, not on the Sound
  Board.

## For the Operator

- PACKS.md lesson: a moving trail is tokens plus skinned splats between them (any number of tracers,
  each a part to hide it).
- PACKS.md lesson: a control's `ease` is read each frame, so a build can set an effect's length
  (long Fourier text).
- Engine idea: `tools/effect-clip.mjs` taking several `--opt` values would help lanes with
  option-heavy toys.
- No exceptions needed in `tests/taps.spec.mjs`.

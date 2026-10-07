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

Started October 7, 2026. Working on item 1 (the attractors).

## Notes

## Known issues

## For the Operator

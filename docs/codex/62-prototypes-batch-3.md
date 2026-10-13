# Codex task 62: five more Codex prototypes into labs toys (computing, sound, fields, and color)

**Branch:** `codex/prototypes-labs-3`, cut from `main`. One draft PR against `main`.

Same task as `docs/codex/49-prototypes-to-labs.md` (read it first, and follow its goals, tests and
report exactly) for five prototypes from October 11, 2026:

- **#512 Pathfinding race** (`codex/proto-pathfinding`): BFS, Dijkstra, A\* and greedy best-first on
  the same maze, step by step, with nodes visited and path length counted and checked.
- **#519 Room acoustics designer** (`codex/proto-room-acoustics`): reverberation time by Sabine's
  and Eyring's formulas with real absorption coefficients (cite the table), checked on a worked
  example.
- **#520 Electric field lines** (`codex/proto-field-lines`): Coulomb fields of movable charges,
  field lines traced with a proper integrator, equipotentials, and a check of the field at a point
  by hand.
- **#521 Doppler effect lab** (`codex/proto-doppler`): moving source and listener, the real Doppler
  formula, wavefronts drawn to scale, and the pitch you hear matching the number shown.
- **#522 Color space camera** (`codex/proto-color-space-camera`): the camera only after a tap (Rules
  v1, C3; nothing recorded or sent), each pixel placed in RGB, HSV or CIELAB space as a splat cloud;
  conversions checked against reference values.

If task 49 or 61 has merged, reuse their helpers; if not, don't edit their files. Don't touch the
files of the open PRs (#560, #562, #566, #581 and #582), the engine or `vendor/`. Clips go on
`codex/prototypes-labs-3-clips`, never merged.

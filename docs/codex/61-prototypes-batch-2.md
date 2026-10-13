# Codex task 61: four more Codex prototypes into labs toys (math, Space, and science)

**Branch:** `codex/prototypes-labs-2`, cut from `main`. One draft PR against `main`.

Same task as `docs/codex/49-prototypes-to-labs.md` (read it first, and follow its goals, tests and
report exactly) for four other prototypes from October 11, 2026:

- **#510 Double pendulum chaos** (`codex/proto-double-pendulum`): the real equations of motion with
  an energy-conserving integrator; two pendulums started a hair apart that visibly diverge; energy
  drift reported and kept small.
- **#511 Orbit transfer planner** (`codex/proto-orbit-transfer`): Hohmann and bi-elliptic transfers
  with the real vis-viva equation; delta-v numbers checked against a worked example (Earth to Mars).
- **#514 Logistic map** (`codex/proto-logistic-map`): the bifurcation diagram, a cobweb plot, and
  the Feigenbaum constant estimated from the first period doublings and checked against its known
  value.
- **#516 Projectile with air drag** (`codex/proto-projectile-drag`): quadratic drag with a real drag
  coefficient per ball, range compared with the vacuum case, checked against a published table.

If task 49 has merged, reuse its helpers; if it hasn't, don't edit its files. Don't touch the files
of the open PRs (#560, #562, #566, #581 and #582), the engine or `vendor/`. Clips go on
`codex/prototypes-labs-2-clips`, never merged.

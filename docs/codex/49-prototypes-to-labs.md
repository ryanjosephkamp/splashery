# Codex task 49: three Codex prototypes into finished labs toys

**Branch:** `codex/prototypes-labs`, cut from `main`. One draft PR against `main`.

Codex built twelve prototype toys on October 11, 2026 (PRs #510 to #522, branches `codex/proto-*`).
The owner picked three to finish first: **#518 Truss bridge load lab**, **#515 Gear train lab** and
**#517 Coupled oscillators** (branch `codex/proto-normal-modes`). Read each prototype's PR and
branch, `AGENTS.md`, `builders/RULES.md`, `docs/PACKS.md` and CLAUDE.md's "Effect quality rules".

## Goal

Each of the three becomes a toy that belongs on the Science or Tools shelf, behind the labs switch:

1. **Real physics, checked.** Truss: member forces by the method of joints (or a stiffness solve),
   shown as tension and compression colors with numbers on tap; a load you can drag; a member that
   fails past its limit and breaks into real pieces. Gears: correct ratios, torque and speed through
   the train, teeth that mesh (no overlap or gap) at every angle. Oscillators: normal modes from the
   real eigenvalue problem, energy that moves between masses, and damping you can set. Put the
   equations and a check against a hand-worked case in `docs/evidence/` and a test file.
2. **Splats first, hybrid where it reads better** (Rules v1 allows hybrids, labeled "hybrid" where
   they show): solid parts move as solid pieces; text and numbers crisp at phone size.
3. **Hands-on:** works by touch at 390×844; a tap does something you can read at a glance; Reset
   returns home. Each gets a how-to line and About text (`src/toy-help.js`), a sound
   (`src/toy-sounds.js`), a plan entry (`tools/toy-plan.json`), a thumbnail, and its row in
   `src/toys.js` with the labs flag; edit only your own lines in those shared lists.
4. **Tests:** `tests/cdx-proto*.spec.mjs` (physics numbers, touch, Reset), and `taps`, `help`,
   `hta`, `unit`, `kit` and `smoke` still pass. Never edit `tests/taps.spec.mjs`.

## Don't touch

Files the open PRs change (#560, #562, #566, #570, #576), the engine (`src/` outside your new packs
and your lines in the shared lists), and `vendor/`. If you truly need an engine change, make it a
separate small additive PR titled "Engine: …" and say why.

## Report

Render a phone-size clip of each toy in use (`tools/effect-clip.mjs`) on a branch
`codex/prototypes-labs-clips` that is never merged, link the clips in the PR body, and list per toy
what was checked and how. Close nothing: the Operator closes the prototype PRs when this merges.
Before you push: `npx prettier --check .` and `node tools/us-english.mjs --diff` are clean.

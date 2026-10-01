# Lane Shelves

## Brief

Your lane: Shelves, "Tidy the shelves: a torus, the donut in Food, the tiny planet in Space" (prefix
`shv`). Branch: claude/lane-shelves. PR title: "Phase Shelves: the shapes shelf tidied, the donut in
Food, the tiny planet in Space". Handoff file: docs/handoff/Shelves.md. A small lane.

(Written by the Operator on September 30, 2026, from the owner's notes and his "shelves yes" that
day.)

In his notes of September 28 (docs/reviews/2026-09-28-sounds/review.md), the owner questioned the
Shapes shelf. He asked why the donut is in Shapes and not in Food, why the tiny planet is in Shapes
and not in Space, and whether the jelly blob is a shape. He suggested that Shapes keep a plain torus
people can dress as a donut, a bagel or a swim ring, and that the crystal ball leave Gems ("I don't
believe that it belongs under gems"). The Operator proposed a plan, and he answered "shelves yes"
(September 30, 2026, 3:25 p.m. ET):

1. **The crystal ball moves to Medieval,** next to the wizard's orb (its `category` only).
2. **The donut moves to Food.** Its id, look, tap and links stay exactly as they are.
3. **A new toy in Shapes: "Torus".** A plain torus, sharp and even (PACKS.md 7c), with a "Dress it
   as" choice: plain (a clean geometric torus with a subtle material), donut (reuse the donut's
   look), bagel (a real, glossy, seeded bagel) or swim ring (striped, with a soft plastic sheen).
   - Its tap is a real effect under the effect quality rules. For example, it rolls on its edge,
     wobbles and settles, and each dressing keeps the same physical motion. Choose what reads best
     at phone size.
   - A sound that follows PACKS.md 7e: a soft roll and settle, with no clicks or whistles.
   - Help line, About text, plan entry and thumbnail, like any toy.
4. **The tiny planet moves to Space,** with other planets to pick: "Planet: Earth (default), Mars,
   the Moon, Jupiter, Neptune", in the same tiny-planet style (it's "A tribute to Splashery v1", so
   keep its character). Flag themes keep working.
5. **The jelly blob and the neon knot stay in Shapes for now.** A Knots shelf with knot settings is
   in the backlog; don't build it.

Old `#s=` links and saved scenes (schema v2 and v3) must keep loading: ids don't change. The site's
default toy and the gallery's order within each shelf stay sensible. Say in your PR what someone
sees first on a fresh visit, before and after.

tests/smoke.spec.mjs clicks the Shapes and Food chips and may expect the donut or the tiny planet
there. Don't edit it: name each failing line and why in your message, and the Operator updates it.
The same goes for any other finished lane's test that counts shelves.

Cards (clips at 390×844, each labeled "built by Opus 5.5", in the lane record `Shelves` on the
Effect review page; ask the Operator in your message if the record is missing):

- `shv-torus`: the torus in each dressing, and its tap;
- `shv-planets`: the tiny planet as each planet;
- `shv-shelves`: stills of the Shapes, Food, Space, Gems and Medieval shelves in the gallery, before
  and after.

These are public toys, so the PR merges after the owner's good marks.

Tests in tests/shv.spec.mjs:

- each moved toy is on its new shelf, with the same id;
- an old `#s=` link to the donut, the tiny planet and the crystal ball still opens them;
- the torus builds in each dressing within its splat budget, and its tap runs;
- each planet choice builds;
- screenshots at 390×844 and 1440×900 (`shv-*`).

## You own

- the new torus toy's recipe, in a new pack file `src/packs/shapes-torus.js` or wherever the shapes
  live (tell the Operator which);
- the tiny planet's generator options;
- the `category` fields of the crystal ball, the donut and the tiny planet;
- these toys' entries in the shared lists (src/toys.js, src/toy-sounds.js, src/toy-help.js,
  tools/toy-plan.json);
- tests/shv.spec.mjs, your `shv-*` screenshots and docs/handoff/Shelves.md.

Don't change the donut's or the crystal ball's recipes. Fix5 is renaming the scanned alarm clock,
and Sound A and B own the sounds of the existing toys (Sound A has the shapes and gems, Sound B the
food): leave those toys' sound entries alone.

Lanes Fluids r4, Science, Video 3D, Worlds r3, Sound A and B, Fix5, Live input and the Integrators
run at the same time; leave their files alone. The laptop is locked.

## State

Model: Opus 5.5 (default effort).

- September 30, 2026: lane started on `claude/lane-shelves` from main at 0354a1f.
- Engine PR #147 (`claude/lane-shelves-engine`): procedural shelf toys can offer looks (generator
  settings), `lookOption()` takes `lookLabel`, and four tiny-planet palettes (mars, moon, jupiter,
  neptune). Merged into this branch; it must merge first.
- Lane PR #148: the crystal ball in Medieval (after the wizard's orb), the donut in Food (after the
  macarons), the tiny planet in Space (after Neptune) with its Planet choice, and the new Torus in
  Shapes (`src/packs/shapes-torus.js`) with four dressings, its wobble tap and its sound.
- tests/shv.spec.mjs: 15/15 pass. Full suite (in parts, after two container restarts): 579 of 581
  pass; the two failures are the smoke.spec.mjs lines the move changes (lines 102 and 133).
- Cards on Effect review page 2: `shv-torus`, `shv-planets`, `shv-shelves`, all marked good by the
  owner (September 30, 2026).

- October 1, 2026: engine PR #147 merged (main 6333e79); main merged into this branch (15 files
  differ from main now). Post-merge checks: unit, shv, help, taps, hta, fx5 and snda-engine pass,
  102/102. `tools/sound-lint.mjs --toy torus`: no violation (the roll now sits just under the
  opening pop). Head c13f484 before this note.

## Notes

- The torus's pack is `src/packs/shapes-torus.js` (a new pack; the other Shapes are procedural
  generator presets with rigs in `src/rigs.js`, so there was no shapes pack to join).
- The wobble is Euler's disk: the whole toy turns about a level axis that circles (`out.body.quat`),
  tilting at most about 60°, so the draw order holds without a second copy. The center lifts by 0.62
  of what a real table contact would give, which keeps the standing ring inside the frame without a
  `k.reach` (a reach point shrank the resting toy and pushed it low in its thumbnail).
- Clip tools: `tools/shv-clip.mjs` (a toy through several Toy tab choices as one labeled 390×844
  clip) and `tools/shv-shelves.mjs` (shelf stills before and after, from two servers).

## Known issues

- `tests/smoke.spec.mjs:133` expects Shapes to be blob, donut, knot, planet; it is now torus, blob,
  knot. `tests/smoke.spec.mjs:102` expects the donut's thumbnail loaded at start; it is now far down
  the All shelf. The Operator updates those lines.

## For the Operator

- smoke.spec.mjs line 133: change the expected Shapes list to `["torus", "blob", "knot"]`.
- smoke.spec.mjs line 102: its list of thumbnails loaded at start names the donut and the tiny
  planet, which now sit far down the All shelf (Food, Space), so their lazy thumbnails haven't
  loaded; swap them for `"torus"` (or drop them). The test's later check, which loads every
  offscreen thumbnail, still covers them.
- PACKS.md: a procedural shelf toy may now list `looks` with `generator` settings and a `lookLabel`
  (engine PR #147).
- The four new palettes show in the Make tab too, labeled "(tribute)".

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

**Finished: merged October 2, 2026.** Engine PR #147 merged on October 1 (main 6333e79), and lane PR
#148 merged on October 2 (main 8c961ed, from head 3883fdf). The owner marked all three cards good
(September 30) and called the torus and the moved toys fine in his review of October 2.

What shipped:

- The crystal ball is in Medieval (after the wizard's orb), the donut in Food (after the macarons)
  and the tiny planet in Space (after Neptune). Ids, looks, taps, sounds and old links are
  unchanged.
- The tiny planet has a Planet choice in the Toy tab: Earth (default), Mars, the Moon, Jupiter and
  Neptune, in the same v1 style (#147: procedural shelf toys can offer looks with generator
  settings, `lookOption()` takes `lookLabel`, and four new palettes).
- A new Torus in Shapes (`src/packs/shapes-torus.js`) with four dressings (plain, donut, bagel, swim
  ring), a wobble tap like a coin spun on a table (3.6 s) and a soft roll sound. The Shapes shelf is
  now Torus, Jelly blob, Neon knot.
- `tests/shv.spec.mjs` (15 tests) and two lines of `tests/smoke.spec.mjs` (102 and 133, with the
  Operator's approval) for the new shelves.

Tests: the last run on head 3883fdf passed 141/141 (shv, smoke, unit, taps, hta, help); the
Operator's run on main 2ba6455 with the lane passed 145/145, and Integrator 2's full run 674/675
(the one failure, wd.spec:210, fails on main alone too).

Cards on Effect review page 2: `shv-torus`, `shv-planets` (MP4s) and `shv-shelves` (stills), all
good.

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

- None known. The two `tests/smoke.spec.mjs` lines the move changed (102 and 133) were updated in
  #148 with the Operator's approval. Integrator 2 also found that the planet palette test called
  `expect` once per splat and blocked its worker; it now checks the splats in plain loops and
  asserts once.

## For the Operator

- PACKS.md: a procedural shelf toy may now list `looks` with `generator` settings and a `lookLabel`
  (engine PR #147); the tiny planet is the example.
- The four new palettes show in the Make tab too, labeled "(tribute)".
- PACKS.md lesson for tests: never call `expect` once per splat in a loop over a buffer (150,000
  calls blocked a worker past its timeout); collect the bad ones and assert once.
- The Shelves lane on Effect review page 2 can be set `finished`.

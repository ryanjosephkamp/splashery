# Lane E6a: Balls

Prefix `e6a`. Owns `src/packs/balls.js`, `tests/e6a.spec.mjs`, this file, its toys' folders under
`assets/toys/` and their entries in the shared lists (docs/WORKSTREAMS.md). How lanes work:
[OPERATING.md](../OPERATING.md). Earlier phases' notes and lessons: [history.md](history.md).

## Brief

Written by the Operator on 2026-09-26, from the E6 outline ("E1–E6, new effects": one wave per
session, following TOY-PLAN.md) split by lane.

Before starting, do a lane's start (OPERATING.md): check the owner's marks on the Toy Plan page for
your toys for any later change. Follow the Effect quality rules in CLAUDE.md ("Games follow real
rules. Balls and discs move like the real thing when thrown or hit."), the draw-order lessons and
the channel kinds in docs/PACKS.md (6 and 7b), and post clips of every new effect on the Effect
review page (OPERATING.md, "Steps for a lane").

1. **Toys (20 new).** Basketball, soccer ball, tennis ball, baseball, softball, beach ball, golf
   ball, volleyball, water polo ball, ping-pong ball, cricket ball, bowling ball, pool ball,
   pickleball, dodgeball, medicine ball, lacrosse ball, squash ball, bouncy ball, marble. Build each
   planned effect (TOY-PLAN.md, the balls in wave E6) as `controls`, `action` and `drive()` in its
   recipe (`src/packs/balls.js`). The balls already marked keep (the American football, rugby ball,
   hockey puck, shuttlecock and flying disc, redone in E1b and E1c) stay as they are.
2. **Real throws and bounces.** The right spin, a real arc, bounces that lose height, and each
   ball's own bounciness: a dead squash ball, a lively bouncy ball, a heavy medicine ball. Where the
   plan puts a ball in its game, the game follows the real rules.
3. **Look.** The balls have baked soft light and gloss (`lit()`), pebble bumps (`grip()`), felt fuzz
   on the tennis ball and a faint rim (`rim()`) from C1; keep that look (history.md, "Visual fixes
   (C1)"). A ball that spins past a quarter turn needs the draw-order care in PACKS.md 7b.
4. **Sounds.** Re-time each toy's sound to its new effect with `tools/sound-check.mjs` (under five
   seconds; `out.cues` for each later bounce). Only the Operator republishes the Sound Board; if the
   owner wants to hear yours before the merge, publish your own copy (OPERATING.md).
5. Check each effect with `tools/effect-clip.mjs --strip=8`, look at a larger still of its fullest
   moment, re-render thumbnails only where the resting look changes, mark each finished toy
   `"v": "keep"` with an `improved` entry, and regenerate TOY-PLAN.md. `tests/taps.spec.mjs` checks
   each finished toy's tap by itself; put any extra tests in `tests/e6a.spec.mjs`. The standard
   `balls-*` screenshots are the Operator's; save yours as `e6a-*`.

**Done when:** every ball has its own tap effect (or the PR lists which do not, and why), all tests
pass and prettier is clean.

PR title: "Phase E6a: new tap effects for the balls".

## State

2026-09-26: started (session https://claude.ai/code/session_01WRMAsMCm1HekeLSMVgJPW2, branch
`claude/blissful-noether-4w5y0t`, draft PR
[ryanjosephkamp/splashery#38](https://github.com/ryanjosephkamp/splashery/pull/38)). The owner's
marks on the Toy Plan page: all 20 balls "yes" with no notes, so the plan in `tools/toy-plan.json`
stands as written. Main merged (up to date at `fb6c81d`).

All 20 balls have their tap effect and a re-timed sound, and are marked `keep` with an `improved`
line. Their clips and cards (`e6a-<toy id>`) are on the Effect review page in three groups (thrown,
hit and kicked; bounces and squashes; floating, bobbing and rolling), posted 2026-09-26. The lane
now waits for the owner's marks and fixes any "Needs work" in the same PR (new clips as `-r2`).

## Notes

How the balls move (all in `src/packs/balls.js`, "Real throws and bounces (E6a)"):

- **Plans.** Each ball's tap is a plan of legs (`plan()`): free flights under the ball's own gravity
  (`grav(r)`: a slowed-down real g over the real ball's radius, so a big ball falls slowly for its
  size and a small one snaps), contacts that squash on the floor, rolls (straight, or along any path
  with `rollPath`, which turns the ball step by step), spins in place and custom paths. `bounces()`
  makes a run of bounces that lose height by the ball's restitution (a real value per ball: 0.9 for
  ping-pong, 0.83 lacrosse, 0.78 basketball and soccer, 0.75 tennis, 0.5 baseball, 0.2 to 0.5 for a
  squash ball as it warms, almost none for the medicine ball). `throwBall()` turns a plan into the
  recipe's pulse, drive and later sounds (a leg's `cue`).
- **Back to rest exactly.** The spins about each axis are scaled (as little as will do, one way or
  both) so they come to whole turns, and a leg marked `absorb` takes up anything left (the bowling
  ball's return roll), so every tap ends with the ball exactly as it rests. `tests/e6a.spec.mjs`
  checks it for all 20.
- **Draw order.** A moving ball is its own part ("ball", its inside "core"). While turned, the shell
  culls its far side (splats a little bigger, `CULL_SIZE`) and the core hides, so the far side never
  draws over the near side (PACKS.md 7b). Most spins are about an axis close to the view direction
  (`TOWARD`), which keeps the order anyway in the home view. Two small caps cover the poles of the
  sphere's even placement, which show as a swirl once a spin turns them into view.
- **Glossy balls keep their light.** Baked light turns with a spinning ball, so a rolling pool ball
  looked like glass and the cricket ball's shine swung round. The pool, cricket, baseball and
  softball now spin as an unlit copy ("spin", built tiny at the centre so it always sorts behind,
  grown by its part) under a fixed see-through layer of light ("light", `glossSpin()`), calibrated
  on renders against the ball at rest (`LIGHT_OVERLAP`). They ask for twice the splats
  (`density: 2`) so the ball at rest keeps its own.
- **Effect pieces are built inside the ball.** The app frames a toy (and puts its floor) by all its
  splats, and the kit fits it by the farthest one, so the fingertip, splash, ripples and dust are
  built inside the ball's sphere and moved or grown by their parts, hidden at rest.

## Known issues

- The American football (kept as it was, E1b) ends its spiral half a turn round and snaps back at
  the end, and while upside down its laces show through the ball (the draw-order problem above). Not
  changed here, as the brief asked; a small fix for a later lane.
- A spinning ball can show a thin dark line along part of its outline when it has turned more than a
  quarter turn against the view (far-side splats in the engine's soft cull band). Barely visible at
  phone size.
- The unlit spinning copy of the four glossy balls is built too small to map a flag pattern, so a
  flag shows on them only at rest.

## For the Operator

Lessons for PACKS.md, backlog items and README lines, to move after the merge.

- PACKS.md 7b (draw order): a single spinning body can use the part's `cull` flag instead of copies:
  cull while turned, hide the inside, splats about 1.15 times bigger. Spinning about an axis near
  the view direction keeps the order without it.
- PACKS.md 7b (materials): baked light turns with a spinning body. For a glossy one, spin an unlit
  copy built tiny at the centre (it sorts behind everything, for any camera) under a fixed
  see-through layer of light (`glossSpin()` in `src/packs/balls.js`).
- PACKS.md 7b (hidden pieces): the app frames a toy by all its splats (`buf.bounds()` in
  `src/player.js`), not only the fit, so effect pieces must be built inside the toy even with
  `fit: false`.
- PACKS.md 3: even placement on a sphere leaves a small swirl at the poles; cover them with caps if
  the sphere turns (`poleCap()`).
- Backlog: the American football's end (above).
- A smoke test fails in this sandbox on main as well as on this branch: "rigs pick splats by colour,
  run effects and show add-ons" (`tests/smoke.spec.mjs`); the strawberry has not settled back 3 s
  after its tap (about 68,000 pixels differ against a limit near 14,000 on main). Nothing in this
  lane touches it; worth a look by whoever owns the scan rigs.

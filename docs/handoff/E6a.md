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

Not started.

## Notes

## Known issues

## For the Operator

Lessons for PACKS.md, backlog items and README lines, to move after the merge.

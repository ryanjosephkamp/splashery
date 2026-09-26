# Lane E6b: Landmarks and friends

Prefix `e6b`. Owns `src/packs/landmarks.js`, `src/packs/animals.js`, `src/packs/medieval.js`,
`src/packs/holidays.js`, `tests/e6b.spec.mjs`, this file, its toys' folders under `assets/toys/` and
their entries in the shared lists (docs/WORKSTREAMS.md). How lanes work:
[OPERATING.md](../OPERATING.md). Earlier phases' notes and lessons: [history.md](history.md).

## Brief

Written by the Operator on 2026-09-26, from the E6 outline ("E1–E6, new effects": one wave per
session, following TOY-PLAN.md) split by lane.

Before starting, do a lane's start (OPERATING.md): check the owner's marks on the Toy Plan page for
your toys for any later change. Follow the Effect quality rules in CLAUDE.md, the draw-order lessons
and the channel kinds in docs/PACKS.md (6 and 7b), and post clips of every new effect on the Effect
review page (OPERATING.md, "Steps for a lane").

1. **Toys (18 new).** Build each planned effect (TOY-PLAN.md, wave E6) as `controls`, `action` and
   `drive()` in its recipe:
   - Landmarks (`src/packs/landmarks.js`): Eiffel Tower, Washington Monument, pyramids, supertall,
     Statue of Liberty, White House, Leaning Tower, Colosseum, Parthenon, Stonehenge, Taj Mahal.
   - Animals (`src/packs/animals.js`): school of fish, nautilus, sea urchin, frog.
   - Medieval (`src/packs/medieval.js`): shield, crown.
   - Holidays (`src/packs/holidays.js`): snowman.

   The toys in these packs already marked keep stay as they are.

2. **Respect (the owner, 2026-09-23).** Nothing destructive or disrespectful on the White House or
   the Washington Monument, and no fighting or gore: the Colosseum gets a chariot race, not
   gladiators. No logos or brand names; flags stay respectful.
3. **Animals move like the real thing** (CLAUDE.md), and separate things move separately (each fish
   in the school).
4. **Sounds.** Re-time each toy's sound to its new effect with `tools/sound-check.mjs` (under five
   seconds; `out.cues` for later sounds). Only the Operator republishes the Sound Board; if the
   owner wants to hear yours before the merge, publish your own copy (OPERATING.md).
5. Check each effect with `tools/effect-clip.mjs --strip=8`, look at a larger still of its fullest
   moment, re-render thumbnails only where the resting look changes, mark each finished toy
   `"v": "keep"` with an `improved` entry, and regenerate TOY-PLAN.md. `tests/taps.spec.mjs` checks
   each finished toy's tap by itself; put any extra tests in `tests/e6b.spec.mjs`.

**Done when:** every toy in the list has its own tap effect (or the PR lists which do not, and why),
all tests pass and prettier is clean.

PR title: "Phase E6b: new tap effects for the landmarks, animals, shield, crown and snowman".

## State

Not started.

## Notes

## Known issues

## For the Operator

Lessons for PACKS.md, backlog items and README lines, to move after the merge.

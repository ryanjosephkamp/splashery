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

Session: https://claude.ai/code/session_01D75yHccYeL9b2vKuqy5gEB, branch `claude/cool-curie-kmdm6f`,
draft PR https://github.com/ryanjosephkamp/splashery/pull/36.

- 2026-09-26: lane started. The owner's Toy Plan marks for all 18 toys are "yes" with no notes, so
  the plan in `tools/toy-plan.json` stands. Main merged (at #34).
- 2026-09-26: all 18 effects and sounds built and checked as stills and clips; the 18 toys are
  `"v": "keep"` with an `improved` entry and TOY-PLAN.md is regenerated. Lane tests in
  `tests/e6b.spec.mjs`. All 18 clips are on the Effect review page (cards `e6b-<toy id>`, in three
  sections: landmarks, animals, and shield, crown and snowman), waiting for the owner's marks.
- Lane end done: check-packs (every toy under 0.7 s), contact sheet, sound check (18 sounds OK, all
  under 5 s), screenshots `tests/screenshots/e6b-*`, full test suite, standard screenshots restored,
  prettier clean. Only the school of fish's thumbnail changed (its fish are now separate pieces);
  every other toy rests and is framed exactly as on main.
- 2026-09-26: the owner marked all 18 clips "Looks right" on the Effect review page. Main merged
  again (E4-finish #37 and the Operator's #39 and #40), with no conflicts; TOY-PLAN.md regenerated
  and unchanged.
- Next: the PR waits for the owner's merge; merge main into the branch whenever it moves.

## Notes

What each tap does now (the `improved` entries in `tools/toy-plan.json` have the full text):

- **Landmarks.** Eiffel Tower: gold night lights, a climbing sparkle and four fireworks (blue,
  white, red, gold). Washington Monument: a sundial day (the sun arcs behind it and the shadow
  swings round the lawn) while the flags ripple. Pyramids: a tiny saucer beams a camel of sand up
  from the desert. Supertall: twelve floor bands wring round further while rings of light run up.
  Statue of Liberty: the torch flares and a plume of sparks drifts away. White House: the fountain
  jets up and the windows light one by one. Leaning Tower: Galileo's drop (two balls land together).
  Colosseum: a four-team chariot race with a cheering crowd (no fighting). Parthenon: a procession
  of robed figures. Stonehenge: a solstice sunrise through the great trilithon. Taj Mahal:
  moonlight.
- **Animals.** School of fish: each fish is a token (48, was 52); bait ball, burst, regroup.
  Nautilus: jets back and pulls its tentacles in behind the hood, peeks out. Sea urchin: spines tilt
  in waves (three channels a third of a cycle apart), tube feet reach out, it creeps. Frog: catches
  a fly with its tongue, swallows with its eyes and croaks with its throat sac.
- **Shield** blocks an unseen blow (rocks, sparks, a gleam). **Crown** lifts, its jewels light in
  turn. **Snowman** melts as solid pieces (no `melt` squash) into a puddle and rebuilds; the Warmth
  slider drives the same melt.
- Deviations from the plan text: the Washington Monument has no reflecting pool in its model, so its
  shadow sweeps like a sundial's instead of a pool shimmering; the White House flag stays at the top
  of its pole (lowering it could read as half-mast) and ripples instead of being raised.
- Scratch tools (in `.cache/`, not committed): `stills.mjs` renders chosen moments after a tap at
  any size and camera (quicker than a clip for tuning), `appshot.mjs` takes an app screenshot a set
  time after a tap, and `framedbg.mjs` compares a toy's fitted scale and camera radius with main's.

## Known issues

- The chariots and fish turn full circles about the vertical, so small draw-order slips are possible
  (as with every orbiting toy); none showed in the clips.
- Pisa: the small bronze ball starts on the far half of the top ledge, so from the home view it is
  hidden until it rolls to the edge and drops; both balls are in clear view as they fall and land.
- The pyramids' saucer, camel and beam, the Statue of Liberty's sparks and the Eiffel Tower's
  fireworks reach outside the toy's resting frame at their fullest; they stay in view at the home
  camera but can leave the frame if the view is zoomed right in.

## For the Operator

Lessons for PACKS.md, backlog items and README lines, to move after the merge.

- Draw order for walkers (PACKS 7b rule 7): figures that walk towards the camera must be built at
  the point of their path nearest the camera (the Parthenon's procession disappeared under the rock
  when built where it started).
- Negative glow darkens: `out.glow` with negative colours on a `band` layer makes night fall (the
  Taj Mahal) or casts a moving shadow (the Washington Monument's sundial shadow is a band on the
  ground at each splat's bearing).
- A sustained light from a `band`: give it `params: [1, 0.5]` and hold its channel partway (for
  example 0.5 to 0.7); the glow's strength then follows the channel (the Eiffel Tower's gold lights,
  Stonehenge's gold stones).
- A travelling wave with morphs: split the moving pieces between three channels driven a third of a
  cycle apart (the sea urchin's spines).
- A morph target that should grow out of a hidden spot (a tongue, sparks, sand) is built bunched up
  at the spot and morphs out to its full shape; build it as a cloud with `p` at rest and `to` at
  full reach.
- Hidden pieces also count in the camera's framing, not only in the fit: the player frames a kit toy
  by the bounds of all its splats (`buildKit` in `src/player.js`), so a hidden fly, moon or burst
  built outside the toy shrinks it in its frame and on its thumbnail even with `fit: false`. Build
  such pieces inside the resting bounds and move or grow them out with their part (E6b's frog,
  crown, Eiffel Tower and Taj Mahal). Worth adding to PACKS.md 7b next to "Hidden pieces count in
  the fit".
- Backlog idea: the Washington Monument's plan mentioned a reflecting pool, which the model does not
  have; a pool could be added to the diorama later if the owner wants the shimmer too.

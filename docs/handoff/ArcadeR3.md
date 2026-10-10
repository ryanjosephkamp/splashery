# Lane Arcade r3

## Brief

### Brief (written by the Operator on October 9, 2026, from the owner's walkthrough)

Read docs/reviews/2026-10-09-walkthrough/triage.md, section "Arcade r3". It is your list, game by
game. Then read docs/handoff/Arcade.md and the Arcade r2 handoff, which built these games. Volley
Table and Page Breaker are fine as they are. Anything the owner didn't mention stays as it is.

The list, in this order:

1. **Shardball.**
   - The dome is the default.
   - In the dome, the ball touching the ground ends the game, as in 2D.
   - The platform catches and holds the ball, not only at the start.
   - Turn the view a little in 3D.
   - Sharper overall.
2. **Strata.**
   - Start in 2D, like the classic falling-blocks game.
   - Make rotating a piece obvious: a visible rotate button near the thumbs, a tap on the piece, and
     keys on desktop.
   - Much sharper; maybe taller.
3. **Photo Dash.**
   - A sharper background that stays still, with no flicker.
   - A different default photo.
   - Unless the player opened their own photo, change to a new background at random after each
     level. Use photos the site already ships with a license that allows it (CC0, or the owner's
     AI-made Studio samples labeled as such). Credit each one as CLAUDE.md requires.
   - Let the player choose a ball.
   - A clearer, sharper platform.
   - A better coin sound (tools/sound-review.json, as "ready").
4. **Stone Belt** (the owner's favorite): much sharper. **Soft Landing:** sharper. **Longtail:**
   sharper, especially in 2D.
5. **Cast a Shadow** and **Grain Garden:** turn and zoom a little in 3D, to see from other angles.
   Grain Garden also sharper.
6. **Note Rider.**
   - Notes ring on too long, like a held sustain pedal. Shorten the release to fit each note's
     length.
   - Add guitar and other instruments, chosen in the game the way rhythm games do it.
   - New sounds go in tools/sound-review.json as "ready".

For sharpness, follow CLAUDE.md's Effect quality rules (no blur, no speckle) and what the Sharpness
lanes learned: docs/lab/SHARPNESS.md and the "sharp" kernel. Smaller, denser splats where the eye
looks, and crisp edges. More splats alone don't sharpen a game.

**Clips** at phone size on Effect review page 2 (card ids `arc3-…`), before and after each game,
with real play.

**You own:** src/arcade/, src/packs/arcade\*.js, the games' lines in the shared lists, and
tests/arc3\*.spec.mjs. Never edit tests/taps.spec.mjs.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
replace the prefix and lane record with yours).

- **Merging:** the arcade is behind the labs switch. Your work merges after the tests pass and the
  owner marks your cards; an engine PR merges after a full test run.
- **Ending turns:** finish every working turn with "READY:", "WORKING:" or "BLOCKED:". Splashery has
  no CI to wait for. For a long job, schedule a check-in with send_later instead of going idle.
- **Clips:** phone size (390x844; device scale 2 is fine). They go on Effect review page 2
  (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as docs/OPERATING.md, "Steps for a lane", says
  (no republish).
- **Marks with pictures:** the owner's marks may carry `images`, screenshots he attached. Read each
  with the Artifact tool's `read` (url the page, path the asset id) before you fix that card.
- **Before READY:** re-read CLAUDE.md's "Effect quality rules" and check each clip against them at
  phone size.
- **Public text:** American English and the serial comma (CLAUDE.md).
- **Pace:** your Operator is session_012GmKRUMZLir2nb27Bo8Cu2. Aim for a first READY with Shardball
  and Strata within about six hours, then the rest.

Lane details: branch `claude/lane-arcade-r3` (engine changes on `claude/lane-arcade-r3-engine`), PR
"Phase Arcade r3: the walkthrough's game notes", model Opus 5.5 at high effort, lane record
`ArcadeR3`.

## State

(October 9, 2026; built by Opus 5.5.) Draft PR #474 (`claude/lane-arcade-r3`), every item of the
brief built. No engine PR: every change is in the game kit (`src/arcade/`, used only by the Arcade
games) and the Arcade packs.

- Clips on Effect review page 2 (lane record `ArcadeR3`), each game before (main) and after, at
  phone size with real play: `arc3-shardball`, `arc3-strata`, `arc3-photo-dash`, `arc3-stone-belt`,
  `arc3-soft-landing`, `arc3-longtail`, `arc3-cast-a-shadow`, `arc3-grain-garden` and
  `arc3-note-rider` (with `-before` cards).
- The owner's marks (October 9): every card "good" but Strata's: "nearly perfect", but keep the
  classic as one version and add a copy that's a real 3D box with depth, 3D only. Done: a row of
  buttons in the game picks Classic, 3D well or Wide 3D well (a new game in that well; the kit's
  `choiceRebuild`); the 3D wells are 3D only (`views`, `forceView`), with ⟳ Turn, ⤾ Tip, ⤿ Roll and
  Drop in a 2 × 2 block, an outline where the stone will land (a frame of thin bars in its color),
  and a look round the well with two fingers (the arrows follow the view). Card `arc3-strata-r2`:
  marked "good" (October 10). Every Arcade r3 card is now marked good.
- October 10: main merged in (no conflicts); the Arcade specs pass (38).
- Sounds: Photo Dash (the coin) and Note Rider (seven instruments) are "ready" in
  `tools/sound-review.json`.
- Tests: `tests/arc3.spec.mjs` (9) and the older Arcade specs pass (37 in all); the full suite is
  for the Integrator.

## Notes

- The kit's `look` block (src/arcade/runtime.js header): in 3D, two fingers (or the right mouse
  button) turn the view up to `yaw` and `pitch` radians each way, a pinch or the wheel zooms within
  `zoom`, Q and E turn it when `keys` is set, and `api.lookBy(dx, dy)` lets a game read a one-finger
  drag as looking (Shardball: a drag that starts on the dome, not on the ground). It eases back to
  straight in 2D. The first slide into 3D (or the first game that starts in 3D) shows a "Look
  around" hint for three seconds.
- Choices that need a new game (`choiceRebuild`): the runtime rebuilds the toy with the option and
  hands over (`ArcadeRuntime.handoff`, at most 8 s old): the new game starts at once, in the
  whole-page view if the old one was in it. `views`, `look` and `forceView` may be functions of the
  options too.
- Other kit additions: `tapFire: false` (a tap in play isn't a fire press; Strata reads its taps),
  `pad`, `padLabels` and `controls` may be functions of the options, `choiceKey` (the option that
  holds a game's choice, so it starts as saved), `game.caption()` (small print on the stage: Photo
  Dash's photo credit), two action buttons beside three arrows stand one over the other, and Z turns
  too.
- Shardball: the catch and the ground apply to Shardball only (`this.r3`, false in Page Breaker,
  which extends the class). The dome's ground is at the dish's foot (y −0.82); the ball that touches
  it lies there 0.7 s, then a ball is lost. A caught ball goes on its own after 3 s.
- Strata: the classic slot is 10 by 20 stones of 0.1 units, seen through a 16° view from far off
  (nearly flat), between solid stone columns. A tap within a stone and a half of the falling stone
  turns it; further off, in the slot, it moves it one step toward the tap.
- Photo Dash: the photo is cut to the stage's shape and rebuilt when the stage changes shape by more
  than 6% (entering play mode, turning a phone). Its splats: 76% of the tier's slots for the part
  that shows. The next sample loads during each level and swaps in at the level's end.
- Tools: `tools/arc-clip.mjs` gained `look:dx;dy`, `pad:<action>` and `choose:<id>` and taps a
  game's `tapTarget()` with `head:`.

## Known issues

- The catch applies to Shardball's flat board too (the owner's note said "the platform"); one line
  limits it to the Dome if he prefers.
- In Note Rider the instrument buttons sit over the top of the track on a phone.
- Effect review page 2 plays clips muted, so the new sounds are for the Sound Board.
- The software renderer is slow with Photo Dash's 100,000-splat photo (about 0.85 s a frame); a real
  phone's GPU draws it far faster, but it was not measured on one.

## For the Operator

- Merge: #474 alone (no engine PR), after the Integrator's full run and the owner's marks.
- Three older tests in `tests/arc.spec.mjs` were updated for the owner's new defaults (Shardball's
  Dome in 3D, the catch, Strata's 10-wide slot).
- The Sound Board: Photo Dash and Note Rider have new "ready" entries.

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
  (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as docs/OPERATING.md, "Steps for a lane",
  says (no republish).
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

(October 9, 2026; built by Opus 5.5.) Started.

## Notes

## Known issues

## For the Operator

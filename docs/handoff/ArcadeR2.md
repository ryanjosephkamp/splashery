# Lane Arcade r2

## Brief

### Brief (written by the Operator on October 7, 2026, from the owner's walkthrough review)

Read the owner's own words first: docs/reviews/2026-10-06-walkthrough/notes.md (dictated on his
phone; he praised the site and asked for these refinements), then the Operator's triage in
docs/reviews/2026-10-06-walkthrough/triage.md, section "Arcade r2". That section is your list.
Anything the owner didn't mention is approved: change nothing else, and keep the look and layout he
praised.

Notes on the list:

- Read docs/handoff/Arcade.md first (the games, their packs and tests).
- Controls near the thumbs: on a phone, play/pause and 2D/3D sit at the bottom where the hands are.
  Play doubles as pause in every game that has a play button. If "Go" only starts the game, fold it
  into play or label it plainly.
- Long tail: sharper splats (check the Effect quality rules; no grain). Drag around the cube to turn
  it, the same feel as the puzzle cube. A tap on the cube steers the snake toward the tapped side
  relative to its head, so the arrows become optional (keep them).
- Grain Garden: you can't leave full screen on a phone. Find out whether the bug is in the game or
  in the app's shared full screen; if it's in the app, fix it in an "Engine: …" PR on
  `claude/lane-arcade-r2-engine`.
- Note Rider: load your own song. A MIDI file first (parsed by our own small reader, or a small MIT
  library vendored under the library rule in CLAUDE.md). An audio file only if a note converter
  works well on a phone; otherwise say plainly why not. Files stay on the device.
- New sounds for breaking bricks (Shardball) and blocks (Page Breaker; keep its special hit sound).
  Update their entries in tools/sound-review.json.
- Clips at phone size with sound on Effect review page 2 (ids arc2-…).

You own: the Arcade packs (src/packs/arcade\*.js and the arcade helpers Arcade made), their toys'
lines in the shared lists, and tests/arc2\*.spec.mjs.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
replace the prefix and lane record with yours). Your changes touch toys and pages the public sees,
so the Operator merges them after a full test run (the Integrators run it) and the owner's "good"
marks on your cards. Finish every working turn with "READY:", "WORKING:" or "BLOCKED:"; Splashery
has no CI to wait for; for a long job, schedule a check-in with send_later instead of going idle.
Clips at phone size go on Effect review page 2 (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK)
as docs/OPERATING.md, "Steps for a lane", says (no republish). Before READY, re-read CLAUDE.md's
"Effect quality rules" and check each clip against them at phone size. The push ends Wednesday,
October 7, 2026, 4 p.m. ET (20:00 UTC): aim for a first READY within about four to six hours, then
polish rounds on the owner's marks.

## State

(October 7, 2026; built by Opus 5.5.) The earlier Arcade r2 PR (#328) merged, so this round starts
fresh from main on the same branch names.

- Engine PR #366 (`claude/lane-arcade-r2-engine`): the ▶ over the stage shows pause while a game
  plays, and a press on the app's play buttons no longer pauses the game on its way to the button.
- Lane PR (`claude/lane-arcade-r2`), done so far:
  - Thumbs: on a touch screen the 2D/3D switch and the play/pause button sit at the bottom right,
    over the right thumb's buttons (every game). The play/pause button shows ▶ while the game waits
    and pause while it plays. Shardball's and Page Breaker's "Go" reads "Launch" (it launches the
    ball; it was never a start button).
  - Grain Garden: the bug was in the game kit, not the app: the row of materials (a box as wide as
    the stage) lay over the ✕ that leaves the whole-page view, so a tap on the ✕ hit the row. The
    row now lets taps through; only its buttons take them.
  - Longtail: sharper (each tile fills its cell with a solid grout rim, so the far faces no longer
    show through as streaks; finer splats, 81 a tile); a tap beside the head steers toward it; in 3D
    a drag turns the world.
- To do: Note Rider's own song (MIDI), new brick and block sounds, clips and cards.

## Notes

- Tap steering (`tapMove` in src/packs/arcade-longtail.js): the tap and the head are put on the
  screen plane of this frame's camera, and the move from the head's tile whose edge points most
  toward the tap wins; straight back is never chosen (then the side the tap is on). A press that
  starts or resumes the game isn't also an aimed tap (`input.skipTap`).
- Drag turning: `input.takeDrag()` (one finger, in stage widths) turns the 3D view on top of the
  camera that follows the head (a full-width drag is about 216°), and four seconds after the last
  drag the view eases back to following the head, so the head never stays out of sight. In 3D a
  swipe no longer steers (a drag would steer as it turned); in 2D it still does.

## Known issues

- None yet.

## For the Operator

- Merge order: #366, then this lane's PR.

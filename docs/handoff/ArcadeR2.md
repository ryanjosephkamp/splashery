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
  plays, and a press on the app's play buttons no longer pauses the game on its way to the button
  (so the ▶ could never pause a game before). Merged into this branch.
- Lane PR #372 (`claude/lane-arcade-r2`), every item of the triage done:
  - Thumbs: on a touch screen the 2D/3D switch and the play/pause button sit on the bottom row,
    between the arrows and the action buttons (over the action buttons when a game's pad has many:
    Strata, Cast a Shadow), in every game. One button plays and pauses: ▶ while the game waits,
    pause while it plays. In the app's own view on a phone the HUD's pause hides, because the app's
    ▶ beside the stage now plays and pauses the game (the engine PR). Shardball's and Page Breaker's
    "Go" reads "Launch": it launches the ball (it was never a start button; a tap starts the game).
  - Grain Garden: the bug was in the game kit, not the app's full screen: the row of materials (a
    box as wide as the stage) lay over the ✕ that leaves the whole-page view, so a tap on the ✕ hit
    the row. The row now lets taps through; only its buttons take them. The app's own focus view
    (the [ ] button) leaves fine with a game showing (checked at 390×844 with touch).
  - Longtail: sharper (each tile fills its cell with a solid grout rim, so the far faces no longer
    show through between tiles as streaks; 81 splats a tile, 39,000 for the cube); a tap beside the
    head steers toward it; in 3D a drag turns the world.
  - Note Rider: ♪ Your song in the game opens a MIDI file or a recording. The MIDI path in the Toy
    tab never worked: the tune option had no "own" choice, so the opened song was dropped for Ode to
    Joy. A recording is charted on the device by Basic Pitch (Notes).
  - Sounds: Shardball's bricks break with a marimba note (one per row, pentatonic) and a dry
    crumble, stone with a low knock and a gritty crumble; Page Breaker's blocks tear off with a real
    paper flap (`your-book-magazine.mp3`, already on the site) over a light crumple; its paddle and
    wall knocks stay. Both are in `tools/sound-review.json` (status "ready", with candidates).
  - Clips with sound: `tools/arc-clip.mjs` records the game's cues and renders them into the MP4.
- Clips on Effect review page 2 (lane record `ArcadeR2`, made by this lane): `arc2-shardball`,
  `arc2-page-breaker`, `arc2-longtail-cube`, `arc2-longtail-planet`, `arc2-longtail-ring`,
  `arc2-note-rider-own` and `arc2-note-rider-recording`. The new sounds are for the Sound Board (the
  Operator's note of October 7: the review page plays clips muted). Grain Garden's ✕ has no clip:
  the fix is a tap that now works (tests/arc2.spec.mjs checks it at phone size).
- The owner's marks (October 7): Shardball, Page Breaker and both Note Rider clips "good"; the three
  Longtail clips "fix: the apple never appears". Each reset clears the sprites, but the berry kept
  its old sprite, so from the first game on it was never drawn (a bug from round 1). Fixed and
  tested; the `-r2` clips are posted.
- Longtail's layer: 90,000 slots on a phone (the planet's finer tiles and body take 64,000 before
  the beads).

## Notes

- Tap steering (`tapMove` in src/packs/arcade-longtail.js): the tap and the head are put on the
  screen plane of this frame's camera, and the move from the head's tile whose edge points most
  toward the tap wins; straight back is never chosen (then the side the tap is on). A press that
  starts or resumes the game isn't also an aimed tap (`input.skipTap`).
- Drag turning: `input.takeDrag()` (one finger, in stage widths) turns the 3D view on top of the
  camera that follows the head (a full-width drag is about 216°), and four seconds after the last
  drag the view eases back to following the head, so the head never stays out of sight. In 3D a
  swipe no longer steers (a drag would steer as it turned); in 2D it still does.
- The game kit's new hooks (src/arcade/): `def.file` (a HUD button that opens a file through the
  recipe's `input.read`, then rebuilds the toy with the options it returns; progress and errors show
  as the stage's message), `game.attract()` (the lines under the title before a game),
  `input.takeTapPoints()` and `input.takeDrag()`, `runtime.effectState()`.
- The recording converter (src/packs/arcade-listen.js): the browser decodes and resamples to 22,050
  Hz mono; Basic Pitch (vendor/basic-pitch/nmp.onnx, 230 KB, Apache-2.0) runs two-second windows on
  the vendored ONNX Runtime Web (both load only then); notes start at onset peaks (the model's own
  decoding, without its slow melodia pass); the tune is the loudest note in E3 to C6 at each start,
  0.12 s apart at least. Each caught note plays its slice of the recording (to the next note)
  through the app's sound system (`SAMPLES.data` holds a blob URL for this page only), so the game
  never plays a wrong guessed note. Measured on a test mix (Ode to Joy on the sampled piano with
  harp chords, a plucked bass and drums, rendered from the site's own voices): the chart lands on
  97% of the melody's beats (77% with the exact pitch, which the game doesn't need), with about 60%
  more notes than the melody (other parts' starts; they only slice the recording finer). Speed: 18 s
  of audio in 3.4 s here, ONNX Runtime's load included; a phone is maybe three to five times slower,
  so a three-minute song takes about a minute, with a percentage shown. Limits: two seconds to eight
  minutes.
- Why not play the converted notes: a converter can't hear a full mix perfectly, and a wrong note
  played back sounds wrong; a slice of the real song never does.

## Known issues

- Effect review page 2 plays clips muted, with no controls, so the clips' sound can't be heard there
  (the page belongs to the Operator; it would need `controls` on its videos, or a tap to unmute).
- The recording converter is slow on a long song on a phone (about a minute for three minutes, by
  estimate; not measured on a real phone).
- In the app's own view on a phone (not the whole-page view) the pad's bottom row sits partly under
  the shelf sheet, as before this round.

## For the Operator

- Merge order: #366, then #372.
- Library: Basic Pitch's model (Apache-2.0, 230 KB, no server), vendored in `vendor/basic-pitch/`
  with its LICENSE and NOTICE, listed in LICENSES.md, loaded only when someone opens a recording in
  Note Rider. It runs on the ONNX Runtime Web the site already vendors (14 MB, loaded only then).
  Please approve under the library rule.
- src/arcade/ (the game kit Arcade made) changed in this PR (the HUD, input and runtime hooks
  above); every change there affects only the Arcade games. The engine PR holds only what the app
  itself needed (src/ui.js) and the two runtime lines its test uses.
- Effect review page 2: please give its videos `controls` (or an unmute) so the owner can hear the
  clips' sound.
- Changed sounds for the Sound Board preview: Shardball (bricks) and Page Breaker (blocks), both
  `ready` in `tools/sound-review.json`.

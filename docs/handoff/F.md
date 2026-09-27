# Lane F: Touch and drag

Prefix `f`. Owns `src/packs/playthings.js`, `src/packs/games.js`, `src/chess.js`, the input path
(pointer handling in `src/player.js` and `src/stage.js`, the grab and tap code in `src/motion.js`),
`tests/f.spec.mjs`, this file, its toys' folders under `assets/toys/` and their entries in the
shared lists (docs/WORKSTREAMS.md). How lanes work: [OPERATING.md](../OPERATING.md). Earlier phases'
notes and lessons: [history.md](history.md).

## Brief

Written by the Operator on 2026-09-26 from the F outline in the old HANDOFF.md, which read:

> **F, touch and drag interaction.** Puzzle cube: 26 cubies as parts (the part limit is 48), cube
> state in JavaScript, swipe on a face to turn a layer, plus scramble and a solved check. Chess set:
> it is a scan, so either region parts per square or a kit-built set; first a scripted famous
> public-domain game, then maybe tap-to-move. Gummy bear: drag to stretch. Newton's cradle: drag a
> ball back and let go. Bricks: build a random model each tap.

What has changed since that outline:

- A toy has at most 15 parts; 48 is the limit for tokens (`MAX_TOKENS` in `src/motion.js`). The
  cube's 26 cubies will need to be tokens.
- The chess set is a kit toy now (`src/packs/games.js`, E1b): its 32 pieces are tokens with 16
  hidden spares, and it plays Morphy's Opera Game or a loaded PGN (`src/chess.js`: legal moves, SAN,
  `readPgn`), with a game bar (start, back, play/pause, on, end). What is left is tap-to-move.
- The gummy bear's drag-to-stretch was built in Phase D (`grab`); it stays as it is.
- Newton's cradle lifts and drops a ball on tap (E1c); dragging a ball back is still F.
- The plan marks the puzzle cube and the bricks `more` (interactive); the gummy bear and Newton's
  cradle are `keep` with an interactive wish.

Build:

1. **Puzzle cube:** a solvable cube, the cube state kept in JavaScript. Swipe on a face to turn that
   layer; a scramble and a solved check.
2. **Bricks:** each tap builds a random small model (tower, bridge, animal), brick by brick,
   different each tap.
3. **Chess set:** tap a piece, then a square, to make a legal move (the rules are in
   `src/chess.js`); the Opera Game still plays from its own control, and the game bar keeps working.
4. **Newton's cradle:** drag a ball back and let go.

Rules for this lane: the laptop is locked and must keep working exactly as now (the laptop smoke
test guards it). Keep every change to the input path backwards compatible so every other toy behaves
the same (a drag beside a toy still orbits; a tap still hops or fires the action). Don't change the
panel or other UI beyond what the interaction needs on the toy. Cover the new interactions with
tests in `tests/f.spec.mjs`, post clips of each on the Effect review page, and say in the PR if
something is not feasible (the owner asked for a good fallback then).

PR title: "Phase F: touch and drag play".

## State

Built on `claude/lane-f-touch-drag` (PR #42), with a small engine PR on
`claude/lane-f-touch-drag-engine` that must be merged first. All four toys have their touch play;
clips are on the Effect review page (lane F). Waiting for the owner's marks.

## Notes

- **The input path.** A recipe's `drag` (the laptop's trackpad, until now) can name the plane the
  finger moves across: `drag.plane` is `"view"` (facing the camera), a normal in recipe coordinates,
  or `(point) => normal` (the puzzle cube uses the face that was touched). Without `plane` the drag
  follows the horizontal plane it started on, as before, so the laptop is unchanged.
  `player.recipeRay(x, y)` gives the pointer's ray in recipe coordinates; `player.fromRecipe(p)` and
  `player.screenPoint(p)` go the other way (for tests and clips).
- **Engine PR (draw order).** Splats sort in the pose they were built in, so a cubie turned from the
  back of the cube to the front drew behind the others (holes). A recipe now sets `out.resort` on a
  frame where its tokens have settled, and `player.resortTokens()` writes the tokens' current places
  into the sort centres (one re-sort, not every frame). The cube asks after every turn, the bricks
  after every brick lands. The same PR makes the game panel follow a game that changes on the board
  (its title and the "Opera Game" button).
- **Puzzle cube.** 26 cubies are tokens; the cube state (each cubie's place and turn) is kept in
  `src/packs/playthings.js`. Swipe across a face: the row or column under the finger follows it and
  snaps to the nearest quarter turn when let go, with a click. A tap scrambles (14 random turns) a
  solved cube, or plays the turns back to solved (the history is simplified as it goes: a turn and
  its undo cancel). Solving it by hand gives a hop, a spin and a ding. The button is "Scramble or
  solve" (the panel does not relabel buttons live).
- **Newton's cradle.** Drag any ball out to the side: the balls between it and that end come along.
  Let go and as many balls fly out the other side, strike by strike, with clacks. The tap is
  unchanged (checked frame by frame against the old drive).
- **Chess set.** Paused (or before the game starts), tap one of the pieces whose turn it is (it
  lifts and hovers), then a square it can legally move to (chess.js rules; a pawn on the last rank
  becomes a queen). The game goes on from that point as "Your game, from the Opera Game"; the game
  bar steps through it, and the panel's "Opera Game" button goes back. Checkmate tips the king. Taps
  made while a piece is still sliding wait until it lands. A tap beside the board, the Play button
  and the game bar play the Opera Game as before.
- **Bricks.** 18 bricks (tokens: six 2x4, six 2x2, two 1x4, four 1x2) lie poured out round the
  table. Each tap pops the last model apart and builds one of five (tower, bridge, stairs, dog,
  tree, never the same twice in a row) brick by brick from the bottom up, each click-landing; the
  bricks it does not need stay on the table. A node check confirms no model overlaps or floats.
- `tools/drag-clip.mjs` renders drags and taps as GIF clips (script steps: drag, tap, act, wait,
  shot), with a dot for the finger.

## Known issues

- A layer is drawn in its last sorted order while it turns, so a half-turned layer can show a seam
  for a moment; it is sorted again as it lands.
- The cube's button reads "Scramble or solve": the panel does not relabel a toy's button while it is
  shown, so it cannot switch between the two words.
- On SwiftShader (the tests) a tap waits for a slow GPU pick; quick taps are queued, not lost.
- Brick colours are random per model, so the dog and the tree are not coloured like a dog or a tree.

## For the Operator

- **Merge order:** the engine PR (#45, `claude/lane-f-touch-drag-engine`) before this lane's PR.
- PACKS.md, "Draw order": add "12. Tokens that move far (a cube's cubies, a model's bricks) set
  `out.resort` on the frame they land; the player sorts them again where they stand. Once per
  landing, not every frame."
- PACKS.md, recipe fields: `drag: { at, start, move, end, plane }` (`plane`: `"view"`, a normal, or
  `(point) => normal`), for a toy's own touch play; see the puzzle cube and Newton's cradle.
- README: the puzzle cube, cradle, chess and bricks lines can mention swiping, dragging and
  tap-to-move.
- `tools/drag-clip.mjs` is new (clips of drags and taps); it could be listed next to
  `tools/effect-clip.mjs` in CLAUDE.md and OPERATING.md ("Steps for a lane").

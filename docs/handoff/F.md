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

Not started.

## Notes

## Known issues

## For the Operator

Lessons for PACKS.md, backlog items and README lines, to move after the merge.

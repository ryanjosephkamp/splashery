# Workstreams

The lanes: who is building what, in which files, on which branch. The Operator session keeps this
file; a lane reads its own row before it starts. How lanes work together is in
[OPERATING.md](OPERATING.md).

Last updated: September 27, 2026, when the Operator started lanes AI and Math. Since that day the
Operator starts and runs every lane (OPERATING.md, "How the Operator runs a lane"); the order of the
lanes to come is under "Next" and in [ROADMAP.md](ROADMAP.md).

## Lanes

| Lane                                       | Scope and toys                                                                                                                                                                                                                                                                                                                                                                                                            | Owns                                                                                                                                                                                          | Status                               | Session                                                 | Branch                     | PR                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------ |
| **Operator**                               | Coordination: briefs, starting and running the worker sessions, reconciling their PRs, upkeep after merges, the Sound Board and its review, the daily digest and toy ideas. Builds no toys.                                                                                                                                                                                                                               | The files only the Operator edits (OPERATING.md), the standard screenshots, the review page's lane records, the Toy Ideas page and its daily routines, the sound review files                 | Running                              | this session                                            | `claude/operator-<topic>`  | —                                                                  |
| **AI** AI and computing (prefix `ai`)      | 11 new toys on a new "AI and computing" shelf: perceptron, neural network, CNN, RNN, transformer, looped transformer, diffusion model, gradient descent, word vectors, sorting machine, half adder; then the owner's extras from his September 27 review (3D versions, a second transformer diagram, MLPs, a CNN you draw on, word vectors for any words, more sorting algorithms). Brief: [handoff/AI.md](handoff/AI.md) | `src/packs/computing.js` (new), the `computing` category and its toys' rows in `src/toys.js`, `tests/ai.spec.mjs`, its toys' entries in the shared lists                                      | Running (started September 27, 2026) | https://claude.ai/code/session_01LeMboLgns1Q6xDzQNMfkp4 | `claude/lane-ai-computing` | [#52](https://github.com/ryanjosephkamp/splashery/pull/52) (draft) |
| **Math** Math you can type (prefix `math`) | 5 new math toys (graph plotter, surface plotter, circle and waves, Fourier circles, Pythagoras proof), a safe equation reader, and two fixes: the snail's withdrawal and the American football's spiral end; then the owner's extras (3D versions and your own settings for circle and waves and Fourier circles, and Fourier text). Brief: [handoff/Math.md](handoff/Math.md)                                            | `src/packs/maths.js`, `src/equation.js` (new), the `snail` recipe in `animals.js`, the `american-football` recipe in `balls.js`, `tests/math.spec.mjs`, its toys' entries in the shared lists | Running (started September 27, 2026) | https://claude.ai/code/session_01QtQpLUq6DFtPEQv6FnD2Fk | `claude/lane-math-typed`   | [#50](https://github.com/ryanjosephkamp/splashery/pull/50) (draft) |
| **Fix3** Two fixes (prefix `fix3`)         | The owner's September 27 notes on two approved toys: the bananas' loose stem and the ocean wave's collapse. Brief: [handoff/Fix3.md](handoff/Fix3.md)                                                                                                                                                                                                                                                                     | The `banana` recipe in `food.js` and the `ocean-wave` recipe in `elements.js`, `tests/fix3.spec.mjs`, their entries in the shared lists                                                       | Running (started September 27, 2026) | https://claude.ai/code/session_013vEoyw5u2ju3xSRDjSStig | `claude/lane-fix3`         | [#54](https://github.com/ryanjosephkamp/splashery/pull/54) (draft) |

## Frozen packs

No lane owns these now, so nobody edits them: `space.js`, `atoms.js`, `gems.js`, `tiny.js`,
`anatomy.js`, `objects.js`, `vehicles.js`, `music.js`, `nature.js`, `elements.js` and `food.js`
(except the two recipes lane Fix3 fixes), `balls.js` and `animals.js` (except the two toys lane Math
fixes), `landmarks.js`, `medieval.js`, `holidays.js`, `playthings.js`, `games.js`, `src/chess.js`,
and the scan rigs in `src/rigs.js`. The input path lane F built (pointer handling in
`src/player.js`, `src/stage.js` and `src/motion.js`) is engine code again: a change to it goes in an
"Engine: …" PR. A change to them (a fix from a review, a new instrument) needs a lane that the
Operator plans and starts.

## Next

In order (details in ROADMAP.md, "Now"); the Operator starts each when a slot is free:

1. **Toy help**: an engine PR for a short how-to-play line when a toy opens and an About tab in the
   panel, then two lanes (split by shelf) to write the text for every toy (ROADMAP.md, "Toy help").
2. **Sound review rounds**: when the owner's notes arrive, two sound lanes (split by shelf) build
   new sounds on the Sound Board; approved ones go into the site.
3. **Pianos and songs**: the five approved pianos, a song bar based on the chess bar, and MIDI
   files.
4. **New toys' sound round**: the AI and Math toys on the Sound Board after they merge.
5. **Physics and hands-on**: an engine lane (the physics engine, the Hands-on switch and Reset, four
   showcase toys), then a hands-on plan for every toy, then category lanes.
6. **Toy Workshop**: with the AI package, submissions, the gallery and the flag toy.
7. **Last**: the American English sweep, HOW-IT-WORKS.md, the blog post, a "How it's made" page and
   the homepage embeds.

Whenever a slot is free: **Real objects**, the approved scans (historical figures, real vehicles and
the everyday objects as real captures), as sources turn up.

## Done

| Phase     | What                                                                                                                                                                                           | PR(s)                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| A–E4      | Sharpness, phone shelf, visual fixes, sounds, rigs and new effects for 227 toys                                                                                                                | #13 to #33 (see handoff/history.md)    |
| Setup     | Parallel lanes: OPERATING.md, this file, lane handoffs, the data-driven tap test, tools                                                                                                        | #34                                    |
| E4-finish | The owner's four E4 fixes: ice swan, ocean wave, pinecone, lava lamp options. Handoff: [handoff/E4-finish.md](handoff/E4-finish.md)                                                            | #37                                    |
| E5        | New tap effects for the 17 food toys. Handoff: [handoff/E5.md](handoff/E5.md)                                                                                                                  | #35                                    |
| E6a       | New tap effects for the 20 balls. Handoff: [handoff/E6a.md](handoff/E6a.md)                                                                                                                    | #38                                    |
| E6b       | New tap effects for 11 landmarks, 4 animals, the shield, the crown and the snowman. Handoff: [handoff/E6b.md](handoff/E6b.md)                                                                  | #36                                    |
| F         | Touch and drag: the puzzle cube, bricks that build models, chess tap-to-move, Newton's cradle drag. Handoff: [handoff/F.md](handoff/F.md)                                                      | #45, #42                               |
| G         | AI image-to-3D trial: the real pencil and the real tin can, made from photos with TRELLIS; a yellow pencil and a "Peaches" label as their default looks. Handoff: [handoff/G.md](handoff/G.md) | #43                                    |
| G looks   | A Look choice for the two photo-made scans: pencil colors and can labels, with an engine PR for looks on captured toys. Handoff: [handoff/G.md](handoff/G.md)                                  | #47, #48                               |
| Ops       | The Operator's PRs: lanes started, the Toy Ideas page and routines, idea sets, upkeep; Operator-run lanes, American English and the sound review (#53); the MIT license (#51)                  | #39, #40, #41, #44, #46, #49, #53, #51 |

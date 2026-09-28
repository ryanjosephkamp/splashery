# Workstreams

The lanes: who is building what, in which files, on which branch. The Operator session keeps this
file; a lane reads its own row before it starts. How lanes work together is in
[OPERATING.md](OPERATING.md).

Last updated: September 28, 2026, when lanes AI and Help merged and the Operator started the two
help text lanes. Since September 27 the Operator starts and runs every lane (OPERATING.md, "How the
Operator runs a lane"); the order of the lanes to come is under "Next" and in
[ROADMAP.md](ROADMAP.md).

## Lanes

| Lane                                                              | Scope and toys                                                                                                                                                                                                                            | Owns                                                                                                                                                                          | Status                               | Session                                                 | Branch                    | PR  |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------- | ------------------------- | --- |
| **Operator**                                                      | Coordination: briefs, starting and running the worker sessions, reconciling their PRs, upkeep after merges, the Sound Board and its review, the daily digest and toy ideas. Builds no toys.                                               | The files only the Operator edits (OPERATING.md), the standard screenshots, the review page's lane records, the Toy Ideas page and its daily routines, the sound review files | Running                              | this session                                            | `claude/operator-<topic>` | —   |
| **HelpTextA** Help text, science and nature (prefix `hta`)        | A how-to line and an About text for every toy on ten shelves: Photoreal, Shapes, Space, Tiny world, Atoms, Gems, Body, Nature, Weather & fire and Math (149 toys). Brief: [handoff/HelpTextA.md](handoff/HelpTextA.md)                    | Its shelves' entries in `src/toy-help.js`, `tests/hta.spec.mjs`                                                                                                               | Running (started September 28, 2026) | https://claude.ai/code/session_01DxwxY7LbYPGdvXutscXdHV | `claude/lane-help-text-a` | —   |
| **HelpTextB** Help text, everyday, play and places (prefix `htb`) | A how-to line and an About text for every toy on eleven shelves: Balls, Food, Toys, Open me, Medieval, Animals, AI and computing, Holidays, Music, Vehicles and Landmarks (154 toys). Brief: [handoff/HelpTextB.md](handoff/HelpTextB.md) | Its shelves' entries in `src/toy-help.js`, `tests/htb.spec.mjs`                                                                                                               | Running (started September 28, 2026) | https://claude.ai/code/session_01Xti5EePmfywkYFmdM7aA4L | `claude/lane-help-text-b` | —   |

## Frozen packs

No lane owns these now, so nobody edits them: `space.js`, `atoms.js`, `gems.js`, `tiny.js`,
`anatomy.js`, `objects.js`, `vehicles.js`, `music.js`, `nature.js`, `elements.js`, `food.js`,
`balls.js`, `animals.js`, `maths.js`, `landmarks.js`, `medieval.js`, `holidays.js`, `playthings.js`,
`games.js`, `computing.js` (with `computing-cnn.js`), `src/chess.js`, and the scan rigs in
`src/rigs.js`. The input path lane F built (pointer handling in `src/player.js`, `src/stage.js` and
`src/motion.js`) is engine code again: a change to it goes in an "Engine: …" PR. So is the help UI
lane Help built (its "Toy help" blocks in `src/ui.js`, `styles.css` and `index.html`); the texts in
`src/toy-help.js` are a shared list, like `src/toy-sounds.js`. A change to them (a fix from a
review, a new instrument) needs a lane that the Operator plans and starts.

## Next

In order (details in ROADMAP.md, "Now"); the Operator starts each when a slot is free:

1. **Toy help, the text**: running as lanes HelpTextA and HelpTextB (above); the owner reads and
   marks the texts on the Help Board. From then on every lane writes its own toys' help.
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

| Phase     | What                                                                                                                                                                                                                                                                                        | PR(s)                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| A–E4      | Sharpness, phone shelf, visual fixes, sounds, rigs and new effects for 227 toys                                                                                                                                                                                                             | #13 to #33 (see handoff/history.md)              |
| Setup     | Parallel lanes: OPERATING.md, this file, lane handoffs, the data-driven tap test, tools                                                                                                                                                                                                     | #34                                              |
| E4-finish | The owner's four E4 fixes: ice swan, ocean wave, pinecone, lava lamp options. Handoff: [handoff/E4-finish.md](handoff/E4-finish.md)                                                                                                                                                         | #37                                              |
| E5        | New tap effects for the 17 food toys. Handoff: [handoff/E5.md](handoff/E5.md)                                                                                                                                                                                                               | #35                                              |
| E6a       | New tap effects for the 20 balls. Handoff: [handoff/E6a.md](handoff/E6a.md)                                                                                                                                                                                                                 | #38                                              |
| E6b       | New tap effects for 11 landmarks, 4 animals, the shield, the crown and the snowman. Handoff: [handoff/E6b.md](handoff/E6b.md)                                                                                                                                                               | #36                                              |
| F         | Touch and drag: the puzzle cube, bricks that build models, chess tap-to-move, Newton's cradle drag. Handoff: [handoff/F.md](handoff/F.md)                                                                                                                                                   | #45, #42                                         |
| G         | AI image-to-3D trial: the real pencil and the real tin can, made from photos with TRELLIS; a yellow pencil and a "Peaches" label as their default looks. Handoff: [handoff/G.md](handoff/G.md)                                                                                              | #43                                              |
| G looks   | A Look choice for the two photo-made scans: pencil colors and can labels, with an engine PR for looks on captured toys. Handoff: [handoff/G.md](handoff/G.md)                                                                                                                               | #47, #48                                         |
| Math      | Math you can type: a safe equation reader, the graph and surface plotters, circle and waves, Fourier circles (with words and 3D), the Pythagoras proof, and the snail and American football fixes. Handoff: [handoff/Math.md](handoff/Math.md)                                              | #50                                              |
| Fix3      | The owner's September 27 fixes: the bananas without the loose crown, and the ocean wave's smooth collapse. Handoff: [handoff/Fix3.md](handoff/Fix3.md)                                                                                                                                      | #54                                              |
| AI        | Twelve toys on a new "AI and computing" shelf, with 3D models, network sizes, the classic transformer, a CNN you draw on, real word vectors and eight sorts; engine PR: a drawing pad for a toy's input panel. Handoff: [handoff/AI.md](handoff/AI.md)                                      | #56, #52                                         |
| Help      | Toy help: a how-to line when a toy opens, a "?" button, "About this toy" in the About tab, and `src/toy-help.js` with the first texts. Handoff: [handoff/Help.md](handoff/Help.md)                                                                                                          | #57                                              |
| Ops       | The Operator's PRs: lanes started, the Toy Ideas page and routines, idea sets, upkeep; Operator-run lanes, American English and the sound review (#53); the MIT license (#51); the owner's September 27 review and toy help in the plan (#55); upkeep and the Help Board (#58 and this one) | #39, #40, #41, #44, #46, #49, #53, #51, #55, #58 |

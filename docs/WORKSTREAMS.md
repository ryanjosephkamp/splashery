# Workstreams

The lanes: who is building what, in which files, on which branch. The Operator session keeps this
file; a lane reads its own row before it starts. How lanes work together is in
[OPERATING.md](OPERATING.md).

Last updated: 2026-09-27, after lane F merged (#45 and #42).

## Lanes

| Lane                              | Scope and toys                                                                                                                                                                                                    | Owns                                                                                                                                                                     | Status                                            | Session                                                                                                   | Branch                      | PR                                                                 |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------ |
| **Operator**                      | Coordination: plans, prompts, upkeep after merges, the daily digest and toy ideas. Builds no toys.                                                                                                                | The files only the Operator edits (OPERATING.md), the standard screenshots, the review page's lane records, the Toy Ideas page and its daily routines                    | Running                                           | https://claude.ai/code/session_01NmKA2pNHm16bjUAfoTWbZL                                                   | `claude/operator-<topic>`   | One small "Ops: …" PR a topic                                      |
| **G** AI image-to-3D (prefix `g`) | Try an image-to-3D Space with `HF_TOKEN`; ship only scans that beat the procedural toys. Brief: [handoff/G.md](handoff/G.md)                                                                                      | New tool scripts in `tools/`, new `assets/toys/<id>/` folders, the new toys' rows in `src/toys.js`, `tools/assets.json`, `CREDITS.md`, `LICENSES.md`, `tests/g.spec.mjs` | Review fixes pushed; waiting on the owner's marks | https://claude.ai/code/session_015w8TqGuhX92seHVwtuwJUi (took over from session_0167u6TbNroRGH3DJ8pxKzDt) | `claude/lane-g-image-to-3d` | [#43](https://github.com/ryanjosephkamp/splashery/pull/43) (draft) |
| **H** Later                       | The gallery, multi-toy scenes, a liquid pour, the draw-order fix for moving parts, more scans, more instruments, the final homepage embed(s) (outline in [handoff/history.md](handoff/history.md), "Phases C–H"). | UI and both repos: planned by the Operator when the toy lanes are done                                                                                                   | After the toy lanes                               | Not started                                                                                               | —                           | —                                                                  |

## Frozen packs

No lane owns these now, so nobody edits them: `space.js`, `atoms.js`, `gems.js`, `tiny.js`,
`anatomy.js`, `maths.js`, `objects.js`, `vehicles.js`, `music.js`, `nature.js`, `elements.js`,
`food.js`, `balls.js`, `landmarks.js`, `animals.js`, `medieval.js`, `holidays.js`, `playthings.js`,
`games.js`, `src/chess.js`, and the scan rigs in `src/rigs.js` (lane G adds its two toys' rigs). The
input path lane F built (pointer handling in `src/player.js`, `src/stage.js` and `src/motion.js`) is
engine code again: a change to it goes in an "Engine: …" PR. A change to them (a fix from a review,
a new instrument) needs a lane that the Operator plans and the owner starts.

## Done

| Phase     | What                                                                                                                                      | PR(s)                               |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| A–E4      | Sharpness, phone shelf, visual fixes, sounds, rigs and new effects for 227 toys                                                           | #13 to #33 (see handoff/history.md) |
| Setup     | Parallel lanes: OPERATING.md, this file, lane handoffs, the data-driven tap test, tools                                                   | #34                                 |
| E4-finish | The owner's four E4 fixes: ice swan, ocean wave, pinecone, lava lamp options. Handoff: [handoff/E4-finish.md](handoff/E4-finish.md)       | #37                                 |
| E5        | New tap effects for the 17 food toys. Handoff: [handoff/E5.md](handoff/E5.md)                                                             | #35                                 |
| E6a       | New tap effects for the 20 balls. Handoff: [handoff/E6a.md](handoff/E6a.md)                                                               | #38                                 |
| E6b       | New tap effects for 11 landmarks, 4 animals, the shield, the crown and the snowman. Handoff: [handoff/E6b.md](handoff/E6b.md)             | #36                                 |
| F         | Touch and drag: the puzzle cube, bricks that build models, chess tap-to-move, Newton's cradle drag. Handoff: [handoff/F.md](handoff/F.md) | #45, #42                            |
| Ops       | The Operator's first PRs: lanes started, the Toy Ideas page and routines, idea sets, upkeep                                               | #39, #40, #41, #44                  |

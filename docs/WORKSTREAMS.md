# Workstreams

The lanes: who is building what, in which files, on which branch. The Operator session keeps this
file; a lane reads its own row before it starts. How lanes work together is in
[OPERATING.md](OPERATING.md).

Last updated: 2026-09-27, after lanes F and G merged (#45, #42 and #43).

## Lanes

| Lane                               | Scope and toys                                                                                                                                                                                                    | Owns                                                                                                                                                                           | Status                    | Session                                                 | Branch                                                   | PR                            |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- | ------------------------------------------------------- | -------------------------------------------------------- | ----------------------------- |
| **Operator**                       | Coordination: plans, prompts, upkeep after merges, the daily digest and toy ideas. Builds no toys.                                                                                                                | The files only the Operator edits (OPERATING.md), the standard screenshots, the review page's lane records, the Toy Ideas page and its daily routines                          | Running                   | https://claude.ai/code/session_01NmKA2pNHm16bjUAfoTWbZL | `claude/operator-<topic>`                                | One small "Ops: …" PR a topic |
| **G** Looks for scans (prefix `g`) | Color choices for the real pencil and the real tin can: first an engine PR that lets a captured toy offer looks, then the looks themselves. Brief: [handoff/G.md](handoff/G.md)                                   | Engine PR: the captured-toy loader in `src/player.js` and the `looks` field in `src/toys.js`. Lane PR: the two toys' folders and rows, `tools/g-looks.mjs`, `tests/g.spec.mjs` | Running (from 2026-09-27) | https://claude.ai/code/session_015w8TqGuhX92seHVwtuwJUi | `claude/lane-g-looks-engine`, then `claude/lane-g-looks` | —                             |
| **H** Later                        | The gallery, multi-toy scenes, a liquid pour, the draw-order fix for moving parts, more scans, more instruments, the final homepage embed(s) (outline in [handoff/history.md](handoff/history.md), "Phases C–H"). | UI and both repos: planned by the Operator when the toy lanes are done                                                                                                         | After the toy lanes       | Not started                                             | —                                                        | —                             |

## Frozen packs

No lane owns these now, so nobody edits them: `space.js`, `atoms.js`, `gems.js`, `tiny.js`,
`anatomy.js`, `maths.js`, `objects.js`, `vehicles.js`, `music.js`, `nature.js`, `elements.js`,
`food.js`, `balls.js`, `landmarks.js`, `animals.js`, `medieval.js`, `holidays.js`, `playthings.js`,
`games.js`, `src/chess.js`, and the scan rigs in `src/rigs.js`. The input path lane F built (pointer
handling in `src/player.js`, `src/stage.js` and `src/motion.js`) is engine code again: a change to
it goes in an "Engine: …" PR. A change to them (a fix from a review, a new instrument) needs a lane
that the Operator plans and the owner starts.

## Done

| Phase     | What                                                                                                                                                                                           | PR(s)                               |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| A–E4      | Sharpness, phone shelf, visual fixes, sounds, rigs and new effects for 227 toys                                                                                                                | #13 to #33 (see handoff/history.md) |
| Setup     | Parallel lanes: OPERATING.md, this file, lane handoffs, the data-driven tap test, tools                                                                                                        | #34                                 |
| E4-finish | The owner's four E4 fixes: ice swan, ocean wave, pinecone, lava lamp options. Handoff: [handoff/E4-finish.md](handoff/E4-finish.md)                                                            | #37                                 |
| E5        | New tap effects for the 17 food toys. Handoff: [handoff/E5.md](handoff/E5.md)                                                                                                                  | #35                                 |
| E6a       | New tap effects for the 20 balls. Handoff: [handoff/E6a.md](handoff/E6a.md)                                                                                                                    | #38                                 |
| E6b       | New tap effects for 11 landmarks, 4 animals, the shield, the crown and the snowman. Handoff: [handoff/E6b.md](handoff/E6b.md)                                                                  | #36                                 |
| F         | Touch and drag: the puzzle cube, bricks that build models, chess tap-to-move, Newton's cradle drag. Handoff: [handoff/F.md](handoff/F.md)                                                      | #45, #42                            |
| G         | AI image-to-3D trial: the real pencil and the real tin can, made from photos with TRELLIS; a yellow pencil and a "Peaches" label as their default looks. Handoff: [handoff/G.md](handoff/G.md) | #43                                 |
| Ops       | The Operator's first PRs: lanes started, the Toy Ideas page and routines, idea sets, upkeep                                                                                                    | #39, #40, #41, #44                  |

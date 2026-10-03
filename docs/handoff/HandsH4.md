# Lane Hands-on H4 (prefix `hh4`): local lane

## Brief

Local lane. You are a Splashery worker session, started by the owner on his Mac from a brief the
Operator wrote. Repo: ryanjosephkamp/splashery. Your lane: Hands-on H4 (id `HandsH4`, prefix `hh4`).
Your folder is a git worktree on `claude/lane-hands-h4`. Your port: 4190. Handoff file:
docs/handoff/HandsH4.md (this file; your brief is already here). Model: Opus 5.5.

### Brief (written by the Operator on October 3, 2026)

**First, check that you can start:** docs/PACKS.md on main must have sections 5f (bodies and
fields), 5g (joints) and 5h (soft parts), which arrive when the three hands-on engines merge. If
they aren't there yet, set "State" to "BLOCKED: waiting for the hands-on engines", push, and stop.

The owner accepted every line of docs/HANDS-ON-PLAN.md on October 3, 2026, and wants every toy
hands-on. Level 1 (pick up, toss, land, ↺ Reset) is on main for all of them. Three engine lanes
built the pieces the plan's other lines need (materials, water, air, wells, wheels, shake, flee,
projectiles; hinges, sliders, dials, sockets, breaks; ropes, cloth and stretch), each with a few
demo toys. Five category lanes now build the rest. Yours are these shelves:

- Vehicles
- Landmarks
- Space
- Weather & fire
- Tiny world

#### What to build

1. **Every line of the plan for your shelves** that goes beyond Level 1, as the plan describes it,
   built from the engine pieces through each toy's `hands` block. Skip lines marked "Level 1 only.",
   "Already hands-on" or "Built by lane Physics.", and the 18 demo toys the engine lanes built.
2. **Real numbers** for weights, bounce and drag from `tools/hands-on-materials.json` (Codex task
   11). Most of its numbers are marked as estimates: prefer the confirmed ones, and keep the motion
   believable at the toys' scale.
3. **The L1 sweep's findings:** the comet never comes to rest after a toss (the L1 sweep); fix it,
   and any other real finding the sweep lists for your shelves.
4. **Any pose:** every hands-on effect also works with the toy on its side or upside down (lane Any
   pose fixes the engine side); test three poses for each toy you change.
5. **One PR per shelf**, in the order above, on `claude/lane-hands-h4-<shelf>` (for example
   `claude/lane-hands-h4-vehicles`), titled "Phase Hands-on H4, <shelf>: …", each with a phone-size
   clip of every toy it changes (`tools/phy-clip.mjs`), posted as cards under your lane id and
   grouped by shelf, each card saying what to try with a finger. Tests in `tests/hh4*.spec.mjs`:
   each piece measured (heights, angles, positions over time) for a sample of your toys.
6. If a line needs an engine piece that doesn't exist, don't build a private one: say so in "State",
   skip that line, and move on. A small fix to an engine piece goes in its own "Engine: …" PR.

#### You own

Your shelves' toys' `hands` blocks and their own recipe lines in `src/packs/` (nothing else in a
recipe), `tests/hh4*.spec.mjs`, `tools/hh4-*.mjs`, your toys' entries in the shared lists, and this
file. The engine files belong to the merged engines; another lane's toys are theirs.

#### How this lane runs (local lane)

- You run in Claude Code on the owner's Mac, signed in to his second Claude account. Follow
  docs/OPERATING.md, "Local lanes", exactly: your own port (4190), the local test set, messages as
  comments on your PR that start "From the Operator", the "READY:", "WORKING:" or "BLOCKED:" line at
  the top of "## State", and clips on page 2 or on `claude/clips-HandsH4`.
- The Operator (a cloud session) runs the lanes; the owner, Ryan, talks only to the Operator and is
  often away from the Mac. Never ask him anything in the terminal or wait for him: put questions in
  "State", move on to the next item, and keep going.
- Model: Opus 5.5 only, at the default effort. If `/model` shows another model, stop and say so in
  "State". At most one helper at a time, same model.
- Merging: the Operator merges. Never merge anything. An engine change is its own small, additive
  "Engine: …" PR on `claude/lane-hands-h4-engine`, merged first; toys not using it behave exactly as
  before.
- Hands-on play only adds to a toy: with the ✋ switch off, every toy plays exactly as before, and
  old `#s=` links and saved scenes keep loading. A change the public sees waits for the owner's
  marks before it merges.
- Every effect follows the effect quality rules in CLAUDE.md (real motion of solid pieces, separate
  things moving separately, break-apart into real pieces that come back), judged as phone-size
  clips, and works with the toy upright, on its side and upside down.
- Licenses, for every asset and dataset (CLAUDE.md, "Ground rules"): read the license on the live
  source page; record it in CREDITS.md, `tools/assets.json` (or `tools/models.json`) and the toy's
  in-app credit; `"nc": true` on NC assets; never ND, unlicensed, personal-use or paid. A license
  not on that list (ODbL, CERN-OHL, government terms, "free with attribution") is a question for the
  Operator in "State", not a file in the repo. Nothing human (people, faces, human anatomy or human
  scans) without the owner's yes. No logos or brand names.
- A static site: data becomes splats at build time (your `tools/hh4-*.mjs`; any new devDependency
  pinned and listed in LICENSES.md). The page never calls a data service or needs a key, and big
  files load only when the toy opens. Keep sizes inside the phone budgets.
- Work through the items in order. Open your draft PR early ("Phase Hands-on H4, <shelf>: …", five
  sections from CLAUDE.md, naming Opus 5.5), push after each finished item with "State" updated, and
  run long jobs (clips, tests) in the background.
- Language: American English in every new text (color, center, gray, license, -ize endings, dates
  like "October 3, 2026").
- Read first: CLAUDE.md; docs/OPERATING.md ("Local lanes", "Steps for a lane", "A lane's end");
  docs/HANDS-ON-PLAN.md (your shelves' lines); docs/PACKS.md, sections 5f, 5g and 5h (the engine
  pieces) and its earlier hands-on section; docs/handoff/Physics.md, HandsEngineA.md,
  HandsEngineB.md and HandsEngineC.md; docs/audits/hands-l1-sweep-2026-10.md and
  docs/audits/hands-on-materials-2026-10.md.
- Before every push: CLAUDE.md, "Before every push", with the local test set. At the end: "A lane's
  end".

## State

WORKING: not started yet (October 3, 2026).

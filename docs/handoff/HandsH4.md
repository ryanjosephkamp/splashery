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
  the top of "### Brief, October 8, 2026 (cloud)

Written by the Operator on October 8, 2026. You are a Splashery worker session, started by the
Operator (the coordinating session). Repo: ryanjosephkamp/splashery. Your lane: Hands-on H4 (prefix
`hh4`; shelves: Vehicles, Landmarks, Space, Weather & fire and Tiny world). Branches:
`claude/lane-hands-h4-<shelf>`, one PR per shelf as your brief says (engine changes on
`claude/lane-hands-h4-engine`, as a small additive "Engine: …" PR merged first). Handoff file:
docs/handoff/HandsH4.md. Model: Opus 5.5, at high effort (CLAUDE.md).

Your full brief is already in docs/handoff/HandsH4.md (written October 3, 2026, for a local lane on
the owner's Mac). The owner started it in the cloud instead on October 8, 2026: you run here, not on
his Mac, so ignore the parts about his Mac, his second account and the local port (use
`python3 -m http.server 4173 --bind 127.0.0.1` as CLAUDE.md says), and post clips on Effect review
page 2 rather than a clips branch. Its first check (docs/PACKS.md sections 5f, 5g and 5h) passes:
the hands-on engines merged October 3 and 4, 2026. Everything else in it stands, in its order. Main
has moved a lot since October 3 (read docs/HANDOFF.md "Now" first). Hands-on play only adds to a
toy: with the ✋ switch off every toy plays exactly as before, and these are toys the public sees,
so each shelf's PR waits for the owner's "good" marks on its cards. Update the handoff's "## State",
"## Notes", "## Known issues" and "## For the Operator" as you go; leave its brief as it is and add
this one under it as "### Brief, October 8, 2026 (cloud)".

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
replace the prefix and lane record with yours). New toys and views go behind the labs switch
(`labs: true`); the Operator merges labs work after the tests pass (with tools/op-merge.mjs) and
after the owner marks your cards; changes to toys the public already sees wait for his "good" marks.
Finish every working turn with "READY:", "WORKING:" or "BLOCKED:"; Splashery has no CI to wait for;
for a long job, schedule a check-in with send_later instead of going idle. Clips at phone size
(390x844, device scale 3) go on Effect review page 2
(https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as docs/OPERATING.md, "Steps for a lane", says
(no republish). New sounds go in tools/sound-review.json as "ready" (the owner hears them on the
Sound Board), not as cards. Before READY, re-read CLAUDE.md's "Effect quality rules" and check each
clip against them at phone size. About six workers run at once; keep an even pace. Your Operator is
session_012GmKRUMZLir2nb27Bo8Cu2. Card ids hh4-…. Aim for a first READY with the first shelf and its
clips within about six hours.

What the first three Hands-on lanes learned today (October 8, 2026), so you don't repeat it:

- Engine conflicts: H1's and H2's engine PRs (#421, #420) are being merged into main tonight, and
  H3's (#430) after them; all three touch `src/physics/hands-on.js` and docs/PACKS.md. Read those
  PRs before you add engine pieces, reuse what they add, and keep your own engine PR small and
  additive. When main moves, merge it into your branches (never rebase).
- A toy with `hands.joints` plays in pieces mode (its parts move; the toy isn't tossed whole), as
  the chest and music box do. Say so in each shelf PR's Deviations.
- Clips: SwiftShader here is slow (about 6 s a frame at device scale 3). Device scale 2 at 390x844
  is acceptable for these clips; redo one at 3 only if the owner's mark asks.
- One PR per shelf, stacked on your engine branch, each with its cards on Effect review page 2, as
  H1 to H3 did.

## State

Main (October 9, 2026, with #457: H3's and H5's engines) is merged into every H4 branch. The engine
merge keeps both sides: H5's `touch` key beside `force`, `watch` and `carry`, and one
`info.hands.piece()` (a number is H5's piece index, a string H4's part name, token or `name`), with
every field either reads. H2's #450 adds its own `piece(name)` on the same lines; it can take this
one (its fields are all here). 87 hands engine specs: 86 pass, and the one fail is hec's "soft parts
are cheap" timing under a loaded full run (0.5 ms alone, 3 of 3); the hh4 specs and taps pass (96).

WORKING (October 9, 2026, 08:00 UTC): the owner's marks on the redone clips: the bus, castle and
Galileo's balls (`-r2`) are good. Two needed another round, now posted as `-r3` cards: the tractor's
rear mudguards have inner walls (the far tire's top no longer shows in the cab), and the DNA clip
had pressed in the gap between the strands, so the finger turned the view and nothing unzipped (the
test presses the toy directly, so it never showed). The clip now takes a strand; the helix turns to
face you as it opens, and its strands peel a little wider than the tap's.

- Engine PR #439 (`claude/lane-hands-h4-engine`): `hands.force` (a recipe's own push, each substep,
  with `ctx.free()`), `info.hands.piece(key)` (by part, token or `name`) with `hands.watch`,
  `info.hands.moved` (as H2's #420 adds it, the same lines), `hands.carry` (pieces carried
  together), and a whole toy that floats (water or air) can be pushed below where it stands.
- Shelf PRs, stacked in this order (each on the one before): Vehicles #440, Landmarks #442, Space
  #443, Weather & fire #444, Tiny world #445. Every line of the plan for these shelves is built but
  the bicycle's pedals (below). The comet's L1 sweep finding is fixed (it comes to rest).

## Notes

- Joints and Level 1 don't mix: a toy with `hands.joints` plays in pieces mode. So the helicopter's
  and plane's rotors are dials (the craft stays put), the train is a slider on its rails, the liner
  a vertical slider (bob, with a little pitch) and the sailboat a hinge about her keel. The toys
  that keep Level 1 (balloon, submarine, bus, tractor, bicycle) use fields (air, water, wheels).
- The liner and sailboat carry their own sea patch in their build, so a whole-toy water line would
  float the sea with them (and their hull for Level 1 would be the sea's). Hence the joints.
- The train's track is too short to run on (0.3 ahead, 0.65 behind), so more track with buffer stops
  shows at both ends while ✋ is on (`runway`, a part left out of the fit, hidden with ✋ off).
- A round hull (the submarine) has no righting moment on water: it needs `upright`.
- `upright` alone can't hold up a tall thin toy against its weight at k 60 (the bicycle fell); k 300
  with damping 20 holds it.
- Clips: `tools/hh4-clip.mjs` (H3's clip tool), scripts in `tools/hh4-clips/`, device scale 2 (about
  4.5 minutes a clip). The clip tool reads the working tree: don't switch branches while it renders.
- A build with no `k.data` gives `hands.joints(d)` an undefined `d`: the toys whose joints or drive
  share state now set `k.data = { ...k.data, h4: {} }` in their build.
- A toy whose drive reads `info.hands` needs an Extras: `hands.watch: true` when it has no other
  field (joints alone don't make one).
- Pieces' parts: once anything has moved, every part piece shows its body's pose, even pinned ones.
  So the solar system's planets are named bodies (no part) that the drive draws from
  `info.hands.piece(name)`, and they keep orbiting under `hands.force`.

## Known issues

- The bicycle's world never quite sleeps in Hands-on (it rests tilted about 0.04 rad on its stand,
  and `upright` keeps nudging it).
- The flying saucer: the cow's piece is built where it hangs in the beam; if the beam is off when
  the cow is first picked up, it starts from up in the beam (its home), not from the grass.

## For the Operator

- The bicycle's "drag the pedals to turn them" needs a dial on a whole toy (Level 1 with wheels); no
  engine piece does that. Skipped; the bicycle rolls and stays upright.
- Merge #439 (engine) before the shelf PRs.
- A clip's `from3` press must land on the toy's splats (the app picks what is under the finger):
  between the DNA's strands the press missed and the drag orbited the view.

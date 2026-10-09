# Lane Hands-on H5 (prefix `hh5`): local lane

## Brief

Local lane. You are a Splashery worker session, started by the owner on his Mac from a brief the
Operator wrote. Repo: ryanjosephkamp/splashery. Your lane: Hands-on H5 (id `HandsH5`, prefix `hh5`).
Your folder is a git worktree on `claude/lane-hands-h5`. Your port: 4191. Handoff file:
docs/handoff/HandsH5.md (this file; your brief is already here). Model: Opus 5.5.

### Brief (written by the Operator on October 3, 2026)

**First, check that you can start:** docs/PACKS.md on main must have sections 5f (bodies and
fields), 5g (joints) and 5h (soft parts), which arrive when the three hands-on engines merge. If
they aren't there yet, set "State" to "BLOCKED: waiting for the hands-on engines", push, and stop.

The owner accepted every line of docs/HANDS-ON-PLAN.md on October 3, 2026, and wants every toy
hands-on. Level 1 (pick up, toss, land, ↺ Reset) is on main for all of them. Three engine lanes
built the pieces the plan's other lines need (materials, water, air, wells, wheels, shake, flee,
projectiles; hinges, sliders, dials, sockets, breaks; ropes, cloth and stretch), each with a few
demo toys. Five category lanes now build the rest. Yours are these shelves:

- Animals
- Body
- Atoms
- Gems
- Math
- AI and computing

#### What to build

1. **Every line of the plan for your shelves** that goes beyond Level 1, as the plan describes it,
   built from the engine pieces through each toy's `hands` block. Skip lines marked "Level 1 only.",
   "Already hands-on" or "Built by lane Physics.", and the 18 demo toys the engine lanes built.
2. **Real numbers** for weights, bounce and drag from `tools/hands-on-materials.json` (Codex task
   11). Most of its numbers are marked as estimates: prefer the confirmed ones, and keep the motion
   believable at the toys' scale.
3. **The L1 sweep's findings:** the owl never comes to rest after a toss (the L1 sweep); fix it, and
   any other real finding the sweep lists for your shelves. Anatomy stays a clinical atlas
   (CLAUDE.md).
4. **Any pose:** every hands-on effect also works with the toy on its side or upside down (lane Any
   pose fixes the engine side); test three poses for each toy you change.
5. **One PR per shelf**, in the order above, on `claude/lane-hands-h5-<shelf>` (for example
   `claude/lane-hands-h5-animals`), titled "Phase Hands-on H5, <shelf>: …", each with a phone-size
   clip of every toy it changes (`tools/phy-clip.mjs`), posted as cards under your lane id and
   grouped by shelf, each card saying what to try with a finger. Tests in `tests/hh5*.spec.mjs`:
   each piece measured (heights, angles, positions over time) for a sample of your toys.
6. If a line needs an engine piece that doesn't exist, don't build a private one: say so in "State",
   skip that line, and move on. A small fix to an engine piece goes in its own "Engine: …" PR.

#### You own

Your shelves' toys' `hands` blocks and their own recipe lines in `src/packs/` (nothing else in a
recipe), `tests/hh5*.spec.mjs`, `tools/hh5-*.mjs`, your toys' entries in the shared lists, and this
file. The engine files belong to the merged engines; another lane's toys are theirs.

#### How this lane runs (local lane)

- You run in Claude Code on the owner's Mac, signed in to his second Claude account. Follow
  docs/OPERATING.md, "Local lanes", exactly: your own port (4191), the local test set, messages as
  comments on your PR that start "From the Operator", the "READY:", "WORKING:" or "BLOCKED:" line at
  the top of "### Brief, October 8, 2026 (cloud)

Written by the Operator on October 8, 2026, for this cloud session (word for word):

> Your full brief is already in docs/handoff/HandsH5.md (written October 3, 2026, for a local lane
> on the owner's Mac). The owner started it in the cloud instead on October 8, 2026: you run here,
> not on his Mac, so ignore the parts about his Mac, his second account and the local port (use
> `python3 -m http.server 4173 --bind 127.0.0.1` as CLAUDE.md says), and post clips on Effect review
> page 2 rather than a clips branch. Its first check (docs/PACKS.md sections 5f, 5g and 5h) passes:
> the hands-on engines merged October 3 and 4, 2026. Everything else in it stands, in its order.
> Main has moved a lot since October 3 (read docs/HANDOFF.md "Now" first). Hands-on play only adds
> to a toy: with the ✋ switch off every toy plays exactly as before, and these are toys the public
> sees, so each shelf's PR waits for the owner's "good" marks on its cards. Update the handoff's "##
> State", "## Notes", "## Known issues" and "## For the Operator" as you go; leave its brief as it
> is and add this one under it as "### Brief, October 8, 2026 (cloud)".
>
> How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
> replace the prefix and lane record with yours). New toys and views go behind the labs switch
> (`labs: true`); the Operator merges labs work after the tests pass (with tools/op-merge.mjs) and
> after the owner marks your cards; changes to toys the public already sees wait for his "good"
> marks. Finish every working turn with "READY:", "WORKING:" or "BLOCKED:"; Splashery has no CI to
> wait for; for a long job, schedule a check-in with send_later instead of going idle. Clips at
> phone size (390x844, device scale 3) go on Effect review page 2
> (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as docs/OPERATING.md, "Steps for a lane", says
> (no republish). New sounds go in tools/sound-review.json as "ready" (the owner hears them on the
> Sound Board), not as cards. Before READY, re-read CLAUDE.md's "Effect quality rules" and check
> each clip against them at phone size. About six workers run at once; keep an even pace. Your
> Operator is session_012GmKRUMZLir2nb27Bo8Cu2. Card ids hh5-…. Aim for a first READY with the first
> shelf and its clips within about six hours.
>
> What the first three Hands-on lanes learned today (October 8, 2026), so you don't repeat it:
>
> - Engine conflicts: H1's and H2's engine PRs (#421, #420) are being merged into main tonight, and
>   H3's (#430) after them; all three touch `src/physics/hands-on.js` and docs/PACKS.md. Read those
>   PRs before you add engine pieces, reuse what they add, and keep your own engine PR small and
>   additive. When main moves, merge it into your branches (never rebase).
> - A toy with `hands.joints` plays in pieces mode (its parts move; the toy isn't tossed whole), as
>   the chest and music box do. Say so in each shelf PR's Deviations.
> - Clips: SwiftShader here is slow (about 6 s a frame at device scale 3). Device scale 2 at 390x844
>   is acceptable for these clips; redo one at 3 only if the owner's mark asks.
> - One PR per shelf, stacked on your engine branch, each with its cards on Effect review page 2, as
>   H1 to H3 did.

## State

WORKING (October 9, 2026, about 01:30 UTC). Model: Opus 5.5 (claude-opus-5-5), high effort.

- **Engine** (`claude/lane-hands-h5-engine`, draft PR #441): `hands.touch` (info.hands.pressed,
  held, speed, joint(name), piece(i); `touch: { key }` pokes), `follow`/`flee` `at(p)`, upright's
  `rest` (the owl's settle), a piece's `when(data)`, a socket's `armAway`, a piece's `home` spring.
  Each opt-in; `tests/hh5-engine.spec.mjs`.
- **Animals** (`claude/lane-hands-h5-animals`): all nine lines built (jellyfish, butterfly,
  pufferfish, ladybug, snail, starfish, frog, penguin, owl) and the owl's settle fixed;
  `tests/hh5-animals.spec.mjs` (9 tests) passes. Clips rendering; cards and PR next.
- **Body** (`claude/lane-hands-h5-body`): eye, lungs and the anatomy atlas's organs;
  `tests/hh5-body.spec.mjs` passes. Clips and PR after Animals.
- **Atoms** (`claude/lane-hands-h5-atoms`): molecule, protein and crystal lattice;
  `tests/hh5-atoms.spec.mjs` passes. The periodic table waits for lane H3's engine PR (#430: a
  `turntable: false` toy plays its joints).
- **Gems, Math, AI and computing**: not started. The quartz cluster waits for H3's reseat (#430).

## Notes

- Clips: `tools/hh5-clip.mjs` (lane H2's tool) with `SPLASHERY_GL=llvmpipe xvfb-run -a` renders
  390x844 at device scale 2 at about 1 s a frame here, against 6 to 13 s with SwiftShader.
- The Level 1 sample in `tests/hl1.spec.mjs` takes the sea urchin for the jellyfish (pieces mode
  now), as earlier lanes did for the mushroom and the soda can.
- `tests/an.spec.mjs` counts the atlas's organs in their eight new parts.

## Known issues

- The frog turns at most about 35 degrees toward its fly: the splats are sorted for the frog as it
  sits, and a bigger turn of the whole toy showed it speckled.
- The penguin's and snail's upright springs are stiff (their bases, as their splats give them, would
  otherwise leave them leaning or creeping), so a push tips the penguin only a little.
- With a hands-on rope, the jellyfish's tentacles lose their faint twinkle (they are skin splats
  now), as the octopus's arms did.

## For the Operator

- Engine PR #441 first; then one PR per shelf, stacked on it.

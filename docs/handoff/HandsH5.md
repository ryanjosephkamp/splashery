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
  the top of "## State", and clips on page 2 or on `claude/clips-HandsH5`.
- The Operator (a cloud session) runs the lanes; the owner, Ryan, talks only to the Operator and is
  often away from the Mac. Never ask him anything in the terminal or wait for him: put questions in
  "State", move on to the next item, and keep going.
- Model: Opus 5.5 only, at the default effort. If `/model` shows another model, stop and say so in
  "State". At most one helper at a time, same model.
- Merging: the Operator merges. Never merge anything. An engine change is its own small, additive
  "Engine: …" PR on `claude/lane-hands-h5-engine`, merged first; toys not using it behave exactly as
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
- A static site: data becomes splats at build time (your `tools/hh5-*.mjs`; any new devDependency
  pinned and listed in LICENSES.md). The page never calls a data service or needs a key, and big
  files load only when the toy opens. Keep sizes inside the phone budgets.
- Work through the items in order. Open your draft PR early ("Phase Hands-on H5, <shelf>: …", five
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

### Brief, October 8, 2026 (cloud)

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

READY (October 9, 2026, about 06:35 UTC). Every current hh5 card is marked "good" by the owner (41
cards, among them the eight `-r2` fixes of his first marks: frog, ladybug, lungs, pearl, Platonic
solids, Pythagoras proof, Sierpinski tetrahedron, torus knot). The engine gained `limits(at)` and
`hands.knock: false` for those fixes. All seven PRs wait only for the Operator's merge (engine #441
first).

- **Engine** (`claude/lane-hands-h5-engine`, draft PR #441): `hands.touch` (info.hands.pressed,
  held, speed, joint(name), piece(i); `touch: { key }` pokes), `follow`/`flee` `at(p)`, upright's
  `rest` (the owl's settle), a piece's `when(data)`, a socket's `armAway`, a piece's `home` spring.
  Each opt-in; `tests/hh5-engine.spec.mjs`. Main (with H1's and H2's engines) merged in.
- **Animals** (PR #446): jellyfish, butterfly, pufferfish, ladybug, snail, starfish, frog, penguin,
  owl, and the owl's settle fixed.
- **Body** (PR #448): eye, lungs, the anatomy atlas's organs.
- **Atoms** (PR #451): molecule, protein, crystal lattice. The periodic table waits for lane H3's
  engine PR (#430: a `turntable: false` toy plays its joints).
- **Gems** (PR #452): amethyst geode, pearl, crystal ball. The quartz cluster waits for H3's reseat
  (#430).
- **Math** (PR #453): Lorenz attractor, Menger sponge, torus knot, Mandelbulb, Sierpinski
  tetrahedron, Platonic solids, circle and waves, Pythagoras proof.
- **AI and computing** (PR #454): perceptron, multilayer perceptron, gradient descent, sorting
  machine, half adder, Turing machine, difference engine, Enigma machine.

## Notes

- Clips: `tools/hh5-clip.mjs` (lane H2's tool) with `SPLASHERY_GL=llvmpipe xvfb-run -a` renders
  390x844 at device scale 2 at about 1 s a frame here, against 6 to 13 s with SwiftShader.
- The Level 1 sample in `tests/hl1.spec.mjs` takes the sea urchin for the jellyfish (pieces mode
  now), as earlier lanes did for the mushroom and the soda can.
- `tests/an.spec.mjs` counts the atlas's organs in their eight new parts.
- Three poses: each whole toy (Level 1) changed is tested upright, on its side and upside down. A
  toy in pieces mode or one that follows the finger isn't tossed whole, so its pieces are tested as
  they are.
- `tests/hl1.spec.mjs` takes the Klein bottle for the Lorenz attractor (it follows the finger now).

## Known issues

- The frog turns at most about 35 degrees toward its fly: the splats are sorted for the frog as it
  sits, and a bigger turn of the whole toy showed it speckled.
- The penguin's and snail's upright springs are stiff (their bases, as their splats give them, would
  otherwise leave them leaning or creeping), so a push tips the penguin only a little.
- With a hands-on rope, the jellyfish's tentacles lose their faint twinkle (they are skin splats
  now), as the octopus's arms did.
- The Enigma's rotor letters look garbled when a rotor is set far from A, with the ✋ switch off too
  (the toy's rotor build); a hand turning a rotor shows it more often.
- The geode's front half swings on its hinge rather than lifting off (its halves open like a book,
  built twice so they sort right).
- Sliding the Pythagoras triangles, one can pass over another for a moment on the way.

## For the Operator

- Engine PR #441 first; then one PR per shelf, stacked on it, each waiting for the owner's marks.
- The periodic table and the quartz cluster follow once H3's #430 merges.
- The Enigma's garbled rotor letters (above) are in the toy's own build; a fix belongs to its lane
  (Computing), not Hands-on.

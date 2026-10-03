# Lane Hands-on engine C: soft parts (prefix `hec`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Hands engine C (prefix `hec`). Branches:
`claude/lane-hands-engine-c` (the engine PR) and `claude/lane-hands-engine-c-toys` (the demo toys).
PR titles: "Engine: hands-on …" and "Phase Hands engine C: …". Handoff file:
docs/handoff/HandsEngineC.md. Model: Opus 5.5.

### Brief (written by the Operator on October 3, 2026, after the owner accepted the whole Hands-on Plan)

The owner accepted every line of docs/HANDS-ON-PLAN.md on the morning of October 3, 2026. He wants
every toy hands-on within one to three days. Level 1 (pick up and toss any toy, ↺ Reset) is already
on main (#176, the XPBD engine, and #203, the hand grab). The plan's other 183 lines need new engine
pieces. Three engine lanes build them in parallel; then five category lanes build the toys.

#### Your pieces

- **Chains and ropes**: links that hang, swing and can be pulled (DNA, willow, kelp, jellyfish,
  octopus, yo-yo, kite line, running-shoe laces, pagoda chimes, the decorated tree's ornaments, the
  teddy bear's loose limbs).
- **Cloth**: a sheet that hangs, drapes and flutters, pinned at its edge (the kite's tail, the
  hoodie's hood, and later the flags, such as the Moon's).
- **Soft stretch**, generalized from the gummy bear and the jelly so any recipe can use it: pull and
  stretch a soft body; let go and it wobbles back (jelly, amoeba, jelly blob, bacterium, chromosome,
  red blood cell, pretzel, torus knot, lungs, cupcake icing, pufferfish, pizza cheese strings). Soft
  materials must still look solid: no see-through, no speckle.

#### Demo toys (yours to finish, with clips)

yo-yo (drop it on its string and pull it back up), kite (fly it on its line, the tail flutters),
hoodie (the hood flops), octopus (the arms trail and curl), jelly blob (stretch it and let go) and
pizza (pull a slice; the cheese strings stretch and snap).

#### Rules for all three engine lanes

Three engine lanes run at once (A: bodies and fields, B: joints, C: soft parts), so keep out of each
other's way:

- Put your code in your own new module, and keep the lines you add to `src/physics/world.js`,
  `src/physics/hands-on.js`, `src/player.js` or `src/app.js` few and additive (a hook, an import, a
  dispatch). When main moves, merge it into your branches and resolve by keeping both sides.
- A recipe asks for your pieces through its `hands` block (for example `hands.material`,
  `hands.joints`, `hands.soft`; name yours clearly). Document your keys in a new subsection of
  docs/PACKS.md ("Hands-on: <your pieces>") with one short example each, because five category lanes
  will build the other 160 or so toys from that documentation.
- Two PRs: an additive engine PR on your engine branch ("Engine: hands-on …"), merged first; then
  your lane PR on your lane branch with the demo toys below. Old `#s=` links and saved scenes keep
  loading; toys not using your pieces behave exactly as before; nothing loads until the Hands-on
  switch is on.
- Every piece must follow the effect quality rules (CLAUDE.md): solid parts move as solid pieces,
  separate things move separately, everything comes back home on ↺ Reset, and nothing flies off,
  jitters or sinks through the floor. Hold 60 fps on a mid-range phone: measure the step time with
  the demo toys running.
- Proof: `tests/<prefix>-engine.spec.mjs` for the engine pieces (each piece's behavior measured:
  heights, angles, positions over time) and `tests/<prefix>.spec.mjs` for the demo toys. Phone-size
  clips (`tools/phy-clip.mjs`) of each demo toy, posted as cards on Effect review page 2 under your
  lane id, each saying what to try with a finger.
- Don't build the other toys in the plan: five category lanes start as soon as your engine PR
  merges. Do list, in your handoff file, which plan lines your pieces cover, so the Operator can
  brief them.

#### You own

`src/physics/soft.js`, `tests/hec*.spec.mjs`, the demo toys' hands-on entries, your section of
docs/PACKS.md, your toys' entries in the shared lists, and this handoff file. Engine lines in shared
files go only through your engine PR.

#### How this lane runs

- The Operator session runs the lanes. The owner, Ryan, talks only to the Operator. Don't ask him
  anything or wait for him. Put questions and blockers in your final message ("READY:", "WORKING:"
  or "BLOCKED:"), and the Operator answers or relays them. Messages that arrive "From the Operator"
  come from the coordinator on the owner's behalf.
- Model: Opus 5.5 only, at the default effort. At most one helper at a time, same model. Usage is
  tight this week: work efficiently, run long jobs (clips, the full suite) in the background, and
  run the full suite once, at the end.
- Merging: the Operator merges additive engine PRs after a full test run. Never merge anything
  yourself.
- Language: every new text is in American English (color, center, gray, license, -ize endings, dates
  like "October 3, 2026").
- Read first: CLAUDE.md; docs/OPERATING.md ("Steps for a lane"); docs/HANDS-ON-PLAN.md (the plan the
  owner approved in full, especially "Engine pieces this plan needs"); docs/handoff/Physics.md (how
  the engine works: units, stacking, picking and placing, known issues); `src/physics/world.js` and
  `src/physics/hands-on.js`; `tools/phy-clip.mjs` (phone-size clips with a finger dot).
- Your handoff file: start it with this brief, word for word, under "## Brief", then keep "## State"
  current.
- Before every push: CLAUDE.md, "Before every push".

## State

Starting, October 3, 2026.

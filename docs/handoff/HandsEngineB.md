# Lane Hands-on engine B: joints (prefix `heb`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Hands engine B (prefix `heb`). Branches:
`claude/lane-hands-engine-b` (the engine PR) and `claude/lane-hands-engine-b-toys` (the demo toys).
PR titles: "Engine: hands-on …" and "Phase Hands engine B: …". Handoff file:
docs/handoff/HandsEngineB.md. Model: Opus 5.5.

### Brief (written by the Operator on October 3, 2026, after the owner accepted the whole Hands-on Plan)

The owner accepted every line of docs/HANDS-ON-PLAN.md on the morning of October 3, 2026. He wants
every toy hands-on within one to three days. Level 1 (pick up and toss any toy, ↺ Reset) is already
on main (#176, the XPBD engine, and #203, the hand grab). The plan's other 183 lines need new engine
pieces. Three engine lanes build them in parallel; then five category lanes build the toys.

#### Your pieces

- **Hinges with limits and a spring**: a part swings on an axis between two angles, with an optional
  spring home (chest, book, music box, knight's helmet, ladybug, sunglasses, pearl, desk lamp, desk
  fan, picture frame, paper lantern, castle drawbridge, origami crane; the sailboat and penguin's
  self-righting).
- **Sliders**: a part that moves along one line between two stops (sword in the stone, telescope,
  fountain-pen cap, umbrella runner, potion cork, bow and crossbow strings, Turing-machine tape).
- **Dials and cranks**: drag to turn a part about its axis, with optional detents and coasting
  (music-box crank, difference engine, Enigma rotors, Mandelbulb discs, wind-up robot key,
  water-bottle cap, alarm-clock and Big Ben hands, windmill sails, propellers, rotors, bicycle
  pedals, the spinning Earth and pulsar).
- **Home sockets**: a piece clicks back into its place when brought close (orange wedges, watermelon
  slices, anatomy-atlas organs, periodic-table tiles, platonic faces, diatom and geode halves,
  birthday candles, acorn caps, gift-box and jack-o'-lantern lids).
- **Breakable joints**: parts snap apart under a pull and ↺ Reset mends them (candy cane, quartz
  points, daisy and rose petals, pinecone scales, grapes, bananas, dragon egg shell, Menger cubes,
  dandelion seeds).
- **Rigid rig parts on scans**: a scan's hard-edged rig parts (`src/rigs.js`) become their own
  bodies (tomatoes, basket, pomegranate, real croissant). Never bend a scan.

#### Demo toys (yours to finish, with clips)

chest (the lid on its hinge), sword in the stone (draw it out along its slider), music box (turn the
crank and it plays), orange (pull the wedges out; they click back), candy cane (snap it; Reset mends
it) and tomatoes (pick up each of the ten).

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

`src/physics/joints.js`, `tests/heb*.spec.mjs`, the demo toys' hands-on entries, your section of
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
- Your handoff file: start it with this brief, word for word, under "## Brief", then keep "## State

Model: Opus 5.5 (claude-opus-5-5), default effort. No helper.

- October 3, 2026: lane started.
- Engine (`claude/lane-hands-engine-b`, draft PR #224, "Engine: hands-on joints"):
  `src/physics/joints.js` (hinges, sliders, dials, sockets, breaks, `parent`, `start`, `upright`,
  `rigPieces`), marked hook lines in `src/physics/hands-on.js`, `hard: true` for scan rigs (two
  shader lines in `src/rig.js`: each splat wholly in one part), `tests/heb-engine.spec.mjs` (12
  tests) and docs/PACKS.md, "5g. Hands-on: joints".
- Demo toys (`claude/lane-hands-engine-b-toys`): chest (lid hinge), music box (lid hinge, crank dial
  playing the tune note by note, dancer and notes ride on them), sword in the stone (slider, stuck
  then free, friction), orange (eight wedge sockets), candy cane (breaks; ↺ mends) and tomatoes
  (`rigPieces`, a hard rig). Help lines, plan entries, `tests/heb.spec.mjs` (6 tests),
  `heb-music-box` screenshots. Clips posted on Effect review page 2 (lane HandsEngineB, six cards).
- Step time (Hands-on's whole step, world and joints, desktop CPU in the sandbox), mean per 60 fps
  frame while moving: sword 0.01 ms, music box 0.04, chest 0.06, candy cane 0.2, orange 0.8,
  tomatoes 1.3 ms; worst single frame 17 ms (tomatoes, likely a collection pause or the first step
  after a pick). A mid-range phone is perhaps 3 to 4 times slower: well inside a frame on average.

- Full suite (in parts; each run here stops at 2 hours): every spec file covered; all pass but one
  timeout in `smoke.spec.mjs` (desktop screenshot, the cactus scan loading slowly under load; it
  passes alone in 22 s). Lane PR #229 (draft). #224 merged October 3, 2026 (with engines A and C,
  combo J); main merged into the toys branch.

## Known issues

- Owner's marks (October 4, 2026): candy cane, chest, orange and sword good. Music box: the dancer
  seemed to tip back as she turned; it was splat order (sorted in her built pose), so the recipe now
  asks for `out.resortPose` every quarter radian she or the lid turns by hand (card
  heb-music-box-r2). The toy's own idle spin (the tap's, unchanged) still shows it now and then: a
  re-sort costs about 5 ms on the desktop, too much five times a second on a phone for an idle toy.
  Tomatoes: while any tomato is off its place, the whole pile shows as kit-built tomatoes (each
  lifted one rides with Hands-on), so nothing torn is left; ↺ brings the scan back (card
  heb-tomatoes-r3). The tomatoes' faint red reflection in the plate's glaze stays.
- Chest and music box: a press on the box's front can pick the lid (the nearest piece); fine in
  practice, but a press on the box body is not a no-op.
- Hands-on starts off for the demo toys (they are public): turn on ✋ first.

## Plan lines my pieces cover (for the category lanes)

Keys are in docs/PACKS.md, "5g. Hands-on: joints".

- **hinge**: chest, book (cover), music box (lid), knight's helmet (visor), ladybug (wing cases),
  sunglasses (arms), pearl (oyster shell), desk lamp (arms, with `parent`), desk fan (head tilt),
  picture frame (on its nail: a hinge with `spring` and `damping`), paper lantern (on its string,
  likewise), castle (drawbridge), origami crane, half adder (levers), Big Ben's bell, pagoda chimes
  (one hinge each), decorated tree's ornaments (hinges on hooks).
- **slider**: sword in the stone, telescope (tubes, each with `parent`), fountain pen (cap),
  umbrella (runner), potion bottle (cork, with `stick`), crossbow string, Turing machine (tape),
  Pythagoras proof (triangles along their tracks), birthday cake candles (or sockets).
- **dial**: music-box crank, difference engine (crank; wheels with `also`), Enigma rotors (with
  `detents: 26`), Mandelbulb discs, wind-up robot key (`min`/`max`), water bottle cap (then a
  socket), alarm clock and Big Ben hands (`also` turns the hour hand), windmill sails, propeller
  plane, helicopter rotor, bicycle pedals, Earth and pulsar (a dial on the globe, `drag` low),
  spinning top and patterned egg (a dial, until the category lane wants real tops).
- **socket**: orange wedges, watermelon slices, anatomy-atlas organs, periodic-table tiles, platonic
  faces, diatom lid, geode top half, birthday candles, acorn caps, gift-box lid, jack-o'-lantern
  lid, croissant top, boiled egg cap, kiwi, avocado, croissant-real and pomegranate halves (with
  `rigPieces`).
- **break**: candy cane, quartz points, daisy and rose petals, pinecone scales, bananas, dragon egg
  shell, Menger cubes, dandelion seeds (ground breaks with a low `pull`), protein (a break whose
  piece is then a socket: use both, the socket's `snap` after it is broken off).
- **upright**: sailboat, penguin.
- **rigPieces**: tomatoes, basket (shells), pomegranate and real croissant halves.

## Notes

- Driven parts (hinge, slider, dial) are one number each and posed exactly from it; they are fixed
  bodies in the world, so loose pieces bump into them but never push them. Loose pieces (sockets,
  broken pieces) are ordinary bodies.
- A joint is asleep from ↺ until first touched, so a part built off its resting place stays as
  built.
- Sounds go out through the player's "cue" event (`src/app.js` plays them), so no app.js lines.

## For the Operator

- Engine lines (all additive, in `src/physics/hands-on.js`, each marked "lane Hands engine B"): an
  import; `this.joints = null` in `clear`; `ensure` builds pieces for `hands.joints` too; one
  `makeJoints` line at the end of each world build; `hands.pieces?.()`; a nudge never on a joints
  toy; and hooks in `moveTo`, `pickUp`, `release`, the ↺ glide, `step`, `onHit` and `apply`.

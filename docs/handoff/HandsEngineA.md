# Lane Hands-on engine A: bodies and fields (prefix `hea`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Hands engine A (prefix `hea`). Branches:
`claude/lane-hands-engine-a` (the engine PR) and `claude/lane-hands-engine-a-toys` (the demo toys).
PR titles: "Engine: hands-on …" and "Phase Hands engine A: …". Handoff file:
docs/handoff/HandsEngineA.md. Model: Opus 5.5.

### Brief (written by the Operator on October 3, 2026, after the owner accepted the whole Hands-on Plan)

The owner accepted every line of docs/HANDS-ON-PLAN.md on the morning of October 3, 2026. He wants
every toy hands-on within one to three days. Level 1 (pick up and toss any toy, ↺ Reset) is already
on main (#176, the XPBD engine, and #203, the hand grab). The plan's other 183 lines need new engine
pieces. Three engine lanes build them in parallel; then five category lanes build the toys.

#### Your pieces

- **Per-toy material**: bounce (restitution), weight, friction, rolling resistance, spin and air
  drag, plus lift for flat fliers, so a throw moves like the real thing (every ball, the paper
  plane, baseball cap, beach ball, shuttlecock and flying disc). Real numbers (mass, size,
  restitution, drag) come with sources: Codex task 11 is gathering them into
  `tools/hands-on-materials.json`; use it if it has landed, else use well-known values and say so.
- **Water line and buoyancy**: a water surface a toy can float on, bob and settle (water polo ball,
  lotus, iceberg, ocean liner, submarine, sailboat), and buoyancy in air (the hot-air balloon).
- **Gravity wells**: a pull toward a point instead of the floor (solar system, black hole,
  asteroid).
- **Wheels that roll** on the ground when pushed (steam train, sports car, bus, bicycle, tractor).
- **Shake detection**: a quick back-and-forth drag fires the toy's shake effect (snow globe, soda
  can, oak, pine, cherry blossom, maple, decorated tree).
- **Follow or flee the finger** (school of fish, owl, eye, frog, white blood cell).
- **Projectiles and targets**, objects only (bow and target already exists; crossbow, trebuchet).

#### Demo toys (yours to finish, with clips)

basketball (spin it on a fingertip), beach ball (floats and drifts), water polo ball (bobs on the
water line), sports car (push it and it rolls), snow globe (shake it) and school of fish (the fish
flee the finger).

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

`src/physics/materials.js`, `src/physics/fields.js`, `tests/hea*.spec.mjs`, the demo toys' hands-on
entries, your section of docs/PACKS.md, your toys' entries in the shared lists, and this handoff
file. Engine lines in shared files go only through your engine PR.

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

Model: Opus 5.5 (claude-opus-5-5), default effort. No helper so far.

- October 3, 2026: the engine PR is up on `claude/lane-hands-engine-a` ("Engine: hands-on bodies and
  fields"). The demo toys come next on `claude/lane-hands-engine-a-toys`, built on top of it.
- Engine: `src/physics/materials.js` (per-toy materials: bounce, weight, friction, rolling
  resistance, spin, drag, Magnus curve, a flier's lift, nose-first flight, the fingertip spin),
  `src/physics/fields.js` (water line and buoyancy, buoyancy in air, gravity wells, wheels, shake
  detection, follow or flee the finger, projectiles that stick in targets, and the `Extras` glue to
  Hands-on), `src/physics/water-view.js` (the water's surface: its own splat entity, sorted with the
  toy's, loaded only when a water toy has Hands-on on). Documented in docs/PACKS.md, "5f. Hands-on:
  bodies and fields". Tests: `tests/hea-engine.spec.mjs` (13 engine tests measuring heights, times,
  angles and positions; 5 in the app).
- Engine PR #226 (draft). Demo toys on `claude/lane-hands-engine-a-toys`: basketball (an upward
  flick while holding spins it on the fingertip), beach ball (light and big: floats down and
  drifts), water polo ball (floats on a pool, a third under; bobs and settles), sports car (a drag
  pushes; it rolls on, wheels turning), snow globe (pick it up and shake it), school of fish (a drag
  through it: the fish dart away and swim back). Help lines and plan entries updated;
  `tests/hea.spec.mjs`.
- Lane PR #232 (draft). Clips posted on Effect review page 2 as cards `hea-*` under lane
  "HandsEngineA". Full suite green on the lane branch (run in two parts: 567 tests, then the
  remaining 300; the 2-hour background limit stopped the first); check-packs passes for the six
  toys. Waiting on the Operator to merge #226, and on the owner's marks for #232.
- Step time with the demo toys moving (headless Chromium, this container): median under 0.1 ms, 95th
  percentile 0.2 ms per frame; the one-time hull build on the first touch takes 2 to 8 ms.
- Real numbers: `tools/hands-on-materials.json` (Codex task 11) had not landed, so the presets use
  the governing bodies' regulation sizes and masses and the rule books' bounce tests (listed at the
  top of `materials.js`). Drag is the real thing, scaled (Fr = 2 m / (rho cd pi r^3) has no units).
  Lift and the Magnus curve are set to show at Hands-on's slow throws (at most 4 toy radii per
  second, about a hundred times slower than a real pitch), in the real direction and order.

## Notes

- Shared-file lines (all additive): `src/physics/world.js` (`World.force`, called once per substep
  before anything moves; `b.coasts` skips the calming of slow resting bodies, for wheels),
  `src/physics/hands-on.js` (an import; `this.extras` made in `attach`; `extras.build(w)` when
  either world is built; hooks at the top of `pressAt`, `moveTo`, `release` and `onHit`;
  `extras.thrown(h)` on a let-go; `extras.step(dt)` each frame), `src/motion.js` (one line:
  `info.hands` for a recipe's drive). A toy whose hands block asks for none of these keys gets no
  Extras: it plays exactly as before.
- The stage draws only splats (no mesh component system), so the water is a disc of flat splats,
  unified with the toy so the part under the line shows faintly through the water.
- A water ball rests where its density says: the water line is worked out from the toy at home, so
  nothing moves until touched. The water moving with a bobbing ball (its added mass) and the waves
  it makes take its bob away in two or three bobs.
- Wheels: a drag pushes (never lifts); the play area's walls move out to 2.4 toy radii; the wheel
  parts' angle comes from the distance rolled, so they roll back as ↺ Reset glides it home.

## Plan lines these pieces cover (for the category lanes)

- Material: every ball (25: basketball, soccer ball, American football, tennis ball, baseball,
  softball, beach ball, golf ball, rugby ball, volleyball, water polo ball, ping-pong ball, cricket
  ball, bowling ball, pool ball, pickleball, dodgeball, medicine ball, lacrosse ball, squash ball,
  bouncy ball, marble, hockey puck, shuttlecock, flying disc), paper plane, baseball cap; balloon
  dog ("falls slowly and light": a material with a low mass and big r).
- Water line: water polo ball, lotus, iceberg (and its chunk, as a piece), ocean liner, submarine,
  sailboat (heels and rights itself: points under water lift where they are).
- Air: hot-air balloon.
- Wells: solar system, black hole (`capture`), asteroid (chunks drift back together: a well at its
  middle with pieces).
- Wheels: steam train (`info.hands.rolled` turns the rods), sports car, bus, bicycle (pedals are a
  crank: lane B), tractor.
- Shake: snow globe, soda can (shake level for the spray), oak, pine, cherry blossom, maple,
  decorated tree (ornaments swing: lane C's chains with the shake level).
- Follow or flee: school of fish (flee), owl and eye (follow `info.hands.point`), frog (follow, with
  a fly piece), white blood cell (follow a dragged bacterium piece).
- Projectiles and targets: bow and target, crossbow and trebuchet (the string and arm are lane B's
  sliders and hinges; the bolt and stone are projectile pieces).

- Level 1 fix (lane Physics' engine): a kit toy tossed whole kept its turning parts and tokens
  turning about where it was built (the kit shader works in the world), so a pushed car's wheels
  came off. `poseKitUniforms` (fields.js), set as `motion.handsFix` by `HandsOn.apply`, moves their
  pivots, turns and offsets through the toy's pose. Kit toys only.

## Known issues

- A rig toy (a scan with parts) tossed whole still turns its parts about home.
- Lift and the curve are toy-speed values, not measured ones (see above).
- The fingertip spin needs a quick upward flick while holding the ball (about 500 CSS pixels per
  second); slower lifts just lift it.

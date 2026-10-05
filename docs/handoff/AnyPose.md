# Lane Any pose (prefix `pose`): cloud lane (moved from local, October 4, 2026)

## Brief

**Moved to the cloud (October 4, 2026, the owner's push).** This lane now runs in a cloud session
that the Operator starts, not on the owner's Mac. Everything below holds, except the local parts:
your checkout is the session's own clone on the branch named below (no worktree), use the default
port 4173 (no `SPLASHERY_PORT`), messages arrive in your session as "From the Operator" (not as PR
comments), you finish every working turn with a final message that starts "READY:", "WORKING:" or
"BLOCKED:" (and keep the same line at the top of "## State"), and clips go on Effect review page 2
(https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK), as docs/OPERATING.md, "Steps for a lane", says.
About ten lanes build at once during the push: edit only the files you own, merge main into your
branch whenever it moves, and run your own specs and those of the files you touch before each push;
the Integrators run the full suite before a merge (say in your PR which specs you ran).

Local lane. You are a Splashery worker session, started by the owner on his Mac from a brief the
Operator wrote. Repo: ryanjosephkamp/splashery. Your lane: Any pose (id `AnyPose`, prefix `pose`).
Your folder is a git worktree on `claude/lane-any-pose`. Your port: 4182. PR title: "Phase Any pose:
every effect works on its side and upside down". Handoff file: docs/handoff/AnyPose.md (this file;
your brief is already here). Model: Opus 5.5.

### Brief (written by the Operator on October 3, 2026, from the owner's notes that afternoon)

The owner, on October 3, 2026: "It looks like some of the effects don't work well when the
objects/toys are on the ground or turned over. For example, the hoodie animation breaks at the hood
and arms like it used to." Since the hands-on switch (#176, #203), people pick toys up, toss them
and leave them lying on their side or upside down, then tap them.

#### What to build

1. **Reproduce.** The hoodie: tap it upright, then after a hands-on toss leaves it on its side, then
   upside down. Clip all three. Find the cause: an effect, part or soft region computed in world
   space or by world height, an "up" or gravity assumption, a bounding box taken in the rest pose,
   or the settle step fighting the effect.
2. **Engine fix**, small and additive (PR "Engine: tap effects in the toy's own frame, in any
   pose"): effects, parts and soft regions work in the toy's own frame whatever its pose. Upright
   behavior stays identical: prove it with positions measured before and after on a sample of toys.
3. **Sweep.** Every toy on every shelf (labs too): tap it upright, on its side and upside down, and
   compare the effect's motion in the toy's own frame. Write docs/audits/poses-2026-10.md (a verdict
   per toy) and `tests/pose.spec.mjs` (a sample of toys in three poses, plus every toy you fix).
   Never edit `tests/taps.spec.mjs`.
4. **Fix** what the sweep finds. Where the fix is in a toy's own recipe, change only that and list
   it. Post clips (upright against on its side) of the hoodie and the five worst others.
5. **Gravity effects.** Effects that only make sense one way up (pouring water, a candle flame, a
   snow globe's snow, a pendulum, sand) follow real gravity, not the toy's frame: list them and
   check each.

Work alongside: Hands engine C (#225, #230) owns the hoodie's new hands-on cloth, and lane Physics
built the grab and settle (#203, #222, #184). Keep your engine code in your own new module
(`src/physics/pose.js` or `src/effects-pose.js`) with few, additive lines elsewhere. If a fix needs
another lane's files, say so in "State" and let the Operator sequence it.

#### You own

Your new module, the engine lines in your engine PR, `tests/pose*.spec.mjs`,
docs/audits/poses-2026-10.md, the per-toy recipe fixes your sweep lists, and this file.

#### How this lane runs (local lane)

- You run in Claude Code on the owner's Mac, signed in to his second Claude account. Follow
  docs/OPERATING.md, "Local lanes", exactly: your own port (4182), the local test set, messages as
  comments on your PR that start "From the Operator", the "READY:", "WORKING:" or "BLOCKED:" line at
  the top of "## State", and clips on page 2 or on `claude/clips-AnyPose`.
- The Operator (a cloud session) runs the lanes; the owner, Ryan, talks only to the Operator and is
  often away from the Mac. Never ask him anything in the terminal or wait for him: put questions in
  "State", move on to the next item, and keep going.
- Model: Opus 5.5 only, at the default effort. If `/model` shows another model, stop and say so in
  "State". At most one helper at a time, same model.
- Merging: the Operator merges. Never merge anything. An engine change is its own small, additive
  "Engine: …" PR on `claude/lane-any-pose-engine`, merged first; toys not using it behave exactly as
  before.
- Every new toy is behind the labs switch (`labs: true`). Old `#s=` links and saved scenes keep
  loading.
- Every effect follows the effect quality rules in CLAUDE.md (real motion of solid pieces, separate
  things moving separately, break-apart into real pieces that come back), judged as phone-size
  clips, and works with the toy upright, on its side and upside down.
- Licenses, for every asset and dataset (CLAUDE.md, "Ground rules"): read the license on the live
  source page; record it in CREDITS.md, `tools/assets.json` (or `tools/models.json`) and the toy's
  in-app credit; `"nc": true` on NC assets; never ND, unlicensed, personal-use or paid. A license
  not on that list (ODbL, CERN-OHL, government terms, "free with attribution") is a question for the
  Operator in "State", not a file in the repo. Nothing human (people, faces, human anatomy or human
  scans) without the owner's yes. No logos or brand names.
- A static site: data becomes splats at build time (your `tools/pose-*.mjs`; any new devDependency
  pinned and listed in LICENSES.md). The page never calls a data service or needs a key, and big
  files load only when the toy opens. Keep sizes inside the phone budgets.
- Work through the items in order. Open your draft PR early ("Phase Any pose: …", five sections from
  CLAUDE.md, naming Opus 5.5), push after each finished item with "State" updated, and run long jobs
  (clips, tests) in the background.
- Language: American English in every new text (color, center, gray, license, -ize endings, dates
  like "October 3, 2026").
- Read first: CLAUDE.md; docs/OPERATING.md ("Local lanes", "Steps for a lane", "A lane's end");
  docs/PACKS.md; docs/handoff/Physics.md and docs/handoff/HandsEngineC.md;
  `src/physics/hands-on.js`; `src/player.js` (how a tap runs); docs/PACKS.md on effects and soft
  regions.
- Before every push: CLAUDE.md, "Before every push", with the local test set. At the end: "A lane's
  end".

## State

WORKING: engine PR #276 and lane PR #277 open (drafts); the full sweep is running (October 5, 2026).
Model: Opus 5.5, default effort.

### The cause (item 1)

PlayCanvas runs Splashery's effect shader (`modifySplatCenter` in `src/effects.js`) on each splat's
center in the world, after the toy's entity has placed it. Hands-on poses a whole toy by turning and
moving that entity (`Stage.setToyPose`), so every effect of a posed toy was worked out about where
the toy stood at home, with the world's up as its own: a rig scan's parts (the grape's peel, the
hoodie's hood and sleeves before it got its own cloth) turned about pivots left behind, swells and
spins went about an empty center, sways, key presses and pokes went along the wrong axes. Engine A's
`poseKitUniforms` (#225) had patched only a kit toy's parts and tokens; rig scans, every kit
behavior kind and every effect-panel effect were still wrong. The hoodie on main now plays in pieces
(its hood is a cloth part, #230) and is no longer tossed whole, so it shows the fault only when
forced to play as one body (`tools/pose-clip.mjs --level1`).

### Engine fix (item 2): branch `claude/lane-any-pose-engine`

- `src/effects-pose.js` (new): the pose uniforms (`uSpPoseQ`, `uSpPoseT`, `uSpPoseC`, `uSpPoseUp`)
  and the world points and directions the shader reads (pokes, magnet, grab, wind, the drop's
  gravity, the camera, the squish) taken into the toy's home frame.
- `src/effects.js`: with a pose set, the shader takes each center into the home frame first, runs
  every effect there, puts it back after, and turns each splat's effect rotation by the pose. With
  no pose the old code runs unchanged. Flame, rise and fall kinds follow the world's real up.
- `src/stage.js` (1 line: `toyPose`), `src/player.js` (3 lines), `src/physics/hands-on.js`
  (`handsFix` no longer set: the shader does it).
- Tools: `tools/pose-clip.mjs` (a tap upright, on its side and upside down, side by side),
  `tools/pose-sweep.mjs` (every toy measured), `tools/pose-upright.mjs` (upright frames and uniforms
  hashed, main against the branch).

### Verified so far (October 5, 2026)

- Upright untouched: `tools/pose-upright.mjs` on 15 toys × 5 moments, main against the engine
  branch: every effect uniform identical (0 of 75 differ); frames pixel-identical except two late
  heart frames, which also differ between two runs of the same branch (rendering timing).
- `tests/pose-engine.spec.mjs` (4) and `tests/pose.spec.mjs` (grape, toy piano, heart, bee: error 0
  in both poses) pass. `hea-engine`, `heb-engine`, `phy-engine` and `hec-engine` pass, except the
  `hec-engine` timing test "soft parts are cheap", run while the machine was busy (to re-run idle).
- Before the fix the grape's peel scored 34 (posed frames against the upright ones turned on the
  screen); after, 0. The sweep (`tools/pose-sweep.mjs`, two parts) is measuring every toy.
- Clips on Effect review page 2: `pose-grape` and `pose-hoodie` (after), with `-before` cards.

### Gravity effects (item 5), so far

- Engine: flame and rise kinds rise along the world's real up; fall kinds (the snow globe's snow,
  rain under the storm cloud) fall along it only as far as the world's down runs down the toy, so
  nothing falls out through a container's wall. A recipe's drive gets `about.up` while posed.
- Never posed whole, so nothing to fix: the Newton's cradle (its own drags), the fluid lab
  (`turntable: false`).
- Still to check by eye: candle, campfire, snow globe, lava lamp, storm cloud, and the toys the
  sweep marks "check".

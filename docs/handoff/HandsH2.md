# Lane Hands-on H2 (prefix `hh2`): local lane

## Brief

Local lane. You are a Splashery worker session, started by the owner on his Mac from a brief the
Operator wrote. Repo: ryanjosephkamp/splashery. Your lane: Hands-on H2 (id `HandsH2`, prefix `hh2`).
Your folder is a git worktree on `claude/lane-hands-h2`. Your port: 4188. Handoff file:
docs/handoff/HandsH2.md (this file; your brief is already here). Model: Opus 5.5.

### Brief (written by the Operator on October 3, 2026)

**First, check that you can start:** docs/PACKS.md on main must have sections 5f (bodies and
fields), 5g (joints) and 5h (soft parts), which arrive when the three hands-on engines merge. If
they aren't there yet, set "State" to "BLOCKED: waiting for the hands-on engines", push, and stop.

The owner accepted every line of docs/HANDS-ON-PLAN.md on October 3, 2026, and wants every toy
hands-on. Level 1 (pick up, toss, land, ↺ Reset) is on main for all of them. Three engine lanes
built the pieces the plan's other lines need (materials, water, air, wells, wheels, shake, flee,
projectiles; hinges, sliders, dials, sockets, breaks; ropes, cloth and stretch), each with a few
demo toys. Five category lanes now build the rest. Yours are these shelves:

- Food
- Nature

#### What to build

1. **Every line of the plan for your shelves** that goes beyond Level 1, as the plan describes it,
   built from the engine pieces through each toy's `hands` block. Skip lines marked "Level 1 only.",
   "Already hands-on" or "Built by lane Physics.", and the 18 demo toys the engine lanes built.
2. **Real numbers** for weights, bounce and drag from `tools/hands-on-materials.json` (Codex task
   11). Most of its numbers are marked as estimates: prefer the confirmed ones, and keep the motion
   believable at the toys' scale.
3. **The L1 sweep's findings:** any real finding the L1 sweep lists for your shelves (toys that
   never settle, sink into the floor or cross a wall).
4. **Any pose:** every hands-on effect also works with the toy on its side or upside down (lane Any
   pose fixes the engine side); test three poses for each toy you change.
5. **One PR per shelf**, in the order above, on `claude/lane-hands-h2-<shelf>` (for example
   `claude/lane-hands-h2-food`), titled "Phase Hands-on H2, <shelf>: …", each with a phone-size clip
   of every toy it changes (`tools/phy-clip.mjs`), posted as cards under your lane id and grouped by
   shelf, each card saying what to try with a finger. Tests in `tests/hh2*.spec.mjs`: each piece
   measured (heights, angles, positions over time) for a sample of your toys.
6. If a line needs an engine piece that doesn't exist, don't build a private one: say so in "State",
   skip that line, and move on. A small fix to an engine piece goes in its own "Engine: …" PR.

#### You own

Your shelves' toys' `hands` blocks and their own recipe lines in `src/packs/` (nothing else in a
recipe), `tests/hh2*.spec.mjs`, `tools/hh2-*.mjs`, your toys' entries in the shared lists, and this
file. The engine files belong to the merged engines; another lane's toys are theirs.

#### How this lane runs (local lane)

- You run in Claude Code on the owner's Mac, signed in to his second Claude account. Follow
  docs/OPERATING.md, "Local lanes", exactly: your own port (4188), the local test set, messages as
  comments on your PR that start "From the Operator", the "READY:", "WORKING:" or "BLOCKED:" line at
  the top of "## State", and clips on page 2 or on `claude/clips-HandsH2`.
- The Operator (a cloud session) runs the lanes; the owner, Ryan, talks only to the Operator and is
  often away from the Mac. Never ask him anything in the terminal or wait for him: put questions in
  "State", move on to the next item, and keep going.
- Model: Opus 5.5 only, at the default effort. If `/model` shows another model, stop and say so in
  "State". At most one helper at a time, same model.
- Merging: the Operator merges. Never merge anything. An engine change is its own small, additive
  "Engine: …" PR on `claude/lane-hands-h2-engine`, merged first; toys not using it behave exactly as
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
- A static site: data becomes splats at build time (your `tools/hh2-*.mjs`; any new devDependency
  pinned and listed in LICENSES.md). The page never calls a data service or needs a key, and big
  files load only when the toy opens. Keep sizes inside the phone budgets.
- Work through the items in order. Open your draft PR early ("Phase Hands-on H2, <shelf>: …", five
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

The Operator (session_012GmKRUMZLir2nb27Bo8Cu2) restarted this lane in the cloud on October 8, 2026:
run in the cloud, not on the owner's Mac (ignore the parts about his Mac, his second account and the
local port; use `python3 -m http.server 4173 --bind 127.0.0.1`), and post clips on Effect review
page 2 rather than a clips branch. The first check (docs/PACKS.md sections 5f, 5g and 5h) passes.
Everything else in the brief above stands, in its order. Hands-on play only adds to a toy: with the
✋ switch off every toy plays exactly as before, and these are toys the public sees, so each shelf's
PR waits for the owner's "good" marks on its cards. How this lane runs: as
docs/handoff/ScienceR3.md, "How this lane runs", says (prefix `hh2`, lane record `HandsH2`). Clips
at phone size (390×844, device scale 3) on Effect review page 2; new sounds in
tools/sound-review.json as "ready". Finish every working turn with "READY:", "WORKING:" or
"BLOCKED:". Card ids hh2-…. A first READY with the first shelf and its clips within about six hours.

## State

READY: Food (draft PR #426) and the engine pieces (draft PR #420, merge first) are done; all 16 Food
clips are on Effect review page 2 (hh2-…, group Food), at device scale 2 (the Operator's call of
October 8, 2026). WORKING on Nature (draft PR #431): built and tested, its clips rendering and
posting under group Nature. (October 8, 2026.)

Food, line by line (docs/HANDS-ON-PLAN.md):

- Done: ice cream (scoops ride the cone on break joints, lift off, and spill when the cone is
  tipped), watermelon (six slices on sockets; the wedge picks up), birthday cake (each candle a
  token carrying its own flame part; pulled out it goes out; sockets push it back; the cake is a
  fixed collider), popcorn (the bucket tips on a hinge on its bottom edge; 14 kernels ride it and
  spill), pancakes (each pancake its own part; the plate a piece; a quick flick up flips one),
  cupcake (cherry on a socket; the frosting stretches), pretzel (stretches from its sides),
  croissant (the top on a socket), burger (six layers, free, stack in any order), boiled egg (the
  cap on a socket), coffee (stirred: the latte art's twelve rings turn after the finger), bananas
  (each breaks off at its neck with its skin riding it), kiwi (halves pulled apart show their faces;
  sockets put them back), pineapple (rings and crown stack), grapes (nine snap off and bounce),
  avocado (the stone lifts out and back; the empty half picks up).
- Skipped as the plan says: lollipop, taco, apple (Level 1 only); jelly, macarons, sushi, cherries
  (lane Physics); gummy bear (already hands-on); candy cane, pizza, orange (engine demo toys).
- Cut for now: the avocado's "drop it in either half" (the stone only goes back into its own half;
  see Known issues).

Nature (PR #431): the four trees and the dandelion use the engine's shake (it fires their own tap
effect); palm coconuts, rose and daisy petals and pinecone scales are break joints; the sunflower's
head is a sprung hinge carrying its petal tokens; acorn caps are on sockets; the lotus floats on the
water line; bonsai, willow, tulips, fern, toadstool, bamboo and kelp bend by soft stretch.
Deviations and cuts are in the PR (rope rigs for willow, kelp and bamboo; rolling acorns; the spore
puff on a squeeze).

## Notes

- Engine pieces added (PR #420, all opt-in, documented in docs/PACKS.md 5f): `flip` (a placed piece
  flicked up turns over), `shown` (a piece's rest pose when the drive shows it away from where it
  was built), `ride` (tokens that move with a piece, on token or part pieces), `place: false` on one
  piece, `offHome` (part entries while a piece is off its place), `hands.foot`, `info.hands.moved`,
  and on a break joint `spill` (comes loose when what it rides tips) and `place: true` (snapped off,
  it is held as a picked piece is).
- With ✋ off, every changed Food toy builds exactly the same splats as on main (positions, colors,
  sizes, turns and behaviors compared splat by splat; only the part indices differ, and the drives
  give the new parts the same moves the old ones had). The birthday cake's candles became tokens
  (behavior code changes, look identical in a screenshot side by side).
- `tools/hh2-bounds.mjs` prints each part's and token's extent in recipe units (for sizing pieces).
  `tools/hh2-clip.mjs` is lane Physics's clip tool with `--scale` and a `flick3` step.
- L1 sweep (docs/audits/hands-l1-sweep-2026-10.md): its findings on Food and Nature are engine-side
  ("rest-height" from the sparse hull, "center-miss" in app.js), nothing in these toys' recipes.
- Any pose: these toys play in pieces mode (the toy itself stays put), so the three poses are the
  pieces': tests/hh2-food.spec.mjs puts a kiwi half back after laying it face down, flips a pancake
  twice, and pushes a candle back after it lay on its side.

## Known issues

- Avocado: the stone goes back only into its own half. A physical cup in the tipped empty half did
  not hold it (it rolls out over the low side); a socket with several seats would need an engine
  piece. The empty seat of the first half shows flat flesh (it was never built hollow; changing it
  would change the toy with ✋ off).
- Pancakes: a flipped top pancake lands with its syrup and butter under it; the butter shows faintly
  through it at phone size.
- Coffee: ↺ doesn't unstir the art (stirring isn't a piece); turning ✋ off resets it.
- A wide piece set down right beside a stack (the burger's bun) can topple off its edge and nudge
  the light layers; that is the physics, and it reads as such.

## For the Operator

- Clips are at device scale 2 (the Operator's answer of October 8, 2026: keep them; redo one at 3
  only if the owner's mark asks for it).

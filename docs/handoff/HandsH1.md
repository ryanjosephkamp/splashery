# Lane Hands-on H1 (prefix `hh1`): local lane

## Brief

Local lane. You are a Splashery worker session, started by the owner on his Mac from a brief the
Operator wrote. Repo: ryanjosephkamp/splashery. Your lane: Hands-on H1 (id `HandsH1`, prefix `hh1`).
Your folder is a git worktree on `claude/lane-hands-h1`. Your port: 4187. Handoff file:
docs/handoff/HandsH1.md (this file; your brief is already here). Model: Opus 5.5.

### Brief (written by the Operator on October 3, 2026)

**First, check that you can start:** docs/PACKS.md on main must have sections 5f (bodies and
fields), 5g (joints) and 5h (soft parts), which arrive when the three hands-on engines merge. If
they aren't there yet, set "State" to "BLOCKED: waiting for the hands-on engines", push, and stop.

The owner accepted every line of docs/HANDS-ON-PLAN.md on October 3, 2026, and wants every toy
hands-on. Level 1 (pick up, toss, land, ↺ Reset) is on main for all of them. Three engine lanes
built the pieces the plan's other lines need (materials, water, air, wells, wheels, shake, flee,
projectiles; hinges, sliders, dials, sockets, breaks; ropes, cloth and stretch), each with a few
demo toys. Five category lanes now build the rest. Yours are these shelves:

- Balls
- Shapes
- Toys
- Clothing

#### What to build

1. **Every line of the plan for your shelves** that goes beyond Level 1, as the plan describes it,
   built from the engine pieces through each toy's `hands` block. Skip lines marked "Level 1 only.",
   "Already hands-on" or "Built by lane Physics.", and the 18 demo toys the engine lanes built.
2. **Real numbers** for weights, bounce and drag from `tools/hands-on-materials.json` (Codex task
   11). Most of its numbers are marked as estimates: prefer the confirmed ones, and keep the motion
   believable at the toys' scale.
3. **The L1 sweep's findings:** the garden gnome never comes to rest after a toss (the L1 sweep);
   fix it, and any other real finding the sweep lists for your shelves.
4. **Any pose:** every hands-on effect also works with the toy on its side or upside down (lane Any
   pose fixes the engine side); test three poses for each toy you change.
5. **One PR per shelf**, in the order above, on `claude/lane-hands-h1-<shelf>` (for example
   `claude/lane-hands-h1-balls`), titled "Phase Hands-on H1, <shelf>: …", each with a phone-size
   clip of every toy it changes (`tools/phy-clip.mjs`), posted as cards under your lane id and
   grouped by shelf, each card saying what to try with a finger. Tests in `tests/hh1*.spec.mjs`:
   each piece measured (heights, angles, positions over time) for a sample of your toys.
6. If a line needs an engine piece that doesn't exist, don't build a private one: say so in "State",
   skip that line, and move on. A small fix to an engine piece goes in its own "Engine: …" PR.

#### You own

Your shelves' toys' `hands` blocks and their own recipe lines in `src/packs/` (nothing else in a
recipe), `tests/hh1*.spec.mjs`, `tools/hh1-*.mjs`, your toys' entries in the shared lists, and this
file. The engine files belong to the merged engines; another lane's toys are theirs.

#### How this lane runs (local lane)

- You run in Claude Code on the owner's Mac, signed in to his second Claude account. Follow
  docs/OPERATING.md, "Local lanes", exactly: your own port (4187), the local test set, messages as
  comments on your PR that start "From the Operator", the "READY:", "WORKING:" or "BLOCKED:" line at
  the top of "## State

READY: all four shelves (October 8, 2026, cloud session, Opus 5.5). Merge the engine PR first; the
shelf PRs wait for the owner's marks on their `hh1-` cards (Effect review page 2, lane HandsH1: 36
cards, grouped Balls, Shapes, Toys and Clothing).

- Engine #421 (`claude/lane-hands-h1-engine`), main merged in: its specs pass, the hec-engine timing
  test included once the CPU was quiet.
- Balls #424: 22 balls, 22 cards; 39 specs passed (hh1-balls, hh1-engine, hea-engine, hea).
- Shapes #429: the jelly blob's stretch, 1 card; hh1-shapes passed.
- Toys #433: the rubber duck, spinning top, dice, teddy bear, paper plane, origami crane, balloon
  dog, soap bubbles and wind-up robot, 9 cards; hh1-toys, 9 passed. (The yo-yo, kite, spring toy,
  bricks, Newton's cradle, puzzle cube and chess set are the engine and Physics lanes'.)
- Clothing #434: the sunglasses, baseball cap, running shoe and hoodie's sleeves, 4 cards;
  hh1-clothing, 5 passed. (The hood is engine C's.)
- Owner's marks (read October 8, 2026, 22:54): every `hh1-` card "good" but two "fix" notes, both
  fixed and re-posted as `-r2` cards: the running shoe's loose laces now drape over the shoe and
  down its outside instead of falling through it (a shell of spheres under the scan's measured top
  and inside its sides; the test checks the laces against the scan itself), and the robot's clip is
  re-rendered from behind, wound by circling its key, so the key's turn shows. Main merged into all
  five branches the same evening; each lane spec passes.
- Not done: the garden gnome (the L1 sweep's finding) is a scan outside these shelves, its cause in
  the engine's resting contact (see "For the Operator").

## Notes

- Engine PR #421 (`claude/lane-hands-h1-engine`), the pieces found while wiring the balls:
  - A material's `nose` acted on the ground too, so the shuttlecock flipped over and over as it slid
    and never rested (8 toy radii per second for 2 s after landing). Now it acts only in the air,
    its pull grows with the speed squared, and its swing is damped near critically.
  - A Level 1 toy's walls sit just past it (a ball's middle could move only 0.45 toy radii), so no
    ball could roll, slide or skid: `hands.area` moves them out, as wheels already did.
  - `hands.view` (0.8 by default): the view drifted 0.8 of the way after a tossed toy, so a kicked
    ball barely moved on screen; the balls use 0.6 with `area: 3`, so a hard flick stays on a
    phone's screen.
  - `hands.friction`: `applyMaterial` keeps the floor at least as grippy as 0.7, so a puck (0.04)
    stopped within a quarter of a toy radius; the puck's floor is ice now.
  - `hands.soft`: a whole toy's landing squish over the SOFT list (the bouncy ball's 0.15).
  - A shelf shape (procedural, no recipe) takes the gummy bear's stretch from its shelf entry's
    `grab` (the jelly blob).
  - `hands.floor` as a function of the build (the d20 sits lower); `hands.press` (a held press
    squeezes a whole toy: the duck, the balloon dog); a joint's `also` gets the joint (the top's
    lean from its speed); `fixed: true` pieces (the cap's stand).
- Balls: 22 balls get `hands: { area: 3, view: 0.6, material, sound }` (and `soft: 0.15` on the
  bouncy ball, which squashed flat like jelly) (the basketball, beach ball and water polo ball are
  the engine lane's demo toys and stay as they are). Real numbers from
  `tools/hands-on-materials.json`: its confirmed values override the presets (masses and sizes for
  most; the pickleball's 0.62 bounce; the shuttlecock's drag coefficient 0.7); its estimates do not.
  Two presets changed for the effect: the football's grab spin is 0.08 (a grab at one end tumbled it
  end over end instead of a spiral), and the squash ball starts at 0.25, its first warm value (the
  preset's 0.3 made the first throw deader than the ball at rest).
- Landing sounds: each ball's from its own tap's cues (`LANDS` in `src/packs/balls.js`); on the
  Sound Board as "ready" (`tools/sound-review.json`, candidate `hh1`).
- `tests/hea-engine.spec.mjs` used the soccer ball as "a toy without these pieces"; it uses the neon
  knot now (Level 1 only in the plan).
- Tools: `tools/hh1-measure.mjs` (drop and throw, bounce peaks and rest times),
  `tools/hh1-probe.mjs` (a snippet in the page with a toy open in Hands-on), `tools/hh1-clip.mjs`
  (`tools/phy-clip.mjs` at device scale 3, with a drag that starts from where the tossed toy is now,
  for the volleyball's spike).

## Known issues

- Toys and Clothing: the teddy bear is picked up by its tummy (held by an arm, the arm swung away
  from the finger); the robot's key is wound by a finger circling its tummy or, from behind, its
  key.

- Running shoe: the laces' shell checks them against about 260 spheres while they move (sleeps when
  still), about 1.5 ms a frame more in the test browser; the laces sit up to about 1 cm off the
  shoe's sides.
- With the camera looking down at the floor from the side, a throw to the right also goes away from
  the camera, so on a phone a ball's roll shows partly as getting smaller.
- The walls are invisible: a ball that rolls 3 toy radii stops against one.

## For the Operator

- Merge the engine PR #421 before the Balls PR (and before Shapes, Toys and Clothing, which are
  stacked on it).
- Clips at device scale 3 take about 10 minutes each in this container (two at a time on its 4
  cores), so a shelf of 20 takes about two hours.
- The garden gnome's "never rests" finding (docs/audits/hands-l1-sweep-2026-10.md) is a scan outside
  these shelves whose cause the sweep puts in the engine's resting contact; it needs its own small
  engine task.

# Lane Hands-on H3 (prefix `hh3`): local lane

## Brief

Local lane. You are a Splashery worker session, started by the owner on his Mac from a brief the
Operator wrote. Repo: ryanjosephkamp/splashery. Your lane: Hands-on H3 (id `HandsH3`, prefix `hh3`).
Your folder is a git worktree on `claude/lane-hands-h3`. Your port: 4189. Handoff file:
docs/handoff/HandsH3.md (this file; your brief is already here). Model: Opus 5.5.

### Brief (written by the Operator on October 3, 2026)

**First, check that you can start:** docs/PACKS.md on main must have sections 5f (bodies and
fields), 5g (joints) and 5h (soft parts), which arrive when the three hands-on engines merge. If
they aren't there yet, set "State" to "BLOCKED: waiting for the hands-on engines", push, and stop.

The owner accepted every line of docs/HANDS-ON-PLAN.md on October 3, 2026, and wants every toy
hands-on. Level 1 (pick up, toss, land, ↺ Reset) is on main for all of them. Three engine lanes
built the pieces the plan's other lines need (materials, water, air, wells, wheels, shake, flee,
projectiles; hinges, sliders, dials, sockets, breaks; ropes, cloth and stretch), each with a few
demo toys. Five category lanes now build the rest. Yours are these shelves:

- Open me
- Holidays
- Medieval
- Music
- Pictures and pages
- Photoreal (the first-round toys only)
- Studio and Lab (nothing beyond Level 1 is planned; check Level 1 only)

#### What to build

1. **Every line of the plan for your shelves** that goes beyond Level 1, as the plan describes it,
   built from the engine pieces through each toy's `hands` block. Skip lines marked "Level 1 only.",
   "Already hands-on" or "Built by lane Physics.", and the 18 demo toys the engine lanes built.
2. **Real numbers** for weights, bounce and drag from `tools/hands-on-materials.json` (Codex task
   11). Most of its numbers are marked as estimates: prefer the confirmed ones, and keep the motion
   believable at the toys' scale.
3. **The L1 sweep's findings:** any real finding the L1 sweep lists for your shelves. Leave out the
   Photoreal round-2 toys (lane Photoreal r3 owns them) and the QR code toy (lane QR r3 owns it).
4. **Any pose:** every hands-on effect also works with the toy on its side or upside down (lane Any
   pose fixes the engine side); test three poses for each toy you change.
5. **One PR per shelf**, in the order above, on `claude/lane-hands-h3-<shelf>` (for example
   `claude/lane-hands-h3-open-me`), titled "Phase Hands-on H3, <shelf>: …", each with a phone-size
   clip of every toy it changes (`tools/phy-clip.mjs`), posted as cards under your lane id and
   grouped by shelf, each card saying what to try with a finger. Tests in `tests/hh3*.spec.mjs`:
   each piece measured (heights, angles, positions over time) for a sample of your toys.
6. If a line needs an engine piece that doesn't exist, don't build a private one: say so in "State",
   skip that line, and move on. A small fix to an engine piece goes in its own "Engine: …" PR.

#### You own

Your shelves' toys' `hands` blocks and their own recipe lines in `src/packs/` (nothing else in a
recipe), `tests/hh3*.spec.mjs`, `tools/hh3-*.mjs`, your toys' entries in the shared lists, and this
file. The engine files belong to the merged engines; another lane's toys are theirs.

#### How this lane runs (local lane)

- You run in Claude Code on the owner's Mac, signed in to his second Claude account. Follow
  docs/OPERATING.md, "Local lanes", exactly: your own port (4189), the local test set, messages as
  comments on your PR that start "From the Operator", the "READY:", "WORKING:" or "BLOCKED:" line at
  the top of "## State

WORKING (October 9, 2026). Four stacked shelf PRs are open, each with its cards on Effect review
page 2 (lane HandsH3). Merge order:

- Engine PR #430 (`claude/lane-hands-h3-engine`): a forgiving press (the L1 sweep's center misses),
  `reseat` on a break joint, a shake that only reads (`fire: false`), picture toys that ask for
  joints play them, and a fix (a snapped piece starts where it was, not at home).
- Open me #432: storybook, alarm clock, gift box, umbrella (new runner), desk fan, desk lamp,
  telescope, potion bottle, fountain pen. Nine cards; seven good. The book was redone (card
  hh3-book-r2, marked fix again: the specks are the same engine sort bug as the egg's). The pen's
  cap is now its full length, so it never sinks into the paper (the owner's note; card
  hh3-fountain-pen-r2).
- Holidays #435: jack-o'-lantern, decorated tree, patterned egg, paper lantern. Three good; the
  egg's "bottom doesn't spin properly" is an engine sort bug (For the Operator). The snowman can now
  follow (H2's `ride` is in main).
- Medieval #436: knight's helmet, trebuchet, dragon egg. All good.
- Pictures #437: picture frame (labs). Good.

Built locally, not pushed (they wait for #430, as the Operator asked):

- `claude/lane-hands-h3-engine-3` (worktree splashery-e2; renamed from engine-2, which is now the
  sort fix): one engine PR for latches and triggers (`latch`, `catch`, `trigger`: a tap lets a
  cocked joint go), strike pieces (`strike`; hit sounds name both pieces) and plucked strings
  (`hands.strings`); it uses H1's `fixed`. `tests/hh3-engine2.spec.mjs`, 3 tests.
- `claude/lane-hands-h3-music` (worktree splashery-mus, on Pictures plus engine-3): the guitar, the
  snare drum and the crossbow, all marked good. `tests/hh3-music.spec.mjs` and
  `tests/hh3-crossbow.spec.mjs`, 3 tests.
- `claude/lane-hands-h3-engine-4` (worktree splashery-l1e, on the engine branch): `handsLevel1` lets
  a picture or `turntable: false` toy ask for Level 1 (true, or a function that turns ✋ off while
  the toy is live). `tests/hh3-level1-engine.spec.mjs`, 2 tests.
- `claude/lane-hands-h3-level1` (worktree splashery-l1, on engine-4): Level 1 for the Picture lab,
  the Screen (not while capturing), the Room echo meter (not while the mic is on) and the Fluid lab.
  Left out: Your book and Photo album (every press turns a page), Photo to 3D, Video to 3D and Splat
  mirror (one-sided captures smear when tossed). `tests/hh3-level1.spec.mjs`, 2 tests. Card
  hh3-level1 posted.

Open: #455 (Engine: sort a turned kit part with its own turn), on main, to merge after #430; then
the patterned egg and the storybook are re-rendered (hh3-patterned-egg-r2, hh3-book-r3). Waiting:
the water bottle and soda can (the Fluids engine's pour). Next: the first photoreal toys after
agreeing with Photoreal r3.

## Notes", "## Known issues" and "## For the Operator

- Please merge engine PR #430 before the Open me PR; the Open me branch carries its commit.
- The water bottle and the soda can (labs) wait for the Fluids engine's pour.
- The patterned egg's bottom and the storybook's specks (both the owner's "fix" marks) are one
  engine bug in `src/pose.js` (the sort used the inverse of a part's turn, from e59431d8). The fix
  is #455; please merge it after #430. If the book is still not good enough, the owner's fallback is
  a "your book" PDF storybook.

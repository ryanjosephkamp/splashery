# Lane Machines A: machines that compute

Prefix `mca`. Branch `claude/lane-machines-a`. PR title "Phase Machines A: machines that compute".
How lanes work: [OPERATING.md](../OPERATING.md).

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Machines A, "Machines that compute" (prefix `mca`). Branch:
claude/lane-machines-a. PR title: "Phase Machines A: machines that compute". Handoff file:
docs/handoff/MachinesA.md.

### Brief (written by the Operator on September 29, 2026, from the owner's approvals and notes on the Toy Ideas page)

The owner approved these on the Toy Ideas page (https://claude.ai/artifact/5TukiuV3mCt3G3zk6Arx9S;
read collections `ideas` and `marks` with ArtifactData for the full text and his notes; never write
to them). On the Turing machine he wrote, word for word: "I approve this as given, but I also want
to add more Turing-related things, if possible, like the Turing-Welchman Bombe, maybe a German
Enigma toy that's photoreal (if possible; a sharp generation would be acceptable instead, if
necessary), etc."

Build four public toys on the AI and computing shelf, in this order:

1. **Turing machine** (`turing-machine`): "A long tape of tiles, each showing 0 or 1, runs under a
   read-write head with a lamp for its state. Step by step, the head reads a tile, flips it over to
   write, and the tape slides one tile left or right, following the rule card, until the machine
   halts with a bell. The first program adds one to your binary number (1011 becomes 1100 as the
   carry ripples left); others count up or run the famous two-state "busy beaver" (about 4.5 s)."
   Your own input: a binary number (up to about 12 digits) and a program in the Toy tab, saved in
   the link; the rule card shows the rule table with the current row lit.
2. **Difference engine** (`difference-engine`): "A brass-and-steel calculating engine from 1840s
   drawings: columns of numbered wheels and a crank on the side. Each turn of the crank adds every
   column into its neighbor, the wheels click round as solid pieces, carries ripple up with little
   levers, and the result column shows the next value of your polynomial. Start with n² and watch 1,
   4, 9, 16, 25 appear using nothing but addition (about 4 s per turn; a tap turns it once, a long
   press keeps cranking)." Your own input: a polynomial up to x³ (typed like the graph plotter's,
   using the safe equation reader in src/equation.js) and a starting value. Its About text tells the
   story: designed by Charles Babbage in the 1840s, built from his drawings in 1991.
3. **Enigma machine** (`enigma-machine`): the idea on the page ("A photo-real Enigma cipher machine
   in its wooden box: the keyboard, the lampboard, three rotors under the lid and the plugboard …").
   Type your own message in the Toy tab; the tap types it, each key goes down, the rotors step like
   an odometer and the coded letter lights on the lampboard; a second tap types the coded text back
   and gets your message again. Real rules: the historical rotor wirings, stepping (the double step
   too), reflector and plugboard, which are public facts. Photo-real if a CC0 or CC BY scan exists
   (check the live page), otherwise a sharp kit-built model. No insignia of any kind: a plain wooden
   box and a plain name plate.
4. **Turing-Welchman Bombe** (`bombe`): the idea on the page ("The wardrobe-sized codebreaking
   machine of Bletchley Park: rows of colored drums on its front …"). The drums spin in their sets
   like the real machine searching rotor settings, stop together on a possible setting and a lamp
   lights; then the Enigma toy's coded message reads out in plain text. Real rules in a simplified,
   honest form (a menu from a crib, the drums stepping, a stop when the logic is consistent); say in
   the About text what is simplified. The About text tells the story of Alan Turing, Gordon Welchman
   and the Bletchley Park teams, respectfully.

Sounds are on each idea; add each toy's entry in src/toy-sounds.js. Each toy gets a how-to line and
an About text in src/toy-help.js, a toy-plan entry and a thumbnail.

What good looks like: every tile, wheel, lever, key, rotor and drum is its own solid part that moves
as the real machine does (effect quality rules in CLAUDE.md: real motion, separate things move
separately, machines follow real rules); Fidelity A's method (even placement, full opacity, full
density, clean colors: brass, steel, Bakelite, wood); numbers and letters sharp and readable at
phone size. If time runs short, cut from the end of the list and say so.

Clips and cards (390×844), each labeled "built by Opus 5.5", in the lane record `MachinesA` on the
Effect review page (the Operator made it): `mca-turing` (adding one to a binary number),
`mca-difference` (three turns on n²), `mca-enigma` (a short word typed and decoded), `mca-bombe` (a
search that stops), and `mca-stills` (a sharp still of each). These are new public toys: the owner's
"good" marks decide the merge.

Tests in tests/mca.spec.mjs: each toy builds within its tier budget; the Turing machine's programs
give the right tapes; the difference engine's results match the polynomial; the Enigma encodes and
decodes correctly against a known test vector; parts move as solid pieces; screenshots at 390×844
and 1440×900.

### You own

- a new pack `src/packs/computing-history.js`, `assets/toys/<id>/` for your toys, your entries in
  the shared lists (src/toys.js, src/toy-sounds.js, src/toy-help.js, tools/toy-plan.json,
  tools/assets.json, tools/models.json, CREDITS.md), tests/mca.spec.mjs, your `mca-*` screenshots
  and docs/handoff/MachinesA.md. `src/packs/computing.js` is frozen (read it for the sorting
  machine's style); use src/equation.js without changing it.

Lanes Worlds, the toy piano, Anatomy, Pianos, Sharpness, Books, Chemistry, Real objects, Photo to
3D, Machines B and the two Integrators run at the same time; leave their files alone. The laptop is
locked.

### HOW THIS LANE RUNS

- The Operator session runs the lanes. The owner, Ryan, talks only to the Operator; he reviews clips
  and marks them. Don't ask him anything or wait for him. Put questions and blockers in your final
  message, and the Operator answers or relays them. Messages that arrive in this session "From the
  Operator" come from the coordinator on the owner's behalf.
- Model: Opus 5.5 only, at the default effort (the owner's assignment of September 29, 2026: Opus
  5.5 builds the engine, the toys, sounds and fidelity; Sonnet 5.5 builds the Worlds content, the
  Studio converters, the docs and the Integrator). Any helper you start uses the same model. Use at
  most one helper at a time.
- Merging (the owner's rules of September 29, 2026): the Operator merges Ops PRs, anything behind
  the labs switch, and additive engine PRs once the full test run passes. Changes to toys the public
  already sees wait for the owner's "good" marks. Never merge anything yourself.
- Language: every new public-facing text is in American English (color, center, gray, math, license,
  toward, -ize endings, dates like "September 29, 2026"). Leave code identifiers, file names and
  anything stored in links as they are.
- Read first: CLAUDE.md (the ground rules and "Effect quality rules" are binding),
  docs/OPERATING.md, docs/PACKS.md, docs/WORKSTREAMS.md and docs/handoff/history.md (lessons from
  earlier lanes).
- Your handoff file: create it. Start it with this brief, word for word, under "## Brief", then keep
  "## State

Model: Opus 5.5 (default effort).

- September 29, 2026: lane started; draft PR #102 opened.
- All four toys built in `src/packs/computing-history.js` (public, AI and computing shelf): the
  Turing machine, the difference engine, the Enigma machine and the Turing-Welchman Bombe (shelf
  name "Bombe", so it fits a phone card). Each has its sound (a tap sound in `src/toy-sounds.js`,
  then cues from `drive()` that follow what it does), its how-to line and About text, a plan entry
  (`keep`), a thumbnail and tests in `tests/mca.spec.mjs`.
- Cards on the Effect review page (lane MachinesA): `mca-turing`, `mca-difference`, `mca-enigma`,
  `mca-bombe`, `mca-stills`. Waiting for the owner's marks; an hourly check-in reads them.
- Owner's marks (September 29, 2026, 19:47 UTC check-in): all five "fix", with the same note:
  "Basically everything (mechanics, etc.) looks perfect, but this could use just a bit more detail
  and sharpness" ("needs more detail" for the difference engine). Done in the same PR: density 2 on
  all four; even shapes on every part (the last `k.cylinder`, `k.disc`, `k.tube` and `k.cone` went);
  screws, trim and feet (Turing); a gear train on the crank, engraved shields with window bezels,
  carriage racks, finials and label plates (difference engine); a lampboard plate, latches, hinges
  and screws (Enigma); clean drum faces, drum bolts, panel frames, rivets, handles and vents
  (Bombe). The r2 clips are rendered at 520 to 560 px, nearer what a phone shows at its pixel ratio.
  Cards `mca-turing-r2`, `mca-difference-r2`, `mca-enigma-r2`, `mca-bombe-r2`, `mca-stills-r2`
  posted; the old cards marked replaced.
- Full suite (first round): 423 passed, 3 failed on the first run; the two Books tests timed out
  while two orphaned test workers of mine held 12 GB (stopped; both pass alone), and the phone shelf
  test caught the Bombe's long name (fixed). After the fixes and the merge of main: the lane's,
  taps, help and AI tests pass (102), prettier and the spelling check are clean.

## Notes

- **Turing machine.** 17 tile slots (15 show; the end ones sit inside the reel housings, where a
  tile leaving one end wraps round to the other). Each slot is two tokens, the tile showing 0 and
  the tile showing 1: a flip turns the shown tile edge-on, then brings the other round from edge-on,
  so no tile ever turns past a quarter turn. Tiles are re-sorted every half tile of tape travel
  (`out.resort`), or a wrapped tile draws behind the back panel. Programs: Add one (the result stays
  on the tape, so each tap adds one more and it counts up), Busy beaver 2 states (6 steps, four 1s)
  and 3 states (13 steps, six 1s). The rule card is built per program, its rows lit by parts; a step
  counter (seven-segment tokens). Your number: binary up to 12 digits, or a whole number up to 4095.
- **Difference engine.** Columns X, P(X), Δ1, Δ2, Δ3 of figure wheels (tokens turning about upright
  shafts, units at the bottom), read through windows in a brass shield. A turn adds in two phases
  (Δ1 into the value and Δ3 into Δ2, then Δ2 into Δ1), so, as in Babbage's engine, the Δ2 column is
  set up half a step ahead (it holds the second difference less the third). Carries: a wheel passing
  9 to 0 sets its lever; the carries then ripple up one wheel at a time. Five digits per column;
  negatives show as ten's complements. Wheels turned past a quarter turn are re-sorted on the first
  frame and a few times per turn.
- **Long press.** The engine has no long press, so the difference engine queues one turn per tap
  instead: tap three times and it cranks three turns in a row (it keeps its own clock from
  `info.time`; the pulse lasts 12 s so frames keep coming).
- **Enigma machine.** Kit-built: no CC0 or CC BY scan was found (the one museum scan on Sketchfab is
  BY-NC-SA; the CC BY models found are static meshes whose keys and rotors couldn't move as solid
  parts). Rotors I, II, III, reflector B, rings AAA, start AAA, plugboard AR GK OX. Test vectors
  pass (AAAAA gives BDZGO; ADU steps to ADV, AEW, BFX). Rotors are parts, re-sorted in their pose
  after each step (`out.resortPose`). One glow token moves under the lamp that lights. The pad on
  the lid shows the message, the coded letters (fade channel 0) and the decoded ones (channel 1).
- **Bombe.** One bank of 12 drum sets (36 drum tokens turning face-on, so draw order holds). The
  message is coded at a setting taken from the message; its first 12 letters are the crib. The
  search really tries all 17,576 settings (with the plugboard taken as known) and stops at the first
  where the crib fits; it may stop on an equivalent setting (WEATHERREPORT stops at BEA for the
  secret CFA, the same machine state because of the double step). The top drums are shown turning 12
  times, far slower than the search; the middle and bottom drums step as the search does.

## Known issues

- Text can't get finer than it is: smaller splats for the letters fall under the engine's two-pixel
  cull and vanish (tried and reverted). A sharper look for text needs the labs sharp kernel.

- The rotor ring letters on the Enigma and the drum faces on the Bombe are too small to read at
  phone size (the drums show 26 ticks and a red mark at A instead of letters); the setting reads on
  the Bombe's readout.

## For the Operator

- The lane record's note on the Effect review page says "photo-real Enigma machine"; the Enigma is
  kit-built (see Notes). Please change the note (lanes only set their own groups).
- The Bombe's shelf name is "Bombe": "Turing-Welchman Bombe" didn't fit a phone card in two lines
  (`tests/smoke.spec.mjs`, "Long names wrap"). Its About text gives the full name.

- No engine change needed. A long press would need one (the difference engine queues taps instead).

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
  "## State", "## Notes", "## Known issues" and "## For the Operator" current. Note your model at
  the top of "## State" (the blog post compares the two models).
- Shared lists: edit only your own entries in src/toys.js, src/toy-sounds.js, src/toy-help.js (a
  how-to line and an About text per toy, following docs/handoff/Help.md), tools/toy-plan.json,
  CREDITS.md and tools/assets.json. Regenerate docs/TOY-PLAN.md with `node tools/toy-plan.mjs`;
  never merge it by hand.
- Never edit tests/taps.spec.mjs. Your own tests go in tests/<prefix>.spec.mjs. If a finished lane's
  test breaks because of a count or a list your work changes, don't edit it: say which test and why
  in your message, and the Operator fixes it.
- Assets: CC0, CC BY or public domain only, checked on the live source page and credited
  (CREDITS.md, tools/assets.json and the toy's in-app credit). Never BY-SA or NC. No logos, brand
  names or insignia.
- Review: post clips and cards to the Effect review page,
  https://claude.ai/artifact/NCsg9V5SzFY3Mnwuwgq7pi, as OPERATING.md's "Steps for a lane" says.
  Judge every effect as motion at phone size against the effect quality rules before you post it.
  The Operator has made your lane's record. Don't republish the page, and never write to "verdicts".
- Push your work in progress to your branch about every hour, so it isn't only in your container,
  and open your draft PR early. Many lanes run at once now, so main moves often: merge it into your
  branch before each push (never rebase a pushed branch) and keep both sides of any conflict.
- Before every push, follow "Before every push" in CLAUDE.md: the full Playwright suite
  (SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium npx playwright test), prettier,
  `node tools/us-english.mjs --diff`, `node tools/check-packs.mjs <pack>` for new or changed toys, a
  contact sheet and thumbnails, and your own screenshots at 390×844 and 1440×900. Then put back the
  standard screenshots (`node tools/upkeep.mjs --restore-shots`) and any other lane's screenshots
  your branch didn't change.
- PR: one draft PR against main with the five sections (Summary, Verification, Deviations, Known
  issues, What was cut), and the model that built it in the Summary. When main moves, merge it into
  your branch.
- After you post your cards, check the owner's marks (the "verdicts" collection, ids starting with
  your prefix) about once an hour with a scheduled check-in (send_later). Fix every "fix" in the
  same PR, post the new clip as a "-r2" card, and set replacedBy on the old one. Stop the check-ins
  once your PR is merged or closed.
- Finish every working turn with a short final message that starts with "READY:" (PR link, card ids,
  test results, anything for the Operator), "WORKING:" (what's left), or "BLOCKED:" (exactly what
  you need).

## State

Model: Opus 5.5 (default effort).

- September 29, 2026: lane started. Handoff file written, draft PR opened. Building the Turing
  machine first.

## Notes

## Known issues

## For the Operator

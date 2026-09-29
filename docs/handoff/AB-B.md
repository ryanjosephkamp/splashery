# Lane A/B (maker B): the toy piano

## Brief

(Written by the Operator on September 29, 2026; copied word for word.)

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: the blind A/B toy, **maker B** (prefix `abb`). Branch:
claude/lane-ab-b. PR title: "Phase A/B (maker B): the toy piano". Handoff file:
docs/handoff/AB-B.md.

## Brief (written by the Operator on September 29, 2026)

The owner accepted "one blind A/B toy, the same small toy built by each model, marked by the owner
without knowing which is which", for the blog post. Two sessions build the same toy from this same
brief, one on each model. You are maker B. The other maker works at the same time on its own branch;
don't look at its branch or cards, and don't coordinate. Only the better one of the two merges,
chosen by the owner's marks.

**Keep it blind.** The owner sees the cards, not the PRs. On your cards, your lane record and
anything else on the Effect review page, call yourself only "maker B": never name your model or say
anything that hints at it. Your PR body and handoff don't name the model either until the Operator
reveals it after the marks (commit trailers are fine).

**The toy: Toy piano** (`toy-piano`, Music shelf, public, kit-built). It's the owner's own idea from
the Toy Ideas page, word for word:

- Tap: "Tap a key: a tiny hammer strikes a metal rod inside the open back, and the rod shivers as it
  rings. Tap elsewhere: Twinkle, Twinkle, Little Star, the rods shimmering in turn."
- Sound: "The plinky, bell-like tone of a real toy piano (struck metal rods), made in the page."
- Why: "The smallest piano, with a sound nothing else on the shelf has."

What good looks like:

- A small upright toy piano, about 18 to 25 keys, painted wood (a bright lacquer), with the back
  open so you see the row of metal rods and the little hammers.
- Every key, hammer and rod is its own solid part.
- Tapping a key: the key dips and its hammer swings up and strikes its rod; the rod shivers (a
  small, fast, fading vibration) while the note rings.
- Tapping elsewhere: it plays the opening of "Twinkle, Twinkle, Little Star" (public domain; write
  the notes out yourself), each key, hammer and rod moving in time with the notes.
- The sound is struck metal rods: a bright, inharmonic, bell-like voice with a quick decay, made in
  the page. Add your own entry in src/toy-sounds.js, and a new voice in src/voices.js only if the
  existing voices can't make it. Each key plays its own pitch.
- Follow the effect quality rules in CLAUDE.md (instruments are played, parts move as solid pieces,
  materials look real, no speckle or see-through solids) and the sharpness the owner now expects:
  Fidelity A's method (even placement, full opacity, full density, clean colors) is the bar. Read
  docs/handoff/history.md for how the xylophone does per-key taps (`pick`).
- Add the toy's how-to line and About text in src/toy-help.js, its plan entry in
  tools/toy-plan.json, and a thumbnail.

Clips and cards (390×844), in the lane record "AB-B" on the Effect review page (the Operator made
it):

- `abb-toy-piano-keys`: three single keys tapped, close enough to see each hammer strike its rod;
- `abb-toy-piano-song`: the song;
- `abb-toy-piano-still`: a sharp full-resolution still.

## You own

- the toy's recipe in its pack (src/packs/ with the Music toys, only your toy),
  assets/toys/toy-piano/, your toy's entries in the shared lists, tests/abb.spec.mjs, your `abb-*`
  screenshots and docs/handoff/AB-B.md.
- Leave everything else alone. Lanes Books, Worlds, Fidelity A, Fidelity B, Studio Models, the
  Integrator and the other maker run at the same time. The laptop is locked.

HOW THIS LANE RUNS

- The Operator session runs the lanes. The owner, Ryan, talks only to the Operator; he reviews clips
  and marks them. Don't ask him anything or wait for him. Put questions and blockers in your final
  message, and the Operator answers or relays them. Messages that arrive in this session "From the
  Operator" come from the coordinator on the owner's behalf.
- Model: [left out of this file until the Operator reveals it, as the brief asks for this blind
  lane] only, at the default effort (the owner's assignment of September 29, 2026). Any helper you
  start uses the same model. Use at most one helper at a time.
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

September 29, 2026: built, clips posted, waiting for the owner's marks. The recipe is in
`src/packs/music.js` ("Toy piano"), with its entries in `src/toys.js`, `src/toy-sounds.js`,
`src/toy-help.js` and `tools/toy-plan.json`, its thumbnail, its own tests and screenshots in
`tests/abb.spec.mjs` (`abb-toy-piano-390x844.png`, `…-1440x900.png`). PR #91 (draft). Cards on the
Effect review page, lane record AB-B: `abb-toy-piano-keys`, `abb-toy-piano-song`,
`abb-toy-piano-still`. An hourly check-in reads the marks.

## Notes", "## Known issues" and "## For the Operator" current. For this blind lane,

leave your model out of the handoff until the Operator reveals it.

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
  issues, What was cut). For this blind lane, leave the model out of the PR body until the Operator
  reveals it. When main moves, merge it into your branch.
- After you post your cards, check the owner's marks (the "verdicts" collection, ids starting with
  your prefix) about once an hour with a scheduled check-in (send_later). Fix every "fix" in the
  same PR, post the new clip as a "-r2" card, and set replacedBy on the old one. Stop the check-ins
  once your PR is merged or closed.
- Finish every working turn with a short final message that starts with "READY:" (PR link, card ids,
  test results, anything for the Operator), "WORKING:" (what's left), or "BLOCKED:" (exactly what
  you need).

## State

September 29, 2026: building. The recipe is in `src/packs/music.js` ("Toy piano"), with its entries
in `src/toys.js`, `src/toy-sounds.js`, `src/toy-help.js` and `tools/toy-plan.json`, and its own
tests in `tests/abb.spec.mjs`. Clips, thumbnail and screenshots to come.

## Notes

- 18 keys, C5 to F6 chromatic (11 white, 7 raised black). Every key, hammer and rod is its own solid
  piece: the keys are tokens 0 to 17, the hammers 18 to 35, rods 0 to 11 are tokens 36 to 47 (a toy
  has 48), and rods 12 to 17 are parts (a toy has 15). Nothing bends.
- The rods stand in a row on a steel block at the back, graded in length the way real clamped rods
  are (a rod's pitch goes as one over its length squared, so each semitone is 2^(1/24) shorter). The
  hammers lean forward on a rail in front of them.
- A key tap is `{ key: "strike", pick }` from `action.at` (like the xylophone), but the note is a
  cue from `drive()` (`quiet: ["strike"]`), pushed on the frame the hammer lands (0.09 s), because
  the tune in `src/toy-sounds.js` is the song, so `pick` can't name the key's own pitch there. Each
  key's press is timed from its own tap (in `drive`'s memory), so quick taps on several keys ring
  together.
- The song ("Twinkle, Twinkle", the opening line: C C G G A A G, F F E E D D C) is the toy's sound
  spec, timed to match the drive: a key starts down 0.2 s + 0.28 s × n after the tap and its hammer
  lands 0.09 s later. `tests/abb.spec.mjs` checks that the spec's notes and the strikes agree.
- The voice is the existing `tine` (partials at 1, 6.27 and 17.55 times the note: the modes of a bar
  clamped at one end, which is what a toy piano's rod is), layered with a second tine 0.4 % sharp
  (the rod rings in two planes, so it shimmers) and a quiet `clack` six and a half times the note
  (the hammer's tick). No new voice was needed.
- Fidelity A's method: every face is an even rectangle (`rect()`), boxes are six of them (`box6()`),
  rods and hammer heads are even parametric surfaces, all at full opacity. A long, thin rectangle
  folds its even square into strips laid end to end, so its splats stay evenly spaced both ways.

## Known issues

- The clips were rendered with a local copy of `tools/effect-clip.mjs` that takes a camera and a
  390×844 frame (the tool itself renders square clips at the toy's shelf camera); it was not
  committed.
- The red lacquer shows a faint mottle at 2× on large panels (the lid); edges are clean.

## For the Operator

- A PACKS.md lesson: the kit's default color jitter (0.04) reads as grain on smooth lacquer and
  ivory; 0.01 is clean. Smaller splats along a flat face's edge (a color function returning
  `{ c, size }`) keep box edges crisp instead of a fuzzy rim (`crisp()` in `src/packs/music.js`).
- A PACKS.md lesson: a long, thin even rectangle spaces its splats unevenly (a hatch); folding the
  even square into strips laid end to end fixes it (`rect()` in `src/packs/music.js`).
- A tool idea: `tools/effect-clip.mjs` could take `--cam=yaw,pitch,distance` and `--h=` for phone
  portrait clips, as the brief's 390×844 clips needed.

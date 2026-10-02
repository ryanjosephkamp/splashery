# Lane Sound C: The sound notes of October 2

Prefix `sndc`. Branches `claude/lane-sound-c-engine` (PR "Engine: sounds pause with their effect, and
a toy's first tap sounds on time") and `claude/lane-sound-c` (PR "Phase Sound C: the sound notes of
October 2"). How lanes work: [OPERATING.md](../OPERATING.md).

## Brief

Written by the Operator on October 2, 2026, from the owner's review of that day.

On October 2 the owner went through every toy on the preview build and named the sounds he wants
changed. His review is in docs/reviews/2026-10-02-mega-review/review.md (word for word). The sound
parts, word for word by toy, are in docs/reviews/sounds-2026-10-02.md. The clean note and a plan per
toy are in tools/sound-review.json, round "2026-10-02": the 44 toys with status "change". Every toy
he called perfect or fine keeps its sound. Those files are on the branch
`claude/operator-mega-review` (Ops PR) until it merges; merge that branch or main into yours when it
lands.

What he wants, in general (PACKS.md section 7e still holds): subtle, realistic sounds, often a real
recording; no wind unless it belongs; no motor "vroom", no buzz or horn, no robotic tones, no tacky
xylophone runs. Sounds in sync with what you see.

### Part 1: the engine (branch claude/lane-sound-c-engine, do this first)

The Operator traced both problems in the code (paths as of main 2ba6455):

1. **A sound must pause and resume with its effect.** He tapped the DNA to pause it: the sound
   played on, and after he tapped again to resume, the sound didn't come back. Today a tap-to-pause
   (motion.js:116-141, 185-196) calls `sound.pauseHeld/resumeHeld("toy")` (app.js:762-766,
   sound.js:121-135). That stops only the notes the look-ahead scheduler (`playHeld`,
   sound.js:90-134) hasn't handed to WebAudio yet. Notes already sounding ring on, so a long single
   voice keeps playing, and recipe cue sounds (app.js:146-148) use plain `play`, so they aren't held
   at all. Make pause real: everything the toy is sounding (held notes, ringing voices and its cue
   sounds) pauses at the paused moment and resumes from there, in sync with the motion. One clean
   way is a per-toy output bus that you can suspend; another is suspending the AudioContext while a
   toy's effect is paused (only if nothing else needs to sound then). Choose, and explain why in the
   PR. Test it: pause mid-effect, check the toy's output goes silent within a frame or two, resume,
   and check it continues.
2. **The first tap's sound is late.** He noticed on many toys that the first tap's sound starts
   noticeably after the motion; later taps are in sync. Cause: sample voices are fetched and decoded
   on the first play (voices.js:1289-1325), and the first play waits up to `SAMPLE_WAIT` = 0.6 s
   (sound.js:12, 73-81). Fix it: start fetching and decoding a toy's samples when the toy opens (and
   its options' samples when they're chosen), and make sure the AudioContext is resumed by the first
   user gesture before the effect starts. Never delay the motion to wait for the sound. Test it: on
   a cold load, the first tap's first sample starts within about 30 ms of the motion.
3. While you're there: `"splat-field"` appears twice in src/toy-sounds.js (:2506 and :2509); the
   second wins. Keep one.

### Part 2: the toys (branch claude/lane-sound-c)

Work through every "change" entry of round 2026-10-02 in tools/sound-review.json (the 44 toys). Its
"note" says what he wants and its "plan" the Operator's idea; better ideas are welcome if they match
his words. Some need care:

- **mitochondrion**: no motor or buzz. He suggested a furnace ("the powerhouse of the cell"). Put
  two or three candidates on the Sound Board entry (OPERATING.md, "The sound review", step 3), put
  the best one in the site, and say which in your message.
- **lungs**: acceptable now; he wants to compare. Add two other real inhale and exhale recordings as
  board candidates, and leave the site's sound as it is.
- **atom**: use the periodic table's atom-appear sound, which he likes.
- **meteor**: end with the star's burst sound when it explodes.
- **rose**: add the daisies' soft petal-landing tap when its petal lands; **daisy**: time each
  petal's tap to its landing.
- **periodic-table**: the whoosh much quieter, plus a faint, soft tick in sync with each proton and
  neutron packing into the nucleus. The nucleons fade in one by one from the middle out
  (src/packs/chemistry.js:685; the nucleus builds at u 0.1 to 0.5, :452-455). Ticks, not bubbles or
  plastic blocks.
- **gaussian-splatting**: four views. Training: no opening chord; a soft, continuous falling tone as
  the loss curve draws. One splat: something subtle. Many splats: the twinkle quieter. Sorting: a
  pebble-like click for each splat placed, in sync, each slightly different (use the toy's own
  timing; a cue per placed splat or per batch, whatever stays in sync at phone frame rates).
- **spinning-top**: the spin sound follows the top's speed (quieter and lower as it slows), also
  when the person spins it by hand.
- **sports-car**: the engine sound ends when the exhaust fades.
- **ice-cream**: he said it can stay; leave it (status "keep").
- **your-book**: a page sound per book type (magazine glossier, paperback, hardcover).
- **splat-field**: no robotic pulse; a sound that suits each field.

Assets: every new recording must be CC0, CC BY or public domain, checked on its live source page
(Freesound CC0 is the usual source). Never BY-SA, NC, Sampling+, or "royalty-free" custom licenses
(Sonniss, BBC RemArc and the like are out). Record each in CREDITS.md, tools/assets.json and the
toy's in-app credit, as Sound A and Sound B did. Trim, fade and level-match with
tools/sound-check.mjs; run tools/sound-lint.mjs on every toy you change.

Since September 30 sounds go live: new sounds go straight into src/toy-sounds.js (and voices into
src/voices.js), and each toy's status becomes "site" in tools/sound-review.json (your toys' entries
are yours to edit). The Operator rebuilds the Sound Board after your PR merges, and the owner
listens there. List every changed toy and what it sounds like now in your PR, so he knows what he's
hearing.

No clips are needed for sound-only changes. If you change an effect's timing to sync a sound, post a
short clip as a card in your lane record "SoundC" on Effect review page 2.

### You own

- Part 1: src/sound.js, src/voices.js, the sound hooks in src/app.js and src/motion.js that pause
  and resume sound (keep changes small and additive; tell the Operator exactly which lines you
  touched).
- Part 2: the sound entries of the 44 toys in src/toy-sounds.js, new voices, new files under
  assets/sounds/, their credits, and those toys' entries in tools/sound-review.json and
  tools/sound-voices-next.js.
- A recipe's sound cues (the `cue`/`tine`/`blip` calls inside a pack) only where a sound must be
  timed to the motion; don't change the motion itself. If you must, say so.
- tests/sndc.spec.mjs, tests/sndc-engine.spec.mjs, your `sndc-*` screenshots and
  docs/handoff/SoundC.md.

Other lanes running now: Physics (the hands-on engine), Fix7 (toy bugs), Fluids r4, Video 3D, Live
input, Science and the Integrators. Leave their files alone. Fluids owns the Fluid lab's sounds
except the honey level, which is yours (one number). The laptop is locked.

### How this lane runs

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
  already sees wait for the owner's "good" marks (since September 30, sound-only changes go live
  without waiting). Never merge anything yourself.
- Language: every new public-facing text is in American English (color, center, gray, math,
  license, toward, -ize endings, dates like "September 29, 2026"). Leave code identifiers, file
  names and anything stored in links as they are.
- Read first: CLAUDE.md (the ground rules and "Effect quality rules" are binding),
  docs/OPERATING.md, docs/PACKS.md, docs/WORKSTREAMS.md and docs/handoff/history.md (lessons from
  earlier lanes), and docs/handoff/SoundA.md and SoundB.md (how the last sound lanes worked).
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
  https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK (Effect review page 2), as OPERATING.md's "Steps
  for a lane" says. Judge every effect as motion at phone size against the effect quality rules
  before you post it. The Operator has made your lane's record. Don't republish the page, and never
  write to "verdicts".
- Push your work in progress to your branch about every hour, so it isn't only in your container,
  and open your draft PR early. Many lanes run at once now, so main moves often: merge it into your
  branch before each push (never rebase a pushed branch) and keep both sides of any conflict.
- Before every push, follow "Before every push" in CLAUDE.md: the full Playwright suite
  (SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium npx playwright test), prettier,
  `node tools/us-english.mjs --diff`, `node tools/check-packs.mjs <pack>` for new or changed toys, a
  contact sheet and thumbnails, and your own screenshots at 390×844 and 1440×900. Then put back the
  standard screenshots (`node tools/upkeep.mjs --restore-shots`) and any other lane's screenshots
  your branch didn't change.
- PR: one draft PR per branch against main with the five sections (Summary, Verification,
  Deviations, Known issues, What was cut), and the model that built it in the Summary. When main
  moves, merge it into your branch.
- If you post cards, check the owner's marks (the "verdicts" collection, ids starting with your
  prefix) about once an hour with a scheduled check-in (send_later). Fix every "fix" in the same PR,
  post the new clip as a "-r2" card, and set replacedBy on the old one. Stop the check-ins once your
  PR is merged or closed.
- Finish every working turn with a short final message that starts with "READY:" (PR link, card
  ids, test results, anything for the Operator), "WORKING:" (what's left), or "BLOCKED:" (exactly
  what you need).

## State

Model: Opus 5.5 (default effort), all of it, and its one helper (sourcing recordings).

- October 2, 2026: started. The engine part is done on `claude/lane-sound-c-engine`; the toys are in
  progress on `claude/lane-sound-c`.

## Notes

- **Pause by suspending the AudioContext.** A per-toy bus can mute a toy but can't pause it: sounds
  already handed to WebAudio keep their clock and would play on (or be lost) under a muted bus.
  Suspending the context stops its clock, so every scheduled and ringing sound (held tunes, cue
  sounds, a recipe's own audio through `sound.master`, such as the song landscape) stops at the
  paused moment and carries on from it. Nothing else needs to sound while a toy's effect is paused;
  a UI sound played meanwhile waits for the resume.
- **Cues share one key**, so the site plays at most one cue per 60 ms (`gap`). Many cues in a row
  (one per frame) are dropped. Timed ticks (the nucleons, the sorting splats) come as one cue per
  batch, every 0.2 s or so, each tick with its own `at`.
- **Lead scheduling.** A cue for a known moment is handed over a little early and scheduled for the
  moment itself (`at`), so it lands in sync at any frame rate (the daisy's and rose's petals).

## Known issues

## For the Operator

- `tests/snda.spec.mjs:89` ("no sample loads on page load or when a toy opens, only on its tap")
  asserts the old rule that this lane's brief replaces: with the speaker on, a toy's samples now load
  when it opens. It fails on the engine branch. Suggested fix: expect nothing on page load, and the
  toy's own samples (and no others) after opening it.

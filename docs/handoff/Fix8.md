# Lane Fix8: the real alarm clock tells the time (prefix `fx8`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Fix8 (id `Fix8`, prefix `fx8`). Branch: `claude/lane-fix8`. PR
title: "Phase Fix8: the real alarm clock tells the time". Handoff file: docs/handoff/Fix8.md. Model:
Opus 5.5. A short lane: one toy.

### Brief (written by the Operator on October 4, 2026, from the owner's push notes that evening)

The owner, twice (docs/reviews/2026-10-03-labs-review/review.md, lines 32-34, and
docs/reviews/2026-10-04-push-alignment/notes.md): "the photo real alarm clock is not synced with the
time. Can you fix that?"

The "Real alarm clock" (`alarm-clock`, the Photoreal shelf, a CC0 Poly Haven model turned into
splats; public, not labs) doesn't read the clock. Its rig (`src/rigs.js` 1375-1455) hides the
scanned second hand and turns a kit-built one from player time, and the scan's hour and minute hands
are static. The kit "Alarm clock" (`clock`, `src/packs/objects.js` 1649, with `clockTime` at
576-597) and Big Ben already show the real time from `new Date()`, with a time zone option.

1. Show the real local time: hide the scanned hour and minute hands as the rig already hides the
   second hand (cut cleanly, with hard edges; the dial whole under them) and turn kit-built hour,
   minute and second hands that match the scan's hands in shape and color, set from `new Date()`
   every frame (the second hand stepping once a second as a quartz clock's does, or sweeping if the
   scan's movement is a sweep; say which and why). Add the kit clock's time zone option if it fits.
2. Keep its tap (the alarm ringing) and its sound, and check it upright, on its side and upside
   down.
3. Lane Photoreal r3's brief lists this fix (docs/handoff/PhotorealR3.md, lines 108-109); say in
   your PR that it's done here, and the Operator updates that brief.

#### Deliverables

- `tests/fx8.spec.mjs`: with the page clock set to a known time (Playwright's clock), the hands'
  angles match it; old links still load.
- A clip at phone size showing the hands at the current time and the alarm ringing; screenshots.
- Its About text says it shows the real time. This changes a public toy, so it merges after the
  owner marks the clip good.

#### You own

The `alarm-clock` rig in `src/rigs.js` and its kit add-on, `tests/fx8.spec.mjs`, the toy's lines in
the shared lists, and this file.

#### How this lane runs

- The Operator session runs the lanes. The owner, Ryan, talks only to the Operator. Don't ask him
  anything or wait for him. Put questions and blockers in your final message ("READY:", "WORKING:"
  or "BLOCKED:"), and the Operator answers or relays them. Messages that arrive "From the Operator"
  come from the coordinator on the owner's behalf.
- Model: Opus 5.5 only, at the default effort. Any helper you start uses the same model. At most one
  helper at a time.
- This is the October push (October 5 to 7, 2026): about ten lanes build at once. Edit only the
  files you own and your own toys' lines in the shared lists (`src/toys.js`, `src/toy-sounds.js`,
  `src/toy-help.js`, `tools/toy-plan.json`, `tools/assets.json`, `CREDITS.md`). Merge main into your
  branch whenever it moves (never rebase a pushed branch). Regenerate docs/TOY-PLAN.md with
  `node tools/toy-plan.mjs`; never merge it by hand.
- Engine changes: small, additive and tested, on `<your branch>-engine` with a draft PR titled
  "Engine: …", merged first. Toys that don't use them behave exactly as before.
- Merging: This changes a public toy, so the Operator merges it after a full test run and the
  owner's "good" mark on its clip. Never merge anything yourself.
- Everything new is behind the labs switch (`labs: true`) unless this brief says otherwise. Old
  `#s=` links and saved scenes (schema v2 and v3) keep loading.
- Licenses (CLAUDE.md, "Ground rules"): read each asset's or dataset's license on its live source
  page; record it in CREDITS.md, `tools/assets.json` (or `tools/models.json`) and the toy's in-app
  credit; `"nc": true` on NC assets; never ND, unlicensed, personal-use or paid. A new open-source
  library is fine when it's needed (the owner's rule of October 4, 2026): vendor it in `vendor/`,
  load it only when its toy opens, list it in LICENSES.md, and name it in your PR; a copyleft
  license (GPL, AGPL), a library that calls a server, or one over 2 MB goes to the Operator first.
- Effects follow CLAUDE.md, "Effect quality rules": real motion of solid pieces, judged as clips at
  phone size.
- Tests: `tests/fx8*.spec.mjs`; never edit `tests/taps.spec.mjs`. Before each push run your own
  specs and the specs of the files you touch (say which in the PR); the Integrators run the full
  suite before a merge. Prettier, `node tools/us-english.mjs --diff`, and for toys
  `node tools/check-packs.mjs <pack>`, a contact sheet and thumbnails (CLAUDE.md, "Before every
  push"). Screenshots `fx8-<name>-390x844.png` and `…-1440x900.png`, then
  `node tools/upkeep.mjs --restore-shots`.
- Clips: post every new or changed effect on Effect review page 2
  (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as docs/OPERATING.md, "Steps for a lane", says
  (lane record `Fix8`), after watching each one. After posting, check the owner's marks about once
  an hour with a scheduled check-in (send_later); stop once your PR is merged or closed.
- Language: American English for every new text (color, center, gray, license, toward, -ize endings,
  dates like "October 5, 2026").
- Your handoff file: start it with this brief, word for word, under "## Brief", then keep "##
  State", "## Notes", "## Known issues" and "## For the Operator" current.
- PR: one draft PR against main (five sections: Summary, Verification, Deviations, Known issues,
  What was cut), opened early and pushed after each finished item. Finish every working turn with a
  final message that starts "READY:", "WORKING:" or "BLOCKED:".

## State

WORKING: not started yet (October 4, 2026).

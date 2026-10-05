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

WORKING (October 5, 2026): the hands are done and pushed (draft PR #273). Still to do: the clip on
Effect review page 2, the contact sheet, thumbnails and the full lane checks.

## Notes

- **Cutting out the scanned hands.** These numbers come from the splats (`splat-transform` to CSV).
  The dial's face is at z = 0.193 (its highest splat is at 0.19368). Inside the bezel, the only
  splats between z 0.1937 and 0.215 are the hands: the second hand at 0.194 to 0.195, the minute
  hand at 0.1956 to 0.2025, the hour hand at 0.2028 to 0.2094, and a silver pin up to 0.215. The
  bezel starts at radius 0.641, above z 0.215. The rig's hidden part `second` now has three regions:
  - Fix5's region, keyed to red, for the second hand.
  - A flat ellipsoid (center z 0.2046, radii 1.12, 1.12 and 0.0109, soft 0.001), keyed to near-black
    #212121 with tolerance 0.5, for the hour and minute hands.
  - A small one (radius 0.12) with no color key, for the pin.

  A simulation of the shader's weights over all 200,000 splats found every hand splat at full
  weight. No dial or bezel splat was caught: the one other splat in range, on a bell post, gets a
  weight of 0. The dial is whole under the hands.

- **Kit hands** (`CLOCK` in src/rigs.js), measured from the scan as half-widths along each hand:
  - The hour hand is 0.48 long with a spade at 0.25 to 0.38 (up to 0.043 wide on each side).
  - The minute hand is 0.62 long with a lozenge at 0.34 to 0.46 (up to 0.026 on each side).
  - A round hub (radius 0.05) turns with the hour hand.
  - Fix5's red needle is the second hand, with a red boss and a silver pin.

  The pivot is (0, -0.186, 0.21). The hands are built pointing at twelve and stacked hour, minute,
  second at z +0.014, +0.022 and +0.03 off the pivot.

- **Movement:** `clockHands(date)` (exported). The second hand steps once a second and snaps onto
  each mark with a little overshoot. The minute and hour hands move on with each step. A wind-up
  clock's balance really beats 4 to 5 times a second; once a second reads best at phone size and
  matches the kit Alarm clock.
- **Time zone:** not added. Scan rigs can't take Toy tab options without an engine change (only kit
  recipes and scan looks have options, and a rig's `drive()` gets no `info.data`).
- tests/fx5.spec.mjs checked the old hand (part `hand`, turned from player time), so its one test is
  updated to the new parts.

## Known issues

- None known.

## For the Operator

- This also does the alarm-clock item in Lane Photoreal r3's brief (docs/handoff/PhotorealR3.md,
  lines 108-109).
- A time zone option for the real alarm clock would need a small engine PR: options for scan rigs.

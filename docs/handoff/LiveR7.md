# Lane Live r7: a clean splat mirror, and a landscape that grows with the song (prefix `lv7`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Live r7 (id `LiveR7`, prefix `lv7`). Branch:
`claude/lane-live-r7` (and `claude/lane-live-r7-engine` if needed). PR title: "Phase Live r7: a
clean splat mirror, and a landscape that grows with the song". Handoff file: docs/handoff/LiveR7.md.
Model: Opus 5.5.

### Brief (written by the Operator on October 4, 2026, from the owner's push notes that evening)

The owner's notes are in docs/reviews/2026-10-04-push-alignment/notes.md ("All right, so I'm going
to go through the items in the studio"). Read docs/handoff/LiveInput.md first (rounds r1 to r4; r5
and r6 are described in the code comments and HANDOFF.md, and r6 merged as #250).

1. **The Splat mirror, polished** (`splat-mirror`, `src/packs/live.js`). His words: "it still seems
   a little bit too grainy, especially with the hologram view. It's like stuff is kind of put on top
   of the face. We need to polish this out, and this is something that we can really focus on during
   the push because it's another thing that kind of makes our product unique."
   - Find what makes it grainy (splat size and count per pixel, the depth's noise from frame to
     frame, edge splats that straddle the face and the background) and fix it: a face that reads
     cleanly at phone size, steady from frame to frame, with clean edges.
   - The hologram view must not cover the face: its lines, glow or noise go behind or around the
     person, or become subtle enough that the face stays clear.
   - Show before and after side by side as clips at phone size (use a recorded test video for the
     clips, never a real person's face from the web; a CC0 or CC BY talking-head video, or a
     generated mannequin, is fine).
2. **The Song landscape grows as the song plays** (`song-landscape`, `src/packs/studio.js`). Today a
   song of 30 seconds or less (the built-in 20-second sample included) is built whole when the toy
   opens (`SHORT`, studio.js:476), so the landscape is already there before anything plays. He wants
   it drawn as the song plays: the toy opens with an empty plain, and the land rises in step with
   the music, in the Live view, for every song and look. The Whole song view stays as an option.
3. **The Chladni plate's bow** (`chladni-plate`, studio.js 239-272). He hoped "the bow appearing
   every time a tone changes" is fixed. Main has the fix (Live input r4, commit a3824307; tests in
   `tests/live4.spec.mjs` 92-138 and 196-201): the bow shows only while a tap moves the sand. Check
   it on a phone-size clip with tone changes from a tap, the microphone (a recorded tone) and an
   audio file, and post that clip so he can confirm. Fix anything you find.

#### Deliverables

- Tests in `tests/lv7*.spec.mjs`: the mirror's frame-to-frame stability (a measure you define,
  better than main's), nothing drawn over the face region in the hologram view, the landscape empty
  at open and growing with playback, and the bow rule.
- Clips at phone size: the mirror before and after (plain and hologram), the landscape growing from
  silence, the Chladni plate through several tone changes.
- How-to and About texts updated for what changes.

#### You own

The Splat mirror in `src/packs/live.js`, the Song landscape and Chladni plate parts of
`src/packs/studio.js` and `src/packs/song-looks.js`, `tests/lv7*.spec.mjs`, `tools/lv7-*.mjs`, those
toys' lines in the shared lists, and this file. Lane Studio media changes the Moving photo to 3D's
samples in `src/packs/moving-photo.js` beside you; don't touch that file.

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
- Merging: The engine PR merges after a full test run; the toys are labs, so the Operator merges
  them after the full run too, and the owner decides when they go public. Never merge anything
  yourself.
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
- Tests: `tests/lv7*.spec.mjs`; never edit `tests/taps.spec.mjs`. Before each push run your own
  specs and the specs of the files you touch (say which in the PR); the Integrators run the full
  suite before a merge. Prettier, `node tools/us-english.mjs --diff`, and for toys
  `node tools/check-packs.mjs <pack>`, a contact sheet and thumbnails (CLAUDE.md, "Before every
  push"). Screenshots `lv7-<name>-390x844.png` and `…-1440x900.png`, then
  `node tools/upkeep.mjs --restore-shots`.
- Clips: post every new or changed effect on Effect review page 2
  (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as docs/OPERATING.md, "Steps for a lane", says
  (lane record `LiveR7`), after watching each one. After posting, check the owner's marks about once
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

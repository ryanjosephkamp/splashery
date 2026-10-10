# Lane QR r5 (`qr5`, Opus 5.5, high effort)

Branches: `claude/lane-qr-r5` (the lane PR, "Phase QR r5: the October 10 walkthrough's QR notes")
and `claude/lane-qr-r5-engine` (only if a change outside the QR files is needed).

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session,
session_012GmKRUMZLir2nb27Bo8Cu2). Repo: ryanjosephkamp/splashery. Your lane: QR r5 (id `QRr5`,
prefix `qr5`). Branch: `claude/lane-qr-r5` (and `claude/lane-qr-r5-engine` for any change to the app
outside the QR files, as a small, additive "Engine: …" PR merged first). PR title: "Phase QR r5: the
October 10 walkthrough's QR notes". Handoff file: docs/handoff/QRr5.md (create it; start it with
this brief, word for word, under "## Brief", then keep "## State

October 10, 2026: first READY. Every item is built, tested and on draft PR #507; the clips are on
Effect review page 2 (lane record `QRr5`, cards `qr5-…`), and the sounds are on the Sound Board
through tools/sound-review.json ("ready").

1. Picture QR: the tap's ripple lifts and tips each tile with its own picture colors
   (`pictureModifier` in src/qr-craft/field.js); the control is "Send a ripple".
2. QR damage lab: a tapped sticker or smudge lands at the tap; a tapped tear starts from the nearest
   corner (a tap toward a corner) or the nearest edge at the tap; a tapped burn from the nearest
   corner (src/qr-lab/damage.js: `at`, `tearFrom`, `burnFrom`; src/packs/qr-lab.js: `tapDamage`,
   `tapOnCode`). The damage string adds an optional fifth field `x,y`; old strings load as before.
3. Three QR codes in one: the cause was the splat sort. Each code's white card sat 0.03 module
   behind its modules and tied with them in the sorter's depth steps (splats sort in their built
   pose). Every card, the joined square's too, now sits half a module (`LAYER`) behind its modules,
   and the three codes stack green, blue, red. New labs options `c1`–`c3` pick the pulled-apart
   codes' colors (a light color darkened to luminance 0.5 or less).
4. Sounds: the How a QR code works wind 0.07 → 0.025, the Three codes whoosh 0.12 → 0.04, the Other
   barcodes note removed.

## Notes

- Tests: tests/qr5.spec.mjs (5 tests). The QR family's specs (qrs-\*, qrc-picture, qrc-barcodes,
  qr4-craft, qr4-scan, qr4-flash) pass, except `tests/qrs-toys.spec.mjs:37`, which fails the same
  way on main (Fix11 is fixing it).
- Clips were made with a phone-size (390×844) MP4 clip script kept out of the repo; it steps the
  clock by hand as tools/effect-clip.mjs does. The "tilted" clips turn the camera a little to make
  the sort fault easy to see.

## Known issues

- From a tilted camera, while the three codes overlap at the start and end of the split, the one
  drawn in front can be the one farther to the side (the splats keep their built-pose sort). From
  the default camera they stack green, blue, red.

## For the Operator

- I edited src/qr-lab/damage.js (QR lab r2's folder, finished): the Damage lab's damage lives there.
  Nothing outside the QR files changed; no engine PR.
- `tests/qrs-toys.spec.mjs:37` fails on main too; I didn't touch it.

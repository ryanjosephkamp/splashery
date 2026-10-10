# Lane QR r5 (`qr5`, Opus 5.5, high effort)

Branches: `claude/lane-qr-r5` (the lane PR, "Phase QR r5: the October 10 walkthrough's QR notes")
and `claude/lane-qr-r5-engine` (only if a change outside the QR files is needed).

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session,
session_012GmKRUMZLir2nb27Bo8Cu2). Repo: ryanjosephkamp/splashery. Your lane: QR r5 (id `QRr5`,
prefix `qr5`). Branch: `claude/lane-qr-r5` (and `claude/lane-qr-r5-engine` for any change to the app
outside the QR files, as a small, additive "Engine: …" PR merged first). PR title: "Phase QR r5: the
October 10 walkthrough's QR notes". Handoff file: docs/handoff/QRr5.md (create it; start it with
this brief, word for word, under "## Brief", then keep "## State", "## Notes", "## Known issues" and
"## For the Operator" current). Model: Opus 5.5, at high effort (CLAUDE.md).

Read CLAUDE.md, docs/HANDOFF.md, docs/OPERATING.md, docs/handoff/ScienceR3.md ("How this lane runs",
with your prefix and lane record), and docs/handoff/QRr4.md (the last QR round: how the family is
built, Picture QR's halftone, the capture fix).

### Brief (written by the Operator on October 10, 2026)

Your list is docs/reviews/2026-10-10-evening/triage.md, section "QR r5" (items 1 to 4). Read it
first, with its two screenshots. In short:

1. **Picture QR** (`qr-picture`): a tap's ripple turns every module inside the wave plain black,
   then back. Make the wave carry each module's own picture color (the halftone colors lift and fall
   with the wave), so the picture stays whole while it passes.
2. **QR damage lab** (`qr-damage`): the sticker and the smudge land where the person taps; the tear
   starts from the corner (or edge) nearest the tap; the burn spreads from the corner nearest the
   tap. Blur, shrink, grow, jitter, fade and color drift stay as they are. The meter must keep
   agreeing with jsQR (`tests/qrs-toys.spec.mjs:78`). Make "tap to place" clear in the toy's how-to
   line.
3. **Three QR codes in one** (`qr-three`): white horizontal streaks flicker across the top rows of
   all three codes as they split apart and while they're apart. Find the cause and fix it. If it's
   simple and keeps the code readable, let people choose the three colors (a labs option).
4. **Sounds** (src/toy-sounds.js, these toys' entries only): How a QR code works, the wind quieter;
   Three QR codes in one, the separation whoosh quieter; Other barcodes, drop the note at the end.
   QR code and Picture QR stay as they are. Add each change to tools/sound-review.json's "new sounds
   to hear" for these toys (docs/OPERATING.md, "The sound review").

The owner praised the rest of the family (stable now, barcodes "basically perfect", Picture QR's
pictures great). Change nothing else.

You own: src/qr/, src/qr-craft/, src/packs/qr*.js, these toys' lines in the shared lists
(src/toy-sounds.js, src/toy-help.js, tools/toy-plan.json, src/toys.js), and tests/qr5*.spec.mjs.
Fix11 (a running lane) is editing `tests/qrs-toys.spec.mjs:37`. Don't edit that test; if you must
change anything in tests/qrs-toys.spec.mjs, ask the Operator first.

Effect quality (CLAUDE.md): every changed effect is judged as motion at phone size. Make clips at
390×844 for each item: the Picture QR ripple (before and after), each tap-placed damage, and Three
QR codes splitting (before and after, slow enough to show the streaks are gone). Post them on Effect
review page 2 (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as docs/OPERATING.md, "Steps for a
lane", says (no republish), ids `qr5-…`, each naming Opus 5.5. Sound changes go on the Sound Board
through tools/sound-review.json, not as clips.

How this lane runs: finish every working turn with "READY:", "WORKING:" or "BLOCKED:". For a long
job, schedule a check-in with send_later instead of going idle. Before READY, run CLAUDE.md's
"Before every push" steps and re-read its "Effect quality rules". These are labs toys, so the
Operator merges your PR after its full suite and the owner's marks on your cards. When main moves,
merge it into your branch (never rebase). Aim for a first READY within about four hours.

## State

Started October 10, 2026. Reading the code.

## Notes

## Known issues

## For the Operator

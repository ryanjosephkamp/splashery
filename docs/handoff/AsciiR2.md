# ASCII r2 (`AsciiR2`, prefix `asc2`)

Model: Sonnet 5.5, at the default effort.

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: ASCII r2 (id `AsciiR2`, prefix `asc2`).
Branch: `claude/lane-ascii-r2` (and `claude/lane-ascii-r2-engine` for any change to the app outside
your own files, as an "Engine: …" PR merged first). PR title: "Phase ASCII r2: ASCII GIFs for more
toys". Handoff file: docs/handoff/AsciiR2.md (create it; start it with this brief, word for word,
under "## Brief", then keep "## State", "## Notes", "## Known issues" and "## For the Operator"
current). Model: Sonnet 5.5, at the default effort.

### Brief (written by the Operator on October 7, 2026)

The ASCII capture lab (ascii-lab.html, src/ascii-capture/, merged October 7 in Ops #375) turns a
fresh toy animation into an ASCII GIF, but only for the grapes, the whole orange and the strawberry.
Ryan approved all three (asc-\*-r3) and his phone's Device check passed (Brave on Android, max
profile, 4.2 s, 888×908, 40 frames, 1.16 MB, decode pass, credit found). Read
docs/handoff/AsciiCapture.md first, and keep everything it built: one fresh capture page per job,
the fixed home camera, the device profile held for the job, cancel, hidden-page and timeout cleanup,
the credit in the GIF comment, and src/export/ascii.js untouched.

Ryan wants ASCII GIFs for many more toys: "at least for most foods, balls, shapes, etc. Some, like
photoreal, might not be suitable." Build it in this order:

1. **The list.** A data file (src/ascii-capture/toys.json or similar) of kit toys whose shape reads
   well in characters: foods, balls, shapes, gems, toys, instruments, playthings. For each, the
   camera, frame count and preset that suit it. Leave out photoreal scans, live-input toys, data and
   map toys, documents, and anything that is mostly fine detail.
2. **A legibility check.** A tool (tools/asc2-check.mjs) that captures each candidate at phone width
   and scores it. Use simple measures: how much of the frame the subject fills, edge contrast after
   the character map, and frame-to-frame change for the motion. Keep the toys that pass, and list
   the ones that don't and why.
3. **The lab.** A toy picker for every toy that passed (grouped by shelf), with each toy's credit as
   the lab shows it now. Keep the current three exactly as they are.
4. **Evidence.** A contact sheet of every passing toy's first frame. Post one card per shelf on
   Effect review page 2 with a short GIF strip (ids asc2-<shelf>).

No changes to the export menu, the app, or src/export/ascii.js. Labs only; Ryan decides any public
release. You own: src/ascii-capture/ (the toy list and lab code), ascii-lab.html, tools/asc2-\*.mjs,
tests/asc2\*.spec.mjs, docs/audits/ascii-capture-2026-10/ (keep it under 2 MB), and your handoff
file. Run the existing tests/asc\*.spec.mjs too: they must stay green.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
replace the prefix and lane record with yours). Labs: the Operator merges after a full test run (the
Integrators run it); the owner decides when anything goes public. Finish every working turn with
"READY:", "WORKING:" or "BLOCKED:"; Splashery has no CI to wait for; for a long job, schedule a
check-in with send_later instead of going idle. Clips at phone size go on Effect review page 2
(https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as docs/OPERATING.md, "Steps for a lane", says
(no republish). Before READY, re-read CLAUDE.md's "Effect quality rules" and check each clip against
them at phone size. The push ends Wednesday, October 7, 2026, 4 p.m. ET (20:00 UTC): aim for a first
READY within about four to six hours, then polish rounds on the owner's marks. A fresh Operator
session takes over from the current one on October 7; keep reporting the same way (READY, WORKING or
BLOCKED in your final message).

## State

- October 7, 2026: started. The toy list (`src/ascii-capture/toys.json`, 85 candidates in six
  shelves), the check (`tools/asc2-check.mjs`) and the grouped picker are built; the full check is
  running.

## Notes

- The list holds kit toys only (foods, balls, shapes, gems, toys, instruments). The first three
  presets are untouched (`ORIGINAL` in `protocol.js`); every listed toy is also a preset the capture
  page accepts, so the check can run candidates. The lab lists only toys whose `check.pass` is true;
  `ascii-lab.html?all=1` lists every candidate (the check's knob).
- The check scores the GIF a person would get (96 columns, mono, `?profile=high`): fill, edge and
  motion, thresholds in `LIMITS`, set from the three approved presets.

## Known issues

## For the Operator

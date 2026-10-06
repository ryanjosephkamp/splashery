# Lane QR craft: picture codes, codes built from real things, and other barcodes (prefix `qrc`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: QR craft (id `QRcraft`, prefix `qrc`).
Branch: `claude/lane-qr-craft` (and `claude/lane-qr-craft-engine` for any change to the app outside
your own files, as an "Engine: …" PR merged first). PR title: "Phase QR craft: picture codes, codes
built from real things, and other barcodes". Handoff file: docs/handoff/QRcraft.md (create it;
start it with this brief, word for word, under "## Brief", then keep "## State", "## Notes", "##
Known issues" and "## For the Operator" current). Model: Opus 5.5, at the default effort.

### Brief (written by the Operator on October 6, 2026, from the owner's Push Plan picks)

The owner's QR picks Q5 ("a hard yes, or a strong yes"), Q13 ("Absolutely. This is really, really
cool") and Q12 ("I like the other barcodes idea"). Read docs/handoff/QRr3.md and docs/handoff/QR*.md
first: the QR code toy, the QR lab and the damage lab already exist (src/qr/, src/qr-lab/, their
packs), with Project Nayuki's encoder and jsQR vendored. Build in this order and push each part as
it works:

1. **Picture QR (Q5).** A photo (a sample, or the person's own picture, which stays on the device)
   woven into the modules as a halftone: each module's center keeps the bit, the rest carries the
   picture. Measure the contrast and check that it scans with jsQR at phone size and at a smaller
   size; if it won't, say so in plain words and offer the closest version that does (more contrast,
   a bigger center dot, a higher error-correction level). Splats as crisp as the QR r3 polish made
   them. Export a PNG.
2. **Codes built from real things (Q13).** Real motion that ends on a code that scans: dominoes that
   fall into place, marbles that roll into their modules, tiles that flip. Each piece is a solid
   piece that moves like the real thing (the Physics engine in src/physics/ may help). The final
   frame must decode with jsQR (test it), for the person's own text too.
3. **Other barcodes (Q12).** Code 128 and EAN-13/UPC-A drawn by our own code (with check digits and
   quiet zones, tested against known reference values), then Data Matrix and Aztec through a small
   open-source library (an MIT or Apache-2.0 encoder, under 2 MB, vendored in `vendor/`, loaded only
   when the toy opens, listed in LICENSES.md and named in your PR; anything copyleft or over 2 MB
   goes to the Operator first). Each scans or decodes in a test.

New labs toys on the QR shelf (or one toy with modes, if that reads better on a phone). Don't edit
the existing QR toys or src/qr/; import from them, and if you need a hook there, make it a small
additive "Engine: …" PR. Tests in `tests/qrc*.spec.mjs`; how-to and About texts for each toy
(help.spec and hta.spec limits); evidence files in docs/evidence/ for the barcode math (check
digits, the standards you follow).

You own: `src/packs/qr-craft.js` (new), `src/qr-craft/` (new helpers), `tools/qrc-*.mjs`, any new
vendored encoder and its LICENSES.md entry, new assets, `tests/qrc*.spec.mjs`, your evidence files,
your toys' lines in the shared lists, and your handoff file.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
replace the prefix and lane record with yours). Labs: the Operator merges after a full test run (the
Integrators run it); the owner decides when anything goes public. Finish every working turn with
"READY:", "WORKING:" or "BLOCKED:"; Splashery has no CI to wait for; for a long job, schedule a
check-in with send_later instead of going idle. Clips at phone size go on Effect review page 2
(https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as docs/OPERATING.md, "Steps for a lane", says
(no republish). Before READY, re-read CLAUDE.md's "Effect quality rules" and check each clip against
them at phone size. The push ends Wednesday, October 7, 2026, 4 p.m. ET (20:00 UTC): aim for a
first READY within about six hours, then polish rounds on the owner's marks.

## State

WORKING: lane started October 6, 2026 (Opus 5.5, default effort). Reading the QR toys; building item
1 (Picture QR) first.

## Notes

## Known issues

## For the Operator

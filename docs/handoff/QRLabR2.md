# Lane QR lab r2: how a QR code works, the Damage lab, and a study of splat codes (prefix `qrs`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: QR lab r2 (id `QRLabR2`, prefix `qrs`). Branch:
`claude/lane-qr-lab-r2`. PR title: "Phase QR lab r2: how a QR code works, the Damage lab, and a
study". Handoff file: docs/handoff/QRLabR2.md. Model: Opus 5.5.

### Brief (written by the Operator on October 4, 2026, from the owner's push notes that evening)

The owner made QR codes a major focus of the push (docs/reviews/2026-10-04-push-alignment/notes.md;
on the Push Plan page he marked Q6 and Q7 "strong yes"). Lane QR built the splat QR toy (#216,
`src/qr/`, `src/packs/qr.js`), lane QR scan lab measured it with two readers and phone-like captures
(#215, `tools/qr-scan-lab.mjs`, docs/audits/qr-scan-lab-2026-10.md), and lane QR r3 is improving the
toy beside you (it owns `src/qr/` and `src/packs/qr.js`; import from them, don't edit them; if you
need a hook there, tell the Operator).

1. **How a QR code works** (Q6). A labs toy that teaches the structure of a real code, as the Splat
   equation toy teaches splats. Tap to light up each part: the finder patterns, separators, timing
   patterns, alignment patterns, format information, version information, the data and
   error-correction codewords, and the mask. Then step through encoding the person's own text: the
   mode, the character count, the data bits, padding, the Reed–Solomon error-correction codewords,
   interleaving into blocks, placement along the zigzag path, the eight masks and their penalty
   scores, and the chosen mask. It must be technically correct (the owner: "Again, it has to be
   technically correct"): check every step against ISO/IEC 18004 as described by open sources you
   cite (for example Wikipedia's "QR code" article and Thonky's QR code tutorial), and prove it with
   tests that compare each intermediate result with the vendored Nayuki encoder's for the same input
   (version, mask, codewords, final modules).
2. **The Damage lab** (Q7, "an absolute strong yes ... build this out very comprehensively"). A labs
   toy: scratch a code, cover it with a sticker, tear or burn a corner, smudge it, and watch a live
   "still scans?" meter (jsQR, already vendored). Add the damage only splats allow: blur the splats,
   shrink or grow them, jitter them, fade them, shift their colors, curve or tilt the plate, and
   move them in time. Show the four error-correction levels (L, M, Q, H) side by side under the same
   damage, and, from the modules you know, how many codewords each block lost against how many it
   can fix. Every number shown comes from the code, never invented.
3. **A study of splat QR codes** (the owner: "maybe even to the point where we actually have some
   empirical research results ... a parametric study where we really, really precisely and finely
   change certain variables and scan and check ... and write some sort of report"). Extend the scan
   lab's method in your own tools (`tools/qrs-*.mjs`; `tools/qr-scan-lab.mjs` stays as it is):
   - Variables: what makes a splat code different from a printed one (splat size and softness per
     module, gaps, opacity, color contrast and gradients, style, the living-color wave's phase, a
     motion's frames, viewing angle and distance in 3D, the damage types above by region), against
     error-correction level and version.
   - Readers: jsQR and zxing-js as the scan lab used, plus a third if you can add one at build time
     (for example zxing-cpp through a pinned devDependency, or OpenCV's QR detector), each listed in
     LICENSES.md.
   - Method: fixed seeds, repeated trials, the phone-like captures, scan rate with confidence
     intervals, and the threshold where each variable stops scanning.
   - Report: `docs/research/qr-splat-study-2026-10.md` with the method, charts, the thresholds, what
     looks new about codes made of splats (search for prior work and cite what you find; say plainly
     if it has been done), and the limits (simulated captures, not phones).
   - A phone check: a test sheet the owner can scan with his phone (a page of codes from the study's
     edge cases, each labeled) and a short form in your handoff file for his results.
4. **Do codes have to be square?** (his question). Answer in the report with tests: a standard QR
   code is square; Micro QR and rMQR (rectangular Micro QR, ISO/IEC 23941:2022) exist, and which of
   your readers decode them; a square code framed in a circle, with rounded modules or dots, still
   scans when the finder patterns, contrast and quiet zone hold. Show which shapes scan and which
   don't.

#### Deliverables

- Tests in `tests/qrs*.spec.mjs`: every encoding step equals Nayuki's; the damage meter agrees with
  jsQR on a fixed set; the study's tool runs on a small grid.
- Clips at phone size: the parts lighting up, the encoding steps, damage spreading until the meter
  drops, the four levels side by side.
- The report and the phone test sheet; how-to and About texts for both toys.

#### You own

`src/qr-lab/` (new), `src/packs/qr-lab.js` (new), `tools/qrs-*.mjs`, `tests/qrs*.spec.mjs`,
`docs/research/qr-splat-study-2026-10.md` and its data folder, your toys' lines in the shared lists,
and this file.

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
- Tests: `tests/qrs*.spec.mjs`; never edit `tests/taps.spec.mjs`. Before each push run your own
  specs and the specs of the files you touch (say which in the PR); the Integrators run the full
  suite before a merge. Prettier, `node tools/us-english.mjs --diff`, and for toys
  `node tools/check-packs.mjs <pack>`, a contact sheet and thumbnails (CLAUDE.md, "Before every
  push"). Screenshots `qrs-<name>-390x844.png` and `…-1440x900.png`, then
  `node tools/upkeep.mjs --restore-shots`.
- Clips: post every new or changed effect on Effect review page 2
  (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as docs/OPERATING.md, "Steps for a lane", says
  (lane record `QRLabR2`), after watching each one. After posting, check the owner's marks about
  once an hour with a scheduled check-in (send_later); stop once your PR is merged or closed.
- Language: American English for every new text (color, center, gray, license, toward, -ize endings,
  dates like "October 5, 2026").
- Your handoff file: start it with this brief, word for word, under "## Brief", then keep "##
  State", "## Phone check (for the owner, through the Operator)

The test sheet is `docs/research/qr-splat-study-2026-10/phone-sheet.html` (and `phone-sheet.png`):
50 codes, S01 to S50. Open it on a computer screen or print it, point the phone's camera app at each
code, and note what happens. For each code, write the letter: **Y** it opened the right link or
text, **N** nothing, **W** something else (say what). Also say which phone and camera app.

| Ids     | Results (Y / N / W) |
| ------- | ------------------- |
| S01–S10 |                     |
| S11–S20 |                     |
| S21–S30 |                     |
| S31–S40 |                     |
| S41–S50 |                     |

The study's predictions (zxing-cpp on simulated phone captures) are printed under each code on the
sheet. S48 (Micro QR) and S49 (rMQR) have no prediction for phone apps; S50, the three-color code,
should open the green code's link or nothing.

## Notes", "## Known issues" and "## For the Operator" current.

- PR: one draft PR against main (five sections: Summary, Verification, Deviations, Known issues,
  What was cut), opened early and pushed after each finished item. Finish every working turn with a
  final message that starts "READY:", "WORKING:" or "BLOCKED:".

## State

READY (October 5, 2026). Everything in the brief and X2 and X3 is on the branch (PR #267):

- **Item 1, How a QR code works** (`qr-anatomy`): the parts and the encoding steps, computed by
  `src/qr-lab/steps.js` and checked step by step against Nayuki's encoder
  (`tests/qrs-steps.spec.mjs`).
- **Item 2, the Damage lab** (`qr-damage`): 14 kinds of damage, one code or the four levels side by
  side, a meter that reads the stage with jsQR and counts each block's losses
  (`tests/qrs-toys.spec.mjs`: the meter equals jsQR on a fixed set of 10).
- **X3, the code that heals**: real Reed–Solomon decoding, block by block
  (`tests/qrs-heal.spec.mjs`).
- **X2, three codes in one** (`qr-three`) and its study.
- **Items 3 and 4, the study**: `tools/qrs-study.mjs`, the report
  `docs/research/qr-splat-study-2026-10.md` (43,240 captures, three readers, thresholds, the shapes
  answer, X2, prior work, limits) and the phone sheet (form below).
- Clips: 8 cards on Effect review page 2 (lane QRLabR2); marks checked hourly.
- The owner's marks of October 5: Three codes in one "good"; the anatomy clips asked for the lit
  part to pop out (optional): done, a "Pop the lit part out" switch. The Damage lab clips: "keep
  polishing": each tap now moves only the damage it adds (scratches draw on, smudges and char
  spread, a sticker drops only when it grows, torn or burned pieces fall once), each code is labeled
  with its level, and misread modules show a stronger red. Seven -r2 cards replace the old ones.

## Phone check (for the owner, through the Operator)

The test sheet is `docs/research/qr-splat-study-2026-10/phone-sheet.html` (and `phone-sheet.png`):
50 codes, S01 to S50. Open it on a computer screen or print it, point the phone's camera app at each
code, and note what happens. For each code, write the letter: **Y** it opened the right link or
text, **N** nothing, **W** something else (say what). Also say which phone and camera app.

| Ids     | Results (Y / N / W) |
| ------- | ------------------- |
| S01–S10 |                     |
| S11–S20 |                     |
| S21–S30 |                     |
| S31–S40 |                     |
| S41–S50 |                     |

The study's predictions (zxing-cpp on simulated phone captures) are printed under each code on the
sheet. S48 (Micro QR) and S49 (rMQR) have no prediction for phone apps; S50, the three-color code,
should open the green code's link or nothing.

## Notes", "## Known issues" and "## For the Operator" current.

- PR: one draft PR against main (five sections: Summary, Verification, Deviations, Known issues,
  What was cut), opened early and pushed after each finished item. Finish every working turn with a
  final message that starts "READY:", "WORKING:" or "BLOCKED:".

## State

WORKING (October 5, 2026). Done so far, on the branch:

- **Item 1, How a QR code works** (`qr-anatomy`, labs, Studio shelf): tap through the parts
  (finders, separators, timing, alignment, format and version information, the dark module, data and
  error correction codewords, remainder bits, the mask), or encode your own text step by step (mode,
  count, data bits, padding, error correction, blocks and interleaving, zigzag placement, the eight
  masks with their penalties, the chosen mask, format and version information). A second encoder
  written from the standard (`src/qr-lab/steps.js`) computes every step; `tests/qrs-steps.spec.mjs`
  checks each step against Nayuki's encoder on 100+ texts in every mode and level (segments,
  version, data codewords, error correction, interleaving, placement path, each mask's penalty,
  chosen mask, final modules) and against Thonky's worked example.
- **Item 2, the Damage lab** (`qr-damage`): scratch, sticker, tear, burn, smudge, blur, shrink,
  grow, jitter, fade, color drift (rebuilt), and tilt, curve, move in time (live sliders, on the
  GPU, the same math as `src/qr-lab/damage.js`). One code or the four levels side by side. The meter
  renders the stage, reads it with jsQR, samples every module and counts each block's lost codewords
  against its capacity (`src/qr-lab/read.js`).
- **X3, the code that heals**: "Heal it" shows what the reader read (wrong modules in red) and turns
  them over block by block as real Reed–Solomon decoding (`src/qr-lab/rs.js`: Berlekamp–Massey,
  Chien, Forney) fixes each block; `tests/qrs-heal.spec.mjs` checks the decoding.
- **X2, three codes in one** (`qr-three`): the encoder and the splitting reader
  (`src/qr-lab/rgb.js`); a tap pulls the three codes apart. Its study is part of item 3.
- **Item 3 and 4** (the study and the shapes): a helper is building `tools/qrs-study.mjs`, the
  report and the phone sheet.

Next: clips (`tools/qrs-clip.mjs`), thumbnails, screenshots, the study's report, the phone form.

## Notes", "## Known issues" and "## For the Operator" current.

- PR: one draft PR against main (five sections: Summary, Verification, Deviations, Known issues,
  What was cut), opened early and pushed after each finished item. Finish every working turn with a
  final message that starts "READY:", "WORKING:" or "BLOCKED:".

## State

WORKING (October 5, 2026): started. Plan, in order: (1) the "How a QR code works" toy with an
independent step-by-step encoder checked against Nayuki's; (2) the Damage lab with the live meter,
the four levels side by side and the code that heals (X3, real Reed–Solomon decoding); (3) the study
tools (`tools/qrs-*.mjs`) and the report; (4) the shapes question; then X2 (three codes in one
square). Build tools added: zxing-wasm 3.1.4 (zxing-cpp, the third reader; it also writes and reads
Micro QR and rMQR) and bwip-js 4.11.4 (an independent Micro QR and rMQR writer), both MIT, pinned
devDependencies.

## Notes

## Known issues

- The "Move in time" motion was fixed after the study's run (modules dipped behind the sheet and
  vanished); the report says so, and the posted clip shows the old motion at small amounts.
- The Damage lab's block counts and jsQR can disagree (blurred, shrunk or faded splats keep every
  module's center right while jsQR fails); the meter shows both and says why.
- Healing and the eased motions run slowly in the software renderer.
- Three codes in one: a short jump from the colored square to the red layer as it pulls apart.

## For the Operator

- New build-only devDependencies (pinned, MIT, in LICENSES.md): zxing-wasm 3.1.4 and bwip-js 4.11.4.
  No new library in the page; no engine PR.
- The phone check needs the owner: the form above.
- The full suite was not run here (the Integrators run it); my specs (`tests/qrs*.spec.mjs`) pass.

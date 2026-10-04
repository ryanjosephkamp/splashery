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
  State", "## Notes", "## Known issues" and "## For the Operator" current.
- PR: one draft PR against main (five sections: Summary, Verification, Deviations, Known issues,
  What was cut), opened early and pushed after each finished item. Finish every working turn with a
  final message that starts "READY:", "WORKING:" or "BLOCKED:".

## State

WORKING: not started yet (October 4, 2026).

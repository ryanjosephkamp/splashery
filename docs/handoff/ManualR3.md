# Lane Manual r3 (prefix `man3`)

## Brief

You are a Splashery worker session started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery.

- Your lane: Manual r3 (prefix `man3`).
- Branch: `claude/lane-manual-r3`.
- PR title: "Phase Manual r3: the October 9 review's text round".
- Handoff file: docs/handoff/ManualR3.md. Create it, starting with this brief word for word under
  "## Brief". Then keep "## State", "## Notes", "## Known issues" and "## For the Operator" current.
- Model: Sonnet 5.5, at high effort (the docs lanes' model, CLAUDE.md).

### Brief (written by the Operator on October 9, 2026, from the owner's manual review)

Read docs/reviews/2026-10-09-manual/plan.md. Its section "Manual r3 (`man3`, Sonnet): the text
round", parts 1 to 6, is your list. Part 7 (the expansion) comes after the owner reviews this round,
so don't start it.

- The owner's own notes are private; the plan is the Operator's summary of them.
- The owner's edits in part 1 are his own wording: use them exactly.
- He likes the manual a great deal. Remove nothing unless it is wrong.

**Where things are:**

- The web manual is the hand-written manual/index.html, styled by manual/manual.css and served at
  /manual/.
- The PDF is printed from it by tools/manual-pdf.mjs:
  `SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/manual-pdf.mjs`, with
  `python3 -m http.server 4173 --bind 127.0.0.1` running.
- docs/handoff/Manual.md and the Manual r2 handoff tell how it was built.

**The facts for parts 2 and 3** come from a read of the code. Check each against the code before you
write it. The plan names the files:

- src/generators.js (the budgets);
- src/player.js (Auto: `detectProfile` 92–108, and the runtime step-down via src/stage.js
  `timeFrame` 232–256);
- src/kit.js (15 parts at 780; the morph packing `encodeMorphs` 945–960);
- src/effects.js (the 4-bit part index at 882; `MORPH_RANGE`);
- src/equation.js (`MAX_LENGTH` 120, the grammar 176–321, the functions 32–54);
- src/packs/splat-equation.js (12 `FIELDS` at 146, `KNOTS` at 27, `PLAY_SECS` at 30, the skipped
  points 494–516, the aliases at 249);
- src/state.js (16 option keys at 177).

A prototype of the Operator's plain-language explanations (the grammar's notation, t's two clocks,
the 12 bits) exists privately. Write your own, plainly, for a newcomer.

**Rules for this round:**

- **The demos are placeholders only.** On the web, each is a clearly marked box naming what it will
  show (plan part 6), hidden in print. The PDF keeps today's figures. Don't build any demo.
- **The level map shows Levels 1 to 5 only,** plus a line that more levels are coming. The proposed
  Levels 6 to 10 wait for the owner's approval.
- **Every link opens in a new tab:** the app, GitHub, Further reading and References, including
  "Back to Splashery" and the cover link. Use `newTabLinks()` from tools/site-pages.mjs or edit by
  hand, and extend tests/st2.spec.mjs to check manual/index.html too.
- **The serial comma throughout the manual.** It is the owner's new rule (CLAUDE.md), and he asked
  for it here specifically. American English too: `node tools/us-english.mjs --diff`.
- **References:** a numbered section near the end, with each source cited where it is used. Keep the
  existing Further reading.
- **Figures 2 and 3 roomier on the web.** Check the PDF's pages still lay out well.
- **Reprint the PDF** (manual/tinkerers-manual.pdf) at the end.
- **Tests:** tests/man3.spec.mjs checks that the owner's part-1 sentences are present word for word,
  every placeholder exists and is hidden in print, every link has a new-tab target, and the grammar
  block names arcsin, arccos and arctan. Keep tests/man.spec.mjs and tests/man2.spec.mjs green,
  updating their expectations only where the owner's edits change a sentence they check, and say so
  in the PR.

**For the owner's review,** post screenshots of each changed section, at 390x844 and 1440x900, and
the new PDF, as cards on Effect review page 2 (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK),
ids `man3-…`, following docs/OPERATING.md, "Steps for a lane" (no republish). The manual is public,
so this round merges after his "good" marks.

**You own:** manual/, tools/manual-pdf.mjs (small changes), tests/man3\*.spec.mjs, and the manual's
case in tests/st2.spec.mjs.

**How this lane runs:** exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
replace the prefix and lane record with yours).

- Finish every working turn with "READY:", "WORKING:" or "BLOCKED:". Splashery has no CI to wait
  for.
- For a long job, schedule a check-in with send_later instead of going idle.
- The owner's marks may carry `images`, screenshots he attached. Read each with the Artifact tool's
  `read` (url the page, path the asset id).
- Your Operator is session_012GmKRUMZLir2nb27Bo8Cu2. Aim for a first READY within about six hours.

## State

Model: Sonnet 5.5 (claude-sonnet-5-5), high effort. Lane record `ManualR3` on Effect review page 2.

October 9, 2026: parts 1 to 6 of the plan are written in `manual/index.html` and
`manual/manual.css`; the PDF is reprinted at the end of the round (see "For the Operator" for the
page count). Draft PR: see the Operator's list.

Done, by plan part:

1. **The owner's edits**, word for word: Level 1's first paragraph; "neither … nor"; "one data
   dimension" plus a line that the data are one-dimensional while the drawing needs two; the comma
   after "In three dimensions"; the colors sentence; the aliases paragraph as a "Flexibility" list
   (the alternative names including `colour` and `n`, the ranges, capitals, and `#` notes); the
   grammar's introduction.
2. **Definitions**, where each first appears and in the glossary (now 22 terms): the kit, the weight
   field and the positive widths, the quadratic form (with a two-dimensional example), affine, tilt
   (and rotation; "Tilt lock" stays the camera control), smoothstep (linked), the grammar's notation
   and "atom", and u and v as the coordinates of a flat sheet (parametric-surface parameters, not a
   substitution).
3. **Eight "Why this number?" notes**, each with where it lives: the budgets and Auto; one color per
   splat; fifteen parts; twelve fields; the 120-character limit; twelve moments; twelve bits; the
   two clocks.
4. **Corrections**: the grammar now has `[ ]` and `{ }` and arcsin, arccos, and arctan, with the
   real rule for a bare input; "Any field you leave out" rewritten; the cover's opening line gets
   the Sharp view note.
5. **Structure**: a level map (Levels 1 to 5, and "More levels are coming."); a numbered References
   section (10 entries, cited where used; Further reading unchanged); every link opens in a new tab;
   Figures 2 and 3 redrawn 440 units wide (were 360) and shown up to 560 px wide on the web; "Run it
   yourself" has a prompt for a coding assistant.
6. **Thirteen demo placeholders**, web only, hidden in print. No demo is built.

Also: the serial comma through the manual's lists, and the updated date (October 9, 2026).

## Notes

- Facts checked against the code on main (`8a53aa5c`): `PROFILES` (src/generators.js:76), Auto
  (`detectProfile`, src/player.js:92; `stepDown`, :214; `timeFrame`, src/stage.js:232), 15 parts
  (`part`, src/kit.js:778, parts[0] is the body; the 4-bit index `pk & 15` in src/effects.js:882,
  with two flags in bits 4 and 5), `encodeMorphs` (src/kit.js:945; 12 bits per axis over
  ±`MORPH_RANGE` = 2), `MAX_LENGTH` (src/equation.js:18), the grammar (parse, :175–321; the bracket
  tokens :133–141; `bareArg` :234), `FIELDS` (:146), `KNOTS` (:27), `PLAY_SECS` (:30), the merge of
  typed fields (src/packs/splat-equation.js:306), the aliases (:249), and the 16 option keys
  (src/state.js:177). The equation toy keeps 15 option keys: `preset`, `splats`, `shade`, and the 12
  fields.
- "More splats help a toy's shape, not its grain" is from docs/lab/SHARPNESS.md ("The tier's budget:
  not a sharpness lever").
- "One color per splat": the kit buffer keeps the base color only (src/packs/fidelity.js, opening
  comment). I did not find an engine switch that turns view-dependent color off for generated toys,
  so the note says only what that comment says.
- References: [1] to [3] are papers (the ACM page for [3] blocks automated checks, so its DOI link
  was not opened by me); [4] to [9] are Wikipedia articles, opened October 9, 2026 (Parametric
  surface answered "too many requests", so it was not opened); [10] is docs/PACKS.md.
- The demo placeholders are `aside.demo-placeholder[data-demo="…"]`, hidden by `@media print`.
- Tests: `tests/man3.spec.mjs` (new), `tests/st2.spec.mjs` (one new test), `tests/man2.spec.mjs`
  (the glossary count, 14 to 22: the only expectation changed).

## Known issues

- The PDF's figure text for Figures 2 and 3 is smaller relative to the page than on the web, because
  the print rule keeps the figures about 4.7 inches wide.
- Part 7 (the expansion) and the demos are not started, as the brief says.

## For the Operator

- Questions for the owner: none blocking. The level map shows Levels 1 to 5 only, waiting on his
  approval of Levels 6 to 10.
- The manual is public, so this round waits for the owner's "good" marks (cards `man3-…` on page 2).

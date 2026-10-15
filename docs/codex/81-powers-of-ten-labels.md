# Codex task 81: Powers of ten, two distance labels checked

**Branch:** `codex/powers-labels`, cut from `main`. One draft PR against `main`. Read `AGENTS.md`,
`builders/RULES.md`, CLAUDE.md, `src/powers/stops.js`, and `docs/evidence/powers-of-ten.json`.

## Why

A drawing of the same journey made from OpenStreetMap outlines measured two stops differently from
their labels in `src/powers/stops.js`. Don't take these numbers on trust: check each one yourself.

1. **The National Mall** (stops.js, about line 115) says "about 3.2 km from the Capitol to the
   Lincoln Memorial." The outside measurement between the centers of the two buildings' footprints
   was about 3.6 km. About 3.2 km (two miles) is often given as the length of the Mall itself, so
   the label may name one distance and give another.
2. **Washington, D.C.** (about line 108) says "about 16 km across." Sixteen kilometers (ten miles)
   is each side of the square the District was laid out as; corner to corner is longer.

Three more differ by less and may stay, since each says "about": the Haupt Garden (130 m across),
the chloroplast (3.5 µm long), and the ribosome (20 nm across).

## What to do

- Measure each of the two (for example from OpenStreetMap footprints or a cited survey figure) or
  find a reliable source that states it. Record how you got each number.
- If a label is off, reword it so it says exactly what it measures, with the right number. Change
  every place that repeats it: `docs/evidence/powers-of-ten.json`, `site/toys/powers-of-ten/`
  (rebuild with `node tools/site-build.mjs`), `src/toy-help.js` if it repeats it, and any test.
  Don't change anything a saved link depends on.
- Say in the report whether you'd change any of the other three, and why.

## Done when

Each changed label is backed by a measurement you made or a source you read, the Powers of ten specs
(`pot`, and anything naming `powers-of-ten`), `site`, `help`, and `hta` pass, and a draft PR is
open. The PR body gives the old and new wording of each label and where each number came from, under
Summary, Verification, Deviations, Known issues, and What was cut. This changes a toy the public
sees, so the owner marks it good before the merge.

Before you push: `npx prettier --check .` and `node tools/us-english.mjs --diff` are clean.

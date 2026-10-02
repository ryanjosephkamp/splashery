# Codex task 01: the About audit

**Branch:** `codex/about-audit`, cut from `main`. **Output:** `docs/audits/about-audit-2026-10.md`,
corrected texts in `src/toy-help.js`, and `docs/audits/element-facts.md`.

Every toy has a short "how to play" line and an About text in `src/toy-help.js` (the style guide is
in `docs/handoff/Help.md`). The owner wants them complete and correct before the site goes further:
"I want to make sure that the about sections are complete or sufficient", and for toys like the
Turing machine "we'll need to include some information about … what the different programs mean"
(his review of October 2, 2026, `docs/reviews/2026-10-02-mega-review/review.md`).

1. **Check every toy's texts against the toy itself.** For each toy in `src/toy-help.js`, read its
   recipe (find its id in `src/toys.js` and the pack under `src/packs/`) and check that the how-to
   line and the About text describe what the toy really does: its tap, drags, options, typing and
   views. Flag anything wrong, missing or out of date.
2. **Check the facts.** Check each scientific, historical or technical claim against a reliable
   source you open (an encyclopedia, a textbook, a museum, a standards body, a paper). Flag anything
   wrong or doubtful, with the source.
3. **Check completeness.** An About text should say what the thing is, what the toy shows or means,
   what you can do with it, and a fact or two. Toys with programs, modes or inputs need each one
   explained: start with the Turing machine (its presets "Add one" and the 2- and 3-state Busy
   Beavers), the half adder, the difference engine, the Enigma machine and the Bombe, the AI and
   computing shelf, the math toys and the Lab and Science toys.
4. **Write the report** `docs/audits/about-audit-2026-10.md`: one section per shelf, one line per
   toy ("OK", or what's wrong and why, with the source), then a short summary of the worst problems.
5. **Fix the texts.** In `src/toy-help.js`, rewrite the texts that are wrong or incomplete, in the
   same plain style (Help.md). Change nothing else in `src/`. Run
   `npx playwright test tests/help.spec.mjs tests/unit.spec.mjs` if you can.
6. **Element facts (a proposal, no code).** For each of the 118 elements, two or three short,
   checked facts a curious visitor would enjoy (what it looks like at room temperature, who found it
   and when, a common use, one striking property), each with its source, in
   `docs/audits/element-facts.md`. A Claude lane will later show them in the periodic table.

The Claude lanes and the Operator review every point you raise before anything merges.

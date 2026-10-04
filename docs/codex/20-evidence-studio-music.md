# Codex task 20: is it right? Evidence for Studio, Music and the physics

**Branch:** `codex/evidence-studio-music`, cut from `main`. **Output, and nothing else:** one
`docs/evidence/<toy id>.json` for each toy that needs one, `tests/evidence-studio-music.spec.mjs`
(one new test file), `docs/audits/evidence-studio-music-2026-10.md`, and small fixes to plainly
wrong numbers or labels under `src/` (each one listed in the report with its source).

The owner wants evidence for every toy that claims to show something scientific, mathematical or
technical: "I do not want to hallucinate these things ... Anything that we find that actually isn't
correct, we will have to improve ... in some cases you have to stretch things ... but we need to be
transparent about that." The evidence will show on each toy's page on the site, not in the toy. This
task covers the `studio` and `music` shelves, and the hands-on physics (`src/physics/`). Read
`docs/evidence/README.md` first: it defines the file you write.

## Steps

1. **List the toys.** Every toy on these shelves in `src/toys.js` (labs on, so labs toys count).
   Decide which make claims that can be right or wrong (a model, a simulation, an algorithm, a fact,
   a label). In the report, list the ones you skip and why (a toy that only plays).
2. **Check each claim** in the toy and in its How-to and About texts (`src/toy-help.js`): read the
   code that makes it (give `file:line`), find sources you open (standards, textbooks, papers, NASA,
   NIST, museum or reference pages), and give a verdict as the README says. Where a claim can be
   computed, test it.
3. **Must-checks** for this batch:

- The Chladni plate's patterns against the real modes of a square plate (and the formula it uses).
- The room echo meter's measure (what it computes, and how close to a real reverberation time).
- The Song landscape's and the spectrogram's frequency analysis (the transform and its axes).
- Every instrument's notes: pitch frequencies against equal temperament (or the tuning it claims),
  string and key mapping.
- The hands-on physics: gravity, bounce, friction and the materials' values against the sources in
  docs/audits/ (Codex task 11) and textbook formulas.

4. **Tests.** `tests/evidence-studio-music.spec.mjs` checks every claim that can be computed (an
   algorithm's output against an independent reference, a constant against its source value). It
   must pass on `main`. Never edit `tests/taps.spec.mjs` or any other test file.
5. **Fixes.** Fix in `src/` only a plainly wrong number or label (a wrong constant, a mislabeled
   part), each listed with its source. Anything that changes how a toy looks or moves goes in the
   report as a proposal for a Claude lane, with the evidence.
6. **Evidence files.** One `docs/evidence/<toy id>.json` per checked toy, exactly in the README's
   shape, in plain American English for a curious reader. They must not name any model, agent or
   tool that did the checking.
7. **The report**, `docs/audits/evidence-studio-music-2026-10.md`: a summary of at most ten lines
   (how many toys, claims, verdicts by kind), then a table of every claim that isn't `correct` with
   the evidence and the fix or proposal, then the skipped toys.
8. **Before you push:** the new test file passes on `main`
   (`SPLASHERY_CHROMIUM=<path to Chromium> npx playwright test tests/evidence-studio-music.spec.mjs`),
   and `npx prettier --check .` and `node tools/us-english.mjs --diff` are clean. Open a draft PR
   against `main` titled "Codex task 20: is it right? Evidence for Studio, Music and the physics".

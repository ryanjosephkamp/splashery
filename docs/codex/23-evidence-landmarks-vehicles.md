# Codex task 23: is it right? Evidence for landmarks, vehicles and medieval machines

**Branch:** `codex/evidence-landmarks-vehicles`, cut from `main`. **Output, and nothing else:** one
`docs/evidence/<toy id>.json` for each toy that needs one,
`tests/evidence-landmarks-vehicles.spec.mjs` (one new test file),
`docs/audits/evidence-landmarks-vehicles-2026-10.md`, and small fixes to plainly wrong numbers or
labels in `src/toy-help.js` (each one listed with its source).

The landmark, vehicle and medieval shelves state facts: how tall a tower is, when it was finished,
how a trebuchet throws, how a steam train or a submarine works. None has an evidence file yet
(`docs/evidence/`). Read `docs/evidence/README.md` first: it defines the file you write.

## Steps

1. **List the toys** on the `landmarks`, `vehicles` and `medieval` shelves in `src/toys.js`. Skip
   the ones that only decorate; say which in the report.
2. **Check each claim** in the toy's How-to and About texts (`src/toy-help.js`), its label and tags,
   and any number the toy shows or animates. Find sources you open: the structure's own site, a
   museum, an engineering reference, a national register. Give each verdict as the README says.
3. **Must-checks:**
   - Every height, length, date, builder and place in the landmark texts, against a primary source.
     Where sources disagree (the Great Pyramid's original height, Stonehenge's dating), say so and
     give the range rather than one number.
   - Proportions: does the toy's shape match the real proportions (height to width, number of
     arches, columns, floors)? Measure the toy in the test and compare to the source.
   - Vehicles: wheel counts, wing and rotor layouts, how a steam locomotive's drivers turn, how a
     sailboat's sails and a submarine's ballast work, as a moving part does in the toy.
   - Medieval machines: the trebuchet's counterweight and sling, the crossbow's trigger. Does the
     toy move the way the real one does?
4. **Tests.** `tests/evidence-landmarks-vehicles.spec.mjs` checks each claim that can be computed (a
   built dimension against a source value, within a stated tolerance). It must pass on `main`.
5. **Fixes.** Fix only a plainly wrong number or label in `src/toy-help.js`. Anything that changes
   how a toy looks or moves goes in the report as a proposal for a Claude lane. These shelves are
   closing (CLAUDE.md, "Shelves"): propose nothing that adds a toy.
6. **Evidence files**, exactly in the README's shape, in plain American English, naming no model,
   agent or tool.
7. **The report:** a summary of at most ten lines, a table of every claim that isn't `correct`, then
   the skipped toys.

Needs the web. Before you push: the new test file passes on `main`, and `npx prettier --check .` and
`node tools/us-english.mjs --diff` are clean. Open a draft PR titled "Codex task 23: is it right?
Evidence for landmarks, vehicles and medieval machines".

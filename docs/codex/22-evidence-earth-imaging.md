# Codex task 22: is it right? Evidence for Earth and maps, and Imaging

**Branch:** `codex/evidence-earth-imaging`, cut from `main`. **Output, and nothing else:** one
`docs/evidence/<toy id>.json` for each toy that needs one, `tests/evidence-earth-imaging.spec.mjs`
(one new test file), `docs/audits/evidence-earth-imaging-2026-10.md`, and small fixes to plainly
wrong numbers or labels under `src/` (each one listed in the report with its source).

Tasks 16 to 20 cover computing, math, space, weather, the tiny world, atoms, the body, gems,
science, the Studio and music. These two shelves, `geo` (Earth and maps) and `imaging`, have no
evidence yet (`docs/evidence/` has no file for `grand-canyon`, `st-helens`, `sea-floor`,
`tide-harbor`, `hurricane`, `relief-map`, `living-city`, `stork-migration`, `earthquakes`,
`airport-xray`, `how-ct`, `walnut-ct`, `fruit-mri`, `electron-microscope` or `thermal-camera`). The
owner's rule (October 4, 2026): "I do not want to hallucinate these things ... but we need to be
transparent about [what is stretched]." Read `docs/evidence/README.md` first: it defines the file
you write. Another file in `docs/evidence/` (say `climate-records.json`) shows the style.

## Steps

1. **List the toys** on the `geo` and `imaging` shelves in `src/toys.js` (labs on). Decide which
   make claims that can be right or wrong; list the ones you skip, and why, in the report.
2. **Check each claim** in the toy and in its How-to and About texts (`src/toy-help.js`). Read the
   code that makes it (give `file:line`), open the sources (USGS, NOAA, NASA, NIST, a radiology or
   microscopy reference, the dataset's own page) and give a verdict as the README says.
3. **Must-checks:**
   - Heights, depths, dates and magnitudes in the terrain and earthquake toys against the dataset's
     own numbers (sample points in the test, not by eye).
   - The vertical exaggeration of every relief or terrain toy: stated in the toy? Is it the factor
     the code uses?
   - Tide, storm and migration toys: the data source and date shown beside it match what the code
     loaded; the snapshot's date is true.
   - Imaging toys: the physics they show (X-ray absorption by density, CT slices and windowing, MRI
     contrast, electron wavelengths, thermal color scales) and every unit and scale bar.
4. **Tests.** `tests/evidence-earth-imaging.spec.mjs` checks every claim that can be computed (a
   dataset value against its source, a unit conversion, a scale bar against its pixel size). It must
   pass on `main`. Never edit another test file, `tests/taps.spec.mjs` least of all.
5. **Fixes.** Fix in `src/` only a plainly wrong number or label. Anything that changes how a toy
   looks or moves goes in the report as a proposal for a Claude lane, with the evidence.
6. **Evidence files**, exactly in the README's shape, in plain American English. They must not name
   any model, agent or tool that did the checking.
7. **The report:** a summary of at most ten lines (toys, claims, verdicts by kind), a table of every
   claim that isn't `correct` with the evidence and the fix or proposal, then the skipped toys.

Needs the web. Before you push: the new test file passes on `main`
(`SPLASHERY_CHROMIUM=<path to Chromium> npx playwright test tests/evidence-earth-imaging.spec.mjs`),
and `npx prettier --check .` and `node tools/us-english.mjs --diff` are clean. Open a draft PR
titled "Codex task 22: is it right? Evidence for Earth and maps, and Imaging".

# Lane Manual r6 (prefix `man6`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session,
session_01GX3jNDDvRMLYjDGmHuDmNN). Repo: ryanjosephkamp/splashery. Your lane: Manual r6 (id
`ManualR6`, prefix `man6`). Branch: `claude/lane-manual-r6` from main. PR title: "Phase Manual r6:
the second audit's fixes". Handoff file: docs/handoff/ManualR6.md (create it; start it with this
brief, word for word, under "## Brief", then keep "## State", "## Notes", "## Known issues" and "##
For the Operator" current). Model: Sonnet 5.5, at high effort.

Read CLAUDE.md, docs/HANDOFF.md ("Now"), docs/OPERATING.md, docs/handoff/ScienceR3.md ("How this
lane runs", with your prefix and lane record), then docs/handoff/ManualR5.md and
docs/handoff/ManualR4.md (how the manual, its chapter pages, its demos and its PDF are built).

### Brief (written by the Operator on October 11, 2026; the owner asked for these fixes before the weekly reset)

Codex task 35 audited the Tinkerer's Manual a second time:
docs/audits/manual-audit-2026-10-r2/REPORT.md (merged in #533). Read it whole. Fix, for the right
reason and checked against the code (src/, tools/), every open finding:

1. The 14 new findings R2-F01 to R2-F14 (six medium, eight low): option-key counts that disagree
   (F01), the covariance demo's verdict on trace-zero and indefinite matrices (F02), the projection
   chapter's renderer footprint (F03), the "What Splashery can do" page's stale claims (F04: built
   by tools/site-pages.mjs, page site/learn/can-do/), the budget table's nominal versus actual
   counts (F05) and its generator after the chapter split (F08), the QR capacity range (F06), the
   vendored-library table (F07), the windmill demo's code line (F09), the share demo's invalid-JSON
   state (F10), the error-correction wording (F11), the readback timing (F12), static hosting (F13)
   and external data (F14).
2. Task 34's findings the audit marks partly fixed (F05, F08, F11 of task 34, and F17, F18, F19,
   F22, F28 in its "Other task 34 findings"), so each becomes fixed.

The audit's proposed fixes are recommendations: check each against the code and say in the PR, per
finding, what you changed and why (or why the text was right). Where a number appears in the text,
take it from the code or a measurement, never from memory. Then rebuild the PDF
(tools/manual-pdf.mjs, with the Chromium the tool pins) and check it holds every chapter, figure and
gallery program. American English, the serial comma, and the manual's existing voice.

You own: manual/, tools/manual-_.mjs, the can-do page's source in tools/site-pages.mjs (that page
only), site/ (regenerate it with `node tools/site-build.mjs`, `npx prettier --write site`, then
`node tools/site-build.mjs --check`), and tests/man6_.spec.mjs (add a test for each fixed number or
demo state you can check automatically). Nothing else: no toy code, no engine.

Cards: before-and-after screenshots at 390×844 of each changed demo and of the can-do page on Effect
review page 2 (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK), ids man6-…, naming Sonnet 5.5, as
docs/OPERATING.md, "Steps for a lane", says (no republish). Text-only fixes need no card; list them
in the PR.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (replace the
prefix and lane record with yours). The manual is public, so the Operator merges after your tests
and the owner's "good" marks on your cards. Finish every working turn with "READY:", "WORKING:" or
"BLOCKED:"; Splashery has no CI to wait for; for a long job, schedule a check-in with send_later
instead of going idle. Before READY, run CLAUDE.md's "Before every push" steps for your files
(man\*, site, spg, tpg, st3, smoke). When main moves, merge it into your branch (never rebase).
Usage is tight until the weekly reset (Wednesday, October 14, 2026, 4 p.m. ET): no helpers unless
you must; aim for a first READY within about four hours.

## State

Model: Sonnet 5.5 (claude-sonnet-5-5), high effort. Started October 11, 2026. Branch
`claude/lane-manual-r6`. No helpers used.

All 14 new findings and the task 34 partial ones are fixed in the text, demos, generator, and PDF
(below). Tests: `tests/man6.spec.mjs` (18). The PDF is rebuilt with Chromium 141
(`/opt/pw-browsers/chromium`).

### The audit, finding by finding

| Finding                                             | What I did, and why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R2-F01 option keys (and task 34 F05)                | Counted from the code: `RECIPES["splat-equation"].options` has 16 keys (preset, splats, shade, moments, and the twelve fields), none gated by labs; `normalizeOptions` keeps 16. Both paragraphs in `language.html` now say 16, "already uses all 16", and that labs only hides the toy from the shelf (the audit's recommendation, confirmed).                                                                                                                                                                                                                                                                                                                                                              |
| R2-F02 covariance verdicts (and task 34 F08)        | `covFacts` (`manual/demo-math.js`): `flat` is now only a determinant of zero up to rounding, measured against the matrix's own scale (1e-12 of the largest entry squared); a zero trace no longer means flat. Valid is still a > 0 and det > 0, so diag(1e-10, 1) is valid and "thin" (it was called flat before). The verdict (`demos.js`) now has three not-valid sentences: determinant 0; one positive and one negative eigenvalue (the audit's a = 0.1, c = -0.1); both negative. The readout line under the eigenvalues matches.                                                                                                                                                                       |
| R2-F03 renderer footprint (and task 34 F11)         | Read the vendored shader (`vendor/playcanvas/playcanvas.min.mjs`, "float detOrig"): the opacity compensation (`aaFactor`) is inside `#if GSPLAT_AA`; the `+ 0.3` on both diagonal entries and the `max(mid - radius, 0.1)` floor come after `#endif`, so they are unconditional. `src/sharpness.js` says the anti-aliasing option is off by default and a labs switch. Text in `splat.html` now says exactly that (and that the cull skips splats under about 2 pixels); the demo's legend says "before the renderer's extra blur" and the hint says the demo leaves the 0.3 px² out. Still image `demo-projection.png` retaken. The audit was right; the previous text called the always-on blur an option. |
| R2-F04 can-do page (and task 34 F17, F18, F19, F28) | The page's text lives in `tools/site-hubs.mjs` (function `can`), not `tools/site-pages.mjs` (which only lists the page); I edited only that function. "Every toy plays this way" is now "Most toys" with the opt-in and opt-out rules (`handsOn === false`, `handsLevel1`); fluids say four splats a particle on the page's path, a smooth surface on WebGPU, a grid for gases and flames; live input says nothing is recorded unless you ask, with the Record exception; Worlds says Splashery is primarily splat based but not only (Sharp view); the budget sentence is the manual's. Regenerated `site/`.                                                                                                |
| R2-F05 budget counts                                | The counts are base budgets. `splatBudget` asks for `min(maxCount, defaultCount × density)`: the density-2 toys (American football, hockey puck, marble) were asked for 240,000 and 300,000 at the Mid and High base budgets. `toy.html` says so; the generator (`build-budget.mjs`) now puts the document's actual counts (its "Splats at 60k → 400k" column) under each toy's name and labels the column and summary "base budget". `unique.html` no longer says a recipe "becomes 60,000 to 400,000 splats". The audit's recommendation, with the actual counts kept as it suggested.                                                                                                                     |
| R2-F06 QR range                                     | Measured with `shareCode` on the live base: 667 to 711 characters is version 21 at M, 712 to 779 is version 22, 780 starts 23 (the audit's 711/712 confirmed). I also swept all 461 catalog entries (scene made with `createScene`, `normalizeScene`, `encodeSceneHash`, seed 999999, the live base): 696 to 714 characters, 457 at 21/M and 4 at 22/M. The text now says about 690 to 715, up to 711 fits version 21, and a few toys (depending on the seed) are version 22. The 692 to 714 of the QR lane was right as a range; its "version 21" was not.                                                                                                                                                  |
| R2-F07 vendor table                                 | "Copied in unchanged" was wrong for four libraries (LICENSES.md records them: gifenc's source-map comment, omggif's and laz-perf's comments and export line, qrcodegen compiled from TypeScript). Now "as they were published", naming the kinds of change. qrcodegen's row adds Save PDF (`src/pdf-export/pdf.js`). jsQR's row separates who asks for it (the QR toy, Save PDF's check with `native: false`) from the scene-code dialog's native-first fallback (`src/qr/scan.js`).                                                                                                                                                                                                                         |
| R2-F08 generator                                    | `manual/build-budget.mjs` reads and writes `toy.html` (header and error message too). Test runs it, runs Prettier, and checks the file is unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| R2-F09 windmill                                     | The readout counts the lit splats whose part is the sails part (the same `partOf` the shader uses): all of them turn (hub, blades, sails), none stay (tower, cap), a mix says how many. The dashed axis shows whenever something lit turns.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| R2-F10 share demo                                   | Invalid JSON hides the old QR code, clears the remembered good link (so "Change one character" has nothing to change) and the note says there is no QR code.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| R2-F11 error correction                             | The text says the percentage is about codewords (8 squares each), not any 15 percent of the squares, and that damage to the three finder squares or spread over many blocks can defeat a code. (Reed-Solomon per block, `vendor/qrcodegen`.)                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| R2-F12 readback                                     | The dialog shows the code at once with "Checking that it scans…" and the check starts after it opens (`src/qr/share.js`); the text says that, and that "It scans" is one reader on one drawing, not every phone camera.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| R2-F13 static hosting                               | "Cannot go down because a server did" is now "has no application server of its own that could fail", with the host (GitHub Pages today) and the network named as what is still needed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| R2-F14 external data                                | The runtime fetches are the Wikipedia book, the earthquake feed (with its snapshot) and the PDB fetch by code. The stork migration reads `assets/toys/stork-migration/migration.bin` (shipped); its outside download is `tools/geo-migration.mjs`. Text says so.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Task 34 F22 (PDF reproduction)                      | The Chromium major was already pinned and two builds match. What was left was fonts: the PDF embeds the machine's fonts for `ui-sans-serif`, the serif, mono, and emoji stacks. The shipped PDF's families (DejaVu Sans, DejaVu Sans Mono, Inter, Liberation Sans, Liberation Serif, Noto Color Emoji) are now listed in `tools/manual-pdf.mjs` (`PINNED_FONTS`); a build that embeds another set stops unless `--allow-other-fonts`. A test checks the shipped PDF against the list. Exact cross-machine bytes still need the same fonts; the tool now says when they differ.                                                                                                                               |

## Notes

- Rebuild order after any change: `node manual/build-budget.mjs` (if the budget document changed),
  `npx prettier --write manual`, `node manual/build-pages.mjs`, the stills if a demo changed
  (`ONLY=projection node manual/make-stills.mjs`), then
  `SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/manual-pdf.mjs` (needs the local server),
  then `node tools/site-build.mjs`, `npx prettier --write site`,
  `node tools/site-build.mjs --check`.
- The covariance, windmill, and share stills show states whose text did not change, so only
  `demo-projection.png` was retaken.

## Known issues

- The libraries table and the budget table scroll sideways inside their own boxes at 390 px (no page
  scroll).

## For the Operator

- Tests (October 11, 2026): man\*, site, spg, st3, tpg and smoke specs, 211 tests: 210 passed;
  `man5` "same bytes" failed once while I was taking screenshots at the same time, and passed alone
  (it also checks the shipped PDF against a fresh print). `tests/man6.spec.mjs`: 18 passed. Prettier
  and `us-english.mjs --diff` clean; `site-build.mjs --check` current.
- Cards: six before-and-after cards on Effect review page 2, lane `ManualR6` (I created the lane
  record, since none existed): `man6-covariance`, `-projection`, `-windmill`, `-share-invalid`,
  `-budget`, `-can-do`. Waiting for the owner's marks.

- The can-do page's text is in `tools/site-hubs.mjs` (`can`), not `tools/site-pages.mjs`; I edited
  only that function.

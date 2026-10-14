# Codex task 13: the Tinkerer's Manual, audited for a newcomer

**Branch:** `codex/manual-audit`, cut from `main`. **Output, and nothing else:**
`docs/audits/manual-audit-2026-10.md` and its images in `docs/audits/manual-audit-2026-10/`, plus
small fixes to plain factual errors in `manual/index.html` (each one listed in the report).

The Tinkerer's Manual (`manual/index.html`, its figures in `manual/img/`, the examples
`manual/example-*.js` and the PDF `manual/tinkerers-manual.pdf`; public at
https://ryanjosephkamp.github.io/splashery/manual/) explains how Splashery's splats work and how a
toy is written. Lane Learn last audited it on September 29, 2026 (`docs/handoff/Learn.md`). Since
then the site gained a lot (hands-on physics, QR codes, photoreal captures, live input, books and
pictures). The owner wants to show it to a computer science professor who is new to Gaussian splats,
so it must be true, current and readable for that reader.

## Steps

1. **Read** `manual/index.html` and the examples, `docs/handoff/Learn.md`, `docs/handoff/Manual.md`,
   `docs/PACKS.md` (how recipes are written) and the parts of `src/` the manual describes.
2. **True and current.** Check every claim, number, code sample and figure against the code on
   `main` (give `file:line` for each check). Run each example file the way the manual says to, and
   say whether it still works. Check every link. List each problem in a table: where, what it says,
   what is true now, evidence, and the fix.
3. **For a newcomer.** Read it as a computer scientist who knows graphics basics but not Gaussian
   splatting. Where would they get lost? Propose (don't write into the manual) a short glossary, any
   missing figure, a "what is a 3D Gaussian" section if needed, and a short "further reading" list
   with real, opened sources: the original paper (Kerbl, Kopanas, Leimkühler and Drettakis, "3D
   Gaussian Splatting for Real-Time Radiance Field Rendering", SIGGRAPH 2023) and the few most
   useful follow-ups, each with its link and one line on why it matters.
4. **What's missing from the manual** that the site now does (a list, one line each, with the docs
   or code that describe it).
5. **Fix** only plain factual errors directly in `manual/index.html` (a wrong number, a dead link, a
   renamed file); list each one. Leave new sections, rewrites and the PDF to a Claude lane: say
   whether the PDF needs regenerating and what changed.
6. **The report:** a summary of at most ten lines, then the tables above. American English, plain
   words.
7. **Before you push:** `npx prettier --check .` and `node tools/us-english.mjs --diff` are clean.
   Open a draft PR against `main` titled "Codex task 13: the Tinkerer's Manual, audited for a
   newcomer".

# Codex task 36: the whole Tinkerer's Manual, audited a third time

**Start only when `main` contains Manual r7a (#545) and Manual r7b (#542).** Check with
`git log --oneline origin/main | grep -E "#54[25]"`; if either is missing, stop and say so.

**Branch:** `codex/manual-audit-r3`, cut from `main`. **Output, and nothing else:**
`docs/audits/manual-audit-2026-10-r3/REPORT.md` and its images in the same folder. Make no edits to
the manual or the site: a Claude lane fixes what you find.

The Tinkerer's Manual (`manual/*.html`, one page per chapter, built and checked by
`manual/pages.mjs` and `manual/build-pages.mjs`; its demos in `manual/demo*.js`, `manual/crisp.js`
and friends; its figures in `manual/img/`; the PDF `manual/tinkerers-manual.pdf`, printed by
`tools/manual-pdf.mjs`; public at https://ryanjosephkamp.github.io/splashery/manual/) explains how
Splashery's splats work and how a toy is written. Codex tasks 34 and 35 audited it
(`docs/audits/manual-audit-2026-10-r2/REPORT.md` is the second report); Manual r6 fixed task 35's
findings. Since then two lanes added a lot: crisp demos on phones, a moving torus figure, pictures
and a diagram (Manual r7a, `docs/handoff/ManualR7a.md`), and Chapters 6 to 10, a larger glossary,
Further reading, References and the Quick reference (Manual r7b, `docs/handoff/ManualR7b.md`). The
owner wants the manual true, current and finished before his single rewording pass.

## Steps

1. **Read** every manual page, `docs/handoff/ManualR6.md`, `ManualR7a.md` and `ManualR7b.md`,
   `docs/PACKS.md`, and the parts of `src/` and `tools/` each chapter describes.
2. **Earlier findings.** For each finding in the r2 report, say whether it is still fixed, with
   evidence.
3. **True and current, every page.** Check every claim, number, code sample, figure and caption
   against the code on `main` (give `file:line` for each check). Chapters 6 to 10 are new: check
   them line by line, including which toys are behind the labs switch, every toy link (it opens the
   right toy in the Playground), and every number. List each problem in one table: where, what it
   says, what is true now, evidence, severity (high, medium or low), and the proposed fix.
4. **Sources.** Open every entry in Further reading and References. Check the title, authors, year,
   venue and link, and that each in-text citation points at the right entry. List every mismatch.
5. **Demos and figures.** Open every demo and live figure at 390×844 with a device scale factor of
   3, and at 1440×900. Check that text, axes and lines are as sharp as the page text, that controls
   work, that the Chapter 1 size sliders run from 0 to 1.60 starting at 0.80, and that the moving
   torus respects reduced motion. Save a screenshot of each at both sizes.
6. **The glossary and the Quick reference.** Every term a newcomer meets in Chapters 1 to 10 is in
   the glossary, and each definition is correct. Every number in the Quick reference matches the
   code.
7. **The Learn pages that restate the manual** (the site's How 3D Gaussian splats work, What
   Splashery can do, How Splashery is made, Embed and share, and the others listed under "For the
   Operator" in `docs/handoff/SiteR5.md`): list where each one now differs in substance from the
   manual (facts, numbers, claims; not wording).
8. **The PDF.** Is it current with the web pages (every chapter, figure and gallery program, no
   localhost links, live figures as stills)? Say what changed since the last build.
9. **Navigation and links.** Every internal link and anchor resolves (old anchors such as
   `coming.html#moving` and `#level-2` style links still land); every external link loads; every
   link from the manual opens in a new tab; the footer's "Splashery" opens the site's home page.
10. **The report:** a summary of at most ten lines (counts by severity), then the tables above.
    American English, plain words, the serial comma.
11. **Before you push:** `npx prettier --check .` and `node tools/us-english.mjs --diff` are clean.
    Open a draft PR against `main` titled "Codex task 36: the whole Tinkerer's Manual, audited a
    third time".

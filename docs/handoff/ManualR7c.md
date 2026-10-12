# Lane Manual r7c (prefix `man7c`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session,
session_01BbS2vUAWpeFF2i6KoJAqCt). Repo: ryanjosephkamp/splashery. Your lane: Manual r7c (id
`ManualR7c`, prefix `man7c`). Branch: `claude/lane-manual-r7c` from main. PR title: "Phase Manual
r7c: the manual's link, sample and size tests green again". Handoff file: docs/handoff/ManualR7c.md
(create it; start it with this brief, word for word, under "## Brief", then keep "## State", "##
Notes", "## Known issues" and "## For the Operator" current). Model: Sonnet 5.5, at high effort.

Read CLAUDE.md, docs/HANDOFF.md ("Now"), docs/handoff/ScienceR3.md ("How this lane runs"), then
docs/handoff/ManualR7a.md and ManualR7b.md (merged together on October 12, 2026, in Ops #556, with
the PDF rebuilt by the Operator).

### Brief (written by the Operator on October 12, 2026)

Three tests in `tests/ln.spec.mjs` fail on main since #556 (the Operator's merge didn't run that
file; its mistake). Make them pass for the right reason, changing as little as possible:

1. **ln:136** ("each JavaScript sample is a piece of a file in manual/ that builds"): it expects 4
   samples, and the manual now has 5. Find the new one. If it is meant to be there (r7a or r7b added
   it on purpose), make sure it really is a piece of a manual/ file that builds, and update the
   count. If it isn't, fix the page.
2. **ln:240** ("every local link, picture and anchor is there…"): the external links are checked
   against a list of known sites, and r7b's longer Further reading and References add new ones (the
   first is https://arxiv.org/abs/2312.02126). Open every new external link, check that it leads
   where its text says (the right paper or project, by the right authors), and add each one to the
   list as narrowly as the list does now. Any dead or wrong link: fix it on the page.
3. **ln:333** ("the PDF is printed from this page, and has its pages"): the PDF is 12.1 MB
   (`manual/tinkerers-manual.pdf`), and the test wants under 8 MB. The new chapters and pictures
   made it bigger. First try to bring it under 8 MB with no visible loss at print size (for example,
   smaller print copies of the r7a and r7b pictures through the print styles, or pictures
   recompressed). If you can't without visible loss, say how small it gets, set the bound just above
   it with a comment that gives the reason, and keep the file under 20 MB (D4 in
   `builders/RULES.md`). Rebuild the PDF with `tools/manual-pdf.mjs` (Chromium 141 is pinned;
   `SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium`), so `man5`'s byte-for-byte test stays green.

No wording changes (the owner holds all rewording until after the manual's final audit, Codex task
36). You own `tests/ln.spec.mjs` for these three tests, the manual's pages and print styles as far
as items 1 to 3 need, `manual/tinkerers-manual.pdf`, and your handoff file. Specs to run before
READY: ln, man, man2, man3, man3-2, man4, man4-pages, man5, man6, man7a, man7b, st2, site, spg.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (replace the
prefix and lane record with yours). These are test and print fixes with no visible change on the web
pages, so no cards are needed; if a picture in the PDF changes visibly, post one before-and-after
card of a PDF page on Effect review page 2 (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK), id
man7c-pdf, naming Sonnet 5.5. Finish every working turn with "READY:", "WORKING:" or "BLOCKED:" (the
Operator reads it; never ask the owner). Before READY, run CLAUDE.md's "Before every push" steps for
your files. When main moves, merge it into your branch (never rebase). Usage is tight until the
weekly reset (Wednesday, October 14, 2026, 4 p.m. ET): no helpers; aim for READY within about two
hours. The owner's own notes are private: never quote them in the repo, a PR or a card.

## State

Model: Sonnet 5.5 (claude-sonnet-5-5), high effort. October 12, 2026.

1. **Samples (ln:136)**: the fifth block is the Card's "A recipe (a toy)" grammar sketch
   (`export const RECIPES = { "my-toy": {…`, added by r7b on purpose). It has placeholders
   (`key, label, type`), so it is not a piece of a file and is not meant to build. The test now
   skips that one block by its first line and still expects the four real samples.
2. **Links (ln:240)**: 31 external links were off the list. All were opened or checked at their
   source: 16 arXiv papers (the API's title and authors match the page's text for each), three DOIs
   (Berman et al., PDB 2000; Müller et al., rigid bodies, 2020; Reed and Solomon, 1960), six GitHub
   projects (Brush, antimatter15/splat, Splat.js, gsplat, SuperSplat, Spark, and the Khronos
   KHR_gaussian_splatting page, which says "Ratified"), and the USGS GeoJSON feed, HYG, JPL, Nayuki
   and PDF.js pages. No dead or wrong link. Each is on the list as an exact URL, or an arXiv `abs/`
   id pattern and the four DOI prefixes.
3. **PDF size (ln:333)**: 12.1 MB down to 7.0 MB, under the 8 MB bound, so the bound stays. Chromium
   printed every PNG and WebP picture as lossless Flate (8.7 MB); `tools/manual-pdf.mjs` now swaps
   each for a JPEG at quality 0.92 before printing (the 61 gallery thumbnails with transparency are
   flattened onto the flat color behind them first). The web page is unchanged. 148 pages, as
   before; pages 54 and 116 compared before and after, no visible difference.

## Notes

- The PDF still rebuilds byte for byte (same Chromium 141, same fonts).
- Needs `npm ci` first in a fresh container.

## Known issues

None new.

## For the Operator

READY after the specs in the brief pass; see the PR for the list.

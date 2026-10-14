# Codex task 47: the Tinkerer's Manual, audited a fourth time (the third audit's fixes)

**Start only when `main` contains Manual r8 (#571).** Check with
`git log --oneline origin/main | grep "#571"`; if it is missing, stop and say so.

**Branch:** `codex/manual-audit-r4`, cut from `main`. **Output, and nothing else:**
`docs/audits/manual-audit-2026-10-r4/REPORT.md` and its images in the same folder (keep the folder
under 5 MB). Make no edits to the manual or the site: a Claude lane fixes what you find.

Task 36 (`docs/audits/manual-audit-2026-10-r3/REPORT.md`) found 48 problems in the Tinkerer's Manual
(`manual/`, public at https://ryanjosephkamp.github.io/splashery/manual/) and the Learn pages that
restate it. Manual r8 (`docs/handoff/ManualR8.md`, PR #571) fixed 43 of them and left 5 wording-only
items for the owner. This audit checks that work before the owner's own rewording pass. It is
narrower than task 36: check what changed, not the whole manual again.

## Steps

1. **Read** the r3 report, `docs/handoff/ManualR8.md` (its "Changed sentences" table and "For the
   owner's rewording pass") and the diff of #571
   (`git diff 097ca436..d5039103 -- manual site tools docs/SCENE-SCHEMA.md docs/FLUIDS.md src/equation-gallery.json`).
2. **Each r3 finding:** fixed, partly fixed, not fixed, or left for the owner (as r8 says), with
   evidence (`file:line` and the code or text that proves it). One table.
3. **Each changed sentence** in the handoff's table: is the new sentence true against the code on
   `main` (`file:line`)? Did the change introduce a new error, contradict another page (the manual,
   the Quick reference, the glossary, or a Learn page), or break a link or anchor?
4. **The code and stills r8 changed:** the new-tab rule for links (F41: every link opens in a new
   tab, including same-page `#x` links; say whether that hurts the contents button, the pager or the
   citations on a phone), the old anchor aliases (F42), the demo fixes (F05), and the five
   regenerated stills (F09, F24 to F27: does each picture now show what its caption and alt text
   say?). Open each affected page at 390×844 (device scale factor 3) and at 1440×900, and save a
   screenshot of each.
5. **The PDF:** rebuilt by r8. Is it current with the web pages (the changed sentences, the stills,
   working links)?
6. **Anything else new since task 36** in `manual/` or the Learn pages
   (`git log 967fff95..origin/main -- manual site`): check it the same way.
7. **The report:** a summary of at most ten lines (counts by severity: high, medium or low), then
   the tables. American English, plain words, the serial comma.
8. **Before you push:** `npx prettier --check .` and `node tools/us-english.mjs --diff` are clean.
   Open a draft PR against `main` titled "Codex task 47: the Tinkerer's Manual's third-audit fixes,
   audited".

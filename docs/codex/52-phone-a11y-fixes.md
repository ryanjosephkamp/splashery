# Codex task 52: the phone and accessibility audit's fixes

**Branch:** `codex/phone-a11y-fixes`, cut from `main`. One draft PR against `main`.

Task 04 (`docs/audits/phone-a11y-2026-10.md` and its folder) audited the public site at phone size,
by keyboard and with a screen reader. Fix what it found that is still true on today's `main`.

## Goal

1. Re-check each finding on `main` first; mark each still true, already fixed, or not reproducible.
2. Fix the true ones in order of severity: tap targets at least 44×44 px; labels and roles on every
   control; visible focus; keyboard reach to every control and dialog (and Escape out); contrast at
   WCAG AA in both themes; reduced motion respected; text that doesn't clip at 390 px wide or at
   200% zoom.
3. No visual redesign: keep the look the owner approved; where a fix must change what people see,
   show before and after at 390×844 and 1440×900.
4. Add `tests/cdx-a11y*.spec.mjs` (axe-style checks the repo can run with Playwright alone, no new
   dependency unless listed in `LICENSES.md`), and keep `smoke`, `taps`, `site`, `spg`, `help` and
   `unit` green. Never edit `tests/taps.spec.mjs`.

## Don't touch

`manual/` (a lane owns it now), and the files of the open PRs (#560, #562, #566, #570, #576).

## Report

Update the audit with a "Fixed in task 52" column, and put before-and-after screenshots in its
folder (under 5 MB). Before you push: `npx prettier --check .` and
`node tools/us-english.mjs --diff` are clean.

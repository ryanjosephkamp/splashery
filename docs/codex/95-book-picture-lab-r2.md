# Codex task 95: Your book and the Picture lab, sharper and smoother (a 12-hour Goal run)

**Branch:** `codex/book-picture-lab-r2`, cut from `main` after PR #665 (lane Fix13: Pop out with
Pop-up layers) has merged; if it hasn't, cut from `main` and merge `main` again once it has. One
draft PR against `main`. Clips go on `codex/book-picture-lab-r2-clips`, never merged. Read
`AGENTS.md`, `builders/RULES.md`, CLAUDE.md's "Effect quality rules",
`docs/studio/your-book-checkpoint.md`, `docs/studio/picture-lab-checkpoint.md`,
`docs/studio/photo-album-checkpoint.md`, and `docs/handoff/Fix13.md`.

## Why

The owner loves Your book and the Picture lab and wants to push them further, as Photo to 3D and
Video to 3D were pushed. Whatever works here should then carry over to the Photo album.

## Part 1: measure (do this first)

A small benchmark, `tools/pages-bench.mjs`: open each toy with its samples and with three of your
own (a text-heavy PDF page, a photo, a chart), at the phone profile (390×844) and the desktop
profile, and record time to the first page, page-turn frame rate, memory, and text sharpness against
the source picture (an edge measure and SSIM on a crop of body text). Write the baseline in
`docs/audits/pages-r2-2026-10.md`.

## Part 2: the Goal (Goal mode: keep going until all hold, up to 12 hours)

Against `main`, on the benchmark:

1. **Text you can read at phone size:** body text on a page is legible at 390×844 (the sharpness
   measure up by at least 30%, SSIM up by at least 0.03), with no blur or speckle (CLAUDE.md's
   effect rules).
2. **Smooth page turns:** the turn holds at least main's frame rate on the phone profile, and a page
   moves as one solid sheet.
3. **Pop-up layers and Pop out** look right for photos, charts, diagrams, and text: each layer rises
   cleanly, with hard edges, and Pop out works with layers on and off (keep Fix13's test passing).
4. **No slower:** time to the first page and memory no worse than main's.
5. **Then the Photo album:** apply what worked to it where it carries over cleanly, measured the
   same way; skip what doesn't and say why.
6. **No regressions:** every existing spec passes. Never lower a threshold, skip, or remove a test.
7. **Side by side:** phone-size clips of main and this round for each toy, on the clips branch.

If a target can't be met in 12 hours, stop with what holds, revert what doesn't, and say what you
tried and what you'd try next.

## Rules

Only these toys' files (`src/packs/pictures.js` and the book and album code the checkpoint docs
list, their tools, and their tests); engine changes in their own "Engine:" commit. Images in the PR
at most 1 MB each. American English and the serial comma. Before you push: `npx prettier --check .`
and `node tools/us-english.mjs --diff` are clean. The full suite runs on the Operator's merge PR. PR
body with Summary, Verification, Deviations, Known issues, and What was cut.

# Codex task 93: Photo to 3D, round 5: fix what the failure atlas found (a 12-hour Goal run)

**Branch:** `codex/photo-3d-r5`, cut from `main`. One draft PR against `main`. Review clips and
pictures go on `codex/photo-3d-r5-clips`, never merged. Read `AGENTS.md`, `builders/RULES.md`,
CLAUDE.md's "Effect quality rules", `docs/studio/photo-3d-checkpoint.md`,
`docs/audits/photo-3d-failures-2026-10.md` (task 87's atlas of 118 inputs), and
`docs/audits/photo-3d-r4-2026-10.md`.

## Why

Photo to 3D is the owner's favorite toy and close to perfect on the samples. Task 87 measured where
it still fails on real photos and ranked the failures. This round fixes the worst of them, without
losing anything the checkpoint has. **Every change must beat the checkpoint, or it is reverted.**

## Part 1: choose the targets (do this first, then start the Goal)

From the atlas, pick the three failure classes that cost the most (by count times severity). For
each, write in the PR body: what goes wrong, on which inputs, the atlas score, and your plan.

## Part 2: the Goal (Goal mode: keep going until all hold, up to 12 hours)

Measured with task 87's finder (`tools/p3d-failures.mjs` and its calibrated scores) on all 118
inputs, plus the checkpoint's 49 paired clips:

1. **The three classes improve:** each class's mean score improves by at least 25%, and no input in
   them gets worse.
2. **Nothing else gets worse:** every other atlas input scores the same or better (within the
   finder's own noise, which you measure and report), and the 49 checkpoint clips are the same or
   better side by side.
3. **No slower on a phone:** time to the first 3D view and memory, on the phone profile, no worse
   than `main` (median and worst).
4. **The Sharp view** keeps working for every input, at both profiles.
5. **Every existing spec passes.** Never lower a threshold, skip, or remove a test.
6. **Side by side:** phone-size clips of the checkpoint and this round for the ten most improved
   inputs and the five least, on the clips branch, linked from the PR.

If a target can't be met in 12 hours, stop with what holds, revert what doesn't, and say exactly
what you tried and what you'd try next.

## Rules

Only the Photo to 3D files listed in the checkpoint doc, plus new tools and tests; any shared change
(the relief, the depth engine, the splat shader) in its own "Engine:" commit, and it must leave
Moving photo to 3D and the Splat mirror unchanged or better (run their specs). Images in the PR at
most 1 MB each. American English and the serial comma. Before you push: `npx prettier --check .` and
`node tools/us-english.mjs --diff` are clean. The full suite runs on the Operator's merge PR. PR
body with Summary, Verification, Deviations, Known issues, and What was cut.

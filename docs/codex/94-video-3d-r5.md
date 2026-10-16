# Codex task 94: Video to 3D, round 5: close task 88's open goals, then sharper (a 12-hour Goal run)

**Branch:** `codex/video-3d-r5`, cut from the head of `codex/video-3d-r4` (PR #655, task 88), then
merge `main` into it. One draft PR against `main`; it replaces #655, which the Operator closes once
this PR is open. Clips and bakes go on `codex/video-3d-r5-clips`, never merged. Read `AGENTS.md`,
`builders/RULES.md`, CLAUDE.md's "Effect quality rules", `docs/codex/88-video-3d-real-clips.md`,
#655's body and its last report ("final real-clip evidence and unmet gates"),
`docs/audits/video-3d-r4-2026-10.md`, and `docs/studio/video-3d-checkpoint.md`.

## Why

Task 88 built a 20-clip real-world benchmark and ran a 12-hour Goal, and some of its gates were not
met. The owner thinks Video to 3D looks outstanding and can get better still. This round finishes
88's goals and pushes further.

## The Goal (Goal mode: keep going until all hold, up to 12 hours)

Measured with task 88's benchmark (`tools/v3d-bench.mjs`) on the 20 corpus clips and the six
samples, at the phone and desktop profiles, against `main`:

1. **Every gate task 88 left unmet now holds** (list each in the PR with before and after numbers).
2. **Sharper:** the corpus median sharpness at least 1.5 times main's, and SSIM up by at least 0.03,
   at both profiles (task 88's targets; keep them if 88 already passed them, and improve by a
   further 10%).
3. **No slower on a phone:** time to the first 3D view and total bake time no worse than `main`'s
   (median and worst).
4. **Never fails:** every corpus clip finishes, or the toy says clearly why it can't and what to
   try.
5. **No regressions:** the six samples keep their gains, and every existing spec passes. Never lower
   a threshold, skip, or remove a test.
6. **Side by side:** phone-size clips of `main` and this round on the same camera path for ten
   corpus clips, on the clips branch.

If a target can't be met in 12 hours, stop with what holds, revert what doesn't, and say what you
tried and what you'd try next.

## Rules

Only the Video to 3D files (`src/video3d/`, its pack, its samples, its tools, and its tests); engine
changes in their own "Engine:" commit. Images in the PR at most 1 MB each. American English and the
serial comma. Before you push: `npx prettier --check .` and `node tools/us-english.mjs --diff` are
clean. The full suite runs on the Operator's merge PR. PR body with Summary, Verification,
Deviations, Known issues, and What was cut.

# Codex task 88: Video to 3D on real clips, then sharper (a long Goal run)

**Branch:** `codex/video-3d-r4`, cut from `main`. One draft PR against `main`. Clips, bakes, and
review media go on `codex/video-3d-r4-clips`, never merged. Read `AGENTS.md`, `builders/RULES.md`,
CLAUDE.md, `docs/codex/55-video-3d-clarity.md`, `docs/audits/video-3d-r2-2026-10.md`, and the Video
to 3D checkpoint doc under `docs/studio/` if it is on `main`.

## Why

Task 55 (merged through Ops #621) made every Video to 3D sample measurably sharper. The owner says
the results look more promising than ever, but still not sharp enough, and he wants to know how it
does on clips people really bring, not only on the samples: does it load fast enough, does it ever
fail, and how sharp is it.

## Part 1: a real-clip benchmark (do this first)

1. **A corpus of 20 short clips** (5 to 20 seconds) under licenses the site allows (CC0, CC BY, CC
   BY-SA, or public domain; Wikimedia Commons is a good source), chosen to cover what people film:
   walking around an object, a room, a street, a plant, a pet, a statue, a phone held still, a shaky
   phone, low light, and a fast pan. No people as the subject. Keep the clips on the clips branch;
   on `main`, only a manifest (`tools/v3d-corpus.json`: source page, license, author, duration,
   checksum).
2. **A runner,** `tools/v3d-bench.mjs`, that opens each clip in the toy the way a person would and
   records, at the phone profile and the desktop profile: time to the first 3D view, total bake
   time, peak memory, whether it finished, and sharpness and SSIM on held-out frames (the same
   measures task 55 used).
3. **A report,** `docs/audits/video-3d-r4-2026-10.md`: a table per clip, the failures with their
   cause, and phone-size clips of the five worst and five best.

## Part 2: the Goal (Goal mode: keep going until all hold, up to 12 hours)

Measured on the corpus and the six samples, against `main`:

1. **Sharper on real clips:** the corpus median sharpness at least 1.5 times main's, and SSIM up by
   at least 0.03, at both profiles.
2. **No slower on a phone:** time to the first 3D view and total bake time no worse than main's on
   the phone profile (median and worst).
3. **Never fails:** every corpus clip finishes, or the toy says clearly why it can't (too long, too
   dark, too little movement) and what to try.
4. **No regressions:** the six samples keep task 55's gains, and every existing spec passes. Never
   lower a threshold, skip, or remove a test.
5. **Side by side:** phone-size clips of main and this round on the same camera path for ten corpus
   clips.

## Rules

Only the Video to 3D files (`src/video3d/`, its pack, its samples, and its tests); engine changes in
their own "Engine:" commit. Images in the PR at most 1 MB each. American English and the serial
comma. Before you push: `npx prettier --check .` and `node tools/us-english.mjs --diff` are clean.
On your PR, GitHub Actions runs the quick checks; the full suite runs on the Operator's merge PR (or
on yours when the Operator adds the `full-suite` label). PR body with Summary, Verification,
Deviations, Known issues, and What was cut.

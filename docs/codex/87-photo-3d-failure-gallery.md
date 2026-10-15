# Codex task 87: Photo to 3D, where it still fails (a ranked gallery, no change to the toy)

**Branch:** `codex/photo-3d-failures`, cut from `main`. One draft PR against `main` with the tool,
its tests, and the report. Pictures, clips, and the gallery page go on
`codex/photo-3d-failures-clips`, never merged. Read `AGENTS.md`, `builders/RULES.md`, CLAUDE.md,
`docs/studio/photo-3d-checkpoint.md`, `docs/codex/76-photo-3d-r4.md`, and PR #622's audit (round 4).

## Why

Round 4 (#622) made Photo to 3D faster and leaner, but its pictures are byte-identical to the
checkpoint: the attempts at a better background fill and cleaner thin parts didn't beat it and were
reverted. Before another long round, the owner wants the failures named and ranked, so the next goal
targets what he actually sees. This task measures and shows; it changes nothing in the toy.

## The work

1. **A failure finder,** `tools/p3d-failures.mjs`. For each input it builds the 3D view the way the
   toy does (the same pack and settings as `main`), renders the phone profile (390×844, device scale
   factor 3) and the desktop profile at the front and at ±20° and ±30°, and scores each view:
   - **Revealed-area streaks:** in areas the turn reveals behind a foreground object, how much
     stronger the directional streaking is than in the visible background nearby (the measure task
     76 asked for).
   - **Holes:** the share of revealed pixels with no coverage.
   - **Edge halos and fringes:** color bleeding across depth edges, and fraying along thin parts
     (stems, hair, wires, leaf edges).
   - **Depth mistakes:** where reference depth exists (Codex task 56's ground-truth scenes), the
     error against it; elsewhere, flipped or flattened regions found by checking the depth map's
     order against strong image cues.
   - **Speed and memory:** time to the first 3D frame and peak memory on the phone profile.
2. **The inputs:** every Photo to 3D sample, the 20 hard-case samples, task 56's ground-truth
   scenes, and 30 more freely licensed photos you choose to cover what people really open (portraits
   are out: no people; pets, food, plants, rooms, streets, objects on tables, close-ups, night
   shots, and pictures with thin parts and strong depth jumps). Record each photo's source and
   license in the report, and keep the photos on the clips branch, not on `main`.
3. **Your own photos, privately:** `node tools/p3d-failures.mjs --in <folder> --out <folder>` runs
   the same scoring on any folder on the owner's Mac and writes the gallery there; nothing from that
   run is committed or uploaded. Put the exact steps in the report.
4. **The gallery,** one static page on the clips branch: every input as a row (the photo, the front
   view, and the worst angle, with the score badges), sorted worst first, with filters per failure
   type, at phone size and desktop size.
5. **A short report,** `docs/audits/photo-3d-failures-2026-10.md`: the ten worst failure patterns,
   each with three examples, how often it happens across the inputs, which stage causes it (depth,
   edge handling, fill, splat sizing, sorting), and the measure a round 5 Goal should move. End with
   a draft goal for round 5 in two to four measurable lines.

## Rules

No change under `src/`, `assets/`, or `vendor/`. Images in the PR at most 1 MB each; everything
bigger goes on the clips branch. American English and the serial comma. Before you push:
`npx prettier --check .` and `node tools/us-english.mjs --diff` are clean, and the tool's own test
(`tests/cdx-p3df.spec.mjs`, a few inputs, fast) passes. On your PR, GitHub Actions runs the quick
checks; the full suite runs on the Operator's merge PR. PR body with Summary, Verification,
Deviations, Known issues, and What was cut.

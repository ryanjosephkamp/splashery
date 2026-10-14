# Codex task 76: Photo to 3D, round 4 (a long Goal run, measured against the checkpoint)

**Branch:** `codex/photo-3d-r4`, cut from `main`. One draft PR against `main`. Review clips go on
`codex/photo-3d-r4-clips`, never merged. Read `AGENTS.md`, `builders/RULES.md`,
`docs/studio/photo-3d-checkpoint.md`, `docs/codex/53-photo-3d-r3.md`,
`docs/audits/photo-3d-r2-2026-10.md`, and CLAUDE.md's "Effect quality rules".

## Why

The owner calls Photo to 3D practically perfect and wants to push it further, without losing what it
is now. The checkpoint branch `claude/checkpoint-photo-3d-2026-10-14` is the bar: **every change
must beat it, or it is reverted.**

What he still sees, on his own pictures at a strong angle (for example a giant cherry on a small
cake): the wall behind a foreground object is filled with smeared, stretched streaks that echo the
object's outline, and thin parts such as a stem have frayed, hairy edges.

## Goal (for Goal mode: keep going until all hold, up to 12 hours)

Measured against the checkpoint on every Photo to 3D sample, the 20 hard-case samples, ten CC0
photos of your choice, and Codex task 56's ground-truth scenes if they have merged, at the phone
profile (390×844, device scale factor 3) and the desktop profile, at ±20° and ±30°:

1. **Believable background behind objects:** where the view reveals what was hidden behind a
   foreground object, the fill continues the background's own texture and lines instead of stretched
   streaks. Add a measure (for example, how much stronger the directional streaking is in revealed
   areas than in the visible background nearby) and bring it down clearly on every sample, worst
   pose reported.
2. **Clean thin parts:** stems, hair, wires, and leaf edges keep crisp edges without fringes; add a
   fringe measure along thin structures and improve it.
3. **Faster to the first 3D view:** at least 25% less time from picking a picture to the first frame
   of 3D on the phone profile, with the same look.
4. **No regressions:** holes, edge halo, the text test (`phf-engine:200`), frame rate, and every
   existing spec stay at least as good as the checkpoint. Never lower a threshold, skip, or remove a
   test.
5. **Side by side:** for each sample, a clip of the checkpoint and of this round from the same
   camera path, at phone size, on the clips branch.

## Rules

Stay out of `src/packs/moving-photo.js` and the Video to 3D files (`src/video3d/`). Changes to the
shared relief files must keep Moving photo and the Splat mirror passing their specs. Engine changes
go in small additive "Engine: …" commits with a test. A new or bigger depth model needs an
Apache-2.0, MIT, or BSD license and loads only when someone turns a picture into 3D; say its size.

Before you push: `npx prettier --check .` and `node tools/us-english.mjs --diff` are clean.

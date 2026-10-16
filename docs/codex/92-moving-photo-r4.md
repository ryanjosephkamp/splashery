# Codex task 92: Moving photo to 3D, round 4: land round 3 at full speed, then push further (a 12-hour Goal run)

**Branch:** `codex/moving-photo-r4`, cut from the head of `codex/moving-photo-r2-public` (PR #560,
tasks 38 and 48), then merge `main` into it. One draft PR against `main`; it replaces #560, which
the Operator closes once this PR is open. Clips go on `codex/moving-photo-r4-clips`, never merged.
Read `AGENTS.md`, `builders/RULES.md`, CLAUDE.md's "Effect quality rules",
`docs/codex/48-moving-photo-r3.md`, #560's body and its last Operator comment, and
`docs/studio/moving-photo-3d-checkpoint.md`.

## Why

Round 3 (#560) made the picture better, but playback on the phone profile slowed to about 3 to 6
frames a second (150 to 350 ms a frame, against 66 to 83 ms on `main`), so it can't merge. It also
carries the fix for a bug the owner hit on the live site: in the Sharp view, switching to a sample
whose sound is an MP3 (Sintel, Tears of Steel, Elephants Dream) changes the relief and the sound but
leaves the previous clip's picture on the surface (`fillClip` in `src/packs/photo-sharp.js`; #560
builds a `<video>` only for real video files and falls back to the clip's own frames). The owner
wants that fixed before the release, and the toy pushed further.

## Part 1: the bug and the speed (do these first)

1. **The Sharp view always shows the chosen clip,** for every sample and for a person's own MP4,
   WebM, MOV, and GIF, switching from any clip to any other. Add a test that switches across all
   samples in the Sharp view and checks the picture changes. The owner also saw his own uploaded
   clips fail in the Sharp view on his phone (Android, Chrome and Brave); keep the number of video
   decoders a clip uses as low as possible and test an upload switch on the phone profile.
2. **Back to full speed:** find where round 3's time goes on the phone profile (a frame-time
   breakdown in the PR) and bring the median frame interval back to `main`'s or better, for every
   sample, without losing round 3's picture gains.

## Part 2: the Goal (Goal mode: keep going until all hold, up to 12 hours)

Against `main`, on the samples and five clips of your own under licenses the site allows:

1. Part 1 holds.
2. **Sharper and steadier:** sharpness and temporal stability (flicker between frames) both better
   than `main` on every sample, at both profiles, with the same measures round 3 used.
3. **No slower to start:** time to the first 3D frame no worse than `main`'s on the phone profile.
4. **No regressions:** the Splats view and the Sharp view both work for every clip, Photo to 3D's
   checkpoint is unchanged (run its specs), and every existing spec passes. Never lower a threshold,
   skip, or remove a test.
5. **Side by side:** phone-size clips of `main` and this round for every sample, on the clips
   branch.

If a target can't be met in 12 hours, stop with what holds, revert what doesn't, and say what you
tried and what you'd try next.

## Rules

Only the Moving photo files (its pack, `src/packs/photo-sharp.js`'s clip path, its samples, tools,
and tests); any shared change (the relief, the depth engine) in its own "Engine:" commit, leaving
Photo to 3D and the Splat mirror unchanged or better. Images in the PR at most 1 MB each. American
English and the serial comma. Before you push: `npx prettier --check .` and
`node tools/us-english.mjs --diff` are clean. The full suite runs on the Operator's merge PR. PR
body with Summary, Verification, Deviations, Known issues, and What was cut.

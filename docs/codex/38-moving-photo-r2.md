# Codex task 38: Moving photo to 3D, as good on your own clip as on the samples

**Branch:** `codex/moving-photo-r2`. Cut it from `codex/moving-photo-stability` (task 32's branch,
PR #479, not merged yet), then merge `main` into it, so task 32's stabilizer carries over. Your PR
replaces #479; say so in its Summary. One of five Studio tasks (37 to 41) running at the same time.

**You may change:** `src/packs/moving-photo.js`, `src/live/clip-stabilize.js`,
`src/packs/song-stream.js` (only how a track mutes and unmutes), and in `src/packs/photo-sharp.js`
only the clip path (`sharpClip`, `fillClip` and helpers only they use); new `tools/cdx-mp2-*.mjs`,
new `tests/cdx-mp2*.spec.mjs`, new sample files under `assets/toys/moving-photo-3d/`, their entries
in `tools/assets.json` and `CREDITS.md`, and a report at `docs/audits/moving-photo-r2-2026-10.md`.
Task 37 owns the depth model files (`src/live/depth-worker.js`, `src/packs/photo-3d-depth.js`): call
them, don't change them. Task 39 owns the rest of `photo-sharp.js` and `src/live/relief-mesh.js`.

## What the owner sees (his walkthrough of October 11, 2026, in the Operator's words)

The samples already look close to a 3D movie, and he wants the last rough edges gone:

1. **Switching samples lags.** Pick "Inside the machine" after "Big Buck Bunny": the sound and the
   relief switch, but the picture keeps showing the bunny for a while. Likely cause (from a read of
   the code; confirm it): in the Sharp view, `fillClip` (`photo-sharp.js`, around lines 318 to 364)
   builds a muted `<video>` from `clip.audio.url`. Only the bunny's sound is a video file; the
   others are `.mp3`, so `videoWidth` stays 0, the color is never set, and the clip's own frames are
   never used. Even for the bunny, a new video isn't ready at once. The switch must be instant: the
   new sample's first frame shows the moment it is picked.
2. **The speaker button doesn't mute a playing clip.** The app's sound toggle (`app.toggleSound`,
   `sound.setEnabled`) never reaches the clip's track: `Track.route` in `song-stream.js` (around
   lines 45 to 57) checks `sound.enabled` only when it first routes the element. Muting and unmuting
   must work at any moment, playing or paused, for every track that uses `song-stream.js`.
3. **Your own clip is not as good as a sample.** An uploaded clip shows more holes and wobbles more
   than the samples, worst on fast or high-frame-rate clips, and the motion can feel dizzying. The
   samples' depth is worked out ahead of time on every frame (`tools/live3-depth.mjs`); an upload
   gets depth on only 24 to 48 frames (`DEPTH_FRAMES`) at 196 to 294 pixels (`DEPTH_SIDES`), blended
   linearly between them.
4. **Longer samples.** He'd like much longer versions of the sample films (Inside the machine in
   particular), so watching one feels like a 3D movie, not a six-second loop.

## Steps

1. **Measure first.** Extend task 32's `tools/cdx-stability-measure.mjs` (or write
   `tools/cdx-mp2-measure.mjs`): per clip, height jitter in still regions, edge flips, the share of
   holes (pixels where the relief tears or shows background), and open time. Measure every sample
   **and** the same sample opened as an upload (its source video through the upload path), plus one
   fast clip at 60 fps. The gap between "sample" and "upload" is the number this task closes.
2. **Fix items 1 and 2** first, each with a browser test (switch samples and check the shown pixels
   change within one frame; toggle the speaker while playing and check the track's gain or `muted`).
3. **Close the upload gap.** Show a quick first result, then refine in the background until the clip
   matches what the offline tool would make: more depth frames, then larger ones, guided by the
   picture between them (flow or color-guided interpolation instead of a linear blend), with task
   32's alignment and filtering on top. Handle high frame rates and fast motion (resample in time,
   follow motion). Keep the frame rate and resolution the clip plays at.
4. **Less dizzying.** Ease any camera or relief motion the toy adds so it never jerks; keep the
   depth range steady over the whole clip.
5. **Longer samples.** The current films are Blender open movies under CC BY (Big Buck Bunny,
   Sintel, Tears of Steel, Elephants Dream; check each license on its live source page). Make longer
   sample cuts (aim for 30 to 60 seconds each) with depth worked out ahead of time. Size rules (D4
   in `builders/RULES.md`): the default first load stays as it is; a long sample loads only when
   picked; no single file over 20 MB; say how big each one is. If the owner hands you clips of his
   own, follow A2 and A3 (no identifiable people; AI-made video labeled as AI-made).
6. **Tests.** `tests/cdx-mp2*.spec.mjs` for items 1 and 2 and the upload-gap numbers from step 3.
   Keep green: `smd-moving`, `live3`, `live5`, `live6`, `lv7-long`, `psv*`, `phf*`, `smd-compare`,
   task 32's `cdx-stability`.
7. **Report.** `docs/audits/moving-photo-r2-2026-10.md`: before-and-after per clip (sample and
   upload), what changed and why, what didn't help, and clips: render each sample and one upload at
   390x844 with `tools/effect-clip.mjs` or `tools/live-clip.mjs` and put them in the PR.

Before you push, run `npx prettier --check .` and `node tools/us-english.mjs --diff`. Open a draft
PR titled "Codex task 38: Moving photo to 3D, as good on your own clip as on the samples" with the
five sections from CLAUDE.md and a "Rule check" line (`builders/RULES.md`).

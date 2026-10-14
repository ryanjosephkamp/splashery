# Codex task 32: a steadier Moving photo to 3D

**Branch:** `codex/moving-photo-stability`, cut from `main`. **Changes:**
`src/packs/moving-photo.js`, one new helper module `src/live/clip-stabilize.js`, one new test file
`tests/cdx-stability.spec.mjs`, a measuring script `tools/cdx-stability-measure.mjs` and a report
`docs/audits/moving-photo-stability-2026-10.md`. Don't edit any other file.
`src/packs/photo-sharp.js` and `src/live/relief-mesh.js` belong to the Photo depth lane, which is
changing them now.

This is an implementation task, not only a report. The owner wants Moving photo to 3D to feel
steadier **without lowering the frame rate or the resolution** (his review of October 9, 2026;
docs/reviews/2026-10-09-walkthrough/triage.md, "Codex: Moving photo to 3D stability").

## What makes it unsteady now (from a read of the code; confirm each)

`src/packs/moving-photo.js`:

- **Breathing.** `normalizeDepths` (around lines 174–218) stretches each depth frame between its own
  2nd and 98th percentiles, averaged over only ±2 frames. For opened clips, `reliefScale` is also
  applied per frame. The model's raw range swings a lot from frame to frame (Big Buck Bunny's max
  3.62 → 3.09 → 2.62 over three frames). After normalization, 42–71% of the frame-to-frame depth
  change on the sample clips is a plain scale and shift.
- **Judder.** `depthOf` (328–380) runs the depth model on at most `DEPTH_FRAMES` frames (24, 32 or
  48 by tier). It blends the frames between them linearly, so the motion changes direction at each
  worked-out frame and leaves ghost double edges.
- **Edge flicker.** `sharpenEdges` (389–406) snaps each frame's edge pixels near or far on its own.
  On the samples, 20–90 pixels per 1,000 flip per frame.
- **Long videos.** `depthBytes` (826–846) and `nearAt` (851–875) have the same issues at 1–4 depth
  answers a second.

The camera toy already solves most of this. See `src/live/relief.js` (around lines 325–413 and
`snapEdges` near 895):

- an eased range;
- a per-pixel blend that follows motion and damps noise;
- an edge flip held for three answers before it is accepted;
- edges snapped using the frame's colors.

## Steps

1. **Measure first.** `tools/cdx-stability-measure.mjs` loads each sample clip in the browser, the
   way the existing tests do (see `tests/smd-moving.spec.mjs` and `tools/lv7-mirror-measure.mjs`).
   It reports, per clip:
   - the frame-to-frame height jitter in still regions (where the color barely changes);
   - edge flips per 1,000 pixels per frame;
   - the global scale and shift share of the change. Save the "before" numbers.
2. **Align, then normalize once.** For each raw frame, fit a scale and a shift (least squares over
   pixels whose color barely changed) to a reference (the previous aligned frame or a running mean).
   Then use one range and one relief scale for the whole clip. For long videos, seed from the first
   pictures and only widen slowly.
3. **Filter over time without lag.** Short clips are processed once when opened, so the filter may
   look both ways. Use a per-pixel filter over ±2–3 frames weighted by color similarity, or run the
   mirror's blend forward and then backward.
4. **Interpolate with the picture.** Between worked-out frames, use smooth cubic weights across four
   frames instead of linear ones, and re-guide the blended depth with the frame's own colors
   (`guidedDepth` is already in the file).
5. **Steady edges.** Run the edge snap after the filter, with hysteresis: keep last frame's side
   unless the change holds for two or three frames. Pick the side by color.
6. **Measure again** and compare. The goal: at least half the jitter and the edge flips gone on
   every sample clip, with the same frame rate, resolution and open time (or within 15% of it).
7. **Tests.** `tests/cdx-stability.spec.mjs` has two kinds:
   - pure tests on synthetic clips (one still depth map with a random scale, shift and noise per
     frame), checking jitter and flips after normalization;
   - a browser test on one sample clip, with thresholds from step 6. Keep every existing test green,
     especially:
   - `tests/smd-moving.spec.mjs`
   - `tests/live3.spec.mjs`
   - `tests/lv7-long.spec.mjs`
   - `tests/psv*.spec.mjs`
   - `tests/phf*.spec.mjs`
8. **Report.** Write it in `docs/audits/moving-photo-stability-2026-10.md`:
   - a before-and-after table per clip;
   - what you changed and why;
   - what you tried that didn't help;
   - what is left for the Sharp view. Taking the depth for the exact video frame shown, and blending
     depth frames in the shader, are the Photo depth lane's job, so describe them only.

Run tests with `SPLASHERY_CHROMIUM` set if your environment needs it (see SETUP.md). Before you
push, run `npx prettier --check .` and `node tools/us-english.mjs --diff`. Open a draft PR titled
"Codex task 32: a steadier Moving photo to 3D" with the five sections from CLAUDE.md (Summary,
Verification, Deviations, Known issues, What was cut).

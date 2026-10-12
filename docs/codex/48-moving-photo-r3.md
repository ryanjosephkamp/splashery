# Codex task 48: Moving photo to 3D, no holes and no white specks (a long Goal run)

**Branch:** keep working on `codex/moving-photo-r2-public` and its PR #560 (task 38), after merging
the latest `main` into it (never rebase or force-push). Never merge or build on
`codex/moving-photo-r2-clips-public`: put new review media on a fresh branch
`codex/moving-photo-r3-clips` that is never merged. Read `AGENTS.md`, `builders/RULES.md`,
`docs/codex/38-moving-photo-r2.md` (the files you may change are the same, plus anything this file
adds), the Operator's comments on #560, and `docs/audits/moving-photo-r2-2026-10.md`.

## Why

The owner looked at #560's clips on October 12, 2026. They look a little better than before, but:

1. **Holes and gaps are still there.** When the relief turns or something moves, pixels tear open
   and show background, on the samples and worse on uploaded clips. The bridge sample, the machine
   sample and uploads are the worst.
2. **New white specks around the edges of the video frame.** A ring of bright or white dots now
   shows along the borders of the picture, which was not there before #560. Find which change put
   them there (the border pixels of the video, the depth worker's padding, the relief's edge fill,
   or the color sampling at the frame's edge) and remove the cause.

The goal of this run is a Moving photo the owner calls good: a clip that looks like a solid 3D
movie, with no tears, no specks, and no wobble, on the samples and on his own clips.

## Goal (for Goal mode: keep going until all of these hold, up to 12 hours)

Measured with `tools/cdx-mp2-measure.mjs` (extend it), on every sample (the five short ones, the
four long films) **and** each sample's source opened through the upload path, **and** the 60 fps
fast clip, at the phone profile (390×844, device scale factor 3) and the desktop profile:

1. **Holes:** the share of hole pixels (the relief tears or shows background) is below 0.5% on every
   frame of every clip, and at least as low on an upload as on the same clip as a sample. Report the
   worst frame of each clip, not only the mean.
2. **White specks:** zero bright edge specks. Add a measure: in a band 12 pixels wide along each
   edge of the shown picture, count isolated pixels much brighter than their neighbors (for example,
   more than 60 levels above the median of their 5×5 neighborhood) that are not in the source frame.
   The count is 0 on every frame of every clip.
3. **Steady:** height jitter in still regions and edge flips are no worse than #560's numbers, on
   every clip.
4. **Startup:** the first result still shows within 2 seconds on the desktop profile; say what it is
   on a slow device.
5. **No regressions:** every spec that passed on #560 still passes, unchanged: `cdx-mp2*`,
   `cdx-stability`, `psv`, `psv2`, `psv3`, `phf`, `phf2`, `phf-engine`, `smd-moving`, `smd-compare`,
   `live3`, `live5`, `live6`, `lv7-long`, and `smoke` (including the "embed transfer ≤ 30 MB" test).
   Never lower a threshold, skip, or remove a test to make a number pass.

## How

- Measure first, then fix one cause at a time, and re-measure after each fix. Keep a short log in
  the report of what each change did to the numbers.
- Fix causes, not symptoms. A blur, a smear, a vignette, a crop that hides the frame's edges, or
  shrinking the motion until the holes stop showing does not count (CLAUDE.md, "Effect quality
  rules": real motion, no warped picture, no blur, no speckle). Ideas worth trying: fill a
  disocclusion from earlier and later frames (the background was visible a moment before or after),
  depth-aware inpainting from the same frame, layered depth (a back layer behind the front edges),
  clamping and edge-aware filtering of depth at the frame border, and sampling color with clamped
  texture coordinates at the edges.
- Keep the samples' look the owner liked. If a fix changes it, show a before and after.
- Real browser only for the numbers (Chromium at `/opt/pw-browsers/chromium` in this environment;
  never run `playwright install`). Say what was measured and what was not.

## When you stop (Goal met, or 12 hours)

1. Render phone-size clips of every sample and two uploads, before (#560's head) and after, side by
   side, on `codex/moving-photo-r3-clips` (never merged), and link them from the PR body.
2. Update `docs/audits/moving-photo-r2-2026-10.md` with a new section "Round 3" (the numbers table,
   worst frames, what each fix did, what is left).
3. Update the PR body: Summary, Verification (each spec file with its counts), Deviations, Known
   issues, What was cut. Say plainly which Goal items hold and which don't. "Rule check: none" or
   the rules it touches.
4. Before you push: `npx prettier --check .` and `node tools/us-english.mjs --diff` are clean.

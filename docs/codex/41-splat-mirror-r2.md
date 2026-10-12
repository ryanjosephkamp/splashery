# Codex task 41: a steadier, cleaner Splat mirror

**Branch:** `codex/splat-mirror-r2`, cut from `main`. One of five Studio tasks (37 to 41) running at
the same time.

**You may change:** `src/live/relief.js`, the `SPLAT_MIRROR` recipe in `src/packs/live.js` (around
lines 360 to 460, nothing else in that file), new `tools/cdx-mir-*.mjs`, new
`tests/cdx-mir*.spec.mjs`, and a report at `docs/audits/splat-mirror-r2-2026-10.md`. Task 37 owns
`src/live/depth-worker.js` (the depth model): call it, don't change it. Leave `src/live/live.js`
(the camera permission), `stream.js` and `record.js` as they are.

## Why

The Splat mirror turns the camera into a live relief of splats. The owner finds it close to Moving
photo to 3D in feel and wants it more stable and cleaner, as far as a live camera allows. Known
issues (docs/handoff/LiveR7.md, LiveR8.md): the depth wanders on a still picture; depth is relative
and eased. The live rules stay exactly as they are (C3 in `builders/RULES.md`): the camera starts
only on a tap, and nothing is recorded, stored or sent.

## Steps

1. **Measure first** with a fake camera, never a real one: `tools/lv7-mannequin.mjs` makes a Y4M
   clip Chromium can use as its camera, and `tools/lv7-mirror-measure.mjs` reports height jitter,
   color jitter, shown jitter, sharpness, grain and draw time. Add clips that stress it: a still
   scene, a slow head turn, a fast hand wave, low light. Save the "before" table.
2. **Steady when still, quick when moving.** A still scene's depth should not drift at all; motion
   should follow without lag or smearing. Align each depth answer's scale and shift to the last one
   before blending (Codex task 32, `docs/codex/32-moving-photo-stability.md`, describes the same
   idea for clips), blend per pixel by how much the color changed, and keep edge flips held until
   they persist (`snapEdges`, `HOLD`).
3. **Fewer holes and cleaner edges.** Fill behind near objects from the previous frames (what the
   camera saw before the hand moved in front), anti-alias edges, and keep the back plate from
   showing through.
4. **Latency.** Measure the time from a camera frame to the drawn relief, and cut it: answer depth
   on the newest frame only, drop stale answers, and upsample with the picture's colors.
5. **Tests.** `tests/cdx-mir*.spec.mjs` with thresholds from your measurements on the fake camera.
   Keep green: `live`, `live-engine`, `live3`, `live5`, `lv7`, `lv7-engine`, `lv8-dial`,
   `hh3-level1`, `man4`.
6. **Report.** `docs/audits/splat-mirror-r2-2026-10.md`: before-and-after tables per test clip, what
   changed and why, what didn't help, and clips at 390x844 from the fake camera
   (`tools/live-clip.mjs` or `tools/lv8-clip.mjs`) in the PR.

Before you push, run `npx prettier --check .` and `node tools/us-english.mjs --diff`. Open a draft
PR titled "Codex task 41: a steadier, cleaner Splat mirror" with the five sections from CLAUDE.md
and a "Rule check" line (`builders/RULES.md`).

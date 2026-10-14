# Splat fidelity: trained splats on our rigs (October 2026)

Lane Fidelity's report on the Splat Fidelity Plan (approved October 3, 2026). Model: Opus 5.5.
Brief: [docs/handoff/Fidelity.md](../handoff/Fidelity.md). This is a working draft: the Stage 1 and
Stage 2 numbers come from the owner's Mac (Codex tasks 08 and 10) and are filled in as they land.

## Summary

- **Stage 1 (the boombox two ways):** waiting on Codex task 08 (`codex/fidelity-stage1` has not been
  pushed yet).
- **Stage 2 (the brass orrery, part by part):** the scripts are ready and tested here at low
  resolution with Blender 4.5.14 LTS on the CPU: the model, the per-part datasets, the runner, the
  packing and the measuring. The renders and the training wait on Codex task 10 (the owner's Mac).
- **Trained files as moving parts:** a kit recipe can now load several trained SOG files as named
  parts (`src/packs/fidelity.js`), each turning as a solid piece on the kit's rig.
- **SH bands:** a captured toy keeps and shows them; a kit toy (moving parts) keeps only the base
  color.
- **Streamed levels of detail:** in PlayCanvas 2.22.3, but our loader can't stream them yet; not
  needed for single objects.

## Stage 1: the boombox, trained

To come from `docs/audits/fidelity-stage1.md` (Codex task 08): splats, megabytes, PSNR and SSIM of
the full and lite files, the comparison with our sampled boombox, and the times.

## Stage 2: the brass orrery

**The model** (`tools/fidelity/orrery.py`, ours, CC0): a wooden plinth with a brass band and feet, a
brass drum, two brass gears, a steel column, a glowing sun, six planet arms (Mercury and Mars in
stone; Venus, Earth, Jupiter and Saturn in enamel; Saturn with a brass ring) and a moon on Earth's
arm. Eleven parts. The plinth's wood, the stone and the light are Poly Haven CC0 assets (named in
`tools/fidelity/README.md`); everything else is procedural.

**The datasets.** Each part is rendered on its own, with the others hidden, from 200 training and 25
held-out cameras on a sphere around it (1024 px, 256 samples, Cycles), and so is the whole orrery
(to compare one-piece training with part-by-part training). The sun's point light stays on for every
part, so each planet's lit side faces the sun and keeps facing it as its arm turns.

**Checked here, without a trainer.** Fake "trained" splats made from each dataset's surface points
(`tools/fidelity/stand-in.mjs`) went through the whole runner (`render`, `train` with a stand-in for
Brush, `pack`) and the toy's loader:

- The frame: rendered with PlayCanvas at the held-out cameras (`tools/fidelity/measure.mjs`), the
  stand-in's silhouette lands within 2 px of the Blender render's at every view (192 px). So the
  cameras' convention, our y-up mapping (Blender's `(x, y, z)` is our `(x, z, −y)`) and
  `splat-transform -r 90,0,0` agree.
- splat-transform's filters (`-S`, `-B`) work in PlayCanvas's space, the file turned 180° about z.
  The runner flips the sphere's center to match (found when the first gear came out empty).
- The parts: every part loads on its own kit part, a tap turns each arm at its own speed, and the
  moon rides on Earth's arm (`tests/fid.spec.mjs`).

Numbers to come from Codex task 10: per part, splats, megabytes, PSNR and SSIM (full, lite, and with
SH bands), the training times, the whole orrery trained as one piece beside the parts, and the frame
rate on a phone.

## What the Splashery side does

**Trained files as named parts** (`src/packs/fidelity.js`):

- `decodeSog(bytes)` reads a SOG file (version 2) into plain arrays with the same math as
  PlayCanvas's reader: in the browser with the browser's WebP decoder (no color management, no
  premultiplied alpha), in Node with splat-transform's. On the boombox's 200,000 splats it matches
  splat-transform's own reader to float precision.
- `addTrained(k, file, { part, share })` adds a trained file to a kit toy as a cloud on one part,
  keeping each splat's trained sizes and rotation exactly (no jitter, no surface pattern). When the
  toy's budget is smaller than the file, it keeps the most visible splats (opacity times projected
  area).
- The orrery recipe loads `assets/toys/orrery/parts.json` and every part's SOG (the lite ones on a
  phone: an additive engine PR, "Engine: a recipe's prepare learns the device profile", passes the
  profile to `prepare`).

**SH bands.** A trained file carries spherical-harmonic bands (the shine that changes as you turn).
A test splat whose color depends on the view (red from one side, blue from the other) showed the
change in plain PlayCanvas and in the app, as a dropped PLY and as a SOG, so the captured path keeps
them (the work buffer evaluates them every frame). Our own captures are prepared without SH
(`tools/prepare-assets.mjs`) to save bytes; a trained boombox with SH will show them. The kit's
buffer holds one color per splat, so a toy with moving parts keeps only the base band; the runner
packs the parts without SH, and measures what the bands would have added on each part.

**Streamed levels of detail.** PlayCanvas 2.22.3 reads splat-transform's `lod-meta.json` (an octree
of chunks it streams as the camera moves) and has a splat budget (`scene.gsplat.splatBudget`; the
stage sets 1.5 million on weak devices). Our loader hands the engine a blob URL of one file, so the
chunk files next to `lod-meta.json` can't be found; using it needs a loader change (an engine PR
that loads such toys by their real URL). For one object of under a million splats it would not help:
the whole file is small enough. It would help for rooms and landscapes.

## What helped from Splashery's own work

To fill in with the numbers. So far:

- **Kit clouds that take a trained splat's own shape** (an earlier engine PR): the parts loader
  needed no engine change for that.
- **The kit's parts and rig** (pivots, axes, `drive`): the orrery's motion is about 40 lines.
- **splat-transform** (already a pinned devDependency): packing, and reading SOG in Node.
- **The test harness** (`tests/taps.spec.mjs`'s rules: a tap ends where the toy rests): shaped the
  orrery's tap so the arms keep the angle they stop at.

## What next

To write once Stage 1 and Stage 2 report.

# Codex task 74: Photo to 3D, explained inside and out, and compared with everything else

**Branch:** `codex/photo-3d-explained`, cut from `main`. One draft PR against `main`. A report and
diagrams only: change no code.

Read `AGENTS.md`, `builders/RULES.md`, `docs/studio/photo-3d-checkpoint.md` (the files that make up
the toy), `docs/audits/photo-3d-r2-2026-10.md`, and the code itself.

## Why

The owner calls Photo to 3D the best thing on the site and wants to explain exactly how it works and
why it looks so good, and to know whether anything else out there is better.

## Part 1: how it works, from the code

Write `docs/studio/photo-3d-explained.md`, grounded line by line in the code (cite `file:line` for
every claim), for a reader who knows nothing about depth or splats:

1. The whole pipeline, start to finish, as a diagram and numbered steps: picture in, depth model,
   depth clean-up, the relief mesh, the splats, the Sharp view, the fill behind objects, and what
   happens when you turn the view.
2. The depth model: which one, its size, its license, what it was trained on (from its model card),
   how it runs in the browser (WebGPU or WASM), the input size, and the time it takes on a phone and
   a desktop (measure or say "unmeasured").
3. The Sharp view: what it is (the mesh-plus-splats hybrid), why it removes outlines, and what the
   cubic footprint and the photo fill do.
4. Every setting and constant that shapes the result (a table: name, value, file:line, what it does,
   what happens if you raise or lower it).
5. Hardware needs: memory and time at each splat budget on a phone profile and a desktop.
6. Known limits: what kinds of pictures it handles badly today, with examples from the samples.

## Part 2: how it compares

Write `docs/studio/photo-3d-landscape.md`: a literature and product review of turning one picture
into 3D. Open every source you cite and link it.

- **Depth models:** for example, the Depth Anything family, Marigold, ZoeDepth, MiDaS, and Depth Pro
  (check what exists now): accuracy, size, license, and browser feasibility.
- **One-picture 3D methods:** for example, 3D photo inpainting (layered depth), single-image
  Gaussian splatting research, and image-to-mesh models: what they produce and how.
- **Products and open tools** that turn a photo into 3D or a parallax image: what they do, whether
  they run in a browser, whether they're free and open, and their licenses.
- **How to compare fairly:** propose measures (depth error against ground truth; view quality at
  ±20° and ±30°; holes; edge halos; load time; frame rate; download size) and which public datasets
  or our own test scenes (Codex task 56) to use. Where an open tool can run locally, run it on 10 of
  our samples and compare side by side with stills.
- **Verdict:** what is special about ours, where others are better, and the three most promising
  ideas to borrow.

Before you push: `npx prettier --check .` and `node tools/us-english.mjs --diff` are clean.

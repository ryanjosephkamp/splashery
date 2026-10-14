# Codex task 75: the depth lab's test pictures (run as five parallel sessions)

**Branch:** `codex/depth-lab-<part>` (for example `codex/depth-lab-a`), cut from `main`. Each
session opens its own draft PR. This task makes pictures and their records only; the experiments
come later, after the next Photo to 3D round (task 76).

Read `AGENTS.md`, `builders/RULES.md` (A3 and B4), and `docs/studio/photo-3d-checkpoint.md`.

## Why

The owner wants to learn, as a science, which features of a picture make Photo to 3D's depth work
best: resolution, shading, outlines, overlap, perspective, and more. That needs systematic test
pictures where one thing changes at a time.

## The parts (one session each)

| Part | Categories                                                                     | What varies                                                                                                                                                                                                                                       |
| ---- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a    | A. Plain fields and gradients; I. resolution and compression                   | Color, gradient direction and shape, noise; the same picture from 256 to 4,096 px, JPEG quality, sensor noise                                                                                                                                     |
| b    | B. Lines; C. flat shapes                                                       | Line width, contrast, color, angle, blur, count, joins; circle, square, and triangle, filled or outlined, size, position, edge softness                                                                                                           |
| c    | D. Shading and shadows; E. overlap                                             | A disc shaded like a sphere (light direction, falloff), cast shadows, contact shadows; overlapping shapes, T-junctions, stacking order                                                                                                            |
| d    | F. Perspective and texture; G. size and height in the frame; H. haze and focus | Converging lines, floor grids, texture gradients, horizon; the same object at different sizes and heights; blur or haze growing with distance                                                                                                     |
| e    | J. Hard real-world cases                                                       | AI-made pictures (Codex with ChatGPT Images), only for what code can't draw: glass, mirrors, hair and fur, thin parts, night scenes, paintings, line art, flat graphic design, clutter. No people, faces, logos, or readable text (Rules v1, A3). |

## The shared format (every part follows it exactly)

- **Made by code, not by an image model,** for parts a to d: a seeded, deterministic generator
  `tools/depth-lab/gen-<category letter>.mjs` that draws the pictures (a canvas in headless
  Chromium, or a pinned image library listed in `LICENSES.md`). Original and CC0, "made by Ryan with
  Codex."
- **Don't commit the generated pictures** for parts a to d: commit the generator, the manifest, and
  a contact sheet. `node tools/depth-lab/build.mjs <letter>` regenerates them into
  `.cache/depth-lab/<letter>/`. Part e's AI-made pictures are committed under `assets/depth-lab/j/`
  (at most 30 MB, 1,280 px JPEG), recorded in `CREDITS.md` and `tools/assets.json` as AI-made by the
  owner.
- **One manifest per category:** `tools/depth-lab/<letter>.json`, an array of entries:
  `{ "id": "b-line-w04-c80-a045", "category": "B", "file": "b/b-line-w04-c80-a045.png", "width": 1024, "height": 1024, "seed": 7, "variables": { "lineWidthPx": 4, "contrast": 0.8, "angleDeg": 45 }, "controls": "the variables held fixed", "expect": "what a perfect depth model would do, in one line" }`.
- **Design for an experiment:** within a category, vary one variable at a time across 5 to 9 levels
  with the others fixed, then a small grid of two-variable combinations. 100 to 400 pictures per
  category, 1,024 px square unless the variable is size.
- **A contact sheet** per category in `docs/audits/depth-lab/<letter>.jpg`, and a short README
  section per category in `docs/audits/depth-lab/README.md` (each part adds only its own section).

## Don't touch

`src/`, `vendor/`, other parts' files, and the files of the open PRs. Each part touches only its own
generator, manifest, contact sheet, and README section.

Before you push: `npx prettier --check .` and `node tools/us-english.mjs --diff` are clean.

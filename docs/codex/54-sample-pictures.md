# Codex task 54: new pictures for Photo to 3D and for the Picture QR

**Branch:** `codex/sample-pictures`, cut from `main`. One draft PR against `main`.

Two jobs, both about pictures. Read `AGENTS.md`, `builders/RULES.md` (A2 and A3 especially),
`docs/handoff/DotSamples.md` (how the AI-made Photo to 3D samples were added),
`src/qr-craft/picture.js` and `src/qr-craft/samples.js` (the Picture QR), and CLAUDE.md's ground
rules on AI-made samples.

## Part 1: more Photo to 3D samples (AI-made)

Make about 40 new pictures and keep the best 20 as Photo to 3D samples. They are AI-made, so the
rules are strict (CLAUDE.md, "AI-made samples"; Rules v1, A3):

- No people, no faces, no logos or brand names, no readable text, and no real landmark or real place
  presented as real. Label each as AI-made beside it in the toy, and record it in `CREDITS.md` and
  `tools/assets.json` as AI-made by the owner (the same wording as the existing "ai" samples).
- Choose pictures that make the best 3D: a clear subject with depth, layers from near to far, clean
  silhouettes, fine but not noisy texture, good light. Vary them: still life, interiors, landscapes,
  macro, architecture-like fantasy scenes, animals in nature, objects on tables.
- Score each candidate in the toy itself (holes and the edge halo at ±20° and ±30°, the same
  measures task 53 uses if it has landed, else simple ones of your own) and keep the 20 best.
- Size each like the current samples (1,280 px wide JPEG or WebP, with its depth map made by
  `tools/dsm-depth.mjs`); add them to the sample picker in a sensible group.

## Part 2: background pictures that make the Picture QR look its best

The Picture QR puts a photo behind a QR code as halftone. Make a set of backgrounds designed for it:
pictures that keep as much of the photo's detail as possible while the code still scans every time.

- First measure what makes a background good for it: try many candidates through the toy's own
  encoder and a decoder (jsQR, vendored; and the scan check the QR tests use) at several sizes and
  error-correction levels, and record which properties keep detail and scanning (contrast range,
  where the detail sits, edge density, color, mid-tone balance).
- Then make **at least 60 candidates** aimed at those properties and keep the **best 24**: each must
  scan in 100% of your trials at the toy's default settings, at phone size and printed size, and
  show the most picture detail by your measure. Show the score of each.
- **Where they come from:** by default these are made by code (procedural patterns, gradients,
  fractals, rendered 3D scenes with Blender or the repo's own tools), original work offered under
  CC0 and credited as made by the owner with Codex (Rules v1, B4). AI-made pictures may be used here
  only if `CLAUDE.md` on `main` says the owner has allowed AI-made pictures as Picture QR
  backgrounds; if it doesn't, use only made-by-code pictures and say so.
- Add the kept ones to the Picture QR's sample list (`src/qr-craft/samples.js`) with a short name,
  their credit beside them, and a contact sheet in the report.

## Rules

Sizes (D4): keep the default first load as it is; new pictures load only when picked. Don't touch
the files of the open PRs (#560, #562, #566, #570) or `manual/`. Tests: `tests/cdx-pics*.spec.mjs`
(every new sample loads and turns to 3D; every new QR background scans), plus `qr*`, `p3d*`,
`smoke`, `help`, `unit`, `taps` (never edit `tests/taps.spec.mjs`).

## Report

`docs/audits/sample-pictures-2026-10.md`: every candidate with its score, which were kept and why,
the QR scan results, and contact sheets (keep the folder under 8 MB). Before you push:
`npx prettier --check .` and `node tools/us-english.mjs --diff` are clean.

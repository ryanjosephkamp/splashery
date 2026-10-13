# Codex task 53: Photo to 3D, perfected (a long Goal run)

**Branch:** take over `codex/photo-3d-r2` and its PR #566 (task 39): merge the latest `main` into it
(never rebase or force-push) and keep working there. Put review media on a new branch
`codex/photo-3d-r3-clips` that is never merged. Read `AGENTS.md`, `builders/RULES.md`,
`docs/codex/39-photo-3d-r2.md`, the Operator's comments on #566,
`docs/audits/photo-3d-r2-2026-10.md` and CLAUDE.md's "Effect quality rules".

## Why

Turning any picture into 3D matters a great deal to the owner. On October 13, 2026 he called Photo
to 3D nearly perfect, with one visible flaw: **the Sharp view draws an unnatural outline around
objects** (a light or dark rim, or a smeared band, where a near object meets the background). He
wants it perfect: any photo or GIF a person opens turns into clean, solid 3D with zero holes, no
outlines, and a smooth frame rate on a phone.

The Operator also found one regression on #566 that this run must fix:
`tests/phf-engine.spec.mjs:200` ("a page of text in a photo stays legible with the photo's own
pixels…") fails on the branch (text match 0.775, where it must stay above 0.8; it was 0.93 before)
and passes on `main`.

## Goal (for Goal mode: keep going until all of these hold, up to 12 hours)

Measured on every Photo to 3D sample, the AI-made samples, ten varied photos of your own choosing
under CC0 or CC BY (checked on their live pages; people, logos and text avoided), and three GIFs, at
the phone profile (390×844, device scale factor 3) and the desktop profile, turning the view through
±20° and ±30° in yaw and pitch:

1. **No outlines:** add a measure of the halo at depth edges (for each edge pixel of the subject,
   the difference in color from both the subject's interior and the background just beside it,
   compared with the source photo at the same place). Edge halo near zero: no band brighter, darker
   or blurrier than the source photo's own edge, on every sample and pose. Show the worst pose of
   each before and after.
2. **No holes:** hole pixels (where the relief tears or shows nothing) below 0.2% on every pose of
   every sample, the worst pose reported, not only the mean.
3. **Text stays legible:** `phf-engine:200` passes again, unchanged, at its old level or better.
4. **Smooth:** a steady frame rate on the phone profile at least as good as `main` today; say the
   numbers.
5. **No regressions:** every spec that touches Photo to 3D, the Sharp view or the relief passes,
   unchanged: `cdx-p3d2-*`, `p3d*`, `phf`, `phf2`, `phf-engine`, `psv*`, `pdp*`, `smd-moving`,
   `smd-compare`, `live3`, `live5`, `man4` and `smoke`. Never lower a threshold, skip or remove a
   test.

## How

- Measure first, then fix one cause at a time, and re-measure after each fix. Likely causes of the
  outline worth checking: color sampled across the depth edge (texture filtering that mixes subject
  and background), a depth map that is softer than the color edge so the rim stretches, background
  fill that copies the subject's edge color into the disocclusion, and the mesh's edge triangles
  that stretch instead of splitting. Ideas: edge-aware depth refinement against the color image,
  splitting the mesh at depth discontinuities with a layered background behind, filling the
  background from the background side only, and sampling color without filtering across the cut.
- Fix causes, never hide them: no blur, no vignette, no crop, and no shrinking the parallax to make
  the flaw smaller (CLAUDE.md, "Effect quality rules").
- Real browser for every number (Chromium at `/opt/pw-browsers/chromium`; never run
  `playwright install`). Say what was measured and what was not.
- Stay out of the clip path that task 48 owns on #560 (`sharpClip`, `fillClip` and helpers only they
  use in `src/packs/photo-sharp.js`, and `src/packs/moving-photo.js`). The relief code
  (`src/live/relief-mesh.js`, `relief-height.js`) is shared with Moving photo and the Splat mirror:
  keep their specs green.

## When you stop (Goal met, or 12 hours)

1. Render before-and-after phone-size clips (#566's last head versus yours) of every sample and the
   GIFs on `codex/photo-3d-r3-clips`, and link them from the PR body.
2. Add a "Round 3" section to `docs/audits/photo-3d-r2-2026-10.md`: the numbers, the worst poses,
   what each fix did, and what is left.
3. Update the PR body (Summary, Verification with each spec file's counts, Deviations, Known issues,
   What was cut). Say plainly which Goal items hold. "Rule check: none" or the rules it touches.
4. Before you push: `npx prettier --check .` and `node tools/us-english.mjs --diff` are clean.

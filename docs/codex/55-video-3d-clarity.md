# Codex task 55: Video to 3D, sharp and clear (a long Goal run)

**Branch:** take over `codex/video-3d-r2` and its PR #562 (task 40): merge the latest `main` into it
(never rebase or force-push) and keep working there. Put review media on `codex/video-3d-r3-clips`,
a branch that is never merged. Read `AGENTS.md`, `builders/RULES.md`,
`docs/codex/40-video-3d-r2.md`, the Operator's comments on #562,
`docs/audits/video-3d-r2-2026-10.md` and CLAUDE.md's "Effect quality rules".

## Why

On October 13, 2026 the owner called Video to 3D better but still **grainy and blurry**. He wants
the 3D worlds it makes from a video to look clear: crisp surfaces, readable detail, no fuzz. The
shipped samples are still the compact bakes (24 frames, 640 px, about 100 finishing steps). The
native Mac bake (60 frames, 30,000 steps) is ready for the owner to run but hasn't been run yet, so
this task is about how far the cloud can go on its own, and about making sure every sharper bake,
wherever it is trained, looks its best in the viewer.

## Goal (for Goal mode: keep going until all of these hold, up to 12 hours)

1. **Measure clarity first.** Hold out about 1 frame in 8 from each sample's source frames. Render
   the model from those held-out cameras and score it against the real frames with PSNR, SSIM and a
   sharpness measure (variance of the Laplacian, or a gradient-energy ratio rendered vs. real).
   Record `main`'s numbers for every sample before you change anything.
2. **Sharper bakes from the cloud.** Train each sample longer and at higher resolution, within what
   one Codex session can run: more frames (choose the sharpest frames, drop blurred ones), 960 px or
   more, many more steps, densify where detail is missing, prune floaters and near-transparent
   splats. Whatever trainer you use must be open source and listed in `LICENSES.md` (a build tool,
   never shipped). Target: held-out SSIM up by at least 0.05 and sharpness at least 1.5× `main`'s on
   every sample, with the phone tier still loading in the viewer's budget.
3. **The viewer doesn't blur it.** Check that the viewer draws the splats at full quality: no extra
   blur from the render scale, a sensible minimum splat size, and anti-aliasing that doesn't smear
   (a mip-style screen-space filter if it helps). Any engine change is a separate small additive
   "Engine: …" PR with a test.
4. **Tiers.** Keep a phone tier and add a sharper tier that the Auto budget picks on desktops; the
   embed transfer test stays at or below 30 MB, and no single file is over 20 MB.
5. **No regressions:** `cdx-v3d*`, `v3d`, `smd-compare`, `hh3-level1*` and `smoke` pass unchanged.
   Never lower a threshold, skip or remove a test.

## Report

Before-and-after numbers per sample, side-by-side stills from the same held-out camera, and a
phone-size Walk clip of each sample on the clips branch, linked in the PR body. Keep the native Mac
route working and say what it would add beyond the cloud bake. Licenses of every sample stay as
recorded (Põltsamaa stays CC BY-SA, its notice beside it). Before you push: `npx prettier --check .`
and `node tools/us-english.mjs --diff` are clean.

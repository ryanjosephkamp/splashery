# Codex task 56: test scenes with exact depth, for the Studio's 2D-to-3D toys

**Branch:** `codex/ground-truth-scenes`, cut from `main`. One draft PR against `main`.

Read `AGENTS.md`, `builders/RULES.md`, `docs/codex/48-moving-photo-r3.md`,
`docs/codex/53-photo-3d-r3.md` and `docs/codex/55-video-3d-clarity.md`.

## Why

Photo to 3D, Moving photo to 3D and Video to 3D are judged today on real photos and clips, where the
true depth and camera path are unknown. A set of rendered scenes where we know the exact depth and
camera of every pixel lets every Studio task measure itself honestly: depth error, holes, edge
halos, stability and sharpness against the truth.

## Goal

1. **Scenes made by code.** Twelve or more original scenes built in Blender (run `bpy` from pip in
   the cloud if it installs; otherwise say so and hand the script over for a local run) or with the
   repo's own tools: a still life with glass and metal, a room interior, a forest path, stairs and
   railings (thin parts), a cliff and sea, a cluttered desk, hair or fur on an object, a night
   street with lamps (no signs or text), and others that stress depth edges. Everything original and
   CC0, credited "made by Ryan with Codex" (Rules v1, B4). No people, logos or readable text.
2. **For each scene:** a 1,280 px still with its exact depth map, a 4-second 30 fps clip with a
   gentle handheld-style camera path and its per-frame camera poses and depth, and a 10-second
   walk-through clip for Video to 3D with poses.
3. **A scorer:** `tools/studio-truth.mjs` that runs each toy on these inputs in a real browser and
   reports depth error, hole pixels, edge halo, frame-to-frame jitter and held-out sharpness. Give
   `main`'s scores in the report.
4. **Size:** keep the scenes out of the shipped site (a `tests/fixtures/truth/` folder or a release
   archive with a download script); the repo gains no more than 40 MB. Say where the full set lives.

## Don't touch

The files of the open PRs (#560, #562, #566, #581 and #582), `src/`, and `vendor/`. This task adds
tools, fixtures and a report only.

## Report

`docs/audits/studio-truth-2026-10.md`: each scene, how it was made, and `main`'s scores per toy,
with a contact sheet. Before you push: `npx prettier --check .` and
`node tools/us-english.mjs --diff` are clean.

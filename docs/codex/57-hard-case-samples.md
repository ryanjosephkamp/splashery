# Codex task 57: hard-case pictures for Photo to 3D (AI-made samples, round 2)

**Branch:** `codex/hard-case-samples`, cut from `main`. One draft PR against `main`.

Read `AGENTS.md`, `builders/RULES.md` (A2 and A3), CLAUDE.md's "AI-made samples",
`docs/handoff/DotSamples.md`, `docs/codex/54-sample-pictures.md` and the samples that task 54 added
(PR #582).

## Why

The owner loved task 54's pictures. This round makes pictures that are hard for 2D-to-3D, so the
samples show off the toy and double as a stress test for tasks 48 and 53.

## Goal

1. Make about **40 AI-made pictures** and keep the best **20**, in these hard cases: glass and water
   (a jug, a fish bowl, rain on a window), hair and fur (a cat on a rug, a long-haired dog in
   grass), thin structures (bicycle spokes, a fence, a spider web with dew, bare branches),
   reflections (a puddle, a polished floor, a lake), night and low light (lanterns, a campfire),
   macro (a beetle on a leaf, frost), and dense clutter (a workshop bench, a market stall with no
   text). The same strict rules as task 54: no people or faces, no logos or brand names, no readable
   text, no real landmark or real place presented as real.
2. Score each in the toy (holes, edge halo at ±20° and ±30°, using task 53's measures if they have
   landed, else task 54's) and keep the 20 that look best **and** cover every hard case.
3. Label each as AI-made beside it, in a "Hard cases" group in the sample picker, and record each in
   `CREDITS.md` and `tools/assets.json` as AI-made by the owner (task 54's wording), with its depth
   map from `tools/dsm-depth.mjs`. 1,280 px wide JPEG or WebP, loaded only when picked.

## Don't touch

The files of the open PRs (#560, #562, #566, #581 and #582) and `manual/`. If #582 is still open
when you start, add your own sample list file instead of editing the one it changes, and say so.

## Report

`docs/audits/hard-case-samples-2026-10.md`: every candidate with its scores, the kept 20 with the
hard case each covers, and a contact sheet (folder under 8 MB). Tests: `tests/cdx-pics*.spec.mjs`
(each new sample loads and turns to 3D), plus `p3d*`, `smoke`, `help`, `unit` and `taps` (never edit
`tests/taps.spec.mjs`). Before you push: `npx prettier --check .` and
`node tools/us-english.mjs --diff` are clean.

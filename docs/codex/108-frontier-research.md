# Codex task 108: the frontier, what's new in 3D that Splashery could run in a browser (up to 8 hours)

**Branch:** `codex/frontier-research`, cut from `main`. One draft PR against `main` with the report
and two prototype pages only. Raw notes and downloads go on `codex/frontier-research-clips`, never
merged. This task needs the web.

## Why

Splashery's best toys (Photo to 3D, Video to 3D, Moving photo, the Splat mirror) came from bringing
a recent research idea into a phone browser. The owner wants the next ones: ideas that feel
impossible, built light enough for a phone. Splashery may use techniques that aren't pure Gaussian
splats (meshes, other primitives, neural parts) when it documents them. This task finds the
candidates and proves the best two can run.

## Part 1: the survey (5 hours at most)

Cover work from 2024 to 2026: papers, code, and model cards. At least these areas:

- **Other primitives:** 2D Gaussian surfels, triangle and beta splatting, and ray-traced Gaussians.
- **Feed-forward 3D:** one or a few images to 3D in a single pass, without training per scene.
- **Single-image depth and normals:** depth, normals, and camera estimates, and what is phone-sized.
- **Moving scenes:** 4D and dynamic splats from video, and how they're compressed.
- **Light and materials:** relighting, materials, and reflections on splats.
- **Editing:** segmenting, cutting, combining, and inpainting splat scenes.
- **Compression and streaming:** SOG, SPZ, progressive levels of detail, and WebGPU sorting.

For each candidate, record:

- the license for **code and weights**, checked on the live page;
- model size and runtime with ONNX Runtime Web or WebGPU;
- whether it could run on a phone;
- what it would let a person do in Splashery, in one sentence;
- the risks;
- the effort.

Only Apache-2.0, MIT, or BSD can ship. List others for reference only.

## Part 2: two prototypes (3 hours at most)

Pick the two candidates with the best value for their effort. For each, build a standalone page,
`tools/pages/frontier-<name>.html`. It runs the core of the idea in Chromium on the CPU or WebGPU,
on one sample, and states its time and memory. It is not shipped and is not linked from the site.
Use only open-licensed weights, fetched at runtime from their official host on the page itself,
never committed.

## Deliverables

- `docs/audits/frontier-2026-10.md`: at most 300 lines.
  - One table of every candidate.
  - The top five, each with a one-page build plan: what to build, where it lives, the gates to hold
    it to, and whether it suits Codex or a Claude lane.
- The two prototype pages, and their results in the report.

## Rules

No change to the site, any toy, or the engine. No weights or third-party code in the PR. Every claim
links to its source. American English and the serial comma. PR body: Summary, Verification,
Deviations, Known issues, and What was cut.

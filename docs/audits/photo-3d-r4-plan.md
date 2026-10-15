# Photo to 3D round 4 implementation plan

Built by Codex (GPT-6). Spec: [task 76](../codex/76-photo-3d-r4.md). Checkpoint:
`58f3d8ede13714bf4b3d1f99fbf3b29d7f60e492`. The run started on October 14, 2026, at 03:29 UTC; stop
by 15:29 UTC.

**Goal:** improve hidden background texture and thin edges on every required input, reduce phone
time to the first 3D frame by at least 25%, and preserve all existing behavior.

**Architecture:** investigate the existing source-guided depth and donor background first. Keep new
reconstruction work in the photo worker, preserve visible source pixels, and measure actual rendered
results against the immutable checkpoint. Optimize the measured critical path without reducing
parallax, resolution, or depth quality.

**Tech stack:** static ES modules, vendored PlayCanvas and ONNX Runtime Web, Playwright, Chromium,
and the existing evidence tools. No visitor data leaves the device.

## Constraints and review focus

- Keep all existing test assertions and thresholds unchanged.
- Do not change Moving photo or Video to 3D ownership files.
- Test narrow background regions, sloping painted surfaces, tiny or transparent uploads, interrupted
  uploads, and switches between Sharp and Splats.
- Record missing measurements as missing; synthetic evidence alone cannot prove natural images.
- Keep review media on `codex/photo-3d-r4-clips`, never merged.

## Tasks

- [x] Reproduce checkpoint frames and upload timing. Inventory every sample and ten extra CC0
      photos, checking their live license pages. Include task 56 if merged.
- [x] Add calibrated streak and fringe measures with synthetic fixtures that expose current
      failures. Record coverage and worst pose for each sample.
- [x] Test texture continuation in hidden pixels; preserve visible pixels and narrow donors. Keep a
      production change only after its failing regression and comparison pass.
- [x] Test refinement of thin structures against source color without flattening painted slopes.
      Keep the existing text, depth, and shared relief checks green.
- [x] Profile the real file-pick-to-render path, optimize its dominant work, and compare isolated,
      repeated phone runs including cold initialization and warm uploads.
- [x] Run the required comparisons and regression checks to the time limit. Recorded render
      coverage: 1548/1548; unresolved and earlier-source specs remain explicit.
- [x] Record all 86 paired phone clips and publish review evidence, measured limits, and draft PR
      #622. The universal goal remains unmet. Rule check: none.

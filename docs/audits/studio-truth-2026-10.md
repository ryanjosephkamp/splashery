# Studio ground truth, October 2026

Codex (GPT-6) reconstructed this implementation from task 56's repository brief. All evidence in
this report comes from this implementation's Linux cloud runs. The baseline is unmodified `main` at
`58f3d8ede13714bf4b3d1f99fbf3b29d7f60e492`; no product source or vendor files are changed.

This checkpoint contains the seeded Blender generator, independent camera checks, a metric library,
and a fixture validator. Dataset generation and browser measurements are still in progress. It is
not a completed baseline.

The [fixture guide](../../tests/fixtures/truth/README.md) defines units, intrinsics, extrinsics,
invalid pixels, and appearance masks. Glass and reflections have first-hit geometry depth, which is
not universal appearance truth. The stills are 1280×720; the four-second and ten-second videos are
640×360 at 30 fps. The videos' lower resolution is an explicit deviation from a full-resolution
video dataset.

Fresh checkpoint verification:

- `python3 tests/studio-truth-camera.py`: 3 passed.
- `node --test tests/studio-truth.test.mjs`: 6 passed.
- Sandboxed Chromium 151.0.7922.173 launches with no graphics overrides; its initial probe offers
  WebGL2 but no WebGPU. Actual toy scoring is pending.
- Pip exposes no compatible `bpy` wheel for Python 3.12 in this environment; the generator uses the
  installed native Linux Blender 4.3.2 instead.

Full clip data and archives belong in the ignored `.cache/studio-truth/` directory. Compact stills
will be checked against the 40 MB task budget before being added to Git. No full archive has been
hosted at this checkpoint.

Rule check: none. Procedural assets are CC0, made by Ryan with Codex (GPT-6). There is no phone
hardware evidence. Desktop browser viewports are not phone testing.

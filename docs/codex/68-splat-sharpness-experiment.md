# Codex task 68: sharper splats on screen, a Workshop experiment

Do task **T9** in `builders/TASKS.md` (an engine experiment, in the Workshop only, changing nothing
in `src/` or `vendor/`) for this idea: **draw splats sharper without shimmer.** Compare the engine's
current splat drawing with (a) a mip-style screen-space filter that keeps small splats from aliasing
without blurring large ones, (b) a tighter cutoff of each splat's footprint, and (c) a sharper sort
or blend order where splats overlap, on the Studio's Photo to 3D and Video to 3D samples and three
kit toys, at phone and desktop sizes.

Measure each against the current engine: frame time, a sharpness score (gradient energy of the
render), shimmer while turning (frame-to-frame change in a still scene), and side-by-side stills. If
the Workshop foundation (task 64) hasn't merged, build a standalone page under
`workshop/splat-sharpness/` with its own README. Recommend promote, iterate or drop, and if promote,
describe the small additive "Engine: …" PR; don't make it.

Branch `codex/t9-splat-sharpness`: one draft PR against `main` with the project, the comparison,
screenshots at 390×844 and 1440×900, a clip, and the record. Before you push:
`npx prettier --check .` and `node tools/us-english.mjs --diff` are clean.

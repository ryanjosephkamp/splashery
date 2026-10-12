# Codex task 42: the Fluid Lab, smooth on a phone

**Branch:** `codex/fluid-lab-phone-r2`, cut from `main`.

**You may change:** `src/packs/fluid-lab.js`, everything under `src/fluids/`, new
`tools/cdx-fl2-*.mjs`, new `tests/cdx-fl2*.spec.mjs`, `docs/FLUIDS.md` (a new section only), and a
report at `docs/audits/fluid-lab-phone-r2-2026-10.md`. Don't edit `vendor/` or the engine outside
`src/fluids/`; if a fix needs one, describe it in the report.

## Where it stands

Codex task 14 measured the Fluid Lab at phone size (`docs/audits/fluid-phone-2026-10.md`), and the
Fluids r7 lane built its five proposals (`src/fluids/phone.js`, the runtime's watch and restart, the
projector hook, reused readback arrays; `docs/FLUIDS.md`, around line 398). What r7 left open: the
heap still rises about 1.4 MB per scene cycle; 35,000 prop splats may show holes; the smaller
liquids have not been judged on a phone; every number came from a software renderer, not a phone.
The owner wants the Fluid Lab to run well on a phone.

## Steps

1. **Measure first**, the way task 14 did (390x844, device scale 3, 4x and 6x CPU throttle, WebGL2
   and WebGPU), for every preset and scene: frame time p50 and p95, solver time, heap over ten scene
   cycles, splat count, and holes in the props (pixels where the backdrop shows through a solid).
   Save the "before" table.
2. **Targets at the phone tier, 4x throttle:** p95 frame time 20 ms or less in every preset; no heap
   growth over ten cycles (within 0.2 MB); no visible holes in the props. Get there by any means
   inside `src/fluids/`: fewer, larger particles where the eye can't tell; a cheaper surface pass;
   work spread over frames; smarter step-down that rebuilds only what changed.
3. **The look stays right.** Water still looks like water, smoke like smoke, at phone size (the
   effect quality rules in `CLAUDE.md`). Render each preset at 390x844 before and after with
   `tools/effect-clip.mjs` and compare side by side.
4. **For the owner's phone.** Add a small "Performance" readout in the lab (frame time, tier,
   particle count), shown only with `?labs=1&perf=1`, so the owner can check it on his own phone and
   report back.
5. **Tests.** `tests/cdx-fl2*.spec.mjs`: the heap check over cycles and the frame-time budget at the
   phone tier (with a margin for the test machine). Keep green: `fl`, `fl7` and the `smoke` file.
6. **Report.** `docs/audits/fluid-lab-phone-r2-2026-10.md`: before-and-after tables, what changed
   and why, the side-by-side clips in the PR, and anything that needs the engine or a real phone.

Before you push, run `npx prettier --check .` and `node tools/us-english.mjs --diff`. Open a draft
PR titled "Codex task 42: the Fluid Lab, smooth on a phone" with the five sections from CLAUDE.md
and a "Rule check" line (`builders/RULES.md`).

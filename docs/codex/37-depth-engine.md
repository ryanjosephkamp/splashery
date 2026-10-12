# Codex task 37: faster, steadier depth for the Studio

**Branch:** `codex/depth-engine`, cut from `main`. One of five Studio tasks (37 to 41) that run at
the same time; the file list below keeps them apart.

**You may change:** `src/live/depth-worker.js`, `src/packs/photo-3d-depth.js`, new files under
`src/depth/`, new `tools/cdx-depth-*.mjs`, new `tests/cdx-depth*.spec.mjs`, and a report at
`docs/audits/depth-engine-2026-10.md`. Nothing else. Tasks 38 to 41 own the toys that call these
files; keep every function they call (its name, arguments and what it returns) working exactly as
now, and add new options rather than changing old ones.

## Why

Every 2D-to-3D toy (Photo to 3D, Moving photo to 3D, Splat mirror) gets its depth from Depth
Anything V2 Small (int8 ONNX, 27 MB, `vendor/depth-anything-v2-small/`, Apache-2.0), run by ONNX
Runtime Web on **WASM, one thread** (`vendor/onnxruntime-web/ort.wasm.min.mjs`). Photo to 3D runs it
on the main thread (`src/packs/photo-3d-depth.js`), so the page freezes for 3.5 to 5 seconds, longer
on a phone. The owner wants depth that is as fast as possible and as good as possible, so that a
person's own photo or video comes out as smooth and gap-free as the samples (which ship with depth
worked out ahead of time).

## Steps

1. **Measure first.** `tools/cdx-depth-bench.mjs`: for each Photo to 3D sample and the five Moving
   photo samples' first frames, time the model (load, first run, later runs) and record its output.
   Report the times at a phone profile (4x CPU throttle through CDP) and on desktop. Save the
   "before" numbers.
2. **Off the main thread.** Photo to 3D's depth moves into a worker (reuse or extend
   `depth-worker.js`). The page never freezes while depth runs; progress shows.
3. **Faster on the same model.** Try, and measure each:
   - WASM threads and SIMD (needs cross-origin isolation, which GitHub Pages can't set: check
     whether a service-worker approach works, and say plainly if it can't);
   - a WebGPU or WebNN execution provider, falling back to WASM;
   - input size per device tier, fp16 or int8 variants, reusing the session and its buffers;
   - for clips: running the model on fewer frames and guiding the rest with the picture.
4. **Better depth.** Benchmark candidate models on the same inputs, for quality (edge sharpness,
   flat surfaces staying flat, frame-to-frame steadiness on clips) and speed. Include video-
   consistent depth models (for example Video Depth Anything Small) and newer small monocular
   models. For each, record the license **from its live model page**, the file size and the speed.
   Only Apache-2.0, MIT, BSD or CC BY weights can ship; note any NC or custom license and leave it
   out.
5. **Approved by the owner (October 12, 2026).** A new runtime bundle (for example ONNX Runtime
   Web's WebGPU or WebNN build) and better model weights may ship even over 2 MB (B3 in
   `builders/RULES.md`), when their license is Apache-2.0, MIT or BSD, checked on the live source
   page. Vendor them in `vendor/`, load them only when a 2D-to-3D toy needs depth, keep the WASM
   path as the fallback, list each in `LICENSES.md`, and say in the PR exactly what each file adds
   and how big it is. Anything under another license (NC, custom, GPL) stays out: report it only.
6. **Tests.** `tests/cdx-depth*.spec.mjs`: the worker answers for a photo and for a clip frame; the
   page stays responsive (no long task over 200 ms) while Photo to 3D works out depth; the fallback
   path runs when WebGPU is missing. Keep green: `p3d`, `phf`, `phf2`, `phf-engine`, `smd-photo`,
   `smd-moving`, `live`, `live3`, `lv7`, `psv*`.
7. **Report.** `docs/audits/depth-engine-2026-10.md`: a before-and-after table (time per device
   tier, main-thread freeze), the model comparison with licenses and sizes and pictures of each
   model's depth on three samples, your recommendation, and what the other four tasks should do with
   it.

Before you push, run `npx prettier --check .` and `node tools/us-english.mjs --diff`. Open a draft
PR titled "Codex task 37: faster, steadier depth for the Studio" with the five sections from
CLAUDE.md (Summary, Verification, Deviations, Known issues, What was cut), and a "Rule check" line
(`builders/RULES.md`).

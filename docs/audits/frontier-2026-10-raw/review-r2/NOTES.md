# Frontier review revision 2

October 17, 2026. Codex (GPT-6) addressed the Operator's comment on PR #697:
https://github.com/ryanjosephkamp/splashery/pull/697#issuecomment-6232478373

The lighting page now runs the already vendored Depth Anything V2 Small int8 ONNX model through
`estimateDepth`, on the existing CC0 `assets/toys/photo-3d/still-life.jpg`. No new weights, source
photographs, or libraries were downloaded or added. The original image and model retain their
existing credits and license records.

Both modes use exactly the same depth-only normal estimator. The analytic scene no longer has object
IDs. Reference normals enter only the error metrics. Synthetic tests verify depth-step rejection,
plane orientation, depth scale invariance, affine inverse-depth invariance, and invalid-data
handling. At the default cutoff, 305 accepted analytic pixels exceed 5 degrees and maximum angular
error is 79.852 degrees. The p95 alone is not a boundary-quality guarantee.

Photo tests ran a fresh model call and a session-reused call in each of two fresh Chromium contexts,
at 1440×900 and 390×844. All four raw inferred inverse-depth maps have the same SHA-256. One
same-origin vendored ONNX request occurs per context, only after the photo button. No external or
prebaked depth requests occur. A deliberately aborted model fetch surfaces an error and the analytic
check remains usable. All four screenshots were opened for visual inspection.

`browser-results.json` contains actual measurements. `verify.mjs` is the original MIT harness;
adjust its environment-specific Playwright and Chromium paths before reuse. It expects the report
branch's page on port 4173. The 21-frame lighting distributions exclude a warm-up. These are desktop
CPU results, not physical-phone measurements. Photo ground truth, full process peak memory, the
native ORT/WASM heap, and WebGPU remain unmeasured.

Photo memory accounting lists live page arrays, estimated four canvas backings, and the worker's
retained input tensor. The 27,258,801-byte serialized model is separate; adding it is an accounted
minimum, not measured native model residency or process peak. The loaded worker persists until page
close.

The original LOD page and its initial measurements remain unchanged. This evidence folder is never
merged into main. Screenshots use the existing CC0 painting or original CC0 analytic geometry, with
credits visible on the page.

Final verification: main `c36c4dcd9` was merged; all 271 preflight tests passed in 9.1 minutes, and
every other step passed. Generated repository screenshots were restored. The report stays within 300
lines. The full suite beyond preflight was not run.

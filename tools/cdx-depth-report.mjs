// Rebuild the audit tables from the committed small measurement artifact.
import fs from "node:fs/promises";
const x = JSON.parse(await fs.readFile("src/depth/evidence/measurements.json", "utf8"));
const median = (values) => {
  const a = [...values].sort((a, b) => a - b);
  return (a[Math.floor((a.length - 1) / 2)] + a[Math.floor(a.length / 2)]) / 2;
};
const ms = (n) => Math.round(n).toLocaleString("en-US");
const pct = (n) => (100 * n).toFixed(2) + "%";
const warm = (rows) => median(rows.map((r) => r.runs[1].inferenceMs));
const summaries = x.before.profiles
  .map((b, i) => {
    const a = x.after.profiles[i];
    return `| ${b.rate === 1 ? "Desktop, 1440×900" : "Phone profile, 390×844, CDP 4×"} | ${ms(b.rows[0].loadMs)} → ${ms(a.rows[0].loadMs)} | ${ms(warm(b.rows))} → ${ms(warm(a.rows))} | ${ms(Math.max(...b.rows.map((r) => r.maxTask)))} → ${ms(Math.max(...a.rows.map((r) => r.maxTask)))} | ${b.rows.filter((r, j) => r.sha256 === a.rows[j].sha256).length}/41 |`;
  })
  .join("\n");
const sizes = [196, 294, 392, 518]
  .map((side) => {
    const source = side === 518 ? x.after : x[`side-${side}`];
    const rows = source.profiles[0].rows.filter((r) =>
      [
        "forest",
        "street",
        "still-life",
        "clip-sample",
        "clip-horse",
        "clip-dragon",
        "clip-bridge",
        "clip-machine",
      ].includes(r.id),
    );
    const q = side === 518 ? x.quality.before : x.quality[`side-${side}`];
    return `| ${side} | ${ms(warm(rows))} | ${pct(median(Object.values(q).map((q) => q.mae)))} | ${Object.values(
      q,
    )
      .map((q) => q.edgeRatio.toFixed(2))
      .join(" / ")} |`;
  })
  .join("\n");
const modelRows = [
  [
    "V2 Small int8",
    27258801,
    x.after.profiles[0].rows.filter((r) =>
      [
        "forest",
        "street",
        "still-life",
        "clip-sample",
        "clip-horse",
        "clip-dragon",
        "clip-bridge",
        "clip-machine",
      ].includes(r.id),
    ),
    "Existing WASM, one thread",
  ],
  ["V2 Small fp16", 49642442, x.fp16.profiles[0].rows, "WASM, one thread"],
  ["V2 Small q4f16", 19126267, x.q4f16.profiles[0].rows, "WASM, one thread"],
  ["DA3 Small ONNX", 105343155, x.da3.profiles[0].rows, "WASM, one thread; five-dimensional input"],
]
  .map(
    ([name, bytes, rows, backend]) =>
      `| ${name} | Apache-2.0 | ${bytes.toLocaleString("en-US")} | ${ms(warm(rows))} | ${backend} |`,
  )
  .join("\n");
const qRows = ["before", "fp16", "q4f16", "da3", "video-518"]
  .map((g) => {
    const q = x.quality[g];
    return `| ${g} | ${pct(q.forest.mae)} | ${pct(q.street.mae)} | ${pct(q["still-life"].mae)} | ${q.street.edgeRatio.toFixed(2)} | ${q.street.roadCurvature.toFixed(5)} |`;
  })
  .join("\n");
const clipRows = x.clips
  .map(
    (c) =>
      `| ${c.id} | ${ms(c.results[0].ms)} | ${ms(c.results[1].ms)} / ${c.results[1].modelRuns} | ${pct(c.results[1].mae)} | ${ms(c.results[2].ms)} / ${c.results[2].modelRuns} | ${pct(c.results[2].mae)} |`,
  )
  .join("\n");
const temporalRows = x.temporal
  .map(
    (r) =>
      `| ${r.id} | ${r.staticPixels.toLocaleString("en-US")} | ${pct(r.v2Int8Residual)} | ${pct(r.videoResidual)} |`,
  )
  .join("\n");
const frameRows = [];
for (const rate of [1, 4])
  for (const side of [196, 294]) {
    const b = x.frames.find((r) => r.rate === rate && r.side === side && r.version === "before");
    const a = x.frames.find((r) => r.rate === rate && r.side === side && r.version === "after");
    frameRows.push(
      `| ${rate}× / ${side} | ${ms(warm(b.rows))} → ${ms(warm(a.rows))} | ${b.rows.filter((r, i) => r.sha256 === a.rows[i].sha256).length}/5 |`,
    );
  }
const allTables = x.before.profiles
  .map((b, i) => {
    const a = x.after.profiles[i];
    const rows = b.rows.map(
      (r, j) =>
        `| ${r.id} | ${r.output.join("×")} | ${r.runs.map((k) => ms(k.inferenceMs)).join(" / ")} | ${a.rows[j].runs.map((k) => ms(k.inferenceMs)).join(" / ")} | ${ms(r.maxTask)} / ${ms(a.rows[j].maxTask)} |`,
    );
    return `### ${b.rate === 1 ? "Desktop" : "Phone profile (CDP 4×)"}\n\n| Input | Output | Before: first / repeat, ms | After: first / repeat, ms | Largest before / after task, ms |\n| --- | --- | --- | --- | --- |\n${rows.join("\n")}`;
  })
  .join("\n\n");
const threads = x.capabilities.rows
  .filter((r) => r.options.threads)
  .map(
    (r) =>
      `| ${r.threads || r.options.threads} | ${r.times ? r.times.map(ms).join(" / ") : r.error} |`,
  )
  .join("\n");
const fullRows = ["fp16-all", "q4f16-all", "da3-all"]
  .map((g) => `| ${g} | ${x[g].profiles[0].rows.length} | ${ms(warm(x[g].profiles[0].rows))} |`)
  .join("\n");
const videoWarm = median(x.video.rows.map((r) => r.times[1]));
const videoFull = x["video-518"].rows
  .map((r) => `${r.id}: ${ms(r.times[0])} / ${ms(r.times[1])}`)
  .join("; ");
const body = `# Depth engine audit: October 12, 2026

Codex (GPT-6) built the shared worker engine on \`codex/depth-engine\`, from main at
\`1ecc57dc\`. Photo inference, area resampling, and tensor packing now run in that worker.
The default model and input size remain compatible with every existing caller. All **102**
paired depth outputs match the original code byte for byte: 82 photo-style captures and 20
production clip-frame captures. The largest observed main-thread task during the photo depth
benchmark was 71 ms after the change.

Recommendation: ship the worker and its default int8/WASM path. Offer smaller inputs and sparse
clip guidance as explicit options after reviewing their depth changes. Keep the current weights;
none of the measured replacement candidates gives a clear speed-and-quality win for this browser
path. Added runtime/model weight bytes: **0**.

## What changed

- \`estimateDepth(photo, onStatus, options = {})\` keeps its original \`{ w, h, d, ms }\` return.
  The caller keeps its RGBA bytes. The worker owns preprocessing and inference.
- \`loadDepthModel(onStatus)\` still returns \`{ ort, s }\`; \`s\` is a worker facade with real
  Tensor inputs and outputs, input/output metadata, \`run()\`, and \`release()\`. Existing warm-up
  tools keep working. \`MODEL_URL\`, \`RUNTIME_URL\`, and \`fetchBytes\` retain their interfaces.
- The existing \`frame\` → \`depth\` protocol keeps its IDs, dimensions, relative inverse depth,
  and timings. Camera and clip callers retain their quiet status after loading. Errors now carry
  the request ID. A serial queue protects the reusable session and input Tensor from overlapping
  requests; output Tensors are released after copying their data.
- Photo to 3D's existing progress line shows model download progress and inference status. Its
  current reader does not forward its fifth progress argument, so the depth module bridges that
  existing line. Task 39 should pass the callback directly. No toy-owned file was changed.
- New options: \`side\` or \`tier\` (low 294, mid 392, high/max 518). Omitting them keeps 518.
  Separate clients can initialize a same-origin model/runtime and request \`webgpu\` or \`webnn\`.
  Missing hardware, initialization failure, and run failure use the independent WASM module;
  accelerated initialization/runs have a 15-second deadline before CPU fallback. The default
  requests only the existing WASM bundle.
- \`estimateClipDepth\` in \`src/depth/client.js\` is an optional separate-worker API. It returns
  \`{ depths, modelRuns }\` plus message metadata. Local color patches guide depth between anchors;
  large appearance changes use full inference. Existing toys continue through their original APIs.

## Measurement method and limits

Chromium \`${x.before.browser}\` on Linux, AMD EPYC 9V74, with a four-CPU quota. The static
server ran on 127.0.0.1:4173. The desktop viewport was 1440×900; the phone profile was 390×844
with CDP \`Emulation.setCPUThrottlingRate({ rate: 4 })\`. This is **not a physical phone**.

CDP's page throttle does not impose a four-times-slower worker CPU in this setup. That is visible
in both the original and new clip workers. Consequently the after-phone inference numbers are
host-worker timings, not claimed phone performance. The page's responsiveness is still measured
under the four-times throttle. Real phone thermals, memory pressure, and GPU performance remain
unmeasured.

Every one of the 36 Photo to 3D samples (six CC0 photos and 30 existing AI-made Studio samples),
and the first frame of all five Moving photo samples, was run at the common 518 input for the
before/after comparison. A session loaded once per profile; each input then ran twice. The first
run in a row is the first run for that input/shape, not a fresh model session. Cold \`loadMs\`
includes runtime import, local model fetch, and session creation. These are local-server load
figures, not Internet download measurements.

The benchmark observes long tasks around load and the two-run burst. Consecutive original
main-thread runs can share one long task, so the before peak is not a single-photo latency.
The strict tests measure the depth call after image decoding/imports have ended their task;
image decoding and later splat construction belong to the callers and remain outside this change.
The numerical timings are small-sample observations, not confidence intervals. Complete candidate
sweeps overlapped browser regressions and are labeled separately below; those timings include CPU
contention.

Raw float maps and research binaries stay in the local \`.cache/cdx-depth\` folder. The small
[measurement artifact](../../src/depth/evidence/measurements.json) records times, dimensions,
and SHA-256 output hashes; the figures below can be rebuilt with the supplied tools.

## Before and after

All figures below are milliseconds. Warm inference is the median of the repeat run over 41 inputs.

| Profile | Cold load before → after | Warm inference before → after | Largest two-run long task before → after | Matching output hashes |
| --- | --- | --- | --- | --- |
${summaries}

The production clip protocol was also measured on each sample's first frame, using the original
\`depth-worker.js\` at the baseline commit and the new worker. Inputs were the same byte-valued
RGBA from the existing \`shrink\` helper. Low/mid clips use 196; high/max clips use 294.

| Page throttle / long side | Median repeat inference before → after, ms | Matching hashes |
| --- | --- | --- |
${frameRows.join("\n")}

The extra worker/message overhead does not make the same CPU computation intrinsically faster.
Session reuse and buffer reuse are in place; the reliable gains here are responsiveness and the
optional reduction in inference work.

## Runtime experiments

**SIMD:** the installed browser's WebAssembly SIMD validation probe passed. The existing vendored
\`ort-wasm-simd-threaded.wasm\` already provides SIMD; this was also the baseline path. No scalar
build is supplied in this checkout, so no non-SIMD speed number is claimed.

**Threads:** the unmodified static page reported \`crossOriginIsolated: false\` and no shared
memory. A locally scoped service worker adding COOP/COEP response headers, followed by a reload,
reported \`crossOriginIsolated: true\` and enabled the existing runtime's extra threads. Both the
worker bootstrap and ORT's nested worker scripts needed to live under the controlled scope; the
first outside-scope bootstrap failed. The scope experiment is reproducible with
\`tools/cdx-depth-capabilities.mjs\`.

| Threads | Forest inference: first / repeat / repeat, ms |
| --- | --- |
${threads}

This establishes a working service-worker approach locally. It is not enabled on the public
GitHub Pages app. Production needs a root-scope worker or server headers, a controlled reload,
and a review of existing service-worker ownership and cross-origin resources. The allowed file
list does not include those entry points. The engine therefore keeps one thread by default and
clamps requested extra threads back to one without isolation. Background: the opened
[MDN isolation reference](https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated),
[coi-serviceworker implementation](https://raw.githubusercontent.com/gzuidhof/coi-serviceworker/master/coi-serviceworker.js),
and [ORT environment reference](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html).

**WebGPU:** normal Chromium had no adapter; the software-adapter launch flags exposed one.
The full 1.30.0 runtime package was downloaded only into the research cache. Its WebGPU path
requires the package's asyncify/JSPI files as well as its JS entry; adding only the older JSEP
pair was insufficient. A software-provider run did not finish within the research tool's
60-second bound. Hardware GPU speed is unmeasured. GPU failures must not poison the fallback's
WASM initialization, so the engine switches to the independent WASM-only module, not a retry of
an already-failed JSEP instance. Real CPU inference tests cover missing hardware, failed GPU
initialization, and a simulated stalled accelerated run. The final real software-adapter probe also
switched from WebGPU to WASM after the 15-second deadline: the first reply took about
17.5 seconds including recovery, and the next two inferences took about 1.8 seconds.
The shipped engine uses that shorter bound for the optional accelerated path.

**WebNN:** \`navigator.ml\` was absent. The request fell back to WASM and produced real depth.
No native WebNN speed is claimed. Opened references:
[WebGPU](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html),
[WebNN](https://onnxruntime.ai/docs/tutorials/web/ep-webnn.html), and the
[MIT runtime license](https://raw.githubusercontent.com/microsoft/onnxruntime/v1.30.0/LICENSE).
No new runtime files are shipped, so \`LICENSES.md\` needs no new bundle entry.

## Input size and clip work

The following eight-input desktop sweep uses the three illustrated photos and all five clip
first frames. Depth differences are relative to the 518 int8 output, after percentile
normalization; they measure agreement, not accuracy. Edge ratios are forest/street/still-life
on a common 96×64 grid. Lower resolution changes the model's guess as well as smoothing edges.

| Long side | Median repeat inference, ms | Median photo depth MAE | Edge-strength ratios |
| --- | --- | --- | --- |
${sizes}

![Depth at four input sizes](../../src/depth/evidence/sizes.png)

392 is a useful opt-in starting point for photos. 294 trades more detail for speed; 196 loses
substantial forest detail and remains a clip/live starting point rather than the photo default.

For sparse guidance, each clip used its first six consecutive sheet frames at a 196 long side,
with a warmed model. Dense inference uses all six. Anchor spacing two uses four model calls;
spacing three uses three. Time includes preprocessing and color-patch guidance. MAE compares
independently normalized maps with dense inference on the same frames.

| Clip | Dense time, ms | Spacing 2 time / model calls | Depth MAE | Spacing 3 time / model calls | Depth MAE |
| --- | --- | --- | --- | --- | --- |
${clipRows}

Spacing two is the conservative experiment. The horse and dragon show larger changes, and
spacing three reaches about eight to nine percent disagreement on several clips. This is
why the helper is opt-in. The tests also show a translating edge follows its image rather than
splitting into two blended edges, and a skipped scene change receives its own model result.

## Candidate models, licenses, and depth quality

All model licenses below were checked on their **live model pages on October 12, 2026**.
Sources and exact revisions:

- [V2 Small ONNX](https://huggingface.co/onnx-community/depth-anything-v2-small), Apache-2.0,
  revision \`4472b7362082ad9968fee890ca0f1e5aca36b93d\`: existing int8, fp16, and q4f16 variants.
- [DA3 Small ONNX](https://huggingface.co/onnx-community/depth-anything-v3-small), Apache-2.0,
  revision \`0b6a7f3bf5595f9950b91389e0da3a0de130324c\`; also checked the
  [upstream DA3 Small page](https://huggingface.co/depth-anything/DA3-SMALL).
  The ONNX graph is 640,691 bytes and its external weights are 104,702,464 bytes; counting
  only the graph would badly understate the download. ImageNet normalization was confirmed in
  the opened [upstream input processor](https://raw.githubusercontent.com/ByteDance-Seed/depth-anything-3/main/src/depth_anything_3/utils/io/input_processor.py).
- [Video Depth Anything Small](https://huggingface.co/depth-anything/Video-Depth-Anything-Small),
  Apache-2.0, revision \`256875362cff76724b920335dfb4b29dd611f66e\`, 116,440,756-byte PyTorch weights.
- [DepthPro ONNX](https://huggingface.co/onnx-community/DepthPro-ONNX), Apple ASCL/custom,
  excluded from shipping and inference. Its int8 file is 1,009,098,595 bytes. The live card's
  custom license is outside this task's allowed weights; it was not downloaded.

The controlled eight-input candidate sweep used a 518 long side. Each model reused one session
and ran each input twice; all ONNX candidates ran in a browser worker using the existing WASM
runtime. DA3 has a five-dimensional input and outputs distance-like depth, which the research
worker converts to inverse depth for the common comparison. These are not interchangeable model
files for the production four-dimensional V2 preprocessing.

| Model/variant | Live weight license | File bytes | Median repeat, ms | Backend |
| --- | --- | --- | --- | --- |
${modelRows}
| Video Depth Anything Small, 196 | Apache-2.0 | 116,440,756 | ${ms(videoWarm)} per padded 32-frame window | PyTorch 2.9.0+cpu, two threads |
| Video Depth Anything Small, 518 | Apache-2.0 | 116,440,756 | ${ms(median(x["video-518"].rows.map((r) => r.times[1])))} per padded 32-frame window | Same native CPU research backend |

Video Depth Anything used its real temporal model, a 32-frame window padded with the final frame,
and the source checkout at \`4f5ae23172ba60fd7bc11ef671cca678842c7072\`. Static photos were repeated
through that window; clips used their first six frames. The 196 sweep used the same eight source
inputs. The 518 sweep used the three illustrated photos at the same output dimensions as the
ONNX photo sweep. It used PIL BOX resizing, while the ONNX path used the site's exact area
resampler. Its native CPU backend and two threads differ from browser WASM, so these are
**not browser speed claims**. At 518, first/repeat window times were: ${videoFull} ms.
No browser export was produced or shipped.

![Candidate depth on three samples](../../src/depth/evidence/models.png)

White is nearer. Each image uses its own 2nd–98th percentile range. These images are depth guesses,
not ground-truth geometry. Quantized/half variants preserve the major outlines. DA3 changes the
forest's shape and some still-life details. Video depth's temporal benefit needs to be weighed
against its window cost and model size.

The numerical quality proxies below use percentile-normalized depth on a 96×64 grid. MAE is
agreement with existing int8 depth, not ground-truth error. The edge ratio measures mean depth
gradient magnitude. The street's lower-center road rectangle supplies a horizontal second-
difference curvature proxy: less curvature can mean a flatter surface or excessive smoothing.
There is no metric ground-truth depth for these samples, so no absolute accuracy winner is claimed.

| Model | Forest MAE | Street MAE | Still-life MAE | Street edge ratio | Street curvature proxy |
| --- | --- | --- | --- | --- | --- |
${qRows}

For frame-to-frame steadiness, pixels whose adjacent-frame RGB changed by less than 0.01 were
compared over the five frame pairs in each six-frame clip. Both model outputs were independently
percentile-normalized. This is a residual in regions whose colors stayed similar, not optical-flow ground truth;
uniform colors can hide motion, and blur can improve the score. The existing toy's additional
range smoothing and flat-picture attenuation are not included in this proxy.

| Clip | Qualifying pixel pairs | V2 int8 residual | Video depth residual |
| --- | --- | --- | --- |
${temporalRows}

Video depth is promising for offline sample preparation and a future measured browser export.
It is not a drop-in replacement for the photo model. The current int8 default wins the measured
CPU speed comparison; fp16 improves the road smoothness proxy but costs more time and bytes.
Q4f16 saves download bytes but is slower on this WASM backend. DA3 adds a much larger download
and a different interface without a demonstrated quality/speed advantage here.

All three ONNX candidates were additionally run on **all 41** inputs. Those sweeps overlapped
browser regression work and have higher wall times, so they verify coverage and output recording
rather than supply an uncontended ranking. Their complete per-input runs and hashes are in the
measurement artifact.

| Full sweep | Inputs | Median repeat, ms (contended) |
| --- | --- | --- |
${fullRows}

## What tasks 38–41 should do

| Task | Integration |
| --- | --- |
| 38, Moving photo | Keep the existing frame API as the compatibility path. Compare \`estimateClipDepth(frames, w, h, progress, { side: 196, keyEvery: 2 })\` with the current sampling, then pass its \`depths\` through the existing normalization/backing path. Preserve full inference at cuts and review moving edges. |
| 39, Photo to 3D | Pass the reader's progress callback to \`estimateDepth\`. Keep the default 518 output; trial \`{ side: 392 }\` or an explicit tier after checking detail. Guard stale read results if the selection changes while the now-responsive page is converting. Keep image decoding, splat construction, and backing fixes in the toy lane. |
| 40, Video to 3D | Reuse a persistent worker/session for V2-compatible depth needs. Keep reconstruction and frame-clock work separate from relative depth. Use the same benchmark inputs before adopting a new backend or weight export. |
| 41, Splat mirror | Existing frame messages work unchanged and remain quiet after model load. Retain one outstanding frame, use the current 196/294 input policy, and reuse the worker for the capture's lifetime. GPU/model changes require real device measurements. |

## Verification and handback

The new depth/UI tests use real browser WASM inference. Only hardware absence and accelerated
failure/stall behavior are mocked; no model outputs are mocked in those tests. The numerical
edge/cut fixtures isolate the sparse helper's behavior. UI checks opened a real file through the
panel at 390×844 and 1440×900, saw progress, switched tabs during inference, and verified a custom
photo with no page errors. The strict inference-phase long-task limit stays at 200 ms.

- New engine/UI tests: **12 passed**.
- Required caller files: \`p3d\`, \`phf\`, \`phf2\`, \`phf-engine\`, \`smd-photo\`, \`smd-moving\`,
  \`live\`, \`live3\`, \`lv7\`, \`psv\`, \`psv2\`, and \`psv3\`: **114 passed** (43.4 minutes).
- Embed transfer check: **passed, 9.1 MB** for the captured bee at the strong profile.
- Repository-wide Prettier, American English, and Git whitespace/scope checks: **passed**.
- No physical-phone, hardware-GPU, or native-WebNN run was available. The full repository suite
  was not run; this task specifies the caller files above.

Code is offered under the repository's MIT license. Original audit figures are CC0, made by Ryan
with Codex (GPT-6), from the repository's existing CC0 forest, street, and still-life samples.
The images and measurement JSON live under \`src/depth/evidence\`, within the task's allowed
new-file directory, and are audit artifacts. Runtime and model binaries remain unchanged.

**Rule check: none.** No merge, public-site deployment, new runtime bundle, or new weight file
is part of this draft handback.

## Reproduce

Start the existing static server and use the installed Chromium; do not install another browser.
Before numbers were captured before editing the production files. To repeat them on this branch,
extract the baseline source into \`.cache/cdx-depth/baseline/depth.js\` from
\`git show 1ecc57dc:src/packs/photo-3d-depth.js\`, change its core import to
\`/src/packs/photo-3d-core.js\`, and adjust its vendor URLs to the new cache directory's depth.
The frame benchmark performs its baseline extraction itself.

\`SPLASHERY_CHROMIUM=/usr/bin/chromium\` was used for every browser command here:

\`\`\`sh
node tools/cdx-depth-bench.mjs --label=before --engine=/.cache/cdx-depth/baseline/depth.js
node tools/cdx-depth-bench.mjs --label=after
node tools/cdx-depth-frame-bench.mjs
node tools/cdx-depth-capabilities.mjs
node tools/cdx-depth-clip-bench.mjs
node tools/cdx-depth-temporal.mjs
node tools/cdx-depth-evidence.mjs
node tools/cdx-depth-report.mjs
npx playwright test tests/cdx-depth.spec.mjs tests/cdx-depth-ui.spec.mjs
npx playwright test tests/p3d.spec.mjs tests/phf.spec.mjs tests/phf2.spec.mjs tests/phf-engine.spec.mjs tests/smd-photo.spec.mjs tests/smd-moving.spec.mjs tests/live.spec.mjs tests/live3.spec.mjs tests/lv7.spec.mjs tests/psv.spec.mjs tests/psv2.spec.mjs tests/psv3.spec.mjs
npx playwright test tests/smoke.spec.mjs --grep 'embedded captured toy stays under 30 MB'
npx prettier --check .
node tools/us-english.mjs --diff
\`\`\`

Research setup: unpack \`onnxruntime-web@1.30.0\` from its opened
[npm package manifest](https://registry.npmjs.org/onnxruntime-web/1.30.0) into
\`.cache/cdx-depth/ort/package\`. Download the allowed ONNX files at the exact Hub revisions above;
the benchmark expects \`fp16.onnx\`, \`q4f16.onnx\`, \`da3.onnx\`, and
\`da3-data.onnx_data\` under \`.cache/cdx-depth/models\`. The candidate worker mounts the last file
as \`model.onnx_data\`. Run \`cdx-depth-bench.mjs --model=<fp16|q4f16|da3> --rate=1\` with a separate
label, or add \`--only=forest,street,still-life,clip-sample,clip-horse,clip-dragon,clip-bridge,clip-machine\`
for the representative sweep. Input-size sweeps use \`--side=196\`, \`294\`, or \`392\`.

The optional native video research tool expects an isolated Python environment at
\`.cache/cdx-depth/python\` with PyTorch 2.9.0+cpu, torchvision 0.24.0+cpu, NumPy 2.5.2,
Pillow 12.3.0, einops 0.8.2, easydict 1.13, OpenCV 4.13.0.92, and tqdm 4.67.3. Hub downloads used
\`huggingface_hub\` 1.5.0's \`hf\` CLI. The upstream Video Depth Anything checkout at the commit
above belongs at \`.cache/cdx-depth/video-source\`, with its pinned weights in
\`checkpoints/video_depth_anything_vits.pth\`.
Run \`node tools/cdx-depth-video-bench.mjs\` for 196, or add
\`--label=video-518 --side=518 --only=forest,street,still-life\` for the full-resolution photo trial.
These packages are local research dependencies, not shipped libraries.

## Per-input before/after timings

${allTables}
`;
await fs.writeFile("docs/audits/depth-engine-2026-10.md", body);
console.log("Wrote docs/audits/depth-engine-2026-10.md");

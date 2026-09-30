// Live input (lane Live input): the depth model in a worker, so the page
// stays smooth while it works out how far away each part of a camera frame
// is. Started only after someone taps "Use my camera" on a toy that shows
// depth (the splat mirror, Photo to 3D's live view). It uses the same files
// as Photo to 3D (src/packs/photo-3d-depth.js): ONNX Runtime Web (MIT) and
// Depth Anything V2 Small (Apache-2.0), both vendored; nothing is fetched
// from anywhere else, and the frames never leave this device.
//
// Messages in:  { type: "frame", id, w, h, data }  RGBA bytes, w and h
//               multiples of 14 (the model's patch size)
// Messages out: { type: "status", text }, { type: "depth", id, w, h, d, ms }
//               (d the model's relative inverse depth: higher is nearer),
//               { type: "error", text }

const ROOT = new URL("../../", import.meta.url);
const MODEL = new URL("vendor/depth-anything-v2-small/model_quantized.onnx", ROOT).href;
const RUNTIME = new URL("vendor/onnxruntime-web/", ROOT).href;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

let ready = null;

function load() {
  ready ||= (async () => {
    postMessage({ type: "status", text: "Loading the depth model (27 MB, once)…" });
    const ort = await import(`${RUNTIME}ort.wasm.min.mjs`);
    ort.env.wasm.wasmPaths = RUNTIME;
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    const r = await fetch(MODEL);
    if (!r.ok) throw new Error("Could not load the depth model.");
    const bytes = new Uint8Array(await r.arrayBuffer());
    postMessage({ type: "status", text: "Starting the depth model…" });
    const s = await ort.InferenceSession.create(bytes, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
    postMessage({ type: "status", text: "" });
    return { ort, s };
  })();
  return ready;
}

onmessage = async (e) => {
  const m = e.data;
  if (m?.type !== "frame") return;
  try {
    const { ort, s } = await load();
    const { w, h, data } = m;
    const n = w * h;
    const input = new Float32Array(3 * n);
    for (let i = 0; i < n; i++)
      for (let c = 0; c < 3; c++) input[c * n + i] = (data[i * 4 + c] / 255 - MEAN[c]) / STD[c];
    const t0 = performance.now();
    const out = await s.run({ [s.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, h, w]) });
    const o = out[s.outputNames[0]];
    const dims = o.dims;
    const d = Float32Array.from(o.data);
    postMessage(
      { type: "depth", id: m.id, w: dims[dims.length - 1], h: dims[dims.length - 2], d, ms: performance.now() - t0 }, // prettier-ignore
      [d.buffer],
    );
  } catch (err) {
    ready = null;
    postMessage({ type: "error", text: String(err?.message || err) });
  }
};

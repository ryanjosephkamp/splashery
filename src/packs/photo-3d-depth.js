// Photo to 3D: the on-device depth model. Loaded only when someone opens a photo in the Photo
// to 3D toy (a dynamic import from photo-3d.js), never on the shelf or in an embed.
//
//   Model:   Depth Anything V2 Small (Apache-2.0), the quantized (int8) ONNX build made by
//            onnx-community, 27 MB, in vendor/depth-anything-v2-small/.
//   Library: ONNX Runtime Web 1.30.0 (MIT), the WebAssembly build, in vendor/onnxruntime-web/.
//
// Both are our own files; nothing is fetched from anywhere else and nothing is uploaded. The
// runtime runs on one thread (a page on GitHub Pages is not cross-origin isolated, so it has
// no shared memory for more) with WebAssembly SIMD.

import { modelSize, resampleArea } from "./photo-3d-core.js";

export const MODEL_URL = new URL("../../vendor/depth-anything-v2-small/model_quantized.onnx", import.meta.url).href; // prettier-ignore
export const RUNTIME_URL = new URL("../../vendor/onnxruntime-web/", import.meta.url).href;

const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

let session = null;
let loading = null;

// Fetches a file with progress (0..1) so the panel can say how far the model has come.
export async function fetchBytes(url, onProgress) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("Could not load the depth model.");
  // content-length is only a guide for the progress figure: a server that compresses the
  // file (GitHub Pages sends the model gzipped) gives the compressed size, while the body
  // streams the full, decompressed bytes. So the chunks are collected as they come and
  // joined at the end, never written into a buffer sized from the header (lane Fix6).
  const total = Number(r.headers.get("content-length")) || 0;
  if (!r.body) return new Uint8Array(await r.arrayBuffer());
  const reader = r.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    if (total) onProgress?.(Math.min(0.99, got / total));
  }
  const out = new Uint8Array(got);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  onProgress?.(1);
  return out;
}

// Loads the runtime and the model once. `onStatus(text)` reports what it is doing.
export function loadDepthModel(onStatus) {
  if (session) return Promise.resolve(session);
  if (!loading) {
    loading = (async () => {
      onStatus?.("Loading the depth model (27 MB, once)…");
      const ort = await import("../../vendor/onnxruntime-web/ort.wasm.min.mjs");
      ort.env.wasm.wasmPaths = RUNTIME_URL;
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;
      const bytes = await fetchBytes(MODEL_URL, (p) =>
        onStatus?.(`Loading the depth model… ${Math.round(p * 100)}%`),
      );
      onStatus?.("Starting the depth model…");
      const s = await ort.InferenceSession.create(bytes, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      });
      session = { ort, s };
      return session;
    })().catch((e) => {
      loading = null;
      throw e;
    });
  }
  return loading;
}

// Estimates the depth of a photo ({ w, h, data: RGBA }). Returns { w, h, d } at the model's
// size, d the model's relative inverse depth (higher is nearer), plus how long it took.
export async function estimateDepth(photo, onStatus) {
  const { ort, s } = await loadDepthModel(onStatus);
  const { dw, dh } = modelSize(photo.w, photo.h);
  onStatus?.("Working out how far away each part of the photo is…");
  const px = resampleArea(photo, dw, dh); // sRGB 0..1
  const input = new Float32Array(3 * dw * dh);
  for (let i = 0; i < dw * dh; i++)
    for (let c = 0; c < 3; c++) input[c * dw * dh + i] = (px[i * 3 + c] - MEAN[c]) / STD[c];
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const name = s.inputNames[0];
  const out = await s.run({ [name]: new ort.Tensor("float32", input, [1, 3, dh, dw]) });
  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const o = out[s.outputNames[0]];
  const dims = o.dims;
  const h = dims[dims.length - 2];
  const w = dims[dims.length - 1];
  return { w, h, d: Float32Array.from(o.data), ms: t1 - t0 };
}

// Shared inference implementation. Import and run it inside a dedicated worker; all model
// downloading, area resampling, tensor packing, and inference happen away from the page.
import { modelSize, resampleArea } from "../packs/photo-3d-core.js";
import { fetchBytes } from "./io.js";

export const MODEL_URL = new URL(
  "../../vendor/depth-anything-v2-small/model_quantized.onnx",
  import.meta.url,
).href;
export const RUNTIME_URL = new URL("../../vendor/onnxruntime-web/", import.meta.url).href;
export const DEPTH_SIDES = { low: 294, mid: 392, high: 518, max: 518 };
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

async function providerDeadline(promise, ms = 15000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("The depth provider took too long.")), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function validatePhoto({ w, h, data } = {}) {
  if (
    !Number.isInteger(w) ||
    !Number.isInteger(h) ||
    w < 1 ||
    h < 1 ||
    !(ArrayBuffer.isView(data) || Array.isArray(data)) ||
    data.length !== w * h * 4
  )
    throw new Error("The depth model needs a complete RGBA picture.");
}

export function createDepthEngine(onStatus = () => {}) {
  let ready = null;
  let input = null;
  let tensor = null;
  let shape = "";
  let configKey = null;
  const status = (text) => onStatus(text);
  async function load(options = {}) {
    // Overrides are for same-origin, locally vendored experiments, never a remote inference API.
    const modelUrl = new URL(options.modelUrl || MODEL_URL, import.meta.url);
    const runtimeUrl = new URL(options.runtimeUrl || RUNTIME_URL, import.meta.url);
    if (modelUrl.origin !== new URL(MODEL_URL).origin || runtimeUrl.origin !== modelUrl.origin)
      throw new Error("Depth models and runtimes must be loaded from this site.");
    const key = JSON.stringify([
      modelUrl.href,
      runtimeUrl.href,
      options.provider || "wasm",
      options.threads || 1,
    ]);
    if (ready && key !== configKey)
      throw new Error("Use a separate depth worker for a different model or runtime.");
    if (!ready) {
      configKey = key;
      ready = (async () => {
        status("Loading the depth model (27 MB, once)…");
        let provider = options.provider || "wasm";
        let fallback = null;
        let ort;
        if (provider === "webgpu" || provider === "webnn") {
          try {
            if (provider === "webgpu" && !(await globalThis.navigator?.gpu?.requestAdapter()))
              throw new Error("WebGPU is unavailable.");
            if (provider === "webnn" && !globalThis.navigator?.ml)
              throw new Error("WebNN is unavailable.");
            ort = await import(
              new URL(provider === "webgpu" ? "ort.webgpu.min.mjs" : "ort.all.min.mjs", runtimeUrl)
                .href
            );
          } catch (err) {
            fallback = String(err.message || err);
            provider = "wasm";
          }
        } else if (provider !== "wasm") throw new Error("Unknown depth execution provider.");
        ort ||= await import(new URL("ort.wasm.min.mjs", runtimeUrl).href);
        ort.env.wasm.wasmPaths = runtimeUrl.href;
        ort.env.wasm.numThreads = globalThis.crossOriginIsolated
          ? Math.max(1, Math.min(4, options.threads || 1))
          : 1;
        ort.env.wasm.proxy = false;
        const bytes = await fetchBytes(modelUrl.href, (p) =>
          status(`Loading the depth model… ${Math.round(p * 100)}%`),
        );
        status("Starting the depth model…");
        let s;
        try {
          const creating = ort.InferenceSession.create(bytes, {
            executionProviders: provider === "wasm" ? ["wasm"] : [provider, "wasm"],
            graphOptimizationLevel: "all",
          });
          try {
            s =
              provider === "wasm"
                ? await creating
                : await providerDeadline(creating, options.providerTimeoutMs);
          } catch (err) {
            // A provider may settle after the CPU fallback starts; release its unused session.
            creating.then((unused) => unused.release()).catch(() => {});
            throw err;
          }
        } catch (err) {
          if (provider === "wasm") throw err;
          fallback = String(err.message || err);
          provider = "wasm";
          status("Using the depth model on this device's CPU…");
          // A failed JSEP/WASM initialization poisons that runtime instance. Load the independent
          // WASM-only module so missing GPU kernels or binaries cannot poison the CPU fallback.
          ort = await import(new URL("ort.wasm.min.mjs", runtimeUrl).href);
          ort.env.wasm.wasmPaths = runtimeUrl.href;
          ort.env.wasm.numThreads = globalThis.crossOriginIsolated
            ? Math.max(1, Math.min(4, options.threads || 1))
            : 1;
          ort.env.wasm.proxy = false;
          s = await ort.InferenceSession.create(bytes, {
            executionProviders: ["wasm"],
            graphOptimizationLevel: "all",
          });
        }
        return {
          ort,
          s,
          provider,
          fallback,
          threads: ort.env.wasm.numThreads,
          runtimeUrl: runtimeUrl.href,
          bytes: provider === "wasm" ? null : bytes,
        };
      })().catch((err) => {
        ready = null;
        configKey = null;
        throw err;
      });
    }
    return ready;
  }
  async function estimate(photo, options = {}, frame = false) {
    validatePhoto(photo);
    const state = await load(options);
    const { threads } = state;
    let { ort, s, provider, fallback } = state;
    const side = options.side ?? (options.tier ? DEPTH_SIDES[options.tier] : 518);
    if (!frame && (!Number.isInteger(side) || side < 14 || side > 1036))
      throw new Error("Choose a depth input side from 14 to 1,036 pixels.");
    const { dw, dh } = frame ? { dw: photo.w, dh: photo.h } : modelSize(photo.w, photo.h, side);
    if (frame && (dw % 14 || dh % 14))
      throw new Error("Depth frame dimensions must be multiples of 14.");
    // Live callers already report their own camera/clip state. Keep their warm frames quiet.
    status(frame ? "" : "Working out how far away each part of the photo is…");
    const n = dw * dh;
    const key = `${dw}x${dh}`;
    if (shape !== key) {
      tensor?.dispose();
      input = new Float32Array(3 * n);
      tensor = new ort.Tensor("float32", input, [1, 3, dh, dw]);
      shape = key;
    }
    const px = frame ? photo.data : resampleArea(photo, dw, dh);
    for (let c = 0; c < 3; c++)
      for (let i = 0; i < n; i++)
        input[c * n + i] = ((frame ? px[i * 4 + c] / 255 : px[i * 3 + c]) - MEAN[c]) / STD[c];
    const t0 = performance.now();
    let out;
    const gpuSession = s;
    const gpuTensor = tensor;
    const running = s.run({ [s.inputNames[0]]: tensor });
    try {
      out =
        provider === "wasm"
          ? await running
          : await providerDeadline(running, options.providerTimeoutMs);
    } catch (err) {
      if (provider === "wasm") throw err;
      fallback = String(err.message || err);
      status("Using the depth model on this device's CPU…");
      // Do not release an in-flight GPU session or reuse its input buffer. Late GPU output is
      // discarded, and later frames run exclusively on the independent WASM session.
      running
        .then((late) => {
          for (const t of Object.values(late)) t.dispose();
        })
        .catch(() => {})
        .finally(() => {
          gpuTensor.dispose();
          gpuSession.release().catch(() => {});
        })
        .catch(() => {});
      ort = await import(new URL("ort.wasm.min.mjs", state.runtimeUrl).href);
      ort.env.wasm.wasmPaths = state.runtimeUrl;
      ort.env.wasm.numThreads = threads;
      ort.env.wasm.proxy = false;
      input = input.slice();
      tensor = new ort.Tensor("float32", input, [1, 3, dh, dw]);
      s = await ort.InferenceSession.create(state.bytes, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      });
      provider = "wasm";
      ready = Promise.resolve({ ...state, ort, s, provider, fallback, bytes: null });
      out = await s.run({ [s.inputNames[0]]: tensor });
    }
    const ms = performance.now() - t0;
    try {
      const o = out[s.outputNames[0]];
      const h = o.dims.at(-2),
        w = o.dims.at(-1);
      return { w, h, d: Float32Array.from(o.data), ms, provider, fallback, threads };
    } finally {
      for (const o of Object.values(out)) o.dispose();
    }
  }
  async function run(feeds, options = {}, config = {}) {
    const { ort, s } = await load(config);
    const tensors = Object.fromEntries(
      Object.entries(feeds).map(([name, t]) => [name, new ort.Tensor(t.type, t.data, t.dims)]),
    );
    try {
      const out = await s.run(tensors, options.fetches, options.runOptions);
      try {
        return Object.fromEntries(
          Object.entries(out).map(([name, t]) => [
            name,
            { type: t.type, dims: t.dims, data: t.data.slice() },
          ]),
        );
      } finally {
        for (const t of Object.values(out)) t.dispose();
      }
    } finally {
      for (const t of Object.values(tensors)) t.dispose();
    }
  }
  return { load, estimate, run };
}

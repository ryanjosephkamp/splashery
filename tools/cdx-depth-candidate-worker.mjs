// Local research worker for ONNX candidates. Never imported by the application.
import { modelSize, resampleArea } from "../src/packs/photo-3d-core.js";
let ort, session, spec;
onmessage = async ({ data: m }) => {
  try {
    if (m.type === "init") {
      spec = m.spec;
      const root = spec.runtime || "/vendor/onnxruntime-web/";
      ort = await import(`${root}ort.wasm.min.mjs`);
      ort.env.wasm.wasmPaths = root;
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;
      const t = performance.now();
      const opts = { executionProviders: ["wasm"], graphOptimizationLevel: "all" };
      if (spec.external) opts.externalData = [{ path: "model.onnx_data", data: spec.external }];
      session = await ort.InferenceSession.create(spec.model, opts);
      postMessage({ type: "ready", loadMs: performance.now() - t });
    } else {
      const { dw: w, dh: h } = modelSize(m.photo.w, m.photo.h, spec.side || 518);
      const px = resampleArea(m.photo, w, h),
        n = w * h;
      const data = new Float32Array(3 * n);
      const mean = [0.485, 0.456, 0.406],
        std = [0.229, 0.224, 0.225];
      for (let c = 0; c < 3; c++)
        for (let i = 0; i < n; i++) data[c * n + i] = (px[i * 3 + c] - mean[c]) / std[c];
      const tensor = new ort.Tensor("float32", data, spec.multi ? [1, 1, 3, h, w] : [1, 3, h, w]);
      const t = performance.now();
      const out = await session.run({ [session.inputNames[0]]: tensor });
      const ms = performance.now() - t;
      const o = out[session.outputNames[0]];
      const d = Float32Array.from(o.data, (v) => (spec.inverse ? 1 / Math.max(v, 1e-6) : v));
      postMessage({ type: "depth", w: o.dims.at(-1), h: o.dims.at(-2), d, ms }, [d.buffer]);
      tensor.dispose();
      for (const t of Object.values(out)) t.dispose();
    }
  } catch (err) {
    postMessage({ type: "error", error: String(err?.message || err) });
  }
};

// On-device depth, loaded only when a caller asks for it. The shared worker owns model loading,
// resampling, and inference. The page imports only the small JS Tensor API for the existing
// loadDepthModel() return value; it never creates or runs a WASM session on the main thread.
import { createDepthClient } from "../depth/client.js";
import { validatePhoto, RUNTIME_URL } from "../depth/engine.js";
export { MODEL_URL, RUNTIME_URL } from "../depth/engine.js";
export { fetchBytes } from "../depth/io.js";

let client = null;
let loading = null;
const getClient = () => (client ||= createDepthClient());

// Keep { ort, s } for existing warm-up callers and callers that construct ort.Tensor and use
// s.run(). That session is a worker facade, with the same CPU Tensor inputs and outputs.
export function loadDepthModel(onStatus) {
  if (!loading) {
    const c = getClient();
    loading = (async () => {
      const [meta, ort] = await Promise.all([
        c.request("init", {}, onStatus),
        import("../../vendor/onnxruntime-web/ort.wasm.min.mjs"),
      ]);
      ort.env.wasm.wasmPaths = RUNTIME_URL;
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;
      const s = {
        inputNames: meta.inputNames,
        outputNames: meta.outputNames,
        inputMetadata: meta.inputMetadata,
        outputMetadata: meta.outputMetadata,
        async run(feeds, fetches, runOptions) {
          const serialized = Object.fromEntries(
            Object.entries(feeds).map(([name, t]) => [
              name,
              { type: t.type, dims: t.dims, data: t.data },
            ]),
          );
          const { outputs } = await c.request("run", {
            feeds: serialized,
            options: { fetches, runOptions },
          });
          return Object.fromEntries(
            Object.entries(outputs).map(([name, t]) => [
              name,
              new ort.Tensor(t.type, t.data, t.dims),
            ]),
          );
        },
        async release() {
          c.dispose();
          client = null;
          loading = null;
        },
      };
      return { ort, s };
    })().catch((err) => {
      c.dispose();
      client = null;
      loading = null;
      throw err;
    });
  }
  return loading;
}

// Photo to 3D's current reader does not pass its progress callback. Reuse its existing live
// status line without changing that toy (task 39 owns it). New callers should pass onStatus.
function panelProgress() {
  if (globalThis.window?.__splashery?.player?.scene?.toy?.id !== "photo-3d") return null;
  const line = document.querySelector(".input-progress");
  if (!line) return null;
  return (text) => {
    if (line.isConnected) {
      line.textContent = text;
      line.hidden = !text;
    }
  };
}

// Defaults preserve the old 518-pixel input and relative inverse depth exactly. Opt in to a
// smaller side, or to { tier: "low" | "mid" | "high" | "max" }, after checking the quality.
export async function estimateDepth(photo, onStatus, options = {}) {
  validatePhoto(photo);
  const progress = onStatus || panelProgress();
  try {
    const { w, h, d, ms } = await getClient().request(
      "photo",
      { w: photo.w, h: photo.h, data: photo.data, options },
      progress,
    );
    return { w, h, d, ms };
  } finally {
    progress?.("");
  }
}

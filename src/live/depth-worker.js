// Existing clip/mirror messages stay { type: "frame", id, w, h, data } -> { type: "depth",
// id, w, h, d, ms }. Photo messages accept the original RGBA size and resize inside this worker.
// One serialized queue protects the reused tensor and ONNX session from overlapping runs.
import { createDepthEngine } from "../depth/engine.js";
import { sparseClipDepth } from "../depth/clip.js";

let currentId;
let queue = Promise.resolve();
let config = {};
const engine = createDepthEngine((text) => postMessage({ type: "status", id: currentId, text }));
async function answer(m) {
  currentId = m.id;
  try {
    if (m.type === "init") {
      const nextConfig = m.options || {};
      const { s, provider, fallback, threads } = await engine.load(nextConfig);
      config = nextConfig;
      postMessage({
        type: "ready",
        id: m.id,
        inputNames: s.inputNames,
        outputNames: s.outputNames,
        inputMetadata: s.inputMetadata,
        outputMetadata: s.outputMetadata,
        provider,
        fallback,
        threads,
      });
    } else if (m.type === "clip") {
      const result = await sparseClipDepth(
        engine,
        m.frames,
        m.w,
        m.h,
        { ...config, ...m.options },
        (text) => postMessage({ type: "status", id: m.id, text }),
      );
      postMessage(
        { type: "clip", id: m.id, ...result },
        result.depths.map((d) => d.d.buffer),
      );
    } else if (m.type === "run") {
      const outputs = await engine.run(m.feeds, m.options, config);
      postMessage(
        { type: "result", id: m.id, outputs },
        Object.values(outputs).map((t) => t.data.buffer),
      );
    } else {
      const depth = await engine.estimate(m, { ...config, ...m.options }, m.type === "frame");
      postMessage({ type: "depth", id: m.id, ...depth }, [depth.d.buffer]);
    }
  } catch (err) {
    postMessage({ type: "error", id: m.id, text: String(err?.message || err) });
  }
}
onmessage = ({ data: m }) => {
  if (!["init", "photo", "frame", "run", "clip"].includes(m?.type)) return;
  queue = queue.then(() => answer(m));
};

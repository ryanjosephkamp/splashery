import { createDepthEngine } from "../depth/engine.js";
import { reconstruct } from "./pipeline.js";
onmessage = async ({ data: { photo, side = 294 } }) => {
  const status = (text) => postMessage({ status: text });
  try {
    const engine = createDepthEngine(status);
    const result = await reconstruct(photo, (p, o) => engine.estimate(p, o), {
      side,
      onStatus: status,
    });
    postMessage({ result }, [result.depth.d.buffer]);
  } catch (error) {
    postMessage({ error: String(error.message || error) });
  }
};

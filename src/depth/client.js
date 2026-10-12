// Lazy, reusable worker with correlated requests. Sending a picture never transfers ownership
// of its RGBA bytes: the caller still needs them to construct and texture its splats.
export function createDepthClient({ workerUrl } = {}) {
  let worker = null;
  let next = 0;
  const pending = new Map();
  function stop(message = "The depth worker was closed.") {
    worker?.terminate();
    worker = null;
    for (const p of pending.values()) p.reject(new Error(message));
    pending.clear();
  }
  function start() {
    if (worker) return;
    worker = new Worker(workerUrl || new URL("../live/depth-worker.js", import.meta.url), {
      type: "module",
    });
    worker.onmessage = ({ data: m }) => {
      const p = pending.get(m.id);
      if (!p) return;
      if (m.type === "status") {
        p.onStatus?.(m.text);
        return;
      }
      pending.delete(m.id);
      if (m.type === "error") p.reject(new Error(m.text || "The depth model stopped."));
      else p.resolve(m);
    };
    worker.onerror = (e) => {
      e.preventDefault();
      stop("The depth model couldn't start in this browser.");
    };
    worker.onmessageerror = () => stop("The depth worker returned an unreadable answer.");
  }
  function request(type, payload = {}, onStatus) {
    start();
    const id = ++next;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject, onStatus });
      try {
        worker.postMessage({ ...payload, type, id });
      } catch (err) {
        pending.delete(id);
        reject(err);
      }
    });
  }
  return { request, dispose: stop };
}

// A separate worker lets a clip choose its own model/runtime and be explicitly released.
export async function estimateClipDepth(frames, w, h, onStatus, options = {}) {
  const client = createDepthClient();
  try {
    return await client.request("clip", { frames, w, h, options }, onStatus);
  } finally {
    client.dispose();
  }
}

// Lazy, device-local geometry worker. Input is cloned, not transferred: switching
// depth or opening the original must keep the caller's photo and depth intact.
let worker;
let next = 0;
const waiting = new Map();
export function cancelSurface() {
  worker?.terminate();
  worker = null;
  for (const p of waiting.values()) p.resolve(null);
  waiting.clear();
}
export function cancelPendingSurface() {
  if (waiting.size) cancelSurface();
}
export function prepareSurface(photo, depth, options, cells) {
  // A slider rebuild supersedes the previous request. Resolve that obsolete
  // preparation without a surface (Player drops its stale load token), and
  // terminate its worker so neither CPU work nor image clones form a queue.
  cancelPendingSurface();
  if (!worker) {
    worker = new Worker(new URL("./build-worker.js", import.meta.url), { type: "module" });
    const current = worker;
    worker.onmessage = ({ data }) => {
      if (worker !== current) {
        data.result?.bitmap?.close();
        return;
      }
      const p = waiting.get(data.id);
      if (!p) {
        data.result?.bitmap?.close();
        return;
      }
      waiting.delete(data.id);
      if (data.error) p.reject(new Error(data.error));
      else p.resolve(data.result);
    };
    worker.onerror = (e) => {
      if (worker !== current) return;
      for (const p of waiting.values())
        p.reject(new Error(e.message || "Could not build the photo."));
      waiting.clear();
      current.terminate();
      worker = null;
    };
  }
  return new Promise((resolve, reject) => {
    const id = ++next;
    waiting.set(id, { resolve, reject });
    try {
      worker.postMessage({
        id,
        photo: { w: photo.w, h: photo.h, data: photo.data },
        depth,
        options,
        cells,
      });
    } catch (e) {
      waiting.delete(id);
      reject(e);
    }
  });
}

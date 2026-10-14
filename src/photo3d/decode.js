let worker,
  next = 0;
const waiting = new Map();
function request(message) {
  if (!worker) {
    worker = new Worker(new URL("./decode-worker.js", import.meta.url), { type: "module" });
    const current = worker;
    worker.onmessage = ({ data }) => {
      if (worker !== current) return;
      const p = waiting.get(data.id);
      if (!p) return;
      waiting.delete(data.id);
      if (data.error) p.reject(new Error(data.error));
      else p.resolve(data.photo || data.preview);
    };
    worker.onerror = (e) => {
      if (worker !== current) return;
      for (const p of waiting.values())
        p.reject(new Error(e.message || "Could not decode the photo."));
      waiting.clear();
      current.terminate();
      worker = null;
    };
  }
  return new Promise((resolve, reject) => {
    const id = ++next;
    waiting.set(id, { resolve, reject });
    try {
      worker.postMessage({ id, ...message });
    } catch (error) {
      waiting.delete(id);
      reject(error);
    }
  });
}
export const decodeBytes = (blob, maxSide) => request({ blob, maxSide });
export const previewBytes = (photo) =>
  request({ pixels: { w: photo.w, h: photo.h, data: photo.data } });

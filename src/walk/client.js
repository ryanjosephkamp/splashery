export class WalkWorker {
  constructor() {
    this.worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    this.waiting = new Map();
    this.sequence = 0;
    this.worker.onmessage = ({ data: { id, result, error } }) => {
      const w = this.waiting.get(id);
      if (!w) return;
      this.waiting.delete(id);
      error ? w.reject(new Error(error)) : w.resolve(result);
    };
    this.worker.onerror = (e) =>
      this.fail(new Error(e.message || "The place worker stopped. Try a lighter file."));
  }
  run(args) {
    if (!this.worker) return Promise.reject(new Error("The walking view is closed."));
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
      this.worker.postMessage({ id, args });
    });
  }
  fail(err) {
    for (const w of this.waiting.values()) w.reject(err);
    this.waiting.clear();
  }
  destroy() {
    this.fail(new DOMException("Walking view closed.", "AbortError"));
    this.worker?.terminate();
    this.worker = null;
  }
}

export class MeshWorker {
  constructor() {
    this.worker = null;
    this.pending = new Map();
    this.sequence = 0;
  }
  call(command, args = {}, onProgress = () => {}) {
    if (!this.worker) {
      this.worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
      this.worker.onmessage = ({ data }) => {
        const p = this.pending.get(data.id);
        if (!p) return;
        if (data.progress !== undefined && !data.result) {
          p.onProgress(data.progress, data.text);
          return;
        }
        this.pending.delete(data.id);
        if (data.error) p.reject(new Error(data.error));
        else p.resolve(data.result);
      };
      this.worker.onerror = (e) => {
        const message = e.message || "The background worker stopped. Try a smaller source.";
        this.cancel(message);
      };
    }
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress });
      this.worker.postMessage({ id, command, ...args });
    });
  }
  cancel(message = "Canceled.") {
    this.worker?.terminate();
    this.worker = null;
    for (const p of this.pending.values()) p.reject(new Error(message));
    this.pending.clear();
  }
}

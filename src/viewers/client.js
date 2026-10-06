// Lane Viewers: the page's side of the toys' worker. call(cmd, args, onProgress) runs a command of
// src/viewers/engine.js in the worker (started on first use) and resolves with its result. Where
// there is no Worker (Node: the tests and tools), the engine runs in the same thread.

let worker = null;
let local = null;
let seq = 0;
const waiting = new Map();

function start() {
  if (worker) return worker;
  worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
  worker.onmessage = (e) => {
    const { id, progress, text, result, error } = e.data;
    const w = waiting.get(id);
    if (!w) return;
    if (progress !== undefined && result === undefined && error === undefined) {
      w.onProgress?.(progress, text);
      return;
    }
    waiting.delete(id);
    if (error !== undefined) w.reject(new Error(error));
    else w.resolve(result);
  };
  worker.onerror = (e) => {
    for (const w of waiting.values()) w.reject(new Error(e.message || "The worker stopped."));
    waiting.clear();
    worker = null;
  };
  return worker;
}

export async function call(cmd, args = {}, onProgress = null, transfer = []) {
  if (typeof Worker === "undefined") {
    local ||= await import("./engine.js");
    return local.HANDLERS[cmd](args, onProgress || (() => {}));
  }
  const w = start();
  const id = ++seq;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject, onProgress });
    w.postMessage({ id, cmd, args }, transfer);
  });
}

// Post-capture work only. Every original reader/condition runs exactly once.
// The caller awaits all workers before beginning another appearance measurement.
import assert from "node:assert/strict";
import { Worker } from "node:worker_threads";
import { CONDITIONS } from "./captures.mjs";
export { sourcePicture } from "./qualify.mjs";
const workers = [],
  pending = new Map();
let serial = 0,
  tail = Promise.resolve();
function pool() {
  if (workers.length) return workers;
  for (let i = 0; i < 4; i++) {
    const worker = new Worker(new URL("./qualify-worker.mjs", import.meta.url));
    worker.on("message", ({ id, result, error }) => {
      const request = pending.get(id);
      if (!request) return;
      pending.delete(id);
      worker.unref();
      if (error) request.reject(new Error(error));
      else request.resolve(result);
    });
    worker.on("error", (error) => {
      for (const [id, request] of pending)
        if (request.worker === worker) {
          pending.delete(id);
          request.reject(error);
        }
    });
    worker.on("exit", (code) => {
      for (const [id, request] of pending)
        if (request.worker === worker) {
          pending.delete(id);
          request.reject(new Error(`Qualification worker exited ${code}`));
        }
    });
    worker.unref();
    workers.push(worker);
  }
  return workers;
}
async function assess(picture, result, text, shape) {
  assert.equal(CONDITIONS.length, 24);
  const active = pool();
  const groups = active.map((_, index) =>
    CONDITIONS.map((_, i) => i).filter((i) => i % active.length === index),
  );
  assert.deepEqual(
    groups.flat().sort((a, b) => a - b),
    CONDITIONS.map((_, i) => i),
  );
  const results = await Promise.all(
    groups.map(
      (indices, index) =>
        new Promise((resolve, reject) => {
          const id = ++serial,
            worker = active[index];
          pending.set(id, { resolve, reject, worker });
          worker.ref();
          worker.postMessage({ id, picture, result, text, shape, indices });
        }),
    ),
  );
  const first = results[0],
    scans = results.flatMap((r) => r.scans);
  for (const r of results) {
    assert.equal(r.captureRGBA8Sha256, first.captureRGBA8Sha256);
    assert.deepEqual(r.scores, first.scores);
    assert.deepEqual(r.stickerScores, first.stickerScores);
  }
  assert.equal(scans.length, CONDITIONS.length);
  assert.equal(new Set(scans.map((s) => s.condition)).size, CONDITIONS.length);
  return {
    ...first,
    scans: CONDITIONS.map((c) => {
      const scan = scans.find((s) => s.condition === c.id);
      assert(scan);
      assert.equal(typeof scan.jsqr, "boolean");
      assert.equal(typeof scan.zxingcpp, "boolean");
      return scan;
    }),
  };
}
export function qualifyCapture(...args) {
  const work = tail.then(() => assess(...args));
  tail = work.catch(() => {});
  return work;
}

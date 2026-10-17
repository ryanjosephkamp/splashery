// Run an explicit partition of the original independent qualification function.
import { parentPort } from "node:worker_threads";
import { qualifyCapture } from "./qualify.mjs";
import { CONDITIONS } from "./captures.mjs";
let pending = Promise.resolve();
parentPort.on("message", (job) => {
  pending = pending.then(async () => {
    try {
      const conditions = job.indices.map((index) => CONDITIONS[index]);
      const result = await qualifyCapture(job.picture, job.result, job.text, job.shape, conditions);
      parentPort.postMessage({ id: job.id, result });
    } catch (error) {
      parentPort.postMessage({ id: job.id, error: error.stack });
    }
  });
});

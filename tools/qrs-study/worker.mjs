// Lane QR lab r2, the study of splat QR codes: a worker thread that runs jobs
// (core.mjs, runJob) for tools/qrs-study.mjs and posts back their rows.
import { parentPort } from "node:worker_threads";
import { runJob } from "./core.mjs";
import { variables } from "./variables.mjs";
import { initZxingCpp } from "./readers.mjs";

const VARS = new Map(variables().map((v) => [v.id, v]));
await initZxingCpp();
parentPort.on("message", async (jobs) => {
  const rows = [];
  for (const job of jobs) {
    const v = VARS.get(job.variable);
    const spec = { frontOn: v.frontOn, ...v.spec(job.value) };
    rows.push(...(await runJob(job, spec)));
  }
  parentPort.postMessage(rows);
});
parentPort.postMessage("ready");

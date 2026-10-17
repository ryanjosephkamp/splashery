import { Worker } from "node:worker_threads";
const workers = Array.from({ length: 2 }, () => new Worker(`
  let n = 1;
  while (true) { n = (Math.imul(n, 1664525) + 1013904223) | 0; }
`, { eval: true }));
console.log(JSON.stringify({ pid: process.pid, burners: workers.length, started: new Date().toISOString() }));
process.on("SIGINT", async () => { await Promise.all(workers.map((w) => w.terminate())); process.exit(0); });


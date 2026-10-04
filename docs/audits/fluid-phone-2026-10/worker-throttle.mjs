import fs from "node:fs";
import { chromium } from "../../../node_modules/playwright-core/index.mjs";
const browser = await chromium.launch({
  executablePath:
    process.env.SPLASHERY_CHROMIUM ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const page = await browser.newPage();
await page.goto("http://127.0.0.1:4173/?renderer=none");
await page.evaluate(() => {
  window.bench = () => {
    const start = performance.now();
    let x = 0.5;
    for (let i = 0; i < 2000000; i++) x = Math.sin(x + i * 0.001);
    return { ms: performance.now() - start, x };
  };
  window.benchWorker = new Worker(
    URL.createObjectURL(
      new Blob(
        [
          `self.bench = ${window.bench.toString()}; self.onmessage=()=>self.postMessage(self.bench());`,
        ],
        { type: "text/javascript" },
      ),
    ),
  );
});
const cdp = await page.context().newCDPSession(page);
const worker = page.workers()[0];
await worker.evaluate(() => self.bench());
await page.evaluate(() => window.bench());
const rows = [];
for (const rate of [1, 4, 6, 1]) {
  await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  const main = [],
    background = [];
  for (let i = 0; i < 5; i++) {
    main.push(await page.evaluate(() => window.bench()));
    background.push(await worker.evaluate(() => self.bench()));
  }
  rows.push({ rate, main, worker: background });
}
const browserCDP = await browser.newBrowserCDPSession();
const targets = await browserCDP.send("Target.getTargets");
const target = targets.targetInfos.find((t) => t.type === "worker");
let workerHeap = null;
if (target) {
  const { sessionId } = await browserCDP.send("Target.attachToTarget", {
    targetId: target.targetId,
    flatten: false,
  });
  const pending = new Map();
  browserCDP.on("Target.receivedMessageFromTarget", (e) => {
    const m = JSON.parse(e.message);
    if (pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  });
  const send = (id, method, params = {}) =>
    new Promise(async (resolve) => {
      pending.set(id, resolve);
      await browserCDP.send("Target.sendMessageToTarget", {
        sessionId,
        message: JSON.stringify({ id, method, params }),
      });
    });
  workerHeap = await send(1, "Runtime.getHeapUsage");
  const emulation = await send(2, "Emulation.setCPUThrottlingRate", { rate: 6 });
  rows.push({
    workerTargetThrottleResponse: emulation,
    after: await worker.evaluate(() => self.bench()),
  });
}
fs.writeFileSync(
  new URL("worker-throttle.json", import.meta.url),
  JSON.stringify({ browser: browser.version(), rows, workerHeap }, null, 2) + "\n",
);
console.log(JSON.stringify({ rows, workerHeap }));
await browser.close();

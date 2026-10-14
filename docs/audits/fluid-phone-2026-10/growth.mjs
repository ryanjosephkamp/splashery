// Read-only allocation identity probe; run after all timing cells, never alongside them.
import fs from "node:fs";
import { chromium } from "../../../node_modules/playwright-core/index.mjs";
const browser = await chromium.launch({
  executablePath:
    process.env.SPLASHERY_CHROMIUM ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: [
    "--use-angle=metal",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--enable-unsafe-webgpu",
    "--enable-precise-memory-info",
  ],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage(),
  cdp = await context.newCDPSession(page);
const result = { browser: browser.version(), renderer: "webgpu", rate: 6, cycles: [], errors: [] };
page.on("pageerror", (e) => result.errors.push(e.message));
page.on("console", (e) => {
  if (e.type() === "error") result.errors.push(e.text());
});
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
await page.goto(
  "http://127.0.0.1:4173/?labs=1&renderer=webgpu&profile=mid&fluids=worker&adapt=off",
);
await page.waitForFunction(() => window.__splashery?.ready);
await page.evaluate(() => window.__splashery.app.chooseToy("fluid-lab"));
await page.waitForTimeout(2000);
const read = () => {
  const p = window.__splashery.player,
    d = p.stage.device;
  // Weak keys do not retain buffers that the application would otherwise free.
  const audit = (window.__bufferIdentity ||= { ids: new WeakMap(), next: 1 });
  const buffers = [...d.buffers].map((b) => {
    if (!audit.ids.has(b)) audit.ids.set(b, audit.next++);
    return {
      identity: audit.ids.get(b),
      className: b.constructor.name,
      persistent: b.persistent ?? null,
      bytes: b.byteSize ?? b.format?.byteSize ?? b.numBytes ?? null,
      uniformNames: Array.isArray(b.format?.uniforms) ? b.format.uniforms.map((u) => u.name) : [],
    };
  });
  return {
    at: performance.now(),
    toy: p.toyInfo.id,
    profile: p.profile,
    deviceType: d.deviceType,
    graveyard: p.stage.graveyard.length,
    tracked: { ...d._vram },
    buffers,
    fluid: p.fluids && {
      mode: p.fluids.mode,
      grids: p.fluids.fx?.gas?.grid?.dims,
      cap: p.fluids.world?.systems.find((s) => s.gpu)?.cap,
    },
  };
};
async function snapshot() {
  await cdp.send("HeapProfiler.collectGarbage");
  return { snapshot: await page.evaluate(read), heap: await cdp.send("Runtime.getHeapUsage") };
}
result.before = await snapshot();
for (let cycle = 0; cycle < 6; cycle++) {
  for (const scene of ["candle", "cup", "splash", "glass"]) {
    await page.evaluate((scene) => window.__splashery.app.setToyOption("scene", scene), scene);
    await page.waitForTimeout(1000);
  }
  result.cycles.push({ cycle, ...(await snapshot()) });
}
await page.evaluate(() => window.__splashery.app.chooseToy("cactus"));
await page.waitForTimeout(2000);
result.afterLeaving = await snapshot();
fs.writeFileSync(new URL("growth.json", import.meta.url), JSON.stringify(result, null, 2) + "\n");
console.log(
  JSON.stringify({
    errors: result.errors,
    before: result.before.snapshot.buffers.length,
    cycles: result.cycles.map((c) => ({
      buffers: c.snapshot.buffers.length,
      uniformBytes: c.snapshot.tracked.ub,
      heap: c.heap.usedSize,
    })),
    afterLeaving: result.afterLeaving.snapshot.buffers.length,
  }),
);
await browser.close();

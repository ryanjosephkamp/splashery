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
const results = [];
const read = () => {
  const p = window.__splashery.player,
    f = p.fluids,
    d = p.stage.device;
  return {
    at: performance.now(),
    profile: p.profile,
    baseSplats: p.toyInfo.splats,
    mode: f?.mode,
    stats: f && { ...f.stats },
    pendingDt: f?.pendingDt,
    spareBuffers: f?.spare?.length,
    buffers: d.buffers?.size,
    textures: d.textures?.length,
    tracked: { ...d._vram },
    grids: [f?.fx?.gas?.flameGrid, f?.fx?.gas?.smokeGrid].filter(Boolean).map((g) => g.dims),
    liquid: f?.world?.systems
      .filter((s) => s.gpu)
      .map((s) => ({
        cap: s.cap,
        n: s.n,
        grid: s.dims,
        diffuseCap: s.diffuse?.cap,
        diffuseN: s.diffuse?.n,
      })),
    surfaceScale: f?.fx?.surface.scale,
    watch: f?.fx?.watchState && { ...f.fx.watchState },
  };
};
for (const renderer of ["webgl2", "webgpu"]) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage(),
    cdp = await context.newCDPSession(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (e) => {
    if (e.type() === "error") errors.push(e.text());
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  await page.goto(
    `http://127.0.0.1:4173/?labs=1&renderer=${renderer}&profile=mid&fluids=worker&adapt=off`,
  );
  await page.waitForFunction(() => window.__splashery?.ready);
  await page.evaluate(() => window.__splashery.app.chooseToy("fluid-lab"));
  await page.waitForTimeout(2000);
  const r = { renderer, errors, observations: [] };
  // Natural wall-clock soak: repeated pours for one minute, then 24 rebuilds.
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => window.__splashery.app.act());
    await page.waitForTimeout(5000);
    r.observations.push({
      phase: "pour",
      i,
      snapshot: await page.evaluate(read),
      heap: await cdp.send("Runtime.getHeapUsage"),
    });
  }
  await cdp.send("HeapProfiler.collectGarbage");
  r.beforeCyclesGC = {
    snapshot: await page.evaluate(read),
    heap: await cdp.send("Runtime.getHeapUsage"),
  };
  for (let i = 0; i < 24; i++) {
    const scene = ["candle", "cup", "splash", "glass"][i % 4];
    await page.evaluate((scene) => window.__splashery.app.setToyOption("scene", scene), scene);
    await page.waitForTimeout(1000);
    r.observations.push({
      phase: "rebuild",
      i,
      scene,
      snapshot: await page.evaluate(read),
      heap: await cdp.send("Runtime.getHeapUsage"),
    });
  }
  await page.waitForTimeout(2000);
  await cdp.send("HeapProfiler.collectGarbage");
  r.afterCyclesGC = {
    snapshot: await page.evaluate(read),
    heap: await cdp.send("Runtime.getHeapUsage"),
  };
  r.profileStep = await page.evaluate(async (readSource) => {
    const read = (0, eval)(`(${readSource})`);
    const p = window.__splashery.player;
    const before = read();
    p.autoTier = true;
    p.stepDown();
    const after = read();
    const { detectProfile } = await import("/src/player.js");
    return { before, after, detectedAutomatic: detectProfile("auto") };
  }, read.toString());
  r.watchProbe = await page.evaluate(() => {
    const fx = window.__splashery.player.fluids?.fx;
    if (!fx) return null;
    const w = fx.watchState;
    w.steps = 0;
    w.ema = 100;
    w.slow = 1490;
    w.last = performance.now() - 500;
    fx.watch();
    const after500 = { ...w };
    w.steps = 0;
    w.ema = 100;
    w.slow = 1490;
    w.last = performance.now() - 50;
    fx.watch();
    const after50 = { ...w };
    return { after500, after50 };
  });
  results.push(r);
  fs.writeFileSync(new URL("soak.json", import.meta.url), JSON.stringify(results, null, 2) + "\n");
  console.log(
    JSON.stringify({
      renderer,
      errors,
      before: r.beforeCyclesGC,
      after: r.afterCyclesGC,
      profileStep: r.profileStep,
      watchProbe: r.watchProbe,
    }),
  );
  await context.close();
}
await browser.close();

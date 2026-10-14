// Report-only collector. Experimental changes exist only in intercepted responses.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const out = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(out, "../../..");
const { chromium } = await import(`${root}/node_modules/playwright-core/index.mjs`);
const { TOYS } = await import(`${root}/src/toys.js`);
const { createScene } = await import(`${root}/src/state.js`);
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173";
const chrome =
  process.env.SPLASHERY_CHROMIUM || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const batch = process.argv.find((a) => a.startsWith("--batch="))?.slice(8) || "pilot";
const args = [
  "--use-angle=metal",
  "--enable-webgl",
  "--ignore-gpu-blocklist",
  "--enable-unsafe-webgpu",
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows",
  "--enable-precise-memory-info",
];
const scenes = [
  ...["glass", "splash"].flatMap((scene) =>
    ["water", "soda", "honey", "lava"].map((liquid) => ({ id: "fluid-lab", scene, liquid })),
  ),
  ...["candle", "cup"].map((scene) => ({ id: "fluid-lab", scene, liquid: "water" })),
];
const peers = [
  "water-bottle",
  "soda-can",
  "lava-lamp",
  "waterfall",
  "ocean-wave",
  "candle",
  "coffee",
  "birthday-cake",
  "campfire",
  "volcano",
  "geyser",
  "storm-cloud",
  "tornado",
  "fireworks",
].map((id) => ({ id }));
const settings = [
  { setting: "mid4", profile: "mid", rate: 4 },
  { setting: "mid6", profile: "mid", rate: 6 },
  { setting: "low6", profile: "low", rate: 6 },
  { setting: "desktop", profile: "high", rate: 1 },
];
const expand = (items, configs) =>
  items.flatMap((s) =>
    configs.flatMap((c) => ["webgl2", "webgpu"].map((renderer) => ({ ...s, ...c, renderer }))),
  );
const experiments = [
  {
    setting: "half",
    profile: "mid",
    rate: 6,
    budgetScale: 0.5,
    gpuCell: 0.05,
    gpuCap: 6000,
    gasN: 20,
  },
  {
    setting: "quarter",
    profile: "mid",
    rate: 6,
    budgetScale: 0.25,
    gpuCell: 0.06,
    gpuCap: 3000,
    gasN: 16,
  },
  {
    setting: "eighth",
    profile: "mid",
    rate: 6,
    budgetScale: 0.125,
    gpuCell: 0.08,
    gpuCap: 1500,
    gasN: 12,
  },
];
let cells;
if (batch === "pilot") cells = expand([scenes[0], scenes[8], scenes[9]], [settings[1]]);
else if (batch === "lab") cells = expand(scenes, settings);
else if (batch === "peers")
  cells = expand(
    peers,
    settings.filter((s) => s.setting !== "low6"),
  );
else if (batch === "peerslow") cells = expand(peers.slice(0, 2), [settings[2]]);
else if (batch === "lower") cells = expand(scenes, experiments);
else if (batch === "repeat")
  cells = expand(
    [scenes[0], scenes[1], scenes[2], scenes[3], scenes[8], scenes[9]],
    [settings[1], experiments[0], experiments[2]],
  );
else if (batch === "stress")
  cells = [
    ...expand(scenes, [{ setting: "high6phone", profile: "high", rate: 6 }]),
    ...expand(
      [scenes[0], scenes[1], scenes[4], scenes[8]],
      [{ setting: "max6phone", profile: "max", rate: 6 }],
    ),
  ];
else if (batch === "safe")
  cells = expand(scenes, [
    {
      setting: "safe",
      profile: "mid",
      rate: 6,
      budgetScale: 0.5,
      keepSplashCpuLiquid: true,
      gpuCell: 0.05,
      gpuCap: 6000,
      gasN: 20,
      pixelCap: 1.5,
      density: 0.25,
    },
  ]);
else if (batch === "auto")
  cells = expand(
    [scenes[0], scenes[1], scenes[8], scenes[9]],
    [{ setting: "auto6", profile: "auto", rate: 6, adaptive: true }],
  );
else throw new Error(`Unknown batch: ${batch}`);
const file = `${out}/${batch}.json`;
const rows = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
const write = () => fs.writeFileSync(file, JSON.stringify(rows, null, 2) + "\n");
const browser = await chromium.launch({ executablePath: chrome, headless: true, args });
const browserCDP = await browser.newBrowserCDPSession();
const systemInfo = await browserCDP.send("SystemInfo.getInfo");
fs.writeFileSync(`${out}/${batch}-gpu.json`, JSON.stringify(systemInfo.gpu, null, 2) + "\n");
let messageId = 0;
const messages = new Map();
browserCDP.on("Target.receivedMessageFromTarget", (e) => {
  const m = JSON.parse(e.message);
  if (messages.has(m.id)) {
    messages.get(m.id)(m);
    messages.delete(m.id);
  }
});
async function workerSession(page) {
  if (!page.workers().some((w) => w.url().endsWith("/fluids/worker.js"))) return null;
  const { targetInfos } = await browserCDP.send("Target.getTargets");
  const target = targetInfos.find(
    (t) => t.type === "worker" && t.url.endsWith("/fluids/worker.js"),
  );
  if (!target) return null;
  const { sessionId } = await browserCDP.send("Target.attachToTarget", {
    targetId: target.targetId,
    flatten: false,
  });
  return (method, params = {}) =>
    new Promise(async (resolve, reject) => {
      const id = ++messageId;
      messages.set(id, (m) => (m.error ? reject(new Error(m.error.message)) : resolve(m.result)));
      await browserCDP.send("Target.sendMessageToTarget", {
        sessionId,
        message: JSON.stringify({ id, method, params }),
      });
    });
}
fs.writeFileSync(
  `${out}/${batch}-method.json`,
  JSON.stringify(
    {
      startedAt: new Date().toISOString(),
      baseline: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
      browser: browser.version(),
      executable: chrome,
      args,
      host: {
        platform: os.platform(),
        release: os.release(),
        cpu: os.cpus()[0].model,
        totalMemory: os.totalmem(),
      },
      cells,
      windowMs: { idle: 5000, action: 6000 },
      seed: 424242,
      workerMode: "explicit fluids=worker",
      modifications:
        "worker exposes a read-only snapshot getter; lower settings alter module responses, never checkout source",
      gpuMemory:
        "engine texture accounting plus named storage-buffer byte sizes; excludes driver, framebuffer and process memory",
    },
    null,
    2,
  ) + "\n",
);

function pageSnapshot() {
  const p = window.__splashery.player;
  const f = p.fluids;
  const d = p.stage.device;
  const gas = f?.fx?.gas;
  const grids = [gas?.flameGrid, gas?.smokeGrid].filter(Boolean).map((g) => ({
    dims: g.dims,
    cells: g.dims.reduce((a, b) => a * b, 1),
    atlas: g.atlas,
    hz: g.hz,
    maxSteps: g.maxSteps,
    jacobi: g.jacobi,
  }));
  const systems =
    f?.world?.systems.map((s) => ({
      name: s.name,
      kind: s.kind,
      cap: s.cap,
      n: s.n,
      dcap: s.dcap,
      dn: s.dn,
      grid: s.dims || s.grid?.dim,
      gridCapacity: s.grid?.start?.length,
      maxSub: s.maxSub,
      cell: s.h,
      storageBytes: s.sim
        ? [s.sim.particles, s.sim.gridBuf, s.sim.gridV, s.diffuse?.buf]
            .filter(Boolean)
            .reduce((n, b) => n + (b.byteSize || b.numBytes || 0), 0)
        : 0,
    })) || [];
  const gpuBuffers = systems.reduce((n, s) => n + s.storageBytes, 0);
  return {
    at: performance.now(),
    profile: p.profile,
    autoTier: p.autoTier,
    deviceType: d.deviceType,
    compute: d.supportsCompute,
    canvas: [p.canvas.width, p.canvas.height],
    baseSplats: p.toyInfo.splats,
    fluid: f
      ? {
          mode: f.mode,
          stats: { ...f.stats },
          completedUploads: f.frames,
          pendingDt: f.pendingDt,
          busy: f.busy,
          grids,
          systems,
          surfaceScale: f.fx?.surface.scale,
          surfaceSize: f.fx?.surface.size,
          raySteps: gas?.steps,
          watch: f.fx?.watchState && { ...f.fx.watchState },
        }
      : null,
    gpuMemory: {
      textureBytes: d._vram?.tex ?? null,
      vramCounters: d._vram && { ...d._vram },
      trackedBytes: d._vram ? Object.values(d._vram).reduce((a, b) => a + b, 0) : null,
      knownStorageBytes: gpuBuffers,
      totalDeviceMemoryBytes: null,
    },
    gpu: d.isWebGPU
      ? null
      : {
          renderer: d.gl.getParameter(
            d.gl.getExtension("WEBGL_debug_renderer_info")?.UNMASKED_RENDERER_WEBGL ||
              d.gl.RENDERER,
          ),
        },
  };
}

function initAudit({ id }) {
  const a = (window.__fluidAudit = {
    id,
    frame: [],
    render: [],
    long: [],
    firstReadyRenderMs: null,
  });
  new PerformanceObserver((list) =>
    a.long.push(...list.getEntries().map((e) => ({ start: e.startTime, duration: e.duration }))),
  ).observe({ type: "longtask", buffered: true });
  const attach = () => {
    const p = window.__splashery?.player;
    if (!p?.stage) return requestAnimationFrame(attach);
    p.stage.app.on("frameend", () => a.frame.push(performance.now()));
    p.stage.app.on("postrender", () => {
      const t = performance.now();
      a.render.push(t);
      if (
        document.body.dataset.ready === "true" &&
        p.toyInfo?.id === id &&
        a.firstReadyRenderMs === null
      )
        a.firstReadyRenderMs = t;
    });
  };
  requestAnimationFrame(attach);
}

const percentile = (a, p) =>
  a.length ? [...a].sort((x, y) => x - y)[Math.max(0, Math.ceil(a.length * p) - 1)] : null;
function summarize(a) {
  const s = [...a].sort((x, y) => x - y);
  return {
    n: a.length,
    median: s.length ? (s[Math.floor((s.length - 1) / 2)] + s[Math.floor(s.length / 2)]) / 2 : null,
    p95: percentile(a, 0.95),
    max: s.at(-1) ?? null,
    over33: a.filter((t) => t > 33).length,
    over250: a.filter((t) => t > 250).length,
  };
}

async function run(cell) {
  const desktop = cell.setting === "desktop";
  const context = await browser.newContext({
    viewport: desktop ? { width: 1440, height: 900 } : { width: 390, height: 844 },
    deviceScaleFactor: desktop ? 1 : 3,
    isMobile: !desktop,
    hasTouch: !desktop,
    reducedMotion: "no-preference",
    colorScheme: "light",
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const errors = [],
    warnings = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (e) => {
    if (e.type() === "error") errors.push(e.text());
    if (e.type() === "warning") warnings.push(e.text());
  });
  await context.route("**/src/fluids/worker.js", async (route) => {
    const source = fs.readFileSync(`${root}/src/fluids/worker.js`, "utf8");
    const getter =
      "\nself.__fluidSnapshot = () => ({ time: world?.time, maxSteps: world?.maxSteps, slots: world?.slots, systems: world?.systems.map(s => ({ name:s.name, kind:s.kind, cap:s.cap, n:s.n, dcap:s.dcap, dn:s.dn, grid:s.grid?.dim, gridCapacity:s.grid?.start?.length })), memory: performance.memory ? {usedJSHeapSize:performance.memory.usedJSHeapSize, totalJSHeapSize:performance.memory.totalJSHeapSize} : null });\n";
    await route.fulfill({ body: source + getter, contentType: "text/javascript" });
  });
  if (cell.budgetScale) {
    await context.route("**/src/packs/fluid-lab.js", async (route) => {
      const source = fs.readFileSync(`${root}/src/packs/fluid-lab.js`, "utf8");
      const suffix = `\nconst auditBuild = RECIPES["fluid-lab"].build; RECIPES["fluid-lab"].build = (k,o) => { auditBuild(k,o); for (const s of k.fluids) if(s.budget ${cell.keepSplashCpuLiquid ? '&& !(o.scene === "splash" && s.kind === "liquid")' : ""}) { s.budget = Math.round(s.budget * ${cell.budgetScale}); if(s.spacing) s.spacing *= Math.cbrt(1 / ${cell.budgetScale}); } }; ${cell.density ? `RECIPES["fluid-lab"].density = ${cell.density};` : ""}\n`;
      await route.fulfill({ body: source + suffix, contentType: "text/javascript" });
    });
    await context.route("**/src/fluids/gpu/liquid.js", async (route) => {
      const source = fs.readFileSync(`${root}/src/fluids/gpu/liquid.js`, "utf8");
      await route.fulfill({
        body:
          source +
          `\nObject.assign(GPU_TIERS.mid, { cell: ${cell.gpuCell}, cap: ${cell.gpuCap} });\n`,
        contentType: "text/javascript",
      });
    });
    await context.route("**/src/fluids/gpu/gas.js", async (route) => {
      const source = fs.readFileSync(`${root}/src/fluids/gpu/gas.js`, "utf8");
      await route.fulfill({
        body: source + `\nGAS_TIERS.mid.n = ${cell.gasN};\n`,
        contentType: "text/javascript",
      });
    });
  }
  if (cell.pixelCap) {
    await context.route("**/src/player.js", async (route) => {
      const source = fs.readFileSync(`${root}/src/player.js`, "utf8");
      await route.fulfill({
        body: source.replace(
          "PIXEL_RATIO = { low: 1.5, mid: 3,",
          `PIXEL_RATIO = { low: 1.5, mid: ${cell.pixelCap},`,
        ),
        contentType: "text/javascript",
      });
    });
  }
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cell.rate });
  await page.addInitScript(initAudit, { id: cell.id });
  const toy = TOYS.find((t) => t.id === cell.id);
  const scene = createScene({
    seed: 424242,
    toy: {
      kind: "builtin",
      id: cell.id,
      ...(cell.scene ? { options: { scene: cell.scene, liquid: cell.liquid } } : {}),
    },
    camera: { ...createScene().camera, ...toy.camera },
    autoplay: { turntable: false, effect: "none" },
  });
  const hash = Buffer.from(JSON.stringify(scene)).toString("base64url");
  const url = `${base}/?labs=1&profile=${cell.profile}&renderer=${cell.renderer}${cell.adaptive ? "" : "&adapt=off"}&fluids=worker#s=j.${hash}`;
  const r = {
    ...cell,
    startedAt: new Date().toISOString(),
    url,
    status: "pending",
    errors,
    warnings,
  };
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(
      () =>
        window.__fluidAudit?.firstReadyRenderMs !== null &&
        window.__fluidAudit?.firstReadyRenderMs !== undefined,
      null,
      { timeout: 60000 },
    );
    r.firstReady = await page.evaluate(pageSnapshot);
    await page.waitForFunction(
      () => {
        const f = window.__splashery.player.fluids;
        return !f || f.stats.slots > 0 || f.stats.particles > 0 || f.stats.gasCells > 0;
      },
      null,
      { timeout: 30000 },
    );
    await page.waitForTimeout(1500);
    r.ready = await page.evaluate(pageSnapshot);
    r.heapStart = await cdp.send("Runtime.getHeapUsage");
    r.workerStart = await Promise.all(
      page
        .workers()
        .filter((w) => w.url().endsWith("/fluids/worker.js"))
        .map((w) => w.evaluate(() => self.__fluidSnapshot?.())),
    );
    const workerSend = await workerSession(page);
    r.workerHeapStart = workerSend ? await workerSend("Runtime.getHeapUsage") : null;
    r.windows = [];
    for (const [phase, ms] of [
      ["idle", 5000],
      ["action", 6000],
    ]) {
      const start = await page.evaluate((phase) => {
        if (phase === "action") window.__splashery.app.act();
        return performance.now();
      }, phase);
      await page.waitForTimeout(ms);
      const end = await page.evaluate(() => performance.now());
      const data = await page.evaluate(
        ({ start, end }) => {
          const a = window.__fluidAudit;
          const vector = (times) =>
            times.slice(1).flatMap((t, i) => (t >= start && t <= end ? [t - times[i]] : []));
          return {
            frame: vector(a.frame),
            render: vector(a.render),
            long: a.long.filter((e) => e.start < end && e.start + e.duration > start),
          };
        },
        { start, end },
      );
      r.windows.push({
        phase,
        start,
        end,
        elapsedMs: end - start,
        ...data,
        frameSummary: summarize(data.frame),
        renderSummary: summarize(data.render),
        longSummary: {
          count: data.long.length,
          totalMs: data.long.reduce((s, e) => s + e.duration, 0),
          maxMs: Math.max(0, ...data.long.map((e) => e.duration)),
        },
        snapshot: await page.evaluate(pageSnapshot),
      });
    }
    r.heapEnd = await cdp.send("Runtime.getHeapUsage");
    r.workerHeapEnd = workerSend ? await workerSend("Runtime.getHeapUsage") : null;
    r.workerEnd = await Promise.all(
      page
        .workers()
        .filter((w) => w.url().endsWith("/fluids/worker.js"))
        .map((w) => w.evaluate(() => self.__fluidSnapshot?.())),
    );
    r.opening = await page.evaluate(() => ({
      firstFrameMs: window.__fluidAudit.firstReadyRenderMs,
      long: window.__fluidAudit.long.filter(
        (e) => e.start < window.__fluidAudit.firstReadyRenderMs,
      ),
      detected: {
        mem: navigator.deviceMemory,
        cores: navigator.hardwareConcurrency,
        coarse: matchMedia("(pointer:coarse)").matches,
        screen: [screen.width, screen.height],
        webdriver: navigator.webdriver,
      },
      longTaskSupported: PerformanceObserver.supportedEntryTypes.includes("longtask"),
    }));
    r.actualRenderer = r.ready.deviceType;
    r.status = errors.length ? "completed-with-errors" : "ok";
  } catch (e) {
    r.status = "failed";
    r.failure = e.message;
  }
  await context.close();
  return r;
}
try {
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const key = JSON.stringify(cell);
    if (rows.some((r) => r.key === key)) continue;
    const row = await run(cell);
    row.key = key;
    rows.push(row);
    write();
    console.log(
      JSON.stringify({
        batch,
        done: i + 1,
        total: cells.length,
        id: cell.id,
        scene: cell.scene,
        liquid: cell.liquid,
        setting: cell.setting,
        renderer: cell.renderer,
        actual: row.actualRenderer,
        status: row.status,
        frame: row.windows?.at(-1).renderSummary,
        errors: row.errors.slice(0, 2),
      }),
    );
  }
} finally {
  await browser.close();
}

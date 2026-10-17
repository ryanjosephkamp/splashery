import { test, expect } from "@playwright/test";
import { makePly } from "./fixtures.mjs";

test("phone speed statistics retain missing samples and use real percentiles", async () => {
  const { distribution, rankSlowest } = await import("../tools/pages/phone-speed-metrics.js");
  expect(distribution([])).toEqual({ count: 0, median: null, p95: null });
  expect(distribution([1, 2, 3, 4])).toEqual({ count: 4, median: 2.5, p95: 4 });
  const rows = [
    { id: "load", firstViewMs: 3000, idle: { median: 20 }, tap: { median: 20 } },
    { id: "draw", firstViewMs: 1000, idle: { median: 300 }, tap: { median: 400 } },
    { id: "fast", firstViewMs: 500, idle: { median: 16 }, tap: { median: 16 } },
    { id: "failed", error: "did not draw" },
  ];
  expect(rankSlowest(rows, 2).map((r) => r.id)).toEqual(["draw", "load"]);
});

test("first view includes the photo toys' default relief mesh without switching views", async ({
  page,
}) => {
  const { installFirstFrameProbe } = await import("../tools/pages/phone-speed-metrics.js");
  const { installHybridFirstFrameProbe } = await import("../tools/pages/phone-speed-hybrid.js");
  await page.addInitScript(installFirstFrameProbe);
  await page.addInitScript(installHybridFirstFrameProbe);
  for (const id of ["photo-3d", "moving-photo-3d"]) {
    await page.goto(`/?renderer=webgl2&profile=weak&labs=1&adapt=off&first-toy=${id}`);
    await page.waitForFunction(() => window.__splashery?.ready && window.__psv?.state().on);
    await page.waitForFunction(() => window.__phoneSpeedFirstView, null, { timeout: 4000 });
    const result = await page.evaluate(() => ({
      first: window.__phoneSpeedFirstView,
      view: window.__psv.state(),
      splatFrame: document.body.dataset.firstToyFrame,
    }));
    expect(result.first.completedMs).toBeGreaterThan(0);
    expect(result.first.path).toBe("default-relief-mesh");
    expect(result.first.gpuReadback).toBe(true);
    expect(result.view.on).toBe(true);
    expect(result.view.splatsOff).toBe(true);
    expect(result.splatFrame).toBe("false");
    const sample = await page.evaluate(async () => {
      const { measurePhoneToy } = await import("/tools/pages/phone-speed-hybrid.js");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        return await measurePhoneToy(window, { durationMs: 250, signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }
    });
    expect(sample.idle.count).toBeGreaterThanOrEqual(8);
    expect(sample.tap.count).toBeGreaterThanOrEqual(8);
    expect(await page.evaluate(() => window.__psv.state().on)).toBe(true);
  }
});

test("phone page measures a real toy locally and exposes a copyable result", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/tools/pages/phone-speed.html?ids=tennis-ball&duration=250");
  const preferences = {
    "splashery.splats": "400000",
    "splashery.turntable": "on",
    "splashery.sound": "on",
  };
  await page.evaluate((values) => {
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
  }, preferences);
  await expect(page.getByRole("heading", { name: "Phone speed" })).toBeVisible();
  await page.getByRole("button", { name: "Start run" }).click();
  await expect(page.getByRole("status")).toContainText("Complete", { timeout: 120000 });
  const row = page.locator("tbody tr");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Tennis ball");
  const results = JSON.parse(await page.locator("#json").inputValue());
  expect(results.rows[0].firstViewMs).toBeGreaterThan(0);
  expect(results.rows[0].idle.count).toBeGreaterThanOrEqual(8);
  expect(results.rows[0].tap.count).toBeGreaterThanOrEqual(8);
  expect(results.rows[0].viewport).toEqual([390, 844]);
  expect(results.rows[0].profile).toBe("low");
  expect(results.rows[0].error).toBeUndefined();
  expect(results.rows[0].splats).toBeLessThanOrEqual(120000);
  expect(
    await page.evaluate(
      (keys) => Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])),
      Object.keys(preferences),
    ),
  ).toEqual(preferences);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Start run" }).click();
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Stopped");
  await expect(page.locator("iframe")).toHaveCount(0);
});

test("speed gates reject missing runs, failed visuals, and unrelated regressions", async () => {
  const { compareRuns, freezeTargets } = await import("../tools/phone-speed-compare.mjs");
  const row = (id, ms, pair, phase) => ({
    id,
    completion: "synchronous-readPixels",
    firstViewReadback: true,
    run: 0,
    pair,
    phase,
    splats: 60000,
    profile: "low",
    renderer: "webgl2",
    deviceScaleFactor: 3,
    viewport: [390, 844],
    canvas: [585, 700],
    firstViewMs: ms,
    idle: { median: ms, p95: ms, count: 8 },
    tap: { median: ms, p95: ms, count: 8 },
  });
  const targets = Array.from({ length: 15 }, (_, i) => ({ id: `toy${i}`, metric: "firstViewMs" }));
  const before = [
    ...targets.flatMap((t) =>
      Array.from({ length: 5 }, (_, pair) => row(t.id, 100, pair, "before")),
    ),
    row("other", 100, 0, "before"),
  ];
  const after = [
    ...targets.flatMap((t) => Array.from({ length: 5 }, (_, pair) => row(t.id, 65, pair, "after"))),
    row("other", 104, 0, "after"),
  ];
  const visuals = targets.map((t) => ({
    id: t.id,
    rest: { ssim: 0.99, laplacian: 10, sourceLaplacian: 10 },
    tap: { ssim: 0.98, laplacian: 10, sourceLaplacian: 10 },
  }));
  expect(compareRuns(before, after, targets, visuals).gates).toEqual({
    coverage: true,
    speed: true,
    appearance: true,
    noRegressions: true,
  });
  const finishOnly = before.map(({ completion, ...r }) => r);
  expect(compareRuns(finishOnly, after, targets, visuals).gates.coverage).toBe(false);
  const independent = (rows) =>
    rows.map((r) => (r.id === "other" ? { ...r, pair: undefined, phase: undefined } : r));
  expect(
    compareRuns(independent(before), independent(after), targets, visuals).gates.coverage,
  ).toBe(false);
  expect(compareRuns(before, independent(after), targets, visuals).gates.coverage).toBe(false);
  const extended = (rows, ms, phase) => [
    ...rows,
    ...Array.from({ length: 5 }, (_, i) => row("toy0", ms, i + 5, phase)),
  ];
  expect(
    compareRuns(
      extended(before, 100, "before"),
      extended(after, 65, "after"),
      targets,
      visuals,
      undefined,
      { toy0: 10 },
    ).gates.coverage,
  ).toBe(false);
  expect(
    compareRuns(
      before,
      after,
      targets.map(() => targets[0]),
      visuals,
    ).gates.speed,
  ).toBe(false);
  expect(() => freezeTargets(before, ["absent"])).toThrow("complete, error-free baseline");
  expect(
    compareRuns(
      before,
      after.filter((r) => r.id !== "toy0" || r.pair === 0),
      targets,
      visuals,
    ).gates.speed,
  ).toBe(false);
  expect(
    compareRuns(
      before,
      after.map((r) => (r.id === "toy0" ? { ...r, pair: 0 } : r)),
      targets,
      visuals,
    ).gates.speed,
  ).toBe(false);
  expect(
    compareRuns(
      before,
      after.map((r, i) => (i === 1 ? { ...r, idle: { ...r.idle, median: null } } : r)),
      targets,
      visuals,
    ).gates.speed,
  ).toBe(false);
  expect(
    compareRuns(before, after, targets, visuals, undefined, { other: 5 }).gates.noRegressions,
  ).toBe(false);
  after[0].splats = 30000;
  expect(compareRuns(before, after, targets, visuals).gates.speed).toBe(false);
  after[0].splats = 60000;
  after.at(-1).canvas = [390, 467];
  expect(compareRuns(before, after, targets, visuals).gates.noRegressions).toBe(false);
  after.at(-1).canvas = [585, 700];
  after.at(-1).tap.p95 = 106;
  expect(compareRuns(before, after, targets, visuals).gates.noRegressions).toBe(false);
  expect(compareRuns(before, after.slice(1), targets, visuals).gates.coverage).toBe(false);
  expect(
    compareRuns(before, after, targets, visuals, [...before.map((r) => r.id), "absent"]).gates
      .coverage,
  ).toBe(false);
  visuals[0].tap.ssim = 0.979;
  expect(compareRuns(before, after, targets, visuals).gates.appearance).toBe(false);
  visuals[0].tap.ssim = 0.98;
  visuals[0].tap.laplacian = 0;
  expect(compareRuns(before, after, targets, visuals).gates.appearance).toBe(false);
  delete visuals[0].tap.laplacian;
  expect(compareRuns(before, after, targets, visuals).gates.appearance).toBe(false);
  visuals[0].tap.laplacian = 10;
  visuals[0].referenceErrors = ["original renderer failed"];
  expect(compareRuns(before, after, targets, visuals).gates.appearance).toBe(false);
  after[0].error = "failed";
  expect(compareRuns(before, after, targets, visuals).gates.speed).toBe(false);
  expect(() => freezeTargets(after)).toThrow("complete, error-free baseline");
});

test("idle redraws reuse GPU work, then a look change and a tap invalidate it", async ({
  page,
}) => {
  await page.goto("/?renderer=webgl2&profile=weak&labs=1&adapt=off&first-toy=cactus");
  await page.waitForFunction(
    () => window.__splashery?.ready && document.body.dataset.firstToyFrame === "true",
  );
  const r = await page.evaluate(() => {
    const { app, player: p } = window.__splashery;
    app.setAutoplay({ turntable: false });
    p.opts.idleDelay = 1e9;
    p.idle.weight = 0;
    p.camera.cur = { ...p.camera.home };
    p.camera.tgt = { ...p.camera.home };
    p.camera.vel.yaw = p.camera.vel.pitch = 0;
    p.update(0);
    const placement = p.stage.toy.entity.gsplat._placement;
    const before = placement.dirtyVersion;
    p.time += 1;
    p.update(0);
    const idle = placement.dirtyVersion;
    const packed = p.stage.toy.entity.gsplat.getParameter("uSpParts[0]");
    const old = packed[0];
    packed[0] += 0.1;
    p.stage.setUniforms({ "uSpParts[0]": packed }, { reuse: true });
    const mutated = placement.dirtyVersion;
    packed[0] = old;
    p.stage.setUniforms({ "uSpParts[0]": packed }, { reuse: true });
    const restored = placement.dirtyVersion;
    p.scene.look.exposure = 1.2;
    p.update(0);
    const look = placement.dirtyVersion;
    p.act(null);
    p.update(0.1);
    return { before, idle, mutated, restored, look, tap: placement.dirtyVersion };
  });
  expect(r.idle).toBe(r.before);
  expect(r.mutated).toBeGreaterThan(r.idle);
  expect(r.look).toBeGreaterThan(r.restored);
  expect(r.tap).toBeGreaterThan(r.look);
});

test("stopping the CLI finishes its active sample and does not open the next toy", async ({
  baseURL,
}, testInfo) => {
  const fs = await import("node:fs/promises");
  const { spawn } = await import("node:child_process");
  const path = await import("node:path");
  const out = testInfo.outputPath("signal-run");
  const child = spawn(
    process.execPath,
    [
      "tools/phone-speed.mjs",
      "--ids=torus,blob",
      "--duration=250",
      `--out=${out}`,
      `--url=${baseURL}`,
    ],
    { stdio: "ignore" },
  );
  const finished = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code, signal) => resolve({ code, signal }));
  });
  try {
    await expect
      .poll(
        async () => {
          try {
            return JSON.parse(await fs.readFile(path.join(out, "active.json"), "utf8")).id;
          } catch {
            return null;
          }
        },
        { timeout: 30000 },
      )
      .toBe("torus");
    child.kill("SIGTERM");
    expect(await finished).toEqual({ code: 0, signal: null });
    const rows = JSON.parse(await fs.readFile(path.join(out, "summary.json"), "utf8"));
    expect(rows.map((r) => r.id)).toEqual(["torus"]);
    expect(rows[0].error).toBeUndefined();
    expect(rows[0].idle.count).toBeGreaterThanOrEqual(8);
    expect(rows[0].tap.count).toBeGreaterThanOrEqual(8);
    expect(
      await fs.access(path.join(out, "active.json")).then(
        () => true,
        () => false,
      ),
    ).toBe(false);
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
    await finished;
  }
});

test("paired resume rejects changed settings and incompatible cached samples", async ({}, testInfo) => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const { spawn, execFile, execFileSync } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const run = promisify(execFile);
  const source = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const out = testInfo.outputPath("resume-run");
  await fs.mkdir(out, { recursive: true });
  const browserAttempt = path.join(out, "unexpected-browser.json");
  const browserStub = path.join(out, "reject-browser.mjs");
  await fs.writeFile(
    browserStub,
    `#!/usr/bin/env node\nimport fs from "node:fs";\nif (process.argv.includes("--version")) console.log("Chromium 151.0.0.0");\nelse { fs.writeFileSync(${JSON.stringify(browserAttempt)}, JSON.stringify(process.argv.slice(2))); process.exit(97); }\n`,
  );
  await fs.chmod(browserStub, 0o755);
  const options = { env: { ...process.env, SPLASHERY_CHROMIUM: browserStub } };
  const targets = path.join(out, "targets.json");
  await fs.writeFile(targets, JSON.stringify([{ id: "torus" }]));
  await fs.writeFile(path.join(out, "pause"), "");
  const args = [
    "tools/phone-speed-paired.mjs",
    `--targets=${targets}`,
    `--out=${out}`,
    `--before-source=${source}`,
    `--after-source=${source}`,
  ];
  const child = spawn(process.execPath, args, { ...options, stdio: "ignore" });
  const finished = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => resolve(code));
  });
  try {
    await expect
      .poll(
        async () =>
          fs.access(path.join(out, "paused.json")).then(
            () => true,
            () => false,
          ),
        { timeout: 30000 },
      )
      .toBe(true);
    child.kill("SIGTERM");
    expect(await finished).toBe(0);
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
    await finished;
  }
  await expect(
    run(process.execPath, [...args, "--resume", "--duration=999"], options),
  ).rejects.toThrow("identical sources");
  const protocol = JSON.parse(await fs.readFile(path.join(out, "protocol.json"), "utf8"));
  for (const phase of ["before", "after"]) {
    const sample = path.join(out, "torus", `0-${phase}`);
    await fs.mkdir(sample, { recursive: true });
    await fs.writeFile(path.join(sample, "torus-0.json"), JSON.stringify({ id: "torus", source }));
    await fs.writeFile(
      path.join(sample, "method.json"),
      JSON.stringify({
        source,
        url: protocol.urls[phase],
        runs: 1,
        durationMs: 999,
        browser: protocol.browser,
        measurementSHA256: protocol.measurementSHA256,
        hybridSHA256: protocol.hybridSHA256,
        runnerSHA256: protocol.runnerSHA256,
      }),
    );
  }
  await fs.rm(path.join(out, "pause"));
  await expect(run(process.execPath, [...args, "--resume"], options)).rejects.toThrow(
    "different protocol",
  );
  expect(
    await fs.access(browserAttempt).then(
      () => true,
      () => false,
    ),
  ).toBe(false);
});

test("clock-driven and unknown splat behaviors cannot be cached as static", async () => {
  const { shaderUsesClock } = await import("../src/parameter-cache.js");
  for (const kind of [1, 4, 7, 13, 15, 22, 24, 999]) {
    expect(shaderUsesClock({ count: 1, anim: new Float32Array([0, kind, 0, 0]) })).toBe(true);
  }
  for (const kind of [0, 14, 17, 19, 20, 23, 25, 26]) {
    expect(shaderUsesClock({ count: 1, anim: new Float32Array([0, kind, 0, 0]) })).toBe(false);
  }
});

test("completed idle draws skip the main splat work pass until a look or tap changes", async ({
  page,
}) => {
  await page.goto("/?renderer=webgl2&profile=weak&labs=1&adapt=off&first-toy=cactus");
  await page.waitForFunction(() => window.__splashery?.ready);
  const r = await page.evaluate(async () => {
    const { app, player: p } = window.__splashery;
    app.setAutoplay({ turntable: false });
    p.opts.idleDelay = 1e9;
    p.idle.weight = 0;
    const handlers = p.stage.updateHandlers.splice(0);
    const restore = [];
    let draws = 0;
    try {
      p.update(0);
      await p.stage.captureFrame();
      for (const camera of p.stage.app.renderer.gsplatDirector.camerasMap.values()) {
        for (const layer of camera.layersMap.values()) {
          const pass = layer.gsplatManager.world.workBuffer.renderPass;
          const original = pass.renderSplat;
          pass.renderSplat = function (...args) {
            if (args[0].node === p.stage.toy.entity) draws++;
            return original.apply(this, args);
          };
          restore.push(() => {
            pass.renderSplat = original;
          });
        }
      }
      const sample = async () => {
        draws = 0;
        p.update(0);
        await p.stage.captureFrame();
        return draws;
      };
      const idle = await sample();
      p.scene.look.exposure = 1.2;
      const look = await sample();
      p.act(null);
      p.update(0.1);
      const tap = await sample();
      return { hooks: restore.length, idle, look, tap };
    } finally {
      for (const fn of restore) fn();
      p.stage.updateHandlers.push(...handlers);
    }
  });
  expect(r.hooks).toBeGreaterThan(0);
  expect(r.idle).toBe(0);
  expect(r.look).toBeGreaterThan(0);
  expect(r.tap).toBeGreaterThan(0);
});

test("imported spherical harmonics retain per-frame color updates", async ({ page }) => {
  const n = 64;
  const ply = makePly(n);
  const offset = ply.indexOf("end_header\n") + "end_header\n".length;
  const header = ply
    .subarray(0, offset)
    .toString()
    .replace(
      "end_header\n",
      `${Array.from({ length: 9 }, (_, i) => `property float f_rest_${i}`).join("\n")}\nend_header\n`,
    );
  const body = Buffer.alloc(n * 23 * 4);
  for (let i = 0; i < n; i++) {
    ply.copy(body, i * 23 * 4, offset + i * 14 * 4, offset + (i + 1) * 14 * 4);
    for (let j = 0; j < 9; j++) body.writeFloatLE(0.3 * Math.cos(i + j), (i * 23 + 14 + j) * 4);
  }
  await page.goto("/?renderer=webgl2&profile=weak&labs=1&adapt=off&first-toy=cactus");
  await page.waitForFunction(() => window.__splashery?.ready);
  await page.setInputFiles("#byo-file", {
    name: "directional.ply",
    mimeType: "application/octet-stream",
    buffer: Buffer.concat([Buffer.from(header), body]),
  });
  await page.waitForFunction(() => window.__splashery.player.toyInfo?.kind === "file");
  const r = await page.evaluate(async () => {
    const { app, player: p } = window.__splashery;
    const pc = await import("/src/pc.js");
    app.setAutoplay({ turntable: false });
    p.opts.idleDelay = 1e9;
    p.idle.weight = 0;
    p.update(0);
    return {
      bands: p.stage.toy.resource.gsplatData.shBands,
      always: p.stage.toy.entity.gsplat.workBufferUpdate === pc.WORKBUFFER_UPDATE_ALWAYS,
    };
  });
  expect(r.bands).toBe(1);
  expect(r.always).toBe(true);
});

test("retagging a settled rig invalidates its cached GPU surface", async ({ page }) => {
  await page.goto("/?renderer=webgl2&profile=weak&labs=1&adapt=off&first-toy=dog-plush");
  await page.waitForFunction(() => window.__splashery?.ready);
  const r = await page.evaluate(async () => {
    const { app, player: p } = window.__splashery;
    const { tagRig } = await import("/src/rig.js");
    app.setAutoplay({ turntable: false });
    p.opts.idleDelay = 1e9;
    p.idle.weight = 0;
    p.update(0);
    await p.stage.captureFrame();
    const placement = p.stage.toy.entity.gsplat._placement;
    const before = placement.dirtyVersion;
    const tagged = tagRig(p.stage, p.toyInfo.rig);
    return { before, after: placement.dirtyVersion, tagged };
  });
  expect(r.tagged).toBe(true);
  expect(r.after).toBeGreaterThan(r.before);
});

test("recipe render settings follow the active tier and preserve URL overrides", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?renderer=webgl2&profile=weak&labs=1&adapt=off&first-toy=cactus");
  await page.waitForFunction(() => window.__splashery?.ready);
  const result = await page.evaluate(async () => {
    const { app, player: p } = window.__splashery;
    const recipe = p.toyInfo.recipe;
    const original = recipe.render;
    const seen = [];
    recipe.render = ({ profile, options }) => {
      seen.push({ profile, options: { ...options } });
      return { cull: "off", dpr: profile === "low" ? 2.4 : "native", adapt: "off" };
    };
    const sample = async () => {
      await app.chooseToy("cactus");
      await p.stage.captureFrame();
      return {
        dpr: p.stage.sharp?.dpr ?? null,
        cull: p.stage.sharp?.cull ?? null,
        profile: p.profile,
      };
    };
    try {
      const low = await sample();
      p.setProfile("high");
      const high = await sample();
      p.setProfile("low");
      const url = new URL(location.href);
      url.searchParams.set("dpr", "1.75");
      history.replaceState(null, "", url);
      const override = await sample();
      return { low, high, override, seen, expectedOptions: p.toyInfo.options || {} };
    } finally {
      recipe.render = original;
    }
  });
  expect(result.low.dpr).toBe(2.4);
  expect(result.high.dpr).toBe(Math.min(3, await page.evaluate(() => devicePixelRatio)));
  expect(result.override.dpr).toBe(1.75);
  expect(result.low.cull).toEqual({ minPixelSize: 0, minContribution: 0 });
  expect(result.seen.map((s) => s.profile)).toEqual(["low", "high", "low"]);
  expect(
    result.seen.every((s) => JSON.stringify(s.options) === JSON.stringify(result.expectedOptions)),
  ).toBe(true);
});

test("resolution declarations require exact targeted canvases and native appearance evidence", async () => {
  const { compareRuns } = await import("../tools/phone-speed-compare.mjs");
  const targets = Array.from({ length: 15 }, (_, i) => ({ id: `toy${i}`, metric: "idle.median" }));
  const rows = (phase, ms) =>
    targets.flatMap(({ id }) =>
      Array.from({ length: 5 }, (_, pair) => ({
        id,
        completion: "synchronous-readPixels",
        firstViewReadback: true,
        phase,
        pair,
        splats: 60000,
        profile: "low",
        renderer: "webgl2",
        deviceScaleFactor: 3,
        viewport: [390, 844],
        canvas: [1170, 1401],
        firstViewMs: ms,
        idle: { median: ms, p95: ms, count: 8 },
        tap: { median: ms, p95: ms, count: 8 },
      })),
    );
  const before = rows("before", 100),
    after = rows("after", 65);
  for (const row of after) if (row.id === "toy0") row.canvas = [936, 1120];
  const visuals = targets.map(({ id }) => ({
    id,
    canvas: id === "toy0" ? [936, 1120] : [1170, 1401],
    referenceCanvas: [1170, 1401],
    splats: 60000,
    referenceSplats: 60000,
    rest: { ssim: 1, laplacian: 10, sourceLaplacian: 10 },
    tap: { ssim: 1, laplacian: 10, sourceLaplacian: 10 },
    native: {
      rest: { ssim: 0.999, laplacian: 10, sourceLaplacian: 10, width: 1170, height: 1401 },
      tap: { ssim: 0.999, laplacian: 10, sourceLaplacian: 10, width: 1170, height: 1401 },
    },
  }));
  const declaration = {
    toy0: {
      beforeCanvas: [1170, 1401],
      afterCanvas: [936, 1120],
      reason: "Declared recipe resolution budget",
    },
  };
  const compare = (changes = declaration) =>
    compareRuns(before, after, targets, visuals, undefined, {}, changes);
  expect(compare({}).gates.coverage).toBe(false);
  expect(compare().gates).toEqual({
    coverage: true,
    speed: true,
    appearance: true,
    noRegressions: true,
  });
  visuals[0].native.tap.ssim = 0.979;
  expect(compare().gates.appearance).toBe(false);
  expect(compare().gates.coverage).toBe(false);
  visuals[0].native.tap.ssim = 0.999;
  visuals[0].native.tap.sourceLaplacian = 0;
  expect(compare().gates.appearance).toBe(false);
  expect(compare().gates.coverage).toBe(false);
  delete visuals[0].native.tap.sourceLaplacian;
  expect(compare().gates.appearance).toBe(false);
  visuals[0].native.tap.sourceLaplacian = 10;
  visuals[0].canvas = [1170, 1401];
  expect(compare().gates.coverage).toBe(false);
  visuals[0].canvas = [936, 1120];
  visuals[0].referenceCanvas = [936, 1120];
  expect(compare().gates.coverage).toBe(false);
  visuals[0].referenceCanvas = [1170, 1401];
  visuals[0].referenceSplats = 30000;
  expect(compare().gates.coverage).toBe(false);
  visuals[0].referenceSplats = 60000;
  after[0].canvas = [937, 1120];
  expect(compare().gates.coverage).toBe(false);
  after[0].canvas = [936, 1120];
  after[0].splats = 30000;
  expect(compare().gates.coverage).toBe(false);
  after[0].splats = 60000;
  expect(compare({ ...declaration, unrelated: declaration.toy0 }).gates.coverage).toBe(false);
});

test("phone draws use a synchronous pixel readback and preserve the read framebuffer", async ({
  page,
}) => {
  const { installFirstFrameProbe } = await import("../tools/pages/phone-speed-metrics.js");
  await page.addInitScript(installFirstFrameProbe);
  await page.goto("/?renderer=webgl2&profile=weak&labs=1&adapt=off&first-toy=tennis-ball");
  await page.waitForFunction(() => window.__splashery?.ready && window.__phoneSpeedFirstView);
  expect(await page.evaluate(() => typeof window.__phoneSpeedCompleteDraw)).toBe("function");
  const result = await page.evaluate(async () => {
    const p = window.__splashery.player,
      gl = p.stage.device.gl;
    const original = gl.readPixels,
      previous = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
    let reads = 0,
      defaultReads = true;
    gl.readPixels = function (...args) {
      reads++;
      defaultReads &&= gl.getParameter(gl.READ_FRAMEBUFFER_BINDING) === null;
      return original.apply(this, args);
    };
    const framebuffer = gl.createFramebuffer();
    try {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, framebuffer);
      window.__phoneSpeedCompleteDraw(gl);
      const restored = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING) === framebuffer;
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, previous);
      const { measureFrames } = await import("/tools/pages/phone-speed-metrics.js");
      const sample = await measureFrames(p, 250);
      return { reads, defaultReads, restored, frames: sample.count, error: gl.getError() };
    } finally {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, previous);
      gl.deleteFramebuffer(framebuffer);
      gl.readPixels = original;
    }
  });
  expect(result.restored).toBe(true);
  expect(result.defaultReads).toBe(true);
  expect(result.reads).toBeGreaterThanOrEqual(result.frames + 1);
  expect(result.frames).toBeGreaterThanOrEqual(8);
  expect(result.error).toBe(0);
});

test("picture toys reuse only the primary surface and invalidate it for a page turn", async ({
  page,
}) => {
  await page.goto("/?renderer=webgl2&profile=weak&labs=1&adapt=off&first-toy=photo-album");
  await page.waitForFunction(
    () =>
      window.__splashery?.ready &&
      window.__splashery.player.pictures?.sheets.some((sh) => sh.slot?.surface),
    null,
    { timeout: 120000 },
  );
  const result = await page.evaluate(async () => {
    const { app, player: p } = window.__splashery;
    app.setAutoplay({ turntable: false });
    p.opts.idleDelay = 1e9;
    p.idle.weight = 0;
    p.camera.cur = { ...p.camera.home };
    p.camera.tgt = { ...p.camera.home };
    p.camera.vel.yaw = p.camera.vel.pitch = 0;
    for (let i = 0; i < 6; i++) await p.stage.captureFrame();
    p.update(0);
    const g = p.stage.toy.entity.gsplat;
    const version = () => g._placement.dirtyVersion;
    const before = version();
    let sheetWrites = 0,
      faceWrites = 0;
    const undo = [];
    for (const sheet of p.stage.toy.sheets) {
      const setParameter = sheet.entity.gsplat.setParameter;
      sheet.entity.gsplat.setParameter = function (...args) {
        sheetWrites++;
        return setParameter.apply(this, args);
      };
      undo.push(() => (sheet.entity.gsplat.setParameter = setParameter));
      if (sheet.surface) {
        const setUniforms = sheet.surface.setUniforms;
        sheet.surface.setUniforms = function (...args) {
          faceWrites++;
          return setUniforms.apply(this, args);
        };
        undo.push(() => (sheet.surface.setUniforms = setUniforms));
      }
    }
    try {
      p.update(0);
      const idle = version();
      p.camera.cur.yaw += 0.1;
      p.camera.tgt.yaw = p.camera.cur.yaw;
      p.update(0);
      const camera = version();
      p.act(null);
      p.update(0.1);
      return { before, idle, camera, turn: version(), sheetWrites, faceWrites };
    } finally {
      for (const restore of undo) restore();
    }
  });
  expect(result.idle).toBe(result.before);
  expect(result.camera).toBeGreaterThan(result.idle);
  expect(result.turn).toBeGreaterThan(result.camera);
  expect(result.sheetWrites).toBeGreaterThan(0);
  expect(result.faceWrites).toBeGreaterThan(0);
});

test("phone page retains browser resize notifications and still marks real errors", async ({
  page,
}) => {
  const resize = "ResizeObserver loop completed with undelivered notifications.";
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/tools/pages/phone-speed.html?ids=tennis-ball&duration=250");
  await page.getByRole("button", { name: "Start run", exact: true }).click();
  await expect
    .poll(async () =>
      page
        .frames()
        .find((f) => f.url().includes("first-toy=tennis-ball"))
        ?.url(),
    )
    .toBeTruthy();
  const toy = page.frames().find((f) => f.url().includes("first-toy=tennis-ball"));
  await toy.waitForFunction(() => window.__splashery?.ready);
  await toy.evaluate((message) => {
    dispatchEvent(new ErrorEvent("error", { message, error: null }));
    dispatchEvent(new ErrorEvent("error", { message, error: new Error(message) }));
    setTimeout(() => {
      throw new Error("Deliberate application failure");
    }, 0);
  }, resize);
  await expect(page.getByRole("status")).toContainText("Complete", { timeout: 120000 });
  const result = JSON.parse(await page.locator("#json").inputValue()).rows[0];
  expect(result.browserNotifications).toContain(resize);
  expect(result.errors).toContain(resize);
  expect(result.errors).toContain("Uncaught Error: Deliberate application failure");
  expect(pageErrors).toContain("Deliberate application failure");
  await expect(page.locator("tbody tr")).toContainText("Error:");
});

test("a recipe can keep updating its settled work buffer without changing its tap", async ({
  page,
}) => {
  for (const id of ["cookie", "torus"]) {
    await page.goto(`/?renderer=webgl2&profile=weak&labs=1&adapt=off&first-toy=${id}`);
    await page.waitForFunction(() => window.__splashery?.ready);
    const result = await page.evaluate(() => {
      const { app, player: p } = window.__splashery;
      app.setAutoplay({ turntable: false });
      p.opts.idleDelay = 1e9;
      p.idle.weight = 0;
      p.camera.cur = { ...p.camera.home };
      p.camera.tgt = { ...p.camera.home };
      p.camera.vel.yaw = p.camera.vel.pitch = 0;
      const recipe = p.toyInfo.recipe;
      recipe.workBufferReuse = false;
      p.update(0);
      const placement = p.stage.toy.entity.gsplat._placement;
      const before = placement.dirtyVersion;
      p.update(0);
      const warm = placement.dirtyVersion;
      recipe.workBufferReuse = true;
      p.update(0);
      const cached = placement.dirtyVersion;
      p.update(0);
      const settled = placement.dirtyVersion;
      p.act(null);
      p.update(0.1);
      return { before, warm, cached, settled, tap: placement.dirtyVersion };
    });
    expect(result.warm).toBeGreaterThan(result.before);
    expect(result.settled).toBe(result.cached);
    expect(result.tap).toBeGreaterThan(result.settled);
  }
});

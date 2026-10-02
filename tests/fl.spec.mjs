// Lane Fluids (docs/handoff/Fluids.md, docs/FLUIDS.md): the fluid engine and
// the Fluid lab. The solver tests run in Node (src/fluids/ is plain
// JavaScript); the rest open the app.

import { test, expect } from "@playwright/test";
import { FluidWorld } from "../src/fluids/world.js";

const GLASS = { type: "glass", at: [0, 0, 0], radius: 0.32, height: 1.0, wall: 0.03, bottom: 0.05 };

function liquid(spec, profile = "high") {
  return new FluidWorld([{ name: "l", kind: "liquid", unit: 0.33, ...spec }], { profile, seed: 7 })
    .systems[0];
}

// The drawn level: the height below which 97% of the particles sit.
function level(sys) {
  const ys = [];
  for (let i = 0; i < sys.n; i++) ys.push(sys.pos[i * 3 + 1]);
  ys.sort((a, b) => a - b);
  return ys[Math.floor(ys.length * 0.97)];
}

test("a glass holds its liquid: none escapes and the volume holds, even while it sloshes", () => {
  const sys = liquid({
    preset: "water",
    spacing: 0.048,
    budget: 1200,
    colliders: [GLASS],
    fill: { cylinder: { at: [0, 0.05, 0], radius: 0.3, height: 0.45 } },
  });
  const n0 = sys.n;
  // Rest volume of the lattice it started in, as a level in the glass.
  const cavity = Math.PI * GLASS.radius ** 2;
  const expected = GLASS.bottom + (n0 * sys.d ** 3) / cavity;
  // Slosh it: a sideways kick, then let it settle.
  for (let i = 0; i < n0; i++) sys.vel[i * 3] = 2.5;
  let worst = 0;
  const inside = () => {
    let out = 0;
    for (let i = 0; i < sys.n; i++) {
      const x = sys.pos[i * 3];
      const y = sys.pos[i * 3 + 1];
      const z = sys.pos[i * 3 + 2];
      if (Math.hypot(x, z) > GLASS.radius + 1e-3 || y < GLASS.bottom - 1e-3 || !Number.isFinite(x + y + z)) out++; // prettier-ignore
    }
    return out;
  };
  for (let s = 0; s < 720; s++) {
    sys.step(1 / 120);
    if (s % 60 === 0) worst = Math.max(worst, inside());
  }
  expect(sys.n).toBe(n0);
  expect(worst).toBe(0);
  expect(inside()).toBe(0);
  // Settled: its level within 6% of the volume it started with, and its
  // bulk density within 6% of rest.
  let rho = 0;
  let m = 0;
  for (let i = 0; i < sys.n; i++)
    if (sys.count[i] > 14) {
      rho += sys.rho[i] / sys.rho0;
      m++;
    }
  expect(Math.abs(rho / m - 1)).toBeLessThan(0.06);
  const lv = level(sys) + sys.rad;
  expect(Math.abs(lv - expected) / (expected - GLASS.bottom)).toBeLessThan(0.06);
});

test("viscosity: water spreads across a floor much faster than honey or lava", () => {
  const spread = (preset) => {
    const sys = liquid({
      preset,
      spacing: 0.05,
      budget: 700,
      colliders: [{ type: "floor", y: 0 }],
      fill: {
        box: [
          [-0.2, 0.02, -0.2],
          [0.2, 0.5, 0.2],
        ],
      },
    });
    for (let s = 0; s < 96; s++) sys.step(1 / 120);
    let r = 0;
    for (let i = 0; i < sys.n; i++) r = Math.max(r, Math.hypot(sys.pos[i * 3], sys.pos[i * 3 + 2]));
    return r;
  };
  const water = spread("water");
  const honey = spread("honey");
  const lava = spread("lava");
  expect(water).toBeGreaterThan(honey * 1.4);
  expect(honey).toBeGreaterThan(lava * 0.95);
});

test("every system packs finite values, and a lower tier has fewer, larger particles", () => {
  const specs = [
    { name: "l", kind: "liquid", preset: "soda", spacing: 0.05, budget: 600, colliders: [GLASS], fill: { cylinder: { at: [0, 0.05, 0], radius: 0.3, height: 0.3 } }, emitter: { at: [0, 1.5, 0], dir: [0, -1, 0], speed: 1.5, radius: 0.06 } }, // prettier-ignore
    { name: "s", kind: "gas", look: "smoke", budget: 300, source: { at: [0, 1, 0], radius: 0.02, rate: 200 } }, // prettier-ignore
    { name: "f", kind: "flame", at: [0, 1, 0], height: 0.3, budget: 200, smoke: "s" },
    { name: "g", kind: "vessel", shape: GLASS, budget: 800 },
  ];
  const high = new FluidWorld(specs, { profile: "high", seed: 3 });
  const mid = new FluidWorld(specs, { profile: "mid", seed: 3 });
  expect(mid.slots).toBeLessThan(high.slots);
  expect(mid.systems[0].d).toBeGreaterThan(high.systems[0].d);
  high.command({ l: { on: true } });
  for (let k = 0; k < 40; k++) high.step(1 / 30);
  const n = high.slots * 4;
  const b = [0, 1, 2, 3].map(() => new Float32Array(n));
  high.pack(...b);
  expect(b.every((a) => a.every(Number.isFinite))).toBe(true);
  // Every kind showed up: liquid, some diffuse, smoke, flame, glass.
  const kinds = new Set();
  for (let i = 0; i < high.slots; i++) kinds.add(Math.floor(b[1][i * 4 + 3] + 1e-4));
  for (const k of [1, 5, 7, 9]) expect(kinds.has(k), `kind ${k}`).toBe(true);
  expect(high.systems[1].n).toBeGreaterThan(20);
});

const APP = "/?renderer=webgl2&adapt=off&labs=1";

async function open(page, url = APP) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  return errors;
}

const fluidFiles = (page) =>
  page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((e) => e.name)
      .filter((u) => u.includes("/src/fluids/") || u.includes("/src/packs/fluid-lab.js")),
  );

test("nothing fluid loads on the shelf or in an embed until a fluid toy opens", async ({
  page,
}) => {
  const errors = await open(page);
  expect(await fluidFiles(page)).toEqual([]);
  await page.evaluate(() => window.__splashery.app.chooseToy("splat-field"));
  await page.waitForTimeout(500);
  expect(await fluidFiles(page)).toEqual([]);
  await page.goto("/embed/?toy=bee&renderer=webgl2");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  expect(await fluidFiles(page)).toEqual([]);
  await open(page);
  await page.evaluate(() => window.__splashery.app.chooseToy("fluid-lab"));
  await page.waitForFunction(() => window.__splashery.player.fluids?.stats?.particles > 0, null, { timeout: 60_000 }); // prettier-ignore
  const loaded = await fluidFiles(page);
  expect(loaded.some((u) => u.includes("/src/fluids/runtime.js"))).toBe(true);
  expect(errors).toEqual([]);
});

test("each scene builds within its tier's splat budget and draws its fluid", async ({ page }) => {
  for (const profile of ["low", "mid"]) {
    const errors = await open(page, `${APP}&profile=${profile}`);
    for (const scene of ["glass", "splash", "candle", "cup"]) {
      const r = await page.evaluate(
        async ({ scene }) => {
          const { app, player } = window.__splashery;
          await app.chooseToy("fluid-lab");
          await app.setToyOption("scene", scene);
          const t0 = performance.now();
          // (smoke, steam and flames run on the gas grid: cells, not particles)
          const on = () =>
            player.fluids?.stats?.particles > 0 || player.fluids?.stats?.gasCells > 0;
          while (!on() && performance.now() - t0 < 20_000)
            await new Promise((r) => setTimeout(r, 100));
          const { PROFILES } = await import("/src/generators.js");
          return {
            splats: player.toyInfo.splats,
            slots: player.fluids?.stats?.slots ?? 0,
            particles: player.fluids?.stats?.particles ?? 0,
            gasCells: player.fluids?.stats?.gasCells ?? 0,
            max: PROFILES[player.profile].maxCount,
          };
        },
        { scene },
      );
      expect(r.particles + r.gasCells, `${profile} ${scene}`).toBeGreaterThan(0);
      expect(r.splats + r.slots, `${profile} ${scene}`).toBeLessThanOrEqual(r.max);
    }
    expect(errors).toEqual([]);
  }
});

test("the worker runs the fluid off the page", async ({ page }) => {
  const errors = await open(page, `${APP}&fluids=worker&profile=mid`);
  const r = await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    await app.chooseToy("fluid-lab");
    const t0 = performance.now();
    while (!(player.fluids?.stats?.particles > 0) && performance.now() - t0 < 30_000)
      await new Promise((r) => setTimeout(r, 100));
    return { ...player.fluids.stats };
  });
  expect(r.mode).toBe("worker");
  expect(r.particles).toBeGreaterThan(100);
  expect(errors).toEqual([]);
});

test("the fluid program compiles on WebGPU too", async ({ page }) => {
  // ?fluids=cpu: the splat liquid (spray, foam and the CPU path) on WebGPU.
  const errors = await open(page, "/?renderer=webgpu&adapt=off&profile=low&labs=1&fluids=cpu");
  const dev = await page.evaluate(() => window.__splashery.player.stage?.deviceType);
  test.skip(dev !== "webgpu", "No WebGPU adapter in this browser.");
  await page.evaluate(() => window.__splashery.app.chooseToy("fluid-lab"));
  await page.waitForFunction(() => window.__splashery.player.fluids?.stats?.particles > 0, null, { timeout: 60_000 }); // prettier-ignore
  const c = await page.evaluate(async () => {
    const s = window.__splashery.player.stage;
    for (let i = 0; i < 3; i++) await s.captureFrame();
    const cv = await s.captureFrame();
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let blue = 0;
    for (let i = 0; i < d.length; i += 16) if (d[i + 2] > d[i] + 30 && d[i + 2] > 120) blue++;
    return blue;
  });
  expect(c).toBeGreaterThan(50);
  expect(errors).toEqual([]);
});

// Lane Fluids r4: the GPU solver (src/fluids/gpu/) against the CPU one, the
// fallback without WebGPU, and the budgets per tier.

test("the GPU liquid keeps the CPU liquid's volume in a glass and stays stable", async ({
  page,
}) => {
  const errors = await open(page, "/?renderer=webgpu&adapt=off&profile=low&labs=1");
  const dev = await page.evaluate(() => window.__splashery.player.stage?.deviceType);
  test.skip(dev !== "webgpu", "No WebGPU adapter in this browser.");
  const r = await page.evaluate(async (GLASS) => {
    const { FluidWorld } = await import("/src/fluids/world.js");
    const { GpuLiquid } = await import("/src/fluids/gpu/liquid.js");
    const device = window.__splashery.player.stage.device;
    const spec = {
      name: "l",
      kind: "liquid",
      unit: 0.33,
      preset: "water",
      colliders: [GLASS],
      fill: { cylinder: { at: [0, 0.05, 0], radius: 0.3, height: 0.45 } },
    };
    const level = (ys) => (ys.sort((a, b) => a - b), ys[Math.floor(ys.length * 0.97)]);
    const cpu = new FluidWorld([{ ...spec, spacing: 0.048, budget: 1200 }], { profile: "low", seed: 7 }).systems[0]; // prettier-ignore
    const gw = new FluidWorld([spec], { profile: "low", seed: 7, gpu: { device, GpuLiquid }, surface: true }); // prettier-ignore
    const gpu = gw.systems[0];
    const n0 = gpu.n;
    // Let both settle for two seconds.
    for (let f = 0; f < 60; f++) cpu.step(1 / 30);
    let worst = 0;
    let bad = 0;
    const ys = [];
    for (let f = 0; f < 60; f++) {
      gw.step(1 / 30);
      if (f % 20 !== 19) continue;
      const d = await gpu.sim.readPositions();
      const h = gpu.h;
      ys.length = 0;
      let out = 0;
      for (let i = 0; i < gpu.n; i++) {
        const x = gpu.origin[0] + d[i * 6] * h;
        const y = gpu.origin[1] + d[i * 6 + 1] * h;
        const z = gpu.origin[2] + d[i * 6 + 2] * h;
        if (![x, y, z].every(Number.isFinite)) bad++;
        // (past the glass's outer wall or under its foot: a leak)
        else if (Math.hypot(x, z) > GLASS.radius + GLASS.wall || y > GLASS.height || y < -0.02) {
          out++;
        }
        ys.push(y);
      }
      worst = Math.max(worst, out);
    }
    const cys = [];
    for (let i = 0; i < cpu.n; i++) cys.push(cpu.pos[i * 3 + 1]);
    // Each one's expected level: its particles' rest volume in the glass.
    const cavity = Math.PI * GLASS.radius ** 2;
    const want = (s) => GLASS.bottom + (s.n * s.d ** 3) / cavity;
    const out = { n0, n: gpu.n, cpuN: cpu.n, bad, worst, gpu: level(ys) / want(gpu), cpu: level(cys) / want(cpu) }; // prettier-ignore
    gpu.destroy();
    return out;
  }, GLASS);
  // Far more particles than the CPU's, none lost, none outside, none broken.
  expect(r.n0).toBeGreaterThan(r.cpuN * 4);
  expect(r.n).toBe(r.n0);
  expect(r.bad).toBe(0);
  expect(r.worst).toBeLessThanOrEqual(Math.ceil(r.n * 0.002));
  // The level its volume gives, as close as the CPU liquid comes to its own.
  expect(Math.abs(r.gpu - 1)).toBeLessThan(Math.max(0.12, Math.abs(r.cpu - 1) + 0.05));
  expect(errors).toEqual([]);
});

test("without WebGPU the CPU liquid runs as before, and the gas grid still draws", async ({
  page,
}) => {
  const errors = await open(page, `${APP}&profile=low`);
  const r = await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    await app.chooseToy("fluid-lab");
    const wait = async (f) => {
      const t0 = performance.now();
      while (!f() && performance.now() - t0 < 30_000) await new Promise((r) => setTimeout(r, 100));
    };
    await wait(() => player.fluids?.stats?.particles > 0);
    const glass = { ...player.fluids.stats, device: player.stage.deviceType };
    await app.setToyOption("scene", "candle");
    await wait(() => player.fluids?.stats?.gasCells > 0);
    return { glass, candle: { ...player.fluids.stats } };
  });
  expect(r.glass.device).toBe("webgl2");
  expect(r.glass.mode).toBe("sync");
  expect(r.glass.particles).toBeGreaterThan(100);
  expect(r.candle.gasCells).toBeGreaterThan(1000);
  expect(errors).toEqual([]);
});

test("the pour's sound follows the liquid: silent until the stream lands, then the level rises", async () => {
  // (the owner's note: the sound "isn't in sync with fluid pour animation")
  const { RECIPES } = await import("../src/packs/fluid-lab.js");
  const { Kit } = await import("../src/kit.js");
  const k = new Kit(1, { count: 20000 });
  RECIPES["fluid-lab"].build(k, { scene: "glass", liquid: "water" });
  const w = new FluidWorld(k.fluids, { profile: "mid", seed: 1 });
  const rows = [];
  for (let f = 0; f < 90; f++) {
    w.command({ liquid: { on: f >= 15 } });
    w.step(1 / 30);
    rows.push({ t: f / 30, ...w.stats.sound });
  }
  // The tap opens the tap at 0.5 s; the stream takes a moment to fall.
  const first = rows.find((r) => r.flux > 0);
  expect(first.t).toBeGreaterThan(0.6);
  expect(first.t).toBeLessThan(1.2);
  // While it pours, liquid keeps landing, and the pool's top rises.
  const pouring = rows.filter((r) => r.t > 1.3);
  expect(pouring.filter((r) => r.flux > 0).length).toBeGreaterThan(pouring.length * 0.6);
  expect(rows.at(-1).level).toBeGreaterThan(first.level + 0.05);
});

test("GPU budgets grow with the tier, and the phone tiers stay small", async () => {
  const { GPU_TIERS } = await import("../src/fluids/gpu/liquid.js");
  const { GAS_TIERS } = await import("../src/fluids/gpu/gas.js");
  const order = ["low", "mid", "high", "max"];
  for (let i = 1; i < order.length; i++) {
    const a = GPU_TIERS[order[i - 1]];
    const b = GPU_TIERS[order[i]];
    expect(b.cap).toBeGreaterThan(a.cap);
    expect(b.cell).toBeLessThan(a.cell);
    expect(GAS_TIERS[order[i]].n).toBeGreaterThanOrEqual(GAS_TIERS[order[i - 1]].n);
  }
  expect(GPU_TIERS.low.cap).toBeLessThanOrEqual(12_000);
  expect(GAS_TIERS.low.n ** 3).toBeLessThanOrEqual(24 ** 3);
  // Ten or more times the CPU's largest liquid on a computer.
  const { TIER_SCALE } = await import("../src/fluids/world.js");
  expect(GPU_TIERS.high.cap).toBeGreaterThanOrEqual(10 * 1300 * TIER_SCALE.max);
});

test("screenshots at phone and desktop size", async ({ browser }) => {
  for (const [w, h] of [
    [390, 844],
    [1440, 900],
  ]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(`${APP}&profile=mid`);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("fluid-lab"));
    await page.waitForFunction(() => window.__splashery.player.fluids?.stats?.particles > 0, null, { timeout: 60_000 }); // prettier-ignore
    await page.evaluate(() => window.__splashery.player.act(null));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `tests/screenshots/fl-fluid-lab-${w}x${h}.png` });
    await page.close();
  }
});

// Lane Fluids r5: the owner wanted to tap the faucet's handle to pour. On
// WebGPU the props are traced and their splats shrink inside the traced
// shapes, but they stay there to be tapped.
test("a tap on the faucet's handle pours", async ({ page }) => {
  await open(page, "/?renderer=webgpu&adapt=off&profile=low&labs=1");
  const dev = await page.evaluate(() => window.__splashery.player.stage?.deviceType);
  test.skip(dev !== "webgpu", "No WebGPU adapter in this browser.");
  const at = await page.evaluate(async () => {
    const pc = await import("/src/pc.js");
    const { app, player } = window.__splashery;
    await app.chooseToy("fluid-lab");
    const stage = player.stage;
    for (let i = 0; i < 200 && !player.fluids?.fx; i++) await stage.captureFrame();
    for (let i = 0; i < 10; i++) await stage.captureFrame();
    const m = player.fluids.fx.toyToWorld();
    // The red handle's middle (recipe units: the nozzle at x -0.06, y 1.72).
    const s = stage.cameraEntity.camera.worldToScreen(
      m.transformPoint(new pc.Vec3(0.14, 1.97, 0.06)),
    );
    const r = stage.app.graphicsDevice.canvas.getBoundingClientRect();
    return [r.left + s.x, r.top + s.y];
  });
  const pouring = () =>
    page.evaluate(() => {
      const liq = window.__splashery.player.fluids.world.systems.find((s) => s.gpu);
      return !!liq.emitter?.on;
    });
  expect(await pouring()).toBe(false);
  await page.mouse.click(at[0], at[1]);
  await expect.poll(pouring, { timeout: 20_000 }).toBe(true);
});

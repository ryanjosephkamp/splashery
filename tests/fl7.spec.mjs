// Lane Fluids r7 (docs/FLUIDS.md, "r7"): the Fluid lab on a phone. The envelope
// (src/fluids/phone.js), the recovery (FluidRuntime.watch) and the readback
// arrays. Page tests force the phone with ?phone=1, since the test browser
// has a fine pointer.

import { test, expect } from "@playwright/test";
import { FluidWorld } from "../src/fluids/world.js";
import { PHONE_ENV } from "../src/fluids/phone.js";

async function open(page, url) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  return errors;
}

async function openLab(page, url, scene) {
  const errors = await open(page, url);
  await page.evaluate(async (scene) => {
    const { app } = window.__splashery;
    await app.chooseToy("fluid-lab");
    if (scene !== "glass") await app.setToyOption("scene", scene);
  }, scene);
  await page.waitForFunction(() => window.__splashery.player.fluids?.mode, null, {
    timeout: 60_000,
  });
  return errors;
}

test("on the CPU a phone halves a glass's liquid budget and a splash's vessel, and keeps the splash's pool", () => {
  const liquid = { name: "l", kind: "liquid", unit: 0.33, spacing: 0.052, budget: 1200, preset: "water" }; // prettier-ignore
  const vessel = { name: "v", kind: "vessel", budget: 9000, shape: { type: "glass", at: [0, 0, 0], radius: 0.3, height: 1 } }; // prettier-ignore
  const phoneSpec = { phone: { scale: PHONE_ENV.cpuScale } };
  const before = new FluidWorld([liquid], { profile: "mid", seed: 3 }).systems[0];
  const after = new FluidWorld([{ ...liquid, ...phoneSpec }], { profile: "mid", seed: 3, phone: true }).systems[0]; // prettier-ignore
  expect(before.cap).toBe(540);
  expect(after.cap).toBe(270);
  // (the spacing grows by the cube root of 2, so the volume stays)
  expect(after.d / before.d).toBeCloseTo(Math.cbrt(2), 2);
  // A spec that asks for nothing is unchanged, and so is a world without the phone flag.
  const same = new FluidWorld([liquid], { profile: "mid", seed: 3, phone: true }).systems[0];
  expect(same.cap).toBe(540);
  const v0 = new FluidWorld([vessel], { profile: "mid", seed: 3 }).systems[0];
  const v1 = new FluidWorld([{ ...vessel, ...phoneSpec }], { profile: "mid", seed: 3, phone: true }).systems[0]; // prettier-ignore
  expect(v1.cap).toBe(v0.cap / 2);
});

test("the phone envelope: the hint, a 1.5 canvas cap, fewer prop splats, smaller gas grids", async ({
  page,
}) => {
  const errors = await openLab(page, "/?renderer=webgl2&adapt=off&labs=1&phone=1&profile=mid", "candle"); // prettier-ignore
  const r = await page.evaluate(() => {
    const { player } = window.__splashery;
    const g = player.fluids.fx?.gas;
    return {
      note: document.getElementById("toy-note")?.textContent,
      ratio: player.stage.pixelRatio(),
      cap: player.stage.sharp?.dpr,
      envelope: player.fluids.opts.phone,
      flame: g?.flameGrid?.dims,
      smoke: g?.smokeGrid?.dims,
      splats: player.toyInfo.splats,
    };
  });
  expect(r.note).toContain("This lab runs best on a computer. On a phone, choose Auto detail.");
  expect(r.envelope).toBe(true);
  expect(r.cap).toBe(1.5);
  expect(r.ratio).toBeLessThanOrEqual(1.5);
  expect(r.flame).toEqual([20, 58, 20]);
  expect(r.smoke).toEqual([20, 65, 20]);
  // The same toy without the phone envelope: the mid tier's grids and splats.
  await page.goto("/?renderer=webgl2&adapt=off&labs=1&phone=0&profile=mid");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(async () => {
    await window.__splashery.app.chooseToy("fluid-lab");
    await window.__splashery.app.setToyOption("scene", "candle");
  });
  await page.waitForFunction(() => window.__splashery.player.fluids?.fx?.gas, null, { timeout: 60_000 }); // prettier-ignore
  const d = await page.evaluate(() => {
    const { player } = window.__splashery;
    const g = player.fluids.fx.gas;
    return {
      note: document.getElementById("toy-note")?.textContent,
      flame: g.flameGrid.dims,
      splats: player.toyInfo.splats,
    };
  });
  expect(d.note).toBe("");
  expect(d.flame).toEqual([28, 81, 28]);
  expect(r.splats).toBeLessThan(d.splats * 0.5);
  expect(errors).toEqual([]);
});

test("a deliberate High detail (or ?profile=high) keeps the full lab on a phone", async ({
  page,
}) => {
  const errors = await openLab(page, "/?renderer=webgl2&adapt=off&labs=1&phone=1&profile=high", "cup"); // prettier-ignore
  const r = await page.evaluate(() => {
    const { player } = window.__splashery;
    return { envelope: player.fluids.opts.phone, dims: player.fluids.fx?.gas?.smokeGrid?.dims, cap: player.stage.sharp?.dpr }; // prettier-ignore
  });
  expect(r.envelope).toBe(false);
  expect(r.dims[0]).toBeGreaterThan(20);
  expect(r.cap).toBeUndefined();
  expect(errors).toEqual([]);
});

test("slow frames step down: the pixel cap, then a rebuild into the phone envelope, then the pause offer", async ({
  page,
}) => {
  // ?profile=high keeps the envelope off at the start, so the rebuild shows.
  const errors = await openLab(page, "/?renderer=webgl2&adapt=off&labs=1&phone=1&profile=high", "cup"); // prettier-ignore
  const r = await page.evaluate(async () => {
    const { player } = window.__splashery;
    const notes = [];
    player.on("message", (m) => notes.push(m));
    const rt = player.fluids;
    const out = { steps: [] };
    // (hidden or loading time, and gaps over 2 s, count for nothing)
    let t = performance.now() + 5000;
    rt.slow.born = 0;
    rt.slow.last = t;
    rt.watch((t += 3000));
    rt.watch((t += 40));
    out.ignored = { level: rt.slow.level, cap: player.stage.fluidCap ?? null };
    // 40 ms frames (25 fps) for a while: 1.5 s trips the first step.
    const run = (ms, dt = 40) => {
      for (let s = 0; s < ms; s += dt) rt.watch((t += dt));
    };
    run(2000);
    out.steps.push({ level: rt.slow.level, cap: player.stage.fluidCap, notes: notes.length });
    const before = rt.fx;
    run(2000);
    out.steps.push({ level: rt.slow.level, envelope: rt.opts.phone, newFx: rt.fx !== before });
    run(3000);
    out.steps.push({ level: rt.slow.level, notes: notes.length });
    out.notes = notes;
    return out;
  });
  expect(r.ignored).toEqual({ level: 0, cap: null });
  expect(r.steps[0]).toEqual({ level: 1, cap: 1, notes: 1 });
  expect(r.steps[1]).toEqual({ level: 2, envelope: true, newFx: true });
  expect(r.steps[2].level).toBe(3);
  expect(r.notes[0]).toBe("This lab runs best on a computer. On a phone, choose Auto detail.");
  expect(r.notes[1]).toContain("pause");
  // The rebuilt scene runs on the smaller grids.
  await page.waitForFunction(() => window.__splashery.player.fluids.fx?.gas?.smokeGrid, null, { timeout: 60_000 }); // prettier-ignore
  const dims = await page.evaluate(() => window.__splashery.player.fluids.fx.gas.smokeGrid.dims);
  expect(dims).toEqual([20, 33, 20]);
  expect(errors).toEqual([]);
});

test("one stall, or a desktop, never trips the recovery", async ({ page }) => {
  const errors = await openLab(page, "/?renderer=webgl2&adapt=off&labs=1&phone=1&profile=mid", "cup"); // prettier-ignore
  const level = await page.evaluate(() => {
    const rt = window.__splashery.player.fluids;
    let t = performance.now() + 5000;
    rt.slow.born = 0;
    rt.slow.last = t;
    for (let i = 0; i < 200; i++) rt.watch((t += 16));
    rt.watch((t += 1900)); // one long stall
    for (let i = 0; i < 100; i++) rt.watch((t += 16));
    return rt.slow.level;
  });
  expect(level).toBe(0);
  await page.goto("/?renderer=webgl2&adapt=off&labs=1&phone=0&profile=mid");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("fluid-lab"));
  await page.waitForFunction(() => window.__splashery.player.fluids?.mode, null, {
    timeout: 60_000,
  });
  const desk = await page.evaluate(() => {
    const rt = window.__splashery.player.fluids;
    let t = performance.now() + 5000;
    rt.slow.born = 0;
    rt.slow.last = t;
    for (let i = 0; i < 300; i++) rt.watch((t += 60));
    return rt.slow.level;
  });
  expect(desk).toBe(0);
  expect(errors).toEqual([]);
});

test("WebGPU: the phone envelope's liquid, and a reused readback that matches a fresh one", async ({
  page,
}) => {
  const errors = await open(
    page,
    "/?renderer=webgpu&adapt=off&labs=1&phone=1&profile=mid&fluids=sync",
  );
  const dev = await page.evaluate(() => window.__splashery.player.stage?.deviceType);
  test.skip(dev !== "webgpu", "No WebGPU adapter in this browser.");
  await page.evaluate(() => window.__splashery.app.chooseToy("fluid-lab"));
  await page.waitForFunction(() => window.__splashery.player.fluids?.world?.systems?.some((s) => s.gpu), null, { timeout: 60_000 }); // prettier-ignore
  const r = await page.evaluate(async () => {
    const liq = window.__splashery.player.fluids.world.systems.find((s) => s.gpu);
    await new Promise((res) => setTimeout(res, 800));
    const fresh = await liq.sim.readPositions();
    const a = await liq.sim.readPositions(true);
    const aCopy = a.slice();
    const b = await liq.sim.readPositions(true);
    return {
      cap: liq.cap,
      h: liq.h,
      n: liq.n,
      len: [fresh.length, a.length],
      sameBuffer: a.buffer === b.buffer,
      finite: a.every(Number.isFinite),
      aCopyLen: aCopy.length,
    };
  });
  expect(r.cap).toBe(6000);
  expect(r.h).toBeCloseTo(0.05, 5);
  expect(r.len[0]).toBe(r.len[1]);
  expect(r.sameBuffer).toBe(true);
  expect(r.finite).toBe(true);
  expect(errors).toEqual([]);
});

test("WebGPU: switching scenes does not grow the projector buffers", async ({ page }) => {
  const errors = await open(page, "/?renderer=webgpu&adapt=off&labs=1&phone=1&profile=mid");
  const dev = await page.evaluate(() => window.__splashery.player.stage?.deviceType);
  test.skip(dev !== "webgpu", "No WebGPU adapter in this browser.");
  await page.evaluate(() => window.__splashery.app.chooseToy("fluid-lab"));
  await page.waitForTimeout(1500);
  const count = () => page.evaluate(() => window.__splashery.player.stage.device.buffers.length ?? [...window.__splashery.player.stage.device.buffers].length); // prettier-ignore
  const counts = [];
  for (let cycle = 0; cycle < 3; cycle++) {
    for (const scene of ["candle", "cup", "splash", "glass"]) {
      await page.evaluate((s) => window.__splashery.app.setToyOption("scene", s), scene);
      await page.waitForTimeout(800);
    }
    counts.push(await count());
  }
  // (after the first cycle's one-time allocations, a cycle adds nothing)
  expect(counts[2]).toBeLessThanOrEqual(counts[1]);
  expect(errors).toEqual([]);
});

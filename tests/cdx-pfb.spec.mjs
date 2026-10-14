// Codex task 78b: the specimen's moments, membrane model, and real rendered controls.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { buildRecipe, quatRotate } from "../src/kit.js";
import { TOYS } from "../src/toys.js";
import { MotionDriver } from "../src/motion.js";

async function pack() {
  expect(fs.existsSync("src/packs/neuron.js"), "the new neuron pack exists").toBe(true);
  return import("../src/packs/neuron.js");
}

function error(a, b) {
  return Math.max(
    Math.abs(a.w - b.w),
    ...a.m.map((x, i) => Math.abs(x - b.m[i])),
    ...a.S.map((x, i) => Math.abs(x - b.S[i])),
  );
}

test("each focus level conserves mass, center, covariance, and stain", async () => {
  const { growNeuron, buildFocusTree, gaussianMoments } = await pack();
  for (const depth of [12, 13, 15]) {
    const cell = growNeuron(1952, depth);
    expect(cell.leaves).toHaveLength(2 ** depth);
    const tree = buildFocusTree(cell.leaves);
    const finest = gaussianMoments(cell.leaves);
    expect(finest.w).toBeCloseTo(1, 12);
    expect(Math.hypot(...finest.m)).toBeLessThan(1e-12);
    for (let level = 0; level <= depth; level++) {
      const nodes = tree.nodes.slice(2 ** level, 2 ** (level + 1));
      expect(error(gaussianMoments(nodes), finest), `depth ${depth}, level ${level}`).toBeLessThan(
        1e-12,
      );
    }
    let worst = 0,
      invalidCovariances = 0,
      invalidStains = 0;
    for (let i = 1; i < tree.nodes.length; i++) {
      const s = tree.nodes[i];
      const [xx, yy, zz, xy, xz, yz] = s.S;
      if (
        !(
          xx > 0 &&
          xx * yy > xy * xy &&
          xx * (yy * zz - yz * yz) - xy * (xy * zz - yz * xz) + xz * (xy * yz - yy * xz) > 0
        )
      )
        invalidCovariances++;
      if (Math.abs(s.k.reduce((a, b) => a + b, 0) - 1) > 1e-12) invalidStains++;
      if (i < cell.leaves.length)
        worst = Math.max(
          worst,
          error(s, gaussianMoments([tree.nodes[i * 2], tree.nodes[i * 2 + 1]])),
        );
    }
    expect(worst).toBeLessThan(1e-12);
    expect({ invalidCovariances, invalidStains }).toEqual({
      invalidCovariances: 0,
      invalidStains: 0,
    });
    // The axon's delay increases toward its terminal arbor.
    expect(cell.leaves.filter((s) => s.delay > 4 && s.delay < 12).length).toBeGreaterThan(100);
    expect(cell.last).toBeGreaterThan(12);
  }
});

test("PlayCanvas axes reconstruct rotated and merged covariances", async () => {
  const { covarianceAxes, growNeuron, buildFocusTree } = await pack();
  const tree = buildFocusTree(growNeuron(1952, 12).leaves);
  for (let i = 1; i < tree.nodes.length; i += 37) {
    const s = tree.nodes[i];
    const { scales, quat } = covarianceAxes(s.S);
    const axes = [0, 1, 2].map((k) =>
      quatRotate(
        quat,
        [0, 1, 2].map((j) => (j === k ? scales[k] : 0)),
      ),
    );
    const cov = [
      [0, 0],
      [1, 1],
      [2, 2],
      [0, 1],
      [0, 2],
      [1, 2],
    ].map(([r, c]) => axes.reduce((v, a) => v + a[r] * a[c], 0));
    expect(Math.max(...cov.map((x, k) => Math.abs(x - s.S[k])))).toBeLessThan(1e-10);
  }
});

test("Hodgkin-Huxley rests, fires above threshold, and returns through an undershoot", async () => {
  const { hodgkinHuxley, spikeAt } = await pack();
  const rest = hodgkinHuxley({ current: 0 });
  expect(Math.max(...rest.trace.map((v) => Math.abs(v + 65)))).toBeLessThan(0.05);
  const spike = hodgkinHuxley();
  expect(spike.peak).toBeGreaterThan(20);
  expect(spike.peak).toBeLessThan(50);
  expect(spike.trough).toBeGreaterThan(-77);
  expect(spike.trough).toBeLessThan(-70);
  let lo = 0,
    hi = 20;
  while (hi - lo > 0.01) {
    const mid = (lo + hi) / 2;
    if (hodgkinHuxley({ current: mid }).peak > 0) hi = mid;
    else lo = mid;
  }
  expect(hodgkinHuxley({ current: hi - 0.02 }).peak).toBeLessThan(0);
  expect(hodgkinHuxley({ current: hi }).peak).toBeGreaterThan(0);
  const crest = spike.trace.indexOf(spike.peak) * spike.step;
  expect(spikeAt(4 + crest, 4, 1, spike)).toBeCloseTo(1, 8);
  expect(spikeAt(4 + crest, 10, 1, spike)).toBe(0);
  expect(spikeAt(10 + crest, 10, 1, spike)).toBeCloseTo(1, 8);
  expect(spikeAt(100, 10, 1, spike)).toBe(0);
});

test("the new labs toy preserves the existing neuron and respects phone and desktop budgets", async () => {
  const { RECIPES, focusLevel } = await pack();
  expect(TOYS.find((t) => t.id === "neuron")).toMatchObject({ pack: "tiny" });
  expect(TOYS.find((t) => t.id === "specimen-neuron")).toMatchObject({
    pack: "neuron",
    labs: true,
    category: "tiny",
  });
  const recipe = RECIPES["specimen-neuron"];
  for (const [count, leaves] of [
    [21000, 8192],
    [70000, 32768],
  ]) {
    const it = buildRecipe(recipe, { seed: 1952, count, options: { stain: "nissl" } });
    let r = it.next();
    while (!r.done) r = it.next();
    expect(r.value.buf.count).toBe(leaves * 2 - 1);
    expect(r.value.buf.count).toBeLessThanOrEqual(count);
    expect(r.value.kit.data.depth).toBe(Math.log2(leaves));
    expect(focusLevel(0, Math.log2(leaves))).toBe(0);
    expect(focusLevel(1, Math.log2(leaves))).toBe(Math.log2(leaves));
    expect(focusLevel(NaN, Math.log2(leaves))).toBe(Math.log2(leaves));
  }
});

test("a tap after the visible wave fires again instead of pausing its quiet tail", async () => {
  const { RECIPES, growNeuron, spikeAt } = await pack();
  const recipe = RECIPES["specimen-neuron"];
  const build = buildRecipe(recipe, { seed: 1952, count: 21000, options: { stain: "nissl" } });
  let r = build.next();
  while (!r.done) r = build.next();
  const driver = new MotionDriver();
  driver.setToy(recipe, r.value);
  driver.act(0);
  for (let i = 1; i <= 30; i++)
    driver.compute({
      time: i * 0.1,
      dt: 0.1,
      motion: { alive: true, speed: 0.5 },
      info: { radius: 1, half: [1, 1, 1], center: [0, 0, 0] },
      cameraPos: [0, 0, 3],
    });
  expect(Math.max(...growNeuron(1952, 13).leaves.map((s) => spikeAt(21, s.delay, s.gain)))).toBe(0);
  expect(driver.state.fire).toBeGreaterThan(0);
  const tap = driver.act(3);
  expect(tap.paused).not.toBe(true);
  expect(tap.resumed).not.toBe(true);
  expect(driver.state.fire).toBe(1);
  expect(driver.pausedAt).toBeNull();
});

for (const [width, height, profile, leaves] of [
  [390, 844, "low", 8192],
  [1440, 900, "high", 32768],
]) {
  test(`stains, focus, and a traveling spike render at ${width}×${height}`, async ({ page }) => {
    const problems = [];
    page.on("pageerror", (e) => problems.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") problems.push(m.text());
    });
    await page.setViewportSize({ width, height });
    await page.goto(`/?labs=1&renderer=webgl2&adapt=off&profile=${profile}`);
    await page.waitForSelector("body[data-ready='true']");
    expect(await page.title()).toContain("Splashery");
    const result = await page.evaluate(async () => {
      const { app, player } = window.__splashery;
      await app.chooseToy("specimen-neuron");
      player.camera.setTurntable(false);
      player.idle.weight = 0;
      player.opts.idleDelay = 1e9;
      const depth = player.proc.ctx.kit.data.depth;
      let imageWidth = 0;
      const grab = async () => {
        for (let i = 0; i < 3; i++) await player.stage.captureFrame();
        const canvas = await player.stage.captureFrame();
        imageWidth = canvas.width;
        const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
        const sample = [];
        for (let i = 0; i < pixels.length; i += 16)
          sample.push(pixels[i], pixels[i + 1], pixels[i + 2]);
        return sample;
      };
      const rest = await grab();
      const stains = [];
      for (const stain of ["golgi", "he", "nissl"]) {
        await app.setToyOption("stain", stain);
        stains.push(await grab());
      }
      player.motion.setControl("focus", 0, { snap: true });
      const merged = await grab();
      player.motion.setControl("focus", 1, { snap: true });
      const home = await grab();
      // Step the real motion driver and GPU through the wave, independent of host render speed.
      const handlers = player.stage.updateHandlers.slice();
      player.stage.updateHandlers.length = 0;
      let tick = 0;
      player.stage.updateHandlers.push(() => {
        for (const h of handlers) h(tick);
        tick = 0;
      });
      const wave = [];
      player.act();
      for (let i = 0; i < 30; i++) {
        tick = 0.1;
        await player.stage.captureFrame();
        if ([7, 12, 19].includes(i)) wave.push(await grab());
      }
      const diff = (a, b) => a.reduce((sum, v, i) => sum + Math.abs(v - b[i]), 0) / a.length;
      const quiet = await grab();
      const waveCenters = wave.map((pixels) => {
        let mass = 0,
          xsum = 0;
        for (let i = 0; i < pixels.length; i += 3) {
          const redness = pixels[i] - (pixels[i + 1] + pixels[i + 2]) / 2;
          const base = home[i] - (home[i + 1] + home[i + 2]) / 2;
          const weight = Math.max(0, redness - base - 10);
          mass += weight;
          xsum += (weight * (((i / 3) * 4) % imageWidth)) / imageWidth;
        }
        return mass ? xsum / mass : 0;
      });
      player.stage.updateHandlers.length = 0;
      player.stage.updateHandlers.push(...handlers);
      return {
        depth,
        stainDiffs: stains.slice(0, 2).map((s) => diff(s, rest)),
        mergeDiff: diff(merged, home),
        waveDiffs: wave.map((s) => diff(s, home)),
        travelDiff: diff(wave[0], wave[2]),
        quietDiff: diff(quiet, home),
        waveCenters,
        drawn: rest.filter((x) => x < 200).length,
      };
    });
    expect(result.depth).toBe(Math.log2(leaves));
    expect(result.drawn).toBeGreaterThan(200);
    for (const d of result.stainDiffs) expect(d).toBeGreaterThan(0.2);
    expect(result.mergeDiff).toBeGreaterThan(0.5);
    for (const [i, d] of result.waveDiffs.entries())
      expect(d, `wave at phase ${i}: ${JSON.stringify(result)}`).toBeGreaterThan(0.05);
    expect(result.travelDiff).toBeGreaterThan(0.05);
    expect(result.waveCenters[1]).toBeGreaterThan(result.waveCenters[0] + 0.02);
    expect(result.waveCenters[2]).toBeGreaterThan(result.waveCenters[1] + 0.02);
    expect(result.quietDiff).toBeLessThan(0.02);
    // Public controls are keyboard reachable and update the same rendered state.
    if (width < 700) await page.locator("#sheet-toggle").click();
    await page.locator("#tab-play").click();
    await expect(page.getByRole("button", { name: "Fire a spike", exact: true })).toBeVisible();
    await page.locator("#ctl-focus").fill("50");
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.scene.motion.controls.focus))
      .toBe(0.5);
    await page.locator("#ctl-focus").press("End");
    await page.locator("#toy-options select").selectOption("golgi");
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.scene.toy.options.stain))
      .toBe("golgi");
    await page.locator("#toy-options select").selectOption("nissl");
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.motion.state.focus))
      .toBeGreaterThan(0.99);
    if (width < 700) await page.locator("#sheet-toggle").click();
    await page.screenshot({ path: `tests/screenshots/cdx-pfb-neuron-${width}x${height}.png` });
    expect(problems).toEqual([]);
  });
}

test("focus and the membrane wave render through the WebGPU hook when available", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/?labs=1&renderer=webgpu&adapt=off&profile=low");
  await page.waitForSelector("body[data-ready='true']");
  const device = await page.evaluate(() => window.__splashery.player.stage.deviceType);
  test.skip(device !== "webgpu", "No WebGPU adapter in this browser.");
  const result = await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    await app.chooseToy("specimen-neuron");
    player.camera.setTurntable(false);
    player.idle.weight = 0;
    player.stage.setFixedSize([390, 390]);
    const grab = async () => {
      for (let i = 0; i < 3; i++) await player.stage.captureFrame();
      const canvas = await player.stage.captureFrame();
      return canvas.getContext("2d").getImageData(0, 0, 390, 390).data;
    };
    const full = await grab();
    player.motion.setControl("focus", 0, { snap: true });
    const merged = await grab();
    player.motion.setControl("focus", 1, { snap: true });
    // Hold a model moment, so software rendering time cannot finish the spike first.
    const handlers = player.stage.updateHandlers.slice();
    player.stage.updateHandlers.length = 0;
    player.stage.updateHandlers.push(() => {
      for (const h of handlers) h(0);
    });
    player.motion.state.fire = 1 - 0.8 / 4.6;
    const wave = await grab();
    const diff = (a, b) => a.reduce((sum, v, i) => sum + Math.abs(v - b[i]), 0) / a.length;
    return { merge: diff(full, merged), wave: diff(full, wave) };
  });
  expect(result.merge).toBeGreaterThan(0.5);
  expect(result.wave).toBeGreaterThan(0.05);
  expect(errors).toEqual([]);
});

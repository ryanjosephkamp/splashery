import { test, expect } from "@playwright/test";
import { RECIPES } from "../src/packs/proto-normal-modes.js";
import { Chain, modes, STEP, RUN, DURATION } from "../src/packs/proto-normal-modes/physics.js";
import { buildRecipe } from "../src/kit.js";
import { resolveOptions } from "../src/player.js";
import { TOYS } from "../src/toys.js";

const recipe = RECIPES["normal-modes"];
const APP = "/?renderer=webgl2&adapt=off&profile=weak&labs=1";

test("normal-modes: two equal masses have ω = √(k/m) and √(3k/m)", () => {
  const frequencies = modes(2, 16, 1);
  expect(frequencies[0].omega).toBeCloseTo(4, 12);
  expect(frequencies[1].omega).toBeCloseTo(4 * Math.sqrt(3), 12);
  const general = modes(2, 9, 4);
  expect(general[0].omega).toBeCloseTo(1.5, 12);
  expect(general[1].omega).toBeCloseTo(1.5 * Math.sqrt(3), 12);
  // Independent closed-form solution for a displaced first mass.
  const chain = new Chain(2, [0.2, 0]);
  for (const t of [0, 0.019, 0.5, 1.37, RUN]) {
    const x = chain.advance(t);
    expect(x[0]).toBeCloseTo(0.1 * (Math.cos(4 * t) + Math.cos(4 * Math.sqrt(3) * t)), 11);
    expect(x[1]).toBeCloseTo(0.1 * (Math.cos(4 * t) - Math.cos(4 * Math.sqrt(3) * t)), 11);
    expect(chain.steps).toBe(Math.floor((t + 1e-10) / STEP));
  }
});

test("normal-modes: modes satisfy Newton's law and conserve energy over many fixed steps", () => {
  for (const n of [2, 3, 4, 5]) {
    for (const { omega, vector } of modes(n)) {
      vector.forEach((x, i) => {
        const acceleration = 16 * ((vector[i - 1] || 0) - 2 * x + (vector[i + 1] || 0));
        expect(acceleration).toBeCloseTo(-(omega ** 2) * x, 11);
      });
      expect(vector.reduce((s, x) => s + x * x, 0)).toBeCloseTo(1, 12);
    }
    const chain = new Chain(n, [0.24, ...new Array(n - 1).fill(0)]);
    const energy = () =>
      chain.modes.reduce(
        (s, { omega }, j) => s + (chain.v[j] ** 2 + omega ** 2 * chain.q[j] ** 2) / 2,
        0,
      );
    const before = energy();
    chain.advance(120);
    expect(energy()).toBeCloseTo(before, 10);
  }
});

test("normal-modes: labs shelf, bounded builds, and pure-mode starts", () => {
  expect(TOYS.find((t) => t.id === "normal-modes")).toMatchObject({
    labs: true,
    category: "science",
    kind: "kit",
  });
  for (const n of [2, 3, 4, 5]) {
    for (let j = 1; j <= n; j++) {
      const options = resolveOptions(recipe, { masses: String(n), preset: String(j) });
      const it = buildRecipe(recipe, { seed: 5, count: 280000, options }, () => {});
      let b = it.next();
      while (!b.done) b = it.next();
      expect(b.value.kit.buf.count).toBeLessThanOrEqual(12050);
      const d = b.value.kit.data;
      const chain = new Chain(n, d.start);
      chain.q.forEach((q, mode) => expect(q).toBeCloseTo(mode === j - 1 ? 0.32 : 0, 11));
    }
  }
});

const tick = (page, seconds) =>
  page.evaluate((seconds) => {
    const { player } = window.__splashery;
    const n = Math.round(seconds * 60);
    for (let i = 0; i < n; i++) player.tickFixed(1 / 60);
    player.stage.requestRender();
  }, seconds);

test.use({ hasTouch: true });

test("normal-modes: phone touch release, dragging, sound, SI readout, and screenshots", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    // Thumbnail assets are outside this prototype's file whitelist. The shelf
    // retries its missing image, then uses a plain tile. Exclude only that
    // known 404; all runtime errors and every other resource failure count.
    const omittedThumbnail =
      /\/assets\/toys\/normal-modes\/thumb\.webp(?:\?|$)/.test(m.location().url) &&
      m.text().includes("404");
    if (!omittedThumbnail) errors.push(m.text());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']");
  await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    await app.chooseToy("normal-modes");
    player.opts.idleDelay = 1e9;
    player.idle.weight = 0;
    player.tickFixed = player.update.bind(player);
    player.update = () => {};
  });
  await expect(page.locator("#toy-status")).toHaveText(/^Coupled oscillators/);
  await tick(page, 0.2);
  await page.screenshot({ path: "tests/screenshots/proto-normal-modes-390x844.png" });
  expect(await page.evaluate(() => window.__splashery.app.sound.scheduled)).toBe(0);

  // A real touchscreen tap near the center, through the toy's tap handler.
  const center = await page.evaluate(() => {
    const { player, app } = window.__splashery;
    app.sound.setEnabled(true);
    const r = player.stage.canvas.getBoundingClientRect();
    const p = player.screenPoint([0.14, 0, 0.25]);
    return [r.left + p[0], r.top + p[1]];
  });
  await page.touchscreen.tap(...center);
  await expect
    .poll(() => page.evaluate(() => window.__splashery.player.motion.tap?.n || 0))
    .toBe(1);
  await tick(page, 0.55);
  const released = await page.evaluate(() => {
    const { player, app } = window.__splashery;
    const d = player.motion.ctx.kit.data;
    return {
      start: d.start,
      x: d.x,
      phase: d.phase,
      scheduled: app.sound.scheduled,
      count: player.motion.ctx.kit.buf.count,
    };
  });
  expect(released.phase).toBe("release");
  expect(Math.abs(released.x[0] - released.start[0])).toBeGreaterThan(0.1);
  expect(Math.abs(released.x[1])).toBeGreaterThan(0.025);
  expect(released.scheduled).toBeGreaterThan(0);
  expect(released.count).toBeLessThan(15000);
  await page.screenshot({ path: "tests/screenshots/proto-normal-modes-after-tap-390x844.png" });
  await tick(page, DURATION);
  expect(await page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.phase)).toBe(
    "ready",
  );

  // A real touch drag pulls the second mass along the track.
  const endpoints = await page.evaluate(() => {
    const { player } = window.__splashery;
    const r = player.stage.canvas.getBoundingClientRect();
    return [
      [0, 0, 0.29],
      [0.1, Math.sqrt(3) * 0.1, 0.29],
    ].map((p) => {
      const s = player.screenPoint(p);
      return { x: r.left + s[0], y: r.top + s[1] };
    });
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [endpoints[0]] });
  await page.waitForTimeout(200);
  for (let i = 1; i <= 8; i++) {
    const p = {
      x: endpoints[0].x + ((endpoints[1].x - endpoints[0].x) * i) / 8,
      y: endpoints[0].y + ((endpoints[1].y - endpoints[0].y) * i) / 8,
    };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [p] });
    await tick(page, 1 / 60);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  expect(
    await page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.start[1]),
  ).toBeGreaterThan(0.1);

  await page.evaluate(() => window.__splashery.app.setToyOptions({ masses: "2", preset: "1" }));
  await tick(page, 0.1);
  await page.click("#sheet-toggle");
  await page.click("#tab-play");
  const readout = page.locator("#normal-modes-readout");
  await expect(readout).toBeVisible();
  await expect(readout).toContainText("m = 1.0 kg · k = 16 N/m");
  await expect(readout).toContainText("1: 0.637 · 2: 1.103");
  await expect(readout).toContainText("4.000 · 6.928");
  expect((await readout.textContent()).split("\n")).toHaveLength(4);
  await page.click("#sheet-toggle");

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => window.__splashery.app.setToyOptions({ masses: "3", preset: "mix" }));
  await tick(page, 0.2);
  await page.waitForTimeout(300);
  await page.screenshot({ path: "tests/screenshots/proto-normal-modes-1440x900.png" });
  expect(errors).toEqual([]);
});

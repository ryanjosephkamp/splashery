import { test, expect } from "@playwright/test";
import { buildRecipe } from "../src/kit.js";
import { TOYS, onShelf } from "../src/toys.js";
import { RECIPES } from "../src/packs/proto-room-acoustics.js";
import { impulseSamples } from "../src/packs/proto-room-acoustics/audio.js";
import {
  roomMath,
  pressure,
  alongPath,
  newSimulation,
  advance,
  CLAP_AT,
  SOUND_SPEED,
  RAY_SLOW,
} from "../src/packs/proto-room-acoustics/math.js";

const ID = "room-acoustics";
const recipe = RECIPES[ID];
const defaults = Object.fromEntries(recipe.options.map((o) => [o.key, o.default]));

test("room-acoustics: Sabine hand calculation, modes, and material areas", () => {
  const room = roomMath(defaults);
  // Independent hand calculation: 240 m³; total surface area 268 m²;
  // painted concrete at 500 Hz has alpha 0.06, so A = 16.08 m².
  const expected = (0.161 * 240) / (268 * 0.06);
  expect(Math.abs(room.rt60 / expected - 1)).toBeLessThan(0.02);
  expect(room.rt60).toBeCloseTo(2.402985, 5);
  expect(room.modes.map((m) => m.orders)).toEqual([
    [1, 0, 0],
    [0, 1, 0],
    [1, 1, 0],
  ]);
  expect(room.modes[0].hz).toBeCloseTo(17.15, 6);
  expect(room.modes[1].hz).toBeCloseTo(21.4375, 6);
  const carpet = roomMath({ ...defaults, floor: "carpet" });
  expect(carpet.absorption).toBeCloseTo(16.08 + 80 * (0.14 - 0.06), 8);
  expect(carpet.rt60).toBeLessThan(room.rt60);
  expect(pressure(room.modes[0], room, [5, 1.5, 4])).toBeCloseTo(0, 8);
  // Height mode: probe planes must follow the actual height coordinate.
  expect(pressure({ orders: [0, 0, 1] }, room, [2, 1.5, 1])).toBeCloseTo(0, 8);
});

test("room-acoustics: image sources obey reflection geometry and real delays", () => {
  const room = roomMath(defaults);
  for (const [i, path] of room.paths.slice(1).entries()) {
    const [source, bounce, listener] = path.points;
    const axis = Math.floor(i / 2);
    const plane = i % 2 ? [10, 3, 8][axis] : 0;
    expect(bounce[axis]).toBeCloseTo(plane, 8);
    const d1 = Math.hypot(...bounce.map((v, j) => v - source[j]));
    const d2 = Math.hypot(...listener.map((v, j) => v - bounce[j]));
    expect(d1 + d2).toBeCloseTo(path.length, 8);
    const incoming = bounce.map((v, j) => (v - source[j]) / d1);
    const outgoing = listener.map((v, j) => (v - bounce[j]) / d2);
    for (let j = 0; j < 3; j++)
      expect(incoming[j]).toBeCloseTo((j === axis ? -1 : 1) * outgoing[j], 8);
    expect(path.delay).toBeCloseTo(path.length / 343, 10);
    alongPath(path, d1).forEach((v, j) => expect(v).toBeCloseTo(bounce[j], 8));
  }
});

test("room-acoustics: fixed steps agree across frame rates, and impulse decay matches RT60", () => {
  const room = roomMath(defaults);
  const a = newSimulation();
  const b = newSimulation();
  for (let i = 1; i <= 240; i++) advance(a, i / 120, room.rt60);
  for (let i = 1; i <= 60; i++) advance(b, i / 30, room.rt60);
  expect(a).toEqual(b);
  expect(a.distance).toBeCloseTo(((2 - CLAP_AT) * SOUND_SPEED) / RAY_SLOW, 8);
  const rate = 24000;
  const ir = impulseSamples(room, rate);
  expect(ir[0]).toBe(1);
  const meanSquare = (from, span) => {
    let energy = 0;
    for (let i = Math.round(from * rate); i < Math.round((from + span) * rate); i++)
      energy += ir[i] ** 2;
    return energy / Math.round(span * rate);
  };
  // Equal-duration windows one second apart must fall 60/RT60 dB.
  const drop = 10 * Math.log10(meanSquare(1.2, 0.12) / meanSquare(0.2, 0.12));
  expect(drop).toBeCloseTo(-60 / room.rt60, 0);
  const p = room.paths[1];
  const index = Math.round((p.delay - room.paths[0].delay) * rate);
  expect(ir[index]).toBeCloseTo((Math.sqrt(1 - 0.06) * room.paths[0].length) / p.length, 6);
});

test("room-acoustics: labs gate and splat budget, including the largest room and mode view", () => {
  expect(TOYS.find((t) => t.id === ID)).toMatchObject({ category: "studio", labs: true });
  expect(onShelf(TOYS.find((t) => t.id === ID))).toBe(false);
  for (const options of [
    defaults,
    { ...defaults, length: 12, width: 10, height: 5 },
    { ...defaults, view: "mode3" },
  ]) {
    const iterator = buildRecipe(recipe, { seed: 5, count: 160000, options }, () => {});
    let result = iterator.next();
    while (!result.done) result = iterator.next();
    expect(result.value.buf.count).toBeLessThan(15000);
    expect(result.value.kit.parts.length).toBeLessThanOrEqual(16);
  }
});

for (const [width, height] of [
  [390, 844],
  [1440, 900],
]) {
  test(`room-acoustics: loads, shows the known RT60, and a center tap moves at ${width}x${height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true });
    const page = await context.newPage();
    const problems = [];
    page.on("pageerror", (e) => problems.push(e.message));
    page.on("console", (m) => {
      // The task's allowlist excludes assets/toys/<id>/thumb.webp. The
      // existing shelf retries it, then uses a gray tile. Track every other
      // console error; page errors and all tap/audio errors remain strict.
      if (
        m.type() === "error" &&
        !m.location().url.includes("/assets/toys/room-acoustics/thumb.webp")
      )
        problems.push(m.text());
    });
    await page.goto("/?renderer=webgl2&labs=1&profile=weak&adapt=off");
    await page.waitForSelector("body[data-ready='true']");
    await page.evaluate(() => window.__splashery.app.chooseToy("room-acoustics"));
    await expect(page.locator("#toy-status")).toContainText("Room acoustics designer");
    expect(
      await page.evaluate(async () => {
        const { TOYS, onShelf } = await import("/src/toys.js");
        return onShelf(TOYS.find((t) => t.id === "room-acoustics"));
      }),
    ).toBe(true);
    await expect(page.locator("#toy-legend li").first()).toHaveText("RT60 2.40 s · 500 Hz");
    expect(await page.locator("#toy-legend li").count()).toBe(4);
    // No audio graph is made by this toy before its first tap.
    expect(await page.evaluate(() => window.__splashery.app.sound.scheduled)).toBe(0);
    await page.waitForTimeout(700);
    await page.screenshot({
      path: `tests/screenshots/proto-room-acoustics-${width}x${height}.png`,
    });
    // Inspect the actual Web Audio graph used by the touch gesture.
    await page.evaluate(() => {
      const sound = window.__splashery.app.sound;
      sound.setEnabled(true);
      const ctx = sound.audio();
      const create = ctx.createConvolver.bind(ctx);
      ctx.createConvolver = () => {
        const node = create();
        window.__roomConvolver = node;
        return node;
      };
    });
    const stage = await page.locator("canvas").first().boundingBox();
    await page.touchscreen.tap(stage.x + stage.width / 2, stage.y + stage.height * 0.54);
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.motion.tap?.key))
      .toBe("clap");
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.motion.out.parts.ray0.visible))
      .toBe(1);
    await page.waitForTimeout(250);
    const state = await page.evaluate(() => {
      const { player, app } = window.__splashery;
      return {
        parts: player.motion.out.parts,
        samples: window.__roomConvolver?.buffer?.length,
        duration: window.__roomConvolver?.buffer?.duration,
        normalize: window.__roomConvolver?.normalize,
        scheduled: app.sound.scheduled,
      };
    });
    expect(Math.hypot(...state.parts.ray0.offset)).toBeGreaterThan(0.15);
    expect(state.parts.ray1.offset).not.toEqual(state.parts.ray2.offset);
    expect(state.normalize).toBe(false);
    expect(state.duration).toBeCloseTo(2.402985 + 0.12, 3);
    expect(state.samples).toBeGreaterThan(24000);
    expect(state.scheduled).toBe(1);
    await page.screenshot({
      path: `tests/screenshots/proto-room-acoustics-${width}x${height}-tap.png`,
    });
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.motion.state.clap), {
        timeout: 20000,
      })
      .toBe(0);
    expect(
      await page.evaluate(() => window.__splashery.player.motion.out.parts.handLeft.offset),
    ).toEqual([0, 0, 0]);
    // Changing an actual option updates the numerical result and model.
    await page.evaluate(() => window.__splashery.app.setToyOption("floor", "carpet"));
    await expect(page.locator("#toy-legend li").first()).toHaveText("RT60 1.72 s · 500 Hz");
    await page.evaluate(() => window.__splashery.app.setToyOption("view", "mode3"));
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.motion.out.tokens?.length))
      .toBe(27);
    await page.waitForTimeout(350);
    await page.touchscreen.tap(stage.x + stage.width / 2, stage.y + stage.height * 0.54);
    await expect
      .poll(() =>
        page.evaluate(() =>
          Math.max(
            ...(window.__splashery.player.motion.out.tokens || []).map((p) =>
              Math.abs(p.offset[1]),
            ),
          ),
        ),
      )
      .toBeGreaterThan(0.03);
    // Repeated actions exercise replacement and audio cleanup after touch.
    await page.evaluate(() => {
      for (let i = 0; i < 3; i++) window.__splashery.app.act();
    });
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.__splashery.app.sound.scheduled)).toBe(5);
    expect(problems).toEqual([]);
    await context.close();
  });
}

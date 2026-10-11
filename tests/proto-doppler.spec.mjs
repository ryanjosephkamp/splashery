import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import { TOYS } from "../src/toys.js";
import { TOY_HELP } from "../src/toy-help.js";
import { buildRecipe } from "../src/kit.js";
import { RECIPES } from "../src/packs/proto-doppler.js";
import {
  AIR_SPEED,
  SOURCE_HZ,
  HALF_PATH,
  PASS_SECONDS,
  METERS_PER_UNIT,
  createSimulation,
  advanceSimulation,
  receivedFrequencies,
  dopplerFrequency,
  machAngle,
} from "../src/packs/proto-doppler/physics.js";

test("440 Hz approaching at 34.3 m/s is heard at 488.9 Hz", () => {
  expect(dopplerFrequency(34.3)).toBeCloseTo(488.8888889, 6);
  expect(Math.abs(receivedFrequencies(-HALF_PATH, 34.3)[0] - 488.9)).toBeLessThan(0.5);
  expect(dopplerFrequency(34.3, -1)).toBeCloseTo(400, 6);
  expect(dopplerFrequency(0)).toBe(SOURCE_HZ);
  expect(receivedFrequencies(0, 34.3)[0]).toBeCloseTo(440 / (1 - 0.1 ** 2), 6);
});

test("fixed steps preserve wave propagation, and Mach mode has causal branches", () => {
  const a = createSimulation();
  const b = createSimulation();
  advanceSimulation(a, 1.5);
  for (const t of [0.01, 0.04, 0.39, 0.8, 1.1, 1.5]) advanceSimulation(b, t);
  expect(b).toEqual(a);
  expect(a.y).toBeCloseTo(0, 8);
  expect(a.waves.length).toBeGreaterThan(1);
  for (const w of a.waves) {
    expect(w.y).toBeCloseTo(-HALF_PATH + a.speed * w.at, 8);
    const radius = AIR_SPEED * (a.elapsed * a.timeScale - w.at);
    expect(radius).toBeGreaterThanOrEqual(0);
    expect(radius / METERS_PER_UNIT).toBeLessThan(1.45);
  }
  advanceSimulation(a, PASS_SECONDS);
  expect(a.y).toBeCloseTo(HALF_PATH, 8);
  expect(machAngle(514.5)).toBeCloseTo(Math.asin(2 / 3), 8);
  expect(receivedFrequencies(-100, 514.5)).toEqual([]);
  const branches = receivedFrequencies(100, 514.5);
  expect(branches).toHaveLength(2);
  expect(branches.sort((x, y) => x - y)[0]).toBeCloseTo(176, 1);
  expect(branches[1]).toBeCloseTo(880, 1);
});

test("the Science prototype is labs only, with short help and a capped kit budget", () => {
  expect(TOYS.find((t) => t.id === "doppler")).toMatchObject({
    labs: true,
    category: "science",
    kind: "kit",
  });
  expect(TOY_HELP.doppler.howTo.length).toBeLessThanOrEqual(110);
  expect(TOY_HELP.doppler.about.split(/\s+/).length).toBeLessThanOrEqual(180);
  const it = buildRecipe(RECIPES.doppler, {
    seed: 5,
    count: 400000,
    options: { speed: 34.3, mach: false },
  });
  let r = it.next();
  while (!r.done) r = it.next();
  expect(r.value.buf.count).toBeLessThan(15000);
});

async function clearReadout(page) {
  const legend = page.locator("#toy-legend");
  await expect(legend.locator("li")).toHaveCount(4);
  const box = await legend.boundingBox();
  const lineHeight = await legend.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
  for (const item of await legend.locator("li").all())
    expect((await item.boundingBox()).height).toBeLessThanOrEqual(lineHeight + 2.1);
  await legend.evaluate((el) => {
    el.style.visibility = "hidden";
  });
  const png = PNG.sync.read(await page.screenshot({ clip: box }));
  await legend.evaluate((el) => {
    el.style.visibility = "";
  });
  // With the readout hidden, its rectangle contains only the white page.
  let ink = 0;
  for (let i = 0; i < png.data.length; i += 4)
    if (Math.min(png.data[i], png.data[i + 1], png.data[i + 2]) < 245) ink++;
  expect(ink, "The readout must stay clear of the model").toBe(0);
}

for (const [width, height] of [
  [390, 844],
  [1440, 900],
]) {
  test(`loads, hears the known frequency, and runs a center tap at ${width}x${height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      // The allowlist excludes the engine's mandatory shelf thumbnail asset.
      // Record that known 404 separately; every other console error fails.
      if (m.type() === "error" && !m.location().url.includes("/assets/toys/doppler/thumb.webp"))
        errors.push(m.text());
    });
    await page.goto("/?renderer=webgl2&labs=1&profile=low&adapt=off");
    await page.waitForSelector("body[data-ready='true']");
    await page.evaluate(() => window.__splashery.app.chooseToy("doppler"));
    await expect(page.locator("#toy-status")).toContainText("Doppler effect lab");
    await expect(page.locator("#toy-legend")).toContainText("Heard: 488.9 Hz");
    // No synthesis on load, even if the speaker was previously enabled.
    expect(await page.evaluate(() => !!window.__splashery.player.proc.ctx.kit.data.audio)).toBe(
      false,
    );
    await clearReadout(page);
    await page.screenshot({ path: `tests/screenshots/proto-doppler-${width}x${height}.png` });
    await page.locator("#sound-toggle").click();
    const before = await page.evaluate(
      () => window.__splashery.player.motion.out.parts.source.offset[1],
    );
    // An actual touch on the stage, not player.act() or a Play button.
    await page.touchscreen.tap(width < 760 ? width / 2 : (width - 340) / 2, height / 2);
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.motion.out.parts.source.offset[1]))
      .toBeGreaterThan(before + 0.1);
    await expect
      .poll(() => page.evaluate(() => !!window.__splashery.player.proc.ctx.kit.data.audio))
      .toBe(true);
    await clearReadout(page);
    await page.screenshot({ path: `tests/screenshots/proto-doppler-${width}x${height}-tap.png` });
    await expect
      .poll(
        () => page.evaluate(() => window.__splashery.player.motion.out.parts.source.offset[1]),
        { timeout: 15000 },
      )
      .toBeLessThan(0.01);
    await page.evaluate(() => window.__splashery.app.setToyOption("mach", true));
    await expect(page.locator("#toy-legend")).toContainText("No wave yet");
    await page.touchscreen.tap(width < 760 ? width / 2 : (width - 340) / 2, height / 2);
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.motion.out.parts.coneLeft.visible))
      .toBe(1);
    await expect(page.locator("#toy-legend")).toContainText("Cone:");
    await clearReadout(page);
    await page.screenshot({ path: `tests/screenshots/proto-doppler-${width}x${height}-mach.png` });
    expect(errors).toEqual([]);
    await context.close();
  });
}

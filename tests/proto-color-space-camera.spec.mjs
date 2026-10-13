import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import { buildRecipe } from "../src/kit.js";
import { MORPH_RANGE } from "../src/effects.js";
import { RECIPES } from "../src/packs/proto-color-space-camera.js";
import {
  SWATCHES,
  colorPoint,
  rgbToHsv,
  rgbToLab,
  springStep,
  STEP,
  OMEGA,
  testPattern,
} from "../src/packs/proto-color-space-camera/math.js";

const ID = "color-space-camera";
const recipe = RECIPES[ID];
const LAB = [
  [53.2371, 80.0901, 67.2033],
  [87.7355, -86.1816, 83.1866],
  [32.3009, 79.1953, -107.8555],
  [100, 0, 0],
  [0, 0, 0],
];
const RGB = [
  [0.8, -0.8, -0.8],
  [-0.8, 0.8, -0.8],
  [-0.8, -0.8, 0.8],
  [0.8, 0.8, 0.8],
  [-0.8, -0.8, -0.8],
];

function build(space) {
  const it = buildRecipe(recipe, { seed: 5, count: 6000, options: { space } }, () => {});
  let b = it.next();
  while (!b.done) b = it.next();
  return b.value.kit;
}

test("reference colors reach the RGB corners and D65 Lab values, including packed GPU targets", () => {
  SWATCHES.forEach((s, i) => {
    rgbToLab(s.rgb).forEach((q, j) => expect(q).toBeCloseTo(LAB[i][j], 3));
    colorPoint(s.rgb, "rgb").forEach((q, j) => expect(q).toBeCloseTo(RGB[i][j], 10));
  });
  expect(rgbToLab([0.5, 0.5, 0.5])[0]).toBeCloseTo(53.389, 3);
  expect(rgbToLab([0.02, 0.02, 0.02])[0]).toBeCloseTo(1.3983, 3);
  expect(rgbToHsv([1, 0, 0])).toEqual([0, 1, 1]);
  expect(rgbToHsv([0, 1, 0])).toEqual([120, 1, 1]);
  expect(rgbToHsv([0, 0, 1])).toEqual([240, 1, 1]);
  expect(colorPoint([0, 0, 0], "hsv")).toEqual([0, -0.8, 0]);
  expect(colorPoint([1, 1, 1], "hsv")).toEqual([0, 0.8, 0]);
  expect(
    Math.hypot(colorPoint([0.5, 0, 0], "hsv")[0], colorPoint([0.5, 0, 0], "hsv")[2]),
  ).toBeCloseTo(0.425, 10);
  for (const space of ["rgb", "hsv", "lab"]) {
    const k = build(space);
    expect(k.buf.count).toBeLessThan(15000);
    SWATCHES.forEach((s, i) => {
      const index = i * 8; // The five pure swatches occupy the first row.
      const z = k.buf.anim[index * 4 + 2];
      const w = k.buf.anim[index * 4 + 3];
      const encoded = [Math.floor(z / 4096), z % 4096, w % 4096];
      const target = colorPoint(s.rgb, space);
      encoded.forEach((q, axis) => {
        const position = k.buf.pos[index * 3 + axis] + ((q - 2048) * MORPH_RANGE) / 2048;
        const expected = (target[axis] - k.transform.center[axis]) * k.transform.scale;
        expect(position).toBeCloseTo(expected, 3);
      });
    });
  }
});

test("fixed steps match the critical-damping solution and settle without overshoot", () => {
  let x = 0;
  let v = 0;
  for (let i = 1; i <= 360; i++) {
    [x, v] = springStep(x, v, 1);
    const seconds = i * STEP;
    expect(x).toBeCloseTo(1 - (1 + OMEGA * seconds) * Math.exp(-OMEGA * seconds), 11);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThanOrEqual(1);
  }
  expect(1 - x).toBeLessThan(1e-6);
  const run = (fps) => {
    const k = build("rgb");
    const out = () => ({ parts: {} });
    recipe.drive(0, { palette: 0 }, out(), { time: 0, data: k.data });
    let last;
    for (let i = 1; i <= fps; i++) {
      last = out();
      recipe.drive(i / fps, { palette: 1 }, last, { time: i / fps, data: k.data, tap: { n: 1 } });
    }
    return last.morph[0];
  };
  expect(run(30)).toBeCloseTo(run(120), 10);
});

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  launchOptions: {
    executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
    args: [
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--ignore-gpu-blocklist",
      "--enable-webgl",
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});

async function load(page) {
  // The task excludes assets/toys/ from the permitted files. Supply a
  // generated thumbnail fixture independently of local assets; production
  // uses the shelf's fallback until the polish pass adds its thumbnail.
  const pattern = testPattern();
  const thumbnail = new PNG({ width: pattern.width, height: pattern.height });
  pattern.pixels.forEach((rgb, i) =>
    thumbnail.data.set([...rgb.map((v) => Math.round(v * 255)), 255], i * 4),
  );
  await page.route("**/assets/toys/color-space-camera/thumb.webp", (route) =>
    route.fulfill({ contentType: "image/png", body: PNG.sync.write(thumbnail) }),
  );
  await page.goto("/?renderer=webgl2&profile=weak&labs=1&adapt=off");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await page.evaluate(async (id) => {
    await window.__splashery.app.chooseToy(id);
    window.__splashery.app.setAutoplay({ turntable: false, effect: "none" });
  }, ID);
  await expect(page.locator("#toy-status")).toHaveText(/^Color space camera/);
}

const progress = (page) => page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.x);
const errors = (page) => {
  const list = [];
  page.on("pageerror", (e) => list.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") list.push(m.text());
  });
  return list;
};

async function clearReadout(page) {
  const readout = page.locator("#color-space-camera-readout");
  await expect(readout).toBeVisible();
  const box = await readout.boundingBox();
  expect(box.height).toBeLessThanOrEqual(84);
  await readout.evaluate((el) => {
    el.style.visibility = "hidden";
  });
  const shot = PNG.sync.read(await page.screenshot({ clip: box }));
  await readout.evaluate((el) => {
    el.style.visibility = "";
  });
  let ink = 0;
  for (let i = 0; i < shot.data.length; i += 4)
    if ([0, 1, 2].some((j) => shot.data[i + j] < 230)) ink++;
  expect(ink, "The readout must sit clear of the model").toBe(0);
}

test("labs toy loads, a center touch starts motion, all spaces work, and phone and desktop screenshots", async ({
  page,
}) => {
  const problems = errors(page);
  await load(page);
  await expect(page.locator(".toy-card[data-toy='color-space-camera']")).toHaveCount(1);
  await expect(page.locator("#color-space-camera-readout")).toContainText("Red: 255, 0, 0");
  await page.evaluate(() => {
    const { camera } = window.__splashery.player;
    camera.cur = { ...camera.home };
    camera.tgt = { ...camera.home };
  });
  await page.waitForTimeout(300);
  await clearReadout(page);
  await page.screenshot({ path: "tests/screenshots/proto-color-space-camera-first-390x844.png" });
  const box = await page.locator("#stage").boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(() => progress(page)).toBeGreaterThan(0.1);
  await expect.poll(() => progress(page)).toBeGreaterThan(0.99999);
  await clearReadout(page);
  await page.screenshot({ path: "tests/screenshots/proto-color-space-camera-390x844.png" });
  const beforeReturn = await page.evaluate(() => window.__splashery.player.motion.tap.n);
  await page.evaluate(() => window.__splashery.app.act());
  await expect.poll(() => progress(page)).toBeLessThan(0.00001);
  expect(await page.evaluate(() => window.__splashery.player.motion.tap.n)).toBe(beforeReturn + 1);
  await page.click("#sheet-toggle");
  for (const space of ["hsv", "lab"]) {
    await page.locator("#toy-options select").first().selectOption(space);
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.space))
      .toBe(space);
    await page.locator("#color-space-camera-probe").selectOption("0");
    await expect(page.locator("#color-space-camera-readout")).toContainText(
      space === "lab" ? "Red: L* 53.24, a* 80.09, and b* 67.20" : "Red: 0°, 1.00, 1.00",
    );
    if (space === "hsv") {
      await page.locator("#color-space-camera-probe").selectOption("3");
      await expect(page.locator("#color-space-camera-readout")).toContainText(
        "White: —, 0.00, 1.00",
      );
    }
    if ((await progress(page)) < 0.5) await page.evaluate(() => window.__splashery.app.act());
    await expect.poll(() => progress(page)).toBeGreaterThan(0.99999);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: "tests/screenshots/proto-color-space-camera-1440x900.png" });
  expect(problems).toEqual([]);
});

test("local photo samples stay out of saved scenes, and camera permission is requested only by Use camera", async ({
  page,
}) => {
  const problems = errors(page);
  await page.addInitScript(() => {
    window.cameraRequests = 0;
    const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = (...args) => {
      window.cameraRequests++;
      return real(...args);
    };
  });
  await load(page);
  expect(await page.evaluate(() => window.cameraRequests)).toBe(0);
  await page.click("#sheet-toggle");
  const png = new PNG({ width: 8, height: 8 });
  for (let i = 0; i < png.data.length; i += 4) png.data.set([255, 0, 0, 255], i);
  await page.setInputFiles("#toy-input-file", {
    name: "private-test.png",
    mimeType: "image/png",
    buffer: PNG.sync.write(png),
  });
  await expect
    .poll(() => page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.source.name))
    .toBe("Your photo");
  expect(
    await page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.source.pixels.length),
  ).toBe(64);
  const saved = await page.evaluate(() => JSON.stringify(window.__splashery.exportScene()));
  expect(saved).not.toMatch(/pixels|private-test|data:image/);
  await page.click("#live-camera");
  await expect.poll(() => page.evaluate(() => window.cameraRequests)).toBe(1);
  await expect
    .poll(() => page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.source.name))
    .toBe("Camera frame (not recorded)");
  await expect(page.getByRole("button", { name: "Refresh camera view" })).toBeVisible();
  await page.click("#live-stop");
  await expect(page.locator("#live-indicator")).toBeHidden();
  await page.evaluate(() => window.__splashery.app.chooseToy("dice"));
  await expect(page.locator("#color-space-camera-readout")).toHaveCount(0);
  expect(problems).toEqual([]);
});

test("a camera owned by another toy is not sampled", async ({ page }) => {
  const problems = errors(page);
  await load(page);
  await page.evaluate(async () => {
    const { start } = await import("/src/live/live.js");
    await start("camera", { owner: "another-toy" });
    await window.__splashery.app.setToyOptions({});
  });
  expect(await page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.source.name)).toBe(
    "Generated test pattern",
  );
  await expect(page.locator("#live-indicator")).toBeHidden();
  expect(problems).toEqual([]);
});

// Codex task 78c: the Overprint port, its live form switches, and push recovery.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { buildRecipe } from "../src/kit.js";
import { applyClay } from "../src/generators.js";
import { resolveOptions } from "../src/player.js";
import { createScene, normalizeScene } from "../src/state.js";
import { encodeSceneHash, decodeSceneHash } from "../src/codec.js";
import {
  RECIPES,
  FORMS,
  makeForm,
  gyroidField,
  kleinPoint,
  lorenzDerivative,
} from "../src/packs/shape-morph.js";

const recipe = RECIPES["shape-morph"];
const build = (count, options) => {
  const it = buildRecipe(recipe, { count, seed: 78, options }, applyClay);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
};
const APP = "/?labs=1&adapt=off";

test("all six forms are finite, deterministic, and fit at the phone and desktop budgets", async () => {
  for (const count of [7200, 24000])
    for (const { id } of FORMS) {
      const options = resolveOptions(recipe, { form: id });
      await recipe.prepare(options);
      const a = build(count, options);
      const b = build(count, options);
      expect(a.buf.count, `${id} count`).toBe(count);
      expect(
        Buffer.from(a.buf.pos.buffer).equals(Buffer.from(b.buf.pos.buffer)),
        `${id} deterministic`,
      ).toBe(true);
      expect(a.transform).toEqual({ center: [0, 0, 0], scale: 0.76 });
      let bad = 0,
        far = 0;
      for (let i = 0; i < count; i++) {
        const p = a.buf.pos.subarray(i * 3, i * 3 + 3);
        if (!p.every(Number.isFinite)) bad++;
        if (Math.hypot(...p) > 0.96) far++;
      }
      expect({ bad, far }, id).toEqual({ bad: 0, far: 0 });
    }
});

test("the surfaces use the reference math, and QR input is bounded", async () => {
  const root = Math.SQRT1_2;
  for (const [u, v, expected] of [
    [0, Math.PI / 2, [3, 0, 0]],
    [Math.PI, Math.PI / 2, [-2, 1, 0]],
    [Math.PI, Math.PI / 4, [-1, root, 0]],
    [Math.PI / 2, Math.PI / 2, [0, root, 2 + root]],
  ])
    kleinPoint(u, v).forEach((value, axis) => expect(value).toBeCloseTo(expected[axis], 8));
  const g = makeForm("gyroid", 7200);
  for (let i = 0; i < 7200; i += 29) {
    const raw = Array.from(g.pos.subarray(i * 3, i * 3 + 3)).map(
      (x, a) => x / g.transform.scale + g.transform.center[a],
    );
    expect(Math.abs(gyroidField(...raw))).toBeLessThan(0.00011);
  }
  const l = makeForm("lorenz", 7200);
  expect(l.ink.some((x) => x === 0)).toBe(true);
  expect(l.ink.some((x) => x === 1)).toBe(true);
  await expect(recipe.prepare({ form: "qr", qrText: "é".repeat(22) })).rejects.toThrow(/42 bytes/);
});

test("Lorenz derivatives use sigma 10, rho 28, and beta 8/3", () => {
  expect(lorenzDerivative([1, 2, 3])).toEqual([10, 23, -6]);
  expect(lorenzDerivative([-3, 4, 6])).toEqual([70, -70, -28]);
  // The origin and both nonzero equilibria are independent reference values.
  for (const x of [0, Math.sqrt(72), -Math.sqrt(72)]) {
    for (const value of lorenzDerivative([x, x, x === 0 ? 0 : 27]))
      expect(value).toBeCloseTo(0, 12);
  }
});

test("Shape morph options survive scene JSON and share links without changing v2/v3", async () => {
  const scene = createScene({ seed: 78 });
  scene.toy = {
    kind: "builtin",
    id: "shape-morph",
    options: {
      form: "klein",
      word: "HELLO",
      qrText: "A small cloud",
      twoInk: true,
    },
  };
  const normalized = normalizeScene(scene);
  expect(normalized.toy.options).toEqual(scene.toy.options);
  expect(normalizeScene(await decodeSceneHash(await encodeSceneHash(scene)))).toEqual(normalized);
  const old = { ...scene, version: 2, toy: { kind: "builtin", id: "blob" } };
  expect(normalizeScene(await decodeSceneHash(await encodeSceneHash(old))).toy.id).toBe("blob");
});

async function open(page, width, height, renderer = "webgl2") {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().startsWith("Failed to load resource"))
      errors.push(m.text());
  });
  await page.setViewportSize({ width, height });
  await page.goto(`${APP}&renderer=${renderer}&profile=${width < 700 ? "low" : "high"}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    await app.chooseToy("shape-morph");
    player.opts.idleDelay = 1e9;
    player.idle.weight = 0;
    player.camera.cur = { ...player.camera.home };
    player.camera.tgt = { ...player.camera.home };
    // Step the real runtime/render pass explicitly, as the clip tool does.
    const stage = player.stage;
    const handlers = stage.updateHandlers.slice();
    window.pfcStep = 0;
    stage.updateHandlers.length = 0;
    stage.updateHandlers.push(() => {
      const dt = window.pfcStep;
      window.pfcStep = 0;
      for (const h of handlers) h(dt);
    });
    window.pfcFrame = async (dt = 0) => {
      window.pfcStep = dt;
      await stage.captureFrame();
      return stage.captureFrame();
    };
    window.pfcSettle = async () => {
      for (let i = 0; i < 5; i++) await window.pfcFrame(0.6);
    };
  });
  return errors;
}

const screenshotPixels = (bytes) => {
  const p = PNG.sync.read(bytes);
  return { rgba: new Uint8ClampedArray(p.data), width: p.width, height: p.height };
};
const pixelsApart = (a, b) => {
  let diff = 0;
  for (let i = 0; i < a.rgba.length; i += 4)
    if (
      Math.abs(a.rgba[i] - b.rgba[i]) +
        Math.abs(a.rgba[i + 1] - b.rgba[i + 1]) +
        Math.abs(a.rgba[i + 2] - b.rgba[i + 2]) >
      30
    )
      diff++;
  return diff;
};

for (const [width, height] of [
  [390, 844],
  [1440, 900],
]) {
  test(`all forms fly, the QR encoder loads on demand, and the rendered QR scans at ${width}x${height}`, async ({
    page,
  }) => {
    const requests = [];
    page.on("request", (r) => requests.push(r.url()));
    const errors = await open(page, width, height);
    await expect(page).toHaveTitle(/Splashery/);
    await expect(page.locator("#toy-status")).toContainText("Shape morph");
    expect(await page.locator("body").getAttribute("data-ready")).toBe("true");
    expect(requests.some((u) => /qrcodegen|qr\/encode/.test(u))).toBe(false);
    await page.evaluate(() => window.__splashery.app.ui.setSheetStop("panel"));
    await page.locator("#toy-options select").selectOption("lorenz");
    await page.waitForFunction(() => window.__splashery.player.toyInfo.options.form === "lorenz");
    const flight = await page.evaluate(async () => {
      const { player } = window.__splashery;
      await window.pfcFrame(0);
      const before = player.motion.ctx.kit.data.remaining;
      await window.pfcFrame(0.8);
      const halfway = player.motion.ctx.kit.data.remaining;
      await window.pfcSettle();
      return {
        before,
        halfway,
        end: player.motion.ctx.kit.data.remaining,
        splats: player.toyInfo.splats,
      };
    });
    expect(flight.before).toBeGreaterThan(0.99);
    expect(flight.halfway).toBeGreaterThan(0.1);
    expect(flight.halfway).toBeLessThan(0.9);
    expect(flight.end).toBe(0);
    expect(flight.splats).toBe(width < 700 ? 7200 : 24000);
    await page.evaluate(() => window.__splashery.app.ui.collapseSheet());
    let previous = screenshotPixels(await page.locator("#stage").screenshot());
    for (const form of ["klein", "gyroid", "loop", "qr"]) {
      await page.evaluate((form) => window.__splashery.app.setToyOption("form", form), form);
      await page.evaluate(() => window.pfcSettle());
      const next = screenshotPixels(await page.locator("#stage").screenshot());
      expect(pixelsApart(previous, next), `${form} has a distinct visible form`).toBeGreaterThan(
        1500,
      );
      previous = next;
    }
    expect(requests.some((u) => u.includes("qrcodegen"))).toBe(true);
    // Frame the code itself, as a scanner does; the desktop controls and
    // toy thumbnails beside it contain unrelated high-contrast patterns.
    const read = async () => {
      const bounds = await page.evaluate(() => {
        const { player } = window.__splashery;
        const a = player.screenPoint([-0.6, 0.6, 0]);
        const b = player.screenPoint([0.6, -0.6, 0]);
        const box = player.canvas.getBoundingClientRect();
        return { x: box.x + a[0], y: box.y + a[1], width: b[0] - a[0], height: b[1] - a[1] };
      });
      const p = screenshotPixels(await page.screenshot({ clip: bounds }));
      return jsQR(p.rgba, p.width, p.height)?.data;
    };
    expect(await read()).toBe("Splashery");
    await page.evaluate(() => window.__splashery.app.setToyOption("qrText", "A small cloud"));
    await page.evaluate(() => window.pfcSettle());
    previous = screenshotPixels(await page.locator("#stage").screenshot());
    expect(await read()).toBe("A small cloud");
    await page.evaluate(() => window.__splashery.app.setToyOptions({ form: "word", twoInk: true }));
    await page.evaluate(() => window.pfcSettle());
    fs.mkdirSync("tests/screenshots", { recursive: true });
    await page.screenshot({ path: `tests/screenshots/cdx-pfc-shape-morph-${width}x${height}.png` });
    expect(errors).toEqual([]);
  });
}

test("a real pointer drag pushes splats, then returns them; interrupted flights continue from their current positions", async ({
  page,
}) => {
  const errors = await open(page, 390, 844);
  const before = screenshotPixels(await page.locator("#stage").screenshot());
  const point = await page.evaluate(() => {
    const { player } = window.__splashery;
    const p = player.motion.ctx.kit.data.form.pos.subarray(0, 3);
    const w = player.fromRecipe(Array.from(p));
    const screen = player.stage.toScreen(w);
    return screen;
  });
  const box = await page.locator("#stage").boundingBox();
  await page.mouse.move(box.x + point[0], box.y + point[1]);
  await page.mouse.down();
  await page.waitForTimeout(200);
  await page.mouse.move(box.x + point[0] + 65, box.y + point[1] - 35, { steps: 8 });
  await page.evaluate(() => window.pfcFrame(0.1));
  const pushed = screenshotPixels(await page.locator("#stage").screenshot());
  expect(pixelsApart(before, pushed)).toBeGreaterThan(150);
  expect(await page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.push.held)).toBe(
    true,
  );
  await page.mouse.up();
  await page.evaluate(() => document.activeElement?.blur());
  await page.evaluate(() => window.pfcSettle());
  const settled = screenshotPixels(await page.locator("#stage").screenshot());
  expect(pixelsApart(before, settled)).toBeLessThan(20);
  const continuity = await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    const { posePoint } = await import("/src/packs/shape-morph.js");
    await app.setToyOption("form", "klein");
    await window.pfcFrame(0.5);
    const data = player.motion.ctx.kit.data;
    const current = posePoint(data, 100);
    await app.setToyOption("form", "gyroid");
    const from = Array.from(player.motion.ctx.kit.data.from.subarray(300, 303));
    await window.pfcSettle();
    return { current, from, remaining: player.motion.ctx.kit.data.remaining };
  });
  for (let i = 0; i < 3; i++) expect(continuity.from[i]).toBeCloseTo(continuity.current[i], 5);
  expect(continuity.remaining).toBe(0);
  expect(errors).toEqual([]);
});

test("reduced motion and motion-off selections immediately show the chosen form", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = await open(page, 390, 844);
  await page.evaluate(() => window.__splashery.app.setToyOption("form", "klein"));
  expect(await page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.from)).toBeNull();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() => {
    window.__splashery.player.scene.motion.alive = false;
  });
  await page.evaluate(() => window.__splashery.app.setToyOption("form", "gyroid"));
  expect(await page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.from)).toBeNull();
  expect(errors).toEqual([]);
});

test("the toy is hidden without labs", async ({ page }) => {
  await page.goto("/?renderer=webgl2&profile=low&labs=0");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await expect(page.locator('[data-toy="shape-morph"]')).toBeHidden();
  expect(
    await page.evaluate(async () => {
      const { onShelf, findToy } = await import("/src/toys.js");
      return onShelf(findToy("shape-morph"));
    }),
  ).toBe(false);
});

test("the WebGPU work-buffer program renders and scatters when an adapter is available", async ({
  page,
}) => {
  const errors = await open(page, 390, 844, "webgpu");
  const renderer = await page.evaluate(() => window.__splashery.renderer);
  test.skip(
    renderer !== "webgpu",
    "No WebGPU adapter; the WebGL2 interaction tests cover the toy.",
  );
  const before = screenshotPixels(await page.locator("#stage").screenshot());
  await page.evaluate(async () => {
    window.__splashery.player.act();
    await window.pfcFrame(0.7);
  });
  const during = screenshotPixels(await page.locator("#stage").screenshot());
  expect(pixelsApart(before, during)).toBeGreaterThan(300);
  await page.evaluate(() => window.pfcSettle());
  expect(errors).toEqual([]);
});

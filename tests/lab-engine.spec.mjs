// Lane Lab's engine addition (docs/handoff/Lab.md, docs/lab/KERNELS.md):
// splat kernels other than the Gaussian (src/kernels.js), off by default.
// A toy shows one only with labs on, from ?kernel= or its recipe's `kernel`.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

async function open(page, query, toy = "hockey-puck") {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${APP}${query}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate((id) => window.__splashery.app.chooseToy(id), toy);
  return errors;
}

// The toy's pixels, drawn from the home view.
async function pixels(page) {
  return page.evaluate(async () => {
    const { player } = window.__splashery;
    const cam = player.camera;
    player.camera.setTurntable(false);
    cam.cur = { ...cam.home };
    cam.tgt = { ...cam.home };
    for (let i = 0; i < 6; i++) await player.stage.captureFrame();
    const c = await player.stage.captureFrame();
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    return Array.from(d.filter((_, i) => i % 16 === 0));
  });
}

const diff = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;

test("kernel picking: labs only, ?kernel= first, then the recipe, else the Gaussian", async ({
  page,
}) => {
  await page.goto(APP);
  const r = await page.evaluate(async () => {
    const { pickKernel, kernelChunks, KERNELS } = await import("/src/kernels.js");
    const chunks = KERNELS.map((k) => kernelChunks(k));
    return {
      kernels: KERNELS,
      off: pickKernel({ labs: false, param: "sharp", recipe: "sharp" }),
      param: pickKernel({ labs: true, param: "gaussian", recipe: "sharp" }),
      recipe: pickKernel({ labs: true, param: null, recipe: "sharp" }),
      unknown: pickKernel({ labs: true, param: "blur", recipe: "wobbly" }),
      none: pickKernel({ labs: true, param: null, recipe: undefined }),
      hooks: chunks.every(
        (c) => /modifySplatColor/.test(c.glsl) && /modifySplatColor/.test(c.wgsl),
      ),
    };
  });
  expect(r).toEqual({
    kernels: ["gaussian", "sharp"],
    off: "gaussian",
    param: "gaussian",
    recipe: "sharp",
    unknown: "gaussian",
    none: "gaussian",
    hooks: true,
  });
});

test("by default no toy's kernel changes: the engine's hook is left alone", async ({ page }) => {
  const errors = await open(page, "&labs=1");
  const r = await page.evaluate(() => {
    const { player } = window.__splashery;
    const mat = player.stage.app.scene.gsplat.material;
    return {
      kernel: player.stage.kernel ?? null,
      chunk: mat.hasShaderChunks ? (mat.shaderChunks.glsl.get("gsplatModifyPS") ?? null) : null,
    };
  });
  expect(r).toEqual({ kernel: null, chunk: null });
  expect(errors).toEqual([]);
});

test("?kernel= does nothing without labs", async ({ page }) => {
  const errors = await open(page, "&labs=0&kernel=sharp");
  expect(await page.evaluate(() => window.__splashery.player.stage.kernel ?? null)).toBe(null);
  expect(errors).toEqual([]);
});

test("with labs, ?kernel=sharp draws a different, finite picture, and back again", async ({
  page,
}) => {
  // The splat equation toy (labs) has big splats, where the kernel shows.
  const errors = await open(page, "&labs=1&kernel=gaussian", "splat-equation");
  const plain = await pixels(page);
  const shots = {};
  for (const k of ["sharp", "gaussian"]) {
    await page.evaluate(async (k) => {
      const url = new URL(location.href);
      url.searchParams.set("kernel", k);
      history.replaceState(null, "", url);
      await window.__splashery.app.chooseToy("splat-equation");
    }, k);
    expect(await page.evaluate(() => window.__splashery.player.stage.kernel)).toBe(k);
    shots[k] = await pixels(page);
  }
  // The sharp kernel changes the picture, but only a little (same coverage).
  const d = diff(plain, shots.sharp);
  expect(d).toBeGreaterThan(0.2);
  expect(d).toBeLessThan(20);
  // Back to the Gaussian: the engine's own empty hook, the same picture.
  expect(diff(plain, shots.gaussian)).toBeLessThan(0.5);
  const chunk = await page.evaluate(() =>
    window.__splashery.player.stage.app.scene.gsplat.material.shaderChunks.glsl.get(
      "gsplatModifyPS",
    ),
  );
  expect(chunk.replace(/\s+/g, " ").trim()).toBe(
    "void modifySplatColor(vec2 gaussianUV, inout vec4 color) { }",
  );
  expect(errors).toEqual([]);
});

test("the sharp kernel compiles and draws on WebGPU too", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?renderer=webgpu&adapt=off&profile=mid&labs=1&kernel=sharp");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  const dev = await page.evaluate(() => window.__splashery.player.stage?.deviceType);
  test.skip(dev !== "webgpu", "No WebGPU adapter in this browser.");
  await page.evaluate(() => window.__splashery.app.chooseToy("hockey-puck"));
  expect(await page.evaluate(() => window.__splashery.player.stage.kernel)).toBe("sharp");
  const px = await pixels(page);
  // Something other than the white background was drawn.
  expect(px.some((v, i) => i % 4 !== 3 && v < 200)).toBe(true);
  expect(errors).toEqual([]);
});

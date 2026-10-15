import { test, expect } from "@playwright/test";

test("an opaque preview can hold covered draws while updates and explicit captures still work", async ({
  page,
}) => {
  await page.goto("/?renderer=webgl2&profile=low&adapt=off&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  const result = await page.evaluate(async () => {
    const pl = window.__splashery.player,
      s = pl.stage;
    pl.setPaused(true);
    s.setFixedSize([128, 128]);
    await s.captureFrame();
    let updates = 0,
      renders = 0;
    const rendered = () => renders++;
    s.app.on("postrender", rendered);
    s.onUpdate(() => {
      updates++;
      s.requestRender(0);
    });
    const frames = async () => {
      for (let i = 0; i < 6; i++) await new Promise(requestAnimationFrame);
    };
    const a = s.holdRendering(),
      b = s.holdRendering();
    await frames();
    const held = { updates, renders };
    const captured = await s.captureFrame();
    const captureRenders = renders;
    a();
    a();
    await frames();
    const nestedRenders = renders;
    b();
    await frames();
    s.app.off("postrender", rendered);
    return {
      held,
      capture: [captured.width, captured.height],
      captureRenders,
      nestedRenders,
      resumedRenders: renders,
    };
  });
  expect(result.held.updates).toBeGreaterThanOrEqual(3);
  expect(result.held.renders).toBe(0);
  expect(result.capture).toEqual([128, 128]);
  expect(result.captureRenders).toBeGreaterThan(0);
  expect(result.nestedRenders).toBe(result.captureRenders);
  expect(result.resumedRenders).toBeGreaterThan(result.nestedRenders);
});

test("the photo preview releases its covered frame on handoff and when another toy opens", async ({
  page,
}) => {
  await page.goto("/?renderer=webgl2&profile=low&adapt=off&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await page.evaluate(async () => {
    const { app, player: pl } = window.__splashery;
    await app.chooseToy("photo-3d");
    for (let i = 0; i < 3; i++) await pl.stage.captureFrame();
    pl.setPaused(true);
    const { photoPreview } = await import("/src/photo3d/preview.js");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 16;
    const g = canvas.getContext("2d");
    g.fillStyle = "#d4b88c";
    g.fillRect(0, 0, 16, 16);
    const preview = await new Promise((resolve) => canvas.toBlob(resolve));
    const photo = { w: 16, h: 16, data: g.getImageData(0, 0, 16, 16).data, preview };
    window.__previewUpdates = 0;
    window.__previewHandoff = [];
    window.__previewAllowed = false;
    window.__previewCanceled = 0;
    pl.stage.onUpdate(() => {
      window.__previewUpdates++;
      pl.stage.requestRender(0);
    });
    pl.stage.app.on("postrender", () =>
      window.__previewHandoff.push(!!document.querySelector("[aria-label='Photo preview']")),
    );
    window.__startPreview = () =>
      photoPreview(
        photo,
        () => window.__previewCanceled++,
        () => window.__previewAllowed,
      );
    window.__closePreview = window.__startPreview();
  });
  await expect(page.locator("[aria-label='Photo preview']")).toBeVisible();
  await page.evaluate(() => {
    window.__previewHandoff.length = 0;
    window.__previewUpdates = 0;
  });
  await page.waitForFunction(() => window.__previewUpdates >= 6);
  expect(await page.evaluate(() => window.__previewHandoff.length)).toBe(0);
  await page.evaluate(() => window.__closePreview());
  await expect(page.locator("[aria-label='Photo preview']")).toBeVisible();
  await page.evaluate(() => {
    window.__previewAllowed = true;
  });
  await expect(page.locator("[aria-label='Photo preview']")).toHaveCount(0);
  expect(await page.evaluate(() => window.__previewHandoff.includes(true))).toBe(true);
  await page.evaluate(() => {
    window.__previewAllowed = false;
    window.__closePreview = window.__startPreview();
  });
  await expect(page.locator("[aria-label='Photo preview']")).toBeVisible();
  await page.evaluate(() => window.__splashery.app.chooseToy("donut"));
  await expect(page.locator("[aria-label='Photo preview']")).toHaveCount(0);
  expect(await page.evaluate(() => window.__previewCanceled)).toBe(1);
  await page.evaluate(() => {
    window.__previewHandoff.length = 0;
    window.__previewUpdates = 0;
  });
  await page.waitForFunction(() => window.__previewUpdates >= 6);
  expect(await page.evaluate(() => window.__previewHandoff.length)).toBeGreaterThan(0);
});

test("covered updates retain retired GPU resources until actual draws reconcile the work buffer", async ({
  page,
}) => {
  const errors = [];
  page.on("console", (m) => {
    if (/GL_INVALID|sampler type/.test(m.text())) errors.push(m.text());
  });
  await page.goto("/?renderer=webgl2&profile=low&adapt=off&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  const result = await page.evaluate(async () => {
    const s = window.__splashery.player.stage;
    window.__splashery.player.setPaused(true);
    s.setFixedSize([128, 128]);
    await s.captureFrame();
    const old = s.toy,
      release = s.holdRendering();
    let freed = 0;
    const destroy = old.entity.destroy;
    old.entity.destroy = function (...args) {
      freed++;
      return destroy.apply(this, args);
    };
    s.clearToy();
    for (let i = 0; i < 8; i++) await new Promise(requestAnimationFrame);
    const held = freed;
    for (let i = 0; i < 3; i++) await s.captureFrame();
    const reconciled = freed;
    release();
    return { held, reconciled };
  });
  expect(result).toEqual({ held: 0, reconciled: 1 });
  expect(errors).toEqual([]);
});

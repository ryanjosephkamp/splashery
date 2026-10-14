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

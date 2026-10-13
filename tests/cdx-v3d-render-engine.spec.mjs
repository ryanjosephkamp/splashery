import { test, expect } from "@playwright/test";
import { pickSharpness } from "../src/sharpness.js";

test("a recipe can keep native resolution throughout camera movement", () => {
  const value = pickSharpness({
    labs: true,
    native: 3,
    recipe: { adapt: "off", dpr: "native", cull: "off" },
    params: new URLSearchParams(),
  });
  expect(value.adapt).toBe("off");
  expect(value.dpr).toBe(3);
  expect(value.cull.minPixelSize).toBe(0);
  expect(pickSharpness({ labs: false, recipe: { adapt: "off" } }).adapt).toBe("drag");
});

test("full-resolution mode restores a reduced canvas and resists slow-frame reduction", async ({
  page,
}) => {
  await page.goto("/?renderer=webgl2&profile=low&adapt=off");
  await page.waitForSelector("body[data-ready='true']");
  const result = await page.evaluate(async () => {
    const { stage } = window.__splashery.player;
    stage.adaptive = true;
    stage.reduced = true;
    stage.setSharpness({ adapt: "off", dpr: 3, cull: null, aa: false });
    stage.busy = true;
    stage.skipFrames = 0;
    for (let i = 0; i < 60; i++) stage.timeFrame(50);
    return {
      reduced: stage.reduced,
      ratio: stage.device.maxPixelRatio,
      wanted: Math.min(window.devicePixelRatio, 3),
    };
  });
  expect(result.reduced).toBe(false);
  expect(result.ratio).toBe(result.wanted);
});

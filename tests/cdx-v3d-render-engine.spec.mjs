import { test, expect } from "@playwright/test";
import { pickSharpness, SHARP_DEFAULT } from "../src/sharpness.js";

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
  expect(pickSharpness({ labs: true, params: new URLSearchParams() })).toEqual(SHARP_DEFAULT);
  expect(pickSharpness({ labs: true, recipe: { adapt: "drag" } })).toEqual(SHARP_DEFAULT);
  expect(pickSharpness({ labs: true, params: new URLSearchParams("adapt=off") })).toBeNull();
  expect(
    pickSharpness({
      labs: true,
      params: new URLSearchParams("adapt=off"),
      recipe: { adapt: "off", dpr: 3 },
    }).adapt,
  ).toBeNull();
});

for (const profile of ["low", "weak"]) {
  test(`full-resolution recipes respect the ${profile} profile's current pixel cap`, async ({
    browser,
  }) => {
    const page = await browser.newPage({ deviceScaleFactor: 3 });
    try {
      await page.goto(`/?renderer=webgl2&profile=${profile}&labs=1`);
      await page.waitForSelector("body[data-ready='true']");
      const result = await page.evaluate(() => {
        const { player } = window.__splashery;
        const { stage } = player;
        stage.setSharpness({ adapt: "off", dpr: 3, cull: null, aa: false });
        const native = stage.device.maxPixelRatio;
        stage.setPixelRatio(1.25);
        const lowered = stage.device.maxPixelRatio;
        stage.setSharpness({ adapt: "off", dpr: 1, cull: null, aa: false });
        return {
          profile: player.profile,
          native,
          lowered,
          requestedLower: stage.device.maxPixelRatio,
        };
      });
      expect(result).toEqual({ profile: "low", native: 1.5, lowered: 1.25, requestedLower: 1 });
    } finally {
      await page.close();
    }
  });
}

for (const recipe of [null, { adapt: "drag" }]) {
  test(`${recipe ? "explicit drag" : "default"} adaptation keeps the drag drop and slow-frame tier step-down`, async ({
    browser,
  }) => {
    const page = await browser.newPage({ deviceScaleFactor: 3 });
    try {
      await page.goto("/?renderer=webgl2&profile=high&labs=1");
      await page.waitForSelector("body[data-ready='true']");
      const result = await page.evaluate(async (recipe) => {
        const { pickSharpness } = await import("/src/sharpness.js");
        const { player } = window.__splashery;
        const { stage } = player;
        stage.setSharpness(pickSharpness({ labs: true, recipe, params: new URLSearchParams() }));
        stage.adaptive = true;
        stage.reduced = false;
        stage.settle();
        stage.skipFrames = 0;
        player.autoTier = true;
        let stepDowns = 0;
        stage.onSlow = () => {
          stepDowns++;
          player.stepDown();
        };
        stage.setBusy(true, false);
        for (let i = 0; i < 60; i++) stage.timeFrame(50);
        const playing = { reduced: stage.reduced, ratio: stage.device.maxPixelRatio, stepDowns };
        stage.setBusy(true, true);
        stage.timeFrame(50);
        const dragging = { reduced: stage.reduced, ratio: stage.device.maxPixelRatio, stepDowns };
        for (let i = 0; i < 34; i++) stage.timeFrame(50);
        return {
          sharp: stage.sharp,
          playing,
          dragging,
          slow: { profile: player.profile, stepDowns, reduced: stage.reduced },
        };
      }, recipe);
      expect(result).toEqual({
        sharp: SHARP_DEFAULT,
        playing: { reduced: false, ratio: 3, stepDowns: 0 },
        dragging: { reduced: true, ratio: 2, stepDowns: 0 },
        slow: { profile: "mid", stepDowns: 1, reduced: true },
      });
    } finally {
      await page.close();
    }
  });
}

test("full-resolution mode restores a reduced canvas and resists slow-frame reduction", async ({
  browser,
}) => {
  const page = await browser.newPage({ deviceScaleFactor: 3 });
  await page.goto("/?renderer=webgl2&profile=high&labs=1");
  await page.waitForSelector("body[data-ready='true']");
  const result = await page.evaluate(async () => {
    const { stage } = window.__splashery.player;
    stage.adaptive = true;
    stage.reduced = true;
    stage.setSharpness({ adapt: "off", dpr: 3, cull: null, aa: false });
    let stepDowns = 0;
    stage.onSlow = () => stepDowns++;
    stage.setBusy(true, true);
    const busyOnDrag = stage.busy;
    stage.busy = true;
    stage.skipFrames = 0;
    for (let i = 0; i < 60; i++) stage.timeFrame(50);
    return {
      reduced: stage.reduced,
      busyOnDrag,
      stepDowns,
      ratio: stage.device.maxPixelRatio,
      wanted: Math.min(window.devicePixelRatio, 3),
    };
  });
  expect(result.reduced).toBe(false);
  expect(result.busyOnDrag).toBe(false);
  expect(result.stepDowns).toBe(0);
  expect(result.ratio).toBe(result.wanted);
  expect(result.ratio).toBe(3);
  await page.close();
});

// Lane Sharpness B's engine change: a recipe's drag may set one of the toy's
// sliders ({ control, value }), as a knob dragged along the toy's own slider,
// and the panel's slider follows.

import { test, expect } from "@playwright/test";

test("a drag that sets a slider moves the control and the panel's slider", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto("/?renderer=webgl2&profile=weak&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("lorenz"));
  await page.waitForFunction(() => window.__splashery.player.toyInfo?.id === "lorenz", null, { timeout: 120_000 }); // prettier-ignore
  const r = await page.evaluate(() => {
    const { player } = window.__splashery;
    let heard = 0;
    player.on("controls", () => heard++);
    player.fireDrag({ control: "glow", value: 0.2 });
    // Out of range is held to 0..1; a pulse or an unknown key is not a slider.
    player.fireDrag([{ control: "glow", value: 1.7 }, { control: "race", value: 0.5 }, { control: "nope", value: 0.5 }]); // prettier-ignore
    const after = player.motion.targets.glow;
    player.fireDrag({ control: "glow", value: 0.2 });
    return { after, glow: player.motion.targets.glow, race: player.motion.targets.race ?? 0, heard, saved: player.scene.motion.controls.glow, fired: player.dragFired }; // prettier-ignore
  });
  expect(r.after).toBe(1);
  expect(r.glow).toBeCloseTo(0.2);
  expect(r.race).toBe(0);
  expect(r.heard).toBe(3);
  expect(r.saved).toBeCloseTo(0.2);
  expect(r.fired).toBe(true);
  await expect(page.locator("#ctl-glow")).toHaveValue("20");
});

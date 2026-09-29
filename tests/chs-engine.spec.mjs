// Lane Chemistry's engine addition (docs/handoff/Chemistry.md): a recipe's
// action.at(point, c) may return { options, key, pick }. The tap then
// rebuilds the toy with those options (starting at rest) and fires `key` on
// the new toy (the periodic table's tiles pick the element). Other taps are
// unchanged.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=low";

test("a tap that returns options rebuilds the toy with them, then fires its key", async ({
  page,
}) => {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("atom"));
  await page.waitForFunction(() => window.__splashery.player.toyInfo?.id === "atom", null, { timeout: 120_000 }); // prettier-ignore
  const r = await page.evaluate(async () => {
    const { player } = window.__splashery;
    const recipe = player.toyInfo.recipe;
    const action = recipe.action;
    const sounds = [];
    player.on("action", (x) => sounds.push(x.echo ? "echo" : x.key));
    recipe.action = { ...action, at: () => ({ options: { element: "Na" }, key: "energy" }) };
    try {
      // Mid-effect state before the tap must not carry over.
      player.setControl("speed", 0.8);
      // The old toy's control does not fire: only the new toy's does.
      let before = null;
      const rebuild = player.rebuild;
      player.rebuild = (o) => ((before = player.motion.state.energy), rebuild(o));
      const first = player.act([0, 0, 0]);
      player.rebuild = rebuild;
      const t0 = performance.now();
      while (player.toyInfo.options?.element !== "Na" && performance.now() - t0 < 60_000)
        await new Promise((ok) => setTimeout(ok, 50));
      await new Promise((ok) => setTimeout(ok, 200));
      return {
        options: first.options,
        before,
        element: player.scene.toy.options.element,
        built: player.toyInfo.options.element,
        energy: player.motion.state.energy,
        speed: player.scene.motion.controls.speed,
        sounds,
      };
    } finally {
      recipe.action = action;
    }
  });
  expect(r.options).toEqual({ element: "Na" });
  expect(r.before).toBe(0);
  expect(r.element).toBe("Na");
  expect(r.built).toBe("Na");
  expect(r.energy).toBeGreaterThan(0.5);
  expect(r.speed).toBe(0.8);
  expect(r.sounds).toEqual(["energy", "echo"]);
});

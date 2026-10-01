// Lane Fix6 (engine): the loading overlay on rebuilds. A toy's own tap that switches its options
// (a periodic table tile) rebuilds it with no overlay: the toy stays on screen. An option changed
// in the Toy tab shows the overlay only after half a second. Choosing a toy shows it as before.

import { test, expect } from "@playwright/test";

// Runs `run` in the page and reports whether #progress was shown meanwhile, and when.
async function watchOverlay(page, run) {
  return page.evaluate(async (run) => {
    const { app, player } = window.__splashery;
    const el = document.getElementById("progress");
    let shownAt = null;
    const t0 = performance.now();
    const mo = new MutationObserver(() => {
      if (!el.hidden && shownAt === null) shownAt = performance.now() - t0;
    });
    mo.observe(el, { attributes: true, attributeFilter: ["hidden"] });
    if (run.toy) await app.chooseToy(run.toy);
    else if (run.tap) await player.rebuild(run.tap);
    else await app.setToyOption(run.option[0], run.option[1]);
    const ms = performance.now() - t0;
    mo.disconnect();
    return { shownAt, ms, hidden: el.hidden, element: player.scene.toy.options?.element };
  }, run);
}

test("choosing a toy shows the loading overlay; a tile tap's rebuild never does", async ({
  page,
}) => {
  await page.goto("/?renderer=webgl2&profile=weak");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  const first = await watchOverlay(page, { toy: "periodic-table" });
  expect(first.shownAt).not.toBeNull();
  await page.waitForTimeout(500);
  // The rebuild a tile tap starts (Player.switchTo calls player.rebuild): however long it
  // takes here (over a second in this test browser), no overlay.
  for (const el of ["O", "Fe", "Au"]) {
    const r = await watchOverlay(page, { tap: { element: el } });
    expect(r.shownAt).toBeNull();
    expect(r.element).toBe(el);
  }
});

test("an option changed in the Toy tab shows the overlay only after half a second", async ({
  page,
}) => {
  await page.goto("/?renderer=webgl2&profile=weak");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("periodic-table"));
  await page.waitForTimeout(500);
  // A rebuild that takes well over a second: the overlay comes, but not before 0.5 s.
  await page.evaluate(() => {
    const { player } = window.__splashery;
    const real = player.loadToy.bind(player);
    player.loadToy = async (toy, opts) => {
      await new Promise((res) => setTimeout(res, 900));
      return real(toy, opts);
    };
  });
  const r = await watchOverlay(page, { option: ["element", "N"] });
  expect(r.shownAt).toBeGreaterThanOrEqual(480);
  expect(r.hidden).toBe(true);
  expect(r.element).toBe("N");
});

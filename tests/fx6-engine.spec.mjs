// Lane Fix6 (engine): the loading overlay on rebuilds. A toy's own tap that switches its options
// (a periodic table tile) rebuilds it with no overlay: the toy stays on screen. An option changed
// in the Toy tab shows the overlay only after half a second. Choosing a toy shows it as before.
// And a toy can move on by itself (the table's tour): drive names new options in out.next.

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

test("a toy's drive can ask for new options (out.next): rebuilt quietly, then its key fires", async ({
  page,
}) => {
  await page.goto("/?renderer=webgl2&profile=weak");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  // A test toy, for this page only: a ball that steps its "n" option up to 3, one each second.
  const r = await page.evaluate(async () => {
    const { TOYS } = await import("/src/toys.js");
    const { RECIPES } = await import("/src/packs/balls.js");
    const { app, player } = window.__splashery;
    TOYS.push({ id: "fx6e-next", label: "fx6e", category: "sports", kind: "kit", pack: "balls", tags: "" }); // prettier-ignore
    RECIPES["fx6e-next"] = {
      options: [{ key: "n", label: "N", type: "range", min: 0, max: 9, step: 1, default: 0 }],
      controls: [{ key: "go", label: "Go", type: "toggle", default: 0, ease: 0.5 }],
      action: { key: "go", label: "Go" },
      build(k, o) {
        k.data = { n: o.n, born: null };
        k.add(k.sphere(1), { even: true, color: "#ffffff" });
      },
      drive(t, c, out, info) {
        const d = info.data;
        d.born ??= t;
        if (d.n < 3 && t - d.born > 1) out.next = { options: { n: d.n + 1 }, key: "go" };
      },
    };
    const sounds = [];
    const play = app.sound.play.bind(app.sound);
    app.sound.play = (spec, o) => (sounds.push(o?.key), play(spec, o));
    const el = document.getElementById("progress");
    await app.chooseToy("fx6e-next");
    let overlay = false;
    const mo = new MutationObserver(() => (overlay ||= !el.hidden));
    mo.observe(el, { attributes: true, attributeFilter: ["hidden"] });
    sounds.length = 0;
    const seen = [];
    const t0 = performance.now();
    while (performance.now() - t0 < 60_000) {
      const n = player.scene.toy.options?.n ?? 0;
      if (seen.at(-1) !== n) seen.push(n);
      if (n === 3 && player.motion.targets.go === 1) break;
      await new Promise((ok) => setTimeout(ok, 50));
    }
    mo.disconnect();
    return { seen, overlay, sounds, go: player.motion.targets.go };
  });
  expect(r.seen).toEqual([0, 1, 2, 3]);
  expect(r.go).toBe(1);
  expect(r.overlay).toBe(false);
  // No tap sound for a move the toy made by itself.
  expect(r.sounds.filter((k) => k === "toy")).toEqual([]);
});

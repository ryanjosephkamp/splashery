// Lane Powers of ten, the engine part (docs/handoff/Powers.md): a kit toy's
// own chunks, built when its drive asks (src/chunks.js), the zoom gesture
// taken by a toy (zoom: true, info.zoom), and a scale bar in the labels box
// (a legend item's ruler). The browser tests lend them to the comet.

import { test, expect } from "@playwright/test";
import { formatCount } from "../src/state.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

// Lends chunks and the zoom to the comet's recipe before it opens: each
// chunk is a small cloud that fades with its chunk. The test steers out
// through window.__potOut and reads what the drive was handed in
// window.__potInfo.
async function ready(page) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(async () => {
    const mod = await import("/src/packs/space.js");
    const recipe = mod.RECIPES.comet;
    recipe.zoom = true;
    recipe.chunks = {
      async build(k, id) {
        await new Promise((r) => setTimeout(r, 20));
        if (id === "bad") throw new Error("no such chunk");
        k.cloud({ count: ((id === "a" ? 6000 : 600) * 160000) / k.count }, (rand) => ({
          p: [rand() - 0.5, rand() - 0.5, 0],
          color: id === "a" ? "#ff8040" : "#40a0ff",
          size: 2,
          kind: "fade",
          params: [0, -0.99],
        }));
      },
    };
    const drive = recipe.drive;
    recipe.drive = (t, c, out, info) => {
      drive?.(t, c, out, info);
      for (const id of window.__potWant || []) info.chunks.want(id);
      Object.assign(out, window.__potOut || {});
      window.__potInfo = {
        zoom: info.zoom,
        states: Object.fromEntries(["a", "b", "bad"].map((id) => [id, info.chunks.state(id)])),
      };
      window.__potChunks = info.chunks;
    };
    await window.__splashery.app.chooseToy("comet");
  });
  await page.waitForFunction(() => window.__splashery.player.scene.toy.id === "comet" && !window.__splashery.player.loading); // prettier-ignore
}

async function frames(page, n = 4) {
  for (let i = 0; i < n; i++)
    await page.evaluate(
      () =>
        new Promise((r) => {
          window.__splashery.player.stage.requestRender();
          requestAnimationFrame(() => requestAnimationFrame(r));
        }),
    );
}

test("chunks build when asked, show where out.chunks puts them and go when dropped", async ({
  page,
}) => {
  await ready(page);
  const sheets = () => page.evaluate(() => window.__splashery.player.stage.toy.sheets?.length || 0); // prettier-ignore
  const before = await sheets();
  await frames(page);
  expect(await page.evaluate(() => window.__potInfo.states)).toEqual({ a: "none", b: "none", bad: "none" }); // prettier-ignore
  await page.evaluate(() => (window.__potWant = ["a", "bad"]));
  await page.waitForFunction(() => {
    window.__splashery.player.stage.requestRender();
    const s = window.__potInfo?.states;
    return s?.a === "ready" && s?.bad === "failed";
  });
  expect(await sheets()).toBe(before + 1);
  // Built but not placed: switched off.
  const off = await page.evaluate(() => window.__splashery.player.chunks.items.get("a").slot.entity.enabled); // prettier-ignore
  expect(off).toBe(false);
  // Placed: on, scaled and moved in the toy's frame, with its fade as its own channel.
  await page.evaluate(() => (window.__potOut = { chunks: { a: { scale: 2, offset: [0.1, 0, 0], fade: 0.5 } } })); // prettier-ignore
  await frames(page);
  const on = await page.evaluate(() => {
    const p = window.__splashery.player;
    const e = p.chunks.items.get("a").slot.entity;
    const T = p.proc.ctx.transform;
    return { on: e.enabled, scale: e.getLocalScale().x, x: e.getLocalPosition().x, T, splats: p.chunks.splats() }; // prettier-ignore
  });
  expect(on.on).toBe(true);
  expect(on.scale).toBeCloseTo(2 * on.T.scale, 4);
  expect(on.x).toBeCloseTo(on.T.scale * (0.1 - on.T.center[0]), 4);
  expect(on.splats).toBeGreaterThan(300);
  // The status line counts them.
  const own = await page.evaluate(() => window.__splashery.player.toyInfo.splats);
  await expect(page.locator("#toy-status")).toContainText(`${formatCount(own + on.splats)} splats`);
  expect(formatCount(own + on.splats)).not.toBe(formatCount(own));
  // Faded out: off again.
  await page.evaluate(() => (window.__potOut = { chunks: { a: { scale: 2, fade: 0 } } }));
  await frames(page);
  expect(await page.evaluate(() => window.__splashery.player.chunks.items.get("a").slot.entity.enabled)).toBe(false); // prettier-ignore
  // Dropped: gone, and a later want builds it again.
  await page.evaluate(() => {
    window.__potWant = [];
    window.__potChunks.drop("a");
  });
  await frames(page);
  expect(await page.evaluate(() => window.__potInfo.states.a)).toBe("none");
  expect(await sheets()).toBe(before);
  // A new toy takes the chunks away.
  await page.evaluate(() => (window.__potWant = ["b"]));
  await page.waitForFunction(() => {
    window.__splashery.player.stage.requestRender();
    return window.__potInfo?.states?.b === "ready";
  });
  await page.evaluate(() => window.__splashery.app.chooseToy("rocket"));
  await page.waitForFunction(() => window.__splashery.player.scene.toy.id === "rocket" && !window.__splashery.player.loading); // prettier-ignore
  expect(await page.evaluate(() => window.__splashery.player.chunks)).toBe(null);
});

test("a toy with zoom: true takes the pinch, the wheel and a drag; others move the camera", async ({
  page,
}) => {
  await ready(page);
  await frames(page);
  const dist = () => page.evaluate(() => window.__splashery.player.camera.tgt.distance);
  const d0 = await dist();
  await page.evaluate(() => {
    const cam = window.__splashery.player.camera;
    cam.zoomBy(0.5);
    cam.zoomBy(0.8);
  });
  await frames(page);
  expect(await dist()).toBeCloseTo(d0, 6);
  const z = await page.evaluate(() => window.__potInfo.zoom);
  expect(z.n).toBe(2);
  expect(z.log).toBeCloseTo(Math.log(0.4), 6);
  // The wheel on the stage goes the same way.
  const box = await page.locator("canvas").first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 200);
  await frames(page);
  const z2 = await page.evaluate(() => window.__potInfo.zoom);
  expect(z2.n).toBeGreaterThan(2);
  expect(z2.log).toBeGreaterThan(Math.log(0.4));
  expect(await dist()).toBeCloseTo(d0, 6);
  // A drag zooms too (up zooms in) and never turns the view.
  const yaw0 = await page.evaluate(() => window.__splashery.player.camera.tgt.yaw);
  const before = await page.evaluate(() => window.__potInfo.zoom.log);
  await page.evaluate(() => window.__splashery.player.camera.rotateBy(40, -120));
  await frames(page);
  expect(await page.evaluate(() => window.__potInfo.zoom.log)).toBeLessThan(before);
  expect(await page.evaluate(() => window.__splashery.player.camera.tgt.yaw)).toBeCloseTo(yaw0, 6);
  // Reset view counts.
  await page.evaluate(() => window.__splashery.player.resetCamera());
  await frames(page);
  expect(await page.evaluate(() => window.__potInfo.zoom.resets)).toBe(1);
  // Another toy: the camera zooms again.
  await page.evaluate(() => window.__splashery.app.chooseToy("rocket"));
  await page.waitForFunction(() => window.__splashery.player.scene.toy.id === "rocket" && !window.__splashery.player.loading); // prettier-ignore
  const r0 = await dist();
  await page.evaluate(() => window.__splashery.player.camera.zoomBy(0.8));
  expect(await dist()).toBeCloseTo(r0 * 0.8, 4);
});

test("a legend item's ruler draws a scale bar as long as its size on screen", async ({ page }) => {
  await ready(page);
  await page.evaluate(() => {
    window.__potOut = {
      legend: { title: "10⁰ m", items: [{ text: "0.5 units", ruler: { size: 0.25 } }] },
    };
  });
  await frames(page);
  const got = await page.evaluate(() => {
    const bar = document.querySelector("#toy-legend .toy-legend-ruler");
    const st = window.__splashery.player.stage;
    const s = window.__splashery.player.proc.ctx.transform.scale;
    const a = st.toScreen([0, 0, 0]);
    const b = st.toScreen([0.25 * s, 0, 0]);
    return { w: bar?.getBoundingClientRect().width, want: Math.hypot(b[0] - a[0], b[1] - a[1]) };
  });
  expect(got.w).toBeGreaterThan(10);
  expect(Math.abs(got.w - Math.min(140, got.want))).toBeLessThan(2);
});

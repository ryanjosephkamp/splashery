// Lane Screens: the Screen and the Gaussian splatting toy
// (docs/handoff/Screens.md). The fit, the kit keeping the fitted splats'
// sizes, every style and view building, the Screen switching on and playing
// its video, the training view's keyframes, and the lane's screenshots.

import { test, expect } from "@playwright/test";
import { fitSplats } from "../src/packs/splat-fit.js";
import { buildRecipe } from "../src/kit.js";
import { applyClay } from "../src/generators.js";
import { TOYS } from "../src/toys.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

async function openToy(page, id, options = {}, size = { width: 390, height: 844 }) {
  await page.setViewportSize(size);
  await page.goto(`${APP}&labs=1`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(
    async ([id, options]) => {
      const { app } = window.__splashery;
      await app.chooseToy(id);
      if (Object.keys(options).length) await app.setToyOptions(options);
    },
    [id, options],
  );
  await page.waitForFunction(
    (id) => {
      const p = window.__splashery.player.pictures;
      window.__splashery.player.stage.requestRender();
      // The Screen starts switched off with its picture hidden but built
      // (lane Screens r2): wait for the picture to be ready.
      if (id === "screen") return !!p?.media && p.api.ready("screen");
      return !p || (p.media && p.sheets.every((s) => !s.want || s.shown?.key === s.want.key) && p.splats() > 0); // prettier-ignore
    },
    id,
    { timeout: 120_000 },
  );
}

// Waits until `s` seconds of the player's clock have passed since the last
// tap (the Screen switches on on that clock).
async function settle(page, s) {
  await page.waitForFunction(
    (s) => {
      const pl = window.__splashery.player;
      pl.stage.requestRender();
      return pl.time - (pl.motion.tap?.time ?? 0) > s;
    },
    s,
    { timeout: 120_000 },
  );
}

function build(recipe, options, seed = 5, count = 180000) {
  const it = buildRecipe(recipe, { seed, count, options }, applyClay);
  let b = it.next();
  while (!b.done) b = it.next();
  return b.value;
}

test("the fit: gradient descent brings the splats' picture close to the photo", () => {
  // A small picture: a red disc on a pale card.
  const w = 40;
  const h = 30;
  const pixels = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const inside = Math.hypot(x - 20, y - 15) < 9;
      pixels.set(inside ? [210, 40, 40, 255] : [236, 236, 236, 255], o);
    }
  const r = fitSplats({ pixels, w, h, n: 300, keys: [0, 20, 60], background: [0.925, 0.925, 0.925] }); // prettier-ignore
  expect(r.keys.map((k) => k.step)).toEqual([0, 20, 60]);
  const [a, b, c] = r.keys.map((k) => k.loss);
  expect(b).toBeLessThan(a * 0.5);
  expect(c).toBeLessThan(b);
  expect(c).toBeLessThan(0.01);
  for (const k of r.keys)
    for (const v of [...k.x, ...k.sx, ...k.r, ...k.a]) expect(Number.isFinite(v)).toBe(true);
});

test("the kit keeps every fitted splat's size exactly (its random size factor is divided out)", async () => {
  const { RECIPES } = await import("../src/packs/splatting.js");
  const r = RECIPES["gaussian-splatting"];
  const options = { view: "training" };
  await r.prepare(options);
  // The same stand-in fit the recipe builds in Node.
  const px = new Uint8ClampedArray(96 * 72 * 4).fill(235);
  const f = fitSplats({ pixels: px, w: 96, h: 72, n: 2400, keys: [0], steps: 0, background: [0.92, 0.92, 0.92] }); // prettier-ignore
  const k0 = f.keys[0];
  for (const seed of [1, 5, 99]) {
    const ctx = build(r, options, seed);
    const s = ctx.transform.scale * (2 / 96);
    let worst = 0;
    for (let g = 0; g < 2400; g++) {
      const A = Math.max(k0.sx[g], k0.sy[g]);
      const B = Math.min(k0.sx[g], k0.sy[g]);
      worst = Math.max(worst, Math.abs(ctx.buf.scale[g * 3] / (A * s) - 1), Math.abs(ctx.buf.scale[g * 3 + 1] / (B * s) - 1)); // prettier-ignore
    }
    expect(worst, `seed ${seed}`).toBeLessThan(1e-4);
  }
});

test("every Screen style and every splat view builds, with finite splats and parts in range", async () => {
  const { RECIPES: S } = await import("../src/packs/screens.js");
  const { RECIPES: G } = await import("../src/packs/splatting.js");
  const cases = [
    ...["tv", "flat", "cinema", "hologram"].map((style) => [S.screen, { style, sample: "video" }]),
    ...["training", "one", "many", "sorting"].map((view) => [G["gaussian-splatting"], { view }]),
  ];
  for (const [recipe, options] of cases) {
    if (recipe.prepare) await recipe.prepare(options);
    const ctx = build(recipe, options);
    expect(ctx.buf.count, JSON.stringify(options)).toBeGreaterThan(1000);
    expect(ctx.parts.length, JSON.stringify(options)).toBeLessThanOrEqual(16);
    const pos = ctx.buf.pos.subarray(0, ctx.buf.count * 3);
    expect(pos.every(Number.isFinite), JSON.stringify(options)).toBe(true);
  }
  // Both are labs toys on their shelves.
  expect(TOYS.find((t) => t.id === "screen")).toMatchObject({ category: "pictures", labs: true });
  expect(TOYS.find((t) => t.id === "gaussian-splatting")).toMatchObject({ category: "computing", labs: true }); // prettier-ignore
});

test("the Screen switches on with a tap, plays its video, and pauses and plays again", async ({
  page,
}) => {
  await openToy(page, "screen", { style: "flat" });
  const before = await page.evaluate(() => window.__splashery.player.pictures.info());
  expect(before.kind).toBe("video");
  expect(before.playing).toBe(false);
  await page.evaluate(() => window.__splashery.player.act());
  await page.waitForFunction(() => window.__splashery.player.pictures.info().playing, null, { timeout: 20_000 }); // prettier-ignore
  // Switched on: the black cover has faded (channel 0 at 1).
  await page.waitForFunction(() => (window.__splashery.player.motion.out?.morph?.[0] ?? 0) > 0.99, null, { timeout: 20_000 }); // prettier-ignore
  await page.evaluate(() => window.__splashery.player.act());
  await page.waitForFunction(() => !window.__splashery.player.pictures.info().playing, null, { timeout: 20_000 }); // prettier-ignore
  await page.evaluate(() => window.__splashery.player.act());
  await page.waitForFunction(() => window.__splashery.player.pictures.info().playing, null, { timeout: 20_000 }); // prettier-ignore
  // A new style starts switched off again, the video stopped, its picture
  // built but hidden behind the closed curtains (lane Screens r2).
  await page.evaluate(() => window.__splashery.app.setToyOptions({ style: "cinema" }));
  await page.waitForFunction(() => !window.__splashery.player.pictures?.info().playing, null, { timeout: 20_000 }); // prettier-ignore
  await page.waitForFunction(() => window.__splashery.player.pictures?.api.ready("screen"), null, { timeout: 120_000 }); // prettier-ignore
  const splats = await page.evaluate(() => window.__splashery.player.pictures.sheets[0].slot.container.numSplats); // prettier-ignore
  expect(splats).toBeGreaterThan(5000);
});

test("the training view learns the photo in the browser: 13 keyframes, falling loss", async ({
  page,
}) => {
  await openToy(page, "gaussian-splatting");
  const d = await page.evaluate(() => {
    const data = window.__splashery.player.motion.ctx.kit.data;
    return { keys: data.keys, values: data.loss.values, parts: window.__splashery.player.motion.ctx.parts.length }; // prettier-ignore
  });
  expect(d.keys).toBe(13);
  expect(d.parts).toBe(15); // the body, 13 keyframes and the pen
  expect(d.values[0]).toBeGreaterThan(d.values[d.values.length - 1]);
  // The tap starts again from the random cloud: the first keyframe shows.
  await page.evaluate(() => window.__splashery.player.act());
  // (Read on a frame after the tap: a slow renderer may not have drawn one yet.)
  await page.waitForFunction(() => window.__splashery.player.motion.out?.parts?.k0?.visible === 1, null, { timeout: 10_000 }); // prettier-ignore
});

test("lane Screens screenshots at 390x844 and 1440x900", async ({ page }) => {
  for (const size of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    const tag = `${size.width}x${size.height}`;
    await openToy(page, "screen", { style: "tv" }, size);
    await page.evaluate(() => window.__splashery.player.act());
    await settle(page, 2);
    await page.screenshot({ path: `tests/screenshots/scr-screen-${tag}.png` });
    await openToy(page, "gaussian-splatting", {}, size);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `tests/screenshots/scr-splatting-${tag}.png` });
  }
});

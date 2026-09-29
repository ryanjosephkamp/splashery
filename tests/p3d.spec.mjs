// Lane Photo to 3D: a photo rebuilt as splats at its depth (docs/handoff/Photo3D.md). The conversion is
// checked on numbers and on the samples; the browser tests open a tiny photo through the Toy tab's
// panel (the depth model runs for real) and check that nothing loads the model or the runtime before.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import {
  buildPhotoSplats,
  resampleArea,
  normalizeDepth,
  PHOTO_BUDGETS,
  TIER_COUNTS,
  PHOTO_DENSITY,
} from "../src/packs/photo-3d-core.js";
import { RECIPES, SAMPLES, packDepth, unpackDepth, decodePhoto, usePhoto, layerMorph } from "../src/packs/photo-3d.js"; // prettier-ignore
import { buildRecipe } from "../src/kit.js";
import { applyClay } from "../src/generators.js";
import { resolveOptions } from "../src/player.js";
import { TOYS } from "../src/toys.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const FIX = "tests/fixtures/p3d";
const RECIPE = RECIPES["photo-3d"];

function build(count, options = {}) {
  const o = resolveOptions(RECIPE, options);
  return RECIPE.prepare(o).then(() => {
    const it = buildRecipe(RECIPE, { seed: 1, count, options: o }, applyClay);
    let r = it.next();
    while (!r.done) r = it.next();
    return r.value;
  });
}

// A photo of a bright square on a dark ground, and a depth map with the square near.
const twoLevels = (w = 60, h = 40) => {
  const data = new Uint8Array(w * h * 4);
  const d = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const near = x > w * 0.3 && x < w * 0.7 && y > h * 0.3 && y < h * 0.7;
      const i = y * w + x;
      data.set(near ? [230, 60, 50, 255] : [40, 60, 90, 255], i * 4);
      d[i] = near ? 5 : 1 + 0.2 * (y / h);
    }
  return { photo: { w, h, data }, depth: { w, h, d } };
};

test.describe("the conversion", () => {
  test("the toy is a labs toy on the Studio shelf", () => {
    const t = TOYS.find((x) => x.id === "photo-3d");
    expect(t.labs).toBe(true);
    expect(t.category).toBe("studio");
    expect(t.pack).toBe("photo-3d");
  });

  test("splat budgets follow the tiers", () => {
    for (const [tier, t] of Object.entries(TIER_COUNTS))
      expect(PHOTO_BUDGETS[tier]).toBe(Math.round(Math.min(t.maxCount, t.defaultCount * PHOTO_DENSITY)));
    expect(PHOTO_BUDGETS.low).toBeLessThan(PHOTO_BUDGETS.max);
  });

  test("area averaging keeps a flat color and halves a stripe", () => {
    const w = 8;
    const data = new Uint8Array(w * 2 * 4);
    for (let y = 0; y < 2; y++) for (let x = 0; x < w; x++) data.set(x % 2 ? [255, 255, 255, 255] : [0, 0, 0, 255], (y * w + x) * 4); // prettier-ignore
    const out = resampleArea({ w, h: 2, data }, 2, 1);
    for (const v of out) expect(v).toBeCloseTo(0.5, 3);
  });

  test("depth is stretched to 0..1 and stored without loss that shows", () => {
    const d = Float32Array.from({ length: 1000 }, (_, i) => 3 + i * 0.01);
    const n = normalizeDepth(d);
    expect(Math.min(...n)).toBe(0);
    expect(Math.max(...n)).toBe(1);
    const back = unpackDepth(packDepth({ w: 50, h: 20, d }));
    expect(back.w).toBe(50);
    for (let i = 0; i < d.length; i += 97) expect(back.d[i]).toBeCloseTo(d[i], 3);
  });

  test("splats sit at different depths where the photo's depth differs, and a near object is its own piece", () => {
    const { photo, depth } = twoLevels();
    const s = buildPhotoSplats(photo, depth, { count: 2400, depth: 0.5 });
    expect(s.n).toBeLessThanOrEqual(2400);
    const at = (fx, fy) => {
      const i = Math.floor(fy * s.gy) * s.gx + Math.floor(fx * s.gx);
      return s.relief[i * 3 + 2];
    };
    expect(at(0.5, 0.5) - at(0.1, 0.1)).toBeGreaterThan(0.15); // the square stands in front
    expect(s.stats.bigPieces).toBeGreaterThanOrEqual(2); // cut apart at the jump
    expect(s.stats.cutEdges).toBeGreaterThan(20);
    // the flat pose is one plane, and a deeper Depth setting makes a deeper relief
    for (let i = 0; i < s.n; i++) expect(s.flat[i * 3 + 2]).toBe(0);
    const deep = buildPhotoSplats(photo, depth, { count: 2400, depth: 1 });
    expect(deep.stats.relief).toBeGreaterThan(s.stats.relief);
    // no splat is stretched across the jump: every size stays within 1.7 grid cells (times FILL)
    for (let i = 0; i < s.n; i++) expect(s.sigma[i]).toBeLessThan(2.1 / s.gy);
    // colors follow the photo
    const i = Math.floor(0.5 * s.gy) * s.gx + Math.floor(0.5 * s.gx);
    expect(s.rgb[i * 3]).toBeGreaterThan(0.8);
    expect(s.rgb[i * 3 + 2]).toBeLessThan(0.3);
  });

  test("the layers rise one after another and end where they should", () => {
    expect(layerMorph(0, 3)).toBe(1);
    expect(layerMorph(1, 3)).toBe(0);
    expect(layerMorph(0.4, 0)).toBeLessThan(layerMorph(0.4, 3));
  });

  test("each sample builds within every tier's budget, with finite numbers", async () => {
    for (const s of SAMPLES)
      for (const [tier, budget] of Object.entries(PHOTO_BUDGETS)) {
        const ctx = await build(budget, { source: s.id });
        const info = ctx.kit.data.photo;
        expect(info.splats, `${s.id} on ${tier}`).toBeLessThanOrEqual(budget);
        expect(info.splats).toBeGreaterThan(budget * 0.85);
        expect(info.pieces).toBeGreaterThan(1);
        const b = ctx.kit.buf;
        let bad = 0;
        for (let i = 0; i < b.count * 3; i++) if (!Number.isFinite(b.pos[i])) bad++;
        expect(bad, `${s.id} on ${tier}: non-finite positions`).toBe(0);
      }
  });

  test("a photo of your own builds", async () => {
    const { photo, depth } = twoLevels(96, 72);
    usePhoto(photo, depth, "Two levels");
    const ctx = await build(20000, { source: "custom" });
    expect(ctx.kit.data.photo.name).toBe("Two levels");
    expect(ctx.kit.data.photo.custom).toBe(true);
    const p = await decodePhoto(new Uint8Array(fs.readFileSync(`${FIX}/scene.jpg`)));
    expect([p.w, p.h]).toEqual([96, 72]);
  });
});

test.describe("in the browser", () => {
  test("nothing loads the depth model until a photo is opened; then it builds and taps", async ({ page }) => {
    test.setTimeout(240_000);
    const errors = [];
    const requests = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => requests.push(r.url()));
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("photo-3d"));
    await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.photo?.splats > 5000, null, { timeout: 90_000 }); // prettier-ignore
    for (const id of ["street", "still-life", "forest"]) {
      await page.evaluate((id) => window.__splashery.app.setToyOptions({ source: id }), id);
      await page.waitForTimeout(600);
    }
    const heavy = (u) => /onnx|depth-anything|ort-wasm/i.test(u);
    expect(requests.filter(heavy)).toEqual([]);
    // the tap raises the depth, a second lays it flat
    await page.evaluate(() => window.__splashery.app.act());
    await page.waitForFunction(() => window.__splashery.player.motion.state.rise > 0.9, null, { timeout: 30_000 }); // prettier-ignore
    await page.evaluate(() => window.__splashery.app.act());
    await page.waitForFunction(() => window.__splashery.player.motion.state.rise < 0.05, null, { timeout: 30_000 }); // prettier-ignore
    // your own photo, through the panel
    await page.locator("#toy-input-file").setInputFiles(`${FIX}/scene.jpg`);
    await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.photo?.custom === true, null, { timeout: 150_000 }); // prettier-ignore
    expect(requests.filter(heavy).length).toBeGreaterThan(0); // now the model and the runtime came
    const info = await page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.photo);
    expect(info.name).toBe("scene");
    expect(info.pieces).toBeGreaterThanOrEqual(1);
    await expect(page.locator("#toy-input")).toContainText("splats");
    // a file that is not a photo says so
    await page.locator("#toy-input-file").setInputFiles({ name: "x.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not a photo") }); // prettier-ignore
    await expect(page.locator(".warning:visible")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("screenshots at phone and desktop size", async ({ browser }) => {
    for (const [w, h] of [
      [390, 844],
      [1440, 900],
    ]) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await page.goto(APP);
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      await page.evaluate(() => window.__splashery.app.chooseToy("photo-3d"));
      await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.photo?.splats > 5000, null, { timeout: 90_000 }); // prettier-ignore
      await page.evaluate(() => window.__splashery.player.motion.setControl("rise", 1, { snap: true }));
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `tests/screenshots/p3d-photo-3d-${w}x${h}.png` });
      await page.close();
    }
  });
});

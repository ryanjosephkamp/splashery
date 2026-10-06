// Lane Studio media: Model to splats' sample models. Each one parses (no Draco or meshopt), has
// its color texture, stays within every tier's splat budget, and is under 10 MB; the toy shows
// each one in the browser.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";
import { parseModel, prepareModel, MODEL_BUDGETS } from "../src/packs/studio-models-core.js";
import { RECIPES, SAMPLES, useModel, modelState } from "../src/packs/studio-models.js";
import { buildRecipe } from "../src/kit.js";
import { applyClay } from "../src/generators.js";
import { resolveOptions } from "../src/player.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const RECIPE = RECIPES["model-splats"];
const decodeImage = (b, mime) => {
  if (mime === "image/png" || b[0] === 0x89) {
    const p = PNG.sync.read(Buffer.from(b));
    return { w: p.width, h: p.height, data: new Uint8Array(p.data) };
  }
  const j = jpeg.decode(Buffer.from(b), { useTArray: true });
  return { w: j.width, h: j.height, data: j.data };
};
const IDS = ["burger", "vase", "camera", "boombox", "lantern", "whale", "rocker"];

async function buildToy(prep, count) {
  useModel(prep);
  const o = resolveOptions(RECIPE, { source: "custom" });
  await RECIPE.prepare(o);
  const it = buildRecipe(RECIPE, { seed: 1, count, options: o }, applyClay);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

test.describe("the sample models", () => {
  test("the list has the seven models, each with its credit", () => {
    expect(SAMPLES.map((s) => s.id)).toEqual(IDS);
    for (const s of SAMPLES) {
      expect(fs.existsSync(`assets/toys/model-splats/${s.file}`), s.id).toBe(true);
      expect(s.title && s.author && s.source, s.id).toBeTruthy();
    }
  });

  for (const s of SAMPLES) {
    test(`${s.id}: under 10 MB, no compression, textured, within each tier's budget`, async () => {
      test.setTimeout(120_000);
      const bytes = new Uint8Array(fs.readFileSync(`assets/toys/model-splats/${s.file}`));
      expect(bytes.length, s.id).toBeLessThan(10e6);
      const json = Buffer.from(bytes.subarray(20, 20 + new DataView(bytes.buffer).getUint32(12, true))).toString(); // prettier-ignore
      expect(json, s.id).not.toMatch(/KHR_draco_mesh_compression|EXT_meshopt_compression/);
      const prep = await prepareModel(parseModel(bytes, s.file), { decodeImage });
      expect(prep.textured, s.id).toBe(true);
      for (const tier of ["low", "max"]) {
        const budget = MODEL_BUDGETS[tier];
        const ctx = await buildToy(prep, budget);
        expect(ctx.buf.count, `${s.id} ${tier}`).toBeLessThanOrEqual(budget);
        expect(ctx.buf.count, `${s.id} ${tier}`).toBeGreaterThan(budget * 0.9);
        expect(modelState().splats).toBe(ctx.buf.count);
      }
    });
  }

  test("the toy shows each one", async ({ page }) => {
    test.setTimeout(300_000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("model-splats"));
    for (const s of SAMPLES) {
      await page.evaluate((id) => window.__splashery.app.setToyOptions({ source: id }), s.id);
      await page.waitForFunction((label) => window.__splashery.player.proc?.ctx?.kit?.data?.model?.name === label, s.label, { timeout: 90_000 }); // prettier-ignore
      expect(await page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.model.splats)).toBeGreaterThan(5000); // prettier-ignore
    }
    expect(errors).toEqual([]);
  });
});

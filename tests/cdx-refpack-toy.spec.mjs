import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { loadPack } from "../tools/refpack.mjs";
import { TOYS } from "../src/toys.js";
import { REFERENCE_BUILDS } from "../src/refbuild/data.js";
import { RECIPES } from "../src/refbuild/toy.js";
import { Kit } from "../src/kit.js";

test("the five public packs stay under 3 MB and carry verified CC0 asset hashes", () => {
  const hash = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
  for (const b of REFERENCE_BUILDS) {
    const dir = `tools/refpack-samples/${b.id}`,
      pack = loadPack(dir);
    expect(pack.license.images).toBe("CC0-1.0");
    const truth = JSON.parse(fs.readFileSync(`${dir}/truth/truth.json`));
    expect(truth.modelHash).toBe(hash(`${dir}/truth/${truth.model}`));
    for (const [file, expected] of Object.entries(truth.imageHashes))
      expect(hash(`${dir}/${file}`)).toBe(expected);
    const result = JSON.parse(fs.readFileSync(`${dir}/build/result.json`));
    expect(result.status).toBe("complete");
    expect(result.withinBudget).toBe(true);
    for (const [file, expected] of Object.entries(result.outputHashes))
      expect(hash(`${dir}/build/${file}`)).toBe(expected);
    let size = 0;
    const visit = (folder) => {
      for (const e of fs.readdirSync(folder, { withFileTypes: true })) {
        const p = path.join(folder, e.name);
        if (e.isDirectory()) visit(p);
        else size += fs.statSync(p).size;
      }
    };
    visit(dir);
    expect(size).toBeLessThan(3_000_000);
  }
  const records = JSON.parse(fs.readFileSync("src/refbuild/asset-records.json"));
  expect(records.thumbnail.sha256).toBe(hash(records.thumbnail.file));
});

test("the labs entry uses the five measured good builds with rigid part motion", () => {
  expect(TOYS.find((t) => t.id === "built-from-pictures").labs).toBe(true);
  expect(REFERENCE_BUILDS).toHaveLength(5);
  const recipe = RECIPES["built-from-pictures"];
  for (const build of REFERENCE_BUILDS) {
    const actual = JSON.parse(
      fs.readFileSync(`tools/refpack-samples/${build.id}/build/model.json`),
    );
    expect(build.model).toEqual(actual);
    const k = new Kit(113, { count: 2000 });
    recipe.build(k, { object: build.id });
    const it = k.emit();
    while (!it.next().done);
    expect(k.parts.length).toBeGreaterThan(1);
    for (const item of k.items) expect(item.opts.part).toBeGreaterThan(0);
    const out = { parts: {} };
    recipe.drive(1, { play: 0.65 }, out, { data: k.data });
    const rest = { parts: {} };
    recipe.drive(3, { play: 0 }, rest, { data: k.data });
    for (const m of build.model.moves) {
      expect(JSON.stringify(out.parts[m.part])).not.toBe(JSON.stringify(rest.parts[m.part]));
      if (rest.parts[m.part].angle !== undefined) expect(rest.parts[m.part].angle).toBeCloseTo(0);
      if (rest.parts[m.part].offset)
        expect(rest.parts[m.part].offset.every((x) => x === 0)).toBe(true);
    }
  }
});
for (const [width, height] of [
  [390, 844],
  [1440, 900],
]) {
  test(`toy opens, picks five objects, taps, and shows the reference gallery at ${width}×${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/?labs=1&renderer=webgl2&profile=low&adapt=off&help=show");
    await page.waitForSelector("body[data-ready='true']");
    await page.evaluate(() => window.__splashery.app.chooseToy("built-from-pictures"));
    await expect(page.locator("#toy-status")).toHaveText(/^Built from pictures/);
    for (const b of REFERENCE_BUILDS) {
      const action = await page.evaluate(async (object) => {
        const { app, player } = window.__splashery;
        await app.setToyOption("object", object);
        player.idle.weight = 0;
        player.camera.setTurntable(false);
        const action = player.act();
        await player.stage.captureFrame();
        return action.key;
      }, b.id);
      expect(action).toBe("play");
      const data = await page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.refbuild);
      expect(data.shapes.length).toBe(b.model.shapes.length);
      await page.screenshot({ path: `.cache/refpack-${b.id}-${width}.png` });
    }
    if ((await page.locator("#help-toggle").getAttribute("aria-expanded")) !== "true")
      await page.click("#help-toggle");
    await page.click("#help-line-about");
    await expect(page.locator("#pane-about")).toBeVisible();
    await expect(page.locator(".reference-gallery")).toHaveCount(5);
    await expect(page.locator(".reference-gallery img")).toHaveCount(30);
    await expect(page.locator(".reference-gallery").first()).toContainText("silhouette");
    await page.screenshot({ path: `.cache/refpack-toy-${width}x${height}.png` });
    expect(errors).toEqual([]);
  });
}

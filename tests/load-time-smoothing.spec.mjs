import { test, expect } from "@playwright/test";
import crypto from "node:crypto";
import fs from "node:fs";
import { gunzipSync } from "node:zlib";
import { buildRecipe } from "../src/kit.js";
import { applyClay } from "../src/generators.js";
import { resolveOptions } from "../src/player.js";

test("a compressed exact-mean scan preserves low-budget and high-detail buffers", async () => {
  const full = await import("../src/packs/photoreal-r3.js?mean-full-reference");
  const opening = await import("../src/packs/photoreal-r3.js?mean-opening-test");
  const build = async (mod, profile, count) => {
    const recipe = mod.RECIPES["celestial-globe"],
      options = resolveOptions(recipe, {});
    await recipe.prepare(options, null, { profile, count });
    const it = buildRecipe(recipe, { seed: 424242, count, options }, applyClay);
    let r;
    do {
      r = it.next();
    } while (!r.done);
    return r.value.buf;
  };
  const hash = (x) => crypto.createHash("sha256").update(new Uint8Array(x.buffer)).digest("hex");
  for (const [profile, count] of [
    ["low", 90000],
    ["low", 30000],
    ["high", 300000],
  ]) {
    const a = await build(full, "high", count),
      b = await build(opening, profile, count);
    expect(b.count).toBe(a.count);
    for (const k of Object.keys(a).filter((k) => ArrayBuffer.isView(a[k])))
      expect(hash(b[k]), `${profile} ${k}`).toBe(hash(a[k]));
  }
});

test("armillary and Stannern openings preserve all low and high geometry and shading buffers", async () => {
  const full = await import("../src/packs/photoreal-r3.js?museum-full-reference");
  const hash = (x) => crypto.createHash("sha256").update(new Uint8Array(x.buffer)).digest("hex");
  for (const id of ["armillary-sphere", "stannern-meteorites"]) {
    const small = await import(`../src/packs/photoreal-r3.js?museum-prefix-${id}`);
    const build = async (module, profile, count) => {
      const recipe = module.RECIPES[id],
        options = resolveOptions(recipe, {});
      await recipe.prepare(options, null, { profile, count });
      const it = buildRecipe(recipe, { seed: 424242, count, options }, applyClay);
      let result;
      do {
        result = it.next();
      } while (!result.done);
      return result.value.buf;
    };
    for (const [profile, count] of [
      ["low", 90000],
      ["low", 30000],
      ["high", 300000],
    ]) {
      const a = await build(full, "high", count),
        b = await build(small, profile, count);
      expect(b.count).toBe(a.count);
      for (const key of Object.keys(a).filter((key) => ArrayBuffer.isView(a[key])))
        expect(hash(b[key]), `${id} ${profile} ${key}`).toBe(hash(a[key]));
    }
  }
});

test("the low tier requests compressed exact means and raises detail safely", async ({ page }) => {
  const requests = [];
  page.on("request", (r) => requests.push(new URL(r.url()).pathname));
  await page.goto("/?renderer=webgl2&profile=weak&adapt=off&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("celestial-globe"));
  expect(requests).toContain("/assets/toys/celestial-globe/celestial-globe-opening.splats.gz");
  expect(requests).not.toContain("/assets/toys/celestial-globe/celestial-globe.splats");
  await page.evaluate(async () => {
    window.__splashery.player.setProfile("high");
    await window.__splashery.app.chooseToy("celestial-globe");
  });
  expect(requests).toContain("/assets/toys/celestial-globe/celestial-globe.splats");
});

test("an HTTP-decoded opening body also loads correctly", async ({ page }) => {
  await page.route("**/celestial-globe-opening.splats.gz", (route) =>
    route.fulfill({
      contentType: "application/octet-stream",
      body: gunzipSync(
        fs.readFileSync("assets/toys/celestial-globe/celestial-globe-opening.splats.gz"),
      ),
    }),
  );
  await page.goto("/?renderer=webgl2&profile=weak&adapt=off&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("celestial-globe"));
  expect(await page.evaluate(() => window.__splashery.player.toyInfo.splats)).toBe(77400);
});

test("a browser without native decompression retains the original full scan", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "DecompressionStream", { value: undefined }),
  );
  const requests = [];
  page.on("request", (r) => requests.push(new URL(r.url()).pathname));
  await page.goto("/?renderer=webgl2&profile=weak&adapt=off&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("celestial-globe"));
  expect(requests).toContain("/assets/toys/celestial-globe/celestial-globe.splats");
  expect(requests).not.toContain("/assets/toys/celestial-globe/celestial-globe-opening.splats.gz");
  expect(await page.evaluate(() => window.__splashery.player.toyInfo.splats)).toBe(77400);
});

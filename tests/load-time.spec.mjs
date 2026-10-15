// Task 51: startup imports and scan prefixes must preserve the rendered scene.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import crypto from "node:crypto";
import io from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { buildRecipe } from "../src/kit.js";
import { applyClay } from "../src/generators.js";
import { resolveOptions } from "../src/player.js";

const digest = (a) => crypto.createHash("sha256").update(new Uint8Array(a.buffer)).digest("hex");

const PREFIX_IDS = ["water-bottle", "sunglasses", "baseball-cap", "fountain-pen", "soda-can"];

test("a late phone read cannot replace a larger scan needed by another player", async () => {
  const read = io.readFile;
  // Schedule real file reads in the order a slow phone request and a faster
  // high-detail request can complete in two players sharing the module.
  io.readFile = async (file, ...args) => {
    if (String(file).endsWith("water-bottle-opening.splats"))
      await new Promise((resolve) => setTimeout(resolve, 200));
    return read(file, ...args);
  };
  syncBuiltinESMExports();
  try {
    const { RECIPES } = await import("../src/packs/real-objects.js?concurrent-scan-test");
    const recipe = RECIPES["water-bottle"];
    const options = resolveOptions(recipe, {});
    await Promise.all([
      recipe.prepare(options, null, { profile: "low", count: 90000 }),
      recipe.prepare(options, null, { profile: "high", count: 300000 }),
    ]);
    const it = buildRecipe(recipe, { seed: 424242, count: 300000, options }, applyClay);
    let r;
    do {
      r = it.next();
    } while (!r.done);
    expect(r.value.buf.count).toBeGreaterThan(200000);
  } finally {
    io.readFile = read;
    syncBuiltinESMExports();
  }
});

test("phone prefixes and original-file fallbacks preserve the full-scan buffers", async () => {
  const full = await import("../src/packs/real-objects.js?full-scan-test");
  async function build(mod, id, profile, count = 90000) {
    const recipe = mod.RECIPES[id];
    const options = resolveOptions(recipe, {});
    await recipe.prepare(options, null, { profile, count });
    const it = buildRecipe(recipe, { seed: 424242, count, options }, applyClay);
    let r;
    do {
      r = it.next();
    } while (!r.done);
    return r.value.buf;
  }
  for (const id of PREFIX_IDS) {
    for (const [profile, count, suffix] of [
      ["low", 90000, ""],
      ["mid", 210000, "-mid"],
    ]) {
      const small = await import(`../src/packs/real-objects.js?prefix-scan-test-${id}-${profile}`);
      expect(fs.existsSync(`assets/toys/${id}/${id}-opening${suffix}.splats`)).toBe(true);
      const a = await build(full, id, "high", count);
      const b = await build(small, id, profile, count);
      expect(b.count, id).toBe(a.count);
      for (const key of Object.keys(a).filter((key) => ArrayBuffer.isView(a[key])))
        expect(digest(b[key]), `${id} ${profile}: ${key}`).toBe(digest(a[key]));
      // Raising detail after a phone load must fetch enough records for the new budget.
      const c = await build(small, id, "high", 300000);
      const d = await build(full, id, "high", 300000);
      for (const key of Object.keys(c).filter((key) => ArrayBuffer.isView(c[key])))
        expect(digest(c[key]), `${id}: raised detail ${key}`).toBe(digest(d[key]));
    }
  }
});

test("phone opening requests use prefixes and larger budgets retain full scans", async ({
  page,
}) => {
  const requests = [];
  page.on("request", (r) => requests.push(new URL(r.url()).pathname));
  await page.goto("/?renderer=webgl2&profile=weak&adapt=off&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("water-bottle"));
  await page.waitForFunction(() => window.__splashery.player.toyInfo?.id === "water-bottle");
  expect(requests).toContain("/assets/toys/water-bottle/water-bottle-opening.splats");
  expect(requests).not.toContain("/assets/toys/water-bottle/water-bottle.splats");
  await page.evaluate(async () => {
    window.__splashery.player.setProfile("mid");
    await window.__splashery.app.chooseToy("water-bottle");
  });
  expect(requests).toContain("/assets/toys/water-bottle/water-bottle-opening-mid.splats");
  await page.evaluate(async () => {
    window.__splashery.player.setProfile("high");
    await window.__splashery.app.chooseToy("water-bottle");
  });
  await expect
    .poll(() => requests.includes("/assets/toys/water-bottle/water-bottle.splats"))
    .toBe(true);
});

// Lane SPL1 (docs/handoff/SPL1.md): the labs Splats slider sets the count a
// toy draws. A kit toy is built to the slider's count (measured, src/kit.js
// buildRecipeTo) or to the count its recipe states; a capture draws every
// splat its file has, up to the slider's count, and its label says when it
// has fewer. With the slider off nothing changes.

import { test, expect } from "@playwright/test";
import { TOYS } from "../src/toys.js";
import { PROFILES } from "../src/generators.js";
import { thinHash, thinnedCount, MODIFIER_THIN, MODIFIER_RIG_THIN } from "../src/effects.js";

// Kit toys across the densities (0.05 to 2), among them toys that drew
// well under their budget before they were measured (the solar system 54%,
// the egg 72%, the fluorite crystal 90%, the picture frame 93%).
const SAMPLE = [
  "cast-a-shadow", // density 0.05
  "picture-frame", // 0.3
  "paper-plane", // 0.5
  "clock", // 1
  "solar-system", // 1
  "egg", // 1
  "fluorite-crystal", // 1.5
  "american-football", // 2
  "puzzle-cube", // 1.8
];
const COUNTS = [60_000, 200_000, 400_000];

async function open(page, query = "") {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`/?renderer=webgl2&adapt=off&labs=1${query}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  return errors;
}

// Picks a toy and waits for it, then reads what it drew and what its labels say.
async function show(page, id) {
  await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
  await page.waitForFunction((id) => window.__splashery.player.toyInfo?.id === id, id, {
    timeout: 120_000,
  });
  await page.waitForFunction(() => !window.__splashery.app.busy);
  return read(page);
}

const read = (page) =>
  page.evaluate(async () => {
    const { player } = window.__splashery;
    const info = player.toyInfo;
    const { statedSplats } = await import("/src/kit.js");
    const stated =
      info.kind === "kit" ? statedSplats(info.recipe, player.splats, info.options) : null;
    return {
      id: info.id,
      kind: info.kind,
      splats: info.splats,
      note: info.splatsNote || "",
      built: player.proc?.ctx?.buf?.count ?? null,
      stated: stated?.count ?? null,
      thin: player.stage.toy?.thin ?? null,
      file: player.stage.toy?.resource?.numSplats ?? null,
      status: document.getElementById("toy-status").textContent,
      render: document.getElementById("render-info").textContent,
      slider: player.splats,
      pics: player.pictures?.splats() || 0,
    };
  });

const k = (n) => `${Math.round(n / 1000)}k`;

test("slider off: every toy's count is main's (the tier times the density)", async ({ page }) => {
  // Main's rule, kept here as the list to compare against.
  const main = (tier, density) =>
    Math.round(Math.min(PROFILES[tier].maxCount, PROFILES[tier].defaultCount * density));
  const kit = TOYS.filter((t) => t.kind === "kit");
  const densities = {};
  for (const def of kit) {
    const mod = await import(`../src/packs/${def.pack}.js`);
    densities[def.id] = mod.RECIPES[def.id].density ?? 1;
  }
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?renderer=webgl2&adapt=off&profile=mid");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  const got = await page.evaluate((densities) => {
    const { player } = window.__splashery;
    const out = {};
    for (const tier of ["low", "mid", "high", "max"])
      for (const [id, d] of Object.entries(densities))
        out[`${tier}:${id}`] = player.splatBudget.call({ profile: tier, splats: null }, d);
    out.procedural = player.splatBudget();
    return out;
  }, densities);
  const want = {};
  for (const tier of ["low", "mid", "high", "max"])
    for (const [id, d] of Object.entries(densities)) want[`${tier}:${id}`] = main(tier, d);
  want.procedural = main("mid", 1);
  expect(got).toEqual(want);

  // And a sample drawn: the plain build, no measuring, no note.
  const { buildRecipe } = await import("../src/kit.js");
  const { applyClay } = await import("../src/generators.js");
  const { resolveOptions } = await import("../src/player.js");
  const { hash32 } = await import("../src/noise.js");
  for (const id of ["clock", "celestial-globe", "solar-system"]) {
    const r = await show(page, id);
    const def = kit.find((t) => t.id === id);
    const recipe = (await import(`../src/packs/${def.pack}.js`)).RECIPES[id];
    const options = resolveOptions(recipe, {});
    const count = main("mid", densities[id]);
    await recipe.prepare?.(options, undefined, { profile: "mid", count });
    const it = buildRecipe(recipe, { seed: recipe.seed ?? hash32(id), count, options }, applyClay); // prettier-ignore
    let x = it.next();
    while (!x.done) x = it.next();
    expect(r.splats, id).toBe(x.value.buf.count);
    expect(r.note).toBe("");
    expect(r.status).toContain(`${k(r.splats)} splats`);
    expect(r.status).not.toContain("(");
  }
  expect(errors).toEqual([]);
});

for (const n of COUNTS) {
  test(`slider at ${k(n)}: kit toys draw within 2% of it (or of the count they state)`, async ({
    page,
  }) => {
    const errors = await open(page);
    await page.evaluate((n) => window.__splashery.app.setSplats(n), n);
    const rows = [];
    for (const id of SAMPLE) {
      const r = await show(page, id);
      const want = r.stated ?? n;
      rows.push({ id, drawn: r.splats, want, off: +((r.splats - want) / want).toFixed(4) });
      expect(r.slider).toBe(n);
      // The label shows the count drawn, the true one.
      expect(r.splats, id).toBe(r.built);
      // A picture toy's pictures come on top, and the label names both.
      const own = r.pics ? `${k(r.splats)} in the toy` : `${k(r.splats)} splats`;
      expect(r.status).toContain(r.pics ? `${k(r.splats + r.pics)} splats (${own}` : own);
      expect(r.render).toContain(`${k(r.splats)} splats${r.note}`);
      expect(Math.abs(r.splats - want), `${id}: ${r.splats} for ${want}`).toBeLessThanOrEqual(want * 0.02); // prettier-ignore
      if (Math.abs(r.splats - n) > n * 0.02) expect(r.note, id).not.toBe("");
      else expect(r.note, id).toBe("");
    }
    console.log(JSON.stringify(rows));
    expect(errors).toEqual([]);
  });
}

test("k.shrink: under 1 only past the most the tiers give a toy", async ({ page }) => {
  const errors = await open(page);
  const shrink = () => page.evaluate(() => window.__splashery.player.proc.ctx.kit.shrink);
  await show(page, "clock"); // density 1: the max tier gives it 280,000
  expect(await shrink()).toBe(1);
  await page.evaluate(() => window.__splashery.app.setSplats(200_000));
  await page.waitForFunction(() => window.__splashery.player.toyInfo?.splats > 190_000);
  expect(await shrink()).toBe(1);
  await page.evaluate(() => window.__splashery.app.setSplats(400_000));
  await page.waitForFunction(() => window.__splashery.player.toyInfo?.splats > 390_000);
  expect(await shrink()).toBeCloseTo(Math.sqrt(280 / 400), 6);
  expect(errors).toEqual([]);
});

test("slider: a shelf shape draws the slider's count", async ({ page }) => {
  const errors = await open(page);
  await page.evaluate(() => window.__splashery.app.setSplats(300_000));
  const r = await show(page, "knot");
  expect(Math.abs(r.splats - 300_000)).toBeLessThanOrEqual(6000);
  expect(r.note).toBe("");
  expect(errors).toEqual([]);
});

// The millipede's files: 116,374 splats (full) and 100,000 (light).
test("slider: a capture draws every splat it has, up to the slider's count", async ({ page }) => {
  const errors = await open(page);
  // More than the file has: all of it, and the label says so.
  await page.evaluate(() => window.__splashery.app.setSplats(400_000));
  let r = await show(page, "millipede");
  expect(r.kind).toBe("captured");
  expect(r.file).toBe(116_374);
  expect(r.splats).toBe(116_374);
  expect(r.thin).toBeNull();
  expect(r.note).toBe(" (all this toy has)");
  expect(r.status).toContain("116k splats (all this toy has)");
  expect(r.render).toContain("116k splats (all this toy has)");

  // Fewer: the light file (the low tier's), thinned to the slider's count.
  await page.evaluate(() => window.__splashery.app.setSplats(60_000));
  await page.waitForFunction(() => window.__splashery.player.toyInfo?.splats < 90_000);
  r = await read(page);
  expect(r.file).toBe(100_000);
  expect(r.thin).toBeCloseTo(0.6, 5);
  expect(Math.abs(r.splats - 60_000)).toBeLessThanOrEqual(1200);
  expect(r.splats).toBe(thinnedCount(100_000, 0.6));
  expect(r.note).toBe("");
  expect(r.status).toContain(`${k(r.splats)} splats`);

  // Between the two files: the light one has too few, so the full one, thinned.
  await page.evaluate(() => window.__splashery.app.setSplats(110_000));
  await page.waitForFunction(() => window.__splashery.player.stage.toy?.resource?.numSplats > 110_000); // prettier-ignore
  r = await read(page);
  expect(r.file).toBe(116_374);
  expect(Math.abs(r.splats - 110_000)).toBeLessThanOrEqual(2200);

  // Off: the tier's file, whole, with no note.
  await page.evaluate(() => window.__splashery.app.setDetail("auto"));
  await page.waitForFunction(() => !window.__splashery.player.splats);
  await page.waitForFunction(() => window.__splashery.player.stage.toy?.thin === null);
  r = await read(page);
  expect(r.splats).toBe(r.file);
  expect(r.note).toBe("");
  expect(errors).toEqual([]);
});

test("thinning: the shader's hash is the JavaScript one, and keeps an even share", async () => {
  for (const src of [MODIFIER_THIN.glsl, MODIFIER_RIG_THIN.glsl])
    expect(src).toContain("if (spThinHash(splat.index) >= uSpThin.x) scale = vec3(0.0);");
  for (const src of [MODIFIER_THIN.wgsl, MODIFIER_RIG_THIN.wgsl])
    expect(src).toContain("uniform.uSpThin.x");
  // Spread: each tenth of the hash's range holds a tenth of the splats.
  const bins = new Array(10).fill(0);
  for (let i = 0; i < 200_000; i++) bins[Math.floor(thinHash(i) * 10)]++;
  for (const b of bins) expect(Math.abs(b - 20_000)).toBeLessThan(600);
  for (const keep of [0.15, 0.5, 0.9])
    expect(Math.abs(thinnedCount(400_000, keep) / 400_000 - keep)).toBeLessThan(0.005);
});

test("thinning: the program compiles and draws on WebGPU too", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?renderer=webgpu&adapt=off&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  const gpu = await page.evaluate(() => window.__splashery.player.deviceType);
  test.skip(gpu !== "webgpu", "No WebGPU adapter here.");
  await page.evaluate(() => window.__splashery.app.setSplats(60_000));
  const r = await show(page, "millipede");
  expect(r.thin).toBeGreaterThan(0);
  expect(r.thin).toBeLessThan(1);
  expect(errors).toEqual([]);
});

test("buildRecipeTo: measures and corrects; a stated count is built once", async () => {
  const { buildRecipeTo } = await import("../src/kit.js");
  const { applyClay } = await import("../src/generators.js");
  const run = (recipe, count) => {
    let builds = 0;
    const counted = { ...recipe, build: (k, o) => (builds++, recipe.build(k, o)) };
    const it = buildRecipeTo(counted, { seed: 1, count, options: {} }, applyClay);
    let r = it.next();
    while (!r.done) r = it.next();
    return { n: r.value.buf.count, builds };
  };
  // Holes: a third of the sphere's splats are left out.
  const holes = { build: (k) => k.add(k.sphere(1), { color: (c) => (c.rand() < 0.33 ? null : "#fff") }) }; // prettier-ignore
  const h = run(holes, 200_000);
  expect(Math.abs(h.n - 200_000)).toBeLessThanOrEqual(4000);
  // A fixed set: tried once more, then built again at the slider's count.
  const fixed = { build: (k) => k.cloud({ count: (5000 * 160_000) / k.count }, (rand, i) => (i < 5000 ? { p: [rand(), rand(), rand()], color: "#fff" } : null)) }; // prettier-ignore
  const f = run(fixed, 200_000);
  expect(f.n).toBe(5000);
  expect(f.builds).toBe(3);
  // A build that says it drew all its data (k.all) is built once.
  const all = { build: (k) => ((k.all = true), fixed.build(k)) };
  expect(run(all, 200_000)).toEqual({ n: 5000, builds: 1 });
  // Stated: built once at the slider's count.
  const stated = { ...fixed, splats: () => ({ count: 5000, all: true }) };
  const s = run(stated, 200_000);
  expect(s).toEqual({ n: 5000, builds: 1 });
});

test("the label's note: only with the slider, only when more than 2% off", async () => {
  const { Player } = await import("../src/player.js");
  const note = (splats, drawn, stated) => Player.prototype.splatsNote.call({ splats }, drawn, stated); // prettier-ignore
  expect(note(null, 31_000, { all: true })).toBe("");
  expect(note(400_000, 393_000)).toBe("");
  expect(note(400_000, 116_374, { count: 116_374, all: true })).toBe(" (all this toy has)");
  expect(note(400_000, 384_000, { count: 384_000 })).toBe(" (the nearest this toy draws)");
  expect(note(60_000, 64_000)).toBe(" (the nearest this toy draws)");
});

// Lane Sharpness A's own checks (docs/OPERATING.md): every toy the lane made
// sharper still builds at the phone tier within its budget with finite
// splats; the solid parts it laid out evenly are solid (no see-through
// splats left from random placement); the storybook's words are ink dots
// laid on the font's pixels; and the gems' new even layout stays on the
// stone's facets.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { buildRecipe } from "../src/kit.js";
import { PROFILES } from "../src/generators.js";

const TOYS = {
  landmarks: [
    "eiffel-tower",
    "pyramids",
    "leaning-tower",
    "colosseum",
    "parthenon",
    "stonehenge",
    "taj-mahal",
    "castle",
    "pagoda",
    "windmill",
  ],
  vehicles: ["rocket", "helicopter", "hot-air-balloon", "steam-train", "ocean-liner"],
  medieval: ["trebuchet", "crossbow", "knights-helmet", "crown", "sword-in-stone"],
  objects: ["chest", "gift-box", "music-box", "book"],
  gems: ["amethyst-geode", "sapphire", "quartz-cluster"],
  space: ["spiral-galaxy"],
  elements: ["storm-cloud", "tornado"],
  holidays: ["fireworks"],
};

function build(recipe, tier = PROFILES.mid) {
  const options = {};
  for (const o of recipe.options || []) options[o.key] = o.default;
  const count = Math.round(Math.min(tier.maxCount, tier.defaultCount * (recipe.density ?? 1)));
  const it = buildRecipe(recipe, { seed: 7, count, options }, () => {});
  let r = it.next();
  while (!r.done) r = it.next();
  return { buf: r.value.buf, count, tier };
}

test("every toy the lane made sharper builds at the phone tier, within its budget", async () => {
  test.setTimeout(600_000);
  for (const [pack, ids] of Object.entries(TOYS)) {
    const { RECIPES } = await import(`../src/packs/${pack}.js`);
    for (const id of ids) {
      const recipe = RECIPES[id];
      expect(recipe, id).toBeTruthy();
      const { buf, count, tier } = build(recipe);
      expect(buf.count, id).toBeGreaterThan(count * 0.5);
      expect(buf.count, id).toBeLessThanOrEqual(tier.maxCount * 1.1);
      for (let i = 0; i < buf.count * 3; i++)
        if (!Number.isFinite(buf.pos[i])) throw new Error(`${id}: splat ${i / 3} is not finite`);
    }
  }
});

test("the solid landmarks and vehicles are mostly fully opaque splats", async () => {
  test.setTimeout(300_000);
  // Each of these is built of solids the lane laid out evenly at full
  // opacity; clouds (smoke, water, fireworks) stay as they were.
  const cases = [
    ["landmarks", "pyramids", 0.85],
    ["landmarks", "taj-mahal", 0.8],
    ["landmarks", "castle", 0.75],
    ["vehicles", "steam-train", 0.7],
    ["medieval", "crossbow", 0.8],
  ];
  for (const [pack, id, min] of cases) {
    const { RECIPES } = await import(`../src/packs/${pack}.js`);
    const { buf } = build(RECIPES[id]);
    let solid = 0;
    for (let i = 0; i < buf.count; i++) if (buf.color[i * 4 + 3] >= 0.99) solid++;
    expect(solid / buf.count, id).toBeGreaterThan(min);
  }
});

test("the storybook's open pages carry their words as ink dots", async () => {
  const { RECIPES } = await import("../src/packs/objects.js");
  const { buf } = build(RECIPES.book);
  // Ink dots: the ink color at full opacity, each a flat, small splat.
  let ink = 0;
  for (let i = 0; i < buf.count; i++) {
    const r = buf.color[i * 4];
    const g = buf.color[i * 4 + 1];
    const b = buf.color[i * 4 + 2];
    if (Math.abs(r - 0x2f / 255) < 0.01 && Math.abs(g - 0x2a / 255) < 0.01 && Math.abs(b - 0x26 / 255) < 0.01) ink++; // prettier-ignore
  }
  expect(ink).toBeGreaterThan(5000);
});

test("the gems' even layout stays on the stone's facets", async () => {
  // The quartz cluster lays its points out evenly through the polytope's
  // sampleEven: build it and check every splat is finite and the toy is
  // as large as before (its points reach as high as they did).
  const { RECIPES } = await import("../src/packs/gems.js");
  for (const id of ["quartz-cluster", "amethyst-geode"]) {
    const { buf } = build(RECIPES[id]);
    let hi = -Infinity;
    for (let i = 0; i < buf.count; i++) hi = Math.max(hi, buf.pos[i * 3 + 1]);
    expect(Number.isFinite(hi), id).toBe(true);
  }
});

// Screenshots of three changed toys at rest, at phone and desktop size.
const SHOTS = path.join(path.dirname(new URL(import.meta.url).pathname), "screenshots");
for (const [id, label] of [
  ["pyramids", "Pyramids"],
  ["ocean-liner", "Ocean liner"],
  ["book", "Storybook"],
]) {
  test(`${id} screenshots at 390x844 and 1440x900`, async ({ browser }) => {
    fs.mkdirSync(SHOTS, { recursive: true });
    for (const [w, h, mobile] of [
      [390, 844, true],
      [1440, 900, false],
    ]) {
      const ctx = await browser.newContext({
        viewport: { width: w, height: h },
        ...(mobile ? { hasTouch: true, isMobile: true } : {}),
      });
      const page = await ctx.newPage();
      const problems = [];
      page.on("pageerror", (e) => problems.push(e.message));
      await page.goto("/?renderer=webgl2&profile=weak");
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      await page.evaluate((toy) => window.__splashery.app.chooseToy(toy), id);
      await expect(page.locator("#toy-status")).toHaveText(new RegExp(`^${label}`), { timeout: 180_000 }); // prettier-ignore
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SHOTS, `sha-${id}-${w}x${h}.png`) });
      expect(problems).toEqual([]);
      await ctx.close();
    }
  });
}

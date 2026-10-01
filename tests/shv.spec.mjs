// Lane Shelves' own checks (docs/handoff/Shelves.md): the donut is on the
// Food shelf, the tiny planet on Space and the crystal ball on Medieval, with
// the same ids and old links still opening them; the new torus builds in
// every dressing within its budget and its tap moves it and comes back; and
// every planet the tiny planet offers builds.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { TOYS } from "../src/toys.js";
import { buildRecipe } from "../src/kit.js";
import { applyClay, PROFILES, generateSync, normalizeGenerator } from "../src/generators.js";
import { resolveOptions } from "../src/player.js";
import { encodeSceneHash } from "../src/codec.js";
import { RECIPES, torusPose } from "../src/packs/shapes-torus.js";

const SHOTS = "tests/screenshots";
const WEBGL = "/?renderer=webgl2&profile=weak&adapt=off";
const shelf = (cat) => TOYS.filter((t) => t.category === cat).map((t) => t.id);

async function waitForToy(page, label) {
  await expect(page.locator("#toy-status")).toHaveText(new RegExp(`^${label}`), {
    timeout: 180_000,
  });
  await page.waitForTimeout(1200);
}
function watchConsole(page) {
  const problems = [];
  page.on("console", (m) => m.type() === "error" && problems.push(m.text()));
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

test.describe("the shelves", () => {
  test("each moved toy is on its new shelf with the same id, next to its kind", () => {
    const find = (id) => TOYS.find((t) => t.id === id);
    expect(find("donut")).toMatchObject({ category: "food", kind: "procedural" });
    expect(find("planet")).toMatchObject({ category: "space", kind: "procedural" });
    expect(find("crystal-ball")).toMatchObject({ category: "medieval", kind: "kit", pack: "gems" }); // prettier-ignore
    expect(find("torus")).toMatchObject({ category: "shapes", kind: "kit" });
    expect(shelf("shapes")).toEqual(["torus", "blob", "knot"]);
    const next = (cat, a, b) => {
      const ids = shelf(cat);
      expect(ids.indexOf(b), `${b} follows ${a}`).toBe(ids.indexOf(a) + 1);
    };
    next("food", "macarons", "donut");
    next("space", "neptune", "planet");
    next("medieval", "wizards-orb", "crystal-ball");
    expect(shelf("gems")).not.toContain("crystal-ball");
  });
});

test.describe("the torus", () => {
  test("builds in every dressing within its splat budget", async () => {
    const recipe = RECIPES.torus;
    const count = PROFILES.high.defaultCount;
    const dresses = recipe.options[0].choices.map((c) => c.id);
    expect(dresses).toEqual(["plain", "donut", "bagel", "ring"]);
    for (const dress of dresses) {
      const options = resolveOptions(recipe, { dress });
      const it = buildRecipe(recipe, { seed: 1, count, options }, applyClay);
      let r = it.next();
      while (!r.done) r = it.next();
      const ctx = r.value;
      expect(ctx.buf.count, dress).toBeGreaterThan(count * 0.9);
      expect(ctx.buf.count, dress).toBeLessThanOrEqual(count);
      for (let i = 0; i < ctx.buf.count * 3; i++)
        if (!Number.isFinite(ctx.buf.pos[i])) throw new Error(`${dress}: position ${i}`);
    }
  });

  test("its wobble stands it up, stays under a quarter turn and ends at rest", () => {
    for (const dress of ["plain", "donut", "bagel", "ring"]) {
      let most = 0;
      for (let e = 0; e <= 3.6; e += 0.01) {
        const p = torusPose(e, dress);
        const angle = 2 * Math.acos(Math.min(1, Math.abs(p.quat[3])));
        most = Math.max(most, angle);
        expect(angle).toBeLessThan(Math.PI / 2);
        expect([...p.quat, ...p.offset, p.squash].every(Number.isFinite)).toBe(true);
      }
      expect(most).toBeGreaterThan(0.9);
      const end = torusPose(3.6, dress);
      expect(Math.abs(end.quat[3])).toBeCloseTo(1, 5);
      expect(Math.hypot(...end.offset)).toBeLessThan(1e-6);
      expect(Math.abs(end.squash)).toBeLessThan(1e-6);
    }
  });

  test("its tap runs on the page in each dressing", async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto(WEBGL);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("torus"));
    await waitForToy(page, "Torus");
    await expect(page.locator("#toy-action")).toHaveText("Spin it on its edge");
    for (const dress of ["plain", "donut", "bagel", "ring"]) {
      await page.evaluate((d) => window.__splashery.app.setToyOption("dress", d), dress);
      await waitForToy(page, "Torus");
      expect(await page.evaluate(() => window.__splashery.exportScene().toy.options)).toEqual({
        dress,
      });
      await page.click("#toy-action");
      await page.waitForTimeout(700);
      const moving = await page.evaluate(() => window.__splashery.player.motion.state.roll);
      expect(moving, dress).toBeGreaterThan(0);
    }
    expect(problems).toEqual([]);
  });
});

test.describe("the tiny planet", () => {
  test("every planet builds from its own palette", () => {
    const def = TOYS.find((t) => t.id === "planet");
    expect(def.lookLabel).toBe("Planet");
    expect(def.looks.map((l) => l.id)).toEqual(["earth", "mars", "moon", "jupiter", "neptune"]);
    const seen = new Set();
    for (const look of def.looks) {
      const g = normalizeGenerator({ ...def.generator, ...look.generator, count: 30000 });
      expect(g.palette).toBe(look.generator?.palette ?? "planet");
      const ctx = generateSync(g);
      expect(ctx.buf.count, look.id).toBeGreaterThanOrEqual(30000);
      // Plain loops over the splats, one assertion at the end (an expect per splat
      // blocks the worker for minutes).
      let r = 0;
      let gg = 0;
      let b = 0;
      let bad = 0;
      for (let i = 0; i < 30000; i++) {
        if (!Number.isFinite(ctx.buf.pos[i * 3]) || !Number.isFinite(ctx.buf.pos[i * 3 + 1]) || !Number.isFinite(ctx.buf.pos[i * 3 + 2])) bad++; // prettier-ignore
        r += ctx.buf.color[i * 4];
        gg += ctx.buf.color[i * 4 + 1];
        b += ctx.buf.color[i * 4 + 2];
      }
      expect(bad, `${look.id}: splats with non-finite positions`).toBe(0);
      seen.add([r, gg, b].map((v) => Math.round((v / 30000) * 20)).join());
    }
    // Five planets, five different mean colors.
    expect(seen.size).toBe(5);
  });

  test("the Toy tab picks a planet, and the choice is saved in the scene", async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto(WEBGL);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("planet"));
    await waitForToy(page, "Tiny planet");
    for (const look of ["mars", "moon", "jupiter", "neptune", "earth"]) {
      await page.evaluate((v) => window.__splashery.app.setToyOption("look", v), look);
      await waitForToy(page, "Tiny planet");
      const got = await page.evaluate(() => ({
        palette: window.__splashery.player.toyInfo.generator.palette,
        options: window.__splashery.exportScene().toy.options,
        rig: !!window.__splashery.player.toyInfo.rig,
      }));
      expect(got.palette).toBe(look === "earth" ? "planet" : look);
      expect(got.options).toEqual({ look });
      expect(got.rig).toBe(true);
      await expect(page.locator("#toy-action")).toHaveText("Day and night");
    }
    expect(problems).toEqual([]);
  });
});

test.describe("old links", () => {
  const cases = [
    { id: "donut", label: "Donut", version: 2 },
    { id: "planet", label: "Tiny planet", version: 2 },
    { id: "crystal-ball", label: "Crystal ball", version: 2 },
    { id: "donut", label: "Donut", version: 3 },
    { id: "planet", label: "Tiny planet", version: 3 },
    { id: "crystal-ball", label: "Crystal ball", version: 3 },
  ];
  for (const c of cases) {
    test(`a version ${c.version} link to the ${c.id} still opens it`, async ({ page }) => {
      const problems = watchConsole(page);
      const hash = await encodeSceneHash({
        app: "splashery",
        version: c.version,
        seed: 12,
        toy: { kind: "builtin", id: c.id },
        autoplay: { turntable: false, effect: "none" },
      });
      await page.goto(`${WEBGL}#s=${hash}`);
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      await waitForToy(page, c.label);
      const s = await page.evaluate(() => window.__splashery.exportScene());
      expect(s.toy.id).toBe(c.id);
      expect(problems).toEqual([]);
    });
  }

  test("a link to Mars opens the tiny planet as Mars", async ({ page }) => {
    const hash = await encodeSceneHash({
      app: "splashery",
      version: 3,
      seed: 12,
      toy: { kind: "builtin", id: "planet", options: { look: "mars" } },
    });
    await page.goto(`${WEBGL}#s=${hash}`);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await waitForToy(page, "Tiny planet");
    expect(await page.evaluate(() => window.__splashery.player.toyInfo.generator.palette)).toBe(
      "mars",
    );
  });
});

test.describe("screenshots", () => {
  for (const [w, h] of [
    [390, 844],
    [1440, 900],
  ]) {
    test(`the torus and the Shapes shelf at ${w}×${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(WEBGL);
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      await page.click(".chip[data-category='shapes']");
      await page.click(".toy-card[data-toy='torus']");
      await waitForToy(page, "Torus");
      await page.evaluate(() => window.__splashery.app.setToyOption("dress", "donut"));
      await waitForToy(page, "Torus");
      fs.mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: path.join(SHOTS, `shv-torus-${w}x${h}.png`) });
      await page.click(".chip[data-category='space']");
      await page.click(".toy-card[data-toy='planet']");
      await waitForToy(page, "Tiny planet");
      await page.evaluate(() => window.__splashery.app.setToyOption("look", "jupiter"));
      await waitForToy(page, "Tiny planet");
      await page.screenshot({ path: path.join(SHOTS, `shv-planet-${w}x${h}.png`) });
    });
  }
});

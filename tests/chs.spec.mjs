// Lane Chemistry (docs/handoff/Chemistry.md): the periodic table, and the
// atom, molecule, crystal lattice and orbital toys' new choices.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const SHOTS = path.resolve("tests/screenshots");

async function build(pack, id, options = {}, count = 20000) {
  const { buildRecipe } = await import("../src/kit.js");
  const { RECIPES } = await import(`../src/packs/${pack}.js`);
  const r = RECIPES[id];
  const opts = { ...Object.fromEntries((r.options || []).map((o) => [o.key, o.default])), ...options }; // prettier-ignore
  const it = buildRecipe(r, { seed: 7, count, options: opts }, () => {});
  let b = it.next();
  while (!b.done) b = it.next();
  return b.value;
}

test("the element data: 118 elements, NIST's shells, whole atoms", async () => {
  const { ELEMENT_LIST, fillOrder } = await import("../src/chem/atom-model.js");
  expect(ELEMENT_LIST.length).toBe(118);
  ELEMENT_LIST.forEach((e, i) => {
    expect(e.z).toBe(i + 1);
    expect(
      e.shells.reduce((a, b) => a + b, 0),
      e.symbol,
    ).toBe(e.z);
    expect(e.A, e.symbol).toBeGreaterThanOrEqual(e.z);
    // The filling order holds the same electrons, shell by shell.
    const shells = [];
    for (const n of fillOrder(e)) shells[n] = (shells[n] || 0) + 1;
    expect(shells, e.symbol).toEqual(e.shells);
  });
  const el = (s) => ELEMENT_LIST.find((e) => e.symbol === s);
  // Spot checks against the published numbers.
  expect([el("H").A, el("C").A, el("Fe").A, el("U").A, el("Tc").A, el("Og").A]).toEqual([1, 12, 56, 238, 98, 294]); // prettier-ignore
  expect(el("Cr").shells).toEqual([2, 8, 13, 1]);
  expect(el("Cu").shells).toEqual([2, 8, 18, 1]);
  expect(el("Pd").shells).toEqual([2, 8, 18, 18]);
  expect(el("H").line).toBeCloseTo(656.3, 1);
  expect(el("Na").line).toBeCloseTo(589.0, 1);
  expect(el("Cu").line).toBeCloseTo(521.8, 1);
});

test("every element builds on the periodic table with its protons, neutrons and electrons", async () => {
  const { ELEMENT_LIST } = await import("../src/chem/atom-model.js");
  for (const e of ELEMENT_LIST) {
    const ctx = await build("chemistry", "periodic-table", { element: e.symbol }, 8000);
    const d = ctx.kit.data;
    expect([d.element, d.protons, d.neutrons, d.electrons], e.symbol).toEqual([e.symbol, e.z, e.A - e.z, e.z]); // prettier-ignore
    expect(d.shellCounts, e.symbol).toEqual(e.shells);
    // Each nucleon and electron is its own ball: one sphere per piece.
    const balls = ctx.kit.items.filter((it) => it.opts.kind === "fade" && it.opts.channel === 0);
    const electrons = ctx.kit.items.filter((it) => it.opts.kind === "fade" && it.opts.channel === 1 && it.shape.area < 0.2); // prettier-ignore
    expect(balls.length, e.symbol).toBe(e.A);
    expect(electrons.length, e.symbol).toBe(e.z);
  }
});

test("the table is built the same for every element (the same splats outside the atom)", async () => {
  const a = await build("chemistry", "periodic-table", { element: "H" });
  const b = await build("chemistry", "periodic-table", { element: "Og" });
  const tableEnd = (ctx) => ctx.kit.items.find((it) => it.opts.kind === "fade").start;
  expect(tableEnd(a)).toBe(tableEnd(b));
  expect(a.buf.count).toBe(b.buf.count);
  const n = tableEnd(a) * 3;
  let same = true;
  for (let i = 0; i < n; i++) if (Math.abs(a.buf.pos[i] / a.transform.scale - b.buf.pos[i] / b.transform.scale) > 1e-4) same = false; // prettier-ignore
  expect(same).toBe(true);
});

test("a tap on a tile picks its element; on the risen atom, it excites an electron", async () => {
  const { RECIPES } = await import("../src/packs/chemistry.js");
  const r = RECIPES["periodic-table"];
  await build("chemistry", "periodic-table", { element: "C" });
  expect(r.action.at(r.tileAt("Na"), { up: 0 })).toEqual({ options: { element: "Na" }, key: "up" });
  expect(r.action.at(r.tileAt("Na"), { up: 1 })).toEqual({ options: { element: "Na" }, key: "up" });
  expect(r.action.at(r.tileAt("C"), { up: 0 })).toBe("up");
  expect(r.action.at(r.atomAt(), { up: 1 })).toBe("shine");
  expect(r.action.at(r.atomAt(), { up: 0 })).toBe("up");
});

test("the atom toy: 118 elements, every nucleon on request, the default unchanged", async () => {
  const { RECIPES } = await import("../src/packs/atoms.js");
  const { ELEMENT_LIST } = await import("../src/chem/atom-model.js");
  const choices = RECIPES.atom.options.find((o) => o.key === "element").choices;
  expect(choices.map((c) => c.id)).toEqual(ELEMENT_LIST.map((e) => e.symbol));
  for (const e of ELEMENT_LIST) {
    const ctx = await build("atoms", "atom", { element: e.symbol, nucleus: "real" }, 6000);
    const d = ctx.kit.data;
    expect([d.protons, d.neutrons, d.balls, d.electrons], e.symbol).toEqual([e.z, e.A - e.z, e.A, e.z]); // prettier-ignore
  }
});

// Splat counts and a hash of the positions of each toy's default at rest,
// taken from main before this lane (seed 7, 60,000 splats).
const DEFAULTS = {
  atom: { count: 59997, hash: 2097487149 },
  molecule: { count: 60000, hash: -1585417968 },
  "crystal-lattice": { count: 59872, hash: 1677774018 },
  orbital: { count: 60000, hash: -931586209 },
};
test("the atom, molecule, crystal and orbital toys' defaults are unchanged", async () => {
  for (const [id, want] of Object.entries(DEFAULTS)) {
    const ctx = await build("atoms", id, {}, 60000);
    let h = 0;
    for (let i = 0; i < ctx.buf.count * 3; i++) h = (h * 31 + Math.round(ctx.buf.pos[i] * 1e4)) | 0;
    expect({ count: ctx.buf.count, hash: h }, id).toEqual(want);
  }
});

test("every new molecule, crystal and orbital builds, with finite positions", async () => {
  const { RECIPES } = await import("../src/packs/atoms.js");
  const { GALLERY } = await import("../src/chem/gallery.js");
  const { basePair, dnaStrand } = await import("../src/chem/dna.js");
  const { formulaOf } = await import("../src/chem/elements.js");
  // The DNA's formulas (adenine + thymine, guanine + cytosine; four base
  // pairs of the double helix) and its hydrogen bonds.
  expect(formulaOf(basePair("AT").atoms)).toBe("C10H11N7O2");
  expect(formulaOf(basePair("GC").atoms)).toBe("C9H10N8O2");
  expect(basePair("AT").hbonds.length).toBe(2);
  expect(basePair("GC").hbonds.length).toBe(3);
  expect(dnaStrand().hbonds.length).toBe(10);
  const sets = {
    molecule: [...Object.keys(GALLERY), "at-pair", "gc-pair", "dna"],
    "crystal-lattice": ["iron", "copper", "cesium-chloride", "fluorite", "perovskite", "quartz", "graphene"], // prettier-ignore
    orbital: RECIPES.orbital.options[0].choices.map((c) => c.id),
  };
  expect(sets.orbital.length).toBe(30);
  for (const [id, list] of Object.entries(sets)) {
    const key = RECIPES[id].options[0].key;
    for (const v of list) {
      const ctx = await build("atoms", id, { [key]: v }, 8000);
      expect(ctx.buf.count, `${id} ${v}`).toBeGreaterThan(7000);
      expect(ctx.buf.pos.slice(0, ctx.buf.count * 3).every(Number.isFinite), `${id} ${v}`).toBe(
        true,
      );
    }
  }
});

test.describe("the periodic table in the app", () => {
  const APP = "/?renderer=webgl2&adapt=off&profile=low";

  async function open(page) {
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("periodic-table"));
    await page.waitForFunction(() => window.__splashery.player.toyInfo?.id === "periodic-table", null, { timeout: 120_000 }); // prettier-ignore
  }

  test("a tap on a tile builds that element and raises its atom", async ({ page }) => {
    await open(page);
    const r = await page.evaluate(async () => {
      const { player } = window.__splashery;
      const recipe = player.toyInfo.recipe;
      const tf = player.motion.ctx.transform;
      const world = recipe.tileAt("Na").map((v, i) => (v - tf.center[i]) * tf.scale);
      player.act(world);
      const t0 = performance.now();
      // The new toy's tap fires once the rebuild has finished.
      while (
        (player.toyInfo.options?.element !== "Na" || player.motion.targets.up !== 1) &&
        performance.now() - t0 < 120_000
      )
        // prettier-ignore
        await new Promise((ok) => setTimeout(ok, 100));
      return {
        element: player.scene.toy.options.element,
        data: player.motion.ctx.kit.data,
        up: player.motion.targets.up,
      };
    });
    expect(r.element).toBe("Na");
    expect([r.data.protons, r.data.neutrons, r.data.electrons]).toEqual([11, 12, 11]);
    expect(r.up).toBe(1);
  });

  for (const [w, h] of [
    [390, 844],
    [1440, 900],
  ]) {
    test(`screenshots at ${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await open(page);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SHOTS, `chs-table-${w}x${h}.png`) });
      // The atom risen and built (the toggle snapped up).
      await page.evaluate(async () => {
        const { app, player } = window.__splashery;
        await app.setToyOption("element", "Fe");
        player.motion.setControl("up", 1, { snap: true });
        player.stage.requestRender();
      });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(SHOTS, `chs-atom-${w}x${h}.png`) });
      expect(fs.existsSync(path.join(SHOTS, `chs-atom-${w}x${h}.png`))).toBe(true);
    });
  }
});

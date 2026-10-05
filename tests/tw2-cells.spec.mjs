// Lane Tiny world r2: the cell toys (cell division, apoptosis, phagocytosis)
// and the lane's screenshots (tw2-*.png).

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { buildRecipe } from "../src/kit.js";
import { RECIPES, daughterPoint } from "../src/packs/tiny-r2.js";

const build = (id) => {
  const r = RECIPES[id];
  const it = buildRecipe(r, { seed: 5, count: 30000, options: {} }, () => {});
  let b = it.next();
  while (!b.done) b = it.next();
  return { r, kit: b.value.kit };
};

test("each cell toy builds and drives with finite numbers through its whole tap", () => {
  for (const id of ["mitosis", "apoptosis", "phagocytosis"]) {
    const { r, kit } = build(id);
    const ease = r.controls[0].ease;
    for (let v = 1; v >= 0; v -= 0.005) {
      const out = { parts: {}, cues: [] };
      r.drive(v * ease, { go: v }, out, { time: 1, R: 1, data: kit.data });
      const nums = [...out.morph];
      for (const p of Object.values(out.parts))
        nums.push(...(p.offset || []), p.visible ?? 1, p.scale ?? 1);
      for (const tk of out.tokens)
        if (tk) nums.push(...(tk.offset || []), ...(tk.quat || []), tk.visible ?? 1);
      expect(nums.every(Number.isFinite), `${id} at ${v.toFixed(3)}`).toBe(true);
    }
  }
});

test("cell division: the cell pinches into two cells of half its volume, the furrow at the middle", () => {
  const R = 3;
  const RD = R / Math.cbrt(2);
  // Two daughters together have the mother's volume.
  expect((2 * RD ** 3) / R ** 3).toBeCloseTo(1, 6);
  // Every point of the membrane lands on one of the two daughter spheres
  // (centers at ±RD, touching at the furrow).
  for (let i = 0; i < 200; i++) {
    const z = 1 - (2 * (i + 0.5)) / 200;
    const a = i * 2.399963;
    const r = Math.sqrt(1 - z * z);
    const p = [R * z, R * r * Math.cos(a), R * r * Math.sin(a)];
    const q = daughterPoint(p);
    const c = [Math.sign(p[0]) * RD, 0, 0];
    expect(Math.hypot(q[0] - c[0], q[1] - c[1], q[2] - c[2])).toBeCloseTo(RD, 6);
    expect(Math.sign(q[0])).toBe(Math.sign(p[0]));
  }
  // The equator closes to the furrow; the poles go to the far ends.
  const eq = daughterPoint([1e-9, R, 0]);
  expect(Math.hypot(...eq)).toBeLessThan(1e-6);
  expect(daughterPoint([R, 0, 0])[0]).toBeCloseTo(2 * RD, 6);
});

const SHOTS = path.resolve("tests/screenshots");
for (const [id, label, wait] of [
  ["dna-to-protein", "DNA to protein", 14000],
  ["mitosis", "Cell division", 6000],
  ["apoptosis", "Apoptosis", 7500],
  ["phagocytosis", "Phagocytosis", 3500],
]) {
  test(`${id} mid-tap screenshots at 390x844 and 1440x900`, async ({ browser }) => {
    test.setTimeout(300_000);
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
      await page.goto("/?renderer=webgl2&profile=weak&labs=1");
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      await page.evaluate((toy) => window.__splashery.app.chooseToy(toy), id);
      await expect(page.locator("#toy-status")).toHaveText(new RegExp(`^${label}`), { timeout: 180_000 }); // prettier-ignore
      await page.waitForTimeout(1500);
      await page.evaluate(() => window.__splashery.player.act(null));
      await page.waitForTimeout(wait);
      await page.screenshot({ path: path.join(SHOTS, `tw2-${id}-${w}x${h}.png`) });
      expect(problems).toEqual([]);
      await ctx.close();
    }
  });
}

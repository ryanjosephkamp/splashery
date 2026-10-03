// Lane Fix3 (docs/handoff/Fix3.md): the banana's stalks and the ocean
// wave's collapse. tests/taps.spec.mjs already plays each tap through;
// these check what is particular to the fixes.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

async function built(pack, id, options = {}) {
  const { buildRecipe } = await import("../src/kit.js");
  const { RECIPES } = await import(`../src/packs/${pack}.js`);
  const r = RECIPES[id];
  const opts = { ...Object.fromEntries((r.options || []).map((o) => [o.key, o.default])), ...options }; // prettier-ignore
  const it = buildRecipe(r, { seed: 5, count: 8000, options: opts }, () => {});
  let b = it.next();
  while (!b.done) b = it.next();
  return { r, kit: b.value.kit };
}
const frame = (r, t, c, data) => {
  const out = { parts: {}, glow: [0, 0, 0, 0], cues: [], fx: {}, tokens: null };
  r.drive(t, c, out, { time: t, R: 1, tap: null, data });
  return out;
};

test("every piece of the bananas rides on a banana, with no crown left behind", async () => {
  const { kit } = await built("food", "banana");
  const { KINDS } = await import("../src/effects.js");
  const { anim, count } = kit.buf;
  // Nothing is left standing still when the bunch pulls apart: every
  // splat belongs to one of the bananas' pieces (since lane Fix7, 14 each:
  // the stub, the fruit, and an outer and inner peel on each strip's two
  // hinges).
  const pieces = new Set(
    kit.data.bananas.flatMap((bn) => [
      bn.body,
      bn.fruit,
      ...bn.strips.flatMap((st) => [st.a, st.b, st.ia, st.ib]),
    ]),
  );
  expect(pieces.size).toBe(kit.data.bananas.length * 14);
  for (let i = 0; i < count; i++) {
    expect(anim[i * 4 + 1]).toBe(KINDS.token);
    expect(pieces.has(anim[i * 4 + 2])).toBe(true);
  }
});

test("the ocean wave collapses smoothly, without stops or jumps", async () => {
  const { r, kit } = await built("elements", "ocean-wave");
  const ctl = r.controls.find((x) => x.key === r.action.key);
  const at = (s) => frame(r, 2, { [ctl.key]: 1 - s / ctl.ease }, kit.data);
  const pos = (s) =>
    at(s)
      .tokens.slice(0, 38)
      .map((tk) => tk.offset);
  const dt = 1 / 120;
  const steps = [];
  let prev = pos(0);
  for (let s = dt; s <= 2.2 + 1e-9; s += dt) {
    const p = pos(s);
    steps.push(Math.max(...p.map((o, i) => Math.hypot(o[0] - prev[i][0], o[1] - prev[i][1]))));
    prev = p;
  }
  // No control point jumps: every step is small and close to its
  // neighbours' (the speed changes smoothly, and never stops at a key
  // while the wave falls).
  for (let i = 1; i < steps.length; i++) {
    expect(steps[i]).toBeLessThan(0.02);
    expect(Math.abs(steps[i] - steps[i - 1])).toBeLessThan(0.002);
  }
  const hit = Math.round(0.8 / dt) - 1;
  expect(steps[hit]).toBeGreaterThan(0.004);
  // It ends at the flat water the rebuild starts from, at rest there.
  const a = pos(2.2 - 1e-6);
  const b = pos(2.2 + 1e-6);
  a.forEach((o, i) => expect(Math.hypot(o[0] - b[i][0], o[1] - b[i][1])).toBeLessThan(1e-3));
  // No white sheet shows before the lip lands: the white water froths up
  // from the plunge on channel 0, which is 0 until then.
  expect(at(0.7).morph[0]).toBe(0);
  expect(at(1.5).morph[0]).toBeGreaterThan(0.9);
  expect(at(2.5).morph[0]).toBe(0);
});

// The lane's screenshots (fix3-*.png): each toy in the middle of its tap,
// on a phone and on a desktop.
const SHOTS = path.resolve("tests/screenshots");
for (const [id, label, wait] of [
  ["banana", "Bananas", 2000],
  ["ocean-wave", "Ocean wave", 1300],
]) {
  test(`${id} mid-tap screenshots at 390x844 and 1440x900`, async ({ browser }) => {
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
      await page.waitForTimeout(1500);
      await page.evaluate(() => window.__splashery.player.act(null));
      await page.waitForTimeout(wait);
      await page.screenshot({ path: path.join(SHOTS, `fix3-${id}-${w}x${h}.png`) });
      expect(problems).toEqual([]);
      await ctx.close();
    }
  });
}

// Lane E5 (food): checks for the 17 new tap effects that tests/taps.spec.mjs
// does not cover. That file plays every finished toy's tap with its default
// options; here every style of each E5 toy is played too, the twins must
// act and sound different, and the apple's bite stays until the next tap.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { RECIPES } from "../src/packs/food.js";
import { RIGS } from "../src/rigs.js";
import { TOY_SOUNDS } from "../src/toy-sounds.js";
import { buildRecipe } from "../src/kit.js";

const E5 = ["watermelon", "cupcake", "lollipop", "candy-cane", "macarons", "pretzel", "croissant", "sushi", "taco", "apple", "banana", "orange", "kiwi", "pineapple", "cherries", "grapes", "avocado"]; // prettier-ignore

function build(r, options) {
  const it = buildRecipe(r, { seed: 5, count: 6000, options }, () => {});
  let b = it.next();
  while (!b.done) b = it.next();
  return b.value.kit;
}

// Plays a toy's tap frame by frame (a pulse twice; a toggle on, then off)
// and returns every frame's numbers and the last moment of each effect.
function play(r, data) {
  const ctl = r.controls.find((x) => x.key === r.action.key);
  const c = Object.fromEntries(r.controls.map((x) => [x.key, x.default ?? 0]));
  const blank = () => ({ parts: {}, glow: [1, 1, 1, 0], amount: 1, grow: 1, cues: [], fx: {}, tokens: null }); // prettier-ignore
  let clock = 1.5;
  let n = 0;
  const frames = [];
  const frame = (v) => {
    const out = blank();
    c[ctl.key] = v;
    r.drive(clock, c, out, { time: clock, R: 1, tap: n ? { n, point: null, key: ctl.key } : null, data }); // prettier-ignore
    frames.push({ v, n, out });
    return out;
  };
  const step = 0.01 * (ctl.ease ?? 0.8);
  const ends = [];
  frame(0);
  for (const tap of ctl.type === "toggle" ? [1] : [1, 2]) {
    n = tap;
    if (ctl.type === "toggle") {
      for (let v = 0.01; v < 0.9999; v += 0.01) ((clock += step), frame(v));
      for (let i = 0; i < 50; i++) ((clock += step), frame(1));
      n = 2;
    }
    for (let v = 1; v > 0.001; v -= 0.01) ((clock += step), frame(v));
    ends.push([frame(0.0004), frame(0)]);
  }
  return { ctl, frames, ends };
}

const numbers = (out) => {
  const nums = [...(out.morph || [])];
  for (const pd of Object.values(out.parts))
    nums.push(pd.angle, pd.visible, pd.scale, ...(pd.offset || []), ...(pd.quat || []));
  for (const tk of out.tokens || []) nums.push(...(tk?.offset || []), ...(tk?.quat || []), tk?.visible); // prettier-ignore
  return nums.filter((x) => x !== undefined);
};
const shown = (x) => (x?.visible ?? 1) * (x?.scale ?? 1);
const far = (a, b) => Math.hypot(...[0, 1, 2].map((i) => (a?.offset?.[i] ?? 0) - (b?.offset?.[i] ?? 0))); // prettier-ignore

test("every E5 toy has a tap of its own: a pulse or a toggle, and a sound", () => {
  for (const id of E5) {
    const r = RECIPES[id];
    const ctl = r.controls?.find((x) => x.key === r.action?.key);
    expect(["pulse", "toggle"], id).toContain(ctl?.type);
    expect(typeof r.drive, id).toBe("function");
    expect(TOY_SOUNDS[id], id).toBeTruthy();
  }
});

test("every style of every E5 toy plays its tap and ends where it rests", () => {
  const failures = [];
  for (const id of E5) {
    const r = RECIPES[id];
    const defaults = Object.fromEntries((r.options || []).map((o) => [o.key, o.default]));
    // Each choice of each select option, one at a time.
    const variants = [defaults];
    for (const o of r.options || [])
      if (o.type === "select")
        for (const ch of o.choices) if (ch.id !== o.default) variants.push({ ...defaults, [o.key]: ch.id }); // prettier-ignore
    for (const options of variants) {
      const name = `${id} ${JSON.stringify(options)}`;
      const kit = build(r, options);
      const { frames, ends } = play(r, kit.data);
      if (frames.some((f) => numbers(f.out).some((x) => !Number.isFinite(x))))
        failures.push(`${name}: a number is not finite`);
      ends.forEach(([last, rest], e) => {
        for (const [p, pd] of Object.entries(last.parts)) {
          const q = rest.parts[p];
          if (Math.abs(shown(pd) - shown(q)) >= 0.05) failures.push(`${name}: part ${p} shown differently at the end of tap ${e + 1}`); // prettier-ignore
          else if (shown(pd) > 0.05 && far(pd, q) >= 0.03) failures.push(`${name}: part ${p} is off its place at the end of tap ${e + 1}`); // prettier-ignore
        }
        (last.tokens || []).forEach((tk, i) => {
          const q = rest.tokens?.[i];
          if (Math.abs(shown(tk) - shown(q)) >= 0.05) failures.push(`${name}: piece ${i} shown differently at the end of tap ${e + 1}`); // prettier-ignore
          else if (shown(tk) > 0.05 && far(tk, q) >= 0.03) failures.push(`${name}: piece ${i} is off its place at the end of tap ${e + 1}`); // prettier-ignore
        });
        for (const m of rest.morph || []) if (Math.abs(m) >= 0.05) failures.push(`${name}: a channel is ${m} at rest`); // prettier-ignore
      });
    }
  }
  expect(failures).toEqual([]);
});

test("each E5 effect moves: something is well away from its rest place mid-effect", () => {
  for (const id of E5) {
    const r = RECIPES[id];
    const options = Object.fromEntries((r.options || []).map((o) => [o.key, o.default]));
    const kit = build(r, options);
    const { frames } = play(r, kit.data);
    const rest = frames[0].out;
    let most = 0;
    for (const f of frames) {
      for (const [p, pd] of Object.entries(f.out.parts)) {
        most = Math.max(most, far(pd, rest.parts[p]), Math.abs(shown(pd) - shown(rest.parts[p])));
        if (pd.quat) most = Math.max(most, 2 * Math.acos(Math.min(1, Math.abs(pd.quat[3]))) * 0.5);
        if (pd.angle !== undefined) most = Math.max(most, Math.abs(pd.angle - (rest.parts[p]?.angle ?? 0)) * 0.1); // prettier-ignore
      }
      (f.out.tokens || []).forEach((tk, i) => {
        most = Math.max(most, far(tk, rest.tokens?.[i]));
        if (tk?.quat) most = Math.max(most, 2 * Math.acos(Math.min(1, Math.abs(tk.quat[3]))) * 0.5);
      });
      for (const m of f.out.morph || []) most = Math.max(most, Math.abs(m));
    }
    expect(most, id).toBeGreaterThan(0.2);
  }
});

test("the twins act and sound different from the scans", () => {
  // The kit croissant opens like a roll; the real croissant scan tears in half.
  expect(RECIPES.croissant.action.label).not.toBe(RIGS["croissant-real"].action.label);
  expect(JSON.stringify(TOY_SOUNDS.croissant)).not.toBe(JSON.stringify(TOY_SOUNDS["croissant-real"])); // prettier-ignore
  // The bunch of grapes drops grapes; the grape scan peels.
  expect(RECIPES.grapes.action.label).not.toBe(RIGS.grape.action.label);
  expect(JSON.stringify(TOY_SOUNDS.grapes)).not.toBe(JSON.stringify(TOY_SOUNDS.grape));
});

test("the apple stays bitten until the next tap, which brings out the worm", () => {
  const r = RECIPES.apple;
  const kit = build(r, { variety: "red" });
  const { frames } = play(r, kit.data);
  const wormOut = (f) => (f.out.tokens || []).some((tk) => tk.visible > 0);
  const on = frames.filter((f) => f.n === 1);
  const off = frames.filter((f) => f.n === 2 && f.v < 1 && f.v > 0.001);
  // Bitten (the chunk gone on channel 0) all the while it is on, no worm.
  expect(on.filter((f) => f.v >= 0.1).every((f) => f.out.morph[0] > 0.99)).toBe(true);
  expect(on.some(wormOut)).toBe(false);
  // On the way back the worm comes out, then the apple is whole again.
  expect(off.some(wormOut)).toBe(true);
  expect(frames[frames.length - 1].out.morph[0]).toBeLessThan(0.01);
});

// The lane's screenshots (e5-*.png): a toy in the middle of its tap, on a
// phone and on a desktop.
const SHOTS = path.resolve("tests/screenshots");
for (const [id, label, wait] of [
  ["watermelon", "Watermelon", 1900],
  ["orange", "Orange", 900],
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
      await page.screenshot({ path: path.join(SHOTS, `e5-${id}-${w}x${h}.png`) });
      expect(problems).toEqual([]);
      await ctx.close();
    }
  });
}

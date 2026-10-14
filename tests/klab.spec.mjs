// Lane Kit lab (docs/handoff/KitLab.md): the splat equation toy's Moments
// choice (12 to 15 copies of t, docs/lab/MOMENTS.md) and its 240-character
// fields (docs/lab/EQUATION-FIELDS.md). No browser.

import { test, expect } from "@playwright/test";
import {
  RECIPES,
  MOMENTS,
  FIELD_MAX,
  readExpr,
  compileProgram,
} from "../src/packs/splat-equation.js";
import { buildRecipe } from "../src/kit.js";
import { applyClay } from "../src/generators.js";
import { KINDS, MORPH_RANGE } from "../src/effects.js";
import { readCurve, readSurface, MAX_LENGTH } from "../src/equation.js";
import { encodeSceneHash, decodeSceneHash } from "../src/codec.js";
import { createScene } from "../src/state.js";

const recipe = RECIPES["splat-equation"];

function build(options, count = 120000) {
  const it = buildRecipe(recipe, { seed: 7, count, options }, applyClay);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

// How far copy 0's splats dip toward the axis halfway to copy 1, for the
// sphere (it turns about y: u + t), in % of their distance from it.
function dip(ctx) {
  const { pos, anim, count } = ctx.buf;
  const dec = (q) => ((q - 2048) * MORPH_RANGE) / 2048;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < count; i++) {
    cx += pos[i * 3];
    cz += pos[i * 3 + 2];
  }
  cx /= count;
  cz /= count;
  const rows = [];
  let most = 0;
  for (let i = 0; i < count; i++) {
    if (anim[i * 4 + 1] !== KINDS.morph || anim[i * 4] % 16 !== 1) continue;
    const z = anim[i * 4 + 2];
    const dx = dec(Math.floor(z / 4096));
    const dz = dec(anim[i * 4 + 3] % 4096);
    const x = pos[i * 3] - cx;
    const y = pos[i * 3 + 2] - cz;
    const r0 = Math.hypot(x, y);
    rows.push([r0, Math.hypot(x + dx / 2, y + dz / 2)]);
    most = Math.max(most, r0);
  }
  let s = 0;
  let n = 0;
  for (const [r0, r1] of rows)
    if (r0 > 0.5 * most) {
      s += 1 - r1 / r0;
      n++;
    }
  return (100 * s) / n;
}

test.describe("Moments of t", () => {
  test("12 stays the default; 13 to 15 build that many copies", () => {
    expect(MOMENTS).toEqual([12, 13, 14, 15]);
    const opt = recipe.options.find((o) => o.key === "moments");
    expect(opt.default).toBe("12");
    // Old links carry no moments: twelve copies, as before.
    expect(build({ preset: "torus" }).kit.data.equation.copies).toBe(12);
    for (const m of MOMENTS)
      expect(build({ preset: "torus", moments: String(m) }).kit.data.equation.copies).toBe(m);
    // A program without t keeps one copy whatever the choice.
    const still = {
      preset: "custom",
      x: "cos u",
      y: "sin u",
      z: "0",
      u: "0 .. 2pi",
      moments: "15",
    };
    expect(build(still).kit.data.equation.copies).toBe(1);
    // Anything else falls back to 12.
    expect(build({ preset: "torus", moments: "16" }).kit.data.equation.copies).toBe(12);
  });

  test("a turning shape dips less with more moments", () => {
    const d12 = dip(build({ preset: "sphere", moments: "12" }));
    const d15 = dip(build({ preset: "sphere", moments: "15" }));
    // 1 − cos(π/n): 3.41% at 12, 2.19% at 15.
    expect(d12).toBeCloseTo(100 * (1 - Math.cos(Math.PI / 12)), 1);
    expect(d15).toBeCloseTo(100 * (1 - Math.cos(Math.PI / 15)), 1);
  });

  test("on the weakest tier the copies share the budget", () => {
    // Fine asks for four times the program's count: the budget decides.
    for (const m of MOMENTS) {
      const ctx = build({ preset: "torus", splats: "fine", moments: String(m) });
      expect(ctx.buf.count).toBeLessThanOrEqual(120000);
      let first = 0;
      for (let i = 0; i < ctx.buf.count; i++) if (ctx.buf.anim[i * 4] % 16 === 1) first++;
      expect(first).toBeLessThanOrEqual(Math.floor((120000 * 0.98) / m));
    }
  });
});

test.describe("240-character fields", () => {
  test("the toy reads up to 240 characters; the plotters keep 120", () => {
    expect(FIELD_MAX).toBe(240);
    expect(MAX_LENGTH).toBe(120);
    const long = Array.from({ length: 40 }, () => "u+1").join("+");
    expect(long.length).toBeGreaterThan(120);
    expect(long.length).toBeLessThanOrEqual(240);
    expect(readExpr(long).f({ θ: 1, y: 0, t: 0 })).toBe(80);
    expect(() => readExpr("u".repeat(241))).toThrow(/over 240 characters/);
    expect(() => readCurve("y = " + "x+".repeat(80) + "x")).toThrow(/over 120 characters/);
    expect(() => readSurface("z = " + "x+".repeat(80) + "x")).toThrow(/over 120 characters/);
  });

  test("the other guards stay: depth at 32, pieces at 400", () => {
    expect(() => readExpr("(".repeat(33) + "u" + ")".repeat(33))).toThrow(/brackets inside/);
    // 200 letters are 399 pieces (each letter, and a × between each two).
    expect(() => readExpr("u".repeat(200))).not.toThrow();
    expect(() => readExpr("u".repeat(201))).toThrow(/too long/);
  });

  test("a link with every field at 240 characters comes back whole", async () => {
    const field = Array.from({ length: 30 }, (_, i) => `${i % 7}.5sin(u+${i})`)
      .join("+")
      .slice(0, 240)
      .replace(/[+]$/, "");
    const opts = { preset: "custom", x: field, y: field, z: field, u: "0 .. 2pi", v: "0 .. pi" };
    for (const k of ["hue", "size"]) opts[k] = field;
    opts.count = "4000";
    expect(() => compileProgram(opts)).not.toThrow();
    const scene = createScene();
    scene.toy = { kind: "builtin", id: "splat-equation", options: opts };
    const hash = await encodeSceneHash(scene);
    const back = await decodeSceneHash(hash.replace(/^#?s=/, ""));
    expect(back.toy.options.x).toBe(field);
    expect(back.toy.options.hue).toBe(field);
  });
});

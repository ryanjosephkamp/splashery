// Lane Math r2: checks for the new attractors, the 4D shapes, the Möbius
// riders, the Mandelbulb variants and longer Fourier text (Node-side), then
// the new toys in the app, with mt2-* screenshots.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  RECIPES,
  rk4,
  ATTRACTORS,
  attractorInfo,
  polytope,
  fourierSet,
} from "../src/packs/maths.js";
import { buildRecipe } from "../src/kit.js";

const build = (id, opts = {}, count = 20000) => {
  const r = RECIPES[id];
  const options = { ...Object.fromEntries((r.options || []).map((o) => [o.key, o.default])), ...opts }; // prettier-ignore
  const it = buildRecipe(r, { seed: 3, count, options }, () => {});
  let b = it.next();
  while (!b.done) b = it.next();
  const { buf, data } = b.value.kit;
  let bad = 0;
  for (let i = 0; i < buf.count * 3; i++) if (!Number.isFinite(buf.pos[i])) bad++;
  expect(bad, id).toBe(0);
  return { r, buf, data };
};
const blank = () => ({ parts: {}, tokens: null, morph: null, cues: [], glow: [1, 1, 1, 0] });
const finiteOut = (out, what) => {
  const nums = (out.tokens || [])
    .filter(Boolean)
    .flatMap((tk) => [...(tk.offset || []), ...(tk.quat || []), ...(tk.base || [])]);
  expect(nums.filter((v) => !Number.isFinite(v)).length, what).toBe(0);
};

// ---- Attractors -----------------------------------------------------------------

test("RK4 is fourth order: halving the step cuts the error about sixteen times", () => {
  // dp/dt = (−y, x): an exact circle.
  const f = ([x, y, z]) => [-y, x, 0];
  const err = (h) => {
    let p = [1, 0, 0];
    const n = Math.round(1 / h);
    for (let i = 0; i < n; i++) p = rk4(f, p, h);
    return Math.hypot(p[0] - Math.cos(1), p[1] - Math.sin(1));
  };
  const ratio = err(0.1) / err(0.05);
  expect(ratio).toBeGreaterThan(14);
  expect(ratio).toBeLessThan(18);
});

test("each attractor's equations are the published ones", () => {
  const close = (a, b) => a.forEach((v, i) => expect(Math.abs(v - b[i])).toBeLessThan(1e-12));
  const p = [0.3, -0.7, 1.1];
  const [x, y, z] = p;
  close(ATTRACTORS["rossler-attractor"].f(p), [-y - z, x + 0.2 * y, 0.2 + z * (x - 5.7)]);
  const b = 0.208186;
  close(ATTRACTORS["thomas-attractor"].f(p), [Math.sin(y) - b * x, Math.sin(z) - b * y, Math.sin(x) - b * z]); // prettier-ignore
  close(ATTRACTORS["aizawa-attractor"].f(p), [
    (z - 0.7) * x - 3.5 * y,
    3.5 * x + (z - 0.7) * y,
    0.6 + 0.95 * z - z ** 3 / 3 - (x * x + y * y) * (1 + 0.25 * z) + 0.1 * z * x ** 3,
  ]);
});

test("the attractors' paths stay bounded and match the known shapes", () => {
  for (const id of Object.keys(ATTRACTORS)) {
    const I = attractorInfo(id);
    expect(I.pts.length).toBeGreaterThan(5000);
    expect(Math.max(...I.pts.map((q) => Math.max(...q.map(Math.abs))))).toBeLessThanOrEqual(1.0001);
    // show and back undo each other.
    const s = [0.4, -1.3, 2.2];
    const t = I.back(I.show(s));
    s.forEach((v, i) => expect(Math.abs(v - t[i])).toBeLessThan(1e-9));
  }
  // Rössler (a = b = 0.2, c = 5.7): z reaches about 20 and x spans about
  // −9 to 12 (its well-known extent).
  const R = attractorInfo("rossler-attractor");
  const raw = R.pts.map((q) => R.back(q));
  const zmax = Math.max(...raw.map((p) => p[2]));
  expect(zmax).toBeGreaterThan(15);
  expect(zmax).toBeLessThan(26);
  // Thomas: symmetric under the cyclic swap x → y → z, so each axis spans
  // about the same range.
  const T = attractorInfo("thomas-attractor");
  const traw = T.pts.map((q) => T.back(q));
  const spans = [0, 1, 2].map((j) => Math.max(...traw.map((p) => p[j])) - Math.min(...traw.map((p) => p[j]))); // prettier-ignore
  for (const s of spans) expect(Math.abs(s - spans[0]) / spans[0]).toBeLessThan(0.15);
});

test("the tracers move the same at any frame rate", () => {
  for (const id of Object.keys(ATTRACTORS)) {
    const run = (fps) => {
      const { r, data } = build(id, {}, 6000);
      const c = { glow: 0.6, drop: 0 };
      let out;
      for (let i = 0; i <= 2 * fps; i++) {
        out = blank();
        r.drive(i / fps, c, out, { data, tap: null });
      }
      return out.tokens[0].offset;
    };
    const a = run(30);
    const b = run(60);
    const c = run(144);
    expect(Math.hypot(...a.map((v, i) => v - b[i])), id).toBeLessThan(0.02);
    expect(Math.hypot(...a.map((v, i) => v - c[i])), id).toBeLessThan(0.02);
  }
});

test("a tap drops a tracer where it lands; a fifth replaces the oldest", () => {
  const { r, data } = build("rossler-attractor", {}, 6000);
  const c = { glow: 0.6, drop: 0 };
  let out = blank();
  r.drive(0, c, out, { data, tap: null });
  expect(out.parts.tr0.visible).toBe(1);
  expect(out.parts.tr1.visible).toBe(0);
  out = blank();
  r.drive(0.02, c, out, { data, tap: { n: 1, point: [0.2, -0.5, 0.1] } });
  expect(out.parts.tr1.visible).toBe(1);
  // The new head is at the tapped point.
  const head = out.tokens[12].offset;
  expect(Math.hypot(head[0] - 0.2, head[1] + 0.5, head[2] - 0.1)).toBeLessThan(0.05);
  for (let n = 2; n <= 5; n++) {
    out = blank();
    r.drive(0.02 * (n + 1), c, out, { data, tap: { n, point: null } });
  }
  for (let i = 0; i < 4; i++) expect(out.parts[`tr${i}`].visible).toBe(1);
  finiteOut(out, "rossler");
  // A tap far outside is kept near the attractor.
  out = blank();
  r.drive(1, c, out, { data, tap: { n: 9, point: [50, -80, 1e9] } });
  finiteOut(out, "rossler far");
});

// ---- 4D shapes ------------------------------------------------------------------

test("the 4D shapes have the right corners, edges and degrees, all edges equal", () => {
  const want = {
    "five-cell": [5, 10, 4],
    "sixteen-cell": [8, 24, 6],
    "twenty-four-cell": [24, 96, 8],
  };
  const d4 = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
  for (const [id, [V, E, deg]] of Object.entries(want)) {
    const P = polytope(id);
    expect(P.verts.length, id).toBe(V);
    expect(P.edges.length, id).toBe(E);
    const degree = new Array(V).fill(0);
    for (const [i, j] of P.edges) (degree[i]++, degree[j]++);
    expect(new Set(degree), id).toEqual(new Set([deg]));
    const L = P.edges.map(([i, j]) => d4(P.verts[i], P.verts[j]));
    expect(Math.max(...L.map((l) => Math.abs(l - L[0])))).toBeLessThan(1e-9);
    expect(Math.max(...P.verts.map((v) => Math.abs(Math.hypot(...v) - 1)))).toBeLessThan(1e-9);
  }
  for (let p = 3; p <= 6; p++)
    for (let q = 3; q <= 6; q++) {
      const P = polytope("duoprism", { p, q });
      expect(P.verts.length).toBe(p * q);
      expect(P.edges.length).toBe(p === 4 && q === 4 ? 32 : 2 * p * q);
    }
});

test("the 4D shapes roll a whole turn and end where they rest", () => {
  for (const [id, opts] of [
    ["five-cell"],
    ["sixteen-cell"],
    ["twenty-four-cell"],
    ["duoprism", { p: 6, q: 6 }],
  ]) {
    const { r, data } = build(id, opts || {});
    const rest = blank();
    r.drive(2, { turn: 0.85, roll: 0 }, rest, { data });
    const mid = blank();
    r.drive(2, { turn: 0.85, roll: 0.5 }, mid, { data });
    finiteOut(mid, id);
    const end = blank();
    r.drive(2, { turn: 0.85, roll: 0.0001 }, end, { data });
    const far = end.tokens.map((tk, i) => Math.hypot(...tk.offset.map((v, j) => v - rest.tokens[i].offset[j]))); // prettier-ignore
    expect(Math.max(...far), id).toBeLessThan(0.01);
  }
});

test("the hypercube keeps its blue and pink, and takes the color themes", () => {
  const colorsOf = (o) => {
    const { buf } = build("hypercube", o, 4000);
    return Array.from(buf.color.slice(0, 400));
  };
  expect(RECIPES.hypercube.options[0]).toMatchObject({ key: "colors", default: "classic" });
  expect(colorsOf({})).toEqual(colorsOf({ colors: "classic" }));
  expect(colorsOf({})).not.toEqual(colorsOf({ colors: "neon" }));
});

// ---- Möbius riders, the Mandelbulb, Fourier text ----------------------------------

test("every Möbius rider builds in every rider color, within its tokens", () => {
  const riders = RECIPES.mobius.options.find((o) => o.key === "rider").choices.map((c) => c.id);
  expect(riders).toEqual(expect.arrayContaining(["car", "ball", "bike", "ant", "train", "ladybug", "skateboard"])); // prettier-ignore
  for (const rider of riders)
    for (const riderColor of ["auto", "green"]) {
      const { r, data } = build("mobius", { rider, riderColor }, 8000);
      expect(data.rider.length).toBeLessThanOrEqual(8);
      const out = blank();
      r.drive(1, { glow: 0.6, walk: 0.5 }, out, { data });
      finiteOut(out, rider);
    }
});

test("the Mandelbulb builds at every power and as a Julia bulb", () => {
  for (const power of [5, 8, 12])
    for (const variant of ["bulb", "julia"]) {
      const { r, data } = build("mandelbulb", { power, variant, julia: "b" }, 8000);
      expect(data.solid).toBe(variant === "julia");
      expect(Math.abs(data.step - (2 * Math.PI) / (power - 1))).toBeLessThan(1e-12);
      const out = blank();
      r.drive(0, { twist: 0.5 }, out, { data });
      expect(Object.values(out.parts).every((pd) => Number.isFinite(pd.angle))).toBe(true);
    }
});

test("Fourier circles draw long text in groups, and short words as before", () => {
  const short = fourierSet({ shape: "words", words: "HELLO", circles: 12 });
  expect(short.groups).toBeUndefined();
  expect(short.chains.length).toBe(5);
  const long = fourierSet({ shape: "words", words: "SPLASHERY IS FUN #", circles: 12 });
  expect(long.chains.length).toBe(15);
  expect(long.groups).toBe(3);
  expect(long.label).toBe("Your words: SPLASHERY IS FUN ♥");
  const max = fourierSet({ shape: "words", words: "A".repeat(60), circles: 60 });
  expect(max.chains.length).toBe(40);
  for (const F of max.chains) expect(F.circles.length).toBeLessThanOrEqual(9);
  for (const view of ["2d", "3d"]) {
    const { r, data } = build(
      "fourier-circles",
      { shape: "words", words: "HELLO WORLD AGAIN", view },
      20000,
    );
    let shown = 0;
    for (const sp of [0.9, 0.6, 0.3, 0.05]) {
      const out = blank();
      r.drive(0, { spin: sp }, out, { data });
      finiteOut(out, view);
      shown = Object.values(out.parts).filter((p) => p.visible === 1).length;
      expect(shown).toBe(1); // one group spins at a time
    }
    const rest = blank();
    r.drive(0, { spin: 0 }, rest, { data });
    expect(Object.values(rest.parts).every((p) => p.visible === 1)).toBe(true);
  }
});

test("Fourier circles take longer text from the panel", async () => {
  const set = await RECIPES["fourier-circles"].input.read("Hello world ♥");
  expect(set).toEqual({ shape: "words", words: "HELLO WORLD #" });
  await expect(RECIPES["fourier-circles"].input.read("A".repeat(41))).rejects.toThrow(
    /more than 40/,
  );
});

// ---- In the app: each new toy mid-tap, on a phone and a desktop -------------------

const SHOTS = path.resolve("tests/screenshots");
for (const [id, label, wait, opt] of [
  ["rossler-attractor", "Rössler attractor", 2000],
  ["thomas-attractor", "Thomas attractor", 2000],
  ["aizawa-attractor", "Aizawa attractor", 2000],
  ["five-cell", "5-cell", 2200],
  ["sixteen-cell", "16-cell", 2200],
  ["twenty-four-cell", "24-cell", 2200],
  ["duoprism", "Duoprism", 2200],
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
      await page.goto("/?renderer=webgl2&profile=weak&labs=1");
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      await page.evaluate((toy) => window.__splashery.app.chooseToy(toy), id);
      await expect(page.locator("#toy-status")).toHaveText(new RegExp(`^${label}`), { timeout: 180_000 }); // prettier-ignore
      await page.waitForTimeout(1500);
      await page.evaluate(() => window.__splashery.player.act(null));
      await page.waitForTimeout(wait);
      await page.screenshot({ path: path.join(SHOTS, `mt2-${id}-${w}x${h}.png`) });
      expect(problems).toEqual([]);
      await ctx.close();
    }
  });
}

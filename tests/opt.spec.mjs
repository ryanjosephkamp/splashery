// Lane Optics: the ripple tank and the light bench (docs/handoff/Optics.md). The physics is
// checked on numbers: the wave equation's fringes against d·sin θ = m·λ and the single slit's
// spreading, the beaches' absorption and the scheme's stability; the rays against Snell's law,
// the lens equation, the prism's deviation formula, a mirror's focus and a light guide's
// acceptance angle; the glass against its published indices. The browser tests open both toys
// with labs on, tap and drag them, and take the screenshots. docs/evidence/ripple-tank.json and
// light-bench.json cite these tests.

import { test, expect } from "@playwright/test";
import {
  RippleTank,
  arcIntensity,
  peaks,
  centralHalfWidth,
  halfWidthAtHalf,
  doubleSlitAngles,
  singleSlitFirstMin,
  pathDifferenceAngle,
  COURANT,
} from "../src/optics/ripple.js";
import {
  sellmeier,
  trace,
  refract,
  blockSurfaces,
  lensSurfaces,
  thickLens,
  imageDistance,
  prismSurfaces,
  prismCorners,
  prismDeviation,
  mirrorSurfaces,
  fiberSurfaces,
  fiberNumbers,
  place,
  rot,
  LINES,
} from "../src/optics/rays.js";
import { homeParts, traceBench, benchNumbers, axisImage, LENSES, SETUPS as BENCH_SETUPS } from "../src/optics/bench.js"; // prettier-ignore
import { RECIPES, tankLayout } from "../src/packs/optics.js";
import { buildRecipe } from "../src/kit.js";
import { applyClay, PROFILES } from "../src/generators.js";
import { resolveOptions } from "../src/player.js";
import { TOYS } from "../src/toys.js";
import { TOY_SOUNDS } from "../src/toy-sounds.js";
import { TOY_HELP } from "../src/toy-help.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const IDS = ["ripple-tank", "light-bench"];
const DEG = Math.PI / 180;
const deg = (r) => r / DEG;

function build(id, count, options = {}) {
  const recipe = RECIPES[id];
  const o = resolveOptions(recipe, options);
  const it = buildRecipe(recipe, { seed: 1, count, options: o }, applyClay);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

test.describe("the shelf", () => {
  test("two labs toys on the Science shelf, each with a sound, a how-to and an About", () => {
    for (const id of IDS) {
      const t = TOYS.find((x) => x.id === id);
      expect(t, id).toBeTruthy();
      expect(t.labs).toBe(true);
      expect(t.category).toBe("science");
      expect(t.pack).toBe("optics");
      expect(TOY_SOUNDS[id], id).toBeTruthy();
      expect(TOY_HELP[id]?.howTo, id).toBeTruthy();
      expect(TOY_HELP[id]?.about, id).toBeTruthy();
    }
  });

  test("every setup builds within each tier's budget, with no stray numbers", () => {
    const cases = [
      ...["double", "single", "two", "one", "plane", "still"].map((setup) => [
        "ripple-tank",
        { setup },
      ]),
      ...BENCH_SETUPS.map((s) => ["light-bench", { setup: s.id }]),
      ...LENSES.map((l) => ["light-bench", { setup: "lens", lens: l.id }]),
    ];
    for (const tier of ["low", "high"]) {
      for (const [id, o] of cases) {
        const count = Math.round(PROFILES[tier].defaultCount * (RECIPES[id].density ?? 1));
        const ctx = build(id, count, o);
        const buf = ctx.buf;
        expect(buf.count, `${id} ${JSON.stringify(o)} ${tier}`).toBeGreaterThan(1000);
        expect(buf.count).toBeLessThanOrEqual(count);
        for (let i = 0; i < buf.count * 3; i++) expect(Number.isFinite(buf.pos[i])).toBe(true);
      }
    }
  });
});

test.describe("the ripple tank's water", () => {
  test("the time step keeps the Courant number at 0.5 (under 1/√2), and the water stays bounded", () => {
    const tank = new RippleTank({ width: 30, depth: 30, nx: 180, cMax: 30 });
    tank.c = 30;
    tank.f = 6;
    expect((tank.c * tank.dt) / tank.dx).toBeCloseTo(COURANT, 9);
    expect(COURANT).toBeLessThan(1 / Math.SQRT2);
    tank.sources = [{ x: 15, y: 10 }];
    tank.setBarrier({ y: 16, openings: [{ center: 15, width: 3 }] });
    let top = 0;
    for (let i = 0; i < 6000; i++) {
      tank.step();
      if (i % 200 === 0) for (const v of tank.u) top = Math.max(top, Math.abs(v));
    }
    expect(Number.isFinite(top)).toBe(true);
    expect(top).toBeLessThan(10 * tank.amp);
  });

  test("the beaches soak a pebble's rings up: little comes back", () => {
    const tank = new RippleTank({ width: 36, depth: 36, nx: 216, beach: 5, cMax: 30 });
    tank.c = 20;
    tank.pebble(18, 18, 0.8, 1);
    const energy = () => tank.u.reduce((s, v) => s + v * v, 0);
    // The rings fill the open water at first…
    for (let i = 0; i < 200; i++) tank.step();
    const early = energy();
    // …then cross the beach (about 13 cm out, 5 cm in and back) and die.
    while (tank.time < 4) tank.step();
    expect(energy()).toBeLessThan(0.01 * early);
  });

  test("a wave travels at the speed set: a dipper's crests are λ = c / f apart", () => {
    const tank = new RippleTank({ width: 60, depth: 60, nx: 360, beach: 6, cMax: 30 });
    tank.c = 20;
    tank.f = 5;
    tank.sources = [{ x: 30, y: 30 }];
    while (tank.time < 2.2) tank.step();
    // Where u crosses zero going out along +x, between 6 and 22 cm from the dipper.
    const zeros = [];
    let prev = tank.heightAt(36, 30);
    for (let x = 36.02; x < 52; x += 0.02) {
      const h = tank.heightAt(x, 30);
      if (prev * h < 0) zeros.push(x - (0.02 * h) / (h - prev));
      prev = h;
    }
    const spacing = (zeros[zeros.length - 1] - zeros[0]) / (zeros.length - 1);
    expect(Math.abs(2 * spacing - tank.c / tank.f) / (tank.c / tank.f)).toBeLessThan(0.02);
  });

  // A large tank (110 × 75 cm, 4 cells a cm) so the fringes are measured far from the
  // slits: λ = 4 cm, a plane wave through two slits 1.5 cm wide.
  function slitTank(openings) {
    const tank = new RippleTank({ width: 110, depth: 75, nx: 440, beach: 10, cMax: 20 });
    tank.c = 20;
    tank.f = 5;
    tank.line = { y: 7 };
    tank.setBarrier({ y: 14, openings });
    while (tank.time < 6.5) tank.step();
    return arcIntensity(tank, { cx: 55, cy: 14, R: 52, max: 1.2, count: 481, periods: 4 });
  }

  for (const d of [10, 12]) {
    test(`double slit, d = ${d} cm: the bright fringes land where d·sin θ = m·λ says`, () => {
      const lambda = 4;
      const r = slitTank([
        { center: 55 - d / 2, width: 1.5 },
        { center: 55 + d / 2, width: 1.5 },
      ]);
      const found = peaks(r.angles, r.I, 0.05).map((p) => p.x);
      const want = doubleSlitAngles(d, lambda);
      // m = 0 and m = 1 on both sides, within 0.6° of the far-field law; m = 2 (if inside
      // the arc) within 4° of the exact path-difference place on this arc (each slit's own
      // spreading, weaker at wide angles, pulls that fringe in a little).
      const near = (a) => found.reduce((b, x) => (Math.abs(x - a) < Math.abs(b - a) ? x : b), Infinity); // prettier-ignore
      expect(Math.abs(near(0))).toBeLessThan(0.3 * DEG);
      for (const s of [1, -1]) expect(Math.abs(near(s * want[1]) - s * want[1])).toBeLessThan(0.6 * DEG); // prettier-ignore
      const m2 = pathDifferenceAngle(d, lambda, 2, 52);
      if (m2 && m2 < 1.15) expect(Math.abs(near(m2) - m2)).toBeLessThan(4 * DEG);
      // And the spacing between m = 0 and m = 1 matches.
      expect(Math.abs(Math.sin(near(want[1])) - lambda / d)).toBeLessThan(0.012);
    });
  }

  test("single slit: the beam spreads wider as the slit narrows, as sin θ = λ / a says", () => {
    const lambda = 4;
    const widths = [12, 8, 5];
    const half = [];
    for (const a of widths) {
      const r = slitTank([{ center: 55, width: a }]);
      half.push(halfWidthAtHalf(r.angles, r.I));
      if (a === 8) {
        // The first dark fringe within 1.5° of sin θ = λ / a (52 cm away is over three
        // times a² / λ, far enough for the far-field law; the 12 cm slit's isn't).
        expect(Math.abs(centralHalfWidth(r.angles, r.I) - singleSlitFirstMin(a, lambda))).toBeLessThan(1.5 * DEG); // prettier-ignore
      }
    }
    expect(half[1]).toBeGreaterThan(half[0] * 1.2);
    expect(half[2]).toBeGreaterThan(half[1] * 1.2);
  });

  test("the toy's layouts: slits centered in the tank, a and d as set", () => {
    const L = tankLayout({ setup: "double", slit: 1.5, spacing: 7 });
    expect(L.barrier.openings.map((o) => o.center)).toEqual([18 - 3.5, 18 + 3.5]);
    expect(L.barrier.openings[0].width).toBe(1.5);
    expect(tankLayout({ setup: "two", spacing: 5 }).sources.length).toBe(2);
    expect(tankLayout({ setup: "plane" }).line).toBeTruthy();
  });
});

test.describe("the light bench's glass and rays", () => {
  test("the glasses' indices from their Sellmeier coefficients match the published values", () => {
    // Schott data sheets: N-BK7 nd 1.51680, nF 1.52238, nC 1.51432; N-SF11 nd 1.78472;
    // fused silica (Malitson) nd 1.4585.
    expect(sellmeier("N-BK7", LINES.d)).toBeCloseTo(1.5168, 4);
    expect(sellmeier("N-BK7", LINES.F)).toBeCloseTo(1.52238, 4);
    expect(sellmeier("N-BK7", LINES.C)).toBeCloseTo(1.51432, 4);
    expect(sellmeier("N-SF11", LINES.d)).toBeCloseTo(1.78472, 4);
    expect(sellmeier("fused silica", LINES.d)).toBeCloseTo(1.4585, 3);
    // N-BK7's Abbe number, (nd − 1) / (nF − nC) = 64.17.
    const V = (sellmeier("N-BK7", LINES.d) - 1) / (sellmeier("N-BK7", LINES.F) - sellmeier("N-BK7", LINES.C)); // prettier-ignore
    expect(V).toBeCloseTo(64.17, 1);
  });

  test("refraction angles into and out of a glass block follow Snell's law", () => {
    const S = blockSurfaces({ w: 2, h: 0.6 });
    for (const a of [0, 10, 25, 40, 60, 75]) {
      const th = a * DEG;
      for (const nm of [450, LINES.d, 650]) {
        const n = sellmeier("N-BK7", nm);
        // Into the top face from above.
        const d = [Math.sin(th), -Math.cos(th)];
        const t = trace(S, [-0.2 - d[0] * 1, 0.3 - d[1] * 1], d, nm);
        const e = t.events[0];
        expect(e.type).toBe("refract");
        expect(e.i1).toBeCloseTo(th, 9);
        expect(Math.sin(e.i1)).toBeCloseTo(n * Math.sin(e.i2), 9);
        // Out through the bottom, parallel to where it came in.
        const out = t.events[1];
        expect(out.type).toBe("refract");
        expect(out.i2).toBeCloseTo(th, 9);
      }
    }
  });

  test("past the critical angle, light inside glass reflects totally", () => {
    const n = sellmeier("N-BK7", LINES.d);
    const crit = Math.asin(1 / n);
    const N = [0, 1]; // the normal on the glass side
    expect(refract(rot([0, -1], crit - 0.01), N, n)).not.toBeNull();
    expect(refract(rot([0, -1], crit + 0.01), N, n)).toBeNull();
  });

  test("a lens's traced image lands where 1/f = 1/d_o + 1/d_i puts it (each lens, three distances)", () => {
    for (const L of LENSES) {
      const tl = thickLens(L, LINES.d);
      const S = lensSurfaces(L).map((s) => place(s, [0, 0], 0));
      for (const dObj of [1.5 * Math.abs(tl.f), 2.2 * Math.abs(tl.f), 3 * Math.abs(tl.f)]) {
        const x0 = tl.H - dObj;
        const t = trace(S, [x0, 0], [dObj, 0.002], LINES.d, { far: 1 });
        const n = t.pts.length;
        const a = t.pts[n - 2];
        const b = t.pts[n - 1];
        const x = a[0] - (a[1] * (b[0] - a[0])) / (b[1] - a[1]);
        const di = imageDistance(tl.f, dObj);
        expect(Math.abs(x - (tl.H2 + di)) / Math.abs(di), `${L.id} at ${dObj}`).toBeLessThan(0.003);
      }
    }
  });

  test("the bench's own numbers: the traced image and the lens equation agree for each lens", () => {
    for (const L of LENSES) {
      const parts = homeParts({ setup: "lens", lens: L.id });
      const lens = parts.find((p) => p.id === "lens");
      const obj = parts.find((p) => p.id === "object");
      const tl = thickLens(lens.lens, LINES.d);
      const dObj = lens.pos[0] + tl.H - obj.pos[0];
      const di = imageDistance(tl.f, dObj);
      const x = axisImage(parts, lens, obj, LINES.d);
      expect(Math.abs(x - (lens.pos[0] + tl.H2 + di)) / Math.abs(di), L.id).toBeLessThan(0.005);
      const lines = benchNumbers(parts, traceBench(parts, "white"), { setup: "lens", light: "white" }).lines; // prettier-ignore
      expect(lines.join(" ")).toMatch(/1\/f = 1\/d_o \+ 1\/d_i/);
    }
  });

  test("a prism's traced deviation for each wavelength matches δ = i + e − A", () => {
    const A = 60 * DEG;
    for (const glass of ["N-BK7", "N-SF11"]) {
      const P = prismSurfaces({ A, side: 1, glass });
      const c = prismCorners({ A, side: 1 });
      const mid = [(c[1][0] + c[0][0]) / 2, (c[1][1] + c[0][1]) / 2];
      const inward = rot([1, 0], -A / 2); // the first face's inward normal
      for (const iDeg of [45, 55, 65]) {
        const i = iDeg * DEG;
        const d = rot(inward, i);
        for (const nm of [LINES.F, LINES.d, LINES.C, 450, 650]) {
          const t = trace(P, [mid[0] - d[0], mid[1] - d[1]], d, nm);
          const n = sellmeier(glass, nm);
          const want = prismDeviation(A, n, i);
          if (want === null) continue;
          const got = Math.acos(t.dir[0] * d[0] + t.dir[1] * d[1]);
          expect(Math.abs(got - want), `${glass} ${iDeg}° ${nm} nm`).toBeLessThan(1e-9);
        }
      }
      // Blue is bent more than red.
      const i = 55 * DEG;
      expect(prismDeviation(A, sellmeier(glass, LINES.F), i)).toBeGreaterThan(prismDeviation(A, sellmeier(glass, LINES.C), i)); // prettier-ignore
    }
    // N-BK7's least deviation at 587.6 nm for a 60° prism: 2 asin(n sin 30°) − 60° = 38.65°.
    const n = sellmeier("N-BK7", LINES.d);
    const iMin = Math.asin(n * Math.sin(A / 2));
    expect(deg(prismDeviation(A, n, iMin))).toBeCloseTo(38.65, 1);
  });

  test("a concave mirror brings rays near its axis to a focus at R / 2", () => {
    const R = 1.4;
    const S = mirrorSurfaces({ length: 0.8, R });
    for (const y of [0.005, 0.02]) {
      const t = trace(S, [-3, y], [1, 0], LINES.d);
      const p = t.pts[1];
      const x = p[0] - (p[1] * t.dir[0]) / t.dir[1];
      expect(Math.abs(x - -R / 2)).toBeLessThan(0.002);
    }
    // A flat mirror: the angle of reflection equals the angle of incidence.
    const F = mirrorSurfaces({ length: 1 });
    const t = trace(F, [-1, 0.5], [1, -0.5], LINES.d);
    expect(t.events[0].type).toBe("reflect");
    expect(t.dir[0]).toBeCloseTo(-1 / Math.hypot(1, 0.5), 9);
  });

  test("the light guide keeps rays inside its acceptance angle and lets steeper ones out", () => {
    const fn = fiberNumbers("N-SF11", "N-BK7", LINES.d);
    expect(deg(fn.critical)).toBeCloseTo(58.2, 1);
    const F = fiberSurfaces({ a: 0.07, b: 0.035, len1: 1.5, R: 3, bend: 0.01, len2: 0.1 });
    const run = (aDeg) => {
      const a = aDeg * DEG;
      return trace(F.surfaces, [-0.2, -0.2 * Math.tan(a)], [Math.cos(a), Math.sin(a)], LINES.d, { maxHits: 200 }); // prettier-ignore
    };
    const leaks = (t) => t.events.some((e) => e.type === "refract" && e.n1 > 1.7 && e.n2 < 1.6 && e.n2 > 1.01); // prettier-ignore
    for (const a of [10, 30, 50, deg(fn.accept) - 2]) expect(leaks(run(a)), `${a}°`).toBe(false);
    expect(leaks(run(deg(fn.accept) + 4))).toBe(true);
  });

  test("white light: nine wavelengths, drawn white until the glass parts them", () => {
    const parts = homeParts({ setup: "prism" });
    const tr = traceBench(parts, "white");
    expect(tr.paths.filter((p) => p.white).length).toBe(1);
    expect(tr.paths.filter((p) => p.nm).length).toBe(9);
    const red = traceBench(parts, "red");
    expect(red.paths.length).toBe(1);
    expect(red.paths[0].nm).toBe(650);
  });
});

test.describe("in the app", () => {
  test("nothing of the optics loads before one opens", async ({ page }) => {
    const loaded = [];
    page.on("request", (r) => {
      if (/\/src\/optics\/|\/src\/packs\/optics\.js/.test(r.url())) loaded.push(r.url());
    });
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']");
    expect(loaded).toEqual([]);
  });

  test("the ripple tank runs, its tap drops a pebble, and screenshots", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']");
    await page.evaluate(() => window.__splashery.app.chooseToy("ripple-tank"));
    const steps0 = await page.evaluate(() => window.__splashery.optics.RT.tank.steps);
    await expect.poll(() => page.evaluate(() => window.__splashery.optics.RT.tank.steps), { timeout: 15_000 }).toBeGreaterThan(steps0); // prettier-ignore
    await page.evaluate(() => window.__splashery.player.act(null));
    await expect.poll(() => page.evaluate(() => window.__splashery.optics.RT.drop?.hit ?? null)).toBe(true); // prettier-ignore
    await page.screenshot({ path: "tests/screenshots/opt-ripple-tank-390x844.png" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: "tests/screenshots/opt-ripple-tank-1440x900.png" });
    expect(errors).toEqual([]);
  });

  test("the light bench: a drag turns the prism and moves the rays; a tap changes the light", async ({
    page,
  }) => {
    // prettier-ignore
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']");
    await page.evaluate(() => window.__splashery.app.chooseToy("light-bench"));
    const r = await page.evaluate(() => {
      const { BS } = window.__splashery.optics;
      const drag = window.__splashery.player.toyInfo.recipe.drag;
      const prism = BS.parts.find((p) => p.id === "prism");
      const knob = [prism.pos[0], prism.pos[1] + 0.52, 0.05];
      const before = { angle: prism.angle, v: BS.version, end: BS.traced.paths.at(-1).pts.at(-1) };
      const ok = drag.at(knob);
      drag.start(knob);
      drag.move([prism.pos[0] + 0.15, prism.pos[1] + 0.5, 0.05]);
      drag.end();
      return { ok, before, angle: prism.angle, v: BS.version, end: BS.traced.paths.at(-1).pts.at(-1), light: BS.light }; // prettier-ignore
    });
    expect(r.ok).toBe(true);
    expect(r.angle).toBeLessThan(r.before.angle - 0.2);
    expect(r.v).toBeGreaterThan(r.before.v);
    expect(r.end).not.toEqual(r.before.end);
    await page.evaluate(() => window.__splashery.player.act(null));
    await expect.poll(() => page.evaluate(() => window.__splashery.optics.BS.light)).toBe("red");
    await page.evaluate(() =>
      window.__splashery.app.setToyOptions({ setup: "prism", light: "white" }),
    );
    await page.waitForTimeout(500);
    await page.screenshot({ path: "tests/screenshots/opt-light-bench-390x844.png" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: "tests/screenshots/opt-light-bench-1440x900.png" });
    expect(errors).toEqual([]);
  });
});

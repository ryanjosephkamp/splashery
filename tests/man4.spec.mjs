// Manual r4: the budget table, the "What Splashery can do" page, and the live demos. The demos' math is
// checked against the formulas in the manual, against hand values, and against the real code in
// src/ (the kit's rotations, the real equation reader, the toy's own recipe). The page is checked with
// a mouse, a keyboard, and a phone-sized screen. Screenshots man4-*.png.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { quatEuler, quatRotate, buildRecipe } from "../src/kit.js";
import {
  readStatements,
  compileProgram,
  readExpr,
  FIELDS as REAL_FIELDS,
} from "../src/packs/splat-equation.js";
import { RECIPES as WINDMILL } from "../manual/example-recipe.js";
import * as M from "../manual/demo-math3.js";
import * as RR from "../manual/railroad.js";
import { readRows, readSummary, build as buildBudget } from "../manual/build-budget.mjs";

const near = (a, b, d = 1e-9, what = "") => expect(Math.abs(a - b), what).toBeLessThan(d);
const seeded = (seed) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

test.describe("the 3D demos' math", () => {
  test("a turn's matrix is the kit's own rotation, on 200 random turns", () => {
    const r = seeded(1);
    for (let i = 0; i < 200; i++) {
      const [x, y, z] = [r() * 720 - 360, r() * 720 - 360, r() * 720 - 360];
      const q = M.quatEulerDeg(x, y, z);
      const kq = quatEuler(x, y, z);
      for (let k = 0; k < 4; k++) near(q[k], kq[k], 1e-12, "quaternion");
      const R = M.quatMatrix(q);
      for (const v of [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
        [0.3, -0.7, 0.2],
      ]) {
        const a = M.mulMV(R, v);
        const b = quatRotate(kq, v);
        for (let k = 0; k < 3; k++) near(a[k], b[k], 1e-12, "rotated vector");
      }
      // A rotation matrix: orthonormal, determinant 1.
      near(M.det3(R), 1, 1e-12);
      const RRt = M.mulMM(R, M.transpose(R));
      for (let k = 0; k < 9; k++) near(RRt[k], k % 4 === 0 ? 1 : 0, 1e-12);
    }
  });

  test("the covariance is R S S^T R^T, symmetric, and every size above 0 gives a valid one", () => {
    const r = seeded(2);
    for (let i = 0; i < 100; i++) {
      const sizes = [0.05 + r(), 0.05 + r(), 0.05 + r()];
      const R = M.quatMatrix(M.quatEulerDeg(r() * 360, r() * 360, r() * 360));
      const S = M.covariance(sizes, R);
      for (const [a, b] of [
        [1, 3],
        [2, 6],
        [5, 7],
      ])
        near(S[a], S[b], 1e-12, "symmetric");
      expect(M.det3(S)).toBeGreaterThan(0);
      // The determinant is (s1 s2 s3)^2, and the trace is s1^2 + s2^2 + s3^2.
      near(M.det3(S), (sizes[0] * sizes[1] * sizes[2]) ** 2, 1e-12);
      near(S[0] + S[4] + S[8], sizes[0] ** 2 + sizes[1] ** 2 + sizes[2] ** 2, 1e-12);
    }
  });

  test("on the shell k sizes out the weight is exp(-k^2/2): 0.607, 0.135, 0.011", () => {
    near(M.weightAtShell(1), 0.6065306597, 1e-9);
    near(M.weightAtShell(2), 0.1353352832, 1e-9);
    near(M.weightAtShell(3), 0.0111089965, 1e-9);
    expect(M.weightAtShell(1).toFixed(2)).toBe("0.61");
    expect(M.weightAtShell(2).toFixed(2)).toBe("0.14");
    expect(M.weightAtShell(3).toFixed(2)).toBe("0.01");
    const r = seeded(3);
    for (let i = 0; i < 60; i++) {
      const sizes = [0.1 + r(), 0.1 + r(), 0.1 + r()];
      const R = M.quatMatrix(M.quatEulerDeg(r() * 360, r() * 360, r() * 360));
      const S = M.covariance(sizes, R);
      const k = 0.3 + r() * 3;
      const n = M.unit([r() - 0.5, r() - 0.5, r() - 0.5]);
      const p = M.shellPoint(sizes, R, k, n);
      near(M.gaussianAt(S, p), M.weightAtShell(k), 1e-9, "weight on the shell");
      // And the shell for a chosen weight is the inverse.
      near(M.shellForWeight(M.weightAtShell(k)), k, 1e-9);
    }
    // The center is 1, and the rings really lie on the shell.
    near(M.gaussianAt(M.covariance([1, 2, 3], M.quatMatrix([0, 0, 0, 1])), [0, 0, 0]), 1);
    const sz = [0.9, 0.5, 0.3];
    const Rm = M.quatMatrix(M.quatEulerDeg(20, 35, 50));
    const Sg = M.covariance(sz, Rm);
    for (const ring of M.shellRings(sz, Rm, 2)) for (const p of ring) near(M.gaussianAt(Sg, p), M.weightAtShell(2), 1e-9); // prettier-ignore
  });

  test("the fog's points really follow the Gaussian: their covariance is Sigma", () => {
    const sz = [0.9, 0.5, 0.3];
    const R = M.quatMatrix(M.quatEulerDeg(20, 35, 50));
    const S = M.covariance(sz, R);
    const pts = M.fogPoints(40000, sz, R);
    const C = new Array(9).fill(0);
    for (const p of pts) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i * 3 + j] += (p[i] * p[j]) / pts.length; // prettier-ignore
    for (let k = 0; k < 9; k++) near(C[k], S[k], 0.02, `entry ${k}`);
  });

  test("the bell in 1, 2, and 3 dimensions is the formula, and 3D matches the matrix form", () => {
    // 1D: exp(-(x - mu)^2 / 2 sigma^2) with mu = 0.
    for (const [x, s] of [
      [0, 1],
      [1, 1],
      [2, 1],
      [0.5, 0.25],
      [-1.5, 0.8],
    ])
      near(M.bell(1, [x, 9, 9], [s, 9, 9]).g, Math.exp(-(x * x) / (2 * s * s)));
    // 2D, 3D: the same as the matrix form with Sigma = diag(sigma^2).
    const r = seeded(4);
    for (let i = 0; i < 60; i++) {
      const sg = [0.2 + r(), 0.2 + r(), 0.2 + r()];
      const p = [r() * 2 - 1, r() * 2 - 1, r() * 2 - 1];
      const S3 = [sg[0] ** 2, 0, 0, 0, sg[1] ** 2, 0, 0, 0, sg[2] ** 2];
      near(M.bell(3, p, sg).g, M.gaussianAt(S3, p), 1e-12, "3D");
      const S2 = [sg[0] ** 2, 0, 0, 0, sg[1] ** 2, 0, 0, 0, 1];
      near(M.bell(2, p, sg).g, M.gaussianAt(S2, [p[0], p[1], 0]), 1e-12, "2D");
      // k is the distance in sizes.
      near(M.bell(3, p, sg).g, M.weightAtShell(M.bell(3, p, sg).k), 1e-12);
    }
  });

  test("J is the real derivative of the perspective map (finite differences)", () => {
    const cam = M.orbitCamera({ yaw: 25, pitch: 15, distance: 4, focal: 300 });
    const f = (v) => [(cam.focal * v[0]) / v[2], (-cam.focal * v[1]) / v[2]];
    const v = [0.4, -0.3, 4.2];
    const J = M.jacobian(cam, v);
    const h = 1e-6;
    for (let k = 0; k < 3; k++) {
      const a = v.slice();
      const b = v.slice();
      a[k] += h;
      b[k] -= h;
      const fa = f(a);
      const fb = f(b);
      near(J[k], (fa[0] - fb[0]) / (2 * h), 1e-4, `d sx / d ${k}`);
      near(J[3 + k], (fa[1] - fb[1]) / (2 * h), 1e-4, `d sy / d ${k}`);
    }
  });

  test("Sigma' is the covariance of the splat's projected points, for a splat far from the camera", () => {
    const sz = [0.12, 0.06, 0.03];
    const R = M.quatMatrix(M.quatEulerDeg(20, 35, 50));
    const S = M.covariance(sz, R);
    const cam = M.orbitCamera({ yaw: 30, pitch: 20, distance: 6, focal: 400, cx: 0, cy: 0 });
    const cov = M.projectCovariance(cam, [0, 0, 0], S);
    // A sample of the Gaussian, each point sent through the true perspective map.
    const pts = M.fogPoints(60000, sz, R, 11);
    const xs = pts.map((p) => M.project(cam, p));
    const mx = xs.reduce((s, p) => s + p.x, 0) / xs.length;
    const my = xs.reduce((s, p) => s + p.y, 0) / xs.length;
    let a = 0;
    let b = 0;
    let c = 0;
    for (const p of xs) {
      a += (p.x - mx) ** 2 / xs.length;
      b += ((p.x - mx) * (p.y - my)) / xs.length;
      c += (p.y - my) ** 2 / xs.length;
    }
    const rel = (x, y) => Math.abs(x - y) / Math.max(Math.abs(y), 1e-9);
    expect(rel(a, cov.a)).toBeLessThan(0.03);
    expect(rel(c, cov.c)).toBeLessThan(0.03);
    expect(Math.abs(b - cov.b)).toBeLessThan(0.03 * Math.sqrt(cov.a * cov.c));
  });

  test("the affine ellipse matches the true outline far away and drifts apart up close", () => {
    const sz = [0.8, 0.45, 0.3];
    const R = M.quatMatrix(M.quatEulerDeg(20, 35, 50));
    const S = M.covariance(sz, R);
    const gap = (distance, focal) => {
      const cam = M.orbitCamera({ yaw: 30, pitch: 20, distance, focal });
      const c = M.project(cam, [0, 0, 0]);
      const cov = M.projectCovariance(cam, [0, 0, 0], S);
      return { gap: M.outlineGap(M.trueOutline(cam, [0, 0, 0], sz, R, 1), c, cov, 1), size: M.ellipseOf(cov).rx }; // prettier-ignore
    };
    const far = gap(60, 6000); // the same picture size, a long way off
    const near_ = gap(1.8, 180);
    // Far away the outline and the ellipse agree to a fraction of a percent of the size.
    expect(far.gap / far.size).toBeLessThan(0.01);
    // Up close they part (the gap grows steadily as the camera comes in).
    expect(near_.gap / near_.size).toBeGreaterThan(0.02);
    expect(near_.gap / near_.size).toBeGreaterThan(10 * (far.gap / far.size));
    let last = 0;
    for (const d of [60, 20, 10, 6, 4, 3, 2.2, 1.8]) {
      const g = gap(d, 100 * d);
      expect(g.gap / g.size).toBeGreaterThan(last);
      last = g.gap / g.size;
    }
  });

  test("an orthographic camera gives exactly the 2 x 2 block of the covariance in view axes", () => {
    const sz = [0.8, 0.45, 0.3];
    const R = M.quatMatrix(M.quatEulerDeg(20, 35, 50));
    const S = M.covariance(sz, R);
    const cam = M.orbitCamera({ yaw: 30, pitch: 20, distance: 1e6, focal: 1e6 * 100 });
    const cov = M.projectCovariance(cam, [0, 0, 0], S);
    const WSW = M.mulMM(M.mulMM(cam.W, S), M.transpose(cam.W));
    // J = (f/z) [[1, 0, 0], [0, -1, 0]] and f/z = 100 here.
    near(cov.a / 1e4, WSW[0], 1e-6);
    near(cov.b / 1e4, -WSW[1], 1e-6);
    near(cov.c / 1e4, WSW[4], 1e-6);
  });

  test("blending: back to front equals the closed form from the nearest, and order changes the color", () => {
    const r = seeded(5);
    for (let t = 0; t < 100; t++) {
      const n = 2 + Math.floor(r() * 4);
      const layers = Array.from({ length: n }, () => ({ c: [r(), r(), r()], a: r() * 0.9 }));
      // `layers` is nearest first here; back to front is its reverse.
      const steps = M.overSteps(layers.slice().reverse());
      const closed = M.overClosedForm(layers);
      for (let k = 0; k < 3; k++) near(steps[steps.length - 1].color[k], closed.color[k], 1e-12);
      near(steps[steps.length - 1].transmittance, closed.transmittance, 1e-12);
      // The transmittance is the product of (1 - a), whatever the order.
      const flipped = M.overSteps(layers);
      near(flipped[flipped.length - 1].transmittance, closed.transmittance, 1e-12);
    }
    // A hand example: red (a 0.5) in front of blue (a 0.5), over black.
    const front = { c: [1, 0, 0], a: 0.5 };
    const back = { c: [0, 0, 1], a: 0.5 };
    const right = M.overSteps([back, front]).at(-1);
    near(right.color[0], 0.5);
    near(right.color[2], 0.25);
    near(right.transmittance, 0.25);
    const wrong = M.overSteps([front, back]).at(-1);
    near(wrong.color[0], 0.25);
    near(wrong.color[2], 0.5);
    near(wrong.transmittance, 0.25); // the same: only the color depends on the order
  });

  test("the grid and the carry: cell centers, and a stagger that starts at 0 and ends at 1", () => {
    const g = M.uvGrid(4, 2, [0, 8], [0, 2]);
    expect(g.length).toBe(8);
    expect(g[0]).toEqual([1, 0.5]);
    expect(g[7]).toEqual([7, 1.5]);
    for (const n of [2, 10, 300])
      for (const i of [0, Math.floor(n / 2), n - 1]) {
        near(M.stagger(0, i, n), 0);
        near(M.stagger(1, i, n), 1);
        let last = -1;
        for (let k = 0; k <= 20; k++) {
          const s = M.stagger(k / 20, i, n);
          expect(s).toBeGreaterThanOrEqual(last - 1e-12);
          last = s;
        }
      }
    // The first dot leaves before the last.
    expect(M.stagger(0.3, 0, 100)).toBeGreaterThan(M.stagger(0.3, 99, 100));
    expect(M.lerp3([0, 0, 0], [2, 4, 6], 0.5)).toEqual([1, 2, 3]);
  });
});

const html = fs.readFileSync("manual/all.html", "utf8");
const SHOTS = path.resolve("tests/screenshots");
const text = (h) =>
  h
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ");

// ---- More math: the part's turn, and the torus ---------------------------------------------------
test.describe("more of the demos' math", () => {
  test("a part's turn keeps every distance to the pivot, and a full turn changes nothing", () => {
    const pivot = [0.1, 0.6, 0.42];
    const axis = M.unit([0.3, -0.2, 1]);
    const r = seeded(9);
    for (let i = 0; i < 50; i++) {
      const p = [r() - 0.5, r() - 0.5, r() - 0.5];
      const q = M.quatEulerDeg(r() * 360, r() * 360, r() * 360);
      const [p2, q2] = M.turnAbout(pivot, axis, r() * 6)(p, q);
      near(M.len(M.sub(p2, pivot)), M.len(M.sub(p, pivot)), 1e-12, "distance to the pivot");
      near(Math.hypot(...q2), 1, 1e-12, "still a unit quaternion");
      const [p3, q3] = M.turnAbout(pivot, axis, 2 * Math.PI)(p, q);
      for (let k = 0; k < 3; k++) near(p3[k], p[k], 1e-12);
      // A full turn gives the same rotation (a quaternion and its negative are one rotation).
      const sgn = Math.sign(q3[3] * q[3]) || 1;
      for (let k = 0; k < 4; k++) near(sgn * q3[k], q[k], 1e-12);
    }
    // A point on the axis does not move.
    const [on] = M.turnAbout(pivot, axis, 1.3)(M.add(pivot, M.scale(axis, 0.7)), [0, 0, 0, 1]);
    for (let k = 0; k < 3; k++) near(on[k], M.add(pivot, M.scale(axis, 0.7))[k], 1e-12);
  });

  test("the toy's own reader puts the grid's dots on the torus the program writes", () => {
    const prog = compileProgram({ x: "(2 + cos v)·cos u", y: "sin v", z: "(2 + cos v)·sin u", u: "0 .. 2pi", v: "0 .. 2pi" }); // prettier-ignore
    expect(prog.u).toEqual([0, 2 * Math.PI]);
    const vals = { θ: 0, y: 0, t: 0 };
    for (const [u, v] of M.uvGrid(36, 18, prog.u, prog.v)) {
      vals.θ = u;
      vals.y = v;
      near(prog.x.f(vals), (2 + Math.cos(v)) * Math.cos(u), 1e-12);
      near(prog.y.f(vals), Math.sin(v), 1e-12);
      near(prog.z.f(vals), (2 + Math.cos(v)) * Math.sin(u), 1e-12);
      // Every dot of the torus is two units from the tube's core circle, plus or minus 1 in the tube.
      const ring = Math.hypot(prog.x.f(vals), prog.z.f(vals));
      near(Math.hypot(ring - 2, prog.y.f(vals)), 1, 1e-12, "on the tube");
    }
  });
});

// ---- The grammar ---------------------------------------------------------------------------------
test.describe("the grammar as tracks", () => {
  // The manual's text version of each rule: the words in quotes and the names of the other rules.
  const block = (() => {
    const g = html.slice(html.indexOf("<h4>The grammar</h4>"));
    return g.slice(g.indexOf("<pre><code>") + 11, g.indexOf("</code></pre>"));
  })();
  const textRules = () => {
    const rules = {};
    let name = null;
    for (const line of block.split("\n")) {
      const m = /^(\w+)\s+= (.*)$/.exec(line);
      if (m) {
        name = m[1];
        rules[name] = m[2];
      } else if (name && line.trim()) rules[name] += ` ${line.trim()}`;
    }
    return rules;
  };

  test("the tracks and the grammar text name the same rules, words, and neighbors", () => {
    const rules = textRules();
    expect(Object.keys(rules).sort()).toEqual(Object.keys(RR.RULES).sort());
    const notes = (r) => r.replace(/\((?![^)]*")[^)]*\)/g, " "); // the parenthesized remarks (a group has quotes)
    for (const name of Object.keys(RR.RULES)) {
      const body = notes(rules[name]);
      const quoted = new Set([...body.matchAll(/"([^"]+)"/g)].map((m) => m[1]));
      const refs = new Set([...body.replace(/"[^"]*"/g, " ").matchAll(/[a-z][a-z0-9]*/g)].map((m) => m[0]).filter((w) => w in rules)); // prettier-ignore
      const data = RR.ruleFacts(name);
      // The text writes u, v, t, pi, e, number as quoted words or as the word "number".
      for (const w of data.quoted) {
        if (w === "number" || w === "new line") continue;
        expect(quoted.has(w), `${name}: "${w}" is in the tracks but not the text`).toBe(true);
      }
      for (const w of quoted) {
        if (w === "|") continue;
        expect(
          data.quoted.has(w) || (w === "=" && name === "program"),
          `${name}: "${w}" is in the text but not the tracks`,
        ).toBe(true);
      }
      expect([...refs].sort(), `${name}: the rules it refers to`).toEqual([...data.refs].sort());
    }
  });

  test("the field names and the functions are the real ones", () => {
    expect(RR.FIELD_NAMES).toEqual(REAL_FIELDS);
    // Every one-input function is accepted by the reader as a bare or bracketed input, min and max need brackets.
    for (const f of RR.ONE_INPUT) {
      expect(() => readExpr(`${f}(0.5)`), f).not.toThrow(/know/);
      expect(() => readExpr(`${f} 0.5`), f).not.toThrow(/know|brackets/);
    }
    for (const f of ["min", "max"]) {
      expect(() => readExpr(`${f}(1, 2)`)).not.toThrow();
      expect(() => readExpr(`${f} 1`)).toThrow(/brackets/);
    }
    // And no other word is a function the reader accepts with brackets that the grammar left out.
    for (const f of ["sec", "csc", "cot", "sign", "round", "ceil", "pow"]) expect(() => readExpr(`${f}(1)`), f).toThrow(); // prettier-ignore
  });

  test("6,000 walks along the tracks, every one accepted by the real reader (the numbers may not work)", () => {
    let seed = 20261010;
    const rng = () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const base = { x: "u", y: "v", z: "0", u: "0 .. 1" };
    const valueOnly = /must be numbers|its two ends|too far out|must be a number/;
    let ok = 0;
    let refusedForNumbers = 0;
    for (let i = 0; i < 6000; i++) {
      const field = RR.FIELD_NAMES[i % 12];
      const w = RR.walk("program", rng, { field });
      for (const textOf of [w.text, RR.compact(w.text)]) {
        try {
          const set = readStatements(textOf);
          const fields = { ...base, ...set };
          if (set.hue) delete fields.r;
          compileProgram(fields);
          ok++;
        } catch (e) {
          if (!valueOnly.test(e.message)) throw new Error(`The tracks allowed ${JSON.stringify(textOf)} and the reader said: ${e.message}`); // prettier-ignore
          refusedForNumbers++;
        }
      }
    }
    expect(ok).toBeGreaterThan(10000);
    expect(refusedForNumbers).toBeLessThan(2400); // a few in ten walk into a log of 0 or a flat range
  });

  test("the diagram draws every rule, with the words of the grammar and a lit path when walked", async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/manual/all.html");
    for (const name of RR.RULE_ORDER)
      await expect(page.locator(`#rr-${name} svg.rr-svg`), name).toHaveCount(1);
    // The sum rule shows its words.
    for (const w of ["product", "+", "-"])
      await expect(page.locator("#rr-sum svg")).toContainText(w);
    for (const w of ["sin", "arctan", "floor"])
      await expect(page.locator("#rr-function svg")).toContainText(w);
    await expect(page.locator("#rr-atom svg")).toContainText("min");
    await expect(page.locator("#rr-atom svg")).toContainText("not directly inside another");
    for (let i = 0; i < 12; i++) {
      await page.selectOption("#rr-start", i % 3 ? "" : RR.FIELD_NAMES[i]);
      await page.click("#rr-walk");
      const text = await page.locator("#rr-text").innerText();
      expect(text.length).toBeGreaterThan(3);
      expect(await page.locator("#rr-rules .on").count()).toBeGreaterThan(3);
      // The page's own verdict never says "syntax"; it either accepts or names the numbers.
      const verdict = await page.locator("#rr-verdict").innerText();
      expect(verdict).toMatch(/accepts it|the numbers do not work/);
    }
    await page.click("#rr-clear");
    expect(await page.locator("#rr-rules .on").count()).toBe(0);
    expect(errors).toEqual([]);
  });
});

// ---- The other demos, on the page ----------------------------------------------------------------
test.describe("the demos on the page", () => {
  test("every demo loads with no error, and every picture has a label", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && !/favicon|404/.test(m.text()) && errors.push(m.text())); // prettier-ignore
    await page.goto("/manual/all.html");
    await page.waitForTimeout(800);
    for (const d of [
      "gaussian-3d",
      "splat-numbers",
      "bell-1d-to-3d",
      "projection",
      "sort-blend",
      "windmill-parts",
      "uv-torus",
      "program-fields",
      "grammar-railroad",
    ]) {
      // prettier-ignore
      const sec = page.locator(`section.demo-live[data-demo="${d}"]`);
      await expect(sec, d).toHaveCount(1);
      for (const c of await sec.locator("canvas").all()) expect((await c.getAttribute("aria-label")).length, d).toBeGreaterThan(20); // prettier-ignore
    }
    expect(errors).toEqual([]);
  });

  test("the 3D Gaussian: the shells' weights, a drag that turns it, and a shell you pick", async ({
    page,
  }) => {
    await page.goto("/manual/all.html");
    const out = page.locator("#g3-readout");
    await out.scrollIntoViewIfNeeded();
    await expect(out).toContainText("G = 0.607");
    await expect(out).toContainText("G = 0.135");
    await expect(out).toContainText("G = 0.011");
    await page.locator("#g3-w").fill("0.3");
    // exp(-k^2/2) = 0.30 gives k = sqrt(-2 ln 0.3) = 1.55.
    await expect(out).toContainText("= 1.55 sizes out");
    const before = await page.locator("#g3-canvas").evaluate((c) => c.toDataURL());
    const box = await page.locator("#g3-canvas").boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 30, { steps: 6 });
    await page.mouse.up();
    expect(await page.locator("#g3-canvas").evaluate((c) => c.toDataURL())).not.toBe(before);
    // The keyboard turns it too.
    await page.locator("#g3-canvas").focus();
    const k0 = await page.locator("#g3-canvas").evaluate((c) => c.toDataURL());
    await page.keyboard.press("ArrowRight");
    expect(await page.locator("#g3-canvas").evaluate((c) => c.toDataURL())).not.toBe(k0);
  });

  test("one splat: 14 numbers, only the one you move is marked, and the quaternion has length 1", async ({
    page,
  }) => {
    await page.goto("/manual/all.html");
    await page.locator("#sn-table").scrollIntoViewIfNeeded();
    await expect(page.locator("#sn-table > div")).toHaveCount(14);
    const set = async (id, v) => page.locator(`#${id}`).fill(String(v));
    await set("sn-s1", 0.62);
    await expect(page.locator("#sn-table > div.changed")).toHaveCount(1);
    await expect(page.locator("#sn-table > div.changed .k")).toHaveText("s₁");
    await expect(page.locator("#sn-table > div.changed .v")).toHaveText("0.620");
    await set("sn-r", 0.5);
    await expect(page.locator("#sn-table > div.changed .k")).toHaveText("red");
    // A turn changes the four numbers of the quaternion, and nothing else.
    await set("sn-ty", 75);
    const keys = await page.locator("#sn-table > div.changed .k").allInnerTexts();
    expect(keys.sort()).toEqual(["q w", "q x", "q y", "q z"].sort());
    const q = (await page.locator("#sn-table > div").evaluateAll((els) => els.map((e) => [e.dataset.k, Number(e.querySelector(".v").textContent)]))); // prettier-ignore
    const [qx, qy, qz, qw] = ["qx", "qy", "qz", "qw"].map((k) => q.find(([n]) => n === k)[1]);
    near(qx * qx + qy * qy + qz * qz + qw * qw, 1, 0.003, "unit quaternion");
    // The quaternion on the page is the kit's own for those turns.
    const kq = quatEuler(20, 75, 10);
    near(qx, kq[0], 0.0006);
    near(qw, kq[3], 0.0006);
    await page.click("#sn-reset");
    await expect(page.locator("#sn-table > div.changed")).toHaveCount(0);
    await expect(page.locator("#sn-table > div").first().locator(".v")).toHaveText("0.300");
  });

  test("the bell: the number it shows is the formula's, in one, two, and three dimensions", async ({
    page,
  }) => {
    await page.goto("/manual/all.html");
    await page.locator("#bl-readout").scrollIntoViewIfNeeded();
    const set = async (id, v) => {
      await page.locator(`#${id}`).fill(String(v));
      await page.locator(`#${id}`).dispatchEvent("input");
    };
    // One dimension: sigma 1, x = 1: exp(-0.5) = 0.607. The other sliders are hidden.
    await set("bl-s1", 1);
    await set("bl-x", 1);
    await expect(page.locator("#bl-readout")).toContainText("= 0.607");
    await expect(page.locator("#bl-s2")).toBeHidden();
    await expect(page.locator("#bl-z")).toBeHidden();
    // Two dimensions: sigma 1 and 0.6, the point (1, 0.4): exp(-0.5 (1 + 0.4444)) = 0.486.
    await page.click("#bl-d2");
    await set("bl-s2", 0.6);
    await set("bl-y", 0.4);
    await expect(page.locator("#bl-readout")).toContainText(
      `= ${Math.exp(-0.5 * (1 + (0.4 / 0.6) ** 2)).toFixed(3)}`,
    );
    await expect(page.locator("#bl-s2")).toBeVisible();
    await expect(page.locator("#bl-z")).toBeHidden();
    // Three dimensions, with z = 0.2 and sigma3 = 0.4.
    await page.click("#bl-d3");
    await set("bl-s3", 0.4);
    await set("bl-z", 0.2);
    const g3 = Math.exp(-0.5 * (1 + (0.4 / 0.6) ** 2 + (0.2 / 0.4) ** 2));
    await expect(page.locator("#bl-readout")).toContainText(`= ${g3.toFixed(3)}`);
    // And it is the matrix formula's value.
    const S3 = [1, 0, 0, 0, 0.36, 0, 0, 0, 0.16];
    near(g3, M.gaussianAt(S3, [1, 0.4, 0.2]), 1e-12);
    // Dragging on the picture moves the point.
    const x0 = await page.locator("#bl-x").inputValue();
    const box = await page.locator("#bl-canvas").boundingBox();
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.5);
    expect(await page.locator("#bl-x").inputValue()).not.toBe(x0);
  });

  test("the projection: the outline and the ellipse part as the camera comes in", async ({
    page,
  }) => {
    await page.goto("/manual/all.html");
    await page.locator("#pj-readout").scrollIntoViewIfNeeded();
    const gap = async (d) => {
      await page.locator("#pj-d").fill(String(d));
      await page.locator("#pj-d").dispatchEvent("input");
      const t = await page.locator("#pj-readout").innerText();
      return Number(/at most ([\d.]+) pixels,\s+([\d.]+)%/.exec(t)[2]);
    };
    const far = await gap(12);
    const near_ = await gap(2.5);
    expect(far).toBeLessThan(2); // a pixel or so at distance 12
    expect(near_).toBeGreaterThan(3 * far);
    // J is on the page.
    await expect(page.locator("#pj-readout")).toContainText("J (2 × 3)");
  });

  test("sorting and blending: the table is the formula, order changes the color but not the transmittance", async ({
    page,
  }) => {
    await page.goto("/manual/all.html");
    await page.locator("#bd-table").scrollIntoViewIfNeeded();
    const rows = async () => page.locator("#bd-table tr").evaluateAll((trs) => trs.map((tr) => [...tr.cells].map((c) => c.innerText.trim()))); // prettier-ignore
    // The default: far to near. Gold (depth 4) first, red (depth 1) last.
    let r = await rows();
    expect(r.map((x) => x[0].replace(/^\d+\.\s*/, ""))).toEqual(["gold", "blue", "green", "red"]);
    expect(r.map((x) => x[1])).toEqual(["4", "3", "2", "1"]);
    // The transmittance after the last splat is the product of (1 - a).
    const a = r.map((x) => Number(x[2]));
    const T = (list) => list.reduce((p, v) => p * (1 - v), 1);
    near(Number(r.at(-1)[4]), T(a), 0.001);
    await expect(page.locator("#bd-result")).toContainText("That is the right order");
    // The color column is the closed form from the nearest, over black. Nearest first is red, green, blue, gold.
    const cols = { red: [0.92, 0.18, 0.2], green: [0.12, 0.62, 0.35], blue: [0.16, 0.38, 0.9], gold: [0.96, 0.78, 0.15] }; // prettier-ignore
    const names = r.map((x) => x[0].replace(/^\d+\.\s*/, ""));
    const nearest = names.map((n, i) => ({ c: cols[n], a: a[i] })).reverse();
    const closed = M.overClosedForm(nearest);
    const shown = r
      .at(-1)[3]
      .split(",")
      .map((v) => Number(v.trim()));
    shown.forEach((v, k) => near(v, Math.round(closed.color[k] * 255), 2, `channel ${k}`));
    // Reverse the order: the color changes, the transmittance does not.
    await page.click("#bd-reverse");
    const r2 = await rows();
    expect(r2.map((x) => x[0].replace(/^\d+\.\s*/, ""))).toEqual(["red", "green", "blue", "gold"]);
    expect(r2.at(-1)[3]).not.toBe(r.at(-1)[3]);
    near(Number(r2.at(-1)[4]), Number(r.at(-1)[4]), 0.001);
    await expect(page.locator("#bd-result")).toContainText("not far to near");
    // "later" swaps a splat with the next one; the slider paints only the first few.
    await page.locator("#bd-order button").first().click();
    expect((await rows())[0][0]).toContain("green");
    await page.locator("#bd-steps").fill("2");
    await page.locator("#bd-steps").dispatchEvent("input");
    expect(await page.locator("#bd-table tr.later").count()).toBe(2);
    // The keyboard moves the pixel.
    await page.locator("#bd-canvas").focus();
    const before = await page.locator("#bd-table").innerText();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    expect(await page.locator("#bd-table").innerText()).not.toBe(before);
  });

  test("the windmill: the real recipe's splats, grouped by the lines that made them", async ({
    page,
  }) => {
    // Build the same windmill the page builds (count 12000, seed 7) and read its groups.
    const run = buildRecipe(WINDMILL["little-windmill"], { seed: 7, count: 12000, options: { sails: "#f2eee4" } }, () => {}); // prettier-ignore
    let r = run.next();
    while (!r.done) r = run.next();
    const k = r.value;
    const total = k.buf.count;
    const n = (...items) =>
      items.reduce((s, i) => s + (k.kit.items[i].end - k.kit.items[i].start), 0);
    expect(k.kit.items.length).toBe(7); // the tower, the cap, the hub, and four sails
    await page.goto("/manual/all.html");
    await page.locator("#wm-readout").scrollIntoViewIfNeeded();
    const click = async (lit) => {
      await page.locator(`#demo-windmill .code-line[data-lit="${lit}"]`).click();
      return page.locator("#wm-readout").innerText();
    };
    const fmt = (x) => x.toLocaleString("en-US");
    expect(await click("tower")).toContain(`${fmt(n(0))} of ${fmt(total)} splats`);
    expect(await click("cap")).toContain(`${fmt(n(1))} of ${fmt(total)} splats`);
    expect(await click("hub")).toContain(`${fmt(n(2))} of ${fmt(total)} splats`);
    expect(await click("blades")).toContain(`${fmt(n(3, 4, 5, 6))} of ${fmt(total)} splats`);
    // The sails part is the hub and the four sails.
    expect(await click("sails")).toContain(`${fmt(n(2, 3, 4, 5, 6))} of ${fmt(total)} splats`);
    // The recipe lines on the page are the real recipe's lines.
    const real = fs.readFileSync("manual/example-recipe.js", "utf8").replace(/\s+/g, "");
    for (const line of await page.locator("#demo-windmill .code-line code").allInnerTexts())
      expect(real, line.slice(0, 40)).toContain(line.replace(/\s+/g, ""));
    // The slider turns the part: the picture changes, and the readout names the pivot.
    const before = await page.locator("#wm-canvas").evaluate((c) => c.toDataURL());
    await page.locator("#wm-angle").fill("40");
    await page.locator("#wm-angle").dispatchEvent("input");
    expect(await page.locator("#wm-canvas").evaluate((c) => c.toDataURL())).not.toBe(before);
    await expect(page.locator("#wm-angle-out")).toHaveText("40°");
  });

  test("the torus: dots start on the flat grid, end on the torus, and the readout agrees", async ({
    page,
  }) => {
    await page.goto("/manual/all.html");
    await page.locator("#ut-readout").scrollIntoViewIfNeeded();
    const readout = async () => page.locator("#ut-readout").innerText();
    const nums = (line, t) =>
      new RegExp(`${t}\\s*\\(([^)]*)\\)`).exec(line)[1].split(",").map(Number);
    let t0 = await readout();
    expect(nums(t0, "Now:")).toEqual(nums(t0, "On the flat sheet:"));
    await page.locator("#ut-progress").fill("1");
    await page.locator("#ut-progress").dispatchEvent("input");
    const t1 = await readout();
    expect(nums(t1, "Now:")).toEqual(nums(t1, "On the torus:"));
    // The torus place is the program's, scaled by 0.55, for the dot's own u and v.
    const m = /u = ([\d.]+)[^]*?v = ([\d.]+)/.exec(t1);
    const [u, v] = [Number(m[1]), Number(m[2])];
    const want = [
      (2 + Math.cos(v)) * Math.cos(u),
      Math.sin(v),
      (2 + Math.cos(v)) * Math.sin(u),
    ].map((w) => w * 0.55);
    nums(t1, "On the torus:").forEach((w, i) => near(w, want[i], 0.0101));
    // Following another dot (the sliders) changes the marked dot.
    await page.locator("#ut-u").fill("0.5");
    await page.locator("#ut-u").dispatchEvent("input");
    expect(await readout()).not.toBe(t1);
    // The carry plays and reaches the end.
    await page.locator("#ut-progress").fill("0");
    await page.locator("#ut-progress").dispatchEvent("input");
    await page.click("#ut-play");
    await expect(page.locator("#ut-progress-out")).toHaveText("1.00", { timeout: 9000 });
  });

  test("the fields: the splats come from the toy's own recipe, and each field moves only what it should", async ({
    page,
  }) => {
    await page.goto("/manual/all.html");
    await page.locator("#pf-fields").scrollIntoViewIfNeeded();
    await expect(page.locator("#pf-fields .field-row")).toHaveCount(12);
    await expect(page.locator("#pf-f-x")).toHaveValue("(2 + cos(v + t))cos(u)");
    const diff = async () => Object.fromEntries(await page.locator("#pf-diff tr").evaluateAll((trs) => trs.map((tr) => [tr.cells[0].innerText.trim(), tr.cells[1].innerText.trim()]))); // prettier-ignore
    const edit = async (f, v) => {
      await page.locator(`#pf-f-${f}`).fill(v);
      await page.locator(`#pf-f-${f}`).dispatchEvent("input");
      await page.waitForTimeout(700);
    };
    // The hue changes the colors, and nothing else.
    await edit("hue", "u/(2pi)");
    let d = await diff();
    expect(d["Where the splats are"]).toBe("the same");
    expect(d["Their sizes"]).toBe("the same");
    expect(d["Their colors"]).toBe("changed");
    // The size changes the sizes, and not the places or the colors.
    await edit("size", "0.12");
    d = await diff();
    expect(d["Where the splats are"]).toBe("the same");
    expect(d["Their colors"]).toBe("the same");
    expect(d["Their sizes"]).toBe("changed");
    // The count changes how many.
    await edit("count", "3000");
    d = await diff();
    expect(d["Count"]).toMatch(/→ [\d,]+ splats \(you asked for 3,000/);
    // A field that cannot be read shows the toy's own message, and the picture stays.
    await edit("x", "(2 + cos(v)");
    await expect(page.locator("#pf-error")).toContainText("brackets");
    await edit("x", "(2 + cos(v + t))cos(u)");
    await expect(page.locator("#pf-error")).toHaveText("");
    // The reset puts the preset back.
    await page.click("#pf-reset");
    await expect(page.locator("#pf-f-count")).toHaveValue("6000");
  });
});

// ---- The budget table ----------------------------------------------------------------------------
test.describe("the budget tables", () => {
  test("every number in the manual's table is the document's, and the counts in the text are counted from it", async ({
    page,
  }) => {
    await page.goto("/manual/all.html");
    const rows = readRows();
    expect(rows.length).toBe(24);
    const cells = await page.locator("table.budget:not(.summary) tbody tr").evaluateAll((trs) => trs.map((tr) => [...tr.cells].map((c) => c.innerText.trim()))); // prettier-ignore
    expect(cells.length).toBe(24);
    rows.forEach((r, i) => {
      const f = (n) => n.toFixed(2);
      expect(cells[i][1], r.name).toBe(`${f(r.edge[1])} → ${f(r.edge[2])}`);
      expect(cells[i][2]).toBe(`${f(r.speckle[1])} → ${f(r.speckle[2])}`);
      expect(cells[i][3]).toBe(`${f(r.shimmer[1])} → ${f(r.shimmer[2])}`);
      expect(cells[i][4]).toBe(r.area ? `${r.area[0]}% → ${r.area[1]}%` : "–");
    });
    const sum = await page.locator("table.budget.summary tbody tr").evaluateAll((trs) => trs.map((tr) => [...tr.cells].map((c) => c.innerText.trim()))); // prettier-ignore
    expect(sum).toEqual(readSummary());
    const { counts } = buildBudget();
    const t = text(html);
    expect(t).toContain(`speckle rose in ${counts.speckleWorse} of the 24 views and shimmer rose in ${counts.shimmerWorse} of them`); // prettier-ignore
    // The most any edge gained between 140k and 200k is the text's 0.06.
    expect(Math.max(...rows.map((r) => r.edge[1] - r.edge[2]))).toBeCloseTo(0.06, 9);
    // The tier numbers in the text are the document's (and the code's).
    for (const w of ["140,000 (the Mid tier)", "200,000 (the High tier)"]) expect(t).toContain(w);
  });

  test("at 1440 by 900 the table, a demo, and the new page all sit in the page's column", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto("/manual/all.html");
    await page.locator(".budget-wrap").first().scrollIntoViewIfNeeded();
    await page.evaluate(() => document.querySelector(".table-note").scrollIntoView());
    await page.screenshot({ path: path.join(SHOTS, "man4-budget-table-1440x900.png") });
    for (const [id, file] of [
      ["demo-railroad", "railroad"],
      ["demo-windmill", "windmill"],
      ["demo-projection", "projection"],
    ]) {
      await page.evaluate((i) => document.getElementById(i).scrollIntoView(), id);
      await page.screenshot({ path: path.join(SHOTS, `man4-demo-${file}-1440x900.png`) });
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
    await ctx.close();
  });

  test("the tables scroll in their own boxes at phone size, and the page does not", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await ctx.newPage();
    await page.goto("/manual/all.html");
    await page.locator("#splat-count").scrollIntoViewIfNeeded();
    const wraps = await page.locator(".budget-wrap").evaluateAll((els) => els.map((e) => [e.scrollWidth, e.clientWidth, e.getAttribute("tabindex"), e.getAttribute("role")])); // prettier-ignore
    expect(wraps.length).toBe(2);
    for (const [sw, cw, tab, role] of wraps) {
      expect(sw).toBeGreaterThan(cw); // it scrolls inside its box
      expect(tab).toBe("0"); // and a keyboard can scroll it
      expect(role).toBe("region");
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
    await page.locator(".budget-wrap").first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, "man4-budget-table-390x844.png") });
    await ctx.close();
  });

  test("the table's tiers and columns match the Kit lab's document", () => {
    const doc = fs.readFileSync("docs/lab/BUDGETS.md", "utf8");
    for (const w of ["| Low  | 60,000       | 120,000", "| Mid  | 140,000      | 240,000", "| High | 200,000      | 300,000", "| Max  | 280,000      | 400,000"]) expect(doc).toContain(w); // prettier-ignore
    const t = text(html);
    expect(t).toContain(
      "budget of 60,000 splats at the Low tier, 140,000 at Mid, 200,000 at High, and 280,000 at Max",
    );
  });
});

// ---- The site page, and the links ---------------------------------------------------------------
test.describe("What Splashery can do", () => {
  test("the page is built from the site's own build, current, and linked from the Learn hub and the manual", async ({
    page,
  }) => {
    const out = execSync("node tools/site-build.mjs --check", { encoding: "utf8" });
    expect(out).toMatch(/site\/ is current/);
    const learn = fs.readFileSync("site/learn/index.html", "utf8");
    expect(learn).toContain('learn/can-do/"');
    expect(learn).toContain("../manual/toy.html#splat-count");
    expect(html).toContain('href="../site/learn/can-do/"');
    for (const f of ["more.html", "unique.html"]) expect(fs.readFileSync(`manual/${f}`, "utf8")).toContain('href="../site/learn/can-do/"'); // prettier-ignore
    await page.goto("/site/learn/can-do/");
    await expect(page.locator("h1")).toHaveText("What Splashery can do");
    // The counts are the catalog's own.
    const { TOYS } = await import("../src/toys.js");
    const open = TOYS.filter((t) => t.category && !t.labs).length;
    const labs = TOYS.filter((t) => t.category && t.labs).length;
    await expect(page.locator("main")).toContainText(
      `there are ${open} toys on the public shelves, and ${labs} more behind the labs switch`,
    );
    // Every toy it links is on the site, and a toy behind labs says so next to its link.
    const links = await page.locator("main a[href*='toys/']").evaluateAll((as) => as.map((a) => [a.getAttribute("href"), a.nextElementSibling?.className || ""])); // prettier-ignore
    expect(links.length).toBeGreaterThan(8);
    for (const [href, next] of links) {
      const m = /toys\/([^/]+)\//.exec(href);
      if (!m) continue; // the link to the toys' index
      const id = m[1];
      const toy = TOYS.find((t) => t.id === id);
      expect(toy, id).toBeTruthy();
      expect(fs.existsSync(`site/toys/${id}/index.html`), id).toBe(true);
      if (toy.labs) expect(next, `${id} is in labs`).toContain("badge");
    }
    // The page makes no claim about a number it did not read: its figures are in the code or the docs.
    const t = await page.locator("main").innerText();
    for (const n of ["60,000 to 400,000 splats", "27 MB", "60,000 to 400,000"])
      expect(t).toContain(n);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
    await page.screenshot({ path: path.join(SHOTS, "man4-can-do-390x844.png") });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: path.join(SHOTS, "man4-can-do-1440x900.png") });
  });

  test("the claims on the page are true to the code", async () => {
    const hubs = fs.readFileSync("tools/site-hubs.mjs", "utf8");
    const page = hubs.slice(hubs.indexOf("can(page, { up })"), hubs.indexOf("made(page, { up })"));
    // The depth model the Splat mirror loads is about 27 MB (the file itself), and the budgets run from the
    // Low tier's 60,000 to the Max tier's most, 400,000.
    const size = fs.statSync("vendor/depth-anything-v2-small/model_quantized.onnx").size;
    expect(size).toBeGreaterThan(26.5e6);
    expect(size).toBeLessThan(27.9e6);
    const { PROFILES } = await import("../src/generators.js");
    expect(PROFILES.low.defaultCount).toBe(60000);
    expect(PROFILES.max.maxCount).toBe(400000);
    expect(page).toContain("60,000 to 400,000 splats");
    // The Detail slider text is the Kit lab's: 60,000 to 400,000.
    expect(fs.readFileSync("docs/lab/DETAIL-SLIDER.md", "utf8")).toContain("60,000 to 400,000");
    expect(page).toContain("60,000 to 400,000");
    // The toys it names behind labs are labs toys (the page reads their flag, and this checks the ones named).
    const { TOYS } = await import("../src/toys.js");
    for (const id of ["fluid-lab", "splat-equation", "photo-3d", "moving-photo-3d", "model-splats", "your-book", "photo-album", "picture-frame", "song-landscape", "chladni-plate", "qr-code", "room-echo", "splat-mirror"]) // prettier-ignore
      expect(
        TOYS.find((t) => t.id === id),
        id,
      ).toBeTruthy();
  });
});

// ---- Print and phone -----------------------------------------------------------------------------
test.describe("print and phone", () => {
  test("in print each demo gives way to its still, and the grammar's tracks are left out", async ({
    page,
  }) => {
    await page.goto("/manual/all.html");
    await page.emulateMedia({ media: "print" });
    for (const d of [
      "gaussian-3d",
      "splat-numbers",
      "bell-1d-to-3d",
      "projection",
      "sort-blend",
      "windmill-parts",
      "uv-torus",
      "program-fields",
      "grammar-railroad",
    ]) {
      // prettier-ignore
      await expect(page.locator(`section[data-demo="${d}"]`)).toBeHidden();
      const still = page.locator(`figure.demo-still[data-demo-still="${d}"] img`);
      await expect(still).toBeVisible();
      expect(await still.evaluate((i) => i.complete && i.naturalWidth > 500), d).toBe(true);
    }
    await expect(page.locator("#rr-rules")).toBeHidden();
  });

  test("at 390 and 320 pixels no demo makes the page scroll sideways, and every control is reachable", async ({
    browser,
  }) => {
    for (const w of [390, 320]) {
      const ctx = await browser.newContext({
        viewport: { width: w, height: 800 },
        hasTouch: true,
        isMobile: true,
      });
      const page = await ctx.newPage();
      await page.goto("/manual/all.html");
      for (const id of [
        "demo-railroad",
        "demo-gaussian",
        "demo-numbers",
        "demo-bell",
        "demo-projection",
        "demo-blend",
        "demo-windmill",
        "demo-uvtorus",
        "demo-fields",
      ]) {
        // prettier-ignore
        await page.locator(`#${id}`).scrollIntoViewIfNeeded();
        const over = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(over, `${id} at ${w}px`).toBe(0);
        // Each demo's own box fits the screen.
        const box = await page.locator(`#${id}`).boundingBox();
        expect(box.width, id).toBeLessThanOrEqual(w);
      }
      if (w === 390) {
        for (const [id, file] of [
          ["demo-numbers", "numbers"],
          ["demo-projection", "projection"],
          ["demo-windmill", "windmill"],
          ["demo-uvtorus", "torus"],
          ["demo-railroad", "railroad"],
          ["demo-blend", "blend"],
          ["demo-bell", "bell"],
          ["demo-gaussian", "gaussian"],
          ["demo-fields", "fields"],
        ]) {
          // prettier-ignore
          await page.locator(`#${id}`).scrollIntoViewIfNeeded();
          await page.evaluate((i) => document.getElementById(i).scrollIntoView(), id);
          await page.screenshot({ path: path.join(SHOTS, `man4-demo-${file}-390x844.png`) });
        }
      }
      await ctx.close();
    }
  });
});

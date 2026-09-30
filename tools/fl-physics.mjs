#!/usr/bin/env node
// Lane Fluids: the fluid engine measured against known physics (docs/FLUIDS.md,
// "Checked against physics"). Runs the solver in Node, no browser:
//
//   node tools/fl-physics.mjs [--out=file.json]
//
// Each check prints what was measured, what the physics says and the source.
// All in real units: the Fluid lab's recipe unit is 0.33 m (unit: 0.33).
// This is graphics physics; the point is to say plainly where it matches and
// where it does not, not to validate a solver.

import fs from "node:fs";
import { FluidWorld } from "../src/fluids/world.js";
import { RECIPES } from "../src/packs/fluid-lab.js";
import { Kit } from "../src/kit.js";

const UNIT = 0.33;
const G = 9.8 / UNIT; // recipe units per s²
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const results = {};

function sceneWorld(scene, liquid = "water", profile = "high") {
  const k = new Kit(1, { count: 20000 });
  RECIPES["fluid-lab"].build(k, { scene, liquid });
  return { world: new FluidWorld(k.fluids, { profile, seed: 1 }), data: k.data };
}

// Least-squares slope and intercept.
function fit(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx };
}

const pct = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};

// ---- 1. Candle flame flicker ----------------------------------------------------------
{
  const { world } = sceneWorld("candle");
  const flame = world.byName.get("flame");
  const dt = 1 / 240;
  const tip = [];
  for (let s = 0; s < 240 * 6; s++) {
    world.step(dt);
    if (s < 240) continue;
    const ys = [];
    for (let i = 0; i < flame.n; i++) if (flame.pkind[i] === 7) ys.push(flame.pos[i * 3 + 1]);
    tip.push(pct(ys, 0.95));
  }
  // The strongest frequency between 0.5 and 30 Hz (a direct Fourier sum).
  const mean = tip.reduce((a, b) => a + b, 0) / tip.length;
  let best = { f: 0, p: 0 };
  const spectrum = [];
  for (let f = 0.5; f <= 30; f += 0.1) {
    let re = 0;
    let im = 0;
    tip.forEach((v, i) => {
      re += (v - mean) * Math.cos(2 * Math.PI * f * i * dt);
      im += (v - mean) * Math.sin(2 * Math.PI * f * i * dt);
    });
    const p = re * re + im * im;
    spectrum.push([+f.toFixed(1), p]);
    if (p > best.p) best = { f, p };
  }
  const height = pct(tip, 0.5) - flame.at[1];
  results.flicker = {
    measuredHz: +best.f.toFixed(1),
    expectedHz: [10, 12],
    flameHeightCm: +(height * UNIT * 100).toFixed(1),
    source:
      "Kitahata et al. 2009, J. Phys. Chem. A 113, 8164 (candle flames oscillate near 10 Hz); Cetegen and Ahmed 1993, Combust. Flame 93, 157 (flicker f ≈ 1.5/√D).",
    spectrum: spectrum.filter((_, i) => i % 3 === 0),
  };
}

// ---- 2. Plume spreading (steam over the cup, smoke after the candle is blown out) ------
function plume(world, gasName, sourceY, warm, secs, extra) {
  const gas = world.byName.get(gasName);
  const dt = 1 / 60;
  const bins = new Map();
  for (let s = 0; s < 60 * (warm + secs); s++) {
    extra?.(s * dt);
    world.step(dt);
    if (s < 60 * warm || s % 3) continue;
    for (let i = 0; i < gas.n; i++) {
      const h = gas.pos[i * 3 + 1] - sourceY;
      if (h < 0) continue;
      const b = Math.floor(h / 0.1);
      if (!bins.has(b)) bins.set(b, []);
      bins.get(b).push(gas.pos[i * 3]);
    }
  }
  // Gaussian half-width b = √2 σ of the sideways positions, per height.
  const rows = [...bins.entries()]
    .filter(([, xs]) => xs.length > 60)
    .map(([b, xs]) => {
      const m = xs.reduce((a, c) => a + c, 0) / xs.length;
      const sd = Math.sqrt(xs.reduce((a, c) => a + (c - m) ** 2, 0) / xs.length);
      return { z: (b + 0.5) * 0.1, halfWidth: Math.SQRT2 * sd };
    })
    .sort((a, c) => a.z - c.z);
  return rows;
}
{
  const { world } = sceneWorld("cup");
  const rows = plume(world, "steam", 0.58, 2, 6);
  const upper = rows.filter((r) => r.z >= 0.2 && r.z <= 1.2);
  const f = fit(
    upper.map((r) => r.z),
    upper.map((r) => r.halfWidth),
  );
  const { world: w2 } = sceneWorld("candle");
  const rows2 = plume(w2, "smoke", 0.99, 0.5, 3, (t) =>
    w2.command({ flame: { on: t < 0.5 }, smoke: { on: t >= 0.5 && t < 2.5, flow: 1 } }),
  );
  const upper2 = rows2.filter((r) => r.z >= 0.3 && r.z <= 1.2);
  const f2 = upper2.length > 2 ? fit(upper2.map((r) => r.z), upper2.map((r) => r.halfWidth)) : { slope: NaN }; // prettier-ignore
  results.plume = {
    steamSpread: +f.slope.toFixed(3),
    smokeSpread: +f2.slope.toFixed(3),
    expectedSpread: [0.1, 0.14],
    steamRows: rows.map((r) => [
      +(r.z * UNIT * 100).toFixed(0),
      +(r.halfWidth * UNIT * 100).toFixed(1),
    ]),
    smokeRows: rows2.map((r) => [
      +(r.z * UNIT * 100).toFixed(0),
      +(r.halfWidth * UNIT * 100).toFixed(1),
    ]),
    source:
      "Morton, Taylor and Turner 1956, Proc. R. Soc. A 234, 1: a turbulent plume widens linearly, db/dz = 6α/5 with entrainment α ≈ 0.08 to 0.12, so db/dz ≈ 0.10 to 0.14.",
  };
}

// ---- 3. A blob spreading on a floor: inertial (water) and viscous (honey) ------------
function spread(preset) {
  const world = new FluidWorld(
    [
      {
        name: "l",
        kind: "liquid",
        preset,
        unit: UNIT,
        spacing: 0.035,
        budget: 2400,
        colliders: [{ type: "floor", y: 0 }],
        fill: { sphere: { at: [0, 0.3, 0], radius: 0.25 } },
      },
    ],
    { profile: "high", seed: 3 },
  );
  const sys = world.systems[0];
  const rows = [];
  let t = 0;
  let touch = null;
  for (let s = 0; s < 120 * 8; s++) {
    world.step(1 / 120);
    t += 1 / 120;
    let minY = Infinity;
    for (let i = 0; i < sys.n; i++) minY = Math.min(minY, sys.pos[i * 3 + 1]);
    if (touch === null && minY < sys.rad * 1.5) touch = t;
    if (touch === null || s % 6) continue;
    const r = [];
    for (let i = 0; i < sys.n; i++) r.push(Math.hypot(sys.pos[i * 3], sys.pos[i * 3 + 2]));
    rows.push([t - touch, pct(r, 0.97)]);
  }
  return rows;
}
{
  const out = {};
  for (const preset of ["water", "honey"]) {
    const rows = spread(preset).filter(([t]) => t > 0.05);
    const early = rows.filter(([t]) => t >= 0.05 && t <= 0.4);
    const late = rows.filter(([t]) => t >= 1 && t <= 6);
    const fe = fit(
      early.map(([t]) => Math.log(t)),
      early.map(([, r]) => Math.log(r)),
    );
    const fl = fit(
      late.map(([t]) => Math.log(t)),
      late.map(([, r]) => Math.log(r)),
    );
    out[preset] = {
      earlyExponent: +fe.slope.toFixed(2),
      lateExponent: +fl.slope.toFixed(2),
      finalRadiusCm: +(rows[rows.length - 1][1] * UNIT * 100).toFixed(1),
      rows: rows
        .filter((_, i) => i % 4 === 0)
        .map(([t, r]) => [+t.toFixed(2), +(r * UNIT * 100).toFixed(1)]),
    };
  }
  results.spread = {
    ...out,
    expected: { inertial: 0.5, viscous: 0.125 },
    source:
      "Huppert and Simpson 1980, J. Fluid Mech. 99, 785 (an inertial current of fixed volume spreads as t^1/2); Huppert 1982, J. Fluid Mech. 121, 43 (a viscous one as t^1/8, axisymmetric).",
  };
}

// ---- 4. Dam break -------------------------------------------------------------------------
{
  const a = 0.3; // column width (x), height 2a, in a channel 0.6 wide (z; a narrower one drags the front on its walls)
  const walls = [
    { type: "floor", y: 0 },
    { type: "box", at: [-0.1, 0.5, 0], size: [0.2, 2, 1] },
    { type: "box", at: [2, 0.5, -0.35], size: [4.4, 2, 0.1] },
    { type: "box", at: [2, 0.5, 0.35], size: [4.4, 2, 0.1] },
  ];
  const world = new FluidWorld(
    [{ name: "l", kind: "liquid", preset: "water", unit: UNIT, spacing: 0.03, budget: 7500, colliders: walls, fill: { box: [[0, 0, -0.3], [a, 2 * a, 0.3]] } }], // prettier-ignore
    { profile: "high", seed: 5 },
  );
  const sys = world.systems[0];
  const rows = [];
  for (let s = 0; s < 120 * 1.2; s++) {
    world.step(1 / 120);
    if (s % 3) continue;
    const xs = [];
    for (let i = 0; i < sys.n; i++) if (sys.pos[i * 3 + 1] < 0.1) xs.push(sys.pos[i * 3]);
    const front = pct(xs, 0.99) + sys.rad;
    const t = (s + 1) / 120;
    rows.push([+(t * Math.sqrt((2 * G) / a)).toFixed(2), +(front / a).toFixed(2)]);
  }
  const mid = rows.filter(([T]) => T >= 1 && T <= 3);
  const f = fit(
    mid.map(([T]) => T),
    mid.map(([, Z]) => Z),
  );
  // Martin and Moyce 1952, Table 2 (n² = 2, the mean of their runs with
  // a = 1⅛ in): the front Z at time T.
  const mm = [[1.19, 1.44], [1.58, 1.89], [1.91, 2.33], [2.23, 2.78], [2.58, 3.22], [2.91, 3.67], [3.26, 4.11], [3.6, 4.56], [3.92, 5.0], [4.26, 5.44], [4.61, 5.89], [4.95, 6.33], [5.32, 6.76]]; // prettier-ignore
  const at = (T) => {
    const j = rows.findIndex(([t]) => t >= T);
    const [t0, z0] = rows[j - 1];
    const [t1, z1] = rows[j];
    return z0 + ((z1 - z0) * (T - t0)) / (t1 - t0);
  };
  const vs = mm.map(([T, Z]) => [T, Z, +at(T).toFixed(2)]);
  const fm = fit(
    mm.map(([T]) => T),
    mm.map(([, Z]) => Z),
  );
  const fo = fit(
    vs.map(([T]) => T),
    vs.map(([, , z]) => z),
  );
  results.damBreak = {
    frontSlope: +fo.slope.toFixed(2),
    measuredSlope: +fm.slope.toFixed(2),
    ritterSlope: 2,
    vsMartinMoyce: vs,
    rms: +Math.sqrt(vs.reduce((a, [, Z, z]) => a + (Z - z) ** 2, 0) / vs.length).toFixed(2),
    rows,
    source:
      "Ritter 1892 (ideal dam break: the front runs at 2√(gH), dZ/dT = 2 in Martin and Moyce's variables Z = x/a, T = t√(2g/a)); Martin and Moyce 1952, Phil. Trans. R. Soc. A 244, 312 (measured fronts run slower than this ideal: their Table 2 is compared point by point).",
  };
}

// ---- 5. A falling stream narrows ------------------------------------------------------------
{
  const { world } = sceneWorld("glass", "water");
  const sys = world.byName.get("liquid");
  const e = sys.emitter;
  const slices = new Map();
  for (let s = 0; s < 120 * 2.2; s++) {
    world.command({ liquid: { on: true } });
    world.step(1 / 120);
    if (s < 120 * 0.8 || s % 2) continue;
    for (let i = 0; i < sys.n; i++) {
      const drop = e.at[1] - sys.pos[i * 3 + 1];
      if (drop < 0.05 || drop > 0.8) continue;
      const k = Math.round(drop / 0.1);
      if (!slices.has(k)) slices.set(k, []);
      slices.get(k).push(Math.hypot(sys.pos[i * 3] - e.at[0], sys.pos[i * 3 + 2] - e.at[2]));
    }
  }
  const v0 = e.speed;
  const rows = [...slices.entries()]
    .sort((a, b) => a[0] - b[0])
    .filter(([, rs]) => rs.length > 30)
    .map(([k, rs]) => {
      const z = k * 0.1;
      const rms = Math.sqrt(rs.reduce((a, r) => a + r * r, 0) / rs.length);
      return { z, rms, theory: Math.pow(1 + (2 * G * z) / (v0 * v0), -0.25) };
    });
  const r0 = rows[0];
  results.stream = {
    rows: rows.map((r) => [
      +(r.z * UNIT * 100).toFixed(0),
      +(r.rms / r0.rms).toFixed(2),
      +(r.theory / r0.theory).toFixed(2),
    ]),
    particleCm: +(sys.d * UNIT * 100).toFixed(1),
    source:
      "Mass conservation in free fall: a stream leaving at speed v0 has radius r ∝ (1 + 2gz/v0²)^(-1/4) at a depth z below the nozzle (e.g. Eggers and Villermaux 2008, Rep. Prog. Phys. 71, 036601).",
  };
}

// ---- 6. Soda bubbles rise ----------------------------------------------------------------------
{
  const { world } = sceneWorld("glass", "soda");
  const sys = world.byName.get("liquid");
  const vs = [];
  for (let s = 0; s < 120 * 3; s++) {
    world.step(1 / 120);
    if (s < 120) continue;
    for (let i = 0; i < sys.dn; i++) if (sys.dkind[i] === 3) vs.push(sys.dvel[i * 3 + 1]);
  }
  const m = vs.reduce((a, b) => a + b, 0) / Math.max(1, vs.length);
  results.bubbles = {
    riseCmPerS: +(m * UNIT * 100).toFixed(1),
    expectedCmPerS: [10, 20],
    source:
      "Clift, Grace and Weber 1978, Bubbles, Drops and Particles: air bubbles of about 1 mm rise through water at roughly 10 to 20 cm/s.",
  };
}

console.log(JSON.stringify({ ...results, flicker: { ...results.flicker, spectrum: undefined } }, (k, v) => (Array.isArray(v) && v.length > 12 ? `[${v.length} rows]` : v), 2)); // prettier-ignore
const out = opt("out", "");
if (out) fs.writeFileSync(out, JSON.stringify(results, null, 2));

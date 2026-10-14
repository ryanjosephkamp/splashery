// Lane Fluids r4: a liquid simulated on the GPU (MLS-MPM, mpm.js), with the
// same recipe spec and commands as the CPU Liquid in sim.js: an emitter that
// pours, a fill, a drop, a drain and a reset. It lives in recipe units on
// the outside; inside, the solver works in grid cells (h recipe units each).

import * as pc from "../../pc.js";
import { GpuMpm, packColliders } from "./mpm.js";
import { LIQUIDS, unit3 } from "../sim.js";
import { GpuDiffuse } from "./diffuse.js";
import { PHONE_ENV } from "../phone.js";

// Cell size (recipe units, for a recipe unit of 0.33 m) and the most
// substeps a frame may take, per tier. The particle spacing is half a cell
// (8 particles per cell at rest). A slower device runs in slow motion rather
// than take longer steps.
// The viscous step limit (nu * dt, cells^2): r4 allowed 0.12, which blew lava up.
const VISC_STEP = 0.05;

export const GPU_TIERS = {
  // Phones (r5, the owner's "it's causing my phone to really lag"): about
  // a third of r4's particles, a coarser grid and half the substeps (60
  // frames a second still run in real time); a softer sound speed lets
  // them. Computers (high, max) are unchanged.
  low: { cell: 0.05, maxSub: 10, cap: 6000, diffuse: 0.3, sound: 6 },
  mid: { cell: 0.04, maxSub: 12, cap: 14000, diffuse: 0.4, sound: 6 },
  high: { cell: 0.022, maxSub: 36, cap: 120000, diffuse: 1 },
  max: { cell: 0.018, maxSub: 44, cap: 200000, diffuse: 1.3 },
};

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The box the liquid can reach: its colliders, emitter and fill, padded.
function domainOf(spec) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  const add = (p, r = 0) => {
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], p[k] - r);
      hi[k] = Math.max(hi[k], p[k] + r);
    }
  };
  for (const c of spec.colliders || []) {
    const at = c.at || [0, 0, 0];
    if (c.type === "glass" || c.type === "cylinder") {
      const R = (c.radius ?? 0.3) + (c.wall ?? 0.03);
      add([at[0] - R, at[1], at[2] - R]);
      add([at[0] + R, at[1] + (c.height ?? 1), at[2] + R]);
    } else if (c.type === "bowl") {
      const R = (c.radius ?? 0.5) + (c.wall ?? 0.03);
      add([at[0] - R, at[1] - R, at[2] - R]);
      add([at[0] + R, at[1], at[2] + R]);
    } else if (c.type === "box") {
      const s = c.size || [1, 1, 1];
      add(at, 0);
      add([at[0] - s[0] / 2, at[1] - s[1] / 2, at[2] - s[2] / 2]);
      add([at[0] + s[0] / 2, at[1] + s[1] / 2, at[2] + s[2] / 2]);
    }
  }
  const f = spec.fill;
  if (f?.box) {
    add(f.box[0]);
    add(f.box[1]);
  } else if (f?.cylinder) {
    const c = f.cylinder;
    add([c.at[0] - c.radius, c.at[1], c.at[2] - c.radius]);
    add([c.at[0] + c.radius, c.at[1] + c.height, c.at[2] + c.radius]);
  }
  if (spec.emitter?.at) add(spec.emitter.at, (spec.emitter.radius ?? 0.05) * 2);
  // (a tap's dropped ball starts inside the grid)
  if (spec.drop?.at) add(spec.drop.at, (spec.drop.radius ?? 0.1) + 0.05);
  if (spec.domain) {
    add(spec.domain[0]);
    add(spec.domain[1]);
  }
  if (!Number.isFinite(lo[0])) return [[-1, 0, -1], [1, 2, 1]]; // prettier-ignore
  // Room to splash over the rim and to fall from the emitter.
  const pad = [0.12, 0.05, 0.12];
  const floor = (spec.colliders || []).find((c) => c.type === "floor");
  return [
    [lo[0] - pad[0], floor ? Math.min(lo[1], floor.y ?? 0) : lo[1] - pad[1], lo[2] - pad[2]],
    [hi[0] + pad[0], hi[1] + 0.25, hi[2] + pad[2]],
  ];
}

export class GpuLiquid {
  constructor(
    recipeSpec,
    { device, profile = "high", gravity, seed = 1, unit = 0.1, phone = false },
  ) {
    // A recipe's `gpu` settings override the rest on this solver (a pool,
    // ball or wall friction sized for its finer grid); the CPU keeps the rest.
    const spec = recipeSpec.gpu ? { ...recipeSpec, ...recipeSpec.gpu } : recipeSpec;
    const preset = LIQUIDS[spec.preset] || LIQUIDS.water;
    // (r7: the phone envelope swaps in a smaller cell count and particle cap)
    const tier = { ...(GPU_TIERS[profile] || GPU_TIERS.high), ...(phone ? PHONE_ENV.gpu : null) };
    this.spec = spec;
    this.preset = preset;
    this.kind = "liquid";
    this.gpu = true;
    this.name = spec.name;
    this.rand = mulberry(seed * 7919 + 17);
    // Cell size scales with the recipe's unit so a meter is a meter.
    const h = (spec.gpuCell ?? tier.cell) * (0.33 / (spec.unit ?? unit ?? 0.33));
    this.h = h;
    this.d = h * 0.5; // particle spacing (recipe units)
    this.rad = this.d * 0.5;
    const [lo, hi] = domainOf(spec);
    this.origin = lo.map((v, k) => v - 2 * h);
    const dims = hi.map((v, k) => Math.ceil((v - lo[k]) / h) + 4);
    this.dims = dims;
    this.cap = Math.min(spec.gpuCap ?? tier.cap, 400000);
    this.maxSub = spec.gpuMaxSub ?? tier.maxSub;
    this.sim = new GpuMpm(device, { cap: this.cap, grid: dims, texWidth: 1024 });
    this.colliders = spec.colliders || [];
    const pk = packColliders(this.colliders, (p) => this.toGrid(p), 1 / h);
    Object.assign(this.sim.params, { cols: pk.data, ncol: pk.count });
    // Gravity in cells/s^2.
    this.gravity = gravity.map((g) => g / h);
    this.sim.params.gravity = [...this.gravity, 0];
    // Material: stiffness from a sound speed (recipe units/s) well above the
    // pool's own speeds; viscosity from the preset (0 water .. 1 lava).
    const vis = spec.viscosity ?? preset.viscosity ?? 0.04;
    this.visc = vis;
    // (8 recipe units/s: a column of water a glass deep compresses by a few
    // percent, not a quarter; each doubling doubles the substeps)
    const c = (spec.soundSpeed ?? tier.sound ?? 8) / h; // cells/s
    const rho0 = 8;
    this.sim.params.rho0 = rho0;
    this.sim.params.stiffness = (rho0 * c * c) / 7;
    this.sound = c;
    // Kinematic viscosity: real values (m^2/s) for the presets, in cells^2/s.
    const hm = h * (spec.unit ?? unit ?? 0.33);
    const NU = { water: 1e-6, soda: 1e-6, syrup: 1e-3, honey: 4e-3, lava: 1e-2 };
    const nuM = spec.nu ?? NU[spec.preset] ?? 1e-6 * Math.pow(10, 5 * vis);
    this.nu = Math.max(0.05, nuM / (hm * hm));
    this.sim.params.viscosity = rho0 * this.nu;
    // How far below rest density the liquid may pull (0.01 of its stiffness
    // for water: more stands it up as a dome in a glass). Honey and lava hold
    // together, so a thinning thread of them stays one thread.
    this.sim.params.tension = spec.tension ?? (vis > 0.3 ? 0.15 : 0.01);
    // Friction along walls: water slides (a thin boundary layer, far below
    // a cell), honey and lava hold back.
    this.sim.params.friction = (spec.friction ?? preset.friction ?? 0.05) * 1.5;
    this.emitter = spec.emitter ? { on: false, flow: 1, travel: 0, ...spec.emitter } : null;
    if (this.emitter?.gpuRadius) this.emitter.radius = this.emitter.gpuRadius;
    this.drain = 0;
    this.time = 0;
    this.stats = { substeps: 0, dt: 0 };
    // Spray and foam where it splashes; a soda's bubbles and head.
    const foam = spec.foam ?? preset.foam ?? 0;
    const fizz = spec.fizz ?? preset.fizz ?? 0;
    // (every liquid reads itself back for its sound, acoustic.js; one without
    // foam keeps a token budget)
    const breakup = spec.breakup ?? 0;
    const cap = foam > 0 || fizz > 0 || breakup > 0 ? Math.round((fizz > 0 ? 9000 : breakup > 0 ? 6000 : 2500) * (spec.diffuse ?? 1) * (tier.diffuse ?? 1)) : 256; // prettier-ignore
    this.diffuse = new GpuDiffuse(this, { foam, fizz, breakup, cap });
    // (fillShare: how much of the budget the starting pool may take, leaving
    // room for what a tap adds, such as the splash's dropped ball)
    // (a lava's starting pool has long since crusted over: r6)
    const fillAge = spec.fillAge ?? (spec.preset === "lava" ? 8 : 0);
    if (spec.fill) this.fill(spec.fill, { count: Math.floor(this.cap * (spec.fillShare ?? 1)), age: fillAge }); // prettier-ignore
  }

  get n() {
    return this.sim.count;
  }
  set n(v) {
    if (v === 0) {
      this.sim.reset();
      if (this.diffuse) this.diffuse.n = 0;
    }
  }

  toGrid(p) {
    return [(p[0] - this.origin[0]) / this.h, (p[1] - this.origin[1]) / this.h, (p[2] - this.origin[2]) / this.h]; // prettier-ignore
  }

  // Grid units -> recipe units, as a matrix (for the surface pass).
  simToRecipe() {
    const h = this.h;
    return new pc.Mat4().setTRS(
      new pc.Vec3(...this.origin),
      pc.Quat.IDENTITY,
      new pc.Vec3(h, h, h),
    );
  }

  // (age: seconds since it left the spout, for a lava's cooling)
  add(pts, vel, age = 0) {
    if (!pts.length) return 0;
    const g = new Float32Array(pts.length);
    for (let i = 0; i < pts.length; i += 3) {
      const q = this.toGrid([pts[i], pts[i + 1], pts[i + 2]]);
      g[i] = q[0];
      g[i + 1] = q[1];
      g[i + 2] = q[2];
    }
    const v = vel ? new Float32Array(vel.length) : null;
    if (vel) for (let i = 0; i < vel.length; i++) v[i] = vel[i] / this.h;
    return this.sim.add(g, v, 0, age);
  }

  // As Liquid.fill: { box }, { cylinder }, { sphere }; clipped by below/above;
  // places inside a collider are skipped.
  fill(region, { count = Infinity, vel = [0, 0, 0], age = 0 } = {}) {
    const d = this.d;
    let lo;
    let hi;
    let inside;
    if (region.box) {
      [lo, hi] = region.box;
      inside = () => true;
    } else if (region.cylinder) {
      const c = region.cylinder;
      lo = [c.at[0] - c.radius, c.at[1], c.at[2] - c.radius];
      hi = [c.at[0] + c.radius, c.at[1] + c.height, c.at[2] + c.radius];
      inside = (x, y, z) => Math.hypot(x - c.at[0], z - c.at[2]) <= c.radius;
    } else if (region.sphere) {
      const c = region.sphere;
      // (shape: [x, top, z, bottom] radii as fractions, a drop's shape: r6)
      const sh = c.shape || [1, 1, 1, 1];
      const ext = Math.max(...sh);
      lo = c.at.map((v) => v - c.radius * ext);
      hi = c.at.map((v) => v + c.radius * ext);
      inside = (x, y, z) => {
        const dy = y - c.at[1];
        const sy = dy > 0 ? sh[1] : sh[3];
        return Math.hypot((x - c.at[0]) / sh[0], dy / sy, (z - c.at[2]) / sh[2]) <= c.radius;
      };
    } else return 0;
    const pts = [];
    const vs = [];
    const room = this.cap - this.n;
    for (let y = lo[1] + d / 2; y <= hi[1]; y += d)
      for (let x = lo[0] + d / 2; x <= hi[0]; x += d)
        for (let z = lo[2] + d / 2; z <= hi[2]; z += d) {
          if (pts.length / 3 >= Math.min(count, room)) break;
          const jx = x + (this.rand() - 0.5) * d * 0.1;
          const jz = z + (this.rand() - 0.5) * d * 0.1;
          if (!inside(jx, y, jz)) continue;
          if (y > (region.below ?? Infinity) || y < (region.above ?? -Infinity)) continue;
          if (this.solidAt(jx, y, jz, this.rad)) continue;
          pts.push(jx, y, jz);
          vs.push(vel[0], vel[1], vel[2]);
        }
    return this.add(pts, vs, age);
  }

  // A rough solid test for fills (glass walls and bottoms, bowls).
  solidAt(x, y, z, r) {
    for (const c of this.colliders) {
      const at = c.at || [0, 0, 0];
      if (c.type === "glass" || c.type === "cylinder") {
        const R = c.radius ?? 0.3;
        const q = Math.hypot(x - at[0], z - at[2]);
        if (y - at[1] < (c.bottom ?? 0.05) + r && q < R + (c.wall ?? 0.03)) return true;
        if (q > R - r && q < R + (c.wall ?? 0.03) + r && y - at[1] < (c.height ?? 1)) return true;
      } else if (c.type === "floor") {
        if (y < (c.y ?? 0) + r) return true;
      } else if (c.type === "bowl") {
        const q = Math.hypot(x - at[0], y - at[1], z - at[2]);
        if (q > (c.radius ?? 0.5) - r && y < at[1]) return true;
      }
    }
    return false;
  }

  drop(at, radius, vel = [0, 0, 0]) {
    const o = this.spec.drop;
    if (o) [at, radius, vel] = [o.at ?? at, o.radius ?? radius, o.vel ?? vel];
    const want = Math.floor(((4 / 3) * Math.PI * radius ** 3) / this.d ** 3);
    if (this.cap - this.n < want) this.trimTop(want - (this.cap - this.n));
    return this.fill({ sphere: { at, radius, shape: o?.shape } }, { vel });
  }

  // Makes room at the end (the GPU keeps no order; the last ones go).
  trimTop(k) {
    this.sim.trim(k);
  }

  emit(dt) {
    const e = this.emitter;
    if (!e || !e.on || e.flow <= 0) return;
    const speed = (e.speed ?? 1) * e.flow;
    const d = this.d;
    const R = Math.max(e.radius ?? d, d);
    if (!e.layer || e.layerR !== R) {
      const pts = [];
      const m = Math.ceil(R / d);
      for (let a = -m; a <= m; a++)
        for (let b = -m; b <= m; b++) {
          const ra = (a + (b & 1) * 0.5) * d;
          const rb = b * d * 0.866;
          if (ra * ra + rb * rb <= R * R + 1e-9) pts.push([ra, rb]);
        }
      e.layer = pts;
      e.layerR = R;
      e.gap = (pts.length * d ** 3) / (Math.PI * R * R);
    }
    e.travel += speed * dt;
    const frame = speed * dt;
    const dir = unit3(e.dir || [0, -1, 0]);
    const a = Math.abs(dir[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const u = unit3([a[1] * dir[2] - a[2] * dir[1], a[2] * dir[0] - a[0] * dir[2], a[0] * dir[1] - a[1] * dir[0]]); // prettier-ignore
    const v = [dir[1] * u[2] - dir[2] * u[1], dir[2] * u[0] - dir[0] * u[2], dir[0] * u[1] - dir[1] * u[0]]; // prettier-ignore
    const pts = [];
    const vs = [];
    while (e.travel >= e.gap) {
      e.travel -= e.gap;
      const lag = e.travel;
      const spin = this.rand() * 6.283;
      const cs = Math.cos(spin);
      const sn = Math.sin(spin);
      for (const [ra, rb] of e.layer) {
        const pa = ra * cs - rb * sn;
        const pb = ra * sn + rb * cs;
        // Placed upstream, in the spout, by the part of this frame still to
        // come: the step then carries every layer out under gravity, so each
        // frame's piece of stream meets the one before (placed downstream, a
        // piece lags the one before by g dt² / 2 and a stream falls as a
        // stack of blobs).
        const l = lag - frame + (this.rand() - 0.5) * Math.min(d, e.gap) * 0.4;
        for (let k = 0; k < 3; k++) pts.push(e.at[k] + u[k] * pa + v[k] * pb + dir[k] * l);
        vs.push(dir[0] * speed, dir[1] * speed, dir[2] * speed);
      }
    }
    if (pts.length) this.add(pts, vs);
  }

  // Advances dt seconds: substeps sized by the fastest motion (the stream
  // and the sound speed), at most maxSub (slow motion beyond that).
  step(dt) {
    // Substeps sized by the fastest motion; a frame longer than maxSub of
    // them runs in slow motion, and the emitter and drain follow the time
    // actually simulated.
    const g = Math.hypot(...this.gravity);
    const vmax = (this.emitter?.speed ?? 0) / this.h + Math.sqrt(2 * g * this.dims[1]);
    const dtSound = 0.8 / (this.sound + vmax);
    const dtMax = Math.min(dtSound, VISC_STEP / Math.max(1e-6, this.nu));
    const n = Math.min(this.maxSub, Math.max(1, Math.ceil(dt / dtMax - 1e-6)));
    const sub = Math.min(dt / n, dtSound);
    // Explicit viscosity is stable only while nu * dt stays below about
    // VISC_STEP cells^2; past the tier's substeps, a stiffer liquid (lava) is
    // capped there rather than blowing up (r4's lava did).
    this.sim.params.viscosity = this.sim.params.rho0 * Math.min(this.nu, VISC_STEP / sub);
    const simDt = n * sub;
    this.time += simDt;
    this.emit(simDt);
    if (this.drain > 0 && this.n) {
      this.drainAcc = (this.drainAcc || 0) + this.drain * simDt * this.cap;
      const k = Math.floor(this.drainAcc);
      this.drainAcc -= k;
      if (k) this.sim.trim(k);
    }
    if (!this.n) return 0;
    this.sim.params.dt = sub;
    // The CPU's share of a frame: encoding the dispatches (the GPU runs them).
    const t0 = performance.now();
    this.sim.step(n);
    this.stats.encodeMs = performance.now() - t0;
    this.diffuse?.step(simDt);
    this.stats.substeps = n;
    this.stats.dt = sub;
    this.stats.slow = simDt / dt;
    return n;
  }

  get texture() {
    return this.sim.outTex;
  }

  destroy() {
    this.diffuse?.destroy();
    this.sim.destroy();
  }
}

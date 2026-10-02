// Lane Fluids: the fluid solver (docs/FLUIDS.md). Pure JavaScript with no
// DOM, so it runs on the page, in a worker and in the Node tests alike.
//
//   liquid  position-based fluids (Macklin and Müller 2013): particles that
//           keep their density by moving each other apart, with XSPH
//           viscosity from water to lava, a little cohesion, and diffuse
//           particles (spray, foam and bubbles) where the flow breaks up
//           or a soda fizzes.
//   gas     smoke and steam: particles that rise, slow, spread and fade in
//           a divergence-free curl field (a sum of moving sine vortices),
//           laminar near the source and turbulent higher up.
//   flame   short-lived particles that rise from a wick, narrow into a
//           tongue, flicker and cool through the flame's color ramp, with
//           sparks, and hand their last heat to a smoke system.
//
// Everything is in the recipe's own units (y up). Colliders are signed
// distance functions (below). This is graphics physics: plausible motion,
// not a validated scientific solver.

import { mulberry32, mixSeed } from "../noise.js";

// Particle kinds, as the renderer reads them (src/fluids/render.js).
export const KIND = {
  dead: 0,
  liquid: 1,
  foam: 2,
  bubble: 3,
  spray: 4,
  smoke: 5,
  steam: 6,
  flame: 7,
  spark: 8,
  vessel: 9,
  sheet: 10,
};

// Liquids by name. viscosity 0..1 (water to lava), cohesion (how much the
// surface holds together), friction at walls, foam and fizz (soda), glow
// (lava's own light) and the color.
export const LIQUIDS = {
  water: { color: "#6fbfe9", viscosity: 0.04, cohesion: 0.06, friction: 0.05, foam: 0.15, fizz: 0, glow: 0 }, // prettier-ignore
  soda: { color: "#3b190b", viscosity: 0.03, cohesion: 0.06, friction: 0.05, foam: 1, fizz: 1, glow: 0 }, // prettier-ignore
  syrup: { color: "#b8641c", viscosity: 0.45, cohesion: 0.12, friction: 0.4, foam: 0, fizz: 0, glow: 0, stretch: 0.1 }, // prettier-ignore
  honey: { color: "#e0a019", viscosity: 0.75, cohesion: 0.16, friction: 0.7, foam: 0, fizz: 0, glow: 0, stretch: 0.16 }, // prettier-ignore
  lava: { color: "#ff5a12", viscosity: 0.9, cohesion: 0.12, friction: 0.85, foam: 0, fizz: 0, glow: 1, stretch: 0.16 }, // prettier-ignore
};

// ---- Colliders ----------------------------------------------------------------------------
//
// { type: "floor", y }                          everything below y is solid
// { type: "box", at, size }                     a solid box (center, full sizes)
// { type: "sphere", at, radius }
// { type: "cylinder", at, radius, height }      solid, standing on `at`
// { type: "glass", at, radius, height, wall, bottom }  an open-top glass or cup:
//                                               `radius` inside, standing on `at`
// { type: "bowl", at, radius, wall }            a half sphere open at the top,
//                                               `at` the center of its rim

function cylSdf(px, py, pz, cx, y0, cz, r, h) {
  const ax = px - cx;
  const az = pz - cz;
  const dx = Math.sqrt(ax * ax + az * az) - r;
  const dy = Math.abs(py - (y0 + h / 2)) - h / 2;
  const ox = dx > 0 ? dx : 0;
  const oy = dy > 0 ? dy : 0;
  return Math.min(Math.max(dx, dy), 0) + Math.sqrt(ox * ox + oy * oy);
}

export function sdf(c, x, y, z) {
  switch (c.type) {
    case "floor":
      return y - c.y;
    case "box": {
      const qx = Math.abs(x - c.at[0]) - c.size[0] / 2;
      const qy = Math.abs(y - c.at[1]) - c.size[1] / 2;
      const qz = Math.abs(z - c.at[2]) - c.size[2] / 2;
      const o = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0));
      return o + Math.min(Math.max(qx, qy, qz), 0);
    }
    case "sphere":
      return Math.hypot(x - c.at[0], y - c.at[1], z - c.at[2]) - c.radius;
    case "cylinder":
      return cylSdf(x, y, z, c.at[0], c.at[1], c.at[2], c.radius, c.height);
    case "glass": {
      const wall = c.wall ?? c.radius * 0.08;
      const bottom = c.bottom ?? wall;
      const outer = cylSdf(x, y, z, c.at[0], c.at[1], c.at[2], c.radius + wall, c.height);
      const cavity = cylSdf(x, y, z, c.at[0], c.at[1] + bottom, c.at[2], c.radius, c.height * 4);
      return Math.max(outer, -cavity);
    }
    case "bowl": {
      const wall = c.wall ?? c.radius * 0.08;
      const r = Math.hypot(x - c.at[0], y - c.at[1], z - c.at[2]);
      const shell = Math.abs(r - (c.radius + wall / 2)) - wall / 2;
      return Math.max(shell, y - c.at[1]);
    }
    default:
      return Infinity;
  }
}

// The distance to the nearest solid of a list, and its outward normal
// (central differences, only where it is needed).
const NEAR = { d: Infinity, hit: null };
function nearest(colliders, x, y, z) {
  let d = Infinity;
  let hit = null;
  for (let i = 0; i < colliders.length; i++) {
    const v = sdf(colliders[i], x, y, z);
    if (v < d) {
      d = v;
      hit = colliders[i];
    }
  }
  NEAR.d = d;
  NEAR.hit = hit;
  return NEAR;
}

const NRM = [0, 0, 0];
// Four samples on a tetrahedron (Quilez).
function normalAt(c, x, y, z, e) {
  const a = sdf(c, x + e, y - e, z - e);
  const b = sdf(c, x - e, y - e, z + e);
  const cc = sdf(c, x - e, y + e, z - e);
  const d = sdf(c, x + e, y + e, z + e);
  const nx = a - b - cc + d;
  const ny = -a - b + cc + d;
  const nz = -a + b - cc + d;
  const l = Math.hypot(nx, ny, nz) || 1;
  NRM[0] = nx / l;
  NRM[1] = ny / l;
  NRM[2] = nz / l;
  return NRM;
}

// Pushes point i of `p` (and its step from the old place o) out of the colliders.
// Fast points march along their step first, so they can't pass through a
// thin wall in one step. `friction` 0..1 holds back the sliding part of
// the step at a wall. Returns true on contact.
function collide(colliders, p, i, ox, oy, oz, rad, friction) {
  if (!colliders.length) return false;
  const i3 = i * 3;
  let x = p[i3];
  let y = p[i3 + 1];
  let z = p[i3 + 2];
  const step = Math.sqrt((x - ox) ** 2 + (y - oy) ** 2 + (z - oz) ** 2);
  if (step > rad * 0.8) {
    // March from the old place toward the new one.
    const n = Math.min(64, Math.ceil(step / (rad * 0.6)));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const sx = ox + (x - ox) * t;
      const sy = oy + (y - oy) * t;
      const sz = oz + (z - oz) * t;
      if (nearest(colliders, sx, sy, sz).d < rad) {
        const b = (k - 1) / n;
        x = ox + (x - ox) * b;
        y = oy + (y - oy) * b;
        z = oz + (z - oz) * b;
        break;
      }
    }
  }
  let touched = false;
  for (let pass = 0; pass < 3; pass++) {
    const { d, hit } = nearest(colliders, x, y, z);
    if (!(d < rad) || !hit) break;
    touched = true;
    const n = normalAt(hit, x, y, z, rad * 0.25);
    const push = rad - d;
    x += n[0] * push;
    y += n[1] * push;
    z += n[2] * push;
    if (friction > 0) {
      // Hold back the part of the step along the wall.
      const dx = x - ox;
      const dy = y - oy;
      const dz = z - oz;
      const dn = dx * n[0] + dy * n[1] + dz * n[2];
      const tx = dx - dn * n[0];
      const ty = dy - dn * n[1];
      const tz = dz - dn * n[2];
      x -= tx * friction;
      y -= ty * friction;
      z -= tz * friction;
    }
  }
  p[i3] = x;
  p[i3 + 1] = y;
  p[i3 + 2] = z;
  return touched;
}

// ---- Neighbors ------------------------------------------------------------------------------

// A dense grid of cells the size of the kernel over the particles' bounds
// (at most 64 cells a side; points beyond it share the edge cells, which
// only adds candidates). Each point then lists up to MAXN neighbors within h.
const MAXN = 48;
const SIDE = 64;

class Grid {
  constructor(cap) {
    this.cellOf = new Int32Array(Math.max(1, cap));
    this.sorted = new Int32Array(Math.max(1, cap));
    this.start = new Int32Array(1);
    this.fill = new Int32Array(1);
    this.lo = [0, 0, 0];
    this.dim = [1, 1, 1];
    this.inv = 1;
    this.c = new Int32Array(3);
  }

  build(p, n, h) {
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < n; i++)
      for (let k = 0; k < 3; k++) {
        const v = p[i * 3 + k];
        if (v < lo[k]) lo[k] = v;
        if (v > hi[k]) hi[k] = v;
      }
    if (!n) {
      lo.fill(0);
      hi.fill(0);
    }
    const inv = 1 / h;
    const dim = [0, 1, 2].map((k) => Math.min(SIDE, Math.floor((hi[k] - lo[k]) * inv) + 1));
    const cells = dim[0] * dim[1] * dim[2];
    if (this.start.length < cells + 1) {
      this.start = new Int32Array(cells + 1);
      this.fill = new Int32Array(cells);
    }
    this.lo = lo;
    this.dim = dim;
    this.inv = inv;
    this.h = h;
    const { start, cellOf, sorted, fill } = this;
    start.fill(0, 0, cells + 1);
    for (let i = 0; i < n; i++) {
      const c = this.cell(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
      cellOf[i] = c;
      start[c + 1]++;
    }
    for (let c = 0; c < cells; c++) start[c + 1] += start[c];
    fill.set(start.subarray(0, cells));
    for (let i = 0; i < n; i++) sorted[fill[cellOf[i]]++] = i;
  }

  // The cell of a point, and its coordinates in this.c.
  cell(x, y, z) {
    const { lo, dim, inv, c } = this;
    let cx = Math.floor((x - lo[0]) * inv);
    let cy = Math.floor((y - lo[1]) * inv);
    let cz = Math.floor((z - lo[2]) * inv);
    cx = cx < 0 ? 0 : cx >= dim[0] ? dim[0] - 1 : cx;
    cy = cy < 0 ? 0 : cy >= dim[1] ? dim[1] - 1 : cy;
    cz = cz < 0 ? 0 : cz >= dim[2] ? dim[2] - 1 : cz;
    c[0] = cx;
    c[1] = cy;
    c[2] = cz;
    return (cz * dim[1] + cy) * dim[0] + cx;
  }
}

// ---- Kernels (Müller et al. 2003) ------------------------------------------------------------

function kernels(h) {
  const h2 = h * h;
  return {
    h,
    h2,
    poly6: 315 / (64 * Math.PI * Math.pow(h, 9)),
    spiky: -45 / (Math.PI * Math.pow(h, 6)),
  };
}

// ---- Liquid ------------------------------------------------------------------------------------

const ITERS = 3;
const WALL_STEPS = 32;

export class Liquid {
  // spec: see docs/FLUIDS.md. `cap` particles (already scaled for the tier),
  // `spacing` the particle size for that cap.
  constructor(spec, { cap, spacing, gravity, seed }) {
    const preset = LIQUIDS[spec.preset] || LIQUIDS.water;
    this.spec = spec;
    this.kind = "liquid";
    this.name = spec.name;
    this.cap = cap;
    this.d = spacing;
    this.rad = spacing * 0.5;
    this.viscosity = spec.viscosity ?? preset.viscosity;
    this.cohesion = spec.cohesion ?? preset.cohesion;
    this.friction = spec.friction ?? preset.friction;
    this.foam = spec.foam ?? preset.foam;
    this.fizz = spec.fizz ?? preset.fizz;
    this.gravity = gravity;
    this.colliders = spec.colliders || [];
    this.rand = mulberry32(mixSeed(seed, `liquid-${spec.name}`));
    this.n = 0;
    this.pos = new Float32Array(cap * 3);
    this.old = new Float32Array(cap * 3);
    this.vel = new Float32Array(cap * 3);
    this.dp = new Float32Array(cap * 3);
    this.lambda = new Float32Array(cap);
    this.rho = new Float32Array(cap);
    this.nrm = new Float32Array(cap * 4); // outward normal, surface 0..1
    this.count = new Uint8Array(cap); // neighbors
    this.hot = new Float32Array(cap); // lava: 1 hot .. 0 cooled crust
    this.seed = new Float32Array(cap);
    this.nbr = new Int32Array(cap * MAXN);
    this.nbrN = new Uint8Array(cap);
    this.grid = new Grid(cap);
    this.K = kernels(spacing * (spec.kernel ?? 1.8));
    this.iters = spec.iters ?? ITERS;
    this.rho0 = this.restDensity();
    this.gradScale = this.restGradSum();
    this.wallTable();
    this.wd = new Float32Array(cap);
    this.wn = new Float32Array(cap * 3);
    this.clear = new Float32Array(cap);
    this.rp = new Float32Array(cap * 3);
    this.rq = new Float32Array(cap * 4);
    this.rs = new Float32Array(cap * 4);
    this.emitter = spec.emitter ? { on: false, flow: 1, travel: 0, ...spec.emitter } : null;
    this.drain = 0;
    this.time = 0;
    // Diffuse particles: spray, foam and bubbles.
    this.dcap = Math.round(
      cap * (this.fizz > 0 ? 3.5 : this.foam > 0 ? 0.45 : 0.12) * (spec.diffuse ?? 1),
    );
    this.dn = 0;
    this.dpos = new Float32Array(this.dcap * 3);
    this.dvel = new Float32Array(this.dcap * 3);
    this.dage = new Float32Array(this.dcap);
    this.dlife = new Float32Array(this.dcap);
    this.dkind = new Uint8Array(this.dcap);
    this.dseed = new Float32Array(this.dcap);
    if (spec.fill) this.fill(spec.fill);
  }

  // Density of a particle in a rest lattice of spacing d (mass 1).
  restDensity() {
    const { h2, poly6 } = this.K;
    const d = this.d;
    let rho = 0;
    const m = Math.ceil((this.K.h / d) * 1.01);
    for (let i = -m; i <= m; i++)
      for (let j = -m; j <= m; j++)
        for (let k = -m; k <= m; k++) {
          const r2 = (i * i + j * j + k * k) * d * d;
          if (r2 < h2) rho += poly6 * (h2 - r2) ** 3;
        }
    return rho;
  }

  spawn(x, y, z, vx, vy, vz) {
    if (this.n >= this.cap) return -1;
    const i = this.n++;
    const i3 = i * 3;
    this.pos[i3] = this.old[i3] = x;
    this.pos[i3 + 1] = this.old[i3 + 1] = y;
    this.pos[i3 + 2] = this.old[i3 + 2] = z;
    this.vel[i3] = vx;
    this.vel[i3 + 1] = vy;
    this.vel[i3 + 2] = vz;
    this.hot[i] = 1;
    this.seed[i] = this.rand();
    this.clear[i] = 0;
    this.count[i] = 30;
    this.nrm.fill(0, i * 4, i * 4 + 4);
    return i;
  }

  remove(i) {
    const j = --this.n;
    if (i === j) return;
    for (const a of [this.pos, this.old, this.vel]) {
      a[i * 3] = a[j * 3];
      a[i * 3 + 1] = a[j * 3 + 1];
      a[i * 3 + 2] = a[j * 3 + 2];
    }
    this.hot[i] = this.hot[j];
    this.seed[i] = this.seed[j];
    this.clear[i] = 0;
  }

  // Fills a region with particles at rest: { box: [min, max] },
  // { cylinder: { at, radius, height } } or { sphere: { at, radius } }.
  // `below` and `above` clip it to heights; `count` caps how many. Places
  // inside a collider are skipped.
  fill(region, { count = Infinity, vel = [0, 0, 0] } = {}) {
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
      lo = c.at.map((v) => v - c.radius);
      hi = c.at.map((v) => v + c.radius);
      inside = (x, y, z) => Math.hypot(x - c.at[0], y - c.at[1], z - c.at[2]) <= c.radius;
    } else return 0;
    let made = 0;
    // A lattice shifted a little each row keeps it from stacking in columns.
    for (let y = lo[1] + d / 2; y <= hi[1]; y += d)
      for (let x = lo[0] + d / 2; x <= hi[0]; x += d)
        for (let z = lo[2] + d / 2; z <= hi[2]; z += d) {
          if (made >= count || this.n >= this.cap) return made;
          const jx = x + (this.rand() - 0.5) * d * 0.05;
          const jz = z + (this.rand() - 0.5) * d * 0.05;
          if (!inside(jx, y, jz)) continue;
          if (y > (region.below ?? Infinity) || y < (region.above ?? -Infinity)) continue;
          if (nearest(this.colliders, jx, y, jz).d < this.rad) continue;
          this.spawn(jx, y, jz, vel[0], vel[1], vel[2]);
          made++;
        }
    return made;
  }

  // The emitter: a disc of radius `radius` at `at`, facing `dir`. It sends
  // out a layer of particles (a hexagonal disc at least one particle wide)
  // each time the flow has carried one layer's volume through the nozzle,
  // so it pours the same volume on every tier.
  emit(dt) {
    const e = this.emitter;
    if (!e || !e.on || e.flow <= 0) return;
    const speed = (e.speed ?? 1) * e.flow;
    const d = this.d;
    const R = Math.max(e.radius ?? d, 0.01);
    if (!e.layer || e.layerR !== R || e.layerD !== d) {
      const pts = [];
      const Re = Math.max(R, d * 0.75);
      const m = Math.ceil(Re / d);
      for (let a = -m; a <= m; a++)
        for (let b = -m; b <= m; b++) {
          const ra = (a + (b & 1) * 0.5) * d;
          const rb = b * d * 0.866;
          if (ra * ra + rb * rb <= Re * Re + 1e-9) pts.push([ra, rb]);
        }
      e.layer = pts;
      e.layerR = R;
      e.layerD = d;
      // How far the flow moves while one layer's volume passes.
      e.gap = (pts.length * d ** 3) / (Math.PI * R * R);
    }
    e.travel += speed * dt;
    const dir = unit3(e.dir || [0, -1, 0]);
    const [ux, uy, uz] = perp(dir);
    const vx = dir[1] * uz - dir[2] * uy;
    const vy = dir[2] * ux - dir[0] * uz;
    const vz = dir[0] * uy - dir[1] * ux;
    const at = e.at;
    while (e.travel >= e.gap) {
      e.travel -= e.gap;
      const lag = e.travel; // how far this layer has already gone
      const spin = this.rand() * 6.283;
      const cs = Math.cos(spin);
      const sn = Math.sin(spin);
      for (const [ra, rb] of e.layer) {
        const pa = ra * cs - rb * sn;
        const pb = ra * sn + rb * cs;
        // Staggered along the flow, so a stream isn't a stack of discs.
        const l = lag + (this.rand() - 0.5) * Math.min(d, e.gap) * 0.4;
        const x = at[0] + ux * pa + vx * pb + dir[0] * l;
        const y = at[1] + uy * pa + vy * pb + dir[1] * l;
        const z = at[2] + uz * pa + vz * pb + dir[2] * l;
        if (this.spawn(x, y, z, dir[0] * speed, dir[1] * speed, dir[2] * speed) < 0) return;
      }
    }
  }

  // Drops a round blob of up to `count` particles at `at` (taking the
  // highest particles in the scene when the budget is used up).
  drop(at, radius, vel = [0, 0, 0]) {
    const d = this.d;
    const want = Math.floor(((4 / 3) * Math.PI * radius ** 3) / d ** 3);
    const free = this.cap - this.n;
    if (free < want) {
      // Recycle the highest particles (the surface of the pool).
      const idx = Array.from({ length: this.n }, (_, i) => i);
      idx.sort((a, b) => this.pos[b * 3 + 1] - this.pos[a * 3 + 1]);
      const take = idx.slice(0, Math.min(this.n, want - free)).sort((a, b) => b - a);
      for (const i of take) this.remove(i);
    }
    return this.fill({ sphere: { at, radius } }, { vel });
  }

  step(dt) {
    this.time += dt;
    const { pos, old, vel, wd, wn } = this;
    const g = this.gravity;
    this.emit(dt);
    // Drain: the lowest particles leave (the glass empties from its foot).
    if (this.drain > 0 && this.n) {
      this.drainAcc = (this.drainAcc || 0) + this.drain * dt * this.cap;
      while (this.drainAcc >= 1 && this.n) {
        this.drainAcc--;
        let lo = 0;
        for (let i = 1; i < this.n; i++) if (pos[i * 3 + 1] < pos[lo * 3 + 1]) lo = i;
        this.remove(lo);
      }
    }
    const n = this.n;
    if (!n) {
      this.stepDiffuse(dt, 0);
      return;
    }
    const rad = this.rad;
    const maxStep = this.d * 2.5;
    const { h2, poly6, spiky, h } = this.K;
    // Predict, and find the walls near each particle.
    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      vel[i3] += g[0] * dt;
      vel[i3 + 1] += g[1] * dt;
      vel[i3 + 2] += g[2] * dt;
      old[i3] = pos[i3];
      old[i3 + 1] = pos[i3 + 1];
      old[i3 + 2] = pos[i3 + 2];
      let sx = vel[i3] * dt;
      let sy = vel[i3 + 1] * dt;
      let sz = vel[i3 + 2] * dt;
      const s2 = sx * sx + sy * sy + sz * sz;
      if (s2 > maxStep * maxStep) {
        const k = maxStep / Math.sqrt(s2);
        sx *= k;
        sy *= k;
        sz *= k;
      }
      pos[i3] += sx;
      pos[i3 + 1] += sy;
      pos[i3 + 2] += sz;
      // Far from every wall (by more than this step and the kernel), a
      // particle skips the walls until the next step.
      if (this.clear[i] - Math.sqrt(sx * sx + sy * sy + sz * sz) > h + rad) {
        wd[i] = 1e9;
        continue;
      }
      collide(this.colliders, pos, i, old[i3], old[i3 + 1], old[i3 + 2], rad, 0);
      this.wall(i);
    }
    this.neighbors(n);
    const rho0 = this.rho0;
    const inv0 = 1 / rho0;
    const lambda = this.lambda;
    const dp = this.dp;
    const nbr = this.nbr;
    const nbrN = this.nbrN;
    const cohesion = this.cohesion;
    const wallRho = this.wallRho;
    const wallGrad = this.wallGrad;
    const wStep = WALL_STEPS / h;
    // Artificial pressure (s_corr), scaled to this kernel.
    const dq = 0.25 * h;
    const wdq = poly6 * (h2 - dq * dq) ** 3;
    const kCorr = (this.spec.scorr ?? 0.0015) / this.gradScale;
    // Relaxation (the paper's epsilon): keeps a lone particle's step small.
    const relax = this.gradScale * 0.1;
    for (let it = 0; it < this.iters; it++) {
      for (let i = 0; i < n; i++) {
        const i3 = i * 3;
        const xi = pos[i3];
        const yi = pos[i3 + 1];
        const zi = pos[i3 + 2];
        let rho = poly6 * h2 * h2 * h2;
        let gx = 0;
        let gy = 0;
        let gz = 0;
        let g2 = 0;
        const nn = nbrN[i];
        const base = i * MAXN;
        for (let k = 0; k < nn; k++) {
          const j = nbr[base + k];
          const dx = xi - pos[j * 3];
          const dy = yi - pos[j * 3 + 1];
          const dz = zi - pos[j * 3 + 2];
          const r2 = dx * dx + dy * dy + dz * dz;
          if (r2 >= h2) continue;
          const q = h2 - r2;
          rho += poly6 * q * q * q;
          const r = Math.sqrt(r2) || 1e-9;
          const w = (spiky * (h - r) * (h - r)) / r;
          const wx = w * dx * inv0;
          const wy = w * dy * inv0;
          const wz = w * dz * inv0;
          gx += wx;
          gy += wy;
          gz += wz;
          g2 += wx * wx + wy * wy + wz * wz;
        }
        // A wall counts as fluid on its far side (so the liquid packs
        // against it no tighter than anywhere else).
        const di = wd[i];
        if (di < h) {
          const t = Math.max(0, di) * wStep;
          const k0 = Math.min(WALL_STEPS - 1, t | 0);
          const f = Math.min(1, t - k0);
          rho += wallRho[k0] + (wallRho[k0 + 1] - wallRho[k0]) * f;
          const gw = (wallGrad[k0] + (wallGrad[k0 + 1] - wallGrad[k0]) * f) * inv0;
          gx -= gw * wn[i3];
          gy -= gw * wn[i3 + 1];
          gz -= gw * wn[i3 + 2];
          g2 += gw * gw;
        }
        this.rho[i] = rho;
        let C = rho * inv0 - 1;
        if (C < -cohesion) C = -cohesion;
        lambda[i] = -C / (g2 + gx * gx + gy * gy + gz * gz + relax);
      }
      for (let i = 0; i < n; i++) {
        const i3 = i * 3;
        const xi = pos[i3];
        const yi = pos[i3 + 1];
        const zi = pos[i3 + 2];
        const li = lambda[i];
        let ax = 0;
        let ay = 0;
        let az = 0;
        const nn = nbrN[i];
        const base = i * MAXN;
        for (let k = 0; k < nn; k++) {
          const j = nbr[base + k];
          const dx = xi - pos[j * 3];
          const dy = yi - pos[j * 3 + 1];
          const dz = zi - pos[j * 3 + 2];
          const r2 = dx * dx + dy * dy + dz * dz;
          if (r2 >= h2) continue;
          const q = h2 - r2;
          const ratio = (poly6 * q * q * q) / wdq;
          const corr = -kCorr * ratio * ratio * ratio * ratio;
          const r = Math.sqrt(r2) || 1e-9;
          const w = ((spiky * (h - r) * (h - r)) / r) * (li + lambda[j] + corr) * inv0;
          ax += w * dx;
          ay += w * dy;
          az += w * dz;
        }
        const di = wd[i];
        if (di < h && li < 0) {
          // Pushed off the wall (only when compressed: walls don't pull).
          const t = Math.max(0, di) * wStep;
          const k0 = Math.min(WALL_STEPS - 1, t | 0);
          const gw = (wallGrad[k0] + (wallGrad[k0 + 1] - wallGrad[k0]) * Math.min(1, t - k0)) * inv0; // prettier-ignore
          ax -= li * gw * wn[i3];
          ay -= li * gw * wn[i3 + 1];
          az -= li * gw * wn[i3 + 2];
        }
        dp[i3] = ax;
        dp[i3 + 1] = ay;
        dp[i3 + 2] = az;
      }
      const last = it === this.iters - 1;
      for (let i = 0; i < n; i++) {
        const i3 = i * 3;
        pos[i3] += dp[i3];
        pos[i3 + 1] += dp[i3 + 1];
        pos[i3 + 2] += dp[i3 + 2];
        // Walls: every pass for particles touching one, the last pass for
        // those near one (the wall term keeps the rest off).
        if (wd[i] >= 1e8 || (!last && wd[i] > rad * 1.3)) continue;
        collide(this.colliders, pos, i, old[i3], old[i3 + 1], old[i3 + 2], rad, last ? this.friction : 0); // prettier-ignore
        this.wall(i);
      }
    }
    // Velocities from the moves, then viscosity (XSPH, strong for honey).
    const inv = 1 / dt;
    for (let i = 0; i < n * 3; i++) vel[i] = (pos[i] - old[i]) * inv;
    // What the walls' clearance is left after this step's moves.
    for (let i = 0; i < n; i++) {
      if (wd[i] < 1e8) continue;
      const i3 = i * 3;
      this.clear[i] -= Math.sqrt((pos[i3] - old[i3]) ** 2 + (pos[i3 + 1] - old[i3 + 1]) ** 2 + (pos[i3 + 2] - old[i3 + 2]) ** 2); // prettier-ignore
    }
    this.viscous(n, dt);
    this.surface(n);
    this.cool(n, dt);
    this.stepDiffuse(dt, n);
    this.cull();
  }

  // The nearest wall of particle i: its distance (wd) and outward normal
  // (wn), and how far the particle can move before it could touch one.
  wall(i) {
    const i3 = i * 3;
    const x = this.pos[i3];
    const y = this.pos[i3 + 1];
    const z = this.pos[i3 + 2];
    const { d, hit } = nearest(this.colliders, x, y, z);
    this.clear[i] = d;
    if (!hit || d >= this.K.h) {
      // Checked this step, no wall within reach.
      this.wd[i] = 5e8;
      if (!hit) this.clear[i] = 1e9;
      return;
    }
    const nn = normalAt(hit, x, y, z, this.rad * 0.25);
    this.wd[i] = d;
    this.wn[i3] = nn[0];
    this.wn[i3 + 1] = nn[1];
    this.wn[i3 + 2] = nn[2];
  }

  // The density a flat wall adds at each distance, and its gradient along
  // the wall's normal: a lattice of rest particles filling the solid side.
  wallTable() {
    const { h, h2, poly6, spiky } = this.K;
    const d = this.d;
    this.wallRho = new Float32Array(WALL_STEPS + 1);
    this.wallGrad = new Float32Array(WALL_STEPS + 1);
    const m = Math.ceil(h / d) + 1;
    for (let s = 0; s <= WALL_STEPS; s++) {
      const dist = (s / WALL_STEPS) * h;
      let rho = 0;
      let grad = 0;
      for (let k = 0; k < m; k++) {
        const dz = dist + (k + 0.5) * d;
        for (let i = -m; i <= m; i++)
          for (let j = -m; j <= m; j++) {
            const r2 = (i * i + j * j) * d * d + dz * dz;
            if (r2 >= h2) continue;
            rho += poly6 * (h2 - r2) ** 3;
            const r = Math.sqrt(r2);
            grad += -spiky * (h - r) * (h - r) * (dz / r);
          }
      }
      this.wallRho[s] = rho;
      this.wallGrad[s] = grad;
    }
  }

  // The squared density gradient of a particle at rest (for scaling s_corr).
  restGradSum() {
    const { h, spiky } = this.K;
    const d = this.d;
    let s = 0;
    const m = Math.ceil(h / d);
    for (let i = -m; i <= m; i++)
      for (let j = -m; j <= m; j++)
        for (let k = -m; k <= m; k++) {
          const r = Math.sqrt(i * i + j * j + k * k) * d;
          if (!r || r >= h) continue;
          const w = (spiky * (h - r) * (h - r)) / this.rho0;
          s += w * w;
        }
    return s;
  }

  neighbors(n) {
    const { pos, nbr, nbrN, grid } = this;
    const h = this.K.h;
    const h2 = h * h;
    grid.build(pos, n, h);
    const { start, sorted, dim, c } = grid;
    const [nx, ny, nz] = dim;
    for (let i = 0; i < n; i++) {
      const xi = pos[i * 3];
      const yi = pos[i * 3 + 1];
      const zi = pos[i * 3 + 2];
      grid.cell(xi, yi, zi);
      const x0 = Math.max(0, c[0] - 1);
      const x1 = Math.min(nx - 1, c[0] + 1);
      const y0 = Math.max(0, c[1] - 1);
      const y1 = Math.min(ny - 1, c[1] + 1);
      const z0 = Math.max(0, c[2] - 1);
      const z1 = Math.min(nz - 1, c[2] + 1);
      let cnt = 0;
      const base = i * MAXN;
      for (let cz = z0; cz <= z1; cz++)
        for (let cy = y0; cy <= y1; cy++) {
          const row = (cz * ny + cy) * nx;
          for (let s = start[row + x0], e = start[row + x1 + 1]; s < e; s++) {
            const j = sorted[s];
            if (j === i) continue;
            const dx = xi - pos[j * 3];
            const dy = yi - pos[j * 3 + 1];
            const dz = zi - pos[j * 3 + 2];
            if (dx * dx + dy * dy + dz * dz < h2 && cnt < MAXN) nbr[base + cnt++] = j;
          }
        }
      nbrN[i] = cnt;
      this.count[i] = cnt;
    }
  }

  // XSPH: each velocity moves toward its neighbors' weighted mean. Viscous
  // liquids take several passes, so a pour of honey moves as one body.
  viscous(n, dt) {
    const v = this.viscosity;
    if (v <= 0) return;
    const { vel, pos, nbr, nbrN, dp } = this;
    const { h2, poly6 } = this.K;
    // Per step, as a rate that doesn't depend on the step length.
    const a = 1 - Math.exp(-dt * ((this.spec.xsph ?? 4) + 900 * v * v));
    const passes = v > 0.5 ? 3 : v > 0.2 ? 2 : 1;
    for (let pass = 0; pass < passes; pass++) {
      for (let i = 0; i < n; i++) {
        const i3 = i * 3;
        let sx = 0;
        let sy = 0;
        let sz = 0;
        let sw = 0;
        const nn = nbrN[i];
        const base = i * MAXN;
        for (let k = 0; k < nn; k++) {
          const j = nbr[base + k];
          const dx = pos[i3] - pos[j * 3];
          const dy = pos[i3 + 1] - pos[j * 3 + 1];
          const dz = pos[i3 + 2] - pos[j * 3 + 2];
          const r2 = dx * dx + dy * dy + dz * dz;
          if (r2 >= h2) continue;
          const q = h2 - r2;
          const w = poly6 * q * q * q;
          sx += vel[j * 3] * w;
          sy += vel[j * 3 + 1] * w;
          sz += vel[j * 3 + 2] * w;
          sw += w;
        }
        if (sw > 0) {
          dp[i3] = vel[i3] + (sx / sw - vel[i3]) * a;
          dp[i3 + 1] = vel[i3 + 1] + (sy / sw - vel[i3 + 1]) * a;
          dp[i3 + 2] = vel[i3 + 2] + (sz / sw - vel[i3 + 2]) * a;
        } else {
          dp[i3] = vel[i3];
          dp[i3 + 1] = vel[i3 + 1];
          dp[i3 + 2] = vel[i3 + 2];
        }
      }
      vel.set(dp.subarray(0, n * 3));
    }
  }

  // The color-field gradient: an outward normal and how much of a surface
  // each particle is on (0 inside, 1 on the skin).
  surface(n) {
    const { pos, nbr, nbrN, nrm, rho } = this;
    const { h, h2, spiky } = this.K;
    const scale = h / this.rho0;
    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      let gx = 0;
      let gy = 0;
      let gz = 0;
      const nn = nbrN[i];
      const base = i * MAXN;
      for (let k = 0; k < nn; k++) {
        const j = nbr[base + k];
        const dx = pos[i3] - pos[j * 3];
        const dy = pos[i3 + 1] - pos[j * 3 + 1];
        const dz = pos[i3 + 2] - pos[j * 3 + 2];
        const r2 = dx * dx + dy * dy + dz * dz;
        if (r2 >= h2) continue;
        const r = Math.sqrt(r2) || 1e-9;
        const w = (spiky * (h - r) * (h - r)) / r / Math.max(rho[j], 1e-9);
        gx += w * dx;
        gy += w * dy;
        gz += w * dz;
      }
      // The gradient points inward (toward more fluid); flip it.
      const l = Math.hypot(gx, gy, gz);
      const s = Math.min(1, l * scale * rho[i] * 0.5);
      const o = i * 4;
      if (l > 1e-9) {
        nrm[o] = -gx / l;
        nrm[o + 1] = -gy / l;
        nrm[o + 2] = -gz / l;
      } else {
        nrm[o] = 0;
        nrm[o + 1] = 1;
        nrm[o + 2] = 0;
      }
      nrm[o + 3] = nn < 4 ? 1 : s;
    }
  }

  // The shape each particle is drawn with. Writes, per particle: `rp` the
  // drawn place (xyz), `rq` the turn (a quaternion x, y, z, w whose z axis is
  // the outward normal, for the light) and `rs` the three relative radii
  // (w: how much of a surface it is on). A negative first radius marks a
  // fast stream, drawn long along its x axis (the flow) by the renderer.
  //   - its place is smoothed toward its neighbors' (a smooth surface, not
  //     beads), and its normal is the neighbors' average (no mottling);
  //   - in the body and on its surface: a disc along that normal;
  //   - in a fast stream: along the flow, with the normal across it (so a
  //     stream gets a rim and a highlight like a glass rod);
  //   - in thin parts (sheets, necks, threads): the ellipsoid of its neighbors
  //     (Yu and Turk 2013), flat on a surface and long along a thread.
  shape(rp, rq, rs, { smooth = 0.75, fast = Infinity } = {}) {
    const n = this.n;
    const { pos, vel, nbr, nbrN, nrm } = this;
    const h = this.K.h;
    const C = SHAPE_C;
    const sn = this.sn || (this.sn = new Float32Array(this.cap * 3));
    // Smoothed normals: each surface normal averaged with its neighbors'.
    for (let i = 0; i < n; i++) {
      const o4 = i * 4;
      let x = nrm[o4] * nrm[o4 + 3];
      let y = nrm[o4 + 1] * nrm[o4 + 3];
      let z = nrm[o4 + 2] * nrm[o4 + 3];
      const base = i * MAXN;
      for (let k = 0; k < nbrN[i]; k++) {
        const j4 = nbr[base + k] * 4;
        const w = nrm[j4 + 3];
        x += nrm[j4] * w;
        y += nrm[j4 + 1] * w;
        z += nrm[j4 + 2] * w;
      }
      const l = Math.sqrt(x * x + y * y + z * z);
      if (l > 1e-6) {
        sn[i * 3] = x / l;
        sn[i * 3 + 1] = y / l;
        sn[i * 3 + 2] = z / l;
      } else {
        sn[i * 3] = nrm[o4];
        sn[i * 3 + 1] = nrm[o4 + 1];
        sn[i * 3 + 2] = nrm[o4 + 2];
      }
    }
    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      const xi = pos[i3];
      const yi = pos[i3 + 1];
      const zi = pos[i3 + 2];
      const nn = nbrN[i];
      const base = i * MAXN;
      // Weighted mean of the neighborhood.
      let sw = 1;
      let mx = xi;
      let my = yi;
      let mz = zi;
      for (let k = 0; k < nn; k++) {
        const j = nbr[base + k];
        const dx = pos[j * 3] - xi;
        const dy = pos[j * 3 + 1] - yi;
        const dz = pos[j * 3 + 2] - zi;
        const r = Math.sqrt(dx * dx + dy * dy + dz * dz) / h;
        if (r >= 1) continue;
        const w = 1 - r * r * r;
        sw += w;
        mx += pos[j * 3] * w;
        my += pos[j * 3 + 1] * w;
        mz += pos[j * 3 + 2] * w;
      }
      mx /= sw;
      my /= sw;
      mz /= sw;
      const o4 = i * 4;
      rp[i3] = xi + (mx - xi) * smooth;
      rp[i3 + 1] = yi + (my - yi) * smooth;
      rp[i3 + 2] = zi + (mz - zi) * smooth;
      const surf = nrm[o4 + 3];
      rs[o4 + 3] = surf;
      const nx = sn[i3];
      const ny = sn[i3 + 1];
      const nz = sn[i3 + 2];
      const vx = vel[i3];
      const vy = vel[i3 + 1];
      const vz = vel[i3 + 2];
      const sp = Math.sqrt(vx * vx + vy * vy + vz * vz);
      if (sp > fast && nn <= 8) {
        // A thin, fast stream: x along the flow, z the normal across it.
        // (A falling ball has more neighbors: it keeps its body's shape.)
        const ex = vx / sp;
        const ey = vy / sp;
        const ez = vz / sp;
        let px = nx;
        let py = ny;
        let pz = nz;
        const d = px * ex + py * ey + pz * ez;
        px -= d * ex;
        py -= d * ey;
        pz -= d * ez;
        let pl = Math.sqrt(px * px + py * py + pz * pz);
        if (pl < 1e-4) {
          // No sideways normal: any direction across the flow.
          px = Math.abs(ey) < 0.9 ? -ez : 0;
          py = Math.abs(ey) < 0.9 ? 0 : ez;
          pz = Math.abs(ey) < 0.9 ? ex : -ey;
          pl = Math.sqrt(px * px + py * py + pz * pz) || 1;
        }
        px /= pl;
        py /= pl;
        pz /= pl;
        const fx = py * ez - pz * ey;
        const fy = pz * ex - px * ez;
        const fz = px * ey - py * ex;
        quatFromAxes(ex, ey, ez, fx, fy, fz, px, py, pz, rq, o4);
        rs[o4] = -1;
        rs[o4 + 1] = 1;
        rs[o4 + 2] = 1;
        rs[o4 + 3] = 1;
        continue;
      }
      if (nn >= 10) {
        // The body and its surface: a disc along the smoothed normal, flatter
        // the more it is on the surface.
        const t = Math.abs(ny) < 0.9 ? [0, 1, 0] : [1, 0, 0];
        let ax = t[1] * nz - t[2] * ny;
        let ay = t[2] * nx - t[0] * nz;
        let az = t[0] * ny - t[1] * nx;
        const al = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
        ax /= al;
        ay /= al;
        az /= al;
        quatFromAxes(ax, ay, az, ny * az - nz * ay, nz * ax - nx * az, nx * ay - ny * ax, nx, ny, nz, rq, o4); // prettier-ignore
        const sf = Math.min(1, surf * 1.5);
        rs[o4] = 1.2 - 0.05 * sf;
        rs[o4 + 1] = 1.2 - 0.05 * sf;
        rs[o4 + 2] = 1 - 0.45 * sf;
        continue;
      }
      if (nn < 6) {
        // Too few neighbors to have a shape: a round drop.
        rq[o4] = rq[o4 + 1] = rq[o4 + 2] = 0;
        rq[o4 + 3] = 1;
        rs[o4] = rs[o4 + 1] = rs[o4 + 2] = 1;
        rs[o4 + 3] = 1;
        continue;
      }
      C.fill(0);
      let cw = 1e-9;
      for (let k = -1; k < nn; k++) {
        const j = k < 0 ? i : nbr[base + k];
        const dx = pos[j * 3] - mx;
        const dy = pos[j * 3 + 1] - my;
        const dz = pos[j * 3 + 2] - mz;
        const r = Math.sqrt((pos[j * 3] - xi) ** 2 + (pos[j * 3 + 1] - yi) ** 2 + (pos[j * 3 + 2] - zi) ** 2) / h; // prettier-ignore
        if (r >= 1) continue;
        const w = 1 - r * r * r;
        cw += w;
        C[0] += w * dx * dx;
        C[1] += w * dx * dy;
        C[2] += w * dx * dz;
        C[4] += w * dy * dy;
        C[5] += w * dy * dz;
        C[8] += w * dz * dz;
      }
      C[3] = C[1];
      C[6] = C[2];
      C[7] = C[5];
      for (let k = 0; k < 9; k++) C[k] /= cw;
      const { val, vec } = eigen3(C);
      // Largest first; the smallest axis is the normal.
      const s0 = Math.sqrt(Math.max(val[0], 1e-12));
      const s1 = Math.max(Math.sqrt(Math.max(val[1], 0)), s0 / 4);
      const s2 = Math.max(Math.sqrt(Math.max(val[2], 0)), s0 / 4);
      const g = Math.cbrt(s0 * s1 * s2);
      const ex = vec[0];
      const ey = vec[1];
      const ez = vec[2];
      let cx = vec[6];
      let cy = vec[7];
      let cz = vec[8];
      if (cx * nx + cy * ny + cz * nz < 0) {
        cx = -cx;
        cy = -cy;
        cz = -cz;
      }
      quatFromAxes(ex, ey, ez, cy * ez - cz * ey, cz * ex - cx * ez, cx * ey - cy * ex, cx, cy, cz, rq, o4); // prettier-ignore
      rs[o4] = s0 / g;
      rs[o4 + 1] = s1 / g;
      rs[o4 + 2] = s2 / g;
    }
    // A calm surface is even: each surface particle's drawn place moves
    // along its normal to its surface neighbors' mean height (twice), more
    // the slower it moves, so a settled pool reads as one level sheet.
    const dq = this.dq || (this.dq = new Float32Array(this.cap));
    const calmSpeed = Math.sqrt(Math.abs(this.gravity[1]) * this.d) * 0.6;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < n; i++) {
        dq[i] = 0;
        if (nrm[i * 4 + 3] < 0.45 || rs[i * 4] < 0) continue;
        const i3 = i * 3;
        const nx = sn[i3];
        const ny = sn[i3 + 1];
        const nz = sn[i3 + 2];
        let sum = 0;
        let cnt = 0;
        const base = i * MAXN;
        for (let k = 0; k < nbrN[i]; k++) {
          const j = nbr[base + k];
          if (nrm[j * 4 + 3] < 0.45) continue;
          sum += (rp[j * 3] - rp[i3]) * nx + (rp[j * 3 + 1] - rp[i3 + 1]) * ny + (rp[j * 3 + 2] - rp[i3 + 2]) * nz; // prettier-ignore
          cnt++;
        }
        if (!cnt) continue;
        const sp = Math.sqrt(vel[i3] ** 2 + vel[i3 + 1] ** 2 + vel[i3 + 2] ** 2);
        const k = Math.max(0, 1 - sp / calmSpeed);
        dq[i] = (sum / cnt) * 0.8 * k;
      }
      for (let i = 0; i < n; i++) {
        if (!dq[i]) continue;
        const i3 = i * 3;
        rp[i3] += sn[i3] * dq[i];
        rp[i3 + 1] += sn[i3 + 1] * dq[i];
        rp[i3 + 2] += sn[i3 + 2] * dq[i];
      }
    }
  }

  // Lava cools where it meets the air (a darker crust) and warms inside.
  cool(n, dt) {
    if (!(LIQUIDS[this.spec.preset]?.glow || this.spec.glow)) return;
    const { hot, nrm } = this;
    for (let i = 0; i < n; i++) {
      const s = nrm[i * 4 + 3];
      // (r5: its skin crusts over within a couple of seconds)
      hot[i] += ((s > 0.5 ? 0.05 : 1) - hot[i]) * Math.min(1, dt * (s > 0.5 ? 1.2 : 0.6));
    }
  }

  // Removes particles that have fallen far away (off a table, out of view).
  cull() {
    const lim = this.spec.bounds ?? 50;
    for (let i = this.n - 1; i >= 0; i--) {
      const y = this.pos[i * 3 + 1];
      if (!(Math.abs(y) < lim && Math.abs(this.pos[i * 3]) < lim && Math.abs(this.pos[i * 3 + 2]) < lim)) this.remove(i); // prettier-ignore
    }
  }

  // ---- Diffuse particles (after Ihmsen et al. 2012, much simplified) ----------

  spawnDiffuse(kind, x, y, z, vx, vy, vz, life) {
    if (this.dn >= this.dcap) return;
    const i = this.dn++;
    const i3 = i * 3;
    this.dpos[i3] = x;
    this.dpos[i3 + 1] = y;
    this.dpos[i3 + 2] = z;
    this.dvel[i3] = vx;
    this.dvel[i3 + 1] = vy;
    this.dvel[i3 + 2] = vz;
    this.dkind[i] = kind;
    this.dage[i] = 0;
    this.dlife[i] = life;
    this.dseed[i] = this.rand();
  }

  removeDiffuse(i) {
    const j = --this.dn;
    if (i === j) return;
    for (let k = 0; k < 3; k++) {
      this.dpos[i * 3 + k] = this.dpos[j * 3 + k];
      this.dvel[i * 3 + k] = this.dvel[j * 3 + k];
    }
    this.dkind[i] = this.dkind[j];
    this.dage[i] = this.dage[j];
    this.dlife[i] = this.dlife[j];
    this.dseed[i] = this.dseed[j];
  }

  stepDiffuse(dt, n) {
    const foam = this.foam;
    const fizz = this.fizz;
    const rand = this.rand;
    const { pos, vel, nrm, count } = this;
    const d = this.d;
    const g = this.gravity;
    // New ones: spray and foam where fast liquid meets the surface; for a
    // soda, bubbles from the bottom and walls all the time.
    if (n && foam > 0) {
      const vRef = Math.sqrt(Math.abs(g[1]) * d * 40);
      for (let i = 0; i < n; i++) {
        const s = nrm[i * 4 + 3];
        if (s < 0.3) continue;
        const v = Math.hypot(vel[i * 3], vel[i * 3 + 1], vel[i * 3 + 2]);
        const e = v / vRef - 0.35;
        if (e <= 0) continue;
        if (rand() > e * foam * dt * (14 + 40 * fizz)) continue;
        const kind = count[i] < 8 ? KIND.spray : KIND.foam;
        const j = 0.5 * d;
        // A soda traps more air: several flecks per splash, for a head.
        const m = kind === KIND.foam ? 1 + Math.round(9 * fizz) : 1;
        for (let k = 0; k < m; k++)
          this.spawnDiffuse(
            kind,
            pos[i * 3] + (rand() - 0.5) * j * (1 + k),
            pos[i * 3 + 1] + (rand() - 0.5) * j,
            pos[i * 3 + 2] + (rand() - 0.5) * j * (1 + k),
            vel[i * 3] * 0.8,
            vel[i * 3 + 1] * 0.8,
            vel[i * 3 + 2] * 0.8,
            kind === KIND.spray ? 0.8 : (1.2 + 3.5 * fizz) * (0.6 + 0.8 * rand()),
          );
      }
    }
    if (n && fizz > 0) {
      // Nucleation: a few points on the glass make streams of bubbles.
      const want = fizz * dt * n * 0.35 * (this.fizzBoost ?? 1);
      let k = Math.floor(want) + (rand() < want % 1 ? 1 : 0);
      while (k-- > 0) {
        const i = Math.floor(rand() * n);
        if (count[i] < 18) continue;
        this.spawnDiffuse(
          KIND.bubble,
          pos[i * 3] + (rand() - 0.5) * d,
          pos[i * 3 + 1],
          pos[i * 3 + 2] + (rand() - 0.5) * d,
          0,
          0,
          0,
          6,
        );
      }
    }
    if (!this.dn) return;
    // Foam spreads from where it gathers toward the walls (a head covers
    // the whole top, not a patch where the pour lands): its centroid.
    let fcx = 0;
    let fcz = 0;
    let fcn = 0;
    for (let i = 0; i < this.dn; i++)
      if (this.dkind[i] === KIND.foam) {
        fcx += this.dpos[i * 3];
        fcz += this.dpos[i * 3 + 2];
        fcn++;
      }
    if (fcn) {
      fcx /= fcn;
      fcz /= fcn;
    }
    // How far the liquid reaches from there (the push fades out toward it,
    // so the flecks even out instead of piling against the wall).
    let reach = d * 4;
    for (let i = 0; i < n; i++) {
      const rx = pos[i * 3] - fcx;
      const rz = pos[i * 3 + 2] - fcz;
      reach = Math.max(reach, Math.sqrt(rx * rx + rz * rz));
    }
    // Move them with the liquid around them.
    const grid = this.grid;
    if (!n) grid.build(pos, 0, this.K.h);
    const { h2, poly6 } = this.K;
    const { start, sorted } = grid;
    const rise = Math.sqrt(Math.abs(g[1]) * d) * 1.8;
    // Bubbles rise at their own terminal speed: about 0.1 to 0.2 m/s for a
    // bubble of a millimeter or so in water (Clift, Grace and Weber 1978).
    const bubbleRise = (this.spec.bubbleRise ?? 0.15) / (this.spec.unit ?? 0.1);
    for (let i = this.dn - 1; i >= 0; i--) {
      const i3 = i * 3;
      const x = this.dpos[i3];
      const y = this.dpos[i3 + 1];
      const z = this.dpos[i3 + 2];
      let c = 0;
      let wx = 0;
      let wy = 0;
      let wz = 0;
      let sw = 0;
      if (n) {
        grid.cell(x, y, z);
        const gc = grid.c;
        const [nx, ny, nz] = grid.dim;
        const x0 = Math.max(0, gc[0] - 1);
        const x1 = Math.min(nx - 1, gc[0] + 1);
        for (let cz = Math.max(0, gc[2] - 1); cz <= Math.min(nz - 1, gc[2] + 1); cz++)
          for (let cy = Math.max(0, gc[1] - 1); cy <= Math.min(ny - 1, gc[1] + 1); cy++) {
            const row = (cz * ny + cy) * nx;
            for (let s = start[row + x0], e = start[row + x1 + 1]; s < e; s++) {
              const j = sorted[s];
              const dx = x - pos[j * 3];
              const dy = y - pos[j * 3 + 1];
              const dz = z - pos[j * 3 + 2];
              const r2 = dx * dx + dy * dy + dz * dz;
              if (r2 >= h2) continue;
              const q = h2 - r2;
              const w = poly6 * q * q * q;
              wx += vel[j * 3] * w;
              wy += vel[j * 3 + 1] * w;
              wz += vel[j * 3 + 2] * w;
              sw += w;
              c++;
            }
          }
      }
      let kind = this.dkind[i];
      // Classify by how deep in the liquid it is.
      if (kind === KIND.bubble && c < 10) {
        // At the top most bubbles pop; a few gather as a thin ring of foam.
        if (rand() > 0.15) {
          this.removeDiffuse(i);
          continue;
        }
        kind = KIND.foam;
        this.dage[i] = 0;
        this.dlife[i] = 0.6 + rand() * 0.9;
      } else if (kind === KIND.spray && c >= 10) kind = KIND.foam;
      else if (kind === KIND.foam && c < 2 && this.dvel[i3 + 1] < -rise) kind = KIND.spray;
      this.dkind[i] = kind;
      let vx = this.dvel[i3];
      let vy = this.dvel[i3 + 1];
      let vz = this.dvel[i3 + 2];
      if (kind === KIND.spray) {
        vx += g[0] * dt;
        vy += g[1] * dt;
        vz += g[2] * dt;
      } else if (sw > 0) {
        const lx = wx / sw;
        const ly = wy / sw;
        const lz = wz / sw;
        if (kind === KIND.bubble) {
          // Rise through the liquid, wobbling a little.
          const t = this.time * 9 + this.dseed[i] * 40;
          vx = lx + Math.sin(t) * bubbleRise * 0.12;
          vy = ly + bubbleRise * (0.7 + 0.6 * this.dseed[i]);
          vz = lz + Math.cos(t * 1.3) * bubbleRise * 0.12;
        } else {
          // Foam rides the surface: carried along, floated up until it sits
          // on top of the liquid (few liquid neighbors, all below).
          // (a little wander, so a head spreads over the whole top)
          const ox = x - fcx;
          const oz = z - fcz;
          const ol = Math.sqrt(ox * ox + oz * oz) + d;
          const push = rise * 0.6 * Math.min(1, fcn / 300) * Math.max(0, 1 - ol / (reach * 0.85));
          vx = lx + (ox / ol) * push + (rand() - 0.5) * rise * 0.8;
          vz = lz + (oz / ol) * push + (rand() - 0.5) * rise * 0.8;
          vy = ly + (c > 7 ? rise * 0.7 : c < 2 ? -rise * 0.4 : 0);
        }
      } else if (kind === KIND.foam) {
        vy += g[1] * dt;
      }
      const p = this.dpos;
      p[i3] = x + vx * dt;
      p[i3 + 1] = y + vy * dt;
      p[i3 + 2] = z + vz * dt;
      this.dvel[i3] = vx;
      this.dvel[i3 + 1] = vy;
      this.dvel[i3 + 2] = vz;
      if (collide(this.colliders, p, i, x, y, z, d * 0.3, 0) && kind === KIND.spray) {
        this.dkind[i] = KIND.foam;
        this.dvel[i3] = this.dvel[i3 + 1] = this.dvel[i3 + 2] = 0;
      }
      this.dage[i] += dt;
      if (this.dage[i] > this.dlife[i]) this.removeDiffuse(i);
    }
  }
}

// ---- Curl field ------------------------------------------------------------------------------------

// A divergence-free swirl: the curl of a sum of sine vortices, each with a
// random direction and wavelength, drifting with time. curl(e sin(k.p + w t))
// = cos(k.p + w t) (k x e), exact and cheap.
export class CurlField {
  constructor(seed, { scale = 1, modes = 8 } = {}) {
    const rand = mulberry32(mixSeed(seed, "curl"));
    this.modes = [];
    for (let i = 0; i < modes; i++) {
      const f = (1.2 + rand() * 2.8) / scale;
      const k = unit3([rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1]).map((v) => v * f);
      const e = unit3([rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1]);
      const c = [k[1] * e[2] - k[2] * e[1], k[2] * e[0] - k[0] * e[2], k[0] * e[1] - k[1] * e[0]];
      const a = 1 / f / modes ** 0.5;
      this.modes.push({ k, c: c.map((v) => v * a), w: 0.6 + rand() * 1.6, ph: rand() * 6.283 });
    }
    this.out = [0, 0, 0];
  }

  at(x, y, z, t) {
    let vx = 0;
    let vy = 0;
    let vz = 0;
    for (const m of this.modes) {
      const s = Math.cos(m.k[0] * x + m.k[1] * y + m.k[2] * z + m.w * t + m.ph);
      vx += m.c[0] * s;
      vy += m.c[1] * s;
      vz += m.c[2] * s;
    }
    const o = this.out;
    o[0] = vx;
    o[1] = vy;
    o[2] = vz;
    return o;
  }
}

// ---- Gas (smoke and steam) -------------------------------------------------------------------------

export class Gas {
  constructor(spec, { cap, gravity, seed }) {
    this.spec = spec;
    this.kind = "gas";
    this.name = spec.name;
    this.cap = cap;
    this.pkind = spec.look === "steam" ? KIND.steam : KIND.smoke;
    this.size = spec.size ?? 0.05;
    this.life = spec.life ?? 3;
    this.rise = spec.rise ?? 0.6;
    this.turbulence = spec.turbulence ?? 0.5;
    this.spread = spec.spread ?? 1;
    this.rand = mulberry32(mixSeed(seed, `gas-${spec.name}`));
    this.curl = new CurlField(seed ^ 0x51, { scale: spec.swirl ?? this.size * 12 });
    this.up = unit3(gravity.map((v) => -v));
    this.colliders = spec.colliders || [];
    this.n = 0;
    this.pos = new Float32Array(cap * 3);
    this.old = new Float32Array(cap * 3);
    this.vel = new Float32Array(cap * 3);
    this.age = new Float32Array(cap);
    this.ttl = new Float32Array(cap);
    this.seed = new Float32Array(cap);
    this.heat = new Float32Array(cap);
    const src = spec.source || spec.emitter || {};
    this.emitter = {
      on: src.on ?? true,
      flow: 1,
      acc: 0,
      at: src.at || [0, 0, 0],
      radius: src.radius ?? this.size,
      rate: src.rate ?? cap / this.life,
      speed: src.speed ?? this.rise,
      dir: src.dir || this.up,
    };
    this.wind = [0, 0, 0];
    this.time = 0;
    this.puffs = [];
  }

  spawn(x, y, z, vx, vy, vz, heat = 1, life = this.life) {
    if (this.n >= this.cap) {
      // Full: the oldest gives way (smoke keeps coming).
      let o = 0;
      for (let i = 1; i < this.n; i++) if (this.age[i] / this.ttl[i] > this.age[o] / this.ttl[o]) o = i; // prettier-ignore
      this.remove(o);
    }
    const i = this.n++;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.age[i] = 0;
    this.ttl[i] = life * (0.75 + 0.5 * this.rand());
    this.seed[i] = this.rand();
    this.heat[i] = heat;
    return i;
  }

  remove(i) {
    const j = --this.n;
    if (i === j) return;
    for (let k = 0; k < 3; k++) {
      this.pos[i * 3 + k] = this.pos[j * 3 + k];
      this.vel[i * 3 + k] = this.vel[j * 3 + k];
    }
    this.age[i] = this.age[j];
    this.ttl[i] = this.ttl[j];
    this.seed[i] = this.seed[j];
    this.heat[i] = this.heat[j];
  }

  // A puff: `count` particles at once from the source (a candle blown out).
  puff(count, { at, speed, heat = 1.4 } = {}) {
    const e = this.emitter;
    const c = at || e.at;
    const sp = speed ?? e.speed * 1.6;
    for (let k = 0; k < count; k++) {
      const a = this.rand() * 6.283;
      const r = Math.sqrt(this.rand()) * e.radius * 1.5;
      this.spawn(
        c[0] + Math.cos(a) * r,
        c[1] + this.rand() * e.radius,
        c[2] + Math.sin(a) * r,
        e.dir[0] * sp,
        e.dir[1] * sp,
        e.dir[2] * sp,
        heat,
      );
    }
  }

  step(dt) {
    this.time += dt;
    const e = this.emitter;
    const rand = this.rand;
    if (e.on && e.flow > 0) {
      e.acc += e.rate * e.flow * dt;
      while (e.acc >= 1) {
        e.acc--;
        const a = rand() * 6.283;
        const r = Math.sqrt(rand()) * e.radius;
        const lag = rand() * dt;
        this.spawn(
          e.at[0] + Math.cos(a) * r + e.dir[0] * e.speed * lag,
          e.at[1] + e.dir[1] * e.speed * lag,
          e.at[2] + Math.sin(a) * r + e.dir[2] * e.speed * lag,
          e.dir[0] * e.speed,
          e.dir[1] * e.speed,
          e.dir[2] * e.speed,
        );
      }
    }
    const { pos, vel, age, ttl, heat, old } = this;
    const up = this.up;
    const H = this.spec.height ?? this.size * 20;
    const turb = this.turbulence;
    const k = 1 - Math.exp(-dt * 2.5);
    for (let i = this.n - 1; i >= 0; i--) {
      age[i] += dt;
      if (age[i] > ttl[i]) {
        this.remove(i);
        continue;
      }
      const i3 = i * 3;
      const x = pos[i3];
      const y = pos[i3 + 1];
      const z = pos[i3 + 2];
      old[i3] = x;
      old[i3 + 1] = y;
      old[i3 + 2] = z;
      // Height above the source along "up": laminar low, turbulent high.
      const hgt = (x - e.at[0]) * up[0] + (y - e.at[1]) * up[1] + (z - e.at[2]) * up[2];
      const mixH = Math.min(1, Math.max(0, hgt / H));
      const f = age[i] / ttl[i];
      const lift = this.rise * heat[i] * (1 - 0.7 * f);
      const c = this.curl.at(x, y, z, this.time * (0.8 + turb));
      const sw = turb * this.rise * (0.25 + 2.2 * mixH * mixH) * (0.6 + heat[i] * 0.4);
      const tx = up[0] * lift + c[0] * sw + this.wind[0] * mixH;
      const ty = up[1] * lift + c[1] * sw + this.wind[1] * mixH;
      const tz = up[2] * lift + c[2] * sw + this.wind[2] * mixH;
      vel[i3] += (tx - vel[i3]) * k;
      vel[i3 + 1] += (ty - vel[i3 + 1]) * k;
      vel[i3 + 2] += (tz - vel[i3 + 2]) * k;
      pos[i3] = x + vel[i3] * dt;
      pos[i3 + 1] = y + vel[i3 + 1] * dt;
      pos[i3 + 2] = z + vel[i3 + 2] * dt;
      heat[i] += (1 - heat[i]) * Math.min(1, dt * 0.8);
      if (this.colliders.length) collide(this.colliders, pos, i, x, y, z, this.size * 0.5, 0.5);
    }
  }
}

// ---- Flame -----------------------------------------------------------------------------------------

export class Flame {
  constructor(spec, { cap, gravity, seed }) {
    this.spec = spec;
    this.kind = "flame";
    this.name = spec.name;
    this.cap = cap;
    this.at = (spec.at || [0, 0, 0]).slice();
    this.height = spec.height ?? 0.3;
    this.radius = spec.radius ?? this.height * 0.14;
    this.life = spec.life ?? 0.42;
    this.sparks = spec.sparks ?? 0.3;
    this.up = unit3(gravity.map((v) => -v));
    this.rand = mulberry32(mixSeed(seed, `flame-${spec.name}`));
    this.n = 0;
    this.pos = new Float32Array(cap * 3);
    this.vel = new Float32Array(cap * 3);
    this.age = new Float32Array(cap);
    this.ttl = new Float32Array(cap);
    this.seed = new Float32Array(cap);
    this.pkind = new Uint8Array(cap);
    this.on = spec.on ?? true;
    this.size = 1; // grows in and dies away when lit or put out
    this.time = 0;
    this.acc = 0;
    this.wind = [0, 0, 0];
    this.gust = 0;
    this.smoke = null; // a Gas system the flame hands its heat to
  }

  spawn(kind, x, y, z, vx, vy, vz, life) {
    if (this.n >= this.cap) return -1;
    const i = this.n++;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.age[i] = 0;
    this.ttl[i] = life;
    this.seed[i] = this.rand();
    this.pkind[i] = kind;
    return i;
  }

  remove(i) {
    const j = --this.n;
    if (i === j) return;
    for (let k = 0; k < 3; k++) {
      this.pos[i * 3 + k] = this.pos[j * 3 + k];
      this.vel[i * 3 + k] = this.vel[j * 3 + k];
    }
    this.age[i] = this.age[j];
    this.ttl[i] = this.ttl[j];
    this.seed[i] = this.seed[j];
    this.pkind[i] = this.pkind[j];
  }

  step(dt) {
    this.time += dt;
    const rand = this.rand;
    const t = this.time;
    // The flame grows in when lit and shrinks when put out.
    this.size += ((this.on ? 1 : 0) - this.size) * Math.min(1, dt * (this.on ? 2.2 : 9));
    const H = this.height * this.size;
    const life = this.life;
    // Rise speed so a particle reaches the tip over its life.
    const v0 = (H / life) * 0.55;
    const acc = (2 * (H - v0 * life)) / (life * life);
    const [ux, uy, uz] = this.up;
    // A whole-flame flicker: the tip sways and the height breathes.
    // A candle flame's flicker ("puffing") is near 10 to 12 Hz (Kitahata et
    // al. 2009; Cetegen and Ahmed 1993, f = 1.5 / sqrt(D)); two close tones
    // around 11 Hz beat slowly, with a slow breath under them.
    const hz = this.spec.flicker ?? 11;
    const fl =
      Math.sin(t * 2 * Math.PI * hz) * 0.65 + Math.sin(t * 2 * Math.PI * hz * 0.92 + 1.3) * 0.35;
    // Each puff stretches the flame up and then pinches its tip off (the
    // oldest flame particles end early on the pinch).
    const puff = (this.spec.puffing ?? 0.2) * fl;
    const pinch = 1 - (this.spec.pinch ?? 0.16) * (1 - fl);
    const sway = [
      (Math.sin(t * 3.3) * 0.6 + Math.sin(t * 8.9 + 2) * 0.4) * 0.35 + this.wind[0],
      0,
      (Math.cos(t * 2.7 + 1) * 0.6 + Math.sin(t * 9.7) * 0.4) * 0.35 + this.wind[2],
    ];
    if (this.size > 0.03) {
      const rate = (this.cap * 0.92 * this.size) / life;
      this.acc += rate * dt;
      while (this.acc >= 1) {
        this.acc--;
        const a = rand() * 6.283;
        const r = Math.sqrt(rand()) * this.radius * this.size;
        const lag = rand() * dt;
        this.spawn(
          KIND.flame,
          this.at[0] + Math.cos(a) * r,
          this.at[1] + v0 * lag,
          this.at[2] + Math.sin(a) * r,
          ux * v0,
          uy * v0 * (0.9 + 0.2 * rand()),
          uz * v0,
          life * (0.7 + 0.45 * rand()) * Math.max(0.3, this.size),
        );
      }
      if (rand() < this.sparks * dt * 2.2 * this.size) {
        const s = 1.2 * v0;
        this.spawn(
          KIND.spark,
          this.at[0],
          this.at[1] + H * 0.6,
          this.at[2],
          (rand() - 0.5) * s,
          s * (1 + rand()),
          (rand() - 0.5) * s,
          0.7 + rand() * 0.6,
        );
      }
    }
    const { pos, vel, age, ttl, pkind } = this;
    const pull = 3.2 / life;
    for (let i = this.n - 1; i >= 0; i--) {
      age[i] += dt;
      const i3 = i * 3;
      if (age[i] >= ttl[i] * (pkind[i] === KIND.flame ? pinch : 1)) {
        // The flame's last heat becomes smoke (none when it burns
        // cleanly, as a candle does; a lot when it is put out).
        if (this.smoke && pkind[i] === KIND.flame) {
          const p = this.on ? (this.spec.smokeRate ?? 0) : 0.6;
          if (rand() < p)
            this.smoke.spawn(pos[i3], pos[i3 + 1], pos[i3 + 2], vel[i3] * 0.5, vel[i3 + 1] * 0.5, vel[i3 + 2] * 0.5, 1.1); // prettier-ignore
        }
        this.remove(i);
        continue;
      }
      const f = Math.min(1, age[i] / ttl[i]);
      if (pkind[i] === KIND.spark) {
        vel[i3 + 1] += (-9.8 * 0.15 + acc * 0.05) * dt;
        vel[i3] *= 1 - dt * 0.8;
        vel[i3 + 2] *= 1 - dt * 0.8;
      } else {
        // Up, faster as it heats; drawn in toward the axis into a tongue,
        // swaying more near the tip.
        vel[i3] += (ux * acc + sway[0] * f * f * 6 - (pos[i3] - this.at[0]) * pull * (0.6 + f)) * dt; // prettier-ignore
        vel[i3 + 1] += uy * acc * (1 + puff * f * 2) * dt;
        vel[i3 + 2] += (uz * acc + sway[2] * f * f * 6 - (pos[i3 + 2] - this.at[2]) * pull * (0.6 + f)) * dt; // prettier-ignore
        vel[i3] *= 1 - dt * 2;
        vel[i3 + 2] *= 1 - dt * 2;
      }
      pos[i3] += vel[i3] * dt;
      pos[i3 + 1] += vel[i3 + 1] * dt;
      pos[i3 + 2] += vel[i3 + 2] * dt;
    }
  }
}

// ---- Helpers -------------------------------------------------------------------------------------

export function unit3(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function perp(d) {
  const a = Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  return unit3([a[1] * d[2] - a[2] * d[1], a[2] * d[0] - a[0] * d[2], a[0] * d[1] - a[1] * d[0]]);
}

const SHAPE_C = new Float64Array(9);
const EIG = { val: new Float64Array(3), vec: new Float64Array(9) };
const EA = new Float64Array(9);
const EV = new Float64Array(9);
const ORDER = [0, 1, 2];

// Eigenvalues (largest first) and unit eigenvectors (rows of vec) of a
// symmetric 3x3 matrix, by Jacobi rotations.
export function eigen3(m) {
  const a = EA;
  const v = EV;
  a.set(m);
  v.fill(0);
  v[0] = v[4] = v[8] = 1;
  for (let sweep = 0; sweep < 8; sweep++) {
    const off = a[1] * a[1] + a[2] * a[2] + a[5] * a[5];
    if (off < 1e-22) break;
    for (let r = 0; r < 3; r++) {
      const p = r === 2 ? 1 : 0;
      const q = r === 0 ? 1 : 2;
      const apq = a[p * 3 + q];
      if (Math.abs(apq) < 1e-30) continue;
      const theta = (a[q * 3 + q] - a[p * 3 + p]) / (2 * apq);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1);
      const s = t * c;
      for (let k = 0; k < 3; k++) {
        const akp = a[k * 3 + p];
        const akq = a[k * 3 + q];
        a[k * 3 + p] = c * akp - s * akq;
        a[k * 3 + q] = s * akp + c * akq;
      }
      for (let k = 0; k < 3; k++) {
        const apk = a[p * 3 + k];
        const aqk = a[q * 3 + k];
        a[p * 3 + k] = c * apk - s * aqk;
        a[q * 3 + k] = s * apk + c * aqk;
      }
      for (let k = 0; k < 3; k++) {
        const vkp = v[k * 3 + p];
        const vkq = v[k * 3 + q];
        v[k * 3 + p] = c * vkp - s * vkq;
        v[k * 3 + q] = s * vkp + c * vkq;
      }
    }
  }
  // Largest first (a three-item sort).
  let i0 = 0;
  let i1 = 1;
  let i2 = 2;
  let t;
  if (a[i1 * 4] > a[i0 * 4]) [t, i0, i1] = [i0, i1, i0];
  if (a[i2 * 4] > a[i1 * 4]) [t, i1, i2] = [i1, i2, i1];
  if (a[i1 * 4] > a[i0 * 4]) [t, i0, i1] = [i0, i1, i0];
  ORDER[0] = i0;
  ORDER[1] = i1;
  ORDER[2] = i2;
  for (let r = 0; r < 3; r++) {
    const col = ORDER[r];
    EIG.val[r] = a[col * 4];
    EIG.vec[r * 3] = v[col];
    EIG.vec[r * 3 + 1] = v[3 + col];
    EIG.vec[r * 3 + 2] = v[6 + col];
  }
  return EIG;
}

// A quaternion (x, y, z, w) from three orthonormal axes, into out[o..o+3].
export function quatFromAxes(ax, ay, az, bx, by, bz, cx, cy, cz, out, o) {
  const tr = ax + by + cz;
  let x;
  let y;
  let z;
  let w;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    w = 0.25 * s;
    x = (bz - cy) / s;
    y = (cx - az) / s;
    z = (ay - bx) / s;
  } else if (ax > by && ax > cz) {
    const s = Math.sqrt(1 + ax - by - cz) * 2;
    w = (bz - cy) / s;
    x = 0.25 * s;
    y = (bx + ay) / s;
    z = (cx + az) / s;
  } else if (by > cz) {
    const s = Math.sqrt(1 + by - ax - cz) * 2;
    w = (cx - az) / s;
    x = (bx + ay) / s;
    y = 0.25 * s;
    z = (cy + bz) / s;
  } else {
    const s = Math.sqrt(1 + cz - ax - by) * 2;
    w = (ay - bx) / s;
    x = (cx + az) / s;
    y = (cy + bz) / s;
    z = 0.25 * s;
  }
  const l = Math.sqrt(x * x + y * y + z * z + w * w) || 1;
  out[o] = x / l;
  out[o + 1] = y / l;
  out[o + 2] = z / l;
  out[o + 3] = w / l;
}

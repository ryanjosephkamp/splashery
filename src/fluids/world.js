// Lane Fluids: a toy's fluids (docs/FLUIDS.md). Builds the systems a recipe
// declared with k.fluid(...), scaled to the device tier, applies what the
// recipe's drive() asks for in out.fluid, steps them and packs every
// particle for the renderer (src/fluids/render.js). Pure JavaScript: it runs
// on the page or in the worker (src/fluids/worker.js).

import { Liquid, Gas, Flame, KIND, LIQUIDS, unit3, quatFromAxes } from "./sim.js";
import { mulberry32 } from "../noise.js";
import { mixSeed } from "../noise.js";

// How much of a recipe's budget each tier gets (the budget is for "high").
export const TIER_SCALE = { low: 0.35, mid: 0.45, high: 1, max: 1.35 };

// The longest liquid step (s), and the most steps per frame: a slow device
// runs the liquid in slow motion rather than taking steps it can't keep.
const LIQUID_STEP = 1 / 120;
const MAX_STEPS = { low: 2, mid: 3, high: 4, max: 4 };
const GAS_STEP = 1 / 30;

export class FluidWorld {
  // specs: the recipe's k.fluid() calls. profile: the tier. transform: the
  // kit's fit ({ center, scale }), recipe -> toy coordinates.
  constructor(specs, { profile = "high", seed = 1, transform = null } = {}) {
    this.profile = TIER_SCALE[profile] ? profile : "high";
    const tier = TIER_SCALE[this.profile];
    this.transform = transform || { center: [0, 0, 0], scale: 1 };
    this.systems = [];
    this.byName = new Map();
    this.slots = 0;
    this.time = 0;
    this.maxSteps = MAX_STEPS[this.profile];
    this.lastOnce = new Map();
    this.stats = { steps: 0, simMs: 0, particles: 0 };
    specs.forEach((spec, i) => {
      const name = spec.name || `${spec.kind || "liquid"}${i}`;
      const budget = Math.max(16, Math.round((spec.budget ?? 1500) * tier));
      const unit = spec.unit ?? 0.1; // meters per recipe unit
      const gravity = spec.gravity
        ? typeof spec.gravity === "number"
          ? [0, -spec.gravity, 0]
          : spec.gravity.slice()
        : [0, -9.8 / unit, 0];
      const s = mixSeed(seed, name);
      let sys;
      const full = { ...spec, name };
      if ((spec.kind || "liquid") === "liquid") {
        // Fewer particles on a lower tier, each a little bigger, so the
        // same volume of liquid pours.
        const spacing = (spec.spacing ?? 0.05) * Math.cbrt((spec.budget ?? 1500) / budget);
        full.iters = spec.iters ?? (this.profile === "low" ? 2 : 3);
        sys = new Liquid(full, { cap: budget, spacing, gravity, seed: s });
      } else if (spec.kind === "gas") {
        sys = new Gas(full, { cap: budget, gravity, seed: s });
      } else if (spec.kind === "flame") {
        sys = new Flame(full, { cap: budget, gravity, seed: s });
      } else if (spec.kind === "vessel") {
        sys = new Vessel(full, { cap: budget, seed: s });
      } else {
        throw new Error(`Unknown fluid kind "${spec.kind}".`);
      }
      sys.index = i;
      sys.base = this.slots;
      sys.slots = sys.cap + (sys.dcap || 0);
      this.slots += sys.slots;
      this.systems.push(sys);
      this.byName.set(name, sys);
      this.byName.set(i, sys);
    });
    // A flame hands its heat to a smoke system.
    for (const sys of this.systems)
      if (sys.kind === "flame" && sys.spec.smoke) {
        const g = this.byName.get(sys.spec.smoke);
        if (g?.kind === "gas") sys.smoke = g;
      }
  }

  // What the recipe asked for this frame: out.fluid = { name: { ... } }.
  //   on        the emitter (or flame) runs
  //   flow      0..1, how strongly
  //   at, dir, speed   aim the emitter (recipe coordinates)
  //   wind      [x, y, z] pushes smoke, steam and flames
  //   drain     0..1 of the budget per second leaves from the bottom
  //   once      { id, do: "drop" | "puff" | "reset" | "fill", ... }: fires
  //             once for each new id (a tap's number)
  command(cmds) {
    if (!cmds) return;
    for (const key of Object.keys(cmds)) {
      const sys = this.byName.get(key) ?? this.byName.get(Number(key));
      const c = cmds[key];
      if (!sys || !c) continue;
      if (sys.kind === "flame") {
        if (c.on !== undefined) sys.on = !!c.on;
        if (c.wind) sys.wind = c.wind.slice();
        if (c.at) sys.at = c.at.slice();
      } else {
        const e = sys.emitter;
        if (e) {
          if (c.on !== undefined) e.on = !!c.on;
          if (c.flow !== undefined) e.flow = Math.max(0, c.flow);
          if (c.at) e.at = c.at.slice();
          if (c.dir) e.dir = unit3(c.dir);
          if (c.speed !== undefined) e.speed = c.speed;
          if (c.radius !== undefined) e.radius = c.radius;
        }
        if (sys.kind === "gas" && c.wind) sys.wind = c.wind.slice();
        if (sys.kind === "liquid") {
          sys.drain = Math.max(0, c.drain ?? 0);
          if (c.fizz !== undefined) sys.fizzBoost = c.fizz;
        }
      }
      const once = c.once;
      if (once && once.id !== undefined && this.lastOnce.get(sys) !== once.id) {
        const first = !this.lastOnce.has(sys);
        this.lastOnce.set(sys, once.id);
        // The first command seen only records the id (a toy opened after a
        // tap doesn't replay it), unless it asks to run now.
        if (!first || once.now) this.fire(sys, once);
      }
    }
  }

  fire(sys, o) {
    if (o.do === "drop" && sys.kind === "liquid") {
      sys.drop(o.at || [0, 1, 0], o.radius ?? sys.d * 4, o.vel || [0, 0, 0]);
    } else if (o.do === "puff" && sys.kind === "gas") {
      sys.puff(o.count ?? Math.round(sys.cap * 0.25), o);
    } else if (o.do === "reset") {
      sys.n = 0;
      if (sys.dn !== undefined) sys.dn = 0;
      if (sys.kind === "liquid" && sys.spec.fill) sys.fill(sys.spec.fill);
    } else if (o.do === "fill" && sys.kind === "liquid" && o.region) {
      sys.fill(o.region, { count: o.count ?? Infinity });
    }
  }

  // Advances every system by dt seconds of the toy's clock.
  step(dt) {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.25);
    const t0 = performance.now();
    this.time += dt;
    let steps = 0;
    for (const sys of this.systems) {
      if (sys.kind === "liquid") {
        const n = Math.min(this.maxSteps, Math.max(1, Math.ceil(dt / LIQUID_STEP - 1e-6)));
        const h = Math.min(LIQUID_STEP, dt / n);
        for (let k = 0; k < n; k++) sys.step(h);
        steps += n;
      } else {
        const n = Math.max(1, Math.ceil(dt / GAS_STEP - 1e-6));
        for (let k = 0; k < n; k++) sys.step(dt / n);
      }
    }
    this.stats.steps = steps;
    this.stats.simMs = performance.now() - t0;
    this.stats.particles = this.count();
  }

  count() {
    let n = 0;
    for (const s of this.systems) n += s.n + (s.dn || 0);
    return n;
  }

  // Writes every slot for the renderer, in toy coordinates:
  //   center  xyz the drawn place, w 0
  //   anim    xyz velocity, w kind + 0.999 * f (f: age 0..1, or for a
  //           liquid how alone the particle is, 0 in the bulk .. 1 a drop)
  //   shape   the splat's turn, a quaternion (x, y, z, w); for a liquid its
  //           z axis is the outward normal
  //   size    xyz its relative radii, w material + surface / 16 + tone / 256
  //           (surface and tone 0..15: how much of a surface it is on, and
  //           lava's heat or a random number)
  pack(center, anim, shape, size) {
    const { center: tc, scale: s } = this.transform;
    for (const sys of this.systems) {
      let o = sys.base;
      const mat = sys.index;
      const put = (x, y, z, vx, vy, vz, kind, f, surf, tone) => {
        const o4 = o * 4;
        center[o4] = (x - tc[0]) * s;
        center[o4 + 1] = (y - tc[1]) * s;
        center[o4 + 2] = (z - tc[2]) * s;
        center[o4 + 3] = 0;
        anim[o4] = vx * s;
        anim[o4 + 1] = vy * s;
        anim[o4 + 2] = vz * s;
        anim[o4 + 3] = kind + 0.999 * Math.min(1, Math.max(0, f));
        size[o4 + 3] = mat + Math.round(Math.min(1, Math.max(0, surf)) * 15) / 16 + Math.round(Math.min(1, Math.max(0, tone)) * 15) / 256; // prettier-ignore
        o++;
      };
      const plain = (from, to) => {
        for (let k = from; k < to; k++) {
          const k4 = k * 4;
          shape[k4] = shape[k4 + 1] = shape[k4 + 2] = 0;
          shape[k4 + 3] = 1;
          size[k4] = size[k4 + 1] = size[k4 + 2] = 1;
        }
      };
      if (sys.kind === "liquid") {
        const { vel, nrm, count, hot, seed } = sys;
        sys.shape(sys.rp, sys.rq, sys.rs);
        const { rp, rq, rs } = sys;
        const glow = LIQUIDS[sys.spec.preset]?.glow || sys.spec.glow;
        shape.set(rq.subarray(0, sys.n * 4), o * 4);
        for (let i = 0; i < sys.n; i++) {
          const o4 = (o + i) * 4;
          size[o4] = rs[i * 4];
          size[o4 + 1] = rs[i * 4 + 1];
          size[o4 + 2] = rs[i * 4 + 2];
        }
        for (let i = 0; i < sys.n; i++) {
          const i3 = i * 3;
          put(
            rp[i3], rp[i3 + 1], rp[i3 + 2],
            vel[i3], vel[i3 + 1], vel[i3 + 2],
            KIND.liquid, 1 - Math.min(count[i], 16) / 16,
            nrm[i * 4 + 3], glow ? hot[i] : seed[i],
          ); // prettier-ignore
        }
        plain(o, o + sys.dn);
        for (let i = 0; i < sys.dn; i++) {
          const i3 = i * 3;
          put(
            sys.dpos[i3], sys.dpos[i3 + 1], sys.dpos[i3 + 2],
            sys.dvel[i3], sys.dvel[i3 + 1], sys.dvel[i3 + 2],
            sys.dkind[i], sys.dage[i] / sys.dlife[i], 0, sys.dseed[i],
          ); // prettier-ignore
        }
      } else if (sys.kind === "gas") {
        plain(o, o + sys.n);
        for (let i = 0; i < sys.n; i++) {
          const i3 = i * 3;
          put(
            sys.pos[i3], sys.pos[i3 + 1], sys.pos[i3 + 2],
            sys.vel[i3], sys.vel[i3 + 1], sys.vel[i3 + 2],
            sys.pkind, sys.age[i] / sys.ttl[i], 0, sys.seed[i],
          ); // prettier-ignore
        }
      } else if (sys.kind === "vessel") {
        shape.set(sys.rq.subarray(0, sys.n * 4), o * 4);
        for (let i = 0; i < sys.n; i++) {
          const o4 = (o + i) * 4;
          size[o4] = size[o4 + 1] = 1;
          size[o4 + 2] = 0.25;
        }
        for (let i = 0; i < sys.n; i++) {
          const i3 = i * 3;
          put(sys.pos[i3], sys.pos[i3 + 1], sys.pos[i3 + 2], 0, 0, 0, KIND.vessel, sys.edge[i], 0, 0); // prettier-ignore
        }
      } else {
        plain(o, o + sys.n);
        for (let i = 0; i < sys.n; i++) {
          const i3 = i * 3;
          put(
            sys.pos[i3], sys.pos[i3 + 1], sys.pos[i3 + 2],
            sys.vel[i3], sys.vel[i3 + 1], sys.vel[i3 + 2],
            sys.pkind[i], sys.age[i] / sys.ttl[i], 0, sys.seed[i],
          ); // prettier-ignore
        }
      }
      // The rest of this system's slots are empty.
      const end = sys.base + sys.slots;
      plain(o, end);
      for (; o < end; o++) {
        const o4 = o * 4;
        center[o4] = center[o4 + 1] = center[o4 + 2] = 0;
        anim[o4] = anim[o4 + 1] = anim[o4 + 2] = anim[o4 + 3] = 0;
        size[o4 + 3] = mat;
      }
    }
  }

  // The per-system look for the renderer: [color rgb, opacity] and
  // [size (toy units), glow, stretch, 0] per system.
  materials() {
    const s = this.transform.scale;
    return this.systems.map((sys) => {
      const spec = sys.spec;
      const preset = LIQUIDS[spec.preset] || {};
      const color = hexToRgb(spec.color || preset.color || defaultColor(sys));
      let size;
      if (sys.kind === "liquid") size = sys.d * (spec.splat ?? 0.72);
      else if (sys.kind === "gas") size = sys.size;
      else if (sys.kind === "vessel") size = sys.spacing * 0.75;
      else size = sys.radius * 0.9;
      return {
        color,
        opacity: spec.opacity ?? (sys.kind === "gas" ? (spec.look === "steam" ? 0.22 : 0.3) : sys.kind === "vessel" ? 0.5 : 0.97), // prettier-ignore
        size: size * s,
        glow: spec.glow ?? preset.glow ?? 0,
        stretch: spec.stretch ?? preset.stretch ?? (sys.kind === "liquid" ? 0.06 : 0.04),
      };
    });
  }
}

// A glass drawn by the fluid layer (kind "vessel"): even splats over its
// outer and inner walls, lip and foot, each flat along the surface. The
// renderer makes them clear where you look straight through and bright
// toward the edges, as real glass is. shape: a "glass" collider.
class Vessel {
  constructor(spec, { cap, seed }) {
    this.spec = spec;
    this.kind = "vessel";
    this.name = spec.name;
    this.cap = cap;
    const g = spec.shape;
    const [x0, y0, z0] = g.at;
    const r = g.radius;
    const w = g.wall ?? r * 0.08;
    const R = r + w;
    const b = g.bottom ?? w;
    const H = g.height;
    // Surfaces: [area, sample(u, v) -> [p, n, edge]].
    const surfaces = [
      [2 * Math.PI * R * H, (u, v) => { const a = u * 2 * Math.PI; return [[x0 + R * Math.cos(a), y0 + v * H, z0 + R * Math.sin(a)], [Math.cos(a), 0, Math.sin(a)], 0]; }], // prettier-ignore
      [2 * Math.PI * r * (H - b), (u, v) => { const a = u * 2 * Math.PI; return [[x0 + r * Math.cos(a), y0 + b + v * (H - b), z0 + r * Math.sin(a)], [-Math.cos(a), 0, -Math.sin(a)], 0]; }], // prettier-ignore
      [Math.PI * (R * R - r * r), (u, v) => { const a = u * 2 * Math.PI; const rr = Math.sqrt(r * r + v * (R * R - r * r)); return [[x0 + rr * Math.cos(a), y0 + H, z0 + rr * Math.sin(a)], [0, 1, 0], 1]; }], // prettier-ignore
      [Math.PI * r * r, (u, v) => { const a = u * 2 * Math.PI; const rr = r * Math.sqrt(v); return [[x0 + rr * Math.cos(a), y0 + b, z0 + rr * Math.sin(a)], [0, 1, 0], 0.4]; }], // prettier-ignore
      [Math.PI * R * R, (u, v) => { const a = u * 2 * Math.PI; const rr = R * Math.sqrt(v); return [[x0 + rr * Math.cos(a), y0 + 0.002, z0 + rr * Math.sin(a)], [0, -1, 0], 0.4]; }], // prettier-ignore
    ];
    const total = surfaces.reduce((t, sf) => t + sf[0], 0);
    this.spacing = Math.sqrt(total / cap);
    this.pos = new Float32Array(cap * 3);
    this.rq = new Float32Array(cap * 4);
    this.edge = new Float32Array(cap);
    const rand = mulberry32(seed);
    let n = 0;
    for (const [area, sample] of surfaces) {
      const m = Math.round((cap * area) / total);
      // An even R2 sequence over the surface's (u, v).
      const o1 = rand();
      const o2 = rand();
      for (let k = 0; k < m && n < cap; k++, n++) {
        const [p, nn, edge] = sample((o1 + k * 0.7548776662) % 1, (o2 + k * 0.5698402909) % 1);
        this.pos.set(p, n * 3);
        const t = unit3(Math.abs(nn[1]) < 0.9 ? [-nn[2], 0, nn[0]] : [1, 0, 0]);
        const bx = nn[1] * t[2] - nn[2] * t[1];
        const by = nn[2] * t[0] - nn[0] * t[2];
        const bz = nn[0] * t[1] - nn[1] * t[0];
        quatFromAxes(t[0], t[1], t[2], bx, by, bz, nn[0], nn[1], nn[2], this.rq, n * 4);
        this.edge[n] = edge;
      }
    }
    this.n = n;
  }

  step() {}
}

function defaultColor(sys) {
  if (sys.kind === "gas") return sys.spec.look === "steam" ? "#f4f6f8" : "#8a8a8a";
  if (sys.kind === "flame") return "#ffb347";
  if (sys.kind === "vessel") return "#e4f2f8";
  return "#8fc8ec";
}

export function hexToRgb(c) {
  if (Array.isArray(c)) return c.slice(0, 3);
  const h = String(c).replace("#", "");
  const v = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

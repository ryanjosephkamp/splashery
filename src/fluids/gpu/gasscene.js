// Lane Fluids r4: a toy's smoke, steam and flames on gas grids (gas.js), fed
// by the recipe's gas and flame specs and steered by out.fluid in the same
// words as the particle systems in sim.js (on, flow, wind).
//
// A flame gets its own small, fine grid (a candle flame is about a
// centimeter wide, too thin for the smoke's grid); smoke and steam share a
// larger, coarser one. Both are drawn by the surface pass.

import { GasGrid } from "./gas.js";

const hex = (h) => {
  const n = parseInt((h || "#999999").slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export class GasScene {
  constructor(device, specs, { profile = "high" } = {}) {
    this.flame = specs.find((s) => s.kind === "flame") || null;
    this.gases = specs.filter((s) => s.kind === "gas");
    this.names = new Set([...this.gases.map((s) => s.name), this.flame?.name].filter(Boolean));
    this.state = new Map();
    for (const s of this.gases) this.state.set(s.name, { on: s.source?.on ?? true, flow: 1, wind: [0, 0, 0] }); // prettier-ignore
    if (this.flame) this.state.set(this.flame.name, { on: this.flame.on ?? true, wind: [0, 0, 0] });
    this.profile = profile;
    this.steps = profile === "low" ? 18 : profile === "mid" ? 28 : 56;
    if (this.flame) this.makeFlame(device);
    if (this.gases.some((s) => s.source)) this.makeSmoke(device);
  }

  makeFlame(device) {
    const f = this.flame;
    const H = f.height ?? 0.3;
    // The grid is a little taller than the recipe's flame and about a third
    // as wide.
    const w = Math.max(0.1, H * 0.45);
    const g = new GasGrid(device, { at: [f.at[0], f.at[1] - 0.02, f.at[2]], size: [w, H * 1.3, w], profile: this.profile }); // prettier-ignore
    const c = g.cell;
    // The flame's gas is fast for its size: small steps (120 a second).
    g.hz = 120;
    g.maxSteps = 6;
    g.jacobi = 10;
    Object.assign(g.params, {
      heatLift: 0.6 / c,
      smokeWeight: 0,
      // (slow enough that the fuel rises about three wick heights, the
      // length of a real candle flame)
      burn: 24,
      burnHeat: 4,
      vort: 1,
      noise: 0,
      decay: [0.9, 0.88, 0.97, 1],
    });
    this.flameGrid = g;
    this.flameLook = { color: [0, 0, 0], density: 0, flame: 85, steps: this.steps, light: 0 };
  }

  makeSmoke(device) {
    const srcs = this.gases.map((s) => s.source).filter(Boolean);
    const r = Math.max(...srcs.map((s) => s.radius ?? 0.05));
    const steam = this.gases.some((s) => s.look === "steam");
    this.steam = steam;
    const at = srcs[0].at;
    const w = Math.max(steam ? 0.6 : 0.4, 2 * r + 0.3);
    const g = new GasGrid(device, { at: [at[0], at[1] - 0.04, at[2]], size: [w, 1.3, w], profile: this.profile }); // prettier-ignore
    const c = g.cell;
    Object.assign(g.params, {
      heatLift: (steam ? 3 : 9) / c,
      smokeWeight: 0.3 / c,
      burn: 0,
      burnHeat: 0,
      // Steam from a cup: faint wisps that curl and are gone within a
      // cup's height or two; smoke: a thin ribbon that turns wavy as it rises.
      vort: steam ? 6 : 6,
      noise: (steam ? 2.5 : 1.8) / c,
      decay: steam ? [0.955, 0.95, 0.9, 1] : [0.993, 0.96, 0.9, 1],
    });
    this.smokeGrid = g;
    this.smokeLook = {
      // (a candle's smoke is pale gray where the room's light catches it)
      color: steam ? [0.93, 0.95, 0.97] : hex(this.gases[0]?.color || "#8f8f8f").map((c) => c + (0.92 - c) * 0.5), // prettier-ignore
      density: steam ? 6 : 30,
      flame: 0,
      steps: this.steps,
      light: steam ? 1.15 : 1.1,
    };
  }

  get grid() {
    return this.flameGrid || this.smokeGrid || null;
  }

  handles(name) {
    return this.names.has(name);
  }

  command(cmds) {
    if (!cmds) return;
    for (const [name, c] of Object.entries(cmds)) {
      const st = this.state.get(name);
      if (!st || !c) continue;
      if (c.on !== undefined) st.on = !!c.on;
      if (c.flow !== undefined) st.flow = Math.max(0, c.flow);
      if (c.wind) st.wind = c.wind.slice();
    }
  }

  step(dt) {
    if (!(dt > 0)) return 0;
    let n = 0;
    if (this.flameGrid) {
      const f = this.flame;
      const st = this.state.get(f.name);
      const g = this.flameGrid;
      // A flame lit again grows back over about half a second (a full
      // fuel jet into still air stands up as a thin rod first).
      st.lit = st.on ? Math.min(1, (st.lit ?? 1) + dt / 0.6) : 0;
      // (and in still air: the old flame's updraft is gone by then)
      if (st.on && st.wasOff) g.clearAll();
      st.wasOff = !st.on;
      g.sources.a = st.on
        ? {
            at: [f.at[0], f.at[1] + (f.height ?? 0.3) * 0.06, f.at[2]],
            radius: Math.max((f.radius ?? 0.05) * 0.8, g.cell * 3),
            fuel: 60 * st.lit * st.lit,
            heat: 3,
            up: 0.1,
            ...this.srcTune,
          }
        : null;
      g.sources.b = null;
      g.params.wind = st.wind.map((w) => w * 3);
      n += g.advance(dt);
    }
    if (this.smokeGrid) {
      const g = this.smokeGrid;
      const wind = [0, 0, 0];
      const list = [];
      for (const s of this.gases) {
        const st = this.state.get(s.name);
        for (let k = 0; k < 3; k++) wind[k] += st.wind[k];
        if (!st.on || !s.source) continue;
        const src = s.source;
        const flow = st.flow ?? 1;
        const steam = s.look === "steam";
        list.push({
          at: src.at,
          // (a smoking wick sends up a thin thread)
          radius: Math.max(src.radius ?? 0.03, g.cell * 1.5) * (steam ? 0.9 : 1.3),
          smoke: (steam ? 3.2 : 280) * flow,
          heat: (steam ? 0.9 : 2.2) * flow,
          up: (src.speed ?? s.rise ?? 0.4) * (steam ? 0.6 : 1),
        });
      }
      if (this.flame)
        for (let k = 0; k < 3; k++) wind[k] += this.state.get(this.flame.name).wind[k];
      g.sources.a = list[0] || null;
      g.sources.b = list[1] || null;
      g.params.wind = wind.map((w) => w * 3);
      n += g.advance(dt);
    }
    return n;
  }

  // What the surface pass draws: up to two grids.
  view() {
    const out = [];
    // (steps: the ray march's, which a struggling phone lowers: index.js)
    if (this.flameGrid) out.push({ grid: this.flameGrid, ...this.flameLook, steps: this.steps });
    if (this.smokeGrid) out.push({ grid: this.smokeGrid, ...this.smokeLook, steps: this.steps });
    return out;
  }

  destroy() {
    this.flameGrid?.destroy();
    this.smokeGrid?.destroy();
    this.flameGrid = this.smokeGrid = null;
  }
}

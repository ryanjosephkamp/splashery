// Lane Fluids r4: a toy's smoke, steam and flames on one gas grid (gas.js),
// fed by the recipe's gas and flame specs and steered by out.fluid, in the
// same words as the particle systems in sim.js (on, flow, wind, puff).

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
    // One grid over every source: from just below the lowest to a meter-ish
    // above, wide enough for the widest source and its curls.
    const srcs = [...this.gases.map((s) => s.source), this.flame && { at: this.flame.at, radius: this.flame.radius }].filter(Boolean); // prettier-ignore
    if (!srcs.length) return;
    const ys = srcs.map((s) => s.at[1]);
    const r = Math.max(...srcs.map((s) => s.radius ?? 0.05));
    const cx = srcs[0].at[0];
    const cz = srcs[0].at[2];
    const w = Math.max(0.5, 2 * r + 0.4);
    const bottom = Math.min(...ys) - 0.05;
    this.grid = new GasGrid(device, { at: [cx, bottom, cz], size: [w, 1.3, w], profile });
    const steam = this.gases.some((s) => s.look === "steam");
    this.steam = steam;
    const g = this.grid;
    const P = g.params;
    const c = g.cell;
    // Recipe units -> cells: lift and wind are accelerations.
    P.heatLift = 14 / c;
    P.smokeWeight = 0.4 / c;
    P.burn = 7;
    P.burnHeat = 1.2;
    P.vort = steam ? 2.5 : 4;
    P.noise = 1.5 / c;
    // Per 1/60 s: smoke, heat and fuel fade (smoke and steam thin as they
    // spread; heat cools; fuel burns away).
    P.decay = steam ? [0.975, 0.96, 0.9, 1] : [0.992, 0.955, 0.93, 1];
    this.look = {
      color: steam ? [0.93, 0.95, 0.97] : hex(this.gases[0]?.color || "#8f8f8f"),
      density: steam ? 9 : 26,
      flame: 20,
      steps: profile === "low" ? 24 : profile === "mid" ? 36 : 56,
      light: steam ? 1.15 : 0.9,
    };
  }

  handles(name) {
    return this.names.has(name);
  }

  command(cmds) {
    if (!cmds || !this.grid) return;
    for (const [name, c] of Object.entries(cmds)) {
      const st = this.state.get(name);
      if (!st || !c) continue;
      if (c.on !== undefined) st.on = !!c.on;
      if (c.flow !== undefined) st.flow = Math.max(0, c.flow);
      if (c.wind) st.wind = c.wind.slice();
    }
  }

  step(dt) {
    const g = this.grid;
    if (!g || !(dt > 0)) return 0;
    let a = null;
    let b = null;
    const wind = [0, 0, 0];
    if (this.flame) {
      const f = this.flame;
      const st = this.state.get(f.name);
      for (let k = 0; k < 3; k++) wind[k] += st.wind[k];
      if (st.on) {
        a = {
          at: [f.at[0], f.at[1] + (f.height ?? 0.3) * 0.08, f.at[2]],
          radius: (f.radius ?? 0.05) * 0.9,
          fuel: 26,
          heat: 3,
          up: 0.6,
        };
      }
    }
    for (const s of this.gases) {
      const st = this.state.get(s.name);
      for (let k = 0; k < 3; k++) wind[k] += st.wind[k];
      if (!st.on || !s.source) continue;
      const src = s.source;
      const flow = st.flow ?? 1;
      const steam = s.look === "steam";
      const one = {
        at: src.at,
        radius: Math.max(src.radius ?? 0.03, g.cell * 1.5) * (steam ? 0.9 : 2.2),
        smoke: (steam ? 3.2 : 44) * flow,
        heat: (steam ? 0.9 : 2.2) * flow,
        up: (src.speed ?? s.rise ?? 0.4) * (steam ? 0.6 : 1),
      };
      if (!a) a = one;
      else b = one;
    }
    g.sources.a = a;
    g.sources.b = b;
    g.params.wind = wind.map((w) => w * 3);
    return g.advance(dt);
  }

  // What the surface pass needs to draw it.
  view() {
    if (!this.grid) return null;
    return { grid: this.grid, ...this.look };
  }

  destroy() {
    this.grid?.destroy();
    this.grid = null;
  }
}

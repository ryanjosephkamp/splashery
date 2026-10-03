// Lane Fluids r4: the GPU side of a toy's fluids. On WebGPU, liquids are
// simulated with MLS-MPM (liquid.js) and drawn as a surface (surface.js)
// after PlayCanvas has drawn the frame, with the glass traced in the same
// pass. On WebGPU and WebGL2 alike, smoke, steam and flames run on a grid
// (gas.js, gasscene.js) and are ray-marched in that pass. Loaded only when
// a fluid toy opens.

import * as pc from "../../pc.js";
import { GpuLiquid } from "./liquid.js";
import { FluidSurface } from "./surface.js";
import { GasScene } from "./gasscene.js";

export { GpuLiquid };

// How each preset looks as a surface: body color, how much it scatters
// (0 clear .. 1 opaque), absorption per recipe unit (rgb) and glow.
const LOOKS = {
  // (water: its real absorption, about 0.45, 0.07 and 0.02 per meter in red,
  // green and blue, per 0.33 m unit, a little stronger so a deep glass tints)
  water: { color: [0.78, 0.9, 0.97], scatter: 0, absorb: [0.25, 0.05, 0.02], glow: 0 },
  soda: {
    color: [0.2, 0.08, 0.03],
    scatter: 0.05,
    absorb: [16, 26, 38],
    glow: 0,
    foam: [0.9, 0.83, 0.7],
  },
  syrup: { color: [0.55, 0.25, 0.06], scatter: 0.1, absorb: [2, 6, 14], glow: 0 },
  honey: { color: [0.86, 0.55, 0.1], scatter: 0.18, absorb: [0.8, 3.2, 12], glow: 0 },
  // (heat: seconds for its skin to crust over; surface.js draws the crust)
  lava: { color: [1.0, 0.36, 0.08], scatter: 1, absorb: [1, 1, 1], glow: 0.9, heat: 2.4 },
};

// A prop for the surface pass: 5 texels (type, radii, angle; a or center;
// b or half size; color and look; pivot), recipe units.
function packProp(s, angles) {
  const t = new Float32Array(20);
  const box = s.type === "box";
  const n = parseInt((s.color || "#808080").slice(1), 16);
  t.set([box ? 2 : s.type === "cone" ? 3 : 1, s.r ?? s.ra ?? 0, s.rb ?? 0, (s.part && angles[s.part]) || 0], 0); // prettier-ignore
  t.set(box ? s.at : s.a, 4);
  t.set(box ? s.half : s.b, 8);
  t.set([((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, s.look === "coffee" ? 4 : s.look === "wax" ? 3 : s.look === "wood" ? 2 : s.look === "steel" ? 1 : 0], 12); // prettier-ignore
  t.set(s.pivot || [0, 0, 0], 16);
  return { texels: t };
}

export class GpuFluids {
  // world: the FluidWorld (null when it runs in the worker); specs: the
  // recipe's fluid specs; glass: draw the glass (the GPU liquid path only).
  constructor(stage, world, { transform, profile = "high", specs = [], glass = true } = {}) {
    this.stage = stage;
    this.world = world;
    this.specs = specs;
    this.drawGlass = glass;
    // The props (the recipe's kind "props"), traced crisply on WebGPU; the
    // recipe hides their splats while `drawn` is set.
    this.props = stage.device.isWebGPU ? specs.find((s) => s.kind === "props") || null : null;
    // A flame's light on the props (props.light): eased on and off.
    this.light = { want: 1, now: 0, t: 0 };
    if (this.props) this.props.drawn = true;
    this.angles = {};
    this.gas = specs.some((s) => s.kind === "gas" || s.kind === "flame") ? new GasScene(stage.device, specs, { profile }) : null; // prettier-ignore
    this.transform = transform || { center: [0, 0, 0], scale: 1 };
    const scale =
      profile === "low" ? 0.35 : profile === "mid" ? 0.4 : profile === "max" ? 0.75 : 0.6;
    // Phones step themselves down if their frames still run long (watch()).
    this.phone = profile === "low" || profile === "mid";
    this.watchState = { last: 0, ema: 16, slow: 0, steps: 0 };
    this.surface = new FluidSurface(stage.device, { scale });
    this.onPost = () => this.render();
    stage.app.on("postrender", this.onPost);
    this.enabled = true;
  }

  liquid() {
    for (const s of this.world?.systems || []) if (s.gpu) return s;
    return null;
  }

  command(cmds) {
    this.gas?.command(cmds);
    const a = this.props && cmds?.[this.props.name];
    if (a) Object.assign(this.angles, a);
    if (a?.light !== undefined) this.light.want = a.light;
  }

  step(dt) {
    const L = this.light;
    if (dt > 0) {
      // (lit in a quarter second, out in a tenth, as a flame catches and dies)
      const k = 1 - Math.exp(-dt / (L.want > L.now ? 0.25 : 0.1));
      L.now += (L.want - L.now) * k;
      L.t += dt;
    }
    return this.gas?.step(dt) || 0;
  }

  toyToWorld() {
    const tf = this.transform;
    const s = tf.scale;
    const fit = new pc.Mat4().setTRS(
      new pc.Vec3(-tf.center[0] * s, -tf.center[1] * s, -tf.center[2] * s),
      pc.Quat.IDENTITY,
      new pc.Vec3(s, s, s),
    );
    const toy = this.stage.toy?.entity;
    return toy ? new pc.Mat4().mul2(toy.getWorldTransform(), fit) : fit;
  }

  // On a phone, frames that keep running long (over 24 ms for a second and
  // a half) step the fluid down: fewer substeps (it runs a little slower
  // instead of lagging) and a coarser surface, up to three times.
  watch() {
    const w = this.watchState;
    const now = performance.now();
    const dt = w.last ? now - w.last : 16;
    w.last = now;
    if (!this.phone || dt > 250 || w.steps >= 3) return;
    w.ema += (dt - w.ema) * 0.1;
    w.slow = w.ema > 24 ? w.slow + dt : 0;
    if (w.slow < 1500) return;
    w.slow = 0;
    w.ema = 16;
    w.steps++;
    const liq = this.liquid();
    if (liq) liq.maxSub = Math.max(6, Math.floor(liq.maxSub * 0.75));
    this.surface.scale = Math.max(0.28, this.surface.scale * 0.85);
    if (this.gas) this.gas.steps = Math.max(12, Math.floor(this.gas.steps * 0.8));
  }

  // A thin liquid's flat top in a glass (r6): the pool's level, smoothed
  // (the read-back is ten times a second), or null (thick liquids, a
  // splash, no pool yet).
  flatLevel(liq) {
    const lv = liq.acoustic?.level;
    if (liq.visc > 0.3 || liq.spec.flatTop === false || lv == null) return (this.lv = null);
    // (the measure is a high percentile of particle centers: add a particle)
    const want = lv + liq.d * 0.35;
    this.lv = this.lv == null ? want : this.lv + (want - this.lv) * 0.15;
    return this.lv;
  }

  render() {
    if (!this.enabled || !this.stage.toy) return;
    this.watch();
    const liq = this.liquid();
    const surf = this.surface;
    const p = surf.params;
    const glassSpec = this.drawGlass ? this.specs.find((s) => s.kind === "vessel")?.shape : null;
    if (glassSpec) {
      p.glassA = [...glassSpec.at, glassSpec.radius ?? 0.3];
      p.glassB = [glassSpec.height ?? 1, glassSpec.wall ?? 0.03, glassSpec.bottom ?? 0.05, 1];
    } else p.glassB = [0, 0, 0, 0];
    if (liq) {
      const look = LOOKS[liq.spec.preset] || LOOKS.water;
      p.color = [...look.color, look.scatter];
      p.absorb = [...look.absorb, look.glow];
      p.foam = look.foam || [0.95, 0.96, 0.97];
    }
    p.props = this.props ? this.props.shapes.map((s) => packProp(s, this.angles)) : null;
    const lt = this.props?.light;
    if (lt) {
      // a candle's light flickers a little (a few percent, slowly)
      const t = this.light.t;
      const f = 1 + 0.04 * Math.sin(t * 9.1) + 0.03 * Math.sin(t * 13.7 + 1.3);
      const n = parseInt(lt.color.slice(1), 16);
      p.propLight = [...lt.at, this.light.now * f];
      p.propLightC = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 0];
    } else p.propLight = [0, 0, 0, 0];
    const gas = this.gas?.view() || [];
    if (!liq && !gas.length && !glassSpec && !p.props) return;
    surf.render(
      liq
        ? { texture: liq.texture, texWidth: liq.sim.texWidth, count: liq.n, simToToy: liq.simToRecipe(), radius: liq.d * 0.8 * (liq.spec.sprite ?? 1), velRow: liq.sim.texHeight, stretch: liq.spec.stretch ?? 1, drops: liq.spec.drops, heat: (LOOKS[liq.spec.preset] || LOOKS.water).heat, level: this.flatLevel(liq), cell: liq.h, diffuse: liq.diffuse, gas } // prettier-ignore
        : { count: 0, gas },
      { camera: this.stage.cameraEntity.camera, toyToWorld: this.toyToWorld() },
    );
  }

  destroy() {
    if (this.props) this.props.drawn = false;
    this.stage.app.off("postrender", this.onPost);
    this.surface.destroy();
    this.gas?.destroy();
    for (const s of this.world?.systems || []) if (s.gpu) s.destroy();
  }
}

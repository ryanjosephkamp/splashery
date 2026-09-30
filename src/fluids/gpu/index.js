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
  water: { color: [0.78, 0.9, 0.97], scatter: 0, absorb: [0.9, 0.28, 0.16], glow: 0 },
  soda: {
    color: [0.2, 0.08, 0.03],
    scatter: 0.05,
    absorb: [16, 26, 38],
    glow: 0,
    foam: [0.9, 0.83, 0.7],
  },
  syrup: { color: [0.55, 0.25, 0.06], scatter: 0.1, absorb: [2, 6, 14], glow: 0 },
  honey: { color: [0.86, 0.55, 0.1], scatter: 0.18, absorb: [0.8, 3.2, 12], glow: 0 },
  lava: { color: [1.0, 0.36, 0.08], scatter: 1, absorb: [1, 1, 1], glow: 0.9 },
};

export class GpuFluids {
  // world: the FluidWorld (null when it runs in the worker); specs: the
  // recipe's fluid specs; glass: draw the glass (the GPU liquid path only).
  constructor(stage, world, { transform, profile = "high", specs = [], glass = true } = {}) {
    this.stage = stage;
    this.world = world;
    this.specs = specs;
    this.drawGlass = glass;
    this.gas = specs.some((s) => s.kind === "gas" || s.kind === "flame") ? new GasScene(stage.device, specs, { profile }) : null; // prettier-ignore
    this.transform = transform || { center: [0, 0, 0], scale: 1 };
    const scale = profile === "low" || profile === "mid" ? 0.5 : profile === "max" ? 0.75 : 0.6;
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
  }

  step(dt) {
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

  render() {
    if (!this.enabled || !this.stage.toy) return;
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
    const gas = this.gas?.view() || [];
    if (!liq && !gas.length && !glassSpec) return;
    surf.render(
      liq
        ? { texture: liq.texture, texWidth: liq.sim.texWidth, count: liq.n, simToToy: liq.simToRecipe(), radius: liq.d * 0.8, cell: liq.h, diffuse: liq.diffuse, gas } // prettier-ignore
        : { count: 0, gas },
      { camera: this.stage.cameraEntity.camera, toyToWorld: this.toyToWorld() },
    );
  }

  destroy() {
    this.stage.app.off("postrender", this.onPost);
    this.surface.destroy();
    this.gas?.destroy();
    for (const s of this.world?.systems || []) if (s.gpu) s.destroy();
  }
}

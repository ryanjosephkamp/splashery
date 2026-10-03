// The water's surface for Hands-on's water line (lane Hands engine A): a
// round pool of flat splats, its own splat entity (not the toy's, so it stays
// put while the toy floats), sorted with the toy's splats so whatever lies
// under the line shows faintly through the water. Loaded only when a toy
// with `hands.water` has Hands-on on.

import * as pc from "../pc.js";
import { SplatBuffer } from "../generators.js";

const SPACING = 0.022; // of the pool's radius

export class WaterView {
  // player: the Player (its stage and makeContainer).
  constructor(player) {
    this.player = player;
    this.stage = player.stage;
    this.entity = null;
    this.color = null;
  }

  // pose: { center: [x, y, z] (world), radius, color }
  show(pose) {
    const color = pose.color || "#3d8fb8";
    if (!this.entity || this.color !== color) this.make(color);
    const e = this.entity;
    if (!e) return;
    e.enabled = true;
    e.setLocalPosition(pose.center[0], pose.center[1], pose.center[2]);
    e.setLocalScale(pose.radius, pose.radius, pose.radius);
    this.stage.requestRender();
  }

  make(color) {
    this.dispose();
    const rgb = hex(color);
    const n = Math.ceil(1 / SPACING);
    const buf = new SplatBuffer(Math.ceil(3.7 * n * n));
    const s = SPACING * 0.75;
    const flat = [0, 0, 0, 1];
    // A hexagonal grid over the disc: deeper blue toward the middle, soft
    // ripples of light, and a rim that fades out.
    for (let j = -n; j <= n; j++) {
      const z = j * SPACING * 0.866;
      for (let i = -n; i <= n; i++) {
        const x = (i + (j & 1) * 0.5) * SPACING;
        const r = Math.hypot(x, z);
        if (r > 1) continue;
        const ripple =
          0.5 + 0.5 * Math.sin(r * 46 + Math.sin(x * 23) * 1.6 + Math.cos(z * 19) * 1.3);
        const light = 0.86 + 0.22 * ripple * (1 - 0.6 * r);
        const deep = 0.92 - 0.12 * (1 - r);
        const c = [rgb[0] * light * deep, rgb[1] * light * deep, rgb[2] * light * deep];
        const a = 0.82 * Math.min(1, (1 - r) / 0.18);
        buf.push([x, 0, z], [s, s * 0.04, s], flat, [Math.min(1, c[0]), Math.min(1, c[1]), Math.min(1, c[2]), a]); // prettier-ignore
      }
    }
    const container = this.player.makeContainer(buf);
    const e = new pc.Entity("splashery-water");
    // (Unified, as the toy is: sorted together, so the water and the toy's
    // splats blend in the right order.)
    e.addComponent("gsplat", { resource: container, unified: true });
    this.stage.app.root.addChild(e);
    this.entity = e;
    this.container = container;
    this.color = color;
  }

  hide() {
    if (this.entity?.enabled) {
      this.entity.enabled = false;
      this.stage.requestRender();
    }
  }

  dispose() {
    const { entity, container } = this;
    this.entity = null;
    this.container = null;
    if (!entity) return;
    entity.enabled = false;
    // Freed a few frames later, as the stage frees a toy (its splat
    // buffers still point at it until then).
    const free = () => {
      entity.destroy();
      container?.destroy?.();
    };
    if (this.stage.graveyard) this.stage.graveyard.push({ frames: 3, entity: { destroy: free } });
    else free();
  }
}

function hex(c) {
  const v = parseInt(c.replace("#", ""), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

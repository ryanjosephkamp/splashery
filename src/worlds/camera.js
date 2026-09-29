// The third-person camera: it orbits the character (drag to look), follows
// it smoothly, and never goes into the ground (it slides in closer when a
// hill is behind the character). A little sway while running, unless the
// browser asks for reduced motion. Pure JavaScript.

import { clamp } from "../kit.js";

export class FollowCamera {
  constructor(terrain, { reducedMotion = false } = {}) {
    this.terrain = terrain;
    this.reducedMotion = reducedMotion;
    this.yaw = 0; // radians; 0 looks along +z (the camera sits at -z)
    this.pitch = 0.32; // radians above the horizontal
    this.distance = 5.2;
    this.minPitch = -0.15;
    this.maxPitch = 1.2;
    this.target = null; // the smoothed point it looks at
    this.pos = null;
    this.clearance = 0.45;
    this.sway = 0;
    // blocked(p): true when a point is inside a prop (set by the world), so
    // the camera comes in front of a trunk, a rock or a crown of leaves.
    this.blocked = null;
  }

  // Turns the view by a drag (radians).
  look(dYaw, dPitch) {
    this.yaw += dYaw;
    this.pitch = clamp(this.pitch + dPitch, this.minPitch, this.maxPitch);
  }

  zoom(f) {
    this.distance = clamp(this.distance * f, 2.2, 14);
  }

  // Puts the camera behind a character facing `facing` (radians) at once.
  snap(focus, facing) {
    this.yaw = facing;
    this.target = focus.slice();
    this.pos = null;
    this.update(focus, 1, 0, 0);
  }

  // focus: the point to look at (the character's chest). run: 0..1.
  // Returns { pos, target }.
  update(focus, dt, run = 0, time = 0) {
    const k = 1 - Math.exp(-dt * 8);
    if (!this.target) this.target = focus.slice();
    for (let a = 0; a < 3; a++) this.target[a] += (focus[a] - this.target[a]) * k;
    const tg = this.target.slice();
    if (!this.reducedMotion && run > 0) {
      // A gentle sway with the stride.
      this.sway += dt * 9.5;
      tg[1] += Math.sin(this.sway * 2) * 0.035 * run;
      tg[0] += Math.cos(this.yaw) * Math.sin(this.sway) * 0.05 * run;
      tg[2] -= Math.sin(this.yaw) * Math.sin(this.sway) * 0.05 * run;
    }
    const cp = Math.cos(this.pitch);
    const dir = [-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp];
    // Walk out from the target; stop short where the ground rises into the
    // line of sight.
    let dist = this.distance;
    const steps = 16;
    for (let i = 1; i <= steps; i++) {
      const d = (i / steps) * this.distance;
      const p = [tg[0] + dir[0] * d, tg[1] + dir[1] * d, tg[2] + dir[2] * d];
      if (p[1] < this.terrain.heightAt(p[0], p[2]) + this.clearance || this.blocked?.(p)) {
        dist = Math.max(0.9, ((i - 1) / steps) * this.distance);
        break;
      }
    }
    const want = [tg[0] + dir[0] * dist, tg[1] + dir[1] * dist, tg[2] + dir[2] * dist];
    // Never under the ground, and never under the water's surface.
    const floor = Math.max(this.terrain.heightAt(want[0], want[2]), this.terrain.water) + this.clearance; // prettier-ignore
    if (want[1] < floor) want[1] = floor;
    if (!this.pos) this.pos = want.slice();
    else {
      const kp = 1 - Math.exp(-dt * 12);
      for (let a = 0; a < 3; a++) this.pos[a] += (want[a] - this.pos[a]) * kp;
      const f2 = Math.max(this.terrain.heightAt(this.pos[0], this.pos[2]), this.terrain.water) + this.clearance; // prettier-ignore
      if (this.pos[1] < f2) this.pos[1] = f2;
    }
    return { pos: this.pos, target: tg };
  }

  // The ground directions the stick moves along: forward is away from the
  // camera.
  axes() {
    return {
      forward: [Math.sin(this.yaw), Math.cos(this.yaw)],
      right: [-Math.cos(this.yaw), Math.sin(this.yaw)],
    };
  }
}

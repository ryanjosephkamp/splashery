// Collision with invisible simple shapes (nothing here is drawn): the
// ground's height field, and upright boxes, spheres and capsules around
// props. The character is an upright cylinder that walks on the ground: it
// climbs gentle slopes, stops at steep ones and at water deeper than its
// ankles, and slides along whatever it touches. Pure JavaScript.

import { BODY } from "./character.js";

export const LIMITS = {
  maxSlope: 0.9, // rise over run the character can walk up (about 42 degrees)
  wade: 0.22, // how deep into water it may step, in meters
  step: 0.35, // a sudden rise it can step up (a curb, a root)
};

export class Physics {
  constructor(terrain, { limits = {} } = {}) {
    this.terrain = terrain;
    this.limits = { ...LIMITS, ...limits };
    this.colliders = [];
    this.grid = new Map();
    this.cell = 8;
    this.lastHit = null;
  }

  // Adds a collider in world meters. c: { shape: "box" | "sphere" |
  // "capsule", x, z, y0, y1, radius (sphere, capsule), hx, hz, yaw (box, in
  // degrees), id }. A sphere's (x, y, z) center is its middle height.
  add(c) {
    const r = c.shape === "box" ? Math.hypot(c.hx, c.hz) : c.radius;
    const col = { ...c, reach: r, cos: Math.cos(((c.yaw || 0) * Math.PI) / 180), sin: Math.sin(((c.yaw || 0) * Math.PI) / 180) }; // prettier-ignore
    this.colliders.push(col);
    const C = this.cell;
    for (let j = Math.floor((c.z - r) / C); j <= Math.floor((c.z + r) / C); j++)
      for (let i = Math.floor((c.x - r) / C); i <= Math.floor((c.x + r) / C); i++) {
        const key = `${i},${j}`;
        if (!this.grid.has(key)) this.grid.set(key, []);
        this.grid.get(key).push(col);
      }
    return col;
  }

  near(x, z) {
    return this.grid.get(`${Math.floor(x / this.cell)},${Math.floor(z / this.cell)}`) || [];
  }

  ground(x, z) {
    return this.terrain.heightAt(x, z);
  }

  // Can the character stand here, coming from (fx, fz)? Water deeper than
  // `wade` and slopes steeper than `maxSlope` (uphill) say no.
  standable(x, z, fx, fz) {
    const t = this.terrain;
    const h = t.heightAt(x, z);
    if (h < t.water - this.limits.wade) return { ok: false, why: "water" };
    const t2 = t.t;
    if (Math.abs(x) > t2.size / 2 - 1 || Math.abs(z) > t2.size / 2 - 1) return { ok: false, why: "edge" }; // prettier-ignore
    const h0 = t.heightAt(fx, fz);
    const run = Math.hypot(x - fx, z - fz);
    if (run > 1e-4 && h > h0) {
      const rise = (h - h0) / run;
      // Steep ground: judged over the ground's own slope, so a tiny step
      // over a bump is not a wall, but a cliff is.
      if (rise > this.limits.maxSlope && t.slopeAt(x, z) > this.limits.maxSlope) return { ok: false, why: "slope" }; // prettier-ignore
    }
    return { ok: true, h };
  }

  // Pushes a point out of every collider it overlaps (as a circle of the
  // character's radius at its height). Returns the push, or null.
  pushOut(x, z, y) {
    const R = BODY.radius;
    let px = 0;
    let pz = 0;
    let hit = null;
    for (const c of this.near(x, z)) {
      if (y + BODY.height < c.y0 || y > c.y1) continue;
      const cx = x + px;
      const cz = z + pz;
      if (c.shape === "box") {
        // Into the box's own frame.
        const dx = cx - c.x;
        const dz = cz - c.z;
        const lx = dx * c.cos - dz * c.sin;
        const lz = dx * c.sin + dz * c.cos;
        const qx = Math.max(-c.hx, Math.min(c.hx, lx));
        const qz = Math.max(-c.hz, Math.min(c.hz, lz));
        let ox = lx - qx;
        let oz = lz - qz;
        let d = Math.hypot(ox, oz);
        if (d >= R) continue;
        if (d < 1e-6) {
          // Inside: out through the nearest side.
          const ex = c.hx - Math.abs(lx);
          const ez = c.hz - Math.abs(lz);
          if (ex < ez) {
            ox = Math.sign(lx) || 1;
            oz = 0;
            d = -ex;
          } else {
            ox = 0;
            oz = Math.sign(lz) || 1;
            d = -ez;
          }
        } else {
          ox /= d;
          oz /= d;
        }
        const k = R - d;
        // Back to world axes.
        px += (ox * c.cos + oz * c.sin) * k;
        pz += (-ox * c.sin + oz * c.cos) * k;
        hit = c;
      } else {
        let r = c.radius;
        if (c.shape === "sphere") {
          // The sphere's width at the character's height.
          const cy = (c.y0 + c.y1) / 2;
          const dy = Math.max(0, Math.max(y - cy, cy - (y + BODY.height)));
          r = dy >= c.radius ? 0 : Math.sqrt(c.radius * c.radius - dy * dy);
        }
        const dx = cx - c.x;
        const dz = cz - c.z;
        const d = Math.hypot(dx, dz);
        const need = r + R;
        if (d >= need) continue;
        const nx = d > 1e-6 ? dx / d : 1;
        const nz = d > 1e-6 ? dz / d : 0;
        px += nx * (need - d);
        pz += nz * (need - d);
        hit = c;
      }
    }
    return hit ? { px, pz, hit } : null;
  }

  // Moves the character from pos by (dx, dz), sliding along what it meets.
  // Returns { pos: [x, y, z], blocked: why | null, hit: collider | null }.
  move(pos, dx, dz) {
    const [x0, , z0] = pos;
    let blocked = null;
    let hit = null;
    // Long moves go in short steps, so nothing is jumped over.
    const len = Math.hypot(dx, dz);
    const n = Math.max(1, Math.ceil(len / 0.2));
    let x = x0;
    let z = z0;
    for (let s = 0; s < n; s++) {
      const sx = dx / n;
      const sz = dz / n;
      const tries = [
        [sx, sz],
        [sx, 0],
        [0, sz],
      ];
      let moved = false;
      for (const [tx, tz] of tries) {
        if (!tx && !tz) continue;
        let nx = x + tx;
        let nz = z + tz;
        const y = this.terrain.heightAt(nx, nz);
        const push = this.pushOut(nx, nz, y);
        if (push) {
          nx += push.px;
          nz += push.pz;
          hit = push.hit;
          // Pushed twice: corners between two colliders.
          const again = this.pushOut(nx, nz, this.terrain.heightAt(nx, nz));
          if (again) {
            nx += again.px;
            nz += again.pz;
          }
        }
        const st = this.standable(nx, nz, x, z);
        if (!st.ok) {
          blocked = st.why;
          continue;
        }
        if (Math.hypot(nx - x, nz - z) < 1e-5) continue;
        x = nx;
        z = nz;
        moved = true;
        break;
      }
      if (!moved) {
        blocked ||= hit ? "prop" : blocked;
        break;
      }
    }
    if (hit && !blocked) blocked = "prop";
    this.lastHit = hit;
    return { pos: [x, this.terrain.heightAt(x, z), z], blocked, hit };
  }
}

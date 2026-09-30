// Lane Fluids r4: spray, foam and bubbles for the GPU liquid (after Ihmsen et
// al. 2012, much simplified, as the CPU liquid's in sim.js).
//
// The liquid lives on the GPU; a few times a second its particles are read
// back (asynchronously, so the frame never waits) into a coarse picture of
// the liquid: how full each cell is, its mean velocity, and the top of the
// liquid in each column. The diffuse particles are few (thousands), so they
// move on the CPU through that picture every frame, and go to the GPU as a
// small texture that the surface pass draws (surface.js): foam and spray over
// the liquid, bubbles inside it, tinted by it.
//
// Everything here is in the liquid's grid units (one cell = h).

import * as pc from "../../pc.js";
import { measure } from "../acoustic.js";

export const DKIND = { spray: 1, foam: 2, bubble: 3 };
const TEX_W = 256;
// The CPU liquid's particle spacing (recipe units) the rates were tuned for.
const CPU_D = 0.045;

export class GpuDiffuse {
  constructor(liquid, { foam = 0, fizz = 0, cap = 2000 }) {
    this.liq = liquid;
    this.foam = foam;
    this.fizz = fizz;
    this.cap = Math.ceil(cap / TEX_W) * TEX_W;
    this.n = 0;
    this.pos = new Float32Array(this.cap * 3);
    this.vel = new Float32Array(this.cap * 3);
    this.kind = new Uint8Array(this.cap);
    this.age = new Float32Array(this.cap);
    this.life = new Float32Array(this.cap);
    this.seed = new Float32Array(this.cap);
    const [gx, gy, gz] = liquid.dims;
    this.dims = [gx, gy, gz];
    this.count = new Uint16Array(gx * gy * gz);
    this.cvel = new Float32Array(gx * gy * gz * 3);
    this.top = new Float32Array(gx * gz).fill(-1);
    this.ready = false;
    this.pending = false;
    this.sinceRead = 0;
    this.time = 0;
    this.rand = liquid.rand;
    this.texture = new pc.Texture(liquid.sim.device, {
      name: "flDiffuse",
      width: TEX_W,
      height: this.cap / TEX_W,
      format: pc.PIXELFORMAT_RGBA32F,
      mipmaps: false,
      minFilter: pc.FILTER_NEAREST,
      magFilter: pc.FILTER_NEAREST,
    });
    // The glass (if any), in grid units, to keep flecks inside it.
    const g = liquid.colliders.find((c) => c.type === "glass" || c.type === "cylinder");
    this.glass = g
      ? { at: liquid.toGrid(g.at || [0, 0, 0]), r: (g.radius ?? 0.3) / liquid.h, h: (g.height ?? 1) / liquid.h } // prettier-ignore
      : null;
  }

  cell(x, y, z) {
    const [gx, gy, gz] = this.dims;
    const i = Math.floor(x);
    const j = Math.floor(y);
    const k = Math.floor(z);
    if (i < 0 || j < 0 || k < 0 || i >= gx || j >= gy || k >= gz) return -1;
    return (k * gy + j) * gx + i;
  }

  // Reads the liquid back every ~1/10 s (one read in flight at a time).
  maybeRead(dt) {
    this.sinceRead += dt;
    if (this.pending || this.sinceRead < 0.1 || !this.liq.n) return;
    this.pending = true;
    const elapsed = this.sinceRead;
    this.sinceRead = 0;
    this.liq.sim
      .readPositions()
      .then((d) => {
        this.pending = false;
        if (!this.destroyed) this.absorb(d, elapsed);
      })
      .catch(() => (this.pending = false));
  }

  // A fresh picture of the liquid, and new spray, foam and bubbles.
  absorb(d, elapsed) {
    const n = d.length / 6;
    const { count, cvel, top } = this;
    const [gx, gy, gz] = this.dims;
    count.fill(0);
    cvel.fill(0);
    top.fill(-1);
    for (let i = 0; i < n; i++) {
      const c = this.cell(d[i * 6], d[i * 6 + 1], d[i * 6 + 2]);
      if (c < 0) continue;
      if (count[c] < 65535) count[c]++;
      cvel[c * 3] += d[i * 6 + 3];
      cvel[c * 3 + 1] += d[i * 6 + 4];
      cvel[c * 3 + 2] += d[i * 6 + 5];
    }
    // The pool: liquid slower than a falling stream (its top is where foam
    // floats; a stream above it is not a surface to float on).
    const slow = this.vRef() * 0.3;
    for (let c = 0; c < count.length; c++) {
      const k = count[c];
      if (!k) continue;
      cvel[c * 3] /= k;
      cvel[c * 3 + 1] /= k;
      cvel[c * 3 + 2] /= k;
      if (k >= 3 && Math.hypot(cvel[c * 3], cvel[c * 3 + 1], cvel[c * 3 + 2]) < slow) {
        const x = c % gx;
        const y = Math.floor(c / gx) % gy;
        const z = Math.floor(c / (gx * gy));
        const t = z * gx + x;
        top[t] = Math.max(top[t], y + Math.min(1, k / 8));
      }
    }
    this.ready = true;
    this.spawn(d, n, elapsed);
    // For the sound (acoustic.js), in recipe units.
    const liq = this.liq;
    const glass = this.glass;
    let spray = 0;
    let bubbles = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.kind[i] === DKIND.spray) spray++;
      else if (this.kind[i] === DKIND.bubble) bubbles++;
    }
    const a = measure(d, d.subarray(3), n, {
      d: liq.d,
      gravity: liq.gravity[1] * liq.h,
      stride: 6,
      scale: liq.h,
      offset: liq.origin,
      floorY: glass ? liq.origin[1] + (glass.at[1] + 1.2) * liq.h : liq.origin[1] + 2 * liq.h,
    });
    liq.acoustic = { ...a, spray, bubbles };
  }

  // The speed (cells/s) from which liquid hitting the pool traps air.
  vRef() {
    return Math.sqrt(Math.abs(this.liq.gravity[1]) * 0.5 * 40);
  }

  // Whether (x, y, z) is just above or in the slow pool: the column's top is
  // within two cells.
  nearPool(x, y, z) {
    const [GX, , GZ] = this.dims;
    const tx = Math.floor(x);
    const tz = Math.floor(z);
    if (tx < 0 || tz < 0 || tx >= GX || tz >= GZ) return false;
    const t = this.top[tz * GX + tx];
    return t >= 0 && Math.abs(y - t) < 2;
  }

  spawn(d, n, dt) {
    const rand = this.rand;
    const liq = this.liq;
    // Each GPU particle stands for a small part of a CPU one.
    const share = (liq.d / CPU_D) ** 3;
    const stride = Math.max(1, Math.floor(n / 20000));
    if (this.foam > 0) {
      const vRef = this.vRef();
      const rate = this.foam * dt * (14 + 40 * this.fizz) * share * stride;
      for (let i = 0; i < n; i += stride) {
        const vx = d[i * 6 + 3];
        const vy = d[i * 6 + 4];
        const vz = d[i * 6 + 5];
        const e = Math.hypot(vx, vy, vz) / vRef - 0.35;
        if (e <= 0 || rand() > e * rate) continue;
        const x = d[i * 6];
        const y = d[i * 6 + 1];
        const z = d[i * 6 + 2];
        const c = this.cell(x, y, z);
        // Only where fast liquid plunges into the pool (a falling stream
        // traps air where it lands, not along its length).
        if (c < 0 || !this.nearPool(x, y, z)) continue;
        const alone = this.count[c] < 3;
        const m = alone ? 1 : 1 + Math.round(9 * this.fizz);
        for (let k = 0; k < m; k++)
          this.add(
            alone ? DKIND.spray : DKIND.foam,
            x + (rand() - 0.5) * (1 + k) * 0.5,
            y + (rand() - 0.5) * 0.5,
            z + (rand() - 0.5) * (1 + k) * 0.5,
            vx * 0.8,
            vy * 0.8,
            vz * 0.8,
            alone ? 0.8 : (1.2 + 3.5 * this.fizz) * (0.6 + 0.8 * rand()),
          );
      }
    }
    if (this.fizz > 0 && n) {
      // Nucleation: streams of bubbles from points deep in the liquid, at
      // the CPU liquid's rate for the same volume.
      const want = this.fizz * dt * 0.35 * n * share;
      let k = Math.floor(want) + (rand() < want % 1 ? 1 : 0);
      for (let tries = 0; k > 0 && tries < 4 * k + 20; tries++) {
        const i = Math.floor(rand() * n);
        const x = d[i * 6];
        const y = d[i * 6 + 1];
        const z = d[i * 6 + 2];
        const above = this.cell(x, y + 2, z);
        if (above < 0 || this.count[above] < 4) continue;
        this.add(DKIND.bubble, x, y, z, 0, 0, 0, 6);
        k--;
      }
    }
  }

  add(kind, x, y, z, vx, vy, vz, life) {
    if (this.n >= this.cap) return;
    const i = this.n++;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.kind[i] = kind;
    this.age[i] = 0;
    this.life[i] = life;
    this.seed[i] = this.rand();
  }

  remove(i) {
    const j = --this.n;
    if (i === j) return;
    for (let k = 0; k < 3; k++) {
      this.pos[i * 3 + k] = this.pos[j * 3 + k];
      this.vel[i * 3 + k] = this.vel[j * 3 + k];
    }
    this.kind[i] = this.kind[j];
    this.age[i] = this.age[j];
    this.life[i] = this.life[j];
    this.seed[i] = this.seed[j];
  }

  step(dt) {
    this.maybeRead(dt);
    if (!(dt > 0) || !this.ready) return;
    this.time += dt;
    const liq = this.liq;
    const gy = liq.gravity[1];
    const [GX, , GZ] = this.dims;
    const rise = (liq.spec.bubbleRise ?? 0.15) / (liq.spec.unit ?? 0.33) / liq.h;
    const rand = this.rand;
    const { pos, vel, count, cvel, top } = this;
    for (let i = this.n - 1; i >= 0; i--) {
      const i3 = i * 3;
      const x = pos[i3];
      const y = pos[i3 + 1];
      const z = pos[i3 + 2];
      const c = this.cell(x, y, z);
      const k = c >= 0 ? count[c] : 0;
      let kind = this.kind[i];
      if (kind === DKIND.bubble && k < 3) {
        // At the top most bubbles pop; a few gather as foam.
        if (rand() > 0.15) {
          this.remove(i);
          continue;
        }
        kind = DKIND.foam;
        this.age[i] = 0;
        this.life[i] = 0.6 + rand() * 0.9;
      } else if (kind === DKIND.spray && k >= 5) kind = DKIND.foam;
      this.kind[i] = kind;
      let vx = vel[i3];
      let vy = vel[i3 + 1];
      let vz = vel[i3 + 2];
      const lx = k ? cvel[c * 3] : 0;
      const ly = k ? cvel[c * 3 + 1] : 0;
      const lz = k ? cvel[c * 3 + 2] : 0;
      if (kind === DKIND.spray) {
        vy += gy * dt;
      } else if (kind === DKIND.bubble) {
        const t = this.time * 9 + this.seed[i] * 40;
        vx = lx + Math.sin(t) * rise * 0.12;
        vy = ly + rise * (0.7 + 0.6 * this.seed[i]);
        vz = lz + Math.cos(t * 1.3) * rise * 0.12;
      } else {
        // Foam rides the top of the liquid in its column, carried along
        // and spreading a little.
        const tx = Math.min(GX - 1, Math.max(0, Math.floor(x)));
        const tz = Math.min(GZ - 1, Math.max(0, Math.floor(z)));
        const surf = top[tz * GX + tx];
        if (surf < 0) {
          vy += gy * dt;
        } else {
          const want = surf + 0.35 + this.seed[i] * 0.5;
          vx = lx + (rand() - 0.5) * 1.5;
          vz = lz + (rand() - 0.5) * 1.5;
          vy = (want - y) * 6;
        }
      }
      let nx = x + vx * dt;
      let ny = y + vy * dt;
      let nz = z + vz * dt;
      // Inside the glass stays inside it.
      const gl = this.glass;
      if (gl && ny < gl.at[1] + gl.h) {
        const rx = nx - gl.at[0];
        const rz = nz - gl.at[2];
        const r = Math.hypot(rx, rz);
        const r0 = Math.hypot(x - gl.at[0], z - gl.at[2]);
        const lim = gl.r - 0.3;
        if (r0 <= gl.r && r > lim) {
          nx = gl.at[0] + (rx / r) * lim;
          nz = gl.at[2] + (rz / r) * lim;
        }
        const floor = gl.at[1] + 1.2;
        if (r0 <= gl.r && ny < floor) {
          ny = floor;
          if (kind === DKIND.spray) this.kind[i] = DKIND.foam;
          vy = 0;
        }
      }
      if (ny < 1) {
        ny = 1;
        vy = 0;
        if (kind === DKIND.spray) this.kind[i] = DKIND.foam;
      }
      pos[i3] = nx;
      pos[i3 + 1] = ny;
      pos[i3 + 2] = nz;
      vel[i3] = vx;
      vel[i3 + 1] = vy;
      vel[i3 + 2] = vz;
      this.age[i] += dt;
      if (this.age[i] > this.life[i]) this.remove(i);
    }
    this.upload();
  }

  // xyz: grid place; w: kind + 0.999 * how faded (0 new .. 1 gone).
  upload() {
    const data = this.texture.lock();
    const n = this.n;
    for (let i = 0; i < n; i++) {
      data[i * 4] = this.pos[i * 3];
      data[i * 4 + 1] = this.pos[i * 3 + 1];
      data[i * 4 + 2] = this.pos[i * 3 + 2];
      data[i * 4 + 3] = this.kind[i] + 0.999 * Math.min(1, this.age[i] / this.life[i]);
    }
    this.texture.unlock();
  }

  destroy() {
    this.destroyed = true;
    this.texture.destroy();
  }
}

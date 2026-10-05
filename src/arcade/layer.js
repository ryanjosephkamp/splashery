// Lane Arcade: the splats a game draws. One extra splat layer per game
// (stage.addLayer, as the fluids use), with a fixed number of slots. A game
// adds sprites: a model (splats built once, with the toy kit or by hand) at
// a place, a turn, a size and a fade. Each frame the CPU writes every live
// splat's center (the sprite's turn and place applied to its model) and its
// sprite's turn and fade; the layer's small work-buffer program turns each
// splat by its sprite and fades it. The splats' own colors, sizes and turns
// are written once, when the sprite is added.
//
// A sprite can shatter: its splats are cut into pieces (cells around seed
// points, so each piece is a solid chunk with hard edges), and each piece
// then moves and turns on its own (stepPieces gives them gravity, a floor
// and a bounce). That is how a brick breaks into real pieces.

import * as pc from "../pc.js";
import { Kit } from "../kit.js";

const GLSL = /* glsl */ `
uniform vec4 uSpClock;   // y splat scale, z exposure
vec4 arDyn = vec4(0.0, 0.0, 0.0, 1.0);
vec4 arTint = vec4(0.0);
vec4 arQ(vec4 a, vec4 b) {
  return vec4(a.w * b.xyz + b.w * a.xyz + cross(a.xyz, b.xyz), a.w * b.w - dot(a.xyz, b.xyz));
}
void modifySplatCenter(inout vec3 center) {
  arDyn = loadArcDyn();
  arTint = loadArcTint();
}
void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {
  vec3 v = arDyn.xyz;
  vec4 q = vec4(v, sqrt(max(0.0, 1.0 - dot(v, v))));
  rotation = normalize(arQ(q, rotation));
  float f = clamp(arDyn.w, 0.0, 1.0);
  scale *= uSpClock.y * (f > 0.002 ? mix(0.6, 1.0, f) : 0.0);
}
void modifySplatColor(vec3 center, inout vec4 color) {
  float f = clamp(arDyn.w, 0.0, 1.0);
  color.rgb = mix(color.rgb, arTint.rgb, clamp(arTint.a, 0.0, 1.0)) * uSpClock.z;
  color.a *= f;
}
`;

const WGSL = /* wgsl */ `
uniform uSpClock: vec4f;
var<private> arDyn: vec4f = vec4f(0.0, 0.0, 0.0, 1.0);
var<private> arTint: vec4f = vec4f(0.0);
fn arQ(a: vec4f, b: vec4f) -> vec4f {
  return vec4f(a.w * b.xyz + b.w * a.xyz + cross(a.xyz, b.xyz), a.w * b.w - dot(a.xyz, b.xyz));
}
fn modifySplatCenter(center: ptr<function, vec3f>) {
  arDyn = loadArcDyn();
  arTint = loadArcTint();
}
fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {
  let v = arDyn.xyz;
  let q = vec4f(v, sqrt(max(0.0, 1.0 - dot(v, v))));
  *rotation = normalize(arQ(q, *rotation));
  let f = clamp(arDyn.w, 0.0, 1.0);
  var k = 0.0;
  if (f > 0.002) { k = mix(0.6, 1.0, f); }
  *scale = *scale * (uniform.uSpClock.y * k);
}
fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
  let f = clamp(arDyn.w, 0.0, 1.0);
  let c = *color;
  let rgb = mix(c.rgb, arTint.rgb, clamp(arTint.a, 0.0, 1.0)) * uniform.uSpClock.z;
  *color = vec4f(rgb, c.a * f);
}
`;

export const ARCADE_MODIFIER = { glsl: GLSL, wgsl: WGSL };

// ---- Small vector helpers ------------------------------------------------------------

export function qmul(a, b) {
  return [
    a[3] * b[0] + b[3] * a[0] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] + b[3] * a[1] + a[2] * b[0] - a[0] * b[2],
    a[3] * b[2] + b[3] * a[2] + a[0] * b[1] - a[1] * b[0],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}
export function qaxis(axis, angle) {
  const s = Math.sin(angle / 2);
  const l = Math.hypot(axis[0], axis[1], axis[2]) || 1;
  return [(axis[0] / l) * s, (axis[1] / l) * s, (axis[2] / l) * s, Math.cos(angle / 2)];
}
export function qrot(q, v) {
  const [x, y, z, w] = q;
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  return [
    v[0] + w * tx + (y * tz - z * ty),
    v[1] + w * ty + (z * tx - x * tz),
    v[2] + w * tz + (x * ty - y * tx),
  ];
}
export function qnorm(q) {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}
// The turn that takes unit vector a to unit vector b.
export function qfromto(a, b) {
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  if (d < -0.999999) {
    const ax = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const c = [
      a[1] * ax[2] - a[2] * ax[1],
      a[2] * ax[0] - a[0] * ax[2],
      a[0] * ax[1] - a[1] * ax[0],
    ];
    return qaxis(c, Math.PI);
  }
  const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  return qnorm([c[0], c[1], c[2], 1 + d]);
}
export function qslerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const s = d < 0 ? -1 : 1;
  d *= s;
  if (d > 0.9995) return qnorm(a.map((v, i) => v + (s * b[i] - v) * t));
  const th = Math.acos(d);
  const sa = Math.sin((1 - t) * th) / Math.sin(th);
  const sb = (s * Math.sin(t * th)) / Math.sin(th);
  return [0, 1, 2, 3].map((i) => a[i] * sa + b[i] * sb);
}

// ---- Models ------------------------------------------------------------------------

// A model: n splats in its own coordinates (around its origin), each with a
// color (r, g, b, a), three sizes and a turn (x, y, z, w).
export function makeModel(n) {
  return {
    n,
    pos: new Float32Array(n * 3),
    color: new Float32Array(n * 4),
    scale: new Float32Array(n * 3),
    rot: new Float32Array(n * 4),
  };
}

// A model built with the toy kit (src/kit.js), in the kit's own units (no
// fit): build(k) adds shapes as a recipe's build does. `count` is the
// splat budget the kit shares between the shapes.
export function kitModel(build, { count = 600, seed = 7 } = {}) {
  const k = new Kit(seed, { count, fit: false });
  // Smooth, clean colors (the kit's usual color noise reads as grain on a
  // game's solid pieces: PACKS.md 7c).
  const add = k.add.bind(k);
  k.add = (shape, o = {}) => add(shape, { jitter: 0.01, ...o });
  build(k);
  const it = k.emit();
  let r = it.next();
  while (!r.done) r = it.next();
  const b = k.buf;
  let n = 0;
  for (let i = 0; i < b.count; i++) if (b.color[i * 4 + 3] > 0.004) n++;
  const m = makeModel(n);
  let j = 0;
  for (let i = 0; i < b.count; i++) {
    if (b.color[i * 4 + 3] <= 0.004) continue;
    m.pos.set(b.pos.subarray(i * 3, i * 3 + 3), j * 3);
    m.scale.set(b.scale.subarray(i * 3, i * 3 + 3), j * 3);
    m.rot.set(b.rot.subarray(i * 4, i * 4 + 4), j * 4);
    m.color.set(b.color.subarray(i * 4, i * 4 + 4), j * 4);
    j++;
  }
  return m;
}

// The same model with its colors run through fn([r, g, b, a], i, pos) ->
// [r, g, b, a] (a brick's color from one shared shape).
export function recolor(model, fn) {
  const m = { ...model, color: new Float32Array(model.color) };
  for (let i = 0; i < m.n; i++) {
    const c = fn(Array.from(m.color.subarray(i * 4, i * 4 + 4)), i, m.pos.subarray(i * 3, i * 3 + 3)); // prettier-ignore
    m.color.set(c, i * 4);
  }
  return m;
}

// ---- The layer -------------------------------------------------------------------------

export class ArcadeLayer {
  constructor(stage, slots, { reach = 3 } = {}) {
    const device = stage.device;
    this.stage = stage;
    this.slots = slots;
    const format = pc.GSplatFormat.createDefaultFormat(device);
    format.addExtraStreams([
      { name: "arcDyn", format: pc.PIXELFORMAT_RGBA32F, storage: pc.GSPLAT_STREAM_RESOURCE },
      { name: "arcTint", format: pc.PIXELFORMAT_RGBA32F, storage: pc.GSPLAT_STREAM_RESOURCE },
    ]);
    const container = new pc.GSplatContainer(device, slots, format);
    this.container = container;
    this.center = container.getTexture("dataCenter").lock().slice().fill(0);
    container.getTexture("dataCenter").unlock();
    this.dyn = new Float32Array(this.center.length);
    this.tint = new Float32Array(this.center.length);
    const half = pc.FloatPacking.float2Half;
    const zero = half(0);
    const one = half(1);
    for (const [name, v] of [
      ["dataColor", [zero, zero, zero, zero]],
      ["dataScale", [zero, zero, zero, zero]],
      ["dataRotation", [one, zero, zero, zero]],
    ]) {
      const tex = container.getTexture(name);
      const d = tex.lock();
      for (let i = 0; i < d.length; i += 4) d.set(v, i);
      tex.unlock();
    }
    for (const name of ["dataCenter", "arcDyn", "arcTint"]) {
      const tex = container.getTexture(name);
      tex.lock().fill(0);
      tex.unlock();
    }
    const aabb = new pc.BoundingBox();
    aabb.setMinMax(new pc.Vec3(-reach, -reach, -reach), new pc.Vec3(reach, reach, reach));
    container.aabb = aabb;
    container.update(slots, true);
    this.layer = stage.addLayer(container, ARCADE_MODIFIER);
    this.staticDirty = null; // [lo, hi) of slots whose look changed
    this.tintDirty = false;
  }

  // Writes a model's look (colors, sizes, turns) into slots [start, start + n).
  writeLook(start, model, lo = 0, hi = model.n) {
    const half = pc.FloatPacking.float2Half;
    const c = this.container;
    const col = c.getTexture("dataColor").lock();
    const sc = c.getTexture("dataScale").lock();
    const rt = c.getTexture("dataRotation").lock();
    for (let j = lo; j < hi; j++) {
      const i4 = (start + j) * 4;
      const j3 = j * 3;
      const j4 = j * 4;
      col[i4] = half(model.color[j4]);
      col[i4 + 1] = half(model.color[j4 + 1]);
      col[i4 + 2] = half(model.color[j4 + 2]);
      col[i4 + 3] = half(model.color[j4 + 3]);
      sc[i4] = half(model.scale[j3]);
      sc[i4 + 1] = half(model.scale[j3 + 1]);
      sc[i4 + 2] = half(model.scale[j3 + 2]);
      sc[i4 + 3] = 0;
      rt[i4] = half(model.rot[j4 + 3]);
      rt[i4 + 1] = half(model.rot[j4]);
      rt[i4 + 2] = half(model.rot[j4 + 1]);
      rt[i4 + 3] = half(model.rot[j4 + 2]);
    }
    c.getTexture("dataColor").unlock();
    c.getTexture("dataScale").unlock();
    c.getTexture("dataRotation").unlock();
  }

  // Uploads this frame's centers, turns and fades, and sorts when asked.
  upload(sort) {
    const c = this.container;
    for (const [name, src] of [
      ["dataCenter", this.center],
      ["arcDyn", this.dyn],
    ]) {
      const tex = c.getTexture(name);
      tex.lock().set(src);
      tex.unlock();
    }
    if (this.tintDirty) {
      const tex = c.getTexture("arcTint");
      tex.lock().set(this.tint);
      tex.unlock();
      this.tintDirty = false;
    }
    if (sort || this.sortSoon) {
      this.sortSoon = false;
      const cs = c.centers;
      const ce = this.center;
      for (let i = 0, n = this.slots; i < n; i++) {
        cs[i * 3] = ce[i * 4];
        cs[i * 3 + 1] = ce[i * 4 + 1];
        cs[i * 3 + 2] = ce[i * 4 + 2];
      }
      c.update(this.slots, true);
    }
    this.stage.requestRender();
  }

  destroy() {
    this.stage.removeLayer(this.layer);
    this.layer = null;
  }
}

// ---- Sprites -------------------------------------------------------------------------

// A sprite is a model shown at pos, turned by quat, sized by scale (a number
// or [sx, sy, sz] in the model's own axes) and faded by fade (0 hides it).
// tint: [r, g, b, amount] mixes its colors toward a color (a hit's flash).
export class Sprites {
  constructor(layer) {
    this.layer = layer;
    this.list = [];
    this.used = 0;
    this.free = []; // [{ start, n }] slots given back, reused by size
  }

  get capacity() {
    return this.layer.slots;
  }

  // Splats still free (for budgets).
  left() {
    return this.capacity - this.used + this.free.reduce((a, f) => a + f.n, 0);
  }

  alloc(n) {
    const i = this.free.findIndex((f) => f.n >= n);
    if (i >= 0) {
      const f = this.free[i];
      const start = f.start;
      if (f.n === n) this.free.splice(i, 1);
      else {
        f.start += n;
        f.n -= n;
      }
      return start;
    }
    if (this.used + n > this.capacity) return -1;
    const start = this.used;
    this.used += n;
    return start;
  }

  // Adds a sprite; returns null when the layer is full.
  add(model, { pos = [0, 0, 0], quat = [0, 0, 0, 1], scale = 1, fade = 1, tint = null } = {}) {
    const n = model.n;
    const start = this.alloc(n);
    if (start < 0) return null;
    this.layer.writeLook(start, model);
    this.layer.sortSoon = true; // new splats: sort them where they are
    const s = { model, start, n, pos: pos.slice(), quat: quat.slice(), scale, fade, tint, pieces: null, alive: true }; // prettier-ignore
    this.list.push(s);
    if (tint) this.layer.tintDirty = true;
    return s;
  }

  // Gives a sprite's slots back (hidden from the next upload on).
  remove(s) {
    if (!s || !s.alive) return;
    s.alive = false;
    const i = this.list.indexOf(s);
    if (i >= 0) this.list.splice(i, 1);
    const d = this.layer.dyn;
    for (let j = s.start; j < s.start + s.n; j++) d[j * 4 + 3] = 0;
    this.free.push({ start: s.start, n: s.n });
  }

  clear() {
    for (const s of this.list.slice()) this.remove(s);
    this.free = [];
    this.used = 0;
    this.layer.dyn.fill(0);
  }

  setTint(s, tint) {
    s.tint = tint;
    const t = this.layer.tint;
    const v = tint || [0, 0, 0, 0];
    for (let j = s.start; j < s.start + s.n; j++) t.set(v, j * 4);
    this.layer.tintDirty = true;
  }

  // Cuts a sprite into about `count` solid pieces around random seed
  // points (each splat goes to its nearest seed). Each piece starts where
  // it sits now, moving with `vel` plus a kick away from `from` (a world
  // point, say where the ball hit) and a random spin.
  shatter(
    s,
    count,
    { rand = Math.random, vel = [0, 0, 0], from = null, kick = 1, spin = 6, life = 2.5 } = {},
  ) {
    const m = s.model;
    const seeds = [];
    for (let k = 0; k < count; k++) {
      const i = (rand() * m.n) | 0;
      seeds.push(m.pos.slice(i * 3, i * 3 + 3));
    }
    const owner = new Uint16Array(m.n);
    const sum = seeds.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < m.n; i++) {
      const p = m.pos.subarray(i * 3, i * 3 + 3);
      let best = 0;
      let bd = Infinity;
      for (let k = 0; k < seeds.length; k++) {
        const d = (p[0] - seeds[k][0]) ** 2 + (p[1] - seeds[k][1]) ** 2 + (p[2] - seeds[k][2]) ** 2;
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
      owner[i] = best;
      sum[best][0] += p[0];
      sum[best][1] += p[1];
      sum[best][2] += p[2];
      sum[best][3]++;
    }
    const sc = Array.isArray(s.scale) ? s.scale : [s.scale, s.scale, s.scale];
    s.pieces = sum.map((a) => {
      const c0 = a[3] ? [a[0] / a[3], a[1] / a[3], a[2] / a[3]] : [0, 0, 0];
      const w = qrot(s.quat, [c0[0] * sc[0], c0[1] * sc[1], c0[2] * sc[2]]);
      const pos = [s.pos[0] + w[0], s.pos[1] + w[1], s.pos[2] + w[2]];
      let d = from ? [pos[0] - from[0], pos[1] - from[1], pos[2] - from[2]] : [rand() - 0.5, rand() - 0.5, rand() - 0.5]; // prettier-ignore
      const l = Math.hypot(...d) || 1;
      d = d.map((v) => (v / l) * kick * (0.6 + 0.8 * rand()));
      return {
        c0,
        pos,
        vel: [vel[0] + d[0], vel[1] + d[1], vel[2] + d[2]],
        quat: s.quat.slice(),
        spin: [(rand() - 0.5) * spin, (rand() - 0.5) * spin, (rand() - 0.5) * spin],
        life: life * (0.75 + 0.5 * rand()),
        age: 0,
        rest: false,
        n: a[3],
      };
    });
    s.owner = owner;
    return s.pieces;
  }

  // Writes every sprite's splats for this frame.
  write() {
    const ce = this.layer.center;
    const dy = this.layer.dyn;
    for (const s of this.list) {
      const m = s.model;
      const sc = Array.isArray(s.scale) ? s.scale : [s.scale, s.scale, s.scale];
      if (s.pieces) {
        const P = s.pieces;
        for (let i = 0; i < m.n; i++) {
          const pc_ = P[s.owner[i]];
          const j = (s.start + i) * 4;
          const lp = [
            (m.pos[i * 3] - pc_.c0[0]) * sc[0],
            (m.pos[i * 3 + 1] - pc_.c0[1]) * sc[1],
            (m.pos[i * 3 + 2] - pc_.c0[2]) * sc[2],
          ];
          const w = qrot(pc_.quat, lp);
          ce[j] = pc_.pos[0] + w[0];
          ce[j + 1] = pc_.pos[1] + w[1];
          ce[j + 2] = pc_.pos[2] + w[2];
          const q = pc_.quat[3] < 0 ? pc_.quat.map((v) => -v) : pc_.quat;
          dy[j] = q[0];
          dy[j + 1] = q[1];
          dy[j + 2] = q[2];
          dy[j + 3] = s.fade * (pc_.fade ?? 1);
        }
        continue;
      }
      const q = s.quat[3] < 0 ? s.quat.map((v) => -v) : s.quat;
      const [x, y, z, w] = q;
      // The rotation matrix, once per sprite.
      const r00 = 1 - 2 * (y * y + z * z), r01 = 2 * (x * y - z * w), r02 = 2 * (x * z + y * w); // prettier-ignore
      const r10 = 2 * (x * y + z * w), r11 = 1 - 2 * (x * x + z * z), r12 = 2 * (y * z - x * w); // prettier-ignore
      const r20 = 2 * (x * z - y * w), r21 = 2 * (y * z + x * w), r22 = 1 - 2 * (x * x + y * y); // prettier-ignore
      const [px, py, pz] = s.pos;
      const f = s.fade;
      for (let i = 0; i < m.n; i++) {
        const j = (s.start + i) * 4;
        const lx = m.pos[i * 3] * sc[0];
        const ly = m.pos[i * 3 + 1] * sc[1];
        const lz = m.pos[i * 3 + 2] * sc[2];
        ce[j] = px + r00 * lx + r01 * ly + r02 * lz;
        ce[j + 1] = py + r10 * lx + r11 * ly + r12 * lz;
        ce[j + 2] = pz + r20 * lx + r21 * ly + r22 * lz;
        dy[j] = x;
        dy[j + 1] = y;
        dy[j + 2] = z;
        dy[j + 3] = f;
      }
    }
  }
}

// Moves a shattered sprite's pieces for dt seconds: gravity (world units per
// second squared, down -Y, or a function of the piece's place giving the
// pull as a vector), a floor (y) or a sphere (`sphere: { at, r }`, pieces
// stay inside it) they bounce on and come to rest, and a fade at the end of
// their life. Returns true while any piece is still moving or showing.
export function stepPieces(
  s,
  dt,
  {
    gravity = 4,
    floor = -Infinity,
    sides = null,
    sphere = null,
    bounce = 0.35,
    friction = 0.6,
    fadeOut = 0.5,
  } = {},
) {
  let busy = false;
  for (const p of s.pieces || []) {
    p.age += dt;
    const left = p.life - p.age;
    p.fade = left < fadeOut ? Math.max(0, left / fadeOut) : 1;
    if (left > 0) busy = true;
    if (p.rest) continue;
    const g = typeof gravity === "function" ? gravity(p.pos) : [0, -gravity, 0];
    for (let k = 0; k < 3; k++) {
      p.vel[k] += g[k] * dt;
      p.pos[k] += p.vel[k] * dt;
    }
    const sl = Math.hypot(...p.spin);
    if (sl > 1e-4) p.quat = qnorm(qmul(qaxis(p.spin, sl * dt), p.quat));
    if (p.pos[1] < floor) {
      p.pos[1] = floor;
      if (p.vel[1] < 0) p.vel[1] = -p.vel[1] * bounce;
      p.vel[0] *= friction;
      p.vel[2] *= friction;
      p.spin = p.spin.map((v) => v * friction);
      if (Math.abs(p.vel[1]) < 0.15 && Math.hypot(p.vel[0], p.vel[2]) < 0.05) p.rest = true;
    }
    // sides: [left, right] walls in x the pieces bounce off.
    if (sides && (p.pos[0] < sides[0] || p.pos[0] > sides[1])) {
      p.pos[0] = Math.min(sides[1], Math.max(sides[0], p.pos[0]));
      p.vel[0] = -p.vel[0] * bounce;
    }
    if (sphere) {
      const d = [p.pos[0] - sphere.at[0], p.pos[1] - sphere.at[1], p.pos[2] - sphere.at[2]];
      const l = Math.hypot(...d);
      if (l > sphere.r) {
        const nrm = d.map((v) => v / l);
        for (let k = 0; k < 3; k++) p.pos[k] = sphere.at[k] + nrm[k] * sphere.r;
        const vn = p.vel[0] * nrm[0] + p.vel[1] * nrm[1] + p.vel[2] * nrm[2];
        if (vn > 0) for (let k = 0; k < 3; k++) p.vel[k] = (p.vel[k] - (1 + bounce) * vn * nrm[k]) * friction; // prettier-ignore
        p.spin = p.spin.map((v) => v * friction);
      }
    }
  }
  return busy;
}

// ---- Points ----------------------------------------------------------------------------

// A block of single splats the game places one by one (a grain of sand
// each): set(i, x, y, z) puts one, hide(i) hides it, color(i, r, g, b)
// changes its color (written on flush, once a frame). Make them after
// sprites.clear() (a reset gives every slot back).
export class Points {
  constructor(sprites, n, { size = 0.01, flat = 1 } = {}) {
    this.layer = sprites.layer;
    this.start = sprites.alloc(n);
    if (this.start < 0) throw new Error("The game's splat layer is full.");
    this.n = n;
    const m = makeModel(n);
    for (let i = 0; i < n; i++) {
      m.scale.set([size, size, size * flat], i * 3);
      m.rot.set([0, 0, 0, 1], i * 4);
    }
    this.model = m;
    this.layer.writeLook(this.start, m);
    this.lo = Infinity;
    this.hi = -1;
    const d = this.layer.dyn;
    for (let i = this.start; i < this.start + n; i++) d.fill(0, i * 4, i * 4 + 4);
  }

  set(i, x, y, z, fade = 1) {
    const j = (this.start + i) * 4;
    const c = this.layer.center;
    c[j] = x;
    c[j + 1] = y;
    c[j + 2] = z;
    this.layer.dyn[j + 3] = fade;
  }

  hide(i) {
    this.layer.dyn[(this.start + i) * 4 + 3] = 0;
  }

  color(i, r, g, b, a = 1) {
    const c = this.model.color;
    c[i * 4] = r;
    c[i * 4 + 1] = g;
    c[i * 4 + 2] = b;
    c[i * 4 + 3] = a;
    if (i < this.lo) this.lo = i;
    if (i + 1 > this.hi) this.hi = i + 1;
  }

  // A splat's own size (and flatness) for a grain that changes kind.
  size(i, s, flat = 1) {
    this.model.scale.set([s, s, s * flat], i * 3);
    if (i < this.lo) this.lo = i;
    if (i + 1 > this.hi) this.hi = i + 1;
  }

  flush() {
    if (this.hi <= this.lo) return;
    this.layer.writeLook(this.start, this.model, this.lo, this.hi);
    this.lo = Infinity;
    this.hi = -1;
  }
}

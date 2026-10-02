// A small physics engine of our own (lane Physics): extended position-based
// dynamics (XPBD, after Müller et al. 2020, "Detailed Rigid Body Simulation
// with Extended Position Based Dynamics"), with no library. Pure JavaScript,
// no DOM: it runs on the CPU for a few dozen pieces; the GPU still moves
// every splat (src/physics/hands-on.js turns the poses into uniforms).
//
// - Bodies are rigid pieces: a position, a rotation, a mass and a diagonal
//   inertia. Each has collision `points` (local, with a small radius) and
//   an optional `solid` (a sphere, an ellipsoid, a box or a cylinder, local)
//   that other bodies' points collide with.
// - Planes are the floor and the walls of the play area.
// - Joints pin a body's point to a point in the world or on another body,
//   at a distance (0: a ball joint), stiff or springy (compliance).
// - Particles and links make soft things: points with a mass, held by
//   distance links that are stiff or loose (compliance), with the planes.
// - Friction (static and dynamic), restitution, gravity, damping and a
//   whole-world sleep once everything has been still for a moment.
//
// Units are the caller's (Splashery uses the toy's own size); gravity and
// speeds scale with them.

// ---- Small vector and quaternion helpers -----------------------------------

export const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => {
    const l = Math.hypot(a[0], a[1], a[2]);
    return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 1, 0];
  },
};

export const quat = {
  mul: (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ],
  conj: (q) => [-q[0], -q[1], -q[2], q[3]],
  norm: (q) => {
    const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
    return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
  },
  // v + 2 u x (u x v + w v)
  rotate: (q, v) => {
    const [x, y, z, w] = q;
    const cx = y * v[2] - z * v[1] + w * v[0];
    const cy = z * v[0] - x * v[2] + w * v[1];
    const cz = x * v[1] - y * v[0] + w * v[2];
    return [
      v[0] + 2 * (y * cz - z * cy),
      v[1] + 2 * (z * cx - x * cz),
      v[2] + 2 * (x * cy - y * cx),
    ];
  },
  axisAngle: (axis, angle) => {
    const a = v3.norm(axis);
    const s = Math.sin(angle / 2);
    return [a[0] * s, a[1] * s, a[2] * s, Math.cos(angle / 2)];
  },
  slerp: (a, b, t) => {
    let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    let bb = b;
    if (d < 0) {
      d = -d;
      bb = [-b[0], -b[1], -b[2], -b[3]];
    }
    if (d > 0.9995) return quat.norm(a.map((v, i) => v + (bb[i] - v) * t));
    const th = Math.acos(Math.min(1, d));
    const s = Math.sin(th);
    const ka = Math.sin((1 - t) * th) / s;
    const kb = Math.sin(t * th) / s;
    return a.map((v, i) => v * ka + bb[i] * kb);
  },
};

const ID = [0, 0, 0, 1];

// ---- Bodies -----------------------------------------------------------------

let nextId = 1;

export class Body {
  // opts: { pos, quat, mass (0: fixed), inertia ([3] diagonal, else from
  // the solid), points ([[x, y, z]] local), radius (of the points), solid
  // ({ type: "sphere", r } | { type: "ellipsoid", r: [3] } | { type: "box",
  // half: [3] } | { type: "cylinder", r, h } (h: half height, along local
  // y)), friction, restitution, damping, data }
  constructor(o = {}) {
    this.id = nextId++;
    this.pos = (o.pos || [0, 0, 0]).slice();
    this.q = quat.norm(o.quat || ID);
    this.vel = [0, 0, 0];
    this.omega = [0, 0, 0];
    this.prevPos = this.pos.slice();
    this.prevQ = this.q.slice();
    const m = o.mass ?? 1;
    this.invMass = m > 0 ? 1 / m : 0;
    this.solid = o.solid || null;
    const I = o.inertia || inertiaOf(this.solid, m);
    this.invI = I.map((v) => (m > 0 && v > 0 ? 1 / v : 0));
    this.points = (o.points || []).map((p) => p.slice());
    this.radius = o.radius ?? 0;
    this.friction = o.friction ?? 0.6;
    this.restitution = o.restitution ?? 0.3;
    this.damping = o.damping ?? 0.05; // linear, per second
    this.angDamping = o.angDamping ?? 0.4; // per second
    this.home = { pos: this.pos.slice(), q: this.q.slice() };
    this.data = o.data ?? null;
    this.bound = boundOf(this); // a radius around pos that holds everything
    this.held = false;
  }

  get fixed() {
    return this.invMass === 0;
  }

  // A local point in the world.
  toWorld(p) {
    return v3.add(this.pos, quat.rotate(this.q, p));
  }

  toLocal(p) {
    return quat.rotate(quat.conj(this.q), v3.sub(p, this.pos));
  }

  // The inverse inertia, in the world, applied to v.
  invIWorld(v) {
    const l = quat.rotate(quat.conj(this.q), v);
    return quat.rotate(this.q, [l[0] * this.invI[0], l[1] * this.invI[1], l[2] * this.invI[2]]);
  }

  // How hard it is to move this body's point at r (world offset) along n.
  weight(r, n) {
    if (this.invMass === 0) return 0;
    const rn = v3.cross(r, n);
    return this.invMass + v3.dot(rn, this.invIWorld(rn));
  }

  // Moves the body by a positional impulse p applied at r (world offset).
  applyPos(p, r, sign) {
    if (this.invMass === 0) return;
    this.pos[0] += sign * p[0] * this.invMass;
    this.pos[1] += sign * p[1] * this.invMass;
    this.pos[2] += sign * p[2] * this.invMass;
    const w = this.invIWorld(v3.cross(r, p));
    this.q = quat.norm(addRot(this.q, w, 0.5 * sign));
  }

  applyVel(p, r, sign) {
    if (this.invMass === 0) return;
    this.vel[0] += sign * p[0] * this.invMass;
    this.vel[1] += sign * p[1] * this.invMass;
    this.vel[2] += sign * p[2] * this.invMass;
    const w = this.invIWorld(v3.cross(r, p));
    this.omega[0] += sign * w[0];
    this.omega[1] += sign * w[1];
    this.omega[2] += sign * w[2];
  }

  // The velocity of a point at r (world offset).
  velAt(r) {
    return v3.add(this.vel, v3.cross(this.omega, r));
  }

  // Sends it home now (a reset).
  goHome() {
    this.pos = this.home.pos.slice();
    this.q = this.home.q.slice();
    this.prevPos = this.pos.slice();
    this.prevQ = this.q.slice();
    this.vel = [0, 0, 0];
    this.omega = [0, 0, 0];
  }

  // How far it is from home (position, and a rough angle).
  awayFromHome() {
    const d = v3.len(v3.sub(this.pos, this.home.pos));
    const dq = Math.abs(dotQ(this.q, this.home.q));
    return { d, angle: 2 * Math.acos(Math.min(1, dq)) };
  }
}

// q + s * [w, 0] * q
function addRot(q, w, s) {
  const dq = quat.mul([w[0], w[1], w[2], 0], q);
  return [q[0] + s * dq[0], q[1] + s * dq[1], q[2] + s * dq[2], q[3] + s * dq[3]];
}

const dotQ = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];

function inertiaOf(solid, m) {
  if (!solid) return [m * 0.4, m * 0.4, m * 0.4];
  if (solid.type === "sphere") return Array(3).fill(0.4 * m * solid.r * solid.r);
  if (solid.type === "ellipsoid") {
    const [a, b, c] = solid.r;
    return [(m * (b * b + c * c)) / 5, (m * (a * a + c * c)) / 5, (m * (a * a + b * b)) / 5];
  }
  if (solid.type === "box") {
    const [a, b, c] = solid.half;
    return [(m * (b * b + c * c)) / 3, (m * (a * a + c * c)) / 3, (m * (a * a + b * b)) / 3];
  }
  if (solid.type === "cylinder") {
    const r = solid.r;
    const h = solid.h * 2;
    const side = (m * (3 * r * r + h * h)) / 12;
    return [side, 0.5 * m * r * r, side];
  }
  return [m * 0.4, m * 0.4, m * 0.4];
}

export function boundOf(b) {
  let r = 0;
  for (const p of b.points) r = Math.max(r, v3.len(p) + b.radius);
  const s = b.solid;
  if (s?.type === "sphere") r = Math.max(r, s.r);
  else if (s?.type === "ellipsoid") r = Math.max(r, ...s.r);
  else if (s?.type === "box") r = Math.max(r, v3.len(s.half));
  else if (s?.type === "cylinder") r = Math.max(r, Math.hypot(s.r, s.h));
  return r;
}

// Points spread over a solid's surface, for collisions against other
// bodies and the floor (a box's corners, edges and faces; rings round an
// ellipsoid or a cylinder).
export function surfacePoints(solid, n = 2) {
  const out = [];
  if (solid.type === "box") {
    // A grid on each face, set in a little from the edges: a point exactly
    // on an edge would sit on the next box's side when they are stacked
    // square, and push it sideways.
    const inset = 0.9;
    const steps = [];
    for (let i = 0; i <= n; i++) steps.push((-1 + (2 * i) / n) * inset);
    for (let k = 0; k < 3; k++)
      for (const sgn of [-1, 1])
        for (const u of steps)
          for (const v of steps) {
            const p = [0, 0, 0];
            p[k] = sgn * solid.half[k];
            p[(k + 1) % 3] = u * solid.half[(k + 1) % 3];
            p[(k + 2) % 3] = v * solid.half[(k + 2) % 3];
            out.push(p);
          }
  } else if (solid.type === "ellipsoid" || solid.type === "sphere") {
    // Rings closer together near the poles, where a flat stone rests.
    const r = solid.type === "sphere" ? [solid.r, solid.r, solid.r] : solid.r;
    const k = 6 + 2 * n;
    const lats = [8, 16, 25, 36, 50, 66].map((d) => (d * Math.PI) / 180);
    out.push([0, r[1], 0], [0, -r[1], 0]);
    for (const sg of [1, -1])
      lats.forEach((th, i) => {
        for (let j = 0; j < k; j++) {
          const lon = ((j + (i % 2) * 0.5) * Math.PI * 2) / k;
          const c = Math.sin(th);
          out.push([r[0] * c * Math.cos(lon), sg * r[1] * Math.cos(th), r[2] * c * Math.sin(lon)]);
        }
      });
    for (let j = 0; j < k; j++) {
      const lon = (j * Math.PI * 2) / k;
      out.push([r[0] * Math.cos(lon), 0, r[2] * Math.sin(lon)]);
    }
  } else if (solid.type === "cylinder") {
    const k = 6 + 4 * n;
    for (const y of [-solid.h, solid.h]) {
      out.push([0, y, 0]);
      for (let j = 0; j < k; j++) {
        const a = (j * Math.PI * 2) / k;
        out.push([solid.r * 0.9 * Math.cos(a), y, solid.r * 0.9 * Math.sin(a)]);
        out.push([solid.r * 0.5 * Math.cos(a + 0.3), y, solid.r * 0.5 * Math.sin(a + 0.3)]);
      }
    }
    for (let j = 0; j < k; j++) {
      const a = (j * Math.PI * 2) / k;
      out.push([solid.r * Math.cos(a), 0, solid.r * Math.sin(a)]);
    }
  }
  return out;
}

// A local point against a solid: null when outside, else { depth, n, s }
// (n the outward normal at the nearest surface point s), all local.
export function insideSolid(solid, p, pad = 0) {
  if (solid.type === "sphere") {
    const d = v3.len(p);
    const r = solid.r + pad;
    if (d >= r) return null;
    const n = d > 1e-9 ? v3.scale(p, 1 / d) : [0, 1, 0];
    return { depth: r - d, n, s: v3.scale(n, solid.r) };
  }
  if (solid.type === "ellipsoid") {
    const r = solid.r.map((v) => v + pad);
    const q = [p[0] / r[0], p[1] / r[1], p[2] / r[2]];
    const k = v3.len(q);
    if (k >= 1) return null;
    if (k < 1e-9) return { depth: Math.min(...r), n: [0, 1, 0], s: [0, solid.r[1], 0] };
    // The surface point along the ray from the centre (close enough for
    // pebbles), and the true normal there.
    const s = v3.scale(p, 1 / k);
    const n = v3.norm([s[0] / (r[0] * r[0]), s[1] / (r[1] * r[1]), s[2] / (r[2] * r[2])]);
    return { depth: Math.max(0, v3.dot(v3.sub(s, p), n)), n, s };
  }
  if (solid.type === "box") {
    const h = solid.half.map((v) => v + pad);
    const dx = h[0] - Math.abs(p[0]);
    const dy = h[1] - Math.abs(p[1]);
    const dz = h[2] - Math.abs(p[2]);
    if (dx <= 0 || dy <= 0 || dz <= 0) return null;
    if (dx <= dy && dx <= dz) {
      const sx = Math.sign(p[0]) || 1;
      return { depth: dx, n: [sx, 0, 0], s: [sx * solid.half[0], p[1], p[2]] };
    }
    if (dy <= dz) {
      const sy = Math.sign(p[1]) || 1;
      return { depth: dy, n: [0, sy, 0], s: [p[0], sy * solid.half[1], p[2]] };
    }
    const sz = Math.sign(p[2]) || 1;
    return { depth: dz, n: [0, 0, sz], s: [p[0], p[1], sz * solid.half[2]] };
  }
  if (solid.type === "cylinder") {
    const r = solid.r + pad;
    const h = solid.h + pad;
    const rho = Math.hypot(p[0], p[2]);
    const dr = r - rho;
    const dy = h - Math.abs(p[1]);
    if (dr <= 0 || dy <= 0) return null;
    if (dy < dr) {
      const sy = Math.sign(p[1]) || 1;
      return { depth: dy, n: [0, sy, 0], s: [p[0], sy * solid.h, p[2]] };
    }
    const n = rho > 1e-9 ? [p[0] / rho, 0, p[2] / rho] : [1, 0, 0];
    return { depth: dr, n, s: [n[0] * solid.r, p[1], n[2] * solid.r] };
  }
  return null;
}

// Any solid's point furthest along local direction d.
function supportOf(solid, d) {
  if (round(solid)) return support(solid, d);
  if (solid.type === "box") return solid.half.map((h, k) => (d[k] >= 0 ? h : -h));
  if (solid.type === "cylinder") {
    const rho = Math.hypot(d[0], d[2]);
    const y = d[1] >= 0 ? solid.h : -solid.h;
    return rho > 1e-9 ? [(solid.r * d[0]) / rho, y, (solid.r * d[2]) / rho] : [0, y, 0];
  }
  return [0, 0, 0];
}

// The point of a round solid furthest along local direction d (for the
// floor: a ball touches it at one point).
function support(solid, d) {
  if (solid.type === "sphere") return v3.scale(v3.norm(d), solid.r);
  const r = solid.r;
  const k = Math.hypot(r[0] * d[0], r[1] * d[1], r[2] * d[2]) || 1;
  return [(r[0] * r[0] * d[0]) / k, (r[1] * r[1] * d[1]) / k, (r[2] * r[2] * d[2]) / k];
}

const round = (s) => s && (s.type === "sphere" || s.type === "ellipsoid");
// A round body with no sample points rolls on one touching point (a ball, a
// cherry); one with points rests on a patch of them (a pebble in a cairn:
// on one point it would balance like a pin).
const rolls = (b) => round(b.solid) && !b.points.length;

// The part of rotation q that turns about unit axis a (swing-twist).
function twist(q, a) {
  const d = q[0] * a[0] + q[1] * a[1] + q[2] * a[2];
  const t = [a[0] * d, a[1] * d, a[2] * d, q[3]];
  const l = Math.hypot(t[0], t[1], t[2], t[3]);
  return l > 1e-9 ? t.map((v) => v / l) : [0, 0, 0, 1];
}

// Contacts grouped by the pair of bodies (a plane counts as one).
function groupPairs(contacts) {
  const m = new Map();
  for (const c of contacts) {
    const k = `${c.a.id}:${c.b ? c.b.id : "p"}`;
    let g = m.get(k);
    if (!g) m.set(k, (g = []));
    g.push(c);
  }
  return m.values();
}

// ---- The world --------------------------------------------------------------

export class World {
  // opts: { gravity: [3], substeps, sleepSpeed (a speed below which a
  // body counts as still), sleepAfter (seconds) }
  constructor(o = {}) {
    this.gravity = (o.gravity || [0, -9.8, 0]).slice();
    this.substeps = o.substeps ?? 10;
    this.bodies = [];
    this.planes = []; // { n, d, friction, restitution }: n.x >= d is outside
    this.joints = [];
    this.particles = []; // { pos, prev, vel, invMass, radius, home }
    this.links = []; // { a, b (particle indices), length, compliance }
    this.sleepSpeed = o.sleepSpeed ?? 0.02;
    this.sleepAfter = o.sleepAfter ?? 0.5;
    this.asleep = false;
    this.stillFor = 0;
    this.time = 0;
    // Hits since the caller last read them: { body, other, point, n, speed }
    // (the speed along n at which they met).
    this.hits = [];
    this.minHit = o.minHit ?? 0.5;
    this.pairs = o.pairs ?? null; // (a, b) => false to let two bodies pass
    // How far one contact may push per substep, and the top speed: pieces
    // that start out overlapping (a heap built for looks) ease apart
    // instead of flying off.
    this.maxPush = o.maxPush ?? Infinity;
    this.maxSpeed = o.maxSpeed ?? Infinity;
  }

  add(body) {
    this.bodies.push(body);
    this.wake();
    return body;
  }

  // The floor or a wall: points stay on the side n points to, n.x >= d.
  plane(n, d, o = {}) {
    // grip: how fast a body resting on it stops rocking and rolling (sand
    // holds a stone; a table lets a ball roll).
    const p = { n: v3.norm(n), d, friction: o.friction ?? 0.6, restitution: o.restitution ?? 0.3, grip: o.grip ?? 0 }; // prettier-ignore
    this.planes.push(p);
    return p;
  }

  // Pins body a's local point la to a world point (b null, lb the world
  // point) or to body b's local point lb, at `length` (0: a ball joint).
  // compliance 0 is stiff; larger is springier. `slack` lets it go slack
  // when shorter (a rope or a stem).
  joint(a, la, b, lb, o = {}) {
    const j = { a, la: la.slice(), b, lb: lb.slice(), length: o.length ?? 0, compliance: o.compliance ?? 0, slack: !!o.slack, lambda: 0, damping: o.damping ?? 0 }; // prettier-ignore
    this.joints.push(j);
    this.wake();
    return j;
  }

  removeJoint(j) {
    const i = this.joints.indexOf(j);
    if (i >= 0) this.joints.splice(i, 1);
    this.wake();
  }

  particle(pos, o = {}) {
    const m = o.mass ?? 1;
    const p = { pos: pos.slice(), prev: pos.slice(), vel: [0, 0, 0], invMass: m > 0 ? 1 / m : 0, radius: o.radius ?? 0, home: pos.slice() }; // prettier-ignore
    this.particles.push(p);
    return this.particles.length - 1;
  }

  link(a, b, o = {}) {
    const pa = this.particles[a].pos;
    const pb = this.particles[b].pos;
    this.links.push({ a, b, length: o.length ?? v3.len(v3.sub(pa, pb)), compliance: o.compliance ?? 0, lambda: 0 }); // prettier-ignore
  }

  wake() {
    this.asleep = false;
    this.stillFor = 0;
  }

  // Advances by dt seconds (capped, so a slow frame doesn't explode).
  step(dt) {
    if (this.asleep) return false;
    dt = Math.min(Math.max(dt, 0), 1 / 30);
    if (dt <= 0) return false;
    const n = this.substeps;
    const h = dt / n;
    const was = this.bodies.map((b) => [b.pos.slice(), b.q.slice()]);
    const wasP = this.particles.map((p) => p.pos.slice());
    for (let s = 0; s < n; s++) this.substep(h);
    this.time += dt;
    // Whole-world sleep: when nothing has moved for a moment, stop. (How
    // far things moved this frame, not their speeds: a body resting on
    // another keeps a little speed that the contacts take back each step.)
    let fast = 0;
    this.bodies.forEach((b, i) => {
      if (b.fixed) return;
      if (b.held) fast = Infinity;
      const r = b.bound || 1;
      const turn = 2 * Math.acos(Math.min(1, Math.abs(dotQ(b.q, was[i][1]))));
      fast = Math.max(fast, v3.len(v3.sub(b.pos, was[i][0])) / dt, (turn * r) / dt);
    });
    this.particles.forEach((p, i) => {
      if (p.invMass) fast = Math.max(fast, v3.len(v3.sub(p.pos, wasP[i])) / dt);
    });
    if (this.joints.some((j) => j.wakes)) fast = Infinity;
    this.stillFor = fast < this.sleepSpeed ? this.stillFor + dt : 0;
    if (this.stillFor > this.sleepAfter) {
      this.asleep = true;
      for (const b of this.bodies) {
        b.vel = [0, 0, 0];
        b.omega = [0, 0, 0];
      }
      for (const p of this.particles) p.vel = [0, 0, 0];
    }
    return true;
  }

  substep(h) {
    this.tick = (this.tick || 0) + 1;
    const g = this.gravity;
    // Integrate.
    for (const b of this.bodies) {
      b.prevPos = b.pos.slice();
      b.prevQ = b.q.slice();
      if (b.fixed) continue;
      // A springy body (a stem) is turned back toward its rest turn, with
      // some damping: restK is the spring's stiffness (per second squared).
      if (b.restQ && !b.held) {
        let dq = quat.mul(b.restQ, quat.conj(b.q));
        if (dq[3] < 0) dq = dq.map((v) => -v);
        const sn = Math.hypot(dq[0], dq[1], dq[2]);
        const ang = 2 * Math.atan2(sn, dq[3]);
        const ax = sn > 1e-9 ? [dq[0] / sn, dq[1] / sn, dq[2] / sn] : [0, 0, 0];
        for (let i = 0; i < 3; i++) b.omega[i] += (b.restK * ang * ax[i] - (b.restD ?? 2) * b.omega[i]) * h; // prettier-ignore
      }
      const ld = Math.exp(-b.damping * h);
      const ad = Math.exp(-b.angDamping * h);
      for (let i = 0; i < 3; i++) {
        b.vel[i] = (b.vel[i] + g[i] * h) * ld;
        b.omega[i] *= ad;
        b.pos[i] += b.vel[i] * h;
      }
      b.q = quat.norm(addRot(b.q, b.omega, 0.5 * h));
    }
    for (const p of this.particles) {
      p.prev = p.pos.slice();
      if (!p.invMass) continue;
      for (let i = 0; i < 3; i++) {
        p.vel[i] += g[i] * h;
        p.pos[i] += p.vel[i] * h;
      }
    }
    // Positions: joints, links, then contacts.
    for (const j of this.joints) this.solveJoint(j, h);
    // A held body keeps near the turn it was picked up in (a hand grips; a
    // pin would let it swing face down), easing back after a sway.
    for (const b of this.bodies)
      if (b.holdQ) b.q = quat.slerp(b.q, b.holdQ, 1 - Math.exp(-b.holdK * h));
    // A hinged body only turns about its hinge's axis (world), from its
    // rest turn: the rest of a turn is dropped.
    for (const b of this.bodies) if (b.hinge) b.q = quat.norm(quat.mul(twist(quat.mul(b.q, quat.conj(b.hinge.q)), b.hinge.axis), b.hinge.q)); // prettier-ignore
    for (const l of this.links) this.solveLink(l, h);
    const contacts = this.contacts();
    // Each touching pair's pushes first, then its friction against the
    // pair's whole push (solved one by one, the later points of a resting
    // face would get almost none and slide).
    for (const group of groupPairs(contacts)) {
      this.solveGroup(group);
      let sum = 0;
      let on = 0;
      for (const c of group) {
        sum += c.lambda;
        if (c.lambda > 0) on++;
      }
      for (const c of group)
        if (c.lambda > 0) this.contactFriction(c, Math.max(c.lambda, sum / on));
    }
    this.particlePlanes();
    // Velocities from the moves.
    for (const b of this.bodies) {
      if (b.fixed) continue;
      for (let i = 0; i < 3; i++) b.vel[i] = (b.pos[i] - b.prevPos[i]) / h;
      const dq = quat.mul(b.q, quat.conj(b.prevQ));
      const k = (dq[3] >= 0 ? 2 : -2) / h;
      b.omega = [dq[0] * k, dq[1] * k, dq[2] * k];
    }
    for (const p of this.particles) {
      if (!p.invMass) continue;
      for (let i = 0; i < 3; i++) p.vel[i] = (p.pos[i] - p.prev[i]) / h;
    }
    for (const c of contacts) this.contactVelocity(c, h);
    if (this.maxSpeed < Infinity)
      for (const b of this.bodies) {
        const sp = v3.len(b.vel);
        if (sp > this.maxSpeed) b.vel = v3.scale(b.vel, this.maxSpeed / sp);
      }
    for (const j of this.joints) if (j.damping) this.jointDamping(j, h);
  }

  // ---- Joints and links ----

  solveJoint(j, h) {
    const a = j.a;
    const ra = quat.rotate(a.q, j.la);
    const pa = v3.add(a.pos, ra);
    let rb = [0, 0, 0];
    let pb = j.lb;
    if (j.b) {
      rb = quat.rotate(j.b.q, j.lb);
      pb = v3.add(j.b.pos, rb);
    }
    const d = v3.sub(pb, pa);
    const len = v3.len(d);
    let c = len - j.length;
    if (j.slack && c < 0) return;
    if (Math.abs(c) < 1e-9 || len < 1e-9) return;
    const n = v3.scale(d, 1 / len);
    const wa = a.weight(ra, n);
    const wb = j.b ? j.b.weight(rb, n) : 0;
    const alpha = j.compliance / (h * h);
    if (wa + wb + alpha <= 0) return;
    const dl = c / (wa + wb + alpha);
    const p = v3.scale(n, dl);
    a.applyPos(p, ra, 1);
    if (j.b) j.b.applyPos(p, rb, -1);
  }

  // A springy joint (the finger's hold) also loses speed along itself.
  jointDamping(j, h) {
    const a = j.a;
    const ra = quat.rotate(a.q, j.la);
    const v = a.velAt(ra);
    const k = Math.min(1, j.damping * h);
    const wa = a.weight(ra, v3.norm(v));
    if (wa <= 0) return;
    a.applyVel(v3.scale(v, -k / wa), ra, 1);
  }

  solveLink(l, h) {
    const A = this.particles[l.a];
    const B = this.particles[l.b];
    const w = A.invMass + B.invMass;
    if (!w) return;
    const d = v3.sub(B.pos, A.pos);
    const len = v3.len(d);
    if (len < 1e-9) return;
    const alpha = l.compliance / (h * h);
    const dl = (len - l.length) / (w + alpha);
    const n = v3.scale(d, dl / len);
    for (let i = 0; i < 3; i++) {
      A.pos[i] += n[i] * A.invMass;
      B.pos[i] -= n[i] * B.invMass;
    }
  }

  particlePlanes() {
    for (const p of this.particles) {
      if (!p.invMass) continue;
      for (const pl of this.planes) {
        const dist = v3.dot(pl.n, p.pos) - pl.d - p.radius;
        if (dist >= 0) continue;
        for (let i = 0; i < 3; i++) p.pos[i] -= pl.n[i] * dist;
        // Friction: hold it where it was along the plane.
        const mv = v3.sub(p.pos, p.prev);
        const t = v3.sub(mv, v3.scale(pl.n, v3.dot(mv, pl.n)));
        const k = Math.min(1, pl.friction);
        for (let i = 0; i < 3; i++) p.pos[i] -= t[i] * k;
      }
    }
  }

  // ---- Contacts ----

  // Every touching pair this substep: { a, b (null: a plane), la (a's
  // local point), lb (b's local point, or the world point), n (from b to
  // a), depth, friction, restitution, vn (speed along n before) }.
  contacts() {
    const out = [];
    const bodies = this.bodies;
    for (const a of bodies) {
      if (a.fixed) continue;
      for (const pl of this.planes) {
        // A ball or a pebble touches a plane at one point.
        if (rolls(a)) {
          const dl = quat.rotate(quat.conj(a.q), v3.scale(pl.n, -1));
          const sp = support(a.solid, dl);
          this.planeContact(out, a, sp, 0, pl);
          continue;
        }
        if (v3.dot(pl.n, a.pos) - pl.d > a.bound + 1e-6) continue;
        for (const lp of a.points) this.planeContact(out, a, lp, a.radius, pl);
      }
    }
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i];
      for (let k = i + 1; k < bodies.length; k++) {
        const b = bodies[k];
        if (a.fixed && b.fixed) continue;
        if (this.pairs && !this.pairs(a, b)) continue;
        this.pairContacts(out, a, b);
      }
    }
    return out;
  }

  // The contacts between two bodies (pushed onto out).
  pairContacts(out, a, b) {
    const d = v3.len(v3.sub(a.pos, b.pos));
    if (d > a.bound + b.bound + 1e-6) return out;
    if (a.solid?.type === "sphere" && b.solid?.type === "sphere") {
      this.sphereContact(out, a, b);
      return out;
    }
    // A round piece meets another solid at its deepest point (its own
    // sample points would make it balance on a point, like a pin).
    if (rolls(a) && b.solid) this.roundContact(out, a, b);
    else if (b.solid) for (const lp of a.points) this.pointContact(out, a, lp, a.radius, b);
    if (rolls(b) && a.solid) {
      if (!rolls(a)) this.roundContact(out, b, a);
    } else if (a.solid) for (const lp of b.points) this.pointContact(out, b, lp, b.radius, a);
    return out;
  }

  // Whether two bodies overlap now.
  touching(a, b) {
    return this.pairContacts([], a, b).length > 0;
  }

  planeContact(out, a, lp, rad, pl) {
    const r = quat.rotate(a.q, lp);
    const p = v3.add(a.pos, r);
    const dist = v3.dot(pl.n, p) - pl.d - rad;
    if (dist >= 0) return;
    // The contact point on the surface of the point's ball.
    out.push({
      a,
      b: null,
      la: lp,
      lb: v3.sub(p, v3.scale(pl.n, rad + dist)),
      n: pl.n,
      depth: -dist,
      rad,
      friction: Math.sqrt(a.friction * pl.friction),
      grip: pl.grip,
      restitution: Math.max(a.restitution, pl.restitution) * 0.5 + Math.min(a.restitution, pl.restitution) * 0.5, // prettier-ignore
      vn: v3.dot(a.velAt(r), pl.n),
    });
  }

  // Body a's local point (a ball of radius rad) against body b's solid.
  pointContact(out, a, lp, rad, b) {
    const r = quat.rotate(a.q, lp);
    const p = v3.add(a.pos, r);
    const inB = b.toLocal(p);
    const hit = insideSolid(b.solid, inB, rad);
    if (!hit) return;
    const n = quat.rotate(b.q, hit.n);
    out.push({
      a,
      b,
      la: lp,
      lb: hit.s,
      n,
      depth: hit.depth,
      rad,
      friction: Math.sqrt(a.friction * b.friction),
      restitution: 0.5 * (a.restitution + b.restitution),
      vn: v3.dot(v3.sub(a.velAt(r), b.velAt(v3.sub(b.toWorld(hit.s), b.pos))), n),
    });
  }

  // A round body against another solid: the direction along which they
  // overlap least (as in the separating axis test, searched from a few
  // starts), and the touch at round body a's furthest point that way.
  roundContact(out, a, b) {
    const overlap = (n) => {
      const sa = a.toWorld(supportOf(a.solid, quat.rotate(quat.conj(a.q), v3.scale(n, -1))));
      const sb = b.toWorld(supportOf(b.solid, quat.rotate(quat.conj(b.q), n)));
      return v3.dot(v3.sub(sb, sa), n);
    };
    const starts = [v3.norm(v3.sub(a.pos, b.pos))];
    if (!round(b.solid))
      for (const ax of [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ])
        for (const sg of [1, -1]) starts.push(quat.rotate(b.q, v3.scale(ax, sg)));
    let n = starts[0];
    let f = overlap(n);
    if (f <= 0) return;
    for (const s0 of starts.slice(1)) {
      const g = overlap(s0);
      if (g < f) [n, f] = [s0, g];
    }
    if (f <= 0) return;
    // Refine: try small turns each way, halving the step.
    let step = 0.3;
    const tangents = (v) => {
      const t1 = v3.norm(Math.abs(v[0]) < 0.9 ? v3.cross(v, [1, 0, 0]) : v3.cross(v, [0, 1, 0]));
      return [t1, v3.cross(v, t1)];
    };
    for (let it = 0; it < 14 && step > 1e-3; it++) {
      const [t1, t2] = tangents(n);
      let moved = false;
      for (const t of [t1, v3.scale(t1, -1), t2, v3.scale(t2, -1)]) {
        const m = v3.norm(v3.add(n, v3.scale(t, step)));
        const g = overlap(m);
        if (g < f) {
          [n, f] = [m, g];
          moved = true;
          break;
        }
      }
      if (f <= 0) return;
      if (!moved) step *= 0.5;
    }
    const la = supportOf(a.solid, quat.rotate(quat.conj(a.q), v3.scale(n, -1)));
    const pa = a.toWorld(la);
    const lb = b.toLocal(v3.add(pa, v3.scale(n, f)));
    const ra = quat.rotate(a.q, la);
    const rb = quat.rotate(b.q, lb);
    out.push({
      a,
      b,
      la,
      lb,
      n,
      depth: f,
      rad: 0,
      friction: Math.sqrt(a.friction * b.friction),
      restitution: 0.5 * (a.restitution + b.restitution),
      vn: v3.dot(v3.sub(a.velAt(ra), b.velAt(rb)), n),
    });
  }

  sphereContact(out, a, b) {
    const d = v3.sub(a.pos, b.pos);
    const len = v3.len(d);
    const depth = a.solid.r + b.solid.r - len;
    if (depth <= 0) return;
    const n = len > 1e-9 ? v3.scale(d, 1 / len) : [0, 1, 0];
    const la = quat.rotate(quat.conj(a.q), v3.scale(n, -a.solid.r));
    const lb = quat.rotate(quat.conj(b.q), v3.scale(n, b.solid.r));
    const ra = quat.rotate(a.q, la);
    const rb = quat.rotate(b.q, lb);
    out.push({
      a,
      b,
      la,
      lb,
      n,
      depth,
      rad: 0,
      friction: Math.sqrt(a.friction * b.friction),
      restitution: 0.5 * (a.restitution + b.restitution),
      vn: v3.dot(v3.sub(a.velAt(ra), b.velAt(rb)), n),
    });
  }

  // A contact's push from the current state: sets c.lambda and returns
  // [p, ra, rb] (null when it no longer touches).
  contactPush(c) {
    const { a, b, n } = c;
    const ra = quat.rotate(a.q, c.la);
    const pa = v3.add(a.pos, ra);
    let rb = [0, 0, 0];
    let pb;
    if (b) {
      rb = quat.rotate(b.q, c.lb);
      pb = v3.add(b.pos, rb);
    } else pb = c.lb;
    // Depth now, along the contact normal (a's point ball against b).
    const depth = Math.min(this.maxPush, v3.dot(v3.sub(pb, pa), n) + c.rad);
    c.lambda = 0;
    if (depth <= 0) return null;
    const wa = a.weight(ra, n);
    const wb = b ? b.weight(rb, n) : 0;
    if (wa + wb <= 0) return null;
    const dl = depth / (wa + wb);
    c.lambda = dl;
    return [v3.scale(n, dl), ra, rb];
  }

  // A pair's pushes, all worked out from the same state and shared out
  // (one by one, the first point of a resting face would take the whole
  // push and tip it: stacks would shiver and creep).
  solveGroup(group) {
    const pushes = [];
    for (const c of group) {
      const r = this.contactPush(c);
      if (r) pushes.push(r);
    }
    if (!pushes.length) return;
    const k = 1 / pushes.length;
    const { a, b } = group[0];
    for (const [p, ra, rb] of pushes) {
      const ps = v3.scale(p, k);
      a.applyPos(ps, ra, 1);
      if (b) b.applyPos(ps, rb, -1);
    }
    for (const c of group) c.lambda *= k;
  }

  // Static friction: undo the sliding along the surface this substep, as
  // long as it would take less than mu times the push.
  contactFriction(c, push) {
    const { a, b, n } = c;
    c.push = push;
    const ra2 = quat.rotate(a.q, c.la);
    const pa2 = v3.add(a.pos, ra2);
    const paPrev = v3.add(a.prevPos, quat.rotate(a.prevQ, c.la));
    let dp = v3.sub(pa2, paPrev);
    if (b) {
      const rb2 = quat.rotate(b.q, c.lb);
      const pbNow = v3.add(b.pos, rb2);
      const pbPrev = v3.add(b.prevPos, quat.rotate(b.prevQ, c.lb));
      dp = v3.sub(dp, v3.sub(pbNow, pbPrev));
    }
    const dt = v3.sub(dp, v3.scale(n, v3.dot(dp, n)));
    const slide = v3.len(dt);
    if (slide < 1e-12) return;
    const tdir = v3.scale(dt, -1 / slide);
    const wta = a.weight(ra2, tdir);
    const wtb = b ? b.weight(quat.rotate(b.q, c.lb), tdir) : 0;
    if (wta + wtb <= 0) return;
    const dlt = slide / (wta + wtb);
    if (dlt < c.friction * push * 1.2) {
      const pt = v3.scale(tdir, dlt);
      a.applyPos(pt, ra2, 1);
      if (b) b.applyPos(pt, quat.rotate(b.q, c.lb), -1);
    }
  }

  contactVelocity(c, h) {
    if (!c.lambda) return;
    const { a, b, n } = c;
    if (c.grip) {
      // Once per body per step (its first touching point).
      if (a.gripAt !== this.tick) {
        a.gripAt = this.tick;
        const k = Math.exp(-c.grip * h);
        a.omega = a.omega.map((w) => w * k);
      }
    }
    const ra = quat.rotate(a.q, c.la);
    const rb = b ? quat.rotate(b.q, c.lb) : [0, 0, 0];
    const v = b ? v3.sub(a.velAt(ra), b.velAt(rb)) : a.velAt(ra);
    const vn = v3.dot(v, n);
    const vt = v3.sub(v, v3.scale(n, vn));
    const vtl = v3.len(vt);
    let dv = [0, 0, 0];
    // Dynamic friction.
    if (vtl > 1e-9) {
      const fn = (c.push ?? c.lambda) / (h * h);
      const k = Math.min(h * c.friction * fn, vtl);
      dv = v3.scale(vt, -k / vtl);
    }
    // Restitution: a slow touch doesn't bounce (it would jitter at rest).
    const gl = v3.len(this.gravity);
    const e = Math.abs(c.vn) <= 2 * gl * h * 1.5 ? 0 : c.restitution;
    dv = v3.add(dv, v3.scale(n, -vn + Math.max(-e * c.vn, 0)));
    const dl = v3.len(dv);
    if (dl < 1e-12) return;
    const dir = v3.scale(dv, 1 / dl);
    const w = a.weight(ra, dir) + (b ? b.weight(rb, dir) : 0);
    if (w <= 0) return;
    const p = v3.scale(dv, 1 / w);
    a.applyVel(p, ra, 1);
    if (b) b.applyVel(p, rb, -1);
    // A real hit (not resting): tell the caller, once per pair per moment.
    if (-c.vn > this.minHit && !c.told) {
      c.told = true;
      const key = `${a.id}:${b ? b.id : "p"}`;
      const last = this.lastHit?.get(key) ?? -1;
      if (this.time - last > 0.12) {
        (this.lastHit ||= new Map()).set(key, this.time);
        this.hits.push({ body: a, other: b, point: v3.add(a.pos, ra), n, speed: -c.vn });
      }
    }
  }

  // Reads and clears the hits since last time.
  takeHits() {
    const h = this.hits;
    this.hits = [];
    return h;
  }
}

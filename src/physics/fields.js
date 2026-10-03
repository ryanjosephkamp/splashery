// Fields and bodies for Hands-on (lane Hands engine A): a water line toys
// float on, buoyancy in air, gravity wells, wheels that roll, shake
// detection, fish that flee the finger (or eyes that follow it) and
// projectiles that stick in targets; with the per-toy materials of
// ./materials.js. Pure JavaScript, no DOM (the water's surface is drawn by
// ./water-view.js, loaded only when a toy has one).
//
// A recipe asks for these in its `hands` block (docs/PACKS.md, "Hands-on:
// bodies and fields"); toys that ask for none play exactly as before:
//
// - material: "basketball" | { ...keys } (./materials.js)
// - water: { density, level, depth, drag, size, color } | true
// - air: { hover, spring, drag, floor, upright } | true
// - well: { at: [x, y, z], pull, soft, capture, floor }
// - wheels: { axle: [x, y, z], r, parts: [names], sign, grip, roll }
// - shake: { key, gap } | true
// - flee: { radius, push, back, max } | true; follow: true
// - pieces' own `material`, `projectile: { nose, vane, fr }` and `target`
//
// src/physics/hands-on.js calls an Extras (made by extrasFor) at a few
// points: attach, the world built, a press, a move, a let-go, each frame
// and each hit; the world calls its force once per substep (World.force).
// What a recipe's drive() reads comes as info.hands (src/motion.js):
// { on, shake, finger, point, rolled, flee(key, pos) }.

import { quat, v3, surfacePoints } from "./world.js";
import { materialFor, applyMaterial, airForce, rollForce, throwSpin } from "./materials.js";

// ---- Water --------------------------------------------------------------

// The part of a ball of radius r under water, its middle `depth` below the
// line (negative: above).
export function sphereSubmerged(depth, r) {
  const d = Math.max(0, Math.min(2 * r, depth + r));
  return (d * d * (3 * r - d)) / (4 * r * r * r);
}

// The part of a body's sample points under water at a line `level` (each
// point counts by how deep it is, within a band, so the change is smooth).
export function pointsSubmerged(b, pts, level, band) {
  let s = 0;
  for (const p of pts) {
    const y = b.pos[1] + quat.rotate(b.q, p)[1];
    s += Math.max(0, Math.min(1, (level - y) / band + 0.5));
  }
  return s / pts.length;
}

// Where the water line must be for a body at rest to float as it is (its
// density, relative to the water's): the level that keeps that part under.
export function restLevel(b, fl, density) {
  const want = Math.max(0.02, Math.min(0.98, density));
  let lo = b.pos[1] - b.bound * 1.5;
  let hi = b.pos[1] + b.bound * 1.5;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (submerged(b, fl, mid) < want) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function submerged(b, fl, level) {
  if (fl.sphere) return sphereSubmerged(level - b.pos[1], fl.sphere);
  return pointsSubmerged(b, fl.points, level, fl.band);
}

// How a body floats: a ball by its radius; anything else by points on its
// outside.
export function floatShape(b, R) {
  if (b.solid?.type === "sphere" && !b.points.length) return { sphere: b.solid.r };
  const pts = b.points.length ? b.points : b.solid ? surfacePoints(b.solid, 1) : [[0, 0, 0]];
  return { points: pts, band: 0.25 * R };
}

// Buoyancy and the water's drag on one body for a substep h. water:
// { level, density, drag, G, R }. The water a body pushes aside moves with
// it (its added mass, half the water it displaces, for a ball), so a light
// ball bobs a few times and settles instead of bouncing on the line. A
// ball is lifted at its middle; anything else at each point under water,
// so a boat rights itself and rocks.
export function waterForce(b, fl, water, h) {
  if (b.fixed || b.held) return 0;
  const { G, density, drag, R } = water;
  if (fl.sphere) {
    const s = sphereSubmerged(water.level - b.pos[1], fl.sphere);
    if (s <= 0) return 0;
    const m = density + 0.5 * s; // the ball and the water moving with it
    const v = b.vel;
    const sp = Math.hypot(v[0], v[1], v[2]);
    // Lift, and drag: quadratic (a ball's, Cd 0.47) and a little linear
    // (the waves it makes), both on the part under water.
    // (The waves a bobbing ball makes take its bob away: the linear part
    // is full strength once it floats as deep as it rests.)
    const wet = Math.min(1, s / Math.max(0.05, density));
    const k = 1 / (1 + ((0.18 * sp) / R) * (s / m) * h + 0.5 * drag * wet * h);
    // (Gravity is the world's; the water's mass moving with it slows the
    // ball's answer to the difference without moving where it rests.)
    b.vel[1] += (G + (G * (s - density)) / m) * h;
    for (let i = 0; i < 3; i++) {
      v[i] *= k;
      b.omega[i] *= Math.exp(-0.5 * drag * wet * h);
    }
    return s;
  }
  const n = fl.points.length;
  const mass = 1 / (b.invMass || 1);
  const sub = [];
  let total = 0;
  for (const p of fl.points) {
    const r = quat.rotate(b.q, p);
    const y = b.pos[1] + r[1];
    const s = Math.max(0, Math.min(1, (water.level - y) / fl.band + 0.5));
    sub.push([r, s]);
    total += s;
  }
  if (total <= 0) return 0;
  const S = total / n;
  const m = density + 0.5 * S;
  const lift = G + (G * (S - density)) / m;
  for (const [r, s] of sub) {
    if (s <= 0) continue;
    const v = b.velAt(r);
    const w = (s / total) * mass * h;
    const d = (drag * S * density) / m;
    // Up, and against the point's motion (the water's drag).
    b.applyVel([-d * v[0] * w, (lift - d * v[1]) * w, -d * v[2] * w], r, 1);
  }
  return total / n;
}

// ---- Air, wells and wheels ---------------------------------------------

// Hot air: lift that fades with height, so the balloon settles at `hover`
// (world y) and floats back there when pulled down or pushed up; its
// basket hangs under it.
export function airBuoyancy(b, air, h) {
  if (b.fixed || b.held) return;
  const G = air.G;
  const a = G + Math.max(-0.6 * G, Math.min(0.6 * G, (air.spring * G * (air.hover - b.pos[1])) / air.R)); // prettier-ignore
  b.vel[1] += a * h;
  const k = Math.exp(-air.drag * h);
  for (let i = 0; i < 3; i++) b.vel[i] *= k;
  if (air.upright) {
    const up = quat.rotate(b.q, [0, 1, 0]);
    const t = v3.cross(up, [0, 1, 0]);
    for (let i = 0; i < 3; i++) b.omega[i] = (b.omega[i] + t[i] * air.upright * h) * Math.exp(-1.5 * h); // prettier-ignore
  }
}

// A pull toward a point instead of the floor: pull is the gravity's
// strength one toy radius away, falling off with the square of the
// distance (softened within `soft`); inside `capture` it is swallowed and
// held there.
export function wellForce(b, well, h) {
  if (b.fixed || b.held) return;
  const d = v3.sub(well.at, b.pos);
  const r2 = v3.dot(d, d);
  const r = Math.sqrt(r2);
  if (well.capture && r < well.capture) {
    b.captured = true;
  }
  if (b.captured) {
    b.pos = b.pos.map((v, i) => v + (well.at[i] - v) * Math.min(1, 8 * h));
    b.vel = [0, 0, 0];
    b.omega = b.omega.map((w) => w * Math.exp(-2 * h));
    return;
  }
  const s2 = well.soft * well.soft;
  const a = (well.pull * well.R * well.R) / (r2 + s2);
  if (r < 1e-9) return;
  for (let i = 0; i < 3; i++) b.vel[i] += (d[i] / r) * a * h;
}

// Wheels on the ground: they roll along their way and grip sideways (a
// car pushed side-on doesn't slide), and slow only by rolling resistance.
// `axle` is the body's local axle; returns nothing.
export function wheelForce(b, wheels, G, h, onGround) {
  if (b.fixed || b.held || !onGround) return;
  const ax = quat.rotate(b.q, wheels.axle);
  const a = v3.norm([ax[0], 0, ax[2]]);
  const v = b.vel;
  const lat = v[0] * a[0] + v[2] * a[2];
  const k = 1 - Math.exp(-wheels.grip * h);
  v[0] -= a[0] * lat * k;
  v[2] -= a[2] * lat * k;
  const hs = Math.hypot(v[0], v[2]);
  if (hs > 1e-9) {
    const dec = Math.min(hs, wheels.roll * G * h);
    v[0] -= (v[0] / hs) * dec;
    v[2] -= (v[2] / hs) * dec;
  }
  // It turns only as its wheels let it (a little, about the upright).
  b.omega[1] *= Math.exp(-wheels.yaw * h);
}

// ---- Shake --------------------------------------------------------------

// A quick back-and-forth drag: each turn of the finger's way (after a
// stroke of at least `min` CSS pixels, quicker than `slow` seconds) adds to
// the level; two turns close together fire the toy's shake.
export class ShakeMeter {
  constructor(o = {}) {
    this.min = o.min ?? 14;
    this.slow = o.slow ?? 0.4;
    this.gap = o.gap ?? 0.5;
    this.level = 0;
    this.last = null; // { t, x, y }
    this.dir = null; // [dx, dy] of the stroke so far
    this.from = null; // { t, x, y }: where the stroke began
    this.turns = []; // times of turns
    this.fired = -Infinity;
    this.t = 0;
  }

  // The finger at (x, y) at time t. Returns true when the shake fires.
  add(t, x, y) {
    this.decay(t);
    const last = this.last;
    this.last = { t, x, y };
    if (!last) {
      this.from = { t, x, y };
      return false;
    }
    const d = [x - last.x, y - last.y];
    if (Math.hypot(d[0], d[1]) < 1.5) return false;
    if (this.dir && d[0] * this.dir[0] + d[1] * this.dir[1] < 0) {
      // A turn: was the stroke before it long and quick enough?
      const len = Math.hypot(last.x - this.from.x, last.y - this.from.y);
      const quick = t - this.from.t < this.slow;
      this.from = { t: last.t, x: last.x, y: last.y };
      this.dir = d;
      if (len >= this.min && quick) {
        this.turns.push(t);
        this.level = Math.min(1, this.level + 0.22 + Math.min(0.2, len / 400));
        this.turns = this.turns.filter((s) => t - s < 0.9);
        if (this.turns.length >= 2 && t - this.fired > this.gap) {
          this.fired = t;
          return true;
        }
      }
      return false;
    }
    this.dir = this.dir ? [this.dir[0] * 0.5 + d[0], this.dir[1] * 0.5 + d[1]] : d;
    return false;
  }

  decay(t) {
    const dt = Math.max(0, t - this.t);
    this.t = t;
    this.level *= Math.exp(-1.1 * dt);
    return this.level;
  }

  end() {
    this.last = null;
    this.dir = null;
    this.from = null;
  }
}

// ---- Follow and flee ----------------------------------------------------

// Things that dart away from the finger's line (a fish), each on a spring
// back to its place. Items are keyed; flee(key, pos) returns its offset and
// speed (recipe units), worked out each frame by step().
export class FleeField {
  constructor(o = {}) {
    this.radius = o.radius ?? 0.45;
    this.push = o.push ?? 1;
    this.back = o.back ?? 2.2; // the spring's rate (per second)
    this.max = o.max ?? 0.6;
    this.items = new Map();
    this.ray = null; // { origin, dir } in recipe units, or null
  }

  get(key, pos) {
    let it = this.items.get(key);
    if (!it) this.items.set(key, (it = { pos: pos.slice(), d: [0, 0, 0], v: [0, 0, 0] }));
    else it.pos = pos;
    return it;
  }

  // Moves every item on by dt; true while any is still off its place.
  step(dt) {
    const ray = this.ray;
    const k = this.back * this.back;
    const c = 2 * 0.85 * this.back;
    let busy = false;
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = Math.min(dt, 0.1) / n;
    for (const it of this.items.values()) {
      for (let s = 0; s < n; s++) {
        const a = [0, 0, 0];
        if (ray) {
          const p = v3.add(it.pos, it.d);
          const rel = v3.sub(p, ray.origin);
          const along = v3.dot(rel, ray.dir);
          const perp = v3.sub(rel, v3.scale(ray.dir, along));
          const dist = v3.len(perp);
          if (dist < this.radius) {
            const f = (1 - dist / this.radius) ** 2 * this.push * 60;
            const dir = dist > 1e-6 ? v3.scale(perp, 1 / dist) : [0, 1, 0];
            for (let i = 0; i < 3; i++) a[i] += dir[i] * f;
          }
        }
        for (let i = 0; i < 3; i++) {
          a[i] += -k * it.d[i] - c * it.v[i];
          it.v[i] += a[i] * h;
          it.d[i] += it.v[i] * h;
        }
        const l = v3.len(it.d);
        if (l > this.max) {
          it.d = v3.scale(it.d, this.max / l);
          const out = v3.dot(it.v, it.d) / this.max;
          if (out > 0) it.v = v3.sub(it.v, v3.scale(it.d, out / this.max));
        }
      }
      if (v3.len(it.d) > 1e-3 || v3.len(it.v) > 1e-2) busy = true;
      else if (!ray) {
        it.d = [0, 0, 0];
        it.v = [0, 0, 0];
      }
    }
    return busy;
  }
}

// ---- The glue to Hands-on -------------------------------------------------

const KEYS = ["material", "water", "air", "well", "wheels", "shake", "flee", "follow"];

// An Extras for a toy whose hands block asks for any of these pieces (or
// whose pieces are projectiles, targets or have materials); null else.
export function extrasFor(handsOn, info) {
  const hands = info?.recipe?.hands;
  const motion = handsOn.player?.motion;
  const any = hands && (KEYS.some((k) => hands[k]) || hands.projectiles);
  if (!any) {
    if (motion) motion.hands = null;
    return null;
  }
  const x = new Extras(handsOn, hands);
  if (motion) motion.hands = x.about;
  return x;
}

export class Extras {
  constructor(handsOn, hands) {
    this.ho = handsOn;
    this.hands = hands;
    this.mat = materialFor(hands);
    this.shake = hands.shake ? new ShakeMeter(typeof hands.shake === "object" ? hands.shake : {}) : null; // prettier-ignore
    const fo = hands.flee || hands.follow;
    this.flee = fo ? new FleeField(typeof fo === "object" ? fo : {}) : null;
    this.fingerDown = false;
    this.rolled = 0;
    this.spin = null; // a ball spinning on the fingertip
    this.samples = []; // the finger's recent screen points { t, x, y }
    this.water = null;
    this.view = null; // the water's surface (./water-view.js)
    this.throws = 0;
    // What a recipe's drive() reads, as info.hands.
    const self = this;
    this.about = {
      on: false,
      shake: 0,
      finger: null,
      point: null,
      rolled: 0,
      flee(key, pos) {
        if (!self.flee) return { offset: [0, 0, 0], vel: [0, 0, 0] };
        const it = self.flee.get(key, pos);
        return { offset: it.d, vel: it.v };
      },
    };
  }

  get player() {
    return this.ho.player;
  }

  // The world is built: the materials go on, and the fields join in.
  build(w) {
    const ho = this.ho;
    const hands = this.hands;
    const R = ho.R();
    const G = Math.abs(w.gravity[1]) || 26 * R;
    this.G = G;
    const bodies = ho.mode === "toy" ? [ho.body] : ho.pieces.map((p) => p.body);
    const floor = w.planes[0];
    this.mats = new Map();
    if (ho.mode === "toy" && this.mat) {
      applyMaterial(ho.body, this.mat, floor);
      this.mats.set(ho.body, this.mat);
    }
    if (ho.mode === "pieces")
      for (const pc of ho.pieces) {
        const m = pc.def.material ? materialFor({ material: pc.def.material }) : null;
        const pr = pc.def.projectile;
        if (m) {
          applyMaterial(pc.body, m, null);
          this.mats.set(pc.body, m);
        } else if (pr) {
          // A projectile flies nose first and sticks in a target.
          const pm = { fr: pr.fr ?? 200, nose: pr.nose || [0, 0, 1], vane: pr.vane ?? 20, roll: 0 };
          this.mats.set(pc.body, pm);
        }
        if (pr) pc.body.projectile = pr;
        if (pc.def.target) pc.body.target = true;
      }
    // The water line: where the toy at home floats as it stands, unless the
    // recipe says.
    if (hands.water) {
      const wo = typeof hands.water === "object" ? hands.water : {};
      const density = wo.density ?? (this.mat ? densityOf(this.mat) : 0.5);
      const b0 = bodies[0];
      this.floats = new Map(bodies.map((b) => [b, floatShape(b, R)]));
      const ref = ho.mode === "toy" ? b0.home.pos[1] : 0;
      const level = wo.level != null ? ref + wo.level * R : restLevel(b0, this.floats.get(b0), density); // prettier-ignore
      this.water = { level, density, drag: wo.drag ?? 6, G, R, size: (wo.size ?? 3.2) * R, color: wo.color }; // prettier-ignore
      // The pool's floor, below the line.
      floor.d = Math.min(floor.d, level - (wo.depth ?? 2.2) * R);
      floor.restitution = 0.1;
    }
    if (hands.air) {
      const ao = typeof hands.air === "object" ? hands.air : {};
      const b0 = bodies[0];
      this.air = { hover: (ho.mode === "toy" ? b0.home.pos[1] : 0) + (ao.hover ?? 0) * R, spring: ao.spring ?? 0.3, drag: ao.drag ?? 3.2, upright: ao.upright ?? 6, G, R }; // prettier-ignore
      floor.d -= (ao.floor ?? 1.5) * R;
    }
    if (hands.well) {
      const wo = hands.well;
      const at = wo.at ? (ho.mode === "toy" ? this.player.fromRecipe(wo.at) : wo.at.slice()) : bodies[0].home.pos.slice(); // prettier-ignore
      this.well = { at, pull: (wo.pull ?? 1) * G, soft: (wo.soft ?? 0.3) * R, capture: (wo.capture ?? 0) * R, R }; // prettier-ignore
      w.gravity = [0, 0, 0];
      // (No air in space: an orbit keeps its speed.)
      for (const b of bodies) b.damping = 0;
      // Nothing to fall onto: only the walls hold it in.
      if (wo.floor !== true) w.planes = w.planes.filter((p) => Math.abs(p.n[1]) < 0.5);
    }
    if (hands.wheels && ho.mode === "toy") {
      const wh = hands.wheels;
      const b = ho.body;
      // The axle and the wheels' radius, from the recipe's units to the
      // world's (the toy is home now).
      const o = this.player.fromRecipe([0, 0, 0]);
      const ax = v3.sub(this.player.fromRecipe(wh.axle || [0, 0, 1]), o);
      const unit = v3.len(ax) || 1;
      this.wheels = { axle: quat.rotate(quat.conj(b.q), v3.scale(ax, 1 / unit)), r: (wh.r ?? 0.15) * unit, parts: wh.parts || [], sign: wh.sign ?? 1, grip: wh.grip ?? 14, roll: wh.roll ?? 0.015, yaw: wh.yaw ?? 3 }; // prettier-ignore
      // The wheels roll; the body itself barely slides.
      b.friction = 0.002;
      // (A car coasts to a stop on its wheels: the world's calming of slow
      // resting bodies would stop it short.)
      b.coasts = true;
      b.damping = 0.02;
      this.lastPos = b.pos.slice();
      // Room to roll: the walls of the play area move out to `area` toy
      // radii from home (the view drifts after it).
      const A = (wh.area ?? 2.4) * R;
      const c = b.home.pos;
      for (const p of w.planes) if (Math.abs(p.n[1]) < 0.5) p.d = v3.dot(p.n, c) - A;
    }
    if (
      this.mats.size ||
      this.water ||
      this.air ||
      this.well ||
      this.wheels ||
      ho.pieces.some((p) => p.body.projectile)
    )
      // prettier-ignore
      w.force = (h) => this.force(w, h);
  }

  // Once per substep, before the world moves anything.
  force(w, h) {
    const ho = this.ho;
    const bodies = ho.mode === "toy" ? [ho.body] : ho.pieces.map((p) => p.body);
    const G = this.G;
    const R = ho.R();
    for (const b of bodies) {
      if (b.stuck) {
        if (b.held) {
          b.invMass = b.invMassFree ?? b.invMass;
          b.invI = (b.invIFree ?? b.invI).slice();
          b.stuck = false;
        } else continue;
      }
      if (b.held) b.captured = false;
      const touching = b.touchTick >= w.tick - 1;
      const m = this.mats.get(b);
      if (m) {
        // (Drag, lift and spin in the air, not under water.)
        const wet = this.water && b.pos[1] - b.bound < this.water.level;
        if (!wet) airForce(b, m, G, R, h);
        if (touching && m.roll != null) rollForce(b, m, G, h);
      }
      if (this.water) waterForce(b, this.floats.get(b), this.water, h);
      if (this.air) airBuoyancy(b, this.air, h);
      if (this.well) wellForce(b, this.well, h);
      if (this.wheels) wheelForce(b, this.wheels, G, h, touching);
    }
  }

  // ---- The finger ----

  // A press: a toy that flees (or follows) the finger takes the drag.
  pressAt(hit, x, y) {
    this.samples = [{ t: now(), x, y }];
    this.spin = null;
    if (!this.flee) return false;
    this.fingerDown = true;
    this.fingerAt(x, y);
    return true;
  }

  moveTo(x, y) {
    // (The finger's own clock: a shake is as quick as the hand, whatever
    // the frame rate.)
    const t = now();
    this.samples.push({ t, x, y });
    while (this.samples.length > 2 && this.samples[0].t < t - 0.2) this.samples.shift();
    if (this.shake && this.shake.add(t, x, y)) this.fireShake();
    if (this.flee && this.fingerDown) {
      this.fingerAt(x, y);
      return true;
    }
    // Wheels: a drag on the toy pushes it along (never lifts it).
    const pr = this.ho.press;
    if (this.hands.wheels && pr && !this.ho.hold && this.ho.mode !== "pieces") {
      this.ho.pushTo(pr, x, y);
      return true;
    }
    return false;
  }

  // Lets go; true when the drag was ours.
  release() {
    this.shake?.end();
    if (this.flee && this.fingerDown) {
      this.fingerDown = false;
      this.flee.ray = null;
      this.about.finger = null;
      this.about.point = null;
      return true;
    }
    return false;
  }

  fingerAt(x, y) {
    const ray = this.player.recipeRay(x, y);
    this.flee.ray = ray;
    this.about.finger = ray;
    // The point on the finger's line nearest the toy's middle.
    const c = this.hands.flee?.center || this.hands.follow?.center || [0, 0, 0];
    const t = v3.dot(v3.sub(c, ray.origin), ray.dir);
    this.about.point = v3.add(ray.origin, v3.scale(ray.dir, t));
  }

  // A thrown body: the material's weight, spin and drag.
  thrown(h) {
    const b = h.body;
    const m = this.mats?.get(b);
    if (!m) return;
    b.damping = 0.02;
    if (h.place) return;
    b.vel = v3.scale(b.vel, m.throwScale ?? 1);
    if (this.spin) {
      // Off the fingertip it keeps spinning about the upright.
      b.omega = [this.spin.tilt[0], this.spin.rate, this.spin.tilt[2]];
      this.spin = null;
      return;
    }
    const r = v3.sub(b.toWorld(h.joint.la), b.pos);
    const long = m.spiral ? longAxis(b) : null;
    b.omega = throwSpin(m, r, b.vel, long);
    const ws = v3.len(b.omega);
    if (ws > 24) b.omega = v3.scale(b.omega, 24 / ws);
    // A squash ball warms up: livelier with every throw.
    if (m.warm) {
      this.throws++;
      const [a, top] = m.warm;
      const e = Math.min(top, a + ((top - a) * this.throws) / 6);
      b.restitution = e;
      if (this.ho.world?.planes[0]) this.ho.world.planes[0].restitution = e;
    }
  }

  // A hit: a projectile sticks in a target.
  onHit(hit) {
    const a = hit.body;
    const o = hit.other;
    const R = this.ho.R();
    if (!a || !o || hit.speed < 0.8 * R) return;
    const p = a.projectile ? a : o.projectile ? o : null;
    const t = p === a ? o : a;
    if (!p || !t?.target || p.held || p.projectile.stick === false) return;
    p.stuck = true;
    p.vel = [0, 0, 0];
    p.omega = [0, 0, 0];
    p.invMassFree ??= p.invMass;
    p.invIFree ??= p.invI.slice();
    p.invMass = 0;
    p.invI = [0, 0, 0];
  }

  fireShake() {
    const player = this.player;
    const s = this.hands.shake;
    const key = (typeof s === "object" && s.key) || player.toyInfo?.recipe?.action?.key;
    if (!key || !player.motion?.act) return;
    const r = player.motion.act(player.time, null, { key });
    player.stage?.requestRender?.();
    player.emit?.("action", r);
  }

  // ---- Each frame ----

  // Returns true while anything of ours moves.
  step(dt) {
    const ho = this.ho;
    const ab = this.about;
    ab.on = ho.on;
    let busy = false;
    if (this.shake) {
      ab.shake = this.shake.decay(now());
      if (ab.shake > 0.01) busy = true;
    }
    if (this.flee) {
      if (this.flee.step(dt)) busy = true;
      if (this.fingerDown) busy = true;
    }
    // A water toy shows its water line as soon as Hands-on is on.
    if (this.hands.water) {
      if (ho.on && !ho.world && ho.player.stage?.toy) ho.ensure();
      this.showWater(ho.on && !!this.water);
    }
    const w = ho.world;
    if (!w) return busy;
    if (this.mat?.fingertip) this.fingertip(dt);
    if (this.wheels && ho.mode === "toy") {
      const b = ho.body;
      const fwd = v3.norm(v3.cross([0, 1, 0], quat.rotate(b.q, this.wheels.axle)));
      const d = v3.sub(b.pos, this.lastPos);
      this.lastPos = b.pos.slice();
      this.rolled += (this.wheels.sign * v3.dot(d, fwd)) / this.wheels.r;
      ab.rolled = this.rolled;
      if (this.wheels.parts.length) {
        let parts = null;
        if (ho.on) {
          parts = {};
          for (const name of this.wheels.parts) parts[name] = { angle: -this.rolled };
        }
        ho.player.motion.handsParts = parts;
      }
    }
    if (ho.homing) {
      for (const b of ho.mode === "toy" ? [ho.body] : ho.pieces.map((p) => p.body)) {
        b.captured = false;
        if (b.stuck) b.stuck = false;
      }
    }
    return busy;
  }

  // An upward flick while holding a ball that spins on a fingertip: it
  // hops onto the fingertip and spins there, with a slight wobble.
  fingertip(dt) {
    const h = this.ho.hold;
    if (!h) return;
    const b = h.body;
    const s = this.samples;
    if (!this.spin && s.length >= 3) {
      const a = s[0];
      const z = s[s.length - 1];
      const t = z.t - a.t;
      if (t > 0.02) {
        const vy = (a.y - z.y) / t; // up the screen
        const vx = (z.x - a.x) / t;
        if (vy > 700 && vy > 1.5 * Math.abs(vx)) {
          const bottom = b.toLocal(v3.add(b.pos, [0, -(b.solid?.r ?? b.bound), 0]));
          this.spin = { rate: Math.min(22, vy / 90), from: h.joint.la.slice(), to: bottom, t: 0, q: b.q.slice(), tilt: [0, 0, 0] }; // prettier-ignore
        }
      }
    }
    const sp = this.spin;
    if (!sp) return;
    sp.t += dt;
    const e = Math.min(1, sp.t / 0.25);
    const k = e * e * (3 - 2 * e);
    h.joint.la = sp.from.map((v, i) => v + (sp.to[i] - v) * k);
    sp.rate *= Math.exp(-0.12 * dt);
    sp.q = quat.norm(quat.mul(quat.axisAngle([0, 1, 0], sp.rate * dt), sp.q));
    const wob = 0.05 * Math.min(1, sp.t);
    const ta = [Math.cos(sp.t * 2.3), 0, Math.sin(sp.t * 2.3)];
    sp.tilt = v3.scale(ta, wob * 2.3);
    b.holdQ = quat.mul(quat.axisAngle(ta, wob), sp.q);
    b.holdK = 40;
  }

  showWater(on) {
    if (!on) {
      this.view?.hide();
      return;
    }
    if (this.view) {
      this.view.show(this.waterPose());
      return;
    }
    if (this.loadingView) return;
    this.loadingView = true;
    import("./water-view.js")
      .then(({ WaterView }) => {
        this.view = new WaterView(this.player);
        if (this.ho.on && this.water) this.view.show(this.waterPose());
      })
      .catch(() => {});
  }

  // The water's surface in the world: its middle, radius and color.
  waterPose() {
    const ho = this.ho;
    const wt = this.water;
    if (ho.mode === "toy") {
      const c = ho.body.home.pos;
      return { center: [c[0], wt.level, c[2]], radius: wt.size, color: wt.color };
    }
    const p = this.player;
    const c = p.fromRecipe([0, wt.level, 0]);
    const e = p.fromRecipe([wt.size, wt.level, 0]);
    return { center: c, radius: v3.len(v3.sub(e, c)), color: wt.color };
  }

  dispose() {
    this.view?.dispose();
    this.view = null;
  }
}

// Seconds, from the page's clock (or Node's).
const now = () => (globalThis.performance?.now() ?? Date.now()) / 1000;

// A material's density relative to water (a ball of its mass and radius).
export function densityOf(m) {
  return m.mass / ((4 / 3) * Math.PI * m.r ** 3 * 1000);
}

// A body's longest local axis, in the world (a football's).
function longAxis(b) {
  const s = b.solid;
  let ax = [1, 0, 0];
  if (s?.type === "ellipsoid") {
    const k = s.r.indexOf(Math.max(...s.r));
    ax = [0, 0, 0];
    ax[k] = 1;
  } else if (b.points.length) {
    let best = 0;
    for (const p of b.points) {
      const l = v3.len(p);
      if (l > best) {
        best = l;
        ax = v3.scale(p, 1 / l);
      }
    }
  }
  return quat.rotate(b.q, ax);
}

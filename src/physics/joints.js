// Joints for Hands-on (lane Hands engine B): parts that move the way the
// real thing's parts do, in a recipe's `hands.joints`.
//
// - hinge: a part swings on an axis between two angles, with an optional
//   spring home; it falls by its own weight (a chest lid, a visor).
// - slider: a part moves along one line between two stops (a sword drawn
//   out of a stone, a telescope's tube, a cork).
// - dial: drag to turn a part about its axis, with optional clicks
//   (detents) and coasting after a flick (a crank, a rotor, a key).
// - socket: a loose piece clicks back into its place when brought close
//   (an orange's wedge, a gift box's lid).
// - break: a piece holds fast until pulled hard, then snaps off; ↺ Reset
//   mends it (a candy cane's top, a grape, a petal).
// - hands.upright: a whole toy (Level 1) rights itself after a tip (a
//   sailboat, a roly-poly penguin).
//
// Hinges, sliders and dials are driven parts: one number each (an angle or
// a distance), moved by the finger, gravity, a spring and their stops, and
// posed exactly from it, so a part never wobbles off its axis or jitters.
// Loose pieces (sockets, broken-off pieces) are ordinary bodies of the
// world (src/physics/world.js). Everything is solid: parts move whole, and
// ↺ sends each home (a broken one mended). Pure JavaScript, no DOM.
//
// Coordinates are the recipe's own (a kit toy's build space; a scan rig's
// world), as for the rest of Hands-on (src/physics/hands-on.js). docs/PACKS.md,
// "Hands-on: joints", describes every key with an example.

import { Body, boundOf, surfacePoints, quat, v3 } from "./world.js";

const TAU = Math.PI * 2;
const FOLLOW = 16; // per second: how fast a driven part catches the finger
const STILL = 0.02; // a driven part slower than this (per second) can rest
const GLIDE = 0.22; // seconds a piece takes to click into its socket
const ID = [0, 0, 0, 1];

// Transforms x -> q x + t (q a quaternion).
const tf = (q = ID, t = [0, 0, 0]) => ({ q, t });
const tfApply = (T, x) => v3.add(quat.rotate(T.q, x), T.t);
const tfMul = (A, B) => tf(quat.mul(A.q, B.q), v3.add(quat.rotate(A.q, B.t), A.t));
const tfInv = (T) => {
  const qi = quat.conj(T.q);
  return tf(qi, v3.scale(quat.rotate(qi, T.t), -1));
};
const tfDir = (T, d) => quat.rotate(T.q, d);
// A turn of `angle` about the line through p along unit axis a.
const turnAbout = (p, a, angle) => {
  const q = quat.axisAngle(a, angle);
  return tf(q, v3.sub(p, quat.rotate(q, p)));
};
const perp = (v, a) => v3.sub(v, v3.scale(a, v3.dot(v, a)));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// The pieces of a scan's rig (src/rigs.js) as Hands-on pieces, each a body
// of its own (rigid: a hard-edged part moves whole, never bent). names: the
// parts to use (default all); o: { solid (a function of the part's first
// region { at, r } giving a solid), mass, friction, restitution, ... } is
// copied onto every piece. Each piece's middle is its first region's
// centre, and it turns about that.
export function rigPieces(rig, names = null, o = {}) {
  const out = [];
  for (const p of rig.parts || []) {
    if (names && !names.includes(p.name)) continue;
    const reg = p.regions?.[0];
    if (!reg) continue;
    const r = Array.isArray(reg.r) ? reg.r : [reg.r, reg.r, reg.r];
    const solid = o.solid ? o.solid(reg, p) : { type: "ellipsoid", r: r.slice() };
    const { solid: _s, ...rest } = o;
    out.push({
      part: p.name,
      pivot: reg.at.slice(),
      pos: reg.at.slice(),
      solid,
      points: surfacePoints(solid, 1),
      pick: r.map((v) => v * 1.1),
      ...rest,
    });
  }
  return out;
}

// The joints of a toy, or null when its recipe has none. Called by Hands-on
// when it builds its world (pieces mode, or Level 1 for `upright`).
export function makeJoints(hands, world) {
  const def = hands.info?.recipe?.hands;
  if (!def?.joints && !def?.upright) return null;
  return new Joints(hands, world, def);
}

export class Joints {
  constructor(hands, world, def) {
    this.hands = hands;
    this.world = world;
    this.def = def;
    this.events = []; // for tests and clips: { kind, joint, speed, t }
    this.list = [];
    this.byName = new Map();
    this.time = 0;
    if (hands.mode === "toy") {
      this.upright = def.upright ? { k: def.upright.k ?? def.upright, damping: def.upright.damping ?? 3 } : null; // prettier-ignore
      return;
    }
    const data = hands.player.proc?.ctx?.kit?.data;
    const defs = typeof def.joints === "function" ? def.joints(data, hands.info) : def.joints;
    for (const d of defs || []) this.add(d);
    // A driven part's parent first, so it poses before its children.
    this.list.sort((a, b) => depth(a) - depth(b));
    // Glued pieces (a piece not yet broken off, and the one it hangs on)
    // never push each other.
    const base = world.pairs;
    world.pairs = (a, b) => (base ? base(a, b) : true) && !this.glued(a, b);
  }

  // ---- Building ----

  add(d) {
    const hands = this.hands;
    const name = d.name ?? d.part ?? (d.token !== undefined ? `token${d.token}` : `j${this.list.length}`); // prettier-ignore
    // The piece it moves: one of the recipe's pieces, else a new one.
    let pc = hands.pieces.find((p) => (d.part !== undefined && p.part === d.part) || (d.token !== undefined && p.token === d.token)); // prettier-ignore
    const driven = d.type === "hinge" || d.type === "slider" || d.type === "dial";
    if (!pc) {
      const pos = (d.pos || d.pivot || [0, 0, 0]).slice();
      const pick = d.pick || [0.3, 0.3, 0.3];
      const solid = d.solid || null;
      const body = this.world.add(new Body({ pos, mass: d.mass ?? 1, solid, points: d.points || (solid ? surfacePoints(solid, 1) : []), friction: d.friction ?? 0.8, restitution: d.restitution ?? 0.15, damping: d.damping ?? 0.3, angDamping: d.angDamping ?? 1.5 })); // prettier-ignore
      body.invMassFree = body.invMass;
      body.invIFree = body.invI.slice();
      body.pinned = true;
      body.invMass = 0;
      body.invI = [0, 0, 0];
      pc = { body, token: d.token, part: d.part, home: { pos: pos.slice(), q: ID.slice() }, def: { pivot: d.pivot, pick, solid } }; // prettier-ignore
      hands.pieces.push(pc);
    }
    const j = { d, name, type: d.type, pc, body: pc.body, v: 0, w: 0, held: null, broken: false, moving: false, parent: null, children: [] }; // prettier-ignore
    if (driven) {
      // A driven part is posed, never pushed: other pieces bump into it.
      j.body.invMass = 0;
      j.body.invI = [0, 0, 0];
      j.body.invMassFree = 0;
      j.body.invIFree = [0, 0, 0];
      j.axis = v3.norm(d.axis || [1, 0, 0]);
      j.pivot = (d.pivot || pc.home.pos).slice();
      j.min = d.min ?? (d.type === "dial" ? -Infinity : 0);
      j.max = d.max ?? (d.type === "dial" ? Infinity : d.type === "hinge" ? Math.PI / 2 : 0.5);
      j.stuck = !!d.stick;
      j.body.pinned = false; // posed, so always shown where it is
    }
    if (d.type === "socket") j.armed = false;
    if (d.type === "break") j.at = (d.at || pc.home.pos).slice();
    this.list.push(j);
    this.byName.set(name, j);
    if (d.part !== undefined) this.byName.set(d.part, j);
    return j;
  }

  link() {
    if (this.linked) return;
    this.linked = true;
    for (const j of this.list) {
      const to = j.d.parent ?? j.d.to;
      if (to === undefined || to === null) continue;
      const p = this.byName.get(to) || this.pieceJoint(to);
      if (p && p !== j) {
        j.parent = p;
        p.children.push(j);
      }
    }
    this.list.sort((a, b) => depth(a) - depth(b));
  }

  // A plain piece (not one of the joints) named as a parent: a stand-in
  // joint, so a part can hang on a loose piece and ride with it.
  pieceJoint(name) {
    const pc = this.hands.pieces.find((p) => p.part === name || p.token === name || `token${p.token}` === name); // prettier-ignore
    if (!pc) return null;
    const j = { d: {}, name, type: "piece", pc, body: pc.body, children: [], parent: null };
    this.byName.set(name, j);
    return j;
  }

  // ---- Where things are ----

  // The joint's own move (driven parts), in its parent's home frame.
  delta(j) {
    if (j.type === "slider") {
      let T = tf(ID, v3.scale(j.axis, j.v));
      if (j.wig) T = tfMul(T, turnAbout(j.pivot, v3.norm(j.d.wiggle), j.wig));
      return T;
    }
    if (j.type === "hinge" || j.type === "dial") return turnAbout(j.pivot, j.axis, j.v);
    return tf();
  }

  // The move from a joint's home frame to where it is now (its parents'
  // moves and its own).
  full(j) {
    if (j.type === "piece" || (j.type === "break" && !j.broken) || j.type === "socket") {
      if (j.type === "break" && !j.broken && j.parent) {
        return tfMul(this.full(j.parent), j.tug || tf());
      }
      if (j.type === "break" && !j.broken) return j.tug || tf();
      const b = j.body;
      const dq = quat.mul(b.q, quat.conj(j.pc.home.q));
      return tf(dq, v3.sub(b.pos, quat.rotate(dq, j.pc.home.pos)));
    }
    const own = this.delta(j);
    return j.parent ? tfMul(this.full(j.parent), own) : own;
  }

  // Puts a posed piece's body where its joint says.
  pose(j) {
    const T = this.full(j);
    const b = j.body;
    b.pos = tfApply(T, j.pc.home.pos);
    b.q = quat.norm(quat.mul(T.q, j.pc.home.q));
    b.prevPos = b.pos.slice();
    b.prevQ = b.q.slice();
  }

  posed(j) {
    if (j.type === "hinge" || j.type === "slider" || j.type === "dial") return true;
    return j.type === "break" && !j.broken;
  }

  glued(a, b) {
    for (const j of this.list) {
      if (j.type !== "break" || j.broken) continue;
      if ((j.body === a || j.body === b) && j.parent && (j.parent.body === a || j.parent.body === b)) return true; // prettier-ignore
    }
    return false;
  }

  joint(body) {
    return this.list.find((j) => j.body === body) || null;
  }

  // ---- The finger ----

  // A press picked `body` at recipe point hit (screen x, y). Returns true
  // when a joint takes the hold (Hands-on then leaves it to us).
  grab(body, hit, x, y) {
    this.link();
    const j = this.joint(body);
    if (!j) return false;
    if (j.type === "socket") {
      j.armed = false; // it clicks back only once it has been taken out
      j.gliding = null;
      return false;
    }
    if (j.type === "break" && j.broken) return false;
    if (!this.posed(j)) return false;
    const hands = this.hands;
    const T = this.full(j);
    const local = tfApply(tfInv(T), hit); // the grabbed point, at home
    const h = { body, ctl: j, x0: x, y0: y, travel: 0, trail: [], local, hit: hit.slice(), target: hit.slice() }; // prettier-ignore
    j.held = h;
    j.awake = true;
    j.start = j.v;
    if (j.type === "break") {
      j.pull = 0;
      j.tug = tf();
    }
    hands.hold = h;
    hands.homing = null;
    hands.press = null;
    hands.moved = true;
    this.world.wake();
    this.move(h, hands.ray(x, y));
    return true;
  }

  // The finger moved along `ray` (recipe coordinates). Returns true when
  // the hold is a joint's (the move is ours).
  move(h, ray) {
    const j = h.ctl;
    if (!j) {
      // A loose piece near its socket clicks in as the finger brings it.
      const sj = this.joint(h.body);
      if (sj?.type === "socket") this.nearSocket(sj, h, ray);
      return false;
    }
    if (j.type === "break") {
      this.tugTo(j, h, ray);
      return true;
    }
    const P = j.parent ? this.full(j.parent) : tf();
    const Pi = tfInv(P);
    const o = tfApply(Pi, ray.origin);
    const dir = tfDir(Pi, ray.dir);
    const cur = tfApply(this.delta(j), h.local); // the grabbed point now
    if (j.type === "slider") {
      // The point on the slider's line nearest the finger's ray.
      const a = j.axis;
      const w0 = v3.sub(cur, o);
      const b = v3.dot(a, dir);
      const den = 1 - b * b;
      if (den < 1e-4) return true;
      const s = (b * v3.dot(dir, w0) - v3.dot(a, w0)) / den;
      j.target = j.v + s;
      return true;
    }
    // Hinge and dial: the angle that brings the grabbed point nearest the
    // finger. Across the turning plane when it faces the view enough, else
    // on the plane facing the view through the grabbed point.
    const a = j.axis;
    const n = Math.abs(v3.dot(dir, a)) > 0.3 ? a : dir;
    const den = v3.dot(dir, n);
    if (Math.abs(den) < 1e-4) return true;
    const t = v3.dot(v3.sub(cur, o), n) / den;
    if (t <= 0) return true;
    const f = perp(v3.sub(v3.add(o, v3.scale(dir, t)), j.pivot), a);
    const g = perp(v3.sub(h.local, j.pivot), a);
    const lf = v3.len(f);
    const lg = v3.len(g);
    if (lf < 0.15 * lg || lg < 1e-6) return true;
    let ang = Math.atan2(v3.dot(v3.cross(g, f), a), v3.dot(g, f));
    // The same angle, nearest where the part is (a dial turns on and on).
    ang += TAU * Math.round((j.v - ang) / TAU);
    j.target = ang;
    return true;
  }

  // A piece not yet broken off: it bends a little toward the finger, as a
  // whole, about where it is fixed, and snaps off when pulled far enough.
  tugTo(j, h, ray) {
    const R = this.hands.R();
    const T0 = j.parent ? this.full(j.parent) : tf();
    const at = tfApply(T0, j.at);
    const grab = tfApply(T0, h.local);
    // The finger's point, on the plane facing the view through the grab.
    const n = ray.dir;
    const den = v3.dot(ray.dir, n);
    const t = v3.dot(v3.sub(grab, ray.origin), n) / den;
    const f = v3.add(ray.origin, v3.scale(ray.dir, Math.max(t, 0)));
    const pull = v3.sub(f, grab);
    const strength = (j.d.pull ?? 0.35) * R;
    j.pull = v3.len(pull) / strength;
    if (j.pull >= 1) {
      this.snap(j, h, f, ray.dir);
      return;
    }
    // Bend: about `at`, turning the grab toward the finger, up to `give`.
    const arm = v3.sub(grab, at);
    const ax = v3.cross(arm, pull);
    const la = v3.len(ax);
    const give = (j.d.give ?? 0.12) * Math.min(1, j.pull) ** 1.5;
    if (la < 1e-9) {
      j.tug = tf();
      return;
    }
    const axisHome = quat.rotate(quat.conj(T0.q), v3.scale(ax, 1 / la));
    j.tug = turnAbout(j.at, axisHome, give);
    this.world.wake();
  }

  // It snaps off: a loose body now, held by the finger the usual way.
  snap(j, h, f, dir) {
    const hands = this.hands;
    j.broken = true;
    const T = this.full(j);
    j.tug = null;
    const b = j.body;
    // Its pose as it was when it snapped (bent), then free.
    b.pos = tfApply(T, j.pc.home.pos);
    b.q = quat.norm(quat.mul(T.q, j.pc.home.q));
    b.prevPos = b.pos.slice();
    b.prevQ = b.q.slice();
    this.unglue(j);
    hands.free(b);
    b.invMass = b.invMassFree || 1;
    b.invI = (b.invIFree || [1, 1, 1]).slice();
    j.held = null;
    this.cue(j, "snap", 1.5);
    // The finger holds it where it grabbed it, as a pick-up does.
    const at = tfApply(T, h.local);
    const w = this.world;
    const joint = w.joint(b, b.toLocal(at), null, at, { compliance: 2e-6, damping: 0 });
    b.held = true;
    b.holdQ = null;
    b.angDampingFree ??= b.angDamping;
    b.angDamping = 1.2;
    hands.hold = { body: b, joint, place: false, plane: { point: at.slice(), normal: dir.slice() }, target: f.slice(), follow: at.slice(), followV: [0, 0, 0], trail: [], x0: h.x0, y0: h.y0, travel: h.travel, minY: -Infinity, raise: 0 }; // prettier-ignore
    w.wake();
  }

  // Release a joint's hold. Returns true when the hold was ours.
  release(h) {
    const j = h.ctl;
    if (!j) {
      const sj = this.joint(h.body);
      if (sj?.type === "socket" && sj.armed && this.socketNear(sj, h.body.pos, null)) {
        this.dropHold(h);
        this.glide(sj);
        return true;
      }
      return false;
    }
    j.held = null;
    if (j.type === "break") {
      // Not pulled hard enough: it springs back.
      j.springBack = { t0: this.time, from: j.tug || tf() };
      j.pull = 0;
    }
    // A flick sets a dial (or a lid) going: the finger's last speed.
    if (j.type === "dial" && j.d.coast === false) j.w = 0;
    this.hands.hold = null;
    this.world.wake();
    return true;
  }

  dropHold(h) {
    const b = h.body;
    if (h.joint) this.world.removeJoint(h.joint);
    b.held = false;
    b.holdQ = null;
    b.angDamping = b.angDampingFree ?? b.angDamping;
    this.hands.hold = null;
  }

  // ---- Sockets ----

  socketNear(j, pos, ray) {
    const R = this.hands.R();
    const snap = (j.d.snap ?? 0.3) * R;
    const home = j.pc.home.pos;
    let d = v3.len(v3.sub(pos, home));
    if (ray) {
      // Or the finger points at its place.
      const t = Math.max(0, v3.dot(v3.sub(home, ray.origin), ray.dir));
      d = Math.min(d, v3.len(v3.sub(v3.add(ray.origin, v3.scale(ray.dir, t)), home)));
    }
    return d < snap;
  }

  nearSocket(j, h, ray) {
    const R = this.hands.R();
    const snap = (j.d.snap ?? 0.3) * R;
    const away = v3.len(v3.sub(h.body.pos, j.pc.home.pos));
    if (!j.armed) {
      if (away > snap * 1.5) j.armed = true;
      return;
    }
    if (this.socketNear(j, h.body.pos, ray)) {
      this.dropHold(h);
      this.glide(j);
    }
  }

  glide(j) {
    const b = j.body;
    b.vel = [0, 0, 0];
    b.omega = [0, 0, 0];
    j.gliding = { t0: this.time, pos: b.pos.slice(), q: b.q.slice() };
    j.armed = false;
    this.world.wake();
  }

  // ---- Each step ----

  // One fixed step (seconds) before the world's. Returns true while
  // anything here moves.
  step(dt) {
    this.link();
    this.time += dt;
    let busy = false;
    if (this.upright) return this.rightStep(dt);
    const g = this.world.gravity;
    for (const j of this.list) {
      if (j.type === "socket") {
        if (j.gliding) busy = this.glideStep(j) || busy;
        continue;
      }
      if (j.type === "break") {
        const back = !!j.springBack;
        if (back) {
          const f = Math.min(1, (this.time - j.springBack.t0) / 0.18);
          const T = j.springBack.from;
          j.tug = tf(quat.slerp(T.q, ID, f), v3.scale(T.t, 1 - f));
          if (f >= 1) {
            j.springBack = null;
            j.tug = tf();
          }
          busy = true;
        }
        if (!j.broken && (j.held || back || this.moves(j.parent))) {
          this.pose(j);
          busy = busy || !!j.held;
        }
        continue;
      }
      if (j.type === "piece") continue;
      busy = this.drivenStep(j, dt, g) || busy;
    }
    this.follow();
    if (busy) {
      this.hands.moved = true;
      this.world.wake();
    }
    return busy;
  }

  moves(j) {
    if (!j) return false;
    if (j.type === "piece") return !j.body.pinned;
    if (j.type === "break") return !j.broken ? !!(j.held || j.springBack) || this.moves(j.parent) : !j.body.pinned; // prettier-ignore
    return !!j.moving || this.moves(j.parent);
  }

  drivenStep(j, dt, g) {
    const d = j.d;
    const v0 = j.v;
    const R = this.hands.R();
    if (j.held) {
      let target = j.target ?? j.v;
      if (j.stuck) {
        // Stuck fast (a sword in its stone): it wiggles as the finger pulls,
        // and comes free once pulled `stick` along its way.
        const pull = target - j.start;
        const stick = d.stick * R;
        const f = clamp(Math.abs(pull) / stick, 0, 1);
        j.wig = d.wiggle ? 0.05 * f * Math.sin(this.time * 38) : 0;
        if (Math.abs(pull) < stick || (d.stickWay && Math.sign(pull) !== Math.sign(d.stickWay))) {
          this.pose(j);
          for (const c of j.children) if (this.posed(c)) this.pose(c);
          j.moving = true;
          return true;
        }
        j.stuck = false;
        j.wig = 0;
        this.cue(j, "free", 1);
      }
      // The part catches the finger on a critically damped spring.
      const k = FOLLOW;
      const acc = k * k * (target - j.v) - 2 * k * j.w;
      j.w += acc * dt;
      j.v += j.w * dt;
    } else {
      if (j.stuck) {
        j.moving = false;
        return false;
      }
      // Nothing moves a part nobody has touched since ↺ (a part built off
      // its resting place stays as built).
      if (!j.awake) {
        if (this.moves(j.parent)) this.pose(j);
        return false;
      }
      let acc = 0;
      // Its weight: about a hinge, the turn gravity gives its middle; along a
      // slider, gravity along the line.
      // (A dial is balanced: no weight unless asked.)
      const gs = d.gravity === false ? 0 : d.gravity === true || (d.gravity === undefined && j.type !== "dial") ? 1 : d.gravity ?? 0; // prettier-ignore
      const P = j.parent ? this.full(j.parent) : tf();
      const gl = quat.rotate(quat.conj(P.q), g); // gravity in the parent's home frame
      if (gs && j.type === "slider") acc += gs * v3.dot(gl, j.axis);
      if (gs && j.type !== "slider") {
        const com = d.com || j.pc.home.pos;
        const r = perp(v3.sub(tfApply(this.delta(j), com), j.pivot), j.axis);
        const l2 = v3.dot(r, r);
        if (l2 > 1e-6) acc += (gs * v3.dot(v3.cross(r, gl), j.axis)) / l2;
      }
      if (d.spring) acc -= d.spring * (j.v - (d.rest ?? 0));
      const damp = d.damping ?? (j.type === "dial" ? 0 : 3);
      acc -= damp * j.w;
      // Clicks: near standing still, a dial settles into the nearest one.
      if (d.detents && Math.abs(j.w) < 3) {
        const step = TAU / d.detents;
        const near = Math.round(j.v / step) * step;
        acc -= 120 * (j.v - near) + 12 * j.w;
      }
      // Friction (a slider held in its stone, a stiff hinge): it stays put
      // unless pushed harder than this.
      const fr = (d.friction ?? 0) * (j.type === "slider" ? R : 1);
      if (fr > 0) {
        if (Math.abs(j.w) < fr * dt * 1.5 && Math.abs(acc) <= fr) {
          acc = 0;
          j.w = 0;
        } else acc -= Math.sign(j.w || acc) * fr;
      }
      j.w += acc * dt;
      // A dial's coast loses speed (`drag` per second).
      if (j.type === "dial") j.w *= Math.exp(-(d.drag ?? 0.8) * dt);
      j.v += j.w * dt;
    }
    // The stops.
    if (j.v < j.min || j.v > j.max) {
      const lim = j.v < j.min ? j.min : j.max;
      const speed = Math.abs(j.w) * this.reach(j);
      j.v = lim;
      if (!j.held && speed > 0.5 * R) this.cue(j, "stop", speed / R);
      j.w = j.held ? 0 : -j.w * (d.bounce ?? 0.2);
      if (Math.abs(j.w) * this.reach(j) < 0.3 * R) j.w = 0;
    }
    // Clicks as it passes each detent.
    if (d.detents) {
      const step = TAU / d.detents;
      const a = Math.floor(v0 / step + 0.5);
      const b = Math.floor(j.v / step + 0.5);
      if (a !== b) this.cue(j, "detent", Math.abs(j.w) * this.reach(j) / R, b); // prettier-ignore
    }
    if (d.turn && j.v !== v0) {
      const cues = d.turn(j.v, j.v - v0, this.hands.info) || null;
      if (cues) this.play(Array.isArray(cues) ? cues : [cues]);
    }
    const moving = !!j.held || Math.abs(j.w) > STILL || Math.abs(j.v - v0) > 1e-6;
    if (!moving) j.w = 0;
    if (moving || j.moving || this.moves(j.parent)) {
      this.pose(j);
      for (const c of j.children) if (this.posed(c)) this.pose(c);
    }
    j.moving = moving;
    return moving;
  }

  // How far the part reaches from its axis (to turn a turn rate into a
  // speed): its pick size, at least.
  reach(j) {
    if (j.type === "slider") return 1;
    const r = perp(v3.sub(j.pc.home.pos, j.pivot), j.axis);
    return Math.max(v3.len(r), ...(j.pc.def.pick || [0.2]));
  }

  glideStep(j) {
    const G = j.gliding;
    const b = j.body;
    const f = Math.min(1, (this.time - G.t0) / GLIDE);
    const e = f * f * (3 - 2 * f);
    b.pos = G.pos.map((v, i) => v + (j.pc.home.pos[i] - v) * e);
    b.q = quat.slerp(G.q, j.pc.home.q, e);
    b.vel = [0, 0, 0];
    b.omega = [0, 0, 0];
    b.prevPos = b.pos.slice();
    b.prevQ = b.q.slice();
    if (f < 1) return true;
    // Home: it locks in place, as built.
    b.goHome();
    this.pin(j);
    j.gliding = null;
    this.cue(j, "socket", 1);
    return true;
  }

  pin(j) {
    const b = j.body;
    b.pinned = true;
    const def = j.pc.def;
    if (def?.rest) {
      b.solid = def.rest;
      b.bound = boundOf(b);
    }
    b.invMass = 0;
    b.invI = [0, 0, 0];
  }

  // Level 1 (`hands.upright`): the toy turns back upright (only its tilt;
  // its turn about the upright stays), rocking as it goes.
  rightStep(dt) {
    const b = this.hands.body;
    if (!b || b.held) return false;
    const u = quat.rotate(quat.mul(b.q, quat.conj(b.home.q)), [0, 1, 0]);
    const ax = v3.cross(u, [0, 1, 0]);
    const s = v3.len(ax);
    const ang = Math.atan2(s, u[1]);
    if (ang < 0.01 && v3.len(b.omega) < 0.05) return false;
    const n = s > 1e-9 ? v3.scale(ax, 1 / s) : [0, 0, 0];
    const k = this.upright.k;
    const c = this.upright.damping;
    const w = b.omega;
    const wy = w[1];
    for (let i = 0; i < 3; i++) b.omega[i] += (k * ang * n[i] - c * (w[i] - (i === 1 ? wy : 0))) * dt; // prettier-ignore
    this.world.wake();
    this.hands.moved = true;
    return true;
  }

  // ---- ↺ ----

  // During ↺ (e: 0..1 eased): driven parts turn or slide home along their
  // own way (a lid swings shut, not cuts across). Returns true when this
  // body is ours to pose.
  home(b, e) {
    const j = this.joint(b);
    if (!j) return false;
    if (j.type === "hinge" || j.type === "slider" || j.type === "dial") {
      if (j.homeFrom === undefined || e < (j.homeE ?? 1)) j.homeFrom = j.v;
      j.homeE = e;
      // A dial goes the short way round to a turn that looks the same.
      let to = 0;
      if (j.type === "dial" && !Number.isFinite(j.min)) to = TAU * Math.round(j.homeFrom / TAU);
      j.v = j.homeFrom + (to - j.homeFrom) * e;
      j.w = 0;
      j.wig = 0;
      this.pose(j);
      return true;
    }
    if (j.type === "break" && !j.broken) {
      j.tug = j.tug ? tf(quat.slerp(j.tug.q, ID, e), v3.scale(j.tug.t, 1 - e)) : tf();
      // Riding a loose piece home: where that piece is on its way.
      const from = j.parent && this.hands.homing?.from.find((f) => f.b === j.parent.body);
      if (from) {
        const pb = j.parent.body;
        const pos = from.pos.map((v, i) => v + (pb.home.pos[i] - v) * e);
        const dq = quat.mul(quat.slerp(from.q, pb.home.q, e), quat.conj(pb.home.q));
        const T = tfMul(tf(dq, v3.sub(pos, quat.rotate(dq, pb.home.pos))), j.tug);
        b.pos = tfApply(T, j.pc.home.pos);
        b.q = quat.norm(quat.mul(T.q, j.pc.home.q));
        return true;
      }
      this.pose(j);
      return true;
    }
    return false;
  }

  // ↺ is done: every part home, everything broken mended.
  reset() {
    for (const j of this.list) {
      j.held = null;
      if (j.type === "hinge" || j.type === "slider" || j.type === "dial") {
        j.v = 0;
        j.w = 0;
        j.wig = 0;
        j.moving = false;
        j.stuck = !!j.d.stick;
        j.awake = false;
        j.homeFrom = undefined;
        j.homeE = undefined;
        this.pose(j);
        j.body.pinned = false;
        j.body.invMass = 0;
        j.body.invI = [0, 0, 0];
      }
      if (j.type === "break") {
        this.unglue(j);
        j.broken = false;
        j.tug = tf();
        j.springBack = null;
      }
      if (j.type === "socket") {
        j.gliding = null;
        j.armed = false;
      }
    }
  }

  // A hit from the world (Hands-on's onHit): a knock hard enough breaks a
  // piece off whatever it hangs on.
  hit(hit) {
    const R = this.hands.R();
    for (const j of this.list) {
      if (j.type !== "break" || j.broken || !j.d.knock || !j.parent) continue;
      if (hit.body !== j.parent.body && hit.other !== j.parent.body) continue;
      if (hit.speed / R < j.d.knock) continue;
      const b = j.body;
      const pb = j.parent.body;
      j.broken = true;
      this.unglue(j);
      this.hands.free(b);
      b.invMass = b.invMassFree || 1;
      b.invI = (b.invIFree || [1, 1, 1]).slice();
      b.vel = pb.vel.slice();
      b.omega = pb.omega.slice();
      this.cue(j, "snap", hit.speed / R);
    }
  }

  // While a piece hangs on a loose piece, its collision points ride on that
  // piece (so the pair lands as one); they go when it breaks off.
  glue(j) {
    const pb = j.parent?.body;
    if (!pb || j.gluedTo) return;
    const b = j.body;
    const pts = (b.points.length ? b.points : b.solid ? surfacePoints(b.solid, 1) : []).map((p) => pb.toLocal(b.toWorld(p))); // prettier-ignore
    j.gluedTo = { body: pb, from: pb.points.length, n: pts.length, radius: pb.radius };
    pb.points.push(...pts);
    pb.bound = boundOf(pb);
  }

  unglue(j) {
    const G = j.gluedTo;
    if (!G) return;
    G.body.points.splice(G.from, G.n);
    G.body.bound = boundOf(G.body);
    for (const o of this.list) if (o.gluedTo?.body === G.body && o.gluedTo.from > G.from) o.gluedTo.from -= G.n; // prettier-ignore
    j.gluedTo = null;
  }

  // Each frame, after the world's steps: unbroken pieces ride on loose
  // parents, which carry their collision points.
  follow() {
    for (const j of this.list) {
      if (j.type !== "break" || j.broken || !j.parent) continue;
      if (this.moves(j.parent)) {
        this.glue(j);
        this.pose(j);
      } else if (j.gluedTo && j.parent.body.pinned) this.unglue(j);
    }
  }

  // Parts that ride on a joint without being pieces (`also`): a recipe
  // adds them to the parts Hands-on sends (an aura that rises with the
  // sword, a dancer turned by the crank).
  parts(parts) {
    let out = parts;
    for (const j of this.list) {
      if (!j.d.also || j.v === undefined) continue;
      out ||= {};
      j.d.also(j.v, out, this.hands.info);
    }
    return out;
  }

  // ---- Sounds ----

  // An event: the joint's own `sound(ev)` picks a cue (null: silent), else
  // a quiet default for its kind.
  cue(j, kind, speed, n) {
    const ev = { kind, joint: j.name, speed, n, t: this.time };
    this.events.push(ev);
    if (this.events.length > 200) this.events.shift();
    const vol = Math.min(0.8, Math.max(0.15, speed / 6));
    let spec = j.d.sound ? j.d.sound(ev, vol) : undefined;
    if (spec === undefined) spec = DEFAULT_SOUND[kind]?.(vol) ?? null;
    if (spec) this.play([spec]);
  }

  play(specs) {
    const p = this.hands.player;
    if (!p.frozen) p.emit?.("cue", specs);
  }

  // For tests and clips: each joint's value and state.
  state() {
    return this.list.map((j) => ({ name: j.name, type: j.type, v: j.v ?? null, w: j.w ?? null, broken: !!j.broken, held: !!j.held, stuck: !!j.stuck, pinned: !!j.body.pinned, pos: j.body.pos.slice(), home: j.pc.home.pos.slice() })); // prettier-ignore
  }
}

const DEFAULT_SOUND = {
  stop: (vol) => ({ voice: "thud", vol }),
  detent: (vol) => ({ voice: "click", vol: 0.3 + 0.3 * Math.min(1, vol) }),
  snap: (vol) => ({ voice: "crack", vol: Math.max(0.4, vol) }),
  socket: () => ({ voice: "click", vol: 0.5 }),
  free: () => ({ voice: "scrape", vol: 0.4 }),
};

function depth(j) {
  let n = 0;
  for (let p = j.parent; p && n < 16; p = p.parent) n++;
  return n;
}

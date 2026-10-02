// Hands-on play (lane Physics): with the ✋ switch on, a drag on the toy
// picks up what is under the finger and a quick let-go tosses it; it lands,
// bounces and settles on the floor under the toy, inside an invisible play
// area, and soft toys squish when they land. ↺ sends everything home.
//
// Two ways a toy plays:
// - Level 1, every toy (scans included): the whole toy is one rigid body,
//   shaped by points on its outside (taken from its splats). Its pose moves
//   the toy's entity (Stage.setToyPose), so splats sort and taps land
//   where it lies; a squish is two uniforms (uSpBodyS, uSpBodyP).
// - Pieces: a kit recipe's `hands` (below) names pieces (its tokens) that
//   are bodies of their own; they stay put until picked up or knocked.
//
// A recipe's `hands`: { pieces(data) => [{ token, pos, quat, solid, points,
// mass, friction, restitution }], floor (y), area (half width), grip,
// gravity (in toy radii per second squared), sound(hit) => cue | null }.
// `handsOn: true | false` on a recipe starts the switch on, or keeps the
// toy out of Hands-on (a picture toy). Pure JavaScript, no DOM.

import { World, Body, boundOf, quat, v3 } from "./world.js";

// How much a toy squishes when it lands (0: not at all) and how much it
// bounces. Anything not listed is solid and bounces a little.
export const SOFT = {
  jelly: 1, "gummy-bear": 1, amoeba: 1, blob: 0.8, "balloon-dog": 0.6, "soap-bubbles": 0.8,
  "beach-ball": 0.5, "bouncy-ball": 0.55, jellyfish: 0.8, octopus: 0.6, pufferfish: 0.5,
  "red-blood-cell": 0.6, "white-blood-cell": 0.6, bacterium: 0.5, paramecium: 0.5,
  "animal-cell": 0.4, tardigrade: 0.4, brain: 0.4, lungs: 0.4, heart: 0.4, kidney: 0.3,
  "teddy-bear": 0.4, hoodie: 0.6, dodgeball: 0.4, "medicine-ball": 0.2, "tennis-ball": 0.3,
  "squash-ball": 0.4, "soccer-ball": 0.3, basketball: 0.25, volleyball: 0.3,
  "water-polo-ball": 0.3, "rubber-duck": 0.4, "rubber-duck-real": 0.4, donut: 0.3, pizza: 0.3,
  burger: 0.3, sushi: 0.2, taco: 0.2, cupcake: 0.3, "ice-cream": 0.3, pancakes: 0.3,
  croissant: 0.2, "croissant-real": 0.2, "birthday-cake": 0.2, "carrot-cake": 0.2,
  strawberry: 0.15, raspberry: 0.2, blackberry: 0.2, grape: 0.3, tomatoes: 0.2, banana: 0.15,
  cherries: 0.2, grapes: 0.2, snail: 0.4, frog: 0.4, starfish: 0.3, "baseball-cap": 0.3,
  "running-shoe": 0.2, kite: 0.2, macarons: 0.15, "paper-lantern": 0.2,
}; // prettier-ignore

export const BOUNCE = {
  "bouncy-ball": 0.85, "ping-pong-ball": 0.8, basketball: 0.75, "tennis-ball": 0.7,
  "golf-ball": 0.7, "beach-ball": 0.6, "soccer-ball": 0.65, volleyball: 0.65,
  "water-polo-ball": 0.6, dodgeball: 0.6, "lacrosse-ball": 0.65, "squash-ball": 0.35,
  "pool-ball": 0.5, marble: 0.5, baseball: 0.5, softball: 0.45, "cricket-ball": 0.5,
  pickleball: 0.5, "rugby-ball": 0.5, "american-football": 0.5, "bowling-ball": 0.15,
  "medicine-ball": 0.1, "hockey-puck": 0.2, "soap-bubbles": 0.5, "balloon-dog": 0.5,
}; // prettier-ignore

// Toys that are hands-on already: their own drags keep working, and the
// switch starts on for them.
export function ownHands(recipe) {
  return !!(recipe?.drag || recipe?.grab);
}

// Whether a toy plays in Hands-on at all (a picture toy keeps its pages).
export function canPlay(info) {
  const r = info?.recipe;
  if (!info || r?.handsOn === false) return false;
  if (r?.pictures || r?.turntable === false) return false;
  return true;
}

const PRESS_MOVE = 7; // CSS pixels before a press becomes a pick-up
const GRAVITY = 26; // toy radii per second squared
const HOME_SECS = 0.45;

export class HandsOn {
  // player: the Player (stage, camera, toyInfo, ray, proc).
  constructor(player) {
    this.player = player;
    this.on = false;
    this.world = null;
    this.mode = null; // "toy" | "pieces"
    this.body = null; // Level 1: the toy's body
    this.pieces = []; // pieces mode: { body, token, home }
    this.hold = null; // { body, joint, plane, target }
    this.press = null; // { world, x, y }
    this.squish = null; // { amp, t0, axis, point, soft }
    this.homing = null; // { t0, from: [{ body, pos, q }] }
    this.moved = false; // anything off home
    this.time = 0;
    this.lastResort = 0;
    this.sounds = []; // hits for the app to play: { speed, soft, piece }
  }

  // A new toy: everything back to how it was built.
  attach(info) {
    this.clear();
    this.info = info;
    this.on = canPlay(info) && (ownHands(info?.recipe) || info?.recipe?.handsOn === true);
  }

  clear() {
    this.world = null;
    this.mode = null;
    this.body = null;
    this.pieces = [];
    this.hold = null;
    this.press = null;
    this.squish = null;
    this.homing = null;
    this.moved = false;
    this.player.stage.setToyPose?.(null);
    this.player.motion.handsTokens = null;
    this.player.motion.handsParts = null;
  }

  // Pieces live in the recipe's own coordinates (a kit toy is centred and
  // scaled to fit); the whole toy lives in the world.
  units() {
    const tf = this.mode === "pieces" ? this.player.motion.ctx?.transform : null;
    return tf?.scale || 1;
  }

  R() {
    return this.info.radius / this.units();
  }

  ray(x, y) {
    return this.mode === "pieces" ? this.player.recipeRay(x, y) : this.player.stage.ray(x, y);
  }

  get own() {
    return ownHands(this.info?.recipe);
  }

  setOn(on) {
    this.on = !!on && canPlay(this.info);
    if (!this.on) this.reset();
  }

  // Whether a toy's own drags work (the laptop's trackpad, the gummy
  // bear's stretch): with the switch on, or on a toy Hands-on leaves alone.
  ownDrags() {
    return this.on || !canPlay(this.info);
  }

  // True while a drag on the toy should pick it (or a piece) up.
  canGrab() {
    return this.on && !this.own && canPlay(this.info);
  }

  // ---- The world ----

  // Built on the first pick-up, so opening a toy costs nothing.
  ensure() {
    if (this.world) return this.world;
    const info = this.info;
    const R = info.radius;
    const hands = info.recipe?.hands;
    if (hands?.pieces) return this.buildPieces(hands);
    const hull = this.hull();
    const g = (hands?.gravity ?? GRAVITY) * R;
    const w = new World({ gravity: [0, -g, 0], substeps: 8, sleepSpeed: 0.03 * R, minHit: 0.6 * R, maxSpeed: 12 * R }); // prettier-ignore
    const floor = hull.floor;
    w.plane([0, 1, 0], floor, { friction: 0.7, restitution: 0.3 });
    const A = hull.reach * 1.05 + 0.4 * R;
    const c = hull.center;
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) // prettier-ignore
      w.plane([nx, 0, nz], nx * (c[0] - nx * A) + nz * (c[2] - nz * A), { friction: 0.3, restitution: 0.4 }); // prettier-ignore
    w.plane([0, -1, 0], -(floor + Math.max(4.5 * R, hull.top - floor + 2.5 * R)), { restitution: 0.2 }); // prettier-ignore
    const id = info.id;
    const soft = SOFT[id] ?? 0;
    const bounce = BOUNCE[id] ?? 0.25 + 0.2 * soft;
    const h = hull.half;
    const m = 1;
    const opts = {
      pos: c.slice(),
      mass: m,
      inertia: [(m * (h[1] ** 2 + h[2] ** 2)) / 3, (m * (h[0] ** 2 + h[2] ** 2)) / 3, (m * (h[0] ** 2 + h[1] ** 2)) / 3], // prettier-ignore
      friction: 0.6,
      restitution: bounce,
      damping: 0.15,
      angDamping: 0.6,
    };
    // A ball rolls on one point; anything else rests on the points of its
    // outside.
    if (hull.round) opts.solid = { type: "sphere", r: hull.round };
    else opts.points = hull.points;
    this.body = w.add(new Body(opts));
    this.soft = soft;
    this.mode = "toy";
    this.world = w;
    return w;
  }

  // Points on the toy's outside (world, about its middle), from a sample of
  // its splats: in each of 64 directions, the splat furthest out, ignoring
  // the last half percent (floaters).
  hull() {
    const info = this.info;
    const stage = this.player.stage;
    const res = stage.toy?.entity?.gsplat?.resource || stage.toy?.resource;
    const centers = res?.centers;
    const R = info.radius;
    const n = centers ? Math.floor(centers.length / 3) : 0;
    const count = Math.min(n, res?.numSplats || n);
    const sample = Math.min(count, 6000);
    const pts = [];
    if (sample > 8) {
      const step = count / sample;
      for (let i = 0; i < sample; i++) {
        const j = Math.floor(i * step) * 3;
        pts.push(stage.modelToWorld([centers[j], centers[j + 1], centers[j + 2]]));
      }
    } else {
      // No centres to read: the toy's box.
      const c = info.center;
      for (const sx of [-1, 1])
        for (const sy of [-1, 1])
          for (const sz of [-1, 1])
            pts.push([c[0] + sx * info.half[0], c[1] + sy * info.half[1], c[2] + sz * info.half[2]]); // prettier-ignore
    }
    // Its middle: halfway across the trimmed extent on each axis.
    const lo = [];
    const hi = [];
    for (let k = 0; k < 3; k++) {
      const a = pts.map((p) => p[k]).sort((x, y) => x - y);
      lo.push(a[Math.floor(a.length * 0.01)]);
      hi.push(a[Math.min(a.length - 1, Math.floor(a.length * 0.99))]);
    }
    const center = lo.map((v, k) => (v + hi[k]) / 2);
    const dirs = fibonacci(64);
    const out = [];
    for (const d of dirs) {
      const proj = pts.map((p) => (p[0] - center[0]) * d[0] + (p[1] - center[1]) * d[1] + (p[2] - center[2]) * d[2]); // prettier-ignore
      const sorted = proj.slice().sort((x, y) => x - y);
      const cut = sorted[Math.max(0, Math.floor(sorted.length * 0.995) - 1)];
      let best = 0;
      let bd = Infinity;
      for (let i = 0; i < proj.length; i++) {
        const e = Math.abs(proj[i] - cut);
        if (e < bd) {
          bd = e;
          best = i;
        }
      }
      out.push(v3.sub(pts[best], center));
    }
    // Round enough to roll (a ball)?
    const dist = out.map((p) => v3.len(p));
    const mean = dist.reduce((a, b) => a + b, 0) / dist.length;
    const spread = Math.max(...dist.map((d) => Math.abs(d - mean))) / mean;
    const floor = Math.min(...out.map((p) => p[1])) + center[1];
    return {
      center,
      points: out,
      floor,
      top: Math.max(...out.map((p) => p[1])) + center[1],
      reach: Math.max(...dist),
      half: hi.map((v, k) => Math.max(1e-3 * R, (v - lo[k]) / 2)),
      round: spread < 0.09 ? mean : 0,
    };
  }

  buildPieces(hands) {
    const info = this.info;
    this.mode = "pieces";
    const R = this.R();
    const data = this.player.proc?.ctx?.kit?.data;
    const g = (hands.gravity ?? GRAVITY) * R;
    const w = new World({ gravity: [0, -g, 0], substeps: hands.substeps ?? 10, sleepSpeed: 0.02 * R, minHit: 0.35 * R, maxPush: 0.01 * R, maxSpeed: 10 * R }); // prettier-ignore
    w.plane([0, 1, 0], hands.floor ?? 0, { friction: hands.friction ?? 0.9, restitution: 0.15, grip: hands.grip ?? 0 }); // prettier-ignore
    const A = (hands.area ?? 1.6) * R;
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) // prettier-ignore
      w.plane([nx, 0, nz], -A, { friction: 0.3, restitution: 0.3 });
    this.pieces = [];
    for (const p of hands.pieces(data, info) || []) {
      const body = new Body({
        pos: p.pos,
        quat: p.quat || [0, 0, 0, 1],
        mass: p.mass ?? 1,
        solid: p.solid,
        points: p.points || [],
        radius: p.radius ?? 0,
        friction: p.friction ?? 0.8,
        restitution: p.restitution ?? 0.15,
        damping: p.damping ?? 0.3,
        angDamping: p.angDamping ?? 1.5,
      });
      w.add(body);
      this.pieces.push({ body, token: p.token, part: p.part, home: { pos: p.pos.slice(), q: (p.quat || [0, 0, 0, 1]).slice() }, def: p }); // prettier-ignore
      // A piece on a stem (a cherry): pinned to its point, springing back
      // to how it hung.
      if (p.joint)
        w.joint(body, body.toLocal(p.joint), null, p.joint, { length: p.jointLength ?? 0 });
      if (p.spring) {
        body.restQ = body.q.slice();
        body.restK = p.spring;
      }
      if (p.hinge) body.hinge = { axis: v3.norm(p.hinge), q: body.q.slice() };
      body.invMassFree = body.invMass;
      body.invIFree = body.invI.slice();
      if (p.free) continue;
      // Pieces stay where they were built until picked up or knocked hard
      // (a heap of pebbles that was never balanced doesn't slump by itself).
      body.pinned = true;
      // While it lies where it was built it is ground for others, in its
      // full shape (`rest`, else its solid).
      if (p.rest) {
        body.solid = p.rest;
        body.bound = boundOf(body);
      }
      body.invMass = 0;
      body.invI = [0, 0, 0];
    }
    // Pairs that overlapped when one of them came loose pass through each
    // other until they have come apart (a heap built for looks has stones
    // sunk into each other: pushed apart, they would stand on edge).
    this.passing = new Set();
    const key = (a, b) => (a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`);
    this.pairKey = key;
    w.pairs = (a, b) =>
      !(a.pinned && b.pinned) && !a.held && !b.held && !this.passing.has(key(a, b));
    this.mode = "pieces";
    this.world = w;
    return w;
  }

  free(body) {
    if (!body.pinned) return;
    body.pinned = false;
    const def = this.pieces.find((pc) => pc.body === body)?.def;
    if (def?.rest) {
      body.solid = def.solid;
      body.bound = boundOf(body);
    }
    body.invMass = body.invMassFree;
    body.invI = body.invIFree.slice();
    for (const pc of this.pieces) {
      const b = pc.body;
      // (Sunk in, not just resting on each other.)
      if (b !== body && b.pinned && this.world.touching(body, b, 0.04 * this.R())) this.passing.add(this.pairKey(body, b)); // prettier-ignore
    }
  }

  // ---- The finger ----

  // A press on the toy at world point `hit` (screen x, y). Returns true
  // when it is something Hands-on picks up (the drag is then ours).
  pressAt(hit, x, y) {
    if (!this.canGrab()) return false;
    this.press = { hit: hit.slice(), x, y };
    return true;
  }

  // The finger moved (screen x, y). The first move past a few pixels picks
  // the thing up; after that it follows.
  moveTo(x, y) {
    const pr = this.press;
    if (pr && !this.hold) {
      if (Math.hypot(x - pr.x, y - pr.y) < PRESS_MOVE) return;
      this.pickUp(pr.hit, pr.x, pr.y);
    }
    const h = this.hold;
    if (!h) return;
    const ray = this.ray(x, y);
    if (h.place) {
      this.placeAt(h, ray);
      this.world.wake();
      return;
    }
    const n = h.plane.normal;
    const den = v3.dot(ray.dir, n);
    if (Math.abs(den) < 1e-4) return;
    const t = v3.dot(v3.sub(h.plane.point, ray.origin), n) / den;
    if (t < 0) return;
    let p = v3.add(ray.origin, v3.scale(ray.dir, t));
    // Keep the finger's point inside the play area, above the floor.
    const R = this.R();
    const fl = this.world.planes[0].d;
    p[1] = Math.max(p[1], fl + 0.05 * R);
    p[1] = Math.min(p[1], fl + 5 * R);
    const lim = this.mode === "pieces" ? (this.info.recipe.hands.area ?? 1.6) * R : 1.6 * R;
    const c = this.body ? this.body.home.pos : [0, 0, 0];
    p[0] = Math.max(c[0] - lim, Math.min(c[0] + lim, p[0]));
    p[2] = Math.max(c[2] - lim, Math.min(c[2] + lim, p[2]));
    h.target = p;
    this.world.wake();
  }

  pickUp(hit, x, y) {
    const w = this.ensure();
    this.homing = null;
    let body = this.body;
    if (this.mode === "pieces") {
      hit = this.player.toRecipe(hit);
      body = this.pieceAt(hit);
      if (!body) {
        this.press = null;
        return;
      }
      this.free(body);
    }
    const ray = this.ray(x, y);
    // Pieces are picked and placed: held by the middle, turned level (only
    // their turn about the upright stays), hovering just above whatever is
    // under the finger, so letting go sets one down on a stack.
    const place = this.mode === "pieces" && this.info.recipe.hands.place !== false;
    const la = place ? [0, 0, 0] : body.toLocal(hit);
    const at = place ? body.pos.slice() : hit;
    const joint = w.joint(body, la, null, at, { compliance: 0, damping: 0 });
    body.held = true;
    const def = this.pieces.find((pc) => pc.body === body)?.def;
    body.holdQ = place ? yawOnly(body.q) : def?.joint ? null : body.q.slice();
    body.holdK = 10;
    body.angDampingFree ??= body.angDamping;
    body.angDamping = 7; // held, it hangs calmly from the finger
    this.hold = { body, joint, place, plane: { point: hit.slice(), normal: ray.dir.slice() }, target: at.slice(), follow: at.slice() }; // prettier-ignore
    if (place) {
      // Lifted first, then it follows the finger.
      this.hold.lift = this.time;
      this.placeAt(this.hold, ray);
    }
    this.moved = true;
    this.press = null;
    w.wake();
  }

  // Where a held piece hovers: over the first thing the finger's ray meets
  // (another piece, as an ellipsoid of its `pick` radii, or the floor), its
  // underside a little above it.
  placeAt(h, ray) {
    const R = this.R();
    const b = h.body;
    const fl = this.world.planes[0].d;
    let best = Infinity;
    let top = fl;
    let n = [0, 1, 0];
    for (const pc of this.pieces) {
      const o = pc.body;
      if (o === b) continue;
      const r = pc.def.pick || [o.bound, o.bound, o.bound];
      const t = rayEllipsoid(o, r, ray);
      if (t < best) {
        best = t;
        const p = v3.add(ray.origin, v3.scale(ray.dir, t));
        top = p[1];
        n = p;
      }
    }
    const lim = (this.info.recipe.hands.area ?? 1.6) * R;
    const tf = ray.dir[1] < -1e-4 ? (fl - ray.origin[1]) / ray.dir[1] : Infinity;
    const pf = tf < Infinity ? v3.add(ray.origin, v3.scale(ray.dir, tf)) : null;
    const inside = pf && Math.abs(pf[0]) <= lim && Math.abs(pf[2]) <= lim;
    let p;
    if (tf < best && inside) {
      p = pf;
      top = fl;
    } else if (best < Infinity) p = n;
    else {
      // Over nothing (the finger is up in the air): it hangs where the
      // finger's line passes the piece's own upright.
      const c = b.pos;
      const d = [ray.dir[0], 0, ray.dir[2]];
      const dd = v3.dot(d, d) || 1;
      const t = -((ray.origin[0] - c[0]) * d[0] + (ray.origin[2] - c[2]) * d[2]) / dd;
      p = v3.add(ray.origin, v3.scale(ray.dir, t));
      h.target = [Math.max(-lim, Math.min(lim, p[0])), Math.max(fl + 0.1 * R, Math.min(fl + 5 * R, p[1])), Math.max(-lim, Math.min(lim, p[2]))]; // prettier-ignore
      return;
    }
    const def = this.pieces.find((pc) => pc.body === b)?.def;
    const below = def?.pick ? def.pick[1] : b.bound;
    // What is right under it there: straight down from above, at its
    // middle and four points round its footprint.
    const foot = def?.pick ? 0.6 * Math.min(def.pick[0], def.pick[2]) : 0.5 * b.bound;
    // A recipe may snap it onto the piece below (a brick onto the studs).
    const snap = this.info.recipe.hands.snap;
    const under = (at) => {
      let y = fl;
      let who = null;
      const spots = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]; // prettier-ignore
      for (const [dx, dz] of spots) {
        const o = [at[0] + dx * foot, fl + 6 * R, at[2] + dz * foot];
        for (const pc of this.pieces) {
          if (pc.body === b) continue;
          const r = pc.def.pick || [pc.body.bound, pc.body.bound, pc.body.bound];
          const t = rayEllipsoid(pc.body, r, { origin: o, dir: [0, -1, 0] });
          if (t < Infinity && o[1] - t > y) {
            y = o[1] - t;
            who = pc;
          }
        }
      }
      return { y, who };
    };
    let u = under(p);
    // A recipe's `center` (0..1) draws it toward the middle of the piece
    // under it (a hand sets a stone on a stone, not on its edge).
    const pull = this.info.recipe.hands.center ?? 0;
    if (pull && u.who) {
      const c = u.who.body.pos;
      p = [p[0] + (c[0] - p[0]) * pull, p[1], p[2] + (c[2] - p[2]) * pull];
      u = under(p);
    }
    if (snap && u.who) {
      const me = this.pieces.find((pc) => pc.body === b);
      const r = snap({ held: me, under: u.who, at: p.slice() });
      if (r) {
        p = r.at;
        if (r.quat) b.holdQ = r.quat;
        u = under(p);
      }
    }
    top = u.y;
    const y = top + below + (this.info.recipe.hands.lift ?? 0.06 * R);
    h.target = [Math.max(-lim, Math.min(lim, p[0])), Math.min(fl + 5 * R, y), Math.max(-lim, Math.min(lim, p[2]))]; // prettier-ignore
  }

  // The piece under a point: the one whose shape (the piece's `pick`
  // radii, an ellipsoid about its middle, else its reach) it is nearest
  // to, measured in that shape's own size.
  pieceAt(p) {
    let best = null;
    let bd = Infinity;
    for (const pc of this.pieces) {
      const b = pc.body;
      const l = b.toLocal(p);
      const r = pc.def.pick || [b.bound, b.bound, b.bound];
      const d = Math.hypot(l[0] / r[0], l[1] / r[1], l[2] / r[2]);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return bd < 1.6 ? best : null;
  }

  // Lets go: whatever it was holding flies on with the finger's speed.
  release() {
    const h = this.hold;
    this.press = null;
    if (!h) return false;
    this.world.removeJoint(h.joint);
    h.body.held = false;
    h.body.holdQ = null;
    h.body.angDamping = h.body.angDampingFree ?? h.body.angDamping;
    // Not too wild a throw.
    const R = this.R();
    const max = 9 * R;
    const sp = v3.len(h.body.vel);
    if (sp > max) h.body.vel = v3.scale(h.body.vel, max / sp);
    // A piece being placed is set down, not thrown.
    if (h.place) {
      h.body.vel = [0, Math.min(0, h.body.vel[1]), 0];
      h.body.omega = [0, 0, 0];
      this.hold = null;
      this.world.wake();
      return true;
    }
    // A thrown thing turns a little the way it flies.
    const fwd = v3.cross([0, 1, 0], h.body.vel);
    h.body.omega = v3.add(h.body.omega, v3.scale(fwd, 0.25 / Math.max(h.body.bound, 0.2 * R)));
    const wmax = 14;
    const ws = v3.len(h.body.omega);
    if (ws > wmax) h.body.omega = v3.scale(h.body.omega, wmax / ws);
    this.hold = null;
    this.world.wake();
    return true;
  }

  get holding() {
    return !!this.hold;
  }

  // ↺: everything glides home.
  reset() {
    this.press = null;
    if (this.hold) this.release();
    if (!this.world || !this.moved) return false;
    const bodies = this.mode === "toy" ? [this.body] : this.pieces.map((p) => p.body);
    this.homing = { t0: this.time, from: bodies.map((b) => ({ b, pos: b.pos.slice(), q: b.q.slice() })) }; // prettier-ignore
    this.squish = null;
    return true;
  }

  // ---- Each frame ----

  // Advances the world by dt and puts the result on the toy. Returns true
  // while anything moves.
  step(dt) {
    this.time += dt;
    const w = this.world;
    if (!w) return false;
    let busy = false;
    const h = this.hold;
    if (h) {
      // The held point eases after the finger (a smooth throw).
      const k = 1 - Math.exp(-dt / 0.03);
      h.follow = h.follow.map((v, i) => v + (h.target[i] - v) * k);
      h.joint.lb = h.follow.slice();
      busy = true;
    }
    if (this.homing) {
      const f = Math.min(1, (this.time - this.homing.t0) / HOME_SECS);
      const e = f * f * (3 - 2 * f);
      for (const { b, pos, q } of this.homing.from) {
        b.pos = pos.map((v, i) => v + (b.home.pos[i] - v) * e);
        b.q = quat.slerp(q, b.home.q, e);
        b.vel = [0, 0, 0];
        b.omega = [0, 0, 0];
      }
      busy = true;
      if (f >= 1) {
        for (const { b } of this.homing.from) {
          b.goHome();
          if (this.mode === "pieces" && !b.pinned) {
            b.pinned = true;
            const def = this.pieces.find((pc) => pc.body === b)?.def;
            if (def?.rest) {
              b.solid = def.rest;
              b.bound = boundOf(b);
            }
            b.invMass = 0;
            b.invI = [0, 0, 0];
          }
        }
        this.homing = null;
        this.moved = false;
        this.passing?.clear();
        w.asleep = true;
      }
    } else {
      // Slow frames catch up in steps of at most 1/60 s (up to 0.1 s a
      // frame), so a toss plays at its real speed on a slow phone too.
      let left = Math.min(dt, 0.1);
      while (left > 1e-6) {
        const d = Math.min(left, 1 / 60);
        if (w.step(d)) busy = true;
        left -= d;
      }
    }
    if (this.passing?.size) {
      const byId = new Map(this.pieces.map((pc) => [pc.body.id, pc.body]));
      for (const k of this.passing) {
        const [a, b] = k.split(":").map((v) => byId.get(Number(v)));
        if (!a || !b || !w.touching(a, b)) this.passing.delete(k);
      }
    }
    for (const hit of w.takeHits()) this.onHit(hit);
    if (this.squish) {
      const s = this.squish;
      const t = this.time - s.t0;
      if (t > 1.2) this.squish = null;
      else busy = true;
    }
    this.apply();
    return busy || !w.asleep;
  }

  onHit(hit) {
    const R = this.R();
    const speed = hit.speed / R;
    // A free piece that hits a pinned one knocks it loose.
    // (Not by the piece in the hand: it brushes past others as it goes.)
    if (this.mode === "pieces" && !hit.body?.held && !hit.other?.held) {
      if (hit.other?.pinned && speed > 2.5) this.free(hit.other);
      if (hit.body?.pinned && speed > 2.5) this.free(hit.body);
    }
    if (this.mode === "toy" && this.soft > 0 && speed > 0.8) {
      const amp = Math.min(0.45, this.soft * 0.08 * speed);
      if (!this.squish || amp > this.squishAmp()) {
        this.squish = { amp, t0: this.time, axis: hit.n.slice(), point: hit.point.slice() };
      }
    }
    this.sounds.push({ speed, soft: this.soft ?? 0, piece: this.mode === "pieces", body: hit.body }); // prettier-ignore
  }

  squishAmp() {
    const s = this.squish;
    if (!s) return 0;
    const t = this.time - s.t0;
    return s.amp * Math.exp(-4.5 * t) * Math.cos(12 * t);
  }

  // Puts the bodies' poses on the toy: the entity for Level 1, tokens for
  // pieces.
  apply() {
    const player = this.player;
    if (this.mode === "toy") {
      const b = this.body;
      const c = b.home.pos;
      const dq = quat.mul(b.q, quat.conj(b.home.q));
      const t = v3.sub(b.pos, c);
      const home = !this.moved && !this.homing;
      player.stage.setToyPose?.(home ? null : { pivot: c, q: dq, t });
      return;
    }
    if (this.mode === "pieces") {
      const out = [];
      for (const pc of this.pieces) {
        const b = pc.body;
        if ((b.pinned && !this.homing) || pc.token === undefined) continue;
        const dq = quat.mul(b.q, quat.conj(pc.home.q));
        out.push({ index: pc.token, token: { base: pc.home.pos, offset: v3.sub(b.pos, pc.home.pos), quat: dq } }); // prettier-ignore
      }
      player.motion.handsTokens = out.length ? out : null;
      // Pieces that are a recipe's parts (turned about the part's pivot).
      let parts = null;
      for (const pc of this.pieces) {
        if (!pc.part) continue;
        const b = pc.body;
        const dq = quat.mul(b.q, quat.conj(pc.home.q));
        const pv = pc.def.pivot || pc.home.pos;
        const off = v3.sub(v3.sub(b.pos, pv), quat.rotate(dq, v3.sub(pc.home.pos, pv)));
        (parts ||= {})[pc.part] = { quat: dq, offset: off };
      }
      player.motion.handsParts = this.moved || this.homing ? parts : null;
      // Sort the moved pieces again now and then (and once they rest).
      const asleep = this.world.asleep;
      if (out.length && (this.time - this.lastResort > 0.25 || (asleep && !this.restSorted))) {
        this.lastResort = this.time;
        this.restSorted = asleep;
        player.motion.handsResort = true;
      }
      if (!asleep) this.restSorted = false;
    }
  }

  // Where the view should drift (world offset), so a tossed toy stays in
  // sight on a narrow phone; null when it is home.
  follow() {
    if (this.mode !== "toy" || (!this.moved && !this.homing)) return null;
    const d = v3.sub(this.body.pos, this.body.home.pos);
    return [d[0] * 0.8, d[1] * 0.5, d[2] * 0.8];
  }

  // The squish, as the shader wants it (model space): { axis, amount,
  // pivot } or null.
  squishUniforms() {
    if (this.mode !== "toy" || !this.squish) return null;
    const s = this.squish;
    const amount = this.squishAmp();
    const stage = this.player.stage;
    const pivot = stage.worldToModel(s.point);
    const o = stage.worldToModel([0, 0, 0]);
    const a = stage.worldToModel(s.axis);
    const axis = v3.norm(v3.sub(a, o));
    return { axis, amount, pivot };
  }

  takeSounds() {
    const s = this.sounds;
    this.sounds = [];
    return s;
  }

  // For tests and clips: where the toy (or each piece) is.
  state() {
    const bodies = this.mode === "toy" ? [this.body] : this.pieces.map((p) => p.body);
    return {
      on: this.on,
      mode: this.mode,
      moved: this.moved,
      holding: !!this.hold,
      asleep: this.world ? this.world.asleep : true,
      bodies: bodies.filter(Boolean).map((b) => ({ pos: b.pos.slice(), q: b.q.slice(), home: b.home.pos.slice(), pinned: !!b.pinned })), // prettier-ignore
    };
  }
}

// A rotation's turn about the upright alone (a piece picked up level).
function yawOnly(q) {
  const f = quat.rotate(q, [1, 0, 0]);
  const a = Math.atan2(-f[2], f[0]);
  return quat.axisAngle([0, 1, 0], a);
}

// Where a ray first meets body o's ellipsoid of radii r (Infinity: never).
function rayEllipsoid(o, r, ray) {
  const lo = o.toLocal(ray.origin);
  const ld = quat.rotate(quat.conj(o.q), ray.dir);
  const p = [lo[0] / r[0], lo[1] / r[1], lo[2] / r[2]];
  const d = [ld[0] / r[0], ld[1] / r[1], ld[2] / r[2]];
  const a = v3.dot(d, d);
  const bb = 2 * v3.dot(p, d);
  const c = v3.dot(p, p) - 1;
  const disc = bb * bb - 4 * a * c;
  if (disc < 0) return Infinity;
  const t = (-bb - Math.sqrt(disc)) / (2 * a);
  return t > 0 ? t : Infinity;
}

// n directions spread evenly over the sphere.
function fibonacci(n) {
  const out = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    out.push([Math.cos(ga * i) * r, y, Math.sin(ga * i) * r]);
  }
  return out;
}

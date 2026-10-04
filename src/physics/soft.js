// Soft parts for Hands-on (lane Hands engine C): ropes and chains that hang,
// swing and can be pulled; cloth that hangs, drapes and flutters, pinned at
// its edge; and soft stretch (pull a soft body; let go and it wobbles back).
// Pure JavaScript, no DOM. src/physics/hands-on.js builds it from a recipe's
// `hands` block and steps it with the rigid world (docs/PACKS.md,
// "Hands-on: soft parts", has every key with an example).
//
// - Ropes and cloth are nodes (particles) held by distance links, solved
//   with XPBD in small substeps (as src/physics/world.js does for bodies,
//   with a solver of its own so the rigid world stays as it is). A node is
//   pinned where it was built, rides a piece (an octopus's arm on its body),
//   follows the finger, or hangs free under gravity, air drag and wind.
//   Links can be slack (a rope folds, it doesn't push), resist bending, pull
//   back toward the shape the rope was built in (`keep`: arms that curl
//   back) and snap when stretched too far (`breakAt`: cheese strings).
// - What moves on screen: a node can move a token, and the recipe's splats
//   follow those tokens as skin (kind "skin" between two nodes of a rope,
//   ropeSkin(); kind "skin4" across a cell of cloth, clothSkin()), so a
//   rope bends smoothly and a sheet drapes without seams. Or a rope carries
//   rigid pieces (a token or a part per node or link: a chime, a bead, the
//   yo-yo), each turning with the rope, so solid things stay solid.
// - Stretch drives the toy's grab (the gummy bear's pull: the splats near
//   the finger follow it, fading with distance) from a damped spring, so
//   each soft toy wobbles back at its own pace.
//
// Units are the recipe's (pieces mode in hands-on.js); speeds and forces
// given per toy radius (R) are scaled here.

import { quat, v3 } from "./world.js";

const ID = [0, 0, 0, 1];
const HOME_SECS = 0.45;
const SUBSTEPS = 10;

// Whether a recipe's `hands` asks for soft parts.
export function hasSoft(hands) {
  return !!(hands && (hands.ropes || hands.cloth || hands.stretch));
}

// Stiffness 0..1 as an XPBD compliance (1: rigid; 0: no link at all).
function compliance(k) {
  if (k >= 1) return 0;
  return 1e-7 * Math.pow(10, 5 * (1 - Math.max(0, k)));
}

// The shortest turn taking unit vector a to unit vector b.
function fromTo(a, b) {
  const d = v3.dot(a, b);
  if (d < -0.999999) {
    const ax = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    return quat.axisAngle(v3.cross(a, ax), Math.PI);
  }
  const c = v3.cross(a, b);
  return quat.norm([c[0], c[1], c[2], 1 + d]);
}

// A smooth, repeatable flutter in -1..1 (for wind gusts).
function flutter(t, i) {
  return (
    0.55 * Math.sin(t * 7.1 + i * 1.7) +
    0.3 * Math.sin(t * 12.9 + i * 0.6 + 1.3) +
    0.15 * Math.sin(t * 23.3 + i * 2.9)
  );
}

// ---- Skin helpers (for a recipe's build) ------------------------------------

// For splats along a rope: the two nodes a point lies between and how far
// along (kit's `skin: (c) => [a, b, s]`, with `tokens` the rope's tokens).
export function ropeSkin(points, tokens) {
  return (p) => {
    let best = [tokens[0], tokens[0], 0];
    let bd = Infinity;
    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i];
      const ab = v3.sub(points[i + 1], a);
      const L = v3.dot(ab, ab) || 1e-12;
      const s = Math.max(0, Math.min(1, v3.dot(v3.sub(p, a), ab) / L));
      const d = v3.len(v3.sub(p, v3.add(a, v3.scale(ab, s))));
      if (d < bd - 1e-9) {
        bd = d;
        best = [tokens[i], tokens[i + 1], s];
      }
    }
    return best;
  };
}

// For splats on a sheet: the cell of the cloth's grid a point lies over and
// where in it (kit's `skin: (c) => [a, b, c, d, s, t]`: the cell's corners,
// row by row, and the blend across and down). `points` are the cloth's
// nodes row by row (rows x cols), `tokens` one per node.
export function clothSkin({ rows, cols, points, tokens }) {
  const at = (r, c) => points[r * cols + c];
  return (p) => {
    let best = null;
    let bd = Infinity;
    for (let r = 0; r + 1 < rows; r++)
      for (let c = 0; c + 1 < cols; c++) {
        const o = at(r, c);
        const u = v3.sub(at(r, c + 1), o);
        const v = v3.sub(at(r + 1, c), o);
        // Least squares for p ~ o + s u + t v.
        const d = v3.sub(p, o);
        const uu = v3.dot(u, u);
        const uv = v3.dot(u, v);
        const vv = v3.dot(v, v);
        const du = v3.dot(d, u);
        const dv = v3.dot(d, v);
        const den = uu * vv - uv * uv || 1e-12;
        const s = Math.max(0, Math.min(1, (du * vv - dv * uv) / den));
        const t = Math.max(0, Math.min(1, (dv * uu - du * uv) / den));
        // How far off the cell (bilinear, so a curved sheet fits too).
        const q = v3.add(
          v3.scale(v3.add(v3.scale(o, 1 - s), v3.scale(at(r, c + 1), s)), 1 - t),
          v3.scale(v3.add(v3.scale(at(r + 1, c), 1 - s), v3.scale(at(r + 1, c + 1), s)), t),
        );
        const e = v3.len(v3.sub(p, q));
        if (e < bd - 1e-9) {
          bd = e;
          const k = (rr, cc) => tokens[rr * cols + cc];
          best = [k(r, c), k(r, c + 1), k(r + 1, c), k(r + 1, c + 1), s, t];
        }
      }
    return best;
  };
}

// ---- The soft parts -----------------------------------------------------------

// host: the HandsOn (R(), world, pieces, player).
export class SoftParts {
  constructor(host) {
    this.host = host;
    this.nodes = []; // { x, p, v, w, w0, home, r, strand, lift, ride }
    this.strands = []; // ropes and cloths
    this.stretch = null;
    this.hold = null; // { node } | { stretch }
    this.homing = null;
    this.moved = false;
    this.asleep = true;
    this.still = 0; // seconds everything has been still
    this.t = 0;
    this.events = []; // { speed, snap } for sounds
  }

  // Builds the soft parts a recipe's `hands` names (data: the kit's data).
  build(hands, data, info) {
    const R = this.host.R();
    this.R = R;
    this.gravity = (hands.gravity ?? 26) * R;
    this.floor = hands.floor ?? 0;
    for (const def of hands.ropes?.(data, info) || []) this.addStrand("rope", def);
    for (const def of hands.cloth?.(data, info) || []) this.addStrand("cloth", def);
    const st = typeof hands.stretch === "function" ? hands.stretch(data, info) : hands.stretch;
    if (st) this.stretch = { def: st, pull: [0, 0, 0], vel: [0, 0, 0], on: false };
    return this;
  }

  addStrand(kind, def) {
    const R = this.R;
    const pts = def.points;
    const first = this.nodes.length;
    const n = pts.length;
    const mass = (i) => (Array.isArray(def.mass) ? def.mass[i] : def.mass) ?? 1;
    const s = { kind, def, first, n, links: [], rest: [], scale: 1, pieces: def.pieces || [] };
    s.name = def.name ?? `${kind}${this.strands.length}`;
    for (let i = 0; i < n; i++) {
      const m = mass(i);
      const w = m > 0 ? 1 / m : 0;
      // `home`: as built (the skin's places); `rest`: where it starts and
      // goes back to (def.start, else home).
      const rest = (def.start?.[i] ?? pts[i]).slice();
      this.nodes.push({ x: rest.slice(), p: rest.slice(), v: [0, 0, 0], w, w0: w, home: pts[i].slice(), rest, r: def.radius ?? 0.02 * R, strand: s, i, lift: null, ride: null }); // prettier-ignore
    }
    const N = (i) => this.nodes[first + i];
    for (const [i, a] of def.lift || []) N(i).lift = a.map((v) => v * R);
    // Pinned where built (a rope's first node unless it rides a piece).
    const pins = def.pin ?? (def.attach || kind === "cloth" ? [] : [0]);
    for (const i of pins) N(i).w = N(i).w0 = 0;
    // Riding a piece (or a node of a rope built before it, turning with
    // that rope: a kite's tail): those nodes go where it takes them.
    const on = def.attach?.rope !== undefined ? this.strands[def.attach.rope] : null;
    if (on) {
      const j = def.attach.node ?? on.n - 1;
      const at = this.nodes[on.first + j];
      for (const i of def.attach.nodes ?? [0]) {
        const nd = N(i);
        nd.ride = { strand: on, node: j, local: v3.sub(nd.home, at.home), by: def.attach.turnBy };
        nd.w = nd.w0 = 0;
      }
      s.rides = on;
    } else if (def.attach) {
      const pc = this.host.pieces[def.attach.piece];
      if (pc) {
        const b = pc.body;
        (def.attach.nodes ?? [0]).forEach((i, k) => {
          const nd = N(i);
          // Tied to the node's rest, or to the piece's point `at[k]`.
          const at = def.attach.at?.[k] ?? nd.rest;
          const l = quat.rotate(quat.conj(b.home.q), v3.sub(at, b.home.pos));
          nd.ride = { body: b, local: l };
          nd.w = nd.w0 = 0;
        });
        s.body = b;
      }
    }
    const stiff = compliance(def.stiff ?? 1);
    const slack = def.slack ?? kind === "rope";
    const brk = def.breakAt ?? 0;
    const link = (a, b, c, o = {}) => {
      if (c === null) return;
      const L = v3.len(v3.sub(N(a).home, N(b).home));
      s.links.push({ a: first + a, b: first + b, L, L0: L, c, slack: !!o.slack, brk: o.brk ?? 0, broken: false, main: !!o.main }); // prettier-ignore
    };
    const bendC = (def.bend ?? 0.2) > 0 ? compliance(def.bend ?? 0.2) : null;
    if (kind === "rope") {
      for (let i = 0; i + 1 < n; i++) link(i, i + 1, stiff, { slack, brk, main: true });
      for (let i = 0; i + 2 < n; i++) link(i, i + 2, bendC, { slack: false });
    } else {
      const { rows, cols } = def;
      const id = (r, c) => r * cols + c;
      const shear = (def.shear ?? 0.6) > 0 ? compliance(def.shear ?? 0.6) : null;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          if (c + 1 < cols) link(id(r, c), id(r, c + 1), stiff, { brk, main: true });
          if (r + 1 < rows) link(id(r, c), id(r + 1, c), stiff, { brk, main: true });
          if (r + 1 < rows && c + 1 < cols) {
            link(id(r, c), id(r + 1, c + 1), shear);
            link(id(r, c + 1), id(r + 1, c), shear);
          }
          if (c + 2 < cols) link(id(r, c), id(r, c + 2), bendC);
          if (r + 2 < rows) link(id(r, c), id(r + 2, c), bendC);
        }
    }
    this.strands.push(s);
    // The parts it carries need their pivots (recipe coordinates).
    for (const pc of s.pieces) if (pc.part && !pc.pivot) pc.pivot = this.partPivot(pc.part);
    return s;
  }

  partPivot(name) {
    const m = this.host.player?.motion;
    const def = (m?.ctx?.parts || []).find((p) => p.name === name);
    const tf = m?.ctx?.transform;
    if (!def) return [0, 0, 0];
    if (!tf) return def.pivot.slice();
    return def.pivot.map((v, i) => v / tf.scale + tf.center[i]);
  }

  get busy() {
    return !!(this.hold || this.homing || !this.asleep);
  }

  // ---- The finger ----

  // The node nearest a recipe point, if within its reach: { node, d } with
  // d in units of that reach (under 1: on it).
  pick(p) {
    let best = null;
    let bd = Infinity;
    for (const nd of this.nodes) {
      const def = nd.strand.def;
      if (def.grab === false || nd.ride || (nd.w0 === 0 && !def.grabPinned)) continue;
      if (Array.isArray(def.grab) && !def.grab.includes(nd.i)) continue;
      const reach = def.pick ?? Math.max(2.5 * nd.r, 0.12 * this.R);
      const d = v3.len(v3.sub(nd.x, p)) / reach;
      if (d < bd) [bd, best] = [d, nd];
    }
    return best ? { node: best, d: bd } : null;
  }

  // Takes a node (from pick) or the stretch (world: the pressed point in
  // the world, for the toy's grab).
  grab(what, world) {
    this.homing = null;
    if (what === "stretch") {
      const st = this.stretch;
      const g = this.driver();
      if (!st || !g) return false;
      const r = (st.def.radius ?? 0.5) * this.host.info.radius;
      st.on = true;
      st.anchor = world.slice();
      st.anchorRecipe = this.host.player.toRecipe(world);
      st.goal = [0, 0, 0];
      st.vel = [0, 0, 0];
      st.pull = [0, 0, 0];
      Object.assign(g, { on: true, held: true, anchor: world.slice(), radius: r, pull: [0, 0, 0], goal: [0, 0, 0] }); // prettier-ignore
      this.hold = { stretch: true };
    } else {
      const nd = what.node;
      nd.w = 0;
      nd.v = [0, 0, 0];
      this.hold = { node: nd, target: nd.x.slice(), from: nd.x.slice() };
    }
    this.moved = true;
    this.asleep = false;
    return true;
  }

  // The finger's point (recipe coordinates).
  drag(p) {
    const h = this.hold;
    if (!h) return;
    if (h.stretch) {
      const st = this.stretch;
      const world = this.host.player.fromRecipe(p);
      let pull = v3.sub(world, st.anchor);
      // A soft cap: it stretches less the further it goes.
      const max = (st.def.max ?? 0.8) * this.host.info.radius;
      const L = v3.len(pull);
      if (L > 1e-9) pull = v3.scale(pull, (max * Math.tanh(L / max)) / L);
      st.goal = pull;
      return;
    }
    // Never further from where the rope is held than the rope reaches (a
    // breakable rope a little past its breaking point).
    const nd = h.node;
    h.target = this.reachable(nd, p);
    // A recipe's `maxPull`: never further than that from where it rests.
    const mp = nd.strand.def.maxPull;
    if (mp) {
      const d = v3.sub(h.target, nd.rest);
      const l = v3.len(d);
      if (l > mp) h.target = v3.add(nd.rest, v3.scale(d, mp / l));
    }
  }

  reachable(nd, p) {
    const s = nd.strand;
    if (s.kind !== "rope") return p;
    const def = s.def;
    // The nearest held node along the rope, toward the start.
    let L = 0;
    let anchor = null;
    for (let i = nd.i - 1; i >= 0; i--) {
      const a = this.nodes[s.first + i];
      const b = this.nodes[s.first + i + 1];
      L += v3.len(v3.sub(a.home, b.home)) * s.scale;
      if (a.w === 0) {
        anchor = a;
        break;
      }
    }
    if (!anchor) return p;
    const over = def.breakAt ? def.breakAt * 1.15 : (def.reach ?? 1.04);
    const d = v3.sub(p, anchor.x);
    const l = v3.len(d);
    return l > L * over ? v3.add(anchor.x, v3.scale(d, (L * over) / l)) : p;
  }

  // Lets go, with the finger's speed (recipe units per second).
  release(vel = [0, 0, 0]) {
    const h = this.hold;
    this.hold = null;
    if (!h) return;
    if (h.stretch) {
      const st = this.stretch;
      const g = this.driver();
      st.on = "spring";
      if (g) g.held = true; // driven from here, not the driver's own spring
      return;
    }
    const nd = h.node;
    nd.w = nd.w0;
    if (nd.w > 0) nd.v = vel.slice();
    this.asleep = false;
  }

  driver() {
    return this.host.player?.driver?.grab ?? null;
  }

  // ↺: everything glides home (and broken links mend).
  reset() {
    if (this.hold) this.release();
    this.stretchHome();
    if (!this.moved) return false;
    this.homing = { el: 0, from: this.nodes.map((nd) => nd.x.slice()) };
    return true;
  }

  stretchHome() {
    const st = this.stretch;
    if (!st?.on) return;
    st.on = false;
    st.pull = [0, 0, 0];
    const g = this.driver();
    if (g) Object.assign(g, { on: false, held: false, pull: [0, 0, 0], goal: [0, 0, 0] });
  }

  // ---- Each step ----

  // Advances by dt (the host's fixed step) at host time `time`. Returns
  // true while anything moves.
  step(dt, time) {
    this.t = time;
    this.pose();
    let busy = this.stepStretch(dt);
    if (this.homing) {
      this.homing.el += dt;
      const f = Math.min(1, this.homing.el / HOME_SECS);
      const e = f * f * (3 - 2 * f);
      this.nodes.forEach((nd, k) => {
        const to = nd.ride ? this.rideAt(nd) : nd.rest;
        nd.x = this.homing.from[k].map((v, i) => v + (to[i] - v) * e);
        nd.p = nd.x.slice();
        nd.v = [0, 0, 0];
      });
      if (f >= 1) {
        this.homing = null;
        this.mend();
        this.moved = this.nodes.some((nd) => nd.ride && v3.len(v3.sub(nd.x, nd.rest)) > 1e-4);
        this.asleep = true;
      }
      return true;
    }
    if (!this.strands.length) return busy;
    // Wake when a piece a rope rides moves.
    const riding = this.strands.some((s) => s.body && !this.host.world?.asleep);
    const wind = this.strands.some((s) => s.def.wind);
    if (this.asleep && !riding && !wind && !this.hold) return busy;
    if (riding || wind) this.moved = true;
    this.asleep = false;
    for (const s of this.strands) s.def.update?.(s, dt, this);
    const h = dt / SUBSTEPS;
    const hold = this.hold?.node ? this.hold : null;
    for (let k = 1; k <= SUBSTEPS; k++) {
      if (hold) {
        const f = k / SUBSTEPS;
        hold.node.x = hold.from.map((v, i) => v + (hold.target[i] - v) * f);
      }
      this.substep(h);
    }
    if (hold) hold.from = hold.target.slice();
    // Asleep after a moment of stillness; home once it is still at home.
    let vmax = 0;
    let off = 0;
    for (const nd of this.nodes) {
      vmax = Math.max(vmax, v3.len(nd.v));
      off = Math.max(off, v3.len(v3.sub(nd.x, nd.rest)));
    }
    this.still = vmax < 0.02 * this.R && !hold && !wind && !riding ? this.still + dt : 0;
    if (this.still > 0.4) {
      this.asleep = true;
      if (off < 0.01 * this.R) {
        for (const nd of this.nodes) {
          nd.x = nd.rest.slice();
          nd.v = [0, 0, 0];
        }
        this.moved = this.strands.some((s) => s.links.some((l) => l.broken));
      }
    }
    return true;
  }

  // The toy's pose: gravity, wind and lift act along the world's own axes
  // even when the toy lies on its side or upside down (`turn`: the world's
  // up taken into recipe coordinates, as a turn from the recipe's own up).
  // The floor holds only while the toy stands upright.
  pose() {
    const p = this.host.player;
    let up = [0, 1, 0];
    if (p?.toRecipe) {
      const a = p.toRecipe([0, 0, 0]);
      up = v3.norm(v3.sub(p.toRecipe([0, 1, 0]), a));
    }
    this.turn = fromTo([0, 1, 0], up);
    this.upright = up[1] > 0.985;
  }

  rideAt(nd) {
    const r = nd.ride;
    if (r.strand) {
      const at = this.nodes[r.strand.first + r.node];
      let q = this.turnAt(r.strand, r.node);
      if (r.by !== undefined) q = quat.slerp(ID, q, r.by);
      return v3.add(at.x, quat.rotate(q, r.local));
    }
    return v3.add(r.body.pos, quat.rotate(r.body.q, r.local));
  }

  // How strand s has turned at node i: the turn of the link from i to `to`
  // (default the next node, or the link before the last node).
  turnAt(s, i, to) {
    const N = (k) => this.nodes[s.first + k];
    const j = to ?? (i + 1 < s.n ? i + 1 : i - 1);
    if (j < 0 || j >= s.n || j === i) return ID;
    const d0 = v3.sub(N(j).home, N(i).home);
    const d1 = v3.sub(N(j).x, N(i).x);
    return fromTo(v3.norm(d0), v3.norm(d1));
  }

  substep(h) {
    const g = this.gravity;
    const R = this.R;
    const t = this.t;
    // Shape memory (`keep`, per second): free nodes are drawn back toward
    // the shape the strand was built in, carried by the piece it rides.
    for (const s of this.strands)
      if (s.def.keep) s.dq = s.body ? quat.mul(s.body.q, quat.conj(s.body.home.q)) : ID;
    for (const nd of this.nodes) {
      nd.p = nd.x.slice();
      if (nd.ride) {
        nd.x = this.rideAt(nd);
        continue;
      }
      if (nd.w === 0) continue;
      const def = nd.strand.def;
      const a = [0, -g * (def.weight ?? 1), 0];
      if (nd.lift) for (let i = 0; i < 3; i++) a[i] += nd.lift[i];
      const turned = !this.upright;
      if (turned) a.splice(0, 3, ...quat.rotate(this.turn, a));
      const keep = def.keep ?? 0;
      if (keep) {
        const b = nd.strand.body;
        const to = b ? v3.add(b.pos, quat.rotate(nd.strand.dq, v3.sub(nd.home, b.home.pos))) : nd.home; // prettier-ignore
        for (let i = 0; i < 3; i++) a[i] += keep * keep * (to[i] - nd.x[i]);
      }
      const wd = def.wind;
      if (wd) {
        // Air moving past: the node is pulled toward the wind's speed, which
        // gusts and flutters along the rope.
        const f = flutter(t, nd.i);
        const W = (wd.vel || [1, 0, 0]).map((v) => v * R * (1 + (wd.gust ?? 0.4) * f));
        const side = wd.flap ?? 0.5;
        W[1] += side * R * flutter(t * 1.3 + 5, nd.i + 3);
        if (turned) W.splice(0, 3, ...quat.rotate(this.turn, W));
        const k = wd.k ?? 3;
        for (let i = 0; i < 3; i++) a[i] += k * (W[i] - nd.v[i]);
      }
      const drag = Math.exp(-(def.drag ?? 1.2) * h);
      for (let i = 0; i < 3; i++) {
        nd.v[i] = (nd.v[i] + a[i] * h) * drag;
        nd.x[i] += nd.v[i] * h;
      }
    }
    const h2 = h * h;
    for (const s of this.strands) {
      for (const l of s.links) {
        if (l.broken) continue;
        const A = this.nodes[l.a];
        const B = this.nodes[l.b];
        const wsum = A.w + B.w;
        if (wsum === 0) continue;
        const d = v3.sub(B.x, A.x);
        const len = v3.len(d);
        if (len < 1e-12) continue;
        const L = l.L * (l.main ? s.scale : 1);
        const C = len - L;
        if (l.slack && C < 0) continue;
        if (l.brk && len > L * l.brk) {
          l.broken = true;
          this.events.push({ snap: true, speed: v3.len(v3.sub(B.v, A.v)) / R, strand: s.name });
          continue;
        }
        const dl = -C / (wsum + l.c / h2);
        const n = v3.scale(d, 1 / len);
        for (let i = 0; i < 3; i++) {
          A.x[i] -= n[i] * dl * A.w;
          B.x[i] += n[i] * dl * B.w;
        }
      }
    }
    // The floor and anything the strand keeps clear of.
    const fl = this.floor;
    for (const nd of this.nodes) {
      if (nd.w === 0) continue;
      const def = nd.strand.def;
      if (this.upright && nd.x[1] < fl + nd.r) {
        const depth = fl + nd.r - nd.x[1];
        nd.x[1] = fl + nd.r;
        // Friction (as in PBD): the slide along the floor this substep is
        // undone up to `friction` times how far the floor pushed it out.
        const fr = (def.friction ?? 0.6) * depth;
        const dx = nd.x[0] - nd.p[0];
        const dz = nd.x[2] - nd.p[2];
        const slide = Math.hypot(dx, dz);
        const k = slide > 1e-12 ? Math.min(1, fr / slide) : 0;
        nd.x[0] -= dx * k;
        nd.x[2] -= dz * k;
      }
      for (const sp of def.avoid || []) {
        const c = sp.piece !== undefined ? this.host.pieces[sp.piece]?.body?.toWorld(sp.at) ?? sp.at : sp.at; // prettier-ignore
        const d = v3.sub(nd.x, c);
        const l = v3.len(d);
        const r = sp.r + nd.r;
        if (l < r && l > 1e-9) nd.x = v3.add(c, v3.scale(d, r / l));
      }
    }
    for (const nd of this.nodes) for (let i = 0; i < 3; i++) nd.v[i] = (nd.x[i] - nd.p[i]) / h;
  }

  // Stretch: held, the pull follows the finger closely; let go, it swings
  // back through rest on a damped spring and settles.
  stepStretch(dt) {
    const st = this.stretch;
    if (!st?.on) return false;
    const g = this.driver();
    if (st.on === true) {
      const k = 1 - Math.exp(-dt / 0.04);
      st.pull = st.pull.map((v, i) => v + (st.goal[i] - v) * k);
    } else {
      const w = 2 * Math.PI * (st.def.hz ?? 3);
      const z = st.def.damping ?? 0.2;
      for (let i = 0; i < 3; i++) {
        st.vel[i] += (-w * w * st.pull[i] - 2 * z * w * st.vel[i]) * dt;
        st.pull[i] += st.vel[i] * dt;
      }
      const R = this.host.info.radius;
      if (v3.len(st.pull) < 0.002 * R && v3.len(st.vel) < 0.02 * R) {
        this.stretchHome();
        return true;
      }
    }
    if (g) {
      g.on = true;
      g.held = true;
      g.pull = st.pull.slice();
      g.goal = st.pull.slice();
    }
    return true;
  }

  mend() {
    for (const s of this.strands) {
      s.scale = 1;
      for (const l of s.links) l.broken = false;
      s.def.reset?.(s, this);
    }
  }

  // ---- Output ----

  // What the soft parts move: tokens ([{ index, token }]) and parts.
  output() {
    if (!this.moved && !this.homing) return null;
    const tokens = [];
    const parts = {};
    // Rigid riders first (a strand's tokens may be in a rider part's frame).
    for (const s of this.strands) {
      for (const pc of s.pieces) {
        const i = pc.from ?? pc.node ?? 0;
        const a = this.nodes[s.first + i];
        let q = pc.turn === false ? ID : this.turnAt(s, i, pc.to);
        if (pc.turnBy !== undefined) q = quat.slerp(ID, q, pc.turnBy);
        const sp = pc.spin?.(s, this);
        if (sp) q = quat.mul(q, quat.axisAngle(pc.axis || [0, 0, 1], sp));
        // The built point that sits on the node (default the node's home).
        const base = pc.at || a.home;
        const to = v3.add(a.x, v3.sub(base, a.home));
        if (pc.token !== undefined) {
          tokens.push({ index: pc.token, token: { base, offset: v3.sub(to, base), quat: q } });
        } else if (pc.part) {
          const pv = pc.pivot;
          const off = v3.sub(v3.sub(to, pv), quat.rotate(q, v3.sub(base, pv)));
          parts[pc.part] = { quat: q, offset: off, pivot: pv };
        }
      }
    }
    for (const s of this.strands) {
      const fr = s.def.frame ? parts[s.def.frame] : null;
      const vis = s.def.visible?.(s, this) ?? 1;
      (s.def.tokens || []).forEach((tk, i) => {
        if (tk === null || tk === undefined) return;
        const nd = this.nodes[s.first + i];
        // In a moving part's frame: where the part's own move would put
        // the node's home, taken back out (the shader moves skin, then part).
        let x = nd.x;
        if (fr) x = v3.add(fr.pivot, quat.rotate(quat.conj(fr.quat), v3.sub(v3.sub(x, fr.offset), fr.pivot))); // prettier-ignore
        tokens.push({ index: tk, token: { base: nd.home, offset: v3.sub(x, nd.home), quat: ID, visible: vis } }); // prettier-ignore
      });
    }
    for (const k in parts) delete parts[k].pivot;
    return { tokens, parts };
  }

  takeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  // For tests and clips.
  state() {
    return {
      moved: this.moved,
      asleep: this.asleep,
      holding: !!this.hold,
      stretch: this.stretch ? { on: this.stretch.on, pull: this.stretch.pull.slice() } : null,
      strands: this.strands.map((s) => ({
        name: s.name,
        kind: s.kind,
        nodes: Array.from({ length: s.n }, (_, i) => this.nodes[s.first + i].x.slice()),
        home: Array.from({ length: s.n }, (_, i) => this.nodes[s.first + i].home.slice()),
        broken: s.links.filter((l) => l.broken).length,
      })),
    };
  }
}

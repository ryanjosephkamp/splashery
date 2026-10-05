// Lane Arcade, G2: Longtail, a growing-trail game on a world you can fold.
// A string of glass beads crawls from tile to tile, a tile a beat; each
// berry it eats makes it longer, and running into itself ends the game.
// The same tiles, the same rules, three worlds (the World option):
//
//   cube    2D: the cube laid out flat as a cross of six faces (a net);
//           leaving an edge of the cross comes back in where that edge
//           meets once folded. 3D: the faces swing up on their hinges and
//           close into a cube you steer around.
//   planet  the same net, folding into a cube and then rounding out into
//           a planet from the Space shelf (each tile takes the planet's
//           color under it), a real Mars, Moon or Earth.
//   torus   2D: a rectangle whose edges wrap round to the opposite edges.
//           3D: it rolls into a tube and bends into a ring.
//
// Tunnels (an option): dark mouths that come out on the far side of the
// world (straight through the middle, or through the ring's hole).
//
// Every tile is a solid piece: folding and rounding move and turn the
// tiles, never bend them. Moves are judged on the world's own grid, so a
// turn means the same thing in both views; a direction on the screen picks
// the tile edge that points most that way, wherever the camera is.

import { crispModel } from "./arcade-crisp.js";

const TICK = 0.14;
const A = 0.5; // half the cube's side
const PLANET_R = 0.92;

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => mul(a, 1 / (len(a) || 1));
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

// Rotation of p about an axis (x or y) through a pivot, by angle.
function hinge(p, axis, pivot, ang) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const d = sub(p, pivot);
  let r;
  if (axis === "y") r = [d[0] * c + d[2] * s, d[1], -d[0] * s + d[2] * c];
  else r = [d[0], d[1] * c - d[2] * s, d[1] * s + d[2] * c];
  return add(r, pivot);
}

// ---- Worlds ------------------------------------------------------------------------

// The cube's net: six faces of side 2A in the z = 0 plane (a cross, with
// the back below the bottom), each folding about its hinge.
const NET = [
  { name: "front", at: [0, 0] },
  { name: "right", at: [2 * A, 0], hinge: { axis: "y", pivot: [A, 0, 0], sign: 1 } },
  { name: "left", at: [-2 * A, 0], hinge: { axis: "y", pivot: [-A, 0, 0], sign: -1 } },
  { name: "up", at: [0, 2 * A], hinge: { axis: "x", pivot: [0, A, 0], sign: -1 } },
  { name: "down", at: [0, -2 * A], hinge: { axis: "x", pivot: [0, -A, 0], sign: 1 } },
  {
    name: "back",
    at: [0, -4 * A],
    parent: 4,
    hinge: { axis: "x", pivot: [0, -3 * A, 0], sign: 1 },
  },
];

function netFold(face, p, f) {
  const F = NET[face];
  let q = p;
  if (F.hinge) {
    q = hinge(q, F.hinge.axis, F.hinge.pivot, F.hinge.sign * f * (Math.PI / 2));
    if (F.parent !== undefined) {
      const P = NET[F.parent];
      q = hinge(q, P.hinge.axis, P.hinge.pivot, P.hinge.sign * f * (Math.PI / 2));
    }
  }
  // The cube closes behind the front face; center it on the middle.
  return [q[0], q[1], q[2] + A * f];
}

// A world: cells (each with its face and its place on that face), where a
// place on a face sits for a view blend, and each cell's four neighbors.
function cubeWorld(N, planet) {
  const cells = [];
  for (let f = 0; f < 6; f++)
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) cells.push({ face: f, a: (i + 0.5) / N, b: (j + 0.5) / N });
  const pos = (face, a, b, view) => {
    const F = NET[face];
    const net = [F.at[0] + (a * 2 - 1) * A, F.at[1] + (b * 2 - 1) * A, 0];
    const f = planet ? clamp(view * 1.8, 0, 1) : view;
    // The net's middle (the cross spans y from -5A to 3A) sits at the origin flat.
    const flat = [net[0], net[1] + A * (1 - f), net[2]];
    if (f <= 0) return flat;
    let p = netFold(face, net, f);
    p = [p[0], p[1] + A * (1 - f), p[2]];
    if (!planet) return p;
    const g = clamp(view * 1.8 - 0.8, 0, 1);
    if (g <= 0) return p;
    const s = mul(unit(p), PLANET_R);
    return [lerp(p[0], s[0], g), lerp(p[1], s[1], g), lerp(p[2], s[2], g)];
  };
  return {
    kind: planet ? "planet" : "cube",
    cells,
    pos,
    N,
    step: 1 / N,
    wrapA: false,
    wrapB: false,
  };
}

const TOR_R = 0.72;
const TOR_r = 0.3;
function torusWorld(NU, NV) {
  const cells = [];
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) cells.push({ face: 0, a: (i + 0.5) / NU, b: (j + 0.5) / NV }); // prettier-ignore
  const Wt = 2 * Math.PI * TOR_R;
  const Ht = 2 * Math.PI * TOR_r;
  const pos = (face, a, b, view) => {
    // Stage one rolls the strip's height into a tube; stage two bends the
    // tube's length into a ring.
    const s1 = clamp(view * 2, 0, 1);
    const s2 = clamp(view * 2 - 1, 0, 1);
    const x = (a - 0.5) * Wt;
    const yb = (b - 0.5) * Ht;
    let y = yb;
    let z = 0;
    if (s1 > 1e-4) {
      const rho = Ht / (2 * Math.PI * s1);
      const th = yb / rho;
      y = rho * Math.sin(th);
      z = rho * Math.cos(th) - rho + TOR_r * s1; // the tube's axis on z = 0
    }
    if (s2 < 1e-4) return [x, y, z];
    // Bend the tube's axis into a ring lying flat (in the x-z plane).
    const R2 = Wt / (2 * Math.PI * s2);
    const ph = x / R2;
    return [(R2 + z) * Math.sin(ph), y, (R2 + z) * Math.cos(ph) - R2 + TOR_R * s2];
  };
  return { kind: "torus", cells, pos, NU, NV, wrapA: true, wrapB: true };
}

// Each cell's four moves (+a, -a, +b, -b on its own face): the cell it
// reaches and the move that carries straight on from there.
function linkCells(world) {
  const { cells } = world;
  const key = (p) => p.map((v) => Math.round(v * 400)).join(",");
  const at = new Map();
  const P = cells.map((c) => world.pos(c.face, c.a, c.b, 1));
  const frame = cells.map((c) => cellFrame(world, c, 1));
  P.forEach((p, i) => at.set(key(p), i));
  const nearest = (p) => {
    const k = at.get(key(p));
    if (k !== undefined) return k;
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < P.length; i++) {
      const d = len(sub(P[i], p));
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  };
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    c.next = [];
    for (let k = 0; k < 4; k++) {
      let j;
      if (world.kind === "torus") {
        const di = k === 0 ? 1 : k === 1 ? -1 : 0;
        const dj = k === 2 ? 1 : k === 3 ? -1 : 0;
        const ii = (Math.round(c.a * world.NU - 0.5) + di + world.NU) % world.NU;
        const jj = (Math.round(c.b * world.NV - 0.5) + dj + world.NV) % world.NV;
        j = jj * world.NU + ii;
        c.next.push({ to: j, dir: k });
        continue;
      }
      // On the cube: step along the face; past an edge, wrap down the next face.
      const h = 2 * A * world.step;
      const fr = frame[i];
      const ax = k === 0 ? fr.ex : k === 1 ? mul(fr.ex, -1) : k === 2 ? fr.ey : mul(fr.ey, -1);
      let t = add(cubePos(world, c), mul(ax, h));
      for (let q = 0; q < 3; q++) {
        if (Math.abs(t[q]) > A + 1e-6) {
          const over = Math.abs(t[q]) - A;
          t[q] = Math.sign(t[q]) * A;
          t = sub(t, mul(fr.n, over));
        }
      }
      j = nearestCube(world, t);
      // The move that carries straight on: the next cell's edge most along
      // the way we were heading, once over the edge.
      const head = unit(sub(cubePos(world, cells[j]), cubePos(world, c)));
      const fj = frame[j];
      const tang = unit(sub(head, mul(fj.n, dot(head, fj.n))));
      const opts = [fj.ex, mul(fj.ex, -1), fj.ey, mul(fj.ey, -1)];
      let dir = 0;
      let bd = -Infinity;
      opts.forEach((o, m) => {
        const d = dot(o, tang);
        if (d > bd) {
          bd = d;
          dir = m;
        }
      });
      c.next.push({ to: j, dir });
    }
  }
  void nearest;
}

// The cell's place on the cube itself (the folded, unrounded world).
function cubePos(world, c) {
  if (!c.cube) {
    const F = NET[c.face];
    const net = [F.at[0] + (c.a * 2 - 1) * A, F.at[1] + (c.b * 2 - 1) * A, 0];
    c.cube = netFold(c.face, net, 1);
  }
  return c.cube;
}

function nearestCube(world, p) {
  let best = 0;
  let bd = Infinity;
  const cs = world.cells;
  for (let i = 0; i < cs.length; i++) {
    const d = len(sub(cubePos(world, cs[i]), p));
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

// A cell's place and its turn at a view blend: its face's own axes there.
function cellFrame(world, c, view) {
  const e = 0.25 / (world.N || world.NU || 10);
  const p = world.pos(c.face, c.a, c.b, view);
  let ex = sub(world.pos(c.face, c.a + e, c.b, view), p);
  let ey = sub(world.pos(c.face, c.a, c.b + e, view), p);
  ex = unit(ex);
  let n = unit(cross(ex, ey));
  ey = cross(n, ex);
  return { p, ex, ey, n };
}

function quatFromAxes(a, b, c) {
  const tr = a[0] + b[1] + c[2];
  let q;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    q = [(b[2] - c[1]) / s, (c[0] - a[2]) / s, (a[1] - b[0]) / s, 0.25 * s];
  } else if (a[0] > b[1] && a[0] > c[2]) {
    const s = Math.sqrt(1 + a[0] - b[1] - c[2]) * 2;
    q = [0.25 * s, (b[0] + a[1]) / s, (c[0] + a[2]) / s, (b[2] - c[1]) / s];
  } else if (b[1] > c[2]) {
    const s = Math.sqrt(1 + b[1] - a[0] - c[2]) * 2;
    q = [(b[0] + a[1]) / s, 0.25 * s, (c[1] + b[2]) / s, (c[0] - a[2]) / s];
  } else {
    const s = Math.sqrt(1 + c[2] - a[0] - b[1]) * 2;
    q = [(c[0] + a[2]) / s, (c[1] + b[2]) / s, 0.25 * s, (a[1] - b[0]) / s];
  }
  const l = Math.hypot(...q);
  return q.map((v) => v / l);
}

// ---- The game ----------------------------------------------------------------------

export async function createLongtail(api) {
  const g = new Longtail(api);
  await g.load();
  return g;
}

class Longtail {
  constructor(api) {
    this.api = api;
    this.q = api.q;
    const o = api.options;
    this.worldKind = ["cube", "planet", "torus"].includes(o.world) ? o.world : "cube";
    this.planetId = ["mars", "moon", "earth"].includes(o.planet) ? o.planet : "mars";
    this.tunnels = o.tunnels !== false;
    this.rand = api.rand;
    const N = api.profile === "low" ? 7 : 9;
    this.world =
      this.worldKind === "torus"
        ? torusWorld(N * 2 + 4, N)
        : cubeWorld(N, this.worldKind === "planet");
    linkCells(this.world);
    this.view = 0;
    this.camYaw = 0;
  }

  async load() {
    const { kitModel, recolor, makeModel } = this.api;
    const low = this.api.profile === "low";
    let planetColor = null;
    if (this.worldKind === "planet") {
      const { RECIPES } = await import("./space.js");
      const r = RECIPES[this.planetId];
      this.planetModel = kitModel((k) => r.build(k, {}), { count: low ? 8000 : 24000 });
      // Tiles take the planet's color under them (its ground, not its haze).
      const m = this.planetModel;
      const pts = [];
      for (let i = 0; i < m.n; i++) {
        const p = [m.pos[i * 3], m.pos[i * 3 + 1], m.pos[i * 3 + 2]];
        const l = len(p);
        if (l > 0.97 && l < 1.012 && m.color[i * 4 + 3] > 0.6) pts.push({ d: mul(p, 1 / l), c: m.color.slice(i * 4, i * 4 + 3) }); // prettier-ignore
      }
      // The body under the tiles: the ground only (no haze), so its splats
      // read as solid ground in the gaps.
      const keep = [];
      for (let i = 0; i < m.n; i++) {
        const l = Math.hypot(m.pos[i * 3], m.pos[i * 3 + 1], m.pos[i * 3 + 2]);
        if (l > 0.96 && l < 1.012 && m.color[i * 4 + 3] > 0.6) keep.push(i);
      }
      const body = makeModel(keep.length);
      keep.forEach((i, j) => {
        body.pos.set(m.pos.subarray(i * 3, i * 3 + 3), j * 3);
        body.scale.set(m.scale.subarray(i * 3, i * 3 + 3), j * 3);
        body.rot.set(m.rot.subarray(i * 4, i * 4 + 4), j * 4);
        body.color.set(
          [m.color[i * 4] * 0.7, m.color[i * 4 + 1] * 0.7, m.color[i * 4 + 2] * 0.7, 1],
          j * 4,
        );
      });
      this.planetModel = body;
      planetColor = (d) => {
        let best = pts[0];
        let bd = -2;
        for (const s of pts) {
          const v = dot(s.d, d);
          if (v > bd) {
            bd = v;
            best = s;
          }
        }
        return best ? Array.from(best.c) : [0.6, 0.5, 0.4];
      };
    }
    // A tile: a flat square, a little smaller than its cell.
    const W = this.world;
    const cellSize = W.kind === "torus" ? Math.min((2 * Math.PI * TOR_R) / W.NU, (2 * Math.PI * TOR_r) / W.NV) : (2 * A) / W.N; // prettier-ignore
    this.cellSize = cellSize;
    // Crisp grids (src/packs/arcade-crisp.js): clean tiles, each built at
    // the largest size its cell takes (flat or rounded: a ring's outer cells
    // are wider than its inner ones) and scaled down to fit, never up, so
    // its splats never spread apart.
    const nu = W.N || W.NU;
    const nv = W.N || W.NV;
    this.span = (c, view) => {
      const e = 0.2 / nu;
      const f = 0.2 / nv;
      const su = (len(sub(W.pos(c.face, c.a + e, c.b, view), W.pos(c.face, c.a - e, c.b, view))) / (2 * e)) * (1 / nu); // prettier-ignore
      const sv = (len(sub(W.pos(c.face, c.a, c.b + f, view), W.pos(c.face, c.a, c.b - f, view))) / (2 * f)) * (1 / nv); // prettier-ignore
      return [su, sv];
    };
    const tiles = new Map();
    const tileOf = (w, h) => {
      const key = `${w.toFixed(3)}:${h.toFixed(3)}`;
      if (!tiles.has(key)) {
        const step = Math.min(w, h) / (low ? 4 : 6);
        const t = crispModel(
          (c) =>
            c.rect(w, h, {
              color: (p) => {
                const edge = Math.max(Math.abs(p[0]) / (w / 2), Math.abs(p[1]) / (h / 2));
                const f = edge > 0.82 ? 0.9 : 1.0;
                return [f, f, f];
              },
            }),
          { fine: step, coarse: step },
        );
        tiles.set(key, t);
      }
      return tiles.get(key);
    };
    this.tileMax = W.cells.map((c) => {
      const [a0, b0] = this.span(c, 0);
      const [a1, b1] = this.span(c, 1);
      return [Math.max(a0, a1), Math.max(b0, b1)];
    });
    const palette =
      W.kind === "torus"
        ? [hex("#3c6e71"), hex("#4f8a8b")]
        : [hex("#e9c98f"), hex("#dcb878"), hex("#9fcf96"), hex("#88bf80"), hex("#9cbfe8"), hex("#86acd8")]; // prettier-ignore
    this.tileModels = W.cells.map((c, i) => {
      let col;
      if (planetColor) {
        col = planetColor(unit(cubePos(W, c)));
        if ((Math.round(c.a * W.N - 0.5) + Math.round(c.b * W.N - 0.5)) % 2)
          col = col.map((v) => v * 0.93);
      } else if (W.kind === "torus") {
        const ii = Math.round(c.a * W.NU - 0.5);
        const jj = Math.round(c.b * W.NV - 0.5);
        col = palette[(ii + jj) % 2];
      } else {
        const ii = Math.round(c.a * W.N - 0.5);
        const jj = Math.round(c.b * W.N - 0.5);
        col = mixc(palette[(c.face * 2) % 6], palette[(c.face * 2 + 1) % 6], (ii + jj) % 2);
      }
      const [mu, mv] = this.tileMax[i];
      return recolor(tileOf(mu * 0.9, mv * 0.9), (v) => [v[0] * col[0], v[1] * col[1], v[2] * col[2], 1]); // prettier-ignore
    });
    // A bead: glass, lit from above.
    const glass = (c0, n) => {
      const l = Math.max(0, dot(n, unit([-0.3, 0.8, 0.5])));
      return c0.map((v) => Math.min(1, v * (0.7 + 0.35 * l) + Math.pow(l, 18) * 0.7));
    };
    const r = cellSize * 0.42;
    this.r = r;
    const step = r / (low ? 2.6 : 3.4);
    const bead = (col, rr) => crispModel((c) => c.sphere(rr, { step, color: (p, n) => glass(hex(col), n) })); // prettier-ignore
    this.headModel = crispModel((c) => {
      c.sphere(r * 1.25, { step, color: (p, n) => glass(hex("#2f7d4f"), n) });
      // Two eyes on its front (+x is the way it is heading; +z is up off the tiles).
      for (const side of [-1, 1]) {
        c.sphere(r * 0.36, { pos: [r * 0.95, side * r * 0.5, r * 0.55], step: step * 0.5, color: hex("#fbfbf6") }); // prettier-ignore
        c.sphere(r * 0.18, { pos: [r * 1.27, side * r * 0.52, r * 0.62], step: step * 0.35, color: hex("#121212") }); // prettier-ignore
      }
    });
    this.bodyModels = ["#3f9a5f", "#58b06e", "#3f9a5f", "#7cc27a"].map((c) => bead(c, r));
    this.berryModel = crispModel((c) => {
      const c0 = hex("#c8203a");
      c.sphere(r * 1.25, {
        step,
        color: (p, n) => {
          const l = Math.max(0, dot(n, unit([-0.3, 0.8, 0.5])));
          return c0.map((v) => Math.min(1, v * (0.65 + 0.4 * l) + Math.pow(l, 16) * 0.8));
        },
      });
      // its leaf
      c.sphere(r * 0.2, { pos: [0, r * 0.2, r * 1.28], radii: [r * 0.45, r * 0.16, r * 0.08], step: step * 0.5, color: hex("#3b8a2a") }); // prettier-ignore
    });
    this.mouthModel = crispModel(
      (c) =>
        c.disc(cellSize * 0.42, {
          normal: [0, 1, 0],
          color: (p) => {
            const rr = Math.hypot(p[0], p[2]) / (cellSize * 0.42);
            const f = 0.05 + 0.25 * Math.pow(rr, 3);
            return [f * 0.7, f * 0.6, f];
          },
        }),
      { fine: cellSize * 0.06, coarse: cellSize * 0.15 },
    );
    void makeModel;
  }

  reset() {
    const S = this.api.sprites;
    S.clear();
    const W = this.world;
    this.tiles = W.cells.map((c, i) => S.add(this.tileModels[i]));
    if (this.planetModel)
      this.planet = S.add(this.planetModel, { scale: PLANET_R * 0.97, fade: 0 });
    // Tunnels: two pairs of mouths, each on the far side from its partner.
    this.mouths = new Map();
    this.mouthSprites = [];
    if (this.tunnels) {
      const pairs = this.tunnelPairs();
      for (const [a, b] of pairs) {
        this.mouths.set(a, b);
        this.mouths.set(b, a);
        for (const c of [a, b]) this.mouthSprites.push({ cell: c, sprite: S.add(this.mouthModel) });
      }
    }
    // Start on the front face (the middle of the net), heading right.
    const start = this.startCell();
    this.body = [start, start, start];
    this.prev = this.body.slice();
    this.dir = 0;
    this.queue = [];
    this.grow = 2;
    this.beads = [];
    this.head = S.add(this.headModel);
    this.score = 0;
    this.length = 3;
    this.over = false;
    this.acc = 0;
    this.ticks = 0;
    this.berry = null;
    this.placeBerry();
    this.banner = null;
  }

  startCell() {
    const W = this.world;
    if (W.kind === "torus") return Math.floor(W.NV / 2) * W.NU + Math.floor(W.NU / 2);
    const m = Math.floor(W.N / 2);
    return m * W.N + Math.max(1, m - 2);
  }

  tunnelPairs() {
    const W = this.world;
    const cs = W.cells;
    const pick = (p) => {
      let best = 0;
      let bd = Infinity;
      cs.forEach((c, i) => {
        const d = len(sub(W.kind === "torus" ? W.pos(c.face, c.a, c.b, 1) : cubePos(W, c), p));
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      return best;
    };
    if (W.kind === "torus") {
      // Through the hole: from the outer rim to the rim across it.
      const R = TOR_R + TOR_r;
      return [
        [pick([R, 0, 0]), pick([-R, 0, 0])],
        [pick([0, 0, R]), pick([0, 0, -R])],
      ];
    }
    const d = A * 0.45;
    return [
      [pick([d, d, A]), pick([-d, -d, -A])],
      [pick([A, -d, d]), pick([-A, d, -d])],
    ];
  }

  placeBerry() {
    const taken = new Set(this.body);
    const W = this.world;
    for (let tries = 0; tries < 400; tries++) {
      const c = (this.rand() * W.cells.length) | 0;
      if (taken.has(c) || this.mouths.has(c)) continue;
      this.berry = c;
      if (!this.berrySprite) this.berrySprite = this.api.sprites.add(this.berryModel);
      this.berryAge = 0;
      return;
    }
  }

  // Screen directions to the head's moves: the move whose edge, as the
  // camera sees it now, points most that way.
  screenMove(name) {
    const pose = this.api.pose?.();
    if (!pose) return null;
    const want = { right: [1, 0], left: [-1, 0], up: [0, 1], down: [0, -1] }[name];
    const fr = cellFrame(this.world, this.world.cells[this.body[0]], this.view);
    const axes = [fr.ex, mul(fr.ex, -1), fr.ey, mul(fr.ey, -1)];
    let best = null;
    let bd = -Infinity;
    axes.forEach((ax, k) => {
      const sx = dot(ax, pose.right);
      const sy = dot(ax, pose.up);
      const l = Math.hypot(sx, sy) || 1;
      const d = (sx * want[0] + sy * want[1]) / l;
      if (d > bd) {
        bd = d;
        best = k;
      }
    });
    return best;
  }

  onView() {}

  step(dt, ctl) {
    this.view = ctl.view;
    this.berryAge = (this.berryAge || 0) + dt;
    if (this.over) return;
    for (const a of ctl.pressed) {
      if (["left", "right", "up", "down"].includes(a)) {
        const m = this.screenMove(a);
        if (m !== null && this.queue.length < 3) this.queue.push(m);
      }
    }
    const sw = ctl.input.takeSwipe?.();
    if (sw) {
      const m = this.screenMove(sw);
      if (m !== null && this.queue.length < 3) this.queue.push(m);
    }
    if (ctl.demo) this.autopilot();
    this.acc += dt;
    const tick = Math.max(0.085, TICK - this.length * 0.0012);
    while (this.acc >= tick) {
      this.acc -= tick;
      this.move();
      if (this.over) break;
    }
    this.frac = this.acc / tick;
  }

  // The attract mode (and clips): head for the berry, never into itself.
  autopilot() {
    if (this.queue.length) return;
    const W = this.world;
    const cells = W.cells;
    const target = this.berry;
    // Breadth-first search from the head to the berry, avoiding the body.
    const block = new Set(this.body.slice(0, -1));
    const from = new Map();
    const startC = this.body[0];
    const q = [{ c: startC, d: this.dir }];
    from.set(startC, null);
    let found = null;
    while (q.length && !found) {
      const cur = q.shift();
      for (let k = 0; k < 4; k++) {
        if (cur.c === startC && k === (this.dir ^ 1)) continue;
        let nx = cells[cur.c].next[k];
        let to = nx.to;
        if (this.mouths.has(to)) to = this.mouths.get(to);
        if (block.has(to) || from.has(to)) continue;
        from.set(to, { c: cur.c, k });
        if (to === target) {
          found = to;
          break;
        }
        q.push({ c: to, d: nx.dir });
      }
    }
    let k = null;
    if (found !== null) {
      let c = found;
      while (from.get(c) && from.get(c).c !== startC) c = from.get(c).c;
      k = from.get(c)?.k ?? null;
    }
    if (k === null) {
      // No way to the berry: any free move.
      for (let m = 0; m < 4; m++) {
        if (m === (this.dir ^ 1)) continue;
        const to = cells[startC].next[m].to;
        if (!block.has(to)) {
          k = m;
          break;
        }
      }
    }
    if (k !== null && k !== this.dir) this.queue.push(k);
  }

  move() {
    const W = this.world;
    // A queued turn (never straight back into the neck).
    while (this.queue.length) {
      const k = this.queue.shift();
      if (k !== (this.dir ^ 1) && k !== this.dir) {
        this.dir = k;
        break;
      }
    }
    const here = W.cells[this.body[0]];
    let { to, dir } = here.next[this.dir];
    let tunneled = false;
    if (this.mouths.has(to)) {
      // Into a mouth, out of its partner, carrying on the same way.
      const out = this.mouths.get(to);
      const fIn = cellFrame(W, W.cells[to], 1);
      const axIn = [fIn.ex, mul(fIn.ex, -1), fIn.ey, mul(fIn.ey, -1)][dir];
      const fOut = cellFrame(W, W.cells[out], 1);
      // The way through comes out heading the same way in space, flattened
      // onto the far side.
      const t = unit(sub(axIn, mul(fOut.n, dot(axIn, fOut.n))));
      const opts = [fOut.ex, mul(fOut.ex, -1), fOut.ey, mul(fOut.ey, -1)];
      let bd = -Infinity;
      opts.forEach((o, m) => {
        const d = dot(o, t);
        if (d > bd) {
          bd = d;
          dir = m;
        }
      });
      to = out;
      tunneled = true;
      this.api.sound({ voice: "hollow", f: 180, vol: 0.5, decay: 0.6 });
    }
    // Into itself (the tail moves on this beat, so its last bead is free).
    const bodyNow = this.grow > 0 ? this.body : this.body.slice(0, -1);
    if (bodyNow.includes(to)) {
      this.over = true;
      this.api.sound([{ voice: "thud", f: 110, vol: 0.8 }, { voice: "glass", at: 0.05, f: 700, decay: 0.6, vol: 0.4 }]); // prettier-ignore
      return;
    }
    this.prev = this.body.slice();
    this.jump = tunneled;
    this.body.unshift(to);
    this.dir = dir;
    if (this.grow > 0) this.grow--;
    else this.body.pop();
    this.ticks++;
    if (to === this.berry) {
      this.grow += 2;
      this.length += 2;
      this.score += 10;
      this.api.sound({ voice: "pop", f: 700 + Math.min(600, this.length * 12), vol: 0.6 });
      this.placeBerry();
    } else if (this.ticks % 4 === 0) this.api.sound({ voice: "click", f: 1400, vol: 0.08 });
    this.length = this.body.length + this.grow;
  }

  // ---- View ------------------------------------------------------------------------

  render(view) {
    this.view = view;
    const W = this.world;
    const q = this.q;
    const lift = this.r * 1.05;
    W.cells.forEach((c, i) => {
      const fr = cellFrame(W, c, view);
      const s = this.tiles[i];
      s.pos = fr.p;
      s.quat = quatFromAxes(fr.ex, fr.ey, fr.n);
      const [su, sv] = this.span(c, view);
      s.scale = [su / this.tileMax[i][0], sv / this.tileMax[i][1], 1];
    });
    if (this.planet) {
      // The planet's own body shows under the tiles once they round out.
      this.planet.fade = clamp(view * 2.2 - 1.2, 0, 1);
    }
    for (const m of this.mouthSprites) {
      const fr = cellFrame(W, W.cells[m.cell], view);
      m.sprite.pos = add(fr.p, mul(fr.n, 0.003));
      // the disc lies in its XZ plane: turn its Y onto the tile's normal
      m.sprite.quat = quatFromAxes(fr.ex, fr.n, mul(fr.ey, -1));
    }
    // Beads: each slides from its last tile to its new one over the beat.
    const S = this.api.sprites;
    const n = this.body.length;
    while (this.beads.length < n - 1)
      this.beads.push(S.add(this.bodyModels[this.beads.length % 4]));
    while (this.beads.length > n - 1) S.remove(this.beads.pop());
    const f = this.over ? 1 : smooth(this.frac || 0);
    const place = (now, before, jump) => {
      const a = cellFrame(W, W.cells[before ?? now], view);
      const b = cellFrame(W, W.cells[now], view);
      // Across a cut edge of the flat net (or out of a tunnel) a bead
      // jumps; on the world itself it slides from tile to tile.
      const far = len(sub(a.p, b.p)) > this.cellSize * 1.8 || jump;
      const t = far ? 1 : f;
      const p = add(mul(a.p, 1 - t), mul(b.p, t));
      const nn = unit(add(mul(a.n, 1 - t), mul(b.n, t)));
      return { p: add(p, mul(nn, lift)), n: nn, dirv: unit(sub(b.p, a.p)), fr: b };
    };
    const hp = place(this.body[0], this.prev[0], this.jump);
    this.head.pos = hp.p;
    let fx = len(hp.dirv) > 0.5 ? hp.dirv : hp.fr.ex;
    fx = unit(sub(fx, mul(hp.n, dot(fx, hp.n))));
    this.head.quat = quatFromAxes(fx, cross(hp.n, fx), hp.n);
    this.head.fade = 1;
    for (let i = 1; i < n; i++) {
      const b = this.beads[i - 1];
      const pl = place(this.body[i], this.prev[i] ?? this.body[i], false);
      b.pos = pl.p;
      b.quat = [0, 0, 0, 1];
      b.fade = 1;
    }
    if (this.berrySprite && this.berry !== null) {
      const fr = cellFrame(W, W.cells[this.berry], view);
      const grow = Math.min(1, (this.berryAge || 0) / 0.3);
      this.berrySprite.pos = add(fr.p, mul(fr.n, lift * (0.9 + 0.08 * Math.sin((this.berryAge || 0) * 4)))); // prettier-ignore
      this.berrySprite.quat = quatFromAxes(fr.ex, fr.ey, fr.n);
      this.berrySprite.scale = 0.3 + 0.7 * grow;
    }
    void q;
  }

  camera(view, aspect) {
    const W = this.world;
    // 2D: the whole flat world, face on.
    const flatW = W.kind === "torus" ? 2 * Math.PI * TOR_R : 6 * A;
    const flatH = W.kind === "torus" ? 2 * Math.PI * TOR_r : 8 * A;
    const d2 = this.api.fitDistance(flatW + 0.3, flatH + 0.6, aspect);
    if (view < 1e-3) return { target: [0, 0.1, 0], yaw: 0, pitch: 0, distance: d2 };
    // 3D: from above the head, the whole world in view; it turns as the
    // head goes round.
    const head = cellFrame(W, W.cells[this.body[0]], 1);
    let n = head.n;
    if (W.kind === "torus") n = unit(add(mul(unit([head.p[0], 0, head.p[2]]), 0.6), [0, 0.9, 0]));
    const yawW = Math.atan2(n[0], n[2]);
    // unwrap so the camera turns the short way round
    let yaw = this.camYaw + wrap(yawW - this.camYaw);
    if (Math.abs(n[1]) > 0.97) yaw = this.camYaw; // over a pole: keep turning as before
    this.camYaw = yaw;
    // a little above and to the side of the head, so three faces show
    const pitch = clamp(Math.asin(clamp(n[1], -1, 1)) + 0.42, -1.25, 1.25);
    yaw += 0.45;
    // (each world fitted to its own size, the beads riding on it included)
    const fit3 = W.kind === "torus" ? 2.3 : W.kind === "planet" ? 2.15 : 1.95;
    const d3 = this.api.fitDistance(fit3, fit3, aspect);
    return {
      target: [0, lerp(0.1, 0, view), 0],
      yaw: yaw * smooth(clamp(view * 1.3, 0, 1)),
      pitch: pitch * smooth(clamp(view * 1.3, 0, 1)),
      distance: lerp(d2, d3, view),
      ease: 0.35,
    };
  }

  stats() {
    return { score: this.score, length: this.body.length + this.grow };
  }

  status() {
    return {
      over: this.over,
      title: "Tangled!",
      lines: [`Length ${this.body.length} · score ${this.score}`],
    };
  }
}

function mixc(a, b, t) {
  return a.map((v, i) => v + (b[i] - v) * t);
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function wrap(a) {
  return ((((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
}

// Earth and maps (lane Geo): a landscape as a block, like a museum diorama.
// The top is the real terrain (heights from a snapshot, colors from aerial
// imagery or a ramp), the four sides are a cut through the ground, and the
// bottom closes it. Recipe units: the block is 2 wide on its longer side,
// north is -Z (away from the viewer), east is +X, up is +Y.

import { mix, shade, vec, clamp } from "../kit.js";
export const SUN = vec.unit([-0.45, 0.75, -0.35]); // low from the northwest, as on a map

// The frame that maps a snapshot's grid to recipe units.
//   span: [east-west, north-south] in meters; exag: vertical exaggeration;
//   lo: the elevation (m) at the block's top base; depth: the block's depth
//   below lo, in recipe units.
export function frame({ span, exag = 1, lo = 0, depth = 0.25 }) {
  const big = Math.max(span[0], span[1]);
  const sx = span[0] / big;
  const sz = span[1] / big;
  const k = (2 / big) * exag; // recipe units per meter, vertically
  return {
    sx,
    sz,
    k,
    lo,
    depth,
    x: (u) => (u - 0.5) * 2 * sx,
    z: (v) => (v - 0.5) * 2 * sz,
    y: (m) => (m - lo) * k,
    m: (y) => y / k + lo, // back to meters
    bottom: -depth,
  };
}

// A hillshade factor for a normal (0.55 in shadow .. 1.15 in full sun).
export function hill(n, soft = 0.5) {
  const d = vec.dot(n, SUN);
  return 0.62 + soft * Math.max(0, d) + 0.18 * n[1];
}

// Adds the terrain block. o:
//   F           the frame
//   height      (u, v) => meters
//   color       (c) => rgb for the top (c.u, c.v, c.n, c.p)
//   side        (meters, c) => rgb for the cut faces (strata)
//   share       the top's share of the budget (the sides take 0.12 of it)
//   part, to, channel, kind, params: passed to the top (a morph, say)
//   grid        the param grid
export function addBlock(k, o) {
  const { F, height } = o;
  const top = (u, v) => [F.x(u), F.y(height(u, v)), F.z(v)];
  const extra = {};
  for (const key of ["part", "to", "channel", "kind", "params"]) if (o[key] !== undefined) extra[key] = o[key]; // prettier-ignore
  k.add(k.param(top, { grid: o.grid || 128, flip: true }), {
    even: true,
    share: o.share ?? 0.8,
    flat: 0.2,
    size: o.size ?? 1,
    jitter: 0.01,
    color: o.color,
    ...extra,
  });
  if (o.sides === false) return;
  const sideShare = o.sideShare ?? 0.12;
  // The four cut faces, from the bottom up to the terrain's edge.
  const faces = [
    (a, w) => [a, 1, w], // south (front), u = a
    (a, w) => [1 - a, 0, w], // north
    (a, w) => [1, 1 - a, w], // east, v = 1 - a
    (a, w) => [0, a, w], // west
  ];
  const sides = (uvw) => (a, w) => {
    const [u, v] = uvw(a, w);
    const ytop = F.y(height(u, v));
    return [F.x(u), F.bottom + (ytop - F.bottom) * w, F.z(v)];
  };
  faces.forEach((f) => {
    k.add(k.param(sides(f), { grid: 64 }), {
      even: true,
      share: sideShare / 4,
      flat: 0.2,
      jitter: 0.01,
      color: (c) => {
        const m = F.m(c.p[1]);
        const col = o.side ? o.side(m, c) : mix("#6d5a48", "#9b8467", clamp(c.v, 0, 1));
        return shade(col, 0.78 + 0.22 * Math.abs(vec.dot(c.n, vec.unit([-0.3, 0.2, 1]))));
      },
      ...(o.sidePart !== undefined ? { part: o.sidePart } : {}),
    });
  });
  // The bottom.
  k.add(
    k.param((u, v) => [F.x(u), F.bottom, F.z(1 - v)], { grid: 16 }),
    {
      even: true,
      share: 0.02,
      flat: 0.2,
      color: "#3f3529",
    },
  );
}

// ---- Round 2: the land as a grid of splats -----------------------------------------------
// The owner's notes of October 5, 2026 ("please make sharper"): as Science
// r3's terrain box does, every grid sample is one flat splat facing up its
// slope, sized to the grid's spacing, with no random placement, and a steep
// drop is filled down to its lower neighbor so cliffs stay solid.
//
// addGrid(k, o):
//   F, height(u, v) meters, color(c) where c = { u, v, n, m (meters), wall }
//   share        the budget's share for the grid (the samples per side follow)
//   aspect-aware: the longer side gets more samples
//   part, channel, kind(c), params(c), to(c) -> [x, y, z] (a morph target)
//   cliffs       fill steep drops (default true)
//   lift         raise every splat (recipe units), for a layer laid over another
// Returns { n, spacing } in recipe units.
function gridPoints(o, nxWant) {
  const { F, height } = o;
  const nx = Math.max(16, nxWant);
  const nz = Math.max(16, Math.round((nx * F.sz) / F.sx));
  const spacing = (2 * F.sx) / (nx - 1);
  const pts = [];
  const lift = o.lift || 0;
  const Hs = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) Hs[j * nx + i] = height(i / (nx - 1), j / (nz - 1)); // prettier-ignore
  const hAt = (i, j) =>
    Hs[Math.min(nz - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))];
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const m = hAt(i, j);
      const u = i / (nx - 1);
      const v = j / (nz - 1);
      const y = F.y(m) + lift;
      const dx = (F.y(hAt(i + 1, j)) - F.y(hAt(i - 1, j))) / (2 * spacing);
      const dz = (F.y(hAt(i, j + 1)) - F.y(hAt(i, j - 1))) / (2 * spacing);
      const n = vec.unit([-dx, 1, -dz]);
      pts.push({ p: [F.x(u), y, F.z(v)], n, u, v, m, wall: false });
      if (o.cliffs === false) continue;
      // A drop steeper than a spacing to a neighbor: fill the wall down to it.
      for (const [a, b, dir] of [
        [i + 1, j, [1, 0, 0]],
        [i - 1, j, [-1, 0, 0]],
        [i, j + 1, [0, 0, 1]],
        [i, j - 1, [0, 0, -1]],
      ]) {
        // prettier-ignore
        if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
        const yn = F.y(hAt(a, b)) + lift;
        const drop = y - yn;
        if (drop <= spacing * 0.9) continue;
        const steps = Math.min(40, Math.floor(drop / (spacing * 0.75)));
        for (let s = 1; s <= steps; s++) {
          const f = s / (steps + 1);
          const yy = y - drop * f;
          pts.push({
            p: [F.x(u) + dir[0] * spacing * 0.5, yy, F.z(v) + dir[2] * spacing * 0.5],
            n: dir,
            u: u + (dir[0] * 0.5) / (nx - 1),
            v: v + (dir[2] * 0.5) / (nz - 1),
            m: F.m(yy - lift),
            wall: true,
          });
        }
      }
    }
  return { pts, nx, nz, spacing };
}

export function addGrid(k, o) {
  const want = Math.max(4000, (o.share ?? 0.7) * k.count);
  // Steep land needs many wall splats: shrink the grid until it all fits.
  let nx0 = Math.round(Math.sqrt((want * o.F.sx) / o.F.sz));
  let g = gridPoints(o, nx0);
  for (let tries = 0; tries < 4 && g.pts.length > want * 1.15; tries++) {
    nx0 = Math.round(nx0 * Math.sqrt((want / g.pts.length) * 0.98));
    g = gridPoints(o, nx0);
  }
  const { pts, nx, nz, spacing } = g;
  const base = () => k.baseSize || 0.01;
  const size = spacing * (o.sizeFactor ?? 1.0);
  k.cloud({ count: (pts.length * 160000) / k.count, jitter: 0 }, (_r, idx) => {
    const e = pts[Math.min(pts.length - 1, idx)];
    const out = {
      p: e.p,
      n: e.n,
      flat: 0.3,
      size: size / base(),
      color: o.color(e),
      opacity: o.opacity ?? 1,
    };
    if (o.part !== undefined) out.part = o.part;
    if (o.kind) {
      out.kind = typeof o.kind === "function" ? o.kind(e) : o.kind;
      out.params = typeof o.params === "function" ? o.params(e) : o.params;
    }
    if (o.channel !== undefined) out.channel = o.channel;
    if (o.to) out.to = o.to(e);
    if (o.pattern === false) out.pattern = false;
    return out;
  });
  return { nx, nz, spacing, pts: pts.length };
}

// The block's four cut faces and its bottom as grids of splats, sized like
// the land's (sharp edges, no random placement).
export function addGridSides(k, F, height, { spacing, side, part, bottom = "#3f3529" }) {
  const pts = [];
  const nx = Math.round((2 * F.sx) / spacing) + 1;
  const nz = Math.round((2 * F.sz) / spacing) + 1;
  const edge = (u, v, nrm) => {
    const top = F.y(height(u, v));
    for (let y = F.bottom; y < top - spacing * 0.3; y += spacing * 0.8)
      pts.push({ p: [F.x(u) + nrm[0] * 0.002, y, F.z(v) + nrm[2] * 0.002], n: nrm, m: F.m(y) });
  };
  for (let i = 0; i < nx; i++) {
    const u = i / (nx - 1);
    edge(u, 1, [0, 0, 1]);
    edge(u, 0, [0, 0, -1]);
  }
  for (let j = 0; j < nz; j++) {
    const v = j / (nz - 1);
    edge(1, v, [1, 0, 0]);
    edge(0, v, [-1, 0, 0]);
  }
  for (let j = 0; j < nz; j += 2)
    for (let i = 0; i < nx; i += 2) pts.push({ p: [F.x(i / (nx - 1)), F.bottom, F.z(j / (nz - 1))], n: [0, -1, 0], m: null }); // prettier-ignore
  const base = () => k.baseSize || 0.01;
  const VIEW = vec.unit([-0.3, 0.2, 1]);
  k.cloud({ count: (pts.length * 160000) / k.count, jitter: 0 }, (_r, idx) => {
    const e = pts[Math.min(pts.length - 1, idx)];
    const col =
      e.m === null ? bottom : shade(side(e.m), 0.78 + 0.22 * Math.abs(vec.dot(e.n, VIEW)));
    const out = { p: e.p, n: e.n, flat: 0.3, size: ((e.m === null ? 2 : 1) * spacing) / base(), color: col, opacity: 1 }; // prettier-ignore
    if (part !== undefined) out.part = part;
    return out;
  });
}

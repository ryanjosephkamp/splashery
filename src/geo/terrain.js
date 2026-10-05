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

// Lane QR r4: the QR code toy's crisp builder (lane QR r3), moved here from
// build.js unchanged so Other barcodes' Data Matrix and Aztec, and Picture
// QR, draw their modules the same way: flat patches of two staggered
// lattices, and crisp shapes whose edges are rings of thin splats.

const Q_FLAT = [0, 0, 0, 1]; // a flat splat facing +Z (its thin axis is z)
const rotZ = (a) => [0, 0, Math.sin(a / 2), Math.cos(a / 2)];

// ---- Crisp edges (lane QR r3) ---------------------------------------------------------
// The owner found the modules a little blurry. A lattice of round splats can
// only end in a soft edge as wide as its splats, so a shape's edges are now
// drawn by rings of thin splats laid along them: narrow across the edge (the
// outermost ring 0.03 of a module), longer along it, and finer toward sharp
// corners; the middle is the even lattice. TUNE holds the knobs (tools/qr3-
// sharp.mjs measures them); `scale` coarsens them all when a big code would
// not fit the splat budget.
export const TUNE = {
  crisp: true,
  finest: 0.6, // the scale tried first (smaller: finer rings, more splats)
  rings: [0.03, 0.06, 0.11], // each ring's width across the edge (modules)
  stretch: 3, // a ring splat's length along the edge, in ring widths
  minLength: 0.12, // and at least this long (shorter splats vanish on a phone)
  inner: 0.2, // the lattice spacing in the middle
  sheet: 0.34, // the light sheet's lattice spacing
};

// Signed distance to a rectangle with rounded corners (positive outside).
// r: { x0, y0, x1, y1, rad: [top-left, top-right, bottom-right, bottom-left] }.
function rrectSDF(r, px, py) {
  const cx = (r.x0 + r.x1) / 2;
  const cy = (r.y0 + r.y1) / 2;
  const k = px < cx ? (py > cy ? 0 : 3) : py > cy ? 1 : 2;
  const rr = r.rad?.[k] || 0;
  const qx = Math.abs(px - cx) - ((r.x1 - r.x0) / 2 - rr);
  const qy = Math.abs(py - cy) - ((r.y1 - r.y0) / 2 - rr);
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - rr;
}

// The painters, writing splats into `out`. scale: the crisp edges' scale (0:
// the old lattice of round splats, spacing sp).
export function painter(out, { scale = 0, sp = 0.25 } = {}) {
  // A flat patch facing +Z: splats on a grid of spacing s over [x0, x1] x
  // [y0, y1] at depth z, kept where inside(x, y) holds. Each splat reaches
  // about half a spacing past its point, so the points sit half a spacing in
  // from the edge and the patch ends on its edge.
  const flat = (
    x0,
    y0,
    x1,
    y1,
    z,
    s,
    inside,
    color,
    params,
    { opacity = 1, sigma = 0.55, q = Q_FLAT } = {},
  ) => {
    const nx = Math.max(1, Math.round((x1 - x0) / s));
    const ny = Math.max(1, Math.round((y1 - y0) / s));
    const sx = (x1 - x0) / nx;
    const sy = (y1 - y0) / ny;
    const sc = [sigma * sx, sigma * sy, 0.02 * Math.min(sx, sy)];
    // Two staggered lattices: the second fills the low spots between the
    // first's points, so a patch is one even color, not a fine ripple (which
    // reads as speckle up close, and which QR readers' local thresholds can
    // mistake for detail). The second sits only between points of the first,
    // so it never widens the patch.
    for (let layer = 0; layer < 2; layer++)
      for (let j = 0; j < ny - layer; j++)
        for (let i = 0; i < nx - layer; i++) {
          const x = x0 + (i + 0.5 + layer * 0.5) * sx;
          const y = y0 + (j + 0.5 + layer * 0.5) * sy;
          if (inside && !inside(x, y)) continue;
          const col = typeof color === "function" ? color(x, y) : color;
          if (!col) continue;
          out.push({
            p: [x, y, z],
            scales: sc,
            quat: q,
            color: col,
            opacity,
            params,
            pattern: false,
          });
        }
  };
  // A crisp shape (lane QR r3): the rectangle [x0, x1] x [y0, y1] with
  // rounded corners `rad` (top-left, top-right, bottom-right, bottom-left;
  // only where both sides of the corner are open) and an optional hole of
  // the same kind. `open` says which sides are real edges: a side that runs
  // into a dark neighbor gets no ring, and the lattice runs to it. Rings of
  // thin splats lie along every open edge (and the hole's), the outermost
  // narrowest; the lattice fills the middle.
  const OPEN = { l: true, r: true, t: true, b: true };
  const crisp = ({
    x0,
    y0,
    x1,
    y1,
    open = OPEN,
    rad = [0, 0, 0, 0],
    hole = null,
    notches = [],
    z,
    color,
    params,
  }) => {
    // prettier-ignore
    const sides = [open.t && open.l, open.t && open.r, open.b && open.r, open.b && open.l];
    rad = rad.map((v, i) => (sides[i] ? v : 0));
    const dist = (px, py) => {
      let d = Infinity;
      if (open.l) d = Math.min(d, px - x0);
      if (open.r) d = Math.min(d, x1 - px);
      if (open.b) d = Math.min(d, py - y0);
      if (open.t) d = Math.min(d, y1 - py);
      const cs = [[x0 + rad[0], y1 - rad[0], -1, 1], [x1 - rad[1], y1 - rad[1], 1, 1], [x1 - rad[2], y0 + rad[2], 1, -1], [x0 + rad[3], y0 + rad[3], -1, -1]]; // prettier-ignore
      cs.forEach(([ccx, ccy, sx, sy], i) => {
        if (rad[i] > 0 && (px - ccx) * sx > 0 && (py - ccy) * sy > 0)
          d = Math.min(d, rad[i] - Math.hypot(px - ccx, py - ccy));
      });
      if (hole) d = Math.min(d, rrectSDF(hole, px, py));
      // An inside corner: the light module lies beyond it, across both
      // padded sides.
      for (const [nx, ny, sx, sy] of notches)
        d = Math.min(d, (px - nx) * sx > 0 && (py - ny) * sy > 0 ? -1 : Math.hypot(px - nx, py - ny)); // prettier-ignore
      return d;
    };
    if (!scale) {
      flat(x0, y0, x1, y1, z, sp, (px, py) => dist(px, py) >= 0, color, params);
      return;
    }
    const rings = TUNE.rings.map((v) => v * scale);
    const minLen = TUNE.minLength * scale;
    const put = (x, y, along, across, ang) => {
      const col = typeof color === "function" ? color(x, y) : color;
      if (!col) return;
      out.push({ p: [x, y, z], scales: [0.55 * along, 0.55 * across, 0.01], quat: rotZ(ang), color: col, opacity: 1, params, pattern: false }); // prettier-ignore
    };
    // A straight run from a to b; ends at a sharp corner step down to the
    // rings' widths, so the corner stays square.
    const line = (ax, ay, bx, by, across, len, gradeA, gradeB) => {
      const L = Math.hypot(bx - ax, by - ay);
      if (L < 1e-6) return;
      const ang = Math.atan2(by - ay, bx - ax);
      const steps = rings.filter((v) => v < len);
      let sa = gradeA ? steps.slice() : [];
      let sb = gradeB ? steps.slice() : [];
      const sum = (a) => a.reduce((x, y) => x + y, 0);
      while (sum(sa) + sum(sb) > L && (sa.length || sb.length)) {
        if (sa.length >= sb.length) sa.pop();
        else sb.pop();
      }
      const mid = L - sum(sa) - sum(sb);
      const n = mid > 1e-6 ? Math.max(1, Math.ceil(mid / len - 0.15)) : 0;
      const cuts = [...sa, ...Array(n).fill(mid / Math.max(n, 1)), ...sb.reverse()];
      let u = 0;
      for (const w of cuts) {
        const c = (u + w / 2) / L;
        put(ax + (bx - ax) * c, ay + (by - ay) * c, w, across, ang);
        u += w;
      }
    };
    const arc = (cx0, cy0, rr, a0, a1, across, len) => {
      if (rr <= 1e-6) return;
      const n = Math.max(1, Math.ceil((rr * Math.abs(a1 - a0)) / len - 0.15));
      const w = (rr * Math.abs(a1 - a0)) / n;
      for (let i = 0; i < n; i++) {
        const a = a0 + ((i + 0.5) / n) * (a1 - a0);
        put(cx0 + rr * Math.cos(a), cy0 + rr * Math.sin(a), w, across, a + Math.PI / 2);
      }
    };
    // A closed (or partly open) contour of a rounded rectangle, clockwise
    // from the top-left: sides only where `op` says, arcs at rounded corners.
    const contour = (X0, Y0, X1, Y1, rr, op, across, len) => {
      const sharp = [0, 1, 2, 3].map((i) => !rr[i] && [op.t && op.l, op.t && op.r, op.b && op.r, op.b && op.l][i]); // prettier-ignore
      const P = Math.PI;
      if (op.t) line(X0 + rr[0], Y1, X1 - rr[1], Y1, across, len, sharp[0], sharp[1]);
      arc(X1 - rr[1], Y1 - rr[1], rr[1], P / 2, 0, across, len);
      if (op.r) line(X1, Y1 - rr[1], X1, Y0 + rr[2], across, len, sharp[1], sharp[2]);
      arc(X1 - rr[2], Y0 + rr[2], rr[2], 0, -P / 2, across, len);
      if (op.b) line(X1 - rr[2], Y0, X0 + rr[3], Y0, across, len, sharp[2], sharp[3]);
      arc(X0 + rr[3], Y0 + rr[3], rr[3], -P / 2, -P, across, len);
      if (op.l) line(X0, Y0 + rr[3], X0, Y1 - rr[0], across, len, sharp[3], sharp[0]);
      arc(X0 + rr[0], Y1 - rr[0], rr[0], P, P / 2, across, len);
    };
    let d = 0;
    for (const w of rings) {
      const at = d + w / 2; // the ring's middle, in from the edge
      const len = Math.max(minLen, w * TUNE.stretch);
      contour(
        open.l ? x0 + at : x0,
        open.b ? y0 + at : y0,
        open.r ? x1 - at : x1,
        open.t ? y1 - at : y1,
        rad.map((v) => (v > 0 ? Math.max(v - at, 1e-4) : 0)),
        open,
        w,
        len,
      );
      if (hole)
        contour(hole.x0 - at, hole.y0 - at, hole.x1 + at, hole.y1 + at, (hole.rad || [0, 0, 0, 0]).map((v) => (v > 0 ? v + at : 0)), OPEN, w, len); // prettier-ignore
      d += w;
    }
    // The middle: the even lattice, from just inside the rings.
    const s = TUNE.inner * scale;
    flat(x0, y0, x1, y1, z, s, (px, py) => dist(px, py) >= d - 0.25 * s, color, params);
  };
  return { flat, crisp };
}

// A grid of modules: dark(r, c), and each module's center (cx(c), cy(r)).
// pad: how far a dark module's cell reaches into each dark neighbor.
export function moduleGrid({ dark, cx, cy, pad }) {
  // A module's open sides (where its neighbor is light).
  const openOf = (r, c) => ({ l: !dark(r, c - 1), r: !dark(r, c + 1), t: !dark(r - 1, c), b: !dark(r + 1, c) }); // prettier-ignore
  // A module's inside corners: where both neighbors are dark but the module
  // across the corner is light. The lattice keeps clear of them (the
  // neighbors' rings reach in and draw the corner square).
  const notchesOf = (r, c) => {
    const out2 = [];
    for (const [dr, dc] of [[-1, -1], [-1, 1], [1, 1], [1, -1]]) // prettier-ignore
      if (dark(r + dr, c) && dark(r, c + dc) && !dark(r + dr, c + dc)) out2.push([cx(c) + dc * 0.5, cy(r) - dr * 0.5, dc, -dr]); // prettier-ignore
    return out2;
  };
  // roundCell's corner radii, for crisp().
  const roundRad = (r, c, rad = 0.5) => {
    const o = openOf(r, c);
    return [o.t && o.l, o.t && o.r, o.b && o.r, o.b && o.l].map((b) => (b ? rad : 0));
  };

  // A module's cell, reaching `pad` into each dark neighbor so a run of
  // modules closes up with no seam (each module still moves on its own).
  const cell = (r, c) => {
    const x = cx(c);
    const y = cy(r);
    return [
      x - 0.5 - (dark(r, c - 1) ? pad : 0),
      y - 0.5 - (dark(r + 1, c) ? pad : 0),
      x + 0.5 + (dark(r, c + 1) ? pad : 0),
      y + 0.5 + (dark(r - 1, c) ? pad : 0),
    ];
  };
  return { openOf, notchesOf, roundRad, cell };
}

// Pictures and pages (lane Pictures): toys that show a PDF, a picture, a GIF
// or a video as splats, through the picture sheets of src/pictures.js. For
// now one plain test toy, the Picture lab (labs only); the toy lanes that
// follow add the book, the photo album, the frame and the screens.

import { mix, shade } from "../kit.js";

// Each toy's tap state (one toy is shown at a time).
const LAB = { tapN: 0 };

// ---- Your book (lane Books) -------------------------------------------------------
//
// A PDF made into a book you page through. The book stands facing you, its
// spine up the middle (k.spine along -Y, so a leaf turns toward you), and
// every page is a picture sheet on a leaf (kind "leaf"): it turns about the
// spine and curls as it goes over, one solid sheet.
//
// Leaves cycle through four leaf slots (0 to 3), each a front and a back
// sheet: leaf j (j >= 1) carries pages 2j - 1 and 2j and sits in slot j % 4.
// On spread K the left page is leaf K - 1's back and the right page leaf K's
// front; page 0 is on the front cover. The pages a turn uncovers are built
// ahead, hidden (`ahead`), and a turn waits until they are ready. Splats sort
// in the pose they were built in, so while leaves and the cover turn the
// recipe asks for them to be sorted where they stand (out.resortPose).
//
// Stapled paper is bound at the top: sheet j carries page j alone and turns
// up and over the top edge to hang behind the stack.

const PAGE_H = 1; // the page's height, in recipe units; its width follows the PDF
const SAMPLE_ASPECT = 612 / 792; // the sample article (US Letter)
// Layers sit well apart: splats sort by their centers, so a page too close
// over another surface mixes with it where the view is tilted.
const E = 0.003; // how far a page's front and back sit off the leaf's middle
const C0 = 0.014; // the gap between the top page and the front cover
const TOP = -0.014; // the top of a page block, under the pages

// Per style: how it is bound, the cover, the thickness of each half's page
// block (T), the cover's thickness (cb) and overhang (ov), the gap from the
// spine to the pages (g), and how much a turning page (curl) and a flexing
// cover (coverCurl) bend, in radians per unit of page at the middle of a turn.
const BOOK_STYLES = {
  hardcover: { bound: "side", cover: "board", T: 0.045, cb: 0.024, ov: 0.03, g: 0, curl: 1.25, coverCurl: 0 }, // prettier-ignore
  paperback: { bound: "side", cover: "card", T: 0.036, cb: 0.005, ov: 0, g: 0, curl: 1.25, coverCurl: 1.0 }, // prettier-ignore
  magazine: { bound: "side", cover: "card", T: 0.024, cb: 0.0025, ov: 0, g: 0, curl: 1.6, coverCurl: 1.5 }, // prettier-ignore
  spiral: { bound: "side", cover: "card", T: 0.03, cb: 0.006, ov: 0, g: 0.05, curl: 0.7, coverCurl: 0.5 }, // prettier-ignore
  stapled: { bound: "top", T: 0.026, curl: 1.3 },
};

const BOOK = { K: 0, anim: null, queue: [], tapN: 0, lastPage: 0, style: null, dims: null, frame: 0, landed: 0, press: null, N: 0 }; // prettier-ignore

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
// A page's turn: it lifts at once and lands softly (no pause at the start,
// when the page would only bend where it lies).
const easeTurn = (x) => 0.5 - 0.5 * Math.cos(Math.PI * x);

// Baked light from the upper left, in front.
const BK_LIGHT = (() => {
  const l = [-0.35, 0.6, 0.72];
  const n = Math.hypot(...l);
  return l.map((v) => v / n);
})();
function bkLit(col, n, amb = 0.72, dif = 0.3) {
  const d = Math.max(0, n[0] * BK_LIGHT[0] + n[1] * BK_LIGHT[1] + n[2] * BK_LIGHT[2]);
  return shade(col, amb + dif * d);
}

// A flat rectangle of splats with clean, sharp edges (the method of lane
// Fidelity A: even placement, full opacity, flat splats on the face and thin
// ones along its edges). A staggered lattice of flat discs fills the middle,
// stopping short of the edges so no splat spills over them; a band of
// discs half the size runs round it, and a line of thin splats along each
// edge draws the edge itself. `at` is a corner, `u` and `v` its edges
// (recipe units), `n` the side it faces; `color(a, b, p)` gets the place
// along u and v (0..1). `leaf` = { slot, S, at, dir } makes every splat turn
// with that leaf (its distance from the spine in toy units: S is the fit's
// scale).
function rect(
  k,
  {
    share,
    at,
    u,
    v,
    n,
    color,
    part = 0,
    leaf = null,
    opacity = 1,
    size = 1,
    kind = null,
    params = null,
  },
) {
  const lu = Math.hypot(...u);
  const lv = Math.hypot(...v);
  const eu = u.map((x) => x / lu);
  const ev = v.map((x) => x / lv);
  const splat = (x, y, extra) => {
    const a = x / lu;
    const b = y / lv;
    const p = [0, 1, 2].map((q) => at[q] + u[q] * a + v[q] * b);
    const s = { p, color: color(a, b, p), opacity, part, ...extra };
    if (kind) {
      s.kind = kind;
      s.params = params;
      s.channel = 0;
    }
    if (leaf) {
      s.kind = "leaf";
      const d = (p[0] - leaf.at[0]) * leaf.dir[0] + (p[1] - leaf.at[1]) * leaf.dir[1] + (p[2] - leaf.at[2]) * leaf.dir[2]; // prettier-ignore
      s.params = [d * leaf.S, leaf.slot];
    }
    return s;
  };
  // A staggered lattice of discs, spacing about h, inset from the edges,
  // leaving out the points inside `core` ([cu, cv]: that far in from the
  // edges) if given. With no list it only counts them.
  const lattice = (list, h, inset, core) => {
    const axis = (l, i0) => {
      const g = Math.max(1, Math.round((l - 2 * i0) / h) + 1);
      const s = g > 1 ? (l - 2 * i0) / (g - 1) : 0;
      const a = [];
      for (let i = 0; i < g; i++) a.push(g > 1 ? i0 + i * s : l / 2);
      const b = [];
      for (let i = 0; i < g - 1; i++) b.push(i0 + (i + 0.5) * s);
      return { a, b, s };
    };
    const U = axis(lu, Math.min(lu / 2, inset));
    const V = axis(lv, Math.min(lv / 2, inset));
    const inU = (x) => core && x >= core[0] && x <= lu - core[0];
    const inV = (y) => core && y >= core[1] && y <= lv - core[1];
    if (!list) {
      const n = (xs, ys) => xs.length * ys.length - (core ? xs.filter(inU).length * ys.filter(inV).length : 0); // prettier-ignore
      return n(U.a, V.a) + n(U.b, V.b);
    }
    const sz = (0.55 * Math.max(U.s, V.s, h * 0.5) * size) / 0.01;
    for (const [xs, ys] of [
      [U.a, V.a],
      [U.b, V.b],
    ])
      for (const y of ys)
        for (const x of xs) if (!(inU(x) && inV(y))) list.push([x, y, { n, size: sz, flat: 0.06 }]);
    return 0;
  };
  // The places of every splat for a spacing h (or, with no list, how many).
  const layout = (h, list = null) => {
    const sig = 0.55 * h;
    // The middle: its outer splats' glow ends at the edge.
    const ci = 2 * sig;
    let count = lattice(list, h, ci, null);
    // The band round it, finer.
    count += lattice(list, h / 2, sig, [Math.min(lu / 2, ci), Math.min(lv / 2, ci)]);
    // A line of thin splats along each edge, a little inside it. (Its
    // ends stop short of the corners, so no thin splat pokes out.)
    const e = 0.22 * h;
    const line = (x0, y0, dir, len0) => {
      const cut = Math.min(0.3 * h, len0 / 4);
      const len = len0 - 2 * cut;
      const m = Math.max(1, Math.round(len / (0.5 * h)));
      count += m;
      if (list)
        for (let i = 0; i < m; i++) {
          const d = cut + ((i + 0.5) / m) * len;
          const x = x0 + (dir === eu ? d : 0);
          const y = y0 + (dir === ev ? d : 0);
          list.push([x, y, { dir, stretch: 2.4, size: (0.17 * h * size) / 0.01 }]);
        }
    };
    if (lv > 3 * e && lu > 3 * e) {
      line(e, e, eu, lu - 2 * e);
      line(e, lv - e, eu, lu - 2 * e);
      line(e, e, ev, lv - 2 * e);
      line(lu - e, e, ev, lv - 2 * e);
    } else if (lu >= lv) line(e, lv / 2, eu, lu - 2 * e);
    else line(lu / 2, e, ev, lv - 2 * e);
    return count;
  };
  let cache = null;
  k.cloud({ share, pattern: false, flat: 0.06 }, (rand, i, total) => {
    if (!cache || cache.total !== total) {
      // The spacing that fills the share: start from the plain lattice's
      // and adjust (counting only), then lay the splats out once; they are
      // made as they are asked for.
      let h = Math.sqrt((lu * lv) / Math.max(1, total / 2));
      let c = layout(h);
      for (let it = 0; it < 12 && (c > total || c < 0.92 * total); it++) {
        h *= Math.sqrt(c / total) * (c > total ? 1.01 : 0.995);
        c = layout(h);
      }
      for (let it = 0; it < 40 && c > total; it++) c = layout((h *= 1.02));
      const list = [];
      layout(h, list);
      list.length = Math.min(list.length, total);
      cache = { total, list };
    }
    const at = cache.list[i];
    return at ? splat(...at) : null;
  });
}

// The picture frame's flat rectangle (as it was when the owner marked the
// frame good): two staggered lattices of flat discs (smooth,
// no speckle, like a sheet's paper). `at` is a corner, `u` and `v` its edges
// (recipe units), `n` the side it faces; `color(a, b)` gets the place along
// u and v (0..1). `leaf` = { slot, S, at, dir } makes every splat turn with
// that leaf (its distance from the spine in toy units: S is the fit's scale).
function plainRect(
  k,
  {
    share,
    at,
    u,
    v,
    n,
    color,
    part = 0,
    leaf = null,
    opacity = 0.99,
    size = 1,
    kind = null,
    params = null,
  },
) {
  // prettier-ignore
  const lu = Math.hypot(...u);
  const lv = Math.hypot(...v);
  k.cloud({ share, pattern: false, flat: 0.06 }, (rand, i, total) => {
    const half = Math.max(2, Math.floor(total / 2));
    const gu = Math.max(1, Math.round(Math.sqrt((half * lu) / lv)));
    const gv = Math.max(1, Math.round(half / gu));
    const step = Math.max(lu / gu, lv / gv);
    const second = i >= gu * gv;
    const j = second ? i - gu * gv : i;
    if (j >= gu * gv) return null;
    const iu = j % gu;
    const iv = Math.floor(j / gu);
    if (second && (iu === gu - 1 || iv === gv - 1)) return null;
    const a = (iu + (second ? 1 : 0.5)) / gu;
    const b = (iv + (second ? 1 : 0.5)) / gv;
    const p = [0, 1, 2].map((q) => at[q] + u[q] * a + v[q] * b);
    const s = {
      p,
      n,
      color: color(a, b, p),
      size: (0.55 * step * size) / 0.01,
      opacity,
      part,
    };
    if (kind) {
      s.kind = kind;
      s.params = params;
      s.channel = 0;
    }
    if (leaf) {
      s.kind = "leaf";
      const d = (p[0] - leaf.at[0]) * leaf.dir[0] + (p[1] - leaf.at[1]) * leaf.dir[1] + (p[2] - leaf.at[2]) * leaf.dir[2]; // prettier-ignore
      s.params = [d * leaf.S, leaf.slot];
    }
    return s;
  });
}

// Spreads the whole splat budget over the toy's shapes, keeping their
// proportions (every shape here has a share of its own).
function useBudget(k, total = 0.95) {
  const items = k.items.filter((it) => it.opts.share !== undefined);
  const sum = items.reduce((a, it) => a + it.opts.share, 0);
  if (sum > 0) for (const it of items) it.opts.share *= total / sum;
}

// A box's faces as rects (only the listed ones): x0..x1, y0..y1, z0..z1.
function boxFaces(k, [x0, x1], [y0, y1], [z0, z1], faces, opts) {
  const F = {
    front: { at: [x0, y0, z1], u: [x1 - x0, 0, 0], v: [0, y1 - y0, 0], n: [0, 0, 1] },
    back: { at: [x0, y0, z0], u: [x1 - x0, 0, 0], v: [0, y1 - y0, 0], n: [0, 0, -1] },
    right: { at: [x1, y0, z0], u: [0, 0, z1 - z0], v: [0, y1 - y0, 0], n: [1, 0, 0] },
    left: { at: [x0, y0, z0], u: [0, 0, z1 - z0], v: [0, y1 - y0, 0], n: [-1, 0, 0] },
    top: { at: [x0, y1, z0], u: [x1 - x0, 0, 0], v: [0, 0, z1 - z0], n: [0, 1, 0] },
    bottom: { at: [x0, y0, z0], u: [x1 - x0, 0, 0], v: [0, 0, z1 - z0], n: [0, -1, 0] },
  };
  for (const [name, o] of Object.entries(faces)) {
    const f = F[name];
    rect(k, { ...opts, ...o, at: f.at, u: f.u, v: f.v, n: f.n, color: o.color });
  }
}

// Pages and spreads. Side-bound: spread 0 is the closed book; spread K >= 1
// shows page 2K - 2 on the left (none on spread 1, the cover's inside) and
// 2K - 1 on the right. Top-bound: "spread" K is sheet K on top.
//
// The photo album uses the same leaves with "sides" in place of pages
// (BOOK.sides: the photos on each side of each leaf, side 0 the cover), and
// its own sheets per side (BOOK.sheetsOf).
function bookCount(pics) {
  if (BOOK.sides) return pics && !pics.count ? 0 : BOOK.sides.length;
  if (!pics) return 7; // no pictures (the Node tests): a short made-up book
  return pics.count || 0;
}
function lastSpread(st, N) {
  return st.bound === "top" ? Math.max(0, N - 1) : Math.floor((N + 1) / 2);
}
function spreadPage(st, K, N) {
  if (st.bound === "top") return K;
  if (BOOK.sides) {
    // The picture a spread starts with: the first on its right, else left.
    const on = (side) => BOOK.sides[side]?.[0];
    return K <= 0 ? 0 : (on(2 * K - 1) ?? on(2 * K - 2) ?? 0);
  }
  return K <= 0 ? 0 : Math.min(2 * K - 1, N - 1);
}
function sideSpread(p) {
  return p <= 0 ? 0 : p % 2 ? (p + 1) / 2 : p / 2 + 1;
}
function pageSpread(st, p) {
  if (st.bound === "top") return Math.max(0, p);
  if (BOOK.sides) return sideSpread(BOOK.sideOf?.[p] ?? 0);
  return sideSpread(p);
}
// The sheets that show one side of the leaf in slot i ("f" front, "b"
// back): [{ id, page }], page -1 for a sheet that side does not use.
function sheetsOf(i, fb, side) {
  if (BOOK.sheetsOf) return BOOK.sheetsOf(i, fb, side);
  return [{ id: `${fb}${i}`, page: side }];
}

// Starts a turn from the current spread to K2 (a jump of more than one
// spread, from a link or a page number, happens at once).
function bookGo(K2, time, pics, N) {
  const st = BOOK.style;
  const Kmax = lastSpread(st, N);
  K2 = Math.max(0, Math.min(Kmax, K2));
  const K = BOOK.K;
  if (K2 === K) return;
  let type = null;
  if (st.bound === "top") {
    if (K2 === K + 1) type = "fwd";
    else if (K2 === K - 1) type = "back";
    else if (K2 === 0) type = "restart";
  } else {
    if (K2 === K + 1) type = K === 0 ? "open" : "fwd";
    else if (K2 === K - 1) type = K === 1 ? "shut" : "back";
    else if (K2 === 0) type = "close";
  }
  const page = spreadPage(st, K2, N);
  BOOK.lastPage = page;
  if (pics && pics.page !== page) pics.go(page);
  if (!type) {
    BOOK.K = K2;
    BOOK.anim = null;
    BOOK.landed = 3;
    return;
  }
  const dur = type === "open" || type === "shut" ? 1.1 : type === "close" || type === "restart" ? 1.05 : 0.95; // prettier-ignore
  BOOK.anim = { type, from: K, to: K2, t0: null, asked: time, dur };
}

// The layout for the current moment: every leaf slot's angle, curl, pages
// and which of its sides show; the cover; the left page block.
function bookLayout(st, N, time, uAt = null) {
  const L = {
    slots: [0, 1, 2, 3].map(() => ({ angle: 0, curl: 0, f: -1, b: -1, fv: 0, bv: 0, ahead: 0 })),
    cover: 0,
    coverCurl: 0,
    open: 0, // how far the book has opened (the body slides)
    block: 0, // the left page block's angle
    blockOn: 0, // whether it shows (from spread 2 on: pages lie on the left)
  };
  const leaf = (j, o) => {
    if (j < 1) return;
    const s = L.slots[j % 4];
    Object.assign(s, { angle: 0, curl: 0, ahead: 0, fv: 0, bv: 0 }, o);
    s.f = st.bound === "top" ? j : 2 * j - 1;
    s.b = st.bound === "top" ? -1 : 2 * j;
  };
  const a = BOOK.anim;
  // A turn waiting for its pages (t0 null) holds at its start. A pulled
  // page goes where the finger takes it (pullV). The curl follows the
  // page's own angle, so it never bends before it lifts.
  let u;
  let v;
  if (uAt === null && a?.pull) u = v = pullV(a, time);
  else {
    u = uAt ?? (a ? (a.t0 === null ? 0 : clamp01((time - a.t0) / a.dur)) : 1);
    v = easeTurn(u);
  }
  const bend = Math.sin(Math.PI * v) * (a?.pull?.bendK ?? 1);
  // The page under a turning leaf shows once the leaf has lifted clear of it
  // (about 17 degrees): before that the two lie too close and mix.
  const lifted = Math.PI * v > 0.3;
  // Likewise, the page a turning leaf lands on hides once the leaf is within
  // about 17 degrees of it (shown until the very end, the two mixed for a
  // few frames: the old page's figure showed through the new one).
  const landing = Math.PI * v > Math.PI - 0.3;
  const K = a ? a.from : BOOK.K;
  if (st.bound === "top") {
    // Leaf j here is sheet j; sheet 0 sits in slot 0 like the others.
    const sheet = (j, o) => {
      if (j < 0 || j >= N) return;
      const s = L.slots[j % 4];
      Object.assign(s, { angle: 0, curl: 0, ahead: 0, fv: 0, bv: 0 }, o);
      s.f = j;
      s.b = -1;
    };
    if (!a) {
      sheet(K + 1, { fv: 0, ahead: 1 });
      sheet(K - 1, { angle: OVER, fv: 0, ahead: 1 });
      sheet(K, { fv: 1 });
    } else if (a.type === "fwd") {
      sheet(K + 1, { fv: lifted ? 1 : 0, ahead: 1 });
      sheet(K, { angle: OVER * v, curl: -st.curl * bend, fv: u < 1 ? 1 : 0 });
    } else if (a.type === "back") {
      sheet(K, { fv: OVER * (1 - v) > 0.3 ? 1 : 0 });
      sheet(K - 1, { angle: OVER * (1 - v), curl: st.curl * bend, fv: 1 });
    } else {
      sheet(K, { fv: OVER * (1 - v) > 0.3 ? 1 : 0 });
      sheet(0, { angle: OVER * (1 - v), curl: st.curl * bend, fv: 1 });
    }
    return L;
  }
  // Side-bound. The pages a turn will need are built ahead (parked).
  const right = Math.max(K, 1);
  if (!a) {
    leaf(right + 1, { ahead: 1 });
    if (K >= 3) leaf(K - 2, { angle: Math.PI, ahead: 1 });
    // (Both sides of the left leaf are built: a pull back shows its front.)
    if (K >= 2) leaf(K - 1, { angle: Math.PI, bv: 1, ahead: 1 });
    leaf(right, { fv: 1, ahead: 1 });
    L.cover = K >= 1 ? Math.PI : 0;
    L.open = K >= 1 ? 1 : 0;
    L.block = L.cover;
    L.blockOn = K >= 2 ? 1 : 0;
    return L;
  }
  if (a.type === "open" || a.type === "shut") {
    const w = a.type === "open" ? v : 1 - v;
    leaf(2, { ahead: 1 });
    leaf(1, { fv: 1, ahead: 1 });
    L.cover = Math.PI * w;
    L.coverCurl = (a.type === "open" ? -1 : 1) * st.coverCurl * bend;
    L.open = w;
  } else if (a.type === "fwd") {
    if (K >= 3) leaf(K - 2, { angle: Math.PI, ahead: 1 });
    if (K >= 2) leaf(K - 1, { angle: Math.PI, bv: landing ? 0 : 1 });
    leaf(K + 1, { fv: lifted ? 1 : 0, ahead: 1 });
    leaf(K, { angle: Math.PI * v, curl: -st.curl * bend, fv: 1, bv: 1 });
    L.cover = Math.PI;
    L.open = 1;
  } else if (a.type === "back") {
    leaf(K + 1, { ahead: 1 });
    leaf(K, { fv: landing ? 0 : 1, ahead: 1 });
    if (K >= 3) leaf(K - 2, { angle: Math.PI, bv: lifted ? 1 : 0, ahead: 1 });
    leaf(K - 1, { angle: Math.PI * (1 - v), curl: st.curl * bend, fv: 1, bv: 1 });
    L.cover = Math.PI;
    L.open = 1;
  } else {
    // "close": the whole left half (the cover, its page block and the page
    // on top) swings back over the right.
    const ang = Math.PI * (1 - v);
    leaf(K, { fv: landing ? 0 : 1 });
    if (K >= 2) leaf(K - 1, { angle: ang, curl: st.coverCurl * 0.6 * bend, bv: 1 });
    L.cover = ang;
    L.coverCurl = st.coverCurl * 0.6 * bend;
    L.open = 1 - v;
  }
  // The left page block rides with the cover's free edge, so it stays
  // inside a cover that flexes.
  // The left page block shows once a page lies on the left (it appears
  // under the first page as it lands, and goes as that page lifts off); in
  // a close it swings over with the cover, riding its free edge so it stays
  // inside a cover that flexes.
  L.block = Math.max(0, Math.min(Math.PI, L.cover + L.coverCurl * BOOK.dims.W));
  if (a.type === "fwd") L.blockOn = K >= 2 || landing ? 1 : 0;
  else if (a.type === "back") L.blockOn = K >= 3 || u < 0.03 ? 1 : 0;
  else if (a.type === "close") L.blockOn = 1;
  return L;
}

// A pulled page's progress (0 flat where it was, 1 turned): it follows the
// finger with a little lag (more for the album's heavy pages); let go, it
// finishes the turn or falls back.
function pullV(a, time) {
  const P = a.pull;
  if (!P.release) {
    const dt = Math.max(0, time - P.tLast);
    P.tLast = time;
    P.v += (P.target - P.v) * (1 - Math.exp(-dt / P.lag));
    return P.v;
  }
  const R = P.release;
  const w = clamp01((time - R.t0) / R.dur);
  P.v = R.v0 + (R.to - R.v0) * (1 - Math.pow(1 - w, 3));
  return P.v;
}

// Where a tap lands says which way to turn: on a book that turns sideways,
// the left page goes back and the right page (or the middle) forward; on
// stapled paper, the top quarter of the page goes back. A closed book opens
// wherever it's tapped. (The pick rides along with the tap; drive reads it.)
function bookTapAt(p) {
  const st = BOOK.style;
  if (!st || !BOOK.dims) return null;
  const K = BOOK.anim ? BOOK.anim.to : BOOK.K;
  const { H } = BOOK.dims;
  const back = st.bound === "top" ? p[1] > H / 4 : K >= 1 && p[0] < 0;
  return { key: "turn", pick: back ? 1 : 0 };
}

// Pulling a page (recipe.drag). A press on a page claims the drag; once it
// moves the way the page turns, the page follows the finger: the point
// grabbed stays under it as the page swings about the spine, the paper
// curling from it. Let go past halfway, or with a flick, and the page
// finishes its turn; otherwise it falls back. A press that doesn't move is
// a tap (the tap then turns the page by itself).
const BOOK_PULL = { lag: 0.035, finish: 0.5, flick: 1.6, slow: 1, bendK: 1 };
const ALBUM_PULL = { lag: 0.12, finish: 0.58, flick: 2.3, slow: 1.3, bendK: 0.7 };
const OVER = 2 * Math.PI - 0.06; // a stapled sheet turned over the top, hanging behind
function bookDrag(opts) {
  const pullTarget = (P, p) => {
    const { W, H } = BOOK.dims;
    if (P.top) {
      const A = Math.acos(Math.max(-1, Math.min(1, (H / 2 - p[1]) / P.r0)));
      return A / OVER;
    }
    if (!P.r0) return clamp01((P.dir * (P.x0 - p[0])) / (1.6 * W));
    return Math.acos(Math.max(-1, Math.min(1, (P.dir * p[0]) / P.r0))) / Math.PI;
  };
  return {
    plane: "view",
    at(p) {
      const st = BOOK.style;
      if (!st || !BOOK.dims || !BOOK.N || BOOK.anim || BOOK.queue.length) return false;
      const { W, H, g } = BOOK.dims;
      if (Math.abs(p[1]) > H / 2 + 0.06) return false;
      if (st.bound === "top") return Math.abs(p[0]) <= W / 2 + 0.06;
      // (The closed book has slid over to the middle: all of it is cover.)
      return BOOK.K === 0 || Math.abs(p[0]) <= g + W + 0.06;
    },
    start(p, time) {
      BOOK.press = { p0: p.slice(), t0: time };
    },
    move(p, time) {
      const pr = BOOK.press;
      const st = BOOK.style;
      if (!pr || !st) return;
      const { W, H } = BOOK.dims;
      const N = BOOK.N;
      const K = BOOK.K;
      let a = BOOK.anim;
      if (!a) {
        // Which way: the page must move the way it turns.
        const dx = p[0] - pr.p0[0];
        const dy = p[1] - pr.p0[1];
        let dir = 0;
        let type = null;
        let r0 = 0;
        let top = false;
        if (st.bound === "top") {
          if (dy < 0.04 || K >= N - 1) return;
          dir = 1;
          type = "fwd";
          top = true;
          r0 = Math.max(0.1 * H, H / 2 - pr.p0[1]);
        } else {
          if (Math.abs(dx) < 0.04) return;
          const onLeft = K >= 1 && pr.p0[0] < 0;
          if (!onLeft && dx < 0 && K < lastSpread(st, N)) dir = 1;
          else if (onLeft && dx > 0) dir = -1;
          else return;
          type = dir > 0 ? (K === 0 ? "open" : "fwd") : K === 1 ? "shut" : "back";
          // The cover of a closed book (it has slid over) and a cover
          // closing follow the finger's travel; a page, the point grabbed.
          if (type === "fwd" || type === "back") r0 = Math.max(0.15 * W, Math.abs(pr.p0[0]));
        }
        const K2 = K + dir;
        a = BOOK.anim = {
          type,
          from: K,
          to: K2,
          t0: time,
          asked: time,
          dur: 1,
          go: spreadPage(st, K2, N),
          pull: { v: 0, target: 0, tLast: time, lag: opts.lag, bendK: opts.bendK, r0, dir, top, x0: pr.p0[0], hist: [], release: null }, // prettier-ignore
        };
      }
      const P = a.pull;
      if (!P || P.release) return;
      P.target = clamp01(pullTarget(P, p));
      P.hist.push([P.target, time]);
      if (P.hist.length > 6) P.hist.shift();
    },
    end(time) {
      const a = BOOK.anim;
      BOOK.press = null;
      const P = a?.pull;
      if (!P || P.release) return;
      // How fast the page was going as it was let go (a flick).
      const h = P.hist;
      const old = h.find(([, t]) => time - t < 0.15) || h[0];
      const last = h[h.length - 1];
      const speed = old && last && last[1] > old[1] ? (last[0] - old[0]) / (last[1] - old[1]) : 0;
      const half = (P.top ? Math.PI / 2 / OVER : 0.5) * (opts.finish / 0.5);
      const go = P.v > half || speed > opts.flick;
      const left = go ? 1 - P.v : P.v;
      P.release = { t0: time, v0: P.v, to: go ? 1 : 0, dur: Math.max(0.2, left * (P.top ? 1.4 : 0.95) * opts.slow) }; // prettier-ignore
    },
  };
}

const BOOK_RECIPE = {
  // A book you page through: it keeps still, facing you.
  turntable: false,
  tiltLock: true, // a drag only spins it left and right (PACKS.md 5c)
  density: 1,
  // Frames keep coming while a page turns (a turn can start from the Toy
  // tab's page buttons, not only from a tap).
  alive: () => !!BOOK.anim || BOOK.queue.length > 0 || BOOK.landed > 0 || !!BOOK.press,
  options: [
    {
      key: "style",
      label: "Style",
      type: "select",
      default: "hardcover",
      choices: [
        { id: "hardcover", label: "Hardcover" },
        { id: "paperback", label: "Paperback" },
        { id: "magazine", label: "Magazine" },
        { id: "stapled", label: "Stapled paper" },
        { id: "spiral", label: "Spiral notebook" },
      ],
    },
    { key: "color", label: "Cover color", type: "color", default: "#2f4b6e" },
  ],
  controls: [{ key: "turn", label: "Turn the page", type: "pulse", ease: 1.2 }],
  action: { key: "turn", label: "Turn the page", at: bookTapAt },
  drag: bookDrag(BOOK_PULL),
  pictures: {
    // The Tinkerer's Manual (lane Manual), 25 Letter pages.
    sample: () => "manual/tinkerers-manual.pdf",
    accept: ["pdf"],
  },
  input: {
    title: "Your own book",
    media: { accept: ["pdf"] },
    note: "Open a PDF of any length, or paste a web address to one, and page through it with a tap or the buttons. Your file stays on this device; nothing is uploaded.",
  },
  drive(t, c, out, info) {
    const st = BOOK.style;
    if (!st) return;
    const D = BOOK.dims;
    const pics = info.data?.pictures;
    const N = bookCount(pics);
    const time = info.time ?? t;
    const n = info.tap?.n ?? 0;
    if (n < BOOK.tapN) BOOK.tapN = 0;
    if (n > BOOK.tapN) {
      BOOK.tapN = n;
      if (N && BOOK.queue.length < 3) BOOK.queue.push(info.tap?.pick === 1 ? -1 : 1);
    }
    BOOK.N = N;
    const a = BOOK.anim;
    if (a?.go !== undefined) {
      // A pull just began: show the pages it turns to.
      BOOK.lastPage = a.go;
      if (pics && pics.page !== a.go) pics.go(a.go);
      delete a.go;
    }
    if (a?.pull) {
      // A pull ends once the page has finished its turn, or fallen back.
      const R = a.pull.release;
      if (R && time - R.t0 >= R.dur) {
        BOOK.K = R.to ? a.to : a.from;
        BOOK.anim = null;
        BOOK.landed = 3;
        if (!R.to) {
          BOOK.lastPage = spreadPage(st, BOOK.K, N);
          if (pics && pics.page !== BOOK.lastPage) pics.go(BOOK.lastPage);
        }
      }
    } else if (a && a.t0 === null) {
      // A turn starts once the pages it shows are built (at most a second
      // and a half on: a page that fails to build should not stop the book).
      const mid = bookLayout(st, N, time, 0.5);
      const want = [];
      const need = (i, fb, side) => {
        if (side < 0 || side >= N) return;
        for (const x of sheetsOf(i, fb, side)) if (x.page >= 0) want.push(x.id);
      };
      mid.slots.forEach((s, i) => {
        if (s.fv) need(i, "f", s.f);
        if (s.bv) need(i, "b", s.b);
      });
      if (!pics || time - a.asked > 1.5 || want.every((id) => pics.ready(id))) a.t0 = time;
    }
    if (a && !a.pull && a.t0 !== null && time - a.t0 >= a.dur) {
      BOOK.K = a.to;
      BOOK.anim = null;
      BOOK.landed = 3; // sorted again where everything came to rest
    }
    if (N && !BOOK.anim) {
      if (pics && pics.page !== BOOK.lastPage) {
        // The Toy tab's Previous and Next step one spread; any other page
        // (a link, a jump) opens the spread that shows it.
        const d = pics.page - BOOK.lastPage;
        const K2 = d === 1 ? BOOK.K + 1 : d === -1 ? BOOK.K - 1 : pageSpread(st, pics.page);
        BOOK.lastPage = pics.page;
        bookGo(K2, time, pics, N);
      } else if (BOOK.queue.length > 0) {
        if (BOOK.queue.shift() > 0)
          bookGo(BOOK.K < lastSpread(st, N) ? BOOK.K + 1 : 0, time, pics, N);
        else if (BOOK.K > 0) bookGo(BOOK.K - 1, time, pics, N);
      }
    }
    const L = bookLayout(st, N, time);
    out.sheets = BOOK.sides ? {} : { cover: { page: 0, visible: N ? 1 : 0 } };
    out.leaves = [];
    const put = (i, fb, side, vis, ahead) => {
      for (const x of sheetsOf(i, fb, side)) {
        const on = x.page >= 0 && side >= 0 && side < N;
        out.sheets[x.id] = { page: on ? x.page : -1, visible: on ? vis : 0, ahead: on ? ahead : 0 };
      }
    };
    L.slots.forEach((s, i) => {
      out.leaves[i] = { angle: s.angle, curl: s.curl };
      put(i, "f", s.f, s.fv, s.ahead);
      if (st.bound === "side") put(i, "b", s.b, s.bv, s.ahead);
    });
    // Splats sort where they were built: while things turn, every second
    // frame (and a few frames after they land) they are sorted where they
    // stand.
    BOOK.frame++;
    if ((BOOK.anim?.t0 != null && BOOK.frame % 2 === 0) || BOOK.landed > 0) {
      out.resortPose = true;
      BOOK.landed = Math.max(0, BOOK.landed - 1);
    }
    if (st.bound === "side") {
      if (st.cover === "board") out.parts.cover = { angle: L.cover };
      else out.leaves[8] = { angle: L.cover, curl: L.coverCurl };
      out.parts.lblock = { angle: L.block, visible: L.blockOn && L.block > 0.02 ? 1 : 0 };
      // The spine lies under the gutter once the book is open (hidden there).
      if (st.g === 0) out.parts.spine = { angle: L.cover / 2, visible: L.cover < 0.55 * Math.PI ? 1 : 0 }; // prettier-ignore
      // The closed book slides to the middle, and back as it opens.
      const R = info.R || 1;
      out.body = { offset: [(-(1 - L.open) * (D.g + D.W / 2) * D.S) / R, 0, 0] };
    }
  },
  build(k, o) {
    const st = BOOK_STYLES[o.style] || BOOK_STYLES.hardcover;
    const H = PAGE_H;
    // The page follows the PDF's own shape (k.media, once it is open).
    const aspect = k.media?.kind === "pdf" ? k.media.aspect : SAMPLE_ASPECT;
    const W = H * Math.max(0.4, Math.min(2.2, aspect || SAMPLE_ASPECT));
    const cover = o.color || "#2f4b6e";
    const paper = "#fcfbf7";
    Object.assign(BOOK, { K: 0, anim: null, queue: [], tapN: 0, lastPage: 0, style: st, frame: 0, landed: 3, sides: null, sideOf: null, sheetsOf: null, press: null }); // prettier-ignore
    if (st.bound === "top") buildStapled(k, st, W, H);
    else buildSideBound(k, st, o, { W, H, cover, paper });
    useBudget(k);
  },
};

// A side-bound book (and the photo album): the page blocks, the covers, the
// spine or the coil, the cover's sheet and the leaves' sheets. `extra` may
// change the look: cloth(n) for the covers' color, edge (the page blocks'
// edge color), coverSheet (false: a plain cover), bands (head and tail
// bands) and leaves(k, leafOf) to add the leaves' sheets and kit itself.
function buildSideBound(k, st, o, extra) {
  const { W, H, cover, paper } = extra;
  const { T, cb, ov, g } = st;
  const X1 = g + W;
  // The fit, fixed by the reach box (every splat lies inside it), so the
  // leaves' kit splats know their distance from the spine in toy units.
  const BX = X1 + ov + 0.03;
  const BY = H / 2 + ov + 0.03;
  const BZ = BX;
  for (const x of [-BX, BX]) for (const y of [-BY, BY]) for (const z of [-BZ, BZ]) k.reach([x, y, z]); // prettier-ignore
  const S = 0.95 / Math.hypot(BX, BY, BZ);
  BOOK.dims = { W, H, g, S };
  k.spine({ at: [0, 0, 0], axis: [0, -1, 0], dir: [1, 0, 0] });
  const leafOf = (slot) => ({ slot, S, at: [0, 0, 0], dir: [1, 0, 0] });
  // The page blocks: the right one, and the left one (a copy that turns
  // with the cover and lands under the left-hand pages).
  // (Clean, flat colors: fine stripes or weaves at about the splats'
  // spacing read as grain on a phone.)
  const edge = () => extra.edge || "#ece5d3";
  const top = TOP;
  // The left block's top lands under the left-hand pages (and under a
  // card cover, which lies on it); it turns about zb to get there.
  const c0 = st.c0 ?? C0;
  const leftTop = st.cover === "board" ? TOP : -(c0 + cb) - 0.012;
  const zb = (leftTop - T) / 2;
  const lblock = k.part("lblock", { pivot: [0, 0, zb], axis: [0, -1, 0] });
  const block = (part) =>
    boxFaces(
      k,
      [g, X1],
      [-H / 2, H / 2],
      [-T, top],
      {
        // The right block's top is its front; the left one's is its back.
        ...(part ? { back: { share: 0.08, color: () => bkLit(paper, [0, 0, 1]) } } : { front: { share: 0.08, color: () => bkLit(paper, [0, 0, 1]) } }), // prettier-ignore
        right: { share: 0.025, color: (a, b, p) => bkLit(edge(a, b, p), [1, 0, 0]) },
        top: { share: 0.018, color: (a, b, p) => bkLit(edge(a, b, p), [0, 1, 0]) },
        bottom: { share: 0.018, color: (a, b, p) => bkLit(edge(a, b, p), [0, -1, 0], 0.6) },
        ...(g > 0 ? { left: { share: 0.02, color: (a, b, p) => bkLit(edge(a, b, p), [-1, 0, 0]) } } : {}), // prettier-ignore
      },
      { part },
    );
  block(0);
  block(lblock);
  if (st.cover === "board" && extra.bands !== false) {
    // Head and tail bands: striped rolls at the spine end of each block.
    const band = (a) => (Math.floor(a * 9) % 2 ? "#b8323a" : "#f0e2c4");
    for (const part of [0, lblock])
      for (const y of [H / 2 + 0.001, -H / 2 - 0.001])
        rect(k, { share: 0.003, at: [0.001, y, -T], u: [0, 0, T + top], v: [0.012, 0, 0], n: [0, Math.sign(y), 0], color: (a) => band(a), part }); // prettier-ignore
  }
  // The back cover.
  const cloth = extra.cloth || ((n) => () => bkLit(cover, n));
  const inside = extra.inside || (st.cover === "board" ? mix(cover, "#f1e6cf", 0.75) : "#f2efe8");
  const bx = [st.cover === "board" ? 0 : g, X1 + ov];
  const by = [-H / 2 - ov, H / 2 + ov];
  boxFaces(k, bx, by, [-T - cb, -T], {
    back: { share: 0.05, color: cloth([0, 0, -1]) },
    front: { share: 0.02, color: () => bkLit(inside, [0, 0, 1]) },
    right: { share: 0.006, color: cloth([1, 0, 0]) },
    top: { share: 0.006, color: cloth([0, 1, 0]) },
    bottom: { share: 0.006, color: cloth([0, -1, 0]) },
  });
  // The front cover: a board that turns as one piece, or a card that
  // flexes (a leaf, slot 8). It shows page 0: the whole card, or a panel
  // on the cloth.
  const coverZ = [c0, c0 + cb];
  if (st.cover === "board") {
    const zp = (c0 - T) / 2;
    const cp = k.part("cover", { pivot: [0, 0, zp], axis: [0, -1, 0] });
    boxFaces(k, bx, by, coverZ, {
      front: { share: 0.1, color: cloth([0, 0, 1]) },
      back: { share: 0.05, color: () => bkLit(inside, [0, 0, 1]) },
      right: { share: 0.006, color: cloth([1, 0, 0]) },
      top: { share: 0.006, color: cloth([0, 1, 0]) },
      bottom: { share: 0.006, color: cloth([0, -1, 0]) },
    }, { part: cp }); // prettier-ignore
    if (extra.coverSheet !== false)
      k.sheet({ id: "cover", center: [(W + ov) / 2 + 0.015, 0.04, c0 + cb], width: W * 0.72, height: H * 0.66, part: cp, lift: 0.02 }); // prettier-ignore
    extra.onCover?.(k, cp, { bx, by, z: c0 + cb });
  } else {
    const leaf = leafOf(8);
    boxFaces(k, [g, X1], [-H / 2, H / 2], coverZ, {
      // (Its front is the page itself, the cover sheet.)
      back: { share: 0.08, color: () => bkLit(inside, [0, 0, 1]) },
      right: { share: 0.004, color: () => bkLit(cover, [1, 0, 0]) },
      top: { share: 0.004, color: () => bkLit(cover, [0, 1, 0]) },
      bottom: { share: 0.004, color: () => bkLit(cover, [0, -1, 0]) },
    }, { leaf }); // prettier-ignore
    k.sheet({ id: "cover", center: [g + W / 2, 0, c0 + cb], width: W, height: H, lift: 0.01, align: [-1, 0], leaf: 8 }); // prettier-ignore
  }
  // The leaves' sheets (after the cover's, which the engine builds first).
  if (extra.leaves) extra.leaves(k, leafOf);
  else
    for (let s = 0; s < 4; s++) {
      k.sheet({ id: `f${s}`, center: [g + W / 2, 0, 0], width: W, height: H, lift: E, align: [-1, 0], leaf: s }); // prettier-ignore
      k.sheet({ id: `b${s}`, center: [g + W / 2, 0, 0], width: W, height: H, normal: [0, 0, -1], lift: E, align: [1, 0], leaf: s }); // prettier-ignore
    }
  // The spine (not the spiral's): a strip down the closed book's left
  // side that turns to lie under the gutter as the book opens.
  if (g === 0) {
    const sw = st.cover === "board" ? 0.014 : 0.004;
    const z0 = -T - cb;
    const z1 = c0 + cb;
    const sp = k.part("spine", { pivot: [-sw / 2, 0, (z0 + z1) / 2], axis: [0, -1, 0] });
    const col = st.cover === "board" ? cloth([-1, 0, 0]) : () => bkLit(cover, [-1, 0, 0]);
    boxFaces(k, [-sw, 0], by, [z0, z1], {
      left: { share: 0.012, color: col },
      front: { share: 0.004, color: col },
      back: { share: 0.004, color: col },
      top: { share: 0.003, color: col },
      bottom: { share: 0.003, color: col },
    }, { part: sp }); // prettier-ignore
    if (o.style === "magazine") {
      // Two staples through the fold.
      for (const y of [-0.25 * H, 0.25 * H])
        k.cloud({ share: 0.002, pattern: false }, (rand, i, n) => ({
          p: [-sw - 0.001, y - 0.03 + (0.06 * (i + 0.5)) / n, (z0 + z1) / 2],
          dir: [0, 1, 0],
          stretch: 0.03 / n / 0.002,
          color: mix("#8e959e", "#e7ebf0", 0.5 + 0.5 * Math.cos((i / n - 0.5) * 6)),
          size: 0.2,
          opacity: 1,
          part: sp,
        }));
    }
  } else {
    // The spiral: a wire coil through the pages' holes.
    const rc = g + 0.012;
    const loops = Math.floor((H - 0.05) / 0.042);
    k.cloud({ share: 0.03, pattern: false }, (rand, i, n) => {
      const per = Math.floor(n / loops);
      const li = Math.floor(i / per);
      if (li >= loops) return null;
      const f = (i % per) / per;
      const phi = f * 2 * Math.PI;
      const y = -H / 2 + 0.025 + li * 0.042 + 0.03 * f;
      const nx = Math.cos(phi);
      const nz = Math.sin(phi);
      const shine = 0.5 + 0.5 * (nx * BK_LIGHT[0] + nz * BK_LIGHT[2]);
      // Thin splats along the wire (not round blobs), each as long as
      // the gap to the next.
      const step = Math.hypot(2 * Math.PI * rc, 0.03) / per;
      return {
        p: [rc * nx, y, -T / 2 + rc * nz],
        dir: [-2 * Math.PI * rc * nz, 0.03, 2 * Math.PI * rc * nx],
        stretch: (0.6 * step) / 0.0028,
        color: mix("#3d4148", "#d9dde3", shine),
        size: 0.4,
        opacity: 1,
      };
    });
  }
}

// Stapled paper: loose sheets, one page each, a staple in the top left
// corner; a sheet turns up and over the top edge.
function buildStapled(k, st, W, H) {
  const { T } = st;
  BOOK.dims = { W, H, g: 0, S: 1 };
  k.spine({ at: [0, H / 2, 0], axis: [-1, 0, 0], dir: [0, -1, 0] });
  for (let s = 0; s < 4; s++)
    k.sheet({ id: `f${s}`, center: [0, 0, 0], width: W, height: H, lift: E, align: [0, 1], leaf: s }); // prettier-ignore
  k.reach([0, H / 2 + 0.3, 0.45]);
  k.reach([0, 0, 0.5]);
  const paper = "#fcfbf7";
  // White paper on a white page needs its outline: darker edges, a soft
  // shadow behind the stack, and a thin gray line round the top sheet.
  const edge = () => "#d9d1bf";
  rect(k, { share: 0.03, at: [-W / 2 - 0.006, -H / 2 - 0.03, -T - 0.012], u: [W + 0.034, 0, 0], v: [0, H + 0.036, 0], n: [0, 0, 1], color: () => "#8f8a82", opacity: 0.4 }); // prettier-ignore
  k.cloud({ share: 0.006, pattern: false }, (rand, i, n) => {
    // Round the rectangle, a thin splat every step, a little over the page.
    const L = 2 * (W + H);
    let d = ((i + 0.5) / n) * L;
    const step = L / n;
    let p;
    let dir;
    if (d < W) ((p = [-W / 2 + d, H / 2]), (dir = [1, 0, 0]));
    else if ((d -= W) < H) ((p = [W / 2, H / 2 - d]), (dir = [0, 1, 0]));
    else if ((d -= H) < W) ((p = [W / 2 - d, -H / 2]), (dir = [1, 0, 0]));
    else ((d -= W), (p = [-W / 2, -H / 2 + d]), (dir = [0, 1, 0]));
    return { p: [p[0], p[1], E + 0.004], dir, stretch: (0.6 * step) / 0.0022, color: "#b3aca0", size: 0.22, opacity: 1 }; // prettier-ignore
  });
  boxFaces(k, [-W / 2, W / 2], [-H / 2, H / 2], [-T, TOP], {
    front: { share: 0.2, color: () => bkLit(paper, [0, 0, 1]) },
    back: { share: 0.1, color: () => bkLit(paper, [0, 0, -1], 0.6) },
    right: { share: 0.02, color: (a, b, p) => bkLit(edge(a, b, p), [1, 0, 0]) },
    left: { share: 0.02, color: (a, b, p) => bkLit(edge(a, b, p), [-1, 0, 0]) },
    top: { share: 0.02, color: (a, b, p) => bkLit(edge(a, b, p), [0, 1, 0]) },
    bottom: { share: 0.02, color: (a, b, p) => bkLit(edge(a, b, p), [0, -1, 0], 0.6) },
  });
  // The staple: a short silver bar across the corner, at 45 degrees.
  const c = [-W / 2 + 0.05, H / 2 - 0.05];
  k.cloud({ share: 0.003, pattern: false }, (rand, i, n) => {
    const f = (i + 0.5) / n - 0.5;
    return {
      p: [c[0] + f * 0.055 * Math.SQRT1_2, c[1] + f * 0.055 * Math.SQRT1_2, 0.03],
      dir: [1, 1, 0],
      stretch: (0.6 * 0.055) / n / 0.0021,
      color: mix("#8e959e", "#eef1f5", 0.5 + 0.5 * Math.cos(f * 9)),
      size: 0.3,
      opacity: 1,
    };
  });
}

// ---- Photo album (lane Books) -----------------------------------------------------
//
// A set of photos in an album of thick card pages that turn like the book's
// leaves (the same four leaf slots and turns). Each side of a page holds one
// photo, or two when they are both wide (one above the other) or both tall
// (side by side). Each photo is its own picture sheet on the page; its photo
// corners and caption are drawn on it before it becomes splats
// (pictures.decorate), since a page slot shows a different photo each time
// it comes round.

const ALBUM_STYLES = {
  leather: {
    cover: "#5b3522",
    page: "#211f1e",
    edge: "#34302c",
    corner: "#0f0f10",
    ink: "#ece6d8",
  },
  linen: { cover: "#7d8fa3", page: "#efe8d8", edge: "#e2d9c6", corner: "#1c1b1a", ink: "#3b352f" },
  scrapbook: {
    cover: "#b98b57",
    page: "#d8c09a",
    edge: "#cbb088",
    corner: "#f6f1e7",
    ink: "#3a2b1c",
  },
};
const ALBUM_BOOK = { bound: "side", cover: "board", T: 0.05, cb: 0.03, ov: 0.03, g: 0, c0: 0.034, curl: 0.3, coverCurl: 0 }; // prettier-ignore
const ALBUM_W = 0.95; // a page, in recipe units (a little taller than wide)
const ALBUM_H = 1.05;
const ALBUM_CARD = 0.008; // half a page's thickness
const ALBUM_LIFT = 0.012; // photos over the card
// The sample: six CC0 photos (CREDITS.md), wide and tall.
const ALBUM_SAMPLE = ["sailboat", "tulips", "lighthouse", "red-barn", "seashell", "daffodils"];
const ALBUM_SAMPLE_ASPECTS = [900 / 597, 900 / 675, 599 / 900, 900 / 556, 900 / 600, 615 / 900];

// Groups photos (by shape) onto page sides: side 0 is the cover.
function albumSides(aspects) {
  const sides = [[]];
  const kinds = [""];
  const sideOf = [];
  for (let i = 0; i < aspects.length; ) {
    const a = aspects[i];
    const b = aspects[i + 1];
    let kind = "one";
    if (b !== undefined && a > 1.15 && b > 1.15) kind = "stack";
    else if (b !== undefined && a < 0.87 && b < 0.87) kind = "pair";
    const n = kind === "one" ? 1 : 2;
    const side = sides.length;
    sides.push(Array.from({ length: n }, (_, j) => i + j));
    kinds.push(kind);
    for (let j = 0; j < n; j++) sideOf[i + j] = side;
    i += n;
  }
  return { sides, kinds, sideOf };
}

// Draws a photo mounted on its page: the page's color around it, the photo
// inside (its shape kept), four photo corners and, with captions on, its
// file name below.
function albumDecorate(canvas, { name, options }) {
  const look = ALBUM_STYLES[options.cover] || ALBUM_STYLES.leather;
  const w = canvas.width;
  const h = canvas.height;
  const copy = document.createElement("canvas");
  copy.width = w;
  copy.height = h;
  copy.getContext("2d").drawImage(canvas, 0, 0);
  const g = canvas.getContext("2d");
  const m = Math.round(0.05 * Math.min(w, h));
  const band = options.captions ? Math.round(0.13 * h) : 0;
  // The page's color as the card around it is lit (bkLit facing the viewer).
  const pc = bkLit(look.page, [0, 0, 1]);
  g.fillStyle = `rgb(${pc.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255)).join(",")})`;
  g.fillRect(0, 0, w, h);
  // The photo, fitted inside the margins.
  const iw = w - 2 * m;
  const ih = h - 2 * m - band;
  const s = Math.min(iw / w, ih / h);
  const pw = Math.round(w * s);
  const ph = Math.round(h * s);
  const x0 = Math.round((w - pw) / 2);
  const y0 = m + Math.round((ih - ph) / 2);
  g.drawImage(copy, 0, 0, w, h, x0, y0, pw, ph);
  // Photo corners: a triangle over each corner, a little past the photo.
  const c = Math.round(0.11 * Math.min(pw, ph));
  const o = Math.max(1, Math.round(c * 0.12));
  g.fillStyle = look.corner;
  for (const [cx, cy, sx, sy] of [
    [x0, y0, 1, 1],
    [x0 + pw, y0, -1, 1],
    [x0, y0 + ph, 1, -1],
    [x0 + pw, y0 + ph, -1, -1],
  ]) {
    g.beginPath();
    g.moveTo(cx - sx * o, cy - sy * o);
    g.lineTo(cx + sx * c, cy - sy * o);
    g.lineTo(cx - sx * o, cy + sy * c);
    g.closePath();
    g.fill();
  }
  if (band) {
    const size = Math.max(8, Math.round(band * 0.42));
    g.fillStyle = look.ink;
    g.font = `italic ${size}px Georgia, "Times New Roman", serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    let text = name || "";
    while (text.length > 4 && g.measureText(text).width > w - 2 * m) text = text.slice(0, -2);
    if (text !== name) text += "…";
    g.fillText(text, w / 2, h - m - band / 2 + m * 0.2);
  }
}

// Smooth value noise, 0..1 (a fixed hash on a grid, eased between).
function bkHash(x, y) {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}
function bkNoise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = bkHash(xi, yi) + (bkHash(xi + 1, yi) - bkHash(xi, yi)) * sx;
  const b = bkHash(xi, yi + 1) + (bkHash(xi + 1, yi + 1) - bkHash(xi, yi + 1)) * sx;
  return a + (b - a) * sy;
}

// The cover's look: leather, woven linen, or kraft card. Every texture is
// at least three splats across (a finer one reads as speckle on a phone);
// the leather's stitches and groove and the scrapbook's label are their own
// splats, in front (albumTrim). `bx` and `by` bound the cover.
function albumCloth(style, bx, by) {
  const look = ALBUM_STYLES[style] || ALBUM_STYLES.leather;
  return (n) => (a, b, p) => {
    let col = look.cover;
    const face = n[2] > 0.5;
    if (style === "leather") {
      // Pebbled grain (little rounded bumps, lit from the upper left), a
      // broad mottle, and on the front a soft sheen and darker, worn edges.
      // (Two layers turned apart, so the noise's grid doesn't show.)
      const pebble = (x, y) =>
        0.5 * bkNoise(26 * (0.8 * x + 0.6 * y), 26 * (0.8 * y - 0.6 * x)) +
        0.5 * bkNoise(29 * (0.28 * x - 0.96 * y) + 5, 29 * (0.28 * y + 0.96 * x) + 9);
      const g = pebble(p[0], p[1]);
      const gl = pebble(p[0] - 0.012, p[1] + 0.012);
      const mottle = bkNoise(4 * (0.8 * p[0] + 0.6 * p[1]) + 7, 4 * (0.8 * p[1] - 0.6 * p[0]) + 3);
      let f = 0.9 + 0.12 * g + 0.25 * (g - gl) + 0.1 * (mottle - 0.5);
      if (face) {
        const cx = bx[0] + 0.3 * (bx[1] - bx[0]);
        const cy = by[1] - 0.3 * (by[1] - by[0]);
        f += 0.24 * Math.exp(-((p[0] - cx) ** 2 + (p[1] - cy) ** 2) / 0.12);
        const d = Math.min(p[0] - bx[0], bx[1] - p[0], p[1] - by[0], by[1] - p[1]);
        f -= 0.14 * Math.max(0, 1 - d / 0.03);
      }
      col = shade(col, f);
    } else if (style === "linen") {
      // Threads across and down in a plain weave: the gaps between them
      // show as fine darker lines, and each thread is a little thicker or
      // thinner along its length (slubs).
      const q = 19;
      const gap = (t, w) => Math.pow(Math.abs(Math.cos(t * q * Math.PI)), 6) * (0.6 + 0.8 * w);
      const across = gap(p[1], bkNoise(p[0] * 3, p[1] * q));
      const down = gap(p[0], bkNoise(p[1] * 3 + 11, p[0] * q));
      const slub = bkNoise(p[0] * 2.5, p[1] * q * 2) + bkNoise(p[0] * q * 2 + 5, p[1] * 2.5) - 1;
      col = shade(col, 1.0 - 0.06 * across - 0.06 * down + 0.035 * slub);
    } else {
      col = shade(col, 0.97 + 0.03 * Math.sin(p[0] * 61 + p[1] * 37) * Math.sin(p[1] * 83));
    }
    return bkLit(col, n);
  };
}

// On the front cover (part cp, its face at z, bounds bx and by): the
// leather's stitched border and pressed groove, as thin splats along their
// lines, or the scrapbook's paper label.
function albumTrim(style, k, cp, { bx, by, z }) {
  const look = ALBUM_STYLES[style] || ALBUM_STYLES.leather;
  if (style === "leather") {
    // A path round the cover, `d` in from its edges: the point at t (0..1).
    const ring = (d) => {
      const x0 = bx[0] + d;
      const x1 = bx[1] - d;
      const y0 = by[0] + d;
      const y1 = by[1] - d;
      const w = x1 - x0;
      const h = y1 - y0;
      const L = 2 * (w + h);
      return {
        L,
        at(t) {
          let s = t * L;
          if (s < w)
            return [
              [x0 + s, y0],
              [1, 0, 0],
            ];
          s -= w;
          if (s < h)
            return [
              [x1, y0 + s],
              [0, 1, 0],
            ];
          s -= h;
          if (s < w)
            return [
              [x1 - s, y1],
              [-1, 0, 0],
            ];
          s -= w;
          return [
            [x0, y1 - s],
            [0, -1, 0],
          ];
        },
      };
    };
    const thread = bkLit("#d9c6a5", [0, 0, 1]);
    const stitch = ring(0.04);
    k.cloud({ share: 0.004, pattern: false }, (rand, i, n) => {
      // Dashes of two thin splats each, a little longer than their gaps.
      const dashes = Math.floor(n / 2);
      const j = Math.floor(i / 2);
      if (j >= dashes) return null;
      const len = stitch.L / dashes;
      const t = (j + 0.5 + ((i % 2) - 0.5) * 0.34) / dashes;
      const [[x, y], dir] = stitch.at(t);
      return { p: [x, y, z + 0.004], dir, stretch: (0.14 * len) / 0.0032, color: thread, size: 0.32, opacity: 1, part: cp }; // prettier-ignore
    });
    const groove = ring(0.07);
    const dark = bkLit(shade(look.cover, 0.78), [0, 0, 1]);
    k.cloud({ share: 0.004, pattern: false }, (rand, i, n) => {
      const [[x, y], dir] = groove.at((i + 0.5) / n);
      return { p: [x, y, z + 0.003], dir, stretch: (0.5 * groove.L) / n / 0.0028, color: dark, size: 0.28, opacity: 1, part: cp }; // prettier-ignore
    });
  } else if (style === "scrapbook") {
    const lx = (bx[0] + bx[1]) / 2;
    rect(k, { share: 0.012, at: [lx - 0.22, -0.02, z + 0.004], u: [0.44, 0, 0], v: [0, 0.2, 0], n: [0, 0, 1], part: cp, color: () => bkLit("#f1e8d6", [0, 0, 1]) }); // prettier-ignore
  }
}

const ALBUM_BOXES = (W, H) => ({
  o: { c: [W / 2, 0], s: [W * 0.84, H * 0.86] },
  t: { c: [W / 2, H * 0.235], s: [W * 0.9, H * 0.45] },
  u: { c: [W / 2, -H * 0.235], s: [W * 0.9, H * 0.45] },
  l: { c: [W * 0.265, 0], s: [W * 0.45, H * 0.86] },
  r: { c: [W * 0.735, 0], s: [W * 0.45, H * 0.86] },
});

const ALBUM_RECIPE = {
  turntable: false,
  tiltLock: true, // a drag only spins it left and right (PACKS.md 5c)
  density: 1,
  alive: BOOK_RECIPE.alive,
  options: [
    {
      key: "cover",
      label: "Cover",
      type: "select",
      default: "leather",
      choices: [
        { id: "leather", label: "Leather" },
        { id: "linen", label: "Linen" },
        { id: "scrapbook", label: "Scrapbook" },
      ],
    },
    { key: "captions", label: "Captions", type: "switch", default: true },
  ],
  controls: [{ key: "turn", label: "Turn the page", type: "pulse", ease: 1.2 }],
  action: { key: "turn", label: "Turn the page", at: bookTapAt },
  // Heavier pages: they follow the finger with more lag and fall back more
  // readily.
  drag: bookDrag(ALBUM_PULL),
  pictures: {
    sample: () => ALBUM_SAMPLE.map((n) => `assets/toys/photo-album/${n}.jpg`),
    accept: ["image"],
    decorate: albumDecorate,
  },
  credits: [
    ["The lighthouse", "https://www.flickr.com/photos/77532212@N07/16563630874", "-anna--"],
    ["Sailboat", "https://www.flickr.com/photos/135788700@N05/35295085365", "leex6221"],
    ["Tulips", "https://www.flickr.com/photos/133590734@N04/17935969728", "Lucía Quiñónez"],
    ["Daffodils and tulips (CRW_2034)", "https://www.flickr.com/photos/128176757@N06/16361600725", "patrick jourdheuille"], // prettier-ignore
    ["Barn A Glow", "https://www.flickr.com/photos/37996646802@N01/51912951761", "Alan Levine"],
    ["Seashell by the Seashore", "https://www.flickr.com/photos/116158494@N02/20532087302", "samsonites89"], // prettier-ignore
  ].map(([title, source, author]) => ({
    label: "Photo album",
    title,
    source,
    author,
    license: "CC0 1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  })),
  input: {
    title: "Your own photos",
    media: { accept: ["image"], multiple: true, button: "Open photos…" },
    note: "Pick several photos at once (a folder's worth) and turn through them in the album. Your photos stay on this device; nothing is uploaded.",
  },
  drive: (t, c, out, info) => BOOK_RECIPE.drive(t, c, out, info),
  build(k, o) {
    const look = ALBUM_STYLES[o.cover] || ALBUM_STYLES.leather;
    const st = ALBUM_BOOK;
    const W = ALBUM_W;
    const H = ALBUM_H;
    const m = k.media;
    const aspects = m?.aspects || (m ? [m.aspect] : ALBUM_SAMPLE_ASPECTS);
    const { sides, kinds, sideOf } = albumSides(aspects);
    Object.assign(BOOK, { K: 0, anim: null, queue: [], tapN: 0, lastPage: 0, style: st, frame: 0, landed: 3, sides, sideOf, press: null }); // prettier-ignore
    const names = ["o", "t", "u", "l", "r"];
    BOOK.sheetsOf = (i, fb, side) => {
      const kind = kinds[side] || "";
      const ph = sides[side] || [];
      const use = { o: kind === "one" ? ph[0] : -1, t: kind === "stack" ? ph[0] : -1, u: kind === "stack" ? ph[1] : -1, l: kind === "pair" ? ph[0] : -1, r: kind === "pair" ? ph[1] : -1 }; // prettier-ignore
      return names.map((n) => ({ id: `a${i}${fb}${n}`, page: use[n] ?? -1 }));
    };
    buildSideBound(k, st, o, {
      W,
      H,
      cover: look.cover,
      paper: look.page,
      edge: look.edge,
      inside: look.page,
      bands: false,
      coverSheet: false,
      cloth: albumCloth(o.cover, [0, W + st.ov], [-H / 2 - st.ov, H / 2 + st.ov]),
      onCover: (k, cp, at) => albumTrim(o.cover, k, cp, at),
      leaves(k, leafOf) {
        const boxes = ALBUM_BOXES(W, H);
        for (let s = 0; s < 4; s++) {
          const leaf = leafOf(s);
          // The thick card page, both faces and its free edge.
          boxFaces(k, [0, W], [-H / 2, H / 2], [-ALBUM_CARD, ALBUM_CARD], {
            front: { share: 0.03, color: () => bkLit(look.page, [0, 0, 1]) },
            back: { share: 0.03, color: () => bkLit(look.page, [0, 0, 1]) },
            right: { share: 0.002, color: () => bkLit(look.edge, [1, 0, 0]) },
          }, { leaf }); // prettier-ignore
          for (const fb of ["f", "b"])
            for (const n of names) {
              const bxx = boxes[n];
              // A back side reads the other way once turned over.
              const x = fb === "f" ? bxx.c[0] : W - bxx.c[0];
              k.sheet({ id: `a${s}${fb}${n}`, center: [x, bxx.c[1], 0], width: bxx.s[0], height: bxx.s[1], normal: [0, 0, fb === "f" ? 1 : -1], lift: ALBUM_CARD + ALBUM_LIFT, method: "pixels", leaf: s }); // prettier-ignore
            }
        }
      },
    });
    useBudget(k);
  },
};

// ---- Picture frame (lane Books) ---------------------------------------------------
//
// One photo in a frame, hung on a nail by a wire against a patch of wall.
// The frame, its wire and the photo are one part that swings about the nail
// when tapped, as a damped pendulum, and settles (about 3 s). The digital
// frame steps through a set of photos, fading through black while the next
// one is built.

const FRAME = { tapN: 0, t0: -99, digital: false, shown: -1, fade: 0, next: -1, since: 0, asked: 0 }; // prettier-ignore
const FRAME_SWING = 3; // seconds
const FRAME_STEP = 4.5; // seconds a photo shows on the digital frame
const FRAME_FADE = 0.45; // seconds to fade out, and to fade in

const FRAME_STYLES = {
  wood: { w: 0.09, d: 0.05 },
  gold: { w: 0.13, d: 0.06 },
  modern: { w: 0.028, d: 0.04, mat: 0.13 },
  digital: { w: 0.07, d: 0.045 },
};

// The swing: a push, then a damped swing that ends exactly at rest.
function frameAngle(t) {
  if (t <= 0 || t >= FRAME_SWING) return 0;
  const w = (2 * Math.PI) / 1.05;
  const end = 1 - (Math.max(0, t - FRAME_SWING + 0.6) / 0.6) ** 2;
  return 0.2 * Math.exp(-t / 0.95) * Math.sin(w * t) * end;
}

// The gold frame's molded profile, across a side from the picture (0) to
// the wall (1): its height off the wall's plane at a (recipe units), and how
// burnished each part is (water gilding: the raised parts polished bright,
// the flat and the hollow matte).
// A small bead at the sight edge, a flat, a cove (a hollow), a big bead and
// a rounded outer edge.
function goldProfile(a, d) {
  if (a < 0.1) return { z: d * (0.58 + 0.16 * Math.sin((Math.PI * a) / 0.1)), gloss: 1 };
  if (a < 0.24) return { z: d * 0.58, gloss: 0.35 };
  if (a < 0.58) {
    const t = (a - 0.24) / 0.34;
    return { z: d * (0.58 + 0.44 * t * t), gloss: 0.3, hollow: Math.sin(Math.PI * t) };
  }
  if (a < 0.84) {
    const t = (a - 0.58) / 0.26;
    return { z: d * (1.02 + 0.2 * Math.sin(Math.PI * t)), gloss: 1 };
  }
  const t = (a - 0.84) / 0.16;
  return { z: d * (1.02 - 0.3 * t * t), gloss: 0.7 };
}
// One side of the gold frame: its profile as thin strips along the side,
// each at its own height and slope, mitered at the corners (each strip is
// as long as the frame is at its distance out), then its outer edge down to
// the wall and its lip down to the picture. Side s: 0 top, 1 bottom, 2 left,
// 3 right.
function goldSide(k, s, { ow, oh, fw, d, fp }) {
  const o = [
    [0, 1],
    [0, -1],
    [-1, 0],
    [1, 0],
  ][s];
  const t = [o[1], -o[0]];
  const D0 = o[0] ? ow : oh; // the inner edge's distance from the middle
  const L0 = o[0] ? oh : ow; // half the inner edge's length
  const P = (a, l, z) => [o[0] * (D0 + a * fw) + t[0] * l, o[1] * (D0 + a * fw) + t[1] * l, z];
  const M = 16;
  for (let i = 0; i < M; i++) {
    const a0 = i / M;
    const a1 = (i + 1) / M;
    const p0 = goldProfile(a0, d);
    const p1 = goldProfile(a1, d);
    const pm = goldProfile((a0 + a1) / 2, d);
    const half = L0 + ((a0 + a1) / 2) * fw;
    const dz = p1.z - p0.z;
    const da = (a1 - a0) * fw;
    const nl = Math.hypot(dz, da);
    const n = [(o[0] * -dz) / nl, (o[1] * -dz) / nl, da / nl];
    const col = bkLit(goldAt(n, pm.gloss, pm.hollow || 0), [0, 0, 1], 0.9, 0.1);
    rect(k, { share: 0.012, at: P(a0, -half, p0.z), u: [t[0] * 2 * half, t[1] * 2 * half, 0], v: [o[0] * da, o[1] * da, dz], n, part: fp, color: () => col }); // prettier-ignore
  }
  // The outer edge, down to the wall, and the lip down to the picture.
  const zOut = goldProfile(1, d).z;
  const outer = mix("#7a5619", "#c79a44", 0.5);
  rect(k, { share: 0.014, at: P(1, -(L0 + fw), -0.045), u: [t[0] * 2 * (L0 + fw), t[1] * 2 * (L0 + fw), 0], v: [0, 0, zOut + 0.045], n: [o[0], o[1], 0], part: fp, color: () => bkLit(outer, [o[0], o[1], 0]) }); // prettier-ignore
  const zIn = goldProfile(0, d).z;
  rect(k, { share: 0.006, at: P(0, -L0, 0), u: [t[0] * 2 * L0, t[1] * 2 * L0, 0], v: [0, 0, zIn], n: [-o[0], -o[1], 0], part: fp, color: () => "#5a3f12" }); // prettier-ignore
}

// Gilding lit by the baked light: darker where it faces away and in the
// hollow, with a burnished highlight where a polished part faces the light.
function goldAt(n, gloss, hollow = 0) {
  const L = BK_LIGHT;
  const dif = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
  const hv = [L[0], L[1], L[2] + 1];
  const hl = Math.hypot(...hv);
  const spec = Math.pow(Math.max(0, (n[0] * hv[0] + n[1] * hv[1] + n[2] * hv[2]) / hl), 26) * gloss;
  let c = mix("#4e3409", "#d6a94a", 0.12 + 0.88 * dif);
  c = shade(c, 1 - 0.4 * hollow);
  return mix(c, "#fff3cc", Math.min(1, spec * 1.15));
}

const FRAME_RECIPE = {
  turntable: false,
  tiltLock: true, // a drag only spins it left and right (PACKS.md 5c)
  density: 0.3,
  alive: () => FRAME.digital || FRAME.t0 > -99,
  options: [
    {
      key: "frame",
      label: "Frame",
      type: "select",
      default: "wood",
      choices: [
        { id: "wood", label: "Wood" },
        { id: "gold", label: "Gold" },
        { id: "modern", label: "Modern" },
        { id: "digital", label: "Digital" },
      ],
    },
    {
      // The digital frame's order.
      key: "order",
      label: "Order",
      type: "select",
      default: "inorder",
      choices: [
        { id: "inorder", label: "In order" },
        { id: "random", label: "Random" },
      ],
    },
  ],
  controls: [{ key: "swing", label: "Swing", type: "pulse", ease: FRAME_SWING }],
  action: { key: "swing", label: "Swing the frame" },
  pictures: {
    sample: (o) =>
      o.frame === "digital"
        ? ["assets/toys/picture-frame/islands.jpg", ...ALBUM_SAMPLE.map((n) => `assets/toys/photo-album/${n}.jpg`)] // prettier-ignore
        : "assets/toys/picture-frame/islands.jpg",
    // A GIF plays on a loop; a video plays on a loop, muted (the speaker
    // button turns its sound on, as on the Screen).
    accept: ["image", "gif", "video"],
  },
  credits: [
    {
      label: "Picture frame",
      title: "Sailboat in the Kornati Isalnds",
      source: "https://www.flickr.com/photos/148372846@N03/37778143022",
      author: "Camilla K",
      license: "CC0 1.0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    },
    ...ALBUM_RECIPE.credits.map((c) => ({ ...c, label: "Picture frame (digital)" })),
  ],
  input: {
    title: "Your own photo",
    // (list: the digital frame's photos, to put in order; engine PR 2.)
    media: { accept: ["image", "gif", "video"], multiple: true, list: true, button: "Open photos…" }, // prettier-ignore
    note: "Open a photo, a GIF or a video to frame it, or several photos for the digital frame to step through. Your files stay on this device; nothing is uploaded.",
  },
  drive(t, c, out, info) {
    const pics = info.data?.pictures;
    const time = info.time ?? t;
    const n = info.tap?.n ?? 0;
    if (n < FRAME.tapN) FRAME.tapN = 0;
    if (n > FRAME.tapN) {
      FRAME.tapN = n;
      FRAME.t0 = time;
    }
    const st = time - FRAME.t0;
    if (st > FRAME_SWING) FRAME.t0 = -99;
    out.parts.frame = { angle: FRAME.t0 > -99 ? frameAngle(st) : 0 };
    // A video starts playing by itself, once (a tap swings the frame).
    if (pics?.kind === "video" && FRAME.video !== pics.name) {
      FRAME.video = pics.name;
      if (!pics.playing) pics.togglePlay();
    }
    let fade = 0;
    if (FRAME.digital && pics?.count > 1) {
      // Show a photo, fade to black, turn to the next, and fade back in
      // once it is built.
      if (FRAME.next < 0 && time - FRAME.since > FRAME_STEP) {
        // In order, or a random other one.
        FRAME.next = FRAME.random ? (pics.page + 1 + Math.floor(Math.random() * (pics.count - 1))) % pics.count : (pics.page + 1) % pics.count; // prettier-ignore
        FRAME.asked = time;
      }
      if (FRAME.next >= 0) {
        fade = Math.min(1, (time - FRAME.asked) / FRAME_FADE);
        if (fade >= 1 && pics.page !== FRAME.next) pics.go(FRAME.next);
        if (
          fade >= 1 &&
          pics.page === FRAME.next &&
          (pics.ready("photo") || time - FRAME.asked > 3)
        ) {
          FRAME.next = -1;
          FRAME.since = time;
        }
      } else fade = Math.max(0, 1 - (time - FRAME.since) / FRAME_FADE);
    }
    out.morph = [fade, 0, 0, 0];
    out.sheets = { photo: { page: pics?.page ?? 0 } };
  },
  build(k, o) {
    const style = FRAME_STYLES[o.frame] ? o.frame : "wood";
    const fs = FRAME_STYLES[style];
    Object.assign(FRAME, { tapN: 0, t0: -99, digital: style === "digital", random: o.order === "random", next: -1, since: 0, video: null }); // prettier-ignore
    // The opening follows the photo's shape (a digital frame is 4:3).
    const aspect = style === "digital" ? 4 / 3 : Math.max(0.5, Math.min(2, k.media?.aspect || 900 / 675)); // prettier-ignore
    const H = 1;
    const W = H * aspect;
    const mat = fs.mat || 0;
    const ow = W / 2 + mat; // the frame's inner edge, half width and height
    const oh = H / 2 + mat;
    const fw = fs.w;
    const X = ow + fw;
    const Y = oh + fw;
    const nailY = Y + 0.3;
    const fp = k.part("frame", { pivot: [0, nailY, 0.02], axis: [0, 0, 1] });
    // Room for the swing.
    for (const sx of [-1, 1]) k.reach([sx * (X + 0.25), -Y - 0.1, 0]);
    // A patch of wall behind, and the frame's soft shadow on it (it swings
    // with the frame).
    const wallX = X + 0.35;
    plainRect(k, { share: 0.26, at: [-wallX, -Y - 0.3, -0.09], u: [2 * wallX, 0, 0], v: [0, nailY + 0.18 + Y + 0.3, 0], n: [0, 0, 1], color: (a, b) => bkLit(shade("#ebe5da", 1.02 - 0.05 * b), [0, 0, 1]) }); // prettier-ignore
    plainRect(k, { share: 0.03, at: [-X + 0.03, -Y - 0.04, -0.075], u: [2 * X, 0, 0], v: [0, 2 * Y, 0], n: [0, 0, 1], color: () => bkLit("#cfc8bc", [0, 0, 1]), part: fp }); // prettier-ignore
    // The nail: a round head and a little of its shank.
    k.cloud({ share: 0.004, pattern: false }, (rand, i, n) => {
      const r = Math.sqrt(i / n) * 0.022;
      const a = i * 2.39996;
      return { p: [r * Math.cos(a), nailY + r * Math.sin(a), 0.025], n: [0, 0, 1], color: mix("#6b6f75", "#d8dce2", 0.5 + 0.5 * Math.cos(a) * (r / 0.022)), size: 0.35, opacity: 1 }; // prettier-ignore
    });
    // The wire: from the nail down to screw eyes behind the frame's sides.
    k.cloud({ share: 0.006, pattern: false }, (rand, i, n) => {
      const side = i % 2 ? 1 : -1;
      const f = Math.floor(i / 2) / (n / 2);
      const end = [side * X * 0.7, Y - 0.12, -0.03];
      return { p: [end[0] * f, nailY + (end[1] - nailY) * f, 0.018 + (end[2] - 0.018) * f], color: "#9aa0a6", size: 0.18, opacity: 1, part: fp }; // prettier-ignore
    });
    // The frame: four sides, each with its face, outer edge and inner lip.
    const d = fs.d;
    const faceColor = (u, across, side) => {
      // u: along the side (0..1), across: 0 at the inner edge, 1 outer.
      if (style === "wood") {
        const grain = Math.sin(u * 60 + Math.sin(across * 7 + side) * 1.5) * 0.5 + Math.sin(u * 190 + side * 3) * 0.2; // prettier-ignore
        return shade("#8b5a31", 0.94 + 0.08 * grain - 0.1 * across);
      }
      if (style === "gold") {
        // A molded profile: ridges, a hollow and a bead run along it.
        const prof = Math.cos(across * Math.PI * 3.2) * 0.5 + 0.5;
        const bead = across > 0.72 && across < 0.86 && Math.sin(u * 180) > 0.3 ? 0.25 : 0;
        return shade(mix("#8a6420", "#f4d67a", prof), 0.85 + bead + 0.1 * (1 - across));
      }
      if (style === "digital")
        return shade("#1b1c1f", 1 + 0.25 * Math.exp(-((across - 0.3) ** 2) / 0.01));
      return "#18181a";
    };
    const sides = [
      { at: [-X, oh, d], u: [2 * X, 0, 0], v: [0, fw, 0], n: [0, 1, 0], s: 0 },
      { at: [-X, -Y, d], u: [2 * X, 0, 0], v: [0, fw, 0], n: [0, -1, 0], s: 1 },
      { at: [-X, -oh, d], u: [0, 2 * oh, 0], v: [fw, 0, 0], n: [-1, 0, 0], s: 2 },
      { at: [ow, -oh, d], u: [0, 2 * oh, 0], v: [fw, 0, 0], n: [1, 0, 0], s: 3 },
    ];
    for (const sd of sides) {
      if (style === "gold") {
        goldSide(k, sd.s, { ow, oh, fw, d, fp });
        continue;
      }
      // The face (mitered: the top and bottom run the full width).
      plainRect(k, {
        share: 0.06,
        at: sd.at,
        u: sd.u,
        v: sd.v,
        n: [0, 0, 1],
        part: fp,
        color: (a, b) => {
          const across = sd.s === 0 ? b : sd.s === 1 ? 1 - b : sd.s === 2 ? 1 - b : b;
          return bkLit(faceColor(a, across, sd.s), [0, 0, 1]);
        },
      });
      // The outer edge, down to the wall.
      const out = sd.s === 0 ? [[-X, Y, -0.045], [2 * X, 0, 0]] : sd.s === 1 ? [[-X, -Y, -0.045], [2 * X, 0, 0]] : sd.s === 2 ? [[-X, -Y, -0.045], [0, 2 * Y, 0]] : [[X, -Y, -0.045], [0, 2 * Y, 0]]; // prettier-ignore
      plainRect(k, { share: 0.012, at: out[0], u: out[1], v: [0, 0, d + 0.045], n: sd.n, part: fp, color: () => bkLit(shade(faceColor(0.5, 1, sd.s), 0.85), sd.n) }); // prettier-ignore
      // The inner lip, down to the picture.
      const inn = sd.s === 0 ? [[-ow, oh, 0], [2 * ow, 0, 0]] : sd.s === 1 ? [[-ow, -oh, 0], [2 * ow, 0, 0]] : sd.s === 2 ? [[-ow, -oh, 0], [0, 2 * oh, 0]] : [[ow, -oh, 0], [0, 2 * oh, 0]]; // prettier-ignore
      plainRect(k, { share: 0.006, at: inn[0], u: inn[1], v: [0, 0, d], n: [-sd.n[0], -sd.n[1], 0], part: fp, color: () => bkLit(shade(faceColor(0.5, 0, sd.s), 0.7), [0, 0, 1]) }); // prettier-ignore
    }
    if (mat) {
      // A white mat with a beveled window, a little over the photo.
      const mz = 0.014;
      const band = (at, u, v) => plainRect(k, { share: 0.035, at, u, v, n: [0, 0, 1], part: fp, color: () => bkLit("#f7f5f0", [0, 0, 1]) }); // prettier-ignore
      band([-ow, H / 2, mz], [2 * ow, 0, 0], [0, mat, 0]);
      band([-ow, -oh, mz], [2 * ow, 0, 0], [0, mat, 0]);
      band([-ow, -H / 2, mz], [mat, 0, 0], [0, H, 0]);
      band([W / 2, -H / 2, mz], [mat, 0, 0], [0, H, 0]);
    }
    if (style === "digital") {
      // A black screen behind the photo, a small light, and the fade: a
      // black layer over the photo that clears as channel 0 falls.
      plainRect(k, { share: 0.03, at: [-W / 2, -H / 2, -0.012], u: [W, 0, 0], v: [0, H, 0], n: [0, 0, 1], part: fp, color: () => "#0b0b0d" }); // prettier-ignore
      plainRect(k, { share: 0.05, at: [-W / 2, -H / 2, 0.022], u: [W, 0, 0], v: [0, H, 0], n: [0, 0, 1], part: fp, color: () => "#0b0b0d", kind: "fade", params: [0, -0.99] }); // prettier-ignore
      k.cloud({ share: 0.0008, pattern: false }, () => ({ p: [X - fw * 0.5, -Y + fw * 0.5, d + 0.002], n: [0, 0, 1], color: "#5dd67a", size: 0.5, opacity: 1, part: fp })); // prettier-ignore
    }
    // (Its method follows the media: a photo's pixels, or a GIF's or video's
    // screen, which plays.)
    k.sheet({ id: "photo", center: [0, 0, 0], width: W, height: H, part: fp });
    useBudget(k);
  },
};

export const RECIPES = {
  "picture-lab": {
    // A flat sheet that shows whatever you open, and nothing else. It keeps
    // still (no turntable), facing you.
    turntable: false,
    tiltLock: true, // a drag only spins it left and right (lane Viewer)
    // Few splats of its own (the card); the picture's are the sheet's.
    density: 0.3, // (r3: enough for the card's edges to stay sharp)
    options: [
      {
        key: "sample",
        label: "Sample",
        type: "select",
        default: "article",
        choices: [
          { id: "article", label: "An article (PDF)" },
          { id: "photo", label: "A photo" },
        ],
      },
    ],
    controls: [{ key: "next", label: "Next page", type: "pulse", ease: 0.35 }],
    // A tap on the left of the page goes back, on the right (or the middle)
    // forward; the pages slide, they don't flip.
    action: { key: "next", label: "Next page, or play and pause", at: (p) => ({ key: "next", pick: p[0] < 0 ? 1 : 0 }) }, // prettier-ignore
    // What the toy opens before you open something of your own, and what
    // it accepts.
    pictures: {
      sample: (o) =>
        o.sample === "photo" ? "assets/toys/picture-lab/photo.jpg" : "assets/toys/picture-lab/article.pdf", // prettier-ignore
      accept: ["pdf", "image", "gif", "video"],
    },
    credits: [
      {
        label: "Picture lab",
        title: "Tulip field (the photo sample)",
        source: "https://www.flickr.com/photos/14674348@N04/13825345834",
        author: "DennisM2",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      },
    ],
    input: {
      title: "Your own picture",
      media: { accept: ["pdf", "image", "gif", "video"] },
      note: "Open a PDF, a photo, a GIF or a video, or paste a web address. Files stay on this device; nothing is uploaded.",
    },
    drive(t, c, out, info) {
      const pics = info.data?.pictures;
      // A tap turns to the next page (back to the first after the last), or
      // plays and pauses a video.
      const n = info.tap?.n ?? 0;
      if (n < LAB.tapN) LAB.tapN = 0;
      if (n > LAB.tapN) {
        LAB.tapN = n;
        const d = info.tap?.pick === 1 ? -1 : 1;
        if (pics?.kind === "video") pics.togglePlay();
        else if (pics?.count > 1) pics.go((pics.page + d + pics.count) % pics.count);
      }
      out.sheets = { page: { page: pics?.page ?? 0 } };
    },
    build(k) {
      LAB.tapN = 0;
      k.sheet({ id: "page", center: [0, 0, 0], width: 2, height: 2, normal: [0, 0, 1] });
      // A thin gray card behind it, so a white page has an edge on a white
      // background (and the picture a back), with clean, sharp edges (rect).
      const W = 2.08;
      rect(k, { share: 1, at: [-W / 2, -W / 2, -0.03], u: [W, 0, 0], v: [0, W, 0], n: [0, 0, 1], color: () => "#c3c7ce" }); // prettier-ignore
    },
  },
  "your-book": BOOK_RECIPE,
  "photo-album": ALBUM_RECIPE,
  "picture-frame": FRAME_RECIPE,
};

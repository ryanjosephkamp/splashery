// Pictures and pages (lane Pictures): toys that show a PDF, a picture, a GIF
// or a video as splats, through the picture sheets of src/pictures.js. For
// now one plain test toy, the Picture lab (labs only); the toy lanes that
// follow add the book, the photo album, the frame and the screens.

import { mix, shade, smoothstep, clamp } from "../kit.js";
import { TOY_SOUNDS } from "../toy-sounds.js"; // lane Pages r6: the album's page sound on a pull

// Each toy's tap state (one toy is shown at a time).
const LAB = { tapN: 0, focus: false, sides: [], pend: 0 }; // (sides, pend: lane Pages r6)

// Page focus (see bookFocus) for a toy with one picture: a double-tap on it
// fills the screen with it, and again (or off it) lets go.
function focusToggle(S, p) {
  if (S.focus) S.focus = false;
  else if (p) S.focus = true;
  else return false;
  return true;
}

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
// Sound C (the owner's note of October 2: a page sound per book type): a
// real page turning for each style, with a soft landing for the heavier
// ones. Glossy and slick for the magazine, light and papery for the paperback
// (and the stapled paper and spiral notebook), fuller for the hardcover.
const PAGE = (file, o = {}) => ({ voice: "sample", file, vol: 1.1, ...o, fallback: { voice: "pageflip", f: 1900, decay: 1.4, vol: 0.7 } }); // prettier-ignore
const PAGE_SOUNDS = {
  hardcover: [PAGE("your-book-hardcover.mp3"), { voice: "thud", at: 0.82, f: 150, decay: 0.35, vol: 0.3 }], // prettier-ignore
  paperback: PAGE("your-book-paperback.mp3"),
  magazine: PAGE("your-book-magazine.mp3"),
  spiral: PAGE("your-book-paperback.mp3", { pitch: 0.92 }),
  stapled: PAGE("your-book-paperback.mp3", { pitch: 1.08, vol: 0.9 }),
};

// Lane Pages r6: a page pulled over and let fall back settles softly.
const PAGE_SETTLE = { voice: "thud", f: 160, decay: 0.2, vol: 0.12 };
const BOOK_STYLES = {
  hardcover: { bound: "side", cover: "board", T: 0.045, cb: 0.024, ov: 0.03, g: 0, curl: 1.25, coverCurl: 0 }, // prettier-ignore
  paperback: { bound: "side", cover: "card", T: 0.036, cb: 0.005, ov: 0, g: 0, curl: 1.25, coverCurl: 1.0 }, // prettier-ignore
  magazine: { bound: "side", cover: "card", T: 0.024, cb: 0.0025, ov: 0, g: 0, curl: 1.6, coverCurl: 1.5 }, // prettier-ignore
  spiral: { bound: "side", cover: "card", T: 0.03, cb: 0.006, ov: 0, g: 0.05, curl: 0.7, coverCurl: 0.5 }, // prettier-ignore
  stapled: { bound: "top", T: 0.026, curl: 1.3 },
};

const BOOK = { K: 0, anim: null, queue: [], tapN: 0, lastPage: 0, style: null, dims: null, frame: 0, landed: 0, press: null, N: 0, focus: null, viewK: -1, one: false }; // prettier-ignore

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
// A page's turn: it lifts at once and lands softly (no pause at the start,
// when the page would only bend where it lies).
// A tapped turn's curve: it lifts off at once (lane Fix7: it used to start
// slowly, which felt laggy beside a page pulled by hand) and settles gently.
const easeTurn = (x) => 0.6 * (0.5 - 0.5 * Math.cos(Math.PI * x)) + 0.4 * (1 - (1 - x) * (1 - x));

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
  PG.host = "book"; // lane Pages r6
  // Lane Books r5: a risen figure, or a link, first.
  const r5 = bk5Tap(p);
  if (r5) return r5;
  const K = BOOK.anim ? BOOK.anim.to : BOOK.K;
  const { W, H, g } = BOOK.dims;
  // (Seen close up, one page at a time: its left half goes back.)
  const f = BOOK.focus;
  const mid = f === "L" ? -(g + W / 2) : f === "R" ? g + W / 2 : 0;
  const back = st.bound === "top" ? p[1] > H / 4 : K >= 1 && p[0] < mid;
  return { key: "turn", pick: back ? 1 : 0 };
}

// ---- Page focus (lane Books) --------------------------------------------------------
//
// A double-tap on a page glides the view to it, filling the screen (the
// engine's out.view); a double-tap again, or a zoom out, shows the whole
// book. While a page is in view, forward goes from a left page to the right
// one, then turns the leaf and lands on the next left page (back the other
// way). Reading "One page" keeps a page in view (the default on a phone
// held upright). BOOK.focus: null (the whole book), "C" (the closed book's
// cover, or stapled paper's top sheet), "L" or "R" (the spread's pages).
const bkPortrait = () => typeof innerWidth === "number" && innerHeight > innerWidth;
const READING = {
  key: "reading",
  label: "Reading",
  type: "select",
  // Old links and scenes have no reading: it follows the screen's shape.
  get default() {
    return bkPortrait() ? "one" : "both";
  },
  choices: [
    { id: "both", label: "Both pages" },
    { id: "one", label: "One page" },
  ],
};
// Whether a side of a spread's leaves has a page (side 0 is the cover).
function hasSide(side) {
  if (BOOK.sides) return side >= 1 && !!BOOK.sides[side]?.length;
  return side >= 1 && side < BOOK.N;
}
// The page a view lands on in spread K: going forward, its left page (the
// right when the left is blank); going back, its right.
function landSide(K, fwd) {
  if (BOOK.style?.bound === "top" || K <= 0) return "C";
  const L = hasSide(2 * K - 2);
  const R = hasSide(2 * K - 1);
  if (fwd) return L || !R ? "L" : "R";
  return R || !L ? "R" : "L";
}
// The spread a view follows: where a turn goes (a pull, once it is let go
// to finish), else where the book lies.
function viewSpread() {
  const a = BOOK.anim;
  if (!a) return BOOK.K;
  if (a.pull) return a.pull.release?.to ? a.to : a.from;
  return a.to;
}
function bookFocus(p) {
  const st = BOOK.style;
  if (!st || !BOOK.dims) return false;
  if (BOOK.focus) {
    BOOK.focus = null;
    return true;
  }
  // (A double-tap off the book resets the view, as on other toys.)
  if (!p) return false;
  const K = viewSpread();
  if (st.bound === "top" || K <= 0) BOOK.focus = "C";
  else {
    const f = p[0] < 0 ? "L" : "R";
    const other = f === "L" ? "R" : "L";
    BOOK.focus = hasSide(2 * K - (f === "L" ? 2 : 1)) ? f : other;
  }
  return true;
}
// A book rebuilt with the same file (a new style, or Reading) opens where
// it was: the build keeps the page, the drive opens its spread.
function bookResume(k) {
  const key = k.media ? `${k.media.name}:${k.media.count}` : null;
  BOOK.resume = key && key === BOOK.mediaKey ? BOOK.lastPage : 0;
  BOOK.mediaKey = key;
}
// Page focus for the drive: steps within a spread, follows turns, and says
// what to show (out.view).
function bookView(st, out) {
  const K = viewSpread();
  if (K !== BOOK.viewK) {
    const fwd = K > BOOK.viewK;
    BOOK.viewK = K;
    // (A link lands on the page it points to: lane Books r5.)
    const to = BOOK.linkSide;
    BOOK.linkSide = null;
    if (BOOK.focus || BOOK.one)
      BOOK.focus = to && st.bound === "side" && K >= 1 ? to : landSide(K, fwd);
  }
  const f = BOOK.focus;
  if (!f) {
    out.view = { key: "all" };
    return;
  }
  const { W, H, g } = BOOK.dims;
  const ov = st.ov || 0;
  const x = f === "L" ? -(g + W / 2) : f === "R" ? g + W / 2 : 0;
  out.view = { key: f, center: [x, 0, 0], size: f === "C" ? [W + 2 * ov, H + 2 * ov] : [W, H] };
}
// A tap forward on a left page in view (or back on a right one) glides to
// the other page of the spread instead of turning.
function bookStep(st) {
  const f = BOOK.focus;
  const d = BOOK.queue[0];
  if (st.bound !== "side" || BOOK.K < 1 || !d) return false;
  if (d > 0 && f === "L" && hasSide(2 * BOOK.K - 1)) BOOK.focus = "R";
  else if (d < 0 && f === "R" && hasSide(2 * BOOK.K - 2)) BOOK.focus = "L";
  else return false;
  BOOK.queue.shift();
  return true;
}

// ---- Links and figures that pop out (lane Books r5, lane Pages r6) ----------------
//
// Links: a tap on a link of a PDF page lying open (not turning) follows it.
// A web link asks first (pics.openLink: the address, then a real link that
// opens in a new tab); a link to another page turns the book there. Each
// page's links show as a faint blue tint with an underline (bookDecorate).
//
// Pop out (lane Pages r6: the top bar's switch, one for every page toy):
// nothing rises by itself. With the switch on, a tap on a figure (a picture
// in the PDF, from pics.figures; a photo in the album; the photo in the
// Picture lab) raises it off the page toward the reader as one solid piece,
// grown a little and turned toward the middle, and the page under it shows
// the empty place with a soft shadow (the page drawn again, as a variant).
// A tap on another figure raises that one too (up to POP_CAP at once; one
// more lays the oldest back); a tap on a risen figure lays it back; a box
// drawn round anything else (Draw a box) rises the same way. A page turn
// lays every risen figure back quickly before the page moves. While any is
// up the book may be tilted (out.tiltFree): a drag on a risen figure, or off
// the pages, turns the view.
//
// A photo gets its depth from the Photo to 3D depth model (loaded the first
// time; until then it rises as a flat card); a flat graphic (a chart, a
// diagram, text) rises as a card with its strongest shapes a little in
// front. Each risen figure is a picture sheet on its own part (pop0 on
// bk5pop0, and so on), so it moves as one piece. The slider over the stage
// sets the depth of the figure raised last (from its own depth up to five
// times more); a depth other than its own is kept in the scene (toy.figures).
const BK5 = { key: "", links: new Map(), figs: new Map(), popOn: false, boxOn: false, drawing: null, lastK: -1, frame: 0 }; // prettier-ignore
// Three at once keeps a phone smooth: each risen figure is a sheet of its own
// (a photo's up to a few hundred thousand splats on a phone's budget).
const POP_CAP = 3;
const POP_RISE = 0.95; // seconds to rise
const POP_FALL = 0.7; // seconds to lay back
const POP_FAST = 0.28; // seconds to lay back before a page turns
const POP_SWAY = 6; // seconds a risen figure sways (smaller and smaller)
const DEPTH_MAX = 5; // the most depth, in multiples of a figure's own
// pops: the figures up (or on their way), oldest first; host: "book" (Your
// book and the Photo album) or "lab" (the Picture lab); sel: the id of the
// figure the slider sets; saved: the scene's figure depths (info.figures).
const PG = { pops: [], id: 0, sel: 0, layers: false, sliderN: 0, host: "book", pics: null, N: 0, time: 0, saved: [], wait: null, busy: false }; // prettier-ignore
const LAB_DIMS = { W: 2, H: 2, g: 0 };
// For tests and tools: the state of links and pop-out, and where a place on
// a page in view lies (recipe units; f is [x, y] in fractions of the page
// from its top-left corner). POP is the figure raised last (or an idle
// stand-in).
const IDLE = { phase: "idle", target: null, kind: "", relief: null, u: 0 };
export const BOOKS_R5 = {
  BK5,
  PG,
  get POP() {
    return PG.pops[PG.pops.length - 1] || IDLE;
  },
  // A photo's relief at a depth (pgRelief), for tests.
  deepen: (relief, depth) => pgRelief({ relief, depth, kind: "photo" }),
  point(page, f) {
    const r = PG.host !== "lab" && BOOK.sides ? bk5PhotoRect(page, PG.pics) : bk5PageRect(page, PG.pics); // prettier-ignore
    return [r.cx - r.hw + 2 * r.hw * f[0], r.cy + r.hh - 2 * r.hh * f[1], r.z];
  },
};

const qAxis = (ax, a) => [ax[0] * Math.sin(a / 2), ax[1] * Math.sin(a / 2), ax[2] * Math.sin(a / 2), Math.cos(a / 2)]; // prettier-ignore
const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
function qRot(q, v) {
  const [x, y, z, w] = q;
  const c = [y * v[2] - z * v[1] + w * v[0], z * v[0] - x * v[2] + w * v[1], x * v[1] - y * v[0] + w * v[2]]; // prettier-ignore
  return [v[0] + 2 * (y * c[2] - z * c[1]), v[1] + 2 * (z * c[0] - x * c[2]), v[2] + 2 * (x * c[1] - y * c[0])]; // prettier-ignore
}
const easeOutBack = (x) => 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2;

const isLab = () => PG.host === "lab";
const pgDims = () => (isLab() ? LAB_DIMS : BOOK.dims);
// The page in view seen close up: "L", "R" or "C" (the book), "C" (the
// lab's page filling the screen), or null.
const pgFocus = () => (isLab() ? (LAB.focus ? "C" : null) : BOOK.focus);
const pgAlbum = () => !isLab() && !!BOOK.sides;

// The sides (pages of a book, sides of the album) open in view: the page in
// focus, else the right then the left; none while the book is shut. The
// Picture lab: its page, for a PDF or a picture.
function bk5Sides(N) {
  if (isLab()) return LAB.sides || [];
  const st = BOOK.style;
  const K = BOOK.K;
  if (!st || !N) return [];
  if (st.bound === "top") return K < N ? [K] : [];
  if (K < 1) return [];
  const L = 2 * K - 2;
  const R = 2 * K - 1;
  const order = BOOK.focus === "L" ? [L] : BOOK.focus === "R" ? [R] : [R, L];
  return order.filter((s) => hasSide(s));
}
// The leaf slot and face that show a side at rest.
function sideSlot(s) {
  if (BOOK.style.bound === "top") return { slot: s % 4, fb: "f" };
  return s % 2 ? { slot: ((s + 1) / 2) % 4, fb: "f" } : { slot: (s / 2) % 4, fb: "b" };
}
// Where a book's page lies at rest: its center and half sizes (recipe
// units), fitted to its own shape as the sheets fit it. (The lab's page is
// fitted about the middle of its square sheet.)
function bk5PageRect(P, pics) {
  const { W, H, g } = pgDims();
  const a = pics?.aspect?.(P) || W / H;
  let hw = W / 2;
  let hh = H / 2;
  if (a > W / H) hh = hw / a;
  else hw = hh * a;
  if (isLab()) return { cx: 0, cy: 0, hw, hh, z: 0.002 };
  if (BOOK.style.bound === "top") return { cx: 0, cy: H / 2 - hh, hw, hh, z: E };
  return { cx: P % 2 ? g + hw : -(g + hw), cy: 0, hw, hh, z: E };
}
// Where an album photo lies at rest (inside its mount: albumDecorate's
// margins and caption band), and the sheet that shows it.
function bk5PhotoRect(q, pics) {
  const { W, H } = BOOK.dims;
  const s = BOOK.sideOf?.[q];
  const list = BOOK.sides?.[s] || [];
  const kind = BOOK.kinds?.[s] || "one";
  const n = kind === "one" ? "o" : kind === "stack" ? (list[0] === q ? "t" : "u") : list[0] === q ? "l" : "r"; // prettier-ignore
  const box = ALBUM_BOXES(W, H)[n];
  const a = pics?.aspect?.(q) || 1;
  let sw = box.s[0] / 2;
  let sh = box.s[1] / 2;
  if (a > sw / sh) sh = sw / a;
  else sw = sh * a;
  const w = 2 * sw;
  const h = 2 * sh;
  const m = 0.05 * Math.min(w, h);
  const band = BOOK.captions ? 0.13 * h : 0;
  const sc = Math.min((w - 2 * m) / w, (h - 2 * m - band) / h);
  const ph = h * sc;
  const y0 = m + (h - 2 * m - band - ph) / 2;
  const { slot, fb } = sideSlot(s);
  return { cx: s % 2 ? box.c[0] : -(W - box.c[0]), cy: box.c[1] + sh - (y0 + ph / 2), hw: (w * sc) / 2, hh: ph / 2, z: ALBUM_CARD + ALBUM_LIFT, sheet: `a${slot}${fb}${n}` }; // prettier-ignore
}
// A pop-out target: { page, box (fractions of the page), photo, sheet (the
// page sheet that gets the hole), rect (where the figure lies at rest), c
// (its center on the pop sheet), g0 (the pop sheet's scale at rest) }.
function bk5Target(page, box, pics, photo = false) {
  const { W, H } = pgDims();
  // The pop sheet is the page (or photo) fitted into W x H about the middle.
  const a = pics?.aspect?.(page) || W / H;
  let fw = W / 2;
  let fh = H / 2;
  if (a > W / H) fh = fw / a;
  else fw = fh * a;
  const [x0, y0, x1, y1] = box;
  const c = [(x0 + x1 - 1) * fw, (1 - y0 - y1) * fh, 0];
  if (pgAlbum()) {
    const r = bk5PhotoRect(page, pics);
    return { page, box, photo: true, sheet: r.sheet, rect: r, c, g0: r.hw / fw };
  }
  const pr = bk5PageRect(page, pics);
  const rect = { cx: pr.cx + (x0 + x1 - 1) * pr.hw, cy: pr.cy + (1 - y0 - y1) * pr.hh, hw: (x1 - x0) * pr.hw, hh: (y1 - y0) * pr.hh, z: pr.z }; // prettier-ignore
  const sheet = isLab() ? "page" : (({ slot, fb }) => `${fb}${slot}`)(sideSlot(page));
  return { page, box, photo, sheet, rect, c, g0: 1 };
}
// The figures on the pages in view, the biggest first on each page (a
// picture in the lab is one figure, the whole of it).
function bk5Figures(pics, N) {
  const out = [];
  for (const s of bk5Sides(N)) {
    if (pgAlbum())
      for (const q of BOOK.sides[s] || []) out.push(bk5Target(q, [0, 0, 1, 1], pics, true)); // prettier-ignore
    else if (isLab() && pics?.kind === "image") out.push(bk5Target(s, [0, 0, 1, 1], pics, true));
    else {
      const figs = (BK5.figs.get(s) || []).slice();
      figs.sort((a, b) => (b.box[2] - b.box[0]) * (b.box[3] - b.box[1]) - (a.box[2] - a.box[0]) * (a.box[3] - a.box[1])); // prettier-ignore
      for (const f of figs) out.push(bk5Target(s, f.box, pics));
    }
  }
  return out;
}
const inRect = (p, r, pad = 0) => Math.abs(p[0] - r.cx) <= r.hw + pad && Math.abs(p[1] - r.cy) <= r.hh + pad; // prettier-ignore
const sameBox = (a, b) => a.length === 4 && b.length === 4 && a.every((v, i) => Math.abs(v - b[i]) < 2e-3); // prettier-ignore
// The page in view under a point, with where on it (fractions from its
// top-left corner); null off the pages (or for the album, which has no
// links and whose boxes are its photos).
function bk5PageAt(p, pics) {
  if (pgAlbum() || (!isLab() && (!BOOK.dims || BOOK.anim))) return null;
  for (const s of bk5Sides(PG.N)) {
    const r = bk5PageRect(s, pics);
    if (!inRect(p, r)) continue;
    return { page: s, rect: r, f: [(p[0] - (r.cx - r.hw)) / (2 * r.hw), (r.cy + r.hh - p[1]) / (2 * r.hh)] }; // prettier-ignore
  }
  return null;
}

// The risen figures: where each stands now (risen), and the place it left.
const pgLive = () => PG.pops.filter((F) => F.phase !== "idle");
const pgUp = () => PG.pops.some((F) => F.phase === "rise" || F.phase === "up");
function pgHitRisen(p, standing = false) {
  // (The nearest first: the one raised last.)
  for (let i = PG.pops.length - 1; i >= 0; i--) {
    const F = PG.pops[i];
    if (F.phase !== "rise" && F.phase !== "up") continue;
    if (F.at && inRect(p, F.at, 0.01)) return F;
    if (!standing && inRect(p, F.target.rect, 0.005)) return F;
  }
  return null;
}

// What a tap does before it turns a page: lays a risen figure back, raises
// a figure it lands on (Pop out on), or follows a link.
function bk5Tap(p) {
  if (isLab() ? !PG.pics : !BOOK.style || !BOOK.dims) return null;
  const key = isLab() ? "next" : "turn";
  const pics = PG.pics;
  const hit = pgHitRisen(p);
  if (hit) return { key, pick: { lay: hit.id } };
  if (BK5.popOn && (isLab() || !BOOK.anim)) {
    const f = bk5Figures(pics, PG.N).find((f) => inRect(p, f.rect) && !PG.pops.some((F) => F.phase !== "idle" && F.target.page === f.page && sameBox(F.target.box, f.box))); // prettier-ignore
    if (f) return { key, pick: { fig: { page: f.page, box: f.box } } };
  }
  const at = !isLab() && bk5PageAt(p, pics);
  const links = at && BK5.links.get(at.page);
  if (!links) return null;
  const [fx, fy] = at.f;
  // (A little slack round each box: a finger is wider than a line of text.)
  const sx = 0.012;
  const sy = 0.008;
  const link = links.find((l) => fx >= l.box[0] - sx && fx <= l.box[2] + sx && fy >= l.box[1] - sy && fy <= l.box[3] + sy); // prettier-ignore
  return link ? { key, pick: { link } } : null;
}

// A tap's pick that is not a turn: true when it was one of these.
function bk5Pick(pk, pics, N) {
  if (!pk || typeof pk !== "object") return false;
  if (pk.link) {
    if (pk.link.url) pics?.openLink?.(pk.link.url);
    else if (Number.isInteger(pk.link.page) && pics) {
      // Seen a page at a time, the view lands on the page itself (odd pages lie on the right).
      const side = BOOK.style?.bound === "side" ? (pk.link.page % 2 ? "R" : "L") : null;
      if (side && pageSpread(BOOK.style, pk.link.page) === BOOK.K) {
        if (BOOK.focus) BOOK.focus = side; // the other page of this spread
      } else BOOK.linkSide = side;
      pics.go(pk.link.page);
    }
  } else if (pk.fig) {
    pgRaise(pk.fig, false);
  } else if (pk.lay) {
    const F = PG.pops.find((F) => F.id === pk.lay);
    if (F) pgFall(F, PG.time);
  }
  return true;
}

// The taps since the last frame, oldest first (info.taps; info.tap alone
// where only that is given).
function pgTaps(info) {
  if (info.taps?.length) return info.taps;
  return info.tap ? [info.tap] : [];
}

// Raises a figure ({ page, box }): on its own sheet and part, the oldest
// laid back first when POP_CAP are up.
function pgRaise(fig, manual) {
  const pics = PG.pics;
  if (!pics) return;
  const live = pgLive();
  // (P1: a figure in layers takes every pop sheet, one per layer; the
  // others lie back first.)
  const layered = PG.layers;
  const load = live.reduce((n, F) => n + (F.layered ? POP_CAP : 1), 0);
  if (load > 0 && (layered || load >= POP_CAP)) {
    if (layered) for (const F of live) pgFall(F, PG.time, true);
    else pgFall(live[0], PG.time, true);
    PG.wait = { fig, manual };
    return;
  }
  const used = new Set(PG.pops.map((F) => F.slot));
  let slot = 0;
  while (used.has(slot)) slot++;
  const T = bk5Target(fig.page, fig.box, pics, pgAlbum() || (isLab() && pics.kind === "image"));
  const saved = PG.saved.find((s) => s.page === T.page && sameBox(s.box, T.box));
  const F = { id: ++PG.id, slot, target: T, phase: "prep", t0: 0, asked: 0, tUp: 0, u: 0, relief: null, kind: "", known: false, depthMs: 0, depth: saved ? saved.depth : 1, manual, fast: false, at: null, layered }; // prettier-ignore
  PG.pops.push(F);
  PG.sel = F.id;
  bk5Start(F, pics);
}
function pgFall(F, time, fast = false) {
  if (F.phase === "prep" || F.phase === "rest") {
    F.phase = "unhole";
    F.asked = time;
    F.fast = fast;
    return;
  }
  if (F.phase !== "rise" && F.phase !== "up") {
    if (fast) F.fast = true;
    return;
  }
  // From wherever it is now, back down.
  const dur = fast ? POP_FAST : POP_FALL;
  F.phase = "fall";
  F.fast = fast;
  F.t0 = time - (1 - Math.min(1, F.u)) * dur;
}
// Every figure back down, quickly (a page about to turn).
function pgLayAll(time) {
  PG.wait = null;
  for (const F of PG.pops) pgFall(F, time, true);
}
function pgClear() {
  PG.pops = [];
  PG.wait = null;
  PG.sel = 0;
}
// (A new build: the slider's changes count from the start again.)
function pgReset() {
  pgClear();
  PG.sliderN = 0;
}

// Starts a pop: the figure's own pixels tell a photo from a flat graphic;
// a graphic gets its layers at once, a photo its depth when the model has
// worked it out.
function bk5Start(F, pics) {
  const T = F.target;
  const live = () => PG.pops.includes(F) && F.phase !== "idle";
  (async () => {
    let photo = T.photo;
    if (!photo) {
      const c = await pics.crop(T.page, T.box, 160);
      if (!live() || !c) return;
      photo = bk5IsPhoto(c);
      if (!photo) F.relief = bk5Layers(c, T, F.id);
    }
    F.kind = photo ? "photo" : "graphic";
    F.known = true;
    if (!photo) return;
    const c = await pics.crop(T.page, T.box, 518);
    if (!live() || !c) return;
    const img = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height); // prettier-ignore
    const [{ estimateDepth }, { normalizeDepth }] = await Promise.all([import("./photo-3d-depth.js"), import("./photo-3d-core.js")]); // prettier-ignore
    const dep = await estimateDepth({ w: img.width, h: img.height, data: img.data });
    if (!live()) return;
    F.depthMs = dep.ms || 0;
    // About a fifth of the figure's shorter side, from the farthest to the nearest.
    const short = (2 * Math.min(T.rect.hw, T.rect.hh)) / T.g0;
    F.relief = {
      key: `d${F.id}`,
      w: dep.w,
      h: dep.h,
      d: normalizeDepth(dep.d),
      depth: 0.2 * short,
    };
  })().catch((err) => {
    console.warn("Pop out:", err?.message || err);
    if (live()) F.known = true;
  });
}

// A chart, a diagram or text lies on a plain background (much of it one
// color, the color of its border); a photo does not.
function bk5Background(data, w, h) {
  const edge = [[], [], []];
  for (let x = 0; x < w; x++)
    for (const y of [0, h - 1]) for (let k = 0; k < 3; k++) edge[k].push(data[(y * w + x) * 4 + k]);
  for (let y = 0; y < h; y++)
    for (const x of [0, w - 1]) for (let k = 0; k < 3; k++) edge[k].push(data[(y * w + x) * 4 + k]);
  return edge.map((a) => a.sort((p, q) => p - q)[a.length >> 1]);
}
function bk5IsPhoto(c) {
  const { data, width: w, height: h } = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height); // prettier-ignore
  const bg = bk5Background(data, w, h);
  const n = w * h;
  let plain = 0;
  for (let i = 0; i < n; i++)
    if (Math.hypot(data[i * 4] - bg[0], data[i * 4 + 1] - bg[1], data[i * 4 + 2] - bg[2]) < 30) plain++; // prettier-ignore
  return plain / n < 0.35;
}

// A graphic's layers: the card, and its strongest shapes (what stands out
// from its background) a little in front, as a relief map.
function bk5Layers(c, T, id) {
  const { data, width: w, height: h } = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height); // prettier-ignore
  // The background: the middle color of the border.
  const bg = bk5Background(data, w, h);
  let d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const dist = Math.hypot(data[i * 4] - bg[0], data[i * 4 + 1] - bg[1], data[i * 4 + 2] - bg[2]);
    d[i] = dist > 70 ? 1 : 0;
  }
  // Grown by a pixel, then softened a little, so a shape lifts whole.
  for (let pass = 0; pass < 2; pass++) {
    const o = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let m = 0;
        let s = 0;
        let k = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            m = Math.max(m, d[yy * w + xx]);
            s += d[yy * w + xx];
            k++;
          }
        o[y * w + x] = pass === 0 ? m : s / k;
      }
    d = o;
  }
  const short = (2 * Math.min(T.rect.hw, T.rect.hh)) / T.g0;
  return { key: `l${id}`, w, h, d, depth: 0.045 * short };
}

// A figure's relief at its chosen depth (its own key per depth, so the
// sheet is built again when the depth changes). A graphic's layers stand
// further out. A photo goes deeper; but a photo the depth model reads as
// one smooth slope (a top-down photo of land: Depth Anything V2 Small sees
// ground running away from the camera, a ramp with faint relief on it)
// keeps its slope and gains its local relief instead: ridges and valleys,
// the depth less a blur of itself, so it rises as terrain.
function pgRelief(F) {
  const r = F.relief;
  if (!r || F.depth === 1) return r;
  const key = `${r.key}x${F.depth}`;
  if (F.kind !== "photo") return { ...r, key, depth: r.depth * F.depth };
  if (F.deep?.key === key) return F.deep;
  F.shape ||= pgShape(r);
  if (!F.shape.slope) return (F.deep = { ...r, key, depth: r.depth * F.depth });
  const k = 0.25 * (F.depth - 1);
  const d = new Float32Array(r.d.length);
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < d.length; i++) {
    d[i] = r.d[i] + k * F.shape.detail[i];
    if (d[i] < lo) lo = d[i];
    if (d[i] > hi) hi = d[i];
  }
  const span = hi - lo || 1;
  for (let i = 0; i < d.length; i++) d[i] = (d[i] - lo) / span;
  return (F.deep = { key, w: r.w, h: r.h, d, depth: r.depth * span });
}
// Whether a depth map is mostly one smooth slope (a plane fits it: R^2 over
// 0.9), and its local relief (the map less the plane, less a wide blur of
// that, scaled to about -0.5..0.5).
function pgShape(r) {
  const { w, h, d } = r;
  const n = w * h;
  const A = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const B = [0, 0, 0];
  let mean = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = [1, x / w, y / h];
      const z = d[y * w + x];
      mean += z;
      for (let i = 0; i < 3; i++) {
        B[i] += v[i] * z;
        for (let j = 0; j < 3; j++) A[i * 3 + j] += v[i] * v[j];
      }
    }
  mean /= n;
  const c = solve3(A, B);
  let res = 0;
  let tot = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const z = d[y * w + x];
      res += (z - (c[0] + (c[1] * x) / w + (c[2] * y) / h)) ** 2;
      tot += (z - mean) ** 2;
    }
  const slope = tot > 0 && 1 - res / tot > 0.9;
  if (!slope) return { slope };
  // (The slope comes off first, so the blur's edges add none of it back.)
  const flat = new Float32Array(n);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) flat[y * w + x] = d[y * w + x] - (c[0] + (c[1] * x) / w + (c[2] * y) / h); // prettier-ignore
  const blur = boxBlur(flat, w, h, Math.max(2, Math.round(0.06 * Math.max(w, h))));
  const detail = new Float32Array(n);
  for (let i = 0; i < n; i++) detail[i] = flat[i] - blur[i];
  const sorted = Float32Array.from(detail).sort();
  const range = sorted[Math.floor(0.98 * n)] - sorted[Math.floor(0.02 * n)] || 1;
  // Softened a little (steep steps would pull the splats apart) and faded
  // out toward the edges (where the blur has less to go on).
  const soft = boxBlur(detail, w, h, Math.max(1, Math.round(0.012 * Math.max(w, h))));
  const edge = 0.05 * Math.max(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = Math.min(1, Math.min(x, y, w - 1 - x, h - 1 - y) / edge);
      detail[y * w + x] = (soft[y * w + x] / range) * k * k * (3 - 2 * k);
    }
  return { slope, detail };
}
function solve3(A, B) {
  const M = [0, 1, 2].map((i) => [A[i * 3], A[i * 3 + 1], A[i * 3 + 2], B[i]]);
  for (let i = 0; i < 3; i++) {
    let p = i;
    for (let k = i + 1; k < 3; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
    [M[i], M[p]] = [M[p], M[i]];
    for (let k = 0; k < 3; k++) {
      if (k === i || !M[i][i]) continue;
      const f = M[k][i] / M[i][i];
      for (let j = i; j < 4; j++) M[k][j] -= f * M[i][j];
    }
  }
  return M.map((r, i) => (r[i] ? r[3] / r[i] : 0));
}
// A box blur of radius r, three times over (about a Gaussian), with running
// sums so a wide one stays quick.
function boxBlur(src, w, h, r) {
  let a = Float32Array.from(src);
  const t = new Float32Array(w * h);
  const line = (get, set, len) => {
    let sum = 0;
    for (let k = -r; k <= r; k++) sum += get(Math.min(len - 1, Math.max(0, k)));
    for (let i = 0; i < len; i++) {
      set(i, sum / (2 * r + 1));
      sum += get(Math.min(len - 1, i + r + 1)) - get(Math.max(0, i - r));
    }
  };
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++)
      line(
        (x) => a[y * w + x],
        (x, v) => (t[y * w + x] = v),
        w,
      );
    for (let x = 0; x < w; x++)
      line(
        (y) => t[y * w + x],
        (y, v) => (a[y * w + x] = v),
        h,
      );
  }
  return a;
}

// P1, layered pop-up scenes: the sheets a figure uses (every pop sheet in
// layers), and layer i of a figure in layers: the whole picture behind
// (0), then the nearer part (1) and the nearest (2) cut out by its depth
// map (a graphic: its card, then its strongest shapes), each a flat card a
// gap in front of the one behind. A layer waits for the map (`ready`).
function pgSheets(F) {
  return F.layered ? [0, 1, 2].map((i) => `pop${i}`) : [`pop${F.slot}`];
}
function pgLayer(F, i) {
  const r = F.relief;
  const T = F.target;
  const short = (2 * Math.min(T.rect.hw, T.rect.hh)) / T.g0;
  const gap = 0.07 * short * F.depth;
  if (i === 0) return { relief: null, ready: true, gap };
  if (!r) return { relief: null, ready: false, gap };
  F.cuts ||= pgCuts(r, F.kind);
  const lo = F.cuts[i - 1];
  if (lo === undefined) return null;
  return { relief: { key: `${r.key}L${i}`, w: r.w, h: r.h, d: r.d, depth: 0, nearest: true, keep: [lo, 1.01] }, ready: true, gap }; // prettier-ignore
}
// Where the layers are cut: a photo's depth at the middle and at four
// fifths of its pixels (so the nearer layer is about half the picture and
// the nearest about a fifth); a graphic's shapes in one layer.
function pgCuts(r, kind) {
  if (kind !== "photo") return [0.5];
  const v = Array.from(r.d).sort((a, b) => a - b);
  const q = (f) => v[Math.min(v.length - 1, Math.floor(f * v.length))];
  return [Math.max(0.02, q(0.5)), Math.max(0.05, q(0.8))];
}

// The slider over the stage: the depth of the figure raised last. Moving it
// sets that figure's depth (in quarter steps) and keeps it in the scene.
function pgSlider(out, info) {
  const F = PG.pops.find((F) => F.id === PG.sel && (F.phase === "rise" || F.phase === "up"));
  const s = info?.slider;
  // (A toy built again counts its slider's changes from the start.)
  if (s && s.n < PG.sliderN) PG.sliderN = 0;
  if (F && s && s.n > PG.sliderN && s.id === `pg${F.id}`) {
    const depth = Math.round(4 * (1 + (DEPTH_MAX - 1) * s.value)) / 4;
    if (depth !== F.depth) {
      F.depth = depth;
      const T = F.target;
      const list = PG.saved.filter((x) => !(x.page === T.page && sameBox(x.box, T.box)));
      if (depth > 1) list.push({ page: T.page, box: T.box.map((v) => Math.round(v * 1e4) / 1e4), depth }); // prettier-ignore
      PG.saved = list;
      out.figures = list;
    }
  }
  if (s) PG.sliderN = Math.max(PG.sliderN, s.n);
  if (F && F.known) out.slider = { id: `pg${F.id}`, label: "Depth", value: (F.depth - 1) / (DEPTH_MAX - 1) }; // prettier-ignore
}

// Each frame: the links and figures of the pages in view, and the pop-out.
// `moving`: a page turning (every figure goes at once).
function bk5Drive(c, out, pics, N, time, info = null, moving = false) {
  BK5.frame++;
  PG.pics = pics;
  PG.N = N;
  PG.time = time;
  if (!isLab()) {
    BOOK.pics = pics;
    BOOK.time = time;
  }
  if (Array.isArray(info?.figures)) PG.saved = info.figures;
  const mk = pics ? `${pics.kind}|${pics.name}|${pics.count}` : "";
  if (mk !== BK5.key) {
    BK5.key = mk;
    BK5.links.clear();
    BK5.figs.clear();
    pgClear();
  }
  BK5.popOn = (c.pop ?? 0) > 0.5;
  BK5.boxOn = (c.box ?? 0) > 0.5;
  // P1: Pop-up layers switched: risen figures lie back, to rise the new way.
  const layers = (c.layers ?? 0) > 0.5;
  if (layers !== PG.layers) for (const F of PG.pops) pgFall(F, time);
  PG.layers = layers;
  // A page turned without waiting (a pull, a page that changed under it):
  // every figure is put back at once, and a drawn box goes.
  const K = isLab() ? (pics?.page ?? 0) : BOOK.K;
  if (moving || K !== BK5.lastK) {
    if (PG.pops.length) pgClear();
    BK5.lastK = K;
  }
  const canFind = pics && (pics.kind === "pdf" || (isLab() && pics.kind === "image"));
  if (
    canFind &&
    pics.kind === "pdf" &&
    typeof pics.links === "function" &&
    typeof pics.figures === "function" &&
    !moving
  )
    // prettier-ignore
    for (const s of bk5Sides(N)) {
      for (const [map, what] of [
        [BK5.links, "links"],
        [BK5.figs, "figures"],
      ]) {
        if (map.has(s)) continue;
        map.set(s, null);
        const key = BK5.key;
        pics[what](s).then((list) => BK5.key === key && map.set(s, list || []), () => map.delete(s)); // prettier-ignore
      }
    }
  // Pop out switched off: the figures it raised lie back (drawn boxes stay).
  if (!BK5.popOn) for (const F of PG.pops) if (!F.manual) pgFall(F, time);
  for (const F of PG.pops) pgStep(F, out, pics, time);
  PG.pops = PG.pops.filter((F) => F.phase !== "idle");
  if (!PG.pops.some((F) => F.id === PG.sel)) PG.sel = PG.pops[PG.pops.length - 1]?.id || 0;
  if (PG.wait && pgLive().length < POP_CAP) {
    const w = PG.wait;
    PG.wait = null;
    pgRaise(w.fig, w.manual);
  }
  pgSlider(out, info);
  pgCrowd(time);
  // The poses, the holes and the sheets.
  const holes = new Map();
  const lay = PG.pops.find((F) => F.layered);
  for (let i = 0; i < POP_CAP; i++) {
    const F = lay || PG.pops.find((F) => F.slot === i);
    const L = lay ? pgLayer(F, i) : null;
    if (!F || (lay && !L)) {
      out.sheets[`pop${i}`] = { page: -1, visible: 0 };
      out.parts[`bk5pop${i}`] = { visible: 0 };
      continue;
    }
    const T = F.target;
    const ph = F.phase;
    out.sheets[`pop${i}`] = { page: T.page, crop: T.box, relief: L ? L.relief : pgRelief(F), visible: ph === "prep" || (L && !L.ready) ? 0 : 1, ahead: 1 }; // prettier-ignore
    if ((ph === "rest" || ph === "rise" || ph === "up" || ph === "fall") && (!lay || i === 0)) {
      if (!holes.has(T.sheet)) holes.set(T.sheet, []);
      holes.get(T.sheet).push(T.box);
    }
    let u = 0;
    const fall = F.fast ? POP_FAST : POP_FALL;
    if (ph === "rise") u = easeOutBack(clamp01((time - F.t0) / POP_RISE));
    else if (ph === "up") u = 1;
    else if (ph === "fall") u = 1 - easeIO(clamp01((time - F.t0) / fall));
    const pose = bk5Pose(F, u, time);
    // P1: each layer stands a little in front of the one behind it, and
    // they part as the figure comes up.
    if (L && i > 0) {
      const part = easeIO(clamp01((F.u - 0.2) / 0.8));
      const n = qRot(pose.quat, [0, 0, 1]);
      for (let k = 0; k < 3; k++) pose.offset[k] += n[k] * L.gap * i * part;
    }
    out.parts[`bk5pop${i}`] = pose;
    if (ph === "rise" || ph === "fall" || (ph === "up" && time - F.tUp < POP_SWAY)) {
      if (BK5.frame % 2 === 0) out.resortPose = true;
    }
  }
  for (const [id, boxes] of holes) {
    if (!out.sheets[id]) continue;
    // (The album's photo is its own sheet: the whole of it lifts.)
    out.sheets[id].variant = pgAlbum() ? "hole" : `hole:${boxes.map((b) => b.map((v) => v.toFixed(4)).join(",")).join(";")}`; // prettier-ignore
  }
  // While a figure stands up, the book may be tilted to see it from the side.
  if (pgUp()) out.tiltFree = true;
  // Frames keep coming while a figure moves, waits for its pictures or its
  // depth, or while the page's figures are being found.
  const waiting = BK5.popOn && pics?.kind === "pdf" && typeof pics.figures === "function" && bk5Sides(N).some((s) => !BK5.figs.get(s)); // prettier-ignore
  PG.busy = waiting || PG.pops.some((F) => F.phase !== "up" || time - F.tUp < POP_SWAY || (F.kind === "photo" && !F.relief)); // prettier-ignore
  // A box being drawn: its four corners.
  const D = BK5.drawing;
  for (let i = 0; i < 4; i++) {
    if (!D) {
      out.parts[`bk5c${i}`] = { visible: 0 };
      continue;
    }
    const x = i % 2 ? Math.max(D.p0[0], D.p1[0]) : Math.min(D.p0[0], D.p1[0]);
    const y = i < 2 ? Math.max(D.p0[1], D.p1[1]) : Math.min(D.p0[1], D.p1[1]);
    out.parts[`bk5c${i}`] = { offset: [x, y, D.rect.z] };
  }
  // (The corners are sorted where they stand, not at the middle where they
  // were built.)
  if (D && BK5.frame % 3 === 0) out.resortPose = true;
}

// One figure's step: prep (finding photo or graphic) -> rest (lying where it
// was, unseen, waiting for its sheet and a photo's depth) -> rise -> up ->
// fall -> unhole (the page gets its own picture back) -> idle.
function pgStep(F, out, pics, time) {
  const T = F.target;
  switch (F.phase) {
    case "prep":
      if (F.known && pgSheets(F).every((id) => pics.ready(id))) {
        F.phase = "rest";
        F.asked = time;
      }
      break;
    case "rest": {
      // (It lies where it was, so it can wait unseen: for the page under it,
      // and up to 2.5 s for a photo's depth, so it rises with it.)
      const depthWait = F.kind === "photo" && !(F.relief && pgSheets(F).every((id) => pics.ready(id))) && time - F.asked < 2.5; // prettier-ignore
      if ((pics.ready(T.sheet) && !depthWait) || time - F.asked > 4) {
        F.phase = "rise";
        F.t0 = time;
        out.cues.push(POP_SOUNDS.rise);
      }
      break;
    }
    case "rise":
      if (time - F.t0 >= POP_RISE) {
        F.phase = "up";
        F.tUp = time;
      }
      break;
    case "fall":
      if (time - F.t0 >= (F.fast ? POP_FAST : POP_FALL)) {
        F.phase = "unhole";
        F.asked = time;
        out.cues.push(POP_SOUNDS.land);
      }
      break;
    case "unhole":
      // The page goes back to its own picture under the figure, then the
      // figure goes (sooner before a page turn).
      if (pics.ready(T.sheet) || time - F.asked > (F.fast ? 0.5 : 1.5)) F.phase = "idle";
      break;
  }
}

// Keeps risen figures apart: for each, whether it is up alone (F.k eases
// to 1) or with others (to 0), and how far it may grow (F.cap, as a scale
// of its place on the page) before it would reach another's place, both
// grown alike, with a margin for the nearer one looking bigger.
function pgCrowd(time) {
  const dt = Math.max(0, Math.min(0.1, time - (PG.crowdT ?? time)));
  PG.crowdT = time;
  const shown = PG.pops.filter((F) => F.phase === "rest" || F.phase === "rise" || F.phase === "up" || F.phase === "fall"); // prettier-ignore
  for (const F of PG.pops) {
    const a = F.target.rect;
    let cap = Infinity;
    for (const G of shown) {
      if (G === F) continue;
      const b = G.target.rect;
      const sx = Math.abs(a.cx - b.cx) / (a.hw + b.hw);
      const sy = Math.abs(a.cy - b.cy) / (a.hh + b.hh);
      cap = Math.min(cap, Math.max(sx, sy));
    }
    const alone = cap === Infinity;
    // (And, with others up, it stays within its page.)
    if (!alone && !pgAlbum()) {
      const pr = bk5PageRect(F.target.page, PG.pics);
      cap = Math.min(cap, (pr.hw - Math.abs(a.cx - pr.cx)) / a.hw, (pr.hh - Math.abs(a.cy - pr.cy)) / a.hh); // prettier-ignore
    }
    F.cap = alone ? Infinity : Math.max(1, 0.8 * cap);
    const want = alone ? 1 : 0;
    if (F.k === undefined) F.k = want;
    F.k += (want - F.k) * (1 - Math.exp(-dt / 0.15));
  }
}

// The risen figure's pose at u (0 lying where it was, 1 risen; past 1 it
// overshoots a little): toward the reader and the middle of the view,
// growing a little, turned toward the middle, swaying a few times. Also
// keeps where it stands (F.at), for taps.
function bk5Pose(F, u, time) {
  const T = F.target;
  const { W, H, g } = pgDims();
  const r = T.rect;
  const f = pgFocus();
  const view = f === "L" ? [-(g + W / 2), 0] : f === "R" ? [g + W / 2, 0] : [0, 0];
  const z0 = r.z + 0.008;
  // Seen a page at a time the view is close: the figure comes less far
  // toward you and further toward the middle, so it stays on the screen.
  // (Each figure a little nearer than the one before, so two that meet
  // stand in front of each other, not mixed.)
  // (In the lab a figure as big as the page comes less far, or it would
  // fill the screen.)
  const big = isLab() ? Math.min(1, (2 * Math.max(r.hw, r.hh)) / H) : 0;
  // (With others up, it comes less far toward you too: nearer looks bigger.)
  const near = 0.6 + 0.4 * (F.k ?? 1);
  const lift = ((f ? 0.18 : 0.3) * (1 - 0.6 * big) * near + 0.03 * F.slot) * H;
  // (With others up, it rises straight off its own place and grows no
  // further than keeps it clear of them: the owner's note of October 5,
  // 2026, "popped out images shouldn't overlap". F.k eases between the two.)
  const k = F.k ?? 1;
  const pull = (f ? 0.65 : 0.3) * k;
  const C = [r.cx + (view[0] - r.cx) * pull * u, r.cy + (view[1] - r.cy) * pull * u, z0 + lift * u]; // prettier-ignore
  const span = isLab() || f ? W : 2 * W;
  // (Nor does it grow past the page.)
  const solo = 1 + (1 - big) * (Math.max(1, Math.min(f ? 1.15 : 1.3, (0.82 * H) / (2 * r.hh), (0.82 * span) / (2 * r.hw))) - 1); // prettier-ignore
  const crowd = Math.min(solo, F.cap ?? solo);
  const grow = crowd + (solo - crowd) * k;
  const s = T.g0 * (1 + (grow - 1) * u);
  const face = Math.max(-0.32, Math.min(0.32, -(r.cx - view[0]) * 0.45 * (PAGE_H / H)));
  const since = F.phase === "up" ? time - F.tUp : 0;
  const sway = F.phase === "up" ? 0.07 * Math.sin(2 * Math.PI * 0.32 * since + F.slot) * Math.exp(-since / 2.2) : 0; // prettier-ignore
  const q = qMul(qAxis([0, 1, 0], face * (0.3 + 0.7 * k) * u + sway), qAxis([1, 0, 0], -0.07 * u)); // prettier-ignore
  const c = qRot(q, [T.c[0] * s, T.c[1] * s, 0]);
  F.u = F.phase === "rise" ? clamp01((time - F.t0) / POP_RISE) : F.phase === "up" ? 1 : F.phase === "fall" ? Math.max(0, u) : 0; // prettier-ignore
  F.at = { cx: C[0], cy: C[1], hw: (r.hw * s) / T.g0, hh: (r.hh * s) / T.g0 };
  return { quat: q, offset: [C[0] - c[0], C[1] - c[1], C[2] - c[2]], scale: s, visible: 1 };
}

const POP_SOUNDS = {
  // A light paper lift as it rises, a soft tap as it lies back.
  rise: { voice: "pageflip", f: 2600, decay: 0.45, vol: 0.35 },
  land: { voice: "thud", f: 170, decay: 0.25, vol: 0.25 },
};

// The pop sheets, their parts and the corners of a box being drawn, for a
// book, the album or the lab (after its own sheets).
function bk5Build(k, z, dims = BOOK.dims) {
  const { W, H } = dims;
  pgReset();
  BK5.drawing = null;
  for (let i = 0; i < POP_CAP; i++) {
    const pp = k.part(`bk5pop${i}`, { pivot: [0, 0, 0], axis: [0, 1, 0] });
    k.sheet({ id: `pop${i}`, center: [0, 0, 0], width: W, height: H, part: pp, method: "pixels" });
  }
  const a = 0.06 * (H / PAGE_H);
  const t = 0.01 * (H / PAGE_H);
  const blue = "#2f7de1";
  for (let i = 0; i < 4; i++) {
    const cp = k.part(`bk5c${i}`, { pivot: [0, 0, 0], axis: [0, 1, 0] });
    const sx = i % 2 ? -1 : 1;
    const sy = i < 2 ? -1 : 1;
    rect(k, { share: 0.0015, at: [Math.min(0, sx * a), Math.min(0, sy * t), z], u: [a, 0, 0], v: [0, t, 0], n: [0, 0, 1], color: () => blue, part: cp }); // prettier-ignore
    rect(k, { share: 0.0015, at: [Math.min(0, sx * t), Math.min(0, sy * a), z], u: [t, 0, 0], v: [0, a, 0], n: [0, 0, 1], color: () => blue, part: cp }); // prettier-ignore
  }
}

// Drawing a box (the "Draw a box" switch): a drag on a page draws it, and
// letting go raises what is inside it. A drag that starts on a risen figure
// turns the view (the camera's own drag). Otherwise the book's own drag.
function bk5Drag(base) {
  return {
    plane: "view",
    at(p) {
      if (pgHitRisen(p, true)) return false;
      if (BK5.boxOn && !pgAlbum()) return !!bk5PageAt(p, PG.pics);
      return base.at(p);
    },
    start(p, time) {
      const at = BK5.boxOn && !pgAlbum() ? bk5PageAt(p, PG.pics) : null;
      if (!at) return base.start(p, time);
      BK5.drawing = { page: at.page, rect: at.rect, p0: p.slice(), p1: p.slice() };
    },
    move(p, time) {
      const D = BK5.drawing;
      if (!D) return base.move(p, time);
      const r = D.rect;
      D.p1 = [Math.max(r.cx - r.hw, Math.min(r.cx + r.hw, p[0])), Math.max(r.cy - r.hh, Math.min(r.cy + r.hh, p[1]))]; // prettier-ignore
    },
    end(time) {
      const D = BK5.drawing;
      if (!D) return base.end(time);
      BK5.drawing = null;
      const r = D.rect;
      const fx = (x) => (x - (r.cx - r.hw)) / (2 * r.hw);
      const fy = (y) => (r.cy + r.hh - y) / (2 * r.hh);
      const box = [fx(Math.min(D.p0[0], D.p1[0])), fy(Math.max(D.p0[1], D.p1[1])), fx(Math.max(D.p0[0], D.p1[0])), fy(Math.min(D.p0[1], D.p1[1]))].map(clamp01); // prettier-ignore
      // Too small to be a box: a tap.
      if (box[2] - box[0] < 0.04 || box[3] - box[1] < 0.03) return;
      pgRaise({ page: D.page, box }, true);
    },
  };
}

// Your book's pages drawn before they become splats: each link a faint blue
// tint with an underline (not on the cover, where a tap opens the book), and
// the place a risen figure left (variant "hole:x0,y0,x1,y1"): plain paper
// with the figure's soft shadow.
function bookDecorate(canvas, { variant, links, sheet }) {
  const g = canvas.getContext("2d", { willReadFrequently: true });
  const w = canvas.width;
  const h = canvas.height;
  // (Lane Pages r6: several figures' places, "hole:a,b,c,d;e,f,g,h".)
  if (variant?.startsWith("hole:"))
    for (const b of variant.slice(5).split(";")) bk5Hole(g, w, h, b.split(",").map(Number));
  for (const l of sheet === "cover" ? [] : links || []) {
    const [x0, y0, x1, y1] = l.box;
    g.fillStyle = "rgba(40, 110, 230, 0.12)";
    g.fillRect(x0 * w, y0 * h, (x1 - x0) * w, (y1 - y0) * h);
    g.fillStyle = "rgba(30, 90, 210, 0.75)";
    const lw = Math.max(1, Math.round(h * 0.0018));
    g.fillRect(x0 * w, y1 * h - lw, (x1 - x0) * w, lw);
  }
}
// Fills a box (fractions) with the paper round it, and the soft shadow of
// what lifted off it.
function bk5Hole(g, w, h, [x0, y0, x1, y1], paper = null) {
  const X0 = Math.floor(x0 * w);
  const Y0 = Math.floor(y0 * h);
  const X1 = Math.ceil(x1 * w);
  const Y1 = Math.ceil(y1 * h);
  const bw = X1 - X0;
  const bh = Y1 - Y0;
  if (!paper) {
    // The paper's color just outside the box (the lightest of a few spots).
    const spots = [];
    for (const [x, y] of [
      [X0 - 3, (Y0 + Y1) / 2],
      [X1 + 2, (Y0 + Y1) / 2],
      [(X0 + X1) / 2, Y0 - 3],
      [(X0 + X1) / 2, Y1 + 2],
    ]) {
      // prettier-ignore
      const xx = Math.max(0, Math.min(w - 1, Math.round(x)));
      const yy = Math.max(0, Math.min(h - 1, Math.round(y)));
      spots.push(g.getImageData(xx, yy, 1, 1).data);
    }
    spots.sort((a, b) => b[0] + b[1] + b[2] - (a[0] + a[1] + a[2]));
    paper = `rgb(${spots[0][0]},${spots[0][1]},${spots[0][2]})`;
  }
  g.fillStyle = paper;
  g.fillRect(X0, Y0, bw, bh);
  // The shadow: a blurred dark card, a little in from the edges and lower,
  // drawn far off the canvas so only its shadow lands here.
  g.save();
  g.beginPath();
  g.rect(X0, Y0, bw, bh);
  g.clip();
  const far = 4 * (w + h);
  g.shadowColor = "rgba(55, 45, 35, 0.42)";
  g.shadowBlur = Math.max(2, 0.12 * Math.min(bw, bh));
  g.shadowOffsetX = far;
  g.shadowOffsetY = 0.04 * bh;
  g.fillStyle = "#000";
  g.fillRect(X0 + 0.1 * bw - far, Y0 + 0.1 * bh, 0.8 * bw, 0.8 * bh);
  g.restore();
}

// Pulling a page (recipe.drag). A press on a page claims the drag; once it
// moves the way the page turns, the page follows the finger: the point
// grabbed stays under it as the page swings about the spine, the paper
// curling from it. Let go past halfway, or with a flick, and the page
// finishes its turn; otherwise it falls back. A press that doesn't move is
// a tap (the tap then turns the page by itself).
// Lane Pages r6: Pop out, set from the top bar (src/app.js, showPopOut).
const POP_CONTROL = { key: "pop", label: "Pop out", type: "toggle", ease: 0.12, global: "pop" };
// P1: a risen figure splits into flat cutout layers, like a paper pop-up book.
const LAYERS_CONTROL = { key: "layers", label: "Pop-up layers", type: "toggle", ease: 0.1 };
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
      // Lane Pages r6: figures standing up lie back first; the page follows
      // the finger once they are down.
      if (!a && PG.pops.length) {
        pgLayAll(time);
        return;
      }
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
  alive: () => !!BOOK.anim || BOOK.queue.length > 0 || BOOK.landed > 0 || !!BOOK.press || PG.busy || !!BK5.drawing, // prettier-ignore
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
    READING,
  ],
  controls: [
    { key: "turn", label: "Turn the page", type: "pulse", ease: 1.2 },
    // Lane Books r5: a figure rises off the page (and lies back); a drag on
    // a page draws a box round anything else to raise. Lane Pages r6: Pop
    // out is the top bar's switch, one for every page toy.
    POP_CONTROL,
    { key: "box", label: "Draw a box", type: "toggle", ease: 0.1 },
    LAYERS_CONTROL,
  ],
  // Sound C: each style's own page sound (PAGE_SOUNDS), played by drive.
  action: { key: "turn", label: "Turn the page", at: bookTapAt, quiet: ["turn"] },
  sounds: (o) => [PAGE_SOUNDS[o.style] || PAGE_SOUNDS.hardcover],
  focus: bookFocus,
  drag: bk5Drag(bookDrag(BOOK_PULL)),
  pictures: {
    // The Tinkerer's Manual (lane Manual), 25 Letter pages.
    sample: () => "manual/tinkerers-manual.pdf",
    accept: ["pdf"],
    decorate: bookDecorate, // lane Books r5: links, and the place a figure left
  },
  input: {
    title: "Your own book",
    media: { accept: ["pdf"] },
    note: "Open a PDF of any length, or paste a web address to one, and page through it with a tap or the buttons. Your file stays on this device; nothing is uploaded.",
  },
  drive(t, c, out, info) {
    const st = BOOK.style;
    if (!st) return;
    PG.host = "book"; // lane Pages r6
    const D = BOOK.dims;
    const pics = info.data?.pictures;
    const N = bookCount(pics);
    const time = info.time ?? t;
    const n = info.tap?.n ?? 0;
    if (n < BOOK.tapN) BOOK.tapN = 0;
    // Every tap since the last frame, in order (lane Pages r6: two figures
    // tapped quickly both rise).
    for (const tp of pgTaps(info)) {
      if (tp.n <= BOOK.tapN) continue;
      BOOK.tapN = tp.n;
      if (bk5Pick(tp.pick, pics, N)) continue; // lane Books r5
      if (N && BOOK.queue.length < 3) BOOK.queue.push(tp.pick === 1 ? -1 : 1);
      // Sound C: the page's own sound for this style (the album has its own tap sound).
      const page = PAGE_SOUNDS[Object.keys(BOOK_STYLES).find((id) => BOOK_STYLES[id] === st)];
      if (page) out.cues.push(page);
    }
    BOOK.N = N;
    if (BOOK.resume && pics && N) {
      const K2 = Math.min(lastSpread(st, N), pageSpread(st, Math.min(N - 1, BOOK.resume)));
      Object.assign(BOOK, { resume: 0, K: K2, lastPage: spreadPage(st, K2, N), landed: 3 });
      if (pics.page !== BOOK.lastPage) pics.go(BOOK.lastPage);
    }
    const a = BOOK.anim;
    if (a?.go !== undefined) {
      // A pull just began: show the pages it turns to.
      BOOK.lastPage = a.go;
      if (pics && pics.page !== a.go) pics.go(a.go);
      delete a.go;
    }
    if (a?.pull) {
      // Lane Pages r6: a page pulled over plays its page sound once, as it
      // goes over (past halfway, or let go to finish); one that falls back
      // settles softly.
      const P = a.pull;
      P.max = Math.max(P.max || 0, P.v);
      if (!P.sounded && (P.v > 0.5 || P.release?.to)) {
        P.sounded = true;
        if (BOOK.pageSound) out.cues.push(BOOK.pageSound);
      }
      // A pull ends once the page has finished its turn, or fallen back.
      const R = a.pull.release;
      if (R && !R.to && !P.settled && P.max > 0.12 && time - R.t0 >= R.dur * 0.85) {
        P.settled = true;
        out.cues.push(PAGE_SETTLE);
      }
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
      // A turn starts once the pages it shows are built (at most a fifth of
      // a second on, as a pulled page starts at once: lane Fix7; it was a
      // second and a half, which a tap felt as lag).
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
      if (!pics || time - a.asked > 0.2 || want.every((id) => pics.ready(id))) a.t0 = time;
    }
    if (a && !a.pull && a.t0 !== null && time - a.t0 >= a.dur) {
      BOOK.K = a.to;
      BOOK.anim = null;
      BOOK.landed = 3; // sorted again where everything came to rest
    }
    // Lane Pages r6: a turn asked for while figures stand up waits until
    // they have all laid back (quickly).
    const turnAsked = !BOOK.anim && ((pics && pics.page !== BOOK.lastPage) || BOOK.queue.length > 0); // prettier-ignore
    if (turnAsked && PG.pops.length) pgLayAll(time);
    if (N && !BOOK.anim && !PG.pops.length) {
      if (pics && pics.page !== BOOK.lastPage) {
        // The Toy tab's Previous and Next step one spread; any other page
        // (a link, a jump) opens the spread that shows it.
        const d = pics.page - BOOK.lastPage;
        const K2 = d === 1 ? BOOK.K + 1 : d === -1 ? BOOK.K - 1 : pageSpread(st, pics.page);
        BOOK.lastPage = pics.page;
        bookGo(K2, time, pics, N);
      } else if (BOOK.queue.length > 0 && !bookStep(st)) {
        if (BOOK.queue.shift() > 0)
          bookGo(BOOK.K < lastSpread(st, N) ? BOOK.K + 1 : 0, time, pics, N);
        else if (BOOK.K > 0) bookGo(BOOK.K - 1, time, pics, N);
      }
    }
    bookView(st, out);
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
    bk5Drive(c, out, pics, N, time, info, !!BOOK.anim); // lane Books r5: links and the pop-out
  },
  build(k, o) {
    const st = BOOK_STYLES[o.style] || BOOK_STYLES.hardcover;
    const H = PAGE_H;
    // The page follows the PDF's own shape (k.media, once it is open).
    const aspect = k.media?.kind === "pdf" ? k.media.aspect : SAMPLE_ASPECT;
    const W = H * Math.max(0.4, Math.min(2.2, aspect || SAMPLE_ASPECT));
    const cover = o.color || "#2f4b6e";
    const paper = "#fcfbf7";
    bookResume(k);
    BOOK.pageSound = PAGE_SOUNDS[o.style] || PAGE_SOUNDS.hardcover; // lane Pages r6: on a pull
    Object.assign(BOOK, { K: 0, anim: null, queue: [], tapN: 0, lastPage: 0, style: st, frame: 0, landed: 3, sides: null, sideOf: null, sheetsOf: null, press: null, focus: null, viewK: -1, one: o.reading === "one" }); // prettier-ignore
    if (st.bound === "top") buildStapled(k, st, W, H);
    else buildSideBound(k, st, o, { W, H, cover, paper });
    PG.host = "book"; // lane Pages r6
    bk5Build(k, 0.03);
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
      front: { share: extra.coverShare ?? 0.1, color: cloth([0, 0, 1]) },
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
function albumDecorate(canvas, { name, options, variant }) {
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
  // Lane Books r5: the photo lifted out (variant "hole"): its shadow on the
  // page, between the empty corners.
  if (variant === "hole")
    bk5Hole(g, w, h, [x0 / w, y0 / h, (x0 + pw) / w, (y0 + ph) / h], g.fillStyle); // prettier-ignore
  else g.drawImage(copy, 0, 0, w, h, x0, y0, pw, ph);
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

// A cell pattern (Worley noise): the distances to the nearest and the next
// nearest of a jittered grid of points, and the offset from the nearest.
function bkCells(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let d1 = 9;
  let d2 = 9;
  let dx = 0;
  let dy = 0;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const cx = xi + i + 0.15 + 0.7 * bkHash(xi + i, yi + j);
      const cy = yi + j + 0.15 + 0.7 * bkHash(xi + i + 17.3, yi + j + 5.1);
      const d = Math.hypot(x - cx, y - cy);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        dx = x - cx;
        dy = y - cy;
      } else if (d < d2) d2 = d;
    }
  return { d1, d2, dx, dy };
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
      // Pebbled grain: a cell pattern of rounded pebbles (each a few splats
      // across), each lit from the upper left like a little dome, with
      // crisp, darker creases between them (soft value noise read as a
      // blur), a broad mottle, and on the front a soft sheen and darker,
      // worn edges.
      const { d1, d2, dx, dy } = bkCells(p[0] * 27 + 0.4 * p[1], p[1] * 27 - 0.4 * p[0]);
      const crease = 1 - smoothstep(0.04, 0.16, d2 - d1);
      const dome = clamp((-0.7 * dx + 0.7 * dy) / 0.6, -1, 1);
      const mottle = bkNoise(4 * (0.8 * p[0] + 0.6 * p[1]) + 7, 4 * (0.8 * p[1] - 0.6 * p[0]) + 3);
      let f = 0.95 + 0.07 * dome - 0.18 * crease + 0.12 * (mottle - 0.5);
      if (face) {
        const cx = bx[0] + 0.3 * (bx[1] - bx[0]);
        const cy = by[1] - 0.3 * (by[1] - by[0]);
        f += 0.2 * Math.exp(-((p[0] - cx) ** 2 + (p[1] - cy) ** 2) / 0.12);
        const d = Math.min(p[0] - bx[0], bx[1] - p[0], p[1] - by[0], by[1] - p[1]);
        f -= 0.14 * Math.max(0, 1 - d / 0.03);
      }
      col = shade(col, f);
    } else if (style === "linen") {
      // Book linen: a plain weave of threads about three splats wide, each
      // crossing over and under in turn (a checker of across and down), with
      // crisp, narrow gaps between threads (soft ones read as a blur), and
      // each thread a little thicker or thinner along its length (slubs).
      const q = 20;
      const fx = p[0] * q;
      const fy = p[1] * q;
      const ux = fx - Math.floor(fx);
      const uy = fy - Math.floor(fy);
      const gapX = smoothstep(0.36, 0.5, Math.abs(ux - 0.5));
      const gapY = smoothstep(0.36, 0.5, Math.abs(uy - 0.5));
      const over = (Math.floor(fx) + Math.floor(fy)) % 2 === 0;
      // The thread on top is lit along its length; the gap beside it is darker.
      const lit = 0.04 * (0.5 - Math.abs((over ? uy : ux) - 0.5));
      const slub = bkNoise(p[0] * 2.5, fy * 1.5) + bkNoise(fx * 1.5 + 5, p[1] * 2.5) - 1;
      const mottle = bkNoise(p[0] * 3 + 2, p[1] * 3 + 8) - 0.5;
      col = shade(col, 0.99 + lit - 0.07 * Math.max(gapX, gapY) + 0.03 * slub + 0.04 * mottle);
    } else {
      // Kraft card: soft, broad fiber mottling and a few longer fibers,
      // none finer than a few splats.
      const mottle = bkNoise(p[0] * 7 + 3, p[1] * 7 + 1) - 0.5;
      const fiber = bkNoise(p[0] * 26 + 9, p[1] * 5 + 4) - 0.5;
      const fleck = Math.max(0, bkNoise(p[0] * 31 + 7, p[1] * 31 + 2) - 0.82);
      col = shade(col, 0.98 + 0.07 * mottle + 0.05 * fiber - 0.35 * fleck);
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
    READING,
  ],
  controls: [
    { key: "turn", label: "Turn the page", type: "pulse", ease: 1.2 },
    POP_CONTROL, // lane Books r5: a photo rises (lane Pages r6: the top bar's switch)
    LAYERS_CONTROL,
  ],
  action: { key: "turn", label: "Turn the page", at: bookTapAt },
  focus: bookFocus,
  // Heavier pages: they follow the finger with more lag and fall back more
  // readily.
  drag: bk5Drag(bookDrag(ALBUM_PULL)),
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
    bookResume(k);
    Object.assign(BOOK, { K: 0, anim: null, queue: [], tapN: 0, lastPage: 0, style: st, frame: 0, landed: 3, sides, sideOf, press: null, focus: null, viewK: -1, one: o.reading === "one" }); // prettier-ignore
    Object.assign(BOOK, { kinds, captions: !!o.captions }); // lane Books r5 (where each photo lies)
    BOOK.pageSound = TOY_SOUNDS["photo-album"]; // lane Pages r6: its tap sound, on a pull
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
      // A denser front cover (lane Sharpness B), so its grain is fine and
      // crisp rather than blurred.
      coverShare: 0.16,
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
    PG.host = "book"; // lane Pages r6
    bk5Build(k, 0.03);
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

const FRAME = { tapN: 0, t0: -99, digital: false, shown: -1, fade: 0, next: -1, since: 0, asked: 0, focus: false, size: [1, 1] }; // prettier-ignore
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
  focus: (p) => focusToggle(FRAME, p),
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
    // Page focus: a double-tap fills the screen with the photo.
    out.view = FRAME.focus ? { key: "photo", center: [0, 0, 0], size: FRAME.size } : { key: "all" };
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
    Object.assign(FRAME, { tapN: 0, t0: -99, digital: style === "digital", random: o.order === "random", next: -1, since: 0, video: null, focus: false }); // prettier-ignore
    // The opening follows the photo's shape (a digital frame is 4:3).
    const aspect = style === "digital" ? 4 / 3 : Math.max(0.5, Math.min(2, k.media?.aspect || 900 / 675)); // prettier-ignore
    const H = 1;
    const W = H * aspect;
    FRAME.size = [W, H];
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

// Lane Pages r6: the Picture lab's tap: a figure (raise it, or lay a risen
// one back) first, else the page on.
function labTapAt(p) {
  PG.host = "lab";
  return bk5Tap(p) || { key: "next", pick: p[0] < 0 ? 1 : 0 };
}
// The lab's page drawn before it becomes splats: the places figures left.
function labDecorate(canvas, { variant }) {
  if (!variant?.startsWith("hole:")) return;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  // (A whole picture lifted leaves the gray of its card.)
  for (const b of variant.slice(5).split(";")) {
    const box = b.split(",").map(Number);
    const whole = box[0] < 0.01 && box[1] < 0.01 && box[2] > 0.99 && box[3] > 0.99;
    bk5Hole(g, canvas.width, canvas.height, box, whole ? "#dde0e5" : null);
  }
}

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
    controls: [
      { key: "next", label: "Next page", type: "pulse", ease: 0.35 },
      // Lane Pages r6: Pop out (the top bar's switch) and Draw a box, as in
      // Your book, for a PDF or a picture.
      POP_CONTROL,
      { key: "box", label: "Draw a box", type: "toggle", ease: 0.1 },
      LAYERS_CONTROL,
    ],
    // A tap on the left of the page goes back, on the right (or the middle)
    // forward; the pages slide, they don't flip. (Lane Pages r6: a tap on a
    // figure raises it, on a risen one lays it back.)
    action: { key: "next", label: "Next page, or play and pause", at: (p) => labTapAt(p) }, // prettier-ignore
    focus: (p) => focusToggle(LAB, p),
    alive: () => PG.busy || !!BK5.drawing || LAB.pend !== 0, // lane Pages r6
    drag: bk5Drag({ plane: "view", at: () => false, start() {}, move() {}, end() {} }), // lane Pages r6: Draw a box
    // What the toy opens before you open something of your own, and what
    // it accepts.
    pictures: {
      sample: (o) =>
        o.sample === "photo" ? "assets/toys/picture-lab/photo.jpg" : "assets/toys/picture-lab/article.pdf", // prettier-ignore
      accept: ["pdf", "image", "gif", "video"],
      decorate: labDecorate, // lane Pages r6: the place a figure left
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
      const time = info.time ?? t;
      PG.host = "lab"; // lane Pages r6
      LAB.sides = pics && (pics.kind === "pdf" || pics.kind === "image") ? [pics.page] : [];
      // A tap turns to the next page (back to the first after the last), or
      // plays and pauses a video. (Lane Pages r6: a figure's tap first; a
      // page turn waits until risen figures have laid back.)
      const n = info.tap?.n ?? 0;
      if (n < LAB.tapN) LAB.tapN = 0;
      for (const tp of pgTaps(info)) {
        if (tp.n <= LAB.tapN) continue;
        LAB.tapN = tp.n;
        if (bk5Pick(tp.pick, pics, pics?.count || 0)) continue;
        const d = tp.pick === 1 ? -1 : 1;
        if (pics?.kind === "video") pics.togglePlay();
        else if (pics?.count > 1) LAB.pend = d;
      }
      if (LAB.pend && PG.pops.length) pgLayAll(time);
      else if (LAB.pend) {
        if (pics?.count > 1) pics.go((pics.page + LAB.pend + pics.count) % pics.count);
        LAB.pend = 0;
      }
      out.sheets = { page: { page: pics?.page ?? 0 } };
      // Page focus: a double-tap fills the screen with the page.
      out.view = LAB.focus
        ? { key: "page", center: [0, 0, 0], size: [2.08, 2.08] }
        : { key: "all" };
      bk5Drive(c, out, pics, pics?.count || 0, time, info); // lane Pages r6: the pop-out
    },
    build(k) {
      LAB.tapN = 0;
      LAB.focus = false;
      LAB.pend = 0;
      k.sheet({ id: "page", center: [0, 0, 0], width: 2, height: 2, normal: [0, 0, 1] });
      // A thin gray card behind it, so a white page has an edge on a white
      // background (and the picture a back), with clean, sharp edges (rect).
      const W = 2.08;
      rect(k, { share: 1, at: [-W / 2, -W / 2, -0.03], u: [W, 0, 0], v: [0, W, 0], n: [0, 0, 1], color: () => "#c3c7ce" }); // prettier-ignore
      PG.host = "lab";
      bk5Build(k, 0.04, LAB_DIMS); // lane Pages r6: the pop sheets and a drawn box's corners
    },
  },
  "your-book": BOOK_RECIPE,
  "photo-album": ALBUM_RECIPE,
  "picture-frame": FRAME_RECIPE,
};

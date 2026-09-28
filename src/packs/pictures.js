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

const BOOK = { K: 0, anim: null, queue: 0, tapN: 0, lastPage: 0, style: null, dims: null, frame: 0, landed: 0 }; // prettier-ignore

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

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

// A flat rectangle of splats: two staggered lattices of flat discs (smooth,
// no speckle, like a sheet's paper). `at` is a corner, `u` and `v` its edges
// (recipe units), `n` the side it faces; `color(a, b)` gets the place along
// u and v (0..1). `leaf` = { slot, S, at, dir } makes every splat turn with
// that leaf (its distance from the spine in toy units: S is the fit's scale).
function rect(k, { share, at, u, v, n, color, part = 0, leaf = null, opacity = 0.99, size = 1 }) {
  const lu = Math.hypot(...u);
  const lv = Math.hypot(...v);
  k.cloud({ share, pattern: false, flat: 0.06 }, (rand, i, total) => {
    const half = Math.max(2, Math.floor(total / 2));
    const gu = Math.max(1, Math.round(Math.sqrt((half * lu) / lv)));
    const gv = Math.max(1, Math.floor(half / gu));
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
    if (leaf) {
      s.kind = "leaf";
      const d = (p[0] - leaf.at[0]) * leaf.dir[0] + (p[1] - leaf.at[1]) * leaf.dir[1] + (p[2] - leaf.at[2]) * leaf.dir[2]; // prettier-ignore
      s.params = [d * leaf.S, leaf.slot];
    }
    return s;
  });
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
function bookCount(pics) {
  if (!pics) return 7; // no pictures (the Node tests): a short made-up book
  return pics.count || 0;
}
function lastSpread(st, N) {
  return st.bound === "top" ? Math.max(0, N - 1) : Math.floor((N + 1) / 2);
}
function spreadPage(st, K, N) {
  if (st.bound === "top") return K;
  return K <= 0 ? 0 : Math.min(2 * K - 1, N - 1);
}
function pageSpread(st, p) {
  if (st.bound === "top") return Math.max(0, p);
  return p <= 0 ? 0 : p % 2 ? (p + 1) / 2 : p / 2 + 1;
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
  // A turn waiting for its pages (t0 null) holds at its start.
  const u = uAt ?? (a ? (a.t0 === null ? 0 : clamp01((time - a.t0) / a.dur)) : 1);
  const v = easeIO(u);
  const bend = Math.sin(Math.PI * u);
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
    const OVER = 2 * Math.PI - 0.06; // turned over the top, hanging behind
    if (!a) {
      sheet(K + 1, { fv: 0, ahead: 1 });
      sheet(K - 1, { angle: OVER, fv: 0, ahead: 1 });
      sheet(K, { fv: 1 });
    } else if (a.type === "fwd") {
      sheet(K + 1, { fv: u > 0.06 ? 1 : 0, ahead: 1 });
      sheet(K, { angle: OVER * v, curl: -st.curl * bend, fv: u < 1 ? 1 : 0 });
    } else if (a.type === "back") {
      sheet(K, { fv: u < 0.97 ? 1 : 0 });
      sheet(K - 1, { angle: OVER * (1 - v), curl: st.curl * bend, fv: 1 });
    } else {
      sheet(K, { fv: u < 0.97 ? 1 : 0 });
      sheet(0, { angle: OVER * (1 - v), curl: st.curl * bend, fv: 1 });
    }
    return L;
  }
  // Side-bound. The pages a turn will need are built ahead (parked).
  const right = Math.max(K, 1);
  if (!a) {
    leaf(right + 1, { ahead: 1 });
    if (K >= 3) leaf(K - 2, { angle: Math.PI, ahead: 1 });
    if (K >= 2) leaf(K - 1, { angle: Math.PI, bv: 1 });
    leaf(right, { fv: 1, bv: 1 });
    L.cover = K >= 1 ? Math.PI : 0;
    L.open = K >= 1 ? 1 : 0;
    L.block = L.cover;
    L.blockOn = K >= 2 ? 1 : 0;
    return L;
  }
  if (a.type === "open" || a.type === "shut") {
    const w = a.type === "open" ? v : 1 - v;
    leaf(2, { ahead: 1 });
    leaf(1, { fv: 1, bv: 1 });
    L.cover = Math.PI * w;
    L.coverCurl = (a.type === "open" ? -1 : 1) * st.coverCurl * bend;
    L.open = w;
  } else if (a.type === "fwd") {
    if (K >= 3) leaf(K - 2, { angle: Math.PI, ahead: 1 });
    if (K >= 2) leaf(K - 1, { angle: Math.PI, bv: u < 0.97 ? 1 : 0 });
    leaf(K + 1, { fv: u > 0.28 ? 1 : 0, ahead: 1 });
    leaf(K, { angle: Math.PI * v, curl: -st.curl * bend, fv: 1, bv: 1 });
    L.cover = Math.PI;
    L.open = 1;
  } else if (a.type === "back") {
    leaf(K + 1, { ahead: 1 });
    leaf(K, { fv: u < 0.97 ? 1 : 0, ahead: 1 });
    if (K >= 3) leaf(K - 2, { angle: Math.PI, bv: u > 0.28 ? 1 : 0, ahead: 1 });
    leaf(K - 1, { angle: Math.PI * (1 - v), curl: st.curl * bend, fv: 1, bv: 1 });
    L.cover = Math.PI;
    L.open = 1;
  } else {
    // "close": the whole left half (the cover, its page block and the page
    // on top) swings back over the right.
    const ang = Math.PI * (1 - v);
    leaf(K, { fv: u < 0.97 ? 1 : 0 });
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
  if (a.type === "fwd") L.blockOn = K >= 2 || u > 0.97 ? 1 : 0;
  else if (a.type === "back") L.blockOn = K >= 3 || u < 0.03 ? 1 : 0;
  else if (a.type === "close") L.blockOn = 1;
  return L;
}

const BOOK_RECIPE = {
  // A book you page through: it keeps still, facing you.
  turntable: false,
  density: 0.35,
  // Frames keep coming while a page turns (a turn can start from the Toy
  // tab's page buttons, not only from a tap).
  alive: () => !!BOOK.anim || BOOK.queue > 0 || BOOK.landed > 0,
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
  action: { key: "turn", label: "Turn the page" },
  pictures: {
    sample: () => "assets/toys/picture-lab/article.pdf",
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
      if (N) BOOK.queue = Math.min(3, BOOK.queue + 1);
    }
    const a = BOOK.anim;
    if (a && a.t0 === null) {
      // A turn starts once the pages it shows are built (at most a second
      // and a half on: a page that fails to build should not stop the book).
      const mid = bookLayout(st, N, time, 0.5);
      const want = [];
      mid.slots.forEach((s, i) => {
        if (s.fv && s.f >= 0 && s.f < N) want.push(`f${i}`);
        if (s.bv && s.b >= 0 && s.b < N) want.push(`b${i}`);
      });
      if (!pics || time - a.asked > 1.5 || want.every((id) => pics.ready(id))) a.t0 = time;
    }
    if (a && a.t0 !== null && time - a.t0 >= a.dur) {
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
      } else if (BOOK.queue > 0) {
        BOOK.queue--;
        bookGo(BOOK.K < lastSpread(st, N) ? BOOK.K + 1 : 0, time, pics, N);
      }
    }
    const L = bookLayout(st, N, time);
    out.sheets = { cover: { page: 0, visible: N ? 1 : 0 } };
    out.leaves = [];
    L.slots.forEach((s, i) => {
      out.leaves[i] = { angle: s.angle, curl: s.curl };
      out.sheets[`f${i}`] = { page: s.f, visible: s.fv, ahead: s.ahead };
      if (st.bound === "side") out.sheets[`b${i}`] = { page: s.b, visible: s.bv, ahead: s.ahead };
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
    Object.assign(BOOK, { K: 0, anim: null, queue: 0, tapN: 0, lastPage: 0, style: st, frame: 0, landed: 3 }); // prettier-ignore
    if (st.bound === "top") return buildStapled(k, st, W, H);
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
    const edge = (a, b, p) => shade("#ece5d3", 0.97 + 0.03 * Math.sin(p[2] * 900));
    const top = TOP;
    // The left block's top lands under the left-hand pages (and under a
    // card cover, which lies on it); it turns about zb to get there.
    const leftTop = st.cover === "board" ? TOP : -(C0 + cb) - 0.012;
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
    if (st.cover === "board") {
      // Head and tail bands: striped rolls at the spine end of each block.
      const band = (a) => (Math.floor(a * 9) % 2 ? "#b8323a" : "#f0e2c4");
      for (const part of [0, lblock])
        for (const y of [H / 2 + 0.001, -H / 2 - 0.001])
          rect(k, { share: 0.003, at: [0.001, y, -T], u: [0, 0, T + top], v: [0.012, 0, 0], n: [0, Math.sign(y), 0], color: (a) => band(a), part }); // prettier-ignore
    }
    // The back cover.
    const cloth = (n) => (a, b, p) =>
      bkLit(shade(cover, 0.985 + 0.02 * Math.sin(p[0] * 700) * Math.sin(p[1] * 700)), n);
    const inside = st.cover === "board" ? mix(cover, "#f1e6cf", 0.75) : "#f2efe8";
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
    const coverZ = [C0, C0 + cb];
    if (st.cover === "board") {
      const zp = (C0 - T) / 2;
      const cp = k.part("cover", { pivot: [0, 0, zp], axis: [0, -1, 0] });
      boxFaces(k, bx, by, coverZ, {
        front: { share: 0.1, color: cloth([0, 0, 1]) },
        back: { share: 0.05, color: () => bkLit(inside, [0, 0, 1]) },
        right: { share: 0.006, color: cloth([1, 0, 0]) },
        top: { share: 0.006, color: cloth([0, 1, 0]) },
        bottom: { share: 0.006, color: cloth([0, -1, 0]) },
      }, { part: cp }); // prettier-ignore
      k.sheet({ id: "cover", center: [(W + ov) / 2 + 0.015, 0.04, C0 + cb], width: W * 0.72, height: H * 0.66, part: cp, lift: 0.02 }); // prettier-ignore
    } else {
      const leaf = leafOf(8);
      boxFaces(k, [g, X1], [-H / 2, H / 2], coverZ, {
        // (Its front is the page itself, the cover sheet.)
        back: { share: 0.08, color: () => bkLit(inside, [0, 0, 1]) },
        right: { share: 0.004, color: () => bkLit(cover, [1, 0, 0]) },
        top: { share: 0.004, color: () => bkLit(cover, [0, 1, 0]) },
        bottom: { share: 0.004, color: () => bkLit(cover, [0, -1, 0]) },
      }, { leaf }); // prettier-ignore
      k.sheet({ id: "cover", center: [g + W / 2, 0, C0 + cb], width: W, height: H, lift: 0.01, align: [-1, 0], leaf: 8 }); // prettier-ignore
    }
    // The leaves' sheets (after the cover's, which the engine builds first).
    for (let s = 0; s < 4; s++) {
      k.sheet({ id: `f${s}`, center: [g + W / 2, 0, 0], width: W, height: H, lift: E, align: [-1, 0], leaf: s }); // prettier-ignore
      k.sheet({ id: `b${s}`, center: [g + W / 2, 0, 0], width: W, height: H, normal: [0, 0, -1], lift: E, align: [1, 0], leaf: s }); // prettier-ignore
    }
    // The spine (not the spiral's): a strip down the closed book's left
    // side that turns to lie under the gutter as the book opens.
    if (g === 0) {
      const sw = st.cover === "board" ? 0.014 : 0.004;
      const z0 = -T - cb;
      const z1 = C0 + cb;
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
            p: [-sw - 0.001, y - 0.03 + (0.06 * i) / n, (z0 + z1) / 2],
            color: mix("#8e959e", "#e7ebf0", 0.5 + 0.5 * Math.sin(i)),
            size: 0.25,
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
        return {
          p: [rc * nx, y, -T / 2 + rc * nz],
          color: mix("#3d4148", "#d9dde3", shine),
          size: 0.35,
          opacity: 1,
        };
      });
    }
  },
};

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
  const edge = (a, b, p) => shade("#ece5d3", 0.97 + 0.03 * Math.sin(p[2] * 900));
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
    const f = i / n - 0.5;
    return {
      p: [c[0] + f * 0.055 * Math.SQRT1_2, c[1] + f * 0.055 * Math.SQRT1_2, 0.03],
      color: mix("#8e959e", "#eef1f5", 0.5 + 0.5 * Math.cos(f * 9)),
      size: 0.3,
      opacity: 1,
    };
  });
}

export const RECIPES = {
  "picture-lab": {
    // A flat sheet that shows whatever you open, and nothing else. It keeps
    // still (no turntable), facing you.
    turntable: false,
    // Few splats of its own (the card); the picture's are the sheet's.
    density: 0.12,
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
    action: { key: "next", label: "Next page, or play and pause" },
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
        if (pics?.kind === "video") pics.togglePlay();
        else if (pics?.count > 1) pics.go(pics.page + 1 < pics.count ? pics.page + 1 : 0);
      }
      out.sheets = { page: { page: pics?.page ?? 0 } };
    },
    build(k) {
      LAB.tapN = 0;
      k.sheet({ id: "page", center: [0, 0, 0], width: 2, height: 2, normal: [0, 0, 1] });
      // A thin gray card behind it, so a white page has an edge on a white
      // background (and the picture a back): two staggered lattices of flat
      // discs, like a sheet's paper, so it is smooth with no speckle.
      const W = 2.08;
      k.cloud({ share: 1, pattern: false }, (rand, i, n) => {
        const g = Math.max(8, Math.floor(Math.sqrt(n / 2)));
        const step = W / g;
        const second = i >= g * g;
        const j = second ? i - g * g : i;
        if (j >= g * g || (second && (j % g === g - 1 || j >= g * (g - 1)))) return null;
        const off = second ? step : step / 2;
        return {
          p: [-W / 2 + off + (j % g) * step, -W / 2 + off + Math.floor(j / g) * step, -0.03],
          n: [0, 0, 1],
          flat: 0.05,
          size: (0.5 * step) / 0.01,
          color: "#c3c7ce",
          opacity: 0.99,
        };
      });
    },
  },
  "your-book": BOOK_RECIPE,
};

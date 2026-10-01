// The song landscape's measured looks (lane Live input r2): Ribbons, Tube,
// Lines and Mesh, and the landscape itself for a long song. Every shape is a
// measured feature of the sound at its moment (song-analysis.js), and the
// picture follows the audio clock (song-stream.js Track.time()), never a
// count of frames.
//
// Each look is built once, as relief splats (kind "relief", 3D mode) that
// each own a texel of the toy's screen canvas; on every step of the clock
// (a frame is 40 ms) draw() writes each splat's measured place and color
// there, and the GPU moves the splats. So a song plays as soon as it opens
// and its picture fills in as the frames are measured: a splat whose frames
// aren't measured yet stays hidden.
//
// Two views:
//   Whole  the whole song along the time axis (the frames pooled into
//          slots), and the "now" gate moves along it as the song plays
//   Live   the last few seconds: the gate stays put and each frame comes out
//          of it as it is heard, then recedes

import { mix, shade } from "../kit.js";
import { FIELDS, F, HOP } from "./song-analysis.js";
import { DB_FLOOR, F_MIN, F_MAX } from "./studio-audio.js";

export const LOOKS = ["ribbons", "tube", "lines", "mesh"];
const NFI = FIELDS.length;

// Bass to treble, from the owner's references (teal at the bottom).
export const SIX_COLORS = ["#1f8a8c", "#2f86c8", "#3d4fa8", "#7c4aa3", "#c4485e", "#e5843a"];
export const PAPER = "#f4f0e6";
const LOW_HIGH = ["#5b3fa0", "#a8479a", "#d9566b", "#ee8a3c"]; // low to high pitch
const BRIGHT = ["#1f8a8c", "#2f86c8", "#7c4aa3", "#c4485e", "#ee8a3c"]; // dull to bright

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ramp = (stops, t) => {
  const x = clamp01(t) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  return mix(stops[i], stops[i + 1], x - i);
};

// Sizes per look and view: slots (time steps) and the time axis's length.
const LIVE_SECONDS = 6;
const LEN = 3.4; // recipe units along time (Lines and Mesh: 0.8 of it in depth)
const LEN_X = 2.4; // Ribbons and Tube, along x (their bands and rings are tall)

// Live: the newest frame whose middle has been heard (slot 0 on the gate),
// so a frame's line crosses the gate as its middle is heard.
export const liveFrame = (now) => Math.floor(now / HOP - 0.5);

// ---- The data each slot shows ---------------------------------------------------------

// The frames a view's slot covers. Live: slot 0 is the frame heard now and
// slot s the one s frames ago. Whole: the song's frames shared out in order.
function slotFrames(view, S, n, nowFrame) {
  return (s) => {
    if (view === "live") {
      const f = nowFrame - s;
      return f >= 0 && f < n ? [f, f + 1] : null;
    }
    const a = Math.floor((s * n) / S);
    const b = Math.max(a + 1, Math.floor(((s + 1) * n) / S));
    return a < n ? [a, Math.min(n, b)] : null;
  };
}

// A slot's measured values, or null while its frames aren't all measured.
// Whole: loudness pools by the maximum (a beat inside a slot still shows),
// pitch and brightness by the mean. Live: a frame and its two neighbors,
// weighted 1, 2, 1 (smoothed, never invented).
function slotValues(feat, done, range, live, n) {
  if (!range) return null;
  const frames = [];
  if (live) {
    const c = range[0];
    for (const [f, w] of [[c - 1, 1], [c, 2], [c + 1, 1]]) if (f >= 0 && f < n && done[f]) frames.push([f, w]); // prettier-ignore
    if (!done[c]) return null;
  } else {
    for (let f = range[0]; f < range[1]; f++) {
      if (!done[f]) return null;
      frames.push([f, 1]);
    }
  }
  const out = { rms: DB_FLOOR, six: new Array(6).fill(DB_FLOOR), cen: 0, f0: 0, voiced: 0 };
  let wsum = 0;
  let acc = 0;
  const accSix = new Array(6).fill(0);
  for (const [f, w] of frames) {
    const o = f * NFI;
    if (live) {
      acc += w * feat[o + F.rms];
      for (let i = 0; i < 6; i++) accSix[i] += w * feat[o + F.six0 + i];
    } else {
      out.rms = Math.max(out.rms, feat[o + F.rms]);
      for (let i = 0; i < 6; i++) out.six[i] = Math.max(out.six[i], feat[o + F.six0 + i]);
    }
    out.cen += w * feat[o + F.centroid];
    if (feat[o + F.f0] > 0) {
      out.f0 += w * feat[o + F.f0];
      out.voiced += w;
    }
    wsum += w;
  }
  if (live) {
    out.rms = acc / wsum;
    for (let i = 0; i < 6; i++) out.six[i] = accSix[i] / wsum;
  }
  out.cen /= wsum;
  if (out.voiced) out.f0 /= out.voiced;
  return out;
}

// A dB value as 0..1 under a top (the loudest measured so far).
const level = (db, top, range = 42) => clamp01((db - (top - range)) / range);

// The pitch to show: F0 where the sound is voiced, else its brightness.
const pitchHz = (v) => (v.voiced ? v.f0 : v.cen) || 0;
// …as -1..1 over 80 Hz to 2 kHz (log).
const pitchUnit = (hz) => (hz > 0 ? Math.max(-1, Math.min(1, (Math.log2(hz / 400) / Math.log2(2000 / 80)) * 2)) : 0); // prettier-ignore
// Brightness as 0..1 over 200 Hz to 8 kHz (log).
const brightUnit = (hz) => (hz > 0 ? clamp01(Math.log2(hz / 200) / Math.log2(40)) : 0);

// ---- Building ---------------------------------------------------------------------------
// Every look's splats: { p (rest place), dir (a needle's direction), len,
// role } pushed into a list; then one relief cloud with a texel each.

function needle(list, p, dir, len, thick, role) {
  list.push({ p, dir, len, thick, role });
}

function emit(k, list, lift, part) {
  const n = list.length;
  const cols = Math.min(512, Math.max(16, Math.ceil(Math.sqrt(n * 2))));
  const rows = Math.max(1, Math.ceil(n / cols));
  const unit = 0.01; // a cloud-only recipe's base splat size
  // A splat shows out to about two sigmas each way, so a needle's sigmas
  // are a third of its thickness and 2.6th of its length (exact sizes:
  // no jitter), and its neighbors don't smear into it.
  k.cloud({ share: n / k.count, pattern: false, opacity: 1, jitter: 0 }, (rand, i) => {
    const s = list[i];
    if (!s) return null;
    const sz = s.thick / 3 / 0.7;
    return {
      p: s.p,
      dir: s.dir,
      stretch: Math.max(1, s.len / 2.6 / sz),
      size: sz / unit,
      color: "#888888",
      opacity: 1,
      kind: "relief",
      params: [((i % cols) + 0.5) / cols, (Math.floor(i / cols) + 0.5) / rows, 3, lift],
      part,
      pattern: false,
    };
  });
  return { cols, rows };
}

// A thin wireframe box (the "now" gate) of needles, on its own part.
function gateBox(k, part, c, sx, sy, sz, color) {
  const edges = [];
  for (const y of [-1, 1])
    for (const z of [-1, 1])
      edges.push([
        [-1, y, z],
        [1, y, z],
      ]);
  for (const x of [-1, 1])
    for (const z of [-1, 1])
      edges.push([
        [x, -1, z],
        [x, 1, z],
      ]);
  for (const x of [-1, 1])
    for (const y of [-1, 1])
      edges.push([
        [x, y, -1],
        [x, y, 1],
      ]);
  const items = [];
  for (const [a, b] of edges) {
    const A = [c[0] + a[0] * sx, c[1] + a[1] * sy, c[2] + a[2] * sz];
    const B = [c[0] + b[0] * sx, c[1] + b[1] * sy, c[2] + b[2] * sz];
    const L = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
    const m = Math.max(2, Math.round(L / 0.02));
    for (let i = 0; i < m; i++) {
      const t = (i + 0.5) / m;
      items.push({ p: [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t], dir: [B[0] - A[0], B[1] - A[1], B[2] - A[2]], stretch: 3, size: 0.6, color, opacity: 0.9, part, pattern: false }); // prettier-ignore
    }
  }
  k.cloud({ share: items.length / k.count, pattern: false }, (rand, i) => items[i] || null);
}

// A flat card of overlapping discs (the paper behind or under a look).
function card(k, { at, cols, rows, n, color }) {
  const items = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) items.push({ p: at((i + 0.5) / cols, (j + 0.5) / rows), n, flat: 0.03, size: 2.6 * (3.6 / cols) / 0.01 / 2.5, color, opacity: 1, pattern: false }); // prettier-ignore
  k.cloud({ share: items.length / k.count, pattern: false }, (rand, i) => items[i] || null);
}

// The slots a look has in a view, within a splat budget.
function slotsFor(view, perSlot, count) {
  if (view === "live") return Math.round(LIVE_SECONDS / HOP); // 150
  return Math.max(60, Math.min(420, Math.floor((count * 0.55) / perSlot)));
}

// Fine detail (round 2's second pass): every look draws its measured values
// as many short needles, and the ones between two measured slots (or two
// bands) take the values in between, so a curve bends smoothly instead of
// stepping. Nothing is invented: each in-between value lies on the straight
// line between two measured neighbors.
const SUB = 2; // needles per slot along time (Ribbons, Tube, Mesh's long lines)
const SUBF = 2; // needles per band across pitch (Lines, Mesh)

export function buildLook(k, look, { view, backdrop, nf }) {
  const live = view === "live";
  const list = [];
  const time = k.part("look");
  const gate = k.part("gate");
  let lift = 0.5;
  let S;
  let geo = {};
  if (look === "ribbons" || look === "tube") {
    // Time runs along x, out of the gate at the left.
    const J = 22; // strands per ribbon
    const P = 72; // points per ring
    S = slotsFor(view, (look === "ribbons" ? 6 * J : P) * SUB, k.count);
    if (look === "tube" && !live) S = Math.min(S, 180); // rings you can tell apart
    const dx = LEN_X / S;
    const x0 = -LEN_X / 2;
    // Live: slot s's line is where the frame heard s frames ago is (slot 0
    // on the gate); Whole: slot s is the s-th share of the song. Sub-step h
    // lies h / SUB of the way to the next slot.
    const xs = (s, h) => x0 + (s + h / SUB + (live ? 0 : 0.5)) * dx;
    if (look === "ribbons") {
      for (let b = 0; b < 6; b++)
        for (let j = 0; j < J; j++)
          for (let s = 0; s < S; s++)
            for (let h = 0; h < SUB; h++) needle(list, [xs(s, h), ribbonBase(b), 0], [1, 0, 0], (dx / SUB) * 1.6, 0.0032, [s, b, j, h]); // prettier-ignore
      lift = 0.5;
    } else {
      for (let s = 0; s < S; s++)
        for (let h = 0; h < SUB; h++)
          for (let p = 0; p < P; p++) {
            const th = (p / P) * Math.PI * 2;
            const r = 0.02;
            needle(list, [xs(s, h), r * Math.cos(th), r * Math.sin(th)], [0, -Math.sin(th), Math.cos(th)], ((2 * Math.PI * 0.4) / P) * 1.25, 0.003, [s, p, 0, h]); // prettier-ignore
          }
      lift = 0.42;
    }
    geo = { axis: "x", x0, dx, J, P };
    gateBox(k, gate, [x0, 0, 0], 0.035, 0.62, 0.32, "#8fb4c4");
    if (backdrop === "paper") card(k, { at: (u, v) => [(u - 0.5) * (LEN_X + 0.6), (0.5 - v) * 1.6, -0.55], cols: 100, rows: 54, n: [0, 0, 1], color: PAPER }); // prettier-ignore
    k.reach([-LEN_X / 2 - 0.1, 0.8, 0.5]);
    k.reach([LEN_X / 2 + 0.1, -0.8, -0.55]);
  } else {
    // Lines and Mesh: pitch across x, height for loudness, time in depth
    // (the newest line at the front, z = D / 2).
    const W = 2;
    const D = LEN * 0.8;
    const K = nf;
    S = slotsFor(view, (look === "mesh" ? K * 1.5 : K) * SUBF, k.count);
    // Live: one line per frame over the last 3 s (2.4 s for the mesh), few
    // enough to tell apart at phone size.
    if (look === "mesh") S = Math.min(S, live ? 60 : 100);
    else S = Math.min(S, live ? 75 : 120);
    const dz = D / S;
    const xk = (f) => ((f + 0.5) / K - 0.5) * W;
    const zs = (s, h = 0) => D / 2 - (s + h / SUB + (live ? 0 : 0.5)) * dz;
    // Across: SUBF needles per band, the last band's one alone.
    for (let s = 0; s < S; s++)
      for (let f = 0; f < K; f++)
        for (let q = 0; q < (f < K - 1 ? SUBF : 1); q++) needle(list, [xk(f + q / SUBF), 0, zs(s)], [1, 0, 0], (W / K / SUBF) * 1.6, 0.0034, [s, f, 0, q]); // prettier-ignore
    if (look === "mesh")
      for (let f = 1; f < K; f += 4)
        for (let s = 0; s < S; s++)
          for (let h = 0; h < SUB; h++) needle(list, [xk(f), 0, zs(s, h)], [0, 0, 1], (dz / SUB) * 1.6, 0.0034, [s, f, 1, h]); // prettier-ignore
    lift = 0.7;
    geo = { axis: "z", W, D, dz, K };
    // The gate: a line across the front.
    const g = [];
    for (let i = 0; i < 120; i++) g.push({ p: [((i + 0.5) / 120 - 0.5) * (W + 0.1), 0.005, D / 2], dir: [1, 0, 0], stretch: 3, size: 0.7, color: "#c08a3a", opacity: 1, part: gate, pattern: false }); // prettier-ignore
    k.cloud({ share: g.length / k.count, pattern: false }, (rand, i) => g[i] || null);
    if (backdrop === "paper") card(k, { at: (u, v) => [(u - 0.5) * (W + 0.5), -0.02, (v - 0.5) * (D + 0.5)], cols: 90, rows: 80, n: [0, 1, 0], color: PAPER }); // prettier-ignore
    k.reach([0, lift + 0.05, -D / 2 - 0.1]);
    k.reach([0, 0, D / 2 + 0.25]);
  }
  const atlas = emit(k, list, lift, time);
  return { look, view, live, S, lift, geo, atlas, roles: list.map((s) => s.role), rest: list.map((s) => s.p), n: list.length }; // prettier-ignore
}

const ribbonBase = (b) => -0.55 + b * 0.21;

// ---- Drawing ----------------------------------------------------------------------------
// Writes every splat's place and color for the moment `now` (seconds) into
// the canvas (2 * cols wide): colors on the left half, the offset from its
// rest place (red, green, blue each about a half: x, y, z) and whether it
// shows (alpha) on the right.

// Color tables (0..255 bytes, three per entry), built once.
const TABLE = 256;
function table(stops) {
  const t = new Uint8Array(TABLE * 3);
  for (let i = 0; i < TABLE; i++) {
    const c = rgb(ramp(stops, i / (TABLE - 1)));
    for (let j = 0; j < 3; j++) t[i * 3 + j] = Math.round(c[j] * 255);
  }
  return t;
}
let TABLES = null;
const tables = () =>
  (TABLES ??= {
    six: SIX_COLORS.map((c) => rgb(c).map((x) => x * 255)),
    bright: table(["#13706f", "#1f8a8c", "#2f86c8", "#4b5fb8", "#7c4aa3", "#b0427a", "#d9566b", "#ee8a3c", "#f6b45a"]), // prettier-ignore
    pitch: table(["#3f2c8c", "#5b3fa0", "#8a45a0", "#b84a8e", "#d9566b", "#e8714f", "#ee8a3c"]), // prettier-ignore
    paper: rgb(PAPER).map((x) => x * 255),
  });

export function drawLook(g, L, an, now, { backdrop }) {
  const { cols, rows } = L.atlas;
  if (!L.img || L.img.width !== cols * 2) L.img = g.createImageData(cols * 2, rows);
  const px = L.img.data;
  const T = tables();
  const fe = an?.features;
  const n = fe?.n || 0;
  const nowFrame = L.live ? liveFrame(now) : Math.floor(now / HOP);
  const range = slotFrames(L.view, L.S, n, nowFrame);
  // Tops: the loudest measured so far (kept on the look, from new frames only).
  if (fe && L.topsVersion !== an.version) {
    L.topsVersion = an.version;
    if (!L.seen || L.seen.length !== n) {
      L.seen = new Uint8Array(n);
      L.tops = { rms: -120, six: -120, band: -120 };
    }
    const t = L.tops;
    for (let f = 0; f < n; f++) {
      if (!fe.done[f] || L.seen[f]) continue;
      L.seen[f] = 1;
      const o = f * NFI;
      t.rms = Math.max(t.rms, fe.feat[o + F.rms]);
      for (let i = 0; i < 6; i++) t.six = Math.max(t.six, fe.feat[o + F.six0 + i]);
      for (let b = 0; b < fe.nf; b++) t.band = Math.max(t.band, fe.bands[f * fe.nf + b]);
    }
  }
  const tops = L.tops || { rms: 0, six: 0, band: 0 };
  // Each slot's values, once per drawing (and one slot past the end, for the
  // in-between needles of the last).
  const S = L.S;
  const vals = new Array(S + 1);
  for (let s = 0; s <= S; s++)
    vals[s] = fe ? slotValues(fe.feat, fe.done, range(s), L.live, n) : null;
  const paper = backdrop === "paper";
  const lift2 = 2 * L.lift;
  const col = [0, 0, 0];
  const put = (i, P, R, show) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const o = (r * cols * 2 + c) * 4;
    px[o] = col[0];
    px[o + 1] = col[1];
    px[o + 2] = col[2];
    px[o + 3] = 255;
    const q = (r * cols * 2 + cols + c) * 4;
    px[q] = Math.round(255 * clamp01((P[0] - R[0]) / lift2 + 0.5));
    px[q + 1] = Math.round(255 * clamp01((P[1] - R[1]) / lift2 + 0.5));
    px[q + 2] = Math.round(255 * clamp01((P[2] - R[2]) / lift2 + 0.5));
    px[q + 3] = show ? 255 : 0;
  };
  // Color from a table entry or an RGB triple, times a brightness, then the
  // Live fade with age (into the paper, or darker without it).
  const setCol = (src, at, k, age) => {
    const fadeTo = L.live && paper ? 0.55 * age ** 1.5 : 0;
    const dim = L.live && !paper ? 1 - 0.5 * age : 1;
    for (let j = 0; j < 3; j++) {
      const v = Math.min(255, src[at + j] * k * dim);
      col[j] = Math.round(v + (T.paper[j] - v) * fadeTo);
    }
  };
  const geo = L.geo;
  const P = [0, 0, 0];
  const lerp = (a, b, t) => a + (b - a) * t;
  // Lines and Mesh: each slot's band levels (0..1), worked out once.
  let lv = null;
  if (geo.axis === "z" && fe) {
    const K = geo.K;
    lv = new Float32Array((S + 1) * K).fill(-1);
    for (let s = 0; s <= S; s++) {
      const f0 = range(s);
      if (!vals[s] || !f0) continue;
      for (let b = 0; b < K; b++) {
        let db = DB_FLOOR;
        if (L.live) db = fe.bands[f0[0] * fe.nf + b];
        else for (let f = f0[0]; f < f0[1]; f++) db = Math.max(db, fe.bands[f * fe.nf + b]);
        lv[s * K + b] = level(db, tops.band, 45) ** 1.3;
      }
    }
  }
  for (let i = 0; i < L.n; i++) {
    const [s, a, b, h] = L.roles[i];
    const R = L.rest[i];
    const v = vals[s];
    if (!v) {
      col[0] = col[1] = col[2] = 128;
      put(i, R, R, false);
      continue;
    }
    const age = s / S;
    if (L.look === "ribbons" || L.look === "tube") {
      // The values h / SUB of the way to the next slot (or this slot's own
      // at the end of the song).
      const w = vals[s + 1] || v;
      const t = h / SUB;
      if (L.look === "ribbons") {
        // Ribbon a (a band, bass at the bottom), strand b: the band's
        // loudness widens the ribbon; it turns as the loudness rises or
        // falls (the change from the slot before), and bends a little into
        // depth like a sheet, its middle strands brightest.
        const lvOf = (x) => level(x.six[a], tops.six, 40);
        const l0 = lerp(lvOf(v), lvOf(w), t);
        // (The change over two slots each side: a steady turn, not a zigzag.)
        const p0 = vals[Math.max(0, s - 2)] || v;
        const n0 = vals[Math.min(S, s + 2)] || w;
        const dl = (lvOf(n0) - lvOf(p0)) / 4;
        const turn = Math.max(-0.9, Math.min(0.9, dl * 10 * (L.live ? -1 : 1)));
        const u = b / (geo.J - 1) - 0.5;
        const width = 0.02 + 0.26 * l0;
        const across = u * width;
        const bend = (0.25 - u * u) * width * 0.9;
        P[0] = R[0];
        P[1] = ribbonBase(a) + 0.14 * l0 + across * Math.cos(turn) * 0.5;
        P[2] = across * Math.sin(turn) + across * 0.6 + bend;
        const c = T.six[a];
        setCol(c, 0, 0.72 + 0.28 * (1 - 2 * Math.abs(u)) + 0.3 * l0, age);
        put(i, P, R, true);
      } else {
        // Ring s, point a: loudness is the radius, pitch tilts the ring,
        // brightness colors it; lit from above and in front.
        const rOf = (x) => 0.02 + 0.38 * level(x.rms, tops.rms, 42) ** 1.2;
        const r = lerp(rOf(v), rOf(w), t);
        const tilt = 0.7 * lerp(pitchUnit(pitchHz(v)), pitchUnit(pitchHz(w)), t);
        const bu = lerp(brightUnit(v.cen), brightUnit(w.cen), t);
        const th = (a / geo.P) * Math.PI * 2;
        P[0] = R[0] + r * Math.sin(th) * Math.sin(tilt);
        P[1] = r * Math.cos(th);
        P[2] = r * Math.sin(th) * Math.cos(tilt);
        const light = 0.78 + 0.2 * Math.cos(th) + 0.14 * Math.sin(th);
        setCol(T.bright, Math.round(bu * (TABLE - 1)) * 3, light, age);
        put(i, P, R, true);
      }
    } else {
      // Lines and Mesh: band a's level at slot s is the height; a needle q /
      // SUBF of the way to the next band (or h / SUB to the next slot)
      // takes the level in between.
      const K = geo.K;
      let l;
      if (b === 0) {
        const t = h / SUBF;
        l = lerp(lv[s * K + a], lv[s * K + Math.min(K - 1, a + 1)], t);
      } else {
        const nx = lv[(s + 1) * K + a];
        l = lerp(lv[s * K + a], nx >= 0 ? nx : lv[s * K + a], h / SUB);
      }
      l = Math.max(0, l);
      P[0] = R[0];
      P[1] = l * 0.62 + 0.004;
      P[2] = R[2];
      // Pitch picks the hue; the height deepens it (low lines pale and
      // fine, the loud ridges full).
      const at = Math.round((a / (K - 1)) * (TABLE - 1)) * 3;
      setCol(T.pitch, at, 0.62 + 0.55 * l, age);
      const pale = 0.45 * (1 - l) ** 2;
      for (let j = 0; j < 3; j++)
        col[j] = Math.round(col[j] + (T.paper[j] - col[j]) * (paper ? pale : 0));
      put(i, P, R, true);
    }
  }
  g.putImageData(L.img, 0, 0);
  // What was drawn at the "now" mark, for the sync test: the moment and its
  // slot's loudness (dB).
  const at = L.live ? 0 : Math.min(L.S - 1, Math.floor((nowFrame * L.S) / Math.max(1, n)));
  L.shown = { now, rms: vals[at]?.rms ?? null };
}

const rgb = (c) => (typeof c === "string" ? hexToRgb(c) : c);
function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// Where the gate and the moving part go at `now` (recipe units), for drive:
// Live: the slots step back one frame at a time, so the part slides by the
// fraction of a frame heard since the last step; Whole: the gate moves along
// the song.
export function lookMotion(L, now, duration) {
  const frac = now / HOP - 0.5 - liveFrame(now);
  if (L.geo.axis === "x") {
    if (L.live) return { look: [frac * L.geo.dx, 0, 0], gate: [0, 0, 0] };
    return { look: [0, 0, 0], gate: [Math.min(1, now / Math.max(1e-6, duration)) * LEN_X, 0, 0] };
  }
  if (L.live) return { look: [0, 0, -frac * L.geo.dz], gate: [0, 0, 0] };
  return { look: [0, 0, 0], gate: [0, 0, -Math.min(1, now / Math.max(1e-6, duration)) * L.geo.D] };
}

// The texture's version for the player: a new frame heard, or new frames
// measured.
export const lookVersion = (L, an, now) =>
  `${L.live ? liveFrame(now) : Math.floor(now / HOP)}|${an?.version ?? -1}`;

export { F_MIN, F_MAX };

// ---- The landscape, for a long song -------------------------------------------------------
// The "pitch" and "loudness" looks as they have always looked (pitch across,
// time in depth, loudness as height, a waveform along the left edge), built
// from relief splats so a long song's landscape fills in as its frames are
// measured instead of waiting for all of them. Each cell is its slot's
// loudest moment in its band; a lower splat under each cell makes a ridge a
// wall from the side. In the Live view what has played clears as it
// crosses the line at the front.

export function buildLandscapeLong(k, { nf, duration, look, live, W, H, songColor }) {
  const D = Math.min(8, 1.2 + 0.08 * duration);
  const nt = Math.max(40, Math.min(1600, Math.floor((k.count * 0.33) / (nf * 2))));
  const cw = W / nf;
  const cd = D / nt;
  const x = (f) => (f / (nf - 1) - 0.5) * W;
  const z = (t) => D / 2 - ((t + 0.5) / nt) * D;
  const part = k.part("look");
  const list = [];
  const sizeOf = Math.max(cw, cd) * 1.5;
  for (let t = 0; t < nt; t++)
    for (let f = 0; f < nf; f++)
      for (let l = 0; l < 2; l++) list.push({ p: [x(f), 0.01, z(t)], role: [t, f, l] });
  // The waveform along the left edge: the slot's loudness, mirrored.
  for (let t = 0; t < nt; t++) for (let l = 0; l < 3; l++) list.push({ p: [-W / 2 - 0.18, 0.4, z(t)], role: [t, -1, l] }); // prettier-ignore
  const n = list.length;
  const cols = Math.min(1024, Math.max(16, Math.ceil(Math.sqrt(n * 2))));
  const rows = Math.ceil(n / cols);
  const lift = Math.max(H, 0.4);
  k.cloud({ share: n / k.count, pattern: false }, (rand, i) => {
    const s = list[i];
    if (!s) return null;
    const wave = s.role[1] < 0;
    return { p: s.p, n: wave ? [0, 0, 1] : s.role[2] === 0 ? [0, 1, 0] : [0, 0, 1], flat: 0.05, size: (wave ? cd * 3 : sizeOf) / 0.025 * 1.0, color: "#888888", opacity: 0.98, kind: "relief", params: [((i % cols) + 0.5) / cols, (Math.floor(i / cols) + 0.5) / rows, 3, lift], part, pattern: false }; // prettier-ignore
  });
  // The floor under it, on the same part.
  const fl = [];
  const fc = 90;
  const fr = Math.max(8, Math.round((fc * D) / W));
  for (let j = 0; j < fr; j++)
    for (let i = 0; i < fc; i++) fl.push({ p: [((i + 0.5) / fc - 0.5) * (W + 0.16), -0.005, ((j + 0.5) / fr - 0.5) * (D + 0.16)], n: [0, 1, 0], flat: 0.03, size: ((W / fc) * 1.6) / 0.01, color: "#2a303a", opacity: 1, part, pattern: false }); // prettier-ignore
  k.cloud({ share: fl.length / k.count, pattern: false }, (rand, i) => fl[i] || null);
  // The marker at the front, and (Live) the caps that ride the loudness there.
  const marker = k.part("marker");
  const mk = [];
  for (let i = 0; i < 160; i++) {
    const xx = ((i + 0.5) / 160 - 0.5) * (W + 0.1);
    mk.push({ p: [xx, 0.02, D / 2], color: "#fff3b0", size: 1.1, opacity: 1, part: marker, pattern: false }); // prettier-ignore
  }
  k.cloud({ share: mk.length / k.count, pattern: false }, (rand, i) => mk[i] || null);
  const caps = [];
  if (live) {
    const nc = Math.min(48, nf);
    for (let i = 0; i < nc; i++) caps.push({ f0: Math.floor((i * nf) / nc), f1: Math.floor(((i + 1) * nf) / nc) }); // prettier-ignore
    const capW = (W / nc) * 1.05;
    const items = [];
    caps.forEach((cap, i) => {
      const cx = (x(cap.f0) + x(cap.f1 - 1)) / 2;
      for (let j = 0; j < 4; j++) items.push({ p: [cx + ((j + 0.5) / 4 - 0.5) * capW, 0.03, D / 2], n: [0, 1, 0], color: "#fff6c8", size: ((capW / 4) * 1.5 * 1.15) / 0.025, flat: 0.05, opacity: 1, kind: "token", params: [i, 0], pattern: false }); // prettier-ignore
    });
    k.cloud({ share: items.length / k.count, pattern: false }, (rand, i) => items[i] || null);
  }
  k.reach([0, H + 0.2, -D / 2 - 0.1]);
  return { kind: "landscape", look, live, nf, nt, D, W, H, lift, caps, atlas: { cols, rows }, roles: list.map((s) => s.role), rest: list.map((s) => s.p), n, songColor }; // prettier-ignore
}

// The landscape's heights (0..1) per slot and band, pooled from the measured
// frames, kept up to date as the frames come in: a slot is worked out once
// all its frames are in (ok), and all of them again only when the loudest
// band so far rises by more than a decibel (the heights are relative to it).
function landscapeHeights(L, an) {
  const fe = an?.features;
  if (!fe) return null;
  if (L.hVersion === an.version) return L.heights;
  const { nt, nf } = L;
  const n = fe.n;
  if (!L.heights) {
    L.heights = new Float32Array(nt * nf);
    L.ok = new Uint8Array(nt);
    L.wave = new Float32Array(nt);
    L.seen = new Uint8Array(n);
    L.top = DB_FLOOR;
    L.wtop = 1e-9;
    L.hTop = DB_FLOOR;
  }
  const h = L.heights;
  // The loudest band so far, from the frames new since the last look.
  for (let f = 0; f < n; f++)
    if (fe.done[f] && !L.seen[f]) {
      L.seen[f] = 1;
      for (let b = 0; b < nf; b++) if (fe.bands[f * nf + b] > L.top) L.top = fe.bands[f * nf + b];
    }
  const all = L.top > L.hTop + 1;
  if (all) L.hTop = L.top;
  const top = L.hTop;
  for (let t = 0; t < nt; t++) {
    if (L.ok[t] && !all) continue;
    const a = Math.floor((t * n) / nt);
    const e = Math.max(a + 1, Math.floor(((t + 1) * n) / nt));
    let full = true;
    for (let f = a; f < e; f++) if (!fe.done[f]) full = false;
    if (!full) continue;
    L.ok[t] = 1;
    for (let b = 0; b < nf; b++) {
      let db = DB_FLOOR;
      for (let f = a; f < e; f++) db = Math.max(db, fe.bands[f * nf + b]);
      h[t * nf + b] = clamp01((db - (top - 45)) / 45);
    }
    let r = 0;
    for (let f = a; f < e; f++) r = Math.max(r, 10 ** (fe.feat[f * NFI + F.rms] / 20));
    L.wave[t] = r;
    L.wtop = Math.max(L.wtop, r);
  }
  L.hVersion = an.version;
  return h;
}

// The landscape's colors as a table: per band, LEVELS heights, the top
// splat's color and the one under it (bytes).
const LEVELS = 64;
function colorTable(L) {
  if (L.lut) return L.lut;
  const lut = new Uint8Array(L.nf * LEVELS * 6);
  for (let f = 0; f < L.nf; f++)
    for (let q = 0; q < LEVELS; q++) {
      const c = rgb(L.songColor(L.look, f, L.nf, q / (LEVELS - 1)));
      const d = rgb(shade(c, 0.8));
      const o = (f * LEVELS + q) * 6;
      for (let j = 0; j < 3; j++) {
        lut[o + j] = Math.round(c[j] * 255);
        lut[o + 3 + j] = Math.round(d[j] * 255);
      }
    }
  L.lut = lut;
  return lut;
}

const GOLD = [217, 165, 32];
const GRAY = [138, 147, 166];

export function drawLandscapeLong(g, L, an, now, duration) {
  const { cols, rows } = L.atlas;
  if (!L.img) L.img = g.createImageData(cols * 2, rows);
  const px = L.img.data;
  const h = landscapeHeights(L, an);
  const lut = colorTable(L);
  const lift2 = 2 * L.lift;
  const played = L.live && duration > 0 ? Math.floor((now / duration) * L.nt) : -1;
  for (let i = 0; i < L.n; i++) {
    const [t, f, l] = L.roles[i];
    const R = L.rest[i];
    const c = i % cols;
    const r = Math.floor(i / cols);
    const o = (r * cols * 2 + c) * 4;
    const q = (r * cols * 2 + cols + c) * 4;
    let show = !!(h && L.ok[t]) && !(L.live && t < played);
    let y = R[1];
    if (show && f >= 0) {
      const v = h[t * L.nf + f];
      y = v * L.H * (l === 0 ? 1 : 0.5) + 0.01;
      if (l === 1 && v < 0.12) show = false;
      const k = (f * LEVELS + Math.round(v * (LEVELS - 1))) * 6 + (l === 0 ? 0 : 3);
      px[o] = lut[k];
      px[o + 1] = lut[k + 1];
      px[o + 2] = lut[k + 2];
    } else if (show) {
      const a = (L.wave[t] / L.wtop) * 0.3;
      y = 0.4 + (l === 0 ? a : l === 1 ? -a : 0);
      const col = l === 2 ? GRAY : GOLD;
      px[o] = col[0];
      px[o + 1] = col[1];
      px[o + 2] = col[2];
    }
    px[o + 3] = 255;
    px[q] = 128;
    px[q + 1] = Math.round(255 * clamp01((y - R[1]) / lift2 + 0.5));
    px[q + 2] = 128;
    px[q + 3] = show ? 255 : 0;
  }
  g.putImageData(L.img, 0, 0);
}

// The Live caps' heights at the front line (48 tokens), from the measured
// frame playing now.
export function landscapeCaps(L, an, now) {
  const fe = an?.features;
  if (!fe || !L.caps.length) return null;
  const f = Math.min(fe.n - 1, Math.max(0, Math.floor(now / HOP)));
  const top = L.hTop ?? 0;
  return L.caps.map((cap) => {
    let v = 0;
    if (fe.done[f]) for (let b = cap.f0; b < cap.f1; b++) v = Math.max(v, clamp01((fe.bands[f * fe.nf + b] - (top - 45)) / 45)); // prettier-ignore
    return { offset: [0, v * L.H, 0] };
  });
}

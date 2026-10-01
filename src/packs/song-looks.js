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
    const J = 14; // strands per ribbon
    const P = 48; // points per ring
    S = slotsFor(view, look === "ribbons" ? 6 * J : P, k.count);
    if (look === "tube" && !live) S = Math.min(S, 180); // rings you can tell apart
    const dx = LEN_X / S;
    const x0 = -LEN_X / 2;
    // Live: slot s's line is where the frame heard s frames ago is (slot 0
    // on the gate); Whole: slot s is the s-th share of the song.
    const xs = (s) => x0 + (s + (live ? 0 : 0.5)) * dx;
    if (look === "ribbons") {
      for (let b = 0; b < 6; b++)
        for (let j = 0; j < J; j++)
          for (let s = 0; s < S; s++) needle(list, [xs(s), ribbonBase(b), 0], [1, 0, 0], dx * 1.45, 0.0045, [s, b, j]); // prettier-ignore
      lift = 0.5;
    } else {
      for (let s = 0; s < S; s++)
        for (let p = 0; p < P; p++) {
          const th = (p / P) * Math.PI * 2;
          const r = 0.02;
          needle(list, [xs(s), r * Math.cos(th), r * Math.sin(th)], [0, -Math.sin(th), Math.cos(th)], ((2 * Math.PI * 0.4) / P) * 1.2, 0.004, [s, p, 0]); // prettier-ignore
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
    S = slotsFor(view, look === "mesh" ? K * 1.5 : K, k.count);
    // Live: one line per frame over the last 3 s (2.4 s for the mesh), few
    // enough to tell apart at phone size.
    if (look === "mesh") S = Math.min(S, live ? 60 : 100);
    else S = Math.min(S, live ? 75 : 120);
    const dz = D / S;
    const xk = (f) => ((f + 0.5) / K - 0.5) * W;
    const zs = (s) => D / 2 - (s + (live ? 0 : 0.5)) * dz;
    for (let s = 0; s < S; s++)
      for (let f = 0; f < K; f++) needle(list, [xk(f), 0, zs(s)], [1, 0, 0], (W / K) * 1.4, 0.0042, [s, f, 0]); // prettier-ignore
    if (look === "mesh")
      for (let f = 1; f < K; f += 4)
        for (let s = 0; s < S; s++) needle(list, [xk(f), 0, zs(s)], [0, 0, 1], dz * 1.45, 0.0042, [s, f, 1]); // prettier-ignore
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

export function drawLook(g, L, an, now, { backdrop }) {
  const { cols, rows } = L.atlas;
  if (!L.img || L.img.width !== cols * 2) L.img = g.createImageData(cols * 2, rows);
  const px = L.img.data;
  const fe = an?.features;
  const n = fe?.n || 0;
  const nowFrame = L.live ? liveFrame(now) : Math.floor(now / HOP);
  const range = slotFrames(L.view, L.S, n, nowFrame);
  // Tops: the loudest measured so far (kept on the look).
  if (fe && L.topsVersion !== an.version) {
    L.topsVersion = an.version;
    let rms = -120;
    let six = -120;
    let band = -120;
    for (let f = 0; f < n; f++) {
      if (!fe.done[f]) continue;
      const o = f * NFI;
      rms = Math.max(rms, fe.feat[o + F.rms]);
      for (let i = 0; i < 6; i++) six = Math.max(six, fe.feat[o + F.six0 + i]);
      for (let b = 0; b < fe.nf; b++) band = Math.max(band, fe.bands[f * fe.nf + b]);
    }
    L.tops = { rms, six, band };
  }
  const tops = L.tops || { rms: 0, six: 0, band: 0 };
  const cache = new Map();
  const values = (s) => {
    if (!cache.has(s)) cache.set(s, fe ? slotValues(fe.feat, fe.done, range(s), L.live, n) : null);
    return cache.get(s);
  };
  const paper = backdrop === "paper";
  const lift2 = 2 * L.lift;
  const put = (i, P, R, col, show) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const o = (r * cols * 2 + c) * 4;
    px[o] = Math.round(col[0] * 255);
    px[o + 1] = Math.round(col[1] * 255);
    px[o + 2] = Math.round(col[2] * 255);
    px[o + 3] = 255;
    const q = (r * cols * 2 + cols + c) * 4;
    px[q] = Math.round(255 * clamp01((P[0] - R[0]) / lift2 + 0.5));
    px[q + 1] = Math.round(255 * clamp01((P[1] - R[1]) / lift2 + 0.5));
    px[q + 2] = Math.round(255 * clamp01((P[2] - R[2]) / lift2 + 0.5));
    px[q + 3] = show ? 255 : 0;
  };
  const geo = L.geo;
  const fade = (col, s) => (L.live && paper ? mix(col, PAPER, 0.55 * (s / L.S) ** 1.5) : L.live ? shade(col, 1 - 0.5 * (s / L.S)) : col); // prettier-ignore
  for (let i = 0; i < L.n; i++) {
    const [s, a, b] = L.roles[i];
    const R = L.rest[i];
    const v = values(s);
    if (!v) {
      put(i, R, R, [0.5, 0.5, 0.5], false);
      continue;
    }
    if (L.look === "ribbons") {
      // Ribbon a (a band, bass at the bottom), strand b: the band's loudness
      // lifts the ribbon and spreads its strands.
      // The ribbon turns with the band's change since the slot before it
      // (rising one way, falling the other).
      const lv = level(v.six[a], tops.six, 40);
      const w = values(L.live ? s + 1 : s - 1);
      const turn = w ? Math.max(-1.3, Math.min(1.3, (lv - level(w.six[a], tops.six, 40)) * 8)) : 0;
      const across = (b / (geo.J - 1) - 0.5) * (0.02 + 0.26 * lv);
      const P = [R[0], ribbonBase(a) + 0.14 * lv + across * Math.cos(turn) * 0.5, across * Math.sin(turn) + across * 0.6]; // prettier-ignore
      put(i, P, R, fade(rgb(shade(SIX_COLORS[a], 0.8 + 0.3 * lv)), s), true);
    } else if (L.look === "tube") {
      // Ring s, point a: loudness is the radius, pitch tilts the ring,
      // brightness colors it.
      const lv = level(v.rms, tops.rms, 42);
      const r = 0.02 + 0.38 * lv ** 1.2;
      const th = (a / geo.P) * Math.PI * 2;
      const tilt = 0.7 * pitchUnit(pitchHz(v));
      const P = [R[0] + r * Math.sin(th) * Math.sin(tilt), r * Math.cos(th), r * Math.sin(th) * Math.cos(tilt)]; // prettier-ignore
      put(i, P, R, fade(rgb(ramp(BRIGHT, brightUnit(v.cen))), s), true);
    } else {
      // Lines and Mesh: band a's loudness at slot s is the height.
      const f0 = range(s);
      let db = DB_FLOOR;
      if (L.live) db = fe.bands[f0[0] * fe.nf + a];
      else for (let f = f0[0]; f < f0[1]; f++) db = Math.max(db, fe.bands[f * fe.nf + a]);
      const lv = level(db, tops.band, 45) ** 1.3;
      const P = [R[0], lv * 0.62 + 0.004, R[2]];
      const col = ramp(LOW_HIGH, a / (geo.K - 1));
      put(i, P, R, fade(rgb(shade(col, 0.85 + 0.25 * lv)), s), true);
    }
  }
  g.putImageData(L.img, 0, 0);
  // What was drawn at the "now" mark, for the sync test: the moment and its
  // slot's loudness (dB).
  const at = L.live ? 0 : Math.min(L.S - 1, Math.floor((nowFrame * L.S) / Math.max(1, n)));
  L.shown = { now, rms: values(at)?.rms ?? null };
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

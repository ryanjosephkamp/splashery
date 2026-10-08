// Lane Live r8: Sound in a box, a Chladni figure in three dimensions (the
// owner's question of October 6, 2026: "Could there be a 3D version? ... I
// don't want it to be BS").
//
// The physics. Sand on a plate gathers on the plate's still lines. The 3D
// version is real and is used in labs every day (acoustophoresis): tiny
// plastic beads in water inside a small glass cell, with an ultrasound
// transducer setting up a standing wave in the water. Each bead feels the
// acoustic radiation force, F = −∇U, where U is the Gor'kov potential
// (L. P. Gor'kov, 1962; H. Bruus, "Acoustofluidics 7: The acoustic
// radiation force on small particles", Lab Chip 12, 1014, 2012):
//
//   U = V [ f1 ⟨p²⟩ / (2 ρ c²) − (3/4) f2 ρ ⟨v²⟩ ]
//
// p is the sound's pressure and v the water's velocity, averaged over a
// cycle; f1 = 1 − κ_bead/κ_water and f2 = 2(ρ_bead − ρ)/(2ρ_bead + ρ) say how
// the bead differs from water. For polystyrene in water f1 ≈ 0.44 and
// f2 ≈ 0.034. For a standing wave p = P φ(x) cos ωt, with φ one of the
// cell's resonant modes and v = ∇p/(ρω), this is (up to a constant)
//
//   U ∝ f1 φ² − (3/2) f2 |∇φ|² / k²
//
// The first term wins, so the beads gather where φ = 0: on the mode's
// pressure-nodal surfaces, the 3D cousins of the plate's still lines. Beads
// this small move through water at a speed in step with the force (Stokes
// drag), so each one slides straight down U. They sink far more slowly
// than they are pushed (a few micrometers a second), so gravity is left out.
//
// The cell's modes. A cube of side L with rigid walls: φ = cos(lπx/L)
// cos(mπy/L) cos(nπz/L), ringing at f = (c / 2L) √(l² + m² + n²). Modes
// that share a frequency (l, m, n in another order) mix in a real cell, as
// the plate's (n, m) and (m, n) do, and their mix gives curved surfaces. A
// round flask of radius a: φ = j_l(kr) P_l(cos θ), with k set by the wall
// (j_l′(ka) = 0), ringing at f = c k / 2π. Water: c = 1497 m/s; the cell is
// 1 cm across, so its modes ring at about 100 to 370 kHz, far too high to hear: the
// toy plays each mode eight octaves down.

import { mix, shade, clamp } from "../kit.js";

const C_WATER = 1497; // m/s
const SIDE = 0.01; // m: the cell is 1 cm across
export const F1 = 0.44; // polystyrene in water (Bruus 2012)
export const F2 = 0.034;
const OCTAVES_DOWN = 8;

// The cell's modes on offer. Cube: terms [l, m, n, sign] summed. Flask: l
// and ka (a zero of j_l′, so the wall is rigid).
export const CELL_MODES = [
  { id: "cube-110", shape: "cube", terms: [[1, 1, 0, 1]], name: "Cube 1, 1, 0" },
  { id: "cube-111", shape: "cube", terms: [[1, 1, 1, 1]], name: "Cube 1, 1, 1" },
  { id: "cube-012", shape: "cube", terms: [[0, 1, 2, 1], [1, 2, 0, 1], [2, 0, 1, 1]], name: "Cube 0, 1, 2 mixed" }, // prettier-ignore
  { id: "cube-112", shape: "cube", terms: [[1, 1, 2, 1], [1, 2, 1, 1], [2, 1, 1, 1]], name: "Cube 1, 1, 2 mixed" }, // prettier-ignore
  { id: "cube-122", shape: "cube", terms: [[1, 2, 2, 1], [2, 1, 2, -1], [2, 2, 1, 1]], name: "Cube 1, 2, 2 mixed" }, // prettier-ignore
  { id: "flask-0-2", shape: "flask", l: 0, ka: 7.7253, name: "Flask, two shells" },
  { id: "flask-2-1", shape: "flask", l: 2, ka: 3.3421, name: "Flask, double cone" },
  { id: "flask-2-2", shape: "flask", l: 2, ka: 7.2899, name: "Flask, cones and a shell" },
];

export function cellMode(id) {
  return CELL_MODES.find((m) => m.id === id) || CELL_MODES[2];
}

// The mode's real frequency in hertz.
export function cellFreq(mode) {
  if (mode.shape === "cube") {
    const [l, m, n] = mode.terms[0];
    return (C_WATER / (2 * SIDE)) * Math.hypot(l, m, n);
  }
  return (C_WATER * mode.ka) / (2 * Math.PI * (SIDE / 2));
}
export function cellLabel(mode) {
  return `${mode.name}: ${(cellFreq(mode) / 1000).toFixed(0)} kHz`;
}
export function heardFreq(mode) {
  return cellFreq(mode) / 2 ** OCTAVES_DOWN;
}

// Spherical Bessel functions j0, j1, j2.
function sj(l, x) {
  if (x < 1e-4) return l === 0 ? 1 : 0;
  const s = Math.sin(x);
  const c = Math.cos(x);
  if (l === 0) return s / x;
  if (l === 1) return s / (x * x) - c / x;
  return (3 / (x * x) - 1) * (s / x) - (3 * c) / (x * x);
}
function legendre(l, u) {
  return l === 0 ? 1 : l === 1 ? u : 0.5 * (3 * u * u - 1);
}

// φ at a point of the cell, x, y, z each from −1 to 1 (the cube's walls,
// or the flask's radius 1); y is up. Its wavenumber k in those units.
export function modeShape(mode, x, y, z) {
  if (mode.shape === "cube") {
    const P = Math.PI / 2;
    const u = [(x + 1) * P, (y + 1) * P, (z + 1) * P];
    let s = 0;
    for (const [l, m, n, sg] of mode.terms) s += sg * Math.cos(l * u[0]) * Math.cos(m * u[1]) * Math.cos(n * u[2]); // prettier-ignore
    return s;
  }
  const r = Math.hypot(x, y, z);
  return sj(mode.l, mode.ka * r) * legendre(mode.l, r > 1e-6 ? y / r : 1);
}
export function modeK(mode) {
  if (mode.shape === "cube") {
    const [l, m, n] = mode.terms[0];
    return (Math.PI / 2) * Math.hypot(l, m, n);
  }
  return mode.ka;
}

export const G = 40; // grid cells along each side, from −1 to 1

// The Gor'kov potential on a grid of (G + 1)³ points, and its slope there.
// Outside the flask the slope points back in.
export function potentialGrid(mode) {
  const N = G + 1;
  const h = 2 / G;
  const at = (i) => -1 + i * h;
  const phi = new Float32Array(N * N * N);
  const id = (i, j, k) => (k * N + j) * N + i;
  for (let k = 0; k < N; k++)
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) phi[id(i, j, k)] = modeShape(mode, at(i), at(j), at(k));
  const kk = modeK(mode) ** 2;
  const U = new Float32Array(N * N * N);
  const d = (a, i, j, k, ax) => {
    const lo = [i, j, k];
    const hi = [i, j, k];
    lo[ax] = Math.max(0, lo[ax] - 1);
    hi[ax] = Math.min(N - 1, hi[ax] + 1);
    return (a[id(...hi)] - a[id(...lo)]) / ((hi[ax] - lo[ax]) * h);
  };
  for (let k = 0; k < N; k++)
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const g2 = d(phi, i, j, k, 0) ** 2 + d(phi, i, j, k, 1) ** 2 + d(phi, i, j, k, 2) ** 2;
        const p = phi[id(i, j, k)];
        U[id(i, j, k)] = F1 * p * p - 1.5 * F2 * (g2 / kk);
      }
  const grad = new Float32Array(N * N * N * 3);
  let max = 1e-9;
  for (let k = 0; k < N; k++)
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const o = id(i, j, k) * 3;
        for (let ax = 0; ax < 3; ax++) grad[o + ax] = d(U, i, j, k, ax);
        max = Math.max(max, Math.hypot(grad[o], grad[o + 1], grad[o + 2]));
      }
  return { U, grad, max, N, h };
}

function sample(grid, x, y, z, out) {
  const { grad, N, h } = grid;
  const fx = clamp((x + 1) / h, 0, N - 1.0001);
  const fy = clamp((y + 1) / h, 0, N - 1.0001);
  const fz = clamp((z + 1) / h, 0, N - 1.0001);
  const i = Math.floor(fx);
  const j = Math.floor(fy);
  const k = Math.floor(fz);
  const a = fx - i;
  const b = fy - j;
  const c = fz - k;
  out[0] = out[1] = out[2] = 0;
  for (let dk = 0; dk < 2; dk++)
    for (let dj = 0; dj < 2; dj++)
      for (let di = 0; di < 2; di++) {
        const w = (di ? a : 1 - a) * (dj ? b : 1 - b) * (dk ? c : 1 - c);
        const o = (((k + dk) * N + (j + dj)) * N + (i + di)) * 3;
        out[0] += w * grad[o];
        out[1] += w * grad[o + 1];
        out[2] += w * grad[o + 2];
      }
  return out;
}

const WALL = 0.97; // beads keep this far inside the walls
const SETTLE_SECS = 1.1; // the time scale of the slide (at full sound)

// The beads: n of them, scattered evenly through the cell.
export class Beads {
  constructor(n, mode, rand = Math.random) {
    this.n = n;
    this.mode = mode;
    this.rand = rand;
    this.P = new Float32Array(n * 3);
    this.grid = potentialGrid(mode);
    this.moving = false;
    this.scatter();
  }

  inside(x, y, z) {
    if (this.mode.shape === "cube") return Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) <= WALL; // prettier-ignore
    return x * x + y * y + z * z <= WALL * WALL;
  }

  scatter() {
    const { P, rand } = this;
    for (let i = 0; i < this.n; i++) {
      let x, y, z;
      do {
        x = (rand() * 2 - 1) * WALL;
        y = (rand() * 2 - 1) * WALL;
        z = (rand() * 2 - 1) * WALL;
      } while (!this.inside(x, y, z));
      P[i * 3] = x;
      P[i * 3 + 1] = y;
      P[i * 3 + 2] = z;
    }
  }

  // One frame: dt seconds with the sound at strength a (0..1; the force
  // goes with its square), and `stir` (0..1) a swirl of the water, as a
  // shaken cell. Returns whether any bead moved.
  step(dt, a, stir = 0) {
    if (dt <= 0 || (a < 1e-3 && stir <= 0)) return (this.moving = false);
    const { P, grid } = this;
    const g = [0, 0, 0];
    // The slide: velocity −μ ∇U, scaled so the steepest place moves a
    // bead about a tenth of the cell in SETTLE_SECS / 10.
    const mu = ((a * a) / grid.max) * (2 / SETTLE_SECS);
    const sub = Math.max(1, Math.ceil(dt / 0.02));
    const h = dt / sub;
    let moved = 0;
    for (let s = 0; s < sub; s++)
      for (let i = 0; i < this.n; i++) {
        const o = i * 3;
        let x = P[o];
        let y = P[o + 1];
        let z = P[o + 2];
        sample(grid, x, y, z, g);
        let dx = -mu * g[0] * h;
        let dy = -mu * g[1] * h;
        let dz = -mu * g[2] * h;
        if (stir > 0) {
          // A swirl about the upright axis and a stir up and down.
          const r = this.rand;
          dx += stir * h * (-z * 1.6 + (r() - 0.5) * 3);
          dz += stir * h * (x * 1.6 + (r() - 0.5) * 3);
          dy += stir * h * (r() - 0.5) * 3;
        }
        const len = Math.hypot(dx, dy, dz);
        if (len > 0.03) {
          dx *= 0.03 / len;
          dy *= 0.03 / len;
          dz *= 0.03 / len;
        }
        x += dx;
        y += dy;
        z += dz;
        if (!this.inside(x, y, z)) {
          if (this.mode.shape === "cube") {
            x = clamp(x, -WALL, WALL);
            y = clamp(y, -WALL, WALL);
            z = clamp(z, -WALL, WALL);
          } else {
            const r = Math.hypot(x, y, z) / WALL;
            x /= r;
            y /= r;
            z /= r;
          }
        }
        moved = Math.max(moved, len);
        P[o] = x;
        P[o + 1] = y;
        P[o + 2] = z;
      }
    this.moving = moved > 2e-5;
    return this.moving;
  }

  // How settled the beads are on the mode's nodal surfaces, 0 (scattered)
  // to 1: the share of beads within a hair of φ = 0 (|φ| under 4% of its
  // largest swing), rescaled from its share for scattered beads.
  settled() {
    const { P, mode } = this;
    let near = 0;
    const tol = 0.04 * this.swing();
    for (let i = 0; i < this.n; i += 3)
      if (Math.abs(modeShape(mode, P[i * 3], P[i * 3 + 1], P[i * 3 + 2])) < tol) near++;
    const share = near / Math.ceil(this.n / 3);
    const base = this.baseShare();
    return clamp((share - base) / (0.95 - base), 0, 1);
  }

  swing() {
    if (this._swing) return this._swing;
    let m = 0;
    for (let i = 0; i < 4000; i++) {
      const x = this.rand() * 2 - 1;
      const y = this.rand() * 2 - 1;
      const z = this.rand() * 2 - 1;
      if (this.inside(x, y, z)) m = Math.max(m, Math.abs(modeShape(this.mode, x, y, z)));
    }
    return (this._swing = m || 1);
  }

  baseShare() {
    if (this._base !== undefined) return this._base;
    const tol = 0.04 * this.swing();
    let near = 0;
    let all = 0;
    for (let i = 0; i < 6000; i++) {
      const x = this.rand() * 2 - 1;
      const y = this.rand() * 2 - 1;
      const z = this.rand() * 2 - 1;
      if (!this.inside(x, y, z)) continue;
      all++;
      if (Math.abs(modeShape(this.mode, x, y, z)) < tol) near++;
    }
    return (this._base = near / Math.max(1, all));
  }
}

// ---- The toy ----------------------------------------------------------------------------

const HALF = 0.8; // the cell's half-width in recipe units
const LIFT = HALF + 0.04; // the beads' offsets reach this far
const RING_SECS = 7;
// Dyed beads (labs often use colored or fluorescent ones), amber so they
// read on the light stage and the dark one alike.
const BEAD_A = "#c8701f";
const BEAD_B = "#eba443"; // a tap rings the transducer this long
const STIR_SECS = 1.0; // and first swirls a settled cell this long

const CELL = { beads: null, cols: 1, rows: 1, home: null, tone: null, img: null, version: 0, last: null, taps: 0, ringUntil: 0, stirUntil: 0, amp: 0, sorted: -1, unsorted: false, p: 0, frames: 0 }; // prettier-ignore

// For the tests: the beads and how settled they are.
export const cellState = () => ({
  n: CELL.beads?.n ?? 0,
  mode: CELL.beads?.mode?.id ?? null,
  moving: !!CELL.beads?.moving,
  settled: CELL.beads ? CELL.beads.settled() : 0,
  ringing: CELL.amp,
});

const cellScreen = {
  get width() {
    return CELL.cols * 2;
  },
  get height() {
    return CELL.rows;
  },
  version: () => CELL.version,
  draw(g) {
    const { beads, cols, rows, home, tone } = CELL;
    if (!beads) return;
    if (!CELL.img || CELL.img.width !== cols * 2 || CELL.img.height !== rows) {
      CELL.img = g.createImageData(cols * 2, rows);
      const px = CELL.img.data;
      for (let i = 0; i < beads.n; i++) {
        const c = mix(BEAD_A, BEAD_B, tone[i]).map((v) => Math.round(v * 255));
        const o = (Math.floor(i / cols) * cols * 2 + (i % cols)) * 4;
        px[o] = c[0];
        px[o + 1] = c[1];
        px[o + 2] = c[2];
        px[o + 3] = 255;
      }
    }
    const px = CELL.img.data;
    const q = 255 / (2 * LIFT);
    const P = beads.P;
    for (let i = 0; i < beads.n; i++) {
      const o = (Math.floor(i / cols) * cols * 2 + cols + (i % cols)) * 4;
      px[o] = 127.5 + (P[i * 3] * HALF - home[i * 3]) * q;
      px[o + 1] = 127.5 + (P[i * 3 + 1] * HALF - home[i * 3 + 1]) * q;
      px[o + 2] = 127.5 + (P[i * 3 + 2] * HALF - home[i * 3 + 2]) * q;
      px[o + 3] = 255;
    }
    g.putImageData(CELL.img, 0, 0);
  },
};

function cue(mode) {
  const f = heardFreq(mode);
  return [
    { voice: "tone", f, decay: RING_SECS, kind: "sine", vol: 0.7 },
    { voice: "tone", f: f * 2, decay: RING_SECS * 0.6, kind: "sine", vol: 0.08 },
  ];
}

// Fine flat discs along a straight edge, from a to b, facing n.
function rod(list, a, b, { step, size, color, n }) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const m = Math.max(2, Math.round(len / step));
  for (let i = 0; i <= m; i++) {
    const t = i / m;
    list.push({ p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], n, flat: 0.5, size, opacity: 1, color, pattern: false }); // prettier-ignore
  }
}

export const CHLADNI_CELL = {
  tiltLock: false,
  alive: () => !!CELL.beads?.moving || CELL.amp > 1e-3 || CELL.ringUntil > (CELL.last ?? 0),
  screen: cellScreen,
  density: 1.5,
  kernel: "sharp",
  options: [
    {
      key: "mode",
      label: "Mode",
      type: "select",
      default: "cube-012",
      choices: CELL_MODES.map((m) => ({ id: m.id, label: cellLabel(m) })),
    },
  ],
  controls: [{ key: "ring", label: "Switch on the sound", type: "toggle", default: 0, ease: RING_SECS }], // prettier-ignore
  action: { key: "ring", label: "Switch on the sound", quiet: ["ring"] },
  drive(t, c, out, info) {
    const mode = info?.data?.cell;
    if (!mode || !CELL.beads) return;
    const time = info.time ?? t;
    const dt = CELL.last === null ? 0 : Math.min(0.1, Math.max(0, time - CELL.last));
    CELL.last = time;
    const n = info.tap?.n ?? 0;
    if (n < CELL.taps) CELL.taps = 0;
    if (n > CELL.taps) {
      CELL.taps = n;
      // A tap rings the cell; on a formed figure it first swirls the water.
      if (CELL.p > 0.6) CELL.stirUntil = time + STIR_SECS;
      CELL.ringUntil = time + RING_SECS;
      for (const q of cue(mode)) out.cues.push(q);
    }
    const ringing = time < CELL.ringUntil;
    const stirring = time < CELL.stirUntil;
    // The sound comes up and dies away within about a tenth of a second.
    CELL.amp += ((ringing ? 1 : 0) - CELL.amp) * (1 - Math.exp(-dt / 0.1));
    if (CELL.amp < 1e-3) CELL.amp = 0;
    const stir = stirring ? Math.min(1, (CELL.stirUntil - time) / 0.3) : 0;
    if (CELL.beads.step(dt, stirring ? 0 : CELL.amp, stir)) {
      CELL.version++;
      if (time - CELL.sorted > 0.15) {
        CELL.sorted = time;
        out.resortPose = true;
      }
      CELL.unsorted = true;
    } else if (CELL.unsorted) {
      CELL.unsorted = false;
      out.resortPose = true;
    }
    if (CELL.frames++ % 10 === 0 || !CELL.beads.moving) CELL.p = CELL.beads.settled();
  },
  build(k, o) {
    const mode = cellMode(o.mode);
    Object.assign(CELL, { last: null, ringUntil: 0, stirUntil: 0, amp: 0, sorted: -1, unsorted: true, p: 0, frames: 0 }); // prettier-ignore
    const H = HALF;
    const frame = [];
    const metal = "#59616b";
    if (mode.shape === "cube") {
      // The glass cell's edges: a slim dark frame (the clear walls are not
      // drawn, so the beads inside stay in plain view).
      const e = H + 0.012;
      for (const a of [-e, e])
        for (const b of [-e, e]) {
          rod(frame, [-e, a, b], [e, a, b], { step: 0.006, size: 0.75, color: shade(metal, a > 0 ? 1.15 : 0.95), n: [0, a > 0 ? 1 : -1, 0] }); // prettier-ignore
          rod(frame, [a, -e, b], [a, e, b], { step: 0.006, size: 0.75, color: shade(metal, 1.05), n: [a > 0 ? 1 : -1, 0, 0] }); // prettier-ignore
          rod(frame, [a, b, -e], [a, b, e], { step: 0.006, size: 0.75, color: shade(metal, b > 0 ? 1.15 : 0.95), n: [0, b > 0 ? 1 : -1, 0] }); // prettier-ignore
        }
    } else {
      // The round flask: three thin hoops of its glass (the equator and two
      // meridians), and a short neck at the top.
      const r = H + 0.012;
      const m = Math.round((2 * Math.PI * r) / 0.006);
      for (let i = 0; i < m; i++) {
        const th = (i / m) * Math.PI * 2;
        const c = Math.cos(th);
        const s = Math.sin(th);
        frame.push({ p: [r * c, 0, r * s], n: [c, 0, s], flat: 0.5, size: 0.7, opacity: 1, color: shade(metal, 1.1), pattern: false }); // prettier-ignore
        frame.push({ p: [r * s, r * c, 0], n: [s, c, 0], flat: 0.5, size: 0.7, opacity: 1, color: shade(metal, 1), pattern: false }); // prettier-ignore
        frame.push({ p: [0, r * c, r * s], n: [0, c, s], flat: 0.5, size: 0.7, opacity: 1, color: shade(metal, 0.95), pattern: false }); // prettier-ignore
      }
      for (let y = r; y < r + 0.16; y += 0.006)
        for (let i = 0; i < 36; i++) {
          const th = (i / 36) * Math.PI * 2;
          frame.push({ p: [0.1 * Math.cos(th), y, 0.1 * Math.sin(th)], n: [Math.cos(th), 0, Math.sin(th)], flat: 0.2, size: 0.8, opacity: 1, color: shade(metal, 0.9 + 0.2 * Math.max(0, Math.cos(th - 0.6))), pattern: false }); // prettier-ignore
        }
    }
    k.cloud({ share: frame.length / k.count, pattern: false, jitter: 0 }, (rand, i) => frame[i] || null); // prettier-ignore
    // The transducer under the cell: a ceramic disc on a dark puck.
    const pz = [];
    const y0 = -H - (mode.shape === "cube" ? 0.02 : 0.03);
    const R = 0.42;
    const step = 0.01;
    for (let rr = 0; rr <= R; rr += step) {
      const m = Math.max(1, Math.round((2 * Math.PI * rr) / step));
      for (let i = 0; i < m; i++) {
        const th = (i / m) * Math.PI * 2 + (rr / step) * 0.5;
        const edge = rr > R - step * 1.5 ? 1.15 : 1;
        pz.push({ p: [rr * Math.cos(th), y0, rr * Math.sin(th)], n: [0, 1, 0], flat: 0.02, size: 1.3, opacity: 1, color: shade("#6f6a62", edge), pattern: false }); // prettier-ignore
      }
    }
    for (let yy = y0 - 0.006; yy > y0 - 0.12; yy -= 0.008) {
      const m = Math.round((2 * Math.PI * (R + 0.02)) / step);
      for (let i = 0; i < m; i++) {
        const th = ((i + (Math.round(yy / 0.008) % 2) * 0.5) / m) * Math.PI * 2;
        const n = [Math.cos(th), 0, Math.sin(th)];
        pz.push({ p: [(R + 0.02) * n[0], yy, (R + 0.02) * n[2]], n, flat: 0.02, size: 1.2, opacity: 1, color: shade("#2c3138", 0.8 + 0.35 * Math.max(0, n[0] * 0.6 + n[2] * 0.8)), pattern: false }); // prettier-ignore
      }
    }
    k.cloud({ share: pz.length / k.count, pattern: false, jitter: 0 }, (rand, i) => pz[i] || null); // prettier-ignore
    // The beads: relief splats moved from the screen canvas (as the plate's
    // sand), each resting a hair from the middle.
    const n = Math.max(5000, Math.min(16000, Math.floor(k.count * 0.07)));
    const beads = new Beads(n, mode, () => k.rand());
    const cols = Math.min(256, Math.ceil(Math.sqrt(n * 2)));
    const rows = Math.ceil(n / cols);
    const home = new Float32Array(n * 3);
    const tone = new Float32Array(n);
    const items = [];
    for (let i = 0; i < n; i++) {
      for (let a = 0; a < 3; a++) home[i * 3 + a] = (k.rand() - 0.5) * 0.04;
      tone[i] = k.rand();
      items.push({ p: [home[i * 3], home[i * 3 + 1], home[i * 3 + 2]], color: mix(BEAD_A, BEAD_B, tone[i]), size: 0.42 + 0.22 * tone[i], opacity: 1, kind: "relief", params: [((i % cols) + 0.5) / cols, (Math.floor(i / cols) + 0.5) / rows, 3, LIFT], pattern: false }); // prettier-ignore
    }
    k.cloud({ share: n / k.count, size: 0.5, pattern: false, jitter: 0 }, (rand, i) => items[i] || null); // prettier-ignore
    Object.assign(CELL, { beads, cols, rows, home, tone, img: null, version: CELL.version + 1 });
    k.reach([0, H + 0.2, 0]);
    k.reach([0, -H - 0.2, 0]);
    k.data = { cell: mode };
  },
};

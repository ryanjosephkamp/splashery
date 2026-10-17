// Lane Volume viewer (prefix vol): a volume (src/volume/read.js) drawn as splats.
//
//   volumeStats(V)            a histogram's levels: percentiles and the air's threshold
//   windowFor(V, o)           [lo, hi] from a preset (bone, soft tissue, full range) or the sliders
//   COLORMAPS                 the transfer function's colors, from 0 (the window's bottom) to 1
//   buildVolume(k, V, opts)   volume splats on a lattice spaced to fit the budget
//   buildMIP(k, V, opts)      the maximum-intensity picture along one axis, as a flat sheet
//
// Recipe coordinates are millimeters, with the toy's right, up and toward the viewer as the
// volume's view axes say, so an anisotropic scan keeps its true shape.

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a || 1), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

// ---- Levels -----------------------------------------------------------------------------------------

const BINS = 2048;

// Otsu's threshold over histogram bins [from, to): the level that best splits them in two.
function otsu(hist, from, to) {
  let total = 0;
  let sum = 0;
  for (let i = from; i < to; i++) {
    total += hist[i];
    sum += i * hist[i];
  }
  let wB = 0;
  let sumB = 0;
  let best = from;
  let bestVar = -1;
  for (let i = from; i < to; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const v = wB * wF * (mB - mF) ** 2;
    if (v > bestVar) {
      bestVar = v;
      best = i;
    }
  }
  return best + 1;
}

export function volumeStats(V) {
  if (V.stats) return V.stats;
  const hist = new Float64Array(BINS);
  const span = V.max - V.min || 1;
  const bin = (v) => clamp(Math.floor(((v - V.min) / span) * BINS), 0, BINS - 1);
  for (let i = 0; i < V.data.length; i++) hist[bin(V.data[i])]++;
  const level = (b) => V.min + (b / BINS) * span;
  const n = V.data.length;
  const pct = (q) => {
    let acc = 0;
    for (let i = 0; i < BINS; i++) {
      acc += hist[i];
      if (acc >= q * n) return level(i + 1);
    }
    return V.max;
  };
  const airBin = otsu(hist, 0, BINS);
  const denseBin = otsu(hist, airBin, BINS);
  const stats = {
    air: level(airBin),
    dense: level(denseBin),
    p999: pct(0.999),
    p995: pct(0.995),
    hist,
  };
  V.stats = stats;
  return stats;
}

// The presets. In a CT in Hounsfield units they are the usual ranges; in any other scan (a
// micro-CT's gray levels, an MRI) they come from the scan's own histogram: the air (or the
// background) is what Otsu's method splits from the rest, and the densest part is what it splits
// from the remainder.
export const PRESETS = [
  { id: "bone", label: "Bone (the densest parts)" },
  { id: "soft", label: "Soft tissue" },
  { id: "full", label: "Full range (all but the air)" },
];

export function presetWindow(V, id) {
  const s = volumeStats(V);
  if (V.unit === "HU") {
    if (id === "bone") return [300, 1500];
    if (id === "soft") return [-160, 240];
    return [Math.max(V.min, -500), V.max];
  }
  const top = Math.max(s.p999, s.dense + 1e-6);
  if (id === "bone") return [s.dense, top];
  if (id === "soft") return [s.air, s.dense];
  return [s.air, V.max];
}

// o.preset (or "custom" with o.level and o.width as shares of the volume's range).
export function windowFor(V, o) {
  if (o.preset !== "custom") return presetWindow(V, o.preset || "full");
  const span = V.max - V.min || 1;
  const level = V.min + clamp(o.level ?? 0.5, 0, 1) * span;
  const width = Math.max(1e-3, clamp(o.width ?? 0.5, 0, 1)) * span;
  return [level - width / 2, level + width / 2];
}

// Window and level, as a radiologist writes them (W, L).
export const wl = ([lo, hi]) => ({ width: hi - lo, level: (hi + lo) / 2 });

// ---- Colors (the transfer function) -----------------------------------------------------------------

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
// A ramp through colors at even steps.
const ramp = (stops) => {
  const c = stops.map(hex);
  return (t) => {
    const x = clamp(t, 0, 1) * (c.length - 1);
    const i = Math.min(c.length - 2, Math.floor(x));
    const f = x - i;
    return [lerp(c[i][0], c[i + 1][0], f), lerp(c[i][1], c[i + 1][1], f), lerp(c[i][2], c[i + 1][2], f)]; // prettier-ignore
  };
};

export const COLORMAPS = {
  gray: { label: "CT gray", map: ramp(["#3a3a3a", "#8c8c8c", "#d4d4d4", "#ffffff"]) },
  bone: { label: "Bone and tissue", map: ramp(["#6e2a1e", "#b5553f", "#d99a76", "#eedcbc", "#fff8ea"]) }, // prettier-ignore
  hot: { label: "Hot metal", map: ramp(["#4a0b05", "#b3260c", "#f07a12", "#ffd23f", "#fffbe6"]) },
  cool: { label: "Cool", map: ramp(["#14306b", "#1f6fb2", "#36b3c9", "#9fe6dc", "#f2fffb"]) },
  green: { label: "Night vision", map: ramp(["#0b3311", "#1d7a2a", "#4fd65f", "#c9ffc4"]) },
};

// ---- Sampling ---------------------------------------------------------------------------------------

// The value at a point in voxel units (trilinear; the edge value outside).
export function sampleAt(V, x, y, z) {
  const { nx, ny, nz, data } = V;
  x = x < 0 ? 0 : x > nx - 1 ? nx - 1 : x;
  y = y < 0 ? 0 : y > ny - 1 ? ny - 1 : y;
  z = z < 0 ? 0 : z > nz - 1 ? nz - 1 : z;
  const x0 = Math.min(nx - 2, Math.floor(x));
  const y0 = Math.min(ny - 2, Math.floor(y));
  const z0 = Math.min(nz - 2, Math.floor(z));
  if (x0 < 0 || y0 < 0 || z0 < 0) {
    // A volume one voxel thick on some axis: nearest along it.
    const xi = Math.round(x);
    const yi = Math.round(y);
    const zi = Math.round(z);
    return data[(zi * ny + yi) * nx + xi];
  }
  // Lane TF1: written out (no closures), as the lattice calls it seven times a point.
  const fx = x - x0;
  const fy = y - y0;
  const fz = z - z0;
  const plane = nx * ny;
  const i = (z0 * ny + y0) * nx + x0;
  const j = i + plane;
  const a = data[i] + (data[i + 1] - data[i]) * fx;
  const b = data[i + nx] + (data[i + nx + 1] - data[i + nx]) * fx;
  const c = data[j] + (data[j + 1] - data[j]) * fx;
  const d = data[j + nx] + (data[j + nx + 1] - data[j + nx]) * fx;
  const lower = a + (b - a) * fy;
  return lower + (c + (d - c) * fy - lower) * fz;
}

// Index place -> recipe place (mm), and the volume's half extents in the recipe's axes.
export function placer(V) {
  const c = [(V.nx - 1) / 2, (V.ny - 1) / 2, (V.nz - 1) / 2];
  const half = [0, 0, 0];
  const n = [V.nx, V.ny, V.nz];
  for (let i = 0; i < 3; i++) half[V.view[i].axis] = (n[i] * V.spacing[i]) / 2;
  const to = (ix, iy, iz, out = [0, 0, 0]) => {
    const idx = [ix, iy, iz];
    for (let i = 0; i < 3; i++) out[V.view[i].axis] = V.view[i].sign * (idx[i] - c[i]) * V.spacing[i]; // prettier-ignore
    return out;
  };
  return { to, half };
}

// The baked light: from above, a little left and in front (the toy's frame).
const LIGHT = (() => {
  const l = [-0.35, 0.8, 0.5];
  const n = Math.hypot(...l);
  return l.map((x) => x / n);
})();

// A small seeded random generator (mulberry32), so a lattice sampled ahead of its build (in the
// toy's prepare) jitters the same way every time.
export function seeded(seed = 1) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// The pitch that last fitted each volume, window and budget (lane TF1): a tap that steps back to
// a preset samples its lattice once instead of up to four times.
const PITCHES = new WeakMap();

// The lattice of volume splats as steps (lane TF1): a generator that yields every few thousand
// points, so the toy's prepare can spread the work over frames and the volume on show keeps
// turning; sampleVolume runs it at once. Each point is x, y, z (recipe), its value, the densest
// value around it, its gradient's size (in voxels), and its kind (times two, plus how much the light
// falls on it): 0 the outer surface between the sheets, 1 a
// sheet's inside (only a cut face shows it), 2 a sheet's point on the surface.
export function* sampleSteps(V, { lo, budget, seed = 7, sheets = null }) {
  const [sx, sy, sz] = V.spacing;
  let inside = 0;
  for (let i = 0; i < V.data.length; i++) if (V.data[i] > lo) inside++;
  const voxel = Math.cbrt(sx * sy * sz);
  const room = Math.max(1000, budget * 0.92);
  const K = sheets ? Math.max(1, Math.round(sheets.k)) : 1;
  const across = sheets ? V.view.findIndex((a) => a.axis === sheets.axis) : -1;
  const flat = !!sheets?.flat;
  const { to, half } = placer(V);
  const p = [0, 0, 0];
  const jit = 0.18;
  const cap = budget * 1.3;
  const gx = [0, 0, 0];
  function* sample(h) {
    // Each pass jitters from the same seed, so a pitch known ahead gives the same lattice.
    const rand = seeded(seed);
    const step = [h / sx, h / sy, h / sz];
    const pts = [];
    let work = 0;
    for (let z = 0, iz = 0; z <= V.nz - 1 + 1e-6; z += step[2], iz++) {
      for (let y = 0, iy = 0; y <= V.ny - 1 + 1e-6; y += step[1], iy++) {
        for (let x = 0, ix = 0; x <= V.nx - 1 + 1e-6; x += step[0], ix++) {
          if (pts.length / 7 >= cap) return pts;
          const onSheet = across < 0 || (across === 0 ? ix : across === 1 ? iy : iz) % K === 0;
          if (!onSheet && flat) continue;
          // A little jitter breaks up the lattice's lines on a cut face (none across the
          // sheets, so each sheet stays flat).
          const px = x + (across === 0 ? 0 : (rand() - 0.5) * jit * step[0]);
          const py = y + (across === 1 ? 0 : (rand() - 0.5) * jit * step[1]);
          const pz = z + (across === 2 ? 0 : (rand() - 0.5) * jit * step[2]);
          const v = sampleAt(V, px, py, pz);
          work++;
          if (!(v > lo)) continue;
          const n0 = sampleAt(V, px + 1, py, pz);
          const n1 = sampleAt(V, px - 1, py, pz);
          const n2 = sampleAt(V, px, py + 1, pz);
          const n3 = sampleAt(V, px, py - 1, pz);
          const n4 = sampleAt(V, px, py, pz + 1);
          const n5 = sampleAt(V, px, py, pz - 1);
          work += 6;
          const low = Math.min(n0, n1, n2, n3, n4, n5);
          // Between the sheets, only the outer surface.
          if (!onSheet && low > lo) continue;
          const m = Math.max(v, n0, n1, n2, n3, n4, n5);
          // Shading baked from the volume's gradient (its surfaces lit from above and in
          // front); inside, where the values are even (a cut face), the color is left as it is.
          const g0 = (n0 - n1) / (2 * sx);
          const g1 = (n2 - n3) / (2 * sy);
          const g2 = (n4 - n5) / (2 * sz);
          gx[V.view[0].axis] = -V.view[0].sign * g0;
          gx[V.view[1].axis] = -V.view[1].sign * g1;
          gx[V.view[2].axis] = -V.view[2].sign * g2;
          to(px, py, pz, p);
          pts.push(p[0], p[1], p[2], v, m, Math.hypot(gx[0], gx[1], gx[2]), 0);
          const gl = pts[pts.length - 2];
          const lit = gl > 0 ? Math.max(0, (gx[0] * LIGHT[0] + gx[1] * LIGHT[1] + gx[2] * LIGHT[2]) / gl) : 1; // prettier-ignore
          // (The shade is finished in emit, which knows the window's span: the lit share here.)
          pts[pts.length - 2] = gl * voxel;
          pts[pts.length - 1] = 2 * (onSheet ? (low > lo ? 1 : 2) : 0) + lit;
        }
        if (work > 6000) {
          work = 0;
          yield;
        }
      }
    }
    return pts;
  }
  // The pitch: first as if the sheets held everything, then corrected by the count (the
  // surface between the sheets adds to it).
  const key = `${lo}:${budget}:${K}:${across}:${flat}:${sx},${sy},${sz}`;
  if (!PITCHES.has(V.data)) PITCHES.set(V.data, new Map());
  const known = PITCHES.get(V.data);
  let h = known.get(key) ?? Math.max(voxel * 0.6, Math.cbrt((Math.max(1, inside) * sx * sy * sz) / (room * K))); // prettier-ignore
  let pts = yield* sample(h);
  for (let pass = 0; pass < 3 && pts.length / 7 > budget; pass++) {
    h *= Math.cbrt(pts.length / 7 / room) * 1.01;
    pts = yield* sample(h);
  }
  known.set(key, h);
  if (pts.length / 7 > budget) pts.length = budget * 7;
  return { pts, n: pts.length / 7, h, K, half, inside, flat, axis: sheets?.axis ?? -1 };
}

export function sampleVolume(V, opts) {
  const it = sampleSteps(V, opts);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

// Volume splats: a lattice of round splats, h millimeters apart, wherever the value is above the
// window's bottom; h is chosen so they fit the budget. Colored by the densest matter within a
// voxel, so a surface's partly filled voxels take the color of what they belong to. opacity:
// "solid" (opaque, with a thin soft edge where a voxel is partly filled) or "layers" (the low end
// of the window faint, the top opaque). sheets: { axis, k, flat } keeps only every k-th layer of
// the lattice across a recipe axis (the cut's) inside the volume, where only a cut face shows it:
// the same budget then draws the cut face about k^(1/3) times finer. Its outer surface keeps every
// layer (the points with a neighbor outside the window), so the skin stays smooth. flat (a thin
// slice) keeps the sheets only, each splat flattened to its sheet.
// Lane TF1: `sampled` is a lattice sampleSteps made ahead with the same settings. `depth: n` puts
// the sheets' insides into n of the toy's parts by their place along the sheets' axis (deep0 at
// the back), so the drive can hide all but those at the cut: with nothing cut away, the solid
// inside is never seen, and drawing it cost most of each frame.
export function buildVolume(
  k,
  V,
  { lo, hi, colors = "gray", opacity = "solid", budget, seed = 7, sheets = null, sampled = null, depth = 0 }, // prettier-ignore
) {
  const map = (COLORMAPS[colors] || COLORMAPS.gray).map;
  const S = sampled || sampleVolume(V, { lo, budget, seed, sheets });
  const { pts, n, h, K, half } = S;
  const span = hi - lo || 1;
  const edge = span * 0.12;
  const hn = h * K; // between sheets
  const s = h * 0.68;
  // Sheet splats reach toward the next sheet (flat ones stay thin); surface splats are round.
  const sheetScales = [s, s, s];
  if (sheets) sheetScales[sheets.axis] = sheets.flat ? Math.max(s * 0.35, hn * 0.12) : Math.max(s, hn * 0.55); // prettier-ignore
  const roundScales = [s, s, s];
  const axis = sheets?.axis ?? -1;
  const nDeep = sheets && !sheets.flat && axis >= 0 ? Math.max(0, Math.min(15 - k.parts.length + 1, depth | 0)) : 0; // prettier-ignore
  const deep = [];
  for (let b = 0; b < nDeep; b++) deep.push(k.part(`deep${b}`));
  const from = axis >= 0 ? -half[axis] - h : 0;
  const width = axis >= 0 ? (2 * half[axis] + 2 * h) / Math.max(1, nDeep) : 1;
  k.cloud({ count: n * (160000 / k.count), jitter: 0 }, (r, i) => {
    if (i >= n) return null;
    const v = pts[i * 7 + 3];
    const t = clamp((pts[i * 7 + 4] - lo) / span, 0, 1);
    const a =
      opacity === "layers"
        ? 0.1 + 0.9 * smoothstep(0, 0.85, clamp((v - lo) / span, 0, 1)) ** 1.4
        : 0.35 + 0.65 * smoothstep(lo, lo + edge, v);
    const tag = pts[i * 7 + 6];
    const kind = Math.floor(tag / 2);
    const lit = tag - 2 * kind;
    const edgeAmt = smoothstep(0, 0.35, pts[i * 7 + 5] / span);
    const sh = lerp(1, 0.42 + 0.7 * lit, edgeAmt);
    const col = map(t);
    const splat = {
      p: [pts[i * 7], pts[i * 7 + 1], pts[i * 7 + 2]],
      color: [Math.min(1, col[0] * sh), Math.min(1, col[1] * sh), Math.min(1, col[2] * sh)],
      scales: kind ? sheetScales : roundScales,
      opacity: a,
      kind: "volume",
      params: [clamp((v - lo) / span, 0.002, 1), 0],
      pattern: false,
    };
    if (kind === 1 && nDeep)
      splat.part = deep[clamp(Math.floor((splat.p[axis] - from) / width), 0, nDeep - 1)];
    return splat;
  });
  const out = { n, pitch: h, sheet: hn, half, inside: S.inside };
  if (nDeep) out.depth = { axis, n: nDeep, from, width };
  return out;
}

// The maximum-intensity projection along a recipe axis (0 right, 1 up, 2 toward the viewer), drawn
// as a flat picture facing the viewer: each pixel is the highest value on its line through the
// volume. Pixels at or below the window's bottom are black.
export function buildMIP(k, V, { lo, hi, axis = 2, colors = "gray", budget }) {
  const map = (COLORMAPS[colors] || COLORMAPS.gray).map;
  const j = V.view.findIndex((a) => a.axis === axis);
  const others = [0, 1, 2].filter((i) => i !== j);
  const n = [V.nx, V.ny, V.nz];
  const [p, q] = others;
  const np = n[p];
  const nq = n[q];
  const img = new Float32Array(np * nq).fill(-Infinity);
  const stride = [1, V.nx, V.nx * V.ny];
  for (let a = 0; a < np; a++)
    for (let b = 0; b < nq; b++) {
      let m = -Infinity;
      const base = a * stride[p] + b * stride[q];
      for (let c = 0; c < n[j]; c++) {
        const v = V.data[base + c * stride[j]];
        if (v > m) m = v;
      }
      img[b * np + a] = m;
    }
  // The picture's axes on the screen: the projection is seen from the front (along -z), from
  // above (along -y) or from the side (along -x), always facing the viewer, upright.
  const scr = { 2: { u: 0, v: 1 }, 1: { u: 0, v: 2, flipV: true }, 0: { u: 2, v: 1 } }[axis];
  const axisOf = (i) => V.view[i].axis;
  // Which of p, q runs along the screen's u (horizontal).
  const pu = axisOf(p) === scr.u;
  const uIdx = pu ? p : q;
  const vIdx = pu ? q : p;
  const W = n[uIdx] * V.spacing[uIdx];
  const H = n[vIdx] * V.spacing[vIdx];
  // The whole picture is drawn, on black like a radiograph: values at or below the window's
  // bottom are black.
  const area = W * H;
  let h = Math.sqrt(area / Math.max(1000, budget * 0.92));
  h = Math.max(h, Math.min(V.spacing[uIdx], V.spacing[vIdx]) * 0.5);
  const cu = W / 2;
  const cv = H / 2;
  const signU = V.view[uIdx].sign;
  const signV = V.view[vIdx].sign * (scr.flipV ? -1 : 1);
  const pts = [];
  const span = hi - lo || 1;
  for (let y = h / 2; y < H; y += h)
    for (let x = h / 2; x < W; x += h) {
      // Back to the picture's index axes (bilinear).
      const iu = signU > 0 ? x / V.spacing[uIdx] - 0.5 : (W - x) / V.spacing[uIdx] - 0.5;
      const iv = signV > 0 ? y / V.spacing[vIdx] - 0.5 : (H - y) / V.spacing[vIdx] - 0.5;
      const [ia, ib] = pu ? [iu, iv] : [iv, iu];
      const a0 = clamp(Math.floor(ia), 0, np - 1);
      const b0 = clamp(Math.floor(ib), 0, nq - 1);
      const a1 = Math.min(np - 1, a0 + 1);
      const b1 = Math.min(nq - 1, b0 + 1);
      const fa = clamp(ia - a0, 0, 1);
      const fb = clamp(ib - b0, 0, 1);
      const g = (aa, bb) => img[bb * np + aa];
      const v = lerp(lerp(g(a0, b0), g(a1, b0), fa), lerp(g(a0, b1), g(a1, b1), fa), fb);
      pts.push(x - cu, y - cv, v);
    }
  const count = pts.length / 3;
  const s = h * 0.62;
  k.cloud({ count: count * (160000 / k.count), jitter: 0 }, (r, i) => {
    if (i >= count) return null;
    const v = pts[i * 3 + 2];
    const t = clamp((v - lo) / span, 0, 1);
    return {
      p: [pts[i * 3], pts[i * 3 + 1], 0],
      color: v > lo ? map(t) : [0.015, 0.015, 0.02],
      scales: [s, s, s * 0.08],
      opacity: 1,
      pattern: false,
    };
  });
  return { n: count, pitch: h, half: [W / 2, H / 2, h], size: [W, H] };
}

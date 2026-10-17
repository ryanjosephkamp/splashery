// Codex task 78b. From Ryan Kamp's Specimen concept: procedural anatomy,
// moment-matched Gaussian pairs, and the 1952 Hodgkin-Huxley membrane model.
// This is a port onto the Kit and its existing PlayCanvas work-buffer hooks.
// No portfolio renderer, font, or page is shipped. Code MIT; original geometry CC0.
import { vec } from "../kit.js";
import { MODIFIER_KIT } from "../effects.js";

const { add, sub, mul, unit, len, cross } = vec;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const blend = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const isotropic = (r) => [r * r, r * r, r * r, 0, 0, 0];
const outer = (d) => [d[0] ** 2, d[1] ** 2, d[2] ** 2, d[0] * d[1], d[0] * d[2], d[1] * d[2]];
// Lane NR1: what each splat is made of, as shares of twelve materials. A stain says how each
// material takes it up (an ink color and a density), so one tree of splats takes all three
// stains. LIT is the bright slide around the cell (the lit section), CLEAR its unlit rim.
const MATERIALS = ["cyto", "nissl", "myelin", "fine", "nucleus", "nucleolus", "glia", "dendrite", "axon", "bouton", "lit", "clear"]; // prettier-ignore
const only = (name) => MATERIALS.map((m) => (m === name ? 1 : 0));
const CYTO = only("cyto"),
  NISSL = only("nissl"),
  SHEATH = only("myelin"),
  FINE = only("fine"),
  NUCLEUS = only("nucleus"),
  NUCLEOLUS = only("nucleolus"),
  GLIA = only("glia"),
  DENDRITE = only("dendrite"),
  AXON = only("axon"),
  BOUTON = only("bouton");
const LIT = MATERIALS.indexOf("lit"),
  CLEAR = MATERIALS.indexOf("clear");
const SOMA_MS = 4;
export const SPIKE_SECONDS = 4.6;
const MODEL_MS_PER_SECOND = 7;

function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sphere(r) {
  const z = 2 * r() - 1,
    angle = 2 * Math.PI * r(),
    radial = Math.sqrt(1 - z * z);
  return [radial * Math.cos(angle), radial * Math.sin(angle), z];
}
const volume = (r) => mul(sphere(r), Math.cbrt(r()));
const perpendicular = (d, r) => unit(cross(d, sphere(r)));

function needle(d, along, across) {
  const base = isotropic(across),
    delta = along * along - across * across;
  return outer(d).map((x, i) => base[i] + delta * x);
}

// Wandering, tapering neurites bifurcate in a plane perpendicular to their tip.
function branch(r, segments, tips, start, direction, length, radius, forks, distance) {
  const steps = Math.max(3, Math.round(length / 0.04)),
    step = length / steps;
  let p = start,
    d = direction,
    s = distance;
  for (let i = 0; i < steps; i++) {
    d = unit(add(d, mul(sphere(r), 0.2)));
    const q = add(p, mul(d, step));
    segments.push({ a: p, b: q, radius: radius * (1 - (0.3 * i) / steps), from: s, to: s + step });
    p = q;
    s += step;
  }
  if (!forks) {
    tips.push({ p, s, d });
    return;
  }
  const side = perpendicular(d, r);
  for (const sign of [-1, 1]) {
    const angle = 0.34 + 0.42 * r();
    const next = unit(add(mul(d, Math.cos(angle)), mul(side, sign * Math.sin(angle))));
    branch(r, segments, tips, p, next, length * (0.66 + 0.16 * r()), radius * 0.7, forks - 1, s);
  }
}

// Stratified allocation by length times radius keeps thin branches continuous.
function sampleTubes(r, segments, count, emit, shell = false) {
  const lengths = segments.map((g) => len(sub(g.b, g.a)));
  const weights = segments.map((g, i) => lengths[i] * g.radius);
  const total = weights.reduce((a, b) => a + b, 0);
  let j = 0,
    before = 0;
  for (let i = 0; i < count; i++) {
    const u = ((i + r()) * total) / count;
    while (j < segments.length - 1 && before + weights[j] < u) before += weights[j++];
    const g = segments[j],
      f = clamp((u - before) / weights[j]);
    const d = unit(sub(g.b, g.a)),
      gap = (lengths[j] * total) / (count * weights[j]);
    const across = g.radius * (shell ? 0.2 : 0.5);
    const p = add(
      blend(g.a, g.b, f),
      mul(perpendicular(d, r), shell ? g.radius : g.radius * 0.7 * Math.sqrt(r())),
    );
    emit(p, needle(d, Math.max(gap * 0.8, across * 1.4), across), g.from + (g.to - g.from) * f, g);
  }
}

export function growNeuron(seed = 1952, depth = 15) {
  // The supported Kit profiles keep at least 4,096 leaves; lower levels are merges.
  depth = clamp(Math.round(depth), 12, 15);
  const count = 2 ** depth,
    r = random(seed),
    leaves = [];
  const put = (m, S, k, delay, gain = 1, w = 1) => leaves.push({ m, S, k, delay, gain, w });
  const quota = (n, group = 1) => Math.max(group, Math.round((n * count) / 32768 / group) * group);
  const counts = {
    soma: quota(2600),
    nissl: quota(400, 10),
    nucleus: quota(440),
    nucleolus: quota(56),
    spines: quota(4200, 6),
    core: quota(2000),
    myelin: quota(6000, 5),
    glia: quota(300, 5),
    twigs: quota(2000),
    boutons: quota(2272, 16),
    field: quota(2048, 128),
  };
  counts.dendrites = count - Object.values(counts).reduce((a, b) => a + b, 0);
  const somaRadius = [0.17, 0.15, 0.14];
  for (let i = 0; i < counts.soma; i++) {
    const q = i % 5 < 2 ? mul(sphere(r), 0.94 + 0.06 * r()) : volume(r);
    put(
      q.map((v, k) => v * somaRadius[k]),
      isotropic(0.02),
      CYTO,
      SOMA_MS,
      1,
      0.34,
    );
  }
  for (let i = 0; i < counts.nissl / 10; i++) {
    let q = volume(r);
    while (len(q) < 0.5) q = volume(r);
    const at = q.map((v, k) => v * somaRadius[k] * 0.88);
    for (let j = 0; j < 10; j++)
      put(add(at, mul(volume(r), 0.016)), isotropic(0.006), NISSL, SOMA_MS, 1, 0.5);
  }
  const nucleus = [-0.02, 0.01, 0];
  for (let i = 0; i < counts.nucleus; i++) {
    const q = i % 3 ? mul(sphere(r), 0.92 + 0.08 * r()) : volume(r);
    put(add(nucleus, mul(q, 0.066)), isotropic(0.008), NUCLEUS, SOMA_MS, 1, 0.5);
  }
  for (let i = 0; i < counts.nucleolus; i++)
    put(
      add(add(nucleus, [0.012, -0.008, 0.01]), mul(volume(r), 0.016)),
      isotropic(0.006),
      NUCLEOLUS,
      SOMA_MS,
      1,
      1.3,
    );

  const dendrites = [],
    dendriteTips = [];
  for (const [degrees, forks] of [
    [60, 4],
    [104, 5],
    [148, 5],
    [194, 5],
    [238, 5],
    [292, 4],
  ]) {
    const angle = (degrees * Math.PI) / 180;
    const d = unit([Math.cos(angle), Math.sin(angle), (r() - 0.5) * 0.9]);
    branch(r, dendrites, dendriteTips, mul(d, 0.13), d, 0.33 + 0.08 * r(), 0.03, forks, 0.13);
  }
  const reach = Math.max(...dendriteTips.map((tip) => tip.s));
  const arrival = (s) => SOMA_MS * (1 - s / reach) - 0.001;
  sampleTubes(r, dendrites, counts.dendrites, (p, S, s) => put(p, S, DENDRITE, arrival(s), 0.42));
  const thin = dendrites.filter((g) => g.radius < 0.017);
  for (let i = 0; i < counts.spines / 6; i++) {
    const g = thin[Math.floor(r() * thin.length)],
      f = r();
    const out = perpendicular(unit(sub(g.b, g.a)), r);
    const base = add(blend(g.a, g.b, f), mul(out, g.radius)),
      length = 0.016 + 0.018 * r();
    const when = arrival(g.from + (g.to - g.from) * f);
    for (const fraction of [0.3, 0.7])
      put(
        add(base, mul(out, length * fraction)),
        needle(out, length * 0.28, 0.0024),
        FINE,
        when,
        0.42,
        0.7,
      );
    for (let j = 0; j < 4; j++)
      put(
        add(add(base, mul(out, length)), mul(volume(r), 0.005)),
        isotropic(0.0042),
        FINE,
        when,
        0.42,
        0.7,
      );
  }

  // Hillock, five myelinated internodes, and their bare nodes of Ranvier.
  const core = [],
    sheaths = [];
  let p = [0.14, 0, 0],
    direction = [1, 0, 0],
    time = SOMA_MS;
  const run = (length, r0, r1, end, sheath, bare) => {
    const steps = Math.round(length / 0.02);
    for (let i = 0; i < steps; i++) {
      direction = unit(
        add(direction, [0, (r() - 0.5) * 0.07 - p[1] * 0.03, (r() - 0.5) * 0.07 - p[2] * 0.03]),
      );
      const q = add(p, mul(direction, length / steps));
      const segment = {
        a: p,
        b: q,
        radius: r0 + ((r1 - r0) * i) / steps,
        from: time + ((end - time) * i) / steps,
        to: time + ((end - time) * (i + 1)) / steps,
        bare,
      };
      core.push(segment);
      if (sheath)
        sheath.push({ ...segment, radius: 0.056 * Math.sin((Math.PI * (i + 0.5)) / steps) ** 0.4 });
      p = q;
    }
    time = end;
  };
  run(0.1, 0.07, 0.03, time + 0.2, null, false);
  run(0.1, 0.03, 0.019, time + 0.2, null, false);
  for (let i = 0; i < 5; i++) {
    const sheath = [];
    run(0.4, 0.018, 0.018, time + 0.25, sheath, false);
    sheaths.push(sheath);
    run(0.048, 0.02, 0.02, time + 1.25, null, true);
  }
  sampleTubes(r, core, counts.core, (p, S, delay, g) => put(p, S, g.bare ? FINE : AXON, delay));
  for (const sheath of sheaths) {
    sampleTubes(
      r,
      sheath,
      counts.myelin / 5,
      (p, S, delay) => put(p, S, SHEATH, delay, 0.6, 0.8),
      true,
    );
    const mid = sheath[sheath.length >> 1];
    const at = add(mid.a, mul(perpendicular(unit(sub(mid.b, mid.a)), r), mid.radius + 0.012));
    for (let i = 0; i < counts.glia / 5; i++) {
      const q = volume(r);
      put(
        add(at, [q[0] * 0.034, q[1] * 0.014, q[2] * 0.014]),
        isotropic(0.006),
        GLIA,
        mid.from,
        0.3,
        0.7,
      );
    }
  }
  const terminals = [],
    tips = [];
  branch(r, terminals, tips, p, direction, 0.24, 0.015, 4, 0);
  const terminalArrival = (s) => time + 0.001 + s / 0.45;
  sampleTubes(r, terminals, counts.twigs, (p, S, s) => put(p, S, FINE, terminalArrival(s)));
  for (let i = 0; i < counts.boutons; i++) {
    const tip = tips[i % tips.length];
    const q = i % 3 ? mul(sphere(r), 0.9 + 0.1 * r()) : volume(r);
    put(add(tip.p, mul(q, 0.03)), isotropic(0.006), BOUTON, terminalArrival(tip.s), 1, 0.8);
  }
  const last = Math.max(...leaves.map((s) => s.delay));
  const spread = Math.max(...dendriteTips.map((tip) => len(tip.p)));
  litField(leaves, counts.field);
  if (leaves.length !== count)
    throw new Error("The neuron's component counts do not match its budget.");
  // Normalize the mathematical distribution once, before making any focus level.
  const moments = gaussianMoments(leaves);
  let extent = 0;
  for (const s of leaves)
    extent = Math.max(extent, ...s.m.map((x, k) => Math.abs(x - moments.m[k])));
  const scale = 1 / extent;
  for (const s of leaves) {
    s.m = mul(sub(s.m, moments.m), scale);
    s.S = s.S.map((x) => x * scale * scale);
    s.w /= moments.w;
  }
  // Where the cell body and the dendrites' reach land after normalizing (for a tap's stimulus).
  return { leaves, last, soma: mul(sub([0, 0, 0], moments.m), scale), reach: spread * scale };
}

// The lit slide behind the cell: a grid of flat splats (a power of two, so it fills its quota at
// every budget), opaque inside and fading at a rounded rim. It is part of the specimen,
// so focus merges it with the cell, and it neither fires nor takes a stain's dye.
function litField(leaves, n) {
  const lo = [Infinity, Infinity, Infinity],
    hi = [-Infinity, -Infinity, -Infinity];
  for (const s of leaves)
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], s.m[k]);
      hi[k] = Math.max(hi[k], s.m[k]);
    }
  const rows = 2 ** Math.floor(Math.log2(n) / 2),
    cols = n / rows;
  const pad = 0.12 * (hi[0] - lo[0]),
    cx = (lo[0] + hi[0]) / 2,
    cy = (lo[1] + hi[1]) / 2;
  const w = hi[0] - lo[0] + 2 * pad,
    h = Math.max(hi[1] - lo[1] + 2 * pad, w / 2.2);
  const hx = w / cols,
    hy = h / rows,
    z = lo[2] - 0.08,
    corner = 0.3 * h;
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const x = cx - w / 2 + (j + 0.5) * hx,
        y = cy - h / 2 + (i + 0.5) * hy;
      // Distance inside the rounded rectangle's edge, so the rim fades evenly.
      const qx = Math.max(Math.abs(x - cx) - (w / 2 - corner), 0),
        qy = Math.max(Math.abs(y - cy) - (h / 2 - corner), 0);
      const inside = corner - Math.hypot(qx, qy) + Math.min(Math.max(Math.abs(x - cx) - (w / 2 - corner), Math.abs(y - cy) - (h / 2 - corner)), 0); // prettier-ignore
      const lit = clamp(inside / (0.6 * Math.max(hx, hy)));
      const k = MATERIALS.map(() => 0);
      k[LIT] = lit;
      k[CLEAR] = 1 - lit;
      // Narrower across the last rows, so the rim stays crisp at a phone's coarser grid.
      const sx = hx * clamp(Math.min(j + 0.5, cols - j - 0.5) / 2.5, 0.4, 1),
        sy = hy * clamp(Math.min(i + 0.5, rows - i - 0.5) / 2.5, 0.4, 1);
      leaves.push({ m: [x, y, z], S: [sx * sx, sy * sy, 1e-6, 0, 0, 0], k, delay: SOMA_MS, gain: 0, w: 0.8 }); // prettier-ignore
    }
}

export function mergeGaussians(a, b) {
  const w = a.w + b.w,
    fa = a.w / w,
    fb = b.w / w;
  const m = add(mul(a.m, fa), mul(b.m, fb));
  const da = outer(sub(a.m, m)),
    db = outer(sub(b.m, m));
  return {
    w,
    m,
    S: a.S.map((x, i) => fa * (x + da[i]) + fb * (b.S[i] + db[i])),
    k: a.k.map((x, i) => fa * x + fb * b.k[i]),
    delay: fa * a.delay + fb * b.delay,
    gain: fa * a.gain + fb * b.gain,
  };
}

export function gaussianMoments(splats) {
  const w = splats.reduce((sum, s) => sum + s.w, 0);
  const m = [0, 1, 2].map((i) => splats.reduce((sum, s) => sum + s.w * s.m[i], 0) / w);
  const S = [0, 0, 0, 0, 0, 0];
  for (const s of splats) {
    const displacement = outer(sub(s.m, m));
    for (let i = 0; i < 6; i++) S[i] += (s.w * (s.S[i] + displacement[i])) / w;
  }
  return { w, m, S };
}

export function buildFocusTree(leaves) {
  const depth = Math.log2(leaves.length);
  if (!Number.isInteger(depth) || !leaves.length)
    throw new Error("Focus needs a power-of-two leaf count.");
  const nodes = new Array(leaves.length * 2),
    order = Int32Array.from(leaves, (_, i) => i);
  const visit = (index, lo, hi) => {
    if (hi - lo === 1) {
      nodes[index] = leaves[order[lo]];
      return;
    }
    let axis = 0,
      greatest = -1;
    for (let k = 0; k < 3; k++) {
      let sum = 0,
        sum2 = 0;
      for (let j = lo; j < hi; j++) {
        const x = leaves[order[j]].m[k];
        sum += x;
        sum2 += x * x;
      }
      const spread = sum2 - (sum * sum) / (hi - lo);
      if (spread > greatest) {
        greatest = spread;
        axis = k;
      }
    }
    order.subarray(lo, hi).sort((a, b) => leaves[a].m[axis] - leaves[b].m[axis]);
    const mid = (lo + hi) >> 1;
    visit(index * 2, lo, mid);
    visit(index * 2 + 1, mid, hi);
    nodes[index] = mergeGaussians(nodes[index * 2], nodes[index * 2 + 1]);
  };
  visit(1, 0, leaves.length);
  return { nodes, depth };
}

// Jacobi diagonalization retains off-diagonal covariance, including rotated merges.
export function covarianceAxes(S) {
  const a = [
    [S[0], S[3], S[4]],
    [S[3], S[1], S[5]],
    [S[4], S[5], S[2]],
  ];
  const v = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  for (let iteration = 0; iteration < 24; iteration++) {
    let p = 0,
      q = 1;
    for (const [i, j] of [
      [0, 2],
      [1, 2],
    ])
      if (Math.abs(a[i][j]) > Math.abs(a[p][q])) {
        p = i;
        q = j;
      }
    if (Math.abs(a[p][q]) < 1e-15) break;
    const angle = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]),
      c = Math.cos(angle),
      s = Math.sin(angle);
    const app = a[p][p],
      aqq = a[q][q],
      apq = a[p][q];
    a[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
    a[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
    a[p][q] = a[q][p] = 0;
    for (let k = 0; k < 3; k++) {
      if (k !== p && k !== q) {
        const kp = a[k][p],
          kq = a[k][q];
        a[k][p] = a[p][k] = c * kp - s * kq;
        a[k][q] = a[q][k] = s * kp + c * kq;
      }
      const kp = v[k][p],
        kq = v[k][q];
      v[k][p] = c * kp - s * kq;
      v[k][q] = s * kp + c * kq;
    }
  }
  // Convert the right-handed eigenbasis to the Kit's [x, y, z, w] quaternion.
  const trace = v[0][0] + v[1][1] + v[2][2];
  let quat;
  if (trace > 0) {
    const s = 2 * Math.sqrt(trace + 1);
    quat = [(v[2][1] - v[1][2]) / s, (v[0][2] - v[2][0]) / s, (v[1][0] - v[0][1]) / s, s / 4];
  } else {
    let i = 0;
    if (v[1][1] > v[i][i]) i = 1;
    if (v[2][2] > v[i][i]) i = 2;
    const j = (i + 1) % 3,
      k = (i + 2) % 3;
    const s = 2 * Math.sqrt(1 + v[i][i] - v[j][j] - v[k][k]);
    quat = [0, 0, 0, (v[k][j] - v[j][k]) / s];
    quat[i] = s / 4;
    quat[j] = (v[j][i] + v[i][j]) / s;
    quat[k] = (v[k][i] + v[i][k]) / s;
  }
  return { scales: a.map((row, i) => Math.sqrt(Math.max(row[i], 1e-16))), quat };
}

// The reference's squid giant axon model: Euler, dt = 0.01 ms, sampled at 0.1 ms.
export function hodgkinHuxley({ current = 20 } = {}) {
  const ratio = (x) => (Math.abs(x) < 1e-7 ? 10 : x / -Math.expm1(-x / 10));
  const rates = (v) => [
    0.01 * ratio(v + 55),
    0.125 * Math.exp(-(v + 65) / 80),
    0.1 * ratio(v + 40),
    4 * Math.exp(-(v + 65) / 18),
    0.07 * Math.exp(-(v + 65) / 20),
    1 / (1 + Math.exp(-(v + 35) / 10)),
  ];
  let v = -65;
  const initial = rates(v);
  let n = initial[0] / (initial[0] + initial[1]),
    m = initial[2] / (initial[2] + initial[3]),
    h = initial[4] / (initial[4] + initial[5]);
  const trace = [];
  for (let i = 0; i <= 1600; i++) {
    if (i % 10 === 0) trace.push(v);
    const [an, bn, am, bm, ah, bh] = rates(v);
    const dv =
      (i < 100 ? current : 0) -
      120 * m ** 3 * h * (v - 50) -
      36 * n ** 4 * (v + 77) -
      0.3 * (v + 54.387);
    n += 0.01 * (an * (1 - n) - bn * n);
    m += 0.01 * (am * (1 - m) - bm * m);
    h += 0.01 * (ah * (1 - h) - bh * h);
    v += 0.01 * dv;
  }
  return { trace, step: 0.1, rest: -65, peak: Math.max(...trace), trough: Math.min(...trace) };
}

const WAVE = hodgkinHuxley();
export function spikeAt(ms, delay, gain, wave = WAVE) {
  const index = (ms - delay) / wave.step;
  if (index <= 0 || index >= wave.trace.length - 1) return 0;
  const i = Math.floor(index),
    v = wave.trace[i] + (wave.trace[i + 1] - wave.trace[i]) * (index - i);
  return clamp((v - wave.rest) / (wave.peak - wave.rest)) * gain;
}

export const focusLevel = (value, depth) =>
  Math.round(clamp(Number.isFinite(value) ? value : 1) * depth);

// Lane NR1: the three stains as a histology atlas shows them on a bright slide. Each material has
// the color it lets through (ink) and how strongly it takes the stain (density; an unstained
// part is a faint ghost). Nissl (cresyl violet) dyes the cell body's Nissl bodies, nucleolus and
// glial nuclei and leaves the axon hillock, axon, and myelin nearly clear. Golgi (silver
// chromate) blackens the whole neuron, spines and all, on an amber field, and leaves myelin
// unstained. H&E turns cytoplasm and neuropil pink and nuclei blue-purple. The spike color is
// chosen to stand out on each.
const ink = (o) => MATERIALS.map((m) => o[m] ?? o.cyto);
const STAINS = {
  nissl: {
    ink: ink({ cyto: [0.6, 0.4, 0.8], nissl: [0.3, 0.11, 0.5], myelin: [0.84, 0.8, 0.92], fine: [0.7, 0.58, 0.86], nucleus: [0.84, 0.76, 0.93], nucleolus: [0.22, 0.07, 0.4], glia: [0.3, 0.13, 0.5], dendrite: [0.64, 0.47, 0.83], axon: [0.8, 0.71, 0.9], bouton: [0.72, 0.6, 0.87], lit: [0.94, 0.93, 0.97], clear: [0.94, 0.93, 0.97] }), // prettier-ignore
    dens: ink({ cyto: 1, nissl: 1.4, myelin: 0.6, fine: 0.6, nucleus: 0.6, nucleolus: 1.6, glia: 1.4, dendrite: 0.85, axon: 0.6, bouton: 0.6 }), // prettier-ignore
    field: [0.94, 0.93, 0.97],
    spike: [1.0, 0.5, 0.0],
  },
  golgi: {
    ink: ink({ cyto: [0.08, 0.06, 0.04], myelin: [0.8, 0.64, 0.36], fine: [0.11, 0.08, 0.05], dendrite: [0.09, 0.07, 0.05], axon: [0.14, 0.1, 0.06], bouton: [0.12, 0.09, 0.05], glia: [0.62, 0.46, 0.24], lit: [0.92, 0.77, 0.46], clear: [0.92, 0.77, 0.46] }), // prettier-ignore
    dens: ink({ cyto: 1.7, myelin: 0.5, fine: 1.4, dendrite: 1.5, axon: 1.2, bouton: 1.3, glia: 0.5 }), // prettier-ignore
    field: [0.92, 0.77, 0.46],
    spike: [0.0, 0.8, 1.0],
  },
  he: {
    ink: ink({ cyto: [0.8, 0.45, 0.66], nissl: [0.5, 0.28, 0.62], myelin: [0.94, 0.75, 0.85], fine: [0.88, 0.58, 0.74], nucleus: [0.78, 0.68, 0.88], nucleolus: [0.26, 0.15, 0.5], glia: [0.24, 0.19, 0.52], dendrite: [0.85, 0.5, 0.69], axon: [0.84, 0.48, 0.66], bouton: [0.85, 0.53, 0.71], lit: [0.97, 0.86, 0.91], clear: [0.97, 0.86, 0.91] }), // prettier-ignore
    dens: ink({ cyto: 1, nissl: 1.2, myelin: 0.45, fine: 0.55, nucleus: 0.6, nucleolus: 1.5, glia: 1.4, dendrite: 0.8, axon: 0.8, bouton: 0.6 }), // prettier-ignore
    field: [0.97, 0.86, 0.91],
    spike: [0.05, 0.62, 0.62],
  },
};

// How one splat of the tree looks under a stain. Its cell part absorbs light by its projected
// optical depth (mass times density over area), as the concept draws it. The finest splats of the
// lit slide are the lamp: they stay drawn at every focus (see the shader's gate), so a merged
// splat shows only its cell part, absorbing over that light. Coarse splats spread the same mass
// over a larger area, so they are paler and softer, as a slide looks out of focus.
export function stainLook(s, stain = STAINS.nissl, leaf = true) {
  const lit = s.k[LIT],
    clear = s.k[CLEAR],
    cell = 1 - lit - clear;
  const log = [0, 0, 0];
  let density = 0;
  if (cell > 1e-9)
    for (let i = 0; i < MATERIALS.length; i++) {
      if (i === LIT || i === CLEAR || !s.k[i]) continue;
      const share = s.k[i] / cell;
      for (let j = 0; j < 3; j++) log[j] += share * Math.log(stain.ink[i][j]);
      density += share * stain.dens[i];
    }
  const cellColor = cell > 1e-9 ? log.map(Math.exp) : stain.field;
  const area = Math.sqrt(Math.max(s.S[0] * s.S[1] - s.S[3] ** 2, 1e-16));
  const absorb = 1 - Math.exp((-0.7 * s.w * Math.max(cell, 0) * density) / (2 * Math.PI * area));
  if (!leaf) return { color: cellColor, opacity: cell > 1e-9 ? absorb : 0 };
  const field = lit + clear > 1e-9 ? lit / (lit + clear) : 0;
  return {
    color: field > 0 ? blend(stain.field, cellColor, absorb) : cellColor,
    opacity: 1 - (1 - absorb) * (1 - field),
  };
}

// A tap's point rides on morph channels 2 and 3: x and z packed in thousandths, then y. No tap
// (the Play button) puts y far outside the specimen.
export function packTap(point) {
  if (!point) return [0, 99];
  const q = (v) => Math.round((clamp(v, -2, 2) + 2) * 1000);
  return [q(point[0]) + 4096 * q(point[2]), clamp(point[1], -2, 2)];
}

// Reuse all normal Kit effects. The toy adds a focus crossfade between neighboring levels, the
// delayed HH wave, and a stimulus where a tap lands that spreads through the dendrites.
// The same precomputed membrane trace is interpolated by both GPU backends.
export function neuronModifier(o = {}, transform = null) {
  const values = WAVE.trace
    .map((v) => ((v - WAVE.rest) / (WAVE.peak - WAVE.rest)).toFixed(8))
    .join(",");
  const f = (v) => Number(v).toFixed(6);
  const v3 = (a) => a.map(f).join(", ");
  const fit = transform && Number.isFinite(transform.scale) ? transform : { center: [0, 0, 0], scale: 1 }; // prettier-ignore
  const cell = cached || { soma: [0, 0, 0], reach: 0, depth: 15 };
  const depth = cell.depth;
  const spike = (STAINS[o.stain] || STAINS.nissl).spike;
  const glslWave = `
vec4 nfAn;
float nfAct = 0.0;
float nfStim = 0.0;
float nfWeight = 1.0;
const float nfWave[161] = float[161](${values});
float nfActivation(float delay, float gain) {
  float x = (uSpMorph.x - delay) * 10.0;
  if (x <= 0.0 || x >= 160.0) return 0.0;
  int i = int(floor(x));
  return clamp(mix(nfWave[i], nfWave[i+1], fract(x)), 0.0, 1.0) * gain;
}
void nfStart(vec3 rest) {
  nfAn = loadSplatAnim();
  vec3 rc = rest / ${f(fit.scale)} + vec3(${v3(fit.center)});
  float lo = floor(uSpMorph.y), fr = uSpMorph.y - lo, level = mod(nfAn.x, 16.0);
  nfWeight = abs(level - lo) < 0.1 ? min(1.0, 2.0 - 2.0 * fr) : abs(level - lo - 1.0) < 0.1 ? min(1.0, 2.0 * fr) : 0.0;
  if (nfAn.w <= 0.0 && level > ${f(depth - 0.5)}) nfWeight = 1.0;
  float delay = nfAn.z;
  float qz = floor(uSpMorph.z / 4096.0);
  vec3 tap = vec3((uSpMorph.z - 4096.0 * qz) / 1000.0 - 2.0, uSpMorph.w, qz / 1000.0 - 2.0);
  nfStim = 0.0;
  if (uSpMorph.w < 50.0) {
    float toSoma = distance(tap, vec3(${v3(cell.soma)}));
    if (toSoma < ${f(cell.reach * 1.15)} && delay < ${f(SOMA_MS - 1e-4)} && nfAn.w > 0.0)
      delay = ${f(SOMA_MS)} * clamp(distance(rc, tap) / max(toSoma, 0.06), 0.0, 1.0) - 0.001;
    float ms = uSpMorph.x;
    if (ms >= 0.0 && ms < 3.0) {
      float r = 0.05 + 0.07 * ms / 3.0;
      nfStim = (1.0 - ms / 3.0) * (1.0 - smoothstep(0.4 * r, r, distance(rc, tap)));
    }
  }
  nfAct = nfActivation(delay, nfAn.w);
}
`;
  const wgslWave = `
var<private> nfAn: vec4f;
var<private> nfAct: f32 = 0.0;
var<private> nfStim: f32 = 0.0;
var<private> nfWeight: f32 = 1.0;
const nfWave = array<f32, 161>(${values});
fn nfActivation(delay: f32, gain: f32) -> f32 {
  let x = (uniform.uSpMorph.x - delay) * 10.0;
  if (x <= 0.0 || x >= 160.0) { return 0.0; }
  let i = i32(floor(x));
  return clamp(mix(nfWave[i], nfWave[i+1], fract(x)), 0.0, 1.0) * gain;
}
fn nfStart(rest: vec3f) {
  nfAn = loadSplatAnim();
  let m = uniform.uSpMorph;
  let rc = rest / ${f(fit.scale)} + vec3f(${v3(fit.center)});
  let lo = floor(m.y);
  let fr = m.y - lo;
  let level = nfAn.x - 16.0 * floor(nfAn.x / 16.0);
  nfWeight = select(select(0.0, min(1.0, 2.0 * fr), abs(level - lo - 1.0) < 0.1), min(1.0, 2.0 - 2.0 * fr), abs(level - lo) < 0.1);
  if (nfAn.w <= 0.0 && level > ${f(depth - 0.5)}) { nfWeight = 1.0; }
  var delay = nfAn.z;
  let qz = floor(m.z / 4096.0);
  let tap = vec3f((m.z - 4096.0 * qz) / 1000.0 - 2.0, m.w, qz / 1000.0 - 2.0);
  nfStim = 0.0;
  if (m.w < 50.0) {
    let toSoma = distance(tap, vec3f(${v3(cell.soma)}));
    if (toSoma < ${f(cell.reach * 1.15)} && delay < ${f(SOMA_MS - 1e-4)} && nfAn.w > 0.0) {
      delay = ${f(SOMA_MS)} * clamp(distance(rc, tap) / max(toSoma, 0.06), 0.0, 1.0) - 0.001;
    }
    if (m.x >= 0.0 && m.x < 3.0) {
      let r = 0.05 + 0.07 * m.x / 3.0;
      nfStim = (1.0 - m.x / 3.0) * (1.0 - smoothstep(0.4 * r, r, distance(rc, tap)));
    }
  }
  nfAct = nfActivation(delay, nfAn.w);
}
`;
  // Firing splats take the spike color and swell a little, like a glow; the stimulus is a glow in
  // the same color under the tap. Both stay inside the crossfade weight.
  const glslColor = `
 float nfA = clamp(nfAct * 1.6, 0.0, 1.0);
 color.rgb = mix(color.rgb, vec3(${v3(spike)}), nfA);
 color.rgb = mix(color.rgb, vec3(${v3(spike)}), nfStim);
 color.a = max(max(color.a, 0.9 * nfA), nfStim) * nfWeight;`;
  const wgslColor = `
 let nfA = clamp(nfAct * 1.6, 0.0, 1.0);
 (*color) = vec4f(mix(mix((*color).rgb, vec3f(${v3(spike)}), nfA), vec3f(${v3(spike)}), nfStim), max(max((*color).a, 0.9 * nfA), nfStim) * nfWeight);`;
  return {
    glsl: MODIFIER_KIT.glsl
      .replace(
        "void modifySplatCenter(inout vec3 center) {",
        glslWave + "void modifySplatCenter(inout vec3 center) { nfStart(center);",
      )
      .replace(
        "if (spCut > 0.5) scale = vec3(0.0);",
        "if (spCut > 0.5 || nfWeight < 0.001) scale = vec3(0.0); else scale *= 1.0 + 0.3 * clamp(nfAct, 0.0, 1.0) + 0.4 * nfStim;",
      )
      .replace(
        "void modifySplatColor(vec3 center, inout vec4 color) {",
        "void modifySplatColor(vec3 center, inout vec4 color) {" + glslColor,
      ),
    wgsl: MODIFIER_KIT.wgsl
      .replace(
        "fn modifySplatCenter(center: ptr<function, vec3f>) {",
        wgslWave + "fn modifySplatCenter(center: ptr<function, vec3f>) { nfStart(*center);",
      )
      .replace(
        "if (spCut > 0.5) { *scale = vec3f(0.0); }",
        "if (spCut > 0.5 || nfWeight < 0.001) { *scale = vec3f(0.0); } else { *scale = *scale * (1.0 + 0.3 * clamp(nfAct, 0.0, 1.0) + 0.4 * nfStim); }",
      )
      .replace(
        "fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {",
        "fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {" + wgslColor,
      ),
  };
}

// Keep a single profile's tree and axes, so a stain change doesn't regrow the cell.
let cached;
function specimen(depth) {
  if (cached?.depth === depth) return cached;
  const cell = growNeuron(1952, depth),
    tree = buildFocusTree(cell.leaves);
  const axes = tree.nodes.map((s) => covarianceAxes(s.S));
  cached = { ...tree, axes, last: cell.last, soma: cell.soma, reach: cell.reach };
  return cached;
}

export const RECIPES = {
  "specimen-neuron": {
    seed: 1952,
    alive: true,
    turntable: false,
    density: 0.35,
    options: [
      {
        key: "stain",
        label: "Stain",
        type: "select",
        default: "nissl",
        choices: [
          { id: "nissl", label: "Nissl · cresyl violet" },
          { id: "golgi", label: "Golgi · silver, black on amber" },
          { id: "he", label: "H&E · pink and blue-purple" },
        ],
      },
    ],
    controls: [
      { key: "focus", label: "Focus", type: "slider", default: 1 },
      // Every tap starts a new spike, including after the visible wave's quiet tail.
      { key: "fire", label: "Fire a spike", type: "pulse", ease: SPIKE_SECONDS, pausable: false },
    ],
    action: { key: "fire", label: "Fire a spike" },
    credits: [
      {
        label:
          "From a concept by Ryan Kamp. Procedural specimen made by Ryan with Codex (GPT-6) and Claude (Opus 5.5); CC0. Code: MIT.",
      },
      {
        label:
          "Hodgkin-Huxley model (1952): squid giant axon; slowed for viewing. Stain colors follow textbook histology.",
        url: "https://en.wikipedia.org/wiki/Hodgkin%E2%80%93Huxley_model",
      },
    ],
    gpuField: neuronModifier,
    drive(t, c, out, info) {
      const depth = info?.data?.depth ?? 15;
      const ms = c.fire > 0 ? (1 - c.fire) * SPIKE_SECONDS * MODEL_MS_PER_SECOND : -100;
      // Focus glides: the two neighboring levels crossfade, so the slide comes into focus
      // smoothly instead of jumping a level at a time.
      const level = clamp(Number.isFinite(c.focus) ? c.focus : 1) * depth,
        lo = Math.floor(level);
      const tap = c.fire > 0 && info?.tap?.key === "fire" ? info.tap.point : null;
      out.morph = [ms, level, ...packTap(tap)];
      // Parts show the same two levels as the GPU gate (which also handles the root), and the
      // finest, whose lit slide stays on.
      for (let i = 1; i <= depth; i++)
        out.parts[`focus${i}`] = { visible: i === lo || i === lo + 1 || i === depth ? 1 : 0 };
    },
    build(k, o) {
      const depth = clamp(Math.floor(Math.log2(k.count + 1)) - 1, 12, 15);
      const cell = specimen(depth),
        stain = STAINS[o.stain] || STAINS.nissl;
      k.data = {
        depth,
        last: cell.last,
        visibleCount: 2 ** depth,
        moments: Array.from({ length: depth + 1 }, (_, level) =>
          gaussianMoments(cell.nodes.slice(2 ** level, 2 ** (level + 1))),
        ),
      };
      for (let level = 0; level <= depth; level++) {
        const part = level ? k.part(`focus${level}`) : 0;
        k.cloud({ share: 2 ** level / k.count, jitter: 0, pattern: false }, (_rand, i) => {
          const index = 2 ** level + i,
            s = cell.nodes[index],
            axes = cell.axes[index];
          // The mass stays in the tree; the stain only decides how it looks.
          const { color, opacity } = stainLook(s, stain, level === depth);
          return {
            p: s.m,
            scales: axes.scales,
            quat: axes.quat,
            color,
            opacity,
            part,
            kind: "none",
            params: [s.delay, s.gain],
          };
        });
      }
    },
  },
};

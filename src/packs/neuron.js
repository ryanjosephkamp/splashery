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
const BODY = [1, 0, 0, 0],
  DEEP = [0, 1, 0, 0],
  SHEATH = [0, 0, 1, 0],
  FINE = [0, 0, 0, 1];
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
    myelin: quota(7500, 5),
    glia: quota(300, 5),
    twigs: quota(2000),
    boutons: quota(2272, 16),
  };
  counts.dendrites = count - Object.values(counts).reduce((a, b) => a + b, 0);
  const somaRadius = [0.17, 0.15, 0.14];
  for (let i = 0; i < counts.soma; i++) {
    const q = i % 5 < 2 ? mul(sphere(r), 0.94 + 0.06 * r()) : volume(r);
    put(
      q.map((v, k) => v * somaRadius[k]),
      isotropic(0.02),
      BODY,
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
      put(add(at, mul(volume(r), 0.016)), isotropic(0.006), DEEP, SOMA_MS, 1, 0.5);
  }
  const nucleus = [-0.02, 0.01, 0];
  for (let i = 0; i < counts.nucleus; i++) {
    const q = i % 3 ? mul(sphere(r), 0.92 + 0.08 * r()) : volume(r);
    put(add(nucleus, mul(q, 0.066)), isotropic(0.008), DEEP, SOMA_MS, 1, 0.5);
  }
  for (let i = 0; i < counts.nucleolus; i++)
    put(
      add(add(nucleus, [0.012, -0.008, 0.01]), mul(volume(r), 0.016)),
      isotropic(0.006),
      DEEP,
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
  sampleTubes(r, dendrites, counts.dendrites, (p, S, s) => put(p, S, BODY, arrival(s), 0.42));
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
  sampleTubes(r, core, counts.core, (p, S, delay, g) => put(p, S, g.bare ? FINE : BODY, delay));
  for (const sheath of sheaths) {
    sampleTubes(
      r,
      sheath,
      counts.myelin / 5,
      (p, S, delay) => put(p, S, SHEATH, delay, 0.9, 0.8),
      true,
    );
    const mid = sheath[sheath.length >> 1];
    const at = add(mid.a, mul(perpendicular(unit(sub(mid.b, mid.a)), r), mid.radius + 0.012));
    for (let i = 0; i < counts.glia / 5; i++) {
      const q = volume(r);
      put(
        add(at, [q[0] * 0.034, q[1] * 0.014, q[2] * 0.014]),
        isotropic(0.006),
        DEEP,
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
    put(add(tip.p, mul(q, 0.03)), isotropic(0.006), DEEP, terminalArrival(tip.s), 1, 0.8);
  }
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
  return { leaves, last: Math.max(...leaves.map((s) => s.delay)) };
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
const STAINS = {
  nissl: [
    [0.36, 0.18, 0.58],
    [0.19, 0.1, 0.42],
    [0.2, 0.54, 0.66],
    [0.4, 0.2, 0.6],
  ],
  golgi: [
    [0.2, 0.13, 0.07],
    [0.12, 0.08, 0.05],
    [0.46, 0.33, 0.16],
    [0.2, 0.13, 0.07],
  ],
  he: [
    [0.93, 0.46, 0.66],
    [0.3, 0.2, 0.56],
    [0.97, 0.74, 0.84],
    [0.9, 0.4, 0.62],
  ],
};

// Reuse all normal Kit effects. Only the focus gate and delayed HH color wave are added.
// The same precomputed membrane trace is interpolated by both GPU backends.
export function neuronModifier() {
  const values = WAVE.trace
    .map((v) => ((v - WAVE.rest) / (WAVE.peak - WAVE.rest)).toFixed(8))
    .join(",");
  const glslWave = `
vec4 nfAn;
const float nfWave[161] = float[161](${values});
float nfActivation() {
  vec4 an = nfAn;
  float x = (uSpMorph.x - an.z) * 10.0;
  if (x <= 0.0 || x >= 160.0) return 0.0;
  int i = int(floor(x));
  return clamp(mix(nfWave[i], nfWave[i+1], fract(x)), 0.0, 1.0) * an.w;
}
`;
  const wgslWave = `
var<private> nfAn: vec4f;
const nfWave = array<f32, 161>(${values});
fn nfActivation() -> f32 {
  let an = nfAn;
  let x = (uniform.uSpMorph.x - an.z) * 10.0;
  if (x <= 0.0 || x >= 160.0) { return 0.0; }
  let i = i32(floor(x));
  return clamp(mix(nfWave[i], nfWave[i+1], fract(x)), 0.0, 1.0) * an.w;
}
`;
  return {
    glsl: MODIFIER_KIT.glsl
      .replace(
        "void modifySplatCenter(inout vec3 center) {",
        glslWave + "void modifySplatCenter(inout vec3 center) { nfAn = loadSplatAnim();",
      )
      .replace(
        "if (spCut > 0.5) scale = vec3(0.0);",
        "if (spCut > 0.5 || abs(mod(nfAn.x, 16.0) - uSpMorph.y) > 0.1) scale = vec3(0.0);",
      )
      .replace(
        "void modifySplatColor(vec3 center, inout vec4 color) {",
        "void modifySplatColor(vec3 center, inout vec4 color) {\n float nfAct = nfActivation();\n color.rgb = mix(color.rgb, vec3(1.0, 0.22, 0.06), clamp(nfAct * 1.6, 0.0, 1.0));\n color.rgb *= 1.0 + 1.4 * nfAct;",
      ),
    wgsl: MODIFIER_KIT.wgsl
      .replace(
        "fn modifySplatCenter(center: ptr<function, vec3f>) {",
        wgslWave + "fn modifySplatCenter(center: ptr<function, vec3f>) { nfAn = loadSplatAnim();",
      )
      .replace(
        "if (spCut > 0.5) { *scale = vec3f(0.0); }",
        "if (spCut > 0.5 || abs((nfAn.x % 16.0) - uniform.uSpMorph.y) > 0.1) { *scale = vec3f(0.0); }",
      )
      .replace(
        "var base = (*color).rgb;",
        "let nfAct = nfActivation();\n var base = mix((*color).rgb, vec3f(1.0, 0.22, 0.06), clamp(nfAct * 1.6, 0.0, 1.0)) * (1.0 + 1.4 * nfAct);",
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
  cached = { ...tree, axes, last: cell.last };
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
          { id: "nissl", label: "Nissl · purple and teal" },
          { id: "golgi", label: "Golgi · brown" },
          { id: "he", label: "H&E · pink and purple" },
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
          "From a concept by Ryan Kamp. Procedural specimen made by Ryan with Codex (GPT-6); CC0. Code: MIT.",
      },
      {
        label:
          "Hodgkin-Huxley model (1952): squid giant axon; slowed for viewing. Stains are illustrative colors.",
        url: "https://en.wikipedia.org/wiki/Hodgkin%E2%80%93Huxley_model",
      },
    ],
    gpuField: neuronModifier,
    drive(t, c, out, info) {
      const depth = info?.data?.depth ?? 15;
      const ms = c.fire > 0 ? (1 - c.fire) * SPIKE_SECONDS * MODEL_MS_PER_SECOND : -100;
      const level = focusLevel(c.focus, depth);
      out.morph = [ms, level, 0, 0];
      // Parts select the same level as the GPU gate (which also handles the root).
      for (let i = 1; i <= depth; i++) out.parts[`focus${i}`] = { visible: i === level ? 1 : 0 };
    },
    build(k, o) {
      const depth = clamp(Math.floor(Math.log2(k.count + 1)) - 1, 12, 15);
      const cell = specimen(depth),
        inks = STAINS[o.stain] || STAINS.nissl;
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
          const color = [0, 1, 2].map((j) =>
            Math.exp(s.k.reduce((sum, weight, k) => sum + weight * Math.log(inks[k][j]), 0)),
          );
          // Projected optical density approximates the concept's stain on a bright slide.
          // The mass remains in the tree; alpha blending is the shared renderer's display.
          const area = Math.sqrt(Math.max(s.S[0] * s.S[1] - s.S[3] ** 2, 1e-16));
          const opacity = 1 - Math.exp((-0.7 * s.w) / (2 * Math.PI * area));
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

// Lane Lab: splat fields on the GPU (docs/lab/FIELDS.md).
//
// The splat field toy: every splat carries only its own (u, v), and a small
// program on the graphics chip computes where it is and what color it is,
// every frame, from (u, v) and the time. Nothing moves on the CPU, so a few
// hundred thousand splats move smoothly. The program is the toy's work-buffer
// modifier (recipe.gpuField, read by the player with labs on); the same field
// at t = 0 in JavaScript places the splats for the fit and the first sort.
//
//   galaxy  stars on ellipses that turn a little more at each radius: the
//           ellipses crowd into two spiral arms that last while every star
//           keeps orbiting (a density wave). A tap sends a bright ring out.
//   ocean   a round patch of sea from four Gerstner waves, each splat tilted
//           to the water's slope, with foam on the crests. A tap drops a
//           stone where it lands (the button: in the middle).
//   knot    a flow along a (2, 3) torus knot, colored bands riding along.
//           A tap sends the whole flow once more around the knot.
//
// Labs only (src/toys.js). Without labs, or where the GPU program isn't
// used, the toy shows the field frozen at t = 0.

const TAU = Math.PI * 2;
const PULSE_SECS = 3;

// ---- The fields, in JavaScript (t = 0, for placing the splats) --------------------

// The same hash as the shaders: the float32 bits of u and v, mixed.
const f32 = new Float32Array(1);
const u32 = new Uint32Array(f32.buffer);
function bits(x) {
  f32[0] = x;
  return u32[0];
}
function hash2(u, v) {
  let n = (Math.imul(bits(u), 73856093) ^ Math.imul(bits(v), 19349663)) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b) >>> 0;
  n = (n ^ (n >>> 16)) >>> 0;
  return n / 4294967296;
}

// Where a splat is at time t, in field units (the shapes fit in radius 1).
export const FIELDS = {
  galaxy(u, v, t) {
    const h = hash2(u, v);
    const h2 = hash2(v, u);
    if (h2 < 0.08) {
      // The bulge: a small, round swarm.
      const r = 0.2 * Math.pow(u, 1.5);
      const th = TAU * v + t * 1.2;
      const ph = Math.acos(2 * h - 1);
      return [
        r * Math.sin(ph) * Math.cos(th),
        r * Math.cos(ph) * 0.6,
        r * Math.sin(ph) * Math.sin(th),
      ];
    }
    const a = 0.1 + 0.9 * u;
    const b = a * 0.55;
    const M = TAU * v + (t * 0.55) / (a + 0.15);
    const tilt = a * 5.5 + t * 0.06;
    const ex = a * Math.cos(M);
    const ez = b * Math.sin(M);
    const c = Math.cos(tilt);
    const s = Math.sin(tilt);
    const y = (h - 0.5) * 2 * (0.012 + 0.05 * (1 - a));
    return [ex * c - ez * s, y, ex * s + ez * c];
  },
  ocean(u, v, t) {
    const r = Math.sqrt(u);
    const x = r * Math.cos(TAU * v);
    const z = r * Math.sin(TAU * v);
    let dx = 0;
    let dy = 0;
    let dz = 0;
    for (const w of WAVES) {
      const k = TAU / w.len;
      const ph = k * (w.d[0] * x + w.d[1] * z) - Math.sqrt(9.8 * k) * 0.35 * t;
      const A = w.steep / k;
      dx += w.d[0] * A * Math.cos(ph) * 0.8;
      dz += w.d[1] * A * Math.cos(ph) * 0.8;
      dy += A * Math.sin(ph);
    }
    return [x + dx, dy, z + dz];
  },
  knot(u, v, t) {
    return knotPoint(u + t * 0.03, v, hash2(u, v));
  },
};

const WAVES = [
  { len: 0.9, steep: 0.09, d: [1, 0] },
  { len: 0.55, steep: 0.08, d: [0.8, 0.6] },
  { len: 0.33, steep: 0.07, d: [0.2, -0.98] },
  { len: 0.21, steep: 0.05, d: [-0.7, 0.71] },
];

function knotPoint(s, v, h) {
  const at = (q) => {
    const f = TAU * q;
    const r = 2 + Math.cos(3 * f);
    return [0.3 * r * Math.cos(2 * f), -0.3 * Math.sin(3 * f), 0.3 * r * Math.sin(2 * f)];
  };
  const c = at(s);
  const d = at(s + 0.001);
  const T = norm([d[0] - c[0], d[1] - c[1], d[2] - c[2]]);
  const N = norm(cross(T, [0, 1, 0]));
  const B = cross(T, N);
  const rad = 0.075 * Math.sqrt(h);
  const cs = Math.cos(TAU * v);
  const sn = Math.sin(TAU * v);
  return [0, 1, 2].map((k) => c[k] + (N[k] * cs + B[k] * sn) * rad);
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; // prettier-ignore
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

// How far each field reaches while it moves (for the fit and the frame).
const REACH = { galaxy: [1, 0.08, 1], ocean: [1.06, 0.12, 1.06], knot: [0.93, 0.38, 0.93] };
// Splat size (a multiple of the kit's 0.01 base) and opacity.
const LOOK = {
  galaxy: { size: 0.3, opacity: 0.3 },
  ocean: { size: 0.42, opacity: 0.95, flat: true },
  knot: { size: 0.3, opacity: 0.9 },
};

// Each splat's color at rest, roughly as the GPU colors it. It shows only
// where the GPU program isn't used (labs off): the GPU sets its own.
const mixc = (a, b, f) => a.map((x, i) => x + (b[i] - x) * f);
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const COLORS = {
  galaxy(u, v) {
    if (hash2(v, u) < 0.08) return [1, 0.72, 0.3];
    return mixc([0.98, 0.62, 0.16], [0.18, 0.36, 0.95], smooth(0.12, 0.6, 0.1 + 0.9 * u));
  },
  ocean(u, v) {
    return mixc([0.02, 0.17, 0.33], [0.06, 0.46, 0.58], 0.5 + FIELDS.ocean(u, v, 0)[1] * 7) // prettier-ignore
      .map((x) => Math.min(1, Math.max(0, x * 1.1)));
  },
  knot(u) {
    const h = Math.floor(u * 6) / 6 + 0.02;
    const k = [0, 2 / 3, 1 / 3].map((o) => Math.min(1, Math.max(0, Math.abs((((h + o) % 1) * 6) - 3) - 1))); // prettier-ignore
    return k.map((x) => 0.96 * (1 + (x - 1) * 0.62));
  },
};

// ---- The fields on the GPU ------------------------------------------------------------

// Shared: the hash, and the fit (field units to toy units) as constants.
const num = (x) => {
  const s = Number(x).toFixed(6);
  return s.includes(".") ? s : `${s}.0`;
};

const GLSL_HEAD = (fit) => `
uniform vec4 uSpClock;   // y splat scale, z exposure
uniform vec4 uSpKit;     // x the toy's clock
uniform vec4 uSpMorph;   // x the tap's progress 0..1
const vec3 LF_C = vec3(${fit.c.map(num).join(", ")});
const float LF_S = ${num(fit.s)};
const float TAU = 6.2831853;
vec4 lfAn = vec4(0.0);
vec3 lfColor = vec3(1.0);
float lfAlpha = 1.0;
float lfSize = 1.0;
vec4 lfTiltQ = vec4(0.0, 0.0, 0.0, 1.0);
float lfHash(float u, float v) {
  uint n = (floatBitsToUint(u) * 73856093u) ^ (floatBitsToUint(v) * 19349663u);
  n = (n ^ (n >> 16u)) * 0x45d9f3bu;
  n = n ^ (n >> 16u);
  return float(n) / 4294967296.0;
}
vec3 lfHsv(float h, float s, float v) {
  vec3 k = clamp(abs(fract(h + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
  return v * mix(vec3(1.0), k, s);
}
`;

const WGSL_HEAD = (fit) => `
uniform uSpClock: vec4f;
uniform uSpKit: vec4f;
uniform uSpMorph: vec4f;
const LF_C = vec3f(${fit.c.map(num).join(", ")});
const LF_S: f32 = ${num(fit.s)};
const TAU: f32 = 6.2831853;
var<private> lfAn: vec4f = vec4f(0.0);
var<private> lfColor: vec3f = vec3f(1.0);
var<private> lfAlpha: f32 = 1.0;
var<private> lfSize: f32 = 1.0;
var<private> lfTiltQ: vec4f = vec4f(0.0, 0.0, 0.0, 1.0);
fn lfHash(u: f32, v: f32) -> f32 {
  var n: u32 = (bitcast<u32>(u) * 73856093u) ^ (bitcast<u32>(v) * 19349663u);
  n = (n ^ (n >> 16u)) * 0x45d9f3bu;
  n = n ^ (n >> 16u);
  return f32(n) / 4294967296.0;
}
fn lfHsv(h: f32, s: f32, v: f32) -> vec3f {
  let k = clamp(abs(fract(h + vec3f(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0) - 1.0, vec3f(0.0), vec3f(1.0));
  return v * mix(vec3f(1.0), k, s);
}
`;

// Each field: lfField(u, v, t, p) returns the position in field units and
// sets lfColor, lfAlpha, lfSize (and lfTiltQ for flat splats). p is the
// tap's progress (0 at rest).
const GLSL_FIELD = {
  galaxy: `
vec3 lfField(float u, float v, float t, float p) {
  float h = lfHash(u, v);
  float h2 = lfHash(v, u);
  float glow = sin(3.1415927 * p);
  if (h2 < 0.08) {
    float r = 0.2 * pow(u, 1.5);
    float th = TAU * v + t * 1.2;
    float ph = acos(2.0 * h - 1.0);
    lfColor = vec3(1.0, 0.72, 0.3) * (1.0 + 1.5 * glow * exp(-p * 6.0));
    lfSize = 1.1;
    lfAlpha = 0.6;
    return vec3(r * sin(ph) * cos(th), r * cos(ph) * 0.6, r * sin(ph) * sin(th));
  }
  float a = 0.1 + 0.9 * u;
  float b = a * 0.55;
  float M = TAU * v + t * 0.55 / (a + 0.15);
  float tilt = a * 5.5 + t * 0.06;
  float ex = a * cos(M);
  float ez = b * sin(M);
  float c = cos(tilt);
  float s = sin(tilt);
  float y = (h - 0.5) * 2.0 * (0.012 + 0.05 * (1.0 - a));
  vec3 warm = vec3(0.98, 0.62, 0.16);
  vec3 cool = vec3(0.18, 0.36, 0.95);
  lfColor = mix(warm, cool, smoothstep(0.12, 0.6, a));
  // Stars crowd near the far ends of their ellipses: that is where the arms are.
  lfAlpha = (0.25 + 0.75 * pow(sin(M), 4.0)) * smoothstep(1.0, 0.7, a);
  if (h2 > 0.955) {
    lfColor = vec3(0.95, 0.2, 0.55);
    lfSize = 3.2;
    lfAlpha = 0.3 * pow(sin(M), 4.0) * smoothstep(0.95, 0.6, a);
  }
  float ring = exp(-pow((a - p * 1.15) / 0.07, 2.0)) * glow;
  lfColor = lfColor * (1.0 + 2.2 * ring);
  return vec3(ex * c - ez * s, y, ex * s + ez * c);
}
`,
  ocean: `
vec3 lfField(float u, float v, float t, float p) {
  float r = sqrt(u);
  float x = r * cos(TAU * v);
  float z = r * sin(TAU * v);
  vec3 d = vec3(0.0);
  vec3 n = vec3(0.0, 1.0, 0.0);
  float crest = 0.0;
  vec4 W[4] = vec4[4](vec4(1.0, 0.0, 0.9, 0.09), vec4(0.8, 0.6, 0.55, 0.08), vec4(0.2, -0.98, 0.33, 0.07), vec4(-0.7, 0.71, 0.21, 0.05));
  for (int i = 0; i < 4; i++) {
    vec4 w = W[i];
    float k = TAU / w.z;
    float ph = k * (w.x * x + w.y * z) - sqrt(9.8 * k) * 0.35 * t;
    float A = w.w / k;
    d += vec3(w.x * A * cos(ph) * 0.8, A * sin(ph), w.y * A * cos(ph) * 0.8);
    n.x -= w.x * w.w * cos(ph);
    n.z -= w.y * w.w * cos(ph);
    crest += w.w * sin(ph);
  }
  // The stone: a ring that runs out from where the tap landed (the middle
  // for the button: uSpMorph.yz, when w is set) and dies away.
  vec2 st = uSpMorph.w > 0.5 ? uSpMorph.yz : vec2(0.0);
  float sx = x - st.x;
  float sz = z - st.y;
  float rs = sqrt(sx * sx + sz * sz);
  float glow = sin(3.1415927 * p);
  float tau = p * 3.0;
  float front = smoothstep(tau * 0.55 + 0.05, tau * 0.55 - 0.05, rs);
  float ring = 0.035 * glow * front * exp(-1.6 * rs) * sin(22.0 * rs - 14.0 * tau);
  d.y += ring;
  n.x -= 0.035 * glow * front * 22.0 * cos(22.0 * rs - 14.0 * tau) * sx / max(rs, 1e-3);
  n.z -= 0.035 * glow * front * 22.0 * cos(22.0 * rs - 14.0 * tau) * sz / max(rs, 1e-3);
  n = normalize(n);
  vec3 L = normalize(vec3(0.4, 0.8, 0.45));
  float diff = clamp(dot(n, L), 0.0, 1.0);
  float spec = pow(clamp(dot(reflect(-L, n), vec3(0.0, 0.6, 0.8)), 0.0, 1.0), 40.0);
  vec3 deep = vec3(0.02, 0.17, 0.33);
  vec3 shallow = vec3(0.06, 0.46, 0.58);
  vec3 col = mix(deep, shallow, clamp(0.5 + d.y * 7.0, 0.0, 1.0)) * (0.3 + 0.95 * diff);
  float foam = 0.45 * smoothstep(0.16, 0.3, crest);
  lfColor = mix(col, vec3(0.93, 0.97, 1.0), foam) + vec3(spec * 0.8);
  lfTiltQ = normalize(vec4(n.z, 0.0, -n.x, 1.0 + n.y));
  return vec3(x, 0.0, z) + d;
}
`,
  knot: `
vec3 lfKnotAt(float q) {
  float f = TAU * q;
  float r = 2.0 + cos(3.0 * f);
  return vec3(0.3 * r * cos(2.0 * f), -0.3 * sin(3.0 * f), 0.3 * r * sin(2.0 * f));
}
vec3 lfField(float u, float v, float t, float p) {
  float h = lfHash(u, v);
  float lap = p - sin(TAU * p) / TAU;
  float s = u + t * 0.03 + lap;
  vec3 c = lfKnotAt(s);
  vec3 T = normalize(lfKnotAt(s + 0.001) - c);
  vec3 N = normalize(cross(T, vec3(0.0, 1.0, 0.0)));
  vec3 B = cross(T, N);
  float rad = 0.075 * sqrt(h);
  float a = TAU * v;
  vec3 off = (N * cos(a) + B * sin(a)) * rad;
  float band = fract(u * 6.0);
  float rim = 0.55 + 0.45 * sqrt(h);
  lfColor = lfHsv(floor(u * 6.0) / 6.0 + 0.02, 0.62, 0.96) * rim * (0.8 + 0.25 * smoothstep(0.0, 0.1, band));
  return c + off;
}
`,
};

const WGSL_FIELD = {
  galaxy: `
fn lfField(u: f32, v: f32, t: f32, p: f32) -> vec3f {
  let h = lfHash(u, v);
  let h2 = lfHash(v, u);
  let glow = sin(3.1415927 * p);
  if (h2 < 0.08) {
    let r = 0.2 * pow(u, 1.5);
    let th = TAU * v + t * 1.2;
    let ph = acos(2.0 * h - 1.0);
    lfColor = vec3f(1.0, 0.72, 0.3) * (1.0 + 1.5 * glow * exp(-p * 6.0));
    lfSize = 1.1;
    lfAlpha = 0.6;
    return vec3f(r * sin(ph) * cos(th), r * cos(ph) * 0.6, r * sin(ph) * sin(th));
  }
  let a = 0.1 + 0.9 * u;
  let b = a * 0.55;
  let M = TAU * v + t * 0.55 / (a + 0.15);
  let tilt = a * 5.5 + t * 0.06;
  let ex = a * cos(M);
  let ez = b * sin(M);
  let c = cos(tilt);
  let s = sin(tilt);
  let y = (h - 0.5) * 2.0 * (0.012 + 0.05 * (1.0 - a));
  let warm = vec3f(0.98, 0.62, 0.16);
  let cool = vec3f(0.18, 0.36, 0.95);
  lfColor = mix(warm, cool, smoothstep(0.12, 0.6, a));
  // Stars crowd near the far ends of their ellipses: that is where the arms are.
  lfAlpha = (0.25 + 0.75 * pow(sin(M), 4.0)) * smoothstep(1.0, 0.7, a);
  if (h2 > 0.955) {
    lfColor = vec3f(0.95, 0.2, 0.55);
    lfSize = 3.2;
    lfAlpha = 0.3 * pow(sin(M), 4.0) * smoothstep(0.95, 0.6, a);
  }
  let ring = exp(-pow((a - p * 1.15) / 0.07, 2.0)) * glow;
  lfColor = lfColor * (1.0 + 2.2 * ring);
  return vec3f(ex * c - ez * s, y, ex * s + ez * c);
}
`,
  ocean: `
fn lfField(u: f32, v: f32, t: f32, p: f32) -> vec3f {
  let r = sqrt(u);
  let x = r * cos(TAU * v);
  let z = r * sin(TAU * v);
  var d = vec3f(0.0);
  var n = vec3f(0.0, 1.0, 0.0);
  var crest: f32 = 0.0;
  let W = array<vec4f, 4>(vec4f(1.0, 0.0, 0.9, 0.09), vec4f(0.8, 0.6, 0.55, 0.08), vec4f(0.2, -0.98, 0.33, 0.07), vec4f(-0.7, 0.71, 0.21, 0.05));
  for (var i = 0; i < 4; i++) {
    let w = W[i];
    let k = TAU / w.z;
    let ph = k * (w.x * x + w.y * z) - sqrt(9.8 * k) * 0.35 * t;
    let A = w.w / k;
    d += vec3f(w.x * A * cos(ph) * 0.8, A * sin(ph), w.y * A * cos(ph) * 0.8);
    n.x -= w.x * w.w * cos(ph);
    n.z -= w.y * w.w * cos(ph);
    crest += w.w * sin(ph);
  }
  let st = select(vec2f(0.0), uniform.uSpMorph.yz, uniform.uSpMorph.w > 0.5);
  let sx = x - st.x;
  let sz = z - st.y;
  let rs = sqrt(sx * sx + sz * sz);
  let glow = sin(3.1415927 * p);
  let tau = p * 3.0;
  let front = smoothstep(tau * 0.55 + 0.05, tau * 0.55 - 0.05, rs);
  let ring = 0.035 * glow * front * exp(-1.6 * rs) * sin(22.0 * rs - 14.0 * tau);
  d.y += ring;
  n.x -= 0.035 * glow * front * 22.0 * cos(22.0 * rs - 14.0 * tau) * sx / max(rs, 1e-3);
  n.z -= 0.035 * glow * front * 22.0 * cos(22.0 * rs - 14.0 * tau) * sz / max(rs, 1e-3);
  n = normalize(n);
  let L = normalize(vec3f(0.4, 0.8, 0.45));
  let diff = clamp(dot(n, L), 0.0, 1.0);
  let spec = pow(clamp(dot(reflect(-L, n), vec3f(0.0, 0.6, 0.8)), 0.0, 1.0), 40.0);
  let deep = vec3f(0.02, 0.17, 0.33);
  let shallow = vec3f(0.06, 0.46, 0.58);
  let col = mix(deep, shallow, clamp(0.5 + d.y * 7.0, 0.0, 1.0)) * (0.3 + 0.95 * diff);
  let foam = 0.45 * smoothstep(0.16, 0.3, crest);
  lfColor = mix(col, vec3f(0.93, 0.97, 1.0), foam) + vec3f(spec * 0.8);
  lfTiltQ = normalize(vec4f(n.z, 0.0, -n.x, 1.0 + n.y));
  return vec3f(x, 0.0, z) + d;
}
`,
  knot: `
fn lfKnotAt(q: f32) -> vec3f {
  let f = TAU * q;
  let r = 2.0 + cos(3.0 * f);
  return vec3f(0.3 * r * cos(2.0 * f), -0.3 * sin(3.0 * f), 0.3 * r * sin(2.0 * f));
}
fn lfField(u: f32, v: f32, t: f32, p: f32) -> vec3f {
  let h = lfHash(u, v);
  let lap = p - sin(TAU * p) / TAU;
  let s = u + t * 0.03 + lap;
  let c = lfKnotAt(s);
  let T = normalize(lfKnotAt(s + 0.001) - c);
  let N = normalize(cross(T, vec3f(0.0, 1.0, 0.0)));
  let B = cross(T, N);
  let rad = 0.075 * sqrt(h);
  let a = TAU * v;
  let off = (N * cos(a) + B * sin(a)) * rad;
  let band = fract(u * 6.0);
  let rim = 0.55 + 0.45 * sqrt(h);
  lfColor = lfHsv(floor(u * 6.0) / 6.0 + 0.02, 0.62, 0.96) * rim * (0.8 + 0.25 * smoothstep(0.0, 0.1, band));
  return c + off;
}
`,
};

// The modifier's three hooks: the splat's (u, v) from its splatAnim stream,
// the field, then the fit into toy units. Quaternions are (x, y, z, w).
const GLSL_HOOKS = `
vec4 lfQuatMul(vec4 a, vec4 b) {
  return vec4(a.w * b.xyz + b.w * a.xyz + cross(a.xyz, b.xyz), a.w * b.w - dot(a.xyz, b.xyz));
}
void modifySplatCenter(inout vec3 center) {
  lfAn = loadSplatAnim();
  vec3 f = lfField(lfAn.z, lfAn.w, uSpKit.x, clamp(uSpMorph.x, 0.0, 1.0));
  center = (f - LF_C) * LF_S;
}
void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {
  rotation = lfQuatMul(lfTiltQ, rotation);
  scale *= uSpClock.y * lfSize;
}
void modifySplatColor(vec3 center, inout vec4 color) {
  color = vec4(lfColor * uSpClock.z, color.a * lfAlpha);
}
`;

const WGSL_HOOKS = `
fn lfQuatMul(a: vec4f, b: vec4f) -> vec4f {
  return vec4f(a.w * b.xyz + b.w * a.xyz + cross(a.xyz, b.xyz), a.w * b.w - dot(a.xyz, b.xyz));
}
fn modifySplatCenter(center: ptr<function, vec3f>) {
  lfAn = loadSplatAnim();
  let f = lfField(lfAn.z, lfAn.w, uniform.uSpKit.x, clamp(uniform.uSpMorph.x, 0.0, 1.0));
  *center = (f - LF_C) * LF_S;
}
fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {
  *rotation = lfQuatMul(lfTiltQ, *rotation);
  *scale = *scale * (uniform.uSpClock.y * lfSize);
}
fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
  *color = vec4f(lfColor * uniform.uSpClock.z, (*color).a * lfAlpha);
}
`;

export function fieldModifier(program, fit) {
  const p = FIELDS[program] ? program : "galaxy";
  return {
    glsl: GLSL_HEAD(fit) + GLSL_FIELD[p] + GLSL_HOOKS,
    wgsl: WGSL_HEAD(fit) + WGSL_FIELD[p] + WGSL_HOOKS,
  };
}

// ---- The recipe -------------------------------------------------------------------------

// Even (u, v) over the unit square: the R2 sequence (Roberts, 2018), so the
// splats cover a field without clumps.
const G2 = 1.32471795724474602596;
const A1 = 1 / G2;
const A2 = 1 / (G2 * G2);

export const RECIPES = {
  "splat-field": {
    alive: true,
    // The galaxy's stars are faint (well under the pick pass's usual 0.3), so
    // a tap needs a lower alpha to find them (Lab r2).
    pickAlpha: 0.04,
    density: 1.5,
    options: [
      {
        key: "program",
        label: "Field",
        type: "select",
        default: "galaxy",
        choices: [
          { id: "galaxy", label: "Galaxy" },
          { id: "ocean", label: "Ocean" },
          { id: "knot", label: "Knot" },
        ],
      },
    ],
    controls: [{ key: "pulse", label: "Pulse", type: "pulse", ease: PULSE_SECS }],
    action: { key: "pulse", label: "Send a pulse" },
    // The tap's progress (0..1) goes to the GPU program on channel 0.
    // Where a tap landed (field units) rides on channels 1 and 2, so the
    // ocean's stone drops there; everything is 0 again at rest.
    drive(t, c, out, info) {
      const p = c.pulse > 0 ? 1 - c.pulse : 0;
      const at = info?.tap?.key === "pulse" ? info.tap.point : null;
      out.morph = p > 0 && at ? [p, at[0], at[2], 1] : [p, 0, 0, 0];
    },
    gpuField(o, fit) {
      return fitOk(fit) ? fieldModifier(o.program, fitOf(fit)) : null;
    },
    build(k, o) {
      const program = FIELDS[o.program] ? o.program : "galaxy";
      const field = FIELDS[program];
      const look = LOOK[program];
      const n = Math.max(1, Math.floor(k.count * 0.99));
      const R = REACH[program];
      // On the axes (not the corners), so the fit centers the field and
      // scales it by its real reach.
      for (const s of [-1, 1]) {
        k.reach([s * R[0], 0, 0]);
        k.reach([0, s * R[1], 0]);
        k.reach([0, 0, s * R[2]]);
      }
      k.cloud({ share: n / k.count, size: 1 }, (rand, i) => {
        const u = (0.5 + i * A1) % 1;
        const v = (0.5 + i * A2) % 1;
        // The shaders read u and v back as float32: store them as such.
        f32[0] = u;
        const uf = f32[0];
        f32[0] = v;
        const vf = f32[0];
        const splat = {
          p: field(uf, vf, 0),
          color: COLORS[program](uf, vf),
          size: look.size,
          opacity: look.opacity,
          kind: "none",
          params: [uf, vf],
        };
        if (look.flat) {
          splat.n = [0, 1, 0];
          splat.flat = 0.25;
        }
        return splat;
      });
    },
  },
};

function fitOk(fit) {
  return !!fit && Number.isFinite(fit.scale) && fit.center?.length === 3;
}

// The kit's fit ({ center, scale }) in the shape the shaders take.
export function fitOf(transform) {
  return { c: transform.center, s: transform.scale };
}

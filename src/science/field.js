// The Science toys' GPU program (lane Science): a work-buffer modifier, like
// lane Lab's splat fields (docs/lab/FIELDS.md), passed by the recipe's
// gpuField() with labs on. It replaces the kit's program for these toys, so
// each splat's four splatAnim values are this program's own:
//
//   y (the kit's "kind"): what the splat is
//     SCI_KIND.plain  a splat that only zooms (bonds, localizations, gas)
//     SCI_KIND.bond   a bond: fades while the atoms jiggle
//     SCI_KIND.atom   one of the splats of an atom's solid ellipsoid
//     SCI_KIND.gauss  an atom drawn as one Gaussian: its turn and size are set
//                     here from the atom's principal axes (exactly its U)
//     SCI_KIND.gas    a gas particle: z = log10 of its temperature (K), so
//                     the hot gas can be peeled away
//     SCI_KIND.loc    a localization: z, w = its true size across and deep
//                     (√2 σ, recipe units, times UNIT for toy units); the
//                     stored splat is wider so it shows without labs
//   for atoms: x, z, w pack the atom's principal axes as a quaternion (four
//   bytes), its three standard deviations (three bytes, as fractions of the
//   structure's largest, SIG_MAX toy units) and a seed (16 bits):
//     z = q0 + 256 q1 + 65536 q2,  w = q3 + 256 s1 + 65536 s2,  x = s3 + 256 seed
//
// Uniforms (from the recipe's drive):
//   uSpMorph = [jiggle 0..1 (bonds fade with it), magnification, size floor
//               per unit of camera distance (0: none), near clip (0: none)]
//   The near clip, like a molecular viewer's clipping plane, fades splats
//   nearer the camera than that many toy units in front of the middle, so a
//   magnified structure doesn't hide the place you zoomed in on.
//   uSpGlowC = [focus x, y, z (toy units), how far the focus has moved to
//               the middle 0..1]
//   uSpKitB.x (the kit's grow, 1 at rest) = 1 − how far the hot gas is
//               peeled away
//
// The jiggle moves every splat of an atom by the same displacement,
// d = R · diag(σ) · z(t), with each z a sum of three cosines of random
// frequency and phase (unit variance, close to Gaussian), so the atom wanders
// through displacements drawn from its own Gaussian, slowed down enormously.
// The magnifier scales everything about the focus (splat sizes too) and
// brings the focus to the middle; a scaling keeps the depth order, so the
// sort stays right.

export const SCI_KIND = { plain: 1000, bond: 1001, atom: 1002, gauss: 1003, gas: 1004, loc: 1005 }; // prettier-ignore

// Packs an atom's frame for the program: quat [x, y, z, w], sigma (3, toy
// units, largest first), sigMax (toy units), seed (0..65535) -> [x, z, w].
export function packAtom(quat, sigma, sigMax, seed) {
  const b = (v) => Math.max(0, Math.min(255, Math.round(((v + 1) / 2) * 255)));
  const s = (v) => Math.max(1, Math.min(255, Math.round((v / sigMax) * 255)));
  const q = quat[3] < 0 ? quat.map((v) => -v) : quat;
  return [
    s(sigma[2]) + 256 * (seed & 0xffff),
    b(q[0]) + 256 * b(q[1]) + 65536 * b(q[2]),
    b(q[3]) + 256 * s(sigma[0]) + 65536 * s(sigma[1]),
  ];
}

// The inverse (for the tests and the CPU copy): -> { quat, sigma, seed }.
export function unpackAtom(x, z, w, sigMax) {
  const bytes = (v) => [v % 256, Math.floor(v / 256) % 256, Math.floor(v / 65536)];
  const [q0, q1, q2] = bytes(z);
  const [q3, s1, s2] = bytes(w);
  const s3 = x % 256;
  const u = (b) => (b / 255) * 2 - 1;
  const quat = [u(q0), u(q1), u(q2), u(q3)];
  const l = Math.hypot(...quat) || 1;
  return {
    quat: quat.map((v) => v / l),
    sigma: [s1, s2, s3].map((v) => (v / 255) * sigMax),
    seed: Math.floor(x / 256),
  };
}

// A rotation matrix's columns (e1, e2, e3) as a quaternion [x, y, z, w].
export function quatFromAxes([e1, e2, e3]) {
  const m00 = e1[0], m10 = e1[1], m20 = e1[2]; // prettier-ignore
  const m01 = e2[0], m11 = e2[1], m21 = e2[2]; // prettier-ignore
  const m02 = e3[0], m12 = e3[1], m22 = e3[2]; // prettier-ignore
  const tr = m00 + m11 + m22;
  let q;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, s / 4];
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    q = [s / 4, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    q = [(m01 + m10) / s, s / 4, (m12 + m21) / s, (m02 - m20) / s];
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    q = [(m02 + m20) / s, (m12 + m21) / s, s / 4, (m10 - m01) / s];
  }
  const l = Math.hypot(...q);
  return q.map((v) => v / l);
}

const num = (x) => {
  const s = Number(x).toFixed(7);
  return s.includes(".") ? s : `${s}.0`;
};

// The same smooth unit-variance noise the program uses, in JavaScript (for
// the tests): three cosines with frequencies and phases from the seed.
export function jiggleNoise(seed, axis, t) {
  let sum = 0;
  for (let k = 0; k < 3; k++) {
    const h1 = hash01(seed * 16 + axis * 4 + k, 1);
    const h2 = hash01(seed * 16 + axis * 4 + k, 2);
    sum += Math.cos((2.2 + 5.3 * h1) * t + 6.2831853 * h2);
  }
  return sum * Math.sqrt(2 / 3);
}
function hash01(n, salt) {
  let h = (Math.imul(n >>> 0, 73856093) ^ Math.imul(salt, 19349663)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

const GLSL = (sigMax, unit) => `
uniform vec4 uSpClock;   // y splat scale, z exposure
uniform vec4 uSpKit;     // x the toy's clock
uniform vec4 uSpMorph;   // jiggle, magnification, size floor, near clip
uniform vec4 uSpGlowC;   // focus xyz, how far it has moved to the middle
uniform vec4 uSpCam;     // camera position
uniform vec4 uSpKitB;    // x: 1 - the hot gas's peel
const float SIG_MAX = ${num(sigMax)};
const float UNIT = ${num(unit)};
vec4 sciAn = vec4(0.0);
int sciKind = 0;
vec4 sciQ = vec4(0.0, 0.0, 0.0, 1.0);
vec3 sciSig = vec3(0.0);
float sciHash(uint n, uint salt) {
  uint h = (n * 73856093u) ^ (salt * 19349663u);
  h = (h ^ (h >> 16u)) * 0x45d9f3bu;
  h = h ^ (h >> 16u);
  return float(h) / 4294967296.0;
}
vec3 sciRot(vec4 q, vec3 v) {
  return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}
float sciNoise(uint seed, uint axis, float t) {
  float s = 0.0;
  for (uint k = 0u; k < 3u; k++) {
    uint n = seed * 16u + axis * 4u + k;
    s += cos((2.2 + 5.3 * sciHash(n, 1u)) * t + 6.2831853 * sciHash(n, 2u));
  }
  return s * 0.8164966;
}
void sciUnpack() {
  float z = sciAn.z;
  float w = sciAn.w;
  float x = sciAn.x;
  vec4 q = vec4(mod(z, 256.0), mod(floor(z / 256.0), 256.0), floor(z / 65536.0), mod(w, 256.0));
  q = q / 255.0 * 2.0 - 1.0;
  sciQ = normalize(q);
  sciSig = vec3(mod(floor(w / 256.0), 256.0), floor(w / 65536.0), mod(x, 256.0)) / 255.0 * SIG_MAX;
}
void modifySplatCenter(inout vec3 center) {
  sciAn = loadSplatAnim();
  sciKind = int(sciAn.y + 0.5);
  vec3 p = center;
  if (sciKind == 1002 || sciKind == 1003) {
    sciUnpack();
    float j = uSpMorph.x;
    if (j > 0.0) {
      uint seed = uint(floor(sciAn.x / 256.0));
      float t = uSpKit.x;
      vec3 zz = vec3(sciNoise(seed, 0u, t), sciNoise(seed, 1u, t), sciNoise(seed, 2u, t));
      p += j * sciRot(sciQ, sciSig * zz);
    }
  }
  float m = max(uSpMorph.y, 1e-3);
  center = (p - uSpGlowC.xyz) * m + uSpGlowC.xyz * (1.0 - uSpGlowC.w);
}
void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {
  if (sciKind == 1003) {
    rotation = sciQ;
    scale = sciSig * 1.4142136;
  }
  if (sciKind == 1005) scale = vec3(sciAn.z, sciAn.z, sciAn.w) * UNIT;
  float m = max(uSpMorph.y, 1e-3);
  scale *= uSpClock.y * m;
  if (uSpMorph.z > 0.0) scale = max(scale, vec3(uSpMorph.z * length(uSpCam.xyz)));
}
void modifySplatColor(vec3 center, inout vec4 color) {
  float a = color.a;
  if (sciKind == 1001) a *= 1.0 - 0.8 * uSpMorph.x;
  if (sciKind == 1004) a *= 1.0 - (1.0 - clamp(uSpKitB.x, 0.0, 1.0)) * smoothstep(4.1, 4.6, sciAn.z);
  if (uSpMorph.w > 0.0) {
    float front = dot(center, normalize(uSpCam.xyz));
    a *= 1.0 - smoothstep(uSpMorph.w - 0.12, uSpMorph.w, front);
  }
  color = vec4(color.rgb * uSpClock.z, a);
}
`;

const WGSL = (sigMax, unit) => `
uniform uSpClock: vec4f;
uniform uSpKit: vec4f;
uniform uSpMorph: vec4f;
uniform uSpGlowC: vec4f;
uniform uSpCam: vec4f;
uniform uSpKitB: vec4f;
const SIG_MAX: f32 = ${num(sigMax)};
const UNIT: f32 = ${num(unit)};
var<private> sciAn: vec4f = vec4f(0.0);
var<private> sciKind: i32 = 0;
var<private> sciQ: vec4f = vec4f(0.0, 0.0, 0.0, 1.0);
var<private> sciSig: vec3f = vec3f(0.0);
fn sciHash(n: u32, salt: u32) -> f32 {
  var h: u32 = (n * 73856093u) ^ (salt * 19349663u);
  h = (h ^ (h >> 16u)) * 0x45d9f3bu;
  h = h ^ (h >> 16u);
  return f32(h) / 4294967296.0;
}
fn sciRot(q: vec4f, v: vec3f) -> vec3f {
  return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}
fn sciNoise(seed: u32, axis: u32, t: f32) -> f32 {
  var s: f32 = 0.0;
  for (var k: u32 = 0u; k < 3u; k++) {
    let n = seed * 16u + axis * 4u + k;
    s += cos((2.2 + 5.3 * sciHash(n, 1u)) * t + 6.2831853 * sciHash(n, 2u));
  }
  return s * 0.8164966;
}
fn sciUnpack() {
  let z = sciAn.z;
  let w = sciAn.w;
  let x = sciAn.x;
  var q = vec4f(z % 256.0, floor(z / 256.0) % 256.0, floor(z / 65536.0), w % 256.0);
  q = q / 255.0 * 2.0 - 1.0;
  sciQ = normalize(q);
  sciSig = vec3f(floor(w / 256.0) % 256.0, floor(w / 65536.0), x % 256.0) / 255.0 * SIG_MAX;
}
fn modifySplatCenter(center: ptr<function, vec3f>) {
  sciAn = loadSplatAnim();
  sciKind = i32(sciAn.y + 0.5);
  var p = *center;
  if (sciKind == 1002 || sciKind == 1003) {
    sciUnpack();
    let j = uniform.uSpMorph.x;
    if (j > 0.0) {
      let seed = u32(floor(sciAn.x / 256.0));
      let t = uniform.uSpKit.x;
      let zz = vec3f(sciNoise(seed, 0u, t), sciNoise(seed, 1u, t), sciNoise(seed, 2u, t));
      p += j * sciRot(sciQ, sciSig * zz);
    }
  }
  let m = max(uniform.uSpMorph.y, 1e-3);
  *center = (p - uniform.uSpGlowC.xyz) * m + uniform.uSpGlowC.xyz * (1.0 - uniform.uSpGlowC.w);
}
fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {
  if (sciKind == 1003) {
    *rotation = sciQ;
    *scale = sciSig * 1.4142136;
  }
  if (sciKind == 1005) { *scale = vec3f(sciAn.z, sciAn.z, sciAn.w) * UNIT; }
  let m = max(uniform.uSpMorph.y, 1e-3);
  *scale = *scale * (uniform.uSpClock.y * m);
  if (uniform.uSpMorph.z > 0.0) {
    *scale = max(*scale, vec3f(uniform.uSpMorph.z * length(uniform.uSpCam.xyz)));
  }
}
fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
  var a = (*color).a;
  if (sciKind == 1001) { a = a * (1.0 - 0.8 * uniform.uSpMorph.x); }
  if (sciKind == 1004) { a = a * (1.0 - (1.0 - clamp(uniform.uSpKitB.x, 0.0, 1.0)) * smoothstep(4.1, 4.6, sciAn.z)); }
  if (uniform.uSpMorph.w > 0.0) {
    let front = dot(center, normalize(uniform.uSpCam.xyz));
    a = a * (1.0 - smoothstep(uniform.uSpMorph.w - 0.12, uniform.uSpMorph.w, front));
  }
  *color = vec4f((*color).rgb * uniform.uSpClock.z, a);
}
`;

// The modifier for a toy; sigMax is the largest standard deviation packed
// (toy units; any positive number for toys without atoms) and unit the fit's
// scale (toy units per recipe unit), for the localizations' true sizes.
export function sciModifier(sigMax = 1, unit = 1) {
  const s = Number.isFinite(sigMax) && sigMax > 0 ? sigMax : 1;
  const u = Number.isFinite(unit) && unit > 0 ? unit : 1;
  return { glsl: GLSL(s, u), wgsl: WGSL(s, u) };
}

// Where a displayed point came from: the inverse of the magnifier (toy
// units in, toy units out).
export function unmagnify(p, focus, m, moved) {
  return [0, 1, 2].map((k) => (p[k] - focus[k] * (1 - moved)) / m + focus[k]);
}

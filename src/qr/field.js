// Lane QR: the code's motions, as a program on the graphics chip (the labs
// work-buffer hook, docs/lab/FIELDS.md). Every splat knows its piece (a
// module, a finder or an alignment pattern: src/qr/build.js), so the program
// moves and turns each piece as one solid tile about its own center:
//
//   x  Assemble: the pieces fly off, then fly back in from all sides and
//      lock into place, the middle first.
//   y  Flip: the pieces turn over like tiles in a diagonal wave, lifting as
//      they turn, show their other color, then turn back.
//   z  Burst and return: the pieces burst off, tumble and fall under gravity
//      to a floor, then fly back to their places in a wave.
//   w  Alive (0..1): a color wave rolls across the code. Each splat's hue
//      moves toward the style's wave color while its gray (what a reader
//      sees) stays the same, so every frame scans. (A breath in depth was
//      dropped on October 3: it made Bubbles' loop miss a frame now and then.)
//
// The Gems style's glint passes only when the code is seen at an angle: in
// Scan view (front on) it never pales a module.
//
// Each runs from 0 to 1 (uSpMorph, set by the recipe's drive) and is exactly
// the rest pose at 0 and at 1, so the code always ends back on its grid.

const num = (x) => {
  const s = Number(x).toFixed(6);
  return s.includes(".") ? s : `${s}.0`;
};
const vec3 = (c) => c.map(num).join(", ");

// The shared parts, written once for GLSL; the WGSL below says the same.
const GLSL = ({ N, C, S, back, glint, wave }) => `
uniform vec4 uSpClock;   // y splat scale, z exposure
uniform vec4 uSpKit;     // x the toy's clock
uniform vec4 uSpMorph;   // x assemble, y flip, z burst (0..1), w alive
uniform vec4 uSpCam;     // xyz the camera's position
const float QN = ${num(N)};
const vec3 QC = vec3(${vec3(C)});
const float QS = ${num(S)};
const vec3 QBACK = vec3(${vec3(back)});
const vec3 QWAVE = vec3(${vec3(wave)});
vec4 qrQ = vec4(0.0, 0.0, 0.0, 1.0);
float qrBack = 0.0;
float qrGlint = 0.0;
float qrWave = 0.0;
float qrHash(float n) { return fract(sin(n * 12.9898 + 4.1414) * 43758.5453); }
vec3 qrRot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
vec4 qrAxis(vec3 a, float t) { return vec4(normalize(a) * sin(t * 0.5), cos(t * 0.5)); }
vec4 qrMul(vec4 a, vec4 b) { return vec4(a.w * b.xyz + b.w * a.xyz + cross(a.xyz, b.xyz), a.w * b.w - dot(a.xyz, b.xyz)); }
float qrSat(float x) { return clamp(x, 0.0, 1.0); }
float qrOut3(float x) { float u = 1.0 - qrSat(x); return 1.0 - u * u * u; }
float qrInOut(float x) { x = qrSat(x); return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 3.0) / 2.0; }
void modifySplatCenter(inout vec3 center) {
  vec4 an = loadSplatAnim();
  if (an.z < 0.5) return;
  float idx = an.z - 1.0;
  float row = floor((idx + 0.5) / QN);
  float col = idx - row * QN;
  float wide = mod(an.w, 10.0);
  bool eye = an.w > 9.5;
  vec3 piv = (vec3(col - QN * 0.5 + 0.5, QN * 0.5 - 0.5 - row, 0.0) - QC) * QS;
  vec3 rel = center - piv;
  vec3 off = vec3(0.0);
  vec4 q = vec4(0.0, 0.0, 0.0, 1.0);
  float h1 = qrHash(idx + 0.37);
  float h2 = qrHash(idx * 1.71 + 2.9);
  float h3 = qrHash(idx * 0.53 + 7.3);
  vec2 g = vec2(col, row) / max(QN - 1.0, 1.0); // 0..1 across the code
  float edge = QN * 0.5 * QS; // half the code's width (toy units)
  // Assemble.
  float A = uSpMorph.x;
  if (A > 0.0 && A < 1.0) {
    float ang = 6.2831853 * h1;
    vec3 far = vec3(cos(ang) * (0.7 + 0.5 * h2) * 1.15, sin(ang) * (0.7 + 0.5 * h2) * 1.15, 0.25 + 0.5 * h3) * edge;
    vec3 ax = vec3(h2 - 0.5, h3 - 0.5, h1 - 0.5) + vec3(0.0, 0.0, 0.01);
    float away = qrSat(A / 0.16);
    away = away * away;
    float d = 0.2 + 0.36 * length(g - 0.5) / 0.7071 + 0.04 * h1;
    float s = qrOut3((A - d) / 0.4);
    float k = A < 0.18 ? away : 1.0 - s;
    off += far * k;
    q = qrMul(qrAxis(ax, 3.0 * k), q);
  }
  // Flip: two half turns in a diagonal wave, lifting off the sheet as it turns.
  float F = uSpMorph.y;
  if (F > 0.0 && F < 1.0) {
    float d = 0.26 * (g.x + g.y) * 0.5;
    float th = 3.1415927 * (qrInOut((F - d) / 0.22) + qrInOut((F - 0.5 - d) / 0.22));
    vec3 ax = eye ? vec3(0.0, 1.0, 0.0) : vec3(0.7071, 0.7071, 0.0);
    q = qrMul(qrAxis(ax, th), q);
    off.z += abs(sin(th)) * (wide * 0.5 + 0.3) * QS;
    qrBack = cos(th) < 0.0 ? 1.0 : 0.0;
  }
  // Burst and return.
  float B = uSpMorph.z;
  if (B > 0.0 && B < 1.0) {
    vec2 out2 = vec2(col - QN * 0.5 + 0.5, QN * 0.5 - 0.5 - row) * QS;
    vec2 dir = length(out2) > 1e-4 ? normalize(out2) : vec2(0.0, 1.0);
    float heavy = wide > 1.5 ? 0.6 : 1.0; // the patterns are heavier
    // Thrown out a little, toward the viewer and up; they fall under
    // gravity G to a floor just below the code, land (their tumble stops)
    // and slide a little further.
    vec3 v0 = vec3(dir * (0.12 + 0.3 * h1) * heavy, 0.3 + 0.45 * h2) + vec3(0.0, 0.2 + 0.35 * h3, 0.0);
    float G = 2.4;
    float floorY = min(-(edge + 0.04) - piv.y + 0.3 * wide * QS, 0.0);
    vec3 ax = vec3(h3 - 0.5, h1 - 0.5, h2 - 0.5) + vec3(0.01, 0.0, 0.0);
    float w = (4.0 + 5.0 * h3) * heavy;
    float t1 = min(B, 0.56) / 0.56 * 1.3; // seconds of flight
    float tl = (v0.y + sqrt(v0.y * v0.y - 2.0 * G * floorY)) / G; // when it lands
    float tf = min(t1, tl);
    float slide = tf + 0.3 * max(t1 - tl, 0.0);
    vec3 p = vec3(v0.x * slide, v0.y * tf - 0.5 * G * tf * tf, v0.z * slide);
    float spin = w * tf;
    float d = 0.06 * (1.0 - g.y) + 0.06 * h1;
    float s = qrInOut((B - 0.6 - d) / 0.3);
    off += p * (1.0 - s) + vec3(0.0, 0.0, 0.25 * edge * sin(3.1415927 * s));
    q = qrMul(qrAxis(ax, spin * (1.0 - s)), q);
  }
  // Alive: the color wave.
  float L = uSpMorph.w;
  if (L > 0.0) {
    float ph = uSpKit.x * 1.8 - (g.x + g.y) * 5.0;
    qrWave = L * (0.5 + 0.5 * sin(ph));
  }
  qrQ = q;
  center = piv + qrRot(q, rel) + off;
  // The gems' glint: a narrow band of light that passes now and then, only
  // when the code is seen at an angle (none front on, in Scan view).
  if (${glint ? "true" : "false"}) {
    float tilt = 1.0 - abs(normalize(uSpCam.xyz + vec3(0.0, 0.0, 1e-4)).z);
    float band = fract(uSpKit.x * 0.16) * 3.2 - 1.1;
    float x = (g.x + (1.0 - g.y)) * 0.5;
    qrGlint = exp(-pow((x - band) / 0.035, 2.0)) * step(0.55, h2) * smoothstep(0.03, 0.12, tilt);
  }
}
void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {
  rotation = qrMul(qrQ, rotation);
  scale *= uSpClock.y;
}
// The wave color at the gray of c (Rec. 709 weights, as readers see it).
vec3 qrSameGray(vec3 c) {
  vec3 W = vec3(0.2126, 0.7152, 0.0722);
  return clamp(QWAVE * (dot(c, W) / max(dot(QWAVE, W), 0.02)), 0.0, 1.0);
}
void modifySplatColor(vec3 center, inout vec4 color) {
  vec3 c = mix(color.rgb, QBACK * (0.6 + 0.4 * color.rgb / max(max(color.r, color.g), max(color.b, 0.05))), qrBack);
  c = mix(c, qrSameGray(c), qrWave * 0.85);
  c += vec3(0.55) * qrGlint;
  color = vec4(c * uSpClock.z, color.a);
}
`;

const WGSL = ({ N, C, S, back, glint, wave }) => `
uniform uSpClock: vec4f;
uniform uSpKit: vec4f;
uniform uSpMorph: vec4f;
uniform uSpCam: vec4f;
const QN: f32 = ${num(N)};
const QC = vec3f(${vec3(C)});
const QS: f32 = ${num(S)};
const QBACK = vec3f(${vec3(back)});
const QWAVE = vec3f(${vec3(wave)});
var<private> qrQ: vec4f = vec4f(0.0, 0.0, 0.0, 1.0);
var<private> qrBack: f32 = 0.0;
var<private> qrGlint: f32 = 0.0;
var<private> qrWave: f32 = 0.0;
fn qrHash(n: f32) -> f32 { return fract(sin(n * 12.9898 + 4.1414) * 43758.5453); }
fn qrRot(q: vec4f, v: vec3f) -> vec3f { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
fn qrAxis(a: vec3f, t: f32) -> vec4f { return vec4f(normalize(a) * sin(t * 0.5), cos(t * 0.5)); }
fn qrMul(a: vec4f, b: vec4f) -> vec4f { return vec4f(a.w * b.xyz + b.w * a.xyz + cross(a.xyz, b.xyz), a.w * b.w - dot(a.xyz, b.xyz)); }
fn qrSat(x: f32) -> f32 { return clamp(x, 0.0, 1.0); }
fn qrOut3(x: f32) -> f32 { let u = 1.0 - qrSat(x); return 1.0 - u * u * u; }
fn qrInOut(x0: f32) -> f32 {
  let x = qrSat(x0);
  if (x < 0.5) { return 4.0 * x * x * x; }
  return 1.0 - pow(-2.0 * x + 2.0, 3.0) / 2.0;
}
fn modifySplatCenter(center: ptr<function, vec3f>) {
  let an = loadSplatAnim();
  if (an.z < 0.5) { return; }
  let idx = an.z - 1.0;
  let row = floor((idx + 0.5) / QN);
  let col = idx - row * QN;
  let wide = an.w - 10.0 * floor(an.w / 10.0);
  let eye = an.w > 9.5;
  let piv = (vec3f(col - QN * 0.5 + 0.5, QN * 0.5 - 0.5 - row, 0.0) - QC) * QS;
  let rel = *center - piv;
  var off = vec3f(0.0);
  var q = vec4f(0.0, 0.0, 0.0, 1.0);
  let h1 = qrHash(idx + 0.37);
  let h2 = qrHash(idx * 1.71 + 2.9);
  let h3 = qrHash(idx * 0.53 + 7.3);
  let g = vec2f(col, row) / max(QN - 1.0, 1.0);
  let edge = QN * 0.5 * QS;
  let A = uniform.uSpMorph.x;
  if (A > 0.0 && A < 1.0) {
    let ang = 6.2831853 * h1;
    let far = vec3f(cos(ang) * (0.7 + 0.5 * h2) * 1.15, sin(ang) * (0.7 + 0.5 * h2) * 1.15, 0.25 + 0.5 * h3) * edge;
    let ax = vec3f(h2 - 0.5, h3 - 0.5, h1 - 0.5) + vec3f(0.0, 0.0, 0.01);
    var away = qrSat(A / 0.16);
    away = away * away;
    let d = 0.2 + 0.36 * length(g - 0.5) / 0.7071 + 0.04 * h1;
    let s = qrOut3((A - d) / 0.4);
    let k = select(1.0 - s, away, A < 0.18);
    off += far * k;
    q = qrMul(qrAxis(ax, 3.0 * k), q);
  }
  let F = uniform.uSpMorph.y;
  if (F > 0.0 && F < 1.0) {
    let d = 0.26 * (g.x + g.y) * 0.5;
    let th = 3.1415927 * (qrInOut((F - d) / 0.22) + qrInOut((F - 0.5 - d) / 0.22));
    let ax = select(vec3f(0.7071, 0.7071, 0.0), vec3f(0.0, 1.0, 0.0), eye);
    q = qrMul(qrAxis(ax, th), q);
    off.z += abs(sin(th)) * (wide * 0.5 + 0.3) * QS;
    qrBack = select(0.0, 1.0, cos(th) < 0.0);
  }
  let B = uniform.uSpMorph.z;
  if (B > 0.0 && B < 1.0) {
    let out2 = vec2f(col - QN * 0.5 + 0.5, QN * 0.5 - 0.5 - row) * QS;
    let dir = select(vec2f(0.0, 1.0), normalize(out2), length(out2) > 1e-4);
    let heavy = select(1.0, 0.6, wide > 1.5);
    let v0 = vec3f(dir * (0.12 + 0.3 * h1) * heavy, 0.3 + 0.45 * h2) + vec3f(0.0, 0.2 + 0.35 * h3, 0.0);
    let G: f32 = 2.4;
    let floorY = min(-(edge + 0.04) - piv.y + 0.3 * wide * QS, 0.0);
    let ax = vec3f(h3 - 0.5, h1 - 0.5, h2 - 0.5) + vec3f(0.01, 0.0, 0.0);
    let w = (4.0 + 5.0 * h3) * heavy;
    let t1 = min(B, 0.56) / 0.56 * 1.3;
    let tl = (v0.y + sqrt(v0.y * v0.y - 2.0 * G * floorY)) / G;
    let tf = min(t1, tl);
    let slide = tf + 0.3 * max(t1 - tl, 0.0);
    let p = vec3f(v0.x * slide, v0.y * tf - 0.5 * G * tf * tf, v0.z * slide);
    let spin = w * tf;
    let d = 0.06 * (1.0 - g.y) + 0.06 * h1;
    let s = qrInOut((B - 0.6 - d) / 0.3);
    off += p * (1.0 - s) + vec3f(0.0, 0.0, 0.25 * edge * sin(3.1415927 * s));
    q = qrMul(qrAxis(ax, spin * (1.0 - s)), q);
  }
  let L = uniform.uSpMorph.w;
  if (L > 0.0) {
    let ph = uniform.uSpKit.x * 1.8 - (g.x + g.y) * 5.0;
    qrWave = L * (0.5 + 0.5 * sin(ph));
  }
  qrQ = q;
  *center = piv + qrRot(q, rel) + off;
  if (${glint ? "true" : "false"}) {
    let tilt = 1.0 - abs(normalize(uniform.uSpCam.xyz + vec3f(0.0, 0.0, 1e-4)).z);
    let band = fract(uniform.uSpKit.x * 0.16) * 3.2 - 1.1;
    let x = (g.x + (1.0 - g.y)) * 0.5;
    qrGlint = exp(-pow((x - band) / 0.035, 2.0)) * step(0.55, h2) * smoothstep(0.03, 0.12, tilt);
  }
}
fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {
  *rotation = qrMul(qrQ, *rotation);
  *scale = *scale * uniform.uSpClock.y;
}
fn qrSameGray(c: vec3f) -> vec3f {
  let W = vec3f(0.2126, 0.7152, 0.0722);
  return clamp(QWAVE * (dot(c, W) / max(dot(QWAVE, W), 0.02)), vec3f(0.0), vec3f(1.0));
}
fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
  let k = (*color).rgb / max(max((*color).r, (*color).g), max((*color).b, 0.05));
  var c = mix((*color).rgb, QBACK * (0.6 + 0.4 * k), qrBack);
  c = mix(c, qrSameGray(c), qrWave * 0.85);
  c += vec3f(0.55) * qrGlint;
  *color = vec4f(c * uniform.uSpClock.z, (*color).a);
}
`;

// size: the code's modules across; fit: the kit's { center, scale }; back: the
// flip's back color [r, g, b]; glint: the gems' glint is in the program
// (only for Gems, so no other style can ever catch it).
// wave: Alive's wave color [r, g, b].
export function qrModifier(size, fit, back, glint = false, wave = [0.11, 0.31, 0.61]) {
  const args = { N: size, C: fit.center, S: fit.scale, back, glint, wave };
  return { glsl: GLSL(args), wgsl: WGSL(args) };
}

// The same timing in JavaScript, for how long each motion runs (seconds at
// normal speed) and for tests.
export const MOTION_SECS = { assemble: 3.2, flip: 3.4, burst: 3.6 };

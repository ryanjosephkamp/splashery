// Lane QR craft: the labs GPU programs (docs/lab/FIELDS.md) that move the QR
// craft toys' pieces. Every splat carries two numbers (its params):
//   a  0 for a splat that never moves (the board, the sheet); else 1 + the
//      index of its piece's home module (row * size + col)
//   b  kind + 16 * extra, kind (0..15):
//        1 a picture tile over a light module    2 over a dark module
//        3 a domino (extra: its turn in the chain, and which way it falls)
//        4 a marble (extra: its turn)            5 a flip tile (extra: its turn)
//
// Picture QR (pictureModifier): uSpMorph x the tap's progress (0..1), zw the
// tap point (code units). Each tile turns over once about its own vertical
// axis, in a wave out from the tap: its back is the plain code (dark or
// light), then it comes round to the picture again.
//
// Build a code (buildModifier): uSpMorph x the build's progress (0: the
// pieces at their start, 1: the finished code), y the piece count's turns.
// Each motion moves solid pieces only: a domino turns about its bottom edge,
// a marble rolls (it turns by the distance over its radius), a tile turns
// over about its hinge.

const num = (x) => {
  const s = Number(x).toFixed(6);
  return s.includes(".") ? s : `${s}.0`;
};
const v3 = (c) => c.map(num).join(", ");

const GLSL_HEAD = (k) => `
uniform vec4 uSpClock;
uniform vec4 uSpKit;
uniform vec4 uSpMorph;
uniform vec4 uSpCam;
const float QN = ${num(k.N)};
const vec3 QC = vec3(${v3(k.C)});
const float QS = ${num(k.S)};
const vec3 QFG = vec3(${v3(k.fg)});
const vec3 QBG = vec3(${v3(k.bg)});
vec4 qcQ = vec4(0.0, 0.0, 0.0, 1.0);
float qcAlpha = 1.0;
float qcBack = -1.0; // 0 or 1: show the plain light or dark of the module
float qcShade = 1.0;
vec3 qcRot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
vec4 qcAxis(vec3 a, float t) { return vec4(normalize(a) * sin(t * 0.5), cos(t * 0.5)); }
vec4 qcMul(vec4 a, vec4 b) { return vec4(a.w * b.xyz + b.w * a.xyz + cross(a.xyz, b.xyz), a.w * b.w - dot(a.xyz, b.xyz)); }
float qcSat(float x) { return clamp(x, 0.0, 1.0); }
float qcInOut(float x) { x = qcSat(x); return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 3.0) / 2.0; }
float qcMod(float a, float b) { return a - b * floor(a / b + 1e-4); }
vec3 qcPivot(float id) {
  float row = floor((id + 0.5) / QN);
  float col = id - row * QN;
  return vec3(col - QN * 0.5 + 0.5, QN * 0.5 - 0.5 - row, 0.0);
}
void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {
  rotation = qcMul(qcQ, rotation);
  scale *= uSpClock.y;
}
void modifySplatColor(vec3 center, inout vec4 color) {
  vec3 c = color.rgb;
  if (qcBack > -0.5) c = qcBack > 0.5 ? QFG : QBG;
  color = vec4(c * qcShade * uSpClock.z, color.a * qcAlpha);
}
`;

const WGSL_HEAD = (k) => `
uniform uSpClock: vec4f;
uniform uSpKit: vec4f;
uniform uSpMorph: vec4f;
uniform uSpCam: vec4f;
const QN: f32 = ${num(k.N)};
const QC = vec3f(${v3(k.C)});
const QS: f32 = ${num(k.S)};
const QFG = vec3f(${v3(k.fg)});
const QBG = vec3f(${v3(k.bg)});
var<private> qcQ: vec4f = vec4f(0.0, 0.0, 0.0, 1.0);
var<private> qcAlpha: f32 = 1.0;
var<private> qcBack: f32 = -1.0;
var<private> qcShade: f32 = 1.0;
fn qcRot(q: vec4f, v: vec3f) -> vec3f { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
fn qcAxis(a: vec3f, t: f32) -> vec4f { return vec4f(normalize(a) * sin(t * 0.5), cos(t * 0.5)); }
fn qcMul(a: vec4f, b: vec4f) -> vec4f { return vec4f(a.w * b.xyz + b.w * a.xyz + cross(a.xyz, b.xyz), a.w * b.w - dot(a.xyz, b.xyz)); }
fn qcSat(x: f32) -> f32 { return clamp(x, 0.0, 1.0); }
fn qcInOut(x0: f32) -> f32 {
  let x = qcSat(x0);
  if (x < 0.5) { return 4.0 * x * x * x; }
  return 1.0 - pow(-2.0 * x + 2.0, 3.0) / 2.0;
}
fn qcMod(a: f32, b: f32) -> f32 { return a - b * floor(a / b + 1e-4); }
fn qcPivot(id: f32) -> vec3f {
  let row = floor((id + 0.5) / QN);
  let col = id - row * QN;
  return vec3f(col - QN * 0.5 + 0.5, QN * 0.5 - 0.5 - row, 0.0);
}
fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {
  *rotation = qcMul(qcQ, *rotation);
  *scale = *scale * uniform.uSpClock.y;
}
fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
  var c = (*color).rgb;
  if (qcBack > -0.5) { c = select(QBG, QFG, qcBack > 0.5); }
  *color = vec4f(c * qcShade * uniform.uSpClock.z, (*color).a * qcAlpha);
}
`;

const head = (o, fit) => ({ N: o.size, C: fit.center, S: fit.scale, fg: o.fg, bg: o.bg });

// ---- Picture QR -----------------------------------------------------------------------------

// o: { size, fg, bg }.
export function pictureModifier(o, fit) {
  const k = head(o, fit);
  // The wave crosses the code in the first 60% of the tap; each tile turns
  // in 40% of it.
  const glsl = `${GLSL_HEAD(k)}
void modifySplatCenter(inout vec3 center) {
  vec4 an = loadSplatAnim();
  if (an.z < 0.5) return;
  float kind = qcMod(an.w, 16.0);
  vec3 piv = qcPivot(an.z - 1.0);
  vec3 u = center / QS + QC;
  float far = length(piv.xy - uSpMorph.zw) / (QN * 1.42);
  float s = qcInOut((uSpMorph.x - 0.6 * far) / 0.4);
  if (s <= 0.0 || s >= 1.0) return;
  float th = 6.2831853 * s;
  vec4 q = qcAxis(vec3(0.0, 1.0, 0.0), th);
  u = piv + qcRot(q, u - piv) + vec3(0.0, 0.0, 0.7 * sin(3.1415927 * s));
  float c = cos(th);
  if (c < 0.0) qcBack = kind > 1.5 ? 1.0 : 0.0;
  qcShade = 0.82 + 0.18 * abs(c);
  qcQ = q;
  center = (u - QC) * QS;
}
`;
  const wgsl = `${WGSL_HEAD(k)}
fn modifySplatCenter(center: ptr<function, vec3f>) {
  let an = loadSplatAnim();
  if (an.z < 0.5) { return; }
  let kind = qcMod(an.w, 16.0);
  let piv = qcPivot(an.z - 1.0);
  var u = *center / QS + QC;
  let far = length(piv.xy - uniform.uSpMorph.zw) / (QN * 1.42);
  let s = qcInOut((uniform.uSpMorph.x - 0.6 * far) / 0.4);
  if (s <= 0.0 || s >= 1.0) { return; }
  let th = 6.2831853 * s;
  let q = qcAxis(vec3f(0.0, 1.0, 0.0), th);
  u = piv + qcRot(q, u - piv) + vec3f(0.0, 0.0, 0.7 * sin(3.1415927 * s));
  let c = cos(th);
  if (c < 0.0) { qcBack = select(0.0, 1.0, kind > 1.5); }
  qcShade = 0.82 + 0.18 * abs(c);
  qcQ = q;
  *center = (u - QC) * QS;
}
`;
  return { glsl, wgsl };
}

// ---- Build a code -------------------------------------------------------------------------

// o: { size, fg, bg, secs (the build's length), fall, roll, flip (each
// piece's motion, seconds), dominoT, marbleR, tileT, startX (where marbles
// roll in from, code units), span (how long the tiles' wave takes) }.
export function buildModifier(o, fit) {
  const k = head(o, fit);
  const body = (W) => {
    // W: the WGSL spelling switches (uniform. prefix, let/var, select).
    const W0 = (n) => (W ? `var ${n}` : `float ${n}`);
    const U = W ? "uniform." : "";
    const v = W ? "var" : "float";
    const vv = W ? "var" : "vec3";
    const vq = W ? "var" : "vec4";
    const c3 = W ? "vec3f" : "vec3";
    const c4 = W ? "vec4f" : "vec4";
    const f = W ? "let" : "float";
    const f3 = W ? "let" : "vec3";
    const f4 = W ? "let" : "vec4";
    return `
  ${f4} an = loadSplatAnim();
  if (an.z < 0.5) { return; }
  ${f} kind = qcMod(an.w, 16.0);
  ${f} start = floor((an.w + 0.5) / 16.0) / 1000.0;
  ${f3} piv = qcPivot(an.z - 1.0);
  ${vv} u = ${W ? "*center" : "center"} / QS + QC;
  ${f} tau = ${U}uSpMorph.x * ${num(o.secs)};
  ${vq} q = ${c4}(0.0, 0.0, 0.0, 1.0);
  if (kind > 2.5 && kind < 3.5) {
    // A domino: it stands on its left end (turned a quarter turn about its
    // bottom left edge) until its turn, then topples like a rod about that
    // edge, faster and faster, lands, and bounces a little.
    ${f} s = (tau - start) / ${num(o.fall)};
    ${v} ang = 1.5707963;
    if (s >= 0.0 && s < 1.0) { ang = 1.5707963 * (1.0 - pow(s, 1.8)); }
    if (s >= 1.0) { ang = 0.06 * sin(3.1415927 * qcSat((s - 1.0) / 0.3)) * (1.0 - qcSat((s - 1.0) / 0.3)); }
    if (s < 0.0) { ang = 1.5707963 - 0.02 * qcSat(1.0 + s * 4.0); }
    ${f3} pv = ${c3}(piv.x - 0.5, u.y, 0.0);
    q = qcAxis(${c3}(0.0, -1.0, 0.0), ang);
    u = pv + qcRot(q, u - pv);
  }
  if (kind > 3.5 && kind < 4.5) {
    // A marble rolls in from the right edge along its row, slowing as a ball
    // on a mat does, rocks once in its cup and stops. It turns by the
    // distance rolled over its radius.
    ${f} s = (tau - start) / ${num(o.roll)};
    ${f} L = ${num(o.startX)} - piv.x;
    ${v} x = piv.x + L * pow(1.0 - qcSat(s), 2.0);
    ${f} e = qcSat((s - 1.0) / 0.35);
    if (s > 1.0) { x = piv.x + 0.07 * sin(6.2831853 * e) * (1.0 - e); }
    if (s < 0.0) { x = piv.x + L; }
    qcAlpha = qcSat(s * 12.0);
    ${f3} c0 = ${c3}(piv.x, piv.y, ${num(o.marbleR)});
    ${f3} rel = u - c0;
    q = qcAxis(${c3}(0.0, -1.0, 0.0), -(x - piv.x) / ${num(o.marbleR)});
    ${f3} nr = normalize(rel);
    ${f3} nn = qcRot(q, nr);
    ${f3} Ld = normalize(${c3}(-0.45, 0.5, 0.74));
    qcShade = (0.55 + 0.45 * max(0.0, dot(nn, Ld))) / (0.55 + 0.45 * max(0.0, dot(nr, Ld)));
    u = ${c3}(x, piv.y, ${num(o.marbleR)}) + qcRot(q, rel);
  }
  if (kind > 6.5 && kind < 7.5) {
    // A frame drops into the tray from above, lands and bounces once.
    ${f} s = qcSat((tau - start) / ${num(o.drop)});
    ${W0("h")} = 0.35 * sin(3.1415927 * qcSat((s - 0.7) / 0.3));
    if (s < 0.7) { h = 7.0 * (1.0 - (s / 0.7) * (s / 0.7)); }
    u.z += h;
    qcAlpha = select(1.0, 0.0, tau < start);
  }
  if ((kind > 4.5 && kind < 5.5) || (kind > 7.5 && kind < 9.5)) {
    // A tile turns over about its middle, lifting as it turns, in a wave out
    // from the tap.
    // The wave reaches the farthest corner just in time for its last flip.
    ${f} far = length(piv.xy - ${U}uSpMorph.zw) / length(abs(${U}uSpMorph.zw) + ${W ? "vec2f" : "vec2"}(QN * 0.5, QN * 0.5));
    ${f} jit = fract(sin(an.z * 12.9898) * 43758.5453);
    ${f} st = far * ${num(o.span)} + 0.15 * jit;
    ${f} s = qcInOut((tau - st) / ${num(o.flip)});
    ${f3} c0 = ${c3}(piv.x, piv.y, ${num(o.tileT * 0.5)});
    q = qcAxis(${c3}(1.0, 0.0, 0.0), 3.1415927 * (1.0 - s));
    u = c0 + qcRot(q, u - c0) + ${c3}(0.0, 0.0, 0.9 * sin(3.1415927 * s));
    qcShade = 0.8 + 0.2 * abs(cos(3.1415927 * s));
    // The top faces the viewer while cos > 0, the bottom while cos < 0.
    ${f} up = cos(3.1415927 * (1.0 - s));
    if (kind < 5.5 && up < 0.0) { qcAlpha = 0.0; }
    if (kind > 7.5 && kind < 8.5 && up > 0.0) { qcAlpha = 0.0; }
  }
  qcQ = q;
  ${W ? "*center" : "center"} = (u - QC) * QS;
`;
  };
  const glsl = `${GLSL_HEAD(k)}
float select(float a, float b, bool c) { return c ? b : a; }
void modifySplatCenter(inout vec3 center) {${body(false)}}
`;
  const wgsl = `${WGSL_HEAD(k)}
fn modifySplatCenter(center: ptr<function, vec3f>) {${body(true)}}
`;
  return { glsl, wgsl };
}

// ---- Other barcodes ------------------------------------------------------------------------

// o: { size (unused, 1), half (the symbol's half width, code units), lift }.
// uSpMorph x the scan's progress (0..1). Kind 1: a bar or module (extra: its
// center x in hundredths of a module, + 100000); kind 2: the scan line.
export function scanModifier(o, fit) {
  const k = head({ size: 1, fg: [0, 0, 0], bg: [1, 1, 1] }, fit);
  const body = (W) => {
    const U = W ? "uniform." : "";
    const f = W ? "let" : "float";
    const vv = W ? "var" : "vec3";
    const ctr = W ? "*center" : "center";
    return `
  ${W ? "let" : "vec4"} an = loadSplatAnim();
  ${f} kind = qcMod(an.w, 16.0);
  if (kind < 0.5) { return; }
  ${vv} u = ${ctr} / QS + QC;
  ${f} p = ${U}uSpMorph.x;
  // The line sweeps from the left quiet zone to the right one.
  ${f} lx = -${num(o.half)} - 2.0 + p * (2.0 * ${num(o.half)} + 4.0);
  ${f} on = select(0.0, 1.0, p > 0.0005 && p < 0.9995);
  if (kind > 1.5) {
    u.x += lx;
    qcAlpha = on;
  } else {
    // Each bar (or module) lifts toward the viewer as the line passes it,
    // as one solid piece, and settles back.
    ${f} cx = (floor((an.w + 0.5) / 16.0) - 100000.0) / 100.0;
    ${f} d = (cx - lx) / ${num(o.width)};
    u.z += on * ${num(o.lift)} * exp(-d * d);
    qcShade = 1.0 - on * 0.12 * exp(-d * d);
  }
  ${ctr} = (u - QC) * QS;
`;
  };
  // WGSL has no ?: and GLSL no select(f, t, c) for floats; spell each.
  const glsl = `${GLSL_HEAD(k)}
float select(float a, float b, bool c) { return c ? b : a; }
void modifySplatCenter(inout vec3 center) {${body(false)}}
`;
  const wgsl = `${WGSL_HEAD(k)}
fn modifySplatCenter(center: ptr<function, vec3f>) {${body(true)}}
`;
  return { glsl, wgsl };
}

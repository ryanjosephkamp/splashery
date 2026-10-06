// Lane QR lab r2: the labs GPU programs (docs/lab/FIELDS.md) that move the
// two toys' modules. Every splat carries two numbers (its params):
//   a  0 for a splat that never moves on its own; else 1 + an id: for a
//      module, code * size² + row * size + col (its pivot is the module's
//      center); for a burned chunk, 1 + (gx + 512) + 1024 * (gy + 512), its
//      cell on a two-module grid
//   b  kind + 16 * extra, kind (0..15):
//        0 a plain module or sheet        1 a sticker (drops on)
//        2 the torn corner (flies off)    3 a burned chunk (crumbles away)
//        4 the table behind (never bent)  5 a module a block's healing flips
//                                           (extra: the block)
//        6 anatomy: a data or error correction module (extra: its place on
//          the zigzag path, in bits); Damage lab: a module new damage
//          recolors (extra: 2 × its turn, 0..200, + 1 if it was dark)
//        + 8 lifted by the highlight (the parts of a code)
//
// "How a QR code works" (anatomyModifier): uSpMorph x the placement's
// progress (1: every bit placed), y the mask's flip (0..1), z the highlight's
// lift (0..1), w the mask (0..7).
// The Damage lab (damageModifier): uSpMorph x the latest damage's motion (0
// just tapped, 1 at rest), y the healing (blocks done, 0..n), z tilt (0..1),
// w curve (0..1); the first game-token slot carries the wave ("move in
// time"): its visibility the amount, its first rotation number the phase.
// Tilt, curve and the wave follow src/qr-lab/damage.js (warpPoint) exactly,
// so the lab's meter can find every module.
//
// Each motion holds every module as a solid piece: it turns and moves about
// its own center.

const num = (x) => {
  const s = Number(x).toFixed(6);
  return s.includes(".") ? s : `${s}.0`;
};
const v3 = (c) => c.map(num).join(", ");

// The parts both programs share, GLSL.
const GLSL_HEAD = (k) => `
uniform vec4 uSpClock;
uniform vec4 uSpKit;
uniform vec4 uSpMorph;
uniform vec4 uSpCam;
uniform vec4 uSpTokens[96];
const float QN = ${num(k.N)};
const vec3 QC = vec3(${v3(k.C)});
const float QS = ${num(k.S)};
const vec3 QFG = vec3(${v3(k.fg)});
const vec3 QBG = vec3(${v3(k.bg)});
vec4 qlQ = vec4(0.0, 0.0, 0.0, 1.0);
float qlAlpha = 1.0;
float qlBack = 0.0;
float qlAsh = 0.0;
float qlOrig = -1.0; // 0 or 1: show the module's color from before the damage
float qlHash(float n) { return fract(sin(n * 12.9898 + 4.1414) * 43758.5453); }
vec3 qlRot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
vec4 qlAxis(vec3 a, float t) { return vec4(normalize(a) * sin(t * 0.5), cos(t * 0.5)); }
vec4 qlMul(vec4 a, vec4 b) { return vec4(a.w * b.xyz + b.w * a.xyz + cross(a.xyz, b.xyz), a.w * b.w - dot(a.xyz, b.xyz)); }
float qlSat(float x) { return clamp(x, 0.0, 1.0); }
float qlInOut(float x) { x = qlSat(x); return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 3.0) / 2.0; }
float qlMod(float a, float b) { return a - b * floor(a / b + 1e-4); }
// A module's center in code units, from its id.
vec3 qlPivot(float id) {
  float S = QN * QN;
  float code = floor((id + 0.5) / S);
  float m = id - code * S;
  float row = floor((m + 0.5) / QN);
  float col = m - row * QN;
  vec2 o = ${k.offsetsGLSL};
  return vec3(o.x + col - QN * 0.5 + 0.5, o.y + QN * 0.5 - 0.5 - row, 0.0);
}
vec3 qlRowCol(float id) {
  float S = QN * QN;
  float code = floor((id + 0.5) / S);
  float m = id - code * S;
  float row = floor((m + 0.5) / QN);
  return vec3(row, m - row * QN, code);
}
void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {
  rotation = qlMul(qlQ, rotation);
  scale *= uSpClock.y;
}
void modifySplatColor(vec3 center, inout vec4 color) {
  vec3 c = color.rgb;
  if (qlOrig > -0.5) c = qlOrig > 0.5 ? QFG : QBG;
  float mid = 0.5 * (dot(QFG, vec3(0.2126, 0.7152, 0.0722)) + dot(QBG, vec3(0.2126, 0.7152, 0.0722)));
  vec3 other = dot(c, vec3(0.2126, 0.7152, 0.0722)) < mid ? QBG : QFG;
  c = mix(c, other, qlBack);
  c = mix(c, vec3(0.42, 0.4, 0.38), qlAsh);
  color = vec4(c * uSpClock.z, color.a * qlAlpha);
}
`;

const WGSL_HEAD = (k) => `
uniform uSpClock: vec4f;
uniform uSpKit: vec4f;
uniform uSpMorph: vec4f;
uniform uSpCam: vec4f;
uniform uSpTokens: array<vec4f, 96>;
const QN: f32 = ${num(k.N)};
const QC = vec3f(${v3(k.C)});
const QS: f32 = ${num(k.S)};
const QFG = vec3f(${v3(k.fg)});
const QBG = vec3f(${v3(k.bg)});
var<private> qlQ: vec4f = vec4f(0.0, 0.0, 0.0, 1.0);
var<private> qlAlpha: f32 = 1.0;
var<private> qlBack: f32 = 0.0;
var<private> qlAsh: f32 = 0.0;
var<private> qlOrig: f32 = -1.0;
fn qlHash(n: f32) -> f32 { return fract(sin(n * 12.9898 + 4.1414) * 43758.5453); }
fn qlRot(q: vec4f, v: vec3f) -> vec3f { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
fn qlAxis(a: vec3f, t: f32) -> vec4f { return vec4f(normalize(a) * sin(t * 0.5), cos(t * 0.5)); }
fn qlMul(a: vec4f, b: vec4f) -> vec4f { return vec4f(a.w * b.xyz + b.w * a.xyz + cross(a.xyz, b.xyz), a.w * b.w - dot(a.xyz, b.xyz)); }
fn qlSat(x: f32) -> f32 { return clamp(x, 0.0, 1.0); }
fn qlInOut(x0: f32) -> f32 {
  let x = qlSat(x0);
  if (x < 0.5) { return 4.0 * x * x * x; }
  return 1.0 - pow(-2.0 * x + 2.0, 3.0) / 2.0;
}
fn qlMod(a: f32, b: f32) -> f32 { return a - b * floor(a / b + 1e-4); }
fn qlPivot(id: f32) -> vec3f {
  let S = QN * QN;
  let code = floor((id + 0.5) / S);
  let m = id - code * S;
  let row = floor((m + 0.5) / QN);
  let col = m - row * QN;
  let o = ${k.offsetsWGSL};
  return vec3f(o.x + col - QN * 0.5 + 0.5, o.y + QN * 0.5 - 0.5 - row, 0.0);
}
fn qlRowCol(id: f32) -> vec3f {
  let S = QN * QN;
  let code = floor((id + 0.5) / S);
  let m = id - code * S;
  let row = floor((m + 0.5) / QN);
  return vec3f(row, m - row * QN, code);
}
fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {
  *rotation = qlMul(qlQ, *rotation);
  *scale = *scale * uniform.uSpClock.y;
}
fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
  var c = (*color).rgb;
  if (qlOrig > -0.5) { c = select(QBG, QFG, qlOrig > 0.5); }
  let W = vec3f(0.2126, 0.7152, 0.0722);
  let mid = 0.5 * (dot(QFG, W) + dot(QBG, W));
  let other = select(QFG, QBG, dot(c, W) < mid);
  c = mix(c, other, qlBack);
  c = mix(c, vec3f(0.42, 0.4, 0.38), qlAsh);
  *color = vec4f(c * uniform.uSpClock.z, (*color).a * qlAlpha);
}
`;

// The code centers (code units) as a GLSL / WGSL expression of `code`.
function offsets(list) {
  const pick = (vec) => {
    let e = `${vec}(${num(list[0][0])}, ${num(list[0][1])})`;
    for (let i = 1; i < list.length; i++)
      e = `(code > ${num(i - 0.5)} ? ${vec}(${num(list[i][0])}, ${num(list[i][1])}) : ${e})`;
    return e;
  };
  const glsl = pick("vec2");
  // WGSL has no ?: ; select(f, t, cond).
  let wgsl = `vec2f(${num(list[0][0])}, ${num(list[0][1])})`;
  for (let i = 1; i < list.length; i++) wgsl = `select(${wgsl}, vec2f(${num(list[i][0])}, ${num(list[i][1])}), code > ${num(i - 0.5)})`; // prettier-ignore
  return { glsl, wgsl };
}

function head(o, fit) {
  const off = offsets(o.offsets || [[0, 0]]);
  return { N: o.size, C: fit.center, S: fit.scale, fg: o.fg, bg: o.bg, offsetsGLSL: off.glsl, offsetsWGSL: off.wgsl }; // prettier-ignore
}

// ---- How a QR code works --------------------------------------------------------------------

// o: { size, fg, bg, total (data bits placed) }.
export function anatomyModifier(o, fit) {
  const k = head(o, fit);
  const T = Math.max(1, o.total);
  const W = Math.max(10, T * 0.05);
  const glsl = `${GLSL_HEAD(k)}
bool qlMask(float m, float row, float col) {
  float x = col; float y = row;
  if (m < 0.5) return qlMod(x + y, 2.0) < 0.5;
  if (m < 1.5) return qlMod(y, 2.0) < 0.5;
  if (m < 2.5) return qlMod(x, 3.0) < 0.5;
  if (m < 3.5) return qlMod(x + y, 3.0) < 0.5;
  if (m < 4.5) return qlMod(floor(x / 3.0) + floor(y / 2.0), 2.0) < 0.5;
  if (m < 5.5) return qlMod(x * y, 2.0) + qlMod(x * y, 3.0) < 0.5;
  if (m < 6.5) return qlMod(qlMod(x * y, 2.0) + qlMod(x * y, 3.0), 2.0) < 0.5;
  return qlMod(qlMod(x + y, 2.0) + qlMod(x * y, 3.0), 2.0) < 0.5;
}
void modifySplatCenter(inout vec3 center) {
  vec4 an = loadSplatAnim();
  if (an.z < 0.5) return;
  float id = an.z - 1.0;
  float kind = qlMod(an.w, 16.0);
  float extra = floor((an.w + 0.5) / 16.0);
  vec3 piv = (qlPivot(id) - QC) * QS;
  vec3 rel = center - piv;
  vec3 off = vec3(0.0);
  vec4 q = vec4(0.0, 0.0, 0.0, 1.0);
  vec3 rc = qlRowCol(id);
  float base = qlMod(kind, 8.0);
  if (base > 5.5) {
    // Placement: bit by bit along the zigzag path, each module dropping in.
    float s = qlSat((uSpMorph.x * ${num(T + W)} - extra) / ${num(W)});
    off.z += (1.0 - s) * (1.0 - s) * 5.0 * QS;
    qlAlpha = smoothstep(0.0, 0.25, s);
    // The mask: the modules it covers turn over, in a diagonal wave.
    if (qlMask(uSpMorph.w, rc.x, rc.y)) {
      float d = 0.35 * (rc.x + rc.y) / max(2.0 * QN - 2.0, 1.0);
      float th = 3.1415927 * qlInOut((uSpMorph.y - d) / 0.6);
      q = qlMul(qlAxis(vec3(0.7071, 0.7071, 0.0), th), q);
      off.z += abs(sin(th)) * 0.6 * QS;
      qlBack = cos(th) < 0.0 ? 1.0 : 0.0;
    }
  }
  if (kind > 7.5) off.z += uSpMorph.z * (0.9 + 0.15 * sin(uSpKit.x * 3.0)) * QS;
  vec3 p = piv + qlRot(q, rel) + off;
  // Pop out: the lit part comes off the code as one piece, tipping toward
  // the viewer about the code's middle and floating in front of it.
  float pop = uSpTokens[0].w;
  if (kind > 7.5 && pop > 0.0) {
    vec3 mid = -QC * QS;
    vec4 tip = qlAxis(vec3(1.0, 0.0, 0.0), -0.55 * pop);
    p = mid + qlRot(tip, p - mid) + vec3(0.0, 0.9 * pop, 4.5 * pop + 0.25 * pop * sin(uSpKit.x * 2.0)) * QS;
    q = qlMul(tip, q);
  }
  qlQ = q;
  center = p;
}
`;
  const wgsl = `${WGSL_HEAD(k)}
fn qlMask(m: f32, row: f32, col: f32) -> bool {
  let x = col; let y = row;
  if (m < 0.5) { return qlMod(x + y, 2.0) < 0.5; }
  if (m < 1.5) { return qlMod(y, 2.0) < 0.5; }
  if (m < 2.5) { return qlMod(x, 3.0) < 0.5; }
  if (m < 3.5) { return qlMod(x + y, 3.0) < 0.5; }
  if (m < 4.5) { return qlMod(floor(x / 3.0) + floor(y / 2.0), 2.0) < 0.5; }
  if (m < 5.5) { return qlMod(x * y, 2.0) + qlMod(x * y, 3.0) < 0.5; }
  if (m < 6.5) { return qlMod(qlMod(x * y, 2.0) + qlMod(x * y, 3.0), 2.0) < 0.5; }
  return qlMod(qlMod(x + y, 2.0) + qlMod(x * y, 3.0), 2.0) < 0.5;
}
fn modifySplatCenter(center: ptr<function, vec3f>) {
  let an = loadSplatAnim();
  if (an.z < 0.5) { return; }
  let id = an.z - 1.0;
  let kind = qlMod(an.w, 16.0);
  let extra = floor((an.w + 0.5) / 16.0);
  let piv = (qlPivot(id) - QC) * QS;
  let rel = *center - piv;
  var off = vec3f(0.0);
  var q = vec4f(0.0, 0.0, 0.0, 1.0);
  let rc = qlRowCol(id);
  let base = qlMod(kind, 8.0);
  if (base > 5.5) {
    let s = qlSat((uniform.uSpMorph.x * ${num(T + W)} - extra) / ${num(W)});
    off.z += (1.0 - s) * (1.0 - s) * 5.0 * QS;
    qlAlpha = smoothstep(0.0, 0.25, s);
    if (qlMask(uniform.uSpMorph.w, rc.x, rc.y)) {
      let d = 0.35 * (rc.x + rc.y) / max(2.0 * QN - 2.0, 1.0);
      let th = 3.1415927 * qlInOut((uniform.uSpMorph.y - d) / 0.6);
      q = qlMul(qlAxis(vec3f(0.7071, 0.7071, 0.0), th), q);
      off.z += abs(sin(th)) * 0.6 * QS;
      qlBack = select(0.0, 1.0, cos(th) < 0.0);
    }
  }
  if (kind > 7.5) { off.z += uniform.uSpMorph.z * (0.9 + 0.15 * sin(uniform.uSpKit.x * 3.0)) * QS; }
  var p = piv + qlRot(q, rel) + off;
  let pop = uniform.uSpTokens[0].w;
  if (kind > 7.5 && pop > 0.0) {
    let mid = -QC * QS;
    let tip = qlAxis(vec3f(1.0, 0.0, 0.0), -0.55 * pop);
    p = mid + qlRot(tip, p - mid) + vec3f(0.0, 0.9 * pop, 4.5 * pop + 0.25 * pop * sin(uniform.uSpKit.x * 2.0)) * QS;
    q = qlMul(tip, q);
  }
  qlQ = q;
  *center = p;
}
`;
  return { glsl, wgsl };
}

// ---- The Damage lab ---------------------------------------------------------------------------

// o: { size, fg, bg, offsets, width (the plate's width, code units, for the
// curve), torn: [x, y] (the torn piece's center, code units) }.
export function damageModifier(o, fit) {
  const k = head(o, fit);
  const W = o.width;
  const tp = o.torn || [0, 0];
  // Curve radius over the amount: R = W / (a · 200/180 · π) (damage.js).
  const curveK = W / ((200 / 180) * Math.PI);
  const tiltMax = (80 * Math.PI) / 180;
  const glsl = `${GLSL_HEAD(k)}
// The plate's bend and turn (damage.js, warpPoint): curve, then tilt.
vec3 qlWarp(vec3 p, out float turn) {
  turn = 0.0;
  float ca = uSpMorph.w;
  if (ca > 0.0005) {
    float R = ${num(curveK)} / ca;
    float th = p.x / R;
    p = vec3((R + p.z) * sin(th), p.y, (R + p.z) * cos(th) - R);
    turn += th;
  }
  float ta = uSpMorph.z * ${num(tiltMax)};
  if (ta > 0.0) {
    p = vec3(p.x * cos(ta) + p.z * sin(ta), p.y, -p.x * sin(ta) + p.z * cos(ta));
    turn += ta;
  }
  return p;
}
void modifySplatCenter(inout vec3 center) {
  vec4 an = loadSplatAnim();
  float kind = qlMod(an.w, 16.0);
  float extra = floor((an.w + 0.5) / 16.0);
  if (kind > 3.5 && kind < 4.5) return; // the table
  vec3 u = center / QS + QC; // code units
  vec4 q = vec4(0.0, 0.0, 0.0, 1.0);
  float D = uSpMorph.x;
  if (an.z > 0.5 && (kind < 2.5 || (kind > 4.5 && kind < 6.5))) {
    float id = an.z - 1.0;
    vec3 piv = qlPivot(id);
    vec3 rc = qlRowCol(id);
    // Move in time: one moment of a wave through the modules.
    float A = uSpTokens[0].w * 0.6;
    if (A > 0.0 && (kind < 1.5 || kind > 4.5)) {
      float ph = 6.2831853 * (uSpTokens[1].x - (rc.x + rc.y) / QN);
      u += vec3(A * 0.6 * sin(ph), A * 0.6 * cos(ph * 0.7 + 1.0), A * 0.5 * (1.0 + sin(ph + 0.8)));
    }
    // Healing: the modules a block sets right turn over once its turn comes.
    if (kind > 4.5 && kind < 5.5) {
      float th = 3.1415927 * qlInOut(uSpMorph.y - extra);
      vec3 r = u - piv;
      q = qlAxis(vec3(0.0, 1.0, 0.0), th);
      u = piv + qlRot(q, r) + vec3(0.0, 0.0, abs(sin(th)) * 0.8);
      qlBack = cos(th) < 0.0 ? 1.0 : 0.0;
    }
  }
  if (kind > 5.5 && kind < 6.5) {
    // New damage arrives in order: a scratch along its line, a smudge out
    // from its middle, a burn's char out from the burn; until then the
    // module keeps its old color.
    float t = floor((extra + 0.5) / 2.0) / 200.0;
    if (D < 0.999 && D / 0.55 < t) qlOrig = qlMod(extra, 2.0);
  }
  if (kind > 0.5 && kind < 1.5) {
    // A sticker lands: it drops from in front, turning flat as it comes.
    float s = qlSat(D / 0.45);
    float fall = 1.0 - s * s;
    u.z += fall * 9.0;
    u.y += fall * 2.0;
    q = qlAxis(vec3(1.0, 0.3, 0.0), fall * 0.9);
  }
  if (kind > 1.5 && kind < 2.5) {
    // The torn corner peels up, then falls away tumbling, and is gone.
    float code = floor((an.z - 1.0 + 0.5) / (QN * QN));
    vec3 c = vec3(${num(tp[0])}, ${num(tp[1])}, 0.0) + qlPivot(code * QN * QN) - vec3(0.5 - QN * 0.5, QN * 0.5 - 0.5, 0.0);
    float t = D * 1.8;
    float peel = qlSat(t / 0.35);
    float fly = max(t - 0.35, 0.0);
    vec3 axis = vec3(${num(Math.sign(tp[0] * tp[1]) || 1)}, 1.0, 0.0);
    q = qlAxis(axis, 1.1 * peel + 4.0 * fly);
    vec3 drift = vec3(${num(Math.sign(tp[0]) || 1)} * 2.5 * fly, 3.0 * peel - 0.5 * 30.0 * fly * fly, 6.0 * peel + 4.0 * fly);
    u = c + qlRot(q, u - c) + drift;
    qlAlpha = D > 0.999 ? 0.0 : 1.0 - qlSat((t - 1.3) / 0.45);
  }
  if (kind > 2.5 && kind < 3.5) {
    // A burned chunk: it chars, cracks off and falls as ash, the edge first.
    float gx = qlMod(an.z - 1.0, 1024.0) - 512.0;
    float gy = floor((an.z - 1.0 + 0.5) / 1024.0) - 512.0;
    vec3 c = vec3(gx * 2.0 + 1.0, gy * 2.0 + 1.0, 0.0);
    float h = qlHash(an.z);
    float t = qlSat(D * 1.25 - 0.25 * h) * 1.6;
    qlAsh = qlSat(t / 0.4);
    float fly = max(t - 0.35, 0.0);
    q = qlAxis(vec3(h - 0.5, 0.5, 0.3), 5.0 * fly);
    u = c + qlRot(q, u - c) + vec3((h - 0.5) * 2.0 * fly, -0.5 * 25.0 * fly * fly, 2.0 * fly);
    qlAlpha = D > 0.999 ? 0.0 : 1.0 - qlSat((t - 1.0) / 0.5);
  }
  float turn;
  u = qlWarp(u, turn);
  if (turn != 0.0) q = qlMul(qlAxis(vec3(0.0, 1.0, 0.0), turn), q);
  qlQ = q;
  center = (u - QC) * QS;
}
`;
  const wgsl = `${WGSL_HEAD(k)}
var<private> qlTurn: f32 = 0.0;
fn qlWarp(p0: vec3f) -> vec3f {
  var p = p0;
  qlTurn = 0.0;
  let ca = uniform.uSpMorph.w;
  if (ca > 0.0005) {
    let R = ${num(curveK)} / ca;
    let th = p.x / R;
    p = vec3f((R + p.z) * sin(th), p.y, (R + p.z) * cos(th) - R);
    qlTurn += th;
  }
  let ta = uniform.uSpMorph.z * ${num(tiltMax)};
  if (ta > 0.0) {
    p = vec3f(p.x * cos(ta) + p.z * sin(ta), p.y, -p.x * sin(ta) + p.z * cos(ta));
    qlTurn += ta;
  }
  return p;
}
fn modifySplatCenter(center: ptr<function, vec3f>) {
  let an = loadSplatAnim();
  let kind = qlMod(an.w, 16.0);
  let extra = floor((an.w + 0.5) / 16.0);
  if (kind > 3.5 && kind < 4.5) { return; }
  var u = *center / QS + QC;
  var q = vec4f(0.0, 0.0, 0.0, 1.0);
  let D = uniform.uSpMorph.x;
  if (an.z > 0.5 && (kind < 2.5 || (kind > 4.5 && kind < 6.5))) {
    let id = an.z - 1.0;
    let piv = qlPivot(id);
    let rc = qlRowCol(id);
    let A = uniform.uSpTokens[0].w * 0.6;
    if (A > 0.0 && (kind < 1.5 || kind > 4.5)) {
      let ph = 6.2831853 * (uniform.uSpTokens[1].x - (rc.x + rc.y) / QN);
      u += vec3f(A * 0.6 * sin(ph), A * 0.6 * cos(ph * 0.7 + 1.0), A * 0.5 * (1.0 + sin(ph + 0.8)));
    }
    if (kind > 4.5 && kind < 5.5) {
      let th = 3.1415927 * qlInOut(uniform.uSpMorph.y - extra);
      let r = u - piv;
      q = qlAxis(vec3f(0.0, 1.0, 0.0), th);
      u = piv + qlRot(q, r) + vec3f(0.0, 0.0, abs(sin(th)) * 0.8);
      qlBack = select(0.0, 1.0, cos(th) < 0.0);
    }
  }
  if (kind > 5.5 && kind < 6.5) {
    let t = floor((extra + 0.5) / 2.0) / 200.0;
    if (D < 0.999 && D / 0.55 < t) { qlOrig = qlMod(extra, 2.0); }
  }
  if (kind > 0.5 && kind < 1.5) {
    let s = qlSat(D / 0.45);
    let fall = 1.0 - s * s;
    u.z += fall * 9.0;
    u.y += fall * 2.0;
    q = qlAxis(vec3f(1.0, 0.3, 0.0), fall * 0.9);
  }
  if (kind > 1.5 && kind < 2.5) {
    let code = floor((an.z - 1.0 + 0.5) / (QN * QN));
    let c = vec3f(${num(tp[0])}, ${num(tp[1])}, 0.0) + qlPivot(code * QN * QN) - vec3f(0.5 - QN * 0.5, QN * 0.5 - 0.5, 0.0);
    let t = D * 1.8;
    let peel = qlSat(t / 0.35);
    let fly = max(t - 0.35, 0.0);
    let axis = vec3f(${num(Math.sign(tp[0] * tp[1]) || 1)}, 1.0, 0.0);
    q = qlAxis(axis, 1.1 * peel + 4.0 * fly);
    let drift = vec3f(${num(Math.sign(tp[0]) || 1)} * 2.5 * fly, 3.0 * peel - 0.5 * 30.0 * fly * fly, 6.0 * peel + 4.0 * fly);
    u = c + qlRot(q, u - c) + drift;
    qlAlpha = select(1.0 - qlSat((t - 1.3) / 0.45), 0.0, D > 0.999);
  }
  if (kind > 2.5 && kind < 3.5) {
    let gx = qlMod(an.z - 1.0, 1024.0) - 512.0;
    let gy = floor((an.z - 1.0 + 0.5) / 1024.0) - 512.0;
    let c = vec3f(gx * 2.0 + 1.0, gy * 2.0 + 1.0, 0.0);
    let h = qlHash(an.z);
    let t = qlSat(D * 1.25 - 0.25 * h) * 1.6;
    qlAsh = qlSat(t / 0.4);
    let fly = max(t - 0.35, 0.0);
    q = qlAxis(vec3f(h - 0.5, 0.5, 0.3), 5.0 * fly);
    u = c + qlRot(q, u - c) + vec3f((h - 0.5) * 2.0 * fly, -0.5 * 25.0 * fly * fly, 2.0 * fly);
    qlAlpha = select(1.0 - qlSat((t - 1.0) / 0.5), 0.0, D > 0.999);
  }
  u = qlWarp(u);
  if (qlTurn != 0.0) { q = qlMul(qlAxis(vec3f(0.0, 1.0, 0.0), qlTurn), q); }
  qlQ = q;
  *center = (u - QC) * QS;
}
`;
  return { glsl, wgsl };
}

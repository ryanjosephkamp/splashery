// Lane QR: the code's motions, as a program on the graphics chip (the labs
// work-buffer hook, docs/lab/FIELDS.md). Every splat knows its piece (a
// module, a finder or an alignment pattern: src/qr/build.js), so the program
// moves and turns each piece as one solid tile about its own center.
//
// One motion runs at a time: uSpMorph.x says which (MOTION_IDS) and
// uSpMorph.y how far it has gone (0..1); zw is the tap point (in modules from
// the code's center) for Knock loose. Each is exactly the rest pose at 0 and
// at 1, so the code always ends back on its grid.
//
//   1 Assemble: the pieces fly off, then fly back in from all sides and lock
//     into place, the middle first.
//   2 Flip: the pieces turn over like tiles in a diagonal wave, lifting as
//     they turn, show their other color, then turn back.
//   3 Burst and return: the pieces burst off, tumble and fall under gravity
//     to a floor, then fly back to their places in a wave.
//   Lane QR r3 (October 5, 2026):
//   4 Ripple: a ring wave runs out from the middle; each tile rides it,
//     rising, falling and tilting with the slope under it.
//   5 Split-flap: row by row, like a departure board, each tile flips over
//     on its own axle, shows its back, and comes round to the front again.
//   6 Fold: the code folds like paper (the right half over the left, then
//     the top down over the bottom), then unfolds; the paper's back is plain.
//     Here the light sheet moves too, each splat by where it is.
//   7 Rain: the pieces lift off the top, then rain back down, bottom row
//     first, land with a small bounce and stack into place.
//   8 Knock loose: the pieces around the tap are knocked out toward you,
//     tumble, and snap back on a spring.
//   9 Point cloud: every splat shrinks to a point and the code dissolves into
//     a drifting, swirling cloud, which gathers back into the code.
//
// Alive (uSpGlowC.x, 0..1) colors the code while it lies still; uSpGlowC.y is
// the pattern's phase (radians; the toy advances it at the chosen speed). The
// pattern is compiled in (PATTERNS): each moves a splat's hue toward a color
// while its gray, what a reader sees, stays the same, except the electric
// ones (current, charge, scan line), which may also brighten a dark module,
// but never by more than 35% of the way to the light ones (and a light
// module of an inverted code only brightens). Every frame scans: the scan lab
// reads them (docs/handoff/QRr3.md).
//
// The Gems style's glint passes only when the code is seen at an angle: in
// Scan view (front on) it never pales a module.

const num = (x) => {
  const s = Number(x).toFixed(6);
  return s.includes(".") ? s : `${s}.0`;
};
const vec3 = (c) => c.map(num).join(", ");

export const MOTION_IDS = { assemble: 1, flip: 2, burst: 3, ripple: 4, flap: 5, fold: 6, rain: 7, knock: 8, cloud: 9 }; // prettier-ignore
// How long each motion runs (seconds at normal speed).
export const MOTION_SECS = { assemble: 3.2, flip: 3.4, burst: 3.6, ripple: 3.8, flap: 4.2, fold: 5.0, rain: 4.4, knock: 2.8, cloud: 5.2 }; // prettier-ignore

// The Alive patterns. Every one repeats when its phase grows by 2π.
export const PATTERNS = [
  { id: "wave", label: "Wave" },
  { id: "sweep", label: "Sweep" },
  { id: "pulse", label: "Pulse" },
  { id: "flow", label: "Flowing gradient" },
  { id: "rainbow", label: "Rainbow" },
  { id: "current", label: "Current" },
  { id: "charge", label: "Charge" },
  { id: "scan", label: "Scan line" },
];
// The phase grows this fast (radians a second) at speed 1.
export const PHASE_RATE = 1.8;

// The shared math, in GLSL; the WGSL below says the same.
const GLSL = ({ N, C, S, back, glint, wave, wave2, bg, depth, pattern }) => `
uniform vec4 uSpClock;   // y splat scale, z exposure
uniform vec4 uSpKit;     // x the toy's clock
uniform vec4 uSpMorph;   // x which motion, y its progress (0..1), zw the tap (modules)
uniform vec4 uSpCam;     // xyz the camera's position
uniform vec4 uSpGlowC;   // x Alive (0..1), y its phase (radians)
const float QN = ${num(N)};
const vec3 QC = vec3(${vec3(C)});
const float QS = ${num(S)};
const vec3 QBACK = vec3(${vec3(back)});
const vec3 QWAVE = vec3(${vec3(wave)});
const vec3 QWAVE2 = vec3(${vec3(wave2)});
const vec3 QBG = vec3(${vec3(bg)});
const float QDEPTH = ${num(depth)};
const int QPAT = ${pattern | 0};
const vec3 QW = vec3(0.2126, 0.7152, 0.0722);
vec4 qrQ = vec4(0.0, 0.0, 0.0, 1.0);
float qrBack = 0.0;
float qrPaper = 0.0;
float qrGlint = 0.0;
float qrWave = 0.0;
float qrLift = 0.0;
float qrPt = 0.0;
vec3 qrTint = vec3(0.0);
float qrHash(float n) { return fract(sin(n * 12.9898 + 4.1414) * 43758.5453); }
vec3 qrRot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
vec4 qrAxis(vec3 a, float t) { return vec4(normalize(a) * sin(t * 0.5), cos(t * 0.5)); }
vec4 qrMul(vec4 a, vec4 b) { return vec4(a.w * b.xyz + b.w * a.xyz + cross(a.xyz, b.xyz), a.w * b.w - dot(a.xyz, b.xyz)); }
float qrSat(float x) { return clamp(x, 0.0, 1.0); }
float qrSq(float x) { return x * x; }
float qrOut3(float x) { float u = 1.0 - qrSat(x); return 1.0 - u * u * u; }
float qrInOut(float x) { x = qrSat(x); return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 3.0) / 2.0; }
vec3 qrHue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
// Fold (motion 6): p in modules; turns it about the two hinges, sets qrPaper
// where the paper's back faces the viewer, and returns the turn.
vec4 qrFold(inout vec3 p, float Q) {
  float a1 = 3.0159 * qrInOut(Q / 0.24) * (1.0 - qrInOut((Q - 0.76) / 0.2));
  float a2 = 3.0159 * qrInOut((Q - 0.27) / 0.21) * (1.0 - qrInOut((Q - 0.52) / 0.21));
  float h1 = QDEPTH + 0.18;
  float h2 = 2.0 * QDEPTH + 0.5;
  vec4 q = vec4(0.0, 0.0, 0.0, 1.0);
  float face = 1.0;
  if (p.x > 0.0 && a1 > 0.0) {
    float t = -a1;
    vec2 r = vec2(p.x, p.z - h1);
    p.x = r.x * cos(t) + r.y * sin(t);
    p.z = -r.x * sin(t) + r.y * cos(t) + h1;
    q = qrAxis(vec3(0.0, 1.0, 0.0), t);
    face *= cos(a1);
  }
  if (p.y > 0.0 && a2 > 0.0) {
    vec2 r = vec2(p.y, p.z - h2);
    p.y = r.x * cos(a2) - r.y * sin(a2);
    p.z = r.x * sin(a2) + r.y * cos(a2) + h2;
    q = qrMul(qrAxis(vec3(1.0, 0.0, 0.0), a2), q);
    face *= cos(a2);
  }
  qrPaper = face < 0.0 ? 1.0 : 0.0;
  return q;
}
void modifySplatCenter(inout vec3 center) {
  vec4 an = loadSplatAnim();
  float M = floor(uSpMorph.x + 0.5);
  float Q = uSpMorph.y;
  bool moving = Q > 0.0 && Q < 1.0;
  if (an.z < 0.5) {
    // The light sheet (an.w 20) folds with the code; nothing else of it moves.
    if (an.w > 19.5 && moving && M == 6.0) {
      vec3 p = center / QS + QC;
      qrQ = qrFold(p, Q);
      qrPaper = 0.0;
      center = (p - QC) * QS;
    }
    return;
  }
  float idx = an.z - 1.0;
  float row = floor((idx + 0.5) / QN);
  float col = idx - row * QN;
  float wide = mod(an.w, 10.0);
  bool eye = mod(an.w, 100.0) > 9.5;
  float path = floor(an.w / 100.0 + 0.001);
  vec2 m2 = vec2(col - QN * 0.5 + 0.5, QN * 0.5 - 0.5 - row); // the pivot, in modules
  vec3 piv = (vec3(m2, 0.0) - QC) * QS;
  vec3 rel = center - piv;
  vec3 off = vec3(0.0);
  vec4 q = vec4(0.0, 0.0, 0.0, 1.0);
  float h1 = qrHash(idx + 0.37);
  float h2 = qrHash(idx * 1.71 + 2.9);
  float h3 = qrHash(idx * 0.53 + 7.3);
  vec2 g = vec2(col, row) / max(QN - 1.0, 1.0); // 0..1 across the code
  float edge = QN * 0.5 * QS; // half the code's width (toy units)
  if (moving && M == 1.0) {
    // Assemble.
    float A = Q;
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
  } else if (moving && M == 2.0) {
    // Flip: two half turns in a diagonal wave, lifting off the sheet as it turns.
    float d = 0.26 * (g.x + g.y) * 0.5;
    float th = 3.1415927 * (qrInOut((Q - d) / 0.22) + qrInOut((Q - 0.5 - d) / 0.22));
    vec3 ax = eye ? vec3(0.0, 1.0, 0.0) : vec3(0.7071, 0.7071, 0.0);
    q = qrMul(qrAxis(ax, th), q);
    off.z += abs(sin(th)) * (wide * 0.5 + 0.3) * QS;
    qrBack = cos(th) < 0.0 ? 1.0 : 0.0;
  } else if (moving && M == 3.0) {
    // Burst and return.
    float B = Q;
    vec2 out2 = m2 * QS;
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
  } else if (moving && M == 4.0) {
    // Ripple: a ring wave out from the middle; height and slope in modules.
    float r = length(m2);
    float rf = Q * (QN * 0.72 + 12.0) - 4.0; // the wave's front
    float env = exp(-qrSq((r - rf + 2.5) / 3.2)) * sin(3.1415927 * Q);
    float ph = (r - rf) * 1.15;
    float z = 1.4 * env * sin(ph);
    float slope = 1.4 * env * 1.15 * cos(ph);
    vec2 dir = r > 1e-3 ? m2 / r : vec2(1.0, 0.0);
    off.z += z * QS;
    q = qrMul(qrAxis(vec3(dir.y, -dir.x, 0.0), atan(slope)), q);
  } else if (moving && M == 5.0) {
    // Split-flap: row by row, each tile a full turn on its own axle.
    float s = 0.04 + 0.74 * (row + 0.5 * (wide - 1.0)) / QN + 0.08 * col / QN;
    float th = 6.2831853 * qrInOut((Q - s) / 0.13);
    q = qrMul(qrAxis(vec3(1.0, 0.0, 0.0), th), q);
    off.z += abs(sin(th * 0.5)) * (wide * 0.5 + 0.2) * QS;
    qrBack = cos(th) < 0.0 ? 1.0 : 0.0;
  } else if (moving && M == 7.0) {
    // Rain: lift off the top, then fall back bottom row first (modules,
    // seconds), land with a small bounce and settle.
    float D = 4.4;
    float top = QN * 0.5 + 7.0 + 0.6 * (QN - 1.0 - row);
    float h = top - m2.y;
    float up = qrInOut(Q / 0.16);
    float s = 0.18 + 0.42 * (1.0 - (row + 0.5 * (wide - 1.0)) / QN) + 0.04 * h1;
    float G = 70.0;
    float tf = sqrt(2.0 * h / G);
    float tau = max(Q - s, 0.0) * D;
    float y;
    float spin;
    if (Q < s) { y = h * up; spin = up; }
    else if (tau < tf) { y = h - 0.5 * G * tau * tau; spin = 1.0 - tau / tf; }
    else {
      float b = tau - tf;
      y = 0.45 * exp(-7.0 * b) * abs(sin(10.0 * b));
      spin = 0.0;
    }
    y *= 1.0 - smoothstep(0.96, 1.0, Q);
    off.y += y * QS;
    off.z += 0.15 * spin * QS;
    q = qrMul(qrAxis(vec3(h3 - 0.5, 0.2, h1 - 0.5), 1.4 * (h2 - 0.5) * spin), q);
  } else if (moving && M == 8.0) {
    // Knock loose around the tap (zw): out toward the viewer with a tumble,
    // then back on a spring that overshoots a little.
    vec2 d = m2 - uSpMorph.zw;
    float r = length(d);
    float k = exp(-qrSq(r / 4.5));
    vec2 dir = r > 0.3 ? d / r : normalize(vec2(h1 - 0.5, h2 - 0.5) + 1e-3);
    float a;
    if (Q < 0.36) a = 1.0 - exp(-8.0 * Q / 0.36);
    else {
      float u = (Q - 0.36) / 0.64;
      a = exp(-4.5 * u) * cos(8.0 * u) * (1.0 - smoothstep(0.85, 1.0, u));
    }
    a *= k;
    off += vec3(dir * (1.6 + 1.2 * h1), 2.4 + 1.6 * h2) * a * QS;
    q = qrMul(qrAxis(vec3(-dir.y, dir.x, h3 - 0.5), (2.5 + 2.0 * h3) * a), q);
  }
  qrQ = q;
  center = piv + qrRot(q, rel) + off;
  if (moving && M == 6.0) {
    vec3 p = center / QS + QC;
    qrQ = qrMul(qrFold(p, Q), qrQ);
    center = (p - QC) * QS;
  } else if (moving && M == 9.0) {
    // Point cloud, each splat on its own (its rest position seeds it).
    vec3 c0 = rel + piv;
    float s1 = qrHash(dot(c0, vec3(12.9898, 78.233, 37.719)) + idx * 0.013);
    float s2 = qrHash(s1 * 91.7 + 3.1);
    float s3 = qrHash(s2 * 53.3 + 1.7);
    float d = 0.18 * g.x + 0.04 * s1; // it dissolves from the left
    float e = qrInOut((Q - d) / 0.22) * (1.0 - qrInOut((Q - 0.55 - 0.7 * d) / 0.28));
    vec3 dir = normalize(vec3(s1 - 0.5, s2 - 0.5, 0.5 * (s3 - 0.5) + 0.25));
    vec3 o = dir * (0.25 + 0.85 * s3) * edge + vec3(0.0, 0.15 * edge * Q, 0.0);
    float sw = (1.3 + 1.2 * s2) * Q;
    o.xy = vec2(o.x * cos(sw) - o.y * sin(sw), o.x * sin(sw) + o.y * cos(sw));
    center += o * e;
    qrPt = e;
  }
  // Alive: the pattern's color.
  float L = uSpGlowC.x;
  if (L > 0.0) {
    float ph = uSpGlowC.y;
    float c = fract(ph / 6.2831853);
    float k = 0.0;
    float lift = 0.0;
    vec3 tint = QWAVE;
    if (QPAT == 0) k = 0.5 + 0.5 * sin(ph - (g.x + g.y) * 5.0);
    else if (QPAT == 1) k = exp(-qrSq(((g.x + g.y) * 0.5 - (c * 1.6 - 0.3)) / 0.12));
    else if (QPAT == 2) k = 0.5 - 0.5 * cos(ph);
    else if (QPAT == 3) { k = 0.9; tint = mix(QWAVE, QWAVE2, 0.5 + 0.5 * sin(ph - g.x * 6.2831853)); }
    else if (QPAT == 4) { k = 0.9; tint = qrHue(fract(c + (g.x + g.y) * 0.5)); }
    else if (QPAT == 5) {
      // A current along the dark paths (path: modules from where the path starts).
      float u = fract(c * 2.0 - path / 11.0);
      k = exp(-u * 5.0);
      lift = 0.6 * k * k;
    } else if (QPAT == 6) {
      // Charge builds in from the edges, then discharges in a flash from the middle.
      float r = length(g - 0.5) / 0.7071;
      if (c < 0.75) {
        float lvl = c / 0.75;
        k = step(1.0 - r, lvl * 1.05);
        k *= 0.5 + 0.5 * lvl;
        lift = k * lvl * lvl * (0.75 + 0.25 * qrHash(idx + floor(ph * 9.0)));
      } else {
        float d = (c - 0.75) / 0.25;
        k = exp(-qrSq((r - d * 1.3) / 0.1)) + (1.0 - d) * 0.3;
        lift = exp(-qrSq((r - d * 1.3) / 0.1));
      }
    } else if (QPAT == 7) {
      // A scan line down the code, with a fading trail above it.
      float b = c * 1.3 - 0.15;
      float dy = b - g.y;
      k = dy >= -0.02 ? exp(-max(dy, 0.0) / 0.16) : 0.0;
      lift = exp(-abs(dy) / 0.025);
    }
    // The color patterns (0 to 4) lift a dark module a little too (at most
    // 60% of the cap): a hue barely shows on a near-black module otherwise.
    if (QPAT <= 4) lift = 0.6 * k;
    qrWave = L * qrSat(k);
    qrLift = L * qrSat(lift);
    qrTint = tint;
  }
  // The gems' glint: a narrow band of light that passes now and then, only
  // when the code is seen at an angle (none front on, in Scan view).
  if (${glint ? "true" : "false"}) {
    float tilt = 1.0 - abs(normalize(uSpCam.xyz + vec3(0.0, 0.0, 1e-4)).z);
    float band = fract(uSpKit.x * 0.16) * 3.2 - 1.1;
    float x = (g.x + (1.0 - g.y)) * 0.5;
    qrGlint = exp(-qrSq((x - band) / 0.035)) * step(0.55, h2) * smoothstep(0.03, 0.12, tilt);
  }
}
void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {
  rotation = qrMul(qrQ, rotation);
  scale *= uSpClock.y;
  // A point of the cloud: small and round.
  scale = mix(scale, vec3(0.04 * QS), qrPt);
}
// c moved toward the tint by k, its gray kept (or lifted by up to 35% of
// the way to the light modules: toward white for an inverted code).
vec3 qrToward(vec3 c, vec3 t, float k, float lift) {
  float g = dot(c, QW);
  float bg = dot(QBG, QW);
  float gl = g + lift * 0.35 * (g < bg ? bg - g : 1.0 - g);
  vec3 tc = clamp(t * (gl / max(dot(t, QW), 0.02)), 0.0, 1.0);
  tc = clamp(tc + vec3(max(gl - dot(tc, QW), 0.0)), 0.0, 1.0);
  return mix(c, tc, max(k, lift));
}
void modifySplatColor(vec3 center, inout vec4 color) {
  vec3 c = mix(color.rgb, QBACK * (0.6 + 0.4 * color.rgb / max(max(color.r, color.g), max(color.b, 0.05))), qrBack);
  c = mix(c, QBG, qrPaper);
  if (qrWave > 0.0 || qrLift > 0.0) c = qrToward(c, qrTint, qrWave * 0.85, qrLift);
  c += vec3(0.55) * qrGlint;
  color = vec4(c * uSpClock.z, color.a);
}
`;

const WGSL = ({ N, C, S, back, glint, wave, wave2, bg, depth, pattern }) => `
uniform uSpClock: vec4f;
uniform uSpKit: vec4f;
uniform uSpMorph: vec4f;
uniform uSpCam: vec4f;
uniform uSpGlowC: vec4f;
const QN: f32 = ${num(N)};
const QC = vec3f(${vec3(C)});
const QS: f32 = ${num(S)};
const QBACK = vec3f(${vec3(back)});
const QWAVE = vec3f(${vec3(wave)});
const QWAVE2 = vec3f(${vec3(wave2)});
const QBG = vec3f(${vec3(bg)});
const QDEPTH: f32 = ${num(depth)};
const QPAT: i32 = ${pattern | 0};
const QW = vec3f(0.2126, 0.7152, 0.0722);
var<private> qrQ: vec4f = vec4f(0.0, 0.0, 0.0, 1.0);
var<private> qrBack: f32 = 0.0;
var<private> qrPaper: f32 = 0.0;
var<private> qrGlint: f32 = 0.0;
var<private> qrWave: f32 = 0.0;
var<private> qrLift: f32 = 0.0;
var<private> qrPt: f32 = 0.0;
var<private> qrTint: vec3f = vec3f(0.0);
fn qrHash(n: f32) -> f32 { return fract(sin(n * 12.9898 + 4.1414) * 43758.5453); }
fn qrRot(q: vec4f, v: vec3f) -> vec3f { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
fn qrAxis(a: vec3f, t: f32) -> vec4f { return vec4f(normalize(a) * sin(t * 0.5), cos(t * 0.5)); }
fn qrMul(a: vec4f, b: vec4f) -> vec4f { return vec4f(a.w * b.xyz + b.w * a.xyz + cross(a.xyz, b.xyz), a.w * b.w - dot(a.xyz, b.xyz)); }
fn qrSat(x: f32) -> f32 { return clamp(x, 0.0, 1.0); }
fn qrSq(x: f32) -> f32 { return x * x; }
fn qrOut3(x: f32) -> f32 { let u = 1.0 - qrSat(x); return 1.0 - u * u * u; }
fn qrInOut(x0: f32) -> f32 {
  let x = qrSat(x0);
  if (x < 0.5) { return 4.0 * x * x * x; }
  return 1.0 - pow(-2.0 * x + 2.0, 3.0) / 2.0;
}
fn qrMod(a: vec3f, b: f32) -> vec3f { return a - b * floor(a / b); }
fn qrHue(h: f32) -> vec3f { return clamp(abs(qrMod(h * 6.0 + vec3f(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, vec3f(0.0), vec3f(1.0)); }
fn qrFold(p: ptr<function, vec3f>, Q: f32) -> vec4f {
  let a1 = 3.0159 * qrInOut(Q / 0.24) * (1.0 - qrInOut((Q - 0.76) / 0.2));
  let a2 = 3.0159 * qrInOut((Q - 0.27) / 0.21) * (1.0 - qrInOut((Q - 0.52) / 0.21));
  let h1 = QDEPTH + 0.18;
  let h2 = 2.0 * QDEPTH + 0.5;
  var q = vec4f(0.0, 0.0, 0.0, 1.0);
  var face = 1.0;
  if ((*p).x > 0.0 && a1 > 0.0) {
    let t = -a1;
    let r = vec2f((*p).x, (*p).z - h1);
    (*p).x = r.x * cos(t) + r.y * sin(t);
    (*p).z = -r.x * sin(t) + r.y * cos(t) + h1;
    q = qrAxis(vec3f(0.0, 1.0, 0.0), t);
    face = face * cos(a1);
  }
  if ((*p).y > 0.0 && a2 > 0.0) {
    let r = vec2f((*p).y, (*p).z - h2);
    (*p).y = r.x * cos(a2) - r.y * sin(a2);
    (*p).z = r.x * sin(a2) + r.y * cos(a2) + h2;
    q = qrMul(qrAxis(vec3f(1.0, 0.0, 0.0), a2), q);
    face = face * cos(a2);
  }
  qrPaper = select(0.0, 1.0, face < 0.0);
  return q;
}
fn modifySplatCenter(center: ptr<function, vec3f>) {
  let an = loadSplatAnim();
  let M = floor(uniform.uSpMorph.x + 0.5);
  let Q = uniform.uSpMorph.y;
  let moving = Q > 0.0 && Q < 1.0;
  if (an.z < 0.5) {
    if (an.w > 19.5 && moving && M == 6.0) {
      var p = *center / QS + QC;
      qrQ = qrFold(&p, Q);
      qrPaper = 0.0;
      *center = (p - QC) * QS;
    }
    return;
  }
  let idx = an.z - 1.0;
  let row = floor((idx + 0.5) / QN);
  let col = idx - row * QN;
  let wide = an.w - 10.0 * floor(an.w / 10.0);
  let eye = (an.w - 100.0 * floor(an.w / 100.0)) > 9.5;
  let path = floor(an.w / 100.0 + 0.001);
  let m2 = vec2f(col - QN * 0.5 + 0.5, QN * 0.5 - 0.5 - row);
  let piv = (vec3f(m2, 0.0) - QC) * QS;
  let rel = *center - piv;
  var off = vec3f(0.0);
  var q = vec4f(0.0, 0.0, 0.0, 1.0);
  let h1 = qrHash(idx + 0.37);
  let h2 = qrHash(idx * 1.71 + 2.9);
  let h3 = qrHash(idx * 0.53 + 7.3);
  let g = vec2f(col, row) / max(QN - 1.0, 1.0);
  let edge = QN * 0.5 * QS;
  if (moving && M == 1.0) {
    let A = Q;
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
  } else if (moving && M == 2.0) {
    let d = 0.26 * (g.x + g.y) * 0.5;
    let th = 3.1415927 * (qrInOut((Q - d) / 0.22) + qrInOut((Q - 0.5 - d) / 0.22));
    let ax = select(vec3f(0.7071, 0.7071, 0.0), vec3f(0.0, 1.0, 0.0), eye);
    q = qrMul(qrAxis(ax, th), q);
    off.z += abs(sin(th)) * (wide * 0.5 + 0.3) * QS;
    qrBack = select(0.0, 1.0, cos(th) < 0.0);
  } else if (moving && M == 3.0) {
    let B = Q;
    let out2 = m2 * QS;
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
  } else if (moving && M == 4.0) {
    let r = length(m2);
    let rf = Q * (QN * 0.72 + 12.0) - 4.0;
    let env = exp(-qrSq((r - rf + 2.5) / 3.2)) * sin(3.1415927 * Q);
    let ph = (r - rf) * 1.15;
    let z = 1.4 * env * sin(ph);
    let slope = 1.4 * env * 1.15 * cos(ph);
    let dir = select(vec2f(1.0, 0.0), m2 / max(r, 1e-6), r > 1e-3);
    off.z += z * QS;
    q = qrMul(qrAxis(vec3f(dir.y, -dir.x, 0.0), atan(slope)), q);
  } else if (moving && M == 5.0) {
    let s = 0.04 + 0.74 * (row + 0.5 * (wide - 1.0)) / QN + 0.08 * col / QN;
    let th = 6.2831853 * qrInOut((Q - s) / 0.13);
    q = qrMul(qrAxis(vec3f(1.0, 0.0, 0.0), th), q);
    off.z += abs(sin(th * 0.5)) * (wide * 0.5 + 0.2) * QS;
    qrBack = select(0.0, 1.0, cos(th) < 0.0);
  } else if (moving && M == 7.0) {
    let D: f32 = 4.4;
    let top = QN * 0.5 + 7.0 + 0.6 * (QN - 1.0 - row);
    let h = top - m2.y;
    let up = qrInOut(Q / 0.16);
    let s = 0.18 + 0.42 * (1.0 - (row + 0.5 * (wide - 1.0)) / QN) + 0.04 * h1;
    let G: f32 = 70.0;
    let tf = sqrt(2.0 * h / G);
    let tau = max(Q - s, 0.0) * D;
    var y: f32;
    var spin: f32;
    if (Q < s) { y = h * up; spin = up; }
    else if (tau < tf) { y = h - 0.5 * G * tau * tau; spin = 1.0 - tau / tf; }
    else {
      let b = tau - tf;
      y = 0.45 * exp(-7.0 * b) * abs(sin(10.0 * b));
      spin = 0.0;
    }
    y = y * (1.0 - smoothstep(0.96, 1.0, Q));
    off.y += y * QS;
    off.z += 0.15 * spin * QS;
    q = qrMul(qrAxis(vec3f(h3 - 0.5, 0.2, h1 - 0.5), 1.4 * (h2 - 0.5) * spin), q);
  } else if (moving && M == 8.0) {
    let d = m2 - uniform.uSpMorph.zw;
    let r = length(d);
    let k = exp(-qrSq(r / 4.5));
    let dir = select(normalize(vec2f(h1 - 0.5, h2 - 0.5) + 1e-3), d / max(r, 1e-6), r > 0.3);
    var a: f32;
    if (Q < 0.36) { a = 1.0 - exp(-8.0 * Q / 0.36); }
    else {
      let u = (Q - 0.36) / 0.64;
      a = exp(-4.5 * u) * cos(8.0 * u) * (1.0 - smoothstep(0.85, 1.0, u));
    }
    a = a * k;
    off += vec3f(dir * (1.6 + 1.2 * h1), 2.4 + 1.6 * h2) * a * QS;
    q = qrMul(qrAxis(vec3f(-dir.y, dir.x, h3 - 0.5), (2.5 + 2.0 * h3) * a), q);
  }
  qrQ = q;
  *center = piv + qrRot(q, rel) + off;
  if (moving && M == 6.0) {
    var p = *center / QS + QC;
    qrQ = qrMul(qrFold(&p, Q), qrQ);
    *center = (p - QC) * QS;
  } else if (moving && M == 9.0) {
    let c0 = rel + piv;
    let s1 = qrHash(dot(c0, vec3f(12.9898, 78.233, 37.719)) + idx * 0.013);
    let s2 = qrHash(s1 * 91.7 + 3.1);
    let s3 = qrHash(s2 * 53.3 + 1.7);
    let d = 0.18 * g.x + 0.04 * s1;
    let e = qrInOut((Q - d) / 0.22) * (1.0 - qrInOut((Q - 0.55 - 0.7 * d) / 0.28));
    let dir = normalize(vec3f(s1 - 0.5, s2 - 0.5, 0.5 * (s3 - 0.5) + 0.25));
    var o = dir * (0.25 + 0.85 * s3) * edge + vec3f(0.0, 0.15 * edge * Q, 0.0);
    let sw = (1.3 + 1.2 * s2) * Q;
    o = vec3f(o.x * cos(sw) - o.y * sin(sw), o.x * sin(sw) + o.y * cos(sw), o.z);
    *center = *center + o * e;
    qrPt = e;
  }
  let L = uniform.uSpGlowC.x;
  if (L > 0.0) {
    let ph = uniform.uSpGlowC.y;
    let c = fract(ph / 6.2831853);
    var k: f32 = 0.0;
    var lift: f32 = 0.0;
    var tint = QWAVE;
    if (QPAT == 0) { k = 0.5 + 0.5 * sin(ph - (g.x + g.y) * 5.0); }
    else if (QPAT == 1) { k = exp(-qrSq(((g.x + g.y) * 0.5 - (c * 1.6 - 0.3)) / 0.12)); }
    else if (QPAT == 2) { k = 0.5 - 0.5 * cos(ph); }
    else if (QPAT == 3) { k = 0.9; tint = mix(QWAVE, QWAVE2, 0.5 + 0.5 * sin(ph - g.x * 6.2831853)); }
    else if (QPAT == 4) { k = 0.9; tint = qrHue(fract(c + (g.x + g.y) * 0.5)); }
    else if (QPAT == 5) {
      let u = fract(c * 2.0 - path / 11.0);
      k = exp(-u * 5.0);
      lift = 0.6 * k * k;
    } else if (QPAT == 6) {
      let r = length(g - 0.5) / 0.7071;
      if (c < 0.75) {
        let lvl = c / 0.75;
        k = step(1.0 - r, lvl * 1.05);
        k = k * (0.5 + 0.5 * lvl);
        lift = k * lvl * lvl * (0.75 + 0.25 * qrHash(idx + floor(ph * 9.0)));
      } else {
        let d = (c - 0.75) / 0.25;
        k = exp(-qrSq((r - d * 1.3) / 0.1)) + (1.0 - d) * 0.3;
        lift = exp(-qrSq((r - d * 1.3) / 0.1));
      }
    } else if (QPAT == 7) {
      let b = c * 1.3 - 0.15;
      let dy = b - g.y;
      k = select(0.0, exp(-max(dy, 0.0) / 0.16), dy >= -0.02);
      lift = exp(-abs(dy) / 0.025);
    }
    // The color patterns (0 to 4) lift a dark module a little too (at most
    // 60% of the cap): a hue barely shows on a near-black module otherwise.
    if (QPAT <= 4) { lift = 0.6 * k; }
    qrWave = L * qrSat(k);
    qrLift = L * qrSat(lift);
    qrTint = tint;
  }
  if (${glint ? "true" : "false"}) {
    let tilt = 1.0 - abs(normalize(uniform.uSpCam.xyz + vec3f(0.0, 0.0, 1e-4)).z);
    let band = fract(uniform.uSpKit.x * 0.16) * 3.2 - 1.1;
    let x = (g.x + (1.0 - g.y)) * 0.5;
    qrGlint = exp(-qrSq((x - band) / 0.035)) * step(0.55, h2) * smoothstep(0.03, 0.12, tilt);
  }
}
fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {
  *rotation = qrMul(qrQ, *rotation);
  *scale = *scale * uniform.uSpClock.y;
  *scale = mix(*scale, vec3f(0.04 * QS), qrPt);
}
fn qrToward(c: vec3f, t: vec3f, k: f32, lift: f32) -> vec3f {
  let g = dot(c, QW);
  let bg = dot(QBG, QW);
  let gl = g + lift * 0.35 * select(1.0 - g, bg - g, g < bg);
  var tc = clamp(t * (gl / max(dot(t, QW), 0.02)), vec3f(0.0), vec3f(1.0));
  tc = clamp(tc + vec3f(max(gl - dot(tc, QW), 0.0)), vec3f(0.0), vec3f(1.0));
  return mix(c, tc, max(k, lift));
}
fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
  let k = (*color).rgb / max(max((*color).r, (*color).g), max((*color).b, 0.05));
  var c = mix((*color).rgb, QBACK * (0.6 + 0.4 * k), qrBack);
  c = mix(c, QBG, qrPaper);
  if (qrWave > 0.0 || qrLift > 0.0) { c = qrToward(c, qrTint, qrWave * 0.85, qrLift); }
  c += vec3f(0.55) * qrGlint;
  *color = vec4f(c * uniform.uSpClock.z, (*color).a);
}
`;

// A color's hue turned by a third of the way round (the flowing gradient's
// second color), keeping its gray.
export function turnHue(c, turn = 1 / 3) {
  const [r, g, b] = c;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d > 1e-6) {
    if (mx === r) h = ((g - b) / d + 6) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  const s = mx > 1e-6 ? d / mx : 0;
  const hh = (((h + turn) % 1) + 1) % 1;
  const f = (k) => {
    const x = (k + hh * 6) % 6;
    return mx * (1 - s * Math.max(0, Math.min(1, Math.min(x, 4 - x))));
  };
  return [f(5), f(3), f(1)];
}

// size: the code's modules across; fit: the kit's { center, scale }.
// opts: { back: the flip's back color [r, g, b], glint: the gems' glint is in
// the program (only for Gems, so no other style can ever catch it), wave:
// Alive's color, bg: the light modules' color (the paper's back in the
// fold), depth: how far the code stands out, pattern: the Alive pattern's
// index in PATTERNS }.
export function qrModifier(size, fit, opts = {}) {
  const wave = opts.wave || [0.11, 0.31, 0.61];
  const args = {
    N: size,
    C: fit.center,
    S: fit.scale,
    back: opts.back || [0.93, 0.45, 0.2],
    glint: !!opts.glint,
    wave,
    wave2: turnHue(wave),
    bg: opts.bg || [1, 1, 1],
    depth: opts.depth ?? 0.14,
    pattern: Math.max(
      0,
      PATTERNS.findIndex((p) => p.id === opts.pattern),
    ),
  };
  return { glsl: GLSL(args), wgsl: WGSL(args) };
}

// Lane Space r4: the GPU program for "The solar system on real orbits"
// (src/packs/space-r4.js), a work-buffer modifier like lane Lab's splat
// fields (docs/lab/FIELDS.md), passed by the recipe's gpuField() with labs
// on. It replaces the kit's program for this toy. Without labs the kit's own
// program draws the same splats: the planets, moons and comets still move
// (they are kit tokens), the asteroids stand still.
//
// Every splat is one of three sorts, told apart by its anim values
// [part, kind, z, w]:
//
//   - A token splat (kind 14, the kit's game piece): z = the token (a planet,
//     a moon or a comet), w = what it is:
//       0  the body's surface: lit by the Sun, its far side hidden
//       1+f  a comet's tail, f along it (0 at the head, 1 at the end)
//       2  a glow (a comet's coma): unlit
//       3  a name: faces the camera, the same size on screen at any zoom
//       4  Saturn's rings: lit, both sides shown
//       5  a moon's orbit line round its planet: unlit, a pixel wide
//     It moves by its token's offset (uSpTokens, from the drive, which works
//     out each body's place on the CPU from its elements).
//   - An asteroid (kind 0, z > 0): its center is its drawn place at the
//     snapshot's epoch; z is its orbit's semi-major axis (au) and w the
//     direction of its velocity there (octahedral, two 12-bit numbers). The
//     program carries it along its orbit by the two-body problem, every
//     frame: speed by the vis-viva law, the orbit's shape from its place and
//     velocity, Kepler's equation for the date (src/space/kepler.js,
//     propagateStored, is the same in JavaScript, and the tests check it).
//   - Anything else (kind 0, z = 0): still. w = 0 the Sun, 1 an orbit line
//     (a pixel wide), 2 the Sun's glow.
//
// Then the whole view moves so the body being visited sits at the middle,
// and grows about it: p' = (p - focus) × zoom. (The camera stays home; a
// fly to a planet is the system growing about it, smoothly, however far.)
//
// Uniforms (from the drive): uSpMorph = [days since the snapshot's epoch,
// focus x, y, z (the toy's frame)]; uSpGlowC = [zoom, names' opacity, the
// visited token, the view's turn about the vertical (radians)]; uSpTokens the tokens; uSpCam the camera (w its
// distance); uSpClock y the splat scale, z exposure.

const num = (x) => {
  const s = Number(x).toFixed(7);
  return s.includes(".") ? s : `${s}.0`;
};
const v4 = (a, fn) => a.map((b) => `${fn}(${b.map(num).join(", ")})`).join(", ");

// The constants every program shares: the fit, the scale, the tokens.
// bodies: [{ c: built center (toy frame), r: drawn radius, kind: 0 planet, 1 moon, 2 comet }]
function consts(o) {
  const n = Math.max(1, o.bodies.length);
  const body = o.bodies.length ? o.bodies.map((b) => [...b.c, b.r]) : [[0, 0, 0, 0]];
  const kind = o.bodies.length ? o.bodies.map((b) => [b.kind, 0, 0, 0]) : [[0, 0, 0, 0]];
  return { n, body, kind };
}

const GLSL = (o) => {
  const { n, body, kind } = consts(o);
  return `
uniform vec4 uSpClock;
uniform vec4 uSpMorph;
uniform vec4 uSpGlowC;
uniform vec4 uSpCam;
uniform vec4 uSpTokens[96];
const vec3 FC = vec3(${num(o.center[0])}, ${num(o.center[1])}, ${num(o.center[2])});
const float FS = ${num(o.scale)};
const float READABLE = ${num(o.readable ? 1 : 0)};
const float R0 = ${num(o.r0)};
const float MU = ${num(o.mu * 1e4)} * 1e-4;
const float NAME_DIST = ${num(o.nameDist)};
const vec3 LIFT = vec3(${o.nameLift.map(num).join(", ")});
const vec4 BODY[${n}] = vec4[${n}](${v4(body, "vec4")});
const vec4 BKIND[${n}] = vec4[${n}](${v4(kind, "vec4")});
int oType = 0;
float oSub = 0.0;
float oZoom = 1.0;
float oHide = 0.0;
float oLit = 1.0;
float oFade = 1.0;
vec3 oN = vec3(0.0, 1.0, 0.0);
vec3 oF = vec3(0.0);
float oZ = 1.0;
// The view: moved so the visited body is at the middle, grown about it,
// and turned about the vertical (uSpGlowC.w) so its sunlit side shows.
vec3 oView(vec3 p) {
  vec3 v = (p - oF) * oZ;
  float c = cos(uSpGlowC.w);
  float s = sin(uSpGlowC.w);
  return vec3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c);
}
vec3 oTurn(vec3 v) {
  float c = cos(uSpGlowC.w);
  float s = sin(uSpGlowC.w);
  return vec3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c);
}
float oDist(float r) { return READABLE > 0.5 ? log(1.0 + r / R0) : r; }
float oInv(float d) { return READABLE > 0.5 ? R0 * (exp(d) - 1.0) : d; }
vec3 oOct(float v) {
  float a = mod(v, 4096.0);
  float b = floor(v / 4096.0);
  vec2 e = vec2(a, b) / 4095.0 * 2.0 - 1.0;
  float z = 1.0 - abs(e.x) - abs(e.y);
  if (z < 0.0) e = (1.0 - abs(e.yx)) * vec2(e.x >= 0.0 ? 1.0 : -1.0, e.y >= 0.0 ? 1.0 : -1.0);
  return normalize(vec3(e, z));
}
vec3 oKepler(vec3 r, float a, vec3 vd, float dt) {
  float rl = length(r);
  vec3 v = vd * sqrt(max(0.0, MU * (2.0 / rl - 1.0 / a)));
  vec3 h = cross(r, v);
  vec3 ev = cross(v, h) / MU - r / rl;
  float e = min(0.99, length(ev));
  vec3 P = e > 1e-6 ? ev / e : r / rl;
  vec3 Q = cross(normalize(h), P);
  float b = sqrt(1.0 - e * e);
  float E0 = atan(dot(r, Q) / (a * b), dot(r, P) / a + e);
  float M = E0 - e * sin(E0) + sqrt(MU / (a * a * a)) * dt;
  M -= 6.2831853 * floor(M / 6.2831853 + 0.5);
  float E = e < 0.8 ? M : (M < 0.0 ? -3.1415927 : 3.1415927);
  for (int k = 0; k < 12; k++) E -= (E - e * sin(E) - M) / (1.0 - e * cos(E));
  return P * (a * (cos(E) - e)) + Q * (a * b * sin(E));
}
void modifySplatCenter(inout vec3 center) {
  vec4 an = loadSplatAnim();
  float zoom = max(uSpGlowC.x, 1e-6);
  vec3 F = uSpMorph.yzw;
  oF = F;
  oZ = zoom;
  oZoom = zoom;
  oHide = 0.0;
  oLit = 1.0;
  oFade = 1.0;
  int kind = int(an.y + 0.5);
  vec3 sun = -FC * FS;
  if (kind == 14) {
    int ti = clamp(int(an.z + 0.5), 0, ${n - 1});
    vec4 to = uSpTokens[ti * 2];
    vec4 bd = BODY[ti];
    vec3 head = bd.xyz + to.xyz;
    vec3 off = center - bd.xyz;
    oSub = an.w;
    oFade = to.w;
    if (an.w < 0.5) {
      oType = 1;
      oN = normalize(off + vec3(1e-9));
      vec3 l = normalize(sun - head);
      oLit = 0.07 + 0.93 * max(0.0, dot(oN, l));
      center = oView(center + to.xyz);
      float facing = dot(oTurn(oN), normalize(uSpCam.xyz - center));
      oHide = 1.0 - smoothstep(-0.25, -0.05, facing);
    } else if (an.w < 2.0) {
      // A comet's tail points away from the Sun; it grows inside about
      // 4 au (a picture of a tail, not a measured one).
      oType = 2;
      float f = an.w - 1.0;
      vec3 away = normalize(head - sun + vec3(1e-9));
      float rau = oInv(length(head - sun) / FS);
      float act = clamp((4.0 - rau) / 3.0, 0.0, 1.0);
      float len = ${num(o.tailLen)} * FS * act;
      vec3 lat = off - away * dot(off, away);
      center = oView(head + away * len * f + lat * (0.4 + 2.5 * f) * act);
      oFade *= act * (1.0 - f) * (1.0 - f);
    } else if (an.w < 2.5) {
      oType = 3;
      float rau = oInv(length(head - sun) / FS);
      float act = clamp((4.5 - rau) / 3.5, 0.0, 1.0);
      center = oView(head + off * (0.4 + 1.6 * act));
      oFade *= 0.25 + 0.75 * act;
    } else if (an.w < 3.5) {
      // A name: in the camera's own plane, to the right of its body.
      oType = 4;
      vec3 fwd = normalize(-uSpCam.xyz + vec3(1e-6));
      vec3 rt = cross(fwd, vec3(0.0, 1.0, 0.0));
      rt = length(rt) < 1e-3 ? vec3(1.0, 0.0, 0.0) : normalize(rt);
      vec3 up = cross(rt, fwd);
      float k = uSpCam.w / NAME_DIST;
      vec3 hz = oView(head);
      vec3 o2 = an.w > 3.1 ? off - LIFT : off;
      center = hz + (rt * (o2.x * k + bd.w * zoom) + up * o2.y * k) - fwd * (an.w > 3.1 ? 0.002 * k : 0.0);
      oZoom = k;
      float bk = BKIND[ti].x;
      float a = uSpGlowC.y;
      if (bk > 0.5 && bk < 1.5) a *= smoothstep(3.0, 8.0, zoom);
      if (abs(float(ti) - uSpGlowC.z) < 0.5) a = max(a, 1.0);
      oFade *= a;
    } else if (an.w < 4.5) {
      oType = 5;
      vec3 l = normalize(sun - head);
      oLit = 0.25 + 0.75 * abs(dot(normalize(${o.ringPole}), l));
      center = oView(center + to.xyz);
    } else {
      oType = 6;
      center = oView(center + to.xyz);
    }
    return;
  }
  if (an.z > 0.0) {
    // An asteroid, along its orbit.
    oType = 7;
    vec3 q = center / FS + FC;
    float dq = max(length(q), 1e-6);
    vec3 r = q / dq * oInv(dq);
    vec3 r1 = oKepler(r, an.z, oOct(an.w), uSpMorph.x);
    float l1 = max(length(r1), 1e-6);
    vec3 d1 = r1 / l1 * oDist(l1);
    center = oView((d1 - FC) * FS);
    // (An asteroid stays a speck however close the view comes.)
    oZoom = 1.0;
    return;
  }
  oType = an.w > 0.5 && an.w < 1.5 ? 8 : 0;
  center = oView(center);
}
void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {
  vec4 qy = vec4(0.0, sin(uSpGlowC.w * 0.5), 0.0, cos(uSpGlowC.w * 0.5));
  rotation = vec4(qy.w * rotation.xyz + rotation.w * qy.xyz + cross(qy.xyz, rotation.xyz), qy.w * rotation.w - dot(qy.xyz, rotation.xyz));
  float fl = 0.0008 * length(uSpCam.xyz - modifiedCenter);
  if (oType == 8 || oType == 6) {
    // A line: its length grows with the zoom, its width stays a pixel.
    scale = vec3(scale.x * oZoom, fl, fl);
  } else {
    scale *= oZoom;
    scale = max(scale, vec3(fl));
  }
  scale *= uSpClock.y * (1.0 - oHide);
}
void modifySplatColor(vec3 center, inout vec4 color) {
  vec3 rgb = color.rgb;
  float a = color.a * (1.0 - oHide) * clamp(oFade, 0.0, 1.0);
  if (oType == 1 || oType == 5) rgb *= oLit;
  color = vec4(rgb * uSpClock.z, a);
}
`;
};

const WGSL = (o) => {
  const { n, body, kind } = consts(o);
  return `
uniform uSpClock: vec4f;
uniform uSpMorph: vec4f;
uniform uSpGlowC: vec4f;
uniform uSpCam: vec4f;
uniform uSpTokens: array<vec4f, 96>;
const FC: vec3f = vec3f(${num(o.center[0])}, ${num(o.center[1])}, ${num(o.center[2])});
const FS: f32 = ${num(o.scale)};
const READABLE: f32 = ${num(o.readable ? 1 : 0)};
const R0: f32 = ${num(o.r0)};
const MU: f32 = ${num(o.mu * 1e4)} * 1e-4;
const NAME_DIST: f32 = ${num(o.nameDist)};
const LIFT: vec3f = vec3f(${o.nameLift.map(num).join(", ")});
var<private> BODY: array<vec4f, ${n}> = array<vec4f, ${n}>(${v4(body, "vec4f")});
var<private> BKIND: array<vec4f, ${n}> = array<vec4f, ${n}>(${v4(kind, "vec4f")});
var<private> oType: i32 = 0;
var<private> oSub: f32 = 0.0;
var<private> oZoom: f32 = 1.0;
var<private> oHide: f32 = 0.0;
var<private> oLit: f32 = 1.0;
var<private> oFade: f32 = 1.0;
var<private> oN: vec3f = vec3f(0.0, 1.0, 0.0);
var<private> oF: vec3f = vec3f(0.0);
var<private> oZ: f32 = 1.0;
fn oTurn(v: vec3f) -> vec3f {
  let c = cos(uniform.uSpGlowC.w);
  let s = sin(uniform.uSpGlowC.w);
  return vec3f(v.x * c + v.z * s, v.y, -v.x * s + v.z * c);
}
fn oView(p: vec3f) -> vec3f { return oTurn((p - oF) * oZ); }
fn oDist(r: f32) -> f32 { return select(r, log(1.0 + r / R0), READABLE > 0.5); }
fn oInv(d: f32) -> f32 { return select(d, R0 * (exp(d) - 1.0), READABLE > 0.5); }
fn oOct(v: f32) -> vec3f {
  let a = v % 4096.0;
  let b = floor(v / 4096.0);
  var e = vec2f(a, b) / 4095.0 * 2.0 - 1.0;
  let z = 1.0 - abs(e.x) - abs(e.y);
  if (z < 0.0) {
    e = (1.0 - abs(e.yx)) * vec2f(select(-1.0, 1.0, e.x >= 0.0), select(-1.0, 1.0, e.y >= 0.0));
  }
  return normalize(vec3f(e, z));
}
fn oKepler(r: vec3f, a: f32, vd: vec3f, dt: f32) -> vec3f {
  let rl = length(r);
  let v = vd * sqrt(max(0.0, MU * (2.0 / rl - 1.0 / a)));
  let h = cross(r, v);
  let ev = cross(v, h) / MU - r / rl;
  let e = min(0.99, length(ev));
  let P = select(r / rl, ev / max(e, 1e-9), e > 1e-6);
  let Q = cross(normalize(h), P);
  let b = sqrt(1.0 - e * e);
  let E0 = atan2(dot(r, Q) / (a * b), dot(r, P) / a + e);
  var M = E0 - e * sin(E0) + sqrt(MU / (a * a * a)) * dt;
  M = M - 6.2831853 * floor(M / 6.2831853 + 0.5);
  var E = select(select(3.1415927, -3.1415927, M < 0.0), M, e < 0.8);
  for (var k = 0; k < 12; k++) { E = E - (E - e * sin(E) - M) / (1.0 - e * cos(E)); }
  return P * (a * (cos(E) - e)) + Q * (a * b * sin(E));
}
fn modifySplatCenter(center: ptr<function, vec3f>) {
  let an = loadSplatAnim();
  let zoom = max(uniform.uSpGlowC.x, 1e-6);
  let F = uniform.uSpMorph.yzw;
  oF = F;
  oZ = zoom;
  oZoom = zoom;
  oHide = 0.0;
  oLit = 1.0;
  oFade = 1.0;
  let kind = i32(an.y + 0.5);
  let sun = -FC * FS;
  let c0 = *center;
  if (kind == 14) {
    let ti = clamp(i32(an.z + 0.5), 0, ${n - 1});
    let tk = uniform.uSpTokens[ti * 2];
    let bd = BODY[ti];
    let head = bd.xyz + tk.xyz;
    let off = c0 - bd.xyz;
    oSub = an.w;
    oFade = tk.w;
    if (an.w < 0.5) {
      oType = 1;
      oN = normalize(off + vec3f(1e-9));
      let l = normalize(sun - head);
      oLit = 0.07 + 0.93 * max(0.0, dot(oN, l));
      let c = oView(c0 + tk.xyz);
      *center = c;
      let facing = dot(oTurn(oN), normalize(uniform.uSpCam.xyz - c));
      oHide = 1.0 - smoothstep(-0.25, -0.05, facing);
    } else if (an.w < 2.0) {
      oType = 2;
      let f = an.w - 1.0;
      let away = normalize(head - sun + vec3f(1e-9));
      let rau = oInv(length(head - sun) / FS);
      let act = clamp((4.0 - rau) / 3.0, 0.0, 1.0);
      let len = ${num(o.tailLen)} * FS * act;
      let lat = off - away * dot(off, away);
      *center = oView(head + away * len * f + lat * (0.4 + 2.5 * f) * act);
      oFade = oFade * act * (1.0 - f) * (1.0 - f);
    } else if (an.w < 2.5) {
      oType = 3;
      let rau = oInv(length(head - sun) / FS);
      let act = clamp((4.5 - rau) / 3.5, 0.0, 1.0);
      *center = oView(head + off * (0.4 + 1.6 * act));
      oFade = oFade * (0.25 + 0.75 * act);
    } else if (an.w < 3.5) {
      oType = 4;
      let fwd = normalize(-uniform.uSpCam.xyz + vec3f(1e-6));
      var rt = cross(fwd, vec3f(0.0, 1.0, 0.0));
      rt = select(normalize(rt), vec3f(1.0, 0.0, 0.0), length(rt) < 1e-3);
      let up = cross(rt, fwd);
      let k = uniform.uSpCam.w / NAME_DIST;
      let hz = oView(head);
      let o2 = select(off, off - LIFT, an.w > 3.1);
      *center = hz + (rt * (o2.x * k + bd.w * zoom) + up * o2.y * k) - fwd * select(0.0, 0.002 * k, an.w > 3.1);
      oZoom = k;
      let bk = BKIND[ti].x;
      var a = uniform.uSpGlowC.y;
      if (bk > 0.5 && bk < 1.5) { a = a * smoothstep(3.0, 8.0, zoom); }
      if (abs(f32(ti) - uniform.uSpGlowC.z) < 0.5) { a = max(a, 1.0); }
      oFade = oFade * a;
    } else if (an.w < 4.5) {
      oType = 5;
      let l = normalize(sun - head);
      oLit = 0.25 + 0.75 * abs(dot(normalize(${o.ringPole.replace("vec3", "vec3f")}), l));
      *center = oView(c0 + tk.xyz);
    } else {
      oType = 6;
      *center = oView(c0 + tk.xyz);
    }
    return;
  }
  if (an.z > 0.0) {
    oType = 7;
    let q = c0 / FS + FC;
    let dq = max(length(q), 1e-6);
    let r = q / dq * oInv(dq);
    let r1 = oKepler(r, an.z, oOct(an.w), uniform.uSpMorph.x);
    let l1 = max(length(r1), 1e-6);
    let d1 = r1 / l1 * oDist(l1);
    *center = oView((d1 - FC) * FS);
    oZoom = 1.0;
    return;
  }
  oType = select(0, 8, an.w > 0.5 && an.w < 1.5);
  *center = oView(c0);
}
fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {
  let fl = 0.0008 * length(uniform.uSpCam.xyz - modifiedCenter);
  let qy = vec4f(0.0, sin(uniform.uSpGlowC.w * 0.5), 0.0, cos(uniform.uSpGlowC.w * 0.5));
  let r0 = *rotation;
  *rotation = vec4f(qy.w * r0.xyz + r0.w * qy.xyz + cross(qy.xyz, r0.xyz), qy.w * r0.w - dot(qy.xyz, r0.xyz));
  var sc = *scale;
  if (oType == 8 || oType == 6) {
    sc = vec3f(sc.x * oZoom, fl, fl);
  } else {
    sc = max(sc * oZoom, vec3f(fl));
  }
  *scale = sc * (uniform.uSpClock.y * (1.0 - oHide));
}
fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
  var rgb = (*color).rgb;
  let a = (*color).a * (1.0 - oHide) * clamp(oFade, 0.0, 1.0);
  if (oType == 1 || oType == 5) { rgb = rgb * oLit; }
  *color = vec4f(rgb * uniform.uSpClock.z, a);
}
`;
};

// The program for one build: fit { center, scale }, readable (bool), r0 and
// mu (from src/space/kepler.js), bodies (see consts), tailLen (drawn units),
// nameDist (the camera distance at which names have their built size),
// nameLift (how far names' letters are stored toward the camera) and
// ringPole (Saturn's pole in the toy's frame, as a GLSL vec3).
export function orbitModifier(o) {
  return { glsl: GLSL(o), wgsl: WGSL(o) };
}

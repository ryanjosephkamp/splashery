// Lane Space r2: the real worlds' GPU program, a work-buffer modifier like
// lane Lab's splat fields (docs/lab/FIELDS.md), passed by the recipe's
// gpuField() with labs on. It replaces the kit's program for these toys,
// and turns and lights the world on the graphics chip every frame:
//
//   - The world turns: every splat's center, and its disc, by the rotation
//     tilt (about x) after spin (about y): uSpMorph.x is the spin and
//     uSpMorph.y the tilt, in radians. The tilt brings a feature to the
//     middle of the view when a tap flies to it.
//   - The sun lights it: uSpGlowC.xyz is the direction toward the sun (toy
//     space, fixed while the world turns). Each surface splat carries its
//     ground's own normal (from the elevation map), so slopes facing the sun
//     are bright and slopes facing away dark, and the night side is dark.
//   - Its far side is hidden (the splats sort in their built pose, so a
//     turned world's back would otherwise draw over its front).
//
// Each splat's four splatAnim values are this program's own:
//   x = 16 × type (the kit reads part 0 with no flags), y = 0 (no kit
//   behavior), z = the ground's normal
//   at true height, octahedral, two 12-bit numbers (z = a + 4096 b), w =
//   extra + 256 × (h + 32768), h the splat's height above the reference in
//   steps of HSTEP toy units, and extra by type:
//     WORLD_TYPE.ground  a splat of ground: extra = its glow at night, 0..255
//                        (Earth's city lights; 0 elsewhere)
//     WORLD_TYPE.air     a splat of the atmosphere's rim: lit by the sun,
//                        brightest seen edge-on
//     WORLD_TYPE.label   a splat of a feature's name, stored where it shows
//                        during its fly (above the feature turned to face +z;
//                        it neither turns nor lifts): extra = the feature's
//                        index; shown only while uSpKitB.w (the kit's key
//                        press value) = index + fade
//
// The splats are built at true height; the program lifts each one by the
// relief's exaggeration (uSpKitB.z, the kit's amount) times its height, and
// tips its ground's normal to match, so the relief can ease while the toy
// runs (a fly lowers it close up). A disc of ground lies along its ground
// and stretches up the slope, so steep ground stays covered.
//
// Uniforms (from the recipe's drive): uSpMorph = [spin, tilt, ambient,
// night glow 0..1]; uSpGlowC = [sun x, y, z, brightness]; uSpKitB.z = the
// relief's exaggeration, w = shown label + its fade (-1: none); uSpClock.y
// the splat scale, z exposure; uSpCam the camera.

export const WORLD_TYPE = { ground: 0, air: 1, label: 2 };

// A type's first anim value: a multiple of 16, so the kit reads part 0.
export const worldPart = (type) => 16 * type;

// Packs a splat's last anim value: its height in HSTEP steps and the
// type's extra value (0..255).
export const packExtra = (heightSteps, extra = 0) =>
  Math.max(0, Math.min(255, Math.round(extra))) + 256 * Math.max(0, Math.min(65535, Math.round(heightSteps) + 32768)); // prettier-ignore
export const unpackExtra = (w) => ({ extra: w % 256, steps: Math.floor(w / 256) - 32768 });

// Packs a unit normal in two 12-bit numbers (octahedral), as one float.
export function packNormal(n) {
  const s = Math.abs(n[0]) + Math.abs(n[1]) + Math.abs(n[2]) || 1;
  let x = n[0] / s;
  let y = n[1] / s;
  if (n[2] < 0) {
    const ox = (1 - Math.abs(y)) * (x >= 0 ? 1 : -1);
    const oy = (1 - Math.abs(x)) * (y >= 0 ? 1 : -1);
    x = ox;
    y = oy;
  }
  const a = Math.max(0, Math.min(4095, Math.round((x * 0.5 + 0.5) * 4095)));
  const b = Math.max(0, Math.min(4095, Math.round((y * 0.5 + 0.5) * 4095)));
  return a + 4096 * b;
}

// The inverse (for the tests and the program's twin in JavaScript).
export function unpackNormal(v) {
  const a = v % 4096;
  const b = Math.floor(v / 4096);
  let x = (a / 4095) * 2 - 1;
  let y = (b / 4095) * 2 - 1;
  const z = 1 - Math.abs(x) - Math.abs(y);
  if (z < 0) {
    const ox = (1 - Math.abs(y)) * (x >= 0 ? 1 : -1);
    const oy = (1 - Math.abs(x)) * (y >= 0 ? 1 : -1);
    x = ox;
    y = oy;
  }
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

// The world's turn as a quaternion [x, y, z, w]: spin about y, then tilt
// about x (the same as the program's).
export function worldQuat(spin, tilt) {
  const qy = [0, Math.sin(spin / 2), 0, Math.cos(spin / 2)];
  const qx = [Math.sin(tilt / 2), 0, 0, Math.cos(tilt / 2)];
  // qx * qy
  return [
    qx[3] * qy[0] + qy[3] * qx[0] + (qx[1] * qy[2] - qx[2] * qy[1]),
    qx[3] * qy[1] + qy[3] * qx[1] + (qx[2] * qy[0] - qx[0] * qy[2]),
    qx[3] * qy[2] + qy[3] * qx[2] + (qx[0] * qy[1] - qx[1] * qy[0]),
    qx[3] * qy[3] - (qx[0] * qy[0] + qx[1] * qy[1] + qx[2] * qy[2]),
  ];
}

// How bright a splat of ground is (the program's lighting in JavaScript,
// for the tests): n its normal and r its direction from the middle, both
// turned, sun the direction toward the sun.
export function groundLight(n, r, sun, ambient) {
  const d = n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2];
  const dr = r[0] * sun[0] + r[1] * sun[1] + r[2] * sun[2];
  const day = smooth(-0.03, 0.08, dr);
  return ambient + (1 - ambient) * Math.max(0, d) * day;
}
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const num = (x) => {
  const s = Number(x).toFixed(7);
  return s.includes(".") ? s : `${s}.0`;
};

const GLSL = (air, night, hstep) => `
uniform vec4 uSpClock;   // y splat scale, z exposure
uniform vec4 uSpMorph;   // spin, tilt, ambient, night glow
uniform vec4 uSpGlowC;   // toward the sun (xyz), brightness
uniform vec4 uSpCam;     // camera position
uniform vec4 uSpKitB;    // z: the relief's exaggeration; w: the label shown + its fade (-1: none)
const vec3 AIR = vec3(${num(air[0])}, ${num(air[1])}, ${num(air[2])});
const vec3 NIGHT = vec3(${num(night[0])}, ${num(night[1])}, ${num(night[2])});
const float HSTEP = ${num(hstep)};
vec4 wAn = vec4(0.0);
int wType = 0;
vec4 wQ = vec4(0.0, 0.0, 0.0, 1.0);
float wHide = 0.0;
float wExtra = 0.0;
vec3 wDir = vec3(0.0, 1.0, 0.0);
vec3 wN = vec3(0.0, 1.0, 0.0);
vec3 wRot(vec4 q, vec3 v) {
  return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}
vec4 wMul(vec4 a, vec4 b) {
  return vec4(a.w * b.xyz + b.w * a.xyz + cross(a.xyz, b.xyz), a.w * b.w - dot(a.xyz, b.xyz));
}
vec3 wNormal(float v) {
  float a = mod(v, 4096.0);
  float b = floor(v / 4096.0);
  vec2 e = vec2(a, b) / 4095.0 * 2.0 - 1.0;
  float z = 1.0 - abs(e.x) - abs(e.y);
  if (z < 0.0) e = (1.0 - abs(e.yx)) * vec2(e.x >= 0.0 ? 1.0 : -1.0, e.y >= 0.0 ? 1.0 : -1.0);
  return normalize(vec3(e, z));
}
// The quaternion of the turn taking x, y, z to a, b, c.
vec4 wAxes(vec3 a, vec3 b, vec3 c) {
  float tr = a.x + b.y + c.z;
  vec4 q;
  if (tr > 0.0) {
    float t = sqrt(tr + 1.0) * 2.0;
    q = vec4((b.z - c.y) / t, (c.x - a.z) / t, (a.y - b.x) / t, t * 0.25);
  } else if (a.x > b.y && a.x > c.z) {
    float t = sqrt(1.0 + a.x - b.y - c.z) * 2.0;
    q = vec4(t * 0.25, (b.x + a.y) / t, (c.x + a.z) / t, (b.z - c.y) / t);
  } else if (b.y > c.z) {
    float t = sqrt(1.0 + b.y - a.x - c.z) * 2.0;
    q = vec4((b.x + a.y) / t, t * 0.25, (c.y + b.z) / t, (c.x - a.z) / t);
  } else {
    float t = sqrt(1.0 + c.z - a.x - b.y) * 2.0;
    q = vec4((c.x + a.z) / t, (c.y + b.z) / t, t * 0.25, (a.y - b.x) / t);
  }
  return normalize(q);
}
void modifySplatCenter(inout vec3 center) {
  wAn = loadSplatAnim();
  wType = int(floor(wAn.x / 16.0 + 0.5));
  wExtra = mod(wAn.w, 256.0);
  float h = (floor(wAn.w / 256.0) - 32768.0) * HSTEP;
  float sp = uSpMorph.x;
  float tl = uSpMorph.y;
  wQ = wMul(vec4(sin(tl * 0.5), 0.0, 0.0, cos(tl * 0.5)), vec4(0.0, sin(sp * 0.5), 0.0, cos(sp * 0.5)));
  vec3 r = normalize(center + vec3(1e-6));
  // A feature's name is stored where it shows during its fly (the feature
  // turned to face +z), so it neither turns nor lifts, and the sort, which
  // ranks the stored places, draws it over the ground.
  if (wType == 2) {
    wQ = vec4(0.0, 0.0, 0.0, 1.0);
    wDir = r;
    wHide = 0.0;
    float shown = uSpKitB.w;
    if (shown < -0.5 || abs(floor(shown) - wExtra) > 0.5) wHide = 1.0;
    return;
  }
  // Lifted by the exaggeration (built at true height).
  float ex = uSpKitB.z;
  vec3 c = center + r * (ex - 1.0) * h;
  center = wRot(wQ, c);
  wDir = wRot(wQ, r);
  // The ground's normal, tipped as much more as the ground is lifted.
  vec3 n1 = wNormal(wAn.z);
  float nr = max(dot(n1, r), 0.05);
  wN = wRot(wQ, normalize(r - ex * (r - n1 / nr)));
  // The far side: hidden (a little past the rim, for tall ground there).
  float facing = dot(wDir, normalize(uSpCam.xyz - center));
  wHide = 1.0 - smoothstep(-0.2, -0.06, facing);
}
void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {
  if (wType == 0) {
    // A disc along the ground, stretched up the slope.
    float nd = dot(wN, wDir);
    vec3 up = wDir - wN * nd;
    float ul = length(up);
    if (ul > 1e-4) {
      up /= ul;
      rotation = wAxes(up, cross(wN, up), wN);
      scale.x = scale.y / max(0.3, nd);
    } else rotation = wMul(wQ, rotation);
  } else rotation = wMul(wQ, rotation);
  // At least about a pixel across, wherever the camera is (the close-up
  // patches' small splats would vanish from afar).
  float fl = 0.0007 * length(uSpCam.xyz - modifiedCenter);
  scale = vec3(max(scale.xy, vec2(fl)), max(scale.z, 0.2 * fl));
  scale *= uSpClock.y * (1.0 - wHide);
}
void modifySplatColor(vec3 center, inout vec4 color) {
  vec3 sun = normalize(uSpGlowC.xyz);
  float dr = dot(wDir, sun);
  float a = color.a * (1.0 - wHide);
  vec3 rgb = color.rgb;
  if (wType == 0) {
    float day = smoothstep(-0.03, 0.08, dr);
    float amb = uSpMorph.z;
    float lit = amb + (1.0 - amb) * max(0.0, dot(wN, sun)) * day;
    rgb = rgb * lit * uSpGlowC.w;
    rgb += NIGHT * pow(wExtra / 255.0, 1.4) * 2.2 * uSpMorph.w * (1.0 - smoothstep(-0.12, 0.02, dr));
  } else if (wType == 1) {
    vec3 view = normalize(uSpCam.xyz - center);
    float rim = 1.0 - abs(dot(wDir, view));
    rgb = AIR * uSpGlowC.w;
    a *= smoothstep(-0.25, 0.25, dr) * smoothstep(0.6, 0.97, rim);
  } else {
    float f = fract(max(uSpKitB.w, 0.0));
    a *= clamp(f * 2.0, 0.0, 1.0);
  }
  color = vec4(rgb * uSpClock.z, a);
}
`;

const WGSL = (air, night, hstep) => `
uniform uSpClock: vec4f;
uniform uSpMorph: vec4f;
uniform uSpGlowC: vec4f;
uniform uSpCam: vec4f;
uniform uSpKitB: vec4f;
const AIR: vec3f = vec3f(${num(air[0])}, ${num(air[1])}, ${num(air[2])});
const NIGHT: vec3f = vec3f(${num(night[0])}, ${num(night[1])}, ${num(night[2])});
const HSTEP: f32 = ${num(hstep)};
var<private> wAn: vec4f = vec4f(0.0);
var<private> wType: i32 = 0;
var<private> wQ: vec4f = vec4f(0.0, 0.0, 0.0, 1.0);
var<private> wHide: f32 = 0.0;
var<private> wExtra: f32 = 0.0;
var<private> wDir: vec3f = vec3f(0.0, 1.0, 0.0);
var<private> wN: vec3f = vec3f(0.0, 1.0, 0.0);
fn wRot(q: vec4f, v: vec3f) -> vec3f {
  return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}
fn wMul(a: vec4f, b: vec4f) -> vec4f {
  return vec4f(a.w * b.xyz + b.w * a.xyz + cross(a.xyz, b.xyz), a.w * b.w - dot(a.xyz, b.xyz));
}
fn wNormal(v: f32) -> vec3f {
  let a = v % 4096.0;
  let b = floor(v / 4096.0);
  var e = vec2f(a, b) / 4095.0 * 2.0 - 1.0;
  let z = 1.0 - abs(e.x) - abs(e.y);
  if (z < 0.0) {
    e = (1.0 - abs(e.yx)) * vec2f(select(-1.0, 1.0, e.x >= 0.0), select(-1.0, 1.0, e.y >= 0.0));
  }
  return normalize(vec3f(e, z));
}
fn wAxes(a: vec3f, b: vec3f, c: vec3f) -> vec4f {
  let tr = a.x + b.y + c.z;
  var q: vec4f;
  if (tr > 0.0) {
    let t = sqrt(tr + 1.0) * 2.0;
    q = vec4f((b.z - c.y) / t, (c.x - a.z) / t, (a.y - b.x) / t, t * 0.25);
  } else if (a.x > b.y && a.x > c.z) {
    let t = sqrt(1.0 + a.x - b.y - c.z) * 2.0;
    q = vec4f(t * 0.25, (b.x + a.y) / t, (c.x + a.z) / t, (b.z - c.y) / t);
  } else if (b.y > c.z) {
    let t = sqrt(1.0 + b.y - a.x - c.z) * 2.0;
    q = vec4f((b.x + a.y) / t, t * 0.25, (c.y + b.z) / t, (c.x - a.z) / t);
  } else {
    let t = sqrt(1.0 + c.z - a.x - b.y) * 2.0;
    q = vec4f((c.x + a.z) / t, (c.y + b.z) / t, t * 0.25, (a.y - b.x) / t);
  }
  return normalize(q);
}
fn modifySplatCenter(center: ptr<function, vec3f>) {
  wAn = loadSplatAnim();
  wType = i32(floor(wAn.x / 16.0 + 0.5));
  wExtra = wAn.w % 256.0;
  let h = (floor(wAn.w / 256.0) - 32768.0) * HSTEP;
  let sp = uniform.uSpMorph.x;
  let tl = uniform.uSpMorph.y;
  wQ = wMul(vec4f(sin(tl * 0.5), 0.0, 0.0, cos(tl * 0.5)), vec4f(0.0, sin(sp * 0.5), 0.0, cos(sp * 0.5)));
  let r = normalize(*center + vec3f(1e-6));
  if (wType == 2) {
    wQ = vec4f(0.0, 0.0, 0.0, 1.0);
    wDir = r;
    wHide = 0.0;
    let shown = uniform.uSpKitB.w;
    if (shown < -0.5 || abs(floor(shown) - wExtra) > 0.5) { wHide = 1.0; }
    return;
  }
  let ex = uniform.uSpKitB.z;
  let c = wRot(wQ, *center + r * (ex - 1.0) * h);
  *center = c;
  wDir = wRot(wQ, r);
  let n1 = wNormal(wAn.z);
  let nr = max(dot(n1, r), 0.05);
  wN = wRot(wQ, normalize(r - ex * (r - n1 / nr)));
  let facing = dot(wDir, normalize(uniform.uSpCam.xyz - c));
  wHide = 1.0 - smoothstep(-0.2, -0.06, facing);
}
fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {
  var sc = *scale;
  var rot = wMul(wQ, *rotation);
  if (wType == 0) {
    let nd = dot(wN, wDir);
    let up0 = wDir - wN * nd;
    let ul = length(up0);
    if (ul > 1e-4) {
      let up = up0 / ul;
      rot = wAxes(up, cross(wN, up), wN);
      sc.x = sc.y / max(0.3, nd);
    }
  }
  *rotation = rot;
  let fl = 0.0007 * length(uniform.uSpCam.xyz - modifiedCenter);
  *scale = vec3f(max(sc.xy, vec2f(fl)), max(sc.z, 0.2 * fl)) * (uniform.uSpClock.y * (1.0 - wHide));
}
fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
  let sun = normalize(uniform.uSpGlowC.xyz);
  let dr = dot(wDir, sun);
  var a = (*color).a * (1.0 - wHide);
  var rgb = (*color).rgb;
  if (wType == 0) {
    let day = smoothstep(-0.03, 0.08, dr);
    let amb = uniform.uSpMorph.z;
    let lit = amb + (1.0 - amb) * max(0.0, dot(wN, sun)) * day;
    rgb = rgb * lit * uniform.uSpGlowC.w;
    rgb = rgb + NIGHT * pow(wExtra / 255.0, 1.4) * 2.2 * uniform.uSpMorph.w * (1.0 - smoothstep(-0.12, 0.02, dr));
  } else if (wType == 1) {
    let view = normalize(uniform.uSpCam.xyz - center);
    let rim = 1.0 - abs(dot(wDir, view));
    rgb = AIR * uniform.uSpGlowC.w;
    a = a * smoothstep(-0.25, 0.25, dr) * smoothstep(0.6, 0.97, rim);
  } else {
    let f = fract(max(uniform.uSpKitB.w, 0.0));
    a = a * clamp(f * 2.0, 0.0, 1.0);
  }
  *color = vec4f(rgb * uniform.uSpClock.z, a);
}
`;

// The program for a world: air is its atmosphere's color and night the
// color of its lights at night ([r, g, b], 0..1); hstep the size of a
// height step in toy units (after the fit).
export function worldModifier({
  air = [0.6, 0.75, 1],
  night = [1, 0.75, 0.4],
  hstep = 1e-5,
  labelUp = 0.04,
} = {}) {
  return { glsl: GLSL(air, night, hstep, labelUp), wgsl: WGSL(air, night, hstep, labelUp) };
}

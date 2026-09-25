// Per-splat effects, computed on the GPU every frame.
//
// One work-buffer modifier (GSplatComponent.setWorkBufferModifier) holds the
// whole effect stack. Each effect is gated by its own uniforms, so effects
// stack freely and a disabled effect costs one uniform branch. The CPU side
// (EffectDriver) only turns the scene settings and the clock into a handful
// of vec4 uniforms; there are no per-splat CPU loops.
//
// Everything is computed in world space around the toy's centre. The toy's
// "home" position is the splat centre before any effect. Per-splat
// randomness comes from a hash of the splat index and the scene seed, so the
// result is deterministic for a given seed and time; only pointer input
// (pokes, magnet, paint) adds anything else.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ---- Effect catalogue -------------------------------------------------------

// Each effect has one or two sliders (0..1 unless stated). Tools act where the
// pointer touches the toy; ambient effects run on their own once switched on.
export const EFFECTS = [
  {
    id: "poke",
    label: "Poke",
    kind: "tool",
    hint: "Tap or drag on the toy to send ripples through it.",
    params: [
      { key: "strength", label: "Strength", min: 0, max: 1, value: 0.6 },
      { key: "wobble", label: "Wobble", min: 0, max: 1, value: 0.5 },
    ],
  },
  {
    id: "wind",
    label: "Wind",
    kind: "ambient",
    hint: "A noisy breeze that sways the top of the toy.",
    params: [
      { key: "strength", label: "Strength", min: 0, max: 1, value: 0.55 },
      { key: "direction", label: "Direction", min: 0, max: 360, value: 0, unit: "°" },
    ],
  },
  {
    id: "dissolve",
    label: "Dissolve",
    kind: "ambient",
    hint: "Splats fly apart and find their way home, over and over.",
    exclusive: "drop",
    params: [
      { key: "spread", label: "Spread", min: 0, max: 1, value: 0.55 },
      { key: "speed", label: "Speed", min: 0, max: 1, value: 0.5 },
    ],
  },
  {
    id: "drop",
    label: "Drop",
    kind: "ambient",
    hint: "Splats fall screen-down and bounce on an invisible floor. Shake the toy (or switch it off) to rebuild it.",
    exclusive: "dissolve",
    params: [
      { key: "bounce", label: "Bounce", min: 0, max: 1, value: 0.45 },
      { key: "scatter", label: "Scatter", min: 0, max: 1, value: 0.5 },
    ],
  },
  {
    id: "magnet",
    label: "Magnet",
    kind: "tool",
    hint: "Hold the pointer near the toy: positive pulls splats in, negative scatters them.",
    params: [
      { key: "strength", label: "Strength", min: -1, max: 1, value: 0.7 },
      { key: "radius", label: "Radius", min: 0, max: 1, value: 0.45 },
    ],
  },
  {
    id: "twist",
    label: "Twist",
    kind: "ambient",
    hint: "Wrings the toy around an axis.",
    axis: "y",
    params: [
      { key: "amount", label: "Amount", min: -1, max: 1, value: 0.5 },
      { key: "wobble", label: "Wobble", min: 0, max: 1, value: 0.3 },
    ],
  },
  {
    id: "slice",
    label: "Slice",
    kind: "ambient",
    hint: "A clipping plane sweeps through the toy and shows what is inside.",
    axis: "x",
    params: [
      { key: "position", label: "Position", min: -1, max: 1, value: 0 },
      { key: "sweep", label: "Sweep", min: 0, max: 1, value: 0.35 },
    ],
  },
  {
    id: "paint",
    label: "Paint",
    kind: "tool",
    hint: "Drag on the toy to recolour splats. Paint stays until you clear it.",
    params: [
      { key: "size", label: "Brush", min: 0, max: 1, value: 0.5 },
      { key: "splash", label: "Splash", min: 0, max: 1, value: 0.5 },
    ],
  },
];

export const AXES = ["x", "y", "z"];

export function effectDef(id) {
  return EFFECTS.find((e) => e.id === id);
}

export function defaultEffects() {
  const out = {};
  for (const e of EFFECTS) {
    const entry = { on: false };
    for (const p of e.params) entry[p.key] = p.value;
    if (e.axis) entry.axis = e.axis;
    if (e.id === "paint") entry.color = "#e63b2e";
    out[e.id] = entry;
  }
  return out;
}

// ---- Shader code ------------------------------------------------------------

const GLSL = /* glsl */ `
uniform vec4 uSpClock;   // x time (s), y splat scale, z exposure, w seed
uniform vec4 uSpToy;     // xyz toy centre (world), w radius
uniform vec4 uSpPoke0;   // xyz point, w start time
uniform vec4 uSpPoke1;
uniform vec4 uSpPoke2;
uniform vec4 uSpPoke3;
uniform vec4 uSpPokeP;   // x strength, y wobble
uniform vec4 uSpWind;    // xyz direction (unit), w strength (0 = off)
uniform vec4 uSpWindP;   // x time scale, yzw up axis
uniform vec4 uSpDiss;    // x progress 0..1, y spread, z stagger, w on
uniform vec4 uSpDrop;    // xyz gravity direction (unit), w seconds since the drop
uniform vec4 uSpDropP;   // x floor distance, y recall 0..1, z on, w restitution
uniform vec4 uSpDropQ;   // x scatter
uniform vec4 uSpMag;     // xyz point, w intensity 0..1
uniform vec4 uSpMagP;    // x strength -1..1, y radius (world)
uniform vec4 uSpGrab;    // xyz grabbed point, w radius (world)
uniform vec4 uSpGrabD;   // xyz how far it is pulled, w on
uniform vec4 uSpTwist;   // xyz axis (unit), w angle across the toy (radians)
uniform vec4 uSpSlice;   // xyz plane normal, w offset (world)
uniform vec4 uSpSliceP;  // x on, y glow width (world)
uniform vec4 uSpAccent;  // rgb accent colour
uniform vec4 uSpBodyQ;   // whole-toy rotation (quaternion x, y, z, w)
uniform vec4 uSpBodyT;   // xyz whole-toy offset, w squash (+ flattens, - stretches)
uniform vec4 uSpBodyF;   // x floor distance below the toy centre
uniform vec4 uSpPat;     // x on, y projection (0 wrap, 1 front, 2 globe), z repeats, w amount
uniform vec4 uSpPatB;    // x keep detail, y half height, z mean luminance, w half width
uniform sampler2D uSpPattern;
__KIT_UNIFORMS__
vec3 spHome = vec3(0.0);
vec3 spRest = vec3(0.0);
float spKitScale = 1.0;
float spFade = 1.0;
float spBright = 1.0;
vec3 spTint = vec3(0.0);
float spFlame = -1.0;
float spNoPat = 0.0;
vec4 spBodyQ = vec4(0.0, 0.0, 0.0, 1.0);
vec4 spPartQ = vec4(0.0, 0.0, 0.0, 1.0);
float spCut = 0.0;
float spShrink = 0.0;
float spLanded = 0.0;
float spShade = 0.0;
float spGlow = 0.0;
vec4 spRecol = vec4(0.0);
float spRecolK = 0.0;
vec4 spTwistQ = vec4(0.0, 0.0, 0.0, 1.0);

float spHash(uint n) {
  n = n ^ (uint(uSpClock.w) * 2654435761u);
  n = (n << 13u) ^ n;
  n = n * (n * n * 15731u + 789221u) + 1376312589u;
  return float(n & 0x7fffffffu) / 2147483647.0;
}

vec3 spHash3(uint n) {
  return vec3(spHash(n * 3u + 1u), spHash(n * 3u + 2u), spHash(n * 3u + 3u)) * 2.0 - 1.0;
}

vec3 spRotate(vec3 v, vec3 axis, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
}

vec4 spQuatMul(vec4 a, vec4 b) {
  return vec4(a.w * b.xyz + b.w * a.xyz + cross(a.xyz, b.xyz), a.w * b.w - dot(a.xyz, b.xyz));
}

vec3 spQuatRotate(vec4 q, vec3 v) {
  return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}

// Whole-toy motion (bounce, spin, wobble, float): squash about the floor,
// rotate about the centre, then move.
vec3 spBody(vec3 p) {
  vec4 q = uSpBodyQ;
  if (q.w == 0.0 && dot(q.xyz, q.xyz) == 0.0) q = vec4(0.0, 0.0, 0.0, 1.0);
  vec3 toy = uSpToy.xyz;
  vec3 rel = p - toy;
  float s = uSpBodyT.w;
  if (s != 0.0) {
    float f = uSpBodyF.x;
    rel = vec3(rel.x * (1.0 + 0.5 * s), (rel.y + f) * (1.0 - s) - f, rel.z * (1.0 + 0.5 * s));
  }
  spBodyQ = q;
  return toy + spQuatRotate(q, rel) + uSpBodyT.xyz;
}

// The pattern layer: a 2D design wrapped around the toy's rest pose.
vec3 spPattern(vec3 rgb) {
  vec3 q = spRest - uSpToy.xyz;
  vec2 uv;
  if (uSpPat.y < 0.5) {
    uv = vec2(atan(q.x, q.z) / 6.2831853 * uSpPat.z + 0.5, 0.5 - q.y / (2.0 * uSpPatB.y));
  } else if (uSpPat.y < 1.5) {
    uv = vec2(0.5 + q.x / (2.0 * uSpPatB.w), 0.5 - q.y / (2.0 * uSpPatB.y));
  } else {
    vec3 d = normalize(q + vec3(1e-6));
    uv = vec2(atan(d.x, d.z) / 6.2831853 * uSpPat.z + 0.5, acos(clamp(d.y, -1.0, 1.0)) / 3.1415927);
  }
  vec4 pc = textureLod(uSpPattern, uv, 0.0);
  float lum = dot(rgb, vec3(0.299, 0.587, 0.114));
  float shade = mix(1.0, clamp(lum / max(uSpPatB.z, 0.05), 0.3, 1.7), uSpPatB.x);
  return mix(rgb, pc.rgb * shade, uSpPat.w * pc.a);
}
__KIT_FUNCTIONS__
vec3 spPoke(vec4 poke, vec3 home) {
  float age = uSpClock.x - poke.w;
  if (age < 0.0 || age > 6.0) return vec3(0.0);
  float R = uSpToy.w;
  float rn = distance(home, poke.xyz) / R;
  float k = mix(8.0, 18.0, uSpPokeP.y);
  float w = mix(9.0, 16.0, uSpPokeP.y);
  float damp = mix(2.4, 0.9, uSpPokeP.y);
  float front = smoothstep(0.0, 0.12, age * w / k - rn);
  float env = exp(-age * damp) * exp(-rn * 2.2) * front;
  float wave = sin(rn * k - age * w) * env;
  float slope = cos(rn * k - age * w) * env;
  float dent = exp(-rn * rn * 45.0) * exp(-age * 6.0);
  vec3 nrm = normalize(poke.xyz - uSpToy.xyz + vec3(1e-5));
  vec3 away = home - poke.xyz;
  away = normalize(away - nrm * dot(away, nrm) + vec3(1e-5));
  // Fake shading so the rings read even when they move along the view.
  spShade += (slope * 0.5 - dent * 0.6) * uSpPokeP.x;
  return (nrm * (wave * 0.07 - dent * 0.1) + away * (slope * 0.05 + dent * 0.06)) * uSpPokeP.x * R;
}

vec3 spWind(vec3 home) {
  float s = uSpWind.w;
  float R = uSpToy.w;
  vec3 up = uSpWindP.yzw;
  vec3 rel = (home - uSpToy.xyz) / R;
  float tip = smoothstep(-1.1, 1.0, dot(rel, up));
  tip *= tip;
  float t = uSpClock.x * uSpWindP.x;
  float phase = dot(rel, uSpWind.xyz) * 2.2 + dot(rel, up) * 1.3;
  float gust = 0.6 + 0.4 * sin(t * 1.3 - phase) * sin(t * 0.37 + 1.7);
  float sway = s * tip * (0.65 * gust + 0.22 * sin(t * 3.1 - phase * 2.0));
  float h = spHash(splat.index * 5u + 11u);
  vec3 side = normalize(cross(up, uSpWind.xyz) + vec3(1e-5));
  float flutter = s * sin(t * 11.0 + h * 6.2832) * (0.25 + tip);
  return (uSpWind.xyz * sway * 0.24 + side * flutter * 0.012 - up * sway * sway * 0.06) * R;
}

void modifySplatCenter(inout vec3 center) {
  spRest = center;
  __KIT_CENTER__
  center = spBody(center);
  vec3 toy = uSpToy.xyz;
  float R = uSpToy.w;
  vec3 home = center;
  spHome = home;
  vec3 p = home;
  uint idx = splat.index;

  if (uSpTwist.w != 0.0) {
    vec3 a = uSpTwist.xyz;
    float ang = uSpTwist.w * dot(home - toy, a) / R;
    p = toy + spRotate(p - toy, a, ang);
    spTwistQ = vec4(a * sin(ang * 0.5), cos(ang * 0.5));
  }

  if (uSpWind.w > 0.0) p += spWind(home);

  if (uSpPokeP.x > 0.0) {
    p += spPoke(uSpPoke0, home) + spPoke(uSpPoke1, home) + spPoke(uSpPoke2, home) + spPoke(uSpPoke3, home);
  }

  if (uSpMag.w > 0.001) {
    vec3 d = p - uSpMag.xyz;
    float rad = max(uSpMagP.y, 1e-3);
    float f = uSpMag.w * exp(-dot(d, d) / (rad * rad) * 1.6);
    if (uSpMagP.x >= 0.0) {
      p = mix(p, uSpMag.xyz + d * 0.12, f * uSpMagP.x);
    } else {
      p += normalize(d + vec3(1e-5)) * (-uSpMagP.x) * rad * 1.1 * f;
    }
    spGlow = f * abs(uSpMagP.x);
  }

  // Grab (drag-to-stretch): splats near the grabbed point follow the pull,
  // fading with distance, so the toy stretches; it springs back on release.
  if (uSpGrabD.w > 0.5) {
    vec3 d = home - uSpGrab.xyz;
    float rad = max(uSpGrab.w, 1e-3);
    p += uSpGrabD.xyz * exp(-dot(d, d) / (rad * rad) * 1.5);
  }

  if (uSpDiss.w > 0.5) {
    float h = spHash(idx * 7u + 5u);
    float st = uSpDiss.z;
    float local = clamp(uSpDiss.x * (1.0 + st) - st * h, 0.0, 1.0);
    local = local * local * (3.0 - 2.0 * local);
    vec3 rel = home - toy;
    vec3 dir = normalize(spHash3(idx) + normalize(rel + vec3(1e-4)) * 0.9);
    vec3 dest = home + dir * R * uSpDiss.y * (0.4 + 0.8 * spHash(idx * 11u + 3u));
    dest = toy + spRotate(dest - toy, uSpWindP.yzw, local * 1.4);
    p = mix(p, dest, local);
    spShrink = local;
  }

  if (uSpDropP.z > 0.5) {
    vec3 g = uSpDrop.xyz;
    vec3 rel = p - toy;
    float rest = spHash(idx * 13u + 3u) * 0.06 * R;
    float h = max(0.0, uSpDropP.x - rest - dot(rel, g));
    float t = max(0.0, uSpDrop.w - spHash(idx * 17u + 1u) * 0.12);
    float acc = 7.0 * R;
    float t0 = sqrt(2.0 * h / acc);
    float fall;
    float landed = 0.0;
    if (t < t0) {
      fall = 0.5 * acc * t * t;
    } else {
      float e = uSpDropP.w;
      float v = acc * t0 * e;
      float tt = t - t0;
      fall = h;
      landed = 1.0;
      for (int k = 0; k < 6; k++) {
        float T = 2.0 * v / acc;
        if (tt < T) {
          fall = h - (v * tt - 0.5 * acc * tt * tt);
          landed = 0.4;
          break;
        }
        tt -= T;
        v *= e;
      }
    }
    float tl = max(0.0, t - t0);
    vec3 perp = rel - g * dot(rel, g);
    vec3 rnd = spHash3(idx * 19u + 7u);
    rnd -= g * dot(rnd, g);
    vec3 lat = (normalize(perp + vec3(1e-4)) * 0.7 + rnd * 0.6) * (0.2 + 0.8 * spHash(idx * 23u + 9u));
    lat *= uSpDropQ.x * sqrt(max(h, 0.0) * R) * 0.9;
    vec3 dropped = p + g * fall + lat * (1.0 - exp(-2.2 * tl));
    float r = uSpDropP.y;
    r = r * r * (3.0 - 2.0 * r);
    p = mix(dropped, p, r);
    spLanded = landed * (1.0 - r);
  }

  if (uSpSliceP.x > 0.5) {
    float side = dot(home - toy, uSpSlice.xyz) - uSpSlice.w;
    spCut = side > 0.0 ? 1.0 : 0.0;
  }

  center = p;
}

void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {
  rotation = spQuatMul(spTwistQ, spQuatMul(spBodyQ, spQuatMul(spPartQ, rotation)));
  scale *= uSpClock.y * spKitScale * (1.0 - 0.45 * spShrink) * (1.0 + 0.3 * spLanded);
  if (spCut > 0.5) scale = vec3(0.0);
}

void modifySplatColor(vec3 center, inout vec4 color) {
  __KIT_COLOR__
  if (uSpPat.x > 0.5 && spNoPat < 0.5) color.rgb = spPattern(color.rgb);
  if (spFlame >= 0.0) {
    color.rgb = mix(color.rgb, vec3(1.0, 0.36, 0.06), smoothstep(0.08, 0.6, spFlame));
    color.rgb *= 1.0 - 0.45 * smoothstep(0.5, 1.0, spFlame);
  }
  vec4 paint = loadPaintColor();
  if (spRecol.a > 0.0) {
    float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    vec3 kept = spRecol.rgb * (lum / max(dot(spRecol.rgb, vec3(0.299, 0.587, 0.114)), 0.02));
    color.rgb = mix(color.rgb, mix(spRecol.rgb, kept, spRecolK), clamp(spRecol.a, 0.0, 1.0));
  }
  color.rgb = color.rgb * (1.0 - paint.a) + paint.rgb;
  if (uSpSliceP.x > 0.5) {
    float side = dot(center - uSpToy.xyz, uSpSlice.xyz) - uSpSlice.w;
    float glow = side > 0.0 ? 0.0 : 1.0 - smoothstep(0.0, uSpSliceP.y, -side);
    color.rgb = mix(color.rgb, uSpAccent.rgb, glow * 0.85);
    if (side > 0.0) color.a = 0.0;
  }
  color.rgb = mix(color.rgb, uSpAccent.rgb, clamp(spGlow, 0.0, 1.0) * 0.35);
  color.rgb = color.rgb * spBright + spTint;
  color.a *= spFade;
  color.rgb *= uSpClock.z * (1.0 + clamp(spShade, -0.6, 0.6));
}
`;

const WGSL = /* wgsl */ `
uniform uSpClock: vec4f;
uniform uSpToy: vec4f;
uniform uSpPoke0: vec4f;
uniform uSpPoke1: vec4f;
uniform uSpPoke2: vec4f;
uniform uSpPoke3: vec4f;
uniform uSpPokeP: vec4f;
uniform uSpWind: vec4f;
uniform uSpWindP: vec4f;
uniform uSpDiss: vec4f;
uniform uSpDrop: vec4f;
uniform uSpDropP: vec4f;
uniform uSpDropQ: vec4f;
uniform uSpMag: vec4f;
uniform uSpMagP: vec4f;
uniform uSpGrab: vec4f;
uniform uSpGrabD: vec4f;
uniform uSpTwist: vec4f;
uniform uSpSlice: vec4f;
uniform uSpSliceP: vec4f;
uniform uSpAccent: vec4f;
uniform uSpBodyQ: vec4f;
uniform uSpBodyT: vec4f;
uniform uSpBodyF: vec4f;
uniform uSpPat: vec4f;
uniform uSpPatB: vec4f;
var uSpPattern: texture_2d<f32>;
var uSpPatternSampler: sampler;
__KIT_UNIFORMS__
var<private> spRest: vec3f = vec3f(0.0);
var<private> spKitScale: f32 = 1.0;
var<private> spFade: f32 = 1.0;
var<private> spBright: f32 = 1.0;
var<private> spTint: vec3f = vec3f(0.0);
var<private> spFlame: f32 = -1.0;
var<private> spNoPat: f32 = 0.0;
var<private> spBodyQ: vec4f = vec4f(0.0, 0.0, 0.0, 1.0);
var<private> spPartQ: vec4f = vec4f(0.0, 0.0, 0.0, 1.0);
var<private> spCut: f32 = 0.0;
var<private> spShrink: f32 = 0.0;
var<private> spLanded: f32 = 0.0;
var<private> spShade: f32 = 0.0;
var<private> spGlow: f32 = 0.0;
var<private> spRecol: vec4f = vec4f(0.0);
var<private> spRecolK: f32 = 0.0;
var<private> spTwistQ: vec4f = vec4f(0.0, 0.0, 0.0, 1.0);

fn spHash(m: u32) -> f32 {
  var n = m ^ (u32(uniform.uSpClock.w) * 2654435761u);
  n = (n << 13u) ^ n;
  n = n * (n * n * 15731u + 789221u) + 1376312589u;
  return f32(n & 0x7fffffffu) / 2147483647.0;
}

fn spHash3(n: u32) -> vec3f {
  return vec3f(spHash(n * 3u + 1u), spHash(n * 3u + 2u), spHash(n * 3u + 3u)) * 2.0 - vec3f(1.0);
}

fn spRotate(v: vec3f, axis: vec3f, angle: f32) -> vec3f {
  let c = cos(angle);
  let s = sin(angle);
  return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
}

fn spQuatMul(a: vec4f, b: vec4f) -> vec4f {
  return vec4f(a.w * b.xyz + b.w * a.xyz + cross(a.xyz, b.xyz), a.w * b.w - dot(a.xyz, b.xyz));
}

fn spQuatRotate(q: vec4f, v: vec3f) -> vec3f {
  return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}

fn spBody(p: vec3f) -> vec3f {
  var q = uniform.uSpBodyQ;
  if (q.w == 0.0 && dot(q.xyz, q.xyz) == 0.0) { q = vec4f(0.0, 0.0, 0.0, 1.0); }
  let toy = uniform.uSpToy.xyz;
  var rel = p - toy;
  let s = uniform.uSpBodyT.w;
  if (s != 0.0) {
    let f = uniform.uSpBodyF.x;
    rel = vec3f(rel.x * (1.0 + 0.5 * s), (rel.y + f) * (1.0 - s) - f, rel.z * (1.0 + 0.5 * s));
  }
  spBodyQ = q;
  return toy + spQuatRotate(q, rel) + uniform.uSpBodyT.xyz;
}

fn spPattern(rgb: vec3f) -> vec3f {
  let q = spRest - uniform.uSpToy.xyz;
  var uv: vec2f;
  if (uniform.uSpPat.y < 0.5) {
    uv = vec2f(atan2(q.x, q.z) / 6.2831853 * uniform.uSpPat.z + 0.5, 0.5 - q.y / (2.0 * uniform.uSpPatB.y));
  } else if (uniform.uSpPat.y < 1.5) {
    uv = vec2f(0.5 + q.x / (2.0 * uniform.uSpPatB.w), 0.5 - q.y / (2.0 * uniform.uSpPatB.y));
  } else {
    let d = normalize(q + vec3f(1e-6));
    uv = vec2f(atan2(d.x, d.z) / 6.2831853 * uniform.uSpPat.z + 0.5, acos(clamp(d.y, -1.0, 1.0)) / 3.1415927);
  }
  let pc = textureSampleLevel(uSpPattern, uSpPatternSampler, uv, 0.0);
  let lum = dot(rgb, vec3f(0.299, 0.587, 0.114));
  let shade = mix(1.0, clamp(lum / max(uniform.uSpPatB.z, 0.05), 0.3, 1.7), uniform.uSpPatB.x);
  return mix(rgb, pc.rgb * shade, uniform.uSpPat.w * pc.a);
}
__KIT_FUNCTIONS__
fn spPoke(poke: vec4f, home: vec3f) -> vec3f {
  let age = uniform.uSpClock.x - poke.w;
  if (age < 0.0 || age > 6.0) { return vec3f(0.0); }
  let R = uniform.uSpToy.w;
  let rn = distance(home, poke.xyz) / R;
  let k = mix(8.0, 18.0, uniform.uSpPokeP.y);
  let w = mix(9.0, 16.0, uniform.uSpPokeP.y);
  let damp = mix(2.4, 0.9, uniform.uSpPokeP.y);
  let front = smoothstep(0.0, 0.12, age * w / k - rn);
  let env = exp(-age * damp) * exp(-rn * 2.2) * front;
  let wave = sin(rn * k - age * w) * env;
  let slope = cos(rn * k - age * w) * env;
  let dent = exp(-rn * rn * 45.0) * exp(-age * 6.0);
  let nrm = normalize(poke.xyz - uniform.uSpToy.xyz + vec3f(1e-5));
  var away = home - poke.xyz;
  away = normalize(away - nrm * dot(away, nrm) + vec3f(1e-5));
  spShade = spShade + (slope * 0.5 - dent * 0.6) * uniform.uSpPokeP.x;
  return (nrm * (wave * 0.07 - dent * 0.1) + away * (slope * 0.05 + dent * 0.06)) * uniform.uSpPokeP.x * R;
}

fn spWind(home: vec3f) -> vec3f {
  let s = uniform.uSpWind.w;
  let R = uniform.uSpToy.w;
  let up = uniform.uSpWindP.yzw;
  let rel = (home - uniform.uSpToy.xyz) / R;
  var tip = smoothstep(-1.1, 1.0, dot(rel, up));
  tip = tip * tip;
  let t = uniform.uSpClock.x * uniform.uSpWindP.x;
  let phase = dot(rel, uniform.uSpWind.xyz) * 2.2 + dot(rel, up) * 1.3;
  let gust = 0.6 + 0.4 * sin(t * 1.3 - phase) * sin(t * 0.37 + 1.7);
  let sway = s * tip * (0.65 * gust + 0.22 * sin(t * 3.1 - phase * 2.0));
  let h = spHash(splat.index * 5u + 11u);
  let side = normalize(cross(up, uniform.uSpWind.xyz) + vec3f(1e-5));
  let flutter = s * sin(t * 11.0 + h * 6.2832) * (0.25 + tip);
  return (uniform.uSpWind.xyz * sway * 0.24 + side * flutter * 0.012 - up * sway * sway * 0.06) * R;
}

fn modifySplatCenter(center: ptr<function, vec3f>) {
  spRest = *center;
  __KIT_CENTER__
  *center = spBody(*center);
  let toy = uniform.uSpToy.xyz;
  let R = uniform.uSpToy.w;
  let home = *center;
  var p = home;
  let idx = splat.index;

  if (uniform.uSpTwist.w != 0.0) {
    let a = uniform.uSpTwist.xyz;
    let ang = uniform.uSpTwist.w * dot(home - toy, a) / R;
    p = toy + spRotate(p - toy, a, ang);
    spTwistQ = vec4f(a * sin(ang * 0.5), cos(ang * 0.5));
  }

  if (uniform.uSpWind.w > 0.0) { p = p + spWind(home); }

  if (uniform.uSpPokeP.x > 0.0) {
    p = p + spPoke(uniform.uSpPoke0, home) + spPoke(uniform.uSpPoke1, home) + spPoke(uniform.uSpPoke2, home) + spPoke(uniform.uSpPoke3, home);
  }

  if (uniform.uSpMag.w > 0.001) {
    let d = p - uniform.uSpMag.xyz;
    let rad = max(uniform.uSpMagP.y, 1e-3);
    let f = uniform.uSpMag.w * exp(-dot(d, d) / (rad * rad) * 1.6);
    if (uniform.uSpMagP.x >= 0.0) {
      p = mix(p, uniform.uSpMag.xyz + d * 0.12, f * uniform.uSpMagP.x);
    } else {
      p = p + normalize(d + vec3f(1e-5)) * (-uniform.uSpMagP.x) * rad * 1.1 * f;
    }
    spGlow = f * abs(uniform.uSpMagP.x);
  }

  if (uniform.uSpGrabD.w > 0.5) {
    let d = home - uniform.uSpGrab.xyz;
    let rad = max(uniform.uSpGrab.w, 1e-3);
    p = p + uniform.uSpGrabD.xyz * exp(-dot(d, d) / (rad * rad) * 1.5);
  }

  if (uniform.uSpDiss.w > 0.5) {
    let h = spHash(idx * 7u + 5u);
    let st = uniform.uSpDiss.z;
    var local = clamp(uniform.uSpDiss.x * (1.0 + st) - st * h, 0.0, 1.0);
    local = local * local * (3.0 - 2.0 * local);
    let rel = home - toy;
    let dir = normalize(spHash3(idx) + normalize(rel + vec3f(1e-4)) * 0.9);
    var dest = home + dir * R * uniform.uSpDiss.y * (0.4 + 0.8 * spHash(idx * 11u + 3u));
    dest = toy + spRotate(dest - toy, uniform.uSpWindP.yzw, local * 1.4);
    p = mix(p, dest, local);
    spShrink = local;
  }

  if (uniform.uSpDropP.z > 0.5) {
    let g = uniform.uSpDrop.xyz;
    let rel = p - toy;
    let rest = spHash(idx * 13u + 3u) * 0.06 * R;
    let h = max(0.0, uniform.uSpDropP.x - rest - dot(rel, g));
    let t = max(0.0, uniform.uSpDrop.w - spHash(idx * 17u + 1u) * 0.12);
    let acc = 7.0 * R;
    let t0 = sqrt(2.0 * h / acc);
    var fall: f32;
    var landed: f32 = 0.0;
    if (t < t0) {
      fall = 0.5 * acc * t * t;
    } else {
      let e = uniform.uSpDropP.w;
      var v = acc * t0 * e;
      var tt = t - t0;
      fall = h;
      landed = 1.0;
      for (var k: i32 = 0; k < 6; k = k + 1) {
        let T = 2.0 * v / acc;
        if (tt < T) {
          fall = h - (v * tt - 0.5 * acc * tt * tt);
          landed = 0.4;
          break;
        }
        tt = tt - T;
        v = v * e;
      }
    }
    let tl = max(0.0, t - t0);
    let perp = rel - g * dot(rel, g);
    var rnd = spHash3(idx * 19u + 7u);
    rnd = rnd - g * dot(rnd, g);
    var lat = (normalize(perp + vec3f(1e-4)) * 0.7 + rnd * 0.6) * (0.2 + 0.8 * spHash(idx * 23u + 9u));
    lat = lat * uniform.uSpDropQ.x * sqrt(max(h, 0.0) * R) * 0.9;
    let dropped = p + g * fall + lat * (1.0 - exp(-2.2 * tl));
    var r = uniform.uSpDropP.y;
    r = r * r * (3.0 - 2.0 * r);
    p = mix(dropped, p, r);
    spLanded = landed * (1.0 - r);
  }

  if (uniform.uSpSliceP.x > 0.5) {
    let side = dot(home - toy, uniform.uSpSlice.xyz) - uniform.uSpSlice.w;
    spCut = select(0.0, 1.0, side > 0.0);
  }

  *center = p;
}

fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {
  *rotation = spQuatMul(spTwistQ, spQuatMul(spBodyQ, spQuatMul(spPartQ, *rotation)));
  *scale = *scale * (uniform.uSpClock.y * spKitScale * (1.0 - 0.45 * spShrink) * (1.0 + 0.3 * spLanded));
  if (spCut > 0.5) { *scale = vec3f(0.0); }
}

fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
  var base = (*color).rgb;
  __KIT_COLOR__
  if (uniform.uSpPat.x > 0.5 && spNoPat < 0.5) { base = spPattern(base); }
  if (spFlame >= 0.0) {
    base = mix(base, vec3f(1.0, 0.36, 0.06), smoothstep(0.08, 0.6, spFlame));
    base = base * (1.0 - 0.45 * smoothstep(0.5, 1.0, spFlame));
  }
  if (spRecol.a > 0.0) {
    let lum = dot(base, vec3f(0.299, 0.587, 0.114));
    let kept = spRecol.rgb * (lum / max(dot(spRecol.rgb, vec3f(0.299, 0.587, 0.114)), 0.02));
    base = mix(base, mix(spRecol.rgb, kept, spRecolK), clamp(spRecol.a, 0.0, 1.0));
  }
  let paint = loadPaintColor();
  var rgb = base * (1.0 - paint.a) + paint.rgb;
  var a = (*color).a;
  if (uniform.uSpSliceP.x > 0.5) {
    let side = dot(center - uniform.uSpToy.xyz, uniform.uSpSlice.xyz) - uniform.uSpSlice.w;
    let glow = select(1.0 - smoothstep(0.0, uniform.uSpSliceP.y, -side), 0.0, side > 0.0);
    rgb = mix(rgb, uniform.uSpAccent.rgb, glow * 0.85);
    if (side > 0.0) { a = 0.0; }
  }
  rgb = mix(rgb, uniform.uSpAccent.rgb, clamp(spGlow, 0.0, 1.0) * 0.35);
  rgb = rgb * spBright + spTint;
  a = a * spFade;
  *color = vec4f(rgb * uniform.uSpClock.z * (1.0 + clamp(spShade, -0.6, 0.6)), a);
}
`;

// Generated toys carry a per-splat "splatAnim" stream (RGBA32F): x = part
// index (0..15) + 16 when the pattern layer should skip the splat, y =
// behaviour kind (see KINDS), z and w = the behaviour's two parameters.
// Parts are rigid groups moved by uSpParts (3 vec4 per part: rotation,
// pivot, offset + visibility). Captured toys have no such stream, so they
// use the variant without these pieces.
export const KINDS = {
  none: 0,
  orbit: 1, // turn about the toy's up axis: z = turns per unit time at the rim, w = falloff (0 rigid, 1.5 Keplerian)
  beat: 2, // heartbeat swell from the centre: z = amount, w = phase
  breathe: 3, // slow sine swell: z = amount, w = phase
  flame: 4, // rise, shrink and redden in a loop: z = height (toy radii), w = phase
  rise: 5, // drift up and fade in a loop (embers, bubbles, smoke): z = height, w = phase
  fall: 6, // fall and fade in a loop (rain, snow): z = distance, w = phase
  twinkle: 7, // brightness flicker: z = amount, w = phase
  sway: 8, // bend with height above a base (plants, tentacles): z = amount, w = base height
  grow: 9, // appear as the grow control passes z (0..1)
  melt: 10, // slump and spread towards the floor as energy rises: z = how easily
  pulse: 11, // a glow runs along a path: z = position along the path (0..1)
  wave: 12, // ripple up and down: z = amount, w = phase
  glint: 13, // sparkle as the camera moves: z = amount
  token: 14, // a game piece moved and turned by uSpTokens: z = token index (0..47)
  screen: 15, // a screen pixel coloured from the uSpScreen texture: z, w = u, v
  key: 16, // a key that goes down when pressed: z = key index (uSpKitB.w = index + depth)
};

const GLSL_KIT_UNIFORMS = `uniform vec4 uSpKit;     // x time, y alive (0/1), z speed, w energy (melt 0..1)
uniform vec4 uSpKitB;    // x grow progress 0..1, y floor distance below the centre, z amount
uniform vec4 uSpGlowC;   // rgb pulse glow colour, a strength
uniform vec4 uSpCam;     // xyz camera position
uniform vec4 uSpParts[48];
uniform vec4 uSpTokens[96]; // per token: xyz offset + w visibility, then a rotation
uniform sampler2D uSpScreen; // a live screen picture (the laptop's)
vec3 spScreenUV = vec3(0.0); // xy uv, z > 0 for a screen splat`;

const GLSL_KIT_FUNCTIONS = `
float spBeat(float x) {
  float f = fract(x);
  return exp(-pow((f - 0.12) * 18.0, 2.0)) + 0.6 * exp(-pow((f - 0.34) * 16.0, 2.0));
}

vec3 spKitCenter(vec3 p) {
  vec4 an = loadSplatAnim();
  int pk = int(an.x + 0.5);
  int part = pk & 15;
  spNoPat = float((pk >> 4) & 1);
  int kind = int(an.y + 0.5);
  vec3 toy = uSpToy.xyz;
  float R = uSpToy.w;
  vec3 up = vec3(0.0, 1.0, 0.0);
  float t = uSpKit.x * uSpKit.z;
  float amt = uSpKitB.z;
  if (uSpKit.y > 0.5 && kind > 0) {
    float h = spHash(splat.index * 29u + 7u);
    vec3 rel = p - toy;
    if (kind == 1) {
      float r = length(rel.xz);
      float w = an.z * pow(max(r, 0.04 * R) / R, -an.w);
      p = toy + spRotate(rel, up, t * w);
    } else if (kind == 2) {
      p = toy + rel * (1.0 + amt * an.z * spBeat(t * 1.1 + an.w));
    } else if (kind == 3) {
      p = toy + rel * (1.0 + amt * an.z * sin(t * 1.3 + an.w));
    } else if (kind == 4 || kind == 5) {
      bool flame = kind == 4;
      float c = fract(t * (0.6 + 0.5 * h) * (flame ? 1.4 : 0.35) + an.w + h);
      float travel = amt * an.z * R;
      vec3 side = vec3(sin(t * 3.0 + h * 17.0), 0.0, cos(t * 2.3 + h * 11.0));
      p += up * c * travel + side * (flame ? 0.07 : 0.22) * c * travel;
      spFade = smoothstep(0.0, 0.1, c) * (1.0 - smoothstep(0.55, 1.0, c));
      spKitScale = flame ? mix(1.0, 0.3, c) : mix(0.7, 1.25, c);
      if (flame) spFlame = c;
    } else if (kind == 6) {
      float c = fract(t * (0.72 + 0.25 * h) + an.w);
      p -= up * c * an.z * R;
      spFade = smoothstep(0.0, 0.08, c) * (1.0 - smoothstep(0.85, 1.0, c));
    } else if (kind == 7) {
      spBright = 1.0 + amt * an.z * sin(t * (2.0 + 3.0 * h) + 6.2832 * h + an.w);
    } else if (kind == 8) {
      float k = max(0.0, dot(rel, up) - an.w) / R;
      vec3 d = vec3(sin(t * 1.3 + rel.x * 1.7 / R + rel.z * 1.1 / R), 0.0, 0.6 * cos(t * 1.1 + rel.z * 1.9 / R));
      p += d * amt * an.z * k * k * R;
    } else if (kind == 9) {
      spKitScale = smoothstep(an.z, an.z + 0.08, uSpKitB.x);
    } else if (kind == 10) {
      float m = clamp(uSpKit.w * an.z, 0.0, 1.0);
      float f = uSpKitB.y;
      float hgt = max(0.0, rel.y + f);
      float nh = hgt * (1.0 - m * (0.82 + 0.15 * h));
      float spread = 1.0 + m * (0.4 + 1.1 * (1.0 - nh / max(2.0 * f, 1e-3)));
      p = toy + vec3(rel.x * spread, nh - f, rel.z * spread);
    } else if (kind == 11) {
      float d = fract(t * 0.35);
      float g = exp(-pow((an.z - d) * 16.0, 2.0)) + exp(-pow((an.z - d + 1.0) * 16.0, 2.0));
      spTint += uSpGlowC.rgb * g * uSpGlowC.a;
    } else if (kind == 12) {
      p += up * sin(rel.x * 5.0 / R + rel.z * 3.0 / R - t * 2.0 + an.w) * amt * an.z * R;
    } else if (kind == 13) {
      float g = pow(max(0.0, sin(dot(uSpCam.xyz, vec3(3.1, 2.7, 3.7) * (0.5 + h)) + h * 40.0 + t * 0.5)), 24.0);
      spBright = 1.0 + an.z * g * 3.0;
    }
  }
  if (kind == 15) spScreenUV = vec3(an.z, an.w, 1.0);
  if (kind == 16 && int(an.z + 0.5) == int(floor(uSpKitB.w + 0.001)) && uSpKitB.w >= 0.0) {
    p -= up * fract(uSpKitB.w) * 0.012 * R;
  }
  if (kind == 14) {
    // Game pieces move by uSpTokens even when the toy's own motion is off.
    int ti = clamp(int(an.z + 0.5), 0, 47);
    vec4 to = uSpTokens[ti * 2];
    vec4 tq = uSpTokens[ti * 2 + 1];
    if (tq.w == 0.0 && dot(tq.xyz, tq.xyz) == 0.0) tq = vec4(0.0, 0.0, 0.0, 1.0);
    p = spQuatRotate(tq, p) + to.xyz;
    spPartQ = tq;
    spKitScale *= to.w;
  }
  if (part > 0) {
    vec4 q = uSpParts[part * 3];
    vec4 pv = uSpParts[part * 3 + 1];
    vec4 ofs = uSpParts[part * 3 + 2];
    if (q.w == 0.0 && dot(q.xyz, q.xyz) == 0.0) q = vec4(0.0, 0.0, 0.0, 1.0);
    p = pv.xyz + spQuatRotate(q, (p - pv.xyz) * (1.0 + pv.w)) + ofs.xyz;
    spPartQ = q;
    spKitScale *= ofs.w * (1.0 + pv.w);
  }
  return p;
}
`;

const WGSL_KIT_UNIFORMS = `uniform uSpKit: vec4f;
uniform uSpKitB: vec4f;
uniform uSpGlowC: vec4f;
uniform uSpCam: vec4f;
uniform uSpParts: array<vec4f, 48>;
uniform uSpTokens: array<vec4f, 96>;
var uSpScreen: texture_2d<f32>;
var uSpScreenSampler: sampler;
var<private> spScreenUV: vec3f = vec3f(0.0);`;

const WGSL_KIT_FUNCTIONS = `
fn spBeat(x: f32) -> f32 {
  let f = fract(x);
  return exp(-pow((f - 0.12) * 18.0, 2.0)) + 0.6 * exp(-pow((f - 0.34) * 16.0, 2.0));
}

fn spKitCenter(p0: vec3f) -> vec3f {
  var p = p0;
  let an = loadSplatAnim();
  let pk = i32(an.x + 0.5);
  let part = pk & 15;
  spNoPat = f32((pk >> 4u) & 1);
  let kind = i32(an.y + 0.5);
  let toy = uniform.uSpToy.xyz;
  let R = uniform.uSpToy.w;
  let up = vec3f(0.0, 1.0, 0.0);
  let t = uniform.uSpKit.x * uniform.uSpKit.z;
  let amt = uniform.uSpKitB.z;
  if (uniform.uSpKit.y > 0.5 && kind > 0) {
    let h = spHash(splat.index * 29u + 7u);
    let rel = p - toy;
    if (kind == 1) {
      let r = length(rel.xz);
      let w = an.z * pow(max(r, 0.04 * R) / R, -an.w);
      p = toy + spRotate(rel, up, t * w);
    } else if (kind == 2) {
      p = toy + rel * (1.0 + amt * an.z * spBeat(t * 1.1 + an.w));
    } else if (kind == 3) {
      p = toy + rel * (1.0 + amt * an.z * sin(t * 1.3 + an.w));
    } else if (kind == 4 || kind == 5) {
      let flame = kind == 4;
      let c = fract(t * (0.6 + 0.5 * h) * select(0.35, 1.4, flame) + an.w + h);
      let travel = amt * an.z * R;
      let side = vec3f(sin(t * 3.0 + h * 17.0), 0.0, cos(t * 2.3 + h * 11.0));
      p = p + up * c * travel + side * select(0.22, 0.07, flame) * c * travel;
      spFade = smoothstep(0.0, 0.1, c) * (1.0 - smoothstep(0.55, 1.0, c));
      spKitScale = select(mix(0.7, 1.25, c), mix(1.0, 0.3, c), flame);
      if (flame) { spFlame = c; }
    } else if (kind == 6) {
      let c = fract(t * (0.72 + 0.25 * h) + an.w);
      p = p - up * c * an.z * R;
      spFade = smoothstep(0.0, 0.08, c) * (1.0 - smoothstep(0.85, 1.0, c));
    } else if (kind == 7) {
      spBright = 1.0 + amt * an.z * sin(t * (2.0 + 3.0 * h) + 6.2832 * h + an.w);
    } else if (kind == 8) {
      let k = max(0.0, dot(rel, up) - an.w) / R;
      let d = vec3f(sin(t * 1.3 + rel.x * 1.7 / R + rel.z * 1.1 / R), 0.0, 0.6 * cos(t * 1.1 + rel.z * 1.9 / R));
      p = p + d * amt * an.z * k * k * R;
    } else if (kind == 9) {
      spKitScale = smoothstep(an.z, an.z + 0.08, uniform.uSpKitB.x);
    } else if (kind == 10) {
      let m = clamp(uniform.uSpKit.w * an.z, 0.0, 1.0);
      let f = uniform.uSpKitB.y;
      let hgt = max(0.0, rel.y + f);
      let nh = hgt * (1.0 - m * (0.82 + 0.15 * h));
      let spread = 1.0 + m * (0.4 + 1.1 * (1.0 - nh / max(2.0 * f, 1e-3)));
      p = toy + vec3f(rel.x * spread, nh - f, rel.z * spread);
    } else if (kind == 11) {
      let d = fract(t * 0.35);
      let g = exp(-pow((an.z - d) * 16.0, 2.0)) + exp(-pow((an.z - d + 1.0) * 16.0, 2.0));
      spTint = spTint + uniform.uSpGlowC.rgb * g * uniform.uSpGlowC.a;
    } else if (kind == 12) {
      p = p + up * sin(rel.x * 5.0 / R + rel.z * 3.0 / R - t * 2.0 + an.w) * amt * an.z * R;
    } else if (kind == 13) {
      let g = pow(max(0.0, sin(dot(uniform.uSpCam.xyz, vec3f(3.1, 2.7, 3.7) * (0.5 + h)) + h * 40.0 + t * 0.5)), 24.0);
      spBright = 1.0 + an.z * g * 3.0;
    }
  }
  if (kind == 15) { spScreenUV = vec3f(an.z, an.w, 1.0); }
  if (kind == 16 && i32(an.z + 0.5) == i32(floor(uniform.uSpKitB.w + 0.001)) && uniform.uSpKitB.w >= 0.0) {
    p = p - up * fract(uniform.uSpKitB.w) * 0.012 * R;
  }
  if (kind == 14) {
    let ti = clamp(i32(an.z + 0.5), 0, 47);
    let to = uniform.uSpTokens[ti * 2];
    var tq = uniform.uSpTokens[ti * 2 + 1];
    if (tq.w == 0.0 && dot(tq.xyz, tq.xyz) == 0.0) { tq = vec4f(0.0, 0.0, 0.0, 1.0); }
    p = spQuatRotate(tq, p) + to.xyz;
    spPartQ = tq;
    spKitScale = spKitScale * to.w;
  }
  if (part > 0) {
    var q = uniform.uSpParts[part * 3];
    let pv = uniform.uSpParts[part * 3 + 1];
    let ofs = uniform.uSpParts[part * 3 + 2];
    if (q.w == 0.0 && dot(q.xyz, q.xyz) == 0.0) { q = vec4f(0.0, 0.0, 0.0, 1.0); }
    p = pv.xyz + spQuatRotate(q, (p - pv.xyz) * (1.0 + pv.w)) + ofs.xyz;
    spPartQ = q;
    spKitScale = spKitScale * ofs.w * (1.0 + pv.w);
  }
  return p;
}
`;

// Captured toys with a rig (src/rigs.js) carry a per-splat "splatPart"
// stream (RGBA8, written once by a GSplatProcessor from the rig's regions):
// r = part index / 255, g = how much the part moves the splat (soft edges
// blend into the rest of the toy). The parts move by uSpParts as in kits.
const GLSL_RIG_UNIFORMS = `uniform vec4 uSpParts[48];
uniform vec4 uSpRigTint[16]; // per part: rgb glow added, a brightness gain
uniform vec4 uSpFx[40];      // whole-body effects: 4 slots of 10 vec4 (see fxTable in src/rig-fx.js)
uniform vec4 uSpRigDbg;  // x > 0 tints each part (?rig=show), and the colour keys`;

const GLSL_RIG_FUNCTIONS = `
float spCellHash(vec3 c) {
  return fract(sin(dot(c, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}

vec3 spCellHash3(vec3 c) {
  return vec3(spCellHash(c), spCellHash(c + 17.31), spCellHash(c + 41.97)) * 2.0 - 1.0;
}

// One whole-body effect slot (fields in fxTable, src/rig-fx.js).
vec3 spRigFx(vec3 p, vec3 rest, vec4 pk, int part, int o) {
  vec4 f0 = uSpFx[o];
  vec4 f1 = uSpFx[o + 1];
  if (f0.x < 0.5 || (f1.x == 0.0 && f1.y == 0.0)) return p;
  vec4 f2 = uSpFx[o + 2];
  vec4 f3 = uSpFx[o + 3];
  vec4 f4 = uSpFx[o + 4];
  vec4 f5 = uSpFx[o + 5];
  vec4 f6 = uSpFx[o + 6];
  vec4 f7 = uSpFx[o + 7];
  int sm = int(f0.x + 0.5);
  float sel = sm == 2 ? pk.z : sm == 3 ? pk.w : sm == 4 ? 1.0 - pk.z : sm == 5 ? (part == int(f7.z + 0.5) ? pk.y : 0.0) : 1.0;
  vec3 org = f2.xyz;
  vec3 v = rest - org;
  int mk = int(f0.y + 0.5);
  if (mk == 1) {
    sel *= smoothstep(-0.015, 0.015, dot(v, f5.xyz) - f5.w);
  } else if (mk == 2) {
    vec3 ax = f5.xyz;
    vec3 b1 = normalize(cross(ax, abs(ax.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 b2 = cross(ax, b1);
    float a = atan(dot(v, b2), dot(v, b1)) / 6.2831853 + 0.5;
    float st = fract(a * f5.w);
    sel *= smoothstep(0.02, 0.08, st) * (1.0 - smoothstep(0.42, 0.48, st));
  } else if (mk == 3) {
    sel *= 1.0 - smoothstep(0.8, 1.0, distance(rest, f5.xyz) / max(f5.w, 1e-3));
  } else if (mk == 4) {
    vec4 f8 = uSpFx[o + 8];
    vec3 fl = v - f5.xyz * dot(v, f5.xyz);
    float ang = acos(clamp(dot(normalize(fl + vec3(1e-5)), f8.xyz), -1.0, 1.0));
    sel *= 1.0 - smoothstep(f8.w - 0.03, f8.w, ang);
  }
  if (sel <= 0.001) return p;
  float cell = f7.y;
  vec3 cid = cell > 0.0 ? floor(rest / cell) : vec3(0.0);
  vec3 pc = (cid + 0.5) * cell;
  if (cell < 0.0) {
    // Voronoi pieces: the nearest of the jittered points in the 27 cells round.
    float sz = -cell;
    vec3 g = floor(rest / sz);
    float bd = 1e9;
    for (int z = -1; z <= 1; z++)
      for (int y = -1; y <= 1; y++)
        for (int x = -1; x <= 1; x++) {
          vec3 c = g + vec3(float(x), float(y), float(z));
          vec3 q = (c + 0.5 + 0.38 * spCellHash3(c)) * sz;
          float d = dot(rest - q, rest - q);
          if (d < bd) {
            bd = d;
            cid = c;
            pc = q;
          }
        }
  }
  float hc = cell != 0.0 ? spCellHash(cid) : spHash(splat.index * 37u + 3u);
  int pt = int(f0.w + 0.5);
  float z = f1.z;
  float env = 1.0;
  if (pt == 1) {
    env = exp(-pow((length(v) - z) / max(f2.w, 1e-3), 2.0));
  } else if (pt == 2) {
    env = exp(-pow((dot(v, f4.xyz) - z) / max(f2.w, 1e-3), 2.0));
  } else if (pt == 3 || pt == 5) {
    float spread = f4.w;
    float local = clamp(z * (1.0 + spread) - spread * hc, 0.0, 1.0);
    env = pt == 3 ? sin(3.1415927 * local) : local * local * (3.0 - 2.0 * local);
  } else if (pt == 4) {
    vec3 ax = f4.xyz;
    vec3 b1 = normalize(cross(ax, abs(ax.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 b2 = cross(ax, b1);
    float a = atan(dot(v, b2), dot(v, b1)) / 6.2831853 + 0.5;
    float u = (a + f4.w * clamp(dot(v, ax) / uSpToy.w * 0.5 + 0.5, 0.0, 1.0)) / (1.0 + f4.w);
    env = 1.0 - smoothstep(z - f2.w, z, u);
  } else if (pt == 6) {
    env = sin(f4.w * dot(v, f4.xyz) - z);
  }
  float m = f1.x * env * sel;
  int mv = int(f0.z + 0.5);
  if (mv == 1) {
    p += normalize(v + vec3(1e-5)) * m;
  } else if (mv == 2) {
    p += f3.xyz * m;
  } else if (mv == 3) {
    vec3 cc = cell != 0.0 ? pc - org : v;
    vec3 dir = normalize(cc + vec3(1e-5)) * 0.9 + spCellHash3(cid) * 0.5 + vec3(0.0, f3.w, 0.0);
    p += dir * m * (0.7 + 0.6 * hc);
    if (spHash(splat.index * 41u + 9u) < 0.12) p += spHash3(splat.index * 43u + 1u) * m * 0.6;
  } else if (mv == 4) {
    p += f3.xyz * m * (0.75 + 0.5 * hc);
  } else if (mv == 5) {
    float h = spHash(splat.index * 47u + 5u);
    p += spHash3(splat.index * 53u + 7u) * sin(f7.x * f3.w + h * 6.2832) * m;
  } else if (mv == 6) {
    p = org + spRotate(p - org, f3.xyz, m);
    spPartQ = spQuatMul(vec4(f3.xyz * sin(m * 0.5), cos(m * 0.5)), spPartQ);
  } else if (mv == 7) {
    vec3 ax = f3.xyz;
    float along = dot(v, ax);
    float coord = f7.w > 0.5 ? along : length(v - ax * along);
    float band = floor(coord / max(f3.w, 1e-3));
    float sgn = mod(band, 2.0) < 0.5 ? 1.0 : -1.0;
    p = org + spRotate(p - org, ax, m * sgn);
  } else if (mv == 8) {
    float ang = m * dot(v, f4.xyz);
    p = org + spRotate(p - org, f3.xyz, ang);
  } else if (mv == 9) {
    vec3 ax = f3.xyz;
    float along = dot(v, ax);
    vec3 rad = v - ax * along;
    float rl = max(length(rad), 1e-4);
    vec3 rn = rad / rl;
    float lift = smoothstep(f3.w, f3.w + 0.25, along);
    vec3 piv = org + ax * f3.w + rn * rl;
    vec3 tg = normalize(cross(ax, rn));
    p = piv + spRotate(p - piv, tg, m * lift);
  } else if (mv == 10) {
    float n = max(f3.w, 1.0);
    float k = floor(spHash(splat.index * 61u + 7u) * n);
    vec3 ax = f3.xyz;
    vec3 b1 = normalize(cross(ax, abs(ax.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 dir = spRotate(b1, ax, (k + 0.25) * 6.2831853 / n);
    float s = 1.0 - (1.0 - pow(1.0 / n, 0.4)) * m;
    p = org + (p - org) * s + dir * f7.w * m;
    spKitScale *= mix(1.0, s, 0.7);
  } else if (mv == 11) {
    vec4 f9 = uSpFx[o + 9];
    if (hc <= f9.x) {
      float u = clamp(env, 0.0, 1.0);
      vec3 outd = normalize(pc - org + vec3(1e-4));
      vec3 disp = (outd * f3.w * u * (1.0 - 0.5 * u) + f3.xyz * u * u) * f1.x * sel;
      // Pieces land on the floor instead of falling through it.
      float floorY = uSpToy.y - uSpBodyF.x + 0.015 * uSpToy.w;
      float yc = pc.y + disp.y;
      if (yc < floorY) disp.y += floorY - yc;
      float ang = u * f9.y * (hc * 2.0 - 1.0) * 3.0;
      vec3 ax = normalize(spCellHash3(cid + 3.1) + vec3(1e-3));
      p = pc + disp + spRotate(p - pc, ax, ang);
      spPartQ = spQuatMul(vec4(ax * sin(ang * 0.5), cos(ang * 0.5)), spPartQ);
    }
  } else if (mv == 12) {
    vec4 f9 = uSpFx[o + 9];
    float sAlong = clamp(dot(v, f9.xyz) / max(f9.w, 1e-3), 0.0, 1.0);
    float h = spHash(splat.index * 67u + 1u);
    p += f3.xyz * m * sin(3.1415927 * sAlong) * sin(f7.x * f3.w + h * 6.2832);
  } else if (mv == 13) {
    vec4 f9 = uSpFx[o + 9];
    vec3 ax = f3.xyz;
    vec3 b1 = normalize(cross(ax, abs(ax.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 b2 = cross(ax, b1);
    float a = atan(dot(v, b2), dot(v, b1));
    vec3 rad = v - ax * dot(v, ax);
    float wv = f3.w * a - f1.z;
    p += normalize(rad + vec3(1e-5)) * m * sin(wv) + ax * m * f9.x * cos(wv);
  }
  float c = f1.y * abs(env) * sel;
  int cm = int(f1.w + 0.5);
  if (cm == 1) {
    spTint += f6.rgb * c;
  } else if (cm == 2) {
    if (c > spRecol.a) spRecol = vec4(f6.rgb, c);
    spRecolK = f6.w;
  } else if (cm == 3) {
    spBright *= 1.0 + c;
  } else if (cm == 4) {
    float h = spHash(splat.index * 59u + 3u);
    float on = step(1.0 - f6.w, h);
    spBright *= 1.0 + c * on * (0.6 + 0.4 * sin(f7.x * 23.0 + h * 60.0));
  } else if (cm == 5) {
    spFade *= 1.0 - clamp(c, 0.0, 1.0);
  } else if (cm == 6) {
    spBright *= 1.0 - clamp(c, 0.0, 0.9);
  }
  return p;
}

vec3 spRigCenter(vec3 p) {
  vec4 pk = loadSplatPart();
  int part = int(pk.x * 255.0 + 0.5);
  float w = pk.y;
  vec3 rest = p;
  if (part > 0 && part < 16 && w > 0.0) {
    vec4 q = uSpParts[part * 3];
    vec4 pv = uSpParts[part * 3 + 1];
    vec4 ofs = uSpParts[part * 3 + 2];
    if (q.w == 0.0 && dot(q.xyz, q.xyz) == 0.0) q = vec4(0.0, 0.0, 0.0, 1.0);
    vec3 moved = pv.xyz + spQuatRotate(q, (p - pv.xyz) * (1.0 + pv.w)) + ofs.xyz;
    p = mix(p, moved, w);
    spPartQ = normalize(mix(vec4(0.0, 0.0, 0.0, 1.0), q, w));
    spKitScale *= mix(1.0, ofs.w, w) * (1.0 + pv.w * w);
    vec4 tn = uSpRigTint[part];
    spTint += tn.rgb * w;
    spBright *= 1.0 + tn.a * w;
    if (uSpRigDbg.x > 0.0) {
      float h = float(part) * 2.39996;
      spTint += w * 0.6 * vec3(0.5 + 0.5 * cos(h), 0.5 + 0.5 * cos(h + 2.1), 0.5 + 0.5 * cos(h + 4.2));
    }
  }
  if (uSpRigDbg.x > 0.0) spTint += vec3(0.8, 0.0, 0.6) * pk.z + vec3(0.0, 0.7, 0.8) * pk.w;
  for (int i = 0; i < 4; i++) p = spRigFx(p, rest, pk, part, i * 10);
  return p;
}
`;

const WGSL_RIG_UNIFORMS = `uniform uSpParts: array<vec4f, 48>;
uniform uSpRigTint: array<vec4f, 16>;
uniform uSpFx: array<vec4f, 40>;
uniform uSpRigDbg: vec4f;`;

const WGSL_RIG_FUNCTIONS = `
fn spCellHash(c: vec3f) -> f32 {
  return fract(sin(dot(c, vec3f(12.9898, 78.233, 37.719))) * 43758.5453);
}

fn spCellHash3(c: vec3f) -> vec3f {
  return vec3f(spCellHash(c), spCellHash(c + vec3f(17.31)), spCellHash(c + vec3f(41.97))) * 2.0 - vec3f(1.0);
}

fn spRigFx(p0: vec3f, rest: vec3f, pk: vec4f, part: i32, o: i32) -> vec3f {
  var p = p0;
  let f0 = uniform.uSpFx[o];
  let f1 = uniform.uSpFx[o + 1];
  if (f0.x < 0.5 || (f1.x == 0.0 && f1.y == 0.0)) { return p; }
  let f2 = uniform.uSpFx[o + 2];
  let f3 = uniform.uSpFx[o + 3];
  let f4 = uniform.uSpFx[o + 4];
  let f5 = uniform.uSpFx[o + 5];
  let f6 = uniform.uSpFx[o + 6];
  let f7 = uniform.uSpFx[o + 7];
  let sm = i32(f0.x + 0.5);
  var sel = 1.0;
  if (sm == 2) { sel = pk.z; }
  else if (sm == 3) { sel = pk.w; }
  else if (sm == 4) { sel = 1.0 - pk.z; }
  else if (sm == 5) { sel = select(0.0, pk.y, part == i32(f7.z + 0.5)); }
  let org = f2.xyz;
  let v = rest - org;
  let mk = i32(f0.y + 0.5);
  if (mk == 1) {
    sel = sel * smoothstep(-0.015, 0.015, dot(v, f5.xyz) - f5.w);
  } else if (mk == 2) {
    let ax = f5.xyz;
    let b1 = normalize(cross(ax, select(vec3f(1.0, 0.0, 0.0), vec3f(0.0, 1.0, 0.0), abs(ax.y) < 0.9)));
    let b2 = cross(ax, b1);
    let a = atan2(dot(v, b2), dot(v, b1)) / 6.2831853 + 0.5;
    let st = fract(a * f5.w);
    sel = sel * smoothstep(0.02, 0.08, st) * (1.0 - smoothstep(0.42, 0.48, st));
  } else if (mk == 3) {
    sel = sel * (1.0 - smoothstep(0.8, 1.0, distance(rest, f5.xyz) / max(f5.w, 1e-3)));
  } else if (mk == 4) {
    let f8 = uniform.uSpFx[o + 8];
    let fl = v - f5.xyz * dot(v, f5.xyz);
    let ang = acos(clamp(dot(normalize(fl + vec3f(1e-5)), f8.xyz), -1.0, 1.0));
    sel = sel * (1.0 - smoothstep(f8.w - 0.03, f8.w, ang));
  }
  if (sel <= 0.001) { return p; }
  let cell = f7.y;
  var cid = vec3f(0.0);
  if (cell > 0.0) { cid = floor(rest / cell); }
  var pc = (cid + vec3f(0.5)) * cell;
  if (cell < 0.0) {
    let sz = -cell;
    let g = floor(rest / sz);
    var bd = 1e9;
    for (var z = -1; z <= 1; z++) {
      for (var y = -1; y <= 1; y++) {
        for (var x = -1; x <= 1; x++) {
          let c = g + vec3f(f32(x), f32(y), f32(z));
          let q = (c + vec3f(0.5) + 0.38 * spCellHash3(c)) * sz;
          let d = dot(rest - q, rest - q);
          if (d < bd) {
            bd = d;
            cid = c;
            pc = q;
          }
        }
      }
    }
  }
  var hc = spHash(splat.index * 37u + 3u);
  if (cell != 0.0) { hc = spCellHash(cid); }
  let pt = i32(f0.w + 0.5);
  let z = f1.z;
  var env = 1.0;
  if (pt == 1) {
    env = exp(-pow((length(v) - z) / max(f2.w, 1e-3), 2.0));
  } else if (pt == 2) {
    env = exp(-pow((dot(v, f4.xyz) - z) / max(f2.w, 1e-3), 2.0));
  } else if (pt == 3 || pt == 5) {
    let spread = f4.w;
    let local = clamp(z * (1.0 + spread) - spread * hc, 0.0, 1.0);
    env = select(local * local * (3.0 - 2.0 * local), sin(3.1415927 * local), pt == 3);
  } else if (pt == 4) {
    let ax = f4.xyz;
    let b1 = normalize(cross(ax, select(vec3f(1.0, 0.0, 0.0), vec3f(0.0, 1.0, 0.0), abs(ax.y) < 0.9)));
    let b2 = cross(ax, b1);
    let a = atan2(dot(v, b2), dot(v, b1)) / 6.2831853 + 0.5;
    let u = (a + f4.w * clamp(dot(v, ax) / uniform.uSpToy.w * 0.5 + 0.5, 0.0, 1.0)) / (1.0 + f4.w);
    env = 1.0 - smoothstep(z - f2.w, z, u);
  } else if (pt == 6) {
    env = sin(f4.w * dot(v, f4.xyz) - z);
  }
  let m = f1.x * env * sel;
  let mv = i32(f0.z + 0.5);
  if (mv == 1) {
    p = p + normalize(v + vec3f(1e-5)) * m;
  } else if (mv == 2) {
    p = p + f3.xyz * m;
  } else if (mv == 3) {
    var cc = v;
    if (cell != 0.0) { cc = pc - org; }
    let dir = normalize(cc + vec3f(1e-5)) * 0.9 + spCellHash3(cid) * 0.5 + vec3f(0.0, f3.w, 0.0);
    p = p + dir * m * (0.7 + 0.6 * hc);
    if (spHash(splat.index * 41u + 9u) < 0.12) { p = p + spHash3(splat.index * 43u + 1u) * m * 0.6; }
  } else if (mv == 4) {
    p = p + f3.xyz * m * (0.75 + 0.5 * hc);
  } else if (mv == 5) {
    let h = spHash(splat.index * 47u + 5u);
    p = p + spHash3(splat.index * 53u + 7u) * sin(f7.x * f3.w + h * 6.2832) * m;
  } else if (mv == 6) {
    p = org + spRotate(p - org, f3.xyz, m);
    spPartQ = spQuatMul(vec4f(f3.xyz * sin(m * 0.5), cos(m * 0.5)), spPartQ);
  } else if (mv == 7) {
    let ax = f3.xyz;
    let along = dot(v, ax);
    let coord = select(length(v - ax * along), along, f7.w > 0.5);
    let band = floor(coord / max(f3.w, 1e-3));
    let sgn = select(-1.0, 1.0, band - 2.0 * floor(band / 2.0) < 0.5);
    p = org + spRotate(p - org, ax, m * sgn);
  } else if (mv == 8) {
    let ang = m * dot(v, f4.xyz);
    p = org + spRotate(p - org, f3.xyz, ang);
  } else if (mv == 9) {
    let ax = f3.xyz;
    let along = dot(v, ax);
    let rad = v - ax * along;
    let rl = max(length(rad), 1e-4);
    let rn = rad / rl;
    let lift = smoothstep(f3.w, f3.w + 0.25, along);
    let piv = org + ax * f3.w + rn * rl;
    let tg = normalize(cross(ax, rn));
    p = piv + spRotate(p - piv, tg, m * lift);
  } else if (mv == 10) {
    let n = max(f3.w, 1.0);
    let k = floor(spHash(splat.index * 61u + 7u) * n);
    let ax = f3.xyz;
    let b1 = normalize(cross(ax, select(vec3f(1.0, 0.0, 0.0), vec3f(0.0, 1.0, 0.0), abs(ax.y) < 0.9)));
    let dir = spRotate(b1, ax, (k + 0.25) * 6.2831853 / n);
    let s = 1.0 - (1.0 - pow(1.0 / n, 0.4)) * m;
    p = org + (p - org) * s + dir * f7.w * m;
    spKitScale = spKitScale * mix(1.0, s, 0.7);
  } else if (mv == 11) {
    let f9 = uniform.uSpFx[o + 9];
    if (hc <= f9.x) {
      let u = clamp(env, 0.0, 1.0);
      let outd = normalize(pc - org + vec3f(1e-4));
      var disp = (outd * f3.w * u * (1.0 - 0.5 * u) + f3.xyz * u * u) * f1.x * sel;
      let floorY = uniform.uSpToy.y - uniform.uSpBodyF.x + 0.015 * uniform.uSpToy.w;
      let yc = pc.y + disp.y;
      if (yc < floorY) { disp.y = disp.y + floorY - yc; }
      let ang = u * f9.y * (hc * 2.0 - 1.0) * 3.0;
      let ax = normalize(spCellHash3(cid + vec3f(3.1)) + vec3f(1e-3));
      p = pc + disp + spRotate(p - pc, ax, ang);
      spPartQ = spQuatMul(vec4f(ax * sin(ang * 0.5), cos(ang * 0.5)), spPartQ);
    }
  } else if (mv == 12) {
    let f9 = uniform.uSpFx[o + 9];
    let sAlong = clamp(dot(v, f9.xyz) / max(f9.w, 1e-3), 0.0, 1.0);
    let h = spHash(splat.index * 67u + 1u);
    p = p + f3.xyz * m * sin(3.1415927 * sAlong) * sin(f7.x * f3.w + h * 6.2832);
  } else if (mv == 13) {
    let f9 = uniform.uSpFx[o + 9];
    let ax = f3.xyz;
    let b1 = normalize(cross(ax, select(vec3f(1.0, 0.0, 0.0), vec3f(0.0, 1.0, 0.0), abs(ax.y) < 0.9)));
    let b2 = cross(ax, b1);
    let a = atan2(dot(v, b2), dot(v, b1));
    let rad = v - ax * dot(v, ax);
    let wv = f3.w * a - f1.z;
    p = p + normalize(rad + vec3f(1e-5)) * m * sin(wv) + ax * m * f9.x * cos(wv);
  }
  let c = f1.y * abs(env) * sel;
  let cm = i32(f1.w + 0.5);
  if (cm == 1) {
    spTint = spTint + f6.rgb * c;
  } else if (cm == 2) {
    if (c > spRecol.a) { spRecol = vec4f(f6.rgb, c); }
    spRecolK = f6.w;
  } else if (cm == 3) {
    spBright = spBright * (1.0 + c);
  } else if (cm == 4) {
    let h = spHash(splat.index * 59u + 3u);
    let on = step(1.0 - f6.w, h);
    spBright = spBright * (1.0 + c * on * (0.6 + 0.4 * sin(f7.x * 23.0 + h * 60.0)));
  } else if (cm == 5) {
    spFade = spFade * (1.0 - clamp(c, 0.0, 1.0));
  } else if (cm == 6) {
    spBright = spBright * (1.0 - clamp(c, 0.0, 0.9));
  }
  return p;
}

fn spRigCenter(p0: vec3f) -> vec3f {
  var p = p0;
  let pk = loadSplatPart();
  let part = i32(pk.x * 255.0 + 0.5);
  let w = pk.y;
  let rest = p0;
  if (part > 0 && part < 16 && w > 0.0) {
    var q = uniform.uSpParts[part * 3];
    let pv = uniform.uSpParts[part * 3 + 1];
    let ofs = uniform.uSpParts[part * 3 + 2];
    if (q.w == 0.0 && dot(q.xyz, q.xyz) == 0.0) { q = vec4f(0.0, 0.0, 0.0, 1.0); }
    let moved = pv.xyz + spQuatRotate(q, (p - pv.xyz) * (1.0 + pv.w)) + ofs.xyz;
    p = mix(p, moved, w);
    spPartQ = normalize(mix(vec4f(0.0, 0.0, 0.0, 1.0), q, w));
    spKitScale = spKitScale * mix(1.0, ofs.w, w) * (1.0 + pv.w * w);
    let tn = uniform.uSpRigTint[part];
    spTint = spTint + tn.rgb * w;
    spBright = spBright * (1.0 + tn.a * w);
    if (uniform.uSpRigDbg.x > 0.0) {
      let h = f32(part) * 2.39996;
      spTint = spTint + w * 0.6 * vec3f(0.5 + 0.5 * cos(h), 0.5 + 0.5 * cos(h + 2.1), 0.5 + 0.5 * cos(h + 4.2));
    }
  }
  if (uniform.uSpRigDbg.x > 0.0) { spTint = spTint + vec3f(0.8, 0.0, 0.6) * pk.z + vec3f(0.0, 0.7, 0.8) * pk.w; }
  for (var i = 0; i < 4; i++) { p = spRigFx(p, rest, pk, part, i * 10); }
  return p;
}
`;

// mode: "plain" (captured and file toys), "kit" (generated toys) or "rig"
// (captured toys with a rig).
function variant(code, mode, lang) {
  const glsl = lang === "glsl";
  const pick = (kit, rig) => (mode === "kit" ? kit : mode === "rig" ? rig : "");
  return code
    .replace(
      "__KIT_UNIFORMS__",
      pick(glsl ? GLSL_KIT_UNIFORMS : WGSL_KIT_UNIFORMS, glsl ? GLSL_RIG_UNIFORMS : WGSL_RIG_UNIFORMS), // prettier-ignore
    )
    .replace(
      "__KIT_FUNCTIONS__",
      pick(glsl ? GLSL_KIT_FUNCTIONS : WGSL_KIT_FUNCTIONS, glsl ? GLSL_RIG_FUNCTIONS : WGSL_RIG_FUNCTIONS), // prettier-ignore
    )
    .replace(
      "__KIT_COLOR__",
      mode === "kit"
        ? glsl
          ? "if (spScreenUV.z > 0.5) color.rgb = textureLod(uSpScreen, spScreenUV.xy, 0.0).rgb;"
          : "if (spScreenUV.z > 0.5) { base = textureSampleLevel(uSpScreen, uSpScreenSampler, spScreenUV.xy, 0.0).rgb; }"
        : "",
    )
    .replace(
      "__KIT_CENTER__",
      pick(
        glsl ? "center = spKitCenter(center);" : "*center = spKitCenter(*center);",
        glsl ? "center = spRigCenter(center);" : "*center = spRigCenter(*center);",
      ),
    );
}

// Captured and file toys.
export const MODIFIER = { glsl: variant(GLSL, "plain", "glsl"), wgsl: variant(WGSL, "plain", "wgsl") }; // prettier-ignore
// Generated toys (they carry the splatAnim stream).
export const MODIFIER_KIT = {
  glsl: variant(GLSL, "kit", "glsl"),
  wgsl: variant(WGSL, "kit", "wgsl"),
};
// Captured toys with a rig (they carry the splatPart stream).
export const MODIFIER_RIG = {
  glsl: variant(GLSL, "rig", "glsl"),
  wgsl: variant(WGSL, "rig", "wgsl"),
};

// ---- CPU driver -------------------------------------------------------------

const AXIS_VEC = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
const smooth = (t) => t * t * (3 - 2 * t);

// Dissolve cycle: 0 -> 1 (apart) -> hold -> 0 (home) -> hold, looping.
export function dissolveProgress(t, speed) {
  const period = 7 - 4.5 * speed;
  const f = (((t / period) % 1) + 1) % 1;
  if (f < 0.35) return smooth(f / 0.35);
  if (f < 0.5) return 1;
  if (f < 0.85) return 1 - smooth((f - 0.5) / 0.35);
  return 0;
}

// Turns scene settings, the clock and pointer state into uniforms.
export class EffectDriver {
  constructor() {
    this.pokes = [
      [0, 0, 0, -100],
      [0, 0, 0, -100],
      [0, 0, 0, -100],
      [0, 0, 0, -100],
    ];
    this.pokeSlot = 0;
    this.magnet = { point: [0, 0, 0], target: [0, 0, 0], intensity: 0, held: false };
    this.grab = { on: false, held: false, anchor: [0, 0, 0], radius: 1, pull: [0, 0, 0], goal: [0, 0, 0], from: [0, 0, 0], releaseAt: 0 }; // prettier-ignore
    this.dissolve = { start: 0, releaseFrom: 0, releaseAt: -1, wasOn: false };
    this.drop = { on: false, start: 0, gravity: [0, -1, 0], recallAt: -1, floor: 1 };
  }

  addPoke(point, time) {
    this.pokes[this.pokeSlot] = [point[0], point[1], point[2], time];
    this.pokeSlot = (this.pokeSlot + 1) % 4;
  }

  clearPokes() {
    for (const p of this.pokes) p[3] = -100;
  }

  // True while anything is still moving without user input.
  isAnimating(effects, time) {
    if (effects.wind.on || effects.dissolve.on || effects.slice.on) return true;
    if (effects.twist.on && effects.twist.wobble > 0) return true;
    if (this.pokes.some((p) => time - p[3] < 6)) return true;
    if (this.magnet.held || this.magnet.intensity > 0.001) return true;
    if (this.grab.on) return true;
    if (this.dissolve.releaseAt >= 0 && time - this.dissolve.releaseAt < 1.2) return true;
    if (this.drop.on && time - this.drop.start < 8) return true;
    if (this.drop.recallAt >= 0 && time - this.drop.recallAt < 1.2) return true;
    return false;
  }

  // Grab: `anchor` is the grabbed point (world), `radius` how much of the
  // toy follows it. grabTo() sets the pull (a world vector); grabEnd()
  // lets go, and the toy springs back with a few wobbles.
  grabStart(anchor, radius) {
    this.grab = { ...this.grab, on: true, held: true, anchor: anchor.slice(), radius, pull: [0, 0, 0], goal: [0, 0, 0] }; // prettier-ignore
  }

  grabTo(pull) {
    if (this.grab.held) this.grab.goal = pull.slice();
  }

  grabEnd(time) {
    const g = this.grab;
    if (!g.held) return 0;
    g.held = false;
    g.releaseAt = time;
    g.from = g.pull.slice();
    return Math.hypot(...g.from) / g.radius;
  }

  startDrop(time, gravity, floor) {
    this.drop = { on: true, start: time, gravity, recallAt: -1, floor };
  }

  recallDrop(time) {
    if (this.drop.on && this.drop.recallAt < 0) this.drop.recallAt = time;
  }

  // Computes all uniforms for this frame. ctx: { time, dt, effects, look,
  // seed, toy: { center, radius, extentAlong(dir) }, camera: { right, up,
  // forward } } where directions are world-space unit vectors.
  compute(ctx) {
    const { time, dt, effects: fx, look, seed, toy, camera } = ctx;
    const R = toy.radius;
    const c = toy.center;
    const u = {};
    u.uSpClock = [time, look.splatScale, look.exposure, seed % 16777216];
    u.uSpToy = [c[0], c[1], c[2], R];

    // Poke.
    u.uSpPoke0 = this.pokes[0];
    u.uSpPoke1 = this.pokes[1];
    u.uSpPoke2 = this.pokes[2];
    u.uSpPoke3 = this.pokes[3];
    u.uSpPokeP = [0.4 + 2.2 * fx.poke.strength, fx.poke.wobble, 0, 0];

    // Wind: the direction slider is screen-relative (0 = towards the right
    // edge, 90 = away from the viewer), flattened onto the ground plane.
    const up = [0, 1, 0];
    if (fx.wind.on && fx.wind.strength > 0) {
      const a = (fx.wind.direction * Math.PI) / 180;
      const r = flatten(camera.right, up);
      const f = flatten(camera.forward, up);
      const d = normalize([
        r[0] * Math.cos(a) + f[0] * Math.sin(a),
        r[1] * Math.cos(a) + f[1] * Math.sin(a),
        r[2] * Math.cos(a) + f[2] * Math.sin(a),
      ]);
      u.uSpWind = [d[0], d[1], d[2], fx.wind.strength * 1.4];
    } else {
      u.uSpWind = [1, 0, 0, 0];
    }
    u.uSpWindP = [0.6 + 0.8 * fx.wind.strength, up[0], up[1], up[2]];

    // Dissolve: loops while on; when switched off it eases home.
    const ds = this.dissolve;
    let dProgress = 0;
    if (fx.dissolve.on) {
      if (!ds.wasOn) ds.start = time;
      ds.wasOn = true;
      ds.releaseAt = -1;
      dProgress = dissolveProgress(time - ds.start, fx.dissolve.speed);
      ds.last = dProgress;
    } else if (ds.wasOn) {
      ds.wasOn = false;
      ds.releaseAt = time;
      ds.releaseFrom = ds.last || 0;
    }
    if (!fx.dissolve.on && ds.releaseAt >= 0) {
      const k = clamp((time - ds.releaseAt) / 1.1, 0, 1);
      dProgress = ds.releaseFrom * (1 - smooth(k));
      if (k >= 1) ds.releaseAt = -1;
    }
    const dissolveActive = fx.dissolve.on || ds.releaseAt >= 0;
    u.uSpDiss = [dProgress, 0.1 + 0.55 * fx.dissolve.spread, 0.8, dissolveActive ? 1 : 0];

    // Drop: gravity and floor were captured when it started.
    const dr = this.drop;
    let recall = 0;
    let dropActive = false;
    if (dr.on) {
      dropActive = true;
      let since = time - dr.start;
      if (dr.recallAt >= 0) {
        since = dr.recallAt - dr.start;
        recall = clamp((time - dr.recallAt) / 1.1, 0, 1);
        if (recall >= 1) {
          dr.on = false;
          dropActive = false;
          dr.recallAt = -1;
        }
      }
      u.uSpDrop = [dr.gravity[0], dr.gravity[1], dr.gravity[2], Math.max(0, since)];
    } else {
      u.uSpDrop = [0, -1, 0, 0];
    }
    u.uSpDropP = [dr.floor, recall, dropActive ? 1 : 0, 0.15 + 0.55 * fx.drop.bounce];
    u.uSpDropQ = [fx.drop.scatter, 0, 0, 0];

    // Magnet: follow the pointer smoothly, fade in while held.
    const m = this.magnet;
    const follow = 1 - Math.exp(-dt / 0.06);
    for (let i = 0; i < 3; i++) m.point[i] += (m.target[i] - m.point[i]) * follow;
    const goal = m.held ? 1 : 0;
    const rate = m.held ? 0.18 : 0.45;
    m.intensity += (goal - m.intensity) * (1 - Math.exp(-dt / rate));
    if (!m.held && m.intensity < 0.001) m.intensity = 0;
    u.uSpMag = [m.point[0], m.point[1], m.point[2], m.intensity];
    u.uSpMagP = [fx.magnet.strength, (0.15 + 0.85 * fx.magnet.radius) * R, 0, 0];

    // Grab: the pull follows the pointer closely while held; after release
    // it swings back through the rest pose and settles.
    const gr = this.grab;
    if (gr.on && gr.held) {
      const k = 1 - Math.exp(-dt / 0.05);
      for (let i = 0; i < 3; i++) gr.pull[i] += (gr.goal[i] - gr.pull[i]) * k;
    } else if (gr.on) {
      const s = Math.max(0, time - gr.releaseAt);
      const f = Math.exp(-s * 4.5) * Math.cos(s * 19);
      for (let i = 0; i < 3; i++) gr.pull[i] = gr.from[i] * f;
      if (s > 1.6) gr.on = false;
    }
    u.uSpGrab = [gr.anchor[0], gr.anchor[1], gr.anchor[2], gr.radius];
    u.uSpGrabD = [gr.pull[0], gr.pull[1], gr.pull[2], gr.on ? 1 : 0];

    // Twist.
    if (fx.twist.on && fx.twist.amount !== 0) {
      const ax = AXIS_VEC[fx.twist.axis] || AXIS_VEC.y;
      let ang = fx.twist.amount * Math.PI;
      if (fx.twist.wobble > 0) ang *= Math.sin(time * (0.4 + 2.6 * fx.twist.wobble));
      u.uSpTwist = [ax[0], ax[1], ax[2], ang];
    } else {
      u.uSpTwist = [0, 1, 0, 0];
    }

    // Slice: offset in world units from the toy centre along the axis.
    if (fx.slice.on) {
      const n = AXIS_VEC[fx.slice.axis] || AXIS_VEC.x;
      const extent = toy.extentAlong(n);
      let pos = fx.slice.position;
      if (fx.slice.sweep > 0) pos += Math.sin(time * (0.25 + 1.8 * fx.slice.sweep)) * 0.95;
      u.uSpSlice = [n[0], n[1], n[2], clamp(pos, -1.1, 1.1) * extent];
      u.uSpSliceP = [1, 0.035 * R, 0, 0];
    } else {
      u.uSpSlice = [1, 0, 0, 1e6];
      u.uSpSliceP = [0, 0.035 * R, 0, 0];
    }
    const acc = hexToRgb(look.accent);
    u.uSpAccent = [acc[0], acc[1], acc[2], 1];
    return u;
  }
}

function flatten(v, up) {
  const d = v[0] * up[0] + v[1] * up[1] + v[2] * up[2];
  const out = [v[0] - up[0] * d, v[1] - up[1] * d, v[2] - up[2] * d];
  const len = Math.hypot(out[0], out[1], out[2]);
  return len < 1e-5 ? [1, 0, 0] : [out[0] / len, out[1] / len, out[2] / len];
}

function normalize(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

export function hexToRgb(hex) {
  const h = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!h) return [0.043, 0.31, 0.612];
  const n = parseInt(h[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

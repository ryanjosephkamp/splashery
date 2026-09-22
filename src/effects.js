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
uniform vec4 uSpTwist;   // xyz axis (unit), w angle across the toy (radians)
uniform vec4 uSpSlice;   // xyz plane normal, w offset (world)
uniform vec4 uSpSliceP;  // x on, y glow width (world)
uniform vec4 uSpAccent;  // rgb accent colour

vec3 spHome = vec3(0.0);
float spCut = 0.0;
float spShrink = 0.0;
float spLanded = 0.0;
float spShade = 0.0;
float spGlow = 0.0;
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
  rotation = spQuatMul(spTwistQ, rotation);
  scale *= uSpClock.y * (1.0 - 0.45 * spShrink) * (1.0 + 0.3 * spLanded);
  if (spCut > 0.5) scale = vec3(0.0);
}

void modifySplatColor(vec3 center, inout vec4 color) {
  vec4 paint = loadPaintColor();
  color.rgb = color.rgb * (1.0 - paint.a) + paint.rgb;
  if (uSpSliceP.x > 0.5) {
    float side = dot(center - uSpToy.xyz, uSpSlice.xyz) - uSpSlice.w;
    float glow = side > 0.0 ? 0.0 : 1.0 - smoothstep(0.0, uSpSliceP.y, -side);
    color.rgb = mix(color.rgb, uSpAccent.rgb, glow * 0.85);
    if (side > 0.0) color.a = 0.0;
  }
  color.rgb = mix(color.rgb, uSpAccent.rgb, clamp(spGlow, 0.0, 1.0) * 0.35);
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
uniform uSpTwist: vec4f;
uniform uSpSlice: vec4f;
uniform uSpSliceP: vec4f;
uniform uSpAccent: vec4f;

var<private> spCut: f32 = 0.0;
var<private> spShrink: f32 = 0.0;
var<private> spLanded: f32 = 0.0;
var<private> spShade: f32 = 0.0;
var<private> spGlow: f32 = 0.0;
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
  *rotation = spQuatMul(spTwistQ, *rotation);
  *scale = *scale * (uniform.uSpClock.y * (1.0 - 0.45 * spShrink) * (1.0 + 0.3 * spLanded));
  if (spCut > 0.5) { *scale = vec3f(0.0); }
}

fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
  let paint = loadPaintColor();
  var rgb = (*color).rgb * (1.0 - paint.a) + paint.rgb;
  var a = (*color).a;
  if (uniform.uSpSliceP.x > 0.5) {
    let side = dot(center - uniform.uSpToy.xyz, uniform.uSpSlice.xyz) - uniform.uSpSlice.w;
    let glow = select(1.0 - smoothstep(0.0, uniform.uSpSliceP.y, -side), 0.0, side > 0.0);
    rgb = mix(rgb, uniform.uSpAccent.rgb, glow * 0.85);
    if (side > 0.0) { a = 0.0; }
  }
  rgb = mix(rgb, uniform.uSpAccent.rgb, clamp(spGlow, 0.0, 1.0) * 0.35);
  *color = vec4f(rgb * uniform.uSpClock.z * (1.0 + clamp(spShade, -0.6, 0.6)), a);
}
`;

export const MODIFIER = { glsl: GLSL, wgsl: WGSL };

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
    if (this.dissolve.releaseAt >= 0 && time - this.dissolve.releaseAt < 1.2) return true;
    if (this.drop.on && time - this.drop.start < 8) return true;
    if (this.drop.recallAt >= 0 && time - this.drop.recallAt < 1.2) return true;
    return false;
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

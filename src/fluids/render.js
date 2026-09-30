// Lane Fluids: fluids drawn as splats (docs/FLUIDS.md). One extra splat
// layer per toy (stage.addLayer), one splat per particle. The CPU writes
// three small float textures a frame (place, velocity and kind, normal and
// material, see FluidWorld.pack); the layer's own work-buffer program
// shapes, turns and lights each splat from them:
//
//   liquid  an ellipsoid shaped by its neighbors (Yu and Turk 2013): flat
//           along a surface, long along a stream or a sheet, round in a
//           lone drop (stretched by its speed); lit
//           with a soft key light, a bright rim toward the light and the
//           view's edge, and a highlight; full opacity, clean color.
//           Lava glows by its heat and darkens where it cools.
//   foam, bubbles and spray: small, flat and pale; tiny and bright; small
//           drops of the liquid.
//   smoke and steam: soft, growing and fading with age.
//   flame   emissive, through the flame's color ramp by age (a blue base,
//           yellow-white, orange, a dull red), narrowing toward the tip.
//   spark   tiny bright streaks.
//   vessel  glass: clear face-on, bright toward its edges (Fresnel).
//   sheet   a calm thin liquid's level top in a glass, faded in once calm.

import * as pc from "../pc.js";

const MAX_MATS = 8;

const GLSL = /* glsl */ `
uniform vec4 uSpClock;   // y splat scale, z exposure
uniform vec4 uSpCam;     // xyz camera (toy coordinates)
uniform vec4 uSpToy;     // xyz toy center
uniform vec4 uSpBodyQ;   // whole-toy turn
uniform vec4 uSpBodyT;   // xyz whole-toy offset
uniform vec4 uFlMat[${MAX_MATS * 2}];
uniform vec4 uFlLight;   // xyz toward the light
vec4 flAn = vec4(0.0);
vec4 flQ = vec4(0.0, 0.0, 0.0, 1.0);
vec3 flR = vec3(1.0);
float flSub = 0.0;
float flExt = 1.0;
float flKind = 0.0;
float flF = 0.0;
vec3 flN = vec3(0.0, 1.0, 0.0);
float flSurf = 0.0;
vec3 flV = vec3(0.0);
int flMat = 0;
float flTone = 0.0;

vec3 flRot(vec4 q, vec3 v) {
  vec3 t = 2.0 * cross(q.xyz, v);
  return v + q.w * t + cross(q.xyz, t);
}
// A quaternion (x, y, z, w) from three orthonormal axes (the columns).
vec4 flQuat(vec3 a, vec3 b, vec3 c) {
  float tr = a.x + b.y + c.z;
  vec4 q;
  if (tr > 0.0) {
    float s = sqrt(tr + 1.0) * 2.0;
    q = vec4((b.z - c.y) / s, (c.x - a.z) / s, (a.y - b.x) / s, 0.25 * s);
  } else if (a.x > b.y && a.x > c.z) {
    float s = sqrt(1.0 + a.x - b.y - c.z) * 2.0;
    q = vec4(0.25 * s, (b.x + a.y) / s, (c.x + a.z) / s, (b.z - c.y) / s);
  } else if (b.y > c.z) {
    float s = sqrt(1.0 + b.y - a.x - c.z) * 2.0;
    q = vec4((b.x + a.y) / s, 0.25 * s, (c.y + b.z) / s, (c.x - a.z) / s);
  } else {
    float s = sqrt(1.0 + c.z - a.x - b.y) * 2.0;
    q = vec4((c.x + a.z) / s, (c.y + b.z) / s, 0.25 * s, (a.y - b.x) / s);
  }
  return normalize(q);
}
vec3 flAny(vec3 n) {
  return normalize(cross(n, abs(n.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
}
vec3 flRamp(float f) {
  vec3 blue = vec3(0.25, 0.42, 1.0);
  vec3 white = vec3(1.0, 0.93, 0.62);
  vec3 yellow = vec3(1.0, 0.72, 0.2);
  vec3 orange = vec3(1.0, 0.42, 0.07);
  vec3 red = vec3(0.55, 0.11, 0.03);
  if (f < 0.14) return mix(blue, white, smoothstep(0.02, 0.14, f));
  if (f < 0.35) return mix(white, yellow, (f - 0.14) / 0.21);
  if (f < 0.65) return mix(yellow, orange, (f - 0.35) / 0.3);
  return mix(orange, red, (f - 0.65) / 0.35);
}

void modifySplatCenter(inout vec3 center) {
  flAn = loadSplatAnim();
  vec4 sh = loadFluidShape();
  vec4 sz = loadFluidSize();
  flKind = floor(flAn.w + 1e-4);
  flF = clamp((flAn.w - flKind) / 0.999, 0.0, 1.0);
  flMat = int(floor(sz.w + 1e-4));
  float fr = (sz.w - float(flMat)) * 16.0;
  float sq = floor(fr + 1e-3);
  flSurf = sq / 15.0;
  flTone = clamp((fr - sq) * 16.0 / 15.0, 0.0, 1.0);
  vec4 q = uSpBodyQ;
  flQ = normalize(vec4(q.w * sh.xyz + sh.w * q.xyz + cross(q.xyz, sh.xyz), q.w * sh.w - dot(q.xyz, sh.xyz)));
  flR = sz.xyz;
  flN = flRot(flQ, vec3(0.0, 0.0, 1.0));
  flV = flRot(q, flAn.xyz);
  center = uSpToy.xyz + flRot(q, center - uSpToy.xyz) + uSpBodyT.xyz;
  if (flKind > 0.5 && flKind < 1.5) {
    // A liquid particle is four splats: which one this is, and how alone
    // the particle is.
    float fr = flAn.w - flKind;
    flSub = floor(fr * 4.0 + 1e-3);
    flF = clamp((fr - 0.25 * flSub) / 0.2, 0.0, 1.0);
    vec4 m1 = uFlMat[flMat * 2 + 1];
    float base = m1.x * uSpClock.y;
    flExt = 1.0 + min(length(flV) * m1.z / max(m1.x, 1e-5), 4.0);
    vec3 off;
    if (flR.x < 0.0) {
      // A stream: four thin splats across its width, each the full length.
      off = vec3(0.0, (flSub - 1.5) * 0.3 * base, 0.0);
    } else {
      // A disc or an ellipsoid: a two-by-two spread across its broad side.
      vec2 g = vec2(mod(flSub, 2.0) - 0.5, floor(flSub * 0.5) - 0.5);
      off = vec3(g.x * 0.9 * flR.x, g.y * 0.9 * flR.y, 0.0) * base;
    }
    center += flRot(flQ, off);
  }
}

void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {
  vec4 m1 = uFlMat[flMat * 2 + 1];
  float base = m1.x * uSpClock.y;
  float speed = length(flV);
  vec3 vd = speed > 1e-5 ? flV / speed : vec3(0.0, 1.0, 0.0);
  float ext = 1.0 + min(speed * m1.z / max(m1.x, 1e-5), 4.0);
  vec3 a = vd;
  vec3 b = flAny(a);
  vec3 c = cross(a, b);
  vec3 s = vec3(0.0);
  if (flKind < 0.5) {
    s = vec3(0.0);
  } else if (flKind < 1.5) {
    // Liquid, one of a particle's four splats: along the flow in a stream,
    // a quarter of its disc or ellipsoid elsewhere; a lone drop is round
    // (one splat, stretched by its speed).
    rotation = flQ;
    if (flR.x < 0.0) {
      scale = base * vec3(0.8 * flExt, 0.42, 0.5);
    } else if (flF > 0.75) {
      scale = flSub < 0.5 ? base * 0.85 * vec3(1.0) : vec3(0.0);
      rotation = flQuat(a, b, c);
      scale.x *= min(flExt, 2.2);
    } else {
      scale = base * vec3(0.62 * flR.x, 0.62 * flR.y, 0.8 * flR.z);
    }
    return;
  } else if (flKind < 2.5) {
    // Foam: a small flat fleck riding the surface.
    c = vec3(0.0, 1.0, 0.0);
    a = flAny(c);
    b = cross(c, a);
    s = base * (0.26 - 0.08 * flF) * vec3(1.3, 1.3, 0.4);
  } else if (flKind < 3.5) {
    s = base * vec3(0.13);
  } else if (flKind < 4.5) {
    s = base * 0.45 * vec3(min(ext, 2.2), 1.0, 1.0);
  } else if (flKind < 6.5) {
    // Smoke and steam grow as they rise.
    float g = 0.55 + 2.4 * pow(flF, 0.6);
    s = base * g * vec3(1.0 + 0.25 * min(ext - 1.0, 1.0), 1.0, 1.0);
  } else if (flKind < 7.5) {
    float g = mix(1.0, 0.35, flF);
    s = base * g * vec3(min(ext, 2.2), 0.85, 0.85);
  } else if (flKind < 8.5) {
    s = base * vec3(0.16 * min(ext, 4.0), 0.12, 0.12);
  } else {
    rotation = flQ;
    scale = base * flR;
    return;
  }
  rotation = flQuat(a, b, c);
  scale = s;
}

void modifySplatColor(vec3 center, inout vec4 color) {
  vec4 m0 = uFlMat[flMat * 2];
  vec4 m1 = uFlMat[flMat * 2 + 1];
  vec3 base = m0.rgb;
  vec3 L = normalize(uFlLight.xyz);
  vec3 V = normalize(uSpCam.xyz - center);
  vec3 rgb = base;
  float alpha = m0.a;
  if (flKind < 0.5) {
    alpha = 0.0;
  } else if (flKind < 1.5) {
    // Glassy: an even body color, a bright rim where the surface turns
    // away (Fresnel), a highlight, full opacity. The bulk faces the view.
    vec3 n = flSurf > 0.3 ? flN : V;
    float nv = abs(dot(n, V));
    float fres = pow(1.0 - nv, 2.5);
    float lit = 0.9 + 0.1 * max(dot(n, L), 0.0);
    float spec = pow(max(dot(reflect(-L, n), V), 0.0), 60.0);
    rgb = base * lit;
    // Dark liquids (cola) keep their color at the rim; the highlight stays.
    float lum = dot(base, vec3(0.3, 0.59, 0.11));
    rgb = mix(rgb, vec3(1.0), 0.5 * fres * (0.25 + 0.75 * lum));
    rgb += vec3(0.5 * spec);
    alpha = 1.0;
    if (m1.y > 0.0) {
      // Lava: its own light by its heat, a dark crust where it cooled.
      vec3 hot = mix(vec3(1.0, 0.32, 0.04), vec3(1.0, 0.78, 0.25), smoothstep(0.75, 1.0, flTone));
      vec3 crust = vec3(0.16, 0.05, 0.03) * lit + vec3(spec * 0.25);
      rgb = mix(crust, hot * 1.25, smoothstep(0.3, 0.85, flTone) * m1.y);
    }
  } else if (flKind < 2.5) {
    float lit = 0.86 + 0.14 * max(dot(vec3(0.0, 1.0, 0.0), L), 0.0);
    rgb = mix(vec3(0.96, 0.93, 0.86), base, 0.1) * lit;
    alpha = 0.85 * pow(1.0 - flF, 0.5);
  } else if (flKind < 3.5) {
    rgb = mix(base, vec3(1.0), 0.72);
    alpha = 0.85;
  } else if (flKind < 4.5) {
    rgb = mix(base, vec3(1.0), 0.25);
    alpha = 0.95 * (1.0 - flF * flF);
  } else if (flKind < 5.5) {
    rgb = base * (0.9 + 0.2 * flTone);
    alpha = m0.a * smoothstep(0.0, 0.08, flF) * pow(1.0 - flF, 1.4);
  } else if (flKind < 6.5) {
    rgb = base;
    alpha = m0.a * smoothstep(0.0, 0.12, flF) * pow(1.0 - flF, 1.8);
  } else if (flKind < 7.5) {
    rgb = flRamp(flF) * (1.45 - 0.6 * flF);
    alpha = mix(0.6, 0.9, smoothstep(0.06, 0.16, flF)) * pow(1.0 - flF, 1.2);
  } else if (flKind < 8.5) {
    rgb = vec3(1.0, 0.72, 0.3) * 1.6;
    alpha = 1.0 - flF;
  } else if (flKind > 9.5) {
    // A calm liquid's level sheet: the liquid's color, lit from its normal,
    // a soft sheen toward grazing views, faded in by calmness (f).
    vec3 n = flN;
    float fres = pow(1.0 - abs(dot(n, V)), 3.0);
    float spec = pow(max(dot(reflect(-L, n), V), 0.0), 60.0);
    rgb = base * (0.94 + 0.06 * max(dot(n, L), 0.0));
    rgb = mix(rgb, vec3(1.0), 0.3 * fres) + vec3(0.45 * spec);
    // A foam head (tone): fine and pale.
    rgb = mix(rgb, vec3(0.93, 0.88, 0.78) * (0.92 + 0.08 * max(dot(n, L), 0.0)), smoothstep(0.05, 0.6, flTone));
    alpha = flF;
  } else {
    // Glass: clear face-on, brighter toward the edges (Fresnel), with a
    // highlight; the lip (f 1) and foot (f 0.4) are thicker glass.
    float nv = abs(dot(flN, V));
    float fres = pow(1.0 - nv, 3.0);
    float spec = pow(max(dot(reflect(-L, flN), V), 0.0), 60.0);
    rgb = mix(base, vec3(1.0), 0.4 * fres) + vec3(spec * 0.9);
    alpha = m0.a * (0.03 + 0.7 * fres + 0.5 * flF) + spec * 0.6;
  }
  color = vec4(rgb * uSpClock.z, clamp(alpha, 0.0, 1.0));
}
`;

const WGSL = /* wgsl */ `
uniform uSpClock: vec4f;
uniform uSpCam: vec4f;
uniform uSpToy: vec4f;
uniform uSpBodyQ: vec4f;
uniform uSpBodyT: vec4f;
uniform uFlMat: array<vec4f, ${MAX_MATS * 2}>;
uniform uFlLight: vec4f;
var<private> flAn: vec4f = vec4f(0.0);
var<private> flQ: vec4f = vec4f(0.0, 0.0, 0.0, 1.0);
var<private> flR: vec3f = vec3f(1.0);
var<private> flSub: f32 = 0.0;
var<private> flExt: f32 = 1.0;
var<private> flKind: f32 = 0.0;
var<private> flF: f32 = 0.0;
var<private> flN: vec3f = vec3f(0.0, 1.0, 0.0);
var<private> flSurf: f32 = 0.0;
var<private> flV: vec3f = vec3f(0.0);
var<private> flMat: i32 = 0;
var<private> flTone: f32 = 0.0;

fn flRot(q: vec4f, v: vec3f) -> vec3f {
  let t = 2.0 * cross(q.xyz, v);
  return v + q.w * t + cross(q.xyz, t);
}
fn flQuat(a: vec3f, b: vec3f, c: vec3f) -> vec4f {
  let tr = a.x + b.y + c.z;
  var q: vec4f;
  if (tr > 0.0) {
    let s = sqrt(tr + 1.0) * 2.0;
    q = vec4f((b.z - c.y) / s, (c.x - a.z) / s, (a.y - b.x) / s, 0.25 * s);
  } else if (a.x > b.y && a.x > c.z) {
    let s = sqrt(1.0 + a.x - b.y - c.z) * 2.0;
    q = vec4f(0.25 * s, (b.x + a.y) / s, (c.x + a.z) / s, (b.z - c.y) / s);
  } else if (b.y > c.z) {
    let s = sqrt(1.0 + b.y - a.x - c.z) * 2.0;
    q = vec4f((b.x + a.y) / s, 0.25 * s, (c.y + b.z) / s, (c.x - a.z) / s);
  } else {
    let s = sqrt(1.0 + c.z - a.x - b.y) * 2.0;
    q = vec4f((c.x + a.z) / s, (c.y + b.z) / s, 0.25 * s, (a.y - b.x) / s);
  }
  return normalize(q);
}
fn flAny(n: vec3f) -> vec3f {
  var r = vec3f(1.0, 0.0, 0.0);
  if (abs(n.y) < 0.9) { r = vec3f(0.0, 1.0, 0.0); }
  return normalize(cross(n, r));
}
fn flRamp(f: f32) -> vec3f {
  let blue = vec3f(0.25, 0.42, 1.0);
  let white = vec3f(1.0, 0.93, 0.62);
  let yellow = vec3f(1.0, 0.72, 0.2);
  let orange = vec3f(1.0, 0.42, 0.07);
  let red = vec3f(0.55, 0.11, 0.03);
  if (f < 0.14) { return mix(blue, white, smoothstep(0.02, 0.14, f)); }
  if (f < 0.35) { return mix(white, yellow, (f - 0.14) / 0.21); }
  if (f < 0.65) { return mix(yellow, orange, (f - 0.35) / 0.3); }
  return mix(orange, red, (f - 0.65) / 0.35);
}

fn modifySplatCenter(center: ptr<function, vec3f>) {
  flAn = loadSplatAnim();
  let sh = loadFluidShape();
  let sz = loadFluidSize();
  flKind = floor(flAn.w + 1e-4);
  flF = clamp((flAn.w - flKind) / 0.999, 0.0, 1.0);
  flMat = i32(floor(sz.w + 1e-4));
  let fr = (sz.w - f32(flMat)) * 16.0;
  let sq = floor(fr + 1e-3);
  flSurf = sq / 15.0;
  flTone = clamp((fr - sq) * 16.0 / 15.0, 0.0, 1.0);
  let q = uniform.uSpBodyQ;
  flQ = normalize(vec4f(q.w * sh.xyz + sh.w * q.xyz + cross(q.xyz, sh.xyz), q.w * sh.w - dot(q.xyz, sh.xyz)));
  flR = sz.xyz;
  flN = flRot(flQ, vec3f(0.0, 0.0, 1.0));
  flV = flRot(q, flAn.xyz);
  *center = uniform.uSpToy.xyz + flRot(q, *center - uniform.uSpToy.xyz) + uniform.uSpBodyT.xyz;
  if (flKind > 0.5 && flKind < 1.5) {
    let fr = flAn.w - flKind;
    flSub = floor(fr * 4.0 + 1e-3);
    flF = clamp((fr - 0.25 * flSub) / 0.2, 0.0, 1.0);
    let m1 = uniform.uFlMat[flMat * 2 + 1];
    let base = m1.x * uniform.uSpClock.y;
    flExt = 1.0 + min(length(flV) * m1.z / max(m1.x, 1e-5), 4.0);
    var off: vec3f;
    if (flR.x < 0.0) {
      off = vec3f(0.0, (flSub - 1.5) * 0.3 * base, 0.0);
    } else {
      let g = vec2f((flSub % 2.0) - 0.5, floor(flSub * 0.5) - 0.5);
      off = vec3f(g.x * 0.9 * flR.x, g.y * 0.9 * flR.y, 0.0) * base;
    }
    *center = *center + flRot(flQ, off);
  }
}

fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {
  let m1 = uniform.uFlMat[flMat * 2 + 1];
  let base = m1.x * uniform.uSpClock.y;
  let speed = length(flV);
  var vd = vec3f(0.0, 1.0, 0.0);
  if (speed > 1e-5) { vd = flV / speed; }
  let ext = 1.0 + min(speed * m1.z / max(m1.x, 1e-5), 4.0);
  var a = vd;
  var b = flAny(a);
  var c = cross(a, b);
  var s = vec3f(0.0);
  if (flKind < 0.5) {
    s = vec3f(0.0);
  } else if (flKind < 1.5) {
    *rotation = flQ;
    if (flR.x < 0.0) {
      *scale = base * vec3f(0.8 * flExt, 0.42, 0.5);
    } else if (flF > 0.75) {
      var sc = vec3f(0.0);
      if (flSub < 0.5) { sc = base * 0.85 * vec3f(1.0); }
      sc.x = sc.x * min(flExt, 2.2);
      *rotation = flQuat(a, b, c);
      *scale = sc;
    } else {
      *scale = base * vec3f(0.62 * flR.x, 0.62 * flR.y, 0.8 * flR.z);
    }
    return;
  } else if (flKind < 2.5) {
    c = vec3f(0.0, 1.0, 0.0);
    a = flAny(c);
    b = cross(c, a);
    s = base * (0.26 - 0.08 * flF) * vec3f(1.3, 1.3, 0.4);
  } else if (flKind < 3.5) {
    s = base * vec3f(0.13);
  } else if (flKind < 4.5) {
    s = base * 0.45 * vec3f(min(ext, 2.2), 1.0, 1.0);
  } else if (flKind < 6.5) {
    let g = 0.55 + 2.4 * pow(flF, 0.6);
    s = base * g * vec3f(1.0 + 0.25 * min(ext - 1.0, 1.0), 1.0, 1.0);
  } else if (flKind < 7.5) {
    let g = mix(1.0, 0.35, flF);
    s = base * g * vec3f(min(ext, 2.2), 0.85, 0.85);
  } else if (flKind < 8.5) {
    s = base * vec3f(0.16 * min(ext, 4.0), 0.12, 0.12);
  } else {
    *rotation = flQ;
    *scale = base * flR;
    return;
  }
  *rotation = flQuat(a, b, c);
  *scale = s;
}

fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
  let m0 = uniform.uFlMat[flMat * 2];
  let m1 = uniform.uFlMat[flMat * 2 + 1];
  let base = m0.rgb;
  let L = normalize(uniform.uFlLight.xyz);
  let V = normalize(uniform.uSpCam.xyz - center);
  var rgb = base;
  var alpha = m0.a;
  if (flKind < 0.5) {
    alpha = 0.0;
  } else if (flKind < 1.5) {
    var n = V;
    if (flSurf > 0.3) { n = flN; }
    let nv = abs(dot(n, V));
    let fres = pow(1.0 - nv, 2.5);
    let lit = 0.9 + 0.1 * max(dot(n, L), 0.0);
    let spec = pow(max(dot(reflect(-L, n), V), 0.0), 60.0);
    rgb = base * lit;
    let lum = dot(base, vec3f(0.3, 0.59, 0.11));
    rgb = mix(rgb, vec3f(1.0), 0.5 * fres * (0.25 + 0.75 * lum));
    rgb = rgb + vec3f(0.5 * spec);
    alpha = 1.0;
    if (m1.y > 0.0) {
      let hot = mix(vec3f(1.0, 0.32, 0.04), vec3f(1.0, 0.78, 0.25), smoothstep(0.75, 1.0, flTone));
      let crust = vec3f(0.16, 0.05, 0.03) * lit + vec3f(spec * 0.25);
      rgb = mix(crust, hot * 1.25, smoothstep(0.3, 0.85, flTone) * m1.y);
    }
  } else if (flKind < 2.5) {
    let lit = 0.86 + 0.14 * max(dot(vec3f(0.0, 1.0, 0.0), L), 0.0);
    rgb = mix(vec3f(0.96, 0.93, 0.86), base, 0.1) * lit;
    alpha = 0.85 * pow(1.0 - flF, 0.5);
  } else if (flKind < 3.5) {
    rgb = mix(base, vec3f(1.0), 0.72);
    alpha = 0.85;
  } else if (flKind < 4.5) {
    rgb = mix(base, vec3f(1.0), 0.25);
    alpha = 0.95 * (1.0 - flF * flF);
  } else if (flKind < 5.5) {
    rgb = base * (0.9 + 0.2 * flTone);
    alpha = m0.a * smoothstep(0.0, 0.08, flF) * pow(1.0 - flF, 1.4);
  } else if (flKind < 6.5) {
    rgb = base;
    alpha = m0.a * smoothstep(0.0, 0.12, flF) * pow(1.0 - flF, 1.8);
  } else if (flKind < 7.5) {
    rgb = flRamp(flF) * (1.45 - 0.6 * flF);
    alpha = mix(0.6, 0.9, smoothstep(0.06, 0.16, flF)) * pow(1.0 - flF, 1.2);
  } else if (flKind < 8.5) {
    rgb = vec3f(1.0, 0.72, 0.3) * 1.6;
    alpha = 1.0 - flF;
  } else if (flKind > 9.5) {
    let n = flN;
    let fres = pow(1.0 - abs(dot(n, V)), 3.0);
    let spec = pow(max(dot(reflect(-L, n), V), 0.0), 60.0);
    rgb = base * (0.94 + 0.06 * max(dot(n, L), 0.0));
    rgb = mix(rgb, vec3f(1.0), 0.3 * fres) + vec3f(0.45 * spec);
    rgb = mix(rgb, vec3f(0.93, 0.88, 0.78) * (0.92 + 0.08 * max(dot(n, L), 0.0)), smoothstep(0.05, 0.6, flTone));
    alpha = flF;
  } else {
    let nv = abs(dot(flN, V));
    let fres = pow(1.0 - nv, 3.0);
    let spec = pow(max(dot(reflect(-L, flN), V), 0.0), 60.0);
    rgb = mix(base, vec3f(1.0), 0.4 * fres) + vec3f(spec * 0.9);
    alpha = m0.a * (0.03 + 0.7 * fres + 0.5 * flF) + spec * 0.6;
  }
  *color = vec4f(rgb * uniform.uSpClock.z, clamp(alpha, 0.0, 1.0));
}
`;

export const FLUID_MODIFIER = { glsl: GLSL, wgsl: WGSL };

// The splat layer: a container with a slot per particle, its textures
// rewritten each frame from the world's packed arrays.
export class FluidLayer {
  constructor(stage, slots, { reach = 1.6 } = {}) {
    const device = stage.device;
    this.stage = stage;
    this.slots = slots;
    const format = pc.GSplatFormat.createDefaultFormat(device);
    format.addExtraStreams([
      { name: "splatAnim", format: pc.PIXELFORMAT_RGBA32F, storage: pc.GSPLAT_STREAM_RESOURCE },
      { name: "fluidShape", format: pc.PIXELFORMAT_RGBA32F, storage: pc.GSPLAT_STREAM_RESOURCE },
      { name: "fluidSize", format: pc.PIXELFORMAT_RGBA32F, storage: pc.GSPLAT_STREAM_RESOURCE },
    ]);
    const container = new pc.GSplatContainer(device, slots, format);
    this.container = container;
    // Color, size and turn come from the program; store plain values.
    const half = pc.FloatPacking.float2Half;
    const one = half(1);
    const zero = half(0);
    for (const [name, v] of [
      ["dataColor", [one, one, one, one]],
      ["dataScale", [one, one, one, zero]],
      ["dataRotation", [one, zero, zero, zero]],
    ]) {
      const tex = container.getTexture(name);
      const d = tex.lock();
      for (let i = 0; i < d.length; i += 4) d.set(v, i);
      tex.unlock();
    }
    for (const name of ["dataCenter", "splatAnim", "fluidShape", "fluidSize"]) {
      const tex = container.getTexture(name);
      tex.lock().fill(0);
      tex.unlock();
    }
    const aabb = new pc.BoundingBox();
    aabb.setMinMax(new pc.Vec3(-reach, -reach, -reach), new pc.Vec3(reach, reach, reach));
    container.aabb = aabb;
    container.update(slots, true);
    this.layer = stage.addLayer(container, FLUID_MODIFIER);
    this.frames = 0;
  }

  // Uploads a packed frame ({ center, anim, shape, size }). `sort`: also
  // re-sort by the new places (the WebGL2 path sorts on the CPU from
  // container.centers).
  upload(b, sort) {
    const c = this.container;
    const n = this.slots * 4;
    for (const [name, src] of [
      ["dataCenter", b.center],
      ["splatAnim", b.anim],
      ["fluidShape", b.shape],
      ["fluidSize", b.size],
    ]) {
      const tex = c.getTexture(name);
      const d = tex.lock();
      d.set(src.subarray(0, Math.min(n, d.length)));
      tex.unlock();
    }
    if (sort) {
      const cs = c.centers;
      const center = b.center;
      for (let i = 0; i < this.slots; i++) {
        cs[i * 3] = center[i * 4];
        cs[i * 3 + 1] = center[i * 4 + 1];
        cs[i * 3 + 2] = center[i * 4 + 2];
      }
      c.update(this.slots, true);
    }
    this.stage.requestRender();
  }

  setMaterials(mats, light = [0.4, 0.85, 0.35]) {
    const data = new Float32Array(MAX_MATS * 8);
    mats.slice(0, MAX_MATS).forEach((m, i) => {
      data.set([...m.color, m.opacity], i * 8);
      data.set([m.size, m.glow, m.stretch, 0], i * 8 + 4);
    });
    this.uniforms = { "uFlMat[0]": data, uFlLight: [...light, 0] };
    this.stage.setLayerUniforms(this.layer, this.uniforms);
  }

  destroy() {
    this.stage.removeLayer(this.layer);
    this.layer = null;
  }
}

// Lane Fluids r4: the liquid drawn as a surface (screen-space fluid rendering).
//
// After PlayCanvas has drawn the frame, the liquid's particles are drawn as
// spheres into a depth texture and, added up, into a thickness texture (both
// at a reduced resolution). A bilateral filter smooths the depth across
// particles but not across edges, so the particles merge into one surface.
// The last pass rebuilds the surface's normals from the smoothed depth and
// shades it over a copy of the frame: refraction of what is behind (offset
// by the normal, dimmed and tinted by the thickness, Beer-Lambert), a Fresnel
// reflection of a soft studio sky, a specular highlight, and, for lava, glow.
// The glass is traced analytically in the same pass (its walls, rim and
// foot), and the diffuse particles (foam, bubbles, spray) and the gas volume
// are drawn after it (see foam.js and volume.js).
//
// After Simon Green, "Screen Space Fluid Rendering for Games" (GDC 2010), and
// van der Laan, Green and Sainz, "Screen Space Fluid Rendering with
// Curvature Flow" (I3D 2009).

import * as pc from "../../pc.js";

const QUAD_VS = /* glsl */ `
attribute vec2 aPosition;
varying vec2 uv0;
void main() {
  gl_Position = vec4(aPosition, 0.5, 1.0);
  uv0 = aPosition * 0.5 + 0.5;
}
`;
const QUAD_VS_W = /* wgsl */ `
attribute aPosition: vec2f;
varying uv0: vec2f;
@vertex fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f(input.aPosition, 0.5, 1.0);
  output.uv0 = input.aPosition * 0.5 + vec2f(0.5);
  return output;
}
`;

// ---- Particles as sphere sprites ------------------------------------------------------------

const SPRITE_VS = /* glsl */ `
attribute vec2 aPosition;
uniform sampler2D uParticles;
uniform float uTexWidth;
uniform mat4 uSimToView;
uniform mat4 uProj;
uniform float uRadius;
uniform vec2 uMinPx;       // x the smallest radius in texels, y texels per unit at distance 1
uniform vec2 uStretch;     // x seconds of travel to stretch by, y the velocity rows' start
varying vec2 vUv;
varying vec3 vCenter;
varying float vR;
varying float vS;
void main() {
  int i = gl_InstanceID;
  int w = int(uTexWidth);
  ivec2 q = ivec2(i - (i / w) * w, i / w);
  vec4 p = texelFetch(uParticles, q, 0);
  vec4 vp = uSimToView * vec4(p.xyz, 1.0);
  // Never smaller than a texel or two, or a far liquid breaks into specks.
  float r = max(uRadius, uMinPx.x * max(-vp.z, 1e-3) / uMinPx.y);
  // Fast flow is drawn stretched along its motion (a frame's travel), so a
  // falling stream reads as one continuous stream, not beads.
  vec3 vel = (uSimToView * vec4(texelFetch(uParticles, q + ivec2(0, int(uStretch.y)), 0).xyz, 0.0)).xyz;
  float sl = length(vel.xy);
  float L = min(sl * uStretch.x, 5.0 * r);
  vec2 dir = sl > 1e-6 ? vel.xy / sl : vec2(1.0, 0.0);
  vec2 off = dir * aPosition.x * (r + 0.5 * L) + vec2(-dir.y, dir.x) * aPosition.y * r;
  vec3 corner = vp.xyz + vec3(off, 0.0);
  vec4 c = uProj * vec4(corner, 1.0);
  gl_Position = vec4(c.xy, 0.5 * c.w, c.w);
  vUv = aPosition;
  vCenter = vp.xyz;
  vR = r;
  vS = r / (r + 0.5 * L);
}
`;
const SPRITE_VS_W = /* wgsl */ `
attribute aPosition: vec2f;
var uParticles: texture_2d<uff>;
uniform uTexWidth: f32;
uniform uSimToView: mat4x4f;
uniform uProj: mat4x4f;
uniform uRadius: f32;
uniform uMinPx: vec2f;
uniform uStretch: vec2f;
varying vUv: vec2f;
varying vCenter: vec3f;
varying vR: f32;
varying vS: f32;
@vertex fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let i = i32(input.instanceIndex);
  let w = i32(uniform.uTexWidth);
  let q = vec2i(i % w, i / w);
  let p = textureLoad(uParticles, q, 0);
  let vp = uniform.uSimToView * vec4f(p.xyz, 1.0);
  let r = max(uniform.uRadius, uniform.uMinPx.x * max(-vp.z, 1e-3) / uniform.uMinPx.y);
  let vel = (uniform.uSimToView * vec4f(textureLoad(uParticles, q + vec2i(0, i32(uniform.uStretch.y)), 0).xyz, 0.0)).xyz;
  let sl = length(vel.xy);
  let L = min(sl * uniform.uStretch.x, 5.0 * r);
  var dir = vec2f(1.0, 0.0);
  if (sl > 1e-6) { dir = vel.xy / sl; }
  let off = dir * input.aPosition.x * (r + 0.5 * L) + vec2f(-dir.y, dir.x) * input.aPosition.y * r;
  let corner = vp.xyz + vec3f(off, 0.0);
  let c = uniform.uProj * vec4f(corner, 1.0);
  output.position = vec4f(c.xy, 0.5 * c.w, c.w);
  output.vUv = input.aPosition;
  output.vCenter = vp.xyz;
  output.vR = r;
  output.vS = r / (r + 0.5 * L);
  return output;
}
`;

// Diffuse particles (diffuse.js): soft discs added into the thickness
// texture's other channels, foam and spray in g, bubbles in b.
const DIFF_VS = /* glsl */ `
attribute vec2 aPosition;
uniform sampler2D uDiffuse;
uniform mat4 uSimToView;
uniform mat4 uProj;
uniform vec4 uDiffR;
varying vec2 vUv;
varying vec2 vKind;
void main() {
  int i = gl_InstanceID;
  vec4 p = texelFetch(uDiffuse, ivec2(i - (i / 256) * 256, i / 256), 0);
  float kind = floor(p.w);
  float fade = fract(p.w);
  float r = kind < 1.5 ? uDiffR.x : kind < 2.5 ? uDiffR.y : uDiffR.z;
  vec4 vp = uSimToView * vec4(p.xyz, 1.0);
  vec4 c = uProj * vec4(vp.xyz + vec3(aPosition * r, 0.0), 1.0);
  gl_Position = vec4(c.xy, 0.5 * c.w, c.w);
  vUv = aPosition;
  vKind = vec2(kind, fade);
}
`;
const DIFF_VS_W = /* wgsl */ `
attribute aPosition: vec2f;
var uDiffuse: texture_2d<uff>;
uniform uSimToView: mat4x4f;
uniform uProj: mat4x4f;
uniform uDiffR: vec4f;
varying vUv: vec2f;
varying vKind: vec2f;
@vertex fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let i = i32(input.instanceIndex);
  let p = textureLoad(uDiffuse, vec2i(i % 256, i / 256), 0);
  let kind = floor(p.w);
  let fade = fract(p.w);
  var r = uniform.uDiffR.z;
  if (kind < 2.5) { r = uniform.uDiffR.y; }
  if (kind < 1.5) { r = uniform.uDiffR.x; }
  let vp = uniform.uSimToView * vec4f(p.xyz, 1.0);
  let c = uniform.uProj * vec4f(vp.xyz + vec3f(input.aPosition * r, 0.0), 1.0);
  output.position = vec4f(c.xy, 0.5 * c.w, c.w);
  output.vUv = input.aPosition;
  output.vKind = vec2f(kind, fade);
  return output;
}
`;
const DIFF_FS = /* glsl */ `
varying vec2 vUv;
varying vec2 vKind;
void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;
  float cov = (1.0 - r2) * (1.0 - r2) * (1.0 - vKind.y * vKind.y);
  gl_FragColor = vKind.x > 2.5 ? vec4(0.0, 0.0, cov, 0.0) : vec4(0.0, cov, 0.0, 0.0);
}
`;
const DIFF_FS_W = /* wgsl */ `
varying vUv: vec2f;
varying vKind: vec2f;
@fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let r2 = dot(input.vUv, input.vUv);
  if (r2 > 1.0) { discard; }
  let cov = (1.0 - r2) * (1.0 - r2) * (1.0 - input.vKind.y * input.vKind.y);
  if (input.vKind.x > 2.5) { output.color = vec4f(0.0, 0.0, cov, 0.0); } else { output.color = vec4f(0.0, cov, 0.0, 0.0); }
  return output;
}
`;

// Depth: the sphere's front, as a distance from the camera (0 = empty).
const DEPTH_FS = /* glsl */ `
uniform float uFar;
varying vec2 vUv;
varying vec3 vCenter;
varying float vR;
varying float vS;
void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;
  float d = -(vCenter.z + sqrt(1.0 - r2) * vR);
  gl_FragColor = vec4(d, 0.0, 0.0, 1.0);
  gl_FragDepth = clamp(d / uFar, 0.0, 1.0);
}
`;
const DEPTH_FS_W = /* wgsl */ `
uniform uFar: f32;
varying vUv: vec2f;
varying vCenter: vec3f;
varying vR: f32;
varying vS: f32;
@fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let r2 = dot(input.vUv, input.vUv);
  if (r2 > 1.0) { discard; }
  let d = -(input.vCenter.z + sqrt(1.0 - r2) * input.vR);
  output.color = vec4f(d, 0.0, 0.0, 1.0);
  output.fragDepth = clamp(d / uniform.uFar, 0.0, 1.0);
  return output;
}
`;

// Thickness: the sphere's chord, added up (additive blending).
const THICK_FS = /* glsl */ `
uniform float uRadius;
varying vec2 vUv;
varying vec3 vCenter;
varying float vR;
varying float vS;
void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;
  // an enlarged or stretched sprite keeps the particle's volume (thinner, wider)
  float k = uRadius / vR;
  gl_FragColor = vec4(2.0 * sqrt(1.0 - r2) * vR * k * k * k * vS, 0.0, 0.0, 1.0);
}
`;
const THICK_FS_W = /* wgsl */ `
uniform uRadius: f32;
varying vUv: vec2f;
varying vCenter: vec3f;
varying vR: f32;
varying vS: f32;
@fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let r2 = dot(input.vUv, input.vUv);
  if (r2 > 1.0) { discard; }
  let k = uniform.uRadius / input.vR;
  output.color = vec4f(2.0 * sqrt(1.0 - r2) * input.vR * k * k * k * input.vS, 0.0, 0.0, 1.0);
  return output;
}
`;

// ---- Bilateral filter (one direction per pass) ---------------------------------------------

const BLUR_FS = /* glsl */ `
varying vec2 uv0;
uniform sampler2D uSrc;
uniform vec2 uDir;        // texel step along the pass's direction
uniform float uWorldR;    // filter radius in world units
uniform float uProjY;     // projection[1][1] * height / 2
uniform float uEdge;      // depth difference that stops the filter
void main() {
  float d0 = texture2D(uSrc, uv0).r;
  if (d0 <= 0.0) { gl_FragColor = vec4(0.0); return; }
  float rpx = clamp(uWorldR * uProjY / d0, 4.0, 24.0);
  float step = rpx / 8.0;
  // the edge grows with the texel's size, as the sprites do
  float edge = max(uEdge, 5.0 * d0 / uProjY);
  float sum = d0;
  float wsum = 1.0;
  for (int k = 1; k <= 8; k++) {
    float x = float(k) * step;
    float ws = exp(-2.0 * float(k * k) / 64.0);
    for (int s = -1; s <= 1; s += 2) {
      float d = texture2D(uSrc, uv0 + uDir * x * float(s)).r;
      if (d <= 0.0) continue;
      float dz = (d - d0) / edge;
      float w = ws * exp(-dz * dz);
      sum += d * w;
      wsum += w;
    }
  }
  gl_FragColor = vec4(sum / wsum, 0.0, 0.0, 1.0);
}
`;
const BLUR_FS_W = /* wgsl */ `
varying uv0: vec2f;
var uSrc: texture_2d<uff>;
uniform uDir: vec2f;
uniform uWorldR: f32;
uniform uProjY: f32;
uniform uEdge: f32;
fn texel(uv: vec2f) -> f32 {
  let size = vec2f(textureDimensions(uSrc, 0));
  let q = clamp(vec2i(vec2f(uv.x, 1.0 - uv.y) * size), vec2i(0), vec2i(size) - vec2i(1));
  return textureLoad(uSrc, q, 0).r;
}
@fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let d0 = texel(input.uv0);
  if (d0 <= 0.0) { output.color = vec4f(0.0); return output; }
  let rpx = clamp(uniform.uWorldR * uniform.uProjY / d0, 4.0, 24.0);
  let stp = rpx / 8.0;
  let edge = max(uniform.uEdge, 5.0 * d0 / uniform.uProjY);
  var sum = d0;
  var wsum = 1.0;
  for (var k = 1; k <= 8; k++) {
    let x = f32(k) * stp;
    let ws = exp(-2.0 * f32(k * k) / 64.0);
    for (var s = -1; s <= 1; s += 2) {
      let d = texel(input.uv0 + uniform.uDir * x * f32(s));
      if (d <= 0.0) { continue; }
      let dz = (d - d0) / edge;
      let w = ws * exp(-dz * dz);
      sum += d * w;
      wsum += w;
    }
  }
  output.color = vec4f(sum / wsum, 0.0, 0.0, 1.0);
  return output;
}
`;

// ---- Shading and the glass -------------------------------------------------------------------

// Shared shading code (the GLSL and WGSL versions below mirror each other).
const COMPOSITE_FS = /* glsl */ `
varying vec2 uv0;
uniform sampler2D uScene;
uniform sampler2D uDepth;
uniform sampler2D uThick;
uniform mat4 uInvProj;
uniform mat4 uViewToToy;   // view space -> toy (recipe) space
uniform mat4 uToyToView;
uniform vec2 uDepthSize;
uniform vec4 uColor;       // rgb liquid color, a: scattering (0 clear .. 1 opaque)
uniform vec4 uAbsorb;      // rgb absorption per toy unit, a: glow
uniform vec4 uLight;       // xyz light direction (toy space, toward the light)
uniform vec4 uGlassA;      // xyz base center (toy), w inner radius
uniform vec4 uGlassB;      // x height, y wall, z bottom, w on (0/1)
uniform vec4 uMisc;        // x refraction strength, y liquid on
uniform vec4 uFoam;        // rgb foam color, w on
// The gas grid (gas.js): scalars atlas (r smoke, g heat, b fuel).
uniform sampler2D uGas;
uniform vec4 uGasA;        // xyz lower corner (toy), w cell size
uniform vec4 uGasB;        // xyz cells, w tiles across
uniform vec4 uGasC;        // rgb smoke color, w on
uniform vec4 uGasD;        // x smoke density, y flame gain, z steps, w scatter light

ivec2 gasTexel(ivec3 c) {
  int nx = int(uGasB.x);
  int ny = int(uGasB.y);
  int tw = int(uGasB.w);
  int tz = c.z / tw;
  return ivec2((c.z - tz * tw) * nx + c.x, tz * ny + c.y);
}
vec4 gasFetch(ivec3 c) {
  c = clamp(c, ivec3(0), ivec3(uGasB.xyz) - 1);
  return texelFetch(uGas, gasTexel(c), 0);
}
vec4 gasSample(vec3 p0) {
  vec3 p = clamp(p0 - 0.5, vec3(0.0), uGasB.xyz - 1.0);
  vec3 f = fract(p);
  ivec3 i = ivec3(floor(p));
  vec4 a = mix(gasFetch(i), gasFetch(i + ivec3(1, 0, 0)), f.x);
  vec4 b = mix(gasFetch(i + ivec3(0, 1, 0)), gasFetch(i + ivec3(1, 1, 0)), f.x);
  vec4 c = mix(gasFetch(i + ivec3(0, 0, 1)), gasFetch(i + ivec3(1, 0, 1)), f.x);
  vec4 d = mix(gasFetch(i + ivec3(0, 1, 1)), gasFetch(i + ivec3(1, 1, 1)), f.x);
  // soft edges: the grid's box never shows (the top thins away over its last quarter)
  vec3 m = min(p0, uGasB.xyz - p0);
  float edge = smoothstep(0.0, 3.0, min(m.x, m.z)) * smoothstep(0.0, 0.25 * uGasB.y, uGasB.y - p0.y);
  return mix(mix(a, b, f.y), mix(c, d, f.y), f.z) * edge;
}
uniform sampler2D uGas2;
uniform vec4 uGas2A;        // xyz lower corner (toy), w cell size
uniform vec4 uGas2B;        // xyz cells, w tiles across
uniform vec4 uGas2C;        // rgb smoke color, w on
uniform vec4 uGas2D;        // x smoke density, y flame gain, z steps, w scatter light

ivec2 gas2Texel(ivec3 c) {
  int nx = int(uGas2B.x);
  int ny = int(uGas2B.y);
  int tw = int(uGas2B.w);
  int tz = c.z / tw;
  return ivec2((c.z - tz * tw) * nx + c.x, tz * ny + c.y);
}
vec4 gas2Fetch(ivec3 c) {
  c = clamp(c, ivec3(0), ivec3(uGas2B.xyz) - 1);
  return texelFetch(uGas2, gas2Texel(c), 0);
}
vec4 gas2Sample(vec3 p0) {
  vec3 p = clamp(p0 - 0.5, vec3(0.0), uGas2B.xyz - 1.0);
  vec3 f = fract(p);
  ivec3 i = ivec3(floor(p));
  vec4 a = mix(gas2Fetch(i), gas2Fetch(i + ivec3(1, 0, 0)), f.x);
  vec4 b = mix(gas2Fetch(i + ivec3(0, 1, 0)), gas2Fetch(i + ivec3(1, 1, 0)), f.x);
  vec4 c = mix(gas2Fetch(i + ivec3(0, 0, 1)), gas2Fetch(i + ivec3(1, 0, 1)), f.x);
  vec4 d = mix(gas2Fetch(i + ivec3(0, 1, 1)), gas2Fetch(i + ivec3(1, 1, 1)), f.x);
  // soft edges: the grid's box never shows (the top thins away over its last quarter)
  vec3 m = min(p0, uGas2B.xyz - p0);
  float edge = smoothstep(0.0, 3.0, min(m.x, m.z)) * smoothstep(0.0, 0.25 * uGas2B.y, uGas2B.y - p0.y);
  return mix(mix(a, b, f.y), mix(c, d, f.y), f.z) * edge;
}
// A candle flame's colors by temperature: deep blue at the base where fuel
// meets air, then the soot glowing yellow-white, yellow, orange, dull red.
vec3 flameRamp(float t) {
  vec3 c = mix(vec3(0.5, 0.08, 0.02), vec3(1.0, 0.45, 0.08), smoothstep(0.1, 0.35, t));
  c = mix(c, vec3(1.0, 0.82, 0.45), smoothstep(0.35, 0.6, t));
  c = mix(c, vec3(1.0, 0.97, 0.88), smoothstep(0.6, 0.9, t));
  return c;
}

// The thickness texture's channels, filtered by hand (it is nearest).
vec4 thickAll(vec2 uv) {
  vec2 size = vec2(textureSize(uThick, 0));
  vec2 p = uv * size - 0.5;
  ivec2 i = ivec2(floor(p));
  vec2 f = fract(p);
  ivec2 m = ivec2(size) - 1;
  vec4 a = texelFetch(uThick, clamp(i, ivec2(0), m), 0);
  vec4 b = texelFetch(uThick, clamp(i + ivec2(1, 0), ivec2(0), m), 0);
  vec4 c = texelFetch(uThick, clamp(i + ivec2(0, 1), ivec2(0), m), 0);
  vec4 d = texelFetch(uThick, clamp(i + ivec2(1, 1), ivec2(0), m), 0);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float sampleDepth(vec2 uv) {
  return texture2D(uDepth, uv).r;
}
vec3 viewPos(vec2 uv, float d) {
  vec4 r = uInvProj * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
  vec3 dir = r.xyz / r.w;
  return dir * (d / -dir.z);
}
vec3 sky(vec3 dirToy) {
  float t = clamp(dirToy.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 c = mix(vec3(0.20, 0.19, 0.18), vec3(0.95, 0.97, 1.0), smoothstep(0.35, 0.9, t));
  // a soft window-like panel high up
  c += vec3(0.6) * smoothstep(0.93, 0.99, t);
  return c;
}
// Ray against an infinite cylinder around y (radius r, center c): the two t's.
vec2 hitCyl(vec3 o, vec3 d, vec3 c, float r) {
  vec2 oc = o.xz - c.xz;
  float a = dot(d.xz, d.xz);
  float b = dot(oc, d.xz);
  float k = dot(oc, oc) - r * r;
  float h = b * b - a * k;
  if (h < 0.0 || a < 1e-8) return vec2(1e9, -1e9);
  h = sqrt(h);
  return vec2((-b - h) / a, (-b + h) / a);
}
float fresnel(float cosT, float f0) {
  return f0 + (1.0 - f0) * pow(1.0 - clamp(cosT, 0.0, 1.0), 5.0);
}

void main() {
  vec3 scene = texture2D(uScene, uv0).rgb;
  vec3 col = scene;
  // The eye ray in toy space.
  vec3 pv = viewPos(uv0, 1.0);
  vec3 eye = (uViewToToy * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 rd = normalize((uViewToToy * vec4(normalize(pv), 0.0)).xyz);
  vec3 L = normalize(uLight.xyz);

  // Glass: find the front and back of the wall along the ray.
  float tFront = 1e9;
  float tBack = 1e9;
  vec3 nFront = vec3(0.0);
  if (uGlassB.w > 0.5) {
    vec3 c = uGlassA.xyz;
    float rIn = uGlassA.w;
    float rOut = rIn + uGlassB.y;
    vec2 o = hitCyl(eye, rd, c, rOut);
    float y0 = c.y;
    float y1 = c.y + uGlassB.x;
    if (o.x < 1e8) {
      float ya = eye.y + rd.y * o.x;
      if (ya > y0 && ya < y1) { tFront = o.x; vec3 p = eye + rd * o.x; nFront = normalize(vec3(p.x - c.x, 0.0, p.z - c.z)); }
      float yb = eye.y + rd.y * o.y;
      if (yb > y0 && yb < y1) tBack = o.y;
    }
  }

  // Liquid.
  float d = uMisc.y > 0.5 ? sampleDepth(uv0) : 0.0;
  if (d > 0.0) {
    vec2 px = 1.0 / uDepthSize;
    vec3 P = viewPos(uv0, d);
    float dr = sampleDepth(uv0 + vec2(px.x, 0.0));
    float dl = sampleDepth(uv0 - vec2(px.x, 0.0));
    float du = sampleDepth(uv0 + vec2(0.0, px.y));
    float dd = sampleDepth(uv0 - vec2(0.0, px.y));
    vec3 ddx = dr > 0.0 ? viewPos(uv0 + vec2(px.x, 0.0), dr) - P : vec3(1e9);
    vec3 ddx2 = dl > 0.0 ? P - viewPos(uv0 - vec2(px.x, 0.0), dl) : vec3(1e9);
    if (abs(ddx2.z) < abs(ddx.z)) ddx = ddx2;
    vec3 ddy = du > 0.0 ? viewPos(uv0 + vec2(0.0, px.y), du) - P : vec3(1e9);
    vec3 ddy2 = dd > 0.0 ? P - viewPos(uv0 - vec2(0.0, px.y), dd) : vec3(1e9);
    if (abs(ddy2.z) < abs(ddy.z)) ddy = ddy2;
    vec3 nV = normalize(cross(ddx, ddy));
    if (dot(nV, P) > 0.0) nV = -nV;
    vec3 n = normalize((uViewToToy * vec4(nV, 0.0)).xyz);
    // In a glass the liquid's sides are the glass's inner wall: take its
    // normal there (the smoothed depth rounds the edge like a pudding).
    if (uGlassB.w > 0.5) {
      vec3 Pt = (uViewToToy * vec4(P, 1.0)).xyz;
      vec2 rr = Pt.xz - uGlassA.xz;
      float rl = length(rr);
      if (rl > uGlassA.w - uMisc.z && n.y < 0.6 && Pt.y < uGlassA.y + uGlassB.x) {
        n = vec3(rr.x, 0.0, rr.y) / max(rl, 1e-5);
        nV = normalize((uToyToView * vec4(n, 0.0)).xyz);
      }
    }
    vec3 V = -rd;
    float thick = thickAll(uv0).r;
    // Refraction: what is behind, bent by the normal and seen through the thickness.
    vec2 off = nV.xy * uMisc.x * clamp(thick * 4.0, 0.0, 1.0);
    vec3 behind = texture2D(uScene, clamp(uv0 - off, vec2(0.001), vec2(0.999))).rgb;
    vec3 T = exp(-uAbsorb.rgb * thick);
    vec3 lit = uColor.rgb * (0.35 + 0.65 * max(dot(n, L), 0.0));
    vec3 body = mix(behind * T + uColor.rgb * (1.0 - T) * 0.25, lit, uColor.a);
    float F = fresnel(dot(n, V), 0.02);
    vec3 refl = sky(reflect(-V, n));
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(n, H), 0.0), 180.0) * 1.6;
    vec3 liq = mix(body, refl, F) + spec + uColor.rgb * uAbsorb.a;
    // Bubbles inside: bright specks, tinted by the liquid around them.
    float bub = clamp(thickAll(uv0).b * 1.2, 0.0, 1.0) * uFoam.w;
    liq = mix(liq, mix(uColor.rgb, vec3(1.0), 0.6) * (0.65 + 0.35 * max(dot(n, L), 0.0)) + 0.08, bub * 0.75);
    float a = clamp(thick * 60.0, 0.0, 1.0);
    col = mix(col, liq, a);
  }
  // Foam and spray over the liquid.
  if (uFoam.w > 0.5) {
    float fo = clamp(thickAll(uv0).g * 1.4, 0.0, 1.0);
    col = mix(col, uFoam.rgb, fo);
  }

  // The glass wall over it all: a clear tint, bright at grazing angles, and
  // the far wall's faint reflection.
  if (tBack < 1e8) {
    float F2 = fresnel(abs(dot(rd, normalize(vec3(eye.x - uGlassA.x, 0.0, eye.z - uGlassA.z)))), 0.04);
    col = mix(col, sky(rd), 0.06 * F2);
  }
  if (tFront < 1e8) {
    float cosT = abs(dot(rd, nFront));
    float F = fresnel(cosT, 0.04);
    vec3 refl = sky(reflect(rd, nFront));
    col = col * vec3(0.97, 0.985, 0.98);
    col = mix(col, refl, F);
    vec3 H = normalize(L - rd);
    col += pow(max(dot(nFront, H), 0.0), 120.0) * 0.8;
    // edge lines where the ray grazes the wall (silhouette)
    col = mix(col, vec3(0.92), smoothstep(0.25, 0.05, cosT) * 0.5);
  }
  // Gas: march the grid's box front to back.
  if (uGasC.w > 0.5) {
    vec3 lo = uGasA.xyz;
    vec3 hi = uGasA.xyz + uGasB.xyz * uGasA.w;
    vec3 inv = 1.0 / rd;
    vec3 t0 = (lo - eye) * inv;
    vec3 t1 = (hi - eye) * inv;
    vec3 tmn = min(t0, t1);
    vec3 tmx = max(t0, t1);
    float ta = max(max(tmn.x, tmn.y), max(tmn.z, 0.0));
    float tb = min(min(tmx.x, tmx.y), tmx.z);
    if (tb > ta) {
      int N = int(uGasD.z);
      float ds = (tb - ta) / float(N);
      float trans = 1.0;
      vec3 acc = vec3(0.0);
      for (int k = 0; k < 96; k++) {
        if (k >= N || trans < 0.01) break;
        vec3 p = eye + rd * (ta + (float(k) + 0.5) * ds);
        vec4 g = gasSample((p - lo) / uGasA.w);
        float sigma = g.r * uGasD.x;
        // flame: glows where fuel burns hot
        // glowing soot: bright by temperature; blue where fuel meets air
        float heat = max(g.g, 0.0);
        vec3 e = flameRamp(clamp(heat * 0.22, 0.0, 1.0)) * uGasD.y * heat * smoothstep(0.005, 0.08, g.b);
        e += vec3(0.12, 0.3, 1.0) * uGasD.y * 0.25 * g.b * (1.0 - smoothstep(0.3, 1.2, heat));
        float light = uGasD.w * (0.55 + 0.45 * clamp(1.0 - gasSample((p - lo) / uGasA.w + vec3(0.0, 2.0, 0.0)).r * uGasD.x * uGasA.w * 6.0, 0.0, 1.0));
        acc += trans * (e + uGasC.rgb * light * sigma) * ds;
        trans *= exp(-sigma * ds);
      }
      col = col * trans + acc;
    }
  }
  // The second grid (a flame's fine grid, or the smoke's).
  if (uGas2C.w > 0.5) {
    vec3 lo = uGas2A.xyz;
    vec3 hi = uGas2A.xyz + uGas2B.xyz * uGas2A.w;
    vec3 inv = 1.0 / rd;
    vec3 t0 = (lo - eye) * inv;
    vec3 t1 = (hi - eye) * inv;
    vec3 tmn = min(t0, t1);
    vec3 tmx = max(t0, t1);
    float ta = max(max(tmn.x, tmn.y), max(tmn.z, 0.0));
    float tb = min(min(tmx.x, tmx.y), tmx.z);
    if (tb > ta) {
      int N = int(uGas2D.z);
      float ds = (tb - ta) / float(N);
      float trans = 1.0;
      vec3 acc = vec3(0.0);
      for (int k = 0; k < 96; k++) {
        if (k >= N || trans < 0.01) break;
        vec3 p = eye + rd * (ta + (float(k) + 0.5) * ds);
        vec4 g = gas2Sample((p - lo) / uGas2A.w);
        float sigma = g.r * uGas2D.x;
        // flame: glows where fuel burns hot
        float heat = max(g.g, 0.0);
        vec3 e = flameRamp(clamp(heat * 0.22, 0.0, 1.0)) * uGas2D.y * heat * smoothstep(0.005, 0.08, g.b);
        e += vec3(0.12, 0.3, 1.0) * uGas2D.y * 0.25 * g.b * (1.0 - smoothstep(0.3, 1.2, heat));
        float light = uGas2D.w * (0.55 + 0.45 * clamp(1.0 - gas2Sample((p - lo) / uGas2A.w + vec3(0.0, 2.0, 0.0)).r * uGas2D.x * uGas2A.w * 6.0, 0.0, 1.0));
        acc += trans * (e + uGas2C.rgb * light * sigma) * ds;
        trans *= exp(-sigma * ds);
      }
      col = col * trans + acc;
    }
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

// WGSL version of the same shading.
const COMPOSITE_FS_W = /* wgsl */ `
varying uv0: vec2f;
var uScene: texture_2d<f32>;
var uSceneSampler: sampler;
var uDepth: texture_2d<uff>;
var uThick: texture_2d<uff>;
uniform uInvProj: mat4x4f;
uniform uViewToToy: mat4x4f;
uniform uToyToView: mat4x4f;
uniform uDepthSize: vec2f;
uniform uColor: vec4f;
uniform uAbsorb: vec4f;
uniform uLight: vec4f;
uniform uGlassA: vec4f;
uniform uGlassB: vec4f;
uniform uMisc: vec4f;
uniform uFoam: vec4f;
var uGas: texture_2d<uff>;
uniform uGasA: vec4f;
uniform uGasB: vec4f;
uniform uGasC: vec4f;
uniform uGasD: vec4f;
fn gasTexel(c: vec3i) -> vec2i {
  let nx = i32(uniform.uGasB.x);
  let ny = i32(uniform.uGasB.y);
  let tw = i32(uniform.uGasB.w);
  let tz = c.z / tw;
  return vec2i((c.z - tz * tw) * nx + c.x, tz * ny + c.y);
}
fn gasFetch(c0: vec3i) -> vec4f {
  let c = clamp(c0, vec3i(0), vec3i(uniform.uGasB.xyz) - vec3i(1));
  return textureLoad(uGas, gasTexel(c), 0);
}
fn gasSample(p0: vec3f) -> vec4f {
  let p = clamp(p0 - 0.5, vec3f(0.0), uniform.uGasB.xyz - 1.0);
  let f = fract(p);
  let i = vec3i(floor(p));
  let a = mix(gasFetch(i), gasFetch(i + vec3i(1, 0, 0)), f.x);
  let b = mix(gasFetch(i + vec3i(0, 1, 0)), gasFetch(i + vec3i(1, 1, 0)), f.x);
  let c = mix(gasFetch(i + vec3i(0, 0, 1)), gasFetch(i + vec3i(1, 0, 1)), f.x);
  let d = mix(gasFetch(i + vec3i(0, 1, 1)), gasFetch(i + vec3i(1, 1, 1)), f.x);
  // soft edges: the grid's box never shows (the top thins away over its last quarter)
  let m = min(p0, uniform.uGasB.xyz - p0);
  let edge = smoothstep(0.0, 3.0, min(m.x, m.z)) * smoothstep(0.0, 0.25 * uniform.uGasB.y, uniform.uGasB.y - p0.y);
  return mix(mix(a, b, f.y), mix(c, d, f.y), f.z) * edge;
}
var uGas2: texture_2d<uff>;
uniform uGas2A: vec4f;
uniform uGas2B: vec4f;
uniform uGas2C: vec4f;
uniform uGas2D: vec4f;
fn gas2Texel(c: vec3i) -> vec2i {
  let nx = i32(uniform.uGas2B.x);
  let ny = i32(uniform.uGas2B.y);
  let tw = i32(uniform.uGas2B.w);
  let tz = c.z / tw;
  return vec2i((c.z - tz * tw) * nx + c.x, tz * ny + c.y);
}
fn gas2Fetch(c0: vec3i) -> vec4f {
  let c = clamp(c0, vec3i(0), vec3i(uniform.uGas2B.xyz) - vec3i(1));
  return textureLoad(uGas2, gas2Texel(c), 0);
}
fn gas2Sample(p0: vec3f) -> vec4f {
  let p = clamp(p0 - 0.5, vec3f(0.0), uniform.uGas2B.xyz - 1.0);
  let f = fract(p);
  let i = vec3i(floor(p));
  let a = mix(gas2Fetch(i), gas2Fetch(i + vec3i(1, 0, 0)), f.x);
  let b = mix(gas2Fetch(i + vec3i(0, 1, 0)), gas2Fetch(i + vec3i(1, 1, 0)), f.x);
  let c = mix(gas2Fetch(i + vec3i(0, 0, 1)), gas2Fetch(i + vec3i(1, 0, 1)), f.x);
  let d = mix(gas2Fetch(i + vec3i(0, 1, 1)), gas2Fetch(i + vec3i(1, 1, 1)), f.x);
  // soft edges: the grid's box never shows (the top thins away over its last quarter)
  let m = min(p0, uniform.uGas2B.xyz - p0);
  let edge = smoothstep(0.0, 3.0, min(m.x, m.z)) * smoothstep(0.0, 0.25 * uniform.uGas2B.y, uniform.uGas2B.y - p0.y);
  return mix(mix(a, b, f.y), mix(c, d, f.y), f.z) * edge;
}
fn flameRamp(t: f32) -> vec3f {
  var c = mix(vec3f(0.5, 0.08, 0.02), vec3f(1.0, 0.45, 0.08), smoothstep(0.1, 0.35, t));
  c = mix(c, vec3f(1.0, 0.82, 0.45), smoothstep(0.35, 0.6, t));
  c = mix(c, vec3f(1.0, 0.97, 0.88), smoothstep(0.6, 0.9, t));
  return c;
}

fn flipUv(uv: vec2f) -> vec2f { return vec2f(uv.x, 1.0 - uv.y); }
fn loadTex(t: texture_2d<f32>, uv: vec2f) -> vec4f {
  let size = vec2f(textureDimensions(t, 0));
  let q = clamp(vec2i(flipUv(uv) * size), vec2i(0), vec2i(size) - vec2i(1));
  return textureLoad(t, q, 0);
}
fn sampleDepth(uv: vec2f) -> f32 {
  let size = vec2f(textureDimensions(uDepth, 0));
  let q = clamp(vec2i(flipUv(uv) * size), vec2i(0), vec2i(size) - vec2i(1));
  return textureLoad(uDepth, q, 0).r;
}
fn thickAll(uv: vec2f) -> vec4f {
  let size = vec2f(textureDimensions(uThick, 0));
  let p = flipUv(uv) * size - 0.5;
  let i = vec2i(floor(p));
  let f = fract(p);
  let m = vec2i(size) - vec2i(1);
  let a = textureLoad(uThick, clamp(i, vec2i(0), m), 0);
  let b = textureLoad(uThick, clamp(i + vec2i(1, 0), vec2i(0), m), 0);
  let c = textureLoad(uThick, clamp(i + vec2i(0, 1), vec2i(0), m), 0);
  let d = textureLoad(uThick, clamp(i + vec2i(1, 1), vec2i(0), m), 0);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
fn viewPos(uv: vec2f, d: f32) -> vec3f {
  let r = uniform.uInvProj * vec4f(uv * 2.0 - 1.0, 1.0, 1.0);
  let dir = r.xyz / r.w;
  return dir * (d / -dir.z);
}
fn sky(dirToy: vec3f) -> vec3f {
  let t = clamp(dirToy.y * 0.5 + 0.5, 0.0, 1.0);
  var c = mix(vec3f(0.20, 0.19, 0.18), vec3f(0.95, 0.97, 1.0), smoothstep(0.35, 0.9, t));
  c += vec3f(0.6) * smoothstep(0.93, 0.99, t);
  return c;
}
fn hitCyl(o: vec3f, d: vec3f, c: vec3f, r: f32) -> vec2f {
  let oc = o.xz - c.xz;
  let a = dot(d.xz, d.xz);
  let b = dot(oc, d.xz);
  let k = dot(oc, oc) - r * r;
  var h = b * b - a * k;
  if (h < 0.0 || a < 1e-8) { return vec2f(1e9, -1e9); }
  h = sqrt(h);
  return vec2f((-b - h) / a, (-b + h) / a);
}
fn fresnel(cosT: f32, f0: f32) -> f32 {
  return f0 + (1.0 - f0) * pow(1.0 - clamp(cosT, 0.0, 1.0), 5.0);
}
@fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let uv0 = input.uv0;
  let scene = textureSampleLevel(uScene, uSceneSampler, flipUv(uv0), 0.0).rgb;
  var col = scene;
  let pv = viewPos(uv0, 1.0);
  let eye = (uniform.uViewToToy * vec4f(0.0, 0.0, 0.0, 1.0)).xyz;
  let rd = normalize((uniform.uViewToToy * vec4f(normalize(pv), 0.0)).xyz);
  let L = normalize(uniform.uLight.xyz);

  var tFront = 1e9;
  var tBack = 1e9;
  var nFront = vec3f(0.0);
  if (uniform.uGlassB.w > 0.5) {
    let c = uniform.uGlassA.xyz;
    let rOut = uniform.uGlassA.w + uniform.uGlassB.y;
    let o = hitCyl(eye, rd, c, rOut);
    let y0 = c.y;
    let y1 = c.y + uniform.uGlassB.x;
    if (o.x < 1e8) {
      let ya = eye.y + rd.y * o.x;
      if (ya > y0 && ya < y1) { tFront = o.x; let p = eye + rd * o.x; nFront = normalize(vec3f(p.x - c.x, 0.0, p.z - c.z)); }
      let yb = eye.y + rd.y * o.y;
      if (yb > y0 && yb < y1) { tBack = o.y; }
    }
  }

  var d = 0.0;
  if (uniform.uMisc.y > 0.5) { d = sampleDepth(uv0); }
  if (d > 0.0) {
    let px = 1.0 / uniform.uDepthSize;
    let P = viewPos(uv0, d);
    let dr = sampleDepth(uv0 + vec2f(px.x, 0.0));
    let dl = sampleDepth(uv0 - vec2f(px.x, 0.0));
    let du = sampleDepth(uv0 + vec2f(0.0, px.y));
    let dd = sampleDepth(uv0 - vec2f(0.0, px.y));
    var ddx = vec3f(1e9);
    if (dr > 0.0) { ddx = viewPos(uv0 + vec2f(px.x, 0.0), dr) - P; }
    var ddx2 = vec3f(1e9);
    if (dl > 0.0) { ddx2 = P - viewPos(uv0 - vec2f(px.x, 0.0), dl); }
    if (abs(ddx2.z) < abs(ddx.z)) { ddx = ddx2; }
    var ddy = vec3f(1e9);
    if (du > 0.0) { ddy = viewPos(uv0 + vec2f(0.0, px.y), du) - P; }
    var ddy2 = vec3f(1e9);
    if (dd > 0.0) { ddy2 = P - viewPos(uv0 - vec2f(0.0, px.y), dd); }
    if (abs(ddy2.z) < abs(ddy.z)) { ddy = ddy2; }
    var nV = normalize(cross(ddx, ddy));
    if (dot(nV, P) > 0.0) { nV = -nV; }
    var n = normalize((uniform.uViewToToy * vec4f(nV, 0.0)).xyz);
    if (uniform.uGlassB.w > 0.5) {
      let Pt = (uniform.uViewToToy * vec4f(P, 1.0)).xyz;
      let rr = Pt.xz - uniform.uGlassA.xz;
      let rl = length(rr);
      if (rl > uniform.uGlassA.w - uniform.uMisc.z && n.y < 0.6 && Pt.y < uniform.uGlassA.y + uniform.uGlassB.x) {
        n = vec3f(rr.x, 0.0, rr.y) / max(rl, 1e-5);
        nV = normalize((uniform.uToyToView * vec4f(n, 0.0)).xyz);
      }
    }
    let V = -rd;
    let thick = thickAll(uv0).r;
    let off = nV.xy * uniform.uMisc.x * clamp(thick * 4.0, 0.0, 1.0);
    let behind = textureSampleLevel(uScene, uSceneSampler, flipUv(clamp(uv0 - off, vec2f(0.001), vec2f(0.999))), 0.0).rgb;
    let T = exp(-uniform.uAbsorb.rgb * thick);
    let lit = uniform.uColor.rgb * (0.35 + 0.65 * max(dot(n, L), 0.0));
    let body = mix(behind * T + uniform.uColor.rgb * (1.0 - T) * 0.25, lit, uniform.uColor.a);
    let F = fresnel(dot(n, V), 0.02);
    let refl = sky(reflect(-V, n));
    let H = normalize(L + V);
    let spec = pow(max(dot(n, H), 0.0), 180.0) * 1.6;
    var liq = mix(body, refl, F) + spec + uniform.uColor.rgb * uniform.uAbsorb.a;
    // Bubbles inside: bright specks, tinted by the liquid around them.
    let bub = clamp(thickAll(uv0).b * 1.2, 0.0, 1.0) * uniform.uFoam.w;
    liq = mix(liq, mix(uniform.uColor.rgb, vec3f(1.0), 0.6) * (0.65 + 0.35 * max(dot(n, L), 0.0)) + vec3f(0.08), bub * 0.75);
    let a = clamp(thick * 60.0, 0.0, 1.0);
    col = mix(col, liq, a);
  }
  // Foam and spray over the liquid.
  if (uniform.uFoam.w > 0.5) {
    let fo = clamp(thickAll(uv0).g * 1.4, 0.0, 1.0);
    col = mix(col, uniform.uFoam.rgb, fo);
  }

  if (tBack < 1e8) {
    let F2 = fresnel(abs(dot(rd, normalize(vec3f(eye.x - uniform.uGlassA.x, 0.0, eye.z - uniform.uGlassA.z)))), 0.04);
    col = mix(col, sky(rd), 0.06 * F2);
  }
  if (tFront < 1e8) {
    let cosT = abs(dot(rd, nFront));
    let F = fresnel(cosT, 0.04);
    let refl = sky(reflect(rd, nFront));
    col = col * vec3f(0.97, 0.985, 0.98);
    col = mix(col, refl, F);
    let H = normalize(L - rd);
    col += vec3f(pow(max(dot(nFront, H), 0.0), 120.0) * 0.8);
    col = mix(col, vec3f(0.92), smoothstep(0.25, 0.05, cosT) * 0.5);
  }
  if (uniform.uGasC.w > 0.5) {
    let lo = uniform.uGasA.xyz;
    let hi = uniform.uGasA.xyz + uniform.uGasB.xyz * uniform.uGasA.w;
    let inv = 1.0 / rd;
    let t0 = (lo - eye) * inv;
    let t1 = (hi - eye) * inv;
    let tmn = min(t0, t1);
    let tmx = max(t0, t1);
    let ta = max(max(tmn.x, tmn.y), max(tmn.z, 0.0));
    let tb = min(min(tmx.x, tmx.y), tmx.z);
    if (tb > ta) {
      let N = i32(uniform.uGasD.z);
      let ds = (tb - ta) / f32(N);
      var trans = 1.0;
      var acc = vec3f(0.0);
      for (var k = 0; k < 96; k++) {
        if (k >= N || trans < 0.01) { break; }
        let p = eye + rd * (ta + (f32(k) + 0.5) * ds);
        let g = gasSample((p - lo) / uniform.uGasA.w);
        let sigma = g.r * uniform.uGasD.x;
        let heat = max(g.g, 0.0);
        var e = flameRamp(clamp(heat * 0.22, 0.0, 1.0)) * uniform.uGasD.y * heat * smoothstep(0.005, 0.08, g.b);
        e += vec3f(0.12, 0.3, 1.0) * uniform.uGasD.y * 0.25 * g.b * (1.0 - smoothstep(0.3, 1.2, heat));
        let light = uniform.uGasD.w * (0.55 + 0.45 * clamp(1.0 - gasSample((p - lo) / uniform.uGasA.w + vec3f(0.0, 2.0, 0.0)).r * uniform.uGasD.x * uniform.uGasA.w * 6.0, 0.0, 1.0));
        acc += trans * (e + uniform.uGasC.rgb * light * sigma) * ds;
        trans *= exp(-sigma * ds);
      }
      col = col * trans + acc;
    }
  }
  if (uniform.uGas2C.w > 0.5) {
    let lo = uniform.uGas2A.xyz;
    let hi = uniform.uGas2A.xyz + uniform.uGas2B.xyz * uniform.uGas2A.w;
    let inv = 1.0 / rd;
    let t0 = (lo - eye) * inv;
    let t1 = (hi - eye) * inv;
    let tmn = min(t0, t1);
    let tmx = max(t0, t1);
    let ta = max(max(tmn.x, tmn.y), max(tmn.z, 0.0));
    let tb = min(min(tmx.x, tmx.y), tmx.z);
    if (tb > ta) {
      let N = i32(uniform.uGas2D.z);
      let ds = (tb - ta) / f32(N);
      var trans = 1.0;
      var acc = vec3f(0.0);
      for (var k = 0; k < 96; k++) {
        if (k >= N || trans < 0.01) { break; }
        let p = eye + rd * (ta + (f32(k) + 0.5) * ds);
        let g = gas2Sample((p - lo) / uniform.uGas2A.w);
        let sigma = g.r * uniform.uGas2D.x;
        let heat = max(g.g, 0.0);
        var e = flameRamp(clamp(heat * 0.22, 0.0, 1.0)) * uniform.uGas2D.y * heat * smoothstep(0.005, 0.08, g.b);
        e += vec3f(0.12, 0.3, 1.0) * uniform.uGas2D.y * 0.25 * g.b * (1.0 - smoothstep(0.3, 1.2, heat));
        let light = uniform.uGas2D.w * (0.55 + 0.45 * clamp(1.0 - gas2Sample((p - lo) / uniform.uGas2A.w + vec3f(0.0, 2.0, 0.0)).r * uniform.uGas2D.x * uniform.uGas2A.w * 6.0, 0.0, 1.0));
        acc += trans * (e + uniform.uGas2C.rgb * light * sigma) * ds;
        trans *= exp(-sigma * ds);
      }
      col = col * trans + acc;
    }
  }
  output.color = vec4f(col, 1.0);
  return output;
}
`;

const ADD = new pc.BlendState(true, pc.BLENDEQUATION_ADD, pc.BLENDMODE_ONE, pc.BLENDMODE_ONE, pc.BLENDEQUATION_ADD, pc.BLENDMODE_ONE, pc.BLENDMODE_ONE); // prettier-ignore

// A render pass that draws the unit quad `count` times (instanced).
class SpritePass extends pc.RenderPass {
  constructor(device, shader) {
    super(device);
    this.quad = new pc.QuadRender(shader);
    this.count = 0;
    this.blendState = pc.BlendState.NOBLEND;
    this.depthState = pc.DepthState.DEFAULT;
  }
  execute() {
    if (!this.count) return;
    this.device.setDrawStates(this.blendState, this.depthState, pc.CULLFACE_NONE);
    this.quad.render(null, null, this.count);
  }
  destroy() {
    this.quad.destroy();
    super.destroy?.();
  }
}

function shader(device, name, vs, fs, vsw, fsw) {
  return pc.ShaderUtils.createShader(device, {
    uniqueName: `flSurface-${name}`,
    attributes: { aPosition: pc.SEMANTIC_POSITION },
    vertexGLSL: vs,
    fragmentGLSL: fs,
    vertexWGSL: vsw,
    fragmentWGSL: fsw,
  });
}

function quadPass(device, sh, target) {
  const p = new pc.RenderPassShaderQuad(device);
  p.shader = sh;
  p.init(target);
  p.colorOps.clear = false;
  p.depthStencilOps.clearDepth = false;
  return p;
}

const tmpM = new pc.Mat4();

export class FluidSurface {
  // scale: resolution of the depth passes relative to the canvas.
  constructor(device, { scale = 0.5 } = {}) {
    this.device = device;
    this.scale = scale;
    const floatOk = device.textureFloatRenderable;
    this.depthFormat = floatOk ? pc.PIXELFORMAT_R32F : pc.PIXELFORMAT_RGBA16F;
    this.sh = {
      depth: shader(device, "depth", SPRITE_VS, DEPTH_FS, SPRITE_VS_W, DEPTH_FS_W),
      thick: shader(device, "thick", SPRITE_VS, THICK_FS, SPRITE_VS_W, THICK_FS_W),
      diff: shader(device, "diff", DIFF_VS, DIFF_FS, DIFF_VS_W, DIFF_FS_W),
      blur: shader(device, "blur", QUAD_VS, BLUR_FS, QUAD_VS_W, BLUR_FS_W),
      comp: shader(device, "comp", QUAD_VS, COMPOSITE_FS, QUAD_VS_W, COMPOSITE_FS_W),
    };
    this.depthPass = new SpritePass(device, this.sh.depth);
    this.thickPass = new SpritePass(device, this.sh.thick);
    this.thickPass.blendState = ADD;
    this.thickPass.depthState = pc.DepthState.NODEPTH;
    this.diffPass = new SpritePass(device, this.sh.diff);
    this.diffPass.blendState = ADD;
    this.diffPass.depthState = pc.DepthState.NODEPTH;
    this.size = [0, 0];
    this.params = {
      color: [0.75, 0.87, 0.95, 0.0],
      absorb: [0.9, 0.35, 0.18, 0.0],
      light: [0.4, 0.9, 0.35, 0],
      glassA: [0, 0, 0, 0],
      glassB: [0, 0, 0, 0],
      refract: 0.035,
      foam: [0.95, 0.96, 0.97],
    };
    this.stats = { ms: 0 };
  }

  tex(w, h, format, name) {
    return new pc.Texture(this.device, {
      name,
      width: w,
      height: h,
      format,
      mipmaps: false,
      minFilter: pc.FILTER_NEAREST,
      magFilter: pc.FILTER_NEAREST,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: pc.ADDRESS_CLAMP_TO_EDGE,
    });
  }

  resize() {
    const d = this.device;
    const W = d.width;
    const H = d.height;
    const w = Math.max(1, Math.round(W * this.scale));
    const h = Math.max(1, Math.round(H * this.scale));
    if (this.size[0] === w && this.size[1] === h && this.full?.[0] === W && this.full?.[1] === H)
      return;
    this.destroyTargets();
    this.size = [w, h];
    this.full = [W, H];
    this.depthA = this.tex(w, h, this.depthFormat, "flDepthA");
    this.depthB = this.tex(w, h, this.depthFormat, "flDepthB");
    this.thick = this.tex(w, h, pc.PIXELFORMAT_RGBA16F, "flThick");
    this.scene = new pc.Texture(d, {
      name: "flScene",
      width: W,
      height: H,
      format: d.backBufferFormat ?? pc.PIXELFORMAT_RGBA8,
      mipmaps: false,
      minFilter: pc.FILTER_LINEAR,
      magFilter: pc.FILTER_LINEAR,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: pc.ADDRESS_CLAMP_TO_EDGE,
    });
    this.rtDepthA = new pc.RenderTarget({ colorBuffer: this.depthA, depth: true });
    this.rtDepthB = new pc.RenderTarget({ colorBuffer: this.depthB, depth: false });
    this.rtThick = new pc.RenderTarget({ colorBuffer: this.thick, depth: false });
    this.rtScene = new pc.RenderTarget({ colorBuffer: this.scene, depth: false });
    this.depthPass.init(this.rtDepthA);
    this.depthPass.setClearColor(new pc.Color(0, 0, 0, 0));
    this.depthPass.setClearDepth(1);
    this.thickPass.init(this.rtThick);
    this.thickPass.setClearColor(new pc.Color(0, 0, 0, 0));
    this.diffPass.init(this.rtThick);
    this.blurH = quadPass(d, this.sh.blur, this.rtDepthB);
    this.blurV = quadPass(d, this.sh.blur, this.rtDepthA);
    this.comp = quadPass(d, this.sh.comp, null);
  }

  destroyTargets() {
    for (const k of ["rtDepthA", "rtDepthB", "rtThick", "rtScene"]) this[k]?.destroy();
    for (const k of ["depthA", "depthB", "thick", "scene"]) this[k]?.destroy();
    for (const k of ["blurH", "blurV", "comp"]) this[k]?.destroy?.();
  }

  // Draws the liquid over the frame. src: { texture, texWidth, count,
  // simToToy (pc.Mat4), radius (toy units) }; view: { camera (pc.CameraComponent),
  // toyToWorld (pc.Mat4) }.
  render(src, view) {
    const t0 = performance.now();
    const d = this.device;
    this.resize();
    const scope = d.scope;
    const cam = view.camera;
    const viewM = cam.viewMatrix;
    const proj = cam.projectionMatrix;
    const toyToView = new pc.Mat4().mul2(viewM, view.toyToWorld);
    const simToView = new pc.Mat4().mul2(toyToView, src.simToToy || pc.Mat4.IDENTITY);
    const viewToToy = new pc.Mat4().copy(toyToView).invert();
    const invProj = tmpM.copy(proj).invert();
    // World scale of the toy (uniform scale assumed), for radii in view space.
    const toyScale = view.toyToWorld.getScale(new pc.Vec3()).x;
    const radius = src.radius * toyScale;
    const count = src.count | 0;
    const liquid = count > 0 && src.texture;

    d.copyRenderTarget(null, this.rtScene, true, false);
    if (liquid) {
      scope.resolve("uParticles").setValue(src.texture);
      scope.resolve("uTexWidth").setValue(src.texWidth);
      scope.resolve("uSimToView").setValue(simToView.data);
      scope.resolve("uProj").setValue(proj.data);
      scope.resolve("uRadius").setValue(radius);
      scope.resolve("uFar").setValue(cam.farClip);
      const projY = proj.data[5] * this.size[1] * 0.5;
      scope.resolve("uMinPx").setValue([1.6, projY]);
      // velocities are cells/s; a sixtieth of a second of travel
      scope.resolve("uStretch").setValue([1 / 60, src.velRow ?? 0]);
      this.depthPass.count = count;
      this.depthPass.render();
      this.thickPass.count = count;
      this.thickPass.render();
      // Foam, spray and bubbles (grid units, as the liquid).
      const df = src.diffuse;
      if (df?.n) {
        const k = toyScale * src.cell;
        scope.resolve("uDiffuse").setValue(df.texture);
        scope.resolve("uDiffR").setValue([0.3 * k, 0.55 * k, 0.22 * k, 0]);
        this.diffPass.count = df.n;
        this.diffPass.render();
      }
      scope.resolve("uWorldR").setValue(radius * 3.5);
      scope.resolve("uProjY").setValue(projY);
      scope.resolve("uEdge").setValue(radius * 3);
      // Twice over: one pass leaves each particle's bump as a speck of light.
      for (let k = 0; k < (this.blurPasses ?? 2); k++) {
        scope.resolve("uSrc").setValue(this.depthA);
        scope.resolve("uDir").setValue([1 / this.size[0], 0]);
        this.blurH.render();
        scope.resolve("uSrc").setValue(this.depthB);
        scope.resolve("uDir").setValue([0, 1 / this.size[1]]);
        this.blurV.render();
      }
    }
    const p = this.params;
    scope.resolve("uScene").setValue(this.scene);
    scope.resolve("uDepth").setValue(this.depthA);
    scope.resolve("uThick").setValue(this.thick);
    scope.resolve("uInvProj").setValue(invProj.data);
    scope.resolve("uViewToToy").setValue(viewToToy.data);
    scope.resolve("uToyToView").setValue(toyToView.data);
    scope.resolve("uDepthSize").setValue(this.size);
    scope.resolve("uColor").setValue(p.color);
    // Absorption per toy unit -> per view unit.
    scope.resolve("uAbsorb").setValue([p.absorb[0] / toyScale, p.absorb[1] / toyScale, p.absorb[2] / toyScale, p.absorb[3]]); // prettier-ignore
    scope.resolve("uLight").setValue(p.light);
    scope.resolve("uGlassA").setValue(p.glassA);
    scope.resolve("uGlassB").setValue(p.glassB);
    scope.resolve("uMisc").setValue([p.refract, liquid ? 1 : 0, 2.5 * (src.cell || 0), 0]);
    scope.resolve("uFoam").setValue([...p.foam, liquid && src.diffuse?.n ? 1 : 0]);
    // Up to two gas grids (gasscene.js: a flame's fine grid and the smoke's).
    const gases = src.gas || [];
    for (const [k, name] of [
      [0, "uGas"],
      [1, "uGas2"],
    ]) {
      const gas = gases[k];
      scope.resolve(name).setValue(gas ? gas.grid.scalars : this.blankGas());
      scope.resolve(`${name}A`).setValue(gas ? [...gas.grid.lo, gas.grid.cell] : [0, 0, 0, 1]);
      scope.resolve(`${name}B`).setValue(gas ? [...gas.grid.dims, gas.grid.tilesX] : [1, 1, 1, 1]);
      scope.resolve(`${name}C`).setValue(gas ? [...gas.color, 1] : [0, 0, 0, 0]);
      scope
        .resolve(`${name}D`)
        .setValue(gas ? [gas.density, gas.flame, gas.steps, gas.light] : [0, 0, 0, 0]);
    }
    this.comp.render();
    this.stats.ms = performance.now() - t0;
  }

  blankGas() {
    this.blank ||= this.tex(1, 1, pc.PIXELFORMAT_RGBA16F, "flGasBlank");
    return this.blank;
  }

  destroy() {
    this.blank?.destroy();
    this.destroyTargets();
    this.depthPass.destroy();
    this.thickPass.destroy();
    this.diffPass.destroy();
    for (const s of Object.values(this.sh)) s.destroy();
  }
}

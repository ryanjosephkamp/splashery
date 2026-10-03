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
  vec3 v0 = texelFetch(uParticles, q + ivec2(0, int(uStretch.y)), 0).xyz;
  vec3 vel = (uSimToView * vec4(v0, 0.0)).xyz;
  float sl = length(vel.xy);
  // a falling stream (straight down) is drawn twice as long as a splash's
  // flying pieces, which would smear into streaks
  float down = pow(clamp(-v0.y / max(length(v0), 1e-6), 0.0, 1.0), 4.0);
  float L = min(sl * uStretch.x * (1.0 + down), (10.0 + 14.0 * down) * r);
  vec2 dir = sl > 1e-6 ? vel.xy / sl : vec2(1.0, 0.0);
  // stretched, it narrows as a thinning stream does (its cross-section keeps
  // the particle's volume)
  float sq = sqrt(r / (r + 0.5 * L));
  vec2 off = dir * aPosition.x * (r + 0.5 * L) + vec2(-dir.y, dir.x) * aPosition.y * r * sq;
  vec3 corner = vp.xyz + vec3(off, 0.0);
  vec4 c = uProj * vec4(corner, 1.0);
  gl_Position = vec4(c.xy, 0.5 * c.w, c.w);
  vUv = aPosition;
  vCenter = vp.xyz;
  vR = r;
  vS = sq;
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
uniform uHeat: vec4f;
varying vUv: vec2f;
varying vCenter: vec3f;
varying vR: f32;
varying vS: f32;
varying vH: f32;
@vertex fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let i = i32(input.instanceIndex);
  let w = i32(uniform.uTexWidth);
  let q = vec2i(i % w, i / w);
  let p = textureLoad(uParticles, q, 0);
  let vp = uniform.uSimToView * vec4f(p.xyz, 1.0);
  let r = max(uniform.uRadius, uniform.uMinPx.x * max(-vp.z, 1e-3) / uniform.uMinPx.y);
  let v4 = textureLoad(uParticles, q + vec2i(0, i32(uniform.uStretch.y)), 0);
  let v0 = v4.xyz;
  // a lava's heat: it cools with the time since it left the nozzle (w)
  output.vH = exp(-v4.w * uniform.uHeat.x);
  let vel = (uniform.uSimToView * vec4f(v0, 0.0)).xyz;
  let sl = length(vel.xy);
  let down = pow(clamp(-v0.y / max(length(v0), 1e-6), 0.0, 1.0), 4.0);
  let L = min(sl * uniform.uStretch.x * (1.0 + down), (10.0 + 14.0 * down) * r);
  var dir = vec2f(1.0, 0.0);
  if (sl > 1e-6) { dir = vel.xy / sl; }
  let sq = sqrt(r / (r + 0.5 * L));
  let off = dir * input.aPosition.x * (r + 0.5 * L) + vec2f(-dir.y, dir.x) * input.aPosition.y * r * sq;
  let corner = vp.xyz + vec3f(off, 0.0);
  let c = uniform.uProj * vec4f(corner, 1.0);
  output.position = vec4f(c.xy, 0.5 * c.w, c.w);
  output.vUv = input.aPosition;
  output.vCenter = vp.xyz;
  output.vR = r;
  output.vS = sq;
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
varying vH: f32;
@fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let r2 = dot(input.vUv, input.vUv);
  if (r2 > 1.0) { discard; }
  let d = -(input.vCenter.z + sqrt(1.0 - r2) * input.vR);
  // (g: the front particle's heat; the depth test keeps the front one)
  output.color = vec4f(d, input.vH, 0.0, 1.0);
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
varying vH: f32;
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
fn texel2(uv: vec2f) -> vec2f {
  let size = vec2f(textureDimensions(uSrc, 0));
  let q = clamp(vec2i(vec2f(uv.x, 1.0 - uv.y) * size), vec2i(0), vec2i(size) - vec2i(1));
  return textureLoad(uSrc, q, 0).rg;
}
@fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let c0 = texel2(input.uv0);
  let d0 = c0.x;
  if (d0 <= 0.0) { output.color = vec4f(0.0); return output; }
  let rpx = clamp(uniform.uWorldR * uniform.uProjY / d0, 4.0, 24.0);
  let stp = rpx / 8.0;
  let edge = max(uniform.uEdge, 5.0 * d0 / uniform.uProjY);
  var sum = d0;
  var hsum = c0.y;
  var wsum = 1.0;
  for (var k = 1; k <= 8; k++) {
    let x = f32(k) * stp;
    let ws = exp(-2.0 * f32(k * k) / 64.0);
    for (var s = -1; s <= 1; s += 2) {
      let c = texel2(input.uv0 + uniform.uDir * x * f32(s));
      let d = c.x;
      if (d <= 0.0) { continue; }
      let dz = (d - d0) / edge;
      let w = ws * exp(-dz * dz);
      sum += d * w;
      hsum += c.y * w;
      wsum += w;
    }
  }
  // (g: the heat, smoothed with the depth so a crust's edge is soft)
  output.color = vec4f(sum / wsum, hsum / wsum, 0.0, 1.0);
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
uniform vec2 uDrop;        // x how much a drop in flight lights up, y one drop's thickness
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
  c = mix(c, vec3(1.0, 0.76, 0.32), smoothstep(0.35, 0.65, t));
  c = mix(c, vec3(1.0, 0.95, 0.82), smoothstep(0.75, 1.0, t));
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
  // what of the glass's lines lies behind the liquid shows only through it
  float liqZ = 1e9;
  float liqT = 1.0;
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
    // (the room seen through the liquid: the frame behind it carries only what
    // is on screen, so a clear drop against a dark background would vanish;
    // the same soft studio as the reflections lights it from around)
    vec3 rr = refract(rd, n, 0.75);
    vec3 room = sky(dot(rr, rr) > 0.0 ? rr : reflect(rd, n)) * 0.3;
    vec3 body = mix((behind + room) * T + uColor.rgb * (1.0 - T) * 0.25, lit, uColor.a);
    float F = fresnel(dot(n, V), 0.02);
    vec3 refl = sky(reflect(-V, n));
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(n, H), 0.0), 180.0) * 1.6;
    vec3 liq = mix(body, refl, F) + spec + uColor.rgb * uAbsorb.a;
    // A drop in flight is a small lens: it shows the bright room above,
    // flipped, and a highlight (the splash's crown and its drops; src.drops).
    float thin = uDrop.x * (1.0 - smoothstep(uDrop.y, 4.0 * uDrop.y, thick));
    liq = mix(liq, sky(normalize(vec3(n.x, 1.0, n.z))) * 0.75 + spec, thin);
    // Bubbles inside: bright specks, tinted by the liquid around them.
    float bub = clamp(thickAll(uv0).b * 1.2, 0.0, 1.0) * uFoam.w;
    liq = mix(liq, mix(uColor.rgb, vec3(1.0), 0.6) * (0.65 + 0.35 * max(dot(n, L), 0.0)) + 0.08, bub * 0.75);
    float a = clamp(thick * 200.0, 0.0, 1.0);
    liqZ = -P.z;
    liqT = mix(1.0, dot(T, vec3(0.333)), a);
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
    // edge lines where the ray grazes the wall (silhouette): crisp
    col = mix(col, vec3(0.95), smoothstep(0.12, 0.02, cosT) * 0.85);
  }
  // The rim and the foot as clean lines a pixel or so wide (the owner: "it's
  // kind of hard to discern the rim of the glass"): the rim's outer and inner
  // edges and its top face, and the foot's edge on the table.
  if (uGlassB.w > 0.5 && abs(rd.y) > 1e-4) {
    float px = uMisc.w;
    vec3 c = uGlassA.xyz;
    float rIn = uGlassA.w;
    float rOut = rIn + uGlassB.y;
    float line = 0.0;
    float t1 = (c.y + uGlassB.x - eye.y) / rd.y;
    if (t1 > 0.0) {
      float r = length(eye.xz + rd.xz * t1 - c.xz);
      // (only near the glass: toward the horizon k goes to 0)
      float k = r < 2.0 * rOut ? abs(rd.y) / (t1 * px) : 1e9;
      float seen = -(uToyToView * vec4(eye + rd * t1, 1.0)).z > liqZ ? liqT * 0.5 : 1.0;
      line = max(line, seen * (1.0 - smoothstep(0.5, 1.5, abs(r - rOut) * k)));
      line = max(line, seen * 0.7 * (1.0 - smoothstep(0.5, 1.5, abs(r - rIn) * k)));
      if (r > rIn && r < rOut && k < 1e8) line = max(line, seen * 0.6);
    }
    float t0 = (c.y - eye.y) / rd.y;
    if (t0 > 0.0) {
      float r = length(eye.xz + rd.xz * t0 - c.xz);
      float k = r < 2.0 * rOut ? abs(rd.y) / (t0 * px) : 1e9;
      float seen = -(uToyToView * vec4(eye + rd * t0, 1.0)).z > liqZ ? liqT * 0.5 : 1.0;
      line = max(line, seen * 0.6 * (1.0 - smoothstep(0.5, 1.5, abs(r - rOut) * k)));
    }
    col = mix(col, vec3(0.97), line * 0.85);
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
uniform uDrop: vec2f;
uniform uLevel: vec4f;
var uProps: texture_2d<uff>;
uniform uPropInfo: vec4f;
uniform uHeat: vec4f;
uniform uPropLight: vec4f;
uniform uPropLightC: vec4f;
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
  c = mix(c, vec3f(1.0, 0.76, 0.32), smoothstep(0.35, 0.65, t));
  c = mix(c, vec3f(1.0, 0.95, 0.82), smoothstep(0.75, 1.0, t));
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
// A lava's heat at its front surface (the depth pass's g, smoothed).
fn sampleHeat(uv: vec2f) -> f32 {
  let size = vec2f(textureDimensions(uDepth, 0));
  let q = clamp(vec2i(flipUv(uv) * size), vec2i(0), vec2i(size) - vec2i(1));
  return textureLoad(uDepth, q, 0).g;
}
// Glowing lava by its heat (1 fresh .. 0 cold), an incandescent ramp:
// orange-yellow, orange, red, dull red, then black.
fn lavaRamp(t: f32) -> vec3f {
  var c = mix(vec3f(0.0), vec3f(0.3, 0.04, 0.01), smoothstep(0.05, 0.18, t));
  c = mix(c, vec3f(0.75, 0.13, 0.02), smoothstep(0.18, 0.38, t));
  c = mix(c, vec3f(1.0, 0.36, 0.05), smoothstep(0.38, 0.65, t));
  c = mix(c, vec3f(1.0, 0.6, 0.18), smoothstep(0.65, 0.95, t));
  return c;
}
fn hash3(p: vec3f) -> f32 {
  return fract(sin(dot(p, vec3f(127.1, 311.7, 74.7))) * 43758.5453);
}
fn vnoise(p: vec3f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3f(1.0, 0.0, 0.0)), u.x),
                 mix(hash3(i + vec3f(0.0, 1.0, 0.0)), hash3(i + vec3f(1.0, 1.0, 0.0)), u.x), u.y),
             mix(mix(hash3(i + vec3f(0.0, 0.0, 1.0)), hash3(i + vec3f(1.0, 0.0, 1.0)), u.x),
                 mix(hash3(i + vec3f(0.0, 1.0, 1.0)), hash3(i + vec3f(1.0, 1.0, 1.0)), u.x), u.y), u.z);
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
// The props around the liquid (a board, a stand, a nozzle and its handle),
// traced like the glass so they are as crisp (index.js; up to 8 shapes, 5
// texels each: type, radii and angle; a or center; b or half size; color and
// material; pivot).
struct PropHit { t: f32, n: vec3f, i: i32 }
fn propTexel(i: i32, k: i32) -> vec4f { return textureLoad(uProps, vec2i(i * 5 + k, 0), 0); }
fn iCyl(ro: vec3f, rd: vec3f, pa: vec3f, pb: vec3f, ra: f32) -> vec4f {
  let ba = pb - pa;
  let oc = ro - pa;
  let baba = dot(ba, ba);
  let bard = dot(ba, rd);
  let baoc = dot(ba, oc);
  let k2 = baba - bard * bard;
  let k1 = baba * dot(oc, rd) - baoc * bard;
  let k0 = baba * dot(oc, oc) - baoc * baoc - ra * ra * baba;
  var h = k1 * k1 - k2 * k0;
  if (h < 0.0) { return vec4f(-1.0); }
  h = sqrt(h);
  var t = (-k1 - h) / k2;
  let y = baoc + t * bard;
  if (y > 0.0 && y < baba) { return vec4f(t, (oc + t * rd - ba * y / baba) / ra); }
  t = (select(baba, 0.0, y < 0.0) - baoc) / bard;
  if (abs(k1 + k2 * t) < h) { return vec4f(t, ba * sign(y) / sqrt(baba)); }
  return vec4f(-1.0);
}
fn iCone(ro: vec3f, rd: vec3f, pa: vec3f, pb: vec3f, ra: f32, rb: f32) -> vec4f {
  let ba = pb - pa;
  let oa = ro - pa;
  let ob = ro - pb;
  let m0 = dot(ba, ba);
  let m1 = dot(oa, ba);
  let m2 = dot(rd, ba);
  let m3 = dot(rd, oa);
  let m5 = dot(oa, oa);
  let m9 = dot(ob, ba);
  if (m1 < 0.0) {
    let q = oa * m2 - rd * m1;
    if (dot(q, q) < ra * ra * m2 * m2) { return vec4f(-m1 / m2, -ba * inverseSqrt(m0)); }
  } else if (m9 > 0.0) {
    let t = -m9 / m2;
    let q = ob + rd * t;
    if (dot(q, q) < rb * rb) { return vec4f(t, ba * inverseSqrt(m0)); }
  }
  let rr = ra - rb;
  let hy = m0 + rr * rr;
  let k2 = m0 * m0 - m2 * m2 * hy;
  let k1 = m0 * m0 * m3 - m1 * m2 * hy + m0 * ra * (rr * m2);
  let k0 = m0 * m0 * m5 - m1 * m1 * hy + m0 * ra * (rr * m1 * 2.0 - m0 * ra);
  let h = k1 * k1 - k2 * k0;
  if (h < 0.0) { return vec4f(-1.0); }
  let t = (-k1 - sqrt(h)) / k2;
  let y = m1 + t * m2;
  if (y < 0.0 || y > m0) { return vec4f(-1.0); }
  return vec4f(t, normalize(m0 * (m0 * (oa + t * rd) + rr * ba * ra) - ba * hy * y));
}
fn rotZ(v: vec3f, a: f32) -> vec3f {
  let c = cos(a);
  let s = sin(a);
  return vec3f(c * v.x - s * v.y, s * v.x + c * v.y, v.z);
}
fn iBox(ro0: vec3f, rd0: vec3f, c: vec3f, hs: vec3f, ang: f32, piv: vec3f) -> vec4f {
  // into the box's frame: turned back about z around its pivot
  let ro = rotZ(ro0 - piv, -ang) + piv - c;
  let rd = rotZ(rd0, -ang);
  let m = 1.0 / rd;
  let n = m * ro;
  let k = abs(m) * hs;
  let t1 = -n - k;
  let t2 = -n + k;
  let tN = max(max(t1.x, t1.y), t1.z);
  let tF = min(min(t2.x, t2.y), t2.z);
  if (tN > tF || tF < 0.0) { return vec4f(-1.0); }
  let nl = -sign(rd) * step(t1.yzx, t1.xyz) * step(t1.zxy, t1.xyz);
  return vec4f(tN, rotZ(nl, ang));
}
fn traceProps(ro: vec3f, rd: vec3f) -> PropHit {
  var best = PropHit(1e9, vec3f(0.0, 1.0, 0.0), -1);
  let n = i32(uniform.uPropInfo.x);
  for (var i = 0; i < 8; i++) {
    if (i >= n) { break; }
    let t0 = propTexel(i, 0);
    let t1 = propTexel(i, 1);
    let t2 = propTexel(i, 2);
    var r = vec4f(-1.0);
    if (t0.x < 1.5) { r = iCyl(ro, rd, t1.xyz, t2.xyz, t0.y); }
    else if (t0.x < 2.5) { r = iBox(ro, rd, t1.xyz, t2.xyz, t0.w, propTexel(i, 4).xyz); }
    else { r = iCone(ro, rd, t1.xyz, t2.xyz, t0.y, t0.z); }
    if (r.x > 0.0 && r.x < best.t) { best = PropHit(r.x, r.yzw, i); }
  }
  return best;
}
fn shadeProp(h: PropHit, ro: vec3f, rd: vec3f) -> vec3f {
  let c = propTexel(h.i, 3);
  var n = normalize(h.n);
  if (dot(n, rd) > 0.0) { n = -n; }
  let p = ro + rd * h.t;
  // A flame's warm light (uPropLight: place, strength).
  var lit = vec3f(0.0);
  if (uniform.uPropLight.w > 0.001) {
    let dl = uniform.uPropLight.xyz - p;
    let dist = length(dl);
    let I = uniform.uPropLight.w * uniform.uPropLightC.rgb;
    lit = I * max(dot(n, dl / dist), 0.0) * 0.5 / (1.0 + (dist / 0.3) * (dist / 0.3));
    if (c.w > 2.5) {
      // wax carries the light into itself: its top glows from within
      let below = max(uniform.uPropLight.y - 0.12 - p.y, 0.0);
      lit += I * vec3f(1.0, 0.75, 0.5) * 0.55 * exp(-below / 0.09);
    }
  }
  if (c.w > 3.5) {
    // coffee: dark, with a light crema ring at its edge, and a soft sheen
    let r = length(p.xz - propTexel(h.i, 1).xz) / propTexel(h.i, 0).y;
    let cof = mix(vec3f(0.23, 0.13, 0.08), vec3f(0.66, 0.47, 0.31), max(0.0, (r - 0.8) / 0.2) * 0.8);
    let H = normalize(normalize(uniform.uLight.xyz) - rd);
    return cof + vec3f(pow(max(dot(n, H), 0.0), 60.0) * 0.25);
  }
  if (c.w > 2.5) {
    // wax: soft, matte and a little lighter toward the top
    return c.rgb * (0.78 + 0.22 * max(n.y, 0.0) + 0.08 * n.x) + c.rgb * lit;
  }
  if (c.w > 1.5) {
    // wood: a calm, low-frequency grain (as the recipe's splats had)
    let g = 0.5 + 0.5 * sin(p.x * 7.0 + 1.3 * sin(p.z * 3.0 + p.x * 1.2));
    let w = mix(vec3f(0.49, 0.32, 0.19), vec3f(0.60, 0.42, 0.24), g * 0.8);
    return w * (0.82 + 0.18 * max(n.y, 0.0) + lit);
  }
  var col = c.rgb * (0.85 + 0.3 * max(0.0, n.y) + 0.1 * n.x + lit);
  if (c.w > 0.5) {
    // steel: a soft highlight from the room's light
    let H = normalize(normalize(uniform.uLight.xyz) - rd);
    col += vec3f(pow(max(dot(n, H), 0.0), 40.0) * 0.35);
  }
  return col;
}
fn sceneAt(uv: vec2f) -> vec3f {
  let c = textureSampleLevel(uScene, uSceneSampler, flipUv(uv), 0.0).rgb;
  if (uniform.uPropInfo.x < 0.5) { return c; }
  let eye = (uniform.uViewToToy * vec4f(0.0, 0.0, 0.0, 1.0)).xyz;
  let rd = normalize((uniform.uViewToToy * vec4f(normalize(viewPos(uv, 1.0)), 0.0)).xyz);
  let h = traceProps(eye, rd);
  if (h.i < 0) { return c; }
  return shadeProp(h, eye, rd);
}
@fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let uv0 = input.uv0;
  let scene = sceneAt(uv0);
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
  var liqZ = 1e9;
  var liqT = 1.0;
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
    let behind = sceneAt(clamp(uv0 - off, vec2f(0.001), vec2f(0.999)));
    let T = exp(-uniform.uAbsorb.rgb * thick);
    let lit = uniform.uColor.rgb * (0.35 + 0.65 * max(dot(n, L), 0.0));
    var rr = refract(rd, n, 0.75);
    if (dot(rr, rr) <= 0.0) { rr = reflect(rd, n); }
    // (the room seen through the liquid: dim through a thin stream, which
    // shows mostly what is behind it, so clear water never reads as gray)
    let room = sky(rr) * 0.3 * mix(0.25, 1.0, clamp(thick * 6.0, 0.0, 1.0));
    let body = mix((behind + room) * T + uniform.uColor.rgb * (1.0 - T) * 0.25, lit, uniform.uColor.a);
    let F = fresnel(dot(n, V), 0.02);
    let refl = sky(reflect(-V, n));
    let H = normalize(L + V);
    let spec = pow(max(dot(n, H), 0.0), 180.0) * 1.6;
    var liq = mix(body, refl, F) + spec + uniform.uColor.rgb * uniform.uAbsorb.a;
    // A thin stream of clear liquid catches the room's light all along its
    // curved sides (a lit room is brighter than the wall behind): it reads
    // light and silvery, never as a gray cut-out of the dark behind it.
    let stream = (1.0 - smoothstep(2.0 * uniform.uDrop.y, 7.0 * uniform.uDrop.y, thick)) * dot(T, vec3f(0.333)) * (1.0 - uniform.uColor.a);
    liq = mix(liq, behind * 0.45 + vec3f(0.6, 0.7, 0.78) + spec, 0.6 * stream);
    // The top surface reads even when the liquid is dark: the room's light
    // on it, and a thin bright meniscus where it meets the glass.
    if (uniform.uGlassB.w > 0.5 && n.y > 0.6) {
      let Pt2 = (uniform.uViewToToy * vec4f(P, 1.0)).xyz;
      let rl2 = length(Pt2.xz - uniform.uGlassA.xz);
      liq = mix(liq, refl, 0.1 * smoothstep(0.6, 0.95, n.y));
    }
    let thin = uniform.uDrop.x * (1.0 - smoothstep(uniform.uDrop.y, 4.0 * uniform.uDrop.y, thick));
    liq = mix(liq, sky(normalize(vec3f(n.x, 1.0, n.z))) * 0.75 + spec, thin);
    // Bubbles inside: bright specks, tinted by the liquid around them.
    let bub = clamp(thickAll(uv0).b * 1.2, 0.0, 1.0) * uniform.uFoam.w;
    liq = mix(liq, mix(uniform.uColor.rgb, vec3f(1.0), 0.6) * (0.65 + 0.35 * max(dot(n, L), 0.0)) + vec3f(0.08), bub * 0.75);
    if (uniform.uHeat.y > 0.5) {
      // Lava (r6): one material from the spout to the pool. Its color comes
      // only from its heat, which falls on the same curve wherever it is
      // (the time since it left the spout): bright orange fresh, orange,
      // red, dull red, then a dark crust. The crust forms on the coolest
      // skin first and breaks into plates whose cracks show the hotter lava
      // just beneath, on the same ramp.
      let Pt3 = (uniform.uViewToToy * vec4f(P, 1.0)).xyz;
      let heat = sampleHeat(uv0);
      let nz = vnoise(Pt3 * 28.0) * 0.6 + vnoise(Pt3 * 70.0) * 0.4;
      let crustAmt = 1.0 - smoothstep(0.2, 0.42, heat + 0.18 * (nz - 0.5));
      let vein = 1.0 - smoothstep(0.0, 0.05, abs(vnoise(Pt3 * 11.0) - 0.5));
      // (cooled pahoehoe: a glassy dark gray that shows the room's light)
      let crust = vec3f(0.13, 0.12, 0.12) * (0.45 + 0.55 * max(dot(n, L), 0.0)) * (0.75 + 0.5 * nz) + vec3f(spec * 0.6) + refl * (0.08 + F * 0.6);
      // (molten lava is lit from within; its skin is a touch cooler where
      // it curves away, and a little uneven)
      let glow = lavaRamp(heat - 0.12 * (1.0 - abs(nV.z)) + 0.08 * (nz - 0.5)) * (0.85 + 0.15 * nz) + vec3f(spec * 0.3);
      let under = lavaRamp(min(1.0, heat * 1.6 + 0.12)) * vein * smoothstep(0.02, 0.2, heat);
      liq = mix(glow, crust + under, crustAmt);
    }
    let a = clamp(thick * 200.0, 0.0, 1.0);
    liqZ = -P.z;
    liqT = mix(1.0, dot(T, vec3f(0.333)), a);
    col = mix(col, liq, a);
  }
  // A thin liquid's top in a glass (r6): a flat surface at the pool's level
  // that reaches the glass's inner wall, so it reads as one surface from any
  // angle, with a hairline meniscus where it meets the wall (uLevel: the
  // level, on).
  if (uniform.uLevel.y > 0.5 && uniform.uGlassB.w > 0.5 && abs(rd.y) > 1e-4) {
    let tP = (uniform.uLevel.x - eye.y) / rd.y;
    let hit = eye + rd * tP;
    let rIn = uniform.uGlassA.w;
    let rr = length(hit.xz - uniform.uGlassA.xz);
    let pz = -(uniform.uToyToView * vec4f(hit, 1.0)).z;
    if (tP > 0.0 && rr < rIn && pz < liqZ + 0.02 && pz < tFront + 1e9) {
      let nT = vec3f(0.0, 1.0, 0.0);
      let V2 = -rd;
      let F2 = fresnel(abs(rd.y), 0.02);
      let refl2 = sky(reflect(rd, nT));
      // through the liquid to the glass's bottom
      let depthL = max(0.0, uniform.uLevel.x - uniform.uGlassA.y - uniform.uGlassB.z) / max(abs(rd.y), 0.15);
      let tView = depthL * (uniform.uToyToView * vec4f(0.0, 1.0, 0.0, 0.0)).y;
      let T2 = exp(-uniform.uAbsorb.rgb * abs(tView) * 1.0);
      let behind2 = sceneAt(clamp(uv0 + vec2f(0.0, 0.004), vec2f(0.001), vec2f(0.999)));
      let body2 = mix(behind2 * T2 + uniform.uColor.rgb * (1.0 - T2) * 0.25, uniform.uColor.rgb * 0.6, uniform.uColor.a);
      let H2 = normalize(normalize(uniform.uLight.xyz) + V2);
      var top = mix(body2, refl2, F2) + vec3f(pow(max(dot(nT, H2), 0.0), 180.0) * 1.6);
      // the meniscus: the surface curves up the wall in its last millimeter,
      // a hairline that catches the room's light
      let px = uniform.uMisc.w * tP;
      let men = smoothstep(rIn - 2.5 * px, rIn - 0.5 * px, rr);
      top = mix(top, refl2 * 1.1 + vec3f(0.05), men * 0.35);
      col = top;
      liqZ = pz;
      liqT = dot(T2, vec3f(0.333));
    }
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
    col = mix(col, vec3f(0.95), smoothstep(0.12, 0.02, cosT) * 0.85);
  }
  if (uniform.uGlassB.w > 0.5 && abs(rd.y) > 1e-4) {
    let px = uniform.uMisc.w;
    let c = uniform.uGlassA.xyz;
    let rIn = uniform.uGlassA.w;
    let rOut = rIn + uniform.uGlassB.y;
    var line = 0.0;
    let t1 = (c.y + uniform.uGlassB.x - eye.y) / rd.y;
    if (t1 > 0.0) {
      let r = length(eye.xz + rd.xz * t1 - c.xz);
      let k = select(1e9, abs(rd.y) / (t1 * px), r < 2.0 * rOut);
      let seen = select(1.0, liqT * 0.5, -(uniform.uToyToView * vec4f(eye + rd * t1, 1.0)).z > liqZ);
      line = max(line, seen * (1.0 - smoothstep(0.5, 1.5, abs(r - rOut) * k)));
      line = max(line, seen * 0.7 * (1.0 - smoothstep(0.5, 1.5, abs(r - rIn) * k)));
      if (r > rIn && r < rOut && k < 1e8) { line = max(line, seen * 0.6); }
    }
    let t0 = (c.y - eye.y) / rd.y;
    if (t0 > 0.0) {
      let r = length(eye.xz + rd.xz * t0 - c.xz);
      let k = select(1e9, abs(rd.y) / (t0 * px), r < 2.0 * rOut);
      let seen = select(1.0, liqT * 0.5, -(uniform.uToyToView * vec4f(eye + rd * t0, 1.0)).z > liqZ);
      line = max(line, seen * 0.6 * (1.0 - smoothstep(0.5, 1.5, abs(r - rOut) * k)));
    }
    col = mix(col, vec3f(0.97), line * 0.85);
  }
  // A prop in front of the liquid or the glass covers them.
  if (uniform.uPropInfo.x > 0.5) {
    let ph = traceProps(eye, rd);
    if (ph.i >= 0) {
      let pz = -(uniform.uToyToView * vec4f(eye + rd * ph.t, 1.0)).z;
      if (pz < liqZ && ph.t < tFront) { col = shadeProp(ph, eye, rd); }
    }
  }
  // A flame's glow in the air around it (a lens and the eye see a halo).
  if (uniform.uPropLight.w > 0.001) {
    let q = uniform.uPropLight.xyz - eye;
    let tq = max(dot(q, rd), 0.0);
    let dq = length(q - rd * tq);
    let g = 0.22 * exp(-(dq / 0.1) * (dq / 0.1)) + 0.06 / (1.0 + (dq / 0.05) * (dq / 0.05));
    col += uniform.uPropLightC.rgb * uniform.uPropLight.w * g;
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
    // (two channels: depth, and a lava's heat)
    this.depthFormat = floatOk ? pc.PIXELFORMAT_RG32F : pc.PIXELFORMAT_RGBA16F;
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
      // velocities are cells/s; a 30th of a second of travel (a stream thins
      // below a particle a cell as it falls and MPM breaks it into clumps:
      // drawn this long, it reads as the thread it is; a recipe without a
      // stream, such as the splash, stretches less, so a falling ball and its
      // drops stay round)
      scope.resolve("uStretch").setValue([(src.stretch ?? 1) / 30, src.velRow ?? 0]);
      // A lava's cooling (index.js): 1 / its time to crust over (s), and on.
      scope.resolve("uHeat").setValue(src.heat ? [1 / src.heat, 1, 0, 0] : [0, 0, 0, 0]);
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
    // w: the angle one screen pixel spans (for lines a pixel or so wide)
    scope.resolve("uMisc").setValue([p.refract, liquid ? 1 : 0, 2.5 * (src.cell || 0), 2 / (proj.data[5] * d.height)]); // prettier-ignore
    scope.resolve("uFoam").setValue([...p.foam, liquid && src.diffuse?.n ? 1 : 0]);
    scope.resolve("uDrop").setValue([src.drops ?? 0, (src.radius ?? 0) * toyScale * 2]);
    if (!liquid) scope.resolve("uHeat").setValue([0, 0, 0, 0]);
    scope
      .resolve("uLevel")
      .setValue(liquid && src.level != null ? [src.level, 1, 0, 0] : [0, 0, 0, 0]);
    // The props (index.js), traced on WebGPU only.
    const props = d.isWebGPU ? p.props : null;
    scope.resolve("uProps").setValue(this.propTexture(props));
    scope.resolve("uPropInfo").setValue([props?.length ?? 0, 0, 0, 0]);
    scope.resolve("uPropLight").setValue(d.isWebGPU && p.propLight ? p.propLight : [0, 0, 0, 0]);
    scope.resolve("uPropLightC").setValue(p.propLightC || [1, 0.7, 0.35, 0]);
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

  // Packs the props (index.js): 5 texels a shape.
  propTexture(shapes) {
    this.propTex ||= this.tex(40, 1, pc.PIXELFORMAT_RGBA32F, "flProps");
    if (!shapes?.length) return this.propTex;
    const data = this.propTex.lock();
    data.fill(0);
    shapes.slice(0, 8).forEach((s, i) => data.set(s.texels, i * 20));
    this.propTex.unlock();
    return this.propTex;
  }

  blankGas() {
    this.blank ||= this.tex(1, 1, pc.PIXELFORMAT_RGBA16F, "flGasBlank");
    return this.blank;
  }

  destroy() {
    this.blank?.destroy();
    this.propTex?.destroy();
    this.destroyTargets();
    this.depthPass.destroy();
    this.thickPass.destroy();
    this.diffPass.destroy();
    for (const s of Object.values(this.sh)) s.destroy();
  }
}

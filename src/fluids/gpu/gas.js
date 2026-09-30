// Lane Fluids r4: smoke, steam and flames on a grid (stable fluids), in
// fragment shaders so WebGL2 phones get it too.
//
// Stam, "Stable Fluids" (SIGGRAPH 1999): semi-Lagrangian advection, then a
// pressure projection (Jacobi iterations) that keeps the flow divergence
// free. Fedkiw, Stam and Jensen, "Visual Simulation of Smoke" (SIGGRAPH
// 2001): buoyancy from temperature, and vorticity confinement, which puts
// back the small curls the coarse grid smooths away. A flame is fuel that
// burns where it is hot: it gives heat (so it rises and draws air in), turns
// to smoke, and glows by its temperature (the ray march in volume.js).
//
// The 3D grid (nx, ny, nz) is stored flat in 2D textures as nz slices of
// nx x ny, laid out in a grid of tiles; every pass is a full-screen quad over
// the atlas that works out its cell from the pixel.
//
// Fields (RGBA16F): vel (xyz, w unused), scal (r smoke, g temperature,
// b fuel), pres (r pressure), div (r divergence), curl (xyz).

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

// Atlas addressing, shared by every pass. uDims: nx, ny, nz, tilesX.
const COMMON = /* glsl */ `
uniform vec4 uDims;
ivec3 cellOf(vec2 fragXY) {
  int x = int(fragXY.x);
  int y = int(fragXY.y);
  int nx = int(uDims.x);
  int ny = int(uDims.y);
  int tx = x / nx;
  int ty = y / ny;
  return ivec3(x - tx * nx, y - ty * ny, ty * int(uDims.w) + tx);
}
ivec2 texelOf(ivec3 c) {
  int nx = int(uDims.x);
  int ny = int(uDims.y);
  int tw = int(uDims.w);
  int tz = c.z / tw;
  return ivec2((c.z - tz * tw) * nx + c.x, tz * ny + c.y);
}
vec4 fetch(sampler2D t, ivec3 c) {
  ivec3 m = ivec3(uDims.xyz) - 1;
  c = clamp(c, ivec3(0), m);
  return texelFetch(t, texelOf(c), 0);
}
// Trilinear sample at a cell-space point (cell centers at i + 0.5).
vec4 sample3(sampler2D t, vec3 p) {
  p = clamp(p - 0.5, vec3(0.0), uDims.xyz - 1.0);
  vec3 f = fract(p);
  ivec3 i = ivec3(floor(p));
  vec4 a = mix(fetch(t, i), fetch(t, i + ivec3(1, 0, 0)), f.x);
  vec4 b = mix(fetch(t, i + ivec3(0, 1, 0)), fetch(t, i + ivec3(1, 1, 0)), f.x);
  vec4 c = mix(fetch(t, i + ivec3(0, 0, 1)), fetch(t, i + ivec3(1, 0, 1)), f.x);
  vec4 d = mix(fetch(t, i + ivec3(0, 1, 1)), fetch(t, i + ivec3(1, 1, 1)), f.x);
  return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
}
`;
const COMMON_W = /* wgsl */ `
uniform uDims: vec4f;
fn cellOf(fragXY: vec2f) -> vec3i {
  let x = i32(fragXY.x);
  let y = i32(fragXY.y);
  let nx = i32(uniform.uDims.x);
  let ny = i32(uniform.uDims.y);
  let tx = x / nx;
  let ty = y / ny;
  return vec3i(x - tx * nx, y - ty * ny, ty * i32(uniform.uDims.w) + tx);
}
fn texelOf(c: vec3i) -> vec2i {
  let nx = i32(uniform.uDims.x);
  let ny = i32(uniform.uDims.y);
  let tw = i32(uniform.uDims.w);
  let tz = c.z / tw;
  return vec2i((c.z - tz * tw) * nx + c.x, tz * ny + c.y);
}
`;
// WGSL can't pass textures around freely in PlayCanvas' processed shaders,
// so each pass declares fetch helpers for its own textures.
function fetchW(name) {
  return /* wgsl */ `
fn fetch_${name}(c0: vec3i) -> vec4f {
  let m = vec3i(uniform.uDims.xyz) - vec3i(1);
  let c = clamp(c0, vec3i(0), m);
  return textureLoad(${name}, texelOf(c), 0);
}
fn sample3_${name}(p0: vec3f) -> vec4f {
  let p = clamp(p0 - 0.5, vec3f(0.0), uniform.uDims.xyz - 1.0);
  let f = fract(p);
  let i = vec3i(floor(p));
  let a = mix(fetch_${name}(i), fetch_${name}(i + vec3i(1, 0, 0)), f.x);
  let b = mix(fetch_${name}(i + vec3i(0, 1, 0)), fetch_${name}(i + vec3i(1, 1, 0)), f.x);
  let c = mix(fetch_${name}(i + vec3i(0, 0, 1)), fetch_${name}(i + vec3i(1, 0, 1)), f.x);
  let d = mix(fetch_${name}(i + vec3i(0, 1, 1)), fetch_${name}(i + vec3i(1, 1, 1)), f.x);
  return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
}
`;
}

// A pass's fragment program: body(GLSL) with `c` (ivec3 cell) in scope and
// `gl_FragColor` to write; the WGSL body uses `c` and returns `out`.
function pass(name, texs, uniforms, bodyGlsl, bodyWgsl) {
  const glsl = `
${COMMON}
${texs.map((t) => `uniform sampler2D ${t};`).join("\n")}
${uniforms.map(([n, t]) => `uniform ${t} ${n};`).join("\n")}
void main() {
  ivec3 c = cellOf(gl_FragCoord.xy);
  ${bodyGlsl}
}
`;
  const typeW = { float: "f32", vec2: "vec2f", vec3: "vec3f", vec4: "vec4f" };
  const wgsl = `
${COMMON_W}
${texs.map((t) => `var ${t}: texture_2d<uff>;`).join("\n")}
${uniforms.map(([n, t]) => `uniform ${n}: ${typeW[t]};`).join("\n")}
${texs.map(fetchW).join("\n")}
@fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let c = cellOf(pcPosition.xy);
  var out = vec4f(0.0);
  ${bodyWgsl}
  output.color = out;
  return output;
}
`;
  return { name, glsl, wgsl };
}

// Semi-Lagrangian advection of a field by vel (cells/s), with decay.
const ADVECT = pass(
  "advect",
  ["uVel", "uSrc"],
  [
    ["uDt", "float"],
    ["uDecay", "vec4"],
  ],
  `vec3 p = vec3(c) + 0.5 - fetch(uVel, c).xyz * uDt;
  gl_FragColor = sample3(uSrc, p) * uDecay;`,
  `let p = vec3f(c) + 0.5 - fetch_uVel(c).xyz * uniform.uDt;
  out = sample3_uSrc(p) * uniform.uDecay;`,
);

// Sources, buoyancy, burning and wind. Up to two spherical sources.
//   uSrcA/uSrcB: xyz center (cells), w radius (cells)
//   uAddA/uAddB: rgb smoke/heat/fuel per second, a upward speed (cells/s)
//   uBuoy: x heat lift, y smoke weight, z burn rate, w heat from burning
//   uWind: xyz (cells/s^2), w noise strength; uTime
const FORCES_VEL = pass(
  "forcesVel",
  ["uVel", "uScal", "uCurl"],
  [["uDt", "float"], ["uSrcA", "vec4"], ["uAddA", "vec4"], ["uSrcB", "vec4"], ["uAddB", "vec4"], ["uBuoy", "vec4"], ["uWind", "vec4"], ["uVort", "float"], ["uTime", "float"]], // prettier-ignore
  `vec4 v = fetch(uVel, c);
  vec4 s = fetch(uScal, c);
  vec3 p = vec3(c) + 0.5;
  // buoyancy: heat lifts, smoke weighs
  v.y += (uBuoy.x * s.g - uBuoy.y * s.r) * uDt;
  // vorticity confinement: push along N x omega, N toward stronger curl
  vec3 w = fetch(uCurl, c).xyz;
  float wl = length(fetch(uCurl, c + ivec3(1,0,0)).xyz) - length(fetch(uCurl, c - ivec3(1,0,0)).xyz);
  float wd = length(fetch(uCurl, c + ivec3(0,1,0)).xyz) - length(fetch(uCurl, c - ivec3(0,1,0)).xyz);
  float wf = length(fetch(uCurl, c + ivec3(0,0,1)).xyz) - length(fetch(uCurl, c - ivec3(0,0,1)).xyz);
  vec3 N = vec3(wl, wd, wf);
  float nl = length(N);
  if (nl > 1e-5) v.xyz += uVort * cross(N / nl, w) * uDt;
  // wind, stronger with height
  v.xyz += uWind.xyz * (p.y / uDims.y) * uDt;
  // sources blow upward
  float fa = 1.0 - smoothstep(uSrcA.w * 0.6, uSrcA.w, distance(p, uSrcA.xyz));
  float fb = 1.0 - smoothstep(uSrcB.w * 0.6, uSrcB.w, distance(p, uSrcB.xyz));
  v.y = mix(v.y, max(v.y, uAddA.a), fa * min(1.0, uDt * 20.0));
  v.y = mix(v.y, max(v.y, uAddB.a), fb * min(1.0, uDt * 20.0));
  // a little noise at the sources keeps them from being perfectly steady
  float nz = sin(p.x * 1.7 + uTime * 5.1) * sin(p.z * 1.3 - uTime * 4.3) * sin(p.y * 0.9 + uTime * 3.7);
  v.xz += uWind.w * nz * (fa + fb) * uDt * vec2(1.0, -1.0);
  // closed at the sides and the bottom, open at the top
  if (c.x == 0 || c.x == int(uDims.x) - 1) v.x = 0.0;
  if (c.z == 0 || c.z == int(uDims.z) - 1) v.z = 0.0;
  if (c.y == 0) v.y = max(v.y, 0.0);
  gl_FragColor = v;`,
  `var v = fetch_uVel(c);
  let s = fetch_uScal(c);
  let p = vec3f(c) + 0.5;
  v.y += (uniform.uBuoy.x * s.g - uniform.uBuoy.y * s.r) * uniform.uDt;
  let w = fetch_uCurl(c).xyz;
  let wl = length(fetch_uCurl(c + vec3i(1,0,0)).xyz) - length(fetch_uCurl(c - vec3i(1,0,0)).xyz);
  let wd = length(fetch_uCurl(c + vec3i(0,1,0)).xyz) - length(fetch_uCurl(c - vec3i(0,1,0)).xyz);
  let wf = length(fetch_uCurl(c + vec3i(0,0,1)).xyz) - length(fetch_uCurl(c - vec3i(0,0,1)).xyz);
  let N = vec3f(wl, wd, wf);
  let nl = length(N);
  if (nl > 1e-5) { v = vec4f(v.xyz + uniform.uVort * cross(N / nl, w) * uniform.uDt, v.w); }
  v = vec4f(v.xyz + uniform.uWind.xyz * (p.y / uniform.uDims.y) * uniform.uDt, v.w);
  let fa = 1.0 - smoothstep(uniform.uSrcA.w * 0.6, uniform.uSrcA.w, distance(p, uniform.uSrcA.xyz));
  let fb = 1.0 - smoothstep(uniform.uSrcB.w * 0.6, uniform.uSrcB.w, distance(p, uniform.uSrcB.xyz));
  v.y = mix(v.y, max(v.y, uniform.uAddA.a), fa * min(1.0, uniform.uDt * 20.0));
  v.y = mix(v.y, max(v.y, uniform.uAddB.a), fb * min(1.0, uniform.uDt * 20.0));
  let nz = sin(p.x * 1.7 + uniform.uTime * 5.1) * sin(p.z * 1.3 - uniform.uTime * 4.3) * sin(p.y * 0.9 + uniform.uTime * 3.7);
  let dxz = uniform.uWind.w * nz * (fa + fb) * uniform.uDt;
  v.x += dxz;
  v.z -= dxz;
  if (c.x == 0 || c.x == i32(uniform.uDims.x) - 1) { v.x = 0.0; }
  if (c.z == 0 || c.z == i32(uniform.uDims.z) - 1) { v.z = 0.0; }
  if (c.y == 0) { v.y = max(v.y, 0.0); }
  out = v;`,
);

const FORCES_SCAL = pass(
  "forcesScal",
  ["uScal"],
  [["uDt", "float"], ["uSrcA", "vec4"], ["uAddA", "vec4"], ["uSrcB", "vec4"], ["uAddB", "vec4"], ["uBuoy", "vec4"]], // prettier-ignore
  `vec4 s = fetch(uScal, c);
  vec3 p = vec3(c) + 0.5;
  float fa = 1.0 - smoothstep(uSrcA.w * 0.5, uSrcA.w, distance(p, uSrcA.xyz));
  float fb = 1.0 - smoothstep(uSrcB.w * 0.5, uSrcB.w, distance(p, uSrcB.xyz));
  s.rgb += (uAddA.rgb * fa + uAddB.rgb * fb) * uDt;
  // burning: fuel turns to heat and a little smoke where it is hot
  // a lit flame burns its fuel steadily (burning, not ignition, is modeled)
  float burn = min(s.b, uBuoy.z * s.b * uDt);
  s.b -= burn;
  s.g += burn * uBuoy.w;
  s.r += burn * 0.01;
  // the top of the grid lets smoke out (it thins away instead of piling up)
  float top = smoothstep(0.7, 1.0, (float(c.y) + 0.5) / uDims.y);
  s *= 1.0 - top * min(1.0, uDt * 8.0);
  gl_FragColor = clamp(s, vec4(0.0), vec4(8.0));`,
  `var s = fetch_uScal(c);
  let p = vec3f(c) + 0.5;
  let fa = 1.0 - smoothstep(uniform.uSrcA.w * 0.5, uniform.uSrcA.w, distance(p, uniform.uSrcA.xyz));
  let fb = 1.0 - smoothstep(uniform.uSrcB.w * 0.5, uniform.uSrcB.w, distance(p, uniform.uSrcB.xyz));
  s = vec4f(s.rgb + (uniform.uAddA.rgb * fa + uniform.uAddB.rgb * fb) * uniform.uDt, s.a);
  let burn = min(s.b, uniform.uBuoy.z * s.b * uniform.uDt);
  s.b -= burn;
  s.g += burn * uniform.uBuoy.w;
  s.r += burn * 0.01;
  let top = smoothstep(0.7, 1.0, (f32(c.y) + 0.5) / uniform.uDims.y);
  s = s * (1.0 - top * min(1.0, uniform.uDt * 8.0));
  out = clamp(s, vec4f(0.0), vec4f(8.0));`,
);

const CURL = pass(
  "curl",
  ["uVel"],
  [],
  `vec3 dx = fetch(uVel, c + ivec3(1,0,0)).xyz - fetch(uVel, c - ivec3(1,0,0)).xyz;
  vec3 dy = fetch(uVel, c + ivec3(0,1,0)).xyz - fetch(uVel, c - ivec3(0,1,0)).xyz;
  vec3 dz = fetch(uVel, c + ivec3(0,0,1)).xyz - fetch(uVel, c - ivec3(0,0,1)).xyz;
  gl_FragColor = vec4(0.5 * vec3(dy.z - dz.y, dz.x - dx.z, dx.y - dy.x), 0.0);`,
  `let dx = fetch_uVel(c + vec3i(1,0,0)).xyz - fetch_uVel(c - vec3i(1,0,0)).xyz;
  let dy = fetch_uVel(c + vec3i(0,1,0)).xyz - fetch_uVel(c - vec3i(0,1,0)).xyz;
  let dz = fetch_uVel(c + vec3i(0,0,1)).xyz - fetch_uVel(c - vec3i(0,0,1)).xyz;
  out = vec4f(0.5 * vec3f(dy.z - dz.y, dz.x - dx.z, dx.y - dy.x), 0.0);`,
);

const DIVERGENCE = pass(
  "divergence",
  ["uVel"],
  [],
  `float d = fetch(uVel, c + ivec3(1,0,0)).x - fetch(uVel, c - ivec3(1,0,0)).x
          + fetch(uVel, c + ivec3(0,1,0)).y - fetch(uVel, c - ivec3(0,1,0)).y
          + fetch(uVel, c + ivec3(0,0,1)).z - fetch(uVel, c - ivec3(0,0,1)).z;
  gl_FragColor = vec4(0.5 * d, 0.0, 0.0, 0.0);`,
  `let d = fetch_uVel(c + vec3i(1,0,0)).x - fetch_uVel(c - vec3i(1,0,0)).x
        + fetch_uVel(c + vec3i(0,1,0)).y - fetch_uVel(c - vec3i(0,1,0)).y
        + fetch_uVel(c + vec3i(0,0,1)).z - fetch_uVel(c - vec3i(0,0,1)).z;
  out = vec4f(0.5 * d, 0.0, 0.0, 0.0);`,
);

// One Jacobi iteration; the top face is open (pressure 0 above).
const JACOBI = pass(
  "jacobi",
  ["uPres", "uDiv"],
  [],
  `float top = c.y == int(uDims.y) - 1 ? 0.0 : fetch(uPres, c + ivec3(0,1,0)).r;
  float s = fetch(uPres, c + ivec3(1,0,0)).r + fetch(uPres, c - ivec3(1,0,0)).r
          + top + fetch(uPres, c - ivec3(0,1,0)).r
          + fetch(uPres, c + ivec3(0,0,1)).r + fetch(uPres, c - ivec3(0,0,1)).r;
  gl_FragColor = vec4((s - fetch(uDiv, c).r) / 6.0, 0.0, 0.0, 0.0);`,
  `var top = 0.0;
  if (c.y != i32(uniform.uDims.y) - 1) { top = fetch_uPres(c + vec3i(0,1,0)).r; }
  let s = fetch_uPres(c + vec3i(1,0,0)).r + fetch_uPres(c - vec3i(1,0,0)).r
        + top + fetch_uPres(c - vec3i(0,1,0)).r
        + fetch_uPres(c + vec3i(0,0,1)).r + fetch_uPres(c - vec3i(0,0,1)).r;
  out = vec4f((s - fetch_uDiv(c).r) / 6.0, 0.0, 0.0, 0.0);`,
);

const GRADIENT = pass(
  "gradient",
  ["uVel", "uPres"],
  [],
  `vec4 v = fetch(uVel, c);
  float top = c.y == int(uDims.y) - 1 ? 0.0 : fetch(uPres, c + ivec3(0,1,0)).r;
  vec3 g = 0.5 * vec3(fetch(uPres, c + ivec3(1,0,0)).r - fetch(uPres, c - ivec3(1,0,0)).r,
                      top - fetch(uPres, c - ivec3(0,1,0)).r,
                      fetch(uPres, c + ivec3(0,0,1)).r - fetch(uPres, c - ivec3(0,0,1)).r);
  gl_FragColor = vec4(v.xyz - g, v.w);`,
  `let v = fetch_uVel(c);
  var top = 0.0;
  if (c.y != i32(uniform.uDims.y) - 1) { top = fetch_uPres(c + vec3i(0,1,0)).r; }
  let g = 0.5 * vec3f(fetch_uPres(c + vec3i(1,0,0)).r - fetch_uPres(c - vec3i(1,0,0)).r,
                      top - fetch_uPres(c - vec3i(0,1,0)).r,
                      fetch_uPres(c + vec3i(0,0,1)).r - fetch_uPres(c - vec3i(0,0,1)).r);
  out = vec4f(v.xyz - g, v.w);`,
);

const CLEAR = pass("clear", [], [], `gl_FragColor = vec4(0.0);`, `out = vec4f(0.0);`);

// Grid sizes per tier (cells along the widest side; the height is doubled),
// Jacobi iterations, and steps per second.
export const GAS_TIERS = {
  low: { n: 24, jacobi: 12, hz: 30 },
  mid: { n: 32, jacobi: 16, hz: 30 },
  high: { n: 44, jacobi: 20, hz: 45 },
  max: { n: 56, jacobi: 24, hz: 60 },
};

// One gas grid. spec: { at: [x, y, z] (bottom center, recipe units), size:
// [w, h, d] (recipe units) }. A system (smoke, steam or a flame with its
// smoke) feeds it through sources().
export class GasGrid {
  constructor(device, { at, size, profile = "high" }) {
    this.device = device;
    const tier = GAS_TIERS[profile] || GAS_TIERS.high;
    this.tier = tier;
    const widest = Math.max(size[0], size[2]);
    const cell = widest / tier.n;
    this.cell = cell;
    const dims = size.map((s) => Math.max(4, Math.round(s / cell)));
    this.dims = dims;
    this.at = at;
    this.size = size;
    // lower corner of the grid in recipe units
    this.lo = [at[0] - (dims[0] * cell) / 2, at[1], at[2] - (dims[2] * cell) / 2];
    const tilesX = Math.ceil(Math.sqrt(dims[2]));
    const tilesY = Math.ceil(dims[2] / tilesX);
    this.tilesX = tilesX;
    this.atlas = [tilesX * dims[0], tilesY * dims[1]];
    this.uDims = [dims[0], dims[1], dims[2], tilesX];
    const fmt = pc.PIXELFORMAT_RGBA16F;
    const make = (name) => {
      const tex = new pc.Texture(device, {
        name: `flGas-${name}`,
        width: this.atlas[0],
        height: this.atlas[1],
        format: fmt,
        mipmaps: false,
        minFilter: pc.FILTER_NEAREST,
        magFilter: pc.FILTER_NEAREST,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE,
      });
      const rt = new pc.RenderTarget({ colorBuffer: tex, depth: false });
      return { tex, rt };
    };
    this.t = {};
    for (const n of ["velA", "velB", "scalA", "scalB", "presA", "presB", "div", "curl"]) this.t[n] = make(n); // prettier-ignore
    this.sh = {};
    this.passes = {};
    for (const p of [ADVECT, FORCES_VEL, FORCES_SCAL, CURL, DIVERGENCE, JACOBI, GRADIENT, CLEAR]) {
      this.sh[p.name] = pc.ShaderUtils.createShader(device, {
        uniqueName: `flGas-${p.name}`,
        attributes: { aPosition: pc.SEMANTIC_POSITION },
        vertexGLSL: QUAD_VS,
        fragmentGLSL: p.glsl,
        vertexWGSL: QUAD_VS_W,
        fragmentWGSL: p.wgsl,
      });
    }
    this.quadPasses = new Map();
    this.time = 0;
    this.acc = 0;
    this.sources = { a: null, b: null };
    this.params = { heatLift: 60, smokeWeight: 2, burn: 6, burnHeat: 1.5, vort: 6, decay: [0.985, 0.97, 0.9, 1], velDecay: 0.995, wind: [0, 0, 0], noise: 4 }; // prettier-ignore
    this.clearAll();
  }

  // Recipe units -> cells.
  toCell(p) {
    return [(p[0] - this.lo[0]) / this.cell, (p[1] - this.lo[1]) / this.cell, (p[2] - this.lo[2]) / this.cell]; // prettier-ignore
  }

  quad(shaderName, target) {
    const key = `${shaderName}:${target.tex.name}`;
    let p = this.quadPasses.get(key);
    if (!p) {
      p = new pc.RenderPassShaderQuad(this.device);
      p.shader = this.sh[shaderName];
      p.init(target.rt);
      p.colorOps.clear = false;
      this.quadPasses.set(key, p);
    }
    return p;
  }

  run(shaderName, target, values) {
    const scope = this.device.scope;
    scope.resolve("uDims").setValue(this.uDims);
    for (const k in values) scope.resolve(k).setValue(values[k]);
    this.quad(shaderName, target).render();
  }

  clearAll() {
    for (const k in this.t) this.run("clear", this.t[k], {});
  }

  swap(a, b) {
    const t = this.t[a];
    this.t[a] = this.t[b];
    this.t[b] = t;
  }

  // One step of dt seconds. Sources: { a, b } each { at (recipe), radius
  // (recipe), smoke, heat, fuel (per second), up (recipe units/s) } or null.
  step(dt) {
    const t = this.t;
    const P = this.params;
    this.time += dt;
    const src = (s) => {
      if (!s) return [[0, -1e4, 0, 0], [0, 0, 0, 0]]; // prettier-ignore
      const c = this.toCell(s.at);
      return [
        [c[0], c[1], c[2], Math.max(1.2, s.radius / this.cell)],
        [s.smoke || 0, s.heat || 0, s.fuel || 0, (s.up || 0) / this.cell],
      ];
    };
    const [sa, aa] = src(this.sources.a);
    const [sb, ab] = src(this.sources.b);
    const u = { uDt: dt, uSrcA: sa, uAddA: aa, uSrcB: sb, uAddB: ab };
    // curl, forces on velocity, sources on scalars
    this.run("curl", t.curl, { uVel: t.velA.tex });
    const wind = P.wind.map((w) => w / this.cell);
    this.run("forcesVel", t.velB, { ...u, uVel: t.velA.tex, uScal: t.scalA.tex, uCurl: t.curl.tex, uBuoy: [P.heatLift, P.smokeWeight, P.burn, P.burnHeat], uWind: [...wind, P.noise], uVort: P.vort, uTime: this.time }); // prettier-ignore
    this.swap("velA", "velB");
    this.run("forcesScal", t.scalB, { ...u, uScal: t.scalA.tex, uBuoy: [P.heatLift, P.smokeWeight, P.burn, P.burnHeat] }); // prettier-ignore
    this.swap("scalA", "scalB");
    // project
    this.run("divergence", t.div, { uVel: t.velA.tex });
    for (let i = 0; i < (this.jacobi ?? this.tier.jacobi); i++) {
      this.run("jacobi", t.presB, { uPres: t.presA.tex, uDiv: t.div.tex });
      this.swap("presA", "presB");
    }
    this.run("gradient", t.velB, { uVel: t.velA.tex, uPres: t.presA.tex });
    this.swap("velA", "velB");
    // advect velocity and scalars
    const vd = Math.pow(P.velDecay, dt * 60);
    this.run("advect", t.velB, { uDt: dt, uVel: t.velA.tex, uSrc: t.velA.tex, uDecay: [vd, vd, vd, 1] }); // prettier-ignore
    const d = P.decay.map((k) => Math.pow(k, dt * 60));
    this.run("advect", t.scalB, { uDt: dt, uVel: t.velA.tex, uSrc: t.scalA.tex, uDecay: d });
    this.swap("velA", "velB");
    this.swap("scalA", "scalB");
  }

  // Steps to catch up with dt at the tier's rate (at most 3 a frame).
  advance(dt) {
    const h = 1 / (this.hz ?? this.tier.hz);
    this.acc = Math.min(this.acc + dt, (this.maxSteps ?? 3) * h);
    let n = 0;
    while (this.acc >= h - 1e-6) {
      this.acc -= h;
      this.step(h);
      n++;
    }
    return n;
  }

  get scalars() {
    return this.t.scalA.tex;
  }

  destroy() {
    for (const p of this.quadPasses.values()) p.destroy?.();
    for (const k in this.t) {
      this.t[k].rt.destroy();
      this.t[k].tex.destroy();
    }
    for (const s of Object.values(this.sh)) s.destroy();
  }
}

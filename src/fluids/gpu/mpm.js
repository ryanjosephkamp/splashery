// Lane Fluids r4: a liquid solver on the GPU (WebGPU compute), MLS-MPM.
//
// Moving least squares material point method (Hu et al., "A Moving Least
// Squares Material Point Method with Displacement Discontinuity and Two-Way
// Rigid Body Coupling", 2018), in its fluid form (a weakly compressible
// liquid with a Tait equation of state and a viscous stress, as in nialltl's
// "incremental MPM" notes and many browser demos). Each substep:
//
//   1. clear      the grid (momentum and mass, fixed point, atomics)
//   2. p2g mass   particles scatter mass and APIC momentum to 27 cells
//   3. p2g stress particles read their density back from the grid and
//                 scatter pressure and viscous forces
//   4. grid       momentum -> velocity, gravity, colliders, walls
//   5. g2p        particles gather velocity and its gradient (APIC), move
//
// Everything is in grid units (a cell is 1) and seconds; the world is
// origin + x * h. No read-back: the last g2p also writes each particle's
// place into a float texture that the liquid surface pass reads.

import * as pc from "../../pc.js";

// Particle record: 5 vec4 = position (w: kind), velocity (w: age), C rows.
export const PARTICLE_VEC4 = 5;
// Fixed-point scale for the atomic grid (i32).
// Grid sums must stay within an i32: momentum and forces are in cells/s.
const FIX = 10000;
export const MAX_COLLIDERS = 6;

const COMMON = /* wgsl */ `
struct U {
  count: u32,
  gx: u32,
  gy: u32,
  gz: u32,
  dt: f32,
  rho0: f32,
  stiffness: f32,
  viscosity: f32,
  gravity: vec4f,
  friction: f32,
  texWidth: u32,
  ncol: u32,
  pad: u32,
  tension: f32,
  pad1: f32,
  pad2: f32,
  pad3: f32,
  cols: array<vec4f, ${MAX_COLLIDERS * 2}>,
};
@group(0) @binding(0) var<storage, read_write> particles: array<vec4f>;
@group(0) @binding(1) var<storage, read_write> grid: array<atomic<i32>>;
@group(0) @binding(2) var<storage, read_write> gridV: array<vec4f>;
@group(0) @binding(3) var<uniform> u: U;
@group(0) @binding(4) var outTex: texture_storage_2d<rgba32float, write>;

const FIX: f32 = ${FIX}.0;

fn cellIndex(c: vec3i) -> i32 {
  return (c.z * i32(u.gy) + c.y) * i32(u.gx) + c.x;
}
fn inGrid(c: vec3i) -> bool {
  return all(c >= vec3i(0)) && c.x < i32(u.gx) && c.y < i32(u.gy) && c.z < i32(u.gz);
}
// Quadratic B-spline weights for the 3 nodes around x (nodes at integers).
struct W { base: vec3i, w0: vec3f, w1: vec3f, w2: vec3f, fx: vec3f };
fn weights(x: vec3f) -> W {
  var r: W;
  let cell = floor(x - 0.5);
  r.base = vec3i(cell);
  let d = x - cell; // distance from the first node, in [0.5, 1.5)
  r.fx = d;
  r.w0 = 0.5 * (1.5 - d) * (1.5 - d);
  r.w1 = 0.75 - (d - 1.0) * (d - 1.0);
  r.w2 = 0.5 * (d - 0.5) * (d - 0.5);
  return r;
}
fn wAt(w: W, i: i32, j: i32, k: i32) -> f32 {
  let wx = select(select(w.w2.x, w.w1.x, i == 1), w.w0.x, i == 0);
  let wy = select(select(w.w2.y, w.w1.y, j == 1), w.w0.y, j == 0);
  let wz = select(select(w.w2.z, w.w1.z, k == 1), w.w0.z, k == 0);
  return wx * wy * wz;
}

// Colliders in grid units: type in cols[2i].x (1 floor, 2 box, 3 sphere,
// 4 glass (open cylinder with a bottom), 5 bowl), params in the rest.
fn sdCol(i: u32, p: vec3f) -> f32 {
  let a = u.cols[i * 2u];
  let b = u.cols[i * 2u + 1u];
  let t = u32(a.x);
  if (t == 1u) { return p.y - a.y; }
  if (t == 2u) {
    let q = abs(p - b.xyz) - vec3f(a.y, a.z, a.w);
    return length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
  }
  if (t == 3u) { return length(p - b.xyz) - a.y; }
  if (t == 4u) {
    // a.y inner radius, a.z height, a.w wall; b.xyz base center, b.w bottom
    let q = p - b.xyz;
    let r = length(q.xz);
    let inner = a.y;
    let outer = a.y + a.w;
    // solid = ring (inner..outer, 0..h) plus bottom disc (0..outer, 0..bottom)
    let dRing = max(max(inner - r, r - outer), max(-q.y, q.y - a.z));
    // (the bottom reaches two cells below the base, so nothing leaks under)
    let dBot = max(r - outer, max(-q.y - 2.0, q.y - b.w));
    return min(dRing, dBot);
  }
  if (t == 5u) {
    // bowl: half sphere shell, a.y inner radius, a.w wall; b.xyz rim center
    let q = p - b.xyz;
    let d = length(q);
    let shell = max(a.y - d, d - (a.y + a.w));
    return max(shell, q.y);
  }
  return 1e9;
}
fn sdAll(p: vec3f) -> f32 {
  var d = 1e9;
  for (var i = 0u; i < u.ncol; i++) { d = min(d, sdCol(i, p)); }
  return d;
}
fn nAll(p: vec3f) -> vec3f {
  let e = 0.35;
  let k = vec2f(1.0, -1.0);
  return normalize(k.xyy * sdAll(p + k.xyy * e) + k.yyx * sdAll(p + k.yyx * e) +
                   k.yxy * sdAll(p + k.yxy * e) + k.xxx * sdAll(p + k.xxx * e) + vec3f(1e-9));
}
`;

const CLEAR = /* wgsl */ `
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let n = u.gx * u.gy * u.gz;
  if (id.x >= n) { return; }
  let i = id.x * 4u;
  atomicStore(&grid[i], 0);
  atomicStore(&grid[i + 1u], 0);
  atomicStore(&grid[i + 2u], 0);
  atomicStore(&grid[i + 3u], 0);
}
`;

const P2G_MASS = /* wgsl */ `
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= u.count) { return; }
  let b = id.x * ${PARTICLE_VEC4}u;
  let x = particles[b].xyz;
  let v = particles[b + 1u].xyz;
  let C = mat3x3f(particles[b + 2u].xyz, particles[b + 3u].xyz, particles[b + 4u].xyz);
  let w = weights(x);
  for (var i = 0; i < 3; i++) {
    for (var j = 0; j < 3; j++) {
      for (var k = 0; k < 3; k++) {
        let c = w.base + vec3i(i, j, k);
        if (!inGrid(c)) { continue; }
        let wt = wAt(w, i, j, k);
        let dpos = vec3f(c) - x;
        let q = C * dpos;
        let mv = wt * (v + q);
        let gi = u32(cellIndex(c)) * 4u;
        atomicAdd(&grid[gi], i32(round(mv.x * FIX)));
        atomicAdd(&grid[gi + 1u], i32(round(mv.y * FIX)));
        atomicAdd(&grid[gi + 2u], i32(round(mv.z * FIX)));
        atomicAdd(&grid[gi + 3u], i32(round(wt * FIX)));
      }
    }
  }
}
`;

const P2G_STRESS = /* wgsl */ `
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= u.count) { return; }
  let b = id.x * ${PARTICLE_VEC4}u;
  let x = particles[b].xyz;
  let C = mat3x3f(particles[b + 2u].xyz, particles[b + 3u].xyz, particles[b + 4u].xyz);
  let w = weights(x);
  // Density: the grid's mass around the particle (particle mass 1, cell volume 1).
  var density = 0.0;
  for (var i = 0; i < 3; i++) {
    for (var j = 0; j < 3; j++) {
      for (var k = 0; k < 3; k++) {
        let c = w.base + vec3i(i, j, k);
        if (!inGrid(c)) { continue; }
        let gi = u32(cellIndex(c)) * 4u;
        density += f32(atomicLoad(&grid[gi + 3u])) / FIX * wAt(w, i, j, k);
      }
    }
  }
  density = max(density, 1e-4);
  let volume = 1.0 / density;
  // Tait equation of state (power 7). Hardly any pull below rest density:
  // a stronger pull acts as a surface tension without wetting, and water
  // then stands in a glass as a dome, like mercury.
  let pressure = clamp(u.stiffness * (pow(min(density / u.rho0, 1.6), 7.0) - 1.0), -u.tension * u.stiffness, 32.0 * u.stiffness);
  var stress = mat3x3f(-pressure, 0.0, 0.0, 0.0, -pressure, 0.0, 0.0, 0.0, -pressure);
  let strain = C + transpose(C);
  stress += u.viscosity * strain;
  let term = -volume * 4.0 * u.dt * stress;
  for (var i = 0; i < 3; i++) {
    for (var j = 0; j < 3; j++) {
      for (var k = 0; k < 3; k++) {
        let c = w.base + vec3i(i, j, k);
        if (!inGrid(c)) { continue; }
        let dpos = vec3f(c) - x;
        let f = wAt(w, i, j, k) * (term * dpos);
        let gi = u32(cellIndex(c)) * 4u;
        atomicAdd(&grid[gi], i32(round(f.x * FIX)));
        atomicAdd(&grid[gi + 1u], i32(round(f.y * FIX)));
        atomicAdd(&grid[gi + 2u], i32(round(f.z * FIX)));
      }
    }
  }
}
`;

const GRID = /* wgsl */ `
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let n = u.gx * u.gy * u.gz;
  if (id.x >= n) { return; }
  let gi = id.x * 4u;
  let m = f32(atomicLoad(&grid[gi + 3u])) / FIX;
  if (m <= 1e-6) { gridV[id.x] = vec4f(0.0); return; }
  var v = vec3f(f32(atomicLoad(&grid[gi])), f32(atomicLoad(&grid[gi + 1u])), f32(atomicLoad(&grid[gi + 2u]))) / FIX / m;
  v += u.gravity.xyz * u.dt;
  let cx = id.x % u.gx;
  let cy = (id.x / u.gx) % u.gy;
  let cz = id.x / (u.gx * u.gy);
  // The domain's walls (two cells thick).
  if (cx < 2u && v.x < 0.0) { v.x = 0.0; }
  if (cx > u.gx - 3u && v.x > 0.0) { v.x = 0.0; }
  if (cy < 2u && v.y < 0.0) { v.y = 0.0; }
  if (cy > u.gy - 3u && v.y > 0.0) { v.y = 0.0; }
  if (cz < 2u && v.z < 0.0) { v.z = 0.0; }
  if (cz > u.gz - 3u && v.z > 0.0) { v.z = 0.0; }
  // Colliders: at a node inside or at a solid, remove the velocity into it
  // (separating, with a little friction along it).
  let p = vec3f(f32(cx), f32(cy), f32(cz));
  let d = sdAll(p);
  if (d < 1.0) {
    let nrm = nAll(p);
    let vn = dot(v, nrm);
    if (vn < 0.0) {
      let vt = v - vn * nrm;
      let lt = length(vt);
      let keep = select(max(0.0, 1.0 + u.friction * vn / max(lt, 1e-6)), 1.0, lt < 1e-6);
      v = vt * keep;
    }
  }
  gridV[id.x] = vec4f(v, m);
}
`;

const G2P = /* wgsl */ `
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= u.count) { return; }
  let b = id.x * ${PARTICLE_VEC4}u;
  var x = particles[b].xyz;
  let w = weights(x);
  var v = vec3f(0.0);
  var B = mat3x3f(vec3f(0.0), vec3f(0.0), vec3f(0.0));
  for (var i = 0; i < 3; i++) {
    for (var j = 0; j < 3; j++) {
      for (var k = 0; k < 3; k++) {
        let c = w.base + vec3i(i, j, k);
        if (!inGrid(c)) { continue; }
        let dpos = vec3f(c) - x;
        let gv = gridV[cellIndex(c)].xyz;
        let wt = wAt(w, i, j, k);
        v += wt * gv;
        // B += w * v (outer) dpos; columns of mat3x3f are dpos components.
        B += mat3x3f(gv * (wt * dpos.x), gv * (wt * dpos.y), gv * (wt * dpos.z));
      }
    }
  }
  let C = 4.0 * B;
  x += v * u.dt;
  // Keep inside the domain and out of the colliders.
  let lo = vec3f(1.0);
  let hi = vec3f(f32(u.gx), f32(u.gy), f32(u.gz)) - 1.0;
  x = clamp(x, lo, hi);
  let d = sdAll(x);
  if (d < 0.0) { x -= nAll(x) * d; }
  particles[b] = vec4f(x, particles[b].w);
  particles[b + 1u] = vec4f(v, particles[b + 1u].w + u.dt);
  // C is stored as its three columns.
  particles[b + 2u] = vec4f(C[0], 0.0);
  particles[b + 3u] = vec4f(C[1], 0.0);
  particles[b + 4u] = vec4f(C[2], 0.0);
}
`;

// Writes each particle's place (grid units) and speed into the texture.
const OUT = /* wgsl */ `
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= u.count) { return; }
  let b = id.x * ${PARTICLE_VEC4}u;
  let x = particles[b].xyz;
  let v = particles[b + 1u].xyz;
  let q = vec2i(i32(id.x % u.texWidth), i32(id.x / u.texWidth));
  textureStore(outTex, q, vec4f(x, length(v)));
  // the lower half: velocities (cells/s), for drawing fast flow stretched
  // (w: the particle's age in seconds, for a lava's cooling)
  textureStore(outTex, q + vec2i(0, i32(u.pad)), vec4f(v, particles[b + 1u].w));
}
`;

// Collider records for the uniform block, in grid units. `toGrid` maps a
// recipe-space point to grid units; `s` scales a length.
export function packColliders(colliders, toGrid, s) {
  const out = new Float32Array(MAX_COLLIDERS * 8);
  let n = 0;
  for (const c of colliders || []) {
    if (n >= MAX_COLLIDERS) break;
    const o = n * 8;
    const at = toGrid(c.at || [0, 0, 0]);
    if (c.type === "floor") {
      out[o] = 1;
      out[o + 1] = toGrid([0, c.y ?? 0, 0])[1];
    } else if (c.type === "box") {
      out[o] = 2;
      const size = c.size || [1, 1, 1];
      out[o + 1] = (size[0] / 2) * s;
      out[o + 2] = (size[1] / 2) * s;
      out[o + 3] = (size[2] / 2) * s;
      out.set(at, o + 4);
    } else if (c.type === "sphere") {
      out[o] = 3;
      out[o + 1] = (c.radius ?? 0.5) * s;
      out.set(at, o + 4);
    } else if (c.type === "glass" || c.type === "cylinder") {
      out[o] = 4;
      // (half a cell wider than drawn: the liquid stops about half a cell
      // short of a solid, and should meet the drawn wall)
      out[o + 1] = (c.radius ?? 0.3) * s + 0.5;
      out[o + 2] = (c.height ?? 1) * s;
      // At least three cells of wall: a thin wall lets particles through
      // (the drawn glass keeps its own wall).
      out[o + 3] = Math.max(3, (c.wall ?? 0.03) * s);
      out.set(at, o + 4);
      out[o + 7] = Math.max(1.2, (c.bottom ?? 0.05) * s);
    } else if (c.type === "bowl") {
      out[o] = 5;
      out[o + 1] = (c.radius ?? 0.5) * s;
      out[o + 3] = Math.max(3, (c.wall ?? 0.03) * s);
      out.set(at, o + 4);
    } else continue;
    n++;
  }
  return { data: out, count: n };
}

export class GpuMpm {
  // spec: { cap, grid: [gx, gy, gz], texWidth }
  constructor(device, { cap, grid, texWidth = 512 }) {
    if (!device.supportsCompute) throw new Error("No compute");
    this.device = device;
    this.cap = cap;
    this.grid = grid;
    this.texWidth = texWidth;
    this.count = 0;
    const cells = grid[0] * grid[1] * grid[2];
    this.cells = cells;
    const usage = pc.BUFFERUSAGE_COPY_DST | pc.BUFFERUSAGE_COPY_SRC;
    this.particles = new pc.StorageBuffer(device, cap * PARTICLE_VEC4 * 16, usage);
    this.gridBuf = new pc.StorageBuffer(device, cells * 16, usage);
    this.gridV = new pc.StorageBuffer(device, cells * 16, usage);
    this.texHeight = Math.ceil(cap / texWidth);
    // Rows 0..texHeight: places and speeds; texHeight..2 texHeight: velocities.
    this.outTex = new pc.Texture(device, {
      name: "flParticles",
      width: texWidth,
      height: this.texHeight * 2,
      format: pc.PIXELFORMAT_RGBA32F,
      mipmaps: false,
      storage: true,
      minFilter: pc.FILTER_NEAREST,
      magFilter: pc.FILTER_NEAREST,
    });
    this.ubFormat = new pc.UniformBufferFormat(device, [
      new pc.UniformFormat("count", pc.UNIFORMTYPE_UINT),
      new pc.UniformFormat("gx", pc.UNIFORMTYPE_UINT),
      new pc.UniformFormat("gy", pc.UNIFORMTYPE_UINT),
      new pc.UniformFormat("gz", pc.UNIFORMTYPE_UINT),
      new pc.UniformFormat("dt", pc.UNIFORMTYPE_FLOAT),
      new pc.UniformFormat("rho0", pc.UNIFORMTYPE_FLOAT),
      new pc.UniformFormat("stiffness", pc.UNIFORMTYPE_FLOAT),
      new pc.UniformFormat("viscosity", pc.UNIFORMTYPE_FLOAT),
      new pc.UniformFormat("gravity", pc.UNIFORMTYPE_VEC4),
      new pc.UniformFormat("friction", pc.UNIFORMTYPE_FLOAT),
      new pc.UniformFormat("texWidth", pc.UNIFORMTYPE_UINT),
      new pc.UniformFormat("ncol", pc.UNIFORMTYPE_UINT),
      new pc.UniformFormat("pad", pc.UNIFORMTYPE_UINT),
      new pc.UniformFormat("tension", pc.UNIFORMTYPE_FLOAT),
      new pc.UniformFormat("pad1", pc.UNIFORMTYPE_FLOAT),
      new pc.UniformFormat("pad2", pc.UNIFORMTYPE_FLOAT),
      new pc.UniformFormat("pad3", pc.UNIFORMTYPE_FLOAT),
      new pc.UniformFormat("cols", pc.UNIFORMTYPE_VEC4, MAX_COLLIDERS * 2),
    ]);
    this.bgFormat = new pc.BindGroupFormat(device, [
      new pc.BindStorageBufferFormat("particles", pc.SHADERSTAGE_COMPUTE, false),
      new pc.BindStorageBufferFormat("grid", pc.SHADERSTAGE_COMPUTE, false),
      new pc.BindStorageBufferFormat("gridV", pc.SHADERSTAGE_COMPUTE, false),
      new pc.BindUniformBufferFormat("u", pc.SHADERSTAGE_COMPUTE),
      new pc.BindStorageTextureFormat("outTex", pc.PIXELFORMAT_RGBA32F, pc.TEXTUREDIMENSION_2D),
    ]);
    const make = (name, src) => {
      const shader = new pc.Shader(device, {
        name: `flMpm-${name}`,
        shaderLanguage: pc.SHADERLANGUAGE_WGSL,
        cshader: COMMON + src,
        computeEntryPoint: "main",
        computeBindGroupFormat: this.bgFormat,
        computeUniformBufferFormats: { u: this.ubFormat },
      });
      const c = new pc.Compute(device, shader, `flMpm-${name}`);
      c.setParameter("particles", this.particles);
      c.setParameter("grid", this.gridBuf);
      c.setParameter("gridV", this.gridV);
      c.setParameter("outTex", this.outTex);
      return { shader, c };
    };
    this.k = {
      clear: make("clear", CLEAR),
      p2gMass: make("p2gMass", P2G_MASS),
      p2gStress: make("p2gStress", P2G_STRESS),
      grid: make("grid", GRID),
      g2p: make("g2p", G2P),
      out: make("out", OUT),
    };
    this.params = {
      dt: 1 / 600,
      rho0: 4,
      stiffness: 3,
      viscosity: 0.1,
      gravity: [0, -9.8, 0, 0],
      friction: 0.2,
      cols: new Float32Array(MAX_COLLIDERS * 8),
      ncol: 0,
    };
  }

  // Appends particles: positions (grid units) and velocities, Float32Array
  // of 3 per particle each. Kind per particle (optional).
  add(pos, vel, kind = 0, age = 0) {
    const n = Math.min(pos.length / 3, this.cap - this.count);
    if (n <= 0) return 0;
    const data = new Float32Array(n * PARTICLE_VEC4 * 4);
    for (let i = 0; i < n; i++) {
      const o = i * PARTICLE_VEC4 * 4;
      data[o] = pos[i * 3];
      data[o + 1] = pos[i * 3 + 1];
      data[o + 2] = pos[i * 3 + 2];
      data[o + 3] = kind;
      data[o + 4] = vel ? vel[i * 3] : 0;
      data[o + 5] = vel ? vel[i * 3 + 1] : 0;
      data[o + 6] = vel ? vel[i * 3 + 2] : 0;
      data[o + 7] = age;
    }
    this.particles.write(this.count * PARTICLE_VEC4 * 16, data, 0, data.length);
    this.count += n;
    return n;
  }

  reset() {
    this.count = 0;
  }

  // Removes the last `n` particles (a drain from the end).
  trim(n) {
    this.count = Math.max(0, this.count - n);
  }

  applyUniforms(c) {
    const p = this.params;
    c.setParameter("count", this.count);
    c.setParameter("gx", this.grid[0]);
    c.setParameter("gy", this.grid[1]);
    c.setParameter("gz", this.grid[2]);
    c.setParameter("dt", p.dt);
    c.setParameter("rho0", p.rho0);
    c.setParameter("stiffness", p.stiffness);
    c.setParameter("viscosity", p.viscosity);
    c.setParameter("gravity", p.gravity);
    c.setParameter("friction", p.friction);
    c.setParameter("texWidth", this.texWidth);
    c.setParameter("ncol", p.ncol);
    c.setParameter("pad", this.texHeight); // the velocity rows start here
    c.setParameter("tension", p.tension ?? 0.01);
    c.setParameter("pad1", 0);
    c.setParameter("pad2", 0);
    c.setParameter("pad3", 0);
    c.setParameter("cols[0]", p.cols);
  }

  // Runs `steps` substeps and writes the particle texture.
  step(steps) {
    if (!this.count) return;
    const k = this.k;
    const pg = Math.ceil(this.count / 64);
    const gg = Math.ceil(this.cells / 64);
    const list = [];
    const add = (entry, groups) => {
      this.applyUniforms(entry.c);
      entry.c.setupDispatch(groups, 1, 1);
      list.push(entry.c);
    };
    const only = this.only; // debugging: a subset of the kernels
    for (let s = 0; s < steps; s++) {
      if (!only || only.includes("clear")) add(k.clear, gg);
      if (!only || only.includes("p2gMass")) add(k.p2gMass, pg);
      if (!only || only.includes("p2gStress")) add(k.p2gStress, pg);
      if (!only || only.includes("grid")) add(k.grid, gg);
      if (!only || only.includes("g2p")) add(k.g2p, pg);
    }
    add(k.out, pg);
    // Uniform buffers are per Compute, so repeating one in a list reuses the
    // last values, which is what we want (they are the same every substep).
    this.device.computeDispatch(list, "flMpm");
  }

  // Reads the particles back: six floats a particle (position, velocity).
  // The diffuse pass calls it about 10 to 30 times a second with one read in
  // flight (diffuse.js), so it passes `reuse` (r7): the byte and float arrays
  // are kept between reads and the result is one view of the kept array, valid
  // until the next read. Tests and tools get a fresh array each time.
  async readPositions(reuse = false) {
    const count = this.count;
    const bytes = count * PARTICLE_VEC4 * 16;
    if (!bytes) return new Float32Array(0);
    let dst = null;
    if (reuse) {
      if (!this.rbBytes || this.rbBytes.byteLength < bytes) this.rbBytes = new Uint8Array(bytes);
      dst = this.rbBytes;
    }
    const buf = await this.particles.read(0, bytes, dst, true);
    const f = new Float32Array(buf.buffer, buf.byteOffset, bytes / 4);
    const n = count * 6;
    let out;
    if (reuse) {
      if (!this.rbOut || this.rbOut.length < n) this.rbOut = new Float32Array(n);
      out = this.rbOut;
    } else out = new Float32Array(n);
    for (let i = 0; i < count; i++) {
      const o = i * PARTICLE_VEC4 * 4;
      const p = i * 6;
      out[p] = f[o];
      out[p + 1] = f[o + 1];
      out[p + 2] = f[o + 2];
      out[p + 3] = f[o + 4];
      out[p + 4] = f[o + 5];
      out[p + 5] = f[o + 6];
    }
    return reuse ? out.subarray(0, n) : out;
  }

  destroy() {
    for (const e of Object.values(this.k)) {
      e.c.destroy();
      e.shader.destroy();
    }
    this.particles.destroy();
    this.gridBuf.destroy();
    this.gridV.destroy();
    this.outTex.destroy();
  }
}

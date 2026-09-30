// Hybrid mode's models (docs/WORLDS.md, "Rendering"): the ground, the water,
// the sky and the sign boards are ordinary lit models; the props, the
// character and the near grass stay splats.
//
// - The ground is a mesh of the same height field (terrain.js stays the one
//   truth), colored per vertex by the terrain's own palette (colorAt, without
//   its baked light) and detailed by four CC0 textures in one atlas, picked
//   per pixel by height and slope the way the splats pick sand, grass, rock
//   and wet sand. The engine lights it with the sun, the sky's image-based
//   light and the props' shadows.
// - The water is a flat mesh that knows the depth below each vertex: pale
//   and clear over the shallows, deep blue out at sea, foam at the shore,
//   waves in its normals and the sky in its reflection (stronger at grazing
//   angles, the engine's Fresnel).
// - The sky is a dome with a CC0 HDRI's upper part; the same HDRI lights the
//   models.
// - Signs are wooden boards with the landmark's title painted on.

import * as pc from "../pc.js";
import { rgb, clamp } from "../kit.js";
import { mulberry32, mixSeed } from "../noise.js";

const DEG = Math.PI / 180;
const ASSETS = new URL("../../assets/worlds/", import.meta.url);

// ---- Loading ------------------------------------------------------------------------

async function loadImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return createImageBitmap(await res.blob());
}

function imageTexture(device, img, { srgb = true, name = "wd" } = {}) {
  const t = new pc.Texture(device, {
    name,
    width: img.width,
    height: img.height,
    format: srgb ? pc.PIXELFORMAT_SRGBA8 : pc.PIXELFORMAT_RGBA8,
    mipmaps: true,
    minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
    magFilter: pc.FILTER_LINEAR,
    addressU: pc.ADDRESS_REPEAT,
    addressV: pc.ADDRESS_CLAMP_TO_EDGE,
    anisotropy: 8,
  });
  t.setSource(img);
  return t;
}

// Everything hybrid mode loads: the ground atlas (albedo and normals, with
// their layout), the sky dome image and the HDRI.
export async function loadHybridAssets(app) {
  const device = app.graphicsDevice;
  const [groundInfo, skyInfo] = await Promise.all([
    fetch(new URL("ground/ground.json", ASSETS)).then((r) => r.json()),
    fetch(new URL("sky/sky.json", ASSETS)).then((r) => r.json()),
  ]);
  const [albedo, normal, dome, hdr] = await Promise.all([
    loadImage(new URL("ground/albedo.jpg", ASSETS)),
    loadImage(new URL("ground/normal.jpg", ASSETS)),
    loadImage(new URL(`sky/${skyInfo.dome}`, ASSETS)),
    new Promise((resolve, reject) => {
      app.assets.loadFromUrl(new URL(`sky/${skyInfo.hdr}`, ASSETS).href, "texture", (err, asset) => (err ? reject(new Error(err)) : resolve(asset.resource))); // prettier-ignore
    }),
  ]);
  return {
    ground: groundInfo,
    sky: skyInfo,
    albedo: imageTexture(device, albedo, { name: "wd-ground-albedo" }),
    normal: imageTexture(device, normal, { srgb: false, name: "wd-ground-normal" }),
    dome: imageTexture(device, dome, { name: "wd-sky" }),
    hdr,
  };
}

// ---- Ground ---------------------------------------------------------------------------

// The ground as meshes, in square tiles of `tile` meters with a vertex every
// `step` meters, in world coordinates. Tiles wholly deeper than `above`
// are left out. `color` (x, z, h, n) => [r, g, b, a] fills vertex colors
// (0..1, sRGB); with it, tangents are added too (for the normal maps).
export function groundTiles(
  device,
  terrain,
  { tile = 16, step = 0.5, above = -Infinity, color = null } = {},
) {
  // prettier-ignore
  const half = terrain.half;
  const n = Math.round(tile / step);
  const tiles = [];
  for (let z0 = -half; z0 < half - 1e-6; z0 += tile) {
    for (let x0 = -half; x0 < half - 1e-6; x0 += tile) {
      const V = (n + 1) * (n + 1);
      const pos = new Float32Array(V * 3);
      const nrm = new Float32Array(V * 3);
      const uv = new Float32Array(V * 2);
      const col = color ? new Uint8Array(V * 4) : null;
      const tan = color ? new Float32Array(V * 4) : null;
      let hi = -Infinity;
      for (let b = 0, v = 0; b <= n; b++)
        for (let a = 0; a <= n; a++, v++) {
          const x = x0 + a * step;
          const z = z0 + b * step;
          const h = terrain.heightAt(x, z);
          const nn = terrain.normalAt(x, z, Math.min(0.35, step * 0.7));
          hi = Math.max(hi, h);
          pos.set([x, h, z], v * 3);
          nrm.set(nn, v * 3);
          uv.set([x, z], v * 2);
          if (color) {
            const c = color(x, z, h, nn);
            for (let k = 0; k < 4; k++) col[v * 4 + k] = Math.round(clamp(c[k], 0, 1) * 255);
            // Along +x, kept flat on the surface (Gram-Schmidt).
            const tx = 1 - nn[0] * nn[0];
            const ty = -nn[0] * nn[1];
            const tz = -nn[0] * nn[2];
            const l = Math.hypot(tx, ty, tz) || 1;
            tan.set([tx / l, ty / l, tz / l, -1], v * 4);
          }
        }
      if (hi < above) continue;
      const idx = new Uint32Array(n * n * 6);
      for (let b = 0, k = 0; b < n; b++)
        for (let a = 0; a < n; a++) {
          const i = b * (n + 1) + a;
          // Split each square along the diagonal that follows the ground.
          idx.set([i, i + n + 1, i + 1, i + 1, i + n + 1, i + n + 2], k);
          k += 6;
        }
      const mesh = new pc.Mesh(device);
      mesh.setPositions(pos);
      mesh.setNormals(nrm);
      mesh.setUvs(0, uv);
      if (col) mesh.setColors32(col);
      if (tan) mesh.setVertexStream(pc.SEMANTIC_TANGENT, tan, 4);
      mesh.setIndices(idx);
      mesh.update(pc.PRIMITIVE_TRIANGLES);
      tiles.push({ mesh, x0, z0, size: tile, hi });
    }
  }
  return tiles;
}

// The shared part of the ground's two chunks: which atlas cell each pixel
// uses (sand, grass, rock, wet sand), and where in each cell. Computed in
// getAlbedo() (diffusePS comes first) and reused in getNormal().
const groundCommon = (wgsl) =>
  wgsl
    ? /* wgsl */ `
uniform uWdGround: vec4f;
uniform uWdRepeat: vec4f;
uniform uWdMean0: vec4f;
uniform uWdMean1: vec4f;
uniform uWdMean2: vec4f;
uniform uWdMean3: vec4f;
uniform uWdDetail: vec4f;
uniform uWdStrength: vec4f;
var<private> wdW: vec4f;
var<private> wdFade: f32;
var<private> wdUV: array<vec2f, 4>;
var<private> wdDX: array<vec2f, 4>;
var<private> wdDY: array<vec2f, 4>;
fn wdPrepare() {
  let w = uniform.uWdGround.x;
  let h = vPositionW.y;
  let n = normalize(vNormalW);
  let slope = sqrt(max(0.0, 1.0 - n.y * n.y)) / max(1e-3, n.y);
  let big = vVertexColor.a * 2.0 - 1.0;
  let wet = smoothstep(w + 0.35, w - 0.05, h);
  let edge = w + uniform.uWdGround.y + big * 0.8;
  let grass = smoothstep(edge - 0.25, edge + 0.35, h);
  let rock = smoothstep(uniform.uWdGround.z * 0.8, uniform.uWdGround.z * 1.15, slope);
  wdW = vec4f((1.0 - grass) * (1.0 - wet), grass, 0.0, (1.0 - grass) * wet) * (1.0 - rock);
  wdW.z = rock;
  let d = length(uniform.view_position - vPositionW);
  wdFade = 1.0 - smoothstep(uniform.uWdDetail.x, uniform.uWdDetail.y, d);
  var rep = array<f32, 4>(uniform.uWdRepeat.x, uniform.uWdRepeat.y, uniform.uWdRepeat.z, uniform.uWdRepeat.w);
  let p = vPositionW.xz;
  let dpx = dpdx(p);
  let dpy = dpdy(p);
  for (var k = 0; k < 4; k++) {
    let q = p / rep[k];
    let cell = vec2f(f32(k % 2), f32(k / 2));
    wdUV[k] = (cell * 1024.0 + 32.0 + fract(q) * 960.0) / 2048.0;
    wdDX[k] = dpx / rep[k] * (960.0 / 2048.0);
    wdDY[k] = dpy / rep[k] * (960.0 / 2048.0);
  }
}
`
    : /* glsl */ `
uniform vec4 uWdGround;  // x water level, y beach, z rock slope
uniform vec4 uWdRepeat;  // meters per repeat: sand, grass, rock, wet sand
uniform vec4 uWdMean0;   // each texture's mean linear color
uniform vec4 uWdMean1;
uniform vec4 uWdMean2;
uniform vec4 uWdMean3;
uniform vec4 uWdDetail;  // x, y: the detail fades out between these distances; w normals
uniform vec4 uWdStrength; // how strongly each texture's detail shows
vec4 wdW;
float wdFade;
vec2 wdUV[4];
vec2 wdDX[4];
vec2 wdDY[4];
void wdPrepare() {
  float w = uWdGround.x;
  float h = vPositionW.y;
  vec3 n = normalize(vNormalW);
  float slope = sqrt(max(0.0, 1.0 - n.y * n.y)) / max(1e-3, n.y);
  float big = vVertexColor.a * 2.0 - 1.0;
  float wet = smoothstep(w + 0.35, w - 0.05, h);
  float edge = w + uWdGround.y + big * 0.8;
  float grass = smoothstep(edge - 0.25, edge + 0.35, h);
  float rock = smoothstep(uWdGround.z * 0.8, uWdGround.z * 1.15, slope);
  wdW = vec4((1.0 - grass) * (1.0 - wet), grass, 0.0, (1.0 - grass) * wet) * (1.0 - rock);
  wdW.z = rock;
  float d = length(view_position - vPositionW);
  wdFade = 1.0 - smoothstep(uWdDetail.x, uWdDetail.y, d);
  float rep[4] = float[4](uWdRepeat.x, uWdRepeat.y, uWdRepeat.z, uWdRepeat.w);
  vec2 p = vPositionW.xz;
  vec2 dpx = dFdx(p);
  vec2 dpy = dFdy(p);
  for (int k = 0; k < 4; k++) {
    vec2 q = p / rep[k];
    vec2 cell = vec2(float(k % 2), float(k / 2));
    wdUV[k] = (cell * 1024.0 + 32.0 + fract(q) * 960.0) / 2048.0;
    wdDX[k] = dpx / rep[k] * (960.0 / 2048.0);
    wdDY[k] = dpy / rep[k] * (960.0 / 2048.0);
  }
}
`;

const GROUND_DIFFUSE_GLSL = `
${groundCommon(false)}
void getAlbedo() {
  wdPrepare();
  vec3 tint = saturate(vVertexColor.rgb);
  vec3 ratio = vec3(0.0);
  vec3 means[4] = vec3[4](uWdMean0.rgb, uWdMean1.rgb, uWdMean2.rgb, uWdMean3.rgb);
  for (int k = 0; k < 4; k++) {
    if (wdW[k] > 0.004) {
      vec3 t = {STD_DIFFUSE_TEXTURE_DECODE}(textureGrad({STD_DIFFUSE_TEXTURE_NAME}, wdUV[k], wdDX[k], wdDY[k])).rgb;
      ratio += wdW[k] * mix(vec3(1.0), clamp(t / max(means[k], vec3(0.01)), 0.25, 2.4), uWdStrength[k]);
    } else ratio += wdW[k];
  }
  dAlbedo = tint * mix(vec3(1.0), ratio, wdFade);
}
`;

const GROUND_DIFFUSE_WGSL = `
${groundCommon(true)}
fn getAlbedo() {
  wdPrepare();
  let tint = saturate3(vVertexColor.rgb);
  var ratio = vec3f(0.0);
  var means = array<vec3f, 4>(uniform.uWdMean0.rgb, uniform.uWdMean1.rgb, uniform.uWdMean2.rgb, uniform.uWdMean3.rgb);
  var strength = array<f32, 4>(uniform.uWdStrength.x, uniform.uWdStrength.y, uniform.uWdStrength.z, uniform.uWdStrength.w);
  for (var k = 0; k < 4; k++) {
    let t = {STD_DIFFUSE_TEXTURE_DECODE}(textureSampleGrad({STD_DIFFUSE_TEXTURE_NAME}, {STD_DIFFUSE_TEXTURE_NAME}Sampler, wdUV[k], wdDX[k], wdDY[k])).rgb;
    ratio = ratio + wdW[k] * mix(vec3f(1.0), clamp(t / max(means[k], vec3f(0.01)), vec3f(0.25), vec3f(2.4)), strength[k]);
  }
  dAlbedo = tint * mix(vec3f(1.0), ratio, wdFade);
}
`;

const GROUND_NORMAL_GLSL = `
void getNormal() {
  vec3 nm = vec3(0.0);
  for (int k = 0; k < 4; k++) {
    if (wdW[k] > 0.004) nm += wdW[k] * (textureGrad({STD_NORMAL_TEXTURE_NAME}, wdUV[k], wdDX[k], wdDY[k]).xyz * 2.0 - 1.0);
  }
  nm = normalize(mix(vec3(0.0, 0.0, 1.0), normalize(nm + vec3(0.0, 0.0, 1e-4)), uWdDetail.w * wdFade));
  dNormalW = normalize(dTBN * nm);
}
`;

const GROUND_NORMAL_WGSL = `
fn getNormal() {
  var nm = vec3f(0.0);
  for (var k = 0; k < 4; k++) {
    nm = nm + wdW[k] * (textureSampleGrad({STD_NORMAL_TEXTURE_NAME}, {STD_NORMAL_TEXTURE_NAME}Sampler, wdUV[k], wdDX[k], wdDY[k]).xyz * 2.0 - 1.0);
  }
  nm = normalize(mix(vec3f(0.0, 0.0, 1.0), normalize(nm + vec3f(0.0, 0.0, 1e-4)), uniform.uWdDetail.w * wdFade));
  dNormalW = normalize(dTBN * nm);
}
`;

export function groundMaterial(assets, terrain) {
  const m = new pc.StandardMaterial();
  m.name = "wd-ground";
  m.diffuseMap = assets.albedo;
  m.normalMap = assets.normal;
  m.diffuseVertexColor = true;
  m.vertexColorGamma = true;
  m.useMetalness = true;
  m.metalness = 0;
  m.gloss = 0.18;
  m.specularityFactor = 0.3;
  m.shaderChunks.glsl.set("diffusePS", GROUND_DIFFUSE_GLSL);
  m.shaderChunks.wgsl.set("diffusePS", GROUND_DIFFUSE_WGSL);
  m.shaderChunks.glsl.set("normalMapPS", GROUND_NORMAL_GLSL);
  m.shaderChunks.wgsl.set("normalMapPS", GROUND_NORMAL_WGSL);
  const cells = assets.ground.cells;
  const t = terrain.t;
  m.setParameter("uWdGround", [terrain.water, t.beach, t.rockSlope, t.snowLine]);
  m.setParameter(
    "uWdRepeat",
    cells.map((c) => c.repeat),
  );
  cells.forEach((c, k) => m.setParameter(`uWdMean${k}`, [...c.mean, 0]));
  m.setParameter("uWdDetail", [28, 70, 1, 1]);
  m.setParameter(
    "uWdStrength",
    cells.map((c) => c.strength ?? 0.8),
  );
  m.update();
  return m;
}

// The ground's vertex colors: the terrain's palette without its baked
// light (the engine lights the model), and in alpha the large noise that
// makes the beach line wander (as colorAt uses it).
export function groundColor(terrain) {
  const r = mulberry32(mixSeed(terrain.seed, "hybrid-ground"));
  return (x, z, h, n) => {
    const c = terrain.colorAt(x, z, h, n, r, { lit: false });
    const big = terrain.detail.fbm(x * 0.07, 7.1, z * 0.07, 2);
    return [c[0], c[1], c[2], clamp(big * 0.5 + 0.5, 0, 1)];
  };
}

// ---- Water ----------------------------------------------------------------------------

const waterCommon = (wgsl) =>
  wgsl
    ? /* wgsl */ `
uniform uWdWater: vec4f;
uniform uWdShallow: vec3f;
uniform uWdDeep: vec3f;
uniform uWdFoam: vec3f;
var<private> wdDepth: f32;
var<private> wdFoamK: f32;
fn wdHash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn wdNoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(wdHash(i), wdHash(i + vec2f(1.0, 0.0)), u.x), mix(wdHash(i + vec2f(0.0, 1.0)), wdHash(i + vec2f(1.0, 1.0)), u.x), u.y);
}
fn wdPrepareWater() {
  wdDepth = vVertexColor.a * 8.0;
  let t = uniform.uWdWater.x;
  let p = vPositionW.xz;
  let n = wdNoise(p * 1.3 + vec2f(t * 0.3, -t * 0.2)) * 0.6 + wdNoise(p * 3.1 - vec2f(t * 0.5, t * 0.4)) * 0.4;
  let band = 0.5 + 0.5 * sin(wdDepth * 14.0 - t * 1.7);
  wdFoamK = smoothstep(0.42, 0.0, wdDepth) * smoothstep(0.25, 0.75, n * 0.7 + band * 0.45);
}
`
    : /* glsl */ `
uniform vec4 uWdWater;   // x time
uniform vec3 uWdShallow;
uniform vec3 uWdDeep;
uniform vec3 uWdFoam;
float wdDepth;
float wdFoamK;
float wdHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wdNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(wdHash(i), wdHash(i + vec2(1.0, 0.0)), u.x), mix(wdHash(i + vec2(0.0, 1.0)), wdHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
void wdPrepareWater() {
  wdDepth = vVertexColor.a * 8.0;
  float t = uWdWater.x;
  vec2 p = vPositionW.xz;
  float n = wdNoise(p * 1.3 + vec2(t * 0.3, -t * 0.2)) * 0.6 + wdNoise(p * 3.1 - vec2(t * 0.5, t * 0.4)) * 0.4;
  float band = 0.5 + 0.5 * sin(wdDepth * 14.0 - t * 1.7);
  wdFoamK = smoothstep(0.42, 0.0, wdDepth) * smoothstep(0.25, 0.75, n * 0.7 + band * 0.45);
}
`;

// Opacity comes first in the frontend, so it holds the shared code.
const WATER_OPACITY_GLSL = `
${waterCommon(false)}
uniform float material_opacity;
void getOpacity() {
  wdPrepareWater();
  dAlpha = clamp(0.38 + wdDepth * 0.22, 0.0, 0.96);
  dAlpha = max(dAlpha, wdFoamK * 0.95) * material_opacity;
}
`;
const WATER_OPACITY_WGSL = `
${waterCommon(true)}
uniform material_opacity: f32;
fn getOpacity() {
  wdPrepareWater();
  dAlpha = clamp(0.38 + wdDepth * 0.22, 0.0, 0.96);
  dAlpha = max(dAlpha, wdFoamK * 0.95) * uniform.material_opacity;
}
`;
const WATER_DIFFUSE_GLSL = `
void getAlbedo() {
  // Deep water looks dark from above (the sky's reflection does the rest).
  float k = smoothstep(0.2, 3.5, wdDepth);
  vec3 c = mix(uWdShallow * 0.75, uWdDeep * 0.32, k);
  dAlbedo = mix(c, uWdFoam, wdFoamK);
}
`;
const WATER_DIFFUSE_WGSL = `
fn getAlbedo() {
  let k = smoothstep(0.2, 3.5, wdDepth);
  let c = mix(uniform.uWdShallow * 0.75, uniform.uWdDeep * 0.32, k);
  dAlbedo = mix(c, uniform.uWdFoam, wdFoamK);
}
`;
// Gentle waves: a few long swells and a finer chop, as normals only.
const WATER_NORMAL_GLSL = `
void getNormal() {
  float t = uWdWater.x;
  vec2 p = vPositionW.xz;
  vec2 g = vec2(0.0);
  vec4 dirs[4] = vec4[4](vec4(0.83, 0.55, 0.55, 1.25), vec4(-0.38, 0.92, 0.83, 1.6), vec4(0.2, -0.98, 1.7, 2.1), vec4(-0.9, -0.43, 2.6, 2.7));
  float amps[4] = float[4](0.03, 0.022, 0.012, 0.007);
  for (int k = 0; k < 4; k++) {
    float ph = dot(p, dirs[k].xy) * dirs[k].z + t * dirs[k].w;
    g += dirs[k].xy * dirs[k].z * amps[k] * cos(ph);
  }
  float e = 0.15;
  float c0 = wdNoise(p * 2.3 + t * 0.4);
  g += vec2(wdNoise((p + vec2(e, 0.0)) * 2.3 + t * 0.4) - c0, wdNoise((p + vec2(0.0, e)) * 2.3 + t * 0.4) - c0) / e * 0.035;
  g *= 1.0 - wdFoamK * 0.6;
  dNormalW = normalize(vec3(-g.x, 1.0, -g.y));
}
`;
const WATER_NORMAL_WGSL = `
fn getNormal() {
  let t = uniform.uWdWater.x;
  let p = vPositionW.xz;
  var g = vec2f(0.0);
  var dirs = array<vec4f, 4>(vec4f(0.83, 0.55, 0.55, 1.25), vec4f(-0.38, 0.92, 0.83, 1.6), vec4f(0.2, -0.98, 1.7, 2.1), vec4f(-0.9, -0.43, 2.6, 2.7));
  var amps = array<f32, 4>(0.03, 0.022, 0.012, 0.007);
  for (var k = 0; k < 4; k++) {
    let ph = dot(p, dirs[k].xy) * dirs[k].z + t * dirs[k].w;
    g = g + dirs[k].xy * dirs[k].z * amps[k] * cos(ph);
  }
  let e = 0.15;
  let c0 = wdNoise(p * 2.3 + t * 0.4);
  g = g + vec2f(wdNoise((p + vec2f(e, 0.0)) * 2.3 + t * 0.4) - c0, wdNoise((p + vec2f(0.0, e)) * 2.3 + t * 0.4) - c0) / e * 0.035;
  g = g * (1.0 - wdFoamK * 0.6);
  dNormalW = normalize(vec3f(-g.x, 1.0, -g.y));
}
`;

export function waterMaterial(def) {
  const m = new pc.StandardMaterial();
  m.name = "wd-water";
  m.blendType = pc.BLEND_NORMAL;
  m.depthWrite = true;
  m.opacity = 1;
  m.opacityFadesSpecular = false;
  m.diffuseVertexColor = true; // for vVertexColor (its alpha is the depth)
  m.useMetalness = true;
  m.metalness = 0;
  m.gloss = 0.93;
  m.cull = pc.CULLFACE_NONE;
  m.shaderChunks.glsl.set("opacityPS", WATER_OPACITY_GLSL);
  m.shaderChunks.wgsl.set("opacityPS", WATER_OPACITY_WGSL);
  m.shaderChunks.glsl.set("diffusePS", WATER_DIFFUSE_GLSL);
  m.shaderChunks.wgsl.set("diffusePS", WATER_DIFFUSE_WGSL);
  m.shaderChunks.glsl.set("normalMapPS", WATER_NORMAL_GLSL);
  m.shaderChunks.wgsl.set("normalMapPS", WATER_NORMAL_WGSL);
  const lin = (hex) =>
    rgb(hex).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  m.setParameter("uWdWater", [0, 0, 0, 0]);
  m.setParameter("uWdShallow", lin(def.colors.shallow));
  m.setParameter("uWdDeep", lin(def.colors.water));
  m.setParameter("uWdFoam", lin(def.colors.foam));
  m.update();
  return m;
}

// The water: a grid over the world (a vertex every `step` meters, the depth
// below in its vertex alpha) and a wide flat skirt out to the horizon.
export function waterMeshes(device, terrain, { step = 1, reach = 900 } = {}) {
  const half = terrain.half;
  const w = terrain.water;
  const n = Math.round((half * 2) / step);
  const pos = [];
  const col = [];
  const idx = [];
  const depthAt = (x, z) => clamp((w - terrain.heightAt(x, z)) / 8, 0, 1);
  for (let b = 0; b <= n; b++)
    for (let a = 0; a <= n; a++) {
      const x = -half + a * step;
      const z = -half + b * step;
      pos.push(x, w, z);
      col.push(255, 255, 255, Math.round(depthAt(x, z) * 255));
    }
  for (let b = 0; b < n; b++)
    for (let a = 0; a < n; a++) {
      const i = b * (n + 1) + a;
      // Only squares with some water in them.
      const corners = [i, i + 1, i + n + 1, i + n + 2];
      if (corners.every((c) => col[c * 4 + 3] === 0)) continue;
      idx.push(i, i + n + 1, i + 1, i + 1, i + n + 1, i + n + 2);
    }
  const grid = new pc.Mesh(device);
  grid.setPositions(new Float32Array(pos));
  grid.setNormals(new Float32Array(pos.length).map((_, k) => (k % 3 === 1 ? 1 : 0)));
  grid.setColors32(new Uint8Array(col));
  grid.setIndices(new Uint32Array(idx));
  grid.update(pc.PRIMITIVE_TRIANGLES);
  // The skirt: four quads around the grid, deep all over.
  const R = reach;
  const H = half;
  const sp = [-R, w, -R, R, w, -R, R, w, R, -R, w, R, -H, w, -H, H, w, -H, H, w, H, -H, w, H];
  const si = [0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 6, 2, 6, 3, 3, 6, 7, 3, 7, 0, 0, 7, 4];
  const skirt = new pc.Mesh(device);
  skirt.setPositions(new Float32Array(sp));
  skirt.setNormals(new Float32Array(sp.length).map((_, k) => (k % 3 === 1 ? 1 : 0)));
  skirt.setColors32(new Uint8Array(8 * 4).fill(255));
  skirt.setIndices(new Uint32Array(si));
  skirt.update(pc.PRIMITIVE_TRIANGLES);
  return [grid, skirt];
}

// ---- Sky ------------------------------------------------------------------------------

// A dome around the camera showing the sky image: its rows run from
// straight up down to (90 - 180 * domeRows) degrees; below that, its last
// row. `turn` (0..1) turns the image around so its sun sits at the world's
// sun.
export function skyDome(device, { rows = 0.6, turn = 0, radius = 450, seg = 64 } = {}) {
  const pos = [];
  const uv = [];
  const idx = [];
  const ring = 32;
  const lowest = 90 - 180 * rows;
  for (let j = 0; j <= ring; j++) {
    // Elevation from +90 down to -30. At and below the horizon the dome
    // shows the horizon's row (the haze meets it there).
    const el = 90 - (j / ring) * 120;
    const v = Math.min(1, (90 - Math.max(el, 0.4)) / (90 - lowest));
    for (let i = 0; i <= seg; i++) {
      const u = i / seg;
      const az = u * 360 * DEG;
      const ce = Math.cos(el * DEG);
      pos.push(
        Math.sin(az) * ce * radius,
        Math.sin(el * DEG) * radius,
        -Math.cos(az) * ce * radius,
      );
      uv.push(u + turn, Math.min(v, 0.998));
    }
  }
  for (let j = 0; j < ring; j++)
    for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i;
      idx.push(a, a + 1, a + seg + 1, a + 1, a + seg + 2, a + seg + 1);
    }
  const mesh = new pc.Mesh(device);
  mesh.setPositions(new Float32Array(pos));
  mesh.setUvs(0, new Float32Array(uv));
  mesh.setIndices(new Uint32Array(idx));
  mesh.update(pc.PRIMITIVE_TRIANGLES);
  return mesh;
}

export function skyMaterial(assets) {
  const m = new pc.StandardMaterial();
  m.name = "wd-sky";
  m.useLighting = false;
  m.useFog = false;
  m.useSkybox = false;
  m.useTonemap = false;
  m.diffuse = new pc.Color(0, 0, 0);
  m.emissive = new pc.Color(1, 1, 1);
  m.emissiveMap = assets.dome;
  m.depthWrite = false;
  m.cull = pc.CULLFACE_NONE;
  m.update();
  return m;
}

// The HDRI as the scene's image-based light (and the water's reflection),
// turned by `rotation` degrees about the vertical, `intensity` times as
// bright as it is (to match the dome).
export function useHDRI(app, hdr, rotation = 0, intensity = 1) {
  const sky = pc.EnvLighting.generateSkyboxCubemap(hdr, 256);
  const lighting = pc.EnvLighting.generateLightingSource(hdr);
  const atlas = pc.EnvLighting.generateAtlas(lighting);
  lighting.destroy();
  app.scene.envAtlas = atlas;
  app.scene.skybox = sky;
  app.scene.skyboxRotation = new pc.Quat().setFromEulerAngles(0, rotation, 0);
  app.scene.skyboxIntensity = intensity;
  return atlas;
}

// ---- Signs ----------------------------------------------------------------------------

// A wooden sign: two posts and a board, its face painted in the world's
// accent color with the landmark's title in cream. Same size as the splat
// sign (props.js, buildSign), so collision and taps match.
export function signBoard(device, { title, label, accent, width }) {
  const top = 1.95;
  const bh = 0.62;
  const bw = width;
  const y0 = top - bh / 2 - 0.05;
  const root = new pc.Entity("sign-board");
  const wood = woodMaterial();
  const post = pc.createCylinder(device, { radius: 0.065, height: top, heightSegments: 1, capSegments: 12 }); // prettier-ignore
  for (const sx of [-1, 1]) {
    const e = new pc.Entity("post");
    e.addComponent("render", { meshInstances: [new pc.MeshInstance(post, wood)], castShadows: true }); // prettier-ignore
    e.setLocalPosition(sx * (bw / 2 - 0.16), top / 2, -0.02);
    root.addChild(e);
  }
  const board = pc.createBox(device, { halfExtents: new pc.Vec3(bw / 2, bh / 2, 0.035) });
  const b = new pc.Entity("board");
  b.addComponent("render", {
    meshInstances: [new pc.MeshInstance(board, wood)],
    castShadows: true,
  });
  b.setLocalPosition(0, y0, 0.05);
  root.addChild(b);
  // The painted face, a plane just in front of the board.
  const face = pc.createPlane(device, { halfExtents: new pc.Vec2(bw / 2 - 0.015, bh / 2 - 0.015) });
  const f = new pc.Entity("face");
  f.addComponent("render", { meshInstances: [new pc.MeshInstance(face, faceMaterial(device, { title, label, accent, bw, bh }))] }); // prettier-ignore
  f.setLocalPosition(0, y0, 0.0875);
  f.setLocalEulerAngles(90, 0, 0);
  root.addChild(f);
  return root;
}

let woodMat = null;
function woodMaterial() {
  if (woodMat) return woodMat;
  const m = new pc.StandardMaterial();
  m.diffuse = new pc.Color(0.54, 0.39, 0.25);
  m.useMetalness = true;
  m.metalness = 0;
  m.gloss = 0.3;
  m.update();
  woodMat = m;
  return m;
}

function faceMaterial(device, { title, label, accent, bw, bh }) {
  const W = 1024;
  const H = Math.round((W * bh) / bw);
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d");
  const cream = "#fbf4e2";
  g.fillStyle = cream;
  g.fillRect(0, 0, W, H);
  const border = Math.round((0.045 / bw) * W);
  g.fillStyle = accent;
  g.fillRect(border, border, W - border * 2, H - border * 2);
  // The title as large as fits on one line (or two, for long titles).
  const words = String(title || label || "").trim();
  g.fillStyle = cream;
  g.textAlign = "center";
  g.textBaseline = "middle";
  const fit = (text, maxH) => {
    let size = maxH;
    g.font = `700 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    while (size > 12 && g.measureText(text).width > W - border * 4) {
      size -= 2;
      g.font = `700 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    }
    return size;
  };
  const one = fit(words, H * 0.5);
  if (one >= H * 0.3 || !words.includes(" ")) g.fillText(words, W / 2, H / 2 + one * 0.04);
  else {
    const mid = words.lastIndexOf(" ", Math.ceil(words.length / 2)) > 0 ? words.lastIndexOf(" ", Math.ceil(words.length / 2)) : words.indexOf(" "); // prettier-ignore
    const a = words.slice(0, mid);
    const b = words.slice(mid + 1);
    const s = Math.min(fit(a, H * 0.34), fit(b, H * 0.34));
    g.font = `700 ${s}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    g.fillText(a, W / 2, H / 2 - s * 0.55);
    g.fillText(b, W / 2, H / 2 + s * 0.6);
  }
  const t = new pc.Texture(device, {
    name: "wd-sign",
    width: W,
    height: H,
    format: pc.PIXELFORMAT_SRGBA8,
    mipmaps: true,
    minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
    anisotropy: 8,
    addressU: pc.ADDRESS_CLAMP_TO_EDGE,
    addressV: pc.ADDRESS_CLAMP_TO_EDGE,
  });
  t.setSource(cv);
  const m = new pc.StandardMaterial();
  m.diffuseMap = t;
  m.useMetalness = true;
  m.metalness = 0;
  m.gloss = 0.35;
  m.update();
  return m;
}

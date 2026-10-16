// Continuous picture faces over splat paper. The same circular-arc leaf and rigid
// part transforms keep the face attached throughout a turn. Only the three page
// toys opt in; screen sheets and the other picture consumers keep their splats.
import * as pc from "./pc.js";

const VS = (bend) => `
attribute vec3 aPosition;
attribute vec2 aUv;
uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;
uniform vec4 uLeaf;
uniform vec3 uSpine;
uniform vec3 uAxis;
uniform vec3 uDir;
uniform vec4 uPartQ;
uniform vec4 uPivot;
uniform vec4 uOffset;
uniform vec4 uSpBodyQ;
uniform vec4 uSpBodyT;
uniform vec4 uSpToy;
varying vec2 vUv;
vec3 rot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
void main(void) {
  vec3 p = aPosition;
  ${
    bend
      ? `if (uLeaf.z > 0.5) {
    vec3 nm = cross(uAxis, uDir), rel = p - uSpine;
    float s = dot(rel, uDir), psi = uLeaf.x + uLeaf.y * s;
    float lx = abs(uLeaf.y) < 1e-4 ? s * cos(uLeaf.x) : (sin(psi) - sin(uLeaf.x)) / uLeaf.y;
    float ly = abs(uLeaf.y) < 1e-4 ? s * sin(uLeaf.x) : (cos(uLeaf.x) - cos(psi)) / uLeaf.y;
    p = uSpine + uAxis * dot(rel, uAxis) + uDir * lx + nm * ly + (nm * cos(psi) - uDir * sin(psi)) * dot(rel, nm);
  }`
      : ""
  }
  p = uPivot.xyz + rot(uPartQ, (p - uPivot.xyz) * (1.0 + uPivot.w)) + uOffset.xyz;
  vec4 q = dot(uSpBodyQ, uSpBodyQ) < 1e-8 ? vec4(0.0, 0.0, 0.0, 1.0) : uSpBodyQ;
  p = uSpToy.xyz + rot(q, p - uSpToy.xyz) + uSpBodyT.xyz;
  gl_Position = matrix_viewProjection * matrix_model * vec4(p, 1.0);
  vUv = aUv;
}`;
const FS = `
// The source raster already antialiases glyphs. Avoid averaging another
// half-resolution level into them; foreshortened pages still use mipmaps.
uniform sampler2D uColor;
uniform sampler2D uMask;
uniform vec4 uKeep;
uniform vec4 uColorFlags;
uniform vec4 uColorLow;
uniform vec4 uColorHigh;
varying vec2 vUv;
void main(void) {
  vec4 color = texture2D(uColor, vUv, -1.0);
  if (uColorFlags.x > 0.5) color = vec4(mix(uColorLow.xyz, uColorHigh.xyz, color.rrr), 1.0);
  if (uKeep.z > 0.5) {
    float d = texture2D(uMask, vUv).r;
    if (d < uKeep.x || d > uKeep.y) discard;
  }
  gl_FragColor = color;
}`;
const VSW = (bend) => `
attribute aPosition: vec3f;
attribute aUv: vec2f;
uniform matrix_model: mat4x4f;
uniform matrix_viewProjection: mat4x4f;
uniform uLeaf: vec4f;
uniform uSpine: vec3f;
uniform uAxis: vec3f;
uniform uDir: vec3f;
uniform uPartQ: vec4f;
uniform uPivot: vec4f;
uniform uOffset: vec4f;
uniform uSpBodyQ: vec4f;
uniform uSpBodyT: vec4f;
uniform uSpToy: vec4f;
varying vUv: vec2f;
fn rot(q: vec4f, v: vec3f) -> vec3f { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
@vertex fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  var p = input.aPosition;
  ${
    bend
      ? `if (uniform.uLeaf.z > 0.5) {
    let nm = cross(uniform.uAxis, uniform.uDir); let rel = p - uniform.uSpine;
    let s = dot(rel, uniform.uDir); let psi = uniform.uLeaf.x + uniform.uLeaf.y * s;
    var lx = s * cos(uniform.uLeaf.x); var ly = s * sin(uniform.uLeaf.x);
    if (abs(uniform.uLeaf.y) >= 1e-4) {
      lx = (sin(psi) - sin(uniform.uLeaf.x)) / uniform.uLeaf.y;
      ly = (cos(uniform.uLeaf.x) - cos(psi)) / uniform.uLeaf.y;
    }
    p = uniform.uSpine + uniform.uAxis * dot(rel, uniform.uAxis) + uniform.uDir * lx + nm * ly + (nm * cos(psi) - uniform.uDir * sin(psi)) * dot(rel, nm);
  }`
      : ""
  }
  p = uniform.uPivot.xyz + rot(uniform.uPartQ, (p - uniform.uPivot.xyz) * (1.0 + uniform.uPivot.w)) + uniform.uOffset.xyz;
  var q = uniform.uSpBodyQ;
  if (dot(q,q) < 1e-8) { q = vec4f(0.0,0.0,0.0,1.0); }
  p = uniform.uSpToy.xyz + rot(q,p-uniform.uSpToy.xyz) + uniform.uSpBodyT.xyz;
  output.position = uniform.matrix_viewProjection * uniform.matrix_model * vec4f(p,1.0);
  output.vUv = input.aUv;
  return output;
}`;
const FSW = `
var uColor: texture_2d<f32>;
var uColorSampler: sampler;
var uMask: texture_2d<f32>;
var uMaskSampler: sampler;
uniform uKeep: vec4f;
uniform uColorFlags: vec4f;
uniform uColorLow: vec4f;
uniform uColorHigh: vec4f;
varying vUv: vec2f;
@fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  var color = textureSampleBias(uColor,uColorSampler,input.vUv,-1.0);
  if (uniform.uColorFlags.x > 0.5) { color = vec4f(mix(uniform.uColorLow.xyz,uniform.uColorHigh.xyz,vec3f(color.r)),1.0); }
  if (uniform.uKeep.z > 0.5) {
    let d = textureSample(uMask,uMaskSampler,input.vUv).r;
    if (d < uniform.uKeep.x || d > uniform.uKeep.y) { discard; }
  }
  output.color = color;
  return output;
}`;

// Pure geometry is also used by the page-surface regression checks. Relief is
// sampled at the same normalized source coordinates as the splat builder.
export function opaqueGray(rgba) {
  if (!rgba || rgba.length % 4) return false;
  for (let i = 0; i < rgba.length; i += 4)
    if (rgba[i] !== rgba[i + 1] || rgba[i] !== rgba[i + 2] || rgba[i + 3] !== 255) return false;
  return true;
}

export function grayPixels(rgba) {
  if (!opaqueGray(rgba)) return null;
  const pixels = new Uint8Array(rgba.length / 4);
  for (let i = 0; i < pixels.length; i++) pixels[i] = rgba[i * 4];
  return pixels;
}

// A single ink color over a background can use a coverage channel too.
// Validate every source color within one 8-bit step; unrelated colors and
// transparency retain their full raster. Repeated colors share work.
export function rampPixels(rgba, pack = true) {
  if (!rgba?.length || rgba.byteOffset % 4 || rgba.length % 4) return null;
  const words = new Uint32Array(rgba.buffer, rgba.byteOffset, rgba.length / 4);
  let lo = 0,
    hi = 0,
    min = Infinity,
    max = -Infinity;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] !== 255) return null;
    const sum = rgba[i] + rgba[i + 1] + rgba[i + 2];
    if (sum < min) {
      min = sum;
      lo = i;
    }
    if (sum > max) {
      max = sum;
      hi = i;
    }
  }
  const low = Array.from(rgba.slice(lo, lo + 3));
  const high = Array.from(rgba.slice(hi, hi + 3));
  const d = high.map((v, i) => v - low[i]);
  const norm = d.reduce((n, v) => n + v * v, 0);
  const pixels = pack ? new Uint8Array(words.length) : null;
  const codes = new Map([
    [words[lo / 4], 0],
    [words[hi / 4], norm ? 255 : 0],
  ]);
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let code = codes.get(word);
    if (code === undefined) {
      if (!norm) return null;
      const at = i * 4;
      code = Math.max(
        0,
        Math.min(
          255,
          Math.round((255 * d.reduce((s, v, k) => s + (rgba[at + k] - low[k]) * v, 0)) / norm),
        ),
      );
      for (let k = 0; k < 3; k++)
        if (Math.abs(Math.round(low[k] + (d[k] * code) / 255) - rgba[at + k]) > 1) return null;
      codes.set(word, code);
    }
    if (pixels) pixels[i] = code;
  }
  return { pixels, low: low.map((v) => v / 255), high: high.map((v) => v / 255) };
}

export function surfaceGrid(geom, w, h, relief = null) {
  const flat = geom.leaf ? 32 : 1;
  const cols = relief?.amount ? Math.min(128, Math.max(32, relief.w)) : flat;
  const rows = relief?.amount ? Math.min(128, Math.max(32, relief.h)) : flat;
  const positions = new Float32Array((cols + 1) * (rows + 1) * 3);
  const uvs = new Float32Array((cols + 1) * (rows + 1) * 2);
  const pitch = Math.hypot(...geom.right);
  for (let j = 0; j <= rows; j++)
    for (let i = 0; i <= cols; i++) {
      const u = i / cols,
        v = j / rows,
        n = j * (cols + 1) + i;
      let up = geom.lift ?? pitch * 0.3;
      if (relief?.amount) {
        const x = Math.max(0, Math.min(relief.w - 1, u * relief.w - 0.5)),
          y = Math.max(0, Math.min(relief.h - 1, v * relief.h - 0.5));
        const x0 = Math.floor(x),
          y0 = Math.floor(y),
          x1 = Math.min(relief.w - 1, x0 + 1),
          y1 = Math.min(relief.h - 1, y0 + 1);
        const tx = x - x0,
          ty = y - y0;
        const d = relief.nearest
          ? relief.d[Math.round(y) * relief.w + Math.round(x)]
          : (relief.d[y0 * relief.w + x0] * (1 - tx) + relief.d[y0 * relief.w + x1] * tx) *
              (1 - ty) +
            (relief.d[y1 * relief.w + x0] * (1 - tx) + relief.d[y1 * relief.w + x1] * tx) * ty;
        up += relief.amount * Math.max(0, Math.min(1, d));
      }
      for (let k = 0; k < 3; k++)
        positions[n * 3 + k] =
          geom.origin[k] + geom.right[k] * u * w + geom.down[k] * v * h + geom.normal[k] * up;
      uvs.set([u, v], n * 2);
    }
  const indices = new Uint16Array(cols * rows * 6);
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i,
        b = a + 1,
        c = a + cols + 1,
        d = c + 1;
      indices.set([a, c, b, b, c, d], (j * cols + i) * 6);
    }
  return { positions, uvs, indices };
}

export class PictureSurface {
  constructor(stage, slot, data) {
    this.stage = stage;
    this.slot = slot;
    this.geom = data.geom;
    const { positions, uvs, indices } = surfaceGrid(data.geom, data.w, data.h, data.relief);
    this.mesh = new pc.Mesh(stage.device);
    this.mesh.setPositions(positions, 3);
    this.mesh.setUvs(0, uvs, 2);
    this.mesh.setIndices(indices);
    this.mesh.update(pc.PRIMITIVE_TRIANGLES);
    this.material = new pc.ShaderMaterial({
      uniqueName: data.geom.leaf ? "pictureLeafFace" : "pictureFlatFace",
      attributes: { aPosition: pc.SEMANTIC_POSITION, aUv: pc.SEMANTIC_TEXCOORD0 },
      vertexGLSL: VS(!!data.geom.leaf),
      fragmentGLSL: FS,
      vertexWGSL: VSW(!!data.geom.leaf),
      fragmentWGSL: FSW,
    });
    this.material.cull = pc.CULLFACE_BACK;
    this.material.depthWrite = true;
    this.material.depthTest = true;
    this.material.update();
    this.color = new pc.Texture(stage.device, {
      name: "picture-face",
      width: data.w,
      height: data.h,
      format: data.pixels ? pc.PIXELFORMAT_R8 : pc.PIXELFORMAT_RGBA8,
      ...(data.pixels ? { levels: [data.pixels] } : {}),
      mipmaps: true,
      minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
      magFilter: pc.FILTER_LINEAR,
      anisotropy: Math.min(8, stage.device.maxAnisotropy || 1),
      addressU: pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: pc.ADDRESS_CLAMP_TO_EDGE,
    });
    if (!data.pixels) this.color.setSource(data.source);
    this.color.upload();
    this.material.setParameter("uColor", this.color);
    this.material.setParameter("uColorFlags", [data.pixels ? 1 : 0, 0, 0, 0]);
    this.material.setParameter("uColorLow", [...(data.low || [0, 0, 0]), 0]);
    this.material.setParameter("uColorHigh", [...(data.high || [1, 1, 1]), 0]);
    this.mask = null;
    const r = data.relief;
    if (r?.keep) {
      this.mask = new pc.Texture(stage.device, {
        name: "picture-cutout",
        width: r.w,
        height: r.h,
        format: pc.PIXELFORMAT_R8,
        mipmaps: false,
        minFilter: pc.FILTER_NEAREST,
        magFilter: pc.FILTER_NEAREST,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE,
      });
      const bytes = this.mask.lock();
      for (let i = 0; i < r.d.length; i++)
        bytes[i] = r.d[i] >= r.keep[0] && r.d[i] <= r.keep[1] ? 255 : 0;
      this.mask.unlock();
    }
    this.material.setParameter("uMask", this.mask || stage.blankTexture());
    this.material.setParameter("uKeep", r?.keep ? [0.5, 1, 1, 0] : [0, 1, 0, 0]);
    this.instance = new pc.MeshInstance(this.mesh, this.material, slot.entity);
    this.instance.cull = false;
    this.layer = stage.app.scene.layers.getLayerByName("World");
    this.layer.addMeshInstances([this.instance]);
    this.setUniforms(stage.sheetUniforms || {});
  }

  setUniforms(u) {
    for (const key of ["uSpBodyQ", "uSpBodyT", "uSpToy"])
      this.material.setParameter(key, u[key] || [0, 0, 0, 0]);
    const l = u["uSpLeaf[0]"] || new Float32Array(32),
      g = this.geom;
    const j = 12 + (g.leaf?.slot || 0) * 2;
    this.material.setParameter("uLeaf", [l[j], l[j + 1], g.leaf ? 1 : 0, 0]);
    for (const [key, at] of [
      ["uSpine", 0],
      ["uAxis", 4],
      ["uDir", 8],
    ])
      this.material.setParameter(key, l.slice(at, at + 3));
    const p = u["uSpParts[0]"],
      k = (g.part || 0) * 12;
    const q = g.part && p ? p.slice(k, k + 4) : [0, 0, 0, 1];
    this.material.setParameter("uPartQ", q.some((x) => x) ? q : [0, 0, 0, 1]);
    this.material.setParameter("uPivot", g.part && p ? p.slice(k + 4, k + 8) : [0, 0, 0, 0]);
    this.material.setParameter("uOffset", g.part && p ? p.slice(k + 8, k + 12) : [0, 0, 0, 1]);
    this.partVisible = !(g.part && p && p[k + 11] === 0);
    this.instance.visible = this.slot.entity.enabled && this.partVisible;
  }

  show(on) {
    this.instance.visible = !!on && this.partVisible;
  }
  destroy() {
    this.layer.removeMeshInstances([this.instance]);
    this.mesh.destroy();
    this.material.destroy();
    this.color.destroy();
    this.mask?.destroy();
  }
}

// Lane Photo sharp view (prefix psv): the picture at its full resolution on a 3D relief.
//
// Splats at a phone's budget can't show a big picture's small text: that needs about one splat per
// screen pixel. This draws the picture the other way: as a texture (the photo at the size the toy
// keeps it, or a playing <video> straight from the browser) on a grid mesh lifted by the same depth
// the splats use. The depth is a texture too, read in the vertex shader, so a moving picture's depth
// changes without rebuilding anything.
//
//   - Where the depth jumps, the surface is cut: a triangle whose depth changes faster than `cut`
//     per grid cell is dropped whole (worked out in the fragment shader from the derivatives of the
//     depth and the picture coordinates, which are constant over a flat triangle), so no rubber
//     sheet hangs between a near thing and what is behind it.
//   - Behind it a coarse backing sheet sits at the farthest depth near each place (sampled from the
//     same depth texture) and shows the picture as it is there, so what a near part uncovers when
//     the view turns is filled from the far side, as the splats' backing layer does.
//   - The color has mipmaps and anisotropic filtering, so it stays sharp when tilted.
//
// It moves as the splats do: the same lift and base, the four morph channels (the tap's flatten and
// raise, blended by depth band), the "Layers" spacing, the recipe's fit (center and scale) and the
// toy's body turn. It hangs under the toy's entity, so a Hands-on pose moves it too. No lighting:
// the picture's own colors, as the splats show them. PlayCanvas comes only through src/pc.js.

import * as pc from "../pc.js";

const VS = /* glsl */ `
attribute vec3 aPosition;
uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;
uniform sampler2D uDepth;
uniform vec4 uGrid;   // picture width and height (recipe units), cells across and down
uniform vec4 uLift;   // lift, base (z = lift * (d - base)), backing offset, backing's flat z
uniform vec4 uMorph;  // the four morph channels (0 with its depth, 1 flat)
uniform vec4 uLayer;  // layer spacing, cut, backing (1) or surface (0), backing reach (picture heights)
uniform vec4 uTf;     // the recipe's fit: center (xyz), scale
uniform vec4 uToy;    // the toy's center (toy coordinates)
uniform vec4 uBodyQ;  // the body's turn (quaternion)
uniform vec4 uBodyT;  // the body's offset
varying vec2 vUv;
varying float vD;
vec3 psvRot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
void main(void) {
  float back = uLayer.z;
  // (the backing is a little inside the picture, so it never shows past the edge as the view turns)
  vec2 uv = back > 0.5 ? 0.5 + (aPosition.xy - 0.5) * 0.96 : aPosition.xy;
  vec2 cuv = uv;
  float d;
  if (back > 0.5) {
    d = 2.0;
    vec2 st = vec2(uLayer.w * uGrid.y / uGrid.x, uLayer.w) / 3.0;
    for (int j = -3; j <= 3; j++)
      for (int i = -3; i <= 3; i++) {
        vec2 s = clamp(uv + vec2(float(i), float(j)) * st, 0.0, 1.0);
        float t = textureLod(uDepth, s, 0.0).r;
        if (t < d) { d = t; cuv = s; }
      }
  } else d = textureLod(uDepth, uv, 0.0).r;
  float b = back > 0.5 ? 0.0 : clamp(d * 4.0 - 0.5, 0.0, 3.0);
  float i0 = min(floor(b), 2.0);
  float f = b - i0;
  float m0 = i0 < 0.5 ? uMorph.x : (i0 < 1.5 ? uMorph.y : uMorph.z);
  float m1 = i0 < 0.5 ? uMorph.y : (i0 < 1.5 ? uMorph.z : uMorph.w);
  float m = mix(m0, m1, f);
  float z = uLift.x * (d - uLift.y);
  if (back > 0.5) z = mix(z + uLift.z, uLift.w, m);
  else z = mix(z, 0.0, m);
  z += (b - 1.5) * uLayer.x;
  vec3 p = vec3((uv.x - 0.5) * uGrid.x, (0.5 - uv.y) * uGrid.y, z);
  p = (p - uTf.xyz) * uTf.w;
  vec4 q = dot(uBodyQ, uBodyQ) < 1e-8 ? vec4(0.0, 0.0, 0.0, 1.0) : uBodyQ;
  p = uToy.xyz + psvRot(q, p - uToy.xyz) + uBodyT.xyz;
  gl_Position = matrix_viewProjection * matrix_model * vec4(p, 1.0);
  vUv = cuv;
  vD = d;
}
`;

const FS = /* glsl */ `
uniform sampler2D uColor;
uniform vec4 uGrid;
uniform vec4 uLayer;
varying vec2 vUv;
varying float vD;
void main(void) {
  if (uLayer.z < 0.5) {
    vec2 ux = dFdx(vUv);
    vec2 uy = dFdy(vUv);
    float dx = dFdx(vD);
    float dy = dFdy(vD);
    float det = ux.x * uy.y - ux.y * uy.x;
    if (abs(det) > 1e-18) {
      float gu = (dx * uy.y - dy * ux.y) / det;
      float gv = (ux.x * dy - uy.x * dx) / det;
      if (abs(gu) / uGrid.z + abs(gv) / uGrid.w > uLayer.y) discard;
    }
  }
  gl_FragColor = vec4(texture(uColor, vUv).rgb, 1.0);
}
`;

const VS_W = /* wgsl */ `
attribute aPosition: vec3f;
uniform matrix_model: mat4x4f;
uniform matrix_viewProjection: mat4x4f;
uniform uGrid: vec4f;
uniform uLift: vec4f;
uniform uMorph: vec4f;
uniform uLayer: vec4f;
uniform uTf: vec4f;
uniform uToy: vec4f;
uniform uBodyQ: vec4f;
uniform uBodyT: vec4f;
var uDepth: texture_2d<f32>;
var uDepthSampler: sampler;
varying vUv: vec2f;
varying vD: f32;
fn psvRot(q: vec4f, v: vec3f) -> vec3f { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
@vertex fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let back = uniform.uLayer.z;
  var uv = input.aPosition.xy;
  if (back > 0.5) { uv = 0.5 + (uv - 0.5) * 0.96; }
  var cuv = uv;
  var d: f32;
  if (back > 0.5) {
    d = 2.0;
    let st = vec2f(uniform.uLayer.w * uniform.uGrid.y / uniform.uGrid.x, uniform.uLayer.w) / 3.0;
    for (var j: i32 = -3; j <= 3; j++) {
      for (var i: i32 = -3; i <= 3; i++) {
        let s = clamp(uv + vec2f(f32(i), f32(j)) * st, vec2f(0.0), vec2f(1.0));
        let t = textureSampleLevel(uDepth, uDepthSampler, s, 0.0).r;
        if (t < d) { d = t; cuv = s; }
      }
    }
  } else {
    d = textureSampleLevel(uDepth, uDepthSampler, uv, 0.0).r;
  }
  var b = clamp(d * 4.0 - 0.5, 0.0, 3.0);
  if (back > 0.5) { b = 0.0; }
  let i0 = min(floor(b), 2.0);
  let f = b - i0;
  let mo = uniform.uMorph;
  let m0 = select(select(mo.z, mo.y, i0 < 1.5), mo.x, i0 < 0.5);
  let m1 = select(select(mo.w, mo.z, i0 < 1.5), mo.y, i0 < 0.5);
  let m = mix(m0, m1, f);
  var z = uniform.uLift.x * (d - uniform.uLift.y);
  if (back > 0.5) { z = mix(z + uniform.uLift.z, uniform.uLift.w, m); } else { z = mix(z, 0.0, m); }
  z += (b - 1.5) * uniform.uLayer.x;
  var p = vec3f((uv.x - 0.5) * uniform.uGrid.x, (0.5 - uv.y) * uniform.uGrid.y, z);
  p = (p - uniform.uTf.xyz) * uniform.uTf.w;
  var q = uniform.uBodyQ;
  if (dot(q, q) < 1e-8) { q = vec4f(0.0, 0.0, 0.0, 1.0); }
  p = uniform.uToy.xyz + psvRot(q, p - uniform.uToy.xyz) + uniform.uBodyT.xyz;
  output.position = uniform.matrix_viewProjection * uniform.matrix_model * vec4f(p, 1.0);
  output.vUv = cuv;
  output.vD = d;
  return output;
}
`;

const FS_W = /* wgsl */ `
uniform uGrid: vec4f;
uniform uLayer: vec4f;
var uColor: texture_2d<f32>;
var uColorSampler: sampler;
varying vUv: vec2f;
varying vD: f32;
@fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let ux = dpdx(input.vUv);
  let uy = dpdy(input.vUv);
  let dx = dpdx(input.vD);
  let dy = dpdy(input.vD);
  let c = textureSample(uColor, uColorSampler, input.vUv);
  if (uniform.uLayer.z < 0.5) {
    let det = ux.x * uy.y - ux.y * uy.x;
    if (abs(det) > 1e-18) {
      let gu = (dx * uy.y - dy * ux.y) / det;
      let gv = (ux.x * dy - uy.x * dx) / det;
      if (abs(gu) / uniform.uGrid.z + abs(gv) / uniform.uGrid.w > uniform.uLayer.y) { discard; }
    }
  }
  output.color = vec4f(c.rgb, 1.0);
  return output;
}
`;

// A grid of (cols + 1) x (rows + 1) points over the picture (u, v from 0 to 1, v down) and its
// triangles, each cell split along alternating diagonals.
function gridMesh(device, cols, rows) {
  const pos = new Float32Array((cols + 1) * (rows + 1) * 3);
  let o = 0;
  for (let j = 0; j <= rows; j++)
    for (let i = 0; i <= cols; i++) {
      pos[o++] = i / cols;
      pos[o++] = j / rows;
      pos[o++] = 0;
    }
  const idx = new Uint32Array(cols * rows * 6);
  o = 0;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i;
      const b = a + 1;
      const c = a + cols + 1;
      const d = c + 1;
      if ((i + j) & 1) idx.set([a, c, b, b, c, d], o);
      else idx.set([a, c, d, a, d, b], o);
      o += 6;
    }
  const mesh = new pc.Mesh(device);
  mesh.setPositions(pos, 3);
  mesh.setIndices(idx);
  mesh.update(pc.PRIMITIVE_TRIANGLES);
  return { mesh, bytes: pos.byteLength + idx.byteLength };
}

function material() {
  const m = new pc.ShaderMaterial({
    uniqueName: "psvRelief",
    attributes: { aPosition: pc.SEMANTIC_POSITION },
    vertexGLSL: VS,
    fragmentGLSL: FS,
    vertexWGSL: VS_W,
    fragmentWGSL: FS_W,
  });
  m.cull = pc.CULLFACE_NONE;
  m.depthWrite = true;
  m.depthTest = true;
  m.update();
  return m;
}

const isMedia = (s) =>
  (typeof HTMLVideoElement !== "undefined" && s instanceof HTMLVideoElement) ||
  (typeof HTMLCanvasElement !== "undefined" && s instanceof HTMLCanvasElement) ||
  (typeof ImageBitmap !== "undefined" && s instanceof ImageBitmap);

export class ReliefMesh {
  // cols x rows: the surface's grid cells; back: the backing sheet's cells across (down follows).
  constructor(stage, { cols, rows, backCols = 96 }) {
    this.stage = stage;
    const device = stage.device;
    this.device = device;
    this.cols = cols;
    this.rows = rows;
    const backRows = Math.max(8, Math.round((backCols * rows) / cols));
    this.surface = gridMesh(device, cols, rows);
    this.backing = gridMesh(device, backCols, backRows);
    this.matS = material();
    this.matB = material();
    this.node = new pc.GraphNode("psv-relief");
    this.miS = new pc.MeshInstance(this.surface.mesh, this.matS, this.node);
    this.miB = new pc.MeshInstance(this.backing.mesh, this.matB, this.node);
    for (const mi of [this.miS, this.miB]) mi.cull = false; // (the shader moves its points)
    this.layer = stage.app.scene.layers.getLayerByName("World");
    this.layer.addMeshInstances([this.miS, this.miB]);
    this.color = null;
    this.depth = null;
    this.colorBytes = 0;
    this.u = {
      uGrid: [1, 1, cols, rows],
      uLift: [0, 0, 0, 0],
      uMorph: [0, 0, 0, 0],
      uLayer: [0, 0.03, 0, 0.11],
      uTf: [0, 0, 0, 1],
      uToy: [0, 0, 0, 0],
      uBodyQ: [0, 0, 0, 1],
      uBodyT: [0, 0, 0, 0],
    };
    this.visible = true;
  }

  // The picture: { w, h, data: RGBA bytes }, or a <video>, canvas or ImageBitmap (uploaded by the
  // browser on the GPU's side, no copy here). Call again each frame for a playing video.
  setColor(src) {
    const media = isMedia(src);
    const w = media ? src.videoWidth || src.width : src.w;
    const h = media ? src.videoHeight || src.height : src.h;
    if (!w || !h) return false;
    if (!this.color || this.color.width !== w || this.color.height !== h) {
      this.color?.destroy();
      this.color = new pc.Texture(this.device, {
        name: "psv-color",
        width: w,
        height: h,
        format: pc.PIXELFORMAT_RGBA8,
        mipmaps: true,
        minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
        magFilter: pc.FILTER_LINEAR,
        anisotropy: Math.min(16, this.device.maxAnisotropy || 1),
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE,
      });
      this.colorBytes = Math.round((w * h * 4 * 4) / 3);
      this.colorSrc = null;
    }
    if (media) {
      if (this.colorSrc !== src) this.color.setSource(src);
      else this.color.upload();
      this.colorSrc = src;
    } else {
      const px = this.color.lock();
      px.set(src.data.length === px.length ? src.data : src.data.subarray(0, px.length));
      this.color.unlock();
      this.colorSrc = null;
    }
    this.matS.setParameter("uColor", this.color);
    this.matB.setParameter("uColor", this.color);
    return true;
  }

  // The depth: { w, h, data } with data 0..255 bytes (nearness) or 0..1 floats.
  setDepth({ w, h, data }) {
    if (!this.depth || this.depth.width !== w || this.depth.height !== h) {
      this.depth?.destroy();
      this.depth = new pc.Texture(this.device, {
        name: "psv-depth",
        width: w,
        height: h,
        format: pc.PIXELFORMAT_R8,
        mipmaps: false,
        minFilter: pc.FILTER_LINEAR,
        magFilter: pc.FILTER_LINEAR,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE,
      });
    }
    const px = this.depth.lock();
    if (data instanceof Uint8Array || data instanceof Uint8ClampedArray)
      px.set(data.subarray(0, px.length));
    else
      for (let i = 0; i < px.length; i++)
        px[i] = Math.max(0, Math.min(255, Math.round(data[i] * 255)));
    this.depth.unlock();
    this.matS.setParameter("uDepth", this.depth);
    this.matB.setParameter("uDepth", this.depth);
  }

  // The shape and motion (see the uniforms at the top); any subset.
  //   width, height (recipe units); lift, base; backOffset, backFlat; morph [4]; layers; cut;
  //   reach; fit { center, scale }; toy [3]; bodyQ [4]; bodyT [3]
  set(o) {
    const u = this.u;
    if (o.width !== undefined) u.uGrid[0] = o.width;
    if (o.height !== undefined) u.uGrid[1] = o.height;
    if (o.lift !== undefined) u.uLift[0] = o.lift;
    if (o.base !== undefined) u.uLift[1] = o.base;
    if (o.backOffset !== undefined) u.uLift[2] = o.backOffset;
    if (o.backFlat !== undefined) u.uLift[3] = o.backFlat;
    if (o.morph) for (let i = 0; i < 4; i++) u.uMorph[i] = o.morph[i] ?? 0;
    if (o.layers !== undefined) u.uLayer[0] = o.layers;
    if (o.cut !== undefined) u.uLayer[1] = o.cut;
    if (o.reach !== undefined) u.uLayer[3] = o.reach;
    if (o.fit) u.uTf = [o.fit.center[0], o.fit.center[1], o.fit.center[2], o.fit.scale];
    if (o.toy) u.uToy = [o.toy[0], o.toy[1], o.toy[2], 0];
    if (o.bodyQ) u.uBodyQ = o.bodyQ.slice(0, 4);
    if (o.bodyT) u.uBodyT = [o.bodyT[0], o.bodyT[1], o.bodyT[2], 0];
    for (const [m, back] of [
      [this.matS, 0],
      [this.matB, 1],
    ]) {
      for (const k in u) m.setParameter(k, k === "uLayer" ? [u.uLayer[0], u.uLayer[1], back, u.uLayer[3]] : u[k]); // prettier-ignore
    }
  }

  attach(parent) {
    if (this.node.parent === parent) return;
    this.node.parent?.removeChild(this.node);
    parent.addChild(this.node);
  }

  show(on) {
    const v = !!on && !!this.color && !!this.depth;
    this.miS.visible = v;
    this.miB.visible = v;
    this.visible = v;
  }

  // What it holds on the GPU, in bytes: the picture (with its mipmaps), the depth, the two grids.
  cost() {
    const depth = this.depth ? this.depth.width * this.depth.height : 0;
    return {
      color: this.colorBytes,
      depth,
      mesh: this.surface.bytes + this.backing.bytes,
      triangles: 2 * (this.cols * this.rows) + this.backing.mesh.primitive[0].count / 3,
      total: this.colorBytes + depth + this.surface.bytes + this.backing.bytes,
    };
  }

  destroy() {
    this.layer.removeMeshInstances([this.miS, this.miB]);
    this.node.parent?.removeChild(this.node);
    this.surface.mesh.destroy();
    this.backing.mesh.destroy();
    this.color?.destroy();
    this.depth?.destroy();
    this.matS.destroy();
    this.matB.destroy();
    this.color = this.depth = null;
  }
}

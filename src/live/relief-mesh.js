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
// Lane Photo depth: with a photo (setPieces), each connected piece of surface moves with one layer,
// as its splats do (the splat build's own pieces), and is cut from a neighbor of another layer; the
// backing sits at the lowest the surface near it is at that moment (each layer's lowest depth near
// it, worked out once, at its layer's height each frame), so it stays behind through the whole rise
// and flatten (src/live/relief-height.js has the same heights in plain JavaScript, for the tests).
//
// It moves as the splats do: the same lift and base, the four morph channels (the tap's flatten and
// raise: by piece with a photo, blended by depth band for a moving clip), the "Layers" spacing, the recipe's fit (center and scale) and the
// toy's body turn. It hangs under the toy's entity, so a Hands-on pose moves it too. No lighting:
// the picture's own colors, as the splats show them. PlayCanvas comes only through src/pc.js.

import * as pc from "../pc.js";
import { backingField } from "./relief-height.js"; // lane Photo depth

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
uniform vec4 uFrame;  // the dark frame (mode 2): its width across and down (picture units), z offset
uniform vec4 uBack;   // the backing's grid cells across and down, pieces (1) or not, tint it (1)
uniform sampler2D uBand;    // each cell's layer (0, 1/3, 2/3, 1), with pieces
uniform sampler2D uBackMin; // each backing point's lowest depth per layer (bytes, 255 none)
varying vec2 vUv;
varying float vD;
varying float vEdge;
vec3 psvRot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
vec4 psvPlace(vec3 p) {
  p = (p - uTf.xyz) * uTf.w;
  vec4 q = dot(uBodyQ, uBodyQ) < 1e-8 ? vec4(0.0, 0.0, 0.0, 1.0) : uBodyQ;
  p = uToy.xyz + psvRot(q, p - uToy.xyz) + uBodyT.xyz;
  return matrix_viewProjection * matrix_model * vec4(p, 1.0);
}
// The depth softened over about a twelfth of the picture: the picture's border and its frame take
// it, so the edge runs straight however noisy the depth is there.
float psvSoft(vec2 p) {
  vec2 st = vec2(0.02 * uGrid.y / uGrid.x, 0.02);
  float s = 0.0;
  for (int j = -2; j <= 2; j++)
    for (int i = -2; i <= 2; i++) s += textureLod(uDepth, clamp(p + vec2(float(i), float(j)) * st, 0.0, 1.0), 0.0).r;
  return s / 25.0;
}
// Within six cells of the border, the depth eases into the softened one (all of it within two).
float psvRim(vec2 uv, float d) {
  vec2 r = min(uv, 1.0 - uv) * uGrid.zw;
  float rd = min(r.x, r.y);
  if (rd >= 6.0) return d;
  return mix(psvSoft(uv), d, smoothstep(2.0, 6.0, rd));
}
// Lane Photo depth: how fully a point takes its piece's layer (1 from six cells and 3% of the picture
// in from the border; 0 within two cells): nearer the border the layers blend by depth, as before,
// so nothing is cut where no backing lies behind (it is inset 2%) and the outline stays straight.
float pdpDeep(vec2 uv) {
  vec2 r = min(uv, 1.0 - uv);
  vec2 c = r * uGrid.zw;
  return smoothstep(2.0, 6.0, min(c.x, c.y)) * smoothstep(0.02, 0.03, min(r.x, r.y));
}
void main(void) {
  float back = uLayer.z;
  if (back > 1.5) {
    // the frame: a corner -1 or 2 is that far outside the picture
    vec2 f = aPosition.xy;
    f = mix(f, -uFrame.xy, step(f, vec2(-0.5)));
    f = mix(f, 1.0 + uFrame.xy, step(vec2(1.5), f));
    // (at the depth of the picture's border beside it, so frame and picture meet with no gap)
    float fd = psvSoft(clamp(f, 0.0, 1.0));
    gl_Position = psvPlace(vec3((f.x - 0.5) * uGrid.x, (0.5 - f.y) * uGrid.y, uLift.x * (fd - uLift.y) + uFrame.z));
    vUv = vec2(0.0);
    vD = 0.0;
    vEdge = 0.0;
    return;
  }
  // (the backing is a little inside the picture, so it never shows past the edge as the view turns)
  vec2 uv = back > 0.5 ? 0.5 + (aPosition.xy - 0.5) * 0.96 : aPosition.xy;
  vec2 cuv = uv;
  bool pieces = uBack.z > 0.5;
  float d;
  if (back > 0.5) {
    // (its color: the farthest point within reach)
    d = 2.0;
    vec2 st = vec2(uLayer.w * uGrid.y / uGrid.x, uLayer.w) / 3.0;
    for (int j = -3; j <= 3; j++)
      for (int i = -3; i <= 3; i++) {
        vec2 s = clamp(uv + vec2(float(i), float(j)) * st, 0.0, 1.0);
        float t = textureLod(uDepth, s, 0.0).r;
        if (t < d) { d = t; cuv = s; }
      }
  } else d = textureLod(uDepth, uv, 0.0).r;
  float z;
  float pb = 0.0;
  if (back > 0.5 && pieces) {
    // Lane Photo depth: the lowest the surface is near here now (each layer's lowest depth within
    // reach, worked out at build, at its layer's height this frame), so it is behind at every
    // moment of the tap, not only at its ends (src/live/relief-height.js, backingHeight).
    vec2 ij = floor(aPosition.xy * uBack.xy + 0.5);
    vec4 lo = textureLod(uBackMin, (ij + 0.5) / (uBack.xy + 1.0), 0.0) * 255.0;
    z = 1e6;
    for (int k = 0; k < 4; k++)
      if (lo[k] < 254.5) z = min(z, (1.0 - uMorph[k]) * uLift.x * (floor(lo[k] + 0.5) / 255.0 - uLift.y) + (float(k) - 1.5) * uLayer.x);
    z += uLift.z;
  } else {
    float dz = back > 0.5 ? d : psvRim(uv, d);
    float b = back > 0.5 ? 0.0 : clamp(d * 4.0 - 0.5, 0.0, 3.0);
    if (back < 0.5 && pieces) {
      // Lane Photo depth: the layer of this point's piece of surface (one for the whole piece, as
      // the splats have), eased into the old blend by depth within six cells of the border.
      pb = floor(textureLod(uBand, uv, 0.0).r * 3.0 + 0.5);
      b = mix(clamp(dz * 4.0 - 0.5, 0.0, 3.0), pb, pdpDeep(uv));
    }
    float i0 = min(floor(b), 2.0);
    float f = b - i0;
    float m0 = i0 < 0.5 ? uMorph.x : (i0 < 1.5 ? uMorph.y : uMorph.z);
    float m1 = i0 < 0.5 ? uMorph.y : (i0 < 1.5 ? uMorph.z : uMorph.w);
    float m = mix(m0, m1, f);
    z = uLift.x * (dz - uLift.y);
    if (back > 0.5) z = mix(z + uLift.z, uLift.w, m);
    else z = mix(z, 0.0, m);
    z += (b - 1.5) * uLayer.x;
  }
  gl_Position = psvPlace(vec3((uv.x - 0.5) * uGrid.x, (0.5 - uv.y) * uGrid.y, z));
  vUv = cuv;
  vD = d;
  // A point beside a depth step (within a cell): every triangle touching it is dropped, so a cut is
  // a clean band (filled by the backing) instead of scattered triangles left on either side. With
  // pieces, a point beside another piece's layer is cut too, so no surface stretches between two
  // layers as they rise at different times.
  float e = 0.0;
  if (back < 0.5) {
    vec2 cell = 1.0 / uGrid.zw;
    for (int j = -1; j <= 1; j++)
      for (int i = -1; i <= 1; i++) {
        vec2 s = clamp(uv + vec2(float(i), float(j)) * cell, 0.0, 1.0);
        e = max(e, abs(textureLod(uDepth, s, 0.0).r - d));
        if (pieces && pdpDeep(uv) > 0.999 && abs(floor(textureLod(uBand, s, 0.0).r * 3.0 + 0.5) - pb) > 0.5) e = 1.0;
      }
  }
  vEdge = e > uLayer.y ? 1.0 : 0.0;
}
`;

const FS = /* glsl */ `
uniform sampler2D uColor;
uniform vec4 uGrid;
uniform vec4 uLayer;
uniform vec4 uBack;
varying vec2 vUv;
varying float vD;
varying float vEdge;
void main(void) {
  // (nothing is cut within a cell and a half of the picture's border, so its edge stays straight)
  vec2 rim = min(vUv, 1.0 - vUv) * uGrid.zw;
  if (uLayer.z < 0.5 && min(rim.x, rim.y) > 1.5) {
    if (vEdge > 0.001) discard;
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
  vec3 c = texture(uColor, vUv).rgb;
  if (uLayer.z > 0.5 && uLayer.z < 1.5 && uBack.w > 0.5) c = vec3(1.0, 0.0, 1.0); // (tests: the backing in magenta)
  gl_FragColor = vec4(uLayer.z > 1.5 ? vec3(0.133, 0.149, 0.173) : c, 1.0);
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
uniform uFrame: vec4f;
uniform uBack: vec4f;
var uDepth: texture_2d<f32>;
var uDepthSampler: sampler;
var uBand: texture_2d<f32>;
var uBandSampler: sampler;
var uBackMin: texture_2d<f32>;
var uBackMinSampler: sampler;
varying vUv: vec2f;
varying vD: f32;
varying vEdge: f32;
fn psvRot(q: vec4f, v: vec3f) -> vec3f { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
fn psvPlace(p0: vec3f) -> vec4f {
  var p = (p0 - uniform.uTf.xyz) * uniform.uTf.w;
  var q = uniform.uBodyQ;
  if (dot(q, q) < 1e-8) { q = vec4f(0.0, 0.0, 0.0, 1.0); }
  p = uniform.uToy.xyz + psvRot(q, p - uniform.uToy.xyz) + uniform.uBodyT.xyz;
  return uniform.matrix_viewProjection * uniform.matrix_model * vec4f(p, 1.0);
}
fn psvSoft(p: vec2f) -> f32 {
  let st = vec2f(0.02 * uniform.uGrid.y / uniform.uGrid.x, 0.02);
  var s = 0.0;
  for (var j: i32 = -2; j <= 2; j++) {
    for (var i: i32 = -2; i <= 2; i++) {
      s += textureSampleLevel(uDepth, uDepthSampler, clamp(p + vec2f(f32(i), f32(j)) * st, vec2f(0.0), vec2f(1.0)), 0.0).r;
    }
  }
  return s / 25.0;
}
fn psvRim(uv: vec2f, d: f32) -> f32 {
  let r = min(uv, 1.0 - uv) * uniform.uGrid.zw;
  let rd = min(r.x, r.y);
  if (rd >= 6.0) { return d; }
  return mix(psvSoft(uv), d, smoothstep(2.0, 6.0, rd));
}
fn pdpDeep(uv: vec2f) -> f32 {
  let r = min(uv, 1.0 - uv);
  let c = r * uniform.uGrid.zw;
  return smoothstep(2.0, 6.0, min(c.x, c.y)) * smoothstep(0.02, 0.03, min(r.x, r.y));
}
@vertex fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let back = uniform.uLayer.z;
  if (back > 1.5) {
    var f = input.aPosition.xy;
    f = mix(f, -uniform.uFrame.xy, step(f, vec2f(-0.5)));
    f = mix(f, 1.0 + uniform.uFrame.xy, step(vec2f(1.5), f));
    let fd = psvSoft(clamp(f, vec2f(0.0), vec2f(1.0)));
    output.position = psvPlace(vec3f((f.x - 0.5) * uniform.uGrid.x, (0.5 - f.y) * uniform.uGrid.y, uniform.uLift.x * (fd - uniform.uLift.y) + uniform.uFrame.z));
    output.vUv = vec2f(0.0);
    output.vD = 0.0;
    output.vEdge = 0.0;
    return output;
  }
  var uv = input.aPosition.xy;
  if (back > 0.5) { uv = 0.5 + (uv - 0.5) * 0.96; }
  var cuv = uv;
  let pieces = uniform.uBack.z > 0.5;
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
  var z: f32;
  var pb = 0.0;
  if (back > 0.5 && pieces) {
    let ij = floor(input.aPosition.xy * uniform.uBack.xy + 0.5);
    let lo = textureSampleLevel(uBackMin, uBackMinSampler, (ij + 0.5) / (uniform.uBack.xy + 1.0), 0.0) * 255.0;
    z = 1e6;
    for (var k: i32 = 0; k < 4; k++) {
      if (lo[k] < 254.5) {
        z = min(z, (1.0 - uniform.uMorph[k]) * uniform.uLift.x * (floor(lo[k] + 0.5) / 255.0 - uniform.uLift.y) + (f32(k) - 1.5) * uniform.uLayer.x);
      }
    }
    z += uniform.uLift.z;
  } else {
    var dz = d;
    if (back < 0.5) { dz = psvRim(uv, d); }
    var b = clamp(d * 4.0 - 0.5, 0.0, 3.0);
    if (back > 0.5) { b = 0.0; }
    if (back < 0.5 && pieces) {
      pb = floor(textureSampleLevel(uBand, uBandSampler, uv, 0.0).r * 3.0 + 0.5);
      b = mix(clamp(dz * 4.0 - 0.5, 0.0, 3.0), pb, pdpDeep(uv));
    }
    let i0 = min(floor(b), 2.0);
    let f = b - i0;
    let mo = uniform.uMorph;
    let m0 = select(select(mo.z, mo.y, i0 < 1.5), mo.x, i0 < 0.5);
    let m1 = select(select(mo.w, mo.z, i0 < 1.5), mo.y, i0 < 0.5);
    let m = mix(m0, m1, f);
    z = uniform.uLift.x * (dz - uniform.uLift.y);
    if (back > 0.5) { z = mix(z + uniform.uLift.z, uniform.uLift.w, m); } else { z = mix(z, 0.0, m); }
    z += (b - 1.5) * uniform.uLayer.x;
  }
  output.position = psvPlace(vec3f((uv.x - 0.5) * uniform.uGrid.x, (0.5 - uv.y) * uniform.uGrid.y, z));
  output.vUv = cuv;
  output.vD = d;
  var e = 0.0;
  if (back < 0.5) {
    let cell = 1.0 / uniform.uGrid.zw;
    for (var j: i32 = -1; j <= 1; j++) {
      for (var i: i32 = -1; i <= 1; i++) {
        let s = clamp(uv + vec2f(f32(i), f32(j)) * cell, vec2f(0.0), vec2f(1.0));
        e = max(e, abs(textureSampleLevel(uDepth, uDepthSampler, s, 0.0).r - d));
        if (pieces && pdpDeep(uv) > 0.999 && abs(floor(textureSampleLevel(uBand, uBandSampler, s, 0.0).r * 3.0 + 0.5) - pb) > 0.5) { e = 1.0; }
      }
    }
  }
  output.vEdge = select(0.0, 1.0, e > uniform.uLayer.y);
  return output;
}
`;

const FS_W = /* wgsl */ `
uniform uGrid: vec4f;
uniform uLayer: vec4f;
uniform uBack: vec4f;
var uColor: texture_2d<f32>;
var uColorSampler: sampler;
varying vUv: vec2f;
varying vD: f32;
varying vEdge: f32;
@fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let ux = dpdx(input.vUv);
  let uy = dpdy(input.vUv);
  let dx = dpdx(input.vD);
  let dy = dpdy(input.vD);
  let c = textureSample(uColor, uColorSampler, input.vUv);
  let rim = min(input.vUv, 1.0 - input.vUv) * uniform.uGrid.zw;
  if (uniform.uLayer.z < 0.5 && min(rim.x, rim.y) > 1.5) {
    if (input.vEdge > 0.001) { discard; }
    let det = ux.x * uy.y - ux.y * uy.x;
    if (abs(det) > 1e-18) {
      let gu = (dx * uy.y - dy * ux.y) / det;
      let gv = (ux.x * dy - uy.x * dx) / det;
      if (abs(gu) / uniform.uGrid.z + abs(gv) / uniform.uGrid.w > uniform.uLayer.y) { discard; }
    }
  }
  var rgb = c.rgb;
  if (uniform.uLayer.z > 0.5 && uniform.uLayer.z < 1.5 && uniform.uBack.w > 0.5) { rgb = vec3f(1.0, 0.0, 1.0); }
  output.color = vec4f(select(rgb, vec3f(0.133, 0.149, 0.173), uniform.uLayer.z > 1.5), 1.0);
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

// A thin dark frame round the picture, as four strips cut into short pieces along their length
// (so it follows the depth of the picture's border); a corner at -1 or 2 lies the frame's width
// outside the picture (the shader's mode 2).
function frameMesh(device, n = 96) {
  const along = [0];
  for (let k = 1; k <= n; k++) along.push(k / n);
  const strips = [
    [
      [-1, ...along, 2],
      [-1, 0],
    ],
    [
      [-1, ...along, 2],
      [1, 2],
    ],
    [[-1, 0], along],
    [[1, 2], along],
  ];
  const pos = [];
  const idx = [];
  for (const [us, vs] of strips) {
    const o = pos.length / 3;
    for (const v of vs) for (const u of us) pos.push(u, v, 0);
    for (let j = 0; j + 1 < vs.length; j++)
      for (let i = 0; i + 1 < us.length; i++) {
        const a = o + j * us.length + i;
        const c = a + us.length;
        idx.push(a, c, a + 1, a + 1, c, c + 1);
      }
  }
  const mesh = new pc.Mesh(device);
  mesh.setPositions(new Float32Array(pos), 3);
  mesh.setIndices(new Uint32Array(idx));
  mesh.update(pc.PRIMITIVE_TRIANGLES);
  return mesh;
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
    this.backCols = backCols;
    this.backRows = backRows;
    this.surface = gridMesh(device, cols, rows);
    this.backing = gridMesh(device, backCols, backRows);
    this.matS = material();
    this.matB = material();
    this.node = new pc.GraphNode("psv-relief");
    this.miS = new pc.MeshInstance(this.surface.mesh, this.matS, this.node);
    this.miB = new pc.MeshInstance(this.backing.mesh, this.matB, this.node);
    this.frame = frameMesh(device);
    this.matF = material();
    this.miF = new pc.MeshInstance(this.frame, this.matF, this.node);
    for (const mi of [this.miS, this.miB, this.miF]) mi.cull = false; // (the shader moves its points)
    this.layer = stage.app.scene.layers.getLayerByName("World");
    this.layer.addMeshInstances([this.miS, this.miB, this.miF]);
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
      uFrame: [0, 0, 0, 0],
      uBack: [backCols, backRows, 0, 0],
    };
    // Lane Photo depth: the pieces' layers and the backing's lowest depths (one-texel stand-ins
    // until setPieces; a moving clip never has them).
    this.band = this.byteTexture("psv-band", 1, 1, pc.PIXELFORMAT_R8, new Uint8Array([0]));
    this.backMin = this.byteTexture("psv-back-min", 1, 1, pc.PIXELFORMAT_RGBA8, new Uint8Array([255, 255, 255, 255])); // prettier-ignore
    this.pieceBytes = 0;
    for (const m of [this.matS, this.matB, this.matF]) {
      m.setParameter("uBand", this.band);
      m.setParameter("uBackMin", this.backMin);
    }
    this.visible = true;
  }

  byteTexture(name, width, height, format, data) {
    const t = new pc.Texture(this.device, {
      name,
      width,
      height,
      format,
      mipmaps: false,
      minFilter: pc.FILTER_NEAREST,
      magFilter: pc.FILTER_NEAREST,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: pc.ADDRESS_CLAMP_TO_EDGE,
    });
    t.lock().set(data);
    t.unlock();
    return t;
  }

  // Lane Photo depth: each connected piece of surface moves with one layer, as the splats do, and
  // the backing stays behind the surface at every moment of the tap.
  //   band   each cell's layer (0..3), gx by gy (the depth's own grid, from the splat build)
  //   depth  the same depth bytes setDepth was given (gx by gy)
  // With null, it goes back to the blend by depth (a moving clip).
  setPieces(p) {
    this.band.destroy();
    this.backMin.destroy();
    if (!p) {
      this.band = this.byteTexture("psv-band", 1, 1, pc.PIXELFORMAT_R8, new Uint8Array([0]));
      this.backMin = this.byteTexture("psv-back-min", 1, 1, pc.PIXELFORMAT_RGBA8, new Uint8Array([255, 255, 255, 255])); // prettier-ignore
      this.pieceBytes = 0;
      this.u.uBack[2] = 0;
    } else {
      const { band, depth, gx, gy, base = 0.5 } = p;
      const b = new Uint8Array(gx * gy);
      for (let i = 0; i < b.length; i++) b[i] = Math.round((Math.min(3, band[i]) * 255) / 3);
      this.band = this.byteTexture("psv-band", gx, gy, pc.PIXELFORMAT_R8, b);
      const field = backingField(depth, band, gx, gy, {
        cols: this.backCols,
        rows: this.backRows,
        reach: this.u.uLayer[3],
        // (the border band where layers blend: six cells, and at least 3% of the picture)
        rim: Math.max(6 / this.rows, 0.03 * Math.max(1, this.cols / this.rows)),
        base,
      });
      this.field = field;
      this.backMin = this.byteTexture("psv-back-min", this.backCols + 1, this.backRows + 1, pc.PIXELFORMAT_RGBA8, field); // prettier-ignore
      this.pieceBytes = gx * gy + field.length;
      this.u.uBack[2] = 1;
    }
    for (const m of [this.matS, this.matB, this.matF]) {
      m.setParameter("uBand", this.band);
      m.setParameter("uBackMin", this.backMin);
      m.setParameter("uBack", this.u.uBack);
    }
  }

  // The picture: { w, h, data: RGBA bytes }, or a <video>, canvas or ImageBitmap (uploaded by the
  // browser on the GPU's side, no copy here). Call again each frame for a playing video.
  setColor(src) {
    const media = isMedia(src);
    const w = media ? src.videoWidth || src.width : src.w;
    const h = media ? src.videoHeight || src.height : src.h;
    if (!w || !h) return false;
    // (a texture fed by a video or canvas is made again for bytes: it can't be locked)
    if (
      !this.color ||
      this.color.width !== w ||
      this.color.height !== h ||
      (!media && this.colorSrc)
    ) {
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
    for (const m of [this.matS, this.matB, this.matF]) m.setParameter("uColor", this.color);
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
    for (const m of [this.matS, this.matB, this.matF]) m.setParameter("uDepth", this.depth);
  }

  // The shape and motion (see the uniforms at the top); any subset.
  //   width, height (recipe units); lift, base; backOffset, backFlat; morph [4]; layers; cut;
  //   reach; fit { center, scale }; toy [3]; bodyQ [4]; bodyT [3]; frame { across, down, z } or null
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
    if (o.tint !== undefined) u.uBack[3] = o.tint ? 1 : 0; // (tests: the backing in magenta)
    if (o.frame !== undefined) u.uFrame = o.frame ? [o.frame.across, o.frame.down, o.frame.z, 1] : [0, 0, 0, 0]; // prettier-ignore
    for (const [m, back] of [
      [this.matS, 0],
      [this.matB, 1],
      [this.matF, 2],
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
    this.miF.visible = v && this.u.uFrame[3] > 0;
    this.visible = v;
  }

  // What it holds on the GPU, in bytes: the picture (with its mipmaps), the depth, the two grids.
  cost() {
    const depth = this.depth ? this.depth.width * this.depth.height : 0;
    return {
      color: this.colorBytes,
      depth,
      mesh: this.surface.bytes + this.backing.bytes,
      pieces: this.pieceBytes,
      triangles: 2 * (this.cols * this.rows) + this.backing.mesh.primitive[0].count / 3,
      total: this.colorBytes + depth + this.surface.bytes + this.backing.bytes + this.pieceBytes,
    };
  }

  destroy() {
    this.layer.removeMeshInstances([this.miS, this.miB, this.miF]);
    this.node.parent?.removeChild(this.node);
    this.surface.mesh.destroy();
    this.backing.mesh.destroy();
    this.frame.destroy();
    this.matF.destroy();
    this.color?.destroy();
    this.depth?.destroy();
    this.band.destroy();
    this.backMin.destroy();
    this.matS.destroy();
    this.matB.destroy();
    this.color = this.depth = null;
  }
}

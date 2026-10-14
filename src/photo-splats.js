import * as pc from "./pc.js";

// Engine (lane Photo fidelity): photo-textured splats.
//
// A splat is one color. A photo of a page of text needs about one splat per
// pixel to stay legible, far more than a phone can sort and draw. So a toy
// that shows a photo (Photo to 3D, Moving photo to 3D) may let each of its
// splats take its colors from the photo itself: the splat keeps its place,
// depth, size and Gaussian falloff (its shape, how it sorts and blends), and
// every pixel it covers reads the photo at the point of the picture under
// that pixel. Face on, the splats then draw the photo at its full resolution;
// turned, each splat carries its own patch of the picture with it, so the
// parallax is the splats'. Splats overlap, and overlapping splats read the
// same photo at the same place, so the overlap no longer softens anything.
//
// How it works:
//   - the recipe marks the splats (`photo: true` in a cloud sample: kit flag
//     32) and gives `photo: { rect, width, height, version(t), source(t) }`;
//   - the effects pass (the kit's work-buffer modifier, MODIFIER_KIT_PHOTO in
//     src/effects.js) writes each marked splat's place in the picture (u, v)
//     into an extra work-buffer stream, spPhoto, from its rest place;
//   - the render pass (the splat material's gsplatModifyVS) works out, for
//     each marked splat, how the picture's u and v change per screen pixel
//     there (the projection of the picture's two axes, uniforms from the
//     player each frame) and hands that and (u, v) to its fragments as two
//     flat user varyings (PlayCanvas's own mechanism);
//   - the fragment shader (with the kernel, src/kernels.js) finds the
//     fragment's offset from the splat's center in pixels from the
//     derivatives of the quad's own coordinates, and samples the photo
//     there, at the mip level its vertex worked out (mipmapped, so a small
//     view doesn't shimmer).
// The material's chunks, the stream and the varyings are only in place while
// such a toy shows; every other toy renders exactly as before. While one
// shows, the splats draw with the raster renderer (WebGPU's compute renderer
// has no hook for the varyings).

export const PHOTO_FLAG = 32;
export const PHOTO_STREAM = "spPhoto";
export const PHOTO_VARYINGS = ["spPhotoA", "spPhotoM"];

// The effects pass: the marked splat's (u, v) from its rest place (world x
// and y; uSpPhotoMap is u = x * a + b, v = y * c + d), each 1 + 16 bits
// (1 / 65,534 of the picture: 0.03 pixels of a 2,000-pixel photo), packed in
// one 32-bit number (a WebGPU pass may write at most 32 bytes a splat, and
// the work buffer takes 24); 0 is a splat without the photo. It sets
// spPhotoOut, which the work buffer's writeSplat writes (WRITE_WRAP): every
// effects program calls writeSplat, so while the stream exists every splat
// writes it (an output no program writes is dropped by the compiler, and
// WebGL then refuses the draw).
export const PHOTO_WRITE = {
  glslUniforms:
    "uniform vec4 uSpPhotoMap; uniform float uSpPhotoFill; // Photo fidelity: rest place to photo (u, v)",
  wgslUniforms:
    "uniform uSpPhotoMap: vec4f; uniform uSpPhotoFill: f32; // Photo fidelity: rest place to photo (u, v)",
  // This recipe explicitly excludes its backing from patterns (flag 16).
  // Ordinary added clay has neither flag and must retain its own color/extent.
  glsl: `if (spPhotoBit > 0.5 || (uSpPhotoFill > 0.5 && spNoPat > 0.5)) {
    vec2 uv = clamp(vec2(uSpPhotoMap.x * spRest.x + uSpPhotoMap.y, uSpPhotoMap.z * spRest.y + uSpPhotoMap.w), 0.0, 1.0);
    uvec2 q = uvec2(uv * vec2(uSpPhotoFill > 0.5 ? 32765.0 : 65533.0, 65533.0) + 1.5);
    if (uSpPhotoFill > 0.5 && spPhotoBit < 0.5) q.x |= 32768u;
    spPhotoOut = q.x | (q.y << 16u);
  }`,
  wgsl: `if (spPhotoBit > 0.5 || (uniform.uSpPhotoFill > 0.5 && spNoPat > 0.5)) {
    let uv = clamp(vec2f(uniform.uSpPhotoMap.x * spRest.x + uniform.uSpPhotoMap.y, uniform.uSpPhotoMap.z * spRest.y + uniform.uSpPhotoMap.w), vec2f(0.0), vec2f(1.0));
    var q = vec2u(uv * vec2f(select(65533.0, 32765.0, uniform.uSpPhotoFill > 0.5), 65533.0) + 1.5);
    if (uniform.uSpPhotoFill > 0.5 && spPhotoBit < 0.5) { q.x |= 32768u; }
    spPhotoOut = q.x | (q.y << 16u);
  }`,
};

// The work buffer's writeSplat (the format's write code), wrapped.
function wrapWrite(code, wgsl) {
  if (wgsl)
    return `
var<private> spPhotoOut: u32 = 0u;
${code.replace("fn writeSplat(", "fn spWriteSplat0(")}
fn writeSplat(center: vec3f, rotation: vec4f, scale: vec3f, color: vec4f) {
  spWriteSplat0(center, rotation, scale, color);
  writeSpPhoto(vec4u(spPhotoOut, 0u, 0u, 0u));
}
`;
  return `
uint spPhotoOut = 0u;
${code.replace("void writeSplat(", "void spWriteSplat0(")}
void writeSplat(vec3 center, vec4 rotation, vec3 scale, vec4 color) {
  spWriteSplat0(center, rotation, scale, color);
  writeSpPhoto(uvec4(spPhotoOut, 0u, 0u, 0u));
}
`;
}

// The (u, v) of a packed value; z 1 for a photo splat.
const GLSL_UNPACK = `
uniform float uSpPhotoFill;
vec4 spPhotoUnpack(uint q) {
  if (q == 0u) return vec4(0.0);
  if (uSpPhotoFill > 0.5) return vec4((float(q & 32767u) - 1.0) / 32765.0, (float(q >> 16u) - 1.0) / 65533.0, (q & 32768u) != 0u ? 2.0 : 1.0, 0.0);
  return vec4((vec2(float(q & 0xFFFFu), float(q >> 16u)) - 1.0) / 65533.0, 1.0, 0.0);
}
`;

// The render pass. GLSL wants the engine's matrices declared before use, and
// they are declared after gsplatModifyVS, so modifySplatColor calls a
// function declared here and defined at the end of gsplatOutputVS.
// uSpPhotoTu, uSpPhotoTv: the world's change per unit of u and of v (the
// picture's axes as they are now, turned with the toy).
const GLSL_VS_MODIFY = `
void spPhotoProject(vec3 c);
void modifySplatCenter(inout vec3 center) {
}
void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {
}
void modifySplatColor(vec3 center, inout vec4 color) {
  spPhotoProject(center);
}
`;

const GLSL_VS_PROJECT =
  GLSL_UNPACK +
  `
uniform vec4 uSpPhotoTu;
uniform vec4 uSpPhotoTv;
uniform vec4 uSpPhotoK;
uniform vec4 uSpPhotoBackK;
uniform vec2 uSpPhotoPlane; // x the flat photo's z, y shared-plane projection on
void spPhotoProject(vec3 c) {
  vec4 ph = spPhotoUnpack(loadSpPhoto().x);
  setSpPhotoA(vec4(0.0));
  setSpPhotoM(vec4(0.0));
  if (ph.z < 0.5) return;
  mat4 vp = matrix_projection * matrix_view * matrix_model;
  vec4 actual = vp * vec4(c, 1.0);
  bool samePlane = uSpPhotoPlane.y > 0.5 && ph.z < 1.5;
  vec4 cc = samePlane ? vp * vec4(c.xy, uSpPhotoPlane.x, 1.0) : actual;
  vec4 cu = vp * vec4(uSpPhotoTu.xyz, 0.0);
  vec4 cv = vp * vec4(uSpPhotoTv.xyz, 0.0);
  if (cc.w <= 1e-6) return;
  vec2 hv = 0.5 * viewport_size.xy;
  vec2 du = (cu.xy * cc.w - cc.xy * cu.w) / (cc.w * cc.w) * hv;
  vec2 dv = (cv.xy * cc.w - cc.xy * cv.w) / (cc.w * cc.w) * hv;
  float det = du.x * dv.y - du.y * dv.x;
  if (abs(det) < 1e-9) return;
  // the inverse of the 2 by 2 (pixels per u and v): u and v per pixel
  vec4 m = vec4(dv.y, -du.y, -dv.x, du.x) / det;
  // the photo's mip level for the splat: its texels per screen pixel (a splat is one scale)
  vec2 size = ph.z > 1.5 ? uSpPhotoBackK.xy : uSpPhotoK.yz;
  float lod = log2(max(max(length(m.xy * size), length(m.zw * size)), 1e-4));
  // Morph offsets and block ordering leave tiny per-splat z differences even
  // when flat. Anchor every foreground patch to the same photo plane, so
  // overlapping splats agree on the source pixel instead of mixing shifts.
  if (samePlane) {
    vec2 delta = (actual.xy / actual.w - cc.xy / cc.w) * hv;
    ph.xy += m.xy * delta.x + m.zw * delta.y;
  }
  setSpPhotoA(vec4(ph.xy, ph.z, lod));
  setSpPhotoM(m);
}
`;

// WGSL reads every uniform through \`uniform.\`, wherever it is declared.
// A framebuffer's y runs down on WebGPU (and the engine's projection flips
// for a render target), so the pixels' y is taken against the clip's y.
const WGSL_VS_MODIFY = `
uniform uSpPhotoTu: vec4f;
uniform uSpPhotoTv: vec4f;
uniform uSpPhotoK: vec4f;
uniform uSpPhotoBackK: vec4f;
uniform uSpPhotoFill: f32;
uniform uSpPhotoPlane: vec2f;
fn modifySplatCenter(center: ptr<function, vec3f>) {
}
fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {
}
fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
  let q = loadSpPhoto().x;
  setSpPhotoA(vec4f(0.0));
  setSpPhotoM(vec4f(0.0));
  if (q == 0u) { return; }
  var ph = (vec2f(f32(q & 0xFFFFu), f32(q >> 16u)) - 1.0) / 65533.0;
  var kind = 1.0;
  if (uniform.uSpPhotoFill > 0.5) {
    ph = vec2f((f32(q & 32767u) - 1.0) / 32765.0, (f32(q >> 16u) - 1.0) / 65533.0);
    if ((q & 32768u) != 0u) { kind = 2.0; }
  }
  let vp = uniform.matrix_projection * uniform.matrix_view * uniform.matrix_model;
  let actual = vp * vec4f(center, 1.0);
  let samePlane = uniform.uSpPhotoPlane.y > 0.5 && kind < 1.5;
  let cc = select(actual, vp * vec4f(center.xy, uniform.uSpPhotoPlane.x, 1.0), samePlane);
  let cu = vp * vec4f(uniform.uSpPhotoTu.xyz, 0.0);
  let cv = vp * vec4f(uniform.uSpPhotoTv.xyz, 0.0);
  if (cc.w <= 1e-6) { return; }
  let hv = vec2f(0.5, -0.5) * uniform.viewport_size.xy;
  let du = (cu.xy * cc.w - cc.xy * cu.w) / (cc.w * cc.w) * hv;
  let dv = (cv.xy * cc.w - cc.xy * cv.w) / (cc.w * cc.w) * hv;
  let det = du.x * dv.y - du.y * dv.x;
  if (abs(det) < 1e-9) { return; }
  let m = vec4f(dv.y, -du.y, -dv.x, du.x) / det;
  let size = select(uniform.uSpPhotoK.yz, uniform.uSpPhotoBackK.xy, kind > 1.5);
  let lod = log2(max(max(length(m.xy * size), length(m.zw * size)), 1e-4));
  if (samePlane) {
    let delta = (actual.xy / actual.w - cc.xy / cc.w) * hv;
    ph += m.xy * delta.x + m.zw * delta.y;
  }
  setSpPhotoA(vec4f(ph.xy, kind, lod));
  setSpPhotoM(m);
}
`;

// The fragment: its offset from the splat's center in pixels (the quad's
// coordinates are 0 at the center and change evenly across it), then the
// photo there. The derivatives are taken first, for every fragment (WGSL
// wants them in uniform control flow). It samples at the mip level the vertex
// worked out for the splat (one level a splat costs less than gradients per
// fragment). uSpPhotoK: x the brightness, y and z the photo's size in texels.
export const PHOTO_PS = {
  glsl: `
uniform sampler2D uSpPhoto;
uniform sampler2D uSpPhotoBack;
uniform float uSpPhotoFill;
uniform vec4 uSpPhotoK;
uniform vec2 uSpPhotoPlane;
// A flat photo uses a cubic footprint, with nine bilinear taps at one mip.
// This reconstructs small strokes without the per-patch phase aliasing.
vec3 spPhotoCubic(vec2 t, float lod) {
  float level = floor(max(lod, 0.0));
  vec2 size = max(vec2(1.0), floor(uSpPhotoK.yz * exp2(-level)));
  vec2 p = t * size - 0.5, f = fract(p), base = floor(p) + 0.5;
  vec2 f2 = f * f, f3 = f2 * f;
  vec2 w0 = -0.5 * f + f2 - 0.5 * f3;
  vec2 w1 = vec2(1.0) - 2.5 * f2 + 1.5 * f3;
  vec2 w2 = 0.5 * f + 2.0 * f2 - 1.5 * f3;
  vec2 w3 = -0.5 * f2 + 0.5 * f3;
  vec2 w12 = w1 + w2;
  vec3 xs = vec3(base.x - 1.0, base.x + w2.x / w12.x, base.x + 2.0) / size.x;
  vec3 ys = vec3(base.y - 1.0, base.y + w2.y / w12.y, base.y + 2.0) / size.y;
  vec3 wx = vec3(w0.x, w12.x, w3.x), wy = vec3(w0.y, w12.y, w3.y);
  vec3 result = vec3(0.0);
  for (int y = 0; y < 3; y++) for (int x = 0; x < 3; x++)
    result += textureLod(uSpPhoto, vec2(xs[x], ys[y]), level).rgb * wx[x] * wy[y];
  return clamp(result, vec3(0.0), vec3(1.0));
}
void spPhotoColor(vec2 uv, inout vec4 color) {
  vec2 gx = dFdx(uv);
  vec2 gy = dFdy(uv);
  vec4 a = getSpPhotoA();
  if (a.z < 0.5) return;
  float det = gx.x * gy.y - gx.y * gy.x;
  if (abs(det) < 1e-9) return;
  vec2 p = vec2(gy.y * uv.x - gy.x * uv.y, gx.x * uv.y - gx.y * uv.x) / det;
  vec4 m = getSpPhotoM();
  vec2 t = a.xy + m.xy * p.x + m.zw * p.y;
  if (uSpPhotoFill > 0.5 && (any(lessThan(t, vec2(0.0))) || any(greaterThan(t, vec2(1.0))))) { color.a = 0.0; return; }
  vec3 c = a.z > 1.5 ? textureLod(uSpPhotoBack, t, a.w).rgb :
    (uSpPhotoPlane.y > 0.5 ? spPhotoCubic(t, a.w) : textureLod(uSpPhoto, t, a.w - (uSpPhotoFill > 0.5 ? 0.75 : 0.0)).rgb);
  color.rgb = c * uSpPhotoK.x;
}
`,
  wgsl: `
var uSpPhoto: texture_2d<f32>;
var uSpPhotoSampler: sampler;
var uSpPhotoBack: texture_2d<f32>;
var uSpPhotoBackSampler: sampler;
uniform uSpPhotoFill: f32;
uniform uSpPhotoK: vec4f;
uniform uSpPhotoPlane: vec2f;
fn spPhotoCubic(t: vec2f, lod: f32) -> vec3f {
  let level = floor(max(lod, 0.0));
  let size = max(vec2f(1.0), floor(uniform.uSpPhotoK.yz * exp2(-level)));
  let p = t * size - 0.5;
  let f = fract(p);
  let base = floor(p) + 0.5;
  let f2 = f * f;
  let f3 = f2 * f;
  let w0 = -0.5 * f + f2 - 0.5 * f3;
  let w1 = vec2f(1.0) - 2.5 * f2 + 1.5 * f3;
  let w2 = 0.5 * f + 2.0 * f2 - 1.5 * f3;
  let w3 = -0.5 * f2 + 0.5 * f3;
  let w12 = w1 + w2;
  let xs = vec3f(base.x - 1.0, base.x + w2.x / w12.x, base.x + 2.0) / size.x;
  let ys = vec3f(base.y - 1.0, base.y + w2.y / w12.y, base.y + 2.0) / size.y;
  let wx = vec3f(w0.x, w12.x, w3.x);
  let wy = vec3f(w0.y, w12.y, w3.y);
  var result = vec3f(0.0);
  for (var y = 0; y < 3; y++) { for (var x = 0; x < 3; x++) {
    result += textureSampleLevel(uSpPhoto, uSpPhotoSampler, vec2f(xs[x], ys[y]), level).rgb * wx[x] * wy[y];
  } }
  return clamp(result, vec3f(0.0), vec3f(1.0));
}
fn spPhotoColor(uv: vec2f, color: ptr<function, vec4f>) {
  let gx = dpdx(uv);
  let gy = dpdy(uv);
  let a = getSpPhotoA();
  if (a.z < 0.5) { return; }
  let det = gx.x * gy.y - gx.y * gy.x;
  if (abs(det) < 1e-9) { return; }
  let p = vec2f(gy.y * uv.x - gy.x * uv.y, gx.x * uv.y - gx.y * uv.x) / det;
  let m = getSpPhotoM();
  let t = a.xy + m.xy * p.x + m.zw * p.y;
  if (uniform.uSpPhotoFill > 0.5 && (any(t < vec2f(0.0)) || any(t > vec2f(1.0)))) { *color = vec4f((*color).rgb, 0.0); return; }
  var c = textureSampleLevel(uSpPhoto, uSpPhotoSampler, t, a.w - select(0.0, 0.75, uniform.uSpPhotoFill > 0.5)).rgb;
  if (a.z > 1.5) { c = textureSampleLevel(uSpPhotoBack, uSpPhotoBackSampler, t, a.w).rgb; }
  else if (uniform.uSpPhotoPlane.y > 0.5) { c = spPhotoCubic(t, a.w); }
  *color = vec4f(c * uniform.uSpPhotoK.x, (*color).a);
}
`,
};

// The fragment chunk with the photo: the kernel's own function renamed, then
// a modifySplatColor that runs it and then reads the photo.
export function withPhotoPS(code) {
  return {
    glsl:
      code.glsl.replace("void modifySplatColor(", "void spKernelColor(") +
      PHOTO_PS.glsl +
      "\nvoid modifySplatColor(vec2 uv, inout vec4 color) {\n  spPhotoColor(uv, color);\n  spKernelColor(uv, color);\n}\n",
    wgsl:
      code.wgsl.replace("fn modifySplatColor(", "fn spKernelColor(") +
      PHOTO_PS.wgsl +
      "\nfn modifySplatColor(uv: vec2f, color: ptr<function, vec4f>) {\n  spPhotoColor(uv, color);\n  spKernelColor(uv, color);\n}\n",
  };
}

const backgrounds = new WeakMap();
const watching = new WeakSet();
function bindBackground(app) {
  const b = backgrounds.get(app) || { data: null, source: null };
  backgrounds.set(app, b);
  if (!b.texture) {
    b.texture = new pc.Texture(app.graphicsDevice, {
      name: "p3d-splat-background",
      width: 1,
      height: 1,
      format: pc.PIXELFORMAT_RGBA8,
      mipmaps: true,
      minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
      magFilter: pc.FILTER_LINEAR,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: pc.ADDRESS_CLAMP_TO_EDGE,
    });
  }
  b.on = true;
  const data = b.data || { w: 1, h: 1, rgba: new Uint8Array([255, 255, 255, 255]) };
  if (b.texture.width !== data.w || b.texture.height !== data.h) b.texture.resize(data.w, data.h);
  b.texture.lock().set(data.rgba);
  b.texture.unlock();
  b.texture.upload();
  if (app.graphicsDevice.isWebGPU) app.graphicsDevice.submit();
  app.scene.gsplat.material.setParameter("uSpPhotoBack", b.texture);
  app.graphicsDevice.scope.resolve("uSpPhotoBackK").setValue([data.w, data.h, 0, 0]);
  app.graphicsDevice.scope.resolve("uSpPhotoFill").setValue(0);
  app.graphicsDevice.scope.resolve("uSpPhotoPlane").setValue([0, 0]);
}

// Only the still photo that supplied this canvas uses the second texture.
// Switching to Moving photo or live input clears the flag automatically, even
// when the player keeps its photo material and work-buffer stream alive.
export function setFilledBackground(stage, data, source) {
  if (!stage) return;
  const b = backgrounds.get(stage.app) || { texture: null, on: false };
  b.data = data;
  b.source = source;
  backgrounds.set(stage.app, b);
  if (b.on) bindBackground(stage.app);
  if (!watching.has(stage)) {
    watching.add(stage);
    stage.onUpdate(() => {
      const current = backgrounds.get(stage.app);
      const enabled =
        current?.on &&
        current.data &&
        stage.photo &&
        stage.photoTex?.getSource() === current.source;
      stage.device.scope.resolve("uSpPhotoFill").setValue(enabled ? 1 : 0);
      const app = globalThis.window?.__splashery?.app;
      const pl = app?.player || globalThis.window?.__splashery?.player;
      const controls = pl?.motion?.state;
      const flat =
        enabled &&
        pl?.scene?.toy?.id === "photo-3d" &&
        controls?.flat >= 0.9999 &&
        Math.abs(controls.layers || 0) < 0.0001 &&
        (!app?.tool || app.tool === "orbit") &&
        !pl.handsOn?.mode &&
        pl.scene.motion.move === "still" &&
        !Object.values(pl.scene.effects || {}).some((e) => e?.on);
      stage.device.scope
        .resolve("uSpPhotoPlane")
        .setValue(flat ? [pl.fromRecipe([0, 0, 0])[2], 1] : [0, 0]);
    });
  }
}

// Turns the render side on or off on a PlayCanvas app (the stream, the
// varyings, the material's vertex chunks, the work buffer's write code and the
// renderer). `state` keeps what was there, to put back. Returns the new state.
export function photoRender(pc, app, on, state = null) {
  const g = app.scene.gsplat;
  const mat = g.material;
  if (on && !state) {
    state = {
      vsGlsl: mat.shaderChunks.glsl.get("gsplatModifyVS"),
      vsWgsl: mat.shaderChunks.wgsl.get("gsplatModifyVS"),
      outGlsl: mat.shaderChunks.glsl.get("gsplatOutputVS"),
      renderer: g.renderer,
      write: g.format.getWriteCode(),
    };
    const gpu = app.graphicsDevice.isWebGPU;
    g.format.setWriteCode(wrapWrite(state.write, false), wrapWrite(state.write, true));
    g.format.addExtraStreams([{ name: PHOTO_STREAM, format: pc.PIXELFORMAT_R32U }]);
    g.varyings.add(PHOTO_VARYINGS.map((name) => ({ name, type: pc.TYPE_FLOAT32, components: 4 })));
    mat.shaderChunks.glsl.set("gsplatModifyVS", GLSL_VS_MODIFY);
    const outBase = state.outGlsl ?? pc.ShaderChunks.get(app.graphicsDevice, "glsl").get("gsplatOutputVS"); // prettier-ignore
    mat.shaderChunks.glsl.set("gsplatOutputVS", outBase + GLSL_VS_PROJECT);
    mat.shaderChunks.wgsl.set("gsplatModifyVS", WGSL_VS_MODIFY);
    if (gpu) g.renderer = pc.GSPLAT_RENDERER_RASTER_CPU_SORT;
    bindBackground(app);
    mat.update();
    return state;
  }
  if (!on && state) {
    const put = (chunks, name, v) => (v == null ? chunks.delete(name) : chunks.set(name, v));
    put(mat.shaderChunks.glsl, "gsplatModifyVS", state.vsGlsl);
    put(mat.shaderChunks.wgsl, "gsplatModifyVS", state.vsWgsl);
    put(mat.shaderChunks.glsl, "gsplatOutputVS", state.outGlsl);
    g.varyings.remove(PHOTO_VARYINGS);
    const gpu = app.graphicsDevice.isWebGPU;
    g.format.setWriteCode(gpu ? null : state.write, gpu ? state.write : null);
    g.format.removeExtraStreams([PHOTO_STREAM]);
    if (g.renderer !== state.renderer) g.renderer = state.renderer;
    mat.deleteParameter("uSpPhotoBack");
    const background = backgrounds.get(app);
    background?.texture?.destroy();
    if (background) {
      background.texture = null;
      background.on = false;
    }
    app.graphicsDevice.scope.resolve("uSpPhotoFill").setValue(0);
    app.graphicsDevice.scope.resolve("uSpPhotoPlane").setValue([0, 0]);
    mat.update();
    return null;
  }
  return state;
}

// The uniforms for a frame. rect: the picture's corners in the world as they
// rest ({ x0, x1, y0, y1 }, y1 the top, before the toy's body turn), q: the
// body's turn (quaternion, x y z w), gain: the brightness, size: the photo's
// width and height in texels.
export function photoUniforms(rect, q = [0, 0, 0, 1], gain = 1, size = [1, 1]) {
  const sx = rect.x1 - rect.x0;
  const sy = rect.y1 - rect.y0;
  const rot = (v) => {
    const [x, y, z, w] = q;
    // v + 2w (q × v) + 2 q × (q × v)
    const c1 = [y * v[2] - z * v[1], z * v[0] - x * v[2], x * v[1] - y * v[0]];
    const c2 = [y * c1[2] - z * c1[1], z * c1[0] - x * c1[2], x * c1[1] - y * c1[0]];
    return [v[0] + 2 * (w * c1[0] + c2[0]), v[1] + 2 * (w * c1[1] + c2[1]), v[2] + 2 * (w * c1[2] + c2[2])]; // prettier-ignore
  };
  return {
    map: [1 / sx, -rect.x0 / sx, -1 / sy, rect.y1 / sy],
    tu: [...rot([sx, 0, 0]), 0],
    tv: [...rot([0, -sy, 0]), 0],
    k: [gain, size[0], size[1], 0],
  };
}

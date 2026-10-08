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
  glslUniforms: "uniform vec4 uSpPhotoMap; // Photo fidelity: rest place to photo (u, v)",
  wgslUniforms: "uniform uSpPhotoMap: vec4f; // Photo fidelity: rest place to photo (u, v)",
  glsl: "if (spPhotoBit > 0.5) { uvec2 q = uvec2(clamp(vec2(uSpPhotoMap.x * spRest.x + uSpPhotoMap.y, uSpPhotoMap.z * spRest.y + uSpPhotoMap.w), 0.0, 1.0) * 65533.0 + 1.5); spPhotoOut = q.x | (q.y << 16u); }",
  wgsl: "if (spPhotoBit > 0.5) { let q = vec2u(clamp(vec2f(uniform.uSpPhotoMap.x * spRest.x + uniform.uSpPhotoMap.y, uniform.uSpPhotoMap.z * spRest.y + uniform.uSpPhotoMap.w), vec2f(0.0), vec2f(1.0)) * 65533.0 + 1.5); spPhotoOut = q.x | (q.y << 16u); }",
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
vec4 spPhotoUnpack(uint q) {
  if (q == 0u) return vec4(0.0);
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
void spPhotoProject(vec3 c) {
  vec4 ph = spPhotoUnpack(loadSpPhoto().x);
  setSpPhotoA(vec4(0.0));
  setSpPhotoM(vec4(0.0));
  if (ph.z < 0.5) return;
  mat4 vp = matrix_projection * matrix_view * matrix_model;
  vec4 cc = vp * vec4(c, 1.0);
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
  float lod = log2(max(max(length(m.xy * uSpPhotoK.yz), length(m.zw * uSpPhotoK.yz)), 1e-4));
  setSpPhotoA(vec4(ph.xy, 1.0, lod));
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
fn modifySplatCenter(center: ptr<function, vec3f>) {
}
fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {
}
fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
  let q = loadSpPhoto().x;
  setSpPhotoA(vec4f(0.0));
  setSpPhotoM(vec4f(0.0));
  if (q == 0u) { return; }
  let ph = (vec2f(f32(q & 0xFFFFu), f32(q >> 16u)) - 1.0) / 65533.0;
  let vp = uniform.matrix_projection * uniform.matrix_view * uniform.matrix_model;
  let cc = vp * vec4f(center, 1.0);
  let cu = vp * vec4f(uniform.uSpPhotoTu.xyz, 0.0);
  let cv = vp * vec4f(uniform.uSpPhotoTv.xyz, 0.0);
  if (cc.w <= 1e-6) { return; }
  let hv = vec2f(0.5, -0.5) * uniform.viewport_size.xy;
  let du = (cu.xy * cc.w - cc.xy * cu.w) / (cc.w * cc.w) * hv;
  let dv = (cv.xy * cc.w - cc.xy * cv.w) / (cc.w * cc.w) * hv;
  let det = du.x * dv.y - du.y * dv.x;
  if (abs(det) < 1e-9) { return; }
  let m = vec4f(dv.y, -du.y, -dv.x, du.x) / det;
  let lod = log2(max(max(length(m.xy * uniform.uSpPhotoK.yz), length(m.zw * uniform.uSpPhotoK.yz)), 1e-4));
  setSpPhotoA(vec4f(ph.xy, 1.0, lod));
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
uniform vec4 uSpPhotoK;
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
  color.rgb = textureLod(uSpPhoto, t, a.w).rgb * uSpPhotoK.x;
}
`,
  wgsl: `
var uSpPhoto: texture_2d<f32>;
var uSpPhotoSampler: sampler;
uniform uSpPhotoK: vec4f;
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
  let c = textureSampleLevel(uSpPhoto, uSpPhotoSampler, t, a.w).rgb;
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

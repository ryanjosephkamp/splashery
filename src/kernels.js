// Lane Lab: splat kernels other than the Gaussian (off by default).
//
// PlayCanvas draws each splat as a quad whose fragment shader computes the
// Gaussian falloff, alpha = normExp(|uv|²) · opacity, and then calls a hook,
// modifySplatColor(uv, color) (the "gsplatModifyPS" chunk, empty by default).
// A kernel here swaps the falloff inside that hook: it recovers the opacity
// from the Gaussian alpha and applies its own profile instead. The quad is the
// engine's, so a kernel can only be as wide as the Gaussian or narrower.
//
//   gaussian  today's look (the chunk is left alone).
//   sharp     a generalized exponential, exp(−c·A²) with A = |uv|²: a flatter
//             top and a steeper edge, scaled to cover the same area.
//
// The sharp kernel blends back to the Gaussian as a splat shrinks toward a
// pixel or two on screen (measured with fwidth), where a sharper edge could
// only alias. A kernel applies to everything the scene draws (one unified
// material), so the player sets it per toy: the recipe's `kernel` field or
// ?kernel=, both labs only. docs/lab/LITERATURE.md has the background and
// docs/lab/KERNELS.md the measurements (a flat disc and a steeper exp(−c·A³)
// were tried there too, and showed each splat as a visible scale).

export const KERNELS = ["gaussian", "sharp"];

// The Gaussian's normalized falloff covers π·0.2313 of the unit quad and
// exp(−14.7·A²) covers the same, so a surface keeps its coverage and color
// when the kernel changes. t: the kernel is fully sharp once its half-width
// (0.48 of the quad) is 3 pixels or more, and fully Gaussian at 1 pixel.
const GLSL = (body) => `
float spGauss(float A) {
  return (exp(-4.0 * A) - exp(-4.0)) / (1.0 - exp(-4.0));
}
void modifySplatColor(vec2 uv, inout vec4 color) {
  float A = dot(uv, uv);
  float g = spGauss(A);
  float opacity = color.a / max(g, 1e-5);
  vec2 fw = fwidth(uv);
  float px = max(max(fw.x, fw.y), 1e-5);
  float halfPx = 0.48 / px;
  float t = clamp((halfPx - 1.0) * 0.5, 0.0, 1.0);
  float k = g;
  ${body}
  color.a = clamp(mix(g, k, t) * opacity, 0.0, 1.0);
}
`;

const WGSL = (body) => `
fn spGauss(A: f32) -> f32 {
  return (exp(-4.0 * A) - exp(-4.0)) / (1.0 - exp(-4.0));
}
fn modifySplatColor(uv: vec2f, color: ptr<function, vec4f>) {
  let A = dot(uv, uv);
  let g = spGauss(A);
  let opacity = (*color).a / max(g, 1e-5);
  let fw = fwidth(uv);
  let px = max(max(fw.x, fw.y), 1e-5);
  let halfPx = 0.48 / px;
  let t = clamp((halfPx - 1.0) * 0.5, 0.0, 1.0);
  var k = g;
  ${body}
  (*color).a = clamp(mix(g, k, t) * opacity, 0.0, 1.0);
}
`;

const BODY = {
  sharp: { glsl: "k = exp(-14.7 * A * A);", wgsl: "k = exp(-14.7 * A * A);" },
};

// The engine's own (empty) hook, put back when a toy returns to the Gaussian.
const PLAIN = {
  glsl: "\nvoid modifySplatColor(vec2 gaussianUV, inout vec4 color) {\n}\n",
  wgsl: "\nfn modifySplatColor(gaussianUV: vec2f, color: ptr<function, vec4f>) {\n}\n",
};

export function kernelChunks(name) {
  const b = BODY[name];
  return b ? { glsl: GLSL(b.glsl), wgsl: WGSL(b.wgsl) } : PLAIN;
}

export function normalizeKernel(name) {
  return KERNELS.includes(name) ? name : "gaussian";
}

// Which kernel a toy shows: ?kernel= wins, then the recipe's own `kernel`;
// both only while labs is on. Anything else is the Gaussian.
export function pickKernel({ labs, param, recipe }) {
  if (!labs) return "gaussian";
  if (KERNELS.includes(param)) return param;
  return normalizeKernel(recipe);
}

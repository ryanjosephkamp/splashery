import { MODIFIER_KIT } from "../../effects.js";

// Extend the existing kit program locally: keep all rigid-token transforms,
// sorting, patterns, and exposure. Five unused token slots carry 15 forces.
export function forceModifier(fit) {
  const scale = Number(fit.scale).toFixed(9);
  const glsl = `
  vec4 tr = loadSplatAnim();
  int member = int(tr.w + 0.5) - 1;
  if (member >= 0 && member < 15) {
    vec3 packed = uSpTokens[(40 + member / 3) * 2].xyz / ${scale};
    float force = packed[member % 3];
    vec3 ink = force > 0.0 ? vec3(0.12, 0.52, 0.98) : vec3(0.95, 0.22, 0.17);
    ink = mix(vec3(0.65), ink, smoothstep(0.001, 0.10, abs(force)));
    color.rgb *= ink * (0.72 + 0.28 * min(abs(force), 1.0));
  }
`;
  const wgsl = `
  let tr = loadSplatAnim();
  let member = i32(tr.w + 0.5) - 1;
  if (member >= 0 && member < 15) {
    let packed = uniform.uSpTokens[(40 + member / 3) * 2].xyz / ${scale};
    let force = packed[member % 3];
    var ink = select(vec3f(0.95, 0.22, 0.17), vec3f(0.12, 0.52, 0.98), force > 0.0);
    ink = mix(vec3f(0.65), ink, smoothstep(0.001, 0.10, abs(force)));
    base = base * ink * (0.72 + 0.28 * min(abs(force), 1.0));
  }
`;
  return {
    glsl: MODIFIER_KIT.glsl.replace(
      "void modifySplatColor(vec3 center, inout vec4 color) {",
      `void modifySplatColor(vec3 center, inout vec4 color) {${glsl}`,
    ),
    wgsl: MODIFIER_KIT.wgsl.replace("var base = (*color).rgb;", `var base = (*color).rgb;${wgsl}`),
  };
}

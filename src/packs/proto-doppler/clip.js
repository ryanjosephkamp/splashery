import { MODIFIER_KIT } from "../../effects.js";

// Keep wavefronts and cone edges inside the demonstration board. This
// extends the existing kit program through its labs-only recipe hook;
// all rigid parts still use the engine's unchanged kit transforms.
export function boardClip(fit) {
  const center = fit.center.map((n) => Number(n).toFixed(8)).join(", ");
  const scale = Number(fit.scale).toFixed(8);
  const glsl = `center = spKitCenter(center);
    vec3 dp = center / ${scale} + vec3(${center});
    int dpPart = int(loadSplatAnim().x + 0.5) & 15;
    if (dpPart >= 2 && (abs(dp.x) > 1.18 || abs(dp.y) > 1.45)) spKitScale = 0.0;`;
  const wgsl = `*center = spKitCenter(*center);
    let dp = *center / ${scale} + vec3f(${center});
    let dpPart = i32(loadSplatAnim().x + 0.5) & 15;
    if (dpPart >= 2 && (abs(dp.x) > 1.18 || abs(dp.y) > 1.45)) { spKitScale = 0.0; }`;
  return {
    glsl: MODIFIER_KIT.glsl.replace("center = spKitCenter(center);", glsl),
    wgsl: MODIFIER_KIT.wgsl.replace("*center = spKitCenter(*center);", wgsl),
  };
}

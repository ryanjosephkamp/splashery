// Scan rigs: moving parts for captured toys. A captured toy is one splat
// cloud with no parts, so a rig (src/rigs.js) names a few parts and, for
// each, soft ellipsoid regions in world coordinates. Once the toy is loaded,
// a GPU pass (GSplatProcessor) writes each splat's part and weight into the
// per-splat "splatPart" stream; the effect modifier's rig variant then moves
// every splat with its part's transform (uSpParts, as for kit toys), blended
// by the weight, so soft edges bend instead of tearing. The rig's controls,
// action and drive() work like a kit recipe's (docs/PACKS.md), and drive()
// may also move the whole toy (out.body) for squash, rock and hop effects.

import * as pc from "./pc.js";

export const MAX_REGIONS = 12;

const PROCESS_GLSL = /* glsl */ `
uniform vec4 uRigM0;   // model -> world, row 0
uniform vec4 uRigM1;
uniform vec4 uRigM2;
uniform vec4 uRigN;    // x region count
uniform vec4 uRigA[${MAX_REGIONS}]; // xyz centre (world), w part index
uniform vec4 uRigB[${MAX_REGIONS}]; // xyz radii, w soft edge (0..1 of the radius)
void process() {
  vec4 h = vec4(getCenter(), 1.0);
  vec3 p = vec3(dot(uRigM0, h), dot(uRigM1, h), dot(uRigM2, h));
  float part = 0.0;
  float w = 0.0;
  for (int i = 0; i < ${MAX_REGIONS}; i++) {
    if (float(i) >= uRigN.x) break;
    float r = length((p - uRigA[i].xyz) / uRigB[i].xyz);
    float wi = 1.0 - smoothstep(1.0 - max(uRigB[i].w, 0.001), 1.0, r);
    if (wi > 0.0 && wi >= w) {
      w = wi;
      part = uRigA[i].w;
    }
  }
  writeSplatPart(vec4(part / 255.0, w, 0.0, 0.0));
}
`;

const PROCESS_WGSL = /* wgsl */ `
uniform uRigM0: vec4f;
uniform uRigM1: vec4f;
uniform uRigM2: vec4f;
uniform uRigN: vec4f;
uniform uRigA: array<vec4f, ${MAX_REGIONS}>;
uniform uRigB: array<vec4f, ${MAX_REGIONS}>;
fn process() {
  let h = vec4f(getCenter(), 1.0);
  let p = vec3f(dot(uniform.uRigM0, h), dot(uniform.uRigM1, h), dot(uniform.uRigM2, h));
  var part = 0.0;
  var w = 0.0;
  for (var i = 0; i < ${MAX_REGIONS}; i++) {
    if (f32(i) >= uniform.uRigN.x) { break; }
    let a = uniform.uRigA[i];
    let b = uniform.uRigB[i];
    let r = length((p - a.xyz) / b.xyz);
    let wi = 1.0 - smoothstep(1.0 - max(b.w, 0.001), 1.0, r);
    if (wi > 0.0 && wi >= w) {
      w = wi;
      part = a.w;
    }
  }
  writeSplatPart(vec4f(part / 255.0, w, 0.0, 0.0));
}
`;

// The parts list a MotionDriver expects (index 0 is the unmoved body) and
// the flat region table for the tagging pass.
export function rigLayout(rig) {
  const parts = [{ name: "body", pivot: [0, 0, 0], axis: [0, 1, 0] }];
  const regions = [];
  for (const p of rig.parts) {
    parts.push({ name: p.name, pivot: p.pivot.slice(), axis: unitAxis(p.axis || [0, 1, 0]) });
    for (const r of p.regions) {
      const rad = typeof r.r === "number" ? [r.r, r.r, r.r] : r.r;
      regions.push({ part: parts.length - 1, at: r.at, r: rad, soft: r.soft ?? 0.3 });
    }
  }
  if (parts.length > 16) throw new Error("A rig can have at most 15 parts.");
  if (regions.length > MAX_REGIONS) throw new Error(`A rig can have at most ${MAX_REGIONS} regions.`); // prettier-ignore
  return { parts, regions };
}

function unitAxis(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

// Writes the splatPart stream of the stage's current toy from a rig.
export function tagRig(stage, rig) {
  const toy = stage.toy;
  if (!toy?.rig) return false;
  const g = toy.entity.gsplat;
  const proc = new pc.GSplatProcessor(
    stage.device,
    { component: g },
    { component: g, streams: ["splatPart"] },
    { processGLSL: PROCESS_GLSL, processWGSL: PROCESS_WGSL },
  );
  const { regions } = rigLayout(rig);
  const m = toy.entity.getWorldTransform().data; // column-major 4x4
  proc.setParameter("uRigM0", [m[0], m[4], m[8], m[12]]);
  proc.setParameter("uRigM1", [m[1], m[5], m[9], m[13]]);
  proc.setParameter("uRigM2", [m[2], m[6], m[10], m[14]]);
  proc.setParameter("uRigN", [regions.length, 0, 0, 0]);
  const a = new Float32Array(MAX_REGIONS * 4);
  const b = new Float32Array(MAX_REGIONS * 4).fill(1);
  regions.forEach((r, i) => {
    a.set([r.at[0], r.at[1], r.at[2], r.part], i * 4);
    b.set([r.r[0], r.r[1], r.r[2], r.soft], i * 4);
  });
  proc.setParameter("uRigA[0]", a);
  proc.setParameter("uRigB[0]", b);
  proc.process();
  // WebGPU may run the pass with the frame, so it is freed with the toy.
  toy.rigProc?.destroy();
  toy.rigProc = proc;
  stage.requestRender();
  return true;
}

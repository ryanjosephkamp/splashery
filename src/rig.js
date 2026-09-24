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
import { rgb as hexColor } from "./kit.js";

export const MAX_REGIONS = 16;

const PROCESS_GLSL = /* glsl */ `
uniform vec4 uRigM0;   // model -> world, row 0
uniform vec4 uRigM1;
uniform vec4 uRigM2;
uniform vec4 uRigN;    // x region count
uniform vec4 uRigA[${MAX_REGIONS}]; // xyz centre (world), w part index (+ 64: wins over other regions)
uniform vec4 uRigB[${MAX_REGIONS}]; // xyz radii, w soft edge (0..1 of the radius)
uniform vec4 uRigC[${MAX_REGIONS}]; // rgb colour the region needs, w tolerance (0 = any colour, < 0 = any but this)
uniform vec4 uRigK[4];  // two keys: [centre xyz, radius (0 = anywhere)], [rgb, tolerance (< 0: long splats)]
float rigKey(vec3 p, vec3 col, vec3 s, vec4 at, vec4 key) {
  if (key.w == 0.0) return 0.0;
  float m;
  if (key.w < 0.0) {
    float hi = max(s.x, max(s.y, s.z));
    float mid = s.x + s.y + s.z - hi - min(s.x, min(s.y, s.z));
    m = mid < -key.w * hi ? 1.0 : 0.0;
  } else {
    m = 1.0 - smoothstep(key.w * 0.6, key.w, distance(col, key.rgb));
  }
  if (at.w > 0.0) m *= 1.0 - smoothstep(0.85, 1.0, distance(p, at.xyz) / at.w);
  return m;
}
void process() {
  vec4 h = vec4(getCenter(), 1.0);
  vec3 p = vec3(dot(uRigM0, h), dot(uRigM1, h), dot(uRigM2, h));
  vec3 col = clamp(getColor().rgb, 0.0, 1.0);
  float part = 0.0;
  float w = 0.0;
  float wOut = 0.0;
  float best = 1e9;
  for (int i = 0; i < ${MAX_REGIONS}; i++) {
    if (float(i) >= uRigN.x) break;
    float r = length((p - uRigA[i].xyz) / uRigB[i].xyz);
    float wi = 1.0 - smoothstep(1.0 - max(uRigB[i].w, 0.001), 1.0, r);
    vec4 c = uRigC[i];
    if (c.w > 0.0) wi *= 1.0 - smoothstep(c.w * 0.6, c.w, distance(col, c.rgb));
    if (c.w < 0.0) wi *= smoothstep(-c.w * 0.6, -c.w, distance(col, c.rgb));
    // An "over" region beats the others; overlapping hard regions split by
    // the nearest centre (in radii).
    float over = uRigA[i].w >= 64.0 ? 1.0 : 0.0;
    float sc = wi > 0.0 ? wi + over : 0.0;
    if (sc > 0.0 && (sc > w || (sc == w && r < best))) {
      w = sc;
      wOut = wi;
      best = r;
      part = uRigA[i].w - 64.0 * over;
    }
  }
  vec3 s = getScale();
  writeSplatPart(vec4(part / 255.0, wOut, rigKey(p, col, s, uRigK[0], uRigK[1]), rigKey(p, col, s, uRigK[2], uRigK[3])));
}
`;

const PROCESS_WGSL = /* wgsl */ `
uniform uRigM0: vec4f;
uniform uRigM1: vec4f;
uniform uRigM2: vec4f;
uniform uRigN: vec4f;
uniform uRigA: array<vec4f, ${MAX_REGIONS}>;
uniform uRigB: array<vec4f, ${MAX_REGIONS}>;
uniform uRigC: array<vec4f, ${MAX_REGIONS}>;
uniform uRigK: array<vec4f, 4>;
fn rigKey(p: vec3f, col: vec3f, s: vec3f, at: vec4f, key: vec4f) -> f32 {
  if (key.w == 0.0) { return 0.0; }
  var m: f32;
  if (key.w < 0.0) {
    let hi = max(s.x, max(s.y, s.z));
    let mid = s.x + s.y + s.z - hi - min(s.x, min(s.y, s.z));
    m = select(0.0, 1.0, mid < -key.w * hi);
  } else {
    m = 1.0 - smoothstep(key.w * 0.6, key.w, distance(col, key.rgb));
  }
  if (at.w > 0.0) { m = m * (1.0 - smoothstep(0.85, 1.0, distance(p, at.xyz) / at.w)); }
  return m;
}
fn process() {
  let h = vec4f(getCenter(), 1.0);
  let p = vec3f(dot(uniform.uRigM0, h), dot(uniform.uRigM1, h), dot(uniform.uRigM2, h));
  let col = clamp(getColor().rgb, vec3f(0.0), vec3f(1.0));
  var part = 0.0;
  var w = 0.0;
  var wOut = 0.0;
  var best = 1e9;
  for (var i = 0; i < ${MAX_REGIONS}; i++) {
    if (f32(i) >= uniform.uRigN.x) { break; }
    let a = uniform.uRigA[i];
    let b = uniform.uRigB[i];
    let c = uniform.uRigC[i];
    let r = length((p - a.xyz) / b.xyz);
    var wi = 1.0 - smoothstep(1.0 - max(b.w, 0.001), 1.0, r);
    if (c.w > 0.0) { wi = wi * (1.0 - smoothstep(c.w * 0.6, c.w, distance(col, c.rgb))); }
    if (c.w < 0.0) { wi = wi * smoothstep(-c.w * 0.6, -c.w, distance(col, c.rgb)); }
    let over = select(0.0, 1.0, a.w >= 64.0);
    var sc = 0.0;
    if (wi > 0.0) { sc = wi + over; }
    if (sc > 0.0 && (sc > w || (sc == w && r < best))) {
      w = sc;
      wOut = wi;
      best = r;
      part = a.w - 64.0 * over;
    }
  }
  let s = getScale();
  let k0 = rigKey(p, col, s, uniform.uRigK[0], uniform.uRigK[1]);
  let k1 = rigKey(p, col, s, uniform.uRigK[2], uniform.uRigK[3]);
  writeSplatPart(vec4f(part / 255.0, wOut, k0, k1));
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
      // color: only splats near this colour; notColor: any but this colour.
      const col = r.color ? hexColor(r.color) : r.notColor ? hexColor(r.notColor) : null;
      const tol = r.color ? (r.tol ?? 0.25) : r.notColor ? -(r.tol ?? 0.25) : 0;
      regions.push({ part: parts.length - 1, at: r.at, r: rad, soft: r.soft ?? 0.03, color: col, tol, over: !!r.over }); // prettier-ignore
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
    a.set([r.at[0], r.at[1], r.at[2], r.part + (r.over ? 64 : 0)], i * 4);
    b.set([r.r[0], r.r[1], r.r[2], r.soft], i * 4);
  });
  const cc = new Float32Array(MAX_REGIONS * 4);
  regions.forEach((r, i) => {
    if (r.color) cc.set([...r.color, r.tol], i * 4);
  });
  const k = new Float32Array(16);
  (rig.keys || []).slice(0, 2).forEach((key, i) => {
    k.set([...(key.at || [0, 0, 0]), key.r ?? 0], i * 8);
    // A key picks splats by colour, or long thin splats (`long`: the middle
    // size over the largest is below it), optionally only within r of at.
    if (key.long) k.set([0, 0, 0, -key.long], i * 8 + 4);
    else k.set([...hexColor(key.color), key.tol ?? 0.2], i * 8 + 4);
  });
  proc.setParameter("uRigA[0]", a);
  proc.setParameter("uRigB[0]", b);
  proc.setParameter("uRigC[0]", cc);
  proc.setParameter("uRigK[0]", k);
  proc.process();
  // WebGPU may run the pass with the frame, so it is freed with the toy.
  toy.rigProc?.destroy();
  toy.rigProc = proc;
  stage.requestRender();
  return true;
}

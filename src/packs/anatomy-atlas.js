// The anatomy atlas (lane Anatomy): a standing figure, about 1.8 m tall in
// recipe units (meters, +Y up, facing +Z), peeled layer by layer like a
// clinical atlas. Four layers, each a part of its own, and every piece in a
// layer a token (a solid piece that moves by itself):
//
//   skin      a smooth mannequin shell (13 pieces that open along seams)
//   muscles   the superficial muscles in textbook reds (19 groups)
//   skeleton  the bones in ivory (16 bones or bone groups)
//   organs    brain, lungs, heart, liver, stomach, intestines and kidneys
//             (the brain, lungs, heart and kidneys are our own organ toys'
//             recipes, placed and scaled; see `placed()`)
//
// The skin and the muscles are one smooth body: primitives (ellipsoids and
// round cones) joined with a smooth minimum, so the surface has no seams
// where a limb meets the trunk. Each primitive's own surface is sampled
// evenly, pushed onto the joined surface (at the skin, or a few millimeters
// under it for the muscles), and a splat is kept only where its primitive is
// the nearest one, so overlaps never double up (`bodyShape()`).
//
// A tap peels the outer layer: its pieces swing open on their seams or lift
// off, then fly away out of view, and the layer below shows. After the
// organs, a tap brings every layer back in order. The Layer option picks the
// layer directly, and the Labels switch lists the parts beside the toy
// (out.legend), highlighting the part you tapped.

import { mix, shade, rgb, quatAxisAngle, quatEuler, quatMul, quatRotate, spline } from "../kit.js";
import { RECIPES as ORGANS } from "./anatomy.js";

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => mul(a, 1 / (len(a) || 1));
const lerp = (a, b, t) => add(a, mul(sub(b, a), t));
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => x * x * (3 - 2 * x);
const sstep = (a, b, x) => ease(clamp01((x - a) / (b - a)));
const qinv = (q) => [-q[0], -q[1], -q[2], q[3]];
const TAU = Math.PI * 2;

// ---- Layers, pieces and labels ----------------------------------------------------------

const LAYERS = ["skin", "muscles", "skeleton", "organs"];
const LAYER_NAMES = ["Skin", "Muscles", "Skeleton", "Organs"];

// Every label, by layer. A piece names its label; a pair of pieces (left
// and right) shares one.
const LABELS = [
  ["Head and face", "Torso", "Arms", "Legs"],
  [
    "Head and neck muscles",
    "Trapezius and back muscles",
    "Deltoids",
    "Pectoralis major",
    "Biceps and triceps",
    "Forearm muscles",
    "Rectus abdominis",
    "Obliques",
    "Gluteal muscles",
    "Quadriceps",
    "Hamstrings",
    "Calf and shin muscles",
  ],
  [
    "Skull",
    "Spine",
    "Rib cage and sternum",
    "Pelvis",
    "Clavicles and scapulae",
    "Humerus",
    "Radius and ulna",
    "Hand bones",
    "Femur",
    "Tibia, fibula and foot",
  ],
  ["Brain", "Lungs", "Heart", "Liver", "Stomach", "Intestines", "Kidneys"],
];
const LABEL_LIST = LABELS.flatMap((names, layer) => names.map((name) => ({ name, layer })));
const labelIndex = (name) => LABEL_LIST.findIndex((l) => l.name === name);

// The pieces (tokens), in order: [id, layer, label]. Sides: R is the
// figure's right (-X), L its left (+X).
const PIECES = [
  ["face", 0, "Head and face"],
  ["headBack", 0, "Head and face"],
  ["torsoR", 0, "Torso"],
  ["torsoL", 0, "Torso"],
  ["torsoBack", 0, "Torso"],
  ["armFrontR", 0, "Arms"],
  ["armBackR", 0, "Arms"],
  ["armFrontL", 0, "Arms"],
  ["armBackL", 0, "Arms"],
  ["legFrontR", 0, "Legs"],
  ["legBackR", 0, "Legs"],
  ["legFrontL", 0, "Legs"],
  ["legBackL", 0, "Legs"],
  ["headNeck", 1, "Head and neck muscles"],
  ["back", 1, "Trapezius and back muscles"],
  ["deltR", 1, "Deltoids"],
  ["deltL", 1, "Deltoids"],
  ["pecR", 1, "Pectoralis major"],
  ["pecL", 1, "Pectoralis major"],
  ["upperArmR", 1, "Biceps and triceps"],
  ["upperArmL", 1, "Biceps and triceps"],
  ["forearmR", 1, "Forearm muscles"],
  ["forearmL", 1, "Forearm muscles"],
  ["abs", 1, "Rectus abdominis"],
  ["obliques", 1, "Obliques"],
  ["glutes", 1, "Gluteal muscles"],
  ["quadR", 1, "Quadriceps"],
  ["quadL", 1, "Quadriceps"],
  ["hamR", 1, "Hamstrings"],
  ["hamL", 1, "Hamstrings"],
  ["lowerLegR", 1, "Calf and shin muscles"],
  ["lowerLegL", 1, "Calf and shin muscles"],
  ["skull", 2, "Skull"],
  ["spine", 2, "Spine"],
  ["ribs", 2, "Rib cage and sternum"],
  ["pelvis", 2, "Pelvis"],
  ["girdleR", 2, "Clavicles and scapulae"],
  ["girdleL", 2, "Clavicles and scapulae"],
  ["humerusR", 2, "Humerus"],
  ["humerusL", 2, "Humerus"],
  ["forearmBonesR", 2, "Radius and ulna"],
  ["forearmBonesL", 2, "Radius and ulna"],
  ["handR", 2, "Hand bones"],
  ["handL", 2, "Hand bones"],
  ["femurR", 2, "Femur"],
  ["femurL", 2, "Femur"],
  ["shinR", 2, "Tibia, fibula and foot"],
  ["shinL", 2, "Tibia, fibula and foot"],
];
const TOK = Object.fromEntries(PIECES.map(([id], i) => [id, i]));
const SIDES = {};
for (const [id] of PIECES)
  if (/[RL]$/.test(id)) (SIDES[id.slice(0, -1)] ||= {})[id.endsWith("R") ? -1 : 1] = TOK[id];
const side = (id, s) => SIDES[id][s < 0 ? -1 : 1];

// ---- The figure's frame (meters) ----------------------------------------------------------

const ABDUCT = (14 * Math.PI) / 180; // the arms hang a little away from the body
function armFrame(s) {
  const dA = [s * Math.sin(ABDUCT), -Math.cos(ABDUCT), 0];
  const lat = [s * Math.cos(ABDUCT), Math.sin(ABDUCT), 0]; // outward, across the arm
  const S = [s * 0.18, 1.45, -0.005]; // the shoulder joint
  const E = add(S, mul(dA, 0.33)); // the elbow
  const W = add(E, mul(dA, 0.27)); // the wrist
  return { s, dA, lat, S, E, W, fwd: [0, 0, 1] };
}
function legFrame(s) {
  const H = [s * 0.09, 0.925, 0.005]; // the hip joint
  const K = [s * 0.095, 0.5, 0.01]; // the knee
  const A = [s * 0.1, 0.085, -0.015]; // the ankle
  const dL = unit(sub(A, H));
  const lat = unit(cross([0, 0, s], dL)); // outward
  return { s, H, K, A, dL, lat };
}
const ARM = { [-1]: armFrame(-1), 1: armFrame(1) };
const LEG = { [-1]: legFrame(-1), 1: legFrame(1) };

// ---- The body's primitives and its smooth union ------------------------------------------

// An ellipsoid (axes: its local x, y, z directions) or a round cone from a
// (radius ra) to b (radius rb). `grp` sets how softly it joins its
// neighbors; `kind` and `side` say which body part it is.
function ell(c, r, o = {}) {
  const ax = o.ax || [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  return { type: "e", c, r, ax, grp: o.grp, kind: o.kind, side: o.side ?? 0 };
}
function cone(a, b, ra, rb, o = {}) {
  return { type: "c", a, b, ra, rb, grp: o.grp, kind: o.kind, side: o.side ?? 0 };
}

function bodyPrims() {
  const P = [];
  const head = { grp: "head", kind: "head" };
  P.push(ell([0, 1.7, -0.01], [0.074, 0.096, 0.098], head));
  P.push(ell([0, 1.622, 0.026], [0.057, 0.066, 0.07], head));
  P.push(ell([0, 1.588, 0.052], [0.03, 0.024, 0.03], head));
  const noseAx = [[1, 0, 0], unit([0, 1, -0.35]), unit([0, 0.35, 1])];
  P.push(ell([0, 1.652, 0.09], [0.011, 0.021, 0.014], { grp: "face", kind: "head", ax: noseAx }));
  for (const s of [-1, 1])
    P.push(ell([s * 0.074, 1.665, -0.012], [0.011, 0.029, 0.019], { grp: "face", kind: "head" }));
  // Neck and trunk.
  const trunk = (kind, extra = {}) => ({ grp: "torso", kind, ...extra });
  P.push(cone([0, 1.46, -0.012], [0, 1.62, -0.006], 0.056, 0.05, trunk("neck")));
  P.push(ell([0, 1.3, 0], [0.16, 0.2, 0.105], trunk("chest")));
  P.push(ell([0, 1.32, -0.03], [0.15, 0.17, 0.09], trunk("chest")));
  P.push(ell([0, 1.42, 0.005], [0.15, 0.075, 0.09], trunk("chest")));
  for (const s of [-1, 1]) {
    P.push(cone([0, 1.5, -0.01], [s * 0.175, 1.455, -0.005], 0.05, 0.048, trunk("slope", { side: s }))); // prettier-ignore
    P.push(ell([s * 0.068, 1.31, 0.045], [0.075, 0.062, 0.06], trunk("pecs", { side: s })));
    P.push(ell([s * 0.19, 1.425, 0], [0.055, 0.075, 0.06], trunk("deltoid", { side: s })));
  }
  P.push(ell([0, 1.17, 0.002], [0.148, 0.12, 0.1], trunk("chest")));
  P.push(ell([0, 1.08, 0], [0.135, 0.16, 0.095], trunk("waist")));
  P.push(ell([0, 0.955, -0.005], [0.16, 0.1, 0.1], trunk("pelvis")));
  P.push(ell([0, 0.92, 0.02], [0.12, 0.08, 0.075], trunk("pelvis")));
  for (const s of [-1, 1])
    P.push(ell([s * 0.07, 0.89, -0.045], [0.085, 0.09, 0.07], trunk("buttock", { side: s })));
  // Arms and hands (palms forward).
  for (const s of [-1, 1]) {
    const f = ARM[s];
    const ax = [f.lat, f.dA, [0, 0, 1]];
    const arm = (kind) => ({ grp: "arm" + s, kind, side: s });
    P.push(cone(add(f.S, mul(f.dA, 0.03)), f.E, 0.046, 0.036, arm("upperArm")));
    P.push(ell(add(add(f.S, mul(f.dA, 0.18)), [0, 0, 0.01]), [0.04, 0.1, 0.042], { ...arm("upperArm"), ax })); // prettier-ignore
    P.push(cone(f.E, f.W, 0.037, 0.025, arm("forearm")));
    P.push(ell(add(f.E, mul(f.dA, 0.075)), [0.042, 0.09, 0.036], { ...arm("forearm"), ax }));
    const hand = { grp: "hand" + s, kind: "hand", side: s };
    P.push(ell(add(f.W, mul(f.dA, 0.05)), [0.041, 0.052, 0.015], { ...hand, ax }));
    const fingers = [
      [-0.028, 0.07],
      [-0.0095, 0.085],
      [0.0095, 0.092],
      [0.028, 0.085],
    ];
    for (const [o, L] of fingers) {
      const base = add(add(f.W, mul(f.dA, 0.093)), mul(f.lat, o));
      const dir = unit(add(add(f.dA, mul(f.lat, o * 1.4)), [0, 0, 0.08]));
      P.push(cone(base, add(base, mul(dir, L)), 0.0086, 0.0068, hand));
    }
    const tb = add(add(add(f.W, mul(f.dA, 0.02)), mul(f.lat, 0.034)), [0, 0, 0.012]);
    const td = unit(add(add(mul(f.lat, 0.55), mul(f.dA, 0.7)), [0, 0, 0.45]));
    P.push(cone(tb, add(tb, mul(td, 0.065)), 0.0115, 0.0082, hand));
  }
  // Legs and feet.
  for (const s of [-1, 1]) {
    const f = LEG[s];
    const leg = (kind) => ({ grp: "leg" + s, kind, side: s });
    P.push(cone(add(f.H, [0, 0.02, 0]), f.K, 0.086, 0.05, leg("thigh")));
    P.push(ell([s * 0.098, 0.7, 0.022], [0.068, 0.16, 0.066], leg("thigh")));
    P.push(ell(f.K, [0.048, 0.055, 0.05], leg("knee")));
    P.push(cone(f.K, f.A, 0.049, 0.03, leg("calf")));
    P.push(ell([s * 0.1, 0.36, -0.022], [0.05, 0.11, 0.048], leg("calf")));
    const foot = { grp: "foot" + s, kind: "foot", side: s };
    P.push(ell([s * 0.105, 0.035, 0.055], [0.043, 0.032, 0.115], foot));
    P.push(ell([s * 0.1, 0.045, -0.03], [0.033, 0.042, 0.04], foot));
    P.push(ell([s * 0.106, 0.028, 0.11], [0.046, 0.024, 0.06], foot));
  }
  // Bounds and neighbors (primitives close enough to join).
  for (const p of P) {
    if (p.type === "e") {
      p.bc = p.c;
      p.br = Math.max(...p.r);
      p.e = true;
      const f = [...p.c];
      for (const k of [0, 1, 2]) f.push(...mul(p.ax[k], 1 / p.r[k]));
      for (const k of [0, 1, 2]) f.push(...mul(p.ax[k], 1 / (p.r[k] * p.r[k])));
      f.push(Math.min(...p.r));
      p.f = new Float64Array(f);
    } else {
      p.bc = lerp(p.a, p.b, 0.5);
      p.br = len(sub(p.b, p.a)) / 2 + Math.max(p.ra, p.rb);
      p.ba = sub(p.b, p.a);
      p.bb = dot(p.ba, p.ba);
      p.e = false;
      p.f = new Float64Array([...p.a, ...p.ba, 1 / p.bb, p.ra, p.rb - p.ra]);
    }
  }
  const groups = [...new Set(P.map((p) => p.grp))];
  for (const p of P) {
    p.gi = groups.indexOf(p.grp);
    p.join = groups.map((g) => joinK(p.grp, g));
  }
  P.forEach((p, i) => {
    p.i = i;
    p.near = [];
    P.forEach((q, j) => {
      if (len(sub(p.bc, q.bc)) < p.br + q.br + 0.06) p.near.push(j);
    });
  });
  return P;
}

function sdPrim(p, P) {
  return sdAt(P, p[0], p[1], p[2]);
}
// Allocation-free and on flat numbers (P.f, set in bodyPrims): the build
// calls this millions of times.
function sdAt(P, x, y, z) {
  const f = P.f;
  if (P.e) {
    const dx = x - f[0];
    const dy = y - f[1];
    const dz = z - f[2];
    // f[3..11]: the axes divided by the radii; f[12..20]: by the radii squared.
    const l0 = dx * f[3] + dy * f[4] + dz * f[5];
    const l1 = dx * f[6] + dy * f[7] + dz * f[8];
    const l2 = dx * f[9] + dy * f[10] + dz * f[11];
    const m0 = dx * f[12] + dy * f[13] + dz * f[14];
    const m1 = dx * f[15] + dy * f[16] + dz * f[17];
    const m2 = dx * f[18] + dy * f[19] + dz * f[20];
    const k0 = Math.sqrt(l0 * l0 + l1 * l1 + l2 * l2);
    const k1 = Math.sqrt(m0 * m0 + m1 * m1 + m2 * m2);
    return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -f[21];
  }
  // f: a, b - a, 1 / |b - a|^2, ra, rb - ra.
  const px = x - f[0];
  const py = y - f[1];
  const pz = z - f[2];
  let t = (px * f[3] + py * f[4] + pz * f[5]) * f[6];
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = px - f[3] * t;
  const qy = py - f[4] * t;
  const qz = pz - f[5] * t;
  return Math.sqrt(qx * qx + qy * qy + qz * qz) - (f[7] + f[8] * t);
}

// How softly primitives join: within a group, and between groups.
const GROUP_K = { head: 0.025, face: 0.012, torso: 0.045, arm: 0.03, hand: 0.009, leg: 0.045, foot: 0.025 }; // prettier-ignore
const baseGrp = (g) => g.replace(/-?1$/, "");
function joinK(g1, g2) {
  if (g1 === g2) return GROUP_K[baseGrp(g1)];
  const pair = [baseGrp(g1), baseGrp(g2)].sort().join("+");
  return (
    {
      "face+head": 0.012,
      "head+torso": 0.035,
      "arm+torso": 0.02,
      "arm+hand": 0.02,
      "leg+torso": 0.035,
      "leg+leg": 0.02,
      "foot+leg": 0.025,
    }[pair] ?? 0.01
  );
}

// The joined body's field at (x, y, z) over a list of primitives (a
// primitive's neighbors); FIELD_OWN is left holding the nearest one. Far
// primitives change nothing (smin with a distance beyond k is exact), so
// neighbor lists agree where they overlap.
let FIELD_OWN = -1;
let FIELD_BLEND = false; // whether two primitives were joining there
const FD = new Float64Array(64);
const FJ = new Int32Array(64);
function fieldAt(prims, list, x, y, z) {
  // The nearest primitive, and every one close enough to join it.
  let best = Infinity;
  let own = -1;
  let n = 0;
  for (let i = 0; i < list.length; i++) {
    const j = list[i];
    const P = prims[j];
    // A primitive whose bounding sphere is beyond reach changes nothing.
    const bc = P.bc;
    const cx = x - bc[0];
    const cy = y - bc[1];
    const cz = z - bc[2];
    if (Math.sqrt(cx * cx + cy * cy + cz * cz) - P.br > best + 0.05) continue;
    const dj = sdAt(P, x, y, z);
    FD[n] = dj;
    FJ[n++] = j;
    if (dj < best) {
      best = dj;
      own = j;
    }
  }
  // The join: the nearest distance, less the largest fillet any neighbor
  // makes with it (its pair's k). Order doesn't matter, so the surface is
  // smooth wherever the nearest primitive changes.
  const gOwn = prims[own].gi;
  let bump = 0;
  for (let i = 0; i < n; i++) {
    if (FJ[i] === own) continue;
    const k = prims[FJ[i]].join[gOwn];
    const h = k - (FD[i] - best);
    if (h > 0) {
      const b = (h * h) / (4 * k);
      if (b > bump) bump = b;
    }
  }
  FIELD_OWN = own;
  FIELD_BLEND = bump > 0;
  return best - bump;
}

// Pushes p onto the joined surface at `level` (0 the skin, negative inside).
function project(prims, list, p0, level) {
  let [x, y, z] = p0;
  const e = 4e-4;
  let gx = 0;
  let gy = 1;
  let gz = 0;
  for (let it = 0; it < 1; it++) {
    const f0 = fieldAt(prims, list, x, y, z);
    if (FIELD_BLEND) {
      gx = (fieldAt(prims, list, x + e, y, z) - f0) / e;
      gy = (fieldAt(prims, list, x, y + e, z) - f0) / e;
      gz = (fieldAt(prims, list, x, y, z + e) - f0) / e;
    } else {
      // Away from any join the field is the nearest primitive's own.
      const P = prims[FIELD_OWN];
      gx = (sdAt(P, x + e, y, z) - f0) / e;
      gy = (sdAt(P, x, y + e, z) - f0) / e;
      gz = (sdAt(P, x, y, z + e) - f0) / e;
    }
    const g2 = gx * gx + gy * gy + gz * gz;
    if (g2 < 1e-6) return null;
    // Already on the surface, away from any join: done.
    if (!FIELD_BLEND && Math.abs(f0 - level) < 2e-5) return { p: [x, y, z], n: unit([gx, gy, gz]), own: FIELD_OWN }; // prettier-ignore
    const f = (f0 - level) / g2;
    x -= gx * f;
    y -= gy * f;
    z -= gz * f;
  }
  const d = fieldAt(prims, list, x, y, z);
  if (Math.abs(d - level) > 0.0015) return null;
  return { p: [x, y, z], n: unit([gx, gy, gz]), own: FIELD_OWN };
}

// A primitive's own surface, (u, v) in 0..1.
function primSurface(P) {
  if (P.type === "e")
    return (u, v) => {
      const th = v * Math.PI;
      const ph = u * TAU;
      const l = [
        P.r[0] * Math.sin(th) * Math.cos(ph),
        P.r[1] * Math.cos(th),
        P.r[2] * Math.sin(th) * Math.sin(ph),
      ];
      return add(P.c, add(add(mul(P.ax[0], l[0]), mul(P.ax[1], l[1])), mul(P.ax[2], l[2])));
    };
  const w = unit(P.ba);
  const e1 = unit(cross(w, Math.abs(w[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  const e2 = cross(w, e1);
  const L = Math.sqrt(P.bb);
  const c0 = (Math.PI / 2) * P.ra;
  const c1 = (Math.PI / 2) * P.rb;
  const T = c0 + L + c1;
  return (u, v) => {
    const ph = u * TAU;
    const rad = add(mul(e1, Math.cos(ph)), mul(e2, Math.sin(ph)));
    const x = v * T;
    if (x < c0) {
      const a = (x / c0) * (Math.PI / 2);
      return add(P.a, add(mul(w, -P.ra * Math.cos(a)), mul(rad, P.ra * Math.sin(a))));
    }
    if (x > c0 + L) {
      const a = ((T - x) / c1) * (Math.PI / 2);
      return add(P.b, add(mul(w, P.rb * Math.cos(a)), mul(rad, P.rb * Math.sin(a))));
    }
    const t = (x - c0) / L;
    return add(add(P.a, mul(P.ba, t)), mul(rad, P.ra + (P.rb - P.ra) * t));
  };
}

// A kit shape: primitive i's surface pushed onto the joined body at `level`.
// Its points are made all at once, the first time the kit asks for one (the
// kit's item says how many): an even sequence over the primitive's surface,
// skipping points another primitive owns, so each stretch of the body is
// covered once. Each point then gets a size from the spacing of its nearest
// neighbors, so a primitive whose visible part is stretched or squeezed by
// the join still closes with no gaps (`mult`). The muscles reuse the skin's
// points, moved in along the normal (`under`).
function bodyShape(k, prims, i, level, under = null) {
  const P = prims[i];
  const inner = under ? under.inner : k.param(primSurface(P), { grid: 32, normal: () => [0, 1, 0] }); // prettier-ignore
  // A point well inside another primitive can't be this one's: skip it
  // before the (costly) push onto the surface.
  const buried = (p) => {
    for (const j of P.near) if (j !== i && sdAt(prims[j], p[0], p[1], p[2]) < -0.012) return true;
    return false;
  };
  // The R2 sequence (Roberts): an even spread over the unit square.
  const g = 1.32471795724474602596;
  const ev = (m) => [(0.5 + m / g) % 1, (0.5 + m / (g * g)) % 1];
  // The share of this primitive's surface it owns.
  let kept = 0;
  const TRY = under ? 0 : 100;
  for (let m = 0; m < TRY; m++) {
    const q = inner.sampleEven(...ev(m * 7 + 3)).p;
    if (buried(q)) continue;
    const r = project(prims, P.near, q, 0);
    if (r && r.own === i) kept++;
  }
  const shape = {
    area: under ? under.area : (inner.area * Math.max(kept, 1)) / Math.max(TRY, 1),
    thick: 0.02,
    inner,
    points: null,
    none: under ? under.none : kept === 0,
    item: null,
  };
  const make = () => {
    const n = shape.item?.n ?? 0;
    if (under) {
      if (!under.points) under.make();
      shape.points = under.points.map((q) => ({ ...q, p: sub(q.p, mul(q.n, -level)), prim: P }));
      return;
    }
    const pts = [];
    for (let m = 0; pts.length < n && m < n * 30 + 100; m++) {
      const s = inner.sampleEven(...ev(m));
      if (buried(s.p)) continue;
      const r = project(prims, P.near, s.p, level);
      if (r && r.own === i) pts.push({ p: r.p, n: r.n, u: s.u, v: s.v, prim: P, mult: 1 });
    }
    // Sizes from the spacing: the mean distance to the four nearest points,
    // against the spacing the kit expects for this shape's area and count.
    const want = 1.07 * Math.sqrt(shape.area / Math.max(1, n));
    const cell = want * 1.6;
    const grid = new Map();
    const key = (a, b, c) => (a + 1024) * 4194304 + (b + 1024) * 2048 + (c + 1024);
    const cellOf = (v) => Math.floor(v / cell);
    for (const q of pts) {
      const kk = key(cellOf(q.p[0]), cellOf(q.p[1]), cellOf(q.p[2]));
      const list = grid.get(kk);
      if (list) list.push(q);
      else grid.set(kk, [q]);
    }
    const best = new Float64Array(4);
    for (const q of pts) {
      const [x, y, z] = q.p;
      const cx = cellOf(x);
      const cy = cellOf(y);
      const cz = cellOf(z);
      best.fill(Infinity);
      for (let a = -1; a <= 1; a++)
        for (let b = -1; b <= 1; b++)
          for (let c = -1; c <= 1; c++) {
            const list = grid.get(key(cx + a, cy + b, cz + c));
            if (!list) continue;
            for (const o of list) {
              if (o === q) continue;
              const dx = o.p[0] - x;
              const dy = o.p[1] - y;
              const dz = o.p[2] - z;
              let d = dx * dx + dy * dy + dz * dz;
              if (d >= best[3]) continue;
              // Keep the four smallest, in order.
              for (let m = 0; m < 4; m++)
                if (d < best[m]) {
                  const t = best[m];
                  best[m] = d;
                  d = t;
                }
            }
          }
      let sum = 0;
      let cnt = 0;
      for (let m = 0; m < 4; m++)
        if (best[m] < Infinity) {
          sum += Math.sqrt(best[m]);
          cnt++;
        }
      const d = cnt ? sum / cnt : want * 1.3;
      q.mult = Math.min(1.9, Math.max(0.9, (1.15 * d) / want));
    }
    shape.points = pts;
  };
  shape.make = make;
  let used = 0;
  const next = () => {
    if (!shape.points) make();
    return shape.points[used++] || { p: P.bc, n: [0, 1, 0], u: 0, v: 0, prim: P, drop: true };
  };
  shape.sample = next;
  shape.sampleEven = next;
  return shape;
}

// ---- Light and colour ---------------------------------------------------------------------

const LIGHT = unit([-0.45, 0.8, 0.45]);
const VIEW = unit([0.35, 0.25, 0.9]);
const HALF = unit(add(LIGHT, VIEW));
const HEX = new Map();
const hex = (c) => (typeof c === "string" ? HEX.get(c) || (HEX.set(c, rgb(c)), HEX.get(c)) : c);
const lit = (col, n, amb = 0.64, k = 0.42) => shade(hex(col), amb + k * Math.max(0, dot(n, LIGHT)));
const sheen = (col, n, amt, pow = 14) =>
  mix(col, WHITE, amt * Math.pow(Math.max(0, dot(n, HALF)), pow));

const SKIN = rgb("#d9ccbd");
const MUSCLE = rgb("#b3322c");
const MUSCLE_DARK = rgb("#7e1d1a");
const TENDON = rgb("#e9e2d2");
const GROOVE = rgb("#4d1210");
const BONE = rgb("#e6dac0");
const BONE_DARK = rgb("#b8a888");
const CARTILAGE = rgb("#c9d6d2");
const EYE = rgb("#3a2c24");
const WHITE = rgb("#ffffff");

// ---- Skin pieces and muscle groups ------------------------------------------------------------

// Which skin piece a point of the body belongs to (the seams).
function skinPiece(p, P) {
  const k = P.kind;
  if (k === "head" || (k === "neck" && p[1] > 1.5)) return p[2] > -0.008 ? TOK.face : TOK.headBack;
  if (k === "upperArm" || k === "forearm" || k === "hand" || k === "deltoid") {
    const f = ARM[P.side];
    const r = sub(p, f.S);
    return r[2] > 0 ? side("armFront", P.side) : side("armBack", P.side);
  }
  if (k === "thigh" || k === "knee" || k === "calf" || k === "foot") {
    const f = LEG[P.side];
    const t = dot(sub(p, f.H), f.dL);
    const axis = add(f.H, mul(f.dL, t));
    const front = k === "foot" ? p[1] > 0.035 : p[2] - axis[2] > 0;
    return front ? side("legFront", P.side) : side("legBack", P.side);
  }
  if (k === "buttock") return TOK.torsoBack;
  if (p[2] < -0.005) return TOK.torsoBack;
  return p[0] < 0 ? TOK.torsoR : TOK.torsoL;
}

// Which muscle group a point belongs to: { tok, fib (fiber direction),
// tendon (0..1) }.
function muscleAt(p, P) {
  const k = P.kind;
  const [x, y, z] = p;
  const ax = Math.abs(x);
  const s = x < 0 ? -1 : 1;
  if (k === "head") {
    const galea = sstep(1.735, 1.77, y) * (z > -0.06 ? 1 : 0.6);
    return { tok: TOK.headNeck, fib: [0, 1, 0], tendon: 0.75 * galea };
  }
  if (k === "neck") {
    if (z < -0.02 && y < 1.6) return { tok: TOK.back, fib: [s, -0.4, 0], tendon: 0 };
    // The sternocleidomastoid runs from behind the ear to the breastbone.
    return { tok: TOK.headNeck, fib: unit([-s * 0.25, -1, 0.5]), tendon: sstep(1.49, 1.465, y) * 0.8 }; // prettier-ignore
  }
  if (k === "deltoid") return { tok: side("delt", P.side), fib: ARM[P.side].dA, tendon: 0 };
  if (k === "upperArm" || k === "forearm" || k === "hand") {
    const f = ARM[P.side];
    const t = dot(sub(p, f.S), f.dA);
    if (k === "upperArm" && t < 0.075) return { tok: side("delt", P.side), fib: f.dA, tendon: 0 };
    if (k === "upperArm") {
      return { tok: side("upperArm", P.side), fib: f.dA, tendon: 0 };
    }
    if (k === "forearm")
      return { tok: side("forearm", P.side), fib: f.dA, tendon: sstep(0.47, 0.54, t) * 0.9 };
    return { tok: side("forearm", P.side), fib: f.dA, tendon: 0.85 };
  }
  if (k === "thigh" || k === "knee" || k === "calf" || k === "foot") {
    const f = LEG[P.side];
    const t = dot(sub(p, f.H), f.dL);
    const axis = add(f.H, mul(f.dL, t));
    const r = sub(p, axis);
    const inner = -r[0] * P.side > 0.02;
    const front = r[2] > -0.012 || (inner && r[2] > -0.03);
    if (k === "thigh") {
      const tendon =
        front && Math.abs(r[0]) < 0.026 && r[2] > 0.02 ? sstep(0.37, 0.41, t) * 0.9 : 0;
      return { tok: side(front ? "quad" : "ham", P.side), fib: f.dL, tendon };
    }
    if (k === "knee") {
      // The knee cap's pale tendon, in front only.
      const cap = Math.abs(r[0]) < 0.026 && r[2] > 0.025 ? 0.95 : 0;
      if (front) return { tok: side("quad", P.side), fib: f.dL, tendon: cap };
      return { tok: side("ham", P.side), fib: f.dL, tendon: 0 };
    }
    // The shin bone shows through at the front and inside; the Achilles
    // tendon at the back of the ankle; tendons over the foot.
    const shin = r[2] > 0.02 && inner ? 0.6 : 0;
    const achilles = r[2] < -0.01 ? sstep(0.24, 0.16, y) : 0;
    const tendon = k === "foot" ? 0.8 : Math.max(shin, achilles, sstep(0.14, 0.1, y) * 0.8);
    return { tok: side("lowerLeg", P.side), fib: f.dL, tendon };
  }
  // The trunk.
  const back = z < -0.012 || k === "buttock";
  if (back) {
    if (y < 0.975) return { tok: TOK.glutes, fib: unit([s, -0.6, 0]), tendon: 0 };
    const trapLow = 1.13 + ax * 1.55;
    if (y > trapLow || k === "slope")
      return { tok: TOK.back, fib: unit([s, y > 1.4 ? -0.3 : 0.5, 0]), tendon: ax < 0.012 && y < 1.5 ? 0.6 : 0 }; // prettier-ignore
    // The latissimus, with the pale lumbar fascia low in the middle.
    const fascia = ax < 0.07 - (y - 0.98) * 0.35 ? 0.8 : 0;
    return { tok: TOK.back, fib: unit([s, 0.7, 0]), tendon: fascia };
  }
  if (k === "slope") return { tok: TOK.back, fib: [s, -0.3, 0], tendon: 0 };
  const pecLow = 1.235 + 0.35 * ax;
  if ((k === "pecs" || k === "chest") && y > pecLow && ax < 0.175) {
    const toward = unit(sub([s * 0.18, 1.39, 0], p));
    return { tok: side("pec", s), fib: toward, tendon: ax < 0.012 ? 0.7 : 0 };
  }
  if (y > 1.44) return { tok: TOK.back, fib: [s, -0.3, 0], tendon: 0 };
  if (y < 0.875) return { tok: side("quad", s), fib: [0, -1, 0], tendon: 0 };
  if (ax < 0.058 && y < pecLow) {
    // Rectus abdominis: the linea alba down the middle and three bands across.
    let tendon = ax < 0.006 ? 0.9 : 0;
    for (const b of [1.17, 1.1, 1.03]) if (Math.abs(y - b) < 0.0045) tendon = 0.85;
    return { tok: TOK.abs, fib: [0, 1, 0], tendon };
  }
  const apo = ax < 0.072 ? 0.7 : 0; // the obliques' pale sheath beside the rectus
  return { tok: TOK.obliques, fib: unit([s * 0.6, 1, 0.3]), tendon: apo };
}

// A bone: a tube along `curve` with rounded ends (so it closes without
// flat caps and keeps even placement), on a light grid.
function boneTube(k, curve, radius, grid = 16) {
  const rf = typeof radius === "function" ? radius : () => radius;
  const R = (u) => rf(u) * Math.sqrt(clamp01(Math.min(u, 1 - u) / 0.07)) + 1e-5;
  const shape = k.tube(curve, R, { grid, samples: 32 });
  shape.thin = true;
  return shape;
}

// ---- Bones --------------------------------------------------------------------------------

function boneColor(c) {
  const tone = mix(BONE, BONE_DARK, 0.12 * (0.5 + 0.5 * c.noise(c.p[0] * 60, c.p[1] * 60, c.p[2] * 60))); // prettier-ignore
  return sheen(lit(tone, c.n), c.n, 0.12);
}

// The spine's centerline: its depth (z) at a height.
function spineZ(y) {
  if (y > 1.46) return -0.018 + (y - 1.46) * 0.05;
  if (y > 1.13) return -0.018 - 0.034 * Math.sin((Math.PI * (1.46 - y)) / 0.33);
  return -0.018 - 0.022 * Math.sin((Math.PI * (1.13 - y)) / 0.3);
}

function buildSkeleton(k, part, note) {
  // Thin bones get more, smaller splats, so a rib reads as a smooth rod.
  const addBone = (shape, o) => k.add(shape, { weight: shape.thin ? 2.2 : 1.3, ...o });
  const opt = (tok, extra = {}) => ({
    part,
    kind: "token",
    params: [tok, 0],
    even: true,
    opacity: 1,
    jitter: 0.012,
    flat: 0.25,
    ...extra,
    color: note(tok, extra.color || boneColor),
  });
  // Skull: the cranium, the face with its eye sockets and nose, the jaw and teeth.
  {
    const t = TOK.skull;
    const sockets = [-1, 1].map((s) => [s * 0.031, 1.664, 0.078]);
    const skullColor = (c) => {
      let col = boneColor(c);
      for (const e of sockets) {
        const d = len(sub(c.p, e));
        if (d < 0.02 && c.n[2] > 0.2) col = mix(col, EYE, sstep(0.02, 0.011, d));
      }
      const nd = len(sub(c.p, [0, 1.632, 0.086]));
      if (nd < 0.013 && c.n[2] > 0.3) col = mix(col, EYE, sstep(0.013, 0.007, nd));
      return col;
    };
    addBone(k.ellipsoid(0.067, 0.088, 0.091), opt(t, { pos: [0, 1.703, -0.012], color: skullColor })); // prettier-ignore
    addBone(k.ellipsoid(0.05, 0.05, 0.058), opt(t, { pos: [0, 1.638, 0.02], color: skullColor }));
    // Cheekbones.
    for (const s of [-1, 1])
      addBone(k.ellipsoid(0.012, 0.009, 0.02), opt(t, { pos: [s * 0.043, 1.645, 0.04] }));
    // The jaw: a U of bone from under each ear round the chin.
    const jaw = spline([
      [-0.05, 1.655, -0.01],
      [-0.049, 1.605, 0.005],
      [-0.033, 1.588, 0.043],
      [0, 1.584, 0.06],
      [0.033, 1.588, 0.043],
      [0.049, 1.605, 0.005],
      [0.05, 1.655, -0.01],
    ]);
    addBone(boneTube(k, jaw, 0.009), opt(t));
    // Teeth: two rows of small pale blocks.
    for (const [yy, zz] of [
      [1.607, 0.066],
      [1.595, 0.064],
    ])
      for (let i = -5; i <= 5; i++) {
        const a = (i / 5) * 1.1;
        addBone(k.ellipsoid(0.0034, 0.0055, 0.0035), opt(t, { pos: [Math.sin(a) * 0.029, yy, zz - (1 - Math.cos(a)) * 0.03], color: "#f4eee0", weight: 2 })); // prettier-ignore
      }
  }
  // Spine: 24 vertebrae with their discs, then the sacrum (with the pelvis).
  {
    const t = TOK.spine;
    const levels = [];
    for (let i = 0; i < 7; i++) levels.push({ y: 1.6 - i * 0.02, r: 0.0105, h: 0.013, sp: 0.018 });
    for (let i = 0; i < 12; i++) levels.push({ y: 1.455 - i * 0.0265, r: 0.012 + i * 0.0005, h: 0.018, sp: 0.03 }); // prettier-ignore
    for (let i = 0; i < 5; i++) levels.push({ y: 1.13 - i * 0.031, r: 0.019, h: 0.022, sp: 0.024 });
    for (const [i, L] of levels.entries()) {
      const z = spineZ(L.y);
      addBone(k.cylinder(L.r, L.h), opt(t, { pos: [0, L.y, z] }));
      if (i < levels.length - 1) {
        const gap = L.y - levels[i + 1].y - L.h / 2 - levels[i + 1].h / 2;
        if (gap > 0.002)
          addBone(k.cylinder(L.r * 0.95, gap), opt(t, { pos: [0, L.y - L.h / 2 - gap / 2, z], color: CARTILAGE })); // prettier-ignore
      }
      // The arch behind the body, the spinous process (slanting down in the
      // chest) and the two transverse processes.
      const thoracic = i >= 7 && i < 19;
      const slant = thoracic ? 35 : 10;
      addBone(k.ellipsoid(0.005, 0.006, L.sp / 2), opt(t, { pos: [0, L.y - (thoracic ? 0.008 : 0.002), z - L.r - L.sp / 2], rot: [slant, 0, 0] })); // prettier-ignore
      addBone(k.ellipsoid(i < 7 ? 0.022 : 0.03, 0.0045, 0.006), opt(t, { pos: [0, L.y, z - L.r - 0.004] })); // prettier-ignore
    }
  }
  // Rib cage: twelve pairs, the costal cartilages and the sternum.
  {
    const t = TOK.ribs;
    const A = [0.062, 0.083, 0.098, 0.108, 0.115, 0.12, 0.122, 0.122, 0.12, 0.114, 0.105, 0.095];
    const B = [0.045, 0.058, 0.066, 0.071, 0.075, 0.077, 0.078, 0.078, 0.076, 0.073, 0.068, 0.062];
    for (let i = 0; i < 12; i++) {
      const y0 = 1.445 - i * 0.0235;
      const zc = spineZ(y0) + B[i] - 0.004 - (i >= 5 ? 0.006 : 0);
      const drop = 0.06 + i * 0.006;
      const end = i < 7 ? 2.72 : i < 10 ? 2.45 : 1.9;
      const cart = i < 7 ? 3.06 - i * 0.012 : i < 10 ? 2.86 : end;
      for (const s of [-1, 1]) {
        const at = (ph) => [
          s * (0.012 + A[i] * Math.sin(ph)),
          y0 - drop * Math.pow(ph / Math.PI, 1.3) + (i >= 7 && ph > end ? (ph - end) * 0.07 : 0),
          zc - B[i] * Math.cos(ph),
        ];
        const bone = (u) => at(0.12 + u * (end - 0.12));
        addBone(boneTube(k, bone, i < 2 ? 0.0055 : 0.0062, 24), opt(t));
        if (cart > end) {
          const cc = (u) => at(end + u * (cart - end));
          addBone(boneTube(k, cc, 0.0052, 16), opt(t, { color: (c) => lit(CARTILAGE, c.n) })); // prettier-ignore
        }
      }
    }
    addBone(k.ellipsoid(0.019, 0.095, 0.007), opt(t, { pos: [0, 1.345, 0.077], rot: [-12, 0, 0] }));
    addBone(k.ellipsoid(0.009, 0.018, 0.004), opt(t, { pos: [0, 1.238, 0.093], color: (c) => lit(CARTILAGE, c.n) })); // prettier-ignore
  }
  // Shoulder girdles: the clavicle in front, the scapula on the back.
  for (const s of [-1, 1]) {
    const t = side("girdle", s);
    const clav = spline([
      [s * 0.018, 1.468, 0.048],
      [s * 0.07, 1.472, 0.046],
      [s * 0.125, 1.478, 0.022],
      [s * 0.168, 1.482, -0.004],
    ]);
    addBone(boneTube(k, clav, 0.0062), opt(t));
    // The scapula: a curved triangular plate, with its spine and acromion.
    const tri = (u, v) => {
      const a = [s * 0.055, 1.44, -0.074];
      const b = [s * 0.15, 1.44, -0.046];
      const c = [s * 0.08, 1.255, -0.076];
      const q = lerp(lerp(a, b, u), c, v);
      return [q[0], q[1], q[2] - 0.006 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v)];
    };
    addBone(
      k.param((u, v) => tri(u, v * (1 - 0.001)), { grid: 32 }),
      opt(t),
    );
    const spineOfScap = spline([
      [s * 0.06, 1.405, -0.076],
      [s * 0.12, 1.43, -0.061],
      [s * 0.168, 1.462, -0.03],
    ]);
    addBone(boneTube(k, spineOfScap, 0.0045), opt(t));
  }
  // Arms: humerus, radius and ulna, and the hand's bones.
  for (const s of [-1, 1]) {
    const f = ARM[s];
    const at = (t, l = 0, zz = 0) => add(add(add(f.S, mul(f.dA, t)), mul(f.lat, l)), [0, 0, zz]);
    const h = side("humerus", s);
    addBone(k.sphere(0.021), opt(h, { pos: at(0.0, -0.005, 0.002) }));
    addBone(boneTube(k, (u) => at(0.015 + u * 0.3, 0, 0.002 * Math.sin(Math.PI * u)), (u) => 0.0115 - 0.002 * Math.sin(Math.PI * u)), opt(h)); // prettier-ignore
    addBone(k.ellipsoid(0.027, 0.011, 0.013), opt(h, { pos: at(0.322), rot: [0, 0, s * 14] }));
    const fb = side("forearmBones", s);
    // Palms forward: the radius on the thumb side (outward), the ulna inside.
    addBone(boneTube(k, (u) => at(0.338 + u * 0.262, 0.01 - u * 0.001), (u) => 0.0058 + 0.003 * u * u), opt(fb)); // prettier-ignore
    addBone(boneTube(k, (u) => at(0.33 + u * 0.266, -0.01), (u) => 0.0075 - 0.0035 * u), opt(fb)); // prettier-ignore
    addBone(k.sphere(0.009), opt(fb, { pos: at(0.325, -0.012, -0.01) }));
    const hb = side("hand", s);
    for (let i = 0; i < 8; i++)
      addBone(k.sphere(0.0065), opt(hb, { pos: at(0.61 + (i >> 2) * 0.012, -0.018 + (i & 3) * 0.012, 0) })); // prettier-ignore
    const fingers = [
      [-0.028, 0.07],
      [-0.0095, 0.085],
      [0.0095, 0.092],
      [0.028, 0.085],
    ];
    for (const [o, L] of fingers) {
      const base = at(0.625, o * 0.75);
      const knuckle = at(0.693, o);
      const dir = unit(add(add(f.dA, mul(f.lat, o * 1.4)), [0, 0, 0.08]));
      addBone(
        boneTube(k, (u) => lerp(base, knuckle, u), 0.0042, 12),
        opt(hb),
      );
      const segs = [0.4, 0.27, 0.17];
      let p0 = add(knuckle, mul(dir, 0.004));
      for (const [j, sg] of segs.entries()) {
        const p1 = add(p0, mul(dir, L * sg - 0.004));
        const q0 = p0;
        addBone(boneTube(k, (u) => lerp(q0, p1, u), 0.0037 - j * 0.0005, 12), opt(hb)); // prettier-ignore
        p0 = add(p1, mul(dir, 0.004));
      }
    }
    const tb = at(0.62, 0.034, 0.012);
    const td = unit(add(add(mul(f.lat, 0.55), mul(f.dA, 0.7)), [0, 0, 0.45]));
    let p0 = tb;
    for (const [j, L] of [0.024, 0.019, 0.014].entries()) {
      const p1 = add(p0, mul(td, L));
      const q0 = p0;
      addBone(
        boneTube(k, (u) => lerp(q0, p1, u), 0.0048 - j * 0.0006, 12),
        opt(hb),
      );
      p0 = add(p1, mul(td, 0.004));
    }
  }
  // Pelvis: the two hip bones (wing, socket, pubis, ischium) and the sacrum.
  {
    const t = TOK.pelvis;
    for (const s of [-1, 1]) {
      const crest = (a) => [s * (0.022 + 0.098 * Math.cos(a)), 1.045 + 0.018 * Math.cos(a * 1.3), -0.012 + (a > 0 ? 0.078 : 0.06) * Math.sin(a)]; // prettier-ignore
      const socket = [s * 0.08, 0.94, -0.004];
      const wing = (u, v) => {
        const a = -1.25 + u * 2.3;
        const c = crest(a);
        const q = lerp(c, socket, Math.pow(v, 0.85));
        return [q[0] - s * 0.012 * Math.sin(Math.PI * v) * Math.sin(Math.PI * u), q[1], q[2]];
      };
      addBone(k.param(wing, { grid: 40 }), opt(t));
      addBone(
        boneTube(k, (u) => crest(-1.25 + u * 2.3), 0.005),
        opt(t),
      );
      addBone(boneTube(k, spline([[s * 0.075, 0.922, 0.02], [s * 0.04, 0.9, 0.05], [s * 0.007, 0.878, 0.058]]), 0.0085), opt(t)); // prettier-ignore
      addBone(boneTube(k, spline([[s * 0.078, 0.91, -0.012], [s * 0.062, 0.862, -0.03], [s * 0.035, 0.858, 0.012], [s * 0.012, 0.866, 0.05]]), 0.0085), opt(t)); // prettier-ignore
      addBone(k.torus(0.016, 0.0055), opt(t, { pos: [s * 0.078, 0.925, 0.003], rot: [0, 0, 90] }));
    }
    const sac = (u, v) => {
      const w = 0.046 * (1 - v * 0.85);
      return [(u * 2 - 1) * w, 1.0 - v * 0.12, -0.066 - 0.018 * Math.sin(Math.PI * v * 0.8) - 0.006 * (1 - (u * 2 - 1) ** 2)]; // prettier-ignore
    };
    const sacColor = (c) => {
      let col = boneColor(c);
      for (let i = 0; i < 4; i++)
        for (const s of [-1, 1]) {
          const d = len(sub(c.p, [s * (0.02 - i * 0.003), 0.985 - i * 0.026, c.p[2]]));
          if (d < 0.005) col = mix(col, BONE_DARK, sstep(0.005, 0.002, d));
        }
      return col;
    };
    addBone(k.param(sac, { grid: 32 }), opt(t, { color: sacColor }));
    addBone(k.cone(0.008, 0.004, 0.022), opt(t, { pos: [0, 0.87, -0.07], rot: [15, 0, 0] }));
  }
  // Legs: femur (head, neck, trochanter, shaft, condyles) and knee cap,
  // tibia and fibula, and the foot's bones.
  for (const s of [-1, 1]) {
    const f = LEG[s];
    const fe = side("femur", s);
    addBone(k.sphere(0.023), opt(fe, { pos: f.H }));
    addBone(
      boneTube(k, (u) => lerp(f.H, [s * 0.13, 0.905, -0.002], u), 0.0135),
      opt(fe),
    );
    addBone(k.ellipsoid(0.017, 0.026, 0.02), opt(fe, { pos: [s * 0.137, 0.91, -0.006] }));
    const shaft = spline([
      [s * 0.128, 0.9, -0.002],
      [s * 0.116, 0.71, 0.01],
      [s * 0.1, 0.53, 0.0],
    ]);
    addBone(
      boneTube(k, shaft, (u) => 0.0135 + 0.004 * u * u),
      opt(fe),
    );
    addBone(k.ellipsoid(0.038, 0.022, 0.029), opt(fe, { pos: [s * 0.097, 0.518, -0.003] }));
    addBone(k.ellipsoid(0.02, 0.024, 0.008), opt(fe, { pos: [s * 0.097, 0.51, 0.043] }));
    const sh = side("shin", s);
    addBone(k.ellipsoid(0.034, 0.014, 0.027), opt(sh, { pos: [s * 0.095, 0.488, 0.004] }));
    addBone(boneTube(k, (u) => lerp([s * 0.094, 0.48, 0.006], [s * 0.093, 0.095, -0.011], u), (u) => 0.0145 - 0.004 * Math.sin(Math.PI * u)), opt(sh)); // prettier-ignore
    addBone(k.sphere(0.009), opt(sh, { pos: [s * 0.083, 0.088, -0.01] }));
    addBone(boneTube(k, (u) => lerp([s * 0.121, 0.47, -0.008], [s * 0.118, 0.085, -0.02], u), 0.0055), opt(sh)); // prettier-ignore
    addBone(k.sphere(0.008), opt(sh, { pos: [s * 0.119, 0.075, -0.02] }));
    // Foot: heel, ankle bone, the middle of the foot, five long bones and the toes.
    addBone(k.ellipsoid(0.019, 0.024, 0.035), opt(sh, { pos: [s * 0.1, 0.035, -0.03] }));
    addBone(k.ellipsoid(0.02, 0.014, 0.024), opt(sh, { pos: [s * 0.1, 0.066, -0.006] }));
    addBone(k.ellipsoid(0.032, 0.014, 0.022), opt(sh, { pos: [s * 0.104, 0.05, 0.03] }));
    for (let i = 0; i < 5; i++) {
      const o = (i - 2) * 0.014;
      const a = [s * (0.104 + o * 0.8), 0.045 - Math.abs(o) * 0.2, 0.045];
      const b = [s * (0.107 + o * 1.0), 0.02, 0.122 - Math.abs(i - 1) * 0.008];
      addBone(boneTube(k, (u) => lerp(a, b, u), i === 0 ? 0.0055 : 0.0042, 12), opt(sh)); // prettier-ignore
      const toe = [s * (0.108 + o * 0.95), 0.014, 0.158 - Math.abs(i - 1) * 0.012];
      addBone(boneTube(k, (u) => lerp(add(b, [0, 0, 0.005]), toe, u), i === 0 ? 0.005 : 0.0036, 12), opt(sh)); // prettier-ignore
    }
  }
}

// ---- Organs ---------------------------------------------------------------------------------

// Another recipe's build, placed into this toy: its shapes are moved to
// `at`, turned by `quat` and scaled by `scale`, on our organs part, with
// its moving effects left out (they stay still here). Its colour functions
// see their own coordinates, so they colour it as they do in its own toy.
function placed(k, { at, scale, quat = [0, 0, 0, 1], part, weight = 1, mirror = false, note }) {
  const qi = qinv(quat);
  const mx = mirror ? -1 : 1;
  const toW = (p) => add(at, mul(quatRotate(quat, [p[0] * mx, p[1], p[2]]), scale));
  const toL = (p) => {
    const l = mul(quatRotate(qi, sub(p, at)), 1 / scale);
    return [l[0] * mx, l[1], l[2]];
  };
  const nL = (n) => {
    const l = quatRotate(qi, n);
    return [l[0] * mx, l[1], l[2]];
  };
  const proxy = Object.create(k);
  // Small here, so its shapes need less detail than in its own toy.
  const lighter = (o = {}, key, max) => ({ ...o, [key]: Math.min(o[key] ?? 64, max) });
  proxy.tube = (c, r, o) => k.tube(c, r, { ...lighter(o, "grid", 24), samples: Math.min(o?.samples ?? 256, 64) }); // prettier-ignore
  proxy.radial = (f, o) => k.radial(f, lighter(o, "grid", 48));
  proxy.param = (f, o) => k.param(f, lighter(o, "grid", 40));
  proxy.lathe = (pr, o) => k.lathe(pr, lighter(o, "grid", 40));
  proxy.part = () => 0;
  proxy.reach = () => {};
  proxy.cloud = () => null;
  proxy.add = (shape, o = {}) => {
    const q0 = o.quat || (o.rot ? quatEuler(...o.rot) : [0, 0, 0, 1]);
    const sc0 = o.scale === undefined ? [1, 1, 1] : Array.isArray(o.scale) ? o.scale : [o.scale, o.scale, o.scale]; // prettier-ignore
    // Mirroring flips X after the shape's own turn: fold it into the scale
    // by turning with the mirrored rotation.
    const qm = mirror ? [q0[0], -q0[1], -q0[2], q0[3]] : q0;
    const pos0 = o.pos || [0, 0, 0];
    const fn = o.color;
    const color =
      typeof fn === "function"
        ? (c) => {
            const [p, n] = [c.p, c.n];
            c.p = toL(p);
            c.n = nL(n);
            const r = fn(c);
            c.p = p;
            c.n = n;
            return r;
          }
        : fn;
    const opts = {
      pos: toW(pos0),
      quat: quatMul(quat, qm),
      scale: [sc0[0] * scale * mx, sc0[1] * scale, sc0[2] * scale],
      color: note(color),
      weight: (o.weight ?? 1) * weight,
      size: o.size,
      flat: o.flat,
      stretch: o.stretch,
      opacity: Math.max(o.opacity ?? 0.95, 0.97),
      jitter: Math.min(o.jitter ?? 0.04, 0.02),
      even: o.even,
      pattern: o.pattern,
      part,
    };
    if (o.share !== undefined) opts.share = o.share * 0.05;
    if (o.count !== undefined) opts.count = Math.max(1, Math.round(o.count * 0.1));
    return k.add(shape, opts);
  };
  return proxy;
}

const defaults = (r) => Object.fromEntries((r.options || []).map((o) => [o.key, o.default]));

function buildOrgans(k, part, noteFor) {
  const organ = (id, label, place, opts = {}) => {
    const r = ORGANS[id];
    const o = { ...defaults(r), ...opts };
    r.build(placed(k, { ...place, part, note: noteFor(label) }), o);
  };
  organ("brain", "Brain", { at: [0, 1.708, -0.01], scale: 0.058, quat: quatAxisAngle([0, 1, 0], -Math.PI / 2) }, { colors: "plain" }); // prettier-ignore
  organ("lungs", "Lungs", { at: [0, 1.24, -0.008], scale: 0.135, weight: 1.2 });
  organ("heart", "Heart", { at: [0.016, 1.215, 0.035], scale: 0.058, weight: 1.6 });
  for (const s of [-1, 1])
    organ("kidney", "Kidneys", { at: [s * 0.066, s < 0 ? 1.03 : 1.045, -0.05], scale: 0.042, mirror: s < 0, weight: 1.5 }); // prettier-ignore
  const opt = (label, extra) => ({ part, even: true, opacity: 1, jitter: 0.012, flat: 0.3, weight: 1.4, ...extra, color: noteFor(label)(extra.color) }); // prettier-ignore
  // Liver: a wedge under the right ribs, with the green gallbladder beneath.
  const liver = (u, v) => {
    const th = v * Math.PI;
    const ph = u * TAU;
    let x = Math.sin(th) * Math.cos(ph);
    let y = Math.cos(th);
    let z = Math.sin(th) * Math.sin(ph);
    const taper = 0.55 + 0.45 * (1 - (x + 1) / 2); // thick on the right, thin to the left
    y = y * taper - 0.25 * (1 - taper) * (y < 0 ? 1 : 0);
    return [-0.035 + x * 0.088, 1.115 + y * 0.052, 0.015 + z * 0.068 * (0.7 + 0.3 * taper)];
  };
  k.add(k.param(liver, { grid: 48 }), opt("Liver", { color: (c) => sheen(lit("#7c2a22", c.n), c.n, 0.3) })); // prettier-ignore
  k.add(k.ellipsoid(0.014, 0.024, 0.014), opt("Liver", { pos: [-0.055, 1.07, 0.06], rot: [30, 0, -20], color: (c) => sheen(lit("#5f7a3a", c.n), c.n, 0.3) })); // prettier-ignore
  // Stomach: a J from the gullet under the left ribs to the small intestine.
  const stomach = spline([
    [0.012, 1.14, 0.0],
    [0.045, 1.13, 0.015],
    [0.072, 1.1, 0.025],
    [0.07, 1.05, 0.035],
    [0.042, 1.02, 0.045],
    [0.005, 1.02, 0.045],
    [-0.022, 1.035, 0.035],
  ]);
  const sr = (u) => 0.011 + 0.024 * Math.sin(Math.PI * Math.min(1, u * 1.25)) ** 0.7;
  k.add(k.tube(stomach, sr, { caps: true, grid: 48 }), opt("Stomach", { color: (c) => sheen(lit("#d98886", c.n), c.n, 0.3) })); // prettier-ignore
  // Large intestine: up the right side, across, down the left, with its pouches.
  const colon = spline([
    [-0.083, 0.885, 0.04],
    [-0.095, 0.95, 0.035],
    [-0.09, 1.0, 0.035],
    [-0.05, 1.0, 0.055],
    [0.0, 0.99, 0.058],
    [0.05, 0.998, 0.055],
    [0.09, 0.995, 0.035],
    [0.094, 0.93, 0.03],
    [0.083, 0.885, 0.04],
    [0.045, 0.872, 0.04],
    [0.005, 0.868, 0.005],
  ]);
  const cr = (u) => 0.019 * (1 + 0.14 * Math.cos(u * TAU * 22));
  k.add(k.tube(colon, cr, { caps: true, grid: 32, samples: 512 }), opt("Intestines", { color: (c) => sheen(lit("#c8876a", c.n), c.n, 0.22) })); // prettier-ignore
  // Small intestine: coils packed in the middle.
  const pts = [];
  const rows = 5;
  for (let r = 0; r < rows; r++) {
    const y = 0.97 - r * 0.023;
    const dir = r % 2 ? -1 : 1;
    for (let i = 0; i <= 6; i++) {
      const x = dir * (-0.06 + (i / 6) * 0.12);
      pts.push([x, y + 0.008 * Math.sin(i * 2.1 + r), 0.045 + 0.018 * Math.sin(i * 1.7 + r * 2.3)]);
    }
  }
  k.add(k.tube(spline(pts), 0.0115, { caps: true, grid: 24, samples: 512 }), opt("Intestines", { color: (c) => sheen(lit("#e3a08e", c.n), c.n, 0.3) })); // prettier-ignore
}

// ---- The recipe -----------------------------------------------------------------------------

// Motion of one piece over its local time u (0..1): it swings open on its
// hinge (or tilts as it lifts), then flies off along `fly` and is hidden.
function pieceMotion(m, u) {
  const open = ease(clamp01(u / 0.45));
  const go = clamp01((u - 0.3) / 0.7);
  const fly = go * go;
  const angle = m.angle * (open + 0.35 * fly);
  const quat = quatAxisAngle(m.axis, angle);
  const offset = add(mul(m.lift, open), mul(m.fly, 3.4 * fly));
  return { base: m.base, quat, offset, visible: u < 0.96 ? 1 : 0 };
}

const PEEL = 3.2; // seconds a peel (or the return) lasts
const layerIndex = (id) => Math.max(0, LAYERS.indexOf(id));

export const RECIPES = {
  "anatomy-atlas": {
    alive: false,
    density: 1.5,
    options: [
      {
        key: "layer",
        label: "Layer",
        type: "select",
        default: "skin",
        choices: LAYERS.map((id, i) => ({ id, label: LAYER_NAMES[i] })),
      },
    ],
    controls: [
      { key: "labels", label: "Labels", type: "toggle", default: 0, ease: 0.2 },
      { key: "peel", label: "Peel", type: "pulse", ease: PEEL },
    ],
    action: {
      key: "peel",
      label: "Peel a layer",
    },
    drive(t, c, out, info) {
      const d = info.data;
      if (!d) return;
      const n = info.tap?.n ?? 0;
      const cur = (d.layer0 + n) % 4;
      const prev = (cur + 3) % 4;
      const s = c.peel > 0 && n > 0 ? 1 - c.peel : 1; // 1 when still
      const moving = s < 1;
      const back = moving && cur === 0; // the return
      const show = [0, 0, 0, 0];
      const tokens = [];
      for (let i = 0; i < PIECES.length; i++) tokens.push({ visible: 1 });
      if (!moving) {
        show[cur] = 1;
        if (cur === 2) show[3] = 1;
        for (let i = 0; i < PIECES.length; i++) if (PIECES[i][1] < cur) tokens[i].visible = 0;
      } else if (!back) {
        // Peeling layer `prev`: its pieces fly off; the next one shows.
        show[prev] = s < 0.985 ? 1 : 0;
        show[cur] = 1;
        if (cur === 2 || prev === 2) show[3] = 1;
        for (let i = 0; i < PIECES.length; i++) {
          const L = PIECES[i][1];
          if (L < prev) tokens[i].visible = 0;
          else if (L === prev) {
            const m = d.motion[i];
            tokens[i] = pieceMotion(m, clamp01((s - m.w0) / (m.w1 - m.w0)));
          }
        }
      } else {
        // The return: the skeleton, then the muscles, then the skin come back.
        for (let L = 0; L < 4; L++) show[L] = L === 0 || s < 0.985 ? 1 : 0;
        for (let i = 0; i < PIECES.length; i++) {
          const L = PIECES[i][1];
          const m = d.motion[i];
          const span = [
            [0.5, 1.0],
            [0.25, 0.8],
            [0, 0.55],
          ][L];
          const u = clamp01((s - span[0]) / (span[1] - span[0]));
          const local = clamp01((1 - u - m.w0 * 0.5) / (1 - m.w0 * 0.5));
          tokens[i] = pieceMotion(m, local);
        }
      }
      LAYERS.forEach((id, L) => (out.parts[id] = { visible: show[L] }));
      out.tokens = tokens;
      // Sort again as the pieces fly (docs/PACKS.md 7b, rule 12 and 13).
      const m = mem(c);
      const step = moving ? Math.floor(s * 8) : -1;
      if (step !== m.step) {
        out.resort = true;
        m.step = step;
      }
      // A low chime as the last pieces of skin settle back.
      if (back && s > 0.93 && m.chimed !== n) {
        m.chimed = n;
        out.cues.push({ voice: "bell", f: "G3", decay: 1.6, vol: 0.45, bright: 0.3 });
      }
      // The labels: every layer's name, the shown layer's parts, and the
      // part last tapped highlighted.
      if (c.labels > 0.5) {
        if (m.tapN !== n) {
          m.tapN = n;
          m.hi = info.tap?.point ? nearestLabel(d, info.tap.point, cur) : -1;
        }
        out.legend = legend(cur, m.hi);
      }
    },
    build(k, o) {
      const layer0 = layerIndex(o.layer);
      const parts = Object.fromEntries(LAYERS.map((id) => [id, k.part(id)]));
      const prims = bodyPrims();
      // Each piece's splats: their center, average normal and a few points
      // for finding what was tapped (collected as the splats are made).
      const acc = PIECES.map(() => ({ sum: [0, 0, 0], nsum: [0, 0, 0], n: 0 }));
      const labelPts = LABEL_LIST.map(() => []);
      const seen = (tok, label, c) => {
        if (tok >= 0) {
          const a = acc[tok];
          for (let j = 0; j < 3; j++) {
            a.sum[j] += c.p[j];
            a.nsum[j] += c.n[j];
          }
          a.n++;
        }
        const pts = labelPts[label];
        if (pts.length < 64) pts.push(c.p);
        else if (c.rand() < 0.02) pts[Math.floor(c.rand() * 64)] = c.p;
      };
      const labelOfTok = PIECES.map(([, , name]) => labelIndex(name));

      // The skin: a smooth mannequin, lit with a soft satin sheen.
      const skins = prims.map((P, i) => bodyShape(k, prims, i, 0));
      prims.forEach((P, i) => {
        if (skins[i].none) return;
        skins[i].item = k.add(skins[i], {
          part: parts.skin,
          weight: 0.9,
          kind: "token",
          params: (c) => [c.s.tok ?? 0, 0],
          even: true,
          opacity: 1,
          flat: 0.2,
          jitter: 0.008,
          color: (c) => {
            if (c.s.drop) return null;
            const tok = (c.s.tok = skinPiece(c.p, c.s.prim));
            seen(tok, labelOfTok[tok], c);
            let col = lit(SKIN, c.n, 0.66, 0.4);
            // A calm mannequin face: soft hollows for the eyes.
            if (c.s.prim.kind === "head") {
              for (const s of [-1, 1]) {
                const e = len(sub(c.p, [s * 0.03, 1.668, 0.085]));
                col = shade(col, 1 - 0.1 * sstep(0.022, 0.006, e));
              }
            }
            return { c: sheen(col, c.n, 0.22, 10), size: c.s.mult };
          },
        });
      });

      // The muscles: the same body a few millimeters in, in groups with
      // grooves between them, fibers and pale tendons.
      const groove = (p, n, P, tok) => {
        const t1 = unit(cross(n, Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
        const t2 = cross(n, t1);
        let edge = 0;
        // Two looks, across each other, 7.5 mm away (enough to find a seam).
        for (const [a, b] of [
          [0.7, 0.7],
          [-0.7, 0.7],
        ]) {
          for (const sgn of [1, -1]) {
            const q = add(p, add(mul(t1, sgn * a * 0.0075), mul(t2, sgn * b * 0.0075)));
            if (muscleAt(q, P).tok !== tok) {
              edge += 2;
              break;
            }
          }
        }
        return edge;
      };
      prims.forEach((P, i) => {
        if (skins[i].none) return;
        const shape = bodyShape(k, prims, i, -0.0045, skins[i]);
        shape.item = k.add(shape, {
          part: parts.muscles,
          weight: 0.9,
          kind: "token",
          params: (c) => [c.s.tok ?? 0, 0],
          even: true,
          opacity: 1,
          flat: 0.22,
          jitter: 0.01,
          color: (c) => {
            if (c.s.drop) return null;
            const m = muscleAt(c.p, c.s.prim);
            c.s.tok = m.tok;
            seen(m.tok, labelOfTok[m.tok], c);
            // Fibers: soft stripes across the fiber direction.
            const across = unit(cross(c.n, m.fib));
            const stripe = Math.sin(dot(c.p, across) * 520 + 3 * c.noise(c.p[0] * 30, c.p[1] * 30, c.p[2] * 30)); // prettier-ignore
            let col = mix(MUSCLE, MUSCLE_DARK, 0.18 + 0.14 * stripe);
            col = mix(col, TENDON, m.tendon);
            const edge = groove(c.p, c.n, c.s.prim, m.tok);
            if (edge) col = mix(col, GROOVE, 0.25 + 0.12 * edge);
            return { c: sheen(lit(col, c.n, 0.62, 0.45), c.n, 0.28, 16), size: c.s.mult };
          },
        });
      });

      // The skeleton and the organs.
      buildSkeleton(k, parts.skeleton, (tok, colorFn) => (c) => {
        seen(tok, labelOfTok[tok], c);
        return typeof colorFn === "function" ? colorFn(c) : lit(colorFn, c.n);
      });
      buildOrgans(k, parts.organs, (label) => (colorFn) => (c) => {
        const col = typeof colorFn === "function" ? colorFn(c) : (colorFn ?? "#cccccc");
        if (col !== null) seen(-1, labelIndex(label), c);
        return col;
      });

      k.data = { layer0, acc, labelPts, motion: null };
      // The pieces' motions are set once the splats exist (their centers).
      Object.defineProperty(k.data, "motion", {
        get() {
          return this._motion || (this._motion = pieceMotions(acc));
        },
      });
    },
  },
};

// Hinges, lifts and flight paths for every piece, from where its splats are.
function pieceMotions(acc) {
  const center = (i) => (acc[i].n ? mul(acc[i].sum, 1 / acc[i].n) : [0, 1, 0]);
  const normal = (i) => unit(acc[i].nsum);
  const res = [];
  const muscleOrder = PIECES.filter((p) => p[1] === 1).length;
  const boneOrder = PIECES.filter((p) => p[1] === 2).length;
  for (let i = 0; i < PIECES.length; i++) {
    const [id, L] = PIECES[i];
    const c = center(i);
    const sx = Math.abs(c[0]) < 0.03 ? 0 : Math.sign(c[0]);
    let m;
    if (L === 0) {
      // Skin: hinges on its seams.
      const front = /face|Front|torsoR|torsoL/.test(id);
      if (id === "face" || id === "headBack") {
        m = hinge(c, [0, 1.8, -0.005], [1, 0, 0], [0, 1, front ? 1 : -1], 1.35);
        m.fly = unit(front ? [0, 1, -0.15] : [0, 0.6, -1]);
      } else if (id === "torsoBack") {
        m = hinge(c, [0, 1.47, -0.09], [1, 0, 0], [0, 0.3, -1], 1.2);
        m.fly = unit([0, 0.5, -1]);
      } else if (id === "torsoR" || id === "torsoL") {
        const s = id === "torsoR" ? -1 : 1;
        m = hinge(c, [s * 0.15, c[1], 0], [0, 1, 0], [s, 0, 1], 1.55);
        m.fly = unit([s, 0.3, -0.1]);
      } else {
        const s = /R$/.test(id) ? -1 : 1;
        const arm = /arm/.test(id);
        const f = arm ? ARM[s] : LEG[s];
        const dir = arm ? f.dA : f.dL;
        const lat = f.lat;
        const mid = arm ? add(f.S, mul(f.dA, 0.32)) : lerp(f.H, f.A, 0.45);
        m = hinge(c, add(mid, mul(lat, arm ? 0.045 : 0.085)), dir, [s, 0, front ? 1 : -1], 1.4);
        m.fly = unit([s, 0.25, front ? 0.05 : -0.5]);
      }
      m.w0 = /face|headBack|torso/.test(id) ? 0 : 0.08;
      m.w1 = m.w0 + 0.88;
    } else {
      // Muscles and bones lift off group by group, each along its own way out.
      let out = normal(i);
      if (len(acc[i].nsum) < 0.2 * acc[i].n || !Number.isFinite(out[0]))
        out = unit([c[0], 0.15, c[2] - 0.0 + (c[2] >= 0 ? 0.05 : -0.05)]);
      const up = [0, 1, 0];
      let axis = cross(out, up);
      if (len(axis) < 0.1) axis = [1, 0, 0];
      m = {
        base: c,
        axis: unit(axis),
        angle: 0.35,
        lift: mul(out, 0.035),
        // Sideways, up, or back; never at the viewer.
        fly: sx
          ? unit([sx, 0.35, Math.min(out[2] * 0.35, 0.05)])
          : unit(c[2] < -0.03 ? [0, 0.4, -1] : [0, 1, Math.min(out[2] * 0.2, 0.05)]),
      };
      const k = PIECES.slice(0, i).filter((p) => p[1] === L).length;
      const total = L === 1 ? muscleOrder : boneOrder;
      m.w0 = (k / Math.max(1, total - 1)) * 0.45;
      m.w1 = m.w0 + 0.52;
    }
    res.push(m);
  }
  return res;
}

// A hinge at `base` about `axis`, turning the way that moves the piece's
// center toward `toward`.
function hinge(c, base, axis, toward, angle) {
  axis = unit(axis);
  const r = sub(c, base);
  const moved = (a) => sub(quatRotate(quatAxisAngle(axis, a), r), r);
  const sign = dot(moved(angle), toward) >= dot(moved(-angle), toward) ? 1 : -1;
  return { base, axis, angle: sign * angle, lift: [0, 0, 0], fly: [0, 1, 0] };
}

// The label nearest a tapped point among the parts shown after the tap.
function nearestLabel(d, p, cur) {
  let best = Infinity;
  let hit = -1;
  LABEL_LIST.forEach((l, i) => {
    const shown = l.layer === cur || (cur === 2 && l.layer === 3);
    if (!shown) return;
    for (const q of d.labelPts[i]) {
      const dd = len(sub(p, q));
      if (dd < best) [best, hit] = [dd, i];
    }
  });
  return hit;
}

// out.legend for the page: each layer's name, the parts of the one shown.
function legend(cur, hi) {
  const items = [];
  LABELS.forEach((names, L) => {
    items.push({ text: LAYER_NAMES[L], head: true, dim: L !== cur });
    if (L !== cur) return;
    for (const name of names) {
      const i = labelIndex(name);
      items.push({ text: name, on: i === hi });
    }
  });
  return { title: "Anatomy atlas", items };
}

// Per-toy memory for drive(), keyed by the control state object.
const MEM = new WeakMap();
function mem(c) {
  let m = MEM.get(c);
  if (!m) MEM.set(c, (m = {}));
  return m;
}

// For tests and tools.
export const ATLAS = { LAYERS, LABELS, PIECES, LABEL_LIST, bodyPrims, fieldAt };

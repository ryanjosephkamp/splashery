// The character's rig (lane Character): its sizes and joints, and the
// rotation math shared by the gait and the tests. Pure JavaScript.
//
// Meters, facing +z, feet at y = 0. A joint's Euler angles are degrees,
// applied as PlayCanvas does (setLocalEulerAngles): R = Rz · Ry · Rx.
// Positive x turns a hanging limb backward and tips an upright part
// forward; positive y turns toward +x; positive z swings a hanging limb
// toward +x.

export const BODY = {
  hip: 0.935, // the hip joints' height standing (the hips' pivot)
  hipX: 0.09,
  thigh: 0.43,
  shin: 0.425,
  ankle: 0.08, // the ankle joints' height standing
  upperArm: 0.295,
  forearm: 0.25,
  palm: 0.098, // wrist to knuckles
  shoulderX: 0.186,
  shoulderY: 0.477, // above the hips
  neck: 0.605, // the head's pivot, above the hips
  height: 1.74,
  radius: 0.3, // for collision
  // The shoe's contact points in the foot's frame: the heel's bottom and the
  // toes' hinge at the ball of the foot.
  heel: [0, -0.072, -0.056],
  ball: [0, -0.045, 0.125],
};

// The parts, in the order the renderer builds the joints. `parent` is the
// joint a part hangs from; `at` is its pivot relative to that parent.
export const JOINTS = [
  { name: "hips", parent: null, at: [0, BODY.hip, 0] },
  { name: "torso", parent: "hips", at: [0, 0.1, 0] }, // the abdomen, from the small of the back
  { name: "chest", parent: "torso", at: [0, 0.165, 0] },
  { name: "neck", parent: "chest", at: [0, 0.245, -0.014] },
  { name: "head", parent: "neck", at: [0, 0.095, 0.014] },
  { name: "armL", parent: "chest", at: [BODY.shoulderX, 0.212, -0.012] },
  { name: "armR", parent: "chest", at: [-BODY.shoulderX, 0.212, -0.012] },
  { name: "foreL", parent: "armL", at: [0, -BODY.upperArm, 0] },
  { name: "foreR", parent: "armR", at: [0, -BODY.upperArm, 0] },
  { name: "handL", parent: "foreL", at: [0, -BODY.forearm, 0] },
  { name: "handR", parent: "foreR", at: [0, -BODY.forearm, 0] },
  { name: "fingersL", parent: "handL", at: [-0.002, -BODY.palm, 0.002] },
  { name: "fingersR", parent: "handR", at: [0.002, -BODY.palm, 0.002] },
  { name: "thighL", parent: "hips", at: [BODY.hipX, 0, 0] },
  { name: "thighR", parent: "hips", at: [-BODY.hipX, 0, 0] },
  { name: "shinL", parent: "thighL", at: [0, -BODY.thigh, 0] },
  { name: "shinR", parent: "thighR", at: [0, -BODY.thigh, 0] },
  { name: "footL", parent: "shinL", at: [0, -BODY.shin, 0] },
  { name: "footR", parent: "shinR", at: [0, -BODY.shin, 0] },
  { name: "toesL", parent: "footL", at: BODY.ball },
  { name: "toesR", parent: "footR", at: BODY.ball },
];

export const JOINT = Object.fromEntries(JOINTS.map((j) => [j.name, j]));

// Each joint's pivot in the rest pose, in the character's space.
export function restPivots() {
  const out = {};
  for (const j of JOINTS) {
    const p = j.parent ? out[j.parent] : [0, 0, 0];
    out[j.name] = [p[0] + j.at[0], p[1] + j.at[1], p[2] + j.at[2]];
  }
  return out;
}

// ---- 3x3 rotations (row-major arrays of 9) -------------------------------------------

const D = Math.PI / 180;
export const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
export function rotX(a) {
  const c = Math.cos(a * D);
  const s = Math.sin(a * D);
  return [1, 0, 0, 0, c, -s, 0, s, c];
}
export function rotY(a) {
  const c = Math.cos(a * D);
  const s = Math.sin(a * D);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}
export function rotZ(a) {
  const c = Math.cos(a * D);
  const s = Math.sin(a * D);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}
export function mul(a, b) {
  const o = new Array(9);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  return o;
}
export function tr(a) {
  return [a[0], a[3], a[6], a[1], a[4], a[7], a[2], a[5], a[8]];
}
export function apply(m, v) {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}
// Euler degrees [x, y, z] to a matrix, as PlayCanvas: Rz · Ry · Rx.
export function euler(e) {
  return mul(rotZ(e[2]), mul(rotY(e[1]), rotX(e[0])));
}
// A matrix to Euler degrees (the inverse of euler()).
export function toEuler(m) {
  const sy = Math.max(-1, Math.min(1, -m[6]));
  const y = Math.asin(sy);
  let x;
  let z;
  if (Math.abs(sy) < 0.99999) {
    x = Math.atan2(m[7], m[8]);
    z = Math.atan2(m[3], m[0]);
  } else {
    x = Math.atan2(-m[5], m[4]);
    z = 0;
  }
  return [x / D, y / D, z / D];
}
// A rotation from its columns (the images of x, y and z).
export function fromColumns(X, Y, Z) {
  return [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]];
}

// Every joint's place and rotation in the character's space for a pose
// ({ joints: { name: Euler degrees }, bob, hips: [x, y, z] }):
// { name: { p: [x, y, z], R } }.
export function solve(p) {
  const out = {};
  for (const j of JOINTS) {
    const e = p.joints[j.name] || [0, 0, 0];
    const R = euler(e);
    if (!j.parent) {
      const h = p.hips || [0, 0, 0];
      out[j.name] = { p: [h[0], BODY.hip + (p.bob || 0), h[2]], R };
      continue;
    }
    const par = out[j.parent];
    const a = apply(par.R, j.at);
    out[j.name] = { p: [par.p[0] + a[0], par.p[1] + a[1], par.p[2] + a[2]], R: mul(par.R, R) };
  }
  return out;
}

// A point given in a part's rest pose (the character's space), moved by
// the part's joint in a solved pose.
export function place(solved, rest, name, q) {
  const f = solved[name];
  const r = rest[name];
  const a = apply(f.R, [q[0] - r[0], q[1] - r[1], q[2] - r[2]]);
  return [f.p[0] + a[0], f.p[1] + a[1], f.p[2] + a[2]];
}

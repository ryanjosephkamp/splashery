// Lane Any pose: tap effects in the toy's own frame, whatever its pose.
//
// The effect shader (src/effects.js) moves splat centers in the world, after
// the toy's entity has placed them. Hands-on (src/physics/hands-on.js) turns
// and moves that entity (Stage.setToyPose), so a toy tossed onto its side
// would have its effects worked out about where it stood, with the world's
// up as its own: parts turned about pivots left behind, swells from an empty
// center, sways and key presses along the wrong axis. With a pose set, the
// shader takes each center back into the toy's home frame first, runs every
// effect there, and puts it back in the pose after. Upright (no pose) the
// shader does exactly what it did before.
//
// The CPU half (this file): the pose uniforms, and the world points and
// directions the shader reads (pokes, the magnet, the grab, the wind, the
// drop's gravity, the camera, the squish) taken into the home frame too.
// Effects that only make sense one way up (a flame, rising embers, falling
// snow) follow the world's real up through uSpPoseUp. Pure JavaScript.

import { quat, v3 } from "./physics/world.js";

const IDENTITY = [0, 0, 0, 1];

// The uniforms with no pose (always set: a uniform keeps its last value).
export const NO_POSE = {
  uSpPoseQ: [0, 0, 0, 1],
  uSpPoseT: [0, 0, 0, 0],
  uSpPoseC: [0, 0, 0, 0],
  uSpPoseUp: [0, 1, 0, 0],
};

// A pose { pivot: c, q: Q, t } (x' = Q (x - c) + c + t) as helpers.
export function poseFrame(pose) {
  if (!pose) return null;
  const Q = pose.q || IDENTITY;
  const Qc = quat.conj(Q);
  const c = pose.pivot;
  const ct = v3.add(c, pose.t || [0, 0, 0]);
  return {
    Q,
    Qc,
    c,
    ct,
    // A world point (posed) in the toy's home frame, and back.
    toHome: (p) => v3.add(quat.rotate(Qc, v3.sub(p, ct)), c),
    toWorld: (p) => v3.add(quat.rotate(Q, v3.sub(p, c)), ct),
    // A world direction in the home frame.
    dirHome: (d) => quat.rotate(Qc, d),
  };
}

// Writes the pose uniforms into `u` and takes the world points and
// directions it holds into the toy's home frame. `squish` is Hands-on's
// squish ({ axis, point, ... } in the world) with its `amount`, or null.
export function poseUniforms(u, pose, squish = null) {
  const f = poseFrame(pose);
  if (!f) {
    Object.assign(u, NO_POSE);
    return u;
  }
  const up = f.dirHome([0, 1, 0]);
  u.uSpPoseQ = f.Q.slice();
  u.uSpPoseT = [f.ct[0], f.ct[1], f.ct[2], 1];
  u.uSpPoseC = [f.c[0], f.c[1], f.c[2], 0];
  u.uSpPoseUp = [up[0], up[1], up[2], 0];
  const point = (k) => {
    const a = u[k];
    if (!a) return;
    const p = f.toHome([a[0], a[1], a[2]]);
    u[k] = [p[0], p[1], p[2], a[3]];
  };
  const dir = (k) => {
    const a = u[k];
    if (!a) return;
    const d = f.dirHome([a[0], a[1], a[2]]);
    u[k] = [d[0], d[1], d[2], a[3]];
  };
  for (const k of ["uSpPoke0", "uSpPoke1", "uSpPoke2", "uSpPoke3", "uSpMag", "uSpGrab", "uSpCam"]) point(k); // prettier-ignore
  for (const k of ["uSpGrabD", "uSpWind", "uSpDrop"]) dir(k);
  if (squish && squish.amount) {
    const a = v3.norm(f.dirHome(squish.axis));
    const p = f.toHome(squish.point);
    u.uSpBodyS = [a[0], a[1], a[2], squish.amount];
    u.uSpBodyP = [p[0], p[1], p[2], 0];
  }
  return u;
}

// For tests and clips: a Level 1 body's pose lying on its side ("side",
// turned a quarter about the view's depth) or upside down ("down"), set down
// on the floor where it stood. ho: a HandsOn after ensure() in "toy" mode.
export function posePreset(ho, which) {
  const b = ho.body;
  const c = b.home.pos;
  const s = Math.SQRT1_2;
  const turn = which === "side" ? [0, 0, s, s] : which === "down" ? [1, 0, 0, 0] : IDENTITY;
  const q = quat.mul(turn, b.home.q);
  const low = (qq) => {
    if (b.solid?.type === "sphere") return -b.solid.r;
    let m = Infinity;
    for (const p of b.points) m = Math.min(m, quat.rotate(qq, p)[1]);
    return m;
  };
  const floor = c[1] + low(b.home.q);
  return { pos: [c[0], floor - low(q), c[2]], q };
}

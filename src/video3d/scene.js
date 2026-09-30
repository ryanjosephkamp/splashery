// Video to 3D (lane Video 3D): puts a trained scene and its camera path into the toy's frame.
// Pure functions, no DOM.
//
// The camera solve's world has no "up" of its own (it is the first camera's frame, y pointing down
// the picture). Here the cameras' average up becomes +y, the way they mostly looked becomes -z (so
// the stage's home view looks the way the video did), the scene's middle goes to the origin and
// its bulk fits in the unit sphere. The cameras go through the same change, so the flight lines up.

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const mulM = (M, v) => [dot(M[0], v), dot(M[1], v), dot(M[2], v)];

// A camera from the solve: { R: row-major world-to-camera rotation (x right, y down, z forward),
// t } as Splat.js gives it. Its center in the world.
export function camCenter({ R, t }) {
  return [
    -(R[0] * t[0] + R[3] * t[1] + R[6] * t[2]),
    -(R[1] * t[0] + R[4] * t[1] + R[7] * t[2]),
    -(R[2] * t[0] + R[5] * t[1] + R[8] * t[2]),
  ];
}

function quantile(values, q) {
  const s = Float64Array.from(values).sort();
  if (!s.length) return 0;
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))];
}

// The frame: { M (rows: the toy's x, y, z axes in the world), center, scale, keepRadius }.
// splats: { count, pos, opacity }; cams: [{ R, t }].
// The size: around something (the views meet), the cameras end up `orbit` from its middle; past
// something, half of the solid splats end up within `fit` of the middle (far things, the sky and
// the skyline, would otherwise shrink the near ones to nothing). Splats beyond `keep` (the unit
// sphere, as the kit's own toys are) are left out.
export function sceneFrame(splats, cams, { fit = 0.45, orbit = 1.6, keep = 0.995 } = {}) {
  let up = [0, 0, 0];
  let fwd = [0, 0, 0];
  for (const c of cams) {
    up = [up[0] - c.R[3], up[1] - c.R[4], up[2] - c.R[5]];
    fwd = [fwd[0] + c.R[6], fwd[1] + c.R[7], fwd[2] + c.R[8]];
  }
  up = cams.length ? norm(up) : [0, -1, 0];
  // The way the cameras looked, level (with up taken out). A walk around an object looks every
  // way and averages to nothing: then the first camera's way is used.
  let f = [fwd[0] - dot(fwd, up) * up[0], fwd[1] - dot(fwd, up) * up[1], fwd[2] - dot(fwd, up) * up[2]]; // prettier-ignore
  if (Math.hypot(...f) < 0.3 * Math.max(1, cams.length) && cams.length) {
    const c0 = cams[0].R;
    const g = [c0[6], c0[7], c0[8]];
    f = [g[0] - dot(g, up) * up[0], g[1] - dot(g, up) * up[1], g[2] - dot(g, up) * up[2]];
  }
  if (Math.hypot(...f) < 1e-6) f = Math.abs(up[2]) < 0.9 ? cross(up, [1, 0, 0]) : cross(up, [0, 1, 0]); // prettier-ignore
  const z = norm([-f[0], -f[1], -f[2]]);
  const x = norm(cross(up, z));
  const y = cross(z, x);
  const M = [x, y, z];
  // The middle and size of the solid part of the scene (faint splats and far floaters left out).
  const xs = [];
  const ys = [];
  const zs = [];
  for (let i = 0; i < splats.count; i++) {
    if (splats.opacity && splats.opacity[i] < 0.3) continue;
    xs.push(splats.pos[i * 3]);
    ys.push(splats.pos[i * 3 + 1]);
    zs.push(splats.pos[i * 3 + 2]);
  }
  // The middle: for a walk or flight around something, the point all the cameras look at; for a
  // street or a flight past, where the views do not meet, the middle of the solid splats.
  const look = lookAtPoint(cams);
  const center =
    look || (xs.length ? [quantile(xs, 0.5), quantile(ys, 0.5), quantile(zs, 0.5)] : [0, 0, 0]);
  const d = xs.map((_, i) => Math.hypot(xs[i] - center[0], ys[i] - center[1], zs[i] - center[2]));
  let scale = fit / (quantile(d, 0.5) || 1);
  if (look) {
    const cd = cams.map((c) => {
      const C = camCenter(c);
      return Math.hypot(C[0] - center[0], C[1] - center[1], C[2] - center[2]);
    });
    scale = orbit / (quantile(cd, 0.5) || 1);
  }
  return { M, center, scale, keepRadius: keep / scale, around: !!look };
}

// The point closest to every camera's line of sight (least squares), or null when the views are
// close to parallel (a street, a flight past) or the point is behind the cameras.
export function lookAtPoint(cams) {
  if (cams.length < 3) return null;
  const A = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const b = [0, 0, 0];
  let mean = [0, 0, 0];
  for (const c of cams) {
    const f = norm([c.R[6], c.R[7], c.R[8]]);
    const C = camCenter(c);
    mean = [mean[0] + f[0], mean[1] + f[1], mean[2] + f[2]];
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        const m = (i === j ? 1 : 0) - f[i] * f[j];
        A[i * 3 + j] += m;
        b[i] += m * C[j];
      }
  }
  // Views that all point the same way do not meet anywhere useful.
  if (Math.hypot(...mean) / cams.length > 0.995) return null;
  const det =
    A[0] * (A[4] * A[8] - A[5] * A[7]) -
    A[1] * (A[3] * A[8] - A[5] * A[6]) +
    A[2] * (A[3] * A[7] - A[4] * A[6]);
  if (Math.abs(det) < 1e-9) return null;
  const inv = [
    A[4] * A[8] - A[5] * A[7],
    A[2] * A[7] - A[1] * A[8],
    A[1] * A[5] - A[2] * A[4],
    A[5] * A[6] - A[3] * A[8],
    A[0] * A[8] - A[2] * A[6],
    A[2] * A[3] - A[0] * A[5],
    A[3] * A[7] - A[4] * A[6],
    A[1] * A[6] - A[0] * A[7],
    A[0] * A[4] - A[1] * A[3],
  ].map((v) => v / det);
  const X = [0, 1, 2].map((i) => inv[i * 3] * b[0] + inv[i * 3 + 1] * b[1] + inv[i * 3 + 2] * b[2]); // prettier-ignore
  // In front of most cameras.
  let ahead = 0;
  for (const c of cams) {
    const C = camCenter(c);
    if (dot([c.R[6], c.R[7], c.R[8]], [X[0] - C[0], X[1] - C[1], X[2] - C[2]]) > 0) ahead++;
  }
  return ahead >= 0.8 * cams.length ? X : null;
}

// A world point in the toy's frame.
export function toToy(frame, p) {
  const v = mulM(frame.M, [p[0] - frame.center[0], p[1] - frame.center[1], p[2] - frame.center[2]]);
  return [v[0] * frame.scale, v[1] * frame.scale, v[2] * frame.scale];
}

// The frame's rotation as a quaternion [x, y, z, w] (the rotation that takes world directions to
// the toy's).
export function frameQuat(M) {
  const [m00, m01, m02] = M[0];
  const [m10, m11, m12] = M[1];
  const [m20, m21, m22] = M[2];
  const tr = m00 + m11 + m22;
  let x;
  let y;
  let z;
  let w;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    w = 0.25 * s;
    x = (m21 - m12) / s;
    y = (m02 - m20) / s;
    z = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    w = (m21 - m12) / s;
    x = 0.25 * s;
    y = (m01 + m10) / s;
    z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    w = (m02 - m20) / s;
    x = (m01 + m10) / s;
    y = 0.25 * s;
    z = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    w = (m10 - m01) / s;
    x = (m02 + m20) / s;
    y = (m12 + m21) / s;
    z = 0.25 * s;
  }
  const l = Math.hypot(x, y, z, w) || 1;
  return [x / l, y / l, z / l, w / l];
}

// q * r for quaternions [x, y, z, w].
export function quatMul(q, r) {
  return [
    q[3] * r[0] + q[0] * r[3] + q[1] * r[2] - q[2] * r[1],
    q[3] * r[1] - q[0] * r[2] + q[1] * r[3] + q[2] * r[0],
    q[3] * r[2] + q[0] * r[1] - q[1] * r[0] + q[2] * r[3],
    q[3] * r[3] - q[0] * r[0] - q[1] * r[1] - q[2] * r[2],
  ];
}

// A solved camera in the toy's frame, as the stage's orbit camera would hold it:
// { pos, forward, up, yaw, pitch, roll } (yaw, pitch and roll as OrbitCamera.pose() reads them).
export function toyCamera(frame, cam) {
  const R = cam.R;
  const pos = toToy(frame, camCenter(cam));
  const forward = norm(mulM(frame.M, [R[6], R[7], R[8]]));
  const up = norm(mulM(frame.M, [-R[3], -R[4], -R[5]]));
  const yaw = Math.atan2(-forward[0], -forward[2]);
  const pitch = Math.asin(Math.max(-1, Math.min(1, -forward[1])));
  const right0 = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const up0 = [-Math.sin(pitch) * Math.sin(yaw), Math.cos(pitch), -Math.sin(pitch) * Math.cos(yaw)];
  const roll = Math.atan2(-dot(up, right0), dot(up, up0));
  return { pos, forward, up, yaw, pitch, roll };
}

// The kit's splats in the toy's frame: splats beyond keepRadius (far floaters) are left out.
// Returns { count, pos, scales, quat, color, opacity } like readSplatPly.
export function splatsInFrame(frame, s) {
  const q0 = frameQuat(frame.M);
  const keep = [];
  const k2 = frame.keepRadius ** 2;
  for (let i = 0; i < s.count; i++) {
    const dx = s.pos[i * 3] - frame.center[0];
    const dy = s.pos[i * 3 + 1] - frame.center[1];
    const dz = s.pos[i * 3 + 2] - frame.center[2];
    if (dx * dx + dy * dy + dz * dz <= k2) keep.push(i);
  }
  const n = keep.length;
  const out = {
    count: n,
    pos: new Float32Array(n * 3),
    scales: new Float32Array(n * 3),
    quat: new Float32Array(n * 4),
    color: new Float32Array(n * 3),
    opacity: new Float32Array(n),
  };
  keep.forEach((i, j) => {
    out.pos.set(toToy(frame, [s.pos[i * 3], s.pos[i * 3 + 1], s.pos[i * 3 + 2]]), j * 3);
    for (let k = 0; k < 3; k++) out.scales[j * 3 + k] = s.scales[i * 3 + k] * frame.scale;
    out.quat.set(quatMul(q0, [s.quat[i * 4], s.quat[i * 4 + 1], s.quat[i * 4 + 2], s.quat[i * 4 + 3]]), j * 4); // prettier-ignore
    out.color.set([s.color[i * 3], s.color[i * 3 + 1], s.color[i * 3 + 2]], j * 3);
    out.opacity[j] = s.opacity[i];
  });
  return out;
}

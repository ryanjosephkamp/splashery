// Conservative cleanup in the scene's display frame. Camera support is a frustum estimate:
// training exports no per-splat observation counts, so this does not claim occlusion testing.

export function cameraView(c) {
  const sy = Math.sin(c.yaw),
    cy = Math.cos(c.yaw);
  const sp = Math.sin(c.pitch),
    cp = Math.cos(c.pitch);
  const forward = c.forward || [-sy * cp, -sp, -cy * cp];
  const up = c.up || [-sp * sy, cp, -sp * cy];
  const right = [
    forward[1] * up[2] - forward[2] * up[1],
    forward[2] * up[0] - forward[0] * up[2],
    forward[0] * up[1] - forward[1] * up[0],
  ];
  return {
    ...c,
    forward,
    up,
    right,
    tx: c.f && c.w ? c.w / (2 * c.f) : 1,
    ty: c.f && c.h ? c.h / (2 * c.f) : 0.8,
  };
}

export function cleanScene(s, path, { affine = false } = {}) {
  const views = path.map(cameraView);
  const segments = path.map((a, i) => {
    const b = path[i + 1] || a;
    const delta = b.pos.map((v, k) => v - a.pos[k]);
    return { a: a.pos, delta, length2: delta.reduce((sum, v) => sum + v * v, 0) };
  });
  const distanceToPath = (p) => {
    let best = Infinity;
    for (const { a, delta, length2 } of segments) {
      const x = p[0] - a[0],
        y = p[1] - a[1],
        z = p[2] - a[2];
      const t = length2
        ? Math.min(1, Math.max(0, (x * delta[0] + y * delta[1] + z * delta[2]) / length2))
        : 0;
      best = Math.min(
        best,
        (x - delta[0] * t) ** 2 + (y - delta[1] * t) ** 2 + (z - delta[2] * t) ** 2,
      );
    }
    return Math.sqrt(best);
  };
  const removed = { unsupported: 0, ray: 0, atPath: 0, invalid: 0 };
  const keep = [];
  const caps = [];
  const skySum = [0, 0, 0];
  let skyCount = 0;
  const minimum = Math.max(2, Math.ceil(path.length * 0.06));
  const high = Math.max(0, ...path.map((c) => c.pos[1])) + 0.15;
  for (let i = 0; i < s.count; i++) {
    const p = Array.from(s.pos.subarray(i * 3, i * 3 + 3));
    const scales = Array.from(s.scales.subarray(i * 3, i * 3 + 3));
    const color = Array.from(s.color.subarray(i * 3, i * 3 + 3));
    const quat = Array.from(s.quat.subarray(i * 4, i * 4 + 4));
    const big = Math.max(...scales);
    const small = Math.min(...scales);
    const middle = scales[0] + scales[1] + scales[2] - big - small;
    if (
      ![...p, ...scales, ...color, ...quat, s.opacity[i]].every(Number.isFinite) ||
      scales.some((v) => v <= 0) ||
      s.opacity[i] <= 0
    ) {
      removed.invalid++;
      continue;
    }
    // Only sample bright, sky-colored upper background; never remove a surface based on its
    // color. The same source-derived dome backs both affine Walk and the contracted view.
    if (
      p[1] > high &&
      (s.outer?.[i] || Math.hypot(...p) > 1.5) &&
      color[2] >= Math.max(color[0], color[1]) * 0.85 &&
      color.reduce((a, v) => a + v, 0) / 3 > 0.35
    ) {
      for (let k = 0; k < 3; k++) skySum[k] += Math.max(0, Math.min(1, color[k]));
      skyCount++;
    }
    // A ray has one long axis and two short ones. A broad, thin wall can have a tiny normal
    // axis without being a ray, so compare the longest axis with the middle one.
    const upperBackground = p[1] > high && Math.hypot(...p) > 0.8;
    const rayRatio = upperBackground ? 6 : 24;
    const raySize = upperBackground ? 0.025 : 0.035;
    if (big / Math.max(1e-8, middle) > rayRatio && big > raySize) {
      removed.ray++;
      continue;
    }
    // A small safety distance along every segment, not only at extracted camera centers.
    const pathDistance = distanceToPath(p);
    if (pathDistance < 0.012) {
      removed.atPath++;
      continue;
    }
    let support = 0;
    if ((affine || !s.outer?.[i]) && path.length >= 3) {
      for (const c of views) {
        const vx = p[0] - c.pos[0],
          vy = p[1] - c.pos[1],
          vz = p[2] - c.pos[2];
        const depth = vx * c.forward[0] + vy * c.forward[1] + vz * c.forward[2];
        const x = vx * c.right[0] + vy * c.right[1] + vz * c.right[2];
        const y = vx * c.up[0] + vy * c.up[1] + vz * c.up[2];
        if (
          depth > 0 &&
          Math.abs(x) < depth * c.tx * 1.15 + big &&
          Math.abs(y) < depth * c.ty * 1.15 + big
        )
          support++;
        if (support >= minimum) break;
      }
      if (support < minimum) {
        removed.unsupported++;
        continue;
      }
    }
    keep.push(i);
    caps.push(pathDistance < 0.12 ? Math.max(0.002, pathDistance * 0.35) : Infinity);
  }
  const scene = { count: keep.length };
  for (const [key, width] of [
    ["pos", 3],
    ["scales", 3],
    ["quat", 4],
    ["color", 3],
    ["opacity", 1],
    ["outer", 1],
  ]) {
    scene[key] =
      key === "outer" ? new Uint8Array(keep.length) : new Float32Array(keep.length * width);
    if (s[key])
      keep.forEach((i, j) =>
        scene[key].set(s[key].subarray(i * width, i * width + width), j * width),
      );
  }
  let clamped = 0;
  keep.forEach((i, j) => {
    if (Math.max(...scene.scales.subarray(j * 3, j * 3 + 3)) <= caps[j]) return;
    const factor = caps[j] / Math.max(...scene.scales.subarray(j * 3, j * 3 + 3));
    for (let k = 0; k < 3; k++) scene.scales[j * 3 + k] *= factor;
    clamped++;
  });
  return {
    scene,
    removed,
    clamped,
    sky: skyCount ? skySum.map((v) => v / skyCount) : [0.65, 0.72, 0.8],
    skyCount,
  };
}

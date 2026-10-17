// Inward face-center rays find thin walls. Sampling is not a proof about every
// point; this limitation travels with the result. A BVH bounds ray work.
export function checkThickness({ positions: p, indices: idx }, sampleBudget = 2048) {
  const count = idx.length / 3;
  const order = Array.from({ length: count }, (_, i) => i);
  const centers = new Float32Array(count * 3);
  for (let i = 0; i < count; i++)
    for (let k = 0; k < 3; k++)
      centers[i * 3 + k] =
        (p[idx[i * 3] * 3 + k] + p[idx[i * 3 + 1] * 3 + k] + p[idx[i * 3 + 2] * 3 + k]) / 3;
  function build(start, end) {
    const lo = [Infinity, Infinity, Infinity],
      hi = [-Infinity, -Infinity, -Infinity];
    for (let i = start; i < end; i++)
      for (let v = 0; v < 3; v++)
        for (let k = 0; k < 3; k++) {
          const x = p[idx[order[i] * 3 + v] * 3 + k];
          lo[k] = Math.min(lo[k], x);
          hi[k] = Math.max(hi[k], x);
        }
    const node = { lo, hi, start, end };
    if (end - start > 12) {
      const extent = hi.map((v, k) => v - lo[k]),
        axis = extent.indexOf(Math.max(...extent));
      const sorted = order
        .slice(start, end)
        .sort((a, b) => centers[a * 3 + axis] - centers[b * 3 + axis]);
      for (let i = 0; i < sorted.length; i++) order[start + i] = sorted[i];
      const middle = (start + end) >> 1;
      node.left = build(start, middle);
      node.right = build(middle, end);
    }
    return node;
  }
  const root = build(0, count);
  const diagonal = Math.hypot(...root.hi.map((v, k) => v - root.lo[k]));
  const epsilon = Math.max(1e-7, diagonal * 1e-7);
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  function ray(origin, direction, skip) {
    let best = Infinity;
    const stack = [root];
    while (stack.length) {
      const node = stack.pop();
      let near = 0,
        far = best;
      for (let k = 0; k < 3; k++) {
        if (Math.abs(direction[k]) < 1e-15) {
          if (origin[k] < node.lo[k] || origin[k] > node.hi[k]) {
            far = -1;
            break;
          }
          continue;
        }
        const a = (node.lo[k] - origin[k]) / direction[k],
          b = (node.hi[k] - origin[k]) / direction[k];
        near = Math.max(near, Math.min(a, b));
        far = Math.min(far, Math.max(a, b));
      }
      if (far < near) continue;
      if (node.left) {
        stack.push(node.left, node.right);
        continue;
      }
      for (let i = node.start; i < node.end; i++) {
        const tri = order[i];
        if (tri === skip) continue;
        const a = idx[tri * 3] * 3,
          b = idx[tri * 3 + 1] * 3,
          c = idx[tri * 3 + 2] * 3;
        const e1 = [0, 1, 2].map((k) => p[b + k] - p[a + k]),
          e2 = [0, 1, 2].map((k) => p[c + k] - p[a + k]);
        const h = cross(direction, e2),
          det = dot(e1, h);
        if (Math.abs(det) < 1e-18) continue;
        const s = [0, 1, 2].map((k) => origin[k] - p[a + k]),
          u = dot(s, h) / det;
        if (u < 0 || u > 1) continue;
        const q = cross(s, e1),
          v = dot(direction, q) / det;
        if (v < 0 || u + v > 1) continue;
        const t = dot(e2, q) / det;
        if (t > epsilon && t < best) best = t;
      }
    }
    return best;
  }
  let minimum = Infinity,
    missing = 0,
    sampled = 0;
  const stride = Math.max(1, Math.ceil(count / sampleBudget));
  for (let tri = 0; tri < count; tri += stride) {
    const a = idx[tri * 3] * 3,
      b = idx[tri * 3 + 1] * 3,
      c = idx[tri * 3 + 2] * 3;
    const u = [0, 1, 2].map((k) => p[b + k] - p[a + k]),
      v = [0, 1, 2].map((k) => p[c + k] - p[a + k]);
    const inward = cross(v, u),
      length = Math.hypot(...inward);
    if (length < 1e-16) continue;
    const direction = inward.map((x) => x / length),
      origin = direction.map((d, k) => centers[tri * 3 + k] + d * epsilon);
    const thickness = ray(origin, direction, tri) + epsilon;
    sampled++;
    if (Number.isFinite(thickness)) minimum = Math.min(minimum, thickness);
    else missing++;
  }
  return {
    minimumMm: Number.isFinite(minimum) ? minimum : null,
    sampledFaces: sampled,
    missingHits: missing,
    passed: sampled > 0 && missing === 0 && minimum >= 1,
    method: "Inward face-center ray samples; not a full-surface thickness certificate",
  };
}

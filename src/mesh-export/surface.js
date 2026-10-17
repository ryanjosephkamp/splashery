// Marching tetrahedra subdivides each cube along the same body diagonal. Shared
// faces use identical diagonals, removing the ambiguous saddle cases of classic
// marching cubes. Every interpolated grid edge has one shared mesh vertex.
const CORNERS = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [1, 1, 1],
  [0, 1, 1],
];
const TETS = [
  [0, 1, 2, 6],
  [0, 2, 3, 6],
  [0, 3, 7, 6],
  [0, 7, 4, 6],
  [0, 4, 5, 6],
  [0, 5, 1, 6],
];

export function extractSurface(
  data,
  n,
  origin,
  step,
  level,
  colorField,
  maxTriangles,
  logarithmic = false,
) {
  const positions = [],
    colors = [],
    indices = [],
    cache = new Map();
  const nodeCount = n ** 3;
  const offsets = CORNERS.map(([x, y, z]) => x + n * (y + n * z));
  const ids = new Array(8),
    values = new Array(8);
  const nodePosition = (id) => [id % n, Math.floor(id / n) % n, Math.floor(id / (n * n))];
  function edge(a, b) {
    const ia = ids[a],
      ib = ids[b];
    const key = Math.min(ia, ib) * nodeCount + Math.max(ia, ib);
    if (cache.has(key)) return cache.get(key);
    const pa = nodePosition(ia),
      pb = nodePosition(ib);
    // Log interpolation follows Gaussian falloff more closely at coarse grids.
    const log = logarithmic && values[a] > 0 && values[b] > 0;
    const va = log ? Math.log(values[a]) : values[a],
      vb = log ? Math.log(values[b]) : values[b];
    const t = Math.max(
      0.0001,
      Math.min(0.9999, ((log ? Math.log(level) : level) - va) / (vb - va)),
    );
    const point = pa.map((v, k) => origin[k] + step * (v + (pb[k] - v) * t));
    const idx = positions.length / 3;
    positions.push(...point);
    colors.push(...colorField.color(...point));
    cache.set(key, idx);
    return idx;
  }
  function face(a, b, c, direction) {
    const p = positions,
      ia = a * 3,
      ib = b * 3,
      ic = c * 3;
    const u = [p[ib] - p[ia], p[ib + 1] - p[ia + 1], p[ib + 2] - p[ia + 2]];
    const v = [p[ic] - p[ia], p[ic + 1] - p[ia + 1], p[ic + 2] - p[ia + 2]];
    const dot =
      (u[1] * v[2] - u[2] * v[1]) * direction[0] +
      (u[2] * v[0] - u[0] * v[2]) * direction[1] +
      (u[0] * v[1] - u[1] * v[0]) * direction[2];
    if (dot < 0) indices.push(a, c, b);
    else indices.push(a, b, c);
  }
  for (let z = 0; z < n - 1; z++)
    for (let y = 0; y < n - 1; y++)
      for (let x = 0; x < n - 1; x++) {
        const base = x + n * (y + n * z);
        let mask = 0;
        for (let k = 0; k < 8; k++) {
          ids[k] = base + offsets[k];
          values[k] = data[ids[k]];
          if (values[k] > level) mask |= 1 << k;
        }
        if (!mask || mask === 255) continue;
        for (const tet of TETS) {
          const inside = [],
            outside = [];
          for (const v of tet) (values[v] > level ? inside : outside).push(v);
          if (!inside.length || !outside.length) continue;
          const direction = [0, 1, 2].map(
            (k) =>
              outside.reduce((s, v) => s + CORNERS[v][k], 0) / outside.length -
              inside.reduce((s, v) => s + CORNERS[v][k], 0) / inside.length,
          );
          if (inside.length === 1) face(...outside.map((v) => edge(inside[0], v)), direction);
          else if (outside.length === 1) face(...inside.map((v) => edge(outside[0], v)), direction);
          else {
            const a = edge(inside[0], outside[0]),
              b = edge(inside[0], outside[1]),
              c = edge(inside[1], outside[1]),
              d = edge(inside[1], outside[0]);
            face(a, b, c, direction);
            face(a, c, d, direction);
          }
          if (indices.length / 3 > maxTriangles)
            return { overflow: true, triangles: indices.length / 3 };
        }
      }
  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    indices: new Uint32Array(indices),
  };
}

export function resample(data, n, m) {
  const out = new Float32Array(m ** 3),
    factor = (n - 1) / (m - 1);
  for (let z = 0; z < m; z++)
    for (let y = 0; y < m; y++)
      for (let x = 0; x < m; x++) {
        const p = [x * factor, y * factor, z * factor],
          lo = p.map((v) => Math.min(n - 2, Math.floor(v))),
          f = p.map((v, k) => v - lo[k]);
        let value = 0;
        for (let dz = 0; dz <= 1; dz++)
          for (let dy = 0; dy <= 1; dy++)
            for (let dx = 0; dx <= 1; dx++)
              value +=
                data[lo[0] + dx + n * (lo[1] + dy + n * (lo[2] + dz))] *
                (dx ? f[0] : 1 - f[0]) *
                (dy ? f[1] : 1 - f[1]) *
                (dz ? f[2] : 1 - f[2]);
        out[x + m * (y + m * z)] = value;
      }
  return out;
}

export function solidVolume(density, n, level, radius) {
  let mask = Uint8Array.from(density, (v) => (v > level ? 1 : 0));
  // A conservative six-neighbor dilation thickens the shell before the outside
  // flood. Cavity filling removes interior surfaces without bridging open air.
  for (let pass = 0; pass < radius; pass++) {
    const next = mask.slice();
    for (let z = 2; z < n - 2; z++)
      for (let y = 2; y < n - 2; y++)
        for (let x = 2; x < n - 2; x++) {
          const i = x + n * (y + n * z);
          if (mask[i])
            for (const j of [i - 1, i + 1, i - n, i + n, i - n * n, i + n * n]) next[j] = 1;
        }
    mask = next;
  }
  const queue = new Uint32Array(n ** 3);
  let head = 0,
    tail = 1;
  queue[0] = 0;
  mask[0] = 2;
  while (head < tail) {
    const i = queue[head++],
      x = i % n,
      y = Math.floor(i / n) % n,
      z = Math.floor(i / (n * n));
    for (const j of [
      x > 0 ? i - 1 : -1,
      x < n - 1 ? i + 1 : -1,
      y > 0 ? i - n : -1,
      y < n - 1 ? i + n : -1,
      z > 0 ? i - n * n : -1,
      z < n - 1 ? i + n * n : -1,
    ]) {
      if (j >= 0 && !mask[j]) {
        mask[j] = 2;
        queue[tail++] = j;
      }
    }
  }
  // Leave a full outside border even when the requested thickness is too large.
  const out = new Float32Array(n ** 3);
  for (let z = 1; z < n - 1; z++)
    for (let y = 1; y < n - 1; y++)
      for (let x = 1; x < n - 1; x++) {
        const i = x + n * (y + n * z);
        out[i] = mask[i] === 2 ? 0 : 1;
      }
  return out;
}

// Mesh checks use both edges and vertex links: two closed shells touching at one
// vertex have two faces per edge, but are not a manifold at that vertex.
export function inspectTopology({ positions, indices }) {
  const n = positions.length / 3;
  const edges = new Map();
  const links = Array.from({ length: n }, () => []);
  let degenerate = 0;
  let volume = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i],
      b = indices[i + 1],
      c = indices[i + 2];
    if (a >= n || b >= n || c >= n || a === b || a === c || b === c) {
      degenerate++;
      continue;
    }
    const p = positions;
    const ux = p[b * 3] - p[a * 3],
      uy = p[b * 3 + 1] - p[a * 3 + 1],
      uz = p[b * 3 + 2] - p[a * 3 + 2];
    const vx = p[c * 3] - p[a * 3],
      vy = p[c * 3 + 1] - p[a * 3 + 1],
      vz = p[c * 3 + 2] - p[a * 3 + 2];
    const nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx;
    if (!(nx * nx + ny * ny + nz * nz > 1e-28)) degenerate++;
    volume += (p[a * 3] * nx + p[a * 3 + 1] * ny + p[a * 3 + 2] * nz) / 6;
    for (const [v, w, other] of [
      [a, b, c],
      [b, c, a],
      [c, a, b],
    ]) {
      const key = Math.min(v, w) * n + Math.max(v, w);
      let e = edges.get(key);
      if (!e) edges.set(key, (e = [0, 0]));
      e[0]++;
      e[1] += v < w ? 1 : -1;
      links[v].push([w, other]);
    }
  }
  let boundaryEdges = 0,
    nonManifoldEdges = 0,
    inconsistentEdges = 0,
    nonManifoldVertices = 0;
  for (const [count, direction] of edges.values()) {
    if (count === 1) boundaryEdges++;
    if (count > 2) nonManifoldEdges++;
    if (count === 2 && direction !== 0) inconsistentEdges++;
  }
  for (const link of links) {
    if (!link.length) continue;
    const adj = new Map();
    for (const [a, b] of link) {
      if (!adj.has(a)) adj.set(a, []);
      if (!adj.has(b)) adj.set(b, []);
      adj.get(a).push(b);
      adj.get(b).push(a);
    }
    const seen = new Set();
    const stack = [adj.keys().next().value];
    while (stack.length) {
      const v = stack.pop();
      if (seen.has(v)) continue;
      seen.add(v);
      for (const w of adj.get(v)) if (!seen.has(w)) stack.push(w);
    }
    if (seen.size !== adj.size || [...adj.values()].some((a) => a.length !== 2))
      nonManifoldVertices++;
  }
  const closed = indices.length > 0 && !boundaryEdges && !nonManifoldEdges;
  return {
    watertight: closed,
    manifold: closed && !nonManifoldVertices && !inconsistentEdges && !degenerate,
    boundaryEdges,
    nonManifoldEdges,
    nonManifoldVertices,
    inconsistentEdges,
    degenerate,
    volume,
  };
}

export function vertexNormals(positions, indices) {
  const normals = new Float32Array(positions.length);
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3,
      b = indices[i + 1] * 3,
      c = indices[i + 2] * 3;
    const ux = positions[b] - positions[a],
      uy = positions[b + 1] - positions[a + 1],
      uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a],
      vy = positions[c + 1] - positions[a + 1],
      vz = positions[c + 2] - positions[a + 2];
    const normal = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    for (const v of [a, b, c]) for (let k = 0; k < 3; k++) normals[v + k] += normal[k];
  }
  for (let i = 0; i < normals.length; i += 3) {
    const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    for (let k = 0; k < 3; k++) normals[i + k] /= length;
  }
  return normals;
}

export function smoothMesh(mesh, iterations) {
  const { positions: p, indices } = mesh;
  const sum = new Float32Array(p.length);
  const degree = new Uint32Array(p.length / 3);
  // Taubin's alternating steps reduce the shrinkage of ordinary Laplacian smoothing.
  for (let pass = 0; pass < iterations * 2; pass++) {
    sum.fill(0);
    degree.fill(0);
    for (let i = 0; i < indices.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        const a = indices[i + k],
          b = indices[i + ((k + 1) % 3)];
        degree[a]++;
        degree[b]++;
        for (let j = 0; j < 3; j++) {
          sum[a * 3 + j] += p[b * 3 + j];
          sum[b * 3 + j] += p[a * 3 + j];
        }
      }
    }
    const weight = pass % 2 ? -0.51 : 0.5;
    const before = p.slice();
    for (let i = 0; i < degree.length; i++)
      if (degree[i])
        for (let k = 0; k < 3; k++)
          p[i * 3 + k] += weight * (sum[i * 3 + k] / degree[i] - p[i * 3 + k]);
    // An unconstrained Laplacian can turn a very small triangle inside out.
    // Revert the offending vertices, then check neighbors affected by that
    // reversion. If the local constraints do not settle, reject this pass.
    const locked = new Uint8Array(degree.length);
    const faceNormal = (a, b, c, data) => {
      const ux = data[b] - data[a],
        uy = data[b + 1] - data[a + 1],
        uz = data[b + 2] - data[a + 2];
      const vx = data[c] - data[a],
        vy = data[c + 1] - data[a + 1],
        vz = data[c + 2] - data[a + 2];
      return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    };
    for (let attempt = 0; attempt < 8; attempt++) {
      const bad = new Set();
      for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i] * 3,
          b = indices[i + 1] * 3,
          c = indices[i + 2] * 3;
        const old = faceNormal(a, b, c, before),
          next = faceNormal(a, b, c, p);
        const area = old[0] ** 2 + old[1] ** 2 + old[2] ** 2;
        const alignment = old[0] * next[0] + old[1] * next[1] + old[2] * next[2];
        if (alignment < 0.02 * area || next[0] ** 2 + next[1] ** 2 + next[2] ** 2 < 0.0001 * area)
          for (const v of [indices[i], indices[i + 1], indices[i + 2]]) if (!locked[v]) bad.add(v);
      }
      if (!bad.size) break;
      if (attempt === 7) {
        p.set(before);
        break;
      }
      for (const v of bad) {
        locked[v] = 1;
        for (let k = 0; k < 3; k++) p[v * 3 + k] = before[v * 3 + k];
      }
    }
  }
}

export function removeFloaters(mesh, share) {
  const { indices, positions, colors } = mesh;
  const n = positions.length / 3;
  const parent = Uint32Array.from({ length: n }, (_, i) => i);
  const find = (v) => {
    while (parent[v] !== v) {
      parent[v] = parent[parent[v]];
      v = parent[v];
    }
    return v;
  };
  for (let i = 0; i < indices.length; i += 3) {
    parent[find(indices[i])] = find(indices[i + 1]);
    parent[find(indices[i])] = find(indices[i + 2]);
  }
  const areas = new Float64Array(n);
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3,
      b = indices[i + 1] * 3,
      c = indices[i + 2] * 3;
    const u = [0, 1, 2].map((k) => positions[b + k] - positions[a + k]);
    const v = [0, 1, 2].map((k) => positions[c + k] - positions[a + k]);
    areas[find(indices[i])] += Math.hypot(
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    );
  }
  let largest = 0;
  for (const a of areas) largest = Math.max(largest, a);
  const remap = new Int32Array(n).fill(-1),
    out = [],
    p = [],
    color = [];
  let removed = 0;
  for (let i = 0; i < indices.length; i += 3) {
    if (areas[find(indices[i])] < largest * share) {
      removed++;
      continue;
    }
    for (let k = 0; k < 3; k++) {
      const v = indices[i + k];
      if (remap[v] < 0) {
        remap[v] = p.length / 3;
        for (let j = 0; j < 3; j++) {
          p.push(positions[v * 3 + j]);
          color.push(colors[v * 3 + j]);
        }
      }
      out.push(remap[v]);
    }
  }
  return {
    positions: new Float32Array(p),
    colors: new Float32Array(color),
    indices: new Uint32Array(out),
    removed,
  };
}

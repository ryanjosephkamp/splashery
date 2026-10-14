// A connected, observed free-space grid. A cell outside the recorded camera positions needs
// several camera views and must lie in front of their reconstructed opaque surfaces. These
// are geometric view counts, not training observation counts or a physical collision mesh.
import { cameraView } from "./cleanup.js";

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const distance = (a, b) => Math.hypot(...a.map((v, k) => v - b[k]));
const median = (a) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)] || 0.2;

export function buildWalkRegion(scene, path) {
  if (!path.length) return null;
  const lo = [0, 1, 2].map((k) => Math.min(...path.map((c) => c.pos[k])));
  const hi = [0, 1, 2].map((k) => Math.max(...path.map((c) => c.pos[k])));
  const center = lo.map((v, k) => (v + hi[k]) / 2);
  const depths = [];
  for (let i = 0; i < scene.count; i += Math.max(1, Math.floor(scene.count / 2000)))
    if (scene.opacity[i] > 0.4)
      depths.push(distance(Array.from(scene.pos.subarray(i * 3, i * 3 + 3)), center));
  const pad = Math.min(0.65, Math.max(0.12, median(depths) * 0.6));
  for (let k = 0; k < 3; k++) {
    lo[k] -= pad;
    hi[k] += pad;
  }
  const cell = Math.max(0.006, ...hi.map((v, k) => (v - lo[k]) / 30));
  const dims = hi.map((v, k) => Math.ceil((v - lo[k]) / cell));
  const index = (x, y, z) => x + dims[0] * (y + dims[1] * z);
  const coordinates = (i) => [
    i % dims[0],
    Math.floor(i / dims[0]) % dims[1],
    Math.floor(i / (dims[0] * dims[1])),
  ];
  const position = (i) => coordinates(i).map((v, k) => lo[k] + (v + 0.5) * cell);
  const key = (p) => {
    const c = p.map((v, k) => Math.floor((v - lo[k]) / cell));
    return c.every((v, k) => v >= 0 && v < dims[k]) ? index(...c) : -1;
  };
  const width = 32,
    height = 24;
  const project = (c, p) => {
    const v = p.map((x, k) => x - c.pos[k]);
    const z = dot(v, c.forward);
    const x = dot(v, c.right) / (z * c.tx),
      y = dot(v, c.up) / (z * c.ty);
    return { z, x, y, px: ((x + 1) * width) / 2, py: ((y + 1) * height) / 2 };
  };
  const views = path.map((cam) => {
    const c = cameraView(cam);
    const depth = new Float32Array(width * height).fill(Infinity);
    const counts = new Uint16Array(width * height);
    for (let i = 0; i < scene.count; i++) {
      if (scene.opacity[i] < 0.4) continue;
      const p = Array.from(scene.pos.subarray(i * 3, i * 3 + 3));
      const q = project(c, p);
      if (!(q.z > cell && Math.abs(q.x) < 1.1 && Math.abs(q.y) < 1.1)) continue;
      const size = Math.max(...scene.scales.subarray(i * 3, i * 3 + 3));
      const radius = Math.min(3, Math.max(1, Math.ceil((size * width) / (q.z * c.tx))));
      for (
        let y = Math.max(0, Math.floor(q.py) - radius);
        y <= Math.min(height - 1, Math.floor(q.py) + radius);
        y++
      )
        for (
          let x = Math.max(0, Math.floor(q.px) - radius);
          x <= Math.min(width - 1, Math.floor(q.px) + radius);
          x++
        ) {
          const at = y * width + x;
          depth[at] = Math.min(depth[at], Math.max(0, q.z - size));
          counts[at] = Math.min(65535, counts[at] + 1);
        }
    }
    return { ...c, depth, counts };
  });
  const n = dims.reduce((a, v) => a * v, 1);
  const support = new Uint8Array(n);
  const allowed = new Uint8Array(n);
  const seeds = new Set();
  const minimum = Math.max(2, Math.ceil(path.length * 0.1));
  let cameraCells = 0,
    multiViewCells = 0;
  // The complete recorded trajectory is safe evidence in its own right; voxelize its segments
  // to connect cameras even where the reconstruction has no depth at the lens itself.
  const cameraPositions = [];
  path.forEach((a, i) => {
    const b = path[i + 1] || a;
    const steps = Math.max(1, Math.ceil(distance(a.pos, b.pos) / (cell * 0.4)));
    for (let j = 0; j <= steps; j++)
      cameraPositions.push(a.pos.map((v, k) => v + ((b.pos[k] - v) * j) / steps));
  });
  for (const p of cameraPositions) {
    const at = key(p);
    if (at >= 0) seeds.add(at);
  }
  for (let i = 0; i < n; i++) {
    const p = position(i);
    let count = 0;
    for (const c of views) {
      const q = project(c, p);
      if (!(q.z > cell * 0.25 && Math.abs(q.x) < 0.92 && Math.abs(q.y) < 0.92)) continue;
      const at = Math.floor(q.py) * width + Math.floor(q.px);
      if (c.counts[at] >= 2 && q.z < c.depth[at] - cell * 0.7) count++;
    }
    support[i] = count;
    if (count >= minimum) {
      allowed[i] = 1;
      multiViewCells++;
    }
    if (seeds.has(i)) {
      allowed[i] = 1;
      cameraCells++;
    }
  }
  // Keep only cells connected to the observed cameras; isolated reconstructed islands never
  // become places someone can jump to. Six neighbors prevent diagonal wall crossings.
  const connected = new Uint8Array(n);
  const queue = [...seeds].filter((i) => allowed[i]);
  for (const i of queue) connected[i] = 1;
  for (let at = 0; at < queue.length; at++) {
    const c = coordinates(queue[at]);
    for (let k = 0; k < 3; k++)
      for (const delta of [-1, 1]) {
        const v = c.slice();
        v[k] += delta;
        if (v[k] < 0 || v[k] >= dims[k]) continue;
        const j = index(...v);
        if (allowed[j] && !connected[j]) {
          connected[j] = 1;
          queue.push(j);
        }
      }
  }
  const contains = (p) => {
    const i = key(p);
    return i >= 0 && !!connected[i];
  };
  const move = (from, to) => {
    let current = from.slice();
    const steps = Math.max(1, Math.ceil(distance(from, to) / (cell * 0.25)));
    for (let j = 1; j <= steps; j++) {
      const next = from.map((v, k) => v + ((to[k] - v) * j) / steps);
      if (contains(next)) current = next;
      else
        for (const k of [0, 2, 1]) {
          const slide = current.slice();
          slide[k] = next[k];
          if (contains(slide)) current = slide;
        }
    }
    return current;
  };
  return {
    contains,
    move,
    cell,
    bounds: { lo, hi },
    viewCount: (p) => support[key(p)] || 0,
    stats: {
      cells: queue.length,
      cameraCells,
      multiViewCells,
      minimumViews: minimum,
      cellSize: cell,
    },
  };
}

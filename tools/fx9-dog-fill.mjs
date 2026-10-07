#!/usr/bin/env node
// Lane Fix9: the dog plush's hidden core. The capture never saw the plush's underside or the mat
// beneath it (it lay there), so where the plush meets the mat there are holes right through:
// the dark gaps under its head and paws. This tool finds, on a grid seen from above, the cells
// where the plush stands over no mat, and writes src/packs/dog-plush-fill.js: for each such
// cell, how high the plush's lowest fur is and its color. The rig (src/rigs.js) builds a solid,
// kit-built core there (never a smear of the scan), shaded darker toward the mat, which shows
// only through the gaps, as Sharpness B's fruit cores do.
//
//   npx splat-transform <the dog plush's source meta.json, tools/assets.json> .cache/fx9/dog.ply
//   node tools/fx9-dog-fill.mjs [.cache/fx9/dog.ply]

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const src = process.argv[2] || path.join(root, ".cache/fx9/dog.ply");

// Reads a binary little-endian PLY of floats (as splat-transform writes it).
function readPly(file) {
  const buf = fs.readFileSync(file);
  const end = buf.indexOf("end_header\n") + 11;
  const head = buf.subarray(0, end).toString();
  const count = Number(/element vertex (\d+)/.exec(head)[1]);
  const props = [...head.matchAll(/property float (\w+)/g)].map((m) => m[1]);
  const f = new Float32Array(buf.buffer.slice(buf.byteOffset + end, buf.byteOffset + end + count * props.length * 4)); // prettier-ignore
  const col = (n) => {
    const k = props.indexOf(n);
    return (i) => f[i * props.length + k];
  };
  return { count, col };
}

// The source's frame to the toy's world (fitted against the loaded toy's centers: the same
// rotation, centering and scale tools/pr2-prepare.mjs gave it).
const S = 0.28591;
const toWorld = (x, y, z) => [S * x + 0.0093, -S * y - 0.30194, -S * z - 0.06063];
const MAT = -0.26; // the mat's top
const G = 0.03; // the grid
const X0 = -1.05;
const N = 70;

const ply = readPly(src);
const [px, py, pz, po] = ["x", "y", "z", "opacity"].map(ply.col);
const dc = ["f_dc_0", "f_dc_1", "f_dc_2"].map(ply.col);
const lo = new Float32Array(N * N).fill(9);
const mat = new Uint16Array(N * N);
const pts = [];
for (let i = 0; i < ply.count; i++) {
  if (1 / (1 + Math.exp(-po(i))) < 0.3) continue;
  const [x, y, z] = toWorld(px(i), py(i), pz(i));
  const a = Math.floor((x - X0) / G);
  const b = Math.floor((z - X0) / G);
  if (a < 0 || b < 0 || a >= N || b >= N) continue;
  const c = a * N + b;
  if (Math.abs(y + 0.28) < 0.03) mat[c]++;
  else if (y > MAT + 0.015) {
    lo[c] = Math.min(lo[c], y);
    pts.push([c, y, dc.map((d) => Math.min(1, Math.max(0, 0.5 + 0.28209479 * d(i))))]);
  }
}
// Each cell's color: the plush's lowest fur there (within 0.04 of its bottom).
const sum = new Float32Array(N * N * 4);
for (const [c, y, rgb] of pts) {
  if (y > lo[c] + 0.04) continue;
  for (let k = 0; k < 3; k++) sum[c * 4 + k] += rgb[k];
  sum[c * 4 + 3]++;
}
const cells = [];
for (let a = 0; a < N; a++)
  for (let b = 0; b < N; b++) {
    const c = a * N + b;
    if (lo[c] > 5 || mat[c] >= 3) continue;
    const n = sum[c * 4 + 3];
    const hex = [0, 1, 2].map((k) => Math.round((255 * sum[c * 4 + k]) / n).toString(16).padStart(2, "0")).join(""); // prettier-ignore
    const top = Math.min(0.3, lo[c] - MAT);
    cells.push(`${a},${b},${Math.round(top * 100)},${hex}`);
  }
const out = `// Lane Fix9: the dog plush's hidden core, from tools/fx9-dog-fill.mjs (generated; do not edit).
// Grid cells (x index, z index, height above the mat in hundredths, color) where the plush
// stands over no captured mat.
export const DOG_FILL = {
  grid: ${G},
  x0: ${X0},
  mat: ${MAT},
  cells: "${cells.join(";")}",
};
`;
fs.writeFileSync(path.join(root, "src/packs/dog-plush-fill.js"), out);
console.log(`${cells.length} cells`);

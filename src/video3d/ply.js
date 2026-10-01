// Video to 3D (lane Video 3D): a trained 3D Gaussian splat PLY (the INRIA layout Splat.js writes:
// x y z, f_dc_0..2, f_rest_*, opacity, scale_0..2, rot_0..3) as plain arrays the kit can build
// from. The PLY is read by the site's own reader (src/loaders.js); nothing here parses bytes.

import { readPlyHeader, decimatePly } from "../loaders.js";

const SH_C0 = 0.28209479177387814;
const sigmoid = (v) => 1 / (1 + Math.exp(-v));
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// bytes: Uint8Array of a binary little-endian PLY. keep: the most splats to keep (a seeded random
// subset past it, the brightest-first order does not matter to the kit). Returns
// { count, pos, scales, quat, color, opacity }: positions and linear sizes in the PLY's own units,
// rotations as [x, y, z, w], colors 0..1 from the degree-0 harmonics, opacity 0..1.
export function readSplatPly(bytes, keep = Infinity) {
  const header = readPlyHeader(bytes);
  if (!header || !header.vertex) throw new Error("That file is not a splat PLY.");
  const need = ["x", "y", "z", "f_dc_0", "f_dc_1", "f_dc_2", "opacity"];
  need.push("scale_0", "scale_1", "scale_2", "rot_0", "rot_1", "rot_2", "rot_3");
  const names = header.vertex.props.map((p) => p.name);
  const missing = need.filter((n) => !names.includes(n));
  if (missing.length) throw new Error(`That PLY has no ${missing.join(", ")}: it is not a splat.`);
  const all = header.count <= keep;
  const table = decimatePly(bytes, header, all ? header.count : keep, 7);
  const col = Object.fromEntries(table.props.map((p) => [p.name, p.storage]));
  const n = table.count;
  const out = {
    count: n,
    pos: new Float32Array(n * 3),
    scales: new Float32Array(n * 3),
    quat: new Float32Array(n * 4),
    color: new Float32Array(n * 3),
    opacity: new Float32Array(n),
  };
  for (let i = 0; i < n; i++) {
    out.pos[i * 3] = col.x[i];
    out.pos[i * 3 + 1] = col.y[i];
    out.pos[i * 3 + 2] = col.z[i];
    out.scales[i * 3] = Math.exp(col.scale_0[i]);
    out.scales[i * 3 + 1] = Math.exp(col.scale_1[i]);
    out.scales[i * 3 + 2] = Math.exp(col.scale_2[i]);
    // rot_0 is w.
    let w = col.rot_0[i];
    let x = col.rot_1[i];
    let y = col.rot_2[i];
    let z = col.rot_3[i];
    const l = Math.hypot(w, x, y, z);
    if (l < 1e-8) [x, y, z, w] = [0, 0, 0, 1];
    else [x, y, z, w] = [x / l, y / l, z / l, w / l];
    out.quat.set([x, y, z, w], i * 4);
    out.color[i * 3] = clamp01(0.5 + SH_C0 * col.f_dc_0[i]);
    out.color[i * 3 + 1] = clamp01(0.5 + SH_C0 * col.f_dc_1[i]);
    out.color[i * 3 + 2] = clamp01(0.5 + SH_C0 * col.f_dc_2[i]);
    out.opacity[i] = sigmoid(col.opacity[i]);
  }
  return out;
}

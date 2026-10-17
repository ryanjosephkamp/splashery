// Adapter around the existing converter, which is a CLI module with top-level execution.
// Each import runs in its own child, with an independent argv and a hard deadline.
import fs from "node:fs/promises";
import path from "node:path";
import { parseModel } from "../../src/packs/studio-models-core.js";
export async function geometry(file) {
  const raw = parseModel(new Uint8Array(await fs.readFile(file)), path.basename(file));
  const lo = [Infinity, Infinity, Infinity],
    hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < raw.pos.length; i++) {
    const k = i % 3;
    lo[k] = Math.min(lo[k], raw.pos[i]);
    hi[k] = Math.max(hi[k], raw.pos[i]);
  }
  const center = lo.map((v, k) => (v + hi[k]) / 2);
  const radius = Math.hypot(...lo.map((v, k) => hi[k] - v)) / 2;
  if (!(radius > 0)) throw new Error(`Degenerate geometry: ${file}`);
  let area = 0;
  for (let i = 0; i < raw.idx.length; i += 3) {
    const [a, b, c] = Array.from(raw.idx.subarray(i, i + 3), (j) =>
      Array.from(raw.pos.subarray(j * 3, j * 3 + 3)),
    );
    const u = b.map((v, k) => v - a[k]),
      v = c.map((x, k) => x - a[k]);
    area +=
      Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) /
      2;
  }
  return { center, radius, area };
}
export function alignPly(bytes, from, to) {
  const end = bytes.indexOf("end_header\n") + 11;
  if (end < 11) throw new Error("Invalid PLY header");
  const header = bytes.subarray(0, end).toString();
  const properties = [...header.matchAll(/^property float (\w+)$/gm)].map((m) => m[1]);
  const count = Number(header.match(/element vertex (\d+)/)?.[1]);
  const stride = properties.length * 4;
  if (!header.includes("format binary_little_endian 1.0") || bytes.length !== end + count * stride)
    throw new Error("Unexpected converter PLY format");
  const ratio = from.radius / to.radius;
  for (let i = 0; i < count; i++) {
    for (const [k, name] of ["x", "y", "z"].entries()) {
      const at = end + i * stride + properties.indexOf(name) * 4;
      bytes.writeFloatLE(
        (bytes.readFloatLE(at) * from.radius + from.center[k] - to.center[k]) / to.radius,
        at,
      );
    }
    for (const name of ["scale_0", "scale_1", "scale_2"]) {
      const at = end + i * stride + properties.indexOf(name) * 4;
      bytes.writeFloatLE(bytes.readFloatLE(at) + Math.log(ratio), at);
    }
  }
  return bytes;
}

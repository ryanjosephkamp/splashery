import { SplatBuffer } from "../generators.js";
import { readSplatFile, readSog, emptyTable, SH_C0, extOf } from "../viewers/splat-io.js";
import { getWebp } from "../viewers/engine.js";
import { readKsplat } from "./ksplat.js";
import { checkCount, checkPly, checkSog, checkSpz, unpackSog } from "./file-limits.js";

export async function readPlace(bytes, name, { axes = "ply", files } = {}) {
  const ext = name.toLowerCase().endsWith(".json") ? "json" : extOf(name);
  if (ext === "ply") checkPly(bytes);
  if (ext === "spz") await checkSpz(bytes);
  if (ext === "splat") checkCount(Math.floor(bytes.length / 32));
  let buffer;
  if (["sog", "zip", "json"].includes(ext)) {
    const all =
      ext === "json" ? new Map([["meta.json", bytes], ...(files || [])]) : await unpackSog(bytes);
    checkSog(all);
    buffer = fromTable(readSog(all, await getWebp()));
  } else
    buffer =
      ext === "ksplat"
        ? readKsplat(bytes)
        : fromTable(await readSplatFile(bytes, name, { getWebp }));
  if (!buffer.count || buffer.count > 5e6)
    throw new Error(
      "Open a place with at most five million splats. Crop or shrink larger files in Splat toolkit first.",
    );
  if (axes !== "y-up") {
    // Same PLY right/down/forward convention used by the existing viewer.
    for (let i = 0; i < buffer.count; i++) {
      const j = i * 3,
        k = i * 4;
      buffer.pos[j + 1] *= -1;
      buffer.pos[j + 2] *= -1;
      const [x, y, z, w] = buffer.rot.subarray(k, k + 4);
      buffer.rot.set([w, -z, y, -x], k); // rotate 180 degrees around X
    }
  }
  return buffer;
}

export function fromTable(t) {
  if (t.count > 5e6) throw new Error("This file exceeds five million splats. Open a lighter copy.");
  const out = new SplatBuffer(t.count);
  out.count = t.count;
  const clamp = (x) => Math.max(0, Math.min(1, x));
  for (let i = 0; i < t.count; i++) {
    const j = i * 3,
      k = i * 4;
    out.pos.set([t.x[i], t.y[i], t.z[i]], j);
    out.scale.set([Math.exp(t.s0[i]), Math.exp(t.s1[i]), Math.exp(t.s2[i])], j);
    out.rot.set([t.qx[i], t.qy[i], t.qz[i], t.qw[i]], k);
    out.color.set(
      [
        clamp(0.5 + SH_C0 * t.r[i]),
        clamp(0.5 + SH_C0 * t.g[i]),
        clamp(0.5 + SH_C0 * t.b[i]),
        1 / (1 + Math.exp(-t.opacity[i])),
      ],
      k,
    );
  }
  return out;
}

export function tableFromBuffer(b) {
  const t = emptyTable(b.count);
  for (let i = 0; i < b.count; i++) {
    const j = i * 3,
      k = i * 4;
    t.x[i] = b.pos[j];
    t.y[i] = b.pos[j + 1];
    t.z[i] = b.pos[j + 2];
    t.s0[i] = Math.log(b.scale[j]);
    t.s1[i] = Math.log(b.scale[j + 1]);
    t.s2[i] = Math.log(b.scale[j + 2]);
    t.qx[i] = b.rot[k];
    t.qy[i] = b.rot[k + 1];
    t.qz[i] = b.rot[k + 2];
    t.qw[i] = b.rot[k + 3];
    t.r[i] = (b.color[k] - 0.5) / SH_C0;
    t.g[i] = (b.color[k + 1] - 0.5) / SH_C0;
    t.b[i] = (b.color[k + 2] - 0.5) / SH_C0;
    const a = Math.max(1e-6, Math.min(1 - 1e-6, b.color[k + 3]));
    t.opacity[i] = Math.log(a / (1 - a));
  }
  return t;
}

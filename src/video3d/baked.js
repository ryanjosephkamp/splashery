// Adapt the shared BKD1 loader to the same scene arrays as an uploaded PLY. Coordinates and
// camera intrinsics stay in the original training frame; quantization changes no camera poses.
import { loadBaked, splatAt } from "../baked.js";

export async function readBakedScene(url, budget = 400000) {
  const asset = await loadBaked(url, { budget });
  const out = {
    count: asset.n,
    pos: new Float32Array(asset.n * 3),
    scales: new Float32Array(asset.n * 3),
    quat: new Float32Array(asset.n * 4),
    color: new Float32Array(asset.n * 3),
    opacity: new Float32Array(asset.n),
  };
  let s;
  for (let i = 0; i < asset.n; i++) {
    s = splatAt(asset, i, s);
    out.pos.set(s.p, i * 3);
    out.scales.set(
      s.scales.map((v) => v * asset.grow),
      i * 3,
    );
    out.quat.set(s.quat, i * 4);
    out.color.set(s.color, i * 3);
    out.opacity[i] = s.opacity;
  }
  return out;
}

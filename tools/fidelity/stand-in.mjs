#!/usr/bin/env node
// Lane Fidelity: a stand-in for a trained splat, for testing the pipeline without a trainer.
// Turns a dataset's points3d.ply (surface points with colors, from tools/fidelity/orrery.py) into
// a 3DGS PLY of small round splats in the same world frame, as a trainer would write it. It looks
// nothing like a trained splat; it only checks the frame, the conversion and the toy's parts.
//
//   node tools/fidelity/stand-in.mjs <points3d.ply> <out.ply> [--size=0.003] [--opacity=0.95]

import fs from "node:fs";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? Number(a.slice(name.length + 3)) : def;
};
const [input, out] = args.filter((a) => !a.startsWith("--"));
if (!input || !out)
  throw new Error("Usage: node tools/fidelity/stand-in.mjs <points3d.ply> <out.ply>");
const size = opt("size", 0.003);
const opacity = opt("opacity", 0.95);

const text = fs.readFileSync(input, "utf8");
const end = text.indexOf("end_header\n");
const rows = text
  .slice(end + 11)
  .trim()
  .split("\n")
  .map((l) => l.split(" ").map(Number));
const SH_C0 = 0.28209479177387814;
const props = ["x", "y", "z", "f_dc_0", "f_dc_1", "f_dc_2", "opacity"];
props.push("scale_0", "scale_1", "scale_2", "rot_0", "rot_1", "rot_2", "rot_3");
const head =
  `ply\nformat binary_little_endian 1.0\nelement vertex ${rows.length}\n` +
  props.map((p) => `property float ${p}\n`).join("") +
  "end_header\n";
const data = new Float32Array(rows.length * props.length);
const logit = Math.log(opacity / (1 - opacity));
rows.forEach((r, i) => {
  const o = i * props.length;
  data.set([r[0], r[1], r[2]], o);
  for (let k = 0; k < 3; k++) data[o + 3 + k] = (r[3 + k] / 255 - 0.5) / SH_C0;
  data[o + 6] = logit;
  data.set([Math.log(size), Math.log(size), Math.log(size), 1, 0, 0, 0], o + 7);
});
fs.writeFileSync(out, Buffer.concat([Buffer.from(head), Buffer.from(data.buffer)]));
console.log(`${rows.length} splats: ${out}`);

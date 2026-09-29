#!/usr/bin/env node
// Turns a 3D model file (glTF 2.0 .glb or .gltf, OBJ with its MTL, STL) into a splat PLY the
// kit and tools/prepare-assets.mjs can use (the same format tools/mesh-to-splats.mjs writes).
// It is the same conversion as the "Model to splats" toy (src/packs/studio-models-core.js),
// so a model looks here as it does in the browser.
//
//   node tools/model-to-splats.mjs path/to/model.glb
//   node tools/model-to-splats.mjs model.obj --id my-model --splats 250000 --up z
//
// Options: --id NAME (output name; default the file's), --splats N (default 200000),
// --up auto|y|z (which axis is up; auto is Z for STL, Y for the rest), --seed N, --no-light
// (leave out the soft light baked into the colors), --out FILE (default
// .cache/models/<id>/<id>.ply). Files that come with the model (a .gltf's .bin and textures,
// an .obj's .mtl and pictures) are read from its folder, and from a "textures" or "Textures"
// folder beside it. The model is turned upright, centered and scaled to a sphere of radius 1.
//
// To make a toy from a CC0 model: run this, add the PLY's id to tools/assets.json like the
// other scans (see "Models to splats" in docs/PACKS.md), then `node tools/prepare-assets.mjs`.
// Build-time only: pngjs (MIT) and jpeg-js (BSD-3-Clause) are devDependencies.

import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";
import { parseModel, prepareModel, sampleSurface, SPLAT_OPACITY, SPLAT_FLAT } from "../src/packs/studio-models-core.js"; // prettier-ignore

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : def;
};
const flag = (name) => args.includes(`--${name}`);
const valueFlags = new Set(["id", "splats", "up", "seed", "out"]);
const file = args.find(
  (a, i) => !a.startsWith("--") && !valueFlags.has((args[i - 1] || "").slice(2)),
);
if (!file) {
  console.error("Usage: node tools/model-to-splats.mjs <model.glb|.gltf|.obj|.stl> [--id name] [--splats N] [--up auto|y|z] [--seed N] [--no-light] [--out file.ply]"); // prettier-ignore
  process.exit(1);
}
const SH_C0 = 0.28209479177387814;

function decodeImage(bytes, mime) {
  if (mime === "image/png" || (bytes[0] === 0x89 && bytes[1] === 0x50)) {
    const p = PNG.sync.read(Buffer.from(bytes));
    return { w: p.width, h: p.height, data: new Uint8Array(p.data) };
  }
  const j = jpeg.decode(Buffer.from(bytes), { useTArray: true, maxMemoryUsageInMB: 1024 });
  return { w: j.width, h: j.height, data: j.data };
}

// Quaternion (w, x, y, z) turning +Z onto n.
function discQuat(n) {
  if (n[2] < -0.9999) return [0, 1, 0, 0];
  const w = 1 + n[2];
  const l = Math.hypot(w, n[1], n[0]);
  return [w / l, -n[1] / l, n[0] / l, 0];
}

const dir = path.dirname(path.resolve(file));
const files = {};
for (const sub of ["", "textures", "Textures", "../textures", "../Textures"]) {
  const d = path.join(dir, sub);
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isFile() && !(f in files)) files[f] = new Uint8Array(fs.readFileSync(p));
  }
}
const id = opt("id", path.basename(file).replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_-]+/g, "-").toLowerCase()); // prettier-ignore
const count = Number(opt("splats", 200000));
const raw = parseModel(new Uint8Array(fs.readFileSync(file)), path.basename(file), { files });
const prep = await prepareModel(raw, { decodeImage });
const s = sampleSurface(prep, count, {
  seed: Number(opt("seed", 1)),
  up: opt("up", "auto"),
  light: !flag("no-light"),
});
const props = ["x", "y", "z", "nx", "ny", "nz", "f_dc_0", "f_dc_1", "f_dc_2", "opacity", "scale_0", "scale_1", "scale_2", "rot_0", "rot_1", "rot_2", "rot_3"]; // prettier-ignore
const data = new Float32Array(s.n * props.length);
const logit = (a) => Math.log(a / (1 - a));
for (let i = 0; i < s.n; i++) {
  const n = [s.nrm[i * 3], s.nrm[i * 3 + 1], s.nrm[i * 3 + 2]];
  const sg = s.sigma[i];
  const q = discQuat(n);
  data.set(
    [
      s.pos[i * 3], s.pos[i * 3 + 1], s.pos[i * 3 + 2], n[0], n[1], n[2],
      (s.rgb[i * 3] - 0.5) / SH_C0, (s.rgb[i * 3 + 1] - 0.5) / SH_C0, (s.rgb[i * 3 + 2] - 0.5) / SH_C0,
      logit(SPLAT_OPACITY), Math.log(sg), Math.log(sg), Math.log(sg * SPLAT_FLAT),
      q[0], q[1], q[2], q[3],
    ],
    i * props.length,
  ); // prettier-ignore
}
const head = `ply\nformat binary_little_endian 1.0\nelement vertex ${s.n}\n${props.map((p) => `property float ${p}`).join("\n")}\nend_header\n`; // prettier-ignore
const outFile = path.resolve(opt("out", path.join(root, ".cache/models", id, `${id}.ply`)));
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, Buffer.concat([Buffer.from(head), Buffer.from(data.buffer)]));
for (const n of prep.notes) console.log(`note: ${n}`);
console.log(`${id}: ${prep.triangles} triangles, ${s.n} splats -> ${path.relative(root, outFile)}`);

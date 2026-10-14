#!/usr/bin/env node
// Quantize a candidate with the production converter and decode the actual payload for scoring.
// <scratch> <id> <bake-name>. Render and score <bake-name>-packed with the independent ruler.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { convert } from "./port-convert.mjs";
import { readBakedScene } from "../src/video3d/baked.js";
import { gaussiansToPly } from "../vendor/splatjs/src/io/ply.js";
const [scratch, id, name] = process.argv.slice(2);
if (!name) throw new Error("Supply scratch, sample ID, and bake name.");
const folder = path.resolve(scratch, id),
  out = path.join(folder, `${name}-packed`);
const input = path.join(folder, `${name}.ply`),
  meta = JSON.parse(fs.readFileSync(path.join(folder, `${name}.json`)));
const manifest = convert([input], {
  out,
  id: `${id}-${name}`,
  up: "y",
  gzip: true,
  tiers: [],
  default: meta.stats.exportedSplats,
});
if (manifest.source.splats !== meta.stats.exportedSplats)
  throw new Error(
    "Metadata count differs from the actual source PLY; never score a thinned export.",
  );
const scene = await readBakedScene(
  pathToFileURL(path.join(out, "manifest.json")),
  meta.stats.exportedSplats,
);
if (scene.count !== meta.stats.exportedSplats)
  throw new Error("Packed model was unexpectedly thinned.");
const data = new Float32Array(scene.count * 16);
const logit = (v) => Math.log(Math.max(1e-6, v) / Math.max(1e-6, 1 - v));
for (let i = 0; i < scene.count; i++) {
  const p = i * 3,
    q = i * 4;
  data.set(
    [
      ...scene.pos.subarray(p, p + 3),
      ...Array.from(scene.scales.subarray(p, p + 3), Math.log),
      scene.quat[q + 3],
      ...scene.quat.subarray(q, q + 3),
      ...Array.from(scene.color.subarray(p, p + 3), logit),
      logit(scene.opacity[i]),
      0,
      0,
    ],
    i * 16,
  );
}
const ply = new Uint8Array(
  await gaussiansToPly(data, scene.count, null, 0, "sigmoid").arrayBuffer(),
);
const hash = (b) => createHash("sha256").update(b).digest("hex");
meta.packing = {
  sourcePlySha256: hash(fs.readFileSync(input)),
  decodedPlySha256: hash(ply),
  manifestSha256: hash(fs.readFileSync(path.join(out, "manifest.json"))),
  files: manifest.tiers.at(-1).files,
  splats: scene.count,
  bytes: manifest.tiers.at(-1).bytes,
  grow: 1,
};
fs.writeFileSync(path.join(folder, `${name}-packed.ply`), ply);
fs.writeFileSync(path.join(folder, `${name}-packed.json`), JSON.stringify(meta, null, 2) + "\n");
console.log(JSON.stringify({ id, name, ...meta.packing }));

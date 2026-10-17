// Isolated CPU diagnostic; actual phone timing still comes from paired.mjs.
import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { textureFrame } from "../../../src/qr-craft/frame.js";
import { textureFrame as referenceFrame } from "./frame-reference.mjs";
const fixtures = [37, 69].flatMap((n) =>
  ["square", "circle"].map((shape) => ({
    shape,
    w: {
      code: { size: n },
      k: 3,
      G: n * 3,
      cells: Float32Array.from({ length: n * n * 27 }, (_, i) => ((i * 131) % 65521) / 65521),
      rendering: { texture: "tiles" },
    },
    pic: {
      w: 41,
      h: 73,
      data: Float32Array.from({ length: 41 * 73 * 3 }, (_, i) => ((i * 71) % 997) / 997),
    },
  })),
);
for (const f of fixtures)
  assert.deepEqual(textureFrame(f.w, f.pic, f.shape), referenceFrame(f.w, f.pic, f.shape));
const run = (render) => {
  const start = performance.now();
  for (const f of fixtures) render(f.w, f.pic, f.shape);
  return performance.now() - start;
};
for (let i = 0; i < 3; i++) {
  run(textureFrame);
  run(referenceFrame);
}
const current = [],
  reference = [];
for (let i = 0; i < 9; i++) {
  if (i % 2) {
    current.push(run(textureFrame));
    reference.push(run(referenceFrame));
  } else {
    reference.push(run(referenceFrame));
    current.push(run(textureFrame));
  }
}
const median = (values) => values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)];
const result = {
  node: process.version,
  fixtures: fixtures.map((f) => `${f.w.code.size}/${f.shape}/720`),
  current,
  reference,
  medianCurrentMs: median(current),
  medianReferenceMs: median(reference),
  ratio: median(current) / median(reference),
  hashes: Object.fromEntries(
    ["src/qr-craft/frame.js", "tools/picture-qr-fidelity/research/frame-reference.mjs"].map(
      (file) => [file, createHash("sha256").update(fs.readFileSync(file)).digest("hex")],
    ),
  ),
};
console.log(JSON.stringify(result, null, 2));
if (process.argv.includes("--assert"))
  assert.ok(
    result.ratio < 0.85,
    "Prediction sampler must be at least 15% faster than its locked byte reference",
  );

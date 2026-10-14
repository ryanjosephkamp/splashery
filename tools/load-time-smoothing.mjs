// Bake the original full-scan smoothing means as exact doubles. The low
// tier can then omit unrendered records without changing its shaded colors.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { decodeSplats } from "../src/scan-format.js";

export function smoothingPrefix(bytes, capacity, cell = 0.012) {
  const scan = decodeSplats(bytes);
  const sums = new Map();
  const key = (i) =>
    `${Math.floor(scan.pos[i * 3] / cell)},${Math.floor(scan.pos[i * 3 + 1] / cell)},${Math.floor(scan.pos[i * 3 + 2] / cell)},${scan.part[i]}`;
  for (let i = 0; i < scan.n; i++) {
    const k = key(i);
    let sum = sums.get(k);
    if (!sum) sums.set(k, (sum = [0, 0, 0, 0]));
    for (let c = 0; c < 3; c++) sum[c] += scan.rgb[i * 3 + c];
    sum[3]++;
  }
  const raw = Buffer.concat([
    bytes.subarray(0, 44),
    Buffer.alloc(12),
    bytes.subarray(44, 44 + capacity * 14),
    Buffer.alloc(capacity * 24),
  ]);
  raw.write("ROP2");
  raw.writeUInt32LE(capacity, 44);
  raw.writeDoubleLE(cell, 48);
  for (let i = 0; i < capacity; i++) {
    const sum = sums.get(key(i));
    for (let c = 0; c < 3; c++)
      raw.writeDoubleLE(sum[c] / sum[3], 56 + capacity * 14 + (i * 3 + c) * 8);
  }
  return raw;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const models = JSON.parse(fs.readFileSync("tools/models.json")).models;
  const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
  const records = [];
  for (const id of ["celestial-globe", "armillary-sphere", "stannern-meteorites", "pyrite-cubes"]) {
    const model = models.find((m) => m.id === id);
    const source = `assets/toys/${id}/${id}.splats`;
    const file = `assets/toys/${id}/${id}-opening.splats.gz`;
    const bytes = fs.readFileSync(source),
      capacity = Math.floor(90000 * 0.86);
    const raw = smoothingPrefix(bytes, capacity),
      compressed = gzipSync(raw, { level: 9 });
    fs.writeFileSync(file, compressed);
    const scan = decodeSplats(raw);
    records.push({
      id,
      budget: 90000,
      capacity,
      originalCount: scan.n,
      source,
      file,
      sourceSha256: sha(bytes),
      rawSha256: sha(raw),
      sha256: sha(compressed),
      beforeBytes: bytes.length,
      afterBytes: compressed.length,
      rawBytes: raw.length,
      meanCell: scan.meanCell,
      meanPrecision: "IEEE 754 Float64; no rounding to Float32",
      credit: {
        author: model.author,
        license: model.license,
        url: model.page,
        checked: id === "pyrite-cubes" ? "October 14, 2026" : "October 13, 2026",
        nc: model.nc === true,
        inheritedFrom: "tools/models.json and the toy's in-app credit",
        transformation:
          "Exact record prefix plus the original per-cell mean colors, gzip compressed; made by Ryan with Codex (GPT-6).",
      },
    });
  }
  fs.writeFileSync(
    "docs/audits/load-time-2026-10/smoothing-prefix.json",
    JSON.stringify(records[0], null, 2) + "\n",
  );
  fs.writeFileSync(
    "docs/audits/load-time-2026-10/museum-prefixes.json",
    JSON.stringify(records.slice(1), null, 2) + "\n",
  );
  console.log(records.map(({ id, beforeBytes, afterBytes }) => ({ id, beforeBytes, afterBytes })));
}

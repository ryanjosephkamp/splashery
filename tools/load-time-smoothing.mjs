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
  const source = "assets/toys/celestial-globe/celestial-globe.splats";
  const file = "assets/toys/celestial-globe/celestial-globe-opening.splats.gz";
  const bytes = fs.readFileSync(source),
    capacity = Math.floor(90000 * 0.86);
  const raw = smoothingPrefix(bytes, capacity),
    compressed = gzipSync(raw, { level: 9 });
  const scan = decodeSplats(raw);
  const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
  fs.writeFileSync(file, compressed);
  const receipt = {
    id: "celestial-globe",
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
      author: "Virtual Museums of Małopolska",
      license: "CC0 1.0",
      url: "https://sketchfab.com/3d-models/celestial-globe-341fa8a777e94883841409438756f747",
      checked: "October 13, 2026",
      inheritedFrom: "tools/models.json and the toy's in-app credit",
      transformation:
        "Exact record prefix plus the original per-cell mean colors, gzip compressed; made by Ryan with Codex (GPT-6).",
    },
  };
  fs.writeFileSync(
    "docs/audits/load-time-2026-10/smoothing-prefix.json",
    JSON.stringify(receipt, null, 2) + "\n",
  );
  console.log(
    `${source}: ${bytes.length} -> ${compressed.length} bytes, ${capacity} exact records and exact smoothing means`,
  );
}

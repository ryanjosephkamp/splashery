#!/usr/bin/env node
// Export a frozen CPU checkpoint as a warm start, preserving its actual iteration and poses.
// <scratch> <id> <checkpoint.bin> <output-name> <steps> <camera-ledger.json> <trainer-sha256>
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { gaussiansToPly } from "../vendor/splatjs/src/io/ply.js";
const [scratch, id, input, output, stepText, cameraFile, trainerSha256] = process.argv.slice(2);
const steps = Number(stepText);
if (!/^[a-f0-9]{64}$/.test(trainerSha256 || "") || !Number.isInteger(steps) || steps < 1)
  throw new Error("Supply a frozen checkpoint, its actual step, camera ledger, and trainer hash.");
const folder = path.resolve(scratch, id),
  bin = fs.readFileSync(input),
  n = bin.readUInt32LE();
if (bin.length !== 4 + n * 64) throw new Error("Incomplete checkpoint.");
const data = new Float32Array(n * 16);
for (let i = 0; i < data.length; i++) data[i] = bin.readFloatLE(4 + i * 4);
if (data.some((v) => !Number.isFinite(v))) throw new Error("Nonfinite checkpoint.");
const meta = JSON.parse(fs.readFileSync(cameraFile));
const ply = new Uint8Array(await gaussiansToPly(data, n, null, 0, "sigmoid").arrayBuffer());
const hash = (b) => createHash("sha256").update(b).digest("hex");
meta.stats = {
  ...meta.stats,
  adapter: "CPU/OpenMP",
  iters: (meta.stats?.iters || 0) + steps,
  splats: n,
  exportedSplats: n,
  plyBytes: ply.length,
};
meta.checkpoint = {
  actualSteps: steps,
  inputSha256: hash(bin),
  cameraSha256: hash(fs.readFileSync(cameraFile)),
  trainerSha256,
};
for (const ext of [".ply", ".json"])
  if (fs.existsSync(path.join(folder, output + ext)))
    throw new Error("Refusing to overwrite a warm start.");
fs.writeFileSync(path.join(folder, output + ".ply"), ply);
fs.writeFileSync(path.join(folder, output + ".json"), JSON.stringify(meta, null, 2) + "\n");
console.log(JSON.stringify({ id, steps, n, sha256: hash(ply) }));

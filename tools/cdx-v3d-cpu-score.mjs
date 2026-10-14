#!/usr/bin/env node
// Fast checkpoint measurements. Final acceptance also uses the independent Splat.js ruler.
// <scratch> <id> <model.bin> <label> [--dataset=<camera-input.bin>]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { PNG } from "pngjs";
import { createHash } from "node:crypto";
import { imageMetrics, meetsClarityGoal } from "./cdx-v3d-clarity-metrics.mjs";
const [scratch, id, model, label, ...args] = process.argv.slice(2);
const folder = path.resolve(scratch, id),
  dataset =
    args.find((a) => a.startsWith("--dataset="))?.slice(10) ||
    path.join(folder, "cpu-r1-cameras.bin");
const executable = path.resolve(scratch, "cpu-score");
if (!fs.existsSync(executable))
  execFileSync("g++", [
    "-O3",
    "-ffp-contract=off",
    "-std=c++17",
    "-fopenmp",
    path.resolve(import.meta.dirname, "cdx-v3d-cpu-train.cpp"),
    "-o",
    executable,
  ]);
const snapshot = fs.readFileSync(model);
if (snapshot.length !== 4 + snapshot.readUInt32LE() * 64)
  throw new Error("Checkpoint is incomplete.");
const frozen = path.join(folder, `${label}-score-input.bin`),
  output = path.join(folder, `${label}-score.bin`);
fs.writeFileSync(frozen, snapshot);
execFileSync(executable, [frozen, dataset, output, "0", "2000000", "60"], { stdio: "inherit" });
const ledger = JSON.parse(fs.readFileSync(path.resolve(scratch, "ledger.json"))),
  record = ledger.samples.find((s) => s.id === id);
const meta = JSON.parse(fs.readFileSync(path.join(folder, "main.json"))),
  frames = [];
for (const index of record.heldOut) {
  const b = fs.readFileSync(`${output}-${index}.ppm`),
    offset = b.indexOf("\n255\n") + 5;
  const [width, height] = b.subarray(0, offset).toString().split("\n")[1].split(" ").map(Number);
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    for (let k = 0; k < 3; k++) data[i * 4 + k] = b[offset + i * 3 + k];
    data[i * 4 + 3] = 255;
  }
  const image = { width, height, data };
  const score = imageMetrics(
    image,
    PNG.sync.read(fs.readFileSync(path.join(folder, "frames", meta.cams[index].frame))),
  );
  frames.push({ index, ...score });
  fs.writeFileSync(path.join(folder, `${label}-${index}.png`), PNG.sync.write(image));
}
const mean = Object.fromEntries(
  ["psnr", "ssim", "laplacian"].map((k) => [
    k,
    frames.reduce((s, f) => s + f[k], 0) / frames.length,
  ]),
);
const baseline = JSON.parse(
  fs.readFileSync(path.resolve(scratch, "main-scores.json")),
).results.find((s) => s.id === id).mean;
const result = {
  id,
  label,
  snapshotSha256: createHash("sha256").update(snapshot).digest("hex"),
  renderer: "CPU Gaussian checkpoint; final acceptance requires Splat.js and BKD1 checks",
  frames,
  mean,
  gain: { ssim: mean.ssim - baseline.ssim, sharpness: mean.laplacian / baseline.laplacian },
  goal: meetsClarityGoal(baseline, mean),
};
fs.writeFileSync(path.join(folder, `${label}-scores.json`), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ id, label, mean, gain: result.gain, goal: result.goal }));

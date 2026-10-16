#!/usr/bin/env node
// MIT. Build-only CPU Gaussian fitting on the frozen clarity inputs.
// cdx-v3d-cpu-bake.mjs <scratch> <id> [--steps=2000] [--splats=120000]
// [--seconds=3600] [--input=main] [--output=candidate]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { readPlyHeader, decimatePly } from "../src/loaders.js";
import { gaussiansToPly } from "../vendor/splatjs/src/io/ply.js";
import { sharpness } from "../src/video3d/frames.js";
import { SAMPLES } from "../src/video3d/samples.js";

const [scratchArg, id, ...args] = process.argv.slice(2);
if (!scratchArg || !id) throw new Error("Usage: cdx-v3d-cpu-bake.mjs <scratch> <id> [options]");
const value = (name, fallback) =>
  args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const scratch = path.resolve(scratchArg),
  folder = path.join(scratch, id);
const input = value("input", "main"),
  output = value("output", "candidate");
const steps = Number(value("steps", 2000)),
  seconds = Number(value("seconds", 3600));
const cap = Number(value("splats", 120000));
const rotations = value("rotations", "0") === "1";
const opaque = value("opaque", "0") === "1";
const side = Number(value("side", 960));
if (![640, 960].includes(side))
  throw new Error("Choose a 640px phone or 960px desktop training side.");
const hash = (b) => createHash("sha256").update(b).digest("hex");
for (const ext of [".ply", ".json"])
  if (fs.existsSync(path.join(folder, output + ext)))
    throw new Error("Refusing to overwrite a bake.");
const ledger = JSON.parse(fs.readFileSync(path.join(scratch, "ledger.json")));
const record = ledger.samples.find((s) => s.id === id);
if (!record) throw new Error("No frozen sample ledger.");
const inputPoseFile = path.join(folder, `${input}.json`);
const cameraFileOverride = value(
  "cameras",
  input !== "main" && fs.existsSync(inputPoseFile) ? inputPoseFile : "",
);
const frozenMeta = JSON.parse(fs.readFileSync(path.join(folder, "main.json")));
const meta = cameraFileOverride ? JSON.parse(fs.readFileSync(cameraFileOverride)) : frozenMeta;
if (
  meta.cams.length !== frozenMeta.cams.length ||
  meta.cams.some(
    (c, i) =>
      c.time !== frozenMeta.cams[i].time ||
      c.frameSha256 !== frozenMeta.cams[i].frameSha256 ||
      c.heldOut !== frozenMeta.cams[i].heldOut,
  )
)
  throw new Error(
    "A camera solve must preserve the frozen photographs, times, and evaluation split.",
  );
const bytes = new Uint8Array(fs.readFileSync(path.join(folder, `${input}.ply`)));
const header = readPlyHeader(bytes),
  table = decimatePly(bytes, header, Math.min(header.count, cap), 7);
if (table.count > cap) {
  table.count = cap;
  for (const property of table.props) property.storage = property.storage.subarray(0, cap);
}
const col = Object.fromEntries(table.props.map((p) => [p.name, p.storage]));
const floats = new Float32Array(table.count * 16);
const logit = (v) => {
  v = Math.max(1e-6, Math.min(1 - 1e-6, v));
  return Math.log(v / (1 - v));
};
for (let i = 0; i < table.count; i++)
  floats.set(
    [
      col.x[i],
      col.y[i],
      col.z[i],
      col.scale_0[i],
      col.scale_1[i],
      col.scale_2[i],
      col.rot_0[i],
      col.rot_1[i],
      col.rot_2[i],
      col.rot_3[i],
      ...[col.f_dc_0[i], col.f_dc_1[i], col.f_dc_2[i]].map((v) =>
        logit(0.5 + 0.28209479177387814 * v),
      ),
      col.opacity[i],
      0,
      0,
    ],
    i * 16,
  );
const count = Buffer.alloc(4);
count.writeUInt32LE(table.count);
fs.writeFileSync(
  path.join(folder, `${output}-input.bin`),
  Buffer.concat([count, Buffer.from(floats.buffer)]),
);
const cameras = [],
  frameScores = [];
const num = Buffer.alloc(4);
num.writeUInt32LE(meta.cams.length);
cameras.push(num);
const frames = meta.cams.map((c) => {
  const b = fs.readFileSync(path.join(folder, "frames", c.frame));
  if (hash(b) !== c.frameSha256) throw new Error("Changed frozen frame.");
  let png = PNG.sync.read(b);
  if (side !== 960) {
    const scaled = path.join(folder, `${output}-frames`);
    fs.mkdirSync(scaled, { recursive: true });
    const target = path.join(scaled, c.frame);
    const scale = side / Math.max(png.width, png.height);
    execFileSync("ffmpeg", [
      "-nostdin",
      "-v",
      "error",
      "-y",
      "-i",
      path.join(folder, "frames", c.frame),
      "-vf",
      `scale=${Math.round(png.width * scale)}:${Math.round(png.height * scale)}:flags=lanczos`,
      "-frames:v",
      "1",
      "-threads",
      "1",
      target,
    ]);
    png = PNG.sync.read(fs.readFileSync(target));
  }
  const gray = Float32Array.from(
    { length: png.width * png.height },
    (_, i) =>
      (0.299 * png.data[i * 4] + 0.587 * png.data[i * 4 + 1] + 0.114 * png.data[i * 4 + 2]) / 255,
  );
  const detail = sharpness(gray, png.width, png.height);
  frameScores.push(detail);
  return png;
});
const ordered = frameScores.filter((_, i) => !meta.cams[i].heldOut).sort((a, b) => a - b);
const median = ordered[Math.floor(ordered.length / 2)];
const excluded = [];
for (const [i, c] of meta.cams.entries()) {
  const png = frames[i],
    sx = png.width / c.w,
    sy = png.height / c.h;
  const held = c.heldOut || frameScores[i] < median * 0.45;
  if (held) excluded.push(i);
  const head = Buffer.alloc(19 * 4);
  [
    ...c.R,
    ...c.t,
    c.f * sx,
    (c.fy ?? c.f) * sy,
    (c.cx ?? c.w / 2) * sx,
    (c.cy ?? c.h / 2) * sy,
  ].forEach((v, k) => head.writeFloatLE(v, k * 4));
  head.writeUInt32LE(png.width, 64);
  head.writeUInt32LE(png.height, 68);
  head.writeUInt32LE(c.heldOut ? 1 : held ? 2 : 0, 72);
  const rgb = Buffer.alloc(png.width * png.height * 3);
  for (let p = 0; p < png.width * png.height; p++)
    for (let k = 0; k < 3; k++) rgb[p * 3 + k] = png.data[p * 4 + k];
  cameras.push(head, rgb);
}
const cameraFile = path.join(folder, `${output}-cameras.bin`);
fs.writeFileSync(cameraFile, Buffer.concat(cameras));
const trainerSource = path.resolve(import.meta.dirname, "cdx-v3d-cpu-train.cpp");
const trainerSha256 = hash(fs.readFileSync(trainerSource));
const executable = path.join(scratch, `cpu-train-${trainerSha256.slice(0, 12)}`);
if (!fs.existsSync(executable))
  execFileSync(
    "g++",
    ["-O3", "-ffp-contract=off", "-std=c++17", "-fopenmp", trainerSource, "-o", executable],
    { stdio: "inherit" },
  );
const sourceArchive = path.join(scratch, `cpu-train-${trainerSha256}.cpp`);
if (!fs.existsSync(sourceArchive)) fs.copyFileSync(trainerSource, sourceArchive);
const outBin = path.join(folder, `${output}.bin`);
const stopFile = path.join(folder, `${output}.stop`);
if (fs.existsSync(stopFile))
  throw new Error("Remove the previous goal stop request or choose a new output name.");
const started = Date.now();
const logFile = path.join(folder, `${output}-log.txt`);
const logFd = fs.openSync(logFile, "wx");
try {
  execFileSync(
    executable,
    [
      path.join(folder, `${output}-input.bin`),
      cameraFile,
      outBin,
      String(steps),
      String(cap),
      String(seconds),
      rotations ? "1" : "0",
      stopFile,
      opaque ? "1" : "0",
    ],
    { stdio: ["ignore", logFd, "inherit"] },
  );
} finally {
  fs.closeSync(logFd);
}
const log = fs.readFileSync(logFile, "utf8");
console.log(log);
const actual = Number(log.match(/complete steps (\d+)/)?.[1]);
let selectedStep = Number(log.match(/selected (\d+)/)?.[1]) || actual;
if (!/selected \d+/.test(log)) {
  let stepAtMetric = 0,
    best = -Infinity;
  for (const m of log.matchAll(/step (\d+)\/[^\n]*|heldout-PSNR ([\d.]+)/g)) {
    if (m[1]) stepAtMetric = Number(m[1]);
    else if (Number(m[2]) > best) {
      best = Number(m[2]);
      selectedStep = stepAtMetric;
    }
  }
}
const inputMetaFile = path.join(folder, `${input}.json`);
const initialIter = fs.existsSync(inputMetaFile)
  ? Number(JSON.parse(fs.readFileSync(inputMetaFile)).stats?.iters || 0)
  : 0;
const learned = fs.readFileSync(outBin),
  n = learned.readUInt32LE();
const data = new Float32Array(n * 16);
for (let i = 0; i < data.length; i++) data[i] = learned.readFloatLE(4 + i * 4);
const ply = new Uint8Array(await gaussiansToPly(data, n, null, 0, "sigmoid").arrayBuffer());
fs.writeFileSync(path.join(folder, `${output}.ply`), ply);
const exportCameras = meta.cams.map((c, i) => {
  const frame = frames[i],
    sx = frame.width / c.w,
    sy = frame.height / c.h;
  return {
    ...c,
    w: frame.width,
    h: frame.height,
    f: c.f * sx,
    fy: (c.fy ?? c.f) * sy,
    cx: (c.cx ?? c.w / 2) * sx,
    cy: (c.cy ?? c.h / 2) * sy,
  };
});
const metadata = {
  ...meta,
  continuation: {
    backend: "Codex CPU Gaussian fitter / OpenMP",
    initialIter,
    completedIterations: selectedStep,
    actualIteration: initialIter + selectedStep,
    runCompletedIterations: actual,
    trainSide: side,
    projectionError: Math.max(
      ...exportCameras.flatMap((c, i) => {
        const o = meta.cams[i];
        return [
          Math.abs(c.f / c.w - o.f / o.w),
          Math.abs(c.fy / c.h - (o.fy ?? o.f) / o.h),
          Math.abs(c.cx / c.w - (o.cx ?? o.w / 2) / o.w),
          Math.abs(c.cy / c.h - (o.cy ?? o.h / 2) / o.h),
        ];
      }),
    ),
    exportTrainingFrameSizes: exportCameras,
    sourceOrigin: {
      fullCaptureSha256: ["liberty", "edinburgh"].includes(id) ? null : record.sourceSha256,
      cutSha256: ["liberty", "edinburgh"].includes(id) ? record.sourceSha256 : null,
      span: SAMPLES.find((s) => s.id === id).span,
    },
  },
  exportCam0: exportCameras[0],
  exportCameras,
  stats: {
    ...meta.stats,
    tier: "offline-native",
    adapter: "CPU/OpenMP",
    frames: meta.cams.length,
    registered: meta.cams.length,
    points: meta.cameraSolve?.points ?? meta.stats?.points,
    splats: n,
    exportedSplats: n,
    iters: initialIter + selectedStep,
    trainSide: side,
    plyBytes: ply.length,
    stoppedEarly: actual < steps,
    psnr: null,
    psnrIteration: null,
    psnrTrainSide: null,
  },
  bake: {
    ...meta.bake,
    backend: "Codex CPU Gaussian fitter / OpenMP",
    inputSha256: record.sourceSha256,
    source: record,
    exportCam0: exportCameras[0],
    exportCameras,
    exportTrainSide: side,
    clarity: {
      main: ledger.main,
      ledgerSha256: hash(fs.readFileSync(path.join(scratch, "ledger.json"))),
      nativeFrameSide: 960,
      trainSide: side,
      fullFrame: true,
      requestedSteps: steps,
      completedSteps: actual,
      stopReason: /stop-request after/.test(log)
        ? "measured goal checkpoint requested"
        : actual < steps
          ? "time budget"
          : "requested iterations",
      selectedStep,
      seconds: (Date.now() - started) / 1000,
      inputCount: table.count,
      outputCount: n,
      heldOut: record.heldOut,
      excluded,
      trainerSha256,
      warmStartSha256: hash(bytes),
      rotations,
      opaque,
      cameraLedgerSha256: hash(
        fs.readFileSync(cameraFileOverride || path.join(folder, "main.json")),
      ),
      cameraSolve: meta.cameraSolve || null,
      loss: `Charbonnier photometric loss; full-resolution sorted Gaussian compositing; optimized positions, scales, color, and opacity${rotations ? ", plus rotations" : "; fixed orientations"}; split along the longest axis, then prune opacity below 0.004; select checkpoint by held-out MSE`,
      opacityMode: "raw classic 3DGS; no mip opacity bake",
      background: opaque
        ? "alternating black and white; checkpoint chosen by both backgrounds"
        : "black",
      poseSource: meta.cameraSolve
        ? "independently solved native cameras at the frozen source timestamps"
        : "recorded and interpolated legacy cameras; no new SfM",
    },
  },
  log: log.trim().split("\n"),
};
fs.writeFileSync(path.join(folder, `${output}.json`), JSON.stringify(metadata, null, 2) + "\n");
fs.writeFileSync(path.join(folder, `${output}-log.txt`), log);
console.log(
  JSON.stringify({ id, output, steps: actual, count: n, seconds: metadata.bake.clarity.seconds }),
);

#!/usr/bin/env node
// Register independently fitted 640px phone and 960px desktop models in one compatible BKD1
// manifest. The primary camera/finishing record describes the phone export; desktop provenance
// remains separately recorded. No historical record is relabeled as a higher-resolution run.
// <scratch> <id> <phone-bake> <desktop-bake>
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { format } from "prettier";
import { convert } from "./port-convert.mjs";
import { SAMPLES } from "../src/video3d/samples.js";
import { ORIGINAL_CAPTURES } from "./cdx-v3d-mac-bake.mjs";
import { meetsClarityGoal } from "./cdx-v3d-clarity-metrics.mjs";
import { compactGaussianPly } from "./cdx-v3d-clarity-ply.mjs";

const [scratch, id, phoneName, desktopName] = process.argv.slice(2);
if (!scratch || !SAMPLES.some((s) => s.id === id) || !phoneName || !desktopName)
  throw new Error("Usage: cdx-v3d-clarity-register.mjs <scratch> <id> <phone-bake> <desktop-bake>");
const folder = path.resolve(scratch, id),
  sample = SAMPLES.find((s) => s.id === id);
const read = (f) => JSON.parse(fs.readFileSync(f)),
  hash = (b) => createHash("sha256").update(b).digest("hex");
const write = async (file, value, parser = "json") =>
  fs.writeFileSync(
    file,
    await format(typeof value === "string" ? value : JSON.stringify(value), {
      parser,
      printWidth: 100,
    }),
  );
const phone = read(path.join(folder, `${phoneName}.json`)),
  desktop = read(path.join(folder, `${desktopName}.json`));
const phonePly = fs.readFileSync(path.join(folder, `${phoneName}.ply`)),
  desktopPly = fs.readFileSync(path.join(folder, `${desktopName}.ply`));
const fallbackPly = compactGaussianPly(phonePly);
phone.stats.plyBytes = fallbackPly.length;
phone.fallbackEncoding = {
  sourcePlySha256: hash(phonePly),
  sha256: hash(fallbackPly),
  bytes: fallbackPly.length,
  changes: "Omitted unused vertex normals; every decoded Gaussian parameter is bit-identical.",
};
// Preserve the fitted warm-start chain, including checkpoint exports and short phone finishing
// passes. The primary iteration counter alone cannot describe a mixed-resolution model.
const models = new Map();
for (const file of fs.readdirSync(folder)) {
  if (!file.endsWith(".ply") || file.includes("-packed")) continue;
  const name = file.slice(0, -4);
  if (fs.existsSync(path.join(folder, name + ".json")))
    models.set(hash(fs.readFileSync(path.join(folder, file))), name);
}
function history(name, seen = new Set()) {
  if (seen.has(name)) throw new Error("Cyclic warm-start history.");
  seen.add(name);
  const m = read(path.join(folder, name + ".json")),
    c = m.bake?.clarity;
  const plySha256 = hash(fs.readFileSync(path.join(folder, name + ".ply")));
  if (c) {
    const parent = models.get(c.warmStartSha256);
    return [
      ...(parent ? history(parent, seen) : []),
      {
        modelPlySha256: plySha256,
        warmStartPlySha256: c.warmStartSha256,
        trainerSha256: c.trainerSha256 || null,
        trainSide: c.trainSide,
        requestedSteps: c.requestedSteps,
        runCompletedSteps: c.completedSteps,
        selectedSteps: c.selectedStep ?? m.continuation?.completedIterations,
        outputCount: c.outputCount,
        opaque: !!c.opaque,
        background: c.background || "black",
        rotations: !!c.rotations,
        seconds: c.seconds,
        selection: c.selection || "minimum held-out MSE checkpoint",
        checkpointSha256: c.checkpointSha256 || null,
      },
    ];
  }
  if (m.checkpoint)
    return [
      {
        ...m.checkpoint,
        modelPlySha256: plySha256,
        initialIter: m.checkpoint.initialIter ?? m.stats.iters - m.checkpoint.actualSteps,
        trainSide: 960,
        selection: "frozen measured CPU checkpoint",
      },
    ];
  return [];
}
phone.trainingHistory = history(phoneName);
desktop.trainingHistory = history(desktopName);
if (phone.bake?.exportTrainSide !== 640 || desktop.bake?.exportTrainSide < 960)
  throw new Error("Keep actual 640px phone and at least 960px desktop exports.");
if (
  phone.cams.length !== desktop.cams.length ||
  phone.cams.some(
    (c, i) =>
      c.time !== desktop.cams[i].time ||
      c.R.some((v, k) => v !== desktop.cams[i].R[k]) ||
      c.t.some((v, k) => v !== desktop.cams[i].t[k]),
  )
)
  throw new Error("Both fitted tiers must share the same solved world and physical camera path.");
const baseline = read(path.resolve(scratch, "main-scores.json")).results.find((s) => s.id === id);
for (const [name, ply] of [
  [phoneName, phonePly],
  [desktopName, desktopPly],
]) {
  for (const [variant, bytes] of [
    [name, ply],
    [name + "-packed", fs.readFileSync(path.join(folder, name + "-packed.ply"))],
  ]) {
    const scored = read(path.resolve(scratch, `${variant}-scores.json`)).results.find(
      (s) => s.id === id,
    );
    if (
      !scored ||
      scored.plySha256 !== hash(bytes) ||
      !meetsClarityGoal(baseline.mean, scored.mean)
    )
      throw new Error(
        "Both actual raw and compressed tiers must pass the independent frozen-image clarity checks.",
      );
  }
  if (read(path.join(folder, name + "-packed.json")).packing.sourcePlySha256 !== hash(ply))
    throw new Error("Packed measurements belong to another source model.");
}
const out = `assets/toys/video-3d/${id}-baked`,
  staging = path.join(folder, "tier-staging");
fs.mkdirSync(staging, { recursive: true });
const manifest = convert([path.join(folder, `${phoneName}.ply`)], {
  out: path.join(staging, "phone"),
  id: `${id}-phone`,
  up: "y",
  gzip: true,
  tiers: [],
  default: phone.stats.exportedSplats,
});
const sharp = convert([path.join(folder, `${desktopName}.ply`)], {
  out: path.join(staging, "desktop"),
  id: `${id}-desktop`,
  up: "y",
  gzip: true,
  tiers: [],
  default: desktop.stats.exportedSplats,
});
if (
  manifest.source.splats !== phone.stats.exportedSplats ||
  sharp.source.splats !== desktop.stats.exportedSplats
)
  throw new Error("Metadata count differs from an actual fitted model.");
if (
  phone.stats.exportedSplats > 60000 ||
  desktop.stats.exportedSplats <= phone.stats.exportedSplats
)
  throw new Error("Keep a compact phone tier and a genuinely larger desktop tier.");
manifest.id = id;
manifest.title = sample.label.replace(/ \(compact\)$/, "");
manifest.source.file = `${id}.ply`;
manifest.source.sha256 = hash(fallbackPly);
manifest.source.trainedPlySha256 = hash(phonePly);
manifest.defaultTier = phone.stats.exportedSplats;
manifest.tiers = [
  { ...manifest.tiers.at(-1), role: "phone", trainingSide: 640, sourcePlySha256: hash(phonePly) },
  {
    ...sharp.tiers.at(-1),
    role: "desktop",
    trainingSide: desktop.bake.exportTrainSide,
    sourcePlySha256: hash(desktopPly),
  },
];
for (const [name, tier] of [
  [phoneName, manifest.tiers[0]],
  [desktopName, manifest.tiers[1]],
]) {
  const measured = read(path.join(folder, name + "-packed.json")).packing.files;
  if (
    measured.length !== tier.files.length ||
    measured.some((f, i) => f.sha256 !== tier.files[i].sha256)
  )
    throw new Error("Registered payload differs from the independently measured compressed tier.");
}
manifest.credit = {
  title: sample.title,
  author: sample.author,
  source: sample.source,
  license: sample.license,
  licenseUrl: sample.licenseUrl,
  checked: "October 13, 2026",
  changes: `Independently fitted 640px phone and ${desktop.bake.exportTrainSide}px desktop Gaussian models from the existing capture span, then quantized into BKD1. Capture spans, licenses, and source IDs are retained.${desktop.cameraSolve ? " Cameras were solved again at the frozen source timestamps with COLMAP." : " The recorded camera path and interpolated midpoints are retained."} Made by Ryan with Codex (GPT-6).`,
};
const meta = { ...phone, desktop };
meta.provenance = {
  ...(phone.provenance || {}),
  source: sample.source,
  author: sample.author,
  license: sample.license,
  licenseUrl: sample.licenseUrl,
  sourceSpan: sample.span,
  transformationCredit: sample.transformationCredit || "Made by Ryan with Codex (GPT-6).",
  captureUrl: ORIGINAL_CAPTURES[id]?.captureUrl || null,
  captureSha256: phone.continuation.sourceOrigin.fullCaptureSha256 || null,
  changes: manifest.credit.changes,
};
// Build and check all small payloads before replacing the viewer files.
const paths = new Map();
for (const [kind, tier] of [
  ["phone", manifest.tiers[0]],
  ["desktop", manifest.tiers[1]],
])
  for (const f of tier.files) {
    const b = fs.readFileSync(path.join(staging, kind, f.path));
    if (b.length >= 20_000_000) throw new Error("A tier chunk exceeds 20 MB.");
    paths.set(`${out}/${f.path}`, b);
  }
const base = `assets/toys/video-3d/${id}`;
const metadataBytes = Buffer.from(
  await format(JSON.stringify(meta), { parser: "json", printWidth: 100 }),
);
const manifestBytes = Buffer.from(
  await format(JSON.stringify(manifest), { parser: "json", printWidth: 100 }),
);
if (
  fallbackPly.length >= 20_000_000 ||
  metadataBytes.length >= 20_000_000 ||
  manifestBytes.length + metadataBytes.length + manifest.tiers[0].bytes >= 15_000_000
)
  throw new Error("Phone payload exceeds its budget.");
paths.set(`${base}.ply`, fallbackPly);
paths.set(`${base}.json`, metadataBytes);
paths.set(`${out}/manifest.json`, manifestBytes);
fs.mkdirSync(`${out}/assets`, { recursive: true });
for (const [file, b] of paths) fs.writeFileSync(file, b);
for (const file of fs.readdirSync(`${out}/assets`))
  if (!paths.has(`${out}/assets/${file}`)) fs.rmSync(`${out}/assets/${file}`);
const assets = read("tools/assets.json"),
  record = assets.videoSamples.find((s) => s.id === id || s.file === `${base}.ply`);
const files = Object.fromEntries(
  Array.from(paths, ([file, b]) => [file, { bytes: b.length, sha256: hash(b) }]),
);
record.file = `${base}.ply`;
record.path = `${base}.json`;
record.sha256 = hash(fallbackPly);
if (ORIGINAL_CAPTURES[id]) {
  record.captureUrl = ORIGINAL_CAPTURES[id].captureUrl;
  record.captureSha256 = ORIGINAL_CAPTURES[id].captureSha256;
}
record.note = manifest.credit.changes;
record.baked = {
  file: `${out}/manifest.json`,
  files: Object.fromEntries(Object.entries(files).filter(([f]) => f.startsWith(out + "/"))),
  defaultBytes: manifestBytes.length + metadataBytes.length + manifest.tiers[0].bytes,
  sourcePlySha256: hash(fallbackPly),
  trainedPlySha256: hash(phonePly),
  changes: manifest.credit.changes,
};
if (sample.transformationCredit) {
  record.files = { ...record.files, ...files };
  for (const file of Object.keys(record.files))
    if (file.startsWith(out + "/") && !files[file]) delete record.files[file];
  record.defaultBytes = record.baked.defaultBytes;
}
const samples = SAMPLES.map((s) =>
  s.id === id
    ? {
        ...s,
        label: s.label.replace(/ \(compact\)$/, ""),
        sha256: hash(fallbackPly),
        bakedSha256: hash(manifestBytes),
      }
    : s,
);
await write("tools/assets.json", assets);
await write(
  "src/video3d/samples.js",
  `// Real video captures. BKD1 manifests and camera JSON retain each source license.\nexport const SAMPLES = ${JSON.stringify(samples)};\n`,
  "babel",
);
console.log(
  JSON.stringify({
    id,
    phone: manifest.tiers[0].splats,
    desktop: manifest.tiers[1].splats,
    defaultBytes: record.baked.defaultBytes,
  }),
);

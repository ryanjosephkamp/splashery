#!/usr/bin/env node
// Reproduce compact BKD1 versions of the six real video scenes. PLYs remain build sources;
// the viewer fetches only each manifest, its gzip chunks, and the unchanged camera JSON.
// node tools/cdx-v3d-baked.mjs [directory-with-reviewed-plys]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { decodeChunk } from "../src/baked.js";
import { format } from "prettier";
import { convert, readGaussianPly } from "./port-convert.mjs";
import { SAMPLES } from "../src/video3d/samples.js";

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const pretty = (value, parser = "json") => format(value, { parser, printWidth: 100 });

export async function registerBakedSamples(
  directory = "assets/toys/video-3d",
  sampleList = SAMPLES,
  selectedIds = null,
) {
  const assets = JSON.parse(fs.readFileSync("tools/assets.json", "utf8"));
  const samples = [];
  for (const s of sampleList) {
    if (selectedIds && !selectedIds.has(s.id)) {
      samples.push(s);
      continue;
    }
    const base = `assets/toys/video-3d/${s.id}`;
    const folder = `${base}-baked`;
    const flat = path.join(directory, `${s.id}.ply`);
    const nested = path.join(directory, s.id, `${s.id}.ply`);
    const input = fs.existsSync(flat) ? flat : fs.existsSync(nested) ? nested : `${base}.ply`;
    const count = readGaussianPly(new Uint8Array(fs.readFileSync(input))).table.count;
    const tiers = [60000, 200000, 400000, 720000].filter((n) => n < count);
    const manifest = convert([input], {
      out: folder,
      id: s.id,
      gzip: true,
      up: "y", // No reorientation: the original cameras and splats share the training frame.
      tiers,
      default: Math.min(count, 400000),
    });
    // Retain a default phone tier and an opt-in 720k tier, while the full trained export
    // remains on the build machine. No unused multi-million-splat tier ships accidentally.
    for (const tier of manifest.tiers.filter((t) => t.splats > 720000))
      for (const f of tier.files) fs.rmSync(path.join(folder, f.path));
    manifest.tiers = manifest.tiers.filter((t) => t.splats <= 720000);
    const top = manifest.tiers[manifest.tiers.length - 1];
    const range = decodeChunk(
      new Uint8Array(gunzipSync(fs.readFileSync(path.join(folder, top.files[0].path)))),
    ).head;
    manifest.bounds = { min: range.lo, max: range.hi };
    manifest.title = s.label;
    manifest.credit = {
      title: s.title,
      author: s.author,
      source: s.source,
      license: s.license,
      licenseUrl: s.licenseUrl,
      checked: s.checked || "October 12, 2026",
      changes:
        "Quantized the reviewed trained PLY into BKD1 phone tiers, preserving Gaussian rotations, scales, opacity, and degree-0 color. Smaller tiers thin deterministically. Cameras and source footage are unchanged. Made by Ryan with Codex (GPT-6).",
    };
    const file = `${folder}/manifest.json`;
    fs.writeFileSync(file, await pretty(JSON.stringify(manifest)));
    const files = {};
    for (const name of [
      file,
      ...manifest.tiers.flatMap((t) => t.files.map((f) => `${folder}/${f.path}`)),
    ]) {
      const bytes = fs.readFileSync(name);
      if (bytes.length > 20_000_000) throw new Error(`Over 20 MB: ${name}`);
      files[name] = { bytes: bytes.length, sha256: sha(bytes) };
    }
    const metaBytes = fs.statSync(`${base}.json`).size;
    const defaultTier = manifest.tiers.find((t) => t.splats === manifest.defaultTier);
    const defaultBytes = files[file].bytes + defaultTier.bytes + metaBytes;
    if (defaultBytes > 15_000_000) throw new Error(`Default scene over 15 MB: ${s.id}`);
    if (defaultBytes >= fs.statSync(input).size + metaBytes)
      throw new Error(`BKD1 did not reduce the default load: ${s.id}`);
    // Replacing a small bake with a native one changes tier filenames. Retire only this
    // capture's obsolete chunks so every shipped file still has a current hash/credit record.
    const retained = new Set(Object.keys(files));
    const chunkDirectory = `${folder}/assets`;
    for (const name of fs.readdirSync(chunkDirectory)) {
      const chunk = `${chunkDirectory}/${name}`;
      if (name.startsWith(`${s.id}-`) && /\.bkd(?:\.gz)?$/.test(name) && !retained.has(chunk))
        fs.rmSync(chunk);
    }
    const record = assets.videoSamples.find((r) => r.id === s.id || r.file === `${base}.ply`);
    if (!record) throw new Error(`No source credit: ${s.id}`);
    record.baked = {
      file,
      files,
      defaultBytes,
      sourcePlySha256: manifest.source.sha256,
      changes: manifest.credit.changes,
    };
    if (s.transformationCredit) {
      record.defaultBytes = defaultBytes;
      Object.assign(record.files, files);
      if (!record.files[record.file]) record.file = file;
    }
    samples.push({ ...s, baked: `${s.id}-baked/manifest.json`, bakedSha256: files[file].sha256 });
    console.log(
      JSON.stringify({
        id: s.id,
        defaultBytes,
        plyBytes: fs.statSync(input).size,
        chunks: defaultTier.files.length,
      }),
    );
  }
  fs.writeFileSync(
    "src/video3d/samples.js",
    await pretty(
      `// Real video captures. BKD1 manifests and camera JSON retain each source license.\nexport const SAMPLES = ${JSON.stringify(samples)};\n`,
      "babel",
    ),
  );
  fs.writeFileSync("tools/assets.json", await pretty(JSON.stringify(assets)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await registerBakedSamples(process.argv[2]);

#!/usr/bin/env node
// MIT. Build-time wrapper for pinned CC0 Poly Haven models and canonical truth scenes.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lockFile = path.join(root, "tools/blender/models-lock.json");
const modelsFile = path.join(root, "tools/models.json");
const hash = (bytes, algorithm = "sha256") => createHash(algorithm).update(bytes).digest("hex");
const readJSON = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const writeJSON = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");

// urllib honors the cloud's existing proxy and CA configuration; no network is done by Blender.
export function download(url) {
  if (new URL(url).protocol !== "https:") throw new Error("Downloads require HTTPS");
  return execFileSync(
    "python3",
    [
      "-c",
      "import sys,urllib.request; r=urllib.request.Request(sys.argv[1],headers={'User-Agent':'SplasheryBuild/1.0'}); sys.stdout.buffer.write(urllib.request.urlopen(r,timeout=120).read())",
      url,
    ],
    { maxBuffer: 512 * 1024 * 1024 },
  );
}

export function localName(uri) {
  if (typeof uri !== "string" || !uri || uri.includes("\\") || uri.includes(":"))
    throw new Error("Unsafe model dependency");
  const decoded = decodeURIComponent(uri);
  if (
    decoded.startsWith("/") ||
    decoded.split("/").some((p) => p === ".." || !p) ||
    decoded.includes("\\") ||
    decoded.includes(":")
  )
    throw new Error("Unsafe model dependency");
  return decoded;
}

export function selectModel(id) {
  const entry = readJSON(modelsFile).models.find((m) => m.id === id);
  if (!entry || entry.license !== "CC0 1.0" || !entry.source.startsWith("polyhaven:"))
    throw new Error("Select a CC0 Poly Haven ID from tools/models.json");
  // These assets need the existing converter's logo removal. Do not silently render the originals.
  if (entry.paintOut?.length)
    throw new Error("This model requires logo removal; choose another CC0 model");
  return entry;
}

export async function pinModel(id, cache) {
  const entry = selectModel(id);
  const asset = entry.source.slice("polyhaven:".length);
  const api = `https://api.polyhaven.com/files/${asset}`;
  const listing = download(api);
  const gltf = JSON.parse(listing).gltf?.["1k"]?.gltf;
  if (!gltf) throw new Error("No 1k glTF in Poly Haven API");
  // Confirm the live license and source page before recording the model.
  const license = download("https://polyhaven.com/license").toString();
  if (!license.includes("CC0")) throw new Error("Live CC0 license could not be confirmed");
  download(entry.page);
  const files = [];
  for (const [name, info] of [[`${asset}.gltf`, gltf], ...Object.entries(gltf.include || {})]) {
    localName(name);
    const bytes = download(info.url);
    if (bytes.length !== info.size || hash(bytes, "md5") !== info.md5)
      throw new Error(`Poly Haven API integrity mismatch: ${name}`);
    files.push({ name, url: info.url, bytes: bytes.length, sha256: hash(bytes) });
  }
  const record = {
    source: entry.page,
    author: entry.author,
    license: "CC0-1.0",
    checked: new Date().toISOString().slice(0, 10),
    changes:
      "1k glTF and dependencies embedded losslessly into GLB; source geometry and textures retained",
    api,
    api_sha256: hash(listing),
    files,
  };
  const locks = fs.existsSync(lockFile) ? readJSON(lockFile) : {};
  locks[id] = record;
  writeJSON(lockFile, locks);
  await prepareModel(id, cache);
}

export async function embedModel(json, resources) {
  const supported = new Set(ALL_EXTENSIONS.map((extension) => extension.EXTENSION_NAME));
  for (const name of json.extensionsUsed || []) {
    if (!supported.has(name)) throw new Error(`Unsupported glTF extension: ${name}`);
  }
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.readJSON({ json, resources });
  return io.writeBinary(doc);
}

export async function prepareModel(id, cache) {
  const entry = selectModel(id);
  const lock = readJSON(lockFile)[id];
  if (
    !lock ||
    lock.source !== entry.page ||
    lock.author !== entry.author ||
    lock.license !== "CC0-1.0"
  )
    throw new Error(`No matching pin for ${id}; explicitly run --pin-model ${id} first`);
  const dir = path.join(cache, id);
  fs.mkdirSync(dir, { recursive: true });
  const resources = {};
  for (const file of lock.files) {
    const name = localName(file.name);
    const target = path.join(dir, name);
    const bytes = fs.existsSync(target) ? fs.readFileSync(target) : download(file.url);
    if (bytes.length !== file.bytes || hash(bytes) !== file.sha256)
      throw new Error(`Pinned model SHA-256 mismatch: ${name}; remove corrupt cache file`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (!fs.existsSync(target)) fs.writeFileSync(target, bytes);
    resources[name] = new Uint8Array(bytes);
  }
  const main = lock.files.find((f) => f.name.endsWith(".gltf"));
  if (!main) throw new Error("Pinned glTF is missing");
  const json = JSON.parse(Buffer.from(resources[main.name]).toString());
  for (const item of [...(json.buffers || []), ...(json.images || [])]) {
    if (item.uri && !item.uri.startsWith("data:")) {
      const name = localName(item.uri);
      if (!resources[name]) throw new Error(`Unpinned dependency: ${name}`);
    }
  }
  const bytes = await embedModel(json, resources);
  const model = path.join(dir, "model.glb");
  const record = path.join(dir, "asset.json");
  fs.writeFileSync(model, bytes);
  writeJSON(record, { ...lock, sha256: hash(bytes) });
  return { model, record };
}

export async function main(args = process.argv.slice(2)) {
  const { values: opt } = parseArgs({
    args,
    options: {
      model: { type: "string" },
      scene: { type: "string" },
      "pin-model": { type: "string" },
      "asset-record": { type: "string" },
      out: { type: "string" },
      timings: { type: "string" },
      width: { type: "string", default: "512" },
      height: { type: "string", default: "512" },
      views: { type: "string", default: "24" },
      samples: { type: "string", default: "16" },
      "panorama-width": { type: "string", default: "1024" },
      cache: { type: "string", default: path.join(root, ".cache/blender-models") },
      help: { type: "boolean" },
    },
  });
  if (opt.help) {
    console.log(
      "node tools/blender-views.mjs --model <CC0 Poly Haven ID from tools/models.json> | --scene <truth scene> --out <new directory> [--views 24 --width 512 --height 512 --samples 16 --panorama-width 1024 --timings <outside output>]\nLocal embedded GLB: --model <file.glb> --asset-record <record.json>\nExplicitly add/update a Poly Haven pin: --pin-model <ID>",
    );
    return;
  }
  if (opt["pin-model"]) {
    if (opt.model || opt.scene || opt.out)
      throw new Error("Pinning is a separate operation from rendering");
    await pinModel(opt["pin-model"], path.resolve(opt.cache));
    return;
  }
  if (!opt.out || !!opt.model === !!opt.scene)
    throw new Error("Provide --out and exactly one of --model or --scene");
  let input;
  if (opt.scene) input = ["--scene", opt.scene];
  else if (opt["asset-record"])
    input = [
      "--model",
      path.resolve(opt.model),
      "--asset-record",
      path.resolve(opt["asset-record"]),
    ];
  else {
    const { model, record } = await prepareModel(opt.model, path.resolve(opt.cache));
    input = ["--model", model, "--asset-record", record];
  }
  const forwarded = [
    "out",
    "width",
    "height",
    "views",
    "samples",
    "panorama-width",
    "timings",
  ].flatMap((key) => (opt[key] ? [`--${key}`, opt[key]] : []));
  const child = spawnSync(
    "bash",
    [
      path.join(root, "tools/blender-cloud.sh"),
      "--python",
      path.join(root, "tools/blender/render.py"),
      "--",
      ...input,
      ...forwarded,
    ],
    { stdio: "inherit" },
  );
  if (child.error) throw child.error;
  if (child.status !== 0) throw new Error(`Blender exited ${child.status ?? child.signal}`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(`blender-views: ${error.message}`);
    process.exitCode = 1;
  });
}

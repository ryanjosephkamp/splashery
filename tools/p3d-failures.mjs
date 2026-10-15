#!/usr/bin/env node
// Photo to 3D failure atlas. MIT; made by Ryan with Codex (GPT-6).
// Local files, inference, rendering, scoring, and output. No upload or publishing code.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { inventory, ROOT, hash } from "./p3df/inputs.mjs";
import { localServer, measureProfile, PROFILES } from "./p3df/browser.mjs";
import { galleryHtml } from "./p3df/gallery.mjs";
import { POSES, THRESHOLDS } from "./p3df/scoring.mjs";

export function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    const m = argv[i].match(/^--([a-z-]+)(?:=(.*))?$/);
    if (!m) throw new Error("Unknown argument: " + argv[i]);
    const key = m[1];
    if (!["in", "out", "manifest", "samples", "profiles", "limit", "resume", "help"].includes(key))
      throw new Error("Unknown option: --" + key);
    result[key] = ["resume", "help"].includes(key) ? true : (m[2] ?? argv[++i]);
    if (
      result[key] === undefined ||
      (typeof result[key] === "string" && result[key].startsWith("--"))
    )
      throw new Error("Missing value for --" + key);
  }
  if (result.in && result.manifest) throw new Error("Choose --in or --manifest, not both.");
  return result;
}

export function fingerprint() {
  const files = {};
  const visit = (folder) => {
    for (const ent of fs
      .readdirSync(path.join(ROOT, folder), { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name, "en"))) {
      const rel = path.posix.join(folder, ent.name);
      if (ent.isDirectory()) visit(rel);
      else if (ent.isFile() && rel !== "tools/p3df/gallery.mjs")
        files[rel] = hash(fs.readFileSync(path.join(ROOT, rel)));
    }
  };
  visit("src");
  visit("tools/p3df");
  visit("vendor/onnxruntime-web");
  for (const p of [
    "tools/p3d-failures.mjs",
    "playwright.config.mjs",
    "tools/cdx-p3d2-r3-common.mjs",
    "tools/cdx-p3d2-r3-anchored.mjs",
    "tools/studio-truth/metrics.mjs",
    "tools/studio-truth/sampling.mjs",
    "vendor/playcanvas/playcanvas.min.mjs",
    "vendor/depth-anything-v2-small/model_quantized.onnx",
    "vendor/onnxruntime-web/ort.wasm.min.mjs",
    "vendor/onnxruntime-web/ort-wasm-simd-threaded.wasm",
  ])
    if (fs.existsSync(path.join(ROOT, p))) files[p] = hash(fs.readFileSync(path.join(ROOT, p)));
  let head = null;
  try {
    head = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {}
  return { head, files, sha256: hash(JSON.stringify(files)) };
}

function atomic(file, data) {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
  fs.renameSync(tmp, file);
}
export async function runAudit(options = {}) {
  const out = path.resolve(options.out || path.join(ROOT, ".cache/p3d-failures/run"));
  for (const forbidden of ["src", "assets", "vendor", ".git"])
    if (out === path.join(ROOT, forbidden) || out.startsWith(path.join(ROOT, forbidden) + path.sep))
      throw new Error("Output must be outside protected production folders.");
  const all = inventory({ input: options.in, manifest: options.manifest });
  let entries = all;
  if (options.samples) {
    const want = options.samples.split(",");
    entries = entries.filter((e) => want.includes(e.id));
    if (entries.length !== want.length) throw new Error("A requested sample ID was not found.");
  }
  if (options.limit) {
    const n = Number(options.limit);
    if (!Number.isInteger(n) || n < 1) throw new Error("--limit must be a positive integer");
    entries = entries.slice(0, n);
  }
  const profiles = options.profiles ? options.profiles.split(",") : Object.keys(PROFILES);
  if (
    !profiles.length ||
    new Set(profiles).size !== profiles.length ||
    profiles.some((p) => !PROFILES[p])
  )
    throw new Error("Profiles are phone and desktop.");
  const poses = options.poses || POSES,
    source = fingerprint();
  const { RECIPES } = await import("../src/packs/photo-3d.js");
  const depth = RECIPES["photo-3d"].options.find((o) => o.key === "depth").default;
  const settings = {
    depth,
    profiles,
    poses,
    diagnostics: true,
    view: "sharp",
    detail: "photo",
    background: "white; no ground",
    inputHashes: entries.map((e) => ({
      id: e.id,
      sha256: e.sha256,
      depth: e.depthSha256 || null,
      truth: e.truthSha256 || null,
    })),
  };
  const recordFile = path.join(out, "atlas.json");
  if (fs.existsSync(out) && fs.readdirSync(out).length && !fs.existsSync(recordFile))
    throw new Error("The output folder contains other files. Choose an empty folder.");
  fs.mkdirSync(out, { recursive: true });
  const previous = fs.existsSync(recordFile) ? JSON.parse(fs.readFileSync(recordFile)) : null;
  if (
    previous &&
    (!options.resume ||
      previous.source.sha256 !== source.sha256 ||
      JSON.stringify(previous.settings) !== JSON.stringify(settings))
  )
    throw new Error(
      "Output exists or source, inputs, or settings changed. Use --resume only with identical inputs and source, or choose a new folder.",
    );
  const data = previous || {
    schema: 1,
    createdUTC: new Date().toISOString(),
    source,
    settings,
    thresholds: { ...THRESHOLDS, speed: 5000, memory: 1024 ** 3 },
    environment:
      "Chromium / " +
      (process.env.SPLASHERY_GL || "SwiftShader") +
      "; software GPU when configured; not physical-phone performance",
    private: !!options.in,
    requestedInputs: all.length,
    complete: false,
    inputs: [],
    attempts: [],
  };
  fs.mkdirSync(path.join(out, "inputs"), { recursive: true });
  fs.mkdirSync(path.join(out, "records"), { recursive: true });
  const save = () => {
    atomic(recordFile, data);
    fs.writeFileSync(path.join(out, "index.html"), galleryHtml(data));
  };
  save();
  const server = await localServer(entries);
  try {
    for (const entry of entries) {
      let row = data.inputs.find((r) => r.id === entry.id);
      if (!row) {
        const ext = path.extname(entry.file).toLowerCase();
        const photo = "inputs/" + entry.id + ext;
        fs.copyFileSync(entry.file, path.join(out, photo));
        const { file, depthFile, truth, ...safe } = entry;
        row = { ...safe, photo, record: `records/${entry.id}.json`, profiles: {} };
        data.inputs.push(row);
      }
      if (hash(fs.readFileSync(path.join(out, row.photo))) !== entry.sha256)
        throw new Error("Saved source photo changed: " + entry.id);
      for (const name of profiles) {
        if (row.profiles[name]?.rows?.length === poses.length) {
          for (const p of row.profiles[name].rows)
            for (const [file, digest] of Object.entries(p.artifacts || {}))
              if (
                !fs.existsSync(path.join(out, file)) ||
                hash(fs.readFileSync(path.join(out, file))) !== digest
              )
                throw new Error("Saved render evidence missing or changed: " + file);
          continue;
        }
        const startedUTC = new Date().toISOString();
        row.profileErrors ||= {};
        try {
          row.profiles[name] = await measureProfile(entry, name, { server, out, poses, depth });
          delete row.profileErrors[name];
          data.attempts.push({
            id: entry.id,
            profile: name,
            startedUTC,
            finishedUTC: new Date().toISOString(),
            passed: true,
          });
        } catch (e) {
          row.profileErrors[name] = e.message;
          data.attempts.push({
            id: entry.id,
            profile: name,
            startedUTC,
            finishedUTC: new Date().toISOString(),
            passed: false,
            error: e.message,
          });
        }
        if (Object.keys(row.profileErrors).length)
          row.error = Object.entries(row.profileErrors)
            .map(([p, e]) => p + ": " + e)
            .join("; ");
        else delete row.error;
        atomic(path.join(out, row.record), row);
        save();
        options.onProgress?.({
          id: entry.id,
          profile: name,
          error: row.error || null,
          completed: data.inputs.reduce((n, r) => n + Object.keys(r.profiles).length, 0),
          expected: entries.length * profiles.length,
        });
      }
    }
  } finally {
    await server.close();
  }
  const final = fingerprint();
  if (source.sha256 !== final.sha256)
    throw new Error(
      "Source changed during the run. Evidence is incomplete; use a new output folder.",
    );
  data.complete =
    entries.length === all.length &&
    profiles.length === 2 &&
    JSON.stringify(poses) === JSON.stringify(POSES) &&
    data.inputs.length === entries.length &&
    data.inputs.every((r) => profiles.every((p) => r.profiles[p]?.rows.length === poses.length));
  data.finishedUTC = new Date().toISOString();
  data.coverage = {
    expectedProfiles: entries.length * profiles.length,
    completedProfiles: data.inputs.reduce((n, r) => n + Object.keys(r.profiles).length, 0),
    expectedPoses: entries.length * profiles.length * poses.length,
    completedPoses: data.inputs.reduce(
      (n, r) => n + Object.values(r.profiles).reduce((v, p) => v + p.rows.length, 0),
      0,
    ),
    failedAttempts: data.attempts.filter((r) => !r.passed).length,
  };
  save();
  return data;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(`Photo to 3D failure atlas (local only)
  node tools/p3d-failures.mjs --in /path/to/photos --out /path/to/gallery
  node tools/p3d-failures.mjs --manifest inputs.json --out /path/to/gallery
  node tools/p3d-failures.mjs --out .cache/p3d-failures/run

Options: --resume, --samples id,id, --profiles phone,desktop, --limit N.
The default inventory includes every built-in/hard-case sample and all 12 truth stills.
An explicit manifest can add licensed audit photos. No files are uploaded or committed.
Input folders: JPEG, PNG, WebP, and HEIC/HEIF when Chromium supports decoding them.
Install dev dependencies and Chromium first; see the report for macOS instructions.
Open OUT/index.html directly. All gallery data is embedded; no web server is needed.`);
    return;
  }
  const data = await runAudit({ ...options, onProgress: (p) => console.log(JSON.stringify(p)) });
  console.log(JSON.stringify(data.coverage));
  if (data.coverage.completedProfiles !== data.coverage.expectedProfiles) process.exitCode = 1;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]))
  await main();

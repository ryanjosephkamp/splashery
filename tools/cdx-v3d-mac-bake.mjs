#!/usr/bin/env node
// MIT. Build-only Apple silicon workflow. Never imported by the site.
// node tools/cdx-v3d-mac-bake.mjs <plan|prepare|solve|train|import> <capture-id> <scratch-directory>
// Run stages in order. Output stays in scratch; the Operator reviews it before replacing assets.
// CLI flags verified against COLMAP 4.2.1 and msplat's pinned Python CLI on October 12, 2026.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { CAPTURES } from "./cdx-v3d-sample-sources.mjs";

export const MSPLAT_REVISION = "6b819711fa7c90f054567cb4fb4937743367afdd";
export const MAC_SETTINGS = {
  framesPerSecond: 3,
  iterations: 30000,
  downscaleFactor: 1,
  numDownscales: 0,
  shDegree: 3,
  refineEvery: 100,
  warmupLength: 500,
  densifyGradThresh: 0.0002,
  keepCrs: true,
};
// Original upload links, dimensions, byte counts, and SHA-256 were checked against the live
// Commons pages and downloaded originals on October 12, 2026. CAPTURES describes historical
// transcodes used by the existing browser bakes; never replace that provenance with this map.
export const ORIGINAL_CAPTURES = {
  adjara: {
    captureUrl:
      "https://upload.wikimedia.org/wikipedia/commons/e/e8/Adjara2025walking-summer-forest.webm",
    captureSha256: "0c0573ee90a7275470ef199537e70ea90c268e687d117f7a3b9cad10e3b23fa6",
    captureBytes: 199530719,
    width: 1080,
    height: 1920,
  },
  lihula: {
    captureUrl:
      "https://upload.wikimedia.org/wikipedia/commons/c/c9/Drone_video_of_ruins_of_Lihula_stronghold%2C_the_manor_and_town_%28august_2021%29.webm",
    captureSha256: "83c274486dbe6a3dc069006959c55bd6c257af04db178f26ba7cf0afaabe5dba",
    captureBytes: 148643418,
    width: 1920,
    height: 1080,
  },
  toolse: {
    captureUrl:
      "https://upload.wikimedia.org/wikipedia/commons/f/f5/Toolse_castle_in_Estonia_%28Fall_2021%29.webm",
    captureSha256: "8be87039761226498d39a66d4b2977e80329fc3eabd9819286de7cd5a9957a69",
    captureBytes: 58179695,
    width: 1920,
    height: 1080,
  },
  poltsamaa: {
    captureUrl:
      "https://upload.wikimedia.org/wikipedia/commons/6/62/Drone_video_of_P%C3%B5ltsamaa_river_and_castle_in_Estonia.webm",
    captureSha256: "50cd00045ef7a58341c3b77d5f844d7b20391dfc89ce3f283673b15d6430ccd6",
    captureBytes: 69973358,
    width: 2720,
    height: 1530,
  },
};
const repo = path.resolve(import.meta.dirname, "..");
const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const run = (program, args) => execFileSync(program, args, { maxBuffer: 64e6 }).toString();

export function trainingCommand(dataset, output) {
  return [
    "msplat-train",
    dataset,
    "--output",
    output,
    "--num-iters",
    "30000",
    "--num-downscales",
    "0",
    "--downscale-factor",
    "1",
    "--sh-degree",
    "3",
    "--refine-every",
    "100",
    "--warmup-length",
    "500",
    "--densify-grad-thresh",
    "0.0002",
    "--keep-crs",
  ];
}

function rotation([qw, qx, qy, qz]) {
  const n = Math.hypot(qw, qx, qy, qz);
  if (!n) throw new Error("Invalid COLMAP quaternion.");
  const [w, x, y, z] = [qw, qx, qy, qz].map((v) => v / n);
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
    2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
    2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y),
  ]; // prettier-ignore
}

// COLMAP TEXT has two lines per image, including an empty second line for no 2D points.
// Preserve that pairing. R,t remain world-to-camera (x right, y down, z forward).
export function readColmapText(directory, frameTimes) {
  const calibration = {};
  for (const line of fs.readFileSync(path.join(directory, "cameras.txt"), "utf8").split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("#")) continue;
    const [id, model, width, height, ...values] = line.trim().split(/\s+/);
    const params = values.map(Number);
    calibration[id] = { model, width: Number(width), height: Number(height), params };
  }
  const cams = [];
  const lines = fs.readFileSync(path.join(directory, "images.txt"), "utf8").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim() || lines[i].startsWith("#")) continue;
    const [id, qw, qx, qy, qz, tx, ty, tz, cameraId, ...name] = lines[i].trim().split(/\s+/);
    i++; // Skip the image's 2D observations, even when empty.
    const filename = name.join(" ");
    const c = calibration[cameraId];
    if (!c || !["PINHOLE", "SIMPLE_PINHOLE"].includes(c.model))
      throw new Error("Import the undistorted PINHOLE model, not the original distorted images.");
    const [f, fy, cx, cy] = c.model === "PINHOLE" ? c.params : [c.params[0], ...c.params];
    const time = frameTimes.find((frame) => frame.file === filename)?.time;
    if (time === undefined) throw new Error(`No recorded video timestamp for ${filename}.`);
    const cam = {
      id: Number(id),
      filename,
      cameraId: Number(cameraId),
      time,
      R: rotation([qw, qx, qy, qz].map(Number)),
      t: [tx, ty, tz].map(Number),
      f,
      fy,
      cx,
      cy,
      w: c.width,
      h: c.height,
    };
    if (![...cam.R, ...cam.t, f, fy, cx, cy, time].every(Number.isFinite) || f <= 0 || fy <= 0)
      throw new Error(`Invalid camera values for ${filename}.`);
    cams.push(cam);
  }
  return { cams: cams.sort((a, b) => a.time - b.time), calibration };
}

export function importMetadata(prep, cameras, solve, training, plyBytes) {
  const { cams, calibration } = cameras;
  const trainSide = Math.max(...cams.map((c) => Math.max(c.w, c.h)));
  const intrinsics = ({ f, fy, cx, cy, w, h }) => ({ f, fy, cx, cy, w, h });
  return {
    cams,
    stats: {
      frames: prep.frameTimes.length,
      registered: cams.length,
      splats: training.splats,
      exportedSplats: training.splats,
      iters: training.iterations,
      trainSide,
      plyBytes,
    },
    bake: {
      route: "COLMAP 4.2.1 + pinned msplat 1.1.4; Apple silicon Metal; build tools only",
      backend: "msplat/Metal",
      settings: {
        ...training.settings,
        backend: "msplat/Metal",
        maxFrames: prep.frameTimes.length,
        frames: prep.frameTimes.length,
        frameSide: trainSide,
        trainSide,
        iters: training.iterations,
      },
      exportTrainSide: trainSide,
      exportCam0: intrinsics(cams[0]),
      exportCameras: cams.map(intrinsics),
      source: prep.capture,
      sourceSha256: prep.sourceSha256,
      nativeSize: prep.nativeSize,
      frameTimes: prep.frameTimes,
      calibration,
      solve,
      training,
      coordinateConvention:
        "Original COLMAP world; row-major world-to-camera R,t; x right, y down, z forward",
      start: prep.capture.span.start,
      length: prep.capture.span.length,
      sourceTimeOffset: prep.capture.span.start,
      intrinsicsNote:
        "Preserves f,fy,cx,cy,w,h from undistorted calibration. The current Splashery flight uses centered, equal-focal projection; review any off-center or unequal-focal discrepancy.",
    },
  };
}

function convertModel(model, text) {
  fs.mkdirSync(text, { recursive: true });
  run("colmap", [
    "model_converter",
    "--input_path",
    model,
    "--output_path",
    text,
    "--output_type",
    "TXT",
  ]);
}

async function main() {
  const [stage, id, scratch] = process.argv.slice(2);
  const historical = CAPTURES.find((c) => c.id === id);
  if (!historical || !scratch || !["plan", "prepare", "solve", "train", "import"].includes(stage))
    throw new Error("Usage: cdx-v3d-mac-bake.mjs <plan|prepare|solve|train|import> <adjara|lihula|toolse|poltsamaa> <scratch-directory>"); // prettier-ignore
  const capture = {
    ...historical,
    ...ORIGINAL_CAPTURES[id],
    sourceFormat: "original Commons upload",
  };
  const work = path.join(path.resolve(scratch), id);
  if (work === repo || work.startsWith(repo + path.sep))
    throw new Error("Choose a scratch directory outside the Splashery repository.");
  const preparation = path.join(work, "preparation.json");
  const dataset = path.join(work, "undistorted");
  const output = path.join(work, `${id}.ply`);
  if (stage === "plan") {
    console.log(
      JSON.stringify(
        {
          id,
          capture,
          nativeSize: [capture.width, capture.height],
          frames: 60,
          settings: MAC_SETTINGS,
          trainerRevision: MSPLAT_REVISION,
          command: trainingCommand(dataset, output),
          coordinateContract:
            "--keep-crs restores original COLMAP world coordinates; import preserves R,t and native intrinsics",
          splatBudget:
            "No artificial 120,000-splat cap: msplat densifies automatically. Record the actual count and review before making phone tiers.",
        },
        null,
        2,
      ),
    );
    return;
  }
  fs.mkdirSync(work, { recursive: true });
  if (stage === "prepare") {
    if (fs.existsSync(preparation)) throw new Error("Preparation already exists; use a new scratch directory to reproduce it."); // prettier-ignore
    const licensePage = run("curl", ["-fsSL", "-A", "Mozilla/5.0", capture.source]);
    if (!licensePage.includes(capture.licenseText))
      throw new Error(`Recheck the license: ${capture.source}`);
    const originalUrl = licensePage
      .match(/class="fullMedia"[\s\S]*?href="([^"]+)"/)?.[1]
      .replaceAll("&amp;", "&")
      .split("?")[0];
    if (originalUrl !== capture.captureUrl)
      throw new Error(
        "The live Commons original-download link changed; recheck the original source.",
      );
    const source = path.join(work, "capture.webm");
    if (!fs.existsSync(source))
      run("curl", ["-fsSL", "--retry", "3", "-A", "Mozilla/5.0", "-o", source, capture.captureUrl]);
    if (fs.statSync(source).size !== capture.captureBytes || hash(source) !== capture.captureSha256)
      throw new Error("Original capture bytes changed; review the live source before training.");
    const probe = JSON.parse(run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", source])); // prettier-ignore
    const { width, height } = probe.streams[0];
    if (width !== capture.width || height !== capture.height)
      throw new Error(
        "Unexpected capture dimensions. Never substitute the shipped 480p source cut.",
      );
    const images = path.join(work, "images");
    fs.mkdirSync(images);
    // Keep actual selected source timestamps, not guessed evenly spaced frame times. No scale,
    // crop, JPEG recompression, or repeated generated frames; 60 native PNGs from this one shot.
    const filter = `trim=start=${capture.span.start}:duration=20,setpts=PTS-${capture.span.start}/TB,select='gte(t,selected_n/3)',showinfo`; // prettier-ignore
    const args = ["-nostdin", "-v", "info", "-threads", "2", "-filter_threads", "1", "-i", source, "-an", "-vf", filter, "-fps_mode", "vfr", "-frames:v", "60", "-threads", "2", "-compression_level", "3", path.join(images, "%06d.png")]; // prettier-ignore
    const extracted = spawnSync("ffmpeg", args, { maxBuffer: 16e6, encoding: "utf8" });
    fs.writeFileSync(path.join(work, "extraction.log"), extracted.stderr || "");
    if (extracted.status !== 0) throw new Error("Frame extraction failed; inspect extraction.log.");
    const files = fs
      .readdirSync(images)
      .filter((f) => f.endsWith(".png"))
      .sort();
    const times = [...extracted.stderr.matchAll(/\bn:\s*\d+.*?\bpts_time:([\d.e+-]+)/g)].map((m) => Number(m[1])); // prettier-ignore
    if (files.length !== 60 || times.length < files.length)
      throw new Error(`Expected 60 native frames; received ${files.length}. Inspect the source and extraction log.`); // prettier-ignore
    for (const file of files) {
      const png = fs.readFileSync(path.join(images, file));
      if (png.readUInt32BE(16) !== width || png.readUInt32BE(20) !== height)
        throw new Error(`PNG dimensions differ from the original capture: ${file}.`);
    }
    write(preparation, {
      capture,
      nativeSize: { width, height },
      sourceSha256: hash(source),
      frameTimes: files.map((file, i) => ({
        file,
        time: times[i],
        sha256: hash(path.join(images, file)),
      })),
      ffmpegCommand: ["ffmpeg", ...args],
      ffmpegVersion: run("ffmpeg", ["-version"]).split("\n")[0],
      prepared: new Date().toISOString(),
      settings: MAC_SETTINGS,
    });
    console.log(
      `Prepared 60 native ${width}×${height} PNGs in ${images}. Review them before solving.`,
    );
    return;
  }
  const prep = read(preparation);
  if (stage === "solve") {
    for (const frame of prep.frameTimes)
      if (hash(path.join(work, "images", frame.file)) !== frame.sha256)
        throw new Error(
          `Prepared image changed: ${frame.file}. Reproduce the input in a new scratch directory.`,
        );
    const version = run("colmap", ["-h"])
      .split("\n")
      .find((line) => line.includes("COLMAP"));
    if (!version?.includes("4.2.1")) throw new Error("This recipe was verified for COLMAP 4.2.1. Install that version or review changed flags first."); // prettier-ignore
    const raw = path.join(work, "colmap");
    fs.mkdirSync(raw);
    const command = ["automatic_reconstructor", "--workspace_path", raw, "--image_path", path.join(work, "images"), "--data_type", "video", "--quality", "high", "--single_camera", "1", "--camera_model", "SIMPLE_RADIAL", "--dense", "0", "--use_gpu", "0"]; // prettier-ignore
    run("colmap", command);
    const models = [];
    for (const name of fs.readdirSync(path.join(raw, "sparse"))) {
      const model = path.join(raw, "sparse", name);
      if (!fs.existsSync(path.join(model, "images.bin"))) continue;
      const text = path.join(work, `model-${name}-text`);
      convertModel(model, text);
      // Count image headers without interpreting the still-distorted raw calibration.
      const count = fs.readFileSync(path.join(text, "images.txt"), "utf8").split(/\r?\n/).filter((line) => /^\d+\s/.test(line) && /\.png$/.test(line)).length; // prettier-ignore
      models.push({ model, text, count });
    }
    models.sort((a, b) => b.count - a.count);
    if (!models[0] || models[0].count < 54)
      throw new Error("Fewer than 54 of 60 frames connect in one reconstruction. Choose a steadier shot before training."); // prettier-ignore
    const undistort = ["image_undistorter", "--image_path", path.join(work, "images"), "--input_path", models[0].model, "--output_path", dataset, "--output_type", "COLMAP", "--max_image_size", "-1"]; // prettier-ignore
    run("colmap", undistort);
    const text = path.join(work, "undistorted-text");
    convertModel(path.join(dataset, "sparse"), text);
    const parsed = readColmapText(text, prep.frameTimes);
    write(path.join(work, "cameras.json"), parsed);
    write(path.join(work, "solve.json"), {
      version,
      automaticCommand: ["colmap", ...command],
      undistortCommand: ["colmap", ...undistort],
      models,
      registeredFrames: parsed.cams.length,
      textHashes: Object.fromEntries(
        ["cameras.txt", "images.txt", "points3D.txt"].map((name) => [
          name,
          hash(path.join(text, name)),
        ]),
      ),
      inputHashes: Object.fromEntries([
        ...["cameras.bin", "images.bin", "points3D.bin"].map((name) => [
          `sparse/${name}`,
          hash(path.join(dataset, "sparse", name)),
        ]),
        ...parsed.cams.map((c) => [
          `images/${c.filename}`,
          hash(path.join(dataset, "images", c.filename)),
        ]),
      ]),
      cameraMetadataSha256: hash(path.join(work, "cameras.json")),
      completed: new Date().toISOString(),
    });
    console.log(
      `Solved ${parsed.cams.length}/60 cameras; undistorted native images are in ${dataset}.`,
    );
    return;
  }
  if (stage === "train") {
    if (process.platform !== "darwin" || process.arch !== "arm64")
      throw new Error("Train this recipe on an Apple silicon Mac with Metal, not this software-GPU container."); // prettier-ignore
    const solve = read(path.join(work, "solve.json"));
    for (const [file, expected] of Object.entries(solve.inputHashes))
      if (hash(path.join(dataset, file)) !== expected)
        throw new Error(`Training input changed: ${file}.`);
    const version = run("python3", ["-c", "import importlib.metadata; print(importlib.metadata.version('msplat'))"]).trim(); // prettier-ignore
    if (version !== "1.1.4") throw new Error("Install the pinned msplat revision in the documented Python 3.12 virtual environment."); // prettier-ignore
    const command = trainingCommand(dataset, output);
    const help = run(command[0], ["--help"]);
    for (const flag of command.filter((arg) => arg.startsWith("--")))
      if (!help.includes(flag))
        throw new Error(`The installed trainer no longer supports ${flag}.`);
    const before = Date.now();
    const log = fs.openSync(path.join(work, "training.log"), "w");
    let status;
    try {
      status = spawnSync(command[0], command.slice(1), { stdio: ["ignore", log, log] }).status;
    } finally {
      fs.closeSync(log);
    }
    if (status !== 0 || !fs.existsSync(output))
      throw new Error("Training failed; inspect training.log.");
    const header = fs.readFileSync(output).subarray(0, 8192).toString();
    const iterations = Number(header.match(/comment msplat v(\d+)/)?.[1]);
    const splats = Number(header.match(/element vertex (\d+)/)?.[1]);
    if (iterations < 30000 || !Number.isFinite(iterations) || !splats)
      throw new Error("The exported PLY does not record a completed 30,000-step training run.");
    write(path.join(work, "training.json"), {
      command,
      settings: MAC_SETTINGS,
      version,
      revision: MSPLAT_REVISION,
      iterations,
      splats,
      plySha256: hash(output),
      seconds: (Date.now() - before) / 1000,
      completed: new Date().toISOString(),
    });
    console.log(`Trained ${iterations} steps and exported ${splats} splats. Inspect ${output}.`);
    return;
  }
  const training = read(path.join(work, "training.json"));
  const solve = read(path.join(work, "solve.json"));
  const cameras = read(path.join(work, "cameras.json"));
  if (hash(path.join(work, "cameras.json")) !== solve.cameraMetadataSha256)
    throw new Error("Camera metadata changed after the solve.");
  if (hash(output) !== training.plySha256 || training.settings.keepCrs !== true)
    throw new Error("Training PLY or coordinate settings changed. Import requires --keep-crs.");
  write(
    path.join(work, `${id}.json`),
    importMetadata(prep, cameras, solve, training, fs.statSync(output).size),
  );
  console.log(`Import pair: ${output} and ${path.join(work, `${id}.json`)}. Review the filmed path before the Operator makes compact phone tiers.`); // prettier-ignore
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  await main();

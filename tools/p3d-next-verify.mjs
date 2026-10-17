// MIT. Verify evidence bytes independently before publishing any conclusion.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
const root = path.resolve(process.argv[2] || ".cache/photo-3d-next");
const read = (file) => JSON.parse(fs.readFileSync(file));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const check = (actual, expected, label) => {
  if (actual !== expected) throw new Error("Evidence differs: " + label);
};
const proof = {
  verifiedUTC: new Date().toISOString(),
  inputs: 0,
  views: 0,
  targets: 0,
  depthOutputs: 0,
};
const inputs = read(path.join(root, "production-inputs/inputs.json"));
if (!inputs.complete || inputs.rows.length !== 817)
  throw new Error("Incomplete production tensors");
const manifest = read(path.join(root, "depth-inputs.json"));
for (const row of inputs.rows) {
  const source = manifest.find((x) => x.id === row.id);
  check(hash(fs.readFileSync(source.file)), row.photoSha256, row.id + " photo");
  check(
    hash(fs.readFileSync(path.join(root, "production-inputs", row.id + ".f32"))),
    row.rgbSha256,
    row.id + " RGB",
  );
  check(
    JSON.stringify(read(path.join(root, "production-inputs", row.id + ".json"))),
    JSON.stringify(row),
    row.id + " metadata",
  );
  proof.inputs++;
}
proof.changedViews = {};
const captures = ["classic", "layered-a-v2", "layered-b-v2"];
let classic;
for (const name of captures) {
  const folder = path.join(root, name),
    capture = read(path.join(folder, "capture.json"));
  if (!capture.complete || capture.rows.length !== 24) throw new Error("Incomplete " + name);
  if (name === "classic") classic = capture;
  proof.changedViews[name] = 0;
  const unique = new Set();
  for (const row of capture.rows) {
    const key = row.id + "/" + row.profile;
    if (row.errors.length || row.externalRequests.length)
      throw new Error("Capture error or external request: " + key);
    if (unique.has(key) || row.rows.length !== 9 || row.targetCameras.length !== 9)
      throw new Error("Duplicate or incomplete " + key);
    unique.add(key);
    const base = classic.rows.find((r) => r.id === row.id && r.profile === row.profile);
    check(row.photoHash, base.photoHash, key + " photo");
    check(JSON.stringify(row.targetCameras), JSON.stringify(base.targetCameras), key + " camera");
    if (
      name !== "classic" &&
      (!row.overlayProof.hits.includes("worker") ||
        !row.overlayProof.hits.includes("shader") ||
        !row.overlayProof.fillStats)
    )
      throw new Error("Overlay did not execute");
    const poses = new Set();
    for (const frame of row.rows) {
      const pose = frame.yaw + "/" + frame.pitch;
      if (poses.has(pose)) throw new Error("Duplicate pose");
      poses.add(pose);
      for (const [file, expected] of Object.entries(frame.artifacts))
        check(hash(fs.readFileSync(path.join(folder, file))), expected, file);
      const png = PNG.sync.read(fs.readFileSync(path.join(folder, frame.image)));
      check(hash(png.data), frame.rgbaSha256, frame.image + " decoded RGBA");
      const prior = base.rows.find((r) => r.yaw === frame.yaw && r.pitch === frame.pitch);
      if (frame.rgbaSha256 !== prior.rgbaSha256) proof.changedViews[name]++;
      proof.views++;
    }
  }
}
const truth = read(path.join(root, "targets-guided/targets.json"));
if (!truth.complete || truth.records.length !== 216 || truth.jobs.length !== 24)
  throw new Error("Incomplete truth");
for (const row of truth.records) {
  const base = classic.rows.find((r) => r.id === "truth-" + row.scene && r.profile === row.profile);
  check(row.sourcePhotoHash, base.photoHash, "truth source");
  const camera = base.targetCameras.find(
    (c) => c.yaw === row.camera.yaw && c.pitch === row.camera.pitch,
  );
  check(JSON.stringify(camera), JSON.stringify(row.camera), "truth camera");
  const { width: w, height: h } = row.pose,
    focal = Math.min(w, h) / (2 * Math.tan((camera.fov * Math.PI) / 360));
  if (Math.abs(row.pose.K[0][0] - focal) > 1e-8 || Math.abs(row.pose.K[1][1] - focal) > 1e-8)
    throw new Error("Incorrect lens axis");
  for (const key of ["rgb", "mask", "depth"])
    check(
      hash(fs.readFileSync(path.join(root, "targets-guided", row.folder, row.pose[key]))),
      row.artifactHashes[key],
      "truth " + key,
    );
  proof.targets++;
}
const modelFiles = {
  da2: "vendor/depth-anything-v2-small/model_quantized.onnx",
  distill: root + "/models/FuryTMP--Distill-Any-Depth-Small-onnx.onnx",
  "da3-small": root + "/models/josazar--da3-small-onnx.onnx",
  "moge-small": root + "/models/Ruicheng--moge-2-vits-normal-onnx.onnx",
  "da3-base": root + "/models/depth-anything--DA3-BASE/model.safetensors",
  "da3-mono-large": root + "/models/depth-anything--DA3MONO-LARGE/model.safetensors",
  "moge-large": root + "/models/Ruicheng--moge-2-vitl-normal/model.pt",
  "moge-small-300-int8": root + "/models/moge-small-matmul-int8.onnx",
};
proof.models = [];
for (const name of [
  "da2",
  "distill",
  "da3-small",
  "moge-small",
  "da3-base",
  "da3-mono-large",
  "moge-large",
  "moge-small-300-int8",
]) {
  const folder = path.join(root, "production-" + name),
    result = read(path.join(folder, "depth.json"));
  check(hash(fs.readFileSync(modelFiles[name])), result.modelSha256, name + " model bytes");
  for (const row of result.rows) {
    check(hash(fs.readFileSync(row.file)), row.photoSha256, "depth photo");
    check(
      hash(fs.readFileSync(path.join(folder, row.id + ".f32"))),
      row.rawSha256,
      "raw inverse depth",
    );
    if (fs.statSync(path.join(folder, row.id + ".f32")).size !== row.w * row.h * 4)
      throw new Error("Depth dimensions differ");
    proof.depthOutputs++;
  }
  proof.models.push({
    model: name,
    inputs: result.rows.length,
    complete: result.complete,
    modelSha256: result.modelSha256,
  });
}
proof.browserDepthOutputs = 0;
const browserStudy = read(path.join(root, "wasm-quality/wasm.json"));
if (!browserStudy.complete || browserStudy.models.length !== 4)
  throw new Error("Incomplete browser quality study");
for (const model of browserStudy.models) {
  if (model.error || model.rows.length !== 12) throw new Error("Missing browser model outputs");
  for (const row of model.rows) {
    const input = inputs.rows.find((r) => r.id === row.id);
    check(row.rgbHash, input.rgbSha256, "browser RGB input");
    for (const output of row.outputs)
      check(
        hash(fs.readFileSync(path.join(root, "wasm-quality", output.file))),
        output.sha256,
        "browser forward output",
      );
  }
  const folder = path.join(root, "browser-" + model.id),
    result = read(path.join(folder, "depth.json"));
  check(result.modelSha256, model.modelSha256, "browser model identity");
  for (const row of result.rows) {
    check(
      hash(fs.readFileSync(path.join(folder, row.id + ".f32"))),
      row.rawSha256,
      "browser inverse depth",
    );
    check(
      row.inputRgbSha256,
      inputs.rows.find((r) => r.id === row.id).rgbSha256,
      "postprocessed browser input",
    );
    proof.browserDepthOutputs++;
    if (model.id === "da2") {
      const actual = read(path.join(root, "classic/renders", row.id + "-phone-model-depth.json"));
      const bytes = Buffer.alloc(actual.d.length * 4);
      actual.d.forEach((v, i) => bytes.writeFloatLE(v, i * 4));
      check(hash(bytes), row.rawSha256, "actual app baseline output");
    }
  }
}
fs.writeFileSync(path.join(root, "integrity.json"), JSON.stringify(proof, null, 2));
console.log(JSON.stringify(proof));

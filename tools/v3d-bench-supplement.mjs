#!/usr/bin/env node
// MIT. Made by Ryan with Codex (GPT-6). Separate diagnostics for evaluation-stage timeouts.
// prepare <manifest> <corpus> <original-run> <fresh-output> --id=clip --profile=phone
//   --cleanup=main|photometric [--snapshot=<independent-saved-run>]
// render <prepared-output> [--url=<same frozen production source>] [--timeout=600000]
// prepare is CPU/read-only. render uses the production viewer and needs a separate quiet slot.
// Original strict statuses and censored timings are never changed or recovered.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import { fingerprint, rowKey } from "./v3d-bench-metrics.mjs";
import { imageMetrics, interpolateCamera } from "./cdx-v3d-clarity-metrics.mjs";
import {
  FRAME_REPLACEMENT,
  sessionObserver,
  servedSourceFingerprint,
  withHostDeadline,
  closeBrowserBounded,
} from "./v3d-bench.mjs";
import { sourceFrameReceipts, assertPixelDisjointness } from "./v3d-bench-pixels.mjs";
import {
  replayPage,
  captureAt,
  assertReplayPixels,
  matchedTimeline,
  REPLAY_SCENE_OBSERVER,
} from "./v3d-review.mjs";

const repo = path.resolve(import.meta.dirname, "..");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const read = (file) => JSON.parse(fs.readFileSync(file));
const write = (file, data) =>
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", { flag: "wx" });
const validHash = (value) => /^[a-f0-9]{64}$/.test(value || "");
const safeId = (value) => /^[a-z0-9][a-z0-9-]*$/.test(value || "");
const inside = (file, dir) => file === dir || file.startsWith(dir + path.sep);
const protocolFiles = [
  "v3d-bench.mjs",
  "v3d-bench-metrics.mjs",
  "v3d-bench-samples.mjs",
  "v3d-bench-pixels.mjs",
  "cdx-v3d-clarity-metrics.mjs",
];
export function originalProtocolFingerprint() {
  return fingerprint({
    version: 3,
    files: protocolFiles.map((file) => ({
      file,
      sha256: hash(fs.readFileSync(path.join(import.meta.dirname, file))),
    })),
    wrappers: {
      observer: sessionObserver.toString(),
      SESSION_NEEDLE: "return new Session(opts);",
      SESSION_REPLACEMENT:
        "const s = new Session(opts); globalThis.__v3dBenchObserve(s); return s;",
      FRAME_NEEDLE: "  return out;",
      FRAME_REPLACEMENT,
    },
  });
}
function toolIdentity() {
  return ["v3d-bench-supplement.mjs", "v3d-review.mjs", ...protocolFiles].map((file) => ({
    file,
    sha256: hash(fs.readFileSync(path.join(import.meta.dirname, file))),
  }));
}
export function caseInventory(folder) {
  const files = [];
  const visit = (relative = "") => {
    for (const name of fs.readdirSync(path.join(folder, relative)).sort()) {
      const file = path.join(relative, name),
        full = path.join(folder, file),
        stat = fs.lstatSync(full);
      if (stat.isSymbolicLink()) throw new Error(`Symlink in original evidence: ${file}.`);
      if (stat.isDirectory()) visit(file);
      else if (stat.isFile())
        files.push({ file, bytes: stat.size, sha256: hash(fs.readFileSync(full)) });
      else throw new Error(`Nonregular original evidence: ${file}.`);
    }
  };
  visit();
  return files;
}
function same(value, expected, message) {
  if (fingerprint(value) !== fingerprint(expected)) throw new Error(message);
}
export function validateSupplementCase({
  run,
  row,
  clip,
  model,
  evaluation,
  ply,
  evaluationBytes,
  result,
}) {
  if (
    !run.provenance ||
    fingerprint(run.provenance) !== run.provenanceSha256 ||
    row.provenanceSha256 !== run.provenanceSha256
  )
    throw new Error("Original provenance/row binding changed.");
  if (run.provenance.protocolSha256 !== originalProtocolFingerprint())
    throw new Error(
      "Original benchmark protocol does not match the frozen evaluator dependencies.",
    );
  if (
    !safeId(row.id) ||
    !["phone", "desktop"].includes(row.profile) ||
    clip.id !== row.id ||
    clip.sha256 !== row.sha256 ||
    !validHash(row.sha256)
  )
    throw new Error("Original input or profile binding changed.");
  const matches = run.results.filter((r) => rowKey(r) === rowKey(row));
  if (matches.length !== 1) throw new Error("Original row is missing or duplicated.");
  same(matches[0], row, "Original selected row changed.");
  same(result, row, "Original result.json does not match its captured run row.");
  if (
    row.status !== "harness-error" ||
    row.phase !== "evaluation" ||
    row.timingCensored !== true ||
    !/host deadline/.test(row.reason || "") ||
    row.consoleErrors?.length
  )
    throw new Error(
      "Only clean evaluation-stage host-deadline timeouts are eligible; strict status stays unchanged.",
    );
  if (!row.modelSha256 || hash(ply) !== row.modelSha256)
    throw new Error("Original PLY checksum mismatch.");
  if (
    !row.evaluationSha256 ||
    hash(evaluationBytes) !== row.evaluationSha256 ||
    evaluation.sha256 !== row.sha256
  )
    throw new Error("Original evaluation inventory checksum mismatch.");
  same(model.stats, row.stats, "Saved metadata stats changed.");
  same(model.timings, row.timings, "Saved metadata timings changed.");
  if (
    row.actualTier !== (row.profile === "phone" ? "phone" : "high") ||
    model.stats?.tier !== row.actualTier
  )
    throw new Error("Saved metadata has the wrong actual training tier.");
  for (const key of ["trainingFrames", "trainingTimes", "timestampEvidence"])
    same(
      model.observed?.[key],
      evaluation[key],
      `Saved metadata ${key} differs from the hash-bound evaluation.`,
    );
  same(row.heldoutEvidence, evaluation.heldoutEvidence, "Held-out evidence binding changed.");
  if (!evaluation.heldoutEvidence?.complete)
    throw new Error("Original independent held-out proof is incomplete.");
  assertPixelDisjointness(evaluation.trainingFrames, evaluation.pixelReceipts, evaluation.times);
  if (
    !Number.isInteger(evaluation.width) ||
    !Number.isInteger(evaluation.height) ||
    evaluation.width < 1 ||
    evaluation.height < 1 ||
    Math.max(evaluation.width, evaluation.height) !== 640 ||
    evaluation.side !== 640 ||
    !Number.isInteger(evaluation.crop?.sx) ||
    !Number.isInteger(evaluation.crop?.sw) ||
    evaluation.crop.sx < 0 ||
    evaluation.crop.sw < 1 ||
    evaluation.times.some((t, i, a) => !Number.isFinite(t) || (i > 0 && t <= a[i - 1]))
  )
    throw new Error("Invalid frozen held-out image geometry or times.");
  same(
    evaluation.sourceFrameIndices,
    evaluation.pixelReceipts.views.map((v) => v.index),
    "Source-frame index inventory changed.",
  );
  const selected = new Set(evaluation.pixelReceipts.matchedTraining.map((f) => f.sourceIndex));
  for (const frame of evaluation.pixelReceipts.views)
    if (!Number.isInteger(frame.index) || frame.index < 0 || selected.has(frame.index))
      throw new Error("Training and held-out source indices overlap or are invalid.");
  matchedTimeline(model, model, { seconds: 1, fps: 1 });
  for (const time of evaluation.times) {
    const a = model.cams.findLast((c) => c.time <= time),
      b = model.cams.find((c) => c.time >= time);
    if (!a || !b || a === b) throw new Error("Held-out camera interval missing from stored path.");
    interpolateCamera(a, b, time);
  }
  return true;
}
function sourceProbe(input, evaluation) {
  const data = JSON.parse(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height:frame=best_effort_timestamp_time",
        "-of",
        "json",
        input,
      ],
      { timeout: 30000 },
    ),
  );
  const stream = data.streams?.[0],
    times = data.frames?.map((f) => Number(f.best_effort_timestamp_time));
  if (
    !stream ||
    !times?.length ||
    times.some((t, i) => !Number.isFinite(t) || (i > 0 && t <= times[i - 1])) ||
    evaluation.crop.sx + evaluation.crop.sw > stream.width
  )
    throw new Error("Source timestamps or frozen crop are invalid.");
  for (const f of evaluation.pixelReceipts.views)
    if (Math.abs(times[f.index] - f.time) >= 0.000001 || !Number.isFinite(times[f.index]))
      throw new Error("Held-out receipt does not match the decoded exact source frame.");
  for (const f of evaluation.pixelReceipts.matchedTraining)
    if (
      !Number.isInteger(f.sourceIndex) ||
      f.sourceIndex < 0 ||
      !Number.isFinite(times[f.sourceIndex]) ||
      Math.abs(times[f.sourceIndex] - f.sourceTime) >= 0.0001
    )
      throw new Error("Training receipt does not match the decoded exact source frame.");
  return { stream, times };
}
function environmentMatches(environment) {
  if (
    !environment?.executablePath ||
    hash(fs.readFileSync(environment.executablePath)) !== environment.executableSha256
  )
    throw new Error("Original browser executable checksum mismatch.");
  for (const command of ["ffmpeg", "ffprobe"])
    if (
      execFileSync(command, ["-version"], { encoding: "utf8", timeout: 30000 }).split("\n")[0] !==
      environment[command]
    )
      throw new Error(`Original ${command} version changed.`);
}
function freshOutput(output, inputs) {
  output = path.resolve(output);
  if (fs.existsSync(output))
    throw new Error("Supplement output must be fresh; retain previous evidence.");
  let existing = path.dirname(output);
  while (!fs.existsSync(existing)) existing = path.dirname(existing);
  output = path.resolve(fs.realpathSync(existing), path.relative(existing, output));
  const productName = read(path.join(repo, "package.json")).name;
  for (let at = path.dirname(output); ; at = path.dirname(at)) {
    const file = path.join(at, "package.json");
    if (
      inside(output, fs.realpathSync(repo)) ||
      (fs.existsSync(file) && read(file).name === productName)
    )
      throw new Error("Supplement output must stay outside product repositories.");
    if (at === path.dirname(at)) break;
  }
  for (const input of inputs.map((p) => fs.realpathSync(p)))
    if (inside(output, input) || inside(input, output))
      throw new Error("Supplement output overlaps original evidence.");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  return output;
}
function selectedRow(run, id, profile) {
  const rows = run.results.filter((r) => r.id === id && r.profile === profile);
  if (rows.length !== 1) throw new Error("Selected original row is missing or duplicated.");
  return rows[0];
}
function assertSnapshotUntouched(binding) {
  const run = read(path.join(binding.originalDirectory, "run.json"));
  if (run.provenanceSha256 !== binding.originalProvenanceSha256)
    throw new Error("Original provenance hash changed during supplemental work.");
  same(
    run.provenance,
    binding.originalProvenance,
    "Original provenance changed during supplemental work.",
  );
  same(run.cohort, binding.originalCohort, "Original cohort changed during supplemental work.");
  same(
    selectedRow(run, binding.id, binding.profile),
    binding.originalRow,
    "Original row changed during supplemental work.",
  );
  same(
    caseInventory(binding.originalCase),
    binding.originalCaseInventory,
    "Original case bytes changed during supplemental work.",
  );
}
export function prepareSupplement({
  manifest,
  corpus,
  original,
  output,
  id,
  profile = "phone",
  cleanup,
  snapshot = null,
}) {
  if (
    !safeId(id) ||
    !["phone", "desktop"].includes(profile) ||
    !["main", "photometric"].includes(cleanup)
  )
    throw new Error("Specify one safe ID, phone|desktop profile, and main|photometric cleanup.");
  original = fs.realpathSync(original);
  const runBytes = fs.readFileSync(path.join(original, "run.json")),
    run = JSON.parse(runBytes),
    row = selectedRow(run, id, profile);
  const manifestBytes = fs.readFileSync(manifest),
    clips = JSON.parse(manifestBytes),
    clip = clips.find((c) => c.id === id);
  if (
    hash(manifestBytes) !== run.provenance?.manifestSha256 ||
    !clip ||
    !safeId(clip.id) ||
    path.basename(clip.file) !== clip.file
  )
    throw new Error("Original manifest/input inventory changed.");
  same(
    run.cohort.inputs,
    clips.map(({ id, sha256 }) => ({ id, sha256 })),
    "Original cohort differs from the manifest.",
  );
  same(
    run.provenance.inputs.map(({ id, sha256 }) => ({ id, sha256 })),
    run.cohort.inputs,
    "Original provenance input hashes differ from the cohort.",
  );
  if (!run.cohort.profiles.includes(profile))
    throw new Error("Profile is outside the original cohort.");
  const sourceEntries = run.provenance.servedSource?.files;
  if (
    !sourceEntries?.length ||
    fingerprint(sourceEntries) !== run.provenance.servedSource.sha256 ||
    new Set(sourceEntries.map((e) => e.file)).size !== sourceEntries.length ||
    sourceEntries.some(
      (e) =>
        typeof e.file !== "string" ||
        ![200, 404].includes(e.status) ||
        (e.status === 200 ? !validHash(e.sha256) : e.sha256 !== null),
    )
  )
    throw new Error("Original served-source inventory is invalid.");
  const input = fs.realpathSync(path.resolve(corpus, clip.file));
  if (hash(fs.readFileSync(input)) !== row.sha256) throw new Error("Input checksum mismatch.");
  const folder = path.join(original, `${id}-${profile}`),
    inventory = caseInventory(folder);
  const modelBytes = fs.readFileSync(path.join(folder, "model.json")),
    model = JSON.parse(modelBytes);
  const evaluationBytes = fs.readFileSync(path.join(folder, "evaluation.json")),
    evaluation = JSON.parse(evaluationBytes);
  validateSupplementCase({
    run,
    row,
    clip,
    model,
    evaluation,
    ply: fs.readFileSync(path.join(folder, "model.ply")),
    evaluationBytes,
    result: read(path.join(folder, "result.json")),
  });
  environmentMatches(run.provenance.environment);
  const probe = sourceProbe(input, evaluation);
  if (row.frames) {
    if (row.frames.length !== evaluation.times.length)
      throw new Error("Original scored-frame inventory is incomplete.");
    for (const [index, frame] of row.frames.entries())
      for (const kind of ["render", "reference"])
        if (
          frame.time !== evaluation.times[index] ||
          hash(fs.readFileSync(path.join(folder, `${kind}-${index}.png`))) !==
            frame[`${kind}Sha256`]
        )
          throw new Error("Original scored-frame checksum changed.");
  }
  for (const file of inventory.filter((f) => /^(render|reference)-.*\.png$/.test(f.file))) {
    const match = /^(render|reference)-(\d+)\.png$/.exec(file.file),
      index = Number(match?.[2]);
    if (!match || index >= evaluation.times.length)
      throw new Error("Unexpected original held-out PNG inventory.");
    const image = PNG.sync.read(fs.readFileSync(path.join(folder, file.file)));
    if (image.width !== evaluation.width || image.height !== evaluation.height)
      throw new Error("Original held-out PNG dimensions changed.");
    const previous = row.frames?.[index];
    if (
      previous &&
      (previous.time !== evaluation.times[index] || previous[`${match[1]}Sha256`] !== file.sha256)
    )
      throw new Error("Original held-out PNG checksum changed.");
  }
  let independentSnapshot = null;
  if (snapshot) {
    snapshot = fs.realpathSync(snapshot);
    const savedRunBytes = fs.readFileSync(path.join(snapshot, "run.json")),
      savedRun = JSON.parse(savedRunBytes);
    same(savedRun.provenance, run.provenance, "Independent saved snapshot provenance differs.");
    same(selectedRow(savedRun, id, profile), row, "Independent saved snapshot row differs.");
    const savedModel = fs.readFileSync(path.join(snapshot, `${id}-${profile}`, "model.json"));
    if (!savedModel.equals(modelBytes))
      throw new Error("Metadata differs from the independently saved snapshot.");
    independentSnapshot = {
      path: snapshot,
      capturedRunSha256: hash(savedRunBytes),
      modelMetadataSha256: hash(savedModel),
      historicallyBenchmarkHashBound: false,
    };
  }
  output = freshOutput(output, [original, corpus, ...(snapshot ? [snapshot] : [])]);
  const binding = {
    version: 1,
    kind: "supplemental-read-only-evaluation",
    id,
    profile,
    clip,
    cleanup,
    preservePhotometric: cleanup === "photometric",
    originalDirectory: original,
    originalCase: folder,
    originalRow: row,
    originalRowFingerprint: fingerprint(row),
    originalProvenance: run.provenance,
    originalProvenanceSha256: run.provenanceSha256,
    originalCohort: run.cohort,
    originalCapturedRunSha256: hash(runBytes),
    originalCaseInventory: inventory,
    sourceInput: { file: input, sha256: row.sha256 },
    sourceProbe: probe,
    independentSnapshot,
    metadataEvidence: {
      sha256: hash(modelBytes),
      newlyHashBound: true,
      historicallyBenchmarkHashBound: false,
      cameraPath:
        "Stored metadata poses are used unchanged; no solve, fitting, or image alignment.",
    },
    environment: run.provenance.environment,
    sourceUrl: run.provenance.url,
    tools: toolIdentity(),
    sceneObserverSha256: hash(REPLAY_SCENE_OBSERVER),
    limitations: [
      "Supplemental quality diagnostics only; original harness-error status remains unchanged.",
      "No censored timing is recovered, and this cannot establish strict benchmark acceptance.",
      "Stored model metadata bytes are newly hash-bound; original benchmark row hashes PLY and evaluation but not model.json.",
      "No stored original render PNG means newly captured read-only evaluation, not original capture verification.",
    ],
  };
  assertSnapshotUntouched(binding);
  fs.mkdirSync(output);
  fs.mkdirSync(path.join(output, "source"));
  fs.writeFileSync(path.join(output, "source", "manifest.json"), manifestBytes, { flag: "wx" });
  fs.writeFileSync(path.join(output, "source", "captured-run.json"), runBytes, { flag: "wx" });
  fs.cpSync(folder, path.join(output, "source", "case"), {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
  same(
    caseInventory(path.join(output, "source", "case")),
    inventory,
    "Original snapshot copy is corrupt.",
  );
  assertSnapshotUntouched(binding);
  write(path.join(output, "binding.json"), binding);
  return {
    output,
    bindingSha256: hash(fs.readFileSync(path.join(output, "binding.json"))),
    status: "prepared",
    originalStatus: row.status,
  };
}
export function loadPrepared(output) {
  const bytes = fs.readFileSync(path.join(output, "binding.json")),
    binding = JSON.parse(bytes),
    source = path.join(output, "source");
  if (binding.kind !== "supplemental-read-only-evaluation")
    throw new Error("Not a supplemental snapshot.");
  same(
    binding.tools,
    toolIdentity(),
    "Supplemental evaluator/dependencies changed since preparation.",
  );
  same(
    caseInventory(path.join(source, "case")),
    binding.originalCaseInventory,
    "Prepared original-case snapshot changed.",
  );
  const runBytes = fs.readFileSync(path.join(source, "captured-run.json")),
    run = JSON.parse(runBytes);
  if (
    hash(runBytes) !== binding.originalCapturedRunSha256 ||
    hash(fs.readFileSync(path.join(source, "manifest.json"))) !== run.provenance.manifestSha256
  )
    throw new Error("Prepared run/manifest bytes changed.");
  same(run.provenance, binding.originalProvenance, "Prepared provenance changed.");
  same(
    binding.environment,
    run.provenance.environment,
    "Prepared browser/environment binding changed.",
  );
  const sourceClips = read(path.join(source, "manifest.json"));
  same(
    sourceClips.find((c) => c.id === binding.id),
    binding.clip,
    "Prepared source/license metadata changed.",
  );
  same(
    selectedRow(run, binding.id, binding.profile),
    binding.originalRow,
    "Prepared selected row changed.",
  );
  if (
    fingerprint(binding.originalRow) !== binding.originalRowFingerprint ||
    fingerprint(binding.originalProvenance) !== binding.originalProvenanceSha256
  )
    throw new Error("Prepared original row/provenance fingerprint changed.");
  const folder = path.join(source, "case"),
    model = read(path.join(folder, "model.json")),
    evaluationBytes = fs.readFileSync(path.join(folder, "evaluation.json")),
    evaluation = JSON.parse(evaluationBytes);
  validateSupplementCase({
    run,
    row: binding.originalRow,
    clip: binding.clip,
    model,
    evaluation,
    evaluationBytes,
    ply: fs.readFileSync(path.join(folder, "model.ply")),
    result: read(path.join(folder, "result.json")),
  });
  if (
    hash(fs.readFileSync(path.join(folder, "model.json"))) !== binding.metadataEvidence.sha256 ||
    binding.sourceInput.sha256 !== binding.originalRow.sha256 ||
    hash(fs.readFileSync(binding.sourceInput.file)) !== binding.sourceInput.sha256
  )
    throw new Error("Newly bound metadata or input bytes changed.");
  assertSnapshotUntouched(binding);
  return { binding, bindingSha256: hash(bytes), folder, model, evaluation };
}
export async function renderSupplement(output, { url = null, timeout = 600000 } = {}) {
  output = fs.realpathSync(output);
  if (!Number.isFinite(timeout) || timeout < 1000)
    throw new Error("Invalid supplemental host deadline.");
  const prepared = loadPrepared(output),
    { binding, folder, model, evaluation } = prepared;
  const destination = path.join(output, "derived");
  if (fs.existsSync(destination))
    throw new Error("Derived output already exists; retain it and prepare a fresh snapshot.");
  environmentMatches(binding.environment);
  const probe = sourceProbe(binding.sourceInput.file, evaluation);
  same(probe, binding.sourceProbe, "Decoded source inventory changed after preparation.");
  url ||= binding.sourceUrl;
  const verifyServed = async () => {
    const served = await servedSourceFingerprint(
      url,
      binding.originalProvenance.servedSource.files.map((f) => f.file),
    );
    if (served.sha256 !== binding.originalProvenance.servedSource.sha256)
      throw new Error("Frozen production viewer source differs from the original bake.");
    return served;
  };
  const served = await verifyServed();
  fs.mkdirSync(destination);
  let browser,
    server,
    expired = false;
  const active = () => {
    if (expired) {
      server?.process()?.kill("SIGKILL");
      throw new Error("Supplemental host deadline expired.");
    }
  };
  const report = {
    kind: "supplemental-read-only-evaluation",
    status: "pending",
    bindingSha256: prepared.bindingSha256,
    originalStatus: binding.originalRow.status,
    originalTimingCensored: true,
    strictAcceptanceEvidence: false,
    timingRecovered: false,
    originalMetadataByteVerification: false,
    sourceUrl: url,
    servedSourceSha256: served.sha256,
    metadataEvidence: binding.metadataEvidence,
    cleanup: binding.cleanup,
    frames: [],
    limitations: binding.limitations,
  };
  try {
    await withHostDeadline(
      async () => {
        server = await chromium.launchServer({
          executablePath: binding.environment.executablePath,
          args: binding.environment.launchArgs,
        });
        active();
        browser = await chromium.connect(server.wsEndpoint());
        active();
        if (browser.version() !== binding.environment.browserVersion)
          throw new Error("Original browser version changed.");
        const replay = await replayPage(
          browser,
          {
            folder,
            model,
            evaluation,
            row: { frames: [] },
            url,
            preservePhotometric: binding.preservePhotometric,
          },
          binding.clip,
          binding.profile,
        );
        active();
        report.scene = replay.scene;
        const receipts = await replay.page.evaluate(sourceFrameReceipts, {
          base64: fs.readFileSync(binding.sourceInput.file).toString("base64"),
          sourceTimes: probe.times,
          times: evaluation.times,
          trainingFrames: evaluation.trainingFrames,
          crop: evaluation.crop,
        });
        active();
        assertPixelDisjointness(evaluation.trainingFrames, receipts, evaluation.times);
        same(
          receipts.views,
          evaluation.pixelReceipts.views,
          "New independent held-out JPEG receipts differ from the original proof.",
        );
        same(
          receipts.matchedTraining,
          evaluation.pixelReceipts.matchedTraining,
          "New independent training JPEG receipts differ from the original proof.",
        );
        write(path.join(destination, "pixel-receipts.json"), receipts);
        report.pixelDisjointnessReverified = true;
        for (const [index, time] of evaluation.times.entries()) {
          const bytes = await captureAt(replay.page, time, evaluation.width, evaluation.height);
          active();
          const renderName = `render-${index}.png`,
            referenceName = `reference-${index}.png`;
          const savedRender = path.join(folder, renderName),
            savedReference = path.join(folder, referenceName);
          const frame = {
            time,
            sourceIndex: evaluation.sourceFrameIndices[index],
            renderSha256: hash(bytes),
            originalRenderVerification: fs.existsSync(savedRender)
              ? assertReplayPixels(
                  bytes,
                  fs.readFileSync(savedRender),
                  hash(fs.readFileSync(savedRender)),
                )
              : null,
            captureEvidence: fs.existsSync(savedRender)
              ? "Exact original saved render reproduced"
              : "New read-only evaluation; no original saved render exists",
          };
          fs.writeFileSync(path.join(destination, renderName), bytes, { flag: "wx" });
          execFileSync(
            "ffmpeg",
            [
              "-nostdin",
              "-v",
              "error",
              "-n",
              "-threads",
              "1",
              "-i",
              binding.sourceInput.file,
              "-frames:v",
              "1",
              "-vf",
              `select=eq(n\\,${frame.sourceIndex}),crop=${evaluation.crop.sw}:${probe.stream.height}:${evaluation.crop.sx}:0,scale=${evaluation.width}:${evaluation.height}:flags=bicubic`,
              "-fps_mode",
              "vfr",
              "-threads",
              "1",
              path.join(destination, referenceName),
            ],
            { timeout: 30000 },
          );
          const reference = fs.readFileSync(path.join(destination, referenceName));
          if (fs.existsSync(savedReference) && !reference.equals(fs.readFileSync(savedReference)))
            throw new Error("Original saved FFmpeg reference PNG changed.");
          Object.assign(frame, {
            referenceSha256: hash(reference),
            ...imageMetrics(PNG.sync.read(bytes), PNG.sync.read(reference)),
          });
          report.frames.push(frame);
        }
        if (replay.errors.length)
          throw new Error(`Supplemental replay errors: ${replay.errors.join("; ")}`);
      },
      {
        timeoutMs: timeout,
        onTimeout: () => {
          expired = true;
          server?.process()?.kill("SIGKILL");
        },
        label: `${binding.id} supplemental evaluation`,
      },
    );
    loadPrepared(output);
    await verifyServed();
    report.mean = Object.fromEntries(
      ["psnr", "ssim", "laplacian", "sourceLaplacian"].map((key) => [
        key,
        report.frames.reduce((s, f) => s + f[key], 0) / report.frames.length,
      ]),
    );
    report.originalRenderPngsExactlyVerified = report.frames.filter(
      (f) => f.originalRenderVerification,
    ).length;
    report.originalCaptureVerificationComplete =
      report.originalRenderPngsExactlyVerified === evaluation.times.length;
    report.status = "supplemental-quality-diagnostic";
  } catch (error) {
    report.status = "supplemental-error";
    report.reason = String(error.stack || error);
    process.exitCode = 1;
  } finally {
    await closeBrowserBounded(browser, server);
    report.artifacts = caseInventory(destination);
    write(path.join(destination, "report.json"), report);
  }
  return report;
}
export async function main(args = process.argv.slice(2)) {
  const mode = args[0],
    positional = args.slice(1).filter((a) => !a.startsWith("--"));
  const option = (name, fallback = null) =>
    args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
  if (mode === "prepare" && positional.length === 4)
    return prepareSupplement({
      manifest: positional[0],
      corpus: positional[1],
      original: positional[2],
      output: positional[3],
      id: option("id"),
      profile: option("profile", "phone"),
      cleanup: option("cleanup"),
      snapshot: option("snapshot"),
    });
  if (mode === "render" && positional.length === 1)
    return renderSupplement(positional[0], {
      url: option("url"),
      timeout: Number(option("timeout", "600000")),
    });
  throw new Error(
    "Use prepare <manifest> <corpus> <original-run> <fresh-output> --id=clip --cleanup=main|photometric, or render <prepared-output>.",
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  console.log(JSON.stringify(await main(), null, 2));

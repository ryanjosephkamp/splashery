import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { PNG } from "pngjs";
import { fingerprint } from "../tools/v3d-bench-metrics.mjs";
import {
  originalProtocolFingerprint,
  caseInventory,
  prepareSupplement,
  loadPrepared,
  renderSupplement,
} from "../tools/v3d-bench-supplement.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
const read = (file) => JSON.parse(fs.readFileSync(file));
const version = (command) =>
  execFileSync(command, ["-version"], { encoding: "utf8" }).split("\n")[0];
const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const roots = [];
test.afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "v3d-supplement-cpu-"));
  roots.push(root);
  const corpus = path.join(root, "corpus"),
    original = path.join(root, "original"),
    folder = path.join(original, "capture-phone");
  fs.mkdirSync(corpus);
  fs.mkdirSync(folder, { recursive: true });
  const input = path.join(corpus, "capture.mp4");
  execFileSync("ffmpeg", [
    "-nostdin",
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=32x32:rate=4:duration=3",
    "-an",
    "-c:v",
    "libx264",
    "-threads",
    "1",
    input,
  ]);
  const clip = {
    id: "capture",
    label: "CPU-only fixture",
    file: "capture.mp4",
    sha256: hash(fs.readFileSync(input)),
    author: "Fixture author",
    license: "CC0",
    licenseUrl: "https://example.org/license",
    source: "https://example.org/source",
    transformation: "CPU-generated test fixture only.",
  };
  const manifest = path.join(root, "manifest.json");
  json(manifest, [clip]);
  const training = {
    time: 1,
    requestedTime: 1,
    presentedTime: null,
    timestampEvidence: "requested-time-only",
    width: 32,
    height: 32,
    sha256: "a".repeat(64),
  };
  const evaluation = {
    sha256: clip.sha256,
    times: [0.5, 1.5],
    width: 640,
    height: 640,
    side: 640,
    crop: { sx: 0, sw: 32 },
    trainingFrames: [training],
    trainingTimes: [1],
    timestampEvidence: "requested-time-only",
    sourceFrameIndices: [2, 6],
    heldoutEvidence: {
      trainingPresentationVerified: false,
      trainingJpegsIndependentlyMatched: true,
      referencePresentationVerified: true,
      pixelDisjointnessVerified: true,
      complete: true,
    },
    pixelReceipts: {
      matchedTraining: [
        { sha256: training.sha256, repeatedSha256: training.sha256, sourceIndex: 4, sourceTime: 1 },
      ],
      views: [0.5, 1.5].map((time, i) => ({
        index: [2, 6][i],
        time,
        mediaTime: time,
        width: 32,
        height: 32,
        sha256: String(i + 2).repeat(64),
        repeatedSha256: String(i + 2).repeat(64),
      })),
    },
  };
  const stats = { tier: "phone", frames: 1, registered: 2, points: 1, splats: 1 },
    timings = { train: 1, total: 2 };
  const model = {
    stats,
    timings,
    cams: [
      { time: 0, R: identity, t: [0, 0, 0], f: 30, w: 32, h: 32 },
      { time: 2.5, R: identity, t: [-0.1, 0, 0], f: 30, w: 32, h: 32 },
    ],
    observed: {
      trainingFrames: [training],
      trainingTimes: [1],
      timestampEvidence: "requested-time-only",
    },
  };
  fs.writeFileSync(
    path.join(folder, "model.ply"),
    "ply\nformat binary_little_endian 1.0\nelement vertex 0\nend_header\n",
  );
  json(path.join(folder, "model.json"), model);
  json(path.join(folder, "evaluation.json"), evaluation);
  const sourceFiles = [{ file: "index.html", status: 200, sha256: "d".repeat(64) }];
  const provenance = {
    protocolSha256: originalProtocolFingerprint(),
    manifestSha256: hash(fs.readFileSync(manifest)),
    servedSource: { sha256: fingerprint(sourceFiles), files: sourceFiles },
    url: "http://127.0.0.1:4174/",
    reference: null,
    inputs: [{ id: clip.id, file: clip.file, sha256: clip.sha256 }],
    environment: {
      executablePath: process.execPath,
      executableSha256: hash(fs.readFileSync(process.execPath)),
      browserVersion: "cpu-fixture-no-browser",
      launchArgs: [],
      ffmpeg: version("ffmpeg"),
      ffprobe: version("ffprobe"),
    },
    options: {},
  };
  const row = {
    id: clip.id,
    profile: "phone",
    sha256: clip.sha256,
    status: "harness-error",
    phase: "evaluation",
    timingCensored: true,
    reason: "CPU fixture exceeded its host deadline.",
    consoleErrors: [],
    provenanceSha256: fingerprint(provenance),
    modelSha256: hash(fs.readFileSync(path.join(folder, "model.ply"))),
    evaluationSha256: hash(fs.readFileSync(path.join(folder, "evaluation.json"))),
    heldoutEvidence: evaluation.heldoutEvidence,
    actualTier: "phone",
    stats,
    timings,
    mean: null,
    bakeMs: 999,
  };
  const run = {
    provenance,
    provenanceSha256: fingerprint(provenance),
    cohort: { inputs: [{ id: clip.id, sha256: clip.sha256 }], profiles: ["phone", "desktop"] },
    results: [row],
  };
  json(path.join(original, "run.json"), run);
  json(path.join(folder, "result.json"), row);
  const options = {
    manifest,
    corpus,
    original,
    output: path.join(root, "prepared"),
    id: "capture",
    profile: "phone",
    cleanup: "main",
  };
  return { root, corpus, original, folder, manifest, clip, model, evaluation, row, run, options };
}
function resign(f) {
  json(path.join(f.folder, "evaluation.json"), f.evaluation);
  f.row.evaluationSha256 = hash(fs.readFileSync(path.join(f.folder, "evaluation.json")));
  f.run.provenanceSha256 = fingerprint(f.run.provenance);
  f.row.provenanceSha256 = f.run.provenanceSha256;
  json(path.join(f.folder, "result.json"), f.row);
  json(path.join(f.original, "run.json"), f.run);
}

test("supplement snapshots every raw case byte and keeps timeout status/timing untouched", () => {
  const f = fixture(),
    before = caseInventory(f.folder),
    runBytes = fs.readFileSync(path.join(f.original, "run.json"));
  const result = prepareSupplement(f.options),
    loaded = loadPrepared(result.output);
  expect(caseInventory(path.join(result.output, "source", "case"))).toEqual(before);
  expect(fs.readFileSync(path.join(result.output, "source", "captured-run.json"))).toEqual(
    runBytes,
  );
  expect(fs.readFileSync(path.join(f.original, "run.json"))).toEqual(runBytes);
  expect(caseInventory(f.folder)).toEqual(before);
  expect(loaded.binding.originalRow.status).toBe("harness-error");
  expect(loaded.binding.originalRow.timingCensored).toBe(true);
  expect(loaded.binding.originalRow.bakeMs).toBe(999);
  expect(loaded.binding.metadataEvidence).toMatchObject({
    newlyHashBound: true,
    historicallyBenchmarkHashBound: false,
  });
  expect(loaded.binding.originalRow.mean).toBeNull();
});

test("corrupt PLY, evaluation, result row, and protocol fail before a prepared output exists", () => {
  for (const kind of ["ply", "evaluation", "result", "protocol"]) {
    const f = fixture();
    if (kind === "ply") fs.appendFileSync(path.join(f.folder, "model.ply"), "corruption");
    if (kind === "evaluation") fs.appendFileSync(path.join(f.folder, "evaluation.json"), " ");
    if (kind === "result") json(path.join(f.folder, "result.json"), { ...f.row, phase: "other" });
    if (kind === "protocol") {
      f.run.provenance.protocolSha256 = "f".repeat(64);
      resign(f);
    }
    expect(() => prepareSupplement(f.options)).toThrow(/checksum|result.json|protocol/);
    expect(fs.existsSync(f.options.output)).toBe(false);
  }
});

test("resigned overlap and false decoded frame receipts still fail independently", () => {
  const overlap = fixture();
  overlap.evaluation.pixelReceipts.views[0].sha256 = overlap.evaluation.trainingFrames[0].sha256;
  overlap.evaluation.pixelReceipts.views[0].repeatedSha256 =
    overlap.evaluation.trainingFrames[0].sha256;
  resign(overlap);
  expect(() => prepareSupplement(overlap.options)).toThrow(/also used for training/);
  const mismatch = fixture();
  mismatch.evaluation.pixelReceipts.views[0].index = 3;
  mismatch.evaluation.sourceFrameIndices[0] = 3;
  resign(mismatch);
  expect(() => prepareSupplement(mismatch.options)).toThrow(/decoded exact source frame/);
});

test("independent saved snapshot detects camera metadata changes lacking a historical hash", () => {
  const f = fixture(),
    snapshot = path.join(f.root, "independent");
  fs.cpSync(f.original, snapshot, { recursive: true });
  prepareSupplement({ ...f.options, snapshot });
  const binding = read(path.join(f.options.output, "binding.json"));
  expect(binding.independentSnapshot.modelMetadataSha256).toBe(
    hash(fs.readFileSync(path.join(f.folder, "model.json"))),
  );
  expect(binding.independentSnapshot.historicallyBenchmarkHashBound).toBe(false);
  f.model.cams[0].t[0] += 0.5;
  json(path.join(f.folder, "model.json"), f.model);
  expect(() =>
    prepareSupplement({ ...f.options, output: path.join(f.root, "other"), snapshot }),
  ).toThrow(/independently saved snapshot/);
});

test("prepared model/PNG corruption and removed original rows fail closed", () => {
  for (const kind of ["metadata", "png", "row"]) {
    const f = fixture();
    if (kind === "png")
      fs.writeFileSync(
        path.join(f.folder, "render-1.png"),
        PNG.sync.write({ width: 640, height: 640, data: Buffer.alloc(640 * 640 * 4, 255) }),
      );
    prepareSupplement(f.options);
    if (kind === "metadata")
      fs.appendFileSync(path.join(f.options.output, "source", "case", "model.json"), " ");
    if (kind === "png")
      fs.appendFileSync(path.join(f.options.output, "source", "case", "render-1.png"), "changed");
    if (kind === "row") {
      f.run.results = [];
      json(path.join(f.original, "run.json"), f.run);
    }
    expect(() => loadPrepared(f.options.output)).toThrow(/snapshot changed|row is missing/);
  }
});

test("unrelated appended rows are allowed but edits to original evidence are rejected", () => {
  const f = fixture();
  prepareSupplement(f.options);
  f.run.results.push({ id: "unrelated", profile: "desktop", status: "pending" });
  json(path.join(f.original, "run.json"), f.run);
  expect(loadPrepared(f.options.output).binding.originalRow.status).toBe("harness-error");
  fs.appendFileSync(path.join(f.folder, "model.json"), " ");
  expect(() => loadPrepared(f.options.output)).toThrow(/Original case bytes changed/);
});

test("fresh destination, overlap, malformed PNG, and symlink policies preserve evidence", () => {
  const f = fixture();
  fs.mkdirSync(f.options.output);
  expect(() => prepareSupplement(f.options)).toThrow(/must be fresh/);
  expect(() =>
    prepareSupplement({ ...f.options, output: path.join(f.original, "nested", "output") }),
  ).toThrow(/overlaps/);
  expect(fs.existsSync(path.join(f.original, "nested"))).toBe(false);
  fs.writeFileSync(path.join(f.folder, "render-0.png"), "not PNG");
  expect(() => prepareSupplement({ ...f.options, output: path.join(f.root, "bad-png") })).toThrow();
  fs.unlinkSync(path.join(f.folder, "render-0.png"));
  fs.symlinkSync(path.join(f.folder, "model.json"), path.join(f.folder, "linked.json"));
  expect(() => prepareSupplement({ ...f.options, output: path.join(f.root, "symlink") })).toThrow(
    /Symlink/,
  );
});

test("existing derived output blocks any browser launch and cannot become strict evidence", async () => {
  const f = fixture();
  prepareSupplement(f.options);
  fs.mkdirSync(path.join(f.options.output, "derived"));
  await expect(renderSupplement(f.options.output)).rejects.toThrow(/Derived output already exists/);
  expect(read(path.join(f.original, "run.json")).results[0]).toEqual(f.row);
});

test("changed served viewer and browser bytes fail before any browser launch", async () => {
  const f = fixture();
  prepareSupplement(f.options);
  const server = createServer((_request, response) => response.end("changed production source"));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await expect(
      renderSupplement(f.options.output, {
        url: `http://127.0.0.1:${server.address().port}/`,
      }),
    ).rejects.toThrow(/Frozen production viewer source differs/);
    expect(fs.existsSync(path.join(f.options.output, "derived"))).toBe(false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  const bindingFile = path.join(f.options.output, "binding.json"),
    binding = read(bindingFile);
  binding.environment.executableSha256 = "0".repeat(64);
  json(bindingFile, binding);
  expect(() => loadPrepared(f.options.output)).toThrow(/browser\/environment binding/);
});

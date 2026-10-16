import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { PNG } from "pngjs";
import { fingerprint, benchmarkCohort } from "../tools/v3d-bench-metrics.mjs";
import {
  reviewSelection,
  matchedTimeline,
  assertReplayPixels,
  assertReplayScene,
  REPLAY_SCENE_OBSERVER,
  pairedRgba,
  attribution,
  startReviewEncoder,
  main as review,
} from "../tools/v3d-review.mjs";

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const clip = (i) => ({
  id: `clip-${i}`,
  label: `Capture ${i}`,
  sha256: "a".repeat(64),
  author: "Source author",
  license: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  source: `https://example.org/File:Capture_${i}%27s.webm`,
  transformation: "Trimmed; audio removed.",
});
const rejection = {
  status: "explained",
  mean: null,
  reason: "Too little motion. Try moving sideways.",
  explanation: { visible: true, diagnostic: "Too little motion.", advice: "Try moving sideways." },
};
function fixture(count = 10, changes = {}) {
  const clips = Array.from({ length: count }, (_, i) => clip(i));
  const cohort = benchmarkCohort(clips);
  const provenance = {
    protocolSha256: "protocol",
    environment: {},
    options: {},
    servedSource: { sha256: "main" },
    reference: null,
  };
  const mainSha = fingerprint(provenance);
  const rows = clips.map((c, i) => ({
    id: c.id,
    profile: "phone",
    sha256: c.sha256,
    status: "finished",
    consoleErrors: [],
    firstViewMs: 100,
    bakeMs: 200,
    evaluationSha256: "e".repeat(64),
    heldoutEvidence: { complete: true },
    frames: [{ time: 1, referenceSha256: "f".repeat(64) }],
    mean: { ssim: 0.2, laplacian: 0.01 },
    ...changes.main?.[i],
    provenanceSha256: mainSha,
  }));
  const mainRun = { cohort, provenance, provenanceSha256: mainSha, results: rows };
  const candidateProvenance = {
    ...provenance,
    servedSource: { sha256: "candidate" },
    reference: { provenanceSha256: mainSha },
  };
  const candidateSha = fingerprint(candidateProvenance);
  const candidateRun = {
    cohort,
    provenance: candidateProvenance,
    provenanceSha256: candidateSha,
    results: rows.map((r, i) => ({
      ...r,
      mean: { ssim: 0.25 + i * 0.01, laplacian: 0.015 },
      ...changes.candidate?.[i],
      provenanceSha256: candidateSha,
      referenceEvidence: {
        provenanceSha256: mainSha,
        resultFingerprint: fingerprint(r),
        evaluationSha256: r.evaluationSha256,
      },
    })),
  };
  return { clips, mainRun, candidateRun };
}

test("review ranks five worst and five best only after all phone outcomes are accounted", () => {
  const { clips, mainRun, candidateRun } = fixture(12);
  const result = reviewSelection(clips, mainRun, candidateRun);
  expect(result.complete).toBe(true);
  expect(result.ranked).toBe(true);
  expect(result.selected.filter((r) => r.group === "worst").map((r) => r.id)).toEqual([
    "clip-0",
    "clip-1",
    "clip-2",
    "clip-3",
    "clip-4",
  ]);
  expect(result.selected.filter((r) => r.group === "best").map((r) => r.id)).toEqual([
    "clip-11",
    "clip-10",
    "clip-9",
    "clip-8",
    "clip-7",
  ]);
  expect(new Set(result.selected.map((r) => r.id)).size).toBe(10);
  candidateRun.results.pop();
  const pending = reviewSelection(clips, mainRun, candidateRun);
  expect(pending.ranked).toBe(false);
  expect(pending.selected).toEqual([]);
  expect(pending.limitations.join(" ")).toMatch(/incomplete/);
  expect(reviewSelection(clips, mainRun, candidateRun, { ids: ["clip-0"] }).selected).toEqual([
    { id: "clip-0", group: "unranked", rank: null },
  ]);
  expect(() => reviewSelection(clips, mainRun, candidateRun, { ids: ["clip-11"] })).toThrow(
    /two verified/,
  );
});

test("review exposes too few paired successes and never ranks missing held-out proof", () => {
  const { clips, mainRun, candidateRun } = fixture(10, { candidate: { 0: rejection } });
  const result = reviewSelection(clips, mainRun, candidateRun);
  expect(result.complete).toBe(true);
  expect(result.pairedSuccesses).toBe(9);
  expect(result.ranked).toBe(false);
  expect(result.selected).toHaveLength(9);
  expect(result.selected.every((r) => r.group === "unranked")).toBe(true);
  expect(result.limitations.join(" ")).toMatch(/Only 9/);
  candidateRun.results[1].heldoutEvidence = { complete: false };
  expect(reviewSelection(clips, mainRun, candidateRun).pairedSuccesses).toBe(8);
  candidateRun.results[2].referenceEvidence.resultFingerprint = "changed";
  expect(() => reviewSelection(clips, mainRun, candidateRun)).toThrow(/provenance/);
});

test("review requires complete source credits and forbids path-like capture IDs", () => {
  const { clips, mainRun, candidateRun } = fixture();
  expect(attribution(clips[0], "phone")).toContain(clips[0].licenseUrl);
  expect(attribution(clips[0], "phone")).toContain(clips[0].author);
  expect(() =>
    reviewSelection([{ ...clips[0], license: "" }, ...clips.slice(1)], mainRun, candidateRun),
  ).toThrow(/metadata/);
  expect(() =>
    reviewSelection([{ ...clips[0], id: "../escape" }, ...clips.slice(1)], mainRun, candidateRun),
  ).toThrow(/metadata/);
});

const camera = (time) => ({
  time,
  R: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  t: [0, 0, 0],
  f: 100,
  w: 200,
  h: 100,
});
test("review samples one common recorded-time interval without extrapolation or speed fitting", () => {
  const timeline = matchedTimeline(
    { cams: [camera(1), camera(10)] },
    { cams: [camera(2), camera(8)] },
    { seconds: 3, fps: 2 },
  );
  expect(timeline.times).toEqual([2, 2.5, 3, 3.5, 4, 4.5, 5]);
  expect(timeline.playbackSeconds).toBe(3.5);
  expect(timeline.sourceSpanSeconds).toBe(3);
  expect(timeline.motionReplaySpeed).toBe(1);
  expect(timeline.finalFrameHoldSeconds).toBe(0.5);
  expect(() =>
    matchedTimeline({ cams: [camera(0), camera(1)] }, { cams: [camera(2), camera(3)] }),
  ).toThrow(/common/);
  expect(() =>
    matchedTimeline({ cams: [camera(0), camera(0)] }, { cams: [camera(2), camera(3)] }),
  ).toThrow(/invalid/);
});

test("replay verification requires exact saved pixels and saved-file hash", () => {
  const image = new PNG({ width: 2, height: 2 });
  image.data.set([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 90, 80, 70, 255]);
  const saved = PNG.sync.write(image),
    differentlyEncoded = PNG.sync.write(image, { deflateLevel: 0, filterType: 0 });
  expect(assertReplayPixels(differentlyEncoded, saved, sha(saved)).rgbaSha256).toBe(
    sha(image.data),
  );
  expect(() => assertReplayPixels(saved, saved, "changed")).toThrow(/saved.*changed/);
  image.data[0]--;
  expect(() => assertReplayPixels(PNG.sync.write(image), saved, sha(saved))).toThrow(/reproduce/);
});

test("replay checks actual scene flags and never infers candidate cleanup from missing telemetry", async () => {
  const scene = { uid: "review-capture", affine: true, preservePhotometric: true },
    code =
      `const V3D = { shown: ${JSON.stringify(scene)} }; export const snapshot = () => JSON.stringify(V3D);` +
      REPLAY_SCENE_OBSERVER,
    observed = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`),
    before = observed.snapshot();
  expect(observed.__v3dReviewScene()).toEqual(scene);
  expect(observed.snapshot()).toBe(before);
  expect(assertReplayScene(observed.__v3dReviewScene(), true)).toEqual(scene);
  const telemetry = { uid: "review-capture" };
  expect(() => assertReplayScene(telemetry, false)).toThrow(/cleanup behavior/);
  expect(() => assertReplayScene(telemetry, true)).toThrow(/cleanup behavior/);
  expect(() => assertReplayScene({ uid: "review-capture", affine: true }, true)).toThrow(
    /cleanup behavior/,
  );
  expect(() => assertReplayScene({ ...scene, preservePhotometric: false }, true)).toThrow(
    /cleanup behavior/,
  );
  expect(() => assertReplayScene(scene, false)).toThrow(/cleanup behavior/);
});

test("an actual main scene's false or omitted cleanup flag both mean disabled", () => {
  const oldScene = { uid: "review-capture", affine: true };
  expect(assertReplayScene(oldScene, false)).toBe(oldScene);
  const explicit = { ...oldScene, preservePhotometric: false };
  expect(assertReplayScene(explicit, false)).toBe(explicit);
  expect(() => assertReplayScene({ ...oldScene, affine: false }, false)).toThrow(/cleanup/);
});

test("side-by-side composition preserves both panes' actual RGBA values", () => {
  const main = { width: 1, height: 2, data: Buffer.from([1, 2, 3, 255, 4, 5, 6, 255]) };
  const candidate = { ...main, data: Buffer.from([7, 8, 9, 255, 10, 11, 12, 255]) };
  const combined = pairedRgba(main, candidate, 2);
  expect(combined.width).toBe(4);
  expect(combined.data.subarray(0, 4)).toEqual(main.data.subarray(0, 4));
  expect(combined.data.subarray(12, 16)).toEqual(candidate.data.subarray(0, 4));
  expect(combined.data.subarray(16, 20)).toEqual(main.data.subarray(4));
  expect(combined.data.subarray(28, 32)).toEqual(candidate.data.subarray(4));
  expect(() => pairedRgba(main, { ...candidate, width: 2 })).toThrow(/same pixel/);
});

test("CPU encoder produces labeled H.264 media with source/license metadata", async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "v3d-review-encoder-test-"));
  const file = path.join(temp, "fixture.mp4"),
    width = 160,
    height = 160;
  const picture = (red, blue) => ({
    width,
    height,
    data: Buffer.from(Array.from({ length: width * height }, () => [red, 0, blue, 255]).flat()),
  });
  let encoder;
  try {
    encoder = startReviewEncoder(file, {
      paneWidth: width,
      paneHeight: height,
      fps: 4,
      clip: clip(0),
      profile: "phone",
    });
    const raw = pairedRgba(picture(255, 0), picture(0, 255));
    for (let i = 0; i < 4; i++) await encoder.frame(raw.data);
    await encoder.finish();
    encoder = null;
    const probe = JSON.parse(
      execFileSync("ffprobe", [
        "-v",
        "error",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        file,
      ]),
    );
    expect(probe.streams[0].codec_name).toBe("h264");
    expect(probe.streams[0].width).toBe(324);
    expect(probe.streams[0].height).toBe(320);
    expect(Number(probe.streams[0].nb_frames)).toBe(4);
    expect(probe.format.tags.comment).toContain(clip(0).source);
    expect(probe.format.tags.comment).toContain(clip(0).licenseUrl);
    const bytes = execFileSync("ffmpeg", [
      "-nostdin",
      "-v",
      "error",
      "-threads",
      "1",
      "-i",
      file,
      "-frames:v",
      "1",
      "-f",
      "image2pipe",
      "-vcodec",
      "png",
      "-threads",
      "1",
      "pipe:1",
    ]);
    const frame = PNG.sync.read(bytes),
      at = (x, y, channel) => frame.data[(y * frame.width + x) * 4 + channel];
    expect(at(60, 100, 0)).toBeGreaterThan(240);
    expect(at(220, 100, 2)).toBeGreaterThan(240);
    // Both header labels have visible light pixels; the colored panes themselves were retained.
    for (const start of [0, 164]) {
      let light = 0;
      for (let y = 0; y < 40; y++)
        for (let x = start; x < start + 160; x++) if (at(x, y, 0) > 160) light++;
      expect(light).toBeGreaterThan(10);
    }
  } finally {
    await encoder?.abort();
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("failure export copies actual saved outcomes without launching a browser", async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "v3d-review-failure-test-"));
  const { clips, mainRun, candidateRun } = fixture(1, {
    main: { 0: rejection },
    candidate: { 0: rejection },
  });
  const manifest = Buffer.from(JSON.stringify(clips)),
    manifestFile = path.join(temp, "manifest.json");
  fs.writeFileSync(manifestFile, manifest);
  for (const run of [mainRun, candidateRun]) {
    run.manifestSha256 = sha(manifest);
    run.provenance.manifestSha256 = sha(manifest);
    run.provenanceSha256 = fingerprint(run.provenance);
    run.results[0].provenanceSha256 = run.provenanceSha256;
  }
  candidateRun.provenance.reference.provenanceSha256 = mainRun.provenanceSha256;
  candidateRun.provenanceSha256 = fingerprint(candidateRun.provenance);
  candidateRun.results[0].provenanceSha256 = candidateRun.provenanceSha256;
  candidateRun.results[0].referenceEvidence = {
    provenanceSha256: mainRun.provenanceSha256,
    resultFingerprint: fingerprint(mainRun.results[0]),
  };
  const screenshot = new PNG({ width: 2, height: 2 });
  screenshot.data.fill(255);
  const bytes = PNG.sync.write(screenshot);
  try {
    for (const [name, run] of [
      ["main", mainRun],
      ["candidate", candidateRun],
    ]) {
      const folder = path.join(temp, name, "clip-0-phone");
      fs.mkdirSync(folder, { recursive: true });
      fs.writeFileSync(path.join(temp, name, "run.json"), JSON.stringify(run));
      fs.writeFileSync(path.join(folder, "outcome.png"), bytes);
    }
    const output = path.join(temp, "review");
    const report = await review([
      "failures",
      manifestFile,
      path.join(temp, "main"),
      path.join(temp, "candidate"),
      output,
      "--ids=clip-0",
    ]);
    expect(report.cases[0].status).toBe("failure-evidence");
    expect(report.cases[0].failures).toHaveLength(2);
    expect(fs.readFileSync(path.join(output, "clip-0-phone", "failure-main.png"))).toEqual(bytes);
    expect(fs.readFileSync(path.join(output, "index.html"), "utf8")).toContain(
      "Too little motion.",
    );
    expect(fs.existsSync(path.join(output, "clip-0-phone", "comparison.mp4"))).toBe(false);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

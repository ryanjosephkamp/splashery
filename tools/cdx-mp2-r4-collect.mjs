// Assemble verified cases without replacing their numeric measurements.
// Later inputs supersede a duplicate case; every raw run remains in the ledger.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { R4_CASES } from "./cdx-mp2-r4-cases.mjs";
import { SAMPLES, LONG_SAMPLES } from "../src/packs/moving-photo.js";
import { sourceTimeline } from "./cdx-mp2-r4-clock.mjs";
import { option } from "./cdx-mp2-r4-harness.mjs";

const files = option("inputs").split(",").filter(Boolean),
  out = option("out", "work/r4-collected-quality.json"),
  partial = option("partial") === "true";
if (!files.length) throw Error("Pass --inputs=<raw report>,<later raw report>");
const runs = [],
  selected = new Map(),
  timelines = new Map();
for (const file of files) {
  const report = JSON.parse(await fs.readFile(file, "utf8"));
  if (
    runs.length &&
    ["protocol", "baseline", "sourceHash", "browser"].some((key) => report[key] !== runs[0][key])
  )
    throw Error(`Different measurement code or oracle: ${file}`);
  runs.push({
    file: path.basename(file),
    protocol: report.protocol,
    baseline: report.baseline,
    baselineSourceCorrection: report.baselineSourceCorrection,
    browser: report.browser,
    sourceHash: report.sourceHash,
    codeRevision: report.codeRevision || report.revision || report.baseline,
    startedAt: report.startedAt,
    errors: report.errors,
    cases: report.results.map((row) => ({
      id: row.id,
      profile: row.profile,
      complete: row.complete,
      errors: row.errors,
    })),
  });
  for (let i = 0; i < report.results.length; i++) {
    const row = report.results[i];
    selected.set(`${row.profile}/${row.id}`, { row, report, file, i });
  }
  for (const error of report.errors || [])
    if (error.profile && error.id)
      selected.set(`${error.profile}/${error.id}`, {
        row: { complete: false, errors: [error.message] },
        report,
        file,
        i: null,
      });
}
const rows = [],
  missing = [];
for (const profile of ["phone", "desktop"])
  for (const item of R4_CASES) {
    const key = `${profile}/${item.id}`,
      pick = selected.get(key);
    if (!pick || !pick.row.complete || !pick.row.everyFrame || pick.row.errors.length) {
      missing.push(key);
      continue;
    }
    const { row, report, file, i } = pick,
      sample = SAMPLES.find((sample) => sample.id === item.id);
    let timeline = timelines.get(item.id);
    if (!timeline) {
      if (item.source) timeline = sourceTimeline(item.source, item.fps, row.duration);
      else {
        let at = 0;
        const durations = row.delays.map((value) => value / 1000),
          timestamps = durations.map((duration) => {
            const time = at;
            at += duration;
            return time;
          });
        timeline = { timestamps, durations, start: 0, duration: at };
      }
      timelines.set(item.id, timeline);
    }
    const count = timeline.timestamps.length;
    if (
      row.frames.length !== count ||
      row.framesMeasured !== count ||
      row.framesTotal !== count ||
      (sample && !item.source && count !== sample.frames) ||
      row.frames.some(
        (frame, n) =>
          !frame.sourcePixelsVerified ||
          frame.time < timeline.timestamps[n] - 1e-6 ||
          frame.time >= timeline.timestamps[n] + timeline.durations[n] ||
          (!report.baseline && !frame.depthPixelsVerified) ||
          (frame.temporalDepth !== "displayed R8" && !frame.depthPixelsVerified),
      )
    )
      throw Error(`Unverified original-frame coverage or displayed depth: ${key}`);
    const sourceHash = createHash("sha256");
    if (item.source) sourceHash.update(await fs.readFile(item.source));
    else
      for (let n = 1; n <= sample.sheets; n++)
        sourceHash.update(
          await fs.readFile(`assets/toys/moving-photo-3d/${sample.file}-sheet-${n}.jpg`),
        );
    if (sourceHash.digest("hex") !== row.sourceSha256)
      throw Error(`Original source changed: ${key}`);
    const inputFiles = new Set(row.inputHashes?.map((input) => input.file) || []);
    if (item.source) inputFiles.add(item.source);
    if (sample) {
      inputFiles.add(`assets/toys/moving-photo-3d/${sample.file}.depth`);
      for (let n = 1; n <= sample.sheets; n++)
        inputFiles.add(`assets/toys/moving-photo-3d/${sample.file}-sheet-${n}.jpg`);
    }
    if (item.long && row.baselinePath !== "upload") {
      const long = LONG_SAMPLES.find((sample) => sample.id === item.id);
      inputFiles.add(`assets/toys/moving-photo-3d/${long.file}.mp2depth`);
    }
    const inputHashes = [];
    for (const input of inputFiles) {
      const current = await fs.readFile(input),
        recorded = row.inputHashes?.find((entry) => entry.file === input);
      let bytes = current,
        origin = "working tree";
      if (report.baseline) {
        let pinned;
        try {
          execFileSync("git", ["cat-file", "-e", `${report.baseline}:${input}`], {
            stdio: "ignore",
          });
          pinned = execFileSync("git", ["show", `${report.baseline}:${input}`], {
            maxBuffer: 128 << 20,
          });
        } catch {
          // A local-file comparison can use an input absent from main.
          if (input !== item.source)
            throw Error(`Unrecorded input absent from the measured baseline: ${input}`);
        }
        if (pinned) {
          const pinnedHash = createHash("sha256").update(pinned).digest("hex");
          if (!recorded && createHash("sha256").update(current).digest("hex") !== pinnedHash)
            throw Error(`Unrecorded input changed from the measured baseline: ${input}`);
          bytes = pinned;
          origin = `git:${report.baseline}`;
        }
      }
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      if (recorded && recorded.sha256 !== sha256)
        throw Error(`Measured input changed since capture: ${input}`);
      inputHashes.push({ file: input, bytes: bytes.length, sha256, origin });
    }
    rows.push({
      ...row,
      sourceFrames: count,
      sourceDelays: timeline.durations,
      sourceTimestamps: timeline.timestamps,
      originalVideoDuration: timeline.duration,
      sourceWitness: row.hasVideo
        ? "Whole native video RGB verified against the displayed source"
        : "Retained GIF composites or JPEG-sheet sample RGB at the profile's frame budget",
      inputHashes,
      rawReport: path.basename(file),
      rawCaseIndex: i,
      measurementCodeHash: report.sourceHash,
      measurementCodeRevision: report.codeRevision || report.revision || report.baseline,
      temporalDepthAssurance: row.frames.every((frame) => frame.temporalDepth === "displayed R8")
        ? "Displayed R8 measured directly"
        : "Retained field proven byte-identical to displayed R8 on every measured frame",
    });
  }
if (missing.length && !partial) throw Error(`Missing complete cases: ${missing.join(", ")}`);
const report = {
  protocol: runs[0].protocol,
  baseline: runs[0].baseline,
  baselineSourceCorrection: runs[0].baselineSourceCorrection || null,
  browser: runs[0].browser,
  sourceHash: runs[0].sourceHash,
  codeRevision: runs.at(-1).codeRevision,
  collectedAt: new Date().toISOString(),
  timelineVersion: "original-pts-v1",
  metadataCorrection:
    "Source holds and end times re-derived from original picture timestamps; packet rounding and audio tails do not change film speed. Captured pictures and every numeric metric are unchanged. Raw reports are retained.",
  temporalDepth: "Displayed R8; exact input correspondence required for round 4",
  collectorRevision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  complete: missing.length === 0,
  missing,
  runs,
  results: rows,
  errors: [],
};
await fs.mkdir(path.dirname(out), { recursive: true });
await fs.writeFile(out + ".part", JSON.stringify(report, null, 2) + "\n");
await fs.rename(out + ".part", out);
console.log(JSON.stringify({ out, complete: report.complete, cases: rows.length, missing }));

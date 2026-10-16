// Compare live captures without source-clock stepping. Individual VFR files remain authoritative.
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { option } from "./cdx-mp2-r4-harness.mjs";

const before = option("before", "work/r4-live-r3"),
  after = option("after", "work/r4-live-r4"),
  out = option("out", "work/r4-live-pairs"),
  left = JSON.parse(await fs.readFile(path.join(before, "manifest.json"))),
  right = JSON.parse(await fs.readFile(path.join(after, "manifest.json")));
if (left.seconds !== right.seconds || left.cpuRate !== right.cpuRate)
  throw Error("Live protocols differ");
await fs.mkdir(out, { recursive: true });
const report = {
  createdAt: new Date().toISOString(),
  protocol:
    "Two separately recorded live windows, aligned at capture start; 60 fps export duplicates held pictures without interpolation. Each original presentation is quantized by at most one 16.667 ms output tick. Individual VFR recordings preserve the exact capture times",
  limitation:
    "CDP JPEG capture adds overhead. Fixed camera and hidden UI. These are presentation evidence, not the clean natural-camera cadence benchmark",
  seconds: left.seconds,
  before: { label: left.label, revision: left.revision, sourceHash: left.sourceHash },
  after: { label: right.label, revision: right.revision, sourceHash: right.sourceHash },
  cases: [],
};
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
for (const a of left.cases) {
  const b = right.cases.find((row) => row.id === a.id);
  if (!b) throw Error(`Missing after recording: ${a.id}`);
  if (JSON.stringify(a.inputHashes) !== JSON.stringify(b.inputHashes)) {
    // Bundled depth caches legitimately differ by revision; original native pictures must match.
    const native = (row) => row.inputHashes.filter((input) => !input.file.endsWith(".mp2depth"));
    if (JSON.stringify(native(a)) !== JSON.stringify(native(b)))
      throw Error(`Native inputs differ: ${a.id}`);
  }
  const inputs = [path.join(before, a.output.file), path.join(after, b.output.file)];
  for (let i = 0; i < inputs.length; i++) {
    if (hash(await fs.readFile(inputs[i])) !== [a, b][i].output.sha256)
      throw Error(`Recording changed: ${inputs[i]}`);
  }
  const file = `${a.id}-live-side-by-side.mp4`,
    target = path.join(out, file);
  execFileSync("ffmpeg", [
    "-nostdin",
    "-v",
    "error",
    "-y",
    "-i",
    inputs[0],
    "-i",
    inputs[1],
    "-filter_complex",
    "[0:v]setpts=PTS-STARTPTS,fps=60[a];[1:v]setpts=PTS-STARTPTS,fps=60[b];[a][b]hstack=inputs=2[v]",
    "-map",
    "[v]",
    "-t",
    String(left.seconds),
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "20",
    "-threads",
    "1",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    target,
  ]);
  const probe = JSON.parse(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-count_frames",
        "-show_entries",
        "format=duration:stream=width,height,nb_read_frames",
        "-of",
        "json",
        target,
      ],
      { encoding: "utf8" },
    ),
  );
  if (
    Math.abs(Number(probe.format.duration) - left.seconds) > 0.001 ||
    Number(probe.streams[0].nb_read_frames) !== Math.round(left.seconds * 60) ||
    probe.streams[0].width !== 780 ||
    probe.streams[0].height !== 844
  )
    throw Error(`Invalid paired recording: ${a.id}`);
  const poster = `${a.id}-live-poster.jpg`;
  execFileSync("ffmpeg", [
    "-nostdin",
    "-v",
    "error",
    "-y",
    "-i",
    target,
    "-frames:v",
    "1",
    "-q:v",
    "3",
    path.join(out, poster),
  ]);
  if ((await fs.stat(path.join(out, poster))).size > 1000000) throw Error("Poster exceeds 1 MB");
  const bytes = await fs.readFile(target);
  report.cases.push({
    id: a.id,
    author: a.author,
    license: a.license,
    licenseUrl: a.licenseUrl,
    sourcePage: a.sourcePage,
    checked: a.checked,
    before: { inputHashes: a.inputHashes, output: a.output },
    after: { inputHashes: b.inputHashes, output: b.output },
    output: {
      file,
      poster,
      bytes: bytes.length,
      sha256: hash(bytes),
      duration: Number(probe.format.duration),
    },
    transformation:
      "Two silent licensed renderings placed side by side; held pictures duplicated at 60 fps",
  });
  console.log(JSON.stringify(report.cases.at(-1).output));
}
await fs.writeFile(path.join(out, "manifest.json"), JSON.stringify(report, null, 2) + "\n");

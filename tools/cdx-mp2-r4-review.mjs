// Encode the exact accepted phone pictures. These are source-clock films,
// not live-performance recordings; timing has its own isolated browser run.
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { SAMPLES, LONG_SAMPLES } from "../src/packs/moving-photo.js";
import { R4_CASES } from "./cdx-mp2-r4-cases.mjs";
import { option } from "./cdx-mp2-r4-harness.mjs";
import { sourceTimeline } from "./cdx-mp2-r4-clock.mjs";

const out = option("out", "work/r4-review"),
  before = JSON.parse(await fs.readFile(option("before", "work/r4-main-quality.json"), "utf8")),
  after = JSON.parse(await fs.readFile(option("after", "work/r4-current-quality.json"), "utf8"));
const beforeName = option("before-name", "main"),
  beforeLabel = option("before-label", "Main");
if (!/^[a-z0-9-]+$/.test(beforeName)) throw Error("Invalid baseline file label");
const roots = [
  option("before-frames", "work/r4-main-review"),
  option("after-frames", "work/r4-current-review"),
];
const font = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
await fs.mkdir(out, { recursive: true });
const manifest = {
  reviewVersion: "phone-original-pts-v6",
  labels: [beforeLabel, "Round 4"],
  revisions: [
    before.codeRevision || before.revision || before.baseline,
    after.codeRevision || after.revision || after.baseline,
  ],
  protocol: before.protocol,
  sourceHashes: [before.sourceHash, after.sourceHash],
  note: "Silent captures at the same source clocks and camera. Videos use native pictures; GIFs and sheet samples use the app's retained composites. The films show picture quality. Separate live browser measurements report playback speed.",
  clips: [],
};
try {
  const prior = JSON.parse(await fs.readFile(path.join(out, "manifest.json"), "utf8"));
  if (
    prior.reviewVersion === manifest.reviewVersion &&
    JSON.stringify(prior.sourceHashes) === JSON.stringify(manifest.sourceHashes)
  )
    manifest.clips.push(...prior.clips);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const hash = async (file) =>
  createHash("sha256")
    .update(await fs.readFile(file))
    .digest("hex");
const wrap = (text) =>
  text
    .match(/.{1,44}(?:\s|$)|.{1,44}/g)
    ?.map((s) => s.trim())
    .join("\n") || text;
const run = (args) => {
  try {
    return execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-y", ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    throw new Error(error.stderr?.toString() || error.message);
  }
};
const sourceClock = (row) => {
  let at = 0;
  return row.frames.map((frame, i) => {
    if (!row.sourceDelays) return frame.time - row.frames[0].time;
    const time = at;
    at += row.sourceDelays[i];
    return time;
  });
};
async function verifyFilm(file, row, duration) {
  const info = JSON.parse(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_frames",
        "-show_entries",
        "frame=best_effort_timestamp_time:format=duration",
        "-of",
        "json",
        file,
      ],
      { encoding: "utf8" },
    ),
  );
  const encodedDuration = Number(info.format.duration);
  if (Math.abs(encodedDuration - duration) > 0.001)
    throw Error(`Encoded duration changed: ${file}: ${encodedDuration} vs ${duration}`);
  const expected = sourceClock(row),
    actual = info.frames.map((frame) => Number(frame.best_effort_timestamp_time));
  if (
    actual.length !== expected.length + 1 ||
    expected.some((time, i) => Math.abs(time - actual[i]) > 1 / 1000)
  )
    throw Error(`Encoded source clocks changed: ${file}`);
  return {
    file: path.basename(file),
    bytes: (await fs.stat(file)).size,
    sha256: await hash(file),
    frames: actual.length,
    duration,
    encodedDuration,
  };
}
const cardFilter = (input, labelPath, output) =>
  `[${input}:v]scale=390:600:force_original_aspect_ratio=decrease:flags=lanczos,format=rgba,pad=390:600:(ow-iw)/2:(oh-ih)/2:color=0xf0f3f8,split[pic${input}][base${input}];[base${input}]lutrgb=r=240:g=243:b=248:a=255[bg${input}];[bg${input}][pic${input}]overlay=shortest=1:format=auto,pad=390:844:0:64:color=0xf0f3f8,drawtext=fontfile=${font}:textfile=${labelPath}:fontcolor=0x111827:fontsize=12:line_spacing=7:x=12:y=674[${output}]`;
for (const item of R4_CASES) {
  if (option("ids") && !option("ids").split(",").includes(item.id)) continue;
  const rows = [before, after].map((report) =>
    report.results.find(
      (r) =>
        r.id === item.id && r.profile === "phone" && r.complete && r.everyFrame && !r.errors.length,
    ),
  );
  if (rows.some((r) => !r)) {
    if (option("partial") === "true") continue;
    throw Error(`Incomplete clean pair: ${item.id}`);
  }
  if (
    rows[0].sourceSha256 !== rows[1].sourceSha256 ||
    rows[0].frames.length !== rows[1].frames.length ||
    rows[0].frames.some((r, i) => Math.abs(r.time - rows[1].frames[i].time) > 1e-5)
  )
    throw Error(`Different source clocks: ${item.id}`);
  if (item.source) {
    const timeline = sourceTimeline(item.source, item.fps);
    if (
      timeline.timestamps.length !== rows[0].frames.length ||
      rows.some((row) =>
        row.frames.some(
          (frame, i) =>
            frame.time < timeline.timestamps[i] - 1e-6 ||
            frame.time >= timeline.timestamps[i] + timeline.durations[i],
        ),
      )
    )
      throw Error(`Captures do not cover every original source frame: ${item.id}`);
    for (const row of rows) row.sourceDelays = timeline.durations;
  }
  const frameHashes = [];
  for (let version = 0; version < 2; version++) {
    const hashes = [];
    for (let i = 0; i < rows[version].frames.length; i++)
      hashes.push(
        await hash(path.join(roots[version], item.id, `${String(i).padStart(5, "0")}.png`)),
      );
    frameHashes.push(hashes);
  }
  const signature = createHash("sha256")
    .update(
      JSON.stringify({
        sourceHashes: manifest.sourceHashes,
        labels: manifest.labels,
        inputs: rows.map((row) => row.inputHashes),
        clocks: rows.map((row) => row.frames.map((frame) => frame.time)),
        frameHashes,
      }),
    )
    .digest("hex");
  if (manifest.clips.some((clip) => clip.id === item.id && clip.signature === signature)) continue;
  manifest.clips = manifest.clips.filter((clip) => clip.id !== item.id);
  const credit = [...SAMPLES, ...LONG_SAMPLES].find((s) => s.id === item.id) || {
    label: item.id,
    title: "Original rigid-motion test clip",
    author: "Made by Ryan with Codex (GPT-6)",
    license: "CC0 1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    source: null,
  };
  // The generator source is a committed input, not an external film.
  if (item.upload)
    credit.source = `https://github.com/ryanjosephkamp/splashery/blob/${execFileSync("git", ["rev-parse", "892ed8ea"], { encoding: "utf8" }).trim()}/tools/cdx-mp2-r4-inputs.mjs`;
  const duration = rows[0].sourceDelays
    ? rows[0].sourceDelays.reduce((a, b) => a + b, 0)
    : rows[0].delays
      ? rows[0].delays.reduce((a, b) => a + b, 0) / 1000
      : rows[0].frames.length / item.fps;
  const outputs = [],
    concatInputs = [],
    labelInputs = [];
  for (let version = 0; version < 2; version++) {
    const name = version ? "r4" : beforeName,
      file = path.join(out, `${item.id}-${name}.mp4`),
      row = rows[version];
    const list = path.join(out, `${item.id}-${name}.ffconcat`),
      label = path.join(out, `${item.id}-${name}.txt`);
    let concat = "ffconcat version 1.0\n";
    for (let i = 0; i < row.frames.length; i++) {
      const png = path.resolve(roots[version], item.id, `${String(i).padStart(5, "0")}.png`);
      const dt = row.sourceDelays
        ? row.sourceDelays[i]
        : i + 1 < row.frames.length
          ? row.frames[i + 1].time - row.frames[i].time
          : duration - (row.frames[i].time - row.frames[0].time);
      concat += `file '${png.replaceAll("'", "'\\''")}'\noption framerate 12000\nduration ${dt.toFixed(9)}\n`;
    }
    const last = path.resolve(
      roots[version],
      item.id,
      `${String(row.frames.length - 1).padStart(5, "0")}.png`,
    );
    concat += `file '${last}'\noption framerate 12000\n`;
    await fs.writeFile(list, concat);
    await fs.writeFile(
      label,
      `${version ? "ROUND 4" : beforeLabel.toUpperCase()} · ${credit.label}\n${row.baselinePath === "upload" ? "Local-file path" : "Sample path"}\n${wrap(credit.author)}\n${credit.license}\nStepped source frames; live timings are separate.\n`,
    );
    const labelPath = path.resolve(label),
      filter = cardFilter(0, labelPath, "out");
    concatInputs.push(list);
    labelInputs.push(labelPath);
    run([
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      list,
      "-filter_complex_threads",
      "1",
      "-filter_complex",
      filter,
      "-map",
      "[out]",
      "-fps_mode",
      "vfr",
      "-enc_time_base",
      "1:12000",
      "-video_track_timescale",
      "12000",
      "-c:v",
      "libx264",
      "-x264-params",
      "fps=60/1:force-cfr=0",
      "-preset",
      "fast",
      "-crf",
      "18",
      "-threads",
      "1",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      file,
    ]);
    outputs.push(await verifyFilm(file, row, duration));
  }
  const paired = path.join(out, `${item.id}-side-by-side.mp4`);
  run([
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatInputs[0],
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatInputs[1],
    "-filter_complex_threads",
    "1",
    "-filter_complex",
    `${cardFilter(0, labelInputs[0], "left")};${cardFilter(1, labelInputs[1], "right")};[left][right]hstack=shortest=1[v]`,
    "-map",
    "[v]",
    "-fps_mode",
    "vfr",
    "-enc_time_base",
    "1:12000",
    "-video_track_timescale",
    "12000",
    "-c:v",
    "libx264",
    "-x264-params",
    "fps=60/1:force-cfr=0",
    "-preset",
    "fast",
    "-crf",
    "18",
    "-threads",
    "1",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    paired,
  ]);
  const poster = path.join(out, `${item.id}-poster.jpg`);
  run(["-ss", String(duration * 0.25), "-i", paired, "-frames:v", "1", "-q:v", "3", poster]);
  if ((await fs.stat(poster)).size > 1000000) throw Error(`Poster over 1 MB: ${poster}`);
  manifest.clips.push({
    id: item.id,
    signature,
    frameHashes,
    measurementInputs: rows.map((row) => row.inputHashes),
    title: credit.label,
    source: item.source || null,
    sourceSha256: rows[0].sourceSha256,
    author: credit.author,
    license: credit.license,
    licenseUrl: credit.licenseUrl,
    sourcePage: credit.source,
    checked: "October 16, 2026",
    modifications:
      "Rendered the selected source as a 3D relief; scaled the accepted screenshots to a phone card, added attribution, and encoded silent VFR H.264 with verified source timestamps.",
    outputs: [...outputs, await verifyFilm(paired, rows[0], duration)],
    poster: {
      file: path.basename(poster),
      bytes: (await fs.stat(poster)).size,
      sha256: await hash(poster),
    },
  });
  await fs.writeFile(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(JSON.stringify({ id: item.id, files: manifest.clips.at(-1).outputs }));
}

const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const ordered = R4_CASES.flatMap((item) => manifest.clips.filter((clip) => clip.id === item.id));
for (const clip of ordered) {
  const a = before.results.find((r) => r.id === clip.id && r.profile === "phone"),
    b = after.results.find((r) => r.id === clip.id && r.profile === "phone");
  const item = R4_CASES.find((item) => item.id === clip.id),
    timeline = item.source ? sourceTimeline(item.source, item.fps) : null,
    encodedTimes = timeline
      ? timeline.timestamps.map((time) => time - timeline.start)
      : sourceClock(a);
  clip.sourceClocks = a.frames.map((frame, i) => ({
    encodedTime: encodedTimes[i],
    time: frame.time,
    sourceTime: frame.sourceTime,
    baselineDepthFrame: frame.frame,
    round4DepthFrame: b.frames[i].frame,
  }));
}
await fs.writeFile(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
const notice = `These silent films visit every original file timestamp, or every retained JPEG-sheet sample frame, at the same camera. Video pictures are native. GIFs keep the app's profile frame budget and can hold a retained composite across original timestamps. These compare picture quality; separate live timing ledgers measure playback speed. ${beforeLabel} receives the exact chosen native video picture for this geometry comparison. Long films use the baseline's actual local-file path only when absent from its shelf; each card records its path.`;
const cards = ordered
  .map(
    (clip) =>
      `<article><h2>${escape(clip.title)}</h2><video controls preload="none" poster="${clip.poster.file}" src="${clip.id}-side-by-side.mp4"></video><p><a href="${clip.id}-${beforeName}.mp4">${escape(beforeLabel)} · 390 × 844</a> · <a href="${clip.id}-r4.mp4">Round 4 · 390 × 844</a></p><p>${escape(clip.author)} · <a href="${escape(clip.licenseUrl)}">${escape(clip.license)}</a> · <a href="${escape(clip.sourcePage)}">Source</a></p></article>`,
  )
  .join("\n");
await fs.writeFile(
  path.join(out, "index.html"),
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Moving photo round 4: phone comparisons</title><style>body{max-width:850px;margin:24px auto;padding:0 16px;font:16px/1.5 system-ui;background:#f0f3f8;color:#111827}video{width:100%;max-width:780px;height:auto;background:#f0f3f8}article{margin:40px 0}a{color:#1545a4}p{max-width:78ch}h2{font-size:21px}</style><h1>Moving photo round 4: phone comparisons</h1><p>${escape(notice)}</p><p>Left: ${escape(beforeLabel)}. Right: round 4. Rendering and capture contributions made by Ryan with Codex (GPT-6). Original film licenses remain attached below. The five original test inputs are CC0 1.0.</p>${cards}</html>\n`,
);
const table = ordered
  .map(
    (clip) =>
      `| ${clip.title} | [${beforeLabel}](${clip.id}-${beforeName}.mp4) | [Round 4](${clip.id}-r4.mp4) | [Side by side](${clip.id}-side-by-side.mp4) | ${clip.author}; [${clip.license}](${clip.licenseUrl}); [source](${clip.sourcePage}) |`,
  )
  .join("\n");
await fs.writeFile(
  path.join(out, "README.md"),
  `# Moving photo round 4: phone comparisons\n\n${notice}\n\nEach individual film is 390 × 844. Side-by-side films preserve that size in each column (780 × 844 overall). [Open the gallery](index.html). [The manifest](manifest.json) records input hashes, authors, licenses, changes, output hashes, and precise source clocks. One repeated end frame preserves the final source frame's whole hold; encoded durations differ from source durations by less than one millisecond.\n\n| Input | ${beforeLabel} | Round 4 | Comparison | Credit |\n| --- | --- | --- | --- | --- |\n${table}\n\nThe underlying film licenses are unchanged. Rendering and capture contributions are made by Ryan with Codex (GPT-6); original contributions are CC0 1.0, and the capture/export code is MIT. The five original procedural clips are CC0 1.0. Existing Tears of Steel people and long-file-size exceptions were approved in [the Operator's comment](https://github.com/ryanjosephkamp/splashery/pull/560#issuecomment-6130226869). No new exception is requested.\n\nRule check: none.\n`,
);

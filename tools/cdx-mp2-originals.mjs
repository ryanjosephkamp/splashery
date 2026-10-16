// Recreate the short source cuts from the original downloads named by the
// existing asset records. Downloads and derived inputs stay in the ignored
// cache; the site and samples are not modified. No frame-rate conversion.
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { LONG_SAMPLES } from "../src/packs/moving-photo.js";

const dir = ".cache/cdx-mp3/originals";
await fs.mkdir(dir, { recursive: true });
const movies = [
  {
    id: "dragon",
    file: "sintel_trailer-720p.mp4",
    url: "https://download.blender.org/durian/trailer/sintel_trailer-720p.mp4",
    start: 29.5,
    crop: "1280:544:0:88",
  },
  {
    id: "bridge",
    file: "tears_of_steel_720p.mov",
    url: "https://download.blender.org/demo/movies/ToS/tears_of_steel_720p.mov",
    start: 510.5,
  },
  {
    id: "machine",
    file: "ED_1024.avi",
    url: "https://download.blender.org/ED/ED_1024.avi",
    // The title rounds the time; the prepared first picture is native
    // PTS329.666139. Seeking at329.7 advances to the following frame.
    start: 329.65,
  },
];
const sources = { sample: "assets/toys/screen/bunny.mp4", horse: "assets/toys/screen/horse.gif" };
const records = [];
const ids = process.argv
  .find((a) => a.startsWith("--ids="))
  ?.slice(6)
  .split(",");
for (const movie of movies) {
  const input = `${dir}/${movie.file}`;
  if (!(await fs.stat(input).catch(() => null))) {
    execFileSync("curl", [
      "--fail",
      "--location",
      "--silent",
      "--show-error",
      "--max-time",
      "600",
      "-o",
      input,
      movie.url,
    ]);
  }
  const output = `${dir}/${movie.id}.webm`;
  if (!ids || ids.includes(movie.id))
    execFileSync("ffmpeg", [
      "-nostdin",
      "-v",
      "error",
      "-y",
      "-ss",
      String(movie.start),
      "-i",
      input,
      "-t",
      "6",
      ...(movie.crop ? ["-vf", `crop=${movie.crop}`] : []),
      "-c:v",
      "libvpx-vp9",
      "-lossless",
      "1",
      "-pix_fmt",
      "yuv420p",
      "-row-mt",
      "1",
      "-threads",
      "2",
      "-c:a",
      "libopus",
      "-ac",
      "2",
      "-b:a",
      "128k",
      output,
    ]);
  sources[movie.id] = output;
  records.push({
    ...movie,
    seconds: 6,
    output,
    sha256: createHash("sha256")
      .update(await fs.readFile(output))
      .digest("hex"),
    bytes: (await fs.stat(output)).size,
  });
  console.log(JSON.stringify(records.at(-1)));
}
for (const s of LONG_SAMPLES) sources[s.id] = `assets/toys/moving-photo-3d/${s.file}.webm`;
sources.fast60 = "assets/toys/moving-photo-3d/cdx-mp2-fast-60.webm";
await fs.writeFile(`${dir}/sources.json`, JSON.stringify(sources, null, 2) + "\n");
await fs.writeFile(`${dir}/records.json`, JSON.stringify(records, null, 2) + "\n");

#!/usr/bin/env node
// Video to 3D (lane Studio media): cuts the original of each sample, for "Show the original": the
// same stretch of the source video the sample was trained from (SAMPLES[].span in
// src/video3d/samples.js), at 480p and without sound, as assets/toys/video-3d/<id>-source.webm
// (VP9) and <id>-source.mp4 (H.264, for browsers that play it, which is checked first). It reads
// Wikimedia Commons' own 480p transcode over HTTP, so only the stretch is fetched.
//
//   node tools/smd-source.mjs [id ...]
//
// Commons answers a fast run with "429 Too many requests": go one video at a time.
import { execFileSync } from "node:child_process";
import { SAMPLES } from "../src/video3d/samples.js";

const UA = "SplasheryBuild/1.0 (https://github.com/ryanjosephkamp/splashery; build tool)";
const ids = process.argv.slice(2);
const ffmpeg = process.env.FFMPEG || "ffmpeg";
const run = (...a) => execFileSync(ffmpeg, ["-nostdin", "-v", "error", "-y", ...a]);
const md5 = (s) => execFileSync("md5sum", { input: s }).toString().slice(0, 32);

for (const s of SAMPLES.filter((x) => !ids.length || ids.includes(x.id))) {
  const file = decodeURIComponent(s.source.split("File:")[1]);
  const name = file.replaceAll(" ", "_");
  const h = md5(name);
  const enc = encodeURIComponent(name).replace(/[()]/g, (c) => (c === "(" ? "%28" : "%29"));
  const url = `https://upload.wikimedia.org/wikipedia/commons/transcoded/${h[0]}/${h.slice(0, 2)}/${enc}/${enc}.480p.vp9.webm`; // prettier-ignore
  const out = `assets/toys/video-3d/${s.id}-source`;
  run("-user_agent", UA, "-ss", String(s.span.start), "-i", url, "-t", String(s.span.length), "-an", "-vf", "scale=-2:480,fps=30", "-c:v", "libvpx-vp9", "-crf", "38", "-b:v", "0", "-row-mt", "1", `${out}.webm`); // prettier-ignore
  run("-i", `${out}.webm`, "-an", "-c:v", "libx264", "-crf", "28", "-pix_fmt", "yuv420p", "-movflags", "+faststart", `${out}.mp4`); // prettier-ignore
  console.log(`${s.id}: ${s.span.length} s from ${s.span.start} s, ${out}.webm and .mp4`);
}

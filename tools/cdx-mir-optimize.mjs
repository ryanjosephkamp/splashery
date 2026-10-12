#!/usr/bin/env node
// Compact review GIFs with the project's existing FFmpeg build tool.
// Global palettes and unchanged rectangles reduce repeated page chrome;
// frame dimensions, remaining timing, and motion are preserved. Omit the
// first two seconds: Chromium can initially send its old cached page frame.
// node tools/cdx-mir-optimize.mjs .cache/cdx-mir
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { CLIPS } from "./cdx-mir-camera.mjs";

const dir = process.argv[2] || ".cache/cdx-mir";
for (const label of ["before", "after"])
  for (const clip of CLIPS) {
    const file = path.join(dir, `${label}-${clip}-390x844.gif`);
    const temp = path.join(dir, `${label}-${clip}-compact.gif`);
    const mark = path.join(dir, `${label}-${clip}-compact.json`);
    const hash = (p) => createHash("sha256").update(fs.readFileSync(p)).digest("hex");
    if (fs.existsSync(mark) && JSON.parse(fs.readFileSync(mark, "utf8")).sha256 === hash(file))
      continue;
    const size = fs.statSync(file).size;
    execFileSync("ffmpeg", [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-threads",
      "1",
      "-filter_complex_threads",
      "1",
      "-i",
      file,
      "-filter_complex",
      "[0:v]trim=start=2,setpts=PTS-STARTPTS,split[a][b];[b]palettegen=stats_mode=full[p];[a][p]paletteuse=dither=none:diff_mode=rectangle",
      "-loop",
      "0",
      temp,
    ]);
    fs.renameSync(temp, file);
    fs.writeFileSync(mark, JSON.stringify({ sha256: hash(file), skippedSeconds: 2 }));
    console.log(
      `${file}: ${(size / 1024).toFixed(0)} → ${(fs.statSync(file).size / 1024).toFixed(0)} KB`,
    );
  }

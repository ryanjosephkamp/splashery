#!/usr/bin/env node
// Serialize sample bakes on one GPU; use --high for the original high-quality target.
// A compact bake is an explicit software-GPU compromise, never described as high quality.
// node tools/cdx-v3d-sample-batch.mjs <capture-directory> <output-directory> [--high] [id ...]
// Capture names are those written by cdx-v3d-sample-sources.mjs (<id>-capture.webm).
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { CAPTURES } from "./cdx-v3d-sample-sources.mjs";

const [captureDir, outputDir, ...args] = process.argv.slice(2);
if (!captureDir || !outputDir)
  throw new Error("Usage: cdx-v3d-sample-batch.mjs <capture-directory> <output-directory> [--high] [id ...]"); // prettier-ignore
const ids = args.filter((a) => !a.startsWith("--"));
const settings = args.includes("--high")
  ? ["--frames=40", "--side=800", "--train=640", "--iters=3000", "--splats=120000", "--seed=40000"]
  : ["--frames=24", "--side=800", "--train=256", "--iters=1000", "--splats=30000", "--seed=12000"];
for (const s of CAPTURES.filter((s) => !ids.length || ids.includes(s.id))) {
  console.log(`Baking ${s.id} from its own capture: ${s.license}`);
  try {
    const high = args.includes("--high");
    let input = `assets/toys/video-3d/${s.id}-source.webm`;
    if (high) {
      // Give the browser only the chosen shot. A long film can exceed Chromium's memory
      // before training begins; this high-quality native-size cut keeps the same footage.
      input = path.join(captureDir, `${s.id}-bake.webm`);
      execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-y", "-ss", String(s.span.start), "-i", path.join(captureDir, `${s.id}-capture.webm`), "-t", String(s.span.length), "-an", "-c:v", "libvpx-vp9", "-crf", "18", "-b:v", "0", "-row-mt", "1", input]); // prettier-ignore
    }
    if (!fs.existsSync(input)) throw new Error(`Missing source cut: ${input}`);
    execFileSync(process.execPath, ["tools/cdx-v3d-sample-bake.mjs", input, path.join(outputDir, s.id), "--start=0", `--length=${s.span.length}`, ...(high ? [] : ["--max-seconds=1200"]), ...settings], { stdio: "inherit" }); // prettier-ignore
  } catch (error) {
    console.error(`${s.id} did not produce a successful bake (${error.message}).`);
    process.exitCode = 1;
  }
}

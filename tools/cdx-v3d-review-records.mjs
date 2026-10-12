#!/usr/bin/env node
// Record hashes and retained source licenses after refreshing the task-40 review renders.
// node tools/cdx-v3d-review-records.mjs
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { format } from "prettier";
import { SAMPLES } from "../src/video3d/samples.js";

const directory = "assets/toys/video-3d/review";
const records = [];
for (const name of fs.readdirSync(directory).sort()) {
  const id =
    name === "phone-walk.png"
      ? "edinburgh"
      : name === "liberty-thumb.webp"
        ? "liberty"
        : SAMPLES.find((s) => name.startsWith(`${s.id}-`))?.id;
  const sample = SAMPLES.find((s) => s.id === id);
  if (!sample) throw new Error(`No source credit for review file: ${name}`);
  const file = path.join(directory, name);
  const bytes = fs.readFileSync(file);
  if (bytes.length > 20_000_000) throw new Error(`Review file over 20 MB: ${name}`);
  records.push({
    file,
    toy: "video-3d",
    author: sample.author,
    page: sample.source,
    license: sample.license,
    licenseUrl: sample.licenseUrl,
    checked: "October 12, 2026",
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    transformationCredit: "Made by Ryan with Codex (GPT-6).",
    changed: name.endsWith(".json")
      ? "Recorded actual browser load, transfer bytes, and scene statistics alongside the rendered screenshot."
      : "Rendered the actual video-derived Gaussian scene through the browser renderer; images and clips retain the capture license. Interface and other shelf thumbnails retain their existing credits.",
  });
}
const assets = JSON.parse(fs.readFileSync("tools/assets.json", "utf8"));
assets.videoReviewEvidence = records;
fs.writeFileSync(
  "tools/assets.json",
  await format(JSON.stringify(assets), {
    parser: "json",
    printWidth: 100,
  }),
);
console.log(`${records.length} review files credited and hashed.`);

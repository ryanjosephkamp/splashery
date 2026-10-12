#!/usr/bin/env node
// Register the genuine task-40 exports after inspecting them. Source cuts must already
// exist (cdx-v3d-sample-sources.mjs); this updates only their assets, sample entries, and credits.
// node tools/cdx-v3d-register.mjs <reviewed-bake-directory> [capture-id ...]
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { format } from "prettier";
import { CAPTURES } from "./cdx-v3d-sample-sources.mjs";
import { SAMPLES } from "../src/video3d/samples.js";
import { readSplatPly } from "../src/video3d/ply.js";
import { registerBakedSamples } from "./cdx-v3d-baked.mjs";

const [directory, ...requested] = process.argv.slice(2);
if (!directory)
  throw new Error("Usage: cdx-v3d-register.mjs <reviewed-bake-directory> [capture-id ...]");
if (requested.some((id) => !CAPTURES.some((s) => s.id === id)))
  throw new Error("Choose adjara, lihula, toolse, or poltsamaa; omit IDs to register all four.");
const captures = CAPTURES.filter((s) => !requested.length || requested.includes(s.id));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const pretty = (value, parser = "json") =>
  format(value, { parser, printWidth: 100, proseWrap: "always" });
const credit = "Made by Ryan with Codex (GPT-6).";
const records = [];
const samples = [];
const metadata = new Map();
const staged = [];

// Validate and format every export before changing any shipped file or registry entry.
for (const s of captures) {
  const flat = path.join(directory, s.id);
  const input = fs.existsSync(`${flat}.ply`) ? flat : path.join(flat, s.id);
  const ply = fs.readFileSync(`${input}.ply`);
  const meta = JSON.parse(fs.readFileSync(`${input}.json`, "utf8"));
  const raw = readSplatPly(ply);
  if (!(meta.stats?.iters > 0 && raw.count > 0 && meta.cams?.length >= 3))
    throw new Error(`No learned model and usable camera path: ${s.id}`);
  for (const key of ["pos", "scales", "quat", "color", "opacity"])
    if (!raw[key].every(Number.isFinite)) throw new Error(`Nonfinite ${key}: ${s.id}`);
  if (!raw.scales.every((v) => v > 0) || !raw.opacity.every((v) => v > 0))
    throw new Error(`Invalid Gaussian size or opacity: ${s.id}`);
  if (
    meta.stats.registered !== meta.cams.length ||
    meta.cams.some(
      (c) =>
        ![...c.R, ...c.t, c.f, c.w, c.h, c.time].every(Number.isFinite) ||
        c.time < 0 ||
        c.time > s.span.length + 0.05,
    )
  )
    throw new Error(`Invalid or incorrectly timed camera path: ${s.id}`);
  meta.stats.exportedSplats = raw.count;
  meta.stats.plyBytes = ply.length;
  const initialSide = meta.bake?.settings?.trainSide;
  const exportSide = meta.bake?.exportTrainSide || meta.continuation?.trainSide || initialSide;
  const finish = meta.continuation
    ? ` The last continuation completed ${meta.continuation.completedIterations} additional steps at up to ${exportSide} px, reusing the recorded cameras and learned model.`
    : "";
  const backend = meta.bake?.backend === "msplat/Metal" ? "COLMAP and msplat on Metal" : "Splat.js";
  const capture =
    meta.bake?.backend === "msplat/Metal" && meta.bake.source?.captureSha256 ? meta.bake.source : s;
  const changed = `Selected one continuous shot, removed sound, made 480p source cuts, solved cameras, and trained real Gaussian splats through ${backend}. Initially ${initialSide} px training.${finish}`;
  meta.provenance = {
    transformationCredit: credit,
    source: s.source,
    author: s.author,
    license: s.license,
    licenseUrl: s.licenseUrl,
    checked: s.checked,
    captureUrl: capture.captureUrl,
    captureSha256: capture.captureSha256,
    sourceSpan: s.span,
    changed,
  };
  meta.bake ||= {};
  meta.bake.originalSourceSpan = s.span;
  meta.bake.sourceTimeOffset ??= meta.bake.start || 0;
  const base = `assets/toys/video-3d/${s.id}`;
  const json = Buffer.from(await pretty(JSON.stringify(meta)));
  const sourceMp4 = fs.readFileSync(`${base}-source.mp4`);
  const sourceWebm = fs.readFileSync(`${base}-source.webm`);
  const files = {};
  for (const [file, bytes] of [
    ...(ply.length <= 20_000_000 ? [[`${base}.ply`, ply]] : []),
    [`${base}.json`, json],
    [`${base}-source.mp4`, sourceMp4],
    [`${base}-source.webm`, sourceWebm],
  ]) {
    if (bytes.length > 20_000_000) throw new Error(`Over 20 MB: ${file}`);
    files[file] = { bytes: bytes.length, sha256: sha(bytes) };
  }
  const defaultBytes = ply.length + json.length;
  // A full-resolution build export may exceed the site's single-file guidance. It remains
  // in scratch; BKD1 phone tiers are created from it before checking the actual default load.
  if (ply.length <= 20_000_000) staged.push([`${base}.ply`, ply]);
  staged.push([`${base}.json`, json]);
  samples.push({
    id: s.id,
    label: `${s.label} (compact)`,
    transformationCredit: credit,
    title: `${s.title} (${s.span.length} seconds from ${s.span.start} seconds)`,
    length: s.length,
    span: s.span,
    author: s.author,
    source: s.source,
    license: s.license,
    licenseUrl: s.licenseUrl,
    checked: s.checked,
    sha256: sha(ply),
  });
  records.push({
    id: s.id,
    transformationCredit: credit,
    file: `${base}.ply`,
    path: `${base}.json`,
    toy: "video-3d",
    name: s.title,
    author: s.author,
    page: s.source,
    license: s.license,
    checked: s.checked,
    captureUrl: capture.captureUrl,
    captureSha256: capture.captureSha256,
    files,
    defaultBytes,
    note: `${s.span.length} seconds from ${s.span.start} seconds; ${meta.stats.registered}/${meta.stats.frames} cameras placed; ${meta.stats.iters} completed total iterations; ${raw.count} exported splats. ${changed} Silent MP4 and WebM cuts ship for Show the original. Scene, path, and source cuts retain the source license. No identifiable people, logos, or brands were seen in the inspected shot.`,
  });
  metadata.set(s.id, meta);
}
// The unshipped Christ–Roi experiment failed visual review; retire its task-40 draft entries too.
const ids = new Set([...captures.map((s) => s.id), "christ-roi"]);
const all = SAMPLES.filter((s) => s.id !== "christ-roi").map(
  (s) => samples.find((updated) => updated.id === s.id) || s,
);
all.push(...samples.filter((s) => !all.some((current) => current.id === s.id)));
const asset = JSON.parse(fs.readFileSync("tools/assets.json", "utf8"));
asset.videoSamples = [...asset.videoSamples.filter((s) => !ids.has(s.id)), ...records];
const rows = CAPTURES.map((s) => {
  const meta =
    metadata.get(s.id) || JSON.parse(fs.readFileSync(`assets/toys/video-3d/${s.id}.json`));
  const side =
    meta.bake?.exportTrainSide || meta.continuation?.trainSide || meta.bake?.settings?.trainSide;
  const count = meta.stats.exportedSplats || meta.stats.splats;
  return `- [${s.label}](${s.source}), by ${s.author}: [${s.license}](${s.licenseUrl}), ${s.span.length} seconds from ${s.span.start} seconds. ${meta.stats.registered}/${meta.stats.frames} cameras, ${meta.stats.iters.toLocaleString("en-US")} completed total training steps, and ${count.toLocaleString("en-US")} exported splats. Last export trained at up to ${side} pixels.`;
});
const start = "<!-- Codex task 40 new Video to 3D captures -->";
const end = "<!-- End Codex task 40 new Video to 3D captures -->";
const section = `${start}\n\nCodex task 40 code (MIT): made by Ryan with Codex (GPT-6).\n\nNew Video to 3D captures, checked on their live Commons pages on October 12, 2026:\n\n${rows.join("\n")}\n\nThe transformations were made by Ryan with Codex (GPT-6). These are real captures, independently solved and trained with the backend recorded in each sample JSON. Their silent 480p source cuts, camera paths, and splats retain each source license, including CC BY-SA. The viewer uses compact BKD1 tiers; the training budget, every completed iteration, and any continuation are recorded in the sample JSON. Native-resolution hardware bakes use \`tools/cdx-v3d-mac-bake.mjs\`; compact browser bakes use \`tools/cdx-v3d-sample-batch.mjs\`. Sources, changes, byte counts, and SHA-256 hashes of every shipped sample file are recorded in \`tools/assets.json\`. The selected shots were inspected for identifiable people, logos, and brands.\n\n${end}`;
let credits = fs.readFileSync("CREDITS.md", "utf8");
if (!credits.includes(start) || !credits.includes(end))
  throw new Error(
    "The task-40 credit markers are missing; preserve unrelated credits before registering.",
  );
credits =
  credits.slice(0, credits.indexOf(start)) +
  section +
  credits.slice(credits.indexOf(end) + end.length);
staged.push([
  "src/video3d/samples.js",
  await pretty(
    `// Real, independently trained Video to 3D captures. Source cuts, camera paths, and splats\n// retain the credited source licenses. Full hashes and training history are in tools/assets.json\n// and the sample JSON. Attribution also appears beside the viewer.\nexport const SAMPLES = ${JSON.stringify(all)};\n`,
    "babel",
  ),
]);
staged.push(["tools/assets.json", await pretty(JSON.stringify(asset))]);
staged.push(["CREDITS.md", await pretty(credits, "markdown")]);
for (const [file, bytes] of staged) fs.writeFileSync(file, bytes);
await registerBakedSamples(directory, all, new Set(captures.map((s) => s.id)));
for (const r of records) if (!r.files[r.file]) fs.rmSync(r.file, { force: true });
for (const r of records)
  console.log(JSON.stringify({ id: r.id, defaultBytes: r.defaultBytes, files: r.files }));

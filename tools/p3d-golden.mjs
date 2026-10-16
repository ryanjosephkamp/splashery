// Classic Photo to 3D, frozen (the owner's call of October 16, 2026; tag `photo-3d-classic-v1`).
// Rebuilds every built-in sample from its shipped photo and depth at the phone and desktop budgets,
// in plain Node (no GPU and no depth model, so every machine gets the same bytes), and fingerprints
// what classic makes: everything the build worker returns (the splats, the background layer, the
// Sharp view's surface and backing sheet, and the build's stats). tests/p3d-golden.spec.mjs
// compares against tests/p3d-golden.json, so any change to the classic path fails there. New
// methods live beside it (Codex task 99, `src/photo3d/next/`).
//
//   node tools/p3d-golden.mjs            # compare with the pins and list what changed
//   node tools/p3d-golden.mjs --write    # re-pin: only with the owner's yes
//
// The budgets are the phone and desktop profiles' (the same as task 76's equivalence check).

import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_SAMPLES, decodePhoto, unpackDepth } from "../src/packs/photo-3d.js";
import { HARD_CASE_SAMPLES } from "../src/packs/hard-case-samples.js";
import { buildPhotoSplats, preparePhotoColors } from "../src/packs/photo-3d-core.js";
import { surfaceGrid } from "../src/photo3d/surface.js";
import { backingField, depthBytes } from "../src/live/relief-height.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PINS = path.join(root, "tests/p3d-golden.json");
export const PROFILES = [
  ["phone", 85500, 60000],
  ["desktop", 199500, 120000],
];

export const goldenSamples = () => [...ALL_SAMPLES, ...HARD_CASE_SAMPLES];

const sha = (v) =>
  crypto
    .createHash("sha256")
    .update(new Uint8Array(v.buffer, v.byteOffset, v.byteLength))
    .digest("hex");
// Typed arrays become their hash, numbers and booleans stay, and nested objects (the background
// layer, its soft copy, the build's stats) are walked, so every part the classic build returns is in
// the fingerprint.
function prints(object) {
  const out = {};
  for (const [k, v] of Object.entries(object).sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (ArrayBuffer.isView(v)) out[k] = `${v.constructor.name}[${v.length}] ${sha(v)}`;
    else if (Array.isArray(v)) out[k] = v.map((x) => (x && typeof x === "object" ? prints(x) : x));
    else if (v && typeof v === "object") out[k] = prints(v);
    else if (typeof v === "number" || typeof v === "boolean" || typeof v === "string") out[k] = v;
  }
  return out;
}

// One sample's fingerprint at both budgets.
export async function fingerprint(sample) {
  const base = path.join(root, "assets/toys/photo-3d", sample.dir || "", sample.file || sample.id);
  const photo = await decodePhoto(
    new Uint8Array(fs.readFileSync(`${base}.${sample.ext || "jpg"}`)),
  );
  const depth = unpackDepth(new Uint8Array(fs.readFileSync(`${base}.depth`)));
  const out = {};
  for (const [profile, count, sharpCells] of PROFILES) {
    const prepared = preparePhotoColors(photo, {
      count,
      depthWidth: depth.w,
      depthHeight: depth.h,
    });
    // The same steps as src/photo3d/build-worker.js, at the toy's default depth (0.5).
    const b = buildPhotoSplats(photo, depth, { count, sharpCells, depth: 0.5, keepFlat: false, prepared }); // prettier-ignore
    const f = Math.min(1, Math.sqrt(sharpCells / (b.gx * b.gy)));
    const cols = Math.max(8, Math.round(b.gx * f));
    const rows = Math.max(8, Math.round(b.gy * f));
    const backRows = Math.max(8, Math.round((96 * rows) / cols));
    b.background.surface = surfaceGrid(cols, rows, { depth: depthBytes(b.depth), band: b.cellBand, gx: b.gx, gy: b.gy, compact: true }); // prettier-ignore
    b.background.field = backingField(depthBytes(b.depth), b.cellBand, b.gx, b.gy, { cols: 96, rows: backRows, reach: b.background.reach, inset: 0.998, rim: Math.max(6 / rows, 0.03 * Math.max(1, cols / rows)), base: 0.5 }); // prettier-ignore
    out[profile] = prints(b);
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const write = process.argv.includes("--write");
  const pins = !write && fs.existsSync(PINS) ? JSON.parse(fs.readFileSync(PINS, "utf8")) : {};
  const now = {};
  let changed = 0;
  for (const s of goldenSamples()) {
    now[s.id] = await fingerprint(s);
    const same = JSON.stringify(now[s.id]) === JSON.stringify(pins[s.id]);
    if (!write && !same) changed++;
    console.log(s.id, write ? "pinned" : same ? "unchanged" : "CHANGED");
  }
  if (write) fs.writeFileSync(PINS, JSON.stringify(now, null, 2) + "\n");
  else if (changed) {
    console.error(`${changed} samples differ from the pins: classic Photo to 3D changed.`);
    process.exitCode = 1;
  }
}

// Read-only comparison with a detached checkout of the protected checkpoint.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { inputsR4 } from "./cdx-p3d4-common.mjs";
import { inputFingerprintsR3 } from "./cdx-p3d2-r3-fingerprint.mjs";
import { decodePhoto, unpackDepth } from "../src/packs/photo-3d.js";
import { buildPhotoSplats, preparePhotoColors } from "../src/packs/photo-3d-core.js";
import { surfaceGrid } from "../src/photo3d/surface.js";
import { depthBytes } from "../src/live/relief-height.js";
const opt = (name, fallback) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const checkpoint = path.resolve(opt("checkpoint", "../splashery-checkpoint"));
const before = await import(pathToFileURL(path.join(checkpoint, "src/packs/photo-3d-core.js")));
const oldSurface = await import(pathToFileURL(path.join(checkpoint, "src/photo3d/surface.js")));
const out = opt("out", ".cache/photo-3d-r4/equivalence.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
const rows = [];
const sourceFiles = [
  "src/packs/photo-3d-core.js",
  "src/photo3d/background.js",
  "src/photo3d/depth-edges.js",
  "src/photo3d/pixels.js",
  "src/photo3d/surface.js",
];
const sourceHashes = (root) =>
  Object.fromEntries(
    sourceFiles
      .filter((f) => fs.existsSync(path.join(root, f)))
      .map((f) => [
        f,
        crypto
          .createHash("sha256")
          .update(fs.readFileSync(path.join(root, f)))
          .digest("hex"),
      ]),
  );
const sources = { checkpoint: sourceHashes(checkpoint), candidate: sourceHashes(process.cwd()) };
const inputHashes = inputFingerprintsR3(inputsR4());
function differences(a, b, at = "") {
  if (ArrayBuffer.isView(a)) {
    if (a.constructor !== b?.constructor || a.length !== b.length) return [{ at, shape: true }];
    let changed = 0,
      maximumError = 0;
    for (let i = 0; i < a.length; i++)
      if (!Object.is(a[i], b[i])) {
        changed++;
        maximumError = Math.max(maximumError, Math.abs(a[i] - b[i]));
      }
    return changed ? [{ at, changed, maximumError }] : [];
  }
  if (a && typeof a === "object") {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b || {})])];
    return keys.flatMap((k) => differences(a[k], b?.[k], `${at}.${k}`));
  }
  return Object.is(a, b) ? [] : [{ at, before: a, after: b }];
}
const hashes = (object) =>
  Object.fromEntries(
    Object.entries(object)
      .filter(([, v]) => ArrayBuffer.isView(v))
      .map(([k, v]) => [
        k,
        crypto
          .createHash("sha256")
          .update(new Uint8Array(v.buffer, v.byteOffset, v.byteLength))
          .digest("hex"),
      ]),
  );
const selected = opt("samples", "all");
for (const input of inputsR4().filter(
  (s) => selected === "all" || selected.split(",").includes(s.id),
)) {
  const base = `assets/toys/photo-3d/${input.dir ? input.dir + "/" : ""}${input.file || input.id}`;
  const photo = await decodePhoto(
    new Uint8Array(fs.readFileSync(input.builtin ? base + "." + (input.ext || "jpg") : input.file)),
  );
  const depth = unpackDepth(
    new Uint8Array(fs.readFileSync(input.builtin ? base + ".depth" : input.depthFile)),
  );
  for (const [profile, count, sharpCells] of [
    ["phone", 85500, 60000],
    ["desktop", 199500, 120000],
  ]) {
    const options = { count, sharpCells, depth: 1, keepFlat: !input.builtin };
    const prepared = preparePhotoColors(photo, {
      count,
      depthWidth: depth.w,
      depthHeight: depth.h,
    });
    const a = before.buildPhotoSplats(photo, depth, options),
      b = buildPhotoSplats(photo, depth, { ...options, prepared });
    const scale = Math.min(1, Math.sqrt(sharpCells / (b.gx * b.gy)));
    const cols = Math.max(8, Math.round(b.gx * scale)),
      rowsN = Math.max(8, Math.round(b.gy * scale));
    const source = {
      depth: depthBytes(b.depth),
      band: b.cellBand,
      gx: b.gx,
      gy: b.gy,
      compact: true,
    };
    const oldGrid = oldSurface.surfaceGrid(cols, rowsN, source),
      grid = surfaceGrid(cols, rowsN, source);
    const changed = [...differences(a, b), ...differences(oldGrid, grid, "surface")];
    rows.push({ id: input.id, profile, changed, surfaceHashes: hashes(grid) });
    fs.writeFileSync(out, JSON.stringify({ checkpoint, sources, inputHashes, rows }, null, 2));
    console.log(input.id, profile, changed.length ? JSON.stringify(changed) : "identical");
  }
}
if (rows.some((r) => r.changed.length)) process.exitCode = 1;

#!/usr/bin/env node
// Lane Photoreal r3: a capture's outline without its soft haze (the owner's notes of October 9,
// 2026: "more precisely outlined"). Writes a cleaned copy of a tools/assets.json entry's source as
// a PLY, in the source's own frame, for the entry's "local" field (tools/pr3-prepare.mjs then
// prepares it exactly as before).
//
//   node tools/pr3-defuzz.mjs <id> [--voxel=80] [--grow=1] [--faint=0.3] [--needle=0] [--big=0]
//
// It keeps every splat that is at least `faint` opaque, and a fainter one only when it lies in or
// next to the solid body (voxels of 1/voxel of the capture's radius holding a splat over 0.5
// opaque, grown by `grow` voxels): the faint splats floating just outside the surface are the haze.
// Splats under `faint` never count toward the bounds tools/pr3-prepare.mjs centers and scales the
// toy by, so the toy keeps its size and place (and its rig its coordinates).

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? Number(a.slice(name.length + 3)) : def;
};
const [id] = args.filter((a) => !a.startsWith("--"));
const voxels = opt("voxel", 80);
const grow = opt("grow", 1);
const faint = opt("faint", 0.3);
const needle = opt("needle", 0);
const big = opt("big", 0);
const toy = JSON.parse(fs.readFileSync(path.join(root, "tools/assets.json"), "utf8")).toys.find((t) => t.id === id); // prettier-ignore
if (!toy) throw new Error(`No entry ${id} in tools/assets.json`);

const work = path.join(root, ".cache/pr3/defuzz");
fs.mkdirSync(work, { recursive: true });
const raw = path.join(work, `${id}-source.ply`);
const bin = path.join(root, "node_modules/.bin/splat-transform");
execFileSync(bin, ["-g", "cpu", "-q", "-w", ...(toy.lod !== undefined ? ["-L", String(toy.lod)] : []), toy.source, raw], { stdio: "inherit" }); // prettier-ignore

const buf = fs.readFileSync(raw);
const headEnd = buf.indexOf("end_header\n") + 11;
const head = buf.subarray(0, headEnd).toString("latin1");
const props = [...head.matchAll(/^property float (\S+)$/gm)].map((m) => m[1]);
const n = Number(/element vertex (\d+)/.exec(head)[1]);
const P = props.length;
const data = new Float32Array(buf.buffer.slice(buf.byteOffset + headEnd), 0, n * P);
const [ix, iy, iz, io] = ["x", "y", "z", "opacity"].map((p) => props.indexOf(p));
const sig = (i) => 1 / (1 + Math.exp(-data[i * P + io]));

// The capture's radius, from its reasonably opaque splats (as tools/pr3-prepare.mjs measures it).
const half = [ix, iy, iz].map((k) => {
  const v = [];
  for (let i = 0; i < n; i++) if (sig(i) > 0.3) v.push(data[i * P + k]);
  v.sort((a, b) => a - b);
  return (v[Math.floor(v.length * 0.985)] - v[Math.floor(v.length * 0.015)]) / 2;
});
const size = Math.max(...half) / voxels;
const key = (i, dx = 0, dy = 0, dz = 0) =>
  `${Math.floor(data[i * P + ix] / size) + dx},${Math.floor(data[i * P + iy] / size) + dy},${Math.floor(data[i * P + iz] / size) + dz}`; // prettier-ignore

const solid = new Set();
for (let i = 0; i < n; i++) {
  if (sig(i) <= 0.5) continue;
  for (let dx = -grow; dx <= grow; dx++)
    for (let dy = -grow; dy <= grow; dy++)
      for (let dz = -grow; dz <= grow; dz++) solid.add(key(i, dx, dy, dz));
}
// Needles: splats much longer than they are wide (over `needle` times) and longer than a voxel,
// the hairs that stand off a capture's edge.
const sc = ["scale_0", "scale_1", "scale_2"].map((p) => props.indexOf(p));
const isNeedle = (i) => {
  if (!needle) return false;
  const s = sc.map((k) => Math.exp(data[i * P + k])).sort((a, b) => b - a);
  return s[0] > needle * s[1] && s[0] > size;
};
// Blobs: splats over `big` voxels across, the soft smudges on a capture's surface.
const isBig = (i) => big && Math.max(...sc.map((k) => Math.exp(data[i * P + k]))) > big * size;
const keep = [];
let needles = 0;
for (let i = 0; i < n; i++) {
  if (isNeedle(i) || isBig(i)) needles++;
  else if (sig(i) >= faint || solid.has(key(i))) keep.push(i);
}

const rows = new Float32Array(keep.length * P);
keep.forEach((i, j) => rows.set(data.subarray(i * P, i * P + P), j * P));
const file = path.join(work, `${id}.ply`);
const top = Buffer.from(head.replace(/element vertex \d+/, `element vertex ${keep.length}`), "latin1"); // prettier-ignore
fs.writeFileSync(file, Buffer.concat([top, Buffer.from(rows.buffer)]));
console.log(`${id}: kept ${keep.length} of ${n} splats (${needles} needles or blobs, ${n - keep.length - needles} faint ones outside the body, voxel ${size.toFixed(4)}) -> ${path.relative(root, file)}`); // prettier-ignore

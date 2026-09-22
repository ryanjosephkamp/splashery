#!/usr/bin/env node
// Prepares the captured toys with @playcanvas/splat-transform (MIT):
// rotate upright, drop spherical harmonics, centre and scale to a radius of
// about 0.9, crop stray floaters, decimate, and write SOG files.
//
//   node tools/prepare-assets.mjs            # every toy in tools/assets.json
//   node tools/prepare-assets.mjs cactus bee # just these
//
// Output: assets/toys/<id>/<id>.sog and <id>-lite.sog (weak devices).
// Intermediate files go to .cache/prep/ (git-ignored).

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "tools/assets.json"), "utf8"));
const bin = path.join(root, "node_modules/.bin/splat-transform");
const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));

function st(args) {
  execFileSync(bin, ["-g", "cpu", "-q", "-w", ...args], { stdio: "inherit", cwd: root });
}

// Minimal reader for the binary little-endian PLY files splat-transform writes.
function readPly(file) {
  const buf = fs.readFileSync(file);
  const headEnd = buf.indexOf("end_header\n");
  const head = buf.subarray(0, headEnd).toString("latin1").split("\n");
  let count = 0;
  const props = [];
  for (const line of head) {
    const t = line.trim().split(/\s+/);
    if (t[0] === "element" && t[1] === "vertex") count = Number(t[2]);
    if (t[0] === "property") {
      if (t[1] !== "float") throw new Error(`Unexpected PLY property type ${t[1]} in ${file}`);
      props.push(t[2]);
    }
  }
  const data = new Float32Array(
    buf.buffer.slice(buf.byteOffset + headEnd + 11),
    0,
    count * props.length,
  );
  const col = (name) => {
    const k = props.indexOf(name);
    const out = new Float32Array(count);
    for (let i = 0; i < count; i++) out[i] = data[i * props.length + k];
    return out;
  };
  return { count, x: col("x"), y: col("y"), z: col("z"), opacity: col("opacity") };
}

// Bounds of the reasonably opaque splats, ignoring the outer 1.5 % per axis.
function robustBounds(ply) {
  const keep = [];
  for (let i = 0; i < ply.count; i++) if (1 / (1 + Math.exp(-ply.opacity[i])) > 0.3) keep.push(i);
  const center = [];
  const half = [];
  for (const axis of [ply.x, ply.y, ply.z]) {
    const v = keep.map((i) => axis[i]).sort((a, b) => a - b);
    const lo = v[Math.floor(v.length * 0.015)];
    const hi = v[Math.floor(v.length * 0.985)];
    center.push((lo + hi) / 2);
    half.push((hi - lo) / 2);
  }
  return { center, half, kept: keep.length };
}

const fmt = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;

for (const toy of manifest.toys) {
  if (only.length && !only.includes(toy.id)) continue;
  const work = path.join(root, ".cache/prep", toy.id);
  const out = path.join(root, "assets/toys", toy.id);
  fs.mkdirSync(work, { recursive: true });
  fs.mkdirSync(out, { recursive: true });
  const src = /^https?:/.test(toy.source) ? toy.source : path.join(root, toy.source);
  if (!/^https?:/.test(src) && !fs.existsSync(src)) {
    console.error(`Missing source for ${toy.id}: ${src}\n  ${toy.sourceNote}`);
    process.exitCode = 1;
    continue;
  }
  console.log(`\n== ${toy.id}: ${toy.source}`);
  const rot = path.join(work, "rotated.ply");
  st([src, "-r", toy.rotate.join(","), "-H", "0", "-N", rot]);
  const b = robustBounds(readPly(rot));
  const scale = 0.9 / Math.max(...b.half);
  console.log(
    `   centre ${b.center.map((v) => v.toFixed(3))}, half ${b.half.map((v) => v.toFixed(3))}, scale ${scale.toFixed(4)}`,
  );
  const full = path.join(work, "full.ply");
  const lite = path.join(work, "lite.ply");
  const box = (toy.crop || [-1.35, -1.35, -1.35, 1.35, 1.35, 1.35]).join(",");
  // splat-transform applies actions in its own frame, where x and y point the
  // other way from the PLY file, so the translation is (cx, cy, -cz).
  const t = [b.center[0], b.center[1], -b.center[2]].map((v) => v.toFixed(5)).join(",");
  const filters = (toy.filters || []).flatMap((f) => ["-V", f]);
  const move = [
    `--translate=${t}`,
    `--scale=${scale.toFixed(5)}`,
    `--filter-box=${box}`,
    ...filters,
  ];
  st([rot, ...move, "-d", String(toy.splats), full]);
  const check = robustBounds(readPly(full));
  console.log(
    `   normalised centre ${check.center.map((v) => v.toFixed(3))}, half ${check.half.map((v) => v.toFixed(3))}`,
  );
  st([full, path.join(out, `${toy.id}.sog`)]);
  st([full, "-d", String(toy.lite), lite]);
  st([lite, path.join(out, `${toy.id}-lite.sog`)]);
  for (const f of [`${toy.id}.sog`, `${toy.id}-lite.sog`]) {
    const size = fs.statSync(path.join(out, f)).size;
    console.log(`   ${f}: ${fmt(size)}`);
    if (size > 25 * 1024 * 1024) console.warn(`   WARNING: ${f} is over 25 MB`);
  }
}

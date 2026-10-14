#!/usr/bin/env node
// Earth and maps (lane Geo): the living city's block of central Helsinki, from the City of
// Helsinki's open reality mesh (Helsinki 3D, 2017 photogrammetry; CC BY 4.0,
// https://hri.fi/data/en_GB/dataset/helsingin-3d-kaupunkimalli). The mesh comes as 2 km zips of
// 250 m tiles (OBJ, MTL and JPEG, in ETRS-GK25 meters, EPSG:3879). This reads only the pieces
// it needs out of one zip with HTTP range requests (the zip is about 2 GB), crops a block round
// Senate Square, the Cathedral and the Market Square, and samples its surface into splats with
// the Studio's converter (src/packs/studio-models-core.js), as tools/model-to-splats.mjs does.
//
//   node tools/geo-city.mjs [--splats 600000] [--level 18]
//
// Writes assets/toys/living-city/city.bin.gz: positions (Uint16 x 3, delta-coded), normals (Int8 x 3),
// colors (RGB) and sizes (Uint8, log scale). The pieces are cached in .cache/geo/helsinki/.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import jpeg from "jpeg-js";
import { parseModel, prepareModel, sampleSurface } from "../src/packs/studio-models-core.js";
import { writeGeo } from "./geo-lib.mjs";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const ZIP =
  "https://3d.hel.ninja/data/mesh/Helsinki3D-MESH_2017_OBJ_2km-250m_ZIP/Helsinki3D_2017_OBJ_672496x2.zip";
const ORIGIN = [25490000, 6668000]; // the zip's SRSOrigin (metadata.xml)
// The block, in ETRS-GK25 meters: Senate Square and the Cathedral to the north, the Market
// Square and the South Harbor's quay to the south, the Uspenski Cathedral at the east edge.
const CROP = { e0: 25497250, e1: 25497800, n0: 6672600, n1: 6673150 };
const LEVEL = Number(opt("level", 18));
const SPLATS = Number(opt("splats", 600000));
const DIR = ".cache/geo/helsinki";
fs.mkdirSync(DIR, { recursive: true });

// ---- Reading a zip over HTTP ----------------------------------------------------------------

async function range(a, b) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(ZIP, { headers: { Range: `bytes=${a}-${b}` } });
      if (r.status !== 206) throw new Error(`${r.status} for a range`);
      return Buffer.from(await r.arrayBuffer());
    } catch (err) {
      if (i >= 4) throw err;
      await new Promise((res) => setTimeout(res, 2000 * 2 ** i));
    }
  }
}

async function directory() {
  const file = path.join(DIR, "directory.json");
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  const head = await fetch(ZIP, { method: "HEAD" });
  const size = Number(head.headers.get("content-length"));
  const tail = await range(size - 65558, size - 1);
  const at = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const cdSize = tail.readUInt32LE(at + 12);
  const cdOff = tail.readUInt32LE(at + 16);
  const cd = await range(cdOff, cdOff + cdSize - 1);
  const entries = {};
  for (let p = 0; p < cd.length && cd.readUInt32LE(p) === 0x02014b50; ) {
    const method = cd.readUInt16LE(p + 10);
    const csize = cd.readUInt32LE(p + 20);
    const nlen = cd.readUInt16LE(p + 28);
    const xlen = cd.readUInt16LE(p + 30);
    const clen = cd.readUInt16LE(p + 32);
    const off = cd.readUInt32LE(p + 42);
    const name = cd.toString("utf8", p + 46, p + 46 + nlen);
    entries[name] = { method, csize, off };
    p += 46 + nlen + xlen + clen;
  }
  fs.writeFileSync(file, JSON.stringify(entries));
  return entries;
}

async function entry(dir, name) {
  const file = path.join(DIR, name.replace(/\//g, "_"));
  if (fs.existsSync(file)) return fs.readFileSync(file);
  const e = dir[name];
  const head = await range(e.off, e.off + 29);
  const start = e.off + 30 + head.readUInt16LE(26) + head.readUInt16LE(28);
  const raw = await range(start, start + e.csize - 1);
  const data = e.method === 8 ? zlib.inflateRawSync(raw) : raw;
  fs.writeFileSync(file, data);
  return data;
}

// ---- The block ------------------------------------------------------------------------------

const dir = await directory();
// A 250 m tile's name holds its column and row: x = 250 X - 1750, y = 250 Y - 250 from ORIGIN.
const want = Object.keys(dir).filter((n) => {
  const m = n.match(/Tile_\+(\d+)_\+(\d+)_L(\d+)_\d+\.obj$/);
  if (!m || Number(m[3]) !== LEVEL) return false;
  const x = ORIGIN[0] + 250 * Number(m[1]) - 1750;
  const y = ORIGIN[1] + 250 * Number(m[2]) - 250;
  return x < CROP.e1 && x + 250 > CROP.e0 && y < CROP.n1 && y + 250 > CROP.n0;
});
console.log(`${want.length} pieces at level ${LEVEL}`);

// One OBJ for the whole block: vertices in meters from the block's center (Z up), triangles
// whose center lies outside the block left out.
const cx = (CROP.e0 + CROP.e1) / 2 - ORIGIN[0];
const cy = (CROP.n0 + CROP.n1) / 2 - ORIGIN[1];
const hx = (CROP.e1 - CROP.e0) / 2;
const hy = (CROP.n1 - CROP.n0) / 2;
const files = {};
const out = [];
const mtl = [];
let vBase = 0;
let tBase = 0;
let zmin = Infinity;
let zmax = -Infinity;
let tris = 0;
for (const name of want) {
  const text = (await entry(dir, name)).toString("utf8");
  const mtlName = name.replace(/\.obj$/, ".mtl");
  const mtlText = (await entry(dir, mtlName)).toString("utf8");
  const tag = path.basename(name, ".obj");
  // Each piece's material and picture, renamed so they stay apart.
  const rename = {};
  for (const line of mtlText.split(/\r?\n/)) {
    const m = line.match(/^\s*newmtl\s+(.+)$/);
    if (m) {
      rename[m[1].trim()] = `${tag}_${m[1].trim()}`;
      mtl.push(`newmtl ${tag}_${m[1].trim()}`);
    }
    const t = line.match(/^\s*map_Kd\s+(.+)$/);
    if (t) {
      const pic = t[1].trim();
      const bytes = await entry(dir, path.posix.join(path.posix.dirname(name), pic));
      files[`${tag}_${pic}`] = new Uint8Array(bytes);
      mtl.push(`map_Kd ${tag}_${pic}`);
    } else if (!m && /^\s*(Ka|Kd|d)\s/.test(line)) mtl.push(line.trim());
  }
  const V = [];
  let nv = 0;
  let nt = 0;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("v ")) {
      const [x, y, z] = line.slice(2).trim().split(/\s+/).map(Number);
      V.push([x - cx, y - cy, z]);
      out.push(`v ${(x - cx).toFixed(3)} ${(y - cy).toFixed(3)} ${z.toFixed(3)}`);
      nv++;
    } else if (line.startsWith("vt ")) {
      // The mesh's pictures read with v from the top; the converter reads OBJ's v from the bottom.
      const [u, v] = line.slice(3).trim().split(/\s+/).map(Number);
      out.push(`vt ${u} ${1 - v}`);
      nt++;
    } else if (line.startsWith("usemtl ")) {
      out.push(`usemtl ${rename[line.slice(7).trim()] || line.slice(7).trim()}`);
    } else if (line.startsWith("f ")) {
      const refs = line.slice(2).trim().split(/\s+/);
      const ids = refs.map((r) => r.split("/").map(Number));
      const c = [0, 1, 2].map((k) => ids.reduce((s, id) => s + V[id[0] - 1][k], 0) / ids.length);
      if (Math.abs(c[0]) > hx || Math.abs(c[1]) > hy) continue;
      for (const id of ids) {
        const z = V[id[0] - 1][2];
        zmin = Math.min(zmin, z);
        zmax = Math.max(zmax, z);
      }
      out.push(`f ${ids.map(([v, t]) => `${v + vBase}/${t + tBase}`).join(" ")}`);
      tris += ids.length - 2;
    }
  }
  vBase += nv;
  tBase += nt;
}
files["block.mtl"] = new TextEncoder().encode(mtl.join("\n"));
const obj = `mtllib block.mtl\n${out.join("\n")}\n`;
console.log(`${tris} triangles, heights ${zmin.toFixed(1)} to ${zmax.toFixed(1)} m`);

// ---- Splats ---------------------------------------------------------------------------------

const decodeImage = (bytes) => {
  const j = jpeg.decode(Buffer.from(bytes), { useTArray: true, maxMemoryUsageInMB: 2048 });
  return { w: j.width, h: j.height, data: j.data };
};
const raw = parseModel(new TextEncoder().encode(obj), "block.obj", { files });
const prep = await prepareModel(raw, { decodeImage });
for (const note of prep.notes) console.log(`note: ${note}`);
const s = sampleSurface(prep, SPLATS, { seed: 1, up: "z", light: false });
// The converter puts the model in a sphere of radius 1; back to meters from the block's center
// at ground level (Y up, X east, -Z north).
const lo = [Infinity, Infinity, Infinity];
const hi = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < s.n; i++)
  for (let k = 0; k < 3; k++) {
    lo[k] = Math.min(lo[k], s.pos[i * 3 + k]);
    hi[k] = Math.max(hi[k], s.pos[i * 3 + k]);
  }
const scale = (2 * hx) / (hi[0] - lo[0]); // meters per converter unit
// Positions stored as differences from the splat before (the converter samples one triangle
// after another, so neighbors follow one another), so the file zips well.
const q16 = (i, k) => Math.round(((s.pos[i * 3 + k] - lo[k]) / (hi[k] - lo[k])) * 65535);
const pos = new Uint16Array(s.n * 3);
const nrm = new Uint8Array(s.n * 3);
const rgb = new Uint8Array(s.n * 3);
const size = new Uint8Array(s.n);
const span = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]].map((v) => v * scale);
const prev = [0, 0, 0];
for (let o = 0; o < s.n; o++) {
  const i = o;
  for (let k = 0; k < 3; k++) {
    const v = q16(i, k);
    pos[o * 3 + k] = (v - prev[k]) & 0xffff;
    prev[k] = v;
    nrm[o * 3 + k] = Math.round(Math.max(-1, Math.min(1, s.nrm[i * 3 + k])) * 127) & 0xff;
    rgb[o * 3 + k] = Math.round(Math.max(0, Math.min(1, s.rgb[i * 3 + k])) * 255);
  }
  // Sizes from 2 cm to 5 m, on a log scale.
  const m = Math.max(0.02, Math.min(5, s.sigma[i] * scale));
  size[o] = Math.round((Math.log(m / 0.02) / Math.log(250)) * 255);
}
// Each array stored a byte plane at a time (all the first bytes, then all the second ...).
const planes = (bytes, k) => {
  const n = bytes.length / k;
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) out[j * n + i] = bytes[i * k + j];
  return out;
};
writeGeo(
  "assets/toys/living-city/city.bin.gz",
  {
    source: "City of Helsinki, Helsinki 3D reality mesh (2017), CC BY 4.0",
    crop: CROP,
    level: LEVEL,
    span: span.map((v) => +v.toFixed(2)), // meters: east-west, up, north-south
    count: s.n,
    delta: true, // positions: each the difference from the one before (Uint16, wrapping)
    planar: true, // each array a byte plane at a time
  },
  [
    { name: "pos", type: "u8", data: planes(new Uint8Array(pos.buffer), 6) },
    { name: "nrm", type: "u8", data: planes(nrm, 3) },
    { name: "rgb", type: "u8", data: planes(rgb, 3) },
    { name: "size", type: "u8", data: size },
  ],
);
console.log(`${s.n} splats; the block is ${span.map((v) => v.toFixed(0)).join(" x ")} m`);

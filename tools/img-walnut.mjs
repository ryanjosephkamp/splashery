#!/usr/bin/env node
// Lane Imaging: the walnut CT toy's volume, from a real cone-beam X-ray CT
// scan of a walnut (CWI, Der Sarkissian et al. 2019, Zenodo record 2686726,
// CC BY 4.0).
//
//   NODE_USE_ENV_PROXY=1 node tools/img-walnut.mjs [--walnut=1] [--factor=3]
//
// Walnut<n>.zip is about 6 GB (the X-ray projections and reconstructions), so
// the tool reads only what it needs with HTTP range requests: the zip's
// directory, then every second slice of its high-quality reconstruction
// (full_AGD_50_*.tiff: 501 slices of 501 x 501 float32 voxels, 100 µm),
// cached in .cache/img-walnut/. It averages blocks of factor^3 voxels (every
// second slice stands for two), crops to the walnut and writes
// assets/toys/walnut-ct/walnut.vol.gz:
//
//   "WCT1", then uint16 nx, ny, nz, then float32 voxel size (mm), then
//   nx * ny * nz uint8 densities (x fastest, then y, then z; 255 is an
//   attenuation of 0.07 per voxel unit, the walnut shell's densest).
//
// An empty slice (a failed read) is filled from its neighbors.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const arg = (name, def) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const walnut = Number(arg("walnut", 1));
const factor = Number(arg("factor", 3));
const URL0 = `https://zenodo.org/records/2686726/files/Walnut${walnut}.zip?download=1`;
const cache = path.resolve(`.cache/img-walnut/walnut${walnut}`);
const out = path.resolve("assets/toys/walnut-ct/walnut.vol.gz");
const N = 501;
const MAXV = 0.07;
// Zenodo turns away requests without a user agent of their own.
const UA = { "User-Agent": "splashery-build-tool (tools/img-walnut.mjs)" };

async function range(url, from, to) {
  for (let k = 0; ; k++) {
    try {
      const r = await fetch(url, { headers: { ...UA, Range: `bytes=${from}-${to}` } });
      if (r.status !== 206) throw new Error(`HTTP ${r.status}`);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      if (k >= 6) throw e;
      await new Promise((ok) => setTimeout(ok, 1000 * 2 ** k));
    }
  }
}

async function size(url) {
  const r = await fetch(url, { method: "HEAD", headers: UA });
  return Number(r.headers.get("content-length"));
}

// The zip's central directory (zip64), as { name, offset, csize, method }.
async function directory(url) {
  const total = await size(url);
  const tail = await range(url, total - 65536, total - 1);
  const eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const loc = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x06, 0x07]));
  if (eocd < 0 || loc < 0) throw new Error("Not a zip64 file.");
  const z64 = Number(tail.readBigUInt64LE(loc + 8));
  const rec = await range(url, z64, z64 + 55);
  const cdSize = Number(rec.readBigUInt64LE(40));
  const cdOff = Number(rec.readBigUInt64LE(48));
  const cd = await range(url, cdOff, cdOff + cdSize - 1);
  const list = [];
  for (let o = 0; o + 46 <= cd.length && cd.readUInt32LE(o) === 0x02014b50; ) {
    const method = cd.readUInt16LE(o + 10);
    let csize = cd.readUInt32LE(o + 20);
    let usize = cd.readUInt32LE(o + 24);
    const nl = cd.readUInt16LE(o + 28);
    const xl = cd.readUInt16LE(o + 30);
    const cl = cd.readUInt16LE(o + 32);
    let offset = cd.readUInt32LE(o + 42);
    const name = cd.toString("utf8", o + 46, o + 46 + nl);
    // The zip64 extra field holds the sizes and offset that overflowed.
    let x = o + 46 + nl;
    const xe = x + xl;
    while (x + 4 <= xe) {
      const id = cd.readUInt16LE(x);
      const len = cd.readUInt16LE(x + 2);
      if (id === 1) {
        let q = x + 4;
        if (usize === 0xffffffff) ((usize = Number(cd.readBigUInt64LE(q))), (q += 8));
        if (csize === 0xffffffff) ((csize = Number(cd.readBigUInt64LE(q))), (q += 8));
        if (offset === 0xffffffff) offset = Number(cd.readBigUInt64LE(q));
      }
      x += 4 + len;
    }
    list.push({ name, offset, csize, method });
    o = xe + cl;
  }
  return list;
}

async function entry(url, e) {
  const head = await range(url, e.offset, e.offset + 29);
  const start = e.offset + 30 + head.readUInt16LE(26) + head.readUInt16LE(28);
  const data = await range(url, start, start + e.csize - 1);
  return e.method === 8 ? zlib.inflateRawSync(data) : data;
}

// A float32 TIFF slice (one strip, uncompressed).
function readTiff(b) {
  const ifd = b.readUInt32LE(4);
  const n = b.readUInt16LE(ifd);
  let strip = 0;
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12;
    if (b.readUInt16LE(e) === 273) strip = b.readUInt32LE(e + 8);
  }
  return new Float32Array(b.buffer.slice(b.byteOffset + strip, b.byteOffset + strip + N * N * 4));
}

fs.mkdirSync(cache, { recursive: true });
const want = [];
for (let z = 0; z < N; z += 2) want.push(z);
const missing = want.filter((z) => !fs.existsSync(`${cache}/${String(z).padStart(3, "0")}.tiff`));
if (missing.length) {
  console.log(`Reading the directory of Walnut${walnut}.zip…`);
  const dir = await directory(URL0);
  for (const z of missing) {
    const name = `Walnut${walnut}/Reconstructions/full_AGD_50_${String(z).padStart(6, "0")}.tiff`;
    const e = dir.find((d) => d.name === name);
    if (!e) throw new Error(`${name} is not in the zip.`);
    fs.writeFileSync(`${cache}/${String(z).padStart(3, "0")}.tiff`, await entry(URL0, e));
    process.stdout.write(`\r${want.length - missing.length + missing.indexOf(z) + 1} / ${want.length} slices`); // prettier-ignore
  }
  console.log();
}
const slices = want.map((z) => readTiff(fs.readFileSync(`${cache}/${String(z).padStart(3, "0")}.tiff`))); // prettier-ignore
// Fill empty slices from their neighbors.
const sum = (a) => a.reduce((s, v) => s + v, 0);
for (let i = 0; i < slices.length; i++) {
  if (sum(slices[i]) > 1) continue;
  const a = slices[Math.max(0, i - 1)];
  const b = slices[Math.min(slices.length - 1, i + 1)];
  slices[i] = a.map((v, k) => (v + b[k]) / 2);
  console.log(`Slice ${want[i]} was empty; filled from its neighbors.`);
}

// Block averages.
const G = Math.floor(N / factor);
const grid = new Uint8Array(G * G * G);
for (let z = 0; z < G; z++)
  for (let y = 0; y < G; y++)
    for (let x = 0; x < G; x++) {
      let s = 0;
      let n = 0;
      for (let dz = 0; dz < factor; dz++) {
        const sl = slices[Math.min(slices.length - 1, Math.floor((z * factor + dz) / 2))];
        for (let dy = 0; dy < factor; dy++)
          for (let dx = 0; dx < factor; dx++) {
            s += sl[(y * factor + dy) * N + x * factor + dx];
            n++;
          }
      }
      grid[(z * G + y) * G + x] = Math.round(Math.min(1, Math.max(0, s / n / MAXV)) * 255);
    }
// Crop to the walnut (anything above the air's noise), with a voxel of margin.
const air = Math.round((0.015 / MAXV) * 255);
const lo = [G, G, G];
const hi = [0, 0, 0];
for (let z = 0; z < G; z++)
  for (let y = 0; y < G; y++)
    for (let x = 0; x < G; x++)
      if (grid[(z * G + y) * G + x] > air)
        [x, y, z].forEach((q, i) => ((lo[i] = Math.min(lo[i], q)), (hi[i] = Math.max(hi[i], q))));
for (let i = 0; i < 3; i++)
  ((lo[i] = Math.max(0, lo[i] - 1)), (hi[i] = Math.min(G - 1, hi[i] + 1)));
// The air's noise is set to 0 (it would only cost bytes).
for (let i = 0; i < grid.length; i++) if (grid[i] <= air) grid[i] = 0;
const [nx, ny, nz] = [0, 1, 2].map((i) => hi[i] - lo[i] + 1);
const body = new Uint8Array(nx * ny * nz);
for (let z = 0; z < nz; z++)
  for (let y = 0; y < ny; y++)
    for (let x = 0; x < nx; x++)
      body[(z * ny + y) * nx + x] = grid[((z + lo[2]) * G + y + lo[1]) * G + x + lo[0]];
const head = Buffer.alloc(14);
head.write("WCT1", 0, "latin1");
head.writeUInt16LE(nx, 4);
head.writeUInt16LE(ny, 6);
head.writeUInt16LE(nz, 8);
head.writeFloatLE(0.1 * factor, 10);
fs.mkdirSync(path.dirname(out), { recursive: true });
const gz = zlib.gzipSync(Buffer.concat([head, body]), { level: 9 });
fs.writeFileSync(out, gz);
console.log(`${nx} x ${ny} x ${nz} voxels of ${(0.1 * factor).toFixed(1)} mm -> ${out} (${(gz.length / 1024).toFixed(0)} KB)`); // prettier-ignore

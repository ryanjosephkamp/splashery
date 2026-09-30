#!/usr/bin/env node
// Lane Science's samples: the super-resolution microscope's sample is a
// square cut from a ShareLoc.XYZ record (CC BY 4.0), written as a .smlm file
// of the same format (a zip with manifest.json and one binary table per
// channel).
//
//   curl -L -o .cache/sci/data.smlm https://zenodo.org/api/records/5507427/files/sample-1/data.smlm/content
//   node tools/sci-samples.mjs microscope [--in=.cache/sci/data.smlm] [--x=8000] [--y=12000] [--size=12000]
//
// Writes assets/toys/smlm-microscope/cos7-mt-clathrin.smlm: every
// localization in the square [x, x + size) × [y, y + size) (nanometers),
// shifted to start at 0, in the record's own columns.

import fs from "node:fs";
import path from "node:path";
import { zipEntries, unzipEntry, deflateRaw } from "../src/science/smlm.js";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const what = args.find((a) => !a.startsWith("--"));
if (what !== "microscope") throw new Error("Usage: node tools/sci-samples.mjs microscope [...]");

// CRC-32 for the zip entries.
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(b) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// A zip of deflated entries: [{ name, data }].
async function writeZip(files) {
  const parts = [];
  const dir = [];
  let off = 0;
  for (const f of files) {
    const name = Buffer.from(f.name);
    const comp = await deflateRaw(f.data);
    const crc = crc32(f.data);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(0, 6);
    head.writeUInt16LE(8, 8);
    head.writeUInt32LE(0, 10); // time and date: 0 keeps the file the same on every run
    head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(comp.length, 18);
    head.writeUInt32LE(f.data.length, 22);
    head.writeUInt16LE(name.length, 26);
    head.writeUInt16LE(0, 28);
    parts.push(head, name, Buffer.from(comp));
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0, 8);
    c.writeUInt16LE(8, 10);
    c.writeUInt32LE(0, 12);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(comp.length, 20);
    c.writeUInt32LE(f.data.length, 24);
    c.writeUInt16LE(name.length, 28);
    c.writeUInt32LE(off, 42);
    dir.push(c, name);
    off += 30 + name.length + comp.length;
  }
  const dirBuf = Buffer.concat(dir);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(dirBuf.length, 12);
  end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, dirBuf, end]);
}

const inPath = opt("in", ".cache/sci/data.smlm");
const x0 = Number(opt("x", 8000));
const y0 = Number(opt("y", 12000));
const size = Number(opt("size", 12000));
const bytes = new Uint8Array(fs.readFileSync(inPath));
const entries = zipEntries(bytes);
const manifest = JSON.parse(
  new TextDecoder().decode(
    await unzipEntry(
      bytes,
      entries.find((e) => e.name === "manifest.json"),
    ),
  ),
);
const out = [];
let total = 0;
for (const f of manifest.files) {
  const fmt = manifest.formats[f.format];
  const cols = fmt.headers.length;
  if (fmt.dtype.some((d) => d !== "float32")) throw new Error("Expected float32 columns.");
  const ix = fmt.headers.indexOf("x");
  const iy = fmt.headers.indexOf("y");
  const data = await unzipEntry(
    bytes,
    entries.find((e) => e.name === f.name),
  );
  const src = new Float32Array(data.buffer, data.byteOffset, data.length / 4);
  const keep = [];
  for (let r = 0; r < src.length / cols; r++) {
    const x = src[r * cols + ix];
    const y = src[r * cols + iy];
    if (x >= x0 && x < x0 + size && y >= y0 && y < y0 + size) keep.push(r);
  }
  const dst = new Float32Array(keep.length * cols);
  const min = {};
  const max = {};
  keep.forEach((r, j) => {
    for (let c = 0; c < cols; c++) {
      let v = src[r * cols + c];
      if (c === ix) v -= x0;
      if (c === iy) v -= y0;
      dst[j * cols + c] = v;
      const h = fmt.headers[c];
      min[h] = Math.min(min[h] ?? Infinity, v);
      max[h] = Math.max(max[h] ?? -Infinity, v);
    }
  });
  Object.assign(f, { rows: keep.length, min, max, avg: undefined, hash: undefined });
  out.push({ name: f.name, data: new Uint8Array(dst.buffer) });
  total += keep.length;
  console.log(`${f.name}: ${keep.length} of ${src.length / cols} localizations`);
}
manifest.name = "cos7-mt-clathrin.smlm";
manifest.description =
  `A ${size / 1000} µm square (x ${x0}–${x0 + size} nm, y ${y0}–${y0 + size} nm, moved to start at 0) ` +
  "cut from ShareLoc.XYZ record 10.5281/zenodo.5507427, 'Microtubules and clathrin in a Cos cell' " +
  "by Christophe Leterrier (CC BY 4.0). Channel 1: clathrin; channel 2: microtubules.";
manifest.license = "CC BY 4.0";
manifest.hash = undefined;
manifest.files[0].channel = "clathrin";
manifest.files[1].channel = "microtubules";
const zip = await writeZip([
  { name: "manifest.json", data: new TextEncoder().encode(JSON.stringify(manifest, null, 1)) },
  ...out,
]);
const dest = "assets/toys/smlm-microscope/cos7-mt-clathrin.smlm";
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, zip);
console.log(`${dest}: ${total} localizations, ${(zip.length / 1e6).toFixed(2)} MB`);

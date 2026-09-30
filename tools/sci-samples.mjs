#!/usr/bin/env node
// Lane Science's samples: the super-resolution microscope's samples are cut
// from ShareLoc.XYZ records (CC BY 4.0), each written as a .smlm file of the
// same format (a zip with manifest.json and one binary table per channel).
//
//   node tools/sci-samples.mjs microscope|nucleus [--in=record.smlm]
//
// Each preset (PRESETS below) names its record's download (the tool says the
// curl line when the file is missing), the part kept (a square, moved to
// start at 0, or a random share) and the columns kept.

import fs from "node:fs";
import path from "node:path";
import { zipEntries, unzipEntry, deflateRaw } from "../src/science/smlm.js";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};

// The samples, each cut from a ShareLoc.XYZ record (all CC BY 4.0): the
// record's .smlm, a square to keep (nanometers, moved to start at 0) or all
// of it, a random share to keep (the same on every run), the columns to keep,
// and each table's channel name.
const PRESETS = {
  microscope: {
    in: ".cache/sci/data.smlm",
    url: "https://zenodo.org/api/records/5507427/files/sample-1/data.smlm/content",
    crop: [8000, 12000, 12000],
    out: "assets/toys/smlm-microscope/cos7-mt-clathrin.smlm",
    channels: ["clathrin", "microtubules"],
    record:
      "10.5281/zenodo.5507427, 'Microtubules and clathrin in a Cos cell' by Christophe Leterrier",
    note: "Channel 1: clathrin; channel 2: microtubules.",
  },
  nucleus: {
    in: ".cache/sci/nucleus.smlm",
    url: "https://zenodo.org/api/records/7233696/files/sample-1/data.smlm/content",
    keep: 0.5,
    columns: ["frame", "x", "y", "z", "crlbX", "crlbY", "crlbZ"],
    out: "assets/toys/smlm-microscope/nucleus-nup.smlm",
    channels: ["nuclear pores"],
    record:
      "10.5281/zenodo.7233696, 'Zola-3D NUP full nucleus' by Andrey Aristov (uploaded by Benoit Lelandais)",
    note: "Precisions are the Cramér–Rao lower bounds (crlbX, crlbY, crlbZ).",
  },
};
const what = args.find((a) => !a.startsWith("--"));
const P = PRESETS[what];
if (!P) throw new Error(`Usage: node tools/sci-samples.mjs ${Object.keys(PRESETS).join("|")} [--in=file.smlm]`); // prettier-ignore

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

const inPath = opt("in", P.in);
if (!fs.existsSync(inPath)) throw new Error(`Download it first: curl -L -o ${inPath} ${P.url}`);
const [x0, y0, size] = P.crop ?? [0, 0, Infinity];
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
let seed = 7;
const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
const out = [];
let total = 0;
manifest.files.forEach((f, fi) => {
  f.channel = P.channels[fi] ?? f.channel;
});
for (const f of manifest.files) {
  const fmt = manifest.formats[f.format];
  const cols = fmt.headers.length;
  if (fmt.dtype.some((d) => d !== "float32")) throw new Error("Expected float32 columns.");
  const ix = fmt.headers.indexOf("x");
  const iy = fmt.headers.indexOf("y");
  const pickCols = (P.columns ?? fmt.headers).map((h) => fmt.headers.indexOf(h));
  if (pickCols.some((c) => c < 0)) throw new Error(`Missing a column of ${P.columns}`);
  const data = await unzipEntry(
    bytes,
    entries.find((e) => e.name === f.name),
  );
  const src = new Float32Array(data.buffer, data.byteOffset, data.length / 4);
  const keep = [];
  for (let r = 0; r < src.length / cols; r++) {
    const x = src[r * cols + ix];
    const y = src[r * cols + iy];
    if (!(x >= x0 && x < x0 + size && y >= y0 && y < y0 + size)) continue;
    if (P.keep && rnd() >= P.keep) continue;
    keep.push(r);
  }
  const nc = pickCols.length;
  const dst = new Float32Array(keep.length * nc);
  const min = {};
  const max = {};
  keep.forEach((r, j) => {
    pickCols.forEach((c, k) => {
      let v = src[r * cols + c];
      if (P.crop && c === ix) v -= x0;
      if (P.crop && c === iy) v -= y0;
      dst[j * nc + k] = v;
      const h = fmt.headers[c];
      min[h] = Math.min(min[h] ?? Infinity, v);
      max[h] = Math.max(max[h] ?? -Infinity, v);
    });
  });
  fmt.headers = pickCols.map((c) => fmt.headers[c]);
  fmt.dtype = pickCols.map(() => "float32");
  fmt.shape = pickCols.map(() => 1);
  fmt.columns = nc;
  Object.assign(f, { rows: keep.length, min, max, avg: undefined, hash: undefined });
  out.push({ name: f.name, data: new Uint8Array(dst.buffer) });
  total += keep.length;
  console.log(`${f.name}: ${keep.length} of ${src.length / cols} localizations`);
}
const cut = P.crop
  ? `a ${size / 1000} µm square (x ${x0}–${x0 + size} nm, y ${y0}–${y0 + size} nm, moved to start at 0)`
  : `a random ${Math.round((P.keep ?? 1) * 100)}% of the localizations`;
manifest.name = path.basename(P.out);
manifest.description = `${cut[0].toUpperCase()}${cut.slice(1)} cut from ShareLoc.XYZ record ${P.record} (CC BY 4.0), by tools/sci-samples.mjs. ${P.note}`; // prettier-ignore
manifest.license = "CC BY 4.0";
manifest.hash = undefined;
const zip = await writeZip([
  { name: "manifest.json", data: new TextEncoder().encode(JSON.stringify(manifest, null, 1)) },
  ...out,
]);
fs.mkdirSync(path.dirname(P.out), { recursive: true });
fs.writeFileSync(P.out, zip);
console.log(`${P.out}: ${total} localizations, ${(zip.length / 1e6).toFixed(2)} MB`);

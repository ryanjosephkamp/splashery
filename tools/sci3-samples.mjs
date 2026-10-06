#!/usr/bin/env node
// Lane Science r3: more samples for the Super-resolution microscope, each cut
// from a ShareLoc.XYZ record on Zenodo (all CC BY 4.0, read on the live
// record) into the toy's .smlm format (a zip of manifest.json and one float32
// table).
//
//   node tools/sci3-samples.mjs [preset ...]    (all presets by default)
//
// The record's file is downloaded into .cache/sci3/ when missing. Records
// whose table has no localization precision get one estimated from the data
// by NeNA (Endesfelder et al., Histochem. Cell Biol. 141, 629–638, 2014): a
// molecule that blinks in consecutive frames is localized twice, and the
// distances between nearest neighbors in frames f and f + 1 follow
// p(d) = d/(2σ²)·exp(−d²/(4σ²)) (two positions, each with spread σ), plus a
// background of unrelated neighbors that grows with d; the fitted σ is the
// dataset's precision, given to every localization of it (the table says
// so). A 3D record's axial precision comes from the same pairs: the spread
// of their depth differences over √2.

import fs from "node:fs";
import path from "node:path";
import { readSmlm, deflateRaw } from "../src/science/smlm.js";

const CACHE = ".cache/sci3";
const OUT = "assets/toys/smlm-microscope";

// crop: [x0, y0, size] in nm (moved to start at 0); keep: a random share;
// cap: the most localizations kept (an even share of the rest). (Record
// 5507158, 3D clathrin by DAISY, was tried and left out: its table has no
// precision and no frame numbers, so NeNA can't estimate one.)
export const PRESETS = {
  pores: {
    record: 7182237,
    file: "06_wga_ATTO520/data.smlm",
    crop: [6000, 4000, 8000],
    out: "pores-wga.smlm",
    channel: "nuclear pores (WGA)",
  },
  actin: {
    record: 5510661,
    file: "cos7_phalloidin-647_1-2/data.smlm",
    crop: [19000, 1000, 10000],
    cap: 220000,
    out: "actin-cos7.smlm",
    channel: "actin (phalloidin)",
  },
  mitochondria: {
    record: 5512636,
    file: "s1-c1-fixed-TOM22-642-30ms_1_MMStack_Pos0/data.smlm",
    crop: [5000, 15000, 15000],
    cap: 220000,
    out: "mitochondria-tom22.smlm",
    channel: "mitochondria (TOM22)",
  },
  microtubules3d: {
    record: 6861446,
    file: "sample-1/data.smlm",
    crop: [10000, 10000, 12000],
    cap: 160000,
    out: "microtubules-zola-3d.smlm",
    channel: "microtubules",
  },
};

// CRC-32 and a zip of deflated entries (as tools/sci-samples.mjs writes them).
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
    head.writeUInt16LE(8, 8);
    head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(comp.length, 18);
    head.writeUInt32LE(f.data.length, 22);
    head.writeUInt16LE(name.length, 26);
    parts.push(head, name, Buffer.from(comp));
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(8, 10);
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

// NeNA: the precision σ (nm) from the nearest neighbors in consecutive
// frames. Returns { sigma, pairs, dists, dz } (each pair's lateral distance
// and depth difference).
export function nena(T, { maxD = 150, idx = null } = {}) {
  const ids = idx ?? Array.from({ length: T.n }, (_, i) => i);
  const byFrame = new Map();
  for (const i of ids) {
    const f = T.frame[i];
    if (!Number.isFinite(f)) continue;
    if (!byFrame.has(f)) byFrame.set(f, []);
    byFrame.get(f).push(i);
  }
  const cell = maxD;
  const dists = [];
  const dz = [];
  for (const [f, list] of byFrame) {
    const next = byFrame.get(f + 1);
    if (!next) continue;
    const grid = new Map();
    for (const j of next) {
      const k = `${Math.floor(T.x[j] / cell)},${Math.floor(T.y[j] / cell)}`;
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(j);
    }
    for (const i of list) {
      const cx = Math.floor(T.x[i] / cell);
      const cy = Math.floor(T.y[i] / cell);
      let best = maxD * maxD;
      let bj = -1;
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (const j of grid.get(`${cx + dx},${cy + dy}`) ?? []) {
            const d2 = (T.x[i] - T.x[j]) ** 2 + (T.y[i] - T.y[j]) ** 2;
            if (d2 < best) [best, bj] = [d2, j];
          }
      if (bj < 0) continue;
      dists.push(Math.sqrt(best));
      if (T.has3D) dz.push(T.z[i] - T.z[bj]);
    }
  }
  // Fit the histogram (1 nm bins) with A·p(d; σ) + B·d by least squares,
  // σ on a fine grid (A and B solved for each σ).
  const bins = new Float64Array(maxD);
  for (const d of dists) if (d < maxD) bins[Math.floor(d)]++;
  let best = { err: Infinity, sigma: NaN };
  for (let s = 1; s <= 40; s += 0.05) {
    const p = Array.from(bins, (_, b) => {
      const d = b + 0.5;
      return (d / (2 * s * s)) * Math.exp((-d * d) / (4 * s * s));
    });
    const q = Array.from(bins, (_, b) => b + 0.5);
    // Normal equations for [A, B].
    let pp = 0;
    let pq = 0;
    let qq = 0;
    let py = 0;
    let qy = 0;
    for (let b = 0; b < maxD; b++) {
      pp += p[b] * p[b];
      pq += p[b] * q[b];
      qq += q[b] * q[b];
      py += p[b] * bins[b];
      qy += q[b] * bins[b];
    }
    const det = pp * qq - pq * pq;
    const A = (py * qq - qy * pq) / det;
    const B = Math.max(0, (qy * pp - py * pq) / det);
    let err = 0;
    for (let b = 0; b < maxD; b++) err += (bins[b] - A * p[b] - B * q[b]) ** 2;
    if (A > 0 && err < best.err) best = { err, sigma: s };
  }
  return { sigma: best.sigma, pairs: dists.length, dists, dz };
}

// The spread of the pairs' depth differences that belong to the same
// molecule (lateral distance under 2σ): a robust σ (the median absolute
// deviation), over √2 for the two positions.
function axial(sigma, dists, dz) {
  const v = dz
    .filter((_, k) => dists[k] < 2 * sigma)
    .map(Math.abs)
    .sort((a, b) => a - b);
  if (v.length < 50) return NaN;
  return (1.4826 * v[v.length >> 1]) / Math.SQRT2;
}

const HEADERS = { "User-Agent": "splashery-tools", Accept: "application/json" };

// Zenodo's API sometimes answers with an error page: try again.
async function getJson(url) {
  for (let i = 0; i < 6; i++) {
    try {
      // (Zenodo refuses requests without a user agent or an Accept header.)
      const r = await fetch(url, { headers: HEADERS });
      if (r.ok) return await r.json();
    } catch {
      // retried below
    }
    await new Promise((res) => setTimeout(res, 3000 * (i + 1)));
  }
  throw new Error(`Could not fetch ${url}`);
}

async function cut(name) {
  const P = PRESETS[name];
  fs.mkdirSync(CACHE, { recursive: true });
  const src = path.join(CACHE, `${name}.smlm`);
  if (!fs.existsSync(src)) {
    const url = `https://zenodo.org/api/records/${P.record}/files/${P.file}/content`;
    const r = await fetch(url, { headers: HEADERS });
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    fs.writeFileSync(src, Buffer.from(await r.arrayBuffer()));
  }
  const rec = await getJson(`https://zenodo.org/api/records/${P.record}`);
  const license = rec.metadata.license?.id;
  if (license !== "cc-by-4.0") throw new Error(`${P.record} is ${license}, not CC BY 4.0`);
  const T = await readSmlm(new Uint8Array(fs.readFileSync(src)));
  const [x0, y0, size] = P.crop ?? [-Infinity, -Infinity, Infinity];
  let idx = [];
  for (let i = 0; i < T.n; i++) {
    const x = T.x[i];
    const y = T.y[i];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (!P.crop || (x >= x0 && x < x0 + size && y >= y0 && y < y0 + size)) idx.push(i);
  }
  // The precision first (NeNA needs every localization of the crop).
  const missing = T.notes.some((n) => n.includes("no localization precision"));
  let sxy = null;
  let sz = null;
  let how = "the record's own precision column";
  if (missing) {
    const N = nena(T, { idx });
    sxy = N.sigma;
    if (T.has3D) sz = axial(sxy, N.dists, N.dz);
    how = `NeNA, from ${N.pairs.toLocaleString("en")} pairs in consecutive frames: σ = ${sxy.toFixed(1)} nm${sz ? `, axial ${sz.toFixed(1)} nm` : ""}`; // prettier-ignore
  }
  if (P.cap && idx.length > P.cap) {
    // An even share (a fixed shuffle), the same on every run.
    let seed = 7;
    const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
    const keepP = P.cap / idx.length;
    idx = idx.filter(() => rnd() < keepP);
  }
  const has3D = T.has3D;
  const headers = ["frame", "x", "y", ...(has3D ? ["z"] : []), "uncertainty_xy", ...(has3D ? ["uncertainty_z"] : [])]; // prettier-ignore
  const nc = headers.length;
  const dst = new Float32Array(idx.length * nc);
  const min = {};
  const max = {};
  const ox = Number.isFinite(x0) ? x0 : 0;
  const oy = Number.isFinite(y0) ? y0 : 0;
  idx.forEach((i, r) => {
    const row = [
      T.frame[i],
      T.x[i] - ox,
      T.y[i] - oy,
      ...(has3D ? [T.z[i]] : []),
      sxy ?? T.sxy[i],
      ...(has3D ? [sz ?? T.sz[i]] : []),
    ];
    row.forEach((v, k) => {
      dst[r * nc + k] = v;
      min[headers[k]] = Math.min(min[headers[k]] ?? Infinity, v);
      max[headers[k]] = Math.max(max[headers[k]] ?? -Infinity, v);
    });
  });
  const creators = rec.metadata.creators.map((c) => c.name).join(", ");
  const part = P.crop
    ? `a ${size / 1000} µm square (x ${x0}–${x0 + size} nm, y ${y0}–${y0 + size} nm, moved to start at 0)`
    : "all of the localizations";
  const share = P.cap && idx.length < T.n ? `, ${idx.length.toLocaleString("en")} of them (an even share)` : ""; // prettier-ignore
  const manifest = {
    format_version: "0.2",
    name: P.out,
    description: `${part[0].toUpperCase()}${part.slice(1)}${share}, cut from ShareLoc.XYZ record 10.5281/zenodo.${P.record}, "${rec.metadata.title}" by ${creators} (CC BY 4.0), by tools/sci3-samples.mjs. Precision: ${how}.`,
    license: "CC BY 4.0",
    tags: ["shareloc.xyz", "splashery"],
    formats: {
      smlm_table: {
        type: "table",
        mode: "binary",
        dtype: headers.map(() => "float32"),
        shape: headers.map(() => 1),
        headers,
        units: [],
        columns: nc,
      },
    },
    files: [
      {
        name: "tabledata.bin",
        type: "table",
        format: "smlm_table",
        channel: P.channel,
        rows: idx.length,
        offset: { x: 0, y: 0 },
        min,
        max,
      },
    ],
  };
  const zip = await writeZip([
    { name: "manifest.json", data: new TextEncoder().encode(JSON.stringify(manifest, null, 1)) },
    { name: "tabledata.bin", data: new Uint8Array(dst.buffer) },
  ]);
  const out = path.join(OUT, P.out);
  fs.writeFileSync(out, zip);
  console.log(`${out}: ${idx.length} localizations, ${(zip.length / 1e6).toFixed(2)} MB; ${how}`);
  return {
    id: name,
    record: P.record,
    title: rec.metadata.title,
    creators,
    n: idx.length,
    how,
  };
}

if (process.argv[1]?.endsWith("sci3-samples.mjs")) {
  const want = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  for (const name of want.length ? want : Object.keys(PRESETS)) await cut(name);
}

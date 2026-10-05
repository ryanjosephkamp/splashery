#!/usr/bin/env node
// Lane Science r3: the Cryo-EM map toy's samples. Each is a density map from
// the Electron Microscopy Data Bank (EMDB: "free of all copyright
// restrictions and made fully and freely available for both non-commercial
// and commercial use") and the atomic model fitted into it from the Protein
// Data Bank (CC0).
//
//   node tools/sci3-cryoem.mjs [id ...]    (all samples by default)
//
// For each map the tool
//   - reads EMDB's entry (the recommended contour level, the authors, the
//     citation) from its API, and the map (.map.gz, MRC format) from its FTP
//     site into .cache/sci3/emdb/;
//   - crops the box to the density above the recommended level (with a
//     margin), and resamples it to at most 160 voxels along the
//     longest side (a Gaussian blur against aliasing, then the trilinear
//     value at each new voxel's center);
//   - stores the density as 8 bits (v = lo + (hi − lo)·b/255; lo and hi the
//     map's 0.01% and 99.99% points over the crop) with the recommended level,
//     gzipped: assets/toys/cryoem-map/<id>.vol.gz;
//   - reads the fitted model (mmCIF) and keeps each chain's backbone (Cα of
//     amino acids, P of nucleotides), copied by the biological assembly's
//     operators when the deposit holds one copy: <id>-model.bin.
// The coordinates are the map's own (Å, the model's frame).

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const CACHE = ".cache/sci3/emdb";
const OUT = "assets/toys/cryoem-map";
const MAX_N = 160;
const HEADERS = { "User-Agent": "splashery-tools", Accept: "*/*" };

export const MAPS = {
  // Maps whose own resolution is at least about twice the new voxel, so
  // the resampled map keeps its values and EMDB's level its meaning (an
  // atomic-resolution map, 1.2 Å, is sharper than any phone-sized grid).
  apoferritin: { emdb: 17961, pdb: "8PVC", maxN: 128 },
  ribosome: { emdb: 48329, pdb: "9MKK", maxN: 160 },
  aav: { emdb: 20610, pdb: "6U0V", maxN: 160 },
};

async function get(url, binary = false) {
  for (let i = 0; i < 6; i++) {
    try {
      const r = await fetch(url, { headers: HEADERS });
      if (r.ok) return binary ? Buffer.from(await r.arrayBuffer()) : await r.text();
    } catch {
      // retried below
    }
    await new Promise((res) => setTimeout(res, 3000 * (i + 1)));
  }
  throw new Error(`Could not fetch ${url}`);
}

// An MRC/CCP4 map: the grid, the voxel sizes and the position of voxel
// (0, 0, 0) in Å, with the data along x, y, z (x fastest).
export function readMrc(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const i32 = (w) => dv.getInt32(w * 4, true);
  const f32 = (w) => dv.getFloat32(w * 4, true);
  const n = [i32(0), i32(1), i32(2)];
  const mode = i32(3);
  if (mode !== 2) throw new Error(`MRC mode ${mode}: only float32 maps are read.`);
  const start = [i32(4), i32(5), i32(6)];
  const m = [i32(7), i32(8), i32(9)];
  const cell = [f32(10), f32(11), f32(12)];
  const axes = [i32(16), i32(17), i32(18)]; // which of x, y, z the columns, rows, sections run along
  const origin = [f32(49), f32(50), f32(51)];
  const ext = i32(23);
  const data = new Float32Array(buf.buffer.slice(buf.byteOffset + 1024 + ext, buf.byteOffset + 1024 + ext + n[0] * n[1] * n[2] * 4)); // prettier-ignore
  // Reorder to x, y, z.
  const nx = [0, 0, 0];
  const st = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    nx[axes[k] - 1] = n[k];
    st[axes[k] - 1] = start[k];
  }
  const voxel = [cell[0] / m[0], cell[1] / m[1], cell[2] / m[2]];
  let vol = data;
  if (axes.join() !== "1,2,3") {
    vol = new Float32Array(data.length);
    const idx = [0, 0, 0];
    let q = 0;
    for (idx[2] = 0; idx[2] < n[2]; idx[2]++)
      for (idx[1] = 0; idx[1] < n[1]; idx[1]++)
        for (idx[0] = 0; idx[0] < n[0]; idx[0]++, q++) {
          const p = [0, 0, 0];
          for (let k = 0; k < 3; k++) p[axes[k] - 1] = idx[k];
          vol[p[0] + nx[0] * (p[1] + nx[1] * p[2])] = data[q];
        }
  }
  // Voxel (0, 0, 0) sits at (start · voxel) + origin (the two conventions;
  // a map uses one of them).
  const at0 = [0, 1, 2].map((k) => st[k] * voxel[k] + origin[k]);
  return { n: nx, voxel, at0, vol };
}

function percentile(vol, ps) {
  const step = Math.max(1, Math.floor(vol.length / 2e6));
  const s = [];
  for (let i = 0; i < vol.length; i += step) s.push(vol[i]);
  s.sort((a, b) => a - b);
  return ps.map((p) => s[Math.min(s.length - 1, Math.floor(p * s.length))]);
}

// A copy of the map's box lo..hi (inclusive) blurred by a Gaussian of σ
// input voxels along x, y and z in turn.
function blurBox(M, lo, hi, sigma) {
  const [X, Y] = M.n;
  const n = [0, 1, 2].map((k) => hi[k] - lo[k] + 1);
  const out = new Float32Array(n[0] * n[1] * n[2]);
  for (let z = 0; z < n[2]; z++)
    for (let y = 0; y < n[1]; y++)
      for (let x = 0; x < n[0]; x++)
        out[x + n[0] * (y + n[1] * z)] = M.vol[x + lo[0] + X * (y + lo[1] + Y * (z + lo[2]))];
  if (sigma < 0.3) return out;
  const r = Math.ceil(3 * sigma);
  const w = Array.from({ length: 2 * r + 1 }, (_, i) =>
    Math.exp(-((i - r) ** 2) / (2 * sigma * sigma)),
  );
  const ws = w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) w[i] /= ws;
  const stride = [1, n[0], n[0] * n[1]];
  for (let axis = 0; axis < 3; axis++) {
    const len = n[axis];
    const line = new Float32Array(len);
    const others = [0, 1, 2].filter((k) => k !== axis);
    for (let a = 0; a < n[others[0]]; a++)
      for (let b = 0; b < n[others[1]]; b++) {
        const base = a * stride[others[0]] + b * stride[others[1]];
        for (let i = 0; i < len; i++) line[i] = out[base + i * stride[axis]];
        for (let i = 0; i < len; i++) {
          let s = 0;
          for (let k = -r; k <= r; k++) s += w[k + r] * line[Math.min(len - 1, Math.max(0, i + k))];
          out[base + i * stride[axis]] = s;
        }
      }
  }
  return out;
}

export function cropAndResample(M, level, maxN = MAX_N) {
  const [X, Y, Z] = M.n;
  // The box round the density: along each axis, the 0.05% and 99.95% points
  // of the voxels above the level (so stray noise near the box's edges
  // doesn't stretch it).
  const hist = [new Float64Array(X), new Float64Array(Y), new Float64Array(Z)];
  let total = 0;
  for (let z = 0; z < Z; z++)
    for (let y = 0; y < Y; y++)
      for (let x = 0; x < X; x++)
        if (M.vol[x + X * (y + Y * z)] > level) {
          hist[0][x]++;
          hist[1][y]++;
          hist[2][z]++;
          total++;
        }
  const lo = [0, 0, 0];
  const hi = [X - 1, Y - 1, Z - 1];
  for (let k = 0; k < 3; k++) {
    let acc = 0;
    let a = -1;
    for (let q = 0; q < hist[k].length; q++) {
      acc += hist[k][q];
      if (a < 0 && acc > 0.0005 * total) a = q;
      if (acc >= 0.9995 * total) {
        hi[k] = q;
        break;
      }
    }
    lo[k] = Math.max(0, a);
  }
  const margin = 8;
  for (let k = 0; k < 3; k++) {
    lo[k] = Math.max(0, lo[k] - margin);
    hi[k] = Math.min(M.n[k] - 1, hi[k] + margin);
  }
  const span = [0, 1, 2].map((k) => hi[k] - lo[k] + 1);
  const f = Math.max(1, Math.max(...span) / maxN); // input voxels per output voxel
  const out = span.map((s) => Math.max(2, Math.round(s / f)));
  const vol = new Float32Array(out[0] * out[1] * out[2]);
  // Anti-aliasing first: a Gaussian blur (σ = 0.42 of a new voxel, along
  // each axis in turn) over the crop, so the new grid doesn't fall between
  // atoms (a 1.2 Å map's atoms are sharper than its new voxels); then each
  // new voxel is the blurred map's trilinear value at its center.
  const src = blurBox(M, lo, hi, 0.42 * f);
  const [bx, by] = [hi[0] - lo[0] + 1, hi[1] - lo[1] + 1];
  const val = (x, y, z) => src[x - lo[0] + bx * (y - lo[1] + by * (z - lo[2]))];
  for (let z = 0; z < out[2]; z++) {
    const sz = Math.min(Z - 1.001, lo[2] + (z + 0.5) * f - 0.5);
    for (let y = 0; y < out[1]; y++) {
      const sy = Math.min(Y - 1.001, lo[1] + (y + 0.5) * f - 0.5);
      for (let x = 0; x < out[0]; x++) {
        const sx = Math.min(X - 1.001, lo[0] + (x + 0.5) * f - 0.5);
        const i0 = Math.floor(sx);
        const j0 = Math.floor(sy);
        const k0 = Math.floor(sz);
        const fx = sx - i0;
        const fy = sy - j0;
        const fz = sz - k0;
        const l = (a, b, t) => a + (b - a) * t;
        vol[x + out[0] * (y + out[1] * z)] = l(
          l(l(val(i0, j0, k0), val(i0 + 1, j0, k0), fx), l(val(i0, j0 + 1, k0), val(i0 + 1, j0 + 1, k0), fx), fy), // prettier-ignore
          l(l(val(i0, j0, k0 + 1), val(i0 + 1, j0, k0 + 1), fx), l(val(i0, j0 + 1, k0 + 1), val(i0 + 1, j0 + 1, k0 + 1), fx), fy), // prettier-ignore
          fz,
        );
      }
    }
  }
  const voxel = M.voxel.map((v) => v * f);
  // The new voxel (0, 0, 0)'s center: the middle of the first block.
  const at0 = [0, 1, 2].map((k) => M.at0[k] + (lo[k] + f / 2 - 0.5) * M.voxel[k]);
  return { n: out, voxel, at0, vol, factor: f };
}

// The fitted model's backbone: [{ chain, kind: "protein" | "nucleic", p: [[x, y, z], ...] }].
function readBackbone(cif) {
  const lines = cif.split("\n");
  let i = lines.findIndex((l) => l.startsWith("_atom_site."));
  const cols = [];
  while (lines[i]?.startsWith("_atom_site.")) cols.push(lines[i++].trim().slice(11));
  const c = (name) => cols.indexOf(name);
  const [cAtom, cX, cY, cZ, cChain, cModel, cAlt, cGroup] = ["label_atom_id", "Cartn_x", "Cartn_y", "Cartn_z", "label_asym_id", "pdbx_PDB_model_num", "label_alt_id", "group_PDB"].map(c); // prettier-ignore
  const chains = new Map();
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (!l.startsWith("ATOM") && !l.startsWith("HETATM")) {
      if (l.startsWith("#") || l.startsWith("loop_") || l.startsWith("_")) break;
      continue;
    }
    const t = l.trim().split(/\s+/);
    if (t[cGroup] !== "ATOM") continue;
    if (cModel >= 0 && t[cModel] !== "1") continue;
    if (cAlt >= 0 && t[cAlt] !== "." && t[cAlt] !== "A") continue;
    const atom = t[cAtom].replace(/"/g, "");
    if (atom !== "CA" && atom !== "P") continue;
    const ch = t[cChain];
    if (!chains.has(ch)) chains.set(ch, { chain: ch, kind: atom === "CA" ? "protein" : "nucleic", p: [] }); // prettier-ignore
    chains.get(ch).p.push([+t[cX], +t[cY], +t[cZ]]);
  }
  return [...chains.values()];
}

async function assembly(pdb, chains) {
  const d = JSON.parse(await get(`https://data.rcsb.org/rest/v1/core/assembly/${pdb}/1`));
  const ops = d.pdbx_struct_oper_list;
  const gen = d.pdbx_struct_assembly_gen[0];
  const expr = String(gen.oper_expression);
  // "1", "1,2,3", "(1-60)": the operators to apply.
  const ids = [];
  for (const part of expr.replace(/[()]/g, "").split(",")) {
    const [a, b] = part.split("-");
    if (b === undefined) ids.push(a);
    else for (let k = +a; k <= +b; k++) ids.push(String(k));
  }
  if (ids.length <= 1) return chains;
  const out = [];
  for (const id of ids) {
    const o = ops.find((x) => String(x.id) === id);
    const M = [1, 2, 3].map((r) => [1, 2, 3].map((q) => o[`matrix_${r}_${q}`]));
    const v = [o.vector_1, o.vector_2, o.vector_3];
    for (const ch of chains) {
      if (!gen.asym_id_list.includes(ch.chain)) continue;
      out.push({ chain: `${ch.chain}${id}`, kind: ch.kind, p: ch.p.map((p) => M.map((r, k) => r[0] * p[0] + r[1] * p[1] + r[2] * p[2] + v[k])) }); // prettier-ignore
    }
  }
  return out;
}

// <id>-model.bin: a JSON header (length-prefixed) and, per chain, its
// points as int16 (0.1 Å) after the header's origin.
function writeModel(chains, file) {
  const all = chains.flatMap((c) => c.p);
  const lo = [0, 1, 2].map((k) => Math.min(...all.map((p) => p[k])));
  const head = { format: "splashery-backbone-1", origin: lo.map((v) => +v.toFixed(2)), chains: chains.map((c) => ({ chain: c.chain, kind: c.kind, n: c.p.length })) }; // prettier-ignore
  const h = Buffer.from(JSON.stringify(head));
  const q = new Int16Array(all.length * 3);
  all.forEach((p, i) => p.forEach((v, k) => (q[i * 3 + k] = Math.round((v - lo[k]) * 10))));
  const body = Buffer.concat([Buffer.alloc(4), h, Buffer.from(q.buffer)]);
  body.writeUInt32LE(h.length, 0);
  fs.writeFileSync(file, zlib.gzipSync(body, { level: 9 }));
  return all.length;
}

async function build(id) {
  const S = MAPS[id];
  fs.mkdirSync(CACHE, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });
  const entry = JSON.parse(await get(`https://www.ebi.ac.uk/emdb/api/entry/EMD-${S.emdb}`));
  const contour = entry.map.contour_list.contour.find((c) => c.primary) ?? entry.map.contour_list.contour[0]; // prettier-ignore
  const level = Number(contour.level);
  const gz = path.join(CACHE, `emd_${S.emdb}.map.gz`);
  if (!fs.existsSync(gz)) fs.writeFileSync(gz, await get(`https://ftp.ebi.ac.uk/pub/databases/emdb/structures/EMD-${S.emdb}/map/emd_${S.emdb}.map.gz`, true)); // prettier-ignore
  const M = readMrc(zlib.gunzipSync(fs.readFileSync(gz)));
  const R = cropAndResample(M, level, S.maxN);
  const [lo, hi] = percentile(R.vol, [0.0001, 0.9999]);
  const bytes = new Uint8Array(R.vol.length);
  for (let i = 0; i < R.vol.length; i++) bytes[i] = Math.max(0, Math.min(255, Math.round(((R.vol[i] - lo) / (hi - lo)) * 255))); // prettier-ignore
  const ip = entry.structure_determination_list.structure_determination[0].image_processing[0];
  const res = Number(ip.final_reconstruction.resolution.valueOf_);
  const cite = entry.crossreferences?.citation_list?.primary_citation?.citation_type ?? {};
  const head = {
    format: "splashery-density-1",
    emdb: `EMD-${S.emdb}`,
    pdb: S.pdb,
    title: entry.admin.title,
    authors: entry.admin.authors_list.author.map((a) => a.valueOf_),
    citation: cite.published
      ? `${cite.journal} ${cite.volume}, ${cite.first_page} (${cite.year})`
      : "",
    resolution: res,
    n: R.n,
    voxel: R.voxel.map((v) => +v.toFixed(5)),
    sourceVoxel: M.voxel.map((v) => +v.toFixed(5)),
    at0: R.at0.map((v) => +v.toFixed(3)),
    lo,
    hi,
    level,
    levelSource: contour.source ?? "",
  };
  const h = Buffer.from(JSON.stringify(head));
  const body = Buffer.concat([Buffer.alloc(4), h, Buffer.from(bytes)]);
  body.writeUInt32LE(h.length, 0);
  const volFile = path.join(OUT, `${id}.vol.gz`);
  fs.writeFileSync(volFile, zlib.gzipSync(body, { level: 9 }));
  // The model.
  const cifGz = path.join(CACHE, `${S.pdb}.cif.gz`);
  if (!fs.existsSync(cifGz)) fs.writeFileSync(cifGz, await get(`https://files.rcsb.org/download/${S.pdb}.cif.gz`, true)); // prettier-ignore
  const chains = await assembly(S.pdb, readBackbone(zlib.gunzipSync(fs.readFileSync(cifGz)).toString("utf8"))); // prettier-ignore
  const nAt = writeModel(chains, path.join(OUT, `${id}-model.bin`));
  console.log(`${id}: EMD-${S.emdb} ${M.n.join("×")} at ${M.voxel[0].toFixed(3)} Å -> ${R.n.join("×")} at ${R.voxel[0].toFixed(3)} Å; level ${level} (${contour.source}); ${fs.statSync(volFile).size} bytes; model ${chains.length} chains, ${nAt} backbone atoms`); // prettier-ignore
  return head;
}

if (process.argv[1]?.endsWith("sci3-cryoem.mjs")) {
  const want = process.argv.slice(2);
  for (const id of want.length ? want : Object.keys(MAPS)) await build(id);
}

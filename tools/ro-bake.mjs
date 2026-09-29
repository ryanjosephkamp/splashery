#!/usr/bin/env node
// Lane Real objects: bakes a real 3D model (a CC0 or CC BY photo scan or realistic model) into the
// compact splat file a Real objects toy loads (assets/toys/<id>/<id>.splats). It is the same
// conversion as tools/model-to-splats.mjs and the "Model to splats" toy
// (src/packs/studio-models-core.js), plus what a toy with moving parts needs: every splat is
// given the part it moves with, cut from the model with hard edges (by the mesh's own separate
// pieces, its materials or a plane), and a maker's mark can be painted out.
//
//   node tools/ro-bake.mjs <toy id> [...]     (or --all)
//
// Sources are downloaded to .cache/ro/src/ (Objaverse's mirror of Sketchfab models on Hugging
// Face, or Poly Haven). HF_TOKEN is sent only to huggingface.co, when it is set, and never
// printed or written. Each toy's source, license and author are in SOURCES below and in
// tools/models.json.
//
// The file: "ROS1", then uint32 n, uint32 parts, float32 lo[3], hi[3], sLo, sHi, then per splat
// (in a shuffled order, so the first m splats are an even sample of the whole): uint16 x3
// position (in lo..hi), int8 x3 normal, uint8 size (log between sLo and sHi), uint8 x3 color
// (sRGB), uint8 part. Loaded by src/packs/real-objects.js.

import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";
import { pathToFileURL } from "node:url";
import { parseModel, prepareModel, sampleSurface, mulberry32 } from "../src/packs/studio-models-core.js"; // prettier-ignore
import { SOURCES } from "./ro-sources.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const cache = path.join(root, ".cache/ro/src");

function decodeImage(bytes, mime) {
  if (mime === "image/png" || (bytes[0] === 0x89 && bytes[1] === 0x50)) {
    const p = PNG.sync.read(Buffer.from(bytes));
    return { w: p.width, h: p.height, data: new Uint8Array(p.data) };
  }
  const j = jpeg.decode(Buffer.from(bytes), { useTArray: true, maxMemoryUsageInMB: 1024 });
  return { w: j.width, h: j.height, data: j.data };
}

// ---- Sources ----------------------------------------------------------------------------------

const OBJAVERSE = "https://huggingface.co/datasets/allenai/objaverse/resolve/main/";

async function fetchTo(url, file) {
  if (fs.existsSync(file)) return;
  const headers = {};
  if (url.startsWith("https://huggingface.co/") && process.env.HF_TOKEN)
    headers.Authorization = `Bearer ${process.env.HF_TOKEN}`;
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
}

// Returns { file, files } for parseModel.
async function loadSource(src) {
  const dir = path.join(cache, src.key);
  if (src.objaverse) {
    const file = path.join(dir, `${src.objaverse.split("/").pop()}`);
    await fetchTo(OBJAVERSE + src.objaverse, file);
    return { file, files: {} };
  }
  if (src.polyhaven) {
    const info = await (await fetch(`https://api.polyhaven.com/files/${src.polyhaven}`)).json();
    const g = info.gltf[src.res || "2k"].gltf;
    const file = path.join(dir, path.basename(g.url));
    await fetchTo(g.url, file);
    const files = {};
    for (const [rel, v] of Object.entries(g.include)) {
      const f = path.join(dir, rel);
      await fetchTo(v.url, f);
      files[path.basename(rel)] = new Uint8Array(fs.readFileSync(f));
    }
    return { file, files };
  }
  throw new Error("Unknown source");
}

// ---- Mesh helpers -----------------------------------------------------------------------------

// Connected pieces of a triangle mesh (vertices welded by position). Returns
// { of: Int32Array(triangle -> island), list: [{ id, tris, lo, hi, center, area }] }.
export function islands(pos, idx) {
  const nv = pos.length / 3;
  const nt = idx.length / 3;
  let lo = [Infinity, Infinity, Infinity];
  let hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < nv; i++)
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], pos[i * 3 + k]);
      hi[k] = Math.max(hi[k], pos[i * 3 + k]);
    }
  const q = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) * 1e-6 || 1e-9;
  const weld = new Int32Array(nv);
  const seen = new Map();
  for (let i = 0; i < nv; i++) {
    const key = `${Math.round(pos[i * 3] / q)},${Math.round(pos[i * 3 + 1] / q)},${Math.round(pos[i * 3 + 2] / q)}`; // prettier-ignore
    let w = seen.get(key);
    if (w === undefined) seen.set(key, (w = seen.size));
    weld[i] = w;
  }
  const par = new Int32Array(seen.size).map((_, i) => i);
  const find = (a) => {
    while (par[a] !== a) a = par[a] = par[par[a]];
    return a;
  };
  for (let t = 0; t < nt; t++) {
    const a = find(weld[idx[t * 3]]);
    const b = find(weld[idx[t * 3 + 1]]);
    const c = find(weld[idx[t * 3 + 2]]);
    par[b] = a;
    par[find(c)] = a;
  }
  const of = new Int32Array(nt);
  const ids = new Map();
  const list = [];
  for (let t = 0; t < nt; t++) {
    const r = find(weld[idx[t * 3]]);
    let id = ids.get(r);
    if (id === undefined) {
      ids.set(r, (id = list.length));
      list.push({ id, tris: [], lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity], area: 0 }); // prettier-ignore
    }
    of[t] = id;
    const I = list[id];
    I.tris.push(t);
    const p = [0, 1, 2].map((c) => idx[t * 3 + c] * 3);
    for (const v of p)
      for (let k = 0; k < 3; k++) {
        I.lo[k] = Math.min(I.lo[k], pos[v + k]);
        I.hi[k] = Math.max(I.hi[k], pos[v + k]);
      }
    const e1 = [0, 1, 2].map((k) => pos[p[1] + k] - pos[p[0] + k]);
    const e2 = [0, 1, 2].map((k) => pos[p[2] + k] - pos[p[0] + k]);
    I.area +=
      Math.hypot(
        e1[1] * e2[2] - e1[2] * e2[1],
        e1[2] * e2[0] - e1[0] * e2[2],
        e1[0] * e2[1] - e1[1] * e2[0],
      ) / 2;
  }
  for (const I of list) I.center = [0, 1, 2].map((k) => (I.lo[k] + I.hi[k]) / 2);
  return { of, list };
}

// Pieces connected through shared vertex indices (no weld): a mesh's texture charts.
export function chartsOf(pos, idx) {
  const nv = pos.length / 3;
  const nt = idx.length / 3;
  const par = new Int32Array(nv).map((_, i) => i);
  const find = (a) => {
    while (par[a] !== a) a = par[a] = par[par[a]];
    return a;
  };
  for (let t = 0; t < nt; t++) {
    const a = find(idx[t * 3]);
    par[find(idx[t * 3 + 1])] = a;
    par[find(idx[t * 3 + 2])] = a;
  }
  const of = new Int32Array(nt);
  const ids = new Map();
  const list = [];
  for (let t = 0; t < nt; t++) {
    const r = find(idx[t * 3]);
    let id = ids.get(r);
    if (id === undefined) {
      ids.set(r, (id = list.length));
      list.push({ id, n: 0, lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity] }); // prettier-ignore
    }
    of[t] = id;
    const C = list[id];
    C.n++;
    for (let c = 0; c < 3; c++)
      for (let k = 0; k < 3; k++) {
        const v = pos[idx[t * 3 + c] * 3 + k];
        C.lo[k] = Math.min(C.lo[k], v);
        C.hi[k] = Math.max(C.hi[k], v);
      }
  }
  for (const C of list) C.center = [0, 1, 2].map((k) => (C.lo[k] + C.hi[k]) / 2);
  return { of, list };
}

// Moves the vertices of some triangles by f([x, y, z]) -> [x, y, z] (each vertex once).
export function moveTris(raw, tris, f) {
  const done = new Set();
  for (const t of tris)
    for (let c = 0; c < 3; c++) {
      const v = raw.idx[t * 3 + c];
      if (done.has(v)) continue;
      done.add(v);
      const p = f([raw.pos[v * 3], raw.pos[v * 3 + 1], raw.pos[v * 3 + 2]]);
      raw.pos.set(p, v * 3);
      if (raw.nor && f.normal) raw.nor.set(f.normal([raw.nor[v * 3], raw.nor[v * 3 + 1], raw.nor[v * 3 + 2]]), v * 3); // prettier-ignore
    }
}

// Rotation helpers for re-posing a model before sampling.
export const rotX = (a) => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const f = ([x, y, z]) => [x, c * y - s * z, s * y + c * z];
  f.normal = f;
  return f;
};
export const rotY = (a) => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const f = ([x, y, z]) => [c * x + s * z, y, -s * x + c * z];
  f.normal = f;
  return f;
};
export const rotZ = (a) => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const f = ([x, y, z]) => [c * x - s * y, s * x + c * y, z];
  f.normal = f;
  return f;
};
export function transformAll(raw, f) {
  const nv = raw.pos.length / 3;
  for (let v = 0; v < nv; v++) {
    raw.pos.set(f([raw.pos[v * 3], raw.pos[v * 3 + 1], raw.pos[v * 3 + 2]]), v * 3);
    if (raw.nor && f.normal)
      raw.nor.set(f.normal([raw.nor[v * 3], raw.nor[v * 3 + 1], raw.nor[v * 3 + 2]]), v * 3);
  }
}
// Removes triangles (a piece left out: glass, a stand).
export function dropTris(raw, drop) {
  const keep = [];
  const mat = [];
  for (let t = 0; t < raw.idx.length / 3; t++) {
    if (drop(t)) continue;
    keep.push(raw.idx[t * 3], raw.idx[t * 3 + 1], raw.idx[t * 3 + 2]);
    mat.push(raw.mat[t]);
  }
  raw.idx = Uint32Array.from(keep);
  raw.mat = Uint16Array.from(mat);
}

// ---- Baking ------------------------------------------------------------------------------------

async function bake(id) {
  const cfg = SOURCES[id];
  if (!cfg) throw new Error(`No source for ${id}`);
  const t0 = Date.now();
  const { file, files } = await loadSource({ key: id, ...cfg.source });
  const raw = parseModel(new Uint8Array(fs.readFileSync(file)), path.basename(file), { files });
  const ctx = { raw, islands, moveTris, rotX, rotY, rotZ, transformAll, dropTris };
  if (cfg.pose) cfg.pose(ctx);
  const prep = await prepareModel(raw, { decodeImage });
  const isl = islands(prep.pos, prep.tri);
  // Charts: pieces connected through shared vertices without welding by position, so a garment's
  // panels (split at their seams in the file) come apart along the seams.
  const charts = cfg.charts ? chartsOf(prep.pos, prep.tri) : null;
  const s = sampleSurface(prep, cfg.count, { seed: 1, up: "y", light: true });
  // The same splats without the baked light: a painted color keeps the light (paint * lit / flat).
  const flat = sampleSurface(prep, cfg.count, { seed: 1, up: "y", light: false });
  const n = s.n;
  const part = new Uint8Array(n);
  const drop = new Uint8Array(n); // a part of -1 leaves the splat out (a piece hidden inside)
  const rgb = new Float32Array(s.rgb);
  const info = {
    i: 0,
    p: [0, 0, 0],
    nrm: [0, 0, 0],
    rgb: [0, 0, 0],
    tri: 0,
    mat: 0,
    matName: "",
    island: 0,
    bodyIsland: isl.list.reduce((a, b) => (b.area > a.area ? b : a)).id,
    isl,
    prep,
  };
  for (let i = 0; i < n; i++) {
    info.i = i;
    info.p = [s.pos[i * 3], s.pos[i * 3 + 1], s.pos[i * 3 + 2]];
    info.nrm = [s.nrm[i * 3], s.nrm[i * 3 + 1], s.nrm[i * 3 + 2]];
    info.rgb = [rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]];
    info.flat = [flat.rgb[i * 3], flat.rgb[i * 3 + 1], flat.rgb[i * 3 + 2]];
    const lf = (info.rgb[0] + info.rgb[1] + info.rgb[2]) / (info.flat[0] + info.flat[1] + info.flat[2] || 1); // prettier-ignore
    info.light = Number.isFinite(lf) && lf > 0 ? lf : 1;
    info.tri = s.triangle[i];
    info.mat = prep.mat[info.tri];
    info.matName = prep.materials[info.mat].name;
    info.island = isl.of[info.tri];
    if (charts) info.chart = charts.list[charts.of[info.tri]];
    const pi = cfg.part ? cfg.part(info) : 0;
    if (pi < 0) drop[i] = 1;
    part[i] = Math.max(0, pi);
    // A piece moved after it was cut (in the file's units, turned into baked units).
    if (cfg.place) {
      const d = cfg.place(info, part[i]);
      if (d) for (let k = 0; k < 3; k++) s.pos[i * 3 + k] += d[k] * s.scale;
    }
    if (cfg.paint) {
      const c = cfg.paint(info, part[i]);
      if (c) rgb.set(c, i * 3);
    }
  }
  // Small charts (fragments of a panel) take the part of the nearest splat on a big chart.
  if (charts && cfg.minChart) {
    const big = [];
    const small = [];
    for (let i = 0; i < n; i++) (charts.list[charts.of[s.triangle[i]]].n >= cfg.minChart ? big : small).push(i); // prettier-ignore
    const cell = 0.03;
    const grid = new Map();
    const key = (x, y, z) =>
      `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
    for (const i of big) {
      const k = key(s.pos[i * 3], s.pos[i * 3 + 1], s.pos[i * 3 + 2]);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(i);
    }
    for (const i of small) {
      const [x, y, z] = [s.pos[i * 3], s.pos[i * 3 + 1], s.pos[i * 3 + 2]];
      let best = -1;
      let bd = Infinity;
      for (let r = 1; r <= 4 && best < 0; r++)
        for (let dx = -r; dx <= r; dx++)
          for (let dy = -r; dy <= r; dy++)
            for (let dz = -r; dz <= r; dz++)
              for (const j of grid.get(key(x + dx * cell, y + dy * cell, z + dz * cell)) || []) {
                const d = (s.pos[j * 3] - x) ** 2 + (s.pos[j * 3 + 1] - y) ** 2 + (s.pos[j * 3 + 2] - z) ** 2; // prettier-ignore
                if (d < bd) [bd, best] = [d, j];
              }
      if (best >= 0 && part[i] < 4) part[i] = part[best];
    }
  }
  // A last word on each splat's part, from its place (fragments the rules above mislaid).
  if (cfg.finalPart)
    for (let i = 0; i < n; i++)
      part[i] = cfg.finalPart([s.pos[i * 3], s.pos[i * 3 + 1], s.pos[i * 3 + 2]], part[i]);
  // Shuffle, so any first m splats are an even sample.
  const rand = mulberry32(1234);
  const kept = [];
  for (let i = 0; i < n; i++) if (!drop[i]) kept.push(i);
  const order = Int32Array.from(kept);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  let sLo = Infinity;
  let sHi = -Infinity;
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], s.pos[i * 3 + k]);
      hi[k] = Math.max(hi[k], s.pos[i * 3 + k]);
    }
    sLo = Math.min(sLo, Math.log(s.sigma[i]));
    sHi = Math.max(sHi, Math.log(s.sigma[i]));
  }
  let nParts = 1;
  for (let i = 0; i < n; i++) nParts = Math.max(nParts, part[i] + 1);
  const head = 4 + 4 + 4 + 4 * 8;
  const buf = Buffer.alloc(head + order.length * 14);
  buf.write("ROS1", 0, "ascii");
  buf.writeUInt32LE(order.length, 4);
  buf.writeUInt32LE(nParts, 8);
  [...lo, ...hi, sLo, sHi].forEach((v, k) => buf.writeFloatLE(v, 12 + k * 4));
  let o = head;
  const q16 = (v, k) => Math.round(((v - lo[k]) / (hi[k] - lo[k] || 1)) * 65535);
  const q8 = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
  for (const i of order) {
    for (let k = 0; k < 3; k++) buf.writeUInt16LE(q16(s.pos[i * 3 + k], k), o + k * 2);
    for (let k = 0; k < 3; k++) buf.writeInt8(Math.round(s.nrm[i * 3 + k] * 127), o + 6 + k);
    buf.writeUInt8(Math.round(((Math.log(s.sigma[i]) - sLo) / (sHi - sLo || 1)) * 255), o + 9);
    for (let k = 0; k < 3; k++) buf.writeUInt8(q8(rgb[i * 3 + k]), o + 10 + k);
    buf.writeUInt8(part[i], o + 13);
    o += 14;
  }
  const out = path.join(root, "assets/toys", id, `${id}.splats`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buf);
  const counts = new Array(nParts).fill(0);
  for (const i of order) counts[part[i]]++;
  console.log(
    `${id}: ${prep.triangles} triangles, ${isl.list.length} pieces, ${n} splats, parts [${counts.join(", ")}], ${(buf.length / 1e6).toFixed(2)} MB, ${((Date.now() - t0) / 1000).toFixed(1)} s`, // prettier-ignore
  );
  if (cfg.report) cfg.report({ isl, prep, s, part });
}

export { loadSource };

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const ids = args.includes("--all") ? Object.keys(SOURCES) : args.filter((a) => !a.startsWith("--")); // prettier-ignore
  if (!ids.length) {
    console.error("Usage: node tools/ro-bake.mjs <toy id> [...] | --all");
    process.exit(1);
  }
  for (const id of ids) await bake(id);
}

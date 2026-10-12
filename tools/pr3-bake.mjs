#!/usr/bin/env node
// Lane Photoreal r3: bakes the new scientific toys' museum meshes (photogrammetry and laser scans,
// CC0, CC BY or CC BY-NC) into the compact splat file the Real objects toys use
// (assets/toys/<id>/<id>.splats; the format is at the top of tools/ro-bake.mjs), with the same
// conversion: flat splats on the model's surface, colored from its texture, each tagged with the
// piece it moves with, cut from the model with hard edges (its own separate pieces or files).
// Loaded by src/packs/photoreal-r3.js through Real objects' addScan.
//
//   node tools/pr3-bake.mjs <toy id> [...]     (or --all)
//
// Sources are downloaded to .cache/pr3/dl/ (Objaverse's mirror of Sketchfab models on Hugging
// Face, or the Natural History Museum Vienna's data repository) when they are not there yet.
// Each toy's source, license and author are in SOURCES below, tools/models.json and CREDITS.md;
// each license was read on the item's live page on October 8, 2026.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";
import { pathToFileURL } from "node:url";
import { parseModel, prepareModel, sampleSurface } from "../src/packs/studio-models-core.js";
import { islands } from "./ro-bake.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dl = path.join(root, ".cache/pr3/dl");
const OBJAVERSE = "https://huggingface.co/datasets/allenai/objaverse/resolve/main/";
const NHM = "https://datarepository.nhm-wien.ac.at/public/";
const OVER = 3; // sampled at OVER times the count, then thinned to an even set

const STANNERN = ["A21", "A135", "A136", "A139", "A140"];

export const SOURCES = {
  // A celestial globe in its horizon stand (Collegium Maius, Kraków). The ball is its own mesh,
  // so it turns cleanly in its rings. Parts: 0 the stand, rings and table; 1 the ball.
  "celestial-globe": {
    objaverse: "glbs/000-066/341fa8a777e94883841409438756f747.glb",
    count: 300000,
    part: (s) => (s.matName.startsWith("sphere") ? 1 : 0),
  },
  // An armillary sphere by Franciszek Słupski, 1771 (Collegium Maius). Its inner rings (the
  // ecliptic and tropics round the small Earth) are separate pieces inside the outer frame.
  // Parts: 0 the frame and stand; 1 the inner rings.
  "armillary-sphere": {
    objaverse: "glbs/000-127/41e23659c75241459eec6477d9e77c93.glb",
    count: 300000,
    drop: (s) => s.matName === "glass",
    part: (s) => {
      if (s.island === s.bodyIsland) return 0;
      const c = s.isl.list[s.island].center;
      return Math.hypot(c[0], c[1] - 0.375, c[2]) < 0.14 ? 1 : 0;
    },
  },
  // Five stones of the Stannern meteorite fall of May 22, 1808 (NHM Vienna), each from its own
  // scan, set side by side. Parts: 0 to 4, one per stone.
  "stannern-meteorites": {
    nhm: STANNERN.map((n) => `cuqmeh/NHMW-MIN-${n}-3D`),
    count: 300000,
  },
  // A fluorite specimen (Paleontological Research Institution teaching collection). One piece.
  "fluorite-crystal": { objaverse: "glbs/000-077/5ed87d4487be495aac0a86632eb3880c.glb", count: 260000 }, // prettier-ignore
  // An ammonite whose chambers filled with quartz and chalcedony, cut and polished (AGH Geological
  // Museum, Kraków). One piece.
  "ammonite-agate": { objaverse: "glbs/000-009/4a8582d264a9466f87dc68cea5c28838.glb", count: 260000 }, // prettier-ignore
  // The Morasko iron meteorite (Poland). One piece.
  "morasko-meteorite": { objaverse: "glbs/000-076/37fd0d100a3246f2892ece5f8d178c06.glb", count: 240000 }, // prettier-ignore
  // A pyrite specimen (Paleontological Research Institution). One piece (three specks dropped).
  "pyrite-cubes": {
    objaverse: "glbs/000-001/0b7c6e8e32144b72806ed31cb49b4145.glb",
    count: 260000,
    drop: (s) => s.island !== s.bodyIsland,
  },
  // A megalodon tooth (Paleontological Research Institution, PRI 55188). One piece.
  "megalodon-tooth": {
    objaverse: "glbs/000-092/06e0bef4795840b4b21d17e5f51f3140.glb",
    count: 260000,
    drop: (s) => s.island !== s.bodyIsland,
  },
};

function decodeImage(bytes, mime) {
  if (mime === "image/png" || (bytes[0] === 0x89 && bytes[1] === 0x50)) {
    const p = PNG.sync.read(Buffer.from(bytes));
    return { w: p.width, h: p.height, data: new Uint8Array(p.data) };
  }
  const j = jpeg.decode(Buffer.from(bytes), { useTArray: true, maxMemoryUsageInMB: 2048 });
  return { w: j.width, h: j.height, data: j.data };
}

function fetchTo(url, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  execFileSync("curl", ["-sSfL", "-o", file, url]);
}

// One model: { raw, files } from an Objaverse GLB or an NHM Vienna OBJ (with its MTL and PNG).
function loadModel(cfg) {
  if (cfg.objaverse) {
    const file = path.join(dl, "mesh", path.basename(cfg.objaverse));
    fetchTo(OBJAVERSE + cfg.objaverse, file);
    return [parseModel(new Uint8Array(fs.readFileSync(file)), path.basename(file), { files: {} })];
  }
  return cfg.nhm.map((rel) => {
    const dir = path.join(dl, "nhm", rel);
    if (!fs.existsSync(dir)) {
      const zip = `${dir}.zip`;
      fetchTo(`${NHM}${rel.split("/")[0]}/public/${path.basename(rel)}.zip`, zip);
      execFileSync("unzip", ["-q", "-o", zip, "-d", path.dirname(zip)]);
    }
    const files = {};
    for (const n of fs.readdirSync(dir))
      files[n] = new Uint8Array(fs.readFileSync(path.join(dir, n)));
    const obj = Object.keys(files).find((n) => n.toLowerCase().endsWith(".obj"));
    return parseModel(files[obj], obj, { files });
  });
}

// Several models as one: each moved so they lie side by side on a level line, its triangles
// tagged with its index (raw.piece).
function merge(raws) {
  if (raws.length === 1) return raws[0];
  const box = (r) => {
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < r.pos.length; i += 3)
      for (let k = 0; k < 3; k++) ((lo[k] = Math.min(lo[k], r.pos[i + k])), (hi[k] = Math.max(hi[k], r.pos[i + k]))); // prettier-ignore
    return { lo, hi };
  };
  const out = { ...raws[0], pos: [], uv: [], idx: [], mat: [], materials: [], images: [], nor: null, col: null, piece: [] }; // prettier-ignore
  let x = 0;
  const gap = 0.25;
  raws.forEach((r, n) => {
    const { lo, hi } = box(r);
    const size = Math.max(hi[0] - lo[0], hi[2] - lo[2]);
    const shift = [x - lo[0], -lo[1], -(lo[2] + hi[2]) / 2];
    x += hi[0] - lo[0] + gap * size;
    const v0 = out.pos.length / 3;
    for (let i = 0; i < r.pos.length; i += 3) out.pos.push(r.pos[i] + shift[0], r.pos[i + 1] + shift[1], r.pos[i + 2] + shift[2]); // prettier-ignore
    for (let i = 0; i < r.pos.length / 3; i++) out.uv.push(r.uv ? r.uv[i * 2] : 0, r.uv ? r.uv[i * 2 + 1] : 0); // prettier-ignore
    for (const v of r.idx) out.idx.push(v + v0);
    const m0 = out.materials.length;
    const i0 = out.images.length;
    for (const m of r.materials) out.materials.push(m.tex ? { ...m, tex: { ...m.tex, image: m.tex.image + i0 } } : m); // prettier-ignore
    out.images.push(...r.images);
    for (const m of r.mat) out.mat.push(m + m0);
    for (let t = 0; t < r.idx.length / 3; t++) out.piece.push(n);
  });
  out.pos = Float32Array.from(out.pos);
  out.uv = Float32Array.from(out.uv);
  out.idx = Uint32Array.from(out.idx);
  out.mat = Uint32Array.from(out.mat);
  return out;
}

// An even order (as tools/ro-bake.mjs): greedy farthest-point thinning on a grid, so the first m
// splats spread evenly over the surface.
function evenOrder(pos, list, keep) {
  const cell = 0.02;
  const grid = new Map();
  const key = (x, y, z) =>
    `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  const shuffled = list.slice();
  let h = 1;
  for (let i = shuffled.length - 1; i > 0; i--) {
    h = (h * 16807) % 2147483647;
    const j = h % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  // Poisson-disc style: keep a splat only if no kept splat lies within r; shrink r until enough.
  let r = Math.sqrt(4 / keep) * 0.9;
  let out = [];
  for (let pass = 0; pass < 8 && out.length < keep; pass++) {
    grid.clear();
    out = [];
    const r2 = r * r;
    const c = Math.max(cell, r);
    const k2 = (x, y, z) => `${Math.floor(x / c)},${Math.floor(y / c)},${Math.floor(z / c)}`;
    for (const i of shuffled) {
      const [x, y, z] = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
      let ok = true;
      for (let dx = -1; dx <= 1 && ok; dx++)
        for (let dy = -1; dy <= 1 && ok; dy++)
          for (let dz = -1; dz <= 1 && ok; dz++)
            for (const j of grid.get(k2(x + dx * c, y + dy * c, z + dz * c)) || []) {
              if ((pos[j * 3] - x) ** 2 + (pos[j * 3 + 1] - y) ** 2 + (pos[j * 3 + 2] - z) ** 2 < r2) { ok = false; break; } // prettier-ignore
            }
      if (!ok) continue;
      const kk = k2(x, y, z);
      if (!grid.has(kk)) grid.set(kk, []);
      grid.get(kk).push(i);
      out.push(i);
    }
    r *= 0.85;
  }
  void key;
  return out.slice(0, keep);
}

async function bake(id) {
  const cfg = SOURCES[id];
  if (!cfg) throw new Error(`No source for ${id}`);
  const t0 = Date.now();
  const raw = merge(loadModel(cfg));
  const prep = await prepareModel(raw, { decodeImage });
  const isl = islands(prep.pos, prep.tri);
  const s = sampleSurface(prep, cfg.count * OVER, { seed: 1, up: "y", light: true });
  const n = s.n;
  const part = new Uint8Array(n);
  const kept = [];
  const bodyIsland = isl.list.reduce((a, b) => (b.area > a.area ? b : a)).id;
  for (let i = 0; i < n; i++) {
    const tri = s.triangle[i];
    const info = {
      p: [s.pos[i * 3], s.pos[i * 3 + 1], s.pos[i * 3 + 2]],
      tri,
      matName: prep.materials[prep.mat[tri]].name,
      island: isl.of[tri],
      bodyIsland,
      isl,
    };
    if (cfg.drop?.(info)) continue;
    part[i] = raw.piece ? (raw.piece[tri] ?? 0) : cfg.part ? cfg.part(info) : 0;
    kept.push(i);
  }
  const order = evenOrder(s.pos, kept, Math.round(kept.length / OVER));
  for (const i of order) s.sigma[i] *= Math.sqrt(kept.length / order.length);
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  let sLo = Infinity;
  let sHi = -Infinity;
  for (const i of order) {
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], s.pos[i * 3 + k]);
      hi[k] = Math.max(hi[k], s.pos[i * 3 + k]);
    }
    sLo = Math.min(sLo, Math.log(s.sigma[i]));
    sHi = Math.max(sHi, Math.log(s.sigma[i]));
  }
  let nParts = 1;
  for (const i of order) nParts = Math.max(nParts, part[i] + 1);
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
    for (let k = 0; k < 3; k++) buf.writeUInt8(q8(s.rgb[i * 3 + k]), o + 10 + k);
    buf.writeUInt8(part[i], o + 13);
    o += 14;
  }
  const out = path.join(root, "assets/toys", id, `${id}.splats`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buf);
  const counts = new Array(nParts).fill(0);
  for (const i of order) counts[part[i]]++;
  console.log(`${id}: ${prep.triangles} triangles, ${order.length} splats, parts [${counts.join(", ")}], box ${lo.map((v) => v.toFixed(2))} .. ${hi.map((v) => v.toFixed(2))}, ${(buf.length / 1e6).toFixed(2)} MB, ${((Date.now() - t0) / 1000).toFixed(1)} s`); // prettier-ignore
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const ids = args.includes("--all") ? Object.keys(SOURCES) : args.filter((a) => !a.startsWith("--")); // prettier-ignore
  if (!ids.length) {
    console.error("Usage: node tools/pr3-bake.mjs <toy id> [...] | --all");
    process.exit(1);
  }
  for (const id of ids) await bake(id);
}

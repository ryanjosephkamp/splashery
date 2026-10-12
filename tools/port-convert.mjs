#!/usr/bin/env node
// Lane Baked engine (docs/handoff/BakedEngine.md): turns trained 3D Gaussian splats (a standard
// 3DGS binary PLY, plus an optional *.parts.json) into Splashery's baked format (src/baked.js:
// 18 bytes a splat, chunked) at each tier, and writes the asset's manifest.json. Node only, no
// dependencies.
//
//   node tools/port-convert.mjs <in.ply> [more.ply ...] --out <folder> [options]
//
//   --id <name>         the asset's id (default: the first PLY's name)
//   --parts <file>      the parts sidecar for the largest PLY (default: <ply>.parts.json beside
//                       each PLY, when there is one)
//   --tiers 40000,...   more tiers, each an even sample of the largest PLY (its splats grown to
//                       close the surface)
//   --default <n>       the tier a page loads when it gives no budget
//   --chunk <n>         splats per file (default 65536, about 1.2 MB)
//   --gzip              gzip each file (about 12% smaller; the page inflates it)
//   --up y|-y|z         which way is up in the PLY (default y, as the kit; -y for COLMAP's
//                       right-down-forward axes, z for Blender's)
//
// Each PLY given is one tier (a separately trained file keeps its own splats). The output:
// <folder>/manifest.json and <folder>/assets/<id>-<splats>-<k>.bkd. Credit and license fields
// are left for a person to fill in; a manifest already there keeps its credit, title and notes.
//
// It refuses a file that isn't a valid 3DGS PLY: binary little-endian, one vertex element with
// float x, y, z, f_dc_0..2, opacity, scale_0..2 and rot_0..3 (normals and f_rest_* are allowed
// and dropped), the right number of bytes, every value finite and every rotation nonzero.
//
// The parts sidecar (JSON): { sha256: the PLY's sha256 (also read as ply_sha256 or
// source_sha256), parts: [{ id (1..255), name, pivot?: [x, y, z], axis?: [x, y, z] }], and the
// splats' part ids as one of: ids (an array, one per splat), ids_b64 (base64 bytes), ids_file (a
// file of bytes beside it), or ranges ([[first, end, id], ...]; splats not in a range are the
// body) }. A PLY may carry the ids itself instead, as a vertex property part, part_id or segment.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { readPlyHeader, readPlyElements } from "../src/viewers/splat-io.js";
import { tableRange, encodeChunk, BYTES_PER_SPLAT } from "../src/baked.js";

const REQUIRED = ["x", "y", "z", "f_dc_0", "f_dc_1", "f_dc_2", "opacity", "scale_0", "scale_1", "scale_2", "rot_0", "rot_1", "rot_2", "rot_3"]; // prettier-ignore
const ALLOWED = /^(nx|ny|nz|f_rest_\d+|part|part_id|segment)$/;
const PART_PROPS = ["part", "part_id", "segment"];

export class Refused extends Error {}

const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

// A deterministic even order: a Fisher-Yates shuffle seeded by the source's hash.
function shuffled(n, hex) {
  let a = parseInt(hex.slice(0, 8), 16) >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const order = new Uint32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = order[i];
    order[i] = order[j];
    order[j] = t;
  }
  return order;
}

// Reads and checks a 3DGS PLY: { table (src/viewers/splat-io.js layout plus part), sha256 }.
export function readGaussianPly(bytes, name = "the PLY") {
  const header = readPlyHeader(bytes);
  if (!header) throw new Refused(`${name} is not a PLY file.`);
  if (header.format !== "binary_little_endian")
    throw new Refused(`${name} is ${header.format || "of no known format"}; a 3DGS PLY is binary_little_endian.`); // prettier-ignore
  const vs = header.elements.filter((e) => e.name === "vertex");
  if (vs.length !== 1 || header.elements.length !== 1)
    throw new Refused(`${name} must have one element, vertex (it has ${header.elements.map((e) => e.name).join(", ") || "none"}).`); // prettier-ignore
  const v = vs[0];
  if (!(v.count > 0)) throw new Refused(`${name} has no splats.`);
  const names = v.props.map((p) => p.name);
  const missing = REQUIRED.filter((r) => !names.includes(r));
  if (missing.length) throw new Refused(`${name} is not a 3DGS PLY: it has no ${missing.join(", ")}.`); // prettier-ignore
  for (const p of v.props) {
    if (p.list) throw new Refused(`${name} has a list property (${p.name}).`);
    if (REQUIRED.includes(p.name) && p.type !== "float" && p.type !== "float32")
      throw new Refused(`${name}: ${p.name} is ${p.type}, not float.`);
    if (!REQUIRED.includes(p.name) && !ALLOWED.test(p.name))
      throw new Refused(`${name} has an unknown property ${p.name}.`);
  }
  const stride = v.props.reduce((s, p) => s + ({ float: 4, float32: 4, double: 8, float64: 8, int: 4, int32: 4, uint: 4, uint32: 4, short: 2, int16: 2, ushort: 2, uint16: 2 }[p.type] ?? 1), 0); // prettier-ignore
  if (bytes.length !== header.offset + stride * v.count)
    throw new Refused(`${name} has ${bytes.length} bytes; its header says ${header.offset + stride * v.count}.`); // prettier-ignore
  const c = readPlyElements(bytes, header, { want: ["vertex"] }).vertex.cols;
  const n = v.count;
  for (const r of REQUIRED)
    for (let i = 0; i < n; i++)
      if (!Number.isFinite(c[r][i])) throw new Refused(`${name}: ${r} of splat ${i} is not a finite number.`); // prettier-ignore
  const t = {
    count: n,
    x: c.x, y: c.y, z: c.z, r: c.f_dc_0, g: c.f_dc_1, b: c.f_dc_2, opacity: c.opacity,
    s0: c.scale_0, s1: c.scale_1, s2: c.scale_2,
    qw: new Float32Array(n), qx: new Float32Array(n), qy: new Float32Array(n), qz: new Float32Array(n),
    part: null,
  }; // prettier-ignore
  for (let i = 0; i < n; i++) {
    const l = Math.hypot(c.rot_0[i], c.rot_1[i], c.rot_2[i], c.rot_3[i]);
    if (!(l > 1e-12)) throw new Refused(`${name}: splat ${i} has a zero rotation.`);
    t.qw[i] = c.rot_0[i] / l;
    t.qx[i] = c.rot_1[i] / l;
    t.qy[i] = c.rot_2[i] / l;
    t.qz[i] = c.rot_3[i] / l;
  }
  const pp = PART_PROPS.find((p) => c[p]);
  if (pp) {
    t.part = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const id = c[pp][i];
      if (!(id >= 0 && id <= 255 && Number.isInteger(id))) throw new Refused(`${name}: ${pp} of splat ${i} is ${id}, not 0 to 255.`); // prettier-ignore
      t.part[i] = id;
    }
  }
  return { table: t, sha256: sha256(bytes) };
}

// Reads a parts sidecar for a PLY with n splats and hash hex: { parts, ids (Uint8Array) }.
export function readParts(file, n, hex) {
  let j;
  try {
    j = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new Refused(`${file} is not JSON (${e.message}).`);
  }
  const bound = j.sha256 ?? j.ply_sha256 ?? j.source_sha256;
  if (!bound) throw new Refused(`${file} names no PLY hash (sha256).`);
  if (String(bound).toLowerCase() !== hex)
    throw new Refused(`${file} belongs to another PLY (its sha256 is ${bound}, the PLY's is ${hex}).`); // prettier-ignore
  const parts = (j.parts || []).map((p) => ({ id: p.id, name: p.name, ...(p.pivot ? { pivot: p.pivot } : {}), ...(p.axis ? { axis: p.axis } : {}) })); // prettier-ignore
  for (const p of parts)
    if (!(Number.isInteger(p.id) && p.id >= 0 && p.id <= 255) || !p.name)
      throw new Refused(`${file}: every part needs an id (0 to 255) and a name.`);
  let ids;
  if (j.ids) ids = Uint8Array.from(j.ids);
  else if (j.ids_b64) ids = new Uint8Array(Buffer.from(j.ids_b64, "base64"));
  else if (j.ids_file)
    ids = new Uint8Array(fs.readFileSync(path.resolve(path.dirname(file), j.ids_file))); // prettier-ignore
  else if (j.ranges) {
    ids = new Uint8Array(n);
    for (const [a, b, id] of j.ranges) ids.fill(id, a, b);
  } else throw new Refused(`${file} gives no part ids (ids, ids_b64, ids_file or ranges).`);
  if (ids.length !== n) throw new Refused(`${file} has ${ids.length} part ids for ${n} splats.`);
  const known = new Set([0, ...parts.map((p) => p.id)]);
  for (let i = 0; i < n; i++) if (!known.has(ids[i])) throw new Refused(`${file}: splat ${i} is in part ${ids[i]}, which isn't listed.`); // prettier-ignore
  return { parts, ids };
}

// Turns the PLY's up axis into the kit's (y up), in place, with the parts' pivots and axes.
const UP = {
  y: null,
  "-y": { m: (x, y, z) => [x, -y, -z], q: [1, 0, 0, 0] }, // 180 degrees about x
  z: { m: (x, y, z) => [x, z, -y], q: [-Math.SQRT1_2, 0, 0, Math.SQRT1_2] }, // -90 degrees about x
};
function reorient(t, parts, up) {
  const u = UP[up];
  if (u === undefined) throw new Refused(`--up is y, -y or z (not ${up}).`);
  if (!u) return;
  const [ax, ay, az, aw] = u.q;
  for (let i = 0; i < t.count; i++) {
    const p = u.m(t.x[i], t.y[i], t.z[i]);
    t.x[i] = p[0];
    t.y[i] = p[1];
    t.z[i] = p[2];
    const [bx, by, bz, bw] = [t.qx[i], t.qy[i], t.qz[i], t.qw[i]];
    t.qx[i] = aw * bx + bw * ax + ay * bz - az * by;
    t.qy[i] = aw * by + bw * ay + az * bx - ax * bz;
    t.qz[i] = aw * bz + bw * az + ax * by - ay * bx;
    t.qw[i] = aw * bw - ax * bx - ay * by - az * bz;
  }
  for (const p of parts) {
    if (p.pivot) p.pivot = u.m(...p.pivot);
    if (p.axis) p.axis = u.m(...p.axis);
  }
}

// A table of the splats at idx (in that order), with every log size grown by `grow`.
function pickRows(t, idx, grow = 0) {
  const m = idx.length;
  const out = { count: m, part: t.part ? new Uint8Array(m) : null };
  for (const f of ["x", "y", "z", "r", "g", "b", "opacity", "s0", "s1", "s2", "qw", "qx", "qy", "qz"]) {
    const a = t[f];
    const b = (out[f] = new Float32Array(m));
    for (let j = 0; j < m; j++) b[j] = a[idx[j]];
  } // prettier-ignore
  if (grow) for (const f of ["s0", "s1", "s2"]) for (let j = 0; j < m; j++) out[f][j] += grow;
  if (t.part) for (let j = 0; j < m; j++) out.part[j] = t.part[idx[j]];
  return out;
}

// Writes one tier: returns its manifest entry.
function writeTier(t, { id, outDir, chunk, gzip }) {
  const range = tableRange(t);
  const files = [];
  for (let first = 0, k = 0; first < t.count; first += chunk, k++) {
    const n = Math.min(chunk, t.count - first);
    let bytes = encodeChunk(t, first, n, range);
    if (gzip) bytes = zlib.gzipSync(bytes, { level: 9 });
    const rel = `assets/${id}-${t.count}-${k}.bkd${gzip ? ".gz" : ""}`;
    fs.writeFileSync(path.join(outDir, rel), bytes);
    files.push({ path: rel, splats: n, bytes: bytes.length, sha256: sha256(bytes) });
  }
  return { tier: { splats: t.count, bytes: files.reduce((s, f) => s + f.bytes, 0), files }, range };
}

export function convert(plys, opts) {
  const { out: outDir, chunk = 65536, gzip = false, up = "y", tiers: extra = [] } = opts;
  if (!plys.length) throw new Refused("Give at least one PLY.");
  if (!outDir) throw new Refused("Give --out <folder>.");
  const inputs = plys.map((file) => {
    if (!fs.existsSync(file)) throw new Refused(`${file} doesn't exist.`);
    const { table, sha256: hex } = readGaussianPly(new Uint8Array(fs.readFileSync(file)), path.basename(file)); // prettier-ignore
    return { file, table, hex };
  });
  inputs.sort((a, b) => b.table.count - a.table.count);
  const id = opts.id || path.basename(plys[0]).replace(/\.ply$/i, "");
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Refused(`The id "${id}" may use only a-z, 0-9 and -.`); // prettier-ignore
  let parts = [{ id: 0, name: "body" }];
  let partsSource = null;
  inputs.forEach((inp, k) => {
    const side = k === 0 && opts.parts ? opts.parts : inp.file.replace(/\.ply$/i, ".parts.json");
    if (fs.existsSync(side)) {
      const r = readParts(side, inp.table.count, inp.hex);
      inp.table.part = r.ids;
      if (k === 0) {
        parts = [{ id: 0, name: "body" }, ...r.parts.filter((p) => p.id !== 0)];
        partsSource = { file: path.basename(side), sha256: sha256(fs.readFileSync(side)) };
      }
    } else if (k === 0 && opts.parts) throw new Refused(`${opts.parts} doesn't exist.`);
  });
  if (parts.length > 16) throw new Refused(`A kit toy moves at most 15 parts; this asset has ${parts.length - 1}.`); // prettier-ignore
  for (const inp of inputs) reorient(inp.table, inp === inputs[0] ? parts : [], up);
  fs.mkdirSync(path.join(outDir, "assets"), { recursive: true });
  const tables = inputs.map((inp) => pickRows(inp.table, shuffled(inp.table.count, inp.hex)));
  const top = tables[0];
  for (const m of extra) {
    if (!(m > 0 && m < top.count)) throw new Refused(`A tier of ${m} splats needs fewer than the largest PLY's ${top.count}.`); // prettier-ignore
    if (tables.some((t) => t.count === m)) continue;
    // The first m of the shuffled order: an even sample, grown to close the surface.
    tables.push(pickRows(top, Array.from({ length: m }, (_, i) => i), 0.5 * Math.log(top.count / m))); // prettier-ignore
  }
  tables.sort((a, b) => a.count - b.count);
  const written = tables.map((t) => writeTier(t, { id, outDir, chunk, gzip }));
  const r = written[written.length - 1].range;
  const mpath = path.join(outDir, "manifest.json");
  const old = fs.existsSync(mpath) ? JSON.parse(fs.readFileSync(mpath, "utf8")) : {};
  const manifest = {
    format: "splashery-baked-manifest",
    version: 1,
    id,
    title: old.title ?? "",
    source: {
      file: path.basename(inputs[0].file),
      sha256: inputs[0].hex,
      splats: inputs[0].table.count,
      ...(partsSource ? { parts: partsSource.file, partsSha256: partsSource.sha256 } : {}),
      ...(inputs.length > 1 ? { more: inputs.slice(1).map((i) => ({ file: path.basename(i.file), sha256: i.hex, splats: i.table.count })) } : {}), // prettier-ignore
      up,
    },
    bounds: { min: r.lo, max: r.hi },
    parts,
    defaultTier: opts.default ?? old.defaultTier ?? undefined,
    tiers: written.map((w) => w.tier),
    credit: old.credit ?? {
      title: "",
      author: "",
      source: "",
      license: "",
      licenseUrl: "",
      checked: "",
      changes: "",
    },
    ...(old.nc !== undefined ? { nc: old.nc } : {}),
    ...(old.aiMade !== undefined ? { aiMade: old.aiMade } : {}),
    ...(old.notes !== undefined ? { notes: old.notes } : {}),
  };
  fs.writeFileSync(mpath, JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

function main(argv) {
  const plys = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      if (i + 1 >= argv.length) throw new Refused(`${a} needs a value.`);
      return argv[++i];
    };
    if (a === "--out") opts.out = val();
    else if (a === "--id") opts.id = val();
    else if (a === "--parts") opts.parts = val();
    else if (a === "--tiers") opts.tiers = val().split(",").map((s) => Math.round(Number(s.replace(/k$/i, "e3"))));
    else if (a === "--default") opts.default = Number(val());
    else if (a === "--chunk") opts.chunk = Math.max(1024, Number(val()));
    else if (a === "--up") opts.up = val();
    else if (a === "--gzip") opts.gzip = true;
    else if (a.startsWith("--")) throw new Refused(`Unknown option ${a}.`);
    else plys.push(a);
  } // prettier-ignore
  const m = convert(plys, opts);
  for (const t of m.tiers)
    console.log(`${t.splats} splats: ${t.files.length} file${t.files.length === 1 ? "" : "s"}, ${(t.bytes / 1048576).toFixed(2)} MB (${(t.bytes / t.splats).toFixed(1)} bytes a splat)`); // prettier-ignore
  console.log(`Wrote ${path.join(opts.out, "manifest.json")} (${BYTES_PER_SPLAT} bytes a splat before gzip). Fill in its credit.`); // prettier-ignore
}

if (import.meta.url === new URL(`file://${path.resolve(process.argv[1] || "")}`).href) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    if (!(e instanceof Refused)) throw e;
    console.error(`Refused: ${e.message}`);
    process.exit(1);
  }
}

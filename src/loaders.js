// Loading splat files: built-in toys (SOG, fetched with progress) and files
// people bring themselves. PLY and SOG go through the engine's own parsers;
// .splat and .spz (versions 1 to 3) are decoded here. Everything stays in the
// browser: files are read locally and never uploaded.

import * as pc from "./pc.js";
import { mulberry32 } from "./noise.js";

export const UNSUPPORTED = {
  ksplat:
    "KSPLAT files are not supported yet. Convert them to PLY or SOG with SuperSplat or splat-transform first.",
  spz4: "This SPZ file is version 4 (zstd compressed), which needs a decoder Splashery does not ship. Convert it to PLY or SOG first.",
};

export const LIMITS = {
  strong: { warnBytes: 150 * 1024 * 1024, warnSplats: 1_500_000, downsampleTo: 1_000_000 },
  weak: { warnBytes: 60 * 1024 * 1024, warnSplats: 400_000, downsampleTo: 300_000 },
};

const SH_C0 = 0.28209479177387814;

export function extOf(name) {
  const n = (name || "").toLowerCase();
  if (n.endsWith(".compressed.ply")) return "ply";
  const m = /\.([a-z0-9]+)$/.exec(n);
  return m ? m[1] : "";
}

// Fetches a URL, reporting progress (0..1) as it streams.
export async function fetchBytes(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status}).`);
  const total = Number(res.headers.get("content-length")) || 0;
  if (!res.body || !total) {
    const buf = new Uint8Array(await res.arrayBuffer());
    onProgress?.(1);
    return buf;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onProgress?.(Math.min(1, got / total));
  }
  const out = new Uint8Array(got);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

// Loads PLY / SOG bytes through the engine's parsers. Resolves with the asset.
export function loadNative(stage, bytes, filename) {
  const app = stage.app;
  const url = URL.createObjectURL(new Blob([bytes]));
  const asset = new pc.Asset(filename, "gsplat", { url, filename });
  app.assets.add(asset);
  return new Promise((resolve, reject) => {
    const done = () => URL.revokeObjectURL(url);
    asset.once("load", () => {
      done();
      resolve(asset);
    });
    asset.once("error", (err) => {
      done();
      app.assets.remove(asset);
      reject(new Error(typeof err === "string" ? err : err?.message || "Could not read the file."));
    });
    app.assets.load(asset);
  });
}

// Builds an engine resource from plain arrays in PLY conventions.
export function resourceFromArrays(stage, a) {
  const props = [];
  const add = (name, storage) => props.push({ name, type: "float", byteSize: 4, storage });
  add("x", a.x);
  add("y", a.y);
  add("z", a.z);
  add("f_dc_0", a.r);
  add("f_dc_1", a.g);
  add("f_dc_2", a.b);
  add("opacity", a.opacity);
  add("scale_0", a.s0);
  add("scale_1", a.s1);
  add("scale_2", a.s2);
  add("rot_0", a.qw);
  add("rot_1", a.qx);
  add("rot_2", a.qy);
  add("rot_3", a.qz);
  if (a.rest) a.rest.forEach((arr, i) => add(`f_rest_${i}`, arr));
  const data = new pc.GSplatData([{ name: "vertex", count: a.count, properties: props }]);
  return new pc.GSplatResource(stage.device, data, { prepareCenters: true });
}

function allocArrays(count, restCount = 0) {
  const f = () => new Float32Array(count);
  const a = {
    count,
    x: f(),
    y: f(),
    z: f(),
    r: f(),
    g: f(),
    b: f(),
    opacity: f(),
    s0: f(),
    s1: f(),
    s2: f(),
    qw: f(),
    qx: f(),
    qy: f(),
    qz: f(),
  };
  if (restCount) a.rest = Array.from({ length: restCount }, f);
  return a;
}

const logit = (p) => {
  const c = Math.min(0.9999, Math.max(0.0001, p));
  return Math.log(c / (1 - c));
};

// antimatter15 .splat: 32 bytes per splat (position, linear scale, RGBA8,
// rotation as 4 bytes w, x, y, z).
export function parseSplat(bytes) {
  const n = Math.floor(bytes.byteLength / 32);
  if (!n) throw new Error("This .splat file is empty.");
  const dv = new DataView(bytes.buffer, bytes.byteOffset, n * 32);
  const a = allocArrays(n);
  for (let i = 0; i < n; i++) {
    const o = i * 32;
    a.x[i] = dv.getFloat32(o, true);
    a.y[i] = dv.getFloat32(o + 4, true);
    a.z[i] = dv.getFloat32(o + 8, true);
    a.s0[i] = Math.log(Math.max(1e-8, dv.getFloat32(o + 12, true)));
    a.s1[i] = Math.log(Math.max(1e-8, dv.getFloat32(o + 16, true)));
    a.s2[i] = Math.log(Math.max(1e-8, dv.getFloat32(o + 20, true)));
    a.r[i] = (dv.getUint8(o + 24) / 255 - 0.5) / SH_C0;
    a.g[i] = (dv.getUint8(o + 25) / 255 - 0.5) / SH_C0;
    a.b[i] = (dv.getUint8(o + 26) / 255 - 0.5) / SH_C0;
    a.opacity[i] = logit(dv.getUint8(o + 27) / 255);
    let qw = (dv.getUint8(o + 28) - 128) / 128;
    let qx = (dv.getUint8(o + 29) - 128) / 128;
    let qy = (dv.getUint8(o + 30) - 128) / 128;
    let qz = (dv.getUint8(o + 31) - 128) / 128;
    const l = Math.hypot(qw, qx, qy, qz) || 1;
    a.qw[i] = qw / l;
    a.qx[i] = qx / l;
    a.qy[i] = qy / l;
    a.qz[i] = qz / l;
  }
  return a;
}

async function gunzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Niantic SPZ, versions 1 to 3 (gzip). Version 4 uses zstd and is refused.
export async function parseSpz(bytes) {
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) {
    const magic = new DataView(bytes.buffer, bytes.byteOffset, 8);
    if (magic.getUint32(0, true) === 0x5053474e && magic.getUint32(4, true) >= 4) {
      throw new Error(UNSUPPORTED.spz4);
    }
    throw new Error("This does not look like an SPZ file.");
  }
  const raw = await gunzip(bytes);
  const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  if (dv.getUint32(0, true) !== 0x5053474e) throw new Error("This does not look like an SPZ file.");
  const version = dv.getUint32(4, true);
  if (version < 1 || version > 3) throw new Error(`SPZ version ${version} is not supported.`);
  const n = dv.getUint32(8, true);
  const shDegree = dv.getUint8(12);
  const fractional = dv.getUint8(13);
  const shDim = [0, 3, 8, 15][shDegree] ?? 0;
  const a = allocArrays(n, shDim * 3);
  let o = 16;
  const fx = 1 / (1 << fractional);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) {
      let v;
      if (version === 1) {
        v = halfToFloat(dv.getUint16(o, true));
        o += 2;
      } else {
        v = raw[o] | (raw[o + 1] << 8) | (raw[o + 2] << 16);
        if (v & 0x800000) v |= 0xff000000;
        v *= fx;
        o += 3;
      }
      (k === 0 ? a.x : k === 1 ? a.y : a.z)[i] = v;
    }
  }
  for (let i = 0; i < n; i++) a.opacity[i] = logit(raw[o++] / 255);
  const colorScale = 0.15;
  for (let i = 0; i < n; i++) {
    a.r[i] = (raw[o++] / 255 - 0.5) / colorScale;
    a.g[i] = (raw[o++] / 255 - 0.5) / colorScale;
    a.b[i] = (raw[o++] / 255 - 0.5) / colorScale;
  }
  for (let i = 0; i < n; i++) {
    a.s0[i] = raw[o++] / 16 - 10;
    a.s1[i] = raw[o++] / 16 - 10;
    a.s2[i] = raw[o++] / 16 - 10;
  }
  for (let i = 0; i < n; i++) {
    let q;
    if (version === 3) {
      let comp = raw[o] | (raw[o + 1] << 8) | (raw[o + 2] << 16) | (raw[o + 3] << 24);
      comp >>>= 0;
      o += 4;
      const largest = comp >>> 30;
      q = [0, 0, 0, 0];
      let sum = 0;
      for (let j = 3; j >= 0; j--) {
        if (j === largest) continue;
        const mag = comp & 511;
        const neg = (comp >>> 9) & 1;
        comp >>>= 10;
        let v = (Math.SQRT1_2 * mag) / 511;
        if (neg) v = -v;
        q[j] = v;
        sum += v * v;
      }
      q[largest] = Math.sqrt(Math.max(0, 1 - sum));
    } else {
      const x = raw[o] / 127.5 - 1;
      const y = raw[o + 1] / 127.5 - 1;
      const z = raw[o + 2] / 127.5 - 1;
      o += 3;
      q = [x, y, z, Math.sqrt(Math.max(0, 1 - x * x - y * y - z * z))];
    }
    a.qx[i] = q[0];
    a.qy[i] = q[1];
    a.qz[i] = q[2];
    a.qw[i] = q[3];
  }
  // SH coefficients: per splat, per coefficient, per channel (RGB).
  if (shDim) {
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < shDim; c++) {
        for (let ch = 0; ch < 3; ch++) {
          a.rest[ch * shDim + c][i] = (raw[o++] - 128) / 128;
        }
      }
    }
  }
  return a;
}

function halfToFloat(h) {
  const s = h & 0x8000 ? -1 : 1;
  const e = (h >> 10) & 0x1f;
  const f = h & 0x3ff;
  if (e === 0) return s * Math.pow(2, -14) * (f / 1024);
  if (e === 31) return f ? NaN : s * Infinity;
  return s * Math.pow(2, e - 15) * (1 + f / 1024);
}

// ---- PLY header and decimation ----------------------------------------------------

const PLY_TYPES = {
  char: [1, "getInt8"],
  uchar: [1, "getUint8"],
  int8: [1, "getInt8"],
  uint8: [1, "getUint8"],
  short: [2, "getInt16"],
  ushort: [2, "getUint16"],
  int16: [2, "getInt16"],
  uint16: [2, "getUint16"],
  int: [4, "getInt32"],
  uint: [4, "getUint32"],
  int32: [4, "getInt32"],
  uint32: [4, "getUint32"],
  float: [4, "getFloat32"],
  float32: [4, "getFloat32"],
  double: [8, "getFloat64"],
  float64: [8, "getFloat64"],
};

export function readPlyHeader(bytes) {
  const head = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 65536)));
  const end = head.indexOf("end_header");
  if (!head.startsWith("ply") || end < 0) return null;
  const lines = head.slice(0, end).split(/\r?\n/);
  const elements = [];
  let format = "";
  for (const line of lines) {
    const t = line.trim().split(/\s+/);
    if (t[0] === "format") format = t[1];
    else if (t[0] === "element") elements.push({ name: t[1], count: Number(t[2]), props: [] });
    else if (t[0] === "property" && elements.length) {
      elements[elements.length - 1].props.push({
        type: t[1],
        name: t[t.length - 1],
        list: t[1] === "list",
      });
    }
  }
  const headerBytes = new TextEncoder().encode(head.slice(0, end + "end_header".length)).length;
  let offset = headerBytes;
  if (bytes[offset] === 0x0d) offset++;
  if (bytes[offset] === 0x0a) offset++;
  const vertex = elements.find((e) => e.name === "vertex");
  const compressed = elements.some((e) => e.name === "chunk");
  return { format, elements, vertex, offset, compressed, count: vertex ? vertex.count : 0 };
}

// Keeps a seeded random subset of an uncompressed binary PLY.
export function decimatePly(bytes, header, keep, seed = 1) {
  const v = header.vertex;
  if (header.format !== "binary_little_endian" || header.compressed || !v) {
    throw new Error("Only uncompressed binary PLY files can be downsampled.");
  }
  if (header.elements[0] !== v || v.props.some((p) => p.list)) {
    throw new Error("This PLY layout cannot be downsampled.");
  }
  const layout = [];
  let stride = 0;
  for (const p of v.props) {
    const t = PLY_TYPES[p.type];
    if (!t) throw new Error(`Unknown PLY property type ${p.type}.`);
    layout.push({ name: p.name, offset: stride, getter: t[1] });
    stride += t[0];
  }
  const rand = mulberry32(seed);
  const p = Math.min(1, keep / v.count);
  const picked = [];
  for (let i = 0; i < v.count; i++) if (rand() < p) picked.push(i);
  const dv = new DataView(bytes.buffer, bytes.byteOffset + header.offset, v.count * stride);
  const props = layout.map((l) => ({
    name: l.name,
    type: "float",
    byteSize: 4,
    storage: new Float32Array(picked.length),
  }));
  for (let k = 0; k < picked.length; k++) {
    const base = picked[k] * stride;
    for (let j = 0; j < layout.length; j++) {
      props[j].storage[k] = dv[layout[j].getter](base + layout[j].offset, true);
    }
  }
  return { count: picked.length, props };
}

export function resourceFromProps(stage, { count, props }) {
  const data = new pc.GSplatData([{ name: "vertex", count, properties: props }]);
  return new pc.GSplatResource(stage.device, data, { prepareCenters: true });
}

// ---- Normalising --------------------------------------------------------------

// Robust bounds of a resource's centres (ignores the outer 2% of floaters).
export function robustBounds(resource) {
  const centers = resource.centers || resource.gsplatData?.getCenters?.();
  const n = resource.numSplats || (centers ? centers.length / 3 : 0);
  if (!centers || !n) {
    const aabb = resource.aabb;
    const c = aabb.center;
    const h = aabb.halfExtents;
    return { center: [c.x, c.y, c.z], half: [h.x, h.y, h.z] };
  }
  const sample = Math.min(n, 60000);
  const step = n / sample;
  const axes = [[], [], []];
  for (let i = 0; i < sample; i++) {
    const j = Math.floor(i * step) * 3;
    axes[0].push(centers[j]);
    axes[1].push(centers[j + 1]);
    axes[2].push(centers[j + 2]);
  }
  const center = [];
  const half = [];
  for (const a of axes) {
    a.sort((x, y) => x - y);
    const lo = a[Math.floor(a.length * 0.02)];
    const hi = a[Math.floor(a.length * 0.98)];
    center.push((lo + hi) / 2);
    half.push(Math.max(1e-4, (hi - lo) / 2));
  }
  return { center, half };
}

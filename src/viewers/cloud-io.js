// Lane Viewers: reading and writing point clouds for the Point clouds toy, on the device. Plain
// JavaScript with no page or engine imports (the toy's worker, the browser and the Node tests).
//
// A cloud is
//   { count, origin: [x, y, z], x, y, z, intensity, cls, r, g, b, format, info }
// x, y and z are Float32Arrays relative to `origin` (a lidar tile's coordinates are millions of
// meters; relative ones keep millimeters in 32 bits). intensity is a Uint16Array, cls (the ASPRS
// classification) a Uint8Array, r g b Uint8Arrays, each null when the file has none. `info` holds
// what the stats show (the LAS version and point format, the scale, the system identifier).
//
// Reads LAS 1.0 to 1.4 (point formats 0 to 10), LAZ (through laz-perf, vendor/laz-perf/, passed
// in as `getLazPerf`), PLY (points; binary or text), XYZ and PTS text. Writes PLY, LAS 1.2 and XYZ.

import { readPlyHeader, readPlyElements } from "./splat-io.js";

export const CLASS_NAMES = {
  0: "Never classified",
  1: "Unclassified",
  2: "Ground",
  3: "Low vegetation",
  4: "Medium vegetation",
  5: "High vegetation",
  6: "Building",
  7: "Low point (noise)",
  8: "Model key point",
  9: "Water",
  10: "Rail",
  11: "Road surface",
  12: "Overlap",
  13: "Wire guard",
  14: "Wire conductor",
  15: "Transmission tower",
  16: "Wire connector",
  17: "Bridge deck",
  18: "High noise",
  19: "Overhead structure",
  20: "Ignored ground",
  21: "Snow",
  22: "Temporal exclusion",
};

export function cloudExt(name) {
  const m = /\.([a-z0-9]+)$/.exec((name || "").toLowerCase());
  return m ? m[1] : "";
}

function emptyCloud(count, { intensity = false, cls = false, color = false } = {}) {
  return {
    count,
    origin: [0, 0, 0],
    x: new Float32Array(count),
    y: new Float32Array(count),
    z: new Float32Array(count),
    intensity: intensity ? new Uint16Array(count) : null,
    cls: cls ? new Uint8Array(count) : null,
    r: color ? new Uint8Array(count) : null,
    g: color ? new Uint8Array(count) : null,
    b: color ? new Uint8Array(count) : null,
    info: {},
  };
}

// The splats at `idx`, as a new cloud.
export function pickCloud(c, idx) {
  const n = idx.length;
  const out = emptyCloud(n, { intensity: !!c.intensity, cls: !!c.cls, color: !!c.r });
  out.origin = c.origin.slice();
  out.info = { ...c.info };
  out.format = c.format;
  for (const k of ["x", "y", "z", "intensity", "cls", "r", "g", "b"]) {
    const a = c[k];
    if (!a) continue;
    const b = out[k];
    for (let j = 0; j < n; j++) b[j] = a[idx[j]];
  }
  return out;
}

export const cloudBytes = (c) =>
  c.count * (12 + (c.intensity ? 2 : 0) + (c.cls ? 1 : 0) + (c.r ? 3 : 0));

// ---- LAS / LAZ -------------------------------------------------------------------------------

export function readLasHeader(bytes) {
  if (bytes.byteLength < 227) throw new Error("This LAS file is too short to have a header.");
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sig = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (sig !== "LASF")
    throw new Error("This is not a LAS or LAZ file (it does not start with “LASF”).");
  const major = bytes[24];
  const minor = bytes[25];
  const text = (o, n) => new TextDecoder("latin1").decode(bytes.subarray(o, o + n)).replace(/\0.*$/s, "").trim(); // prettier-ignore
  const h = {
    version: `${major}.${minor}`,
    system: text(26, 32),
    software: text(58, 32),
    headerSize: dv.getUint16(94, true),
    pointOffset: dv.getUint32(96, true),
    vlrCount: dv.getUint32(100, true),
    formatRaw: bytes[104],
    format: bytes[104] & 0x3f,
    compressed: (bytes[104] & 0xc0) !== 0,
    recordLength: dv.getUint16(105, true),
    count: dv.getUint32(107, true),
    scale: [dv.getFloat64(131, true), dv.getFloat64(139, true), dv.getFloat64(147, true)],
    offset: [dv.getFloat64(155, true), dv.getFloat64(163, true), dv.getFloat64(171, true)],
    max: [dv.getFloat64(179, true), dv.getFloat64(195, true), dv.getFloat64(211, true)],
    min: [dv.getFloat64(187, true), dv.getFloat64(203, true), dv.getFloat64(219, true)],
  };
  if (minor >= 4 && h.headerSize >= 375) {
    const big = Number(dv.getBigUint64(247, true));
    if (big) h.count = big;
  }
  if (h.format > 10) throw new Error(`LAS point format ${h.format} is not one Splashery knows.`);
  h.crs = lasCrs(bytes, h);
  return h;
}

// What the file says about its coordinate system, in a few words (the WKT's name, or the GeoTIFF
// keys' presence), from its variable length records.
function lasCrs(bytes, h) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let o = h.headerSize;
  for (let k = 0; k < h.vlrCount && o + 54 <= bytes.byteLength; k++) {
    const user = new TextDecoder("latin1")
      .decode(bytes.subarray(o + 2, o + 18))
      .replace(/\0.*$/s, "");
    const rec = dv.getUint16(o + 18, true);
    const len = dv.getUint16(o + 20, true);
    const body = o + 54;
    if (user === "LASF_Projection" && rec === 2112 && body + len <= bytes.byteLength) {
      const wkt = new TextDecoder().decode(bytes.subarray(body, body + len));
      const m = /^\s*(?:COMPD_CS|PROJCS|PROJCRS|GEOGCS|GEOGCRS|COMPOUNDCRS)\["([^"]+)"/.exec(wkt);
      if (m) return m[1];
    }
    if (user === "LASF_Projection" && rec === 34735 && body + 8 <= bytes.byteLength) {
      // GeoKeyDirectory: look for ProjectedCSTypeGeoKey (3072) or GeographicTypeGeoKey (2048).
      const keys = dv.getUint16(body + 6, true);
      for (let i = 0; i < keys; i++) {
        const e = body + 8 + i * 8;
        if (e + 8 > bytes.byteLength) break;
        const id = dv.getUint16(e, true);
        const val = dv.getUint16(e + 6, true);
        if ((id === 3072 || id === 2048) && val && val !== 32767) return `EPSG:${val}`;
      }
    }
    o = body + len;
  }
  return "";
}

// Field offsets inside a point record, by format.
function lasLayout(format) {
  const legacy = format <= 5;
  const gps = [1, 3, 4, 5].includes(format) || format >= 6;
  let rgb = -1;
  if (format === 2) rgb = 20;
  else if (format === 3 || format === 5) rgb = 28;
  else if (format === 7 || format === 8 || format === 10) rgb = 30;
  return { legacy, gps, rgb, cls: legacy ? 15 : 16 };
}

// Reads point records (raw LAS layout) into a cloud. `records` is a Uint8Array of count *
// recordLength bytes. onProgress(0..1).
function recordsToCloud(records, h, count, onProgress) {
  const L = lasLayout(h.format);
  const c = emptyCloud(count, { intensity: true, cls: true, color: L.rgb >= 0 });
  const dv = new DataView(records.buffer, records.byteOffset, records.byteLength);
  const [sx, sy, sz] = h.scale;
  // Relative to the middle of the header's box, in the file's own units.
  const ox = (h.min[0] + h.max[0]) / 2;
  const oy = (h.min[1] + h.max[1]) / 2;
  const oz = (h.min[2] + h.max[2]) / 2;
  c.origin = [ox, oy, oz];
  const dx = h.offset[0] - ox;
  const dy = h.offset[1] - oy;
  const dz = h.offset[2] - oz;
  const R = h.recordLength;
  let maxColor = 0;
  const raw16 = L.rgb >= 0 ? new Uint16Array(count * 3) : null;
  const step = Math.max(1, count >> 6);
  for (let i = 0; i < count; i++) {
    const o = i * R;
    c.x[i] = dv.getInt32(o, true) * sx + dx;
    c.y[i] = dv.getInt32(o + 4, true) * sy + dy;
    c.z[i] = dv.getInt32(o + 8, true) * sz + dz;
    c.intensity[i] = dv.getUint16(o + 12, true);
    c.cls[i] = L.legacy ? records[o + 15] & 31 : records[o + 16];
    if (raw16) {
      const r = dv.getUint16(o + L.rgb, true);
      const g = dv.getUint16(o + L.rgb + 2, true);
      const b = dv.getUint16(o + L.rgb + 4, true);
      raw16[i * 3] = r;
      raw16[i * 3 + 1] = g;
      raw16[i * 3 + 2] = b;
      if (r > maxColor) maxColor = r;
      if (g > maxColor) maxColor = g;
      if (b > maxColor) maxColor = b;
    }
    if (onProgress && i % step === 0) onProgress(i / count);
  }
  if (raw16) {
    // The standard says 16-bit color; some writers put 8-bit values in it.
    const shift = maxColor > 255 ? 8 : 0;
    for (let i = 0; i < count; i++) {
      c.r[i] = raw16[i * 3] >> shift;
      c.g[i] = raw16[i * 3 + 1] >> shift;
      c.b[i] = raw16[i * 3 + 2] >> shift;
    }
    if (maxColor === 0) c.r = c.g = c.b = null;
  }
  c.info = {
    version: h.version,
    pointFormat: h.format,
    scale: h.scale,
    system: h.system,
    software: h.software,
    crs: h.crs,
  };
  return c;
}

export function readLas(bytes, { onProgress } = {}) {
  const h = readLasHeader(bytes);
  if (h.compressed) throw new Error("This LAS file is compressed: open it as .laz.");
  const need = h.pointOffset + h.count * h.recordLength;
  if (bytes.byteLength < need) throw new Error("This LAS file is cut short: it has fewer points than its header says."); // prettier-ignore
  const records = bytes.subarray(h.pointOffset, need);
  const c = recordsToCloud(records, h, h.count, onProgress);
  c.format = "las";
  return c;
}

// LAZ through laz-perf: the whole file goes into its memory, and each point comes out as a raw
// LAS record. lazPerf: the module laz-perf's factory resolved to.
export function readLaz(bytes, lazPerf, { onProgress } = {}) {
  const h = readLasHeader(bytes);
  const M = lazPerf;
  const filePtr = M._malloc(bytes.byteLength);
  M.HEAPU8.set(bytes, filePtr);
  const laszip = new M.LASZip();
  let pointPtr = 0;
  try {
    laszip.open(filePtr, bytes.byteLength);
    const count = laszip.getCount();
    const len = laszip.getPointLength();
    const fmt = laszip.getPointFormat();
    const hh = { ...h, format: fmt & 0x3f, recordLength: len, count };
    const records = new Uint8Array(count * len);
    pointPtr = M._malloc(len);
    const step = Math.max(1, count >> 6);
    for (let i = 0; i < count; i++) {
      laszip.getPoint(pointPtr);
      records.set(M.HEAPU8.subarray(pointPtr, pointPtr + len), i * len);
      if (onProgress && i % step === 0) onProgress((0.8 * i) / count);
    }
    const c = recordsToCloud(records, hh, count, onProgress && ((p) => onProgress(0.8 + 0.2 * p)));
    c.format = "laz";
    c.info.compressed = true;
    return c;
  } finally {
    laszip.delete();
    if (pointPtr) M._free(pointPtr);
    M._free(filePtr);
  }
}

// LAS 1.2: point format 2 (with color) or 0, millimeter scale, offset at the cloud's origin.
export function writeLas(c, { scale = 0.001 } = {}) {
  const color = !!c.r;
  const format = color ? 2 : 0;
  const R = color ? 26 : 20;
  const head = 227;
  const out = new Uint8Array(head + c.count * R);
  const dv = new DataView(out.buffer);
  out.set([76, 65, 83, 70]); // LASF
  out[24] = 1;
  out[25] = 2;
  const put = (o, s, n) => out.set(new TextEncoder().encode(s.slice(0, n - 1)), o);
  put(26, c.info?.system || "OTHER", 32);
  put(58, "Splashery Point clouds", 32);
  const now = new Date();
  const doy = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 864e5);
  dv.setUint16(90, doy, true);
  dv.setUint16(92, now.getFullYear(), true);
  dv.setUint16(94, head, true);
  dv.setUint32(96, head, true);
  dv.setUint32(100, 0, true);
  out[104] = format;
  dv.setUint16(105, R, true);
  dv.setUint32(107, c.count, true);
  const ret = new Uint32Array(5);
  ret[0] = c.count;
  for (let k = 0; k < 5; k++) dv.setUint32(111 + k * 4, ret[k], true);
  const off = c.origin.map((v) => Math.round(v / scale) * scale);
  for (let k = 0; k < 3; k++) {
    dv.setFloat64(131 + k * 8, scale, true);
    dv.setFloat64(155 + k * 8, off[k], true);
  }
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const xyz = [c.x, c.y, c.z];
  for (let i = 0; i < c.count; i++) {
    const o = head + i * R;
    for (let k = 0; k < 3; k++) {
      const abs = xyz[k][i] + c.origin[k];
      const q = Math.round((abs - off[k]) / scale);
      dv.setInt32(o + k * 4, q, true);
      const v = q * scale + off[k];
      if (v < min[k]) min[k] = v;
      if (v > max[k]) max[k] = v;
    }
    dv.setUint16(o + 12, c.intensity ? c.intensity[i] : 0, true);
    out[o + 14] = 0x09; // return 1 of 1
    out[o + 15] = c.cls ? Math.min(31, c.cls[i]) : 1;
    if (color) {
      dv.setUint16(o + 20, c.r[i] * 257, true);
      dv.setUint16(o + 22, c.g[i] * 257, true);
      dv.setUint16(o + 24, c.b[i] * 257, true);
    }
  }
  if (!c.count) for (let k = 0; k < 3; k++) min[k] = max[k] = 0;
  for (let k = 0; k < 3; k++) {
    dv.setFloat64(179 + k * 16, max[k], true);
    dv.setFloat64(187 + k * 16, min[k], true);
  }
  return out;
}

// ---- PLY -------------------------------------------------------------------------------------

const firstOf = (cols, names) => {
  for (const n of names) if (cols[n]) return cols[n];
  return null;
};

export function readPointPly(bytes, { onProgress } = {}) {
  const header = readPlyHeader(bytes);
  if (!header) throw new Error("This is not a PLY file (it does not start with “ply”).");
  const v = header.elements.find((e) => e.name === "vertex");
  if (!v) throw new Error("This PLY has no points (no vertex element).");
  if (header.elements.some((e) => e.name === "chunk"))
    throw new Error("This is a compressed splat PLY: open it in the Splat toolkit.");
  const cols = readPlyElements(bytes, header, { want: ["vertex"], onProgress }).vertex.cols;
  if (!cols.x || !cols.y || !cols.z) throw new Error("This PLY has no x, y and z.");
  const n = v.count;
  const red = firstOf(cols, ["red", "r", "diffuse_red"]);
  const green = firstOf(cols, ["green", "g", "diffuse_green"]);
  const blue = firstOf(cols, ["blue", "b", "diffuse_blue"]);
  const dc = cols.f_dc_0 ? [cols.f_dc_0, cols.f_dc_1, cols.f_dc_2] : null; // a splat PLY
  const inten = firstOf(cols, ["intensity", "scalar_intensity", "scalar_Intensity", "Intensity"]);
  const cl = firstOf(cols, ["classification", "class", "scalar_classification", "scalar_Classification", "Classification", "label"]); // prettier-ignore
  const color = !!(red && green && blue) || !!dc;
  const c = emptyCloud(n, { intensity: !!inten, cls: !!cl, color });
  let lo = [Infinity, Infinity, Infinity];
  let hi = [-Infinity, -Infinity, -Infinity];
  const src = [cols.x, cols.y, cols.z];
  for (let k = 0; k < 3; k++)
    for (let i = 0; i < n; i++) {
      const val = src[k][i];
      if (val < lo[k]) lo[k] = val;
      if (val > hi[k]) hi[k] = val;
    }
  if (!n) lo = hi = [0, 0, 0];
  c.origin = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2);
  const dst = [c.x, c.y, c.z];
  for (let k = 0; k < 3; k++) for (let i = 0; i < n; i++) dst[k][i] = src[k][i] - c.origin[k];
  if (red && green && blue) {
    let m = 0;
    for (let i = 0; i < n; i++) m = Math.max(m, red[i], green[i], blue[i]);
    const f = m <= 1.0001 ? 255 : m > 255 ? 255 / 65535 : 1; // 0..1 floats, 8 or 16 bits
    for (let i = 0; i < n; i++) {
      c.r[i] = Math.min(255, Math.round(red[i] * f));
      c.g[i] = Math.min(255, Math.round(green[i] * f));
      c.b[i] = Math.min(255, Math.round(blue[i] * f));
    }
  } else if (dc) {
    const SH_C0 = 0.28209479177387814;
    const to = (v) => Math.max(0, Math.min(255, Math.round((0.5 + SH_C0 * v) * 255)));
    for (let i = 0; i < n; i++) {
      c.r[i] = to(dc[0][i]);
      c.g[i] = to(dc[1][i]);
      c.b[i] = to(dc[2][i]);
    }
  }
  if (inten) {
    let m = 0;
    for (let i = 0; i < n; i++) m = Math.max(m, inten[i]);
    const f = m <= 1.0001 ? 65535 : 1;
    for (let i = 0; i < n; i++)
      c.intensity[i] = Math.max(0, Math.min(65535, Math.round(inten[i] * f)));
  }
  if (cl) for (let i = 0; i < n; i++) c.cls[i] = Math.max(0, Math.min(255, Math.round(cl[i])));
  c.format = "ply";
  c.info = { plyFormat: header.format };
  return c;
}

// Binary PLY: absolute coordinates as doubles (so it stays georeferenced), color, intensity and
// classification when the cloud has them.
export function writePointPly(c) {
  const props = [
    ["double", "x"],
    ["double", "y"],
    ["double", "z"],
  ];
  if (c.r) props.push(["uchar", "red"], ["uchar", "green"], ["uchar", "blue"]);
  if (c.intensity) props.push(["ushort", "intensity"]);
  if (c.cls) props.push(["uchar", "classification"]);
  const size = { double: 8, uchar: 1, ushort: 2 };
  const stride = props.reduce((s, p) => s + size[p[0]], 0);
  const head =
    `ply\nformat binary_little_endian 1.0\ncomment Saved by Splashery's Point clouds toy\nelement vertex ${c.count}\n` +
    props.map((p) => `property ${p[0]} ${p[1]}\n`).join("") +
    "end_header\n";
  const hb = new TextEncoder().encode(head);
  const out = new Uint8Array(hb.length + stride * c.count);
  out.set(hb);
  const dv = new DataView(out.buffer);
  for (let i = 0; i < c.count; i++) {
    let o = hb.length + i * stride;
    dv.setFloat64(o, c.x[i] + c.origin[0], true);
    dv.setFloat64(o + 8, c.y[i] + c.origin[1], true);
    dv.setFloat64(o + 16, c.z[i] + c.origin[2], true);
    o += 24;
    if (c.r) {
      out[o++] = c.r[i];
      out[o++] = c.g[i];
      out[o++] = c.b[i];
    }
    if (c.intensity) {
      dv.setUint16(o, c.intensity[i], true);
      o += 2;
    }
    if (c.cls) out[o++] = c.cls[i];
  }
  return out;
}

// ---- XYZ and PTS text ------------------------------------------------------------------------

// Numbers in a text file, fast: returns { rows, cols, values } where `cols` is the number of
// numbers on the first data row (rows with another count are skipped).
function scanNumbers(bytes, { skipFirst = false, onProgress } = {}) {
  const n = bytes.length;
  let i = 0;
  if (skipFirst) {
    while (i < n && bytes[i] !== 10) i++;
    i++;
  }
  let cols = 0;
  let values = new Float64Array(1 << 16);
  let len = 0;
  let rows = 0;
  const row = new Float64Array(16);
  const step = Math.max(1, n >> 6);
  let nextTick = step;
  while (i < n) {
    // One line.
    let k = 0;
    let bad = false;
    while (i < n && bytes[i] !== 10) {
      const ch = bytes[i];
      if (ch === 32 || ch === 9 || ch === 44 || ch === 59 || ch === 13) {
        i++;
        continue;
      }
      if (ch === 35 || ch === 47) {
        // A comment (# or //): skip the line.
        while (i < n && bytes[i] !== 10) i++;
        break;
      }
      // A number.
      let sign = 1;
      if (ch === 45) {
        sign = -1;
        i++;
      } else if (ch === 43) i++;
      let v = 0;
      let digits = 0;
      while (i < n && bytes[i] >= 48 && bytes[i] <= 57) {
        v = v * 10 + (bytes[i] - 48);
        i++;
        digits++;
      }
      if (bytes[i] === 46) {
        i++;
        let f = 0.1;
        while (i < n && bytes[i] >= 48 && bytes[i] <= 57) {
          v += (bytes[i] - 48) * f;
          f *= 0.1;
          i++;
          digits++;
        }
      }
      if (bytes[i] === 101 || bytes[i] === 69) {
        i++;
        let es = 1;
        if (bytes[i] === 45) {
          es = -1;
          i++;
        } else if (bytes[i] === 43) i++;
        let e = 0;
        while (i < n && bytes[i] >= 48 && bytes[i] <= 57) e = e * 10 + (bytes[i++] - 48);
        v *= Math.pow(10, es * e);
      }
      if (!digits) {
        bad = true;
        while (i < n && bytes[i] !== 10) i++;
        break;
      }
      if (k < 16) row[k] = sign * v;
      k++;
    }
    i++;
    if (bad || k < 3) continue;
    if (!cols) cols = Math.min(16, k);
    if (k < cols) continue;
    if (len + cols > values.length) {
      const bigger = new Float64Array(values.length * 2);
      bigger.set(values);
      values = bigger;
    }
    for (let j = 0; j < cols; j++) values[len++] = row[j];
    rows++;
    if (onProgress && i > nextTick) {
      onProgress(i / n);
      nextTick = i + step;
    }
  }
  return { rows, cols, values };
}

function cloudFromRows({ rows, cols, values }, kind) {
  if (!rows) throw new Error(`This ${kind} file has no rows of numbers (each row needs at least x, y and z).`); // prettier-ignore
  // XYZ: x y z, then maybe r g b, or intensity, or intensity r g b, or r g b intensity... PTS:
  // x y z intensity r g b. Columns past z are read by count.
  let ii = -1;
  let ci = -1;
  if (kind === "PTS") {
    if (cols >= 4) ii = 3;
    if (cols >= 7) ci = 4;
  } else if (cols === 4) ii = 3;
  else if (cols === 6) ci = 3;
  else if (cols >= 7) {
    // x y z i r g b, or x y z r g b i: whichever has colors in 0..255.
    let max3 = 0;
    for (let r = 0; r < Math.min(rows, 2000); r++) max3 = Math.max(max3, values[r * cols + 3]);
    if (max3 <= 255) {
      ci = 3;
      ii = 6;
    } else {
      ii = 3;
      ci = 4;
    }
  }
  const c = emptyCloud(rows, { intensity: ii >= 0, color: ci >= 0 });
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let r = 0; r < rows; r++)
    for (let k = 0; k < 3; k++) {
      const v = values[r * cols + k];
      if (v < lo[k]) lo[k] = v;
      if (v > hi[k]) hi[k] = v;
    }
  c.origin = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2);
  let imin = Infinity;
  let imax = -Infinity;
  let cmax = 0;
  for (let r = 0; r < rows; r++) {
    const o = r * cols;
    c.x[r] = values[o] - c.origin[0];
    c.y[r] = values[o + 1] - c.origin[1];
    c.z[r] = values[o + 2] - c.origin[2];
    if (ii >= 0) {
      imin = Math.min(imin, values[o + ii]);
      imax = Math.max(imax, values[o + ii]);
    }
    if (ci >= 0) cmax = Math.max(cmax, values[o + ci], values[o + ci + 1], values[o + ci + 2]);
  }
  if (ii >= 0) {
    // PTS intensity runs -2048..2047; others 0..1, 0..255 or 0..65535. Stretched to 16 bits.
    const lo2 = kind === "PTS" && imin < 0 ? -2048 : 0;
    const hi2 = kind === "PTS" && imin < 0 ? 2047 : imax <= 1 ? 1 : imax <= 255 ? 255 : 65535;
    const f = 65535 / (hi2 - lo2 || 1);
    for (let r = 0; r < rows; r++)
      c.intensity[r] = Math.max(0, Math.min(65535, Math.round((values[r * cols + ii] - lo2) * f)));
  }
  if (ci >= 0) {
    const f = cmax <= 1 ? 255 : cmax > 255 ? 255 / 65535 : 1;
    for (let r = 0; r < rows; r++) {
      const o = r * cols + ci;
      c.r[r] = Math.min(255, Math.round(values[o] * f));
      c.g[r] = Math.min(255, Math.round(values[o + 1] * f));
      c.b[r] = Math.min(255, Math.round(values[o + 2] * f));
    }
  }
  c.info = { columns: cols };
  return c;
}

export function readXyz(bytes, opts = {}) {
  const c = cloudFromRows(scanNumbers(bytes, opts), "XYZ");
  c.format = "xyz";
  return c;
}

export function readPts(bytes, opts = {}) {
  // The first line is the point count (a lone number); skip it when it is.
  const first = new TextDecoder().decode(bytes.subarray(0, Math.min(200, bytes.length))).split(/\r?\n/)[0].trim(); // prettier-ignore
  const c = cloudFromRows(scanNumbers(bytes, { ...opts, skipFirst: /^\d+$/.test(first) }), "PTS");
  c.format = "pts";
  return c;
}

export function writeXyz(c) {
  const parts = [];
  const dec = (v) => v.toFixed(3);
  let chunk = "";
  for (let i = 0; i < c.count; i++) {
    let line = `${dec(c.x[i] + c.origin[0])} ${dec(c.y[i] + c.origin[1])} ${dec(c.z[i] + c.origin[2])}`;
    if (c.r) line += ` ${c.r[i]} ${c.g[i]} ${c.b[i]}`;
    if (c.intensity) line += ` ${c.intensity[i]}`;
    chunk += line + "\n";
    if (chunk.length > 1 << 20) {
      parts.push(chunk);
      chunk = "";
    }
  }
  parts.push(chunk);
  return new TextEncoder().encode(parts.join(""));
}

// ---- One door ---------------------------------------------------------------------------------

export async function readCloudFile(bytes, name, { getLazPerf, onProgress } = {}) {
  const ext = cloudExt(name);
  if (ext === "las") return readLas(bytes, { onProgress });
  if (ext === "laz") {
    if (!getLazPerf) throw new Error("Reading LAZ needs the LAZ reader.");
    return readLaz(bytes, await getLazPerf(), { onProgress });
  }
  if (ext === "ply") return readPointPly(bytes, { onProgress });
  if (ext === "xyz" || ext === "txt" || ext === "csv") return readXyz(bytes, { onProgress });
  if (ext === "pts") return readPts(bytes, { onProgress });
  throw new Error(`The Point clouds toy reads .las, .laz, .ply, .xyz and .pts files, not .${ext || "?"}.`); // prettier-ignore
}

export const CLOUD_SAVE = {
  ply: { label: "PLY (binary, with colors and classes)", ext: "ply" },
  las: { label: "LAS 1.2 (for GIS and lidar tools)", ext: "las" },
  xyz: { label: "XYZ text (x y z, then colors and intensity)", ext: "xyz" },
};

export function writeCloudFile(c, format) {
  if (format === "ply") return writePointPly(c);
  if (format === "las") return writeLas(c);
  if (format === "xyz") return writeXyz(c);
  throw new Error(`Unknown format ${format}.`);
}

export function cloudBounds(c) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const a = [c.x, c.y, c.z];
  for (let k = 0; k < 3; k++)
    for (let i = 0; i < c.count; i++) {
      const v = a[k][i];
      if (v < min[k]) min[k] = v;
      if (v > max[k]) max[k] = v;
    }
  if (!c.count) return { min: [0, 0, 0], max: [0, 0, 0], size: [0, 0, 0] };
  return { min, max, size: [0, 1, 2].map((k) => max[k] - min[k]) };
}

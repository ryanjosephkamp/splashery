// Lane Volume viewer (prefix vol): reading a person's own volume file, on the device.
//
//   readVolume(files, raw)   a list of { name, bytes } (one file, a zip, or the slices of a series)
//                            -> a volume (below). raw: the header form's answers for a raw file.
//
// Formats:
// - DICOM: a series of slices (picked together, a folder, or a .zip), or one multi-frame file. Read
//   with dicom-parser (vendor/dicom-parser/, MIT), loaded the first time a DICOM file is opened.
//   Uncompressed and RLE Lossless pixel data; slices are sorted by their place in the scanner, and
//   the spacing between slices comes from those places.
// - NIfTI-1 and NIfTI-2 (.nii, .nii.gz): read here; the voxel size from pixdim, the axes from the
//   sform or qform.
// - TIFF stacks: one multi-page file or many single-page files (sorted by name); 8, 16 and 32 bits,
//   uncompressed, LZW, Deflate or PackBits. ImageJ's spacing and unit are read when present.
// - Raw volumes: the size, value type, byte order, voxel size and header length come from a form.
//
// A volume is { nx, ny, nz, data (Float32Array, x fastest, the values after any rescale), spacing
// ([x, y, z] in mm), view (for each of x, y, z: { axis, sign } in the toy's right, up and toward
// the viewer), min, max, unit ("HU" for CT in Hounsfield units, else ""), format, modality, source
// ({ nx, ny, nz, spacing } as in the file), notes }. Big files are averaged down as they are read
// (at most MAX_VOXELS), so the viewer never keeps more than about 32 MB.

export const MAX_VOXELS = 8e6;

export class VolumeError extends Error {}
const fail = (msg) => {
  throw new VolumeError(msg);
};

const lower = (s) => String(s || "").toLowerCase();
const extOf = (name) => {
  const n = lower(name);
  if (n.endsWith(".nii.gz")) return "nii.gz";
  const m = /\.([a-z0-9]+)$/.exec(n);
  return m ? m[1] : "";
};
const baseName = (name) => String(name).split(/[\\/]/).pop();
const naturalSort = (a, b) =>
  a.name.localeCompare(b.name, "en", { numeric: true, sensitivity: "base" });
const mb = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`); // prettier-ignore

// ---- Bytes: gzip and zip ---------------------------------------------------------------------------

async function inflate(bytes, format) {
  try {
    const ds = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
    return new Uint8Array(await new Response(ds).arrayBuffer());
  } catch {
    return null;
  }
}

export const isGzip = (b) => b.length > 2 && b[0] === 0x1f && b[1] === 0x8b;
const isZip = (b) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 3 && b[3] === 4;
const isTiff = (b) =>
  b.length > 8 &&
  ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 42 && b[3] === 0) ||
    (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0 && b[3] === 42));
const isBigTiff = (b) =>
  b.length > 8 &&
  ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 43) || (b[0] === 0x4d && b[1] === 0x4d && b[3] === 43)); // prettier-ignore
const isDicom = (b) =>
  b.length > 132 && b[128] === 0x44 && b[129] === 0x49 && b[130] === 0x43 && b[131] === 0x4d;
function isNifti(b) {
  if (b.length < 348) return false;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const s = dv.getInt32(0, true);
  const t = dv.getInt32(0, false);
  return s === 348 || s === 540 || t === 348 || t === 540;
}
// A DICOM file without its 128-byte preamble (older files): a group 0002 or 0008 tag first.
function looksLikeBareDicom(b) {
  if (b.length < 16) return false;
  const g = b[0] | (b[1] << 8);
  const vr = String.fromCharCode(b[4], b[5]);
  return (g === 0x0008 || g === 0x0002) && (/^[A-Z]{2}$/.test(vr) || b[6] === 0);
}

// The files of a zip archive (stored or deflated), as [{ name, bytes }].
export async function unzip(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  if (eocd < 0) fail("This zip file is damaged or cut short: its index at the end is missing.");
  const count = dv.getUint16(eocd + 10, true);
  let at = dv.getUint32(eocd + 16, true);
  if (count === 0xffff || at === 0xffffffff)
    fail("This zip file is over 4 GB (zip64), which Splashery can't read. Unzip it and open the files instead."); // prettier-ignore
  const out = [];
  for (let i = 0; i < count; i++) {
    if (at + 46 > bytes.length || dv.getUint32(at, true) !== 0x02014b50)
      fail("This zip file's index is damaged.");
    const method = dv.getUint16(at + 10, true);
    const csize = dv.getUint32(at + 20, true);
    const nlen = dv.getUint16(at + 28, true);
    const xlen = dv.getUint16(at + 30, true);
    const clen = dv.getUint16(at + 32, true);
    const local = dv.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nlen));
    at += 46 + nlen + xlen + clen;
    if (name.endsWith("/") || /(^|\/)(__MACOSX|\.)/.test(name)) continue;
    if (local + 30 > bytes.length || dv.getUint32(local, true) !== 0x04034b50)
      fail("This zip file is damaged or cut short.");
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    if (start + csize > bytes.length) fail("This zip file is cut short: its last files are missing."); // prettier-ignore
    const raw = bytes.subarray(start, start + csize);
    let data;
    if (method === 0) data = raw;
    else if (method === 8) data = await inflate(raw, "deflate-raw");
    else fail(`This zip file uses compression method ${method}, which Splashery can't read. Zip it again with ordinary (Deflate) compression.`); // prettier-ignore
    if (!data) fail(`The file ${baseName(name)} in this zip is damaged.`);
    out.push({ name, bytes: data });
  }
  return out;
}

// ---- Assembling: slices into a volume, averaged down to fit ----------------------------------------

// How much to average each axis by (whole voxels), so the volume fits in `max` voxels: the axis
// whose averaged voxels are smallest grows first, so the result is as even as the file allows.
export function shrinkFactors(n, spacing, max = MAX_VOXELS) {
  const f = [1, 1, 1];
  const size = () => n.reduce((p, x, i) => p * Math.ceil(x / f[i]), 1);
  while (size() > max) {
    let best = -1;
    for (let i = 0; i < 3; i++) {
      if (Math.ceil(n[i] / f[i]) <= 1) continue;
      if (best < 0 || spacing[i] * f[i] < spacing[best] * f[best]) best = i;
    }
    if (best < 0) break;
    f[best]++;
  }
  return f;
}

// Builds a volume from slices: slice(z) gives slice z's values (nx * ny, x fastest) as a typed
// array, or a promise of one; scale and offset turn stored values into real ones.
async function assemble({ nx, ny, nz, slice, spacing, scale = 1, offset = 0, max = MAX_VOXELS }) {
  const f = shrinkFactors([nx, ny, nz], spacing, max);
  const [mx, my, mz] = [Math.ceil(nx / f[0]), Math.ceil(ny / f[1]), Math.ceil(nz / f[2])];
  const data = new Float32Array(mx * my * mz);
  const cnt = new Float32Array(mx * my * mz);
  for (let z = 0; z < nz; z++) {
    const s = await slice(z);
    if (!s || s.length < nx * ny) fail(`Slice ${z + 1} of ${nz} is cut short.`);
    const zo = Math.floor(z / f[2]) * mx * my;
    for (let y = 0; y < ny; y++) {
      const yo = zo + Math.floor(y / f[1]) * mx;
      const row = y * nx;
      for (let x = 0; x < nx; x++) {
        const v = s[row + x];
        if (!Number.isFinite(v)) continue;
        const o = yo + Math.floor(x / f[0]);
        data[o] += v;
        cnt[o]++;
      }
    }
  }
  let min = Infinity;
  let max2 = -Infinity;
  for (let i = 0; i < data.length; i++) {
    const v = cnt[i] ? (data[i] / cnt[i]) * scale + offset : NaN;
    data[i] = v;
    if (v < min) min = v;
    if (v > max2) max2 = v;
  }
  if (!(max2 >= min)) fail("This volume has no readable values.");
  for (let i = 0; i < data.length; i++) if (Number.isNaN(data[i])) data[i] = min;
  return {
    nx: mx,
    ny: my,
    nz: mz,
    data,
    spacing: spacing.map((s, i) => s * f[i]),
    min,
    max: max2,
    shrink: f,
  };
}

// The toy's axes for a volume's three index axes, from their directions in the toy's frame (right,
// up, toward the viewer): each index axis goes to the toy axis it is closest to.
export function viewAxes(dirs) {
  const used = new Set();
  const out = [];
  // The most clear-cut axes choose first.
  const order = [0, 1, 2].sort(
    (a, b) => Math.max(...dirs[b].map(Math.abs)) - Math.max(...dirs[a].map(Math.abs)),
  );
  const res = [];
  for (const i of order) {
    let best = -1;
    for (let k = 0; k < 3; k++)
      if (!used.has(k) && (best < 0 || Math.abs(dirs[i][k]) > Math.abs(dirs[i][best]))) best = k;
    used.add(best);
    res[i] = { axis: best, sign: dirs[i][best] < 0 ? -1 : 1 };
  }
  for (let i = 0; i < 3; i++) out.push(res[i]);
  return out;
}
// Without any orientation: x right, slices stacked upward, rows toward the viewer.
export const STACK_UP = [
  { axis: 0, sign: 1 },
  { axis: 2, sign: 1 },
  { axis: 1, sign: 1 },
];

// ---- NIfTI -----------------------------------------------------------------------------------------

const NIFTI_TYPES = {
  2: ["uint8", 1],
  4: ["int16", 2],
  8: ["int32", 4],
  16: ["float32", 4],
  64: ["float64", 8],
  128: ["rgb24", 3],
  256: ["int8", 1],
  512: ["uint16", 2],
  768: ["uint32", 4],
};
const UNIT_MM = { 1: 1000, 2: 1, 3: 0.001 }; // NIfTI xyzt_units: meters, millimeters, micrometers

// Reads n values of a type from bytes at an offset, as a typed array (copied when unaligned or the
// other byte order).
export function typedValues(bytes, offset, n, type, little = true) {
  const size = { uint8: 1, int8: 1, uint16: 2, int16: 2, uint32: 4, int32: 4, float32: 4, float64: 8 }[type]; // prettier-ignore
  if (!size) fail(`Values of type ${type} aren't supported.`);
  if (offset + n * size > bytes.length) return null;
  const Arr = { uint8: Uint8Array, int8: Int8Array, uint16: Uint16Array, int16: Int16Array, uint32: Uint32Array, int32: Int32Array, float32: Float32Array, float64: Float64Array }[type]; // prettier-ignore
  const abs = bytes.byteOffset + offset;
  if (size === 1) return new Arr(bytes.buffer, abs, n);
  const hostLittle = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
  if (little === hostLittle && abs % size === 0) return new Arr(bytes.buffer, abs, n);
  const copy = bytes.slice(offset, offset + n * size);
  if (little !== hostLittle)
    for (let i = 0; i < copy.length; i += size)
      for (let a = i, b = i + size - 1; a < b; a++, b--) [copy[a], copy[b]] = [copy[b], copy[a]];
  return new Arr(copy.buffer, 0, n);
}

export function readNifti(bytes, name = "") {
  if (bytes.length < 348) fail("This NIfTI file is cut short: its header is incomplete.");
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let le = true;
  let v2 = false;
  if (dv.getInt32(0, true) === 348) v2 = false;
  else if (dv.getInt32(0, false) === 348) le = false;
  else if (dv.getInt32(0, true) === 540) v2 = true;
  else if (dv.getInt32(0, false) === 540) [le, v2] = [false, true];
  else fail("This isn't a NIfTI file (its header size isn't 348 or 540).");
  if (v2 && bytes.length < 540) fail("This NIfTI-2 file is cut short: its header is incomplete.");
  const i16 = (o) => dv.getInt16(o, le);
  const i32 = (o) => dv.getInt32(o, le);
  const f32 = (o) => dv.getFloat32(o, le);
  const f64 = (o) => dv.getFloat64(o, le);
  const i64 = (o) => Number(dv.getBigInt64(o, le));
  let dim, pix, datatype, vox, slope, inter, qcode, scode, quat, qoff, srow, units;
  if (!v2) {
    dim = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => i16(40 + 2 * i));
    datatype = i16(70);
    pix = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => f32(76 + 4 * i));
    vox = f32(108);
    slope = f32(112);
    inter = f32(116);
    units = bytes[123];
    qcode = i16(252);
    scode = i16(254);
    quat = [f32(256), f32(260), f32(264)];
    qoff = [f32(268), f32(272), f32(276)];
    srow = [0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => f32(280 + 16 * r + 4 * c)));
  } else {
    datatype = i16(12);
    dim = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => i64(16 + 8 * i));
    pix = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => f64(104 + 8 * i));
    vox = i64(168);
    slope = f64(176);
    inter = f64(184);
    qcode = i32(344);
    scode = i32(348);
    quat = [f64(352), f64(360), f64(368)];
    qoff = [f64(376), f64(384), f64(392)];
    srow = [0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => f64(400 + 32 * r + 8 * c)));
    units = i32(500);
  }
  const nd = dim[0];
  if (!(nd >= 1 && nd <= 7)) fail("This NIfTI file's dimensions are damaged.");
  const [nx, ny, nz] = [1, 2, 3].map((i) => (i <= nd ? Math.max(1, dim[i]) : 1));
  if (nx < 2 || ny < 2) fail("This NIfTI file holds a single line of values, not a volume.");
  const t = NIFTI_TYPES[datatype];
  if (!t) fail(`This NIfTI file stores its values as data type ${datatype}, which Splashery can't read (it reads 8, 16 and 32-bit whole numbers, floats and RGB).`); // prettier-ignore
  const notes = [];
  const frames = nd >= 4 ? [4, 5, 6, 7].reduce((p, i) => p * (i <= nd ? Math.max(1, dim[i]) : 1), 1) : 1; // prettier-ignore
  if (frames > 1) notes.push(`It holds ${frames} volumes (a time series); showing the first.`);
  const um = UNIT_MM[units & 7] ?? 1;
  const spacing = [1, 2, 3].map((i) => {
    const s = Math.abs(pix[i]);
    return (Number.isFinite(s) && s > 0 ? s : 1) * um;
  });
  // Each index axis's direction in RAS (right, anterior, superior).
  let cols = null;
  if (scode > 0) cols = [0, 1, 2].map((c) => [0, 1, 2].map((r) => srow[r][c]));
  else if (qcode > 0) {
    const [b, c, d] = quat;
    const a = Math.sqrt(Math.max(0, 1 - (b * b + c * c + d * d)));
    const R = [
      [a * a + b * b - c * c - d * d, 2 * (b * c - a * d), 2 * (b * d + a * c)],
      [2 * (b * c + a * d), a * a + c * c - b * b - d * d, 2 * (c * d - a * b)],
      [2 * (b * d - a * c), 2 * (c * d + a * b), a * a + d * d - c * c - b * b],
    ];
    const qfac = pix[0] < 0 ? -1 : 1;
    cols = [0, 1, 2].map((ci) => [0, 1, 2].map((r) => R[r][ci] * (ci === 2 ? qfac : 1)));
  }
  void qoff;
  // RAS to the toy's frame: the patient's left on the right (as seen from the front), superior up,
  // anterior toward the viewer.
  const view = cols ? viewAxes(cols.map(([r, a, s]) => [-r, s, a])) : STACK_UP;
  const [type, size] = t;
  const start = Math.max(v2 ? 544 : 352, Math.round(vox) || 0);
  const per = nx * ny;
  const need = start + per * nz * size;
  if (bytes.length < need)
    fail(`This NIfTI file is cut short: ${nx} × ${ny} × ${nz} voxels need ${mb(need)}, and it has ${mb(bytes.length)}.`); // prettier-ignore
  const sl = !(slope > 0 || slope < 0) ? 1 : slope;
  const it = Number.isFinite(inter) ? inter : 0;
  return {
    meta: { nx, ny, nz, spacing, view, scale: sl, offset: it, notes, format: v2 ? "NIfTI-2" : "NIfTI-1", bits: type }, // prettier-ignore
    slice(z) {
      const o = start + z * per * size;
      if (type === "rgb24") return lumRGB(bytes, o, per);
      return typedValues(bytes, o, per, type, le);
    },
  };
}

const lumRGB = (b, o, n) => {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = 0.299 * b[o + 3 * i] + 0.587 * b[o + 3 * i + 1] + 0.114 * b[o + 3 * i + 2]; // prettier-ignore
  return out;
};

// ---- TIFF ------------------------------------------------------------------------------------------

// The pages (IFDs) of a TIFF file.
function tiffPages(bytes, name) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const le = bytes[0] === 0x49;
  const u16 = (o) => dv.getUint16(o, le);
  const u32 = (o) => dv.getUint32(o, le);
  const SIZES = {
    1: 1,
    2: 1,
    3: 2,
    4: 4,
    5: 8,
    6: 1,
    7: 1,
    8: 2,
    9: 4,
    10: 8,
    11: 4,
    12: 8,
    16: 8,
  };
  const pages = [];
  let at = u32(4);
  const seen = new Set();
  while (at && !seen.has(at)) {
    seen.add(at);
    if (at + 2 > bytes.length) fail(`${baseName(name)} is cut short: a page's header is missing.`);
    const n = u16(at);
    if (at + 2 + n * 12 + 4 > bytes.length) fail(`${baseName(name)} is cut short.`);
    const tags = {};
    for (let i = 0; i < n; i++) {
      const e = at + 2 + i * 12;
      const tag = u16(e);
      const type = u16(e + 2);
      const count = u32(e + 4);
      const sz = (SIZES[type] || 1) * count;
      const vo = sz <= 4 ? e + 8 : u32(e + 8);
      if (vo + sz > bytes.length) continue;
      const read = (k) => {
        const o = vo + k * (SIZES[type] || 1);
        if (type === 3) return u16(o);
        if (type === 4) return u32(o);
        if (type === 5) return u32(o) / (u32(o + 4) || 1);
        if (type === 8) return dv.getInt16(o, le);
        if (type === 9) return dv.getInt32(o, le);
        if (type === 11) return dv.getFloat32(o, le);
        if (type === 12) return dv.getFloat64(o, le);
        return bytes[o];
      };
      if (type === 2)
        tags[tag] = new TextDecoder("latin1").decode(bytes.subarray(vo, vo + count)).replace(/\0+$/, ""); // prettier-ignore
      else tags[tag] = Array.from({ length: Math.min(count, 1 << 20) }, (_, k) => read(k));
    }
    pages.push(tags);
    at = u32(at + 2 + n * 12);
  }
  return { le, pages };
}

function lzwDecode(src, size) {
  const out = new Uint8Array(size);
  let op = 0;
  let bit = 0;
  const dict = [];
  const reset = () => {
    dict.length = 258;
    for (let i = 0; i < 256; i++) dict[i] = [i];
  };
  reset();
  let width = 9;
  let prev = null;
  const total = src.length * 8;
  while (bit + width <= total) {
    let code = 0;
    for (let i = 0; i < width; i++) {
      const b = bit + i;
      code = (code << 1) | ((src[b >> 3] >> (7 - (b & 7))) & 1);
    }
    bit += width;
    if (code === 257) break;
    if (code === 256) {
      reset();
      width = 9;
      prev = null;
      continue;
    }
    let entry;
    if (code < dict.length) entry = dict[code];
    else if (prev) entry = prev.concat(prev[0]);
    else break;
    for (let i = 0; i < entry.length && op < size; i++) out[op++] = entry[i];
    if (prev) dict.push(prev.concat(entry[0]));
    prev = entry;
    if (dict.length + 1 >= 1 << width && width < 12) width++;
  }
  return out;
}

function packBits(src, size) {
  const out = new Uint8Array(size);
  let i = 0;
  let o = 0;
  while (i < src.length && o < size) {
    const n = (src[i++] << 24) >> 24;
    if (n >= 0) for (let k = 0; k <= n && o < size; k++) out[o++] = src[i++];
    else if (n !== -128) {
      const v = src[i++];
      for (let k = 0; k < 1 - n && o < size; k++) out[o++] = v;
    }
  }
  return out;
}

// A page's values (one sample per pixel, or the brightness of RGB), as a typed array.
async function tiffPage(bytes, le, t, name) {
  const w = t[256]?.[0];
  const h = t[257]?.[0];
  const bits = t[258]?.[0] ?? 1;
  const spp = t[277]?.[0] ?? 1;
  const comp = t[259]?.[0] ?? 1;
  const fmt = t[339]?.[0] ?? 1;
  const pred = t[317]?.[0] ?? 1;
  if (!w || !h) fail(`${baseName(name)} has no picture size.`);
  if (t[322]) fail(`${baseName(name)} is a tiled TIFF, which Splashery can't read yet. Save the stack as an ordinary (striped) TIFF, for example from ImageJ or Fiji.`); // prettier-ignore
  if (![8, 16, 32].includes(bits) || (fmt === 3 && bits !== 32))
    fail(`${baseName(name)} stores ${bits}-bit values, which Splashery can't read (it reads 8, 16 and 32-bit TIFFs).`); // prettier-ignore
  if ((t[284]?.[0] ?? 1) !== 1 && spp > 1) fail(`${baseName(name)} stores its colors in separate planes, which Splashery can't read.`); // prettier-ignore
  const bpp = (bits / 8) * spp;
  const rowBytes = w * bpp;
  const rps = t[278]?.[0] ?? h;
  const offs = t[273] || [];
  const counts = t[279] || [];
  const raw = new Uint8Array(rowBytes * h);
  for (let s = 0; s < offs.length; s++) {
    const rows = Math.min(rps, h - s * rps);
    if (rows <= 0) break;
    const want = rows * rowBytes;
    const o = offs[s];
    const c = counts[s] ?? want;
    if (o + Math.min(c, comp === 1 ? want : c) > bytes.length) fail(`${baseName(name)} is cut short: its pictures are incomplete.`); // prettier-ignore
    const src = bytes.subarray(o, o + c);
    let strip;
    if (comp === 1) strip = src.subarray(0, want);
    else if (comp === 5) strip = lzwDecode(src, want);
    else if (comp === 8 || comp === 32946) strip = await inflate(src, "deflate");
    else if (comp === 32773) strip = packBits(src, want);
    else fail(`${baseName(name)} is compressed with TIFF method ${comp}, which Splashery can't read. Save it uncompressed or with LZW or Deflate.`); // prettier-ignore
    if (!strip) fail(`${baseName(name)} is damaged: a strip doesn't decompress.`);
    raw.set(strip.subarray(0, want), s * rps * rowBytes);
  }
  if (pred === 2) {
    // Horizontal differencing (8 and 16 bits).
    const sz = bits / 8;
    for (let y = 0; y < h; y++)
      for (let x = spp; x < w * spp; x++) {
        const o = y * rowBytes + x * sz;
        if (sz === 1) raw[o] = (raw[o] + raw[o - spp]) & 255;
        else {
          const a = le ? raw[o] | (raw[o + 1] << 8) : (raw[o] << 8) | raw[o + 1];
          const p = o - spp * sz;
          const b = le ? raw[p] | (raw[p + 1] << 8) : (raw[p] << 8) | raw[p + 1];
          const v = (a + b) & 0xffff;
          if (le) [raw[o], raw[o + 1]] = [v & 255, v >> 8];
          else [raw[o], raw[o + 1]] = [v >> 8, v & 255];
        }
      }
  }
  const type = fmt === 3 ? "float32" : `${fmt === 2 ? "int" : "uint"}${bits}`;
  const vals = typedValues(raw, 0, w * h * spp, type, le);
  if (spp === 1) return vals;
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * spp;
    out[i] = spp >= 3 ? 0.299 * vals[o] + 0.587 * vals[o + 1] + 0.114 * vals[o + 2] : vals[o];
  }
  return out;
}

// ImageJ's description: "spacing=2.5", "unit=micron".
function imagejSpacing(t) {
  const d = String(t[270] || "");
  const unitWord = /unit=([^\n]+)/.exec(d)?.[1]?.trim() || "";
  const unit = /^(micron|µm|um|\\u00B5m)$/i.test(unitWord) ? 0.001 : /^mm$/i.test(unitWord) ? 1 : /^cm$/i.test(unitWord) ? 10 : /^nm$/i.test(unitWord) ? 1e-6 : null; // prettier-ignore
  const z = Number(/spacing=([0-9.eE+-]+)/.exec(d)?.[1]);
  const xr = t[282]?.[0];
  const yr = t[283]?.[0];
  const ru = t[296]?.[0] ?? 2;
  // Without ImageJ's unit, the resolution unit says inches (2) or centimeters (3); 72 per inch
  // is a picture's default, not a measurement.
  let u = unit;
  if (u == null && ru === 3 && xr > 1) u = 10;
  if (u == null) return null;
  const x = xr > 0 ? 1 / xr : 1;
  const y = yr > 0 ? 1 / yr : x;
  return [x * u, y * u, (Number.isFinite(z) && z > 0 ? z : x) * u];
}

async function readTiffs(files) {
  files = files.slice().sort(naturalSort);
  const pages = [];
  for (const f of files) {
    if (isBigTiff(f.bytes)) fail(`${baseName(f.name)} is a BigTIFF, which Splashery can't read yet. Save the stack as ordinary TIFF files, one per slice.`); // prettier-ignore
    const { le, pages: ps } = tiffPages(f.bytes, f.name);
    // Skip reduced-size pages (thumbnails) after the first.
    for (const p of ps) if (!((p[254]?.[0] ?? 0) & 1)) pages.push({ f, le, t: p });
  }
  if (!pages.length) fail("This TIFF has no pictures.");
  const w = pages[0].t[256]?.[0];
  const h = pages[0].t[257]?.[0];
  const odd = pages.findIndex((p) => p.t[256]?.[0] !== w || p.t[257]?.[0] !== h);
  if (odd >= 0) fail(`The slices aren't all the same size: ${baseName(pages[odd].f.name)} is ${pages[odd].t[256]?.[0]} × ${pages[odd].t[257]?.[0]}, the first is ${w} × ${h}.`); // prettier-ignore
  const spacing = imagejSpacing(pages[0].t);
  const notes = [];
  if (!spacing) notes.push("The file doesn't say its voxel size; each voxel is drawn as a cube. Set the spacing with the raw form if it should differ."); // prettier-ignore
  if (pages.length < 2) notes.push("It holds one picture, drawn as a single slice.");
  const bits = pages[0].t[258]?.[0] ?? 8;
  return {
    meta: { nx: w, ny: h, nz: pages.length, spacing: spacing || [1, 1, 1], view: STACK_UP, notes, format: files.length > 1 ? `TIFF stack (${files.length} files)` : "TIFF stack", bits: `${bits}-bit`, unknownSpacing: !spacing }, // prettier-ignore
    slice: (z) => tiffPage(pages[z].f.bytes, pages[z].le, pages[z].t, pages[z].f.name),
  };
}

// ---- Raw -------------------------------------------------------------------------------------------

export const RAW_TYPES = ["uint8", "int8", "uint16", "int16", "uint32", "int32", "float32", "float64"]; // prettier-ignore
const RAW_SIZE = { uint8: 1, int8: 1, uint16: 2, int16: 2, uint32: 4, int32: 4, float32: 4, float64: 8 }; // prettier-ignore

// raw: { size: [nx, ny, nz], type, little, spacing: [x, y, z] (mm), header (bytes, or "auto") }.
export function parseRawForm(raw) {
  const nums = (s, n) =>
    String(s ?? "")
      .split(/[\s,x×*]+/i)
      .filter(Boolean)
      .map(Number)
      .slice(0, n);
  const size = Array.isArray(raw.size) ? raw.size : nums(raw.size, 3);
  if (size.length !== 3 || !size.every((v) => Number.isInteger(v) && v > 0))
    fail("Give the volume's size as three whole numbers: columns, rows and slices (for example 256 256 128)."); // prettier-ignore
  const spacing = Array.isArray(raw.spacing) ? raw.spacing : nums(raw.spacing || "1 1 1", 3);
  if (spacing.length !== 3 || !spacing.every((v) => v > 0))
    fail("Give the voxel size as three positive numbers in millimeters (for example 0.5 0.5 1.25)."); // prettier-ignore
  if (!RAW_SIZE[raw.type]) fail(`Pick the value type (one of ${RAW_TYPES.join(", ")}).`);
  const header = raw.header === "auto" || raw.header === "" || raw.header == null ? "auto" : Number(raw.header); // prettier-ignore
  if (header !== "auto" && !(Number.isInteger(header) && header >= 0))
    fail("The header length is a whole number of bytes (0 for none).");
  return { size, spacing, type: raw.type, little: raw.little !== false, header };
}

function readRaw(f, raw) {
  const r = parseRawForm(raw);
  const [nx, ny, nz] = r.size;
  const sz = RAW_SIZE[r.type];
  const need = nx * ny * nz * sz;
  const header = r.header === "auto" ? f.bytes.length - need : r.header;
  if (header < 0 || f.bytes.length < header + need)
    fail(`This file has ${f.bytes.length.toLocaleString("en-US")} bytes, but ${nx} × ${ny} × ${nz} voxels of ${r.type} need ${need.toLocaleString("en-US")}${r.header === "auto" || !header ? "" : ` after a ${header}-byte header`}. Check the size and the value type.`); // prettier-ignore
  const notes = header > 0 ? [`Skipped a header of ${header.toLocaleString("en-US")} bytes.`] : [];
  return {
    meta: { nx, ny, nz, spacing: r.spacing, view: STACK_UP, notes, format: "Raw", bits: r.type },
    slice: (z) => typedValues(f.bytes, header + z * nx * ny * sz, nx * ny, r.type, r.little),
  };
}

// ---- DICOM -----------------------------------------------------------------------------------------

let dicomLib = null;
// dicom-parser is a classic script (it sets dicomParser): a script tag in a browser, read from disk
// in Node (the tests).
export async function loadDicomParser() {
  if (dicomLib) return dicomLib;
  if (globalThis.dicomParser) return (dicomLib = globalThis.dicomParser);
  const url = new URL("../../vendor/dicom-parser/dicomParser.min.js", import.meta.url);
  if (url.protocol === "file:") {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile(url, "utf8");
    const module = { exports: {} };
    new Function("module", "exports", "require", src)(module, module.exports, () => ({}));
    return (dicomLib = module.exports);
  }
  if (typeof document === "undefined") {
    globalThis.importScripts?.(url.href);
    if (globalThis.dicomParser) return (dicomLib = globalThis.dicomParser);
    fail("The DICOM reader didn't load.");
  }
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = url.href;
    s.onload = resolve;
    s.onerror = () => reject(new VolumeError("The DICOM reader didn't load. Check the connection and try again.")); // prettier-ignore
    document.head.appendChild(s);
  });
  if (!globalThis.dicomParser) fail("The DICOM reader didn't load.");
  return (dicomLib = globalThis.dicomParser);
}

const TS = {
  "1.2.840.10008.1.2": "implicit",
  "1.2.840.10008.1.2.1": "explicit",
  "1.2.840.10008.1.2.2": "big",
  "1.2.840.10008.1.2.5": "rle",
};
const TS_NAMES = {
  "1.2.840.10008.1.2.1.99": "Deflate",
  "1.2.840.10008.1.2.4.50": "JPEG Baseline",
  "1.2.840.10008.1.2.4.51": "JPEG Extended",
  "1.2.840.10008.1.2.4.57": "JPEG Lossless",
  "1.2.840.10008.1.2.4.70": "JPEG Lossless",
  "1.2.840.10008.1.2.4.80": "JPEG-LS Lossless",
  "1.2.840.10008.1.2.4.81": "JPEG-LS",
  "1.2.840.10008.1.2.4.90": "JPEG 2000 Lossless",
  "1.2.840.10008.1.2.4.91": "JPEG 2000",
  "1.2.840.10008.1.2.4.201": "HTJ2K Lossless",
  "1.2.840.10008.1.2.4.202": "HTJ2K Lossless RPCL",
  "1.2.840.10008.1.2.4.203": "HTJ2K",
};

const nums = (s) =>
  String(s ?? "")
    .split("\\")
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isFinite(x));

// RLE Lossless (DICOM PS3.5 G): one frame's segments, one per byte of each sample.
function rleFrame(frag, n, bytesPer) {
  const dv = new DataView(frag.buffer, frag.byteOffset, frag.byteLength);
  const segs = dv.getUint32(0, true);
  if (segs !== bytesPer) fail(`An RLE frame has ${segs} segments; Splashery reads grayscale ones only.`); // prettier-ignore
  const out = new Uint8Array(n * bytesPer);
  for (let s = 0; s < segs; s++) {
    const start = dv.getUint32(4 + 4 * s, true);
    const end = s + 1 < segs ? dv.getUint32(8 + 4 * s, true) : frag.length;
    const dec = packBits(frag.subarray(start, end), n);
    // Segment 0 holds the most significant bytes; little-endian output.
    const at = bytesPer - 1 - s;
    for (let i = 0; i < n; i++) out[i * bytesPer + at] = dec[i];
  }
  return out;
}

// One DICOM file's facts and its frames.
function parseDicomFile(lib, f) {
  let ds;
  try {
    ds = lib.parseDicom(f.bytes);
  } catch (e) {
    const msg = String(e?.exception || e?.message || e);
    if (/buffer overread|beyond|end of|overrun/i.test(msg)) fail(`${baseName(f.name)} is cut short (the DICOM reader ran off its end).`); // prettier-ignore
    fail(`${baseName(f.name)} isn't a DICOM file Splashery can read (${msg.slice(0, 120)}).`);
  }
  const s = (tag) => ds.string(tag);
  const u16 = (tag) => ds.uint16(tag);
  const ts = s("x00020010") || "1.2.840.10008.1.2";
  const kind = TS[ts];
  const pixel = ds.elements.x7fe00010;
  if (!pixel) return { skip: `${baseName(f.name)} has no picture (a report or index file).` };
  if (!kind)
    fail(`These slices are compressed with ${TS_NAMES[ts] || `transfer syntax ${ts}`}, which Splashery can't read yet. Save them uncompressed (for example with dcmdjpeg or gdcmconv --raw) and open them again.`); // prettier-ignore
  const rows = u16("x00280010");
  const cols = u16("x00280011");
  const bits = u16("x00280100") || 16;
  const signed = u16("x00280103") === 1;
  const spp = u16("x00280002") || 1;
  const frames = Number(s("x00280008")) || 1;
  if (!rows || !cols) fail(`${baseName(f.name)} has no picture size.`);
  if (![8, 16, 32].includes(bits)) fail(`${baseName(f.name)} stores ${bits}-bit values, which Splashery can't read.`); // prettier-ignore
  // Rescale: plain, or in the shared functional groups of an enhanced (multi-frame) file.
  const seqItem = (tag, inner) => ds.elements[tag]?.items?.[0]?.dataSet?.elements?.[inner]?.items?.[0]?.dataSet; // prettier-ignore
  const shared = (inner) => seqItem("x52009229", inner);
  const pvt = shared("x00289145");
  let slope = Number(s("x00281053") ?? pvt?.string("x00281053"));
  let inter = Number(s("x00281052") ?? pvt?.string("x00281052"));
  if (!Number.isFinite(slope) || slope === 0) slope = 1;
  if (!Number.isFinite(inter)) inter = 0;
  const measures = shared("x00289110");
  const px = nums(s("x00280030") ?? measures?.string("x00280030"));
  const orient = nums(s("x00200037") ?? shared("x00209116")?.string("x00200037"));
  const thick = Number(s("x00180050") ?? measures?.string("x00180050"));
  const between = Number(s("x00180088") ?? measures?.string("x00180088"));
  const pos = nums(s("x00200032"));
  // Per-frame positions (enhanced multi-frame).
  const perFrame = ds.elements.x52009230?.items || [];
  const framePos = perFrame.map((it) => nums(it.dataSet?.elements?.x00209113?.items?.[0]?.dataSet?.string("x00200032"))); // prettier-ignore
  const modality = s("x00080060") || "";
  const n = rows * cols;
  const bytesPer = (bits / 8) * spp;
  const little = kind !== "big";
  const frameBytes = (i) => {
    if (kind === "rle") {
      const frag = pixel.basicOffsetTable?.length
        ? lib.readEncapsulatedImageFrame(ds, pixel, i)
        : frames > 1 && pixel.fragments?.length === frames
          ? lib.readEncapsulatedPixelDataFromFragments(ds, pixel, i, 1)
          : frames === 1
            ? lib.readEncapsulatedPixelDataFromFragments(ds, pixel, 0, pixel.fragments.length)
            : null;
      if (!frag) fail("This RLE file's pixel data is damaged.");
      return rleFrame(frag, n * spp, bits / 8);
    }
    if (pixel.encapsulatedPixelData) fail(`${baseName(f.name)} has compressed pixels under an uncompressed transfer syntax; it is damaged.`); // prettier-ignore
    const o = pixel.dataOffset + i * n * bytesPer;
    if (o + n * bytesPer > f.bytes.length) fail(`${baseName(f.name)} is cut short: its picture is incomplete.`); // prettier-ignore
    return f.bytes.subarray(o, o + n * bytesPer);
  };
  const type = `${signed ? "int" : "uint"}${bits}`;
  const frameValues = (i) => {
    const b = frameBytes(i);
    const le = kind === "rle" ? true : little;
    const vals = typedValues(b, 0, n * spp, bits === 8 ? (signed ? "int8" : "uint8") : type, le);
    if (!vals) fail(`${baseName(f.name)} is cut short: its picture is incomplete.`);
    if (spp === 1) return vals;
    const out = new Float32Array(n);
    for (let k = 0; k < n; k++) out[k] = 0.299 * vals[k * spp] + 0.587 * vals[k * spp + 1] + 0.114 * vals[k * spp + 2]; // prettier-ignore
    return out;
  };
  return {
    file: f,
    rows,
    cols,
    frames,
    slope,
    inter,
    px,
    orient,
    thick,
    between,
    pos,
    framePos,
    modality,
    bits: `${bits}-bit`,
    series: s("x0020000e") || "",
    instance: Number(s("x00200013")) || 0,
    frameValues,
  };
}

const sub = (a, b) => a.map((x, i) => x - b[i]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; // prettier-ignore
const median = (v) => {
  const s = v.slice().sort((a, b) => a - b);
  return s.length ? s[s.length >> 1] : NaN;
};

async function readDicom(files) {
  const lib = await loadDicomParser();
  const parsed = [];
  const skipped = [];
  for (const f of files) {
    const p = parseDicomFile(lib, f);
    if (p.skip) skipped.push(p.skip);
    else parsed.push(p);
  }
  if (!parsed.length) fail(skipped[0] || "These DICOM files hold no pictures.");
  // Several series: the biggest one.
  const bySeries = new Map();
  for (const p of parsed) {
    const k = `${p.series}|${p.rows}x${p.cols}|${p.orient.join(",")}`;
    if (!bySeries.has(k)) bySeries.set(k, []);
    bySeries.get(k).push(p);
  }
  const groups = [...bySeries.values()].sort(
    (a, b) => b.reduce((s, p) => s + p.frames, 0) - a.reduce((s, p) => s + p.frames, 0),
  );
  const group = groups[0];
  const notes = [];
  if (groups.length > 1) notes.push(`The files hold ${groups.length} series; showing the biggest (${group.length} files).`); // prettier-ignore
  const first = group[0];
  const r = first.orient.length === 6 ? first.orient.slice(0, 3) : [1, 0, 0];
  const c = first.orient.length === 6 ? first.orient.slice(3, 6) : [0, 1, 0];
  const normal = cross(r, c);
  // Every frame with its place along the normal.
  const slices = [];
  for (const p of group)
    for (let i = 0; i < p.frames; i++) {
      const pos = p.frames > 1 ? p.framePos[i] : p.pos;
      slices.push({ p, i, pos: pos?.length === 3 ? pos : null, inst: p.instance + i / 1000 });
    }
  const placed = slices.every((s) => s.pos);
  if (placed) slices.sort((a, b) => dot(a.pos, normal) - dot(b.pos, normal));
  else slices.sort((a, b) => a.inst - b.inst);
  let dz = NaN;
  if (placed && slices.length > 1) {
    const gaps = [];
    for (let k = 1; k < slices.length; k++) gaps.push(dot(sub(slices[k].pos, slices[k - 1].pos), normal)); // prettier-ignore
    dz = median(gaps);
    if (dz > 0 && gaps.some((g) => Math.abs(g - dz) > 0.05 * dz + 0.01)) notes.push("The slices are unevenly spaced; drawn at their typical spacing."); // prettier-ignore
    if (!(dz > 0)) notes.push("Some slices share a place (repeated slices); drawn one after another."); // prettier-ignore
  }
  if (!(dz > 0)) dz = first.between > 0 ? first.between : first.thick > 0 ? first.thick : NaN;
  if (!(dz > 0)) {
    dz = first.px[1] || 1;
    if (slices.length > 1) notes.push("The files don't say how far apart the slices are; drawn as cubes."); // prettier-ignore
  }
  const spacing = [first.px[1] || 1, first.px[0] || 1, dz];
  if (!first.px.length) notes.push("The files don't give a pixel size; drawn in voxels.");
  // LPS to the toy's frame: the patient's left on the right, superior up, anterior toward the viewer.
  const toView = ([x, y, z]) => [x, z, -y];
  const view = viewAxes([toView(r), toView(c), toView(normal)]);
  const ct = /^CT$/i.test(first.modality);
  return {
    meta: {
      nx: first.cols,
      ny: first.rows,
      nz: slices.length,
      spacing,
      view,
      scale: 1,
      offset: 0,
      notes: skipped.length ? [...notes, `Skipped ${skipped.length} file${skipped.length > 1 ? "s" : ""} without pictures.`] : notes, // prettier-ignore
      format: group.length > 1 ? `DICOM series (${group.length} files)` : first.frames > 1 ? "DICOM (multi-frame)" : "DICOM", // prettier-ignore
      modality: first.modality,
      unit: ct ? "HU" : "",
      bits: first.bits,
    },
    slice(z) {
      const sl = slices[z];
      const v = sl.p.frameValues(sl.i);
      if (sl.p.slope === 1 && sl.p.inter === 0) return v;
      const out = new Float32Array(v.length);
      for (let k = 0; k < v.length; k++) out[k] = v[k] * sl.p.slope + sl.p.inter;
      return out;
    },
  };
}

// ---- The entry point -------------------------------------------------------------------------------

const KNOWN = "DICOM (.dcm, a folder or a .zip of slices), NIfTI (.nii, .nii.gz), a TIFF stack (.tif) or a raw volume (.raw with the form)"; // prettier-ignore

// files: [{ name, bytes: Uint8Array }]. raw: the raw form's answers, used for files that aren't
// another format. max: the most voxels to keep.
export async function readVolume(files, { raw = null, max = MAX_VOXELS, name = "" } = {}) {
  if (!files?.length) fail("Open a volume file first.");
  let list = [];
  for (const f of files) {
    let b = f.bytes;
    if (!b?.length) fail(`${baseName(f.name)} is empty.`);
    if (isZip(b)) {
      const inner = await unzip(b);
      list.push(...inner);
      continue;
    }
    if (isGzip(b)) {
      const g = await inflate(b, "gzip");
      if (!g) fail(`${baseName(f.name)} is a damaged or cut-short gzip file.`);
      b = g;
    }
    list.push({ name: f.name, bytes: b });
  }
  // A DICOM folder's index (DICOMDIR) and stray files are skipped.
  list = list.filter((f) => !/^dicomdir$/i.test(baseName(f.name)) && !/\.(txt|md|json|xml|html?|pdf|png|jpe?g|gif|db|ini|ds_store)$/i.test(f.name)); // prettier-ignore
  if (!list.length) fail("There are no volume files in what was opened.");
  const kindOf = (f) => {
    const b = f.bytes;
    if (isDicom(b)) return "dicom";
    if (isNifti(b) && /nii|hdr|img|^$/.test(extOf(f.name).replace("nii.gz", "nii"))) return "nifti"; // prettier-ignore
    if (isNifti(b)) return "nifti";
    if (isTiff(b) || isBigTiff(b)) return "tiff";
    const e = extOf(f.name);
    if (e === "dcm" || e === "dicom" || e === "ima" || looksLikeBareDicom(b)) return "dicom";
    return "other";
  };
  const kinds = list.map(kindOf);
  const main = ["dicom", "nifti", "tiff"].find((k) => kinds.includes(k)) || "other";
  let src;
  if (main === "dicom")
    src = await readDicom(list.filter((_, i) => kinds[i] === "dicom" || kinds[i] === "other")); // prettier-ignore
  else if (main === "nifti") {
    const f = list[kinds.indexOf("nifti")];
    src = readNifti(f.bytes, f.name);
  } else if (main === "tiff") src = await readTiffs(list.filter((_, i) => kinds[i] === "tiff"));
  else if (raw) src = readRaw(list[0], raw);
  else {
    const e = extOf(list[0].name);
    if (["raw", "bin", "img", "vol", "dat"].includes(e))
      fail("A raw volume has no header to say its size: fill in the raw volume form below (size, value type and voxel size), then open it again."); // prettier-ignore
    fail(`Splashery can't tell what ${baseName(list[0].name)} is. It opens ${KNOWN}.`);
  }
  const m = src.meta;
  if (m.nx * m.ny * m.nz < 8) fail("This volume is too small to show (fewer than 8 voxels).");
  const v = await assemble({ nx: m.nx, ny: m.ny, nz: m.nz, slice: src.slice, spacing: m.spacing, scale: m.scale ?? 1, offset: m.offset ?? 0, max }); // prettier-ignore
  const notes = [...(m.notes || [])];
  if (v.shrink.some((x) => x > 1)) notes.push(`Averaged down ${v.shrink.join(" × ")} to fit this device's memory.`); // prettier-ignore
  return {
    ...v,
    view: m.view,
    unit: m.unit || "",
    modality: m.modality || "",
    format: m.format,
    bits: m.bits,
    name: name || baseName(files.length > 1 ? files[0].name.split(/[\\/]/).slice(-2, -1)[0] || files[0].name : files[0].name), // prettier-ignore
    source: { nx: m.nx, ny: m.ny, nz: m.nz, spacing: m.spacing },
    unknownSpacing: !!m.unknownSpacing,
    notes,
  };
}

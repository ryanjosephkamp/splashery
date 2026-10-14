// Lane Volume viewer: makes the small test volumes in tests/fixtures/vol/ (run with node).
//
// Every file holds the same phantom, so the tests can check each reader against it: a CT-like
// block of 24 columns × 20 rows × 12 slices, 0.5 mm × 0.5 mm in each slice and 2 mm between
// slices (an anisotropic scan: 12 mm wide, 10 mm deep and 24 mm tall). Air is -1000 HU, an
// ellipsoid of soft tissue (40 HU) fills it, and a ball of bone (1000 HU) sits off center, toward
// the first column, the first row and the last slice, so the tests can see that the axes and
// their directions come out right. Files:
//
//   dicom-series/   12 slices, explicit VR little endian, shuffled names, stored values 0..2024
//                   with RescaleIntercept -1024 (as CT scanners store them)
//   dicom-series.zip the same slices in a zip
//   dicom-implicit.dcm  one slice in implicit VR (the oldest kind)
//   dicom-multiframe.dcm  all 12 slices in one enhanced multi-frame file (per-frame positions)
//   dicom-jpeg.dcm  one slice that says it is JPEG Lossless (which the reader names and refuses)
//   dicom-rle.dcm   all 12 slices, RLE Lossless, one fragment per frame (spacing between slices)
//   phantom.nii     NIfTI-1, int16, with an sform; phantom.nii.gz the same, gzipped
//   phantom-nifti2.nii  NIfTI-2, float32, big endian
//   phantom.tif     a 16-bit multi-page TIFF with ImageJ's spacing (unsigned, value + 1024)
//   tiff-stack/     12 single-page 8-bit TIFFs, PackBits and Deflate (values scaled to 0..255)
//   phantom.raw     uint16, big endian, after a 64-byte header
//   phantom.json    the phantom's facts, for the tests

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const OUT = new URL("../tests/fixtures/vol/", import.meta.url).pathname;
const NX = 24;
const NY = 20;
const NZ = 12;
const SP = [0.5, 0.5, 2];
const BONE = [6, 5, 8]; // the bone ball's center (voxels)

export function phantom(x, y, z) {
  const p = [(x + 0.5) * SP[0], (y + 0.5) * SP[1], (z + 0.5) * SP[2]];
  const c = [(NX * SP[0]) / 2, (NY * SP[1]) / 2, (NZ * SP[2]) / 2];
  const r = [5.5, 4.5, 11];
  const e = ((p[0] - c[0]) / r[0]) ** 2 + ((p[1] - c[1]) / r[1]) ** 2 + ((p[2] - c[2]) / r[2]) ** 2;
  if (e > 1) return -1000;
  const b = [(BONE[0] + 0.5) * SP[0], (BONE[1] + 0.5) * SP[1], (BONE[2] + 0.5) * SP[2]];
  if (Math.hypot(p[0] - b[0], p[1] - b[1], p[2] - b[2]) < 2.2) return 1000;
  return 40;
}
const HU = new Int16Array(NX * NY * NZ);
for (let z = 0; z < NZ; z++)
  for (let y = 0; y < NY; y++)
    for (let x = 0; x < NX; x++) HU[(z * NY + y) * NX + x] = phantom(x, y, z);
const slice = (z) => HU.subarray(z * NX * NY, (z + 1) * NX * NY);

// ---- DICOM -----------------------------------------------------------------------------------------

const LONG_VR = new Set(["OB", "OW", "OF", "SQ", "UT", "UN"]);
function pad(bytes, vr) {
  if (bytes.length % 2 === 0) return bytes;
  const p = new Uint8Array(bytes.length + 1);
  p.set(bytes);
  p[bytes.length] = vr === "UI" || vr === "OB" ? 0 : 0x20;
  return p;
}
const str = (s) => new TextEncoder().encode(s);
const u16le = (v) => new Uint8Array(new Uint16Array([v]).buffer);
const cat = (parts) => {
  const n = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};
// An element: tag "GGGGEEEE", its VR and value (bytes, or a string). explicit: explicit VR.
function el(tag, vr, value, explicit = true, undefinedLength = false) {
  const v = pad(typeof value === "string" ? str(value) : value, vr);
  const g = parseInt(tag.slice(0, 4), 16);
  const e = parseInt(tag.slice(4), 16);
  const head = new DataView(new ArrayBuffer(12));
  head.setUint16(0, g, true);
  head.setUint16(2, e, true);
  const len = undefinedLength ? 0xffffffff : v.length;
  let h;
  if (!explicit) {
    head.setUint32(4, len, true);
    h = new Uint8Array(head.buffer, 0, 8);
  } else if (LONG_VR.has(vr)) {
    head.setUint8(4, vr.charCodeAt(0));
    head.setUint8(5, vr.charCodeAt(1));
    head.setUint32(8, len, true);
    h = new Uint8Array(head.buffer, 0, 12);
  } else {
    head.setUint8(4, vr.charCodeAt(0));
    head.setUint8(5, vr.charCodeAt(1));
    head.setUint16(6, len, true);
    h = new Uint8Array(head.buffer, 0, 8);
  }
  return cat([h, v]);
}
const item = (bytes) => {
  const h = new DataView(new ArrayBuffer(8));
  h.setUint16(0, 0xfffe, true);
  h.setUint16(2, 0xe000, true);
  h.setUint32(4, bytes.length, true);
  return cat([new Uint8Array(h.buffer), bytes]);
};
const seq = (tag, items) => el(tag, "SQ", cat(items.map(item)));
const seqDelim = () => {
  const h = new DataView(new ArrayBuffer(8));
  h.setUint16(0, 0xfffe, true);
  h.setUint16(2, 0xe0dd, true);
  return new Uint8Array(h.buffer);
};

function dicomFile(ts, body, explicit = true) {
  const metaBody = cat([
    el("00020001", "OB", new Uint8Array([0, 1])),
    el("00020002", "UI", "1.2.840.10008.5.1.4.1.1.2"),
    el("00020003", "UI", `1.2.826.0.1.3680043.10.1.${Math.floor(Math.random() * 1e9)}`),
    el("00020010", "UI", ts),
    el("00020012", "UI", "1.2.826.0.1.3680043.10.1"),
  ]);
  const len = new Uint8Array(new Uint32Array([metaBody.length]).buffer);
  const meta = cat([el("00020000", "UL", len), metaBody]);
  void explicit;
  return cat([new Uint8Array(128), str("DICM"), meta, body]);
}

const stored = (z) => {
  const s = slice(z);
  const out = new Uint16Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s[i] + 1024;
  return new Uint8Array(out.buffer);
};
const ORIENT = "1\\0\\0\\0\\1\\0"; // rows run along +x (left), columns along +y (posterior)
// Slices go from the feet up (+z superior), as an axial CT: the last slice is the top.
const posOf = (z) => `-6\\-5\\${(-12 + z * SP[2] + 1).toFixed(2)}`;

function imageHeader(explicit, extra = []) {
  const e = (t, vr, v) => el(t, vr, v, explicit);
  return [
    e("00080060", "CS", "CT"),
    e("00180050", "DS", "2"),
    e("0020000E", "UI", "1.2.826.0.1.3680043.10.1.77"),
    ...extra,
    e("00280002", "US", u16le(1)),
    e("00280004", "CS", "MONOCHROME2"),
    e("00280010", "US", u16le(NY)),
    e("00280011", "US", u16le(NX)),
    e("00280030", "DS", `${SP[1]}\\${SP[0]}`),
    e("00280100", "US", u16le(16)),
    e("00280101", "US", u16le(16)),
    e("00280102", "US", u16le(15)),
    e("00280103", "US", u16le(0)),
    e("00281052", "DS", "-1024"),
    e("00281053", "DS", "1"),
  ];
}

function seriesSlice(z, explicit = true) {
  const e = (t, vr, v) => el(t, vr, v, explicit);
  const body = cat([
    ...imageHeader(explicit, [
      e("00200013", "IS", String(z + 1)),
      e("00200032", "DS", posOf(z)),
      e("00200037", "DS", ORIENT),
    ]),
    e("7FE00010", "OW", stored(z)),
  ]);
  return dicomFile(explicit ? "1.2.840.10008.1.2.1" : "1.2.840.10008.1.2", body, explicit);
}

function multiframe() {
  const perFrame = [];
  for (let z = 0; z < NZ; z++) perFrame.push(seq("00209113", [el("00200032", "DS", posOf(z))]));
  const shared = cat([
    seq("00289110", [cat([el("00180050", "DS", "2"), el("00280030", "DS", `${SP[1]}\\${SP[0]}`)])]),
    seq("00209116", [el("00200037", "DS", ORIENT)]),
    seq("00289145", [cat([el("00281052", "DS", "-1024"), el("00281053", "DS", "1")])]),
  ]);
  // Frames are written top to bottom, so the reader has to sort them by place.
  const order = [...Array(NZ).keys()].reverse();
  const pixels = cat(order.map(stored));
  const body = cat([
    el("00080060", "CS", "CT"),
    el("0020000E", "UI", "1.2.826.0.1.3680043.10.1.78"),
    el("00280002", "US", u16le(1)),
    el("00280004", "CS", "MONOCHROME2"),
    el("00280008", "IS", String(NZ)),
    el("00280010", "US", u16le(NY)),
    el("00280011", "US", u16le(NX)),
    el("00280100", "US", u16le(16)),
    el("00280101", "US", u16le(16)),
    el("00280102", "US", u16le(15)),
    el("00280103", "US", u16le(0)),
    seq("52009229", [shared]),
    seq(
      "52009230",
      order.map((z) => perFrame[z]),
    ),
    el("7FE00010", "OW", pixels),
  ]);
  return dicomFile("1.2.840.10008.1.2.1", body);
}

function jpegBody() {
  return cat([
    ...imageHeader(true, [el("00200032", "DS", posOf(0)), el("00200037", "DS", ORIENT)]),
    el("7FE00010", "OB", new Uint8Array(0), true, true),
    item(new Uint8Array(0)),
    item(new Uint8Array([0xff, 0xd8, 0xff, 0xd9])),
    seqDelim(),
  ]);
}

// PackBits, literal runs only (enough for a test).
function packLiteral(bytes) {
  const out = [];
  for (let i = 0; i < bytes.length; i += 128) {
    const run = bytes.subarray(i, i + 128);
    out.push(run.length - 1, ...run);
  }
  if (out.length % 2) out.push(0x80); // a no-op byte keeps the segment even
  return Uint8Array.from(out);
}

function rle() {
  const frags = [];
  for (let z = 0; z < NZ; z++) {
    const s = stored(z);
    const n = NX * NY;
    const hi = new Uint8Array(n);
    const lo = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      lo[i] = s[2 * i];
      hi[i] = s[2 * i + 1];
    }
    const a = packLiteral(hi);
    const b = packLiteral(lo);
    const header = new Uint32Array(16);
    header[0] = 2;
    header[1] = 64;
    header[2] = 64 + a.length;
    frags.push(cat([new Uint8Array(header.buffer), a, b]));
  }
  const pixel = cat([
    el("7FE00010", "OB", new Uint8Array(0), true, true),
    item(new Uint8Array(0)),
    ...frags.map(item),
    seqDelim(),
  ]);
  const body = cat([
    el("00080060", "CS", "OT"),
    el("00180088", "DS", "2"),
    el("00200037", "DS", ORIENT),
    el("00280002", "US", u16le(1)),
    el("00280004", "CS", "MONOCHROME2"),
    el("00280008", "IS", String(NZ)),
    el("00280010", "US", u16le(NY)),
    el("00280011", "US", u16le(NX)),
    el("00280030", "DS", `${SP[1]}\\${SP[0]}`),
    el("00280100", "US", u16le(16)),
    el("00280101", "US", u16le(16)),
    el("00280102", "US", u16le(15)),
    el("00280103", "US", u16le(0)),
    el("00281052", "DS", "-1024"),
    el("00281053", "DS", "1"),
    pixel,
  ]);
  return dicomFile("1.2.840.10008.1.2.5", body);
}

// ---- NIfTI -----------------------------------------------------------------------------------------

function nifti1() {
  const h = new DataView(new ArrayBuffer(352));
  h.setInt32(0, 348, true);
  [3, NX, NY, NZ, 1, 1, 1, 1].forEach((v, i) => h.setInt16(40 + 2 * i, v, true));
  h.setInt16(70, 4, true); // int16
  h.setInt16(72, 16, true);
  [1, ...SP, 1, 1, 1, 1].forEach((v, i) => h.setFloat32(76 + 4 * i, v, true));
  h.setFloat32(108, 352, true);
  h.setFloat32(112, 1, true);
  h.setFloat32(116, 0, true);
  h.setUint8(123, 2); // millimeters
  h.setInt16(254, 1, true); // sform
  // RAS: x runs to the patient's left (-R), y to posterior (-A), z superior: as the DICOM files.
  const srow = [
    [-SP[0], 0, 0, 6],
    [0, -SP[1], 0, 5],
    [0, 0, SP[2], -11],
  ];
  srow.forEach((r, i) => r.forEach((v, j) => h.setFloat32(280 + 16 * i + 4 * j, v, true)));
  new Uint8Array(h.buffer).set(str("n+1\0"), 344);
  return cat([new Uint8Array(h.buffer), new Uint8Array(HU.buffer.slice(0))]);
}

function nifti2() {
  const h = new DataView(new ArrayBuffer(544));
  h.setInt32(0, 540, false);
  new Uint8Array(h.buffer).set(str("n+2\0\r\n\x1a\n"), 4);
  h.setInt16(12, 16, false); // float32
  h.setInt16(14, 32, false);
  [3, NX, NY, NZ, 1, 1, 1, 1].forEach((v, i) => h.setBigInt64(16 + 8 * i, BigInt(v), false));
  [1, ...SP, 1, 1, 1, 1].forEach((v, i) => h.setFloat64(104 + 8 * i, v, false));
  h.setBigInt64(168, 544n, false);
  h.setFloat64(176, 1, false);
  h.setInt32(500, 2, false);
  const d = new DataView(new ArrayBuffer(HU.length * 4));
  HU.forEach((v, i) => d.setFloat32(i * 4, v, false));
  return cat([new Uint8Array(h.buffer), new Uint8Array(d.buffer)]);
}

// ---- TIFF ------------------------------------------------------------------------------------------

// One page: [tag, type, values], little endian. Returns the IFD's bytes for a given offset.
function tiffFile(pages) {
  // pages: [{ tags: [[tag, type, [values] | string]], data: Uint8Array }]
  const parts = [];
  let off = 8;
  const header = new DataView(new ArrayBuffer(8));
  header.setUint8(0, 0x49);
  header.setUint8(1, 0x49);
  header.setUint16(2, 42, true);
  parts.push(new Uint8Array(header.buffer));
  const layouts = [];
  for (const p of pages) {
    const dataAt = off;
    off += p.data.length + (p.data.length % 2);
    const extras = [];
    const tags = p.tags.map(([tag, type, v]) => [tag, type, typeof v === "string" ? str(`${v}\0`) : v]); // prettier-ignore
    const size = (type) => ({ 2: 1, 3: 2, 4: 4, 5: 8 })[type];
    for (const t of tags) {
      const bytes = t[1] === 2 ? t[2].length : t[2].length * size(t[1]);
      if (bytes > 4) {
        extras.push({ t, at: off });
        off += bytes + (bytes % 2);
      }
    }
    const ifdAt = off;
    off += 2 + tags.length * 12 + 4;
    layouts.push({ p, dataAt, tags, extras, ifdAt });
  }
  header.setUint32(4, layouts[0].ifdAt, true);
  for (let k = 0; k < layouts.length; k++) {
    const L = layouts[k];
    parts.push(pad(L.p.data, "OB"));
    const write = (type, vals) => {
      const b = new DataView(new ArrayBuffer(Math.max(4, vals.length * ({ 3: 2, 4: 4, 5: 8 })[type] || 4))); // prettier-ignore
      vals.forEach((v, i) => {
        if (type === 3) b.setUint16(2 * i, v, true);
        else if (type === 4) b.setUint32(4 * i, v, true);
        else if (type === 5) {
          b.setUint32(8 * i, v[0], true);
          b.setUint32(8 * i + 4, v[1], true);
        }
      });
      return new Uint8Array(b.buffer);
    };
    for (const x of L.extras) parts.push(pad(x.t[1] === 2 ? x.t[2] : write(x.t[1], x.t[2]), "OB"));
    const ifd = new DataView(new ArrayBuffer(2 + L.tags.length * 12 + 4));
    ifd.setUint16(0, L.tags.length, true);
    L.tags.forEach(([tag, type, v], i) => {
      const o = 2 + i * 12;
      ifd.setUint16(o, tag, true);
      ifd.setUint16(o + 2, type, true);
      ifd.setUint32(o + 4, type === 2 ? v.length : v.length, true);
      const ex = L.extras.find((x) => x.t[0] === tag);
      if (ex) ifd.setUint32(o + 8, ex.at, true);
      else {
        const b = type === 2 ? v : write(type, v);
        for (let j = 0; j < 4 && j < b.length; j++) ifd.setUint8(o + 8 + j, b[j]);
      }
    });
    ifd.setUint32(2 + L.tags.length * 12, k + 1 < layouts.length ? layouts[k + 1].ifdAt : 0, true);
    parts.push(new Uint8Array(ifd.buffer));
  }
  return cat(parts);
}

function tiffMulti() {
  const pages = [];
  for (let z = 0; z < NZ; z++) {
    const data = stored(z);
    pages.push({
      data,
      tags: [
        [256, 3, [NX]],
        [257, 3, [NY]],
        [258, 3, [16]],
        [259, 3, [1]],
        [262, 3, [1]],
        [270, 2, `ImageJ=1.54f\nimages=${NZ}\nslices=${NZ}\nunit=mm\nspacing=${SP[2]}\n`],
        [273, 4, [0]], // patched below
        [277, 3, [1]],
        [278, 3, [NY]],
        [279, 4, [data.length]],
        [282, 5, [[1 / SP[0], 1]]],
        [283, 5, [[1 / SP[1], 1]]],
      ],
    });
  }
  // Strip offsets: each page's data follows the previous page's IFD; tiffFile lays them out in
  // order, so compute by laying out twice.
  let bytes = tiffFile(pages);
  for (let pass = 0; pass < 2; pass++) {
    let off = 8;
    for (const p of pages) {
      p.tags.find((t) => t[0] === 273)[2] = [off];
      off += p.data.length + (p.data.length % 2);
      for (const t of p.tags) {
        const sz = t[1] === 2 ? t[2].length + 1 : t[2].length * { 3: 2, 4: 4, 5: 8 }[t[1]];
        if (sz > 4) off += sz + (sz % 2);
      }
      off += 2 + p.tags.length * 12 + 4;
    }
    bytes = tiffFile(pages);
  }
  return bytes;
}

function tiffSingle(z, comp) {
  const s = slice(z);
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = Math.round(((s[i] + 1000) / 2000) * 255);
  const data = comp === 8 ? new Uint8Array(zlib.deflateSync(b)) : packLiteral(b);
  const page = {
    data,
    tags: [
      [256, 3, [NX]],
      [257, 3, [NY]],
      [258, 3, [8]],
      [259, 3, [comp === 8 ? 8 : 32773]],
      [262, 3, [1]],
      [273, 4, [8]],
      [277, 3, [1]],
      [278, 3, [NY]],
      [279, 4, [data.length]],
    ],
  };
  return tiffFile([page]);
}

// ---- Zip (stored) ----------------------------------------------------------------------------------

function crc32(b) {
  let c = ~0;
  for (let i = 0; i < b.length; i++) {
    c ^= b[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function zip(files) {
  const parts = [];
  const central = [];
  let off = 0;
  for (const [name, data0] of files) {
    const n = str(name);
    const data = new Uint8Array(zlib.deflateRawSync(data0));
    const crc = crc32(data0);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(8, 8, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true);
    lh.setUint32(22, data0.length, true);
    lh.setUint16(26, n.length, true);
    parts.push(new Uint8Array(lh.buffer), n, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(10, 8, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true);
    ch.setUint32(24, data0.length, true);
    ch.setUint16(28, n.length, true);
    ch.setUint32(42, off, true);
    central.push(new Uint8Array(ch.buffer), n);
    off += 30 + n.length + data.length;
  }
  const cd = cat(central);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cd.length, true);
  end.setUint32(16, off, true);
  return cat([...parts, cd, new Uint8Array(end.buffer)]);
}

// ---- Raw -------------------------------------------------------------------------------------------

function raw() {
  const d = new DataView(new ArrayBuffer(64 + HU.length * 2));
  HU.forEach((v, i) => d.setUint16(64 + 2 * i, v + 1024, false));
  return new Uint8Array(d.buffer);
}

// ---- Write -----------------------------------------------------------------------------------------

if (import.meta.url === `file://${process.argv[1]}`) {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, "dicom-series"), { recursive: true });
  fs.mkdirSync(path.join(OUT, "tiff-stack"), { recursive: true });
  const w = (f, b) => fs.writeFileSync(path.join(OUT, f), b);
  // Shuffled names: the reader must sort by place, not by name.
  const names = [];
  for (let z = 0; z < NZ; z++) {
    const name = `IM${String((z * 7) % NZ).padStart(4, "0")}.dcm`;
    const b = seriesSlice(z);
    w(`dicom-series/${name}`, b);
    names.push([`series/${name}`, b]);
  }
  w("dicom-series.zip", zip(names));
  w("dicom-implicit.dcm", seriesSlice(4, false));
  w("dicom-multiframe.dcm", multiframe());
  w("dicom-rle.dcm", rle());
  // A slice that says it is JPEG Lossless: the reader must name what it can't read.
  w("dicom-jpeg.dcm", dicomFile("1.2.840.10008.1.2.4.70", jpegBody()));
  w("phantom.nii", nifti1());
  w("phantom.nii.gz", zlib.gzipSync(nifti1()));
  w("phantom-nifti2.nii", nifti2());
  w("phantom.tif", tiffMulti());
  for (let z = 0; z < NZ; z++) w(`tiff-stack/slice-${z + 1}.tif`, tiffSingle(z, z % 2 ? 8 : 32773));
  w("phantom.raw", raw());
  w("phantom.json", JSON.stringify({ size: [NX, NY, NZ], spacing: SP, bone: BONE, air: -1000, soft: 40, boneHU: 1000, raw: { header: 64, type: "uint16", little: false, offset: 1024 } }, null, 2) + "\n"); // prettier-ignore
  console.log(`Wrote the test volumes to ${OUT}`);
}

// Shared helpers for the Earth and maps build tools (lane Geo, October 2026).
// Every source here is a keyless public-domain service of the U.S. government;
// the data are fetched once, at build time, and saved as small snapshots in
// assets/toys/<toy id>/ (see writeGeo). The page never calls these services.

import fs from "node:fs";
import path from "node:path";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";

export const CACHE = ".cache/geo";
fs.mkdirSync(CACHE, { recursive: true });

// Fetch with a disk cache (so a rerun doesn't hit the services again).
export async function cached(name, url, { text = false } = {}) {
  const file = path.join(CACHE, name);
  if (!fs.existsSync(file)) {
    for (let i = 0; ; i++) {
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`${r.status} ${url}`);
        fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
        break;
      } catch (err) {
        if (i >= 3) throw err;
        await new Promise((res) => setTimeout(res, 2000 * 2 ** i));
      }
    }
  }
  const b = fs.readFileSync(file);
  return text ? b.toString("utf8") : new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
}

// A minimal reader for the uncompressed float32 GeoTIFFs the ArcGIS image
// services return (strips or tiles, one band).
export function readTiff(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const le = dv.getUint16(0) === 0x4949;
  const u16 = (o) => dv.getUint16(o, le);
  const u32 = (o) => dv.getUint32(o, le);
  const ifd = u32(4);
  const n = u16(ifd);
  const tags = {};
  const SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 11: 4, 12: 8, 16: 8 };
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12;
    const tag = u16(e);
    const type = u16(e + 2);
    const count = u32(e + 4);
    const size = (SIZE[type] || 1) * count;
    const at = size <= 4 ? e + 8 : u32(e + 8);
    const vals = [];
    for (let j = 0; j < Math.min(count, 1 << 20); j++) {
      if (type === 3) vals.push(u16(at + j * 2));
      else if (type === 4) vals.push(u32(at + j * 4));
      else if (type === 12) vals.push(dv.getFloat64(at + j * 8, le));
      else if (type === 11) vals.push(dv.getFloat32(at + j * 4, le));
      else vals.push(dv.getUint8(at + j));
    }
    tags[tag] = vals;
  }
  const w = tags[256][0];
  const h = tags[257][0];
  const bits = tags[258]?.[0] ?? 32;
  const fmt = tags[339]?.[0] ?? 3;
  const comp = tags[259]?.[0] ?? 1;
  if (comp !== 1 && comp !== 5) throw new Error(`TIFF compression ${comp}`);
  if ((tags[317]?.[0] ?? 1) !== 1) throw new Error("TIFF predictor");
  const out = new Float32Array(w * h);
  const read = (o) =>
    bits === 32 && fmt === 3
      ? dv.getFloat32(o, le)
      : bits === 16 && fmt === 2
        ? dv.getInt16(o, le)
        : bits === 16
          ? dv.getUint16(o, le)
          : dv.getFloat32(o, le);
  const bpp = bits / 8;
  // LZW blocks are decoded to their own buffer and read from there.
  let src = dv;
  const block = (off, count) => {
    if (comp === 1) return off;
    const raw = lzw(bytes.subarray(off, off + count));
    src = new DataView(raw.buffer);
    return 0;
  };
  const read0 = read;
  const readAt = (o) => (comp === 1 ? read0(o) : readFrom(src, o));
  const readFrom = (d, o) =>
    bits === 32 && fmt === 3 ? d.getFloat32(o, le) : bits === 16 && fmt === 2 ? d.getInt16(o, le) : d.getFloat32(o, le); // prettier-ignore
  if (tags[322]) {
    const tw = tags[322][0];
    const th = tags[323][0];
    const offs = tags[324];
    const across = Math.ceil(w / tw);
    offs.forEach((off0, t) => {
      const off = block(off0, tags[325][t]);
      const tx = (t % across) * tw;
      const ty = Math.floor(t / across) * th;
      for (let y = 0; y < th; y++)
        for (let x = 0; x < tw; x++) {
          const X = tx + x;
          const Y = ty + y;
          if (X < w && Y < h) out[Y * w + X] = readAt(off + (y * tw + x) * bpp);
        }
    });
  } else {
    const offs = tags[273];
    const rps = tags[278]?.[0] ?? h;
    offs.forEach((off0, s) => {
      const off = block(off0, tags[279]?.[s] ?? 0);
      for (let y = 0; y < rps; y++) {
        const Y = s * rps + y;
        if (Y >= h) break;
        for (let x = 0; x < w; x++) out[Y * w + x] = readAt(off + (y * w + x) * bpp);
      }
    });
  }
  return { w, h, data: out };
}

// TIFF's LZW (MSB-first codes, early change).
function lzw(input) {
  const out = [];
  let dict = [];
  const reset = () => {
    dict = [];
    for (let i = 0; i < 256; i++) dict.push([i]);
    dict.push(null, null);
  };
  reset();
  let bitPos = 0;
  let width = 9;
  const next = () => {
    let v = 0;
    for (let i = 0; i < width; i++) {
      const byte = input[(bitPos + i) >> 3] ?? 0;
      v = (v << 1) | ((byte >> (7 - ((bitPos + i) & 7))) & 1);
    }
    bitPos += width;
    return v;
  };
  let prev = null;
  while (bitPos + width <= input.length * 8) {
    const code = next();
    if (code === 257) break;
    if (code === 256) {
      reset();
      width = 9;
      prev = null;
      continue;
    }
    let entry;
    if (code < dict.length && dict[code]) entry = dict[code];
    else if (prev) entry = [...prev, prev[0]];
    else break;
    for (const b of entry) out.push(b);
    if (prev) dict.push([...prev, entry[0]]);
    prev = entry;
    if (dict.length + 1 >= 1 << width && width < 12) width++;
  }
  return new Uint8Array(out);
}

export function decodeImage(bytes) {
  if (bytes[0] === 0x89) {
    const png = PNG.sync.read(Buffer.from(bytes));
    return { w: png.width, h: png.height, data: png.data, ch: 4 };
  }
  const img = jpeg.decode(bytes, { useTArray: true });
  return { w: img.width, h: img.height, data: img.data, ch: 4 };
}

// Ground size of a lon/lat box, in meters.
export function spanMeters([w, s, e, n]) {
  const lat = ((s + n) / 2) * (Math.PI / 180);
  return [(e - w) * 111320 * Math.cos(lat), (n - s) * 110540];
}

// USGS 3DEP elevation (public domain) for a lon/lat box, in meters.
export async function elevation3dep(name, bbox, w, h) {
  const url =
    "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage?" +
    new URLSearchParams({
      bbox: bbox.join(","),
      bboxSR: "4326",
      imageSR: "4326",
      size: `${w},${h}`,
      format: "tiff",
      pixelType: "F32",
      interpolation: "RSP_BilinearInterpolation",
      f: "image",
    });
  return readTiff(await cached(`${name}-3dep-${w}x${h}.tif`, url));
}

// NOAA NCEI ETOPO1 (1 arc-minute) bedrock and sea-floor relief (public domain).
export async function elevationEtopo1(name, bbox, w, h) {
  const url =
    "https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/ETOPO1_bedrock/ImageServer/exportImage?" +
    new URLSearchParams({
      bbox: bbox.join(","),
      bboxSR: "4326",
      imageSR: "4326",
      size: `${w},${h}`,
      format: "tiff",
      pixelType: "F32",
      interpolation: "RSP_BilinearInterpolation",
      f: "image",
    });
  return readTiff(await cached(`${name}-etopo1-${w}x${h}.tif`, url));
}

// The National Map's orthoimagery basemap (NAIP from USDA FSA, and Landsat and
// Blue Marble from NASA at small scales: public domain in the conterminous US).
export async function imageryUsgs(name, bbox, w, h) {
  const url =
    "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/export?" +
    new URLSearchParams({
      bbox: bbox.join(","),
      bboxSR: "4326",
      imageSR: "4326",
      size: `${w},${h}`,
      format: "png24",
      f: "image",
    });
  return decodeImage(await cached(`${name}-img-${w}x${h}.png`, url));
}

// Resample a grid to w x h (bilinear), filling no-data (< -1e4 or NaN) from neighbors.
export function resample(grid, w, h) {
  const out = new Float32Array(w * h);
  const at = (x, y) => grid.data[Math.min(grid.h - 1, y) * grid.w + Math.min(grid.w - 1, x)];
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const fx = (i / (w - 1)) * (grid.w - 1);
      const fy = (j / (h - 1)) * (grid.h - 1);
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;
      out[j * w + i] =
        (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) +
        (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty;
    }
  return out;
}

export function fillNoData(grid) {
  const { w, h, data } = grid;
  const bad = (v) => !Number.isFinite(v) || v < -12000 || v > 9000;
  let left = 1;
  for (let pass = 0; left && pass < 200; pass++) {
    left = 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (!bad(data[y * w + x])) continue;
        let s = 0;
        let n = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { // prettier-ignore
          const X = x + dx;
          const Y = y + dy;
          if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
          const v = data[Y * w + X];
          if (!bad(v)) (s += v), n++;
        }
        if (n) data[y * w + x] = s / n;
        else left++;
      }
  }
  return grid;
}

// A snapshot file: a JSON header, then the arrays it lists, each 4-byte aligned.
//   height layers: Uint16, 0..65535 across the layer's [min, max] in meters
//   color layers:  RGB bytes
//   raw layers:    Float32 or Uint8 as given
export function writeGeo(file, meta, arrays) {
  const parts = [];
  let offset = 0;
  const layers = [];
  for (const a of arrays) {
    let bytes;
    const entry = { name: a.name, type: a.type, w: a.w, h: a.h };
    if (a.type === "height") {
      let mn = Infinity;
      let mx = -Infinity;
      for (const v of a.data) (mn = Math.min(mn, v)), (mx = Math.max(mx, v));
      if (mx === mn) mx = mn + 1;
      const q = new Uint16Array(a.data.length);
      a.data.forEach((v, i) => (q[i] = Math.round(((v - mn) / (mx - mn)) * 65535)));
      Object.assign(entry, { min: +mn.toFixed(2), max: +mx.toFixed(2) });
      bytes = new Uint8Array(q.buffer);
    } else if (a.type === "rgb") {
      bytes = a.data;
    } else if (a.type === "f32") {
      bytes = new Uint8Array(new Float32Array(a.data).buffer);
    } else bytes = new Uint8Array(a.data);
    entry.offset = offset;
    entry.bytes = bytes.byteLength;
    layers.push(entry);
    const pad = (4 - (bytes.byteLength % 4)) % 4;
    parts.push(bytes, new Uint8Array(pad));
    offset += bytes.byteLength + pad;
  }
  let head = new TextEncoder().encode(JSON.stringify({ ...meta, layers }));
  const hpad = (4 - ((head.byteLength + 4) % 4)) % 4;
  head = new Uint8Array([...head, ...new Array(hpad).fill(32)]);
  const len = new Uint8Array(4);
  new DataView(len.buffer).setUint32(0, head.byteLength, true);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([len, head, ...parts].map((p) => Buffer.from(p))));
  const size = fs.statSync(file).size;
  console.log(`${file}: ${(size / 1024).toFixed(0)} KB`);
}

// Sample an RGBA image into an RGB byte grid of w x h.
export function rgbGrid(img, w, h) {
  const out = new Uint8Array(w * h * 3);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const x = Math.min(img.w - 1, Math.round((i / (w - 1)) * (img.w - 1)));
      const y = Math.min(img.h - 1, Math.round((j / (h - 1)) * (img.h - 1)));
      const o = (y * img.w + x) * img.ch;
      out.set([img.data[o], img.data[o + 1], img.data[o + 2]], (j * w + i) * 3);
    }
  return out;
}

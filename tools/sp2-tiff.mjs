// Lane Space r2: reads big planetary GeoTIFFs over the network without
// downloading them whole, for tools/sp2-maps.mjs.
//
// The USGS Astrogeology mosaics are plain TIFFs (uncompressed, one row per
// strip), so a window of rows is one HTTP range request, streamed and
// averaged into the output grid as it arrives. NOAA's ETOPO 2022 is tiled and
// deflated with the floating-point predictor; its tiles are fetched a tile
// row at a time. Classic TIFF and BigTIFF headers both work.

import zlib from "node:zlib";
import fs from "node:fs";

const TAG = {
  256: "width",
  257: "height",
  258: "bps",
  259: "comp",
  273: "stripOffsets",
  277: "spp",
  278: "rowsPerStrip",
  279: "stripBytes",
  284: "planar",
  317: "predictor",
  322: "tileW",
  323: "tileH",
  324: "tileOffsets",
  325: "tileBytes",
  339: "format",
  42113: "nodata",
};
const SIZE = {
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
  17: 8,
};

// A byte range of a file: a local path or an http(s) address.
async function range(src, start, end) {
  if (!/^https?:/.test(src)) {
    const fd = fs.openSync(src, "r");
    const b = Buffer.alloc(end - start);
    fs.readSync(fd, b, 0, end - start, start);
    fs.closeSync(fd);
    return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  }
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(src, { headers: { Range: `bytes=${start}-${end - 1}` } });
      if (r.status !== 206 && r.status !== 200) throw new Error(`${src}: HTTP ${r.status}`);
      const b = new Uint8Array(await r.arrayBuffer());
      return r.status === 200 ? b.subarray(start, end) : b;
    } catch (err) {
      if (attempt >= 4) throw err;
      await new Promise((ok) => setTimeout(ok, 2000 * 2 ** attempt));
    }
  }
}

// Streams bytes [start, end) to onChunk(Uint8Array) in order.
async function stream(src, start, end, onChunk) {
  if (!/^https?:/.test(src)) {
    const fd = fs.openSync(src, "r");
    const step = 1 << 24;
    for (let p = start; p < end; p += step) {
      const n = Math.min(step, end - p);
      const b = Buffer.alloc(n);
      fs.readSync(fd, b, 0, n, p);
      onChunk(new Uint8Array(b.buffer, b.byteOffset, n));
    }
    fs.closeSync(fd);
    return;
  }
  let pos = start;
  for (let attempt = 0; pos < end; attempt++) {
    try {
      const r = await fetch(src, { headers: { Range: `bytes=${pos}-${end - 1}` } });
      if (r.status !== 206) throw new Error(`${src}: HTTP ${r.status}`);
      const reader = r.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        onChunk(value);
        pos += value.length;
      }
    } catch (err) {
      if (attempt >= 6) throw err;
      console.log(`  (retrying at byte ${pos}: ${err.message})`);
      await new Promise((ok) => setTimeout(ok, 2000 * 2 ** Math.min(attempt, 4)));
    }
  }
}

// The first image's tags: { width, height, spp, bps, format, comp, ... }.
export async function openTiff(src) {
  let head = await range(src, 0, 1 << 16);
  const le = head[0] === 0x49;
  const dv = () => new DataView(head.buffer, head.byteOffset, head.byteLength);
  let d = dv();
  const big = d.getUint16(2, le) === 43;
  const u64 = (v, o) => Number(v.getBigUint64(o, le));
  let ifd = big ? u64(d, 8) : d.getUint32(4, le);
  // The image file directory may sit at the end of the file.
  let base = 0;
  if (ifd + 4096 > head.length) {
    head = await range(src, ifd, ifd + 65536).catch(() => range(src, ifd, ifd + 8192));
    base = ifd;
    d = dv();
  }
  const at = (o) => o - base;
  const cnt = big ? u64(d, at(ifd)) : d.getUint16(at(ifd), le);
  const tags = {};
  const pending = [];
  for (let i = 0; i < cnt; i++) {
    const e = at(ifd) + (big ? 8 : 2) + i * (big ? 20 : 12);
    const tag = d.getUint16(e, le);
    const type = d.getUint16(e + 2, le);
    const count = big ? u64(d, e + 4) : d.getUint32(e + 4, le);
    const name = TAG[tag];
    if (!name) continue;
    const bytes = SIZE[type] * count;
    const inline = bytes <= (big ? 8 : 4);
    const vo = e + (big ? 12 : 8);
    const where = inline ? null : big ? u64(d, vo) : d.getUint32(vo, le);
    pending.push({ name, type, count, inline, vo, where, bytes });
  }
  for (const p of pending) {
    let view;
    let off;
    if (p.inline) {
      view = d;
      off = p.vo;
    } else {
      const b = await range(src, p.where, p.where + p.bytes);
      view = new DataView(b.buffer, b.byteOffset, b.byteLength);
      off = 0;
    }
    const vals = [];
    for (let k = 0; k < p.count; k++) {
      const o = off + k * SIZE[p.type];
      if (p.type === 3) vals.push(view.getUint16(o, le));
      else if (p.type === 4) vals.push(view.getUint32(o, le));
      else if (p.type === 16) vals.push(u64(view, o));
      else if (p.type === 2) vals.push(String.fromCharCode(view.getUint8(o)));
      else if (p.type === 1) vals.push(view.getUint8(o));
      else vals.push(view.getUint32(o, le));
    }
    tags[p.name] =
      p.type === 2 ? vals.join("").replace(/\0+$/, "") : p.count === 1 ? vals[0] : vals;
  }
  const t = {
    src,
    le,
    width: tags.width,
    height: tags.height,
    spp: tags.spp ?? 1,
    bps: Array.isArray(tags.bps) ? tags.bps[0] : (tags.bps ?? 8),
    format: Array.isArray(tags.format) ? tags.format[0] : (tags.format ?? 1),
    comp: tags.comp ?? 1,
    predictor: tags.predictor ?? 1,
    planar: tags.planar ?? 1,
    nodata: tags.nodata !== undefined ? Number(tags.nodata) : null,
    tags,
  };
  if (tags.tileW) {
    t.tileW = tags.tileW;
    t.tileH = tags.tileH;
    t.tileOffsets = [].concat(tags.tileOffsets);
    t.tileBytes = [].concat(tags.tileBytes);
  } else {
    t.stripOffsets = [].concat(tags.stripOffsets);
    t.rowsPerStrip = tags.rowsPerStrip ?? t.height;
  }
  return t;
}

// A reader of one sample (as a number) from a row's bytes.
function sampleReader(t) {
  const bytes = t.bps / 8;
  if (t.format === 3 && t.bps === 32) {
    return (dv, i) => dv.getFloat32(i * 4, t.le);
  }
  if (t.bps === 8) return t.format === 2 ? (dv, i) => dv.getInt8(i) : (dv, i) => dv.getUint8(i);
  if (t.bps === 16)
    return t.format === 2 ? (dv, i) => dv.getInt16(i * 2, t.le) : (dv, i) => dv.getUint16(i * 2, t.le); // prettier-ignore
  if (t.bps === 32)
    return t.format === 2 ? (dv, i) => dv.getInt32(i * 4, t.le) : (dv, i) => dv.getUint32(i * 4, t.le); // prettier-ignore
  throw new Error(`Unsupported sample: ${bytes} bytes, format ${t.format}`);
}

// Calls onRow(y, values) for rows y0..y1-1 (values: Float64Array of
// width × spp samples, reused between rows).
export async function readRows(t, y0, y1, onRow) {
  const W = t.width;
  const spp = t.spp;
  const rowBytes = (W * spp * t.bps) / 8;
  const vals = new Float64Array(W * spp);
  const get = sampleReader(t);
  if (t.stripOffsets && t.planar === 2 && spp > 1) {
    // Separate planes (one strip per row per channel): a block of rows of
    // each plane per request, put together sample by sample.
    if (t.comp !== 1 || t.rowsPerStrip !== 1) throw new Error("Unsupported planar layout.");
    const so = t.stripOffsets;
    const H = t.height;
    const pb = (W * t.bps) / 8;
    const block = 128;
    for (let a = y0; a < y1; a += block) {
      const b = Math.min(y1, a + block);
      const planes = [];
      for (let c = 0; c < spp; c++) {
        const lo = so[c * H + a];
        for (let y = a + 1; y < b; y++)
          if (so[c * H + y] !== lo + (y - a) * pb) throw new Error("Strips are not contiguous.");
        planes.push(await range(t.src, lo, lo + (b - a) * pb));
      }
      const t1 = { ...t, spp: 1 };
      const get1 = sampleReader(t1);
      for (let y = a; y < b; y++) {
        for (let c = 0; c < spp; c++) {
          const pl = planes[c];
          const dv = new DataView(pl.buffer, pl.byteOffset + (y - a) * pb, pb);
          for (let i = 0; i < W; i++) vals[i * spp + c] = get1(dv, i);
        }
        onRow(y, vals);
      }
    }
    return;
  }
  if (t.stripOffsets && t.comp !== 1) {
    // Compressed strips (LZW or deflate): a block of strips per request.
    const rps = t.rowsPerStrip;
    const so = t.stripOffsets;
    const sb = [].concat(t.tags.stripBytes);
    const s0 = Math.floor(y0 / rps);
    const s1 = Math.floor((y1 - 1) / rps);
    for (let a = s0; a <= s1; a += 64) {
      const b = Math.min(s1, a + 63);
      const lo = Math.min(...so.slice(a, b + 1));
      const hi = Math.max(...so.slice(a, b + 1).map((o, i) => o + sb[a + i]));
      const blob = await range(t.src, lo, hi);
      for (let s = a; s <= b; s++) {
        const rows = Math.min(rps, t.height - s * rps);
        let raw = blob.subarray(so[s] - lo, so[s] - lo + sb[s]);
        raw = t.comp === 5 ? lzw(raw, rows * rowBytes) : new Uint8Array(zlib.inflateSync(raw));
        raw = unpredict(t, raw, W, rows);
        for (let r = 0; r < rows; r++) {
          const y = s * rps + r;
          if (y < y0 || y >= y1) continue;
          const dv = new DataView(raw.buffer, raw.byteOffset + r * rowBytes, rowBytes);
          for (let i = 0; i < W * spp; i++) vals[i] = get(dv, i);
          onRow(y, vals);
        }
      }
    }
    return;
  }
  if (t.stripOffsets) {
    // One row per strip, laid end to end (checked), so rows y0..y1 are one range.
    const rps = t.rowsPerStrip;
    const so = t.stripOffsets;
    const s0 = Math.floor(y0 / rps);
    const s1 = Math.floor((y1 - 1) / rps);
    for (let s = s0; s < s1; s++)
      if (so[s + 1] !== so[s] + rps * rowBytes) throw new Error("Strips are not contiguous.");
    const start = so[s0] + (y0 - s0 * rps) * rowBytes;
    const end = start + (y1 - y0) * rowBytes;
    const buf = new Uint8Array(rowBytes);
    let fill = 0;
    let y = y0;
    await stream(t.src, start, end, (chunk) => {
      let p = 0;
      while (p < chunk.length) {
        const n = Math.min(rowBytes - fill, chunk.length - p);
        buf.set(chunk.subarray(p, p + n), fill);
        fill += n;
        p += n;
        if (fill === rowBytes) {
          const dv = new DataView(buf.buffer);
          for (let i = 0; i < W * spp; i++) vals[i] = get(dv, i);
          onRow(y++, vals);
          fill = 0;
        }
      }
    });
    return;
  }
  // Tiled: a tile row at a time.
  const { tileW, tileH } = t;
  const across = Math.ceil(W / tileW);
  const tileRowBytes = (tileW * spp * t.bps) / 8;
  for (let ty = Math.floor(y0 / tileH); ty * tileH < y1; ty++) {
    const idx = [];
    for (let tx = 0; tx < across; tx++) idx.push(ty * across + tx);
    const lo = Math.min(...idx.map((i) => t.tileOffsets[i]));
    const hi = Math.max(...idx.map((i) => t.tileOffsets[i] + t.tileBytes[i]));
    const blob = await range(t.src, lo, hi);
    const tiles = idx.map((i) => {
      let raw = blob.subarray(t.tileOffsets[i] - lo, t.tileOffsets[i] - lo + t.tileBytes[i]);
      if (t.comp === 8 || t.comp === 32946) raw = new Uint8Array(zlib.inflateSync(raw));
      else if (t.comp !== 1) throw new Error(`Compression ${t.comp} is not supported.`);
      return unpredict(t, raw, tileW, tileH);
    });
    for (let r = 0; r < tileH; r++) {
      const y = ty * tileH + r;
      if (y < y0 || y >= y1 || y >= t.height) continue;
      for (let tx = 0; tx < across; tx++) {
        const dv = new DataView(tiles[tx].buffer, tiles[tx].byteOffset + r * tileRowBytes);
        const n = Math.min(tileW, W - tx * tileW);
        for (let i = 0; i < n * spp; i++) vals[tx * tileW * spp + i] = get(dv, i);
      }
      onRow(y, vals);
    }
  }
}

// Undoes TIFF predictors 2 (horizontal differences) and 3 (floating point).
function unpredict(t, raw, w, h) {
  const spp = t.spp;
  const bytes = t.bps / 8;
  if (t.predictor === 3) {
    const out = new Uint8Array(raw.length);
    const rowLen = w * spp * bytes;
    for (let y = 0; y < h; y++) {
      const row = raw.subarray(y * rowLen, (y + 1) * rowLen);
      for (let i = spp; i < rowLen; i++) row[i] = (row[i] + row[i - spp]) & 255;
      // Bytes come grouped by significance (most significant first).
      const n = w * spp;
      for (let i = 0; i < n; i++)
        for (let b = 0; b < bytes; b++) {
          const src = row[b * n + i];
          out[y * rowLen + i * bytes + (t.le ? bytes - 1 - b : b)] = src;
        }
    }
    return out;
  }
  if (t.predictor === 2) {
    const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    const rowLen = w * spp;
    for (let y = 0; y < h; y++)
      for (let i = spp; i < rowLen; i++) {
        const o = (y * rowLen + i) * bytes;
        const p = (y * rowLen + i - spp) * bytes;
        if (bytes === 1) raw[o] = (raw[o] + raw[p]) & 255;
        else if (bytes === 2) dv.setUint16(o, dv.getUint16(o, t.le) + dv.getUint16(p, t.le), t.le);
        else dv.setUint32(o, dv.getUint32(o, t.le) + dv.getUint32(p, t.le), t.le);
      }
  }
  return raw;
}

// TIFF's LZW (MSB-first codes, early change).
function lzw(input, size) {
  const out = new Uint8Array(size);
  let op = 0;
  const prefix = new Int32Array(4096);
  const suffix = new Uint8Array(4096);
  const first = new Uint8Array(4096);
  const lens = new Int32Array(4096);
  for (let i = 0; i < 256; i++) ((suffix[i] = i), (first[i] = i), (lens[i] = 1), (prefix[i] = -1));
  let next = 258;
  let width = 9;
  let bitPos = 0;
  let prev = -1;
  const total = input.length * 8;
  const emit = (code) => {
    const n = lens[code];
    let p = op + n - 1;
    let c = code;
    while (c >= 0 && p >= op) {
      if (p < size) out[p] = suffix[c];
      c = prefix[c];
      p--;
    }
    op += n;
  };
  while (bitPos + width <= total) {
    let code = 0;
    for (let i = 0; i < width; i++) {
      const bit = (input[(bitPos + i) >> 3] >> (7 - ((bitPos + i) & 7))) & 1;
      code = (code << 1) | bit;
    }
    bitPos += width;
    if (code === 256) {
      next = 258;
      width = 9;
      prev = -1;
      continue;
    }
    if (code === 257) break;
    if (prev < 0) {
      emit(code);
      prev = code;
      continue;
    }
    if (code < next) {
      emit(code);
      prefix[next] = prev;
      suffix[next] = first[code];
      first[next] = first[prev];
      lens[next] = lens[prev] + 1;
    } else {
      prefix[next] = prev;
      suffix[next] = first[prev];
      first[next] = first[prev];
      lens[next] = lens[prev] + 1;
      emit(next);
    }
    next++;
    if (next + 1 >= 1 << width && width < 12) width++;
    prev = code;
    if (op >= size) break;
  }
  return out;
}

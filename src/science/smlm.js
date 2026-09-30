// Single-molecule localization microscopy files (lane Science): the tables
// of molecules a super-resolution microscope (PALM, STORM, PAINT) finds.
//
//   readSmlm(bytes)            a .smlm file (ShareLoc.XYZ's format: a zip with
//                              manifest.json and binary tables, one per channel)
//   readThunderstormCsv(text)  a CSV exported by ThunderSTORM (x, y and
//                              optionally z in nm, the localization
//                              uncertainty, intensity, frame)
//
// Both return a table of localizations:
//   { n, x, y, z, sxy, sz, frame, intensity, channel, has3D, channels: [name],
//     frames: [min, max], notes: [string] }
// with x, y, z, sxy (the lateral localization precision, one standard
// deviation) and sz (the axial one) in nanometers as Float32Arrays, frame and
// intensity as Float32Arrays (NaN where missing) and channel as a Uint8Array.

const fail = (message) => {
  throw new Error(message);
};

export const MAX_LOCALIZATIONS = 8_000_000;

// ---- Zip ---------------------------------------------------------------------------------

// The entries of a zip file (from its central directory): name, method (0
// stored, 8 deflated), sizes and where its data start.
export function zipEntries(bytes) {
  const b = bytes;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--)
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  if (eocd < 0) fail("This is not a zip file (a .smlm file is a zip).");
  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  if (off === 0xffffffff) fail("This .smlm file is too big (zip64) for this toy.");
  const dec = new TextDecoder();
  const entries = [];
  for (let k = 0; k < count; k++) {
    if (dv.getUint32(off, true) !== 0x02014b50) fail("This zip file's directory is damaged.");
    const method = dv.getUint16(off + 10, true);
    const compSize = dv.getUint32(off + 20, true);
    const size = dv.getUint32(off + 24, true);
    const nl = dv.getUint16(off + 28, true);
    const el = dv.getUint16(off + 30, true);
    const cl = dv.getUint16(off + 32, true);
    const local = dv.getUint32(off + 42, true);
    const name = dec.decode(b.subarray(off + 46, off + 46 + nl));
    const lnl = dv.getUint16(local + 26, true);
    const lel = dv.getUint16(local + 28, true);
    entries.push({ name, method, compSize, size, start: local + 30 + lnl + lel });
    off += 46 + nl + el + cl;
  }
  return entries;
}

// One entry's bytes, inflated with DecompressionStream("deflate-raw").
export async function unzipEntry(bytes, entry) {
  const raw = bytes.subarray(entry.start, entry.start + entry.compSize);
  if (entry.method === 0) return raw;
  if (entry.method !== 8) fail(`"${entry.name}" is packed in a way this toy can't open.`);
  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const out = new Uint8Array(await new Response(stream).arrayBuffer());
  if (entry.size && out.length !== entry.size) fail(`"${entry.name}" didn't unpack whole.`);
  return out;
}

// Deflates bytes (for the sample tool), as a zip entry would hold them.
export async function deflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// ---- Column names ------------------------------------------------------------------------

// "x [nm]", "\"uncertainty_xy [nm]\"", "uncertainty_z_nm_" -> { key, unit }.
function column(name) {
  let s = String(name).trim().replace(/^"|"$/g, "").toLowerCase();
  let unit = /\[([^\]]*)\]/.exec(s)?.[1]?.trim() ?? "";
  s = s.replace(/\[[^\]]*\]/g, "").trim();
  const m = /_(nm|px|um|µm)_?$/.exec(s);
  if (m) {
    unit ||= m[1];
    s = s.slice(0, m.index);
  }
  s = s.replace(/[\s-]+/g, "_");
  const key =
    {
      x: "x",
      y: "y",
      z: "z",
      frame: "frame",
      intensity: "intensity",
      uncertainty: "sxy",
      uncertainty_xy: "sxy",
      precision: "sxy",
      localization_precision: "sxy",
      uncertainty_z: "sz",
      precision_z: "sz",
      channel: "channel",
    }[s] ?? "";
  return { key, unit, name: s };
}

// ---- The table ---------------------------------------------------------------------------

function finish(cols, n, { channelNames, notes }) {
  const nan = () => new Float32Array(n).fill(NaN);
  const t = {
    n,
    x: cols.x,
    y: cols.y,
    z: cols.z ?? new Float32Array(n),
    sxy: cols.sxy ?? nan(),
    sz: cols.sz ?? nan(),
    frame: cols.frame ?? nan(),
    intensity: cols.intensity ?? nan(),
    channel: cols.channel ?? new Uint8Array(n),
    has3D: !!cols.z,
    channels: channelNames,
    notes,
  };
  // Missing precisions: a fixed 20 nm (said in a note).
  let missing = 0;
  let zMissing = 0;
  for (let i = 0; i < n; i++) {
    if (!(t.sxy[i] > 0)) {
      t.sxy[i] = 20;
      missing++;
    }
    if (!(t.sz[i] > 0)) {
      t.sz[i] = t.has3D ? 2 * t.sxy[i] : t.sxy[i];
      zMissing++;
    }
  }
  if (missing)
    notes.push(
      `${missing === n ? "The file has no localization precision" : `${missing} localizations have no precision`}, so they are drawn 20 nm wide.`,
    );
  if (t.has3D && zMissing && zMissing !== missing)
    notes.push("Where the file gives no axial precision, it is taken as twice the lateral one.");
  if (!t.has3D) notes.push("The file has no z, so the localizations lie in one plane.");
  let f0 = Infinity;
  let f1 = -Infinity;
  for (let i = 0; i < n; i++) {
    const f = t.frame[i];
    if (f < f0) f0 = f;
    if (f > f1) f1 = f;
  }
  t.frames = Number.isFinite(f0) ? [f0, f1] : null;
  return t;
}

const DTYPES = {
  float32: [Float32Array, 4, "getFloat32"],
  float64: [Float64Array, 8, "getFloat64"],
  int8: [Int8Array, 1, "getInt8"],
  uint8: [Uint8Array, 1, "getUint8"],
  int16: [Int16Array, 2, "getInt16"],
  uint16: [Uint16Array, 2, "getUint16"],
  int32: [Int32Array, 4, "getInt32"],
  uint32: [Uint32Array, 4, "getUint32"],
};

// Reads a .smlm file's bytes (see the top of this file).
export async function readSmlm(bytes) {
  const entries = zipEntries(bytes);
  const man = entries.find((e) => /(^|\/)manifest\.json$/i.test(e.name));
  if (!man) fail("This zip has no manifest.json, so it isn't a .smlm file.");
  let manifest;
  try {
    manifest = JSON.parse(new TextDecoder().decode(await unzipEntry(bytes, man)));
  } catch {
    fail("This .smlm file's manifest.json can't be read.");
  }
  const tables = (manifest.files || []).filter((f) => f.type === "table" || f.format);
  const parts = [];
  const notes = [];
  for (const [ci, f] of tables.entries()) {
    const fmt = manifest.formats?.[f.format];
    if (!fmt || fmt.type !== "table") continue;
    if (fmt.mode !== "binary") {
      notes.push(`"${f.name}" is a text table; only binary tables are read.`);
      continue;
    }
    const entry = entries.find((e) => e.name === f.name || e.name.endsWith(`/${f.name}`));
    if (!entry) fail(`This .smlm file lists "${f.name}" but doesn't have it.`);
    const data = await unzipEntry(bytes, entry);
    const heads = fmt.headers.map(column);
    const types = fmt.dtype.map((d) => DTYPES[String(d).toLowerCase()]);
    if (types.some((d) => !d)) fail(`"${f.name}" has a column type this toy can't read.`);
    const stride = types.reduce((s, d) => s + d[1], 0);
    const rows = Math.min(f.rows ?? Infinity, Math.floor(data.length / stride));
    if (!(rows > 0)) continue;
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const cols = {};
    let off = 0;
    heads.forEach((h, k) => {
      const [, size, get] = types[k];
      if (h.key && h.key !== "channel" && !cols[h.key]) {
        const out = new Float32Array(rows);
        for (let r = 0, o = off; r < rows; r++, o += stride) out[r] = dv[get](o, true);
        cols[h.key] = out;
      }
      off += size;
    });
    if (!cols.x || !cols.y) fail(`"${f.name}" has no x and y columns.`);
    const offX = Number(f.offset?.x) || 0;
    const offY = Number(f.offset?.y) || 0;
    if (offX || offY) for (let r = 0; r < rows; r++) ((cols.x[r] += offX), (cols.y[r] += offY));
    parts.push({ cols, rows, channel: ci, name: f.channel && f.channel !== "default" ? f.channel : `Channel ${parts.length + 1}` }); // prettier-ignore
  }
  if (!parts.length) fail("This .smlm file has no localization tables.");
  return merge(parts, notes);
}

function merge(parts, notes) {
  const n = parts.reduce((s, p) => s + p.rows, 0);
  if (n > MAX_LOCALIZATIONS)
    fail(`This file has ${n.toLocaleString("en")} localizations, more than this toy reads (${MAX_LOCALIZATIONS.toLocaleString("en")}).`); // prettier-ignore
  const keys = ["x", "y", "z", "sxy", "sz", "frame", "intensity"];
  const has = (k) => parts.some((p) => p.cols[k]);
  const cols = {};
  for (const k of keys) {
    if (!has(k)) continue;
    const out = new Float32Array(n).fill(NaN);
    let o = 0;
    for (const p of parts) {
      if (p.cols[k]) out.set(p.cols[k], o);
      else if (k === "z") out.fill(0, o, o + p.rows);
      o += p.rows;
    }
    cols[k] = out;
  }
  const channel = new Uint8Array(n);
  let o = 0;
  parts.forEach((p, i) => {
    if (p.cols.channel) for (let r = 0; r < p.rows; r++) channel[o + r] = p.cols.channel[r];
    else channel.fill(Math.min(255, i), o, o + p.rows);
    o += p.rows;
  });
  cols.channel = channel;
  return finish(cols, n, { channelNames: parts.map((p) => p.name), notes });
}

// Reads a ThunderSTORM CSV (see the top of this file).
export function readThunderstormCsv(text) {
  const src = String(text ?? "");
  const nl = src.indexOf("\n");
  if (nl < 0) fail("That file has no rows.");
  const headLine = src.slice(0, nl).replace(/\r$/, "");
  const sep = headLine.includes(",") ? "," : headLine.includes("\t") ? "\t" : ";";
  const heads = headLine.split(sep).map(column);
  const idx = {};
  heads.forEach((h, k) => {
    if (h.key && idx[h.key] === undefined) idx[h.key] = k;
  });
  if (idx.x === undefined || idx.y === undefined)
    fail('This CSV has no "x [nm]" and "y [nm]" columns (a ThunderSTORM export has them).');
  for (const k of ["x", "y", "z", "sxy", "sz"]) {
    const u = heads[idx[k]]?.unit;
    if (idx[k] !== undefined && u && u !== "nm")
      fail(`The "${k === "sxy" ? "uncertainty" : k}" column is in ${u}; export the table in nanometers.`); // prettier-ignore
  }
  const keys = Object.keys(idx).filter((k) => k !== "channel");
  const grow = (a) => {
    const b = new Float32Array(a.length * 2);
    b.set(a);
    return b;
  };
  let cap = 1 << 14;
  const cols = Object.fromEntries(keys.map((k) => [k, new Float32Array(cap)]));
  let chan = idx.channel !== undefined ? new Uint8Array(cap) : null;
  let n = 0;
  let bad = 0;
  for (let start = nl + 1; start < src.length; ) {
    let end = src.indexOf("\n", start);
    if (end < 0) end = src.length;
    const line = src.slice(start, end);
    start = end + 1;
    if (!line.trim()) continue;
    const f = line.split(sep);
    const x = Number(f[idx.x]);
    const y = Number(f[idx.y]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      bad++;
      continue;
    }
    if (n === cap) {
      cap *= 2;
      for (const k of keys) cols[k] = grow(cols[k]);
      if (chan) {
        const c2 = new Uint8Array(cap);
        c2.set(chan);
        chan = c2;
      }
    }
    for (const k of keys) cols[k][n] = Number(f[idx[k]]);
    if (chan) chan[n] = Math.max(0, Math.min(255, Number(f[idx.channel]) | 0));
    n++;
    if (n > MAX_LOCALIZATIONS) fail(`This file has more than ${MAX_LOCALIZATIONS.toLocaleString("en")} localizations.`); // prettier-ignore
  }
  if (!n) fail("This CSV has no localizations.");
  for (const k of keys) cols[k] = cols[k].slice(0, n);
  if (chan) cols.channel = chan.slice(0, n);
  const notes = bad ? [`${bad} rows without x and y were skipped.`] : [];
  let names = ["Channel 1"];
  if (chan) {
    let top = 0;
    for (let i = 0; i < n; i++) top = Math.max(top, cols.channel[i]);
    names = Array.from({ length: top + 1 }, (_, i) => `Channel ${i + 1}`);
  }
  return finish(cols, n, { channelNames: names, notes });
}

// Reads either kind of file by its name and first bytes.
export async function readLocalizations(bytes, fileName = "") {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b) return readSmlm(b);
  if (/\.smlm$/i.test(fileName)) fail("This .smlm file isn't a zip file.");
  return readThunderstormCsv(new TextDecoder().decode(b));
}

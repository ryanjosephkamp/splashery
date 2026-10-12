// Baked splat assets (lane Baked engine, docs/handoff/BakedEngine.md): trained or baked 3D
// Gaussian splats that a kit recipe loads in prepare() and emits through the kit (k.cloud), so
// their parts move with the kit's one-entity path (uSpParts) and MotionDriver like any kit toy.
// Plain JavaScript with no engine imports: it runs in the browser, in Node (the tests) and in
// the converter (tools/port-convert.mjs).
//
// ---- The format (.bkd, "BKD1"), 18 bytes a splat ----------------------------------------------
// An asset is a manifest.json and, for each tier (a splat count), one or more chunk files. Every
// chunk decodes on its own (it carries its tier's bounds), all numbers little-endian:
//
//   0       "BKD1"
//   4       u32 J: the length of the JSON header (padded with spaces to a multiple of 4)
//   8       the JSON header: { format: "splashery-baked", version: 1, count, first, lo, hi,
//           scaleLo, scaleHi } (first: the chunk's first splat in its tier; lo, hi: the tier's
//           bounds; scaleLo, scaleHi: its range of log sizes)
//   8 + J   rot    u32 x count     the rotation, "smallest three": 2 bits say which of x, y, z,
//                                  w is largest (it is stored positive and rebuilt), then the
//                                  other three in order, 10 bits each over +-1/sqrt(2)
//           pos    u16 x 3 count   x, y, z over [lo, hi] (padded after to a multiple of 4)
//           scale  u8 x 3 count    log sizes over [scaleLo, scaleHi]
//           rgba   u8 x 4 count    color (degree 0 only: 0.5 + C0 f_dc, clamped) and opacity
//                                  (after the sigmoid)
//           part   u8 x count      the part id (0 is the body)
//
// The worst errors (measured on the repository's trained PLYs in tests/bkd-format.spec.mjs):
// position 1/131070 of the bounds on each axis, rotation about 0.08 degrees, size 1/510 of the
// log range (about 1.6% for a 16-unit range), color and opacity 1/510. Splats are stored in an
// even random order (the converter shuffles them, seeded by the source's hash), so the first m
// splats of a tier are an even sample of it: the loader thins a tier by reading only its first
// chunks, the same splats every time. A chunk may be gzipped (the loader looks for gzip's magic
// bytes and inflates it with DecompressionStream).
//
// ---- The manifest ------------------------------------------------------------------------------
//   { format: "splashery-baked-manifest", version: 1, id, title, source: { file, sha256,
//     splats, parts?, partsSha256? }, bounds: { min, max }, parts: [{ id, name, pivot?,
//     axis? }], tiers: [{ splats, bytes, files: [{ path, splats, bytes, sha256 }] }], credit:
//     { title, author, source, license, licenseUrl }, nc?, aiMade? }
// Paths are relative to the manifest. Coordinates (bounds, pivots) are the asset's own, which
// are the recipe's coordinates when it adds the asset unmoved.

export const MAGIC = "BKD1";
export const BYTES_PER_SPLAT = 18;
export const SH_C0 = 0.28209479177387814;
const SQRT1_2 = Math.SQRT1_2;
// The log-size range is at most this wide: anything smaller than e^-16 of the largest splat is
// stored at that floor (far below a pixel).
export const SCALE_RANGE_MAX = 16;

const clampByte = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
const sigmoid = (v) => 1 / (1 + Math.exp(-v));

// ---- Quaternions: smallest three ---------------------------------------------------------------

// q = [x, y, z, w] (any length) -> u32.
export function packQuat(q) {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  let m = 0;
  for (let k = 1; k < 4; k++) if (Math.abs(q[k]) > Math.abs(q[m])) m = k;
  const sign = q[m] < 0 ? -1 / l : 1 / l;
  let bits = m;
  for (let k = 0; k < 4; k++) {
    if (k === m) continue;
    const a = q[k] * sign;
    const u = Math.max(0, Math.min(1023, Math.round(((a / SQRT1_2 + 1) / 2) * 1023)));
    bits = bits * 1024 + u;
  }
  return bits >>> 0;
}

// u32 -> [x, y, z, w] (unit length), written into out.
export function unpackQuat(bits, out = [0, 0, 0, 1]) {
  const m = bits >>> 30;
  let rest = bits & 0x3fffffff;
  let sum = 0;
  for (let k = 3; k >= 0; k--) {
    if (k === m) continue;
    const a = ((rest & 1023) / 1023) * 2 - 1;
    rest >>>= 10;
    out[k] = a * SQRT1_2;
    sum += out[k] * out[k];
  }
  out[m] = Math.sqrt(Math.max(0, 1 - sum));
  return out;
}

// ---- Encoding (the converter and the tests) --------------------------------------------------

// The bounds and log-size range of a table (the splat-io layout: x, y, z, s0..s2 as logs).
export function tableRange(t, n = t.count) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  let shi = -Infinity;
  for (let i = 0; i < n; i++) {
    const p = [t.x[i], t.y[i], t.z[i]];
    for (let k = 0; k < 3; k++) {
      if (p[k] < lo[k]) lo[k] = p[k];
      if (p[k] > hi[k]) hi[k] = p[k];
    }
    shi = Math.max(shi, t.s0[i], t.s1[i], t.s2[i]);
  }
  let slo = Infinity;
  for (let i = 0; i < n; i++) slo = Math.min(slo, t.s0[i], t.s1[i], t.s2[i]);
  slo = Math.max(slo, shi - SCALE_RANGE_MAX);
  if (!(slo < shi)) slo = shi - 1;
  return { lo, hi, scaleLo: slo, scaleHi: shi };
}

// Encodes splats [first, first + count) of a table into one chunk. `t` is the splat-io table
// layout (x, y, z, r, g, b as f_dc, opacity as a logit, s0..s2 as logs, qw, qx, qy, qz) plus
// `part` (a Uint8Array, or none: all body). `range` is the tier's (tableRange).
export function encodeChunk(t, first, count, range) {
  const head = { format: "splashery-baked", version: 1, count, first, ...range };
  let json = JSON.stringify(head);
  while (json.length % 4) json += " ";
  const jb = new TextEncoder().encode(json);
  const H = 8 + jb.length;
  const posBytes = (count * 6 + 3) & ~3;
  const size = H + count * 4 + posBytes + count * 8;
  const out = new Uint8Array(size);
  out.set(new TextEncoder().encode(MAGIC), 0);
  const dv = new DataView(out.buffer);
  dv.setUint32(4, jb.length, true);
  out.set(jb, 8);
  const { lo, hi, scaleLo, scaleHi } = range;
  const ext = [0, 1, 2].map((k) => hi[k] - lo[k] || 1);
  let o = H;
  for (let i = first; i < first + count; i++) {
    dv.setUint32(o, packQuat([t.qx[i], t.qy[i], t.qz[i], t.qw[i]]), true);
    o += 4;
  }
  const P = o;
  for (let j = 0; j < count; j++) {
    const i = first + j;
    const p = [t.x[i], t.y[i], t.z[i]];
    for (let k = 0; k < 3; k++)
      dv.setUint16(P + (j * 3 + k) * 2, Math.max(0, Math.min(65535, Math.round(((p[k] - lo[k]) / ext[k]) * 65535))), true); // prettier-ignore
  }
  o = P + posBytes;
  const sr = scaleHi - scaleLo;
  for (let j = 0; j < count; j++) {
    const i = first + j;
    out[o++] = clampByte(((t.s0[i] - scaleLo) / sr) * 255);
    out[o++] = clampByte(((t.s1[i] - scaleLo) / sr) * 255);
    out[o++] = clampByte(((t.s2[i] - scaleLo) / sr) * 255);
  }
  for (let j = 0; j < count; j++) {
    const i = first + j;
    out[o++] = clampByte((0.5 + SH_C0 * t.r[i]) * 255);
    out[o++] = clampByte((0.5 + SH_C0 * t.g[i]) * 255);
    out[o++] = clampByte((0.5 + SH_C0 * t.b[i]) * 255);
    out[o++] = clampByte(sigmoid(t.opacity[i]) * 255);
  }
  for (let j = 0; j < count; j++) out[o++] = t.part ? t.part[first + j] : 0;
  return out;
}

// ---- Decoding ----------------------------------------------------------------------------------

export function isGzip(bytes) {
  return bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

export async function gunzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// One chunk's bytes (not gzipped) -> { head, rot, pos, scale, rgba, part } (typed-array views,
// no copying when the bytes start on a 4-byte boundary).
export function decodeChunk(bytes) {
  if (bytes.length < 8 || String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== MAGIC)
    throw new Error("This is not a baked splat file.");
  if (bytes.byteOffset % 4) bytes = bytes.slice();
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const J = dv.getUint32(4, true);
  const head = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + J)));
  if (head.format !== "splashery-baked" || head.version !== 1)
    throw new Error("This baked splat file is a version this page can't read.");
  const n = head.count;
  const H = 8 + J;
  const posBytes = (n * 6 + 3) & ~3;
  if (bytes.length < H + n * 4 + posBytes + n * 8) throw new Error("This baked splat file is cut short."); // prettier-ignore
  const b = bytes.byteOffset;
  const rot = new Uint32Array(bytes.buffer, b + H, n);
  const pos = new Uint16Array(bytes.buffer, b + H + n * 4, n * 3);
  let o = H + n * 4 + posBytes;
  const scale = bytes.subarray(o, o + n * 3);
  o += n * 3;
  const rgba = bytes.subarray(o, o + n * 4);
  o += n * 4;
  const part = bytes.subarray(o, o + n);
  return { head, rot, pos, scale, rgba, part };
}

// Joins the first m splats of a tier's decoded chunks into one asset (the quantized arrays; a
// splat is dequantized as it is used, see splatAt).
export function joinChunks(chunks, m) {
  const head = chunks[0].head;
  const rot = new Uint32Array(m);
  const pos = new Uint16Array(m * 3);
  const scale = new Uint8Array(m * 3);
  const rgba = new Uint8Array(m * 4);
  const part = new Uint8Array(m);
  let at = 0;
  for (const c of chunks) {
    const take = Math.min(c.head.count, m - at);
    if (take <= 0) break;
    rot.set(c.rot.subarray(0, take), at);
    pos.set(c.pos.subarray(0, take * 3), at * 3);
    scale.set(c.scale.subarray(0, take * 3), at * 3);
    rgba.set(c.rgba.subarray(0, take * 4), at * 4);
    part.set(c.part.subarray(0, take), at);
    at += take;
  }
  if (at < m) throw new Error("A baked asset has fewer splats than its manifest says.");
  return { n: m, lo: head.lo, hi: head.hi, scaleLo: head.scaleLo, scaleHi: head.scaleHi, rot, pos, scale, rgba, part }; // prettier-ignore
}

// Splat i of an asset, dequantized: { p, scales (linear), quat [x, y, z, w], color, opacity,
// part }. `s` is reused when given.
export function splatAt(a, i, s = { p: [0, 0, 0], scales: [0, 0, 0], quat: [0, 0, 0, 1], color: [0, 0, 0] }) {
  const sr = (a.scaleHi - a.scaleLo) / 255;
  for (let k = 0; k < 3; k++) {
    s.p[k] = a.lo[k] + (a.pos[i * 3 + k] / 65535) * (a.hi[k] - a.lo[k]);
    s.scales[k] = Math.exp(a.scaleLo + a.scale[i * 3 + k] * sr);
    s.color[k] = a.rgba[i * 4 + k] / 255;
  }
  unpackQuat(a.rot[i], s.quat);
  s.opacity = a.rgba[i * 4 + 3] / 255;
  s.part = a.part[i];
  return s;
} // prettier-ignore

// ---- Tiers -------------------------------------------------------------------------------------

// Which tier a budget gets, and how many of its splats: the largest tier that fits the budget,
// whole; below the smallest tier, the smallest tier's first `budget` splats (never fewer than
// `least`). Tiers are sorted by size first. No budget: the manifest's default tier (or the
// largest under 400,000 splats).
export function chooseTier(manifest, budget, { least = 1000 } = {}) {
  const tiers = manifest.tiers.slice().sort((a, b) => a.splats - b.splats);
  if (!budget) {
    const d = tiers.find((t) => t.splats === manifest.defaultTier) || tiers.filter((t) => t.splats <= 400000).pop() || tiers[0]; // prettier-ignore
    return { tier: d, n: d.splats };
  }
  const fit = tiers.filter((t) => t.splats <= budget).pop();
  if (fit) return { tier: fit, n: fit.splats };
  const t = tiers[0];
  return { tier: t, n: Math.min(t.splats, Math.max(least, Math.floor(budget))) };
}

// ---- Loading -----------------------------------------------------------------------------------

async function readBytes(url) {
  const u = url instanceof URL ? url : new URL(url, globalThis.location?.href);
  if (u.protocol === "file:") {
    const fs = await import("node:fs/promises");
    return new Uint8Array(await fs.readFile(u));
  }
  const r = await fetch(u);
  if (!r.ok) throw new Error("Could not load the baked splats.");
  return new Uint8Array(await r.arrayBuffer());
}

const ASSETS = new Map();

// Loads a baked asset for a splat budget: the manifest, then only the chunks the chosen tier's
// first n splats need (fetched together). Cached by manifest, tier and n. Returns { manifest,
// tier, n, grow, ...the joined arrays }: `grow` is how much each splat grows to close the surface
// when a tier is thinned (the square root of the thinning).
export async function loadBaked(manifestUrl, { budget = 0 } = {}) {
  const murl = manifestUrl instanceof URL ? manifestUrl : new URL(manifestUrl, globalThis.location?.href); // prettier-ignore
  const manifest = JSON.parse(new TextDecoder().decode(await readBytes(murl)));
  if (manifest.format !== "splashery-baked-manifest")
    throw new Error("This is not a baked splat manifest.");
  const { tier, n } = chooseTier(manifest, budget);
  const key = `${murl.href}|${tier.splats}|${n}`;
  if (ASSETS.has(key)) return ASSETS.get(key);
  const files = [];
  let have = 0;
  for (const f of tier.files) {
    if (have >= n) break;
    files.push(f);
    have += f.splats;
  }
  const chunks = await Promise.all(
    files.map(async (f) => {
      let bytes = await readBytes(new URL(f.path, murl));
      if (isGzip(bytes)) bytes = await gunzip(bytes);
      return decodeChunk(bytes);
    }),
  );
  const asset = { manifest, tier, ...joinChunks(chunks, n), grow: Math.sqrt(tier.splats / n) };
  ASSETS.set(key, asset);
  return asset;
}

// ---- Emitting through the kit ------------------------------------------------------------------

// Adds a loaded asset to a kit as one cloud. Options:
//   parts: "auto" (default: each manifest part but the body becomes a kit part, with its pivot
//          and axis), or an array (the kit part for each file part id), or (filePart) => index
//   quat ([x, y, z, w]), pos and scale (a number): place the asset in the recipe's coordinates
//   sizeMul: scales every splat; color(c, i, filePart) may recolor a splat (returns [r, g, b])
//   kind, params, pattern: as k.cloud's (the pattern layer stays off by default)
// Returns the cloud item (item.start and item.end are its splats in the buffer after the build).
export function addBaked(k, asset, opts = {}) {
  const { parts = "auto", quat = null, pos = [0, 0, 0], scale = 1, sizeMul = 1, color } = opts;
  let map;
  if (typeof parts === "function") map = parts;
  else if (Array.isArray(parts)) map = (fp) => parts[fp] ?? 0;
  else {
    const ids = new Map();
    for (const p of asset.manifest.parts || []) {
      if (!p.id) continue;
      const pivot = place(p.pivot || [0, 0, 0], quat, pos, scale);
      const axis = quat ? rotate(quat, p.axis || [0, 1, 0]) : p.axis || [0, 1, 0];
      ids.set(p.id, k.part(p.name || `part${p.id}`, { pivot, axis }));
    }
    map = (fp) => ids.get(fp) ?? 0;
  }
  const grow = asset.grow * sizeMul * scale;
  const s = { p: [0, 0, 0], scales: [0, 0, 0], quat: [0, 0, 0, 1], color: [0, 0, 0] };
  const item = k.cloud(
    {
      count: ((asset.n + 0.5) * 160000) / k.count,
      pattern: opts.pattern ?? false,
      kind: opts.kind,
      params: opts.params,
      jitter: 0,
    },
    (_r, i) => {
      if (i >= asset.n) return null;
      splatAt(asset, i, s);
      const q = quat ? mulQuat(quat, s.quat) : s.quat.slice();
      const c = color ? color(s.color.slice(), i, s.part) || s.color : s.color.slice();
      return {
        p: place(s.p, quat, pos, scale),
        scales: [s.scales[0] * grow, s.scales[1] * grow, s.scales[2] * grow],
        quat: q,
        color: c,
        opacity: s.opacity,
        part: map(s.part, i),
      };
    },
  );
  k.data ||= {};
  (k.data.baked ||= []).push(item);
  return item;
}

function rotate(q, v) {
  const u = [q[0], q[1], q[2]];
  const t = cross(u, v).map((x) => x * 2);
  const c = cross(u, t);
  return [0, 1, 2].map((k) => v[k] + t[k] * q[3] + c[k]);
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; // prettier-ignore
function place(p, quat, pos, scale) {
  const r = quat ? rotate(quat, p) : p;
  return [r[0] * scale + pos[0], r[1] * scale + pos[1], r[2] * scale + pos[2]];
}
function mulQuat(a, b) {
  return [
    a[3] * b[0] + b[3] * a[0] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] + b[3] * a[1] + a[2] * b[0] - a[0] * b[2],
    a[3] * b[2] + b[3] * a[2] + a[0] * b[1] - a[1] * b[0],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

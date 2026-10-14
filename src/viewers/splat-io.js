// Lane Viewers: reading and writing 3D Gaussian splat files for the Splat toolkit, on the device.
// Plain JavaScript with no page or engine imports, so it runs in the toolkit's worker
// (src/viewers/worker.js), in the browser and in Node (the tests).
//
// Every file becomes one "table" in the PLY's own conventions (the INRIA 3DGS layout, right-down-
// forward axes):
//   { count, shDegree, x, y, z, r, g, b, opacity, s0, s1, s2, qw, qx, qy, qz, rest }
// r, g, b are the degree-0 harmonics (f_dc_0..2), opacity is before the sigmoid, s0..s2 are log
// sizes, the rotation is a unit quaternion and rest holds f_rest_0.. (channel-major, as in a PLY).
//
// Reads: PLY (binary or text, and the compressed PLY of SuperSplat and splat-transform), .splat
// (antimatter15), .spz (Niantic, versions 1 to 3; version 4 needs zstd) and .sog (PlayCanvas, its
// version 2, zipped or as meta.json with its pictures). Writes: PLY, .splat, .spz (version 3) and
// .sog (version 2, without the view-dependent colors). SOG keeps its numbers in lossless WebP
// pictures; reading and writing them needs a WebP codec, passed in as `webp` ({ decodeRGBA(bytes),
// encodeLosslessRGBA(rgba, w, h) }, vendor/webp/).

export const SH_C0 = 0.28209479177387814;
export const SH_COEFFS = [0, 3, 8, 15]; // per channel, by degree
const SQRT2 = Math.SQRT2;
const sigmoid = (v) => 1 / (1 + Math.exp(-v));
const logit = (p) => {
  const c = Math.min(1 - 1e-6, Math.max(1e-6, p));
  return Math.log(c / (1 - c));
};
const clampByte = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

export const FIELDS = ["x", "y", "z", "r", "g", "b", "opacity", "s0", "s1", "s2", "qw", "qx", "qy", "qz"]; // prettier-ignore

export function emptyTable(count, shDegree = 0) {
  const t = { count, shDegree };
  for (const f of FIELDS) t[f] = new Float32Array(count);
  t.rest = Array.from({ length: SH_COEFFS[shDegree] * 3 }, () => new Float32Array(count));
  return t;
}

// A new table of the splats at `idx` (an index list), in that order.
export function pick(t, idx) {
  const n = idx.length;
  const out = emptyTable(n, t.shDegree);
  for (const f of FIELDS) {
    const a = t[f];
    const b = out[f];
    for (let j = 0; j < n; j++) b[j] = a[idx[j]];
  }
  t.rest.forEach((a, k) => {
    const b = out.rest[k];
    for (let j = 0; j < n; j++) b[j] = a[idx[j]];
  });
  return out;
}

// Bytes in memory for a table (what the stats call memory).
export const tableBytes = (t) => t.count * (FIELDS.length + t.rest.length) * 4;

export function extOf(name) {
  const n = (name || "").toLowerCase();
  if (n.endsWith(".compressed.ply")) return "ply";
  if (n.endsWith("meta.json")) return "sog";
  const m = /\.([a-z0-9]+)$/.exec(n);
  return m ? m[1] : "";
}

// ---- PLY -------------------------------------------------------------------------------------

const PLY_TYPES = {
  char: [1, "Int8"], int8: [1, "Int8"], uchar: [1, "Uint8"], uint8: [1, "Uint8"],
  short: [2, "Int16"], int16: [2, "Int16"], ushort: [2, "Uint16"], uint16: [2, "Uint16"],
  int: [4, "Int32"], int32: [4, "Int32"], uint: [4, "Uint32"], uint32: [4, "Uint32"],
  float: [4, "Float32"], float32: [4, "Float32"], double: [8, "Float64"], float64: [8, "Float64"],
}; // prettier-ignore

// The header of a PLY: { format, elements: [{ name, count, props: [{ name, type, list, countType }] }],
// comments, offset (where the data starts) }.
export function readPlyHeader(bytes) {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, Math.min(bytes.length, 1 << 18)));
  if (!head.startsWith("ply")) return null;
  const end = head.indexOf("end_header");
  if (end < 0) return null;
  const elements = [];
  const comments = [];
  let format = "";
  for (const line of head.slice(0, end).split(/\r?\n/)) {
    const t = line.trim().split(/\s+/);
    if (t[0] === "format") format = t[1];
    else if (t[0] === "comment") comments.push(line.trim().slice(8));
    else if (t[0] === "element") elements.push({ name: t[1], count: Number(t[2]), props: [] });
    else if (t[0] === "property" && elements.length) {
      const list = t[1] === "list";
      elements[elements.length - 1].props.push({
        name: t[t.length - 1],
        type: list ? t[3] : t[1],
        countType: list ? t[2] : null,
        list,
      });
    }
  }
  let offset = end + "end_header".length;
  if (head[offset] === "\r") offset++;
  if (head[offset] === "\n") offset++;
  return { format, elements, comments, offset };
}

// Reads every element of a PLY into columns: { name: { count, cols: { prop: Float64Array or
// Float32Array } } }. List properties (a mesh's faces) are skipped over. onProgress(0..1).
export function readPlyElements(bytes, header, { want = null, onProgress } = {}) {
  const out = {};
  if (header.format === "ascii") return readPlyAscii(bytes, header, want);
  const le = header.format === "binary_little_endian";
  if (!le && header.format !== "binary_big_endian")
    throw new Error(`Unknown PLY format "${header.format}".`);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let o = header.offset;
  for (const el of header.elements) {
    const keep = !want || want.includes(el.name);
    const fixed = !el.props.some((p) => p.list);
    if (fixed) {
      const layout = [];
      let stride = 0;
      for (const p of el.props) {
        const t = PLY_TYPES[p.type];
        if (!t) throw new Error(`Unknown PLY property type "${p.type}".`);
        layout.push({
          name: p.name,
          off: stride,
          get: `get${t[1]}`,
          f64: t[0] >= 4 && t[1] !== "Float32",
        });
        stride += t[0];
      }
      if (o + stride * el.count > bytes.byteLength)
        throw new Error("This PLY file is cut short: it has fewer bytes than its header says.");
      if (keep) {
        const cols = {};
        for (const l of layout) cols[l.name] = l.f64 ? new Float64Array(el.count) : new Float32Array(el.count); // prettier-ignore
        const arrs = layout.map((l) => cols[l.name]);
        const step = Math.max(1, el.count >> 6);
        for (let i = 0; i < el.count; i++) {
          const base = o + i * stride;
          for (let j = 0; j < layout.length; j++) arrs[j][i] = dv[layout[j].get](base + layout[j].off, le); // prettier-ignore
          if (onProgress && i % step === 0) onProgress(i / el.count);
        }
        out[el.name] = { count: el.count, cols };
      }
      o += stride * el.count;
    } else {
      // A list element (faces): walk over it.
      for (let i = 0; i < el.count; i++) {
        for (const p of el.props) {
          if (p.list) {
            const ct = PLY_TYPES[p.countType];
            const n = dv[`get${ct[1]}`](o, le);
            o += ct[0] + n * PLY_TYPES[p.type][0];
          } else o += PLY_TYPES[p.type][0];
        }
      }
    }
  }
  return out;
}

function readPlyAscii(bytes, header, want) {
  const text = new TextDecoder().decode(bytes.subarray(header.offset));
  const tok = text.split(/\s+/).filter(Boolean);
  let k = 0;
  const out = {};
  for (const el of header.elements) {
    const keep = !want || want.includes(el.name);
    const cols = {};
    if (keep) for (const p of el.props) if (!p.list) cols[p.name] = new Float64Array(el.count);
    for (let i = 0; i < el.count; i++) {
      for (const p of el.props) {
        if (p.list) {
          const n = Number(tok[k++]);
          k += n;
        } else {
          const v = Number(tok[k++]);
          if (keep) cols[p.name][i] = v;
        }
      }
    }
    if (k > tok.length) throw new Error("This PLY file is cut short.");
    if (keep) out[el.name] = { count: el.count, cols };
  }
  return out;
}

const restNames = (cols) => {
  let n = 0;
  while (cols[`f_rest_${n}`]) n++;
  return n;
};
const degreeOfRest = (n) => (n >= 45 ? 3 : n >= 24 ? 2 : n >= 9 ? 1 : 0);

// A splat PLY (also the compressed one) as a table. A PLY of plain points (x, y, z and maybe
// colors, no splat sizes) comes back as small round splats, with `points: true`.
export function readSplatPly(bytes, { onProgress } = {}) {
  const header = readPlyHeader(bytes);
  if (!header) throw new Error("This is not a PLY file (it does not start with “ply”).");
  const v = header.elements.find((e) => e.name === "vertex");
  if (!v) throw new Error("This PLY has no points (no vertex element).");
  if (
    header.elements.some((e) => e.name === "chunk") &&
    v.props.some((p) => p.name === "packed_position")
  )
    // prettier-ignore
    return readCompressedPly(bytes, header);
  const els = readPlyElements(bytes, header, { want: ["vertex"], onProgress });
  const c = els.vertex.cols;
  const n = v.count;
  if (!c.x || !c.y || !c.z) throw new Error("This PLY has no x, y and z.");
  const splat = c.scale_0 && c.f_dc_0 && c.opacity;
  const restCount = splat ? restNames(c) : 0;
  const deg = degreeOfRest(restCount);
  const t = emptyTable(n, deg);
  t.x.set(c.x);
  t.y.set(c.y);
  t.z.set(c.z);
  if (splat) {
    t.r.set(c.f_dc_0);
    t.g.set(c.f_dc_1);
    t.b.set(c.f_dc_2);
    t.opacity.set(c.opacity);
    t.s0.set(c.scale_0);
    t.s1.set(c.scale_1 || c.scale_0);
    t.s2.set(c.scale_2 || c.scale_0);
    const per = SH_COEFFS[deg];
    const have = restCount / 3; // coefficients per channel in the file
    for (let ch = 0; ch < 3; ch++)
      for (let k = 0; k < per; k++) t.rest[ch * per + k].set(c[`f_rest_${ch * have + k}`]);
    if (c.rot_0) {
      for (let i = 0; i < n; i++) {
        const w = c.rot_0[i], x = c.rot_1[i], y = c.rot_2[i], z = c.rot_3[i]; // prettier-ignore
        const l = Math.hypot(w, x, y, z) || 1;
        t.qw[i] = w / l;
        t.qx[i] = x / l;
        t.qy[i] = y / l;
        t.qz[i] = z / l;
      }
    } else t.qw.fill(1);
    return t;
  }
  // Plain points: colors from red/green/blue, a size from the spacing.
  const scale = 255;
  const rr = c.red || c.r, gg = c.green || c.g, bb = c.blue || c.b; // prettier-ignore
  const s = Math.log(pointSpacing(t));
  for (let i = 0; i < n; i++) {
    const cr = rr ? rr[i] / scale : 0.8;
    const cg = gg ? gg[i] / scale : 0.8;
    const cb = bb ? bb[i] / scale : 0.8;
    t.r[i] = (cr - 0.5) / SH_C0;
    t.g[i] = (cg - 0.5) / SH_C0;
    t.b[i] = (cb - 0.5) / SH_C0;
    t.opacity[i] = logit(0.95);
    t.s0[i] = t.s1[i] = t.s2[i] = s;
    t.qw[i] = 1;
  }
  t.points = true;
  return t;
}

// About how far apart points are: the box's size over the cube root of the count, halved.
function pointSpacing(t) {
  const b = boundsOf(t);
  const d = Math.max(1e-9, ...b.size);
  return (0.5 * d) / Math.cbrt(Math.max(1, t.count));
}

const unorm = (v, bits) => {
  const m = (1 << bits) - 1;
  return (v & m) / m;
};
const lerp = (a, b, t) => a * (1 - t) + b * t;

// The compressed PLY (chunk bounds per 256 splats, packed 32-bit position, rotation, scale and
// color, optional 8-bit harmonics), as splat-transform and SuperSplat write it.
function readCompressedPly(bytes, header) {
  const els = readPlyElements(bytes, header);
  const ch = els.chunk.cols;
  const vx = els.vertex.cols;
  const sh = els.sh?.cols;
  const n = els.vertex.count;
  const restCount = sh ? restNames(sh) : 0;
  const deg = degreeOfRest(restCount);
  const t = emptyTable(n, deg);
  const hasColor = !!ch.min_r;
  const rotNorm = 1 / (SQRT2 * 0.5);
  for (let i = 0; i < n; i++) {
    const ci = i >> 8;
    const pp = vx.packed_position[i] >>> 0;
    t.x[i] = lerp(ch.min_x[ci], ch.max_x[ci], unorm(pp >>> 21, 11));
    t.y[i] = lerp(ch.min_y[ci], ch.max_y[ci], unorm(pp >>> 11, 10));
    t.z[i] = lerp(ch.min_z[ci], ch.max_z[ci], unorm(pp, 11));
    const pr = vx.packed_rotation[i] >>> 0;
    const a = (unorm(pr >>> 20, 10) - 0.5) * rotNorm;
    const b = (unorm(pr >>> 10, 10) - 0.5) * rotNorm;
    const c = (unorm(pr, 10) - 0.5) * rotNorm;
    const m = Math.sqrt(Math.max(0, 1 - (a * a + b * b + c * c)));
    const q = [[m, a, b, c], [a, m, b, c], [a, b, m, c], [a, b, c, m]][pr >>> 30]; // prettier-ignore
    t.qw[i] = q[0];
    t.qx[i] = q[1];
    t.qy[i] = q[2];
    t.qz[i] = q[3];
    const ps = vx.packed_scale[i] >>> 0;
    t.s0[i] = lerp(ch.min_scale_x[ci], ch.max_scale_x[ci], unorm(ps >>> 21, 11));
    t.s1[i] = lerp(ch.min_scale_y[ci], ch.max_scale_y[ci], unorm(ps >>> 11, 10));
    t.s2[i] = lerp(ch.min_scale_z[ci], ch.max_scale_z[ci], unorm(ps, 11));
    const pc = vx.packed_color[i] >>> 0;
    let cr = unorm(pc >>> 24, 8), cg = unorm(pc >>> 16, 8), cb = unorm(pc >>> 8, 8); // prettier-ignore
    if (hasColor) {
      cr = lerp(ch.min_r[ci], ch.max_r[ci], cr);
      cg = lerp(ch.min_g[ci], ch.max_g[ci], cg);
      cb = lerp(ch.min_b[ci], ch.max_b[ci], cb);
    }
    t.r[i] = (cr - 0.5) / SH_C0;
    t.g[i] = (cg - 0.5) / SH_C0;
    t.b[i] = (cb - 0.5) / SH_C0;
    const a8 = unorm(pc, 8);
    t.opacity[i] = logit(a8);
  }
  if (sh) {
    const per = SH_COEFFS[deg];
    const have = restCount / 3;
    for (let chn = 0; chn < 3; chn++)
      for (let k = 0; k < per; k++) {
        const src = sh[`f_rest_${chn * have + k}`];
        const dst = t.rest[chn * per + k];
        for (let i = 0; i < n; i++) {
          const v = src[i];
          const nrm = v === 0 ? 0 : v === 255 ? 1 : (v + 0.5) / 256;
          dst[i] = (nrm - 0.5) * 8;
        }
      }
  }
  t.compressed = true;
  return t;
}

// A binary little-endian splat PLY (the INRIA layout every splat tool reads).
export function writeSplatPly(t) {
  const rest = t.rest.length;
  const names = ["x", "y", "z", "f_dc_0", "f_dc_1", "f_dc_2"];
  for (let k = 0; k < rest; k++) names.push(`f_rest_${k}`);
  names.push("opacity", "scale_0", "scale_1", "scale_2", "rot_0", "rot_1", "rot_2", "rot_3");
  const cols = [t.x, t.y, t.z, t.r, t.g, t.b, ...t.rest, t.opacity, t.s0, t.s1, t.s2, t.qw, t.qx, t.qy, t.qz]; // prettier-ignore
  const head =
    `ply\nformat binary_little_endian 1.0\ncomment Saved by Splashery's Splat toolkit\nelement vertex ${t.count}\n` +
    names.map((nm) => `property float ${nm}\n`).join("") +
    "end_header\n";
  const hb = new TextEncoder().encode(head);
  const stride = names.length;
  const out = new Uint8Array(hb.length + t.count * stride * 4);
  out.set(hb);
  const body = new Float32Array(t.count * stride);
  for (let i = 0; i < t.count; i++) {
    const o = i * stride;
    for (let j = 0; j < stride; j++) body[o + j] = cols[j][i];
  }
  out.set(new Uint8Array(body.buffer), hb.length);
  return out;
}

// ---- .splat ----------------------------------------------------------------------------------

// antimatter15's .splat: 32 bytes a splat (position, linear sizes, RGBA bytes, rotation bytes
// w x y z). No harmonics beyond the base color.
export function readDotSplat(bytes) {
  const n = Math.floor(bytes.byteLength / 32);
  if (!n || bytes.byteLength % 32)
    throw new Error("This .splat file is empty or cut short (it should be 32 bytes a splat).");
  const dv = new DataView(bytes.buffer, bytes.byteOffset, n * 32);
  const t = emptyTable(n, 0);
  for (let i = 0; i < n; i++) {
    const o = i * 32;
    t.x[i] = dv.getFloat32(o, true);
    t.y[i] = dv.getFloat32(o + 4, true);
    t.z[i] = dv.getFloat32(o + 8, true);
    t.s0[i] = Math.log(Math.max(1e-12, dv.getFloat32(o + 12, true)));
    t.s1[i] = Math.log(Math.max(1e-12, dv.getFloat32(o + 16, true)));
    t.s2[i] = Math.log(Math.max(1e-12, dv.getFloat32(o + 20, true)));
    t.r[i] = (bytes[o + 24] / 255 - 0.5) / SH_C0;
    t.g[i] = (bytes[o + 25] / 255 - 0.5) / SH_C0;
    t.b[i] = (bytes[o + 26] / 255 - 0.5) / SH_C0;
    t.opacity[i] = logit(bytes[o + 27] / 255);
    const w = (bytes[o + 28] - 128) / 128;
    const x = (bytes[o + 29] - 128) / 128;
    const y = (bytes[o + 30] - 128) / 128;
    const z = (bytes[o + 31] - 128) / 128;
    const l = Math.hypot(w, x, y, z) || 1;
    t.qw[i] = w / l;
    t.qx[i] = x / l;
    t.qy[i] = y / l;
    t.qz[i] = z / l;
  }
  return t;
}

export function writeDotSplat(t) {
  // Biggest and most opaque first, as .splat viewers expect.
  const n = t.count;
  const score = new Float32Array(n);
  for (let i = 0; i < n; i++) score[i] = -(t.s0[i] + t.s1[i] + t.s2[i]) - Math.log(sigmoid(t.opacity[i]) + 1e-9); // prettier-ignore
  const order = Uint32Array.from({ length: n }, (_, i) => i).sort((a, b) => score[a] - score[b]);
  const out = new Uint8Array(n * 32);
  const dv = new DataView(out.buffer);
  for (let j = 0; j < n; j++) {
    const i = order[j];
    const o = j * 32;
    dv.setFloat32(o, t.x[i], true);
    dv.setFloat32(o + 4, t.y[i], true);
    dv.setFloat32(o + 8, t.z[i], true);
    dv.setFloat32(o + 12, Math.exp(t.s0[i]), true);
    dv.setFloat32(o + 16, Math.exp(t.s1[i]), true);
    dv.setFloat32(o + 20, Math.exp(t.s2[i]), true);
    out[o + 24] = clampByte((0.5 + SH_C0 * t.r[i]) * 255);
    out[o + 25] = clampByte((0.5 + SH_C0 * t.g[i]) * 255);
    out[o + 26] = clampByte((0.5 + SH_C0 * t.b[i]) * 255);
    out[o + 27] = clampByte(sigmoid(t.opacity[i]) * 255);
    out[o + 28] = clampByte(t.qw[i] * 128 + 128);
    out[o + 29] = clampByte(t.qx[i] * 128 + 128);
    out[o + 30] = clampByte(t.qy[i] * 128 + 128);
    out[o + 31] = clampByte(t.qz[i] * 128 + 128);
  }
  return out;
}

// ---- SPZ -------------------------------------------------------------------------------------
// Niantic's SPZ keeps its points in right-up-back axes; a PLY's are right-down-forward. Reading
// and writing turn the splats half a turn about X (y and z change sign), with their rotations and
// the harmonics that change sign under that turn.

// Signs of the harmonic coefficients (per channel, in file order) under y -> -y, z -> -z.
const SH_FLIP = [-1, -1, 1, -1, 1, 1, -1, 1, -1, 1, -1, -1, 1, -1, 1];

export function flipYZ(t) {
  for (let i = 0; i < t.count; i++) {
    t.y[i] = -t.y[i];
    t.z[i] = -t.z[i];
    // q' = (0, 1, 0, 0) * q, a half turn about X before the splat's own rotation.
    const w = t.qw[i], x = t.qx[i], y = t.qy[i], z = t.qz[i]; // prettier-ignore
    t.qw[i] = -x;
    t.qx[i] = w;
    t.qy[i] = -z;
    t.qz[i] = y;
  }
  const per = SH_COEFFS[t.shDegree];
  for (let ch = 0; ch < 3; ch++)
    for (let k = 0; k < per; k++) if (SH_FLIP[k] < 0) {
      const a = t.rest[ch * per + k];
      for (let i = 0; i < t.count; i++) a[i] = -a[i];
    } // prettier-ignore
  return t;
}

async function inflate(bytes, format) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function deflate(bytes, format) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const halfToFloat = (h) => {
  const s = h & 0x8000 ? -1 : 1;
  const e = (h >> 10) & 0x1f;
  const f = h & 0x3ff;
  if (e === 0) return s * Math.pow(2, -14) * (f / 1024);
  if (e === 31) return f ? NaN : s * Infinity;
  return s * Math.pow(2, e - 15) * (1 + f / 1024);
};

export async function readSpz(bytes) {
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) {
    const dv0 = new DataView(bytes.buffer, bytes.byteOffset, Math.min(8, bytes.byteLength));
    if (bytes.byteLength >= 8 && dv0.getUint32(0, true) === 0x5053474e && dv0.getUint32(4, true) >= 4)
      throw new Error("This SPZ file is version 4 (zstd compressed), which Splashery can't read yet. Save it as version 3, PLY or SOG in another tool first."); // prettier-ignore
    throw new Error("This does not look like an SPZ file.");
  }
  const raw = await inflate(bytes, "gzip");
  const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  if (raw.byteLength < 16 || dv.getUint32(0, true) !== 0x5053474e) throw new Error("This does not look like an SPZ file."); // prettier-ignore
  const version = dv.getUint32(4, true);
  if (version < 1 || version > 3) throw new Error(`SPZ version ${version} is not supported.`);
  const n = dv.getUint32(8, true);
  const deg = Math.min(3, dv.getUint8(12));
  const fx = 1 / (1 << dv.getUint8(13));
  const per = SH_COEFFS[deg];
  const need = 16 + n * ((version === 1 ? 6 : 9) + 1 + 3 + 3 + (version === 3 ? 4 : 3) + per * 3);
  if (raw.byteLength < need) throw new Error("This SPZ file is cut short.");
  const t = emptyTable(n, deg);
  let o = 16;
  const pos = [t.x, t.y, t.z];
  for (let i = 0; i < n; i++)
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
      pos[k][i] = v;
    }
  for (let i = 0; i < n; i++) t.opacity[i] = logit(raw[o++] / 255);
  for (let i = 0; i < n; i++) {
    t.r[i] = (raw[o++] / 255 - 0.5) / 0.15;
    t.g[i] = (raw[o++] / 255 - 0.5) / 0.15;
    t.b[i] = (raw[o++] / 255 - 0.5) / 0.15;
  }
  for (let i = 0; i < n; i++) {
    t.s0[i] = raw[o++] / 16 - 10;
    t.s1[i] = raw[o++] / 16 - 10;
    t.s2[i] = raw[o++] / 16 - 10;
  }
  const q = [0, 0, 0, 0]; // x, y, z, w
  for (let i = 0; i < n; i++) {
    if (version === 3) {
      let comp = (raw[o] | (raw[o + 1] << 8) | (raw[o + 2] << 16) | (raw[o + 3] << 24)) >>> 0;
      o += 4;
      const largest = comp >>> 30;
      let sum = 0;
      for (let j = 3; j >= 0; j--) {
        if (j === largest) continue;
        const mag = comp & 511;
        const neg = (comp >>> 9) & 1;
        comp >>>= 10;
        const v = ((neg ? -1 : 1) * Math.SQRT1_2 * mag) / 511;
        q[j] = v;
        sum += v * v;
      }
      q[largest] = Math.sqrt(Math.max(0, 1 - sum));
    } else {
      q[0] = raw[o] / 127.5 - 1;
      q[1] = raw[o + 1] / 127.5 - 1;
      q[2] = raw[o + 2] / 127.5 - 1;
      o += 3;
      q[3] = Math.sqrt(Math.max(0, 1 - q[0] * q[0] - q[1] * q[1] - q[2] * q[2]));
    }
    const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
    t.qx[i] = q[0] / l;
    t.qy[i] = q[1] / l;
    t.qz[i] = q[2] / l;
    t.qw[i] = q[3] / l;
  }
  for (let i = 0; i < n; i++)
    for (let c = 0; c < per; c++)
      for (let ch = 0; ch < 3; ch++) t.rest[ch * per + c][i] = (raw[o++] - 128) / 128;
  return flipYZ(t);
}

// SPZ version 3 (gzip), 12 fractional bits for positions. The table is not changed.
export async function writeSpz(t, { fractional = 12 } = {}) {
  const n = t.count;
  const per = SH_COEFFS[t.shDegree];
  const f = flipYZ(
    pick(
      t,
      Uint32Array.from({ length: n }, (_, i) => i),
    ),
  );
  const raw = new Uint8Array(16 + n * (9 + 1 + 3 + 3 + 4 + per * 3));
  const dv = new DataView(raw.buffer);
  dv.setUint32(0, 0x5053474e, true);
  dv.setUint32(4, 3, true);
  dv.setUint32(8, n, true);
  raw[12] = t.shDegree;
  raw[13] = fractional;
  let o = 16;
  const scale = 1 << fractional;
  const lim = 0x7fffff;
  for (let i = 0; i < n; i++)
    for (const a of [f.x, f.y, f.z]) {
      let v = Math.round(a[i] * scale);
      v = v > lim ? lim : v < -lim ? -lim : v;
      raw[o++] = v & 255;
      raw[o++] = (v >> 8) & 255;
      raw[o++] = (v >> 16) & 255;
    }
  for (let i = 0; i < n; i++) raw[o++] = clampByte(sigmoid(f.opacity[i]) * 255);
  for (let i = 0; i < n; i++)
    for (const a of [f.r, f.g, f.b]) raw[o++] = clampByte((a[i] * 0.15 + 0.5) * 255);
  for (let i = 0; i < n; i++)
    for (const a of [f.s0, f.s1, f.s2]) raw[o++] = clampByte((a[i] + 10) * 16);
  for (let i = 0; i < n; i++) {
    const q = [f.qx[i], f.qy[i], f.qz[i], f.qw[i]];
    let largest = 0;
    for (let j = 1; j < 4; j++) if (Math.abs(q[j]) > Math.abs(q[largest])) largest = j;
    const sgn = q[largest] < 0 ? -1 : 1;
    let comp = 0;
    for (let j = 0; j < 4; j++) {
      if (j === largest) continue;
      const v = q[j] * sgn;
      const mag = Math.min(511, Math.round((Math.abs(v) / Math.SQRT1_2) * 511));
      comp = (comp << 10) | ((v < 0 ? 1 : 0) << 9) | mag;
    }
    comp = (comp | (largest << 30)) >>> 0;
    dv.setUint32(o, comp, true);
    o += 4;
  }
  for (let i = 0; i < n; i++)
    for (let c = 0; c < per; c++)
      for (let ch = 0; ch < 3; ch++) raw[o++] = clampByte(f.rest[ch * per + c][i] * 128 + 128);
  return deflate(raw, "gzip");
}

// ---- Zip (for SOG) ---------------------------------------------------------------------------

// The files of a zip archive (stored or deflated), as a Map of name -> bytes.
export async function unzip(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.byteLength - 22; i >= Math.max(0, bytes.byteLength - 65557); i--)
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  if (eocd < 0) throw new Error("This SOG file is not a zip archive.");
  const entries = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const files = new Map();
  for (let e = 0; e < entries; e++) {
    if (dv.getUint32(p, true) !== 0x02014b50)
      throw new Error("This SOG file's zip index is damaged.");
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    const lnl = dv.getUint16(local + 26, true);
    const lel = dv.getUint16(local + 28, true);
    const start = local + 30 + lnl + lel;
    const data = bytes.subarray(start, start + csize);
    if (method === 0) files.set(name, data);
    else if (method === 8) files.set(name, await inflate(data, "deflate-raw"));
    else
      throw new Error(
        `This SOG file uses zip compression ${method}, which Splashery doesn't read.`,
      );
  }
  return files;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// A zip of stored (uncompressed) files: [[name, bytes], ...]. WebP pictures are compressed already.
export function zipStored(list) {
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  for (const [name, data] of list) {
    const nm = enc.encode(name);
    const crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint32(14, crc, true);
    h.setUint32(18, data.length, true);
    h.setUint32(22, data.length, true);
    h.setUint16(26, nm.length, true);
    parts.push(new Uint8Array(h.buffer), nm, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true);
    c.setUint32(24, data.length, true);
    c.setUint16(28, nm.length, true);
    c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), nm);
    offset += 30 + nm.length + data.length;
  }
  const cdSize = central.reduce((s, b) => s + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, list.length, true);
  end.setUint16(10, list.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((s, b) => s + b.length, 0));
  let o = 0;
  for (const b of all) {
    out.set(b, o);
    o += b.length;
  }
  return out;
}

// ---- SOG -------------------------------------------------------------------------------------

const QUAT_IDX = [1, 2, 3, 0, 2, 3, 0, 1, 3, 0, 1, 2]; // the three packed components, by largest
const invLog = (v) => {
  const e = Math.exp(Math.abs(v)) - 1;
  return v < 0 ? -e : e;
};
const fwdLog = (v) => Math.sign(v) * Math.log(Math.abs(v) + 1);

// files: a Map of name -> bytes (a zipped .sog's contents, or meta.json and its pictures).
export function readSog(files, webp) {
  const metaBytes =
    files.get("meta.json") || [...files].find(([k]) => k.endsWith("meta.json"))?.[1];
  if (!metaBytes) throw new Error("This SOG has no meta.json.");
  const meta = JSON.parse(new TextDecoder().decode(metaBytes));
  if (meta.version !== 2)
    throw new Error(meta.version === undefined
      ? "This is an older SOGS file (version 1). Open it in SuperSplat or splat-transform and save it again as SOG, or as PLY." // prettier-ignore
      : `SOG version ${meta.version} is not supported.`); // prettier-ignore
  const get = (name) => {
    const b = files.get(name) || [...files].find(([k]) => k.endsWith(`/${name}`))?.[1];
    if (!b) throw new Error(`This SOG is missing ${name}.`);
    const img = webp.decodeRGBA(b);
    return img;
  };
  const n = meta.count;
  const shBands = meta.shN && SH_COEFFS[meta.shN.bands] ? meta.shN.bands : 0;
  const per = SH_COEFFS[shBands];
  const t = emptyTable(n, shBands);
  const lo = get(meta.means.files[0]).rgba;
  const hi = get(meta.means.files[1]).rgba;
  const { mins, maxs } = meta.means;
  const span = [0, 1, 2].map((k) => maxs[k] - mins[k] || 1);
  const qt = get(meta.quats.files[0]).rgba;
  const sc = get(meta.scales.files[0]).rgba;
  const s0 = get(meta.sh0.files[0]).rgba;
  const sCode = meta.scales.codebook;
  const cCode = meta.sh0.codebook;
  for (const img of [lo, hi, qt, sc, s0]) if (img.length < n * 4) throw new Error("This SOG's pictures are too small for its count."); // prettier-ignore
  const q = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    t.x[i] = invLog(mins[0] + (span[0] * (lo[o] | (hi[o] << 8))) / 65535);
    t.y[i] = invLog(mins[1] + (span[1] * (lo[o + 1] | (hi[o + 1] << 8))) / 65535);
    t.z[i] = invLog(mins[2] + (span[2] * (lo[o + 2] | (hi[o + 2] << 8))) / 65535);
    const tag = qt[o + 3];
    if (tag < 252) {
      t.qw[i] = 1;
    } else {
      const m = tag - 252;
      const a = ((qt[o] / 255) * 2 - 1) / SQRT2;
      const b = ((qt[o + 1] / 255) * 2 - 1) / SQRT2;
      const c = ((qt[o + 2] / 255) * 2 - 1) / SQRT2;
      q[0] = q[1] = q[2] = q[3] = 0;
      q[QUAT_IDX[m * 3]] = a;
      q[QUAT_IDX[m * 3 + 1]] = b;
      q[QUAT_IDX[m * 3 + 2]] = c;
      q[m] = Math.sqrt(Math.max(0, 1 - (a * a + b * b + c * c)));
      t.qw[i] = q[0];
      t.qx[i] = q[1];
      t.qy[i] = q[2];
      t.qz[i] = q[3];
    }
    t.s0[i] = sCode[sc[o]];
    t.s1[i] = sCode[sc[o + 1]];
    t.s2[i] = sCode[sc[o + 2]];
    t.r[i] = cCode[s0[o]];
    t.g[i] = cCode[s0[o + 1]];
    t.b[i] = cCode[s0[o + 2]];
    t.opacity[i] = logit(s0[o + 3] / 255);
  }
  if (per) {
    const cen = get(meta.shN.files[0]);
    const lab = get(meta.shN.files[1]).rgba;
    const code = meta.shN.codebook;
    const cw = cen.width;
    for (let i = 0; i < n; i++) {
      const label = lab[i * 4] | (lab[i * 4 + 1] << 8);
      if (label >= meta.shN.count) continue;
      const cy = Math.floor(label / 64);
      const cx0 = (label % 64) * per;
      for (let j = 0; j < per; j++) {
        const idx = (cy * cw + cx0 + j) * 4;
        t.rest[j][i] = code[cen.rgba[idx]] ?? 0;
        t.rest[j + per][i] = code[cen.rgba[idx + 1]] ?? 0;
        t.rest[j + 2 * per][i] = code[cen.rgba[idx + 2]] ?? 0;
      }
    }
  }
  return t;
}

// 256 values that cover `values` well: quantiles, then a few rounds of 1D k-means on a histogram.
export function codebook256(values) {
  const n = values.length;
  if (!n) return new Array(256).fill(0);
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (hi - lo < 1e-12) return new Array(256).fill(lo);
  const B = 8192;
  const hist = new Float64Array(B);
  const w = (hi - lo) / B;
  for (let i = 0; i < n; i++) hist[Math.min(B - 1, Math.floor((values[i] - lo) / w))]++;
  const mid = (b) => lo + (b + 0.5) * w;
  // Quantile starts.
  const code = new Float64Array(256);
  let acc = 0;
  let k = 0;
  for (let b = 0; b < B && k < 256; b++) {
    acc += hist[b];
    while (k < 256 && acc >= ((k + 0.5) / 256) * n) code[k++] = mid(b);
  }
  while (k < 256) code[k++] = hi;
  for (let iter = 0; iter < 12; iter++) {
    const sum = new Float64Array(256);
    const cnt = new Float64Array(256);
    let c = 0;
    for (let b = 0; b < B; b++) {
      if (!hist[b]) continue;
      const v = mid(b);
      while (c < 255 && Math.abs(code[c + 1] - v) <= Math.abs(code[c] - v)) c++;
      sum[c] += v * hist[b];
      cnt[c] += hist[b];
    }
    for (let j = 0; j < 256; j++) if (cnt[j]) code[j] = sum[j] / cnt[j];
    code.sort();
  }
  code[0] = Math.min(code[0], lo);
  code[255] = Math.max(code[255], hi);
  return Array.from(code, (v) => Math.fround(v));
}

// Index of the nearest codebook entry (the codebook is sorted).
function nearest(code, v) {
  let a = 0;
  let b = 255;
  while (b - a > 1) {
    const m = (a + b) >> 1;
    if (code[m] <= v) a = m;
    else b = m;
  }
  return Math.abs(code[b] - v) < Math.abs(code[a] - v) ? b : a;
}

// SOG version 2, zipped, without view-dependent colors (degree 0). webp: the codec.
export function writeSog(t, webp) {
  const n = t.count;
  const w = Math.max(4, Math.ceil(Math.sqrt(n) / 4) * 4);
  const h = Math.max(4, Math.ceil(n / w / 4) * 4);
  const px = () => new Uint8Array(w * h * 4);
  const ml = px();
  const mu = px();
  const qt = px();
  const sc = px();
  const s0 = px();
  const mins = [Infinity, Infinity, Infinity];
  const maxs = [-Infinity, -Infinity, -Infinity];
  const pos = [t.x, t.y, t.z];
  for (let k = 0; k < 3; k++)
    for (let i = 0; i < n; i++) {
      const v = fwdLog(pos[k][i]);
      if (v < mins[k]) mins[k] = v;
      if (v > maxs[k]) maxs[k] = v;
    }
  if (!n) for (let k = 0; k < 3; k++) mins[k] = maxs[k] = 0;
  const allScales = new Float32Array(n * 3);
  allScales.set(t.s0, 0);
  allScales.set(t.s1, n);
  allScales.set(t.s2, 2 * n);
  const sCode = codebook256(allScales);
  const allColors = new Float32Array(n * 3);
  allColors.set(t.r, 0);
  allColors.set(t.g, n);
  allColors.set(t.b, 2 * n);
  const cCode = codebook256(allColors);
  const q = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    for (let k = 0; k < 3; k++) {
      const span = maxs[k] - mins[k] || 1;
      const v = Math.round(((fwdLog(pos[k][i]) - mins[k]) / span) * 65535);
      const c = v < 0 ? 0 : v > 65535 ? 65535 : v;
      ml[o + k] = c & 255;
      mu[o + k] = c >> 8;
    }
    ml[o + 3] = mu[o + 3] = 255;
    q[0] = t.qw[i];
    q[1] = t.qx[i];
    q[2] = t.qy[i];
    q[3] = t.qz[i];
    let m = 0;
    for (let j = 1; j < 4; j++) if (Math.abs(q[j]) > Math.abs(q[m])) m = j;
    const sgn = q[m] < 0 ? -1 : 1;
    for (let j = 0; j < 3; j++)
      qt[o + j] = clampByte(((q[QUAT_IDX[m * 3 + j]] * sgn * SQRT2 + 1) / 2) * 255);
    qt[o + 3] = 252 + m;
    sc[o] = nearest(sCode, t.s0[i]);
    sc[o + 1] = nearest(sCode, t.s1[i]);
    sc[o + 2] = nearest(sCode, t.s2[i]);
    sc[o + 3] = 255;
    s0[o] = nearest(cCode, t.r[i]);
    s0[o + 1] = nearest(cCode, t.g[i]);
    s0[o + 2] = nearest(cCode, t.b[i]);
    s0[o + 3] = clampByte(sigmoid(t.opacity[i]) * 255);
  }
  const meta = {
    version: 2,
    count: n,
    means: { mins, maxs, files: ["means_l.webp", "means_u.webp"] },
    scales: { codebook: sCode, files: ["scales.webp"] },
    quats: { files: ["quats.webp"] },
    sh0: { codebook: cCode, files: ["sh0.webp"] },
  };
  const enc = (rgba) => webp.encodeLosslessRGBA(rgba, w, h);
  return zipStored([
    ["meta.json", new TextEncoder().encode(JSON.stringify(meta))],
    ["means_l.webp", enc(ml)],
    ["means_u.webp", enc(mu)],
    ["quats.webp", enc(qt)],
    ["scales.webp", enc(sc)],
    ["sh0.webp", enc(s0)],
  ]);
}

// ---- One door for every format ----------------------------------------------------------------

// Reads a splat file by its name. `files` (optional) are the other files picked with it (an
// unzipped SOG's pictures). getWebp(): a promise of the WebP codec, asked for only by SOG.
export async function readSplatFile(bytes, name, { files = null, getWebp, onProgress } = {}) {
  const ext = extOf(name);
  let t;
  if (ext === "ply") t = readSplatPly(bytes, { onProgress });
  else if (ext === "splat") t = readDotSplat(bytes);
  else if (ext === "spz") t = await readSpz(bytes);
  else if (ext === "sog" || ext === "zip" || ext === "json") {
    const all =
      ext === "json" ? new Map([["meta.json", bytes], ...(files || [])]) : await unzip(bytes);
    if (!getWebp) throw new Error("Reading SOG needs the WebP codec.");
    t = readSog(all, await getWebp());
  } else if (ext === "ksplat")
    throw new Error(
      "KSPLAT files are not read yet. Save them as PLY or SOG in another tool first.",
    );
  else
    throw new Error(
      `The Splat toolkit reads .ply, .splat, .spz and .sog files, not .${ext || "?"}.`,
    );
  t.format = ext === "json" || ext === "zip" ? "sog" : ext;
  return t;
}

export const SAVE_FORMATS = {
  ply: { label: "PLY (every tool reads it; keeps everything)", ext: "ply" },
  spz: { label: "SPZ (about a tenth of the size; keeps the view-dependent colors)", ext: "spz" },
  sog: { label: "SOG (smallest; base colors only, no view-dependent shading)", ext: "sog" },
  splat: { label: ".splat (simple; base colors only)", ext: "splat" },
};

export async function writeSplatFile(t, format, { getWebp } = {}) {
  if (format === "ply") return writeSplatPly(t);
  if (format === "splat") return writeDotSplat(t);
  if (format === "spz") return writeSpz(t);
  if (format === "sog") return writeSog(t, await getWebp());
  throw new Error(`Unknown format ${format}.`);
}

// ---- Bounds ----------------------------------------------------------------------------------

export function boundsOf(t, idx = null) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const n = idx ? idx.length : t.count;
  for (let j = 0; j < n; j++) {
    const i = idx ? idx[j] : j;
    const x = t.x[i], y = t.y[i], z = t.z[i]; // prettier-ignore
    if (!(x === x && y === y && z === z)) continue; // NaN
    if (x < min[0]) min[0] = x;
    if (x > max[0]) max[0] = x;
    if (y < min[1]) min[1] = y;
    if (y > max[1]) max[1] = y;
    if (z < min[2]) min[2] = z;
    if (z > max[2]) max[2] = z;
  }
  if (min[0] === Infinity) return { min: [0, 0, 0], max: [0, 0, 0], size: [0, 0, 0] };
  return { min, max, size: [0, 1, 2].map((k) => max[k] - min[k]) };
}

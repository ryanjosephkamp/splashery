// Studio Models (lane Studio Models, "3D model files to splats"): the part the
// toy in studio-models.js and the Node tool tools/model-to-splats.mjs share.
// No DOM and no imports, so both can run it.
//
//   parseModel(bytes, fileName, { files })  a glTF 2.0 (.gltf, .glb), OBJ (+ MTL) or STL file -> a raw mesh
//   prepareModel(raw, { decodeImage })      textures decoded and mip-mapped, normals, edges, detail weights
//   sampleSurface(prep, count, options)     the splats that make the surface (flat discs lying on it)
//   wireGeometry(prep) + wireSplats(...)    the mesh's edges as thin streaks
//
// What it reads (and does not): meshes of triangles (strips and fans too),
// their normals, first or second UV set, vertex colors, and the base-color
// texture and factor of each material (also KHR_materials_pbrSpecularGlossiness
// and KHR_texture_transform). Not read: Draco- or meshopt-compressed glTF,
// morph targets, skinning (a skinned mesh shows in its bind pose), animations,
// lights and cameras, emissive colors, and any texture but the base color.
// Glass (a material with an alpha under one half) is left out, as splats
// cannot be see-through solids.

// ---- Small helpers ------------------------------------------------------------------

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The tier budgets for the toy's splats (the kit's count for the toy: the
// tier's default count times the recipe's density, capped at the tier's maximum).
export const MODEL_DENSITY = 1.5;
export const TIER_COUNTS = {
  low: { maxCount: 120000, defaultCount: 60000 },
  mid: { maxCount: 240000, defaultCount: 140000 },
  high: { maxCount: 300000, defaultCount: 200000 },
  max: { maxCount: 400000, defaultCount: 280000 },
};
export const MODEL_BUDGETS = Object.fromEntries(
  Object.entries(TIER_COUNTS).map(([tier, t]) => [
    tier,
    Math.round(Math.min(t.maxCount, t.defaultCount * MODEL_DENSITY)),
  ]),
);

export const CREASE_DEG = 32; // a fold sharper than this is a hard edge
const CREASE_COS = Math.cos((CREASE_DEG * Math.PI) / 180);
const ADJ_MAX_TRIS = 450000; // above this, no edge adjacency (detail weights and crisp edges)
const MAX_TRIS = 4000000;

const SRGB_TO_LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB_TO_LIN[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
const toSrgbF = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const LIN_TO_SRGB = new Float32Array(4097);
for (let i = 0; i <= 4096; i++) LIN_TO_SRGB[i] = toSrgbF(i / 4096);
const linToSrgb = (c) => LIN_TO_SRGB[c <= 0 ? 0 : c >= 1 ? 4096 : Math.round(c * 4096)];
export const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const linearToSrgb = toSrgbF;

const utf8 = (bytes) => new TextDecoder("utf-8").decode(bytes).replace(/^﻿/, "");
const baseName = (uri) =>
  decodeURIComponent(String(uri).split(/[?#]/)[0]).split(/[\\/]/).pop().toLowerCase();

// The files that came with the model, by lower-case file name: a Map, an object
// of name -> bytes, or an array of { name, bytes }.
function fileTable(files) {
  const t = new Map();
  if (!files) return t;
  if (files instanceof Map) for (const [k, v] of files) t.set(baseName(k), v);
  else if (Array.isArray(files)) for (const f of files) t.set(baseName(f.name), f.bytes);
  else for (const k of Object.keys(files)) t.set(baseName(k), files[k]);
  return t;
}

// Thrown when a glTF points at files that were not opened with it.
export class NeedsFilesError extends Error {
  constructor(names, what) {
    super(
      `This ${what} uses separate files (${names.join(", ")}) that were not opened with it. ` +
        "In the file dialog, select the model together with those files (hold Shift or Ctrl, or Command, to pick several), " +
        "or save the model as a single .glb (Blender: File > Export > glTF 2.0, format glTF Binary) and open that.",
    );
    this.names = names;
  }
}

// ---- Kinds of file ------------------------------------------------------------------

export function modelFormat(bytes, fileName = "") {
  const ext = String(fileName).toLowerCase().split(".").pop();
  if (bytes.length >= 4 && bytes[0] === 0x67 && bytes[1] === 0x6c && bytes[2] === 0x54 && bytes[3] === 0x46) return "glb"; // prettier-ignore
  if (ext === "glb") return "glb";
  if (ext === "gltf") return "gltf";
  if (ext === "obj") return "obj";
  if (ext === "stl") return "stl";
  const head = utf8(bytes.subarray(0, Math.min(bytes.length, 400))).trimStart();
  if (head.startsWith('{"asset"') || (head.startsWith("{") && /"asset"/.test(head))) return "gltf";
  if (/^solid[\s\S]*facet/i.test(head)) return "stl";
  if (/^(#|v |mtllib|o |g )/m.test(head)) return "obj";
  return "";
}

export function parseModel(bytes, fileName = "model", { files } = {}) {
  const format = modelFormat(bytes, fileName);
  const table = fileTable(files);
  const name = String(fileName).replace(/\.[^.]+$/, "") || "model";
  if (format === "glb" || format === "gltf") return { ...parseGltf(bytes, table), name, format };
  if (format === "obj") return { ...parseObj(utf8(bytes), table), name, format };
  if (format === "stl") return { ...parseStl(bytes), name, format };
  throw new Error("That is not a 3D model this toy can read. It reads glTF (.glb, .gltf), OBJ and STL files."); // prettier-ignore
}

// ---- Building a raw mesh --------------------------------------------------------------
// raw = { pos: Float32Array(3n), nor: Float32Array(3n) | null, uv: Float32Array(2n) | null,
//         col: Float32Array(4n) | null (linear), idx: Uint32Array(3t), mat: Uint16Array(t),
//         materials: [{ name, color: [r, g, b, a] (linear), tex, alphaMode, cutoff }],
//         images: [{ bytes, mime, name } | null], notes: [string] }

class Chunks {
  constructor() {
    this.list = [];
    this.n = 0;
    this.skipped = 0;
  }
  add(c) {
    const nv = c.pos.length / 3;
    if (!nv || !c.idx.length) return;
    this.list.push({ ...c, base: this.n });
    this.n += nv;
  }
  finish(materials, images, notes) {
    let nv = this.n;
    let nt = 0;
    for (const c of this.list) nt += c.idx.length / 3;
    const pos = new Float32Array(nv * 3);
    const useUv = this.list.some((c) => c.uv);
    const useCol = this.list.some((c) => c.col);
    const useNor = this.list.length > 0 && this.list.every((c) => c.nor);
    const uv = useUv ? new Float32Array(nv * 2) : null;
    const col = useCol ? new Float32Array(nv * 4).fill(1) : null;
    const nor = useNor ? new Float32Array(nv * 3) : null;
    const idx = new Uint32Array(nt * 3);
    const mat = new Uint16Array(nt);
    let ti = 0;
    for (const c of this.list) {
      pos.set(c.pos, c.base * 3);
      if (uv && c.uv) uv.set(c.uv, c.base * 2);
      if (col && c.col) col.set(c.col, c.base * 4);
      if (nor) nor.set(c.nor, c.base * 3);
      const nTri = c.idx.length / 3;
      for (let i = 0; i < c.idx.length; i++) idx[ti * 3 + i] = c.idx[i] + c.base;
      mat.fill(c.mat, ti, ti + nTri);
      ti += nTri;
    }
    if (nt > MAX_TRIS) throw new Error(`That model has ${nt.toLocaleString("en-US")} triangles; the most this toy reads is ${MAX_TRIS.toLocaleString("en-US")}.`); // prettier-ignore
    return { pos, nor, uv, col, idx, mat, materials, images, notes };
  }
}

const DEFAULT_MATERIAL = () => ({
  name: "default",
  color: [0.8, 0.8, 0.8, 1],
  tex: null,
  alphaMode: "OPAQUE",
  cutoff: 0.5,
});

// ---- glTF -----------------------------------------------------------------------------

const COMP = {
  5120: { n: 1, get: "getInt8", max: 127 },
  5121: { n: 1, get: "getUint8", max: 255 },
  5122: { n: 2, get: "getInt16", max: 32767 },
  5123: { n: 2, get: "getUint16", max: 65535 },
  5125: { n: 4, get: "getUint32", max: 4294967295 },
  5126: { n: 4, get: "getFloat32", max: 1 },
};
const TYPE_SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

function b64bytes(b64) {
  if (globalThis.Buffer) return new Uint8Array(globalThis.Buffer.from(b64, "base64"));
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function dataUri(uri) {
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(uri);
  if (!m) return null;
  return {
    mime: m[1],
    bytes: m[2] ? b64bytes(m[3]) : new TextEncoder().encode(decodeURIComponent(m[3])),
  };
}

function readAccessor(gl, buffers, ai, asIndex = false) {
  const a = gl.accessors?.[ai];
  if (!a) throw new Error("This glTF file points at an accessor that is not there.");
  const comp = COMP[a.componentType];
  const size = TYPE_SIZE[a.type];
  if (!comp || !size) throw new Error("This glTF file has an accessor this toy cannot read.");
  const n = a.count | 0;
  const out = asIndex ? new Uint32Array(n * size) : new Float32Array(n * size);
  const norm = !asIndex && a.normalized && a.componentType !== 5126;
  if (a.bufferView !== undefined) {
    const bv = gl.bufferViews[a.bufferView];
    const buf = buffers[bv.buffer];
    if (!buf) throw new Error("This glTF file is missing part of its data.");
    const stride = bv.byteStride || comp.n * size;
    const base = buf.byteOffset + (bv.byteOffset || 0) + (a.byteOffset || 0);
    if (base + (n > 0 ? (n - 1) * stride + comp.n * size : 0) > buf.byteOffset + buf.byteLength) {
      throw new Error("This glTF file's data is shorter than it says.");
    }
    if (a.componentType === 5126 && stride === 4 * size && base % 4 === 0 && !asIndex) {
      out.set(new Float32Array(buf.buffer, base, n * size));
    } else {
      const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      const get = dv[comp.get].bind(dv);
      const off0 = base - buf.byteOffset;
      for (let i = 0; i < n; i++) {
        const o = off0 + i * stride;
        for (let c = 0; c < size; c++) out[i * size + c] = get(o + c * comp.n, true);
      }
    }
  }
  if (norm) for (let i = 0; i < out.length; i++) out[i] = Math.max(-1, out[i] / comp.max);
  const sp = a.sparse;
  if (sp) {
    const ib = gl.bufferViews[sp.indices.bufferView];
    const vb = gl.bufferViews[sp.values.bufferView];
    const icomp = COMP[sp.indices.componentType];
    const ibuf = buffers[ib.buffer];
    const vbuf = buffers[vb.buffer];
    const idv = new DataView(ibuf.buffer, ibuf.byteOffset, ibuf.byteLength);
    const vdv = new DataView(vbuf.buffer, vbuf.byteOffset, vbuf.byteLength);
    const vget = vdv[comp.get].bind(vdv);
    for (let i = 0; i < sp.count; i++) {
      const at = idv[icomp.get]((ib.byteOffset || 0) + (sp.indices.byteOffset || 0) + i * icomp.n, true); // prettier-ignore
      for (let c = 0; c < size; c++) {
        let v = vget((vb.byteOffset || 0) + (sp.values.byteOffset || 0) + (i * size + c) * comp.n, true); // prettier-ignore
        if (norm) v = Math.max(-1, v / comp.max);
        out[at * size + c] = v;
      }
    }
  }
  return out;
}

// Column-major 4x4 matrices.
function matMul(a, b) {
  const o = new Float64Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  return o;
}
function nodeMatrix(n) {
  if (n.matrix) return Float64Array.from(n.matrix);
  const [x, y, z, w] = n.rotation || [0, 0, 0, 1];
  const [sx, sy, sz] = n.scale || [1, 1, 1];
  const [tx, ty, tz] = n.translation || [0, 0, 0];
  const l = Math.hypot(x, y, z, w) || 1;
  const qx = x / l;
  const qy = y / l;
  const qz = z / l;
  const qw = w / l;
  return Float64Array.from([
    (1 - 2 * (qy * qy + qz * qz)) * sx,
    2 * (qx * qy + qz * qw) * sx,
    2 * (qx * qz - qy * qw) * sx,
    0, // prettier-ignore
    2 * (qx * qy - qz * qw) * sy,
    (1 - 2 * (qx * qx + qz * qz)) * sy,
    2 * (qy * qz + qx * qw) * sy,
    0, // prettier-ignore
    2 * (qx * qz + qy * qw) * sz,
    2 * (qy * qz - qx * qw) * sz,
    (1 - 2 * (qx * qx + qy * qy)) * sz,
    0, // prettier-ignore
    tx,
    ty,
    tz,
    1,
  ]);
}
// The inverse transpose of a matrix's upper 3x3, and its determinant.
function normalMatrix(m) {
  const a = m[0], b = m[4], c = m[8], d = m[1], e = m[5], f = m[9], g = m[2], h = m[6], i = m[10]; // prettier-ignore
  const A = e * i - f * h;
  const B = f * g - d * i;
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  const s = det ? 1 / det : 0;
  return {
    det,
    m: [
      A * s, B * s, C * s,
      (c * h - b * i) * s, (a * i - c * g) * s, (b * g - a * h) * s,
      (b * f - c * e) * s, (c * d - a * f) * s, (a * e - b * d) * s,
    ], // prettier-ignore
  };
}

export function parseGltf(bytes, table) {
  let json;
  let bin = null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 12 && dv.getUint32(0, true) === 0x46546c67) {
    if (dv.getUint32(4, true) !== 2) throw new Error("This is an old glTF binary (not version 2), which this toy cannot read."); // prettier-ignore
    let p = 12;
    while (p + 8 <= bytes.length) {
      const len = dv.getUint32(p, true);
      const type = dv.getUint32(p + 4, true);
      p += 8;
      if (type === 0x4e4f534a) json = JSON.parse(utf8(bytes.subarray(p, p + len)));
      else if (type === 0x004e4942 && !bin) bin = bytes.subarray(p, p + len);
      p += len;
    }
    if (!json) throw new Error("This glTF binary has no scene description in it.");
  } else {
    try {
      json = JSON.parse(utf8(bytes));
    } catch {
      throw new Error("This is not a glTF file the toy can read (the JSON is broken).");
    }
  }
  if (!json.asset || !/^2/.test(String(json.asset.version))) {
    throw new Error("Only glTF 2.0 files can be read (this one is an older version).");
  }
  const needs = new Set([...(json.extensionsRequired || []), ...(json.extensionsUsed || [])]);
  if (needs.has("KHR_draco_mesh_compression") || needs.has("EXT_meshopt_compression")) {
    throw new Error("This glTF is compressed with Draco or meshopt, which this toy does not read. Export it again without mesh compression (in Blender the export option is off by default; in glTF-Transform run `gltf-transform decompress`)."); // prettier-ignore
  }
  const notes = [];
  const missing = [];
  const fetchUri = (uri) => {
    const d = dataUri(uri);
    if (d) return d;
    const b = table.get(baseName(uri));
    if (!b) {
      missing.push(baseName(uri));
      return null;
    }
    return { bytes: b, mime: "" };
  };
  const buffers = (json.buffers || []).map((b, i) => {
    if (b.uri === undefined) return i === 0 ? bin : null;
    return fetchUri(b.uri)?.bytes ?? null;
  });
  if (missing.length) throw new NeedsFilesError([...new Set(missing)], "glTF file");
  if ((json.buffers || []).some((b, i) => !buffers[i])) {
    throw new Error("This glTF file is missing its data.");
  }
  // Images, only those the materials use (a missing texture leaves its material's color).
  const images = [];
  const image = (si) => {
    if (si === undefined || si === null) return -1;
    if (images[si] !== undefined) return images[si] ? si : -1;
    const im = json.images?.[si];
    let got = null;
    if (im?.bufferView !== undefined) {
      const bv = json.bufferViews[im.bufferView];
      const buf = buffers[bv.buffer];
      got = {
        bytes: buf.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength),
        mime: im.mimeType || "",
      };
    } else if (im?.uri !== undefined) {
      const d = dataUri(im.uri);
      if (d) got = d;
      else if (table.get(baseName(im.uri))) got = { bytes: table.get(baseName(im.uri)), mime: "" };
      else notes.push(`The texture ${baseName(im.uri)} was not opened with the model, so its color is left out.`); // prettier-ignore
    }
    if (got) {
      const mime = got.mime || (got.bytes[0] === 0x89 ? "image/png" : "image/jpeg");
      images[si] = {
        bytes: got.bytes,
        mime,
        name: im.name || im.uri?.slice(0, 40) || `image ${si}`,
      };
      return si;
    }
    images[si] = null;
    return -1;
  };
  const texRef = (info) => {
    if (!info) return null;
    const t = json.textures?.[info.index];
    if (!t) return null;
    const source = t.source ?? t.extensions?.EXT_texture_webp?.source;
    if (source === undefined) {
      notes.push("A texture in a format this toy cannot read (Basis or KTX) was left out.");
      return null;
    }
    const img = image(source);
    if (img < 0) return null;
    const s = json.samplers?.[t.sampler] || {};
    const tt = info.extensions?.KHR_texture_transform;
    return {
      image: img,
      texCoord: info.texCoord ?? tt?.texCoord ?? 0,
      wrapS: s.wrapS ?? 10497,
      wrapT: s.wrapT ?? 10497,
      nearest: s.magFilter === 9728, // a texture drawn in hard pixels (a palette) stays in hard pixels
      transform: tt
        ? { offset: tt.offset || [0, 0], rotation: tt.rotation || 0, scale: tt.scale || [1, 1] }
        : null,
    };
  };
  const materials = (json.materials || []).map((m, i) => {
    const pbr = m.pbrMetallicRoughness || {};
    let color = pbr.baseColorFactor || [1, 1, 1, 1];
    let info = pbr.baseColorTexture;
    const sg = m.extensions?.KHR_materials_pbrSpecularGlossiness;
    if (sg) {
      color = sg.diffuseFactor || [1, 1, 1, 1];
      info = sg.diffuseTexture;
    }
    return {
      name: m.name || `material ${i}`,
      color: color.slice(0, 4),
      tex: texRef(info),
      alphaMode: m.alphaMode || "OPAQUE",
      cutoff: m.alphaCutoff ?? 0.5,
    };
  });
  const defaultMat = materials.length;
  materials.push({ ...DEFAULT_MATERIAL(), color: [1, 1, 1, 1] }); // glTF's default is white
  // Nodes to meshes, with their world matrices.
  const nodes = json.nodes || [];
  let roots = json.scenes?.[json.scene ?? 0]?.nodes;
  if (!roots) {
    const child = new Set();
    for (const n of nodes) for (const c of n.children || []) child.add(c);
    roots = nodes.map((_, i) => i).filter((i) => !child.has(i));
  }
  if (!nodes.length && json.meshes?.length) roots = [];
  const chunks = new Chunks();
  let skinned = false;
  let skippedModes = 0;
  const addMesh = (mesh, m) => {
    const nm = normalMatrix(m);
    for (const prim of mesh.primitives || []) {
      const mode = prim.mode ?? 4;
      if (mode < 4 || mode > 6) {
        skippedModes++;
        continue;
      }
      const at = prim.attributes || {};
      if (at.POSITION === undefined) continue;
      if (prim.extensions?.KHR_draco_mesh_compression) {
        throw new Error("This glTF is compressed with Draco, which this toy does not read.");
      }
      const p0 = readAccessor(json, buffers, at.POSITION);
      const nv = p0.length / 3;
      const pos = new Float32Array(nv * 3);
      for (let i = 0; i < nv; i++) {
        const x = p0[i * 3];
        const y = p0[i * 3 + 1];
        const z = p0[i * 3 + 2];
        pos[i * 3] = m[0] * x + m[4] * y + m[8] * z + m[12];
        pos[i * 3 + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
        pos[i * 3 + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
      }
      let nor = null;
      if (at.NORMAL !== undefined) {
        const n0 = readAccessor(json, buffers, at.NORMAL);
        nor = new Float32Array(nv * 3);
        const q = nm.m;
        for (let i = 0; i < nv; i++) {
          const x = n0[i * 3];
          const y = n0[i * 3 + 1];
          const z = n0[i * 3 + 2];
          const nx = q[0] * x + q[3] * y + q[6] * z;
          const ny = q[1] * x + q[4] * y + q[7] * z;
          const nz = q[2] * x + q[5] * y + q[8] * z;
          const l = Math.hypot(nx, ny, nz) || 1;
          nor[i * 3] = nx / l;
          nor[i * 3 + 1] = ny / l;
          nor[i * 3 + 2] = nz / l;
        }
      }
      const mi =
        prim.material !== undefined && materials[prim.material] ? prim.material : defaultMat;
      const uvSet = materials[mi].tex?.texCoord ?? 0;
      const uvAt = at[`TEXCOORD_${uvSet}`] ?? at.TEXCOORD_0;
      const uv = uvAt !== undefined ? readAccessor(json, buffers, uvAt) : null;
      let col = null;
      if (at.COLOR_0 !== undefined) {
        const c0 = readAccessor(json, buffers, at.COLOR_0);
        const cs = c0.length / nv;
        col = new Float32Array(nv * 4);
        for (let i = 0; i < nv; i++) {
          col[i * 4] = c0[i * cs];
          col[i * 4 + 1] = c0[i * cs + 1];
          col[i * 4 + 2] = c0[i * cs + 2];
          col[i * 4 + 3] = cs === 4 ? c0[i * cs + 3] : 1;
        }
      }
      if (at.JOINTS_0 !== undefined) skinned = true;
      let ind = prim.indices !== undefined ? readAccessor(json, buffers, prim.indices, true) : null;
      if (!ind) {
        ind = new Uint32Array(nv);
        for (let i = 0; i < nv; i++) ind[i] = i;
      }
      let tris;
      if (mode === 4) tris = ind.subarray(0, ind.length - (ind.length % 3));
      else {
        const n = Math.max(0, ind.length - 2);
        tris = new Uint32Array(n * 3);
        for (let i = 0; i < n; i++) {
          if (mode === 5) {
            tris[i * 3] = ind[i + (i & 1)];
            tris[i * 3 + 1] = ind[i + 1 - (i & 1)];
            tris[i * 3 + 2] = ind[i + 2];
          } else {
            tris[i * 3] = ind[0];
            tris[i * 3 + 1] = ind[i + 1];
            tris[i * 3 + 2] = ind[i + 2];
          }
        }
      }
      if (nm.det < 0) {
        tris = Uint32Array.from(tris);
        for (let i = 0; i < tris.length; i += 3) {
          const t = tris[i + 1];
          tris[i + 1] = tris[i + 2];
          tris[i + 2] = t;
        }
      }
      for (let i = 0; i < tris.length; i++) {
        if (tris[i] >= nv)
          throw new Error("This glTF file has a triangle that points past its vertices.");
      }
      chunks.add({ pos, nor, uv, col, idx: tris, mat: mi });
    }
  };
  const seen = new Set();
  const walk = (ni, parent, depth) => {
    if (depth > 64 || seen.has(ni)) return;
    seen.add(ni);
    const n = nodes[ni];
    if (!n) return;
    const m = matMul(parent, nodeMatrix(n));
    if (n.mesh !== undefined && json.meshes?.[n.mesh]) addMesh(json.meshes[n.mesh], m);
    for (const c of n.children || []) walk(c, m, depth + 1);
    seen.delete(ni);
  };
  const I = Float64Array.from([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  for (const r of roots) walk(r, I, 0);
  if (!chunks.list.length && json.meshes?.length && !nodes.length) {
    for (const mesh of json.meshes) addMesh(mesh, I);
  }
  if (skinned)
    notes.push("It has a skeleton; it is shown in its bind pose, and animation is not played.");
  if (skippedModes)
    notes.push("Points and lines in the file were left out (only triangles become splats).");
  if (!chunks.list.length) throw new Error("That glTF file has no triangles to convert.");
  return chunks.finish(materials, images, notes);
}

// ---- OBJ and MTL ------------------------------------------------------------------------

function parseMtl(text, table, notes, materials, byName, images) {
  let cur = null;
  const image = (file) => {
    const b = table.get(baseName(file));
    if (!b) {
      notes.push(
        `The texture ${baseName(file)} was not opened with the model, so its color is left out.`,
      );
      return null;
    }
    const mime = /\.png$/i.test(file)
      ? "image/png"
      : /\.webp$/i.test(file)
        ? "image/webp"
        : "image/jpeg";
    images.push({ bytes: b, mime, name: baseName(file) });
    return images.length - 1;
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line[0] === "#") continue;
    if (cur && cur.color[3] < 0.999) cur.alphaMode = "BLEND";
    const sp = line.split(/\s+/);
    const key = sp[0].toLowerCase();
    if (key === "newmtl") {
      cur = { name: sp.slice(1).join(" "), color: [0.8, 0.8, 0.8, 1], tex: null, alphaMode: "OPAQUE", cutoff: 0.5 }; // prettier-ignore
      byName.set(cur.name, materials.length);
      materials.push(cur);
    } else if (!cur) continue;
    else if (key === "kd" && sp.length >= 4) {
      // MTL colors are authored as display colors.
      cur.color[0] = srgbToLinear(Math.min(1, Math.max(0, +sp[1])));
      cur.color[1] = srgbToLinear(Math.min(1, Math.max(0, +sp[2])));
      cur.color[2] = srgbToLinear(Math.min(1, Math.max(0, +sp[3])));
    } else if (key === "d" && sp.length >= 2) cur.color[3] = +sp[1];
    else if (key === "tr" && sp.length >= 2) cur.color[3] = 1 - +sp[1];
    else if (key === "map_kd" && sp.length >= 2) {
      const im = image(sp[sp.length - 1]);
      if (im !== null) cur.tex = { image: im, texCoord: 0, wrapS: 10497, wrapT: 10497, transform: null }; // prettier-ignore
    }
  }
}

export function parseObj(text, table) {
  const notes = [];
  const V = [];
  const VC = []; // vertex colors some exporters put after x y z
  const VT = [];
  const VN = [];
  const materials = [];
  const images = [];
  const byName = new Map();
  // Materials first (mtllib may come before or after; read them all up front).
  const mtlNames = [];
  for (const m of text.matchAll(/^mtllib[ \t]+(.+)$/gm)) mtlNames.push(m[1].trim());
  const missingMtl = [];
  for (const name of mtlNames) {
    const b = table.get(baseName(name));
    if (b) parseMtl(utf8(b), table, notes, materials, byName, images);
    else missingMtl.push(baseName(name));
  }
  if (missingMtl.length) notes.push(`The material file ${missingMtl.join(", ")} was not opened with the model, so it is shown in gray.`); // prettier-ignore
  let defaultMat = -1;
  const matIndex = (name) => {
    if (byName.has(name)) return byName.get(name);
    if (defaultMat < 0) {
      defaultMat = materials.length;
      materials.push(DEFAULT_MATERIAL());
    }
    return defaultMat;
  };
  // Expanded vertices: one per distinct v/vt/vn combination.
  const pos = [];
  const uv = [];
  const nor = [];
  const col = [];
  const cache = new Map();
  let hasUv = false;
  let hasNor = false;
  let hasCol = false;
  const idx = [];
  const triMat = [];
  let mat = -1;
  const fix = (i, n) => (i < 0 ? n + i : i - 1);
  const corner = (tok) => {
    const p = tok.split("/");
    const vi = fix(+p[0], V.length / 3);
    const ti = p.length > 1 && p[1] !== "" ? fix(+p[1], VT.length / 2) : -1;
    const ni = p.length > 2 && p[2] !== "" ? fix(+p[2], VN.length / 3) : -1;
    if (!(vi >= 0 && vi < V.length / 3)) return -1;
    const key = (vi * (VT.length / 2 + 2) + ti + 1) * (VN.length / 3 + 2) + ni + 1;
    let id = cache.get(key);
    if (id !== undefined) return id;
    id = pos.length / 3;
    pos.push(V[vi * 3], V[vi * 3 + 1], V[vi * 3 + 2]);
    if (ti >= 0 && ti < VT.length / 2) {
      uv.push(VT[ti * 2], VT[ti * 2 + 1]);
      hasUv = true;
    } else uv.push(0, 0);
    if (ni >= 0 && ni < VN.length / 3) {
      nor.push(VN[ni * 3], VN[ni * 3 + 1], VN[ni * 3 + 2]);
      hasNor = true;
    } else nor.push(0, 0, 0);
    if (VC[vi * 3] !== undefined) {
      col.push(srgbToLinear(VC[vi * 3]), srgbToLinear(VC[vi * 3 + 1]), srgbToLinear(VC[vi * 3 + 2]), 1); // prettier-ignore
      hasCol = true;
    } else col.push(1, 1, 1, 1);
    cache.set(key, id);
    return id;
  };
  let bigPolys = 0;
  for (const raw of text.split("\n")) {
    const c = raw.charCodeAt(0);
    // Only lines that start v, vt, vn, f, usemtl matter.
    if (c === 118 /* v */) {
      const sp = raw.trim().split(/\s+/);
      if (sp[0] === "v") {
        V.push(+sp[1], +sp[2], +sp[3]);
        if (sp.length >= 7) VC.push(+sp[4], +sp[5], +sp[6]);
        else if (VC.length) VC.push(NaN, NaN, NaN);
      } else if (sp[0] === "vt") VT.push(+sp[1], sp.length > 2 ? +sp[2] : 0);
      else if (sp[0] === "vn") VN.push(+sp[1], +sp[2], +sp[3]);
    } else if (c === 102 /* f */ && /^f\s/.test(raw)) {
      const sp = raw.trim().split(/\s+/);
      const ids = [];
      for (let i = 1; i < sp.length; i++) {
        const id = corner(sp[i]);
        if (id >= 0) ids.push(id);
      }
      if (ids.length > 4) bigPolys++;
      for (let i = 1; i + 1 < ids.length; i++) {
        idx.push(ids[0], ids[i], ids[i + 1]);
        triMat.push(mat < 0 ? matIndex("") : mat);
      }
    } else if (c === 117 /* u */ && raw.startsWith("usemtl")) {
      mat = matIndex(raw.slice(6).trim());
    }
  }
  if (!idx.length) throw new Error("That OBJ file has no faces to convert.");
  if (bigPolys) notes.push("Faces with more than four sides are cut into a fan of triangles, which can be off for a non-convex face."); // prettier-ignore
  if (!materials.length) materials.push(DEFAULT_MATERIAL());
  const nv = pos.length / 3;
  const raw = {
    pos: Float32Array.from(pos),
    nor: null,
    uv: hasUv ? Float32Array.from(uv) : null,
    col: hasCol ? Float32Array.from(col) : null,
    idx: Uint32Array.from(idx),
    mat: Uint16Array.from(triMat),
    materials,
    images,
    notes,
  };
  // Vertex normals only where the file gave every corner one.
  if (hasNor) {
    let all = true;
    for (let i = 0; i < nv && all; i++) {
      if (!nor[i * 3] && !nor[i * 3 + 1] && !nor[i * 3 + 2]) all = false;
    }
    if (all) raw.nor = Float32Array.from(nor);
  }
  return raw;
}

// ---- STL (binary and ASCII) -------------------------------------------------------------

export function parseStl(bytes) {
  const notes = [];
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const nBin = bytes.length >= 84 ? dv.getUint32(80, true) : 0;
  let pos;
  if (bytes.length >= 84 && 84 + nBin * 50 === bytes.length) {
    pos = new Float32Array(nBin * 9);
    for (let i = 0; i < nBin; i++) {
      const o = 84 + i * 50 + 12;
      for (let k = 0; k < 9; k++) pos[i * 9 + k] = dv.getFloat32(o + k * 4, true);
    }
  } else {
    const text = utf8(bytes);
    const v = [];
    const re = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/g;
    let m;
    while ((m = re.exec(text))) v.push(+m[1], +m[2], +m[3]);
    if (v.length < 9) {
      if (bytes.length >= 84 && 84 + nBin * 50 <= bytes.length && nBin > 0) {
        pos = new Float32Array(nBin * 9);
        for (let i = 0; i < nBin; i++) {
          const o = 84 + i * 50 + 12;
          for (let k = 0; k < 9; k++) pos[i * 9 + k] = dv.getFloat32(o + k * 4, true);
        }
      } else throw new Error("That STL file has no triangles to convert.");
    } else pos = Float32Array.from(v.slice(0, v.length - (v.length % 9)));
  }
  // Drop triangles with a bad number.
  const keep = [];
  for (let t = 0; t < pos.length / 9; t++) {
    let ok = true;
    for (let k = 0; k < 9; k++) if (!Number.isFinite(pos[t * 9 + k])) ok = false;
    if (ok) keep.push(t);
  }
  if (!keep.length) throw new Error("That STL file has no triangles to convert.");
  if (keep.length !== pos.length / 9) {
    const p2 = new Float32Array(keep.length * 9);
    keep.forEach((t, i) => p2.set(pos.subarray(t * 9, t * 9 + 9), i * 9));
    pos = p2;
  }
  const nt = pos.length / 9;
  const idx = new Uint32Array(nt * 3);
  for (let i = 0; i < idx.length; i++) idx[i] = i;
  notes.push("STL files carry no color, so it is shown in gray.");
  return {
    pos,
    nor: null,
    uv: null,
    col: null,
    idx,
    mat: new Uint16Array(nt),
    materials: [{ ...DEFAULT_MATERIAL(), color: [0.62, 0.64, 0.68, 1] }],
    images: [],
    notes,
  };
}

// ---- Textures ---------------------------------------------------------------------------

// A box-filtered mip chain of an RGBA8 image ({ w, h, data }): levels[0] is the image.
export function mipChain(img) {
  const levels = [img];
  let cur = img;
  while (cur.w > 1 || cur.h > 1) {
    const w = Math.max(1, cur.w >> 1);
    const h = Math.max(1, cur.h >> 1);
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      const y0 = Math.min(cur.h - 1, y * 2);
      const y1 = Math.min(cur.h - 1, y * 2 + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.min(cur.w - 1, x * 2);
        const x1 = Math.min(cur.w - 1, x * 2 + 1);
        const a = (y0 * cur.w + x0) * 4;
        const b = (y0 * cur.w + x1) * 4;
        const c = (y1 * cur.w + x0) * 4;
        const d = (y1 * cur.w + x1) * 4;
        const o = (y * w + x) * 4;
        for (let k = 0; k < 4; k++) {
          data[o + k] = (cur.data[a + k] + cur.data[b + k] + cur.data[c + k] + cur.data[d + k] + 2) >> 2; // prettier-ignore
        }
      }
    }
    cur = { w, h, data };
    levels.push(cur);
  }
  return { w: img.w, h: img.h, levels };
}

const wrapIdx = (i, n, mode) => {
  if (mode === 33071) return i < 0 ? 0 : i >= n ? n - 1 : i; // clamp
  if (mode === 33648) {
    const p = ((i % (2 * n)) + 2 * n) % (2 * n); // mirror
    return p < n ? p : 2 * n - 1 - p;
  }
  return ((i % n) + n) % n;
};

const _px = [0, 0, 0, 0];
// One bilinear lookup on a level, into `out` (r, g, b, a in 0..1).
function bilinear(level, u, v, ws, wt, out, acc, weight) {
  const x = u * level.w - 0.5;
  const y = v * level.h - 0.5;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const xa = wrapIdx(x0, level.w, ws);
  const xb = wrapIdx(x0 + 1, level.w, ws);
  const ya = wrapIdx(y0, level.h, wt);
  const yb = wrapIdx(y0 + 1, level.h, wt);
  const d = level.data;
  const a = (ya * level.w + xa) * 4;
  const b = (ya * level.w + xb) * 4;
  const c = (yb * level.w + xa) * 4;
  const e = (yb * level.w + xb) * 4;
  const w00 = (1 - fx) * (1 - fy);
  const w10 = fx * (1 - fy);
  const w01 = (1 - fx) * fy;
  const w11 = fx * fy;
  for (let k = 0; k < 4; k++) {
    const val = d[a + k] * w00 + d[b + k] * w10 + d[c + k] * w01 + d[e + k] * w11;
    if (acc) out[k] += (val / 255) * weight;
    else out[k] = val / 255;
  }
}

// Trilinear lookup: `lod` is the mip level (fractional). Returns [r, g, b, a] in 0..1.
export function sampleMip(tex, u, v, lod, ws = 10497, wt = 10497, out = _px, nearest = false) {
  if (nearest && lod <= 0) {
    const L = tex.levels[0];
    const x = wrapIdx(Math.floor((ws === 33071 ? Math.min(1, Math.max(0, u)) : u - Math.floor(u)) * L.w), L.w, ws); // prettier-ignore
    const y = wrapIdx(Math.floor((wt === 33071 ? Math.min(1, Math.max(0, v)) : v - Math.floor(v)) * L.h), L.h, wt); // prettier-ignore
    const o = (y * L.w + x) * 4;
    for (let k = 0; k < 4; k++) out[k] = L.data[o + k] / 255;
    return out;
  }
  const top = tex.levels.length - 1;
  const l = lod <= 0 ? 0 : lod >= top ? top : lod;
  const l0 = Math.floor(l);
  const f = l - l0;
  const uu = ws === 33071 ? Math.min(1, Math.max(0, u)) : u - Math.floor(u);
  const vv = wt === 33071 ? Math.min(1, Math.max(0, v)) : v - Math.floor(v);
  if (f < 0.02 || l0 >= top) {
    bilinear(tex.levels[l0], uu, vv, ws, wt, out, false, 1);
    return out;
  }
  out[0] = out[1] = out[2] = out[3] = 0;
  bilinear(tex.levels[l0], uu, vv, ws, wt, out, true, 1 - f);
  bilinear(tex.levels[l0 + 1], uu, vv, ws, wt, out, true, f);
  return out;
}

// ---- Preparing a mesh -------------------------------------------------------------------

const W_KEY = 131072; // 2^17

// Welds vertices by position; returns { id: Int32Array(nv), n }.
function weld(pos, nv, diag) {
  const q = 65535 / (diag || 1);
  let lx = Infinity;
  let ly = Infinity;
  let lz = Infinity;
  for (let i = 0; i < nv; i++) {
    if (pos[i * 3] < lx) lx = pos[i * 3];
    if (pos[i * 3 + 1] < ly) ly = pos[i * 3 + 1];
    if (pos[i * 3 + 2] < lz) lz = pos[i * 3 + 2];
  }
  const id = new Int32Array(nv);
  const map = new Map();
  let n = 0;
  for (let i = 0; i < nv; i++) {
    const key =
      (Math.round((pos[i * 3] - lx) * q) * W_KEY + Math.round((pos[i * 3 + 1] - ly) * q)) * W_KEY +
      Math.round((pos[i * 3 + 2] - lz) * q);
    let w = map.get(key);
    if (w === undefined) {
      w = n++;
      map.set(key, w);
    }
    id[i] = w;
  }
  return { id, n };
}

// Prepares a raw mesh (from parseModel) for sampling. `decodeImage(bytes, mime)`
// returns { w, h, data: Uint8Array RGBA } (or throws; that texture is then left out).
export async function prepareModel(raw, { decodeImage } = {}) {
  const notes = raw.notes.slice();
  const { pos, idx } = raw;
  const nv = pos.length / 3;
  // Textures, only those in use.
  const mips = new Map();
  const materials = [];
  for (const m of raw.materials) {
    const M = {
      name: m.name,
      color: m.color,
      rgb: m.color.slice(0, 3).map((c) => linToSrgb(c)),
      alpha: m.color[3],
      alphaMode: m.alphaMode,
      cutoff: m.cutoff,
      mip: null,
      wrapS: 10497,
      wrapT: 10497,
      nearest: false,
      transform: null,
    };
    if (m.tex && decodeImage) {
      if (!mips.has(m.tex.image)) {
        const im = raw.images[m.tex.image];
        try {
          const dec = await decodeImage(im.bytes, im.mime);
          mips.set(m.tex.image, mipChain(dec));
        } catch (err) {
          notes.push(`A texture (${im.name}) could not be read here, so its color is left out.`);
          mips.set(m.tex.image, null);
        }
      }
      M.mip = mips.get(m.tex.image);
      M.wrapS = m.tex.wrapS;
      M.wrapT = m.tex.wrapT;
      M.nearest = !!m.tex.nearest;
      M.transform = m.tex.transform;
    }
    materials.push(M);
  }
  // Bounds, then triangles: drop the empty ones.
  let lx = Infinity;
  let ly = Infinity;
  let lz = Infinity;
  let hx = -Infinity;
  let hy = -Infinity;
  let hz = -Infinity;
  for (let i = 0; i < nv; i++) {
    const x = pos[i * 3];
    const y = pos[i * 3 + 1];
    const z = pos[i * 3 + 2];
    if (x < lx) lx = x;
    if (y < ly) ly = y;
    if (z < lz) lz = z;
    if (x > hx) hx = x;
    if (y > hy) hy = y;
    if (z > hz) hz = z;
  }
  const bbox = { min: [lx, ly, lz], max: [hx, hy, hz] };
  const diag = Math.hypot(hx - lx, hy - ly, hz - lz) || 1;
  const keep = [];
  const fn0 = [];
  const ar0 = [];
  let totalArea = 0;
  for (let t = 0; t < idx.length / 3; t++) {
    const a = idx[t * 3] * 3;
    const b = idx[t * 3 + 1] * 3;
    const c = idx[t * 3 + 2] * 3;
    const e1x = pos[b] - pos[a];
    const e1y = pos[b + 1] - pos[a + 1];
    const e1z = pos[b + 2] - pos[a + 2];
    const e2x = pos[c] - pos[a];
    const e2y = pos[c + 1] - pos[a + 1];
    const e2z = pos[c + 2] - pos[a + 2];
    const cx = e1y * e2z - e1z * e2y;
    const cy = e1z * e2x - e1x * e2z;
    const cz = e1x * e2y - e1y * e2x;
    const l = Math.hypot(cx, cy, cz);
    if (!(l > 1e-12 * diag * diag)) continue;
    keep.push(t);
    fn0.push(cx / l, cy / l, cz / l);
    ar0.push(l / 2);
    totalArea += l / 2;
  }
  const nt = keep.length;
  if (!nt) throw new Error("That model has no surface to convert (every triangle is empty).");
  const tri = new Uint32Array(nt * 3);
  const mat = new Uint16Array(nt);
  for (let i = 0; i < nt; i++) {
    const t = keep[i];
    tri[i * 3] = idx[t * 3];
    tri[i * 3 + 1] = idx[t * 3 + 1];
    tri[i * 3 + 2] = idx[t * 3 + 2];
    mat[i] = Math.min(raw.mat[t], materials.length - 1);
  }
  const fn = Float32Array.from(fn0);
  const area = Float32Array.from(ar0);
  // UV density (uv units per unit of length), for choosing a texture level.
  const uvd = new Float32Array(nt);
  if (raw.uv) {
    for (let i = 0; i < nt; i++) {
      const a = tri[i * 3];
      const b = tri[i * 3 + 1];
      const c = tri[i * 3 + 2];
      const d1u = raw.uv[b * 2] - raw.uv[a * 2];
      const d1v = raw.uv[b * 2 + 1] - raw.uv[a * 2 + 1];
      const d2u = raw.uv[c * 2] - raw.uv[a * 2];
      const d2v = raw.uv[c * 2 + 1] - raw.uv[a * 2 + 1];
      uvd[i] = Math.sqrt(Math.abs(d1u * d2v - d2u * d1v) / 2 / area[i]);
    }
  }
  // Welding, edge adjacency and the crease-smoothed normals.
  const cn = new Float32Array(nt * 9);
  const hard = new Uint8Array(nt);
  const crease = new Uint8Array(nt); // the folds only (not open borders), which shrink splats
  const weight = new Float32Array(nt).fill(1);
  let edges = null;
  const useAdj = nt <= ADJ_MAX_TRIS;
  let wId = null;
  if (useAdj) {
    const w = weld(pos, nv, diag);
    wId = w.id;
    const nw = w.n;
    const half = nt * 3;
    const nbr = new Int32Array(half).fill(-1);
    const seen = new Map();
    for (let t = 0; t < nt; t++) {
      for (let e = 0; e < 3; e++) {
        const va = wId[tri[t * 3 + e]];
        const vb = wId[tri[t * 3 + ((e + 1) % 3)]];
        if (va === vb) continue;
        const key = va < vb ? va * nw + vb : vb * nw + va;
        const h = t * 3 + e;
        const o = seen.get(key);
        if (o === undefined) seen.set(key, h);
        else if (nbr[o] === -1) {
          nbr[o] = h;
          nbr[h] = o;
        } else nbr[h] = -2; // a third face on the edge
      }
    }
    // Dihedral angles: hard edges (and open borders), and how sharply each triangle bends.
    const curv = new Float32Array(nt);
    for (let t = 0; t < nt; t++) {
      for (let e = 0; e < 3; e++) {
        const h = t * 3 + e;
        const o = nbr[h];
        let cosA;
        if (o < 0) {
          // An open border, or a non-manifold edge: hard.
          hard[t] |= 1 << e;
          curv[t] = Math.max(curv[t], 1.2);
          continue;
        }
        const u = (o / 3) | 0;
        const eu = o % 3;
        const consistent =
          wId[tri[u * 3 + eu]] === wId[tri[t * 3 + ((e + 1) % 3)]] &&
          wId[tri[u * 3 + ((eu + 1) % 3)]] === wId[tri[t * 3 + e]];
        cosA = fn[t * 3] * fn[u * 3] + fn[t * 3 + 1] * fn[u * 3 + 1] + fn[t * 3 + 2] * fn[u * 3 + 2]; // prettier-ignore
        if (!consistent) cosA = -cosA;
        if (cosA < CREASE_COS) {
          hard[t] |= 1 << e;
          crease[t] |= 1 << e;
        }
        curv[t] = Math.max(curv[t], Math.acos(Math.max(-1, Math.min(1, cosA))));
      }
    }
    // Detail: sharp bends, and triangles much smaller than most.
    const sample = [];
    const step = Math.max(1, Math.floor(nt / 4000));
    for (let t = 0; t < nt; t += step) sample.push(area[t]);
    sample.sort((p, q) => p - q);
    const medArea = sample[sample.length >> 1] || 1;
    for (let t = 0; t < nt; t++) {
      const bend = Math.min(1, curv[t] / 0.9);
      const small = Math.min(1, Math.max(0, Math.log2(medArea / area[t]) / 4));
      weight[t] = 1 + 1.3 * bend ** 0.8 + 0.9 * small;
    }
    // Normals.
    if (raw.nor) {
      for (let t = 0; t < nt; t++)
        for (let c = 0; c < 3; c++) {
          const v = tri[t * 3 + c] * 3;
          const x = raw.nor[v];
          const y = raw.nor[v + 1];
          const z = raw.nor[v + 2];
          const l = Math.hypot(x, y, z);
          if (l > 1e-6) {
            cn[t * 9 + c * 3] = x / l;
            cn[t * 9 + c * 3 + 1] = y / l;
            cn[t * 9 + c * 3 + 2] = z / l;
          } else {
            cn[t * 9 + c * 3] = fn[t * 3];
            cn[t * 9 + c * 3 + 1] = fn[t * 3 + 1];
            cn[t * 9 + c * 3 + 2] = fn[t * 3 + 2];
          }
        }
    } else {
      // Smooth a corner's normal over the faces at its (welded) vertex that
      // bend less than the crease angle from its own face.
      const start = new Int32Array(nw + 1);
      for (let t = 0; t < nt; t++) for (let c = 0; c < 3; c++) start[wId[tri[t * 3 + c]] + 1]++;
      for (let i = 0; i < nw; i++) start[i + 1] += start[i];
      const fill = start.slice(0, nw);
      const inc = new Int32Array(nt * 3);
      for (let t = 0; t < nt; t++) for (let c = 0; c < 3; c++) inc[fill[wId[tri[t * 3 + c]]]++] = t;
      for (let t = 0; t < nt; t++)
        for (let c = 0; c < 3; c++) {
          const w0 = wId[tri[t * 3 + c]];
          let sx = 0;
          let sy = 0;
          let sz = 0;
          for (let j = start[w0]; j < start[w0 + 1]; j++) {
            const u = inc[j];
            const d = fn[t * 3] * fn[u * 3] + fn[t * 3 + 1] * fn[u * 3 + 1] + fn[t * 3 + 2] * fn[u * 3 + 2]; // prettier-ignore
            if (d < CREASE_COS) continue;
            sx += fn[u * 3] * area[u];
            sy += fn[u * 3 + 1] * area[u];
            sz += fn[u * 3 + 2] * area[u];
          }
          const l = Math.hypot(sx, sy, sz) || 1;
          cn[t * 9 + c * 3] = sx / l;
          cn[t * 9 + c * 3 + 1] = sy / l;
          cn[t * 9 + c * 3 + 2] = sz / l;
        }
    }
    // Unique edges, for the wireframe.
    const ea = [];
    const eb = [];
    const eh = [];
    for (let t = 0; t < nt; t++)
      for (let e = 0; e < 3; e++) {
        const h = t * 3 + e;
        const o = nbr[h];
        if (o >= 0 && o < h) continue; // the partner drew it
        const a = tri[t * 3 + e];
        const b = tri[t * 3 + ((e + 1) % 3)];
        if (wId[a] === wId[b]) continue;
        ea.push(a);
        eb.push(b);
        eh.push((hard[t] >> e) & 1);
      }
    edges = { a: Int32Array.from(ea), b: Int32Array.from(eb), hard: Uint8Array.from(eh) };
  } else {
    // Too many triangles for adjacency: normals from the file, or flat.
    for (let t = 0; t < nt; t++)
      for (let c = 0; c < 3; c++) {
        let x = fn[t * 3];
        let y = fn[t * 3 + 1];
        let z = fn[t * 3 + 2];
        if (raw.nor) {
          const v = tri[t * 3 + c] * 3;
          const l = Math.hypot(raw.nor[v], raw.nor[v + 1], raw.nor[v + 2]);
          if (l > 1e-6) {
            x = raw.nor[v] / l;
            y = raw.nor[v + 1] / l;
            z = raw.nor[v + 2] / l;
          }
        }
        cn[t * 9 + c * 3] = x;
        cn[t * 9 + c * 3 + 1] = y;
        cn[t * 9 + c * 3 + 2] = z;
      }
    notes.push(
      "This model has a lot of triangles, so its edges are not analyzed (splats are spread by area only).",
    );
  }
  return {
    name: raw.name,
    format: raw.format,
    notes,
    pos,
    uv: raw.uv,
    col: raw.col,
    tri,
    mat,
    nt,
    nv,
    materials,
    fn,
    area,
    uvd,
    cn,
    hard,
    crease,
    weight,
    totalArea,
    edges,
    welded: wId,
    bbox,
    diag,
    triangles: nt,
    textured: materials.some((m) => m.mip),
  };
}

// ---- Orientation --------------------------------------------------------------------------

// "y" leaves the model as it is; "z" turns a Z-up model (STL, most CAD) upright;
// "auto" picks z for STL and y for the rest.
export function upAxis(prep, up = "auto") {
  if (up === "y" || up === "z") return up;
  return prep.format === "stl" ? "z" : "y";
}

// The rotation, center and scale that put the model upright, centered, in a sphere of radius 1.
function placement(prep, up) {
  const z = upAxis(prep, up) === "z";
  const rot = z ? (x, y, zz) => [x, zz, -y] : (x, y, zz) => [x, y, zz];
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  const { min, max } = prep.bbox;
  for (let i = 0; i < 8; i++) {
    const r = rot(i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]);
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], r[k]);
      hi[k] = Math.max(hi[k], r[k]);
    }
  }
  const c = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2);
  const radius = 0.5 * Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) || 1;
  return { rot, c, s: 1 / radius };
}

// ---- Sampling the surface ---------------------------------------------------------------------

const G1 = 0.7548776662466927;
const G2 = 0.5698402909980532;
const frac = (x) => x - Math.floor(x);

// The key light of the other kit toys (src/packs/balls.js, lit()): soft, from the upper left.
const LIGHT = (() => {
  const v = [-0.35, 0.8, 0.5];
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
})();
export const LIGHT_SOFT = 0.22;
const litFactor = (nx, ny, nz, soft) =>
  1 - soft + soft * (0.5 + 0.5 * (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2])) + soft * 0.1;

// How big each splat is, against the distance to its neighbors (the mean of the nearest few).
export const FILL = 1.05;
export const EDGE_FLOOR = 0.8; // at a fold, a splat shrinks to no less than this share of its size
export const SPLAT_OPACITY = 0.97;
export const SPLAT_FLAT = 0.14;

// Samples the model's surface into `count` splats or fewer: flat discs lying on the
// surface, more of them where the surface bends sharply or is finely made, each sized
// from its neighbors so the surface closes. Returns typed arrays in toy coordinates
// (a sphere of radius 1, up as +Y):
//   { n, pos (3n), nrm (3n, the face normal), sigma (n), rgb (3n, sRGB 0..1), triangle (n) }
export function sampleSurface(
  prep,
  count,
  { seed = 1, up = "auto", light = true, soft = LIGHT_SOFT, edgeFloor = EDGE_FLOOR } = {},
) {
  // prettier-ignore
  const rand = mulberry32(seed * 7919 + 13);
  const { nt, area, weight, tri, pos, fn } = prep;
  let sum = 0;
  for (let t = 0; t < nt; t++) sum += area[t] * weight[t];
  const k = (Math.max(1, count) * 0.985) / sum;
  const cap = Math.ceil(count * 1.06) + 64;
  const pT = new Int32Array(cap);
  const pU = new Float32Array(cap);
  const pV = new Float32Array(cap);
  let n = 0;
  for (let t = 0; t < nt && n < cap; t++) {
    const e = area[t] * weight[t] * k;
    let m = Math.floor(e);
    if (rand() < e - m) m++;
    if (!m) continue;
    const ox = rand();
    const oy = rand();
    for (let j = 1; j <= m && n < cap; j++) {
      let u = frac(ox + j * G1);
      let v = frac(oy + j * G2);
      if (u + v > 1) {
        u = 1 - u;
        v = 1 - v;
      }
      pT[n] = t;
      pU[n] = u;
      pV[n] = v;
      n++;
    }
  }
  // Over the budget: drop a random few.
  if (n > count) {
    const drop = new Uint8Array(n);
    let over = n - count;
    while (over > 0) {
      const i = Math.floor(rand() * n);
      if (!drop[i]) {
        drop[i] = 1;
        over--;
      }
    }
    let o = 0;
    for (let i = 0; i < n; i++) {
      if (drop[i]) continue;
      pT[o] = pT[i];
      pU[o] = pU[i];
      pV[o] = pV[i];
      o++;
    }
    n = o;
  }
  const P = new Float32Array(n * 3);
  const F = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = pT[i];
    const a = tri[t * 3] * 3;
    const b = tri[t * 3 + 1] * 3;
    const c = tri[t * 3 + 2] * 3;
    const u = pU[i];
    const v = pV[i];
    const w = 1 - u - v;
    P[i * 3] = pos[a] * w + pos[b] * u + pos[c] * v;
    P[i * 3 + 1] = pos[a + 1] * w + pos[b + 1] * u + pos[c + 1] * v;
    P[i * 3 + 2] = pos[a + 2] * w + pos[b + 2] * u + pos[c + 2] * v;
    F[i * 3] = fn[t * 3];
    F[i * 3 + 1] = fn[t * 3 + 1];
    F[i * 3 + 2] = fn[t * 3 + 2];
  }
  // Sizes from the nearest neighbors on the same surface, through a grid.
  const spacing = 1 / Math.sqrt(k);
  const sig = neighborSizes(P, F, n, spacing, prep.bbox);
  // Hard edges stay hard: near one, a splat is small enough not to reach over it.
  for (let i = 0; i < n; i++) {
    const t = pT[i];
    const hb = prep.crease[t];
    if (!hb) continue;
    let dMin = Infinity;
    for (let e = 0; e < 3; e++) {
      if (!((hb >> e) & 1)) continue;
      const a = tri[t * 3 + e] * 3;
      const b = tri[t * 3 + ((e + 1) % 3)] * 3;
      dMin = Math.min(dMin, pointSegment(P, i * 3, pos, a, b));
    }
    const s0 = sig[i];
    sig[i] = Math.min(s0, Math.max(edgeFloor * s0, 0.9 * dMin));
  }
  // Colors, and the ones cut out by an alpha mask.
  const { rot, c, s } = placement(prep, up);
  const outPos = new Float32Array(n * 3);
  const outNrm = new Float32Array(n * 3);
  const outSig = new Float32Array(n);
  const outRgb = new Float32Array(n * 3);
  const outTri = new Int32Array(n);
  const px = [0, 0, 0, 0];
  let m = 0;
  for (let i = 0; i < n; i++) {
    const t = pT[i];
    const M = prep.materials[prep.mat[t]];
    const ia = tri[t * 3];
    const ib = tri[t * 3 + 1];
    const ic = tri[t * 3 + 2];
    const u = pU[i];
    const v = pV[i];
    const w = 1 - u - v;
    let r = M.rgb[0];
    let g = M.rgb[1];
    let b = M.rgb[2];
    let a = M.alpha;
    if (M.mip && prep.uv) {
      let tu = prep.uv[ia * 2] * w + prep.uv[ib * 2] * u + prep.uv[ic * 2] * v;
      let tv = prep.uv[ia * 2 + 1] * w + prep.uv[ib * 2 + 1] * u + prep.uv[ic * 2 + 1] * v;
      if (M.transform) {
        const { offset, rotation, scale } = M.transform;
        const sx = tu * scale[0];
        const sy = tv * scale[1];
        const cr = Math.cos(rotation);
        const sr = Math.sin(rotation);
        tu = cr * sx + sr * sy + offset[0];
        tv = -sr * sx + cr * sy + offset[1];
      }
      // The renderer's splat falls off as exp(-r²/σ²): about 1.4σ across where it counts.
      const texels = prep.uvd[t] * 1.4 * sig[i] * Math.sqrt(M.mip.w * M.mip.h);
      sampleMip(
        M.mip,
        tu,
        tv,
        Math.log2(Math.max(1, texels)) - 0.5,
        M.wrapS,
        M.wrapT,
        px,
        M.nearest,
      );
      r *= px[0];
      g *= px[1];
      b *= px[2];
      a *= px[3];
    }
    if (prep.col) {
      const ca = prep.col;
      r *= linToSrgb(ca[ia * 4] * w + ca[ib * 4] * u + ca[ic * 4] * v);
      g *= linToSrgb(ca[ia * 4 + 1] * w + ca[ib * 4 + 1] * u + ca[ic * 4 + 1] * v);
      b *= linToSrgb(ca[ia * 4 + 2] * w + ca[ib * 4 + 2] * u + ca[ic * 4 + 2] * v);
      a *= ca[ia * 4 + 3] * w + ca[ib * 4 + 3] * u + ca[ic * 4 + 3] * v;
    }
    // Cut-outs (leaves, fences) leave holes; glass is left out.
    if ((M.alphaMode === "MASK" || M.alphaMode === "BLEND") && a < M.cutoff) continue;
    if (light) {
      let nx = prep.cn[t * 9] * w + prep.cn[t * 9 + 3] * u + prep.cn[t * 9 + 6] * v;
      let ny = prep.cn[t * 9 + 1] * w + prep.cn[t * 9 + 4] * u + prep.cn[t * 9 + 7] * v;
      let nz = prep.cn[t * 9 + 2] * w + prep.cn[t * 9 + 5] * u + prep.cn[t * 9 + 8] * v;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l;
      ny /= l;
      nz /= l;
      const q = rot(nx, ny, nz);
      const f = litFactor(q[0], q[1], q[2], soft);
      r *= f;
      g *= f;
      b *= f;
    }
    const p = rot(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
    const nr = rot(F[i * 3], F[i * 3 + 1], F[i * 3 + 2]);
    outPos[m * 3] = (p[0] - c[0]) * s;
    outPos[m * 3 + 1] = (p[1] - c[1]) * s;
    outPos[m * 3 + 2] = (p[2] - c[2]) * s;
    outNrm[m * 3] = nr[0];
    outNrm[m * 3 + 1] = nr[1];
    outNrm[m * 3 + 2] = nr[2];
    outSig[m] = sig[i] * s;
    outRgb[m * 3] = Math.min(1, Math.max(0, r));
    outRgb[m * 3 + 1] = Math.min(1, Math.max(0, g));
    outRgb[m * 3 + 2] = Math.min(1, Math.max(0, b));
    outTri[m] = t;
    m++;
  }
  return {
    n: m,
    pos: outPos.subarray(0, m * 3),
    nrm: outNrm.subarray(0, m * 3),
    sigma: outSig.subarray(0, m),
    rgb: outRgb.subarray(0, m * 3),
    triangle: outTri.subarray(0, m),
    scale: s,
  };
}

// The distance from point i of P to the segment a-b of pos.
function pointSegment(P, i, pos, a, b) {
  const ax = pos[a];
  const ay = pos[a + 1];
  const az = pos[a + 2];
  const dx = pos[b] - ax;
  const dy = pos[b + 1] - ay;
  const dz = pos[b + 2] - az;
  const l2 = dx * dx + dy * dy + dz * dz || 1e-30;
  let t = ((P[i] - ax) * dx + (P[i + 1] - ay) * dy + (P[i + 2] - az) * dz) / l2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(P[i] - ax - dx * t, P[i + 1] - ay - dy * t, P[i + 2] - az - dz * t);
}

// Each point's splat size: FILL times the mean distance to its nearest neighbors that lie
// on the same surface (facing about the same way, and in its tangent plane).
function neighborSizes(P, F, n, spacing, bbox) {
  const K = 6;
  const ext = [0, 1, 2].map((a) => bbox.max[a] - bbox.min[a] + 2 * spacing);
  let cell = 1.8 * spacing;
  const dimsFor = (c) => ext.map((e) => Math.max(1, Math.ceil(e / c)));
  let dims = dimsFor(cell);
  while (dims[0] * dims[1] * dims[2] > 6e6) {
    cell *= 1.4;
    dims = dimsFor(cell);
  }
  const ox = bbox.min[0] - spacing;
  const oy = bbox.min[1] - spacing;
  const oz = bbox.min[2] - spacing;
  const cid = new Int32Array(n);
  const start = new Int32Array(dims[0] * dims[1] * dims[2] + 1);
  for (let i = 0; i < n; i++) {
    const cx = Math.min(dims[0] - 1, Math.floor((P[i * 3] - ox) / cell));
    const cy = Math.min(dims[1] - 1, Math.floor((P[i * 3 + 1] - oy) / cell));
    const cz = Math.min(dims[2] - 1, Math.floor((P[i * 3 + 2] - oz) / cell));
    const id = (cz * dims[1] + cy) * dims[0] + cx;
    cid[i] = id;
    start[id + 1]++;
  }
  for (let i = 0; i < start.length - 1; i++) start[i + 1] += start[i];
  const fill = start.slice(0, start.length - 1);
  const items = new Int32Array(n);
  for (let i = 0; i < n; i++) items[fill[cid[i]]++] = i;
  const best = new Float32Array(K);
  const sig = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const id = cid[i];
    const cx = id % dims[0];
    const cy = ((id / dims[0]) | 0) % dims[1];
    const cz = (id / (dims[0] * dims[1])) | 0;
    const px = P[i * 3];
    const py = P[i * 3 + 1];
    const pz = P[i * 3 + 2];
    const nx = F[i * 3];
    const ny = F[i * 3 + 1];
    const nz = F[i * 3 + 2];
    let found = 0;
    for (let dz = -1; dz <= 1; dz++) {
      const zz = cz + dz;
      if (zz < 0 || zz >= dims[2]) continue;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = cy + dy;
        if (yy < 0 || yy >= dims[1]) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = cx + dx;
          if (xx < 0 || xx >= dims[0]) continue;
          const cc = (zz * dims[1] + yy) * dims[0] + xx;
          for (let j = start[cc]; j < start[cc + 1]; j++) {
            const q = items[j];
            if (q === i) continue;
            const qx = P[q * 3] - px;
            const qy = P[q * 3 + 1] - py;
            const qz = P[q * 3 + 2] - pz;
            const d2 = qx * qx + qy * qy + qz * qz;
            if (found === K && d2 >= best[K - 1]) continue;
            if (Math.abs(nx * F[q * 3] + ny * F[q * 3 + 1] + nz * F[q * 3 + 2]) < 0.5) continue;
            const off = nx * qx + ny * qy + nz * qz;
            if (off * off > 0.36 * d2) continue; // not in this splat's plane
            let s = found < K ? found++ : K - 1;
            while (s > 0 && best[s - 1] > d2) {
              best[s] = best[s - 1];
              s--;
            }
            best[s] = d2;
          }
        }
      }
    }
    let d;
    if (found >= 3) {
      let t = 0;
      for (let j = 0; j < found; j++) t += Math.sqrt(best[j]);
      d = t / found;
    } else d = spacing;
    sig[i] = FILL * d;
  }
  return sig;
}

// ---- The wireframe --------------------------------------------------------------------------

export const WIRE_MAX_EDGES = 1800;

// The mesh's edges as segments in toy coordinates: { a: Float32Array(3e), b: Float32Array(3e),
// hard: Uint8Array(e), edges, vertices: Float32Array(3v) (the corners, when the mesh is small) }.
// A mesh with more edges than WIRE_MAX_EDGES is first simplified by clustering its
// vertices on a grid, so the wire still reads as a net.
export function wireGeometry(prep, { up = "auto", maxEdges = WIRE_MAX_EDGES } = {}) {
  const { rot, c, s } = placement(prep, up);
  const place = (x, y, z) => {
    const p = rot(x, y, z);
    return [(p[0] - c[0]) * s, (p[1] - c[1]) * s, (p[2] - c[2]) * s];
  };
  let A;
  let B;
  let H;
  let corners = null;
  const e0 = prep.edges;
  if (e0 && e0.a.length <= maxEdges) {
    const m = e0.a.length;
    A = new Float32Array(m * 3);
    B = new Float32Array(m * 3);
    H = e0.hard;
    const seen = new Map();
    const cv = [];
    for (let i = 0; i < m; i++) {
      const a = place(prep.pos[e0.a[i] * 3], prep.pos[e0.a[i] * 3 + 1], prep.pos[e0.a[i] * 3 + 2]);
      const b = place(prep.pos[e0.b[i] * 3], prep.pos[e0.b[i] * 3 + 1], prep.pos[e0.b[i] * 3 + 2]);
      A.set(a, i * 3);
      B.set(b, i * 3);
      for (const [vi, p] of [
        [e0.a[i], a],
        [e0.b[i], b],
      ]) {
        // prettier-ignore
        const key = prep.welded ? prep.welded[vi] : vi;
        if (!seen.has(key)) {
          seen.set(key, 1);
          cv.push(...p);
        }
      }
    }
    corners = Float32Array.from(cv);
  } else {
    // Vertex clustering on a grid, sized to leave about maxEdges / 3 clusters on the surface.
    const { pos, tri, nt, bbox } = prep;
    const ext = [0, 1, 2].map((a) => bbox.max[a] - bbox.min[a] || 1e-9);
    const cluster = (res) => {
      const cellOf = new Int32Array(prep.nv);
      const map = new Map();
      let n = 0;
      for (let i = 0; i < prep.nv; i++) {
        const cx = Math.min(res - 1, Math.floor(((pos[i * 3] - bbox.min[0]) / ext[0]) * res));
        const cy = Math.min(res - 1, Math.floor(((pos[i * 3 + 1] - bbox.min[1]) / ext[1]) * res));
        const cz = Math.min(res - 1, Math.floor(((pos[i * 3 + 2] - bbox.min[2]) / ext[2]) * res));
        const key = (cx * res + cy) * res + cz;
        let id = map.get(key);
        if (id === undefined) {
          id = n++;
          map.set(key, id);
        }
        cellOf[i] = id;
      }
      return { cellOf, n };
    };
    let res = 24;
    let cl = cluster(res);
    for (let it = 0; it < 3; it++) {
      const want = maxEdges / 3;
      res = Math.max(4, Math.round(res * Math.sqrt(want / Math.max(1, cl.n))));
      cl = cluster(res);
    }
    const sum = new Float64Array(cl.n * 3);
    const cnt = new Int32Array(cl.n);
    for (let i = 0; i < prep.nv; i++) {
      const id = cl.cellOf[i];
      sum[id * 3] += pos[i * 3];
      sum[id * 3 + 1] += pos[i * 3 + 1];
      sum[id * 3 + 2] += pos[i * 3 + 2];
      cnt[id]++;
    }
    const seen = new Set();
    const ea = [];
    const eb = [];
    for (let t = 0; t < nt; t++) {
      const ids = [0, 1, 2].map((k) => cl.cellOf[tri[t * 3 + k]]);
      for (let k = 0; k < 3; k++) {
        const a = ids[k];
        const b = ids[(k + 1) % 3];
        if (a === b) continue;
        const key = a < b ? a * cl.n + b : b * cl.n + a;
        if (seen.has(key)) continue;
        seen.add(key);
        ea.push(a);
        eb.push(b);
      }
    }
    const m = ea.length;
    A = new Float32Array(m * 3);
    B = new Float32Array(m * 3);
    H = new Uint8Array(m);
    const at = (id) =>
      place(sum[id * 3] / cnt[id], sum[id * 3 + 1] / cnt[id], sum[id * 3 + 2] / cnt[id]);
    for (let i = 0; i < m; i++) {
      A.set(at(ea[i]), i * 3);
      B.set(at(eb[i]), i * 3);
    }
  }
  return { a: A, b: B, hard: H, edges: A.length / 3, vertices: corners, scale: s };
}

// The wire as splats: thin streaks along each edge (colors by whether the edge is a hard one),
// and small dots at the corners when the mesh is small. Returns
// [{ p, dir, sigmaAlong, sigmaAcross, rgb, corner }], at most `budget` of them.
export function wireSplats(wire, budget, { radius: r0 } = {}) {
  const out = [];
  let total = 0;
  const lens = new Float32Array(wire.edges);
  for (let i = 0; i < wire.edges; i++) {
    lens[i] = Math.hypot(wire.a[i * 3] - wire.b[i * 3], wire.a[i * 3 + 1] - wire.b[i * 3 + 1], wire.a[i * 3 + 2] - wire.b[i * 3 + 2]); // prettier-ignore
    total += lens[i];
  }
  // A line about as thick as the typical edge is long makes a blob, so thin the wire with the mesh.
  const median = wire.edges ? Float32Array.from(lens).sort()[wire.edges >> 1] : 0.05;
  const radius = r0 ?? Math.min(0.0055, Math.max(0.0028, 0.03 * median));
  const cornerN = wire.vertices ? wire.vertices.length / 3 : 0;
  // A streak's length along the edge, so the streaks overlap like beads.
  let pitch = Math.max(radius * 3.4, total / Math.max(1, (budget - cornerN) * 0.95));
  for (let i = 0; i < wire.edges; i++) {
    const ax = wire.a[i * 3];
    const ay = wire.a[i * 3 + 1];
    const az = wire.a[i * 3 + 2];
    const dx = wire.b[i * 3] - ax;
    const dy = wire.b[i * 3 + 1] - ay;
    const dz = wire.b[i * 3 + 2] - az;
    const len = Math.hypot(dx, dy, dz);
    if (!(len > 1e-9)) continue;
    const m = Math.max(1, Math.round(len / pitch));
    const sa = Math.max(radius, (len / m) * 0.62);
    for (let j = 0; j < m; j++) {
      const f = (j + 0.5) / m;
      out.push({
        p: [ax + dx * f, ay + dy * f, az + dz * f],
        dir: [dx / len, dy / len, dz / len],
        along: sa,
        across: radius,
        hard: wire.hard[i] === 1,
        corner: false,
      });
    }
  }
  if (wire.vertices) {
    for (let i = 0; i < cornerN; i++) {
      out.push({
        p: [wire.vertices[i * 3], wire.vertices[i * 3 + 1], wire.vertices[i * 3 + 2]],
        dir: null,
        along: radius * 1.7,
        across: radius * 1.7,
        hard: false,
        corner: true,
      });
    }
  }
  if (out.length > budget) {
    // Over: thin the streaks evenly (corners are last, so they go first).
    const step = out.length / budget;
    const kept = [];
    for (let i = 0; i < budget; i++) kept.push(out[Math.floor(i * step)]);
    return kept;
  }
  pitch = 0;
  return out;
}

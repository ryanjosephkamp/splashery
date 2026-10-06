// Earth and maps (lane Geo, October 2026): reading the data snapshots that
// tools/geo-*.mjs write into assets/toys/<toy id>/ (a JSON header, then
// height grids as Uint16, color grids as RGB bytes and raw arrays), and
// sampling them.

const CACHE = new Map();
const READY = new Map();

// A file of this lane's assets as bytes (fetched in a browser, read from disk
// in Node for the build tools and tests).
// A file ending in .gz is unzipped (DecompressionStream, in browsers and Node).
export async function readBytes(rel) {
  const url = new URL(`../../${rel}`, import.meta.url);
  let bytes;
  if (url.protocol === "file:") {
    const fs = await import("node:fs/promises");
    const b = await fs.readFile(url);
    bytes = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  } else {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Could not load ${rel.split("/").pop()}.`);
    bytes = new Uint8Array(await r.arrayBuffer());
  }
  return rel.endsWith(".gz") ? gunzip(bytes) : bytes;
}

export async function gunzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// An aerial picture (a JPEG) as a color grid: decoded by the browser, or by
// jpeg-js (a build-time devDependency) in Node for the tools and tests.
const PICTURES = new Map();
export async function loadPicture(rel) {
  if (PICTURES.has(rel)) return PICTURES.get(rel);
  const bytes = await readBytes(rel);
  let w;
  let h;
  let rgba;
  if (typeof createImageBitmap === "function" && typeof OffscreenCanvas === "function") {
    const bmp = await createImageBitmap(new Blob([bytes], { type: "image/jpeg" }));
    w = bmp.width;
    h = bmp.height;
    const cv = new OffscreenCanvas(w, h);
    const g = cv.getContext("2d");
    g.drawImage(bmp, 0, 0);
    rgba = g.getImageData(0, 0, w, h).data;
  } else {
    const jpeg = (await import("jpeg-js")).default;
    const img = jpeg.decode(bytes, { useTArray: true });
    w = img.width;
    h = img.height;
    rgba = img.data;
  }
  const rgb = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) rgb.set([rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]], i * 3);
  const pic = colorGrid({ w, h }, rgb);
  PICTURES.set(rel, pic);
  return pic;
}
export function pictureLoaded(rel) {
  const p = PICTURES.get(rel);
  if (!p) throw new Error(`${rel} is not loaded (prepare() loads it).`);
  return p;
}

export async function readText(rel) {
  return new TextDecoder().decode(await readBytes(rel));
}

// Loads (once) and parses a snapshot in a recipe's prepare(); build() then
// reads it with geoLoaded. Returns { meta, layers, layer(name) }.
export async function loadGeo(rel) {
  if (CACHE.has(rel)) return CACHE.get(rel);
  const p = readBytes(rel)
    .then(parseGeo)
    .then((g) => (READY.set(rel, g), g));
  CACHE.set(rel, p);
  try {
    return await p;
  } catch (err) {
    CACHE.delete(rel);
    throw err;
  }
}
export function geoLoaded(rel) {
  const g = READY.get(rel);
  if (!g) throw new Error(`${rel} is not loaded (prepare() loads it).`);
  return g;
}

export function parseGeo(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = dv.getUint32(0, true);
  const meta = JSON.parse(new TextDecoder().decode(bytes.subarray(4, 4 + n)));
  const base = 4 + n;
  const layers = {};
  for (const L of meta.layers) {
    const at = bytes.byteOffset + base + L.offset;
    if (L.type === "height") {
      const q = new Uint16Array(bytes.buffer.slice(at, at + L.bytes));
      if (L.delta) {
        // Round 2: each row is stored as differences of `step`-meter levels.
        for (let j = 0; j < L.h; j++) {
          let v = 0;
          for (let i = 0; i < L.w; i++) {
            v = (v + q[j * L.w + i]) & 0xffff;
            q[j * L.w + i] = v;
          }
        }
      }
      layers[L.name] = heightGrid(L, q);
    } else if (L.type === "rgb") {
      layers[L.name] = colorGrid(L, new Uint8Array(bytes.buffer.slice(at, at + L.bytes)));
    } else if (L.type === "f32") {
      layers[L.name] = { ...L, data: new Float32Array(bytes.buffer.slice(at, at + L.bytes)) };
    } else layers[L.name] = { ...L, data: new Uint8Array(bytes.buffer.slice(at, at + L.bytes)) };
  }
  const geo = { meta, layers, layer: (name) => layers[name] };
  return geo;
}

// A height grid in meters, sampled bilinearly at u, v in 0..1 (u east, v south).
function heightGrid(L, q) {
  const { w, h, min, max } = L;
  const k = L.delta ? L.step : (max - min) / 65535;
  const at = (x, y) => min + q[y * w + x] * k;
  const sample = (u, v) => {
    const fx = Math.min(Math.max(u, 0), 1) * (w - 1);
    const fy = Math.min(Math.max(v, 0), 1) * (h - 1);
    const x0 = Math.min(w - 2, Math.floor(fx));
    const y0 = Math.min(h - 2, Math.floor(fy));
    const tx = fx - x0;
    const ty = fy - y0;
    return (
      (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) +
      (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty
    );
  };
  return { ...L, at, sample };
}

// An RGB grid, sampled bilinearly at u, v; returns [r, g, b] in 0..1.
function colorGrid(L, d) {
  const { w, h } = L;
  const sample = (u, v) => {
    const fx = Math.min(Math.max(u, 0), 1) * (w - 1);
    const fy = Math.min(Math.max(v, 0), 1) * (h - 1);
    const x0 = Math.min(w - 2, Math.floor(fx));
    const y0 = Math.min(h - 2, Math.floor(fy));
    const tx = fx - x0;
    const ty = fy - y0;
    const out = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      const a = d[(y0 * w + x0) * 3 + c] * (1 - tx) + d[(y0 * w + x0 + 1) * 3 + c] * tx;
      const b = d[((y0 + 1) * w + x0) * 3 + c] * (1 - tx) + d[((y0 + 1) * w + x0 + 1) * 3 + c] * tx; // prettier-ignore
      out[c] = (a * (1 - ty) + b * ty) / 255;
    }
    return out;
  };
  return { ...L, data: d, sample };
}

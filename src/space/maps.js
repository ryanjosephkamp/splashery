// Lane Space r2: loads a real world's maps (written by tools/sp2-maps.mjs)
// and samples them. Works in the browser and in Node (the build tools and
// tests), and is meant to be imported by any pack that wants a real world
// (the Arcade's lander):
//
//   import { loadWorld } from "../space/maps.js";
//   const w = await loadWorld("mars");
//   w.height(18.65, -133.8);   // meters above the world's reference (Olympus Mons)
//   w.color(18.65, -133.8);    // [r, g, b], 0..1
//   w.def                      // the catalog entry (src/space/worlds.js)
//
// The color maps are JPEGs and the heights SPH1 files (see the tool). Each
// named feature with a close-up patch has its own sharper pair of maps;
// the samplers use the patch inside it, blending into the global map at
// its edge.

import { worldById } from "./worlds.js";

const base = new URL("../../assets/toys/real-worlds/", import.meta.url);
const isNode = base.protocol === "file:";

async function bytes(name) {
  const url = new URL(name, base);
  if (isNode) {
    const fs = await import("node:fs/promises");
    const b = await fs.readFile(url);
    return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not load ${name}.`);
  return new Uint8Array(await r.arrayBuffer());
}

async function inflate(data) {
  if (isNode) {
    const zlib = await import("node:zlib");
    const b = zlib.inflateSync(data);
    return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  }
  const s = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

// A JPEG as { w, h, rgb: Uint8Array (3 per pixel) }.
export async function decodeJpeg(data) {
  if (isNode) {
    // jpeg-js is a devDependency: the Node tools and tests have it.
    const jpeg = (await import("jpeg-js")).default;
    const img = jpeg.decode(data, { useTArray: true, maxMemoryUsageInMB: 1024 });
    const rgb = new Uint8Array(img.width * img.height * 3);
    for (let k = 0; k < img.width * img.height; k++) {
      rgb[k * 3] = img.data[k * 4];
      rgb[k * 3 + 1] = img.data[k * 4 + 1];
      rgb[k * 3 + 2] = img.data[k * 4 + 2];
    }
    return { w: img.width, h: img.height, rgb };
  }
  const bmp = await createImageBitmap(new Blob([data], { type: "image/jpeg" }), {
    colorSpaceConversion: "none",
    premultiplyAlpha: "none",
  });
  const c =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(bmp.width, bmp.height)
      : Object.assign(document.createElement("canvas"), { width: bmp.width, height: bmp.height });
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(bmp, 0, 0);
  const { width: w, height: h } = bmp;
  const px = g.getImageData(0, 0, w, h).data;
  bmp.close?.();
  const rgb = new Uint8Array(w * h * 3);
  for (let k = 0; k < w * h; k++) {
    rgb[k * 3] = px[k * 4];
    rgb[k * 3 + 1] = px[k * 4 + 1];
    rgb[k * 3 + 2] = px[k * 4 + 2];
  }
  return { w, h, rgb };
}

// An SPH1 height file as { w, h, m: Float32Array (meters) }.
export async function decodeHeights(data) {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const magic = String.fromCharCode(data[0], data[1], data[2], data[3]);
  if (magic !== "SPH1") throw new Error("Not a height map.");
  const w = dv.getUint16(4, true);
  const h = dv.getUint16(6, true);
  const step = dv.getFloat32(8, true);
  const off = dv.getFloat32(12, true);
  const raw = await inflate(data.subarray(16));
  const q = new Int16Array(raw.buffer, raw.byteOffset, w * h);
  const v = new Int16Array(w * h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const l = i ? v[j * w + i - 1] : 0;
      const u = j ? v[(j - 1) * w + i] : 0;
      const ul = i && j ? v[(j - 1) * w + i - 1] : 0;
      v[j * w + i] = (q[j * w + i] + l + u - ul) << 16 >> 16; // prettier-ignore
    }
  const m = new Float32Array(w * h);
  for (let k = 0; k < w * h; k++) m[k] = off + step * v[k];
  return { w, h, m };
}

// Bilinear sampling of a grid over a window (east longitudes from lonA,
// spanning lonW; latitudes from latTop down to latBottom). Longitudes wrap
// for a global grid.
function sampler(grid, ch, win) {
  const { w, h } = grid;
  const data = ch === 1 ? grid.m : grid.rgb;
  const global = win.lonW >= 360;
  const out = new Float32Array(ch);
  return (lat, lon) => {
    let d = (lon - win.lonA) % 360;
    if (d < 0) d += 360;
    const fx = (d / win.lonW) * w - 0.5;
    const fy = ((win.latTop - lat) / (win.latTop - win.latBottom)) * h - 0.5;
    let x0 = Math.floor(fx);
    const ax = fx - x0;
    let y0 = Math.floor(fy);
    const ay = fy - y0;
    let x1 = x0 + 1;
    let y1 = y0 + 1;
    if (global) {
      x0 = ((x0 % w) + w) % w;
      x1 = ((x1 % w) + w) % w;
    } else {
      x0 = Math.max(0, Math.min(w - 1, x0));
      x1 = Math.max(0, Math.min(w - 1, x1));
    }
    y0 = Math.max(0, Math.min(h - 1, y0));
    y1 = Math.max(0, Math.min(h - 1, y1));
    for (let c = 0; c < ch; c++) {
      const a = data[(y0 * w + x0) * ch + c];
      const b = data[(y0 * w + x1) * ch + c];
      const e = data[(y1 * w + x0) * ch + c];
      const f = data[(y1 * w + x1) * ch + c];
      out[c] = (1 - ay) * ((1 - ax) * a + ax * b) + ay * ((1 - ax) * e + ax * f);
    }
    return out;
  };
}

// The window of a feature's patch (as the tool cuts it).
export function patchWindow(f) {
  const r = f.patch.deg;
  const rl = Math.min(179, r / Math.max(0.2, Math.cos((f.lat * Math.PI) / 180)));
  return { lonA: f.lon - rl, lonW: 2 * rl, latTop: f.lat + r, latBottom: f.lat - r, r, rl };
}

const CACHE = new Map();

// Loads a world's maps (cached): { def, color(lat, lon), height(lat, lon),
// night(lat, lon), patches: [{ feature, window }] }. `patches: false` skips the close-ups.
export function loadWorld(id, { patches = true } = {}) {
  const key = `${id}:${patches}`;
  if (!CACHE.has(key)) CACHE.set(key, load(id, patches));
  return CACHE.get(key);
}

async function load(id, withPatches) {
  const def = worldById(id);
  if (!def) throw new Error(`No world called ${id}.`);
  const GLOBAL = { lonA: -180, lonW: 360, latTop: 90, latBottom: -90 };
  const [img, hts] = await Promise.all([
    bytes(`${id}-color.jpg`).then(decodeJpeg),
    def.maps.height ? bytes(`${id}-height.bin`).then(decodeHeights) : null,
  ]);
  const gColor = sampler(img, 3, GLOBAL);
  const lights = def.maps.night ? sampler(await bytes(`${id}-night.jpg`).then(decodeJpeg), 3, GLOBAL) : null; // prettier-ignore
  const gHeight = hts ? sampler(hts, 1, GLOBAL) : () => [0];
  const patches = [];
  if (withPatches)
    for (const f of def.features || []) {
      if (!f.patch) continue;
      const win = patchWindow(f);
      const [pc, ph] = await Promise.all([
        bytes(`${id}-${f.id}-color.jpg`).then(decodeJpeg),
        hts ? bytes(`${id}-${f.id}-height.bin`).then(decodeHeights) : null,
      ]);
      patches.push({
        feature: f,
        window: win,
        color: sampler(pc, 3, win),
        height: ph ? sampler(ph, 1, win) : null,
      });
    }
  // How far inside a patch a point is: 1 well inside, 0 at its edge or out.
  const inside = (p, lat, lon) => {
    const w = p.window;
    let dl = (lon - p.feature.lon) % 360;
    if (dl > 180) dl -= 360;
    if (dl < -180) dl += 360;
    const u = Math.abs(dl) / w.rl;
    const v = Math.abs(lat - p.feature.lat) / w.r;
    const e = 1 - Math.max(u, v);
    return e <= 0 ? 0 : Math.min(1, e / 0.15);
  };
  const rgb = new Float32Array(3);
  return {
    def,
    patches,
    inside,
    // Meters above the world's reference.
    height(lat, lon) {
      let v = gHeight(lat, lon)[0];
      for (const p of patches) {
        if (!p.height) continue;
        const a = inside(p, lat, lon);
        if (a > 0) v += a * (p.height(lat, lon)[0] - v);
      }
      return v;
    },
    // How bright its lights are at night, 0..1 (0 for a world without a map of them).
    night: (lat, lon) => (lights ? lights(lat, lon)[0] / 255 : 0),
    // [r, g, b] in 0..1 (a shared array: copy it to keep it).
    color(lat, lon) {
      const c = gColor(lat, lon);
      rgb[0] = c[0];
      rgb[1] = c[1];
      rgb[2] = c[2];
      for (const p of patches) {
        const a = inside(p, lat, lon);
        if (a <= 0) continue;
        const d = p.color(lat, lon);
        for (let k = 0; k < 3; k++) rgb[k] += a * (d[k] - rgb[k]);
      }
      rgb[0] /= 255;
      rgb[1] /= 255;
      rgb[2] /= 255;
      return rgb;
    },
  };
}

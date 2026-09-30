#!/usr/bin/env node
// Builds the files the hybrid Worlds mode draws with (docs/WORLDS.md,
// "Rendering"), from Poly Haven (every asset CC0, polyhaven.com/license):
//
//   assets/worlds/ground/albedo.jpg  four ground textures in a 2×2 atlas
//   assets/worlds/ground/normal.jpg  their normal maps (OpenGL), the same way
//   assets/worlds/ground/ground.json each texture's mean color, the atlas
//                                    layout and the sources
//   assets/worlds/sky/<id>-light.hdr the sky's HDRI at 1k with the sun's disk
//                                    clamped (the sun is a light of its own),
//                                    for image-based light
//   assets/worlds/sky/<id>-sky.jpg   its upper part, tone-mapped, for the dome
//
// Each atlas cell is a 1024-pixel tile: the texture shrunk to 960 pixels
// with 32 pixels of wrapped border on every side, so mipmaps don't bleed
// between cells (src/worlds/hybrid.js samples inside the border).
//
//   node tools/world-assets.mjs [--sky-res=4k]
//
// Downloads are cached in .cache/worlds/ and checked against the API's MD5.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import jpeg from "jpeg-js";
import { readHDR, writeHDR } from "./hdr.mjs";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const API = "https://api.polyhaven.com";
const CACHE = ".cache/worlds";
const OUT = "assets/worlds";

// The ground's four cells, in the order the shader reads them.
// `repeat` is the meters one copy covers; `strength` how strongly its
// detail shows over the world's own colors.
export const GROUND = [
  { cell: "sand", id: "sand_01", repeat: 2.2, strength: 0.85 },
  { cell: "grass", id: "rocky_terrain_02", repeat: 3.5, strength: 0.45 },
  { cell: "rock", id: "rock_ground", repeat: 2.6, strength: 0.9 },
  { cell: "wet", id: "damp_beach_sand", repeat: 2.4, strength: 0.75 },
];
export const SKY = { id: "kloofendal_48d_partly_cloudy_puresky" };

const TILE = 1024;
const PAD = 32;
const INNER = TILE - PAD * 2;

async function json(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

async function download(file, md5) {
  const name = path.join(CACHE, path.basename(new URL(file).pathname));
  if (fs.existsSync(name) && hash(fs.readFileSync(name)) === md5) return name;
  const res = await fetch(file);
  if (!res.ok) throw new Error(`${file}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (md5 && hash(buf) !== md5) throw new Error(`${file}: the MD5 doesn't match`);
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(name, buf);
  return name;
}
const hash = (b) => crypto.createHash("md5").update(b).digest("hex");

// Bilinear sample of an RGBA image with wrap-around.
function sampleWrap(im, u, v, out) {
  const x = u * im.width - 0.5;
  const y = v * im.height - 0.5;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const W = im.width;
  const H = im.height;
  for (let c = 0; c < 3; c++) {
    const p = (xx, yy) => im.data[((((yy % H) + H) % H) * W + (((xx % W) + W) % W)) * 4 + c];
    const a = p(x0, y0) * (1 - fx) + p(x0 + 1, y0) * fx;
    const b = p(x0, y0 + 1) * (1 - fx) + p(x0 + 1, y0 + 1) * fx;
    out[c] = a * (1 - fy) + b * fy;
  }
  return out;
}

// Shrinks by averaging first (so the tile keeps its fine detail without
// aliasing), then fills one padded atlas cell.
function box(im, f) {
  if (f <= 1) return im;
  const W = Math.floor(im.width / f);
  const H = Math.floor(im.height / f);
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      for (let c = 0; c < 4; c++) {
        let s = 0;
        for (let b = 0; b < f; b++) for (let a = 0; a < f; a++) s += im.data[((y * f + b) * im.width + x * f + a) * 4 + c]; // prettier-ignore
        data[(y * W + x) * 4 + c] = s / (f * f);
      }
  return { width: W, height: H, data };
}

function putCell(atlas, im, cx, cy) {
  const px = [0, 0, 0];
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const u = (x - PAD + 0.5) / INNER;
      const v = (y - PAD + 0.5) / INNER;
      sampleWrap(im, u, v, px);
      const o = ((cy * TILE + y) * atlas.width + cx * TILE + x) * 4;
      atlas.data[o] = px[0];
      atlas.data[o + 1] = px[1];
      atlas.data[o + 2] = px[2];
      atlas.data[o + 3] = 255;
    }
}

function meanColor(im) {
  const s = [0, 0, 0];
  // Linear means (the shader divides linear colors).
  const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const n = im.width * im.height;
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) s[c] += lin(im.data[i * 4 + c]);
  return s.map((v) => +(v / n).toFixed(4));
}

async function ground() {
  const albedo = { width: TILE * 2, height: TILE * 2, data: new Uint8Array(TILE * TILE * 16) };
  const normal = { width: TILE * 2, height: TILE * 2, data: new Uint8Array(TILE * TILE * 16) };
  const cells = [];
  for (let k = 0; k < GROUND.length; k++) {
    const g = GROUND[k];
    const files = await json(`${API}/files/${g.id}`);
    const info = await json(`${API}/info/${g.id}`);
    const d = files.Diffuse["2k"].jpg;
    const n = files.nor_gl["2k"].jpg;
    const dim = jpeg.decode(fs.readFileSync(await download(d.url, d.md5)), { useTArray: true, maxMemoryUsageInMB: 1024 }); // prettier-ignore
    const nim = jpeg.decode(fs.readFileSync(await download(n.url, n.md5)), { useTArray: true, maxMemoryUsageInMB: 1024 }); // prettier-ignore
    const cx = k % 2;
    const cy = (k / 2) | 0;
    putCell(albedo, box(dim, 2), cx, cy);
    putCell(normal, box(nim, 2), cx, cy);
    cells.push({
      ...g,
      name: info.name,
      authors: Object.keys(info.authors || {}),
      page: `https://polyhaven.com/a/${g.id}`,
      license: "CC0 1.0",
      mean: meanColor(dim),
    });
    console.log(`ground: ${g.cell} ← ${info.name}`);
  }
  fs.mkdirSync(`${OUT}/ground`, { recursive: true });
  fs.writeFileSync(`${OUT}/ground/albedo.jpg`, jpeg.encode(albedo, 86).data);
  fs.writeFileSync(`${OUT}/ground/normal.jpg`, jpeg.encode(normal, 90).data);
  const about = "The hybrid ground's textures (tools/world-assets.mjs). Each atlas cell is 1024 pixels: the texture in the middle 960 with 32 pixels of wrapped border."; // prettier-ignore
  fs.writeFileSync(`${OUT}/ground/ground.json`, JSON.stringify({ about, tile: TILE, pad: PAD, cells }, null, 2) + "\n"); // prettier-ignore
}

// The sky: the 1k HDRI as it is (lighting), and the upper 60 percent of a
// larger one, tone-mapped into a JPEG (what you see).
async function sky() {
  const files = await json(`${API}/files/${SKY.id}`);
  const info = await json(`${API}/info/${SKY.id}`);
  fs.mkdirSync(`${OUT}/sky`, { recursive: true });
  const small = files.hdri["1k"].hdr;
  const light = readHDR(await download(small.url, small.md5));
  const res = opt("sky-res", "4k");
  const big = files.hdri[res].hdr;
  const hdr = readHDR(await download(big.url, big.md5));
  const H = Math.round(hdr.H * 0.6);
  const W = hdr.W;
  const out = { width: W, height: H, data: new Uint8Array(W * H * 4) };
  const exposure = Number(opt("sky-exposure", 1.6));
  const enc = (v) => {
    v = Math.max(0, v * exposure);
    v = v / (1 + v * 0.18); // a soft shoulder keeps the bright clouds
    v = Math.min(1, v);
    return Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055));
  };
  for (let i = 0; i < W * H; i++) {
    for (let c = 0; c < 3; c++) out.data[i * 4 + c] = enc(hdr.data[i * 3 + c]);
    out.data[i * 4 + 3] = 255;
  }
  fs.writeFileSync(`${OUT}/sky/${SKY.id}-sky.jpg`, jpeg.encode(out, 88).data);
  // The horizon's color (the rows from 0 to 1.5 degrees up), for the haze.
  const horizon = [0, 0, 0];
  let hn = 0;
  for (let y = Math.round((88.5 / 180) * hdr.H); y < Math.round((90 / 180) * hdr.H); y++)
    for (let x = 0; x < W; x++, hn++) for (let c = 0; c < 3; c++) horizon[c] += out.data[(y * W + x) * 4 + c]; // prettier-ignore
  // Where the sun is (the brightest texel): u across, elevation in degrees.
  let best = 0;
  let bi = 0;
  const s = light;
  for (let i = 0; i < s.W * s.H; i++) {
    const L = s.data[i * 3] * 0.2126 + s.data[i * 3 + 1] * 0.7152 + s.data[i * 3 + 2] * 0.0722;
    if (L > best) {
      best = L;
      bi = i;
    }
  }
  const sun = { u: +(((bi % s.W) + 0.5) / s.W).toFixed(4), elevation: +(90 - ((Math.floor(bi / s.W) + 0.5) / s.H) * 180).toFixed(2) }; // prettier-ignore
  // The sun's disk and glare clamped, so the image lights with the sky only.
  const cap = Number(opt("sky-cap", 2.5));
  for (let i = 0; i < s.W * s.H; i++) {
    const L = s.data[i * 3] * 0.2126 + s.data[i * 3 + 1] * 0.7152 + s.data[i * 3 + 2] * 0.0722;
    if (L > cap) for (let c = 0; c < 3; c++) s.data[i * 3 + c] *= cap / L;
  }
  writeHDR(`${OUT}/sky/${SKY.id}-light.hdr`, s);
  const meta = {
    about: "The hybrid sky (tools/world-assets.mjs): the HDRI lights the models; the JPEG is its upper 60 percent, tone-mapped, for the sky dome.", // prettier-ignore
    id: SKY.id,
    name: info.name,
    authors: Object.keys(info.authors || {}),
    page: `https://polyhaven.com/a/${SKY.id}`,
    license: "CC0 1.0",
    hdr: `${SKY.id}-light.hdr`,
    dome: `${SKY.id}-sky.jpg`,
    domeRows: 0.6,
    // How much brighter the dome shows the sky than the HDRI holds it (the
    // image-based light is scaled to match).
    exposure: exposure,
    horizon: horizon.map((v) => +(v / hn / 255).toFixed(3)),
    sun,
  };
  fs.writeFileSync(`${OUT}/sky/sky.json`, JSON.stringify(meta, null, 2) + "\n");
  console.log(`sky: ${info.name}, sun at u ${sun.u}, ${sun.elevation}° up`);
}

const what = args.filter((a) => !a.startsWith("--"));
if (!what.length || what.includes("ground")) await ground();
if (!what.length || what.includes("sky")) await sky();

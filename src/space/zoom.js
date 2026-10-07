// Lane Space r3: the close-up maps a tap on a real world zooms into. Each
// world's color (and elevation, where it has one) is cut into tiles of 10° ×
// 10° by tools/sp3-tiles.mjs, finer than its global map; a tap loads only the
// few tiles round the spot it zooms to. Works in the browser and in Node (the
// tools and tests), like src/space/maps.js.
//
//   import { loadZoom } from "../space/zoom.js";
//   const z = await loadZoom("mars", 18.65, -133.8, 6);  // the tiles within 6° of a spot
//   z.color(lat, lon)   // [r, g, b] 0..1, or null outside the tiles
//   z.height(lat, lon)  // meters, or null
//   z.texel             // the tiles' color step, in radians of arc

import { decodeJpeg, decodeHeights } from "./maps.js";

// Pixels per degree of each world's tiles (color, height), and the toy whose
// folder holds them (assets/toys/<toy>/tiles/). Earth's tiles cover only land
// (the sea is one blue, which the global map shows as well).
export const TILES = {
  earth: { toy: "real-earth", color: 48, height: 24, sea: true },
  moon: { toy: "real-moon", color: 24, height: 12 },
  mars: { toy: "real-mars", color: 24, height: 12 },
  mercury: { toy: "real-mercury", color: 24, height: 12 },
  venus: { toy: "real-venus", color: 16, height: 8 },
  io: { toy: "real-moons", color: 10 },
  europa: { toy: "real-moons", color: 10 },
  ganymede: { toy: "real-moons", color: 10 },
  callisto: { toy: "real-moons", color: 10 },
  titan: { toy: "real-moons", color: 8 },
  pluto: { toy: "real-small-worlds", color: 10, height: 5 },
  ceres: { toy: "real-small-worlds", color: 10, height: 5 },
  vesta: { toy: "real-small-worlds", color: 10, height: 5 },
};
export const TILE_DEG = 10;

// A tile's row and column: row 0 is 90°N to 80°N, column 0 is 180°W to 170°W.
export const tileOf = (lat, lon) => [
  Math.min(17, Math.max(0, Math.floor((90 - lat) / TILE_DEG))),
  ((Math.floor((lon + 180) / TILE_DEG) % 36) + 36) % 36,
];
export const tileName = (world, r, c) => `${world}-${String(r).padStart(2, "0")}-${String(c).padStart(2, "0")}`; // prettier-ignore

const root = new URL("../../assets/toys/", import.meta.url);
const isNode = root.protocol === "file:";

async function bytes(rel) {
  const url = new URL(rel, root);
  if (isNode) {
    const fs = await import("node:fs/promises");
    try {
      const b = await fs.readFile(url);
      return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    } catch {
      return null;
    }
  }
  const r = await fetch(url);
  if (!r.ok) return null;
  return new Uint8Array(await r.arrayBuffer());
}

const INDEX = new Map();
// Which tiles a world has ({ color: Set, height: Set } of "row-col").
async function index(world) {
  if (!INDEX.has(world))
    INDEX.set(
      world,
      bytes(`${TILES[world].toy}/tiles/${world}-tiles.json`).then((b) => {
        const j = b ? JSON.parse(new TextDecoder().decode(b)) : { color: [], height: [] };
        return { color: new Set(j.color), height: new Set(j.height || []) };
      }),
    );
  return INDEX.get(world);
}

const TILE_CACHE = new Map();
function tile(world, r, c, kind) {
  const key = `${tileName(world, r, c)}-${kind}`;
  if (!TILE_CACHE.has(key)) {
    const rel = `${TILES[world].toy}/tiles/${tileName(world, r, c)}${kind === "color" ? ".jpg" : ".bin"}`; // prettier-ignore
    TILE_CACHE.set(
      key,
      bytes(rel).then((b) => (b ? (kind === "color" ? decodeJpeg(b) : decodeHeights(b)) : null)),
    );
    // (A few dozen at most stay: about 40 taps' worth.)
    if (TILE_CACHE.size > 48) TILE_CACHE.delete(TILE_CACHE.keys().next().value);
  }
  return TILE_CACHE.get(key);
}

// The tiles within `deg` degrees of arc of a spot, and samplers over them.
export async function loadZoom(world, lat, lon, deg) {
  const spec = TILES[world];
  if (!spec) return null;
  const idx = await index(world);
  const dLat = deg;
  const dLon = Math.min(180, deg / Math.max(0.05, Math.cos((Math.min(89, Math.abs(lat) + deg) * Math.PI) / 180))); // prettier-ignore
  const want = new Set();
  for (let la = Math.max(-89.99, lat - dLat); la <= Math.min(89.99, lat + dLat) + 1e-9; la += Math.min(TILE_DEG / 2, dLat)) // prettier-ignore
    for (let lo = lon - dLon; lo <= lon + dLon + 1e-9; lo += Math.min(TILE_DEG / 2, dLon)) want.add(tileOf(la, lo).join("-")); // prettier-ignore
  for (const la of [lat - dLat, lat + dLat]) for (const lo of [lon - dLon, lon + dLon]) want.add(tileOf(Math.max(-89.99, Math.min(89.99, la)), lo).join("-")); // prettier-ignore
  const color = new Map();
  const height = new Map();
  await Promise.all(
    [...want].map(async (k) => {
      const [r, c] = k.split("-").map(Number);
      if (idx.color.has(k)) color.set(k, await tile(world, r, c, "color"));
      if (spec.height && idx.height.has(k)) height.set(k, await tile(world, r, c, "height"));
    }),
  );
  const out3 = new Float32Array(3);
  const sample = (grids, ch) => (la, lo) => {
    const [r, c] = tileOf(la, lo);
    const g = grids.get(`${r}-${c}`);
    if (!g) return null;
    const { w, h } = g;
    const data = ch === 1 ? g.m : g.rgb;
    const lonA = -180 + c * TILE_DEG;
    const latT = 90 - r * TILE_DEG;
    let d = lo - lonA;
    d -= 360 * Math.floor(d / 360);
    const fx = (d / TILE_DEG) * w - 0.5;
    const fy = ((latT - la) / TILE_DEG) * h - 0.5;
    const x0 = Math.max(0, Math.min(w - 1, Math.floor(fx)));
    const y0 = Math.max(0, Math.min(h - 1, Math.floor(fy)));
    const x1 = Math.min(w - 1, x0 + 1);
    const y1 = Math.min(h - 1, y0 + 1);
    const ax = Math.max(0, Math.min(1, fx - x0));
    const ay = Math.max(0, Math.min(1, fy - y0));
    for (let k = 0; k < ch; k++) {
      const a = data[(y0 * w + x0) * ch + k];
      const b = data[(y0 * w + x1) * ch + k];
      const e = data[(y1 * w + x0) * ch + k];
      const f = data[(y1 * w + x1) * ch + k];
      out3[k] = (1 - ay) * ((1 - ax) * a + ax * b) + ay * ((1 - ax) * e + ax * f);
    }
    return out3;
  };
  const sc = sample(color, 3);
  const sh = sample(height, 1);
  return {
    world,
    tiles: color.size,
    texel: ((1 / spec.color) * Math.PI) / 180,
    color(la, lo) {
      const v = sc(la, lo);
      return v ? [v[0] / 255, v[1] / 255, v[2] / 255] : null;
    },
    height(la, lo) {
      const v = sh(la, lo);
      return v ? v[0] : null;
    },
    hasHeight: height.size > 0,
  };
}

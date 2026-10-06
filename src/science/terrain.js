// Lane Science r3 (October 5, 2026): real land as splats, for "Terrain in a
// box" and the Contour lab (the small lab before it: the owner's call of
// October 5, "each after a small lab that teaches what it needs").
//
// The land is a square of the USGS 3D Elevation Program's measured heights
// (public domain; tools/sci3-terrain.mjs cuts it): each sample becomes a
// small flat splat facing up the slope's normal, colored by height
// (hypsometric tints) with the sun's shading baked in, and steep drops are
// filled down to the lower neighbor so cliffs stay solid. Recipe units are
// kilometers; heights are times the vertical exaggeration.
//
//   terrain-box  the land in a box: its walls show the cross-section, and
//                the tap fills it with water to a level, rising and draining
//                (a level, not a flood model)
//   contour-lab  the same land cut into contour layers (kit parts) that
//                slide apart, so a contour map reads as a 3D shape

import { mix, shade, vec } from "../kit.js";
import { evenBox } from "../packs/even.js";
import { gunzip } from "./density.js";

async function readAsset(rel) {
  const url = new URL(rel, import.meta.url);
  if (url.protocol === "file:") {
    const fs = await import("node:fs/promises");
    const b = await fs.readFile(url);
    return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not load ${rel.split("/").pop()}.`);
  return new Uint8Array(await r.arrayBuffer());
}

// The file tools/sci3-terrain.mjs writes: { head, n, h(i, j) meters }.
export async function readDem(bytes) {
  const raw = await gunzip(bytes);
  const len = new DataView(raw.buffer, raw.byteOffset, raw.byteLength).getUint32(0, true);
  const head = JSON.parse(new TextDecoder().decode(raw.subarray(4, 4 + len)));
  if (head.format !== "splashery-dem-1") throw new Error("This isn't an elevation file.");
  const n = head.n;
  const q = new Uint16Array(raw.buffer.slice(raw.byteOffset + 4 + len, raw.byteOffset + 4 + len + n * n * 2)); // prettier-ignore
  return { head, n, h: (i, j) => head.low + q[j * n + i] * head.step };
}

const C = "Public domain (USGS 3D Elevation Program)";
export const TERRAIN_PLACES = [
  { id: "st-helens", choice: "Mount St. Helens" },
  { id: "grand-canyon", choice: "The Grand Canyon" },
  { id: "yosemite", choice: "Yosemite Valley and Half Dome" },
].map((p) => ({
  ...p,
  title: `${p.choice}: USGS 3DEP 1/3 arc-second elevation, a square averaged to 256 × 256 samples`,
  author: "U.S. Geological Survey, 3D Elevation Program (The National Map)",
  source: "https://www.usgs.gov/3d-elevation-program",
  license: C,
  licenseUrl: "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits",
}));

const T = { dems: new Map(), want: null, info: null, contour: null };
export const terrainState = () => (T.info ? { ...T.info } : null);
export const contourState = () => (T.contour ? { ...T.contour } : null);

async function prepareDem(o) {
  const def = TERRAIN_PLACES.find((p) => p.id === o.place) || TERRAIN_PLACES[0];
  if (!T.dems.has(def.id)) T.dems.set(def.id, await readDem(await readAsset(`../../assets/toys/terrain-box/${def.id}.dem.gz`))); // prettier-ignore
  T.want = { def, D: T.dems.get(def.id) };
}

// Hypsometric tints: low green, through tan and brown, to pale rock.
const TINTS = ["#4f7f3a", "#7e9a4a", "#c3b06e", "#a47a4a", "#8c6a52", "#d9d4cc"];
function tint(t) {
  const x = Math.max(0, Math.min(1, t)) * (TINTS.length - 1);
  const i = Math.min(TINTS.length - 2, Math.floor(x));
  return mix(TINTS[i], TINTS[i + 1], x - i);
}
const SUN = vec.unit([-0.55, 0.75, -0.35]); // from the northwest, as maps shade
function sunlit(col, n) {
  const d = vec.dot(n, SUN);
  return shade(col, 0.45 + 0.75 * Math.max(0, d));
}
// A tidy contour interval: about `bands` steps over the relief.
export function contourInterval(relief, bands = 10) {
  const raw = relief / bands;
  const p = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw) return m * p;
  return 10 * p;
}

// The land's samples as splats: calls emit(p, n, col, b) for each (b: the
// contour band, from 0). stride thins the grid on small budgets.
function landSplats(D, { exag, stride, interval, contours, onlyHeight }, emit) {
  const n = D.n;
  const [sx, sz] = D.head.spacing; // meters
  const half = [((n - 1) * sx) / 2000, ((n - 1) * sz) / 2000];
  const low = D.head.low;
  const relief = D.head.high - low;
  const X = (i) => (i * sx) / 1000 - half[0];
  const Z = (j) => (j * sz) / 1000 - half[1];
  const Y = (h) => ((h - low) / 1000) * exag;
  const band = (h) => Math.floor((h - low) / interval);
  for (let j = 0; j < n; j += stride)
    for (let i = 0; i < n; i += stride) {
      const h = D.h(i, j);
      const hx = D.h(Math.min(n - 1, i + 1), j) - D.h(Math.max(0, i - 1), j);
      const hz = D.h(i, Math.min(n - 1, j + 1)) - D.h(i, Math.max(0, j - 1));
      const nrm = vec.unit([(-hx / (2 * sx)) * exag, 1, (-hz / (2 * sz)) * exag]);
      let col = onlyHeight ? "#b9b3a6" : tint((h - low) / relief);
      const b = band(h);
      // A contour line: where a neighbor is in another band.
      if (contours) {
        const nb = [
          [i + stride, j],
          [i, j + stride],
        ].some(([a, c]) => a < n && c < n && band(D.h(a, c)) !== b);
        if (nb) col = shade(col, 0.42);
      }
      emit([X(i), Y(h), Z(j)], nrm, sunlit(col, nrm), b);
      // A steep drop to the lower neighbor: fill the cliff down to it, so
      // the wall stays solid (its color a little darker, facing out).
      for (const [a, c, dir] of [
        [i + stride, j, [1, 0, 0]],
        [i - stride, j, [-1, 0, 0]],
        [i, j + stride, [0, 0, 1]],
        [i, j - stride, [0, 0, -1]],
      ]) {
        if (a < 0 || c < 0 || a >= n || c >= n) continue;
        const drop = Y(h) - Y(D.h(a, c));
        const step = (stride * Math.min(sx, sz)) / 1000;
        if (drop <= step) continue;
        const m = Math.min(24, Math.floor(drop / step));
        const out = vec.unit([dir[0] * 2 + nrm[0], 0.3, dir[2] * 2 + nrm[2]]);
        for (let k = 1; k <= m; k++) {
          const y = Y(h) - (k * drop) / (m + 1);
          const hk = low + (y / exag) * 1000;
          emit([X(i) + (dir[0] * step) / 2, y, Z(j) + (dir[2] * step) / 2], out, sunlit(shade(onlyHeight ? "#b9b3a6" : tint((hk - low) / relief), 0.85), out), band(hk)); // prettier-ignore
        }
      }
    }
  return { half, relief, Y, X, Z };
}

const strideFor = (k) => (k.count >= 130000 ? 1 : 2);

const PLACE_OPTION = {
  key: "place",
  label: "Place",
  type: "select",
  default: "st-helens",
  choices: TERRAIN_PLACES.map((p) => ({ id: p.id, label: p.choice })),
};
const EXAG_OPTION = {
  key: "exag",
  label: "Height",
  type: "select",
  default: "2",
  choices: [
    { id: "1", label: "True (1×)" },
    { id: "2", label: "Stretched 2×" },
    { id: "4", label: "Stretched 4×" },
  ],
};
const credits = TERRAIN_PLACES.map((p) => ({
  label: p.choice,
  title: p.title,
  source: p.source,
  author: p.author,
  license: p.license,
  licenseUrl: p.licenseUrl,
}));

// ---- Terrain in a box ------------------------------------------------------------------

export const TERRAIN = {
  alive: false,
  options: [
    PLACE_OPTION,
    EXAG_OPTION,
    { key: "contours", label: "Contour lines", type: "switch", default: false },
  ],
  controls: [{ key: "water", label: "Fill with water", type: "toggle", default: 0, ease: 3.5 }],
  // A tap fills the land with water to a level (rising over a few seconds);
  // a second tap drains it.
  action: { key: "water", label: "Fill it with water" },
  credits,
  prepare: prepareDem,
  drive(t, c, out) {
    const u = c.water ?? 0;
    const e = u * u * (3 - 2 * u);
    out.parts.water = { offset: [0, (T.info?.waterTop ?? 0) * e, 0], visible: e > 0.004 ? 1 : 0 };
  },
  build(k, o) {
    const { D, def } = T.want;
    const exag = Number(o.exag) || 2;
    const stride = strideFor(k);
    const relief = D.head.high - D.head.low;
    const interval = contourInterval(relief, 12);
    const pts = [];
    const L = landSplats(D, { exag, stride, interval, contours: o.contours === true }, (p, n, col) => pts.push([p, n, col])); // prettier-ignore
    const spacing = (stride * Math.min(...D.head.spacing)) / 1000;
    const base = () => k.baseSize || 0.01;
    const size = spacing * 0.95;
    k.cloud({ count: (pts.length * 160000) / k.count, jitter: 0 }, (_r, j) => {
      const e = pts[j];
      if (!e) return null;
      return { p: e[0], n: e[1], flat: 0.3, size: size / base(), color: e[2], opacity: 1 };
    });
    // The box: its four walls show the land's cross-section down to a base
    // under the lowest point, and a dark floor.
    const [hx, hz] = L.half;
    const bottom = -0.12 * (relief / 1000) * exag - 0.15;
    const walls = [];
    const n = D.n;
    const edge = (i, j, out) => {
      const top = L.Y(D.h(i, j));
      const m = Math.max(2, Math.ceil((top - bottom) / spacing));
      for (let s = 0; s <= m; s++) {
        const y = bottom + ((top - bottom) * s) / m;
        const depth = (top - y) / (top - bottom + 1e-9);
        walls.push([[L.X(i) + out[0] * 0.002, y, L.Z(j) + out[2] * 0.002], out, sunlit(mix("#8a6a4c", "#4a382a", depth), out)]); // prettier-ignore
      }
    };
    for (let i = 0; i < n; i += stride) {
      edge(i, 0, [0, 0, -1]);
      edge(i, n - 1, [0, 0, 1]);
    }
    for (let j = 0; j < n; j += stride) {
      edge(0, j, [-1, 0, 0]);
      edge(n - 1, j, [1, 0, 0]);
    }
    k.cloud({ count: (walls.length * 160000) / k.count, jitter: 0 }, (_r, j) => {
      const e = walls[j];
      if (!e) return null;
      return { p: e[0], n: e[1], flat: 0.3, size: size / base(), color: e[2], opacity: 1 };
    });
    k.add(evenBox(2 * hx, 0.02, 2 * hz), { pos: [0, bottom - 0.01, 0], even: true, color: "#2a2420", jitter: 0, opacity: 1, flat: 0.3 }); // prettier-ignore
    // The water: a sheet at the lowest point (a part), raised by the tap to
    // 45% of the relief; the land above the level hides it.
    const water = k.part("water");
    const wStride = stride * 2;
    const sheet = [];
    for (let j = 0; j < n; j += wStride)
      for (let i = 0; i < n; i += wStride) sheet.push([L.X(i), 0.004, L.Z(j)]);
    k.cloud({ count: (sheet.length * 160000) / k.count, jitter: 0 }, (_r, j) => {
      const p = sheet[j];
      if (!p) return null;
      return { p, n: [0, 1, 0], flat: 0.15, size: (spacing * 2.1) / base(), color: "#2f74b8", opacity: 0.8, part: water }; // prettier-ignore
    });
    T.info = {
      place: def.id,
      name: D.head.name,
      low: D.head.low,
      high: D.head.high,
      exag,
      stride,
      land: pts.length,
      walls: walls.length,
      water: sheet.length,
      interval,
      // The water's top: 45% of the relief (km, times the exaggeration).
      waterTop: 0.45 * (relief / 1000) * exag,
      waterLevel: D.head.low + 0.45 * relief,
    };
    k.data = { terrain: T.info };
  },
  input: {
    title: "About this land",
    fileButton: false,
    shown() {
      const i = T.info;
      if (!i) return "";
      return `${i.name}: ${Math.round(i.low).toLocaleString("en")} to ${Math.round(i.high).toLocaleString("en")} m above sea level, heights stretched ${i.exag}×. The water rises to ${Math.round(i.waterLevel).toLocaleString("en")} m.${i.interval ? ` Contour lines every ${i.interval} m.` : ""}`; // prettier-ignore
    },
  },
};

// ---- Contour lab ---------------------------------------------------------------------

export const CONTOUR = {
  alive: false,
  options: [PLACE_OPTION, EXAG_OPTION],
  controls: [
    { key: "apart", label: "Pull the layers apart", type: "toggle", default: 0, ease: 1.6 },
  ],
  // A tap pulls the contour layers apart (each band of height its own
  // solid piece) and a second tap stacks them again.
  action: { key: "apart", label: "Pull the layers apart" },
  credits,
  prepare: prepareDem,
  drive(t, c, out) {
    const I = T.contour;
    if (!I) return;
    const a = c.apart ?? 0;
    const ea = a * a * (3 - 2 * a);
    for (let b = 0; b < I.bands; b++) {
      // Apart: each layer lifts by its index, so the gaps show its edges.
      const y = b * I.gap * ea;
      out.parts[`band${b}`] = { offset: [0, y, 0] };
    }
  },
  build(k, o) {
    const { D, def } = T.want;
    const exag = Number(o.exag) || 2;
    const stride = strideFor(k);
    const relief = D.head.high - D.head.low;
    // At most 14 layers (the kit's parts).
    let interval = contourInterval(relief, 9);
    while (Math.floor(relief / interval) + 1 > 14) interval *= 2;
    const bands = Math.floor(relief / interval) + 1;
    const parts = Array.from({ length: bands }, (_, b) => k.part(`band${b}`));
    const pts = [];
    landSplats(D, { exag, stride, interval, contours: true }, (p, n, col, b) => pts.push([p, n, col, Math.min(bands - 1, b)])); // prettier-ignore
    const spacing = (stride * Math.min(...D.head.spacing)) / 1000;
    const base = () => k.baseSize || 0.01;
    // Each layer its own tint (alternating light and dark, as a map's bands).
    k.cloud({ count: (pts.length * 160000) / k.count, jitter: 0 }, (_r, j) => {
      const e = pts[j];
      if (!e) return null;
      const col = e[3] % 2 ? shade(e[2], 0.88) : e[2];
      return { p: e[0], n: e[1], flat: 0.3, size: (spacing * 0.95) / base(), color: col, opacity: 1, part: parts[e[3]] }; // prettier-ignore
    });
    T.contour = {
      place: def.id,
      name: D.head.name,
      exag,
      bands,
      interval,
      land: pts.length,
      // A layer's lift when apart (km).
      gap: 0.35 * (interval / 1000) * exag + 0.12,
    };
    k.data = { contours: T.contour };
  },
  input: {
    title: "About these contours",
    fileButton: false,
    shown() {
      const i = T.contour;
      if (!i) return "";
      return `${i.name}: ${i.bands} layers, one every ${i.interval} m of height. On a map, each layer's edge is a contour line.`; // prettier-ignore
    },
  },
};

// Real elements (lane Elements, prefix rel): a periodic table of real samples, in the spirit of the
// classic photographic periodic tables. Each tile holds a small 3D sample: an open photo of the
// real element, cut out of its background and raised by its depth (the Photo to 3D tool's depth
// model; tools/rel-samples.mjs), so the lumps, crystals and vials stand up from their tiles. A tap
// on a tile lifts its sample out toward you, larger and in finer detail, swings it so its relief
// shows, and lists its facts beside the stage; a tap on the lifted sample turns it once around. The
// elements no one has photographed (the heaviest and most radioactive) have plain tiles, and their
// facts say why. Colors by category or block are an option. Loaded on demand (labs).
//
// Weight: the table's samples come in one 640 x 640 atlas (a JPEG of colors and a PNG of depth,
// about 0.2 MB together); each lifted sample loads its own 256 x 256 pair (about 40 KB) only when
// it is lifted.

import { quatAxisAngle, quatMul } from "../kit.js";
import { FACTS } from "../elements-real/facts.js";
import { SAMPLES, WITH_PHOTO, LICENSE_URL } from "../elements-real/samples.js";
import { placeOf, blockOf } from "../elements-real/layout.js";
import { inkCells } from "../elements-real/lettering.js";

const TAU = Math.PI * 2;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => x * x * (3 - 2 * x);
const band = (x, a, b) => clamp01((x - a) / (b - a));

// ---- The facts ------------------------------------------------------------------------------

export const ELEMENTS = FACTS.map(
  ([z, symbol, name, mass, group, period, state, density, melt, boil, year, family, uses]) => ({
    z,
    symbol,
    name,
    mass,
    group,
    period,
    state,
    density,
    melt,
    boil,
    year,
    family,
    uses,
    block: blockOf(z),
    sample: SAMPLES[z],
  }),
);
const BY_SYMBOL = new Map(ELEMENTS.map((e) => [e.symbol, e]));
export const elementOf = (symbol) => BY_SYMBOL.get(symbol) || null;

const cel = (k) => Math.round((k - 273.15) * 10) / 10;
const fmtC = (k) => `${cel(k).toLocaleString("en-US")} °C`;
// A mass as PubChem gives it; a whole number is the mass number of the longest-lived isotope.
const fmtMass = (e) => (/\./.test(e.mass) ? `${e.mass} u` : `[${e.mass}] u (longest-lived isotope)`); // prettier-ignore
function fmtDensity(e) {
  if (e.density == null) return "Density: not measured";
  // A gas's density reads better per liter.
  if (e.state.startsWith("gas")) return `Density ${+(e.density * 1000).toPrecision(4)} g/L (gas at 0 °C)`; // prettier-ignore
  return `Density ${e.density} g/cm³`;
}
function fmtMeltBoil(e) {
  const parts = [];
  // Helium never freezes at normal pressure: PubChem's 0.95 K is under about 25 atmospheres.
  if (e.z === 2) parts.push("Freezes only under pressure");
  // Arsenic turns straight to gas at normal pressure (PubChem's boiling point); its melting point
  // is under pressure.
  if (e.z === 33) return `Sublimes at ${fmtC(e.boil)} · Melts only under pressure`;
  if (e.z !== 2 && e.melt != null) parts.push(`Melts at ${fmtC(e.melt)}`);
  if (e.boil != null) parts.push(`Boils at ${fmtC(e.boil)}`);
  return parts.length ? parts.join(" · ") : "Melting and boiling points not measured";
}
const fmtYear = (e) =>
  e.year === "Ancient" ? "Known since ancient times" : `Discovered in ${e.year}`;
const STATE_TEXT = {
  solid: "Solid at room temperature",
  liquid: "Liquid at room temperature",
  gas: "Gas at room temperature",
};
const fmtState = (e) => STATE_TEXT[e.state] || `${e.state[0].toUpperCase()}${e.state.slice(1)} at room temperature`; // prettier-ignore
const fmtGroup = (e) =>
  e.group ? `Group ${e.group} · Period ${e.period}` : `${e.period === 6 ? "Lanthanoid" : "Actinoid"} · Period ${e.period}`; // prettier-ignore

// The facts list beside the stage (out.legend): number, symbol, name and the rest, then the
// sample's photo credit (a BY-SA notice included).
export function factsOf(e) {
  const items = [
    { text: `Atomic mass ${fmtMass(e)}` },
    { text: fmtGroup(e) },
    { text: fmtState(e) },
    { text: fmtDensity(e) },
    { text: fmtMeltBoil(e) },
    { text: fmtYear(e) },
  ];
  if (e.uses.length) {
    items.push({ text: "Uses", head: true });
    for (const [text] of e.uses) items.push({ text });
  }
  items.push({ text: "Sample", head: true });
  const s = e.sample;
  if (s.none) items.push({ text: s.none, dim: true });
  else {
    items.push({ text: s.what });
    items.push({ text: `Photo: ${s.author}, ${s.license}`, dim: true });
  }
  return { title: `${e.z} ${e.symbol} · ${e.name}`, items };
}

// ---- Colors ---------------------------------------------------------------------------------

// PubChem's group blocks, in the Periodic table toy's pastels.
const CATEGORY = {
  "Alkali metal": "#ff8f6b",
  "Alkaline earth metal": "#ffc766",
  "Transition metal": "#8fb8ff",
  "Post-transition metal": "#9fd6cf",
  Metalloid: "#c4df7a",
  Nonmetal: "#76e3a5",
  Halogen: "#f5e36e",
  "Noble gas": "#c9a8ff",
  Lanthanide: "#ffaad6",
  Actinide: "#f0a0f5",
};
const BLOCK = { s: "#ff9b7a", p: "#f2d16b", d: "#86b4ff", f: "#e6a1f2" };
const PLATE = "#1d222b";
const BOARD = "#121419";
const INK = "#eef0f2";

function plateColor(e, mode) {
  if (mode === "category") return CATEGORY[e.family] || "#9aa3b2";
  if (mode === "block") return BLOCK[e.block];
  return PLATE;
}

// ---- Layout ---------------------------------------------------------------------------------

const PITCH = 1;
const TILE = 0.92;
const tilePos = (z) => {
  const [col, row] = placeOf(z);
  return [(col - 9.5) * PITCH, 3.5 - (row - 1) * PITCH, 0];
};
// The sample sits in the lower part of its tile, the lettering above it.
const SAMPLE_SIDE = 0.66;
const SAMPLE_DY = -0.115;
const RELIEF = 0.32; // the depth of a sample against its width
// Where a lifted sample hangs: over the right half of the table, well toward the viewer (the facts
// list sits at the stage's top left, so on a phone the two sit side by side).
const LIFT_AT = [4.1, 0.3, 3.6];
const LIFT_SIDE = 5.6;

// ---- Loading the samples ----------------------------------------------------------------------

const RE = { atlas: null, loading: null, detail: new Map(), ready: new Map() };
const ATLAS_COLS = 10;
const ATLAS_CELL = 64;

async function readBytes(rel) {
  const url = new URL(rel, import.meta.url);
  if (url.protocol === "file:") {
    const fs = await import("node:fs/promises");
    return new Uint8Array(await fs.readFile(url));
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error("Could not load the element samples.");
  return new Uint8Array(await r.arrayBuffer());
}

// A JPEG or PNG as { w, h, data: RGBA }, unchanged by color management (the PNG's gray levels are
// depths).
async function decode(bytes) {
  if (typeof createImageBitmap === "function" && typeof document !== "undefined") {
    const bmp = await createImageBitmap(new Blob([bytes]), {
      colorSpaceConversion: "none",
      premultiplyAlpha: "none",
    });
    const cv = document.createElement("canvas");
    cv.width = bmp.width;
    cv.height = bmp.height;
    const g = cv.getContext("2d", { willReadFrequently: true });
    g.drawImage(bmp, 0, 0);
    bmp.close?.();
    const d = g.getImageData(0, 0, cv.width, cv.height);
    return { w: d.width, h: d.height, data: new Uint8Array(d.data.buffer) };
  }
  if (bytes[0] === 0x89) {
    const { PNG } = await import("pngjs");
    const p = PNG.sync.read(globalThis.Buffer.from(bytes));
    return { w: p.width, h: p.height, data: new Uint8Array(p.data) };
  }
  const jpeg = (await import("jpeg-js")).default;
  const j = jpeg.decode(globalThis.Buffer.from(bytes), { useTArray: true });
  return { w: j.width, h: j.height, data: j.data };
}

async function loadPair(name) {
  const [c, d] = await Promise.all([
    readBytes(`../../assets/toys/real-elements/${name}.jpg`).then(decode),
    readBytes(`../../assets/toys/real-elements/${name}.png`).then(decode),
  ]);
  return { color: c, depth: d };
}

function loadAtlas() {
  if (!RE.loading)
    RE.loading = loadPair("tiles")
      .then((a) => (RE.atlas = a))
      .catch((e) => {
        RE.loading = null;
        throw e;
      });
  return RE.loading;
}

async function loadDetail(z) {
  if (!RE.detail.has(z))
    RE.detail.set(
      z,
      loadPair(String(z)).then((p) => {
        RE.ready.set(z, p);
        return p;
      }),
    );
  return RE.detail.get(z);
}

// The pixels of one sample: a size x size window of an image pair at (ox, oy).
function samplePixels(pair, ox, oy, size, step) {
  const out = [];
  const { color, depth } = pair;
  const w = color.w;
  for (let y = 0; y < size; y += step)
    for (let x = 0; x < size; x += step) {
      const i = (oy + Math.floor(y)) * w + ox + Math.floor(x);
      const g = depth.data[i * 4];
      if (!g) continue;
      out.push({
        u: (x + step / 2) / size,
        v: (y + step / 2) / size,
        d: (g - 1) / 254,
        c: [color.data[i * 4] / 255, color.data[i * 4 + 1] / 255, color.data[i * 4 + 2] / 255],
        i,
      });
    }
  return out;
}

// How many sample pixels a window holds (to pick a step for a budget).
function countPixels(pair, ox, oy, size) {
  let n = 0;
  const w = pair.depth.w;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) if (pair.depth.data[((oy + y) * w + ox + x) * 4]) n++;
  return n;
}

const atlasSpot = (z) => {
  const k = WITH_PHOTO.indexOf(z);
  return [(k % ATLAS_COLS) * ATLAS_CELL, Math.floor(k / ATLAS_COLS) * ATLAS_CELL];
};

// The depth's surface normal at a pixel (for the lifted sample's splats to face the right way).
function normalAt(pair, i, size, side) {
  const { depth } = pair;
  const w = depth.w;
  const at = (j) => depth.data[j * 4];
  const g0 = at(i);
  const gx = (at(i + 1) || g0) - (at(i - 1) || g0);
  const gy = (at(i + w) || g0) - (at(i - w) || g0);
  const k = (RELIEF * side) / 254 / ((2 * side) / size);
  const n = [-gx * k, gy * k, 1];
  const l = Math.hypot(n[0], n[1], n[2]);
  return [n[0] / l, n[1] / l, n[2] / l];
}

// ---- The toy ----------------------------------------------------------------------------------

const MEM = new WeakMap();
const mem = (c) => {
  let m = MEM.get(c);
  if (!m) MEM.set(c, (m = {}));
  return m;
};
// The element the last build showed (action.at has no build data).
const SHOWN = { symbol: "Cu" };

const REAL_ELEMENTS = {
  alive: true,
  turntable: false,
  density: 1.6,
  options: [
    {
      key: "element",
      label: "Element",
      type: "select",
      default: "Cu",
      choices: ELEMENTS.map((e) => ({ id: e.symbol, label: `${e.z} ${e.name}` })),
    },
    {
      key: "color",
      label: "Tile colors",
      type: "select",
      default: "plain",
      choices: [
        { id: "plain", label: "Plain (the samples' own colors)" },
        { id: "category", label: "By category" },
        { id: "block", label: "By block (s, p, d, f)" },
      ],
    },
  ],
  controls: [
    { key: "up", label: "Lift the sample", type: "toggle", default: 0, ease: 2.4 },
    { key: "spin", label: "Turn it around", type: "pulse", ease: 3.6 },
  ],
  action: {
    key: "up",
    label: "Lift or lower the sample",
    // A tile lifts its element's sample (switching to it); the lifted sample's own tile lowers
    // it; a tap on the lifted sample turns it once around.
    at(p, c) {
      const up = (c.up ?? 0) > 0.5;
      if (up && p[2] > 1.2 && Math.hypot(p[0] - LIFT_AT[0], p[1] - LIFT_AT[1]) < LIFT_SIDE * 0.7)
        return "spin";
      if (p[2] < 0.6) {
        const e = ELEMENTS.find((x) => {
          const t = tilePos(x.z);
          return Math.abs(p[0] - t[0]) <= PITCH / 2 && Math.abs(p[1] - t[1]) <= PITCH / 2;
        });
        if (e && e.symbol !== SHOWN.symbol) return { options: { element: e.symbol }, key: "up" };
        if (e) return "up";
      }
      return "up";
    },
  },
  credits: [
    {
      label: "Sample photos (most elements)",
      title: "Images of Elements: a photo of each element; credit links to each element's page",
      source: "https://images-of-elements.com/",
      author: "Images of Elements (Jumk.de Webprojects)",
      license: "CC BY 3.0",
      licenseUrl: LICENSE_URL["CC BY 3.0"],
    },
    ...WITH_PHOTO.filter((z) => SAMPLES[z].src === "commons").map((z) => ({
      label: `${elementOf(ELEMENTS[z - 1].symbol).name} sample`,
      title: SAMPLES[z].file,
      source: SAMPLES[z].page,
      author: SAMPLES[z].author,
      license: SAMPLES[z].license,
      licenseUrl: LICENSE_URL[SAMPLES[z].license],
    })),
    {
      label: "Element facts",
      title: "PubChem Periodic Table of Elements and element pages (uses quoted there from Jefferson Lab and Los Alamos National Laboratory, U.S. Department of Energy)", // prettier-ignore
      source: "https://pubchem.ncbi.nlm.nih.gov/periodic-table/",
      author: "NCBI PubChem",
      license: "Public domain (U.S. government data)",
      licenseUrl: "https://www.ncbi.nlm.nih.gov/home/about/policies/",
    },
  ],
  // Points for the clip tool and the tests: an element's tile, the lifted sample.
  tileAt: (symbol) => {
    const e = elementOf(symbol);
    if (!e) return null;
    const t = tilePos(e.z);
    return [t[0], t[1] + SAMPLE_DY, 0.05];
  },
  liftAt: () => [LIFT_AT[0], LIFT_AT[1], LIFT_AT[2] + 0.4],
  async prepare(o) {
    const e = elementOf(o.element) || elementOf("Cu");
    await Promise.all([loadAtlas(), e.sample.none ? null : loadDetail(e.z)]);
  },
  drive(t, c, out, info) {
    const D = info.data;
    if (!D) return;
    const m = mem(c);
    const u = c.up ?? 0;
    // Up: the sample rises out of its tile and grows as it comes forward; down: the reverse.
    const rise = ease(band(u, 0, 0.75));
    const vis = rise > 0.004 ? 1 : 0;
    const sc = D.homeScale + (1 - D.homeScale) * rise;
    const off = D.home.map((h, i) => (h - LIFT_AT[i]) * (1 - rise));
    // Once up, it swings slowly to show its relief; a tap turns it once around.
    if (u > 0.98 && m.swing0 === undefined) m.swing0 = t;
    if (u < 0.98) m.swing0 = undefined;
    const sw = m.swing0 === undefined ? 0 : t - m.swing0;
    const swing = 0.62 * Math.sin(0.55 * sw) * Math.min(1, sw / 2);
    const sp = c.spin > 0 ? ease(1 - c.spin) : 0;
    const yaw = swing + TAU * sp + 2 * rise * (1 - rise);
    const tilt = -0.18 * rise;
    const q = quatMul(quatAxisAngle([0, 1, 0], yaw), quatAxisAngle([1, 0, 0], tilt));
    out.parts.lift = { offset: off, scale: sc, visible: vis, quat: q };
    // Its place in the table empties while it is out.
    out.parts.home = { visible: rise > 0.01 ? 0 : 1 };
    // The splats are sorted where they stand while the sample turns.
    out.resortPose = vis === 1 && (Math.abs(yaw) > 0.4 || c.spin > 0 || (u > 0 && u < 1));
    if (rise > 0.35) out.legend = D.legend;
    // A soft lift and set-down.
    const before = m.u ?? u;
    if (before < 0.02 && u >= 0.02) out.cues.push({ voice: "tine", f: 520, decay: 0.6, vol: 0.32 });
    if (before > 0.98 && u <= 0.98 && u < before) out.cues.push({ voice: "clack", f: 900, decay: 0.3, vol: 0.25 }); // prettier-ignore
    m.u = u;
    if (c.spin > 0 && (m.spin ?? 0) <= 0) out.cues.push({ voice: "blip", f: 440, to: 1.5, decay: 0.8, vol: 0.3 }); // prettier-ignore
    m.spin = c.spin;
  },
  build(k, o) {
    const e = elementOf(o.element) || elementOf("Cu");
    SHOWN.symbol = e.symbol;
    const mode = ["category", "block"].includes(o.color) ? o.color : "plain";
    const atlas = RE.atlas;
    const N = k.count;
    const home = k.part("home");
    const lift = k.part("lift", { pivot: LIFT_AT, axis: [0, 1, 0] });
    const unitSize = 1 / 0.01; // a cloud-only recipe's base splat size is 0.01
    const splat = (p, c, size, extra = {}) => ({
      p,
      n: extra.n || [0, 0, 1],
      flat: extra.flat ?? 0.35,
      size: size * unitSize,
      color: c,
      opacity: 1,
      pattern: false,
      jitter: 0,
      ...extra,
    });
    const cloud = (list, opts = {}) => {
      if (!list.length) return;
      k.cloud({ share: list.length / N, pattern: false, jitter: 0, ...opts }, (_r, i) => list[i] ?? null); // prettier-ignore
    };
    const hex = (h) => {
      const v = parseInt(h.slice(1), 16);
      return [(v >> 16) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
    };

    // The board behind the tiles.
    {
      const list = [];
      const x0 = -9 - 0.1;
      const x1 = 9 + 0.1;
      const y0 = 3.5 - 9.45 - 0.6;
      const y1 = 4.1;
      const n = Math.max(400, Math.round(N * 0.04));
      const step = Math.sqrt(((x1 - x0) * (y1 - y0)) / n);
      // (Small splats at the rim keep its edge crisp.)
      for (let y = y0 + step / 2; y < y1; y += step)
        for (let x = x0 + step / 2; x < x1; x += step) {
          const rim = Math.min(x - x0, x1 - x, y - y0, y1 - y) < step;
          list.push(splat([x, y, -0.06], hex(BOARD), step * (rim ? 0.4 : 0.66)));
        }
      cloud(list);
    }

    // The tiles: a plate, the symbol and number, and the sample (or a placeholder's large, dim
    // symbol).
    const plates = [];
    const ink = [];
    const plateN = Math.max(36, Math.round((N * 0.09) / 118));
    const pStep = TILE / Math.round(Math.sqrt(plateN));
    for (const el of ELEMENTS) {
      const [tx, ty] = tilePos(el.z);
      const col = hex(plateColor(el, mode));
      const plain = mode === "plain";
      for (let y = -TILE / 2 + pStep / 2; y < TILE / 2; y += pStep)
        for (let x = -TILE / 2 + pStep / 2; x < TILE / 2; x += pStep) {
          const edge = Math.min(TILE / 2 - Math.abs(x), TILE / 2 - Math.abs(y));
          let cc = edge < pStep ? shadeArr(col, plain ? 1.6 : 0.82) : col;
          // A placeholder tile is hatched, so it reads as "no sample" at a glance.
          if (el.sample.none && Math.floor((x + y) / (pStep * 1.5)) % 2 === 0) cc = shadeArr(cc, plain ? 1.45 : 0.9); // prettier-ignore
          plates.push(splat([tx + x, ty + y, 0], cc, pStep * 0.72));
        }
      const inkCol = hex(plain ? INK : "#171b26");
      const px = 0.03;
      for (const [x, y] of inkCells(el.symbol, tx - TILE / 2 + 0.07, ty + TILE / 2 - 0.15, px))
        ink.push(splat([x, y, 0.012], inkCol, px * 0.62));
      const pn = 0.019;
      const num = String(el.z);
      for (const [
        x,
        y,
      ] of inkCells(num, tx + TILE / 2 - 0.06 - (num.length * 6 - 1) * pn, ty + TILE / 2 - 0.12, pn)) // prettier-ignore
        ink.push(splat([x, y, 0.012], inkCol, pn * 0.66));
      if (el.sample.none) {
        const pb = 0.05;
        const dim = plain ? [0.36, 0.39, 0.45] : shadeArr(col, 0.7);
        for (const [x, y] of inkCells(el.symbol, tx, ty + SAMPLE_DY, pb, true))
          ink.push(splat([x, y, 0.01], dim, pb * 0.62));
      }
    }
    cloud(plates);
    cloud(ink);

    // The samples on the tiles: each its share of the budget, a relief over its tile.
    const tileList = [];
    const per = (N * 0.45) / WITH_PHOTO.length;
    for (const z of WITH_PHOTO) {
      const el = ELEMENTS[z - 1];
      const [tx, ty] = tilePos(z);
      const [ox, oy] = atlasSpot(z);
      const have = countPixels(atlas, ox, oy, ATLAS_CELL);
      const step = Math.max(3, Math.sqrt(have / per));
      const px = (SAMPLE_SIDE / ATLAS_CELL) * step;
      for (const s of samplePixels(atlas, ox, oy, ATLAS_CELL, step)) {
        const x = tx + (s.u - 0.5) * SAMPLE_SIDE;
        const y = ty + SAMPLE_DY + (0.5 - s.v) * SAMPLE_SIDE;
        const zz = 0.015 + RELIEF * SAMPLE_SIDE * s.d;
        tileList.push(splat([x, y, zz], s.c, px * 0.9, { part: el === e ? home : 0 }));
      }
    }
    cloud(tileList);

    // The lifted sample, built at its lifted size and place; drive() shrinks it into its tile.
    const liftList = [];
    if (!e.sample.none) {
      const pair = RE.ready.get(e.z);
      if (pair) {
        const size = pair.color.w;
        const have = countPixels(pair, 0, 0, size);
        // Front, back and rim: about 0.62, 0.26 and 0.12 of the share.
        const share = N * 0.24;
        const step = Math.max(1, Math.sqrt(have / (share * 0.62)));
        const px = (LIFT_SIDE / size) * step;
        const hz = RELIEF * LIFT_SIDE;
        const backStep = step * 1.5;
        const at = (s) => [LIFT_AT[0] + (s.u - 0.5) * LIFT_SIDE, LIFT_AT[1] + (0.5 - s.v) * LIFT_SIDE]; // prettier-ignore
        // The front: the photo's own relief, each splat facing along the surface's normal.
        for (const s of samplePixels(pair, 0, 0, size, step)) {
          const [x, y] = at(s);
          const n = normalAt(pair, s.i, size, LIFT_SIDE);
          liftList.push(splat([x, y, LIFT_AT[2] + hz * (s.d - 0.5)], s.c, px * 0.8, { part: lift, n, flat: 0.3 })); // prettier-ignore
        }
        // The back: a shallower mirror of the front, darker (the photo never saw it).
        for (const s of samplePixels(pair, 0, 0, size, backStep)) {
          const [x, y] = at(s);
          const zb = LIFT_AT[2] - hz * 0.5 - hz * 0.35 * s.d;
          liftList.push(splat([x, y, zb], shadeArr(s.c, 0.55), px * 1.5 * 0.66, { part: lift, n: [0, 0, -1], flat: 0.3 })); // prettier-ignore
        }
        // The rim: the sample's edge, closed from its back to its front, so it turns as a solid.
        const { depth } = pair;
        const inS = (x, y) => x >= 0 && y >= 0 && x < size && y < size && depth.data[(y * size + x) * 4] > 0; // prettier-ignore
        const rimStep = Math.max(1, Math.round(step));
        for (let y = 0; y < size; y += rimStep)
          for (let x = 0; x < size; x += rimStep) {
            if (!inS(x, y)) continue;
            const ex = inS(x - rimStep, y) && inS(x + rimStep, y) && inS(x, y - rimStep) && inS(x, y + rimStep); // prettier-ignore
            if (ex) continue;
            const i = y * size + x;
            const d = (depth.data[i * 4] - 1) / 254;
            const c = [pair.color.data[i * 4] / 255, pair.color.data[i * 4 + 1] / 255, pair.color.data[i * 4 + 2] / 255]; // prettier-ignore
            const s = { u: (x + 0.5) / size, v: (y + 0.5) / size };
            const [px0, py0] = at(s);
            const zf = LIFT_AT[2] + hz * (d - 0.5);
            const zb = LIFT_AT[2] - hz * 0.5 - hz * 0.35 * d;
            const nOut = [px0 - LIFT_AT[0], py0 - LIFT_AT[1], 0];
            const ln = Math.hypot(nOut[0], nOut[1]) || 1;
            const steps = Math.max(1, Math.ceil((zf - zb) / px));
            for (let j = 1; j < steps; j++) {
              const zz = zb + ((zf - zb) * j) / steps;
              liftList.push(splat([px0, py0, zz], shadeArr(c, 0.75), px * 0.7, { part: lift, n: [nOut[0] / ln, nOut[1] / ln, 0], flat: 0.4 })); // prettier-ignore
            }
          }
      }
    } else {
      // No photo: a frosted glass slab with the symbol, so the lift still says which element.
      const W = LIFT_SIDE * 0.62;
      const H = LIFT_SIDE * 0.62;
      const n = Math.round(N * 0.08);
      const st = Math.sqrt((W * H) / n);
      const glass = [0.52, 0.58, 0.66];
      for (let y = -H / 2 + st / 2; y < H / 2; y += st)
        for (let x = -W / 2 + st / 2; x < W / 2; x += st) {
          const edge = Math.min(W / 2 - Math.abs(x), H / 2 - Math.abs(y));
          liftList.push(splat([LIFT_AT[0] + x, LIFT_AT[1] + y, LIFT_AT[2]], edge < st * 1.5 ? [0.78, 0.82, 0.88] : glass, st * 0.72, { part: lift, opacity: 0.55 })); // prettier-ignore
        }
      const pb = W / 16;
      for (const [x, y] of inkCells(e.symbol, LIFT_AT[0], LIFT_AT[1], pb, true))
        liftList.push(splat([x, y, LIFT_AT[2] + 0.03], [0.95, 0.96, 0.98], pb * 0.66, { part: lift })); // prettier-ignore
    }
    cloud(liftList, { fit: false });
    // Frame the table and the lifted sample.
    k.reach([-9.6, 4.2, 0]);
    k.reach([9.6, 3.5 - 9.45 - 0.6, 0]);
    const t = tilePos(e.z);
    const home3 = [t[0], t[1] + SAMPLE_DY, 0.015 + RELIEF * SAMPLE_SIDE * 0.5];
    k.data = {
      element: e.symbol,
      home: home3,
      homeScale: SAMPLE_SIDE / LIFT_SIDE,
      legend: factsOf(e),
      splats: { tiles: tileList.length, lift: liftList.length },
    };
  },
};

function shadeArr(c, f) {
  return [Math.min(1, c[0] * f), Math.min(1, c[1] * f), Math.min(1, c[2] * f)];
}

export const RECIPES = {
  "real-elements": REAL_ELEMENTS,
};

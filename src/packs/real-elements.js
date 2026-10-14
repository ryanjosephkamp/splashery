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
// about 0.2 MB together); each lifted sample loads its own 384 x 384 pair (about 55 KB) only when
// it is lifted.

import { quatAxisAngle, quatMul } from "../kit.js";
import { FACTS } from "../elements-real/facts.js";
import { SAMPLES, PICTURED, LICENSE_URL, STANDINS, pictureOf, reliefOf } from "../elements-real/samples.js"; // prettier-ignore
import { placeOf, blockOf } from "../elements-real/layout.js";
import { inkCells } from "../elements-real/lettering.js";

const TAU = Math.PI * 2;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => x * x * (3 - 2 * x);
// Polish: a gentler start and stop than ease (zero speed and zero acceleration at both ends).
const ease5 = (x) => x * x * x * (x * (x * 6 - 15) + 10);
const band = (x, a, b) => clamp01((x - a) / (b - a));

// The turn's path (fraction of a whole turn) over its time u: 0 to 1/4, hold, 1/4 to 3/4, hold,
// 3/4 to 1.
function turnPath(u) {
  const seg = (a, b, x) => ease5(Math.min(1, Math.max(0, (u - a) / (b - a)))) * x;
  return seg(0, 0.18, 0.25) + seg(0.36, 0.64, 0.5) + seg(0.82, 1, 0.25);
}

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
  const stand = STANDINS[e.z];
  if (s.none) {
    items.push({ text: s.none, dim: true });
    // Polish: a stand-in picture, said plainly to be one.
    if (stand) {
      items.push({ text: `Shown instead: ${stand.what}` });
      items.push({ text: `Picture: ${stand.author}, ${stand.license}`, dim: true });
    }
  } else {
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
function samplePixels(pair, ox, oy, size, step, fine = false) {
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
  if (!fine) return out;
  // The outline in finer splats (the owner's "a little bit sharper overall"): a cell the cutout
  // only partly covers gets a splat at each covered quarter, half the size.
  const h = step / 2;
  for (let y = 0; y < size; y += step)
    for (let x = 0; x < size; x += step) {
      const at = (xx, yy) => depth.data[((oy + Math.min(size - 1, Math.floor(yy))) * w + ox + Math.min(size - 1, Math.floor(xx))) * 4]; // prettier-ignore
      const q = [
        [x + h / 2, y + h / 2],
        [x + h * 1.5, y + h / 2],
        [x + h / 2, y + h * 1.5],
        [x + h * 1.5, y + h * 1.5],
      ];
      const inside = q.map(([xx, yy]) => at(xx, yy));
      const n = inside.filter(Boolean).length;
      if (n === 0 || n === 4) continue;
      q.forEach(([xx, yy], k) => {
        const g = inside[k];
        if (!g) return;
        const i = (oy + Math.floor(yy)) * w + ox + Math.floor(xx);
        out.push({ u: xx / size, v: yy / size, d: (g - 1) / 254, c: [color.data[i * 4] / 255, color.data[i * 4 + 1] / 255, color.data[i * 4 + 2] / 255], i, fine: true }); // prettier-ignore
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
  const k = PICTURED.indexOf(z);
  return [(k % ATLAS_COLS) * ATLAS_CELL, Math.floor(k / ATLAS_COLS) * ATLAS_CELL];
};

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
  density: 2,
  // Polish (labs only): the Lab lane's sharper splat falloff, the low cull so the tiles' fine
  // splats and lettering reach a phone's screen, and room to pinch in on a tile.
  kernel: "sharp",
  // (dpr: the phone tier draws at its screen's own pixel ratio, not 1.5: the table's detail is fine
  // enough to need it; the owner's "a little bit sharper overall".)
  render: { cull: "low", dpr: "native" },
  closeUp: { minDistance: 0.12 },
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
    { key: "spin", label: "Turn it around", type: "pulse", ease: 6 },
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
    ...PICTURED.filter((z) => pictureOf(z).src === "commons").map((z) => ({
      label: `${ELEMENTS[z - 1].name} ${STANDINS[z] ? "(stand-in picture)" : "sample"}`,
      title: pictureOf(z).file,
      source: pictureOf(z).page,
      author: pictureOf(z).author,
      license: pictureOf(z).license,
      licenseUrl: LICENSE_URL[pictureOf(z).license],
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
    await Promise.all([loadAtlas(), pictureOf(e.z) ? loadDetail(e.z) : null]);
  },
  drive(t, c, out, info) {
    const D = info.data;
    if (!D) return;
    const m = mem(c);
    const u = c.up ?? 0;
    // Up: the sample rises out of its tile and grows as it comes forward; down: the reverse.
    const rise = ease5(band(u, 0, 0.8));
    const vis = rise > 0.004 ? 1 : 0;
    const sc = D.homeScale + (1 - D.homeScale) * rise;
    // It comes straight out of its tile first, then glides over to its place (an arc toward the
    // viewer, never through the neighboring tiles).
    const glide = ease5(band(u, 0.12, 0.8));
    const out1 = Math.sin(Math.PI * Math.min(1, u / 0.8)) * 0.9;
    const off = D.home.map((h, i) => (h - LIFT_AT[i]) * (1 - (i === 2 ? rise : glide)) + (i === 2 ? out1 * (1 - rise) * 2 : 0)); // prettier-ignore
    // Once up, it swings slowly to show its relief; a tap turns it once around.
    if (u > 0.98 && m.swing0 === undefined) m.swing0 = t;
    if (u < 0.98) m.swing0 = undefined;
    const sw = m.swing0 === undefined ? 0 : t - m.swing0;
    let swing = 0.62 * Math.sin(0.55 * sw) * ease(Math.min(1, sw / 3));
    // During a turn the swing settles out (so the side views hold still), and starts again after.
    if (c.spin > 0) {
      if (m.spinFrom === undefined) m.spinFrom = swing;
      swing = m.spinFrom * (1 - ease(Math.min(1, (1 - c.spin) / 0.12)));
      if (m.swing0 !== undefined) m.swing0 = t;
    } else m.spinFrom = undefined;
    // The turn shows the sides: a quarter turn, a pause on the side, on round to the other side,
    // a pause, and home.
    const sp = c.spin > 0 ? turnPath(1 - c.spin) : 0;
    const yaw = swing + TAU * sp + 2 * rise * (1 - rise);
    const tilt = -0.18 * rise;
    const q = quatMul(quatAxisAngle([0, 1, 0], yaw), quatAxisAngle([1, 0, 0], tilt));
    // (globalThis.__relHideLift: the side-view check draws the same frame without the sample.)
    const hide = typeof globalThis !== "undefined" && globalThis.__relHideLift ? 0 : 1;
    out.parts.lift = { offset: off, scale: sc, visible: vis * hide, quat: q };
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
    // Lettering: one splat per font pixel (the sharp kernel keeps the strokes crisp; smaller,
    // finer splats vanish in the 256 px shelf picture, which draws without the labs' low cull).
    const inkPx = (list, cells, z, col, px) => {
      for (const [x, y] of cells) list.push(splat([x, y, z], col, px * 0.62, { flat: 0.2 }));
    };
    let used = 0;
    const cloud = (list, opts = {}) => {
      used += list.length;
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
      // The rim: a close row of small splats along each edge, so the sharp kernel draws a clean line
      // (polish: bigger rim splats spaced a whole step apart read as a row of dots).
      for (let y = y0 + step / 2; y < y1; y += step)
        for (let x = x0 + step / 2; x < x1; x += step) list.push(splat([x, y, -0.06], hex(BOARD), step * 0.66)); // prettier-ignore
      const rs = step / 4;
      for (let x = x0; x <= x1; x += rs) for (const y of [y0, y1]) list.push(splat([x, y, -0.06], hex(BOARD), rs * 0.9)); // prettier-ignore
      for (let y = y0; y <= y1; y += rs) for (const x of [x0, x1]) list.push(splat([x, y, -0.06], hex(BOARD), rs * 0.9)); // prettier-ignore
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
      inkPx(ink, inkCells(el.symbol, tx - TILE / 2 + 0.07, ty + TILE / 2 - 0.15, px), 0.012, inkCol, px); // prettier-ignore
      const pn = 0.019;
      const num = String(el.z);
      inkPx(ink, inkCells(num, tx + TILE / 2 - 0.06 - (num.length * 6 - 1) * pn, ty + TILE / 2 - 0.12, pn), 0.012, inkCol, pn); // prettier-ignore
      if (!pictureOf(el.z)) {
        const pb = 0.05;
        const dim = plain ? [0.36, 0.39, 0.45] : shadeArr(col, 0.7);
        inkPx(ink, inkCells(el.symbol, tx, ty + SAMPLE_DY, pb, true), 0.01, dim, pb);
      }
    }
    cloud(plates);
    cloud(ink);

    // The samples on the tiles: each its share of the budget, a relief over its tile.
    const tileList = [];
    const per = (N * 0.42) / PICTURED.length;
    for (const z of PICTURED) {
      const el = ELEMENTS[z - 1];
      const [tx, ty] = tilePos(z);
      const [ox, oy] = atlasSpot(z);
      const have = countPixels(atlas, ox, oy, ATLAS_CELL);
      // (At least every third pixel: finer splats vanish in the shelf picture.)
      const step = Math.max(3, Math.sqrt(have / per));
      const px = (SAMPLE_SIDE / ATLAS_CELL) * step;
      // (The finer outline only where the tile's share has room for it.)
      let picked = samplePixels(atlas, ox, oy, ATLAS_CELL, step, true);
      if (picked.length > per * 1.1) picked = samplePixels(atlas, ox, oy, ATLAS_CELL, step);
      for (const s of picked) {
        const x = tx + (s.u - 0.5) * SAMPLE_SIDE;
        const y = ty + SAMPLE_DY + (0.5 - s.v) * SAMPLE_SIDE;
        const zz = 0.015 + RELIEF * reliefOf(z) * SAMPLE_SIDE * s.d;
        tileList.push(splat([x, y, zz], s.c, px * (s.fine ? 0.5 : 0.85), { part: el === e ? home : 0, flat: 0.3 })); // prettier-ignore
      }
    }
    cloud(tileList);

    // The lifted sample, built at its lifted size and place; drive() shrinks it into its tile.
    const liftList = [];
    if (pictureOf(e.z)) {
      const pair = RE.ready.get(e.z);
      if (pair) {
        // (What the table leaves, up to 42 percent: at a small budget the tiles keep at least
        // every third pixel.)
        const share = Math.max(N * 0.12, Math.min(N * 0.42, N * 0.98 - used));
        for (const sp of solidSample(pair, share, lift, splat, reliefOf(e.z))) liftList.push(sp);
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

// The lifted sample as a solid body (the owner's notes of October 5 and 6, 2026: "it is hollow
// and has a hole in it when it's turned to the side", "still appears hollow from the sides"). A
// photo only sees the front, so the body is built like a pebble: front and back both swell from
// the outline inward (by the distance to the outline, rounded off over about a sixth of the
// sample's width), the front also carries the photo's own relief, and the two meet at the rim. Seen
// from the side, the photo's texture rolls over the edge into the back (a darker mirror of the
// front, since no photo saw it) instead of ending at a thin shell or a striped wall. Fillers close
// the steps between neighbors, and the splats are nearly round, so none turns edge-on into a gap.
export function solidSample(pair, share, part, splat, relief = 1) {
  const out = [];
  const size = pair.color.w;
  const { depth, color } = pair;
  // The body's shape on a grid with a cell for about every sixth of the share's splats (its
  // splats are spread over its surface separately, below, by area; the colors come from the
  // photo's own pixels).
  const have = countPixels(pair, 0, 0, size);
  const g = Math.max(1, Math.round(Math.sqrt(have / Math.max(1, share / 6))));
  // (A flat picture keeps a thin card's thickness.)
  const hz = RELIEF * LIFT_SIDE * Math.max(0.12, relief);
  const W = Math.ceil(size / g);
  const cell = new Int32Array(W * W).fill(-1);
  const cells = [];
  for (let gy = 0; gy < W; gy++)
    for (let gx = 0; gx < W; gx++) {
      const x = Math.min(size - 1, gx * g);
      const y = Math.min(size - 1, gy * g);
      const i = y * size + x;
      const v = depth.data[i * 4];
      if (!v) continue;
      cell[gy * W + gx] = cells.length;
      cells.push({
        gx,
        gy,
        i,
        d: (v - 1) / 254,
        x: LIFT_AT[0] + ((x + 0.5) / size - 0.5) * LIFT_SIDE,
        y: LIFT_AT[1] + (0.5 - (y + 0.5) / size) * LIFT_SIDE,
        c: [color.data[i * 4] / 255, color.data[i * 4 + 1] / 255, color.data[i * 4 + 2] / 255],
      });
    }
  // Spikes and bridges one cell wide make no faces, so no walls, and showed pinholes onto the
  // inside: cells with fewer than three of their eight neighbors go, twice over.
  for (let pass = 0; pass < 2; pass++) {
    const drop = [];
    for (const p of cells) {
      let k = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const [x, y] = [p.gx + dx, p.gy + dy];
          if (x >= 0 && y >= 0 && x < W && y < W && cell[y * W + x] >= 0) k++;
        }
      if (k < 3) drop.push(p);
    }
    for (const p of drop) cell[p.gy * W + p.gx] = -1;
    if (!drop.length) break;
  }
  for (let i = cells.length - 1; i >= 0; i--)
    if (cell[cells[i].gy * W + cells[i].gx] < 0) cells.splice(i, 1);
  cells.forEach((p, i) => (cell[p.gy * W + p.gx] = i));
  // Each cell's distance to the outline (in cells; a chamfer transform, two passes).
  const BIG = 1e9;
  const dist = new Float32Array(W * W).fill(0);
  for (let i = 0; i < W * W; i++) dist[i] = cell[i] >= 0 ? BIG : 0;
  const relax = (i, j, w) => {
    if (dist[j] + w < dist[i]) dist[i] = dist[j] + w;
  };
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!dist[i]) continue;
      if (x === 0 || y === 0) dist[i] = Math.min(dist[i], 1);
      if (x > 0) relax(i, i - 1, 1);
      if (y > 0) relax(i, i - W, 1);
      if (x > 0 && y > 0) relax(i, i - W - 1, 1.414);
      if (x < W - 1 && y > 0) relax(i, i - W + 1, 1.414);
    }
  for (let y = W - 1; y >= 0; y--)
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      if (!dist[i]) continue;
      if (x === W - 1 || y === W - 1) dist[i] = Math.min(dist[i], 1);
      if (x < W - 1) relax(i, i + 1, 1);
      if (y < W - 1) relax(i, i + W, 1);
      if (x < W - 1 && y < W - 1) relax(i, i + W + 1, 1.414);
      if (x > 0 && y < W - 1) relax(i, i + W - 1, 1.414);
    }
  // The photo's depth is mostly the slope of the ground it lies on (the top of the picture far,
  // the bottom near), which made a wedge that read as hollow from the side. Take the best-fit
  // plane off and keep what is left as the sample's own bumps.
  let [n, sx, sy, sd, sxx, syy, sxy, sxd, syd] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const p of cells) {
    n++;
    sx += p.gx;
    sy += p.gy;
    sd += p.d;
    sxx += p.gx * p.gx;
    syy += p.gy * p.gy;
    sxy += p.gx * p.gy;
    sxd += p.gx * p.d;
    syd += p.gy * p.d;
  }
  const plane = solve3(
    [
      [n, sx, sy],
      [sx, sxx, sxy],
      [sy, sxy, syy],
    ],
    [sd, sxd, syd],
  );
  let spread = 0;
  for (const p of cells) {
    p.r = p.d - (plane[0] + plane[1] * p.gx + plane[2] * p.gy);
    spread += p.r * p.r;
  }
  spread = Math.sqrt(spread / (n || 1)) || 1;
  // (A 3 x 3 mean over the bumps: some photos' depth comes in steps, whose sharp risers showed
  // gaps between the splats when seen from low down.)
  {
    const rs = cells.map((p) => {
      let [sum, k] = [0, 0];
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const [x, y] = [p.gx + dx, p.gy + dy];
          const j = x >= 0 && y >= 0 && x < W && y < W ? cell[y * W + x] : -1;
          if (j >= 0) [sum, k] = [sum + cells[j].r, k + 1];
        }
      return sum / k;
    });
    cells.forEach((p, i) => (p.r = rs[i]));
  }
  // The body: a rounded dome over the outline (an ellipse's profile from the rim in to most of
  // the way to the middle), front and back, so it reads as one solid pebble from every side; the
  // bumps ride on the front.
  let far = 1;
  for (const p of cells) far = Math.max(far, dist[p.gy * W + p.gx]);
  const R = Math.max(3, far * 0.75);
  // (The distance comes in chamfer steps, which showed as terraces on the side: two passes of a
  // 3 x 3 mean over the inside smooth it; the outline keeps its 1.)
  for (let pass = 0; pass < 2; pass++) {
    const next = dist.slice();
    for (const p of cells) {
      const i = p.gy * W + p.gx;
      if (dist[i] <= 1) continue;
      let sum = 0;
      let k = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const x = p.gx + dx;
          const y = p.gy + dy;
          if (x < 0 || y < 0 || x >= W || y >= W) continue;
          sum += Math.max(1, dist[y * W + x]);
          k++;
        }
      next[i] = Math.max(1.001, sum / k);
    }
    dist.set(next);
  }
  // The thickness: one dome over the whole outline (an ellipsoid fitted to the outline's spread),
  // so the body is convex through its depth. A thickness that followed each point's distance to
  // the outline made a lobed sample (copper's two lobes) thin at its waist, and from the side its
  // far lobe showed round the near one like a bowl's lip (the owner's "still not closed from some
  // angles"). Near the outline a short rounded bevel takes it down to just under half, and walls
  // join the front and back there (below).
  let [mx, my] = [0, 0];
  for (const p of cells) [mx, my] = [mx + p.gx / n, my + p.gy / n];
  let [cxx, cyy, cxy] = [0, 0, 0];
  for (const p of cells) {
    const [dx, dy] = [p.gx - mx, p.gy - my];
    [cxx, cyy, cxy] = [cxx + (dx * dx) / n, cyy + (dy * dy) / n, cxy + (dx * dy) / n];
  }
  const det = cxx * cyy - cxy * cxy || 1;
  const spreadOf = (p) => {
    const [dx, dy] = [p.gx - mx, p.gy - my];
    return (dx * dx * cyy - 2 * dx * dy * cxy + dy * dy * cxx) / det;
  };
  let qmax = 1e-9;
  for (const p of cells) qmax = Math.max(qmax, spreadOf(p));
  const Rb = Math.max(3, far * 0.4);
  for (const p of cells) {
    const d = dist[p.gy * W + p.gx];
    // (b: how far in from the rim, for the colors: the rim takes the colors from further in.)
    const t = Math.min(1, Math.max(0, d - 1) / R);
    p.b = Math.sqrt(1 - (1 - t) * (1 - t));
    const dome = Math.sqrt(1 - 0.8 * (spreadOf(p) / qmax));
    const tb = Math.min(1, Math.max(0, d - 1) / Rb);
    const thick = dome * (0.12 + 0.88 * Math.sqrt(1 - (1 - tb) * (1 - tb)));
    const bump = Math.max(-1, Math.min(1, p.r / (2.5 * spread)));
    p.zf = LIFT_AT[2] + hz * thick * (0.7 + 0.25 * bump);
    p.zb = LIFT_AT[2] - hz * 0.42 * thick;
  }
  const at = (gx, gy) => (gx < 0 || gy < 0 || gx >= W || gy >= W ? null : cells[cell[gy * W + gx]] ?? null); // prettier-ignore
  const mixC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; // prettier-ignore
  const BACK = 0.92;
  // The rolled rim and the side wall take the colors from further in. The photo's outline
  // pixels are dark (the cutout's edge, the shadow under the sample), and from the side a dark
  // wall inside a lit rim read as a hole (the owner's "hollow from the sides"). An area mean of
  // the inner cells' colors (a summed-area table over the grid) close round each cell, so the
  // photo's texture carries on over the rim and down the walls (a broad mean made a plain, light
  // frame round the photo, which read as the lip of a bowl).
  const sat = new Float64Array((W + 1) * (W + 1) * 4);
  for (let gy = 0; gy < W; gy++)
    for (let gx = 0; gx < W; gx++) {
      const p = at(gx, gy);
      const o = ((gy + 1) * (W + 1) + gx + 1) * 4;
      const inner = p && p.b > 0.6;
      for (let k = 0; k < 4; k++) {
        const v = inner ? (k < 3 ? p.c[k] : 1) : 0;
        sat[o + k] = v + sat[o - 4 + k] + sat[o - (W + 1) * 4 + k] - sat[o - (W + 2) * 4 + k];
      }
    }
  const innerColor = (p) => {
    for (let r = Math.max(2, Math.round(far * 0.08)); ; r *= 2) {
      const [ax, ay] = [Math.max(0, p.gx - r), Math.max(0, p.gy - r)];
      const [bx, by] = [Math.min(W, p.gx + r + 1), Math.min(W, p.gy + r + 1)];
      const sum = (k) =>
        sat[(by * (W + 1) + bx) * 4 + k] -
        sat[(ay * (W + 1) + bx) * 4 + k] -
        sat[(by * (W + 1) + ax) * 4 + k] +
        sat[(ay * (W + 1) + ax) * 4 + k];
      const nIn = sum(3);
      // (Clamped: the table's sums leave round-off a hair below zero.)
      const v = (k) => Math.min(1, Math.max(0, sum(k) / nIn));
      if (nIn >= 4) return [v(0), v(1), v(2)];
      if (r > W) return p.c;
    }
  };
  for (const p of cells) p.inner = innerColor(p);

  // The surface: front and back as two meshes over the grid that share the outline (the
  // outermost cells sit on the seam), so together they close. The owner saw the earlier rim of
  // filler columns as streaks with gaps between them up close; now every part of the surface,
  // the steep side wall included, gets splats spread evenly over its own area, each a disc lying
  // in the surface.
  const quads = [];
  let area = 0;
  const P = (p, front) => [p.x, p.y, front ? p.zf : p.zb];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; // prettier-ignore
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  for (let gy = 0; gy < W - 1; gy++)
    for (let gx = 0; gx < W - 1; gx++) {
      // Corners in order round the quad; a missing corner makes a triangle (the outline's steps).
      const q = [at(gx, gy), at(gx + 1, gy), at(gx + 1, gy + 1), at(gx, gy + 1)];
      const n = q.filter(Boolean).length;
      if (n < 3) continue;
      for (const front of [true, false]) {
        const v = q.map((c) => c && P(c, front));
        if (n === 4)
          area += (len(cross(sub(v[1], v[0]), sub(v[3], v[0]))) + len(cross(sub(v[1], v[2]), sub(v[3], v[2])))) / 2; // prettier-ignore
        else {
          const k = q.findIndex((c) => !c);
          const [a, b, c] = [v[(k + 1) % 4], v[(k + 2) % 4], v[(k + 3) % 4]];
          area += len(cross(sub(a, b), sub(c, b))) / 2;
        }
        quads.push({ gx, gy, q, n, front });
      }
    }
  // The walls: every edge of the front mesh that only one of its cells uses lies on the outline;
  // a wall there runs from the front down to the back, facing out.
  const edges = new Map();
  for (const { q, front } of quads) {
    if (!front) continue;
    const ring = q.filter(Boolean);
    const fx = ring.reduce((a, c) => a + c.x, 0) / ring.length;
    const fy = ring.reduce((a, c) => a + c.y, 0) / ring.length;
    for (let k = 0; k < ring.length; k++) {
      const [a, b2] = [ring[k], ring[(k + 1) % ring.length]];
      const key = a.gx * 1e6 + a.gy * 1e3 < b2.gx * 1e6 + b2.gy * 1e3 ? `${a.gx},${a.gy},${b2.gx},${b2.gy}` : `${b2.gx},${b2.gy},${a.gx},${a.gy}`; // prettier-ignore
      const e = edges.get(key);
      if (e) e.n++;
      else edges.set(key, { a, b: b2, fx, fy, n: 1 });
    }
  }
  const walls = [];
  for (const e of edges.values()) {
    if (e.n !== 1) continue;
    const [A, B, C, D] = [P(e.a, true), P(e.b, true), P(e.b, false), P(e.a, false)];
    // Outward: away from the cell the edge belongs to.
    const out2 = [(A[0] + B[0]) / 2 - e.fx, (A[1] + B[1]) / 2 - e.fy];
    walls.push({ e, v: [A, B, C, D], out2 });
    area += (len(cross(sub(B, A), sub(D, A))) + len(cross(sub(B, C), sub(D, C)))) / 2;
  }
  // The splats' spacing: as many as the share allows (each quad rounds its rows and columns up,
  // so the spacing is fitted to the count over a few passes), and a size that closes it.
  const countAt = (sp) => {
    let k = 0;
    for (const { q, n, front } of quads) {
      const v = q.map((c) => c && P(c, front));
      if (n === 4) {
        const ns = Math.max(
          1,
          Math.ceil(Math.max(len(sub(v[1], v[0])), len(sub(v[2], v[3]))) / sp),
        );
        const nt = Math.max(
          1,
          Math.ceil(Math.max(len(sub(v[3], v[0])), len(sub(v[2], v[1]))) / sp),
        );
        k += ns * nt;
      } else k += 3;
    }
    for (const { v } of walls) {
      const ns = Math.max(1, Math.ceil(Math.max(len(sub(v[1], v[0])), len(sub(v[2], v[3]))) / sp));
      const nt = Math.max(1, Math.ceil(Math.max(len(sub(v[3], v[0])), len(sub(v[2], v[1]))) / sp));
      k += ns * (nt + 1);
    }
    return k;
  };
  let s = Math.sqrt(area / Math.max(1, share));
  for (let i = 0; i < 4; i++) s *= Math.sqrt(Math.max(0.5, countAt(s) / Math.max(1, share)));
  // Light baked on the body's own shape: from straight up only, so faces looking out sideways keep
  // the photo's own light, the tops are brighter and the undersides darker, the cue the eye reads
  // as a solid lit from above. The turn is about the up axis, so it holds at every turn. (Any
  // light from the front turned with the sample, and once the sample was side-on it lit the rim
  // brighter than the face it framed, which read as the lip of a bowl.)
  const shadeOf = (nn) => Math.min(1.3, Math.max(0.65, 1 + 0.32 * nn[1]));
  const smooth = (t) => t * t * (3 - 2 * t);
  const pixel = (u, v) => {
    const x = Math.min(size - 1, Math.max(0, Math.round(u * g)));
    const y = Math.min(size - 1, Math.max(0, Math.round(v * g)));
    const i = y * size + x;
    return depth.data[i * 4] ? [color.data[i * 4] / 255, color.data[i * 4 + 1] / 255, color.data[i * 4 + 2] / 255] : null; // prettier-ignore
  };
  const emit = (pos, nrm, front, b, inner, cFall, gu, gv) => {
    const nl = len(nrm) || 1;
    // (Outward: the grid's x runs right and its rows run down, so the front's normal is the
    // negative of the cross product.)
    const sg = front ? -1 : 1;
    const nn = [(sg * nrm[0]) / nl, (sg * nrm[1]) / nl, (sg * nrm[2]) / nl];
    const cImg = pixel(gu, gv) || cFall;
    const t = smooth(Math.min(1, Math.max(0, (b - 0.5) / 0.48)));
    const base = b > 0.95 ? cImg : mixC(inner, cImg, t);
    // The back (which no photo shows) carries the photo's texture too, mirrored, a little darker
    // and softer, so it reads as the same stone.
    const c = front ? base : mixC(inner, base, 0.6);
    out.push(splat(pos, shadeArr(c, shadeOf(nn) * (front ? 1 : BACK)), s, { part, n: nn, flat: 0.75 })); // prettier-ignore
  };
  const bil = (a, b, c, d, u, v) => (k) =>
    (a[k] * (1 - u) + b[k] * u) * (1 - v) + (d[k] * (1 - u) + c[k] * u) * v;
  for (const { gx, gy, q, n, front } of quads) {
    const v = q.map((c) => c && P(c, front));
    if (n === 4) {
      const [A, B, C, D] = v;
      const ns = Math.max(1, Math.ceil(Math.max(len(sub(B, A)), len(sub(C, D))) / s));
      const nt = Math.max(1, Math.ceil(Math.max(len(sub(D, A)), len(sub(C, B))) / s));
      for (let i = 0; i < ns; i++)
        for (let j = 0; j < nt; j++) {
          const u = (i + 0.5) / ns;
          const w = (j + 0.5) / nt;
          const f = bil(A, B, C, D, u, w);
          // Tangents of the bilinear patch at (u, w).
          const tu = [0, 1, 2].map((k) => (B[k] - A[k]) * (1 - w) + (C[k] - D[k]) * w);
          const tv = [0, 1, 2].map((k) => (D[k] - A[k]) * (1 - u) + (C[k] - B[k]) * u);
          const bq = [q[0].b, q[1].b, q[2].b, q[3].b];
          const b = (bq[0] * (1 - u) + bq[1] * u) * (1 - w) + (bq[3] * (1 - u) + bq[2] * u) * w;
          const inner = [0, 1, 2].map((k) => (q[0].inner[k] * (1 - u) + q[1].inner[k] * u) * (1 - w) + (q[3].inner[k] * (1 - u) + q[2].inner[k] * u) * w); // prettier-ignore
          const cFall = [0, 1, 2].map((k) => (q[0].c[k] * (1 - u) + q[1].c[k] * u) * (1 - w) + (q[3].c[k] * (1 - u) + q[2].c[k] * u) * w); // prettier-ignore
          emit([f(0), f(1), f(2)], cross(tu, tv), front, b, inner, cFall, gx + u, gy + w);
        }
    } else {
      // A triangle: its corner opposite the missing one is the right angle on the grid.
      const k = q.findIndex((c) => !c);
      const [ia, ib, ic] = [(k + 1) % 4, (k + 2) % 4, (k + 3) % 4];
      const [a, b0, c0] = [q[ia], q[ib], q[ic]];
      const [Pa, Pb, Pc] = [v[ia], v[ib], v[ic]];
      // (Corner offsets on the grid, in the quad's order: (0,0), (1,0), (1,1), (0,1).)
      const OFF = [[0, 0], [1, 0], [1, 1], [0, 1]]; // prettier-ignore
      const e1 = sub(Pa, Pb);
      const e2 = sub(Pc, Pb);
      const n1 = Math.max(1, Math.ceil(len(e1) / s));
      const n2 = Math.max(1, Math.ceil(len(e2) / s));
      const nrm = cross(e1, e2);
      // (Keep the quads' winding: e1 x e2 from the right-angle corner turns one way or the
      // other depending on which corner is missing.)
      const ref = cross(sub([OFF[ia][0], -OFF[ia][1], 0], [OFF[ib][0], -OFF[ib][1], 0]), sub([OFF[ic][0], -OFF[ic][1], 0], [OFF[ib][0], -OFF[ib][1], 0])); // prettier-ignore
      const flip = ref[2] > 0 ? -1 : 1;
      const nn = [nrm[0] * flip, nrm[1] * flip, nrm[2] * flip];
      // (Its edges included: the long edge is the outline's diagonal step, with a wall on it.)
      for (let i = 0; i <= n1; i++)
        for (let j = 0; j <= n2; j++) {
          const u = i / n1;
          const w = j / n2;
          if (u + w > 1 + 1e-9) continue;
          const mix3 = (x, y, z) => x * (1 - u - w) + y * u + z * w;
          const pos = [0, 1, 2].map((t) => mix3(Pb[t], Pa[t], Pc[t]));
          const bb = mix3(b0.b, a.b, c0.b);
          const inner = [0, 1, 2].map((t) => mix3(b0.inner[t], a.inner[t], c0.inner[t]));
          const cFall = [0, 1, 2].map((t) => mix3(b0.c[t], a.c[t], c0.c[t]));
          const gu = gx + mix3(OFF[ib][0], OFF[ia][0], OFF[ic][0]);
          const gv = gy + mix3(OFF[ib][1], OFF[ia][1], OFF[ic][1]);
          emit(pos, nn, front, bb, inner, cFall, gu, gv);
        }
    }
  }
  for (const { e, v, out2 } of walls) {
    const [A, B, C, D] = v;
    const ns = Math.max(1, Math.ceil(Math.max(len(sub(B, A)), len(sub(C, D))) / s));
    const nt = Math.max(1, Math.ceil(Math.max(len(sub(D, A)), len(sub(C, B))) / s));
    // (Rows on the wall's top and bottom edges too, so the folds where it meets the front and
    // back close.)
    for (let i = 0; i < ns; i++)
      for (let j = 0; j <= nt; j++) {
        const u = (i + 0.5) / ns;
        const w = j / nt;
        const f = bil(A, B, C, D, u, w);
        const tu = [0, 1, 2].map((k) => (B[k] - A[k]) * (1 - w) + (C[k] - D[k]) * w);
        const tv = [0, 1, 2].map((k) => (D[k] - A[k]) * (1 - u) + (C[k] - B[k]) * u);
        let nrm = cross(tu, tv);
        if (nrm[0] * out2[0] + nrm[1] * out2[1] < 0) nrm = [-nrm[0], -nrm[1], -nrm[2]];
        const nl = len(nrm) || 1;
        const nn = [nrm[0] / nl, nrm[1] / nl, nrm[2] / nl];
        // (The wall carries the photo's texture: each point reads the photo a little further in
        // the further it is down the wall, toward the middle of the sample.)
        const gu0 = e.a.gx + (e.b.gx - e.a.gx) * u;
        const gv0 = e.a.gy + (e.b.gy - e.a.gy) * u;
        const [dx, dy] = [mx - gu0, my - gv0];
        const dl = Math.hypot(dx, dy) || 1;
        const k = 2 + Math.min(1, Math.abs(w - 0.4)) * Math.max(3, far * 0.15);
        const inner = mixC(e.a.inner, e.b.inner, u);
        const cTex = pixel(gu0 + (dx / dl) * k, gv0 + (dy / dl) * k) || inner;
        const c = mixC(inner, cTex, 0.7);
        out.push(splat([f(0), f(1), f(2)], shadeArr(c, shadeOf(nn) * (1 - 0.08 * w)), s, { part, n: nn, flat: 0.75 })); // prettier-ignore
      }
  }
  return out;
}

// Solves a 3 x 3 linear system (Cramer's rule); zeros when it is singular.
function solve3(a, b) {
  const det = (m) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const d = det(a);
  if (Math.abs(d) < 1e-9) return [0, 0, 0];
  return [0, 1, 2].map((k) => det(a.map((row, i) => row.map((v, j) => (j === k ? b[i] : v)))) / d);
}

function shadeArr(c, f) {
  const v = (x) => Math.min(1, Math.max(0, x * f));
  return [v(c[0]), v(c[1]), v(c[2])];
}

export const RECIPES = {
  "real-elements": REAL_ELEMENTS,
};

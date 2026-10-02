// Chemistry pack (lane Chemistry): the periodic table. All 118 elements as
// tiles in the standard layout, colored by family; tap one and its atom
// rises out of the table and builds itself (its real protons, neutrons and
// electrons), and a tap on the atom makes one electron jump up a shell and
// fall back with a flash in the color of the element's strongest visible
// line. Loaded on demand.

import { mix, shade, quatFromTo, quatAxisAngle } from "../kit.js";
import { BITMAP } from "../font.js";
import { ELEMENT_LIST, elementOf, fillOrder, packNucleus } from "../chem/atom-model.js";

const TAU = Math.PI * 2;

// ---- Small helpers -------------------------------------------------------------------

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => mul(a, 1 / (len(a) || 1));
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => x * x * (3 - 2 * x);
const band = (x, a, b) => clamp01((x - a) / (b - a));
const bump = (x, a, b, c, d) => band(x, a, b) * (1 - band(x, c, d));
const progress = (v) => (v > 0 ? 1 - v : 1);
const MEM = new WeakMap();
// Sound C: a faint, soft tick as each proton and neutron packs into the
// nucleus (each fades in at its own point of channel 0, from the middle out;
// protons a little brighter). The ticks come in batches a moment ahead, each
// scheduled for its own moment (`at`, from how fast the atom is building), so
// they stay in sync at any frame rate (and one cue every 0.2 s or so, as the
// site spaces a toy's cues 60 ms apart). A big nucleus ticks every few
// nucleons (at most about 40 a second), more softly.
function nucleonTicks(D, m, u, down, time, out) {
  const list = D.nucleons;
  if (!list?.length) return;
  const A = list.length;
  const uOf = (i) => 0.1 + 0.4 * Math.min(1, (0.96 * i) / A + 0.02);
  if (down || m.tickT === undefined || u < m.tickLast - 1e-6) {
    // Lowering (or a fresh build): ticks start again from here.
    [m.tickU, m.tickT, m.tickLast] = [u, time, u];
    return;
  }
  const rate = (u - m.tickLast) / Math.max(1e-3, time - m.tickT);
  [m.tickT, m.tickLast] = [time, u];
  if (rate <= 0 || m.tickU - u > rate * 0.06 || m.tickU >= 0.5) return;
  const reach = Math.min(1, u + rate * 0.25);
  const every = Math.max(1, Math.ceil((rate * A * 0.4) / 40));
  const vol = 0.2 / Math.sqrt(every);
  const ticks = [];
  for (let i = 0; i < A; i += every) {
    const ui = uOf(i);
    if (ui <= m.tickU || ui > reach) continue;
    const f = (list[i] ? 3300 : 2700) * (0.94 + 0.12 * ((i * 0.618) % 1));
    ticks.push({ voice: "clack", f, decay: 0.6, bright: 0.25, vol, at: Math.max(0, (ui - u) / rate) }); // prettier-ignore
  }
  m.tickU = reach;
  if (ticks.length) out.cues.push(ticks);
}

function mem(c) {
  let m = MEM.get(c);
  if (!m) MEM.set(c, (m = {}));
  return m;
}

// Baked light (splats are unlit): a key light from the upper left front.
const LIGHT = unit([-0.4, 0.75, 0.55]);
const VIEW = unit([0.25, 0.2, 0.95]);
const HALF = unit(add(LIGHT, VIEW));
const lit = (col, n, amb = 0.66, k = 0.4) => shade(col, amb + k * Math.max(0, dot(n, LIGHT)));
const gloss = (col, n, amt = 0.45, pow = 18) =>
  mix(col, "#ffffff", amt * Math.pow(Math.max(0, dot(n, HALF)), pow));
const keep = (c, size) => (size ? { c, keep: true, size } : { c, keep: true });

// ---- Lettering ------------------------------------------------------------------------
// The site's 5 x 7 capitals and digits, plus the small letters element
// symbols need.

// prettier-ignore
const LOWER = {
  a: "00000 00000 01110 00001 01111 10001 01111",
  b: "10000 10000 10110 11001 10001 10001 11110",
  c: "00000 00000 01110 10000 10000 10001 01110",
  d: "00001 00001 01101 10011 10001 10001 01111",
  e: "00000 00000 01110 10001 11111 10000 01110",
  f: "00110 01001 01000 11100 01000 01000 01000",
  g: "00000 01111 10001 10001 01111 00001 01110",
  h: "10000 10000 10110 11001 10001 10001 10001",
  i: "00100 00000 01100 00100 00100 00100 01110",
  k: "10000 10000 10010 10100 11000 10100 10010",
  l: "01100 00100 00100 00100 00100 00100 01110",
  m: "00000 00000 11010 10101 10101 10001 10001",
  n: "00000 00000 10110 11001 10001 10001 10001",
  o: "00000 00000 01110 10001 10001 10001 01110",
  p: "00000 11110 10001 10001 11110 10000 10000",
  r: "00000 00000 10110 11001 10000 10000 10000",
  s: "00000 00000 01111 10000 01110 00001 11110",
  t: "01000 01000 11100 01000 01000 01001 00110",
  u: "00000 00000 10001 10001 10001 10011 01101",
  v: "00000 00000 10001 10001 10001 01010 00100",
  y: "00000 10001 10001 01111 00001 10001 01110",
};
const GLYPH = {
  ...BITMAP,
  ...Object.fromEntries(
    Object.entries(LOWER).map(([ch, rows]) => [ch, rows.split(" ").map((r) => parseInt(r, 2))]),
  ),
};
const textWidth = (str) => str.length * 6 - 1;

// The ink cells of a line of text centered on (x, y) in the plane z, one
// square of side px per font pixel.
function inkCells(str, x, y, z, px, out, tag = null) {
  const W = textWidth(str) * px;
  const x0 = x - W / 2;
  const y0 = y + 3.5 * px;
  for (let ci = 0; ci < str.length; ci++) {
    const g = GLYPH[str[ci]];
    if (!g) continue;
    for (let gy = 0; gy < 7; gy++)
      for (let gx = 0; gx < 5; gx++)
        if ((g[gy] >> (4 - gx)) & 1) out.push([x0 + (ci * 6 + gx) * px, y0 - gy * px, z, px, tag]);
  }
  return out;
}

// A shape made of ink cells (facing +Z), sampled evenly by area.
function inkShape(cells) {
  const cum = [];
  let area = 0;
  for (const c of cells) cum.push((area += c[3] * c[3]));
  const find = (a) => {
    let lo = 0;
    let hi = cells.length - 1;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (cum[m] < a) lo = m + 1;
      else hi = m;
    }
    return lo;
  };
  const at = (a, b) => {
    const target = a * area;
    const i = find(target);
    const [x, y, z, px, tag] = cells[i];
    const before = i ? cum[i - 1] : 0;
    const f = clamp01((target - before) / (px * px));
    return { p: [x + f * px, y - b * px, z], n: [0, 0, 1], px, tag };
  };
  return {
    area,
    thick: 0.01,
    sample: (rand) => at(rand(), rand()),
    sampleEven: (a, b) => at(a, b),
  };
}

// ---- The table's layout ---------------------------------------------------------------

// Where each element sits: [group 1..18, row]. Rows 1 to 7 are the periods;
// the lanthanoids and actinoids sit in two rows below, as usual.
function cellOf(z) {
  const starts = [1, 3, 11, 19, 37, 55, 87, 119];
  let period = 0;
  while (z >= starts[period + 1]) period++;
  const i = z - starts[period];
  const P = period + 1;
  if (P === 1) return [z === 1 ? 1 : 18, 1];
  if (P <= 3) return [i < 2 ? i + 1 : i + 11, P];
  if (P <= 5) return [i + 1, P];
  // Periods 6 and 7: two s-block elements, fifteen f-block (in their own
  // row), then groups 4 to 18.
  if (i < 2) return [i + 1, P];
  if (i < 17) return [i - 2 + 3, P + 2.45];
  return [i - 17 + 4, P];
}

const PITCH = 1;
const TILE = 0.9;
const DEPTH = 0.3;
const TOP_Y = 3.5;
const tilePos = (col, row) => [(col - 9.5) * PITCH, TOP_Y - (row - 1) * PITCH, 0];

// The rim of a tile, u = 0..1 round its four sides.
function rimPoint(u) {
  const h = TILE / 2;
  const s = (u * 4) % 4;
  const i = Math.floor(s);
  const f = s - i;
  return [
    [h, -h + f * TILE],
    [h - f * TILE, h],
    [-h, h - f * TILE],
    [-h + f * TILE, -h],
  ][i];
}
const rimNormal = (u) =>
  [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ][Math.floor((u * 4) % 4)];

// Family colors: clean pastels, each easy to tell apart.
const FAMILY = {
  alkali: { color: "#ff8f6b", label: "Alkali metals" },
  alkaline: { color: "#ffc766", label: "Alkaline earth metals" },
  transition: { color: "#8fb8ff", label: "Transition metals" },
  post: { color: "#9fd6cf", label: "Post-transition metals" },
  metalloid: { color: "#c4df7a", label: "Metalloids" },
  nonmetal: { color: "#76e3a5", label: "Nonmetals" },
  halogen: { color: "#f5e36e", label: "Halogens" },
  noble: { color: "#c9a8ff", label: "Noble gases" },
  lanthanide: { color: "#ffaad6", label: "Lanthanoids" },
  actinide: { color: "#f0a0f5", label: "Actinoids" },
};
const INK = "#171b26";
// A text splat's size per unit of font pixel, against the kit's base size
// (about 0.05 recipe units here).
const INK_SIZE = 5;
const BOARD = "#232a38";

// Every tile's place: the elements, and the two markers in group 3 that
// point to the lanthanoid and actinoid rows.
const TILES = [
  ...ELEMENT_LIST.map((e) => {
    const [col, row] = cellOf(e.z);
    return { el: e, col, row, pos: tilePos(col, row), family: e.family };
  }),
  { marker: "57-71", col: 3, row: 6, pos: tilePos(3, 6), family: "lanthanide" },
  { marker: "89-103", col: 3, row: 7, pos: tilePos(3, 7), family: "actinide" },
];
const TILE_OF = new Map(TILES.filter((t) => t.el).map((t) => [t.el.symbol, t]));

// The table's bounds and the place the atom rises to: out of the gap above
// the transition metals, well toward the viewer. The atom is left out of
// the fit (its pieces have fit: false) and stays inside the table's own
// frame, so the table is framed the same, whichever atom it holds.
const BOARD_LO = [-8.5 * PITCH - 0.55, tilePos(1, 9.45)[1] - 0.6, -0.12];
const BOARD_HI = [8.5 * PITCH + 0.55, TOP_Y + 0.6, 0];
const ATOM_AT = [-1.8, 1.9, 4.2];

// ---- The atom ------------------------------------------------------------------------------

// Each shell's ring: its tilt and how fast it turns.
const SHELL_TILT = [
  [0.95, 0.35],
  [1.25, 2.3],
  [0.8, 4.1],
  [1.35, 5.5],
  [1.05, 1.2],
  [0.7, 3.2],
  [1.2, 0.2],
];
const shellNormal = (i) => {
  const [a, b] = SHELL_TILT[i % SHELL_TILT.length];
  return [Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b)];
};
const shellSpeed = (i) => (i % 2 ? -1 : 1) * (1.2 / Math.pow(i + 1, 0.7));
function basis(d) {
  const a = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const e1 = unit(cross(d, a));
  return [e1, cross(d, e1)];
}

const NUCLEON_R = 0.17;
const ELECTRON_R = 0.095;
const PROTON = "#e8483f";
const NEUTRON = "#aab4c4";
const ELECTRON = "#36c9ff";
// The direction the photon flies out: toward the viewer, to the right.
const PHOTON_DIR = unit([0.62, 0.3, 0.72]);

// The atom's layout for an element: its nucleus, the radius of each shell,
// and every electron's shell, slot and place in the filling order.
export function atomLayout(el) {
  const nucleus = packNucleus(el.A, el.z, NUCLEON_R);
  const nShells = el.shells.length;
  const r1 = nucleus.radius + 0.55;
  const rOut = Math.max(r1, 1.8 + 0.34 * (nShells - 1) + 0.5 * nucleus.radius);
  const shellR = el.shells.map((_, i) => (nShells > 1 ? r1 + ((rOut - r1) * i) / (nShells - 1) : r1)); // prettier-ignore
  const order = fillOrder(el);
  const seen = el.shells.map(() => 0);
  const electrons = order.map((shell, j) => ({ shell, slot: seen[shell]++, order: j }));
  // The electron that jumps: the last to arrive in the outermost shell.
  const outer = nShells - 1;
  const jumper = electrons.filter((e) => e.shell === outer).pop();
  const step = nShells > 1 ? (rOut - r1) / (nShells - 1) : 0.45;
  const rHigh = rOut + Math.max(0.45, Math.min(0.6, step));
  // Small atoms are shown bigger when risen (their part's scale), so every
  // atom reads at phone size; the biggest stay as built.
  const show = Math.min(1.7, Math.max(1, 4.2 / rHigh));
  return { nucleus, shellR, electrons, jumper, rHigh, show };
}

// The share of the budget each piece of the atom gets: whole splat counts
// that always add up to the same total, so the table itself is built
// exactly the same for every element.
const ATOM_SHARE = 0.25;
function atomCounts(N, layout) {
  const total = Math.round(ATOM_SHARE * N);
  const A = layout.nucleus.balls.length;
  const Z = layout.electrons.length;
  const nShells = layout.shellR.length;
  const ball = Math.max(1, Math.min(Math.round(0.0045 * N), Math.floor((0.13 * N) / A)));
  const electron = Math.max(1, Math.min(Math.round(0.0012 * N), Math.floor((0.035 * N) / Z)));
  const ring = Math.round(0.009 * N);
  const ghost = Math.round(0.004 * N);
  const photon = Math.round(0.004 * N);
  const used = ball * A + electron * Z + ring * nShells + ghost + photon;
  return { ball, electron, ring, ghost, photon, flash: Math.max(16, total - used) };
}

// Whichever element the table showed last, for the tap (action.at has no
// build data).
const SHOWN = { symbol: "C" };

// The tour (lane Fix6): a tap on the board's background walks through the
// elements, each atom rising for about two seconds with its tile lit. It
// lives here, outside the toy, because each element is its own build.
const TOUR = { on: false, mode: "number", order: [], i: 0, symbol: null, at: null, from: 0 };
const TOUR_BUILD = 1.6; // seconds for an atom to rise and fill
const TOUR_HOLD = 2.2; // seconds before the next element
function tourOrder(mode) {
  const order = ELEMENT_LIST.map((e) => e.symbol);
  if (mode !== "shuffle") return order;
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
function tourStart() {
  TOUR.order = tourOrder(TOUR.mode);
  Object.assign(TOUR, { on: true, i: 0, symbol: TOUR.order[0], at: null });
}

export const RECIPES = {
  "periodic-table": {
    alive: true,
    turntable: false,
    density: 1.7,
    options: [
      {
        key: "element",
        label: "Element",
        type: "select",
        default: "C",
        choices: ELEMENT_LIST.map((e) => ({ id: e.symbol, label: `${e.z} ${e.name}` })),
      },
      {
        key: "tour",
        label: "Tour order",
        type: "select",
        default: "number",
        choices: [
          { id: "number", label: "By atomic number" },
          { id: "shuffle", label: "Shuffled" },
        ],
      },
    ],
    controls: [
      { key: "up", label: "Build the atom", type: "toggle", default: 0, ease: 5 },
      { key: "shine", label: "Excite an electron", type: "pulse", ease: 3.2 },
      { key: "walk", label: "Tour", type: "pulse", ease: 0.3 },
    ],
    action: {
      key: "up",
      label: "Raise or lower the atom",
      // The electron's jump makes its own sound (cues from drive).
      quiet: ["shine"],
      // A tile raises its element's atom (switching the table to it), and
      // the shown element's own tile raises or lowers it; a tap on the risen
      // atom excites an electron; the board's background starts the tour.
      // Any tap during the tour stops it.
      at(p, c) {
        if (TOUR.on) {
          TOUR.on = false;
          return "walk";
        }
        const up = (c.up ?? 0) > 0.35;
        const el = elementOf(SHOWN.symbol);
        const L = el && atomLayout(el);
        if (up && L && len(sub(p, ATOM_AT)) < L.rHigh * L.show + 0.3 && p[2] > 1) return "shine";
        // (The shown tile stands 0.28 forward while its atom is up.)
        if (p[2] < DEPTH + 0.4) {
          const tile = TILES.find(
            (t) => Math.abs(p[0] - t.pos[0]) <= PITCH / 2 && Math.abs(p[1] - t.pos[1]) <= PITCH / 2,
          );
          if (tile?.el && tile.el.symbol !== SHOWN.symbol)
            return { options: { element: tile.el.symbol }, key: "up" };
          if (tile?.el) return "up";
        }
        // The board's background (not a tile, not the atom): the tour.
        if (p[2] < DEPTH + 0.4) {
          tourStart();
          return "walk";
        }
        return "up";
      },
    },
    credits: [
      {
        label: "Element data",
        title:
          "Atomic Weights and Isotopic Compositions; Atomic Spectra Database ground levels; Handbook of Basic Atomic Spectroscopic Data (strong lines)",
        source: "https://www.nist.gov/pml/productsservices/physical-reference-data",
        author: "NIST Physical Measurement Laboratory",
        license: "Public domain (U.S. government data)",
        licenseUrl:
          "https://www.nist.gov/open/copyright-fair-use-and-licensing-statements-srd-data-software-and-technical-series-publications",
      },
      {
        label: "Element families and the newest elements",
        title: "PubChem Periodic Table of Elements; IUPAC Periodic Table of the Elements (2022)",
        source: "https://pubchem.ncbi.nlm.nih.gov/periodic-table/",
        author: "NCBI PubChem; IUPAC",
        license: "Public domain (facts)",
        licenseUrl: "https://www.ncbi.nlm.nih.gov/home/about/policies/",
      },
    ],
    // Points for the clip tool and the tests: an element's tile, the atom.
    tileAt: (symbol) => {
      const t = TILE_OF.get(symbol);
      return t ? [t.pos[0], t.pos[1], DEPTH] : null;
    },
    atomAt: () => add(ATOM_AT, [0, 0, 0.3]),
    drive(t, c, out, info) {
      const D = info.data;
      if (!D) return;
      const m = mem(c);
      // The toggle's way: up builds the atom as it rises; down shrinks it
      // back into its tile over the first part of the way.
      const raw = c.up ?? 0;
      if (m.last === undefined) m.last = raw;
      // Lowering the atom (the Toy tab's button, or a tap beside the toy)
      // stops the tour too.
      if (TOUR.on && raw < m.last - 1e-6) TOUR.on = false;
      if (raw > m.last + 1e-6) {
        if (m.dir === -1) m.floor = 0;
        m.dir = 1;
      } else if (raw < m.last - 1e-6) {
        // Lowered after a tour: from where the tour left it, all the way down.
        if (m.dir !== -1 && m.floor) m.scale = m.floor / Math.max(1e-3, m.last);
        m.dir = -1;
      }
      m.last = raw;
      let u = raw;
      if (m.floor) u = m.dir === -1 ? Math.min(1, raw * (m.scale || 1)) : Math.max(raw, m.floor);
      // The tour: the shown element's atom rises faster, holds, and then
      // the table moves on to the next element (out.next, a rebuild).
      // (By this build's own element: while the next one builds, SHOWN
      // already names it, and this toy is still the one on screen.)
      const touring = TOUR.on && TOUR.symbol === D.element;
      if (TOUR.on && !touring && !m.asked) {
        m.asked = true;
        out.next = { options: { element: TOUR.symbol }, key: "up" };
      }
      if (touring) {
        if (TOUR.at === null) [TOUR.at, TOUR.from] = [t, m.dir === -1 ? 0 : u];
        u = Math.max(TOUR.from, clamp01((t - TOUR.at) / TOUR_BUILD));
        m.dir = 1;
        m.floor = u;
        m.scale = 0;
        if (t - TOUR.at > TOUR_HOLD) {
          TOUR.i++;
          if (TOUR.i >= TOUR.order.length) TOUR.on = false;
          else [TOUR.symbol, TOUR.at] = [TOUR.order[TOUR.i], null];
        }
      }
      let rise;
      let nuc;
      let ele;
      if (m.dir === -1) {
        rise = ease(band(u, 0.5, 1));
        nuc = 1;
        ele = 1;
      } else {
        rise = ease(band(u, 0, 0.26));
        nuc = band(u, 0.1, 0.5);
        ele = band(u, 0.5, 0.97);
      }
      const vis = rise > 0.002 ? 1 : 0;
      const sc = (0.12 + 0.88 * rise) * (rise > 0 ? 1 + (D.show - 1) * rise : 1);
      const off = mul(D.home, 1 - rise);
      out.morph = [nuc, ele, 0, 0];
      nucleonTicks(D, m, u, m.dir === -1, info.time, out);
      const lift = [0, 0, 0.28 * (m.dir === -1 ? rise : ease(band(u, 0, 0.12)))];
      out.parts.tile = { offset: lift };
      // The tour lights the shown element's tile.
      out.parts.halo = { offset: lift, visible: touring ? 1 : 0 };
      out.parts.nucleus = {
        offset: off,
        scale: sc,
        visible: vis,
        quat: quatAxisAngle([0.2, 1, 0.1], 0.35 * Math.sin(t * 0.5)),
      };
      for (let i = 0; i < 7; i++) {
        const used = i < D.shells.length;
        out.parts[`shell${i}`] = { offset: off, scale: sc, visible: used ? vis : 0, angle: t * shellSpeed(i) }; // prettier-ignore
      }
      // A tap on the atom: its outermost electron jumps out to a higher
      // orbit (shown faintly), stays a moment, and falls back, giving off a
      // photon in the color of the element's strongest visible line.
      const p = progress(c.shine);
      const on = c.shine > 0 ? 1 : 0;
      const jump = on * ease(band(p, 0.03, 0.2)) * (1 - ease(band(p, 0.5, 0.6)));
      const grow = 1 + jump * (D.rHigh / D.rJump - 1);
      out.parts.jumper = {
        offset: off,
        scale: sc * grow,
        visible: vis / grow,
        angle: t * shellSpeed(D.jumpShell),
      };
      out.parts.ghost = {
        offset: off,
        scale: sc,
        visible: vis * on * 0.9 * bump(p, 0.02, 0.12, 0.55, 0.68),
        angle: t * shellSpeed(D.jumpShell) * 0.3,
      };
      out.parts.flash = {
        offset: off,
        scale: sc * (0.75 + 0.45 * band(p, 0.5, 0.85)),
        visible: vis * on * 1.3 * bump(p, 0.5, 0.54, 0.62, 0.9),
      };
      const fly = band(p, 0.52, 0.97);
      out.parts.photon = {
        offset: add(off, mul(PHOTON_DIR, sc * (-2.2 + 5.5 * fly))),
        scale: sc,
        visible: vis * on * bump(p, 0.52, 0.55, 0.86, 0.97),
      };
      // Sounds that follow the effect: a note as each shell starts to fill,
      // then the electron's jump and the photon's ping.
      const before = m.ele ?? 0;
      if (m.dir !== -1)
        D.shellStarts.forEach((at, i) => {
          if (before < at && ele >= at)
            out.cues.push({ voice: "tine", f: SHELL_NOTES[i], decay: 0.5, vol: 0.45 });
        });
      m.ele = ele;
      if (on) {
        const prev = m.p !== undefined && m.p <= p ? m.p : 0;
        if (prev < 0.03 && p >= 0.03) out.cues.push({ voice: "blip", f: 660, to: 2, decay: 0.5, vol: 0.5 }); // prettier-ignore
        if (prev < 0.5 && p >= 0.5) out.cues.push(D.ping);
      }
      m.p = on ? p : undefined;
    },
    build(k, o) {
      const el = elementOf(o.element) || elementOf("C");
      SHOWN.symbol = el.symbol;
      const mode = o.tour === "shuffle" ? "shuffle" : "number";
      if (TOUR.mode !== mode) {
        // The order changed during a tour: go on from here in the new order.
        TOUR.mode = mode;
        if (TOUR.on) {
          TOUR.order = tourOrder(mode);
          TOUR.i = Math.max(0, TOUR.order.indexOf(TOUR.symbol));
        }
      }
      const home = TILE_OF.get(el.symbol);
      const tile = k.part("tile");
      // Every element has the same parts in the same order (all seven
      // shells, used or not), so when the table switches elements the frame
      // that still shows the old build with the new one's motion moves each
      // piece as itself: nothing hidden flashes up.
      const L0 = atomLayout(el);
      k.part("nucleus", { pivot: ATOM_AT });
      for (let i = 0; i < 7; i++) k.part(`shell${i}`, { pivot: ATOM_AT, axis: shellNormal(i) });
      k.part("jumper", { pivot: ATOM_AT, axis: shellNormal(L0.jumper.shell) });
      k.part("ghost", { pivot: ATOM_AT, axis: shellNormal(L0.jumper.shell) });
      k.part("flash", { pivot: ATOM_AT });
      k.part("photon", { pivot: ATOM_AT });
      k.part("halo");
      // The board behind the tiles.
      const bc = mul(add(BOARD_LO, BOARD_HI), 0.5);
      const bs = sub(BOARD_HI, BOARD_LO);
      // (Its front and back are flat sheets placed evenly: a thin box's
      // big faces come out in streaks.)
      for (const [z, nz, w] of [
        [BOARD_HI[2], 1, 1.4],
        [BOARD_LO[2], -1, 0.5],
      ])
        k.add(
          k.param((u, v) => [BOARD_LO[0] + u * bs[0], BOARD_LO[1] + v * bs[1], z], {
            grid: 64,
            flip: nz < 0,
          }),
          {
            even: true,
            flat: 0.2,
            opacity: 1,
            jitter: 0.01,
            weight: w,
            color: (c) => keep(nz > 0 ? mix(BOARD, "#2e3647", c.v * 0.6) : shade(BOARD, 0.75)),
          },
        );
      // Its edges.
      for (const [px, py, sx, sy] of [
        [bc[0], BOARD_LO[1], bs[0], 0],
        [bc[0], BOARD_HI[1], bs[0], 0],
        [BOARD_LO[0], bc[1], 0, bs[1]],
        [BOARD_HI[0], bc[1], 0, bs[1]],
      ])
        k.add(k.box(sx || bs[2], sy || bs[2], bs[2]), {
          pos: [px, py, bc[2]],
          even: true,
          flat: 0.2,
          opacity: 1,
          jitter: 0.01,
          color: (c) => keep(lit(shade(BOARD, 0.85), c.n, 0.8, 0.3)),
        });
      // The tiles: a block in its family's color, a thin darker rim on the
      // face, the atomic number above the symbol.
      const cells = [];
      for (const t of TILES) {
        const col = FAMILY[t.family].color;
        const mine = t === home;
        // The face as a flat sheet placed evenly, and the four sides as a
        // band round it.
        k.add(
          k.param((u, v) => [t.pos[0] + (u - 0.5) * TILE, t.pos[1] + (v - 0.5) * TILE, DEPTH], {
            grid: 8,
          }),
          {
            even: true,
            flat: 0.2,
            opacity: 1,
            jitter: 0.004,
            weight: 1.3,
            size: 1.05,
            part: mine ? tile : undefined,
            color: (c) => {
              const edge = Math.min(0.5 - Math.abs(c.u - 0.5), 0.5 - Math.abs(c.v - 0.5)) * TILE;
              const face = mix(col, "#ffffff", 0.18 * c.v);
              return keep(edge < 0.03 ? shade(col, 0.8) : face);
            },
          },
        );
        // A backing of the same color just behind the face, so any thin
        // spot between its splats shows the tile, not the dark board.
        k.add(
          k.param((u, v) => [t.pos[0] + (u - 0.5) * TILE * 0.84, t.pos[1] + (v - 0.5) * TILE * 0.84, DEPTH - 0.03], { grid: 4 }), // prettier-ignore
          {
            even: true,
            flat: 0.2,
            opacity: 1,
            jitter: 0.004,
            weight: 0.35,
            size: 1.15,
            part: mine ? tile : undefined,
            color: (c) => keep(mix(col, "#ffffff", 0.18 * c.v)),
          },
        );
        k.add(
          k.param(
            (u, v) => {
              const [x, y] = rimPoint(u);
              return [t.pos[0] + x, t.pos[1] + y, v * DEPTH];
            },
            { grid: 16, normal: (u) => [...rimNormal(u), 0] },
          ),
          {
            even: true,
            flat: 0.2,
            opacity: 1,
            jitter: 0.008,
            part: mine ? tile : undefined,
            color: (c) => keep(lit(shade(col, 0.72), c.n, 0.75, 0.3)),
          },
        );
        const z = DEPTH + 0.05;
        if (t.el) {
          inkCells(String(t.el.z), t.pos[0], t.pos[1] + 0.24, z, 0.034, cells, t.el.symbol);
          inkCells(t.el.symbol, t.pos[0], t.pos[1] - 0.09, z, 0.056, cells, t.el.symbol);
        } else inkCells(t.marker, t.pos[0], t.pos[1], z, 0.026, cells);
      }
      // All the lettering is one shape, so it is placed the same whatever
      // the element; the chosen tile's letters ride on its part.
      k.add(inkShape(cells), {
        share: 0.27,
        even: true,
        flat: 0.15,
        opacity: 1,
        jitter: 0.004,
        part: (c) => (c.s.tag === el.symbol ? tile : 0),
        pattern: false,
        // Small splats, about a third of a font pixel, so the letters
        // keep sharp corners.
        color: (c) => keep(INK, c.s.px * INK_SIZE),
      });

      // ---- The atom, built risen (hidden until a tap) -----------------------------
      const L = atomLayout(el);
      const N = k.count;
      const n = atomCounts(N, L);
      const nucleus = k.part("nucleus", { pivot: ATOM_AT });
      const A = L.nucleus.balls.length;
      // Each nucleon its own solid ball, appearing one by one from the
      // middle out as the nucleus builds (channel 0).
      L.nucleus.balls.forEach((b, i) => {
        const proton = L.nucleus.proton[i];
        k.add(k.sphere(NUCLEON_R), {
          pos: add(ATOM_AT, b),
          share: n.ball / N,
          fit: false,
          even: true,
          flat: 0.3,
          opacity: 1,
          jitter: 0.006,
          part: nucleus,
          pattern: false,
          kind: "fade",
          params: [(0.96 * i) / A, -0.03],
          channel: 0,
          color: (c) => keep(gloss(lit(proton ? PROTON : NEUTRON, c.n, 0.6, 0.5), c.n, 0.5, 14)),
        });
      });
      // The shells: a ring each, the electrons on it arriving in the order
      // they fill (channel 1).
      const Z = L.electrons.length;
      const atOf = (e) => (0.95 * e.order) / Z;
      const shellStarts = L.shellR.map((_, i) => atOf(L.electrons.find((e) => e.shell === i)));
      const shells = L.shellR.map((R, i) => {
        const nrm = shellNormal(i);
        const part = k.part(`shell${i}`, { pivot: ATOM_AT, axis: nrm });
        k.add(k.torus(R, 0.018), {
          pos: ATOM_AT,
          quat: quatFromTo([0, 1, 0], nrm),
          share: n.ring / N,
          fit: false,
          size: 0.55,
          even: true,
          flat: 0.35,
          opacity: 0.9,
          part,
          pattern: false,
          kind: "fade",
          params: [shellStarts[i], -0.02],
          channel: 1,
          color: (c) => keep(lit(mix("#8fb4ff", "#c7d6ff", 0.5 + 0.5 * c.n[1]), c.n, 0.8, 0.3)),
        });
        return { part, nrm, R };
      });
      const jumpShell = L.jumper.shell;
      const jumper = k.part("jumper", { pivot: ATOM_AT, axis: shells[jumpShell].nrm });
      const counts = el.shells;
      for (const e of L.electrons) {
        const s = shells[e.shell];
        const [e1, e2] = basis(s.nrm);
        const a = (e.slot / counts[e.shell]) * TAU + e.shell * 0.7;
        const p = add(ATOM_AT, mul(add(mul(e1, Math.cos(a)), mul(e2, Math.sin(a))), s.R));
        k.add(k.sphere(ELECTRON_R), {
          pos: p,
          share: n.electron / N,
          fit: false,
          even: true,
          flat: 0.3,
          opacity: 1,
          part: e === L.jumper ? jumper : s.part,
          pattern: false,
          kind: "fade",
          params: [atOf(e), -0.02],
          channel: 1,
          color: (c) => keep(gloss(lit(ELECTRON, c.n, 0.8, 0.3), c.n, 0.7, 10)),
        });
      }
      // The higher orbit the electron jumps to, as a dashed ring.
      const js = shells[jumpShell];
      const [g1, g2] = basis(js.nrm);
      k.cloud(
        {
          share: n.ghost / N,
          size: 1.2,
          pattern: false,
          fit: false,
          part: k.part("ghost", { pivot: ATOM_AT, axis: js.nrm }),
        },
        (rand) => {
          // prettier-ignore
          let a = rand() * TAU;
          a = (Math.floor((a / TAU) * 64) + 0.25 + 0.5 * rand()) * (TAU / 64);
          return {
            p: add(ATOM_AT, mul(add(mul(g1, Math.cos(a)), mul(g2, Math.sin(a))), L.rHigh)),
            color: "#c9d8f5",
            opacity: 0.45,
            size: 0.8,
          };
        },
      );
      // The light it gives off: the line's color (white when no visible
      // line has been measured).
      const light = el.lineColor || "#eef2ff";
      const flashOpacity = Math.min(0.12, 180 / n.flash);
      k.cloud(
        {
          share: n.flash / N,
          size: 4,
          pattern: false,
          fit: false,
          part: k.part("flash", { pivot: ATOM_AT }),
        },
        (rand) => {
          // prettier-ignore
          const d = unit([rand() - 0.5, rand() - 0.5, rand() - 0.5]);
          const r = L.rHigh * 0.95 * Math.pow(rand(), 0.6);
          return {
            p: add(ATOM_AT, mul(d, r)),
            color: mix(light, "#ffffff", 0.25 * (1 - r / L.rHigh)),
            // As bright in all, however many splats the flash has.
            opacity: flashOpacity * (0.4 + 0.6 * (1 - r / L.rHigh)),
          };
        },
      );
      const [q1] = basis(PHOTON_DIR);
      const photonAt = add(ATOM_AT, mul(PHOTON_DIR, 2.2));
      k.cloud(
        {
          share: n.photon / N,
          size: 1.6,
          pattern: false,
          fit: false,
          part: k.part("photon", { pivot: ATOM_AT }),
        },
        (rand) => {
          // prettier-ignore
          const s = rand() * 2 - 1;
          const env = Math.exp(-s * s * 2.5);
          return {
            p: add(photonAt, add(mul(PHOTON_DIR, s * 0.9), mul(q1, 0.16 * env * Math.sin(s * 18)))),
            color: mix(light, "#ffffff", 0.3 * rand()),
            opacity: 0.35 + 0.6 * env,
          };
        },
      );
      k.data = {
        element: el.symbol,
        protons: L.nucleus.proton.filter(Boolean).length,
        neutrons: L.nucleus.proton.filter((x) => !x).length,
        electrons: Z,
        shellCounts: counts.slice(),
        home: sub([home.pos[0], home.pos[1], DEPTH], ATOM_AT),
        shells: L.shellR,
        shellStarts,
        jumpShell,
        rJump: L.shellR[jumpShell],
        rHigh: L.rHigh,
        show: L.show,
        ping: { voice: "ding", f: pingNote(el), decay: 1.4, vol: 0.7 },
        nucleons: L.nucleus.proton.slice(), // Sound C: a tick as each one packs in
      };
      // A lit frame round the shown tile, on during the tour (last, and the
      // same size for every element, so the table is built the same).
      const halo = k.part("halo");
      k.add(
        k.param(
          (u, v) => {
            const h = TILE / 2 + 0.015 + v * 0.085;
            const q = u * 4;
            const f = q - Math.floor(q);
            const side = Math.min(3, Math.floor(q));
            const xy = [[-h + 2 * h * f, -h], [h, -h + 2 * h * f], [h - 2 * h * f, h], [-h, h - 2 * h * f]][side]; // prettier-ignore
            return [home.pos[0] + xy[0], home.pos[1] + xy[1], DEPTH + 0.02];
          },
          { grid: 32 },
        ),
        {
          even: true,
          flat: 0.2,
          opacity: 1,
          jitter: 0,
          weight: 4,
          size: 1.3,
          part: halo,
          pattern: false,
          color: (c) => keep(mix("#ffffff", "#ffd23a", Math.min(1, c.v * 1.4))),
        },
      );
    },
  },
};

// A note per shell as it starts to fill, rising.
const SHELL_NOTES = ["C6", "E6", "G6", "C7", "E7", "G7", "C8"];

// The photon's ping: higher for bluer light (a shorter wavelength), a
// plain high note when no line is known.
function pingNote(el) {
  if (!el.line) return 2100;
  return Math.round(1400 * (656 / el.line) ** 1.5);
}

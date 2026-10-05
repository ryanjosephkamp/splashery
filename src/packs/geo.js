// Pack: geo (lane Earth and maps, October 2026). Real landscapes, oceans,
// weather and maps as splats, from public-domain data snapshots that
// tools/geo-*.mjs fetch at build time (the page never calls a data service,
// except the earthquakes' live USGS feed, which CLAUDE.md's "Live data" rule
// allows). Behind the labs switch.
//
//   grand-canyon  USGS 3DEP heights and aerial imagery; the tap floods the
//                 canyon from the river up and drains it
//   st-helens     the USGS pre-1980 DEM and 3DEP today; the tap plays May 18,
//                 1980 (the summit falls away, the blast and the ash column),
//                 a second tap goes back to 1979

import { mix, shade, clamp, smoothstep, vec } from "../kit.js";
import { loadGeo, geoLoaded } from "../geo/data.js";
import { frame, addBlock, hill } from "../geo/terrain.js";

// Splats sort where they were built: a part that moves far (rising water)
// asks for a sort a few times while it moves and once when it stops (as the
// water bottle does in real-objects.js).
function sortWhileMoving(out, d, s, moving, step = 0.4) {
  const slot = moving ? Math.floor(s / step) : -1;
  if (slot !== d.sortSlot) {
    if (moving || d.sortSlot !== undefined) out.resortPose = true;
    d.sortSlot = slot;
  }
}

const ease = (x) => smoothstep(0, 1, clamp(x, 0, 1));
const seg = (s, a, b) => clamp((s - a) / (b - a), 0, 1);

const PD = {
  license: "Public domain",
  licenseUrl: "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits",
};
const CREDIT_3DEP = {
  label: "Elevation",
  title: "3D Elevation Program (3DEP), The National Map",
  source: "https://www.usgs.gov/3d-elevation-program",
  author: "U.S. Geological Survey",
  ...PD,
};
const CREDIT_IMAGERY = {
  label: "Imagery",
  title: "The National Map orthoimagery (NAIP and Landsat)",
  source: "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer",
  author: "USDA Farm Service Agency, NASA and the U.S. Geological Survey",
  ...PD,
};

// ---- Water rising in a block -----------------------------------------------------------------

// A flat water sheet (a part that rises) over the low ground, and the water's
// cut faces on the block's sides, which appear as the level passes them.
function addFlood(k, F, height, { lo, hi, part, color = "#3f6f78" }) {
  const yLo = F.y(lo);
  const yHi = F.y(hi);
  k.add(
    k.param((u, v) => [F.x(u), yLo, F.z(v)], { grid: 96, flip: true }),
    {
      part,
      even: true,
      share: 0.07,
      flat: 0.1,
      jitter: 0.008,
      opacity: 0.92,
      color: (c) => {
        if (height(c.u, c.v) > hi + 30) return null;
        const g = 0.5 + 0.5 * Math.sin(c.p[0] * 40 + c.p[2] * 23) * Math.sin(c.p[2] * 31 - c.p[0] * 9); // prettier-ignore
        return mix(color, "#9cc4c8", 0.12 * g);
      },
    },
  );
  const faces = [
    (a) => [a, 1],
    (a) => [1 - a, 0],
    (a) => [1, 1 - a],
    (a) => [0, a],
  ];
  for (const f of faces) {
    k.add(
      k.param(
        (a, w) => {
          const [u, v] = f(a);
          return [F.x(u) * 1.002, yLo + (yHi - yLo) * w, F.z(v) * 1.002];
        },
        { grid: 48 },
      ),
      {
        even: true,
        share: 0.006,
        flat: 0.15,
        opacity: 0.9,
        kind: "fade",
        channel: 0,
        params: (c) => [clamp((c.p[1] - yLo) / (yHi - yLo), 0, 1), -0.02],
        color: (c) => {
          const [u, v] = f(c.u);
          if (F.y(height(u, v)) > c.p[1]) return null;
          return shade(color, 0.85 - 0.25 * c.v);
        },
      },
    );
  }
}

// ---- Grand Canyon ------------------------------------------------------------------------

const GC_FILE = "assets/toys/grand-canyon/terrain.bin";
const GC_T = 8;

// The rock layers of the canyon walls, top down (approximate elevations at
// Grand Canyon Village, m): Kaibab, Toroweap, Coconino, Hermit, Supai,
// Redwall, Muav and Bright Angel, Tapeats, then the Vishnu schist.
const GC_STRATA = [
  [2060, "#d8cfb4"],
  [1990, "#c9b693"],
  [1900, "#e3d7b8"],
  [1800, "#a8573a"],
  [1560, "#b0623f"],
  [1360, "#c7a487"],
  [1230, "#8f8a6c"],
  [1050, "#7b6550"],
  [-1e9, "#3e3a3d"],
];
const gcRock = (m) => GC_STRATA.find(([at]) => m >= at)[1];

const GRAND_CANYON = {
  alive: false,
  density: 1.5,
  kernel: "sharp",
  credits: [CREDIT_3DEP, CREDIT_IMAGERY],
  controls: [{ key: "flood", label: "Flood", type: "pulse", ease: GC_T }],
  action: { key: "flood", label: "Flood the canyon" },
  options: [
    {
      key: "exag",
      label: "Height",
      type: "select",
      default: "2",
      choices: [
        { id: "1", label: "True scale" },
        { id: "2", label: "Twice as tall" },
        { id: "3", label: "Three times" },
      ],
    },
  ],
  async prepare() {
    await loadGeo(GC_FILE);
  },
  drive(t, c, out, info) {
    const s = c.flood > 0 ? (1 - c.flood) * GC_T : GC_T;
    const level = ease(seg(s, 0.2, 3.4)) * (1 - ease(seg(s, 4.6, 7.8)));
    const d = info.data;
    out.parts.water = { offset: [0, (d.yHi - d.yLo) * level, 0], visible: level > 0.003 ? 1 : 0 };
    out.morph = [level, 0, 0, 0];
    sortWhileMoving(out, d, s, c.flood > 0 && level > 0);
  },
  build(k, o) {
    const g = geoLoaded(GC_FILE);
    const H = g.layer("height");
    const img = g.layer("color");
    const F = frame({ span: g.meta.span, exag: Number(o.exag) || 2, lo: H.min - 250, depth: 0.12 }); // prettier-ignore
    const height = H.sample;
    const water = k.part("water");
    addBlock(k, {
      F,
      height,
      share: 0.78,
      color: (c) => {
        const base = img.sample(c.u, c.v);
        return shade(mix(base, [0.72, 0.6, 0.5], 0.08), 0.92 * hill(c.n, 0.32) + 0.1);
      },
      side: (m) => gcRock(m),
    });
    const lo = H.min + 4;
    const hi = H.min + 0.5 * (H.max - H.min);
    addFlood(k, F, height, { lo, hi, part: water, color: "#46707a" });
    k.data = { yLo: F.y(lo), yHi: F.y(hi) };
  },
};

// ---- Mount St. Helens --------------------------------------------------------------------

const MSH_FILE = "assets/toys/st-helens/terrain.bin";
const MSH_T = 6;
const PLUME = 34; // ash puffs (tokens)
const BLAST = 10; // the lateral blast's dark clouds (tokens)

// 1979's colors from height: forest, then alpine meadow and rock, then snow.
function mshBefore(m, n, u, v, c) {
  const forest = mix("#2f4a2c", "#3d5a33", 0.5 + 0.5 * c.noise(u * 40, v * 40, 1));
  const rock = "#7c7368";
  const snow = "#eef1f4";
  let col = forest;
  col = mix(col, rock, smoothstep(1350, 1650, m + 120 * c.noise(u * 20, v * 20, 3)));
  col = mix(col, snow, smoothstep(1750, 2050, m + 150 * c.noise(u * 25, v * 25, 7)) * clamp(0.4 + n[1], 0, 1)); // prettier-ignore
  // Spirit Lake (north-northeast of the summit).
  return shade(col, hill(n, 0.45));
}

const ST_HELENS = {
  alive: false,
  density: 1.5,
  kernel: "sharp",
  credits: [
    {
      label: "Before 1980",
      title: "Digital elevation model of Mount St. Helens prior to the 1980 eruption",
      source: "https://doi.org/10.5066/P91W7C1L",
      author: "J. A. Bard and R. Phillips-Netherton, U.S. Geological Survey",
      ...PD,
    },
    { ...CREDIT_3DEP, label: "Today" },
    CREDIT_IMAGERY,
  ],
  controls: [{ key: "erupt", label: "1980", type: "toggle", default: 0, ease: MSH_T }],
  action: { key: "erupt", label: "Play May 18, 1980" },
  async prepare() {
    await loadGeo(MSH_FILE);
  },
  drive(t, c, out, info) {
    const d = info.data;
    // Which way the toggle is going: forward plays the eruption, backward
    // runs the land back to 1979 without the ash.
    const st = d.state;
    if (c.erupt > st.last + 1e-6) st.dir = 1;
    else if (c.erupt < st.last - 1e-6) st.dir = -1;
    st.last = c.erupt;
    const s = c.erupt * MSH_T;
    // The north flank slides and the summit falls in over about 2 s.
    const fall = st.dir >= 0 ? ease(seg(s, 0.4, 3.2)) : ease(c.erupt);
    out.morph = [fall, 0, 0, 0];
    // Splats sort where they were built, so the sunken 1979 surface would
    // still draw over today's crater: once the fall is over it is hidden.
    out.parts.old = { visible: fall > 0.995 ? 0 : 1 };
    const tokens = [];
    const C = d.crater;
    const going = st.dir >= 0 && c.erupt > 0 && c.erupt < 1;
    // The ash column: puffs rise from the crater, spread at the top and drift east.
    for (let i = 0; i < PLUME; i++) {
      const born = 0.8 + (i / PLUME) * 3.2;
      const age = s - born;
      const on = going && age > 0;
      const up = Math.min(1, age / 2.2);
      const h = 1.1 * Math.sqrt(Math.max(0, up)) * (0.75 + 0.25 * ((i * 0.618) % 1));
      const spread = 0.12 * up + 0.25 * smoothstep(0.7, 1.0, up);
      const a = i * 2.39996;
      tokens.push({
        base: C,
        offset: [Math.cos(a) * spread + 0.25 * Math.max(0, age - 1.5), h, Math.sin(a) * spread * 0.6],
        visible: on ? clamp(Math.min(age * 3, (MSH_T - 0.2 - s) * 0.9), 0, 1) : 0,
      });
    }
    // The lateral blast: low dark clouds racing north over the ridges.
    for (let i = 0; i < BLAST; i++) {
      const age = s - 0.5 - i * 0.04;
      const run = clamp(age / 1.6, 0, 1);
      const a = (-0.5 + i / (BLAST - 1)) * 1.6; // a fan about north
      const r = 0.15 + 0.85 * ease(run);
      tokens.push({
        base: C,
        offset: [Math.sin(a) * r, -0.12 - 0.05 * run, -Math.cos(a) * r],
        visible: going && age > 0 ? clamp((1 - run) * 3, 0, 1) : 0,
      });
    }
    out.tokens = tokens;
  },
  build(k) {
    const g = geoLoaded(MSH_FILE);
    const B = g.layer("before");
    const A = g.layer("after");
    const img = g.layer("color");
    const lo = Math.min(B.min, A.min) - 150;
    const F = frame({ span: g.meta.span, exag: 1.5, lo, depth: 0.08 });
    const crater = [F.x(0.5), F.y(A.sample(0.5, 0.5)) + 0.02, F.z(0.47)];
    k.data = { crater, state: { last: 0, dir: 1 } };
    // 1979: the old cone, which morphs down onto today's land (a little under
    // it, so the 1980 surface covers it).
    addBlock(k, {
      F,
      height: B.sample,
      share: 0.5,
      part: k.part("old"),
      channel: 0,
      to: (c) => [c.p[0], F.y(A.sample(c.u, c.v)) - 0.05, c.p[2]],
      color: (c) => mshBefore(F.m(c.p[1]), c.n, c.u, c.v, c),
      side: (m) => mix("#4a3d33", "#6e604f", smoothstep(lo, lo + 900, m)),
    });
    // 1980 onward: today's surface, colored from the imagery, appearing from
    // the crater outward as the blast passes.
    k.add(
      k.param((u, v) => [F.x(u), F.y(A.sample(u, v)), F.z(v)], { grid: 128, flip: true }),
      {
        even: true,
        share: 0.36,
        flat: 0.2,
        jitter: 0.01,
        kind: "fade",
        channel: 0,
        params: (c) => {
          const r = Math.hypot(c.u - 0.5, (c.v - 0.47) * 1.15);
          const north = c.v < 0.5 ? 0 : 0.15;
          return [clamp(0.15 + 1.3 * r + north, 0.05, 0.98), -0.06];
        },
        color: (c) => shade(img.sample(c.u, c.v), 0.92 * hill(c.n, 0.3) + 0.08),
      },
    );
    // Ash puffs: billows of a few overlapping balls, one token each, hidden at rest.
    const puff = (i, r, col, n, tone) => {
      const lobes = [0, 1, 2, 3].map((j) => {
        const a = i * 1.7 + j * 2.1;
        return j === 0 ? [0, 0, 0, r] : [Math.cos(a) * r * 0.7, (j - 1.5) * r * 0.35, Math.sin(a) * r * 0.7, r * 0.6]; // prettier-ignore
      });
      k.cloud({ share: n, size: 1 }, (rand) => {
        const L = lobes[Math.floor(rand() * 4)];
        const d = vec.unit([rand() - 0.5, rand() - 0.5, rand() - 0.5]);
        const q = Math.cbrt(rand()) * L[3];
        const lit = 0.3 * Math.max(0, d[1]) - 0.15 * Math.max(0, -d[1]);
        return {
          p: [crater[0] + L[0] + d[0] * q, crater[1] + L[1] + d[1] * q, crater[2] + L[2] + d[2] * q],
          color: shade(col, tone + lit - 0.08 * rand()),
          size: 1.5,
          opacity: 0.8,
          kind: "token",
          params: [i, 0],
        };
      });
    };
    for (let i = 0; i < PLUME; i++) puff(i, 0.06 + 0.04 * ((i * 0.37) % 1), "#8f8a84", 0.004, 0.95);
    for (let i = 0; i < BLAST; i++) puff(PLUME + i, 0.07, "#4d4844", 0.003, 0.9);
    k.reach([crater[0], crater[1] + 0.7, crater[2]]);
  },
};

export const RECIPES = {
  "grand-canyon": GRAND_CANYON,
  "st-helens": ST_HELENS,
};

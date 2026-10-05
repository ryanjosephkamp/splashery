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
//   sea-floor     NOAA ETOPO1 relief of the Mariana Trench under an ocean
//                 that drains away on a tap and fills back
//   tide-harbor   Bar Harbor, Maine (NOAA coastal DEM and USGS imagery) with
//                 waves and NOAA's tide predictions for a spring tide; the tap
//                 plays the day: the bar to Bar Island floods and dries
//   hurricane     Hurricane Polo, September 21–22, 2026: GOES infrared cloud
//                 tops over a Blue Marble map; the eyewall and bands turn, rain
//                 falls and the low winds flow; the tap plays the day it grew
//                 from 70 to 155 knots along its best track
//   relief-map    Yosemite Valley as a relief map: contour lines, height
//                 tints, the aerial photo or land cover, and the named streams;
//                 the tap sends a contour up the walls and water down the streams
//   living-city   a kit-built city: cars go round their blocks, a train runs
//                 on its elevated loop, and the tap turns day to night (the
//                 windows light up one by one) and back
//   stork-migration  30 white storks tagged in Germany fly their real GPS
//                 tracks to Africa (fall 2013, Movebank, CC0); the tap plays
//                 July to October, each bird drawing its trail
//   earthquakes   the USGS feed, live when the toy opens or its plaque is
//                 tapped (a dated snapshot ships for when it can't be reached),
//                 on a NOAA ETOPO1 relief globe; the tap plays the quakes in
//                 time order

import { mix, shade, clamp, smoothstep, vec, ramp, quatAxisAngle } from "../kit.js";
import { evenBox, evenCylinder, evenEllipsoid } from "./even.js";
import { loadGeo, geoLoaded, readText } from "../geo/data.js";
import { inked } from "../font.js";
import { frame, addBlock, hill } from "../geo/terrain.js";

// Tokens that travel far (the storks) ask for a sort of the tokens the same way.
function resortWhileMoving(out, d, s, moving, step = 0.25) {
  const slot = moving ? Math.floor(s / step) : -1;
  if (slot !== d.tokSlot) {
    if (moving || d.tokSlot !== undefined) out.resort = true;
    d.tokSlot = slot;
  }
}

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
    resortWhileMoving(out, d, s, going);
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

// ---- The sea floor -------------------------------------------------------------------------

const SF_FILE = "assets/toys/sea-floor/terrain.bin";
const SF_T = 9;
const CREDIT_ETOPO = {
  label: "Relief",
  title: "ETOPO1 Global Relief Model",
  source: "https://www.ncei.noaa.gov/products/etopo-global-relief-model",
  author: "NOAA National Centers for Environmental Information",
  license: "Public domain",
  licenseUrl: "https://www.ncei.noaa.gov/products/etopo-global-relief-model",
};

// Depth colors as on a bathymetric chart, with land above the sea.
function seaColor(m) {
  if (m >= 0) return mix("#6f8f4a", "#a08b62", smoothstep(0, 600, m));
  const t = clamp((m + 11000) / 11000, 0, 1);
  return ramp(["#140f3a", "#25306e", "#2f5891", "#3f7aa9", "#6fa5c4", "#a9d0de"], t ** 1.15);
}

const SEA_FLOOR = {
  alive: true,
  density: 1.5,
  kernel: "sharp",
  credits: [CREDIT_ETOPO],
  controls: [{ key: "drain", label: "Drain the ocean", type: "pulse", ease: SF_T }],
  action: { key: "drain", label: "Drain the ocean" },
  async prepare() {
    await loadGeo(SF_FILE);
  },
  drive(t, c, out, info) {
    const d = info.data;
    const s = c.drain > 0 ? (1 - c.drain) * SF_T : SF_T;
    // Down over 3.5 s (the trench empties last), a pause on the bare floor,
    // then the sea comes back.
    const down = ease(seg(s, 0.2, 3.8)) * (1 - ease(seg(s, 5.2, 8.6)));
    out.parts.sea = { offset: [0, -(d.ySea - d.yDeep) * down, 0], visible: down > 0.998 ? 0 : 1 };
    out.morph = [down, 0, 0, 0];
    out.amount = 1 - 0.7 * down;
    sortWhileMoving(out, d, s, c.drain > 0 && s < 8.8);
  },
  build(k) {
    const g = geoLoaded(SF_FILE);
    const H = g.layer("height");
    const F = frame({ span: g.meta.span, exag: 9, lo: H.min - 600, depth: 0.06 });
    const height = H.sample;
    addBlock(k, {
      F,
      height,
      share: 0.72,
      color: (c) => shade(seaColor(F.m(c.p[1])), 0.9 * hill(c.n, 0.4)),
      side: (m) => (m > -6000 ? mix("#5d5144", "#3f3d3c", smoothstep(-6000, -1500, m)) : mix("#2b2a2e", "#3f3d3c", smoothstep(-11000, -6000, m))), // prettier-ignore
    });
    const ySea = F.y(0);
    const yDeep = F.y(H.min) - 0.01;
    const sea = k.part("sea");
    // The ocean's surface: a gently heaving sheet at sea level, over every
    // place that is under water.
    k.add(k.param((u, v) => [F.x(u), ySea, F.z(v)], { grid: 96, flip: true }), {
      part: sea,
      even: true,
      share: 0.14,
      flat: 0.1,
      jitter: 0.006,
      opacity: 0.86,
      kind: "wave",
      params: (c) => [0.004, c.u * 9 + c.v * 5],
      color: (c) => {
        if (height(c.u, c.v) > 20) return null;
        const g2 = c.noise(c.u * 30, c.v * 30, 2);
        return mix("#1f4f7a", "#5d93b8", 0.25 + 0.2 * g2);
      },
    });
    // The water's cut faces, which drop away as the level passes them.
    const faces = [(a) => [a, 1], (a) => [1 - a, 0], (a) => [1, 1 - a], (a) => [0, a]];
    for (const f of faces) {
      k.add(
        k.param((a, w) => {
          const [u, v] = f(a);
          return [F.x(u) * 1.002, yDeep + (ySea - yDeep) * w, F.z(v) * 1.002];
        }, { grid: 48 }), // prettier-ignore
        {
          even: true,
          share: 0.025,
          flat: 0.15,
          opacity: 0.88,
          kind: "fade",
          channel: 0,
          params: (c) => [clamp(1 - (c.p[1] - yDeep) / (ySea - yDeep), 0, 1) - 0.01, 0.02],
          color: (c) => {
            const [u, v] = f(c.u);
            if (F.y(height(u, v)) > c.p[1]) return null;
            return mix("#0f2747", "#3c74a3", smoothstep(yDeep, ySea, c.p[1]));
          },
        },
      );
    }
    k.data = { ySea, yDeep };
  },
};

// ---- Waves and tides: Bar Harbor ---------------------------------------------------------

const TH_FILE = "assets/toys/tide-harbor/terrain.bin";
const TH_T = 12;
const TH_FLOOR = -12; // the block's deep water is cut off here (m)
// Three moorings in water deep at every tide (u, v), with each boat's heading.
const TH_BOATS = [
  [0.94, 0.47, 0.6, "#c9452f"],
  [0.2, 0.33, -0.4, "#f2efe6"],
  [0.3, 0.05, 1.9, "#2f5d8a"],
];

function tideAt(levels, f) {
  const x = clamp(f, 0, 1) * (levels.length - 1);
  const i = Math.min(levels.length - 2, Math.floor(x));
  return levels[i] + (levels[i + 1] - levels[i]) * (x - i);
}

// Colors of the shore by height: always-wet mud, the weed and rock of the
// tidal zone, sand at the top, then the aerial picture of the land.
function shoreColor(m, img, n) {
  let col;
  if (m < -2.3) col = "#3d3a2f";
  else if (m < 0.5) col = mix("#4a4a2c", "#6a5b3a", smoothstep(-2.3, 0.5, m));
  else if (m < 2.6) col = mix("#8c7a5c", "#b9a888", smoothstep(0.5, 2.6, m));
  else col = mix("#b9a888", img, smoothstep(2.6, 4.5, m));
  return shade(col, 0.92 * hill(n, 0.35) + 0.06);
}

const TIDE_HARBOR = {
  alive: true,
  density: 1.5,
  kernel: "sharp",
  credits: [
    {
      label: "Tides",
      title: "Tide predictions, Bar Harbor, Maine (8413320)",
      source: "https://tidesandcurrents.noaa.gov/stationhome.html?id=8413320",
      author: "NOAA Center for Operational Oceanographic Products and Services",
      license: "Public domain",
      licenseUrl: "https://tidesandcurrents.noaa.gov/disclaimers.html",
    },
    {
      label: "Heights",
      title: "NCEI coastal digital elevation models",
      source: "https://www.ncei.noaa.gov/products/coastal-elevation-models",
      author: "NOAA National Centers for Environmental Information",
      license: "Public domain",
      licenseUrl: "https://www.ncei.noaa.gov/products/coastal-elevation-models",
    },
    CREDIT_IMAGERY,
  ],
  controls: [{ key: "day", label: "Play the day", type: "pulse", ease: TH_T }],
  action: { key: "day", label: "Play a day of tides" },
  async prepare() {
    await loadGeo(TH_FILE);
  },
  drive(t, c, out, info) {
    const d = info.data;
    const s = c.day > 0 ? (1 - c.day) * TH_T : TH_T;
    const f = c.day > 0 ? clamp((s - 0.3) / (TH_T - 0.6), 0, 1) : 0;
    const level = tideAt(d.levels, f);
    const rise = (level - d.low) * d.k;
    out.parts.water = { offset: [0, rise, 0] };
    out.morph = [level - d.levels[0], 0, 0, 0];
    // Each boat rides the water and rocks on the swell on its own phase.
    d.boats.forEach((b, i) => {
      const roll = 0.07 * Math.sin(t * 1.7 + i * 2.1);
      const pitch = 0.05 * Math.sin(t * 1.3 + i * 1.3);
      out.parts[`boat${i}`] = {
        offset: [0, rise - (d.levels[0] - d.low) * d.k + 0.004 * Math.sin(t * 1.5 + i), 0],
        quat: quatAxisAngle(vec.unit([Math.cos(b.h) * roll, 0.0001, Math.sin(b.h) * pitch + roll * 0.2]), Math.hypot(roll, pitch)), // prettier-ignore
      };
    });
    // The marker on the plaque's tide curve.
    out.tokens = [{ base: d.plot.at(0, d.levels[0]), offset: vec.sub(d.plot.at(f, level), d.plot.at(0, d.levels[0])) }]; // prettier-ignore
    sortWhileMoving(out, d, s, c.day > 0 && s < TH_T - 0.1, 0.6);
  },
  build(k) {
    const g = geoLoaded(TH_FILE);
    const H = g.layer("height");
    const img = g.layer("color");
    const levels = Array.from(g.layer("tide").data);
    const low = Math.min(...levels) - 0.05;
    const high = Math.max(...levels);
    const F = frame({ span: g.meta.span, exag: 6, lo: TH_FLOOR, depth: 0.05 });
    const height = (u, v) => Math.max(TH_FLOOR + 0.5, H.sample(u, v));
    addBlock(k, {
      F,
      height,
      share: 0.66,
      color: (c) => shoreColor(F.m(c.p[1]), img.sample(c.u, c.v), c.n),
      side: (m) => (m > 0 ? mix("#6a5a45", "#7d6a52", smoothstep(0, 40, m)) : mix("#3b3a36", "#5c5145", smoothstep(TH_FLOOR, 0, m))), // prettier-ignore
    });
    // The sea: a sheet at the lowest tide that rises and falls with the curve,
    // its surface heaving in small waves.
    const water = k.part("water");
    const yLow = F.y(low);
    k.add(k.param((u, v) => [F.x(u), yLow, F.z(v)], { grid: 128, flip: true }), {
      part: water,
      even: true,
      share: 0.16,
      flat: 0.1,
      jitter: 0.006,
      opacity: 0.84,
      kind: "wave",
      params: (c) => [0.0035, c.u * 34 - c.v * 12],
      color: (c) => {
        if (height(c.u, c.v) > high + 0.6) return null;
        const g2 = c.noise(c.u * 60, c.v * 60, 4);
        return mix("#2b4f5c", "#7aa4ad", 0.25 + 0.22 * g2);
      },
    });
    // The water's cut faces: each bit shows while the tide is above it.
    const faces = [(a) => [a, 1], (a) => [1 - a, 0], (a) => [1, 1 - a], (a) => [0, a]];
    const yHigh = F.y(high);
    for (const fc of faces) {
      k.add(
        k.param((a, w) => {
          const [u, v] = fc(a);
          return [F.x(u) * 1.002, F.y(TH_FLOOR) + (yHigh - F.y(TH_FLOOR)) * w, F.z(v) * 1.002];
        }, { grid: 48 }), // prettier-ignore
        {
          even: true,
          share: 0.02,
          flat: 0.15,
          opacity: 0.88,
          kind: "fade",
          channel: 0,
          params: (c) => [F.m(c.p[1]) - levels[0], 0.12],
          color: (c) => {
            const [u, v] = fc(c.u);
            if (F.y(height(u, v)) > c.p[1]) return null;
            return mix("#1f3c48", "#3f6b78", smoothstep(F.y(TH_FLOOR), yHigh, c.p[1]));
          },
        },
      );
    }
    // Moored boats: a hull, a cabin and a mast each, floating at the day's
    // first level.
    const boats = TH_BOATS.map(([u, v, h, col], i) => {
      const at = [F.x(u), F.y(levels[0]) + 0.004, F.z(v)];
      const part = k.part(`boat${i}`, { pivot: at });
      const rot = [0, (h * 180) / Math.PI, 0];
      const put = (p) => {
        const ca = Math.cos(h);
        const sa = Math.sin(h);
        return [at[0] + p[0] * ca + p[2] * sa, at[1] + p[1], at[2] - p[0] * sa + p[2] * ca];
      };
      k.add(evenEllipsoid(k, 0.032, 0.01, 0.012), { part, pos: put([0, 0.002, 0]), rot, color: (c) => (c.lp[1] > 0.004 ? "#f4f1ea" : col), share: 0.004, flat: 0.3 }); // prettier-ignore
      k.add(evenBox(0.02, 0.009, 0.01), { part, pos: put([-0.004, 0.013, 0]), rot, color: "#e9e4d8", share: 0.0015, flat: 0.3 }); // prettier-ignore
      k.add(evenCylinder(0.0012, 0.0012, 0.05), { part, pos: put([0.006, 0.032, 0]), color: "#cfc8b8", share: 0.0008, flat: 0.4 }); // prettier-ignore
      return { h };
    });
    // The plaque: the day's tide curve, with high and low marked.
    const pw = 1.4;
    const ph = 0.22;
    const pz = F.z(1) + 0.18;
    const py = F.bottom - 0.02;
    const plot = {
      at: (f, m) => [-pw / 2 + 0.05 + f * (pw - 0.1), py - ph / 2 + 0.03 + ((m - low) / (high - low)) * (ph - 0.06), pz + 0.004], // prettier-ignore
    };
    k.add(k.param((u, v) => [(u - 0.5) * pw, py - v * ph, pz], { grid: 24 }), {
      even: true,
      share: 0.025,
      flat: 0.1,
      color: (c) => {
        const f = (c.p[0] + pw / 2 - 0.05) / (pw - 0.1);
        const hour = f * 24.9;
        const tick = f >= 0 && f <= 1 && Math.abs(hour - Math.round(hour)) < 0.06 && Math.round(hour) % 6 === 0;
        const mid = Math.abs(c.p[1] - plot.at(0, 0)[1]) < 0.0025;
        return { c: tick || mid ? [0.33, 0.36, 0.4] : [0.13, 0.15, 0.18], keep: true };
      },
    });
    k.add(
      k.tube((tt) => plot.at(tt, tideAt(levels, tt)), 0.0028),
      { share: 0.01, color: "#7fc3d4", pattern: false, stretch: 2 },
    );
    const m0 = plot.at(0, levels[0]);
    k.cloud({ share: 0.003, size: 1 }, (rand) => {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * 0.02;
      return { p: [m0[0] + Math.cos(a) * r, m0[1] + Math.sin(a) * r, m0[2] + 0.002], n: [0, 0, 1], color: "#ffd25a", kind: "token", params: [0, 0], pattern: false }; // prettier-ignore
    });
    k.data = { levels, low, k: F.k, boats, plot };
  },
};

// ---- Weather over land: Hurricane Polo --------------------------------------------------

const HU_FILE = "assets/toys/hurricane/storm.bin";
const HU_T = 10;
const HU_RINGS = [1.1, 2.6, 99]; // ring edges, degrees from the eye
const HU_SPIN = [0.55, 0.28, 0.12]; // radians per second at the start of the day

const HURRICANE = {
  alive: true,
  density: 1.4,
  credits: [
    {
      label: "Clouds",
      title: "GOES-East ABI band 13 (clean infrared), through NASA GIBS",
      source: "https://www.star.nesdis.noaa.gov/GOES/",
      author: "NOAA NESDIS (imagery served by NASA's Global Imagery Browse Services)",
      license: "Public domain",
      licenseUrl: "https://www.earthdata.nasa.gov/engage/open-data-services-software/data-use-policy",
    },
    {
      label: "Track",
      title: "Best track of Hurricane Polo (EP17, 2026)",
      source: "https://ftp.nhc.noaa.gov/atcf/btk/",
      author: "NOAA National Hurricane Center",
      license: "Public domain",
      licenseUrl: "https://www.weather.gov/disclaimer",
    },
    {
      label: "Map",
      title: "Blue Marble: Shaded Relief and Bathymetry, through NASA GIBS",
      source: "https://visibleearth.nasa.gov/collection/1484/blue-marble",
      author: "NASA Earth Observatory",
      license: "Public domain",
      licenseUrl: "https://www.earthdata.nasa.gov/engage/open-data-services-software/data-use-policy",
    },
    CREDIT_ETOPO,
  ],
  controls: [{ key: "day", label: "September 22", type: "toggle", default: 0, ease: HU_T }],
  action: { key: "day", label: "Play the day it grew" },
  async prepare() {
    await loadGeo(HU_FILE);
  },
  drive(t, c, out, info) {
    const d = info.data;
    const p = ease(seg(c.day * HU_T, 1, HU_T - 1));
    // Where the eye is along the best track, relative to the start.
    const n = d.track.length - 1;
    const x = p * n;
    const i = Math.min(n - 1, Math.floor(x));
    const a = d.track[i];
    const b = d.track[i + 1];
    const f = x - i;
    const off = [a[0] + (b[0] - a[0]) * f - d.track[0][0], 0, a[1] + (b[1] - a[1]) * f - d.track[0][1]]; // prettier-ignore
    // Each ring turns counterclockwise (seen from above), faster as the storm deepens.
    const dt = d.last === null ? 0 : clamp(t - d.last, 0, 0.1);
    d.last = t;
    const kt = a[2] + (b[2] - a[2]) * f;
    HU_SPIN.forEach((w, r) => {
      d.ang[r] += dt * w * (0.6 + kt / 110);
      out.parts[`ring${r}`] = { angle: d.ang[r], offset: off };
    });
    out.morph = [p, 0, 0, 0];
    out.amount = 0.6 + kt / 200;
    // The rings turn all the time, so their splats are sorted again often.
    sortWhileMoving(out, d, t, true, 0.35);
  },
  build(k) {
    const g = geoLoaded(HU_FILE);
    const M = g.meta;
    const H = g.layer("height");
    const img = g.layer("color");
    const F = frame({ span: M.span, exag: 14, lo: 0, depth: 0.04 });
    const [w, s, e, nn] = M.map;
    const uOf = (lon) => (lon - w) / (e - w);
    const vOf = (lat) => (nn - lat) / (nn - s);
    const XZ = (lon, lat) => [F.x(uOf(lon)), F.z(vOf(lat))];
    addBlock(k, {
      F,
      height: (u, v) => Math.max(0, H.sample(u, v)),
      share: 0.34,
      color: (c) => shade(img.sample(c.u, c.v), 0.85 * hill(c.n, 0.3) + 0.12),
      side: (m) => mix("#3c4a5a", "#5a5145", smoothstep(-100, 100, m)),
    });
    // The clouds: each infrared square becomes a deck of cloud tops, as high
    // as their temperature says (about 6.5 °C colder per kilometer up), split
    // into rings that turn about the eye. The start fades as the end comes in.
    const eye0 = M.track[0];
    const [ex, ez] = XZ(eye0.lon, eye0.lat);
    const kCloud = F.k * 0.5; // clouds at half the land's exaggeration
    const rings = HU_RINGS.map((_, r) => k.part(`ring${r}`, { pivot: [ex, 0, ez], axis: [0, 1, 0] }));
    const ringOf = (deg) => rings[HU_RINGS.findIndex((edge) => deg < edge)];
    M.frames.forEach((fr, fi) => {
      const L = g.layer(fi ? "irB" : "irA");
      const T = (u, v) => {
        const i = Math.min(L.w - 1, Math.max(0, Math.round(u * (L.w - 1))));
        const j = Math.min(L.h - 1, Math.max(0, Math.round(v * (L.h - 1))));
        return L.data[j * L.w + i] - 100;
      };
      const top = (T0) => clamp((27 - T0) / 6.5, 0, 16) * 1000; // m
      const [bw, bs, be, bn] = fr.box;
      const clat = (bs + bn) / 2;
      const clon = (bw + be) / 2;
      k.cloud({ share: 0.29, size: 1 }, (rand) => {
        // Sample the square, keeping only cloud.
        for (let tries = 0; tries < 12; tries++) {
          const u = rand();
          const v = rand();
          const t0 = T(u, v);
          if (t0 > 6 && tries < 11) continue;
          const lon = bw + (be - bw) * u;
          const lat = bn - (bn - bs) * v;
          const deg = Math.hypot(lon - clon, lat - clat);
          if (deg > 5 || t0 > 6) return { p: [ex, -1, ez], color: [0, 0, 0], opacity: 0, part: rings[2] };
          // Placed so this frame's eye sits on the start's eye.
          const [x, z] = XZ(eye0.lon + (lon - clon), eye0.lat + (lat - clat));
          const h = top(t0);
          const e2 = 1 / 256;
          const gx = top(T(u + e2, v)) - top(T(u - e2, v));
          const gz = top(T(u, v + e2)) - top(T(u, v - e2));
          const lit = clamp(0.86 - (gx - gz) * 0.00012, 0.5, 1.12);
          const white = smoothstep(-10, -75, t0);
          const col = shade(mix([0.55, 0.58, 0.62], [0.97, 0.97, 0.99], white), lit);
          const edge = smoothstep(5, 3.8, deg);
          return {
            p: [x, h * kCloud + 0.004, z],
            color: col,
            size: 1.05 + 0.35 * rand(),
            opacity: (0.3 + 0.68 * white) * edge,
            n: [0, 1, 0],
            part: ringOf(deg),
            kind: "fade",
            channel: 0,
            params: [0.25 + 0.5 * (deg / 5) * 0.3 + 0.35 * rand(), fi ? -0.18 : 0.18],
          };
        }
        return { p: [ex, -1, ez], opacity: 0, color: [0, 0, 0], part: rings[2] };
      });
    });
    // Rain under the coldest tops of the grown storm, and low wind lines that
    // stream round the eye.
    const LB = g.layer("irB");
    const frB = M.frames[1];
    const [bw, bs, be, bn] = frB.box;
    k.cloud({ share: 0.05, size: 1 }, (rand) => {
      for (let tries = 0; tries < 20; tries++) {
        const u = rand();
        const v = rand();
        const t0 = LB.data[Math.round(v * (LB.h - 1)) * LB.w + Math.round(u * (LB.w - 1))] - 100;
        const lon = bw + (be - bw) * u;
        const lat = bn - (bn - bs) * v;
        const deg = Math.hypot(lon - (bw + be) / 2, lat - (bs + bn) / 2);
        if (t0 > -62 || deg > 4.5) continue;
        const [x, z] = XZ(eye0.lon + lon - (bw + be) / 2, eye0.lat + lat - (bs + bn) / 2);
        return {
          p: [x, 0.012 + 0.05 * rand(), z],
          color: [0.5, 0.56, 0.64],
          size: 0.6,
          opacity: 0.3,
          dir: [0, 1, 0],
          stretch: 4,
          part: ringOf(deg),
          kind: "fall",
          params: [0.05, rand() * 6.28],
        };
      }
      return { p: [ex, -1, ez], opacity: 0, color: [0, 0, 0], part: rings[2] };
    });
    k.cloud({ share: 0.04, size: 1 }, (rand) => {
      const deg = 0.4 + 4.2 * Math.sqrt(rand());
      const a = rand() * Math.PI * 2;
      const dlat = Math.sin(a) * deg;
      const dlon = (Math.cos(a) * deg) / Math.cos((eye0.lat * Math.PI) / 180);
      const [x, z] = XZ(eye0.lon + dlon, eye0.lat + dlat);
      // Inflow: the streaks point mostly round the eye, a little inward.
      const tan = vec.unit([-(z - ez), 0, x - ex]);
      const inw = vec.unit([ex - x, 0, ez - z]);
      return {
        p: [x, 0.008, z],
        color: [0.85, 0.9, 0.95],
        size: 0.6,
        opacity: 0.35,
        dir: vec.unit(vec.add(vec.mul(tan, -1), vec.mul(inw, 0.35))),
        stretch: 5,
        part: ringOf(deg),
      };
    });
    // The day's best track on the sea: a dot every six hours.
    for (const pnt of M.track) {
      const [x, z] = XZ(pnt.lon, pnt.lat);
      k.add(k.disc(0.012), { pos: [x, 0.003, z], color: mix("#ffd25a", "#ff5a3c", (pnt.kt - 70) / 85), share: 0.002, flat: 0.1, pattern: false }); // prettier-ignore
    }
    k.data = {
      track: M.track.map((pnt) => [...XZ(pnt.lon, pnt.lat), pnt.kt]),
      ang: HU_SPIN.map(() => 0),
      last: null,
    };
  },
};

// ---- A relief map: Yosemite Valley ---------------------------------------------------------

const RM_FILE = "assets/toys/relief-map/terrain.bin";
const RM_T = 7;

// A hypsometric tint, as on a printed relief map.
const TINT = ["#4f7a45", "#7a9a56", "#b8b77a", "#c9a776", "#a98665", "#d9d1c4", "#f4f2ee"];

const RELIEF_MAP = {
  alive: false,
  density: 1.5,
  kernel: "sharp",
  credits: [
    CREDIT_3DEP,
    {
      label: "Streams",
      title: "National Hydrography Dataset",
      source: "https://www.usgs.gov/national-hydrography/national-hydrography-dataset",
      author: "U.S. Geological Survey",
      ...PD,
    },
    {
      label: "Land cover",
      title: "National Land Cover Database 2021 (MRLC)",
      source: "https://www.mrlc.gov/data/nlcd-2021-land-cover-conus",
      author: "U.S. Geological Survey and the MRLC consortium",
      ...PD,
    },
    CREDIT_IMAGERY,
  ],
  options: [
    {
      key: "look",
      label: "Map",
      type: "select",
      default: "height",
      choices: [
        { id: "height", label: "Height colors" },
        { id: "photo", label: "Aerial photo" },
        { id: "land", label: "Land cover" },
      ],
    },
    { key: "contours", label: "Contour lines", type: "switch", default: true },
    { key: "rivers", label: "Streams", type: "switch", default: true },
  ],
  controls: [{ key: "sweep", label: "Sweep", type: "pulse", ease: RM_T }],
  action: { key: "sweep", label: "Sweep a contour and the streams" },
  async prepare() {
    await loadGeo(RM_FILE);
  },
  drive(t, c, out) {
    const s = c.sweep > 0 ? (1 - c.sweep) * RM_T : RM_T;
    const up = s < RM_T ? seg(s, 0.2, 5.6) * 1.06 - 0.03 : -1;
    out.morph = [up, up, 0, 0];
    out.glow = [0.35, 0.8, 1.0, 0.9];
  },
  build(k, o) {
    const g = geoLoaded(RM_FILE);
    const H = g.layer("height");
    const photo = g.layer("color");
    const land = g.layer("land");
    const F = frame({ span: g.meta.span, exag: 1.5, lo: H.min - 300, depth: 0.08 });
    const norm = (m) => (m - H.min) / (H.max - H.min);
    const du = 1 / H.w;
    const mPerU = g.meta.span[0];
    const mPerV = g.meta.span[1];
    addBlock(k, {
      F,
      height: H.sample,
      share: 0.86,
      kind: "band",
      channel: 0,
      params: (c) => [norm(F.m(c.p[1])), 0.008],
      color: (c) => {
        const m = F.m(c.p[1]);
        let col;
        if (o.look === "photo") col = photo.sample(c.u, c.v);
        else if (o.look === "land") col = land.sample(c.u, c.v);
        else col = ramp(TINT, norm(m));
        col = shade(col, (o.look === "photo" ? 0.95 : 0.8) * hill(c.n, 0.45) + 0.05);
        if (o.contours !== false) {
          // A line every 100 m, heavier every 500 m, about as wide anywhere.
          const gx = (H.sample(c.u + du, c.v) - H.sample(c.u - du, c.v)) / (2 * du * mPerU);
          const gz = (H.sample(c.u, c.v + du) - H.sample(c.u, c.v - du)) / (2 * du * mPerV);
          const grad = Math.hypot(gx, gz);
          const near = (step) => {
            const r = ((m % step) + step) % step;
            return Math.min(r, step - r);
          };
          const w = Math.max(2.5, 30 * grad);
          if (near(500) < w * 1.4) return { c: shade(col, 0.42), keep: true };
          if (near(100) < w) return { c: shade(col, 0.66), keep: true };
        }
        return col;
      },
      side: (m) => mix("#6b6258", "#8f857a", smoothstep(H.min - 300, H.max, m)),
    });
    // The streams: short streaks along each line, a little above the ground;
    // their glow runs downhill as the channel climbs.
    if (o.rivers !== false) {
      const segs = [];
      let total = 0;
      for (const r of g.meta.rivers)
        for (let i = 0; i + 1 < r.pts.length; i++) {
          const a = r.pts[i];
          const b = r.pts[i + 1];
          const len = Math.hypot((b[0] - a[0]) * F.sx, (b[1] - a[1]) * F.sz) * (r.main ? 2.2 : 1);
          total += len;
          segs.push({ a, b, main: r.main, cum: total });
        }
      const on = (u, v, lift) => [F.x(u), F.y(H.sample(u, v)) + lift, F.z(v)];
      k.cloud({ share: 0.06, size: 1 }, (rand) => {
        const x = rand() * total;
        let lo = 0;
        let hi = segs.length - 1;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (segs[mid].cum < x) lo = mid + 1;
          else hi = mid;
        }
        const sg = segs[lo];
        const f = rand();
        const u = sg.a[0] + (sg.b[0] - sg.a[0]) * f;
        const v = sg.a[1] + (sg.b[1] - sg.a[1]) * f;
        const p = on(u, v, 0.004);
        const q = on(sg.b[0], sg.b[1], 0.004);
        const pa = on(sg.a[0], sg.a[1], 0.004);
        return {
          p,
          color: sg.main ? [0.2, 0.45, 0.85] : [0.25, 0.55, 0.9],
          size: sg.main ? 0.75 : 0.42,
          dir: vec.unit(vec.sub(q, pa)),
          stretch: 2.2,
          opacity: 0.95,
          kind: "band",
          channel: 1,
          params: [1 - norm(H.sample(u, v)), 0.04],
          pattern: false,
        };
      });
    }
  },
};

// ---- A living city ---------------------------------------------------------------------------

const LC_N = 4; // blocks a side
const LC_BLOCK = 0.5; // block pitch (street center to street center)
const LC_STREET = 0.09; // street width
const LC_CARS = 26;
const LC_TRAIN = 5;
const LC_LOOP = 1.13; // the train's loop, half-width
const LC_RAIL_Y = 0.16;

const hash = (...a) => {
  let h = 2166136261;
  for (const x of a) h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619);
  return ((h >>> 0) % 100000) / 100000;
};

// A closed rectangular path: point and heading at distance d along it.
function loopPath(x0, z0, x1, z1) {
  const sides = [
    [[x0, z1], [x1, z1]],
    [[x1, z1], [x1, z0]],
    [[x1, z0], [x0, z0]],
    [[x0, z0], [x0, z1]],
  ];
  const lens = sides.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]));
  const total = lens.reduce((a, b) => a + b, 0);
  return {
    total,
    at(d) {
      d = ((d % total) + total) % total;
      for (let i = 0; i < 4; i++) {
        if (d <= lens[i] || i === 3) {
          const [a, b] = sides[i];
          const f = Math.min(1, d / lens[i]);
          return { p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], h: Math.atan2(b[0] - a[0], b[1] - a[1]) }; // prettier-ignore
        }
        d -= lens[i];
      }
      return null;
    },
  };
}

const LIVING_CITY = {
  alive: true,
  density: 1.3,
  controls: [{ key: "night", label: "Night", type: "toggle", default: 0, ease: 4.5 }],
  action: { key: "night", label: "Day or night" },
  drive(t, c, out, info) {
    const d = info.data;
    out.morph = [c.night, 0, 0, 0];
    const tokens = [];
    // The cars: each goes round its own block, keeping to the right.
    d.cars.forEach((car) => {
      const q = car.path.at(car.d0 + t * car.speed);
      tokens.push({
        base: car.base,
        offset: [q.p[0] - car.base[0], 0, q.p[1] - car.base[2]],
        quat: quatAxisAngle([0, 1, 0], q.h - car.h0),
      });
    });
    // The train: its cars follow one another round the elevated loop.
    d.train.forEach((tc) => {
      const q = d.trainPath.at(tc.d0 + t * 0.32);
      tokens.push({
        base: tc.base,
        offset: [q.p[0] - tc.base[0], 0, q.p[1] - tc.base[2]],
        quat: quatAxisAngle([0, 1, 0], q.h - tc.h0),
      });
    });
    out.tokens = tokens;
    resortWhileMoving(out, d, t, true, 0.3);
  },
  build(k) {
    const half = (LC_N * LC_BLOCK) / 2;
    const P = LC_BLOCK;
    const S = LC_STREET;
    // The ground: streets with lane lines, sidewalks, one park. Day and night
    // copies cross-fade on the night channel.
    const isPark = (bi, bj) => bi === 1 && bj === 2;
    const ground = (night) => (c) => {
      const x = c.p[0] + half;
      const z = c.p[2] + half;
      const fx = ((x % P) + P) % P;
      const fz = ((z % P) + P) % P;
      const sx = Math.min(fx, P - fx);
      const sz = Math.min(fz, P - fz);
      const street = sx < S / 2 || sz < S / 2;
      let col;
      if (street) {
        const line = (sx < 0.003 && sz > S / 2) || (sz < 0.003 && sx > S / 2);
        col = line ? "#d8c25a" : "#3a3d42";
      } else if (sx < S / 2 + 0.02 || sz < S / 2 + 0.02) col = "#9a9890";
      else col = isPark(Math.floor(x / P), Math.floor(z / P)) ? mix("#4c7a3c", "#5d8a45", hash(Math.floor(x * 60), Math.floor(z * 60))) : "#8b8880"; // prettier-ignore
      return night ? shade(col, 0.28) : col;
    };
    const base = evenBox(2 * half + 0.1, 0.06, 2 * half + 0.1);
    k.add(base, { pos: [0, -0.03, 0], even: true, share: 0.16, flat: 0.15, jitter: 0.008, color: (c) => (c.s.face === 2 ? ground(false)(c) : "#5a554d"), kind: "fade", channel: 0, params: (c) => (c.s.face === 2 ? [0.35, 0.3] : [9, 0.1]) }); // prettier-ignore
    k.add(evenBox(2 * half + 0.1, 0.001, 2 * half + 0.1), { pos: [0, 0.0005, 0], even: true, share: 0.14, flat: 0.15, jitter: 0.008, color: ground(true), kind: "fade", channel: 0, params: [0.35, -0.3] }); // prettier-ignore
    // The buildings.
    let bid = 0;
    for (let bi = 0; bi < LC_N; bi++)
      for (let bj = 0; bj < LC_N; bj++) {
        if (isPark(bi, bj)) continue;
        const cx = -half + (bi + 0.5) * P;
        const cz = -half + (bj + 0.5) * P;
        const inner = P - S - 0.05;
        const split = hash(bi, bj, 1) < 0.5 ? 1 : 2;
        const centrality = 1 - Math.hypot(cx, cz) / (half * 1.5);
        for (let a = 0; a < split; a++)
          for (let b = 0; b < 2; b++) {
            const w = inner / split - 0.02;
            const dz = inner / 2 - 0.02;
            const x = cx - inner / 2 + (a + 0.5) * (inner / split);
            const z = cz - inner / 2 + (b + 0.5) * (inner / 2);
            const h = 0.08 + (0.12 + 0.55 * centrality) * (0.35 + 0.65 * hash(bi, bj, a, b));
            const tone = ["#c9c2b4", "#a9b3bd", "#b98f74", "#d6d1c6", "#8e98a3"][Math.floor(hash(bid, 7) * 5)]; // prettier-ignore
            const id = bid++;
            const shape = evenBox(w, h, dz);
            const win = (c) => {
              if (c.s.face === 2 || c.s.face === 3) return null;
              const along = c.s.face < 2 ? c.lp[2] + dz / 2 : c.lp[0] + w / 2;
              const up = c.lp[1] + h / 2;
              const fa = (along / 0.028) % 1;
              const fu = (up / 0.032) % 1;
              if (up < 0.025 || fa < 0.22 || fa > 0.78 || fu < 0.3 || fu > 0.8) return null;
              return [c.s.face, Math.floor(along / 0.028), Math.floor(up / 0.032)];
            };
            const lit = (c) => {
              const n = c.n;
              return 0.78 + 0.26 * Math.max(0, n[0] * -0.5 + n[1] * 0.8 + n[2] * 0.6);
            };
            const common = { pos: [x, h / 2, z], even: true, weight: 1.4, flat: 0.2, jitter: 0.008 };
            // Day: walls and roofs fade at dusk; the glass stays.
            k.add(shape, { ...common, kind: "fade", channel: 0, params: (c) => (win(c) ? [9, 0.1] : [0.3 + 0.2 * hash(id), 0.25]), color: (c) => (win(c) ? "#3f5566" : shade(tone, lit(c))) }); // prettier-ignore
            // Night: dark walls fade in ...
            k.add(shape, { ...common, weight: 0.9, kind: "fade", channel: 0, params: [0.3 + 0.2 * hash(id), -0.25], color: (c) => (win(c) ? null : shade(tone, 0.22 * lit(c))) }); // prettier-ignore
            // ... and each window lights up at its own moment.
            k.add(shape, { ...common, weight: 0.5, size: 0.95, kind: "fade", channel: 0, params: (c) => { const wv = win(c); return [0.3 + 0.62 * hash(id, ...(wv || [0])), -0.04]; }, color: (c) => { const wv = win(c); return wv ? mix("#ffd27a", "#fff1c4", hash(id, ...wv, 5)) : null; }, pattern: false }); // prettier-ignore
          }
      }
    // Park trees.
    for (let i = 0; i < 9; i++) {
      const x = -half + 1.5 * P + (hash(i, 3) - 0.5) * (P - S - 0.08);
      const z = -half + 2.5 * P + (hash(i, 4) - 0.5) * (P - S - 0.08);
      k.add(evenEllipsoid(k, 0.035, 0.04, 0.035), { pos: [x, 0.06, z], color: (c) => shade("#3d6b33", 0.8 + 0.3 * c.n[1]), share: 0.002, flat: 0.4 }); // prettier-ignore
      k.add(evenCylinder(0.006, 0.006, 0.03), { pos: [x, 0.015, z], color: "#5b4532", share: 0.0005 });
    }
    // The elevated rail: a deck on pillars round the city.
    const L = LC_LOOP;
    for (const [px, pz, sx, sz] of [[0, L, 2 * L, 0.05], [0, -L, 2 * L, 0.05], [L, 0, 0.05, 2 * L], [-L, 0, 0.05, 2 * L]]) // prettier-ignore
      k.add(evenBox(sx + 0.05, 0.012, sz + 0.05), { pos: [px, LC_RAIL_Y - 0.012, pz], even: true, share: 0.012, color: "#6d6a66", flat: 0.2 }); // prettier-ignore
    for (let i = 0; i < 16; i++) {
      const f = (i / 16) * 4;
      const side = Math.floor(f);
      const g2 = (f - side) * 2 - 1;
      const [px, pz] = [[g2 * L, L], [L, -g2 * L], [-g2 * L, -L], [-L, g2 * L]][side];
      k.add(evenCylinder(0.008, 0.008, LC_RAIL_Y - 0.012), { pos: [px, (LC_RAIL_Y - 0.012) / 2, pz], color: "#7d7a74", share: 0.0008 }); // prettier-ignore
    }
    // Cars and the train are tokens, built where they start.
    const carCols = ["#c23b2e", "#2f5d8a", "#e8e4da", "#2b2b2e", "#d9a521", "#5f8a4a"];
    const cars = [];
    let tok = 0;
    const addVehicle = (pos, h0, len, wid, hgt, col, isTrain) => {
      const i = tok++;
      const put = (lx, ly, lz) => [pos[0] + lx * Math.cos(h0) + lz * Math.sin(h0), pos[1] + ly, pos[2] - lx * Math.sin(h0) + lz * Math.cos(h0)]; // prettier-ignore
      k.cloud({ share: isTrain ? 0.006 : 0.0022, size: 1 }, (rand) => {
        // A rounded box body; lights at the ends.
        const face = rand();
        let lx = (rand() - 0.5) * wid;
        let ly = rand() * hgt;
        let lz = (rand() - 0.5) * len;
        if (face < 0.3) ly = hgt;
        else if (face < 0.5) lx = Math.sign(lx || 1) * wid / 2;
        else if (face < 0.65) lz = Math.sign(lz || 1) * len / 2;
        const front = lz > len / 2 - 0.002;
        const back = lz < -len / 2 + 0.002;
        let color = col;
        if (!isTrain && ly > hgt * 0.55 && face >= 0.3) color = "#2f3b46"; // the cabin's glass
        if (isTrain && ly > hgt * 0.45 && ly < hgt * 0.8 && face >= 0.3 && face < 0.5) color = "#2f3b46";
        if (front && ly < hgt * 0.5 && Math.abs(lx) > wid * 0.25) color = "#fff6d8";
        if (back && ly < hgt * 0.5 && Math.abs(lx) > wid * 0.25) color = "#e0342a";
        return { p: put(lx, ly + 0.004, lz), color, size: 0.75, kind: "token", params: [i, 0], pattern: false };
      });
    };
    for (let i = 0; i < LC_CARS; i++) {
      // Each car's loop: the streets round one block (or two), on the right.
      const bi = Math.floor(hash(i, 11) * LC_N);
      const bj = Math.floor(hash(i, 12) * LC_N);
      const wide = hash(i, 13) < 0.3 ? 1 : 0;
      const lane = S / 4;
      const x0 = -half + bi * P;
      const z0 = -half + bj * P;
      const x1 = Math.min(half, x0 + (1 + wide) * P);
      const z1 = z0 + P;
      const path = loopPath(x0 + lane, z0 + lane, x1 - lane, z1 - lane);
      const d0 = hash(i, 14) * path.total;
      const q = path.at(d0);
      const basePos = [q.p[0], 0, q.p[1]];
      addVehicle(basePos, q.h, 0.058, 0.027, 0.022, carCols[i % carCols.length], false);
      cars.push({ path, d0, h0: q.h, base: basePos, speed: 0.12 + 0.08 * hash(i, 15) });
    }
    const trainPath = loopPath(-L, -L, L, L);
    const train = [];
    for (let i = 0; i < LC_TRAIN; i++) {
      const d0 = -i * 0.11;
      const q = trainPath.at(d0);
      const basePos = [q.p[0], LC_RAIL_Y, q.p[1]];
      addVehicle(basePos, q.h, 0.1, 0.034, 0.035, i === 0 ? "#d7d9dc" : "#c4c8cc", true);
      train.push({ d0, h0: q.h, base: basePos });
    }
    k.data = { cars, train, trainPath };
    k.reach([0, 0.8, 0]);
  },
};

// ---- Migration: white storks -----------------------------------------------------------------

const SM_FILE = "assets/toys/stork-migration/migration.bin";
const SM_T = 14;
const SM_FLY = 0.035; // flying height above the map (recipe units)

function birdAt(pts, hour) {
  if (hour <= pts[0][0]) return { lon: pts[0][1], lat: pts[0][2], i: 0 };
  const last = pts[pts.length - 1];
  if (hour >= last[0]) return { lon: last[1], lat: last[2], i: pts.length - 1 };
  let lo = 0;
  let hi = pts.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid][0] <= hour) lo = mid;
    else hi = mid;
  }
  const a = pts[lo];
  const b = pts[hi];
  const f = (hour - a[0]) / Math.max(1, b[0] - a[0]);
  return { lon: a[1] + (b[1] - a[1]) * f, lat: a[2] + (b[2] - a[2]) * f, i: lo };
}

const STORK_MIGRATION = {
  alive: false,
  density: 1.3,
  credits: [
    {
      label: "Storks",
      title: "Data from: The challenges of the first migration (white storks, Rotics et al. 2016)",
      source: "https://doi.org/10.5441/001/1.hn1bd23k",
      author: "S. Rotics, M. Kaatz, Y. S. Resheff, S. F. Turjeman, D. Zurell, N. Sapir, U. Eggers, A. Flack, W. Fiedler, F. Jeltsch, M. Wikelski and R. Nathan (Movebank Data Repository)",
      license: "CC0 1.0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    },
    CREDIT_ETOPO,
  ],
  controls: [{ key: "fly", label: "Fly", type: "pulse", ease: SM_T }],
  action: { key: "fly", label: "Play the fall migration" },
  async prepare() {
    await loadGeo(SM_FILE);
  },
  drive(t, c, out, info) {
    const d = info.data;
    const s = c.fly > 0 ? (1 - c.fly) * SM_T : 0;
    // 0.4 s at the nests, 12 s of migration, then a beat at the end before
    // everyone is home again for the next tap.
    const f = c.fly > 0 ? clamp((s - 0.4) / 12, 0, 1) : 0;
    const hour = f * d.hours;
    out.morph = [f > 0 && f < 1 ? f : c.fly > 0 && s > 12.4 ? 1 : 0, 0, 0, 0];
    out.tokens = d.birds.map((b) => {
      const q = birdAt(b.pts, hour);
      const n = b.pts[Math.min(b.pts.length - 1, q.i + 1)];
      const p = d.at(q.lon, q.lat);
      const ahead = d.at(n[1], n[2]);
      const head = Math.atan2(ahead[0] - p[0], ahead[2] - p[2]);
      return {
        base: b.base,
        offset: [p[0] - b.base[0], 0, p[2] - b.base[2]],
        quat: quatAxisAngle([0, 1, 0], Number.isFinite(head) && Math.hypot(ahead[0] - p[0], ahead[2] - p[2]) > 1e-4 ? head : 0), // prettier-ignore
      };
    });
    resortWhileMoving(out, d, s, c.fly > 0);
  },
  build(k) {
    const g = geoLoaded(SM_FILE);
    const M = g.meta;
    const H = g.layer("height");
    const F = frame({ span: M.span, exag: 45, lo: -500, depth: 0.03 });
    const [w, s, e, n] = M.map;
    const at = (lon, lat) => {
      const u = (lon - w) / (e - w);
      const v = (n - lat) / (n - s);
      return [F.x(u), Math.max(F.y(0), F.y(H.sample(u, v))) + SM_FLY, F.z(v)];
    };
    addBlock(k, {
      F,
      height: (u, v) => Math.max(-500, H.sample(u, v)),
      share: 0.66,
      color: (c) => {
        const m = H.sample(c.u, c.v);
        let col;
        if (m < 0) col = mix("#1d3f6e", "#3e7cb0", smoothstep(-3000, -50, m));
        else col = ramp(["#6b8f4e", "#a8a368", "#c2a477", "#9c8166", "#e8e4dc"], clamp(m / 3500, 0, 1));
        // The Sahara and the Arabian desert read as sand south of 31° N.
        const lat = n - c.v * (n - s);
        if (m >= 0 && lat < 31 && lat > 14) col = mix(col, "#d9b98a", 0.7 * smoothstep(14, 20, lat));
        return shade(col, 0.85 * hill(c.n, 0.4) + 0.1);
      },
      side: () => "#5a5248",
    });
    // Trails: a line per bird along its fixes, appearing behind it as the
    // migration plays (the channel is the season's fraction).
    const palette = ["#ff8a3d", "#ffd23a", "#ff5a7a", "#7fd1ff", "#b78bff", "#7dff9a"];
    const birds = M.birds.map((b, bi) => {
      const col = palette[bi % palette.length];
      const pts = b.pts;
      k.cloud({ share: 0.008, size: 1 }, (rand) => {
        const x = rand() * (pts.length - 1);
        const i = Math.floor(x);
        const a = pts[i];
        const bb = pts[Math.min(pts.length - 1, i + 1)];
        const f = x - i;
        const lon = a[1] + (bb[1] - a[1]) * f;
        const lat = a[2] + (bb[2] - a[2]) * f;
        const hour = a[0] + (bb[0] - a[0]) * f;
        const p = at(lon, lat);
        p[1] -= SM_FLY * 0.8;
        return { p, color: col, size: 0.55, opacity: 0.9, kind: "fade", channel: 0, params: [hour / M.hours + 0.002, -0.004], pattern: false }; // prettier-ignore
      });
      // The stork: white body and wings with black flight feathers, a red
      // bill, built facing +Z at its nest.
      const base = at(pts[0][1], pts[0][2]);
      k.cloud({ share: 0.0025, size: 1 }, (rand) => {
        const r = rand();
        let lp;
        let color;
        if (r < 0.35) {
          lp = [(rand() - 0.5) * 0.008, (rand() - 0.5) * 0.006, (rand() - 0.5) * 0.026];
          color = "#f3f1ec";
        } else if (r < 0.92) {
          const side = rand() < 0.5 ? -1 : 1;
          const span = rand();
          lp = [side * span * 0.032, 0.002 * span, (rand() - 0.5) * 0.012 - 0.002 * span];
          color = span > 0.55 ? "#1f1f22" : "#f3f1ec";
        } else {
          lp = [0, 0, 0.013 + rand() * 0.008];
          color = "#e0452c";
        }
        return { p: [base[0] + lp[0], base[1] + lp[1], base[2] + lp[2]], color, size: 0.6, kind: "token", params: [bi, 0], pattern: false }; // prettier-ignore
      });
      return { pts, base };
    });
    // The months along the front, with a bar that lights as time passes.
    const z = F.z(1) + 0.08;
    const x0 = F.x(0);
    const x1 = F.x(1);
    const start = new Date(M.start);
    const months = [];
    for (let mth = start.getUTCMonth(); mth <= start.getUTCMonth() + 4; mth++) {
      const d0 = Date.UTC(start.getUTCFullYear(), mth, 1);
      const fx = (d0 - start.getTime()) / 3.6e6 / M.hours;
      if (fx > -0.02 && fx < 1) months.push([Math.max(0, fx), MONTHS[mth % 12]]);
    }
    k.add(k.param((u, v) => [x0 + (x1 - x0) * u, F.bottom - 0.01, z + v * 0.03], { grid: 24 }), { even: true, share: 0.01, color: "#2d3238", kind: "band", channel: 0, params: (c) => [c.u, 0.015], pattern: false }); // prettier-ignore
    const fx = 0.019;
    for (const [mf, word] of months) {
      const mx = x0 + (x1 - x0) * mf;
      k.add(k.param((u, v) => [mx + u * 0.34, F.bottom - 0.01, z + 0.045 + v * 0.135], { grid: 16 }), {
        even: true,
        share: 0.02,
        flat: 0.1,
        color: (c) => (inked([word], (c.p[0] - mx) / fx, (c.p[2] - z - 0.045) / fx) ? { c: [0.9, 0.9, 0.86], keep: true, size: 0.6 } : null), // prettier-ignore
      });
    }
    k.data = { birds, hours: M.hours, at };
  },
};

// ---- Earthquakes ---------------------------------------------------------------------------

const EQ_DIR = "assets/toys/earthquakes/";
const EQ_T = 10;
const EQ_FEEDS = {
  week: {
    label: "Past week, magnitude 2.5 and up",
    url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson",
    words: "PAST WEEK, M2.5 AND UP",
  },
  month: {
    label: "Past month, magnitude 4.5 and up",
    url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson",
    words: "PAST MONTH, M4.5 AND UP",
  },
  year: { label: "A year, magnitude 5 and up (snapshot)", words: "OCT 2025 TO SEP 2026, M5 AND UP" },
};
const MONTHS = "JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC".split(" ");
const MONTH_NAMES = "January February March April May June July August September October November December".split(" "); // prettier-ignore
const EQ = { snapshot: null, shown: null, live: new Map() };

// Rows of [time s, lon, lat, depth km, magnitude] from a GeoJSON feed.
function quakeRows(gj) {
  const out = [];
  for (const f of gj.features || []) {
    const p = f.properties || {};
    const g = f.geometry?.coordinates || [];
    const row = [Math.round(p.time / 1000), +g[0], +g[1], +g[2], +p.mag];
    if (p.type === "earthquake" && row.every(Number.isFinite)) out.push(row);
  }
  return out.sort((a, b) => a[0] - b[0]);
}

// Tests and clips (a browser driven by a tool) use the snapshot, so they
// never depend on the network; ?geofeed=live overrides that.
function liveAllowed() {
  if (typeof window === "undefined" || typeof fetch !== "function") return false;
  const q = new URLSearchParams(window.location?.search || "");
  if (q.get("geofeed") === "live") return true;
  if (q.get("geofeed") === "snapshot") return false;
  return !globalThis.navigator?.webdriver;
}

async function eqFetch(feed) {
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = setTimeout(() => ctl?.abort(), 9000);
  try {
    const r = await fetch(EQ_FEEDS[feed].url, { cache: "no-store", signal: ctl?.signal });
    if (!r.ok) throw new Error(String(r.status));
    const gj = await r.json();
    return { events: quakeRows(gj), fetched: new Date(gj.metadata?.generated || Date.now()), live: true }; // prettier-ignore
  } finally {
    clearTimeout(timer);
  }
}

const two = (n) => String(n).padStart(2, "0");
const utcWords = (d) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()} ${d.getUTCFullYear()} AT ${two(d.getUTCHours())}${two(d.getUTCMinutes())} UTC`; // prettier-ignore
const utcText = (d) => `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}, ${two(d.getUTCHours())}:${two(d.getUTCMinutes())} UTC`; // prettier-ignore

// Where a lon/lat (degrees) sits on the globe of radius r: the Pacific's
// Ring of Fire (160 degrees west) faces +Z, the viewer.
const EQ_FRONT = -160;
function onGlobe(lon, lat, r) {
  const a = ((lon - EQ_FRONT) * Math.PI) / 180;
  const b = (lat * Math.PI) / 180;
  return [r * Math.cos(b) * Math.sin(a), r * Math.sin(b), r * Math.cos(b) * Math.cos(a)];
}

// USGS map colors by depth: shallow orange-red, intermediate yellow, deep blue.
function depthColor(d) {
  if (d < 33) return mix("#ff5a1f", "#ff8a2a", d / 33);
  if (d < 70) return mix("#ff8a2a", "#ffd23a", (d - 33) / 37);
  if (d < 300) return mix("#ffd23a", "#4fd17a", (d - 70) / 230);
  return mix("#4fd17a", "#3d7dff", clamp((d - 300) / 300, 0, 1));
}

function reliefColor(h, n, c) {
  let col;
  if (h < 0) col = mix("#0d2a57", "#3d7fb8", smoothstep(-6500, -150, h));
  else if (h < 2500) col = mix(mix("#5c8a43", "#9a9156", smoothstep(0, 900, h)), "#8d7660", smoothstep(900, 2500, h)); // prettier-ignore
  else col = mix("#8d7660", "#e9ecef", smoothstep(2500, 5000, h));
  const d = vec.dot(n, vec.unit([-0.4, 0.5, 0.75]));
  return shade(col, 0.72 + 0.32 * Math.max(0, d) + 0.03 * c.noise(c.p[0] * 30, c.p[1] * 30, c.p[2] * 30)); // prettier-ignore
}

const EARTHQUAKES = {
  alive: true,
  turntable: false,
  options: [
    {
      key: "feed",
      label: "Earthquakes",
      type: "select",
      default: "week",
      choices: Object.entries(EQ_FEEDS).map(([id, f]) => ({ id, label: f.label })),
    },
    { key: "refresh", label: "Refresh", type: "text", default: "0", hidden: true },
  ],
  controls: [{ key: "play", label: "Play the quakes", type: "pulse", ease: EQ_T }],
  action: {
    key: "play",
    label: "Play the quakes in time order",
    // A tap on the plaque fetches the feed again.
    at(point) {
      if (point[1] > -1.2 || EQ.shown?.feed === "year") return null;
      return { options: { refresh: String((Number(EQ.shown?.refresh) || 0) + 1) }, key: "play" };
    },
  },
  get credits() {
    const s = EQ.shown;
    const out = [
      {
        label: "Earthquakes",
        title: s
          ? `${s.live ? "USGS earthquake feed, read live" : "USGS earthquake data, snapshot"} (${EQ_FEEDS[s.feed].label.toLowerCase()}; ${s.events.length} quakes; ${s.live ? "fetched" : "as of"} ${utcText(s.fetched)})` // prettier-ignore
          : "USGS earthquake feeds",
        source: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php",
        author: "U.S. Geological Survey" + (s?.live ? " and its contributing networks" : ""),
        ...PD,
      },
      {
        label: "Relief",
        title: "ETOPO1 Global Relief Model",
        source: "https://www.ncei.noaa.gov/products/etopo-global-relief-model",
        author: "NOAA National Centers for Environmental Information",
        license: "Public domain",
        licenseUrl: "https://www.ncei.noaa.gov/products/etopo-global-relief-model",
      },
    ];
    return out;
  },
  async prepare(o) {
    await loadGeo(EQ_DIR + "globe.bin");
    if (!EQ.snapshot) EQ.snapshot = JSON.parse(await readText(EQ_DIR + "snapshot.json"));
    const feed = EQ_FEEDS[o.feed] ? o.feed : "week";
    const snap = EQ.snapshot.feeds[feed];
    let got = null;
    if (feed !== "year" && liveAllowed()) {
      const key = `${feed}|${o.refresh}`;
      if (!EQ.live.has(key)) EQ.live.set(key, eqFetch(feed).catch(() => null));
      got = await EQ.live.get(key);
    }
    if (!got) got = { events: snap.events, fetched: new Date(snap.fetched), live: false };
    EQ.shown = { ...got, feed, refresh: o.refresh };
  },
  drive(t, c, out, info) {
    const s = c.play > 0 ? (1 - c.play) * EQ_T : 0;
    // The timeline: 0.6 s in, the quakes flash one by one over 8 s.
    const tl = c.play > 0 ? clamp((s - 0.6) / 8, 0, 1.08) : 0;
    out.morph = [tl, 0, 0, 0];
    out.glow = [1, 0.97, 0.85, 2.2];
    out.parts.globe = { angle: t * 0.08 };
  },
  build(k, o) {
    const G = geoLoaded(EQ_DIR + "globe.bin").layer("height");
    const S = EQ.shown;
    const globe = k.part("globe", { pivot: [0, 0, 0], axis: [0, 1, 0] });
    const R = 1;
    const bump = 0.035 / 8000;
    const hAt = (lon, lat) => G.sample((lon + 180) / 360, (90 - lat) / 180);
    const surf = (u, v) => {
      const lon = -180 + 360 * u;
      const lat = 90 - 180 * v;
      return onGlobe(lon, lat, R + Math.max(0, hAt(lon, lat)) * bump);
    };
    k.add(k.param(surf, { grid: 160 }), {
      part: globe,
      even: true,
      share: 0.8,
      flat: 0.25,
      jitter: 0.01,
      color: (c) => {
        const lon = -180 + 360 * c.u;
        const lat = 90 - 180 * c.v;
        return reliefColor(hAt(lon, lat), vec.unit(c.p), c);
      },
    });
    // The quakes: a dot each (bigger for a stronger quake, colored by
    // depth), flashing as the timeline passes its time.
    const ev = S.events;
    const t0 = ev.length ? ev[0][0] : 0;
    const t1 = ev.length ? ev[ev.length - 1][0] : 1;
    k.cloud({ share: 0.12, size: 1 }, (rand, i, n) => {
      const e = ev[Math.floor((i / n) * ev.length)] || [0, 0, 0, 10, 3];
      const m = e[4];
      const rr = 0.009 + 0.006 * Math.max(0, m - 2) ** 1.4;
      const a = rand() * Math.PI * 2;
      const q = Math.sqrt(rand()) * rr;
      const p0 = onGlobe(e[1], e[2], R + Math.max(0, hAt(e[1], e[2])) * bump + 0.006);
      const nrm = vec.unit(p0);
      const t1v = vec.unit(vec.cross(nrm, [0, 1, 0.001]));
      const t2v = vec.cross(nrm, t1v);
      const p = vec.add(p0, vec.add(vec.mul(t1v, Math.cos(a) * q), vec.mul(t2v, Math.sin(a) * q)));
      return {
        p,
        n: nrm,
        color: depthColor(e[3]),
        size: 0.9,
        opacity: 1,
        part: globe,
        kind: "band",
        channel: 0,
        params: [(e[0] - t0) / Math.max(1, t1 - t0), 0.045],
        pattern: false,
      };
    });
    k.data = { quakes: { live: S.live, count: ev.length, fetched: S.fetched.toISOString(), feed: S.feed } }; // prettier-ignore
    // The plaque: the source and the time of the data, with a timeline bar.
    const feedWords = EQ_FEEDS[S.feed].words;
    const lines =
      S.feed === "year"
        ? ["USGS EARTHQUAKE CATALOG", feedWords, `${ev.length} QUAKES, SAVED ${utcWords(S.fetched).split(" AT")[0]}`] // prettier-ignore
        : [S.live ? "USGS LIVE FEED" : "USGS FEED SNAPSHOT", feedWords, `${S.live ? "FETCHED" : "AS OF"} ${utcWords(S.fetched)}`, `${ev.length} QUAKES. TAP HERE TO REFRESH`]; // prettier-ignore
    const PW = 2.5;
    const cols = Math.max(...lines.map((l) => l.length)) * 6;
    const fx = Math.min(0.016, (PW - 0.16) / cols);
    const PH = 0.1 + (lines.length * 10 - 3) * fx;
    const py = -1.25 - PH / 2;
    k.add(k.param((u, v) => [(u - 0.5) * PW, py + (0.5 - v) * PH, 0.4], { grid: 24 }), {
      even: true,
      share: 0.06,
      flat: 0.1,
      color: (c) => {
        const s0 = (c.p[0] + PW / 2 - 0.1) / fx;
        const t0p = (py + PH / 2 - 0.05 - c.p[1]) / fx;
        const ink = inked(lines, s0, t0p);
        return ink ? { c: [0.95, 0.93, 0.86], keep: true, size: 0.7 } : { c: [0.12, 0.13, 0.15], keep: true }; // prettier-ignore
      },
    });
    k.add(k.param((u, v) => [(u - 0.5) * PW, py - PH / 2 - 0.05 + (0.5 - v) * 0.03, 0.4], { grid: 24 }), {
      even: true,
      share: 0.01,
      flat: 0.1,
      color: "#3b3f45",
      kind: "band",
      channel: 0,
      params: (c) => [c.u, 0.02],
      pattern: false,
    });
  },
};

export const RECIPES = {
  "grand-canyon": GRAND_CANYON,
  "st-helens": ST_HELENS,
  "sea-floor": SEA_FLOOR,
  "tide-harbor": TIDE_HARBOR,
  hurricane: HURRICANE,
  "relief-map": RELIEF_MAP,
  "living-city": LIVING_CITY,
  "stork-migration": STORK_MIGRATION,
  earthquakes: EARTHQUAKES,
};

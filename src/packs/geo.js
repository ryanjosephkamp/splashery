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
//   earthquakes   the USGS feed, live when the toy opens or its plaque is
//                 tapped (a dated snapshot ships for when it can't be reached),
//                 on a NOAA ETOPO1 relief globe; the tap plays the quakes in
//                 time order

import { mix, shade, clamp, smoothstep, vec, ramp, quatAxisAngle } from "../kit.js";
import { evenBox, evenCylinder, evenEllipsoid } from "./even.js";
import { loadGeo, geoLoaded, readText } from "../geo/data.js";
import { inked } from "../font.js";
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
  earthquakes: EARTHQUAKES,
};

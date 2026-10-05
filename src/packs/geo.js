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
import { loadGeo, geoLoaded, readText, loadPicture, pictureLoaded } from "../geo/data.js";
import { inked } from "../font.js";
import { frame, addBlock, addGrid, addGridSides, hill } from "../geo/terrain.js";

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

const CREDIT_BLUE_MARBLE = {
  label: "Imagery",
  title: "Blue Marble: Next Generation (true color), through NASA GIBS",
  source: "https://visibleearth.nasa.gov/collection/1484/blue-marble",
  author: "NASA Earth Observatory",
  license: "Public domain",
  licenseUrl: "https://www.earthdata.nasa.gov/engage/open-data-services-software/data-use-policy",
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
  const faces = [(a) => [a, 1], (a) => [1 - a, 0], (a) => [1, 1 - a], (a) => [0, a]];
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

// Round 2: the same water as grids of splats sized to the land's spacing.
function addFloodGrid(k, F, height, { lo, hi, part, spacing, color = "#3f6f78", opacity = 0.92 }) {
  const yLo = F.y(lo);
  const yHi = F.y(hi);
  const sheet = [];
  const st = spacing * 1.6;
  const nx = Math.round((2 * F.sx) / st) + 1;
  const nz = Math.round((2 * F.sz) / st) + 1;
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const u = i / (nx - 1);
      const v = j / (nz - 1);
      if (height(u, v) <= hi + 30) sheet.push([F.x(u), yLo, F.z(v)]);
    }
  const base = () => k.baseSize || 0.01;
  k.cloud({ count: (sheet.length * 160000) / k.count, jitter: 0 }, (_r, i) => {
    const p = sheet[Math.min(sheet.length - 1, i)];
    // Small ripples catching the sky, finer than the grid's spacing would show
    // as a pattern.
    const g = 0.5 + 0.5 * gnoise(p[0] * 90, p[2] * 90, 5);
    return { p, n: [0, 1, 0], flat: 0.15, size: (st * 1.25) / base(), color: shade(mix(color, "#a9c6c4", 0.18 * g * g), 0.92 + 0.12 * g), opacity, part }; // prettier-ignore
  });
  // The water's cut faces: each bit appears as the level passes it.
  const faces = [];
  const edge = (u, v, nrm) => {
    const ground = F.y(height(u, v));
    for (let y = Math.max(yLo, ground); y <= yHi; y += spacing * 0.8)
      faces.push({ p: [F.x(u) + nrm[0] * 0.003, y, F.z(v) + nrm[2] * 0.003], n: nrm });
  };
  const ex = Math.round((2 * F.sx) / spacing) + 1;
  const ez = Math.round((2 * F.sz) / spacing) + 1;
  for (let i = 0; i < ex; i++)
    (edge(i / (ex - 1), 1, [0, 0, 1]), edge(i / (ex - 1), 0, [0, 0, -1]));
  for (let j = 0; j < ez; j++)
    (edge(1, j / (ez - 1), [1, 0, 0]), edge(0, j / (ez - 1), [-1, 0, 0]));
  if (!faces.length) return;
  k.cloud({ count: (faces.length * 160000) / k.count, jitter: 0 }, (_r, i) => {
    const e = faces[Math.min(faces.length - 1, i)];
    const f = clamp((e.p[1] - yLo) / (yHi - yLo), 0, 1);
    return { p: e.p, n: e.n, flat: 0.15, size: spacing / base(), color: shade(color, 0.6 + 0.25 * f), opacity: 0.92, kind: "fade", channel: 0, params: [f, -0.02] }; // prettier-ignore
  });
}

// A flat sheet of water as a grid of splats at height y (recipe units), where
// keep(u, v) says so; and the water's cut faces from yLo to yHi on the block's
// sides, above the ground, each with params(f) for f = its place in 0..1.
function gridSheet(k, F, { y, spacing, keep, color, part, kind, params, opacity = 0.9 }) {
  const pts = [];
  const nx = Math.round((2 * F.sx) / spacing) + 1;
  const nz = Math.round((2 * F.sz) / spacing) + 1;
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const u = i / (nx - 1);
      const v = j / (nz - 1);
      if (!keep || keep(u, v)) pts.push([u, v]);
    }
  if (!pts.length) return;
  const base = () => k.baseSize || 0.01;
  k.cloud({ count: (pts.length * 160000) / k.count, jitter: 0 }, (_r, i) => {
    const [u, v] = pts[Math.min(pts.length - 1, i)];
    const out = { p: [F.x(u), y, F.z(v)], n: [0, 1, 0], flat: 0.15, size: (spacing * 1.2) / base(), color: color(u, v), opacity, part }; // prettier-ignore
    if (kind) ((out.kind = kind), (out.params = params(u, v)));
    return out;
  });
}
function gridFaces(k, F, height, { yLo, yHi, spacing, color, params, channel = 0, opacity = 0.9 }) {
  const faces = [];
  const edge = (u, v, nrm) => {
    const ground = F.y(height(u, v));
    for (let y = Math.max(yLo, ground); y <= yHi; y += spacing * 0.8)
      faces.push({ p: [F.x(u) + nrm[0] * 0.003, y, F.z(v) + nrm[2] * 0.003], n: nrm, f: clamp((y - yLo) / (yHi - yLo), 0, 1) }); // prettier-ignore
  };
  const ex = Math.round((2 * F.sx) / spacing) + 1;
  const ez = Math.round((2 * F.sz) / spacing) + 1;
  for (let i = 0; i < ex; i++)
    (edge(i / (ex - 1), 1, [0, 0, 1]), edge(i / (ex - 1), 0, [0, 0, -1]));
  for (let j = 0; j < ez; j++)
    (edge(1, j / (ez - 1), [1, 0, 0]), edge(0, j / (ez - 1), [-1, 0, 0]));
  if (!faces.length) return;
  const base = () => k.baseSize || 0.01;
  k.cloud({ count: (faces.length * 160000) / k.count, jitter: 0 }, (_r, i) => {
    const e = faces[Math.min(faces.length - 1, i)];
    return { p: e.p, n: e.n, flat: 0.15, size: spacing / base(), color: color(e.f), opacity, kind: "fade", channel, params: params(e.f) }; // prettier-ignore
  });
}

// A smooth hash noise for colors on the grid (-1..1), from the sample's place.
function gnoise(x, y, seed = 0) {
  const h = (a, b) => {
    const t = Math.sin(a * 127.1 + b * 311.7 + seed * 74.7) * 43758.5453;
    return t - Math.floor(t);
  };
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = h(xi, yi) + (h(xi + 1, yi) - h(xi, yi)) * sx;
  const b = h(xi, yi + 1) + (h(xi + 1, yi + 1) - h(xi, yi + 1)) * sx;
  return (a + (b - a) * sy) * 2 - 1;
}

// A flat panel of square pixels facing +Z, one splat each on a regular grid, for crisp text and
// charts (a randomly sampled surface blurs a one-pixel line). (x0, y0) is the top-left corner;
// color(x, y) gives a pixel's color at its center; extra(x, y) adds fields (part, kind ...).
// place(p) moves a point of the panel's plane where it goes (a panel leaning back), n its normal.
function pixelPanel(k, { x0, y0, z, w, h, px, color, extra, place = (p) => p, n = [0, 0, 1] }) {
  const nx = Math.round(w / px);
  const ny = Math.round(h / px);
  const base = () => k.baseSize || 0.01;
  k.cloud({ count: (nx * ny * 160000) / k.count, jitter: 0 }, (_r, i) => {
    const x = x0 + ((i % nx) + 0.5) * px;
    const y = y0 - (Math.floor(i / nx) + 0.5) * px;
    return { p: place([x, y, z]), n, flat: 0.1, size: (px * 1.05) / base(), color: color(x, y), opacity: 1, pattern: false, ...(extra ? extra(x, y) : {}) }; // prettier-ignore
  });
}

// A crisp round dot (a sunflower of splats) with a light rim, facing +Z.
function dot(k, { at, r, color, rim = "#f6f1e4", extra, n: nrm = [0, 0, 1] }) {
  const u = vec.unit(vec.cross(Math.abs(nrm[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0], nrm));
  const v = vec.cross(nrm, u);
  const n = 90;
  const base = () => k.baseSize || 0.01;
  k.cloud({ count: (n * 160000) / k.count, jitter: 0 }, (_r, i) => {
    const rr = r * Math.sqrt((i + 0.5) / n);
    const a = i * 2.399963;
    const edge = rr > r * 0.78;
    const c = Math.cos(a) * rr;
    const s = Math.sin(a) * rr;
    return { p: [at[0] + u[0] * c + v[0] * s, at[1] + u[1] * c + v[1] * s, at[2] + u[2] * c + v[2] * s], n: nrm, flat: 0.1, size: (r * 1.9) / Math.sqrt(n) / base(), color: edge ? rim : color, opacity: 1, pattern: false, ...(extra || {}) }; // prettier-ignore
  });
}

// ---- Grand Canyon ------------------------------------------------------------------------

const GC_FILE = "assets/toys/grand-canyon/terrain.bin.gz";
const GC_PIC = "assets/toys/grand-canyon/color.jpg";
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
  density: 2,
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
    await Promise.all([loadGeo(GC_FILE), loadPicture(GC_PIC)]);
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
    const img = pictureLoaded(GC_PIC);
    const F = frame({ span: g.meta.span, exag: Number(o.exag) || 2, lo: H.min - 250, depth: 0.12 }); // prettier-ignore
    const height = H.sample;
    const water = k.part("water");
    const land = addGrid(k, {
      F,
      height,
      share: 0.78,
      color: (c) => {
        if (c.wall) return shade(gcRock(c.m), 0.55 + 0.35 * Math.max(0, vec.dot(c.n, [-0.6, 0.2, 0.75]))); // prettier-ignore
        const base = img.sample(c.u, c.v);
        return shade(mix(base, [0.72, 0.6, 0.5], 0.06), 0.9 * hill(c.n, 0.3) + 0.12);
      },
    });
    addGridSides(k, F, height, { spacing: land.spacing, side: (m) => gcRock(m) });
    const lo = H.min + 4;
    const hi = H.min + 0.5 * (H.max - H.min);
    addFloodGrid(k, F, height, { lo, hi, part: water, spacing: land.spacing, color: "#3e6158" });
    k.data = { yLo: F.y(lo), yHi: F.y(hi), grid: land };
  },
};

// ---- Mount St. Helens --------------------------------------------------------------------

const MSH_FILE = "assets/toys/st-helens/terrain.bin.gz";
const MSH_PIC = "assets/toys/st-helens/color.jpg";
const MSH_T = 6;
const PLUME = 10; // the ash column's segments (parts), from the vent up
const PLUME_H = 0.9; // the column's height (recipe units; the real one rose about 24 km)
const BLAST = 10; // the lateral blast's dark clouds (tokens)
const PLUME_SUN = vec.unit([-0.55, 0.7, 0.45]); // the morning sun, from the southeast-ish front left

// The ash column, segment by segment: its height, its radius, and whether it is the umbrella
// at the top, where the column stops rising and spreads.
function plumeSeg(j) {
  const f = j / (PLUME - 1);
  const h = 0.06 + f * PLUME_H * 0.88;
  const top = j >= PLUME - 2;
  const r = top ? 0.2 + 0.1 * (j - (PLUME - 2)) : 0.045 + 0.13 * f;
  return { h, r, top, f };
}

// 1979's colors from height: forest, then alpine meadow and rock, then snow.
function mshBefore(m, n, u, v) {
  const forest = mix("#2a4428", "#3d5a33", 0.5 + 0.5 * gnoise(u * 160, v * 160, 1));
  const rock = "#7c7368";
  const snow = "#eef1f4";
  let col = shade(forest, 0.9 + 0.12 * gnoise(u * 600, v * 600, 2));
  col = mix(col, rock, smoothstep(1350, 1650, m + 120 * gnoise(u * 40, v * 40, 3)));
  col = mix(col, snow, smoothstep(1750, 2050, m + 150 * gnoise(u * 50, v * 50, 7)) * clamp(0.4 + n[1], 0, 1)); // prettier-ignore
  // Spirit Lake (north-northeast of the summit).
  return shade(col, hill(n, 0.45));
}

const ST_HELENS = {
  alive: false,
  density: 2,
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
    await Promise.all([loadGeo(MSH_FILE), loadPicture(MSH_PIC)]);
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
    // The ash column: each segment rises from the vent to its height, swelling as it rises,
    // then billows (turns slowly, each the other way from its neighbors) and drifts east on the
    // wind, more the higher it is. At the end the wind carries it off and it thins away.
    const away = ease(seg(s, MSH_T - 1.4, MSH_T - 0.15));
    for (let j = 0; j < PLUME; j++) {
      const P = plumeSeg(j);
      const at = 0.75 + j * 0.2;
      const p = ease(seg(s, at, at + 1.3));
      const age = Math.max(0, s - at);
      const drift = (0.03 + 0.12 * P.f) * age + 1.6 * away * away * (0.5 + P.f);
      out.parts[`plume${j}`] = {
        offset: [drift, -(1 - p) * P.h, 0.02 * Math.sin(age * 0.9 + j)],
        quat: quatAxisAngle([0, 1, 0], (j % 2 ? 1 : -1) * (0.18 * age + 0.4 * p)),
        scale: 0.3 + 0.7 * p + 0.04 * age,
        // Shown whole or not at all (a part shown in part draws as a speckle).
        visible: going && age > 0 && p > 0.02 && away < 0.98 ? 1 : 0,
      };
    }
    // The lateral blast: low dark clouds racing north over the ridges.
    for (let i = 0; i < BLAST; i++) {
      const jit = (i * 0.618034) % 1; // each cloud its own reach and moment
      const age = s - 0.5 - 0.25 * jit;
      const run = clamp(age / (1.3 + 0.5 * jit), 0, 1);
      const a = (-0.5 + i / (BLAST - 1)) * 1.6 + 0.15 * (jit - 0.5); // a fan about north
      const r = 0.12 + (0.5 + 0.45 * ((i * 0.381966) % 1)) * ease(run);
      tokens.push({
        base: C,
        // Racing out over the ridges, then settling into the ground as ash.
        offset: [
          Math.sin(a) * r,
          -0.12 - 0.05 * run - 0.2 * ease(seg(age, 1.3, 2.2)),
          -Math.cos(a) * r,
        ],
        visible: going && age > 0 && age < 2.2 ? 1 : 0,
      });
    }
    out.tokens = tokens;
    resortWhileMoving(out, d, s, going);
    sortWhileMoving(out, d, s, going, 0.3);
  },
  build(k) {
    const g = geoLoaded(MSH_FILE);
    const B = g.layer("before");
    const A = g.layer("after");
    const img = pictureLoaded(MSH_PIC);
    const lo = Math.min(B.min, A.min) - 150;
    const F = frame({ span: g.meta.span, exag: 1.5, lo, depth: 0.08 });
    const crater = [F.x(0.5), F.y(A.sample(0.5, 0.5)) + 0.02, F.z(0.47)];
    k.data = { crater, state: { last: 0, dir: 1 } };
    // 1979: the old cone, which morphs down under today's land (so the 1980
    // surface covers it) and is then hidden.
    const old = addGrid(k, {
      F,
      height: B.sample,
      share: 0.46,
      part: k.part("old"),
      cliffs: false, // the old cone has no cliffs, and it is hidden after the fall
      channel: 0,
      to: (c) => [c.p[0], F.y(A.sample(c.u, c.v)) - 0.05, c.p[2]],
      color: (c) => (c.wall ? shade("#6b6259", 0.7) : mshBefore(c.m, c.n, c.u, c.v)),
    });
    addGridSides(k, F, B.sample, { spacing: old.spacing, side: (m) => mix("#4a3d33", "#6e604f", smoothstep(lo, lo + 900, m)) }); // prettier-ignore
    // 1980 onward: today's surface, colored from the imagery, appearing from
    // the crater outward as the blast passes.
    addGrid(k, {
      F,
      height: A.sample,
      share: 0.4,
      kind: "fade",
      channel: 0,
      params: (c) => {
        const r = Math.hypot(c.u - 0.5, (c.v - 0.47) * 1.15);
        const north = c.v < 0.5 ? 0 : 0.15;
        return [clamp(0.15 + 1.3 * r + north, 0.05, 0.98), -0.06];
      },
      color: (c) => (c.wall ? shade("#6e665d", 0.75) : shade(img.sample(c.u, c.v), 0.9 * hill(c.n, 0.3) + 0.1)), // prettier-ignore
    });
    // The ash column: each segment a ring of cauliflower billows (balls of smaller balls, their
    // surfaces only, so the edges stay crisp), lit by the sun on one side and in its own shadow
    // on the other; dark and dense near the vent, paler and steamier higher up.
    const base = () => k.baseSize || 0.01;
    const billow = (part, c, r, tone, n, rand) => {
      // A ball with lumps on it, and smaller lumps on those: cauliflower.
      const subs = [[0, 0, 0, r]];
      for (let j = 0; j < 7; j++) {
        const d = vec.unit([rand() - 0.5, rand() * 0.9 - 0.15, rand() - 0.5]);
        const sr = r * (0.38 + 0.18 * rand());
        subs.push([d[0] * r * 0.85, d[1] * r * 0.85, d[2] * r * 0.85, sr]);
        const d2 = vec.unit([d[0] + rand() - 0.5, d[1] + rand() * 0.6, d[2] + rand() - 0.5]);
        subs.push([d[0] * r * 0.85 + d2[0] * sr * 0.8, d[1] * r * 0.85 + d2[1] * sr * 0.8, d[2] * r * 0.85 + d2[2] * sr * 0.8, sr * 0.5]); // prettier-ignore
      }
      const area = subs.reduce((s, q) => s + q[3] * q[3], 0);
      const pts = [];
      for (const q of subs) {
        const m = Math.max(12, Math.round((n * q[3] * q[3]) / area));
        for (let i = 0; i < m; i++) {
          const y = 1 - (2 * (i + 0.5)) / m;
          const rr = Math.sqrt(1 - y * y);
          const nrm = [
            Math.cos(i * 2.39996 + q[3] * 50) * rr,
            y,
            Math.sin(i * 2.39996 + q[3] * 50) * rr,
          ];
          const p = [
            c[0] + q[0] + nrm[0] * q[3],
            c[1] + q[1] + nrm[1] * q[3],
            c[2] + q[2] + nrm[2] * q[3],
          ];
          // Inside another ball: hidden, so leave it out.
          if (subs.some((o) => o !== q && Math.hypot(p[0] - c[0] - o[0], p[1] - c[1] - o[1], p[2] - c[2] - o[2]) < o[3] * 0.97)) continue; // prettier-ignore
          const sun = Math.max(0, vec.dot(nrm, PLUME_SUN));
          const under = Math.max(0, -nrm[1]);
          // Darker in the creases between lumps (near the ball's center line).
          const crease = clamp(
            Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) / (r * 1.1),
            0.55,
            1,
          );
          const lit = (0.36 + 0.78 * sun - 0.2 * under) * (0.7 + 0.3 * crease);
          pts.push({ p, n: nrm, size: (q[3] * 3.1) / Math.sqrt(m), lit });
        }
      }
      return pts.map((q) => ({ ...q, part, tone }));
    };
    const plume = [];
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let j = 0; j < PLUME; j++) {
      const P = plumeSeg(j);
      const pivot = [crater[0], crater[1] + P.h, crater[2]];
      const part = k.part(`plume${j}`, { pivot, axis: [0, 1, 0] });
      // Dark gray-brown ash low down, paler gray above.
      const tone = mix("#3f3a35", "#a39a8f", Math.pow(P.f, 0.8));
      const balls = P.top ? 9 : 5 + Math.round(3 * P.f);
      for (let b = 0; b < balls; b++) {
        const a = b * 2.39996 + j * 0.9;
        const ring = P.top ? P.r * (0.25 + 0.75 * Math.sqrt((b + 0.5) / balls)) : P.r * 0.55;
        const c = [pivot[0] + Math.cos(a) * ring, pivot[1] + (P.top ? (rand() - 0.5) * 0.05 : (rand() - 0.5) * 0.06), pivot[2] + Math.sin(a) * ring * 0.8]; // prettier-ignore
        const br = P.top ? 0.075 + 0.03 * rand() : P.r * (0.55 + 0.2 * rand());
        plume.push(...billow(part, c, br, tone, Math.round(0.0012 * k.count), rand));
      }
    }
    k.cloud({ count: (plume.length * 160000) / k.count, jitter: 0 }, (_r, i) => {
      const q = plume[Math.min(plume.length - 1, i)];
      return { p: q.p, n: q.n, flat: 0.35, size: q.size / base(), color: shade(q.tone, q.lit), opacity: 0.97, part: q.part, pattern: false }; // prettier-ignore
    });
    // The lateral blast's clouds: low dark billows, one token each, hidden at rest.
    const blastPts = [];
    for (let i = 0; i < BLAST; i++)
      for (const q of billow(null, crater, 0.045 + 0.04 * ((i * 0.618034) % 1), "#4a443e", Math.round(0.0015 * k.count), rand)) // prettier-ignore
        blastPts.push({ ...q, token: i });
    k.cloud({ count: (blastPts.length * 160000) / k.count, jitter: 0 }, (_r, i) => {
      const q = blastPts[Math.min(blastPts.length - 1, i)];
      return { p: q.p, n: q.n, flat: 0.35, size: q.size / base(), color: shade(q.tone, q.lit), opacity: 0.95, kind: "token", params: [q.token, 0], pattern: false }; // prettier-ignore
    });
    k.reach([crater[0], crater[1] + 0.7, crater[2]]);
  },
};

// ---- The sea floor -------------------------------------------------------------------------

const SF_FILE = "assets/toys/sea-floor/terrain.bin.gz";
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
  density: 2,
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
    const land = addGrid(k, {
      F,
      height,
      share: 0.66,
      color: (c) => shade(seaColor(c.m), c.wall ? 0.6 : 0.9 * hill(c.n, 0.4)),
    });
    addGridSides(k, F, height, { spacing: land.spacing, side: (m) => (m > -6000 ? mix("#5d5144", "#3f3d3c", smoothstep(-6000, -1500, m)) : mix("#2b2a2e", "#3f3d3c", smoothstep(-11000, -6000, m))) }); // prettier-ignore
    const ySea = F.y(0);
    const yDeep = F.y(H.min) - 0.01;
    const sea = k.part("sea");
    // The ocean's surface: a gently heaving sheet at sea level, over every
    // place that is under water.
    gridSheet(k, F, {
      y: ySea,
      spacing: land.spacing * 1.5,
      keep: (u, v) => height(u, v) <= 20,
      part: sea,
      opacity: 0.86,
      kind: "wave",
      params: (u, v) => [0.004, u * 9 + v * 5],
      color: (u, v) => mix("#1f4f7a", "#5d93b8", 0.25 + 0.2 * gnoise(u * 30, v * 30, 2)),
    });
    // The water's cut faces, which drop away as the level passes them.
    gridFaces(k, F, height, {
      yLo: yDeep,
      yHi: ySea,
      spacing: land.spacing,
      opacity: 0.88,
      color: (f) => mix("#0f2747", "#3c74a3", f),
      params: (f) => [clamp(1 - f, 0, 1) - 0.01, 0.02],
    });
    k.data = { ySea, yDeep };
  },
};

// ---- Waves and tides: Bar Harbor ---------------------------------------------------------

const TH_FILE = "assets/toys/tide-harbor/terrain.bin.gz";
const TH_PIC = "assets/toys/tide-harbor/color.jpg";
const TH_T = 12;
const TH_FLOOR = -12; // the block's deep water is cut off here (m)
// Three moorings in water deep at every tide (u, v), with each boat's heading.
const TH_BOATS = [
  [0.94, 0.47, 0.6, "#c9452f"],
  [0.2, 0.33, -0.4, "#f2efe6"],
  [0.3, 0.05, 1.9, "#2f5d8a"],
];

export function tideAt(levels, f) {
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
  density: 2,
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
    await Promise.all([loadGeo(TH_FILE), loadPicture(TH_PIC)]);
  },
  drive(t, c, out, info) {
    const d = info.data;
    const s = c.day > 0 ? (1 - c.day) * TH_T : TH_T;
    const f = c.day > 0 ? clamp((s - 0.3) / (TH_T - 1.1), 0, 1) : 0;
    // The marker slides back to the start of the curve once the day is over.
    const mk = f * (1 - ease(seg(s, TH_T - 0.75, TH_T - 0.1)));
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
    out.tokens = [{ base: d.plot.at(0, d.levels[0]), offset: vec.sub(d.plot.at(mk, tideAt(d.levels, mk)), d.plot.at(0, d.levels[0])) }]; // prettier-ignore
    sortWhileMoving(out, d, s, c.day > 0 && s < TH_T - 0.1, 0.6);
    resortWhileMoving(out, d, s, c.day > 0 && s < TH_T - 0.1, 0.6);
  },
  build(k) {
    const g = geoLoaded(TH_FILE);
    const H = g.layer("height");
    const img = pictureLoaded(TH_PIC);
    const levels = Array.from(g.layer("tide").data);
    const low = Math.min(...levels) - 0.05;
    const high = Math.max(...levels);
    const F = frame({ span: g.meta.span, exag: 6, lo: TH_FLOOR, depth: 0.05 });
    const height = (u, v) => Math.max(TH_FLOOR + 0.5, H.sample(u, v));
    const land = addGrid(k, {
      F,
      height,
      share: 0.66,
      color: (c) => (c.wall ? shade(shoreColor(c.m, img.sample(c.u, c.v), [0, 1, 0]), 0.7) : shoreColor(c.m, img.sample(c.u, c.v), c.n)), // prettier-ignore
    });
    addGridSides(k, F, height, { spacing: land.spacing, side: (m) => (m > 0 ? mix("#6a5a45", "#7d6a52", smoothstep(0, 40, m)) : mix("#3b3a36", "#5c5145", smoothstep(TH_FLOOR, 0, m))) }); // prettier-ignore
    // The sea: a sheet at the lowest tide that rises and falls with the curve,
    // its surface heaving in small waves.
    const water = k.part("water");
    const yLow = F.y(low);
    gridSheet(k, F, {
      y: yLow,
      spacing: land.spacing * 1.3,
      keep: (u, v) => height(u, v) <= high + 0.6,
      part: water,
      opacity: 0.84,
      kind: "wave",
      params: (u, v) => [0.0035, u * 34 - v * 12],
      color: (u, v) => {
        const g = 0.5 + 0.5 * gnoise(u * 140, v * 140, 4);
        return shade(mix("#2a4d57", "#8fb1b5", 0.12 + 0.2 * g * g), 0.92 + 0.1 * g);
      },
    });
    // The water's cut faces: each bit shows while the tide is above it.
    const yFloor = F.y(TH_FLOOR);
    const yHigh = F.y(high);
    gridFaces(k, F, height, {
      yLo: yFloor,
      yHi: yHigh,
      spacing: land.spacing,
      opacity: 0.88,
      color: (f) => mix("#1f3c48", "#3f6b78", f),
      params: (f) => [F.m(yFloor + f * (yHigh - yFloor)) - levels[0], 0.12],
    });
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
    // The tide meter: the day's tide curve on a chart of square pixels (crisp at phone size),
    // the water under the curve filled, lines every six hours and at mean sea level, and the
    // hours written under it. A dot rides the curve through the day.
    const pw = 1.4;
    const ph = 0.22;
    const pz = F.z(1) + 0.18;
    const py = F.bottom - 0.02;
    const PX = 0.004;
    // The meter leans back to face the viewer, who looks down on the harbor.
    const LEAN = 0.6;
    const lean = ([x, y, z]) => [x, py - (py - y) * Math.cos(LEAN), z + (py - y) * Math.sin(LEAN)]; // prettier-ignore
    const leanN = [0, Math.sin(LEAN), Math.cos(LEAN)];
    const flatAt = (f, m) => [-pw / 2 + 0.05 + f * (pw - 0.1), py - ph + 0.03 + ((m - low) / (high - low)) * (ph - 0.06), pz]; // prettier-ignore
    const plot = {
      at: (f, m) => vec.add(lean(flatAt(f, m)), vec.mul(leanN, 0.004)),
    };
    const hours = ["0H", "6H", "12H", "18H", "24H"];
    const LH = 0.06; // the labels' strip under the chart
    pixelPanel(k, {
      x0: -pw / 2,
      y0: py,
      z: pz,
      w: pw,
      h: ph + LH,
      px: PX,
      place: lean,
      n: leanN,
      color: (x, y) => {
        const f = (x + pw / 2 - 0.05) / (pw - 0.1);
        if (y < py - ph) {
          // An hour label, centered under its line, in 2 x 2 pixel letters.
          for (let j = 0; j < hours.length; j++) {
            const hx = flatAt((j * 6) / 24.9, 0)[0];
            const s = (x - hx) / (2 * PX) + (hours[j].length * 6 - 1) / 2;
            if (inked([hours[j]], s, (py - ph - 0.012 - y) / (2 * PX))) return [0.78, 0.8, 0.82];
          }
          return [0.09, 0.1, 0.12];
        }
        if (f < 0 || f > 1) return [0.09, 0.1, 0.12];
        const cy = flatAt(f, tideAt(levels, f))[1];
        if (Math.abs(y - cy) < PX * 0.9) return [0.62, 0.9, 0.96];
        const hour = f * 24.9;
        const grid = Math.abs(hour - 6 * Math.round(hour / 6)) * ((pw - 0.1) / 24.9) < PX * 0.5;
        const mean = Math.abs(y - flatAt(0, 0)[1]) < PX * 0.5;
        if (y < cy) return grid || mean ? [0.24, 0.42, 0.48] : [0.13, 0.28, 0.34];
        return grid || mean ? [0.3, 0.33, 0.37] : [0.11, 0.12, 0.15];
      },
    });
    const m0 = vec.add(plot.at(0, levels[0]), vec.mul(leanN, 0.002));
    dot(k, { at: m0, n: leanN, r: 0.014, color: "#ffd25a", extra: { kind: "token", params: [0, 0] } }); // prettier-ignore
    k.data = { levels, low, k: F.k, boats, plot };
  },
};

// ---- Weather over land: Hurricane Polo --------------------------------------------------

const HU_FILE = "assets/toys/hurricane/storm.bin.gz";
const HU_PIC = "assets/toys/hurricane/color.jpg";
const HU_T = 10;
const HU_RINGS = [1.1, 2.6, 99]; // ring edges, degrees from the eye
const HU_SPIN = [0.55, 0.28, 0.12]; // radians per second at the start of the day

const HURRICANE = {
  alive: true,
  density: 2,
  kernel: "sharp",
  credits: [
    {
      label: "Clouds",
      title: "GOES-East ABI band 13 (clean infrared), through NASA GIBS",
      source: "https://www.star.nesdis.noaa.gov/GOES/",
      author: "NOAA NESDIS (imagery served by NASA's Global Imagery Browse Services)",
      license: "Public domain",
      licenseUrl:
        "https://www.earthdata.nasa.gov/engage/open-data-services-software/data-use-policy",
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
      title: "Blue Marble: Next Generation (true color), through NASA GIBS",
      source: "https://visibleearth.nasa.gov/collection/1484/blue-marble",
      author: "NASA Earth Observatory",
      license: "Public domain",
      licenseUrl:
        "https://www.earthdata.nasa.gov/engage/open-data-services-software/data-use-policy",
    },
    CREDIT_ETOPO,
  ],
  controls: [{ key: "day", label: "September 22", type: "toggle", default: 0, ease: HU_T }],
  action: { key: "day", label: "Play the day it grew" },
  async prepare() {
    await Promise.all([loadGeo(HU_FILE), loadPicture(HU_PIC)]);
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
    const img = pictureLoaded(HU_PIC);
    const F = frame({ span: M.span, exag: 14, lo: 0, depth: 0.04 });
    const [w, s, e, nn] = M.map;
    const uOf = (lon) => (lon - w) / (e - w);
    const vOf = (lat) => (nn - lat) / (nn - s);
    const XZ = (lon, lat) => [F.x(uOf(lon)), F.z(vOf(lat))];
    const ground = (u, v) => Math.max(0, H.sample(u, v));
    const map = addGrid(k, {
      F,
      height: ground,
      share: 0.3,
      color: (c) => shade(img.sample(c.u, c.v), (c.wall ? 0.6 : 0.9 * hill(c.n, 0.3)) + 0.16),
    });
    addGridSides(k, F, ground, { spacing: map.spacing, side: (m) => mix("#3c4a5a", "#5a5145", smoothstep(-100, 100, m)) }); // prettier-ignore
    // The clouds: each infrared square becomes a deck of cloud tops, as high
    // as their temperature says (about 6.5 °C colder per kilometer up), split
    // into rings that turn about the eye. The start fades as the end comes in.
    const eye0 = M.track[0];
    const [ex, ez] = XZ(eye0.lon, eye0.lat);
    const kCloud = F.k * 0.5; // clouds at half the land's exaggeration
    const rings = HU_RINGS.map((_, r) =>
      k.part(`ring${r}`, { pivot: [ex, 0, ez], axis: [0, 1, 0] }),
    );
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
      // Every infrared pixel that is cloud becomes one flat splat at its
      // cloud-top height, sized to the pixel (thinned evenly to fit the budget).
      const pts = [];
      const want = 0.3 * k.count;
      let cloudy = 0;
      for (let j = 0; j < L.h; j++) for (let i = 0; i < L.w; i++) if (L.data[j * L.w + i] - 100 <= 6) cloudy++; // prettier-ignore
      const stride = Math.max(1, Math.ceil(Math.sqrt(cloudy / want)));
      const px = ((be - bw) / L.w) * stride; // degrees a splat covers
      const [x1] = XZ(eye0.lon + px, eye0.lat);
      const step = Math.abs(x1 - ex) * Math.cos((eye0.lat * Math.PI) / 180);
      for (let j = 0; j < L.h; j += stride)
        for (let i = 0; i < L.w; i += stride) {
          const u = i / (L.w - 1);
          const v = j / (L.h - 1);
          const t0 = T(u, v);
          if (t0 > 6) continue;
          const lon = bw + (be - bw) * u;
          const lat = bn - (bn - bs) * v;
          const deg = Math.hypot(lon - clon, lat - clat);
          if (deg > 5) continue;
          // Placed so this frame's eye sits on the start's eye.
          const [x, z] = XZ(eye0.lon + (lon - clon), eye0.lat + (lat - clat));
          const e2 = stride / L.w;
          const gx = top(T(u + e2, v)) - top(T(u - e2, v));
          const gz = top(T(u, v + e2)) - top(T(u, v - e2));
          const lit = clamp(0.88 - (gx - gz) * 0.0001, 0.5, 1.15);
          const white = smoothstep(-10, -75, t0);
          pts.push({ p: [x, top(t0) * kCloud + 0.004, z], col: shade(mix([0.55, 0.58, 0.62], [0.97, 0.97, 0.99], white), lit), white, deg, at: 0.25 + 0.15 * (deg / 5) + 0.35 * (((i * 7919 + j * 104729) % 1000) / 1000) }); // prettier-ignore
        }
      const base = () => k.baseSize || 0.01;
      k.cloud({ count: (pts.length * 160000) / k.count, jitter: 0 }, (_r, idx) => {
        const e = pts[Math.min(pts.length - 1, idx)];
        return {
          p: e.p,
          color: e.col,
          size: (step * 1.15) / base(),
          opacity: (0.35 + 0.63 * e.white) * smoothstep(5, 3.8, e.deg),
          n: [0, 1, 0],
          flat: 0.35,
          part: ringOf(e.deg),
          kind: "fade",
          channel: 0,
          params: [e.at, fi ? -0.18 : 0.18],
        };
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
      k.add(k.disc(0.012), { pos: [x, 0.003, z], color: mix("#ffd25a", "#ff5a3c", (pnt.kt - 70) / 85), share: 0.002, flat: 0.1, even: true, pattern: false }); // prettier-ignore
    }
    k.data = {
      track: M.track.map((pnt) => [...XZ(pnt.lon, pnt.lat), pnt.kt]),
      ang: HU_SPIN.map(() => 0),
      last: null,
    };
  },
};

// ---- A relief map: Yosemite Valley ---------------------------------------------------------

const RM_FILE = "assets/toys/relief-map/terrain.bin.gz";
const RM_PICS = {
  photo: "assets/toys/relief-map/color.jpg",
  land: "assets/toys/relief-map/land.jpg",
};
const RM_T = 7;

// A hypsometric tint, as on a printed relief map.
const TINT = ["#4f7a45", "#7a9a56", "#b8b77a", "#c9a776", "#a98665", "#d9d1c4", "#f4f2ee"];

const RELIEF_MAP = {
  alive: false,
  density: 2,
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
  async prepare(o) {
    await Promise.all([loadGeo(RM_FILE), RM_PICS[o?.look] ? loadPicture(RM_PICS[o.look]) : null]);
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
    const pic = RM_PICS[o.look] ? pictureLoaded(RM_PICS[o.look]) : null;
    const F = frame({ span: g.meta.span, exag: 1.5, lo: H.min - 300, depth: 0.08 });
    const norm = (m) => (m - H.min) / (H.max - H.min);
    k.data = { look: o.look };
    const du = 1 / H.w;
    const mPerU = g.meta.span[0];
    const mPerV = g.meta.span[1];
    const grid = addGrid(k, {
      F,
      height: H.sample,
      share: 0.84,
      kind: "band",
      channel: 0,
      params: (c) => [norm(c.m), 0.008],
      pattern: false,
      color: (c) => {
        const m = c.m;
        let col = pic ? pic.sample(c.u, c.v) : ramp(TINT, norm(m));
        if (c.wall) return shade(col, 0.6);
        col = shade(col, (pic && o.look === "photo" ? 0.95 : 0.8) * hill(c.n, 0.45) + 0.05);
        if (o.contours !== false) {
          // A line every 100 m, heavier every 500 m, about as wide anywhere.
          const gx = (H.sample(c.u + du, c.v) - H.sample(c.u - du, c.v)) / (2 * du * mPerU);
          const gz = (H.sample(c.u, c.v + du) - H.sample(c.u, c.v - du)) / (2 * du * mPerV);
          const grad = Math.hypot(gx, gz);
          const near = (step) => {
            const rr = ((m % step) + step) % step;
            return Math.min(rr, step - rr);
          };
          const w = Math.max(2.5, 22 * grad);
          if (near(500) < w * 1.4) return shade(col, 0.42);
          if (near(100) < w) return shade(col, 0.66);
        }
        return col;
      },
    });
    addGridSides(k, F, H.sample, { spacing: grid.spacing, side: (m) => mix("#6b6258", "#8f857a", smoothstep(H.min - 300, H.max, m)) }); // prettier-ignore
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
      void total;
      const on = (u, v, lift) => [F.x(u), F.y(H.sample(u, v)) + lift, F.z(v)];
      // Evenly spaced splats along every line, sized to the land's grid.
      const pts = [];
      for (const sg of segs) {
        const pa = on(sg.a[0], sg.a[1], 0.003);
        const pb = on(sg.b[0], sg.b[1], 0.003);
        const len = vec.len(vec.sub(pb, pa));
        const n = Math.max(1, Math.ceil(len / (grid.spacing * 0.55)));
        const dir = vec.unit(vec.sub(pb, pa));
        for (let i = 0; i < n; i++) {
          const f = i / n;
          const u = sg.a[0] + (sg.b[0] - sg.a[0]) * f;
          const v = sg.a[1] + (sg.b[1] - sg.a[1]) * f;
          pts.push({ p: on(u, v, 0.003), dir, main: sg.main, at: 1 - norm(H.sample(u, v)) });
        }
      }
      const base = () => k.baseSize || 0.01;
      k.cloud({ count: (pts.length * 160000) / k.count, jitter: 0 }, (_r, i) => {
        const e = pts[Math.min(pts.length - 1, i)];
        return {
          p: e.p,
          n: [0, 1, 0],
          flat: 0.2,
          color: e.main ? [0.16, 0.4, 0.82] : [0.22, 0.52, 0.9],
          size: (grid.spacing * (e.main ? 1.5 : 0.95)) / base(),
          opacity: 1,
          kind: "band",
          channel: 1,
          params: [e.at, 0.04],
          pattern: false,
        };
      });
    }
  },
};

// ---- A living city: a block of central Helsinki -----------------------------------------------

// The City of Helsinki's reality mesh (2017 aerial photogrammetry, CC BY 4.0), cropped by
// tools/geo-city.mjs to 550 m round Senate Square, the Cathedral and the Market Square and
// sampled into splats. The tap turns day to night: the daylight city fades to its dark blue
// night copy as the street lights, the windows and the harbor's lights come on.
const LC_FILE = "assets/toys/living-city/city.bin.gz";
const CREDIT_HELSINKI = {
  label: "City",
  title: "Helsinki 3D reality mesh (2017), central Helsinki",
  source: "https://hri.fi/data/en_GB/dataset/helsingin-3d-kaupunkimalli",
  author: "City of Helsinki",
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
};
const LC_SHARE = 2.0; // the day city's splats against k.count
const lcRand = (i, s) => {
  const t = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453;
  return t - Math.floor(t);
};

const LIVING_CITY = {
  alive: true,
  density: 2,
  kernel: "sharp",
  controls: [{ key: "night", label: "Night", type: "toggle", default: 0, ease: 4.5 }],
  action: { key: "night", label: "Day or night" },
  credits: [CREDIT_HELSINKI],
  async prepare() {
    await loadGeo(LC_FILE);
  },
  drive(t, c, out) {
    out.morph = [c.night, 0, 0, 0];
  },
  build(k) {
    const g = geoLoaded(LC_FILE);
    const { span, count } = g.meta;
    // Each array is stored a byte plane at a time, the positions as differences.
    const interleave = (bytes, k) => {
      const out = new Uint8Array(count * k);
      for (let j = 0; j < k; j++) for (let i = 0; i < count; i++) out[i * k + j] = bytes[j * count + i]; // prettier-ignore
      return out;
    };
    const P = new Uint16Array(interleave(g.layer("pos").data, 6).buffer);
    for (let i = 3; i < count * 3; i++) P[i] = (P[i] + P[i - 3]) & 0xffff;
    const N = new Int8Array(interleave(g.layer("nrm").data, 3).buffer);
    const C = interleave(g.layer("rgb").data, 3);
    const S = g.layer("size").data;
    const m = 2 / Math.max(span[0], span[2]); // recipe units per meter
    // Ground level: the low end of what is mostly street and square.
    const yAt = (i) => (P[i * 3 + 1] / 65535) * span[1];
    const hs = [];
    for (let i = 0; i < count; i += 97) hs.push(yAt(i));
    hs.sort((a, b) => a - b);
    const ground = hs[Math.floor(hs.length * 0.04)];
    const at = (i) => [
      (P[i * 3] / 65535 - 0.5) * span[0] * m,
      (yAt(i) - ground) * m,
      (P[i * 3 + 2] / 65535 - 0.5) * span[2] * m,
    ];
    const nrm = (i) => vec.unit([N[i * 3] / 127, N[i * 3 + 1] / 127, N[i * 3 + 2] / 127]);
    const meters = (i) => 0.02 * Math.pow(250, S[i] / 255);
    const base = () => k.baseSize || 0.01;
    // The day city: as many of the samples as the budget allows, each grown to cover the
    // ones left out.
    const use = Math.min(count, Math.round(k.count * LC_SHARE));
    const stride = count / use;
    const grow = Math.sqrt(stride);
    const pick = (j) => Math.min(count - 1, Math.floor(j * stride));
    const col = (i) => [C[i * 3] / 255, C[i * 3 + 1] / 255, C[i * 3 + 2] / 255];
    k.cloud({ count: (use * 160000) / k.count, jitter: 0 }, (_r, j) => {
      const i = pick(j);
      return { p: at(i), n: nrm(i), flat: 0.14, size: (meters(i) * m * grow) / base(), color: col(i), opacity: 1, kind: "fade", channel: 0, params: [0.45 + 0.25 * lcRand(i, 1), 0.3] }; // prettier-ignore
    });
    // The lights: lamps along the streets and squares (not on the water, which lies lowest)
    // and windows on the walls, each coming on at its own moment of the dusk.
    const lights = [];
    const lamps = new Map(); // 12 m cells -> lamp positions in meters, for the pools of light
    const cell = (x, z) => `${Math.floor(x / 12)},${Math.floor(z / 12)}`;
    const meterAt = (i) => [(P[i * 3] / 65535) * span[0], yAt(i) - ground, (P[i * 3 + 2] / 65535) * span[2]]; // prettier-ignore
    for (let i = 0; i < count; i += 3) {
      const n = N[i * 3 + 1] / 127;
      const y = yAt(i) - ground;
      const [r, gg, b] = col(i);
      const gray = Math.abs(r - gg) < 0.05 && Math.abs(gg - b) < 0.06 && gg - r < 0.02;
      if (Math.abs(n) < 0.25 && y > 4 && lcRand(i, 3) < 0.07) lights.push([i, "window"]);
      else if (n > 0.9 && y > 1.2 && y < 6 && gray && r > 0.3 && lcRand(i, 4) < 0.003) {
        lights.push([i, "lamp"]);
        const q = meterAt(i);
        const key = cell(q[0], q[2]);
        if (!lamps.has(key)) lamps.set(key, []);
        lamps.get(key).push(q);
      }
    }
    // How much lamplight falls on a point (0..1): warm pools round each lamp.
    const pool = (q) => {
      let s = 0;
      const cx = Math.floor(q[0] / 12);
      const cz = Math.floor(q[2] / 12);
      for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++)
          for (const L of lamps.get(`${cx + dx},${cz + dz}`) || []) {
            const d2 = (q[0] - L[0]) ** 2 + (q[2] - L[2]) ** 2 + (q[1] - L[1] - 5) ** 2;
            s += Math.exp(-d2 / 60);
          }
      return Math.min(1, s);
    };
    // The night city: a quarter as many, the day's colors dimmed under a blue sky and warmed
    // round the lamps, fading in as the day goes.
    const nightUse = Math.round(use / 4);
    const nStride = count / nightUse;
    k.cloud({ count: (nightUse * 160000) / k.count, jitter: 0 }, (_r, j) => {
      const i = Math.min(count - 1, Math.floor((j + 0.5) * nStride));
      const [r, gg, b] = col(i);
      const w = pool(meterAt(i));
      const color = [0.03 + r * 0.2 + w * 0.75 * (0.35 + r), 0.04 + gg * 0.23 + w * 0.5 * (0.35 + gg), 0.09 + b * 0.36 + w * 0.2 * (0.3 + b)]; // prettier-ignore
      return { p: at(i), n: nrm(i), flat: 0.14, size: (meters(i) * m * Math.sqrt(nStride)) / base(), color, opacity: 1, kind: "fade", channel: 0, params: [0.35 + 0.25 * lcRand(i, 2), -0.3] }; // prettier-ignore
    });
    k.cloud({ count: (lights.length * 160000) / k.count, jitter: 0 }, (_r, j) => {
      const [i, what] = lights[Math.min(lights.length - 1, j)];
      const p = at(i);
      const n = nrm(i);
      const lamp = what === "lamp";
      const q = lamp ? [p[0], p[1] + 5 * m, p[2]] : [p[0] + n[0] * 0.15 * m, p[1], p[2] + n[2] * 0.15 * m]; // prettier-ignore
      const warm = lcRand(i, 5);
      return { p: q, size: ((lamp ? 0.9 : 0.7) * m) / base(), color: lamp ? [1, 0.86, 0.6] : mix("#ffc56e", "#fff0c8", warm), opacity: 1, kind: "fade", channel: 0, params: [0.5 + 0.45 * lcRand(i, 6), -0.05], pattern: false }; // prettier-ignore
    });
    k.reach([0, 0.25, 0]);
  },
};

// ---- Migration: white storks -----------------------------------------------------------------

const SM_FILE = "assets/toys/stork-migration/migration.bin";
const SM_PIC = "assets/toys/stork-migration/earth.jpg";
const SM_T = 15.5;
const SM_FLY = 0.035; // flying height above the map (recipe units)

export function birdAt(pts, hour) {
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
  density: 2,
  kernel: "sharp",
  credits: [
    {
      label: "Storks",
      title: "Data from: The challenges of the first migration (white storks, Rotics et al. 2016)",
      source: "https://doi.org/10.5441/001/1.hn1bd23k",
      author:
        "S. Rotics, M. Kaatz, Y. S. Resheff, S. F. Turjeman, D. Zurell, N. Sapir, U. Eggers, A. Flack, W. Fiedler, F. Jeltsch, M. Wikelski and R. Nathan (Movebank Data Repository)",
      license: "CC0 1.0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    },
    CREDIT_BLUE_MARBLE,
    CREDIT_ETOPO,
  ],
  controls: [{ key: "fly", label: "Fly", type: "pulse", ease: SM_T }],
  action: { key: "fly", label: "Play the fall migration" },
  async prepare() {
    await Promise.all([loadGeo(SM_FILE), loadPicture(SM_PIC)]);
  },
  drive(t, c, out, info) {
    const d = info.data;
    const s = c.fly > 0 ? (1 - c.fly) * SM_T : 0;
    // July to October in 12 s, a beat in Africa, then the season rewinds
    // (the storks fly their tracks backward to their nests) in 2 s.
    const f = c.fly > 0 ? clamp((s - 0.4) / 12, 0, 1) * (1 - ease(seg(s, 13.1, 15.2))) : 0;
    const hour = f * d.hours;
    out.morph = [f, 0, 0, 0];
    const back = s > 13.1 ? Math.PI : 0; // facing home while the season rewinds
    out.tokens = d.birds.map((b) => {
      const q = birdAt(b.pts, hour);
      const n = b.pts[Math.min(b.pts.length - 1, q.i + 1)];
      const p = d.at(q.lon, q.lat);
      const ahead = d.at(n[1], n[2]);
      const head = Math.atan2(ahead[0] - p[0], ahead[2] - p[2]);
      return {
        base: b.base,
        offset: [p[0] - b.base[0], 0, p[2] - b.base[2]],
        quat: quatAxisAngle([0, 1, 0], Number.isFinite(head) && Math.hypot(ahead[0] - p[0], ahead[2] - p[2]) > 1e-4 ? head + back : 0), // prettier-ignore
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
    // The map in true color (NASA Blue Marble Next Generation), on its relief.
    const pic = pictureLoaded(SM_PIC);
    const ground = (u, v) => Math.max(-500, H.sample(u, v));
    const map = addGrid(k, {
      F,
      height: ground,
      share: 0.62,
      color: (c) => shade(pic.sample(c.u, c.v), (c.wall ? 0.6 : 0.95 * hill(c.n, 0.35)) + 0.18),
    });
    addGridSides(k, F, ground, { spacing: map.spacing, side: () => "#4a443c" });
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
          lp = [(rand() - 0.5) * 0.012, (rand() - 0.5) * 0.009, (rand() - 0.5) * 0.04];
          color = "#f3f1ec";
        } else if (r < 0.92) {
          const side = rand() < 0.5 ? -1 : 1;
          const span = rand();
          lp = [side * span * 0.05, 0.003 * span, (rand() - 0.5) * 0.018 - 0.003 * span];
          color = span > 0.55 ? "#1f1f22" : "#f3f1ec";
        } else {
          lp = [0, 0, 0.02 + rand() * 0.012];
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
    const fx = 0.014;
    for (const [mf, word] of months) {
      const mx = x0 + (x1 - x0) * mf;
      k.add(
        k.param((u, v) => [mx + u * 0.34, F.bottom - 0.01, z + 0.045 + v * 0.135], { grid: 16 }),
        {
          even: true,
          share: 0.02,
          flat: 0.1,
          color: (c) => (inked([word], (c.p[0] - mx) / fx, (c.p[2] - z - 0.045) / fx) ? { c: [0.9, 0.9, 0.86], keep: true, size: 0.6 } : null), // prettier-ignore
        },
      );
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
  year: {
    label: "A year, magnitude 5 and up (snapshot)",
    words: "OCT 2025 TO SEP 2026, M5 AND UP",
  },
};
const MONTHS = "JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC".split(" ");
const MONTH_NAMES = "January February March April May June July August September October November December".split(" "); // prettier-ignore
const EQ = { snapshot: null, shown: null, live: new Map() };

// Rows of [time s, lon, lat, depth km, magnitude] from a GeoJSON feed.
export function quakeRows(gj) {
  const out = [];
  for (const f of gj.features || []) {
    const p = f.properties || {};
    const g = f.geometry?.coordinates || [];
    // An unknown (null) magnitude or depth stays unknown, never 0: such a quake is left out.
    if (p.type !== "earthquake" || p.mag == null || g[2] == null || p.time == null) continue;
    const row = [Math.round(p.time / 1000), +g[0], +g[1], +g[2], +p.mag];
    if (row.every(Number.isFinite)) out.push(row);
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

const EARTHQUAKES = {
  alive: true,
  density: 1.6,
  kernel: "sharp",
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
      CREDIT_BLUE_MARBLE,
    ];
    return out;
  },
  async prepare(o) {
    await Promise.all([loadGeo(EQ_DIR + "globe.bin.gz"), loadPicture(EQ_DIR + "earth.jpg")]);
    if (!EQ.snapshot) EQ.snapshot = JSON.parse(await readText(EQ_DIR + "snapshot.json"));
    const feed = EQ_FEEDS[o.feed] ? o.feed : "week";
    const snap = EQ.snapshot.feeds[feed];
    let got = null;
    if (feed !== "year" && liveAllowed()) {
      const key = `${feed}|${o.refresh}`;
      if (!EQ.live.has(key))
        EQ.live.set(
          key,
          eqFetch(feed).catch(() => null),
        );
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
    out.glow = [1, 0.97, 0.85, c.play > 0 ? 2.2 : 0]; // no glow at rest: crisp dots
    out.parts.globe = { angle: t * 0.08 };
  },
  build(k, o) {
    const G = geoLoaded(EQ_DIR + "globe.bin.gz").layer("height");
    const earth = pictureLoaded(EQ_DIR + "earth.jpg");
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
    // Round 2: the Earth in true color (NASA Blue Marble Next Generation),
    // one flat splat per point of an even (Fibonacci) sphere, sized to the
    // spacing, lit from the front left; the relief raises the land a little.
    // Round 3 ("still needs to be sharper"): about one point per picture pixel at the equator.
    const nPts = Math.round(1.8 * k.count);
    const gold = Math.PI * (3 - Math.sqrt(5));
    const spacing = Math.sqrt((4 * Math.PI) / nPts) * 1.05;
    const LIGHT = vec.unit([-0.4, 0.5, 0.75]);
    const base = () => k.baseSize || 0.01;
    k.cloud({ count: (nPts * 160000) / k.count, jitter: 0 }, (_r, i) => {
      const y = 1 - (2 * (i + 0.5)) / nPts;
      const r = Math.sqrt(1 - y * y);
      const th = gold * i;
      const dir = [Math.cos(th) * r, y, Math.sin(th) * r];
      // Back to lon/lat (the inverse of onGlobe).
      const lat = (Math.asin(y) * 180) / Math.PI;
      const lon = (((Math.atan2(dir[0], dir[2]) * 180) / Math.PI + EQ_FRONT + 540) % 360) - 180;
      const h = hAt(lon, lat);
      // The deep ocean a little bluer than the picture's near-black, as in photographs from orbit.
      const pic = earth.sample((lon + 180) / 360, (90 - lat) / 180);
      const col = h < 0 ? mix(pic, "#163a6a", 0.22) : pic;
      const lit = 0.62 + 0.5 * Math.max(0, vec.dot(dir, LIGHT));
      return { p: onGlobe(lon, lat, R + Math.max(0, h) * bump), n: dir, flat: 0.12, size: spacing / base(), color: shade(col, lit * 1.25), opacity: 1, part: globe }; // prettier-ignore
    });
    // The air: a thin shell, clear face on and pale blue at the limb (kind "rim").
    const nAir = Math.round(0.12 * k.count);
    const airSpacing = Math.sqrt((4 * Math.PI) / nAir) * 1.1;
    k.cloud({ count: (nAir * 160000) / k.count, jitter: 0 }, (_r, i) => {
      const y = 1 - (2 * (i + 0.5)) / nAir;
      const r = Math.sqrt(1 - y * y);
      const dir = [Math.cos(gold * i) * r, y, Math.sin(gold * i) * r];
      return { p: vec.mul(dir, R * 1.02), n: dir, flat: 0.12, size: (airSpacing * 1.02) / base(), color: [0.56, 0.76, 1], opacity: 0.6, kind: "rim", params: [0, 5], pattern: false }; // prettier-ignore
    });
    // The quakes: a dot each (bigger for a stronger quake, colored by
    // depth), flashing as the timeline passes its time.
    const ev = S.events;
    const t0 = ev.length ? ev[0][0] : 0;
    const t1 = ev.length ? ev[ev.length - 1][0] : 1;
    const rOf = (m) => 0.009 + 0.006 * Math.max(0, m - 2) ** 1.4;
    const area = ev.reduce((sum, e) => sum + rOf(e[4]) ** 2, 0) || 1;
    const budget = 0.1 * k.count;
    const dots = [];
    for (const e of ev) {
      const rr = rOf(e[4]);
      const n = Math.max(48, Math.round((budget * rr * rr) / area));
      for (let j = 0; j < n; j++) dots.push({ e, rr, n, j });
    }
    const baseQ = () => k.baseSize || 0.01;
    if (dots.length)
      k.cloud({ count: (dots.length * 160000) / k.count, jitter: 0 }, (_r, i) => {
        const { e, rr, n, j } = dots[Math.min(dots.length - 1, i)];
        // A sunflower disc: even, with a crisp round edge.
        const q = rr * Math.sqrt((j + 0.5) / n) * 0.92;
        const a = j * 2.39996;
        const p0 = onGlobe(e[1], e[2], R + Math.max(0, hAt(e[1], e[2])) * bump + 0.006);
        const nrm = vec.unit(p0);
        const t1v = vec.unit(vec.cross(nrm, [0, 1, 0.001]));
        const t2v = vec.cross(nrm, t1v);
        const p = vec.add(
          p0,
          vec.add(vec.mul(t1v, Math.cos(a) * q), vec.mul(t2v, Math.sin(a) * q)),
        );
        const rim = j / n > 0.8;
        return {
          p,
          n: nrm,
          flat: 0.2,
          color: rim ? shade(depthColor(e[3]), 0.6) : depthColor(e[3]),
          size: (rr * 1.7) / Math.sqrt(n) / baseQ(),
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
    // Round 3 ("the text below the planet also needs to be sharper"): square pixels on a grid,
    // two to each pixel of the letters.
    const PXQ = fx / 2;
    pixelPanel(k, {
      x0: -PW / 2,
      y0: py + PH / 2,
      z: 0.4,
      w: PW,
      h: PH,
      px: PXQ,
      color: (x, y) => {
        const ink = inked(lines, (x + PW / 2 - 0.1) / fx, (py + PH / 2 - 0.05 - y) / fx);
        return ink ? [0.95, 0.93, 0.86] : [0.12, 0.13, 0.15];
      },
    });
    // The timeline bar under it: lit as the quakes play.
    pixelPanel(k, {
      x0: -PW / 2,
      y0: py - PH / 2 - 0.035,
      z: 0.4,
      w: PW,
      h: 0.03,
      px: PXQ,
      color: () => [0.23, 0.25, 0.27],
      extra: (x) => ({ kind: "band", channel: 0, params: [(x + PW / 2) / PW, 0.02] }),
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

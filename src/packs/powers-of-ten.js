// Powers of ten pack (lane Powers of ten, labs): one continuous zoom from a
// galaxy down to a single molecule machine, through real pictures and real
// data at every scale, centered on a garden bed beside the Smithsonian
// Castle in Washington, D.C. Every scene is a chunk of splats (src/chunks.js)
// built only when the zoom comes near it; each one sits inside the larger
// one at its true size and fades in as it fills the view.
//
// The zoom is z, log10 of the view's height in meters. A layer anchored at
// e (its nominal size 10^e m spans U recipe units) shows at scale 10^(e - z).
// The stops and their sources are in src/powers/stops.js; the evidence is
// docs/evidence/powers-of-ten.json.

import { TARGET, AERIAL, STOPS, Z_MIN, Z_MAX, Z_HOME, stopAt } from "../powers/stops.js";
import { loadTrained } from "./fidelity.js";
import * as SKY from "../powers/sky.js";
import { readDensity, readBackbone, isoPointsPerVoxel } from "../science/density.js";

const { PC, LY, AU } = SKY;

// The view's height in recipe units at the home camera (the fit's diameter).
export const U = 1.9;
const LN10 = Math.LN10;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Per-toy memory for drive(), keyed by the control state object.
const MEM = new WeakMap();
function mem(c) {
  let m = MEM.get(c);
  if (!m) MEM.set(c, (m = {}));
  return m;
}

const asset = (name) => new URL(`../../assets/toys/powers-of-ten/${name}`, import.meta.url);

// ---- Pictures to splats ------------------------------------------------------------------

// Picture sides per device tier: a layer on show is about this many splats
// square (two or three layers show at once while one fades into the next).
const SIDE = { low: 360, mid: 560, high: 600, max: 600 };

async function pixels(name, side) {
  const r = await fetch(asset(name));
  if (!r.ok) throw new Error(`Could not load ${name}.`);
  const bmp = await createImageBitmap(await r.blob(), {
    resizeWidth: side,
    resizeHeight: side,
    resizeQuality: "high",
  });
  const cv = new OffscreenCanvas(side, side);
  const g = cv.getContext("2d");
  g.drawImage(bmp, 0, 0);
  bmp.close?.();
  return g.getImageData(0, 0, side, side).data;
}

// One flat splat per pixel, facing the viewer (+z), a sixth of a pixel
// thick; `place(u, v)` (u right, v down, 0..1) gives each pixel's place in
// recipe units. Splats fade with their chunk (kind "fade" on channel 0).
function pictureCloud(k, data, side, place, { alpha = 1 } = {}) {
  const pitch = U / side;
  const s = 0.62 * pitch;
  const n = side * side;
  k.cloud({ count: (n * 160000) / k.count, jitter: 0, pattern: false }, (_r, i) => {
    const x = i % side;
    const y = (i / side) | 0;
    const o = i * 4;
    return {
      p: place((x + 0.5) / side, (y + 0.5) / side),
      scales: [s, s, s * 0.1],
      quat: [0, 0, 0, 1],
      color: [data[o] / 255, data[o + 1] / 255, data[o + 2] / 255],
      opacity: alpha,
      kind: "fade",
      params: [0, -0.99],
    };
  });
}

// ---- The Earth under the target ---------------------------------------------------------------

const RE = 6371008.8; // the Earth's mean radius, meters
const RAD = Math.PI / 180;
const MERC = 6378137; // Web Mercator's sphere

// East, north and up at the target, and a point on the Earth (lat, lon in
// degrees) relative to it in those directions, in meters.
function enu(lat, lon) {
  const p0 = TARGET.lat * RAD;
  const l0 = TARGET.lon * RAD;
  const p = lat * RAD;
  const l = lon * RAD;
  const x = Math.cos(p) * Math.cos(l) - Math.cos(p0) * Math.cos(l0);
  const y = Math.cos(p) * Math.sin(l) - Math.cos(p0) * Math.sin(l0);
  const z = Math.sin(p) - Math.sin(p0);
  const e = -Math.sin(l0) * x + Math.cos(l0) * y;
  const n = -Math.sin(p0) * Math.cos(l0) * x - Math.sin(p0) * Math.sin(l0) * y + Math.cos(p0) * z;
  const u = Math.cos(p0) * Math.cos(l0) * x + Math.cos(p0) * Math.sin(l0) * y + Math.sin(p0) * z;
  return [e * RE, n * RE, u * RE];
}

// An aerial picture (square on the ground at the target, in Web Mercator),
// draped on the round Earth.
async function buildAerial(k, layer, profile) {
  const side = SIDE[profile] || SIDE.mid;
  const data = await pixels(layer.file, side);
  const ku = U / 10 ** layer.e; // recipe units per meter
  const c = Math.cos(TARGET.lat * RAD);
  const x0 = MERC * TARGET.lon * RAD;
  const y0 = MERC * Math.log(Math.tan(Math.PI / 4 + (TARGET.lat * RAD) / 2));
  const h = layer.width / c / 2;
  pictureCloud(k, data, side, (u, v) => {
    const mx = x0 + (2 * u - 1) * h;
    const my = y0 + (1 - 2 * v) * h;
    const lon = mx / MERC / RAD;
    const lat = (2 * Math.atan(Math.exp(my / MERC)) - Math.PI / 2) / RAD;
    const [e, n, up] = enu(lat, lon);
    return [e * ku, n * ku, up * ku];
  });
}

// The half of the Earth that faces the target, from the hemisphere picture
// (180 by 180 degrees of longitude and latitude round it).
async function buildGlobe(k, layer, profile) {
  const side = { low: 400, mid: 560, high: 600, max: 600 }[profile] || 560;
  const W = 1024;
  const data = await pixels("earth-hemisphere.jpg", W);
  const ku = U / 10 ** layer.e;
  const R = RE * ku;
  // Even points on the near half (a Fibonacci cap), as many as `side` squared.
  const n = side * side;
  const ga = Math.PI * (3 - Math.sqrt(5));
  const spacing = Math.sqrt((2 * Math.PI) / n) * R;
  const lon0 = TARGET.lon - 90;
  const p0 = TARGET.lat * RAD;
  const l0 = TARGET.lon * RAD;
  k.cloud({ count: (n * 160000) / k.count, jitter: 0, pattern: false }, (_r, i) => {
    // A direction on the near half, in east-north-up of the target's center view.
    const t = (i + 0.5) / n; // 0..1 over the hemisphere
    const cz = 1 - t; // cos of the angle from the view's axis
    const sr = Math.sqrt(1 - cz * cz);
    const a = i * ga;
    const dE = sr * Math.cos(a);
    const dN = sr * Math.sin(a);
    const dU = cz;
    // Back to the Earth's axes: the direction from its center.
    const X =
      -Math.sin(l0) * dE - Math.sin(p0) * Math.cos(l0) * dN + Math.cos(p0) * Math.cos(l0) * dU;
    const Y = Math.cos(l0) * dE - Math.sin(p0) * Math.sin(l0) * dN + Math.cos(p0) * Math.sin(l0) * dU; // prettier-ignore
    const Z = Math.cos(p0) * dN + Math.sin(p0) * dU;
    const lat = Math.asin(clamp(Z, -1, 1)) / RAD;
    const lon = Math.atan2(Y, X) / RAD;
    let fx = ((((lon - lon0) % 360) + 360) % 360) / 180;
    if (fx > 1) fx = fx > 1.5 ? 0 : 1;
    const fy = (90 - lat) / 180;
    const px = clamp(Math.floor(fx * W), 0, W - 1);
    const py = clamp(Math.floor(fy * W), 0, W - 1);
    const o = (py * W + px) * 4;
    // The limb a little darker, as the air thickens toward it.
    const limb = 0.55 + 0.45 * Math.pow(cz, 0.35);
    const s = 0.62 * spacing;
    const nx = dE;
    const ny = dN;
    const nz = dU;
    return {
      p: [dE * R, dN * R, (dU - 1) * R],
      scales: [s, s, s * 0.1],
      quat: quatToward([nx, ny, nz]),
      color: [(data[o] / 255) * limb, (data[o + 1] / 255) * limb, (data[o + 2] / 255) * limb],
      opacity: 1,
      kind: "fade",
      params: [0, -0.99],
    };
  });
}

// A rotation that turns +z toward `n` (unit).
function quatToward(n) {
  const d = n[2];
  if (d > 0.999999) return [0, 0, 0, 1];
  if (d < -0.999999) return [1, 0, 0, 0];
  const ax = -n[1];
  const ay = n[0];
  const w = 1 + d;
  const l = Math.hypot(ax, ay, w);
  return [ax / l, ay / l, 0, w / l];
}

// ---- The garden bed (a 3D capture) --------------------------------------------------------

// The capture's own units per meter: the bed is about 2 meters long
// (see src/powers/stops.js, "bed").
async function buildBed(k, layer, profile) {
  const rel = `../../assets/toys/maple-tree/maple-tree${profile === "low" || profile === "mid" ? "-lite" : ""}.sog`; // prettier-ignore
  const t = await loadTrained(rel);
  // Its long side and height, from where most of its splats are.
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < t.n; i++) {
    if (t.alpha[i] < 0.3) continue;
    for (let a = 0; a < 3; a++) {
      const v = t.pos[i * 3 + a];
      if (v < lo[a]) lo[a] = v;
      if (v > hi[a]) hi[a] = v;
    }
  }
  const span = Math.max(hi[0] - lo[0], hi[2] - lo[2]) || 1;
  const ku = U / 10 ** layer.e;
  const sc = (layer.size * ku) / span;
  // Centered on the maple: the middle of its crown (the splats in the top
  // third), not of the bed with its loose bits.
  const xs = [];
  const zs = [];
  for (let i = 0; i < t.n; i++) {
    if (t.alpha[i] < 0.3 || t.pos[i * 3 + 1] < lo[1] + (hi[1] - lo[1]) * 0.66) continue;
    xs.push(t.pos[i * 3]);
    zs.push(t.pos[i * 3 + 2]);
  }
  const mid = (a) => (a.length ? a.sort((p, q) => p - q)[a.length >> 1] : 0);
  const cx = mid(xs);
  const cz = mid(zs);
  // Seen from above: its up (+y) turns toward the viewer (+z); north up.
  const q = [Math.SQRT1_2, 0, 0, Math.SQRT1_2]; // +90 degrees about x
  const mulq = (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
  const max = { low: 120000, mid: 220000, high: 300000, max: 360000 }[profile] || 220000;
  const step = Math.max(1, t.n / max);
  const n = Math.floor(t.n / step);
  k.cloud({ count: (n * 160000) / k.count, jitter: 0, pattern: false }, (_r, j) => {
    const i = Math.floor(j * step);
    if (t.alpha[i] < 0.02) return null;
    const x = (t.pos[i * 3] - cx) * sc;
    const y = (t.pos[i * 3 + 1] - lo[1]) * sc; // its foot on the ground
    const z = (t.pos[i * 3 + 2] - cz) * sc;
    const qq = mulq(q, [t.quat[i * 4], t.quat[i * 4 + 1], t.quat[i * 4 + 2], t.quat[i * 4 + 3]]);
    return {
      p: [x, -z, y],
      scales: [t.scale[i * 3] * sc, t.scale[i * 3 + 1] * sc, t.scale[i * 3 + 2] * sc],
      quat: qq,
      color: [t.color[i * 3], t.color[i * 3 + 1], t.color[i * 3 + 2]],
      opacity: t.alpha[i],
      kind: "fade",
      params: [0, -0.99],
    };
  });
}

// ---- Space ------------------------------------------------------------------------------------

const unit3 = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const SUN_DIR_EARTH = unit3(SKY.SUN.map((x, i) => x - SKY.EARTH[i]));

// A star's color from its temperature (a fit to a black body's, Tanner
// Helland's), 0..1.
export function starColor(T) {
  const t = clamp(T, 1000, 40000) / 100;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492); // prettier-ignore
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [clamp(r, 0, 255) / 255, clamp(g, 0, 255) / 255, clamp(b, 0, 255) / 255];
}

// A global color map (equirectangular, from real-worlds) as a sampler.
async function globalMap(file, side = 1024) {
  const r = await fetch(new URL(`../../assets/toys/real-worlds/${file}`, import.meta.url));
  if (!r.ok) throw new Error(`Could not load ${file}.`);
  const bmp = await createImageBitmap(await r.blob(), { resizeWidth: side, resizeHeight: side / 2, resizeQuality: "high" }); // prettier-ignore
  const cv = new OffscreenCanvas(side, side / 2);
  const g = cv.getContext("2d");
  g.drawImage(bmp, 0, 0);
  const d = g.getImageData(0, 0, side, side / 2).data;
  return (lat, lon) => {
    const x = clamp(Math.floor((((((lon + 180) % 360) + 360) % 360) / 360) * side), 0, side - 1);
    const y = clamp(Math.floor(((90 - lat) / 180) * (side / 2)), 0, side / 2 - 1);
    const o = (y * side + x) * 4;
    return [d[o] / 255, d[o + 1] / 255, d[o + 2] / 255];
  };
}

// A ball of n splats at `c` (recipe units) of radius r, colored by
// color(dir in east-north-up) and lit by the Sun.
function ball(k, n, c, r, color, { light = SUN_DIR_EARTH, ambient = 0.06, size = 0.7 } = {}) {
  const ga = Math.PI * (3 - Math.sqrt(5));
  const s = size * Math.sqrt((4 * Math.PI) / n) * r;
  k.cloud({ count: (n * 160000) / k.count, jitter: 0, pattern: false }, (_r, i) => {
    const y = 1 - (2 * (i + 0.5)) / n;
    const rr = Math.sqrt(1 - y * y);
    const a = i * ga;
    const d = [rr * Math.cos(a), rr * Math.sin(a), y];
    const lit = ambient + (1 - ambient) * Math.max(0, d[0] * light[0] + d[1] * light[1] + d[2] * light[2]); // prettier-ignore
    const col = color(d);
    return {
      p: [c[0] + d[0] * r, c[1] + d[1] * r, c[2] + d[2] * r],
      scales: [s, s, s * 0.15],
      quat: quatToward(d),
      color: [col[0] * lit, col[1] * lit, col[2] * lit],
      opacity: 1,
      kind: "fade",
      params: [0, -0.99],
    };
  });
}

// A thin line through points (recipe units), as small round splats.
function line(k, pts, width, color, { closed = false, opacity = 0.9, per = 1 } = {}) {
  const segs = [];
  let total = 0;
  for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    segs.push([a, b, l, total]);
    total += l;
  }
  const n = Math.max(2, Math.ceil((total / width) * 0.9 * per));
  let si = 0;
  k.cloud({ count: (n * 160000) / k.count, jitter: 0, pattern: false }, (_r, i) => {
    const d = (i / n) * total;
    while (si < segs.length - 1 && segs[si][3] + segs[si][2] < d) si++;
    const [a, b, l, at] = segs[si];
    const t = l > 0 ? (d - at) / l : 0;
    return {
      p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
      scales: [width * 0.5, width * 0.5, width * 0.5],
      quat: [0, 0, 0, 1],
      color,
      opacity,
      kind: "fade",
      params: [0, -0.99],
    };
  });
}

// A round glowing dot (a star or a planet's marker): a bright core in a
// faint halo.
function dot(k, p, size, color, { halo = 0.35 } = {}) {
  k.cloud({ count: (2 * 160000) / k.count, jitter: 0, pattern: false }, (_r, i) => ({
    p: [p[0], p[1], p[2] + (i ? 0 : 1e-5)],
    scales: i ? [size * 2.6, size * 2.6, size * 2.6] : [size, size, size],
    quat: [0, 0, 0, 1],
    color,
    opacity: i ? halo : 1,
    kind: "fade",
    params: [0, -0.99],
  }));
}

const toUnits = (v, ku) => [v[0] * ku, v[1] * ku, v[2] * ku];

// The Earth and the Moon, at their true sizes and places, and the Moon's
// path over a month.
async function buildMoon(k, layer) {
  const ku = U / 10 ** layer.e;
  const earthMap = await globalMap("earth-color.jpg");
  const moonMap = await globalMap("moon-color.jpg");
  // The Earth: its east-north-up directions back to latitude and longitude.
  const p0 = TARGET.lat * RAD;
  const l0 = TARGET.lon * RAD;
  const latlon = (d) => {
    const X = -Math.sin(l0) * d[0] - Math.sin(p0) * Math.cos(l0) * d[1] + Math.cos(p0) * Math.cos(l0) * d[2]; // prettier-ignore
    const Y = Math.cos(l0) * d[0] - Math.sin(p0) * Math.sin(l0) * d[1] + Math.cos(p0) * Math.sin(l0) * d[2]; // prettier-ignore
    const Z = Math.cos(p0) * d[1] + Math.sin(p0) * d[2];
    return [Math.asin(clamp(Z, -1, 1)) / RAD, Math.atan2(Y, X) / RAD];
  };
  // (Only a few pixels wide where this shows, so a few big splats: tiny
  // ones vanish under a pixel.)
  ball(k, 260, toUnits(SKY.EARTH, ku), RE * ku, (d) => earthMap(...latlon(d)), { size: 0.95 });
  // The Moon keeps its near side toward the Earth: its sub-Earth point
  // faces the Earth (longitude 0).
  const me = unit3(SKY.EARTH.map((x, i) => x - SKY.MOON[i]));
  const north = [0, 0, 1];
  const east = unit3([north[1] * me[2] - north[2] * me[1], north[2] * me[0] - north[0] * me[2], north[0] * me[1] - north[1] * me[0]]); // prettier-ignore
  const up = [me[1] * east[2] - me[2] * east[1], me[2] * east[0] - me[0] * east[2], me[0] * east[1] - me[1] * east[0]]; // prettier-ignore
  ball(k, 70, toUnits(SKY.MOON, ku), 1737.4e3 * ku, (d) => {
    const a = d[0] * me[0] + d[1] * me[1] + d[2] * me[2];
    const b = d[0] * east[0] + d[1] * east[1] + d[2] * east[2];
    const c = d[0] * up[0] + d[1] * up[1] + d[2] * up[2];
    return moonMap(Math.asin(clamp(c, -1, 1)) / RAD, Math.atan2(b, a) / RAD);
  }, { ambient: 0.04, size: 0.95 }); // prettier-ignore
  line(k, SKY.moonPath(400).map((v) => toUnits(v, ku)), 0.0042, [0.55, 0.6, 0.7], { closed: true, opacity: 0.55 }); // prettier-ignore
}

// The Sun and the planets' orbits, from JPL's elements, where they were at
// the moment; the dots mark their places (the bodies are far smaller).
function buildPlanets(k, layer, list) {
  const ku = U / 10 ** layer.e;
  const w = layer.line;
  for (const p of list) {
    const col = p.id === "earth" ? [0.45, 0.65, 1] : [0.62, 0.62, 0.66];
    line(k, SKY.orbitPath(p, 720).map((v) => toUnits(v, ku)), w, col, { closed: true, opacity: p.id === "earth" ? 0.8 : 0.5 }); // prettier-ignore
    const c = { mercury: [0.75, 0.7, 0.65], venus: [1, 0.92, 0.75], earth: [0.5, 0.75, 1], mars: [1, 0.55, 0.35], jupiter: [0.95, 0.85, 0.7], saturn: [0.95, 0.88, 0.65], uranus: [0.7, 0.9, 0.95], neptune: [0.5, 0.65, 1] }[p.id]; // prettier-ignore
    dot(k, toUnits(SKY.planetAt(p), ku), w * 2.2, c);
  }
  dot(k, toUnits(SKY.SUN, ku), w * 4, [1, 0.93, 0.75], { halo: 0.5 });
}

// The Sun alone, a light-year round: one bright star.
function buildSunAlone(k, layer) {
  const ku = U / 10 ** layer.e;
  dot(k, toUnits(SKY.SUN, ku), 0.006, [1, 0.93, 0.75], { halo: 0.5 });
}

// Stars, each a round dot sized and dimmed by its absolute magnitude.
function starDots(k, list, size) {
  k.cloud({ count: (list.length * 160000) / k.count, jitter: 0, pattern: false }, (_r, i) => {
    const s = list[i];
    const b = clamp(10 ** (-0.4 * (s.M - 4.8)), 0.02, 400);
    const sz = size * clamp(Math.pow(b, 0.18), 0.45, 3.2);
    const lum = clamp(0.35 + 0.25 * Math.log10(b) + 0.3, 0.25, 1);
    const c = starColor(s.T);
    return {
      p: s.p,
      scales: [sz, sz, sz],
      quat: [0, 0, 0, 1],
      color: [c[0] * lum, c[1] * lum, c[2] * lum],
      opacity: 1,
      kind: "fade",
      params: [0, -0.99],
    };
  });
}

// Every star within 20 pc (Space r2's file: Gaia's nearby stars, galactic
// parsecs), and the Sun.
async function buildNearStars(k, layer) {
  const ku = U / 10 ** layer.e;
  const r = await fetch(new URL("../../assets/toys/nearby-stars/stars.json", import.meta.url));
  if (!r.ok) throw new Error("Could not load the nearby stars.");
  const D = await r.json();
  const list = D.stars.map((s) => ({ p: toUnits(SKY.galToEnu([s[0] * PC, s[1] * PC, s[2] * PC]), ku).map((v, i) => v + SKY.SUN[i] * ku), M: s[3], T: s[4] })); // prettier-ignore
  list.push({ p: toUnits(SKY.SUN, ku), M: 4.83, T: 5772 });
  starDots(k, list, 0.0045);
}

// The stars within 500 pc (HYG v4.4, equatorial parsecs; tools/pot-stars.mjs).
async function buildLocalStars(k, layer, profile) {
  const ku = U / 10 ** layer.e;
  const r = await fetch(asset("stars-500pc.bin"));
  if (!r.ok) throw new Error("Could not load the stars.");
  const a = new Int16Array(await r.arrayBuffer());
  const n = a.length / 5;
  const keep = { low: 25000, mid: 45000 }[profile] || n;
  const list = [];
  // The brightest first when a phone keeps fewer.
  const order = [...Array(n).keys()];
  if (keep < n) order.sort((i, j) => a[i * 5 + 3] - a[j * 5 + 3]);
  for (const i of order.slice(0, keep)) {
    const eq = [a[i * 5] * 0.05 * PC, a[i * 5 + 1] * 0.05 * PC, a[i * 5 + 2] * 0.05 * PC];
    const v = SKY.eqToEnu(eq);
    list.push({ p: [(v[0] + SKY.SUN[0]) * ku, (v[1] + SKY.SUN[1]) * ku, (v[2] + SKY.SUN[2]) * ku], M: a[i * 5 + 3] / 100, T: a[i * 5 + 4] * 10 }); // prettier-ignore
  }
  list.push({ p: toUnits(SKY.SUN, ku), M: 4.83, T: 5772 });
  starDots(k, list, 0.0017);
}

// The Milky Way can't be photographed from outside: M83 (ESO), a barred
// spiral much like it, laid in the galactic plane at the Milky Way's size
// (about 100,000 light-years), centered on the real galactic center.
async function buildGalaxy(k, layer, profile) {
  const ku = U / 10 ** layer.e;
  const side = { low: 420, mid: 560 }[profile] || 700;
  const r = await fetch(new URL("../../assets/toys/real-galaxies/m83.jpg", import.meta.url));
  if (!r.ok) throw new Error("Could not load the galaxy.");
  const bmp = await createImageBitmap(await r.blob());
  // The galaxy's disk in the picture (Space r2's crop: center 623, 625 of
  // 1250, radius 440, in the original; the file is that crop at 768).
  const cv = new OffscreenCanvas(side, side);
  const g = cv.getContext("2d");
  g.drawImage(bmp, 0, 0, side, side);
  const data = g.getImageData(0, 0, side, side).data;
  const D = 100000 * LY; // the Milky Way's width
  const C = SKY.GALACTIC.center;
  const X = SKY.GALACTIC.x;
  const Y = SKY.GALACTIC.y;
  const pitch = (D / side) * ku;
  const n = side * side;
  k.cloud({ count: (n * 160000) / k.count, jitter: 0, pattern: false }, (_r, i) => {
    const o = i * 4;
    const rr = data[o] / 255;
    const gg = data[o + 1] / 255;
    const bb = data[o + 2] / 255;
    const lum = 0.3 * rr + 0.59 * gg + 0.11 * bb;
    const u0 = ((i % side) + 0.5) / side - 0.5;
    const v0 = (((i / side) | 0) + 0.5) / side - 0.5;
    // Only the disk: the picture's sky and its corners fade away.
    const alpha = smooth(0.04, 0.16, lum) * (1 - smooth(0.36, 0.5, Math.hypot(u0, v0)));
    if (alpha < 0.02) return null;
    const u = ((i % side) + 0.5) / side - 0.5;
    const v = 0.5 - (((i / side) | 0) + 0.5) / side;
    const p = [0, 1, 2].map((a) => (C[a] + SKY.SUN[a] + (u * X[a] + v * Y[a]) * D) * ku);
    return {
      p,
      scales: [pitch * 0.62, pitch * 0.62, pitch * 0.62],
      quat: [0, 0, 0, 1],
      color: [rr, gg, bb],
      opacity: alpha,
      kind: "fade",
      params: [0, -0.99],
    };
  });
}

// ---- Pictures under the microscope ----------------------------------------------------------

// A flat picture (a photo or a micrograph) `layer.width` meters across,
// centered on the zoom's target. `key`: "light" or "dark" makes a plain
// background of that kind clear, so the subject (a leaf on a white table)
// lies on the scene round it.
async function buildPicture(k, layer, profile) {
  const side = SIDE[profile] || SIDE.mid;
  const data = await pixels(layer.file, side);
  const ku = U / 10 ** layer.e;
  const w = layer.width * ku;
  const c = layer.center || [0.5, 0.5];
  if (layer.key) {
    for (let i = 0; i < side * side; i++) {
      const o = i * 4;
      const r = data[o] / 255;
      const g = data[o + 1] / 255;
      const b = data[o + 2] / 255;
      const hi = Math.max(r, g, b);
      const lo = Math.min(r, g, b);
      // Light: bright and gray; dark: dim.
      const bg = layer.key === "light" ? smooth(0.12, 0.05, hi - lo) * smooth(0.6, 0.8, hi) : smooth(0.12, 0.05, hi); // prettier-ignore
      data[o + 3] = Math.round(255 * (1 - bg));
    }
  }
  const pitch = U / side;
  const s0 = 0.62 * pitch * (w / U);
  k.cloud({ count: (side * side * 160000) / k.count, jitter: 0, pattern: false }, (_r, i) => {
    const o = i * 4;
    const a = data[o + 3] / 255;
    if (a < 0.03) return null;
    const x = ((i % side) + 0.5) / side;
    const y = (((i / side) | 0) + 0.5) / side;
    return {
      p: [(x - c[0]) * w, (c[1] - y) * w, 0],
      scales: [s0, s0, s0 * 0.1],
      quat: [0, 0, 0, 1],
      color: [data[o] / 255, data[o + 1] / 255, data[o + 2] / 255],
      opacity: a,
      kind: "fade",
      params: [0, -0.99],
    };
  });
}

// ---- The ribosome (a cryo-EM map) ----------------------------------------------------------

// Science r3's map of a bacterial ribosome (E. coli 70S, EMD-48329, with its
// fitted model PDB 9MKK; public domain), its surface at EMDB's recommended
// level, one splat per surface voxel: the RNA warm, the proteins cool (by
// the nearest chain of the fitted model), lit from above left with its
// pockets shaded. About 25 nm across; Å are 1e-10 m.
async function buildRibosome(k, layer, profile) {
  const ku = U / 10 ** layer.e;
  const get = async (name) => {
    const r = await fetch(new URL(`../../assets/toys/cryoem-map/${name}`, import.meta.url));
    if (!r.ok) throw new Error(`Could not load ${name}.`);
    return new Uint8Array(await r.arrayBuffer());
  };
  const [vol, mod] = await Promise.all([get("ribosome.vol.gz"), get("ribosome-model.bin")]);
  const D = await readDensity(vol);
  const model = await readBackbone(mod);
  const S = isoPointsPerVoxel(D, D.head.level);
  const P = S.p;
  const c = [0, 0, 0];
  for (let i = 0; i < S.count; i++) for (let a = 0; a < 3; a++) c[a] += P[3 * i + a] / S.count;
  let zMax = -Infinity;
  for (let i = 0; i < S.count; i++) zMax = Math.max(zMax, P[3 * i + 2] - c[2]);
  // The nearest chain's kind (RNA or protein), on an 8 Å grid of the model.
  const grid = new Map();
  model.forEach((ch) => ch.p.forEach((q) => {
    const key = q.map((v) => Math.floor(v / 8)).join(",");
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push([q, ch.kind === "nucleic"]);
  })); // prettier-ignore
  const isRna = (p) => {
    const g = p.map((v) => Math.floor(v / 8));
    let best = null;
    let bd = 64 * 4;
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++)
          for (const [q, rna] of grid.get(`${g[0] + dx},${g[1] + dy},${g[2] + dz}`) ?? []) {
            const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2;
            if (d < bd) [best, bd] = [rna, d];
          }
    return best;
  };
  const max = { low: 90000, mid: 160000, high: 260000, max: 360000 }[profile] || 160000;
  const keep = Math.min(1, max / S.count);
  const pick = [];
  for (let i = 0; i < S.count; i++) if ((i * 0.618034) % 1 < keep) pick.push(i);
  const size = D.voxel[0] * 0.8 * Math.sqrt(1 / keep) * 1e-10 * ku;
  const L = unit3([-0.45, 0.55, 0.7]);
  k.cloud({ count: (pick.length * 160000) / k.count, jitter: 0, pattern: false }, (_r, j) => {
    const i = pick[j];
    const p = [P[3 * i], P[3 * i + 1], P[3 * i + 2]];
    const n = [S.n[3 * i], S.n[3 * i + 1], S.n[3 * i + 2]];
    const rna = isRna(p);
    const base = rna === null ? [0.72, 0.73, 0.76] : rna ? [0.93, 0.62, 0.36] : [0.42, 0.62, 0.86];
    const lit = 0.32 + 0.68 * Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
    return {
      // Its front at the zoom's plane, so the view never goes inside it.
      p: [(p[0] - c[0]) * 1e-10 * ku, (p[1] - c[1]) * 1e-10 * ku, (p[2] - c[2] - zMax) * 1e-10 * ku], // prettier-ignore
      scales: [size, size, size * 0.15],
      quat: quatToward(n),
      color: base.map((v) => v * lit),
      opacity: 1,
      kind: "fade",
      params: [0, -0.99],
    };
  });
}

// ---- The backdrop -------------------------------------------------------------------------

// Black behind everything (space is black in either theme, and the edge of
// a picture never shows the page).
function buildBackdrop(k) {
  const nx = 90;
  const ny = 60;
  k.cloud({ count: (nx * ny * 160000) / k.count, jitter: 0, pattern: false }, (_r, i) => {
    const x = ((i % nx) + 0.5) / nx - 0.5;
    const y = ((i / nx) | 0) / ny + 0.5 / ny - 0.5;
    const s = 0.12;
    return { p: [x * 14, y * 9, -6], scales: [s, s, 0.01], quat: [0, 0, 0, 1], color: [0, 0, 0], opacity: 1 }; // prettier-ignore
  });
}

// ---- The layers ------------------------------------------------------------------------------

// Every chunk: its id, anchor e, how to build it, and how it shows.
// `cover`: an opaque picture that hides the coarser layers once it fills the
// view. `fadeIn` and `fadeOut`: the scales (its size over the view's) over
// which it fades in as it grows and out as it grows past the view.
export const LAYERS = [
  { id: "galaxy", e: 21, cover: false, fadeIn: [0.01, 0.03], fadeOut: [2.5, 5], build: buildGalaxy }, // prettier-ignore
  { id: "stars-local", e: 19.5, cover: false, fadeIn: [0.02, 0.06], fadeOut: [3, 6], build: buildLocalStars }, // prettier-ignore
  { id: "stars-near", e: 18, cover: false, fadeIn: [0.02, 0.06], fadeOut: [3, 6], build: buildNearStars }, // prettier-ignore
  { id: "sun-alone", e: 16, cover: false, fadeIn: [0.002, 0.005], fadeOut: [8, 16], build: buildSunAlone }, // prettier-ignore
  { id: "outer", e: 13.3, line: 0.0045, cover: false, fadeIn: [0.004, 0.012], fadeOut: [6, 10], build: (k, l) => buildPlanets(k, l, SKY.PLANETS) }, // prettier-ignore
  { id: "inner", e: 11.9, line: 0.0042, cover: false, fadeIn: [0.01, 0.03], fadeOut: [4, 8], build: (k, l) => buildPlanets(k, l, SKY.PLANETS.slice(0, 4)) }, // prettier-ignore
  { id: "moon", e: 9, cover: false, fadeIn: [0.012, 0.03], fadeOut: [3, 5], build: buildMoon },
  { id: "earth", e: 7.3, cover: false, fadeIn: [0.04, 0.08], fadeOut: [24, 30], build: buildGlobe }, // prettier-ignore
  ...AERIAL.map((a) => ({
    id: `aerial-${a.e.toFixed(1)}`,
    e: a.e,
    cover: true,
    fadeIn: a.e === 6 ? [0.08, 0.2] : [0.3, 0.55],
    dim: a.e === 1.5 ? [-1.1, -0.5, 0.3] : null,
    build: (k, layer, profile) => buildAerial(k, a, profile),
  })),
  { id: "bed", e: 0.5, size: 2.0, cover: false, fadeIn: [0.35, 0.6], fadeOut: [6, 9], build: buildBed }, // prettier-ignore
  { id: "ribosome", e: -7.4, cover: false, fadeIn: [0.25, 0.5], build: buildRibosome },
];

const byId = new Map(LAYERS.map((l) => [l.id, l]));

// How each layer shows at zoom z: { scale, fade } (fade 0: off).
export function layout(z) {
  const out = {};
  const shown = LAYERS.map((l) => {
    const s = 10 ** (l.e - z);
    let f = smooth(l.fadeIn[0], l.fadeIn[1], s);
    if (l.fadeOut) f *= 1 - smooth(l.fadeOut[0], l.fadeOut[1], s);
    // `dim: [z0, z1, least]`: dimmed toward `least` as the zoom goes from z0
    // in to z1 (the aerial picture round the garden bed, far past its own
    // detail there).
    const full = f;
    if (l.dim) f *= 1 - (1 - l.dim[2]) * smooth(l.dim[0], l.dim[1], -z);
    return { l, s, f, full };
  });
  // The finest cover that fills the view hides every layer coarser than it.
  let floor = -Infinity;
  for (const x of shown) if (x.l.cover && x.full >= 0.999 && x.s >= 1.9) floor = Math.max(floor, -x.l.e); // prettier-ignore
  for (const x of shown) {
    if (x.f <= 0.001 || -x.l.e < floor) continue;
    out[x.l.id] = { scale: x.s, fade: x.f };
  }
  return out;
}

// ---- Words -----------------------------------------------------------------------------------

const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" }; // prettier-ignore
export const power = (n) => `10${String(n).replace(/./g, (ch) => SUP[ch] ?? ch)} m`;

const group = (v) => v.toLocaleString("en-US", { maximumFractionDigits: 0 });

// A round length near `m` meters (1, 2 or 5 of a unit that reads well) and its words.
export function rulerFor(m) {
  const units = [
    [LY, "light-year", "light-years"],
    [AU, "AU", "AU"],
    [1000, "km", "km"],
    [1, "m", "m"],
    [1e-2, "cm", "cm"],
    [1e-3, "mm", "mm"],
    [1e-6, "µm", "µm"],
    [1e-9, "nm", "nm"],
  ];
  let u = units[units.length - 1];
  if (m >= 0.5 * LY) u = units[0];
  else if (m >= 0.05 * AU && m < 0.5 * LY && m > 2e10) u = units[1];
  else
    for (const x of units.slice(2)) {
      if (m >= x[0]) {
        u = x;
        break;
      }
    }
  const v = m / u[0];
  const p = 10 ** Math.floor(Math.log10(v));
  const f = v / p;
  const nice = (f >= 5 ? 5 : f >= 2 ? 2 : 1) * p;
  const text = `${nice >= 1 ? group(nice) : String(Number(nice.toPrecision(1)))} ${nice === 1 ? u[1] : u[2]}`;
  return { meters: nice * u[0], text };
}

// ---- The recipe ------------------------------------------------------------------------------

const JOURNEY = 70; // seconds for the whole journey (Play)

// For tools and tests: a zoom to hold (tools/pot-clip.mjs steps it frame by
// frame); null in the app.
export const CLIP = { z: null };

// The journey's zoom at progress p (0..1): out from the garden to the
// galaxy, down through everything to the smallest stop, and back home.
export function journey(p) {
  const a = Z_MAX - Z_HOME;
  const b = Z_MAX - Z_MIN;
  const c = Z_HOME - Z_MIN;
  const total = a + b + c;
  const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(x, 0, 1));
  const d = clamp(p, 0, 1) * total;
  if (d < a) return Z_HOME + a * ease(d / a);
  if (d < a + b) return Z_MAX - b * ease((d - a) / b);
  return Z_MIN + c * ease((d - a - b) / c);
}

const PD = { license: "Public domain", licenseUrl: "https://www.usa.gov/government-copyright" };
const BY = { license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/" };
const BYSA = {
  license: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
};
export const CREDITS = [
  { label: "The Milky Way's stand-in", title: "M83 (eso0825a)", source: "https://www.eso.org/public/images/eso0825a/", author: "ESO", ...BY }, // prettier-ignore
  { label: "Stars within 1,600 light-years", title: "HYG database v4.4", source: "https://codeberg.org/astronexus/hyg", author: "David Nash (astronexus)", ...BYSA }, // prettier-ignore
  { label: "Stars within 65 light-years", title: "Gaia Catalogue of Nearby Stars (Smart et al. 2021)", source: "https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/649/A6", author: "ESA/Gaia/DPAC", license: "CC BY-SA 3.0 IGO", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/igo/" }, // prettier-ignore
  { label: "Planets", title: "Approximate Positions of the Planets (Table 1)", source: "https://ssd.jpl.nasa.gov/planets/approx_pos.html", author: "E. M. Standish, JPL", ...PD }, // prettier-ignore
  { label: "The Moon", title: "CGI Moon Kit (LRO LROC color mosaic)", source: "https://svs.gsfc.nasa.gov/4720", author: "NASA's Scientific Visualization Studio; LRO LROC team", ...PD }, // prettier-ignore
  { label: "The Earth", title: "Blue Marble: Next Generation (via USGS The National Map, USGS Imagery Only)", source: "https://visibleearth.nasa.gov/images/74092/july-blue-marble-next-generation", author: "NASA Earth Observatory (Reto Stöckli)", ...PD }, // prettier-ignore
  { label: "From 1,000 km to 10 km", title: "Sentinel-2 cloudless 2016 (EOxCloudless)", source: "https://cloudless.eox.at", author: "EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016)", ...BY }, // prettier-ignore
  { label: "3 km", title: "USGS Imagery Only (NAIP)", source: "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer", author: "USDA, USGS The National Map", ...PD }, // prettier-ignore
  { label: "From 1 km to 30 m", title: "Aerial Photography (Orthophoto) 2023, 3 inch", source: "https://opendata.dc.gov/", author: "District of Columbia, Office of the Chief Technology Officer", ...BY }, // prettier-ignore
  { label: "The garden bed", title: "Golden Fullmoon Maple (3D capture)", source: "https://superspl.at/scene/f233b115", author: "Joshua Trapani", ...BY, changes: "Decimated, turned to be seen from above and set in the garden at an estimated 2 m long." }, // prettier-ignore
  { label: "The ribosome", title: "Arbekacin-bound E. coli 70S ribosome, 3.2 Å (EMD-48329), with its model (PDB 9MKK)", source: "https://www.ebi.ac.uk/emdb/EMD-48329", author: "S. Majumdar, N. P. Parajuli, X. Ge, A. Emmerich and S. Sanyal (2025), via EMDB and the PDB", license: "Public domain (EMDB)", licenseUrl: "https://www.ebi.ac.uk/emdb/faq" }, // prettier-ignore
];

const RECIPE = {
  turntable: false,
  note: "Every scene is a real picture or real data at its true size; the planets, the Moon and the stars are where they were at 12:54 p.m. EDT on October 7, 2026, straight up from the garden. The Milky Way can't be photographed from outside: M83, a galaxy much like it, stands in at its size and tilt.",
  credits: CREDITS,
  tiltLock: true,
  zoom: true,
  kernel: "sharp",
  // Far scenes are made of splats under a pixel (the Earth as a dot): keep
  // the engine from skipping them, as the picture toys do.
  render: { cull: 0.5 },
  alive: true,
  controls: [{ key: "play", label: "Play the journey", type: "pulse", ease: JOURNEY }],
  action: { key: "play", label: "Play the journey" },
  chunks: {
    async build(k, id, help) {
      if (id === "backdrop") return buildBackdrop(k);
      const layer = byId.get(id);
      if (!layer) throw new Error(`No layer ${id}.`);
      await layer.build(k, layer, help.profile);
    },
  },
  drive(t, c, out, info) {
    const m = mem(c);
    const ch = info.chunks;
    const dt = m.t === undefined ? 0 : clamp(t - m.t, 0, 0.25);
    m.t = t;
    if (m.goal === undefined) {
      m.goal = Z_HOME;
      m.z = Z_HOME;
    }
    // The zoom's inputs: a pinch, the wheel or a drag (info.zoom), the
    // slider, Reset view and Play.
    const zi = info.zoom;
    if (zi) {
      if (m.zlog === undefined) m.zlog = zi.log;
      if (zi.log !== m.zlog) {
        m.goal = clamp(m.goal + ((zi.log - m.zlog) / LN10) * 4, Z_MIN, Z_MAX);
        m.zlog = zi.log;
        m.played = false;
      }
      if (m.resets === undefined) m.resets = zi.resets;
      if (zi.resets !== m.resets) {
        m.resets = zi.resets;
        m.goal = Z_HOME;
      }
    }
    const sl = info.slider;
    if (sl && sl.id === "zoom" && sl.n !== m.sliderN) {
      m.sliderN = sl.n;
      m.goal = Z_MAX - sl.value * (Z_MAX - Z_MIN);
    }
    const playing = c.play > 0.0005;
    if (playing) {
      m.goal = journey(1 - c.play);
      m.z = m.goal;
    } else m.z += (m.goal - m.z) * (1 - Math.exp(-dt / 0.18));
    if (CLIP.z !== null) m.goal = m.z = CLIP.z;
    const z = m.z;
    // Which chunks: built near the view, freed far from it.
    const lay = layout(z);
    ch.want("backdrop");
    for (const l of LAYERS) {
      const d = l.e - z;
      if (d > -2.2 && d < 1.8) ch.want(l.id);
      else if ((d < -3.2 || d > 2.8) && ch.state(l.id) !== "none") ch.drop(l.id);
    }
    out.chunks = { backdrop: { scale: 1, fade: 1 } };
    let rank = 0;
    for (const l of LAYERS) {
      const p = lay[l.id];
      rank++;
      if (!p || ch.state(l.id) !== "ready") continue;
      // Finer layers a hair nearer, so each draws over the one it sits in.
      out.chunks[l.id] = { scale: p.scale, offset: [0, 0, 0.0004 * rank], fade: p.fade };
    }
    // The words beside the view: the power of ten, the stop and its source,
    // and a scale bar.
    const stop = stopAt(z);
    const view = 10 ** z;
    const r = rulerFor(view * 0.14);
    out.legend = {
      title: power(Math.round(z)),
      items: [
        { text: stop.label },
        { text: stop.source, dim: true },
        { text: r.text, ruler: { size: (r.meters / view) * U } },
      ],
    };
    out.slider = { id: "zoom", label: "Zoom", value: (Z_MAX - z) / (Z_MAX - Z_MIN) };
    if (!playing && Math.abs(m.goal - m.z) < 1e-4) m.z = m.goal;
  },
  build(k) {
    // Nothing of its own but four clear splats that frame the view (every
    // scene is a chunk).
    const h = U / 2;
    for (const p of [
      [h, 0, 0],
      [-h, 0, 0],
      [0, h, 0],
      [0, -h, 0],
    ])
      k.reach(p);
    k.cloud({ count: (4 * 160000) / k.count, jitter: 0 }, (_r, i) => ({
      p: [
        [h, 0, 0],
        [-h, 0, 0],
        [0, h, 0],
        [0, -h, 0],
      ][i],
      color: [0, 0, 0],
      size: 0.01,
      opacity: 0,
    }));
  },
};

export const RECIPES = { "powers-of-ten": RECIPE };

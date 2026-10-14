// Space r4 pack (lane Space r4, labs): the solar system on real orbits.
//
// The planets move on JPL's Keplerian elements (Table 1, 1800 to 2050), the
// Moon, the four Galilean moons and Titan on JPL's satellite elements, four
// famous comets and a few thousand asteroids (a random sample of the JPL
// Small-Body Database's numbered asteroids) on their own elements, by
// Kepler's laws (src/space/kepler.js). The planets, moons and comets are kit
// tokens the drive places every frame; the asteroids move on the graphics
// chip (src/space/orbit-field.js). A date slider over the stage, a speed
// control (paused to a year a second), a tap that flies to the next planet,
// and two scales: true (distances and sizes to one scale) and readable.
//
// The data: assets/toys/solar-orbits/ (tools/sp4-orbits.mjs).

import { BITMAP } from "../font.js";
import { decodeJpeg } from "../space/maps.js";
import { packNormal } from "../space/field.js";
import { orbitModifier } from "../space/orbit-field.js";
import {
  PLANETS,
  SUN_RADIUS_KM,
  AU_KM,
  MU,
  R0,
  SCALES,
  julianDay,
  msOfJd,
  planetPos,
  planetElements,
  keplerState,
  keplerPos,
  orbitPoints,
  moonOffset,
  poleEcliptic,
  asteroidOrbit,
  drawn,
} from "../space/kepler.js";

const TAU = Math.PI * 2;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
const unit = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
// The J2000 ecliptic (x, y, z north) in the toy's frame (y up).
const toToy = (v) => [v[0], v[2], -v[1]];

// The years JPL's Table 1 is made for.
export const DATE_MIN = julianDay(Date.UTC(1800, 0, 1));
export const DATE_MAX = julianDay(Date.UTC(2050, 11, 31));
// Speed: 0 is paused; above, from an hour a second to a year a second.
export const SPEED_MIN = 1 / 24;
export const SPEED_MAX = 365.25;
export function daysPerSecond(v) {
  if (!(v > 0.02)) return 0;
  return SPEED_MIN * Math.pow(SPEED_MAX / SPEED_MIN, (v - 0.02) / 0.98);
}
export function speedText(d) {
  if (!d) return "Paused";
  if (d < 1) return `${Math.max(1, Math.round(d * 24))} hours a second`;
  if (d < 1.5) return "A day a second";
  if (d < 60) return `${Math.round(d)} days a second`;
  if (d < 340) return `${Math.round(d / 30.44)} months a second`;
  return "A year a second";
}
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]; // prettier-ignore
export function dateText(jd) {
  const d = new Date(msOfJd(jd));
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

// Planets' looks: a map from Space r2 (shrunk by tools/sp4-orbits.mjs) or
// colored bands by latitude (sine of latitude, color), and each one's north
// pole (IAU, J2000 RA and Dec) so the bands and rings lie right.
const LOOKS = {
  mercury: { map: "mercury", pole: [281.01, 61.42] },
  venus: { bands: [[-1, "#d8c9a0"], [-0.4, "#e8dbb4"], [0.4, "#e6d6ad"], [1, "#d6c69c"]], pole: [272.76, 67.16] }, // prettier-ignore
  earth: { map: "earth", pole: [0, 90] },
  mars: { map: "mars", pole: [317.68, 52.89] },
  jupiter: { bands: [[-1, "#c9b9a0"], [-0.62, "#b49a7c"], [-0.45, "#d9cdb6"], [-0.3, "#a7805e"], [-0.12, "#e8dcc6"], [0.08, "#e3d3b8"], [0.2, "#a8805c"], [0.36, "#dccfb8"], [0.55, "#b39a7e"], [1, "#c4b6a0"]], pole: [268.06, 64.5] }, // prettier-ignore
  saturn: { bands: [[-1, "#d9c9a2"], [-0.4, "#e1cf9f"], [-0.1, "#ead9ad"], [0.15, "#e6d3a4"], [0.4, "#d8c394"], [1, "#c9b78e"]], pole: [40.59, 83.54], rings: true }, // prettier-ignore
  uranus: {
    bands: [
      [-1, "#a9d6dc"],
      [1, "#b8e0e4"],
    ],
    pole: [257.31, -15.18],
  },
  neptune: { bands: [[-1, "#4a6fd6"], [-0.3, "#5a80e0"], [0.3, "#5378da"], [1, "#4467cc"]], pole: [299.36, 43.46] }, // prettier-ignore
};
const MOON_COLORS = { titan: "#d8a45a" };
const COMET_LOOK = { head: [0.82, 0.86, 0.92], tail: [0.62, 0.78, 1.0], coma: [0.75, 0.88, 1.0] };

// How big things are drawn on the readable scale (toy units: the Earth's
// orbit 1.61 from the Sun): sizes go as the 0.4th power of the real radius.
const READ_EARTH = 0.06;
const readSize = (km) => READ_EARTH * Math.pow(km / 6371, 0.4);
const READ_SUN = 0.39;
// Moons on the readable scale: each planet's moons squeezed toward it, the
// innermost 2.1 planet radii out (2.6 for Saturn, outside its rings).
const moonDrawnDist = (rp, a, aInner, ringed) => rp * ((ringed ? 2.6 : 2.1) + 1.17 * (Math.sqrt(a / aInner) - 1)); // prettier-ignore

const DATA = { orbits: null, maps: new Map() };
async function readBytes(rel) {
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
export async function loadOrbits() {
  if (!DATA.orbits) {
    const b = await readBytes("../../assets/toys/solar-orbits/orbits.json");
    DATA.orbits = JSON.parse(new TextDecoder().decode(b));
  }
  return DATA.orbits;
}
const MAP_IDS = ["mercury", "earth", "mars", "moon", "io", "europa", "ganymede", "callisto"];

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
function bandColor(bands, s) {
  for (let i = 1; i < bands.length; i++)
    if (s <= bands[i][0]) {
      const [a, ca] = bands[i - 1];
      const [b, cb] = bands[i];
      const t = clamp01((s - a) / (b - a || 1));
      const x = hex(ca);
      const y = hex(cb);
      return [0, 1, 2].map((k) => x[k] + (y[k] - x[k]) * t);
    }
  return hex(bands[bands.length - 1][1]);
}
function mapColor(img, lat, lon) {
  const x = Math.min(img.w - 1, Math.max(0, Math.floor(((lon / TAU + 0.5) % 1) * img.w)));
  const y = Math.min(img.h - 1, Math.max(0, Math.floor((0.5 - lat / Math.PI) * img.h)));
  const k = (y * img.w + x) * 3;
  return [img.rgb[k] / 255, img.rgb[k + 1] / 255, img.rgb[k + 2] / 255];
}

// A turn that lays a splat's x axis along dir.
function quatAlong(dir) {
  const a = unit(dir);
  const w = 1 + a[0];
  if (w < 1e-6) return [0, 0, 1, 0];
  const l = Math.hypot(0, -a[2], a[1], w);
  return [0, -a[2] / l, a[1] / l, w / l];
}
// A turn that lays a splat's z axis along n (a disc facing n).
function quatFacing(n) {
  const w = 1 + n[2];
  if (w < 1e-6) return [1, 0, 0, 0];
  const l = Math.hypot(-n[1], n[0], w);
  return [-n[1] / l, n[0] / l, 0, w / l];
}

// Per-toy memory for drive(), keyed by the control state object.
const MEM = new WeakMap();
function mem(c) {
  let m = MEM.get(c);
  if (!m) MEM.set(c, (m = {}));
  return m;
}
// What the last build put where (for gpuField and the drive).
const BUILT = { key: null };

const FLY = 3.2; // seconds a fly takes
// The shader's names are their built size at this camera distance (the
// home view's, in the toy's fitted units).
const NAME_DIST = 2.4;
// How far a name's letters are stored toward the home camera (fitted units).
const NAME_LIFT = [0.0033, 0.0102, 0.0067];

const SCALE_CHOICES = [
  { id: "readable", label: "Readable scale (not to scale)" },
  { id: "true", label: "True scale (tiny planets)" },
];
export const SCALE_NOTES = {
  readable:
    "Readable scale: not to scale. Each distance from the Sun is squeezed (drawn as its logarithm), so the inner planets spread out; directions are true. Planets and moons are drawn hundreds of times larger, and moons closer to their planets.",
  true: "True scale: distances and sizes on one scale. The planets are far too small to see from here; fly to one to find it.",
};

function bodyRadius(scale, km) {
  return scale === "true" ? km / AU_KM : readSize(km);
}

// Where everything is at a date, in the toy's frame (drawn): { sun, bodies:
// [p per token] } for the build's token list.
export function placesAt(bodies, scaleId, jd) {
  const sc = SCALES[scaleId];
  const cache = {};
  const planet = (id) => (cache[id] ||= planetPos(id, jd));
  return bodies.map((b) => {
    if (b.kind === 0) return drawn(planet(b.id), sc);
    if (b.kind === 2) return drawn(keplerPos(b.el, jd), sc);
    // A moon: true scale, its true place; readable, squeezed toward its
    // planet (direction true).
    const p = planet(b.planet);
    const off = moonOffset(b.moon, jd);
    if (scaleId === "true") return drawn(add(p, off), sc);
    return add(drawn(p, sc), mul(unit(toToy(off)), b.dist));
  });
}

const recipe = {
  kernel: "sharp",
  alive: true,
  turntable: false,
  // focus lets the drive own the view (it never takes a double-tap).
  focus: () => false,
  options: [
    { key: "scale", label: "Scale", type: "select", default: "readable", choices: SCALE_CHOICES },
    { key: "names", label: "Names", type: "switch", default: true },
  ],
  controls: [
    { key: "speed", label: "Speed", type: "slider", default: 0.72 },
    { key: "fly", label: "Fly to the next planet", type: "pulse", ease: 0.6 },
  ],
  action: { key: "fly", label: "Fly to the next planet" },
  note: "Positions from JPL's published orbital elements: the planets from E. M. Standish's Table 1 (1800 to 2050), the moons from JPL's satellite elements, and the comets and asteroids from the JPL Small-Body Database, each moved by Kepler's laws. The readable scale is not to scale (it says how).",
  credits: [
    {
      label: "Planets",
      title: "Approximate Positions of the Planets (E. M. Standish), Table 1",
      source: "https://ssd.jpl.nasa.gov/planets/approx_pos.html",
      author: "JPL Solar System Dynamics",
      license: "Public domain (NASA/JPL)",
    },
    {
      label: "Moons",
      title: "Planetary Satellite Mean Elements; JPL Horizons (Titan)",
      source: "https://ssd.jpl.nasa.gov/sats/elem/",
      author: "JPL Solar System Dynamics",
      license: "Public domain (NASA/JPL)",
    },
    {
      label: "Asteroids and comets",
      title: "JPL Small-Body Database (a snapshot of October 7, 2026)",
      source: "https://ssd.jpl.nasa.gov/tools/sbdb_query.html",
      author: "JPL Solar System Dynamics",
      license: "Public domain (NASA/JPL)",
    },
    {
      label: "Planet and moon maps",
      title: "The color maps of the real worlds (Space r2), shrunk",
      source: "https://science.nasa.gov/3d-resources/",
      author: "NASA, USGS (see the real worlds' credits)",
      license: "Public domain",
    },
  ],
  async prepare() {
    await loadOrbits();
    for (const id of MAP_IDS)
      if (!DATA.maps.has(id))
        DATA.maps.set(id, await decodeJpeg(await readBytes(`../../assets/toys/solar-orbits/maps/${id}.jpg`))); // prettier-ignore
  },
  gpuField(o, fit) {
    const b = BUILT.data;
    if (!b || !fit) return null;
    const c = fit.center || [0, 0, 0];
    const s = fit.scale ?? 1;
    const f = (p) => [(p[0] - c[0]) * s, (p[1] - c[1]) * s, (p[2] - c[2]) * s];
    const pole = b.ringPole;
    return orbitModifier({
      center: c,
      scale: s,
      readable: b.scale === "readable",
      r0: R0,
      mu: MU,
      // (On the true scale the inner planets' and the short comets' names
      // would pile up round the Sun: they show only close up, as moons'.)
      bodies: b.bodies.map((x) => ({ c: f(x.built), r: x.r * s * (LOOKS[x.id]?.rings ? 2.3 : 1), kind: x.kind === 1 || (b.scale === "true" && x.crowded) ? 1 : x.kind })), // prettier-ignore
      tailLen: b.scale === "true" ? 0.6 : 0.9,
      nameDist: NAME_DIST,
      ringPole: `vec3(${pole.map((v) => v.toFixed(6)).join(", ")})`,
      nameLift: NAME_LIFT,
    });
  },
  drive(t, c, out, info) {
    const m = mem(c);
    const d = info?.data;
    if (!d) return;
    const dt = m.t === undefined ? 0 : Math.max(0, Math.min(0.25, t - m.t));
    m.t = t;
    if (m.jd === undefined) m.jd = Math.min(DATE_MAX, Math.max(DATE_MIN, d.startJd ?? julianDay(Date.now()))); // prettier-ignore
    // The date slider over the stage.
    const sl = info.slider;
    if (sl && String(sl.id).startsWith("date") && sl.n !== m.sliderN) {
      if (m.sliderN !== undefined || sl.n > 0) m.jd = DATE_MIN + clamp01(sl.value) * (DATE_MAX - DATE_MIN); // prettier-ignore
      m.sliderN = sl.n;
    }
    const speed = daysPerSecond(c.speed);
    m.jd += speed * dt;
    if (m.jd > DATE_MAX) m.jd = DATE_MIN;
    const jd = m.jd;
    const frac = (jd - DATE_MIN) / (DATE_MAX - DATE_MIN);
    const date = dateText(jd);
    out.slider = { id: `date ${date}`, label: "Date", value: frac };

    // Every body's place.
    const now = placesAt(d.bodies, d.scale, jd);
    out.tokens = now.map((p, i) => ({ offset: sub(p, d.bodies[i].built) }));
    if (t - (m.sorted ?? -1) > 0.5) {
      m.sorted = t;
      out.resort = true;
    }

    // The fly: each tap visits the next planet, then the whole system.
    const tour = d.tour;
    const fire = c.fly > (m.lastFly ?? 0) + 0.02;
    m.lastFly = c.fly;
    if (fire) {
      m.from = m.to ?? -1;
      m.to = m.to === undefined || m.to === -1 ? 0 : m.to + 1 >= tour.length ? -1 : m.to + 1;
      m.flyT = t;
    }
    const to = m.to ?? -1;
    const from = m.from ?? -1;
    const w = m.flyT === undefined ? 1 : clamp01((t - m.flyT) / FLY);
    const S = d.fitScale;
    const at = (k) => (k < 0 ? [0, 0, 0] : now[tour[k].token]);
    const lz = (k) => (k < 0 ? 0 : Math.log(0.42 / (tour[k].region * S)));
    // Out from the first, across, then in to the next.
    const out1 = ease(w / 0.4);
    const across = ease((w - 0.25) / 0.5);
    const in2 = ease((w - 0.6) / 0.4);
    const Fr = add(mul(at(from), 1 - across), mul(at(to), across));
    const logZ = lz(from) * (1 - out1) + lz(to) * in2;
    const zoom = Math.exp(logZ);
    const F = mul(sub(Fr, d.fitCenter), S);
    out.morph = [jd - d.epochJD, F[0], F[1], F[2]];
    const shown = to >= 0 && w > 0.5 ? tour[to].token : -1;
    // The view turns about the vertical so a visited planet's sunlit side
    // faces the camera, three quarters on.
    const cam = info.view ?? 0.35;
    const turn = (k) => {
      if (k < 0) return 0;
      const p = now[tour[k].token];
      const th = cam + 0.75 - Math.atan2(-p[0], -p[2]);
      return th - TAU * Math.round(th / TAU);
    };
    const ta = turn(from);
    let tb = turn(to);
    tb = ta + (tb - ta - TAU * Math.round((tb - ta) / TAU));
    out.glow = [zoom, d.names ? 1 : 0, shown, ta + (tb - ta) * across];

    // The words beside the view.
    const items = [{ text: speedText(speed) }];
    if (to >= 0) {
      const b = d.bodies[tour[to].token];
      const r = Math.hypot(...planetPos(b.id, jd));
      items.push({ text: `${b.name}: ${r.toFixed(2)} au from the Sun`, on: true });
    }
    items.push({ text: d.scale === "true" ? "True scale" : "Readable scale: not to scale", dim: true }); // prettier-ignore
    out.legend = { title: date, items };
  },
  build(k, o) {
    const D = DATA.orbits;
    if (!D) throw new Error("The orbits haven't loaded.");
    const scaleId = o.scale === "true" ? "true" : "readable";
    const sc = SCALES[scaleId];
    const jd0 = D.asteroids.epochJD;
    const isTrue = scaleId === "true";
    // The toy's reach: Halley's aphelion, a little over.
    const halley = D.comets.find((x) => x.id === "halley");
    const far = sc.dist(halley.a * (1 + halley.e)) * 1.03;
    for (const s of [-1, 1]) {
      k.reach([s * far, 0, 0]);
      k.reach([0, s * far, 0]);
      k.reach([0, 0, s * far]);
    }
    const S = 0.95 / far; // the fit's scale (the reach is the farthest)
    const per = (n) => (n * 160000) / k.count + 1;
    const cloud = (list, opts, fn) =>
      k.cloud({ count: per(list.length), jitter: 0, pattern: false, ...opts }, (_r, i) =>
        i < list.length ? fn(list[i], i) : null,
      );

    // ---- The Sun ----
    const sunR = isTrue ? SUN_RADIUS_KM / AU_KM : READ_SUN;
    const sunPts = [];
    const ns = 9000;
    const g = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < ns; i++) {
      const y = 1 - ((i + 0.5) / ns) * 2;
      const r = Math.sqrt(1 - y * y);
      sunPts.push([Math.cos(g * i) * r, y, Math.sin(g * i) * r]);
    }
    cloud(sunPts, {}, (u, i) => {
      const h = Math.sin(i * 12.9898) * 43758.5453;
      const f = 0.86 + 0.14 * (h - Math.floor(h)); // (granulation, a random brightness)
      return { p: mul(u, sunR), scales: [sunR * 0.05, sunR * 0.05, sunR * 0.05], color: [1, 0.86 * f, 0.5 * f], opacity: 0.97, params: [0, 0] }; // prettier-ignore
    });
    const glow = sunPts.filter((_, i) => i % 24 === 0);
    cloud(glow, {}, (u) => {
      const s = sunR * (isTrue ? 4 : 0.2);
      return { p: mul(u, sunR * 1.02), scales: [s, s, s], color: [1, 0.72, 0.3], opacity: 0.035, params: [0, 2] }; // prettier-ignore
    });

    // ---- Tokens: planets, moons, comets ----
    const bodies = [];
    for (const p of PLANETS) {
      const pos = drawn(planetPos(p.id, jd0), sc);
      bodies.push({ kind: 0, id: p.id, name: p.name, built: pos, r: bodyRadius(scaleId, p.radiusKm), km: p.radiusKm }); // prettier-ignore
    }
    for (const mo of D.moons) {
      const pi = bodies.findIndex((b) => b.id === mo.planet);
      const pl = bodies[pi];
      const siblings = D.moons.filter((x) => x.planet === mo.planet);
      const aInner = Math.min(...siblings.map((x) => x.a));
      const ringed = !!LOOKS[mo.planet].rings;
      const dist = isTrue ? mo.a / AU_KM : moonDrawnDist(pl.r, mo.a, aInner, ringed);
      bodies.push({ kind: 1, id: mo.id, name: mo.name.replace(/^the /, ""), moon: mo, planet: mo.planet, planetIndex: pi, dist, built: null, r: bodyRadius(scaleId, mo.radiusKm) }); // prettier-ignore
    }
    for (const cm of D.comets) {
      const el = { a: cm.a, e: cm.e, i: cm.i, node: cm.node, peri: cm.peri, M: cm.M, epochJD: cm.epochJD }; // prettier-ignore
      bodies.push({ kind: 2, id: cm.id, name: cm.name, label: cm.label, el, built: null, r: isTrue ? 5 / AU_KM : 0.012 }); // prettier-ignore
    }
    for (const b of bodies) b.crowded = ["mercury", "venus", "earth", "mars", "encke", "tempel-1", "67p"].includes(b.id); // prettier-ignore
    const placed = placesAt(bodies, scaleId, jd0);
    bodies.forEach((b, i) => (b.built = placed[i]));

    // Planets and moons: balls of splats, colored by their maps or bands.
    const ballPts = (n) => {
      const out = [];
      for (let i = 0; i < n; i++) {
        const y = 1 - ((i + 0.5) / n) * 2;
        const r = Math.sqrt(1 - y * y);
        out.push([Math.cos(g * i) * r, y, Math.sin(g * i) * r]);
      }
      return out;
    };
    const poleOf = (look) => toToy(poleEcliptic(look.pole[0], look.pole[1]));
    let ringPole = [0, 1, 0];
    bodies.forEach((b, ti) => {
      if (b.kind === 2) return;
      const look = b.kind === 0 ? LOOKS[b.id] : LOOKS[b.planet];
      const pole = poleOf(look);
      const e1 = unit(cross(pole, Math.abs(pole[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1]));
      const e2 = cross(pole, e1);
      const big = b.kind === 0 && b.km > 20000;
      const n = b.kind === 0 ? (big ? 6000 : 3500) : 1200;
      const pts = ballPts(n);
      const mapId = b.kind === 0 ? look.map : b.moon.map;
      const img = mapId ? DATA.maps.get(mapId) : null;
      const flat = b.kind === 1 && !img ? hex(MOON_COLORS[b.id] || "#a8a29a") : null;
      const sz = b.r * (2.9 / Math.sqrt(n));
      cloud(pts, {}, (u) => {
        const s = dot(u, pole);
        const lat = Math.asin(Math.max(-1, Math.min(1, s)));
        const lon = Math.atan2(dot(u, e2), dot(u, e1));
        let col = img ? mapColor(img, lat, lon) : flat || bandColor(look.bands, s);
        // (The Earth's dark oceans, a little brighter so its lit side reads.)
        if (mapId === "earth") col = col.map((x) => Math.min(1, x * 1.5 + 0.03));
        return { p: add(b.built, mul(u, b.r)), scales: [sz, sz, sz], color: col, opacity: 0.98, kind: "token", params: [ti, 0] }; // prettier-ignore
      });
      if (b.kind === 0 && look.rings) {
        ringPole = pole;
        // Saturn's rings: 1.24 to 2.27 planet radii, the Cassini division
        // at about 1.95 to 2.03 (from the C ring to the A ring's edge).
        const rings = [];
        const nr = 20000;
        for (let i = 0; i < nr; i++) {
          const f = (i + 0.5) / nr;
          let rr = 1.24 + 1.03 * Math.sqrt(f * 0.5 + 0.5 * f * f);
          if (rr > 1.95 && rr < 2.03) rr = 2.03 + (rr - 1.95);
          if (rr > 2.27) rr = 2.27 - (rr - 2.27);
          const a = i * g;
          rings.push({ rr, a });
        }
        const rsz = b.r * 0.02;
        cloud(rings, {}, ({ rr, a }) => {
          const dir = add(mul(e1, Math.cos(a)), mul(e2, Math.sin(a)));
          const tone = rr < 1.53 ? 0.55 : rr < 1.95 ? 0.95 : 0.8;
          return { p: add(b.built, mul(dir, b.r * rr)), scales: [rsz, rsz, rsz * 0.15], quat: quatFacing(pole), color: [0.86 * tone, 0.78 * tone, 0.62 * tone], opacity: rr < 1.53 ? 0.5 : 0.85, kind: "token", params: [ti, 4] }; // prettier-ignore
        });
      }
    });

    // Moons' orbits round their planets (they ride with the planet).
    bodies.forEach((b) => {
      if (b.kind !== 1) return;
      const pl = bodies[b.planetIndex];
      const o1 = toToy(moonOffset(b.moon, jd0));
      const o2 = toToy(moonOffset(b.moon, jd0 + b.moon.P / 4));
      const nrm = unit(cross(o1, o2));
      const u1 = unit(o1);
      const u2 = cross(nrm, u1);
      const n = 160;
      const pts = [];
      for (let j = 0; j < n; j++) {
        const a = (j / n) * TAU;
        pts.push({ p: add(pl.built, add(mul(u1, b.dist * Math.cos(a)), mul(u2, b.dist * Math.sin(a)))), dir: add(mul(u1, -Math.sin(a)), mul(u2, Math.cos(a))) }); // prettier-ignore
      }
      const len = (TAU * b.dist) / n;
      cloud(pts, {}, (e) => ({ p: e.p, scales: [len * 0.55, len * 0.05, len * 0.05], quat: quatAlong(e.dir), color: [0.45, 0.5, 0.62], opacity: 0.35, kind: "token", params: [b.planetIndex, 5] })); // prettier-ignore
    });

    // Comets: a nucleus, a coma and a tail the program points away from the Sun.
    bodies.forEach((b, ti) => {
      if (b.kind !== 2) return;
      const pts = ballPts(150);
      cloud(pts, {}, (u) => ({ p: add(b.built, mul(u, b.r)), scales: [b.r * 0.4, b.r * 0.4, b.r * 0.4], color: COMET_LOOK.head, opacity: 0.95, kind: "token", params: [ti, 0] })); // prettier-ignore
      const comaR = isTrue ? 0.02 : 0.03;
      cloud(ballPts(90), {}, (u, i) => {
        const f = 0.3 + 0.7 * ((i * 0.618) % 1);
        return { p: add(b.built, mul(u, comaR * f)), scales: [comaR * 0.5, comaR * 0.5, comaR * 0.5], color: COMET_LOOK.coma, opacity: 0.12, kind: "token", params: [ti, 2] }; // prettier-ignore
      });
      const tail = [];
      for (let i = 0; i < 1400; i++) {
        const f = Math.pow((i + 0.5) / 1400, 0.8);
        const a = i * g;
        const rr = (isTrue ? 0.012 : 0.01) * Math.sqrt(((i * 0.381966) % 1) + 0.05);
        tail.push({ f, off: [Math.cos(a) * rr, Math.sin(a) * rr * 0.7, Math.sin(a * 1.7) * rr] });
      }
      cloud(tail, {}, (e) => {
        const z = (isTrue ? 0.018 : 0.016) * (0.5 + e.f);
        return { p: add(b.built, e.off), scales: [z, z, z], color: COMET_LOOK.tail, opacity: 0.3, kind: "token", params: [ti, 1 + Math.min(0.999, e.f)] }; // prettier-ignore
      });
    });

    // ---- Orbit lines (still: drawn for the snapshot's date) ----
    const line = (pts, color, opacity) => {
      const segs = [];
      for (let j = 0; j < pts.length; j++) {
        const a = pts[j];
        const b2 = pts[(j + 1) % pts.length];
        segs.push({ p: mul(add(a, b2), 0.5), dir: sub(b2, a), len: Math.hypot(...sub(b2, a)) });
      }
      cloud(segs, {}, (s) => ({ p: s.p, scales: [s.len * 0.6, 0.002, 0.002], quat: quatAlong(s.dir), color, opacity, params: [0, 1] })); // prettier-ignore
    };
    for (const p of PLANETS) {
      const pts = orbitPoints(planetElements(p.id, jd0), 720).map((q) => drawn(q, sc));
      line(pts, [0.42, 0.5, 0.68], 0.5);
    }
    for (const b of bodies)
      if (b.kind === 2) line(orbitPoints(b.el, 900).map((q) => drawn(q, sc)), [0.3, 0.55, 0.75], 0.35); // prettier-ignore

    // ---- Asteroids (moved on the graphics chip) ----
    const big = new Set(D.asteroids.big);
    const rows = D.asteroids.list;
    const aSize = isTrue ? 0.012 : 0.005;
    cloud(rows, {}, (row) => {
      const st = keplerState(asteroidOrbit(row, jd0), jd0);
      const p = drawn(st.p, sc);
      const v = unit(toToy(st.v));
      const H = row[7];
      const bright = Math.max(0.45, Math.min(1, 1.25 - 0.045 * (H - 6)));
      const z = aSize * (big.has(row[0]) ? 1.8 : 1);
      return { p, scales: [z, z, z], color: [0.66 * bright, 0.6 * bright, 0.52 * bright], opacity: 0.9, params: [row[1], packNormal(v)] }; // prettier-ignore
    });

    // ---- Names (fit: false; the program keeps them a steady size) ----
    const px = 0.0062 / S; // a dot's pitch, toy units, at the home view
    bodies.forEach((b, ti) => {
      const text = (b.label || b.name).toUpperCase().replace(/[^0-9A-Z.,'!?\- ]/g, "");
      const dots = [];
      text.split("").forEach((ch, ci) => {
        const gl = BITMAP[ch];
        if (!gl) return;
        for (let gy = 0; gy < 7; gy++)
          for (let gx = 0; gx < 5; gx++)
            if ((gl[gy] >> (4 - gx)) & 1) dots.push([(ci * 6 + gx + 3) * px, (3 - gy) * px]);
      });
      const shade = b.kind === 1 ? [0.9, 0.9, 0.82] : b.kind === 2 ? [0.72, 0.87, 1] : [1, 1, 1];
      // White letters on a dark shadow, readable on a light or a dark
      // background. The letters are stored a little toward the home view's
      // camera (NAME_LIFT), so the sort draws them over their shadow; the
      // program takes the lift off again.
      cloud(dots, { fit: false }, (dd) => ({ p: add(b.built, [dd[0] + px * 0.3, dd[1] - px * 0.3, 0]), scales: [px * 0.62, px * 0.62, px * 0.62], color: [0.05, 0.07, 0.12], opacity: 0.9, kind: "token", params: [ti, 3] })); // prettier-ignore
      // (Each letter dot is nine small splats in a square, so the letters' edges stay crisp.)
      const sub = dots.flatMap((dd) => [-0.33, 0, 0.33].flatMap((ox) => [-0.33, 0, 0.33].map((oy) => [dd[0] + ox * px, dd[1] + oy * px]))); // prettier-ignore
      cloud(sub, { fit: false }, (dd) => ({ p: add(b.built, add([dd[0], dd[1], 0], mul(NAME_LIFT, 1 / S))), scales: [px * 0.22, px * 0.22, px * 0.22], color: shade, opacity: 0.97, kind: "token", params: [ti, 3.25] })); // prettier-ignore
    });

    // The tour: the eight planets, each framed with its moons.
    const tour = bodies
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => b.kind === 0)
      .map(({ b, i }) => {
        const moons = bodies.filter((x) => x.kind === 1 && x.planet === b.id);
        const outer = Math.max(0, ...moons.map((x) => x.dist));
        const region = isTrue ? Math.max(6 * b.r, 1.2 * outer) : Math.max(2.4 * b.r * (LOOKS[b.id].rings ? 1.15 : 1), 1.15 * outer); // prettier-ignore
        return { token: i, region };
      });
    BUILT.data = { scale: scaleId, bodies, ringPole };
    k.data = {
      scale: scaleId,
      bodies: bodies.map((b) => ({ kind: b.kind, id: b.id, name: b.name, built: b.built, el: b.el, moon: b.moon, planet: b.planet, dist: b.dist })), // prettier-ignore
      tour,
      names: o.names !== false,
      epochJD: jd0,
      fitScale: S,
      fitCenter: [0, 0, 0],
      asteroids: rows.length,
    };
  },
};

export const RECIPES = { "solar-orbits": recipe };

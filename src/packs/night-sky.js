// Lane Night sky (docs/handoff/NightSky.md): the stars and planets over you, for any date, time
// and place, seen from the ground (the camera stands at the dome's center: recipe.inside).
//
// - Stars: the HYG database v4.1 to magnitude 6 (CC BY-SA 4.0), one splat each, sized by
//   brightness and colored by temperature (from B-V). They sit on the sky at their J2000
//   positions and turn as one part: precession to the date, then the sky's turn for the place's
//   sidereal time (src/sky/astro.js).
// - Constellation lines: the Stellarium team's Western sky culture (CC BY-SA), a second part.
// - The Sun, the Moon and the seven planets: one part each, placed every frame by JPL's
//   approximate elements and the Astronomical Almanac's lunar series. The Moon is a small ball
//   lit on the side that faces the Sun, so its phase is the real geometry seen from here.
// - Daylight and twilight: fade layers on channels 0 and 1, so stars go out faintest first as
//   the Sun rises, and a glow on the horizon follows the Sun's azimuth.
// - The place lives in memory only. "Use my location" asks the browser when tapped; the
//   coordinates are never saved, put in a link or sent anywhere (CLAUDE.md, "Live data").

import { quatAxisAngle, quatFromTo } from "../kit.js";
import { BITMAP } from "../font.js";
import {
  sky,
  fromRaDec,
  bvToKelvin,
  kelvinToRgb,
  phaseName,
  TABLE_YEARS,
  PLANETS,
} from "../sky/astro.js";
import {
  CITIES,
  DEFAULT_CITY,
  cityById,
  deviceZone,
  toLocalInput,
  fromLocalInput,
  formatWhen,
  formatLatLon,
  compass,
} from "../sky/places.js";

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

// Layer radii (recipe units): nearer the viewer draws over farther.
const R = { night: 1.0, day: 0.99, glow: 0.985, lines: 0.972, milky: 0.968, stars: 0.96, body: 0.93, mark: 0.925, ground: 0.9, letters: 0.895 }; // prettier-ignore

// Horizontal (ENU: east, north, up) to the scene (+X east, +Y up, +Z south) and back.
const sc = (e) => [e[0], e[2], -e[1]];
const enuOf = (s) => [s[0], -s[2], s[1]];
const norm = (v) => {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// A rotation matrix (row-major) as a quaternion [x, y, z, w].
function quatFromMatrix(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const tr = a + e + i;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    return [(h - f) / s, (c - g) / s, (d - b) / s, 0.25 * s];
  }
  if (a > e && a > i) {
    const s = Math.sqrt(1 + a - e - i) * 2;
    return [0.25 * s, (b + d) / s, (c + g) / s, (h - f) / s];
  }
  if (e > i) {
    const s = Math.sqrt(1 + e - a - i) * 2;
    return [(b + d) / s, 0.25 * s, (f + h) / s, (c - g) / s];
  }
  const s = Math.sqrt(1 + i - a - e) * 2;
  return [(c + g) / s, (f + h) / s, 0.25 * s, (d - b) / s];
}

// The J2000-to-scene matrix: the sky's turn for a time and place, in scene axes.
const sceneMatrix = (M) => [M[0], M[1], M[2], M[6], M[7], M[8], -M[3], -M[4], -M[5]];

// A unit vector's frame as a quaternion: x along `along`, z along `out` (made perpendicular).
function quatFrame(along, out) {
  const z = norm(out);
  const x = norm(along.map((v, i) => v - z[i] * dot(along, z)));
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  return quatFromMatrix([x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]]);
}

// Angular size (degrees, a Gaussian's sigma) and opacity of a point of light by magnitude.
export const starSigma = (mag) => clamp(0.11 * Math.pow(10, -0.075 * (mag - 6)), 0.11, 0.42);
export const starAlpha = (mag) => clamp(1.05 - (mag - 0.5) * 0.1, 0.5, 1);
// The daylight level (channel 0) at which a point of that magnitude goes out.
const fadeAt = (mag) => clamp(0.03 + (6 - mag) * 0.075, 0.03, 0.9);

// Daylight (0 night .. 1 full day) and twilight glow for the Sun's altitude.
export function skyLight(sunAlt) {
  const day = clamp((sunAlt + 18) / 22, 0, 1);
  const glow = sunAlt > 8 || sunAlt < -18 ? 0 : Math.exp(-(((sunAlt + 3) / 6.5) ** 2));
  return { day, glow };
}

// ---- The catalog ------------------------------------------------------------------------------

const CAT = { data: null, vec: null, conName: new Map() };

async function readCatalog() {
  if (CAT.data) return CAT.data;
  const url = new URL("../../assets/toys/night-sky/sky.json", import.meta.url);
  let text;
  if (url.protocol === "file:") {
    const fs = await import("node:fs/promises");
    text = await fs.readFile(url, "utf8");
  } else {
    const r = await fetch(url);
    if (!r.ok) throw new Error("Could not load the star catalog.");
    text = await r.text();
  }
  const d = JSON.parse(text);
  CAT.data = d;
  CAT.vec = d.ra.map((ra, i) => fromRaDec(ra, d.dec[i]));
  for (const c of d.constellations) CAT.conName.set(c.iau, c.name);
  return d;
}

// ---- State (memory only) ----------------------------------------------------------------------

const SPEEDS = [
  { id: "1", label: "Real time", rate: 1 },
  { id: "60", label: "1 minute a second", rate: 60 },
  { id: "600", label: "10 minutes a second", rate: 600 },
  { id: "3600", label: "1 hour a second", rate: 3600 },
  { id: "86164", label: "1 sidereal day a second (the stars hold still)", rate: 86164.0905 },
  { id: "0", label: "Stopped", rate: 0 },
];

const MIN_MS = Date.UTC(TABLE_YEARS[0], 0, 1);
const MAX_MS = Date.UTC(TABLE_YEARS[1], 11, 31, 23, 59);

export const SKY = {
  place: { ...cityById(DEFAULT_CITY) },
  anchorSky: null, // the sky's time (ms) at the toy clock's anchorT
  anchorT: 0,
  t: 0,
  rate: 1,
  speed: "1",
  picked: null, // { kind: "star" | "body", i | name }
  pickedAt: 0,
  last: null, // the last frame's sky (for taps and the panel)
  locating: false,
  locError: "",
};

const skyTime = () => {
  const ms = SKY.anchorSky + (SKY.t - SKY.anchorT) * 1000 * SKY.rate;
  return clamp(ms, MIN_MS, MAX_MS);
};

function setTime(ms) {
  SKY.anchorSky = clamp(ms, MIN_MS, MAX_MS);
  SKY.anchorT = SKY.t;
  refreshPanel();
}

function setSpeed(id) {
  const s = SPEEDS.find((x) => x.id === id) || SPEEDS[0];
  SKY.anchorSky = skyTime();
  SKY.anchorT = SKY.t;
  SKY.rate = s.rate;
  SKY.speed = s.id;
  refreshPanel();
}

function setPlace(p) {
  SKY.place = p;
  SKY.picked = null;
  refreshPanel();
}

// ---- Facts for a tap --------------------------------------------------------------------------

const BODY_NAMES = { sun: "the Sun", moon: "the Moon", mercury: "Mercury", venus: "Venus", mars: "Mars", jupiter: "Jupiter", saturn: "Saturn", uranus: "Uranus", neptune: "Neptune" }; // prettier-ignore
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const fmt = (n, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d }); // prettier-ignore
const where = (alt, az) =>
  alt < 0
    ? `Below the horizon (${fmt(-alt)}° under, toward ${compass(az)})`
    : `${fmt(alt)}° up, toward ${compass(az)} (azimuth ${fmt(az)}°)`;

function starTitle(i) {
  const d = CAT.data;
  return d.name[i] || d.des[i] || (d.hip[i] ? `HIP ${d.hip[i]}` : "A star");
}

function starFacts(i, s) {
  const d = CAT.data;
  const out = [];
  const con = CAT.conName.get(d.con[i]);
  const parts = [];
  if (d.name[i] && d.des[i]) parts.push(d.des[i]);
  if (con) parts.push(`in ${con}`);
  if (parts.length) out.push(parts.join(", "));
  out.push(`Magnitude ${fmt(d.mag[i], 2)}`);
  if (d.dist[i]) {
    const ly = d.dist[i] * 3.26156;
    out.push(`${ly < 100 ? fmt(ly, 1) : fmt(Math.round(ly / 10) * 10)} light-years away`);
  }
  if (d.ci[i] !== null) out.push(`About ${fmt(Math.round(bvToKelvin(d.ci[i]) / 100) * 100)} K at its surface (B−V ${fmt(d.ci[i], 2)})`); // prettier-ignore
  if (d.spect[i]) out.push(`Spectral type ${d.spect[i]}`);
  const enu = mulMV(s.matrix, CAT.vec[i]);
  const alt = Math.asin(clamp(enu[2], -1, 1)) * R2D;
  const az = ((Math.atan2(enu[0], enu[1]) * R2D) % 360 + 360) % 360;
  out.push(where(alt, az));
  return out;
}

const mulMV = (m, v) => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];

function bodyFacts(name, s) {
  const b = s.bodies[name];
  const out = [];
  if (name === "moon") {
    out.push(`${phaseName(b.illum, b.waxing)}, ${fmt(b.illum * 100)}% lit`);
    out.push(`${fmt(Math.round(b.distKm / 100) * 100)} km away`);
    out.push("Drawn three times its real size");
  } else if (name === "sun") {
    out.push(`${fmt(b.delta * 149.5978707, 1)} million km away`);
    out.push(`Its light takes ${fmt(b.delta * 8.3167, 1)} minutes to reach us`);
    out.push("Drawn three times its real size. Never look at the real Sun.");
  } else {
    out.push(`Magnitude ${fmt(b.mag, 1)}`);
    out.push(`${fmt(b.delta, 2)} au from Earth (${fmt(b.delta * 149.5978707)} million km)`);
    out.push(`Its light takes ${fmt(b.delta * 8.3167, 1)} minutes to reach us`);
    if (name === "mercury" || name === "venus") out.push(`${fmt(((1 + Math.cos(b.phase * D2R)) / 2) * 100)}% lit`); // prettier-ignore
  }
  out.push(where(b.alt, b.az));
  return out;
}

// The thing nearest a direction (scene), within a reach that grows with the field of view.
export function pickAt(dirScene, s = SKY.last, reachDeg = 4) {
  if (!s || !CAT.data) return null;
  const e = norm(enuOf(dirScene));
  let best = null;
  const consider = (cand, ang, mag) => {
    if (ang > reachDeg) return;
    const score = ang - 0.35 * clamp(6 - mag, 0, 8) * (reachDeg / 4);
    if (!best || score < best.score) best = { ...cand, score, ang };
  };
  for (const name of ["sun", "moon", ...PLANETS]) {
    const b = s.bodies[name];
    const ang = Math.acos(clamp(dot(e, b.enu), -1, 1)) * R2D;
    consider({ kind: "body", name }, ang - (name === "sun" || name === "moon" ? 1 : 0), Math.min(b.mag, 0) - 2); // prettier-ignore
  }
  const d = CAT.data;
  for (let i = 0; i < d.count; i++) {
    if (d.mag[i] > 6.2) continue;
    const v = mulMV(s.matrix, CAT.vec[i]);
    const c = dot(e, v);
    if (c < 0.99) continue; // within about 8 degrees
    consider({ kind: "star", i }, Math.acos(clamp(c, -1, 1)) * R2D, d.mag[i]);
  }
  return best;
}

// ---- The panel ---------------------------------------------------------------------------------

let panel = null;
const refreshPanel = () => panel?.refresh();

function renderPanel() {
  const box = document.createElement("div");
  box.className = "sky-panel";
  box.id = "sky-panel";
  const el = (tag, props = {}, ...kids) => {
    const n = Object.assign(document.createElement(tag), props);
    n.append(...kids);
    return n;
  };
  const row = (label, ...kids) => el("label", { className: "row" }, el("span", { textContent: label }), ...kids); // prettier-ignore

  // Place.
  const city = el("select", { id: "sky-city" });
  for (const c of CITIES) city.add(new Option(c.name, c.id));
  city.add(new Option("Your location or a typed place", "other"));
  city.addEventListener("change", () => {
    if (city.value !== "other") setPlace({ ...cityById(city.value) });
  });
  const locate = el("button", { type: "button", id: "sky-locate", textContent: "Use my location" });
  const locNote = el("p", { className: "note", id: "sky-loc-note" });
  locate.addEventListener("click", () => {
    if (!navigator.geolocation) {
      SKY.locError = "This browser can't give a location. Pick a city or type one below.";
      refreshPanel();
      return;
    }
    SKY.locating = true;
    SKY.locError = "";
    refreshPanel();
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        SKY.locating = false;
        const { latitude, longitude } = pos.coords;
        setPlace({ id: "me", name: "Your location", lat: latitude, lon: longitude, tz: deviceZone() }); // prettier-ignore
      },
      (err) => {
        SKY.locating = false;
        SKY.locError =
          err?.code === 1
            ? "Location is off for this page. Pick a city or type a place instead."
            : "Couldn't find your location. Pick a city or type a place instead.";
        refreshPanel();
      },
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 600000 },
    );
  });
  const lat = el("input", { type: "number", id: "sky-lat", min: -90, max: 90, step: "any", placeholder: "Latitude", inputMode: "decimal" }); // prettier-ignore
  const lon = el("input", { type: "number", id: "sky-lon", min: -180, max: 180, step: "any", placeholder: "Longitude", inputMode: "decimal" }); // prettier-ignore
  lat.setAttribute("aria-label", "Latitude (north positive)");
  lon.setAttribute("aria-label", "Longitude (east positive)");
  const typed = el("form", { className: "input-row", id: "sky-typed" }, lat, lon, el("button", { type: "submit", textContent: "Go" })); // prettier-ignore
  typed.addEventListener("submit", (e) => {
    e.preventDefault();
    const a = Number(lat.value);
    const o = Number(lon.value);
    if (!(lat.value !== "" && lon.value !== "" && Math.abs(a) <= 90 && Math.abs(o) <= 180)) {
      SKY.locError = "Type a latitude from −90 to 90 and a longitude from −180 to 180 (east positive).";
      refreshPanel();
      return;
    }
    SKY.locError = "";
    setPlace({ id: "typed", name: formatLatLon(a, o), lat: a, lon: o, tz: deviceZone() });
  });

  // Time.
  const now = el("button", { type: "button", id: "sky-now", textContent: "Now" });
  now.addEventListener("click", () => {
    setTime(Date.now());
    setSpeed("1");
  });
  const speed = el("select", { id: "sky-speed" });
  for (const s of SPEEDS) speed.add(new Option(s.label, s.id));
  speed.addEventListener("change", () => setSpeed(speed.value));
  const when = el("input", { type: "datetime-local", id: "sky-when" });
  when.min = `${TABLE_YEARS[0]}-01-01T00:00`;
  when.max = `${TABLE_YEARS[1]}-12-31T23:59`;
  const whenForm = el("form", { className: "input-row", id: "sky-when-form" }, when, el("button", { type: "submit", textContent: "Go" })); // prettier-ignore
  whenForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const ms = fromLocalInput(when.value, SKY.place.tz);
    if (Number.isFinite(ms)) setTime(ms);
  });
  const readout = el("p", { className: "note", id: "sky-readout" });

  box.append(
    row("Place", city),
    el("div", { className: "button-row" }, locate),
    typed,
    locNote,
    el("div", { className: "button-row" }, now),
    row("Speed", speed),
    whenForm,
    readout,
    el("p", {
      className: "note",
      textContent: `Drag to look around; pinch to zoom. Tap a star or a planet to name it. Dates from ${TABLE_YEARS[0]} to ${TABLE_YEARS[1]}, the years JPL's planet table is made for.`,
    }),
  );
  panel = {
    refresh() {
      const p = SKY.place;
      city.value = p.id === "me" || p.id === "typed" ? "other" : p.id;
      speed.value = SKY.speed;
      locate.disabled = SKY.locating;
      locate.textContent = SKY.locating ? "Finding you…" : "Use my location";
      if (SKY.locError) locNote.textContent = SKY.locError;
      else if (p.id === "me")
        locNote.textContent = `Using your location (about ${formatLatLon(p.lat, p.lon)}). It stays on this device: never saved, put in a link or sent anywhere.`; // prettier-ignore
      else if (p.id === "typed") locNote.textContent = `Showing ${p.name}, in your own time zone.`;
      else locNote.textContent = `${p.name}: ${formatLatLon(p.lat, p.lon)}.`;
      if (document.activeElement !== when && SKY.anchorSky !== null) when.value = toLocalInput(skyTime(), p.tz); // prettier-ignore
      if (SKY.anchorSky !== null) readout.textContent = formatWhen(skyTime(), p.tz);
    },
  };
  panel.refresh();
  return box;
}

// ---- Building the sky -------------------------------------------------------------------------

// Even points on the sphere between two altitudes (degrees), by the golden angle.
function* band(n, altLo, altHi) {
  const lo = Math.sin(altLo * D2R);
  const hi = Math.sin(altHi * D2R);
  const g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const z = lo + (hi - lo) * ((i + 0.5) / n);
    const r = Math.sqrt(1 - z * z);
    const a = i * g;
    yield { enu: [r * Math.sin(a), r * Math.cos(a), z], alt: Math.asin(z) * R2D, az: ((a * R2D) % 360 + 360) % 360 }; // prettier-ignore
  }
}

// A point splat: an explicit round size (sigma) in recipe units.
const dotSplat = (p, sigma, color, opacity, extra = {}) => ({
  p,
  scales: [sigma, sigma, sigma],
  quat: [0, 0, 0, 1],
  color,
  opacity,
  ...extra,
});

// A splat lying flat on the dome, facing the center.
const sheetSplat = (p, sigma, color, opacity, extra = {}) => ({
  p,
  scales: [sigma, sigma, sigma * 0.25],
  quat: quatFromTo([0, 0, 1], norm(p)),
  color,
  opacity,
  ...extra,
});

// The skyline: low hills, a degree or two high, from a few sines (the same for every place).
const skyline = (az) => {
  const a = az * D2R;
  return 0.55 + 0.45 * Math.sin(3 * a + 1.3) + 0.35 * Math.sin(7 * a + 0.4) + 0.2 * Math.sin(17 * a + 2.1) + 0.12 * Math.sin(41 * a); // prettier-ignore
};

// Fade params for the kit's "fade" kind: [level, width], a negative width fades in.
const FADE = "fade";

function buildSky(k, o) {
  const d = CAT.data;
  const N = k.count;
  const out = [];
  const push = (s) => out.push(s);
  const P = (name, pivot = [0, 0, 0]) => k.part(name, { pivot });
  const parts = {
    stars: P("stars"),
    lines: P("lines"),
    glow: P("glow"),
    mark: P("mark"),
  };
  const c0 = [0, R.body, 0];
  for (const b of ["sun", "moon", ...PLANETS]) parts[b] = P(b, c0);

  // The night sky, a gradient from the zenith to a faint glow at the horizon.
  const nNight = Math.round(N * 0.24);
  const spacing = (n, altLo, altHi) => Math.sqrt((2 * Math.PI * (Math.sin(altHi * D2R) - Math.sin(altLo * D2R))) / n); // prettier-ignore
  let sig = spacing(nNight, -4, 90) * 0.85;
  for (const q of band(nNight, -4, 90)) {
    const h = clamp(q.alt / 90, 0, 1);
    const col = mix([0.07, 0.075, 0.11], [0.008, 0.012, 0.035], Math.pow(h, 0.45));
    push(sheetSplat(sc(q.enu).map((v) => v * R.night), sig * R.night, col, 1));
  }
  // The day sky fades in over it as the Sun comes up (channel 0).
  const nDay = Math.round(N * 0.12);
  sig = spacing(nDay, -4, 90) * 0.9;
  for (const q of band(nDay, -4, 90)) {
    const h = clamp(q.alt / 90, 0, 1);
    const col = mix([0.7, 0.8, 0.92], [0.2, 0.42, 0.82], Math.pow(h, 0.5));
    push(sheetSplat(sc(q.enu).map((v) => v * R.day), sig * R.day, col, 1, { kind: FADE, params: [0.3, -0.69], channel: 0 })); // prettier-ignore
  }
  // Twilight: a glow on the horizon, made around north and turned to the Sun (channel 1).
  const nGlow = Math.round(N * 0.06);
  sig = spacing(nGlow, -3, 35) * 0.9;
  for (const q of band(nGlow, -3, 35)) {
    const daz = Math.min(q.az, 360 - q.az);
    const g = Math.exp(-((daz / 50) ** 2)) * Math.exp(-Math.max(0, q.alt) / 9) + 0.22 * Math.exp(-Math.max(0, q.alt) / 5); // prettier-ignore
    if (g < 0.03) continue;
    const col = mix([1.0, 0.5, 0.2], [0.6, 0.42, 0.7], clamp(q.alt / 25, 0, 1));
    push(sheetSplat(sc(q.enu).map((v) => v * R.glow), sig * R.glow, col, clamp(g, 0, 0.92), { part: parts.glow, kind: FADE, params: [0, -0.99], channel: 1 })); // prettier-ignore
  }

  // The Milky Way: a soft band along the galactic plane, brightest toward the center in
  // Sagittarius, with the stars (J2000; the north galactic pole at RA 192.859, Dec 27.128).
  const nMilky = Math.round(N * 0.07);
  const gp = fromRaDec(192.85948, 27.12825);
  const gc = fromRaDec(266.405, -28.936);
  const gy = norm([gp[1] * gc[2] - gp[2] * gc[1], gp[2] * gc[0] - gp[0] * gc[2], gp[0] * gc[1] - gp[1] * gc[0]]); // prettier-ignore
  let placed = 0;
  for (let i = 0; placed < nMilky && i < nMilky * 6; i++) {
    const r = k.rand();
    const l = k.rand() * 2 * Math.PI;
    const b = (k.rand() + k.rand() + k.rand() - 1.5) * 0.17 * (1 + 0.6 * Math.cos(l)); // radians
    const v = norm(gc.map((c, j) => Math.cos(b) * (Math.cos(l) * c + Math.sin(l) * gy[j]) + Math.sin(b) * gp[j])); // prettier-ignore
    const lane = Math.abs(b) < 0.02 && Math.cos(l) > 0.2 ? 0.45 : 1; // the dark rift near the center
    const bright = (0.35 + 0.65 * Math.max(0, Math.cos(l)) ** 2) * lane * (0.6 + 0.4 * r);
    push(sheetSplat(v.map((x) => x * R.milky), (0.55 + 0.6 * k.rand()) * D2R * R.milky, [0.78, 0.82, 0.95], 0.07 + 0.1 * bright, { part: parts.stars, kind: FADE, params: [0.02, 0.12], channel: 0 })); // prettier-ignore
    placed++;
  }

  // The stars, at their J2000 places, turned by their part.
  for (let i = 0; i < d.count; i++) {
    const m = d.mag[i];
    if (m > 6.0) continue;
    const ci = d.ci[i] ?? 0.6;
    const col = kelvinToRgb(bvToKelvin(clamp(ci, -0.4, 2.0)));
    const p = CAT.vec[i].map((x) => x * R.stars);
    const fade = { part: parts.stars, kind: FADE, params: [fadeAt(m), 0.08], channel: 0 };
    push(dotSplat(p, starSigma(m) * D2R * R.stars, col, starAlpha(m), fade));
    // A soft halo round the brightest.
    if (m < 1.6) push(dotSplat(p.map((x) => x * 1.002), starSigma(m) * 2.6 * D2R * R.stars, col, 0.16 + 0.05 * (1.6 - m), fade)); // prettier-ignore
  }

  // Constellation lines, along great circles, with a gap at each star.
  let arc = 0;
  for (const c of d.constellations)
    for (let j = 0; j < c.lines.length; j += 2)
      arc += Math.acos(clamp(dot(CAT.vec[c.lines[j]], CAT.vec[c.lines[j + 1]]), -1, 1)) * R2D;
  const step = Math.max(0.22, arc / Math.max(1000, N * 0.12)); // degrees between splats
  for (const c of d.constellations) {
    for (let j = 0; j < c.lines.length; j += 2) {
      const a = CAT.vec[c.lines[j]];
      const b = CAT.vec[c.lines[j + 1]];
      const ang = Math.acos(clamp(dot(a, b), -1, 1));
      const gap = 0.7 * D2R;
      if (ang < 2 * gap + step * D2R) continue;
      const n = Math.max(1, Math.round((ang - 2 * gap) / (step * D2R)));
      const s = Math.sin(ang);
      for (let u = 0; u <= n; u++) {
        const t = (gap + ((ang - 2 * gap) * u) / n) / ang;
        const w0 = Math.sin((1 - t) * ang) / s;
        const w1 = Math.sin(t * ang) / s;
        const v = norm(a.map((x, q) => w0 * x + w1 * b[q]));
        const tan = b.map((x, q) => x - a[q]);
        push({ p: v.map((x) => x * R.lines), scales: [step * 0.75 * D2R * R.lines, 0.045 * D2R * R.lines, 0.02 * D2R], quat: quatFrame(tan, v), color: [0.36, 0.52, 0.86], opacity: 0.6, part: parts.lines, kind: FADE, params: [0.2, 0.25], channel: 0 }); // prettier-ignore
      }
    }
  }

  // The Sun: a bright ball (three times its real size) with a soft glow round it.
  const ballR = R.body * Math.tan(0.8 * D2R);
  const sphere = (n, rr, fn) => {
    const g = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const z = 1 - (2 * (i + 0.5)) / n;
      const r = Math.sqrt(1 - z * z);
      const nv = [r * Math.cos(i * g), z, r * Math.sin(i * g)];
      fn(nv, c0.map((c, q) => c + nv[q] * rr));
    }
  };
  const ballSig = (n, rr) => Math.sqrt((4 * Math.PI * rr * rr) / n) * 0.75;
  sphere(260, ballR, (nv, p) => push(dotSplat(p, ballSig(260, ballR), [1, 0.96, 0.84], 1, { part: parts.sun }))); // prettier-ignore
  for (let i = 0; i < 90; i++) {
    const rr = ballR * (1.3 + 3.5 * k.rand());
    const nv = norm([k.rand() - 0.5, k.rand() - 0.5, k.rand() - 0.5]);
    push(dotSplat(c0.map((c, q) => c + nv[q] * rr * 0.6), ballR * (0.9 + 1.4 * k.rand()), [1, 0.88, 0.62], 0.1, { part: parts.sun })); // prettier-ignore
  }

  // The Moon: a ball lit on its +X side; drive turns +X toward the Sun.
  sphere(520, ballR, (nv, p) => {
    const lit = nv[0];
    if (lit >= 0) {
      const shade = 0.78 + 0.22 * Math.sqrt(lit);
      push(dotSplat(p, ballSig(520, ballR), [0.94 * shade, 0.92 * shade, 0.86 * shade], 1, { part: parts.moon })); // prettier-ignore
    } else {
      push(dotSplat(p, ballSig(520, ballR), [0.05, 0.055, 0.075], 1, { part: parts.moon, kind: FADE, params: [0.25, 0.4], channel: 0 })); // prettier-ignore
    }
  });

  // The planets: points of light, sized for magnitude 0 (drive scales them for their own).
  const PLANET_COLORS = { mercury: [0.88, 0.82, 0.74], venus: [1, 0.97, 0.88], mars: [1, 0.62, 0.4], jupiter: [0.99, 0.93, 0.82], saturn: [0.96, 0.88, 0.66], uranus: [0.72, 0.9, 0.95], neptune: [0.58, 0.72, 1] }; // prettier-ignore
  const PLANET_MAG = { mercury: 0, venus: -4, mars: 0.5, jupiter: -2.3, saturn: 0.6, uranus: 5.7, neptune: 7.8 }; // prettier-ignore
  for (const name of PLANETS) {
    const sg = starSigma(0) * 1.15 * D2R * R.body;
    const fade = { part: parts[name], kind: FADE, params: [fadeAt(PLANET_MAG[name] - 0.5), 0.08], channel: 0 }; // prettier-ignore
    push(dotSplat(c0, sg, PLANET_COLORS[name], 1, fade));
    push(dotSplat(c0, sg * 2.4, PLANET_COLORS[name], 0.18, fade));
  }

  // The marker round a tapped thing: a ring made at the zenith, turned to it.
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * 2 * Math.PI;
    const rr = R.mark * Math.tan(1.7 * D2R);
    push(dotSplat([Math.cos(a) * rr, R.mark, Math.sin(a) * rr], 0.1 * D2R * R.mark, [1, 0.84, 0.42], 0.95, { part: parts.mark })); // prettier-ignore
  }

  // The ground, up to a low skyline, and its daylight color.
  const nGround = Math.round(N * 0.1);
  sig = spacing(nGround, -90, 4) * 0.85;
  for (const q of band(nGround, -90, 4)) {
    if (q.alt > skyline(q.az)) continue;
    const near = clamp(-q.alt / 30, 0, 1);
    push(sheetSplat(sc(q.enu).map((v) => v * R.ground), sig * R.ground, [1,0,0], 1)); // prettier-ignore
  }
  const nGroundDay = Math.round(N * 0.04);
  sig = spacing(nGroundDay, -90, 4) * 0.9;
  for (const q of band(nGroundDay, -90, 4)) {
    if (q.alt > skyline(q.az) - 0.05) continue;
    push(sheetSplat(sc(q.enu).map((v) => v * (R.ground - 0.003)), sig * R.ground, mix([0.2, 0.24, 0.17], [0.1, 0.12, 0.08], clamp(-q.alt / 30, 0, 1)), 1, { kind: FADE, params: [0.35, -0.6], channel: 0 })); // prettier-ignore
  }

  // N, E, S and W on the horizon, in the kit's bitmap font.
  const px = 0.3; // degrees per font pixel
  for (const [ch, az] of [["N", 0], ["E", 90], ["S", 180], ["W", 270]]) {
    const rows = BITMAP[ch];
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < 5; x++) {
        if (!((rows[y] >> (4 - x)) & 1)) continue;
        const a = az + (x - 2) * px;
        const h = 3.6 + (6 - y) * px;
        const e = [Math.cos(h * D2R) * Math.sin(a * D2R), Math.cos(h * D2R) * Math.cos(a * D2R), Math.sin(h * D2R)]; // prettier-ignore
        push(dotSplat(sc(e).map((v) => v * R.letters), px * 0.55 * D2R * R.letters, [0.98, 0.66, 0.34], 0.95)); // prettier-ignore
      }
  }

  k.data = { parts: Object.keys(parts) };
  k.cloud({ count: (out.length * 160000) / N, jitter: 0, pattern: false }, (rand, i) => out[i] || null); // prettier-ignore
}

// ---- The recipe -------------------------------------------------------------------------------

export const RECIPES = {
  "night-sky": {
    alive: true,
    turntable: false,
    tiltLock: false,
    // From inside: the camera stands at the center; a drag looks around.
    inside: { fov: 72 },
    pitchRange: [-0.12, 1.45],
    options: [],
    controls: [
      { key: "lines", label: "Constellation lines", type: "toggle", default: 1, ease: 0.6 },
      { key: "name", label: "Name it", type: "pulse", ease: 1.2 },
    ],
    action: {
      key: "name",
      label: "Name a star",
      at(point) {
        const v = norm(point);
        const cam = globalThis.window?.__splashery?.player?.camera;
        const fov = cam?.pose?.().fov ?? 72;
        SKY.picked = pickAt(v, SKY.last, clamp((4 * fov) / 72, 1.2, 6));
        SKY.pickedAt = SKY.t;
        return { key: "name" };
      },
    },
    input: {
      title: "The sky over…",
      fileButton: false,
      live: [{ render: renderPanel }],
      note: "",
      read: async () => ({}),
      shown: () => "",
    },
    credits: [
      { label: "Stars", title: "HYG database v4.1", source: "https://github.com/astronexus/HYG-Database", author: "David Nash (astronexus.com)", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/" }, // prettier-ignore
      { label: "Constellation lines", title: "Western sky culture", source: "https://github.com/Stellarium/stellarium-skycultures/tree/master/western", author: "The Stellarium team", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/" }, // prettier-ignore
      { label: "Planets", title: "Approximate Positions of the Planets (E. M. Standish)", source: "https://ssd.jpl.nasa.gov/planets/approx_pos.html", author: "JPL Solar System Dynamics", license: "Published formulas" }, // prettier-ignore
    ],
    async prepare() {
      await readCatalog();
    },
    drive(t, c, out) {
      SKY.t = t;
      if (SKY.anchorSky === null || t < SKY.anchorT) {
        if (SKY.anchorSky === null) SKY.anchorSky = Date.now();
        SKY.anchorT = t;
      }
      const ms = skyTime();
      const p = SKY.place;
      const s = sky(ms, p.lat, p.lon);
      SKY.last = s;
      SKY.ms = ms;
      const q = quatFromMatrix(sceneMatrix(s.matrix));
      const sun = s.bodies.sun;
      const light = skyLight(sun.alt);
      out.morph = [light.day, light.glow, 0, 0];
      out.parts.stars = { quat: q };
      out.parts.lines = { quat: q, visible: c.lines ?? 1 };
      out.parts.glow = { quat: quatAxisAngle([0, 1, 0], -sun.az * D2R) };
      const c0 = [0, R.body, 0];
      for (const name of ["sun", "moon", ...PLANETS]) {
        const b = s.bodies[name];
        const dir = sc(b.enu);
        const offset = dir.map((v, i) => v * R.body - c0[i]);
        const part = { offset };
        if (name === "moon") part.quat = quatFromTo([1, 0, 0], sc(sun.enu));
        else if (name !== "sun") part.scale = starSigma(b.mag) / starSigma(0);
        out.parts[name] = part;
      }
      // The marker follows what was tapped.
      const pk = SKY.picked;
      let dir = null;
      if (pk?.kind === "body") dir = sc(s.bodies[pk.name].enu);
      else if (pk?.kind === "star") dir = sc(norm(mulMV(s.matrix, CAT.vec[pk.i])));
      out.parts.mark = dir ? { quat: quatFromTo([0, 1, 0], dir), visible: 1 } : { visible: 0 };
      out.legend = legend(s, ms);
      if (Math.floor(t * 2) !== SKY.panelTick) {
        SKY.panelTick = Math.floor(t * 2);
        refreshPanel();
      }
    },
    build(k) {
      buildSky(k);
    },
  },
};

// The words beside the stage: what was tapped, then the place and time.
function legend(s, ms) {
  const items = [];
  const pk = SKY.picked;
  let title;
  if (pk && CAT.data) {
    if (pk.kind === "star") {
      title = starTitle(pk.i);
      for (const f of starFacts(pk.i, s)) items.push({ text: f });
    } else {
      title = cap(BODY_NAMES[pk.name]);
      for (const f of bodyFacts(pk.name, s)) items.push({ text: f });
    }
    items.push({ text: "", head: true });
  }
  const p = SKY.place;
  items.push({ text: p.name, head: true });
  items.push({ text: formatWhen(Math.floor(ms / 60000) * 60000, p.tz) });
  if (SKY.rate !== 1) items.push({ text: (SPEEDS.find((x) => x.id === SKY.speed) || SPEEDS[0]).label }); // prettier-ignore
  const sun = s.bodies.sun;
  const moon = s.bodies.moon;
  items.push({ text: sun.alt > -0.83 ? `The Sun is up (${fmt(sun.alt)}°)` : sun.alt > -18 ? "Twilight" : "Night" }); // prettier-ignore
  items.push({ text: `Moon: ${phaseName(moon.illum, moon.waxing).toLowerCase()}, ${moon.alt > 0 ? "up" : "down"}` }); // prettier-ignore
  const up = PLANETS.filter((n) => s.bodies[n].alt > 0 && s.bodies[n].mag < 6).map((n) => BODY_NAMES[n]);
  if (up.length) items.push({ text: `Up now: ${up.join(", ")}` });
  return { title: title || "The sky", items };
}

// ---- The test hook ------------------------------------------------------------------------------
// window.__splashery.sky (docs/handoff/NightSky.md):
//   sky.set({ city | lat, lon, time (ms or ISO), speed })   place and time, as the panel does
//   sky.state()     { place, ms, sun, moon, planets, lst }
//   sky.pick(name)  marks a star or body by name (as a tap on it would)
//   sky.dirOf(name) its direction in the scene, for a tap
if (typeof window !== "undefined" && window.__splashery) {
  const find = (name) => {
    const n = String(name).toLowerCase();
    if (["sun", "moon", ...PLANETS].includes(n)) return { kind: "body", name: n };
    const i = CAT.data?.name.findIndex((x) => x.toLowerCase() === n);
    return i >= 0 ? { kind: "star", i } : null;
  };
  window.__splashery.sky = {
    set({ city, lat, lon, time, speed } = {}) {
      if (city) setPlace({ ...cityById(city) });
      else if (Number.isFinite(lat) && Number.isFinite(lon))
        setPlace({ id: "typed", name: formatLatLon(lat, lon), lat, lon, tz: "UTC" });
      if (time !== undefined) setTime(typeof time === "number" ? time : Date.parse(time));
      if (speed !== undefined) setSpeed(String(speed));
      return this.state();
    },
    state() {
      const s = SKY.last;
      const b = s?.bodies;
      return {
        place: { ...SKY.place },
        ms: SKY.anchorSky === null ? null : skyTime(),
        lst: s?.lst,
        picked: SKY.picked,
        bodies: b ? Object.fromEntries(Object.entries(b).map(([k, v]) => [k, { alt: v.alt, az: v.az, mag: v.mag, illum: v.illum }])) : null, // prettier-ignore
      };
    },
    dirOf(name) {
      const f = find(name);
      const s = SKY.last;
      if (!f || !s) return null;
      return f.kind === "body" ? sc(s.bodies[f.name].enu) : sc(norm(mulMV(s.matrix, CAT.vec[f.i])));
    },
    pick(name) {
      SKY.picked = find(name);
      return SKY.picked;
    },
  };
}

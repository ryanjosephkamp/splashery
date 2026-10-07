// Lane Powers of ten: where things in space are, seen straight up from the
// zoom's target at one real moment, in meters east, north and up of the
// target (the view looks straight down at it, north up).
//
// The moment is the minute on October 7, 2026 when the local sidereal time
// in the garden is 12 h 51 m (about local noon): then the sky straight
// overhead is within about 12 degrees of the Milky Way's north pole, so the
// zoom out leaves the galaxy nearly face-on, as it really lies above us.
//
// Low-precision positions, good to about a degree (plenty at these scales):
// the Moon (the main
// terms of its longitude, latitude and distance, after Meeus), the planets
// from JPL's "Approximate Positions of the Planets" (E. M. Standish, Table 1,
// valid 1800 to 2050; public domain), and the galactic frame (the standard
// J2000 matrix).

import { TARGET } from "./stops.js";

export const AU = 1.495978707e11;
export const LY = 9.4607304725808e15;
export const PC = 3.0856775814913673e16;
export const RE = 6371008.8;
const RAD = Math.PI / 180;
const OBLIQUITY = 23.4393 * RAD;

const jdOf = (ms) => ms / 86400000 + 2440587.5;
const gmst = (jd) => (((280.46061837 + 360.98564736629 * (jd - 2451545)) % 360) + 360) % 360;

// The moment (ms since 1970, UTC): LST 192.86 degrees, the galactic pole's
// right ascension, on October 7, 2026.
export const MOMENT = (() => {
  const day = Date.UTC(2026, 9, 7, 0, 0, 0);
  let best = day;
  let err = Infinity;
  for (let m = 0; m < 1440; m++) {
    const t = day + m * 60000;
    const lst = (gmst(jdOf(t)) + TARGET.lon + 360) % 360;
    const d = Math.abs(((lst - 192.85948 + 540) % 360) - 180);
    if (d < err) ((err = d), (best = t));
  }
  return best;
})();

const JD = jdOf(MOMENT);
const THETA = gmst(JD) * RAD;

// Equatorial (J2000, x to the vernal equinox, z north) to east-north-up at
// the target, for a direction.
export function eqToEnu(v) {
  const x = Math.cos(THETA) * v[0] + Math.sin(THETA) * v[1];
  const y = -Math.sin(THETA) * v[0] + Math.cos(THETA) * v[1];
  const z = v[2];
  const p0 = TARGET.lat * RAD;
  const l0 = TARGET.lon * RAD;
  return [
    -Math.sin(l0) * x + Math.cos(l0) * y,
    -Math.sin(p0) * Math.cos(l0) * x - Math.sin(p0) * Math.sin(l0) * y + Math.cos(p0) * z,
    Math.cos(p0) * Math.cos(l0) * x + Math.cos(p0) * Math.sin(l0) * y + Math.sin(p0) * z,
  ];
}

const eclToEq = (v) => [
  v[0],
  v[1] * Math.cos(OBLIQUITY) - v[2] * Math.sin(OBLIQUITY),
  v[1] * Math.sin(OBLIQUITY) + v[2] * Math.cos(OBLIQUITY),
];

export const eclToEnu = (v) => eqToEnu(eclToEq(v));

// Galactic (x to the center, z to the north pole) to equatorial: the
// transpose of the standard J2000 matrix.
const GAL = [
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [0.4941094279, -0.44482963, 0.7469822445],
  [-0.867666149, -0.1980763734, 0.4559837762],
];
export function galToEnu(v) {
  const eq = [0, 1, 2].map((i) => GAL[0][i] * v[0] + GAL[1][i] * v[1] + GAL[2][i] * v[2]);
  return eqToEnu(eq);
}

// The Earth's center from the target.
export const EARTH = [0, 0, -RE];

// The Moon from the Earth's center (ecliptic, meters).
export function moonEcl(jd) {
  const d = jd - 2451545;
  const L = 218.316 + 13.176396 * d;
  const Mm = (134.963 + 13.064993 * d) * RAD;
  const Ms = (357.529 + 0.98560028 * d) * RAD;
  const F = (93.272 + 13.22935 * d) * RAD;
  const D = (297.85 + 12.190749 * d) * RAD;
  const lam =
    (L +
      6.289 * Math.sin(Mm) +
      1.274 * Math.sin(2 * D - Mm) +
      0.658 * Math.sin(2 * D) +
      0.214 * Math.sin(2 * Mm) -
      0.186 * Math.sin(Ms) -
      0.114 * Math.sin(2 * F)) *
    RAD;
  const bet = (5.128 * Math.sin(F) + 0.281 * Math.sin(Mm + F) + 0.278 * Math.sin(Mm - F)) * RAD;
  const r = (385001 - 20905 * Math.cos(Mm) - 3699 * Math.cos(2 * D - Mm) - 2956 * Math.cos(2 * D)) * 1000; // prettier-ignore
  return [r * Math.cos(bet) * Math.cos(lam), r * Math.cos(bet) * Math.sin(lam), r * Math.sin(bet)];
}

// JPL's Table 1: a (AU), e, I, L, long. of perihelion, long. of node (deg),
// each with its rate per Julian century.
export const PLANETS = [
  { id: "mercury", name: "Mercury", radius: 2439.7e3, el: [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593], rate: [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081] }, // prettier-ignore
  { id: "venus", name: "Venus", radius: 6051.8e3, el: [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255], rate: [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418] }, // prettier-ignore
  { id: "earth", name: "Earth", radius: 6371e3, el: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0], rate: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0] }, // prettier-ignore
  { id: "mars", name: "Mars", radius: 3389.5e3, el: [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891], rate: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343] }, // prettier-ignore
  { id: "jupiter", name: "Jupiter", radius: 69911e3, el: [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], rate: [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106] }, // prettier-ignore
  { id: "saturn", name: "Saturn", radius: 58232e3, el: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], rate: [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794] }, // prettier-ignore
  { id: "uranus", name: "Uranus", radius: 25362e3, el: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.9542763, 74.01692503], rate: [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589] }, // prettier-ignore
  { id: "neptune", name: "Neptune", radius: 24622e3, el: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574], rate: [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664] }, // prettier-ignore
];

// A planet's place round the Sun (ecliptic, meters) at the moment, or at
// mean anomaly `M` (radians) along its orbit when given.
export function planetEcl(p, M = null) {
  const T = (JD - 2451545) / 36525;
  const [a, e, I, L, w, O] = p.el.map((v, i) => v + p.rate[i] * T);
  const om = (w - O) * RAD;
  let m = M ?? ((((L - w) % 360) + 360) % 360) * RAD;
  let E = m + e * Math.sin(m);
  for (let k = 0; k < 8; k++) E -= (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const co = Math.cos(om);
  const so = Math.sin(om);
  const cO = Math.cos(O * RAD);
  const sO = Math.sin(O * RAD);
  const cI = Math.cos(I * RAD);
  const sI = Math.sin(I * RAD);
  return [
    ((co * cO - so * sO * cI) * xp + (-so * cO - co * sO * cI) * yp) * AU,
    ((co * sO + so * cO * cI) * xp + (-so * sO + co * cO * cI) * yp) * AU,
    (so * sI * xp + co * sI * yp) * AU,
  ];
}

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// Everything from the target (east, north, up; meters) at the moment. The
// Sun is where JPL's elements put it (minus the Earth's own place), so the
// planets and the Earth agree.
const EARTH_HELIO = planetEcl(PLANETS[2]);
export const SUN = add(EARTH, eclToEnu(EARTH_HELIO.map((x) => -x)));
export const MOON = add(EARTH, eclToEnu(moonEcl(JD)));
export const helioToEnu = (v) => add(SUN, eclToEnu(v));
export const planetAt = (p) => helioToEnu(planetEcl(p));

// The Moon's path over one month round the moment (from the target).
export function moonPath(n = 400) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const jd = JD - 13.7 + (27.32 * i) / n;
    out.push(add(EARTH, eclToEnu(moonEcl(jd))));
  }
  return out;
}

// A planet's orbit (from the target), n points.
export function orbitPath(p, n = 720) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(helioToEnu(planetEcl(p, (2 * Math.PI * i) / n)));
  return out;
}

// The Milky Way: its center is 8.18 kpc away (GRAVITY 2019), toward the
// galactic center; the disk's plane is the galactic plane.
export const GALACTIC = {
  center: galToEnu([8178 * PC, 0, 0]),
  x: galToEnu([1, 0, 0]),
  y: galToEnu([0, 1, 0]),
  z: galToEnu([0, 0, 1]),
};

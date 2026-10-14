// Lane Space r4: orbits by Kepler's laws, for "The solar system on real
// orbits" (src/packs/space-r4.js) and its tests. Pure math, no page or
// network.
//
// - The planets: JPL's Table 1 (E. M. Standish), through heliocentric() in
//   src/sky/astro.js (the night sky's, imported, not copied).
// - Asteroids and comets: their osculating elements from the JPL Small-Body
//   Database at one epoch, carried forward or back by the two-body problem
//   (no planet pulls on them).
// - Moons: JPL's Planetary Satellite Mean Elements, each orbit turning at its
//   apsis and node rates, in its planet's Laplace plane (the Moon's in the
//   ecliptic).
//
// Positions are in au in the J2000 ecliptic: x toward the March equinox, z
// toward the ecliptic's north. Times are Julian days (TDB taken as UTC, a
// minute's difference).

import { heliocentric, ELEMENTS } from "../sky/astro.js";

export { ELEMENTS };
export const J2000 = 2451545.0;
const D2R = Math.PI / 180;
const TAU = Math.PI * 2;
// The Gaussian gravitational constant: k² = GM of the Sun in au³/day².
export const GAUSS_K = 0.01720209895;
export const MU = GAUSS_K * GAUSS_K;
export const AU_KM = 149597870.7;
const OBLIQUITY = 23.43928 * D2R;

export const PLANETS = [
  { id: "mercury", name: "Mercury", table: "mercury", radiusKm: 2439.7 },
  { id: "venus", name: "Venus", table: "venus", radiusKm: 6051.8 },
  { id: "earth", name: "Earth", table: "emb", radiusKm: 6371.0 },
  { id: "mars", name: "Mars", table: "mars", radiusKm: 3389.5 },
  { id: "jupiter", name: "Jupiter", table: "jupiter", radiusKm: 69911 },
  { id: "saturn", name: "Saturn", table: "saturn", radiusKm: 58232 },
  { id: "uranus", name: "Uranus", table: "uranus", radiusKm: 25362 },
  { id: "neptune", name: "Neptune", table: "neptune", radiusKm: 24622 },
];
export const SUN_RADIUS_KM = 695700;

export const julianDay = (ms) => ms / 86400000 + 2440587.5;
export const msOfJd = (jd) => (jd - 2440587.5) * 86400000;

// A planet's heliocentric position (au). The Earth is the Earth-Moon
// barycenter, at most about 4,700 km from the Earth's center.
export function planetPos(id, jd) {
  const p = PLANETS.find((x) => x.id === id);
  return heliocentric(p.table, jd);
}

// Solves Kepler's equation E - e sin E = M (radians) by Newton's method.
export function solveKepler(M, e) {
  M = M - TAU * Math.floor(M / TAU + 0.5);
  let E = e < 0.8 ? M : Math.PI * Math.sign(M || 1);
  for (let k = 0; k < 30; k++) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return E;
}

// The rotation from an orbit's plane (x toward perihelion) to the
// reference frame: i, node and peri (the argument of perihelion) in degrees.
function orbitBasis(i, node, peri) {
  const cO = Math.cos(node * D2R), sO = Math.sin(node * D2R); // prettier-ignore
  const ci = Math.cos(i * D2R), si = Math.sin(i * D2R); // prettier-ignore
  const cw = Math.cos(peri * D2R), sw = Math.sin(peri * D2R); // prettier-ignore
  const P = [cO * cw - sO * sw * ci, sO * cw + cO * sw * ci, sw * si];
  const Q = [-cO * sw - sO * cw * ci, -sO * sw + cO * cw * ci, cw * si];
  return { P, Q };
}

// Position and velocity (au, au/day) of an orbit { a, e, i, node, peri, M,
// epochJD } at a Julian day, by the two-body problem.
export function keplerState(el, jd) {
  const n = GAUSS_K / Math.pow(el.a, 1.5); // radians a day
  const M = el.M * D2R + n * (jd - el.epochJD);
  const E = solveKepler(M, el.e);
  const cE = Math.cos(E);
  const sE = Math.sin(E);
  const b = Math.sqrt(1 - el.e * el.e);
  const x = el.a * (cE - el.e);
  const y = el.a * b * sE;
  const edot = n / (1 - el.e * cE);
  const vx = -el.a * sE * edot;
  const vy = el.a * b * cE * edot;
  const { P, Q } = orbitBasis(el.i, el.node, el.peri);
  return {
    p: [0, 1, 2].map((k) => P[k] * x + Q[k] * y),
    v: [0, 1, 2].map((k) => P[k] * vx + Q[k] * vy),
  };
}
export const keplerPos = (el, jd) => keplerState(el, jd).p;

// Points along an orbit (au), evenly in eccentric anomaly (closer near
// perihelion, where it curves most). For the drawn orbit lines.
export function orbitPoints(el, n) {
  const { P, Q } = orbitBasis(el.i, el.node, el.peri);
  const b = Math.sqrt(1 - el.e * el.e);
  const out = [];
  for (let j = 0; j < n; j++) {
    const E = (j / n) * TAU;
    const x = el.a * (Math.cos(E) - el.e);
    const y = el.a * b * Math.sin(E);
    out.push([0, 1, 2].map((k) => P[k] * x + Q[k] * y));
  }
  return out;
}

// A planet's Table 1 orbit at a date, as { a, e, i, node, peri, M, epochJD }.
export function planetElements(id, jd) {
  const p = PLANETS.find((x) => x.id === id);
  const el = ELEMENTS[p.table];
  const T = (jd - J2000) / 36525;
  const L = el[3] + el[9] * T;
  const varpi = el[4] + el[10] * T;
  const node = el[5] + el[11] * T;
  return {
    a: el[0] + el[6] * T,
    e: el[1] + el[7] * T,
    i: el[2] + el[8] * T,
    node,
    peri: varpi - node,
    M: L - varpi,
    epochJD: jd,
  };
}

// The asteroid snapshot's rows ([number, a, e, i, node, peri, M, H]) as orbits.
export const asteroidOrbit = (row, epochJD) => ({
  a: row[1],
  e: row[2],
  i: row[3],
  node: row[4],
  peri: row[5],
  M: row[6],
  epochJD,
});

// ---- Moons ----------------------------------------------------------------------------------

const eqToEcl = (v) => {
  const c = Math.cos(OBLIQUITY);
  const s = Math.sin(OBLIQUITY);
  return [v[0], c * v[1] + s * v[2], -s * v[1] + c * v[2]];
};

// A moon's place from its planet (au, J2000 ecliptic), from JPL's mean
// elements: the mean anomaly runs at its period, and the periapsis and the
// node turn at theirs (a negative period turns backward), in the Laplace
// plane (whose pole is given in the J2000 equator) or the ecliptic.
export function moonOffset(m, jd) {
  const days = jd - (m.epochJD ?? J2000);
  const wRate = m.Papsis ? 360 / (m.Papsis * 365.25) : 0;
  const nRate = m.Pnode ? -360 / (m.Pnode * 365.25) : 0;
  const peri = m.peri + wRate * days;
  const node = m.node + nRate * days;
  // (A sidereal period is the mean longitude's: the mean anomaly runs that
  // much slower as the periapsis and node turn.)
  const M = m.M + (360 / m.P - (m.sidereal ? wRate + nRate : 0)) * days;
  const E = solveKepler(M * D2R, m.e);
  const a = m.a / AU_KM;
  const x = a * (Math.cos(E) - m.e);
  const y = a * Math.sqrt(1 - m.e * m.e) * Math.sin(E);
  const { P, Q } = orbitBasis(m.i, node, peri);
  const v = [0, 1, 2].map((k) => P[k] * x + Q[k] * y);
  if (m.frame === "ecliptic") return v;
  // The Laplace plane: x toward its ascending node on the J2000 equator,
  // z its pole.
  const ra = m.ra * D2R;
  const dec = m.dec * D2R;
  const zl = [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
  const xl = [-Math.sin(ra), Math.cos(ra), 0];
  const yl = [zl[1] * xl[2] - zl[2] * xl[1], zl[2] * xl[0] - zl[0] * xl[2], zl[0] * xl[1] - zl[1] * xl[0]]; // prettier-ignore
  const eq = [0, 1, 2].map((k) => xl[k] * v[0] + yl[k] * v[1] + zl[k] * v[2]);
  return eqToEcl(eq);
}

// A planet's north pole (J2000 equatorial RA and Dec, IAU) as an ecliptic
// unit vector: for Saturn's rings.
export function poleEcliptic(raDeg, decDeg) {
  const ra = raDeg * D2R;
  const dec = decDeg * D2R;
  return eqToEcl([Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)]);
}

// ---- The GPU program's twin -----------------------------------------------------------------

// An asteroid as the GPU program stores it: its place r (au) at the
// snapshot's epoch, its semi-major axis a and the direction of its velocity
// there. This carries it dt days on, as the program does: speed from the
// vis-viva law, then the orbit's shape and its eccentric anomaly from the
// place and velocity, Kepler's equation, and back to a place. (The tests
// check it against keplerState.)
export function propagateStored(r, a, vdir, dt) {
  const rl = Math.hypot(r[0], r[1], r[2]);
  const speed = Math.sqrt(Math.max(0, MU * (2 / rl - 1 / a)));
  const v = vdir.map((x) => x * speed);
  const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]]; // prettier-ignore
  const h = cross(r, v);
  const hl = Math.hypot(h[0], h[1], h[2]);
  const vh = cross(v, h);
  const ev = [0, 1, 2].map((k) => vh[k] / MU - r[k] / rl);
  const e = Math.min(0.99, Math.hypot(ev[0], ev[1], ev[2]));
  const P = e > 1e-6 ? ev.map((x) => x / e) : r.map((x) => x / rl);
  const hn = h.map((x) => x / hl);
  const Q = cross(hn, P);
  const b = Math.sqrt(1 - e * e);
  const rp = r[0] * P[0] + r[1] * P[1] + r[2] * P[2];
  const rq = r[0] * Q[0] + r[1] * Q[1] + r[2] * Q[2];
  const E0 = Math.atan2(rq / (a * b), rp / a + e);
  const M = E0 - e * Math.sin(E0) + (GAUSS_K / Math.pow(a, 1.5)) * dt;
  const E = solveKepler(M, e);
  const x = a * (Math.cos(E) - e);
  const y = a * b * Math.sin(E);
  return [0, 1, 2].map((k) => P[k] * x + Q[k] * y);
}

// ---- Drawing scales -------------------------------------------------------------------------

// The two scales. "true": distances and sizes both to one scale (1 unit =
// 1 au). "readable": each distance from the Sun drawn as ln(1 + r / R0), so
// the inner planets spread out; directions stay true; planets and moons
// drawn far larger (see the pack).
export const R0 = 0.25;
export const SCALES = {
  true: { id: "true", dist: (r) => r, inv: (d) => d },
  readable: { id: "readable", dist: (r) => Math.log(1 + r / R0), inv: (d) => R0 * Math.expm1(d) },
};

// An ecliptic place (au) drawn at a scale, in the toy's frame: y up (the
// ecliptic's north), x toward the March equinox, z toward the viewer.
export function drawn(p, scale) {
  const r = Math.hypot(p[0], p[1], p[2]);
  const s = r > 0 ? scale.dist(r) / r : 0;
  return [p[0] * s, p[2] * s, -p[1] * s];
}

// Circular, coplanar heliocentric orbits; km, seconds, and radians throughout.
// Radii: https://nssdc.gsfc.nasa.gov/planetary/factsheet/
// Constants: https://ssd.jpl.nasa.gov/astro_par.html
// Equations: https://orbital-mechanics.space/orbital-maneuvers/hohmann-transfer.html
// Phasing: https://orbital-mechanics.space/interplanetary-maneuvers/interplanetary-transfer-phasing.html
// Propagation: https://orbital-mechanics.space/time-since-periapsis-and-keplers-equation/elliptical-orbits.html
export const MU = 1.32712440041279419e11; // Sun GM, km³/s²
export const DAY = 86400;
export const TAU = 2 * Math.PI;
export const PLANETS = [
  { id: "mercury", name: "Mercury", radius: 57.9e6, color: "#a9a49b" },
  { id: "venus", name: "Venus", radius: 108.2e6, color: "#e6c588" },
  { id: "earth", name: "Earth", radius: 149.6e6, color: "#65b8ed" },
  { id: "mars", name: "Mars", radius: 228.0e6, color: "#ec875c" },
  { id: "jupiter", name: "Jupiter", radius: 778.5e6, color: "#d8b794" },
  { id: "saturn", name: "Saturn", radius: 1432.0e6, color: "#e3ce91" },
  { id: "uranus", name: "Uranus", radius: 2867.0e6, color: "#81d7da" },
  { id: "neptune", name: "Neptune", radius: 4515.0e6, color: "#708fea" },
];
export const wrap = (a) => ((a % TAU) + TAU) % TAU;
export const signedAngle = (a) => wrap(a + Math.PI) - Math.PI;
export const meanMotion = (r) => Math.sqrt(MU / r ** 3);

export function planTransfer(r1, r2) {
  if (!(r1 > 0 && r2 > 0) || !Number.isFinite(r1 + r2) || r1 === r2)
    throw new Error("Choose two different planets.");
  const a = (r1 + r2) / 2;
  const e = Math.abs(r2 - r1) / (r1 + r2);
  const n = meanMotion(a);
  const seconds = Math.PI / n;
  const n1 = meanMotion(r1);
  const n2 = meanMotion(r2);
  const burn1 = Math.sqrt(MU * (2 / r1 - 1 / a)) - Math.sqrt(MU / r1);
  const burn2 = Math.sqrt(MU / r2) - Math.sqrt(MU * (2 / r2 - 1 / a));
  return {
    r1,
    r2,
    a,
    e,
    n,
    n1,
    n2,
    seconds,
    burn1,
    burn2,
    total: Math.abs(burn1) + Math.abs(burn2),
    phase: signedAngle(Math.PI - n2 * seconds),
    outward: r2 > r1,
  };
}

// First nonnegative solution of phase + (n2 - n1)t = required (mod 2π).
export function nextWindow(plan, currentPhase) {
  const rate = plan.n2 - plan.n1;
  const delta = rate > 0 ? wrap(plan.phase - currentPhase) : wrap(currentPhase - plan.phase);
  return delta < 1e-12 || TAU - delta < 1e-12 ? 0 : delta / Math.abs(rate);
}

// Bracketed Kepler solve is stable even for Mercury ↔ Neptune (e ≈ 0.975).
export function eccentricAnomaly(mean, e) {
  const m = wrap(mean);
  let lo = 0;
  let hi = TAU;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (mid - e * Math.sin(mid) < m) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// Exact two-body drift: mean anomaly integrates linearly. The animation calls
// this at fixed simulation steps, not with a variable-frame Euler force step.
// A rotation of π for inward transfers starts at apoapsis and remains prograde.
export function transferState(plan, seconds, launchAngle = 0) {
  const E = eccentricAnomaly((plan.outward ? 0 : Math.PI) + plan.n * seconds, plan.e);
  const b = plan.a * Math.sqrt(1 - plan.e ** 2);
  const rate = plan.n / (1 - plan.e * Math.cos(E));
  const angle = launchAngle + (plan.outward ? 0 : Math.PI);
  const rotate = (x, y) => [
    x * Math.cos(angle) - y * Math.sin(angle),
    x * Math.sin(angle) + y * Math.cos(angle),
  ];
  return {
    position: rotate(plan.a * (Math.cos(E) - plan.e), b * Math.sin(E)),
    velocity: rotate(-plan.a * Math.sin(E) * rate, b * Math.cos(E) * rate),
  };
}

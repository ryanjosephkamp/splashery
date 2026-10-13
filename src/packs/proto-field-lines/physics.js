// SI units throughout: meters, coulombs, kilograms, seconds, and N/C.
// E = k Σ q (r - ri) / |r - ri|³; F = qt E.
// https://openstax.org/books/university-physics-volume-2/pages/5-4-electric-field
// Fixed-step velocity Verlet:
// https://en.wikipedia.org/wiki/Verlet_integration#Velocity_Verlet
export const K = 8.9875517923e9;
export const SOURCE_Q = 1e-9;
export const TEST_Q = 1e-9;
export const TEST_MASS = 1e-8; // 10 micrograms; an illustrative charged bead.
export const DT = 1 / 1200;
export const RADIUS = 0.16;
export const LIMIT = 1.45;
export const add = (a, b) => a.map((x, i) => x + b[i]);
export const sub = (a, b) => a.map((x, i) => x - b[i]);
export const mul = (a, s) => a.map((x) => x * s);
export const norm = (a) => Math.hypot(...a);
export const unit = (a) => mul(a, 1 / (norm(a) || 1));
export const lerp = (a, b, t) => add(a, mul(sub(b, a), t));

export function fieldAt(p, charges) {
  let ex = 0,
    ey = 0,
    ez = 0;
  for (const c of charges) {
    const x = p[0] - c.p[0],
      y = p[1] - c.p[1],
      z = p[2] - c.p[2];
    const r2 = x * x + y * y + z * z;
    // A point charge is singular at its center. Callers exclude that point.
    if (r2 === 0) return [Infinity, Infinity, Infinity];
    const factor = (K * c.q) / (r2 * Math.sqrt(r2));
    ex += x * factor;
    ey += y * factor;
    ez += z * factor;
  }
  return [ex, ey, ez];
}

export function dipole() {
  return [
    { p: [-0.65, 0, 0], q: SOURCE_Q },
    { p: [0.65, 0, 0], q: -SOURCE_Q },
  ];
}

// RK4 in arc length, dp/ds = ±E/|E|. Line tracing is independent of
// particle dynamics: a particle with inertia does not follow a curved line.
function trace(seed, charges, direction, source) {
  const points = [seed];
  let p = seed;
  const h = 0.012;
  const f = (x) => {
    const e = fieldAt(x, charges);
    const s = direction / (norm(e) || 1);
    return [e[0] * s, e[1] * s, e[2] * s];
  };
  let end = null;
  for (let n = 0; n < 1300; n++) {
    const a = f(p);
    const b = f(add(p, mul(a, h / 2)));
    const c = f(add(p, mul(b, h / 2)));
    const d = f(add(p, mul(c, h)));
    const next = add(p, mul(add(add(a, mul(b, 2)), add(mul(c, 2), d)), h / 6));
    if (!next.every(Number.isFinite) || norm(a) < 0.5) break;
    const hit = charges.findIndex(
      (q, i) => i !== source && q.q * direction < 0 && norm(sub(next, q.p)) <= RADIUS,
    );
    if (hit >= 0) {
      points.push(add(charges[hit].p, mul(unit(sub(p, charges[hit].p)), RADIUS)));
      end = hit;
      break;
    }
    if (next.some((x) => Math.abs(x) > LIMIT)) break;
    points.push(next);
    p = next;
  }
  return direction > 0
    ? { points, start: source, end }
    : { points: points.reverse(), start: end, end: source };
}

export function fieldLines(charges) {
  const positive = charges.map((c, i) => (c.q > 0 ? i : -1)).filter((i) => i >= 0);
  const sources = positive.length ? positive : charges.map((_, i) => i);
  const lines = [];
  for (const i of sources) {
    const q = charges[i];
    const target = charges.find((c) => c.q * q.q < 0);
    // Three rings around the direction to the opposite charge. Equal ring
    // counts are illustrative, not a calibrated flux-density measurement.
    const axis = target ? unit(sub(target.p, q.p)) : [1, 0, 0];
    const cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
    const u = unit(cross(axis, Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [0, 0, 1]));
    const v = cross(axis, u);
    for (let n = 0; n < 12; n++) {
      let dir;
      if (target) {
        const theta = [0.3, 0.7, 1.1][Math.floor(n / 4)];
        const phi = ((n % 4) / 4) * Math.PI * 2 + 0.35;
        dir = add(
          mul(axis, Math.cos(theta)),
          mul(add(mul(u, Math.cos(phi)), mul(v, Math.sin(phi))), Math.sin(theta)),
        );
      } else {
        const x = 1 - (2 * (n + 0.5)) / 12;
        const phi = n * Math.PI * (3 - Math.sqrt(5));
        dir = [x, Math.sqrt(1 - x * x) * Math.cos(phi), Math.sqrt(1 - x * x) * Math.sin(phi)];
      }
      lines.push(trace(add(q.p, mul(dir, RADIUS)), charges, Math.sign(q.q), i));
    }
  }
  return lines;
}

export function verlet(p, v, charges, dt = DT) {
  const a = mul(fieldAt(p, charges), TEST_Q / TEST_MASS);
  const next = add(add(p, mul(v, dt)), mul(a, (dt * dt) / 2));
  const b = mul(fieldAt(next, charges), TEST_Q / TEST_MASS);
  return { p: next, v: add(v, mul(add(a, b), dt / 2)) };
}

// Snapshot forces at release; editing the sources cancels the flight.
// Stop before a charge's visible surface (no softened Coulomb law).
export function trajectory(start, charges, seconds = 2.8) {
  const frames = [start.slice()];
  let p = start.slice();
  let v = [0, 0, 0];
  let stopped = charges.some((c) => norm(sub(p, c.p)) <= RADIUS + 0.055);
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    if (!stopped) {
      const next = verlet(p, v, charges);
      // Segment/sphere intersection, so even a fast bead cannot tunnel.
      const delta = sub(next.p, p);
      const dot = (a, b) => a.reduce((s, x, j) => s + x * b[j], 0);
      let fraction = 1;
      for (const c of charges) {
        const rel = sub(p, c.p);
        const a = dot(delta, delta);
        const b = 2 * dot(rel, delta);
        const z = dot(rel, rel) - (RADIUS + 0.055) ** 2;
        const disc = b * b - 4 * a * z;
        if (a > 0 && disc >= 0) {
          const f = (-b - Math.sqrt(disc)) / (2 * a);
          if (f >= 0 && f <= fraction) fraction = f;
        }
      }
      // Stop at the finite display boundary; this is a sandbox, not a wall.
      for (let j = 0; j < 3; j++) {
        if (Math.abs(next.p[j]) > LIMIT && delta[j])
          fraction = Math.min(fraction, (Math.sign(next.p[j]) * LIMIT - p[j]) / delta[j]);
      }
      p = lerp(p, next.p, Math.max(0, fraction));
      v = next.v;
      stopped = fraction < 1;
    }
    frames.push(p.slice());
  }
  return frames;
}

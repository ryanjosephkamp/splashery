// SI units: meters, kilograms, seconds, and radians. Massless rigid rods,
// point bobs, and no friction. Angles are measured from vertical down.
// Equations: https://www.myphysicslab.com/pendulum/double-pendulum-en.html
// Euler–Lagrange for L = T - V gives the two-by-two system below, equivalent
// to that page's explicit accelerations. Keeping the matrix form avoids
// cancellation and makes the one-arm (m2 = 0) limit explicit.
export const STEP = 1 / 2400;
export const GRAVITY = { earth: 9.81, moon: 1.62, mars: 3.71 };
export const DEFAULTS = {
  l1: 1,
  l2: 1,
  m1: 1,
  m2: 1,
  gravity: "earth",
  difference: 0.01,
  start1: 120,
  start2: -10,
  mode: "double",
};

export const period = (length, gravity) => 2 * Math.PI * Math.sqrt(length / gravity);
export const angleDistance = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

// State order: [theta1, theta2, omega1, omega2]. Dividing the first
// Lagrange equation by L1 and the second by m2*L2 gives:
// (m1+m2)L1*a1 + m2*L2*cos(d)*a2 = -(m1+m2)g*sin(t1) - m2*L2*w2²*sin(d)
// L1*cos(d)*a1 + L2*a2 = L1*w1²*sin(d) - g*sin(t2).
export function derivative(s, p) {
  const [t1, t2, w1, w2] = s;
  const { l1, l2, m1, g } = p;
  if (p.mode === "single" || p.m2 === 0) return [w1, 0, (-g / l1) * Math.sin(t1), 0];
  const m2 = p.m2;
  const sn = Math.sin(t1 - t2);
  const cs = Math.cos(t1 - t2);
  const a = (m1 + m2) * l1;
  const b = m2 * l2 * cs;
  const c = l1 * cs;
  const d = l2;
  const r1 = -(m1 + m2) * g * Math.sin(t1) - m2 * l2 * w2 * w2 * sn;
  const r2 = l1 * w1 * w1 * sn - g * Math.sin(t2);
  // Positive for every allowed mass and length: L1*L2*(m1 + m2*sin(d)²).
  const det = l1 * l2 * (m1 + m2 * sn * sn);
  return [w1, w2, (r1 * d - b * r2) / det, (a * r2 - c * r1) / det];
}

export function rk4(s, p, h = STEP) {
  const add = (v, scale) => s.map((x, i) => x + scale * v[i]);
  const a = derivative(s, p);
  const b = derivative(add(a, h / 2), p);
  const c = derivative(add(b, h / 2), p);
  const d = derivative(add(c, h), p);
  return s.map((x, i) => x + (h / 6) * (a[i] + 2 * b[i] + 2 * c[i] + d[i]));
}

export function positions(s, p) {
  const x1 = p.l1 * Math.sin(s[0]);
  const y1 = -p.l1 * Math.cos(s[0]);
  return p.mode === "single"
    ? { upper: [x1, y1], lower: [x1, y1] }
    : { upper: [x1, y1], lower: [x1 + p.l2 * Math.sin(s[1]), y1 - p.l2 * Math.cos(s[1])] };
}

export function energy(s, p) {
  const [t1, t2, w1, w2] = s;
  const { l1, l2, m1, g } = p;
  const m2 = p.mode === "single" ? 0 : p.m2;
  const kinetic =
    0.5 * (m1 + m2) * l1 ** 2 * w1 ** 2 +
    0.5 * m2 * l2 ** 2 * w2 ** 2 +
    m2 * l1 * l2 * w1 * w2 * Math.cos(t1 - t2);
  const potential = -(m1 + m2) * g * l1 * Math.cos(t1) - m2 * g * l2 * Math.cos(t2);
  return kinetic + potential;
}

const TRAIL_COUNT = 1024;
export class Experiment {
  constructor(options = {}) {
    this.options = { ...DEFAULTS, ...options };
    this.p = { ...this.options, g: GRAVITY[this.options.gravity] };
    this.scale = 0.95 / (this.p.l1 + (this.p.mode === "single" ? 0 : this.p.l2));
    this.tapN = 0;
    this.version = 0;
    this.reset();
  }

  reset(running = false) {
    const o = this.options;
    const t1 = o.mode === "single" ? 0.01 : (o.start1 * Math.PI) / 180;
    const t2 = o.mode === "single" ? 0 : (o.start2 * Math.PI) / 180;
    // Only the upper starting angle of B differs, by exactly the slider's radians.
    this.states = [
      [t1, t2, 0, 0],
      [t1 + o.difference, t2, 0, 0],
    ];
    this.running = running;
    this.steps = 0;
    this.remainder = 0;
    this.lastClock = null;
    this.divergedAt = null;
    this.period = null;
    this.crossing = null;
    this.bottomPasses = [0, 0];
    this.trails = [[], []];
    this.trailHeads = [0, 0];
    this.sampleTrails();
    this.version++;
  }

  get time() {
    return this.steps * STEP;
  }
  get separation() {
    return Math.max(
      angleDistance(this.states[0][0], this.states[1][0]),
      this.p.mode === "single" ? 0 : angleDistance(this.states[0][1], this.states[1][1]),
    );
  }

  sampleTrails() {
    this.states.forEach((s, i) => {
      const point = positions(s, this.p).lower.map((x) => x * this.scale);
      const trail = this.trails[i];
      const head = this.trailHeads[i];
      const last = trail[(head + TRAIL_COUNT - 1) % TRAIL_COUNT];
      if (last && Math.hypot(point[0] - last[0], point[1] - last[1]) < 0.009) return;
      trail[head] = point;
      this.trailHeads[i] = (head + 1) % TRAIL_COUNT;
    });
  }

  step(onBottom) {
    const before = this.states;
    this.states = before.map((s) => rk4(s, this.p));
    this.steps++;
    if (this.divergedAt === null && this.separation > Math.PI / 18) this.divergedAt = this.time;
    this.states.forEach((s, i) => {
      // A bottom pass is a lower arm crossing vertical down, including full turns.
      const arm = this.p.mode === "single" ? 0 : 1;
      const old = before[i][arm];
      const now = s[arm];
      if (Math.floor(old / (2 * Math.PI)) !== Math.floor(now / (2 * Math.PI))) {
        this.bottomPasses[i]++;
        onBottom?.(i);
      }
    });
    if (this.p.mode === "single" && before[0][0] < 0 && this.states[0][0] >= 0) {
      const a = before[0][0];
      const b = this.states[0][0];
      const crossing = this.time - STEP + STEP * (-a / (b - a));
      if (this.crossing !== null) this.period = crossing - this.crossing;
      this.crossing = crossing;
    }
    this.sampleTrails();
  }

  advance(seconds, onBottom) {
    if (!this.running) return;
    // Accumulate frame time, but always integrate exactly STEP. Bound the
    // catch-up after a hidden tab or slow frame; the readout shows simulated
    // time, never wall time. At most 600 inexpensive steps per render frame.
    this.remainder += Math.max(0, Math.min(seconds, 0.25));
    const steps = Math.floor((this.remainder + 1e-12) / STEP);
    for (let i = 0; i < steps; i++) this.step(onBottom);
    this.remainder -= steps * STEP;
    if (steps) this.version++;
  }
}

export { TRAIL_COUNT };

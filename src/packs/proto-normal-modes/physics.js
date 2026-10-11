// Equal masses, equal springs, and fixed endpoints. All values are SI.
// m x_i'' = k (x_{i-1} - 2 x_i + x_{i+1}), x_0 = x_{N+1} = 0.
// https://farside.ph.utexas.edu/teaching/315/Waves/node23.html
export const STEP = 1 / 240;
export const MASS = 1; // kg
export const SPRING = 16; // N/m
export const RUN = 3.6;
export const RESET = 0.6;
export const DURATION = RUN + RESET;

export function modes(n, k = SPRING, m = MASS) {
  return Array.from({ length: n }, (_, j) => {
    const omega = 2 * Math.sqrt(k / m) * Math.sin(((j + 1) * Math.PI) / (2 * (n + 1)));
    const vector = Array.from(
      { length: n },
      (_, i) => Math.sqrt(2 / (n + 1)) * Math.sin(((i + 1) * (j + 1) * Math.PI) / (n + 1)),
    );
    return { omega, hz: omega / (2 * Math.PI), vector };
  });
}

export class Chain {
  constructor(n, start, k = SPRING, m = MASS) {
    this.modes = modes(n, k, m);
    this.q = this.modes.map(({ vector }) => vector.reduce((s, v, i) => s + v * start[i], 0));
    this.v = new Array(n).fill(0);
    this.steps = 0;
    this.rotations = this.modes.map(({ omega }) => ({
      c: Math.cos(omega * STEP),
      s: Math.sin(omega * STEP),
      omega,
    }));
  }

  advance(time) {
    const target = Math.floor((Math.max(0, time) + 1e-10) / STEP);
    while (this.steps < target) {
      this.rotations.forEach(({ c, s, omega }, j) => {
        const q = this.q[j];
        const v = this.v[j];
        // Exact harmonic-oscillator transition, at a fixed 1/240 s step.
        this.q[j] = c * q + (s * v) / omega;
        this.v[j] = c * v - omega * s * q;
      });
      this.steps++;
    }
    return this.sample(time - this.steps * STEP);
  }

  sample(remainder = 0) {
    // Exact fractional render sample; never fed back into the integrator.
    const q = this.modes.map(
      ({ omega }, j) =>
        this.q[j] * Math.cos(omega * remainder) + (this.v[j] * Math.sin(omega * remainder)) / omega,
    );
    return this.modes[0].vector.map((_, i) =>
      this.modes.reduce((s, mode, j) => s + mode.vector[i] * q[j], 0),
    );
  }
}

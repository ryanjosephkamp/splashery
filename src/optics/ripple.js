// Lane Optics: the ripple tank's water, a real 2D wave equation on a grid.
//
//   ∂²u/∂t² + γ(x, y) ∂u/∂t = c² ∇²u
//
// u is the height of the water (cm), c the wave speed (cm/s). It is solved
// with the standard explicit finite-difference scheme (second-order centered
// differences in time and space, the five-point Laplacian), which is stable
// while the Courant number c·Δt/Δx stays at or under 1/√2 in two dimensions;
// the tank keeps it at 0.5. γ is zero in the open water and rises smoothly
// (as the square of the depth into it) in a border a few wavelengths wide:
// the "beaches" a real ripple tank has at its edges, which soak up the waves
// so they don't come back. A barrier is a row of cells held at u = 0.
//
// Pure JavaScript, no DOM: the tests run it in Node (tests/opt.spec.mjs).

export const COURANT = 0.5;

export class RippleTank {
  // width, depth: the tank in cm; nx: cells across (the cell is square).
  // beach: the absorbing border, cm. cMax: the fastest speed the controls
  // allow (cm/s), which sets the time step.
  constructor({ width = 40, depth = 30, nx = 240, beach = 5, cMax = 30 } = {}) {
    this.width = width;
    this.depth = depth;
    this.nx = nx;
    this.dx = width / nx;
    this.ny = Math.round(depth / this.dx);
    this.cMax = cMax;
    this.dt = (COURANT * this.dx) / cMax;
    const n = this.nx * this.ny;
    this.u = new Float32Array(n);
    this.prev = new Float32Array(n);
    this.next = new Float32Array(n);
    this.wall = new Uint8Array(n);
    this.gamma = new Float32Array(n);
    this.intensity = new Float32Array(n); // a running average of u² (the fringes)
    this.c = 20;
    this.f = 5;
    this.amp = 0.1;
    this.time = 0;
    this.phase = 0; // the sources' phase, kept as the frequency changes
    this.steps = 0;
    this.sources = []; // { x, y } cm, point sources
    this.line = null; // { y } cm: a plane wave made along this line
    this.running = true;
    this.pebbles = [];
    this.setBeach(beach);
  }

  // The absorbing border: γ = γmax (d / L)² at depth d into a border L wide.
  // γmax is set so a wave crossing the border is damped by about e^-8 there
  // and back at the slowest speed, while the ramp stays gentle enough that
  // it reflects little (tests/opt.spec.mjs measures what comes back).
  setBeach(L) {
    this.beach = L;
    const { nx, ny, dx } = this;
    const gmax = (3 * 8 * this.cMax * 0.5) / L; // 3 · ln-amplitude 8 · c / (2 L), at c = cMax / 2
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const x = (i + 0.5) * dx;
        const y = (j + 0.5) * dx;
        const d = Math.max(0, L - Math.min(x, y, this.width - x, this.depth - y));
        this.gamma[j * nx + i] = gmax * (d / L) ** 2;
      }
  }

  // The barrier: a wall `thick` cm thick across the tank at y (cm) with
  // openings [{ center (cm from the left), width (cm) }]. null: none.
  setBarrier(barrier) {
    this.wall.fill(0);
    this.barrier = barrier || null;
    if (!barrier) return;
    const { nx, dx } = this;
    const thick = barrier.thick ?? 2 * dx;
    const j0 = Math.round(barrier.y / dx - thick / dx / 2);
    const j1 = Math.max(j0 + 1, Math.round(barrier.y / dx + thick / dx / 2));
    for (let j = j0; j < j1; j++)
      for (let i = 0; i < nx; i++) {
        const x = (i + 0.5) * dx;
        const open = (barrier.openings || []).some((o) => Math.abs(x - o.center) < o.width / 2);
        if (!open) this.wall[j * nx + i] = 1;
      }
    this.barrierRows = [j0, j1];
    for (let k = 0; k < this.wall.length; k++)
      if (this.wall[k]) this.u[k] = this.prev[k] = this.next[k] = 0;
  }

  get wavelength() {
    return this.c / this.f;
  }

  clear() {
    this.u.fill(0);
    this.prev.fill(0);
    this.next.fill(0);
    this.intensity.fill(0);
    this.pebbles.length = 0;
  }

  // A pebble at (x, y) cm: a smooth dimple (a Gaussian, radius r cm) pushed
  // into the water, which then runs out as rings.
  pebble(x, y, r = 0.6, depth = 0.5) {
    const { nx, ny, dx } = this;
    const R = Math.ceil((3 * r) / dx);
    const ci = Math.round(x / dx - 0.5);
    const cj = Math.round(y / dx - 0.5);
    for (let j = Math.max(1, cj - R); j <= Math.min(ny - 2, cj + R); j++)
      for (let i = Math.max(1, ci - R); i <= Math.min(nx - 2, ci + R); i++) {
        const k = j * nx + i;
        if (this.wall[k]) continue;
        const d2 = (((i - ci) * dx) ** 2 + ((j - cj) * dx) ** 2) / (r * r);
        const g = -depth * Math.exp(-d2);
        this.u[k] += g;
        this.prev[k] += g;
      }
  }

  // The sources' height now: a point source is a dipper bobbing as
  // A sin(2π f t), held over a disc a cell or so wide; a plane wave is a bar
  // along a whole row. The drive fades in over its first period so it starts
  // without a jolt.
  drive() {
    if (!this.running || (!this.sources.length && !this.line)) return;
    const { nx, dx } = this;
    const ramp = Math.min(1, this.time * this.f);
    const s = this.amp * ramp * Math.sin(this.phase);
    for (const src of this.sources) {
      const ci = Math.round(src.x / dx - 0.5);
      const cj = Math.round(src.y / dx - 0.5);
      for (let j = cj - 1; j <= cj + 1; j++)
        for (let i = ci - 1; i <= ci + 1; i++) {
          if (i < 1 || j < 1 || i >= nx - 1 || j >= this.ny - 1) continue;
          if (Math.abs(i - ci) + Math.abs(j - cj) > 1) continue;
          this.u[j * nx + i] = s;
        }
    }
    if (this.line) {
      const j = Math.round(this.line.y / dx - 0.5);
      for (let i = 1; i < nx - 1; i++) this.u[j * nx + i] = s;
    }
  }

  // One time step of the scheme. The edge cells stay at 0 (the beach has
  // already soaked the wave up by then).
  step() {
    const { nx, ny, u, prev, next, wall, gamma, dt } = this;
    const r2 = ((this.c * dt) / this.dx) ** 2;
    for (let j = 1; j < ny - 1; j++) {
      const row = j * nx;
      for (let i = 1; i < nx - 1; i++) {
        const k = row + i;
        if (wall[k]) {
          next[k] = 0;
          continue;
        }
        const lap = u[k - 1] + u[k + 1] + u[k - nx] + u[k + nx] - 4 * u[k];
        const g = gamma[k] * dt * 0.5;
        next[k] = (2 * u[k] - (1 - g) * prev[k] + r2 * lap) / (1 + g);
      }
    }
    this.prev = u;
    this.u = next;
    this.next = prev;
    this.time += dt;
    this.phase = (this.phase + 2 * Math.PI * this.f * dt) % (2 * Math.PI);
    this.steps++;
    this.drive();
  }

  // Runs the water on by `seconds` of tank time, in whole steps (at most
  // maxSteps, so a slow frame never stalls the page). Keeps the running
  // average of u² over about `avg` seconds for the fringes.
  advance(seconds, { maxSteps = 400, avg = 1.2 } = {}) {
    this.debt = (this.debt || 0) + seconds;
    let n = Math.min(maxSteps, Math.floor(this.debt / this.dt));
    this.debt = Math.min(this.debt - n * this.dt, this.dt);
    const a = Math.min(1, (n * this.dt) / avg);
    while (n-- > 0) this.step();
    if (a > 0) {
      const I = this.intensity;
      const u = this.u;
      for (let k = 0; k < I.length; k++) I[k] += (u[k] * u[k] - I[k]) * a;
    }
    return this;
  }

  // Bilinear height at (x, y) cm.
  heightAt(x, y, field = this.u) {
    const { nx, ny, dx } = this;
    const fx = Math.min(nx - 1.001, Math.max(0, x / dx - 0.5));
    const fy = Math.min(ny - 1.001, Math.max(0, y / dx - 0.5));
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const s = fx - i;
    const t = fy - j;
    const k = j * nx + i;
    return (
      (1 - t) * ((1 - s) * field[k] + s * field[k + 1]) +
      t * ((1 - s) * field[k + nx] + s * field[k + nx + 1])
    );
  }
}

// ---- Measuring the fringes (the tests and tools/opt-fringes.mjs) --------------------------

// The time-averaged intensity of u² along an arc of radius R (cm) about
// (cx, cy), from angle -max to +max (radians from the +y direction), over
// `periods` periods of the source, sampled `n` times a period. Returns
// { angles, I }.
export function arcIntensity(
  tank,
  { cx, cy, R, max = 1.2, count = 241, periods = 4, perPeriod = 24 },
) {
  const angles = [];
  for (let a = 0; a < count; a++) angles.push(-max + (2 * max * a) / (count - 1));
  const I = new Float64Array(count);
  const T = 1 / tank.f;
  const stepsPer = T / perPeriod;
  for (let s = 0; s < periods * perPeriod; s++) {
    let left = stepsPer;
    while (left > 1e-9) {
      tank.step();
      left -= tank.dt;
    }
    for (let a = 0; a < count; a++) {
      const h = tank.heightAt(cx + R * Math.sin(angles[a]), cy + R * Math.cos(angles[a]));
      I[a] += h * h;
    }
  }
  return { angles, I: Array.from(I, (v) => v / (periods * perPeriod)) };
}

// A curve smoothed with a Gaussian of `sigma` samples (the arc's fine
// ripple, a cell's worth of grid, would otherwise show as false tops).
export function smooth(ys, sigma = 3) {
  const R = Math.ceil(3 * sigma);
  return ys.map((_, i) => {
    let s = 0;
    let w = 0;
    for (let k = -R; k <= R; k++) {
      const j = i + k;
      if (j < 0 || j >= ys.length) continue;
      const g = Math.exp((-k * k) / (2 * sigma * sigma));
      s += g * ys[j];
      w += g;
    }
    return s / w;
  });
}

// Local maxima of a sampled curve above a fraction of its peak (after
// smoothing), refined by a parabola through each top and its two
// neighbors: [{ x, y }].
export function peaks(xs, ys0, floor = 0.08, sigma = 3) {
  const ys = smooth(ys0, sigma);
  const top = Math.max(...ys);
  const out = [];
  for (let i = 1; i < ys.length - 1; i++) {
    if (ys[i] < floor * top || ys[i] < ys[i - 1] || ys[i] <= ys[i + 1]) continue;
    const d = ys[i - 1] - 2 * ys[i] + ys[i + 1];
    const o = d !== 0 ? (0.5 * (ys[i - 1] - ys[i + 1])) / d : 0;
    out.push({ x: xs[i] + o * (xs[i + 1] - xs[i]), y: ys[i] });
  }
  return out;
}

// The central lobe's edge: the angle (radians) from the middle out to the
// first minimum that falls under a fifth of the middle's (smoothed)
// intensity, averaged both ways. And its half width at half its height.
export function centralHalfWidth(xs, ys0, sigma = 3) {
  const ys = smooth(ys0, sigma);
  const mid = xs.reduce((b, x, i) => (Math.abs(x) < Math.abs(xs[b]) ? i : b), 0);
  const walk = (dir) => {
    let i = mid;
    while (i + dir > 0 && i + dir < ys.length - 1 && (ys[i + dir] <= ys[i] || ys[i] > 0.2 * ys[mid])) i += dir; // prettier-ignore
    return Math.abs(xs[i]);
  };
  return (walk(1) + walk(-1)) / 2;
}
export function halfWidthAtHalf(xs, ys0, sigma = 2) {
  const ys = smooth(ys0, sigma);
  const mid = xs.reduce((b, x, i) => (Math.abs(x) < Math.abs(xs[b]) ? i : b), 0);
  const walk = (dir) => {
    let i = mid;
    while (i + dir > 0 && i + dir < ys.length - 1 && ys[i + dir] > ys[mid] / 2) i += dir;
    const j = i + dir;
    const t = (ys[i] - ys[mid] / 2) / (ys[i] - ys[j] || 1);
    return Math.abs(xs[i] + t * (xs[j] - xs[i]));
  };
  return (walk(1) + walk(-1)) / 2;
}

// Where on an arc of radius R about the slits' midpoint the paths from two
// slits d apart differ by exactly m λ (the bright fringe, near or far):
// the angle from the straight-ahead direction, radians.
export function pathDifferenceAngle(d, lambda, m, R) {
  let lo = 0;
  let hi = Math.PI / 2;
  const diff = (th) => {
    const x = R * Math.sin(th);
    const y = R * Math.cos(th);
    return Math.hypot(x + d / 2, y) - Math.hypot(x - d / 2, y);
  };
  if (diff(hi) < m * lambda) return null;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (diff(mid) < m * lambda) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// The textbook predictions: bright fringes of two slits d apart at
// sin θ = m λ / d, and a single slit's first dark fringe at sin θ = λ / a.
export function doubleSlitAngles(d, lambda) {
  const out = [];
  for (let m = 0; m * lambda < d; m++) out.push(Math.asin((m * lambda) / d));
  return out;
}
export function singleSlitFirstMin(a, lambda) {
  return lambda < a ? Math.asin(lambda / a) : Math.PI / 2;
}

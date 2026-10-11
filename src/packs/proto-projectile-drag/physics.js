// SI units throughout. Constant-Cd, still-air model; no spin or lift.
// Equations: https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/
// Baseball diameter and Cd: https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-on-a-baseball/
// Baseball mass (5 oz): https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/forces-on-a-baseball/
// Golf dimensions: https://www.randa.org/roe/the-rules-of-equipment/part-4-conformance-of-balls
// Golf Cd and air density: https://www.physics.usyd.edu.au/~cross/TRAJECTORIES/Trajectories.html
// Table tennis dimensions, section 2.3: https://documents.ittf.sport/sites/default/files/public/2025-02/2025_ITTF_Statutes_clean_version.pdf
// Smooth sphere Cd approximated as 0.5 (NASA and Cross, above).
export const G = 9.81;
export const RHO = 1.21;
export const STEP = 1 / 240;
export const BALLS = {
  baseball: { label: "Baseball", mass: 0.14175, diameter: 0.07366, cd: 0.3 },
  golf: { label: "Golf ball", mass: 0.04593, diameter: 0.04267, cd: 0.25 },
  ping: { label: "Ping-pong ball", mass: 0.0027, diameter: 0.04, cd: 0.5 },
};

// State [x, y, vx, vy]; a = (0, -g) - rho Cd A |v| v / (2m).
function derivative(s, k) {
  const q = k * Math.hypot(s[2], s[3]);
  return [s[2], s[3], -q * s[2], -G - q * s[3]];
}
function rk4(s, h, k) {
  const a = derivative(s, k);
  const b = derivative(
    s.map((v, i) => v + (h * a[i]) / 2),
    k,
  );
  const c = derivative(
    s.map((v, i) => v + (h * b[i]) / 2),
    k,
  );
  const d = derivative(
    s.map((v, i) => v + h * c[i]),
    k,
  );
  return s.map((v, i) => v + (h * (a[i] + 2 * b[i] + 2 * c[i] + d[i])) / 6);
}
// Resolve the apex or the ground crossing inside the final fixed step.
function crossing(s, h, k, index) {
  let lo = 0;
  let hi = h;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (rk4(s, mid, k)[index] > 0) lo = mid;
    else hi = mid;
  }
  const dt = (lo + hi) / 2;
  return { dt, state: rk4(s, dt, k) };
}

export function trajectory({
  ball = "baseball",
  speed = 40,
  angle = 45,
  drag = true,
  step = STEP,
} = {}) {
  if (
    !BALLS[ball] ||
    !Number.isFinite(speed) ||
    speed < 1 ||
    speed > 100 ||
    !Number.isFinite(angle) ||
    angle <= 0 ||
    angle >= 90 ||
    !Number.isFinite(step) ||
    step <= 0 ||
    step > STEP
  )
    throw new Error("Choose a ball, a speed from 1 to 100 m/s, and an angle between 0° and 90°.");
  const b = BALLS[ball];
  const k = drag ? (RHO * b.cd * Math.PI * b.diameter ** 2) / (8 * b.mass) : 0;
  const radians = (angle * Math.PI) / 180;
  let s = [0, 0, speed * Math.cos(radians), speed * Math.sin(radians)];
  let time = 0;
  let peak = 0;
  const points = [{ t: 0, x: 0, y: 0 }];
  // Even the highest supported vacuum flight ends in under 21 seconds.
  for (let n = 0; n < Math.ceil(25 / step); n++) {
    const next = rk4(s, step, k);
    if (s[3] > 0 && next[3] <= 0) peak = crossing(s, step, k, 3).state[1];
    if (next[1] <= 0) {
      const hit = crossing(s, step, k, 1);
      time += hit.dt;
      points.push({ t: time, x: hit.state[0], y: 0 });
      return { range: hit.state[0], peak, time, points };
    }
    time += step;
    s = next;
    points.push({ t: time, x: s[0], y: s[1] });
  }
  throw new Error("The flight did not reach the ground.");
}

export function positionAt(flight, time) {
  if (time <= 0) return flight.points[0];
  if (time >= flight.time) return flight.points.at(-1);
  let lo = 0;
  let hi = flight.points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (flight.points[mid].t <= time) lo = mid;
    else hi = mid;
  }
  const a = flight.points[lo];
  const b = flight.points[hi];
  const f = (time - a.t) / (b.t - a.t);
  return { t: time, x: a.x + f * (b.x - a.x), y: a.y + f * (b.y - a.y) };
}

// Grid search: the reported optimum has a 0.1° resolution, not false precision.
export function bestAngle(settings) {
  if (settings.drag === false) return 45;
  let best = { angle: 45, range: -Infinity };
  const tryAngle = (angle) => {
    const r = trajectory({ ...settings, angle }).range;
    if (r > best.range) best = { angle, range: r };
  };
  for (let a = 1; a < 90; a++) tryAngle(a);
  const center = best.angle;
  for (let a = center - 0.9; a < center + 1; a += 0.1) tryAngle(a);
  return Math.round(best.angle * 10) / 10;
}

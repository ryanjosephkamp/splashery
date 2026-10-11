// SI units. References opened for this prototype:
// https://openstax.org/books/university-physics-volume-1/pages/17-7-the-doppler-effect
// https://www.grc.nasa.gov/www/k-12/airplane/machang.html
export const AIR_SPEED = 343;
export const SOURCE_HZ = 440;
export const STEP = 1 / 120; // Fixed step in presentation seconds.
export const PASS_SECONDS = 3;
export const EFFECT_SECONDS = 4.4;
export const METERS_PER_UNIT = 100;
export const HALF_PATH = 115; // meters
export const MISS_DISTANCE = 0.5; // meters; nearly head-on, without a singular crossing

export function sourceSpeed(options = {}) {
  const speed = Number(options.speed ?? 34.3);
  return speed + (options.mach ? AIR_SPEED : 0);
}

export function dopplerFrequency(speed, toward = 1, frequency = SOURCE_HZ) {
  // toward is the cosine of the emission direction with the velocity.
  return (frequency * AIR_SPEED) / (AIR_SPEED - speed * toward);
}

export function machAngle(speed) {
  return speed > AIR_SPEED ? Math.asin(AIR_SPEED / speed) : null;
}

export function receivedFrequencies(y, speed, b = MISS_DISTANCE) {
  // Retarded emission: c*tau = |listener - source(t - tau)|.
  // (c²-v²)*tau² + 2*y*v*tau - (y²+b²) = 0.
  // At supersonic speed there are zero or two causal roots. Both pitches
  // are real; the negative phase derivative becomes a positive audio frequency.
  const a = AIR_SPEED ** 2 - speed ** 2;
  const d = AIR_SPEED ** 2 * y ** 2 + a * b ** 2;
  if (d <= 0) return [];
  const root = Math.sqrt(d);
  const delays = [(-y * speed + root) / a, (-y * speed - root) / a];
  return delays
    .filter((tau) => tau > 0)
    .map((tau) => {
      const emittedY = y - speed * tau;
      const toward = -emittedY / Math.hypot(emittedY, b);
      return Math.abs(dopplerFrequency(speed, toward));
    });
}

export function createSimulation(options = {}) {
  const speed = sourceSpeed(options);
  const timeScale = (2 * HALF_PATH) / speed / PASS_SECONDS;
  // Show representative crests, always an integer number of source cycles apart.
  const fronts = speed > AIR_SPEED ? 20 : 64;
  const stride = Math.max(1, Math.round((SOURCE_HZ * PASS_SECONDS * timeScale) / fronts));
  // This pass is a window onto an already emitting, constant-velocity source.
  // Include earlier emissions so the visible fronts agree with the retarded audio.
  const interval = stride / SOURCE_HZ;
  const waves = [];
  for (let i = 12; i > 0; i--) {
    const at = -i * interval;
    if ((-AIR_SPEED * at) / METERS_PER_UNIT < 1.45) waves.push({ at, y: -HALF_PATH + speed * at });
  }
  return { speed, timeScale, stride, tick: 0, elapsed: 0, y: -HALF_PATH, waves, next: 0 };
}

export function advanceSimulation(sim, seconds) {
  const target = Math.max(0, Math.floor((seconds + 1e-8) / STEP));
  while (sim.tick < target) {
    sim.tick++;
    sim.elapsed = sim.tick * STEP;
    const time = Math.min(sim.elapsed, PASS_SECONDS) * sim.timeScale;
    // Exact constant-velocity integration on a fixed step; no accumulated drift.
    sim.y = -HALF_PATH + sim.speed * time;
    if (sim.elapsed <= PASS_SECONDS) {
      while (sim.next <= time + 1e-9) {
        sim.waves.push({ at: sim.next, y: -HALF_PATH + sim.speed * sim.next });
        sim.next += sim.stride / SOURCE_HZ;
      }
    }
    sim.waves = sim.waves
      .filter((w) => (AIR_SPEED * (sim.elapsed * sim.timeScale - w.at)) / METERS_PER_UNIT < 1.45)
      .slice(-12);
  }
  return sim;
}

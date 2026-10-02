// Lane Fluids r4: what a liquid is doing, for its sound (runtime.js turns it
// into cues). The owner's note on the Fluid lab (September 30, 2026): "Isn't
// in sync with fluid pour animation, and needs to be more realistic." So the
// sound follows the simulation, not the tap:
//
//   flux    liquid arriving fast at the pool's surface (recipe units³ a
//           second, landing within the next 80 ms): a stream landing, a
//           drop hitting. The pour's rush and
//           its bubbles follow it.
//   level   the pool's top (recipe units): in a glass, the air above it rings
//           (a quarter-wave pipe), so a filling glass rises in pitch.
//
// Works on either solver's particles, sampled (at most about 4,000).

// pos, vel: arrays of n particles, `stride` numbers apart, in recipe units
// (after scale * p + offset for a GPU readback in grid units; vel just *
// scale). floorY: where liquid lands before there is a pool.
export function measure(
  pos,
  vel,
  n,
  { d, gravity = 9.8 / 0.33, stride = 6, scale = 1, offset = [0, 0, 0], floorY = 0 },
) {
  const out = { flux: 0, level: null, n };
  if (!n) return out;
  const step = Math.max(1, Math.floor(n / 4000));
  const g = Math.abs(gravity);
  // "Fast": faster than falling a few particle sizes, as a pool never moves.
  const fast = Math.sqrt(2 * g * d * 12);
  const slowY = [];
  const fastY = [];
  for (let i = 0; i < n; i += step) {
    const y = pos[i * stride + 1] * scale + offset[1];
    const v = Math.hypot(vel[i * stride], vel[i * stride + 1], vel[i * stride + 2]) * scale;
    if (v < fast * 0.5) slowY.push(y);
    else if (v > fast && vel[i * stride + 1] < 0) fastY.push([y, v]);
  }
  if (slowY.length > 8) {
    // The pool: the lowest body of slow liquid (a blob still falling above
    // it, slow at first, is separated from it by a gap).
    slowY.sort((a, b) => a - b);
    let end = slowY.length;
    for (let i = 1; i < slowY.length; i++)
      if (slowY[i] - slowY[i - 1] > 4 * d && i > slowY.length * 0.2) {
        end = i;
        break;
      }
    out.level = slowY[Math.floor(end * 0.95)];
  }
  // Fast, falling liquid that reaches the pool's top within the next
  // `ahead` seconds (or is just under it) lands now: its volume over that time.
  // (no pool yet: landing on the glass's bottom or the floor)
  const top = out.level ?? floorY;
  const ahead = 0.08;
  let vol = 0;
  for (const [y, v] of fastY) if (y - top > -2 * d && y - top < v * ahead + 2 * d) vol += d ** 3;
  out.flux = (vol * step) / ahead;
  return out;
}

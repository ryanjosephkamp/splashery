// Per-toy materials for Hands-on (lane Hands engine A): bounce, weight,
// friction, rolling resistance, spin, air drag and lift, so a thrown toy
// moves like the real thing. Pure JavaScript, no DOM.
//
// A recipe asks for one with `hands.material`: a preset's name (below) or
// an object of the same keys (a preset's keys can be overridden:
// `{ preset: "baseball", magnus: 0.06 }`). Toys without one play exactly
// as before.
//
// The keys (real units where they are real):
// - mass (kg) and r (m, the radius, or half the longest side): the air
//   drag's strength comes from these with cd (the drag coefficient), as
//   the fall-to-top-speed distance in toy radii, Fr = 2 m / (rho cd pi r^3).
//   That number has no units, so it holds whatever the toy's size on
//   screen and Hands-on's gravity.
// - bounce: the coefficient of restitution on a hard floor (the floor
//   takes the same, so a basketball keeps about 0.8 of its speed).
// - friction (sliding, 0..1), roll (rolling resistance, as a fraction of
//   gravity: a pool ball on cloth 0.01, a soccer ball on grass 0.06).
// - spin: how much a throw spins it (1: the spin a hand gives where it
//   holds it, from the hold point's offset and the throw's speed; a low
//   grab gives backspin, a side grab sidespin). spinDecay: per second, in
//   the air. magnus: the curve a spin gives (toy units).
// - lift: a flat flier's lift (a disc, a paper plane, a cap), along its
//   own up (`up`, local) and growing with speed squared; gyro: a spinning
//   disc holds its tilt; fade: how fast it banks as its spin dies.
//
// Drag is the real thing, scaled (Fr has no units). Lift and the Magnus
// curve are not: Hands-on throws at most 4 toy radii per second, a hundred
// times slower than a real pitch, so `lift` and `magnus` are set so the
// glide and the curve show in a toy's short flight, in the real direction
// and in the real order (a disc glides more than a cap; a baseball curves
// more than a soccer ball).
// - nose (local axis): it turns to fly nose first (a shuttlecock's cork, a
//   paper plane's nose, a bolt), as strongly as `vane`.
// - heavy: how a heavy thing can't be thrown fast (from the mass: a throw's
//   top speed scales by (0.6 kg / mass)^0.2, between 0.45 and 1.25).
// - fingertip: true for a ball that spins on a fingertip (an upward flick
//   while holding it). warm: [first, top] bounce for a squash ball that
//   gets livelier each throw.
//
// Real numbers: the regulation sizes and masses of each sport's governing
// body (FIBA, FIFA, ITF, MLB, World Rugby, FIVB, World Aquatics, ITTF, the
// R&A, ICC, USBC, WPA, USA Pickleball, World Squash, World Lacrosse, the
// IIHF and BWF), the restitution each rule book asks for where it asks
// (a basketball dropped from 1.8 m bounces to 1.2-1.4 m: 0.82-0.88; a
// tennis ball from 254 cm to 135-147 cm: 0.73-0.76; a ping-pong ball from
// 30 cm to 23 cm: 0.88), and the textbook drag coefficient of a sphere,
// 0.47 (0.25-0.3 for a golf ball's dimples at speed). Codex task 11 is
// gathering them, with links, into tools/hands-on-materials.json; until it
// lands these are the well-known values.

export const AIR = 1.2; // kg per cubic meter

export const MATERIALS = {
  basketball: { mass: 0.62, r: 0.12, bounce: 0.82, friction: 0.7, roll: 0.02, cd: 0.47, spin: 0.6, magnus: 0.02, spinDecay: 0.12, fingertip: true }, // prettier-ignore
  "soccer-ball": { mass: 0.43, r: 0.11, bounce: 0.75, friction: 0.6, roll: 0.06, cd: 0.47, spin: 0.7, magnus: 0.03 }, // prettier-ignore
  "american-football": { mass: 0.41, r: 0.14, bounce: 0.55, friction: 0.6, roll: 0.08, cd: 0.15, spin: 0.4, spiral: 14 }, // prettier-ignore
  "tennis-ball": { mass: 0.058, r: 0.0335, bounce: 0.75, friction: 0.6, roll: 0.03, cd: 0.55, spin: 0.8, magnus: 0.03 }, // prettier-ignore
  baseball: { mass: 0.145, r: 0.0366, bounce: 0.55, friction: 0.5, roll: 0.04, cd: 0.35, spin: 1, magnus: 0.06 }, // prettier-ignore
  softball: { mass: 0.18, r: 0.0485, bounce: 0.45, friction: 0.5, roll: 0.05, cd: 0.4, spin: 0.8, magnus: 0.04 }, // prettier-ignore
  "beach-ball": { mass: 0.08, r: 0.3, bounce: 0.6, friction: 0.5, roll: 0.05, cd: 0.47, spin: 0.5, magnus: 0.04, spinDecay: 0.4 }, // prettier-ignore
  "golf-ball": { mass: 0.0459, r: 0.02135, bounce: 0.78, friction: 0.5, roll: 0.03, cd: 0.27, spin: 1.2, magnus: 0.07 }, // prettier-ignore
  "rugby-ball": { mass: 0.44, r: 0.15, bounce: 0.5, friction: 0.6, roll: 0.1, cd: 0.2, spin: 0.6, tumble: 9 }, // prettier-ignore
  volleyball: { mass: 0.27, r: 0.105, bounce: 0.7, friction: 0.6, roll: 0.04, cd: 0.47, spin: 0.6, magnus: 0.03 }, // prettier-ignore
  "water-polo-ball": { mass: 0.43, r: 0.11, bounce: 0.6, friction: 0.8, roll: 0.05, cd: 0.47, spin: 0.5 }, // prettier-ignore
  "ping-pong-ball": { mass: 0.0027, r: 0.02, bounce: 0.88, friction: 0.4, roll: 0.02, cd: 0.47, spin: 1, magnus: 0.06 }, // prettier-ignore
  "cricket-ball": { mass: 0.16, r: 0.036, bounce: 0.5, friction: 0.35, roll: 0.05, cd: 0.4, spin: 0.8, magnus: 0.03 }, // prettier-ignore
  "bowling-ball": { mass: 7.26, r: 0.109, bounce: 0.12, friction: 0.12, roll: 0.01, cd: 0.47, spin: 0.8, hook: 0.6 }, // prettier-ignore
  "pool-ball": { mass: 0.17, r: 0.0286, bounce: 0.5, friction: 0.2, roll: 0.01, cd: 0.47, spin: 1.2 }, // prettier-ignore
  pickleball: { mass: 0.026, r: 0.037, bounce: 0.5, friction: 0.5, roll: 0.05, cd: 0.6, spin: 0.6, magnus: 0.03 }, // prettier-ignore
  dodgeball: { mass: 0.3, r: 0.105, bounce: 0.6, friction: 0.6, roll: 0.06, cd: 0.47, spin: 0.5 }, // prettier-ignore
  "medicine-ball": { mass: 4, r: 0.14, bounce: 0.08, friction: 0.8, roll: 0.15, cd: 0.47, spin: 0.3 }, // prettier-ignore
  "lacrosse-ball": { mass: 0.145, r: 0.032, bounce: 0.68, friction: 0.7, roll: 0.03, cd: 0.47, spin: 0.7, magnus: 0.03 }, // prettier-ignore
  "squash-ball": { mass: 0.024, r: 0.02, bounce: 0.3, friction: 0.6, roll: 0.05, cd: 0.47, spin: 0.6, warm: [0.25, 0.5] }, // prettier-ignore
  "bouncy-ball": { mass: 0.02, r: 0.0135, bounce: 0.9, friction: 0.8, roll: 0.02, cd: 0.47, spin: 1 }, // prettier-ignore
  marble: { mass: 0.005, r: 0.008, bounce: 0.55, friction: 0.3, roll: 0.006, cd: 0.47, spin: 0.8 }, // prettier-ignore
  "hockey-puck": { mass: 0.17, r: 0.038, bounce: 0.2, friction: 0.04, roll: 0, cd: 0.8, spin: 0.6 }, // prettier-ignore
  shuttlecock: { mass: 0.0052, r: 0.04, bounce: 0.2, friction: 0.6, roll: 0.2, cd: 0.6, spin: 0.3, nose: [0, -1, 0], vane: 30 }, // prettier-ignore
  "flying-disc": { mass: 0.175, r: 0.1365, bounce: 0.25, friction: 0.5, roll: 0.3, cd: 0.08, spin: 1, lift: 0.9, up: [0, 1, 0], gyro: 6, fade: 0.6 }, // prettier-ignore
  "paper-plane": { mass: 0.005, r: 0.12, bounce: 0.1, friction: 0.7, roll: 0.5, cd: 0.25, spin: 0.2, lift: 1.4, up: [0, 1, 0], nose: [1, 0, 0], vane: 6 }, // prettier-ignore
  "baseball-cap": { mass: 0.1, r: 0.13, bounce: 0.15, friction: 0.8, roll: 0.5, cd: 0.4, spin: 0.8, lift: 0.5, up: [0, 1, 0], gyro: 2, fade: 1 }, // prettier-ignore
};

// The material a recipe's hands block asks for, filled in; null when it
// asks for none.
export function materialFor(hands) {
  const m = hands?.material;
  if (!m) return null;
  const base = typeof m === "string" ? MATERIALS[m] : m.preset ? MATERIALS[m.preset] : null;
  const out = { mass: 0.5, r: 0.1, bounce: 0.4, friction: 0.6, roll: 0.05, cd: 0.47, spin: 0.5, magnus: 0, spinDecay: 0.2, ...(base || {}), ...(typeof m === "object" ? m : {}) }; // prettier-ignore
  // The fall-to-top-speed distance, in toy radii.
  out.fr = (2 * out.mass) / (AIR * out.cd * Math.PI * out.r ** 3);
  out.throwScale = Math.max(0.45, Math.min(1.25, (0.6 / out.mass) ** 0.2));
  return out;
}

// Sets a body's contact numbers from its material (and the floor's, so the
// bounce on it is the material's own).
export function applyMaterial(body, mat, floor) {
  body.restitution = mat.bounce;
  body.friction = mat.friction;
  // The air's drag is worked out by airForce below; this is only what a
  // body loses anyway (a little, so nothing drifts for ever).
  body.damping = 0.02;
  body.angDamping = mat.spinDecay;
  if (floor) {
    floor.restitution = mat.bounce;
    floor.friction = Math.max(floor.friction, mat.friction);
  }
}

// The air on one body, for one substep h: quadratic drag, the Magnus curve
// of a spin, a flat flier's lift and a nose that turns into the wind. G is
// the world's gravity (toy units), R the toy's radius (the body's units).
export function airForce(b, mat, G, R, h) {
  if (b.fixed || b.held) return;
  const v = b.vel;
  const sp = Math.hypot(v[0], v[1], v[2]);
  if (sp < 1e-6) return;
  // Drag: a = v^2 / (Fr R), so the top speed falling is sqrt(Fr G R).
  const k = (sp / (mat.fr * R)) * h;
  const f = 1 / (1 + k); // (implicit, so it never overshoots)
  const w = b.omega;
  const dv = [v[0] * (f - 1), v[1] * (f - 1), v[2] * (f - 1)];
  if (mat.magnus) {
    // a = magnus (w x v), the curve a spinning ball takes.
    const c = [w[1] * v[2] - w[2] * v[1], w[2] * v[0] - w[0] * v[2], w[0] * v[1] - w[1] * v[0]];
    for (let i = 0; i < 3; i++) dv[i] += mat.magnus * c[i] * h;
  }
  if (mat.lift) {
    // Lift along the flier's own up, growing with the square of its speed
    // across that up (full at a brisk throw, 3 toy radii per second), and
    // with its tilt into the wind (a disc's lift coefficient, 0.15 + 1.4
    // times the angle of attack, scaled so a throw shows its glide).
    const up = rotate(b.q, mat.up || [0, 1, 0]);
    const vn = up[0] * v[0] + up[1] * v[1] + up[2] * v[2];
    const vt2 = Math.max(0, sp * sp - vn * vn);
    const aoa = Math.max(-0.5, Math.min(0.5, -vn / sp));
    const cl = Math.max(-0.6, Math.min(0.9, (0.15 + 1.4 * aoa) / 0.4));
    const L = mat.lift * G * Math.min(1.5, vt2 / (9 * R * R)) * cl;
    // (Capped at twice gravity: lift never throws it up.)
    const a = Math.max(-2 * G, Math.min(2 * G, L));
    for (let i = 0; i < 3; i++) dv[i] += up[i] * a * h;
    // A spinning disc holds its tilt (only its spin about its up stays);
    // as the spin dies it banks (fades).
    if (mat.gyro) {
      const s = w[0] * up[0] + w[1] * up[1] + w[2] * up[2];
      const keep = Math.exp(-mat.gyro * Math.min(1, Math.abs(s) / 8) * h);
      for (let i = 0; i < 3; i++) w[i] = up[i] * s + (w[i] - up[i] * s) * keep;
      if (mat.fade) {
        const dir = [v[0] / sp, v[1] / sp, v[2] / sp];
        const bank = (mat.fade * Math.sign(s || 1)) / (1 + Math.abs(s) / 4);
        for (let i = 0; i < 3; i++) w[i] += dir[i] * bank * h;
      }
    }
  }
  if (mat.nose) {
    // A weathervane: the nose turns into its flight (a shuttlecock flips
    // cork first), more strongly the faster it goes.
    const n = rotate(b.q, mat.nose);
    const d = [v[0] / sp, v[1] / sp, v[2] / sp];
    const t = [n[1] * d[2] - n[2] * d[1], n[2] * d[0] - n[0] * d[2], n[0] * d[1] - n[1] * d[0]];
    const g = (mat.vane ?? 10) * Math.min(1, sp / (0.5 * R)) * h;
    for (let i = 0; i < 3; i++) w[i] = (w[i] + t[i] * g * 20) * Math.exp(-6 * Math.min(1, sp / (0.5 * R)) * h); // prettier-ignore
  }
  for (let i = 0; i < 3; i++) v[i] += dv[i];
}

// Rolling resistance on the ground: the roll slows by `roll` times gravity
// (and a sliding puck by its friction alone). `touching` is true while it
// rests on something.
export function rollForce(b, mat, G, h) {
  if (b.fixed || b.held || !mat.roll) return;
  const v = b.vel;
  const hs = Math.hypot(v[0], v[2]);
  if (hs < 1e-6) return;
  const dec = Math.min(hs, mat.roll * G * h);
  v[0] -= (v[0] / hs) * dec;
  v[2] -= (v[2] / hs) * dec;
  // The spin about the upright dies on the ground slowly (a ball spinning on
  // the spot); its rolling follows the contact's friction.
  const s = 1 - Math.min(1, mat.roll * 2 * h);
  b.omega[0] *= s;
  b.omega[2] *= s;
}

// The spin a throw gives: what the hand gives where it holds the ball (r,
// the hold point's offset in the world) moving at v, scaled by `spin`; a
// football spirals about its long axis, a rugby ball tumbles end over end,
// a bowling ball hooks.
export function throwSpin(mat, r, v, longAxis) {
  const r2 = r[0] * r[0] + r[1] * r[1] + r[2] * r[2];
  if (r2 < 1e-12) return [0, 0, 0];
  const c = [r[1] * v[2] - r[2] * v[1], r[2] * v[0] - r[0] * v[2], r[0] * v[1] - r[1] * v[0]];
  const out = c.map((x) => (x * mat.spin) / r2);
  const sp = Math.hypot(v[0], v[1], v[2]);
  if (mat.spiral && longAxis && sp > 1e-6) {
    const s = Math.sign(longAxis[0] * v[0] + longAxis[1] * v[1] + longAxis[2] * v[2]) || 1;
    for (let i = 0; i < 3; i++) out[i] += longAxis[i] * s * mat.spiral;
  }
  if (mat.tumble && sp > 1e-6) {
    const t = [-v[2] / sp, 0, v[0] / sp];
    for (let i = 0; i < 3; i++) out[i] += t[i] * mat.tumble;
  }
  if (mat.hook && sp > 1e-6) out[1] += mat.hook * 4 * (Math.sign(c[1]) || 1);
  return out;
}

function rotate(q, v) {
  const [x, y, z, w] = q;
  const cx = y * v[2] - z * v[1] + w * v[0];
  const cy = z * v[0] - x * v[2] + w * v[1];
  const cz = x * v[1] - y * v[0] + w * v[2];
  return [v[0] + 2 * (y * cz - z * cy), v[1] + 2 * (z * cx - x * cz), v[2] + 2 * (x * cy - y * cx)];
}

// Splash droplets: spawned on pointer down and on fast pointer movement.
// Droplets are stamped into the wet layer at random tangent-plane offsets
// around the contact point. Uses a seeded rng so a replay reproduces them.

import { Vector3 } from "three";

const _t = new Vector3();
const _b = new Vector3();
const _p = new Vector3();

export const SPLASH_SPEED_THRESHOLD = 2.6; // surface units per second
export const SPLASH_COOLDOWN_MS = 90;

// speed: pointer speed along the surface in units/s (unit sphere).
// direction: unit tangent vector of motion in object space, or null.
export function makeSplash({ shape, center, direction, speed, brush, rng, texelAngle }) {
  const s = Math.min(1, Math.max(0, speed / 6));
  const count = Math.round(8 + 32 * s);
  const spread = brush.size * (1.5 + 3.5 * s);
  const frame = shape.tangentFrame(center, _t, _b);
  const droplets = [];
  for (let i = 0; i < count; i++) {
    const ang = rng() * Math.PI * 2;
    let dist = spread * Math.sqrt(rng());
    const cosA = Math.cos(ang);
    const sinA = Math.sin(ang);
    _p.copy(center);
    _p.addScaledVector(frame.tangent, cosA * dist);
    _p.addScaledVector(frame.bitangent, sinA * dist);
    if (direction && s > 0) {
      _p.addScaledVector(direction, dist * (0.4 + 0.9 * s) * rng());
    }
    shape.project(_p, _p);
    const radius = Math.max(texelAngle * 1.5, brush.size * (0.1 + 0.32 * rng()) * (0.75 + 0.5 * s));
    droplets.push({
      p: _p.clone(),
      radius,
      alpha: brush.opacity * (0.5 + 0.5 * rng()),
      wet: Math.max(brush.wetness, 0.65),
      hardness: 0.55,
    });
  }
  return droplets;
}

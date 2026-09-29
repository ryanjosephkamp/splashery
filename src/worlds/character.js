// The character: a small person built with the kit from rigid parts (head,
// torso, arms, thighs, shins), each its own splat cloud that turns on a
// hinge. Nothing bends or stretches: legs, arms and head swing as solid
// pieces, like a jointed wooden figure. Pure JavaScript: the build gives
// each part's splats around its own pivot, and pose() gives the angles for
// idle, walk and run; the renderer (world.js) turns the joints.
//
// Meters, facing +z, feet at y = 0.

import { Kit, mix, shade, rgb, clamp } from "../kit.js";
import { SplatBuffer } from "../generators.js";
import { mixSeed } from "../noise.js";

export const BODY = {
  hip: 0.9, // the hip joints' height
  hipX: 0.1,
  thigh: 0.42,
  shin: 0.4,
  torso: 0.52,
  shoulderX: 0.25,
  shoulderY: 0.45, // above the hips
  neck: 0.56, // above the hips
  height: 1.72,
  radius: 0.3, // for collision
};

const SUN = [-0.45, 0.8, 0.35];
const lit = (c, n, k = 0.45) =>
  shade(c, 1 - k * 0.5 + k * Math.max(0, n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2]));

// The parts, in the order the renderer builds the joints. `parent` is the
// joint a part hangs from; `at` is its pivot relative to that parent.
export const JOINTS = [
  { name: "hips", parent: null, at: [0, BODY.hip, 0] },
  { name: "torso", parent: "hips", at: [0, 0, 0] },
  { name: "head", parent: "torso", at: [0, BODY.neck, 0] },
  { name: "armL", parent: "torso", at: [BODY.shoulderX, BODY.shoulderY, 0] },
  { name: "armR", parent: "torso", at: [-BODY.shoulderX, BODY.shoulderY, 0] },
  { name: "thighL", parent: "hips", at: [BODY.hipX, 0, 0] },
  { name: "thighR", parent: "hips", at: [-BODY.hipX, 0, 0] },
  { name: "shinL", parent: "thighL", at: [0, -BODY.thigh, 0] },
  { name: "shinR", parent: "thighR", at: [0, -BODY.thigh, 0] },
];

// Builds every part's splats, each around its own pivot. `count` is the
// whole figure's splats. Returns { name: SplatBuffer }.
export function buildCharacter(look, { count = 26000, seed = 7 } = {}) {
  const c = {
    skin: rgb(look.skin),
    hair: rgb(look.hair),
    shirt: rgb(look.shirt),
    trousers: rgb(look.trousers),
    shoes: rgb(look.shoes),
  };
  const share = { torso: 0.2, head: 0.2, armL: 0.1, armR: 0.1, thighL: 0.08, thighR: 0.08, shinL: 0.12, shinR: 0.12 }; // prettier-ignore
  const out = {};
  const cloth =
    (col, k = 0.45) =>
    (s) => {
      const g = s.fbm(s.p[0] * 14, s.p[1] * 14, s.p[2] * 14, 2);
      return lit(mix(col, shade(col, 0.8), clamp(0.5 + g * 1.5, 0, 1)), s.n, k);
    };
  for (const name in share) {
    const k = new Kit(mixSeed(seed, name), { count: Math.round(count * share[name]), fit: false });
    const side = name.endsWith("L") ? 1 : -1;
    if (name === "torso") {
      // A shirt over a rounded body, a collar and a belt.
      k.add(k.roundedBox(0.4, 0.5, 0.24, 4), { pos: [0, 0.27, 0], even: true, flat: 0.25, color: cloth(c.shirt) }); // prettier-ignore
      k.add(k.roundedBox(0.44, 0.16, 0.28, 3), { pos: [0, 0.44, 0], even: true, flat: 0.25, color: cloth(c.shirt) }); // prettier-ignore
      k.add(k.cylinder(0.075, 0.08), {
        pos: [0, BODY.neck - 0.04, 0],
        color: (s) => lit(c.skin, s.n),
      });
      k.add(k.roundedBox(0.41, 0.07, 0.25, 4), { pos: [0, 0.03, 0], color: (s) => lit(shade(c.trousers, 0.7), s.n) }); // prettier-ignore
    } else if (name === "head") {
      // Round head, hair on the top and back, two eyes and a nose, ears.
      const R = 0.135;
      k.add(k.ellipsoid(R, R * 1.12, R * 1.02), {
        pos: [0, 0.14, 0],
        even: true,
        flat: 0.25,
        color: (s) => {
          const lp = s.lp;
          const hair =
            lp[1] > 0.02 - 0.08 * Math.max(0, -lp[2] / R) || (lp[2] < -0.02 && lp[1] > -0.06);
          if (hair) return lit(mix(c.hair, shade(c.hair, 1.3), s.rand() * 0.3), s.n, 0.5);
          return lit(c.skin, s.n, 0.4);
        },
      });
      for (const sx of [-1, 1]) {
        k.add(k.ellipsoid(0.017, 0.022, 0.01), { pos: [sx * 0.048, 0.155, R * 1.0 - 0.004], weight: 6, color: "#1c1c22", flat: 0.4 }); // prettier-ignore
        k.add(k.ellipsoid(0.02, 0.035, 0.03), { pos: [sx * R * 1.0, 0.13, 0], color: (s) => lit(c.skin, s.n) }); // prettier-ignore
      }
      k.add(k.ellipsoid(0.02, 0.026, 0.022), { pos: [0, 0.12, R + 0.01], weight: 3, color: (s) => lit(shade(c.skin, 0.95), s.n) }); // prettier-ignore
      k.add(k.ellipsoid(0.032, 0.008, 0.01), { pos: [0, 0.075, R * 0.95], weight: 4, color: "#8a4a44", flat: 0.4 }); // prettier-ignore
    } else if (name.startsWith("arm")) {
      // A sleeve, a bare forearm with a slight bend, a hand.
      k.add(k.cone(0.068, 0.058, 0.3), { pos: [0, -0.14, 0], even: true, color: cloth(c.shirt) });
      k.add(k.cone(0.048, 0.042, 0.28), { pos: [0, -0.43, 0.02], rot: [-8, 0, 0], even: true, color: (s) => lit(c.skin, s.n) }); // prettier-ignore
      k.add(k.ellipsoid(0.05, 0.07, 0.035), { pos: [side * 0.005, -0.61, 0.04], color: (s) => lit(c.skin, s.n) }); // prettier-ignore
    } else if (name.startsWith("thigh")) {
      k.add(k.cone(0.09, 0.07, BODY.thigh + 0.04), { pos: [0, -BODY.thigh / 2, 0], even: true, color: cloth(c.trousers) }); // prettier-ignore
    } else if (name.startsWith("shin")) {
      k.add(k.cone(0.068, 0.055, BODY.shin - 0.04), { pos: [0, -BODY.shin / 2 + 0.02, 0], even: true, color: cloth(c.trousers) }); // prettier-ignore
      // A shoe with its toe forward and a pale sole.
      k.add(k.roundedBox(0.11, 0.08, 0.24, 4), {
        pos: [0, -BODY.shin + 0.045, 0.05],
        even: true,
        color: (s) => (s.lp[1] < -0.025 ? lit("#e8e2d6", s.n, 0.3) : lit(c.shoes, s.n, 0.5)),
      });
    }
    const it = k.emit();
    while (!it.next().done);
    out[name] = plain(k.buf);
  }
  return out;
}

function plain(buf) {
  const out = new SplatBuffer(buf.count);
  for (let i = 0; i < buf.count; i++) {
    out.push(
      [buf.pos[i * 3], buf.pos[i * 3 + 1], buf.pos[i * 3 + 2]],
      [buf.scale[i * 3], buf.scale[i * 3 + 1], buf.scale[i * 3 + 2]],
      [buf.rot[i * 4], buf.rot[i * 4 + 1], buf.rot[i * 4 + 2], buf.rot[i * 4 + 3]],
      [buf.color[i * 4], buf.color[i * 4 + 1], buf.color[i * 4 + 2], buf.color[i * 4 + 3]],
    );
  }
  return out;
}

// ---- Motion ------------------------------------------------------------------

// Stride lengths (meters per full step cycle) for walking and running.
export const WALK_SPEED = 1.9;
export const RUN_SPEED = 4.6;

// The gait: a phase that advances with distance walked, and the joint
// angles for a speed. Returns { joints: { name: [x, y, z] degrees }, bob }
// (bob: the hips' rise in meters). `t` is the time for idle motion.
export function pose(state, t) {
  const v = state.speed; // meters per second along the ground
  const run = clamp((v - WALK_SPEED) / (RUN_SPEED - WALK_SPEED), 0, 1);
  const walk = clamp(v / WALK_SPEED, 0, 1);
  const idle = 1 - walk;
  const ph = state.phase;
  const s = Math.sin(ph);
  const cs = Math.cos(ph);
  // Degrees. Positive x turns a hanging limb backward.
  const legA = walk * (28 + 22 * run);
  const armA = walk * (22 + 24 * run);
  const knee = walk * (18 + 55 * run);
  const lean = walk * (4 + 10 * run);
  const breathe = Math.sin(t * 1.7);
  const look = Math.sin(t * 0.37) * 22 * idle;
  const j = {
    hips: [0, 0, 0],
    torso: [lean + idle * breathe * 1.2, walk * 6 * s, 0],
    head: [-lean * 0.6 + idle * 2 * Math.sin(t * 0.61), look, 0],
    thighL: [-legA * s, 0, 0],
    thighR: [legA * s, 0, 0],
    // Knees fold while a leg swings forward (its foot off the ground):
    // the left thigh swings forward while cos(phase) > 0, the right while
    // it is < 0.
    shinL: [knee * Math.max(0, cs) * 1.1 + walk * 4, 0, 0],
    shinR: [knee * Math.max(0, -cs) * 1.1 + walk * 4, 0, 0],
    armL: [armA * s + idle * 2 * breathe - run * 20, 0, -4 - idle * 1.5 * breathe],
    armR: [-armA * s + idle * 2 * breathe - run * 20, 0, 4 + idle * 1.5 * breathe],
  };
  // The body rises as each leg passes under it.
  const bob =
    walk * (0.025 + 0.04 * run) * (Math.cos(2 * ph) * 0.5 + 0.5) - walk * 0.02 - run * 0.03;
  return { joints: j, bob };
}

// Advances the gait: the phase turns once per stride.
export function stepGait(state, speed, dt) {
  state.speed += (speed - state.speed) * (1 - Math.exp(-dt * 10));
  const run = clamp((state.speed - WALK_SPEED) / (RUN_SPEED - WALK_SPEED), 0, 1);
  const stride = 1.35 + 0.9 * run;
  state.phase = (state.phase + ((state.speed * dt) / stride) * Math.PI * 2) % (Math.PI * 2);
  if (state.speed < 0.05) state.phase *= Math.exp(-dt * 3);
  return state;
}

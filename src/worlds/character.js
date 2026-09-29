// The character: a small person built with the kit from rigid parts (head,
// torso, upper arms, forearms, thighs, shins), each its own splat cloud that turns on a
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
  hip: 0.92, // the hip joints' height
  hipX: 0.095,
  thigh: 0.43,
  shin: 0.42,
  upperArm: 0.29,
  shoulderX: 0.19,
  shoulderY: 0.5, // above the hips
  neck: 0.585, // above the hips
  height: 1.74,
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
  { name: "foreL", parent: "armL", at: [0, -BODY.upperArm, 0] },
  { name: "foreR", parent: "armR", at: [0, -BODY.upperArm, 0] },
  { name: "thighL", parent: "hips", at: [BODY.hipX, 0, 0] },
  { name: "thighR", parent: "hips", at: [-BODY.hipX, 0, 0] },
  { name: "shinL", parent: "thighL", at: [0, -BODY.thigh, 0] },
  { name: "shinR", parent: "thighR", at: [0, -BODY.thigh, 0] },
];

// Each part's share of the figure's splats (the head and hands get more
// than their size: faces are looked at).
const SHARE = { torso: 0.2, head: 0.24, armL: 0.055, armR: 0.055, foreL: 0.055, foreR: 0.055, thighL: 0.07, thighR: 0.07, shinL: 0.1, shinR: 0.1 }; // prettier-ignore

// Builds every part's splats, each around its own pivot. `count` is the
// whole figure's splats. Returns { name: SplatBuffer }.
export function buildCharacter(look, { count = 60000, seed = 7 } = {}) {
  const c = {
    skin: rgb(look.skin),
    hair: rgb(look.hair),
    shirt: rgb(look.shirt),
    trousers: rgb(look.trousers),
    shoes: rgb(look.shoes),
  };
  const out = {};
  // Cloth: soft folds as large, gentle shading (no per-splat noise).
  const cloth =
    (col, k = 0.45) =>
    (s) => {
      const g = s.fbm(s.p[0] * 7, s.p[1] * 9, s.p[2] * 7, 2);
      return lit(mix(col, shade(col, 0.82), clamp(0.5 + g * 1.3, 0, 1)), s.n, k);
    };
  const skin =
    (k = 0.4) =>
    (s) =>
      lit(c.skin, s.n, k);
  const smooth = { even: true, flat: 0.45, jitter: 0.01 };
  for (const name in SHARE) {
    const k = new Kit(mixSeed(seed, name), { count: Math.round(count * SHARE[name]), fit: false });
    const side = name.endsWith("L") ? 1 : -1;
    if (name === "torso") buildTorso(k, c, cloth, skin, smooth);
    else if (name === "head") buildHead(k, c, skin, smooth);
    else if (name.startsWith("arm")) {
      // The shoulder and a short sleeve, then the bare upper arm.
      k.add(k.ellipsoid(0.056, 0.05, 0.056), {
        pos: [0, -0.02, 0],
        ...smooth,
        color: cloth(c.shirt),
      });
      k.add(k.cone(0.058, 0.05, 0.19), { pos: [0, -0.1, 0], ...smooth, color: cloth(c.shirt) });
      k.add(k.torus(0.051, 0.008), { pos: [0, -0.195, 0], weight: 2, color: cloth(shade(c.shirt, 0.9)) }); // prettier-ignore
      k.add(k.cone(0.045, 0.041, 0.11), { pos: [0, -0.24, 0], ...smooth, color: skin() });
      k.add(k.sphere(0.041), { pos: [0, -BODY.upperArm, 0], ...smooth, color: skin() });
    } else if (name.startsWith("fore")) {
      // Forearm, wrist and a hand with its thumb (palm facing in).
      k.add(k.cone(0.041, 0.031, 0.23), { pos: [0, -0.115, 0], ...smooth, color: skin() });
      k.add(k.roundedBox(0.032, 0.09, 0.075, 4), { pos: [side * -0.004, -0.285, 0.006], ...smooth, weight: 1.6, color: skin(0.35) }); // prettier-ignore
      k.add(k.ellipsoid(0.012, 0.032, 0.013), { pos: [side * -0.012, -0.265, 0.042], rot: [-25, 0, 0], weight: 1.6, ...smooth, color: skin(0.35) }); // prettier-ignore
    } else if (name.startsWith("thigh")) {
      k.add(k.cone(0.085, 0.062, BODY.thigh + 0.05), { pos: [0, -BODY.thigh / 2 + 0.02, 0], ...smooth, color: cloth(c.trousers) }); // prettier-ignore
    } else if (name.startsWith("shin")) {
      k.add(k.sphere(0.058), { pos: [0, 0, 0], ...smooth, color: cloth(c.trousers) });
      k.add(k.cone(0.06, 0.05, BODY.shin - 0.07), { pos: [0, -(BODY.shin - 0.07) / 2, 0], ...smooth, color: cloth(c.trousers) }); // prettier-ignore
      k.add(k.torus(0.05, 0.009), { pos: [0, -BODY.shin + 0.075, 0], weight: 2, color: cloth(shade(c.trousers, 0.85)) }); // prettier-ignore
      // A shoe: upper, toe cap and a pale sole.
      k.add(k.roundedBox(0.095, 0.07, 0.235, 5), {
        pos: [0, -BODY.shin + 0.045, 0.04],
        ...smooth,
        weight: 1.3,
        color: (s) => {
          if (s.lp[1] < -0.022) return lit("#ece6da", s.n, 0.3);
          const toe = s.lp[2] > 0.07 ? 0.85 : 1;
          return lit(shade(c.shoes, toe), s.n, 0.5);
        },
      });
    }
    const it = k.emit();
    while (!it.next().done);
    out[name] = plain(k.buf);
  }
  return out;
}

// The torso, from the hips: trousers at the top of the legs, a belt, a
// shirt over a tapered chest with a placket and buttons, a collar, the neck.
function buildTorso(k, c, cloth, skin, smooth) {
  k.add(k.ellipsoid(0.165, 0.1, 0.105), { pos: [0, 0.02, 0], ...smooth, color: cloth(c.trousers) });
  k.add(k.cylinder(0.153, 0.05), {
    pos: [0, 0.095, 0],
    scale: [1, 1, 0.68],
    ...smooth,
    color: (s) => (s.p[2] > 0.08 && Math.abs(s.p[0]) < 0.024 && Math.abs(s.p[1] - 0.095) < 0.018 ? lit("#c9b27a", s.n, 0.3) : lit("#3b2c22", s.n, 0.4)), // prettier-ignore
  });
  const profile = [
    [0.148, 0.1],
    [0.152, 0.2],
    [0.162, 0.32],
    [0.178, 0.42],
    [0.186, 0.48],
    [0.16, 0.535],
    [0.11, 0.565],
    [0.058, 0.585],
  ];
  k.add(k.lathe(profile), {
    scale: [1, 1, 0.64],
    ...smooth,
    color: (s) => {
      const front = s.n[2] > 0.3;
      // A placket down the front.
      if (front && Math.abs(s.p[0]) < 0.01 && s.p[1] > 0.14 && s.p[1] < 0.55) return lit(shade(c.shirt, 0.88), s.n, 0.35); // prettier-ignore
      return cloth(c.shirt)(s);
    },
  });
  k.add(k.torus(0.066, 0.016), { pos: [0, 0.575, 0.004], scale: [1, 0.8, 0.9], weight: 1.5, ...smooth, color: cloth(shade(c.shirt, 1.08)) }); // prettier-ignore
  k.add(k.cylinder(0.047, 0.09), { pos: [0, BODY.neck + 0.005, 0.004], ...smooth, color: skin() });
}

// The head, from the neck: skull and jaw, hair with a side part and a
// fringe, eyes (whites and irises), brows, nose, mouth and ears.
function buildHead(k, c, skin, smooth) {
  const face = (s) => {
    const blush = Math.max(0, 1 - Math.hypot(Math.abs(s.p[0]) - 0.055, s.p[1] - 0.1) / 0.03);
    return lit(mix(c.skin, "#d9826e", blush * 0.12), s.n, 0.38);
  };
  k.add(k.ellipsoid(0.097, 0.118, 0.106), { pos: [0, 0.135, 0], ...smooth, weight: 1.2, color: face }); // prettier-ignore
  k.add(k.ellipsoid(0.074, 0.058, 0.082), { pos: [0, 0.075, 0.014], ...smooth, color: face });
  // Hair: a shell over the skull, cut away over the face.
  k.add(k.ellipsoid(0.104, 0.124, 0.113), {
    pos: [0, 0.148, -0.006],
    ...smooth,
    flat: 0.35,
    color: (s) => {
      const d = s.ln;
      const fringe = 0.34 + 0.12 * Math.sin(d[0] * 9);
      if (d[2] > 0.3 && d[1] < fringe) return null; // the face
      if (d[1] < -0.35) return null; // the nape
      if (Math.abs(d[0]) > 0.8 && d[1] < 0.1 && d[2] > -0.3) return null; // the ears
      const strand = s.noise(d[0] * 28, d[1] * 6, d[2] * 28) * 0.5 + 0.5;
      return lit(mix(shade(c.hair, 0.8), shade(c.hair, 1.35), strand * 0.6), s.n, 0.55);
    },
  });
  for (const sx of [-1, 1]) {
    k.add(k.ellipsoid(0.019, 0.013, 0.008), { pos: [sx * 0.037, 0.138, 0.097], weight: 5, flat: 0.4, color: "#f6f3ee" }); // prettier-ignore
    k.add(k.ellipsoid(0.009, 0.01, 0.004), { pos: [sx * 0.035, 0.137, 0.105], weight: 7, flat: 0.4, color: "#2a2320" }); // prettier-ignore
    k.add(k.box(0.032, 0.007, 0.008), { pos: [sx * 0.037, 0.161, 0.1], rot: [0, 0, sx * 7], weight: 5, color: shade(c.hair, 0.8) }); // prettier-ignore
    k.add(k.ellipsoid(0.013, 0.026, 0.02), { pos: [sx * 0.098, 0.128, -0.002], ...smooth, color: skin(0.4) }); // prettier-ignore
  }
  k.add(k.ellipsoid(0.011, 0.018, 0.012), { pos: [0, 0.115, 0.104], weight: 3, ...smooth, color: skin(0.5) }); // prettier-ignore
  k.add(k.ellipsoid(0.021, 0.005, 0.006), { pos: [0, 0.078, 0.094], weight: 5, flat: 0.4, color: "#9a5550" }); // prettier-ignore
}

function plain(buf) {
  const out = new SplatBuffer(buf.count);
  for (let i = 0; i < buf.count; i++) {
    if (buf.color[i * 4 + 3] <= 0) continue;
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
    armL: [armA * s + idle * 2 * breathe - run * 12, 0, -5 - idle * 1.5 * breathe],
    armR: [-armA * s + idle * 2 * breathe - run * 12, 0, 5 + idle * 1.5 * breathe],
    // Elbows bend forward, more as the arm swings forward and when running.
    foreL: [-(8 + walk * 10 + run * 60) - Math.max(0, -armA * s) * 0.4, 0, 0],
    foreR: [-(8 + walk * 10 + run * 60) - Math.max(0, armA * s) * 0.4, 0, 0],
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

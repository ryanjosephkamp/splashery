// The character's motion (lane Character): walking, running and standing,
// as angles for rigid parts. Pure JavaScript.
//
// The feet lead. Each foot's path is worked out on the ground first: a
// planted foot stays where it landed (it rolls from the heel over the flat
// foot onto the ball, the toes staying flat), and a swinging foot travels
// from where it left the ground to where it lands, starting and stopping
// at the ground's speed. The hips ride as high as both legs allow, so they
// dip as the legs spread and rise over the planted foot. Each leg then
// reaches its foot by two-bone inverse kinematics (the knee bends forward),
// and the ankle and toes turn the shoe to match. The hips turn with the
// leg that swings forward and the shoulders against them; the arms swing
// opposite the legs with bent elbows; the head keeps level and looks ahead.
//
// Standing, the body breathes, shifts its weight from foot to foot now and
// then (the feet stay put), and glances round.

import { BODY, rotX, rotY, rotZ, mul, tr, apply, euler, toEuler, fromColumns, I3 } from "./character-rig.js"; // prettier-ignore

// Speeds (m/s): the Worlds lane's walk and run.
export const WALK_SPEED = 1.9;
export const RUN_SPEED = 4.6;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const mix = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const frac = (x) => x - Math.floor(x);
const TAU = Math.PI * 2;
const D = Math.PI / 180;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; // prettier-ignore
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

// How much of a run (0 walking, 1 running) at a speed.
export function runAmount(v) {
  return clamp((v - WALK_SPEED) / (RUN_SPEED - WALK_SPEED), 0, 1);
}

// The stride (meters per full cycle: two steps) at a speed.
export function strideAt(v) {
  const run = runAmount(v);
  const walk = 1.4 * clamp(Math.sqrt(Math.max(v, 0) / WALK_SPEED), 0.45, 1);
  return mix(walk, 3.0, run);
}

// The gait's shape at a speed: the share of the cycle a foot is planted
// (duty), the foot's pitch as it lands and leaves, where in the stance the
// heel and forefoot rolls happen, the swing's lift and kick, and how far
// ahead of the hips the stance is centered.
function gaitShape(v) {
  const run = runAmount(v);
  return {
    run,
    stride: strideAt(v),
    duty: mix(0.58, 0.27, run),
    land: mix(-17, -4, run), // degrees; toes up at heel strike
    leave: mix(40, 34, run), // heel up at toe off
    heelRoll: mix(0.15, 0.08, run),
    flatEnd: mix(0.5, 0.3, run),
    lift: mix(0.07, 0.2, run),
    ahead: mix(-0.1, 0.02, run),
    width: mix(0.1, 0.075, run), // the feet's distance from the middle
    toeOut: mix(7, 4, run),
  };
}

// The foot's rotation in the character's space for a pitch (degrees,
// positive heel up) on a side (1 left, -1 right).
function footRot(pitch, side, g) {
  return mul(rotY(side * g.toeOut), rotX(pitch));
}

// The planted foot: its ankle and pitch at stance fraction u (0 heel
// strike, 1 toe off), `flat` being where the ankle is while the foot is
// flat (it moves back at the ground's speed).
function stanceFoot(u, flat, side, g) {
  let pitch = 0;
  let anchor = null;
  if (u < g.heelRoll) {
    pitch = g.land * (1 - sstep(0, g.heelRoll, u));
    anchor = BODY.heel;
  } else if (u > g.flatEnd) {
    const t = (u - g.flatEnd) / (1 - g.flatEnd);
    pitch = g.leave * Math.pow(t, 1.35);
    anchor = BODY.ball;
  }
  if (!anchor) return { ankle: flat, pitch, toes: 0 };
  // The contact (heel or ball) stays where it would be under a flat foot.
  const R0 = footRot(0, side, g);
  const R = footRot(pitch, side, g);
  const contact = add(flat, apply(R0, anchor));
  return { ankle: sub(contact, apply(R, anchor)), pitch, toes: pitch > 0 ? -pitch : 0 };
}

// One foot at cycle fraction f (0 = its heel strike).
function footAt(f, side, v, g) {
  const S = g.duty * g.stride; // how far the body travels while it is planted
  const z0 = S / 2 + g.ahead; // the flat ankle's place at heel strike
  const x = side * g.width;
  const flatAt = (u) => [x, BODY.ankle, z0 - u * S];
  if (f < g.duty) {
    const u = f / g.duty;
    return { ...stanceFoot(u, flatAt(u), side, g), planted: true, u };
  }
  // Swinging: from toe off to the next heel strike. In the ground's frame
  // it starts and stops at rest; the body moves D meters meanwhile.
  const u = (f - g.duty) / (1 - g.duty);
  const a = stanceFoot(1, flatAt(1), side, g);
  const b = stanceFoot(0, flatAt(0), side, g);
  const Dm = (1 - g.duty) * g.stride;
  const e = u - Math.sin(TAU * u) / TAU;
  const z = a.ankle[2] + (b.ankle[2] - a.ankle[2] + Dm) * e - Dm * u;
  const up = Math.sin(Math.PI * Math.pow(u, 0.8));
  const y = mix(a.ankle[1], b.ankle[1], e) + g.lift * up;
  // Running, the heel folds up under the hips on the way through (the
  // knee leads), then the leg reaches out to land.
  const tuck = g.run * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.8)), 1.6) * 0.85;
  const pitch = mix(a.pitch, b.pitch, sstep(0.05, 0.6, u)) - 8 * up * (1 - g.run) + 30 * tuck;
  const toes = a.toes * (1 - sstep(0, 0.35, u));
  return { ankle: [x, mix(y, 0.36, tuck), mix(z, -0.2, tuck)], pitch, toes, planted: false, u };
}

// Two-bone reach: from hip joint `h` to ankle `a`, the knee bending toward
// `fwd`. Returns the thigh's and shin's rotations (character space).
function legIK(h, a, fwd) {
  const L1 = BODY.thigh;
  const L2 = BODY.shin;
  let d = sub(a, h);
  let dist = Math.hypot(d[0], d[1], d[2]);
  const dn = scale(d, 1 / (dist || 1));
  dist = clamp(dist, Math.abs(L1 - L2) + 1e-4, L1 + L2);
  const cosA = clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1);
  const alpha = Math.acos(cosA);
  // The knee's plane holds the leg's line and the forward direction.
  let f = sub(fwd, scale(dn, dot(fwd, dn)));
  if (Math.hypot(f[0], f[1], f[2]) < 1e-6) f = [0, 0, 1];
  f = norm(f);
  const thighDir = add(scale(dn, Math.cos(alpha)), scale(f, Math.sin(alpha)));
  const knee = add(h, scale(thighDir, L1));
  const endP = add(h, scale(dn, dist));
  const shinDir = norm(sub(endP, knee));
  const X = norm(cross(scale(dn, -1), f));
  const frame = (dir) => {
    const Y = scale(dir, -1);
    const Z = cross(X, Y);
    return fromColumns(X, Y, Z);
  };
  return { thigh: frame(thighDir), shin: frame(shinDir) };
}

// How high the hips may ride so a leg still reaches its ankle target with
// the knee bent at least `knee` degrees.
function reachHeight(hipXZ, ankle, knee) {
  const L1 = BODY.thigh;
  const L2 = BODY.shin;
  const r = Math.sqrt(L1 * L1 + L2 * L2 + 2 * L1 * L2 * Math.cos(knee * D));
  const dx = hipXZ[0] - ankle[0];
  const dz = hipXZ[1] - ankle[2];
  return ankle[1] + Math.sqrt(Math.max(0.01, r * r - dx * dx - dz * dz));
}

const smin = (a, b, k) => {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return b + (a - b) * h - k * h * (1 - h);
};

// A glance round now and then while standing: degrees of head turn.
function glance(t) {
  const cycle = 7.5;
  const n = Math.floor(t / cycle);
  const x = t - n * cycle;
  const dir = n % 2 ? -1 : 1;
  const amt = n % 3 === 2 ? 14 : 30;
  return dir * amt * sstep(3.2, 3.9, x) * (1 - sstep(5.4, 6.2, x));
}

// The pose at gait state { speed, phase } and time t (for the idle
// motion). Returns { joints: { name: [x, y, z] degrees }, bob, hips }:
// bob is the hips' rise from standing (meters) and hips their [x, 0, z]
// shift.
export function pose(state, t = 0) {
  const v = Math.max(0, state.speed || 0);
  const g = gaitShape(v);
  const run = g.run;
  const w = sstep(0, 0.55, v); // how much the gait shows (0 standing)
  const idle = 1 - w;
  // Each foot's cycle fraction: the left heel strikes at phase pi/2.
  const fL = frac(state.phase / TAU - 0.25);
  const fR = frac(fL + 0.5);

  // ---- Feet ----
  // Standing: the feet a little apart, one slightly ahead; the weight
  // shifts from one to the other every few seconds.
  const shift = Math.sin((t * TAU) / 9.5) * idle;
  const stand = (side) => ({ ankle: [side * (BODY.hipX + 0.012), BODY.ankle, 0], pitch: 0, toes: 0, planted: true }); // prettier-ignore
  const blend = (a, b) => ({
    ankle: [mix(a.ankle[0], b.ankle[0], w), mix(a.ankle[1], b.ankle[1], w), mix(a.ankle[2], b.ankle[2], w)], // prettier-ignore
    pitch: mix(a.pitch, b.pitch, w),
    toes: mix(a.toes, b.toes, w),
    planted: w < 0.5 ? a.planted : b.planted,
    u: b.u,
  });
  const gl = footAt(fL, 1, v, g);
  const gr = footAt(fR, -1, v, g);
  const feet = { L: blend(stand(1), gl), R: blend(stand(-1), gr) };

  // ---- Hips ----
  const yaw = w * mix(5, 9, run) * -Math.cos(TAU * fL); // the left side forward as the left leg reaches
  const roll = w * (1 - run) * 2.5 * Math.sin(TAU * (fL - 0.05)) - idle * 1.6 * shift;
  const pitch = w * mix(0.5, 6, run); // tipped forward a little, more running
  const sway = w * (1 - run) * 0.018 * Math.cos(TAU * (fL - g.duty / 2)) + idle * 0.022 * shift;
  const Rh = mul(rotY(yaw), mul(rotZ(roll), rotX(pitch)));
  // As high as the legs allow: a walk dips as the legs spread; a run
  // sinks into each landing and floats between.
  const hipAt = (side) => apply(Rh, [side * BODY.hipX, 0, 0]);
  const hl = hipAt(1);
  const hr = hipAt(-1);
  const knee = w * mix(2, 16, run);
  let H = BODY.hip - w * mix(0.012, 0.035, run);
  if (run > 0) {
    // Running: highest in the flight between steps.
    const fly = Math.cos(TAU * 2 * (fL - g.duty / 2 - 0.25));
    H += w * run * 0.035 * fly;
  }
  // A swinging foot limits the hips only as it leaves and lands.
  const free = (ft) => (ft.planted ? 0 : 0.6 * sstep(0, 0.2, ft.u) * sstep(1, 0.8, ft.u));
  const rl = reachHeight([sway + hl[0], hl[2]], feet.L.ankle, knee) - hl[1] + free(feet.L);
  const rr = reachHeight([sway + hr[0], hr[2]], feet.R.ankle, knee) - hr[1] + free(feet.R);
  H = smin(H, smin(rl, rr, 0.02), 0.02);
  if (idle > 0.999) H = Math.min(BODY.hip, Math.min(rl, rr)); // exact when standing still

  // ---- Legs ----
  const hipsP = [sway, H, 0];
  const joints = { hips: toEuler(Rh) };
  for (const [side, key] of [
    [1, "L"],
    [-1, "R"],
  ]) {
    const ft = feet[key];
    const hj = add(hipsP, apply(Rh, [side * BODY.hipX, 0, 0]));
    const fwd = apply(rotY(side * g.toeOut * 0.6 * w), [0, 0, 1]);
    const { thigh, shin } = legIK(hj, ft.ankle, fwd);
    const Rf = footRot(ft.pitch, side, g);
    joints[`thigh${key}`] = toEuler(mul(tr(Rh), thigh));
    joints[`shin${key}`] = toEuler(mul(tr(thigh), shin));
    joints[`foot${key}`] = toEuler(mul(tr(shin), Rf));
    joints[`toes${key}`] = [ft.toes, 0, 0];
  }

  // ---- Spine, neck and head ----
  // World yaws: the hips turn with the forward leg, the shoulders against
  // them; the head faces ahead (and glances round when standing).
  const breath = Math.sin((t * TAU) / 4.2);
  const lean = w * mix(3, 9, run);
  const chestYaw = -yaw * mix(0.9, 1.1, run) + idle * glance(t) * 0.12;
  const absYaw = yaw * 0.35 + chestYaw * 0.4;
  const Ra = mul(rotY(absYaw), mul(rotZ(-roll * 0.5), rotX(pitch + lean * 0.5)));
  const Rc = mul(rotY(chestYaw), mul(rotZ(-roll * 0.2), rotX(pitch + lean - idle * 0.8 * breath)));
  joints.torso = toEuler(mul(tr(Rh), Ra));
  joints.chest = toEuler(mul(tr(Ra), Rc));
  const look = idle * glance(t);
  // The neck carries some of the turn and the lean back; the head the rest,
  // so it stays level and steady.
  const bounce = w * run * 2 * Math.cos(TAU * 2 * (fL - 0.1));
  const Rn = mul(rotY(look * 0.35 + chestYaw * 0.4), rotX(lean * 0.3 + 3));
  const Rhd = mul(rotY(look), rotX(w * 2 + bounce + idle * 1.2 * Math.sin(t * 0.7)));
  joints.neck = toEuler(mul(tr(Rc), Rn));
  joints.head = toEuler(mul(tr(Rn), Rhd));

  // ---- Arms ----
  // Each arm swings opposite its own leg (back as that leg reaches
  // forward), the elbow bending more on the forward swing and when
  // running; the fingers curl, into loose fists when running.
  const armA = w * mix(24, 42, run);
  for (const [side, key, f] of [
    [1, "L", fL],
    [-1, "R", fR],
  ]) {
    const swing = Math.cos(TAU * (f - 0.04)); // 1 = fully back
    const fwd = Math.max(0, -swing);
    const x = armA * swing - run * w * 10 + idle * 1.5 * breath;
    const abd =
      side * (mix(6, 5, w) + run * w * 6 + idle * 0.8 * breath + w * 2 * Math.max(0, swing));
    joints[`arm${key}`] = [x, side * run * w * -8, abd];
    const elbow = mix(10, 20, w) + w * (1 - run) * 16 * fwd + run * w * (70 + 12 * fwd);
    joints[`fore${key}`] = [-elbow, side * run * w * 10, 0];
    joints[`hand${key}`] = [-4 - run * w * 6, 0, side * (4 + run * w * 6)];
    const curl = mix(22, 26, w) + run * w * 50;
    joints[`fingers${key}`] = [0, 0, -side * curl];
  }

  return { joints, bob: H - BODY.hip, hips: [sway, 0, 0], feet };
}

// Advances the gait: the phase turns once per stride.
export function stepGait(state, speed, dt) {
  state.speed += (speed - state.speed) * (1 - Math.exp(-dt * 10));
  const stride = strideAt(state.speed);
  state.phase = (state.phase + ((state.speed * dt) / stride) * TAU) % TAU;
  if (state.speed < 0.05) state.phase *= Math.exp(-dt * 3);
  return state;
}

export { I3, euler };

// Tuning the realistic character's gait (docs/WORLDS.md, "Tuning the gait"):
// the character lab's controls, and the settings Worlds reads from
// assets/worlds/character/tuning.json.
//
// The walk and the run are baked into the clips, shaped to measured human
// gait (tools/wd-character.py). Each setting here is a change to that baked
// motion, applied to the bones every frame after the clips play, so the
// defaults are the measured gait exactly and the tuner then does nothing:
//
//   - legs (walk, run): each joint's swing about the middle of its range,
//     times `scale`, plus `offset` degrees (hip, knee, ankle);
//   - arms: the shoulder's `center` and `swing` (degrees, the swing from
//     the middle to the front), the elbow's `center` bend and `swing`, and
//     `armOut`, how far the arms hang out from the body;
//   - `lean` (the torso, degrees forward) and `head` (degrees, chin down);
//   - the pelvis's `bob` (up and down) and `sway` (side to side), times the
//     baked motion; `stride`, times the baked stride (the clip plays at
//     speed / stride, so the cadence follows: steps a minute = 120 * speed /
//     stride);
//   - standing: the same arm and torso settings, and hip and knee offsets.
//
// After the limbs move, the body is moved up or down so the lowest foot is
// where it was in the baked pose: the feet stay on the ground.
//
// Every part turns as one solid piece (bones only; nothing bends).

import * as pc from "../pc.js";

export const TUNING_FORMAT = "splashery-gait";
export const TUNING_VERSION = 1;

const DEG = 180 / Math.PI;

// The settings, per gait: [path, label, unit, min, max, step]. The lab
// builds its controls from these; clamp() keeps a loaded file in range.
export const TUNING_FIELDS = {
  stand: [
    ["lean", "Torso lean", "°", -10, 20, 0.5],
    ["head", "Head tilt", "°", -20, 25, 0.5],
    ["shoulder.center", "Shoulder", "°", -30, 40, 0.5],
    ["elbow.center", "Elbow bend", "°", 0, 90, 0.5],
    ["armOut", "Arms out from the body", "°", 0, 30, 0.5],
    ["hip.offset", "Hip", "°", -20, 25, 0.5],
    ["knee.offset", "Knee bend", "°", 0, 40, 0.5],
  ],
  walk: null,
  run: null,
};
const MOVING = [
  ["hip.scale", "Hip swing", "×", 0.4, 1.6, 0.01],
  ["hip.offset", "Hip offset", "°", -15, 15, 0.5],
  ["knee.scale", "Knee swing", "×", 0.4, 1.6, 0.01],
  ["knee.offset", "Knee offset", "°", -15, 25, 0.5],
  ["ankle.scale", "Ankle swing", "×", 0.4, 1.6, 0.01],
  ["ankle.offset", "Ankle offset", "°", -15, 15, 0.5],
  ["shoulder.center", "Shoulder middle", "°", -45, 30, 0.5],
  ["shoulder.swing", "Shoulder swing", "°", 0, 60, 0.5],
  ["elbow.center", "Elbow bend", "°", 0, 130, 0.5],
  ["elbow.swing", "Elbow swing", "°", 0, 45, 0.5],
  ["armOut", "Arms out from the body", "°", 0, 30, 0.5],
  ["lean", "Torso lean", "°", -10, 25, 0.5],
  ["head", "Head tilt", "°", -20, 25, 0.5],
  ["bob", "Bob (up and down)", "×", 0, 2.5, 0.01],
  ["sway", "Sway (side to side)", "×", 0, 2.5, 0.01],
  ["stride", "Stride length", "×", 0.6, 1.5, 0.01],
];
TUNING_FIELDS.walk = MOVING;
TUNING_FIELDS.run = MOVING;

export const LOOK_FIELDS = [
  ["height", "Height", "m", 1.5, 2.0, 0.01],
  ["shirt", "Shirt", "color"],
  ["pants", "Jeans tint", "color"],
  ["shoes", "Shoes tint", "color"],
];

const get = (o, path) => path.split(".").reduce((v, k) => v?.[k], o);
const put = (o, path, v) => {
  const ks = path.split(".");
  let t = o;
  for (const k of ks.slice(0, -1)) t = t[k] ??= {};
  t[ks.at(-1)] = v;
};

// The measured gait as settings (the baked clips' own values, from
// human.json's `gait.base`).
export function defaultTuning(meta, look = {}) {
  const b = meta.gait?.base || {};
  const leg = () => ({ scale: 1, offset: 0 });
  const arms = (g, { lean = 0, shoulder = [0, 0], elbow = [0, 0], abduct = 0 } = {}) => ({
    lean,
    head: 0,
    shoulder: { center: shoulder[0], swing: shoulder[1] },
    elbow: { center: elbow[0], swing: elbow[1] },
    armOut: abduct,
    ...(g === "stand"
      ? { hip: { offset: 0 }, knee: { offset: 0 } }
      : { hip: leg(), knee: leg(), ankle: leg(), bob: 1, sway: 1, stride: 1 }),
  });
  return {
    format: TUNING_FORMAT,
    version: TUNING_VERSION,
    look: { height: look.height ?? 1.74, shirt: look.shirt ?? "#e0533d", pants: "#ffffff", shoes: "#ffffff" }, // prettier-ignore
    stand: arms("stand", b.idle),
    walk: arms("walk", b.walk),
    run: arms("run", b.run),
  };
}

// A loaded file (any version-1 subset) over the defaults, each number
// clamped to its control's range. Unknown keys are dropped.
export function normalizeTuning(json, meta, look) {
  const out = defaultTuning(meta, look);
  if (!json || typeof json !== "object") return out;
  for (const g of ["stand", "walk", "run"])
    for (const [path, , , lo, hi] of TUNING_FIELDS[g]) {
      const v = Number(get(json[g], path));
      if (get(json[g], path) !== undefined && Number.isFinite(v)) put(out[g], path, Math.min(hi, Math.max(lo, v))); // prettier-ignore
    }
  for (const [key, , unit, lo, hi] of LOOK_FIELDS) {
    const v = json.look?.[key];
    if (unit === "color" && typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v)) out.look[key] = v.toLowerCase(); // prettier-ignore
    else if (unit !== "color" && Number.isFinite(Number(v))) out.look[key] = Math.min(hi, Math.max(lo, Number(v))); // prettier-ignore
  }
  return out;
}

// True when the settings are the measured gait (nothing to apply).
export function isDefaultTuning(t, meta) {
  const d = defaultTuning(meta);
  return ["stand", "walk", "run"].every((g) => TUNING_FIELDS[g].every(([p]) => Math.abs(get(t[g], p) - get(d[g], p)) < 1e-6)); // prettier-ignore
}

// The settings as the small file the lab exports (and Worlds reads).
export function tuningJSON(t) {
  return JSON.stringify(t, null, 2) + "\n";
}

const lerp = (a, b, w) => a + (b - a) * w;

export class GaitTuner {
  // model: loadHuman's model; meta: human.json; ref: the lab's
  // gait-reference.json (for the middle of each joint's range).
  constructor(model, meta, ref, tuning) {
    this.model = model;
    this.meta = meta;
    this.tilt = meta.gait?.tilt || { walk: 10, run: 15 };
    this.foot0 = meta.gait?.foot0 || 0;
    this.base = defaultTuning(meta);
    this.mid = {};
    for (const g of ["walk", "run"]) {
      this.mid[g] = {};
      for (const j of ["hip", "knee", "ankle"]) {
        const m = ref?.[g]?.joints?.[j]?.mean || [0];
        this.mid[g][j] = (Math.max(...m) + Math.min(...m)) / 2;
      }
    }
    const names = ["pelvis", "spine_01", "spine_02", "spine_03", "neck_01", "head"];
    for (const s of ["l", "r"]) names.push(...["thigh", "calf", "foot", "ball", "upperarm", "lowerarm", "hand"].map((b) => `${b}_${s}`)); // prettier-ignore
    this.b = {};
    for (const n of names) this.b[n] = model.findByName(n);
    this.mean = null;
    this.set(tuning);
    this.v = { X: new pc.Vec3(), U: new pc.Vec3(), F: new pc.Vec3(), d: new pc.Vec3(), t: new pc.Vec3(), a: new pc.Vec3() }; // prettier-ignore
    this.q = new pc.Quat();
  }

  set(tuning) {
    this.t = tuning || this.base;
    this.idle = isDefaultTuning(this.t, this.meta);
  }

  // How much longer the stride is than the baked one at a speed (the clips'
  // rate is speed / stride): the stride setting times the hip swing.
  strideScale(speed) {
    if (this.idle) return 1;
    const w = this.blend(speed);
    const f = (g) => this.t[g].stride * this.t[g].hip.scale;
    return lerp(f("walk"), f("run"), w);
  }

  blend(speed) {
    const { walkSpeed: a, runSpeed: b } = this.meta;
    return Math.max(0, Math.min(1, (speed - a) / (b - a)));
  }

  // One frame, after the clips have played: `standing` when the idle plays,
  // else the walk-to-run blend at `speed`. dt: the frame's seconds.
  apply(standing, speed, dt) {
    if (this.idle) return;
    const { X, U, F, d, a } = this.v;
    const m = this.model;
    X.copy(m.right);
    U.copy(m.up);
    F.copy(m.forward).mulScalar(-1);
    const B = this.b;
    const dir = (e, out = d) => e.getWorldTransform().getY(out).normalize();
    const sag = (v) => Math.atan2(v.dot(F), -v.dot(U)) * DEG;
    const w = standing ? 0 : this.blend(speed);
    // The settings and the baked values at this blend.
    const pick = (src, path) => (standing ? get(src.stand, path) : lerp(get(src.walk, path), get(src.run, path), w)); // prettier-ignore
    const T = (p) => pick(this.t, p);
    const B0 = (p) => pick(this.base, p);
    const tilt = standing ? this.tilt.walk : lerp(this.tilt.walk, this.tilt.run, w);
    const mid = (j) => lerp(this.mid.walk[j], this.mid.run[j], w);

    // The baked pose, measured before anything moves.
    const spine = ["spine_01", "spine_02", "spine_03", "neck_01"].map((n) => sag(dir(B[n])));
    const head = sag(dir(B.head));
    const up = dir(B.spine_03, a);
    const trunk = Math.atan2(up.dot(F), up.dot(U)) * DEG;
    const side = {};
    for (const s of ["l", "r"]) {
      const th = sag(dir(B[`thigh_${s}`]));
      const sh = sag(dir(B[`calf_${s}`]));
      const ft = sag(dir(B[`foot_${s}`]));
      const ua = sag(dir(B[`upperarm_${s}`]));
      const fa = sag(dir(B[`lowerarm_${s}`]));
      side[s] = { hip: th + tilt, knee: th - sh, ankle: ft - sh - this.foot0, shoulder: ua - trunk, elbow: fa - ua }; // prettier-ignore
    }
    const lowest = () => Math.min(...["foot_l", "foot_r", "ball_l", "ball_r"].map((n) => B[n].getPosition().dot(U))); // prettier-ignore
    const ground = lowest();
    const pel = B.pelvis.getPosition().clone().sub(m.getPosition());
    const py = pel.dot(U);
    const px = pel.dot(X);
    // The pelvis's mean height and side position, over about a second and a
    // half (the bob and sway scale about them).
    const k = this.mean ? Math.min(1, dt / 1.5) : 1;
    this.mean ??= { y: py, x: px };
    this.mean.y += (py - this.mean.y) * k;
    this.mean.x += (px - this.mean.x) * k;

    // The torso and head.
    const dLean = T("lean") - B0("lean");
    ["spine_01", "spine_02", "spine_03", "neck_01"].forEach((n, i) =>
      this.aim(B[n], spine[i] - dLean),
    );
    this.aim(B.head, head - T("head"));
    const trunkNow = trunk + dLean;

    // The legs.
    for (const s of ["l", "r"]) {
      const j = side[s];
      const want = (name) => (standing ? j[name] + T(`${name}.offset`) : mid(name) + (j[name] - mid(name)) * T(`${name}.scale`) + T(`${name}.offset`)); // prettier-ignore
      const hip = want("hip");
      const knee = Math.max(-3, want("knee"));
      const ankle = standing ? j.ankle : want("ankle");
      const thigh = hip - tilt;
      const shank = thigh - knee;
      this.aim(B[`thigh_${s}`], thigh);
      this.aim(B[`calf_${s}`], shank);
      this.aim(B[`foot_${s}`], shank + this.foot0 + ankle);
    }

    // The arms: the baked swing's phase (k) from the shoulder, then the new
    // middle and swing.
    for (const s of ["l", "r"]) {
      const j = side[s];
      const h0 = B0("shoulder.swing");
      const kk = h0 > 0.5 ? Math.max(-1.5, Math.min(1.5, (j.shoulder - B0("shoulder.center")) / h0)) : 0; // prettier-ignore
      const sh = T("shoulder.center") + T("shoulder.swing") * kk + trunkNow;
      const el = T("elbow.center") + T("elbow.swing") * kk;
      const out = Math.sin(T("armOut") / DEG) * (s === "l" ? 1 : -1);
      this.aim(B[`upperarm_${s}`], sh, out);
      this.aim(B[`lowerarm_${s}`], sh + el, out * 0.4);
      this.aim(B[`hand_${s}`], sh + el + 4, out * 0.4);
    }

    // The pelvis: the lowest foot back where it was, then the bob and sway.
    let dy = ground - lowest();
    let dx = 0;
    if (!standing) {
      dy += (py - this.mean.y) * (T("bob") - 1);
      dx = (px - this.mean.x) * (T("sway") - 1);
    }
    const p = B.pelvis.getPosition().clone();
    p.add(U.clone().mulScalar(dy)).add(X.clone().mulScalar(dx));
    B.pelvis.setPosition(p);
  }

  // Turns a bone (world rotation) so it points phi degrees from straight
  // down in the side view, keeping (or setting) its sideways part.
  aim(e, phi, lateral = null) {
    const { X, U, F, d, t } = this.v;
    const q = e.getRotation();
    e.getWorldTransform().getY(d).normalize();
    const x = lateral ?? d.dot(X);
    const r = Math.sqrt(Math.max(0, 1 - x * x));
    const p = phi / DEG;
    t.copy(X).mulScalar(x);
    t.add(F.clone().mulScalar(Math.sin(p) * r)).add(U.clone().mulScalar(-Math.cos(p) * r));
    t.normalize();
    const c = Math.max(-1, Math.min(1, d.dot(t)));
    if (c > 0.999999) return;
    const axis = new pc.Vec3().cross(d, t);
    if (axis.lengthSq() < 1e-12) return;
    axis.normalize();
    this.q.setFromAxisAngle(axis, Math.acos(c) * DEG);
    e.setRotation(this.q.clone().mul(q));
  }
}

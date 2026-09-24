// Motion on the CPU side: whole-toy moves (bounce, spin, wobble, float and a
// tap-to-hop), a kit toy's own behaviours clock, its controls (eased
// toggles and sliders) and its rigid parts. Produces uniforms for the effect
// modifier (uSpBody*, uSpKit*, uSpParts). Pure JavaScript.

import { quatAxisAngle, quatMul, quatEuler, rgb } from "./kit.js";
import { fxFrame, FX_SLOTS } from "./rig-fx.js";

export const MOVES = [
  { id: "still", label: "Still" },
  { id: "bounce", label: "Bounce" },
  { id: "spin", label: "Spin" },
  { id: "wobble", label: "Wobble" },
  { id: "float", label: "Float" },
];
export const MOVE_IDS = MOVES.map((m) => m.id);

export const DEFAULT_MOTION = Object.freeze({
  alive: true, // the toy's own behaviours (flames flicker, hearts beat)
  move: "still",
  speed: 0.5,
  controls: {},
});

const IDENTITY = [0, 0, 0, 1];
const NO_FX = new Float32Array(FX_SLOTS * 36);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Bounce height and squash for a hop that started `t` seconds ago with a
// peak of 1 (in units of the hop height). Returns null when it has settled.
function hopAt(t, e = 0.55, period = 0.62) {
  // Flight k lasts period * e^k (heights fall by e^2 per bounce).
  let start = 0;
  let dur = period;
  let amp = 1;
  for (let k = 0; k < 8; k++) {
    if (t < start + dur) {
      const f = (t - start) / dur;
      const h = amp * 4 * f * (1 - f);
      const edge = Math.min(f, 1 - f) * dur;
      const squash = amp * (0.22 * Math.exp(-((edge / 0.05) ** 2)) - 0.06 * Math.sin(Math.PI * f));
      return { h, squash };
    }
    start += dur;
    dur *= e;
    amp *= e * e;
    if (amp < 0.01) break;
  }
  return null;
}

export class MotionDriver {
  constructor() {
    this.recipe = null;
    this.ctx = null;
    this.state = {}; // eased control values
    this.targets = {};
    this.hopStart = -100;
    this.tap = null;
    this.kitClock = { t: 0, last: null, rate: 1 };
    this.moveClock = { t: 0, last: null, rate: 1 };
    this.partsData = new Float32Array(48 * 4);
    this.tintData = new Float32Array(16 * 4);
    this.addon = null; // { parts, data } of a rig's kit-built add-on
    this.addonU = null;
    this.out = null;
  }

  // Attaches a kit toy (recipe + build context) or clears it.
  setToy(recipe, ctx, controls = {}) {
    this.recipe = recipe || null;
    this.ctx = ctx || null;
    this.state = {};
    this.targets = {};
    for (const c of recipe?.controls || []) {
      const v = controls[c.key] ?? c.default ?? 0;
      this.state[c.key] = v;
      this.targets[c.key] = v;
    }
    this.hopStart = -100;
    this.tap = null;
    this.addon = null;
    this.addonU = null;
  }

  // A rig's add-on (a small kit-built splat cloud with its own parts).
  setAddon(ctx) {
    this.addon = ctx ? { parts: ctx.parts, data: new Float32Array(48 * 4) } : null;
    this.addonU = null;
  }

  controlDef(key) {
    return this.recipe?.controls?.find((c) => c.key === key) || null;
  }

  // Sets a control's target; toggles ease there over their `ease` seconds.
  setControl(key, value, { snap = false } = {}) {
    const def = this.controlDef(key);
    if (!def) return;
    this.targets[key] = value;
    if (snap || def.type !== "toggle") this.state[key] = value;
  }

  // The tap action: toggles the recipe's action control, or hops. `point`
  // is where the tap landed, in the recipe's own coordinates (null for the
  // Play button and the keyboard). A recipe's `action.at(point, c)` may pick
  // another control to fire and an item: it returns a control key, or
  // { key, pick }, or nothing for the usual action. drive() sees the last
  // tap as info.tap = { point, key, pick, time, n }.
  act(time, point = null) {
    const a = this.recipe?.action;
    let key = a?.key;
    let pick = null;
    if (a?.at && point) {
      const r = a.at(point, this.state);
      if (typeof r === "string") key = r;
      else if (r) {
        key = r.key ?? key;
        pick = r.pick ?? null;
      }
    }
    this.tap = { point, key: key || "hop", pick, time, n: (this.tap?.n ?? 0) + 1 };
    if (key && this.controlDef(key)) {
      if (this.controlDef(key).type === "pulse") {
        this.state[key] = 1;
        this.targets[key] = 0;
        return { key, value: 1, pick, point };
      }
      const cur = this.targets[key] ?? 0;
      this.setControl(key, cur > 0.5 ? 0 : 1);
      return { key, value: this.targets[key], pick, point };
    }
    this.hop(time);
    return { key: "hop", value: 1, pick, point };
  }

  hop(time) {
    this.hopStart = time;
  }

  // A rig's `alive` may depend on its controls (a lantern flickers only while lit).
  hasBehaviours() {
    const a = this.recipe?.alive;
    return typeof a === "function" ? !!a(this.state) : !!a;
  }

  // True while something moves by itself.
  isAnimating(motion, time) {
    if (motion.move !== "still") return true;
    if (hopAt(time - this.hopStart)) return true;
    if (motion.alive && this.hasBehaviours()) return true;
    for (const k in this.targets) if (Math.abs(this.targets[k] - this.state[k]) > 1e-3) return true;
    return false;
  }

  // Advances a clock whose rate can change without jumping.
  tick(clock, time, rate, running) {
    if (clock.last === null || time < clock.last || time - clock.last > 1) clock.last = time;
    if (running) clock.t += (time - clock.last) * rate;
    clock.last = time;
    return clock.t;
  }

  // ctx: { time, dt, motion, info: { center, half, radius }, cameraPos,
  // reducedMotion }. Returns the uniforms.
  compute({ time, dt, motion, info, cameraPos }) {
    const speed = clamp(motion.speed ?? 0.5, 0, 1);
    const rate = 0.25 + 1.5 * speed;
    const R = info.radius;
    const F = info.half[1];
    const u = {};

    // Controls ease towards their targets.
    for (const k in this.targets) {
      const def = this.controlDef(k);
      const goal = this.targets[k];
      const cur = this.state[k] ?? goal;
      if (def?.type === "toggle" || def?.type === "pulse") {
        const step = dt / Math.max(0.05, def.ease ?? 0.8);
        this.state[k] = goal > cur ? Math.min(goal, cur + step) : Math.max(goal, cur - step);
      } else {
        this.state[k] = cur + (goal - cur) * (1 - Math.exp(-dt / 0.12));
      }
    }

    // Whole-toy move.
    const mt = this.tick(this.moveClock, time, rate, motion.move !== "still");
    let q = IDENTITY;
    let off = [0, 0, 0];
    let squash = 0;
    if (motion.move === "bounce") {
      const period = 0.9;
      const f = (mt / period) % 1;
      const edge = Math.min(f, 1 - f) * period;
      off = [0, 0.42 * R * 4 * f * (1 - f), 0];
      squash = 0.2 * Math.exp(-((edge / 0.05) ** 2)) - 0.07 * Math.sin(Math.PI * f);
    } else if (motion.move === "spin") {
      q = quatAxisAngle([0, 1, 0], mt * 1.6);
    } else if (motion.move === "wobble") {
      squash = 0.08 * Math.sin(mt * 7) * (0.7 + 0.3 * Math.sin(mt * 0.9));
      q = quatEuler(0, 0, 3 * Math.sin(mt * 3.3));
    } else if (motion.move === "float") {
      off = [0, 0.07 * R * Math.sin(mt * 1.5), 0];
      q = quatEuler(4 * Math.sin(mt * 1.1), 0, 3 * Math.sin(mt * 0.8 + 1));
    }
    const hop = hopAt(time - this.hopStart);
    if (hop) {
      off = [off[0], off[1] + hop.h * 0.5 * R, off[2]];
      squash += hop.squash;
    }

    // The kit toy's own frame: behaviours clock, recipe drive, parts.
    const kt = this.tick(this.kitClock, time, rate, motion.alive !== false);
    const drive = { energy: 0, grow: 1, amount: 1, glow: [1, 1, 1, 0], parts: {}, body: null, fx: {}, addon: null }; // prettier-ignore
    if (this.recipe?.drive) this.recipe.drive(kt, this.state, drive, { time, R, tap: this.tap });
    if (drive.body) {
      if (drive.body.quat) q = quatMul(drive.body.quat, q);
      if (drive.body.offset) {
        const o = drive.body.offset;
        off = [off[0] + o[0] * R, off[1] + o[1] * R, off[2] + o[2] * R];
      }
      if (drive.body.squash) squash += drive.body.squash;
    }
    u.uSpBodyQ = q;
    u.uSpBodyT = [off[0], off[1], off[2], squash];
    u.uSpBodyF = [F, 0, 0, 0];

    // Set for every toy (a generated toy without a recipe just has no parts).
    {
      u.uSpKit = [kt, this.ctx ? 1 : 0, 1, clamp(drive.energy, 0, 1)];
      u.uSpKitB = [clamp(drive.grow, 0, 1), F, Math.max(0, drive.amount), 0];
      u.uSpGlowC = drive.glow;
      u.uSpCam = [cameraPos[0], cameraPos[1], cameraPos[2], 0];
      const scale = this.ctx?.transform?.scale ?? 1;
      u["uSpParts[0]"] = packParts(this.partsData, this.ctx?.parts || [], drive.parts, scale);
      if (this.ctx?.rig) {
        const td = this.tintData.fill(0);
        (this.ctx.parts || []).forEach((def, i) => {
          const pd = drive.parts[def.name];
          if (!pd || i >= 16) return;
          if (pd.tint) {
            const c = rgb(pd.tint);
            const g = pd.glow ?? 1;
            td.set([c[0] * g, c[1] * g, c[2] * g], i * 4);
          }
          td[i * 4 + 3] = pd.bright ?? 0;
        });
        u["uSpRigTint[0]"] = td;
        // Always set: uniforms keep the last toy's values otherwise.
        const since = this.tap ? time - this.tap.time : 1e3;
        u["uSpFx[0]"] = this.ctx.fx ? fxFrame(this.ctx.fx, this.recipe, drive.fx, since) : NO_FX;
      }
    }
    // The add-on shares the toy's clock and body; its own parts and glow.
    if (this.addon) {
      const a = drive.addon || {};
      this.addonU = {
        uSpKit: [kt, 1, 1, clamp(a.energy ?? 0, 0, 1)],
        uSpKitB: [clamp(a.grow ?? 0, 0, 1), F, Math.max(0, a.amount ?? 1), 0],
        uSpGlowC: a.glow || [1, 1, 1, 0],
        "uSpParts[0]": packParts(this.addon.data, this.addon.parts, a.parts || {}, 1),
      };
    }
    this.out = drive;
    return u;
  }
}

// Packs part transforms for uSpParts: per part a rotation, the pivot (w =
// scale - 1 about the pivot) and an offset (w = splat visibility).
function packParts(data, parts, driven, scale) {
  for (let i = 0; i < 16; i++) {
    const o = i * 12;
    const def = parts[i];
    const pd = def ? driven[def.name] : null;
    let pq = IDENTITY;
    let po = [0, 0, 0];
    let vis = 1;
    let grow = 0;
    if (pd) {
      if (pd.quat) pq = pd.quat;
      else if (pd.angle) pq = quatAxisAngle(pd.axis || def.axis, pd.angle);
      if (pd.offset) po = [pd.offset[0] * scale, pd.offset[1] * scale, pd.offset[2] * scale];
      if (pd.visible !== undefined) vis = pd.visible;
      if (pd.scale !== undefined) grow = pd.scale - 1;
    }
    const pv = def ? def.pivot : [0, 0, 0];
    data.set(pq, o);
    data.set([pv[0], pv[1], pv[2], grow], o + 4);
    data.set([po[0], po[1], po[2], vis], o + 8);
  }
  return data;
}

// Motion on the CPU side: whole-toy moves (bounce, spin, wobble, float and a
// tap-to-hop), a kit toy's own behaviours clock, its controls (eased
// toggles and sliders) and its rigid parts. Produces uniforms for the effect
// modifier (uSpBody*, uSpKit*, uSpParts). Pure JavaScript.

import { quatAxisAngle, quatMul, quatEuler, rgb } from "./kit.js";
import { fxFrame, FX_SLOTS, FX_VEC4 } from "./rig-fx.js";
import { MAX_LEVERS, MAX_LEVER_GROUPS } from "./effects.js";

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
const NO_FX = new Float32Array(FX_SLOTS * FX_VEC4 * 4);
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
    this.taps = []; // UI r4: taps since the last frame
    this.sound = null; // the site's Sound (Player.setSound), as drive's info.sound
    this.kitClock = { t: 0, last: null, rate: 1 };
    this.moveClock = { t: 0, last: null, rate: 1 };
    this.partsData = new Float32Array(48 * 4);
    this.tintData = new Float32Array(16 * 4);
    this.tokenData = new Float32Array(MAX_TOKENS * 2 * 4);
    this.leverGroupData = new Float32Array(MAX_LEVER_GROUPS * 3 * 4);
    this.leverData = new Float32Array(MAX_LEVERS);
    this.addon = null; // { parts, data } of a rig's kit-built add-on
    this.addonU = null;
    this.out = null;
    this.sliderIn = null; // lane Pages r6: the stage slider's value
    this.figures = []; // lane Pages r6: the scene's figure depths
    // UI r3: a long tap effect pauses on the next tap and resumes on the one
    // after (pausedAt is the clock time it paused at, pausedKey its control).
    this.pausedAt = null;
    this.pausedKey = null;
    // A long effect started since the last frame (its key): a tap before it
    // has been drawn starts it again rather than pausing it unseen.
    this.unseen = null;
    this.handsTokens = null; // lane Physics: [{ index, token }] from Hands-on
    this.handsParts = null; // and { name: { quat, offset } }
    this.handsResort = false;
    this.handsAddon = null; // lane Hands engine B: { name: part } for a rig's add-on
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
    this.taps = []; // UI r4
    this.addon = null;
    this.addonU = null;
    this.pausedAt = null; // UI r3
    this.pausedKey = null;
    this.unseen = null;
    this.sliderIn = null; // lane Pages r6
  }

  // A rig's add-on (a small kit-built splat cloud with its own parts).
  setAddon(ctx) {
    this.addon = ctx ? { parts: ctx.parts, data: new Float32Array(48 * 4) } : null;
    this.addonU = null;
  }

  controlDef(key) {
    return this.recipe?.controls?.find((c) => c.key === key) || null;
  }

  // UI r3: a pulse that runs longer than about two seconds (a tune, a long
  // demo) pauses and resumes; shorter ones restart as before. A recipe can
  // opt a control in or out with `pausable: true | false`.
  isLong(def) {
    if (!def || def.type !== "pulse") return false;
    return def.pausable ?? (def.ease ?? 0.8) > 2;
  }

  // "running", "paused" or null for the action control (or `key`).
  effectState(key = this.recipe?.action?.key) {
    if (!key) return null;
    if (this.pausedKey === key) return "paused";
    return this.isLong(this.controlDef(key)) && (this.state[key] ?? 0) > 0.002 ? "running" : null;
  }

  pause(time, key) {
    this.pausedAt = time;
    this.pausedKey = key;
  }

  // Resumes where it paused: the tap's clock moves on by the time it was
  // paused, so nothing jumps.
  resume(time) {
    if (this.pausedAt === null) return;
    const d = Math.max(0, time - this.pausedAt);
    if (this.tap) this.tap = { ...this.tap, time: this.tap.time + d };
    this.hopStart += d;
    this.pausedAt = null;
    this.pausedKey = null;
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
  // { key, pick }, or nothing for the usual action. It may also return
  // { options, key, pick } to rebuild the toy with those options first
  // (Player.switchTo). drive() sees the last
  // tap as info.tap = { point, key, pick, time, n }.
  act(time, point = null, forced = null) {
    const a = this.recipe?.action;
    // Lane Molecule viewer (engine): what the tap's `action.at` asked to tell
    // the person ({ say: "…" } in its result), for the player to show.
    this.said = null;
    // Lane Live input r2: a recipe may act inside the person's own gesture
    // (a song's audio may start playing only there, on a phone).
    a?.onAct?.(point, this.state);
    let key = a?.key;
    let pick = null;
    if (forced) {
      key = forced.key ?? key;
      pick = forced.pick ?? null;
    } else if (a?.at && point) {
      const r = a.at(point, this.state);
      if (r && typeof r === "object" && r.say) this.said = String(r.say);
      if (typeof r === "string") key = r;
      else if (r?.options) {
        // A tap that switches the toy ({ options, key, pick }): the player
        // rebuilds it with these options and then fires `key` on the new
        // toy, so nothing changes here.
        key = r.key ?? key;
        pick = r.pick ?? null;
        this.tap = { point, key, pick, time, n: (this.tap?.n ?? 0) + 1 };
        return { key, value: 1, pick, point, options: r.options };
      } else if (r) {
        key = r.key ?? key;
        pick = r.pick ?? null;
      }
    }
    // UI r3: a tap on a long effect that is running pauses it, and the next
    // tap resumes it; once it has finished, a tap starts it again.
    const state = forced || this.unseen === key ? null : this.effectState(key);
    if (state === "running") {
      this.pause(time, key);
      return { key, value: 1, pick, point, paused: true, long: true };
    }
    if (state === "paused") {
      this.resume(time);
      return { key, value: 1, pick, point, resumed: true, long: true };
    }
    if (this.pausedKey) this.resume(time); // another control fires: carry on
    this.tap = { point, key: key || "hop", pick, time, n: (this.tap?.n ?? 0) + 1 };
    // UI r4: every tap since the last frame, oldest first (a glissando can
    // fire several keys between two frames); drive() sees them as info.taps.
    this.taps.push(this.tap);
    if (this.taps.length > 64) this.taps.shift();
    if (key && this.controlDef(key)) {
      if (this.controlDef(key).type === "pulse") {
        this.state[key] = 1;
        this.targets[key] = 0;
        const long = this.isLong(this.controlDef(key));
        if (long) this.unseen = key;
        return { key, value: 1, pick, point, long };
      }
      const cur = this.targets[key] ?? 0;
      this.setControl(key, cur > 0.5 ? 0 : 1);
      const toggle = this.controlDef(key).type === "toggle"; // UI r3
      return { key, value: this.targets[key], pick, point, toggle };
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
    if (this.pausedAt !== null) return false; // UI r3: a paused effect holds still
    if (hopAt(time - this.hopStart)) return true;
    if (motion.alive && this.hasBehaviours()) return true;
    // A song playing (lane Pianos) keeps frames coming, even with motion off.
    if (this.recipe?.song?.state?.().playing) return true;
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
  // cameraDistance (to the point it looks at), reducedMotion }. Returns the uniforms.
  compute({ time: clock, dt, motion, info, cameraPos, cameraDistance }) {
    // UI r3: while a tap effect is paused, its controls and clocks hold still
    // at the moment it paused (a whole-toy move from the Toy tab carries on).
    this.unseen = null; // this frame draws it
    const paused = this.pausedAt !== null;
    const time = paused ? this.pausedAt : clock;
    const speed = clamp(motion.speed ?? 0.5, 0, 1);
    const rate = 0.25 + 1.5 * speed;
    const R = info.radius;
    const F = info.half[1];
    const u = {};

    // Controls ease towards their targets.
    for (const k in paused ? {} : this.targets) {
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
    const mt = this.tick(this.moveClock, clock, rate, motion.move !== "still");
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
    const kt = this.tick(this.kitClock, clock, rate, motion.alive !== false && !paused);
    // out.resort: true on a frame asks the player to sort the tokens again
    // where they stand (resortTokens in src/player.js).
    const drive = { energy: 0, grow: 1, amount: 1, glow: [1, 1, 1, 0], parts: {}, body: null, fx: {}, addon: null, tokens: null, cues: [], morph: null, resort: false, levers: null }; // prettier-ignore
    // info.data is whatever the recipe's build left in k.data (which molecule
    // was built, say), for effects that depend on the build. info.sound is the
    // site's Sound (src/sound.js): a toy that plays its own audio checks
    // sound.enabled (the speaker button; embeds keep it off) and plays through
    // sound.audio() and sound.master (the site's limiter).
    // Sound C: info.view is the camera's turn about the toy (radians about
    // the vertical), so a toy can tell when a drag spins it (the spinning top).
    const view = cameraPos && info?.center ? Math.atan2(cameraPos[0] - info.center[0], cameraPos[2] - info.center[2]) : null; // prettier-ignore
    const about = { time, R, tap: this.tap, taps: this.taps, data: this.ctx?.kit?.data, sound: this.sound, view }; // prettier-ignore
    // Lane Pages r6: the slider over the stage (out.slider) as the visitor
    // last set it ({ id, value, n }, n counting the changes), and the scene's
    // figure depths (toy.figures; a drive may hand back a new list in
    // out.figures, which the player keeps in the scene).
    about.slider = this.sliderIn;
    about.figures = this.figures;
    // Lane Hands engine A: Hands-on's shake, finger and wheels (src/physics/fields.js).
    if (this.hands) about.hands = this.hands;
    // Lane Any pose: the world's up in the recipe's frame while Hands-on has
    // the toy turned (absent upright), for effects that fall or pour.
    if (this.poseUp) about.up = this.poseUp;
    if (this.recipe?.drive) this.recipe.drive(kt, this.state, drive, about);
    // Lane Physics: pieces picked up in Hands-on go where the physics puts
    // them (src/physics/hands-on.js), and are sorted again now and then.
    if (this.handsTokens) {
      const list = (drive.tokens ||= []);
      for (const { index, token } of this.handsTokens) list[index] = token;
    }
    if (this.handsParts) Object.assign(drive.parts, this.handsParts);
    if (this.handsAddon)
      drive.addon = { ...drive.addon, parts: { ...drive.addon?.parts, ...this.handsAddon } }; // lane Hands engine B
    if (this.handsResort) {
      drive.resort = true;
      this.handsResort = false;
    }
    this.taps = []; // UI r4
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
      // w: a pressed key's index plus how far down it is (-1: none).
      u.uSpKitB = [clamp(drive.grow, 0, 1), F, Math.max(0, drive.amount), drive.press ?? -1];
      u.uSpGlowC = drive.glow;
      // The four channels of the morph, band and fade kinds (always set).
      const m = drive.morph || [];
      u.uSpMorph = [m[0] ?? 0, m[1] ?? 0, m[2] ?? 0, m[3] ?? 0];
      // w (Science r2): how far the camera is from the point it looks at.
      u.uSpCam = [cameraPos[0], cameraPos[1], cameraPos[2], cameraDistance ?? 0];
      const scale = this.ctx?.transform?.scale ?? 1;
      u["uSpParts[0]"] = packParts(this.partsData, this.ctx?.parts || [], drive.parts, scale);
      // Always set (unset tokens are shown in place): the uniform keeps the
      // last toy's values otherwise.
      u["uSpTokens[0]"] = packTokens(this.tokenData, drive.tokens || [], this.ctx?.transform); // prettier-ignore
      // Levers (lane Pianos): the kit's groups and drive's out.levers
      // (always set, like the tokens).
      u["uSpLever[0]"] = packLeverGroups(this.leverGroupData, this.ctx?.kit?.levers);
      u["uSpLevers[0]"] = packLevers(this.leverData, drive.levers);
      // Volumes (lane Imaging): the cutting plane and density window of
      // the volume kind (always set, like the tokens).
      Object.assign(u, packVolume(drive.volume, this.ctx?.transform));
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
        uSpMorph: [0, 0, 0, 0],
        "uSpParts[0]": packParts(this.addon.data, this.addon.parts, a.parts || {}, 1),
      };
    }
    this.handsFix?.(u); // lane Hands engine A: a kit toy posed whole by Hands-on
    this.out = drive;
    return u;
  }
}

// Packs part transforms for uSpParts: per part a rotation, the pivot (w =
// scale - 1 about the pivot) and an offset (w = splat visibility).
export function packParts(data, parts, driven, scale) {
  for (let i = 0; i < 16; i++) {
    const o = i * 12;
    const def = parts[i];
    const pd = def ? driven[def.name] : null;
    let pq = IDENTITY;
    let po = [0, 0, 0];
    let vis = 1;
    let grow = 0;
    let cull = false;
    if (pd) {
      if (pd.quat) pq = pd.quat;
      else if (pd.angle) pq = quatAxisAngle(pd.axis || def.axis, pd.angle);
      if (pd.offset) po = [pd.offset[0] * scale, pd.offset[1] * scale, pd.offset[2] * scale];
      if (pd.visible !== undefined) vis = pd.visible;
      if (pd.scale !== undefined) grow = pd.scale - 1;
      cull = pd.cull === "below" ? "below" : !!pd.cull;
    }
    const pv = def ? def.pivot : [0, 0, 0];
    data.set(pq, o);
    data.set([pv[0], pv[1], pv[2], grow], o + 4);
    // A culled part hides its splats on the far side of its centre (the
    // kit shader reads visibility -w - 1 from a w of -1 or less); cull:
    // "below" hides those under the level plane through it (lane Night sky,
    // -w - 10 from a w of -10 or less).
    const w = cull === "below" ? -10 - Math.max(0, vis) : cull ? -1 - Math.max(0, vis) : vis;
    data.set([po[0], po[1], po[2], w], o + 8);
  }
  return data;
}

// Lever groups for uSpLever (kind "lever"): per group the pivot and the
// full amount, the axis or direction with mode * 4 + channel, and the glow
// colour with its channel (-1: none). See Kit.lever().
function packLeverGroups(data, groups = []) {
  data.fill(0);
  for (let g = 0; g < MAX_LEVER_GROUPS; g++) {
    const l = groups?.[g];
    const o = g * 12;
    if (!l) {
      data[o + 7] = 12; // mode 3: still
      data[o + 11] = -1;
      continue;
    }
    data.set([l.pivot[0], l.pivot[1], l.pivot[2], l.amount], o);
    data.set([l.dir[0], l.dir[1], l.dir[2], l.mode * 4 + l.channel], o + 4);
    if (l.glow) data.set([l.glow[0], l.glow[1], l.glow[2], l.glowChannel], o + 8);
    else data[o + 11] = -1;
  }
  return data;
}

// Levers' amounts for uSpLevers: out.levers = [a, b, c], three lists of
// amounts 0..1 per lever, each kept to 8 bits and packed in one float.
function packLevers(data, levers) {
  data.fill(0);
  if (!levers) return data;
  const q = (list, i) => {
    const v = list ? list[i] : 0;
    return v > 0 ? Math.min(255, Math.round(v * 255)) : 0;
  };
  for (let i = 0; i < MAX_LEVERS; i++)
    data[i] = q(levers[0], i) + 256 * q(levers[1], i) + 65536 * q(levers[2], i);
  return data;
}

// The volume kind's uniforms (lane Imaging) from out.volume = { normal,
// at, slab, window: [lo, hi], glow: [r, g, b], glowWidth }, in recipe
// coordinates: splats beyond the plane through at * normal (on the side the
// normal points to) are hidden, or, with a slab width, all but those within
// half of it; only densities inside the window show; splats within glowWidth
// of the cut face take the glow. Without out.volume nothing is cut.
function packVolume(v, transform) {
  const c = transform?.center || [0, 0, 0];
  const s = transform?.scale ?? 1;
  const w = v?.window || [0, 1];
  const lo = Number.isFinite(w[0]) ? w[0] : 0;
  const hi = Number.isFinite(w[1]) ? w[1] : 1;
  const len = v?.normal ? Math.hypot(...v.normal) : 0;
  if (!(len > 0) || !Number.isFinite(len))
    return { uSpVol: [1, 0, 0, 0], uSpVolP: [0, 0, lo, hi], uSpVolC: [0, 0, 0, 0] };
  const n = v.normal.map((x) => x / len);
  const off = s * ((v.at ?? 0) - (n[0] * c[0] + n[1] * c[1] + n[2] * c[2]));
  const g = v.glow || [0, 0, 0];
  return {
    uSpVol: [n[0], n[1], n[2], off],
    uSpVolP: [1, Math.max(0, (v.slab ?? 0) * 0.5 * s), lo, hi],
    uSpVolC: [g[0], g[1], g[2], v.glow ? Math.max(0, (v.glowWidth ?? 0.03) * s) : 0],
  };
}

// Game pieces (tokens) the kit shader can move: 32 chess pieces and 16
// spares for promotions. uSpTokens holds two vec4s per token.
export const MAX_TOKENS = 48;

// Packs game pieces for uSpTokens. Each token is { base, offset, quat,
// visible } in recipe coordinates: it turns by quat about its base (the
// point it stands on) and moves by offset. The shader turns about the toy's
// origin, so the offset makes up the difference.
function packTokens(data, tokens, transform) {
  const c = transform?.center || [0, 0, 0];
  const s = transform?.scale ?? 1;
  for (let i = 0; i < MAX_TOKENS; i++) {
    const t = tokens[i];
    const o = i * 8;
    if (!t) {
      data.set([0, 0, 0, 1, 0, 0, 0, 1], o);
      continue;
    }
    const q = t.quat || IDENTITY;
    const b = t.base ? [(t.base[0] - c[0]) * s, (t.base[1] - c[1]) * s, (t.base[2] - c[2]) * s] : [0, 0, 0]; // prettier-ignore
    const rb = quatRotateVec(q, b);
    const d = t.offset || [0, 0, 0];
    data.set([b[0] + d[0] * s - rb[0], b[1] + d[1] * s - rb[1], b[2] + d[2] * s - rb[2], t.visible ?? 1], o); // prettier-ignore
    data.set(q, o + 4);
  }
  return data;
}

function quatRotateVec(q, v) {
  const [x, y, z, w] = q;
  const ix = w * v[0] + y * v[2] - z * v[1];
  const iy = w * v[1] + z * v[0] - x * v[2];
  const iz = w * v[2] + x * v[1] - y * v[0];
  const iw = -x * v[0] - y * v[1] - z * v[2];
  return [
    ix * w + iw * -x + iy * -z - iz * -y,
    iy * w + iw * -y + iz * -x - ix * -z,
    iz * w + iw * -z + ix * -y - iy * -x,
  ];
}

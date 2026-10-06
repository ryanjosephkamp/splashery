// The mesh characters (docs/WORLDS.md, "The mesh character"): lit, skinned
// models with idle, walk and run clips, in place of the splat character.
// They share the world's sun, shadows and grade, and advance with the
// world's own clock, so ?clock=manual clips and tests move them exactly.
//
// - "mesh" (hybrid mode's default; `character.model: "mesh"` or
//   ?character=mesh): a realistic adult, a MakeHuman body (CC0) with motion
//   capture from 100STYLE (CC BY 4.0), built by tools/wd-character.py. High
//   and max load the detailed model, low and mid the lighter one.
// - "kenney" (?character=kenney): the stylized character of the hybrid
//   round, Kenney's "Animated Characters: Protagonists" (CC0), built by
//   tools/world-character.mjs.

import * as pc from "../pc.js";
import { WALK_SPEED, RUN_SPEED, BODY } from "./character.js";
import { SplatBuffer } from "../generators.js";
import { GaitTuner, isDefaultTuning, normalizeTuning } from "./gait-tuner.js";

const BASE = new URL("../../assets/worlds/character/", import.meta.url);

function loadContainer(app, url) {
  return new Promise((resolve, reject) =>
    app.assets.loadFromUrl(url, "container", (err, a) =>
      err ? reject(new Error(err)) : resolve(a),
    ),
  );
}

// sRGB hex to a linear color (the lit materials work in linear light).
function linear(hex) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return new pc.Color(c(n >> 16), c((n >> 8) & 255), c(n & 255));
}

// The level each tier loads: the detailed body on high and max.
export const HUMAN_LEVEL = { low: "low", mid: "low", high: "high", max: "high" };

// The realistic character. Its walk and run are one gait cycle each (a
// second long, starting on the same foot), so they blend in step; the world
// plays them at (speed / stride) cycles a second, so the standing foot stays
// planted. Idle cross-fades in and out when the character starts or stops.
export async function loadHuman(app, { tier = "mid", look = {} } = {}) {
  const meta = await fetch(new URL("human.json", BASE)).then((r) => r.json());
  const level = HUMAN_LEVEL[tier] || "low";
  const asset = await loadContainer(app, new URL(`human-${level}.glb`, BASE).href);
  const res = asset.resource;
  const model = res.instantiateRenderEntity({ castShadows: true, receiveShadows: true });
  // look.height: the person's height in meters (the lab's tuning).
  const s = (look.height || BODY.height) / meta.height;
  model.setLocalScale(s, s, s);
  const tint = { shirt: look.shirt, trousers: look.pants, shoes: look.shoes };
  // Sharper at a glancing angle (the cloth and skin seen side-on).
  const aniso = Math.min(8, app.graphicsDevice.maxAnisotropy || 1);
  for (const r of model.findComponents("render"))
    for (const mi of r.meshInstances) {
      const m = mi.material;
      m.useFog = true;
      // The tee is white cloth: the world's shirt color dyes it. The jeans
      // and shoes take a tint over their textures (white leaves them).
      if (tint[m.name]) m.diffuse = linear(tint[m.name]);
      for (const t of [m.diffuseMap, m.normalMap]) if (t) t.anisotropy = aniso;
      m.update();
    }
  const tracks = {};
  for (const a of res.animations) tracks[a.resource.name] = a.resource;
  const walk = meta.walkSpeed;
  const run = meta.runSpeed;
  model.addComponent("anim", { activate: true });
  const moving = (predicate) => [{ parameterName: "speed", predicate, value: 0.1 }];
  model.anim.loadStateGraph({
    layers: [
      {
        name: "Base",
        states: [
          { name: "START" },
          { name: "Idle", speed: 1, loop: true },
          {
            name: "Move",
            speed: 1,
            loop: true,
            blendTree: {
              type: pc.ANIM_BLEND_1D,
              parameters: ["speed"],
              // The walk and run again at the ends (the same clips): the
              // engine's 1D blend gives no weight at or beyond an end point.
              children: [
                { name: "walk0", point: 0, speed: 1 },
                { name: "walk", point: walk, speed: 1 },
                { name: "run", point: run, speed: 1 },
                { name: "run2", point: run * 3, speed: 1 },
              ],
            },
          },
        ],
        transitions: [
          { from: "START", to: "Idle" },
          { from: "Idle", to: "Move", time: 0.2, conditions: moving(pc.ANIM_GREATER_THAN) },
          { from: "Move", to: "Idle", time: 0.25, conditions: moving(pc.ANIM_LESS_THAN_EQUAL_TO) },
        ],
      },
    ],
    parameters: { speed: { name: "speed", type: pc.ANIM_PARAMETER_FLOAT, value: 0 } },
  });
  model.anim.assignAnimation("Idle", tracks.idle);
  for (const n of ["walk0", "walk"]) model.anim.assignAnimation(`Move.${n}`, tracks.walk);
  for (const n of ["run", "run2"]) model.anim.assignAnimation(`Move.${n}`, tracks.run);
  model.anim.playing = false;
  model.wdCharacter = { kind: "mesh", meta, level, scale: s, walk, run };
  return { model, meta };
}

// How fast the human's clips play at a ground speed (1 = as captured).
export function humanRate(info, speed) {
  if (speed <= 0.1) return 1;
  const { meta, scale, walk, run } = info;
  const w = Math.max(0, Math.min(1, (speed - walk) / (run - walk)));
  const tuned = info.tuner ? info.tuner.strideScale(speed) : 1;
  const stride = ((1 - w) * meta.clips.walk.stride + w * meta.clips.run.stride) * scale * tuned;
  return speed / stride;
}

// Worlds' tuning file (docs/WORLDS.md, "Tuning the gait"): the settings
// exported from the character lab. Returns null when there is none; `look`
// is checked and filled in (before the model loads, for its height).
export async function fetchTuning() {
  try {
    const r = await fetch(new URL("tuning.json", BASE));
    if (!r.ok) return null;
    const raw = await r.json();
    return { raw, look: normalizeTuning(raw, {}).look };
  } catch {
    return null;
  }
}

// Applies the tuning file's gait to the person; the measured gait (the
// file's defaults) needs nothing, so nothing more loads.
export async function useWorldTuning(model, meta, raw) {
  const tuning = normalizeTuning(raw, meta);
  if (isDefaultTuning(tuning, meta)) return null;
  const ref = await fetch(new URL("../lab/gait-reference.json", BASE)).then((r) => r.json());
  return tuneHuman(model, ref, tuning);
}

// Gives the realistic character a gait tuning (gait-tuner.js): the lab's
// settings, or Worlds' tuning.json. `ref` is the lab's gait reference.
export function tuneHuman(model, ref, tuning) {
  const info = model.wdCharacter;
  if (info?.kind !== "mesh") return null;
  info.tuner ??= new GaitTuner(model, info.meta, ref, tuning);
  info.tuner.set(tuning);
  return info.tuner;
}

export async function loadMeshCharacter(app) {
  const meta = await fetch(new URL("character.json", BASE)).then((r) => r.json());
  const asset = await new Promise(
    (resolve, reject) =>
    app.assets.loadFromUrl(new URL("character.glb", BASE).href, "container", (err, a) => (err ? reject(new Error(err)) : resolve(a))), // prettier-ignore
  );
  const res = asset.resource;
  const model = res.instantiateRenderEntity({ castShadows: true, receiveShadows: true });
  // Its own units: scaled to the splat character's height (measured on the
  // model as the engine places it).
  const box = new pc.BoundingBox();
  model.findComponents("render").forEach((r, i) => r.meshInstances.forEach((mi, k) => (i || k ? box.add(mi.aabb) : box.copy(mi.aabb)))); // prettier-ignore
  const h = box.getMax().y - box.getMin().y || meta.height;
  const s = BODY.height / h;
  model.setLocalScale(s, s, s);
  for (const r of model.findComponents("render"))
    for (const mi of r.meshInstances) {
      mi.material.useFog = true;
      mi.material.update();
    }
  const tracks = {};
  for (const a of res.animations) tracks[a.resource.name] = a.resource;
  model.addComponent("anim", { activate: true });
  model.anim.loadStateGraph({
    layers: [
      {
        name: "Base",
        states: [
          { name: "START" },
          {
            name: "Move",
            speed: 1,
            loop: true,
            blendTree: {
              type: pc.ANIM_BLEND_1D,
              parameters: ["speed"],
              children: [
                { name: "idle", point: 0, speed: 1 },
                { name: "walk", point: WALK_SPEED, speed: 0.72 },
                { name: "run", point: RUN_SPEED, speed: 1.05 },
              ],
            },
          },
        ],
        transitions: [{ from: "START", to: "Move" }],
      },
    ],
    parameters: { speed: { name: "speed", type: pc.ANIM_PARAMETER_FLOAT, value: 0 } },
  });
  for (const n of ["idle", "walk", "run"]) if (tracks[n]) model.anim.assignAnimation(`Move.${n}`, tracks[n]); // prettier-ignore
  // The world advances it (update below), not the engine's own clock.
  model.anim.playing = false;
  model.wdCharacter = { kind: "kenney", meta };
  return { model, meta };
}

// One step of the mesh character's clips at the world's speed.
export function stepMeshCharacter(model, speed, dt) {
  model.anim.setFloat("speed", speed);
  const info = model.wdCharacter;
  const rate = info?.kind === "mesh" ? humanRate(info, speed) : 1;
  if (dt > 0) {
    model.anim.update(dt * rate);
    // The tuning on top of the clips (only after they play: they set every
    // bone again each step, so the changes never add up).
    info?.tuner?.apply(model.anim.baseLayer.activeState !== "Move", speed, dt);
  }
}

// The same person as splats (?character=splat-person; docs/WORLDS.md, "The
// person as splats"): its textured surface sampled at rest by
// tools/wd-character.py, each splat given to the bone that moves it most.
// Each bone's splats are one rigid piece on that bone's entity, so parts
// turn and move as solid pieces; nothing bends. The model's skeleton and
// clips drive them (its meshes are hidden). `count` is the tier's budget.
export async function loadSplatPerson(app, view, { tier = "mid", look = {}, count = 64000 } = {}) {
  const [{ model, meta }, info, bin] = await Promise.all([
    loadHuman(app, { tier: "low", look }),
    fetch(new URL("../person-splats/human-splats.json", BASE)).then((r) => r.json()),
    fetch(new URL("../person-splats/human-splats.bin", BASE)).then((r) => r.arrayBuffer()),
  ]);
  const renders = model.findComponents("render");
  const skin = renders[0].meshInstances.find((mi) => mi.skinInstance)?.skinInstance.skin;
  for (const r of renders) r.enabled = false;
  const inv = new Map(skin.boneNames.map((n, i) => [n, skin.inverseBindPose[i]]));
  const dv = new DataView(bin);
  const half = (o) => pc.FloatPacking.half2Float?.(dv.getUint16(o, true)) ?? halfToFloat(dv.getUint16(o, true)); // prettier-ignore
  // (Splat colors are sRGB, like the kit's.)
  const byte = (v) => v / 255;
  const tee = look.shirt ? parseInt(look.shirt.slice(1), 16) : null;
  const shirt = tee === null ? null : { r: (tee >> 16) / 255, g: ((tee >> 8) & 255) / 255, b: (tee & 255) / 255 }; // prettier-ignore
  const frac = Math.min(1, count / info.count);
  const p = new pc.Vec3();
  const n = new pc.Vec3();
  const q = new pc.Quat();
  const zAxis = new pc.Vec3(0, 0, 1);
  let at = 0;
  let total = 0;
  for (const b of info.bones) {
    const take = Math.max(1, Math.round(b.count * frac));
    const bone = model.findByName(b.name);
    const m = inv.get(b.name);
    const buf = new SplatBuffer(take);
    for (let k = 0; k < take; k++) {
      const o = (at + k) * info.stride;
      m.transformPoint(p.set(half(o), half(o + 2), half(o + 4)), p);
      m.transformVector(n.set(dv.getInt8(o + 6), dv.getInt8(o + 7), dv.getInt8(o + 8)), n).normalize(); // prettier-ignore
      q.setFromDirections?.(zAxis, n) ?? fromTo(q, zAxis, n);
      const c = [byte(dv.getUint8(o + 9)), byte(dv.getUint8(o + 10)), byte(dv.getUint8(o + 11)), 1]; // prettier-ignore
      if (dv.getUint8(o + 12) === 1 && shirt) {
        c[0] *= shirt.r;
        c[1] *= shirt.g;
        c[2] *= shirt.b;
      }
      const r = (dv.getUint16(o + 13, true) / 10000) * (1 / frac) ** 0.5;
      buf.push([p.x, p.y, p.z], [r * 0.85, r * 0.85, r * 0.18], [q.x, q.y, q.z, q.w], c);
    }
    at += b.count;
    total += take;
    view.entity(`part-${b.name}`, view.container(buf), { parent: bone, shadows: true });
  }
  model.wdCharacter.splats = total;
  return { model, meta, splats: total };
}

function fromTo(out, a, b) {
  const d = a.dot(b);
  if (d < -0.999999) return out.setFromAxisAngle(new pc.Vec3(1, 0, 0), 180);
  const c = new pc.Vec3().cross(a, b);
  out.set(c.x, c.y, c.z, 1 + d);
  return out.normalize();
}

function halfToFloat(h) {
  const s = h & 0x8000 ? -1 : 1;
  const e = (h >> 10) & 0x1f;
  const f = h & 0x3ff;
  if (e === 0) return s * 2 ** -14 * (f / 1024);
  if (e === 31) return f ? NaN : s * Infinity;
  return s * 2 ** (e - 15) * (1 + f / 1024);
}

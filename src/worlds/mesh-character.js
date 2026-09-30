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

const BASE = new URL("../../assets/worlds/character/", import.meta.url);

function loadContainer(app, url) {
  return new Promise((resolve, reject) =>
    app.assets.loadFromUrl(url, "container", (err, a) => (err ? reject(new Error(err)) : resolve(a))),
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
  const s = BODY.height / meta.height;
  model.setLocalScale(s, s, s);
  const shirt = look.shirt ? linear(look.shirt) : null;
  for (const r of model.findComponents("render"))
    for (const mi of r.meshInstances) {
      const m = mi.material;
      m.useFog = true;
      // The tee is white cloth: the world's shirt color dyes it.
      if (m.name === "shirt" && shirt) m.diffuse = shirt;
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
  const stride = ((1 - w) * meta.clips.walk.stride + w * meta.clips.run.stride) * scale;
  return speed / stride;
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
  if (dt > 0) model.anim.update(dt * rate);
}

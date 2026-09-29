// The mesh character (docs/WORLDS.md, "The mesh character"): a lit,
// skinned model with idle, walk and run clips, in place of the splat
// character when a world asks for it (`character.model: "mesh"`, or
// ?character=mesh). It shares the world's sun, shadows and grade. The model
// is Kenney's "Animated Characters: Protagonists" (CC0), built into one GLB
// by tools/world-character.mjs.
//
// The clips blend by speed (a 1D blend tree: idle at rest, walk at walking
// speed, run at running speed) and advance with the world's own clock, so
// ?clock=manual clips and tests move them exactly.

import * as pc from "../pc.js";
import { WALK_SPEED, RUN_SPEED, BODY } from "./character.js";

const BASE = new URL("../../assets/worlds/character/", import.meta.url);

export async function loadMeshCharacter(app) {
  const meta = await fetch(new URL("character.json", BASE)).then((r) => r.json());
  const asset = await new Promise((resolve, reject) =>
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
  return { model, meta };
}

// One step of the mesh character's clips at the world's speed.
export function stepMeshCharacter(model, speed, dt) {
  model.anim.setFloat("speed", speed);
  if (dt > 0) model.anim.update(dt);
}

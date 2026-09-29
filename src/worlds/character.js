// The character (lane Character): a detailed person for Worlds, built with
// the kit from rigid parts, each its own splat cloud turning on its joint.
// Nothing bends or stretches; the joints hide the way real clothes and
// bodies do (character-body.js). Pure JavaScript: the build gives each
// part's splats around its own pivot, and pose() gives every joint's angles
// for standing, walking and running (character-motion.js); the renderer
// (world.js) turns the joints.
//
// Meters, facing +z, feet at y = 0.

import { Kit } from "../kit.js";
import { SplatBuffer } from "../generators.js";
import { mixSeed } from "../noise.js";
import { BODY, JOINTS, restPivots } from "./character-rig.js";
import { PARTS, palette } from "./character-body.js";

export { BODY, JOINTS, solve, place, restPivots } from "./character-rig.js";
export { pose, stepGait, WALK_SPEED, RUN_SPEED, strideAt } from "./character-motion.js";

// The character's splats on each device tier (docs/WORLDS.md, "Budgets"):
// it is always drawn in full, so it counts against the tier's budget.
export const CHARACTER_SPLATS = { low: 40e3, mid: 64e3, high: 90e3, max: 120e3 };

// How many splats a square meter of each part gets, relative to the
// clothes: faces and hands are looked at, the shoes are small.
const DENSITY = { head: 2.2, handL: 1.6, handR: 1.6, fingersL: 1.6, fingersR: 1.6, footL: 1.3, footR: 1.3, toesL: 1.3, toesR: 1.3, neck: 1.2 }; // prettier-ignore

// Builds every part's splats, each around its own pivot. `count` is the
// whole figure's splats. Returns { name: SplatBuffer }.
export function buildCharacter(look, { count = CHARACTER_SPLATS.mid, seed = 7 } = {}) {
  const c = palette(look);
  const rest = restPivots();
  const P = (name) => ({ x: rest[name][0], y: rest[name][1], z: rest[name][2] });
  const jointAt = (name, side) => P(`${name}${side > 0 ? "L" : "R"}`);
  // First every part's shapes, then the splats shared out by area, so the
  // whole figure has one even density (times each part's DENSITY).
  const kits = {};
  let total = 0;
  for (const j of JOINTS) {
    const part = PARTS[j.name];
    if (!part) continue;
    const k = new Kit(mixSeed(seed, `chr-${j.name}`), { count: 1000, fit: false });
    part.build(k, { c, pivot: P(j.name), jointAt, seed });
    const area = k.items.reduce((s, it) => s + it.area * (it.opts.weight ?? 1), 0);
    kits[j.name] = { k, area: area * (DENSITY[j.name] ?? 1) };
    total += kits[j.name].area;
  }
  const out = {};
  for (const name in kits) {
    const { k, area } = kits[name];
    k.count = Math.max(200, Math.round((count * area) / total));
    const it = k.emit();
    while (!it.next().done);
    out[name] = centered(k.buf, rest[name]);
  }
  return out;
}

// The part's splats around its pivot (the kit built them in the
// character's space), leaving out holes.
function centered(buf, pivot) {
  const out = new SplatBuffer(buf.count);
  for (let i = 0; i < buf.count; i++) {
    if (buf.color[i * 4 + 3] <= 0 || !(buf.scale[i * 3] > 0)) continue;
    out.push(
      [buf.pos[i * 3] - pivot[0], buf.pos[i * 3 + 1] - pivot[1], buf.pos[i * 3 + 2] - pivot[2]],
      [buf.scale[i * 3], buf.scale[i * 3 + 1], buf.scale[i * 3 + 2]],
      [buf.rot[i * 4], buf.rot[i * 4 + 1], buf.rot[i * 4 + 2], buf.rot[i * 4 + 3]],
      [buf.color[i * 4], buf.color[i * 4 + 1], buf.color[i * 4 + 2], buf.color[i * 4 + 3]],
    );
  }
  return out;
}

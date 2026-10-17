import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { HandsOn as Fixed } from "../../../src/physics/hands-on.js";
import { surfacePoints, quat } from "../../../src/physics/world.js";
const current = await fs.readFile(new URL("../../../src/physics/hands-on.js", import.meta.url), "utf8");
const line = "        for (const hit of w.takeHits()) this.onHit(hit);";
assert.equal(current.split(line).length, 2);
const old = current.replace(line, "").replace("    if (this.squish) {", "    for (const hit of w.takeHits()) this.onHit(hit);\n    if (this.squish) {");
const linked = old.replace(/from "\.\/([^"]+)"/g, (_, name) => `from "${new URL("../../../src/physics/" + name, import.meta.url).href}"`);
await fs.writeFile(new URL("./hands-on-old-order-with-guard.mjs", import.meta.url), linked);
const { HandsOn: Before } = await import("./hands-on-old-order-with-guard.mjs");
const harness = "function play(recipe, { radius = 1 } = {}) {\n  const cues = [];\n  const player = {\n    stage: { setToyPose() {} },\n    motion: { ctx: null },\n    proc: null,\n    frozen: false,\n    recipeRay: (x, y) => ({ origin: [x / 100, y / 100, 10], dir: [0, 0, -1] }),\n    toRecipe: (p) => p.slice(),\n    emit: (n, c) => n === \"cue\" && cues.push(...c),\n  };\n  const h = new HandsOn(player);\n  h.attach({\n    id: \"test\",\n    radius,\n    center: [0, 0, 0],\n    half: [0.3, 0.3, 0.3],\n    recipe: { handsOn: true, ...recipe },\n  });\n  h.ensure();\n  const s = {\n    h,\n    cues,\n    player,\n    run(sec) {\n      for (let i = 0; i < Math.round(sec * 60); i++) h.step(1 / 60);\n    },\n    drag(X0, Y0, X1, Y1, sec = 0.5) {\n      h.pressAt([X0, Y0, 0], X0 * 100, Y0 * 100);\n      const n = Math.round(sec * 60);\n      for (let i = 1; i <= n; i++) {\n        const f = i / n;\n        h.moveTo((X0 + (X1 - X0) * f) * 100, (Y0 + (Y1 - Y0) * f) * 100);\n        h.step(1 / 60);\n      }\n    },\n    up() {\n      h.release();\n    },\n    j(i = 0) {\n      return h.joints.state()[i];\n    },\n  };\n  return s;\n}\n\nconst box = (half) => ({ type: \"box\", half });\nconst piece = (token, pos, half) => {\n  const solid = box(half);\n  return { token, pos, solid, points: surfacePoints(solid, 1), pick: half.map((v) => v * 1.3) };\n};";
const results = [];
for (const [mode, HandsOn] of [["before", Before], ["after", Fixed]]) {
 const { play, piece } = new Function("HandsOn", "surfacePoints", "quat", harness + "\nreturn {play,piece};")(HandsOn, surfacePoints, quat);
 const s = play({ hands: { floor: 0, pieces: () => [piece(0, [0, .1, 0], [.1, .1, .1])], joints: [{ type: "socket", token: 0 }] } });
 const b=s.h.pieces[0].body, j=s.h.joints.list[0];
 s.h.free(b); b.pos=[.05,.1,0]; s.h.joints.glide(j); s.h.joints.step(.15); b.vel=[0,-4,0];
 const hits=[]; const onHit=s.h.onHit.bind(s.h);
 s.h.onHit=(hit)=>{hits.push({speed:hit.speed/s.h.R(), pinned:!!b.pinned});return onHit(hit);};
 s.h.step(.1);
 results.push({mode, hits, state:s.j()});
}
assert.equal(results[0].state.pinned, false);
assert.equal(results[1].state.pinned, true);
console.log(JSON.stringify({ source: createHash("sha256").update(current).digest("hex"), results },null,2));


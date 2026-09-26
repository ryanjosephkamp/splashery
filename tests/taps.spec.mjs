// Every kit toy's tap, checked from data: the toys come from the shelf
// (src/toys.js) and the plan (tools/toy-plan.json), so a lane that finishes
// a toy (marks it "keep" in the plan) is checked here without editing this
// file. A lane's own extra tests go in tests/<lane>.spec.mjs (docs/OPERATING.md).
//
// For every kit toy whose tap fires a pulse or a toggle:
// - drive() gives finite numbers mid-effect and at rest, on a first and a
//   second tap;
// - "end": the effect ends where the toy rests. Played through frame by
//   frame (drive may keep state between frames), its last moment and the
//   rest pose show the same parts and pieces in the same places, so nothing
//   jumps at the end. A toggle is played on and then off again.
// - "shape": at rest every channel that carries morph splats is back near 0,
//   so the toy is back in shape (light channels park wherever they are dark
//   and are not checked).

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { TOYS } from "../src/toys.js";

const PLAN = JSON.parse(fs.readFileSync(new URL("../tools/toy-plan.json", import.meta.url), "utf8")).toys; // prettier-ignore

// Known exceptions: a toy that fails a check for a good reason is listed
// here with the reason, and the other checks still run on it. Add to this
// list only with a reason; the Operator keeps it (docs/OPERATING.md).
const EXCEPT = {
  // Sway by a morph all the time: they bend gently at rest.
  willow: { shape: "the strands sway by a morph all the time" },
  kelp: { shape: "the blades sway by a morph all the time" },
  // Hidden pieces rest folded away with their channel held at 1.
  lotus: { shape: "the stalk rests folded away with its channel at 1" },
  coral: { shape: "the polyps rest folded away with their channel at 1" },
  // Breathe or creep by a gentle idle morph at rest.
  lungs: { shape: "the lungs breathe by a gentle idle morph at rest" },
  amoeba: { shape: "the amoeba creeps by a gentle idle morph at rest" },
  // Pieces cleared by light, not by their part: the part is still shown at
  // the effect's last moment, but its splats have already faded to nothing.
  virus: { end: "its two copies fade out on a fade channel before they are hidden" },
  sapphire: { end: "the star's last frame has shrunk to nothing (out.grow) before it is hidden" }, // prettier-ignore
  mars: { end: "the dust has cleared (out.grow at 0) before its part is hidden" },
  // Turning planets (docs/PACKS.md 7b "Draw order"): while they turn, the
  // core ball inside the hollow shell hides and turning bands cull their far
  // side with larger splats; both switch back at rest, unseen inside the
  // closed surface.
  mercury: { end: "its hidden core comes back at rest, inside the closed shell" },
  venus: { end: "its hidden core and culled bands switch back at rest, unseen" },
  earth: { end: "its hidden core comes back at rest, inside the closed shell" },
  jupiter: { end: "its hidden core and culled bands switch back at rest, unseen" },
  neptune: { end: "its hidden core and culled bands switch back at rest, unseen" },
  moon: { end: "the lander, flag and plume have lifted off out of view (2.3 units up) before they are hidden" }, // prettier-ignore
  // A small jump that the owner has not remarked on.
  guitar: { end: "the strings still shimmer at about a tenth when the strum ends, then stop" },
};

const kitToys = TOYS.filter((t) => t.kind === "kit");
const packs = [...new Set(kitToys.map((t) => t.pack))];

test("every finished kit toy has its own tap: a pulse or a toggle", async () => {
  // "keep" means a phase finished the toy's effect; "more" toys have one
  // that should be clearer. Toys still marked "new" only hop for now.
  for (const t of kitToys) {
    if (PLAN[t.id]?.v === "new") continue;
    const { RECIPES } = await import(`../src/packs/${t.pack}.js`);
    const r = RECIPES[t.id];
    const ctl = r.controls?.find((c) => c.key === r.action?.key);
    expect(["pulse", "toggle"], `${t.id}: its action's control`).toContain(ctl?.type);
  }
});

test("every exception names a kit toy and a check, with a reason", () => {
  for (const [id, checks] of Object.entries(EXCEPT)) {
    expect(
      kitToys.some((t) => t.id === id),
      id,
    ).toBe(true);
    for (const [check, why] of Object.entries(checks)) {
      expect(["end", "shape"], id).toContain(check);
      expect(typeof why === "string" && why.length > 8, `${id} ${check}: a reason`).toBe(true);
    }
  }
});

for (const pack of packs) {
  test(`every ${pack} toy's tap ends where the toy rests`, async () => {
    const { buildRecipe } = await import("../src/kit.js");
    const { KINDS } = await import("../src/effects.js");
    const { RECIPES } = await import(`../src/packs/${pack}.js`);
    const failures = [];
    for (const t of kitToys.filter((x) => x.pack === pack)) {
      const id = t.id;
      const r = RECIPES[id];
      const ctl = r.controls?.find((c) => c.key === r.action?.key);
      if (!ctl || !["pulse", "toggle"].includes(ctl.type)) continue;
      const skip = EXCEPT[id] || {};
      const options = Object.fromEntries((r.options || []).map((o) => [o.key, o.default]));
      if (r.prepare) await r.prepare(options);
      const it = buildRecipe(r, { seed: 5, count: 6000, options }, () => {});
      let b = it.next();
      while (!b.done) b = it.next();
      const data = b.value.kit.data;
      const blank = () => ({ parts: {}, glow: [1, 1, 1, 0], amount: 1, grow: 1, cues: [], fx: {}, tokens: null }); // prettier-ignore
      const defaults = () => Object.fromEntries(r.controls.map((x) => [x.key, x.default ?? 0]));

      // Played through frame by frame, as the app plays it (drive may keep
      // state between frames): a pulse is tapped twice, one effect after the
      // other, and a toggle is switched on and then off. Every frame gives
      // finite numbers, and each effect's last moment matches the rest pose.
      const c = defaults();
      let clock = 1.5;
      let n = 0;
      const frame = (v) => {
        const out = blank();
        c[ctl.key] = v;
        r.drive(clock, c, out, { time: clock, R: 1, tap: n ? { n, point: null, key: ctl.key } : null, data }); // prettier-ignore
        const nums = [...(out.morph || [])];
        for (const pd of Object.values(out.parts))
          nums.push(pd.angle, pd.visible, pd.scale, ...(pd.offset || []), ...(pd.quat || []));
        for (const tk of out.tokens || [])
          nums.push(...(tk?.offset || []), ...(tk?.quat || []), tk?.visible);
        if (nums.some((x) => x !== undefined && !Number.isFinite(x)))
          failures.push(`${id}: a number is not finite at ${v.toFixed(2)} (tap ${n})`);
        return out;
      };
      const dv = 0.01;
      const step = dv * (ctl.ease ?? 0.8);
      const ends = [];
      frame(0);
      for (const tap of ctl.type === "toggle" ? [1] : [1, 2]) {
        n = tap;
        if (ctl.type === "toggle") {
          for (let v = dv; v < 0.9999; v += dv) {
            clock += step;
            frame(v);
          }
          for (let i = 0; i < 50; i++) {
            clock += step;
            frame(1);
          }
          n = 2;
        }
        for (let v = 1; v > 0.001; v -= dv) {
          clock += step;
          frame(v);
        }
        ends.push([frame(0.0004), frame(0)]);
      }
      const rest = ends[ends.length - 1][1];
      if (!skip.end) {
        const shown = (x) => (x?.visible ?? 1) * (x?.scale ?? 1);
        const far = (a, q) => Math.hypot(...[0, 1, 2].map((i) => (a?.offset?.[i] ?? 0) - (q?.offset?.[i] ?? 0))); // prettier-ignore
        ends.forEach(([last, q0], e) => {
          const tap = ends.length > 1 ? ` (tap ${e + 1})` : "";
          for (const [name, pd] of Object.entries(last.parts)) {
            const q = q0.parts[name];
            if (Math.abs(shown(pd) - shown(q)) >= 0.05) failures.push(`${id}: part ${name} is shown ${shown(pd).toFixed(2)} at the end${tap}, ${shown(q).toFixed(2)} at rest`); // prettier-ignore
            else if (shown(pd) > 0.05 && far(pd, q) >= 0.03) failures.push(`${id}: part ${name} is ${far(pd, q).toFixed(3)} from its rest place at the end${tap}`); // prettier-ignore
          }
          (last.tokens || []).forEach((tk, i) => {
            const q = q0.tokens?.[i];
            if (Math.abs(shown(tk) - shown(q)) >= 0.05) failures.push(`${id}: piece ${i} is shown ${shown(tk).toFixed(2)} at the end${tap}, ${shown(q).toFixed(2)} at rest`); // prettier-ignore
            else if (shown(tk) > 0.05 && far(tk, q) >= 0.03) failures.push(`${id}: piece ${i} is ${far(tk, q).toFixed(3)} from its rest place at the end${tap}`); // prettier-ignore
          });
        });
      }

      // At rest the shape is back.
      if (!skip.shape) {
        const { anim, count } = b.value.kit.buf;
        const shaped = new Set();
        for (let i = 0; i < count; i++)
          if (anim[i * 4 + 1] === KINDS.morph) shaped.add(Math.floor(anim[i * 4 + 3] / 4096));
        for (const ch of shaped) {
          const m = rest.morph?.[ch] ?? 0;
          if (Math.abs(m) >= 0.05) failures.push(`${id}: channel ${ch} is ${m.toFixed(3)} at rest`);
        }
      }
    }
    expect(failures, `${pack}: see EXCEPT at the top of this file`).toEqual([]);
  });
}

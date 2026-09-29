// Lane AB-A (maker A): the toy piano. Its taps are checked from data: which
// key a point picks, the song's cues, and the key, hammer and rod motion.

import { test, expect } from "@playwright/test";
import { RECIPES } from "../src/packs/music.js";
import { TOY_SOUNDS } from "../src/toy-sounds.js";
import { buildRecipe } from "../src/kit.js";

const r = RECIPES["toy-piano"];

function drive(c, tap, time, memo) {
  const out = { parts: {}, glow: [1, 1, 1, 0], amount: 1, grow: 1, cues: [], fx: {}, tokens: null };
  r.drive(time, memo, out, { time, R: 1, tap });
  return out;
}
const rest = () => ({ play: 0, strike: 0 });
const angle = (q) => 2 * Math.asin(Math.min(1, Math.abs(q[0])));

test("the toy piano has 20 keys, each with a hammer and a rod, inside the kit's limits", () => {
  const it = buildRecipe(r, { seed: 5, count: 8000, options: {} }, () => {});
  let b = it.next();
  while (!b.done) b = it.next();
  expect(b.value.kit.parts.length).toBeLessThanOrEqual(16);
  expect(TOY_SOUNDS["toy-piano"].notes.split(" ")).toHaveLength(20);
});

test("a tap on a key picks that key; a tap on the case plays the song", () => {
  // The first white key (C), a black key over the second (C#), a rod, a side panel.
  expect(r.action.at([-0.85, 0.54, 0.5])).toEqual({ key: "strike", pick: 0 });
  expect(r.action.at([-0.775, 0.64, 0.2])).toEqual({ key: "strike", pick: 1 });
  expect(r.action.at([-0.85, 1.23, -0.3])).toEqual({ key: "strike", pick: 0 });
  expect(r.action.at([1.03, 0.9, 0])).toBeNull();
});

test("a struck key dips, its hammer reaches the rod and the rod shivers", () => {
  const memo = rest();
  const tap = { n: 1, key: "strike", pick: 5, time: 10, point: null };
  let hammerAtHit = null;
  let maxDip = 0;
  let maxShiver = 0;
  for (let t = 10; t < 12; t += 1 / 60) {
    const out = drive(memo, tap, t, memo);
    maxDip = Math.max(maxDip, angle(out.tokens[5].quat));
    if (Math.abs(t - 10.11) < 0.009) hammerAtHit = angle(out.tokens[25].quat);

    const rod = out.parts.rod5.quat;
    if (t > 10.12) maxShiver = Math.max(maxShiver, angle(rod));
  }
  expect(maxDip).toBeGreaterThan(0.1);
  // At the strike the hammer has turned all the way from its resting tilt.
  expect(hammerAtHit).toBeGreaterThan(0.5);
  expect(angle(drive(memo, tap, 10.11, memo).tokens[25].quat)).toBeCloseTo(0.6, 2);
  expect(maxShiver).toBeGreaterThan(0.03);
  // Long after, everything is back at rest.
  const end = drive(memo, tap, 13, memo);
  expect(angle(end.tokens[5].quat)).toBeLessThan(1e-6);
  expect(angle(end.parts.rod5.quat)).toBeLessThan(0.01);
});

test("the song plays the opening of Twinkle, Twinkle in order", () => {
  const memo = rest();
  const tap = { n: 1, key: "play", pick: null, time: 5, point: null };
  const notes = [];
  for (let t = 5; t < 14; t += 1 / 60) {
    const out = drive(memo, tap, t, memo);
    for (const cue of out.cues) notes.push(cue.f);
    for (const tk of out.tokens) for (const v of tk?.quat || []) expect(Number.isFinite(v)).toBe(true); // prettier-ignore
  }
  expect(notes.join(" ")).toBe("C5 C5 G5 G5 A5 A5 G5 F5 F5 E5 E5 D5 D5 C5");
});

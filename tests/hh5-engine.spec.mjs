// Lane Hands-on H5's engine PR (docs/handoff/HandsH5.md): `hands.touch`
// (src/physics/fields.js) tells a recipe's drive what the finger does
// (info.hands.pressed, held, speed, joint(name), piece(i)), and with `key`
// a held press, a push or a pick-up fires that action (a poke), while a
// quick tap is left to the toy's own tap.

import { test, expect } from "@playwright/test";
import { Extras, extrasFor } from "../src/physics/fields.js";
import { Body } from "../src/physics/world.js";

// A stand-in for Hands-on and its player: a clock, a whole toy's body and
// the action calls.
function fakeHands(hands) {
  const acts = [];
  const body = new Body({ pos: [0, 0, 0], solid: { type: "sphere", r: 1 }, mass: 1 });
  const ho = {
    time: 0,
    mode: "toy",
    body,
    hold: null,
    press: null,
    world: {},
    pieces: [],
    joints: null,
    R: () => 2,
    player: {
      time: 0,
      motion: { act: (time, point, forced) => (acts.push(forced.key), { key: forced.key }) },
      emit() {},
      stage: {},
    },
  };
  return { ho, acts, x: new Extras(ho, hands) };
}

test("touch: info.hands.pressed follows the finger, held and speed the body", () => {
  const { ho, x } = fakeHands({ touch: true });
  const ab = x.about;
  expect(ab.pressed).toBe(false);
  x.pressAt([0, 0, 0], 10, 10);
  expect(ab.pressed).toBe(true);
  expect(ab.held).toBe(false);
  ho.hold = { body: ho.body };
  expect(ab.held).toBe(true);
  // 3 world units a second on a toy of radius 2: 1.5 toy radii a second.
  ho.body.vel = [3, 0, 0];
  expect(ab.speed).toBeCloseTo(1.5, 6);
  x.release();
  ho.hold = null;
  expect(ab.pressed).toBe(false);
  expect(ab.held).toBe(false);
});

test("touch: a joint's value and a piece's place for a drive", () => {
  const { ho, x } = fakeHands({ touch: true });
  const body = new Body({ pos: [0.2, 0.1, 0], solid: { type: "sphere", r: 0.1 }, mass: 1 });
  ho.mode = "pieces";
  ho.pieces = [{ body, home: { pos: [0, 0.1, 0], q: [0, 0, 0, 1] } }];
  ho.joints = { byName: new Map([["point", { v: 1.25 }]]) };
  expect(x.about.joint("point")).toBeCloseTo(1.25, 6);
  expect(x.about.joint("none")).toBeNull();
  const p = x.about.piece(0);
  expect(p.pos).toEqual([0.2, 0.1, 0]);
  expect(p.home).toEqual([0, 0.1, 0]);
  expect(p.held).toBe(false);
  expect(x.about.piece(3)).toBeNull();
});

test("touch with a key: a held press pokes once; a quick tap doesn't", () => {
  const { ho, x, acts } = fakeHands({ touch: { key: "poke" } });
  // A quick tap: pressed and let go within 0.1 s.
  x.pressAt([0, 0, 0], 0, 0);
  ho.time += 0.1;
  x.step(0.1);
  x.release();
  expect(acts).toEqual([]);
  // Held still past 0.15 s: one poke, however long it is held.
  ho.time += 1;
  x.pressAt([0, 0, 0], 0, 0);
  for (let i = 0; i < 30; i++) {
    ho.time += 1 / 60;
    x.step(1 / 60);
  }
  expect(acts).toEqual(["poke"]);
  x.release();
  // Picked up at once (a drag): it pokes at the pick-up, not 0.15 s later.
  ho.time += 1;
  x.pressAt([0, 0, 0], 0, 0);
  ho.hold = { body: ho.body };
  ho.time += 1 / 60;
  x.step(1 / 60);
  expect(acts).toEqual(["poke", "poke"]);
  x.release();
  ho.hold = null;
  // Again within the gap (0.5 s): no poke.
  ho.time += 0.2;
  x.pressAt([0, 0, 0], 0, 0);
  ho.hold = { body: ho.body };
  ho.time += 1 / 60;
  x.step(1 / 60);
  expect(acts).toEqual(["poke", "poke"]);
});

test("touch: a toy without it has no Extras (plays exactly as before)", () => {
  const motion = {};
  const ho = { player: { motion } };
  expect(extrasFor(ho, { recipe: { hands: { pieces: () => [] } } })).toBeNull();
  expect(motion.hands).toBeNull();
  const x = extrasFor(ho, { recipe: { hands: { touch: true } } });
  expect(x).not.toBeNull();
  expect(motion.hands).toBe(x.about);
});

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

test("follow with at: a press there is followed, elsewhere it picks the toy up", () => {
  const { ho, x } = fakeHands({ follow: { at: (p) => p[1] > 0.3 } });
  ho.player.toRecipe = (p) => p.slice();
  ho.player.recipeRay = () => ({ origin: [0, 0, 5], dir: [0, 0, -1] });
  // On the head: Extras takes the drag, and the finger is there for the drive.
  expect(x.pressAt([0, 0.5, 0], 10, 10)).toBe(true);
  expect(x.about.finger).not.toBeNull();
  x.release();
  expect(x.about.finger).toBeNull();
  // On the body: left to Hands-on, which picks the toy up.
  expect(x.pressAt([0, -0.2, 0], 10, 10)).toBe(false);
  expect(x.about.finger).toBeNull();
});

test("upright with rest: a toy back near upright on the floor settles and sleeps; a touch frees it", async () => {
  const { World, Body, quat } = await import("../src/physics/world.js");
  const { makeJoints } = await import("../src/physics/joints.js");
  // A log lying across the floor (it rolls on its round side), its weight a
  // little behind its middle, as an owl on its branch: never still by itself.
  const w = new World({ gravity: [0, -26, 0], substeps: 8, sleepSpeed: 0.03, minHit: 0.6 });
  w.plane([0, 1, 0], -0.2, { friction: 0.7, restitution: 0.3 });
  const pts = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return [i < 12 ? -0.8 : 0.8, 0.2 * Math.cos(a), 0.2 * Math.sin(a)];
  });
  const b = w.add(new Body({ pos: [0, 0, 0], points: pts, mass: 1, inertia: [0.02, 0.2, 0.2] }));
  b.home = { pos: [0, 0, 0], q: [0, 0, 0, 1] };
  b.goHome = () => {};
  const hands = { mode: "toy", body: b, press: null, R: () => 1, info: { recipe: { hands: { upright: { k: 60, damping: 5, rest: 0.15 } } } }, player: {} }; // prettier-ignore
  const J = makeJoints(hands, w);
  // Tipped back, rolling.
  b.q = quat.axisAngle([1, 0, 0], 0.5);
  b.omega = [2, 0, 0];
  for (let i = 0; i < 360; i++) {
    w.step(1 / 60);
    J.step(1 / 60);
  }
  expect(b.settled).toBeTruthy();
  expect(w.asleep).toBe(true);
  // A finger on it frees it again.
  hands.press = {};
  w.wake();
  w.step(1 / 60);
  J.step(1 / 60);
  expect(b.settled).toBeFalsy();
  expect(b.invMass).toBeGreaterThan(0);
});

test("a piece's when: it is picked up only while when(data) holds", async () => {
  const { HandsOn } = await import("../src/physics/hands-on.js");
  const data = { cur: 0 };
  const ho = new HandsOn({ proc: { ctx: { kit: { data } } } });
  const organ = new Body({ pos: [0, 1, 0], solid: { type: "sphere", r: 0.1 }, mass: 1 });
  ho.pieces = [{ body: organ, part: "heart", home: { pos: [0, 1, 0], q: [0, 0, 0, 1] }, def: { pick: [0.1, 0.1, 0.1], when: (d) => d.cur === 3 } }]; // prettier-ignore
  expect(ho.pieceAt([0, 1.05, 0])).toBeNull();
  data.cur = 3;
  expect(ho.pieceAt([0, 1.05, 0])).toBe(organ);
});

test("socket armAway: armed only once the piece and the finger's line have left its place", async () => {
  const { Joints } = await import("../src/physics/joints.js");
  const J = Object.create(Joints.prototype);
  J.hands = { R: () => 1 };
  const j = { d: { type: "socket", snap: 0.1, armAway: 0.3 }, pc: { home: { pos: [0, 0, 0] } }, armed: false }; // prettier-ignore
  const h = { body: { pos: [0.5, 0, 0] } };
  // The piece is away, but the finger still points at its place.
  J.nearSocket(j, h, { origin: [0, 0, 5], dir: [0, 0, -1] });
  expect(j.armed).toBe(false);
  // The finger's line moves off too: armed.
  J.nearSocket(j, h, { origin: [0.5, 0, 5], dir: [0, 0, -1] });
  expect(j.armed).toBe(true);
});

test("a piece's home spring: pulled off and let go, it springs back to its place with a wobble", async () => {
  const { HandsOn } = await import("../src/physics/hands-on.js");
  const hands = { gravity: 0, pieces: () => [{ token: 0, pos: [0, 0, 0], home: { k: 80, damping: 6 }, pick: [0.1, 0.1, 0.1] }] }; // prettier-ignore
  const player = { proc: { ctx: { kit: { data: {} } } }, motion: { ctx: { transform: { scale: 1 } } }, stage: {} }; // prettier-ignore
  const ho = new HandsOn(player);
  ho.info = { radius: 1, recipe: { hands } };
  const w = ho.buildPieces(hands);
  const a = ho.pieces[0].body;
  ho.free(a);
  a.pos = [0, 0, -0.3];
  w.wake();
  let crossed = false;
  for (let i = 0; i < 240; i++) {
    w.step(1 / 60);
    if (a.pos[2] > 0.005) crossed = true;
  }
  expect(crossed).toBe(true);
  expect(Math.hypot(...a.pos)).toBeLessThan(0.01);
});

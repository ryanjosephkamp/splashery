// Lane Hands engine B's engine PR (docs/handoff/HandsEngineB.md): the joints
// in src/physics/joints.js (hinges, sliders, dials, sockets, breaks, upright),
// run through Hands-on (src/physics/hands-on.js) with a stand-in player: a view
// straight down -z, where screen pixels are recipe units times 100.

import { test, expect } from "@playwright/test";
import { HandsOn } from "../src/physics/hands-on.js";
import { surfacePoints, quat } from "../src/physics/world.js";

function play(recipe, { radius = 1 } = {}) {
  const cues = [];
  const player = {
    stage: { setToyPose() {} },
    motion: { ctx: null },
    proc: null,
    frozen: false,
    recipeRay: (x, y) => ({ origin: [x / 100, y / 100, 10], dir: [0, 0, -1] }),
    toRecipe: (p) => p.slice(),
    emit: (n, c) => n === "cue" && cues.push(...c),
  };
  const h = new HandsOn(player);
  h.attach({
    id: "test",
    radius,
    center: [0, 0, 0],
    half: [0.3, 0.3, 0.3],
    recipe: { handsOn: true, ...recipe },
  });
  h.ensure();
  const s = {
    h,
    cues,
    player,
    run(sec) {
      for (let i = 0; i < Math.round(sec * 60); i++) h.step(1 / 60);
    },
    drag(X0, Y0, X1, Y1, sec = 0.5) {
      h.pressAt([X0, Y0, 0], X0 * 100, Y0 * 100);
      const n = Math.round(sec * 60);
      for (let i = 1; i <= n; i++) {
        const f = i / n;
        h.moveTo((X0 + (X1 - X0) * f) * 100, (Y0 + (Y1 - Y0) * f) * 100);
        h.step(1 / 60);
      }
    },
    up() {
      h.release();
    },
    j(i = 0) {
      return h.joints.state()[i];
    },
  };
  return s;
}

const box = (half) => ({ type: "box", half });
const piece = (token, pos, half) => {
  const solid = box(half);
  return { token, pos, solid, points: surfacePoints(solid, 1), pick: half.map((v) => v * 1.3) };
};

test("hinge: a lid swings up after the finger, falls shut by its weight, stays open past upright", () => {
  // A lid hinged at its back edge (x = -0.5), seen from the side.
  const s = play({ hands: { floor: -0.5, joints: [{ type: "hinge", part: "lid", pivot: [-0.5, 0.1, 0], axis: [0, 0, 1], min: 0, max: 1.95, pos: [0, 0.2, 0], pick: [0.55, 0.2, 0.4] }] } }); // prettier-ignore
  s.drag(0.4, 0.2, -0.3, 0.9, 0.8);
  const held = s.j().v;
  expect(held).toBeGreaterThan(0.9); // it follows the finger up
  expect(held).toBeLessThan(1.4);
  // The body is posed exactly on the hinge: its middle keeps its distance
  // from the hinge line.
  const p = s.j().pos;
  expect(Math.hypot(p[0] + 0.5, p[1] - 0.1)).toBeCloseTo(Math.hypot(0.5, 0.1), 5);
  s.up();
  s.run(1.2);
  expect(s.j().v).toBe(0); // shut on its stop
  expect(s.cues.some((c) => c.voice === "thud")).toBe(true); // with a thud
  s.drag(0.4, 0.2, -0.6, 0.3, 1);
  s.up();
  s.run(1.2);
  expect(s.j().v).toBeCloseTo(1.95, 3); // past upright it falls open onto its stop
  // ↺ swings it home along its hinge.
  s.h.reset();
  let off = 0;
  for (let i = 0; i < 40; i++) {
    s.run(1 / 60);
    const q = s.j().pos;
    off = Math.max(off, Math.abs(Math.hypot(q[0] + 0.5, q[1] - 0.1) - Math.hypot(0.5, 0.1)));
  }
  expect(off).toBeLessThan(1e-6);
  expect(s.j().v).toBe(0);
  expect(s.h.state().moved).toBe(false);
});

test("hinge: a spring brings it home, and the stops hold", () => {
  const s = play({ hands: { floor: -1, joints: [{ type: "hinge", part: "flap", pivot: [0, 0, 0], axis: [0, 0, 1], min: -0.5, max: 0.5, spring: 60, damping: 4, gravity: false, pos: [0.4, 0, 0], pick: [0.3, 0.2, 0.2] }] } }); // prettier-ignore
  s.drag(0.4, 0, 0.1, 0.6, 0.5); // pulled far past its stop
  expect(s.j().v).toBeLessThanOrEqual(0.5);
  expect(s.j().v).toBeGreaterThan(0.45);
  s.up();
  s.run(2);
  expect(Math.abs(s.j().v)).toBeLessThan(0.01); // sprung home
});

test("slider: stuck until pulled, slides between its stops, friction holds it", () => {
  const s = play({ hands: { floor: -0.5, joints: [{ type: "slider", part: "sword", pivot: [0, 0.9, 0], axis: [0, 1, 0], min: 0, max: 0.6, stick: 0.12, wiggle: [0, 0, 1], friction: 40, pos: [0, 0.6, 0], pick: [0.1, 0.5, 0.1] }] } }); // prettier-ignore
  s.drag(0, 0.8, 0, 0.88, 0.3);
  expect(s.j().v).toBe(0);
  expect(s.j().stuck).toBe(true);
  s.drag(0, 0.88, 0, 1.3, 0.6);
  expect(s.j().stuck).toBe(false);
  expect(s.j().v).toBeGreaterThan(0.3);
  const at = s.j().v;
  // Its middle moved straight up the line: no sideways drift.
  expect(Math.abs(s.j().pos[0])).toBeLessThan(1e-6);
  s.up();
  s.run(1);
  expect(s.j().v).toBeCloseTo(at, 3); // stays where it was let go
  s.drag(0, 1.2, 0, 2.5, 0.6);
  expect(s.j().v).toBeLessThanOrEqual(0.6); // the top stop
  s.h.reset();
  s.run(0.6);
  expect(s.j().v).toBe(0);
  expect(s.j().stuck).toBe(true); // stuck fast again
});

test("slider: without friction it slides back down under its weight", () => {
  const s = play({ hands: { floor: -1, joints: [{ type: "slider", part: "cork", axis: [0, 1, 0], min: 0, max: 0.5, pos: [0, 0, 0], pick: [0.1, 0.1, 0.1] }] } }); // prettier-ignore
  s.drag(0, 0, 0, 0.4, 0.5);
  expect(s.j().v).toBeGreaterThan(0.3);
  s.up();
  s.run(1);
  expect(s.j().v).toBe(0);
});

test("dial: turned around and around, it coasts after a flick and settles on a click", () => {
  const notes = [];
  const s = play({ hands: { floor: -1, joints: [{ type: "dial", part: "crank", pivot: [0, 0, 0], axis: [0, 0, 1], detents: 8, drag: 1.5, pos: [0.3, 0, 0], pick: [0.15, 0.15, 0.15], turn: (v, dv) => (dv ? (notes.push(v), null) : null) }] } }); // prettier-ignore
  s.h.pressAt([0.3, 0, 0], 30, 0);
  // Two whole turns of the finger, round the axis.
  const N = 120;
  for (let i = 1; i <= N; i++) {
    const a = (i / N) * Math.PI * 4;
    s.h.moveTo(Math.cos(a) * 30, Math.sin(a) * 30);
    s.h.step(1 / 60);
  }
  expect(s.j().v).toBeGreaterThan(Math.PI * 3.5); // past one turn: it keeps count
  const w = s.j().w;
  expect(w).toBeGreaterThan(3);
  s.up();
  s.run(0.3);
  expect(s.j().w).toBeGreaterThan(0); // coasting on
  s.run(5);
  expect(s.j().w).toBe(0);
  const step = Math.PI / 4;
  expect(Math.abs(s.j().v / step - Math.round(s.j().v / step))).toBeLessThan(0.02); // on a click
  const clicks = s.h.joints.events.filter((e) => e.kind === "detent").length;
  expect(clicks).toBeGreaterThan(16); // a click for each eighth of a turn
  expect(notes.length).toBeGreaterThan(50); // turn() heard every move
  s.h.reset();
  s.run(0.6);
  expect(s.j().v).toBe(0);
});

test("socket: a piece taken out clicks back into its place when brought close", () => {
  const s = play({ hands: { floor: 0, area: 2, pieces: () => [piece(0, [0.5, 0.1, 0], [0.15, 0.1, 0.15])], joints: [{ type: "socket", token: 0, snap: 0.25 }] } }); // prettier-ignore
  s.drag(0.5, 0.1, -0.8, 0.5, 0.6);
  s.up();
  s.run(1.5);
  expect(s.j().pinned).toBe(false);
  expect(s.j().pos[0]).toBeLessThan(-0.3); // set down away from its place
  s.drag(-0.8, 0.1, 0.5, 0.15, 0.8);
  s.run(0.5);
  expect(s.h.state().holding).toBe(false); // it left the finger
  expect(s.j().pinned).toBe(true);
  expect(s.j().pos).toEqual([0.5, 0.1, 0]);
  expect(s.cues.some((c) => c.voice === "click")).toBe(true);
  // Picked up from its place, it doesn't click straight back in.
  s.drag(0.5, 0.1, 0.55, 0.15, 0.3);
  expect(s.h.state().holding).toBe(true);
  s.up();
});

test("break: holds and bends a little, snaps off when pulled hard, ↺ mends it", () => {
  const s = play({ hands: { floor: 0, area: 2, pieces: () => [piece(0, [0, 0.5, 0], [0.15, 0.1, 0.15])], joints: [{ type: "break", token: 0, at: [0, 0.3, 0], pull: 0.35, give: 0.2 }] } }); // prettier-ignore
  s.drag(0, 0.5, 0.2, 0.55, 0.3);
  expect(s.j().broken).toBe(false);
  const bent = s.j().pos;
  expect(bent[0]).toBeGreaterThan(0.005); // it gives toward the finger
  expect(Math.hypot(bent[0], bent[1] - 0.3)).toBeCloseTo(0.2, 4); // as a whole, about where it is fixed
  s.up();
  s.run(0.3);
  expect(s.j().pos[0]).toBeCloseTo(0, 4); // springs back
  s.drag(0, 0.5, 0.7, 0.6, 0.5);
  expect(s.j().broken).toBe(true);
  expect(s.h.state().holding).toBe(true); // in the hand now
  expect(s.cues.some((c) => c.voice === "crack")).toBe(true);
  s.up();
  s.run(1.5);
  const p = s.j().pos;
  expect(p[1]).toBeGreaterThan(0.09); // lands on the floor, never through it
  expect(p[1]).toBeLessThan(0.2);
  s.h.reset();
  s.run(0.6);
  expect(s.j().broken).toBe(false);
  expect(s.j().pos).toEqual([0, 0.5, 0]);
});

test("break: a piece on a loose piece rides along, and a hard landing knocks it off", () => {
  const s = play({ hands: { floor: 0, area: 2, pieces: () => [piece(0, [0, 0.25, 0], [0.1, 0.25, 0.1]), piece(1, [0, 0.75, 0], [0.1, 0.25, 0.1])], joints: [{ type: "break", token: 1, to: 0, at: [0, 0.5, 0], knock: 2 }] } }); // prettier-ignore
  s.drag(0, 0.2, 0.6, 0.9, 0.6);
  const [base, top] = s.h.state().bodies;
  expect(base.pos[1]).toBeGreaterThan(0.6); // lifted
  expect(top.pos[1] - base.pos[1]).toBeCloseTo(0.5, 3); // the top rides on it, rigidly
  expect(top.pos[0] - base.pos[0]).toBeCloseTo(0, 3);
  s.up();
  s.run(1.5);
  expect(s.j().broken).toBe(true); // the landing knocked it off
  for (const b of s.h.state().bodies) expect(b.pos[1]).toBeGreaterThan(0.09);
  s.h.reset();
  s.run(0.6);
  expect(s.j().broken).toBe(false);
  expect(s.h.state().bodies.map((b) => b.pos)).toEqual([
    [0, 0.25, 0],
    [0, 0.75, 0],
  ]);
});

test("parents: a part on a hinged part rides with it (a lamp's arms)", () => {
  const s = play({ hands: { floor: -1, joints: [
    { type: "hinge", part: "arm", pivot: [0, 0, 0], axis: [0, 0, 1], min: -1, max: 1, gravity: false, pos: [0.5, 0, 0], pick: [0.4, 0.1, 0.1] },
    { type: "hinge", part: "head", parent: "arm", pivot: [1, 0, 0], axis: [0, 0, 1], min: -1, max: 1, gravity: false, pos: [1.2, 0, 0], pick: [0.15, 0.15, 0.15] },
  ] } }); // prettier-ignore
  s.drag(0.5, 0, 0.45, 0.25, 0.6);
  s.up();
  const arm = s.j(0).v;
  expect(arm).toBeGreaterThan(0.3);
  const head = s.j(1);
  expect(head.v).toBe(0);
  // The head's middle turned with the arm about the arm's hinge.
  expect(head.pos[0]).toBeCloseTo(1.2 * Math.cos(arm), 4);
  expect(head.pos[1]).toBeCloseTo(1.2 * Math.sin(arm), 4);
});

test("upright: a whole toy rights itself after a tip, keeping its turn", () => {
  const s = play({ hands: { upright: { k: 60, damping: 4 } } });
  // (Level 1 builds its body from the toy's splats; here, a stand-in box.)
  const b = s.h.body;
  b.q = quat.axisAngle([0.2, 1, 0.6], 0.9);
  s.h.world.wake();
  s.run(4);
  const up = quat.rotate(b.q, [0, 1, 0]);
  expect(up[1]).toBeGreaterThan(0.99);
});

test("toys without joints have none", () => {
  const s = play({ hands: { floor: 0, pieces: () => [piece(0, [0, 0.1, 0], [0.1, 0.1, 0.1])] } });
  expect(s.h.joints).toBe(null);
});

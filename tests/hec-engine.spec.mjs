// Lane Hands engine C's engine PR (docs/handoff/HandsEngineC.md): soft parts
// for Hands-on (src/physics/soft.js): ropes and chains, cloth, and soft
// stretch, each measured over time; the four-token skin (kind "skin4").

import { test, expect } from "@playwright/test";
import { SoftParts, ropeSkin, clothSkin } from "../src/physics/soft.js";
import { HandsOn } from "../src/physics/hands-on.js";
import { World, Body, quat, v3 } from "../src/physics/world.js";
import { Kit } from "../src/kit.js";
import { KINDS } from "../src/effects.js";

const STEP = 1 / 60;

// A host as hands-on.js gives it (toy radius 1, recipe units = world).
function host(pieces = [], world = null) {
  const grab = { on: false, held: false, pull: [0, 0, 0], goal: [0, 0, 0] };
  return {
    R: () => 1,
    info: { radius: 1 },
    pieces,
    world,
    player: { toRecipe: (p) => p.slice(), fromRecipe: (p) => p.slice(), driver: { grab } },
  };
}

const run = (sp, secs, t0 = 0) => {
  let t = t0;
  for (; t < t0 + secs; t += STEP) sp.step(STEP, t);
  return t;
};

// A rope of n nodes from `a`, `len` long, along `dir`.
const line = (a, dir, len, n) =>
  Array.from({ length: n }, (_, i) => v3.add(a, v3.scale(v3.norm(dir), (len * i) / (n - 1))));

const dist = (a, b) => v3.len(v3.sub(a, b));

test("a rope built sideways falls and hangs straight down from its pin, keeping its length", () => {
  const sp = new SoftParts(host()).build({ floor: -5, ropes: () => [{ points: line([0, 2, 0], [1, 0, 0], 1, 9) }] }); // prettier-ignore
  const s = sp.state().strands[0];
  expect(s.nodes.length).toBe(9);
  sp.grab(sp.pick([1, 2, 0]));
  sp.release(); // nudged loose: it now falls under gravity
  let maxStretch = 0;
  for (let t = 0; t < 6; t += STEP) {
    sp.step(STEP, t);
    const n = sp.state().strands[0].nodes;
    for (let i = 0; i + 1 < n.length; i++) maxStretch = Math.max(maxStretch, dist(n[i], n[i + 1]) / 0.125 - 1); // prettier-ignore
  }
  const n = sp.state().strands[0].nodes;
  expect(n[0]).toEqual([0, 2, 0]); // the pin holds
  // Its end hangs about a rope's length below the pin, right under it.
  expect(n[8][1]).toBeGreaterThan(0.95);
  expect(n[8][1]).toBeLessThan(1.1);
  expect(Math.abs(n[8][0])).toBeLessThan(0.08);
  expect(maxStretch).toBeLessThan(0.05); // a rope, not a rubber band
});

test("a hanging chain pulled aside swings, settles back home and hands the toy back", () => {
  const pts = line([0, 2, 0], [0, -1, 0], 1, 7);
  const sp = new SoftParts(host()).build({ floor: -5, ropes: () => [{ points: pts }] });
  const end = sp.pick([0, 1, 0]);
  expect(end.node.i).toBe(6);
  sp.grab(end);
  // Drag the end out to the side and up; the rope never reaches further than it is long.
  let t = 0;
  for (let k = 0; k < 30; k++, t += STEP) {
    sp.drag([2 * (k / 29), 1 + k / 29, 0]);
    sp.step(STEP, t);
  }
  const held = sp.state().strands[0].nodes[6];
  expect(dist(held, [0, 2, 0])).toBeLessThan(1.05);
  expect(held[0]).toBeGreaterThan(0.5);
  sp.release();
  // It swings through the bottom to the other side.
  let minX = 1;
  for (let k = 0; k < 60; k++, t += STEP) {
    sp.step(STEP, t);
    minX = Math.min(minX, sp.state().strands[0].nodes[6][0]);
  }
  expect(minX).toBeLessThan(-0.2);
  t = run(sp, 12, t);
  const st = sp.state();
  expect(st.asleep).toBe(true);
  expect(st.moved).toBe(false); // back home: the recipe's own drive takes over again
  expect(sp.output()).toBe(null);
});

test("cloth pinned along its top edge drapes, and streams and flutters in the wind", () => {
  const rows = 6;
  const cols = 5;
  const flat = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) flat.push([c * 0.2, 2, r * 0.2]);
  const pin = [0, 1, 2, 3, 4];
  const sp = new SoftParts(host()).build({ floor: -5, cloth: () => [{ rows, cols, points: flat, pin, bend: 0.1 }] }); // prettier-ignore
  sp.grab(sp.pick([0.4, 2, 1]));
  sp.release();
  let t = run(sp, 3);
  let n = sp.state().strands[0].nodes;
  // The sheet hangs from its pinned edge: the bottom row about a sheet's depth below.
  for (let c = 0; c < cols; c++) {
    expect(n[c]).toEqual(flat[c]);
    expect(n[(rows - 1) * cols + c][1]).toBeLessThan(2 - 0.85);
  }
  // Wind: the same sheet in a breeze along x streams out downwind and keeps moving.
  const windy = new SoftParts(host()).build({ floor: -5, cloth: () => [{ rows, cols, points: flat, pin: [0, 5, 10, 15, 20, 25], wind: { vel: [6, 0, 0], gust: 0.5 } }] }); // prettier-ignore
  t = run(windy, 2);
  const a = windy.state().strands[0].nodes.map((p) => p.slice());
  t = run(windy, 0.3, t);
  const b = windy.state().strands[0].nodes;
  const far = b.filter((_, i) => i % cols === cols - 1);
  expect(Math.min(...far.map((p) => p[0]))).toBeGreaterThan(0.3); // streams out downwind (0.8 long)
  expect(Math.max(...a.map((p, i) => dist(p, b[i])))).toBeGreaterThan(0.02); // and flutters
  expect(windy.state().asleep).toBe(false);
});

test("a breakable string snaps when pulled too far, and Reset mends it", () => {
  const pts = line([0, 0.5, 0], [1, 0, 0], 0.4, 5);
  const sp = new SoftParts(host()).build({ floor: 0, ropes: () => [{ points: pts, stiff: 0.6, breakAt: 2.2, pin: [0], radius: 0.01 }] }); // prettier-ignore
  sp.grab(sp.pick([0.4, 0.5, 0]));
  let t = 0;
  let snapped = null;
  for (let k = 0; k < 120 && !snapped; k++, t += STEP) {
    sp.drag([0.4 + k * 0.02, 0.5 + k * 0.005, 0]);
    sp.step(STEP, t);
    snapped = sp.takeEvents().find((e) => e.snap);
  }
  expect(snapped).toBeTruthy();
  expect(sp.state().strands[0].broken).toBeGreaterThan(0);
  sp.release();
  t = run(sp, 1, t);
  // The part left on the pin falls limp; nothing flies off or sinks.
  for (const p of sp.state().strands[0].nodes) {
    expect(p[1]).toBeGreaterThanOrEqual(0.0099);
    expect(Math.abs(p[0])).toBeLessThan(4);
  }
  expect(sp.reset()).toBe(true);
  t = run(sp, 0.6, t);
  const st = sp.state().strands[0];
  expect(st.broken).toBe(0);
  st.nodes.forEach((p, i) => expect(dist(p, pts[i])).toBeLessThan(1e-6));
});

test("arms riding a body trail behind it as it moves and curl back to their shape", () => {
  const w = new World({ gravity: [0, 0, 0] });
  const body = w.add(new Body({ pos: [0, 1, 0], solid: { type: "sphere", r: 0.3 }, mass: 0 }));
  const arm = line([0.3, 1, 0], [1, -0.3, 0], 0.8, 6);
  const pieces = [{ body }];
  const sp = new SoftParts(host(pieces, w)).build({ floor: 0, gravity: 0, ropes: () => [{ points: arm, attach: { piece: 0, nodes: [0] }, keep: 4, bend: 0.4, drag: 2 }] }); // prettier-ignore
  // The body is carried off to the right quickly (as a hand would).
  w.asleep = false;
  let t = 0;
  let lag = 0;
  for (let k = 0; k < 30; k++, t += STEP) {
    body.pos = [0, 1, k * 0.05];
    sp.step(STEP, t);
    const n = sp.state().strands[0].nodes;
    expect(dist(n[0], v3.add(body.pos, [0.3, 0, 0]))).toBeLessThan(1e-9); // the root rides
    lag = Math.max(lag, body.pos[2] - n[5][2]);
  }
  expect(lag).toBeGreaterThan(0.15); // the tip trails
  // Held still, it curls back into the shape it was built in.
  for (let k = 0; k < 300; k++, t += STEP) sp.step(STEP, t);
  const n = sp.state().strands[0].nodes;
  n.forEach((p, i) => expect(dist(p, v3.add(arm[i], [0, 0, 1.45]))).toBeLessThan(0.03));
});

test("rigid pieces ride a rope and turn with it (the yo-yo on its string)", () => {
  const pts = line([0, 2, 0], [0, -1, 0], 1, 5);
  const sp = new SoftParts(host()).build({
    floor: -5,
    ropes: () => [{ points: pts, mass: [1, 1, 1, 1, 4], pieces: [{ token: 3, from: 3, to: 4 }, { token: 4, node: 4, spin: () => 1.2, axis: [0, 0, 1] }] }], // prettier-ignore
  });
  sp.grab(sp.pick([0, 1, 0]));
  sp.drag([0.9, 1.6, 0]);
  let t = run(sp, 0.5);
  const out = sp.output();
  const seg = out.tokens.find((e) => e.index === 3).token;
  const n = sp.state().strands[0].nodes;
  // The segment's piece: its start where node 3 is, turned along 3 -> 4.
  expect(dist(v3.add(seg.base, seg.offset), n[3])).toBeLessThan(1e-9);
  const dir = quat.rotate(seg.quat, [0, -1, 0]);
  const want = v3.norm(v3.sub(n[4], n[3]));
  expect(v3.dot(dir, want)).toBeGreaterThan(0.999);
  // The end piece spins about its own axis as the recipe says.
  const yo = out.tokens.find((e) => e.index === 4).token;
  expect(Math.abs(yo.quat[3])).toBeLessThan(Math.cos(0.6) + 0.05);
  sp.release();
  t = run(sp, 0.2, t);
});

test("a tail rides the end of a line, a part's frame carries its tokens, and tokens can hide", () => {
  const linePts = line([0, 0, 0], [1, 1, 0], 1.2, 5);
  const tailPts = line(linePts[4], [0, -1, 0], 0.5, 4);
  const sp = new SoftParts(host()).build({
    floor: -5,
    ropes: () => [
      { points: linePts, pieces: [{ part: "kite", node: 4, pivot: linePts[4], at: v3.add(linePts[4], [0, 0.1, 0]) }] }, // prettier-ignore
      { points: tailPts, attach: { rope: 0, node: 4 }, frame: "kite", tokens: [0, 1, 2, 3], visible: () => 0.5 }, // prettier-ignore
    ],
  });
  sp.grab(sp.pick(linePts[4]));
  sp.drag([1.2, 0.2, 0]);
  run(sp, 0.6);
  const st = sp.state().strands;
  // The tail's first node stays on the line's end.
  expect(dist(st[1].nodes[0], st[0].nodes[4])).toBeLessThan(1e-6);
  const out = sp.output();
  const kite = out.parts.kite;
  const t0 = out.tokens.find((e) => e.index === 0).token;
  expect(t0.visible).toBe(0.5);
  // Moved by its token and then by the kite part, the tail's root lands on its node.
  const local = v3.add(t0.base, t0.offset);
  const moved = v3.add(v3.add(linePts[4], quat.rotate(kite.quat, v3.sub(local, linePts[4]))), kite.offset); // prettier-ignore
  expect(dist(moved, st[1].nodes[0])).toBeLessThan(1e-6);
  // The rider's own point (`at`) sits the same 0.1 off its node, turned with the line.
  const atMoved = v3.add(v3.add(linePts[4], quat.rotate(kite.quat, [0, 0.1, 0])), kite.offset);
  expect(Math.abs(dist(atMoved, st[0].nodes[4]) - 0.1)).toBeLessThan(1e-6);
});

test("stretch: the pull follows the finger, capped, then wobbles back through rest and stops", () => {
  const h = host();
  const sp = new SoftParts(h).build({ stretch: { radius: 0.5, max: 0.7, hz: 3, damping: 0.2 } });
  expect(sp.grab("stretch", [0, 1, 0])).toBe(true);
  expect(h.player.driver.grab.on).toBe(true);
  sp.drag([3, 1, 0]); // far past the cap
  let t = run(sp, 0.4);
  const pull = sp.state().stretch.pull;
  expect(pull[0]).toBeGreaterThan(0.6);
  expect(pull[0]).toBeLessThanOrEqual(0.7);
  expect(h.player.driver.grab.pull).toEqual(pull);
  sp.release();
  let minX = 1;
  let settledAt = null;
  for (let k = 0; k < 300 && settledAt === null; k++, t += STEP) {
    sp.step(STEP, t);
    minX = Math.min(minX, sp.state().stretch.pull[0]);
    if (!sp.state().stretch.on) settledAt = k * STEP;
  }
  expect(minX).toBeLessThan(-0.1); // it overshoots: a wobble, not a slow ease
  expect(minX).toBeGreaterThan(-0.6);
  expect(settledAt).not.toBe(null);
  expect(settledAt).toBeLessThan(3);
  expect(h.player.driver.grab.on).toBe(false);
});

test("skin helpers: a point on a rope or a sheet finds its nodes, and kit packs skin4", () => {
  const pts = line([0, 0, 0], [1, 0, 0], 1, 5);
  expect(ropeSkin(pts, [10, 11, 12, 13, 14])([0.6, 0.05, 0])).toEqual([12, 13, expect.any(Number)]); // prettier-ignore
  expect(ropeSkin(pts, [10, 11, 12, 13, 14])([0.6, 0.05, 0])[2]).toBeCloseTo(0.4, 6);
  const grid = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) grid.push([c, -r, 0.1 * c * r]);
  const sk = clothSkin({ rows: 3, cols: 3, points: grid, tokens: [0, 1, 2, 3, 4, 5, 6, 7, 8] });
  const [a, b, c, d, s, t] = sk([1.25, -0.5, 0.05]);
  expect([a, b, c, d]).toEqual([1, 2, 4, 5]);
  expect(s).toBeCloseTo(0.25, 1);
  expect(t).toBeCloseTo(0.5, 1);
  const k = new Kit(1, { count: 100 });
  const [z, w] = k.animParams(KINDS.skin4, [0, 0, 0], [0, 0], null, 0, [47, 3, 20, 46, 1, 0.5]);
  // Decoded as the shader does.
  const D = Math.floor(z / 262144);
  const C = Math.floor((z - D * 262144) / 4096);
  const r = z - D * 262144 - C * 4096;
  const B = Math.floor(r / 64);
  expect([r - B * 64, B, C, D]).toEqual([47, 3, 20, 46]);
  expect(Math.floor(w / 1024) / 1023).toBe(1);
  expect((w - Math.floor(w / 1024) * 1024) / 1023).toBeCloseTo(0.5, 2);
  expect(Math.fround(z)).toBe(z); // exact in the float texture
});

// Hands-on with a stub player: orthographic, looking down -z; a CSS pixel is 0.01.
function stubPlayer() {
  const grab = { on: false, held: false, pull: [0, 0, 0], goal: [0, 0, 0] };
  const motion = { ctx: { transform: { center: [0, 0, 0], scale: 1 } }, handsTokens: null, handsParts: null }; // prettier-ignore
  const ray = (x, y) => ({ origin: [x / 100, -y / 100, 10], dir: [0, 0, -1] });
  return {
    stage: { setToyPose() {}, ray },
    motion,
    proc: { ctx: { kit: { data: {} } } },
    recipeRay: ray,
    toRecipe: (p) => p.slice(),
    fromRecipe: (p) => p.slice(),
    driver: { grab },
  };
}
const px = (p) => [p[0] * 100, -p[1] * 100];

test("Hands-on: a recipe's ropes are taken, dragged, let go and reset by the finger", () => {
  const pts = line([0, 1.5, 0], [0, -1, 0], 1, 6);
  const recipe = { handsOn: true, hands: { floor: 0, ropes: () => [{ points: pts, tokens: [0, 1, 2, 3, 4, 5] }] } }; // prettier-ignore
  const player = stubPlayer();
  const ho = new HandsOn(player);
  ho.attach({ id: "test-rope", radius: 1, recipe });
  expect(ho.on).toBe(true);
  // Press on the rope's end and drag it to the right.
  expect(ho.pressAt([0, 0.5, 0], ...px([0, 0.5, 0]))).toBe(true);
  for (let k = 1; k <= 20; k++) {
    ho.moveTo(...px([0.04 * k, 0.5 + 0.02 * k, 0]));
    ho.step(STEP);
  }
  expect(ho.holding).toBe(true);
  for (let k = 0; k < 20; k++) ho.step(STEP);
  const s = ho.state().soft.strands[0];
  expect(s.nodes[5][0]).toBeGreaterThan(0.6);
  expect(player.motion.handsTokens.length).toBe(6);
  const t5 = player.motion.handsTokens.find((e) => e.index === 5).token;
  expect(dist(v3.add(t5.base, t5.offset), s.nodes[5])).toBeLessThan(1e-9);
  ho.release();
  for (let k = 0; k < 10; k++) ho.step(STEP);
  expect(ho.reset()).toBe(true);
  for (let k = 0; k < 40; k++) ho.step(STEP);
  const after = ho.state().soft.strands[0];
  after.nodes.forEach((p, i) => expect(dist(p, pts[i])).toBeLessThan(1e-6));
  expect(player.motion.handsTokens).toBe(null);
});

test("soft parts are cheap: eight arms and a cloth step in well under a millisecond", () => {
  const w = new World({ gravity: [0, 0, 0] });
  const body = w.add(new Body({ pos: [0, 1, 0], solid: { type: "sphere", r: 0.3 }, mass: 0 }));
  const arms = Array.from({ length: 8 }, (_, a) => {
    const d = [Math.cos((a / 8) * 6.28), -0.4, Math.sin((a / 8) * 6.28)];
    return { points: line(v3.add([0, 1, 0], v3.scale(v3.norm(d), 0.3)), d, 0.9, 6), attach: { piece: 0 }, keep: 3 }; // prettier-ignore
  });
  const flat = [];
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) flat.push([c * 0.15, 2, r * 0.15]);
  const sp = new SoftParts(host([{ body }], w)).build({ floor: 0, ropes: () => arms, cloth: () => [{ rows: 6, cols: 6, points: flat, pin: [0, 5], wind: { vel: [3, 0, 0] } }] }); // prettier-ignore
  w.asleep = false;
  let t = run(sp, 0.5);
  const t0 = performance.now();
  const N = 300;
  for (let k = 0; k < N; k++, t += STEP) {
    body.pos = [Math.sin(t * 3) * 0.5, 1, 0];
    sp.step(STEP, t);
  }
  const ms = (performance.now() - t0) / N;
  console.log(`soft step: ${ms.toFixed(3)} ms (84 nodes, 10 substeps)`);
  expect(ms).toBeLessThan(1);
});

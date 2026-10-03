// Lane Hands engine A's engine PR (docs/handoff/HandsEngineA.md): per-toy
// materials (src/physics/materials.js) and the fields (src/physics/fields.js):
// water and air buoyancy, gravity wells, wheels, shake detection, fleeing
// and projectiles. Each piece's behavior measured: heights, angles and
// positions over time.

import { test, expect } from "@playwright/test";
import { World, Body, surfacePoints, quat, v3 } from "../src/physics/world.js";
import { materialFor, applyMaterial, airForce, rollForce, throwSpin, driftForce } from "../src/physics/materials.js"; // prettier-ignore
import { sphereSubmerged, floatShape, restLevel, waterForce, airBuoyancy, wellForce, wheelForce, ShakeMeter, FleeField, densityOf } from "../src/physics/fields.js"; // prettier-ignore

const G = 26; // Hands-on's gravity, in toy radii per second squared
const R = 1;
const STEP = 1 / 60;

// A Level 1 world: a ball of radius 1 on a floor, with its material.
function ballWorld(name, { floorY = -1 } = {}) {
  const w = new World({ gravity: [0, -G, 0], substeps: 8, sleepSpeed: 0.03, minHit: 0.6 });
  const floor = w.plane([0, 1, 0], floorY, { friction: 0.7, restitution: 0.3 });
  const b = w.add(new Body({ pos: [0, 0, 0], solid: { type: "sphere", r: 1 }, mass: 1 }));
  const mat = name ? materialFor({ material: name }) : null;
  if (mat) {
    applyMaterial(b, mat, floor);
    w.force = (h) => {
      airForce(b, mat, G, R, h);
      if (b.touchTick >= w.tick - 1) rollForce(b, mat, G, h);
      else driftForce(b, mat, G, h);
    };
  }
  return { w, b, mat };
}

// Drops it from `drop` radii above the floor; returns the top of the first
// bounce (radii above where it rests).
function firstBounce(name, drop = 4) {
  const { w, b } = ballWorld(name);
  b.pos[1] += drop;
  let fell = false;
  let top = -Infinity;
  for (let i = 0; i < 240; i++) {
    w.step(STEP);
    if (b.vel[1] > 0) fell = true;
    if (fell) {
      top = Math.max(top, b.pos[1]);
      if (b.vel[1] < 0) break;
    }
  }
  return top;
}

test("materials: each ball bounces like the real one", () => {
  const drop = 4;
  const basket = firstBounce("basketball", drop);
  const tennis = firstBounce("tennis-ball", drop);
  const medicine = firstBounce("medicine-ball", drop);
  const bouncy = firstBounce("bouncy-ball", drop);
  // A height ratio is the restitution squared (0.82^2 = 0.67, a basketball
  // dropped from 1.8 m comes up to about 1.2 m).
  expect(basket / drop).toBeGreaterThan(0.55);
  expect(basket / drop).toBeLessThan(0.75);
  expect(bouncy / drop).toBeGreaterThan(0.72);
  expect(medicine / drop).toBeLessThan(0.05);
  expect(bouncy).toBeGreaterThan(tennis);
  expect(tennis).toBeGreaterThan(medicine);
});

test("materials: a beach ball floats down; a basketball drops", () => {
  const fallTime = (name) => {
    const { w, b } = ballWorld(name, { floorY: -20 });
    for (let i = 0; i < 600; i++) {
      w.step(STEP);
      if (b.pos[1] < -6) return { t: i * STEP, side: Math.hypot(b.pos[0], b.pos[2]) };
    }
    return { t: Infinity, side: 0 };
  };
  const { t: beach, side } = fallTime("beach-ball");
  const { t: basket, side: straight } = fallTime("basketball");
  // It drifts sideways as it falls; the basketball drops straight.
  expect(side).toBeGreaterThan(0.08);
  expect(straight).toBeLessThan(1e-6);
  const free = Math.sqrt((2 * 6) / G);
  expect(Math.abs(basket - free)).toBeLessThan(0.05); // barely slowed
  expect(beach).toBeGreaterThan(free * 1.2); // the air holds it up
  // It reaches its top speed, about sqrt(Fr G R), within a few radii (a
  // 60 cm inflatable of 60 g; Fr from its mass and size).
  const m = materialFor({ material: "beach-ball" });
  expect(m.fr).toBeGreaterThan(2);
  expect(m.fr).toBeLessThan(6);
});

test("materials: a spin curves a baseball; backspin holds a golf ball up", () => {
  const flight = (name, omega, vel) => {
    const { w, b } = ballWorld(name, { floorY: -50 });
    b.vel = vel.slice();
    b.omega = omega.slice();
    for (let i = 0; i < 30; i++) w.step(STEP);
    return b.pos;
  };
  // Thrown away from the view (-z) with sidespin about the upright.
  const curve = flight("baseball", [0, 12, 0], [0, 0, -4]);
  const straight = flight("baseball", [0, 0, 0], [0, 0, -4]);
  expect(Math.abs(curve[0] - straight[0])).toBeGreaterThan(0.25);
  // Backspin (about +z for a ball going +x) lifts it.
  const back = flight("golf-ball", [0, 0, 12], [4, 0, 0]);
  const none = flight("golf-ball", [0, 0, 0], [4, 0, 0]);
  expect(back[1]).toBeGreaterThan(none[1] + 0.2);
  // A low grab gives backspin; a grab on top, topspin.
  const m = materialFor({ material: "pool-ball" });
  expect(throwSpin(m, [0, -1, 0], [3, 0, 0], null)[2]).toBeGreaterThan(0);
  expect(throwSpin(m, [0, 1, 0], [3, 0, 0], null)[2]).toBeLessThan(0);
});

test("materials: rolling resistance: a pool ball rolls far, a medicine ball stops", () => {
  const roll = (name) => {
    const { w, b } = ballWorld(name);
    b.vel = [3, 0, 0];
    b.omega = [0, 0, -3];
    for (let i = 0; i < 300 && !w.asleep; i++) w.step(STEP);
    return b.pos[0];
  };
  const pool = roll("pool-ball");
  const med = roll("medicine-ball");
  expect(pool).toBeGreaterThan(2 * med);
  expect(med).toBeGreaterThan(0.2);
});

test("materials: a shuttlecock flips and falls cork first", () => {
  const w = new World({ gravity: [0, -G, 0], substeps: 8 });
  w.plane([0, 1, 0], -100);
  const mat = materialFor({ material: "shuttlecock" });
  // Its cork (local -y) starts pointing up.
  const b = w.add(new Body({ pos: [0, 0, 0], quat: quat.axisAngle([1, 0, 0], Math.PI), solid: { type: "cylinder", r: 0.6, h: 1 } })); // prettier-ignore
  b.omega = [0.3, 0, 0.2];
  applyMaterial(b, mat, null);
  w.force = (h) => airForce(b, mat, G, R, h);
  for (let i = 0; i < 90; i++) w.step(STEP);
  const cork = quat.rotate(b.q, mat.nose);
  expect(cork[1]).toBeLessThan(-0.9); // cork down
  expect(b.vel[1]).toBeLessThan(0);
});

test("materials: a spinning flying disc glides further than a dropped one", () => {
  const glide = (lift) => {
    const w = new World({ gravity: [0, -G, 0], substeps: 8 });
    w.plane([0, 1, 0], -1.2);
    const mat = { ...materialFor({ material: "flying-disc" }), lift: lift ? 0.9 : 0 };
    const b = w.add(new Body({ pos: [0, 0, 0], quat: quat.axisAngle([0, 0, 1], 0.08), solid: { type: "cylinder", r: 1, h: 0.12 } })); // prettier-ignore
    b.vel = [4, 0.4, 0];
    b.omega = [0, 20, 0];
    applyMaterial(b, mat, null);
    w.force = (h) => airForce(b, mat, G, R, h);
    let air = 0;
    for (let i = 0; i < 300; i++) {
      w.step(STEP);
      if (b.pos[1] > -1.05) air = i * STEP;
    }
    return { air, x: b.pos[0], tilt: Math.acos(quat.rotate(b.q, [0, 1, 0])[1]) };
  };
  const disc = glide(true);
  const brick = glide(false);
  expect(disc.air).toBeGreaterThan(brick.air * 1.4);
  // It stays near level while it spins (a slow bank, not a tumble).
  expect(disc.tilt).toBeLessThan(0.9);
});

test("water: a ball floats as deep as its density says, and its bob dies away", () => {
  expect(sphereSubmerged(-1, 1)).toBeCloseTo(0, 5);
  expect(sphereSubmerged(0, 1)).toBeCloseTo(0.5, 5);
  expect(sphereSubmerged(1, 1)).toBeCloseTo(1, 5);
  const w = new World({ gravity: [0, -G, 0], substeps: 8, sleepSpeed: 0.03 });
  w.plane([0, 1, 0], -4);
  const b = w.add(new Body({ pos: [0, 0, 0], solid: { type: "sphere", r: 1 } }));
  const mat = materialFor({ material: "water-polo-ball" });
  const density = densityOf(mat);
  expect(density).toBeGreaterThan(0.05);
  expect(density).toBeLessThan(0.1);
  const fl = floatShape(b, R);
  const level = restLevel(b, fl, density);
  // A water polo ball floats high: about a third of its height under water.
  expect(b.pos[1] - level).toBeGreaterThan(0.55);
  expect(b.pos[1] - level).toBeLessThan(0.75);
  const water = { level, density, drag: 6, G, R };
  w.force = (h) => waterForce(b, fl, water, h);
  b.pos[1] += 1.5; // dropped in from above
  const ys = [];
  for (let i = 0; i < 360; i++) {
    w.step(STEP);
    ys.push(b.pos[1]);
  }
  const low = Math.min(...ys);
  expect(low).toBeLessThan(-0.2); // it plunges
  expect(low).toBeGreaterThan(-1.6); // but not to the bottom
  // A few bobs, each smaller; then it rests where it floats.
  const late = ys.slice(200);
  expect(Math.max(...late) - Math.min(...late)).toBeLessThan(0.1);
  expect(Math.abs(ys[359])).toBeLessThan(0.05);
});

test("water: a boat tipped over rights itself; one pushed under bobs back up", () => {
  const w = new World({ gravity: [0, -G, 0], substeps: 8 });
  w.plane([0, 1, 0], -5);
  // A wide, flat hull (points on a box's outside).
  const solid = { type: "box", half: [1.4, 0.35, 0.6] };
  const b = w.add(new Body({ pos: [0, 0, 0], solid, points: surfacePoints(solid, 3) }));
  const fl = floatShape(b, R);
  const level = restLevel(b, fl, 0.4);
  const water = { level, density: 0.4, drag: 6, G, R };
  w.force = (h) => waterForce(b, fl, water, h);
  // Heeled over 35 degrees about its long axis.
  b.q = quat.axisAngle([1, 0, 0], 0.6);
  let maxTilt = 0;
  for (let i = 0; i < 300; i++) {
    w.step(STEP);
    if (i > 200)
      maxTilt = Math.max(maxTilt, Math.acos(Math.min(1, quat.rotate(b.q, [0, 1, 0])[1])));
  }
  expect(maxTilt).toBeLessThan(0.08);
  b.pos[1] -= 0.8;
  w.wake();
  let top = -Infinity;
  for (let i = 0; i < 300; i++) {
    w.step(STEP);
    top = Math.max(top, b.pos[1]);
  }
  expect(Math.abs(b.pos[1])).toBeLessThan(0.08);
  expect(top).toBeLessThan(0.6); // it rose back, without leaping out
});

test("air: a hot-air balloon pulled down floats back to where it hovered", () => {
  const w = new World({ gravity: [0, -G, 0], substeps: 8 });
  w.plane([0, 1, 0], -3);
  const b = w.add(new Body({ pos: [0, 0, 0], solid: { type: "sphere", r: 1 } }));
  const air = { hover: 0, spring: 0.3, drag: 3.2, upright: 6, G, R };
  w.force = (h) => airBuoyancy(b, air, h);
  b.pos[1] = -1.5;
  b.q = quat.axisAngle([0, 0, 1], 0.5);
  const at = [];
  for (let i = 0; i < 480; i++) {
    w.step(STEP);
    at.push(b.pos[1]);
  }
  expect(at[30]).toBeGreaterThan(-1.5); // rising
  expect(Math.max(...at)).toBeLessThan(0.5); // no shooting up
  expect(Math.abs(at[479])).toBeLessThan(0.08);
  expect(quat.rotate(b.q, [0, 1, 0])[1]).toBeGreaterThan(0.99); // basket under it
});

test("wells: a thrown body orbits a well, and one inside its capture is swallowed", () => {
  const w = new World({ gravity: [0, 0, 0], substeps: 8 });
  const b = w.add(new Body({ pos: [1, 0, 0], solid: { type: "sphere", r: 0.05 }, damping: 0 }));
  const well = { at: [0, 0, 0], pull: G, soft: 0.05, capture: 0, R };
  w.force = (h) => wellForce(b, well, h);
  // The speed of a circular orbit: v^2 / r = pull.
  b.vel = [0, 0, Math.sqrt(G)];
  let near = Infinity;
  let far = 0;
  let angle = 0;
  let last = Math.atan2(b.pos[2], b.pos[0]);
  for (let i = 0; i < 120; i++) {
    w.step(STEP);
    const r = v3.len(b.pos);
    near = Math.min(near, r);
    far = Math.max(far, r);
    const a = Math.atan2(b.pos[2], b.pos[0]);
    angle += ((a - last + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
    last = a;
  }
  expect(near).toBeGreaterThan(0.85);
  expect(far).toBeLessThan(1.15);
  expect(Math.abs(angle)).toBeGreaterThan(Math.PI); // more than half way round
  const w2 = new World({ gravity: [0, 0, 0], substeps: 8 });
  const s = w2.add(new Body({ pos: [1, 0, 0], solid: { type: "sphere", r: 0.05 } }));
  const hole = { at: [0, 0, 0], pull: G, soft: 0.05, capture: 0.3, R };
  w2.force = (h) => wellForce(s, hole, h);
  s.vel = [0, 0, 2];
  for (let i = 0; i < 180; i++) w2.step(STEP);
  expect(s.captured).toBe(true);
  expect(v3.len(s.pos)).toBeLessThan(0.05);
});

test("wheels: pushed along, a car rolls on; pushed side-on, it doesn't slide", () => {
  const run = (vel) => {
    const w = new World({ gravity: [0, -G, 0], substeps: 8, sleepSpeed: 0.03 });
    w.plane([0, 1, 0], 0, { friction: 0.7 });
    const solid = { type: "box", half: [1.2, 0.4, 0.5] };
    const b = w.add(new Body({ pos: [0, 0.4, 0], solid, points: surfacePoints(solid, 2), friction: 0.002 })); // prettier-ignore
    const wheels = { axle: [0, 0, 1], grip: 14, roll: 0.015, yaw: 3 };
    w.force = (h) => wheelForce(b, wheels, G, h, b.touchTick >= w.tick - 1);
    for (let i = 0; i < 20; i++) w.step(STEP); // settles on its wheels
    b.vel = vel.slice();
    w.wake();
    for (let i = 0; i < 120; i++) w.step(STEP);
    return b.pos;
  };
  const along = run([2, 0, 0]);
  const side = run([0, 0, 2]);
  expect(along[0]).toBeGreaterThan(1.5); // rolls on for most of two seconds
  expect(Math.abs(side[2])).toBeLessThan(0.2);
});

test("shake: a quick back-and-forth fires; a slow or straight drag doesn't", () => {
  const shake = (points, dt) => {
    const m = new ShakeMeter();
    let fired = 0;
    points.forEach((x, i) => {
      if (m.add(i * dt, x, 300)) fired++;
    });
    return { fired, level: m.level };
  };
  const back = [];
  for (let k = 0; k < 24; k++) back.push(200 + 60 * Math.sin((k / 24) * 6 * Math.PI));
  const quick = shake(back, 0.02);
  expect(quick.fired).toBeGreaterThan(0);
  expect(quick.level).toBeGreaterThan(0.5);
  expect(shake(back, 0.2).fired).toBe(0); // too slow: a wander, not a shake
  const straight = [];
  for (let k = 0; k < 24; k++) straight.push(100 + k * 10);
  expect(shake(straight, 0.02).fired).toBe(0);
});

test("flee: things near the finger's line dart away, and come back after", () => {
  const f = new FleeField({ radius: 0.5, back: 2.5 });
  const near = f.get("a", [0, 0.1, 0]);
  const far = f.get("b", [2, 0, 0]);
  f.ray = { origin: [0, 0, 5], dir: [0, 0, -1] };
  for (let i = 0; i < 12; i++) f.step(STEP);
  expect(near.d[1]).toBeGreaterThan(0.1); // pushed up, away from the line
  expect(Math.abs(near.d[0])).toBeLessThan(0.02);
  expect(v3.len(far.d)).toBeLessThan(1e-6);
  expect(v3.len(near.d)).toBeLessThanOrEqual(f.max + 1e-6);
  f.ray = null;
  for (let i = 0; i < 240; i++) f.step(STEP);
  expect(v3.len(near.d)).toBeLessThan(0.01);
  expect(f.step(STEP)).toBe(false);
});

// ---- In the app: the pieces asked for by a recipe's hands block ----------

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

// Opens a toy, gives its recipe a hands block (as a recipe would) and turns
// Hands-on on.
async function open(page, id, hands) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(
    async ({ id, hands }) => {
      const { app, player } = window.__splashery;
      await app.chooseToy(id);
      player.opts.idleDelay = 1e9;
      if (hands) player.toyInfo.recipe.hands = { ...(player.toyInfo.recipe.hands || {}), ...hands };
      player.handsOn.attach(player.toyInfo);
    },
    { id, hands },
  );
  await page.click("#hands-toggle");
}

const frames = (page, n) =>
  page.evaluate((n) => {
    const { player } = window.__splashery;
    for (let i = 0; i < n; i++) player.update(1 / 60);
  }, n);

test("in the app: a toy without these pieces has no extras", async ({ page }) => {
  await open(page, "soccer-ball", null);
  const s = await page.evaluate(() => {
    const { player } = window.__splashery;
    return { extras: player.handsOn.extras ?? null, hands: player.motion.hands ?? null };
  });
  expect(s.extras).toBe(null);
  expect(s.hands).toBe(null);
});

test("in the app: water shows its line, the ball floats at home, and a dropped one bobs back", async ({
  page,
}) => {
  await open(page, "water-polo-ball", { material: "water-polo-ball", water: true });
  await frames(page, 3);
  await page.waitForTimeout(300); // (the water's view loads on first use)
  await frames(page, 3);
  const s = await page.evaluate(() => {
    const { player } = window.__splashery;
    const h = player.handsOn;
    return { on: !!h.extras.view?.entity?.enabled, level: h.extras.water.level, y: h.body.pos[1], home: h.body.home.pos[1], R: h.R(), floor: h.world.planes[0].d }; // prettier-ignore
  });
  expect(s.on).toBe(true);
  expect((s.home - s.level) / s.R).toBeGreaterThan(0.55); // a third under water
  expect(s.floor).toBeLessThan(s.level - s.R); // the pool is deeper than the ball
  const ys = await page.evaluate(() => {
    const { player } = window.__splashery;
    const h = player.handsOn;
    h.body.pos[1] += 1.2 * h.R();
    h.moved = true;
    h.world.wake();
    const out = [];
    for (let i = 0; i < 300; i++) {
      player.update(1 / 60);
      out.push((h.body.pos[1] - h.body.home.pos[1]) / h.R());
    }
    return out;
  });
  expect(Math.min(...ys)).toBeLessThan(-0.15);
  expect(Math.abs(ys[299])).toBeLessThan(0.05);
  await page.click("#hands-toggle");
  await frames(page, 2);
  expect(await page.evaluate(() => !!window.__splashery.player.handsOn.extras.view?.entity?.enabled)).toBe(false); // prettier-ignore
});

test("in the app: a shake while holding fires the toy's shake", async ({ page }) => {
  await open(page, "snow-globe", { shake: true });
  // A press and a pick-up, then the shake, all through Hands-on's own path
  // (headless mouse moves come too slowly, each drawing a frame).
  const s = await page.evaluate(() => {
    const { player } = window.__splashery;
    const h = player.handsOn;
    const c = player.stage.toScreen(player.toyInfo.center);
    h.pressAt(player.toyInfo.center.slice(), c[0], c[1]);
    h.moveTo(c[0], c[1] - 40);
    player.update(1 / 60);
    // Two strokes a second each way, 70 pixels, for a second (a frame
    // stepped between moves, as on a phone).
    for (let k = 1; k <= 60; k++) {
      h.moveTo(c[0] + 70 * Math.sin((k / 60) * 4 * Math.PI), c[1] - 40);
      player.update(1 / 60);
    }
    const out = { level: player.motion.hands.shake, shake: player.motion.tap?.key, holding: h.holding }; // prettier-ignore
    h.release();
    return out;
  });
  expect(s.holding).toBe(true);
  expect(s.level).toBeGreaterThan(0.4);
  expect(s.shake).toBe("shake"); // the toy's own shake fired
});

test("in the app: a drag through a fleeing toy moves its things, not the toy", async ({ page }) => {
  await open(page, "fish-school", { flee: { radius: 0.4 } });
  // From a fish in the outer shell (a probe where it swims).
  const s = await page.evaluate(() => {
    const { player } = window.__splashery;
    const h = player.handsOn;
    const p = player.motion.ctx.kit.data.fish.at(-1).pos;
    const hands = player.motion.hands;
    const before = Math.hypot(...hands.flee("probe", p).offset);
    const w = player.fromRecipe(p);
    const c = player.stage.toScreen(w);
    const took = h.pressAt(w, c[0], c[1]);
    for (let k = -2; k <= 2; k++) {
      h.moveTo(c[0] + k * 5, c[1]);
      player.update(1 / 60);
    }
    for (let k = 0; k < 4; k++) player.update(1 / 60);
    const out = { took, before, finger: !!hands.finger, d: Math.hypot(...hands.flee("probe", p).offset), moved: h.moved, holding: h.holding }; // prettier-ignore
    h.release();
    for (let k = 0; k < 300; k++) player.update(1 / 60);
    out.back = Math.hypot(...hands.flee("probe", p).offset);
    out.fingerAfter = hands.finger;
    return out;
  });
  expect(s.took).toBe(true);
  expect(s.before).toBe(0);
  expect(s.finger).toBe(true);
  expect(s.d).toBeGreaterThan(0.05);
  expect(s.moved).toBe(false); // the school itself stayed put
  expect(s.holding).toBe(false);
  expect(s.back).toBeLessThan(0.01);
  expect(s.fingerAfter).toBe(null);
});

test("in the app: a car pushed along rolls on after the finger lets go, its wheels turning", async ({
  page,
}) => {
  await open(page, "sports-car", { wheels: { axle: [0, 0, 1], r: 0.2, parts: ["front", "rear"] } });
  // A press on the car, then a push along the screen (Hands-on's own path,
  // a frame between moves).
  const r = await page.evaluate(() => {
    const { player } = window.__splashery;
    const h = player.handsOn;
    const c = player.stage.toScreen(player.toyInfo.center);
    h.pressAt(player.toyInfo.center.slice(), c[0], c[1]);
    for (let k = 1; k <= 20; k++) {
      h.moveTo(c[0] + k * 6, c[1]);
      player.update(1 / 60);
    }
    const a = { pos: h.body.pos.slice(), home: h.body.home.pos.slice(), holding: h.holding, angle: player.motion.handsParts.front.angle }; // prettier-ignore
    h.release();
    for (let k = 0; k < 40; k++) player.update(1 / 60);
    const b = { pos: h.body.pos.slice(), angle: player.motion.handsParts.front.angle };
    return { a, b };
  });
  const { a, b } = r;
  expect(a.holding).toBe(false); // pushed, never picked up
  const moved = v3.len(v3.sub(a.pos, a.home));
  const after = v3.len(v3.sub(b.pos, a.home));
  expect(moved).toBeGreaterThan(0.1);
  expect(after).toBeGreaterThan(moved + 0.2); // it rolled on by itself
  expect(Math.abs(b.pos[1] - a.home[1])).toBeLessThan(0.05); // on its wheels
  expect(Math.abs(b.angle - a.angle)).toBeGreaterThan(0.5); // the wheels turned
  await page.click("#hands-reset");
  await frames(page, 60);
  const c = await page.evaluate(() => {
    const h = window.__splashery.player.handsOn;
    const [p, q] = [h.body.pos, h.body.home.pos];
    return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  });
  expect(c).toBeLessThan(1e-6);
});

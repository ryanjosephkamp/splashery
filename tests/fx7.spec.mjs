// Lane Fix7 (docs/handoff/Fix7.md), part 1: taps land where you tap, and taps on long effects
// do what the owner expects (his review of October 2, 2026).

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { RECIPES as ELEMENTS } from "../src/packs/elements.js";
import { RECIPES as MEDIEVAL } from "../src/packs/medieval.js";
import { RECIPES as LAB } from "../src/packs/lab.js";
import { RECIPES as HOLIDAYS } from "../src/packs/holidays.js";
import { RECIPES as PLAYTHINGS } from "../src/packs/playthings.js";
import { RECIPES as SPLATTING } from "../src/packs/splatting.js";

const SHOTS = path.resolve("tests/screenshots");

async function open(page, id, { size = [390, 844], labs = false } = {}) {
  await page.setViewportSize({ width: size[0], height: size[1] });
  await page.goto(`/?renderer=webgl2&profile=weak&adapt=off${labs ? "&labs=1" : ""}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.player.camera.setTurntable(false));
  await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
  await page.waitForFunction((id) => window.__splashery.player.toyInfo?.id === id, id);
  await page.waitForTimeout(800);
}

// Whether a tap where a recipe point shows finds the toy (the app's own pick).
const picks = (page, p) =>
  page.evaluate(async (p) => {
    const { player } = window.__splashery;
    const [x, y] = player.screenPoint(p);
    player.pickDirty = true;
    return !!(await player.pickAt(x, y));
  }, p);

const blank = () => ({ parts: {}, glow: [1, 1, 1, 0], amount: 1, grow: 1, cues: [], fx: {}, tokens: null }); // prettier-ignore

test("storm cloud: the tapped bolt strikes under the tap", () => {
  const r = ELEMENTS["storm-cloud"];
  const at = (point) => {
    const out = blank();
    r.drive(1, { rain: 0.7, thunder: 0.9 }, out, { time: 1, tap: { n: 1, key: "thunder", point } }); // prettier-ignore
    return out.parts.bolt3;
  };
  const left = at([-0.6, -0.4, 0.4]);
  const right = at([0.7, -0.4, 0.4]);
  expect(left.visible).toBe(1);
  // The bolt hangs at x = 0.1 at rest; it moves to the tap's x (and z, so it stands in front).
  expect(left.offset[0]).toBeCloseTo(-0.7, 5);
  expect(right.offset[0]).toBeCloseTo(0.6, 5);
  expect(left.offset[1]).toBe(0);
  // The Play button (no point) strikes where it always did.
  expect(at(null).offset).toEqual([0, 0, 0]);
});

test("shield: the blow lands where the tap lands", () => {
  const r = MEDIEVAL.shield;
  const hit = [0.48, 0.66, 0.2];
  const run = (point) => {
    const out = blank();
    r.drive(1, { block: 0.95 }, out, { time: 1, tap: { n: 1, key: "block", point }, data: { hit } }); // prettier-ignore
    return out;
  };
  const low = run([-0.3, -0.6, 0.15]);
  expect(low.parts.flash.offset.map((v) => +v.toFixed(3))).toEqual([-0.78, -1.26, -0.05]);
  expect(low.parts.sparks.offset).toEqual(low.parts.flash.offset);
  // It rocks away from the blow: a hit at the lower left turns it about an axis
  // pointing up and to the right... (-y, x) of the hit.
  const top = run([0, 0.8, 0.2]);
  const bottom = run([0, -0.9, 0.2]);
  expect(Math.sign(top.body.quat[0])).toBe(-Math.sign(bottom.body.quat[0]));
  expect(run(null).parts.flash.offset).toEqual([0, 0, 0]);
});

test("splat field: a second tap adds a pulse beside the first, never pausing", async () => {
  const r = LAB["splat-field"];
  expect(r.controls.find((c) => c.key === "pulse").pausable).toBe(false);
  const c = { pulse: 0 };
  let time = 0;
  const frame = (tap) => {
    const out = blank();
    r.drive(time, c, out, { time, tap });
    return out;
  };
  const a = { n: 1, key: "pulse", point: [-0.4, 0, 0.3], time: 0 };
  c.pulse = 1;
  for (let i = 0; i < 30; i++) {
    time += 1 / 30;
    c.pulse -= 1 / 90;
    frame(a);
  }
  // A second tap somewhere else: the newest stone rides on the morph, the first on a token.
  const b = { n: 2, key: "pulse", point: [0.45, 0, -0.2], time };
  c.pulse = 1;
  time += 1 / 30;
  frame(b);
  time += 1 / 30;
  c.pulse -= 1 / 90;
  const out = frame(b);
  expect(out.morph.slice(1)).toEqual([0.45, -0.2, 1]);
  expect(out.tokens).toHaveLength(1);
  expect(out.tokens[0].offset).toEqual([-0.4, 0, 0.3]);
  expect(out.tokens[0].visible).toBeGreaterThan(0.3);
  expect(out.tokens[0].visible).toBeLessThan(0.4);
  // Once the first has run its three seconds, it is gone.
  for (let i = 0; i < 70; i++) {
    time += 1 / 30;
    c.pulse -= 1 / 90;
    frame(b);
  }
  expect(frame(b).tokens).toBeNull();
});

test("fireworks: rapid taps launch more shells at once, and a tap never pauses", () => {
  const r = HOLIDAYS.fireworks;
  expect(r.controls[0].pausable).toBe(false);
  const c = { launch: 0 };
  let n = 0;
  let tap = null;
  let most = 0;
  for (let f = 0; f < 90; f++) {
    const time = f / 30;
    if (f % 10 === 0 && n < 3) {
      tap = { n: ++n, key: "launch", time, point: null };
      c.launch = 1;
    } else c.launch = Math.max(0, c.launch - 1 / 30 / 3.4);
    const out = blank();
    r.drive(time, c, out, { time, tap });
    const bursts = Object.entries(out.parts).filter(([k, v]) => /^b\d\d$/.test(k) && v.visible > 0); // prettier-ignore
    most = Math.max(most, bursts.length);
  }
  expect(most).toBe(3);
});

test("paper lantern: a tap mid-swing pushes it again, without a jump or a pause", () => {
  const r = HOLIDAYS["paper-lantern"];
  expect(r.controls[0].pausable).toBe(false);
  const c = { swing: 0 };
  let last = null;
  let biggest = 0;
  for (let f = 0; f < 300; f++) {
    const t = f / 30;
    if (f === 30 || f === 90) c.swing = 1;
    else c.swing = Math.max(0, c.swing - 1 / 30 / 4);
    const out = blank();
    r.drive(t, c, out, { time: t });
    const q = out.parts.lantern.quat;
    if (last) biggest = Math.max(biggest, Math.hypot(...q.map((v, i) => v - last[i])));
    last = q;
  }
  // Frame to frame it turns smoothly (a jump would be a big step).
  expect(biggest).toBeLessThan(0.03);
});

test("puzzle cube: a tap pauses a scramble after the turn in progress, a hand move ends it", () => {
  const r = PLAYTHINGS["puzzle-cube"];
  const c = { twist: 0 };
  let n = 0;
  let time = 0;
  const frame = (tap = false) => {
    time += 1 / 30;
    if (tap) {
      n++;
      c.twist = 1;
    } else c.twist = Math.max(0, c.twist - 1 / 30 / 4);
    const out = blank();
    r.drive(time, c, out, { time, tap: n ? { n, key: "twist", time } : null });
    return out;
  };
  frame();
  frame(true);
  for (let i = 0; i < 40; i++) frame();
  frame(true); // pause mid-turn
  for (let i = 0; i < 30; i++) frame();
  const held = r.cube.turns();
  expect(held).toBeGreaterThan(0);
  expect(held).toBeLessThan(14);
  // Every cubie sits square: the turn in progress landed.
  const square = (q) => q.every((v) => [0, 0.5, Math.SQRT1_2, 1].some((w) => Math.abs(Math.abs(v) - w) < 1e-6)); // prettier-ignore
  expect(frame().tokens.every((t) => square(t.quat))).toBe(true);
  for (let i = 0; i < 30; i++) frame();
  expect(r.cube.turns()).toBe(held);
  // The cube can be turned by hand while paused; a move of one's own ends the scramble.
  expect(r.drag.at()).toBe(true);
  r.drag.start([1.5, 1.5, 0.2]);
  r.drag.move([1.5, 1.5, -1.2]);
  r.drag.end(time);
  for (let i = 0; i < 20; i++) frame();
  const after = r.cube.turns();
  // The next tap starts afresh from here: a solve (the cube isn't solved), which ends solved.
  frame(true);
  for (let i = 0; i < 150; i++) frame();
  expect(after).toBeGreaterThan(0);
  expect(r.cube.solved()).toBe(true);
  // A tap without a move of one's own carries on from where it paused.
  frame(true);
  for (let i = 0; i < 40; i++) frame();
  frame(true);
  for (let i = 0; i < 20; i++) frame();
  const mid = r.cube.turns();
  frame(true);
  for (let i = 0; i < 150; i++) frame();
  expect(r.cube.turns()).toBeGreaterThan(mid);
  expect(r.cube.solved()).toBe(false);
});

test("Gaussian splatting, one splat: a tap trains it from a guess to the target", () => {
  const r = SPLATTING["gaussian-splatting"];
  const drive = (p) => {
    const out = blank();
    out.morph = null;
    r.drive(1, { play: 1 - p, turn: 0.15 }, out, { time: 1, tap: null });
    return out;
  };
  // The view the recipe drives is the one it built last; drive the one-splat view.
  r.build({ part: () => ({}), cloud() {}, reach() {}, add() {}, count: 1000 }, { view: "one" }); // prettier-ignore
  const guess = drive(0.09);
  const mid = drive(0.5);
  const near = drive(0.9);
  // Each parameter's error falls step by step: the place, the sizes (morph) and the look.
  const far = (o) => Math.hypot(...o.parts.splat.offset);
  expect(far(guess)).toBeGreaterThan(far(mid));
  expect(far(mid)).toBeGreaterThan(far(near));
  expect(guess.morph[0]).toBeGreaterThan(mid.morph[0]);
  expect(mid.morph[0]).toBeGreaterThan(near.morph[0]);
  expect(guess.parts.guess.visible).toBeGreaterThan(mid.parts.guess.visible);
  // The target shows while it learns, and at rest it is the target again.
  expect(mid.parts.target.visible).toBe(1);
  const rest = drive(1);
  expect(rest.morph[0]).toBe(0);
  expect(rest.parts.target.visible).toBe(0);
  expect(rest.parts.splat.visible).toBe(1);
  expect(rest.parts.guess.visible).toBe(0);
});

test("taps that used to miss: the one splat's corners and the sunglasses' lenses", async ({
  page,
}) => {
  test.setTimeout(300_000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page, "gaussian-splatting");
  await page.evaluate(() => window.__splashery.app.setToyOption("view", "one"));
  await page.waitForFunction(() => window.__splashery.player.toyInfo?.pickAlpha === 0.012);
  await page.waitForTimeout(800);
  // Anywhere on the toy: the middle, beside the splat and in a corner of the grid.
  for (const p of [[0, 0, 0], [1.6, 1.4, -1.2], [-2.1, -2.0, -1.2]]) expect(await picks(page, p), p.join()).toBe(true); // prettier-ignore
  await page.screenshot({ path: path.join(SHOTS, "fx7-one-splat-390x844.png") });
  await open(page, "sunglasses");
  for (const x of [-0.3, 0.3]) expect(await picks(page, [x, 0, 0.68]), `lens at ${x}`).toBe(true);
  await page.screenshot({ path: path.join(SHOTS, "fx7-sunglasses-390x844.png") });
  expect(errors).toEqual([]);
});

test("the splat field's ocean takes two stones at once, in the browser", async ({ page }) => {
  test.setTimeout(300_000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page, "splat-field", { labs: true });
  await page.evaluate(() => window.__splashery.app.setToyOption("program", "ocean"));
  await page.waitForFunction(() => window.__splashery.player.proc?.ctx && window.__splashery.player.toyInfo?.id === "splat-field"); // prettier-ignore
  await page.waitForTimeout(1000);
  const r = await page.evaluate(async () => {
    const { player } = window.__splashery;
    const tf = player.motion.ctx.transform;
    const w = (p) => p.map((v, i) => (v - tf.center[i]) * tf.scale);
    const a = player.act(w([-0.4, 0, 0.3]));
    await new Promise((res) => setTimeout(res, 700));
    const b = player.act(w([0.45, 0, -0.2]));
    await new Promise((res) => setTimeout(res, 300));
    return { a: !!a.paused, b: !!b.paused, tokens: player.motion.out?.tokens?.length ?? 0 };
  });
  expect(r).toEqual({ a: false, b: false, tokens: 1 });
  await page.screenshot({ path: path.join(SHOTS, "fx7-ocean-390x844.png") });
  expect(errors).toEqual([]);
});

test("lane Fix7 screenshots at 1440x900", async ({ page }) => {
  test.setTimeout(300_000);
  fs.mkdirSync(SHOTS, { recursive: true });
  await open(page, "shield", { size: [1440, 900] });
  await page.evaluate(() => {
    const { player } = window.__splashery;
    const tf = player.motion.ctx.transform;
    player.act([-0.3, -0.5, 0.15].map((v, i) => (v - tf.center[i]) * tf.scale));
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(SHOTS, "fx7-shield-1440x900.png") });
  await open(page, "fireworks", { size: [1440, 900] });
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.__splashery.player.act(null));
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(SHOTS, "fx7-fireworks-1440x900.png") });
});

// Lane E6a's own checks (docs/OPERATING.md): the twenty balls' throws and
// bounces. tests/taps.spec.mjs already plays every finished toy's tap through
// and compares its end with the rest pose; these add what is special to the
// balls: each plan comes back to rest exactly (place and turn), stays in
// view and above the floor, keeps the ball its size at rest, and its sound's
// later layers land on the plan's own moments.

import { test, expect } from "@playwright/test";
import { buildRecipe } from "../src/kit.js";
import { TOY_SOUNDS } from "../src/toy-sounds.js";

const BALLS = [
  "basketball",
  "soccer-ball",
  "tennis-ball",
  "baseball",
  "softball",
  "beach-ball",
  "golf-ball",
  "volleyball",
  "water-polo-ball",
  "ping-pong-ball",
  "cricket-ball",
  "bowling-ball",
  "pool-ball",
  "pickleball",
  "dodgeball",
  "medicine-ball",
  "lacrosse-ball",
  "squash-ball",
  "bouncy-ball",
  "marble",
];
// How far from home a ball goes, where it is more than its usual step
// aside: throws away into the distance (in view by perspective) and the
// marble's circle; and the ball that dips below its resting height (it
// floats).
const FAR = { baseball: 4, softball: 4, "bowling-ball": 4, marble: 2.1 };
const FLOATS = new Set(["water-polo-ball"]);
const KEEP = {
  "american-football": "pass",
  "rugby-ball": "kick",
  "hockey-puck": "shoot",
  shuttlecock: "hit",
  "flying-disc": "throw",
};

async function recipes() {
  return (await import("../src/packs/balls.js")).RECIPES;
}

test("every new ball has its own throw, a pulse that lasts its plan", async () => {
  const R = await recipes();
  for (const id of BALLS) {
    const r = R[id];
    const ctl = r.controls?.find((c) => c.key === r.action?.key);
    expect(ctl?.type, id).toBe("pulse");
    expect(r.plan, id).toBeTruthy();
    expect(ctl.ease, id).toBeGreaterThan(r.plan.T);
    expect(r.plan.T, `${id} lasts 1.3 to 5 s`).toBeGreaterThan(1.3);
    expect(r.plan.T, `${id} lasts 1.3 to 5 s`).toBeLessThan(5);
  }
  // The balls the owner kept are as they were.
  for (const [id, key] of Object.entries(KEEP)) expect(R[id].action.key, id).toBe(key);
});

test("each plan ends exactly where and as the ball rests, and stays in view", async () => {
  const R = await recipes();
  const failures = [];
  for (const id of BALLS) {
    const P = R[id].plan;
    const last = P.segs[P.segs.length - 1];
    if (last.p1.some((v) => Math.abs(v) > 1e-6)) failures.push(`${id}: ends away from home`);
    if (Math.abs(last.q1[3]) < 1 - 1e-9) failures.push(`${id}: ends turned`);
    const far = FAR[id] ?? 1.2;
    const low = FLOATS.has(id) ? -0.4 : -1e-6;
    for (let e = 0; e < P.T; e += 0.01) {
      const { p, q, squash } = P.at(e);
      const at = `${id} at ${e.toFixed(2)} s`;
      if (![...p, ...q, squash].every(Number.isFinite)) failures.push(`${at}: not finite`);
      if (p[1] < low) failures.push(`${at}: below the floor`);
      if (p[1] > 0.9) failures.push(`${at}: out of view above`);
      if (Math.hypot(p[0], p[2]) > far) failures.push(`${at}: too far away`);
      if (Math.abs(squash) > 0.45) failures.push(`${at}: squashed too far`);
    }
  }
  expect(failures).toEqual([]);
});

test("at rest a ball shows as it always did: nothing turned, moved or hidden", async () => {
  const R = await recipes();
  for (const id of BALLS) {
    const r = R[id];
    const c = Object.fromEntries(r.controls.map((x) => [x.key, 0]));
    const out = { parts: {}, glow: [1, 1, 1, 0], cues: [], morph: null, body: null };
    r.drive(1, c, out, { time: 1, R: 1, tap: null, data: {} });
    const ball = out.parts.ball;
    expect(ball.quat, id).toEqual([0, 0, 0, 1]);
    expect(ball.offset, id).toEqual([0, 0, 0]);
    expect(ball.visible, id).toBe(1);
    expect(ball.cull, id).toBeFalsy();
    expect(out.body?.squash ?? 0, id).toBe(0);
    for (const m of out.morph || []) expect(m, id).toBe(0);
    expect(out.glow[3], id).toBe(0);
  }
});

test("the moving parts leave each ball its size at rest", async () => {
  // Effect pieces (the fingertip, splash, ripples, dust) are built inside
  // the ball and spread by their parts, so the fit is the ball's own.
  const R = await recipes();
  for (const id of BALLS) {
    const r = R[id];
    const options = Object.fromEntries((r.options || []).map((o) => [o.key, o.default]));
    const it = buildRecipe(r, { seed: 5, count: 8000, options }, () => {});
    let b = it.next();
    while (!b.done) b = it.next();
    const { scale } = b.value.kit.transform;
    // (a tennis ball's fuzz and a dark ball's faint rim reach a little
    // beyond it)
    expect(scale, `${id} is fitted by its own ball`).toBeGreaterThan(0.95 / 1.05);
  }
});

test("each ball's sound lands on its own moments", async () => {
  // The tap's sound plays at the tap; a layer that starts later must start
  // with a leg of the plan (a hit, a crack, a splash), and the sound as a
  // whole is short.
  const R = await recipes();
  for (const id of BALLS) {
    const spec = TOY_SOUNDS[id];
    expect(spec, id).toBeTruthy();
    const layers = Array.isArray(spec) ? spec : [spec];
    const starts = R[id].plan.segs.map((s) => s.t0);
    for (const l of layers) {
      if (!(l.at > 0.05)) continue;
      const near = Math.min(...starts.map((t) => Math.abs(t - l.at)));
      expect(near, `${id}: a layer at ${l.at} s starts with a leg`).toBeLessThan(0.03);
      expect(l.at, id).toBeLessThan(4.5);
    }
  }
});

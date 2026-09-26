// Lane E6a's own checks (docs/OPERATING.md): the twenty balls' throws and
// bounces. tests/taps.spec.mjs already plays every finished toy's tap through
// and compares its end with the rest pose; these add what is special to the
// balls: each plan comes back to rest exactly (place and turn), stays in
// view and above the floor, keeps the ball its size at rest, and its sound's
// later layers land on the plan's own moments.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
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

test("a glossy ball spins as an unlit copy under a fixed light, and only while it moves", async () => {
  const R = await recipes();
  for (const id of ["pool-ball", "cricket-ball", "baseball", "softball"]) {
    const r = R[id];
    const key = r.action.key;
    const at = (v) => {
      const out = { parts: {}, glow: [1, 1, 1, 0], cues: [], morph: null, body: null };
      r.drive(1, { [key]: v }, out, { time: 1, R: 1, tap: null, data: {} });
      return out.parts;
    };
    const rest = at(0);
    expect([rest.ball.visible, rest.spin.visible, rest.light.visible], id).toEqual([1, 0, 0]);
    const mid = at(0.6);
    expect(mid.ball.visible, id).toBe(0);
    expect(mid.spin.visible, id).toBeGreaterThan(0);
    expect(mid.light.visible, id).toBe(1);
    expect(mid.light.quat, `${id}: the light does not turn`).toBeUndefined();
  }
});

// Screenshots of two effects at their fullest, with the clock stepped by
// hand so the moment is exact (as tools/effect-clip.mjs does).
const SHOTS = path.resolve("tests/screenshots");
async function effectShot(browser, { id, label, at, viewport, name, mobile }) {
  const ctx = await browser.newContext({ viewport, hasTouch: !!mobile, isMobile: !!mobile });
  const page = await ctx.newPage();
  const problems = [];
  page.on("pageerror", (e) => problems.push(e.message));
  await page.goto("/?renderer=webgl2&profile=weak");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
  await expect(page.locator("#toy-status")).toHaveText(new RegExp(`^${label}`), {
    timeout: 180_000,
  });
  await page.waitForTimeout(1500);
  await page.evaluate(async (at) => {
    const { player } = window.__splashery;
    player.opts.idleDelay = 1e9;
    player.idle.weight = 0;
    const stage = player.stage;
    const handlers = stage.updateHandlers.slice();
    let pending = 0;
    stage.updateHandlers.length = 0;
    stage.updateHandlers.push(() => {
      const d = pending;
      pending = 0;
      for (const h of handlers) h(d);
    });
    player.camera.cur = { ...player.camera.home };
    player.camera.tgt = { ...player.camera.home };
    // Let the splat sort (on a worker) catch up with the home view first.
    for (let i = 0; i < 20; i++) {
      await stage.captureFrame();
      await new Promise((r) => setTimeout(r, 50));
    }
    player.act(null);
    for (let t = 0; t < at; t += 1 / 30) {
      pending = 1 / 30;
      await stage.captureFrame();
    }
    pending = 0;
    await stage.captureFrame();
  }, at);
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, name) });
  await ctx.close();
  expect(problems).toEqual([]);
}

test("e6a screenshots at 1440x900 and 390x844", async ({ browser }) => {
  const desk = { width: 1440, height: 900 };
  const phone = { width: 390, height: 844 };
  const shots = [
    { id: "basketball", label: "Basketball", at: 2.7, name: "e6a-fingertip" },
    { id: "pool-ball", label: "Pool ball", at: 0.9, name: "e6a-draw-shot" },
  ];
  for (const s of shots) {
    await effectShot(browser, { ...s, viewport: desk, name: `${s.name}-1440x900.png` });
    await effectShot(browser, { ...s, viewport: phone, mobile: true, name: `${s.name}-390x844.png` }); // prettier-ignore
  }
});

// Lane Any pose (engine): tap effects in the toy's own frame, in any pose
// (src/effects-pose.js and the pose lines of the effect shader).

import { test, expect } from "@playwright/test";
import { NO_POSE, poseFrame, poseUniforms, poseGravity } from "../src/effects-pose.js";
import { MODIFIER, MODIFIER_KIT, MODIFIER_RIG } from "../src/effects.js";
import { quat, v3 } from "../src/physics/world.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";
const close = (a, b, eps = 1e-9) => a.every((v, i) => Math.abs(v - b[i]) < eps);

test("no pose: the pose uniforms are off and nothing else changes", () => {
  const u = { uSpPoke0: [1, 2, 3, 4], uSpCam: [0, 0, 5, 3], uSpWind: [1, 0, 0, 1] };
  const before = JSON.stringify(u);
  poseUniforms(u, null);
  expect(u.uSpPoseT[3]).toBe(0);
  for (const k of Object.keys(NO_POSE)) expect(u[k]).toEqual(NO_POSE[k]);
  for (const [k, v] of Object.entries(JSON.parse(before))) expect(u[k]).toEqual(v);
});

test("a pose: world points and directions go into the toy's home frame", () => {
  const pose = {
    pivot: [0.2, -0.1, 0.3],
    q: quat.axisAngle([0.3, 1, 0.2], 0.9),
    t: [0.5, 0.2, -0.4],
  };
  const f = poseFrame(pose);
  // The shader's own pose: x' = Q (x - c) + c + t, and its inverse.
  const world = (p) =>
    v3.add(v3.add(quat.rotate(pose.q, v3.sub(p, pose.pivot)), pose.pivot), pose.t);
  const p = [0.7, 0.05, -0.25];
  expect(close(f.toWorld(p), world(p))).toBe(true);
  expect(close(f.toHome(world(p)), p)).toBe(true);
  const poke = world([0.1, 0.4, 0.2]);
  const cam = world([0, 0.3, 4]);
  const wind = quat.rotate(pose.q, [1, 0, 0]);
  const u = {
    uSpPoke0: [...poke, 7],
    uSpCam: [...cam, 3],
    uSpWind: [...wind, 0.5],
    uSpGrabD: [...quat.rotate(pose.q, [0, 0.2, 0]), 1],
  };
  poseUniforms(u, pose, { axis: quat.rotate(pose.q, [0, 1, 0]), point: world([0, -0.9, 0]), amount: 0.3 }); // prettier-ignore
  expect(close(u.uSpPoke0.slice(0, 3), [0.1, 0.4, 0.2])).toBe(true);
  expect(u.uSpPoke0[3]).toBe(7); // the poke's start time is kept
  expect(close(u.uSpCam.slice(0, 3), [0, 0.3, 4])).toBe(true);
  expect(close(u.uSpWind.slice(0, 3), [1, 0, 0])).toBe(true);
  expect(close(u.uSpGrabD.slice(0, 3), [0, 0.2, 0])).toBe(true);
  expect(close(u.uSpBodyS, [0, 1, 0, 0.3])).toBe(true);
  expect(close(u.uSpBodyP.slice(0, 3), [0, -0.9, 0])).toBe(true);
  // The world's up, in the home frame.
  expect(close(u.uSpPoseUp.slice(0, 3), quat.rotate(quat.conj(pose.q), [0, 1, 0]))).toBe(true);
  expect(u.uSpPoseT[3]).toBe(1);
});

test("space and other shelves without a real down keep what rises or falls in the toy's frame", () => {
  const pose = { pivot: [0, 0, 0], q: [0, 0, Math.SQRT1_2, Math.SQRT1_2], t: [0, 0, 0] };
  expect(poseUniforms({}, pose, null, false).uSpPoseUp).toEqual([0, 1, 0, 0]);
  expect(poseUniforms({}, pose, null, true).uSpPoseUp[0]).toBeCloseTo(1, 9);
  expect(poseGravity({ recipe: {} }, { category: "space" })).toBe(false);
  expect(poseGravity({ recipe: {} }, { category: "weather" })).toBe(true);
  expect(poseGravity({ recipe: { gravity: true } }, { category: "space" })).toBe(true);
});

test("every shader variant takes centers into the home frame and back, and turns", () => {
  for (const m of [MODIFIER, MODIFIER_KIT, MODIFIER_RIG]) {
    for (const code of [m.glsl, m.wgsl]) {
      expect(code).toContain("spPoseIn(");
      expect(code).toContain("spPoseOut(p)");
      expect(code).toContain("uSpPoseUp");
    }
  }
  // Rising and falling kit splats follow the world's real up.
  expect(MODIFIER_KIT.glsl).toContain("p -= gup * c * an.z * R;");
  expect(MODIFIER_KIT.wgsl).toContain("p = p - gup * c * an.z * R;");
});

test("a toy posed in Hands-on gets the pose uniforms; put back, they are off", async ({ page }) => {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  const r = await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    await app.chooseToy("heart");
    player.opts.idleDelay = 1e9;
    const get = (k) => {
      const v = player.stage.toy.entity.gsplat.getParameter(k);
      return Array.from(v?.data ?? v ?? []);
    };
    player.update(1 / 60);
    const home = get("uSpPoseT");
    const s = Math.SQRT1_2;
    player.stage.setToyPose({ pivot: player.toyInfo.center, q: [0, 0, s, s], t: [0, 0.1, 0] });
    player.update(1 / 60);
    const posed = { t: get("uSpPoseT"), q: get("uSpPoseQ"), up: get("uSpPoseUp"), about: player.motion.poseUp }; // prettier-ignore
    player.stage.setToyPose(null);
    player.update(1 / 60);
    return { home, posed, back: get("uSpPoseT"), fix: player.motion.handsFix, aboutBack: player.motion.poseUp }; // prettier-ignore
  });
  expect(r.home[3]).toBe(0);
  expect(r.posed.t[3]).toBe(1);
  expect(r.posed.q[2]).toBeCloseTo(Math.SQRT1_2, 5);
  // On its side (a quarter turn about z), the world's up is the toy's +x.
  expect(r.posed.up[0]).toBeCloseTo(1, 5);
  // A recipe's drive gets the same up as about.up while posed, and none upright.
  expect(r.posed.about[0]).toBeCloseTo(1, 5);
  expect(r.aboutBack).toBe(null);
  expect(r.back[3]).toBe(0);
  expect(r.fix ?? null).toBe(null);
});

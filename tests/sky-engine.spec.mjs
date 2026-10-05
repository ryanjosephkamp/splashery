// Lane Night sky's engine hook (docs/handoff/NightSky.md): a toy seen from
// inside. A recipe's `inside: { fov }` puts the camera at the toy's center,
// looking out the way the orbit camera would look in, with its own field of
// view; every other toy keeps the orbit camera and the usual 38 degrees.

import { test, expect } from "@playwright/test";
import { OrbitCamera } from "../src/camera.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const near = (a, b, eps = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) < eps);

test("from inside, the camera stands at the target and looks out along the orbit's back", () => {
  const cam = new OrbitCamera({ reducedMotion: true });
  cam.fit(1);
  cam.setState({ yaw: 0.4, pitch: 0.3, distance: 5 }, { asHome: true });
  const orbit = cam.pose();
  expect(orbit.fov).toBeUndefined();
  cam.setInside({ fov: 70 });
  const inside = cam.pose();
  expect(near(inside.position, [0, 0, 0])).toBe(true);
  // It looks the other way from the orbit camera, so up the sky for a positive pitch.
  expect(
    near(
      inside.forward,
      orbit.forward.map((v) => -v),
    ),
  ).toBe(true);
  expect(inside.forward[1]).toBeGreaterThan(0);
  expect(near(inside.up, orbit.up)).toBe(true);
  expect(
    near(
      inside.right,
      orbit.right.map((v) => -v),
    ),
  ).toBe(true);
  expect(inside.fov).toBeCloseTo(70, 6);
  // A pinch (the distance) scales the field of view, within 10 to 120 degrees.
  cam.zoomBy(0.5);
  cam.cur = { ...cam.tgt };
  expect(cam.pose().fov).toBeCloseTo(35, 6);
  cam.zoomBy(0.01);
  cam.cur = { ...cam.tgt };
  expect(cam.pose().fov).toBeGreaterThanOrEqual(10);
  // A pan never moves the view off the center.
  cam.panBy(200, 100);
  expect(near(cam.pose().position, [0, 0, 0])).toBe(true);
  // null brings the orbit back.
  cam.setInside(null);
  expect(cam.inside).toBe(null);
  expect(cam.pose().fov).toBeUndefined();
});

test("the stage takes the inside field of view, and a toy without inside gets the orbit and 38 degrees back", async ({
  page,
}) => {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  // A toy fully open first, so its own load can't reset the camera under the test.
  await page.evaluate(() => window.__splashery.app.chooseToy("beach-ball"));
  await page.evaluate(() => {
    const { player } = window.__splashery;
    player.camera.setInside({ fov: 80 });
    player.stage.requestRender();
  });
  // Headless frames are slow: wait for the stage to draw with the new lens.
  await expect
    .poll(() => page.evaluate(() => window.__splashery.player.stage.cameraEntity.camera.fov), {
      timeout: 30_000,
    })
    .toBeCloseTo(80, 3);
  const a = await page.evaluate(() => ({
    fov: window.__splashery.player.stage.cameraEntity.camera.fov,
    pos: window.__splashery.player.camera.pose().position,
  }));
  await page.evaluate(() => window.__splashery.app.chooseToy("tennis-ball"));
  await expect
    .poll(() => page.evaluate(() => window.__splashery.player.stage.cameraEntity.camera.fov), {
      timeout: 30_000,
    })
    .toBeCloseTo(38, 6);
  const got = { a, b: await page.evaluate(() => ({ inside: window.__splashery.player.camera.inside, fov: window.__splashery.player.stage.cameraEntity.camera.fov })) }; // prettier-ignore
  expect(got.a.fov).toBeCloseTo(80, 3);
  expect(got.b.inside).toBe(null);
  expect(got.b.fov).toBeCloseTo(38, 6);
});

test("a part culled below its level plane packs its visibility as -w - 10; the old cull is unchanged", async () => {
  const { packParts } = await import("../src/motion.js");
  const parts = [
    { name: "body", pivot: [0, 0, 0] },
    { name: "a", pivot: [0, 0, 0] },
    { name: "b", pivot: [0, 0, 0] },
    { name: "c", pivot: [0, 0, 0] },
  ];
  const data = packParts(new Float32Array(16 * 12), parts, { a: { cull: "below" }, b: { cull: true, visible: 0.5 }, c: { cull: "below", visible: 0 } }, 1); // prettier-ignore
  expect(data[1 * 12 + 11]).toBe(-11);
  expect(data[2 * 12 + 11]).toBe(-1.5);
  expect(data[3 * 12 + 11]).toBe(-10);
  expect(data[0 * 12 + 11]).toBe(1);
});

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
  const got = await page.evaluate(async () => {
    const { player, app } = window.__splashery;
    const wait = () => new Promise((r) => setTimeout(r, 400));
    player.camera.setInside({ fov: 80 });
    player.stage.requestRender();
    await wait();
    const lens = player.stage.cameraEntity.camera;
    const a = { fov: lens.fov, pos: player.camera.pose().position };
    await app.chooseToy("beach-ball");
    await wait();
    return { a, b: { inside: player.camera.inside, fov: lens.fov } };
  });
  expect(got.a.fov).toBeCloseTo(80, 3);
  expect(got.b.inside).toBe(null);
  expect(got.b.fov).toBeCloseTo(38, 6);
});

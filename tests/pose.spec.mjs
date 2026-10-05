// Lane Any pose (docs/handoff/AnyPose.md): a sample of toys tapped upright,
// on their side and upside down. Each pose turns the whole toy about the
// camera's line of sight (as Hands-on poses it), so a toy whose effect works
// in its own frame looks exactly like the upright toy turned on the screen,
// frame for frame (tools/pose-measure.js). `err` is how far the posed frames
// differ from the turned upright ones (0..255), above the rendering's noise.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

// A rig scan's parts (the grape's peel), a scan breaking apart (the star cookie), a kit's
// behavior kinds (the heart) and a winged rig (the bee).
const SAMPLE = ["grape", "star-cookie", "heart", "bee"];

test("a sample of toys: the tap plays the same on its side and upside down", async ({ page }) => {
  test.setTimeout(1_200_000);
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  const out = {};
  for (const id of SAMPLE) {
    out[id] = await page.evaluate(
      (o) => import("/tools/pose-measure.js").then((m) => m.measure(o)),
      { id, size: 112 },
    );
  }
  console.log(`poses: ${JSON.stringify(out)}`);
  for (const [id, r] of Object.entries(out)) {
    expect(r.move, `${id} has a visible tap`).toBeGreaterThan(2);
    for (const p of ["side", "down"]) expect(r[p].err, `${id} ${p}`).toBeLessThan(4);
  }
});

// Every toy this lane fixed in its recipe (docs/audits/poses-2026-10.md): turned over, its
// bursts leave through its own opening (gravity: false), and the snow globe and storm cloud thin
// away what would fall out of them, so each plays the same as upright, turned.
const FIXED = ["snow-globe", "storm-cloud", "rocket", "gift-box", "potion-bottle", "tornado", "geyser", "volcano"]; // prettier-ignore

test("the toys fixed in their recipes play the same on their side and upside down", async ({
  page,
}) => {
  test.setTimeout(2_400_000);
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  const out = {};
  for (const id of FIXED) {
    out[id] = await page.evaluate(
      (o) => import("/tools/pose-measure.js").then((m) => m.measure(o)),
      { id, size: 112 },
    );
  }
  console.log(`fixed poses: ${JSON.stringify(out)}`);
  for (const [id, r] of Object.entries(out))
    for (const p of ["side", "down"]) expect(r[p].err, `${id} ${p}`).toBeLessThan(4);
});

test("screenshots: the grape lying on its side, peeling (390x844 and 1440x900)", async ({
  page,
}) => {
  test.setTimeout(600_000);
  for (const [w, hgt] of [
    [390, 844],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width: w, height: hgt });
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(async () => {
      const { app, player } = window.__splashery;
      const { posePreset } = await import("/src/effects-pose.js");
      await app.chooseToy("grape");
      player.opts.idleDelay = 1e9;
      // Set down on its side as a Hands-on toss leaves it, and held there.
      const ho = player.handsOn;
      ho.setOn(true);
      ho.ensure();
      const p = posePreset(ho, "side");
      ho.body.pos = p.pos;
      ho.body.q = p.q;
      ho.moved = true;
      ho.apply();
      ho.step = () => false;
      player.act(null);
      for (let i = 0; i < 50; i++) player.update(1 / 60);
    });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `tests/screenshots/pose-grape-side-${w}x${hgt}.png` });
  }
});

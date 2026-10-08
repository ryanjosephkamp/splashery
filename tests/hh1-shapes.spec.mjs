// Lane Hands-on H1, Shapes (docs/handoff/HandsH1.md): the jelly blob
// stretches like the gummy bear under a finger with the ✋ switch on, and
// wobbles back; it keeps its tap rig (the split).

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

test("jelly blob: a drag stretches it, it wobbles back through rest, and it keeps its split rig", async ({
  page,
}) => {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  const s = await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    await app.chooseToy("blob");
    player.opts.idleDelay = 1e9;
    const R = player.toyInfo.radius;
    const c = player.stage.toScreen(player.toyInfo.center);
    player.grabStart(player.toyInfo.center.slice(), c[0], c[1]);
    for (let k = 1; k <= 10; k++) {
      player.grabAt(c[0] + 8 * k, c[1] - 3 * k);
      player.update(1 / 60);
    }
    for (let i = 0; i < 10; i++) player.update(1 / 60);
    const pulled = Math.hypot(...player.driver.grab.pull) / R;
    player.grabEnd();
    // Back through rest: the pull's sign along the drag flips (a wobble).
    const d = player.driver.grab.pull.slice();
    let flipped = false;
    for (let i = 0; i < 180; i++) {
      player.update(1 / 60);
      const p = player.driver.grab.pull;
      if (p[0] * d[0] + p[1] * d[1] + p[2] * d[2] < 0) flipped = true;
    }
    const back = Math.hypot(...player.driver.grab.pull) / R;
    return {
      own: player.canGrab(),
      hands: player.handsOn.on,
      pulled,
      flipped,
      back,
      tap: !!player.toyInfo.rig || !!player.rig,
    };
  });
  console.log(`blob: ${JSON.stringify(s)}`);
  expect(s.own).toBe(true);
  expect(s.pulled).toBeGreaterThan(0.2);
  expect(s.pulled).toBeLessThan(0.85); // the soft cap: it stays solid
  expect(s.flipped).toBe(true);
  expect(s.back).toBeLessThan(0.02);
  expect(s.tap).toBe(true);
});

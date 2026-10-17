// Based on task 50's camera readiness check. A completed render also refreshes
// PlayCanvas' cached projection before a test turns recipe points into a drag.
export async function settleCamera(page) {
  await page.evaluate(() => window.__splashery.player.camera.setTurntable(false));
  await page.waitForFunction(
    () => {
      const p = window.__splashery?.player;
      const c = p?.camera;
      return (
        c &&
        !p.loading &&
        Math.abs(c.cur.yaw - c.tgt.yaw) +
          Math.abs(c.cur.pitch - c.tgt.pitch) +
          Math.abs(c.cur.roll - c.tgt.roll) +
          Math.abs(c.cur.distance - c.tgt.distance) / (c.tgt.distance || 1) <
          1e-3
      );
    },
    null,
    { timeout: 30_000 },
  );
  await page.evaluate(() => window.__splashery.player.stage.captureFrame());
}

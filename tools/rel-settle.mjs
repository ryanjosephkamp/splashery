// Real elements (lane Elements): draws a few frames after a snapped change, for the side-view
// tools and tests. The app draws only when asked, and the splats are sorted where the previous
// frame's pose put them, so a single frame after a snap shows them sorted in the old pose.
export async function settle(page, frames = 6) {
  await page.evaluate(async (frames) => {
    const { player } = window.__splashery;
    for (let i = 0; i < frames; i++) {
      player.stage.requestRender();
      await new Promise((ok) => requestAnimationFrame(() => setTimeout(ok, 30)));
    }
  }, frames);
  await page.waitForTimeout(150);
}

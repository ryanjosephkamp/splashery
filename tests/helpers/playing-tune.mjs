import { expect } from "@playwright/test";

// Start with a real gesture, then pause through the real button while the
// drawn effect still has future notes. A driver's actionability checks can
// take longer than the entire tune on a busy software renderer.
export async function pausePlayingTune(page, { ringing = false } = {}) {
  await page.evaluate((ringing) => {
    const { player, app } = window.__splashery;
    const stage = player.stage;
    const button = document.querySelector("#toy-action");
    window.__tunePause = null;
    let done = false;
    const observe = () => {
      if (done) return;
      const m = player.motion;
      const s = app.sound;
      const h = s.held.toy;
      if (!h || s.ctx?.state !== "running" || m.effectState() !== "running") return;
      const finish = () => {
        done = true;
        stage.updateHandlers = stage.updateHandlers.filter((fn) => fn !== observe);
      };
      if (h.i >= h.events.length) {
        finish();
        window.__tunePause = {
          error: "The tune exhausted its notes before the drawn pause.",
          cursor: h.i,
          total: h.events.length,
          audioTime: s.ctx.currentTime,
          start: h.start,
          unseen: m.unseen,
        };
        return;
      }
      if (m.unseen !== null || h.i === 0 || button.textContent.trim() !== "Pause") return;
      if (ringing && s.ctx.currentTime <= h.start + h.events[0].t + 0.1) return;
      const effect = () => ({
        v: m.state[m.recipe.action.key],
        state: m.effectState(),
        sched: s.scheduled,
        n: m.tap?.n ?? 0,
        label: button.textContent.trim(),
      });
      const playing = effect();
      const audio = { state: s.ctx.state, t: s.ctx.currentTime, sched: s.scheduled, paused: s.toyPaused }; // prettier-ignore
      const cursor = h.i;
      const total = h.events.length;
      window.__tuneAtPause = h;
      finish(); // detach before dispatching another action
      button.click();
      window.__tunePause = { playing, paused: effect(), audio, cursor, total };
    };
    stage.onUpdate(observe);
  }, ringing);
  await page.click("#toy-action");
  await page.waitForFunction(() => window.__tunePause !== null);
  const phase = await page.evaluate(() => window.__tunePause);
  expect(phase.error, JSON.stringify(phase)).toBeUndefined();
  expect(phase.cursor).toBeGreaterThan(0);
  expect(phase.cursor).toBeLessThan(phase.total);
  return phase;
}

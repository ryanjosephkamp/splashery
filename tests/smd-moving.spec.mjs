// Lane Studio media: Moving photo to 3D's samples. Each one loads and builds, the GIF keeps its
// timing, and a clip plays at the speed of its source (seconds played against seconds of source,
// within 3%, on a slow and a fast tier), with the Toy tab's Speed slider scaling it.

import { test, expect } from "@playwright/test";

const APP = (profile) => `/?renderer=webgl2&adapt=off&profile=${profile}&labs=1`;
const mp = "/src/packs/moving-photo.js";
test.use({ viewport: { width: 390, height: 844 } });

async function open(page, profile, clip) {
  await page.goto(APP(profile));
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("moving-photo-3d"));
  await page.waitForFunction(() => window.__splashery.player.scene.toy.id === "moving-photo-3d" && window.__splashery.player.motion.recipe && document.getElementById("progress").hidden, null, { timeout: 180_000 }); // prettier-ignore
  if (clip) {
    await page.evaluate((c) => window.__splashery.app.setToyOptions({ clip: c }), clip);
    await page.waitForFunction(async ([m, c]) => (await import(m)).MOVING.clip?.sample === c, [mp, clip], { timeout: 120_000 }); // prettier-ignore
  }
}

// Plays the clip for `ms` of real time and returns the seconds of the clip that went by, between
// the moment its position first changed and the moment it last did (it moves a frame at a time, and
// a slow device draws few of them, so the ends are where the position was seen to move).
const played = (page, ms) =>
  page.evaluate(
    async ([m, ms]) => {
      const { MOVING } = await import(m);
      window.__splashery.app.setControl("play", 1);
      const clip = MOVING.clip;
      const t0 = performance.now();
      let last = MOVING.t;
      let total = 0;
      let first = null;
      let at = null;
      while (performance.now() - t0 < ms) {
        await new Promise((r) => setTimeout(r, 10));
        if (MOVING.t === last) continue;
        let d = MOVING.t - last;
        if (d < -clip.duration / 2) d += clip.duration; // it looped
        const now = performance.now();
        if (first === null) first = now;
        else total += d;
        at = now;
        last = MOVING.t;
      }
      return { clip: total, real: first === null ? 0 : (at - first) / 1000, duration: clip.duration, sound: !!clip.audio }; // prettier-ignore
    },
    [mp, ms],
  );

test.describe("the samples", () => {
  test("each sample loads and has the timing of its source", async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto(APP("max"));
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    const r = await page.evaluate(async (m) => {
      const mod = await import(m);
      const out = [];
      for (const s of mod.SAMPLES) {
        const c = await mod.loadSample(s.id);
        out.push({ id: s.id, n: c.n, w: c.w, h: c.h, duration: c.duration, delays: [...new Set(c.delays)], fps: s.fps, frames: s.frames, sound: !!c.audio, gif: !!s.gif, credit: !!(s.title && s.source && s.author && s.license && s.licenseUrl) }); // prettier-ignore
      }
      return out;
    }, mp);
    expect(r.map((s) => s.id)).toEqual(["sample", "horse", "dragon", "bridge", "machine"]);
    for (const s of r) {
      expect(s.n, s.id).toBe(s.frames);
      expect(s.credit, s.id).toBe(true);
      // the frames' own spacing, so the clip is as long as its source (frames over fps)
      expect(s.duration, s.id).toBeCloseTo(s.frames / s.fps, 2);
      expect(s.sound, s.id).toBe(!s.gif);
    }
    // the GIF keeps its delays: 15 frames of a tenth of a second, as the Muybridge GIF has
    const horse = r.find((s) => s.id === "horse");
    expect(horse.delays).toEqual([100]);
    expect(horse.duration).toBeCloseTo(1.5, 2);
  });

  for (const clip of ["sample", "horse", "dragon", "bridge", "machine"]) {
    test(`${clip}: builds and renders on a phone`, async ({ page }) => {
      test.setTimeout(240_000);
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await open(page, "mid", clip);
      const d = await page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.moving);
      expect(d.n).toBeGreaterThan(10);
      expect(d.cols).toBeGreaterThan(50);
      expect(errors).toEqual([]);
    });
  }
});

test.describe("the speed", () => {
  // Seconds played against seconds of source. A device that draws few frames a second (the tests'
  // software renderer on a max-tier scene, about one) shows the clip's position a frame late, so
  // the wall-clock check runs on the low tier, and the fast tier is checked against the clocks the
  // clip follows: a silent clip's own clock (stepped by hand, like tools/live-clip.mjs does) and a
  // video's sound.
  for (const clip of ["sample", "horse", "dragon", "bridge", "machine"]) {
    test(`${clip} on a slow device plays at its source's speed`, async ({ page }) => {
      test.setTimeout(240_000);
      await open(page, "low", clip);
      const r = await played(page, 4000);
      console.log(`${clip} (low): ${r.clip.toFixed(2)} s of the clip in ${r.real.toFixed(2)} s${r.sound ? " (sound)" : ""}`); // prettier-ignore
      expect(Math.abs(r.clip / r.real - 1)).toBeLessThan(0.03);
    });
  }

  test("a silent clip follows its clock exactly on a fast device", async ({ page }) => {
    test.setTimeout(240_000);
    await open(page, "max", "horse");
    const r = await page.evaluate(async (m) => {
      const { MOVING } = await import(m);
      const frame = () => new Promise((res) => { const l = MOVING.last; const f = () => (MOVING.last !== l ? res() : setTimeout(f, 20)); f(); }); // prettier-ignore
      window.__splashery.app.setControl("play", 1);
      window.__clipT = 100;
      await frame();
      await frame();
      const t0 = MOVING.t;
      window.__clipT = 100.9;
      await frame();
      await frame();
      return { moved: MOVING.t - t0, duration: MOVING.clip.duration };
    }, mp);
    expect(((r.moved % r.duration) + r.duration) % r.duration).toBeCloseTo(0.9, 2); // (the 1.5 s clip loops)
  });

  test("a video's sound runs at its source's speed on a fast device", async ({ page }) => {
    test.setTimeout(240_000);
    await open(page, "max", "sample");
    const r = await page.evaluate(async (m) => {
      const { MOVING } = await import(m);
      window.__splashery.app.setControl("play", 1);
      const el = MOVING.clip.audio.track.el;
      const wait = (ms) => new Promise((res) => setTimeout(res, ms));
      // A window that stays inside the clip (it loops at 6 s, and a restart costs a moment).
      for (let tries = 0; tries < 6; tries++) {
        const give = performance.now() + 30_000;
        while (el.paused || el.currentTime < 0.3 || el.currentTime > 3.5) {
          if (performance.now() > give) break;
          await wait(20);
        }
        const a = [el.currentTime, performance.now()];
        await wait(1500);
        const b = [el.currentTime, performance.now()];
        if (b[0] > a[0])
          return { rate: (b[0] - a[0]) / ((b[1] - a[1]) / 1000), lag: Math.abs(MOVING.t - el.currentTime) }; // prettier-ignore
      }
      return { rate: 0, lag: 99 };
    }, mp);
    expect(Math.abs(r.rate - 1)).toBeLessThan(0.03);
    expect(r.lag).toBeLessThan(2.5); // the picture follows the sound, a frame late at most
  });

  test("a video's sound comes back with the loop, even when frames are slow", async ({ page }) => {
    test.setTimeout(240_000);
    await open(page, "max", "sample");
    const r = await page.evaluate(async (m) => {
      const { MOVING } = await import(m);
      window.__splashery.app.setControl("play", 1);
      const el = MOVING.clip.audio.track.el;
      let loops = 0;
      let last = 0;
      const end = performance.now() + 20_000;
      let heard = 0;
      while (performance.now() < end && loops < 1) {
        await new Promise((res) => setTimeout(res, 100));
        if (el.currentTime < last - 3) loops++;
        last = el.currentTime;
      }
      // after the loop the sound plays again
      const a = el.currentTime;
      await new Promise((res) => setTimeout(res, 1500));
      heard = el.currentTime - a;
      return { loops, heard, paused: el.paused };
    }, mp);
    expect(r.loops).toBeGreaterThanOrEqual(1);
    expect(r.paused).toBe(false);
    expect(r.heard).toBeGreaterThan(0.5);
  });

  test("the Toy tab's Speed slider speeds the clip up and slows it down", async ({ page }) => {
    test.setTimeout(240_000);
    await open(page, "low", "horse");
    for (const [speed, rate] of [
      [1, 1.75],
      [0.5, 1],
      [0, 0.25],
    ]) {
      await page.evaluate((s) => window.__splashery.app.setMotion({ speed: s }), speed);
      const r = await played(page, 4000);
      expect(Math.abs(r.clip / r.real / rate - 1), `speed ${speed}`).toBeLessThan(0.08); // (a 1.5 s loop at up to 1.75 times: a frame's lag is a few percent)
    }
  });

  test("the Speed slider changes a video's sound speed too", async ({ page }) => {
    test.setTimeout(240_000);
    await open(page, "low", "dragon");
    await page.evaluate(() => window.__splashery.app.setMotion({ speed: 1 }));
    await page.evaluate(() => window.__splashery.app.setControl("play", 1));
    await page.waitForFunction(async (m) => (await import(m)).MOVING.clip.audio.track.el.playbackRate === 1.75, mp, { timeout: 30_000 }); // prettier-ignore
  });
});

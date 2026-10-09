// Lane Photo sharp view r3 (docs/handoff/PhotoSharpView.md): switching from Sharp picture to Splats
// through a rebuild (setToyOptions with `view` and the Detail choice, right after the toy opens in
// Sharp picture) draws the new splats with no WebGL error. Lane Photo fidelity found it on main after
// #422: "glDrawElementsInstanced: Mismatch between texture format and sampler type" in the splats'
// work-buffer pass. The cause: a frame landing between the build (which reads the saved view) and
// the stage's swap to the new toy turned the old toy's splats back on just before the swap destroyed
// it, so the work-buffer pass drew it once more after its paint texture was gone, and PlayCanvas made
// a stand-in texture in the middle of that draw, on the unit of the pass's sub-draw data. The test
// makes such a frame certain: it runs the relief's sync just before the swap.

import { test, expect } from "@playwright/test";
import { MOVING, MOVING_PHOTO, speedRate } from "../src/packs/moving-photo.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const GL_ERROR = /GL_INVALID|glDraw|sampler type/i;

async function ready(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" || GL_ERROR.test(m.text())) errors.push(m.text());
  });
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  return errors;
}

async function built(page, toy) {
  await page.waitForFunction(
    (t) => {
      const pl = window.__splashery.player;
      return !pl.loading && pl.scene?.toy?.id === t && pl.proc?.ctx?.kit?.data && window.__psv;
    },
    toy,
    { timeout: 180_000 },
  );
}

// Draws n frames, the view turned a little each one so the splats really draw.
async function draw(page, n = 20) {
  await page.evaluate(async (n) => {
    const pl = window.__splashery.player;
    for (let k = 0; k < n; k++) {
      pl.camera.tgt.yaw += 0.003 * (k % 2 ? 1 : -1);
      pl.stage.requestRender();
      await new Promise((r) => requestAnimationFrame(r));
    }
  }, n);
}

// One rebuild with these options, a frame's sync landing between the build and the swap. Returns
// whether the old toy's splats were on at the swap (the swap destroys them).
async function rebuild(page, toy, options) {
  const on = await page.evaluate(async (o) => {
    const { app, player } = window.__splashery;
    const sharp = await import("/src/packs/photo-sharp.js");
    const st = player.stage;
    const setToy = st.setToy;
    let on = null;
    st.setToy = function (...a) {
      st.setToy = setToy;
      sharp.sync();
      on = st.toy?.entity?.gsplat?.enabled ?? null;
      return setToy.apply(this, a);
    };
    await app.setToyOptions(o);
    return on;
  }, options);
  await built(page, toy);
  return on;
}

for (const toy of ["photo-3d", "moving-photo-3d"]) {
  test.describe(toy, () => {
    test.setTimeout(300_000);
    for (const detail of ["splats", "photo"]) {
      test(`Sharp picture to Splats (Detail ${detail}) through a rebuild draws with no WebGL error`, async ({
        page,
      }) => {
        const errors = await ready(page);
        await page.evaluate((t) => window.__splashery.app.chooseToy(t), toy);
        await built(page, toy);
        // It opens in Sharp picture, the splats switched off, and is rebuilt at once (as a test or
        // a quick hand does) with Splats and a Detail. The old toy's splats stay off to the end.
        await page.waitForFunction(() => window.__psv.state().splatsOff, null, { timeout: 60_000 });
        expect(await rebuild(page, toy, { view: "splats", detail })).toBe(false);
        await draw(page);
        let s = await page.evaluate(() => ({ ...window.__psv.state(), gsplat: window.__splashery.player.stage.toy.entity.gsplat.enabled })); // prettier-ignore
        expect(s.on).toBe(false);
        expect(s.splatsOff).toBe(false);
        expect(s.gsplat).toBe(true);
        // and back to Sharp picture and to Splats again, each through a rebuild
        await rebuild(page, toy, { view: "sharp" });
        await page.waitForFunction(() => window.__psv.state().on, null, { timeout: 60_000 });
        await draw(page, 5);
        expect(await rebuild(page, toy, { view: "splats" })).toBe(false);
        await draw(page);
        s = await page.evaluate(() => ({ ...window.__psv.state(), gsplat: window.__splashery.player.stage.toy.entity.gsplat.enabled })); // prettier-ignore
        expect(s.on).toBe(false);
        expect(s.gsplat).toBe(true);
        expect(errors).toEqual([]);
      });
    }
  });
}

// The owner's report of October 9, 2026: "Moving photo to 3D doesn't loop properly when the
// video/GIF ends. It just gets stuck at the end of the clip and plays like the last 0.5 seconds over
// and over again." A frame that came after the sound's last 20 ms found it ended and sent it back to
// the last time shown, a moment before the end, over and over. Each clip plays past its end at least
// twice, at normal speed and at the Speed slider's top (1.75 times), in the default view (Sharp
// picture): the shown time wraps to the start each time, and the frames after it are the clip's
// first ones, not its last half second.
const LOOPS = [
  { name: "a short video with sound", file: "tests/fixtures/psv3/sound.webm", sound: true },
  { name: "a short video without sound", file: "tests/fixtures/psv3/silent.webm" },
  { name: "a GIF", file: "assets/toys/screen/horse.gif" },
];

for (const clip of LOOPS) {
  for (const speed of [0.5, 1]) {
    test(`Moving photo to 3D loops ${clip.name}${speed === 1 ? " at 1.75 times" : ""}`, async ({
      page,
    }) => {
      test.setTimeout(300_000);
      const errors = await ready(page);
      await page.evaluate(() => window.__splashery.app.chooseToy("moving-photo-3d"));
      await built(page, "moving-photo-3d");
      await page.evaluate(async () => (window.__mv = (await import("/src/packs/moving-photo.js")).MOVING)); // prettier-ignore
      await page.setInputFiles("#toy-input-file", clip.file);
      const name = clip.file
        .split("/")
        .pop()
        .replace(/\.[^.]+$/, "");
      await page.waitForFunction((n) => window.__mv.clip?.name === n && !window.__splashery.player.loading, name, { timeout: 120_000, polling: 250 }); // prettier-ignore
      const r = await page.evaluate(async (speed) => {
        const { app } = window.__splashery;
        const m = await import("/src/packs/moving-photo.js");
        const M = window.__mv;
        const c = M.clip;
        app.setMotion({ speed });
        app.setControl("play", 1);
        const rate = m.speedRate(speed);
        const rows = [];
        const end = performance.now() + ((2.7 * c.duration) / rate) * 1000;
        while (performance.now() < end) {
          await new Promise((res) => requestAnimationFrame(res));
          rows.push({ t: M.t, f: M.frame, at: performance.now() });
        }
        return { rows, duration: c.duration, n: c.n, rate, sound: !!c.audio, start: m.frameAt(c, 0.5 * rate) }; // prettier-ignore
      }, speed);
      expect(r.sound).toBe(!!clip.sound || clip.file.endsWith(".webm"));
      // Each wrap: the time drops from near the end to near the start.
      const wraps = [];
      for (let i = 1; i < r.rows.length; i++)
        if (r.rows[i].t < r.rows[i - 1].t - r.duration / 2) wraps.push(i);
      expect(wraps.length, JSON.stringify(r.rows.map((x) => +x.t.toFixed(2)))).toBeGreaterThanOrEqual(2); // prettier-ignore
      for (const i of wraps) {
        expect(r.rows[i].t).toBeLessThan(0.5 * r.rate);
        expect(r.rows[i].f).toBeLessThanOrEqual(r.start);
      }
      // Never more than half a second (of real time) inside the clip's last half second.
      let stay = 0;
      let from = null;
      for (const x of r.rows) {
        if (x.t > r.duration - 0.5 * r.rate) from ??= x.at;
        else from = null;
        if (from !== null) stay = Math.max(stay, x.at - from);
      }
      expect(stay).toBeLessThan(1000);
      expect(errors).toEqual([]);
    });
  }
}

// The same, made certain: Moving photo to 3D's own drive on a device drawing 30 frames a second,
// against a media element that takes 60 ms to seek and stops at its end (paused and ended), as a
// browser's does. On main, a clip whose frames step over the sound's last 20 ms stays a moment before
// its end for good (the owner's "last 0.5 seconds over and over": the video copy follows that time).
function fakeTrack(duration, seek) {
  let ct = 0;
  let until = -1;
  let now = 0;
  const el = {
    paused: true,
    ended: false,
    playbackRate: 1,
    duration,
    get currentTime() {
      return ct;
    },
    set currentTime(v) {
      ct = Math.min(duration, Math.max(0, v));
      el.ended = false;
      until = now + seek;
    },
  };
  return {
    el,
    blocked: false,
    anchor: null,
    get duration() {
      return duration;
    },
    get playing() {
      return !el.paused && !el.ended;
    },
    time: () => ct,
    play() {
      if (el.ended) el.currentTime = 0;
      el.paused = false;
    },
    pause() {
      el.paused = true;
    },
    route() {},
    step(dt) {
      now += dt;
      if (el.paused || el.ended || now < until) return;
      ct += dt * el.playbackRate;
      if (ct >= duration) {
        ct = duration;
        el.ended = el.paused = true;
      }
    },
  };
}

for (const speed of [0.5, 1])
  for (const duration of [2.52, 2.53])
    test(`a clip of ${duration} s with sound loops on a device drawing 30 frames a second${speed === 1 ? ", at 1.75 times" : ""}`, () => {
      const saved = { window: globalThis.window, clip: MOVING.clip, t: MOVING.t };
      const n = 60;
      const tr = fakeTrack(duration, 0.06);
      // (the player as far as the drive asks: the speed, and the silent clock it reads)
      globalThis.window = { __splashery: { player: { scene: { motion: { speed } } } }, __clipT: 0 };
      try {
        MOVING.clip = { duration, n, delays: Array(n).fill((duration * 1000) / n), audio: { track: tr }, video: null }; // prettier-ignore
        MOVING.t = 0;
        MOVING.anchor = null;
        tr.play();
        const rate = speedRate(speed);
        const P = 1 / 30;
        const ts = [];
        for (let time = 0; time < (3.2 * duration) / rate; time += P) {
          tr.step(P);
          globalThis.window.__clipT = time;
          MOVING_PHOTO.drive(time, { play: 1 }, {}, { time });
          ts.push(MOVING.t);
        }
        const wraps = [];
        for (let i = 1; i < ts.length; i++) if (ts[i] < ts[i - 1] - duration / 2) wraps.push(i);
        expect(wraps.length, ts.slice(-8).map((x) => x.toFixed(3)).join(" ")).toBeGreaterThanOrEqual(2); // prettier-ignore
        for (const i of wraps) expect(ts[i]).toBeLessThan(0.15 * rate);
        // and it keeps moving: never more than half a second of frames on one time
        let same = 0;
        let most = 0;
        for (let i = 1; i < ts.length; i++) {
          same = ts[i] === ts[i - 1] ? same + 1 : 0;
          most = Math.max(most, same);
        }
        expect(most * P).toBeLessThan(0.5);
      } finally {
        globalThis.window = saved.window;
        MOVING.clip = saved.clip;
        MOVING.t = saved.t;
      }
    });

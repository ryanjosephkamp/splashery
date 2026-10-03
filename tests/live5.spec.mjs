// Lane Live input r5: Moving photo to 3D plays a video's own sound, its
// frames on that sound's clock, and is sharper (frames sized to the device).
// The fixture is a 3-second test pattern with a 440 Hz tone (made with ffmpeg).

import { test, expect } from "@playwright/test";

const APP = (profile) => `/?renderer=webgl2&adapt=off&profile=${profile}&labs=1`;
const mp = "/src/packs/moving-photo.js";
test.use({ viewport: { width: 390, height: 844 } });

async function open(page, profile = "mid") {
  await page.goto(APP(profile));
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("moving-photo-3d"));
  await page.waitForFunction(() => window.__splashery.player.scene.toy.id === "moving-photo-3d" && window.__splashery.player.motion.recipe && document.getElementById("progress").hidden, null, { timeout: 180_000 }); // prettier-ignore
}

async function until(page, check, arg = null, timeout = 120_000) {
  const end = Date.now() + timeout;
  for (;;) {
    const v = await page.evaluate(check, arg);
    if (v) return v;
    if (Date.now() > end) throw new Error(`Timed out waiting for ${check}`);
    await page.waitForTimeout(250);
  }
}

const state = (page) =>
  page.evaluate(async (m) => {
    const { MOVING } = await import(m);
    const t = MOVING.clip?.audio?.track;
    return { t: MOVING.t, frame: MOVING.frame, audio: !!t, playing: !!t?.playing, sound: t ? t.time() : null, w: MOVING.clip?.w, grid: MOVING.grid }; // prettier-ignore
  }, mp);

test("the sample is sharper on a stronger device and plays with its own sound", async ({
  page,
}) => {
  await open(page, "max");
  const s = await state(page);
  expect(s.w).toBe(640); // the scene's own size (was 256 everywhere)
  expect(s.grid.cols).toBeGreaterThan(600); // as many splats as the budget allows
  expect(s.audio).toBe(true);
  // The colors are sharpened a little: the frame's fine contrast (the mean
  // difference between neighbors) is higher than without.
  const c = await page.evaluate(async (m) => {
    const { MOVING, frameImage } = await import(m);
    const { cols, rows } = MOVING.grid;
    const fine = (px) => {
      let s = 0;
      for (let j = 0; j < rows; j++)
        for (let i = 1; i < cols; i++)
          s += Math.abs(px[(j * cols * 2 + i) * 4 + 1] - px[(j * cols * 2 + i - 1) * 4 + 1]);
      return s / (rows * (cols - 1));
    };
    return {
      plain: fine(frameImage(MOVING.clip, cols, rows, 10, 0)),
      sharp: fine(frameImage(MOVING.clip, cols, rows, 10)),
    };
  }, mp);
  expect(c.sharp).toBeGreaterThan(c.plain * 1.2);
});

test("a video plays with its own sound: the frames follow its clock, pause and scrub take both", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  await page.setInputFiles("#toy-input-file", "tests/fixtures/live5/tone.webm");
  await until(page, async (m) => (await import(m)).MOVING.clip?.name === "tone", mp, 240_000);
  // The sound plays (a tap, if the browser wants one first).
  if (!(await state(page)).playing) await page.evaluate(() => document.getElementById("moving-play").click()); // prettier-ignore
  await until(page, async (m) => (await import(m)).MOVING.clip?.audio?.track?.playing, mp, 30_000);
  // The frames follow the sound's clock: they advance as far as the sound
  // does, and stay within a drawn frame of it (this container's software
  // renderer draws only two or three frames a second).
  await page.evaluate(() => document.getElementById("moving-start").click());
  await page.waitForTimeout(300);
  const s0 = await state(page);
  await page.waitForTimeout(1500);
  const s1 = await state(page);
  const ratio = (s1.t - s0.t) / Math.max(0.01, s1.sound - s0.sound);
  expect(ratio).toBeGreaterThan(0.6);
  expect(ratio).toBeLessThan(1.4);
  expect(Math.abs(s1.t - s1.sound)).toBeLessThan(0.6);
  // Pause holds the sound and the frames.
  await page.evaluate(() => document.getElementById("moving-play").click());
  const a = await state(page);
  await page.waitForTimeout(700);
  const b = await state(page);
  expect(b.playing).toBe(false);
  expect(Math.abs(b.t - a.t)).toBeLessThan(0.05);
  // Scrub moves both.
  await page.evaluate(() => {
    const s = document.getElementById("moving-seek");
    s.value = "500";
    s.dispatchEvent(new Event("input"));
    s.dispatchEvent(new Event("change"));
  });
  const c = await state(page);
  expect(Math.abs(c.t - 1.5)).toBeLessThan(0.2);
  expect(Math.abs(c.sound - 1.5)).toBeLessThan(0.2);
  expect(errors).toEqual([]);
});

// ---- The splat mirror's depth edges (r5) -------------------------------------------
test("the mirror's depth edges cut clean: no cell hangs between the near and far sides", async () => {
  const { snapEdges } = await import("../src/live/relief.js");
  // A person (near, 0.9) before a wall (0.1), the edge ramping over 6 cells
  // as the depth model's smooth guess does.
  const w = 40;
  const h = 10;
  const d = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) d[y * w + x] = 0.1 + 0.8 * Math.min(1, Math.max(0, (x - 17) / 6));
  const out = snapEdges(d, w, h);
  let hang = 0;
  for (const v of out) if (v > 0.15 && v < 0.85) hang++;
  expect(hang).toBe(0);
  // Away from the edge nothing changes.
  expect(out[5 * w + 2]).toBeCloseTo(0.1, 6);
  expect(out[5 * w + 37]).toBeCloseTo(0.9, 6);
});

test("the mirror's background layer shows the wall behind a person, never the person", async () => {
  const { BackPlate, fillHoles } = await import("../src/live/relief.js");
  // A frame of a blue wall with a red person in the middle third, and its
  // depth: the person near (1), the wall far (0).
  const cols = 60;
  const rows = 40;
  const fw = 120;
  const fh = 80;
  const data = new Uint8ClampedArray(fw * fh * 4);
  for (let y = 0; y < fh; y++)
    for (let x = 0; x < fw; x++) {
      const person = x >= 40 && x < 80;
      data.set(person ? [220, 30, 30, 255] : [40, 60, 200, 255], (y * fw + x) * 4);
    }
  const d = new Float32Array(cols * rows);
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) d[y * cols + x] = x >= 20 && x < 40 ? 1 : 0;
  const bp = new BackPlate(30, 20);
  bp.learn({ w: fw, h: fh, data, crop: [0, 0, 1, 1] }, d, cols, rows, false);
  // Behind the person (the middle of the layer): the wall's blue and depth.
  const c = (10 * 30 + 15) * 4;
  expect(bp.vals[c]).toBeLessThan(60); // red
  expect(bp.vals[c + 2]).toBeGreaterThan(180); // blue
  expect(bp.vals[c + 3]).toBeLessThan(0.05); // far
  // A hole in a ramp fills smoothly from both sides.
  const vals = new Float32Array(16);
  const w = new Float32Array(16);
  for (let i = 0; i < 16; i++) {
    vals[i] = i;
    w[i] = i >= 6 && i < 10 ? 0 : 1;
  }
  fillHoles(vals, w, 16, 1, 1);
  for (let i = 6; i < 10; i++) {
    expect(vals[i]).toBeGreaterThan(3);
    expect(vals[i]).toBeLessThan(12);
  }
});

test("the mirror's default depth is gentler", async ({ page }) => {
  await page.goto(APP("mid"));
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("splat-mirror"));
  await page.waitForFunction(() => window.__splashery.player.scene.toy.id === "splat-mirror" && window.__splashery.player.motion.recipe && document.getElementById("progress").hidden, null, { timeout: 180_000 }); // prettier-ignore
  const depth = await page.evaluate(async () => (await import("/src/live/relief.js")).MIRROR.depth);
  expect(depth).toBe(0.5); // was 0.6
  // The still picture has its background layer (the canvas twice as tall);
  // Photo to 3D's live view doesn't.
  const m = await page.evaluate(async () => { const { MIRROR, mirrorScreen } = await import("/src/live/relief.js"); return { back: MIRROR.back, plate: !!MIRROR.stillBack, h: mirrorScreen.height, rows: MIRROR.rows }; }); // prettier-ignore
  expect(m.back).toBe(true);
  expect(m.plate).toBe(true);
  expect(m.h).toBe(m.rows * 2);
  await page.evaluate(() => window.__splashery.app.chooseToy("photo-3d"));
  await page.waitForFunction(() => window.__splashery.player.scene.toy.id === "photo-3d" && document.getElementById("progress").hidden, null, { timeout: 180_000 }); // prettier-ignore
  expect(await page.evaluate(async () => (await import("/src/live/relief.js")).MIRROR.back)).toBe(false); // prettier-ignore
});

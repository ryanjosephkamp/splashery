// Lane Live input r6 (the owner's note of October 3, 2026, on Moving photo
// to 3D): pausing and playing keep the sound's place, one clock for the
// frames and the sound; and a clip plays at its source's own speed, however
// few frames the device draws. Fixtures: a 10-second 30 fps test pattern
// with a 440 Hz tone, and a 2-second 20 fps GIF (made with ffmpeg).

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=low&labs=1";
const mp = "/src/packs/moving-photo.js";
test.use({ viewport: { width: 390, height: 844 } });

async function open(page, file, name) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("moving-photo-3d"));
  await page.waitForFunction(() => window.__splashery.player.scene.toy.id === "moving-photo-3d" && window.__splashery.player.motion.recipe && document.getElementById("progress").hidden, null, { timeout: 180_000 }); // prettier-ignore
  await page.setInputFiles("#toy-input-file", file);
  await until(
    page,
    async ([m, n]) => (await import(m)).MOVING.clip?.name === n,
    [mp, name],
    280_000,
  );
  await page.waitForFunction(() => document.getElementById("progress").hidden, null, { timeout: 120_000 }); // prettier-ignore
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
    const { MOVING, clipLine } = await import(m);
    const c = MOVING.clip;
    const t = c?.audio?.track;
    return { t: MOVING.t, playing: !!t?.playing, sound: t ? t.time() : null, wall: performance.now() / 1000, n: c?.n, duration: c?.duration, source: c?.source, line: c ? clipLine(c) : "" }; // prettier-ignore
  }, mp);
const tap = (page) => page.evaluate(() => window.__splashery.app.act());

test("pausing and playing with a tap keep the sound's place; so do a scrub and Start over", async ({
  page,
}) => {
  test.setTimeout(400_000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page, "tests/fixtures/live6/long.webm", "long");
  if (!(await state(page)).playing) await page.evaluate(() => document.getElementById("moving-play").click()); // prettier-ignore
  await until(page, async (m) => (await import(m)).MOVING.clip?.audio?.track?.playing, mp, 30_000);
  await page.evaluate(() => document.getElementById("moving-start").click());
  await page.waitForTimeout(1500);
  // A tap on the picture pauses the frames and the sound together.
  await tap(page);
  await page.waitForTimeout(300);
  const p0 = await state(page);
  expect(p0.playing).toBe(false);
  await page.waitForTimeout(1000);
  const p1 = await state(page);
  expect(p1.playing).toBe(false);
  expect(Math.abs(p1.t - p0.t)).toBeLessThan(0.05);
  // Another tap plays both on from that place (the sound used to stay off
  // until Start over, then begin again from the start).
  await tap(page);
  await page.waitForTimeout(400);
  const r0 = await state(page);
  expect(r0.playing).toBe(true);
  expect(r0.sound).toBeGreaterThan(p1.t - 0.05);
  expect(r0.sound).toBeLessThan(p1.t + 0.8);
  await page.waitForTimeout(1500);
  const r1 = await state(page);
  expect(r1.playing).toBe(true);
  expect(r1.sound - r0.sound).toBeGreaterThan(1);
  expect(Math.abs(r1.t - r1.sound)).toBeLessThan(0.6); // one clock
  // Paused, a scrub moves the place; Play starts the sound there.
  await page.evaluate(() => document.getElementById("moving-play").click());
  await page.evaluate(() => {
    const s = document.getElementById("moving-seek");
    s.value = "500";
    s.dispatchEvent(new Event("input"));
    s.dispatchEvent(new Event("change"));
  });
  await page.evaluate(() => document.getElementById("moving-play").click());
  await page.waitForTimeout(400);
  const s0 = await state(page);
  expect(s0.playing).toBe(true);
  expect(s0.sound).toBeGreaterThan(3.9);
  expect(s0.sound).toBeLessThan(4.8);
  // Start over: the sound from the top.
  await page.evaluate(() => document.getElementById("moving-start").click());
  await page.waitForTimeout(300);
  const z = await state(page);
  expect(z.playing).toBe(true);
  expect(z.sound).toBeLessThan(0.8);
  expect(errors).toEqual([]);
});

test("a clip plays at its source's speed: a video's frame rate and length, a GIF's on its own clock", async ({
  page,
}) => {
  test.setTimeout(400_000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // The video: its first 8 seconds of 10, at the low profile's 12 frames a
  // second (r5 took 48 frames, 6 a second), and the line says so.
  await open(page, "tests/fixtures/live6/long.webm", "long");
  const v = await state(page);
  expect(v.duration).toBeCloseTo(8, 1);
  expect(v.source).toBeCloseTo(10, 0);
  expect(v.n).toBe(96);
  expect(v.line).toContain("8.0 s of 10.0 s");
  // The GIF (no sound): 2 seconds at 20 frames a second, kept at 12 a second
  // here; its clock keeps real time though this container's software
  // renderer draws only a few frames a second (it used to step at most a
  // quarter of a second a frame, so a slow device played it slow).
  await page.setInputFiles("#toy-input-file", "tests/fixtures/live6/fast.gif");
  await until(page, async (m) => (await import(m)).MOVING.clip?.name === "fast", mp, 280_000);
  await page.waitForFunction(() => document.getElementById("progress").hidden, null, { timeout: 120_000 }); // prettier-ignore
  const g = await state(page);
  expect(g.duration).toBeCloseTo(2, 1);
  expect(g.n).toBe(24);
  // Slow the drawing down further: the clock still keeps time.
  await page.evaluate(() => {
    const end = performance.now() + 4000;
    const hog = () => {
      const t = performance.now() + 300;
      while (performance.now() < t);
      if (performance.now() < end) setTimeout(hog, 0);
    };
    hog();
  });
  const a = await state(page);
  await page.waitForTimeout(3000);
  const b = await state(page);
  let dt = b.t - a.t;
  while (dt < 0) dt += g.duration;
  // Within the loop's length: the clock moved on as far as the wall clock,
  // less whole loops.
  const wall = (b.wall - a.wall) % g.duration;
  const off = Math.min(Math.abs(dt - wall), g.duration - Math.abs(dt - wall));
  expect(off).toBeLessThan(0.45);
  expect(errors).toEqual([]);
});

test("the splat mirror's background layer shows only behind and beside the person, never over the rest of the picture", async () => {
  const { BackPlate } = await import("../src/live/relief.js");
  // The picture: 40 by 20, a person (near) in the middle 8 by 8.
  const cols = 40;
  const rows = 20;
  const hts = new Float32Array(cols * rows);
  for (let y = 6; y < 14; y++) for (let x = 16; x < 24; x++) hts[y * cols + x] = 0.9;
  const bp = new BackPlate(20, 10);
  let img = null;
  const g = {
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: (i) => (img = i),
  };
  bp.draw(g, cols, rows, 0.5, hts);
  const alpha = (x, y) => img.data[(y * cols * 2 + cols + x) * 4 + 3];
  expect(alpha(20, 10)).toBe(255); // behind the person
  expect(alpha(13, 10)).toBe(255); // just beside
  expect(alpha(3, 3)).toBe(0); // the wall, away from the person
  expect(alpha(36, 17)).toBe(0);
  // It sits behind the wall: its offset never brings it forward of it.
  for (let i = 0; i < cols * rows; i++) expect(img.data[(Math.floor(i / cols) * cols * 2 + cols + (i % cols)) * 4 + 2]).toBeGreaterThanOrEqual(127); // prettier-ignore
});

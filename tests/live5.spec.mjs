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
  expect(s.w).toBe(480); // was 256 everywhere
  expect(s.grid.cols).toBe(480);
  expect(s.audio).toBe(true);
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

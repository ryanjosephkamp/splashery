// Lane Live r7 (the owner's request of October 6, 2026: "Can we support full
// video uploads beyond 8 seconds?"): a long video in Moving photo to 3D plays
// whole, with its depth worked out as it goes, in bounded memory, its frames
// and sound on one clock, and a Cancel. The fixture is a 60-second 160 by 90
// test pattern with a 330 Hz tone (made with ffmpeg, VP8 and Opus, 250 KB).

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=low&labs=1";
const mp = "/src/packs/moving-photo.js";
test.use({ viewport: { width: 390, height: 844 } });

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
    const c = MOVING.clip;
    const t = c?.audio?.track;
    const D = c?.depth;
    return {
      name: c?.name,
      long: !!c?.long,
      duration: c?.duration,
      t: MOVING.t,
      playing: !!t?.playing,
      sound: t ? t.time() : null,
      video: c?.video ? c.video.currentTime : null,
      colors: !!c?.colors,
      depth: D ? { n: D.n, done: D.done, bytes: D.frames.reduce((s, f) => s + (f ? f.length : 0), 0), budget: D.budget } : null, // prettier-ignore
      job: c?.job ? { done: c.job.done, cancelled: c.job.cancelled } : null,
      status: MOVING.longStatus || "",
    };
  }, mp);

test("a long video's memory is bounded on every tier, for ten minutes or an hour", async () => {
  const { longPlan, LONG_BUDGETS } = await import("../src/packs/moving-photo.js");
  for (const tier of ["low", "mid", "high", "max"])
    for (const sec of [60, 600, 3600]) {
      const p = longPlan(sec, 480, 270, tier);
      expect(p.bytes, `${tier}, ${sec} s`).toBeLessThanOrEqual(LONG_BUDGETS[tier]);
      expect(p.n).toBeGreaterThan(1);
    }
  // A phone (low): ten minutes keeps a depth picture a second, 13 MB.
  const low = longPlan(600, 480, 270, "low");
  expect(low.n).toBe(600);
  expect(low.bytes).toBeLessThan(15e6);
});

test("a 60-second video plays whole as its depth is worked out, on one clock with its sound, and Cancel stops the depth", async ({
  page,
}) => {
  test.setTimeout(600_000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("moving-photo-3d"));
  await page.waitForFunction(() => window.__splashery.player.scene.toy.id === "moving-photo-3d" && window.__splashery.player.motion.recipe && document.getElementById("progress").hidden, null, { timeout: 180_000 }); // prettier-ignore
  await page.setInputFiles("#toy-input-file", "tests/fixtures/lv7/long-60s.webm");
  await until(page, async (m) => (await import(m)).MOVING.clip?.name === "long-60s", mp, 400_000);
  await page.waitForFunction(() => document.getElementById("progress").hidden, null, { timeout: 120_000 }); // prettier-ignore
  const s0 = await state(page);
  expect(s0.long).toBe(true);
  expect(s0.duration).toBeCloseTo(60, 0);
  expect(s0.colors).toBe(false); // no frames kept: they're drawn from the playing video
  // A depth picture a second here (low), within the budget; the first few are in.
  expect(s0.depth.n).toBe(60);
  expect(s0.depth.done).toBeGreaterThanOrEqual(4);
  expect(s0.depth.bytes).toBeLessThanOrEqual(s0.depth.budget);
  // It says how far the depth has got and about how long is left.
  const line = await until(page, async (m) => { const s = (await import(m)).MOVING.longStatus || ""; return /Working out the depth: \d+ of 60 \(about .* left\)/.test(s) ? s : null; }, mp, 120_000); // prettier-ignore
  expect(line).toContain("It plays as it goes");
  // It plays meanwhile: the frames, the playing copy and the sound on one clock.
  if (!(await state(page)).playing) await page.evaluate(() => document.getElementById("moving-play").click()); // prettier-ignore
  await until(page, async (m) => (await import(m)).MOVING.clip?.audio?.track?.playing, mp, 30_000);
  await page.waitForTimeout(3000);
  const p = await state(page);
  expect(p.playing).toBe(true);
  expect(p.sound).toBeGreaterThan(1);
  expect(Math.abs(p.t - p.sound)).toBeLessThan(0.6);
  expect(Math.abs(p.video - p.sound)).toBeLessThan(0.6);
  // A scrub far into it: the sound and the copy go there.
  await page.evaluate(() => {
    const s = document.getElementById("moving-seek");
    s.value = "750";
    s.dispatchEvent(new Event("input"));
    s.dispatchEvent(new Event("change"));
  });
  await page.waitForTimeout(1500);
  const q = await state(page);
  expect(q.sound).toBeGreaterThan(44);
  expect(Math.abs(q.video - q.sound)).toBeLessThan(0.8);
  // Cancel: the depth stops where it is, and it plays on.
  await page.evaluate(() => document.getElementById("moving-long-cancel").click());
  await until(page, async (m) => (await import(m)).MOVING.clip?.job?.done, mp, 60_000);
  const c = await state(page);
  expect(c.job.cancelled).toBe(true);
  expect(c.depth.done).toBeLessThan(60);
  expect(c.status).toMatch(/^Stopped/);
  await page.waitForTimeout(1500);
  expect((await state(page)).playing).toBe(true);
  expect(errors).toEqual([]);
});

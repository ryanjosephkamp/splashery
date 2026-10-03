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

test("the mirror has a dark board behind its picture, and a gentler default depth", async ({
  page,
}) => {
  await page.goto(APP("mid"));
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("splat-mirror"));
  await page.waitForFunction(() => window.__splashery.player.scene.toy.id === "splat-mirror" && window.__splashery.player.motion.recipe && document.getElementById("progress").hidden, null, { timeout: 180_000 }); // prettier-ignore
  const r = await page.evaluate(async () => {
    const { MIRROR } = await import("/src/live/relief.js");
    const ctx = window.__splashery.player.proc.ctx;
    const b = ctx.buf;
    // Plain splats behind the picture's plane and inside its edges (the dark
    // board; the frame's bars lie outside).
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity; // prettier-ignore
    for (let i = 0; i < b.count; i++) {
      if (b.anim[i * 4 + 1] !== 24) continue;
      x0 = Math.min(x0, b.pos[i * 3]);
      x1 = Math.max(x1, b.pos[i * 3]);
      y0 = Math.min(y0, b.pos[i * 3 + 1]);
      y1 = Math.max(y1, b.pos[i * 3 + 1]);
      z0 = Math.min(z0, b.pos[i * 3 + 2]);
    }
    const mx = (x1 - x0) * 0.05;
    const my = (y1 - y0) * 0.05;
    let behind = 0;
    for (let i = 0; i < b.count; i++) {
      if (b.anim[i * 4 + 1] === 24) continue;
      const [x, y, z] = [b.pos[i * 3], b.pos[i * 3 + 1], b.pos[i * 3 + 2]];
      if (z < z0 - 0.005 && x > x0 + mx && x < x1 - mx && y > y0 + my && y < y1 - my) behind++; // prettier-ignore
    }
    return { depth: MIRROR.depth, behind, cells: MIRROR.cols * MIRROR.rows };
  });
  expect(r.depth).toBe(0.5);
  expect(r.behind).toBeGreaterThan(r.cells / 12);
});

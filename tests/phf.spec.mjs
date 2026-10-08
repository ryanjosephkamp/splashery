// Lane Photo fidelity: sharper Photo to 3D and Moving photo to 3D. With Detail on Fine (the
// default), their splats take their colors from the photo or the video at its own full size
// (photo-textured splats, src/photo-splats.js); One color per splat is the toys as they were.
// A long video's picture is as fine as the tier's splat grid (LONG_AREAS).

import { test, expect } from "@playwright/test";
import { LONG_AREAS, CLIP_AREAS } from "../src/packs/moving-photo.js";
import { RECIPES as P3D } from "../src/packs/photo-3d.js";
import { reliefScale, FLAT_KEEP } from "../src/packs/photo-3d-core.js";

const APP = "/?renderer=webgl2&adapt=off&profile=low&labs=1";
const mp = "/src/packs/moving-photo.js";

async function open(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "warning" && /GL_INVALID/.test(m.text())) errors.push(m.text());
  });
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  return errors;
}

const stage = (page) =>
  page.evaluate(() => {
    const st = window.__splashery.player.stage;
    return { photo: !!st.photo, toy: !!st.toy?.photo, tex: st.photoTex ? [st.photoTex.width, st.photoTex.height] : null }; // prettier-ignore
  });

async function until(page, check, arg = null, timeout = 120_000) {
  const end = Date.now() + timeout;
  for (;;) {
    const v = await page.evaluate(check, arg);
    if (v) return v;
    if (Date.now() > end) throw new Error(`Timed out waiting for ${check}`);
    await page.waitForTimeout(250);
  }
}

test("both toys offer Detail, Fine by default, so old scenes and links open sharp", () => {
  const detail = P3D["photo-3d"].options.find((o) => o.key === "detail");
  expect(detail.default).toBe("photo");
  expect(detail.choices.map((c) => c.id)).toEqual(["photo", "splats"]);
  expect(detail.choices[0].label).toMatch(/^Fine: /); // never a second "Sharp" beside Sharp picture
  expect(P3D["photo-3d"].photo.on({})).toBe(true);
  expect(P3D["photo-3d"].photo.on({ detail: "splats" })).toBe(false);
});

test("a flat picture keeps a gentle bend of its relief, a real scene all of it", () => {
  // The model's depth on our text page spans 0.21 to 0.23 of its nearest; real scenes 0.51 to 1.
  expect(reliefScale(2.37, 3.09)).toBe(FLAT_KEEP);
  expect(reliefScale(0.98, 2.02)).toBe(1); // Sintel
  expect(reliefScale(0, 6.73)).toBe(1); // the street
  const mid = reliefScale(0.65, 1); // a span of 0.35: halfway
  expect(mid).toBeCloseTo(FLAT_KEEP + (1 - FLAT_KEEP) / 2, 6);
});

test("a long video's picture is as fine as the tier's splat grid, and never smaller than a short clip's", async () => {
  const { MOVING_PHOTO } = await import("../src/packs/moving-photo.js");
  expect(MOVING_PHOTO.photo.on({ detail: "photo" })).toBe(true);
  expect(MOVING_PHOTO.photo.on({ detail: "splats" })).toBe(false);
  const budgets = { low: 90000, mid: 210000, high: 300000, max: 400000 }; // density 1.5
  for (const tier of Object.keys(LONG_AREAS)) {
    expect(LONG_AREAS[tier]).toBe(Math.round(budgets[tier] * 0.8));
    expect(LONG_AREAS[tier]).toBeGreaterThanOrEqual(CLIP_AREAS[tier]);
  }
});

test.describe(() => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Photo to 3D: Fine shows the photo itself; One color per splat turns it off", async ({
    page,
  }) => {
    const errors = await open(page);
    await page.evaluate(() => window.__splashery.app.chooseToy("photo-3d"));
    await until(page, () => window.__splashery.player.proc?.ctx?.kit?.data?.photo?.splats > 5000);
    await page.evaluate(() => window.__splashery.player.stage.captureFrame());
    expect(await stage(page)).toEqual({ photo: true, toy: true, tex: [1280, 853] });
    await page.evaluate(() => window.__splashery.app.setToyOptions({ detail: "splats" }));
    await until(page, () => !window.__splashery.player.stage.photo);
    expect((await stage(page)).toy).toBe(false);
    expect(errors).toEqual([]);
  });

  test("Moving photo to 3D: the sample, a GIF and a short video show their own pixels", async ({
    page,
  }) => {
    test.setTimeout(400_000);
    const errors = await open(page);
    await page.evaluate(() => window.__splashery.app.chooseToy("moving-photo-3d"));
    await until(page, async (m) => !!(await import(m)).MOVING.grid, mp, 180_000);
    await page.evaluate(() => window.__splashery.player.stage.captureFrame());
    const s = await stage(page);
    expect(s.toy).toBe(true);
    expect(s.tex).toEqual([480, 270]); // the sample's frames, as the low tier keeps them
    // A GIF: its frames at its own size.
    await page.setInputFiles("#toy-input-file", "assets/toys/screen/horse.gif");
    await until(page, async (m) => (await import(m)).MOVING.clip?.name === "horse", mp, 300_000);
    await page.evaluate(() => window.__splashery.player.stage.captureFrame());
    expect((await stage(page)).tex).toEqual([300, 200]);
    // A short video keeps a muted copy on the clip's clock, and its picture is the copy's own.
    await page.setInputFiles("#toy-input-file", "tests/fixtures/live5/tone.webm");
    await until(page, async (m) => (await import(m)).MOVING.clip?.name === "tone", mp, 300_000);
    const v = await until(page, async (m) => { const c = (await import(m)).MOVING.clip; return c?.video?.readyState >= 2 ? { w: c.w, h: c.h, vw: c.video.videoWidth } : null; }, mp); // prettier-ignore
    expect(v.vw).toBe(320);
    await until(page, () => { window.__splashery.player.stage.requestRender(); return window.__splashery.player.stage.photoTex?.width === 320; }); // prettier-ignore
    expect((await stage(page)).tex).toEqual([320, 180]);
    expect(errors).toEqual([]);
  });

  test("Moving photo to 3D: a long video's picture comes from its playing copy, at the video's size", async ({
    page,
  }) => {
    test.setTimeout(600_000);
    const errors = await open(page);
    await page.evaluate(() => window.__splashery.app.chooseToy("moving-photo-3d"));
    await until(page, async (m) => !!(await import(m)).MOVING.grid, mp, 180_000);
    await page.setInputFiles("#toy-input-file", "tests/fixtures/lv7/long-60s.webm");
    await until(page, async (m) => (await import(m)).MOVING.clip?.name === "long-60s", mp, 400_000); // prettier-ignore
    const c = await page.evaluate(async (m) => { const c = (await import(m)).MOVING.clip; return { long: c.long, w: c.w, h: c.h }; }, mp); // prettier-ignore
    expect(c.long).toBe(true);
    expect([c.w, c.h]).toEqual([160, 90]); // under the low tier's 72,000 pixels: the video's own size
    await until(page, () => { window.__splashery.player.stage.requestRender(); return window.__splashery.player.stage.photoTex?.width === 160; }); // prettier-ignore
    await page.evaluate(async (m) => (await import(m)).MOVING.clip?.job?.cancel(), mp);
    expect(errors).toEqual([]);
  });

  test("screenshots at phone and desktop size", async ({ browser }) => {
    test.setTimeout(400_000);
    for (const [w, h] of [
      [390, 844],
      [1440, 900],
    ]) {
      for (const toy of ["photo-3d", "moving-photo-3d"]) {
        const page = await browser.newPage({ viewport: { width: w, height: h } });
        await page.goto(APP);
        await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
        await page.evaluate((t) => window.__splashery.app.chooseToy(t), toy);
        await page.waitForFunction(() => window.__splashery.player.stage.photoTex && document.getElementById("progress").hidden, null, { timeout: 180_000 }); // prettier-ignore
        if (toy === "photo-3d")
          await page.evaluate(() => window.__splashery.player.motion.setControl("flat", 0, { snap: true })); // prettier-ignore
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `tests/screenshots/phf-${toy}-${w}x${h}.png` });
        await page.close();
      }
    }
  });
});

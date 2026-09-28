// Lane Screens' engine additions (docs/handoff/Screens.md): a picture
// toy's prepare(options, help) can open the media its build will show
// (help.media()), and the pictures API can seek a video (time, duration,
// seek). Other toys are unchanged.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";

async function openLab(page) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("picture-lab"));
  await page.waitForFunction(() => window.__splashery.player.pictures?.media, null, { timeout: 120_000 }); // prettier-ignore
}

test("a picture toy's prepare can open the media its build shows, opened once", async ({
  page,
}) => {
  await openLab(page);
  const r = await page.evaluate(async () => {
    const { player } = window.__splashery;
    const toy = player.scene.toy;
    const recipe = player.toyInfo.recipe;
    const shown = player.pictures.media;
    const help = player.prepareHelp(toy, recipe, { sample: "article" });
    const m = await help.media();
    // A toy without pictures gets no help.
    const none = player.prepareHelp(toy, { build() {} }, {});
    return { kind: m?.kind, same: m === shown, none: Object.keys(none).length };
  });
  expect(r).toEqual({ kind: "pdf", same: true, none: 0 });
});

test("a video can be sought: time, duration and seek", async ({ page }) => {
  await openLab(page);
  await page.evaluate(() => window.__splashery.app.openMedia(`${location.origin}/tests/fixtures/pic/clip.webm`)); // prettier-ignore
  await page.waitForFunction(() => window.__splashery.player.pictures?.media?.kind === "video", null, { timeout: 60_000 }); // prettier-ignore
  const d = await page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.pictures.duration); // prettier-ignore
  expect(d).toBeGreaterThan(0.5);
  await page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.pictures.seek(0.5));
  await page.waitForFunction(
    () => Math.abs(window.__splashery.player.motion.ctx.kit.data.pictures.time - 0.5) < 0.05,
    null,
    { timeout: 20_000 },
  );
  // A PDF has no time and ignores a seek.
  await page.evaluate(() => window.__splashery.app.clearMedia());
  await page.waitForFunction(() => window.__splashery.player.pictures?.media?.kind === "pdf", null, { timeout: 60_000 }); // prettier-ignore
  const pdf = await page.evaluate(() => {
    const p = window.__splashery.player.motion.ctx.kit.data.pictures;
    p.seek(3);
    return [p.time, p.duration];
  });
  expect(pdf).toEqual([0, 0]);
});

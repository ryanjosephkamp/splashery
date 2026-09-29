// Lane Screens' engine addition (docs/handoff/Screens.md): a picture toy's
// prepare(options, help) can open the media its build will show
// (help.media()). Other toys are unchanged.

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

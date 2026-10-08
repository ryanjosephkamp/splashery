// Lane Photo sharp view r2 (docs/handoff/PhotoSharpView.md): saved scenes and #s= links remember the
// view (the owner's call of October 8, 2026: "I want saved scenes to remember sharp/splat"). The
// choice is the toy option `view` ("sharp" or "splats"); a scene without it, as every scene saved
// before, opens in Sharp picture.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";

async function ready(page, url = APP) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
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
  await page.waitForTimeout(800);
}

const view = (page, toy) =>
  page.evaluate((t) => ({ ...window.__psv.state(), view: window.__psv.state().views[t] }), toy);

// Both toys: pick a view with the switch, save the scene, open it again in a fresh page.
for (const toy of ["photo-3d", "moving-photo-3d"]) {
  test.describe(toy, () => {
    test.setTimeout(400_000);

    test("a saved scene remembers each view", async ({ page, browser }) => {
      const errors = await ready(page);
      await page.evaluate((t) => window.__splashery.app.chooseToy(t), toy);
      await built(page, toy);
      // Nothing is stored until someone picks.
      let scene = await page.evaluate(() => window.__splashery.app.exportScene());
      expect(scene.toy.options?.view).toBeUndefined();
      for (const pick of ["splats", "sharp"]) {
        await page.evaluate((p) => document.querySelector(`#psv-${p}`).click(), pick);
        await page.waitForTimeout(300);
        scene = await page.evaluate(() => window.__splashery.app.exportScene());
        expect(scene.toy.options.view).toBe(pick);
        // through JSON, into a fresh page
        const json = JSON.parse(JSON.stringify(scene));
        const other = await browser.newPage();
        const errors2 = await ready(other);
        await other.evaluate((s) => window.__splashery.app.applyScene(s), json);
        await built(other, toy);
        const v = await view(other, toy);
        expect(v.view).toBe(pick);
        await expect(other.locator(`#psv-${pick}`)).toHaveAttribute("aria-pressed", "true");
        if (pick === "splats") expect(v.on).toBe(false);
        else await other.waitForFunction(() => window.__psv.state().on, null, { timeout: 60_000 });
        expect(errors2).toEqual([]);
        await other.close();
      }
      expect(errors).toEqual([]);
    });

    test("a link remembers Splats, and the Detail choice with it", async ({ page, browser }) => {
      const errors = await ready(page);
      await page.evaluate((t) => window.__splashery.app.chooseToy(t), toy);
      await built(page, toy);
      await page.evaluate(() => window.__splashery.app.setToyOptions({ detail: "splats" }));
      await built(page, toy);
      await page.evaluate(() => document.querySelector("#psv-splats").click());
      await page.waitForTimeout(300);
      await page.evaluate(() => window.__splashery.app.copyLink().catch(() => {}));
      await page.waitForFunction(() => location.hash.startsWith("#s="), null, { timeout: 30_000 });
      const hash = await page.evaluate(() => location.hash);
      const other = await browser.newPage();
      const errors2 = await ready(other, APP + hash);
      await built(other, toy);
      const v = await view(other, toy);
      expect(v.view).toBe("splats");
      expect(v.on).toBe(false);
      const options = await other.evaluate(() => window.__splashery.player.scene.toy.options);
      expect(options).toMatchObject({ view: "splats", detail: "splats" });
      expect(errors).toEqual([]);
      expect(errors2).toEqual([]);
      await other.close();
    });

    test("an old scene without the key opens in Sharp picture", async ({ page }) => {
      const errors = await ready(page);
      // (in this page the view was Splats, so the old scene must switch it back)
      await page.evaluate((t) => window.__splashery.app.chooseToy(t), toy);
      await built(page, toy);
      await page.evaluate(() => document.querySelector("#psv-splats").click());
      const scene = await page.evaluate(() => {
        const s = window.__splashery.app.exportScene();
        delete s.toy.options.view;
        return s;
      });
      await page.evaluate((s) => window.__splashery.app.applyScene(s), scene);
      await built(page, toy);
      expect((await view(page, toy)).view).toBe("sharp");
      await page.waitForFunction(() => window.__psv.state().on, null, { timeout: 60_000 });
      expect(errors).toEqual([]);
    });
  });
}

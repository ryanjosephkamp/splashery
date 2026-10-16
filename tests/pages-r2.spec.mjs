// Task 95: real renderer checks for face ownership, motion, and lifetime.
import { test, expect } from "@playwright/test";

const ready = async (page) => {
  await page.waitForFunction(
    () => {
      const pl = window.__splashery.player,
        p = pl.pictures;
      pl.stage.requestRender();
      return (
        p?.media && p.splats() > 0 && p.sheets.every((s) => !s.want || s.shown?.key === s.want.key)
      );
    },
    null,
    { timeout: 180000 },
  );
};

test.describe("sharp pages in the real renderer", () => {
  test.setTimeout(360000);
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

  test("still pages own continuous faces, moving media and the neighboring frame retain their splats", async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/?renderer=webgl2&profile=low&adapt=off&labs=1");
    await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("picture-lab"));
    await ready(page);
    const old = await page.evaluateHandle(
      () => window.__splashery.player.pictures.sheets[0].slot.surface,
    );
    expect(await old.evaluate((s) => !!s && s.instance.visible && s.material.depthWrite)).toBe(
      true,
    );
    const before = await page.evaluate(
      () =>
        window.__splashery.player.stage.app.scene.layers.getLayerByName("World").meshInstances
          .length,
    );
    for (const file of ["photo.jpg", "anim.gif", "photo.jpg", "clip.webm"]) {
      await page.evaluate(
        (file) =>
          window.__splashery.app.openMedia(
            new URL(`/tests/fixtures/pic/${file}`, location.href).href,
          ),
        file,
      );
      await ready(page);
      const image = file === "photo.jpg";
      expect(
        await page.evaluate(() => !!window.__splashery.player.pictures.sheets[0].slot.surface),
      ).toBe(image);
    }
    expect(await old.evaluate((s) => s.layer.meshInstances.includes(s.instance))).toBe(false);
    await old.dispose();
    await page.evaluate(() => window.__splashery.app.chooseToy("picture-frame"));
    await ready(page);
    expect(
      await page.evaluate(() =>
        window.__splashery.player.pictures.sheets.some((s) => !!s.slot?.surface),
      ),
    ).toBe(false);
    expect(
      await page.evaluate(
        () =>
          window.__splashery.player.stage.app.scene.layers.getLayerByName("World").meshInstances
            .length,
      ),
    ).toBeLessThan(before);
    expect(errors).toEqual([]);
  });

  test("a turning leaf's two faces remain attached and leave no face in the next toy", async ({
    page,
  }) => {
    await page.goto("/?renderer=webgl2&profile=low&adapt=off&labs=1");
    await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
    await page.evaluate(async () => {
      const a = window.__splashery.app;
      await a.chooseToy("your-book");
      await a.openMedia(new URL("/tests/fixtures/bk/booklet.pdf", location.href).href);
    });
    await ready(page);
    await page.evaluate(() => window.__splashery.player.act());
    await page.waitForFunction(
      () => {
        const pl = window.__splashery.player;
        pl.stage.requestRender();
        return pl.pictures.page > 0;
      },
      null,
      { timeout: 120000 },
    );
    await ready(page);
    const faces = await page.evaluateHandle(() =>
      window.__splashery.player.pictures.sheets.map((s) => s.slot?.surface).filter(Boolean),
    );
    const count = await faces.evaluate((s) => s.length);
    expect(count).toBeGreaterThan(1);
    expect(
      await faces.evaluate((s) =>
        s.every((f) => f.instance.node === f.slot.entity && f.material.depthWrite),
      ),
    ).toBe(true);
    await page.evaluate(() => window.__splashery.app.chooseToy("laptop"));
    await page.waitForFunction(
      () => {
        window.__splashery.player.stage.requestRender();
        return !window.__splashery.player.stage.graveyard.length;
      },
      null,
      { timeout: 60000 },
    );
    expect(
      await faces.evaluate((s) => s.every((f) => !f.layer.meshInstances.includes(f.instance))),
    ).toBe(true);
    await faces.dispose();
  });
});

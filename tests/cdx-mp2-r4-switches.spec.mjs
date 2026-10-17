// Task 101: independent source-binding checks keep the original phone fixtures.
import { test, expect } from "@playwright/test";

import { android, watchPictures, chosenPicture } from "./cdx-mp2-r4-helpers.mjs";

test.describe("phone clip switches", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: android,
  });
  test("MP4, WebM, MOV, GIF, and 60 fps uploads keep their own Sharp picture and share video sound", async ({
    page,
    context,
  }) => {
    test.setTimeout(600_000);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
    await page.waitForSelector("body[data-ready='true']");
    await watchPictures(page);
    // These assertions read every native source pixel and the texture binding.
    // The unused stage image needs only CSS resolution; keep the phone viewport.
    await page.evaluate(() => {
      const stage = window.__splashery.player.stage;
      const { width, height } = stage.canvas.getBoundingClientRect();
      stage.setFixedSize([Math.round(width), Math.round(height)]);
    });
    const hashes = [];
    for (const file of ["blocks.mp4", "gate.webm", "wheel.mov", "orbit.gif", "fast.webm"]) {
      const name = `cdx-mp2-r4-${file.split(".")[0]}`;
      await page.setInputFiles("#toy-input-file", `assets/toys/moving-photo-3d/cdx-mp2-r4-${file}`);
      await page.waitForFunction(
        (name) =>
          window.__r4Moving.MOVING.clip?.name === name &&
          window.__r4Moving.MOVING.clip === window.__r4Moving.MOVING.custom &&
          !window.__splashery.player.loading,
        name,
      );
      const uploaded = await chosenPicture(page);
      expect(uploaded).toMatchObject({ name, own: true, sharp: true, bound: true, shared: true });
      hashes.push(uploaded.hash);
      await page.evaluate(() => window.__splashery.app.setToyOptions({ clip: "machine" }));
      expect(await chosenPicture(page)).toMatchObject({
        sample: "machine",
        own: true,
        sharp: true,
        bound: true,
      });
      await page.evaluate(
        (clipName) => window.__splashery.app.setToyOptions({ clip: "custom", clipName }),
        name,
      );
      expect(await chosenPicture(page)).toMatchObject({
        name,
        own: true,
        sharp: true,
        bound: true,
        shared: true,
      });
      await page.evaluate(() => window.__psv.set("moving-photo-3d", "splats"));
      await page.waitForFunction(
        () => !window.__psv.state().on && window.__splashery.player.stage.toy.entity.gsplat.enabled,
      );
      await page.evaluate(() => window.__psv.set("moving-photo-3d", "sharp"));
      expect(await chosenPicture(page)).toMatchObject({
        name,
        own: true,
        sharp: true,
        bound: true,
      });
    }
    expect(new Set(hashes).size).toBe(5);
  });
  test("every ordered sample pair binds the chosen clip's actual picture", async ({
    page,
    context,
  }) => {
    test.setTimeout(900_000);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
    await page.waitForSelector("body[data-ready='true']");
    await watchPictures(page);
    // These assertions read every native source pixel and the texture binding.
    // The unused stage image needs only CSS resolution; keep the phone viewport.
    await page.evaluate(() => {
      const stage = window.__splashery.player.stage;
      const { width, height } = stage.canvas.getBoundingClientRect();
      stage.setFixedSize([Math.round(width), Math.round(height)]);
    });
    const ids = await page.evaluate(() =>
      window.__r4Moving.MOVING_PHOTO.options
        .find((o) => o.key === "clip")
        .choices.filter((c) => c.id !== "custom")
        .map((c) => c.id),
    );
    expect(ids).toHaveLength(9);
    for (const from of ids)
      for (const to of ids) {
        await page.evaluate((clip) => window.__splashery.app.setToyOptions({ clip }), from);
        await page.evaluate((clip) => window.__splashery.app.setToyOptions({ clip }), to);
        expect(await chosenPicture(page), `${from} to ${to}`).toMatchObject({
          sample: to,
          own: true,
          sharp: true,
          bound: true,
        });
      }
    const resources = await page.evaluate(() => {
      const clips = [...window.__r4Moving.MOVING.samples.values()];
      return {
        active: clips.filter((c) => c.video?.getAttribute("src")).length,
        shared: clips.every((c) => !c.video || c.audio?.track.el === c.video),
      };
    });
    expect(resources).toEqual({ active: 1, shared: true });
  });
});

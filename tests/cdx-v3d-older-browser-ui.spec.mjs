// MIT. Made by Ryan with Codex (GPT-6). File-input compatibility, with real local media.
import { test, expect } from "@playwright/test";

test("the toy loads a real clip and shows the same feedback without either frame API", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    globalThis.VideoFrame = undefined;
    HTMLVideoElement.prototype.requestVideoFrameCallback = undefined;
    HTMLVideoElement.prototype.cancelVideoFrameCallback = undefined;
  });
  await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
  await page.waitForSelector("body[data-ready='true']");
  await page.evaluate(() => window.__splashery.app.chooseToy("video-3d"));
  await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.video);
  await page.locator("#toy-input-file").setInputFiles("assets/toys/video-3d/toolse-source.webm");
  await expect(page.locator("#v3d-card .v3d-assessment")).toBeVisible();
  await expect(page.locator("#v3d-card .v3d-assessment")).toContainText(
    "This stretch may work, with some risks.",
  );
  expect(errors).toEqual([]);
});

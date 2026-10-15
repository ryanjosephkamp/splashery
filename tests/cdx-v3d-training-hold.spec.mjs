import { test, expect } from "@playwright/test";

test("Finish now retains its GPU hold, and leaving releases it before cleanup settles", async ({
  page,
}) => {
  await page.route("**/tests/fixtures/v3d/", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><script type="importmap">{"imports":{"gifenc":"/vendor/gifenc/gifenc.esm.js"}}</script>',
    }),
  );
  await page.route("**/src/video3d/run.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `export const webgpuStatus=async()=>({ok:true}), isPhone=()=>false, estimateMinutes=()=>[1,2];
        export async function videoTo3D(file, opts) {
          window.trainingSignal=opts.signal;
          opts.onProgress({stage:'train',done:0,total:1200});
          await new Promise(resolve=>window.finishDrain=resolve);
          throw new DOMException('Stopped','AbortError');
        }`,
    }),
  );
  await page.addInitScript(() => {
    window.__v3dSettings = {};
    window.activeHolds = 0;
    window.__splashery = {
      player: {
        loadToken: 1,
        profile: "low",
        paused: false,
        scene: { toy: { id: "video-3d", options: { source: "liberty" } } },
        setPaused(value) {
          this.paused = !!value;
        },
        stage: {
          holdRendering() {
            window.activeHolds++;
            return () => window.activeHolds--;
          },
        },
      },
    };
  });
  await page.goto("/tests/fixtures/v3d/");
  await page.evaluate(async () => {
    const { openVideoFile, RECIPES } = await import("/src/packs/video3d.js");
    const blob = await (await fetch("/assets/toys/video-3d/liberty-source.webm")).blob();
    await openVideoFile(new File([blob], "orbit.webm", { type: "video/webm" }), "orbit");
    const options = { source: "custom", start: "0", length: "10", rate: "3", setting: "phone" };
    window.__splashery.player.scene.toy.options = options;
    window.pendingTraining = RECIPES["video-3d"].prepare(options);
  });
  await expect.poll(() => page.evaluate(() => typeof window.finishDrain)).toBe("function");
  expect(await page.evaluate(() => [window.activeHolds, window.__splashery.player.paused])).toEqual(
    [1, true],
  );
  await page.getByRole("button", { name: "Finish now", exact: true }).click();
  expect(
    await page.evaluate(() => [
      window.trainingSignal.aborted,
      window.activeHolds,
      window.__splashery.player.paused,
    ]),
  ).toEqual([true, 1, true]);
  await page.evaluate(() => {
    const player = window.__splashery.player;
    player.scene.toy = { id: "diamond", options: {} };
    player.loadToken++;
  });
  await expect
    .poll(() => page.evaluate(() => [window.activeHolds, window.__splashery.player.paused]))
    .toEqual([0, false]);
  await page.evaluate(async () => {
    window.finishDrain();
    await window.pendingTraining;
  });
  expect(await page.evaluate(() => window.activeHolds)).toBe(0);
});

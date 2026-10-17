import { test, expect } from "@playwright/test";

test("Studio panorama opens inside, leans, steps, warns, and leaves cleanly", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?labs=1&renderer=webgl2&profile=low&toy=step-inside-360");
  await page.waitForSelector("body[data-ready=true]");
  await page.evaluate(() => window.__splashery.app.chooseToy("step-inside-360"));
  await page.waitForFunction(() => window.__splashery?.player?.toyInfo?.recipe?.inside);
  await expect(page.locator("#toy-status")).toContainText("Step inside");
  await page.getByRole("button", { name: "More", exact: true }).click();
  const getPosition = () =>
    page.evaluate(() => window.__splashery.player.motion.out.parts.shell.offset);
  const before = await getPosition();
  await page.locator("#pano-right").click();
  await expect.poll(async () => (await getPosition())[0]).toBeGreaterThan(before[0] + 0.1);
  for (let i = 0; i < 5; i++) await page.locator("#pano-step").click();
  await expect.poll(async () => Math.hypot(...(await getPosition()))).toBeGreaterThan(0.85);
  expect(Math.hypot(...(await getPosition()))).toBeLessThan(1.01);
  await expect
    .poll(() => page.evaluate(() => JSON.stringify(window.__splashery.player.motion.out.legend)))
    .toContain("Stretch warning");
  await page.locator("#pano-home").click();
  await expect.poll(async () => Math.hypot(...(await getPosition()))).toBeLessThan(0.01);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "tests/screenshots/cdx-pano-390x844.png" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: "tests/screenshots/cdx-pano-1440x900.png" });
  await page.evaluate(() => window.__splashery.app.chooseToy("photo-3d"));
  await expect(page.locator("#toy-status")).toHaveText(/^Photo to 3D/);
  expect(await page.evaluate(() => window.__splashery.player.camera.inside)).toBeNull();
  expect(errors).toEqual([]);
});

test("invalid panorama reports a useful error without replacing the current room", async ({
  page,
}) => {
  await page.goto("/?labs=1&renderer=webgl2&profile=low&toy=step-inside-360");
  await page.waitForSelector("body[data-ready=true]");
  await page.evaluate(() => window.__splashery.app.chooseToy("step-inside-360"));
  await page.waitForFunction(() => window.__splashery?.player?.toyInfo?.recipe?.inside);
  await page.locator("#toy-input-file").setInputFiles("assets/toys/photo-3d/forest.jpg");
  await expect(page.locator("#toy-input [role=alert]")).toContainText("2:1");
  expect(await page.evaluate(() => window.__splashery.player.camera.inside.fov)).toBe(72);
});

test("a file finishing after a newer sample selection cannot replace that sample", async ({
  page,
}) => {
  await page.goto("/?labs=1&renderer=webgl2&profile=low");
  await page.waitForSelector("body[data-ready=true]");
  await page.evaluate(() => window.__splashery.app.chooseToy("step-inside-360"));
  const result = await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    const blob = await (await fetch("/assets/toys/step-inside-360/room.jpg")).blob();
    const file = new File([blob], "delayed.jpg", { type: "image/jpeg" });
    const slice = file.slice.bind(file);
    let release;
    const gate = new Promise((r) => {
      release = r;
    });
    file.slice = (...args) => ({
      arrayBuffer: async () => {
        await gate;
        return slice(...args).arrayBuffer();
      },
    });
    const pending = player.toyInfo.recipe.input.read("", file.name, file).then(
      () => "stale result",
      (e) => e.message,
    );
    await app.setToyOptions({ source: "room2" });
    release();
    return { result: await pending, source: player.scene.toy.options.source };
  });
  expect(result).toEqual({ result: "Panorama canceled.", source: "room2" });
});

import { test, expect } from "@playwright/test";

// Recording Playwright's full-page screencast adds GPU readbacks and JPEG work
// to every sample. Capture review images separately; measure cadence unrecorded.
test.use({ trace: "off", screenshot: "off" });

const scene = Buffer.from(
  JSON.stringify({
    app: "splashery",
    version: 3,
    toy: { kind: "builtin", id: "walk-inside" },
    autoplay: { turntable: false },
  }),
).toString("base64url");

for (const profile of ["phone", "desktop"]) {
  test(`${profile}: standing and walking frame cadence in both test places`, async ({
    browser,
  }) => {
    const phone = profile === "phone";
    const context = await browser.newContext({
      viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      deviceScaleFactor: phone ? 3 : 1,
      hasTouch: phone,
      isMobile: phone,
    });
    const page = await context.newPage();
    if (phone)
      await (await context.newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto(
      `/?labs=1&renderer=webgl2&adapt=off&profile=${phone ? "low" : "high"}#s=j.${scene}`,
    );
    await page.waitForFunction(() => globalThis.__splashery?.player?.toyInfo?.id === "walk-inside");
    await page.evaluate(() => globalThis.__splashery.app.act());
    await page.waitForFunction(() => document.querySelector("#walk-dialog")?.walk?.body);
    for (const room of ["gallery", "courtyard"]) {
      await page.locator("#walk-place").selectOption(room);
      await page.waitForFunction(() => !document.querySelector("#walk-dialog").walk.busy);
      for (const thirdPerson of [false, true]) {
        const current = await page.evaluate(
          () => document.querySelector("#walk-dialog").walk.thirdPerson,
        );
        if (current !== thirdPerson) await page.locator("#walk-character").click();
        await expect(page.locator("#walk-character")).toHaveAttribute(
          "aria-pressed",
          String(thirdPerson),
        );
        for (const walking of [false, true]) {
          // Measure steady-state cadence after Auto detail has observed slow
          // initial frames and selected its drawing buffer size.
          await page.waitForTimeout(4000);
          await page.evaluate(() => {
            document.querySelector("#walk-dialog").walk.view.world.frameMs.length = 0;
          });
          if (walking) await page.keyboard.down("KeyW");
          await page.waitForTimeout(2500);
          if (walking) await page.keyboard.up("KeyW");
          const result = await page.evaluate(() => {
            const w = document.querySelector("#walk-dialog").walk;
            const values = w.view.world.frameMs.slice().sort((a, b) => a - b);
            return {
              n: values.length,
              mean: values.reduce((n, v) => n + v, 0) / values.length,
              median: values[Math.floor(values.length * 0.5)],
              p95: values[Math.floor(values.length * 0.95)],
              canvas: [w.canvas.width, w.canvas.height],
              ratio: w.view.pixelRatio,
            };
          });
          console.log(JSON.stringify({ profile, room, thirdPerson, walking, ...result }));
          expect(result.n).toBeGreaterThan(0);
          expect(Number.isFinite(result.mean)).toBe(true);
          // The brief's 30 fps gate is for the phone profile. Desktop frame
          // times are recorded too; SwiftShader is not a hardware GPU result.
          if (phone) {
            expect(result.n).toBeGreaterThan(30);
            expect(result.median).toBeLessThanOrEqual(1000 / 30 + 0.5);
            expect(result.mean).toBeLessThanOrEqual(1000 / 30 + 0.5);
          }
        }
      }
    }
    await context.close();
  });
}
